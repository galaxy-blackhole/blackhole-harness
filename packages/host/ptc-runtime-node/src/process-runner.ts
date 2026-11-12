/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa THÂN CHẠY của tiến trình con PTC (port 1:1 `lib/process.js` dòng 706–1143): bắt log + console
 *      shim, chuẩn bị giá trị hoàn tất/ngoại lệ, dựng namespace binding, chạy chương trình, khử môi trường
 *      và `runNodeMain` sau bắt tay điều khiển. Điểm vào nằm ở `process-entry.ts` (orchestrator nối).
 */
import type { Duplex } from "node:stream";
import { inspect } from "node:util";
import {
  JsonChannel,
  decodePtcJsonWire,
  encodePtcJsonWire,
  jsonStringBytesUpTo,
  jsonValueBytesUpTo,
  snapshotPtcJsonValue,
  truncateJsonStringBytes,
} from "./process-protocol.ts";
import type {
  DoneMessage,
  ProgramBootData,
  ProgramToHost,
  PtcJsonValue,
  ReplyMessage,
} from "./process-protocol.ts";

/* --------------------------------------------------------------------------------------------------- */
/* Kiểu của seam bootstrap (port dòng 706–718, 830–948)                                                 */
/* --------------------------------------------------------------------------------------------------- */

/** Thông điệp chương trình và câu trả lời host được vận chuyển qua kênh tiến trình riêng tư. */
export interface BootstrapPort {
  /** Gửi một thông điệp của chương trình cho host. */
  postMessage(message: ProgramToHost): void;
  /** Đăng ký nhận câu trả lời của host. */
  on(event: "message", listener: (message: ReplyMessage) => void): void;
}

/**
 * Slot `write` của một luồng ghi được, đúng như bootstrap vá nó (xem {@link captureStreamWrites}).
 * Khai theo kiểu PHƯƠNG THỨC để `process.stdout`/`process.stderr` thật (tham số chunk hẹp hơn) vẫn gán được.
 */
export interface PatchableStream {
  write(chunk: unknown, ...rest: unknown[]): boolean;
}

/** Handle chờ của MỘT lượt gọi binding, khoá theo id trong map chờ. */
export interface PendingCall {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

/** Kiểu constructor cho một lớp từ chối binding mà chương trình nhìn thấy. */
export type BindingErrorConstructor = new (memberName: string, message: string) => Error;

/** Môi trường và luồng đầu ra do tiến trình sở hữu, được bootstrap con dùng. */
export interface ProgramProcess {
  env: NodeJS.ProcessEnv;
  stdout: PatchableStream;
  stderr: PatchableStream;
  exitCode: string | number | null | undefined;
}

/* --------------------------------------------------------------------------------------------------- */
/* Bắt log dưới hạn JSON ngoài cùng (port dòng 711–772)                                                 */
/* --------------------------------------------------------------------------------------------------- */

const CapturedError = Error;
const capturedObjectCreate = Object.create;
const capturedObjectDefineProperty = Object.defineProperty;

/**
 * Định nghĩa MỘT trường lỗi công khai của binding mà không hỏi global khả biến hay prototype descriptor.
 * Nhận: error — lỗi đích; key — tên trường; value — giá trị trường.
 * Trả: không.
 */
function defineBindingErrorField(error: object, key: string, value: unknown): void {
  const attributes = capturedObjectCreate(null) as PropertyDescriptor;
  attributes.enumerable = true;
  attributes.value = value;
  capturedObjectDefineProperty(error, key, attributes);
}

/**
 * Bắt chữ theo thứ tự dưới hạn byte JSON ngoài cùng dùng chung, giao cho một sink ngay khi từng mục rơi vào
 * (sink thật phát chữ qua port ngay, nên đầu ra đã bắt sống sót khi lượt chạy bị kết thúc giữa chừng). Nó
 * tính cả cú pháp mảng log lẫn phần escape chuỗi. Khi cạn hạn, nó phát tiền tố vừa được và báo hạn MỘT lần;
 * host biến tình trạng đó thành lỗi `output-limit` tường minh của lượt chạy.
 * Nhận: maxBytes — hạn tổng; sink — nơi nhận từng mẩu chữ; onLimit — báo khi cạn hạn (mặc định không làm gì).
 * Trả: instance dùng được ngay.
 */
export class LogBuffer {
  private bytes = 2;
  private entries = 0;
  private truncated = false;
  private readonly sink: (text: string) => void;
  private readonly onLimit: () => void;
  private readonly maxBytes: number;

  constructor(maxBytes: number, sink: (text: string) => void, onLimit: () => void = () => {}) {
    this.maxBytes = maxBytes;
    this.sink = sink;
    this.onLimit = onLimit;
  }

  /**
   * Phát chữ cho sink, tính vào hạn (bỏ qua + đánh dấu một lần khi đã cạn).
   * Nhận: text — chữ đã bắt cần giao.
   * Trả: không.
   */
  push(text: string): void {
    if (this.truncated) return;
    const separatorBytes = this.entries > 0 ? 1 : 0;
    const availableBytes = this.maxBytes - this.bytes - separatorBytes;
    const stringBytes = jsonStringBytesUpTo(text, availableBytes);
    if (stringBytes === void 0) {
      this.truncated = true;
      const prefix = truncateJsonStringBytes(text, availableBytes);
      if (prefix.length > 0) {
        const prefixBytes = jsonStringBytesUpTo(prefix, availableBytes);
        if (prefixBytes === void 0) throw new CapturedError("program output ledger produced an oversized log prefix");
        this.bytes += prefixBytes + separatorBytes;
        this.entries += 1;
        this.sink(prefix);
      }
      this.onLimit();
      return;
    }
    this.bytes += stringBytes + separatorBytes;
    this.entries += 1;
    this.sink(text);
  }

  /**
   * Hạn byte JSON chính xác còn lại cho giá trị hoàn tất hoặc thông điệp lỗi.
   * Nhận: không.
   * Trả: số byte còn lại.
   */
  remainingOutputBytes(): number {
    return this.maxBytes - this.bytes;
  }
}

/* --------------------------------------------------------------------------------------------------- */
/* Console shim + bắt ghi thô trên stdout/stderr (port dòng 773–829)                                    */
/* --------------------------------------------------------------------------------------------------- */

/** Năm phương thức console mà shim bắt, theo từ vựng level của seam. */
const CONSOLE_LEVELS = ["log", "info", "warn", "error", "debug"] as const;

/**
 * Một `console` thay thế với năm phương thức có level, render tham số kiểu `util.inspect` (đủ giống console
 * thật để model nhận ra đầu ra của chính nó) vào buffer. Chỉ năm phương thức này tồn tại — chương trình nhận
 * một console nhỏ có chủ đích, không phải toàn bộ API console của Node.
 * Nhận: logs — buffer mà mọi dòng đã render được đẩy vào.
 * Trả: object năm phương thức trao cho chương trình.
 */
export function makeConsoleShim(logs: Pick<LogBuffer, "push">): Record<(typeof CONSOLE_LEVELS)[number], (...args: unknown[]) => void> {
  const render = (args: unknown[]): string => args.map((arg) => typeof arg === "string" ? arg : inspect(arg, INSPECT_OPTIONS)).join(" ");
  const shim = Object.create(null) as Record<(typeof CONSOLE_LEVELS)[number], (...args: unknown[]) => void>;
  for (const level of CONSOLE_LEVELS) shim[level] = (...args: unknown[]) => {
    logs.push(render(args));
  };
  return shim;
}

/**
 * Chuyển `write` của một luồng vào buffer log (tức `process.stdout`/`process.stderr` mà chương trình thấy
 * trong tiến trình con Node), để các lượt ghi thô rơi đúng thứ tự phát cùng đầu ra console thay vì đua nhau
 * xuống một ống. Nó giữ hợp đồng callback tuỳ chọn của Node: callback chạy BẤT ĐỒNG BỘ sau khi nhận vào, kể cả
 * khi hạn log bỏ lượt ghi đó.
 * Nhận: logs — buffer nhận các lượt ghi; stream — luồng bị vá slot `write`.
 * Trả: hàm khôi phục (test in-process bỏ vá; tiến trình con thật không bao giờ cần).
 */
export function captureStreamWrites(logs: Pick<LogBuffer, "push">, stream: PatchableStream): () => void {
  const original = stream.write;
  stream.write = (chunk: unknown, ...rest: unknown[]): boolean => {
    logs.push(typeof chunk === "string" ? chunk : String(chunk));
    const callback = [rest[0], rest[1]].find((arg) => typeof arg === "function") as ((error: unknown) => void) | undefined;
    if (callback) queueMicrotask(() => {
      callback(null);
    });
    return true;
  };
  return () => {
    stream.write = original;
  };
}

/** Tuỳ chọn inspect có hạn: đủ sâu để hữu ích, đủ hạn để một giá trị bệnh hoạn không thổi phồng bản render. */
const INSPECT_OPTIONS = {
  depth: 4,
  maxArrayLength: 100,
  maxStringLength: 1e4,
};

/* --------------------------------------------------------------------------------------------------- */
/* Chuẩn bị giá trị hoàn tất / ngoại lệ (port dòng 830–885)                                             */
/* --------------------------------------------------------------------------------------------------- */

/**
 * Chuẩn bị giá trị hoàn tất của chương trình cho thông điệp done. Chỉ JSON lossless đi qua, và giá trị không
 * vừa hạn tổng còn lại thì báo `output-limit`; host kiểm lại traffic thù địch và vẫn là bên có thẩm quyền
 * với các lượt ghi ống native mà shim của chương trình không quan sát được.
 * Nhận: value — giá trị hoàn tất; remainingOutputBytes — byte chính xác còn lại sau log đã bắt;
 *        maxOutputBytes — hạn được nêu trong chẩn đoán tràn.
 * Trả: mảnh thông điệp done: `{}` cho `undefined`, ngược lại là wire phẳng `{ value }` hoặc `{ error }`.
 */
export function prepareCompletion(value: unknown, remainingOutputBytes: number, maxOutputBytes: number = remainingOutputBytes): Omit<DoneMessage, "type"> {
  if (value === void 0) return {};
  let snapshot: PtcJsonValue | undefined;
  try {
    snapshot = snapshotPtcJsonValue(value);
  } catch {
    snapshot = void 0;
  }
  if (snapshot === void 0) return prepareFailure("invalid-output", "program completion must be lossless JSON", remainingOutputBytes, maxOutputBytes);
  if (jsonValueBytesUpTo(snapshot, remainingOutputBytes) === void 0) return outputLimit(maxOutputBytes);
  return { value: encodePtcJsonWire(snapshot) };
}

/**
 * Dựng mảnh tràn cố định mà không mang byte khả biến đã bị từ chối.
 * Nhận: maxOutputBytes — hạn được nêu trong chẩn đoán.
 * Trả: mảnh done chỉ có `error`.
 */
function outputLimit(maxOutputBytes: number): Omit<DoneMessage, "type"> {
  return { error: {
    kind: "output-limit",
    message: `outer output exceeded ${maxOutputBytes} bytes`,
  } };
}

/**
 * Nhận MỘT thông điệp lỗi có hạn, hoặc thay bằng chẩn đoán tràn cố định.
 * Nhận: kind — loại lỗi; message — thông điệp; remainingOutputBytes — byte còn lại; maxOutputBytes — hạn.
 * Trả: mảnh done chỉ có `error`.
 */
function prepareFailure(kind: "exception" | "invalid-output", message: string, remainingOutputBytes: number, maxOutputBytes: number): Omit<DoneMessage, "type"> {
  if (jsonStringBytesUpTo(message, remainingOutputBytes) === void 0) return outputLimit(maxOutputBytes);
  return { error: {
    kind,
    message,
  } };
}

/**
 * Chuẩn bị một giá trị bị chương trình ném ra mà không gửi ngăn xếp hay chuỗi vô hạn qua kênh tiến trình.
 * Nhận: error — giá trị bị ném; remainingOutputBytes — byte chính xác còn lại sau log đã bắt;
 *        maxOutputBytes — hạn được nêu trong chẩn đoán tràn.
 * Trả: ngoại lệ có hạn hoặc mảnh output-limit cố định.
 */
export function prepareException(error: unknown, remainingOutputBytes: number, maxOutputBytes: number = remainingOutputBytes): Omit<DoneMessage, "type"> {
  let message: string;
  try {
    const detail = error instanceof CapturedError ? error.stack ?? error.message : error;
    message = typeof detail === "string" ? detail : String(detail);
  } catch {
    message = "program threw an unrenderable value";
  }
  return prepareFailure("exception", message, remainingOutputBytes, maxOutputBytes);
}

/* --------------------------------------------------------------------------------------------------- */
/* Lớp lỗi binding + dây câu trả lời (port dòng 886–934)                                                */
/* --------------------------------------------------------------------------------------------------- */

/**
 * Hiện thực hoá constructor lỗi thật do MỘT namespace khai báo.
 * Nhận: descriptor — tên lớp global của chương trình và tên thuộc tính member.
 * Trả: constructor được tiêm vào chương trình và dùng cho các lượt reject.
 */
export function makeBindingErrorClass(descriptor: { name: string; memberNameProperty: string }): BindingErrorConstructor {
  return class BindingCallError extends CapturedError {
    constructor(memberName: string, message: string) {
      super(message);
      defineBindingErrorField(this, "name", descriptor.name);
      defineBindingErrorField(this, descriptor.memberNameProperty, memberName);
    }
  };
}

/**
 * Tạo lượt từ chối riêng của namespace cho MỘT lượt gọi binding thất bại.
 * Nhận: errorClass — constructor của namespace (có thể vắng); memberName — tên hàm; message — thông điệp.
 * Trả: lỗi binding, hoặc `Error` thường khi namespace không khai lớp lỗi.
 */
function bindingFailure(errorClass: BindingErrorConstructor | undefined, memberName: string, message: string): Error {
  return errorClass ? new errorClass(memberName, message) : new CapturedError(message);
}

/**
 * Dựng mỗi lớp lỗi đã khai MỘT lần để lượt gọi và `instanceof` dùng chung định danh constructor.
 * Nhận: data — các khai báo namespace binding từ payload boot.
 * Trả: map constructor khoá theo global của namespace sở hữu.
 */
export function makeBindingErrorClasses(data: Pick<ProgramBootData, "namespaces">): Map<string, BindingErrorConstructor> {
  const classes = new Map<string, BindingErrorConstructor>();
  for (const namespace of data.namespaces) if (namespace.errorClass) classes.set(namespace.global, makeBindingErrorClass(namespace.errorClass));
  return classes;
}

/**
 * Định tuyến câu trả lời của host vào map lượt gọi đang chờ: mỗi câu trả lời chốt lượt gọi của nó nhiều nhất
 * một lần, và câu trả lời cho id lạ (đi lạc, hoặc trả lời trùng cho id đã chốt) bị bỏ qua. Dây dùng chung giữa
 * {@link runProgram} và các test luyện {@link makeNamespaces} độc lập.
 * Nhận: port — port mà sự kiện `message` mang câu trả lời; pending — map id → lượt gọi chưa chốt.
 * Trả: không.
 */
export function wireReplies(port: BootstrapPort, pending: Map<number, PendingCall>): void {
  port.on("message", (message) => {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.ok) {
      const value = decodePtcJsonWire(message.value);
      if (value === void 0) entry.reject(new CapturedError("binding resolution must be lossless JSON"));
      else entry.resolve(value);
    } else entry.reject(new CapturedError(message.message));
  });
}

/**
 * Dựng các object namespace binding mà chương trình thấy: mỗi namespace một global prototype null, mỗi tên đã
 * khai là một hàm async enumerable riêng bắc cầu qua port (`__proto__`/`constructor`/`toString` là khoá
 * thường, không bao giờ đụng prototype). Đối số mất mát bị từ chối TRƯỚC khi gửi; lỗi clone và câu trả lời
 * thất bại của host chỉ reject đúng lượt gọi tương ứng.
 * Nhận: data — khai báo namespace trong payload boot; port — port nhận lượt gọi; pending — map giữ handle;
 *        nextId — bộ đếm id dùng chung (id tương quan do chương trình phát); errorClasses — constructor dùng
 *        chung với global của chương trình, tra theo từng lượt gọi.
 * Trả: mỗi khai báo một object namespace, đúng thứ tự khai báo.
 */
export function makeNamespaces(
  data: Pick<ProgramBootData, "namespaces">,
  port: BootstrapPort,
  pending: Map<number, PendingCall>,
  nextId: { value: number },
  errorClasses: Pick<ReadonlyMap<string, BindingErrorConstructor>, "get"> = makeBindingErrorClasses(data),
): Record<string, unknown>[] {
  return data.namespaces.map(({ global, names }) => {
    const namespace = Object.create(null) as Record<string, unknown>;
    for (const name of names) Object.defineProperty(namespace, name, {
      enumerable: true,
      value: (args: unknown) => {
        const errorClass = errorClasses.get(global);
        let detached: PtcJsonValue | undefined;
        try {
          detached = snapshotPtcJsonValue(args);
        } catch {
          detached = void 0;
        }
        if (detached === void 0) return Promise.reject(bindingFailure(errorClass, name, "binding arguments must be lossless JSON"));
        const detachedArgs = detached;
        return new Promise<PtcJsonValue>((resolve, reject) => {
          const id = nextId.value;
          pending.set(id, {
            resolve,
            reject: (error) => {
              reject(bindingFailure(errorClass, name, error.message));
            },
          });
          try {
            port.postMessage({
              type: "call",
              id,
              global,
              name,
              args: encodePtcJsonWire(detachedArgs),
            });
            nextId.value += 1;
          } catch (error) {
            pending.delete(id);
            reject(bindingFailure(errorClass, name, `binding call could not be sent: ${error instanceof CapturedError ? error.message : String(error)}`));
          }
        });
      },
    });
    return namespace;
  });
}

/* --------------------------------------------------------------------------------------------------- */
/* Chạy chương trình (port dòng 935–1040)                                                               */
/* --------------------------------------------------------------------------------------------------- */

/** Constructor của AsyncFunction, đủ để dựng thân chương trình với danh sách tham số động. */
type AsyncFunctionConstructor = new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

/**
 * Chạy MỘT thân hàm async nghiêm ngặt, cho phép `await` và `return` ở mức cao nhất, rồi gửi đúng một
 * {@link DoneMessage} cuối; lỗi bị chương trình ném ra thành trường `error` của nó.
 * Nhận: port — message port của host hoặc bản giả cho test; data — payload boot host đã gửi;
 *        streams — object stdout/stderr được bắt thành log của chương trình.
 * Trả: promise xong sau khi đã gửi thông điệp done.
 */
export async function runProgram(
  port: BootstrapPort,
  data: ProgramBootData,
  streams: { stdout: PatchableStream; stderr: PatchableStream },
): Promise<void> {
  const logs = new LogBuffer(data.maxOutputBytes, (text) => {
    port.postMessage({
      type: "log",
      text,
    });
  }, () => {
    port.postMessage({ type: "output-limit" });
  });
  captureStreamWrites(logs, streams.stdout);
  captureStreamWrites(logs, streams.stderr);
  const pending = new Map<number, PendingCall>();
  wireReplies(port, pending);
  const nextId = { value: 1 };
  const errorClasses = makeBindingErrorClasses(data);
  const namespaces = makeNamespaces(data, port, pending, nextId, errorClasses);
  const errorClassParameters: string[] = [];
  const errorClassValues: BindingErrorConstructor[] = [];
  for (const namespace of data.namespaces) {
    if (!namespace.errorClass) continue;
    errorClassParameters.push(namespace.errorClass.name);
    const errorClass = errorClasses.get(namespace.global);
    if (!errorClass) throw new CapturedError(`missing binding error class for ${namespace.global}`);
    errorClassValues.push(errorClass);
  }
  const consoleShim = makeConsoleShim(logs);
  let done: DoneMessage;
  try {
    const AsyncFunction = (async () => {}).constructor as AsyncFunctionConstructor;
    const program = new AsyncFunction(...data.namespaces.map((namespace) => namespace.global), ...errorClassParameters, "console", `'use strict';\n${data.code}`);
    done = {
      type: "done",
      ...prepareCompletion(await program(...namespaces, ...errorClassValues, consoleShim), logs.remainingOutputBytes(), data.maxOutputBytes),
    };
  } catch (error) {
    done = {
      type: "done",
      ...prepareException(error, logs.remainingOutputBytes(), data.maxOutputBytes),
    };
  }
  port.postMessage(done);
}

/* --------------------------------------------------------------------------------------------------- */
/* Môi trường khởi động (port dòng 1042–1060)                                                           */
/* --------------------------------------------------------------------------------------------------- */

/** Biến khởi động mà executable native cần trước khi model được đánh giá. */
/** Tìm executable native, đường hệ thống Windows và đường tạm của sandbox được giữ lại trong môi trường OS. */
export const STARTUP_ENVIRONMENT_NAMES: ReadonlySet<string> = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
]);

/**
 * Xoá credential thừa kế mà vẫn giữ đường khởi động của tiến trình con native.
 * Nhận: state — môi trường của tiến trình con; bị thay bằng một object rỗng mà chương trình thấy.
 * Trả: không.
 */
export function clearProgramEnvironment(state: { env: NodeJS.ProcessEnv }): void {
  for (const key of Object.keys(state.env)) if (!STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase())) Reflect.deleteProperty(state.env, key);
  state.env = Object.create(null);
}

/* --------------------------------------------------------------------------------------------------- */
/* Điểm vào của tiến trình con (port dòng 1062–1138; dòng 1140–1142 do `process-entry.ts` nối)         */
/* --------------------------------------------------------------------------------------------------- */

/**
 * Chạy MỘT chương trình do host cung cấp sau bắt tay điều khiển.
 * Nhận: stream — endpoint điều khiển thừa kế đã nhận; maxMessageBytes — hạn khung và byte xếp hàng do host
 *        kiểm; processState — môi trường, luồng đầu ra và trạng thái thoát của tiến trình con Node này.
 * Trả: promise xong sau khi đầu ra điều khiển đã xả và đã quan sát host tắt, hoặc khi lỗi transport đóng kênh.
 */
export async function runNodeMain(stream: Duplex, maxMessageBytes: number, processState: ProgramProcess): Promise<void> {
  if (!Number.isSafeInteger(maxMessageBytes) || maxMessageBytes <= 0 || maxMessageBytes > 4294967295) throw new Error("invalid control message limit");
  clearProgramEnvironment(processState);
  const boot = Promise.withResolvers<ProgramBootData>();
  const listeners: ((message: ReplyMessage) => void)[] = [];
  let started = false;
  let failed = false;
  let terminalSent = false;
  const hostClosed = Promise.withResolvers<void>();
  const onClose = (): void => {
    hostClosed.resolve();
  };
  stream.once("close", onClose);
  const channel = new JsonChannel(stream, maxMessageBytes, (raw) => {
    if (!started) {
      started = true;
      if (typeof raw !== "object" || raw === null || (raw as { type?: unknown }).type !== "boot") {
        boot.reject(new Error("expected program boot frame"));
        return;
      }
      boot.resolve((raw as { data: ProgramBootData }).data);
      return;
    }
    if (terminalSent) return;
    for (const listener of listeners) listener(raw as ReplyMessage);
  }, (error, kind) => {
    if (!terminalSent || kind === "protocol") {
      failed = true;
      boot.reject(error);
      channel.close();
      processState.exitCode = 1;
    }
    hostClosed.resolve();
  });
  const pending = new Set<Promise<void>>();
  const send = (message: ProgramToHost): void => {
    if (terminalSent) return;
    if (message.type === "done") terminalSent = true;
    const task = channel.send(message).catch(() => {
      failed = true;
      channel.close();
      processState.exitCode = 1;
      hostClosed.resolve();
    }).finally(() => {
      pending.delete(task);
    });
    pending.add(task);
  };
  try {
    await channel.send({ type: "ready" });
    const data = await boot.promise;
    await runProgram({
      postMessage: send,
      on: (_event, listener) => {
        listeners.push(listener);
      },
    }, data, {
      stdout: processState.stdout,
      stderr: processState.stderr,
    });
    while (pending.size > 0) await Promise.all(pending);
    await channel.drain();
    await hostClosed.promise;
  } finally {
    stream.off("close", onClose);
    channel.close();
    if (failed) processState.exitCode = 1;
  }
}

/* Điểm vào (nguồn dòng 1140–1142) KHÔNG đặt ở đây: `process-entry.ts` của orchestrator nối
 * `runNodeMain(openInheritedControlChannel(), Number(process.argv[2]), process)` để gói build ra
 * `lib/process.js` có đúng một hiệu ứng phụ lúc chạy, còn module này import được từ test. */
