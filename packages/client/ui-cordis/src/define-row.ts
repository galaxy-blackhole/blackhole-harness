/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thẻ cordis_define chỉ-đọc, có hai tab mã nguồn Host/Client — port 1:1 vùng #region CordisDefineRow.js
 */

import { cordisDefineCard, type CordisToolBlock, type CordisToolState } from "./card-model.ts";
import type { CordisInventorySnapshot } from "./inventory.ts";
import type { DynamicCordisLivePackage } from "./events.ts";
import { cordisVisibleStatus } from "./status.ts";
import type { CordisRuntime, Translate, UseObservable } from "./runtime.ts";
import { createCordisPreparingRow } from "./preparing-row.ts";
import { CLASSES } from "./styles/define-row.ts";

/** Cách đọc vòng đời mà thẻ Define hiện được. */
type DefineReading = "idle" | "client-pending" | "running" | "removed";

/** Nhãn trạng thái của thẻ Define (giữ nguyên khoá dịch của bản gốc). */
const READING_LABELS: Readonly<Record<DefineReading, string>> = {
  idle: "status.idle",
  "client-pending": "status.clientPending",
  running: "status.running",
  removed: "status.removed",
};

/**
 * Chọn nhãn trợ năng theo vòng đời lời gọi.
 * Nhận: state — vòng đời của lời gọi tool.
 * Trả: khoá dịch của nhãn trợ năng, hoặc null khi không cần.
 */
function stateStatus(state: CordisToolState): string | null {
  switch (state) {
    case "running":
      return "a11y.defining";
    case "error":
      return "a11y.failed";
    case "stopped":
      return "a11y.stopped";
    default:
      return null;
  }
}

/** Props của thẻ Define. */
export interface CordisDefineRowProps {
  /** Pha của lời gọi: `preparing` là chưa có kết quả. */
  readonly phase?: string | undefined;
  /** Id lời gọi tool. */
  readonly callId: string;
  /** Khối tool call đã đóng băng (chỉ có khi không còn ở pha preparing). */
  readonly block?: CordisToolBlock | undefined;
  /** Mở chi tiết lời gọi. */
  readonly inspect?: (() => void) | undefined;
  /** Hook đọc inventory của Host do slot bơm vào. */
  readonly useInventory: UseObservable<CordisInventorySnapshot>;
  /** Hook đọc tập gói client đã nạp do slot bơm vào. */
  readonly useLoaded: UseObservable<readonly DynamicCordisLivePackage[]>;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/** Props của phần đã bắt đầu của thẻ Define (block bắt buộc). */
interface StartedDefineProps {
  /** Id lời gọi tool. */
  readonly callId: string;
  /** Khối tool call đã đóng băng. */
  readonly block: CordisToolBlock;
  /** Mở chi tiết lời gọi. */
  readonly inspect?: (() => void) | undefined;
  /** Hook đọc inventory của Host. */
  readonly useInventory: UseObservable<CordisInventorySnapshot>;
  /** Hook đọc tập gói client đã nạp. */
  readonly useLoaded: UseObservable<readonly DynamicCordisLivePackage[]>;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/**
 * Tạo component thẻ Define cho một bộ chạy.
 * Nhận: runtime — bộ chạy { jsx, react, primitives } của factory.
 * Trả: component CordisDefineRow (props → cây element).
 */
export function createCordisDefineRow(runtime: CordisRuntime): (props: CordisDefineRowProps) => unknown {
  const { jsx, jsxs } = runtime.jsx;
  const { Fragment } = runtime.jsx;
  const { react } = runtime;
  const {
    DisclosureRow,
    CodeBlock,
    IconCodeOutlineRegular,
    IconInspectOutlineRegular,
  } = runtime.primitives;
  const CordisPreparingRow = createCordisPreparingRow(runtime);

  /**
   * Render một định nghĩa Package bất biến.
   * Nhận: props — pha, khối call, hook inventory/loaded, hàm soi và từ điển.
   * Trả: cây element của thẻ.
   */
  function CordisDefineRow(props: CordisDefineRowProps): unknown {
    if (props.phase === "preparing") {
      return jsx(CordisPreparingRow, {
        ...props,
        icon: jsx(IconCodeOutlineRegular, { size: 14 }),
        title: props.t("row.defineTitle"),
        className: CLASSES.card,
        rowClassName: CLASSES.row,
        titleClassName: CLASSES.title,
      });
    }
    return jsx(StartedCordisDefineRow, { ...props });
  }

  /**
   * Render phần đã bắt đầu của thẻ Define (hai tab nguồn + kết quả + gợi ý bảng).
   * Nhận: props — id lời gọi, khối call, hook inventory/loaded, hàm soi và từ điển.
   * Trả: cây element của thẻ.
   */
  function StartedCordisDefineRow({ callId, block, inspect, useInventory, useLoaded, t }: StartedDefineProps): unknown {
    const card = cordisDefineCard(block);
    const inventory = useInventory((snapshot) => snapshot);
    const loaded = useLoaded((snapshot) => snapshot);
    const [expanded, setExpanded] = react.useState(false);
    const [selectedSource, setSelectedSource] = react.useState<"client" | "host">(
      card.clientCode !== null ? "client" : "host",
    );
    const sourcePanelId = react.useId();
    const row =
      card.pluginId === null
        ? undefined
        : inventory.rows.find((candidate) => candidate.pluginId === card.pluginId);
    const reading: DefineReading =
      card.pluginId !== null && inventory.removed.has(card.pluginId)
        ? "removed"
        : row !== undefined && card.packageId !== null
          ? cordisVisibleStatus(row, card.packageId, loaded)
          : "idle";
    const name = card.name ?? callId;
    const expandable = card.hostCode !== null || card.clientCode !== null || card.output !== null;
    const open = expanded && expandable;
    const a11yState = stateStatus(card.state);
    const hasSource = card.clientCode !== null || card.hostCode !== null;
    const activeSource =
      selectedSource === "client" && card.clientCode !== null
        ? "client"
        : selectedSource === "host" && card.hostCode !== null
          ? "host"
          : card.clientCode !== null
            ? "client"
            : "host";
    const activeCode = activeSource === "client" ? card.clientCode : card.hostCode;
    return jsxs("div", {
      className: CLASSES.card,
      "data-tool": "cordis_define",
      "data-state": card.state,
      "data-terminal": reading === "removed" || undefined,
      "data-cordis-plugin-id": card.pluginId ?? undefined,
      "data-cordis-package-id": card.packageId ?? undefined,
      "data-cordis-status": reading,
      children: [
        a11yState !== null &&
          jsx("span", {
            className: CLASSES.visuallyHidden,
            children: t(a11yState),
          }),
        jsx(DisclosureRow, {
          rowClassName: CLASSES.row,
          titleClassName: CLASSES.title,
          chevronClassName: CLASSES.chevron,
          icon: jsx(IconCodeOutlineRegular, { size: 14 }),
          title: t("row.defineTitle"),
          open,
          expandable,
          expandOnRowClick: true,
          keepContentWhenOpen: true,
          onToggle: () => {
            setExpanded((value) => !value);
          },
          collapsedContent: jsxs(Fragment, {
            children: [
              jsx("span", {
                className: CLASSES.separator,
                "aria-hidden": true,
              }),
              jsx("span", {
                className: card.errorSummary === null ? CLASSES.name : CLASSES.errorSummary,
                children: card.errorSummary ?? name,
              }),
              card.errorSummary === null &&
                jsx("span", {
                  className: CLASSES.purpose,
                  children: card.purpose ?? t("purpose.missing"),
                }),
              card.pluginId !== null &&
                jsx("span", {
                  className: CLASSES.readout,
                  children: jsx("span", {
                    className: CLASSES.statusLabel,
                    children: t(READING_LABELS[reading]),
                  }),
                }),
            ],
          }),
          children: jsxs("div", {
            className: CLASSES.bodyWrap,
            children: [
              hasSource &&
                activeCode !== null &&
                jsxs("section", {
                  className: CLASSES.sourceCard,
                  children: [
                    jsx("div", {
                      className: CLASSES.sourceTabs,
                      role: "tablist",
                      "aria-label": t("body.source"),
                      children: (["client", "host"] as const).map((source) => {
                        const available = source === "client" ? card.clientCode !== null : card.hostCode !== null;
                        return jsx(
                          "button",
                          {
                            id: `${sourcePanelId}-${source}`,
                            type: "button",
                            role: "tab",
                            "aria-controls": sourcePanelId,
                            "aria-selected": activeSource === source,
                            className:
                              activeSource === source
                                ? `${CLASSES.sourceTab} ${CLASSES.sourceTabActive}`
                                : CLASSES.sourceTab,
                            disabled: !available,
                            onClick: () => {
                              setSelectedSource(source);
                            },
                            children: t(source === "client" ? "body.clientCode" : "body.hostCode"),
                          },
                          source,
                        );
                      }),
                    }),
                    jsx("div", {
                      id: sourcePanelId,
                      className: CLASSES.sourcePanel,
                      role: "tabpanel",
                      "aria-labelledby": `${sourcePanelId}-${activeSource}`,
                      children: jsx(CodeBlock, {
                        toolbarLabels: {
                          codeLabel: t("codeBlock.title"),
                          wrapLabel: t("codeBlock.wrap"),
                          unwrapLabel: t("codeBlock.unwrap"),
                        },
                        code: activeCode,
                        lang: "javascript",
                        copyLabel: t("body.copy"),
                        copiedLabel: t("body.copied"),
                        className: CLASSES.sourceCode,
                      }),
                    }),
                  ],
                }),
              card.output !== null &&
                jsxs("section", {
                  className: CLASSES.codeSection,
                  children: [
                    jsx("div", {
                      className: CLASSES.sectionLabel,
                      children: t("body.output"),
                    }),
                    jsx("pre", {
                      className: CLASSES.output,
                      "data-error": card.state === "error" || undefined,
                      children: card.output,
                    }),
                  ],
                }),
              card.pluginId !== null &&
                jsx("div", {
                  className: CLASSES.panelHint,
                  children: t("panel.hint"),
                }),
              inspect !== void 0 &&
                jsxs("button", {
                  type: "button",
                  className: CLASSES.inspectButton,
                  onClick: inspect,
                  children: [jsx(IconInspectOutlineRegular, {}), t("action.inspect")],
                }),
            ],
          }),
        }),
      ],
    });
  }

  return CordisDefineRow;
}
