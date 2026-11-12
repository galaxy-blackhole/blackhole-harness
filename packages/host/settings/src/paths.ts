/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vật dữ liệu cấu hình: sao chép đúng hình JSON, gộp lớp thừa kế + ghi đè, và áp một phép sửa
 *      theo đường dẫn lên mục cấu hình — tất cả trên bản sao tách rời, không chạm đầu vào.
 */
import { resolveConfig } from "@deepseek-ai/cordis";

import type { SchemaLike, SettingsPathOp } from "./types.ts";

/**
 * Kiểm một giá trị có phải object dữ liệu phẳng (không phải mảng, null, hay thể hiện lớp).
 * Nhận: giá trị bất kỳ.
 * Trả: true khi prototype là Object.prototype hoặc null.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Mô tả một giá trị mà JSON không biểu diễn được, dùng cho thông điệp từ chối.
 * Nhận: giá trị bị từ chối.
 * Trả: nhãn người đọc hiểu (vd "a Map", "a non-plain object", "a number", "undefined").
 */
function describeRejected(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "object" && value !== null) {
    const name = Object.getPrototypeOf(value)?.constructor?.name;
    return name === undefined || name === "Object" ? "a non-plain object" : "a " + name;
  }
  return "a " + typeof value;
}

/**
 * Áp MỘT phép sửa đường dẫn lên một mục cấu hình đã tách rời, trả về mục kế tiếp.
 * Nhận: mục hiện tại, phép sửa (set/unset + đường dẫn + giá trị), schema của mục (nguồn default).
 * Trả: mục mới; ném TypeError khi chỉ số mảng ngoài phạm vi hoặc gốc không phải object phẳng.
 */
export function applyPathOp(section: unknown, op: SettingsPathOp, schema: SchemaLike | undefined): Record<string, unknown> {
  const edit = (input: unknown, path: readonly string[], node: SchemaLike | undefined): unknown => {
    const [head, ...rest] = path;
    if (head === undefined) return op.op === "set" ? op.value : undefined;
    const value = input === undefined ? node?.meta.default : input;
    if (Array.isArray(value)) {
      const index = Number(head);
      if (
        !/^(0|[1-9][0-9]*)$/.test(head) ||
        index > value.length ||
        (index === value.length && (rest.length > 0 || op.op === "unset"))
      ) {
        throw new TypeError('Config array index "' + head + '" is out of range');
      }
      const result = [...value];
      if (rest.length === 0 && op.op === "unset") result.splice(index, 1);
      else result[index] = edit(value[index], rest, node?.inner);
      return result;
    }
    const result: Record<string, unknown> = isPlainObject(value) ? { ...value } : {};
    const child = edit(Object.hasOwn(result, head) ? result[head] : undefined, rest, node?.dict?.[head] ?? node?.inner);
    if (child === undefined) Reflect.deleteProperty(result, head);
    else {
      Object.defineProperty(result, head, {
        value: child,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return result;
  };
  const result = edit(section, op.path, schema);
  if (!isPlainObject(result)) throw new TypeError("Config root must be a plain object");
  return result;
}

/**
 * Tách và kiểm một đầu vào ghi trong CÙNG một lượt duyệt trước khi ghi xuống đĩa.
 * Nhận: gốc cần ghi (phải là object phẳng).
 * Trả: bản sao JSON-shaped tách rời; ném TypeError với đường dẫn cụ thể khi gặp Date/Map/BigInt/vòng lặp/số vô hạn.
 */
export function cloneJsonShaped(root: unknown): Record<string, unknown> {
  const reject = (label: string, path: string): TypeError => new TypeError("Config " + path + " contains " + label);
  if (!isPlainObject(root)) throw reject("a non-plain root", "$");
  const visiting = new WeakSet<object>();
  const clone = (value: unknown, path: string): unknown => {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw reject("a non-finite number", path);
      return value;
    }
    if (Array.isArray(value)) {
      if (visiting.has(value)) throw reject("a circular reference", path);
      visiting.add(value);
      const entries = value.map((entry, index) => clone(entry, path + "[" + String(index) + "]"));
      visiting.delete(value);
      return entries;
    }
    if (isPlainObject(value)) {
      if (visiting.has(value)) throw reject("a circular reference", path);
      visiting.add(value);
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        if (entry === undefined) continue;
        Object.defineProperty(out, key, {
          value: clone(entry, path + "." + key),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      visiting.delete(value);
      return out;
    }
    throw reject(describeRejected(value), path);
  };
  return clone(root, "$") as Record<string, unknown>;
}

/**
 * Gộp lớp ghi đè lên lớp thừa kế: object phẳng gộp đệ quy, mọi giá trị khác (kể cả mảng) thay cả lớp dưới.
 * Nhận: lớp dưới + lớp trên.
 * Trả: vật gộp mới (không sửa bên nào).
 */
export function mergeLayers(under: unknown, over: unknown): unknown {
  if (!isPlainObject(under) || !isPlainObject(over)) return over;
  const merged: Record<string, unknown> = { ...under };
  for (const [key, value] of Object.entries(over)) {
    Object.defineProperty(merged, key, {
      value: Object.hasOwn(merged, key) ? mergeLayers(merged[key], value) : value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return merged;
}

/**
 * Đọc một thành viên của object phẳng hoặc mảng; cờ own giới hạn ở thuộc tính riêng.
 * Nhận: vật chứa, tên thành viên, có tính thuộc tính kế thừa hay không.
 * Trả: thành viên, hoặc undefined khi vật không phải vật chứa hay thiếu thành viên.
 */
export function member(node: unknown, key: string, own = false): unknown {
  if (!(isPlainObject(node) || Array.isArray(node)) || (own && !Object.hasOwn(node, key))) return undefined;
  return Reflect.get(node, key);
}

/**
 * Phân giải lớp thừa kế đã nội suy bằng schema của runtime; giữ giá trị thô nếu trường bắt buộc chỉ đến từ profile.
 * Nhận: runtime plugin (nguồn schema) + giá trị thừa kế đã nội suy.
 * Trả: giá trị đã phân giải, hoặc chính lớp thừa kế khi schema từ chối.
 */
export function inheritedConfig(runtime: unknown, inherited: unknown): unknown {
  try {
    return resolveConfig(runtime as Parameters<typeof resolveConfig>[0], inherited);
  } catch (_error) {
    return inherited;
  }
}
