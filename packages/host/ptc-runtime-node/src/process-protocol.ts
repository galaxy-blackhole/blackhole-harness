/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa GIAO THỨC của tiến trình con PTC (port 1:1 `lib/process.js` dòng 1–705): từ vựng thông điệp
 *      host ↔ con, dấu khởi chạy + kênh điều khiển thừa kế fd 7, kế toán byte JSON của sổ đầu ra,
 *      khung truyền có hạn (JsonChannel) và wire JSON lossless (snapshot/encode/decode)
 */
import { Buffer } from "node:buffer";
import { Socket } from "node:net";
import type { Duplex } from "node:stream";

/* --------------------------------------------------------------------------------------------------- */
/* Từ vựng kiểu: bản sao tối thiểu của peer + wire JSON phẳng                                           */
/* --------------------------------------------------------------------------------------------------- */

/**
 * Giá trị JSON không mất mát. BẢN SAO TỐI THIỂU cục bộ của `PtcJsonValue` bên peer
 * `@deepseek-ai/dsh-ptc-runtime` (peer chưa có trong workspace nên không import được).
 */
export type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };

/** Một mã thông báo mảng của wire: độ dài chính xác, theo sau là đúng `length` token con. */
interface ArrayWireToken {
  kind: "array";
  length: number;
}

/** Một mã thông báo đối tượng của wire: danh sách khoá chính xác, theo sau là từng token giá trị. */
interface ObjectWireToken {
  kind: "object";
  keys: string[];
}

/** Một token của wire phẳng: lá vô hướng hoặc mã thông báo container. */
type PtcJsonToken = null | boolean | number | string | ArrayWireToken | ObjectWireToken;

/**
 * Transport tiền thứ tự, độ sâu có hạn cho MỘT giá trị JSON không mất mát. Mã container và lá vô hướng
 * dùng chung một mảng token phẳng, nên việc tuần tự hoá JSON không đệ quy theo độ sâu ứng dụng của giá trị.
 */
export type PtcJsonWire = PtcJsonToken[];

/** Thứ host trao cho chương trình lúc spawn, sau bắt tay sẵn sàng. */
export interface ProgramBootData {
  /** Thân chương trình đã bỏ kiểu (JS thuần). */
  code: string;
  /** Các namespace binding cần dựng; bản thân hàm vẫn ở phía host. */
  namespaces: {
    global: string;
    names: string[];
    errorClass?: {
      name: string;
      memberNameProperty: string;
    };
  }[];
  /** Hạn cứng cho tổng byte đã tuần tự hoá của log ngoài cùng cộng giá trị hoàn tất hoặc chẩn đoán lỗi. */
  maxOutputBytes: number;
}

/** Chương trình → host: một lượt gọi binding đã bắc cầu. */
interface CallMessage {
  type: "call";
  /** Id tương quan do chương trình phát; host trả lời mỗi id nhiều nhất một lần và bỏ qua bản trùng. */
  id: number;
  /** Global namespace mà lượt gọi nhắm tới. */
  global: string;
  /** Tên hàm trong namespace. */
  name: string;
  /** Đối số duy nhất dưới dạng giá trị wire JSON phẳng không mất mát. */
  args: PtcJsonWire;
}

/** Chương trình → host: chữ đã bắt, phát ngay để đầu ra sống sót khi lượt chạy bị kết thúc giữa chừng. */
interface LogMessage {
  type: "log";
  text: string;
}

/** Chương trình → host: phép đo phía chương trình hoặc giá trị hoàn tất đã vượt hạn ngoài cùng. */
interface OutputLimitMessage {
  type: "output-limit";
}

/**
 * Chương trình → host: chương trình đã chốt. `error` mang ngoại lệ của chương trình, giá trị hoàn tất
 * không hợp lệ, hoặc tràn đầu ra (hạn mức, abort và cái chết của substrate do phía host quan sát). `value`
 * chỉ có khi hoàn tất sạch và có sinh giá trị, dưới dạng wire phẳng đã lossless và đã được nhận theo hạn
 * tổng còn lại. Log KHÔNG nằm ở đây — chúng đã phát ngay dưới dạng {@link LogMessage}.
 */
export interface DoneMessage {
  type: "done";
  value?: PtcJsonWire;
  error?: {
    kind: "exception" | "invalid-output" | "output-limit";
    message: string;
  };
}

/** Mọi thông điệp chương trình gửi đi. */
export type ProgramToHost = CallMessage | LogMessage | OutputLimitMessage | DoneMessage;

/** Host → chương trình: câu trả lời cho một {@link CallMessage}. */
export type ReplyMessage = {
  type: "reply";
  id: number;
  ok: true;
  value: PtcJsonWire;
} | {
  type: "reply";
  id: number;
  ok: false;
  message: string;
};

/* --------------------------------------------------------------------------------------------------- */
/* Dấu khởi chạy + kênh điều khiển thừa kế (port dòng 4–23)                                             */
/* --------------------------------------------------------------------------------------------------- */

/**
 * Dấu khởi chạy RIÊNG TƯ, được tiêu thụ trước khi một tiến trình con Node chạy mã ứng dụng.
 * Nhận: không — hằng số.
 * Trả: tên biến môi trường mang dấu khởi chạy.
 */
export const SUBPROCESS_CONTROL_ENV = "DSH_SUBPROCESS_CONTROL";

/**
 * Tiêu thụ dấu khởi chạy rồi mở ống điều khiển thừa kế ở fd 7. Luồng trả về SỞ HỮU descriptor đó. Chỉ gọi
 * MỘT lần trước khi chạy mã không đáng tin; các thông điệp vẫn không đáng tin dù endpoint được thừa kế.
 * Nhận: không — đọc `process.env[SUBPROCESS_CONTROL_ENV]`, xoá nó, rồi mở fd 7.
 * Trả: một luồng duplex chế độ byte đã kết nối, do bên gọi sở hữu.
 * Ném khi dấu khởi chạy thiếu/không hợp lệ, hoặc khi không mở được descriptor thừa kế.
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

/* --------------------------------------------------------------------------------------------------- */
/* Intrinsic được chốt ở thời điểm nạp module + tiện ích không hỏi prototype đã bị model sửa            */
/* --------------------------------------------------------------------------------------------------- */

const intrinsicReflectApply = Reflect.apply;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicObjectCreate = Object.create;
const intrinsicObjectDefineProperty = Object.defineProperty;
const intrinsicObjectKeys = Object.keys;

/**
 * Dựng descriptor dữ liệu không thể thừa kế trường accessor do model định nghĩa.
 * Nhận: value — giá trị cần đóng gói.
 * Trả: descriptor dữ liệu trên một prototype null.
 */
function dataDescriptor(value: unknown): PropertyDescriptor {
  const descriptor = intrinsicObjectCreate(null) as PropertyDescriptor;
  descriptor.value = value;
  return descriptor;
}

/**
 * Định nghĩa một slot dữ liệu liệt kê thường, không qua descriptor mang prototype.
 * Nhận: target — vật chứa; key — khoá; value — giá trị.
 * Trả: không.
 */
function defineEnumerableDataProperty(target: object, key: PropertyKey, value: unknown): void {
  const descriptor = dataDescriptor(value);
  descriptor.enumerable = true;
  descriptor.configurable = true;
  descriptor.writable = true;
  intrinsicObjectDefineProperty(target, key, descriptor);
}

/**
 * Nối phần tử mà không hỏi `Array.prototype` đã bị model sửa.
 * Nhận: target — mảng đích; value — phần tử nối vào cuối.
 * Trả: không.
 */
function append<T>(target: T[], value: T): void {
  defineEnumerableDataProperty(target, target.length, value);
}

/**
 * Lấy phần tử cuối mà không hỏi `Array.prototype` đã bị model sửa.
 * Nhận: target — mảng nguồn (bị cắt mất phần tử cuối).
 * Trả: phần tử cuối, hoặc `undefined` khi mảng rỗng.
 */
function takeLast<T>(target: T[]): T | undefined {
  if (target.length === 0) return void 0;
  const index = target.length - 1;
  const value = target[index];
  intrinsicObjectDefineProperty(target, "length", dataDescriptor(index));
  return value;
}

/* --------------------------------------------------------------------------------------------------- */
/* Kế toán byte JSON cho sổ đầu ra ngoài cùng (port dòng 25–201)                                        */
/* --------------------------------------------------------------------------------------------------- */

const IntrinsicBuffer = Buffer;
const intrinsicBufferByteLength = Reflect.get(Buffer, "byteLength");
const intrinsicString = String;
const intrinsicStringCharCodeAt = Reflect.get(String.prototype, "charCodeAt");
/* Chữ ký tường minh: Reflect.apply suy ra kiểu trả về từ đích, còn Reflect.get trả any. */
const intrinsicStringCodePointAt = Reflect.get(String.prototype, "codePointAt") as (this: string, index: number) => number;
const intrinsicStringSlice = Reflect.get(String.prototype, "slice");

/**
 * Độ dài byte UTF-8 qua intrinsic Node đã chốt ở module.
 * Nhận: text — chuỗi cần đo.
 * Trả: số byte UTF-8 của chuỗi.
 */
function byteLength(text: string): number {
  return intrinsicReflectApply(intrinsicBufferByteLength, IntrinsicBuffer, [text, "utf8"]);
}

/**
 * Lấy MỘT ký tự canh theo code point của chuỗi.
 * Nhận: text — chuỗi nguồn; index — vị trí bắt đầu.
 * Trả: ký tự tại vị trí đó (hai đơn vị UTF-16 nếu là ký tự ngoài BMP).
 */
function characterAt(text: string, index: number): string {
  const width = intrinsicReflectApply(intrinsicStringCodePointAt, text, [index]) > 65535 ? 2 : 1;
  return intrinsicReflectApply(intrinsicStringSlice, text, [index, index + width]);
}

/**
 * Số byte đã tuần tự hoá mà MỘT code point đóng góp bên trong dấu nháy JSON.
 * Nhận: character — ký tự canh code point.
 * Trả: số byte sau khi escape (kể cả dấu nháy bao ngoài không tính ở đây).
 */
function serializedCharacterBytes(character: string): number {
  if (character.length === 2) return 4;
  if (character === "\"" || character === "\\") return 2;
  const code = intrinsicReflectApply(intrinsicStringCharCodeAt, character, [0]);
  if (code >= 55296 && code <= 57343) return 6;
  if (code < 32) return code === 8 || code === 9 || code === 10 || code === 12 || code === 13 ? 2 : 6;
  return byteLength(character);
}

/**
 * Đo MỘT chuỗi JSON mà không dựng ra dạng escape đầy đủ của nó.
 * Nhận: text — chuỗi ứng viên; maxBytes — cỡ đã tuần tự hoá lớn nhất bên gọi nhận được.
 * Trả: số byte chính xác, hoặc `undefined` ngay khi vượt hạn.
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

/** Một khung đo trong phép duyệt lặp của {@link jsonValueBytesUpTo}. */
type MeasureTask =
  | { kind: "value"; value: PtcJsonValue }
  | { kind: "array"; value: PtcJsonValue[]; index: number }
  | { kind: "object"; value: { [key: string]: PtcJsonValue }; keys: string[]; index: number };

/**
 * Đo MỘT giá trị JSON lossless mà không cấp phát dạng đã tuần tự hoá của nó.
 * Nhận: value — JSON lossless đã kiểm; maxBytes — cỡ đã tuần tự hoá lớn nhất bên gọi nhận được.
 * Trả: số byte chính xác, hoặc `undefined` ngay khi vượt hạn.
 */
export function jsonValueBytesUpTo(value: PtcJsonValue, maxBytes: number): number | undefined {
  let bytes = 0;
  const add = (cost: number): boolean => {
    bytes += cost;
    return bytes <= maxBytes;
  };
  const tasks: MeasureTask[] = [{ kind: "value", value }];
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
        if (!add(2)) return void 0;
        if (current.length > 0) append(tasks, {
          kind: "array",
          value: current,
          index: 0,
        });
      } else {
        if (!add(2)) return void 0;
        const keys = intrinsicObjectKeys(current);
        if (keys.length > 0) append(tasks, {
          kind: "object",
          value: current,
          keys,
          index: 0,
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
        index: task.index + 1,
      });
      append(tasks, { kind: "value", value: item });
      continue;
    }
    const key = task.keys[task.index];
    if (key === void 0) return void 0;
    const keyBytes = jsonStringBytesUpTo(key, maxBytes - bytes);
    if (keyBytes === void 0) return void 0;
    if (!add(keyBytes + 1)) return void 0;
    const item = task.value[key];
    if (item === void 0) return void 0;
    if (task.index + 1 < task.keys.length) append(tasks, {
      ...task,
      index: task.index + 1,
    });
    append(tasks, { kind: "value", value: item });
  }
  return bytes;
}

/**
 * Trả tiền tố dài nhất canh code point mà dạng chuỗi JSON của nó (kể cả hai dấu nháy) vừa `maxBytes`.
 * Nhận: text — chuỗi ứng viên; maxBytes — số byte chuỗi JSON được phép dùng.
 * Trả: tiền tố vừa hạn, hoặc chuỗi rỗng khi cả nội dung hữu ích cũng không vừa.
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

/* --------------------------------------------------------------------------------------------------- */
/* Kênh tiến trình có hạn, khung dài tiền tố (port dòng 202–324)                                        */
/* --------------------------------------------------------------------------------------------------- */

const stringify = JSON.stringify;
const parse = JSON.parse;

/** Một lượt ghi đã nhận vào sổ chờ của {@link JsonChannel}. */
interface ChannelWrite {
  /** Promise bên gọi đang chờ (xong khi frame đã ghi hoặc lỗi). */
  promise: Promise<void>;
  /** Chốt lượt ghi đúng một lần; xoá khỏi sổ và nhả byte đã xếp hàng. */
  finish(error?: Error): void;
}

/**
 * Một kênh tiến trình cùng gói. Bên tiêu thụ sở hữu việc kiểm khung và kết cục cuối.
 * Nhận: stream — endpoint duplex đã nhận; maxBytes — hạn khung và byte xếp hàng; receive — nhận khung;
 *        failure — báo lỗi io/giao thức.
 * Trả: instance dùng được ngay (đã gắn listener).
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
  private readonly writes = new Set<ChannelWrite>();

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
        if (this.payload === void 0) {
          const headerBytes = Math.min(4 - this.headerBytes, chunk.length - offset);
          chunk.copy(this.header, this.headerBytes, offset, offset + headerBytes);
          this.headerBytes += headerBytes;
          offset += headerBytes;
          if (this.headerBytes !== 4) continue;
          const length = this.header.readUInt32BE(0);
          if (length === 0 || length > this.maxBytes) throw new Error(`control frame exceeds ${this.maxBytes} bytes or is empty`);
          this.payload = Buffer.allocUnsafe(length);
          this.payloadBytes = 0;
          this.headerBytes = 0;
        }
        const payload = this.payload as Buffer;
        const bytes = Math.min(payload.length - this.payloadBytes, chunk.length - offset);
        chunk.copy(payload, this.payloadBytes, offset, offset + bytes);
        this.payloadBytes += bytes;
        offset += bytes;
        if (this.payloadBytes !== payload.length) continue;
        this.payload = void 0;
        this.payloadBytes = 0;
        this.receive(parse(new TextDecoder("utf-8", { fatal: true }).decode(payload)), payload.length);
      }
    } catch (error) {
      this.failure(error instanceof Error ? error : new Error(String(error)), "protocol");
    }
  };

  /**
   * Nộp NGAY một frame có hạn và chờ biên nhận ghi của luồng.
   * Nhận: message — giá trị giao thức cùng gói, chỉ JSON.
   * Trả: promise xong khi frame đã ghi, hoặc reject sau khi transport hỏng.
   */
  send(message: unknown): Promise<void> {
    if (this.closed) return Promise.reject(new Error("control channel is closed"));
    const size = jsonValueBytesUpTo(message as PtcJsonValue, this.maxBytes);
    if (size === void 0 || this.queuedBytes + size > this.maxBytes) return Promise.reject(new Error(`control output exceeds ${this.maxBytes} queued bytes`));
    const body = Buffer.from(stringify(message), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length);
    this.queuedBytes += body.length;
    const completion = Promise.withResolvers<void>();
    const write: ChannelWrite = {
      promise: completion.promise,
      finish: (error?: Error): void => {
        if (!this.writes.delete(write)) return;
        this.queuedBytes -= body.length;
        if (error) completion.reject(error);
        else completion.resolve();
      },
    };
    this.writes.add(write);
    try {
      this.stream.cork();
      this.stream.write(header);
      this.stream.write(body, (error) => {
        write.finish(error ?? void 0);
      });
      this.stream.uncork();
    } catch (error) {
      write.finish(error instanceof Error ? error : new Error(String(error)));
    }
    return completion.promise;
  }

  /**
   * Chốt mọi lượt ghi còn chờ bằng cùng một lỗi.
   * Nhận: error — lỗi áp cho các lượt ghi đang chờ.
   * Trả: không.
   */
  private finishWrites(error: Error): void {
    for (const write of this.writes) write.finish(error);
  }

  /**
   * Ngừng đọc và đóng endpoint mình sở hữu; các lượt ghi đang chờ reject khi đóng.
   * Nhận: không.
   * Trả: không.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.payload = void 0;
    this.finishWrites(new Error("control channel is closed"));
    this.stream.off("data", this.onData);
    this.stream.off("end", this.onEnd);
    this.stream.destroy();
  }

  /**
   * Chờ các lượt ghi đã nhận xong hoặc hỏng.
   * Nhận: không.
   * Trả: promise xong khi mọi lượt ghi đã chốt (thành công hay thất bại đều được).
   */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.writes].map((write) => write.promise));
  }
}

/* --------------------------------------------------------------------------------------------------- */
/* Wire JSON lossless cho closure bootstrap không phụ thuộc package (port dòng 325–705)                 */
/* --------------------------------------------------------------------------------------------------- */

const intrinsicFunctionToString = Reflect.get(Function.prototype, "toString");
const IntrinsicError = Error;
const IntrinsicSet = Set;
const intrinsicArrayPrototype = Array.prototype;
const intrinsicNumberIsFinite = Number.isFinite;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectHasOwn = Object.hasOwn;
const intrinsicObjectIs = Object.is;
const intrinsicObjectPrototype = Object.prototype;
const intrinsicObjectPropertyIsEnumerable = Reflect.get(intrinsicObjectPrototype, "propertyIsEnumerable");
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicSetAdd = Reflect.get(Set.prototype, "add");
const intrinsicSetDelete = Reflect.get(Set.prototype, "delete");
const intrinsicSetHas = Reflect.get(Set.prototype, "has");

/**
 * Kiểm một Set intrinsic đã chốt có chứa giá trị hay không.
 * Nhận: target — Set đã chốt; value — giá trị cần tìm.
 * Trả: true nếu có.
 */
function setHas<T>(target: Set<T>, value: T): boolean {
  return intrinsicReflectApply(intrinsicSetHas, target, [value]);
}

/**
 * Thêm vào một Set intrinsic đã chốt.
 * Nhận: target — Set đã chốt; value — giá trị thêm.
 * Trả: không.
 */
function setAdd<T>(target: Set<T>, value: T): void {
  intrinsicReflectApply(intrinsicSetAdd, target, [value]);
}

/**
 * Xoá khỏi một Set intrinsic đã chốt.
 * Nhận: target — Set đã chốt; value — giá trị xoá.
 * Trả: không.
 */
function setDelete<T>(target: Set<T>, value: T): void {
  intrinsicReflectApply(intrinsicSetDelete, target, [value]);
}

/**
 * Kiểm prototype do realm sở hữu có được constructor gốc của nó đỡ sau lưng hay không.
 * Nhận: prototype — prototype ứng viên; name — tên constructor gốc.
 * Trả: true nếu constructor đúng tên, đúng prototype và là mã native.
 */
function hasIntrinsicConstructor(prototype: object, name: string): boolean {
  const constructor = intrinsicObjectGetOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && intrinsicReflectApply(intrinsicFunctionToString, constructor, []) === `function ${name}() { [native code] }`;
  } catch {
    return false;
  }
}

/**
 * Kiểm một giá trị có phải `Object.prototype` gốc của realm khác.
 * Nhận: value — giá trị ứng viên.
 * Trả: true nếu prototype null và có constructor Object native.
 */
function isForeignIntrinsicObjectPrototype(value: object): boolean {
  return intrinsicObjectGetPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}

/**
 * Kiểm một mảng dùng `Array.prototype` gốc của MỘT realm, không phải lớp con hay prototype giả.
 * Nhận: value — giá trị ứng viên (đã là object).
 * Trả: true nếu prototype mảng là intrinsic của realm hiện tại hoặc của realm khác.
 */
function hasPlainArrayPrototype(value: object): boolean {
  const prototype = intrinsicObjectGetPrototypeOf(value);
  if (prototype === intrinsicArrayPrototype) return true;
  if (!intrinsicArrayIsArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = intrinsicObjectGetPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isForeignIntrinsicObjectPrototype(objectPrototype);
}

/**
 * Kiểm một object là bản ghi prototype thường hoặc prototype null từ BẤT KỲ realm JavaScript nào.
 * Nhận: value — giá trị ứng viên (đã là object).
 * Trả: true nếu prototype null, là Object.prototype gốc, hoặc là Object.prototype của realm khác.
 */
function hasPlainObjectPrototype(value: object): boolean {
  const prototype = intrinsicObjectGetPrototypeOf(value);
  return prototype === null || prototype === intrinsicObjectPrototype || typeof prototype === "object" && isForeignIntrinsicObjectPrototype(prototype);
}

/**
 * Liệt kê mọi khoá object mà JSON nhìn thấy, hoặc từ chối khoá riêng mà JSON sẽ bỏ.
 * Nhận: value — object cần liệt kê.
 * Trả: mảng khoá chuỗi, hoặc `undefined` khi gặp khoá không chuỗi hoặc không enumerable.
 */
function enumerableStringKeys(value: object): string[] | undefined {
  const keys = intrinsicReflectOwnKeys(value);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (typeof key !== "string" || !intrinsicReflectApply(intrinsicObjectPropertyIsEnumerable, value, [key])) return void 0;
  }
  return keys as string[];
}

/** Đích gắn giá trị trong phép duyệt lặp của {@link snapshotPtcJsonValue}. */
type SnapshotDestination =
  | { kind: "root" }
  | { kind: "array"; target: PtcJsonValue[]; index: number }
  | { kind: "object"; target: { [key: string]: PtcJsonValue }; key: string };

/** Một công việc trong phép duyệt lặp của {@link snapshotPtcJsonValue}. */
type SnapshotTask =
  | { kind: "visit"; value: unknown; destination: SnapshotDestination }
  | { kind: "leave"; source: object }
  | { kind: "array-item"; source: unknown[]; index: number; target: PtcJsonValue[] }
  | { kind: "object-property"; source: { [key: string]: unknown }; key: string; target: { [key: string]: PtcJsonValue } };

/**
 * Kiểm và tách MỘT giá trị ở ranh giới tiến trình mà không nạp package workspace khác lúc chạy. Bản này
 * phản chiếu ranh giới JSON chuẩn tắc do session sở hữu, đồng thời vẫn an toàn khi import từ bootstrap chưa
 * build. Phép duyệt lặp của nó không thêm giới hạn độ sâu ngăn xếp JavaScript.
 * Nhận: value — giá trị hoàn tất ứng viên.
 * Trả: ảnh chụp JSON lossless đã tách, hoặc `undefined` khi không hợp lệ.
 */
export function snapshotPtcJsonValue(value: unknown): PtcJsonValue | undefined {
  const active = new IntrinsicSet<object>();
  let root: PtcJsonValue | undefined;
  const assign = (destination: SnapshotDestination, item: PtcJsonValue): void => {
    if (destination.kind === "root") root = item;
    else if (destination.kind === "array") defineEnumerableDataProperty(destination.target, destination.index, item);
    else defineEnumerableDataProperty(destination.target, destination.key, item);
  };
  const tasks: SnapshotTask[] = [{
    kind: "visit",
    value,
    destination: { kind: "root" },
  }];
  for (let task = takeLast(tasks); task !== void 0; task = takeLast(tasks)) {
    if (task.kind === "leave") {
      setDelete(active, task.source);
      continue;
    }
    if (task.kind === "array-item") {
      if (!intrinsicObjectHasOwn(task.source, task.index)) return void 0;
      append(tasks, {
        kind: "visit",
        value: task.source[task.index],
        destination: {
          kind: "array",
          target: task.target,
          index: task.index,
        },
      });
      continue;
    }
    if (task.kind === "object-property") {
      append(tasks, {
        kind: "visit",
        value: task.source[task.key],
        destination: {
          kind: "object",
          target: task.target,
          key: task.key,
        },
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
      if (!intrinsicNumberIsFinite(candidate) || intrinsicObjectIs(candidate, -0)) return void 0;
      assign(task.destination, candidate);
      continue;
    }
    if (typeof candidate !== "object") return void 0;
    if (setHas(active, candidate)) return void 0;
    if (intrinsicArrayIsArray(candidate)) {
      if (!hasPlainArrayPrototype(candidate)) return void 0;
      const length = candidate.length;
      if (intrinsicReflectOwnKeys(candidate).length !== length + 1) return void 0;
      const target: PtcJsonValue[] = [];
      assign(task.destination, target);
      setAdd(active, candidate);
      append(tasks, {
        kind: "leave",
        source: candidate,
      });
      for (let index = length - 1; index >= 0; index--) append(tasks, {
        kind: "array-item",
        source: candidate,
        index,
        target,
      });
      continue;
    }
    if (!hasPlainObjectPrototype(candidate)) return void 0;
    const keys = enumerableStringKeys(candidate);
    if (keys === void 0) return void 0;
    const target: { [key: string]: PtcJsonValue } = {};
    assign(task.destination, target);
    setAdd(active, candidate);
    append(tasks, {
      kind: "leave",
      source: candidate,
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) return void 0;
      append(tasks, {
        kind: "object-property",
        source: candidate as { [key: string]: unknown },
        key,
        target,
      });
    }
  }
  return root;
}

/**
 * Làm phẳng MỘT giá trị JSON đã kiểm cho kênh điều khiển tiến trình.
 * Nhận: value — giá trị JSON lossless cần vận chuyển.
 * Trả: luồng token tiền thứ tự với độ lồng của chính nó có hạn.
 */
export function encodePtcJsonWire(value: PtcJsonValue): PtcJsonWire {
  const wire: PtcJsonToken[] = [];
  const pending: PtcJsonValue[] = [value];
  for (let current = takeLast(pending); current !== void 0; current = takeLast(pending)) {
    if (current === null || typeof current === "boolean" || typeof current === "number" || typeof current === "string") {
      append(wire, current);
      continue;
    }
    if (intrinsicArrayIsArray(current)) {
      append(wire, {
        kind: "array",
        length: current.length,
      });
      for (let index = current.length - 1; index >= 0; index--) {
        const item = current[index];
        if (item === void 0) throw new IntrinsicError("cannot encode a sparse JSON array");
        append(pending, item);
      }
      continue;
    }
    const keys = intrinsicObjectKeys(current);
    append(wire, {
      kind: "object",
      keys,
    });
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) throw new IntrinsicError("cannot encode a missing JSON object key");
      const item = current[key];
      if (item === void 0) throw new IntrinsicError("cannot encode an undefined JSON object property");
      append(pending, item);
    }
  }
  return wire;
}

/**
 * Kiểm một mảng chỉ chứa đúng các slot có chỉ số dày đặc và `length`.
 * Nhận: value — mảng ứng viên (đã được `Array.isArray` chứng minh ở mọi điểm gọi).
 * Trả: true nếu mảng dày đặc và có prototype mảng thường.
 */
function isDenseArray(value: unknown[]): boolean {
  if (!hasPlainArrayPrototype(value) || intrinsicReflectOwnKeys(value).length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index++) if (!intrinsicObjectHasOwn(value, index)) return false;
  return true;
}

/**
 * Kiểm MỘT danh sách khoá chuỗi chính xác có chứa khoá mong đợi, không hỏi prototype của nó.
 * Nhận: keys — danh sách khoá; expected — khoá cần tìm.
 * Trả: true nếu có.
 */
function keysContain(keys: string[], expected: string): boolean {
  for (let index = 0; index < keys.length; index++) if (keys[index] === expected) return true;
  return false;
}

/**
 * Trả đúng MỘT mã container, hoặc từ chối mọi trường thừa/thiếu.
 * Nhận: value — token ứng viên (object không phải mảng).
 * Trả: mã mảng/đối tượng đã chuẩn hoá, hoặc `undefined` khi token sai hình dạng.
 */
function containerToken(value: object): ArrayWireToken | ObjectWireToken | undefined {
  if (intrinsicArrayIsArray(value) || !hasPlainObjectPrototype(value)) return void 0;
  const keys = enumerableStringKeys(value);
  if (keys === void 0) return void 0;
  const token = value as { kind?: unknown; length?: unknown; keys?: unknown };
  if (token.kind === "array") {
    if (keys.length !== 2 || !keysContain(keys, "kind") || !keysContain(keys, "length")) return void 0;
    const length = token.length;
    return typeof length === "number" && intrinsicNumberIsSafeInteger(length) && length >= 0 ? {
      kind: "array",
      length,
    } : void 0;
  }
  if (token.kind === "object") {
    if (keys.length !== 2 || !keysContain(keys, "kind") || !keysContain(keys, "keys")) return void 0;
    const objectKeys = token.keys;
    if (!intrinsicArrayIsArray(objectKeys) || !isDenseArray(objectKeys)) return void 0;
    const unique = new IntrinsicSet<string>();
    const normalizedKeys: string[] = [];
    const objectKeyValues = objectKeys;
    for (let index = 0; index < objectKeyValues.length; index++) {
      const key = objectKeyValues[index];
      if (typeof key !== "string" || setHas(unique, key)) return void 0;
      setAdd(unique, key);
      append(normalizedKeys, key);
    }
    return {
      kind: "object",
      keys: normalizedKeys,
    };
  }
}

/** Một khung dựng dở trong phép duyệt lặp của {@link decodePtcJsonWire}. */
type DecodeFrame =
  | { kind: "array"; target: PtcJsonValue[]; length: number; index: number }
  | { kind: "object"; target: { [key: string]: PtcJsonValue }; keys: string[]; index: number };

/**
 * Dựng lại MỘT giá trị JSON lossless từ dạng wire phẳng của tiến trình. Traffic sai hình dạng hoặc thiếu
 * trả `undefined`; phép duyệt là lặp nên độc lập với độ sâu ứng dụng của giá trị được vận chuyển.
 * Nhận: input — payload message-port không đáng tin.
 * Trả: giá trị JSON đã tách, hoặc `undefined` khi wire không hợp lệ.
 */
export function decodePtcJsonWire(input: unknown): PtcJsonValue | undefined {
  try {
    if (!intrinsicArrayIsArray(input) || !isDenseArray(input) || input.length === 0) return void 0;
    const wire = input;
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
      if (parent.index >= (parent.kind === "array" ? parent.length : parent.keys.length)) return false;
      if (parent.kind === "array") append(parent.target, value);
      else {
        const key = parent.keys[parent.index];
        if (key === void 0) return false;
        defineEnumerableDataProperty(parent.target, key, value);
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
            index: 0,
          };
        } else {
          if (marker.keys.length > remainingTokens) return void 0;
          const target: { [key: string]: PtcJsonValue } = {};
          value = target;
          if (marker.keys.length > 0) frame = {
            kind: "object",
            target,
            keys: marker.keys,
            index: 0,
          };
        }
      }
      if (!attach(value)) return void 0;
      if (frame) append(frames, frame);
      while (frames.length > 0) {
        const current = frames[frames.length - 1];
        if (current === void 0) break;
        if (current.index < (current.kind === "array" ? current.length : current.keys.length)) break;
        takeLast(frames);
      }
    }
    return frames.length === 0 ? root : void 0;
  } catch {
    return;
  }
}
