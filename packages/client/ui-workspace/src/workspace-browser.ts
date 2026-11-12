/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc WorkspaceBrowser — vung duyet workspace trong thanh ben: hang dau (nhan, tim kiem, them), than danh sach, va hai hop thoai
 */

import { clsx } from "./clsx.ts";
import { workspaceBrowserStyles } from "./css.ts";
import { FLAT_SESSION_ORDER_KEY, SEARCH_DEBOUNCE_MS, SEARCH_QUERY_MAX_CODE_UNITS, TOOLTIP_DELAY_MS, EXPAND_SLIDE_MS } from "./ids.ts";
import { orderByRecency, pinCurrentBlank, reconcileManualOrder, sessionMemberIds } from "./derive.ts";
import { ext, fragment, h, hs, type Dyn } from "./runtime.ts";
import { ViewOptionsMenu, sanitizeSearchQuery, workspaceDisplayTitle } from "./views.ts";
import { WorkspacePickFlow } from "./workspace-picker.ts";

/**
 * Render vung duyet workspace.
 * Nhan: props — props slot da ghep (phan chia cua chu so huu + store + hanh dong tiem vao + AnimatedRows/SessionTree/FlatList/SearchResults).
 * Tra: node vung duyet.
 */
export function WorkspaceBrowser(props: Dyn): Dyn {
  const {
    wide,
    usePanelInfo,
    expandSidebar,
    useSessions,
    useSessionStatus,
    useWorkspaces,
    useStore,
    actions,
    startSession,
    open,
    requestSessionRename,
    notifyArchivedNotOpenable,
    renameWorkspace,
    deleteWorkspace,
    insertWorkspaceBefore,
    unarchiveSession,
    createWorkspace,
    searchSessions,
    searchResultLimit,
    useDirectoryFlow,
    useHostInfo,
    useShortcuts,
    useWorkspaceShortcuts,
    requestSearch,
    requestAddWorkspace,
    closeAddWorkspace,
    setDirectoryBusy,
    renderSlot,
    t,
    AnimatedRows,
    SessionTree,
    FlatList,
    SearchResults,
  } = props;
  const home = useHostInfo((info: Dyn) => info.home);
  const shortcuts = useShortcuts((rows: Dyn) => rows);
  const searchShortcut = shortcuts.find((row: Dyn) => row.id === "session.search");
  const addShortcut = shortcuts.find((row: Dyn) => row.id === "workspace.add");
  const shortcutState = useWorkspaceShortcuts((state: Dyn) => state);
  const list = useSessions((state: Dyn) => state);
  const storedWorkspaces = useWorkspaces((state: Dyn) => state.items);
  const defaultWorkspaceName = t("workspace.defaultName");
  const workspaces = ext.react.useMemo(() => storedWorkspaces.map((workspace: Dyn) => ({ ...workspace, title: workspaceDisplayTitle(workspace.title, defaultWorkspaceName) })), [storedWorkspaces, defaultWorkspaceName]);
  const workspacePhase = useWorkspaces((state: Dyn) => state.phase);
  const workspaceStreamState = useWorkspaces((state: Dyn) => state.state);
  const archivedSessionIds = useWorkspaces((state: Dyn) => state.archivedSessionIds);
  const pinnedSessionIds = useWorkspaces((state: Dyn) => state.pinnedSessionIds);
  const directoryFlowAvailable = useDirectoryFlow((occupied: boolean) => occupied);
  const groupBy = useStore((s: Dyn) => s.groupBy);
  const orderBy = useStore((s: Dyn) => s.orderBy);
  const archivedFilter = useStore((s: Dyn) => s.archivedFilter ?? "default");
  const groupExpansion = useStore((s: Dyn) => s.groupExpansion);
  const sessionOrderByAccount = useStore((s: Dyn) => s.sessionOrderByAccount);
  const guardedOpen = (sessionId: string): void => {
    if (archivedSessionIds.includes(sessionId)) {
      notifyArchivedNotOpenable();
      return;
    }
    open(sessionId);
  };
  const leaveArchivedOnly = (): void => {
    actions.setArchivedFilter("default");
  };
  const workspaceReady = workspacePhase === "ready" && workspaceStreamState !== "loading";
  const mainSessionId = Object.values(list.byId as Record<string, Dyn>).find((session: Dyn) => (session.retainedBy.mainView ?? 0) > 0)?.id;
  const currentBlank = mainSessionId !== undefined && list.byId[mainSessionId]?.blank === true ? mainSessionId : undefined;
  const ungroupedMemberIds = ext.react.useMemo(() => {
    const accounted = new Set(workspaces.flatMap((workspace: Dyn) => workspace.sessionIds as string[]));
    return (list.ids as string[]).filter((id) => list.byId[id] !== undefined && !accounted.has(id));
  }, [list, workspaces]);
  const orderState = ext.react.useMemo(() => ({ pinnedSessionIds, archivedSessionIds }), [archivedSessionIds, pinnedSessionIds]);
  const rowState = ext.react.useMemo(() => ({ ...orderState, archivedFilter }), [orderState, archivedFilter]);
  const flatMemberIds = ext.react.useMemo(() => sessionMemberIds(list), [list]);
  const orderedWorkspaces = ext.react.useMemo(
    () =>
      workspaces.map((workspace: Dyn) => {
        const memberIds = workspace.sessionIds as string[];
        const baseOrder = orderBy === "updated" ? orderByRecency(memberIds, list.byId) : reconcileManualOrder(memberIds, sessionOrderByAccount[workspace.workspaceId], list.byId, orderState);
        return { ...workspace, sessionIds: pinCurrentBlank(baseOrder, currentBlank !== undefined && memberIds.includes(currentBlank) ? currentBlank : undefined) };
      }),
    [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, workspaces],
  );
  const orderedUngroupedSessionIds = ext.react.useMemo(
    () => pinCurrentBlank(orderBy === "updated" ? orderByRecency(ungroupedMemberIds, list.byId) : reconcileManualOrder(ungroupedMemberIds, sessionOrderByAccount[""], list.byId, orderState), currentBlank !== undefined && ungroupedMemberIds.includes(currentBlank) ? currentBlank : undefined),
    [currentBlank, list.byId, orderBy, orderState, sessionOrderByAccount, ungroupedMemberIds],
  );
  const orderedFlatSessionIds = ext.react.useMemo(
    () => pinCurrentBlank(orderBy === "updated" ? orderByRecency(flatMemberIds, list.byId) : reconcileManualOrder(flatMemberIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY], list.byId, orderState), currentBlank !== undefined && flatMemberIds.includes(currentBlank) ? currentBlank : undefined),
    [currentBlank, flatMemberIds, list.byId, orderBy, orderState, sessionOrderByAccount],
  );
  const activeSessionOrders = ext.react.useMemo(
    () => Object.fromEntries([...orderedWorkspaces.map((workspace: Dyn) => [workspace.workspaceId, workspace.sessionIds]), ["", orderedUngroupedSessionIds], [FLAT_SESSION_ORDER_KEY, orderedFlatSessionIds]]),
    [orderedFlatSessionIds, orderedUngroupedSessionIds, orderedWorkspaces],
  );
  ext.react.useEffect(() => {
    if (workspacePhase !== "ready") return;
    actions.retainAccountKeys(["", FLAT_SESSION_ORDER_KEY, ...workspaces.map((workspace: Dyn) => workspace.workspaceId)]);
  }, [actions.retainAccountKeys, workspacePhase, workspaces]);
  const saveSessionOrder = (accountKey: string, order: readonly string[]): void => {
    actions.setSessionOrder(accountKey, order, activeSessionOrders);
  };
  const [query, setQuery] = ext.react.useState("");
  const [searchExpanded, setSearchExpanded] = ext.react.useState(false);
  const [revealSessionId, setRevealSessionId] = ext.react.useState(undefined);
  const normalizedQuery = sanitizeSearchQuery(query).trim();
  const [remoteSearch, setRemoteSearch] = ext.react.useState({ query: "", status: "idle", items: [], hasMore: false });
  const searchRoot = ext.react.useRef(null);
  const searchInput = ext.react.useRef(null);
  const wsPickerOpen = shortcutState.addRequested;
  const wsPlusRef = ext.react.useRef(null);
  const composingRef = ext.react.useRef(false);
  const openSearchResult = (sessionId: string): void => {
    if (archivedSessionIds.includes(sessionId)) {
      notifyArchivedNotOpenable();
      return;
    }
    setRevealSessionId(sessionId);
    setQuery("");
    setSearchExpanded(false);
    open(sessionId);
  };
  const acknowledgeSessionReveal = (sessionId: string): void => {
    setRevealSessionId((current: string | undefined) => (current === sessionId ? undefined : current));
  };
  ext.react.useEffect(() => {
    if (normalizedQuery !== "") setRevealSessionId(undefined);
  }, [normalizedQuery]);
  const [searchOnExpand, setSearchOnExpand] = ext.react.useState(false);
  ext.react.useEffect(() => {
    if (wide && searchOnExpand) {
      const timer = window.setTimeout(() => {
        searchInput.current?.focus({ preventScroll: true });
        setSearchOnExpand(false);
      }, EXPAND_SLIDE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }
    return undefined;
  }, [wide, searchOnExpand]);
  ext.react.useEffect(() => {
    if (shortcutState.searchRequest === 0) return;
    closeAddWorkspace();
    setSearchExpanded(true);
    if (!wide) {
      setSearchOnExpand(true);
      expandSidebar();
    } else searchInput.current?.focus({ preventScroll: true });
  }, [shortcutState.searchRequest]);
  ext.react.useEffect(() => {
    if (!wide || !searchExpanded || searchOnExpand) return;
    searchInput.current?.focus({ preventScroll: true });
  }, [wide, searchExpanded, searchOnExpand]);
  ext.react.useEffect(() => {
    if (!searchExpanded || normalizedQuery === "") {
      setRemoteSearch({ query: normalizedQuery, status: "idle", items: [], hasMore: false });
      return undefined;
    }
    const controller = new AbortController();
    setRemoteSearch({ query: normalizedQuery, status: "loading", items: [], hasMore: false });
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal)
        .then((page: Dyn) => {
          if (controller.signal.aborted) return;
          setRemoteSearch({ query: normalizedQuery, status: "ready", items: page.items ?? [], hasMore: page.hasMore === true });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setRemoteSearch({ query: normalizedQuery, status: "ready", items: [], hasMore: false });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalizedQuery, searchExpanded, searchSessions]);
  const [renameTarget, setRenameTarget] = ext.react.useState(null);
  const [renameDraft, setRenameDraft] = ext.react.useState("");
  const [renaming, setRenaming] = ext.react.useState(false);
  const [renameError, setRenameError] = ext.react.useState(null);
  const storedWorkspacesRaw = useWorkspaces((state: Dyn) => state.items);
  const renameTrimmed = renameDraft.trim();
  const renameDuplicate = renameTarget !== null && storedWorkspacesRaw.some((workspace: Dyn) => workspace.workspaceId !== renameTarget.workspaceId && workspace.title === renameTrimmed);
  const renameBlocked = renaming || renameTrimmed === "" || renameDuplicate;
  const closeRename = (): void => {
    if (renaming) return;
    setRenameTarget(null);
    setRenameError(null);
  };
  const confirmRename = (): void => {
    if (renameBlocked) return;
    setRenaming(true);
    setRenameError(null);
    renameWorkspace(renameTarget.workspaceId, renameTrimmed)
      .then(() => {
        setRenaming(false);
        setRenameTarget(null);
      })
      .catch((reason: unknown) => {
        setRenaming(false);
        setRenameError(reason instanceof Error ? reason.message : String(reason));
      });
  };
  const onSessionUnarchive = (sessionId: string): void => {
    unarchiveSession(sessionId).catch((reason: unknown) => {
      console.warn("session unarchive rejected:", reason);
    });
  };
  const [deleteTarget, setDeleteTarget] = ext.react.useState(null);
  const [deleting, setDeleting] = ext.react.useState(false);
  const [deleteCommittedId, setDeleteCommittedId] = ext.react.useState(null);
  const [deleteError, setDeleteError] = ext.react.useState(null);
  ext.react.useEffect(() => {
    if (deleteCommittedId === null || storedWorkspacesRaw.some((workspace: Dyn) => workspace.workspaceId === deleteCommittedId)) return;
    setDeleting(false);
    setDeleteCommittedId(null);
    setDeleteTarget(null);
  }, [deleteCommittedId, storedWorkspacesRaw]);
  const closeDelete = (): void => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };
  const confirmDelete = (): void => {
    if (deleting || deleteTarget === null) return;
    setDeleting(true);
    setDeleteCommittedId(null);
    setDeleteError(null);
    deleteWorkspace(deleteTarget.workspaceId)
      .then(() => {
        setDeleteCommittedId(deleteTarget.workspaceId);
      })
      .catch((reason: unknown) => {
        setDeleting(false);
        setDeleteError(reason instanceof Error ? reason.message : String(reason));
      });
  };
  return hs("div", {
    className: clsx(workspaceBrowserStyles.root, !wide && workspaceBrowserStyles.rail),
    children: [
      hs("div", {
        className: workspaceBrowserStyles.sectionHeader,
        children: [
          wide && h("span", { className: clsx(workspaceBrowserStyles.sectionLabel, workspaceBrowserStyles.wide, searchExpanded && workspaceBrowserStyles.sectionLabelHidden), children: groupBy === "flat" ? t("section.sessions") : t("section.workspaces") }),
          wide &&
            h("div", {
              className: clsx(workspaceBrowserStyles.searchSlot, searchExpanded && workspaceBrowserStyles.searchSlotExpanded),
              children: hs("div", {
                ref: searchRoot,
                className: clsx(workspaceBrowserStyles.search, searchExpanded && workspaceBrowserStyles.searchExpanded),
                onClick: () => {
                  closeAddWorkspace();
                  setSearchExpanded(true);
                  searchInput.current?.focus();
                },
                children: [
                  h(ext.primitives.Tooltip, {
                    label: t("search"),
                    shortcutKeys: searchShortcut?.keys,
                    side: "bottom",
                    delayMs: TOOLTIP_DELAY_MS,
                    disabled: searchExpanded,
                    children: h("button", {
                      type: "button",
                      className: workspaceBrowserStyles.searchButton,
                      "aria-label": t("search.sessions.aria"),
                      "aria-keyshortcuts": searchShortcut?.aria,
                      "aria-expanded": searchExpanded,
                      onClick: () => {
                        requestSearch();
                      },
                      children: h(ext.primitives.IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 }),
                    }),
                  }),
                  h("input", {
                    ref: searchInput,
                    className: workspaceBrowserStyles.searchInput,
                    type: "text",
                    placeholder: t("search.placeholder"),
                    maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
                    value: query,
                    tabIndex: searchExpanded ? 0 : -1,
                    onChange: (e: Dyn) => {
                      setQuery(sanitizeSearchQuery(e.target.value));
                    },
                    onKeyDown: (e: Dyn) => {
                      if (e.key !== "Escape") return;
                      setQuery("");
                      setSearchExpanded(false);
                    },
                  }),
                  searchExpanded &&
                    h("button", {
                      type: "button",
                      className: workspaceBrowserStyles.clearButton,
                      "aria-label": t("search.clear"),
                      onClick: (e: Dyn) => {
                        e.stopPropagation();
                        setQuery("");
                        setSearchExpanded(false);
                      },
                      children: h(ext.primitives.IconCloseFillRegular, {}),
                    }),
                ],
              }),
            }),
          hs("div", {
            className: clsx(workspaceBrowserStyles.headerActions, wide && searchExpanded && workspaceBrowserStyles.headerActionsHidden),
            children: [
              wide && h(ViewOptionsMenu, { groupBy, orderBy, archivedFilter, onGroupPick: actions.setGroupBy, onOrderPick: (mode: string) => actions.setOrderBy(mode, activeSessionOrders), onArchivedFilterPick: actions.setArchivedFilter, t }),
              directoryFlowAvailable &&
                h(ext.primitives.Tooltip, {
                  label: t("workspace.add"),
                  shortcutKeys: addShortcut?.keys,
                  side: "bottom",
                  delayMs: TOOLTIP_DELAY_MS,
                  children: h("button", {
                    ref: wsPlusRef,
                    type: "button",
                    className: workspaceBrowserStyles.iconButton,
                    "aria-label": t("workspace.add"),
                    "aria-keyshortcuts": addShortcut?.aria,
                    onClick: () => {
                      requestAddWorkspace();
                    },
                    children: h(ext.primitives.IconProjectAddOutlineRegular, { size: wide ? 16 : 18 }),
                  }),
                }),
            ],
          }),
          h(WorkspacePickFlow, {
            t,
            open: wsPickerOpen,
            anchorRef: wsPlusRef,
            useWorkspaces,
            createWorkspace,
            useDirectoryFlow,
            renderDirectoryFlow: (owner: Dyn) => renderSlot("sidebar.workspaces.directoryFlow", owner),
            addOnly: true,
            onBusyChange: setDirectoryBusy,
            side: "right",
            onPick: (workspaceId: string) => {
              closeAddWorkspace();
              startSession(workspaceId, { clearPreviousDraft: false });
            },
            onClose: () => {
              closeAddWorkspace();
            },
          }),
        ],
      }),
      !wide &&
        h("div", {
          className: workspaceBrowserStyles.search,
          children: h(ext.primitives.Tooltip, {
            label: t("search"),
            shortcutKeys: searchShortcut?.keys,
            children: h("button", {
              type: "button",
              className: workspaceBrowserStyles.searchButton,
              "aria-label": t("search.sessions.aria"),
              "aria-keyshortcuts": searchShortcut?.aria,
              onClick: () => {
                requestSearch();
              },
              children: h(ext.primitives.IconSearchOutlineRegular, { size: 18 }),
            }),
          }),
        }),
      h("div", {
        className: workspaceBrowserStyles.listArea,
        children:
          wide &&
          (normalizedQuery !== ""
            ? h(SearchResults, {
                usePanelInfo,
                useSessions,
                useSessionStatus,
                open: openSearchResult,
                onUnarchive: onSessionUnarchive,
                workspaces,
                archivedSessionIds,
                archivedFilter,
                query: normalizedQuery,
                remote: remoteSearch,
                resultLimit: searchResultLimit,
                t,
              })
            : groupBy === "flat"
              ? h(FlatList, {
                  usePanelInfo,
                  list,
                  sessionIds: orderedFlatSessionIds,
                  rowState,
                  onLeaveArchivedOnly: leaveArchivedOnly,
                  workspaceReady,
                  animationResetKey: groupBy + "/" + orderBy + "/" + archivedFilter,
                  useSessionStatus,
                  open: guardedOpen,
                  onSessionRenameRequest: requestSessionRename,
                  renderSlot,
                  setSessionOrder: saveSessionOrder,
                  revealSessionId,
                  onSessionRevealed: acknowledgeSessionReveal,
                  t,
                  AnimatedRows,
                })
              : h(SessionTree, {
                  usePanelInfo,
                  list,
                  shortcuts,
                  useSessionStatus,
                  onSessionRenameRequest: requestSessionRename,
                  renderSlot,
                  workspaces: orderedWorkspaces,
                  ungroupedSessionIds: orderedUngroupedSessionIds,
                  workspaceReady,
                  nestWorkspaces: groupBy === "workspace-tree",
                  animationResetKey: groupBy + "/" + orderBy + "/" + archivedFilter,
                  groupExpansion,
                  setGroupExpanded: actions.setGroupExpanded,
                  setSessionOrder: saveSessionOrder,
                  rowState,
                  onLeaveArchivedOnly: leaveArchivedOnly,
                  startSession,
                  open: guardedOpen,
                  insertWorkspaceBefore,
                  revealSessionId,
                  onSessionRevealed: acknowledgeSessionReveal,
                  home,
                  t,
                  AnimatedRows,
                  onRenameRequest: (workspaceId: string, displayTitle: string) => {
                    setRenameTarget({ workspaceId, storedTitle: storedWorkspacesRaw.find((w: Dyn) => w.workspaceId === workspaceId)?.title ?? displayTitle });
                    setRenameDraft(displayTitle);
                    setRenameError(null);
                  },
                  onDeleteRequest: (workspaceId: string, title: string) => {
                    setDeleteTarget({ workspaceId, title });
                    setDeleteError(null);
                  },
                })),
      }),
      hs(ext.primitives.Modal, {
        open: renameTarget !== null,
        onClose: closeRename,
        closeLabel: t("close"),
        title: t("rename.workspace.title"),
        footer: hs(fragment(), {
          children: [
            h(ext.primitives.Button, { variant: "outline", disabled: renaming, onClick: closeRename, children: t("cancel") }),
            h(ext.primitives.Button, { variant: "primary", disabled: renameBlocked, onClick: confirmRename, children: t("rename") }),
          ],
        }),
        children: [
          h("input", {
            className: workspaceBrowserStyles.renameInput,
            value: renameDraft,
            "aria-label": t("field.workspaceName"),
            "data-modal-autofocus": true,
            disabled: renaming,
            onFocus: (e: Dyn) => {
              e.target.select();
            },
            onChange: (e: Dyn) => {
              setRenameDraft(e.target.value);
              setRenameError(null);
            },
            onCompositionStart: () => {
              composingRef.current = true;
            },
            onCompositionEnd: () => {
              composingRef.current = false;
            },
            onKeyDown: (e: Dyn) => {
              if (e.key === "Enter" && !composingRef.current) {
                e.preventDefault();
                confirmRename();
              }
            },
          }),
          renameDuplicate && h("div", { className: workspaceBrowserStyles.renameError, role: "alert", children: t("conflict.named", { name: renameTrimmed }) }),
          renameError !== null && h("div", { className: workspaceBrowserStyles.renameError, role: "alert", children: renameError }),
        ],
      }),
      hs(ext.primitives.Modal, {
        open: deleteTarget !== null,
        onClose: closeDelete,
        closeLabel: t("close"),
        title: t("delete.workspace"),
        ...(deleteTarget === null ? {} : { description: t("delete.desc", { name: deleteTarget.title }) }),
        footer: hs(fragment(), {
          children: [
            h(ext.primitives.Button, { variant: "outline", disabled: deleting, onClick: closeDelete, children: t("cancel") }),
            h(ext.primitives.Button, { variant: "outline", className: workspaceBrowserStyles.deleteAction, disabled: deleting, onClick: confirmDelete, children: t("delete.workspace") }),
          ],
        }),
        children: [
          deleting && h("div", { className: workspaceBrowserStyles.deleteStatus, role: "status", children: t("delete.pending") }),
          deleteError !== null && h("div", { className: workspaceBrowserStyles.renameError, role: "alert", children: deleteError }),
        ],
      }),
    ],
  });
}
