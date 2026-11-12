/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

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
 * Nhan: code — ma CJS da bundle (dung module/exports nhu bien tu do).
 * Tra: van ban script classic hoan chinh.
 */
function wrapClientBundle(code: string): string {
  // 08/11/2026 (dev-1, sửa ca đỏ của cổng test): in khuôn loader ĐÚNG HÌNH DẠNG BẢN GỐC — mỗi khoá một DÒNG,
  // thụt lề TAB, và `factory: (require) => {`. Bản cũ gói tất cả vào MỘT dòng (`load({ id: …, factory: factory })`)
  // nên test `ui-tool` — vốn đối chiếu khuôn loader với bản gốc — không tìm thấy khung `load({`.
  return [
    GENERATED_HEADER,
    // Dòng loader ở CỘT 0 như bản gốc (test `ui-tool` khẳng định nguyên văn dòng này) ⇒ bỏ IIFE bọc ngoài,
    // chuyển "use strict" vào đầu thân factory (vẫn là câu lệnh đầu tiên nên giữ đúng ngữ nghĩa strict).
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
    "// ⚠️ Mot bundle MOT id: hai id ⇒ cung bundle chay hai lan ⇒ duplicate factory registration ⇒ app trang.",
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
  if (!built.success) throw new Error("gbh-client-ui-tool: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id.
 * CSS nam nguyen van trong src/styles.ts (giu hash lop goc) nen khong can define nao.
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
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-goal/ui-subagent (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-tool: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-tool: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ 18/10/2026: PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi
 *   buildIfStale(pkg, join(dir, "lib")) voi thu muc dich la BAN MOUNT trong profile. Hard-code
 *   join(import.meta.dir, "lib") ⇒ mount chi ghi duoc package.json vao profile ⇒ profile THIEU lib/
 *   ⇒ tang nap khong sinh entry, ma moi phep kiem khac deu xanh. Khuon nay copy tu ui-goal.
 * Nhan: outDir — thu muc dich (tuy chon).
 * Tra: { host, client } — duong dan hai artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-*.
  await renameClientArtifact(client);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}
