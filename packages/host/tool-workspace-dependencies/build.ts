/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-tool-workspace-dependencies: Bun.build ESM node từ src/index.ts ra lib/index.js,
 *      cổng bề mặt export 11 tên + in sha256 artefact; chạy TRONG thư mục gói để nhãn comment khớp.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { cpSync } from "node:fs";

/** Gốc repo (packages/host/<gói> ⇒ ../../.. ⇒ repo root). */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Bề mặt xuất khẩu ĐÚNG như bundle gốc (11 tên). */
const EXPECTED_EXPORTS = [
  "Config",
  "apply",
  "copyPrimaryRuntime",
  "inject",
  "installPrimaryRuntime",
  "name",
  "parsePrimaryRuntime",
  "primaryRuntimePythonAliases",
  "readPrimaryRuntime",
  "resolvePrimaryRuntime",
  "workspaceDependencyPaths",
];

/**
 * Gom tên xuất khẩu từ khai báo `export { ... }` của một artefact ESM.
 * Nhận: text — nội dung tệp JS đã build.
 * Trả: mảng tên đã sắp xếp, xử lý cả dạng `x as name`.
 */
function exportedNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/gu)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Build gói thành một artefact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package).
 * Trả: Promise đường dẫn artefact lib/index.js sau khi đã qua cổng bề mặt export.
 * @throws {Error} khi Bun.build thất bại hoặc artefact không xuất đúng 11 tên của bản gốc.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-tool-workspace-dependencies: build that bai: " + result.logs.map(String).join(" | "));
  const file = join(out, "index.js");
  const bytes = await readFile(file);
  const text = bytes.toString("utf8");
  const names = exportedNames(text);
  if (JSON.stringify(names) !== JSON.stringify([...EXPECTED_EXPORTS].sort())) {
    throw new Error("gbh-tool-workspace-dependencies: be mat export sai: " + names.join(", "));
  }
  console.log("built " + file + " · " + String(names.length) + " export · " + String(bytes.length) + " B · sha256 " + createHash("sha256").update(bytes).digest("hex"));
  // 19/10/2026 (Lead duyệt (a)): parity TYPE với stock — chép NGUYÊN VĂN lib/types để exports["."].types trỏ được.
  cpSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-workspace-dependencies", "lib", "types"), join(out, "types"), { recursive: true });
  return file;
}

if (import.meta.main) console.log("artifact " + (await buildPackage(process.argv[2])));
