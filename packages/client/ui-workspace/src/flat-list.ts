/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc FlatList + SearchResults — hai than danh sach dung AnimatedRows cua trinh duyet workspace
 */

import { clsx } from "./clsx.ts";
import { workspaceBrowserStyles } from "./css.ts";
import { deriveFlat, deriveSearchResults } from "./derive.ts";
import { FLAT_SESSION_ORDER_KEY } from "./ids.ts";
import { ext, h, hs, type Dyn } from "./runtime.ts";
import { SessionNodeItem, SearchResultItem } from "./rows.ts";
import { EmptySessions, sessionDragOrder, useNativeDragAcceptance } from "./views.ts";

/**
 * Than danh sach phang "trong mot danh sach": moi phien la mot dong cap cao keo duoc.
 * Nhan: props — list, sessionIds, rowState, onLeaveArchivedOnly, useSessionStatus, usePanelInfo, open, onSessionRenameRequest, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, renderSlot, t, AnimatedRows.
 * Tra: node than danh sach.
 */
export function FlatList(props: Dyn): Dyn {
  const { list, sessionIds, rowState, onLeaveArchivedOnly, useSessionStatus, open, onSessionRenameRequest, usePanelInfo, setSessionOrder, workspaceReady, animationResetKey, revealSessionId, onSessionRevealed, renderSlot, t, AnimatedRows } = props;
  const panelActive = usePanelInfo((info: Dyn) => info.activePanelId !== null);
  const statuses = useSessionStatus((s: Dyn) => s);
  const rows = ext.react.useMemo(() => deriveFlat(list, sessionIds, rowState, statuses), [list, sessionIds, rowState, statuses]);
  const [drag, setDrag] = ext.react.useState(null);
  const dropCommitted = ext.react.useRef(false);
  useNativeDragAcceptance(drag !== null);
  const currentId = panelActive ? undefined : Object.values(list.byId as Record<string, Dyn>).find((session: Dyn) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  const commitDrag = (activeDrag: Dyn, over: Dyn): void => {
    if (dropCommitted.current) return;
    dropCommitted.current = true;
    setDrag(null);
    const nextOrder = sessionDragOrder(sessionIds, rows, activeDrag, over);
    if (nextOrder !== undefined) setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder);
  };
  const now = Date.now();
  return hs(ext.primitives.HoverCardGroup, {
    className: clsx(workspaceBrowserStyles.treeBody, workspaceBrowserStyles.wide),
    children: [
      hs(AnimatedRows, {
        className: clsx(workspaceBrowserStyles.list, workspaceBrowserStyles.flatList),
        label: t("section.sessions"),
        rowKeys: rows.length === 0 ? ["empty"] : rows.map((row: Dyn) => "session:" + String(row.id)),
        ready: list.phase === "ready" && workspaceReady && drag === null,
        resetKey: animationResetKey,
        children: [
          rows.length === 0 && h(EmptySessions, { rowState, onLeaveArchivedOnly, t }),
          rows.map((node: Dyn) => {
            const active = drag !== null && drag.pinned === node.pinned;
            const normalizeHalf = (half: string): string => (node.blank ? "after" : half);
            return h(
              SessionNodeItem,
              {
                node,
                currentId,
                now,
                onOpen: open,
                onRenameRequest: onSessionRenameRequest,
                renderSlot,
                onReveal:
                  node.id === revealSessionId
                    ? () => {
                        onSessionRevealed(node.id);
                      }
                    : undefined,
                drag: {
                  start: () => {
                    dropCommitted.current = false;
                    setDrag({ accountKey: FLAT_SESSION_ORDER_KEY, sessionId: node.id, pinned: node.pinned, over: null });
                  },
                  active,
                  marker: active && drag.over?.id === node.id ? drag.over.half : null,
                  hover: (half: string) => {
                    setDrag((current: Dyn) => (current === null ? current : { ...current, over: { id: node.id, half: normalizeHalf(half) } }));
                  },
                  drop: (half: string) => {
                    if (drag !== null) commitDrag(drag, { id: node.id, half: normalizeHalf(half) });
                  },
                  end: () => {
                    if (drag?.over !== null && drag?.over !== undefined) commitDrag(drag, drag.over);
                    else setDrag(null);
                    dropCommitted.current = false;
                  },
                },
                t,
              },
              node.id,
            );
          }),
        ],
      }),
      h("span", { className: workspaceBrowserStyles.fade }),
    ],
  });
}

/**
 * Than tim kiem phang: ket qua khop metadata cuc bo cong trang ket qua noi dung cua Host.
 * Nhan: props — useSessions, useSessionStatus, usePanelInfo, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, t.
 * Tra: node than tim kiem.
 */
export function SearchResults({ useSessions, useSessionStatus, open, onUnarchive, workspaces, archivedSessionIds, archivedFilter, query, remote, resultLimit, usePanelInfo, t }: Dyn): Dyn {
  const panelActive = usePanelInfo((info: Dyn) => info.activePanelId !== null);
  const list = useSessions((s: Dyn) => s);
  const statuses = useSessionStatus((s: Dyn) => s);
  const currentRemote = remote.query === query ? remote : { query, status: "loading", items: [], hasMore: false };
  const results = ext.react.useMemo(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit), [list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit]);
  const pending = currentRemote.status === "loading";
  const currentId = panelActive ? undefined : Object.values(list.byId as Record<string, Dyn>).find((session: Dyn) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  return hs("div", {
    className: clsx(workspaceBrowserStyles.treeBody, workspaceBrowserStyles.wide),
    children: [
      hs("div", {
        className: workspaceBrowserStyles.list,
        children: [
          h("div", {
            className: workspaceBrowserStyles.searchTree,
            role: "tree",
            "aria-label": t("search.results.aria"),
            children: results.items.map((result: Dyn) => h(SearchResultItem, { result, currentId, onOpen: open, onUnarchive, t }, result.id)),
          }),
          pending &&
            h("div", {
              role: "status",
              "aria-label": t("search.pending"),
              children: (results.items.length === 0 ? [0, 1] : [0]).map((i: number) =>
                hs(
                  "div",
                  {
                    className: workspaceBrowserStyles.skeletonRow,
                    "aria-hidden": "true",
                    children: [
                      h("span", { className: workspaceBrowserStyles.skeletonDot }),
                      hs("span", { className: workspaceBrowserStyles.skeletonBars, children: [h("span", { className: workspaceBrowserStyles.skeletonBar }), h("span", { className: clsx(workspaceBrowserStyles.skeletonBar, workspaceBrowserStyles.skeletonBarWide) })] }),
                    ],
                  },
                  i,
                ),
              ),
            }),
          !pending && results.items.length === 0 && h("div", { className: workspaceBrowserStyles.empty, children: t("search.noMatches") }),
          results.hasMore && h("div", { className: workspaceBrowserStyles.searchStatus, children: t("search.hasMore", { n: resultLimit }) }),
        ],
      }),
      h("span", { className: workspaceBrowserStyles.fade }),
    ],
  });
}
