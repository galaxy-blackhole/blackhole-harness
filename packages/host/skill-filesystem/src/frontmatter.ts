/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Bộ đọc frontmatter YAML của skill-filesystem — port NGUYÊN VĂN bundle gốc
 *      @galaxy-blackhole/gbh-skill-filesystem: parseFrontmatter, findClosingFrontmatter, stringField,
 *      optionalString, parseInvocationPolicy, rejectLegacyInvocationKey, frontmatterBoolean,
 *      optionalMetadata. Giữ nguyên thứ tự kiểm và mọi chuỗi tiếng Anh.
 */

import { parse } from "yaml";
import type { SkillInvocationPolicy } from "@galaxy-blackhole/gbh-skill";

/**
 * Frontmatter đã tách khỏi thân Markdown.
 * Nhận: không (chỉ là kiểu).
 * Trả: hình dạng `{ data, body }` do `parseFrontmatter` sinh ra.
 */
export interface ParsedFrontmatter {
  /** Object YAML đã parse (không phải mảng, không phải null). */
  data: Record<string, unknown>;
  /** Phần thân còn lại sau dòng đóng `---`. */
  body: string;
}

/**
 * Tách frontmatter YAML ở đầu tệp Markdown — giữ nguyên thứ tự kiểm của bản gốc:
 * phải có dòng đầu đúng `---`, phải có dòng đóng, YAML phải là object.
 * Nhận: raw — toàn bộ nội dung tệp.
 * Trả: {@link ParsedFrontmatter} khi hợp lệ, ngược lại undefined.
 * @throws {Error} lỗi cú pháp YAML do `yaml.parse` ném ra (provider bắt và cảnh báo).
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter | undefined {
  const firstLineEnd = raw.indexOf("\n");
  if (firstLineEnd < 0) return undefined;
  if (raw.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return undefined;
  const start = firstLineEnd + 1;
  const closing = findClosingFrontmatter(raw, start);
  if (closing === undefined) return undefined;
  const parsed: unknown = parse(raw.slice(start, closing.start));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  return {
    data: parsed as Record<string, unknown>,
    body: raw.slice(closing.bodyStart),
  };
}

/**
 * Tìm dòng đóng frontmatter `---` kể từ vị trí start.
 * Nhận: raw — toàn bộ nội dung; start — vị trí bắt đầu tìm (sau dòng mở).
 * Trả: vị trí dòng đóng và vị trí thân, hoặc undefined khi hết tệp mà không thấy.
 */
function findClosingFrontmatter(raw: string, start: number): { start: number; bodyStart: number } | undefined {
  let lineStart = start;
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf("\n", lineStart);
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") {
      return {
        start: lineStart,
        bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1,
      };
    }
    if (nextNewline < 0) return undefined;
    lineStart = nextNewline + 1;
  }
}

/**
 * Đọc một trường chuỗi khác rỗng từ frontmatter.
 * Nhận: data — object frontmatter; key — tên trường.
 * Trả: chuỗi khi là string dài hơn 0, ngược lại undefined.
 */
export function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Đọc một trường chuỗi tuỳ chọn và đóng gói thành object rỗng-hoặc-có-field để spread.
 * Nhận: data — object frontmatter; key — tên trường.
 * Trả: `{ [key]: value }` khi là string khác rỗng, ngược lại `{}`.
 */
export function optionalString<K extends string>(data: Record<string, unknown>, key: K): { [P in K]?: string } {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? ({ [key]: value } as { [P in K]: string }) : {};
}

/**
 * Đọc trường `metadata` nếu là object không phải mảng, đóng gói để spread.
 * Nhận: data — object frontmatter.
 * Trả: `{ metadata }` khi hợp lệ, ngược lại `{}`.
 */
export function optionalMetadata(
  data: Record<string, unknown>,
): { metadata: Readonly<Record<string, unknown>> } | Record<string, never> {
  const value = data.metadata;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return { metadata: value as Record<string, unknown> };
  }
  return {};
}

/**
 * Dựng quyền gọi kỹ năng từ frontmatter — giữ nguyên thứ tự từ chối khoá cũ
 * (disableModelInvocation, modelInvocable, userInvocable) rồi mới đọc khoá chuẩn.
 * Nhận: data — object frontmatter.
 * Trả: {@link SkillInvocationPolicy} với modelInvocable/userInvocable đã phân giải.
 * @throws {Error} khi còn khoá legacy.
 * @throws {TypeError} khi khoá boolean có giá trị không hợp lệ.
 */
export function parseInvocationPolicy(data: Record<string, unknown>): SkillInvocationPolicy {
  rejectLegacyInvocationKey(data, "disableModelInvocation", "disable-model-invocation");
  rejectLegacyInvocationKey(data, "modelInvocable", "disable-model-invocation");
  rejectLegacyInvocationKey(data, "userInvocable", "user-invocable");
  const disableModelInvocation = frontmatterBoolean(data, "disable-model-invocation");
  const userInvocable = frontmatterBoolean(data, "user-invocable");
  return {
    modelInvocable: disableModelInvocation !== true,
    userInvocable: userInvocable !== false,
  };
}

/**
 * Từ chối khoá frontmatter cũ và chỉ ra khoá chuẩn thay thế.
 * Nhận: data — object frontmatter; legacy — khoá cũ; canonical — khoá chuẩn.
 * Trả: không trả gì khi khoá cũ vắng mặt.
 * @throws {Error} khi khoá cũ tồn tại.
 */
function rejectLegacyInvocationKey(data: Record<string, unknown>, legacy: string, canonical: string): void {
  if (Object.hasOwn(data, legacy)) throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`);
}

/**
 * Đọc một cờ boolean frontmatter theo đúng tập giá trị của bản gốc.
 * Nhận: data — object frontmatter; key — tên trường.
 * Trả: true/false khi có mặt và hợp lệ, undefined khi vắng mặt.
 * @throws {TypeError} khi có mặt nhưng không phải boolean/1/0/"1"/"0"/true/yes/on/false/no/off.
 */
function frontmatterBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  if (!Object.hasOwn(data, key)) return undefined;
  const value = data[key];
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string")
    switch (value.toLowerCase()) {
      case "true":
      case "yes":
      case "on":
        return true;
      case "false":
      case "no":
      case "off":
        return false;
    }
  throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}
