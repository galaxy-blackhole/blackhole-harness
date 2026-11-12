/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package ui-permission: lib/index.js (node ESM) va lib/client.js (script classic dang ky MOT id module)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Header nam dong bat buoc cua repo, chen vao file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-permission-presets — khong sua tay",
  " */",
].join(String.fromCharCode(10));

/** CSS cua hai module — nguon su that duy nhat, nhung vao bundle bang define chu khong chep lai. */
const CSS_FILES = {
  row: join(import.meta.dir, "src", "PermissionRow.module.css"),
  select: join(import.meta.dir, "src", "PermissionSelect.module.css"),
} as const;

/**
 * Gom log cua mot lan build hong thanh mot dong.
 * Nhan: ket qua build cua Bun.
 * Tra: chuoi log da noi.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nua host thanh mot file ESM (peer external de chi co mot instance trong tien trinh).
 * Nhan: thu muc dich.
 * Tra: duong dan file da build.
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
  if (!result.success) throw new Error("gbh-client-ui-permission-presets: build nua host that bai: " + logsOf(result));
  const file = join(out, "index.js");
  writeFileSync(file, GENERATED_HEADER + String.fromCharCode(10) + String(await Bun.file(file).text()));
  return file;
}

/**
 * Build nua browser thanh script classic dang ky HAI id module (id cua ta la id chinh, id goc la id phu).
 * Nhan: thu muc dich.
 * Tra: duong dan file da build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    packages: "bundle",
    define: {
      __GBH_PERMISSION_ROW_CSS__: JSON.stringify(readFileSync(CSS_FILES.row, "utf8")),
      __GBH_PERMISSION_SELECT_CSS__: JSON.stringify(readFileSync(CSS_FILES.select, "utf8")),
    },
  });
  if (!result.success) throw new Error("gbh-client-ui-permission-presets: build nua browser that bai: " + logsOf(result));
  const body = await result.outputs[0]?.text();
  if (body === undefined) throw new Error("gbh-client-ui-permission-presets: build nua browser khong tra output");
  const lines = [
    GENERATED_HEADER,
    "(function () {",
    "  var factory = (function () {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    body,
    "    return function (require) { return module.exports.createPlugin(require); };",
    "  })();",
    "  var register = globalThis.__ModuleLoader__.load;",
    // CHI MOT id: id cua ta. Id goc di qua gbh.row.aliases (tang nap sinh entry alias tro ve bundle nay),
    // dung khuon #2 cua task-57 — dang ky id goc o day nua la lop loi 'duplicate factory registration'.
    "  register({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ];
  const file = join(out, "client.js");
  writeFileSync(file, lines.join(String.fromCharCode(10)));
  return file;
}

/**
 * Build ca hai nua vao thu muc dich.
 * Nhan: thu muc dich (mac dinh: lib canh package).
 * Tra: danh sach file da build.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  // 20/10/2026: nếu gói đã de-bundle (src/parts) thì CHÉP artefact, không build lại (xem tools/debundle-guard.ts).
  const daDebundle = copyIfDebundled(import.meta.dir, outDir ?? join(import.meta.dir, "lib"));
  if (daDebundle !== null) return daDebundle as never;
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  return [await buildHostHalf(out), await buildClientHalf(out)];
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])).join(" + "));
}
