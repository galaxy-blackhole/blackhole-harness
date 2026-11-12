/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc O xem truoc lenh /goal: dinh nghia chieu node + component bong bong canh phai
 */

import { VIEW_CLASS } from "./class-names.ts";
import { GOAL_COMMAND } from "./ids.ts";

/** Một sự kiện phiên đã chạy lệnh (`command/run`). */
export interface CommandRunEvent {
  /** Loại sự kiện. */
  readonly type: string;
  /** Số thứ tự trong phiên. */
  readonly seq: number;
  /** Thời điểm. */
  readonly time: number;
  /** Dữ liệu lệnh. */
  readonly data: { readonly commandId: string; readonly name: string; readonly args?: string };
}

/** Trạng thái mà định nghĩa giữ giữa các sự kiện. */
export interface GoalCommandInputState {
  /** Id lệnh. */
  readonly commandId: string;
  /** Số thứ tự của lần chạy đầu. */
  readonly seq: number;
  /** Thời điểm chạy. */
  readonly time: number;
  /** Dòng lệnh hiển thị. */
  readonly text: string;
}

/** Node mà định nghĩa dựng ra cho cây hội thoại. */
export interface GoalCommandInputNode {
  /** Khoá node. */
  readonly key: unknown;
  /** Loại node. */
  readonly kind: "command-input";
  /** Id node. */
  readonly id: string;
  /** Đích hiển thị. */
  readonly target: "chat";
  /** Neo ngay trước sự kiện chạy. */
  readonly anchorSeq: number;
  /** Vị trí trong cây. */
  readonly location: unknown;
  /** Mức hiển thị. */
  readonly visibility: "visible";
  /** Dữ liệu đã chiếu cho component. */
  readonly data: { readonly commandId: string; readonly text: string; readonly time: number };
}

/** Định nghĩa chiếu node cho lệnh /goal. */
export interface GoalCommandInputDefinition {
  /** Loại chiếu. */
  readonly kind: "goal-command-input";
  /** Đích. */
  readonly target: "chat";
  /** Khớp sự kiện chạy lệnh /goal. */
  readonly match: (event: unknown) => { readonly id: string; readonly role: "start" } | null;
  /** Mở một lần chiếu mới. */
  readonly start: (context: unknown, match: { readonly event: CommandRunEvent }) => GoalCommandInputState;
  /** Giữ nguyên trạng thái giữa các sự kiện. */
  readonly update: (context: { readonly state: GoalCommandInputState | undefined }) => GoalCommandInputState | undefined;
  /** Dựng node để vẽ. */
  readonly buildViewNode: (context: {
    readonly key: unknown;
    readonly id: string;
    readonly state: GoalCommandInputState | undefined;
    readonly start?: { readonly location?: unknown };
  }) => GoalCommandInputNode | null;
}

/** Dải lệnh đã chạy, dùng để tô chip cho đúng đoạn lệnh. */
export const GOAL_COMMANDS = [{ start: 0, end: 5, name: GOAL_COMMAND }] as const;

/**
 * Suy ra dòng lệnh hiển thị từ lần chạy đã bền.
 * Nhận: sự kiện `command/run`.
 * Trả: văn bản lệnh đã cắt khoảng trắng cuối mà bộ phân tích thêm vào.
 */
export function goalCommandText(event: CommandRunEvent): string {
  return "/" + event.data.name + (event.data.args ?? "").trimEnd();
}

/** Chiếu phần nhập lệnh do goal sở hữu; định nghĩa chung giữ hàng kết quả. */
export const goalCommandInputDefinition: GoalCommandInputDefinition = {
  kind: "goal-command-input",
  target: "chat",
  match: (event) => {
    const candidate = event as CommandRunEvent;
    return candidate.type === "command/run" && candidate.data.name === GOAL_COMMAND
      ? { id: String(candidate.data.commandId), role: "start" }
      : null;
  },
  start: (_context, match) => {
    if (match.event.type !== "command/run") throw new Error("goal-command-input start requires command/run");
    return {
      commandId: match.event.data.commandId,
      seq: match.event.seq,
      time: match.event.time,
      text: goalCommandText(match.event),
    };
  },
  update: (context) => context.state,
  buildViewNode: (context) => {
    if (context.state === undefined) return null;
    return {
      key: context.key,
      kind: "command-input",
      id: context.id,
      target: "chat",
      anchorSeq: context.state.seq - 0.1,
      location: context.start?.location ?? { kind: "unresolved" },
      visibility: "visible",
      data: {
        commandId: context.state.commandId,
        text: context.state.text,
        time: context.state.time,
      },
    };
  },
};

/** Props mà ô xem trước nhận từ renderer. */
export interface GoalCommandInputViewProps {
  /** Node đã chiếu. */
  node: { readonly data: { readonly text: string } };
  /** Đọc từ điển namespace `goal`. */
  t: (key: string) => string;
  /** Renderer của slot văn bản người dùng. */
  renderFactorySlot: (name: string, owner: Record<string, unknown>) => unknown;
}

/** React runtime tối thiểu mà ô xem trước dùng. */
export interface ViewReact {
  /** Dựng element một con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dựng element nhiều con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Ghi nhớ component theo tham số. */
  memo: <T>(component: T) => T;
}

/**
 * Dựng component ô xem trước lệnh.
 * Nhận: React runtime.
 * Trả: component `GoalCommandInputView`.
 */
export function createGoalCommandInputView(react: ViewReact): (props: GoalCommandInputViewProps) => unknown {
  /**
   * Bong bóng nhập lệnh canh phải, không có hành động tin nhắn thường. Dòng đã gửi tô chip cho token
   * `/goal` đầu dòng — chính lần chạy mà node này chiếu là bằng chứng token đó là lệnh — và giữ phần
   * objective, kể cả các lần nhắc `/goal` trong đó, là văn bản thường.
   * Nhận: node đã chiếu, hàm đọc từ điển và renderer slot văn bản.
   * Trả: element của bong bóng.
   */
  function GoalCommandInputView(props: GoalCommandInputViewProps): unknown {
    const { node, t, renderFactorySlot } = props;
    const data = node.data;
    return react.jsx("div", {
      className: VIEW_CLASS.row,
      "data-command-input": "",
      role: "group",
      "aria-label": t("commandInput.aria"),
      children: react.jsx("div", {
        className: VIEW_CLASS.stack,
        children: react.jsx("div", {
          className: VIEW_CLASS.bubble,
          children: renderFactorySlot("conversation.user.text", {
            text: data.text,
            facts: { commands: GOAL_COMMANDS },
            interactive: false,
          }),
        }),
      }),
    });
  }

  return react.memo(GoalCommandInputView);
}
