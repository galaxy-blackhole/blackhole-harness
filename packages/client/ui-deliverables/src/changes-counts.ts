/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bo dem dong them/bot cua mot file da doi — dung chung cho the file va tab so sanh
 */

import { ReviewTabCss } from "./class-names.ts";
import type { ChangedFile } from "./changes.ts";
import { runtime, type Any } from "./runtime.ts";
import type { Translations } from "./translate.ts";

/** Bo dinh dang so co nhom nghin, nguyen van ban goc. */
export const GROUPED = new Intl.NumberFormat("en-US");

/**
 * Chi so file ma mot lan dieu huong neu ten, khi no co neu.
 * Nhan: params — tham so cua tab (co the undefined).
 * Tra: chi so nguyen khong am, hoac undefined.
 */
export function navigatedIndex(params: { index?: unknown } | undefined): number | undefined {
  const index = params?.index;
  return typeof index === "number" && Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

/**
 * Bo dem "+N -M" cua mot file, hoac nhan "nhi phan"/"qua lon".
 * Nhan: props.file — ban ghi file da doi; props.t — ham dich cua namespace deliverables.
 * Tra: node hien thi bo dem.
 */
export function Counts(props: { file: ChangedFile; t: Translations }): Any {
  const { file, t } = props;
  const { jsx, jsxs, Fragment } = runtime();
  if (file.binary === true) {
    return jsx("span", { className: ReviewTabCss["label"], children: t("changes.binary") });
  }
  if (file.oversized === true) {
    return jsx("span", { className: ReviewTabCss["label"], children: t("changes.oversized") });
  }
  return jsxs(Fragment, {
    children: [
      jsx("span", { className: ReviewTabCss["added"], children: t("changes.added", { count: GROUPED.format(file.added) }) }),
      jsx("span", { className: ReviewTabCss["deleted"], children: t("changes.deleted", { count: GROUPED.format(file.deleted) }) }),
    ],
  });
}
