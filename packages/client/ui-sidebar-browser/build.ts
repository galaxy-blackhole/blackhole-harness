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

/** Dong dau moi artifact sinh ra — canh bao khong sua tay. */
const GENERATED_HEADER = [
  "/* eslint-disable */",
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TU DONG — dung sua tay; sua src/ roi chay bun run build.",
  " */",
].join("\n");

/**
 * Thut lui mot khoi ma nguon cho vua mot do sau.
 * Nhan: code — ma nguon; spaces — so khoang trang them vao moi dong.
 * Tra: ma nguon da thut lui.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code.split("\n").map((line) => (line.length > 0 ? pad + line : line)).join("\n");
}

/**
 * Boc bundle CJS thanh script classic dang ky DUNG MOT id — id CUA TA.
 * Nhan: code — ma CJS da bundle (dung module/exports nhu bien tu do).
 * Tra: van ban script classic hoan chinh.
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
    "  // Hai id ⇒ cung mot bundle chay hai lan ⇒ duplicate factory registration ⇒ app trang. MOT BUNDLE MOT ID.",
    "})();",
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
  if (!built.success) throw new Error("gbh-ui-sidebar-browser: build nua host that bai");
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
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
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-goal (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-ui-sidebar-browser: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(join(import.meta.dir, "lib", "client.js"));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao `outDir` (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ PHAI nhan `outDir` qua tham so dong lenh — `apps/cli/src/mount.ts` goi
 *   `buildIfStale(pkg, join(dir, "lib"))` voi thu muc dich la BAN MOUNT trong profile. Hard-code
 *   `join(import.meta.dir, "lib")` ⇒ mount chi ghi duoc `package.json` vao profile ⇒ profile THIEU lib/
 *   ⇒ tang nap khong sinh entry, ma moi phep kiem khac deu xanh.
 * Nhan: outDir — thu muc dich (tuy chon).
 * Tra: khong co.
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
  console.log("gbh-ui-sidebar-browser: da build lib/index.js + lib/client.js");
}
