/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua client cua row ui-permission: hang mac dinh trong Settings + chip quyen tren composer + popup /permission
 */

import { makeCatalogDirectory, type CatalogDirectory, type PermissionCatalog, type SnapshotStore } from "./catalog.ts";
import {
  AUTO_REVIEW_PRESET,
  COMMAND_DISMISS_ID,
  COMMAND_NAME,
  EFFECT,
  FULL_ACCESS_PRESET,
  NS_ACCESS,
  NS_SETTINGS,
  PACKAGE_NAME,
  PERMISSION_SETTINGS_NS,
  ROW_OCCUPANT_ID,
  ROW_ORDER,
  STYLE_TAGS,
} from "./ids.ts";
import { accessEn, accessZh, en, zh, type PermissionAccessKey } from "./locales.ts";
import { makePermissionGlyphs, type JsxFn, type PermissionIconSet } from "./presentation.ts";
import { makePermissionRow, type ReactModule, type RowPrimitives } from "./permission-row.ts";
import { makePermissionSelect, type SelectPrimitives } from "./permission-select.ts";
import { makeSettingsController, type SettingsDescribeFace } from "./settings-store.ts";
import { viAccess, vi } from "./locales-vi.ts";

declare const __GBH_PERMISSION_ROW_CSS__: string;
declare const __GBH_PERMISSION_SELECT_CSS__: string;

/**
 * Cong chan cai HAI LAN cho row hai id module — BOOLEAN O PHAM VI MODULE, khong phai trong ham.
 * Vi sao khong khoa theo ctx: ca THAT la HAI ENTRY => HAI FIBER => HAI CTX khac nhau (do bang
 * loader.create + parent.extend({fiber})), nen mot cong khoa theo identity cua ctx se KHONG BAO GIO
 * kich hoat; do la ca da tra gia voi shortcuts (doi sang boolean thi loi "has been registered" bien mat).
 * Gia phai tra: boolean dinh giua cac ca test CUNG file => moi ca phai nap bundle TUOI (xem tests).
 */
let installed = false;

/** Luoi trong: ghi nho ctx da cai, de mot lan goi lai voi ctx cu cung bi chan. */
const permissionContexts = new WeakSet<object>();

/** Ham require do bang module cap cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** Runtime JSX day du do bang module cap (react/jsx-runtime). */
interface JsxRuntimeModule {
  /** Dung mot element. */
  jsx: JsxFn;
  /** Dung element nhieu con dang mang. */
  jsxs: JsxFn;
  /** Node Fragment. */
  Fragment: unknown;
}

/** Bam ui-primitives ma row nay require (chi khai phan dung). */
interface PrimitivesModule extends RowPrimitives, SelectPrimitives, PermissionIconSet {}

/** Bam @galaxy-blackhole/gbh-client-store ma row nay require. */
interface StoreModule {
  /** Tao mot store quan sat duoc. */
  createSnapshotStore<T>(initial: T): SnapshotStore<T>;
}

/** Mot phien dang mo o phia client (chi khai phan row nay dung). */
interface SessionBinding {
  /** Phien that, co ham chay lenh. */
  session?: {
    /** Chay mot dong lenh nguoi dung; tra ket qua co ok/error. */
    command(line: string): Promise<{
      ok: boolean;
      error?: { code?: string; message?: string };
      value?: { matched?: boolean };
    }>;
  };
}

/** Phien ma lenh /permission nhan. */
interface CommandSession {
  /** Id phien. */
  sessionId: string;
}

/** Phien co projection quyen. */
interface ProjectionSession {
  /** Cac projection cua phien. */
  projections: {
    /** Lay mat doc cua mot projection theo ten. */
    faceOf(name: string): { getSnapshot(): { currentValue?: string } | undefined };
  };
}

/** Context phia browser (chi khai phan row nay dung). */
interface ClientContext {
  /** Lay mot service theo ten (ban goc dung cho "commandUi"). */
  get(name: string): unknown;
  /** Dang ky mot hieu ung vong doi; ham don dep chay khi fiber tat. */
  effect(callback: () => void | (() => void), label?: string): void;
  /** Seam tu dien. */
  locale: {
    /** Buoc khoa doc vao mot namespace. */
    bind(namespace: string): (key: PermissionAccessKey, params?: Record<string, unknown>) => string;
    /** Dang ky ban dich cho namespace; tra ham go. */
    register(namespace: string, copy: Record<string, Record<string, string>>): () => void;
  };
  /** Seam slot. */
  slots: {
    /** Dang ky mot nguoi ngoi vao slot; tra ham go. */
    register(definition: Record<string, unknown>, component: unknown): () => void;
    /** Chi dang ky khi slot da co nguoi phuc vu. */
    inject(slot: string, register: () => unknown): void;
  };
  /** Seam phien. */
  sessions: {
    /** Bind theo id phien; tra undefined khi phien chua vat chat hoa. */
    binding(sessionId: string): SessionBinding | undefined;
  };
  /** Seam form cai dat. */
  configForms: {
    /** Mat describe cua guong cau hinh dung chung. */
    describe(): SettingsDescribeFace;
  };
  /** Seam Remote. */
  remote: {
    /** Theo doi event cua Host; tra ham go. */
    $on(event: string, listener: () => void): () => void;
    /** Namespace catalog quyen. */
    permissionPresets: {
      /** Doc catalog quyen day du cua the he hien tai. */
      catalog(): Promise<{ ok: boolean; value?: PermissionCatalog; error?: { code?: string; message?: string } }>;
    };
    /** Namespace cai dat. */
    settings: {
      /** Ghi mot loat thao tac len namespace, kem revision. */
      mutate(
        namespace: string,
        operations: readonly unknown[],
        revision: number,
      ): Promise<{ ok: boolean; value?: unknown; error?: { code?: string; message?: string } }>;
    };
  };
}

/** Seam commandUi ma row nay dung (popupSelect decoration). */
interface CommandUiService {
  /** Trang tri mot lenh co san bang popup chon. */
  decorate(definition: Record<string, unknown>): () => void;
  /** Tat popup dang mo cua mot lenh. */
  dismiss(id: string): void;
}

/** Mot lua chon trong popup /permission (dang option cua popupSelect). */
interface CommandOption {
  /** Id lua chon (gia tri preset). */
  id: string;
  /** Nhan hien thi. */
  label: unknown;
  /** Badge nho (chi "auto" co). */
  badge?: string;
  /** Mo ta day du. */
  detail?: string;
  /** Danh dau lua chon dang dung. */
  active?: boolean;
  /** Hop xac nhan rui ro (chi "toan quyen" va "auto" co). */
  confirmation?: {
    /** Tieu de hop. */
    title: string;
    /** Mo ta hop. */
    description: string;
    /** Nhan o tich xac nhan. */
    acknowledgeLabel: string;
    /** Nhan nut huy. */
    cancelLabel: string;
    /** Nhan nut dong y. */
    confirmLabel: string;
  };
}

/** Be mat plugin ma Loader nhan tu bundle. */
export interface ClientPlugin {
  /** Seam ma fiber cua row can truoc khi apply chay. */
  inject: string[];
  /** Than plugin. */
  apply(ctx: ClientContext): void;
}

/**
 * Chen mot the style neu chua co (ban goc lam y nguyen, ke ca thuoc tinh data-plugin-css).
 * Nhan: id gan vao data-plugin-css va van ban CSS.
 * Tra: khong.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Doi chieu lua chon thanh option cua popupSelect (ban goc: optionsOf).
 * Nhan: catalog quyen, gia tri hien hanh cua phien va ham dich.
 * Tra: danh sach option — "auto" mang badge/detail rieng, hai preset rui ro mang hop xac nhan.
 */
function optionsOf(
  catalog: PermissionCatalog,
  currentValue: string,
  t: (key: PermissionAccessKey, params?: Record<string, unknown>) => string,
): CommandOption[] {
  return catalog.options.map((option) => {
    const isAuto = option.value === AUTO_REVIEW_PRESET;
    const risky = option.value === FULL_ACCESS_PRESET || isAuto;
    const detail = option.description;
    return {
      id: option.value,
      label: isAuto ? t("auto.label") : option.name,
      ...(isAuto ? { badge: t("auto.badge") } : {}),
      ...(isAuto ? { detail: t("auto.description") } : detail === undefined ? {} : { detail }),
      ...(option.value === currentValue ? { active: true } : {}),
      ...(risky
        ? {
            confirmation: {
              title: t(isAuto ? "auto.confirm.title" : "confirm.title"),
              description: t(isAuto ? "auto.confirm.description" : "confirm.description"),
              acknowledgeLabel: t(isAuto ? "auto.confirm.acknowledge" : "confirm.acknowledge"),
              cancelLabel: t("confirm.cancel"),
              confirmLabel: t(isAuto ? "auto.confirm.enable" : "confirm.enable"),
            },
          }
        : {}),
    };
  });
}

/**
 * Dung mat plugin cua nua browser.
 *
 * Bon specifier duoc require LUC VAT CHAT HOA factory (khong phai luc nap script), dung nhu ban goc:
 * react, react/jsx-runtime, @galaxy-blackhole/gbh-client-ui-primitives, @galaxy-blackhole/gbh-client-store.
 * Nhan: ham require cua bang module.
 * Tra: plugin { inject, apply } — hinh dang ma Loader cua vo nhan.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntimeModule;
  const react = requireFn("react") as ReactModule;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule;
  const createSnapshotStore = (requireFn("@galaxy-blackhole/gbh-client-store") as StoreModule).createSnapshotStore;
  const glyphs = makePermissionGlyphs(jsxRuntime.jsx, primitives);
  const PermissionRow = makePermissionRow(jsxRuntime, react, primitives);
  const PermissionSelect = makePermissionSelect(jsxRuntime, react, primitives, glyphs);

  /** Seam phia browser ma row nay can — giu nguyen danh sach cua ban goc. */
  const inject = [
    "commandUi",
    "connection",
    "sessions",
    "slots",
    "locale",
    "remote",
    "remote.permissionPresets",
    "remote.settings",
    "configForms",
    "settingsSchema",
  ];

  /** Doc gia tri quyen hien hanh cua mot phien (undefined = Host khong co nang luc nay). */
  function selectionOf(session: ProjectionSession | undefined): { currentValue?: string } | undefined {
    return session?.projections.faceOf("permissions").getSnapshot();
  }

  /**
   * Than that cua apply: dang ky hai be mat va trang tri lenh /permission.
   * Nhan: context phia browser.
   * Tra: khong; de lai cac hieu ung vong doi (tu dien, thu muc catalog, hang cai dat, trang tri lenh).
   */
  function applyInner(ctx: ClientContext): void {
    const command = ctx.get("commandUi") as CommandUiService;
    const sessions = ctx.sessions;

    injectStyle(STYLE_TAGS.select, typeof __GBH_PERMISSION_SELECT_CSS__ === "string" ? __GBH_PERMISSION_SELECT_CSS__ : "");
    injectStyle(STYLE_TAGS.row, typeof __GBH_PERMISSION_ROW_CSS__ === "string" ? __GBH_PERMISSION_ROW_CSS__ : "");

    ctx.effect(() => ctx.locale.register(NS_ACCESS, { vi: viAccess, zh: accessZh, en: accessEn }), EFFECT.accessDictionaries);
    const t = ctx.locale.bind(NS_ACCESS);

    /** Phien co projection quyen (dung cho ca available lan options). */
    const sessionFor = (session: CommandSession): ProjectionSession | undefined =>
      sessions.binding(session.sessionId)?.session as ProjectionSession | undefined;

    /**
     * Gui mot preset qua duong lenh cua phien hien tai — MOT duong ghi cho ca hai be mat.
     * Nhan: id phien va gia tri preset.
     * Tra: true khi lenh khop; nem loi khi phien chua vat chat hoa hoac lenh that bai.
     */
    const submit = async (sessionId: string, preset: string): Promise<boolean> => {
      const live = sessions.binding(sessionId)?.session;
      if (live === undefined) throw new Error("this session is not materialized yet");
      const result = await live.command("/permission " + preset);
      if (!result.ok) {
        throw new Error(
          "permission switch failed: " + (result.error?.code ?? "error") + ": " + (result.error?.message ?? ""),
        );
      }
      if (result.value?.matched !== true) throw new Error("the host offers no /permission command");
      return true;
    };

    const catalog: CatalogDirectory = makeCatalogDirectory(ctx, createSnapshotStore);
    ctx.effect(() => () => catalog.dispose(), EFFECT.catalog);
    ctx.effect(
      () =>
        catalog.invalidations.subscribe(() => {
          command.dismiss(COMMAND_DISMISS_ID);
        }),
      EFFECT.dismiss,
    );

    ctx.effect(() => ctx.locale.register(NS_SETTINGS, { vi, zh, en }), EFFECT.settingsDictionaries);
    const controller = makeSettingsController(ctx.configForms.describe(), ctx, catalog, createSnapshotStore);
    const injected = (): Record<string, unknown> => ({
      hooks: { permission: controller.store },
      load: () => controller.load(),
      select: (preset: string) => controller.select(preset),
    });
    ctx.effect(() => () => controller.dispose(), EFFECT.settingsController);

    // Ten slot ghi thang bang CHUOI o ca hai cho (khong qua hang so) de doi chieu duoc voi ban goc
    // bang mat, bang grep, va bang cong cu check:rows — cong cu do so ten slot theo van ban.
    ctx.slots.inject("settings.general.item", () =>
      ctx.slots.register(
        {
          name: "settings.general.item",
          id: ROW_OCCUPANT_ID,
          order: ROW_ORDER,
          locale: NS_SETTINGS,
          inject: injected,
        },
        PermissionRow,
      ),
    );
    ctx.slots.inject("conversation.input.permission", () =>
      ctx.slots.register(
        {
          name: "conversation.input.permission",
          locale: NS_ACCESS,
          inject: (sessionId: string) => ({
            hooks: { permissionCatalog: catalog.store },
            select: (preset: string) => submit(sessionId, preset),
          }),
        },
        PermissionSelect,
      ),
    );
    ctx.effect(
      () =>
        command.decorate({
          name: COMMAND_NAME,
          available: (session: CommandSession) => selectionOf(sessionFor(session)) !== undefined,
          ui: {
            kind: "popupSelect",
            options: async (session: CommandSession) => {
              const selection = selectionOf(sessionFor(session));
              if (selection === undefined) throw new Error("permission presets are not available on this host");
              return optionsOf(await catalog.load(), selection.currentValue ?? "", t);
            },
            onSelect: (option: CommandOption, session: CommandSession) =>
              submit(session.sessionId, option.id).then(() => undefined),
          },
        }),
      EFFECT.decoration,
    );
  }

  /**
   * Vo bao ve: lan cai thu hai — voi BAT KY ctx nao — la NO-OP (xem chu thich o installed dau file).
   * Loi duoc IN RA roi nem tiep — cordis nuot loi, nen khong co dong log nay thi khong ai biet vi sao row ket.
   * Nhan: context phia browser (goi lan hai du ctx moi hay cu deu bi chan).
   * Tra: khong.
   */
  function apply(ctx: ClientContext): void {
    const key: object = ctx;
    if (installed || permissionContexts.has(key)) return;
    try {
      applyInner(ctx);
    } catch (error: unknown) {
      console.error("gbh-client-ui-permission-presets: apply nem loi", error);
      throw error;
    }
    // BAT CO CHI SAU KHI applyInner CHAY XONG (luat 18/10/2026): bat som ma applyInner nem giua duong thi
    // lan cai thu hai thoat som => slot khong bao gio duoc dang ky lai => renderer nhan undefined => React #130.
    installed = true;
    permissionContexts.add(key);
  }

  return { inject, apply };
}

/** Ten namespace cai dat cua Host (xuat lai cho test doi chieu hang cai dat). */
export const SETTINGS_NAMESPACE = PERMISSION_SETTINGS_NS;
