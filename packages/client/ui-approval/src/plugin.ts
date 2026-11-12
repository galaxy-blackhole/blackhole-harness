/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua client cua row ui-approval: nghe waterfall approval/request co pham vi va chiem cho composer de hoi nguoi
 */

import { APPROVAL_EVENT, FIXED_SHORTCUT_IDS, SHORTCUT_GROUP, DETAIL_SLOT } from "./ids.ts";
import { NS, en, zh } from "./locales.ts";
import { PendingApproval, type ApprovalDecision, type ApprovalPresentationRequest } from "./pending-approval.ts";
import { createApprovalPanel, injectPanelStyles, type PanelPrimitives, type PanelReact } from "./panel.ts";
import { vi } from "./locales-vi.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/** React runtime (hooks) do bảng module cấp. */
interface ReactRuntime {
  /** Hook trạng thái "đã trả lời". */
  useState: PanelReact["useState"];
  /** Hook giữ cờ. */
  useRef: PanelReact["useRef"];
  /** Hook vòng đời. */
  useEffect: PanelReact["useEffect"];
}

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng element một con. */
  jsx: PanelReact["jsx"];
  /** Dựng element nhiều con. */
  jsxs: PanelReact["jsxs"];
}

/** Kết quả một lần đăng ký "pending interaction": hàm gỡ đăng ký. */
type RemovePendingInteraction = () => void;

/** Bộ gỡ đăng ký mà `registerPendingInteraction` nhận: chạy khi yêu cầu bị chuyển tiếp hoặc hết vòng đời. */
type DelegationHook = () => Promise<void> | void;

/** Seam phía browser mà row này cần (tên service giữ nguyên như bản gốc). */
interface ClientContext {
  /** Đăng ký hiệu ứng vòng đời ở context gốc. */
  effect: (callback: () => void | (() => void), label?: string) => void;
  /** Chờ một seam khác rồi chạy phần phụ thuộc seam đó. */
  inject: (deps: readonly string[], callback: (scope: ShortcutScope) => void) => void;
  /** Phạm vi Agent/phiên. */
  sessions: {
    /** Phiên sở hữu một listener waterfall; `undefined` khi listener không thuộc phiên nào. */
    scopeOf(owner: unknown): string | undefined;
  };
  /** Remote Event có phạm vi: nơi yêu cầu duyệt đi qua. */
  remote: {
    /** Nghe một sự kiện; hàm nghe nhận `this` là chủ sở hữu phạm vi và `next` để chuyển tiếp. */
    $on: (event: string, listener: (this: unknown, request: ApprovalPresentationRequest, next: () => unknown) => unknown) => void;
  };
  /** Trạng thái tương tác của phiên (nơi hiển thị "đang chờ người trả lời"). */
  uiSession: {
    /** Đăng ký một chỗ tương tác đang chờ; trả hàm gỡ. */
    registerPendingInteraction: (priority: () => number) => (pending: PendingApproval, onDelegate: DelegationHook) => RemovePendingInteraction;
  };
  /** Sổ đăng ký slot của shell. */
  slots: {
    /** Đăng ký một occupant; trả hàm gỡ. */
    register: (definition: Record<string, unknown>, component: unknown) => () => void;
    /** Chỉ đăng ký khi slot đã có người phục vụ. */
    inject: (slot: string, register: () => unknown) => void;
  };
  /** Từ điển. */
  locale: {
    /** Buộc khoá đọc vào một namespace. */
    bind: (namespace: string) => (key: string, params?: Record<string, unknown>) => string;
    /** Đăng ký bản dịch cho namespace; trả hàm gỡ. */
    register: (namespace: string, copy: Record<string, Record<string, string>>) => () => void;
    /** Dịch một chuỗi do bên khác cấp (có bản tiếng Anh làm mặc định). */
    resolveText: (reason: { readonly en: string; readonly [locale: string]: string }) => string;
  };
}

/** Phạm vi của seam `shortcuts` sau khi `ctx.inject(["shortcuts"], …)` chạy. */
export interface ShortcutScope {
  /** Đăng ký hiệu ứng vòng đời trong phạm vi này. */
  effect: (callback: () => void | (() => void), label?: string) => void;
  /** Phím tắt cố định (không cho người dùng đổi). */
  shortcuts: {
    /** Đăng ký một phím tắt cố định; trả hàm gỡ. */
    registerFixed: (definition: Record<string, unknown>) => () => void;
  };
}

/** Bề mặt plugin mà Loader nhận từ bundle. */
export interface ClientPlugin {
  /** Seam mà fiber của row cần trước khi `apply` chạy. */
  inject: string[];
  /** Cài từ điển, phím tắt, chỗ tương tác đang chờ, panel composer và consumer waterfall. */
  apply: (ctx: ClientContext) => void;
}

/** Cổng NGOÀI (phạm vi MODULE): ctx của lần cài trước — so IDENTITY, chặn chắc mà không phá test. */
let bundleInstalled = false;

/** Cổng TRONG (lưới thứ hai): tập ctx đã cài — chặn lần hai trên CÙNG ctx. */


/** Nhan hieu ung vong doi — giu nguyen chuoi cua ban goc de log/chan doan doi chieu duoc. */
const EFFECT = {
  /** Đăng ký hai bản dịch. */
  dictionaries: "ui-approval: dictionaries",
  /** Phím tắt "cho phép một lần". */
  fixedAllow: "ui-approval: fixed allow reference",
  /** Phím tắt "từ chối". */
  fixedReject: "ui-approval: fixed reject reference",
} as const;

/** Thứ tự khai seam: Agent scopes · Remote Events · Session UI · Slot registry · copy. */
const INJECT = ["sessions", "remote", "uiSession", "slots", "locale"] as const;

/**
 * Trình bày MỘT yêu cầu cho tới khi người dùng trả lời hoặc vòng đời của nó kết thúc.
 * Nhận: context client, chủ sở hữu phạm vi của listener, yêu cầu, hàm chuyển tiếp waterfall, và hàm
 * đăng ký "pending interaction".
 * Trả: quyết định người dùng chọn, hoặc kết quả của listener kế tiếp khi bị chuyển tiếp.
 */
async function answerApproval(
  ctx: ClientContext,
  owner: unknown,
  request: ApprovalPresentationRequest,
  next: () => unknown,
  registerPendingInteraction: ClientContext["uiSession"]["registerPendingInteraction"] extends (priority: () => number) => infer R ? R : never,
): Promise<unknown> {
  const sessionId = ctx.sessions.scopeOf(owner);
  if (sessionId === undefined) return next();
  const pending = new PendingApproval(sessionId, {
    toolName: request.toolName,
    ...(request.callId === undefined ? {} : { callId: request.callId }),
    ...(request.reason === undefined ? {} : { reason: request.reason }),
    ...(request.displayReason === undefined ? {} : { displayReason: request.displayReason }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  });
  let settleDelegation!: () => void;
  const delegated = new Promise<void>((resolve) => {
    settleDelegation = resolve;
  });
  const remove = registerPendingInteraction(pending, async () => {
    pending.delegate();
    await delegated;
  });
  try {
    try {
      return await pending.result;
    } catch (error) {
      if (pending.isDelegation(error)) return await next();
      throw error;
    }
  } finally {
    remove();
    settleDelegation();
  }
}

/**
 * Dựng mặt plugin của nửa browser.
 *
 * Chỉ `require` ba specifier, đúng như bản gốc: `react/jsx-runtime`, `react`,
 * `@galaxy-blackhole/gbh-client-ui-primitives`. Cả ba được gọi LÚC VẬT CHẤT HOÁ factory nên script chỉ đăng
 * ký mà không kéo module nào (hợp đồng C2).
 * Nhận: hàm require của bảng module.
 * Trả: plugin `{ inject, apply }` — hình dạng mà Loader của vỏ nhận.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  // KHÔNG chặn ở factory (sự cố 17/10, đổi 20:3x): hai ENTRY (id ta + id alias) là hai FIBER ⇒ hai ctx KHÁC
  // nhau và CẢ HAI đều hợp lệ; chặn ở factory sẽ trả plugin RỖNG cho entry thứ hai ⇒ entry đó không bao giờ
  // activate — đúng cái triệu chứng đang sửa. Chặn đúng chỗ là ở `apply` (boolean phạm vi module).
  const { jsx, jsxs } = requireFn("react/jsx-runtime") as JsxRuntime;
  const react = requireFn("react") as ReactRuntime;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PanelPrimitives;
  injectPanelStyles();
  const ApprovalPanel = createApprovalPanel({ jsx, jsxs, ...react }, primitives);

  /**
   * Cài copy, phím tắt, chỗ tương tác đang chờ, panel composer và consumer waterfall.
   * Nhận: context gốc của client.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    // Cổng NGOÀI: so IDENTITY với ctx lần cài trước — chặn chắc; ctx mới (ca test khác) vẫn được cài.
    if (bundleInstalled) {
        console.warn("gbh-client-ui-approval: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
    try {
      applyInner(ctx);
      // CO CHI BAT SAU khi cai xong (18/10/2026): neu applyInner nem giua duong (vi du slots chua san sang)
      // thi lan cai sau VAN phai chay lai — bat co som khien slot khong bao gio duoc dang ky lai ⇒ renderer
      // gap undefined ⇒ React #130. Day la loi that da lam app trang.
      bundleInstalled = true;
    } catch (error) {
      // Cordis nuot loi cua apply => khong ai biet vi sao row ket. In ra roi VAN nem tiep (khong nuot loi).
      console.error("gbh-client-ui-approval: apply nem loi", error);
      throw error;
    }
  }

  /**
   * Than cua apply: cai tu dien, phim tat, cho tuong tac dang cho, panel composer va consumer waterfall.
   * @param ctx - context goc cua client.
   * @returns khong tra gi.
   */
  function applyInner(ctx: ClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    ctx.inject(["shortcuts"], (scope) => {
      const t = ctx.locale.bind(NS);
      scope.effect(
        () =>
          scope.shortcuts.registerFixed({
            id: FIXED_SHORTCUT_IDS.allow,
            label: () => t("allowOnce"),
            keys: ["Enter"],
            bindings: [{ code: "Enter", modifiers: [] }],
            group: SHORTCUT_GROUP,
          }),
        EFFECT.fixedAllow,
      );
      scope.effect(
        () =>
          scope.shortcuts.registerFixed({
            id: FIXED_SHORTCUT_IDS.reject,
            label: () => t("reject"),
            keys: ["Esc"],
            bindings: [{ code: "Escape", modifiers: [] }],
            group: SHORTCUT_GROUP,
          }),
        EFFECT.fixedReject,
      );
    });
    const registerPendingInteraction = ctx.uiSession.registerPendingInteraction(() => 0);
    // Tên slot ghi thẳng bằng CHUỖI (không qua hằng) để grep và `bun run check:rows` đối chiếu được
    // với bản gốc — công cụ đó so tên slot theo văn bản.
    ctx.slots.inject("conversation.composer", () =>
      ctx.slots.register(
        {
          name: "conversation.composer",
          priority: 1,
          select: ({ pendingInteraction }: { pendingInteraction: unknown }) =>
            pendingInteraction instanceof PendingApproval ? pendingInteraction : null,
          locale: NS,
          inject: () => ({ resolveReason: (reason: Parameters<ClientContext["locale"]["resolveText"]>[0]) => ctx.locale.resolveText(reason) }),
          children: { [DETAIL_SLOT]: { kind: "single", scope: "session" } },
        },
        ApprovalPanel,
      ),
    );
    ctx.remote.$on(APPROVAL_EVENT, function (request, next) {
      return answerApproval(ctx, this, request, next, registerPendingInteraction);
    });
  }

  return { inject: [...INJECT], apply };
}
