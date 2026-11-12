/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Panel duyet chiem cho composer: hien mot yeu cau dang cho, nghe Enter/Escape co kiem IME
 */

import { DETAIL_SLOT } from "./ids.ts";
import type { ApprovalDisplayReason, PendingApproval } from "./pending-approval.ts";

/** CSS của panel do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục cùng tên. */
declare const __GBH_APPROVAL_CSS__: string;

/** Tên lớp CSS — GIỮ NGUYÊN hash của bản gốc để DOM không lệch (xem ApprovalPanel.module.css). */
export const CLASS = {
  /** Khung ngoài của composer takeover. */
  root: "mna1RW_root",
  /** Thẻ chứa nội dung yêu cầu. */
  card: "mna1RW_card",
  /** Dải trạng thái "đang chờ". */
  strip: "mna1RW_strip",
  /** Vùng cuộn chứa lý do và chi tiết. */
  body: "mna1RW_body",
  /** Dòng lý do. */
  headline: "mna1RW_headline",
  /** Khối chi tiết do Tool sở hữu. */
  command: "mna1RW_command",
  /** Hàng nút. */
  actionRow: "mna1RW_actionRow",
  /** Nút từ chối (có hover riêng). */
  reject: "mna1RW_reject",
} as const;

/** Id gắn vào `data-plugin-css` để không chèn style hai lần. */
const STYLE_TAG_ID = "@galaxy-blackhole/gbh-client-ui-approval/ApprovalPanel.module.css";

/** Hàm dựng element của React runtime. */
type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** React runtime tối thiểu mà panel dùng. */
export interface PanelReact {
  /** Dựng element một con. */
  jsx: JsxFn;
  /** Dựng element nhiều con. */
  jsxs: JsxFn;
  /** Hook trạng thái "đã trả lời". */
  useState: (initial: boolean) => [boolean, (next: boolean) => void];
  /** Hook giữ cờ "đang chờ Host" và các cờ IME. */
  useRef: <T>(initial: T) => { current: T };
  /** Hook vòng đời "còn sống". */
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
}

/** Bề mặt ui-primitives mà panel dùng. */
export interface PanelPrimitives {
  /** Chấm trạng thái. */
  StateDot: unknown;
  /** Nút dùng chung. */
  Button: unknown;
}

/** Props mà renderer bind cho panel (đúng hình dạng của bản gốc). */
export interface ApprovalComposerProps {
  /** Yêu cầu mà selector của slot đã khớp. */
  matched: PendingApproval;
  /** Render slot con chứa chi tiết do Tool sở hữu. */
  renderSlot: (slot: string, owner: Record<string, unknown>) => unknown;
  /** Dịch lý do do bên hỏi cung cấp sang ngôn ngữ đang chọn. */
  resolveReason: (reason: ApprovalDisplayReason) => string;
  /** Đọc từ điển của namespace `approval` (có tham số nội suy). */
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * Chèn CSS của panel vào document đúng một lần.
 * Nhận: không.
 * Trả: không; gọi ngoài môi trường có `document` thì bỏ qua.
 */
export function injectPanelStyles(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-plugin-css="' + STYLE_TAG_ID + '"]') !== null) return;
  const cssText = typeof __GBH_APPROVAL_CSS__ === "string" ? __GBH_APPROVAL_CSS__ : "";
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-approval";
  tag.dataset.pluginCss = STYLE_TAG_ID;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Dựng component panel duyệt.
 * Nhận: React runtime và bề mặt ui-primitives (do bảng module cấp lúc vạt chất hoá).
 * Trả: component nhận props của renderer và trả element của composer takeover.
 */
export function createApprovalPanel(react: PanelReact, primitives: PanelPrimitives): (props: ApprovalComposerProps) => unknown {
  /**
   * Một yêu cầu đang chờ và phần chi tiết (nếu Tool có cấp).
   * Nhận: props của renderer.
   * Trả: element của composer takeover; khoá React là `key` của yêu cầu để remount một lần.
   */
  function ApprovalPanel(props: ApprovalComposerProps): unknown {
    const approval = props.matched;
    const detail = approval.callId === undefined ? null : props.renderSlot(DETAIL_SLOT, { callId: approval.callId });
    return react.jsx(
      ApprovalFlow,
      {
        pending: approval,
        reason: approval.displayReason === undefined ? approval.reason : props.resolveReason(approval.displayReason),
        detail,
        t: props.t,
      },
      approval.key,
    );
  }

  /**
   * Thân panel: nút cho phép/từ chối, phím tắt Enter/Escape và các cờ chống IME.
   * Nhận: yêu cầu đang chờ, lý do đã dịch, chi tiết do Tool sở hữu và hàm đọc từ điển.
   * Trả: element của thẻ panel.
   */
  function ApprovalFlow(props: {
    pending: PendingApproval;
    reason: string | undefined;
    detail: unknown;
    t: ApprovalComposerProps["t"];
  }): unknown {
    const { pending, reason, detail, t } = props;
    const [answered, setAnswered] = react.useState(false);
    const waiting = react.useRef(false);
    const active = react.useRef(true);
    const composing = react.useRef(false);
    const compositionEnded = react.useRef(false);

    react.useEffect(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []);

    /**
     * Ghi quyết định của người dùng lên yêu cầu, chịu được lần gửi hỏng.
     * Nhận: quyết định (`allowed-once` | `rejected`).
     * Trả: không; yêu cầu đã kết thúc thì bỏ qua.
     */
    const answer = (outcome: "allowed-once" | "rejected"): void => {
      if (waiting.current || !pending.answerable) return;
      waiting.current = true;
      setAnswered(true);
      pending.answer(outcome).catch(() => {
        // Panel đã bị gỡ hoặc yêu cầu đã kết thúc bằng đường khác thì giữ nguyên trạng thái đang chờ.
        if (!active.current || !pending.answerable) return;
        waiting.current = false;
        setAnswered(false);
      });
    };

    /**
     * Nghe Enter/Escape ở cấp panel, chỉ nhận khi tiêu điểm không nằm trong ô nhập/nút bấm.
     * Nhận: sự kiện bàn phím của React.
     * Trả: không; sự kiện bị chặn khi panel xử lý nó.
     */
    const onKeyDown = (event: {
      target: { closest(selector: string): unknown };
      currentTarget: { contains(node: unknown): boolean };
      nativeEvent: { isComposing: boolean };
      key: string;
      keyCode: number;
      repeat: boolean;
      defaultPrevented: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey: boolean;
      shiftKey: boolean;
      preventDefault(): void;
      stopPropagation(): void;
    }): void => {
      const element = event.target;
      const inEditingControl =
        element.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]') !== null;
      if (event.defaultPrevented || !event.currentTarget.contains(document.activeElement) || inEditingControl) return;
      if (event.key !== "Enter" && event.key !== "Escape") return;
      if (event.key === "Enter" && element.closest('button, a[href], [role="button"]') !== null) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      event.stopPropagation();
      // IME: đang gõ dở, vừa kết thúc composition, hoặc trình duyệt báo mã 229 ⇒ không coi là quyết định.
      if (event.repeat || composing.current || compositionEnded.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
      answer(event.key === "Enter" ? "allowed-once" : "rejected");
    };

    return react.jsx("div", {
      className: CLASS.root,
      "data-approval-key": pending.key,
      "aria-busy": answered,
      onKeyDown,
      onKeyUpCapture: () => {
        compositionEnded.current = false;
      },
      onCompositionStartCapture: () => {
        composing.current = true;
      },
      onCompositionEndCapture: () => {
        composing.current = false;
        compositionEnded.current = true;
      },
      children: react.jsxs("div", {
        className: CLASS.card,
        children: [
          react.jsxs("div", {
            className: CLASS.strip,
            children: [
              react.jsx(primitives.StateDot, { state: answered ? "ongoing" : "warning" }),
              t("waiting"),
            ],
          }),
          react.jsxs("div", {
            className: CLASS.body,
            "data-approval-scroll": "",
            tabIndex: 0,
            role: "group",
            "aria-label": t("detail.aria"),
            children: [
              react.jsx("div", {
                className: CLASS.headline,
                children: reason ?? t("escalation", { toolName: pending.toolName }),
              }),
              detail !== null &&
                react.jsx("div", {
                  className: CLASS.command,
                  children: detail,
                }),
            ],
          }),
          react.jsxs("div", {
            className: CLASS.actionRow,
            children: [
              react.jsx(primitives.Button, {
                variant: "outline",
                className: CLASS.reject,
                disabled: answered,
                onClick: () => {
                  answer("rejected");
                },
                children: t("reject"),
              }),
              react.jsx(primitives.Button, {
                variant: "primary",
                disabled: answered,
                onClick: () => {
                  answer("allowed-once");
                },
                children: t("allowOnce"),
              }),
            ],
          }),
        ],
      }),
    });
  }

  return ApprovalPanel;
}
