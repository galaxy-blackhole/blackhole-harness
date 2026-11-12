/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng Cordis toàn khung hình: inventory, phê duyệt, phiên bản và thao tác vòng đời của Plugin động — port 1:1 vùng #region CordisPanel.js
 */

import type {
  ApprovalRequestId,
  CordisActionResult,
  CordisDynamicPackageId,
  CordisDynamicPluginId,
  CordisRunActivity,
  CordisRunFailure,
  CordisUserRunRequest,
  DynamicCordisInventoryRow,
  DynamicCordisLivePackage,
  DynamicCordisRenderFailure,
  SessionId,
} from "./events.ts";
import type { CordisInventorySnapshot } from "./inventory.ts";
import type { CordisRuntime, Translate, UseObservable } from "./runtime.ts";
import { cordisVisibleStatus, packageOf } from "./status.ts";
import { CLASSES } from "./styles/panel.ts";

/** Cách đọc vòng đời mà bảng hiện được. */
type PanelStatus = "idle" | "awaiting-approval" | "client-pending" | "running" | "failed";

/** Nhãn trạng thái của bảng (giữ nguyên khoá dịch của bản gốc). */
const STATUS_LABELS: Readonly<Record<PanelStatus, string>> = {
  idle: "status.idle",
  "awaiting-approval": "status.awaitingApproval",
  "client-pending": "status.clientPending",
  running: "status.running",
  failed: "status.failed",
};

/** Nhãn lỗi render theo việc Guard đã trả slot về UI mặc định hay chưa. */
const RENDER_FAILURE_LABELS = {
  abdicated: "render.failedAbdicated",
  held: "render.failedHeld",
} as const;

/** Trạng thái phiên mà bảng cần để biết phiên nào đang ở khung hình chính. */
export interface CordisSessionState {
  /** Phiên theo id. */
  readonly byId: Readonly<
    Record<string, { readonly id: string; readonly retainedBy: { readonly mainView?: number } }>
  >;
}

/** Một dòng của bảng: Plugin cùng dòng inventory và/hoặc hoạt động đang chạy. */
interface PanelView {
  /** Id Plugin. */
  readonly pluginId: CordisDynamicPluginId;
  /** Id agent sở hữu. */
  readonly agentId: string;
  /** Dòng inventory (khi Host đã có Plugin). */
  readonly listed?: DynamicCordisInventoryRow | undefined;
  /** Hoạt động chạy phía client (khi runner đang bận). */
  readonly activity?: CordisRunActivity | undefined;
}

/** Vị trí đặt bảng nổi (toạ độ viewport). */
interface PanelAnchor {
  /** Cạnh trái. */
  readonly left: number;
  /** Khoảng cách từ đáy viewport. */
  readonly bottom: number;
}

/** Props của bảng Cordis. */
export interface CordisPanelProps {
  /** Thanh bên đang ở dạng rộng (hiện nhãn + số đang chạy). */
  readonly wide?: boolean | undefined;
  /** Hook đọc state phiên. */
  readonly useSessions: UseObservable<CordisSessionState>;
  /** Hook đọc inventory của Host. */
  readonly useInventory: UseObservable<CordisInventorySnapshot>;
  /** Hook đọc hoạt động chạy phía client. */
  readonly useActiveRuns: UseObservable<ReadonlyMap<CordisDynamicPluginId, CordisRunActivity>>;
  /** Hook đọc lỗi chạy gần nhất. */
  readonly useRunErrors: UseObservable<ReadonlyMap<CordisDynamicPluginId, CordisRunFailure>>;
  /** Hook đọc tập gói client đã nạp. */
  readonly useLoaded: UseObservable<readonly DynamicCordisLivePackage[]>;
  /** Hook đọc lỗi render slot. */
  readonly useRenderFailures: UseObservable<ReadonlyMap<CordisDynamicPluginId, DynamicCordisRenderFailure>>;
  /** Phê duyệt một yêu cầu (chỉ lần này hoặc cho mọi phiên bản sau). */
  readonly onApprove: (requestId: ApprovalRequestId, approveFutureVersions: boolean) => Promise<void>;
  /** Từ chối một yêu cầu. */
  readonly onDecline: (requestId: ApprovalRequestId) => Promise<void>;
  /** Chạy (hoặc cập nhật) một Package. */
  readonly onRun: (request: CordisUserRunRequest) => Promise<CordisActionResult | undefined>;
  /** Dừng một Plugin. */
  readonly onStop: (sessionId: SessionId, pluginId: CordisDynamicPluginId) => Promise<CordisActionResult>;
  /** Xoá một Plugin cùng mọi Package. */
  readonly onRemove: (sessionId: SessionId, pluginId: CordisDynamicPluginId) => Promise<CordisActionResult>;
  /** Đọc lại inventory. */
  readonly onRefresh: () => void;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/**
 * Chọn Package đang được xem cho một dòng.
 * Nhận: view — dòng bảng ({ pluginId, listed, activity }); selected — bảng chọn thủ công theo Plugin.
 * Trả: id Package đang chọn (hoặc Package kế tiếp / hiện hành / cuối cùng của dòng).
 */
function selectedPackageIdOf(
  { pluginId, listed, activity }: { pluginId: CordisDynamicPluginId; listed?: DynamicCordisInventoryRow | undefined; activity?: CordisRunActivity | undefined },
  selected: Readonly<Record<string, CordisDynamicPackageId>>,
): CordisDynamicPackageId | undefined {
  const selectedPackageId = selected[pluginId];
  if (selectedPackageId !== undefined && listed?.packages.some((pkg) => pkg.packageId === selectedPackageId)) {
    return selectedPackageId;
  }
  return listed?.nextPackageId ?? listed?.currentPackageId ?? listed?.packages.at(-1)?.packageId ?? activity?.packageId;
}

/**
 * Suy ra trạng thái hiển thị của một dòng bảng.
 * Nhận: view — dòng bảng; selectedPackageId — Package đang xem; loaded — tập gói client đã nạp.
 * Trả: trạng thái hiển thị (đang chờ duyệt, hỏng, chưa chạy, client chờ, đang chạy).
 */
function visiblePanelStatus(
  view: { listed?: DynamicCordisInventoryRow | undefined; activity?: CordisRunActivity | undefined },
  selectedPackageId: CordisDynamicPackageId | undefined,
  loaded: readonly DynamicCordisLivePackage[],
): PanelStatus {
  const { listed, activity } = view;
  const latest = listed?.latestRun;
  if (activity?.phase === "awaiting-approval" || latest?.status === "awaiting-approval") return "awaiting-approval";
  if (latest?.status === "failed" && latest.packageId === selectedPackageId) return "failed";
  if (listed?.activeRun === undefined) return "idle";
  return cordisVisibleStatus(listed, listed.activeRun.packageId, loaded);
}

/**
 * Chuyển trạng thái hiển thị thành trạng thái chấm.
 * Nhận: status — trạng thái của dòng; busy — dòng đang có thao tác chạy.
 * Trả: trạng thái cho `StateDot` (`ongoing`/`idle`/`done`/`warning`/`error`).
 */
function panelDotState(status: PanelStatus, busy: boolean): string | undefined {
  if (busy) return "ongoing";
  switch (status) {
    case "idle":
      return "idle";
    case "client-pending":
      return "ongoing";
    case "running":
      return "done";
    case "awaiting-approval":
      return "warning";
    case "failed":
      return "error";
  }
}

/**
 * Sắp các dòng: dòng đang chờ duyệt lên trước, còn lại giữ nguyên thứ tự.
 * Nhận: rows — các dòng của bảng.
 * Trả: mảng dòng đã sắp.
 */
function blockingFirst(rows: readonly PanelView[]): PanelView[] {
  return [
    ...rows.filter((row) => row.activity?.phase === "awaiting-approval"),
    ...rows.filter((row) => row.activity?.phase !== "awaiting-approval"),
  ];
}

/**
 * Tạo component bảng Cordis cho một bộ chạy.
 * Nhận: runtime — bộ chạy { jsx, react, primitives } của factory.
 * Trả: component CordisPanel (props → cây element, hoặc null khi chưa có Plugin nào).
 */
export function createCordisPanel(runtime: CordisRuntime): (props: CordisPanelProps) => unknown {
  const { jsx, jsxs } = runtime.jsx;
  const { Fragment } = runtime.jsx;
  const { react } = runtime;
  const {
    Tooltip,
    StateDot,
    useDismissOnOutsidePointer,
    IconCheckOutlineRegular,
    IconCloseOutlineRegular,
    IconCordisPluginOutlineRegular,
    IconPlayOutlineRegular,
    IconStopFillRegular,
    IconTrashOutlineRegular,
  } = runtime.primitives;

  /** Props của nút thao tác kèm chú thích. */
  interface RowActionProps extends Record<string, unknown> {
    /** Nhãn (cũng là aria-label) của nút. */
    readonly label: string;
    /** Nội dung nút (icon). */
    readonly children: unknown;
  }

  /**
   * Một nút thao tác có chú thích hiện khi rê chuột.
   * Nhận: props — nhãn và nội dung nút; các prop còn lại chuyển nguyên cho `<button>`.
   * Trả: cây element của nút.
   */
  function RowAction({ label, children, ...props }: RowActionProps): unknown {
    return jsx(Tooltip, {
      label,
      side: "bottom",
      delayMs: 500,
      children: jsx("button", {
        type: "button",
        className: CLASSES.actionButton,
        "aria-label": label,
        ...props,
        children,
      }),
    });
  }

  /**
   * Icon hai dấu kiểm — "cho phép mọi phiên bản sau của Plugin".
   * Nhận: không.
   * Trả: cây element của icon.
   */
  function DoubleCheckIcon(): unknown {
    return jsxs("span", {
      className: CLASSES.doubleCheck,
      "aria-hidden": true,
      children: [
        jsx(IconCheckOutlineRegular, { size: 12 }),
        jsx(IconCheckOutlineRegular, { size: 12 }),
      ],
    });
  }

  /**
   * Render bảng inventory cùng một nút chân duy nhất.
   * Nhận: props — trạng thái phiên/inventory/hoạt động, các verb vòng đời và từ điển.
   * Trả: cây element của bảng (hoặc null khi inventory rỗng).
   */
  function CordisPanel({
    wide,
    useSessions,
    useInventory,
    useActiveRuns,
    useRunErrors,
    useLoaded,
    useRenderFailures,
    onApprove,
    onDecline,
    onRun,
    onStop,
    onRemove,
    onRefresh,
    t,
  }: CordisPanelProps): unknown {
    const inventory = useInventory((snapshot) => snapshot);
    const activeRuns = useActiveRuns((snapshot) => snapshot);
    const errors = useRunErrors((snapshot) => snapshot);
    const loaded = useLoaded((snapshot) => snapshot);
    const renderFailures = useRenderFailures((snapshot) => snapshot);
    const current = useSessions((state) =>
      Object.values(state.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id,
    );
    const [open, setOpen] = react.useState(false);
    const [selected, setSelected] = react.useState<Record<string, CordisDynamicPackageId>>({});
    const [pending, setPending] = react.useState<Set<string>>(new Set<string>());
    const [actionErrors, setActionErrors] = react.useState<Map<string, string>>(new Map<string, string>());
    const visibleRequests = react.useRef<Set<ApprovalRequestId>>(new Set<ApprovalRequestId>());
    const rootRef = react.useRef<HTMLElement | null>(null);
    const [anchor, setAnchor] = react.useState<PanelAnchor | undefined>(undefined);
    react.useLayoutEffect(() => {
      if (!open) return;
      const place = (): void => {
        const rect = rootRef.current?.getBoundingClientRect();
        if (rect !== undefined) {
          setAnchor({
            left: rect.left,
            bottom: window.innerHeight - rect.top + 8,
          });
        }
      };
      place();
      window.addEventListener("resize", place);
      return () => {
        window.removeEventListener("resize", place);
      };
    }, [open]);
    useDismissOnOutsidePointer(rootRef, open, setOpen);
    react.useEffect(() => {
      const now = new Set<ApprovalRequestId>();
      for (const activity of activeRuns.values()) {
        if (activity.phase === "awaiting-approval") now.add(activity.requestId);
      }
      const discovered = [...now].some((requestId) => !visibleRequests.current.has(requestId));
      visibleRequests.current = now;
      if (discovered) setOpen(true);
    }, [activeRuns]);
    react.useEffect(() => {
      onRefresh();
    }, [onRefresh]);
    react.useEffect(() => {
      if (open) onRefresh();
    }, [onRefresh, open]);
    const byPlugin = new Map<CordisDynamicPluginId, PanelView>();
    for (const listed of inventory.rows) {
      const activity = activeRuns.get(listed.pluginId);
      byPlugin.set(listed.pluginId, {
        pluginId: listed.pluginId,
        agentId: activity?.agentId ?? listed.agentId,
        listed,
        ...(activity === undefined ? {} : { activity }),
      });
    }
    for (const [pluginId, activity] of activeRuns) {
      if (byPlugin.has(pluginId)) continue;
      byPlugin.set(pluginId, {
        pluginId,
        agentId: activity.agentId,
        activity,
      });
    }
    const all = [...byPlugin.values()];
    const mine = blockingFirst(all.filter((row) => current !== undefined && row.agentId === current));
    const theirs = blockingFirst(all.filter((row) => current === undefined || row.agentId !== current));
    const approvals = [...activeRuns.values()].filter((activity) => activity.phase === "awaiting-approval").length;
    const running = all.filter(
      (view) => visiblePanelStatus(view, selectedPackageIdOf(view, selected), loaded) === "running",
    ).length;
    if (all.length === 0) return null;
    const runAction = async (
      pluginId: string,
      action: () => Promise<CordisActionResult | undefined>,
    ): Promise<void> => {
      if (pending.has(pluginId)) return;
      setPending((currentPending) => new Set(currentPending).add(pluginId));
      setActionErrors((currentErrors) => {
        const next = new Map(currentErrors);
        next.delete(pluginId);
        return next;
      });
      try {
        const result = await action();
        if (result !== undefined && !result.ok) {
          setActionErrors((currentErrors) => new Map(currentErrors).set(pluginId, result.message ?? "operation failed"));
        }
      } catch (error) {
        setActionErrors((currentErrors) =>
          new Map(currentErrors).set(pluginId, error instanceof Error ? error.message : String(error)),
        );
      } finally {
        setPending((currentPending) => {
          const next = new Set(currentPending);
          next.delete(pluginId);
          return next;
        });
        onRefresh();
      }
    };
    /**
     * Render một dòng Plugin cùng các nút thao tác của nó.
     * Nhận: view — dòng bảng cần render.
     * Trả: cây element của dòng (thẻ `<li>`).
     */
    const renderRow = (view: PanelView): unknown => {
      const { pluginId, listed, activity } = view;
      const selectedPackageId = selectedPackageIdOf(view, selected);
      const selectedPackage =
        listed !== undefined && selectedPackageId !== undefined ? packageOf(listed, selectedPackageId) : undefined;
      const activePackage =
        listed?.activeRun === undefined ? undefined : packageOf(listed, listed.activeRun.packageId);
      const name =
        selectedPackage?.name ??
        (activity?.phase === "awaiting-approval" ? activity.name : pluginId);
      const purpose =
        selectedPackage?.purpose ?? (activity?.phase === "awaiting-approval" ? activity.purpose : "");
      const latest = listed?.latestRun;
      const awaiting =
        activity?.phase === "awaiting-approval"
          ? activity.requestId
          : latest?.status === "awaiting-approval"
            ? latest.approvalRequestId
            : undefined;
      const status = visiblePanelStatus(view, selectedPackageId, loaded);
      const busy = pending.has(pluginId) || activity?.phase === "orchestrating";
      const failure = errors.get(pluginId);
      const hostFailure = latest?.status === "failed" ? latest.error : undefined;
      const renderFailure = renderFailures.get(pluginId);
      const actionError = actionErrors.get(pluginId);
      const nextPackageId =
        listed?.nextPackageId !== undefined && listed.nextPackageId !== listed.currentPackageId
          ? listed.nextPackageId
          : undefined;
      const currentPackageId = listed?.currentPackageId;
      const runMode =
        listed?.currentPackageId !== undefined && selectedPackageId !== listed.currentPackageId ? "update" : "run";
      return jsxs(
        "li",
        {
          className: CLASSES.row,
          "data-cordis-row": pluginId,
          "data-cordis-status": status,
          "data-cordis-awaiting": awaiting !== undefined || undefined,
          children: [
            jsxs("div", {
              className: CLASSES.rowHead,
              children: [
                jsx("span", {
                  className: CLASSES.rowId,
                  children: pluginId,
                }),
                jsx("span", {
                  className: CLASSES.rowName,
                  children: name,
                }),
                jsxs("span", {
                  className: CLASSES.rowStatus,
                  children: [
                    jsx(StateDot, { state: panelDotState(status, busy) }),
                    jsx("span", { children: t(STATUS_LABELS[status]) }),
                  ],
                }),
              ],
            }),
            listed !== undefined &&
              listed.packages.length > 1 &&
              selectedPackageId !== undefined &&
              jsxs("label", {
                className: CLASSES.versionPicker,
                children: [
                  jsx("span", { children: t("panel.version") }),
                  jsx("select", {
                    value: selectedPackageId,
                    disabled: busy,
                    onChange: (event: { target: { value: CordisDynamicPackageId } }) => {
                      setSelected((currentSelected) => ({
                        ...currentSelected,
                        [pluginId]: event.target.value,
                      }));
                    },
                    children: listed.packages.map((pkg) =>
                      jsx(
                        "option",
                        {
                          value: pkg.packageId,
                          children: `${pkg.name} · ${pkg.packageId}`,
                        },
                        pkg.packageId,
                      ),
                    ),
                  }),
                ],
              }),
            jsxs("div", {
              className: CLASSES.rowDetail,
              children: [
                jsx("span", {
                  className: CLASSES.rowPurpose,
                  children: purpose,
                }),
                jsxs("div", {
                  className: CLASSES.rowActions,
                  children: [
                    awaiting !== undefined &&
                      jsxs(Fragment, {
                        children: [
                          jsx(RowAction, {
                            label: t("action.approveOnce"),
                            "data-cordis-approve": awaiting,
                            disabled: busy,
                            onClick: () => {
                              void runAction(pluginId, async () => {
                                await onApprove(awaiting, false);
                                setOpen(false);
                                return undefined;
                              });
                            },
                            children: jsx(IconCheckOutlineRegular, { size: 14 }),
                          }),
                          jsx(RowAction, {
                            label: t("action.approvePlugin"),
                            "data-cordis-approve-plugin": awaiting,
                            disabled: busy,
                            onClick: () => {
                              void runAction(pluginId, async () => {
                                await onApprove(awaiting, true);
                                setOpen(false);
                                return undefined;
                              });
                            },
                            children: jsx(DoubleCheckIcon, {}),
                          }),
                          jsx(RowAction, {
                            label: t("action.decline"),
                            "data-cordis-decline": awaiting,
                            disabled: busy,
                            onClick: () => {
                              void runAction(pluginId, async () => {
                                await onDecline(awaiting);
                                setOpen(false);
                                return undefined;
                              });
                            },
                            children: jsx(IconCloseOutlineRegular, { size: 14 }),
                          }),
                        ],
                      }),
                    awaiting === undefined &&
                      listed !== undefined &&
                      selectedPackageId !== undefined &&
                      listed.activeRun === undefined &&
                      jsx(RowAction, {
                        label: t("action.run"),
                        "data-cordis-switch": "run",
                        disabled: busy,
                        onClick: () => {
                          void runAction(pluginId, () =>
                            onRun({
                              agentId: listed.agentId,
                              pluginId,
                              packageId: selectedPackageId,
                              mode: runMode,
                              hasClientHalf: selectedPackage?.hasClientHalf === true,
                            }),
                          );
                        },
                        children: jsx(IconPlayOutlineRegular, { size: 14 }),
                      }),
                    awaiting === undefined &&
                      listed !== undefined &&
                      listed.activeRun !== undefined &&
                      selectedPackageId !== listed.activeRun.packageId &&
                      selectedPackage !== undefined &&
                      jsx(RowAction, {
                        label: t("action.run"),
                        "data-cordis-switch": "run",
                        disabled: busy,
                        onClick: () => {
                          void runAction(pluginId, () =>
                            onRun({
                              agentId: listed.agentId,
                              pluginId,
                              packageId: selectedPackage.packageId,
                              mode: runMode,
                              hasClientHalf: selectedPackage.hasClientHalf,
                            }),
                          );
                        },
                        children: jsx(IconPlayOutlineRegular, { size: 14 }),
                      }),
                    awaiting === undefined &&
                      listed !== undefined &&
                      listed.activeRun !== undefined &&
                      status === "client-pending" &&
                      activePackage !== undefined &&
                      selectedPackageId === listed.activeRun.packageId &&
                      jsx(RowAction, {
                        label: t("action.run"),
                        "data-cordis-switch": "run",
                        disabled: busy,
                        onClick: () => {
                          void runAction(pluginId, () =>
                            onRun({
                              agentId: listed.agentId,
                              pluginId,
                              packageId: activePackage.packageId,
                              mode: "run",
                              hasClientHalf: true,
                            }),
                          );
                        },
                        children: jsx(IconPlayOutlineRegular, { size: 14 }),
                      }),
                    awaiting === undefined &&
                      listed !== undefined &&
                      listed.activeRun !== undefined &&
                      jsx(RowAction, {
                        label: t("action.stop"),
                        "data-cordis-switch": "stop",
                        disabled: busy,
                        onClick: () => {
                          void runAction(pluginId, () => onStop(listed.agentId, pluginId));
                        },
                        children: jsx(IconStopFillRegular, { size: 14 }),
                      }),
                    awaiting === undefined &&
                      listed !== undefined &&
                      jsx(RowAction, {
                        label: t("action.remove"),
                        "data-cordis-remove": pluginId,
                        disabled: busy,
                        onClick: () => {
                          void runAction(pluginId, () => onRemove(listed.agentId, pluginId));
                        },
                        children: jsx(IconTrashOutlineRegular, { size: 14 }),
                      }),
                  ],
                }),
              ],
            }),
            awaiting === undefined &&
              nextPackageId !== undefined &&
              listed !== undefined &&
              jsxs("div", {
                className: CLASSES.transition,
                children: [
                  jsx("span", {
                    children:
                      currentPackageId === undefined ? "" : t("panel.current", { packageId: currentPackageId }),
                  }),
                  jsx("span", { children: t("panel.next", { packageId: nextPackageId }) }),
                  jsxs("div", {
                    className: CLASSES.transitionActions,
                    children: [
                      jsx("button", {
                        type: "button",
                        disabled: busy,
                        onClick: () => {
                          void runAction(pluginId, () =>
                            onRun({
                              agentId: listed.agentId,
                              pluginId,
                              packageId: nextPackageId,
                              mode: currentPackageId === undefined ? "run" : "update",
                              hasClientHalf: packageOf(listed, nextPackageId)?.hasClientHalf === true,
                            }),
                          );
                        },
                        children: t("action.retry"),
                      }),
                      currentPackageId !== undefined &&
                        jsx("button", {
                          type: "button",
                          disabled: busy,
                          onClick: () => {
                            void runAction(pluginId, () =>
                              onRun({
                                agentId: listed.agentId,
                                pluginId,
                                packageId: currentPackageId,
                                mode: "run",
                                hasClientHalf: packageOf(listed, currentPackageId)?.hasClientHalf === true,
                              }),
                            );
                          },
                          children: t("action.rollback"),
                        }),
                    ],
                  }),
                ],
              }),
            failure !== undefined &&
              jsx("div", {
                className: CLASSES.rowError,
                role: "alert",
                children: `${failure.message} (${failure.reason})`,
              }),
            failure === undefined &&
              hostFailure !== undefined &&
              jsx("div", {
                className: CLASSES.rowError,
                role: "alert",
                children: `${hostFailure.message} (${hostFailure.phase})`,
              }),
            actionError !== undefined &&
              jsx("div", {
                className: CLASSES.rowError,
                role: "alert",
                children: actionError,
              }),
            renderFailure !== undefined &&
              jsx("div", {
                className: CLASSES.rowError,
                role: "alert",
                "data-cordis-render-failure": renderFailure.slot,
                "data-cordis-render-abdicated": renderFailure.abdicated || undefined,
                children: `${t(RENDER_FAILURE_LABELS[renderFailure.abdicated ? "abdicated" : "held"], { slot: renderFailure.slot })} ${renderFailure.message}`,
              }),
            activePackage !== undefined &&
              activePackage.packageId !== selectedPackageId &&
              jsx("span", {
                className: CLASSES.activeVersion,
                children: `${t("status.running")}: ${activePackage.name} · ${activePackage.packageId}`,
              }),
          ],
        },
        pluginId,
      );
    };
    return jsxs("div", {
      ref: rootRef,
      className: wide ? CLASSES.layer : `${CLASSES.layer} ${CLASSES.rail}`,
      children: [
        open &&
          anchor !== undefined &&
          jsxs("section", {
            className: CLASSES.panel,
            style: anchor,
            "data-cordis-panel": true,
            "aria-label": t("panel.title"),
            children: [
              jsx("header", {
                className: CLASSES.header,
                children: jsx("span", {
                  className: CLASSES.title,
                  children: t("panel.title"),
                }),
              }),
              jsxs("div", {
                className: CLASSES.body,
                children: [
                  inventory.error !== undefined &&
                    jsx("p", {
                      className: CLASSES.readError,
                      role: "alert",
                      children: t("panel.readFailed", { message: inventory.error }),
                    }),
                  !inventory.read &&
                    inventory.error === undefined &&
                    jsx("p", {
                      className: CLASSES.note,
                      children: t("panel.loading"),
                    }),
                  inventory.read &&
                    all.length === 0 &&
                    jsx("p", {
                      className: CLASSES.note,
                      children: t("panel.empty"),
                    }),
                  mine.length > 0 &&
                    jsxs("section", {
                      children: [
                        jsx("h3", {
                          className: CLASSES.group,
                          children: t("panel.group.current"),
                        }),
                        jsx("ul", {
                          className: CLASSES.rows,
                          children: mine.map(renderRow),
                        }),
                      ],
                    }),
                  theirs.length > 0 &&
                    jsxs("section", {
                      children: [
                        jsx("h3", {
                          className: CLASSES.group,
                          children: t("panel.group.others"),
                        }),
                        jsx("ul", {
                          className: CLASSES.rows,
                          children: theirs.map(renderRow),
                        }),
                      ],
                    }),
                ],
              }),
            ],
          }),
        jsx("div", {
          className: CLASSES.footerButtons,
          children: jsxs("button", {
            type: "button",
            className: CLASSES.badge,
            "data-cordis-badge": all.length,
            "data-cordis-approval-badge": approvals,
            "data-active": approvals > 0 || undefined,
            "aria-label": t("panel.plugins.aria"),
            "aria-expanded": open,
            onClick: () => {
              setOpen((value) => !value);
            },
            children: [
              jsx(IconCordisPluginOutlineRegular, { size: wide === true ? 16 : 18 }),
              wide === true &&
                jsxs(Fragment, {
                  children: [
                    jsx("span", {
                      className: CLASSES.badgeLabel,
                      children: t("panel.trigger"),
                    }),
                    jsx("span", {
                      className: CLASSES.badgeCount,
                      children: t("panel.runningCount", { count: running }),
                    }),
                  ],
                }),
            ],
          }),
        }),
      ],
    });
  }

  return CordisPanel;
}
