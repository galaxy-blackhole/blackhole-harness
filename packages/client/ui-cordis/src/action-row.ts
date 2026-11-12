/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thẻ có bản địa hoá cho cordis_stop và cordis_undefine — port 1:1 vùng #region CordisActionRow.js
 */

import { cordisActionCard, type CordisToolBlock } from "./card-model.ts";
import type { CordisRuntime, Translate } from "./runtime.ts";
import { createCordisPreparingRow } from "./preparing-row.ts";
import { CLASSES } from "./styles/run-row.ts";

/** Props của thẻ thao tác vòng đời (Stop/Remove). */
export interface CordisActionRowProps {
  /** Pha của lời gọi: `preparing` là chưa có kết quả. */
  readonly phase?: string | undefined;
  /** Id lời gọi tool. */
  readonly callId: string;
  /** Tên tool (`cordis_stop`/`cordis_undefine`). */
  readonly toolName: string;
  /** Khối tool call đã đóng băng (chỉ có khi không còn ở pha preparing). */
  readonly block?: CordisToolBlock | undefined;
  /** Mở chi tiết lời gọi (không có thì không hiện nút soi). */
  readonly inspect?: (() => void) | undefined;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/** Props của phần đã bắt đầu của thẻ thao tác (block bắt buộc). */
interface StartedActionProps {
  /** Id lời gọi tool. */
  readonly callId: string;
  /** Tên tool. */
  readonly toolName: string;
  /** Khối tool call đã đóng băng. */
  readonly block: CordisToolBlock;
  /** Mở chi tiết lời gọi. */
  readonly inspect?: (() => void) | undefined;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
}

/**
 * Tạo component thẻ Stop/Remove cho một bộ chạy.
 * Nhận: runtime — bộ chạy { jsx, react, primitives } của factory.
 * Trả: component CordisActionRow (props → cây element).
 */
export function createCordisActionRow(runtime: CordisRuntime): (props: CordisActionRowProps) => unknown {
  const { jsx, jsxs } = runtime.jsx;
  const { IconTrashOutlineRegular, IconStopFillRegular, IconInspectOutlineRegular } = runtime.primitives;
  const CordisPreparingRow = createCordisPreparingRow(runtime);

  /**
   * Render một lời gọi Stop hoặc Remove bằng chữ do Cordis sở hữu.
   * Nhận: props — pha, tên tool, khối call và từ điển.
   * Trả: cây element của thẻ.
   */
  function CordisActionRow(props: CordisActionRowProps): unknown {
    if (props.phase === "preparing") {
      const remove = props.toolName === "cordis_undefine";
      return jsx(CordisPreparingRow, {
        ...props,
        icon: remove
          ? jsx(IconTrashOutlineRegular, { size: 14 })
          : jsx(IconStopFillRegular, { size: 14 }),
        title: props.t(remove ? "row.removeTitle" : "row.stopTitle"),
        className: CLASSES.card,
        rowClassName: CLASSES.row,
        titleClassName: CLASSES.title,
      });
    }
    return jsx(StartedCordisActionRow, { ...props });
  }

  /**
   * Render phần đã bắt đầu của thẻ thao tác.
   * Nhận: props — id lời gọi, tên tool, khối call, hàm soi và từ điển.
   * Trả: cây element của thẻ.
   */
  function StartedCordisActionRow({ callId, toolName, block, inspect, t }: StartedActionProps): unknown {
    const card = cordisActionCard(block);
    const remove = toolName === "cordis_undefine";
    const summary = card.errorSummary ?? card.pluginId ?? callId;
    return jsxs("div", {
      className: CLASSES.card,
      "data-tool": toolName,
      "data-state": card.state,
      children: [
        jsxs("div", {
          className: CLASSES.row,
          children: [
            jsx("span", {
              className: CLASSES.icon,
              children: remove
                ? jsx(IconTrashOutlineRegular, { size: 14 })
                : jsx(IconStopFillRegular, { size: 14 }),
            }),
            jsx("span", {
              className: CLASSES.title,
              children: t(remove ? "row.removeTitle" : "row.stopTitle"),
            }),
            jsx("span", {
              className: CLASSES.separator,
              "aria-hidden": true,
            }),
            jsx("span", {
              className: card.errorSummary === null ? CLASSES.summary : CLASSES.error,
              children: summary,
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
        card.output !== null &&
          jsx("pre", {
            className: CLASSES.output,
            children: card.output,
          }),
      ],
    });
  }

  return CordisActionRow;
}
