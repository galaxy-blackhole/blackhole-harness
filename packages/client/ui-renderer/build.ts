/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id module)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, in vào artifact để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc File SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: `code` — khối mã, `levels` — số cấp thụt lề.
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
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: `result` — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Bọc bundle CJS thành script classic đăng ký ĐÚNG MỘT id module.
 *
 * Hợp đồng C2: script chỉ ĐĂNG KÝ factory; thân module nằm trong closure của factory và chạy ở lần vạt
 * chất hoá đầu tiên. Loader nạp bundle bằng thẻ script classic (KHÔNG phải ESM) nên bundle build ở dạng
 * CJS rồi bọc trong lời gọi đăng ký. Id CỦA TA là id chính (khớp manifest và rev HMR tra theo ownerId);
 * id của gói GỐC KHÔNG đăng ký ở đây — nó thuộc `gbh.row.aliases` và tầng nạp tự sinh entry alias.
 *
 * Nhận: `code` — mã CJS đã bundle (dùng `module`/`exports` như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
 */
export function wrapClientBundle(code: string): string {
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
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
    "  // MOT BUNDLE MOT ID: dang ky them id goc => cung bundle chay hai lan => duplicate factory",
    "  //   registration / service has been registered => app trang (su co 17/10/2026).",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build nửa host thành một file ESM duy nhất (`lib/index.js`).
 * Nhận: `out` — thư mục đích.
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
  if (!result.success) throw new Error(PACKAGE_NAME + ": build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic (CJS bọc trong lời gọi đăng ký một id).
 * Nhận: `out` — thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    // `write` khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-subagent/ui-goal (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build TRỌN gói: ghi cả hai nửa vào outDir.
 *
 * ⚠️ PHAI nhận outDir qua tham số dòng lệnh — `apps/cli/src/mount.ts` gọi `buildIfStale(pkg, join(dir,"lib"))`
 * với thư mục đích là BẢN MOUNT trong profile; hard-code `join(import.meta.dir,"lib")` ⇒ profile THIẾU
 * `lib/` ⇒ không sinh entry (lỗi thật đã trả giá 18/10/2026).
 *
 * Nhận: `outDir` — thư mục đích (mặc định `lib` cạnh package.json).
 * Trả: `{ host, client }` — đường dẫn hai artifact đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}