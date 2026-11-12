/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat plugin cua trang Subagent: hai form staged, bon hieu ung vo hieu hoa, va o plugins.item
 */
import type { CardPrimitives, CardReact } from "./card-types.ts";
import { EFFECT, INJECT, MODEL_CATALOG_EVENTS, NS, PACKAGE_NAME, RESET_EVENT, SLOT, STYLE_TAGS, SUBAGENT_MODEL_SELECTION_NS, SUBAGENT_NS } from "./ids.ts";
import { createLimitsFields } from "./limits-fields.ts";
import { en, zh } from "./locales.ts";
import { createModelSelectionFields } from "./model-selection-fields.ts";
import { createSubagentCard } from "./subagent-card.ts";
import { subagentCardFace } from "./subagent-card-controller.ts";
import { SubagentLimitsCardController } from "./subagent-limits-card-controller.ts";
import { SubagentModelSelectionCardController } from "./subagent-model-selection-card-controller.ts";
import type { ModelCatalogContext, SubagentModelSelectionSettings } from "./subagent-model-selection-card-controller.ts";
import type { SubagentLimitsSettings } from "./subagent-limits-card-controller.ts";
import type { SettingsSection, SubagentPrimitives } from "./types.ts";
import { vi } from "./locales-vi.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/**
 * Cổng NGOÀI (phạm vi MODULE): ctx của lần cài trước. Bundle HAI id ⇒ factory gọi hai lần trên CÙNG
 * một ctx ⇒ so identity là đủ chặn chắc; ctx mới (ca test khác) vẫn được cài bình thường.
 */
let installed = false;

/** Cổng TRONG: tập ctx đã cài — chặn lần hai trên CÙNG ctx mà không dính giữa các ca test. */
const subagentContexts = new WeakSet<object>();

/** CSS của ba module, do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_SUBAGENT_LIMITS_CSS__: string;
declare const __GBH_SUBAGENT_MODELS_CSS__: string;
declare const __GBH_SUBAGENT_CARD_CSS__: string;

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng element một con. */
  jsx: CardReact["jsx"];
  /** Dựng element nhiều con. */
  jsxs: CardReact["jsxs"];
  /** Bao nhiều con không cần node bọc. */
  Fragment: unknown;
}

/** Module `react` — chỉ lấy `useId` (không có jsx/jsxs). */
interface ReactModule {
  /** Id ổn định cho một lượt render. */
  useId: () => string;
}

/** Bề mặt bộ nguyên thuỷ đọc từ bảng module. */
interface PrimitivesModule extends CardPrimitives {
  /** Dựng một trường số. */
  settingsNumberField: SubagentPrimitives["settingsNumberField"];
  /** Dựng mô hình form cài đặt. */
  SettingsFormModel: SubagentPrimitives["SettingsFormModel"];
}

/** Ngữ cảnh gốc phía client; chỉ khai những gì trang này dùng. */
interface SubagentCtx extends ModelCatalogContext {
  /** Đăng ký hiệu ứng vòng đời. */
  effect: (callback: () => void | (() => void), label: string) => void;
  /** Nghe sự kiện của ctx. */
  on: (event: string, listener: () => void) => () => void;
  /** Từ điển giao diện. */
  locale: {
    /** Đăng ký một namespace. */
    register: (ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }) => () => void;
    /** Ràng buộc một namespace thành hàm đọc. */
    bind: (ns: string) => (key: string) => string;
  };
  /** Kênh Remote (thêm phần `$on`). */
  remote: ModelCatalogContext["remote"] & {
    /** Nghe một sự kiện Remote; trả hàm gỡ. */
    $on: (event: string, listener: () => void) => () => void;
  };
  /** Sổ form cài đặt do Host phục vụ. */
  configForms: {
    /** Lấy mục cài đặt theo namespace. */
    get: (ns: string) => unknown;
    /** Chạy callback khi MỘT trong các namespace đang được phục vụ; trả hàm gỡ. */
    whileServed: (namespaces: readonly string[], run: () => void) => () => void;
  };
  /** Sổ slot. */
  slots: {
    /** Đăng ký vào một ô khi nó mở. */
    inject: (name: string, register: () => void) => void;
    /** Đăng ký người chiếm một ô. */
    register: (options: { name: string } & Record<string, unknown>, component: unknown) => void;
  };
}

/** Mặt plugin mà Loader nhận. */
export interface ClientPlugin {
  /** Tên package. */
  readonly name: string;
  /** Seam cần có. */
  readonly inject: readonly string[];
  /** Thân plugin. */
  apply: (ctx: SubagentCtx) => void;
}

/**
 * Chèn một thẻ style nếu chưa có.
 * Nhận: id gắn vào `data-plugin-css` và văn bản CSS.
 * Trả: không có.
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

/** Chèn CSS của cả ba module, đúng thứ tự như bản gốc. */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.limits, typeof __GBH_SUBAGENT_LIMITS_CSS__ === "string" ? __GBH_SUBAGENT_LIMITS_CSS__ : "");
  injectStyle(STYLE_TAGS.models, typeof __GBH_SUBAGENT_MODELS_CSS__ === "string" ? __GBH_SUBAGENT_MODELS_CSS__ : "");
  injectStyle(STYLE_TAGS.card, typeof __GBH_SUBAGENT_CARD_CSS__ === "string" ? __GBH_SUBAGENT_CARD_CSS__ : "");
}

/**
 * Dựng mặt plugin của trang cài đặt Subagent.
 * Nhận: hàm `require` của bảng module trang.
 * Trả: mặt plugin mà Loader gọi `apply` trên đó — lần cài thứ hai là no-op (hàng rào idempotent).
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const { jsx, jsxs, Fragment } = requireFn("react/jsx-runtime") as JsxRuntime;
  const react = requireFn("react") as ReactModule;
  const primitivesModule = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule;
  const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as { createSnapshotStore: SubagentPrimitives["createSnapshotStore"] };
  injectStyles();
  const primitives: SubagentPrimitives & CardPrimitives = {
    settingsNumberField: primitivesModule.settingsNumberField,
    SettingsFormModel: primitivesModule.SettingsFormModel,
    createSnapshotStore: storeModule.createSnapshotStore,
    SettingsValueField: primitivesModule.SettingsValueField,
    Switch: primitivesModule.Switch,
    SettingsForm: primitivesModule.SettingsForm,
  };
  const cardReact: CardReact = { jsx, jsxs, Fragment, useId: react.useId };
  const LimitsFields = createLimitsFields(cardReact, primitives);
  const ModelSelectionFields = createModelSelectionFields(cardReact, primitives);
  const SubagentCard = createSubagentCard({ react: cardReact, primitives, LimitsFields, ModelSelectionFields });

  /**
   * Than plugin that: tach khoi `apply` de boc hang rao idempotent + ghi loi bi cordis nuot.
   * Nhan: ngu canh plugin phia browser.
   * Tra: khong co.
   */
  function applyInner(ctx: SubagentCtx): void {
      const t = ctx.locale.bind(NS);
      ctx.effect(
        () =>
          ctx.locale.register(NS, { vi,
            zh,
            en,
          }),
        EFFECT.dictionaries,
      );
      const limits = new SubagentLimitsCardController(ctx.configForms.get(SUBAGENT_NS) as SettingsSection<SubagentLimitsSettings>, primitives);
      ctx.effect(
        () => () => {
          limits.dispose();
        },
        EFFECT.limitsSubscription,
      );
      const models = new SubagentModelSelectionCardController(
        ctx.configForms.get(SUBAGENT_MODEL_SELECTION_NS) as SettingsSection<SubagentModelSelectionSettings>,
        ctx,
        primitives,
      );
      const limitsFace = limits.inject();
      const modelsFace = models.inject();
      ctx.effect(
        () =>
          ctx.remote.$on(MODEL_CATALOG_EVENTS.adapters, () => {
            models.refreshCatalog();
          }),
        EFFECT.adapterInvalidations,
      );
      ctx.effect(
        () =>
          ctx.remote.$on(MODEL_CATALOG_EVENTS.settings, () => {
            models.refreshCatalog();
          }),
        EFFECT.settingsInvalidations,
      );
      ctx.effect(
        () =>
          ctx.on(RESET_EVENT, () => {
            models.resetConnection();
          }),
        EFFECT.connectionGeneration,
      );
      ctx.effect(
        () => () => {
          models.dispose();
        },
        EFFECT.modelPreference,
      );
      ctx.effect(
        () =>
          ctx.configForms.whileServed([SUBAGENT_NS, SUBAGENT_MODEL_SELECTION_NS], () =>
            ctx.slots.inject("plugins.item", () =>
              ctx.slots.register(
                {
                  name: "plugins.item",
                  id: SLOT.id,
                  order: SLOT.order,
                  label: () => t("subagentTitle"),
                  locale: NS,
                  inject: () => subagentCardFace(limitsFace, modelsFace),
                },
                SubagentCard,
              ),
            ),
          ),
        EFFECT.page,
      );
  }

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Mat `apply` ma Loader goi.
     * Nhan: ngu canh plugin phia browser.
     * Tra: khong co — lan cai thu hai la no-op, va loi duoc IN RA roi moi nem tiep.
     */
    apply(ctx: SubagentCtx): void {
      // Cổng NGOÀI (boolean phạm vi module): chặn CHẮC lần nạp thứ hai, kể cả khi ctx khác.
      // Cổng NGOÀI: so IDENTITY với ctx lần cài trước — chặn chắc, không phụ thuộc WeakSet.
      if (installed) return;
    installed = true;
      try {
        applyInner(ctx);
      } catch (error) {
        console.error(PACKAGE_NAME + ": apply nem loi", error);
        throw error;
      }
    },
  };
}
