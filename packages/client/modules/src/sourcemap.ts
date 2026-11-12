/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ghep than script combo va source map Indexed v3 tu byte cua tung bundle (chi doc map khi duoc hoi)
 */

import { readFileSync } from "node:fs";
import type { BundleResource } from "./combos.ts";

/** Vết source map do tsdown đóng ở cuối mọi bundle client. */
const SOURCE_MAP_TRAILER = /(?:\r?\n)?\/\/# sourceMappingURL=[^\r\n]*(?:\r?\n)?$/;
/** Chỉ thị tên nguồn gỡ lỗi mà bundle mang theo. */
const SOURCE_URL_TRAILER = /(?:\r?\n)?\/\/# sourceURL=([^\r\n]+)(?:\r?\n)?$/;

/** Source map v3 đã validate ở mức trường cần thiết. */
export interface SourceMapV3 {
  /** Luôn là 3. */
  version: number;
  /** Danh sách nguồn gốc. */
  sources: string[];
  /** Danh sách tên biểu tượng. */
  names: string[];
  /** Chuỗi mappings. */
  mappings: string;
  /** Gốc nguồn tuỳ chọn. */
  sourceRoot?: string;
  /** Nội dung nguồn tuỳ chọn. */
  sourcesContent?: unknown[];
}

/** Bundle đã bỏ chỉ thị cục bộ, kèm tên nguồn dự phòng cho section map. */
export interface PreparedSource {
  /** Byte nguồn đã bỏ `sourceURL`/`sourceMappingURL` và bảo đảm kết thúc bằng xuống dòng. */
  source: string;
  /** Tên nguồn dùng khi không có map gốc. */
  fallbackSource: string;
}

/**
 * Bỏ chỉ thị gỡ lỗi cục bộ của bundle và giữ lại tên file sinh ra ổn định.
 * Nhận: tài nguyên bundle.
 * Trả: nguồn đã chuẩn hoá và tên nguồn dự phòng.
 */
export function prepareSource(resource: BundleResource): PreparedSource {
  let source = resource.bundle.toString("utf8");
  const sourceUrl = SOURCE_URL_TRAILER.exec(source)?.[1];
  source = source.replace(SOURCE_URL_TRAILER, "").replace(SOURCE_MAP_TRAILER, "");
  if (!source.endsWith("\n")) source += "\n";
  const fallbackSource =
    sourceUrl === undefined
      ? "/plugins/" + resource.id + "/" + resource.fileName
      : /^(?:[A-Za-z][A-Za-z\d+.-]*:|\/)/.test(sourceUrl)
        ? sourceUrl
        : "/" + sourceUrl;
  return { source, fallbackSource };
}

/**
 * Ghép thân script của một combo: từng bundle theo thứ tự, mỗi bundle một dòng riêng, rồi đóng tham
 * chiếu source map của chính combo.
 * Nhận: tài nguyên theo thứ tự và query source map (không có thì bỏ phần đóng).
 * Trả: byte thân script.
 */
export function buildComboScript(resources: readonly BundleResource[], sourceMapUrl?: string): Buffer {
  let source = "";
  for (const resource of resources) source += prepareSource(resource).source + ";\n";
  return Buffer.from(sourceMapUrl === undefined ? source : source + "//# sourceMappingURL=" + sourceMapUrl + "\n");
}

/** Đếm số dòng sinh ra khi dựng offset cho section của map. */
function newlineCount(value: string): number {
  let count = 0;
  for (const char of value) if (char === "\n") count += 1;
  return count;
}

/** Map mỗi dòng sinh ra về đúng dòng đó trong một nguồn JS đã bundle (section danh tính). */
function identitySectionMap(source: string, sourceUrl: string): SourceMapV3 {
  const mappings = Array.from({ length: newlineCount(source) }, (_, index) => (index === 0 ? "AAAA" : "AACA")).join(";");
  return { version: 3, names: [], sources: [sourceUrl], sourcesContent: [source], mappings };
}

/**
 * Phân giải nguồn của một section theo URL map gốc của từng plugin TRƯỚC khi combo đổi vị trí.
 * Nhận: tài nguyên và map gốc của nó.
 * Trả: section map đã chuyển nguồn.
 */
function comboSectionMap(resource: BundleResource, original: SourceMapV3): SourceMapV3 {
  const sourceRoot = typeof original.sourceRoot === "string" ? original.sourceRoot : "";
  const base = new URL("/plugins/" + resource.id + "/client.js.map", "http://dsh.invalid");
  const relocated = original.sources.map((source) => {
    const separator = sourceRoot !== "" && !sourceRoot.endsWith("/") && !source.startsWith("/") ? "/" : "";
    const resolved = new URL(sourceRoot + separator + source, base);
    return resolved.origin === base.origin ? resolved.pathname + resolved.search + resolved.hash : resolved.href;
  });
  const section: SourceMapV3 = { ...original, sources: relocated };
  delete section.sourceRoot;
  return section;
}

/**
 * Đọc và validate một source map tuỳ chọn khi endpoint map của combo được yêu cầu.
 * Nhận: đường dẫn bundle client (map nằm cạnh với hậu tố `.map`).
 * Trả: map đã validate, hoặc undefined khi file không tồn tại.
 * @throws khi file có nhưng không phải một Source Map v3 hợp lệ.
 */
export function readSourceMapSync(clientPath: string): SourceMapV3 | undefined {
  let body: Buffer;
  try {
    body = readFileSync(clientPath + ".map");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return undefined;
    throw error;
  }
  const value: unknown = JSON.parse(body.toString("utf8"));
  const parsed = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
  const ok =
    parsed !== undefined &&
    parsed.version === 3 &&
    Array.isArray(parsed.sources) &&
    (parsed.sources as unknown[]).every((source) => typeof source === "string") &&
    Array.isArray(parsed.names) &&
    (parsed.names as unknown[]).every((name) => typeof name === "string") &&
    typeof parsed.mappings === "string";
  if (!ok) throw new Error("client-modules: " + clientPath + ".map is not a regular Source Map v3 object");
  return parsed as unknown as SourceMapV3;
}

/**
 * Dựng MỘT map Indexed v3 từ các map của từng bundle, chỉ đọc file map khi lời gọi này chạy.
 * Nhận: tài nguyên của combo và tên file đích (mặc định `client.js`).
 * Trả: byte thân source map (JSON một dòng, kết thúc bằng xuống dòng).
 */
export function buildComboSourceMap(resources: readonly BundleResource[], fileName = "client.js"): Buffer {
  const sections: { offset: { line: number; column: number }; map: SourceMapV3 }[] = [];
  let line = 0;
  for (const resource of resources) {
    const prepared = prepareSource(resource);
    let section = identitySectionMap(prepared.source, prepared.fallbackSource);
    try {
      const original = readSourceMapSync(resource.clientPath);
      if (original !== undefined) section = comboSectionMap(resource, original);
    } catch {
      // Map hỏng hoặc đang ghi dở ở môi trường dev: dùng section danh tính.
    }
    sections.push({ offset: { line, column: 0 }, map: section });
    line += newlineCount(prepared.source + ";\n");
  }
  return Buffer.from(JSON.stringify({ version: 3, file: fileName, sections }) + "\n");
}
