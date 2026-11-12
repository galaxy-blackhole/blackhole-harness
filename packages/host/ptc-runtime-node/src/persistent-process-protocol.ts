/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giao thức kênh điều khiển của PTC persistent (node): đo byte JSON, khung length-prefix có chặn, wire JSON phẳng và mở kênh kế thừa fd 7
 */
import { Buffer } from "node:buffer";
import { Socket } from "node:net";
import type { Duplex } from "node:stream";

/**
 * Một giá trị JSON không mất mát đi qua biên tiến trình — bản sao tối thiểu của kiểu peer
 * `@deepseek-ai/dsh-ptc-runtime` (workspace chưa cài peer này nên khai cục bộ).
 * Nhận: null · boolean · number hữu hạn (không phải -0) · string · mảng JSON · object thuần, đệ quy.
 * Trả: kiểu dùng chung cho mọi thông điệp của kênh điều khiển.
 */
export type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

//#region lib/types/output-json.js
/** Kế toán byte JSON cho sổ đầu ra ngoài cùng. @module @deepseek-ai/dsh-ptc-runtime-node/output-json */
const intrinsicReflectApply = Reflect.apply;
const intrinsicArrayIsArray = Array.isArray;
const IntrinsicBuffer = Buffer;
const intrinsicBufferByteLength = Reflect.get(Buffer, "byteLength");
const intrinsicObjectCreate = Object.create;
const intrinsicObjectDefineProperty = Object.defineProperty;
const intrinsicObjectKeys = Object.keys;
const intrinsicString = String;
const intrinsicStringCharCodeAt = Reflect.get(String.prototype, "charCodeAt");
const intrinsicStringCodePointAt = Reflect.get(String.prototype, "codePointAt");
const intrinsicStringSlice = Reflect.get(String.prototype, "slice");

/**
 * Dựng descriptor dữ liệu không thể thừa hưởng accessor do model định nghĩa.
 * Nhận: giá trị cần đặt vào slot.
 * Trả: descriptor chỉ có `value` (không prototype).
 */
function dataDescriptor(value: unknown): PropertyDescriptor {
  const descriptor: PropertyDescriptor = intrinsicObjectCreate(null);
  descriptor.value = value;
  return descriptor;
}

/**
 * Định nghĩa một slot dữ liệu enumerable thường, không qua descriptor mang prototype.
 * Nhận: vật chứa, tên thành viên, giá trị.
 * Trả: không (ghi thẳng vào vật chứa).
 */
function defineEnumerableDataProperty(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = dataDescriptor(value);
  descriptor.enumerable = true;
  descriptor.configurable = true;
  descriptor.writable = true;
  intrinsicObjectDefineProperty(target, key, descriptor);
}

/**
 * Nối phần tử mà không tra `Array.prototype` (model có thể đã sửa nó).
 * Nhận: mảng đích, giá trị cần nối.
 * Trả: không (mảng đích dài thêm một).
 */
function append<T>(target: T[], value: T): void {
  defineEnumerableDataProperty(target, target.length, value);
}

/**
 * Lấy phần tử cuối mà không tra `Array.prototype` (model có thể đã sửa nó).
 * Nhận: mảng nguồn (bị cắt một phần tử).
 * Trả: phần tử cuối, hoặc undefined khi mảng rỗng.
 */
function takeLast<T>(target: T[]): T | undefined {
  if (target.length === 0) return undefined;
  const index = target.length - 1;
  const value = target[index];
  intrinsicObjectDefineProperty(target, "length", dataDescriptor(index));
  return value;
}

/**
 * Một ký tự thẳng hàng code point của chuỗi.
 * Nhận: chuỗi nguồn, chỉ số bắt đầu.
 * Trả: ký tự (1 hoặc 2 đơn vị UTF-16).
 */
function characterAt(text: string, index: number): string {
  const code = intrinsicReflectApply(intrinsicStringCodePointAt, text, [index]) as number;
  return intrinsicReflectApply(intrinsicStringSlice, text, [index, index + (code > 65535 ? 2 : 1)]);
}

/**
 * Số byte đã tuần tự hoá của một code point nằm trong dấu nháy JSON.
 * Nhận: một ký tự (1–2 đơn vị UTF-16).
 * Trả: số byte JSON của ký tự đó.
 */
function serializedCharacterBytes(character: string): number {
  if (character.length === 2) return 4;
  if (character === '"' || character === "\\") return 2;
  const code = intrinsicReflectApply(intrinsicStringCharCodeAt, character, [0]);
  if (code >= 55296 && code <= 57343) return 6;
  if (code < 32) return code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6;
  return byteLength(character);
}

/**
 * UTF-8 byte length qua intrinsic Node đã giữ lại.
 * Nhận: chuỗi cần đo.
 * Trả: số byte UTF-8.
 */
function byteLength(text: string): number {
  return intrinsicReflectApply(intrinsicBufferByteLength, IntrinsicBuffer, [text, "utf8"]);
}

/**
 * Đo một chuỗi JSON mà không dựng hình dạng escape đầy đủ của nó.
 * Nhận: chuỗi ứng viên + số byte tối đa người gọi có thể nhận.
 * Trả: số byte tuần tự hoá chính xác, hoặc undefined ngay khi vượt trần.
 */
export function jsonStringBytesUpTo(text: string, maxBytes: number): number | undefined {
  if (maxBytes < 2) return undefined;
  let bytes = 2;
  for (let index = 0; index < text.length; ) {
    const character = characterAt(text, index);
    bytes += serializedCharacterBytes(character);
    if (bytes > maxBytes) return undefined;
    index += character.length;
  }
  return bytes;
}

/** Khung đo cho một giá trị JSON đang chờ cộng byte. */
interface ValueBytesTask {
  kind: "value";
  value: PtcJsonValue;
}
/** Khung đo cho mảng đang duyệt. */
interface ArrayBytesTask {
  kind: "array";
  value: PtcJsonValue[];
  index: number;
}
/** Khung đo cho object đang duyệt. */
interface ObjectBytesTask {
  kind: "object";
  value: { [key: string]: PtcJsonValue };
  keys: string[];
  index: number;
}

/** Một khung đo byte JSON. */
type BytesTask = ValueBytesTask | ArrayBytesTask | ObjectBytesTask;

/**
 * Đo một giá trị JSON không mất mát mà không cấp phát dạng tuần tự hoá của nó.
 * Nhận: giá trị đã qua kiểm tra lossless JSON + trần byte người gọi có thể nhận.
 * Trả: số byte tuần tự hoá chính xác, hoặc undefined ngay khi vượt trần.
 */
export function jsonValueBytesUpTo(value: PtcJsonValue, maxBytes: number): number | undefined {
  let bytes = 0;
  const add = (cost: number): boolean => {
    bytes += cost;
    return bytes <= maxBytes;
  };
  const tasks: BytesTask[] = [{ kind: "value", value }];
  for (let task = takeLast(tasks); task !== undefined; task = takeLast(tasks)) {
    if (task.kind === "value") {
      const current = task.value;
      if (current === null) {
        if (!add(4)) return undefined;
      } else if (typeof current === "string") {
        const stringBytes = jsonStringBytesUpTo(current, maxBytes - bytes);
        if (stringBytes === undefined) return undefined;
        bytes += stringBytes;
      } else if (typeof current === "number") {
        if (!add(byteLength(intrinsicString(current)))) return undefined;
      } else if (typeof current === "boolean") {
        if (!add(current ? 4 : 5)) return undefined;
      } else if (intrinsicArrayIsArray(current)) {
        if (!add(2)) return undefined;
        if (current.length > 0) append(tasks, { kind: "array", value: current, index: 0 });
      } else {
        if (!add(2)) return undefined;
        const keys: string[] = intrinsicObjectKeys(current);
        if (keys.length > 0) append(tasks, { kind: "object", value: current, keys, index: 0 });
      }
      continue;
    }
    if (task.index > 0 && !add(1)) return undefined;
    if (task.kind === "array") {
      const item = task.value[task.index];
      if (item === undefined) return undefined;
      if (task.index + 1 < task.value.length) append(tasks, { ...task, index: task.index + 1 });
      append(tasks, { kind: "value", value: item });
      continue;
    }
    const key = task.keys[task.index];
    /* v8 ignore next -- khung object chỉ được tạo và tiến theo mục Object.keys có thật. */
    if (key === undefined) return undefined;
    const keyBytes = jsonStringBytesUpTo(key, maxBytes - bytes);
    if (keyBytes === undefined) return undefined;
    if (!add(keyBytes + 1)) return undefined;
    const item = task.value[key];
    if (item === undefined) return undefined;
    if (task.index + 1 < task.keys.length) append(tasks, { ...task, index: task.index + 1 });
    append(tasks, { kind: "value", value: item });
  }
  return bytes;
}

/**
 * Trả tiền tố dài nhất thẳng hàng code point mà mã JSON của nó (kể cả hai dấu nháy) vừa `maxBytes`.
 * Nhận: chuỗi ứng viên + số byte JSON-string còn dùng được.
 * Trả: tiền tố vừa trần, hoặc chuỗi rỗng khi không đủ chỗ cho nội dung có nghĩa.
 */
export function truncateJsonStringBytes(text: string, maxBytes: number): string {
  if (maxBytes < 2) return "";
  let bytes = 2;
  let end = 0;
  for (let index = 0; index < text.length; ) {
    const character = characterAt(text, index);
    const cost = serializedCharacterBytes(character);
    if (bytes + cost > maxBytes) break;
    bytes += cost;
    end += character.length;
    index += character.length;
  }
  return end === text.length ? text : intrinsicReflectApply(intrinsicStringSlice, text, [0, end]);
}
//#endregion
//#region lib/types/channel.js
/** Vận chuyển JSON có tiền tố độ dài, đầu vào bị chặn và ghi xếp hàng. */
const stringify = JSON.stringify;
const parse = JSON.parse;

/** Một lượt ghi đã nhận vào sổ chờ của kênh. */
interface WriteTicket {
  promise: Promise<void>;
  finish(error?: Error): void;
}

/**
 * Một kênh tiến trình đi kèm; người dùng kênh tự kiểm khung và quyết định kết cục cuối.
 * Nhận: luồng duplex, trần byte khung, hàm nhận thông điệp, hàm báo lỗi.
 * Trả: thể hiện kênh đã gắn listener lên luồng.
 */
export class JsonChannel {
  private readonly stream: Duplex;
  private readonly maxBytes: number;
  private readonly receive: (message: unknown, bytes: number) => void;
  private readonly failure: (error: Error, kind: "io" | "protocol") => void;
  private readonly header = Buffer.alloc(4);
  private headerBytes = 0;
  private payload: Buffer | undefined;
  private payloadBytes = 0;
  private queuedBytes = 0;
  private closed = false;
  private readonly writes = new Set<WriteTicket>();

  private readonly onError = (error: Error): void => {
    this.finishWrites(error);
    if (!this.closed) this.failure(error, "io");
  };

  private readonly onClose = (): void => {
    this.finishWrites(new Error("control channel closed during a write"));
  };

  private readonly onEnd = (): void => {
    if (!this.closed) this.failure(new Error("control channel ended before the program settled"), "io");
  };

  private readonly onData = (chunk: Buffer): void => {
    if (this.closed) return;
    try {
      let offset = 0;
      while (offset < chunk.length && !this.closed) {
        if (this.payload === undefined) {
          const bytes = Math.min(4 - this.headerBytes, chunk.length - offset);
          chunk.copy(this.header, this.headerBytes, offset, offset + bytes);
          this.headerBytes += bytes;
          offset += bytes;
          if (this.headerBytes !== 4) continue;
          const length = this.header.readUInt32BE(0);
          if (length === 0 || length > this.maxBytes) throw new Error(`control frame exceeds ${this.maxBytes} bytes or is empty`);
          this.payload = Buffer.allocUnsafe(length);
          this.payloadBytes = 0;
          this.headerBytes = 0;
        }
        const payload = this.payload;
        const bytes = Math.min(payload.length - this.payloadBytes, chunk.length - offset);
        chunk.copy(payload, this.payloadBytes, offset, offset + bytes);
        this.payloadBytes += bytes;
        offset += bytes;
        if (this.payloadBytes !== payload.length) continue;
        this.payload = undefined;
        this.payloadBytes = 0;
        this.receive(parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)), payload.length);
      }
    } catch (error) {
      this.failure(error instanceof Error ? error : new Error(String(error)), "protocol");
    }
  };

  /**
   * Gắn kênh vào luồng: đọc khung vào, ghi khung ra.
   * Nhận: luồng duplex, trần byte khung (và byte xếp hàng), hàm nhận, hàm báo lỗi.
   * Trả: không (listener đã gắn).
   */
  constructor(
    stream: Duplex,
    maxBytes: number,
    receive: (message: unknown, bytes: number) => void,
    failure: (error: Error, kind: "io" | "protocol") => void,
  ) {
    this.stream = stream;
    this.maxBytes = maxBytes;
    this.receive = receive;
    this.failure = failure;
    stream.on("data", this.onData);
    stream.on("error", this.onError);
    stream.on("end", this.onEnd);
    stream.on("close", this.onClose);
  }

  /**
   * Gửi ngay một khung bị chặn và chờ biên nhận ghi của luồng.
   * Nhận: thông điệp giao thức chỉ gồm JSON.
   * Trả: Promise xong khi khung đã ghi, hoặc lỗi khi vận chuyển hỏng.
   */
  send(message: unknown): Promise<void> {
    if (this.closed) return Promise.reject(new Error("control channel is closed"));
    const size = jsonValueBytesUpTo(message as PtcJsonValue, this.maxBytes);
    if (size === undefined || this.queuedBytes + size > this.maxBytes) {
      return Promise.reject(new Error(`control output exceeds ${this.maxBytes} queued bytes`));
    }
    const body = Buffer.from(stringify(message), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length);
    this.queuedBytes += body.length;
    const completion = Promise.withResolvers<void>();
    const write: WriteTicket = {
      promise: completion.promise,
      finish: (error?: Error): void => {
        if (!this.writes.delete(write)) return;
        this.queuedBytes -= body.length;
        if (error) completion.reject(error);
        else completion.resolve(undefined);
      },
    };
    this.writes.add(write);
    try {
      this.stream.cork();
      this.stream.write(header);
      this.stream.write(body, (error) => {
        write.finish(error ?? undefined);
      });
      this.stream.uncork();
    } catch (error) {
      write.finish(error instanceof Error ? error : new Error(String(error)));
    }
    return completion.promise;
  }

  private finishWrites(error: Error): void {
    for (const write of this.writes) write.finish(error);
  }

  /**
   * Ngừng đọc và đóng đầu mút sở hữu; các lượt ghi đang chờ bị từ chối khi đóng.
   * Nhận: không.
   * Trả: không.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.payload = undefined;
    this.finishWrites(new Error("control channel is closed"));
    this.stream.off("data", this.onData);
    this.stream.off("end", this.onEnd);
    this.stream.destroy();
  }

  /**
   * Chờ mọi lượt ghi đã nhận xong hoặc hỏng.
   * Nhận: không.
   * Trả: Promise hoàn tất khi mọi lượt ghi đã kết thúc.
   */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.writes].map((write) => write.promise));
  }
}
//#endregion
//#region lib/types/json-wire.js
/**
 * Ảnh chụp lossless JSON cho closure bootstrap không phụ thuộc.
 * @module @deepseek-ai/dsh-ptc-runtime-node/json-wire
 */
const intrinsicFunctionToString = Reflect.get(Function.prototype, "toString");
const intrinsicReflectApplyWire = Reflect.get(Reflect, "apply");
const IntrinsicError = Error;
const IntrinsicSet = Set;
const intrinsicArrayIsArrayWire = Array.isArray;
const intrinsicArrayPrototype = Array.prototype;
const intrinsicNumberIsFinite = Number.isFinite;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const intrinsicObjectCreateWire = Object.create;
const intrinsicObjectDefinePropertyWire = Object.defineProperty;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicObjectIs = Object.is;
const intrinsicObjectKeysWire = Object.keys;
const intrinsicObjectPrototype = Object.prototype;
const intrinsicObjectPropertyIsEnumerable = Reflect.get(intrinsicObjectPrototype, "propertyIsEnumerable");
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicSetAdd = Reflect.get(Set.prototype, "add");
const intrinsicSetDelete = Reflect.get(Set.prototype, "delete");
const intrinsicSetHas = Reflect.get(Set.prototype, "has");

/**
 * Dựng descriptor dữ liệu không thể thừa hưởng accessor do model định nghĩa.
 * Nhận: giá trị cần đặt vào slot.
 * Trả: descriptor chỉ có `value` (không prototype).
 */
function dataDescriptorWire(value: unknown): PropertyDescriptor {
  const descriptor: PropertyDescriptor = intrinsicObjectCreateWire(null);
  descriptor.value = value;
  return descriptor;
}

/**
 * Định nghĩa một slot dữ liệu enumerable thường, không qua descriptor mang prototype.
 * Nhận: vật chứa, tên thành viên, giá trị.
 * Trả: không (ghi thẳng vào vật chứa).
 */
function defineEnumerableDataPropertyWire(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = dataDescriptorWire(value);
  descriptor.enumerable = true;
  descriptor.configurable = true;
  descriptor.writable = true;
  intrinsicObjectDefinePropertyWire(target, key, descriptor);
}

/**
 * Nối phần tử mà không tra `Array.prototype`.
 * Nhận: mảng đích, giá trị cần nối.
 * Trả: không (mảng đích dài thêm một).
 */
function appendWire<T>(target: T[], value: T): void {
  defineEnumerableDataPropertyWire(target, target.length, value);
}

/**
 * Lấy phần tử cuối mà không tra `Array.prototype`.
 * Nhận: mảng nguồn (bị cắt một phần tử).
 * Trả: phần tử cuối, hoặc undefined khi mảng rỗng.
 */
function takeLastWire<T>(target: T[]): T | undefined {
  if (target.length === 0) return undefined;
  const index = target.length - 1;
  const value = target[index];
  intrinsicObjectDefinePropertyWire(target, "length", dataDescriptorWire(index));
  return value;
}

/**
 * Kiểm một Set intrinsic đã giữ lại có chứa giá trị không.
 * Nhận: Set đích, giá trị cần tra.
 * Trả: true khi có.
 */
function setHas<T>(target: Set<T>, value: T): boolean {
  return intrinsicReflectApplyWire(intrinsicSetHas, target, [value]);
}

/**
 * Thêm vào một Set intrinsic đã giữ lại.
 * Nhận: Set đích, giá trị cần thêm.
 * Trả: không.
 */
function setAdd<T>(target: Set<T>, value: T): void {
  intrinsicReflectApplyWire(intrinsicSetAdd, target, [value]);
}

/**
 * Xoá khỏi một Set intrinsic đã giữ lại.
 * Nhận: Set đích, giá trị cần xoá.
 * Trả: không.
 */
function setDelete<T>(target: Set<T>, value: T): void {
  intrinsicReflectApplyWire(intrinsicSetDelete, target, [value]);
}

/**
 * Kiểm một prototype intrinsic của realm có đúng do constructor gốc của nó dựng không.
 * Nhận: prototype cần kiểm, tên constructor gốc.
 * Trả: true khi `constructor.name`, `constructor.prototype` và mã nguồn gốc đều khớp.
 */
function hasIntrinsicConstructor(prototype: object, name: string): boolean {
  const constructor = intrinsicObjectGetOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return (
      constructor.name === name &&
      constructor.prototype === prototype &&
      intrinsicReflectApplyWire(intrinsicFunctionToString, constructor, []) === `function ${name}() { [native code] }`
    );
  } catch {
    return false;
  }
}

/**
 * Kiểm một ứng viên có phải `Object.prototype` intrinsic của realm khác không.
 * Nhận: giá trị ứng viên.
 * Trả: true khi prototype rỗng và constructor gốc là `Object`.
 */
function isForeignIntrinsicObjectPrototype(value: object): boolean {
  return intrinsicObjectGetPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}

/**
 * Kiểm một mảng dùng `Array.prototype` intrinsic của một realm, không phải lớp con hay prototype giả.
 * Nhận: giá trị ứng viên.
 * Trả: true khi prototype là intrinsic thật của realm hiện tại hoặc realm khác.
 */
function hasPlainArrayPrototype(value: unknown): boolean {
  const prototype = intrinsicObjectGetPrototypeOf(value);
  if (prototype === intrinsicArrayPrototype) return true;
  if (!intrinsicArrayIsArrayWire(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = intrinsicObjectGetPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isForeignIntrinsicObjectPrototype(objectPrototype);
}

/**
 * Kiểm một giá trị là bản ghi prototype thường hoặc null-prototype của bất kỳ realm nào.
 * Nhận: giá trị ứng viên.
 * Trả: true khi prototype là null, `Object.prototype` hiện tại, hoặc intrinsic của realm khác.
 */
function hasPlainObjectPrototype(value: unknown): value is { [key: string]: unknown } {
  const prototype = intrinsicObjectGetPrototypeOf(value);
  return (
    prototype === null ||
    prototype === intrinsicObjectPrototype ||
    (typeof prototype === "object" && isForeignIntrinsicObjectPrototype(prototype))
  );
}

/**
 * Trả mọi khoá object nhìn thấy được bởi JSON, hoặc từ chối khoá riêng mà JSON sẽ bỏ.
 * Nhận: object cần lấy khoá.
 * Trả: danh sách khoá chuỗi, hoặc undefined khi có khoá không enumerable / không phải chuỗi.
 */
function enumerableStringKeys(value: object): string[] | undefined {
  const keys: PropertyKey[] = intrinsicReflectOwnKeys(value);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (typeof key !== "string" || !intrinsicReflectApplyWire(intrinsicObjectPropertyIsEnumerable, value, [key])) {
      return undefined;
    }
  }
  return keys as string[];
}

/** Đích gán của một giá trị trong ảnh chụp. */
type SnapshotDestination =
  | { kind: "root" }
  | { kind: "array"; target: PtcJsonValue[]; index: number }
  | { kind: "object"; target: { [key: string]: PtcJsonValue }; key: string };

/** Khung duyệt một giá trị ứng viên. */
interface VisitTask {
  kind: "visit";
  value: unknown;
  destination: SnapshotDestination;
}

/** Khung rời một object đã duyệt xong (bỏ dấu chu trình). */
interface LeaveTask {
  kind: "leave";
  source: object;
}

/** Khung duyệt một phần tử mảng. */
interface ArrayItemTask {
  kind: "array-item";
  source: readonly unknown[];
  index: number;
  target: PtcJsonValue[];
}

/** Khung duyệt một thuộc tính object. */
interface ObjectPropertyTask {
  kind: "object-property";
  source: { [key: string]: unknown };
  key: string;
  target: { [key: string]: PtcJsonValue };
}

/** Một khung duyệt của ảnh chụp. */
type SnapshotTask = VisitTask | LeaveTask | ArrayItemTask | ObjectPropertyTask;

/**
 * Kiểm và tách một giá trị ở biên tiến trình mà không nạp package workspace khác lúc chạy.
 * Bản này phản chiếu biên JSON chuẩn của session nhưng vẫn an toàn khi import từ bootstrap chưa build;
 * duyệt lặp nên không thêm giới hạn độ sâu call-stack.
 * Nhận: giá trị ứng viên (giá trị hoàn tất của chương trình).
 * Trả: ảnh chụp lossless JSON đã tách rời, hoặc undefined khi không hợp lệ.
 */
export function snapshotPtcJsonValue(value: unknown): PtcJsonValue | undefined {
  const active = new IntrinsicSet();
  let root: PtcJsonValue | undefined;
  const assign = (destination: SnapshotDestination, item: PtcJsonValue): void => {
    if (destination.kind === "root") root = item;
    else if (destination.kind === "array") defineEnumerableDataPropertyWire(destination.target, destination.index, item);
    else defineEnumerableDataPropertyWire(destination.target, destination.key, item);
  };
  const tasks: SnapshotTask[] = [{ kind: "visit", value, destination: { kind: "root" } }];
  for (let task = takeLastWire(tasks); task !== undefined; task = takeLastWire(tasks)) {
    if (task.kind === "leave") {
      setDelete(active, task.source);
      continue;
    }
    if (task.kind === "array-item") {
      if (!intrinsicObjectHasOwn(task.source, task.index)) return undefined;
      appendWire(tasks, {
        kind: "visit",
        value: task.source[task.index],
        destination: { kind: "array", target: task.target, index: task.index },
      });
      continue;
    }
    if (task.kind === "object-property") {
      appendWire(tasks, {
        kind: "visit",
        value: task.source[task.key],
        destination: { kind: "object", target: task.target, key: task.key },
      });
      continue;
    }
    const candidate = task.value;
    if (candidate === null) {
      assign(task.destination, null);
      continue;
    }
    if (typeof candidate === "boolean" || typeof candidate === "string") {
      assign(task.destination, candidate);
      continue;
    }
    if (typeof candidate === "number") {
      if (!intrinsicNumberIsFinite(candidate) || intrinsicObjectIs(candidate, -0)) return undefined;
      assign(task.destination, candidate);
      continue;
    }
    if (typeof candidate !== "object") return undefined;
    if (setHas(active, candidate)) return undefined;
    if (intrinsicArrayIsArrayWire(candidate)) {
      if (!hasPlainArrayPrototype(candidate)) return undefined;
      const length = candidate.length;
      if (intrinsicReflectOwnKeys(candidate).length !== length + 1) return undefined;
      const target: PtcJsonValue[] = [];
      assign(task.destination, target);
      setAdd(active, candidate);
      appendWire(tasks, { kind: "leave", source: candidate });
      for (let index = length - 1; index >= 0; index--) {
        appendWire(tasks, { kind: "array-item", source: candidate, index, target });
      }
      continue;
    }
    if (!hasPlainObjectPrototype(candidate)) return undefined;
    const keys = enumerableStringKeys(candidate);
    if (keys === undefined) return undefined;
    const target: { [key: string]: PtcJsonValue } = {};
    assign(task.destination, target);
    setAdd(active, candidate);
    appendWire(tasks, { kind: "leave", source: candidate });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      /* v8 ignore next -- vòng lặp bị chặn bởi số khoá đã giữ. */
      if (key === undefined) return undefined;
      appendWire(tasks, { kind: "object-property", source: candidate, key, target });
    }
  }
  return root;
}

/** Một token container của wire JSON phẳng. */
interface ArrayWireToken {
  kind: "array";
  length: number;
}

/** Một token container object của wire JSON phẳng. */
interface ObjectWireToken {
  kind: "object";
  keys: string[];
}

/** Một token của wire JSON phẳng. */
type PtcJsonToken = null | boolean | number | string | ArrayWireToken | ObjectWireToken;

/**
 * Vận chuyển pre-order, độ sâu bị chặn, cho một giá trị lossless JSON. Token container và token
 * lá nằm chung một mảng phẳng nên tuần tự hoá JSON không đệ quy theo độ sâu ứng dụng.
 * Nhận: danh sách token theo thứ tự trước–sau.
 * Trả: kiểu wire dùng chung cho cả hai phía kênh.
 */
export type PtcJsonWire = PtcJsonToken[];

/**
 * Làm phẳng một giá trị JSON đã kiểm cho kênh điều khiển tiến trình.
 * Nhận: giá trị lossless JSON cần vận chuyển.
 * Trả: dòng token pre-order có độ lồng tự chặn.
 */
export function encodePtcJsonWire(value: PtcJsonValue): PtcJsonWire {
  const wire: PtcJsonWire = [];
  const pending: PtcJsonValue[] = [value];
  for (let current = takeLastWire(pending); current !== undefined; current = takeLastWire(pending)) {
    if (current === null || typeof current === "boolean" || typeof current === "number" || typeof current === "string") {
      appendWire(wire, current);
      continue;
    }
    if (intrinsicArrayIsArrayWire(current)) {
      appendWire(wire, { kind: "array", length: current.length });
      for (let index = current.length - 1; index >= 0; index--) {
        const item = current[index];
        if (item === undefined) throw new IntrinsicError("cannot encode a sparse JSON array");
        appendWire(pending, item);
      }
      continue;
    }
    const keys: string[] = intrinsicObjectKeysWire(current);
    appendWire(wire, { kind: "object", keys });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      /* v8 ignore next -- vòng lặp bị chặn bởi số khoá đã giữ. */
      if (key === undefined) throw new IntrinsicError("cannot encode a missing JSON object key");
      const item = current[key];
      if (item === undefined) throw new IntrinsicError("cannot encode an undefined JSON object property");
      appendWire(pending, item);
    }
  }
  return wire;
}

/** Kiểm một mảng có đúng các slot chỉ số đặc và `length` không. */
function isDenseArray(value: unknown): boolean {
  if (!hasPlainArrayPrototype(value)) return false;
  const array = value as unknown[];
  if (intrinsicReflectOwnKeys(array).length !== array.length + 1) return false;
  for (let index = 0; index < array.length; index++) if (!intrinsicObjectHasOwn(array, index)) return false;
  return true;
}

/** Kiểm một danh sách khoá chuỗi chính xác có chứa khoá cần tìm, không tra prototype. */
function keysContain(keys: string[], expected: string): boolean {
  for (let index = 0; index < keys.length; index++) if (keys[index] === expected) return true;
  return false;
}

/** Token container đã chuẩn hoá. */
type ContainerToken = { kind: "array"; length: number } | { kind: "object"; keys: string[] };

/** Trả một token container chính xác, hoặc từ chối mọi trường thừa/thiếu. */
function containerToken(value: unknown): ContainerToken | undefined {
  if (intrinsicArrayIsArrayWire(value)) return undefined;
  if (!hasPlainObjectPrototype(value)) return undefined;
  const keys = enumerableStringKeys(value);
  if (keys === undefined) return undefined;
  const token = value;
  if (token.kind === "array") {
    if (keys.length !== 2 || !keysContain(keys, "kind") || !keysContain(keys, "length")) return undefined;
    const length = token.length;
    return typeof length === "number" && intrinsicNumberIsSafeInteger(length) && length >= 0
      ? { kind: "array", length }
      : undefined;
  }
  if (token.kind === "object") {
    if (keys.length !== 2 || !keysContain(keys, "kind") || !keysContain(keys, "keys")) return undefined;
    const objectKeys = token.keys;
    if (!intrinsicArrayIsArrayWire(objectKeys) || !isDenseArray(objectKeys)) return undefined;
    const unique = new IntrinsicSet();
    const normalizedKeys: string[] = [];
    const objectKeyValues = objectKeys;
    for (let index = 0; index < objectKeyValues.length; index++) {
      const key = objectKeyValues[index];
      if (typeof key !== "string" || setHas(unique, key)) return undefined;
      setAdd(unique, key);
      appendWire(normalizedKeys, key);
    }
    return { kind: "object", keys: normalizedKeys };
  }
  return undefined;
}

/** Khung dựng mảng khi giải wire. */
interface ArrayDecodeFrame {
  kind: "array";
  target: PtcJsonValue[];
  length: number;
  index: number;
}

/** Khung dựng object khi giải wire. */
interface ObjectDecodeFrame {
  kind: "object";
  target: { [key: string]: PtcJsonValue };
  keys: string[];
  index: number;
}

/** Một khung dựng của bộ giải wire. */
type DecodeFrame = ArrayDecodeFrame | ObjectDecodeFrame;

/**
 * Dựng lại một giá trị lossless JSON từ dạng wire phẳng của tiến trình.
 * Giao thông hỏng hoặc thiếu trả undefined; duyệt lặp nên không phụ thuộc độ sâu ứng dụng.
 * Nhận: payload cổng thông điệp chưa tin cậy.
 * Trả: giá trị JSON đã tách rời, hoặc undefined khi wire không hợp lệ.
 */
export function decodePtcJsonWire(input: unknown): PtcJsonValue | undefined {
  try {
    if (!intrinsicArrayIsArrayWire(input) || !isDenseArray(input) || input.length === 0) return undefined;
    const wire = input as unknown[];
    const frames: DecodeFrame[] = [];
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
      /* v8 ignore next -- khung đã xong bị lấy ra trước khi token khác gắn vào. */
      if (parent.index >= (parent.kind === "array" ? parent.length : parent.keys.length)) return false;
      if (parent.kind === "array") appendWire(parent.target, value);
      else {
        const key = parent.keys[parent.index];
        /* v8 ignore next -- khung object dựng từ khoá đã kiểm và đúng độ dài. */
        if (key === undefined) return false;
        defineEnumerableDataPropertyWire(parent.target, key, value);
      }
      parent.index += 1;
      return true;
    };
    for (let tokenIndex = 0; tokenIndex < wire.length; tokenIndex++) {
      const token = wire[tokenIndex];
      let value: PtcJsonValue;
      let frame: DecodeFrame | undefined;
      if (token === null || typeof token === "boolean" || typeof token === "string") value = token;
      else if (typeof token === "number") {
        if (!intrinsicNumberIsFinite(token) || intrinsicObjectIs(token, -0)) return undefined;
        value = token;
      } else {
        if (typeof token !== "object") return undefined;
        const marker = containerToken(token);
        if (!marker) return undefined;
        const remainingTokens = wire.length - tokenIndex - 1;
        if (marker.kind === "array") {
          if (marker.length > remainingTokens) return undefined;
          const target: PtcJsonValue[] = [];
          value = target;
          if (marker.length > 0) frame = { kind: "array", target, length: marker.length, index: 0 };
        } else {
          if (marker.keys.length > remainingTokens) return undefined;
          const target: { [key: string]: PtcJsonValue } = {};
          value = target;
          if (marker.keys.length > 0) frame = { kind: "object", target, keys: marker.keys, index: 0 };
        }
      }
      if (!attach(value)) return undefined;
      if (frame) appendWire(frames, frame);
      while (frames.length > 0) {
        const current = frames[frames.length - 1];
        /* v8 ignore next -- điều kiện vòng lặp bảo đảm còn khung cuối. */
        if (current === undefined) break;
        if (current.index < (current.kind === "array" ? current.length : current.keys.length)) break;
        takeLastWire(frames);
      }
    }
    return frames.length === 0 ? root : undefined;
  } catch {
    return undefined;
  }
}
//#endregion
//#region lib/types/protocol.js
/**
 * Từ vựng thông điệp JSON đi trên kênh tiến trình bị chặn. Host kiểm mọi thông điệp vì mã model
 * có thể ghi thẳng vào descriptor kế thừa.
 * @module @deepseek-ai/dsh-ptc-runtime-node/protocol
 */

/** Dữ liệu host trao cho chương trình lúc spawn, sau bắt tay sẵn sàng. Nhận: code · namespaces · maxOutputBytes. Trả: kiểu payload boot. */
export interface ProgramBootData {
  /** Thân chương trình đã bỏ kiểu (JS thuần). */
  code: string;
  /** Namespace binding cần dựng; bản thân hàm ở lại phía host. */
  namespaces: {
    global: string;
    names: string[];
    errorClass?: {
      name: string;
      memberNameProperty: string;
    };
  }[];
  /** Trần cứng cho tổng log ngoài cùng đã tuần tự hoá cộng giá trị hoàn tất hoặc chẩn đoán lỗi. */
  maxOutputBytes: number;
}

/** Chương trình → host: một lượt gọi binding đã bắc cầu. */
interface CallMessage {
  type: "call";
  /** Id tương quan do chương trình phát; host trả lời mỗi id tối đa một lần và bỏ qua bản trùng. */
  id: number;
  /** Namespace global mà lượt gọi nhắm tới. */
  global: string;
  /** Tên hàm trong namespace. */
  name: string;
  /** Tham số duy nhất dưới dạng wire lossless-JSON phẳng. */
  args: PtcJsonWire;
}

/** Chương trình → host: văn bản đã bắt, phát ngay để sống sót khi lượt chạy bị cắt giữa đường. */
interface LogMessage {
  type: "log";
  text: string;
}

/** Chương trình → host: phần bắt hoặc phần đo hoàn tất phía chương trình vượt trần ngoài cùng. */
interface OutputLimitMessage {
  type: "output-limit";
}

/**
 * Chương trình → host: chương trình đã kết thúc. `error` mang ngoại lệ chương trình, giá trị hoàn tất
 * không hợp lệ, hoặc tràn đầu ra (ngân sách, abort và cái chết của substrate do host quan sát).
 * `value` chỉ có khi hoàn tất sạch và có giá trị, dưới dạng wire phẳng đã lossless và đã nhận theo
 * trần tổng còn lại. Log KHÔNG nằm ở đây — chúng đã phát ngay dưới dạng {@link LogMessage}.
 * Nhận: value? (wire lossless) và error? (kind + message). Trả: kiểu thông điệp kết thúc lượt.
 */
export interface DoneMessage {
  type: "done";
  value?: PtcJsonWire;
  error?: {
    kind: "exception" | "invalid-output" | "output-limit";
    message: string;
  };
}

/** Mọi thông điệp chương trình gửi đi. Nhận: call · log · output-limit · done. Trả: hợp của bốn kiểu thông điệp. */
export type ProgramToHost = CallMessage | LogMessage | OutputLimitMessage | DoneMessage;

/** Host → chương trình: lệnh chạy một lượt đánh giá (chuỗi `run` của host). Nhận: id · cwd · data. Trả: kiểu lệnh chạy. */
export interface RunMessage {
  type: "run";
  id: number;
  cwd: string;
  data: ProgramBootData;
}

/** Host → chương trình: câu trả lời cho một {@link CallMessage}. Nhận: ok + value (thành công) hoặc message (lỗi). Trả: kiểu câu trả lời. */
export type ReplyMessage =
  | {
      type: "reply";
      id: number;
      ok: true;
      value: PtcJsonWire;
    }
  | {
      type: "reply";
      id: number;
      ok: false;
      message: string;
    };
//#endregion
//#region lib/types/control.js
/** Dấu mồi môi trường của kênh điều khiển kế thừa. Nhận: không. Trả: tên biến cố định `DSH_SUBPROCESS_CONTROL`. */
export const SUBPROCESS_CONTROL_ENV = "DSH_SUBPROCESS_CONTROL";

/**
 * Dùng dấu mồi khởi chạy và mở ống điều khiển kế thừa ở fd 7. Luồng trả về sở hữu descriptor.
 * Gọi một lần trước khi chạy mã không tin cậy; thông điệp vẫn không tin cậy dù đầu mút được kế thừa.
 * Nhận: không (đọc `process.env` và fd 7 của tiến trình hiện tại).
 * Trả: luồng duplex byte-mode đã kết nối, do người gọi sở hữu.
 */
export function openInheritedControlChannel(): Duplex {
  const marker = process.env[SUBPROCESS_CONTROL_ENV];
  Reflect.deleteProperty(process.env, SUBPROCESS_CONTROL_ENV);
  if (marker !== "pipe") throw new Error("subprocess control channel was not inherited");
  return new Socket({
    fd: 7,
    readable: true,
    writable: true,
    allowHalfOpen: true,
  });
}
//#endregion
