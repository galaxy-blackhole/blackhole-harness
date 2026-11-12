/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép nửa browser api-remotes từ 24 part nguyên văn + vỏ loader (port cơ học 1:1 từ artifact gốc,
 *      CHỈ đổi dòng id module sang id của ta — dùng chung cho build và cổng byte).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Đường dẫn tệp vỏ loader (3 dòng đầu + 6 dòng cuối của bundle gốc, id đã quy đổi). */
const WRAPPER = join(import.meta.dir, "client-wrapper.json");
/** Thư mục 24 part nguyên văn (phần THÂN của bundle gốc). */
const PARTS = join(import.meta.dir, "client-parts");

/** Vỏ loader của bundle browser: dòng đầu và dòng cuối. */
export interface ClientWrapper {
  /** Ba dòng mở đầu: load({ · id · factory. */
  readonly head: readonly string[];
  /** Các dòng kết thúc: exports cuối, return module.exports, đóng factory, đóng load. */
  readonly tail: readonly string[];
}

/**
 * Đọc vỏ loader của bundle browser.
 * Nhận: không.
 * Trả: {@link ClientWrapper} đọc từ src/client-wrapper.json.
 */
export function readWrapper(): ClientWrapper {
  return JSON.parse(readFileSync(WRAPPER, "utf8")) as ClientWrapper;
}

/**
 * Ghép toàn bộ bundle browser: vỏ đầu + 24 part thân + vỏ cuối.
 * Nhận: không.
 * Trả: chuỗi bundle hoàn chỉnh (id module đã là id của ta).
 */
export function assembleClient(): string {
  const wrapper = readWrapper();
  const names = readdirSync(PARTS).filter((name) => name.endsWith(".txt")).sort();
  if (names.length === 0) throw new Error("thieu part nua browser trong " + PARTS);
  let body = "";
  for (const name of names) body += readFileSync(join(PARTS, name), "utf8");
  return wrapper.head.join("\n") + "\n" + body + wrapper.tail.join("\n");
}
