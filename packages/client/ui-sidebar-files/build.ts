/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nửa của package: lib/index.js (node ESM) và lib/client.js (script classic, MỘT id).
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Dòng đầu mọi artifact sinh ra — cảnh báo không sửa tay. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TỰ ĐỘNG — đừng sửa tay; sửa src/ rồi chạy bun run build.ts",
  " */",
].join("\n");

/**
 * Thụt lề một khối mã nguồn cho vừa một độ sâu.
 * Nhận: code — mã nguồn; spaces — số khoảng trắng thêm vào mỗi dòng.
 * Trả: mã nguồn đã thụt lề (dòng rỗng giữ nguyên).
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
 * Nhận: code — mã CJS đã bundle (dùng §module§/§exports§ như biến tự do).
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
    "  // KHÔNG đăng ký id của gói GỐC: nó thuộc gbh.row.aliases và tầng nạp TỰ sinh entry alias dùng cùng URL.",
    "  // Một bundle đăng ký hai id ⇒ cùng một bundle chạy hai lần ⇒ duplicate factory registration ⇒ app trắng.",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build nửa host: bundle ESM từ src/index.ts ra index.js.
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
  if (!built.success) throw new Error("gbh-client-ui-sidebar-files: build nửa host thất bại: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nửa client: bundle CJS từ src/client.ts rồi bọc thành script classic MỘT id.
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
  if (!built.success) throw new Error("gbh-client-ui-sidebar-files: build nửa client thất bại: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-sidebar-files: build nửa client không sinh output nào");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(join(import.meta.dir, "lib", "client.js"));
  return target;
}

/**
 * Build trọn gói: ghi cả hai nửa vào §outDir§ (hoặc lib/ của chính gói khi không truyền).
 *
 * ⚠️ PHẢI nhận §outDir§ qua tham số dòng lệnh — apps/cli/src/mount.ts gọi
 * §buildIfStale(pkg, join(dir, "lib"))§ với thư mục đích là BẢN MOUNT trong profile. Hard-code
 * §import.meta.dir/lib§ thì profile THIẾU lib/ ⇒ tầng nạp không sinh entry, dù mọi phép kiểm khác xanh.
 * Nhận: outDir — thư mục đích (tuỳ chọn).
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
  if (!existsSync(join(import.meta.dir, "src", "client.ts"))) throw new Error("gbh-client-ui-sidebar-files: thiếu src/client.ts");
  await buildPackage(process.argv[2]);
  console.log("gbh-client-ui-sidebar-files: đã build lib/index.js + lib/client.js");
}
