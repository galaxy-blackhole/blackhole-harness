/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build HAI nua cua package: lib/index.js (node ESM) va lib/client.js (script classic dang ky MOT id — id cua ta)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, in vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 19/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-user-questions — khong sua tay",
  " */",
].join("\n");

/** Ba khối CSS của ba module — nguồn sự thật duy nhất, nhúng vào bundle bằng `define` chứ không chép lại. */
const CSS_FILES = {
  planReview: join(import.meta.dir, "src", "PlanReviewPanel.module.css"),
  composer: join(import.meta.dir, "src", "QuestionComposer.module.css"),
  reply: join(import.meta.dir, "src", "QuestionReplyView.module.css"),
} as const;

/**
 * Đọc một tệp CSS và bỏ header bắt buộc của repo, để chuỗi nhúng vào bundle là NGUYÊN VĂN CSS của bản gốc.
 * Nhận: file — đường dẫn tệp CSS.
 * Trả: nội dung CSS đã bỏ khối chú thích đầu tệp.
 */
function cssTextOf(file: string): string {
  const text = readFileSync(file, "utf8");
  if (!text.startsWith("/*")) return text;
  const end = text.indexOf("*/");
  if (end === -1) return text;
  return text.slice(end + 2).replace(/^\n/, "").replace(/\n$/, "");
}

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: code — mã nguồn; spaces — số khoảng trắng thêm vào mỗi dòng.
 * Trả: mã nguồn đã thụt lề.
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
 * Build nửa host thành một file ESM duy nhất.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildHostHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-client-ui-user-questions: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic đăng ký ĐÚNG MỘT id module (id CỦA TA), kèm ba khối CSS nhúng sẵn.
 *
 * Hợp đồng C2: script chỉ ĐĂNG KÝ factory, thân module nằm trong closure của factory và chạy ở lần vạt chất
 * hoá đầu tiên. Loader nạp bundle bằng thẻ `<script>` classic (không phải ESM) nên bundle được build ở dạng
 * CJS rồi bọc trong lời gọi đăng ký. LUẬT MỘT-ID: không giữ id của package gốc ở bất kỳ đâu trong artifact.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const define: Record<string, string> = {
    __GBH_PLAN_REVIEW_CSS__: JSON.stringify(cssTextOf(CSS_FILES.planReview)),
    __GBH_QUESTION_COMPOSER_CSS__: JSON.stringify(cssTextOf(CSS_FILES.composer)),
    __GBH_QUESTION_REPLY_CSS__: JSON.stringify(cssTextOf(CSS_FILES.reply)),
  };
  // 19/10/2026 (sửa lỗi kiểu TS2353): `BuildConfig` KHÔNG có option `write` — Bun.build luôn trả
  // `outputs` trong bộ nhớ và (khi có `outdir`) ghi thêm bản trên đĩa. Ta build vào THƯ MỤC TẠM rồi đọc
  // `outputs[0].text()`, nên không cần `write` và không ghi rác vào repo. Không dùng `as never`.
  const scratch = join(tmpdir(), "gbh-uq-client-" + process.pid + "-" + Date.now());
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    outdir: scratch,
    packages: "external",
    define,
  });
  if (!result.success) throw new Error("gbh-client-ui-user-questions: build nua client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-user-questions: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Bọc bundle CJS thành script classic đăng ký một id module duy nhất.
 * Nhận: code — mã CJS đã bundle (dùng `module`/`exports` như biến cục bộ của factory).
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
    "  // LUAT MOT-ID: chi id CUA TA duoc dang ky (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * Nhận: outDir — thư mục đích (mặc định: `lib` cạnh package.json).
 * Trả: `{ host, client }` — đường dẫn hai file đã build.
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