/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc TeamAction — action trên header phiên hội thoại (roster + bảng việc CHỈ ĐỌC): port 1:1 vùng
 *      TeamAction.js của bundle gốc (@deepseek-ai/dsh-experimental-client-ui-agent-team, dòng 88-391).
 *      React/portal/primitive KHÔNG import — plugin bơm qua require (xem createPlugin ở client.ts).
 */

import { TEAM_ACTION_CLASS as css } from "./class-names.ts";
import type {
  TeamActionProps,
  TeamComponentRuntime,
  TeamMember,
  TeamMemberStatus,
  TeamProjection,
  TeamSessionSnapshot,
  TeamSessionStore,
  TeamTask,
  TeamTranslate,
} from "./team-types.ts";
import { memberDotState, memberStatusKey, statusKey, taskDotState } from "./team-types.ts";

/** Props nội bộ của một dòng thành viên. */
interface TeamMemberRowProps {
  /** Thành viên cần vẽ. */
  readonly member: TeamMember;
  /** Tổng số thành viên (để biết có tô sáng phiên hiện tại không). */
  readonly memberCount: number;
  /** Phiên đang mở. */
  readonly sessionId: string;
  /** Chọn lát từ store TẤT CẢ phiên. */
  readonly useSessions: (selector: (state: TeamSessionStore) => unknown) => unknown;
  /** Chọn trạng thái sống của một phiên. */
  readonly useSessionStatus: (selector: (state: TeamSessionStore) => unknown) => unknown;
  /** Mở phiên thành viên. */
  readonly openTeammate: (sessionId: string, childSessionId: string) => void;
  /** Báo lỗi mở phiên lên khối lỗi của bảng. */
  readonly onError: (message: string) => void;
  /** Hàm dịch. */
  readonly t: TeamTranslate;
}

/** Props nội bộ của một thẻ việc. */
interface TaskCardProps {
  /** Việc cần vẽ. */
  readonly task: TeamTask;
  /** Hàm dịch. */
  readonly t: TeamTranslate;
}

/** Thành phần do factory sinh ra. */
export interface TeamComponents {
  /** Action đầy đủ (nút + bảng nổi). */
  TeamAction: (props: TeamActionProps) => unknown;
  /** Một dòng thành viên. */
  TeamMemberRow: (props: TeamMemberRowProps) => unknown;
  /** Một thẻ việc. */
  TaskCard: (props: TaskCardProps) => unknown;
}

/**
 * Dựng bộ component TeamAction trên một runtime React/primitive cụ thể (bản gốc làm y hệt nhưng nhận
 * require của loader; đây là cùng một cây element, chỉ khác cách lấy react).
 * Nhận: runtime — react hooks, jsx/jsxs, Fragment, createPortal, primitive.
 * Trả: ba component dùng được ngay.
 */
export function createTeamAction(runtime: TeamComponentRuntime): TeamComponents {
  const { react, jsx, jsxs, Fragment, createPortal, primitives } = runtime;
  const { useState, useRef, useEffect, useLayoutEffect } = react;

  /**
   * Một dòng thành viên: dot/icon trạng thái + tên + tag hiện tại + trạng thái + lỗi riêng.
   * Nhận: props — thành viên, ngữ cảnh store, hàm mở phiên, hàm dịch.
   * Trả: element (Tooltip bọc button).
   */
  function TeamMemberRow({ member, memberCount, sessionId, useSessions, useSessionStatus, openTeammate, onError, t }: TeamMemberRowProps): unknown {
    const running = useSessionStatus((state) => state.get(member.id)?.running);
    const summaryRunning = useSessions((state) => state.byId[member.id]?.running);
    const status: TeamMemberStatus = member.phase === "active" ? ((running ?? summaryRunning) === true ? "running" : "inactive") : member.phase;
    const isCurrent = member.id === sessionId;
    const highlightCurrent = isCurrent && memberCount > 1;
    const inert = isCurrent || status === "failed" || status === "provisioning";
    return jsx(primitives.Tooltip, {
      label: t("open"),
      side: "bottom",
      gap: 4,
      disabled: inert,
      children: jsxs("button", {
        type: "button",
        className: highlightCurrent ? css.member + " " + css.memberCurrent : css.member,
        disabled: inert,
        onClick: () => {
          try {
            openTeammate(sessionId, member.id);
          } catch (reason) {
            onError(String(reason));
          }
        },
        children: [
          jsx("span", {
            className: css.memberDot,
            children: status === "inactive"
              ? jsx(primitives.IconUserOutlineRegular, { size: 14, className: css.inactiveIcon })
              : jsx(primitives.StateDot, { state: memberDotState(status) }),
          }),
          jsxs("span", {
            className: css.memberText,
            children: [
              jsxs("span", {
                className: css.memberName,
                children: [
                  jsx("span", { className: css.memberNameText, children: member.name }),
                  isCurrent && jsx(primitives.Tag, { tone: "info", className: css.currentTag, children: t("current") }),
                ],
              }),
              // 24/10/2026 — KHÔNG hiện " · Model: …" cạnh trạng thái thành viên nữa (yêu cầu của Lead:
              // dòng đó bị cắt cụt "deepseek-v…" và gây nhiễu khi rê chuột qua thẻ). Sai lệch CÓ CHỦ Ý so với
              // gói gốc — xem docs/adr/0017-an-model-teammate.md.
              jsx("small", { children: t(memberStatusKey(status)) }),
              member.error !== undefined && jsx("small", { className: css.diagnostic, children: member.error }),
            ],
          }),
        ],
      }),
    });
  }

  /**
   * Thẻ việc: tiêu đề + trạng thái, mô tả kẹp hai dòng, hàng meta (mở rộng, id, owner, phụ thuộc, scope).
   * Nhận: props — việc và hàm dịch.
   * Trả: element (article).
   */
  function TaskCard({ task, t }: TaskCardProps): unknown {
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);
    const textRef = useRef<{ scrollHeight: number; clientHeight: number } | null>(null);
    useLayoutEffect(() => {
      if (expanded) return;
      const paragraph = textRef.current;
      if (paragraph === null) return;
      const measure = (): void => {
        setClamped(paragraph.scrollHeight > paragraph.clientHeight + 1);
      };
      measure();
      if (typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(measure);
      observer.observe(paragraph as unknown as Element);
      return () => {
        observer.disconnect();
      };
    }, [task.description, expanded]);
    return jsxs("article", {
      className: css.task,
      children: [
        jsxs("div", {
          className: css.taskTitle,
          children: [
            jsx("strong", { children: task.subject }),
            jsxs("span", {
              className: css.taskState,
              children: [
                jsx(primitives.StateDot, { state: taskDotState(task) }),
                jsx("span", { children: t(statusKey(task.status)) }),
              ],
            }),
          ],
        }),
        jsx("p", {
          ref: textRef,
          className: expanded ? undefined : css.clampedDescription,
          children: task.description,
        }),
        jsxs("div", {
          className: css.meta,
          children: [
            (clamped || expanded) && jsxs("button", {
              type: "button",
              className: css.expandToggle,
              "aria-expanded": expanded,
              onClick: () => {
                setExpanded((current) => !current);
              },
              children: [
                t(expanded ? "task.collapse" : "task.expand"),
                jsx(primitives.IconChevronDownOutlineRegular, { size: 12, className: expanded ? css.expandToggleOpen : undefined }),
              ],
            }),
            jsx("span", { children: task.id }),
            jsxs("span", { children: [t("owner"), ": ", task.ownerName ?? t("unowned")] }),
            task.status === "pending" && jsx("span", { children: task.ready ? t("ready") : t("blocked") }),
            task.blockedBy.length > 0 && jsxs("span", { children: [t("blockedBy"), ": ", task.blockedBy.join(", ")] }),
            task.writeScopes.length > 0 && jsxs("span", { children: [t("writeScopes"), ": ", task.writeScopes.join(", ")] }),
            task.writeScopeWarnings.map((warning) => jsx("span", { className: css.warning, children: warning }, warning)),
          ],
        }),
      ],
    });
  }

  /**
   * Action đầy đủ: nút mở bảng (hover 150ms hoặc bấm để ghim) và bảng nổi portal vào body.
   * Nhận: props — phiên, hook store, hàm mở phiên, hàm dịch.
   * Trả: element (div gốc chứa trigger + portal).
   */
  function TeamAction({ sessionId, useSession, useSessions, useSessionStatus, openTeammate, t }: TeamActionProps): unknown {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const rootRef = useRef<unknown>(null);
    const triggerRef = useRef<unknown>(null);
    const triggerLabelRef = useRef<unknown>(null);
    const panelRef = useRef<unknown>(null);
    const position = primitives.useAnchoredPosition({ open, anchorRef: triggerRef, panelRef, gap: 5, margin: 16 });
    const positioned = position !== null;
    const leadSessionId = (useSession((snapshot: TeamSessionSnapshot) => snapshot.subagent?.address?.parentSessionId) ?? sessionId) as string;
    const team = useSessions((state) => state.projectionsBySession[leadSessionId]?.values.agentTeam) as TeamProjection | undefined;
    const opening = (useSession((snapshot: TeamSessionSnapshot) => snapshot.openState === "loading") ?? false) as boolean;
    const listing = (useSessions((state) => state.phase === "pending") ?? false) as boolean;
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pinnedRef = useRef(false);
    const cancelHoverChange = (): void => {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = undefined;
    };
    useEffect(() => {
      cancelHoverChange();
      pinnedRef.current = false;
      setOpen(false);
      setError(null);
    }, [sessionId]);
    useEffect(() => cancelHoverChange, []);
    useLayoutEffect(() => {
      if (open && positioned && pinnedRef.current) (panelRef.current as { focus?: () => void } | null)?.focus?.();
    }, [open, positioned]);
    const changeOpen = (next: boolean): void => {
      cancelHoverChange();
      if (!next) pinnedRef.current = false;
      setOpen(next);
    };
    const scheduleHoverOpen = (): void => {
      cancelHoverChange();
      if (open) return;
      const label = triggerLabelRef.current as { style?: unknown } | null;
      if (label === null) return;
      if (getComputedStyle(label as unknown as Element).display === "none") return;
      hoverTimer.current = setTimeout(() => {
        hoverTimer.current = undefined;
        changeOpen(true);
      }, 150);
    };
    const scheduleHoverClose = (): void => {
      cancelHoverChange();
      if (pinnedRef.current) return;
      hoverTimer.current = setTimeout(() => {
        hoverTimer.current = undefined;
        changeOpen(false);
      }, 120);
    };
    primitives.useDismissOnOutsidePointer(rootRef, open, changeOpen, panelRef);
    useEffect(() => {
      if (!open) return;
      const dismiss = (event: KeyboardEvent): void => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        cancelHoverChange();
        pinnedRef.current = false;
        setOpen(false);
        const panel = panelRef.current as { contains?: (node: unknown) => boolean } | null;
        if (panel?.contains?.(document.activeElement) === true) (triggerRef.current as { focus?: () => void } | null)?.focus?.();
      };
      document.addEventListener("keydown", dismiss);
      return () => {
        document.removeEventListener("keydown", dismiss);
      };
    }, [open]);
    const compact = team !== undefined && team.members.length === 1 && team.tasks.length === 0;
    return jsxs("div", {
      ref: rootRef,
      className: css.root,
      "data-team-action": true,
      onMouseLeave: scheduleHoverClose,
      children: [
        jsxs("button", {
          type: "button",
          ref: triggerRef,
          onMouseEnter: scheduleHoverOpen,
          className: css.trigger,
          "aria-label": t("trigger"),
          "aria-haspopup": "dialog",
          "aria-expanded": open,
          onClick: () => {
            cancelHoverChange();
            pinnedRef.current = true;
            if (!open) changeOpen(true);
            else (panelRef.current as { focus?: () => void } | null)?.focus?.();
          },
          children: [
            jsx(primitives.IconUsersOutlineRegular, { size: 14 }),
            jsx("span", { ref: triggerLabelRef, className: css.triggerLabel, children: t("trigger") }),
          ],
        }),
        open && createPortal(jsx("div", {
          ref: panelRef,
          className: compact ? css.panel + " " + css.panelCompact : css.panel,
          style: position ?? { visibility: "hidden", left: 0, top: 0 },
          role: "dialog",
          tabIndex: -1,
          "aria-label": t("trigger"),
          "data-team-panel": true,
          onMouseEnter: cancelHoverChange,
          onMouseLeave: scheduleHoverClose,
          children: jsxs("div", {
            className: css.body,
            children: [
              error !== null && jsxs("div", {
                className: css.error,
                role: "alert",
                children: [jsx(primitives.StateDot, { state: "error" }), error],
              }),
              team === undefined && jsxs("div", {
                className: css.notice,
                role: "status",
                children: [jsx(primitives.StateDot, { state: opening || listing ? "ongoing" : "warning" }), t(opening || listing ? "loading" : "unavailable")],
              }),
              team !== undefined && jsxs(Fragment, {
                children: [
                  team.failure !== undefined && jsxs("div", {
                    className: css.error,
                    role: "alert",
                    children: [jsx(primitives.StateDot, { state: "error" }), t("failure", { message: team.failure })],
                  }),
                  jsxs("section", {
                    children: [
                      jsxs("h3", {
                        children: [
                          t("roster"),
                          team.members.length > 1 && jsx("span", { className: css.count, children: team.members.length }),
                        ],
                      }),
                      jsx("div", {
                        className: css.roster,
                        children: team.members.map((member) => jsx(TeamMemberRow, {
                          member,
                          memberCount: team.members.length,
                          sessionId,
                          useSessions,
                          useSessionStatus,
                          openTeammate,
                          onError: setError,
                          t,
                        }, member.id)),
                      }),
                    ],
                  }),
                  jsx("section", {
                    children: team.tasks.length === 0
                      ? jsx("p", { className: css.emptyNotice, children: t("empty") })
                      : jsxs(Fragment, {
                        children: [
                          jsxs("h3", { children: [t("tasks"), jsx("span", { className: css.count, children: team.tasks.length })] }),
                          jsx("div", { className: css.tasks, children: team.tasks.map((task) => jsx(TaskCard, { task, t }, task.id)) }),
                        ],
                      }),
                  }),
                ],
              }),
            ],
          }),
        }), document.body),
      ],
    });
  }

  return { TeamAction, TeamMemberRow, TaskCard };
}
