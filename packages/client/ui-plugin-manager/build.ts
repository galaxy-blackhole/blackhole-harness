/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Build HAI nửa của package: lib/index.js (nửa host, node ESM) và lib/client.js (nửa browser, script
 *      classic đăng ký MỘT id module, CSS của trang nhúng bằng define)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { ARTEFACT_PATCHES, type ArtefactPatch } from "./src/artefact-patches.ts";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 19/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-plugin-manager — khong sua tay",
  " */",
].join("\n");

/**
 * Áp các phép vá trong {@link ARTEFACT_PATCHES} lên artefact nửa browser, idempotent theo từng phép.
 * Nhận: file — đường dẫn artefact; patches — bảng vá.
 * Trả: số phép vá ĐÃ ÁP ở lượt này (0 nghĩa là artefact đã vá sẵn).
 * @throws khi artefact không còn khớp chuỗi gốc của một phép vá (drift ⇒ phải xem lại bảng, không vá mù).
 */
export function patchArtefact(file: string, patches: readonly ArtefactPatch[] = ARTEFACT_PATCHES): number {
  const goc = readFileSync(file, "utf8");
  let van = goc;
  let daAp = 0;
  for (const [ten, from, to] of patches) {
    // Đã vá rồi thì bỏ qua: mọi phép vá ở đây đều THÊM hoặc THAY, nên `to` xuất hiện nghĩa là xong.
    if (van.includes(to)) continue;
    const hit = van.split(from).length - 1;
    if (hit !== 1) throw new Error(PACKAGE_NAME + ": phép vá " + ten + " khớp " + String(hit) + " lần (cần đúng 1) — artefact đã trôi");
    van = van.replace(from, to);
    daAp += 1;
  }
  if (van !== goc) writeFileSync(file, van, "utf8");
  return daAp;
}

/** CSS của trang Plugins — nguồn sự thật duy nhất, nhúng vào bundle bằng define chứ không chép lại. */
const CSS_FILE = join(import.meta.dir, "src", "PluginManagerPage.module.css");

/** Tên biến define mà src/client.ts khai "declare const" — hai bên phải khớp từng ký tự. */
const CSS_DEFINE = "__GBH_PLUGIN_MANAGER_CSS__";

/** Tên file trung gian của nửa client (Bun trả qua outputs; ta ghi lib/client.js bằng tay sau khi bọc). */
const CLIENT_BUNDLE_NAME = "client.bundle.js";

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: code — khối mã; levels — số cấp thụt lề (2 dấu cách mỗi cấp).
 * Trả: khối mã đã thụt lề.
 */
function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: result — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Bọc bundle CJS thành script classic đăng ký MỘT id module (id CỦA TA).
 *
 * ⚠️ Quy tắc MỘT BUNDLE MỘT ID (trả giá 17/10/2026): đăng ký thêm id của gói GỐC trong CÙNG bundle làm cùng
 * một bundle chạy hai lần ⇒ "duplicate factory registration" ⇒ app trắng. Id gốc thuộc "gbh.row.aliases"
 * và tầng nạp TỰ sinh entry alias — KHÔNG viết lời gọi load thứ hai ở đây.
 * Nhận: code — mã CJS đã bundle (dùng module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
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
    "})();",
    "",
  ].join("\n");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 *
 * Nửa host: entry src/index.ts (PluginRegistryProbe) → ESM node, peer external.
 * Nửa client: entry src/client.ts → CJS browser, CSS nhúng qua define, rồi bọc thành script classic.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { host, client } — đường dẫn hai file đã build.
 * @throws khi một trong hai lượt Bun.build thất bại hoặc không sinh output.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  // 21/10/2026 (task-203): gói này ĐÃ de-bundle nửa browser (12 lát nguyên văn của bundle gốc, cổng byte ĐẠT).
  // Build lại từ src/client.ts sẽ GHI ĐÈ artefact nguyên văn ⇒ làm hỏng luật một-id + CSS 1:1. Vì vậy:
  // nếu đã có artefact de-bundle thì CHÉP nguyên văn sang thư mục đích rồi trả về, KHÔNG build lại.
  const daDebundle = existsSync(join(import.meta.dir, ".debundled-client")) || existsSync(join(import.meta.dir, "src", "parts"));
  if (daDebundle) {
    mkdirSync(out, { recursive: true });
    const dich: string[] = [];
    for (const ten of ["index.js", "client.js"]) {
      const nguon = join(import.meta.dir, "lib", ten);
      if (!existsSync(nguon)) continue;
      const den = join(out, ten);
      if (nguon !== den) copyFileSync(nguon, den);
      dich.push(den);
    }
    // 11/11/2026: artefact de-bundle không sinh lại được từ src/parts, nên các thay đổi hành vi phải là phép vá
    // khai báo (xem src/artefact-patches.ts). Áp ở ĐÂY để "bun run build" giữ đúng bản đang chạy.
    const client = dich[1] ?? join(out, "client.js");
    patchArtefact(client);
    return { host: dich[0] ?? join(out, "index.js"), client };
  }
  mkdirSync(out, { recursive: true });
  const hostResult = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!hostResult.success) throw new Error(PACKAGE_NAME + ": build nua host that bai: " + logsOf(hostResult));
  const clientResult = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: CLIENT_BUNDLE_NAME,
    write: false,
    packages: "external",
    define: {
      [CSS_DEFINE]: JSON.stringify(readFileSync(CSS_FILE, "utf8")),
    },
  } as Parameters<typeof Bun.build>[0]);
  if (!clientResult.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(clientResult));
  const bundle = clientResult.outputs[0];
  if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
  const clientPath = join(out, "client.js");
  writeFileSync(clientPath, wrapClientBundle(await bundle.text()));
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(join(import.meta.dir, "lib", "client.js"));
  return { host: join(out, "index.js"), client: clientPath };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host + " + " + built.client);
}
