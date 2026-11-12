/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thẻ cordis_run và chỗ đặt UI tương tác do Package động sở hữu — port 1:1 vùng #region CordisRunRow.js
 */

import { cordisRunCard, type CordisToolBlock } from "./card-model.ts";
import type { CordisInventorySnapshot } from "./inventory.ts";
import type {
  CordisDynamicPluginId,
  CordisRunActivity,
  DynamicCordisLivePackage,
} from "./events.ts";
import { cordisToolViewKey, type CordisRunCardPointer, type CordisToolViewKey } from "./run-card-index.ts";
import { cordisVisibleStatus } from "./status.ts";
import type { CordisRuntime, Translate, UseObservable } from "./runtime.ts";
import { createCordisPreparingRow } from "./preparing-row.ts";
import { CLASSES } from "./styles/run-row.ts";

/** Cách đọc vòng đời mà thẻ Run hiện được. */
type RunReading = "idle" | "awaiting-approval" | "failed" | "client-pending" | "running" | "removed" | "superseded";

/** Nhãn trạng thái của thẻ Run (giữ nguyên khoá dịch của bản gốc). */
const READING_LABELS: Readonly<Record<RunReading, string>> = {
  idle: "status.idle",
  "awaiting-approval": "status.awaitingApproval",
  failed: "status.failed",
  "client-pending": "status.clientPending",
  running: "status.running",
  removed: "status.removed",
  superseded: "status.superseded",
};

/** Props của thẻ Run. */
export interface CordisRunRowProps {
  /** Pha của lời gọi: `preparing` là chưa có kết quả. */
  readonly phase?: string | undefined;
  /** Id lời gọi tool. */
  readonly callId: string;
  /** Khối tool call đã đóng băng (chỉ có khi không còn ở pha preparing). */
  readonly block?: CordisToolBlock | undefined;
  /** Mở chi tiết lời gọi. */
  readonly inspect?: (() => void) | undefined;
  /** Render slot con `tool.view.cordis` do renderer bơm vào. */
  readonly renderSlot: (
    name: string,
    props: Record<string, unknown>,
    options: { entryKey: string; fallback: unknown },
  ) => unknown;
  /** Hook đọc inventory của Host. */
  readonly useInventory: UseObservable<CordisInventorySnapshot>;
  /** Hook đọc tập gói client đã nạp. */
  readonly useLoaded: UseObservable<readonly DynamicCordisLivePackage[]>;
  /** Hook đọc sổ chỉ mục thẻ Run của phiên. */
  readonly useRunCards: UseObservable<ReadonlyMap<CordisToolViewKey, CordisRunCardPointer>>;
  /** Hook đọc hoạt động chạy của runner phía client. */
  readonly useActiveRuns: UseObservable<ReadonlyMap<CordisDynamicPluginId, CordisRunActivity>>;
  /** Công bố kết quả thành công vào sổ chỉ mục của phiên. */
  readonly onObserveRunCard: (pointer: CordisRunCardPointer) => void;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/** Props của phần đã bắt đầu của thẻ Run (block bắt buộc). */
interface StartedRunProps {
  /** Id lời gọi tool. */
  readonly callId: string;
  /** Khối tool call đã đóng băng. */
  readonly block: CordisToolBlock;
  /** Mở chi tiết lời gọi. */
  readonly inspect?: (() => void) | undefined;
  /** Render slot con `tool.view.cordis`. */
  readonly renderSlot: CordisRunRowProps["renderSlot"];
  /** Hook đọc inventory của Host. */
  readonly useInventory: CordisRunRowProps["useInventory"];
  /** Hook đọc tập gói client đã nạp. */
  readonly useLoaded: CordisRunRowProps["useLoaded"];
  /** Hook đọc sổ chỉ mục thẻ Run của phiên. */
  readonly useRunCards: CordisRunRowProps["useRunCards"];
  /** Hook đọc hoạt động chạy của runner phía client. */
  readonly useActiveRuns: CordisRunRowProps["useActiveRuns"];
  /** Công bố kết quả thành công vào sổ chỉ mục của phiên. */
  readonly onObserveRunCard: CordisRunRowProps["onObserveRunCard"];
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/**
 * Tạo component thẻ Run cho một bộ chạy.
 * Nhận: runtime — bộ chạy { jsx, react, primitives } của factory.
 * Trả: component CordisRunRow (props → cây element).
 */
export function createCordisRunRow(runtime: CordisRuntime): (props: CordisRunRowProps) => unknown {
  const { jsx, jsxs } = runtime.jsx;
  const { react } = runtime;
  const { IconCodeOutlineRegular, IconInspectOutlineRegular } = runtime.primitives;
  const CordisPreparingRow = createCordisPreparingRow(runtime);

  /**
   * Render một kết quả kích hoạt và (khi đủ điều kiện) khung UI do Package sở hữu.
   * Nhận: props — pha, khối call, hook inventory/loaded/run-cards/active-runs, hàm công bố và từ điển.
   * Trả: cây element của thẻ.
   */
  function CordisRunRow(props: CordisRunRowProps): unknown {
    if (props.phase === "preparing") {
      return jsx(CordisPreparingRow, {
        ...props,
        icon: jsx(IconCodeOutlineRegular, { size: 14 }),
        title: props.t("row.runTitle"),
        className: CLASSES.card,
        rowClassName: CLASSES.row,
        titleClassName: CLASSES.title,
      });
    }
    return jsx(StartedCordisRunRow, { ...props });
  }

  /**
   * Render phần đã bắt đầu của thẻ Run.
   * Nhận: props — id lời gọi, khối call, hook inventory/loaded/run-cards/active-runs, hàm công bố và từ điển.
   * Trả: cây element của thẻ.
   */
  function StartedCordisRunRow({
    callId,
    block,
    inspect,
    renderSlot,
    useInventory,
    useLoaded,
    useRunCards,
    useActiveRuns,
    onObserveRunCard,
    t,
  }: StartedRunProps): unknown {
    const card = cordisRunCard(block);
    const inventory = useInventory((snapshot) => snapshot);
    const loaded = useLoaded((snapshot) => snapshot);
    const latest = useRunCards((snapshot) => snapshot);
    const activeRuns = useActiveRuns((snapshot) => snapshot);
    const key: CordisToolViewKey | null =
      card.state === "ok" && card.pluginId !== null && card.packageId !== null && card.pluginRunId !== null && card.seq !== null
        ? cordisToolViewKey(card.pluginId, card.packageId)
        : null;
    react.useEffect(() => {
      if (key === null || card.seq === null || card.pluginRunId === null) return;
      onObserveRunCard({
        key,
        callId,
        seq: card.seq,
        pluginRunId: card.pluginRunId,
      });
    }, [callId, card.pluginRunId, card.seq, key, onObserveRunCard]);
    const row =
      card.pluginId === null
        ? undefined
        : inventory.rows.find((candidate) => candidate.pluginId === card.pluginId);
    const pointer = key === null ? undefined : latest.get(key);
    const superseded = pointer !== void 0 && pointer.callId !== callId && pointer.seq >= (card.seq ?? -1);
    const activity = card.pluginId === null ? undefined : activeRuns.get(card.pluginId);
    const attempt = card.pluginRunId !== null && row?.latestRun?.pluginRunId === card.pluginRunId ? row.latestRun : undefined;
    const awaitingApproval =
      attempt?.status === "awaiting-approval" ||
      (card.packageId !== null &&
        activity?.phase === "awaiting-approval" &&
        activity.packageId === card.packageId &&
        (card.mode === null || activity.mode === card.mode));
    const reading: RunReading =
      card.pluginId !== null && inventory.removed.has(card.pluginId)
        ? "removed"
        : superseded
          ? "superseded"
          : awaitingApproval
            ? "awaiting-approval"
            : attempt?.status === "failed"
              ? "failed"
              : row !== undefined && card.packageId !== null
                ? cordisVisibleStatus(row, card.packageId, loaded)
                : "idle";
    const status = t(READING_LABELS[reading]);
    const summary =
      card.errorSummary ??
      (card.pluginId === null
        ? callId
        : `${card.pluginId}${card.packageId === null ? "" : ` · ${card.packageId}`}`);
    const showBusiness = reading === "running" && key !== null;
    return jsxs("div", {
      className: CLASSES.card,
      "data-tool": "cordis_run",
      "data-state": card.state,
      "data-cordis-plugin-id": card.pluginId ?? undefined,
      "data-cordis-package-id": card.packageId ?? undefined,
      "data-cordis-run-id": card.pluginRunId ?? undefined,
      "data-cordis-status": reading,
      children: [
        jsxs("div", {
          className: CLASSES.row,
          children: [
            jsx("span", {
              className: CLASSES.icon,
              children: jsx(IconCodeOutlineRegular, { size: 14 }),
            }),
            jsx("span", {
              className: CLASSES.title,
              children: t(card.mode === "update" ? "row.updateTitle" : "row.runTitle"),
            }),
            jsx("span", {
              className: CLASSES.separator,
              "aria-hidden": true,
            }),
            jsx("span", {
              className: card.errorSummary === null ? CLASSES.summary : CLASSES.error,
              children: summary,
            }),
            jsx("span", {
              className: CLASSES.status,
              children: status,
            }),
            inspect !== void 0 &&
              jsx("button", {
                type: "button",
                className: CLASSES.inspect,
                "aria-label": t("action.inspect"),
                onClick: inspect,
                children: jsx(IconInspectOutlineRegular, {}),
              }),
          ],
        }),
        reading === "removed" &&
          jsx("div", {
            className: CLASSES.message,
            children: t("run.removed"),
          }),
        reading === "superseded" &&
          jsx("div", {
            className: CLASSES.message,
            children: t("run.superseded"),
          }),
        reading === "failed" &&
          attempt?.error !== undefined &&
          jsx("div", {
            className: CLASSES.message,
            children: attempt.error.message,
          }),
        showBusiness &&
          card.pluginId !== null &&
          card.packageId !== null &&
          card.pluginRunId !== null &&
          jsx("div", {
            className: CLASSES.business,
            "data-cordis-business-view": key,
            children: renderSlot(
              "tool.view.cordis",
              {
                pluginId: card.pluginId,
                packageId: card.packageId,
                pluginRunId: card.pluginRunId,
              },
              {
                entryKey: key as CordisToolViewKey,
                fallback:
                  card.output === null
                    ? null
                    : jsx("pre", {
                        className: CLASSES.output,
                        children: card.output,
                      }),
              },
            ),
          }),
        !showBusiness &&
          reading !== "removed" &&
          reading !== "superseded" &&
          card.output !== null &&
          jsx("pre", {
            className: CLASSES.output,
            children: card.output,
          }),
      ],
    });
  }

  return CordisRunRow;
}
