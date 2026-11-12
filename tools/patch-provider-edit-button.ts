/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Ẩn nút "Sửa" (mở bảng cài đặt tuỳ chỉnh) cho route Galaxy Blackhole (`auto`): route này khai
 *      trong ~/.galaxy/blackhole/app.patch.yml nên không có gì để người dùng tự sửa.
 *      Chạy được trên artefact de-bundle lẫn artefact build từ nguồn; được build.ts gọi tự động.
 *      Chạy tay: bun run tools/patch-provider-edit-button.ts [<đường dẫn artefact>]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tools ⇒ ..). */
const REPO = join(import.meta.dir, "..");

/** Artefact mặc định của gói ui-settings-models. */
const MAC_DINH = join(REPO, "packages", "client", "ui-settings-models", "lib", "client.js");

/** Dấu nhận biết bản vá đã áp. */
const DAU = 'provider === "auto" ? null';

/** Đoạn mã gốc mở nút Sửa (chỉ chặn cho route deepseek-account). */
const GOC = /row\.entry\.provider === "deepseek-account"\s*\?\s*null\s*:\s*\(0,\s*react_jsx_runtime\d*\.jsx\)\("button",\s*\{/u;

/**
 * Áp bản vá ẩn nút "Sửa" cho route `auto`.
 * Nhận: duongDan — artefact client (mặc định theo repo).
 * Trả: "da an" khi có thay đổi · "da an truoc do" khi đã vá · "khong thay" khi artefact khác hình dạng.
 */
export function anNutSua(duongDan: string = MAC_DINH): string {
  const truoc = readFileSync(duongDan, "utf8");
  if (truoc.includes(DAU)) return "da an truoc do";
  const khop = GOC.exec(truoc);
  if (khop === null) return "khong thay";
  const so = /(\d+)/u.exec(khop[0])?.[1] ?? "";
  const thay =
    'row.entry.provider === "deepseek-account" || row.entry.provider === "auto" ? null : (0, react_jsx_runtime' +
    so +
    '.jsx)("button", {';
  writeFileSync(duongDan, truoc.slice(0, khop.index) + thay + truoc.slice(khop.index + khop[0].length));
  return "da an";
}

if (import.meta.main) {
  console.log(anNutSua(process.argv[2]));
}
