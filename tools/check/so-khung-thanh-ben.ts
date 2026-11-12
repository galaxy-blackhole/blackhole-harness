/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 22/10/2026
 * desc Đối chiếu artefact client của ba gói khung thanh bên với bundle gốc: in ra khác biệt ĐẦU TIÊN
 *      (sau khi chuẩn hoá brand + id) để biết gói nào lệch và lệch ở đâu.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chuanHoaArtefact } from "../../tests/helpers/vi-dictionary.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Đường dẫn bundle gốc trong bản cài (dùng cho đối chiếu). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-bundle", "lib", "client.js");

const GOI = ["ui-sidebar", "ui-sidebar-terminal", "ui-sidebar-files"];
const stock = readFileSync(STOCK, "utf8");
for (const goi of GOI) {
  const ten = "@galaxy-blackhole/gbh-client-" + goi;
  const stockTen = "@deepseek-ai/dsh-client-" + goi;
  const ta = readFileSync(join(REPO, "packages", "client", goi, "lib", "client.js"), "utf8");
  const chuan = chuanHoaArtefact(ta, ten, stockTen);
  // Tìm đoạn dài nhất của ta không có trong bản gốc (dò từng dòng).
  const dongStock = new Set(stock.split(String.fromCharCode(10)).map((d) => d.trim()));
  const lech = chuan
    .split(String.fromCharCode(10))
    .map((d) => d.trim())
    .filter((d) => d.length > 40 && !dongStock.has(d));
  console.log(goi, "| so dong lech:", lech.length, "| dau tien:", (lech[0] ?? "-").slice(0, 110));
}
