/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng `lib/types/output-json.js` (dòng 334–510 của bundle
 *      @deepseek-ai/dsh-ptc-runtime-node): kế toán byte của ĐẦU RA ngoài — đo một chuỗi/giá trị JSON
 *      mà KHÔNG dựng dạng đã escape (dừng ngay khi vượt trần), và cắt chuỗi theo BIÊN code point
 *      sao cho phần còn lại vẫn vừa trần byte của chuỗi JSON (kể cả hai dấu nháy).
 */

/** Kế toán tiền tố chuỗi JSON cho sổ đầu ra ngoài. @module @deepseek-ai/dsh-ptc-runtime-node/output-json */

/**
 * Giá trị JSON không mất mát — BẢN KHAI TỐI THIỂU CỤC BỘ của kiểu peer `PtcJsonValue` trong
 * `@deepseek-ai/dsh-ptc-runtime`. Peer chưa có trong workspace của ta (gói này không có
 * `node_modules` riêng) nên import thật là TS2307; khi port xong peer thì thay bằng
 * `import type { PtcJsonValue } from "@deepseek-ai/dsh-ptc-runtime";` và xoá khai báo này.
 */
type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

const intrinsicReflectApply = Reflect.apply;
const intrinsicArrayIsArray = Array.isArray;
const IntrinsicBuffer = Buffer;
const intrinsicBufferByteLength = Reflect.get(Buffer, "byteLength");
const intrinsicObjectCreate = Object.create;
const intrinsicObjectDefineProperty = Object.defineProperty;
const intrinsicObjectKeys = Object.keys;
const intrinsicString = String;
// Ba intrinsic dưới đây là hàm CHƯA buộc (receiver truyền qua `Reflect.apply`), nên kiểu của chúng
// không có tham số `text`. `codePointAt` được ép về `number`: lib chuẩn khai `number | undefined`
// cho chỉ số ngoài dải, còn ở đây chỉ số luôn < `text.length` nên giá trị thật luôn là `number`.
const intrinsicStringCharCodeAt = Reflect.get(String.prototype, "charCodeAt") as (index: number) => number;
const intrinsicStringCodePointAt = Reflect.get(String.prototype, "codePointAt") as (pos: number) => number;
const intrinsicStringSlice = Reflect.get(String.prototype, "slice") as (start?: number, end?: number) => string;

/** Dựng data descriptor không thể thừa hưởng accessor do model định nghĩa. */
function dataDescriptor(value: unknown): PropertyDescriptor {
  const descriptor: PropertyDescriptor = intrinsicObjectCreate(null);
  descriptor.value = value;
  return descriptor;
}

/** Định nghĩa một slot dữ liệu enumerable thường, không kèm descriptor mang nguyên mẫu. */
function defineEnumerableDataProperty(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = dataDescriptor(value);
  descriptor.enumerable = true;
  descriptor.configurable = true;
  descriptor.writable = true;
  intrinsicObjectDefineProperty(target, key, descriptor);
}

/** Độ dài byte UTF-8 qua intrinsic Node đã chộp ở cấp module. */
function byteLength(text: string): number {
  return intrinsicReflectApply(intrinsicBufferByteLength, IntrinsicBuffer, [text, "utf8"]);
}

/** Nối thêm mà KHÔNG hỏi `Array.prototype` (model có thể đã sửa nó). */
function append<T>(target: T[], value: T): void {
  defineEnumerableDataProperty(target, target.length, value);
}

/** Lấy phần tử cuối mà KHÔNG hỏi `Array.prototype` (model có thể đã sửa nó). */
function takeLast<T>(target: T[]): T | undefined {
  if (target.length === 0) return void 0;
  const index = target.length - 1;
  const value = target[index];
  intrinsicObjectDefineProperty(target, "length", dataDescriptor(index));
  return value;
}

/** Một ký tự của chuỗi, căn theo code point. */
function characterAt(text: string, index: number): string {
  return intrinsicReflectApply(intrinsicStringSlice, text, [index, index + (intrinsicReflectApply(intrinsicStringCodePointAt, text, [index]) > 65535 ? 2 : 1)]);
}

/** Số byte đã tuần tự hoá mà MỘT code point hoàn chỉnh đóng góp khi nằm trong dấu nháy JSON. */
function serializedCharacterBytes(character: string): number {
  if (character.length === 2) return 4;
  if (character === "\"" || character === "\\") return 2;
  const code = intrinsicReflectApply(intrinsicStringCharCodeAt, character, [0]);
  if (code >= 55296 && code <= 57343) return 6;
  if (code < 32) return code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6;
  return byteLength(character);
}

/**
 * Đo MỘT chuỗi JSON mà không dựng ra dạng đã escape đầy đủ của nó.
 *
 * Nhận: `text` — chuỗi ứng viên; `maxBytes` — cỡ tuần tự hoá lớn nhất người gọi nhận được.
 * Trả: số byte tuần tự hoá CHÍNH XÁC, hoặc `undefined` ngay khi vượt trần.
 */
export function jsonStringBytesUpTo(text: string, maxBytes: number): number | undefined {
  if (maxBytes < 2) return void 0;
  let bytes = 2;
  for (let index = 0; index < text.length;) {
    const character = characterAt(text, index);
    bytes += serializedCharacterBytes(character);
    if (bytes > maxBytes) return void 0;
    index += character.length;
  }
  return bytes;
}

/** Việc còn treo khi đo một giá trị: một giá trị, một mảng đang duyệt, hay một vật thể đang duyệt. */
type JsonMeasureTask =
  | { kind: "value"; value: PtcJsonValue }
  | { kind: "array"; value: PtcJsonValue[]; index: number }
  | { kind: "object"; value: { [key: string]: PtcJsonValue }; keys: string[]; index: number };

/**
 * Đo MỘT giá trị JSON không mất mát mà không cấp phát dạng đã tuần tự hoá của nó.
 *
 * Nhận: `value` — JSON không mất mát ĐÃ được kiểm; `maxBytes` — cỡ tuần tự hoá lớn nhất người gọi
 * nhận được.
 * Trả: số byte tuần tự hoá CHÍNH XÁC, hoặc `undefined` ngay khi vượt trần.
 */
export function jsonValueBytesUpTo(value: PtcJsonValue, maxBytes: number): number | undefined {
  let bytes = 0;
  const add = (cost: number): boolean => {
    bytes += cost;
    return bytes <= maxBytes;
  };
  const tasks: JsonMeasureTask[] = [{
    kind: "value",
    value
  }];
  for (let task = takeLast(tasks); task !== void 0; task = takeLast(tasks)) {
    if (task.kind === "value") {
      const current = task.value;
      if (current === null) {
        if (!add(4)) return void 0;
      } else if (typeof current === "string") {
        const stringBytes = jsonStringBytesUpTo(current, maxBytes - bytes);
        if (stringBytes === void 0) return void 0;
        bytes += stringBytes;
      } else if (typeof current === "number") {
        if (!add(byteLength(intrinsicString(current)))) return void 0;
      } else if (typeof current === "boolean") {
        if (!add(current ? 4 : 5)) return void 0;
      } else if (intrinsicArrayIsArray(current)) {
        const array = current as PtcJsonValue[];
        if (!add(2)) return void 0;
        if (array.length > 0) append(tasks, {
          kind: "array",
          value: array,
          index: 0
        });
      } else {
        const record = current as { [key: string]: PtcJsonValue };
        if (!add(2)) return void 0;
        const keys = intrinsicObjectKeys(record);
        if (keys.length > 0) append(tasks, {
          kind: "object",
          value: record,
          keys,
          index: 0
        });
      }
      continue;
    }
    if (task.index > 0 && !add(1)) return void 0;
    if (task.kind === "array") {
      const item = task.value[task.index];
      if (item === void 0) return void 0;
      if (task.index + 1 < task.value.length) append(tasks, {
        ...task,
        index: task.index + 1
      });
      append(tasks, {
        kind: "value",
        value: item
      });
      continue;
    }
    const key = task.keys[task.index];
    /* v8 ignore next -- khung vật thể chỉ được tạo và tiến cho một mục Object.keys có thật. */
    if (key === void 0) return void 0;
    const keyBytes = jsonStringBytesUpTo(key, maxBytes - bytes);
    if (keyBytes === void 0) return void 0;
    if (!add(keyBytes + 1)) return void 0;
    const item = task.value[key];
    if (item === void 0) return void 0;
    if (task.index + 1 < task.keys.length) append(tasks, {
      ...task,
      index: task.index + 1
    });
    append(tasks, {
      kind: "value",
      value: item
    });
  }
  return bytes;
}

/**
 * Trả tiền tố DÀI NHẤT căn theo code point mà phần mã hoá JSON của nó — kể cả hai dấu nháy bao
 * ngoài — vừa `maxBytes`.
 *
 * Nhận: `text` — chuỗi ứng viên; `maxBytes` — số byte chuỗi JSON còn dùng được.
 * Trả: tiền tố vừa trần, hoặc chuỗi rỗng khi ngay cả nội dung có ích cũng không vừa.
 */
export function truncateJsonStringBytes(text: string, maxBytes: number): string {
  if (maxBytes < 2) return "";
  let bytes = 2;
  let end = 0;
  for (let index = 0; index < text.length;) {
    const character = characterAt(text, index);
    const cost = serializedCharacterBytes(character);
    if (bytes + cost > maxBytes) break;
    bytes += cost;
    end += character.length;
    index += character.length;
  }
  return end === text.length ? text : intrinsicReflectApply(intrinsicStringSlice, text, [0, end]);
}
