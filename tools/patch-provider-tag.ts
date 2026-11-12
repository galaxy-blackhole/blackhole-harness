/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Ẩn nhãn "Tuỳ chỉnh" trên thẻ provider Galaxy Blackhole (route `auto` khai trong
 *      ~/.galaxy/blackhole/app.patch.yml nên UI coi là route tự khai và gắn nhãn custom).
 *      Chạy được trên CẢ artefact de-bundle lẫn artefact build từ nguồn (alias jsx có thể kèm số),
 *      và được gọi tự động ở cuối build.ts của gói — vì mount trong profile build lại từ nguồn.
 *      Chạy tay: bun run tools/patch-provider-tag.ts [<đường dẫn artefact>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tools ⇒ ..). */
const REPO = join(import.meta.dir, "..");

/** Artefact mặc định của gói ui-settings-models. */
const MAC_DINH = join(REPO, "packages", "client", "ui-settings-models", "lib", "client.js");

/** Dấu nhận biết bản vá đã áp. */
const DAU = 'provider !== "auto"';

/** Đoạn mã gốc bật nhãn "Tuỳ chỉnh" (chịu được alias jsx kèm số và mọi khoảng trắng). */
const GOC = /row\.entry\.declared === true\s*\?\s*\(0,\s*react_jsx_runtime\d*\.jsx\)\("span",\s*\{/u;

/**
 * Áp bản vá ẩn nhãn "Tuỳ chỉnh" cho route `auto`.
 * Nhận: duongDan — artefact client (mặc định theo repo).
 * Trả: "da an" khi có thay đổi · "da an truoc do" khi đã vá · "khong thay" khi artefact khác hình dạng.
 */
export function anNhanTuyChinh(duongDan: string = MAC_DINH): string {
  const truoc = readFileSync(duongDan, "utf8");
  if (truoc.includes(DAU)) return "da an truoc do";
  const khop = GOC.exec(truoc);
  if (khop === null) return "khong thay";
  const thay = 'row.entry.declared === true && row.entry.provider !== "auto" ? (0, react_jsx_runtime' + (/(\d+)/u.exec(khop[0])?.[1] ?? "") + '.jsx)("span", {';
  writeFileSync(duongDan, truoc.slice(0, khop.index) + thay + truoc.slice(khop.index + khop[0].length));
  return "da an";
}

if (import.meta.main) {
  console.log(anNhanTuyChinh(process.argv[2]));
}
