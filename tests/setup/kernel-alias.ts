/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 03/11/2026
 * desc Nạp TRƯỚC mọi test: ép các gói kernel CỦA TA trỏ về đúng một thể hiện kernel (bản gốc)
 *      để test mô hình đúng thực tế 'một thể hiện kernel' (P2).
 */

import { mock } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Gói kernel của ta → gói gốc tương ứng (đều là bản sao 1:1 nên dùng chung một thể hiện là đúng). */
const KERNEL: Record<string, string> = {
  "@galaxy-blackhole/gbh-cordis": "@deepseek-ai/cordis",
  "@galaxy-blackhole/gbh-schemastery": "@deepseek-ai/schemastery",
  "@galaxy-blackhole/gbh-cosmokit": "@deepseek-ai/cosmokit",
};

/** Thư mục cài đặt kernel gốc (oracle) — nơi test lấy thể hiện kernel DUY NHẤT. */
const ORACLE = join(import.meta.dir, "..", "..", "apps", "host", "node_modules");

for (const [ours, stock] of Object.entries(KERNEL)) {
  const entry = join(ORACLE, stock, "lib", "index.js");
  if (!existsSync(entry)) continue;
  mock.module(ours, () => import(entry));
}