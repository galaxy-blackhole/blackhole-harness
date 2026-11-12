/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Định dạng JSON trên đĩa: tệp LUÔN là trạng thái ròng hiện tại, giữ người-đọc-được (in đẹp, thứ tự
 *      khoá theo lúc chèn) — chính sự dễ đọc đó là lý do backend này tồn tại. Đơn vị `single` là MỘT tài
 *      liệu kèm header; đơn vị `per-record` là một THƯ MỤC, mỗi bản ghi một tài liệu đóng dấu phiên bản
 *      (`<bảng>/<khoá>.json`) cộng `global.json` cho ô toàn cục (bản gốc: lib/types/format.d.ts)
 */
import { StorageError } from "./hub.ts";
import type { KvUnitDescriptorLike } from "./hub.ts";

/** Trạng thái ỦY QUYỀN trong bộ nhớ của một đơn vị; tệp chỉ là hình chiếu của nó. `global` là `null` tới lần ghi đầu. */
export interface UnitState {
  /** Phiên bản định dạng của đơn vị. */
  version: number;
  /** Ô singleton toàn cục; `null` = "chưa từng ghi". */
  global: unknown;
  /** Bản ghi theo bảng; mỗi bảng một bảng băm RIÊNG. */
  tables: Map<string, Map<string, unknown>>;
}

/**
 * Dựng trạng thái RỖNG cho một mô tả đơn vị: mọi bảng đã khai có mặt với bảng băm rỗng, ô global `null`.
 * Nhận: mô tả tĩnh của đơn vị.
 * Trả: trạng thái mới, hoàn toàn TÁCH RỜI giữa các lần gọi (ca C6 trong test).
 */
export function emptyState(descriptor: KvUnitDescriptorLike): UnitState {
  return {
    version: descriptor.version,
    global: null,
    tables: new Map(descriptor.tables.map((table) => [table, new Map<string, unknown>()] as const)),
  };
}

/**
 * Tuần tự hoá trạng thái một đơn vị thành nội dung tệp.
 * Nhận: tên đơn vị (đóng vào header) và trạng thái ủy quyền trong bộ nhớ.
 * Trả: tài liệu JSON in đẹp, kết thúc bằng một xuống dòng.
 */
export function serialize(name: string, state: UnitState): string {
  const tables: Record<string, Record<string, unknown>> = {};
  for (const [table, records] of state.tables) tables[table] = Object.fromEntries(records);
  const document = {
    unit: {
      name,
      version: state.version,
    },
    global: state.global,
    tables,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

/**
 * Phân tích nội dung tệp thành trạng thái đơn vị, kiểm hình dạng và phiên bản.
 * Nhận: nội dung tệp thô và định danh kỳ vọng (lệch phiên bản là TỪ CHỐI).
 * Trả: trạng thái đã phân tích; mọi ca hỏng ném {@link StorageError} với mã `malformed-medium`/`version-mismatch`.
 */
export function parse(text: string, descriptor: KvUnitDescriptorLike): UnitState {
  let document: unknown;
  try {
    document = JSON.parse(text) as unknown;
  } catch (error) {
    throw new StorageError("malformed-medium", `unit '${descriptor.name}': file is not valid JSON`, { cause: error });
  }
  if (typeof document !== "object" || document === null) {
    throw new StorageError("malformed-medium", `unit '${descriptor.name}': file is not a JSON object`);
  }
  const fields = document as { unit?: unknown; global?: unknown; tables?: unknown };
  const header = fields.unit;
  if (
    typeof header !== "object" ||
    header === null ||
    (header as { name?: unknown }).name !== descriptor.name ||
    typeof (header as { version?: unknown }).version !== "number"
  ) {
    throw new StorageError("malformed-medium", `unit '${descriptor.name}': missing or foreign unit header`);
  }
  const version = (header as { version: number }).version;
  if (version !== descriptor.version) {
    throw new StorageError(
      "version-mismatch",
      `unit '${descriptor.name}': stored version ${version} != expected ${descriptor.version}`,
    );
  }
  const tables = fields.tables;
  if (typeof tables !== "object" || tables === null || Array.isArray(tables)) {
    throw new StorageError("malformed-medium", `unit '${descriptor.name}': tables is not an object`);
  }
  const state: UnitState = {
    version,
    global: fields.global ?? null,
    tables: new Map<string, Map<string, unknown>>(),
  };
  const declared = tables as Record<string, unknown>;
  for (const table of descriptor.tables) {
    const records = declared[table];
    if (records === undefined) {
      state.tables.set(table, new Map<string, unknown>());
      continue;
    }
    if (typeof records !== "object" || records === null || Array.isArray(records)) {
      throw new StorageError("malformed-medium", `unit '${descriptor.name}': table '${table}' is not an object`);
    }
    state.tables.set(table, new Map(Object.entries(records as Record<string, unknown>)));
  }
  return state;
}

/**
 * Tuần tự hoá MỘT tài liệu per-record: dấu phiên bản của đơn vị cộng giá trị bản ghi, in đẹp như tài
 * liệu cả-đơn-vị.
 * Nhận: phiên bản định dạng của đơn vị (đóng vào header) và giá trị bản ghi (hoặc giá trị ô global).
 * Trả: tài liệu JSON in đẹp, kết thúc bằng một xuống dòng.
 */
export function serializeRecord(version: number, value: unknown): string {
  return `${JSON.stringify({ version, record: value }, null, 2)}\n`;
}

/**
 * Phân tích MỘT tài liệu per-record, kiểm dấu phiên bản. Tài liệu hỏng hình dạng hoặc mang phiên bản
 * KHÔNG được chấp nhận là NGOẠI LAI và đọc như VẮNG — hợp đồng per-record: một tệp bản ghi hỏng hay cũ
 * không được làm chết cả đơn vị, và dấu phiên bản không được chấp nhận thì BỎ bản ghi thay vì migrate
 * (định dạng cả-đơn-vị thì TỪ CHỐI, vì ở đó chỉ có đúng một tài liệu).
 * Nhận: nội dung tài liệu per-record thô và tập phiên bản được chấp nhận (hiện tại + `compatibleVersions`).
 * Trả: giá trị bản ghi, hoặc `undefined` khi tài liệu là NGOẠI LAI.
 */
export function parseRecord(text: string, versions: readonly number[]): unknown {
  let document: unknown;
  try {
    document = JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
  if (typeof document !== "object" || document === null) return undefined;
  const fields = document as { version?: unknown; record?: unknown };
  if (typeof fields.version !== "number" || !versions.includes(fields.version)) return undefined;
  return fields.record;
}
