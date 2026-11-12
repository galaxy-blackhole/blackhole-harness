/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Du lieu khai bao ROW LONG 'tool-plugin-market' — chinh la payload cho 'gbh.nested' cua goi.
 *      Nguon doi chieu (CHI DOC): apps/host/node_modules/@deepseek-ai/dsh-web-app/presets/{standard,ptc,cordis}.patch.yml
 */

import { NESTED_ROW_ID, PACKAGE_NAME, STOCK_PACKAGE_NAME, TOOLS_SUBPATH } from "./ids.ts";

/** Một khai báo row LỒNG trong preset của DSH. */
export interface NestedRowDeclaration {
  /** Tên preset chứa row lồng (tệp patch tương ứng trong dsh-web-app/presets). */
  readonly preset: string;
  /** Id row — giữ NGUYÊN id gốc để preset không phải sửa. */
  readonly id: string;
  /** Tên package của ta + subpath entry dùng cho row lồng. */
  readonly name: string;
  /** Tên package gốc (đối chiếu A/B). */
  readonly stockName: string;
  /**
   * Điều kiện tắt của row, NGUYÊN VĂN từ patch gốc: `true` (tắt hẳn trong preset chuẩn/ptc) hoặc biểu
   * thức js `!ctx.get('profileContext')` (preset cordis: chỉ bật khi có profileContext).
   */
  readonly disabled: true | string;
}

/**
 * Ba khai báo row LỒNG — đúng thứ tự và đúng dữ liệu của ba patch preset trong kernel.
 *
 * Vì sao KHÔNG dùng `gbh.row`: ba row này nằm BÊN TRONG preset (`preset-standard`, `preset-ptc`,
 * `preset-cordis`), không phải row top-level ⇒ chỉ `gbh.nested` diễn đạt được. Chỉ khai sau khi Lead
 * nghiệm thu cơ chế row lồng (ADR-0007 §7.4: A == B 12/12, 0 khác).
 */
export const NESTED_ROWS: readonly NestedRowDeclaration[] = [
  { preset: "standard", id: NESTED_ROW_ID, name: `${PACKAGE_NAME}/${TOOLS_SUBPATH}`, stockName: `${STOCK_PACKAGE_NAME}/${TOOLS_SUBPATH}`, disabled: true },
  { preset: "ptc", id: NESTED_ROW_ID, name: `${PACKAGE_NAME}/${TOOLS_SUBPATH}`, stockName: `${STOCK_PACKAGE_NAME}/${TOOLS_SUBPATH}`, disabled: true },
  { preset: "cordis", id: NESTED_ROW_ID, name: `${PACKAGE_NAME}/${TOOLS_SUBPATH}`, stockName: `${STOCK_PACKAGE_NAME}/${TOOLS_SUBPATH}`, disabled: "!ctx.get('profileContext')" },
];
