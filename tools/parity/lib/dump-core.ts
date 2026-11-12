/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Lõi của giàn parity: parse, chuẩn hoá và diff cây dump-config theo row id
 */

import { isMap, isScalar, isSeq, parseDocument } from "yaml";

import { type EquivalenceTable, equivalenceFor, isEquivalentName } from "./equivalence.ts";

/** Một row trong cây plugin sau khi parse YAML. */
export interface DumpRow {
  /** Vị trí 0-based của row trong cây. */
  index: number;
  /** Khoá định danh: `id` nếu có, không thì `name`, không thì `row-<index>`. */
  id: string;
  /** Giá trị đã chuyển sang JS thuần (tag `!!js` được giữ dưới dạng `{ __tag, value }`). */
  raw: unknown;
}

/** Kết quả parse một file dump-config. */
export interface ParsedDump {
  /** Các row theo đúng thứ tự trong file. */
  rows: DumpRow[];
  /** Lỗi parse của thư viện YAML (rỗng nghĩa là hợp lệ). */
  errors: string[];
}

/** Một row đã chuẩn hoá để so sánh được giữa hai môi trường khác nhau. */
export interface NormalisedRow {
  /** id của row. */
  id: string;
  /** Vị trí trong cây. */
  order: number;
  /** JSON chuẩn hoá (khoá đã sắp xếp) dùng để so bằng chuỗi. */
  json: string;
  /** Giá trị đã chuẩn hoá. */
  value: unknown;
}

/** Cả cây dump đã chuẩn hoá. */
export interface NormalisedDump {
  /** Nhãn nguồn (tên target). */
  source: string;
  /** Bảng row theo id; row trùng id bị ghi vào `duplicates`. */
  rows: Map<string, NormalisedRow>;
  /** Thứ tự id trong cây. */
  order: string[];
  /** Các id xuất hiện nhiều lần. */
  duplicates: string[];
  /** Số cảnh báo của thư viện YAML (tag `!!js` không giải được). */
  warnings: number;
  /** Tổng số row đọc được. */
  rowCount: number;
  /** Id row bị che nhầm thành `<secret>` — PHẢI luôn rỗng (lỗi che nhầm = diff giả PASS). */
  maskedIds: string[];
  /** Số giá trị đã bị che trong toàn cây. */
  redactedValues: number;
}

/** Một điểm khác biệt ở cấp lá giữa hai row cùng id. */
export interface FieldChange {
  /** Đường dẫn lá, ví dụ `config.root`. */
  path: string;
  /** Giá trị bên tham chiếu (đã chuẩn hoá). */
  ref: string;
  /** Giá trị bên ta (đã chuẩn hoá). */
  ours: string;
}

/** Một row bị ĐỔI giữa hai bên. */
export interface RowChange {
  /** id của row. */
  id: string;
  /** Các lá khác nhau (giới hạn `MAX_FIELDS_PER_ROW`). */
  fields: FieldChange[];
  /** Tổng số lá khác nhau thật. */
  fieldCount: number;
}

/** Một row lệch thứ tự giữa hai bên. */
export interface OrderDrift {
  /** id của row. */
  id: string;
  /** Vị trí bên tham chiếu. */
  refIndex: number;
  /** Vị trí bên ta. */
  oursIndex: number;
}

/** Một row đã được THAY bằng gói tương ứng của ta (đổi tên gói, không đổi hành vi). */
export interface SwappedRow {
  /** id row. */
  id: string;
  /** Tên package bên ref. */
  ref: string;
  /** Tên package của ta. */
  ours: string;
  /** Bằng chứng hành vi ghi trong ma trận parity. */
  evidence: string;
  /** true khi ma trận có bằng chứng và tìm được file test/hợp đồng tương ứng. */
  verified: boolean;
  /** File bằng chứng (tương đối repo) nếu tìm được. */
  evidenceFile: string | null;
}

/** Kết quả diff hai cây dump-config. */
export interface DumpDiff {
  /** Nhãn bên tham chiếu. */
  refSource: string;
  /** Nhãn bên ta. */
  oursSource: string;
  /** Số row bên tham chiếu. */
  refRows: number;
  /** Số row bên ta. */
  oursRows: number;
  /** id chỉ có ở bên ta (THÊM). */
  added: string[];
  /** id chỉ có ở bên tham chiếu (THIẾU). */
  missing: string[];
  /** row cùng id nhưng nội dung khác (ĐỔI). */
  changed: RowChange[];
  /** Số row giống hệt. */
  unchanged: number;
  /** Row lệch thứ tự (khác biệt thứ tự mount). */
  orderDrift: OrderDrift[];
  /** Row đã thay sang gói tương ứng của ta — chỉ số TIẾN ĐỘ (G3/G4), không phải lỗi. */
  swapped: SwappedRow[];
}

/** Tuỳ chọn chuẩn hoá. */
export interface NormaliseOptions {
  /** Các tiền tố đường dẫn tuyệt đối sẽ bị thay bằng `<path>`. */
  paths?: readonly string[];
  /** Tên khoá (không phân biệt hoa thường) mà giá trị là bất định giữa các lần chạy. */
  volatileKeys?: readonly string[];
}

/** Số lá khác nhau tối đa in ra cho mỗi row. */
export const MAX_FIELDS_PER_ROW = 6;

/** Thay thế cho mọi đường dẫn tuyệt đối. */
export const PATH_TOKEN = "<path>";

/** Thay thế cho mọi chuỗi trông như secret/token. */
export const SECRET_TOKEN = "<secret>";

/** Hậu tố row của ta khi thay một row DSH bằng "disable + insert" (patch cordis buộc phải vậy). */
export const OURS_ROW_SUFFIX = "-ours";

/** Thay thế cho giá trị bất định (thời gian, pid, cổng…). */
export const VOLATILE_TOKEN = "<volatile>";

/** Các khoá bất định mặc định — giá trị của chúng không bao giờ được so sánh. */
export const DEFAULT_VOLATILE_KEYS: readonly string[] = Object.freeze([
  "timestamp",
  "time",
  "startedat",
  "updatedat",
  "createdat",
  "pid",
  "port",
  "token",
  "secret",
  "apikey",
]);

/**
 * Chuyển một node YAML thành giá trị JS thuần, giữ lại tag `!!js` để không mất thông tin.
 * @param node node YAML (Scalar/YAMLMap/YAMLSeq) hoặc giá trị JS thuần.
 * @returns giá trị JS thuần; node có tag `!!js` trả về `{ __tag: "!!js", value }`.
 */
export function toPlain(node: unknown): unknown {
  if (isScalar(node)) {
    const tag = typeof node.tag === "string" ? node.tag : "";
    if (tag.includes(":js")) return { __tag: "!!js", value: node.value ?? null };
    return node.value ?? null;
  }
  if (isSeq(node)) return node.items.map((item) => toPlain(item));
  if (isMap(node)) {
    const out: Record<string, unknown> = {};
    for (const pair of node.items) {
      const key = isScalar(pair.key) ? String(pair.key.value ?? "") : String(toPlain(pair.key));
      out[key] = toPlain(pair.value);
    }
    return out;
  }
  return node ?? null;
}

/**
 * Parse một file dump-config thành danh sách row.
 * @param text nội dung file `--dump-config`.
 * @returns các row theo thứ tự và lỗi parse nếu có.
 */
export function parseDumpYaml(text: string): ParsedDump {
  const doc = parseDocument(text);
  const errors = doc.errors.map((error) => error.message);
  const contents: unknown = doc.contents;
  if (!isSeq(contents)) return { rows: [], errors };
  const rows: DumpRow[] = [];
  contents.items.forEach((item, index) => {
    const raw = toPlain(item);
    rows.push({ index, id: rowId(raw, index), raw });
  });
  return { rows, errors };
}

/**
 * Suy ra id của một row: `id` → `name` → `row-<index>`.
 * @param raw giá trị JS thuần của row.
 * @param index vị trí của row trong cây.
 * @returns id dùng làm khoá so sánh.
 */
export function rowId(raw: unknown, index: number): string {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (typeof record.id === "string" && record.id.length > 0) return record.id;
    if (typeof record.name === "string" && record.name.length > 0) return record.name;
  }
  return "row-" + String(index);
}

/**
 * Chuẩn hoá một chuỗi: thay đường dẫn tuyệt đối đã biết, đường dẫn còn sót và secret.
 * @param value chuỗi cần chuẩn hoá.
 * @param paths các tiền tố đường dẫn tuyệt đối cần thay.
 * @param key tên khoá chứa chuỗi này (để nhận diện khoá nhạy cảm); rỗng khi không rõ.
 * @returns chuỗi đã thay thế.
 */
export function maskString(value: string, paths: readonly string[], key = ""): string {
  let out = value;
  for (const prefix of paths) {
    if (prefix.length < 2) continue;
    if (out.includes(prefix)) out = out.split(prefix).join(PATH_TOKEN);
  }
  if (isPathLike(out)) return PATH_TOKEN;
  if (isSecretLike(out, key)) return SECRET_TOKEN;
  return out;
}

/**
 * Đoán một chuỗi có phải đường dẫn tuyệt đối của máy này hay không.
 * @param value chuỗi đã thay tiền tố đã biết.
 * @returns true nếu là đường dẫn hệ thống (không phải route như `/api`).
 */
export function isPathLike(value: string): boolean {
  if (value.length < 4 || value.includes(" ") || value.includes(":")) return false;
  if (value.startsWith("~/")) return true;
  if (!value.startsWith("/")) return false;
  const markers = ["/Users/", "/home/", "/tmp/", "/private/", "/var/", "/opt/", "/Applications/", "/usr/"];
  return markers.some((marker) => value.includes(marker));
}

/** Các mảnh tên khoá được coi là nhạy cảm (giá trị dưới khoá này bị che). */
export const SENSITIVE_KEY_MARKERS: readonly string[] = Object.freeze([
  "token",
  "apikey",
  "api_key",
  "secret",
  "password",
  "passwd",
  "cookie",
  "authorization",
  "credential",
  "privatekey",
  "private_key",
]);

/**
 * Kiểm tra một tên khoá có nhạy cảm hay không (không phân biệt hoa thường).
 * @param key tên khoá.
 * @returns true nếu giá trị dưới khoá này phải bị che.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Kiểm tra một chuỗi có DẤU HIỆU của secret thật hay không — cố tình chặt để KHÔNG che nhầm
 * id row/plugin name (ví dụ `plugin-package-inventory-deepseek`).
 * @param value chuỗi cần kiểm tra.
 * @returns true nếu khớp mẫu secret (hex 64, base64url ≥32 có đủ chữ HOA+thường+số, tiền tố khoá).
 */
export function looksLikeSecret(value: string): boolean {
  if (value.length < 24) return false;
  if (value.startsWith("sk-") || value.startsWith("ghp_") || value.startsWith("Bearer ") || value.startsWith("v1.")) return true;
  if (value.length === 64 && isAllHex(value)) return true;
  return hasMixedClasses(value);
}

/**
 * Một chuỗi có phải hex thuần hay không.
 * @param value chuỗi cần kiểm tra.
 * @returns true nếu mọi ký tự là 0-9a-f.
 */
function isAllHex(value: string): boolean {
  for (const char of value) {
    const hex = (char >= "0" && char <= "9") || (char >= "a" && char <= "f");
    if (!hex) return false;
  }
  return true;
}

/**
 * Một chuỗi base64url dài có đủ ba lớp ký tự (hoa + thường + số) hay không.
 * @param value chuỗi cần kiểm tra.
 * @returns true nếu giống khoá ngẫu nhiên.
 */
function hasMixedClasses(value: string): boolean {
  if (value.length < 32 || value.length > 4096) return false;
  let upper = false;
  let lower = false;
  let digit = false;
  for (const char of value) {
    if (char >= "A" && char <= "Z") upper = true;
    else if (char >= "a" && char <= "z") lower = true;
    else if (char >= "0" && char <= "9") digit = true;
    else if (char !== "-" && char !== "_" && char !== ".") return false;
  }
  return upper && lower && digit;
}

/**
 * Đoán một chuỗi có phải secret/token hay không.
 * Che khi: (a) nằm dưới khoá nhạy cảm, hoặc (b) khớp mẫu secret thật ({@link looksLikeSecret}).
 * Id row/plugin name (chữ thường + gạch nối) KHÔNG bao giờ bị che.
 * @param value chuỗi cần kiểm tra.
 * @param key tên khoá chứa chuỗi (rỗng khi không rõ).
 * @returns true nếu cần che.
 */
export function isSecretLike(value: string, key = ""): boolean {
  if (value.length < 8 || value.length > 8192) return false;
  if (isSensitiveKey(key)) return !value.includes("/") && !value.includes("@");
  return looksLikeSecret(value);
}

/**
 * Chuẩn hoá đệ quy một giá trị: che đường dẫn, secret và các khoá bất định.
 * @param value giá trị cần chuẩn hoá.
 * @param options tuỳ chọn (tiền tố đường dẫn, khoá bất định).
 * @returns giá trị đã chuẩn hoá, khoá đã sắp xếp khi đóng gói JSON.
 */
export function normaliseValue(value: unknown, options: NormaliseOptions = {}): unknown {
  const paths = options.paths ?? [];
  const volatile = new Set((options.volatileKeys ?? DEFAULT_VOLATILE_KEYS).map((key) => key.toLowerCase()));
  const walk = (node: unknown, key: string): unknown => {
    if (typeof node === "string") return maskString(node, paths, key);
    if (Array.isArray(node)) return node.map((item) => walk(item, key));
    if (node !== null && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (typeof record.__tag === "string") {
        return { __tag: record.__tag, value: walk(record.value, key) };
      }
      const out: Record<string, unknown> = {};
      for (const childKey of Object.keys(record).sort()) {
        out[childKey] = volatile.has(childKey.toLowerCase())
          ? VOLATILE_TOKEN
          : walk(record[childKey], childKey);
      }
      return out;
    }
    return node ?? null;
  };
  return walk(value, "");
}

/**
 * JSON ổn định (khoá đã sắp xếp) để so sánh bằng chuỗi.
 * @param value giá trị bất kỳ.
 * @returns chuỗi JSON tất định.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "[" + value.map((item) => stableStringify(item)).join(",") + "]";
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return "{" + keys.map((key) => JSON.stringify(key) + ":" + stableStringify(record[key])).join(",") + "}";
}

/** Tham số cho {@link normaliseDump}. */
export interface NormaliseDumpOptions extends NormaliseOptions {
  /** Tiền tố đường dẫn bổ sung luôn bị che (home, repo…). */
  extraPaths?: readonly string[];
}

/**
 * Parse + chuẩn hoá một file dump-config thành cây so sánh được.
 * @param text nội dung `--dump-config`.
 * @param source nhãn nguồn (tên target).
 * @param options tuỳ chọn chuẩn hoá.
 * @returns cây đã chuẩn hoá kèm danh sách id trùng.
 */
export function normaliseDump(text: string, source: string, options: NormaliseDumpOptions = {}): NormalisedDump {
  const doc = parseDocument(text);
  const warnings = doc.warnings.length;
  const parsed = parseDumpYaml(text);
  const paths = [...(options.paths ?? []), ...(options.extraPaths ?? [])];
  const rows = new Map<string, NormalisedRow>();
  const duplicates: string[] = [];
  const maskedIds: string[] = [];
  const order: string[] = [];
  let redactedValues = 0;
  parsed.rows.forEach((row) => {
    const value = normaliseValue(row.raw, { paths, volatileKeys: options.volatileKeys });
    if (rows.has(row.id)) duplicates.push(row.id);
    if (!order.includes(row.id)) order.push(row.id);
    const json = stableStringify(value);
    redactedValues += json.split(SECRET_TOKEN).length - 1;
    if (row.id.includes(SECRET_TOKEN)) maskedIds.push(row.id);
    rows.set(row.id, { id: row.id, order: row.index, json, value });
  });
  return { source, rows, order, duplicates, warnings, rowCount: parsed.rows.length, maskedIds, redactedValues };
}

/**
 * Bung một giá trị thành bảng lá `đường dẫn → chuỗi` để so từng trường.
 * @param value giá trị đã chuẩn hoá.
 * @param prefix tiền tố đường dẫn (dùng khi đệ quy).
 * @param out bảng đích.
 * @returns bảng lá đã bung.
 */
export function flattenLeaves(
  value: unknown,
  prefix = "",
  out: Map<string, string> = new Map<string, string>(),
): Map<string, string> {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenLeaves(item, prefix + "[" + String(index) + "]", out));
    return out;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      flattenLeaves(record[key], prefix === "" ? key : prefix + "." + key, out);
    }
    return out;
  }
  out.set(prefix === "" ? "(root)" : prefix, value === null ? "null" : String(value));
  return out;
}

/**
 * Diff hai cây dump đã chuẩn hoá, theo từng row id.
 * @param ref cây tham chiếu.
 * @param ours cây của ta.
 * @returns danh sách THÊM / THIẾU / ĐỔI / lệch thứ tự.
 */
export function diffDumps(
  ref: NormalisedDump,
  ours: NormalisedDump,
  options: { equivalence?: EquivalenceTable } = {},
): DumpDiff {
  const added: string[] = [];
  const missing: string[] = [];
  const changed: RowChange[] = [];
  const swapped: SwappedRow[] = [];
  let unchanged = 0;
  for (const [id, row] of ours.rows) {
    const other = ref.rows.get(id);
    if (other === undefined) {
      added.push(id);
      continue;
    }
    if (other.json === row.json) {
      unchanged += 1;
      continue;
    }
    const allFields = rowFieldChanges(other.value, row.value);
    // RÀO CHẮN: chỉ khi MỌI lá khác nhau đều là `name` VÀ tên của ta là bản đã khai trong
    // docs/PARITY-MATRIX.md cho tên ref → tính là hành vi không đổi và ghi vào chỉ số TIẾN ĐỘ.
    // Tên lạ, hoặc khác thêm bất kỳ lá nào khác (config, disabled…) → vẫn là ĐỔI.
    if (options.equivalence !== undefined && allFields.length > 0 && allFields.every((field) => field.path === "name")) {
      const refName = nameOf(other.value);
      const oursName = nameOf(row.value);
      if (isEquivalentName(options.equivalence, refName, oursName)) {
        const mapping = equivalenceFor(options.equivalence, refName);
        swapped.push({
          id,
          ref: refName,
          ours: oursName,
          evidence: mapping?.evidence ?? "",
          verified: mapping?.verified ?? false,
          evidenceFile: mapping?.evidenceFile ?? null,
        });
        unchanged += 1;
        continue;
      }
    }
    changed.push({
      id,
      fields: allFields.slice(0, MAX_FIELDS_PER_ROW),
      fieldCount: allFields.length,
    });
  }
  for (const id of ref.rows.keys()) if (!ours.rows.has(id)) missing.push(id);
  const orderDrift: OrderDrift[] = [];
  for (const id of ref.order) {
    const oursIndex = ours.order.indexOf(id);
    const refIndex = ref.order.indexOf(id);
    if (oursIndex !== -1 && oursIndex !== refIndex) orderDrift.push({ id, refIndex, oursIndex });
  }
  // ---- Cặp "disable + insert" = MỘT row đã thay: patch cordis coi `name` là guard nên không thể
  // đổi tên tại chỗ; cách duy nhất là tắt row DSH rồi chèn row mới `<id>-ours`.
  if (options.equivalence !== undefined) {
    const consumedAdded = new Set<string>();
    const consumedChanged = new Set<string>();
    for (const addedId of added) {
      if (!addedId.endsWith(OURS_ROW_SUFFIX)) continue;
      const baseId = addedId.slice(0, -OURS_ROW_SUFFIX.length);
      const oursAdded = ours.rows.get(addedId);
      const refBase = ref.rows.get(baseId);
      if (oursAdded === undefined || refBase === undefined) continue;
      const refName = nameOf(refBase.value);
      const oursName = nameOf(oursAdded.value);
      if (!isEquivalentName(options.equivalence, refName, oursName)) continue;
      const oursBase = ours.rows.get(baseId);
      // Row gốc bên ta phải bị TẮT (hoặc bỏ hẳn) mới là "đã thay"; còn bật = lệch thật.
      if (oursBase !== undefined && !isDisabled(oursBase.value)) continue;
      // Rào chắn (ADR-0005): inject + config của X-ours phải khớp row X của tham chiếu.
      if (!sameRowBody(refBase.value, oursAdded.value)) continue;
      const mapping = equivalenceFor(options.equivalence, refName);
      swapped.push({
        id: baseId,
        ref: refName,
        ours: oursName,
        evidence: mapping?.evidence ?? "",
        verified: mapping?.verified ?? false,
        evidenceFile: mapping?.evidenceFile ?? null,
      });
      consumedAdded.add(addedId);
      if (oursBase !== undefined) consumedChanged.add(baseId);
    }
    if (consumedAdded.size > 0) {
      for (let index = added.length - 1; index >= 0; index -= 1) {
        const id = added[index];
        if (id !== undefined && consumedAdded.has(id)) added.splice(index, 1);
      }
    }
    if (consumedChanged.size > 0) {
      for (let index = changed.length - 1; index >= 0; index -= 1) {
        const row = changed[index];
        if (row !== undefined && consumedChanged.has(row.id)) changed.splice(index, 1);
      }
    }
  }

  added.sort();
  missing.sort();
  changed.sort((left, right) => left.id.localeCompare(right.id));
  swapped.sort((left, right) => left.id.localeCompare(right.id));
  return {
    refSource: ref.source,
    oursSource: ours.source,
    refRows: ref.rowCount,
    oursRows: ours.rowCount,
    added,
    missing,
    changed,
    unchanged,
    orderDrift,
    swapped,
  };
}

/**
 * So từng lá của hai row cùng id.
 * @param id id của row.
 * @param refValue giá trị bên tham chiếu.
 * @param oursValue giá trị bên ta.
 * @returns row đã đổi kèm tối đa {@link MAX_FIELDS_PER_ROW} lá khác nhau.
 */
export function diffRow(id: string, refValue: unknown, oursValue: unknown): RowChange {
  const fields = rowFieldChanges(refValue, oursValue);
  return { id, fields: fields.slice(0, MAX_FIELDS_PER_ROW), fieldCount: fields.length };
}

/**
 * Liệt kê MỌI lá khác nhau giữa hai row (không cắt bớt) — cần đủ để quyết định "chỉ khác tên gói".
 * @param refValue giá trị bên tham chiếu.
 * @param oursValue giá trị bên ta.
 * @returns danh sách lá khác nhau.
 */
export function rowFieldChanges(refValue: unknown, oursValue: unknown): FieldChange[] {
  const left = flattenLeaves(refValue);
  const right = flattenLeaves(oursValue);
  const paths = [...new Set([...left.keys(), ...right.keys()])].sort();
  const fields: FieldChange[] = [];
  for (const path of paths) {
    const ref = left.get(path);
    const ours = right.get(path);
    if (ref === ours) continue;
    fields.push({ path, ref: ref ?? "<thiếu>", ours: ours ?? "<thiếu>" });
  }
  return fields;
}

/**
 * Bỏ `id`, `name`, `disabled` khỏi một row (phần "thân" quyết định hành vi).
 * @param value giá trị row đã chuẩn hoá.
 * @returns bản sao không có ba trường định danh.
 */
export function stripRowIdentity(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const record: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete record.id;
  delete record.name;
  delete record.disabled;
  return record;
}

/**
 * Hai row có cùng "thân" (inject + config + mọi thứ trừ id/name/disabled) hay không.
 * Đây là rào chắn của quy tắc 2-đổi-1: khác thân ⇒ vẫn tính ĐỔI.
 * @param refValue row bên tham chiếu.
 * @param oursValue row của ta.
 * @returns true khi thân giống hệt nhau.
 */
export function sameRowBody(refValue: unknown, oursValue: unknown): boolean {
  return stableStringify(stripRowIdentity(refValue)) === stableStringify(stripRowIdentity(oursValue));
}

/**
 * Một row có đang bị tắt không (`disabled: true`).
 * @param value giá trị row đã chuẩn hoá.
 * @returns true khi row bị tắt.
 */
export function isDisabled(value: unknown): boolean {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return (value as Record<string, unknown>).disabled === true;
  }
  return false;
}

/**
 * Đọc lá `name` của một row đã chuẩn hoá.
 * @param value giá trị row.
 * @returns tên package, hoặc chuỗi rỗng.
 */
export function nameOf(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const name = (value as Record<string, unknown>).name;
    if (typeof name === "string") return name;
  }
  return "";
}

/**
 * Diff có đạt ngưỡng "0 dòng" hay không.
 * @param diff kết quả diff.
 * @returns true khi không THÊM, không THIẾU, không ĐỔI.
 */
export function isDumpParity(diff: DumpDiff): boolean {
  return diff.added.length === 0 && diff.missing.length === 0 && diff.changed.length === 0;
}

/**
 * In kết quả diff thành Markdown, nêu rõ THÊM / THIẾU / ĐỔI.
 * @param diff kết quả diff.
 * @param maxList số id tối đa liệt kê cho mỗi nhóm.
 * @returns khối Markdown.
 */
export function formatDumpDiff(diff: DumpDiff, maxList = 40): string {
  const lines: string[] = [];
  const verdict = isDumpParity(diff) ? "PASS" : "FAIL";
  lines.push("### dump-config: " + diff.oursSource + " vs " + diff.refSource + " → " + verdict);
  lines.push("");
  lines.push(
    "- row: bên ta **" +
      String(diff.oursRows) +
      "** · tham chiếu **" +
      String(diff.refRows) +
      "** · giống hệt **" +
      String(diff.unchanged) +
      "**",
  );
  lines.push(
    "- THÊM **" +
      String(diff.added.length) +
      "** · THIẾU **" +
      String(diff.missing.length) +
      "** · ĐỔI **" +
      String(diff.changed.length) +
      "** · lệch thứ tự **" +
      String(diff.orderDrift.length) +
      "**",
  );
  if (diff.added.length > 0) {
    lines.push("");
    lines.push("**THÊM** (chỉ có ở " + diff.oursSource + "): " + listIds(diff.added, maxList));
  }
  if (diff.missing.length > 0) {
    lines.push("");
    lines.push("**THIẾU** (chỉ có ở " + diff.refSource + "): " + listIds(diff.missing, maxList));
  }
  if (diff.changed.length > 0) {
    lines.push("");
    lines.push("**ĐỔI** (cùng id, khác nội dung):");
    for (const row of diff.changed.slice(0, maxList)) {
      lines.push("");
      lines.push(
        "- \`" + row.id + "\` — " + String(row.fieldCount) + " lá khác nhau" +
          (row.fieldCount > row.fields.length ? " (in " + String(row.fields.length) + ")" : ""),
      );
      for (const field of row.fields) {
        lines.push("  - \`" + field.path + "\`: \`" + field.ref + "\` → \`" + field.ours + "\`");
      }
    }
    if (diff.changed.length > maxList) {
      lines.push("");
      lines.push("- … còn " + String(diff.changed.length - maxList) + " row nữa");
    }
  }
  if (diff.orderDrift.length > 0) {
    lines.push("");
    lines.push(
      "**LỆCH THỨ TỰ** (cùng tập row nhưng mount khác vị trí): " +
        diff.orderDrift
          .slice(0, 12)
          .map((item) => "\`" + item.id + "\`(" + String(item.refIndex) + "→" + String(item.oursIndex) + ")")
          .join(", "),
    );
  }
  return lines.join("\n");
}

/**
 * Rút gọn danh sách id để in.
 * @param ids danh sách id.
 * @param max số phần tử tối đa.
 * @returns chuỗi `a, b, c… (+n)`.
 */
export function listIds(ids: readonly string[], max: number): string {
  const head = ids.slice(0, max).join(", ");
  return ids.length > max ? head + " … (+" + String(ids.length - max) + ")" : head;
}

/**
 * Bảng nhiều cột: mỗi row id có/không có ở từng biến thể (dùng để tách hệ quả VERSION vs PATCH).
 * @param columns các cột, mỗi cột là một cây dump đã chuẩn hoá.
 * @param onlyDifferences chỉ in các row khác nhau giữa các cột (bảng gọn cho report).
 * @returns bảng Markdown.
 */
export function formatPresenceTable(columns: readonly NormalisedDump[], onlyDifferences = false): string {
  if (columns.length === 0) return "(không có cột nào)";
  const ids: string[] = [];
  for (const column of columns) {
    for (const id of column.order) if (!ids.includes(id)) ids.push(id);
  }
  const baseline = columns[0];
  const header = ["row id", ...columns.map((column) => column.source + " (" + String(column.rowCount) + ")")];
  const lines = ["| " + header.join(" | ") + " |", "|" + header.map(() => "---").join("|") + "|"];
  let identical = 0;
  for (const id of ids) {
    const cells = columns.map((column, index) => {
      const row = column.rows.get(id);
      if (row === undefined) return "—";
      if (index === 0 || baseline === undefined) return "✓";
      const reference = baseline.rows.get(id);
      if (reference === undefined) return "✓*";
      return reference.json === row.json ? "✓" : "✓*";
    });
    const differs = cells.some((cell) => cell !== cells[0]);
    if (onlyDifferences && !differs) {
      identical += 1;
      continue;
    }
    lines.push("| \`" + id + "\` | " + cells.join(" | ") + " |");
  }
  if (onlyDifferences && identical > 0) {
    lines.push("");
    lines.push("(bỏ qua " + String(identical) + " row giống nhau ở mọi cột)");
  }
  lines.push("");
  lines.push("\`✓\` = có row · \`✓*\` = có nhưng nội dung khác cột đầu · \`—\` = không có row");
  return lines.join("\n");
}
