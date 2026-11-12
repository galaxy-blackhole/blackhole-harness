/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt plugin của row ui-settings-models: từ điển, kho trang thái, mục Models và hai bước onboarding
 */

import { injectStyles } from "./css.ts";
import { DeepSeekOnboardingDialog } from "./deepseek-onboarding-dialog.ts";
import { EFFECTS, INJECT, NS, PACKAGE_NAME, SECTION_ID, SECTION_ORDER, SLOT_SETTINGS_ONBOARDING, SLOT_SETTINGS_SECTION, WELCOME_NOTICE_ID, WELCOME_NOTICE_ORDER, DEEPSEEK_ONBOARDING_ID, DEEPSEEK_ONBOARDING_ORDER } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { ModelsSection } from "./models-section.ts";
import { createModelsOperations } from "./operations.ts";
import { WELCOME_NOTICE_SETTINGS_NAMESPACE } from "./onboarding-copy.ts";
import { isDesktopShell, ONBOARDING_CONFIG_GLOBAL, resolveOnboardingConfig } from "./onboarding-config.ts";
import { createSettingsSchemaOperations } from "./schema-operations.ts";
import { ModelsSettingsStore } from "./store.ts";
import { WelcomeNotice } from "./welcome-notice.ts";
import { WelcomeNoticeStore } from "./welcome-store.ts";
import { vi } from "./locales-vi.ts";

/** Hàm require do bảng module của loader cấp cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** Hàm dịch của một namespace từ điển. */
export type Translator = (key: string, params?: Record<string, unknown>) => string;

/** Bề mặt context gốc phía client; chỉ khai những gì row này thật sự dùng. */
export interface ClientCtx {
  /** Đăng ký hiệu ứng vòng đời kèm nhãn chẩn đoán. */
  effect(run: () => void, label: string): void;
  /** Tra một service tuỳ chọn (row này dùng productAnalytics). */
  get(name: string): { track?(name: string, attributes: Record<string, unknown>): void } | undefined;
  /** Nghe một sự kiện của kernel (row này dùng connection/reset); trả hàm huỷ. */
  on(event: string, run: () => void): () => void;
  /** Từ điển của giao diện. */
  locale: {
    /** Đăng ký một namespace từ điển. */
    register(ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }): void;
    /** Khoá hàm dịch vào một namespace. */
    bind(ns: string): Translator;
  };
  /** Sổ slot; component luôn là THAM SỐ THỨ HAI của register. */
  slots: {
    /** Tiêm vào một slot (chờ slot có mặt trên sổ). */
    inject(name: string, body: () => unknown): unknown;
    /** Đăng ký một người ngồi. */
    register(spec: Record<string, unknown>, component: unknown): unknown;
  };
  /** Các namespace Remote mà nửa host của row api-remotes phục vụ. */
  remote: {
    /** Nghe một sự kiện đẩy từ Host; trả hàm huỷ. */
    $on(event: string, run: () => void): () => void;
    /** Namespace credentials. */
    credentials: { set(ref: string, value: string): Promise<unknown>; unset(ref: string): Promise<unknown> };
    /** Namespace llm. */
    llm: { listProviders(): Promise<unknown>; listConfigurableProviders(): Promise<unknown>; discoverModels(ns: string, request: unknown): Promise<unknown> };
    /** Namespace settings. */
    settings: { read(ns: string): Promise<unknown>; mutate(ns: string, ops: unknown, expectedRevision: unknown): Promise<unknown> };
  };
  /** Các form cấu hình của kernel. */
  configForms: {
    /** Ảnh chụp mô tả các field cấu hình đã đăng ký. */
    describe(): unknown;
    /** Lấy phạm vi cấu hình theo namespace settings. */
    get(ns: string): unknown;
  };
  /** Service schema của settings (rehydrate/validate/đường dẫn). */
  settingsSchema: unknown;
}

/** Mặt plugin mà Loader nhận. */
export interface ClientPlugin {
  /** Tên package. */
  readonly name: string;
  /** Seam cần có. */
  readonly inject: readonly string[];
  /** Thân plugin. */
  readonly apply: (ctx: ClientCtx) => void;
}

// ⚠️ CỔNG CHỐNG CÀI HAI LẦN — PHẠM VI MODULE, đặt TRƯỚC JSDoc của hàm (xem mục 4 của recipe).
// KHÔNG khoá theo ctx: ca thật là HAI ENTRY ⇒ HAI ctx (loader.create mỗi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MỚI) nên cổng khoá-theo-ctx KHÔNG BAO GIỜ kích hoạt ⇒ apply chạy hai lần ⇒ slot trùng ⇒ app trắng.
let uiSettingsModelsInstalled = false;

/** Lưới trong: nhớ phạm vi đã cài xong, để một lần gọi lại với ĐÚNG phạm vi cũ cũng bị chặn (không giữ nó sống). */
const seenScopes = new WeakSet<object>();

/**
 * Nạp lại ảnh chụp của trang Models, nhưng CHỈ khi trang đã từng được mở.
 * @param controller - kho của trang.
 * @returns không.
 */
export function refreshIfLoaded(controller: InstanceType<typeof ModelsSettingsStore>): void {
  if (controller.store.getSnapshot().status === "idle") return;
  controller.load();
}

/**
 * Dựng mặt plugin của row ui-settings-models.
 * @param requireFn - hàm nạp module của bảng module trang (bundle tự require các seed nền tảng ở tầng factory).
 * @returns mặt plugin mà Loader gọi apply trên đó.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  void requireFn;
  injectStyles();
  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Thân plugin: từ điển, kho trang thái, mục Models và hai bước onboarding (idempotent).
     * @param ctx - context gốc phía client.
     * @returns không.
     */
    apply(ctx: ClientCtx): void {
      const key: object = ctx;
      if (uiSettingsModelsInstalled || seenScopes.has(key)) {
        console.warn("gbh-client-ui-settings-models: bundle đã được cài, bỏ qua lần thứ hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ CỜ CHỈ BẬT SAU KHI applyInner CHẠY XONG. Bật sớm ⇒ nếu đăng ký ném giữa đường thì cờ đã true
        //   ⇒ lần cài thứ hai thoát sớm ⇒ slot KHÔNG BAO GIỜ được đăng ký lại ⇒ renderer gặp undefined
        //   ⇒ React #130 (ca thật: ui-settings-general, 18/10/2026).
        seenScopes.add(key);
        uiSettingsModelsInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-settings-models: apply ném lỗi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };
}

/**
 * Thân của apply: đăng ký từ điển, mục Models trong slot settings.section, hai bước trong settings.onboarding,
 * và nối kho trang thái với các lần đẩy bất biến của Host.
 * @param ctx - context gốc phía client.
 * @returns không.
 */
function applyInner(ctx: ClientCtx): void {
  const payload = (globalThis as Record<string, unknown>)[ONBOARDING_CONFIG_GLOBAL];
  const credentialOnboarding = resolveOnboardingConfig(payload).credentialOnboarding && !isDesktopShell();
  ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECTS.dictionaries);
  const schema = createSettingsSchemaOperations(ctx.settingsSchema);
  const operations = createModelsOperations(ctx);
  const controller = new ModelsSettingsStore(ctx, schema, ctx.configForms.describe());
  const t = ctx.locale.bind(NS);
  /**
   * Nghiệp vụ tiêm cho mục Models.
   * @returns kho, hook ảnh chụp, lệnh Host, schema và hàm dịch.
   */
  const injected = (): Record<string, unknown> => ({ controller, hooks: { snapshot: controller.store }, operations, schema, t });
  /**
   * Nghiệp vụ tiêm cho bước DeepSeek chính thức (kèm cờ tự động và kênh đo lường).
   * @returns như injected, thêm cờ tự động và hàm track.
   */
  const deepSeekOnboardingInjected = (): Record<string, unknown> => ({
    automatic: credentialOnboarding,
    track: (name: string, attributes: Record<string, unknown>) => ctx.get("productAnalytics")?.track?.(name, attributes),
    controller,
    hooks: { models: controller.store },
    operations,
    schema,
    t,
  });
  const welcomeController = new WelcomeNoticeStore(ctx.configForms.get(WELCOME_NOTICE_SETTINGS_NAMESPACE));
  /**
   * Nghiệp vụ tiêm cho thông báo chào mừng.
   * @returns kho thông báo, hook và hàm dịch.
   */
  const welcomeInjected = (): Record<string, unknown> => ({ controller: welcomeController, hooks: { welcome: welcomeController.store }, t });
  ctx.effect(() => {
    /** Làm mới trang Models sau một lần đẩy bất biến. */
    const refreshModels = (): void => {
      refreshIfLoaded(controller);
    };
    const disposers = [
      ctx.remote.$on("settings/document-updated", () => {
        refreshModels();
      }),
      ctx.remote.$on("credentials/record-updated", refreshModels),
      ctx.remote.$on("credentials/reference-updated", refreshModels),
      ctx.remote.$on("llm/adapters-updated", refreshModels),
      // "connection/reset" là sự kiện của KERNEL (ctx.on), không phải của namespace remote.
      ctx.on("connection/reset", refreshModels),
    ];
    return () => {
      welcomeController.dispose();
      for (const dispose of disposers) dispose();
    };
  }, EFFECTS.invalidations);
  // ⚠️ TÊN SLOT PHẢI LÀ LITERAL trong register({ name: "..." }): check:rows chỉ nhận dạng được khuôn đó
  //   (đã trả giá: trừu tượng hoá tên slot làm cổng báo THIẾU cả loạt slot).
  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: SECTION_ID,
        order: SECTION_ORDER,
        label: () => t("nav"),
        inject: injected,
        children: {
          "settings.models.provider-card": { kind: "keyed", scope: "root" },
          "settings.models.footer": { kind: "list", scope: "root" },
        },
      },
      ModelsSection,
    ),
  );
  if (!isDesktopShell()) {
    ctx.slots.inject("settings.onboarding", () =>
      ctx.slots.register({ name: "settings.onboarding", id: WELCOME_NOTICE_ID, order: WELCOME_NOTICE_ORDER, inject: welcomeInjected }, WelcomeNotice),
    );
  }
  ctx.slots.inject("settings.onboarding", () =>
    ctx.slots.register(
      {
        name: "settings.onboarding",
        id: DEEPSEEK_ONBOARDING_ID,
        children: { "settings.models.sign-in": { kind: "single", scope: "root" } },
        order: DEEPSEEK_ONBOARDING_ORDER,
        inject: deepSeekOnboardingInjected,
      },
      DeepSeekOnboardingDialog,
    ),
  );
}
