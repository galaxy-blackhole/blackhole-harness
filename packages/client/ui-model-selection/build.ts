/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build HAI nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id cua ta)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CSS_GLOBAL, PACKAGE_NAME, STYLE_MODEL_SELECT } from "./src/ids.ts";

/** Nam dong header bat buoc cua repo, in vao artifact de ban build cung tu khai nguon. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 19/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/**
 * Doc phan CSS cua module, BO khoi header 5 dong bat buoc cua repo.
 *
 * ⚠️ Header la luat cua repo, nhung the style luc chay phai NGUYEN VAN tung byte nhu ban goc
 *   (giu nguyen hash lop va moi ky tu). Vi vay header chi nam o file nguon, con artifact nhan phan CSS.
 * Nhận: path — duong dan file .module.css.
 * Trả: van ban CSS nguyen van (khong con header).
 */
function cssBody(path: string): string {
  const text = readFileSync(path, "utf8");
  const end = text.indexOf("*/");
  return (end < 0 ? text : text.slice(end + 2)).trim();
}

/**
 * Thut lui mot khoi ma nguon cho vua mot do sau.
 * Nhận: code — ma nguon; spaces — so khoang trang them vao moi dong.
 * Trả: ma nguon da thut lui.
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
 * Nhận: result — ket qua build cua Bun.
 * Trả: chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Boc bundle CJS thanh script classic dang ky DUNG MOT id — id CUA TA.
 * Nhận: code — ma CJS da bundle (dung module/exports nhu bien tu do).
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
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
    "  // ⚠️ Dang ky them id goc => bundle dang ky HAI id => cung mot bundle chay hai lan",
    "  //   => duplicate factory registration => app trang. MOT BUNDLE MOT ID.",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build nua host: bundle ESM tu src/index.ts ra lib/index.js (KHONG doi hanh vi host).
 * Nhận: out — thu muc dich.
 * Trả: duong dan artifact da ghi.
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
  if (!built.success) throw new Error("@galaxy-blackhole/gbh-client-ui-model-selection: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id, kem CSS nam trong define.
 * Nhận: out — thu muc dich.
 * Trả: duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  // 19/10/2026: build vào thư mục TẠM (`BuildConfig` không có option `write`), đọc `outputs[0].text()`.
  const scratch = join(tmpdir(), "gbh-ui-model-selection-client-" + process.pid + "-" + Date.now());
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    // 19/10/2026 (TS2353): `BuildConfig` KHÔNG có option `write` ⇒ build vào THƯ MỤC TẠM rồi đọc
    // `outputs[0].text()`. Bun luôn trả outputs trong bộ nhớ; không dùng `as never`.
    outdir: scratch,
    packages: "external",
    define: {
      [CSS_GLOBAL]: JSON.stringify(cssBody(join(import.meta.dir, "src", STYLE_MODEL_SELECT))),
    },
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-agent-preset (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("@galaxy-blackhole/gbh-client-ui-model-selection: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("@galaxy-blackhole/gbh-client-ui-model-selection: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi build.ts voi thu muc dich la BAN MOUNT
 *   trong profile. Hard-code join(import.meta.dir, "lib") ⇒ mount build ra lib/ cua repo ⇒ profile THIEU lib/.
 * Nhận: outDir — thu muc dich (tuy chon).
 * Trả: duong dan artifact nua host (giu nguyen hop dong cu cua buildPackage).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  await buildClientHalf(out);
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(join(import.meta.dir, "lib", "client.js"));
  return host;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
  console.log("built " + join(process.argv[2] ?? join(import.meta.dir, "lib"), "client.js"));
}