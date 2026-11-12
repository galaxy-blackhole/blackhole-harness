/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nửa của package: lib/index.js (node ESM) và lib/client.js (script classic, MỘT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME, PART_PREFIX, PARTS_DIR } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, in vào artifact để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/** Dòng đánh dấu module của TS trong từng lát — bỏ đi khi ghép vào thân bundle. */
const MODULE_MARKER = /^export \{\};\s*$/;

/** Dòng tắt kiểm kiểu của TS trong từng lát — chỉ có nghĩa với file nguồn, bỏ khi ghép. */
const NOCHECK_MARKER = /^\/\/ @ts-nocheck/;

/**
 * Bỏ khối header 5 dòng và các dòng chỉ có nghĩa với file nguồn khỏi một lát.
 * Nhận: nội dung file lát.
 * Trả: phần thân lát, đúng những dòng sẽ nằm trong bundle.
 */
export function partBody(text: string): string {
  const lines = text.split("\n");
  let start = 0;
  if (lines[0] === "/**") {
    while (start < lines.length && (lines[start] as string) !== " */") start++;
    start++;
  }
  return lines
    .slice(start)
    .filter((line) => !MODULE_MARKER.test(line) && !NOCHECK_MARKER.test(line))
    .join("\n");
}

/** Lát VIẾT TAY mở đầu: sáu dòng require của bảng module (nguyên văn danh sách của bundle gốc). */
export const HEAD_PART = "runtime-deps.ts";

/** Lát VIẾT TAY kết thúc, theo thứ tự: năm dòng `exports.*` của bản gốc, rồi mặt plugin có cổng. */
export const TAIL_PARTS: readonly string[] = ["stock-exports.ts", "plugin-surface.ts"];

/**
 * Đọc mọi lát nguồn của nửa client theo ĐÚNG thứ tự ghép: lát đầu viết tay · các lát cắt từ bundle
 * gốc theo tên (part-01 … part-NN) · hai lát cuối viết tay.
 * @returns mảng { tên file, thân lát } theo thứ tự ghép.
 */
export function readParts(): { name: string; body: string }[] {
  const dir = join(import.meta.dir, PARTS_DIR);
  const cut = readdirSync(dir)
    .filter((name) => name.startsWith(PART_PREFIX) && name.endsWith(".ts"))
    .sort();
  const order = [HEAD_PART, ...cut, ...TAIL_PARTS];
  for (const name of order) {
    if (!existsSync(join(dir, name))) throw new Error(PACKAGE_NAME + ": thiếu lát nguồn " + PARTS_DIR + "/" + name);
  }
  return order.map((name) => ({ name, body: partBody(readFileSync(join(dir, name), "utf8")) }));
}

/**
 * Ghép thân bundle: sáu dòng require, các lát nguồn, rồi mặt plugin có cổng chống cài hai lần.
 * Nhận: không.
 * Trả: văn bản thân bundle (chưa bọc IIFE).
 */
export function clientBody(): string {
  return readParts()
    .map((part) => part.body)
    .join("\n");
}

/**
 * Bọc thân bundle thành script classic đăng ký ĐÚNG MỘT id — id CỦA TA.
 * Nhận: body — thân bundle.
 * Trả: văn bản script classic hoàn chỉnh.
 */
export function wrapClientBundle(body: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    "    Object.defineProperty(exports, Symbol.toStringTag, { value: \"Module\" });",
    "    var PACKAGE_NAME = " + JSON.stringify(PACKAGE_NAME) + ";",
    body,
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
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: result — kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa host: bundle ESM từ src/index.ts ra lib/index.js.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
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
  if (!built.success) throw new Error(PACKAGE_NAME + ": build nua host that bai: " + logsOf(built));
  return join(out, "index.js");
}

/**
 * Kiểm cú pháp thân bundle client bằng chính Bun: ghi ra file tạm rồi bundle thử (không dùng kết quả).
 * Nửa client là VĂN BẢN ghép từ các lát của bundle gốc nên không qua Bun.build lần hai khi phát hành;
 * bước này để lỗi cú pháp lộ ra lúc build thay vì lúc app đã boot.
 * Nhận: out — thư mục đích; text — toàn văn script classic.
 * Trả: không có; ném lỗi khi Bun không parse nổi.
 */
async function verifyClientSyntax(out: string, text: string): Promise<void> {
  const probe = join(out, "_client-check.js");
  writeFileSync(probe, text);
  try {
    const built = await Bun.build({
      entrypoints: [probe],
      target: "browser",
      format: "esm",
      write: false,
      packages: "external",
      // `write` khong nam trong kieu cua Bun o ban nay ⇒ ep kieu nhu ui-subagent (khuon da co trong repo).
    } as Parameters<typeof Bun.build>[0]);
    if (!built.success) throw new Error(PACKAGE_NAME + ": nua client khong parse duoc: " + logsOf(built));
  } finally {
    rmSync(probe, { force: true });
  }
}

/**
 * Build nửa client: ghép các lát nguồn rồi bọc thành script classic đăng ký một id.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact đã ghi.
 */
async function buildClientHalf(out: string): Promise<string> {
  const text = wrapClientBundle(clientBody());
  await verifyClientSyntax(out, text);
  const target = join(out, "client.js");
  writeFileSync(target, text);
  return target;
}

/**
 * Build trọn gói: ghi cả hai nửa vào outDir (hoặc lib/ của chính gói nếu không truyền).
 *
 * ⚠️ PHAI nhan outDir qua tham so dong lenh — apps/cli/src/mount.ts goi buildIfStale(pkg, join(dir,"lib"))
 * voi thu muc dich la BAN MOUNT trong profile; hard-code join(import.meta.dir,"lib") ⇒ profile THIEU lib/.
 * Khuon nay copy tu ui-goal/ui-subagent (buildPackage(outDir?) + process.argv[2]).
 * Nhận: outDir — thư mục đích (tùy chọn).
 * Trả: { host, client } — đường dẫn hai artifact đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(client);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}

// 19/10/2026 (task-158 nhánh A — Lead duyệt, neo CHÍNH XÁC): đổi tagId CSS + dataset.plugin `@deepseek-ai/<gói>`
// → id CỦA TA. Neo bằng DẤU NHÁY + ĐUÔI xác định (không thay tiền tố trần: id ta là tiền tố con của id khác).
// Env `GBH_CLASS_RENAME=off` ⇒ bỏ qua. Cổng REVERSE: đổi ngược ĐÚNG các mẫu neo rồi so BYTE.
const DOM_ID_RENAMES: readonly { from: string; to: string }[] = [
  { from: '"@deepseek-ai/dsh-client-ui-chat/', to: '"@galaxy-blackhole/gbh-client-ui-chat/' },
  { from: 'dataset.plugin = "@deepseek-ai/dsh-client-ui-chat"', to: 'dataset.plugin = "@galaxy-blackhole/gbh-client-ui-chat"' },
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
  console.log("dom id rename: " + String(renameDomIds(join(outDir, "client.js"))) + " diem");
}
