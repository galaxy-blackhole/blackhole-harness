/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build hai nua cua package ui-jobs: lib/index.js (node ESM) va lib/client.js (script classic dang ky MOT id module)
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Header nam dong bat buoc cua repo, chen vao file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 19/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-jobs — khong sua tay",
  " */",
].join(String.fromCharCode(10));

/**
 * Thut le moi dong khong rong cua mot khoi ma.
 * Nhận: khoi ma va so cap thut le.
 * Trả: khoi ma da thut le.
 */
function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split(String.fromCharCode(10))
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join(String.fromCharCode(10));
}

/**
 * Gom log cua mot lan build hong thanh mot dong.
 * Nhận: ket qua build cua Bun.
 * Trả: chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/** Id STOCK và id CỦA TA của bundle — dùng để quy id khi so BYTE với bản gốc. */
const ID_MAP: readonly (readonly [string, string])[] = [
  ["@deepseek-ai/dsh-client-ui-jobs", "@galaxy-blackhole/gbh-client-ui-jobs"],
];

/**
 * Nối TOÀN BỘ mảnh `src/client-parts/*.ts` thành văn bản NGUYÊN VĂN của bản gốc (bỏ khối header 8 dòng của mỗi mảnh).
 * Nhận: không.
 * Trả: nội dung JS đúng như `@deepseek-ai/dsh-client-ui-jobs/lib/client.js`.
 */
function readStockTextFromParts(): string {
  const dir = join(import.meta.dir, "src", "client-parts");
  const parts = readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .sort();
  const chunks = parts.map((name) => {
    const text = readFileSync(join(dir, name), "utf8");
    // Bỏ khối header: từ dòng đầu tới dòng "*/" ĐẦU TIÊN, rồi bỏ dòng "// @ts-nocheck" và dòng trống ngay sau.
    const end = text.indexOf("*/");
    const rest = end === -1 ? text : text.slice(end + 2);
    return rest.replace(/^\n\/\/ @ts-nocheck\n\n?/, "");
  });
  return chunks.join("");
}

/**
 * Quy id trong một văn bản theo chiều cho trước.
 * Nhận: văn bản nguồn và danh sách cặp [từ, đến].
 * Trả: văn bản đã thay (thay từ dài trước để không đè lên nhau).
 */
function mapIds(text: string, direction: readonly (readonly [string, string])[]): string {
  let out = text;
  for (const [from, to] of direction) out = out.split(from).join(to);
  return out;
}

/**
 * Sinh `lib/client.js` từ MẢNH DE-BUNDLE và CHẠY CỔNG BYTE.
 *
 * Quy trình: mảnh (id stock) → quy stock→ta → thêm header sinh tự động ⇒ artifact. Cổng: bỏ header của artifact,
 * quy ta→stock, rồi so BYTE với nội dung mảnh. Lệch ⇒ ném lỗi kèm **3 dòng ngữ cảnh** quanh byte lệch đầu tiên.
 * Nhận: không.
 * Trả: văn bản artifact hoàn chỉnh (đã kèm header).
 */
function buildClientFromParts(): string {
  const stockText = readStockTextFromParts();
  const forward = ID_MAP;
  const backward = ID_MAP.map(([stockId, ourId]) => [ourId, stockId] as const);
  const artifact = GENERATED_HEADER + String.fromCharCode(10) + mapIds(stockText, forward);
  const artifactBody = artifact.slice(GENERATED_HEADER.length + 1);
  const roundTrip = mapIds(artifactBody, backward);
  if (roundTrip !== stockText) {
    const limit = Math.min(roundTrip.length, stockText.length);
    let at = 0;
    while (at < limit && roundTrip[at] === stockText[at]) at += 1;
    const context = (value: string): string =>
      value
        .slice(Math.max(0, at - 60), at + 60)
        .split(String.fromCharCode(10))
        .slice(0, 3)
        .join(" ⏎ ");
    throw new Error(
      "CỔNG BYTE FAIL: artifact (quy về id stock) KHÁC bản gốc tại byte " +
        at +
        String.fromCharCode(10) +
        "  BẢN GỐC : " +
        context(stockText) +
        String.fromCharCode(10) +
        "  ARTIFACT: " +
        context(roundTrip),
    );
  }
  return artifact;
}

/**
 * Build nua host thanh mot file ESM (peer external de chi co mot instance trong tien trinh).
 * Nhận: thu muc dich.
 * Trả: duong dan file da build.
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
  if (!result.success) throw new Error("gbh-client-ui-jobs: build nua host that bai: " + logsOf(result));
  const file = join(out, "index.js");
  writeFileSync(file, GENERATED_HEADER + String.fromCharCode(10) + String(await Bun.file(file).text()));
  return file;
}

/**
 * Build nua browser thanh script classic dang ky DUNG MOT id module (id cua ta).
 *
 * Hop dong C2: script chi DANG KY factory, than module nam trong closure cua factory va chay o lan vat
 * chat hoa dau tien. Loader nap bundle bang the script classic (khong phai ESM) nen bundle duoc build o
 * dang CJS roi boc trong loi goi dang ky. Entry client build RIENG (khong gop chung mot lan Bun.build voi
 * entry host): gop entry ⇒ Bun chen prelude chung ⇒ byte lech.
 * Nhận: thu muc dich.
 * Trả: duong dan file da build.
 */
async function buildClientHalf(out: string): Promise<string> {
  /** Thư mục TẠM cho bản build trung gian của nửa client (không ghi vào repo). */
  const scratch = join(tmpdir(), "gbh-ui-jobs-client-" + process.pid + "-" + Date.now());
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    // 19/10/2026 (đồng nhất với 4 gói task-121): `BuildConfig` KHÔNG có option `write` ⇒ build vào
    // THƯ MỤC TẠM rồi đọc `outputs[0].text()`. Không cast, không `as never`.
    outdir: scratch,
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-client-ui-jobs: build nua browser that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-jobs: build nua browser khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, buildClientFromParts());
  return target;
}

/**
 * Boc bundle CJS thanh script classic dang ky MOT id module.
 *
 * Loi goi dang ky phai in DUNG khuon mau cua repo (goi ui-goal): mot dong
 * window.__ModuleLoader__.load({ id: "id ta", factory: factory }). Ban cu tach doi
 * (var register = globalThis.__ModuleLoader__.load; register(...)) ⇒ regex nhan dien cua gate khong khop
 * va de doc sai thanh "dang ky kieu khac".
 * Nhận: ma CJS da bundle (dung module/exports nhu bien tu do).
 * Trả: van ban script classic hoan chinh.
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
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
    "  // MOT BUNDLE MOT ID: in them id goc ⇒ bundle chay hai lan ⇒ duplicate factory registration.",
    "})();",
    "",
  ].join(String.fromCharCode(10));
}

/**
 * Build ca hai nua vao thu muc dich (moi entry mot lan Bun.build rieng).
 * Nhận: thu muc dich (mac dinh: lib canh package).
 * Trả: danh sach file da build.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  return [host, client];
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])).join(" + "));
}