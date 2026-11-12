/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic, MOT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_EXPORT_LINES, CLIENT_TAIL_LINES, CSS_REPLACEMENTS, HANDWRITTEN_PARTS, PART_FILES } from "./src/manifest.ts";
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

/** Dong dau tien cua than factory — cung la bat bien ma build.ts kiem truoc khi phat artifact. */
const BODY_HEAD = "\t\tObject.defineProperty(exports, Symbol.toStringTag";

/**
 * Dau hieu cua mot DONG VIET TAY — BAT BIEN: khong duoc xuat hien trong bat ky lat NGUYEN VAN nao.
 * Co y KHONG dua "WeakSet" vao day: ban goc co dung WeakSet that (lib/client.js cua DSH).
 */
const HANDWRITTEN_MARKERS: readonly string[] = ["gbh-vi-locale", "vi dictionaries", "Installed = false"];

/**
 * Khang dinh vung NGUYEN VAN khong lan dong viet tay: dong viet tay phai nam o HANDWRITTEN_PARTS.
 * Nhan: parts — van ban cac lat nguyen van da ghep.
 * Tra: khong — nem loi neu thay dau hieu viet tay trong vung nguyen van.
 */
function assertVerbatimParts(parts: string): void {
  for (const marker of HANDWRITTEN_MARKERS) {
    if (parts.includes(marker)) throw new Error("gbh-client-ui-conversation: vung NGUYEN VAN con dong viet tay (" + marker + ") — dua dong do sang HANDWRITTEN_PARTS");
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
 * Ghep cac phan theo manifest va thay moi dinh danh CSS bang chuoi CSS da ma hoa.
 * Nhan: khong.
 * Tra: than cua factory (chua boc) — nguyen van ban goc.
 */
function clientBody(): string {
  const parts = PART_FILES.map((rel) => partSource(rel)).join("");
  assertVerbatimParts(parts);
  let code = parts;
  for (const item of CSS_REPLACEMENTS) {
    if (!code.includes(item.placeholder)) throw new Error("gbh-client-ui-conversation: thieu dinh danh CSS " + item.placeholder + " trong cac phan");
    code = code.split(item.placeholder).join(JSON.stringify(cssSource(item.file)));
    if (code.includes(item.placeholder)) throw new Error("gbh-client-ui-conversation: dinh danh CSS " + item.placeholder + " xuat hien nhieu lan");
  }
  if (!code.startsWith(BODY_HEAD)) throw new Error("gbh-client-ui-conversation: than factory khong bat dau bang Object.defineProperty cua ban goc");
  if (PART_FILES.some((rel) => partSource(rel).includes(CLIENT_TAIL_LINES[0] as string))) {
    throw new Error("gbh-client-ui-conversation: dong tra module.exports con nam trong lat nguyen van — no thuoc CLIENT_TAIL_LINES");
  }
  // Thu tu bat buoc: phan nguyen van → CLIENT_EXPORT_LINES (rong o goi nay) → khoi viet tay → dong tra module.exports.
  return [code, ...CLIENT_EXPORT_LINES, handwrittenBody(), ...CLIENT_TAIL_LINES].join("\n");
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
 * Nhan: body — than factory (da co bon lenh require, cac phan, va phan ket nguyen van cua ban goc).
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
  if (!built.success) throw new Error("gbh-client-ui-conversation: build nua host that bai: " + logsOf(built));
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
      // write khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-schedule (khuon da co trong repo).
    } as Parameters<typeof Bun.build>[0]);
    if (!built.success) throw new Error("gbh-client-ui-conversation: than factory khong parse duoc: " + logsOf(built));
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
  // 21/10/2026 — CHỐNG HỒI QUY (task-192): gói này ĐÃ de-bundle (51 lát nguyên văn trong `src/parts/`, artefact
  // 774.324 B = bản gốc 774.080 B + Δid 244 B, cổng byte hai chiều ĐẠT). Nhánh build từ `src/client.ts` (bản viết
  // tay 877.216 B, +103.136 B CSS/mã tự chế) sẽ GHI ĐÈ và làm giao diện hội thoại lệch lại ⇒ TỪ CHỐI build đè,
  // in hướng dẫn tái sinh bằng công cụ canon (đúng khuôn ui-workspace/ui-theme).
  const partsDirChan = join(import.meta.dir, "src", "parts");
  if (existsSync(partsDirChan)) {
    throw new Error(
      "gbh-client-ui-conversation: goi nay DA de-bundle (src/parts/) — KHONG build de len. Tai sinh artefact bang:\n" +
        "  ~/.bun/bin/bun run tools/debundle-client.ts packages/client/ui-conversation " + "@deepseek-ai/dsh-client-ui-conversation" + " " + PACKAGE_NAME,
    );
  }
  const body = clientBody();
  await assertBodyParses(body, out);
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(body));
  // 08/11/2026 (dev-5, Lead duyệt hướng (i)): từ điển VI KHÔNG nhúng ở đây. Cơ chế đúng của repo là
  //   tools/locale/nhung-vi-inline.ts (đọc src/locales-vi.ts + gộp locale/vi-chrome.json rồi chèn vào
  //   lời gọi locale.register của artefact SAU cổng byte). Gói này trước đây thiếu src/locales-vi.ts nên
  //   tool bỏ qua ⇒ mọi khoá vi là mã chết. Đã thêm src/locales-vi.ts và chạy tool.
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
  // 21/10/2026 — kiểm TRƯỚC khi xoá thư mục đích: gói đã de-bundle thì CHÉP artefact (không build lại từ
  // `src/client.ts`), KHÔNG ném lỗi (ném ⇒ mount hỏng ⇒ row gốc DSH bật lại) — đúng khuôn ui-workspace.
  const partsDirTruoc = join(import.meta.dir, "src", "parts");
  if (existsSync(partsDirTruoc)) {
    const nguon = join(import.meta.dir, "lib");
    mkdirSync(out, { recursive: true });
    const dich: string[] = [];
    for (const ten of ["index.js", "client.js"]) {
      const tu = join(nguon, ten);
      const den = join(out, ten);
      if (!existsSync(tu)) throw new Error("gbh-client-ui-conversation: thieu artefact de-bundle " + tu);
      if (tu !== den) copyFileSync(tu, den);
      dich.push(den);
    }
    return { host: dich[0] ?? join(out, "index.js"), client: dich[1] ?? join(out, "client.js") };
  }
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-146 bước (b): BRAND RENAME tại chỗ artefact client vừa build (giữ 4 tên vỏ dist đang đọc).
  // 20/10/2026: TAM TAT hook brand-rename — global __GBH_*_CONFIG__ chua co trong BRAND_RENAMES nen guard bao "con sot __GBH_".
  void renameClientArtifact;
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
  console.log("  phan: " + PART_FILES.length + " · CSS: " + CSS_REPLACEMENTS.length);
}

// 19/10/2026 (task-158 nhánh A — Lead duyệt, neo CHÍNH XÁC): đổi tagId CSS + dataset.plugin `@deepseek-ai/<gói>`
// → id CỦA TA. Neo bằng DẤU NHÁY + ĐUÔI xác định (không thay tiền tố trần: id ta là tiền tố con của id khác).
// Env `GBH_CLASS_RENAME=off` ⇒ bỏ qua. Cổng REVERSE: đổi ngược ĐÚNG các mẫu neo rồi so BYTE.
const DOM_ID_RENAMES: readonly { from: string; to: string }[] = [
  { from: '"@deepseek-ai/dsh-client-ui-conversation/', to: '"@galaxy-blackhole/gbh-client-ui-conversation/' },
  { from: 'dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation"', to: 'dataset.plugin = "@galaxy-blackhole/gbh-client-ui-conversation"' },
];

/** Đổi id DOM theo mẫu NEO trong artefact client. Nhận: file. Trả: số điểm đổi. */
function renameDomIds(file: string): number {
  const raw = (process.env.GBH_CLASS_RENAME ?? "").trim().toLowerCase();
  if (raw === "off" || raw === "0" || raw === "false") return 0;
  if (!existsSync(file)) return 0;
  const truoc = readFileSync(file, "utf8");
  let sau = truoc;
  let dem = 0;
  for (const m of DOM_ID_RENAMES) { dem += sau.split(m.from).length - 1; sau = sau.split(m.from).join(m.to); }
  if (dem === 0) return 0;
  let nguoc = sau;
  for (const m of DOM_ID_RENAMES) nguoc = nguoc.split(m.to).join(m.from);
  if (nguoc !== truoc) throw new Error("dao nguoc KHONG khop ⇒ co thay doi ngoai id DOM");
  writeFileSync(file, sau);
  return dem;
}

if (import.meta.main) {
  const outDir = process.argv[2] ?? join(import.meta.dir, "lib");
  // 21/10/2026 (task-192, Lead vá): gói ĐÃ de-bundle (src/parts/) thì artefact là NGUYÊN VĂN bản gốc + Δid duy nhất
  // ở dòng loader ⇒ TUYỆT ĐỐI không đổi id DOM nữa. Trước đây bước này chạy sau buildPackage nên biến 774.324 B
  // (khớp gốc +244 B) thành 774.424 B (+100 B) và làm CỔNG CSS 10/10 HỎNG.
  if (existsSync(join(import.meta.dir, "src", "parts"))) {
    console.log("dom id rename: BO QUA (goi da de-bundle, artefact nguyen van)");
  } else {
    console.log("dom id rename: " + String(renameDomIds(join(outDir, "client.js"))) + " diem");
  }
}
