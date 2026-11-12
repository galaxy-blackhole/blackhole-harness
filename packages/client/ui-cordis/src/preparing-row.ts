/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Tiền tố Cordis không mở được (pha preparing) dùng chung cho cả ba họ thẻ — port 1:1 vùng #region CordisPreparingRow.js
 */

import type { CordisRuntime, Translate } from "./runtime.ts";

/* v8 ignore next -- dòng không mở được thì không bao giờ gọi callback toggle bắt buộc của DisclosureRow. */
const noop = (): void => void 0;

/** Props của dòng chuẩn bị Cordis. */
export interface CordisPreparingRowProps {
  /** Tên tool đang chuẩn bị gọi. */
  readonly toolName: string;
  /** Hàm dịch của namespace `cordis`. */
  readonly t: Translate;
  /** Icon đầu dòng. */
  readonly icon: unknown;
  /** Nhãn đầu dòng. */
  readonly title: string;
  /** Lớp CSS của thẻ. */
  readonly className?: string | undefined;
  /** Lớp CSS của dòng. */
  readonly rowClassName?: string | undefined;
  /** Lớp CSS của nhãn. */
  readonly titleClassName?: string | undefined;
}

/**
 * Tạo component dòng chuẩn bị cho một bộ chạy.
 * Nhận: runtime — bộ chạy { jsx, react, primitives } của factory.
 * Trả: component CordisPreparingRow (props → cây element).
 */
export function createCordisPreparingRow(
  runtime: CordisRuntime,
): (props: CordisPreparingRowProps) => unknown {
  const { jsx } = runtime.jsx;
  const { DisclosureRow } = runtime.primitives;
  /**
   * Render tiền tố do Cordis sở hữu, không có disclosure.
   * Nhận: props — tiền tố Cordis, lớp CSS và từ điển.
   * Trả: dòng chuẩn bị.
   */
  function CordisPreparingRow({
    toolName,
    t,
    icon,
    title,
    className,
    rowClassName,
    titleClassName,
  }: CordisPreparingRowProps): unknown {
    return jsx("div", {
      "data-tool": toolName,
      "data-state": "preparing",
      "aria-label": t("a11y.preparing"),
      children: jsx(DisclosureRow, {
        icon,
        title,
        className,
        rowClassName,
        titleClassName,
        open: false,
        expandable: false,
        onToggle: noop,
        running: true,
      }),
    });
  }
  return CordisPreparingRow;
}
