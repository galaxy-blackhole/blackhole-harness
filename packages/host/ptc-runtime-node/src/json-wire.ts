/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng `lib/types/json-wire.js` (dòng 11–276 của bundle
 *      @deepseek-ai/dsh-ptc-runtime-node): wire JSON KHÔNG mất mát cho closure bootstrap không phụ
 *      thuộc — mã hoá một giá trị JSON thành dãy token phẳng (tiền tố) rồi dựng lại, CẢ HAI chiều
 *      đều LẶP nên độ sâu dữ liệu của chương trình không chạm ngăn xếp gọi hàm.
 */

/**
 * Ảnh chụp JSON không mất mát cho closure bootstrap không phụ thuộc.
 * @module @deepseek-ai/dsh-ptc-runtime-node/json-wire
 */

/**
 * Giá trị JSON không mất mát — BẢN KHAI TỐI THIỂU CỤC BỘ của kiểu peer `PtcJsonValue` trong
 * `@deepseek-ai/dsh-ptc-runtime`.
 * Vì sao KHÔNG import thật: peer ấy chưa có trong workspace của ta (gói `ptc-runtime-node` không
 * có `node_modules` riêng) nên import thật là TS2307. Khi port xong peer, thay bằng
 * `import type { PtcJsonValue } from "@deepseek-ai/dsh-ptc-runtime";` và xoá khai báo này.
 */
type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

const intrinsicFunctionToString = Reflect.get(Function.prototype, "toString");
const intrinsicReflectApply$1 = Reflect.get(Reflect, "apply");
const IntrinsicError = Error;
const IntrinsicSet = Set;
const intrinsicArrayIsArray$1 = Array.isArray;
const intrinsicArrayPrototype = Array.prototype;
const intrinsicNumberIsFinite = Number.isFinite;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const intrinsicObjectCreate$1 = Object.create;
const intrinsicObjectDefineProperty$1 = Object.defineProperty;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicObjectIs = Object.is;
const intrinsicObjectKeys$1 = Object.keys;
const intrinsicObjectPrototype = Object.prototype;
const intrinsicObjectPropertyIsEnumerable = Reflect.get(intrinsicObjectPrototype, "propertyIsEnumerable");
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicSetAdd = Reflect.get(Set.prototype, "add");
// Bản gốc còn một dòng trơ `Reflect.get(Set.prototype, "delete")` (bundler đã tree-shake hằng số,
// không nơi nào dùng tới): bản port bỏ hằng số ấy — không hành vi nào bị đổi.
const intrinsicSetHas = Reflect.get(Set.prototype, "has");

/** Dựng data descriptor không thể thừa hưởng accessor do model định nghĩa. */
function dataDescriptor$1(value: unknown): PropertyDescriptor {
  const descriptor: PropertyDescriptor = intrinsicObjectCreate$1(null);
  descriptor.value = value;
  return descriptor;
}

/** Định nghĩa một slot dữ liệu enumerable thường, không kèm descriptor mang nguyên mẫu. */
function defineEnumerableDataProperty$1(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = dataDescriptor$1(value);
  descriptor.enumerable = true;
  descriptor.configurable = true;
  descriptor.writable = true;
  intrinsicObjectDefineProperty$1(target, key, descriptor);
}

/** Nối thêm mà KHÔNG hỏi `Array.prototype` (model có thể đã sửa nó). */
function append$1<T>(target: T[], value: T): void {
  defineEnumerableDataProperty$1(target, target.length, value);
}

/** Lấy phần tử cuối mà KHÔNG hỏi `Array.prototype` (model có thể đã sửa nó). */
function takeLast$1<T>(target: T[]): T | undefined {
  if (target.length === 0) return void 0;
  const index = target.length - 1;
  const value = target[index];
  intrinsicObjectDefineProperty$1(target, "length", dataDescriptor$1(index));
  return value;
}

/** Một Set đã chộp intrinsic có chứa giá trị hay không. */
function setHas<T>(target: Set<T>, value: T): boolean {
  return intrinsicReflectApply$1(intrinsicSetHas, target, [value]);
}

/** Thêm vào một Set đã chộp intrinsic. */
function setAdd<T>(target: Set<T>, value: T): void {
  intrinsicReflectApply$1(intrinsicSetAdd, target, [value]);
}

/** Nguyên mẫu do realm sở hữu có được constructor gốc của nó chống lưng hay không. */
function hasIntrinsicConstructor(prototype: object, name: string): boolean {
  const constructor = intrinsicObjectGetOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && intrinsicReflectApply$1(intrinsicFunctionToString, constructor, []) === `function ${name}() { [native code] }`;
  } catch {
    return false;
  }
}

/** Ứng viên có phải `Object.prototype` intrinsic của MỘT realm khác hay không. */
function isForeignIntrinsicObjectPrototype(value: object): boolean {
  return intrinsicObjectGetPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}

/** Mảng có dùng `Array.prototype` intrinsic của một realm, không phải lớp con hay nguyên mẫu giả hay không. */
function hasPlainArrayPrototype(value: object): boolean {
  const prototype = intrinsicObjectGetPrototypeOf(value);
  if (prototype === intrinsicArrayPrototype) return true;
  if (!intrinsicArrayIsArray$1(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = intrinsicObjectGetPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isForeignIntrinsicObjectPrototype(objectPrototype);
}

/** Vật thể có phải bản ghi nguyên mẫu thường hoặc null-prototype của BẤT KỲ realm JS nào hay không. */
function hasPlainObjectPrototype(value: object): boolean {
  const prototype = intrinsicObjectGetPrototypeOf(value);
  return prototype === null || prototype === intrinsicObjectPrototype || typeof prototype === "object" && isForeignIntrinsicObjectPrototype(prototype);
}

/** Trả MỌI khoá hiển thị với JSON của vật thể, hoặc từ chối khoá riêng mà JSON sẽ nuốt mất. */
function enumerableStringKeys(value: object): string[] | undefined {
  const keys = intrinsicReflectOwnKeys(value);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (typeof key !== "string" || !intrinsicReflectApply$1(intrinsicObjectPropertyIsEnumerable, value, [key])) return void 0;
  }
  return keys as string[];
}

/** Đích gắn giá trị trong lúc dựng ảnh chụp: gốc, một ô mảng, hay một thuộc tính vật thể. */
type SnapshotDestination =
  | { kind: "root" }
  | { kind: "array"; target: PtcJsonValue[]; index: number }
  | { kind: "object"; target: { [key: string]: PtcJsonValue }; key: string };

/** Một việc còn treo của phép duyệt lặp: thăm nút, rời nút (gỡ khỏi tập tổ tiên), hoặc gắn con. */
type SnapshotTask =
  | { kind: "visit"; value: unknown; destination: SnapshotDestination | undefined }
  | { kind: "leave"; source: object }
  | { kind: "array-item"; source: unknown[]; index: number; target: PtcJsonValue[] | undefined }
  | { kind: "object-property"; source: Record<string, unknown>; key: string; target: { [key: string]: PtcJsonValue } | undefined };

/**
 * Kiểm và TÁCH RỜI một giá trị ở ranh giới tiến trình mà không nạp thêm package workspace nào lúc
 * chạy — bản gương dependency-free của ranh giới JSON chuẩn do phiên sở hữu (peer
 * `snapshotJsonValue` của `@deepseek-ai/dsh-util-values`), y hệt bản gốc khai trong
 * `lib/types/json-wire.d.ts`. Duyệt LẶP nên không thêm trần độ sâu ngăn xếp JS.
 *
 * Nhận: `value` — giá trị ứng viên ở ranh giới tiến trình.
 * Trả: ảnh chụp JSON không mất mát ĐÃ TÁCH RỜI, hoặc `undefined` khi giá trị không hợp lệ.
 */
export function snapshotPtcJsonValue(value: unknown): PtcJsonValue | undefined {
  const ancestors = new IntrinsicSet<object>();
  let root: PtcJsonValue | undefined;
  const assign = (destination: SnapshotDestination | undefined, item: PtcJsonValue): void => {
    if (destination === void 0) return;
    if (destination.kind === "root") root = item;
    else if (destination.kind === "array") destination.target[destination.index] = item;
    else defineEnumerableDataProperty$1(destination.target, destination.key, item);
  };
  const tasks: SnapshotTask[] = [{
    kind: "visit",
    value,
    destination: { kind: "root" }
  }];
  for (let task = takeLast$1(tasks); task !== void 0; task = takeLast$1(tasks)) {
    if (task.kind === "leave") {
      ancestors.delete(task.source);
      continue;
    }
    if (task.kind === "array-item") {
      if (!intrinsicObjectHasOwn(task.source, task.index)) return void 0;
      const destination: SnapshotDestination | undefined = task.target === void 0 ? void 0 : {
        kind: "array",
        target: task.target,
        index: task.index
      };
      append$1(tasks, {
        kind: "visit",
        value: task.source[task.index],
        destination
      });
      continue;
    }
    if (task.kind === "object-property") {
      const destination: SnapshotDestination | undefined = task.target === void 0 ? void 0 : {
        kind: "object",
        target: task.target,
        key: task.key
      };
      append$1(tasks, {
        kind: "visit",
        value: task.source[task.key],
        destination
      });
      continue;
    }
    const current = task.value;
    if (current === null) {
      assign(task.destination, null);
      continue;
    }
    if (typeof current === "boolean" || typeof current === "string") {
      assign(task.destination, current);
      continue;
    }
    if (typeof current === "number") {
      if (!intrinsicNumberIsFinite(current) || intrinsicObjectIs(current, -0)) return void 0;
      assign(task.destination, current);
      continue;
    }
    if (typeof current !== "object") return void 0;
    if (setHas(ancestors, current)) return void 0;
    if (intrinsicArrayIsArray$1(current)) {
      const source = current as unknown[];
      if (!hasPlainArrayPrototype(source)) return void 0;
      const length = source.length;
      if (intrinsicReflectOwnKeys(source).length !== length + 1) return void 0;
      const target: PtcJsonValue[] = [];
      assign(task.destination, target);
      setAdd(ancestors, current);
      append$1(tasks, {
        kind: "leave",
        source: source
      });
      for (let index = length - 1; index >= 0; index--) append$1(tasks, {
        kind: "array-item",
        source,
        index,
        target
      });
      continue;
    }
    if (!hasPlainObjectPrototype(current)) return void 0;
    const keys = enumerableStringKeys(current);
    if (keys === void 0) return void 0;
    const target: { [key: string]: PtcJsonValue } = {};
    assign(task.destination, target);
    setAdd(ancestors, current);
    append$1(tasks, {
      kind: "leave",
      source: current
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      /* v8 ignore next -- vòng lặp bị chặn bởi số khoá đã chộp. */
      if (key === void 0) return void 0;
      append$1(tasks, {
        kind: "object-property",
        source: current as Record<string, unknown>,
        key,
        target
      });
    }
  }
  return root;
}

/** Token đánh dấu MỘT mảng trên wire. */
interface ArrayWireToken {
  /** Loại token. */
  kind: "array";
  /** Độ dài mảng được mã hoá. */
  length: number;
}

/** Token đánh dấu MỘT vật thể trên wire. */
interface ObjectWireToken {
  /** Loại token. */
  kind: "object";
  /** Khoá của vật thể được mã hoá, ĐÚNG thứ tự. */
  keys: string[];
}

/** Một token của wire: lá vô hướng hoặc dấu đánh dấu container. */
type PtcJsonToken = null | boolean | number | string | ArrayWireToken | ObjectWireToken;

/**
 * Transport tiền tố, độ sâu BỊ CHẶN cho một giá trị JSON không mất mát. Dấu đánh dấu container và
 * lá vô hướng dùng CHUNG một mảng token phẳng, nên phép tuần tự hoá JSON không đệ quy theo độ sâu
 * lồng của dữ liệu ứng dụng.
 */
export type PtcJsonWire = PtcJsonToken[];

/**
 * Làm phẳng một giá trị JSON ĐÃ kiểm cho kênh điều khiển của tiến trình.
 *
 * Nhận: `value` — giá trị JSON không mất mát cần vận chuyển.
 * Trả: dãy token tiền tố mà độ lồng của chính nó bị chặn.
 */
export function encodePtcJsonWire(value: PtcJsonValue): PtcJsonWire {
  const wire: PtcJsonWire = [];
  const pending: PtcJsonValue[] = [value];
  for (let current = takeLast$1(pending); current !== void 0; current = takeLast$1(pending)) {
    if (current === null || typeof current === "boolean" || typeof current === "number" || typeof current === "string") {
      append$1(wire, current);
      continue;
    }
    if (intrinsicArrayIsArray$1(current)) {
      const source = current as PtcJsonValue[];
      append$1(wire, {
        kind: "array",
        length: source.length
      });
      for (let index = source.length - 1; index >= 0; index--) {
        const item = source[index];
        if (item === void 0) throw new IntrinsicError("cannot encode a sparse JSON array");
        append$1(pending, item);
      }
      continue;
    }
    const record = current as { [key: string]: PtcJsonValue };
    const keys = intrinsicObjectKeys$1(record);
    append$1(wire, {
      kind: "object",
      keys
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      /* v8 ignore next -- vòng lặp bị chặn bởi số khoá đã chộp. */
      if (key === void 0) throw new IntrinsicError("cannot encode a missing JSON object key");
      const item = record[key];
      if (item === void 0) throw new IntrinsicError("cannot encode an undefined JSON object property");
      append$1(pending, item);
    }
  }
  return wire;
}

/** Mảng có ĐÚNG các ô chỉ số dày đặc cộng `length` hay không. */
function isDenseArray(value: object): boolean {
  const array = value as unknown[];
  if (!hasPlainArrayPrototype(value) || intrinsicReflectOwnKeys(value).length !== array.length + 1) return false;
  for (let index = 0; index < array.length; index++) if (!intrinsicObjectHasOwn(value, index)) return false;
  return true;
}

/** Danh sách khoá chuỗi CHÍNH XÁC có chứa một khoá hay không, không hỏi nguyên mẫu của nó. */
function keysContain(keys: readonly string[], expected: string): boolean {
  for (let index = 0; index < keys.length; index++) if (keys[index] === expected) return true;
  return false;
}

/** Trả ĐÚNG một dấu đánh dấu container, hoặc từ chối mọi trường thừa/thiếu. */
function containerToken(value: unknown): ArrayWireToken | ObjectWireToken | undefined {
  if (intrinsicArrayIsArray$1(value) || !hasPlainObjectPrototype(value as object)) return void 0;
  const keys = enumerableStringKeys(value as object);
  if (keys === void 0) return void 0;
  const token = value as { kind?: unknown; length?: unknown; keys?: unknown };
  if (token.kind === "array") {
    if (keys.length !== 2 || !keysContain(keys, "kind") || !keysContain(keys, "length")) return void 0;
    const length = token.length;
    return typeof length === "number" && intrinsicNumberIsSafeInteger(length) && length >= 0 ? {
      kind: "array",
      length
    } : void 0;
  }
  if (token.kind === "object") {
    if (keys.length !== 2 || !keysContain(keys, "kind") || !keysContain(keys, "keys")) return void 0;
    const objectKeys = token.keys;
    if (!intrinsicArrayIsArray$1(objectKeys) || !isDenseArray(objectKeys as object)) return void 0;
    const unique = new IntrinsicSet<string>();
    const normalizedKeys: string[] = [];
    const objectKeyValues = objectKeys as unknown[];
    for (let index = 0; index < objectKeyValues.length; index++) {
      const key = objectKeyValues[index];
      if (typeof key !== "string" || setHas(unique, key)) return void 0;
      setAdd(unique, key);
      append$1(normalizedKeys, key);
    }
    return {
      kind: "object",
      keys: normalizedKeys
    };
  }
}

/** Khung dựng đang mở của một mảng trong phép giải mã. */
interface ArrayFrame {
  /** Loại khung. */
  kind: "array";
  /** Mảng đích đang được nhận phần tử. */
  target: PtcJsonValue[];
  /** Số phần tử khai báo. */
  length: number;
  /** Chỉ số phần tử kế tiếp. */
  index: number;
}

/** Khung dựng đang mở của một vật thể trong phép giải mã. */
interface ObjectFrame {
  /** Loại khung. */
  kind: "object";
  /** Vật thể đích đang được nhận thuộc tính. */
  target: { [key: string]: PtcJsonValue };
  /** Các khoá đã kiểm, ĐÚNG thứ tự. */
  keys: string[];
  /** Chỉ số khoá kế tiếp. */
  index: number;
}

/** Một khung dựng đang mở. */
type Frame = ArrayFrame | ObjectFrame;

/**
 * Dựng lại một giá trị JSON không mất mát từ wire phẳng của tiến trình. Traffic hỏng hoặc thiếu trả
 * `undefined`; phép duyệt LẶP nên độc lập với độ sâu ứng dụng của giá trị được vận chuyển.
 *
 * Nhận: `input` — payload message-port CHƯA được tin.
 * Trả: giá trị JSON đã tách rời, hoặc `undefined` khi wire không hợp lệ.
 */
export function decodePtcJsonWire(input: unknown): PtcJsonValue | undefined {
  try {
    if (!intrinsicArrayIsArray$1(input) || !isDenseArray(input as object) || (input as unknown[]).length === 0) return void 0;
    const wire = input as unknown[];
    const frames: Frame[] = [];
    let root: PtcJsonValue | undefined;
    let rootAssigned = false;
    const attach = (value: PtcJsonValue): boolean => {
      const parent = frames[frames.length - 1];
      if (!parent) {
        if (rootAssigned) return false;
        root = value;
        rootAssigned = true;
        return true;
      }
      /* v8 ignore next -- khung đã xong bị lấy ra trước khi token khác có thể gắn vào. */
      if (parent.index >= (parent.kind === "array" ? parent.length : parent.keys.length)) return false;
      if (parent.kind === "array") append$1(parent.target, value);
      else {
        const key = parent.keys[parent.index];
        /* v8 ignore next -- khung vật thể dựng từ khoá đã kiểm và đúng độ dài của chúng. */
        if (key === void 0) return false;
        defineEnumerableDataProperty$1(parent.target, key, value);
      }
      parent.index += 1;
      return true;
    };
    for (let tokenIndex = 0; tokenIndex < wire.length; tokenIndex++) {
      const token = wire[tokenIndex];
      let value: PtcJsonValue | undefined;
      let frame: Frame | undefined;
      if (token === null || typeof token === "boolean" || typeof token === "string") value = token;
      else if (typeof token === "number") {
        if (!intrinsicNumberIsFinite(token) || intrinsicObjectIs(token, -0)) return void 0;
        value = token;
      } else {
        if (typeof token !== "object") return void 0;
        const marker = containerToken(token);
        if (!marker) return void 0;
        const remainingTokens = wire.length - tokenIndex - 1;
        if (marker.kind === "array") {
          if (marker.length > remainingTokens) return void 0;
          const target: PtcJsonValue[] = [];
          value = target;
          if (marker.length > 0) frame = {
            kind: "array",
            target,
            length: marker.length,
            index: 0
          };
        } else {
          if (marker.keys.length > remainingTokens) return void 0;
          const target: { [key: string]: PtcJsonValue } = {};
          value = target;
          if (marker.keys.length > 0) frame = {
            kind: "object",
            target,
            keys: marker.keys,
            index: 0
          };
        }
      }
      // Mọi nhánh trên đều gán `value` hoặc đã return, nên khẳng định này không đổi hành vi.
      if (!attach(value as PtcJsonValue)) return void 0;
      if (frame) append$1(frames, frame);
      while (frames.length > 0) {
        const current = frames[frames.length - 1];
        /* v8 ignore next -- điều kiện vòng lặp bảo đảm còn một khung cuối. */
        if (current === void 0) break;
        if (current.index < (current.kind === "array" ? current.length : current.keys.length)) break;
        takeLast$1(frames);
      }
    }
    return frames.length === 0 ? root : void 0;
  } catch {
    return;
  }
}
