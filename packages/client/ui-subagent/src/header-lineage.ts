/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Duong dan pha he + nut danh muc subagent trong hang dau phien — ban viet lai theo tung nhanh cua bundle goc
 */

import { headerLineageStyles as styles } from "./class-names.ts";
import { ACTIVITY_TICK_MS, HOVER_CLOSE_DELAY_MS, HOVER_OPEN_DELAY_MS, MENU_VIEWPORT_MARGIN, MENU_WIDTH } from "./ids.ts";
import { activityDuration, formatDuration, formatExactDuration, formatTokens, tokenTotal, type CatalogEntry, type CatalogMap, type CatalogState, type SessionSummary, type Translator } from "./duration.ts";

/** Runtime JSX do bang module cap (react/jsx-runtime). */
export interface JsxRuntime {
  /** Dung element mot con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dung element nhieu con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Nut bao boc nhieu con khong co element cha. */
  Fragment: unknown;
}

/** Phan react ma hai component nay dung. */
export interface ReactHooks {
  /** Trang thai cuc bo. */
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((current: T) => T)) => void];
  /** O nho. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung vong doi. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Ghi nho gia tri dan xuat. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
}

/** Bay primitive cua ban goc ma hai component nay dung. */
export interface LineagePrimitives {
  /** Icon lam moi (nut thu lai). */
  IconRefreshOutlineRegular: unknown;
  /** Icon chevron phai (nut mo/nhung nhanh). */
  IconChevronRightOutlineRegular: unknown;
  /** Icon chevron xuong (nut mo menu). */
  IconChevronDownOutlineRegular: unknown;
  /** Cham trang thai. */
  StateDot: unknown;
  /** Nhan co dinh vi. */
  Tooltip: unknown;
}

/** Goi runtime ma plugin truyen vao mot lan. */
export interface LineageRuntime {
  /** Runtime JSX. */
  jsx: JsxRuntime["jsx"];
  /** Runtime JSX nhieu con. */
  jsxs: JsxRuntime["jsxs"];
  /** Fragment cua runtime JSX. */
  Fragment: unknown;
  /** Hook react. */
  react: ReactHooks;
  /** Cong portal cua react-dom. */
  createPortal: (children: unknown, container: unknown) => unknown;
  /** Primitive cua ban goc. */
  primitives: LineagePrimitives;
}

/** Dia chi mot phien con theo phien cha — nguyen van hinh dang cua ban goc. */
export interface SubagentAddress {
  /** Id phien cha. */
  readonly parentSessionId: string;
  /** Id phien con. */
  readonly childSessionId: string;
  /** Che do tiep noi. */
  readonly mode: string;
}

/** Nghiep vu do slot tiem vao component (ban goc goi la catalogActions). */
export interface SubagentCatalogInjected {
  /** Mo phien con trong khung chinh. */
  openChild: (address: SubagentAddress) => void;
  /** Mo phien con trong thanh ben phai. */
  openChildAside: (address: SubagentAddress) => void;
  /** Lam moi chieu danh muc cua mot phien. */
  refreshProjection: (parentSessionId: string) => void;
}

/** Mot muc trong chieu danh muc (truoc khi suy ra trang thai hoat dong). */
export interface CatalogSeedEntry {
  /** Id phien con. */
  readonly id: string;
  /** Nhan hien thi. */
  readonly label?: string;
  /** Che do tiep noi. */
  readonly mode: string;
}

/** Anh chup mot chieu projection cua bang phien. */
export interface ProjectionSnapshot {
  /** Trang thai chieu: idle · loading · ready · error · migration-required. */
  readonly state: string;
  /** Loi khi chieu that bai. */
  readonly error?: { readonly message?: string } | null;
  /** Gia tri chieu ra. */
  readonly values: { readonly subagentCatalog?: readonly CatalogSeedEntry[] };
}

/** Chieu phien ma bang danh muc doc — ban goc con doc them formatStatus. */
export interface CatalogSummary extends SessionSummary {
  /** Trang thai dinh dang cua phien (migration-required chan viec mo rong). */
  readonly formatStatus?: string;
}

/** Trang thai song cua mot phien tu bang sessionStatus. */
export interface SessionStatus {
  /** Phien dang chay hay khong. */
  readonly running?: boolean;
}

/** Anh chup bang phien ma component doc qua useSessions. */
export interface SessionsState {
  /** Chieu danh muc theo id phien. */
  readonly projectionsBySession: Readonly<Record<string, ProjectionSnapshot | undefined>>;
  /** Tom tat phien theo id. */
  readonly byId: Readonly<Record<string, CatalogSummary | undefined>>;
}

/** Hook chon mot lat cat cua bang phien. */
export interface UseSessions {
  /** Chon mot lat cat tu bang phien. */
  <T>(selector: (state: SessionsState) => T): T;
}

/** Hook chon mot lat cat cua bang trang thai phien. */
export interface UseSessionStatus {
  /** Chon mot lat cat tu bang trang thai phien. */
  <T>(selector: (statuses: Map<string, SessionStatus>) => T): T;
}

/** Mat phien ma component doc qua useSession. */
export interface SessionFace {
  /** Thong tin subagent cua phien (khong co voi phien goc). */
  readonly subagent?: {
    /** Dia chi phien con. */
    readonly address: SubagentAddress;
    /** Phien cha con truy cap duoc hay khong. */
    readonly parentAvailable?: boolean;
  };
}

/** Hook chon mot lat cat cua mot phien. */
export interface UseSession {
  /** Chon mot lat cat tu mot phien. */
  <T>(selector: (session: SessionFace) => T): T;
}

/** Props day du cua component duong dan pha he. */
export interface SubagentHeaderLineageProps extends SubagentCatalogInjected {
  /** Id phien cua duong dan dang render. */
  readonly lineageSessionId: string;
  /** Tieu de hien thi cua phien. */
  readonly displayTitle?: string;
  /** Mo tieu de phien (khong co thi hien nut chuyen sang phien con). */
  readonly openTitle?: () => void;
  /** Bang phien. */
  readonly useSessions: UseSessions;
  /** Bang phien theo id. */
  readonly useSession: UseSession;
  /** Bang trang thai phien. */
  readonly useSessionStatus: UseSessionStatus;
  /** Ham dich namespace subagent. */
  readonly t: Translator;
}

/** Props day du cua nut danh muc trong hang dau phien. */
export interface SubagentCatalogActionProps extends SubagentCatalogInjected {
  /** Id phien dang mo. */
  readonly sessionId: string;
  /** Bang phien. */
  readonly useSessions: UseSessions;
  /** Bang trang thai phien. */
  readonly useSessionStatus: UseSessionStatus;
  /** Ham dich namespace subagent. */
  readonly t: Translator;
}

/** Vi tri menu danh muc (toa do khung nhin). */
export interface MenuPosition {
  /** Khoang cach tu mep tren. */
  readonly top: number;
  /** Khoang cach tu mep trai. */
  readonly left: number;
}

/** Hai component ma plugin dang ky vao slot. */
export interface HeaderLineageComponents {
  /** Duong dan pha he trong hang dau phien. */
  SubagentHeaderLineage: (props: SubagentHeaderLineageProps) => unknown;
  /** Nut danh muc trong hang dau phien. */
  SubagentCatalogAction: (props: SubagentCatalogActionProps) => unknown;
}

/** Props noi bo cua mot tang danh muc. */
interface CatalogRowsProps extends SubagentCatalogInjected {
  /** Phien dang so huu tang nay. */
  readonly parentSessionId: string;
  /** Phien dang duoc mo (neu co) de danh dau dong hien tai. */
  readonly currentSessionId?: string | undefined;
  /** Tang danh muc can render. */
  readonly catalog: CatalogState;
  /** Kho danh muc cua moi phien. */
  readonly catalogs: CatalogMap;
  /** Tom tat phien theo id. */
  readonly summaries: Readonly<Record<string, CatalogSummary | undefined>>;
  /** Tap phien dang mo rong. */
  readonly expanded: ReadonlySet<string>;
  /** Cap cua so trong cay. */
  readonly level: number;
  /** Mo/nhung mot nhanh. */
  readonly toggleBranch: (childSessionId: string) => void;
  /** Dong menu danh muc. */
  readonly closeCatalog: () => void;
  /** Ham dich namespace subagent. */
  readonly t: Translator;
}

/** Props noi bo cua mot menu danh muc (trigger + cay). */
interface CatalogDropdownProps extends SubagentCatalogInjected {
  /** Phien goc cua cay danh muc. */
  readonly rootSessionId: string;
  /** Phien dang duoc mo. */
  readonly currentSessionId?: string | undefined;
  /** Tieu de hien thi cua trigger kieu switcher. */
  readonly displayTitle?: string | undefined;
  /** Mo tieu de phien (bien the switcher). */
  readonly openTitle?: (() => void) | undefined;
  /** "count" = nut dem trong hang dau · "switcher" = nut doi phien trong duong dan. */
  readonly variant: "count" | "switcher";
  /** Bang phien. */
  readonly useSessions: UseSessions;
  /** Bang trang thai phien. */
  readonly useSessionStatus: UseSessionStatus;
  /** Ham dich namespace subagent. */
  readonly t: Translator;
}

/**
 * Liet ke cac dong con mo duoc cua cay (dung cho dieu huong ban phim).
 * Nhan: root — nut goc cua cay, hoac null.
 * Tra: mang phan tu role=treeitem chua bi vo hieu.
 */
function treeItems(root: HTMLElement | null): HTMLElement[] {
  if (root === null) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="treeitem"]:not([aria-disabled="true"])'));
}

/**
 * Mot phien con chi duoc coi la la da biet khi chinh danh muc cua no da nap xong va rong.
 * Nhan: catalog — tang danh muc cua phien con.
 * Tra: true khi phien con chac chan khong con con.
 */
function isKnownLeaf(catalog: CatalogState | undefined): boolean {
  return catalog?.state === "ready" && catalog.entries.length === 0;
}

/**
 * Dat menu danh muc ngay duoi nut mo ma khong vuot mep khung nhin.
 * Nhan: trigger — nut mo menu.
 * Tra: toa do top/left cho menu.
 */
function catalogMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(MENU_WIDTH, window.innerWidth - MENU_VIEWPORT_MARGIN * 2);
  return {
    top: rect.bottom + 5,
    left: Math.min(Math.max(MENU_VIEWPORT_MARGIN, rect.left), window.innerWidth - width - MENU_VIEWPORT_MARGIN),
  };
}

/**
 * Dung hai component duong dan pha he/nut danh muc quanh mot goi runtime.
 * Nhan: runtime — JSX, hook react, portal va primitive cua ban goc.
 * Tra: cap component de plugin dang ky vao slot.
 */
export function createHeaderLineageComponents(runtime: LineageRuntime): HeaderLineageComponents {
  const { jsx, jsxs, Fragment, createPortal, primitives } = runtime;
  const { useState, useRef, useEffect, useMemo } = runtime.react;

  /**
   * Hien trang thai dang nap ma khong tu suy dien thanh vien con.
   * Nhan: props.t — ham dich.
   * Tra: mot dong thong bao dang nap.
   */
  function CatalogLoadingRows(props: { readonly t: Translator }): unknown {
    return jsx("div", { className: styles.notice, children: props.t("loading.label") });
  }

  /**
   * Render mot tang danh muc va chi de quy qua nhung dong duoc mo rong tuong minh.
   * Nhan: props — tang danh muc, kho danh muc, tap mo rong va cac nghiep vu danh muc.
   * Tra: cay cac dong cua tang nay.
   */
  function CatalogRows(props: CatalogRowsProps): unknown {
    const { parentSessionId, currentSessionId, catalog, catalogs, summaries, expanded, level, t } = props;
    const [now, setNow] = useState(() => Date.now());
    const running = catalog.entries.some((entry) => entry.activity === "running");
    useEffect(() => {
      if (!running) return;
      const timer = setInterval(() => {
        setNow(Date.now());
      }, ACTIVITY_TICK_MS);
      return () => {
        clearInterval(timer);
      };
    }, [running]);
    const emptyLoading = catalog.state === "loading" && catalog.entries.length === 0;
    const reserveDisclosure = catalog.entries.some(
      (entry) =>
        entry.mode !== "external" &&
        !isKnownLeaf(catalogs[entry.id]) &&
        summaries[entry.id]?.formatStatus !== "migration-required" &&
        catalogs[entry.id]?.state !== "migration-required",
    );
    return jsxs(Fragment, {
      children: [
        emptyLoading ? jsx(CatalogLoadingRows, { t }) : null,
        catalog.state === "error"
          ? jsxs("div", {
              className: styles.error,
              children: [
                jsx("span", { children: catalog.error?.message ?? t("load.error") }),
                jsxs("button", {
                  type: "button",
                  className: styles.refresh,
                  onClick: () => {
                    props.refreshProjection(parentSessionId);
                  },
                  children: [jsx(primitives.IconRefreshOutlineRegular, { size: 14 }), t("retry")],
                }),
              ],
            })
          : null,
        catalog.entries.map((entry: CatalogEntry) => {
          const external = entry.mode === "external";
          const childCatalog = catalogs[entry.id];
          const isCurrent = entry.id === currentSessionId;
          const knownLeaf = external || isKnownLeaf(childCatalog);
          const requiresOpening = summaries[entry.id]?.formatStatus === "migration-required" || childCatalog?.state === "migration-required";
          const canExpand = !knownLeaf && !requiresOpening;
          const isExpanded = canExpand && expanded.has(entry.id);
          const childLoading = childCatalog === undefined || (childCatalog.state === "loading" && childCatalog.entries.length === 0);
          const summary = summaries[entry.id];
          const label = entry.label ?? entry.id;
          const mode = external
            ? t("mode.external")
            : entry.mode === "unknown"
              ? t("mode.unknown")
              : entry.mode === "one-shot"
                ? t("mode.oneShot")
                : t("mode.continuable");
          const completed = !external && entry.activity === "inactive" && summary?.projectionValues?.subagentTiming?.lastTurnCompleted === true;
          const activity = external ? undefined : entry.activity === "running" ? t("activity.running") : completed ? t("activity.completed") : t("activity.inactive");
          const secondary = [summary?.title, requiresOpening ? t("catalog.migrationRequired") : mode, activity]
            .filter((value) => value !== undefined)
            .join(" · ");
          const totalTokens = tokenTotal(summary?.projectionValues?.tokenUsage);
          const durationMs = activityDuration(summary, entry.activity, now);
          const tokenMetric = totalTokens === undefined ? undefined : t("tokens.total", { value: formatTokens(totalTokens, t) });
          const durationMetric =
            durationMs === undefined
              ? undefined
              : { compact: formatDuration(durationMs, t), exact: formatExactDuration(durationMs, t) };
          const metrics = [tokenMetric, durationMetric?.exact].filter((value) => value !== undefined).join(" · ");
          const open = (): void => {
            if (external) return;
            props.openChild({ parentSessionId, childSessionId: entry.id, mode: entry.mode });
            props.closeCatalog();
          };
          const handleKey = (event: { key: string; preventDefault: () => void; stopPropagation: () => void }): void => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              open();
            } else if (event.key === "ArrowRight" && canExpand && !isExpanded) {
              event.preventDefault();
              event.stopPropagation();
              props.toggleBranch(entry.id);
            } else if (event.key === "ArrowLeft" && isExpanded) {
              event.preventDefault();
              event.stopPropagation();
              props.toggleBranch(entry.id);
            }
          };
          const toggle = (event: { preventDefault: () => void; stopPropagation: () => void }): void => {
            event.preventDefault();
            event.stopPropagation();
            props.toggleBranch(entry.id);
          };
          return jsxs(
            "div",
            {
              className: styles.node,
              children: [
                jsxs("div", {
                  role: "treeitem",
                  tabIndex: external ? -1 : 0,
                  "aria-disabled": external || undefined,
                  "aria-level": level,
                  "aria-current": isCurrent || undefined,
                  "aria-label": [label, secondary, metrics].filter((value) => value !== "").join(" "),
                  ...(canExpand ? { "aria-expanded": isExpanded } : {}),
                  className: styles.row,
                  onClick: open,
                  onKeyDown: handleKey,
                  children: [
                    !canExpand
                      ? reserveDisclosure
                        ? jsx("span", { className: styles.disclosureSpace })
                        : null
                      : jsx("button", {
                          type: "button",
                          tabIndex: -1,
                          className: styles.disclosure + " " + (isExpanded ? styles.disclosureOpen : ""),
                          "aria-label": t(isExpanded ? "branch.collapse" : "branch.expand", { label }),
                          onClick: toggle,
                          children: jsx(primitives.IconChevronRightOutlineRegular, {}),
                        }),
                    jsxs("div", {
                      className: styles.clickarea,
                      children: [
                        jsx("span", {
                          className: styles.rowActivitySlot,
                          children: jsx(primitives.StateDot, { state: entry.activity === "running" ? "ongoing" : completed ? "done" : "idle" }),
                        }),
                        jsxs("span", {
                          className: styles.content,
                          children: [
                            jsx("span", {
                              className: styles.label + " " + (isCurrent ? styles.currentLabel : ""),
                              children: label,
                            }),
                            jsx("span", { className: styles.summary, children: secondary }),
                          ],
                        }),
                        metrics !== ""
                          ? jsxs("span", {
                              className: styles.metrics,
                              children: [
                                tokenMetric === undefined ? null : jsx("span", { className: styles.metricToken, children: tokenMetric }),
                                durationMetric === undefined
                                  ? null
                                  : jsx("span", {
                                      className: styles.metricDuration,
                                      title: t("duration.exactTitle", { duration: durationMetric.exact }),
                                      children: durationMetric.compact,
                                    }),
                              ],
                            })
                          : null,
                        !isCurrent && !external
                          ? jsx(primitives.Tooltip, {
                              label: t("open.sidebar"),
                              side: "bottom",
                              align: "end",
                              children: jsx("button", {
                                type: "button",
                                className: styles.sidebarButton,
                                "aria-label": t("open.sidebar.aria", { label }),
                                onClick: (event: { preventDefault: () => void; stopPropagation: () => void }) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  props.openChildAside({ parentSessionId, childSessionId: entry.id, mode: entry.mode });
                                  props.closeCatalog();
                                },
                                onKeyDown: (event: { stopPropagation: () => void }) => {
                                  event.stopPropagation();
                                },
                                children: jsx(primitives.IconChevronRightOutlineRegular, {}),
                              }),
                            })
                          : null,
                      ],
                    }),
                  ],
                }),
                isExpanded
                  ? jsx("div", {
                      role: "group",
                      className: styles.children,
                      "aria-busy": childLoading || undefined,
                      children:
                        childCatalog === undefined
                          ? jsx(CatalogLoadingRows, { t })
                          : jsx(CatalogRows, {
                              parentSessionId: entry.id,
                              currentSessionId,
                              catalog: childCatalog,
                              catalogs,
                              summaries,
                              expanded,
                              level: level + 1,
                              openChild: props.openChild,
                              openChildAside: props.openChildAside,
                              refreshProjection: props.refreshProjection,
                              toggleBranch: props.toggleBranch,
                              closeCatalog: props.closeCatalog,
                              t,
                            }),
                    })
                  : null,
              ],
            },
            entry.id,
          );
        }),
      ],
    });
  }

  /**
   * Mot menu danh muc (nut mo + cay) tren danh muc goc tai rootSessionId.
   * Nhan: props — phien goc, bien the trigger, bang phien va nghiep vu danh muc.
   * Tra: nut kem menu portal, hoac null khi khong co gi de hien.
   */
  function CatalogDropdown(props: CatalogDropdownProps): unknown {
    const { rootSessionId, currentSessionId, displayTitle, variant, useSessions, useSessionStatus, t } = props;
    const ancestorSwitcher = variant === "switcher" && props.openTitle !== undefined;
    const projections = useSessions((state) => state.projectionsBySession);
    const summaries = useSessions((state) => state.byId);
    const statuses = useSessionStatus((value) => value);
    const catalogs = useMemo(() => {
      return Object.fromEntries(
        Object.entries(projections).map(([id, snapshot]) => {
          const projected = snapshot?.values.subagentCatalog;
          const state = snapshot === undefined ? "loading" : snapshot.state === "idle" ? (projected === undefined ? "loading" : "ready") : snapshot.state === "migration-required" && projected !== undefined ? "ready" : snapshot.state;
          return [
            id,
            {
              state,
              error: snapshot?.error,
              entries: (projected ?? []).map((entry) => ({
                id: entry.id,
                label: entry.label,
                mode: entry.mode,
                activity: (statuses.get(entry.id)?.running ?? summaries[entry.id]?.running) === true ? "running" : "inactive",
              })),
            },
          ];
        }),
      ) as CatalogMap;
    }, [projections, summaries, statuses]);
    const catalog = catalogs[rootSessionId];
    const [open, setOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<MenuPosition | undefined>(undefined);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set<string>());
    const rootRef = useRef<HTMLElement | null>(null);
    const triggerRef = useRef<HTMLElement | null>(null);
    const menuRef = useRef<HTMLElement | null>(null);
    const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const pinnedRef = useRef(false);
    const currentEntry =
      currentSessionId === undefined ? undefined : projections[rootSessionId]?.values.subagentCatalog?.find((entry) => entry.id === currentSessionId);
    const switcherDisplayTitle = currentEntry !== undefined ? (currentEntry.label ?? currentEntry.id) : displayTitle;
    const directChildren = catalog?.entries ?? [];
    const directCount = directChildren.length;
    const runningCount = directChildren.filter((entry) => entry.activity === "running").length;
    const totalCountKey = directCount === 1 ? "count.total.one" : "count.total.other";
    const runningCountKey = runningCount === 1 ? "count.running.one" : "count.running.other";
    const presentedCatalog: CatalogState | undefined =
      catalog ?? (variant === "switcher" ? { entries: [], state: "loading", error: null } : undefined);
    const cancelHoverClose = (): void => {
      if (hoverCloseTimer.current === undefined) return;
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = undefined;
    };
    const cancelHoverOpen = (): void => {
      if (hoverOpenTimer.current === undefined) return;
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = undefined;
    };
    const changeOpen = (next: boolean, restoreFocus = false): void => {
      cancelHoverOpen();
      cancelHoverClose();
      if (next) {
        const trigger = triggerRef.current;
        if (trigger === null) return;
        setOpen(true);
        setMenuPosition(catalogMenuPosition(trigger));
      } else {
        pinnedRef.current = false;
        setOpen(false);
        setMenuPosition(undefined);
        setExpanded(new Set<string>());
      }
      if (restoreFocus) {
        queueMicrotask(() => {
          triggerRef.current?.focus();
        });
      }
    };
    const scheduleHoverOpen = (): void => {
      cancelHoverOpen();
      cancelHoverClose();
      if (open) return;
      hoverOpenTimer.current = setTimeout(() => {
        hoverOpenTimer.current = undefined;
        changeOpen(true);
      }, HOVER_OPEN_DELAY_MS);
    };
    const scheduleHoverClose = (): void => {
      cancelHoverOpen();
      cancelHoverClose();
      if (pinnedRef.current) return;
      hoverCloseTimer.current = setTimeout(() => {
        hoverCloseTimer.current = undefined;
        changeOpen(false);
      }, HOVER_CLOSE_DELAY_MS);
    };
    const closeBranch = (rootId: string): void => {
      const closing = new Set<string>();
      const visit = (parentSessionId: string): void => {
        if (closing.has(parentSessionId) || !expanded.has(parentSessionId)) return;
        closing.add(parentSessionId);
        const branch = catalogs[parentSessionId];
        for (const entry of branch?.entries ?? []) visit(entry.id);
      };
      visit(rootId);
      setExpanded((current) => new Set([...current].filter((id) => !closing.has(id))));
    };
    const toggleBranch = (childSessionId: string): void => {
      if (expanded.has(childSessionId)) {
        closeBranch(childSessionId);
        return;
      }
      setExpanded((current) => new Set(current).add(childSessionId));
      props.refreshProjection(childSessionId);
    };
    useEffect(() => {
      if (!open) return;
      const closeOutside = (event: PointerEvent): void => {
        if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) changeOpen(false);
      };
      document.addEventListener("pointerdown", closeOutside);
      return () => {
        document.removeEventListener("pointerdown", closeOutside);
      };
    }, [open]);
    useEffect(() => {
      if (!open) return;
      const placeMenu = (): void => {
        const trigger = triggerRef.current;
        if (trigger === null) return;
        setMenuPosition(catalogMenuPosition(trigger));
      };
      window.addEventListener("resize", placeMenu);
      document.addEventListener("scroll", placeMenu, true);
      return () => {
        window.removeEventListener("resize", placeMenu);
        document.removeEventListener("scroll", placeMenu, true);
      };
    }, [open]);
    useEffect(
      () => () => {
        cancelHoverOpen();
        cancelHoverClose();
      },
      [],
    );
    const visible = presentedCatalog !== undefined && (variant === "switcher" || presentedCatalog.state === "error" || presentedCatalog.entries.length > 0);
    useEffect(() => {
      if (visible) return;
      cancelHoverOpen();
      cancelHoverClose();
      if (!open) return;
      pinnedRef.current = false;
      setOpen(false);
      setExpanded(new Set<string>());
    }, [visible, open]);
    if (!visible) return null;
    if (presentedCatalog === undefined) return null;
    const focusAt = (index: number): void => {
      const items = treeItems(menuRef.current);
      if (items.length === 0) return;
      items[(index + items.length) % items.length]?.focus();
    };
    const navigate = (event: { key: string; preventDefault: () => void }): void => {
      const items = treeItems(menuRef.current);
      const active = document.activeElement;
      const index = active === null ? -1 : items.indexOf(active as HTMLElement);
      if (event.key === "Escape") {
        event.preventDefault();
        changeOpen(false, true);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusAt(0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusAt(items.length - 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        focusAt(index + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusAt(index < 0 ? items.length - 1 : index - 1);
      }
    };
    const menu = jsx("div", {
      ref: menuRef,
      className: styles.menu,
      style: menuPosition,
      onMouseEnter: cancelHoverClose,
      onMouseLeave: scheduleHoverClose,
      children: jsx("div", {
        className: styles.menuBody,
        role: "tree",
        "aria-label": t("tree.aria"),
        children: jsx(CatalogRows, {
          parentSessionId: rootSessionId,
          currentSessionId,
          catalog: presentedCatalog,
          catalogs,
          summaries,
          expanded,
          level: 1,
          openChild: props.openChild,
          openChildAside: props.openChildAside,
          refreshProjection: props.refreshProjection,
          toggleBranch,
          closeCatalog: () => {
            changeOpen(false);
          },
          t,
        }),
      }),
    });
    return jsxs("div", {
      className: styles.root + " " + (variant === "switcher" ? styles.switcherRoot : ""),
      ref: rootRef,
      onKeyDown: navigate,
      onMouseLeave: scheduleHoverClose,
      children: [
        jsxs("button", {
          ref: triggerRef,
          onMouseEnter: scheduleHoverOpen,
          type: "button",
          className:
            variant === "switcher"
              ? styles.switcherTrigger + " " + (ancestorSwitcher ? styles.ancestorSwitcherTrigger : "")
              : styles.trigger,
          "aria-haspopup": "tree",
          "aria-expanded": open,
          "aria-label":
            variant === "switcher"
              ? t("switcher.aria", { title: switcherDisplayTitle ?? "" })
              : t(runningCount > 0 ? runningCountKey : totalCountKey, { count: runningCount > 0 ? runningCount : directCount }),
          onClick:
            props.openTitle === undefined
              ? () => {
                  cancelHoverOpen();
                  cancelHoverClose();
                  pinnedRef.current = true;
                  if (!open) changeOpen(true);
                }
              : () => {
                  cancelHoverOpen();
                  if (open) changeOpen(false);
                  props.openTitle?.();
                },
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key !== "ArrowDown") return;
            event.preventDefault();
            if (!open) changeOpen(true);
            queueMicrotask(() => {
              focusAt(0);
            });
          },
          children: [
            variant === "switcher"
              ? jsx("span", { className: styles.switcherTitle, children: switcherDisplayTitle })
              : jsxs(Fragment, {
                  children: [
                    runningCount > 0 ? jsx("span", { className: styles.activitySlot, children: jsx(primitives.StateDot, { state: "ongoing" }) }) : null,
                    // ⚠️ NGUYEN VAN MOT CHI TIET CUA BAN GOC: ban goc doc
                    // SubagentHeaderLineage_module_css_default.count — khoa nay KHONG co trong bang lop cua
                    // chinh ban goc, nen className la undefined. Giu nguyen hanh vi do (khong tu them lop moi
                    // vao CSS: lam vay la doi hinh dang so voi ban goc).
                    jsx("span", { className: undefined, children: t(totalCountKey, { count: directCount }) }),
                  ],
                }),
            variant === "switcher"
              ? jsx(SubagentSwitcherIcon, {})
              : jsx(primitives.IconChevronDownOutlineRegular, { className: open ? styles.triggerOpen : undefined }),
          ],
        }),
        open ? createPortal(menu, document.body) : null,
      ],
    });
  }

  /**
   * Icon doi phien cua subagent — SVG nguyen van ban goc.
   * Nhan: khong co.
   * Tra: mot element svg.
   */
  function SubagentSwitcherIcon(): unknown {
    return jsxs("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 20 20",
      fill: "none",
      "aria-hidden": "true",
      children: [
        jsx("path", {
          d: "M5.99951 12.7L8.95546 14.9478C9.40011 15.2859 9.62244 15.455 9.87526 15.488C9.95774 15.4988 10.0413 15.4988 10.1238 15.488C10.3766 15.455 10.5989 15.2859 11.0436 14.9478L13.9995 12.7",
          stroke: "currentColor",
          strokeWidth: "1.5",
        }),
        jsx("path", {
          d: "M13.9995 7.7417L11.0436 5.49387C10.5989 5.15574 10.3766 4.98668 10.1238 4.95362C10.0413 4.94283 9.95775 4.94283 9.87527 4.95362C9.62245 4.98668 9.40012 5.15574 8.95547 5.49387L5.99952 7.7417",
          stroke: "currentColor",
          strokeWidth: "1.5",
        }),
      ],
    });
  }

  /**
   * Nut danh muc cua phien goc: so luong con va menu xo ra sau nhan preset trong hang dau phien.
   * Phien con khong render gi o day — nut doi phien trong duong dan pha he lo phan dieu huong do.
   * Nhan: props — props chuan cua slot kem nghiep vu danh muc va ham dich.
   * Tra: menu dem, hoac null voi phien con.
   */
  function SubagentCatalogAction(props: SubagentCatalogActionProps): unknown {
    if (props.useSessions((state) => state.byId[props.sessionId]?.origin === "subagent")) return null;
    return jsx(
      CatalogDropdown,
      {
        rootSessionId: props.sessionId,
        variant: "count",
        useSessions: props.useSessions,
        useSessionStatus: props.useSessionStatus,
        openChild: props.openChild,
        openChildAside: props.openChildAside,
        refreshProjection: props.refreshProjection,
        t: props.t,
      },
      props.sessionId,
    );
  }

  /**
   * Render mot tieu de duong dan cung voi dieu huong subagent cua no.
   * Nhan: props — tieu de duong dan, props chuan cua phien va nghiep vu danh muc.
   * Tra: bo tieu de kem chevron doi phien, hoac null voi phien goc.
   */
  function SubagentHeaderLineage(props: SubagentHeaderLineageProps): unknown {
    const { lineageSessionId, displayTitle, openTitle, useSessions, useSession, useSessionStatus, t } = props;
    const address = useSession((session) => session.subagent?.address);
    const parentId = useSessions((state) => {
      if (address?.childSessionId === lineageSessionId) return address.parentSessionId;
      for (const [candidateId, snapshot] of Object.entries(state.projectionsBySession)) {
        if (snapshot?.values.subagentCatalog?.some((entry) => entry.id === lineageSessionId)) return candidateId;
      }
      const summary = state.byId[lineageSessionId];
      return summary?.origin === "subagent" ? summary.parentId : undefined;
    });
    const shared = {
      useSessions,
      useSessionStatus,
      openChild: props.openChild,
      openChildAside: props.openChildAside,
      refreshProjection: props.refreshProjection,
      t,
    };
    if (parentId === undefined) return null;
    return jsxs(Fragment, {
      children: [
        jsx(
          CatalogDropdown,
          {
            rootSessionId: parentId,
            currentSessionId: lineageSessionId,
            variant: "switcher",
            displayTitle,
            ...(openTitle === undefined ? {} : { openTitle }),
            ...shared,
          },
          "switcher:" + lineageSessionId,
        ),
        openTitle === undefined
          ? jsx(CatalogDropdown, { rootSessionId: lineageSessionId, variant: "count", ...shared }, "children:" + lineageSessionId)
          : null,
      ],
    });
  }

  return { SubagentHeaderLineage, SubagentCatalogAction };
}
