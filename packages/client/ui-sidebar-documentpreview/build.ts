/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id) + ba chunk noi bo
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME, STOCK_NAME } from "./src/ids.ts";
import { chuanHoaIdSeed } from "../../../tools/lib/id-normalize.ts";

/** Nam dong header bat buoc cua repo, in vao artifact de ban build cung tu khai nguon. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/** Muoi module CSS — nguon su that duy nhat, nhung vao bundle bang define chu khong chep lai. */
const CSS_FILES: Record<string, string> = {
  LoadingIndicator: join(import.meta.dir, "src", "css", "LoadingIndicator.module.css"),
  TextPreview: join(import.meta.dir, "src", "css", "TextPreview.module.css"),
  MarkdownBody: join(import.meta.dir, "src", "css", "MarkdownBody.module.css"),
  HtmlBody: join(import.meta.dir, "src", "css", "HtmlBody.module.css"),
  ZoomControls: join(import.meta.dir, "src", "css", "ZoomControls.module.css"),
  ZoomViewport: join(import.meta.dir, "src", "css", "ZoomViewport.module.css"),
  ImageBody: join(import.meta.dir, "src", "css", "ImageBody.module.css"),
  CodeBody: join(import.meta.dir, "src", "css", "CodeBody.module.css"),
  OfficeBody: join(import.meta.dir, "src", "css", "OfficeBody.module.css"),
  FontNotice: join(import.meta.dir, "src", "css", "FontNotice.module.css"),
};

/** Thu muc lib cua GOI GOC trong apps/host — nguon cua ba chunk noi bo (PDF · bang tinh · truong frontmatter). */
const STOCK_LIB = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-sidebar-documentpreview", "lib");

/**
 * Ba chunk noi bo ma ban goc phat bang require.async — KHONG the viet lai (pdf.js va exceljs ~7 MB moi cai).
 *
 * ⚠️ 18/10/2026: build.ts CHEP NGUYEN VAN ba artifact nay tu goi goc va CHI SUA dong id trong header
 * load({ id, chunk, factory }) thanh id CUA TA, de require.async("./client.pdf.js") cua module ta
 * tim thay chunk trong chinh goi ta. Khong chep thi .pdf/.xlsx/.md-frontmatter MAT noi dung AM THAM
 * (khong loi console). Ba chunk nay chua react · react/jsx-runtime · ui-primitives · url · util.
 */
const STOCK_CHUNKS = ["client.pdf.js", "client.excel.js", "client.frontmatter-fields.js"];

/**
 * Rut gon log cua mot lan build hong thanh mot dong.
 * @param result - ket qua build cua Bun.
 * @returns chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Thut lui mot khoi ma nguon cho vua mot do sau.
 * @param code - ma nguon.
 * @param spaces - so khoang trang them vao moi dong.
 * @returns ma nguon da thut lui.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code.split("\n").map((line) => (line.length > 0 ? pad + line : line)).join("\n");
}

/**
 * Boc bundle CJS thanh script classic dang ky DUNG MOT id — id CUA TA.
 * @param code - ma CJS da bundle (dung module/exports nhu bien tu do).
 * @returns van ban script classic hoan chinh.
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
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
    "  // MOT BUNDLE MOT ID — in them id goc => duplicate factory registration => app trang.",
    "})();",
    "",
  ].join("\n");
}

/**
 * Chep ba chunk noi bo tu goi goc, sua dong id trong header load() thanh id cua ta.
 * @param out - thu muc dich.
 * @returns danh sach duong dan chunk da ghi.
 */
function copyStockChunks(out: string): string[] {
  const written: string[] = [];
  for (const name of STOCK_CHUNKS) {
    const source = join(STOCK_LIB, name);
    if (!existsSync(source)) {
      throw new Error("gbh-client-ui-sidebar-documentpreview: thieu chunk goc " + source + " — khong the phat ban xem PDF/bang tinh (mat noi dung AM THAM)");
    }
    const header = 'id: ' + JSON.stringify(STOCK_NAME) + ",\n\tchunk:";
    const replacement = 'id: ' + JSON.stringify(PACKAGE_NAME) + ",\n\tchunk:";
    const text = readFileSync(source, "utf8");
    if (!text.includes(header)) {
      throw new Error("gbh-client-ui-sidebar-documentpreview: chunk " + name + " khong con khuon load({ id, chunk }) — kiem lai truoc khi mount");
    }
    const target = join(out, name);
    // 08/11/2026 (P2): CHỈ đổi id seed của vỏ SPA (stock → GBH) — id stock khác giữ nguyên, in ra để Lead xử.
    const { text: daChuanHoa, giu } = chuanHoaIdSeed(text.replace(header, replacement));
    if (giu.length > 0) {
      console.log("[" + name + "] giữ id stock không có seed tương ứng: " + giu.map((muc) => muc.id + " ×" + String(muc.soLan)).join(", "));
    }
    writeFileSync(target, daChuanHoa);
    written.push(target);
  }
  return written;
}

/**
 * Build nua host: bundle ESM tu src/index.ts ra lib/index.js.
 * @param out - thu muc dich.
 * @returns duong dan artifact da ghi.
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
  if (!built.success) throw new Error("gbh-client-ui-sidebar-documentpreview: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id, kem muoi module CSS.
 * @param out - thu muc dich.
 * @returns duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const define: Record<string, string> = {};
  for (const [name, file] of Object.entries(CSS_FILES)) {
    define["__GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_" + name + "__"] = JSON.stringify(readFileSync(file, "utf8"));
  }
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    define,
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-sidebar-documentpreview: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-sidebar-documentpreview: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua va ba chunk noi bo vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ 18/10/2026: PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi
 *   buildIfStale(pkg, join(dir, "lib")) voi thu muc dich la BAN MOUNT trong profile. Hard-code
 *   join(import.meta.dir, "lib") ⇒ mount build ra lib/ cua repo roi chi ghi package.json vao profile
 *   ⇒ profile THIEU lib/ ⇒ tang nap khong sinh entry, ma moi phep kiem khac deu xanh.
 * @param outDir - thu muc dich (tuy chon).
 * @returns { host, client, chunks } — cac duong dan artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string; chunks: string[] }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  const chunks = copyStockChunks(out);
  return { host, client, chunks };
}

/**
 * Kiem nhanh ban build co ton tai va moi hon ma nguon khong.
 * @param outDir - thu muc ban mount.
 * @returns true khi artifact da co va moi hon build.ts.
 */
export function isFresh(outDir: string): boolean {
  const artifact = join(outDir, "client.js");
  if (!existsSync(artifact)) return false;
  return statSync(artifact).mtimeMs >= statSync(join(import.meta.dir, "build.ts")).mtimeMs;
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
  for (const chunk of built.chunks) console.log("copied " + chunk);
}
