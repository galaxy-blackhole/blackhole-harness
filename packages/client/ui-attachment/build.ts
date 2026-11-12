/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build HAI nửa của row ui-attachment: lib/index.js (nửa host, ESM) + lib/client.js (nửa browser, script
 *      classic cho Loader). Khung scaffold CHỈ build src/index.ts ⇒ không bao giờ sinh lib/client.js — đó là
 *      lỗi làm app trắng lúc 19:13 (ClientModuleRegistry ném 'client bundle not found' lúc boot). Vì vậy file
 *      này build CẢ HAI nửa, và gói CHỈ được khai "dsh.client" khi lib/client.js đã tồn tại thật.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

/** Năm dòng header bắt buộc, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-attachment — khong sua tay",
  " */",
].join("\n");

/**
 * Gom log của một lần build hỏng thành một dòng.
 * @param result - kết quả build của Bun.
 * @returns chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/** Cặp id [STOCK, CỦA TA] dùng khi quy id để so BYTE với bản gốc. */
const ID_MAP: readonly (readonly [string, string])[] = [
  ["@deepseek-ai/dsh-client-ui-attachment", "@galaxy-blackhole/gbh-client-ui-attachment"],
];

/**
 * Nối TOÀN BỘ mảnh `src/client-parts/*.ts` thành văn bản NGUYÊN VĂN của bản gốc (bỏ header mỗi mảnh).
 * Nhận: không. Trả: nội dung JS đúng như bản gốc `lib/client.js`.
 */
function readStockTextFromParts(): string {
  const dir = join(import.meta.dir, "src", "client-parts");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .sort()
    .map((name) => {
      const text = readFileSync(join(dir, name), "utf8");
      const end = text.indexOf("*/");
      const rest = end === -1 ? text : text.slice(end + 2);
      return rest.replace(/^\n\/\/ @ts-nocheck\n\n?/, "");
    })
    .join("");
}

/** Quy id theo chiều cho trước. Nhận: văn bản, danh sách cặp. Trả: văn bản đã thay. */
function mapIds(text: string, direction: readonly (readonly [string, string])[]): string {
  let out = text;
  for (const [from, to] of direction) out = out.split(from).join(to);
  return out;
}

/**
 * Sinh `lib/client.js` từ mảnh de-bundle và CHẠY CỔNG BYTE (quy ta→stock rồi so với bản gốc; lệch ⇒ ném lỗi
 * kèm 3 dòng ngữ cảnh quanh byte lệch đầu tiên).
 * Nhận: không. Trả: nội dung artifact (header + thân đã quy id sang id của ta).
 */
function buildClientFromParts(): string {
  const stockText = readStockTextFromParts();
  const backward = ID_MAP.map(([stockId, ourId]) => [ourId, stockId] as const);
  const artifact = GENERATED_HEADER + String.fromCharCode(10) + mapIds(stockText, ID_MAP);
  const body = artifact.slice(GENERATED_HEADER.length + 1);
  const roundTrip = mapIds(body, backward);
  if (roundTrip !== stockText) {
    const limit = Math.min(roundTrip.length, stockText.length);
    let at = 0;
    while (at < limit && roundTrip[at] === stockText[at]) at += 1;
    const context = (value: string): string =>
      value.slice(Math.max(0, at - 60), at + 60).split(String.fromCharCode(10)).slice(0, 3).join(" ⏎ ");
    throw new Error(
      "CỔNG BYTE FAIL: artifact khác bản gốc tại byte " + at + String.fromCharCode(10) +
        "  BẢN GỐC : " + context(stockText) + String.fromCharCode(10) +
        "  ARTIFACT: " + context(roundTrip),
    );
  }
  return artifact;
}

/**
 * Build nửa host thành một file ESM duy nhất.
 * @param out - thư mục đích.
 * @returns đường dẫn file đã build.
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
  if (!result.success) throw new Error("gbh-client-ui-attachment: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic (IIFE) — Loader nạp bundle bằng thẻ script, KHÔNG phải ESM.
 *
 * Chính src/client.ts tự đăng ký id module với __ModuleLoader__ (một id: id của ta), nên ở đây chỉ cần
 * build ra file script; không bọc thêm lời gọi đăng ký nào.
 * @param out - thư mục đích.
 * @returns đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "iife",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-client-ui-attachment: build nua client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-attachment: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, buildClientFromParts());
  return target;
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * @param outDir - thư mục đích (mặc định: lib cạnh package.json).
 * @returns đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
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
