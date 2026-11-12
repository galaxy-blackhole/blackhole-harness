/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build HAI nửa của @galaxy-blackhole/gbh-client-ui-input-trigger: lib/index.js (node ESM) và
 *   lib/client.js (script classic đăng ký ĐÚNG MỘT id — id của ta)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, in vào artifact để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 19/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/**
 * Thụt lùi một khối mã nguồn cho vừa một độ sâu.
 * Nhận: code — mã nguồn; spaces — số khoảng trắng thêm vào mỗi dòng.
 * Trả: mã nguồn đã thụt lùi.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
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
    '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias tro ve",
    "  // cung URL bundle. Mot bundle MOT id — dang ky them id goc la duplicate factory registration.",
    "})();",
    "",
  ].join("\n");
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
    banner: GENERATED_HEADER,
  });
  if (!built.success) throw new Error(PACKAGE_NAME + ": build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nửa client: bundle CJS từ src/client.ts rồi bọc thành script classic đăng ký một id.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  // 19/10/2026: build vào thư mục TẠM (`BuildConfig` không có option `write`), đọc `outputs[0].text()`.
  const scratch = join(tmpdir(), "gbh-ui-input-trigger-client-" + process.pid + "-" + Date.now());
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    packages: "external",
    // 19/10/2026 (TS2353): `BuildConfig` KHÔNG có option `write` ⇒ build vào THƯ MỤC TẠM rồi đọc
    // `outputs[0].text()`. Bun luôn trả outputs trong bộ nhớ; không dùng `as never`.
    outdir: scratch,
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-open-in-app / ui-chat (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build trọn gói: ghi cả hai nửa vào outDir (hoặc lib/ của chính gói nếu không truyền).
 *
 * PHẢI nhận outDir qua tham số dòng lệnh — apps/cli/src/mount.ts gọi buildIfStale(pkg, join(dir, "lib"))
 * với thư mục đích là BẢN MOUNT trong profile; hard-code join(import.meta.dir, "lib") thì profile thiếu lib/.
 * Nhận: outDir — thư mục đích (tuỳ chọn).
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