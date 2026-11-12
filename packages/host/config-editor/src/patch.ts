/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép sửa tệp patch của profile: đọc dãy YAML, ghi/xoá config của MỘT row, và trả lại dãy patch
 *      đã đọc bằng đúng phương ngữ entry-list (tag `!!js` đi vòng qua `__jsExpr`).
 */
import { isDeepStrictEqual } from "node:util";
import yaml from "js-yaml";
import { Scalar, isMap, isSeq, parseDocument, visit } from "yaml";
import type { Document, YAMLSeq } from "yaml";
import { entryListSchema } from "@deepseek-ai/cordis-plugin-include";
import type { PatchOptions } from "@deepseek-ai/cordis-plugin-include";
import type { EntryOptions } from "@deepseek-ai/cordis-plugin-loader";
import type { PatchRowIdentity } from "./types.ts";

/** Tag của biểu thức `!!js` trong phương ngữ entry-list. */
const JS_EXPRESSION_TAG = "tag:yaml.org,2002:js";

/** Định nghĩa tag `!!js`: giá trị đi qua NGUYÊN VĂN (dạng chuỗi), không bị diễn giải. */
const JS_EXPRESSION_DEFINITION = { tag: JS_EXPRESSION_TAG, resolve: (value: string): unknown => value };

/** Nội dung dùng khi tệp patch của profile CHƯA tồn tại. */
export const EMPTY_PATCH_LIST = "[]\n";

/** Quyền của tệp patch sau khi ghi (0o600). */
export const PATCH_FILE_MODE = 0o600;

/** Một tệp patch đã đọc được: tài liệu YAML và CHÍNH dãy row bên trong nó. */
export interface PatchDocument {
  /** Tài liệu đã đọc; mọi phép sửa đi qua nó để giữ đúng định dạng. */
  readonly document: Document.Parsed;
  /** Dãy row của tài liệu (cùng một vật thể với `document.contents`). */
  readonly rows: YAMLSeq;
}

/**
 * Làm phẳng cây row: một row nhóm mang các row con trong `config`.
 * @param rows - dãy row đã soạn (có thể lồng nhóm).
 * @returns dãy row theo thứ tự trước-sau, mỗi nhóm đứng trước các con của nó.
 */
export function flatten(rows: EntryOptions[]): EntryOptions[] {
  return rows.flatMap((row) => [row, ...(row.group && Array.isArray(row.config) ? flatten(row.config) : [])]);
}

/**
 * Đọc tệp patch của profile thành tài liệu sửa được.
 * @param text - nội dung tệp (`[]\n` khi tệp chưa tồn tại).
 * @returns tài liệu cùng dãy row của nó.
 * @throws lỗi phân tích ĐẦU TIÊN của tài liệu, hoặc khi gốc không phải dãy.
 */
export function parsePatchDocument(text: string): PatchDocument {
  const document = parseDocument(text, { customTags: [JS_EXPRESSION_DEFINITION] });
  if (document.errors[0] !== undefined) throw document.errors[0];
  if (!isSeq(document.contents)) throw new Error("Profile patch must be a YAML sequence");
  document.contents.flow = false;
  return { document, rows: document.contents };
}

/**
 * Ghi config của MỘT row vào tài liệu: xoá khi trùng lớp thừa kế, thêm row khi chưa có, còn lại thì thay tại chỗ.
 * @param patch - tài liệu đích.
 * @param entry - khoá nhận dạng row (id + specifier).
 * @param next - config THÔ kế tiếp.
 * @param inherited - config thừa kế từ các lớp dưới.
 * @returns không; tài liệu bị sửa tại chỗ.
 */
export function writeConfigRow(
  patch: PatchDocument,
  entry: PatchRowIdentity,
  next: Record<string, unknown>,
  inherited: Record<string, unknown>,
): void {
  const { document, rows } = patch;
  const index = rows.items.findLastIndex(
    (item, position) =>
      isMap(item) &&
      document.getIn([position, "id"]) === entry.id &&
      !item.has("insert") &&
      (!item.has("name") || document.getIn([position, "name"]) === entry.name),
  );
  if (isDeepStrictEqual(next, inherited)) {
    for (let position = rows.items.length - 1; position >= 0; position--) {
      const row = rows.items[position];
      if (!isMap(row) || document.getIn([position, "id"]) !== entry.id || row.has("insert")) continue;
      row.delete("config");
      if (row.items.length === Number(row.has("id")) + Number(row.has("name"))) document.delete(position);
    }
  } else if (index < 0) {
    document.add(document.createNode({ id: entry.id, name: entry.name, config: next }));
  } else {
    document.setIn([index, "config"], document.createNode(next));
  }
}

/**
 * Trả các map `{ __jsExpr: "…" }` về scalar mang tag `!!js` — dạng mà phương ngữ entry-list mong đợi.
 * @param document - tài liệu vừa sửa.
 * @returns không; tài liệu bị sửa tại chỗ.
 */
export function restoreJsExpressions(document: Document.Parsed): void {
  visit(document, {
    Map(_key, node) {
      if (node.items.length !== 1) return;
      const expression = node.get("__jsExpr");
      if (typeof expression !== "string") return;
      const scalar = new Scalar(expression);
      scalar.tag = JS_EXPRESSION_TAG;
      return scalar;
    },
  });
}

/**
 * Đọc lại tài liệu đã sửa thành dãy patch theo ĐÚNG phương ngữ mà Loader dùng khi nạp tệp.
 * @param document - tài liệu đã sửa.
 * @returns dãy patch đã phân tích.
 */
export function patchListOf(document: Document.Parsed): PatchOptions[] {
  return yaml.load(String(document), { schema: entryListSchema }) as PatchOptions[];
}
