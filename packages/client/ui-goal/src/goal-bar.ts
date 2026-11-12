/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc GoalBar (dai muc tieu trong dock soan tin) va GoalDock (bo ghep projection + kich hoat)
 */

import { BAR_CLASS } from "./class-names.ts";
import { PHASE_LABELS } from "./ids.ts";
import type { GoalActivationSnapshot, GoalProjection, GoalView } from "./activation-source.ts";

/** Hàm dựng element của React runtime. */
type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/** React runtime tối thiểu mà hai component dùng. */
export interface GoalReact {
  /** Dựng element một con. */
  jsx: JsxFn;
  /** Dựng element nhiều con. */
  jsxs: JsxFn;
  /** Trạng thái cục bộ của dải. */
  useState: <T>(initial: T) => [T, (next: T) => void];
  /** Ô nhớ giữa các lần render. */
  useRef: <T>(initial: T) => { current: T };
  /** Hiệu ứng vòng đời. */
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
  /** Gói hàm nhớ theo phụ thuộc. */
  useCallback: <T>(callback: T, deps: unknown[]) => T;
}

/** Bề mặt ui-primitives mà dải dùng. */
export interface GoalPrimitives {
  /** Ô sửa nội tuyến cho objective. */
  InlineEditor: unknown;
  /** Tooltip dùng chung. */
  Tooltip: unknown;
  /** Biểu tượng mục tiêu. */
  IconGoalOutlineRegular: unknown;
  /** Biểu tượng lưu. */
  IconCheckOutlineRegular: unknown;
  /** Biểu tượng huỷ. */
  IconCloseOutlineRegular: unknown;
  /** Biểu tượng tạm dừng. */
  IconPauseOutlineRegular: unknown;
  /** Biểu tượng tiếp tục. */
  IconPlayOutlineRegular: unknown;
  /** Biểu tượng sửa. */
  IconEditOutlineRegular: unknown;
  /** Biểu tượng xoá. */
  IconTrashOutlineRegular: unknown;
  /** Chip tham chiếu lệnh. */
  ReferenceChip: unknown;
}

/** Kết quả một lần biến đổi goal (thành công từ Remote, hoặc lỗi cục bộ không gọi wire). */
export interface GoalActionResult {
  /** true khi Host nhận. */
  readonly ok: boolean;
  /** Lỗi khi `ok` là false. */
  readonly error: { readonly code: string; readonly message: string };
}

/** Bốn động từ biến đổi goal mà dải gọi. */
export interface GoalBarActions {
  /** Thay objective hiện tại (CAS theo ref đã chiếu). */
  onEdit: (objective: string) => Promise<GoalActionResult>;
  /** Tạm dừng mục tiêu đang chạy. */
  onPause: () => Promise<GoalActionResult>;
  /** Tiếp tục mục tiêu đang tạm dừng. */
  onResume: () => Promise<GoalActionResult>;
  /** Xoá mục tiêu hiện tại. */
  onClear: () => Promise<GoalActionResult>;
}

/** Props của `GoalBar`. */
export interface GoalBarProps extends GoalBarActions {
  /** Mục tiêu đang chiếu; `null`/`undefined` nghĩa là chưa có hoặc đang nạp. */
  goal: GoalProjection extends undefined ? never : GoalView | null | undefined;
  /** Trạng thái kích hoạt cục bộ, chỉ khi khớp đúng revision. */
  activation?: string;
  /** Đọc từ điển của namespace `goal`. */
  t: (key: string) => string;
}

/** Props của `GoalDock`. */
export interface GoalDockProps extends GoalBarActions {
  /** Hook đọc projection `goal` của phiên. */
  useProjection: (name: string) => GoalProjection;
  /** Hook đọc nguồn kích hoạt cục bộ. */
  useGoalActivation: (select: (next: GoalActivationSnapshot) => string | undefined) => string | undefined;
  /** Đọc từ điển. */
  t: (key: string) => string;
}

/**
 * Nhãn pha cho mục tiêu đang chạy: phân biệt đã kích hoạt hay chưa.
 * Nhận: trạng thái kích hoạt và hàm đọc từ điển.
 * Trả: chuỗi nhãn đã dịch.
 */
function activeLabel(activation: string | undefined, t: (key: string) => string): string {
  return t(activation === "disarmed" ? "phase.active.disarmed" : "phase.active");
}

/**
 * Dựng hai component của dải mục tiêu.
 * Nhận: React runtime và bề mặt ui-primitives.
 * Trả: `{ GoalBar, GoalDock }`.
 */
export function createGoalComponents(
  react: GoalReact,
  primitives: GoalPrimitives,
): { GoalBar: (props: GoalBarProps) => unknown; GoalDock: (props: GoalDockProps) => unknown } {
  /**
   * Dải mục tiêu trong dock soạn tin, kèm chế độ sửa.
   * Nhận: mục tiêu đang chiếu, trạng thái kích hoạt, bốn động từ và hàm đọc từ điển.
   * Trả: element của dải, hoặc `null` khi không có gì để hiện.
   */
  function GoalBar(props: GoalBarProps): unknown {
    const { goal, activation, onEdit, onPause, onResume, onClear, t } = props;
    const [editing, setEditing] = react.useState(false);
    const [draft, setDraft] = react.useState("");
    const [pending, setPending] = react.useState(false);
    const [actionError, setActionError] = react.useState<string | null>(null);
    const [clearedGoalId, setClearedGoalId] = react.useState<string | null>(null);
    const pendingRef = react.useRef(false);
    const goalId = goal?.id;

    react.useEffect(() => {
      setEditing(false);
      setActionError(null);
      setClearedGoalId(null);
    }, [goalId]);

    /**
     * Chạy một động từ, chặn gọi chồng và ghi lỗi để hiện ngay trong dải.
     * Nhận: hàm bất đồng bộ trả kết quả.
     * Trả: kết quả của lần gọi, hoặc `undefined` khi đang có lần khác chạy.
     */
    const runAction = react.useCallback(
      async (action: () => Promise<GoalActionResult>): Promise<GoalActionResult | undefined> => {
        if (pendingRef.current) return undefined;
        pendingRef.current = true;
        setPending(true);
        setActionError(null);
        const result = await action();
        pendingRef.current = false;
        setPending(false);
        if (!result.ok) setActionError(result.error.message + " (" + result.error.code + ")");
        return result;
      },
      [],
    );

    /** Lưu objective đã sửa; văn bản rỗng thì bỏ qua. */
    const handleEdit = react.useCallback(async (): Promise<void> => {
      const trimmed = draft.trim();
      if (trimmed === "") return;
      if ((await runAction(() => onEdit(trimmed)))?.ok === true) setEditing(false);
    }, [draft, onEdit, runAction]);

    /** Xoá mục tiêu hiện tại và nhớ id đã xoá để không render lại. */
    const handleClear = react.useCallback(
      async (clearedId: string): Promise<void> => {
        if ((await runAction(onClear))?.ok === true) setClearedGoalId(clearedId);
      },
      [onClear, runAction],
    );

    if (goal === undefined || goal === null || goal.phase === "complete" || goal.id === clearedGoalId) return null;

    if (editing) {
      return react.jsx("div", {
        className: BAR_CLASS.dock,
        "data-goal-bar": true,
        children: react.jsxs("div", {
          className: BAR_CLASS.bar + " " + BAR_CLASS.editBar,
          children: [
            react.jsx(primitives.InlineEditor, {
              value: draft,
              label: t("objective.aria"),
              onChange: setDraft,
              onSave: () => {
                handleEdit();
              },
              onCancel: () => {
                setEditing(false);
              },
            }),
            actionError !== null &&
              react.jsx("span", { className: BAR_CLASS.error, role: "alert", children: actionError }),
            react.jsxs("div", {
              className: BAR_CLASS.actions,
              children: [
                react.jsx(primitives.Tooltip, {
                  portal: true,
                  label: t("action.save"),
                  side: "bottom",
                  delayMs: 500,
                  children: react.jsx("button", {
                    type: "button",
                    className: BAR_CLASS.iconBtn,
                    onClick: () => {
                      handleEdit();
                    },
                    disabled: pending || draft.trim() === "",
                    "aria-label": t("action.save"),
                    children: react.jsx(primitives.IconCheckOutlineRegular, { size: 14 }),
                  }),
                }),
                react.jsx(primitives.Tooltip, {
                  portal: true,
                  label: t("action.cancel"),
                  side: "bottom",
                  delayMs: 500,
                  children: react.jsx("button", {
                    type: "button",
                    className: BAR_CLASS.iconBtn,
                    onClick: () => {
                      setEditing(false);
                    },
                    disabled: pending,
                    "aria-label": t("action.cancel"),
                    children: react.jsx(primitives.IconCloseOutlineRegular, { size: 14 }),
                  }),
                }),
              ],
            }),
          ],
        }),
      });
    }

    const title = goal.phase === "blocked" ? goal.blockedReason?.message : undefined;
    const label = goal.phase === "active" ? activeLabel(activation, t) : t(PHASE_LABELS[goal.phase as "paused" | "blocked"]);
    const showResume = goal.phase === "paused" || (goal.phase === "active" && activation === "disarmed");
    return react.jsx("div", {
      className: BAR_CLASS.dock,
      "data-goal-bar": true,
      children: react.jsxs("div", {
        className: BAR_CLASS.bar,
        title,
        children: [
          react.jsx("span", {
            className: BAR_CLASS.goalGlyph,
            children: react.jsx(primitives.IconGoalOutlineRegular, { size: 14 }),
          }),
          react.jsx("span", { className: BAR_CLASS.label, children: label }),
          react.jsx("span", { className: BAR_CLASS.objective, children: goal.objective }),
          actionError !== null && react.jsx("span", { className: BAR_CLASS.error, role: "alert", children: actionError }),
          react.jsxs("div", {
            className: BAR_CLASS.actions,
            children: [
              goal.phase === "active" &&
                activation === "armed" &&
                react.jsx(primitives.Tooltip, {
                  portal: true,
                  label: t("action.pause"),
                  side: "bottom",
                  delayMs: 500,
                  children: react.jsx("button", {
                    type: "button",
                    className: BAR_CLASS.iconBtn,
                    disabled: pending,
                    onClick: () => {
                      runAction(onPause);
                    },
                    "aria-label": t("action.pause"),
                    children: react.jsx(primitives.IconPauseOutlineRegular, { size: 14 }),
                  }),
                }),
              showResume &&
                react.jsx(primitives.Tooltip, {
                  portal: true,
                  label: t("action.resume"),
                  side: "bottom",
                  delayMs: 500,
                  children: react.jsx("button", {
                    type: "button",
                    className: BAR_CLASS.iconBtn,
                    disabled: pending,
                    onClick: () => {
                      runAction(onResume);
                    },
                    "aria-label": t("action.resume"),
                    children: react.jsx(primitives.IconPlayOutlineRegular, { size: 14 }),
                  }),
                }),
              react.jsx(primitives.Tooltip, {
                portal: true,
                label: t("action.edit"),
                side: "bottom",
                delayMs: 500,
                children: react.jsx("button", {
                  type: "button",
                  className: BAR_CLASS.iconBtn,
                  disabled: pending,
                  onClick: () => {
                    setDraft(goal.objective);
                    setEditing(true);
                  },
                  "aria-label": t("action.edit"),
                  children: react.jsx(primitives.IconEditOutlineRegular, { size: 14 }),
                }),
              }),
              react.jsx(primitives.Tooltip, {
                portal: true,
                label: t("action.clear"),
                side: "bottom",
                delayMs: 500,
                children: react.jsx("button", {
                  type: "button",
                  className: BAR_CLASS.iconBtn,
                  disabled: pending,
                  onClick: () => {
                    handleClear(goal.id);
                  },
                  "aria-label": t("action.clear"),
                  children: react.jsx(primitives.IconTrashOutlineRegular, { size: 14 }),
                }),
              }),
            ],
          }),
        ],
      }),
    });
  }

  /**
   * Bộ ghép cho dock: phủ trạng thái kích hoạt cục bộ lên projection bền.
   * Nhận: hook projection, hook kích hoạt, bốn động từ và hàm đọc từ điển.
   * Trả: element của dải mục tiêu.
   */
  function GoalDock(props: GoalDockProps): unknown {
    const { useProjection, useGoalActivation, onEdit, onPause, onResume, onClear, t } = props;
    const projection = useProjection("goal");
    const goal = projection === undefined || projection === null ? projection : projection.goal;
    const goalId = goal?.id;
    const revision = goal?.revision;
    const activation = useGoalActivation((next) => (next.id === goalId && next.revision === revision ? next.activation : undefined));
    return react.jsx(GoalBar, {
      goal,
      ...(activation === undefined ? {} : { activation }),
      onEdit,
      onPause,
      onResume,
      onClear,
      t,
    });
  }

  return { GoalBar, GoalDock };
}
