/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phân tích MỘT tài liệu credentials: hai không gian khoá (refs, records) và các khoá
 *      cấp 1 mà bản build này không đọc — mọi mục sai đều bị TỪ CHỐI, không bị bỏ qua
 */

import {
  credentialRef,
  parseCredentialKey,
  type ApiKeyRecord,
  type CredentialRecord,
} from "@deepseek-ai/dsh-credentials";
import { parseDocument } from "yaml";

/** Bố cục tài liệu mà bản build này đọc và ghi. */
export const DOCUMENT_VERSION = 1;

/**
 * Một tài liệu credentials đã phân tích: hai không gian khoá nó lưu (giữ nguyên như đã viết),
 * cộng các khoá cấp 1 nó không đọc.
 */
export interface CredentialsDocument {
  /** Các mục tham chiếu, khoá theo tên tham chiếu. */
  refs: Map<string, string>;
  /** Các bản ghi đã lưu, khoá theo khoá bản ghi `<scope>/<id>`. */
  records: Map<string, CredentialRecord>;
  /** Các khoá cấp 1 bản build này không đọc; chúng vẫn nằm trên đĩa và không giải ra giá trị nào. */
  ignoredKeys: string[];
}

/**
 * Mô tả một lỗi phân tích YAML mà KHÔNG trích nguồn: thông điệp của bộ phân tích vốn nhúng
 * dòng lỗi, mà ở đây dòng đó chứa bí mật.
 * Nhận: lỗi của bộ phân tích.
 * Trả: mã lỗi kèm dòng và cột.
 */
function describeYamlError(error: { code?: string; linePos?: { line: number; col: number }[] }): string {
  const at = error.linePos?.[0];
  const where = at === undefined ? "" : ` at line ${String(at.line)}, column ${String(at.col)}`;
  return `${String(error.code)}${where}`;
}

/**
 * Phân tích MỘT tài liệu credentials. Bên trong `refs` và `records` mọi thứ đều bị TỪ CHỐI
 * chứ không bị bỏ qua — khoá không định địa chỉ được, giá trị sai kiểu, thẻ bản ghi lạ, trường
 * lạ — vì một mục bị bỏ qua im lặng đọc lên thành "credentials tôi lưu không có tác dụng";
 * gốc thiếu `version` cũng bị từ chối. Một khoá cấp 1 lạ được trả trong `ignoredKeys` để nơi
 * gọi báo lại, nên mục của công cụ khác không chặn được boot. Khoá trùng nổi lên thành lỗi của
 * bộ phân tích. Tài liệu rỗng là kho rỗng và không cần `version`.
 * Nhận: văn bản của tài liệu và đường dẫn tuyệt đối (để trích trong thông điệp lỗi).
 * Trả: tham chiếu, bản ghi và các khoá cấp 1 bị bỏ qua.
 */
export function parseCredentialsDocument(text: string, filename: string): CredentialsDocument {
  const document = parseDocument(text, { prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(
      `credentials-local: invalid document at ${filename}: ${document.errors.map((error) => describeYamlError(error)).join("; ")}`,
    );
  }
  const root: unknown = document.toJS() ?? {};
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    throw new TypeError(`credentials-local: ${filename} must be a mapping`);
  }
  const fields = root as Record<string, unknown>;
  const keys = Object.keys(fields);
  if (keys.length === 0) return { refs: new Map(), records: new Map(), ignoredKeys: [] };
  if (!("version" in fields)) {
    throw new Error(
      `credentials-local: ${filename} uses the pre-release flat layout. Add \`version: 1\` and nest the existing ${String(keys.length)} ${keys.length === 1 ? "entry" : "entries"} under \`refs:\`. No values need to change.`,
    );
  }
  if (fields["version"] !== DOCUMENT_VERSION) {
    throw new Error(
      `credentials-local: ${filename} declares version ${JSON.stringify(fields["version"])}; this build reads version ${String(DOCUMENT_VERSION)}`,
    );
  }
  return {
    refs: parseRefs(fields["refs"], filename),
    records: parseRecords(fields["records"], filename),
    ignoredKeys: keys.filter((key) => key !== "version" && key !== "refs" && key !== "records"),
  };
}

/**
 * Nhận một mục `refs` của tài liệu: khoá là tên tham chiếu hợp lệ, giá trị là chuỗi khác rỗng.
 * Nhận: phần `refs` thô và đường dẫn tài liệu.
 * Trả: ánh xạ tên tham chiếu sang giá trị.
 */
function parseRefs(section: unknown, filename: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(asSection(section, "refs", filename))) {
    credentialRef(key);
    if (typeof value !== "string") throw new TypeError(`credentials-local: the value for "${key}" in ${filename} must be a string`);
    if (value.length === 0) {
      throw new Error(`credentials-local: the value for "${key}" in ${filename} is empty; remove the key instead`);
    }
    entries.set(key, value);
  }
  return entries;
}

/**
 * Nhận một mục `records` của tài liệu: khoá dạng `<scope>/<id>`, giá trị là bản ghi có thẻ.
 * Nhận: phần `records` thô và đường dẫn tài liệu.
 * Trả: ánh xạ khoá bản ghi sang bản ghi đã nhận.
 */
function parseRecords(section: unknown, filename: string): Map<string, CredentialRecord> {
  const entries = new Map<string, CredentialRecord>();
  for (const [key, value] of Object.entries(asSection(section, "records", filename))) {
    parseCredentialKey(key);
    entries.set(key, parseRecord(key, value, filename));
  }
  return entries;
}

/**
 * Từ chối một bản ghi api-key mà đường ĐỌC không thể nhận, TRƯỚC khi nó được ghi xuống: khoá
 * rỗng, tên biến ngoài grammar, hoặc giá trị biến rỗng đều sẽ tạo ra tài liệu mà lần boot sau
 * `parseRecord` từ chối — một lần ghi ở ranh giới bền vững phải được kiểm ngay tại chỗ ghi.
 * Nhận: khoá bản ghi (để dựng thông điệp) và bản ghi api-key mà một lần biến đổi trả về.
 * Trả: không; ném TypeError khi bản ghi không lưu được.
 */
export function assertStorableApiKey(key: string, record: ApiKeyRecord): void {
  if (record.key !== undefined && record.key.length === 0) {
    throw new TypeError(`credentials-local: record "${key}" has an empty key; omit the field instead`);
  }
  for (const [name, value] of Object.entries(record.env ?? {})) {
    credentialRef(name);
    if (value.length === 0) throw new TypeError(`credentials-local: record "${key}" env "${name}" must be a non-empty string`);
  }
}

/**
 * Đọc một mục của tài liệu thành ánh xạ thuần; vắng mặt và null đều nghĩa là rỗng.
 * Nhận: mục thô, tên mục (để dựng thông điệp) và đường dẫn tài liệu.
 * Trả: ánh xạ thuần của mục.
 */
function asSection(section: unknown, name: string, filename: string): Record<string, unknown> {
  if (section === undefined || section === null) return {};
  if (typeof section !== "object" || Array.isArray(section)) {
    throw new TypeError(`credentials-local: "${name}" in ${filename} must be a mapping`);
  }
  return section as Record<string, unknown>;
}

/**
 * Nhận MỘT bản ghi, từ chối thẻ hoặc trường lạ thay vì bỏ đi.
 * Nhận: khoá bản ghi, giá trị thô và đường dẫn tài liệu.
 * Trả: bản ghi đã chuẩn hoá theo đúng thẻ của nó.
 */
function parseRecord(key: string, value: unknown, filename: string): CredentialRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`credentials-local: record "${key}" in ${filename} must be a mapping`);
  }
  const fields = value as Record<string, unknown>;
  const kind = fields["kind"];
  if (kind === "api-key") {
    assertFields(key, fields, ["kind", "key", "env"], filename);
    const apiKey = fields["key"];
    if (apiKey !== undefined && (typeof apiKey !== "string" || apiKey.length === 0)) {
      throw new TypeError(`credentials-local: record "${key}" in ${filename} has a non-string or empty key`);
    }
    const env = parseRecordEnv(key, fields["env"], filename);
    return {
      kind: "api-key",
      ...(apiKey === undefined ? {} : { key: apiKey as string }),
      ...(env === undefined ? {} : { env }),
    };
  }
  if (kind === "grant") {
    assertFields(key, fields, ["kind", "payload"], filename);
    if (!("payload" in fields)) throw new Error(`credentials-local: record "${key}" in ${filename} has no payload`);
    assertJsonValue(`record "${key}" payload in ${filename}`, fields["payload"], new Set());
    return { kind: "grant", payload: fields["payload"] };
  }
  if (kind === undefined) throw new Error(`credentials-local: record "${key}" in ${filename} has no kind`);
  throw new Error(`credentials-local: record "${key}" in ${filename} has unknown kind ${JSON.stringify(kind)}`);
}

/**
 * Từ chối một trường mà thẻ của bản ghi không định nghĩa, để một lỗi gõ không bị bỏ im lặng.
 * Nhận: khoá bản ghi, các trường đọc được, danh sách trường hợp lệ và đường dẫn tài liệu.
 * Trả: không; ném Error khi gặp trường lạ.
 */
function assertFields(key: string, fields: Record<string, unknown>, allowed: readonly string[], filename: string): void {
  for (const field of Object.keys(fields)) {
    if (!allowed.includes(field)) {
      throw new Error(`credentials-local: record "${key}" in ${filename} has unknown field "${field}"`);
    }
  }
}

/**
 * Nhận phần môi trường nhà cung cấp của một bản ghi api-key: tên hợp lệ trên giá trị khác rỗng.
 * Nhận: khoá bản ghi, phần `env` thô và đường dẫn tài liệu.
 * Trả: ánh xạ tên biến sang giá trị, hoặc undefined khi bản ghi không khai env.
 */
function parseRecordEnv(key: string, env: unknown, filename: string): Record<string, string> | undefined {
  if (env === undefined) return undefined;
  if (typeof env !== "object" || env === null || Array.isArray(env)) {
    throw new TypeError(`credentials-local: record "${key}" in ${filename} has a non-mapping env`);
  }
  const parsed: Record<string, string> = {};
  for (const [name, value] of Object.entries(env)) {
    credentialRef(name);
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`credentials-local: record "${key}" env "${name}" in ${filename} must be a non-empty string`);
    }
    parsed[name] = value;
  }
  return parsed;
}

/**
 * Từ chối một payload không sống sót được một vòng JSON, ở cả chiều vào lẫn chiều ra. Seam hứa
 * với chủ sở hữu rằng payload quay về đúng như đã ghi, và cả hai chiều đều có thể phá lời hứa:
 * tài liệu có thể viết `.inf` hoặc một vòng alias, còn chủ sở hữu có thể đưa vào một `Date`,
 * một thể hiện lớp, hay một `bigint` mà tài liệu này không có cách viết trung thực. Không giá
 * trị nào — kể cả giá trị lồng — được trích trong chẩn đoán.
 * Nhận: chủ thể được nêu trong chẩn đoán (đã sạch giá trị), giá trị cần nhận và tập đối tượng trên đường đi.
 * Trả: không; ném TypeError nêu `where` khi giá trị không round-trip được.
 */
export function assertJsonValue(where: string, value: unknown, seen: Set<unknown>): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`credentials-local: ${where} holds a non-finite number`);
  }
  if (typeof value === "object") {
    if (seen.has(value)) throw new TypeError(`credentials-local: ${where} is cyclic`);
    if (Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value)) {
      seen.add(value);
      for (const nested of Object.values(value as Record<string, unknown>)) assertJsonValue(where, nested, seen);
      seen.delete(value);
      return;
    }
  }
  throw new TypeError(`credentials-local: ${where} holds a value JSON cannot represent`);
}

/**
 * So sánh cấu trúc hai giá trị JSON đã được nhận. Bản ghi tới đây sau `assertJsonValue`, nên
 * phép duyệt chỉ gặp hình dạng JSON; thứ tự khoá bị bỏ qua vì một trình soạn thảo bên ngoài có
 * thể đổi thứ tự trường của bản ghi mà không đổi thứ nó lưu.
 * Nhận: hai giá trị cần so.
 * Trả: true khi hai giá trị mang cùng nội dung JSON.
 */
export function sameJsonValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left as Record<string, unknown>);
  const rightKeys = Object.keys(right as Record<string, unknown>);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) =>
      key in (right as Record<string, unknown>) &&
      sameJsonValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
}
