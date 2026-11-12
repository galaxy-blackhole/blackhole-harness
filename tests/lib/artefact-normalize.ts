/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Hai phép chuẩn hoá dùng khi so artefact của ta với bản gốc SAU P1b: artefact mang id CỦA TA
 *      (`@galaxy-blackhole/gbh-*`) và brand token của ta, nên phải quy về dạng gốc trước khi so byte.
 */

import { normalizeBrand, normalizeIdsInText } from "./brand-parity.ts";

/**
 * Chuẩn hoá artefact NỬA HOST: chỉ quy id của ta về id gốc.
 * Nhận: text — nội dung artefact.
 * Trả: văn bản đã quy id.
 */
export function chuanHoaHost(text: string): string {
  // 05/11/2026 (P1b): phủ cả các gói CHƯA có trong bảng id (artefact có thể nhắc gói ta chưa port)
  // ⇒ quy theo quy ước tên sau khi đã quy theo bảng.
  return normalizeIdsInText(text).split("@galaxy-blackhole/gbh-").join("@deepseek-ai/dsh-");
}

/**
 * Chuẩn hoá artefact NỬA CLIENT: quy id VÀ brand token về dạng gốc.
 * Nhận: text — nội dung artefact.
 * Trả: văn bản đã quy id + brand.
 */
export function chuanHoaClient(text: string): string {
  return normalizeBrand(chuanHoaHost(text));
}

/**
 * Độ dài byte của văn bản sau khi mã hoá UTF-8.
 * Nhận: text — văn bản cần đo.
 * Trả: số byte.
 */
export function soByte(text: string): number {
  return Buffer.byteLength(text, "utf8");
}


/**
 * So hai artefact SAU khi chuẩn hoá id ở cả hai vế (artefact của ta mang id GBH).
 * Nhận: mot — artefact thứ nhất; hai — artefact thứ hai.
 * Trả: true khi bằng nhau sau chuẩn hoá.
 */
export function bangNhau(mot: Buffer | string, hai: Buffer | string): boolean {
  const ve = (x: Buffer | string): string => chuanHoaHost(typeof x === "string" ? x : x.toString("utf8"));
  return Buffer.from(ve(mot), "utf8").equals(Buffer.from(ve(hai), "utf8"));
}
