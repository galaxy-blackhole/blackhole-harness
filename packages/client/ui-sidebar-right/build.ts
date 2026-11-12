/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 */

import { readFileSync } from "node:fs";
import { assembleClientBundle, normalizeId, readWrapper } from "./src/assemble-client.ts";
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
 * Nhan: code — ma CJS da bundle (dung module/exports/require nhu bien tu do).
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
    // 09/11/2026 (Lead yeu cau): khuon DE-BUNDLE — dong loader tach 3 dong, id o dong rieng thut TAB.
    "  window.__ModuleLoader__.load({",
    "\t" + "id: " + JSON.stringify(PACKAGE_NAME) + ",",
    "  \tfactory: factory,",
    "  });",
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
  if (!built.success) throw new Error("gbh-client-ui-sidebar-right: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Build nua client: bundle CJS tu src/client.ts roi boc thanh script classic mot id.
 *
 * ⚠️ packages: "external" la BAT BUOC: ban goc require sau module ngoai (react · react/jsx-runtime ·
 *   react-dom · zod · dsh-client-store · dsh-client-ui-primitives · dsh-client-ui-dockkit) tu bang module
 *   cua loader. Bundle chung vao se tao ban sao thu hai cua react ⇒ hook cua React #321.
 *   CSS nam SAN trong src/css.ts (nguyen van tung byte, giu hash lop goc) nen bundle khong can define.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
/**
 * CỔNG BYTE nửa client (khung task-174): ghép vỏ + lát ⇒ chuẩn hoá id ⇒ phải BẰNG ĐÚNG bản gốc từng byte.
 * CHƯA có lát nào ⇒ cổng ĐỎ CÓ CHỦ ĐÍCH kèm số byte lệch + 3 dòng ngữ cảnh đầu tiên khác nhau.
 * Nhận: ghep — văn bản bundle của ta; goc — văn bản bundle gốc đọc từ node_modules (chỉ đọc).
 * Trả: không. @throws khi lệch byte.
 */
function gateClientBytes(ghep: string, goc: string): void {
  const chuanHoa = Buffer.from(normalizeId(ghep), "utf8");
  const gocBytes = Buffer.from(goc, "utf8");
  if (chuanHoa.equals(gocBytes)) return;
  const dongTa = normalizeId(ghep).split("\n");
  const dongGoc = goc.split("\n");
  const nguCanh: string[] = [];
  for (let i = 0; i < Math.max(dongTa.length, dongGoc.length) && nguCanh.length < 3; i += 1) {
    if ((dongTa[i] ?? "") !== (dongGoc[i] ?? "")) {
      nguCanh.push("  dong " + String(i + 1) + " | ta: " + String(dongTa[i] ?? "(khong co)").slice(0, 100));
      nguCanh.push("           | goc: " + String(dongGoc[i] ?? "(khong co)").slice(0, 100));
    }
  }
  throw new Error(
    "CỔNG BYTE ĐỎ (khung de-bundle task-174): ban ghep " + String(chuanHoa.length) + " B, ban goc " +
      String(gocBytes.length) + " B, lech " + String(gocBytes.length - chuanHoa.length) + " B · so lat hien co: " + String(readWrapper().parts.length) +
"\n" + nguCanh.join("\n"),
  );
}

async function buildClientHalf(out: string): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-subagent (khuon da co trong repo).
  } as Parameters<typeof Bun.build>[0]);
  if (!built.success) throw new Error("gbh-client-ui-sidebar-right: build nua client that bai: " + logsOf(built));
  const bundle = built.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-sidebar-right: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ 18/10/2026: PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi
 *   buildIfStale(pkg, join(dir, "lib")) voi thu muc dich la BAN MOUNT trong profile; tools/lab/row.ts
 *   goi buildPackage(out) voi thu muc tam. Ban dau toi hard-code join(import.meta.dir, "lib") ⇒ mount
 *   build ra lib/ cua repo roi chi ghi duoc package.json vao profile ⇒ profile THIEU lib/ ⇒ tang nap
 *   khong sinh entry, ma moi phep kiem khac deu xanh. Khuon nay copy tu ui-goal.
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
  // task-174 (khung): CỔNG BYTE — ghép vỏ + lát rồi so với bundle gốc (chưa có lát ⇒ ĐỎ CÓ CHỦ ĐÍCH).
  // Bật bằng env GBH_GATE_CLIENT=1 để không chặn build khi khung còn rỗng; khi đủ lát thì bật mặc định.
  if (process.env.GBH_GATE_CLIENT === "1") {
    gateClientBytes(assembleClientBundle(), readFileSync(join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-sidebar-right", "lib", "client.js"), "utf8"));
  }
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}