/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Chuẩn hoá artefact client của TA về đúng dạng bản gốc, để các ca test A/B "B = nguyên văn A"
 *      vẫn so được phần LOGIC. Bốn lớp sai khác ĐƯỢC PHÉP: (1) từ điển tiếng Việt (dữ liệu),
 *      (2) brand rename của build (token/global/thương hiệu), (3) id gói ta thay cho id stock,
 *      (4) id ở dòng loader.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Bản đồ tên gói ta → tên stock (đảo của tests/helpers/brand-ids-map.json). */
const BAN_DO_NGUOC: Record<string, string> = (() => {
  try {
    const goc = JSON.parse(readFileSync(join(import.meta.dir, "brand-ids-map.json"), "utf8")) as Record<string, string>;
    const ra: Record<string, string> = {};
    for (const [stock, ta] of Object.entries(goc)) if (!(ta in ra)) ra[ta] = stock;
    return ra;
  } catch {
    return {};
  }
})();

/**
 * Bỏ khối từ điển tiếng Việt và trả đăng ký từ điển về `{ zh, en }`.
 * Nhận: text — toàn văn artefact. Trả: text đã bỏ từ điển.
 */
function boTuDien(text: string): string {
  return text
    .replace(/const vi = \{ \.\.\.en,[\s\S]*?\n\t*\};\n/u, "")
    .replace(/\n\t*\/\*\* Từ điển tiếng Việt[^\n]*\n/u, "\n")
    .replace(/\{\s*zh,\s*en,\s*vi\s*\}/gu, "{ zh, en }")
    .replace(/\n\t*\/\/#endregion/u, "\n\t\t//#endregion");
}

/**
 * Quy brand rename của build về thương hiệu gốc (token CSS, global, chuỗi thương hiệu).
 * Nhận: text — nội dung artefact. Trả: text đã quy brand.
 */
function quyBrand(text: string): string {
  return text
    .split("--gbh-").join("--dsh-")
    .split("__GBH_").join("__DSH_")
    .split("Galaxy Blackhole").join("DeepSeek Harness");
}

/**
 * Quy id gói của ta về id stock tương ứng (đảo bản đồ brand-ids).
 * Nhận: text — nội dung artefact. Trả: text đã quy id.
 */
/**
 * Năm ID ẢO do vỏ SPA cấp (không phải gói npm): tên CỦA TA → tên GỐC.
 *
 * Vì sao cần bảng riêng: `BAN_DO_NGUOC` dựng từ manifest nên không biết các id này; thiếu nó thì
 * `chuanHoaArtefact()` không quy được id mới và mọi phép so byte với bundle gốc sẽ lệch (P3, 04/11/2026).
 */
const ID_AO: ReadonlyArray<readonly [string, string]> = [
  ['@galaxy-blackhole/gbh-client-store', '@deepseek-ai/dsh-client-store'],
  ['@galaxy-blackhole/gbh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-primitives'],
  ['@galaxy-blackhole/gbh-client-ui-slots', '@deepseek-ai/dsh-client-ui-slots'],
  ['@galaxy-blackhole/gbh-client-ui-dockkit', '@deepseek-ai/dsh-client-ui-dockkit'],
  ['@galaxy-blackhole/gbh-typert-generator', '@deepseek-ai/dsh-typert-generator'],
];
function quyId(text: string): string {
  let ra = text;
  // P3: quy 5 ID ẢO trước (bảng manifest không biết chúng).
  for (const [ta, stock] of ID_AO) {
    if (ra.includes(ta)) ra = ra.split(ta).join(stock);
  }
  for (const [ta, stock] of Object.entries(BAN_DO_NGUOC).sort((a, b) => b[0].length - a[0].length)) {
    if (ra.includes(ta)) ra = ra.split(ta).join(stock);
  }
  // 22/10/2026: một số tên trong artefact là tên BUNDLE (vd gbh-web-app) không có manifest trong repo —
  // quy theo quy tắc chuẩn hoá khi kernel THẬT SỰ có gói stock tương ứng.
  const KERNEL = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai");
  ra = ra.replace(/@galaxy-blackhole\/gbh-([a-z0-9-]+)/gu, (nguyen: string, ten: string) => {
    const ung = "@deepseek-ai/dsh-" + ten;
    return existsSync(join(KERNEL, "dsh-" + ten)) ? ung : nguyen;
  });
  return ra;
}

/**
 * Chuẩn hoá artefact của ta về bản gốc để so byte phần logic.
 * Nhận: text — toàn văn artefact; ourName/stockName — tên gói/vỏ bundle (tuỳ chọn).
 * Trả: text so được với bản gốc.
 */
export function chuanHoaArtefact(text: string, ourName?: string, stockName?: string): string {
  const buoc1 = quyId(quyBrand(boTuDien(text)));
  return ourName === undefined || stockName === undefined ? buoc1 : buoc1.split(ourName).join(stockName);
}

/**
 * Tên cũ của hàm chuẩn hoá (giữ để test cũ không phải sửa): chỉ bỏ từ điển.
 * Nhận: text — toàn văn artefact. Trả: text đã bỏ từ điển.
 */
export function boTuDienVi(text: string): string {
  return boTuDien(text);
}
