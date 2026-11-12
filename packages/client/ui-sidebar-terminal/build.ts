/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build BA đầu ra: lib/index.js (node ESM) · lib/client.js (script classic hai id) · lib/client.terminal.js (chunk lazy có xterm)
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {CHUNK_FILE, PACKAGE_NAME} from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TỰ ĐỘNG bởi build.ts của @galaxy-blackhole/gbh-client-ui-sidebar-terminal — không sửa tay",
  " */",
].join("\n");

/**
 * Id module DUY NHẤT mà bundle TỰ KHAI (viết literal để bun run check:rows đọc được).
 * Id gốc KHÔNG tự đăng ký: TẦNG NẠP phát entry alias từ gbh.row.aliases, trỏ cùng URL bundle này.
 */
const DECLARED_IDS = [{ id: "@galaxy-blackhole/gbh-client-ui-sidebar-terminal" }] as const;

/** Ba file mà build này sinh ra. */
export interface BuiltHalves {
  /** Nửa host (entry Loader nạp). */
  node: string;
  /** Nửa client (harness phục vụ qua export ./client). */
  client: string;
  /** Chunk lazy nằm cạnh client.js (bộ nạp tải bằng require.async). */
  chunk: string;
}

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: khối mã và số cấp thụt lề.
 * Trả: khối mã đã thụt lề.
 */
function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/**
 * Chuẩn hoá chú thích đường dẫn nguồn do Bun chèn để hash bản build không phụ thuộc thư mục chạy build.
 * Nhận: mã đã bundle.
 * Trả: mã đã chuẩn hoá.
 */
function normalizeSourceComments(code: string): string {
  return code.replace(/^(\s*)\/\/ .*[\\/]([^\\/]+\.ts)$/gmu, "$1// $2");
}

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa host thành ESM cho node.
 * Nhận: thư mục đích.
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
  if (!result.success) throw new Error("gbh-client-ui-sidebar-terminal: build nửa host thất bại: " + logsOf(result));
  const file = join(out, "index.js");
  writeFileSync(file, normalizeSourceComments(readFileSync(file, "utf8")));
  return file;
}

/** Thư mục gốc của repo (build.ts nằm ở <repo>/packages/client/<gói>). */
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/**
 * Dựng bảng đổi id stock → id của ta từ manifest trong repo (`gbh.provenance.stock` → `name`).
 * Nhận: không. Trả: các cặp [id stock, id ta], khoá DÀI trước để không thay chồng.
 *
 * ⚠️ 07/11/2026 — SỰ CỐ THẬT: chunk lazy chép NGUYÊN VĂN từ bản gốc nên còn cả `require(id stock)` LẪN
 *   symbol kiểu stock trong hợp đồng typert (`@deepseek-ai/dsh-session/types#SessionId`). Bảng module
 *   lúc chạy và mọi hợp đồng phía client/host đều đã đổi sang id GBH ⇒ tab Terminal chết vì
 *   "require(...) missed the module table", rồi sau khi vá require thì lộ lỗi
 *   'lookup provider "agent" does not match its strict definition'. Nay chunk được đổi id ĐỒNG BỘ
 *   (trừ id của CHÍNH gói này — đổi sẽ thành self-import).
 */
function bangDoiId(): readonly (readonly [string, string])[] {
  const bang: [string, string][] = [];
  for (const nhom of ["host", "client"]) {
    let ten: string[] = [];
    try {
      ten = readdirSync(join(REPO_ROOT, "packages", nhom));
    } catch {
      continue;
    }
    for (const goi of ten) {
      let duLieu: { name?: unknown; gbh?: { provenance?: { stock?: unknown } } };
      try {
        duLieu = JSON.parse(readFileSync(join(REPO_ROOT, "packages", nhom, goi, "package.json"), "utf8")) as typeof duLieu;
      } catch {
        continue;
      }
      const goc = duLieu.gbh?.provenance?.stock;
      const tenTa = duLieu.name;
      if (typeof goc !== "string" || typeof tenTa !== "string") continue;
      if (tenTa === PACKAGE_NAME) continue;
      bang.push([goc, tenTa]);
    }
  }
  return bang.sort((a, b) => b[0].length - a[0].length);
}

/**
 * Đổi mọi id stock trong một văn bản sang id của ta, khớp theo RANH GIỚI tên gói (giữ nguyên subpath).
 * Nhận: text — nội dung tệp; bang — bảng đổi đã sắp khoá dài trước.
 * Trả: văn bản đã đổi.
 */
function doiIdStock(text: string, bang: readonly (readonly [string, string])[]): string {
  let out = text;
  for (const [tu, den] of bang) {
    const mau = new RegExp(tu.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "(?![\\w-])", "gu");
    out = out.replace(mau, () => den);
  }
  return out;
}

/**
 * Đóng gói một entry thành CJS (không ghi ra đĩa).
 * Nhận: đường dẫn entry.
 * Trả: mã CJS đã bundle.
 */
async function bundleCjs(entry: string, label: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "cjs",
    write: false,
    // CHỈ ba module này do bảng module cấp lúc chạy; mọi thứ khác (xterm, addon-fit) phải được bundle,
    // nếu không chunk sẽ require @xterm/xterm lúc chạy và app không có gói đó.
    external: ["react", "react/jsx-runtime", "@galaxy-blackhole/gbh-client-ui-primitives"],
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-client-ui-sidebar-terminal: build " + label + " thất bại: " + logsOf(result));
  const output = result.outputs[0];
  if (output === undefined) throw new Error("gbh-client-ui-sidebar-terminal: " + label + " không sinh output nào");
  return normalizeSourceComments(await output.text());
}

/**
 * Bọc bundle CJS của entry chính thành script classic đăng ký HAI id bằng cùng một factory.
 * Nhận: mã CJS.
 * Trả: văn bản script classic.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 2),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHÍNH = package của ta (khớp manifest và rev của HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Bọc bundle CJS của chunk thành script classic đăng ký CHUNK (id riêng + tên file chunk).
 * Nhận: mã CJS.
 * Trả: văn bản script classic của chunk.
 */
function wrapChunkBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "// Chunk lazy: bộ nạp tải bằng require.async(\"" + ".".concat("/") + "\") nên file này phải nằm cạnh client.js.",
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 2),
    "    module.exports.ensureTerminalCss();",
    "    return {",
    "      TerminalBody: module.exports.createTerminalBody(",
    '        require("react/jsx-runtime"),',
    '        require("react"),',
    '        require("@galaxy-blackhole/gbh-client-ui-primitives")',
    "      )",
    "    };",
    "  };",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", chunk: " + JSON.stringify(CHUNK_FILE) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build cả ba đầu ra của package vào một thư mục đích.
 * Nhận: thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { node, client, chunk } — đường dẫn ba file đã build.
 */
/**
 * Đường dẫn chunk terminal GỐC của DSH (dùng nguyên văn thay cho bản viết tay).
 * Nhận: không. Trả: đường dẫn tuyệt đối tới lib/client.terminal.js của bản cài.
 *
 * Vì sao (22/10/2026): bản chunk viết tay thiếu phần nối xterm với PTY nên khung terminal in ra
 * ký tự rác ("yyyy…"); chunk gốc dài 13.516 dòng so với 10.239 dòng của bản viết tay.
 */
function stockChunkPath(): string {
  return join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai",
    "dsh-client-ui-sidebar-terminal", "lib", "client.terminal.js");
}

/**
 * Build cả ba đầu ra của package vào một thư mục đích.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { node, client, chunk } — đường dẫn ba tệp đã build. Chunk lấy NGUYÊN VĂN từ bản gốc (chỉ đổi id).
 */
export async function buildPackage(outDir?: string): Promise<BuiltHalves> {
  if (DECLARED_IDS[0].id !== PACKAGE_NAME) {
    throw new Error("gbh-client-ui-sidebar-terminal: id trong build.ts LỆCH với src/ids.ts — sửa cho khớp rồi build lại");
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const node = await buildHostHalf(out);
  const client = join(out, "client.js");
  writeFileSync(client, wrapClientBundle(await bundleCjs(join(import.meta.dir, "src", "client.ts"), "entry")));
  const chunk = join(out, CHUNK_FILE);
  // 22/10/2026: dùng NGUYÊN VĂN chunk của bản gốc (chỉ đổi id đăng ký sang id của ta).
  //
  // ⚠️ 07/11/2026 — SỰ CỐ THẬT: chunk gốc còn `require("@deepseek-ai/dsh-client-ui-primitives")` bên trong
  //   thân factory. Bảng module lúc chạy CHỈ có id GBH, nên require đó trượt bảng ⇒ factory ném
  //   "require(...) missed the module table" ⇒ khe `sidebar.right.pane.tab` chết (tab Terminal trống,
  //   3 lỗi console). Đo được: chỉ ĐÚNG MỘT dòng drift như vậy trong toàn bộ artefact client.
  //   Nay đổi CẢ HAI id: id đăng ký (như cũ) + id primitives mà chunk require lúc chạy.
  const chunkGoc = readFileSync(stockChunkPath(), "utf8");
  const PRIMITIVES_STOCK = "@deepseek-ai/dsh-client-ui-primitives";
  const PRIMITIVES_OURS = "@galaxy-blackhole/gbh-client-ui-primitives";
  const chunkDoiId = doiIdStock(
    chunkGoc.split(JSON.stringify("@deepseek-ai/dsh-client-ui-sidebar-terminal")).join(JSON.stringify(PACKAGE_NAME)),
    bangDoiId(),
  ).split(JSON.stringify(PRIMITIVES_STOCK)).join(JSON.stringify(PRIMITIVES_OURS));
  // Cổng chặn hồi quy: chunk phát ra KHÔNG được còn bất kỳ require id stock nào (bảng module không có).
  if (/\.require\("@deepseek-ai\//u.test(chunkDoiId) || chunkDoiId.includes('require("' + PRIMITIVES_STOCK + '")')) {
    throw new Error("gbh-client-ui-sidebar-terminal: chunk con require id STOCK — bảng module chỉ có id GBH, tab Terminal se chet");
  }
  writeFileSync(chunk, chunkDoiId);
  return { node, client, chunk };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.node);
  console.log("built " + built.client);
  console.log("built " + built.chunk);
}
