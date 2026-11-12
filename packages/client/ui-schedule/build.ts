/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_EXPORT_LINES, CLIENT_TAIL_LINES, CSS_REPLACEMENTS, HANDWRITTEN_PARTS, ID_REWRITES, PART_FILES } from "./src/manifest.ts";
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

/** So dong phan dau cua moi file phan: 7 dong header + 1 dong // @ts-nocheck. */
const PART_HEADER_LINES = 8;

/** So dong phan dau cua moi file .module.css: dung 7 dong header (CSS bat dau ngay dong ke tiep). */
const CSS_HEADER_LINES = 7;

/** Thu muc nguon cua goi. */
const SRC = join(import.meta.dir, "src");

/**
 * Dau hieu cua mot DONG VIET TAY — BAT BIEN: khong duoc xuat hien trong bat ky lat NGUYEN VAN nao.
 * Co y KHONG dua "WeakSet" vao day: ban goc conversation co dung WeakSet that.
 */
const HANDWRITTEN_MARKERS: readonly string[] = ["gbh-vi-locale", "vi dictionaries", "Installed = false"];

/**
 * Khang dinh vung NGUYEN VAN khong lan dong viet tay: dong viet tay phai nam o HANDWRITTEN_PARTS.
 * Nhan: parts — van ban cac lat nguyen van da ghep.
 * Tra: khong — nem loi neu thay dau hieu viet tay trong vung nguyen van.
 */
function assertVerbatimParts(parts: string): void {
  for (const marker of HANDWRITTEN_MARKERS) {
    if (parts.includes(marker)) throw new Error("gbh-client-ui-schedule: vung NGUYEN VAN con dong viet tay (" + marker + ") — dua dong do sang HANDWRITTEN_PARTS");
  }
}

/**
 * Than cac lat VIET TAY theo dung thu tu manifest (bo 8 dong giao ke) — dung van ban build.ts chen vao
 * bundle. Test parity doi chung chuoi nay de bo dung khoi viet tay theo VI TRI MANIFEST.
 * Nhan: khong.
 * Tra: van ban khoi viet tay (rong neu khong co lat viet tay nao).
 */
export function handwrittenBody(): string {
  return HANDWRITTEN_PARTS.map((rel) => partSource(rel)).join("\n");
}

/**
 * Doc mot phan ma nguon va bo phan dau (header + pragma).
 * Nhan: rel — duong dan tuong doi so voi src/.
 * Tra: ma nguon cua phan do, nguyen van.
 */
function partSource(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8").split("\n").slice(PART_HEADER_LINES).join("\n");
}

/**
 * Doc mot file .module.css va bo phan dau (header + dong trong).
 * Nhan: rel — duong dan tuong doi so voi src/.
 * Tra: van ban CSS nguyen van (khong kem header).
 */
function cssSource(rel: string): string {
  const lines = readFileSync(join(SRC, rel), "utf8").split("\n").slice(CSS_HEADER_LINES);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/**
 * Doi MOI chuoi id cua goi goc trong than factory sang id CUA TA (LUAT MOT-ID).
 * Chay TRUOC buoc thay CSS de van ban CSS khong bao gio bi dung toi; duoi "/task" va
 * "/<Ten>.module.css" tu dong giu nguyen vi chi phan dau chuoi bi doi.
 * Nhan: code — than factory ghep tu cac phan NGUYEN VAN.
 * Tra: than factory da doi id; nem loi neu so diem xuat hien lech manifest (chong lech am tham).
 */
function rewriteIds(code: string): string {
  let out = code;
  for (const item of ID_REWRITES) {
    const sites = out.split(item.from).length - 1;
    if (sites !== item.sites) {
      throw new Error(
        "gbh-client-ui-schedule: thay " + sites + " diem id " + item.from + ", manifest khai " + item.sites +
          " — cap nhat ID_REWRITES trong src/manifest.ts",
      );
    }
    out = out.split(item.from).join(item.to);
  }
  return out;
}

/**
 * Bat bien cua artifact: DUNG MOT loi dang ky id (id cua ta) va KHONG con chuoi id goi goc nao.
 * Nhan: artifact — van ban script classic da boc (header + wrapper + than factory).
 * Tra: khong — nem loi neu vi pham LUAT MOT-ID.
 */
function assertSingleIdArtifact(artifact: string): void {
  const loads = artifact.split("window.__ModuleLoader__.load(").length - 1;
  if (loads !== 1) throw new Error("gbh-client-ui-schedule: artifact co " + loads + " loi __ModuleLoader__.load (LUAT: dung 1)");
  for (const item of ID_REWRITES) {
    if (artifact.includes(item.from)) {
      throw new Error("gbh-client-ui-schedule: artifact con chuoi id goi goc " + item.from + " (LUAT MOT-ID) — kiem ID_REWRITES");
    }
  }
}

/**
 * Ghep cac phan theo manifest, doi id goi goc sang id CUA TA, roi thay moi dinh danh CSS bang chuoi CSS da ma hoa.
 * Nhan: khong.
 * Tra: than cua factory (chua boc) — nguyen van ban goc, chi khac id package.
 */
function clientBody(): string {
  const parts = PART_FILES.map((rel) => partSource(rel)).join("");
  assertVerbatimParts(parts);
  let code = rewriteIds(parts);
  for (const item of CSS_REPLACEMENTS) {
    if (!code.includes(item.placeholder)) throw new Error("gbh-client-ui-schedule: thieu dinh danh CSS " + item.placeholder + " trong cac phan");
    code = code.split(item.placeholder).join(JSON.stringify(cssSource(item.file)));
    if (code.includes(item.placeholder)) throw new Error("gbh-client-ui-schedule: dinh danh CSS " + item.placeholder + " xuat hien nhieu lan");
  }
  if (!code.startsWith("\t\tObject.defineProperty(exports, Symbol.toStringTag")) throw new Error("gbh-client-ui-schedule: than factory khong bat dau bang Object.defineProperty + bon lenh require");
  // Thu tu bat buoc: phan nguyen van → hai dong exports nguyen van → khoi viet tay → dong tra module.exports.
  return [code, CLIENT_EXPORT_LINES.join("\n"), handwrittenBody(), CLIENT_TAIL_LINES.join("\n")].join("\n");
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
 * Boc than factory thanh script classic dang ky DUNG MOT id — id CUA TA.
 * Nhan: body — than factory (da co bon lenh require, cac phan, va phan ket).
 * Tra: van ban script classic hoan chinh.
 */
function wrapClientBundle(body: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(body, 4),
    "  };",
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
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
  if (!built.success) throw new Error("gbh-client-ui-schedule: build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Kiem than factory bang chinh bo phan tich cua Bun truoc khi phat artifact.
 * Nhan: body — than factory da ghep; out — thu muc dich (chua file tam, xoa ngay sau khi kiem).
 * Tra: khong — nem loi neu than factory khong parse duoc.
 */
async function assertBodyParses(body: string, out: string): Promise<void> {
  const entry = join(out, ".client-entry.js");
  writeFileSync(entry, body);
  try {
    const built = await Bun.build({
      entrypoints: [entry],
      target: "browser",
      format: "cjs",
      write: false,
      packages: "external",
      // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-subagent (khuon da co trong repo).
    } as Parameters<typeof Bun.build>[0]);
    if (!built.success) throw new Error("gbh-client-ui-schedule: than factory khong parse duoc: " + logsOf(built));
  } finally {
    rmSync(entry, { force: true });
  }
}

/**
 * Build nua client: ghep cac phan, kiem cu phap, roi boc thanh script classic mot id.
 * Nhan: out — thu muc dich.
 * Tra: duong dan artifact da ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const body = clientBody();
  await assertBodyParses(body, out);
  const target = join(out, "client.js");
  const artifact = wrapClientBundle(body);
  assertSingleIdArtifact(artifact);
  writeFileSync(target, artifact);
  return target;
}

/**
 * Build tron goi: ghi ca hai nua vao outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi buildIfStale(pkg, join(dir, "lib"))
 * voi thu muc dich la BAN MOUNT trong profile; hard-code lib/ cua repo se lam profile THIEU lib/.
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
  console.log("  phan: " + PART_FILES.length + " · CSS: " + CSS_REPLACEMENTS.length);
}

// 20/10/2026 (task-158 pilot THƯ VIỆN — Lead chốt PROFILE PACKAGE): `lib/util-values` KHÔNG phải seed mà là package
// thật trong profile ⇒ đổi require sang id CỦA TA (đã copy package cùng khuôn). Env `GBH_LIB_RENAME=off` = rollback.
// Cổng REVERSE: đổi ngược rồi so BYTE (neo `require("...")` hai đầu) ⇒ chứng minh chỉ đổi specifier.
const LIB_REQUIRE_RENAME = { from: 'require("@deepseek-ai/dsh-util-values")' , to: 'require("@galaxy-blackhole/gbh-util-values")' };

/** Đổi DUY NHẤT require của thư viện đã chỉ định. Nhận: file. Trả: số điểm đổi. */
function renameLibRequire(file: string): number {
  const raw = (process.env.GBH_LIB_RENAME ?? "").trim().toLowerCase();
  if (raw === "off" || raw === "0" || raw === "false") return 0;
  if (!existsSync(file)) return 0;
  const truoc = readFileSync(file, "utf8");
  const dem = truoc.split(LIB_REQUIRE_RENAME.from).length - 1;
  if (dem === 0) return 0;
  const sau = truoc.split(LIB_REQUIRE_RENAME.from).join(LIB_REQUIRE_RENAME.to);
  if (sau.split(LIB_REQUIRE_RENAME.to).join(LIB_REQUIRE_RENAME.from) !== truoc) throw new Error("dao nguoc KHONG khop ⇒ co thay doi ngoai specifier thu vien");
  writeFileSync(file, sau);
  return dem;
}

if (import.meta.main) {
  const outDir = process.argv[2] ?? join(import.meta.dir, "lib");
  console.log("lib require rename: " + String(renameLibRequire(join(outDir, "client.js"))) + " diem");
}
