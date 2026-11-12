/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 *      11/11/2026: in khuon loader DUNG HINH DANG BAN GOC (moi khoa mot DONG, thut TAB) thay cho mot dong
 *      `load({ id: …, factory: factory })` — ca do cua tests/client/ui-deliverables.test.ts (phep do doi
 *      chieu NGUYEN VAN dong loader voi bundle goc khong tim thay khung `load({`).
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Nam dong header bat buoc cua repo, in vao artifact de ban build cung tu khai nguon. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 11/11/2026 — khuon loader dung hinh dang ban goc (moi khoa mot dong, thut TAB)",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/** Nam module CSS — nguon su that duy nhat, nhung vao bundle bang define chu khong chep lai. */
const CSS_FILES = {
  presentRow: join(import.meta.dir, "src", "PresentRow.module.css"),
  fileDiff: join(import.meta.dir, "src", "FileDiff.module.css"),
  changedFiles: join(import.meta.dir, "src", "ChangedFiles.module.css"),
  deliverables: join(import.meta.dir, "src", "Deliverables.module.css"),
  reviewTab: join(import.meta.dir, "src", "ReviewTab.module.css"),
} as const;

/**
 * Doc than CSS cua mot file .module.css, BO khoi header 5 dong cua repo.
 *
 * ⚠️ 18/10/2026: header la luat cua repo, nhung CSS phai NGUYEN VAN TUNG BYTE so voi ban goc (giu nguyen
 * hash lop). Vi vay header chi nam trong FILE NGUON; ban nhung vao bundle la than CSS y nguyen ban goc.
 * Nhan: file — duong dan file .module.css.
 * Tra: van ban CSS khong con header.
 */
function cssOf(file: string): string {
  const text = readFileSync(file, "utf8");
  const withoutHeader = text.startsWith("/*") ? text.slice(text.indexOf("*/") + 2) : text;
  return withoutHeader.replace(/^\s*\n/, "").replace(/\n$/, "");
}

/**
 * Thut lui mot khoi ma nguon cho vua mot do sau.
 * Nhan: code — ma nguon; spaces — so khoang trang them vao moi dong.
 * Tra: ma nguon da thut lui.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? pad + line : line))
    .join("\n");
}

/**
 * Gom log cua mot lan build hong thanh mot dong.
 * Nhan: result — ket qua build cua Bun.
 * Tra: chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Boc bundle CJS thanh script classic dang ky DUNG MOT id — id CUA TA.
 *
 * ⚠️ 11/11/2026 — in khuon loader DUNG HINH DANG BAN GOC cua goi: `load({` roi `id: …` va
 *   `factory: (require) => {` moi thu MOT DONG, thut le TAB. Ban cu gop ca ba vao MOT dong
 *   (`load({ id: …, factory: factory })`) nen phep do cua tests/client/ui-deliverables.test.ts — doi
 *   chieu NGUYEN VAN dong loader voi bundle goc — khong tim thay khung `load({` ⇒ ca DO. Cung khuon
 *   nay da ap cho ui-tool (08/11/2026) va la khuon chung cua cac goi client khac trong repo.
 *   IIFE boc ngoai bi bo: dong loader phai o COT 0 nhu ban goc; `"use strict"` chuyen vao dong DAU
 *   than factory nen ngu nghia strict giu nguyen (no van la cau lenh dau tien cua ham).
 * Nhan: code — ma CJS da bundle (dung module/exports nhu bien tu do).
 * Tra: van ban script classic hoan chinh.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "// id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "window.__ModuleLoader__.load({",
    "\tid: " + JSON.stringify(PACKAGE_NAME) + ",",
    "\tfactory: (require) => {",
    '    "use strict";',
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "\t}",
    "});",
    "// KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
    "// ⚠️ 17/10/2026: ban cu in them load({ id: STOCK_PACKAGE_NAME }) => bundle dang ky HAI id => cung mot",
    "//   bundle chay hai lan => duplicate factory registration => app trang. MOT BUNDLE MOT ID.",
    "",
  ].join("\n");
}

/**
 * Build nua host: bundle ESM tu src/index.ts ra lib/index.js.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
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
  if (!built.success) throw new Error("gbh-client-ui-deliverables: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id, kem CSS nam module.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    define: {
      __GBH_UI_DELIVERABLES_PRESENT_ROW_CSS__: JSON.stringify(cssOf(CSS_FILES.presentRow)),
      __GBH_UI_DELIVERABLES_FILE_DIFF_CSS__: JSON.stringify(cssOf(CSS_FILES.fileDiff)),
      __GBH_UI_DELIVERABLES_CHANGED_FILES_CSS__: JSON.stringify(cssOf(CSS_FILES.changedFiles)),
      __GBH_UI_DELIVERABLES_DELIVERABLES_CSS__: JSON.stringify(cssOf(CSS_FILES.deliverables)),
      __GBH_UI_DELIVERABLES_REVIEW_TAB_CSS__: JSON.stringify(cssOf(CSS_FILES.reviewTab)),
    },
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-subagent (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-deliverables: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-deliverables: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ 18/10/2026: PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi
 *   buildIfStale(pkg, join(dir, "lib")) voi thu muc dich la BAN MOUNT trong profile. Ban dau toi
 *   hard-code join(import.meta.dir, "lib") ⇒ mount build ra lib/ cua repo roi chi ghi duoc
 *   package.json vao profile ⇒ profile THIEU lib/ ⇒ tang nap khong sinh entry, ma moi phep kiem
 *   khac deu xanh. Khuon nay copy tu ui-goal (buildPackage(outDir?) + process.argv[2]).
 * Nhan: outDir — thu muc dich (tuy chon).
 * Tra: { host, client } — duong dan hai artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
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
