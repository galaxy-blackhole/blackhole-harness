/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nửa của package: lib/index.js (node ESM) và lib/client.js (script classic, MỘT id)
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Dòng đầu mọi artifact sinh ra — cảnh báo không sửa tay. */
const GENERATED_HEADER = [
  "/* eslint-disable */",
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TỰ ĐỘNG — đừng sửa tay; sửa src/ rồi chạy bun run build.",
  " */",
].join("\n");

/**
 * Thụt lề một khối mã nguồn cho vừa một độ sâu.
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
    "  // Đăng ký thêm id gốc ⇒ cùng một bundle chạy hai lần ⇒ duplicate factory registration ⇒ app trắng.",
    "})();",
    "",
  ].join("\n");
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
  if (!built.success) throw new Error("gbh-client-ui-plugin-market: build nửa host thất bại");
  return join(out, "index.js");
}

/**
 * Build nửa client: bundle CJS từ src/client.ts rồi bọc thành script classic một id.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    // write không nằm trong kiểu của Bun ở bản này ⇒ ép kiểu như ui-brand-official (khuôn đã có trong repo).
  } as Parameters<typeof Bun.build>[0]);
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-plugin-market: build nửa client không sinh output nào");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build trọn gói: ghi cả hai nửa vào thư mục đích (hoặc lib/ của chính gói nếu không truyền).
 *
 * ⚠️ 18/10/2026: PHẢI nhận thư mục đích qua tham số dòng lệnh — tầng mount gọi buildIfStale(pkg, <lib trong
 * profile>). Bản đầu hard-code join(import.meta.dir, "lib") ⇒ mount build ra lib/ của repo rồi chỉ ghi được
 * package.json vào profile ⇒ profile THIẾU lib/ ⇒ tầng nạp không sinh entry, mà mọi phép kiểm khác đều xanh.
 * Nhận: outDir — thư mục đích (tùy chọn).
 * Trả: không.
 */
export async function buildPackage(outDir?: string): Promise<void> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await buildHostHalf(out);
  await buildClientHalf(out);
}

if (import.meta.main) {
  await buildPackage(process.argv[2]);
  console.log("gbh-client-ui-plugin-market: da build lib/index.js + lib/client.js");
}
