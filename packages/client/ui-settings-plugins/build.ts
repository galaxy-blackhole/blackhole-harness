/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script CLASSIC dang ky qua __ModuleLoader__)
 */

import { join } from "node:path";

/** Năm dòng header bắt buộc của repo, chèn vào mọi file sinh ra (lib/*.js cũng bị cổng header soi). */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-settings-plugins — khong sua tay",
  " */",
].join("\n");

/**
 * Gom log của một lần build hỏng thành một dòng dễ đọc.
 * Nhận: `result` — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa host thành một file ESM duy nhất cho Node (peer để external).
 * Nhận: `out` — thư mục đích.
 * Trả: đường dẫn file `index.js` đã build.
 * @throws khi Bun build thất bại.
 */
async function buildHostHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    packages: "external",
    naming: "index.js",
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error("ui-settings-plugins: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa client thành MỘT script classic — bảng module nạp bundle bằng thẻ `<script>` thường
 * (không phải ESM), nên đầu ra KHÔNG được chứa câu `import`/`export` ở cấp cao nhất.
 * Nhận: `out` — thư mục đích.
 * Trả: đường dẫn file `client.js` đã build.
 * @throws khi Bun build thất bại, hoặc khi đầu ra lọt cú pháp ESM (cổng tự kiểm của chính builder).
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "browser",
    format: "iife",
    naming: "client.js",
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error("ui-settings-plugins: build nua client that bai: " + logsOf(result));
  const file = join(out, "client.js");
  const code = await Bun.file(file).text();
  const esm = code.split("\n").find((line) => /^\s*(?:import|export)\s/u.test(line));
  if (esm !== undefined) {
    throw new Error("ui-settings-plugins: bundle client lot cu phap ESM (se chet trong the <script> classic): " + esm.trim());
  }
  if (!code.includes("__ModuleLoader__") || !code.includes("loader.load({")) {
    throw new Error("ui-settings-plugins: bundle client khong dang ky qua __ModuleLoader__.load");
  }
  return file;
}

/**
 * Build cả hai nửa vào một thư mục đích.
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package.json).
 * Trả: đường dẫn file `index.js` của nửa host (thứ mà `bh host` kiểm để biết bản build còn cũ hay không).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const host = await buildHostHalf(out);
  await buildClientHalf(out);
  return host;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
