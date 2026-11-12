/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-session-log-export: nửa HOST = ESM (lib/index.js), nửa CLIENT = CJS
 *      bọc classic script đăng ký ĐÚNG MỘT id của ta (khuôn đã chứng minh ở ui-…/api-…).
 *      Gộp nhiều entry trong một lượt Bun.build làm Bun sinh prelude chia sẻ ⇒ lệch byte ⇒ build TÁCH RỜI.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";

/** Id module DUY NHẤT mà nửa client tự đăng ký (khớp manifest + rev HMR). */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-session-log-export";

/** Header 5 dòng của artifact sinh tự động. */
const GENERATED_HEADER = [
	"/*",
	" * author Bùi Trọng Hiếu",
	" * email kevinbui210191@gmail.com",
	" * create date 15/10/2026",
	" * modify date 19/10/2026",
	" * desc ARTIFACT SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-session-log-export — khong sua tay",
	" */",
].join("\n");

/**
 * Thụt lề toàn bộ mã CJS vào trong factory.
 * Nhận: code — mã CJS; levels — số cấp tab.
 * Trả: mã đã thụt lề.
 */
function indent(code: string, levels: number): string {
	const prefix = "\t".repeat(levels);
	return code.split("\n").map((line) => (line.length === 0 ? line : prefix + line)).join("\n");
}

/**
 * Gom log build hỏng thành MỘT dòng.
 * Nhận: result — kết quả Bun.build.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
	return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Bọc bundle CJS thành factory classic-script đăng ký ĐÚNG MỘT id của ta.
 * Nhận: code — mã CJS (dùng module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
 */
function wrapClientBundle(code: string): string {
	return [
		GENERATED_HEADER,
		"(function () {",
		"\t\"use strict\";",
		"\tvar factory = function (require) {",
		"\t\tvar module = { exports: {} };",
		"\t\tvar exports = module.exports;",
		indent(code, 3),
		"\t\tmodule.exports = module.exports.createPlugin(require);",
		"\t\treturn module.exports;",
		"\t};",
		"\t// id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
		"\twindow.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
		"\t// KHONG dang ky id cua goi GOC: no thuoc gbh.row.aliases va tang nap TU sinh entry alias.",
		"})();",
		"",
	].join("\n");
}

/**
 * Bất biến artifact client: ĐÚNG MỘT lời đăng ký id (của ta) và KHÔNG còn id gói gốc.
 * Nhận: artifact — văn bản script classic đã bọc.
 * Trả: không.
 * @throws {Error} khi artifact vi phạm bất biến (2 lời đăng ký, hoặc còn id stock).
 */
function assertClassicScriptArtifact(artifact: string): void {
  const lines = artifact.split(String.fromCharCode(10));
  for (const line of lines) {
    if (/^(export|import)\s/.test(line)) throw new Error(PACKAGE_NAME + ": artifact client co cu phap ESM o cap top-level: " + line.slice(0, 60));
  }
}

/**
 * Bất biến artifact client: ĐÚNG MỘT lời đăng ký id (của ta) và KHÔNG còn id gói gốc.
 * Nhận: artifact — văn bản script classic đã bọc.
 * Trả: không.
 * @throws {Error} khi artifact vi phạm bất biến (2 lời đăng ký, hoặc còn id stock).
 */
function assertSingleIdArtifact(artifact: string): void {
	const loads = artifact.split("window.__ModuleLoader__.load(").length - 1;
	if (loads !== 1) throw new Error(PACKAGE_NAME + ": artifact co " + loads + " loi __ModuleLoader__.load (LUAT: dung 1)");
	if (artifact.includes("@deepseek-ai/dsh-session-log-export")) throw new Error(PACKAGE_NAME + ": artifact con id goi GOC (LUAT MOT-ID)");
}

/**
 * Build nửa HOST thành ESM trong lib/index.js.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact.
 * @throws {Error} khi Bun.build thất bại.
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
	if (!result.success) throw new Error(PACKAGE_NAME + ": build nua host that bai: " + logsOf(result));
	return join(out, "index.js");
}

/**
 * Build nửa CLIENT: bundle CJS từ src/client.ts rồi bọc thành script classic MỘT id.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artifact client.js.
 * @throws {Error} khi Bun.build thất bại hoặc artifact vi phạm bất biến MỘT-ID.
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
	} as Parameters<typeof Bun.build>[0]);
	if (!built.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(built));
	const bundle = built.outputs[0];
	if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
	const artifact = wrapClientBundle(await bundle.text());
	assertSingleIdArtifact(artifact);
	const target = join(out, "client.js");
	await writeFile(target, artifact);
	return target;
}

/**
 * Build cả 2 nửa (host ESM + client classic wrapper) vào thư mục đích.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package).
 * Trả: mảng đường dẫn artifact đã ghi.
 * @throws {Error} khi build hỏng hoặc artifact client vi phạm bất biến MỘT-ID.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const halves = await buildHalves(outDir);
  return halves.index;
}

/**
 * Build cả 2 nửa và trả ĐƯỜNG DẪN từng nửa (host + client).
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package).
 * Trả: object gồm index (host) và client (client).
 * @throws {Error} khi build hỏng hoặc artifact client vi phạm bất biến MỘT-ID.
 */
export async function buildHalves(outDir?: string): Promise<{ index: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const index = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  return { index, client };
}

if (import.meta.main) {
  const halves = await buildHalves(process.argv[2]);
  console.log("built 2 tep: " + halves.index.split("/").slice(-1)[0] + ", " + halves.client.split("/").slice(-1)[0]);
}
