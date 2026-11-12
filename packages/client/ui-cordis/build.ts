/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build HAI nửa của @galaxy-blackhole/gbh-client-ui-cordis: lib/index.js (ESM, node) và lib/client.js
 *      (script classic đăng ký ĐÚNG MỘT id module của ta)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, in vào artifact để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 19/10/2026",
  " * desc ARTIFACT SINH TỰ ĐỘNG bởi build.ts của " + PACKAGE_NAME + " — không sửa tay",
  " */",
].join("\n");

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: code — khối mã; spaces — số khoảng trắng thêm vào mỗi dòng.
 * Trả: khối mã đã thụt lề.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: result — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Bọc bundle CJS thành script classic đăng ký ĐÚNG MỘT id — id CỦA TA.
 * Nhận: code — mã CJS đã bundle (dùng module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHÍNH = package của ta (khớp manifest và rev của HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHÔNG đăng ký id của gói GỐC: nó thuộc gbh.row.aliases và tầng nạp TỰ sinh entry alias.",
    "  // Một bundle MỘT id: hai id ⇒ cùng bundle chạy hai lần ⇒ duplicate factory registration ⇒ app trắng.",
    "})();",
    "",
  ].join("\n");
}

/**
 * Kiểm artifact client trước khi phát: đúng MỘT lời gọi đăng ký, id là của ta, không lọt cú pháp ESM.
 * Nhận: code — văn bản script classic vừa ghép.
 * Trả: không — ném lỗi khi artifact vi phạm LUẬT MỘT-ID hoặc còn cú pháp ESM.
 */
function assertClientArtifact(code: string): void {
  const registrations = [...code.matchAll(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (registrations.length !== 1) {
    throw new Error("gbh-client-ui-cordis: artifact đăng ký " + registrations.length + " id module (LUẬT: đúng 1 — id của ta)");
  }
  if (registrations[0] !== PACKAGE_NAME) {
    throw new Error("gbh-client-ui-cordis: id đăng ký (" + registrations[0] + ") khác id của ta (" + PACKAGE_NAME + ")");
  }
  if (code.includes('load({ id: "' + STOCK_PACKAGE_NAME + '"')) {
    throw new Error("gbh-client-ui-cordis: artifact đăng ký id của gói GỐC — cấm (LUẬT MỘT-ID)");
  }
  const esm = code.split("\n").find((line) => /^\s*(?:import|export)\s/u.test(line));
  if (esm !== undefined) {
    throw new Error("gbh-client-ui-cordis: bundle client lọt cú pháp ESM (sẽ chết trong thẻ <script> classic): " + esm.trim());
  }
}

/**
 * Build nửa host: bundle ESM từ src/index.ts ra lib/index.js.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildHostHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!built.success) throw new Error("gbh-client-ui-cordis: build nửa host thất bại: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nửa client: bundle CJS từ src/client.ts rồi bọc thành script classic một id.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  // 19/10/2026: build vào thư mục TẠM (`BuildConfig` không có option `write`), đọc `outputs[0].text()`.
  const scratch = join(tmpdir(), "gbh-ui-cordis-client-" + process.pid + "-" + Date.now());
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    // 19/10/2026 (TS2353): `BuildConfig` KHÔNG có option `write` ⇒ build vào THƯ MỤC TẠM rồi đọc
    // `outputs[0].text()`. Bun luôn trả outputs trong bộ nhớ; không dùng `as never`.
    outdir: scratch,
    packages: "external",
    // write không nằm trong kiểu của Bun ở bản này ⇒ ép kiểu như ui-tool/ui-goal (khuôn đã có trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-cordis: build nửa client thất bại: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-cordis: build nửa client không sinh output nào");
  const target = join(out, "client.js");
  const wrapped = wrapClientBundle(await bundle.text());
  assertClientArtifact(wrapped);
  writeFileSync(target, wrapped);
  return target;
}

/**
 * Build cả hai nửa vào một thư mục đích.
 *
 * ⚠️ PHẢI nhận outDir qua tham số dòng lệnh: apps/cli/src/mount.ts gọi build.ts với thư mục lib trong
 *   PROFILE. Hard-code join(import.meta.dir, "lib") ⇒ profile thiếu lib/ ⇒ tầng nạp không sinh entry,
 *   mà mọi phép kiểm khác vẫn xanh.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { host, client } — đường dẫn hai artifact đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-*.
  await renameClientArtifact(client);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}