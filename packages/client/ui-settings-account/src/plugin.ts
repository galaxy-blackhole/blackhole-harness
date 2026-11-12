/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-settings-account: tu dien, kho tai khoan, kho trang Platform, bon be mat va SAU lan tiem slot nguyen van
 */

import { AccountAvatarLoader } from "./account-avatar.ts";
import { createAccountMenu } from "./account-menu.ts";
import { createAccountNoticeCard } from "./account-notice.ts";
import { createAccountQuotaNotice } from "./account-quota-notice.ts";
import { createAccountSection } from "./account-section.ts";
import { createAccountAvatar } from "./account-avatar-view.ts";
import { authorizeUrlWithTheme, BrowserLogin, type BrowserLoginView } from "./browser-login.ts";
import { accountClientMetadata } from "./client-metadata.ts";
import { contactUrl, resolveContactConfig } from "./contact.ts";
import type { AccountOperations, AccountSnapshot, AccountView, MatchedQuotaNotice, ObservableStore, PlatformBridge, PlatformPageClaim, ThemeSnapshot } from "./contracts.ts";
import { injectStyles } from "./css.ts";
import { createBonusNoticeController } from "./bonus-notices.ts";
import { createDesktopOnboarding } from "./desktop-onboarding.ts";
import { createDesktopOnboardingEntry } from "./desktop-onboarding-entry.ts";
import { createOnboardingSteps } from "./onboarding-steps.ts";
import { createOnboardingSurface } from "./onboarding-surface.ts";
import { createPlatformOverlay } from "./platform-overlay.ts";
import { createPlatformPageOpener, createPlatformPages } from "./platform-pages.ts";
import { createSignInComponents } from "./sign-in-dialog.ts";
import { createSignOutComponents } from "./sign-out-dialog.ts";
import { DesktopOnboardingController } from "./onboarding-state.ts";
import { readOnboardingApiKeyPresence } from "./onboarding-credentials.ts";
import { en, zh } from "./locales.ts";
import { loadRuntime } from "./runtime.ts";
import {
  ACCOUNT_SECTION_ID,
  ACCOUNT_SECTION_ORDER,
  CLIENT_VERSION,
  CONTACT_CONFIG_GLOBAL,
  DESKTOP_GLOBAL,
  DESKTOP_ONBOARDING_NAMESPACE,
  EFFECT,
  EVENT_CREDENTIAL_REFERENCE_UPDATED,
  EVENT_LLM_ADAPTERS_UPDATED,
  EVENT_MODEL_SIGN_IN_REQUIRED,
  EVENT_SESSION_EXPIRED,
  EVENT_THEME_CHANGE,
  INJECT,
  NS,
  ONBOARDING_GLOBAL,
  ONBOARDING_OCCUPANT_ID,
  PACKAGE_NAME,
  PLATFORM_GLOBAL,
  PLATFORM_PAGE_OCCUPANT_ID,
  SLOT_MODELS_SIGN_IN,
  SLOT_QUOTA_NOTICE,
  SLOT_SETTINGS_LAUNCHER,
  SLOT_SETTINGS_SECTION,
  SLOT_SHELL_OVERLAY,
  TRANSPORT_GLOBAL,
} from "./ids.ts";
import type { Translator } from "./types.ts";
import { vi } from "./locales-vi.ts";

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** Mot ket qua RPC cua Host — nguyen van hinh dang cua ban goc. */
export interface RemoteResult<T> {
  /** true khi Host tra ve gia tri. */
  readonly ok: boolean;
  /** Gia tri khi thanh cong. */
  readonly value: T;
  /** Loi khi that bai. */
  readonly error?: unknown;
}

/** Cac namespace Remote ma nua host cua row api-remotes phuc vu. */
export interface RemoteApi {
  /** Mo mot stream day tu Host. */
  $stream(options: { name: string; open: (signal: unknown) => unknown; ended: () => Error }): AsyncIterable<{ value: AccountView; accept: () => void }> & { dispose(): void };
  /** Nghe mot su kien day tu Host; tra ham huy. */
  $on(event: string, run: () => void): () => void;
  /** Namespace tai khoan. */
  account: {
    /** Doc thuong chua thong bao. */
    getUnnotifiedBonuses(metadata: unknown): Promise<RemoteResult<{ accountId: string; bonuses: ReadonlyArray<{ orderId: string; message: string; expiresAt: string }> }>>;
    /** Xac nhan da thong bao mot don. */
    ackBonusNotified(accountId: string, orderId: string, metadata: unknown): Promise<RemoteResult<boolean>>;
    /** Doc ho so. */
    getProfile(metadata: unknown): Promise<RemoteResult<{ status: string; value: { id: string; name?: string; contact?: string; avatarUrl?: string } }>>;
    /** Doc so du. */
    getBalance(metadata: unknown): Promise<RemoteResult<{ status: string; value: readonly { currency: string; balance: string }[]; bonusWallets: readonly { currency: string; balance: string }[] }>>;
    /** Theo doi trang thai tai khoan. */
    watch(signal: unknown): unknown;
    /** Bat dau dang nhap. */
    startSignIn(metadata: unknown, origin: string, surface: string): Promise<RemoteResult<{ attempt?: { id?: string; phase?: string; authorizeUrl?: string } }>>;
    /** Huy dang nhap. */
    cancelSignIn(id: string): Promise<RemoteResult<unknown>>;
    /** Co tac vu tai khoan nao dang chay khong. */
    hasRunningAccountTasks(): Promise<RemoteResult<boolean>>;
    /** Dang xuat. */
    signOut(metadata: unknown): Promise<RemoteResult<unknown>>;
  };
  /** Namespace phien. */
  session: {
    /** Khoi tao model mac dinh. */
    initializeDefaultModel(): Promise<RemoteResult<unknown>>;
  };
}

/** Mot pham vi config form cua kernel (settings ben vung). */
export interface ConfigScope<T> extends ObservableStore<{ status: string; value?: T; writable?: boolean }> {
  /** Ghi mot lo thao tac; tra true khi Host chap nhan. */
  mutate(ops: ReadonlyArray<{ op: string; path: readonly string[]; value: unknown }>): Promise<boolean>;
}

/** Bon namespace config form ma row nay dung. */
export interface ConfigForms {
  /** Trinh doc settings dung chung (loi doc dau tien, thu lai, mo ta field). */
  describe(): ObservableStore<{ error: string | null }> & { ensure(): Promise<void> };
  /** Pham vi settings theo namespace. */
  get(ns: string): ConfigScope<never>;
  /** Cong tac bo cong cu phat trien dung chung. */
  developerTools: { setEnabled(enabled: boolean): void | Promise<void> };
}

/** Ngung context goc phia client; chi khai nhung gi row nay that su dung. */
export interface ClientCtx {
  /** Dang ky hieu ung vong doi kem nhan chan doan. */
  effect(run: () => void | (() => void), label: string): void;
  /** Tiem them dich vu roi chay than callback voi pham vi da co du dich vu. */
  inject(names: readonly string[], run: (scope: ClientCtx) => void): void;
  /** Tra mot service tuy chon (row nay dung productAnalytics). */
  get(name: string): { track?(name: string, attributes: Record<string, unknown>): void } | undefined;
  /** Nghe mot su kien cua kernel; tra ham huy. */
  on(event: string, run: () => void): () => void;
  /** So slot; component luon la THAM SO THU HAI cua register. */
  slots: {
    /** Tiem vao mot slot. */
    inject(name: string, body: () => unknown): unknown;
    /** Dang ky mot nguoi ngoi. */
    register(spec: Record<string, unknown>, component: unknown): unknown;
  };
  /** Tu dien cua giao dien. */
  locale: {
    /** Dang ky mot namespace tu dien. */
    register(ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }): void;
    /** Khoa ham dich vao mot namespace. */
    bind(ns: string): Translator;
    /** Anh chup ngon ngu dang dung. */
    getSnapshot(): { active: string };
  };
  /** Cac namespace Remote ma Host phuc vu. */
  remote: RemoteApi;
  /** Giao dien: bang mau dang dung va su kien doi giao dien. */
  theme: {
    /** Anh chup giao dien hien tai. */
    getTheme(): ThemeSnapshot;
  };
  /** Cac form cau hinh cua kernel. */
  configForms: ConfigForms;
}

/** Mat plugin ma Loader nhan. */
export interface ClientPlugin {
  /** Ten package. */
  readonly name: string;
  /** Seam can co. */
  readonly inject: readonly string[];
  /** Than plugin. */
  readonly apply: (ctx: ClientCtx) => void;
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 4 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let accountInstalled = false;

/** Luoi trong: nho pham vi da cai xong, de mot lan goi lai voi DUNG pham vi cu cung bi chan (khong giu no song). */
const accountScopes = new WeakSet<object>();

/**
 * Dung mat plugin cua row ui-settings-account.
 * @param requireFn - ham nap module cua bang module trang (bundle tu require cac seed nen tang o tang factory).
 * @returns mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const runtime = loadRuntime(requireFn);
  const deps = runtime.deps;
  injectStyles();
  const accountAvatar = createAccountAvatar(deps);
  const { SignInDialog, AccountOnboarding } = createSignInComponents(deps);
  const { SignOutDialog, LogoutIcon } = createSignOutComponents(deps);
  const AccountNoticeCard = createAccountNoticeCard(deps);
  const AccountMenu = createAccountMenu(deps, { AccountNoticeCard, SignInDialog, SignOutDialog, LogoutIcon, AccountAvatar: accountAvatar });
  const AccountSection = createAccountSection(deps, accountAvatar, authorizeUrlWithTheme);
  const AccountQuotaNotice = createAccountQuotaNotice(deps);
  const { AccountPlatformHost } = createPlatformOverlay(deps);
  const { OnboardingSurface, OnboardingIllustration } = createOnboardingSurface(deps);
  const steps = createOnboardingSteps(deps, { OnboardingIllustration });
  const DesktopOnboarding = createDesktopOnboarding(deps, { OnboardingSurface, ...steps });
  const DesktopOnboardingEntry = createDesktopOnboardingEntry(deps, DesktopOnboarding, OnboardingSurface);

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Than plugin: tu dien, kho tai khoan, kho trang Platform va sau lan tiem slot cua ban goc (idempotent).
     * @param ctx - context goc phia client.
     * @returns khong.
     */
    apply(ctx: ClientCtx): void {
      const key: object = ctx;
      if (accountInstalled || accountScopes.has(key)) {
        console.warn("gbh-client-ui-settings-account: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi co da = true
        //   ⇒ lan cai thu hai thoat som ⇒ slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap undefined
        //   ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        accountScopes.add(key);
        accountInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-settings-account: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };

  /**
   * Than cua apply: dung kho tai khoan, kho trang Platform, bo dieu khien gioi thieu va sau lan tiem slot.
   * @param ctx - context goc phia client.
   * @returns khong.
   */
  function applyInner(ctx: ClientCtx): void {
    const desktop = DESKTOP_GLOBAL in globalThis;
    ctx.effect(() => ctx.locale.register(NS, { vi, en, zh }), EFFECT.dictionaries);
    const t = ctx.locale.bind(NS);
    const config = resolveContactConfig((globalThis as Record<string, unknown>)[CONTACT_CONFIG_GLOBAL] ?? {});
    let snapshot: AccountSnapshot = { view: undefined, details: undefined, avatar: undefined, failed: false, loginVisible: false, desktopOnboardingVisible: desktop };
    const browser = new BrowserLogin((url) => authorizeUrlWithTheme(url, ctx.theme.getTheme().active.colorScheme));
    ctx.effect(() => () => {
      browser.dispose();
    }, EFFECT.browserWindow);
    const listeners = new Set<() => void>();
    /**
     * Phat mot anh chup tai khoan moi cho moi nguoi nghe.
     * @param value - anh chup moi.
     */
    const publish = (value: AccountSnapshot): void => {
      snapshot = value;
      for (const listener of listeners) listener();
    };
    const avatar = new AccountAvatarLoader((value) => {
      publish({ ...snapshot, avatar: value });
    });
    ctx.effect(() => () => {
      avatar.dispose();
    }, EFFECT.avatar);
    /**
     * Danh tinh cho mot lan goi tai khoan, doc tai thoi diem goi de mang dung ngon ngu va mui gio dang hieu luc.
     * @returns metadata cua lan goi.
     */
    const client = (): ReturnType<typeof accountClientMetadata> => accountClientMetadata(ctx.locale.getSnapshot().active, CLIENT_VERSION);
    const notices = createBonusNoticeController({
      ackRetryDelayMs: config.bonusAckRetryDelayMs,
      ackRetryMaxDelayMs: config.bonusAckRetryMaxDelayMs,
      read: async () => {
        const result = await ctx.remote.account.getUnnotifiedBonuses(client());
        if (!result.ok) throw new Error("account bonus read failed");
        return result.value;
      },
      acknowledge: async (accountId, orderId) => {
        const result = await ctx.remote.account.ackBonusNotified(accountId, orderId, client());
        if (!result.ok) throw new Error("account bonus acknowledgement failed");
        return result.value;
      },
      publish: (notice) => {
        const { notice: _replaced, ...withoutNotice } = snapshot;
        publish(notice === null ? withoutNotice : { ...withoutNotice, notice });
      },
    });
    ctx.effect(() => () => {
      notices.end();
    }, EFFECT.bonusNotice);
    let revision = 0;
    let refreshing: Promise<void> | undefined;
    /** Doc lai ho so va so du cua tai khoan dang dang nhap. */
    const refresh = (): Promise<void> => {
      if (snapshot.view?.status !== "credential-stored") return Promise.resolve();
      if (refreshing !== undefined) return refreshing;
      const generation = revision;
      /**
       * Doc mot truong cua chi tiet tai khoan.
       * @param field - ten truong (profile hoac balance).
       * @param query - truy van Host.
       */
      const read = async (field: string, query: () => Promise<unknown>): Promise<void> => {
        let value: { status?: string } | undefined;
        try {
          value = (await query()) as { status?: string };
        } catch {
          value = { status: "failed" };
        }
        if (value?.status === "failed") console.error("[deepseek-account] account read failed", { field });
        if (generation === revision && value !== null) publish({ ...snapshot, details: { ...snapshot.details, [field]: value } as AccountSnapshot["details"] });
      };
      const request = Promise.all([
        read("profile", async () => {
          const result = await ctx.remote.account.getProfile(client());
          if (!result.ok) throw new Error("account profile failed");
          if (generation === revision && result.value?.status === "ready") avatar.setUrl(result.value.value.avatarUrl);
          return result.value;
        }),
        read("balance", async () => {
          const result = await ctx.remote.account.getBalance(client());
          if (!result.ok) throw new Error("account balance failed");
          return result.value;
        }),
      ]).then(() => undefined);
      refreshing = request;
      void request.finally(() => {
        if (refreshing === request) refreshing = undefined;
      });
      return request;
    };
    ctx.effect(() => () => {
      revision++;
    }, EFFECT.details);
    const stream = ctx.remote.$stream({
      name: "account",
      open: (signal) => ctx.remote.account.watch(signal),
      ended: () => new Error("account stream ended"),
    });
    let disposed = false;
    ctx.effect(() => () => {
      disposed = true;
      return stream.dispose();
    }, EFFECT.stateStream);
    void (async () => {
      for await (const frame of stream) {
        revision++;
        refreshing = undefined;
        avatar.reset();
        const initialize = frame.value.status === "credential-stored" && frame.value.attempt?.phase === "succeeded" && snapshot.view?.attempt?.phase !== "succeeded";
        const { notice, ...previous } = snapshot;
        publish({
          ...previous,
          view: frame.value,
          details: undefined,
          avatar: undefined,
          failed: false,
          ...(frame.value.status === "credential-stored" && notice ? { notice } : {}),
        });
        browser.update(frame.value);
        frame.accept();
        if (frame.value.status === "credential-stored") notices.begin();
        else notices.end();
        if (initialize) {
          void (async () => {
            try {
              if (!(await ctx.remote.session.initializeDefaultModel()).ok) console.error("[deepseek-account] default model initialization failed", { reason: "refused" });
            } catch {
              console.error("[deepseek-account] default model initialization failed", { reason: "disconnected" });
            }
          })();
        }
        void refresh();
      }
    })().catch(() => {
      if (!disposed) publish({ ...snapshot, failed: true });
    });
    const nativePlatform = (globalThis as Record<string, unknown>)[PLATFORM_GLOBAL] as PlatformBridge | undefined;
    const platformPages = createPlatformPages(runtime.store);
    ctx.effect(() => () => {
      platformPages.dispose();
    }, EFFECT.platformPage);
    /** Doc lai ca tai khoan lan thong bao thuong sau khi tro ve tu mot trang Platform. */
    const refreshAccount = async (): Promise<void> => {
      avatar.retry();
      await Promise.all([refresh(), notices.refresh()]);
    };
    /**
     * Mo mot trang Platform va doc lai sau khi nguoi dung tro ve tu trang nap tien.
     * @param reRead - lan doc sau khi tro ve cua rieng be mat do.
     * @returns ham mo trang ma be mat do tiem vao.
     */
    const platformPageOpener = (reRead: () => void | Promise<void>): ((page: string, onClose: (reason: string) => void) => () => void) => createPlatformPageOpener(platformPages, reRead);
    /** Nghiep vu tai khoan ma nam slot cua ban goc dung chung — nguyen van ten truong. */
    const operations: AccountOperations = {
      avatarFailed: (value) => {
        avatar.failed(value);
      },
      subscribeSessionExpired: (listener) => ctx.remote.$on(EVENT_SESSION_EXPIRED, listener),
      subscribeModelSignInRequired: (listener) => ctx.remote.$on(EVENT_MODEL_SIGN_IN_REQUIRED, listener),
      ...(nativePlatform === undefined ? {} : { openPlatformPage: platformPageOpener(refreshAccount) }),
      refreshAccount,
      contactUs(): void {
        const profile = snapshot.details?.profile;
        const context = {
          uid: profile?.status === "ready" ? profile.value.id : null,
          version: CLIENT_VERSION,
          width: window.screen.width,
          height: window.screen.height,
          pixelRatio: window.devicePixelRatio,
        };
        /**
         * Mo bang hoi voi thong tin thiet bi da doc.
         * @param deviceInfo - mo ta thiet bi.
         */
        const openForm = (deviceInfo: string): void => {
          window.open(contactUrl(config, { ...context, deviceInfo }), "_blank", "noopener,noreferrer");
        };
        const readDeviceInfo = (globalThis as { dshDesktop?: { deviceInfo?: () => Promise<string> } }).dshDesktop?.deviceInfo;
        if (readDeviceInfo === undefined) {
          openForm(navigator.userAgent);
          return;
        }
        void (async () => {
          let deviceInfo = "";
          try {
            deviceInfo = await readDeviceInfo();
          } catch {
            /* vo khong doc duoc thiet bi: van mo bang hoi voi mo ta rong */
          }
          openForm(deviceInfo);
        })();
      },
      showLogin(visible): void {
        publish({ ...snapshot, loginVisible: visible });
      },
      setOnboarding(active): void {
        publish({ ...snapshot, onboarding: active });
      },
      bonusNoticeShown(orderId): void {
        notices.shown(orderId);
      },
      bonusNoticeDismissed(orderId): void {
        notices.dismissed(orderId);
      },
      hooks: {
        account: {
          getSnapshot: () => snapshot,
          subscribe: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        },
        theme: {
          getSnapshot: () => ctx.theme.getTheme(),
          subscribe: (listener) => ctx.on(EVENT_THEME_CHANGE, listener),
        },
      },
      async start(): Promise<void> {
        publish({ ...snapshot, loginVisible: true, loginFailed: false });
        const transport = (globalThis as Record<string, unknown>)[TRANSPORT_GLOBAL] as { streamBaseUrl?: string } | undefined;
        /** Yeu cau Host bat dau dang nhap. */
        const request = async (): Promise<BrowserLoginView> => {
          const result = await ctx.remote.account.startSignIn(client(), desktop && transport?.streamBaseUrl !== undefined ? new URL(transport.streamBaseUrl).origin : window.location.origin, desktop ? "desktop" : "web");
          if (!result.ok) throw new Error("account start failed");
          return result.value;
        };
        try {
          if (desktop) await request();
          else await browser.start(request, () => snapshot.view);
        } catch (error) {
          publish({ ...snapshot, loginFailed: true });
          throw error;
        }
      },
      async cancel(id: string): Promise<void> {
        if (!(await ctx.remote.account.cancelSignIn(id)).ok) throw new Error("account cancel failed");
      },
      async hasRunningAccountTasks(): Promise<boolean | "unknown"> {
        const result = await ctx.remote.account.hasRunningAccountTasks();
        if (!result.ok) throw new Error("account task query failed");
        return result.value;
      },
      async signOut(): Promise<void> {
        const result = await ctx.remote.account.signOut(client());
        if (result.ok) return;
        throw result.error;
      },
    };
    if (desktop) {
      const controller = new DesktopOnboardingController(
        ctx.configForms.get(DESKTOP_ONBOARDING_NAMESPACE),
        ctx.configForms.get("ui-chat"),
        (enabled) => ctx.configForms.developerTools.setEnabled(enabled),
        operations.hooks.account,
        readOnboardingApiKeyPresence,
        ctx.configForms.describe(),
        runtime.store,
      );
      ctx.effect(() => () => {
        controller.dispose();
      }, EFFECT.desktopOnboarding);
      ctx.effect(() => {
        /** Bao cho bo dieu khien rang credential vua doi. */
        const refreshCredentials = (): void => {
          controller.invalidateCredentials();
        };
        const disposers = [
          ctx.remote.$on(EVENT_CREDENTIAL_REFERENCE_UPDATED, refreshCredentials),
          ctx.remote.$on(EVENT_LLM_ADAPTERS_UPDATED, refreshCredentials),
          ctx.configForms.describe().subscribe(refreshCredentials),
        ];
        return () => {
          for (const dispose of disposers) dispose();
        };
      }, EFFECT.credentialReadiness);
      // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do
      //   (da tra gia: truu tuong hoa ten slot lam co bao THIEU ca loat slot).
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: ONBOARDING_OCCUPANT_ID,
            locale: NS,
            inject: () => ({
              hooks: { account: operations.hooks.account, onboarding: controller.state },
              /**
               * Bao lop phu shell co dang chiem man hinh khong.
               * @param visible - co hay khong.
               */
              setVisible: (visible: boolean) => {
                if (snapshot.desktopOnboardingVisible !== visible) publish({ ...snapshot, desktopOnboardingVisible: visible });
              },
              ...(nativePlatform === undefined ? {} : { openPlatformPage: platformPageOpener(refresh) }),
              /**
               * Ghi mot phan tien do gioi thieu.
               * @param change - cac truong doi.
               * @returns Host co nhan khong.
               */
              update: (change: Record<string, unknown>) => controller.update(change),
              /**
               * Ket thuc phan gioi thieu.
               * @param reason - ly do ket thuc.
               * @returns co ghi duoc khong.
               */
              complete: (reason: string) => controller.complete(reason),
              /**
               * Thu lai lan ghi that bai.
               * @returns co thanh cong khong.
               */
              retry: () => controller.retry(),
              /**
               * Do luong mot su kien cua phan gioi thieu.
               * @param name - ten su kien.
               * @param attributes - thuoc tinh kem theo.
               */
              track: (name: string, attributes: Record<string, unknown>) => ctx.get("productAnalytics")?.track?.(name, attributes),
            }),
          },
          DesktopOnboardingEntry,
        ),
      );
    }
    ctx.slots.inject("settings.models.sign-in", () =>
      ctx.slots.register(
        { name: "settings.models.sign-in", locale: NS, inject: () => operations },
        AccountOnboarding,
      ),
    );
    ctx.slots.inject("shell.quota-notice", () =>
      ctx.slots.register(
        {
          name: "shell.quota-notice",
          locale: NS,
          /**
           * Chi nhan thong bao het han muc cua tai khoan.
           * @param owner - chu thong bao do khung gui xuong.
           * @returns chu thong bao khi dung ma ACCOUNT_QUOTA, nguoc lai null.
           */
          select: (owner: { code?: string }) => (owner.code === "ACCOUNT_QUOTA" ? owner : null),
          inject: () => ({
            hooks: { account: operations.hooks.account, platformPage: platformPages },
            ...(nativePlatform === undefined ? {} : { openPlatformPage: platformPageOpener(refreshAccount) }),
          }),
        },
        AccountQuotaNotice,
      ),
    );
    if (nativePlatform !== undefined) {
      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: PLATFORM_PAGE_OCCUPANT_ID,
            locale: NS,
            inject: () => ({ platform: nativePlatform, hooks: { page: platformPages }, closePage: platformPages.close }),
          },
          AccountPlatformHost,
        ),
      );
    }
    ctx.slots.inject("settings.launcher", () =>
      ctx.slots.register({ name: "settings.launcher", locale: NS, inject: () => operations }, AccountMenu),
    );
    ctx.slots.inject("settings.section", () => {
      let unregister: (() => void) | undefined;
      // ⚠️ Muc tai khoan chi duoc dang ky khi da dang nhap: go ra khi chua dang nhap, dung nhu ban goc.
      const update = (): void => {
        if (snapshot.view?.status === "credential-stored") {
          unregister ??= ctx.slots.register(
            {
              name: "settings.section",
              id: ACCOUNT_SECTION_ID,
              order: ACCOUNT_SECTION_ORDER,
              label: () => t("nav"),
              locale: NS,
              inject: () => operations,
            },
            AccountSection,
          ) as () => void;
        } else {
          unregister?.();
          unregister = undefined;
        }
      };
      listeners.add(update);
      update();
      return () => {
        listeners.delete(update);
        unregister?.();
      };
    });
  }
}

/** Xuat lai cho test: kieu thong bao het han muc va kieu yeu cau trang Platform. */
export type { MatchedQuotaNotice, PlatformPageClaim };
