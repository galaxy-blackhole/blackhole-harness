/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua client cua row ui-settings-agent-loop: trang Agent loop trong Plugins (form staged tren namespace agent-loop)
 */

import { AGENT_LOOP_NAMESPACE, PARALLEL_FIELD_ID, SLOT_OCCUPANT_ID, SLOT_ORDER } from "./ids.ts";
import { NS, formLabels, type LocaleKey, en, zh } from "./locales.ts";
import { vi } from "./locales-vi.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (nạp lười, gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/** Hàm dựng element của React runtime. */
type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng một element. */
  jsx: JsxFn;
}

/** Trường cài đặt đã staged của ui-primitives (đổ thẳng vào `SettingsValueField`). */
type FieldState = Record<string, unknown>;

/**
 * Ảnh chụp mà trang render: vỏ form dùng chung (trong đó có `writable`, `dirty`, `saving`… do
 * ui-primitives quyết định) cộng trường song song của trang này.
 */
type PageSnapshot = Record<string, unknown> & {
  /** Trạng thái trường "số lời gọi tool song song". */
  maxParallelToolCalls: FieldState;
};

/** Hành động của form staged (ui-primitives cấp, trang chỉ chuyển tiếp ra slot). */
interface FormActions extends Record<string, unknown> {
  /** Gửi các giá trị đã sửa lên Host. */
  save: (...args: unknown[]) => unknown;
  /** Bỏ bản nháp, quay về giá trị đã nhận. */
  discard: (...args: unknown[]) => unknown;
  /** Sửa một trường theo văn bản người dùng gõ. */
  edit: (field: string, text: string) => void;
  /** Xoá một trường về mặc định của deployment. */
  resetField: (field: string) => void;
}

/** Nguồn quan sát được mà renderer bind thành hook `useAgentLoopCard` (bất động với trang này). */
type HookStore = unknown;

/** Bề mặt form staged của ui-primitives mà trang này dùng. */
interface SettingsForm {
  /** Theo dõi ảnh chụp form và trả một store cho renderer. */
  bind: (projection: () => PageSnapshot) => HookStore;
  /** Vỏ form dùng chung (trạng thái đọc/ghi, lần lưu gần nhất…). */
  shell: () => Record<string, unknown>;
  /** Trạng thái của một trường đã khai. */
  field: (name: string) => FieldState;
  /** Bộ hành động của form. */
  actions: () => FormActions;
  /** Giải phóng các đăng ký giá trị đã nhận. */
  dispose: () => void;
}

/** Bề mặt ui-primitives mà trang này require. */
interface PrimitivesModule {
  /** Khung form dùng chung. */
  SettingsForm: unknown;
  /** Ô nhập giá trị dùng chung. */
  SettingsValueField: unknown;
  /** Mô hình form staged trên một scope cài đặt. */
  SettingsFormModel: new (scope: unknown, fields: unknown[]) => SettingsForm;
  /** Khai một trường số trong mô hình form. */
  settingsNumberField: (name: string) => unknown;
}

/** Seam phía browser mà trang này cần (tên service giữ nguyên như bản gốc). */
interface ClientContext {
  /** Đăng ký một hiệu ứng vòng đời; hàm dọn dẹp chạy khi fiber tắt. */
  effect: (callback: () => void | (() => void), label?: string) => void;
  /** Seam từ điển: bind khoá đọc và đăng ký bản dịch. */
  locale: {
    /** Buộc khoá đọc vào namespace của trang. */
    bind: (namespace: string) => (key: LocaleKey) => string;
    /** Đăng ký bản dịch cho namespace; trả hàm gỡ. */
    register: (namespace: string, copy: Record<string, Record<string, string>>) => () => void;
  };
  /** Seam slot: đăng ký người ngồi và theo dõi slot có mặt. */
  slots: {
    /** Đăng ký một occupant vào slot; trả hàm gỡ. */
    register: (definition: Record<string, unknown>, component: unknown) => () => void;
    /** Chỉ đăng ký khi slot đã có người phục vụ. */
    inject: (slot: string, register: () => unknown) => void;
  };
  /** Seam form cài đặt: scope đã bind theo namespace và cổng "Host có phục vụ không". */
  configForms: {
    /** Lấy scope cài đặt đã bind cho một namespace. */
    get: (namespace: string) => unknown;
    /** Chỉ chạy đăng ký khi Host đang phục vụ các namespace này. */
    whileServed: (namespaces: readonly string[], register: () => unknown) => void;
  };
}

/** Props mà renderer bind cho trang (hook từ `inject()` + copy + hành động của form). */
interface CardProps {
  /** Chế độ xem: `summary` là dòng mô tả, còn lại là form. */
  view?: string;
  /** Hàm đọc từ điển của trang. */
  t: (key: LocaleKey) => string;
  /** Hook đọc ảnh chụp trang; tên do khoá `agentLoopCard` trong `inject()` quyết định. */
  useAgentLoopCard: (select: (snapshot: PageSnapshot) => PageSnapshot) => PageSnapshot;
  /** Gửi giá trị đã sửa. */
  save: (...args: unknown[]) => unknown;
  /** Bỏ bản nháp. */
  discard: (...args: unknown[]) => unknown;
  /** Sửa một trường. */
  edit: (field: string, text: string) => void;
  /** Xoá một trường về mặc định. */
  resetField: (field: string) => void;
}

/** Bề mặt plugin mà loader nhận từ bundle (`module.exports` của nửa browser). */
export interface ClientPlugin {
  /** Namespace từ điển của trang. */
  NS: string;
  /** Seam mà fiber của trang cần trước khi `apply` chạy. */
  inject: string[];
  /** Dựng trang khi Host phục vụ namespace `agent-loop`. */
  apply: (ctx: ClientContext) => void;
}

/** Trường cài đặt mà trang này sửa (chỉ MỘT trường: mảng `agents` là thành phần boot, không phải cài đặt người dùng). */
const PARALLEL_FIELD = "maxParallelToolCalls";

/** Nhãn hiệu ứng vòng đời — giữ nguyên chuỗi của bản gốc để log/chẩn đoán đối chiếu được. */
const EFFECT = {
  /** Đăng ký từ điển en/zh. */
  dictionaries: "ui-settings-agent-loop: dictionaries",
  /** Giải phóng đăng ký của form khi fiber tắt. */
  subscription: "ui-settings-agent-loop: form subscription",
  /** Đăng ký trang vào slot khi Host phục vụ namespace. */
  page: "ui-settings-agent-loop: page",
} as const;

/**
 * Bọc scope cài đặt của namespace `agent-loop` thành form staged của trang.
 * Nhận: bề mặt ui-primitives và scope đã bind cho namespace.
 * Trả: đối tượng có `inject()` (mặt mà slot occupant chuyển cho renderer) và `dispose()`.
 */
function createCardController(primitives: PrimitivesModule, scope: unknown): { inject: () => Record<string, unknown>; dispose: () => void } {
  const form = new primitives.SettingsFormModel(scope, [primitives.settingsNumberField(PARALLEL_FIELD)]);
  const store = form.bind(() => projection());
  /** Ảnh chụp trang: vỏ form dùng chung + trường song song của trang này. */
  function projection(): PageSnapshot {
    return { ...form.shell(), maxParallelToolCalls: form.field(PARALLEL_FIELD) };
  }
  return {
    /** Mặt mà slot occupant chuyển cho renderer. */
    inject: () => ({ hooks: { agentLoopCard: store }, ...form.actions() }),
    /** Giải phóng đăng ký của form. */
    dispose: () => {
      form.dispose();
    },
  };
}

/**
 * Tập ctx ĐÃ cài — phạm vi MODULE, khoá theo `ctx`. Row đăng ký HAI id ⇒ factory gọi hai lần
 * nhưng CÙNG một ctx; khoá theo ctx chặn lần cài thứ hai mà KHÔNG dính giữa các ca test trong cùng file.
 */
/** Cong NGOAI: boolean PHAM VI MODULE — chan chac chan lan cai thu hai, khong phu thuoc identity cua ctx. */

/** Da cai qua cong NGOAI chua. */

/**
 * Dựng component của trang.
 * Nhận: hàm jsx của React runtime và bề mặt ui-primitives.
 * Trả: component nhận props của renderer — dòng mô tả khi `view` là `summary`, form khi không.
 */
function makeCard(jsx: JsxFn, primitives: PrimitivesModule): (props: CardProps) => unknown {
  return function AgentLoopCard(props: CardProps): unknown {
    const { t } = props;
    const state = props.useAgentLoopCard((snapshot) => snapshot);
    if (props.view === "summary") return t("description");
    return jsx(primitives.SettingsForm, {
      labels: formLabels(t),
      state,
      onSave: props.save,
      onDiscard: props.discard,
      children: jsx(primitives.SettingsValueField, {
        id: PARALLEL_FIELD_ID,
        label: t("maxParallel"),
        hint: t("maxParallelHint"),
        overriddenLabel: t("overridden"),
        resetLabel: t("reset"),
        invalidLabel: t("invalidNumber"),
        numeric: true,
        disabled: !state.writable,
        ...state.maxParallelToolCalls,
        onEdit: (text: string) => {
          props.edit(PARALLEL_FIELD, text);
        },
        onReset: () => {
          props.resetField(PARALLEL_FIELD);
        },
      }),
    });
  };
}

/** Cổng NGOÀI (phạm vi MODULE): true khi bundle đã cài một lần — chặn CHẮC lần nạp thứ hai, kể cả khi
 * Loader truyền một object ctx KHÁC cho plugin thứ hai.
 */
let installed = false;

/** Cong TRONG: khoa theo ctx — khong pha cac ca test dung lai cung module.
 * Tap ctx DA cai — pham vi MODULE, khoa theo `ctx`. Row dang ky HAI id => factory goi
 * nhieu lan nhung CUNG mot ctx; khoa theo ctx chan lan cai thu hai ma KHONG dinh giua cac ca test.
 */

/**
 * Dung nua client cua row tu require do bang bang module cap.
 * @param requireFn - require cua bang module (react/jsx-runtime + @galaxy-blackhole/gbh-client-ui-primitives).
 * @returns plugin { NS, inject, apply } — dung hinh dang ma Loader cua vo nhan.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const { jsx } = requireFn("react/jsx-runtime") as JsxRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule;
  const AgentLoopCard = makeCard(jsx, primitives);

  /**
   * Dựng trang khi Host phục vụ namespace `agent-loop`.
   * Nhận: context phía browser.
   * Trả: không; để lại ba hiệu ứng vòng đời (từ điển · giải phóng form · đăng ký trang).
   */
  /**
   * Boc idempotent + ghi log loi bi cordis NUOT, roi VAN nem tiep.
   * @param ctx - context phia browser.
   */
  function apply(ctx: ClientContext): void {
    // Cổng NGOÀI: so IDENTITY với ctx lần cài trước — chặn chắc, không phụ thuộc WeakSet.
    if (installed) return;
    installed = true;
    try {
      applyInner(ctx);
    } catch (error) {
      console.error("gbh-client-ui-settings-agent-loop: apply nem loi", error);
      throw error;
    }
  }

  /**
   * Than cua apply (giu nguyen hanh vi ban dau).
   * @param ctx - context phia browser.
   */
  function applyInner(ctx: ClientContext): void {
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    const card = createCardController(primitives, ctx.configForms.get(AGENT_LOOP_NAMESPACE));
    ctx.effect(() => () => card.dispose(), EFFECT.subscription);
    // Tên slot ghi thẳng bằng CHUỖI ở cả hai chỗ (không qua hằng) để đối chiếu được với bản gốc
    // bằng mắt, bằng grep, và bằng `bun run check:rows` — công cụ đó so tên slot theo văn bản.
    ctx.effect(
      () =>
        ctx.configForms.whileServed([AGENT_LOOP_NAMESPACE], () =>
          ctx.slots.inject("plugins.item", () =>
            ctx.slots.register(
              {
                name: "plugins.item",
                id: SLOT_OCCUPANT_ID,
                order: SLOT_ORDER,
                label: () => t("title"),
                locale: NS,
                inject: () => card.inject(),
              },
              AgentLoopCard,
            ),
          ),
        ),
      EFFECT.page,
    );
  }

  return { NS, inject: ["slots", "locale", "configForms"], apply };
}
