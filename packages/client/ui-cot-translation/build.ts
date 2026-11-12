/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build HAI NỬA tách rời: lib/index.js (node ESM) và lib/client.js (CJS bọc script classic MỘT id)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";
import { PACKAGE_NAME } from "./src/client/ids.ts";

/** Id của gói GỐC — luật MỘT-ID: artefact của ta phải có 0 lần chuỗi này (kể cả CSS tagId/dataset.plugin). */
const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-experimental-client-ui-cot-translation";

/** Bảy dòng header bắt buộc của repo, chèn vào artefact sinh ra. */
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
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: code — mã nguồn; levels — số mức thụt (mỗi mức một tab).
 * Trả: mã nguồn đã thụt lề.
 */
function indent(code: string, levels: number): string {
	const pad = "\t".repeat(levels);
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
 * Bọc bundle CJS thành factory của `__ModuleLoader__` với ĐÚNG MỘT id — id CỦA TA.
 * Nhận: code — mã CJS đã bundle (dùng module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
 */
function wrapClientBundle(code: string): string {
	return [
		GENERATED_HEADER,
		"(function () {",
		'\t"use strict";',
		"\tvar factory = function (require) {",
		"\t\tvar module = { exports: {} };",
		"\t\tvar exports = module.exports;",
		indent(code, 3),
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
 * Bất biến của artefact client: ĐÚNG MỘT lời đăng ký id (id của ta) và KHÔNG còn chuỗi id gói gốc.
 * Nhận: artifact — văn bản script classic đã bọc (header + wrapper + thân factory).
 * Trả: không — ném lỗi khi vi phạm luật MỘT-ID.
 */
function assertSingleIdArtifact(artifact: string): void {
	const loads = artifact.split("window.__ModuleLoader__.load(").length - 1;
	if (loads !== 1) throw new Error(PACKAGE_NAME + ": artifact co " + loads + " loi __ModuleLoader__.load (LUAT: dung 1)");
	if (artifact.includes(STOCK_PACKAGE_NAME)) {
		throw new Error(PACKAGE_NAME + ": artifact con chuoi id goi goc " + STOCK_PACKAGE_NAME + " (LUAT MOT-ID)");
	}
}

/**
 * Build nửa HOST: bundle ESM từ src/index.ts ra lib/index.js.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artefact đã ghi.
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
 * Build nửa CLIENT: bundle CJS từ src/client.ts rồi bọc thành script classic một id.
 * Nhận: out — thư mục đích.
 * Trả: đường dẫn artefact đã ghi.
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
		// write không nằm trong kiểu của Bun ở bản này ⇒ ép kiểu như ui-brand/ui-goal (khuôn đã có trong repo).
	} as Parameters<typeof Bun.build>[0]);
	if (!built.success) throw new Error(PACKAGE_NAME + ": build nua client that bai: " + logsOf(built));
	const bundle = built.outputs[0];
	if (bundle === undefined) throw new Error(PACKAGE_NAME + ": build nua client khong sinh output nao");
	const artifact = wrapClientBundle(await bundle.text());
	assertSingleIdArtifact(artifact);
	const target = join(out, "client.js");
	writeFileSync(target, artifact);
	return target;
}

/**
 * Build trọn gói: ghi cả hai nửa vào outDir (hoặc lib/ của chính gói khi không truyền).
 *
 * ⚠️ PHẢI nhận outDir qua tham số dòng lệnh — apps/cli/src/mount.ts gọi build.ts với thư mục đích là
 *   BẢN MOUNT trong profile; hard-code lib/ của repo sẽ làm profile THIẾU lib/.
 * Nhận: outDir — thư mục đích (tuỳ chọn).
 * Trả: { host, client } — đường dẫn hai artefact đã ghi.
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

