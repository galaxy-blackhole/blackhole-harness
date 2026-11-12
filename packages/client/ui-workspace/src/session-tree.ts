/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc SessionTree — cay phien theo workspace voi AnimatedRows (lop phu Qg_5Eq_exits) — nguyen cau truc ban goc
 */

import { clsx } from "./clsx.ts";
import { workspaceBrowserStyles } from "./css.ts";
import { deriveGroups } from "./derive.ts";
import { FLAT_SESSION_ORDER_KEY, SESSION_WATERMARK_BASE } from "./ids.ts";
import { owningGroupKey, owningParentFolder } from "./paths.ts";
import { ext, h, hs, type Dyn } from "./runtime.ts";
import { ProjectRowItem, SessionNodeItem } from "./rows.ts";
import { EmptySessions, raiseWatermarks, requiredWatermark, sessionDragOrder as sessionDragOrderImport, useNativeDragAcceptance, watermarkRows, workspaceGroupHalf } from "./views.ts";

/**
 * Than cuon cua cay phien: nhom theo workspace, moi phien mot dong cap cao, kem watermark va keo tha.
 * Nhan: props — list, workspaces, rowState, useSessionStatus, usePanelInfo, renderSlot, groupExpansion, setGroupExpanded, setSessionOrder, home, t, shortcuts, revealSessionId, onSessionRevealed, nestWorkspaces, workspaceReady, animationResetKey, insertWorkspaceBefore, startSession, open, onRenameRequest, onDeleteRequest, onSessionRenameRequest, ungroupedSessionIds, onLeaveArchivedOnly, AnimatedRows.
 * Tra: node than cay.
 */
export function SessionTree(props: Dyn): Dyn {
  const { list, useSessionStatus, startSession, open, workspaces, ungroupedSessionIds, rowState, onLeaveArchivedOnly, workspaceReady, animationResetKey, usePanelInfo, onRenameRequest, onDeleteRequest, onSessionRenameRequest, renderSlot, insertWorkspaceBefore, nestWorkspaces, groupExpansion, setGroupExpanded, setSessionOrder, home, t, revealSessionId, onSessionRevealed, shortcuts, AnimatedRows } = props;
  const panelActive = usePanelInfo((info: Dyn) => info.activePanelId !== null);
  const statuses = useSessionStatus((s: Dyn) => s);
  const current = panelActive ? undefined : Object.values(list.byId as Record<string, Dyn>).find((session: Dyn) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  const revealGroup = revealSessionId === undefined || !workspaceReady ? undefined : owningGroupKey(workspaces, revealSessionId);
  const [storedWatermarks, setStoredWatermarks] = ext.react.useState({});
  const [watermarkMotionKey, setWatermarkMotionKey] = ext.react.useState(0);
  const [drag, setDrag] = ext.react.useState(null);
  const sessionDropCommitted = ext.react.useRef(false);
  const [workspaceDrag, setWorkspaceDrag] = ext.react.useState(null);
  const workspaceDropCommitted = ext.react.useRef(false);
  const nativeDragActive = drag !== null || workspaceDrag !== null;
  useNativeDragAcceptance(nativeDragActive);
  const currentGroup = current === undefined || !workspaceReady ? undefined : owningGroupKey(workspaces, current);
  ext.react.useEffect(() => {
    if (current === undefined || currentGroup === undefined || Object.hasOwn(groupExpansion, currentGroup)) return;
    setGroupExpanded(currentGroup, true);
  }, [current, currentGroup, setGroupExpanded, groupExpansion]);
  const parents = ext.react.useMemo(() => {
    if (!nestWorkspaces) return new Map();
    const keysByPath = new Map(workspaces.map((workspace: Dyn) => [workspace.path, workspace.workspaceId]));
    const paths = [...keysByPath.keys()];
    return new Map(
      workspaces.map((workspace: Dyn) => {
        const path = owningParentFolder(workspace.path, paths as string[]);
        return [workspace.workspaceId, path === undefined ? undefined : keysByPath.get(path)];
      }),
    );
  }, [nestWorkspaces, workspaces]);
  const currentAncestors = ext.react.useMemo(() => {
    const keys = new Set();
    for (let key = currentGroup === undefined ? undefined : parents.get(currentGroup); key !== undefined; key = parents.get(key)) keys.add(key);
    return keys;
  }, [currentGroup, parents]);
  const expandedGroups = ext.react.useMemo(() => {
    const ancestorKeys = new Set(parents.values());
    return [...workspaces.map((workspace: Dyn) => workspace.workspaceId), ""].filter((key: string) => groupExpansion[key] ?? ancestorKeys.has(key));
  }, [groupExpansion, parents, workspaces]);
  const groups = ext.react.useMemo(() => deriveGroups(list, workspaces, rowState, statuses, { expandedGroups, ungroupedOrder: ungroupedSessionIds }), [list, workspaces, rowState, statuses, expandedGroups, ungroupedSessionIds]);
  ext.react.useEffect(() => {
    for (let key = revealGroup; key !== undefined; key = parents.get(key)) if (groupExpansion[key] === false || (key === revealGroup && groupExpansion[key] !== true)) setGroupExpanded(key, true);
  }, [groupExpansion, parents, revealGroup, setGroupExpanded]);
  const baselines: Map<string, number> = new Map(groups.map((group: Dyn) => [group.key as string, Math.max(SESSION_WATERMARK_BASE, requiredWatermark(group.sessions, current, group.key === revealGroup ? revealSessionId : undefined))] as [string, number]));
  const foldedKeys = new Set(groups.filter((group: Dyn) => !group.expanded).map((group: Dyn) => group.key));
  const underFoldedAncestor = (key: string): boolean => {
    for (let owner = parents.get(key); owner !== undefined; owner = parents.get(owner)) if (foldedKeys.has(owner)) return true;
    return false;
  };
  const requiredWatermarks = new Map([...baselines].filter(([key]) => !underFoldedAncestor(key as string)) as [string, number][]);
  const sessionWatermarks = raiseWatermarks(storedWatermarks, requiredWatermarks);
  if (sessionWatermarks !== storedWatermarks) setStoredWatermarks((marks: Record<string, number>) => raiseWatermarks(marks, requiredWatermarks));
  const dropWatermarks = (drop: (key: string) => boolean): void => {
    if (!Object.keys(storedWatermarks).some(drop)) return;
    setStoredWatermarks((marks: Record<string, number>) => Object.fromEntries(Object.entries(marks).filter(([key]) => !drop(key))));
    setWatermarkMotionKey((key: number) => key + 1);
  };
  const withinGroup = (key: string, root: string): boolean => {
    for (let owner = key; owner !== undefined; owner = parents.get(owner)) if (owner === root) return true;
    return false;
  };
  const now = Date.now();
  const commitSessionDrag = (activeDrag: Dyn, over: Dyn): void => {
    if (sessionDropCommitted.current) return;
    sessionDropCommitted.current = true;
    setDrag(null);
    const group = groups.find((candidate: Dyn) => candidate.key === activeDrag.accountKey);
    if (group === undefined) return;
    if (over.id === activeDrag.sessionId) return;
    const accountSessionIds = activeDrag.accountKey === "" ? ungroupedSessionIds : workspaces.find((workspace: Dyn) => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
    if (accountSessionIds === undefined) return;
    const renderedSessions = watermarkRows(group.sessions, sessionWatermarks[group.key] ?? SESSION_WATERMARK_BASE).rows;
    const nextOrder = sessionDragOrderImport(accountSessionIds, renderedSessions, activeDrag, over);
    if (nextOrder !== undefined) setSessionOrder(activeDrag.accountKey, nextOrder);
  };
  const commitWorkspaceDrag = (activeDrag: Dyn, over: Dyn): void => {
    if (workspaceDropCommitted.current) return;
    workspaceDropCommitted.current = true;
    setWorkspaceDrag(null);
    const owner = parents.get(activeDrag.workspaceId);
    const siblings = workspaces.filter((workspace: Dyn) => parents.get(workspace.workspaceId) === owner);
    const rowIndex = siblings.findIndex((workspace: Dyn) => workspace.workspaceId === over.id);
    if (rowIndex === -1) return;
    const anchor = over.half === "before" ? over.id : siblings[rowIndex + 1]?.workspaceId;
    if (anchor === activeDrag.workspaceId) return;
    const sourceIndex = siblings.findIndex((workspace: Dyn) => workspace.workspaceId === activeDrag.workspaceId);
    const anchorIndex = anchor === undefined ? siblings.length : siblings.findIndex((workspace: Dyn) => workspace.workspaceId === anchor);
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
    insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason: unknown) => {
      console.warn("workspace reorder rejected:", reason);
    });
  };
  const childrenByParent = ext.react.useMemo(() => {
    const rendered = new Set(groups.map((group: Dyn) => group.key));
    const children = new Map();
    for (const group of groups) {
      let parent = parents.get(group.key);
      while (parent !== undefined && !rendered.has(parent)) parent = parents.get(parent);
      const siblings = children.get(parent);
      if (siblings === undefined) children.set(parent, [group]);
      else siblings.push(group);
    }
    return children;
  }, [groups, parents]);
  const rootGroups = childrenByParent.get(undefined) ?? [];
  const workspaceDropAtListStart = rootGroups[0]?.workspaceId !== undefined && workspaceDrag?.over?.id === rootGroups[0].workspaceId && workspaceDrag.over.half === "before";
  const rowKeys: string[] = groups.length === 0 ? ["empty"] : [];
  const renderGroup = (group: Dyn, depth: number): Dyn => {
    const workspaceId = group.workspaceId;
    const children = childrenByParent.get(group.key) ?? [];
    const compatibleDrag = workspaceDrag !== null && parents.get(workspaceDrag.workspaceId) === parents.get(group.key);
    const watermark = sessionWatermarks[group.key] ?? SESSION_WATERMARK_BASE;
    const collapsed = watermarkRows(group.sessions, baselines.get(group.key) ?? SESSION_WATERMARK_BASE);
    const visible = watermarkRows(group.sessions, watermark);
    const sessionsExpanded = visible.hiddenCount === 0;
    rowKeys.push("workspace:" + String(group.key));
    const childRows = group.expanded ? children.map((child: Dyn) => renderGroup(child, depth + 1)) : [];
    const sessions = visible.rows;
    for (const node of sessions) rowKeys.push("session:" + String(node.id));
    if (collapsed.hiddenCount > 0) rowKeys.push("overflow:" + String(group.key));
    const workspaceMarker = workspaceId !== undefined && workspaceDrag?.over?.id === workspaceId ? workspaceDrag.over.half : null;
    const workspaceDragProps =
      workspaceId === undefined
        ? undefined
        : {
            start: () => {
              workspaceDropCommitted.current = false;
              setWorkspaceDrag({ workspaceId, over: null });
            },
            end: () => {
              if (workspaceDrag?.over !== null && workspaceDrag?.over !== undefined) commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
              else setWorkspaceDrag(null);
              workspaceDropCommitted.current = false;
            },
          };
    const hoverWorkspace =
      workspaceId === undefined || !compatibleDrag
        ? undefined
        : (half: string) => {
            setWorkspaceDrag((active: Dyn) => (active === null ? active : { ...active, over: { id: workspaceId, half } }));
          };
    const dropWorkspace =
      workspaceId === undefined || !compatibleDrag
        ? undefined
        : (half: string) => {
            commitWorkspaceDrag(workspaceDrag, { id: workspaceId, half });
          };
    return hs(
      "div",
      {
        style: { "--dsh-workspace-indent": String(depth * 12) + "px" },
        className: clsx(workspaceBrowserStyles.groupSection, workspaceMarker === "before" && workspaceBrowserStyles.workspaceDropBefore, workspaceMarker === "after" && workspaceBrowserStyles.workspaceDropAfter),
        onDragOver:
          workspaceDrag === null
            ? undefined
            : (e: Dyn) => {
                e.preventDefault();
                if (hoverWorkspace === undefined && parents.get(group.key) !== undefined) return;
                e.stopPropagation();
                if (hoverWorkspace === undefined) {
                  e.dataTransfer.dropEffect = "none";
                  if (workspaceDrag.over !== null) setWorkspaceDrag({ ...workspaceDrag, over: null });
                } else {
                  e.dataTransfer.dropEffect = "move";
                  hoverWorkspace(workspaceGroupHalf(e));
                }
              },
        onDrop:
          workspaceDrag === null
            ? undefined
            : (e: Dyn) => {
                e.preventDefault();
                if (dropWorkspace === undefined && parents.get(group.key) !== undefined) return;
                e.stopPropagation();
                if (dropWorkspace === undefined) {
                  workspaceDropCommitted.current = true;
                  setWorkspaceDrag(null);
                } else dropWorkspace(workspaceGroupHalf(e));
              },
        children: [
          h(ProjectRowItem, {
            newShortcut: shortcuts.find((row: Dyn) => row.id === "session.new"),
            group,
            containsCurrentDescendant: currentAncestors.has(group.key),
            home,
            t,
            onToggle: () => {
              if (group.expanded) dropWatermarks((key: string) => withinGroup(key, group.key));
              setGroupExpanded(group.key, !group.expanded);
            },
            onCreate: () => {
              if (group.workspaceId !== undefined) {
                setGroupExpanded(group.key, true);
                startSession(group.workspaceId);
              }
            },
            drag: workspaceDragProps,
            actions:
              group.workspaceId === undefined
                ? undefined
                : {
                    rename: () => {
                      if (group.workspaceId !== undefined) onRenameRequest(group.workspaceId, group.label);
                    },
                    delete: () => {
                      if (group.workspaceId !== undefined) onDeleteRequest(group.workspaceId, group.label);
                    },
                  },
          }),
          childRows.length > 0 && h("div", { role: "group", children: childRows }),
          sessions.map((node: Dyn) => {
            const sameGroupDrag = drag !== null && drag.accountKey === group.key;
            const compatibleTarget = sameGroupDrag && drag.pinned === node.pinned;
            const normalizeHalf = (half: string): string => (node.blank ? "after" : half);
            return h(
              SessionNodeItem,
              {
                node,
                currentId: current,
                now,
                onOpen: open,
                onRenameRequest: onSessionRenameRequest,
                renderSlot,
                onReveal:
                  node.id === revealSessionId && group.key === revealGroup
                    ? () => {
                        onSessionRevealed(node.id);
                      }
                    : undefined,
                drag: {
                  start: () => {
                    sessionDropCommitted.current = false;
                    setDrag({ accountKey: group.key, sessionId: node.id, pinned: node.pinned, over: null });
                  },
                  active: compatibleTarget,
                  marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
                  hover: (half: string) => {
                    setDrag((d: Dyn) => (d === null ? d : { ...d, over: { id: node.id, half: normalizeHalf(half) } }));
                  },
                  drop: (half: string) => {
                    if (drag === null) return;
                    commitSessionDrag(drag, { id: node.id, half: normalizeHalf(half) });
                  },
                  end: () => {
                    if (drag?.over !== null && drag?.over !== undefined) commitSessionDrag(drag, drag.over);
                    else setDrag(null);
                    sessionDropCommitted.current = false;
                  },
                },
                t,
              },
              node.id,
            );
          }),
          collapsed.hiddenCount > 0 &&
            h("button", {
              type: "button",
              className: workspaceBrowserStyles.sessionOverflowButton,
              "data-row-key": "overflow:" + String(group.key),
              "aria-expanded": sessionsExpanded,
              onClick: () => {
                if (sessionsExpanded) {
                  dropWatermarks((key: string) => key === group.key);
                  return;
                }
                setStoredWatermarks((marks: Record<string, number>) => ({ ...marks, [group.key]: visible.hiddenCount <= SESSION_WATERMARK_BASE ? Infinity : watermark + SESSION_WATERMARK_BASE }));
                setWatermarkMotionKey((key: number) => key + 1);
              },
              children: sessionsExpanded ? t("sessions.collapse") : t("sessions.expand", { n: visible.hiddenCount }),
            }),
        ],
      },
      group.key,
    );
  };
  const groupRows = rootGroups.map((group: Dyn) => renderGroup(group, 0));
  return hs(ext.primitives.HoverCardGroup, {
    className: clsx(workspaceBrowserStyles.treeBody, workspaceBrowserStyles.wide),
    children: [
      workspaceDropAtListStart && h("span", { className: workspaceBrowserStyles.listTopDropIndicator, "aria-hidden": "true" }),
      hs(AnimatedRows, {
        className: clsx(workspaceBrowserStyles.list, workspaceDropAtListStart && workspaceBrowserStyles.listTopDropActive),
        label: t("section.sessions"),
        rowKeys,
        ready: list.phase === "ready" && workspaceReady && !nativeDragActive,
        resetKey: JSON.stringify([animationResetKey, watermarkMotionKey]),
        children: [groups.length === 0 && h(EmptySessions, { rowState, onLeaveArchivedOnly, t }), groupRows],
      }),
      h("span", { className: workspaceBrowserStyles.fade }),
    ],
  });
}

/** Khoa thu tu "chua xep" duoc dung lai cho nhom "" khi mot lan keo tha cua cay. */
export const UNGROUPED_ORDER_KEY = "";
/** Khoa thu tu phang — re-export cho de doc. */
export { FLAT_SESSION_ORDER_KEY };
