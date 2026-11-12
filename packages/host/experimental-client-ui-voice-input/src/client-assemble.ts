/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ghép nửa CLIENT voice-input từ 3 part nguyên văn + vỏ loader (port cơ học 1:1 stock lib/client.js
 *      2.979 dòng, CHỈ đổi id module sang id của ta) — dùng chung cho build và cổng byte
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Thư mục part nguyên văn — phần THÂN của bundle gốc (dòng 4–2973, cắt đúng ranh giới dòng). */
const PARTS = join(import.meta.dir, "client-parts");
/** Tệp vỏ loader: 3 dòng đầu + 7 dòng cuối của bundle gốc, CHỈ dòng id module đã quy đổi. */
const WRAPPER = join(import.meta.dir, "client-wrapper.json");

/** Id module của bundle GỐC — chỉ dùng để đối chiếu cổng; KHÔNG được còn trong lib/client.js. */
export const STOCK_CLIENT_ID = "@deepseek-ai/dsh-experimental-client-ui-voice-input";
/** Id module CỦA TA — dòng `id:` của vỏ và hai tham chiếu asset CSS trong thân đều mang id này. */
export const OUR_CLIENT_ID = "@galaxy-blackhole/gbh-experimental-client-ui-voice-input";

/** Vỏ loader của bundle client: dòng mở đầu và dòng kết thúc. */
export interface ClientWrapper {
  /** Ba dòng mở đầu: load({ · id · factory. */
  readonly head: readonly string[];
  /** Các dòng kết thúc: exports cuối, return module.exports, đóng factory, đóng load, sourceMappingURL. */
  readonly tail: readonly string[];
}

/**
 * Đọc vỏ loader của bundle client.
 * Nhận: không.
 * Trả: {@link ClientWrapper} đọc từ src/client-wrapper.json (tài sản verbatim, .json miễn header).
 */
export function readWrapper(): ClientWrapper {
  return JSON.parse(readFileSync(WRAPPER, "utf8")) as ClientWrapper;
}

/**
 * Liệt kê tên các part theo thứ tự ghép (sort tên part-01…part-03).
 * Nhận: không.
 * Trả: mảng tên tệp .txt trong src/client-parts đã sắp xếp; ném lỗi khi thư mục rỗng.
 */
export function clientPartNames(): string[] {
  const names = readdirSync(PARTS).filter((name) => name.endsWith(".txt")).sort();
  if (names.length === 0) throw new Error("thiếu part nửa client trong " + PARTS);
  return names;
}

/**
 * Ghép toàn bộ bundle client: vỏ đầu + các part thân + vỏ cuối.
 *
 * Nhận: không.
 * Trả: chuỗi bundle hoàn chỉnh — thân NGUYÊN VĂN từng byte, id module trong vỏ đã là id của ta.
 */
export function assembleClient(): string {
  const wrapper = readWrapper();
  let body = "";
  for (const name of clientPartNames()) body += readFileSync(join(PARTS, name), "utf8");
  return wrapper.head.join("\n") + "\n" + body + wrapper.tail.join("\n");
}
