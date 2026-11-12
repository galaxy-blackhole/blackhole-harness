/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./src/ids.ts";

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
    "  // ⚠️ 17/10/2026: ban cu in them load({ id: STOCK_PACKAGE_NAME }) => bundle dang ky HAI id => cung mot",
    "  //   bundle chay hai lan => duplicate factory registration => app trang. MOT BUNDLE MOT ID.",
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
  if (!built.success) throw new Error("gbh-client-ui-workspace: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id, kem bon module CSS.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  // 20/10/2026 — CHỐNG HỒI QUY: gói này đã được DE-BUNDLE (14 lát nguyên văn trong `src/parts/`, artefact 232.912 B
  // = bản gốc + Δid, cổng byte hai chiều ĐẠT). Nhánh build từ `src/client.ts` (bản viết tay cũ) sẽ GHI ĐÈ và làm
  // mất 15.633 B ⇒ menu context session lại thiếu mục. Vì vậy: nếu đã có lát de-bundle thì TỪ CHỐI build đè, in
  // hướng dẫn tái sinh bằng công cụ đúng.
  const partsDir = join(import.meta.dir, "src", "parts");
  if (existsSync(partsDir)) {
    throw new Error(
      "gbh-client-ui-workspace: goi nay DA de-bundle (src/parts/) — KHONG build de len. Tai sinh artefact bang:\n" +
        "  ~/.bun/bin/bun run tools/debundle-client.ts packages/client/ui-workspace " + STOCK_PACKAGE_NAME + " " + PACKAGE_NAME,
    );
  }
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    // Bon module CSS nam SAN trong src/css.ts (nguyen van tung byte, giu hash lop goc) nen bundle khong can
    // define: chung di theo import nhu moi hang so khac. write khong nam trong kieu cua Bun o ban nay
    // ⇒ ep kieu nhu ui-subagent (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-workspace: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-workspace: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ 18/10/2026: PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi
 *   buildIfStale(pkg, join(dir, "lib")) voi thu muc dich la BAN MOUNT trong profile.
 * Nhan: outDir — thu muc dich (tuy chon).
 * Tra: { host, client } — duong dan hai artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  // 20/10/2026 — kiểm TRƯỚC khi xoá thư mục đích: nếu đã de-bundle thì CHÉP artefact, không được để mất.
  const partsDirTruoc = join(import.meta.dir, "src", "parts");
  if (existsSync(partsDirTruoc)) {
    // Gói đã DE-BUNDLE: artefact trong `lib/` là bản dựng ĐÚNG (bản gốc + Δid, cổng byte hai chiều).
    // Mount sẽ gọi hàm này với outDir = bản trong profile ⇒ CHÉP artefact sang, KHÔNG build lại từ `src/client.ts`
    // (bản viết tay cũ, thiếu 15.633 B) và KHÔNG ném lỗi (ném lỗi ⇒ mount hỏng ⇒ row gốc của DSH bật lại).
    const nguon = join(import.meta.dir, "lib");
    mkdirSync(out, { recursive: true });
    const dich: string[] = [];
    for (const ten of ["index.js", "client.js"]) {
      const tu = join(nguon, ten);
      const den = join(out, ten);
      if (!existsSync(tu)) throw new Error("gbh-client-ui-workspace: thieu artefact de-bundle " + tu);
      if (tu !== den) copyFileSync(tu, den);
      dich.push(den);
    }
    return { host: dich[0] ?? join(out, "index.js"), client: dich[1] ?? join(out, "client.js") };
  }
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
