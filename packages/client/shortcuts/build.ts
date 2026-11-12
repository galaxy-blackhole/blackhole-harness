/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Build BA dau ra: lib/index.js (host ESM) · lib/protocol.js (goc chung ESM) · lib/client.js (LAT NGUYEN VAN + cong byte)
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Id cua bundle goc (stock) — dung cho cong byte. */
const STOCK_ID = "@deepseek-ai/dsh-client-shortcuts";

/** Duong dan bundle goc de so byte (chi doc). */
const STOCK_BUNDLE = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-shortcuts", "lib", "client.js");

/** Dong danh dau lat nguyen van. */
const SLICE_MARKER = "// @ts-nocheck";

/** Năm dòng header bắt buộc của repo, chèn vào mọi file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-shortcuts — khong sua tay",
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
 * Build một entry ESM cho Node (peer để external).
 * Nhận: `entry` — tên file trong `src`, `out` — thư mục đích, `name` — tên file ra.
 * Trả: đường dẫn file đã build.
 * @throws khi Bun build thất bại.
 */
async function buildEsm(entry: string, out: string, name: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", entry)],
    outdir: out,
    target: "node",
    format: "esm",
    packages: "external",
    naming: name,
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error(`shortcuts: build ${entry} that bai: ` + logsOf(result));
  return join(out, name);
}

/**
 * Ghép các lát NGUYÊN VĂN trong `src/parts` thành đúng văn bản bundle gốc (bỏ phần giao ke của file .ts).
 * Nhận: `partsDir` — thư mục chứa lát.
 * Trả: văn bản đã ghép.
 */
function assembleParts(partsDir: string): string {
  const NL = String.fromCharCode(10);
  const files = readdirSync(partsDir).filter((name) => name.endsWith(".ts")).sort();
  const bodies = files.map((name) => {
    const lines = readFileSync(join(partsDir, name), "utf8").split(NL);
    const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
    if (marker < 0) throw new Error(name + ": khong thay dong danh dau lat nguyen van");
    const end = lines.findIndex((line, i) => i > marker && line.trim() === "export {};");
    if (end < 0) throw new Error(name + ": thieu dong ket thuc lat");
    const body = lines.slice(marker + 1, end);
    // Bo dung MOT dong trong ma generator chen truoc dong ket thuc, de ghep lai dung NGUYEN VAN.
    if (body.length > 0 && body[body.length - 1] === "") body.pop();
    return body;
  });
  const flat: string[] = [];
  for (const body of bodies) flat.push(...body);
  return flat.join(NL);
}

/**
 * Vị trí ký tự lệch đầu tiên giữa hai chuỗi.
 * Nhận: `a`, `b` — hai chuỗi.
 * Trả: chỉ số lệch (hoặc độ dài ngắn hơn nếu một chuỗi là tiền tố của chuỗi kia).
 */
function firstDifference(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) if (a[i] !== b[i]) return i;
  return limit;
}

/**
 * Build nửa browser thành MỘT script classic: ghép lát nguyên văn, đổi ĐÚNG MỘT id, rồi so BYTE với bản gốc.
 * Nhận: `out` — thư mục đích.
 * Trả: đường dẫn file `client.js`.
 * @throws khi cổng byte lệch (kèm ngữ cảnh hai phía) hoặc khi bundle lọt cú pháp ESM.
 */
async function buildClient(out: string): Promise<string> {
  const assembled = assembleParts(join(import.meta.dir, "src", "parts"));
  const quyId = (text: string): string => text.split(JSON.stringify(STOCK_ID)).join(JSON.stringify(PACKAGE_NAME)).split(STOCK_ID).join(PACKAGE_NAME).split("@deepseek-ai/dsh-client-ui-primitives").join("@galaxy-blackhole/gbh-client-ui-primitives").split("@deepseek-ai/dsh-client-store").join("@galaxy-blackhole/gbh-client-store").split("@deepseek-ai/dsh-client-ui-slots").join("@galaxy-blackhole/gbh-client-ui-slots").split("@deepseek-ai/dsh-client-ui-dockkit").join("@galaxy-blackhole/gbh-client-ui-dockkit").split("@deepseek-ai/dsh-typert-generator").join("@galaxy-blackhole/gbh-typert-generator");
  const ours = quyId(assembled);
  const expected = quyId(readFileSync(STOCK_BUNDLE, "utf8"));
  if (ours !== expected) {
    const at = firstDifference(ours, expected);
    const ctx = (text: string): string => text.slice(Math.max(0, at - 40), at + 40);
    throw new Error(
      "shortcuts: CONG BYTE DO — ghep " + String(ours.length) + " B vs goc-quy-doi " + String(expected.length) + " B, lech o " + String(at) + String.fromCharCode(10) +
        "  ta : " + ctx(ours) + String.fromCharCode(10) +
        "  goc: " + ctx(expected),
    );
  }
  const file = join(out, "client.js");
  writeFileSync(file, ours, "utf8");
  const esm = ours.split(String.fromCharCode(10)).find((line) => /^\s*(?:import|export)\s/u.test(line));
  if (esm !== undefined) throw new Error("shortcuts: bundle client lot cu phap ESM: " + esm.trim());
  if (!ours.includes("__ModuleLoader__") || !ours.includes(JSON.stringify(PACKAGE_NAME))) {
    throw new Error("shortcuts: bundle client khong dang ky dung id " + PACKAGE_NAME);
  }
  return file;
}

/**
 * Build cả ba đầu ra vào một thư mục đích.
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package.json).
 * Trả: đường dẫn file `index.js` của nửa host.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const host = await buildEsm("index.ts", out, "index.js");
  const code = await Bun.file(host).text();
  for (const name of ["Config", "apply"]) {
    if (!code.includes(name)) throw new Error("shortcuts: nua host thieu export " + name);
  }
  await buildEsm("protocol.ts", out, "protocol.js");
  await buildClient(out);
  return host;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
