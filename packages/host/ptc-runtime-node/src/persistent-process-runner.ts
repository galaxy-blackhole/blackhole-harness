/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Thân chạy PTC persistent (node): REPL trong bộ nhớ, bắt log/console, cầu binding và runPersistentMain cho entry nối
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { start } from "node:repl";
import { PassThrough, Writable } from "node:stream";
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
} from "./persistent-process-protocol.ts";
import type {
  DoneMessage,
  ProgramBootData,
  ProgramToHost,
  PtcJsonValue,
  ReplyMessage,
  RunMessage,
} from "./persistent-process-protocol.ts";

//#region lib/types/bootstrap.js
/**
 * Đánh giá chương trình, bắt đầu ra và proxy binding của host trên kênh tiến trình.
 * @module @deepseek-ai/dsh-ptc-runtime-node/src/bootstrap
 */
const CapturedError = Error;
const capturedObjectCreate = Object.create;
const capturedObjectDefineProperty = Object.defineProperty;

/**
 * Định nghĩa một trường lỗi binding công khai mà không tra global/descriptor có thể bị sửa.
 * Nhận: lỗi đích, tên trường, giá trị.
 * Trả: không (ghi thẳng vào lỗi).
 */
function defineBindingErrorField(error: object, key: string, value: unknown): void {
  const attributes: PropertyDescriptor = capturedObjectCreate(null);
  attributes.enumerable = true;
  attributes.value = value;
  capturedObjectDefineProperty(error, key, attributes);
}

/** Thông điệp chương trình và câu trả lời host đi trên kênh tiến trình riêng. Nhận: postMessage + on("message"). Trả: kiểu cổng bắc cầu binding. */
export interface BootstrapPort {
  postMessage(message: ProgramToHost): void;
  on(event: "message", listener: (message: ReplyMessage) => void): void;
}

/**
 * Slot `write` của một luồng ghi, đúng như bootstrap vá nó (xem {@link captureStreamWrites}).
 * Khai theo kiểu method để `process.stdout`/`process.stderr` thật (tham số chunk hẹp hơn) vẫn gán được.
 * Nhận: chunk cùng các tham số ghi còn lại. Trả: kiểu slot `write` tối thiểu mà bootstrap vá được.
 */
export interface PatchableStream {
  write(chunk: unknown, ...rest: unknown[]): boolean;
}

/**
 * Bắt văn bản có thứ tự dưới ngân sách byte JSON ngoài cùng dùng chung, trao cho sink ngay khi từng
 * mục rơi vào (sink thật phát văn bản qua cổng ngay, nên đầu ra đã bắt sống sót khi lượt chạy bị cắt
 * giữa đường). Nó tính cả cú pháp mảng log và phần escape chuỗi. Khi cạn, nó phát tiền tố vừa chỗ và
 * báo trần đúng một lần; host biến tình trạng đó thành lỗi lượt chạy `output-limit` tường minh.
 * Nhận: trần byte + sink nhận văn bản + hàm báo chạm trần. Trả: thể hiện sổ log (push + remainingOutputBytes).
 */
export class LogBuffer {
  private bytes = 2;
  private entries = 0;
  private truncated = false;
  private readonly sink: (text: string) => void;
  private readonly onLimit: () => void;
  private readonly maxBytes: number;

  /**
   * Dựng sổ log với trần byte và hai hàm nhận.
   * Nhận: trần byte JSON, hàm sink nhận từng đoạn văn bản, hàm báo chạm trần (mặc định không làm gì).
   * Trả: thể hiện sổ log rỗng (đã tính 2 byte của cặp ngoặc mảng).
   */
  constructor(maxBytes: number, sink: (text: string) => void, onLimit: () => void = () => {}) {
    this.maxBytes = maxBytes;
    this.sink = sink;
    this.onLimit = onLimit;
  }

  /**
   * Phát văn bản cho sink, tính vào ngân sách (bỏ và đánh dấu một lần khi cạn).
   * Nhận: đoạn văn bản đã bắt cần trao đi.
   * Trả: không.
   */
  push(text: string): void {
    if (this.truncated) return;
    const separatorBytes = this.entries > 0 ? 1 : 0;
    const availableBytes = this.maxBytes - this.bytes - separatorBytes;
    const stringBytes = jsonStringBytesUpTo(text, availableBytes);
    if (stringBytes === undefined) {
      this.truncated = true;
      const prefix = truncateJsonStringBytes(text, availableBytes);
      if (prefix.length > 0) {
        const prefixBytes = jsonStringBytesUpTo(prefix, availableBytes);
        /* v8 ignore next -- truncateJsonStringBytes bảo đảm tiền tố trả về vừa chỗ. */
        if (prefixBytes === undefined) throw new CapturedError("program output ledger produced an oversized log prefix");
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
   * Ngân sách byte JSON chính xác còn lại cho giá trị hoàn tất hoặc thông điệp lỗi.
   * Nhận: không.
   * Trả: số byte còn dùng được.
   */
  remainingOutputBytes(): number {
    return this.maxBytes - this.bytes;
  }
}

/** Năm phương thức console mà shim bắt, theo từ vựng mức của seam. */
const CONSOLE_LEVELS = ["log", "info", "warn", "error", "debug"] as const;

/** Một tên mức console được shim hỗ trợ. */
type ConsoleLevel = (typeof CONSOLE_LEVELS)[number];

/** Tham số `inspect` bị chặn: đủ sâu để hữu ích, đủ chặn để giá trị bệnh lý không nổ hình dạng. */
const INSPECT_OPTIONS = {
  depth: 4,
  maxArrayLength: 100,
  maxStringLength: 1e4,
};

/**
 * Console thay thế: năm phương thức có mức hiển thị tham số kiểu `util.inspect` (đủ giống console thật
 * để model nhận ra đầu ra của chính nó) vào bộ đệm. Chỉ năm phương thức này tồn tại — chương trình nhận
 * console cố ý nhỏ, không phải toàn bộ API console của Node.
 * Nhận: bộ đệm mà mọi dòng đã hiển thị được đẩy vào.
 * Trả: object console năm phương thức trao cho chương trình.
 */
export function makeConsoleShim(logs: Pick<LogBuffer, "push">): Record<ConsoleLevel, (...args: unknown[]) => void> {
  const render = (args: unknown[]): string =>
    args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, INSPECT_OPTIONS))).join(" ");
  const shim: Record<ConsoleLevel, (...args: unknown[]) => void> = Object.create(null);
  for (const level of CONSOLE_LEVELS) {
    shim[level] = (...args: unknown[]): void => {
      logs.push(render(args));
    };
  }
  return shim;
}

/**
 * Chuyển `write` của một luồng vào bộ đệm log (chính `process.stdout`/`process.stderr` mà chương trình
 * thấy trong tiến trình con), để các lượt ghi thô rơi đúng thứ tự phát cùng đầu ra console thay vì đua
 * trên một ống. Nó giữ hợp đồng callback tuỳ chọn của Node: callback chạy bất đồng bộ sau khi nhận, kể cả
 * khi ngân sách log bỏ lượt ghi.
 * Nhận: bộ đệm mà các lượt ghi đã bắt được đẩy vào + luồng bị vá slot `write`.
 * Trả: hàm khôi phục (test trong tiến trình gỡ vá; tiến trình con thật không cần).
 */
export function captureStreamWrites(logs: Pick<LogBuffer, "push">, stream: PatchableStream): () => void {
  const original = stream.write;
  stream.write = (chunk: unknown, ...rest: unknown[]): boolean => {
    logs.push(typeof chunk === "string" ? chunk : String(chunk));
    const callback = [rest[0], rest[1]].find((arg) => typeof arg === "function");
    if (typeof callback === "function") {
      queueMicrotask(() => {
        callback(null);
      });
    }
    return true;
  };
  return () => {
    stream.write = original;
  };
}

/**
 * Chuẩn bị giá trị hoàn tất của chương trình cho thông điệp done. Chỉ JSON lossless được qua, và giá trị
 * không vừa ngân sách ngoài cùng còn lại báo `output-limit`; host kiểm lại giao thông thù địch và vẫn
 * là thẩm quyền cho các lượt ghi ống native mà shim chương trình không quan sát được.
 * Nhận: giá trị hoàn tất của chương trình + số byte còn lại sau log đã bắt + trần cấu hình (mặc định
 * bằng số byte còn lại).
 * Trả: mảnh thông điệp done: `{}` cho undefined, ngược lại wire phẳng `{ value }`.
 */
export function prepareCompletion(
  value: unknown,
  remainingOutputBytes: number,
  maxOutputBytes: number = remainingOutputBytes,
): Omit<DoneMessage, "type"> {
  if (value === undefined) return {};
  let snapshot: PtcJsonValue | undefined;
  try {
    snapshot = snapshotPtcJsonValue(value);
  } catch {
    snapshot = undefined;
  }
  if (snapshot === undefined) {
    return prepareFailure("invalid-output", "program completion must be lossless JSON", remainingOutputBytes, maxOutputBytes);
  }
  if (jsonValueBytesUpTo(snapshot, remainingOutputBytes) === undefined) return outputLimit(maxOutputBytes);
  return { value: encodePtcJsonWire(snapshot) };
}

/**
 * Dựng mảnh tràn cố định mà không mang byte biến đổi bị từ chối.
 * Nhận: trần byte ngoài cùng đã cấu hình.
 * Trả: mảnh done chỉ có lỗi `output-limit`.
 */
function outputLimit(maxOutputBytes: number): Omit<DoneMessage, "type"> {
  return {
    error: {
      kind: "output-limit",
      message: `outer output exceeded ${maxOutputBytes} bytes`,
    },
  };
}

/**
 * Nhận một thông điệp lỗi có chặn, hoặc thay bằng chẩn đoán tràn cố định.
 * Nhận: loại lỗi, thông điệp, số byte còn lại, trần byte ngoài cùng.
 * Trả: mảnh done mang `error` (hoặc `output-limit` khi thông điệp không vừa).
 */
function prepareFailure(
  kind: "exception" | "invalid-output" | "output-limit",
  message: string,
  remainingOutputBytes: number,
  maxOutputBytes: number,
): Omit<DoneMessage, "type"> {
  if (jsonStringBytesUpTo(message, remainingOutputBytes) === undefined) return outputLimit(maxOutputBytes);
  return {
    error: {
      kind,
      message,
    },
  };
}

/**
 * Chuẩn bị một giá trị bị chương trình ném ra mà không gửi stack hay chuỗi không chặn qua kênh tiến trình.
 * Nhận: giá trị chương trình ném + số byte còn lại sau log đã bắt + trần cấu hình (mặc định bằng số byte
 * còn lại).
 * Trả: ngoại lệ có chặn hoặc mảnh `output-limit` cố định.
 */
export function prepareException(
  error: unknown,
  remainingOutputBytes: number,
  maxOutputBytes: number = remainingOutputBytes,
): Omit<DoneMessage, "type"> {
  let message: string;
  try {
    const detail = error instanceof CapturedError ? (error.stack ?? error.message) : error;
    message = typeof detail === "string" ? detail : String(detail);
  } catch {
    message = "program threw an unrenderable value";
  }
  return prepareFailure("exception", message, remainingOutputBytes, maxOutputBytes);
}

/** Tay cầm kết toán của một lượt gọi binding đang chờ, khoá theo id trong map pending. Nhận: resolve(value) · reject(error). Trả: kiểu tay cầm. */
export interface PendingCall {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

/** Kiểu constructor cho một lớp từ chối binding mà chương trình thấy. Nhận: memberName · message. Trả: thể hiện Error của namespace. */
export type BindingErrorConstructor = new (memberName: string, message: string) => Error;

/**
 * Hiện thực hoá constructor lỗi thật do một namespace khai.
 * Nhận: descriptor gồm tên lớp global của chương trình và tên thuộc tính mang tên thành viên.
 * Trả: constructor được tiêm vào chương trình và dùng cho các lần từ chối.
 */
export function makeBindingErrorClass(descriptor: {
  name: string;
  memberNameProperty: string;
}): BindingErrorConstructor {
  return class BindingCallError extends CapturedError {
    constructor(memberName: string, message: string) {
      super(message);
      defineBindingErrorField(this, "name", descriptor.name);
      defineBindingErrorField(this, descriptor.memberNameProperty, memberName);
    }
  };
}

/**
 * Tạo lần từ chối riêng của namespace cho một lượt gọi binding hỏng.
 * Nhận: constructor lỗi (có thể undefined), tên thành viên, thông điệp.
 * Trả: thể hiện lỗi của namespace, hoặc Error thường khi namespace không khai lớp lỗi.
 */
function bindingFailure(errorClass: BindingErrorConstructor | undefined, memberName: string, message: string): Error {
  return errorClass ? new errorClass(memberName, message) : new CapturedError(message);
}

/**
 * Dựng mỗi lớp lỗi đã khai đúng một lần để lượt gọi và `instanceof` dùng chung định danh constructor.
 * Nhận: khai báo namespace binding từ payload boot.
 * Trả: map constructor khoá theo global của namespace sở hữu.
 */
export function makeBindingErrorClasses(data: Pick<ProgramBootData, "namespaces">): Map<string, BindingErrorConstructor> {
  const classes = new Map<string, BindingErrorConstructor>();
  for (const namespace of data.namespaces) {
    if (namespace.errorClass) classes.set(namespace.global, makeBindingErrorClass(namespace.errorClass));
  }
  return classes;
}

/**
 * Định tuyến câu trả lời host vào map lượt gọi đang chờ: mỗi câu trả lời kết toán lượt gọi của nó tối đa
 * một lần, và câu trả lời cho id lạ (đi lạc, hoặc bản trùng cho id đã kết toán) bị bỏ qua. Dây dùng chung
 * giữa {@link runPersistentMain} và các test chạy {@link makeNamespaces} độc lập.
 * Nhận: cổng mang sự kiện `message` chứa câu trả lời + map khoá id của các lượt gọi chưa kết toán.
 * Trả: không (listener đã gắn).
 */
export function wireReplies(port: BootstrapPort, pending: Map<number, PendingCall>): void {
  port.on("message", (message) => {
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.ok) {
      const value = decodePtcJsonWire(message.value);
      if (value === undefined) entry.reject(new CapturedError("binding resolution must be lossless JSON"));
      else entry.resolve(value);
    } else entry.reject(new CapturedError(message.message));
  });
}

/**
 * Dựng các object namespace binding mà chương trình thấy: mỗi namespace một global null-prototype, mỗi
 * tên đã khai là một hàm async enumerable riêng bắc cầu qua cổng (`__proto__`/`constructor`/`toString`
 * là khoá thường, không bao giờ đụng prototype). Tham số mất mát bị từ chối trước khi gửi; lỗi clone và
 * câu trả lời lỗi của host chỉ từ chối đúng lượt gọi tương ứng.
 * Nhận: khai báo namespace của payload boot + cổng nhận lượt gọi + map pending + bộ đếm id dùng chung
 * (id tương quan do chương trình phát) + constructor lỗi theo namespace (mặc định dựng từ chính khai báo).
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
    const namespace: Record<string, unknown> = Object.create(null);
    for (const name of names) {
      Object.defineProperty(namespace, name, {
        enumerable: true,
        value: (args: unknown): Promise<unknown> => {
          const errorClass = errorClasses.get(global);
          let detached: PtcJsonValue | undefined;
          try {
            detached = snapshotPtcJsonValue(args);
          } catch {
            detached = undefined;
          }
          if (detached === undefined) {
            return Promise.reject(bindingFailure(errorClass, name, "binding arguments must be lossless JSON"));
          }
          const lossless = detached;
          return new Promise<unknown>((resolve, reject) => {
            const id = nextId.value;
            pending.set(id, {
              resolve,
              reject: (error: Error) => {
                reject(bindingFailure(errorClass, name, error.message));
              },
            });
            try {
              port.postMessage({
                type: "call",
                id,
                global,
                name,
                args: encodePtcJsonWire(lossless),
              });
              nextId.value += 1;
            } catch (error) {
              pending.delete(id);
              const detail = error instanceof CapturedError ? error.message : String(error);
              reject(bindingFailure(errorClass, name, `binding call could not be sent: ${detail}`));
            }
          });
        },
      });
    }
    return namespace;
  });
}
//#endregion
//#region lib/types/environment.js
/** Biến khởi động mà executable native cần trước khi model được đánh giá. Nhận: không. Trả: tập tên biến giữ lại (ReadonlySet). */
export const STARTUP_ENVIRONMENT_NAMES: ReadonlySet<string> = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP",
]);

/**
 * Xoá thông tin đăng nhập kế thừa nhưng giữ đường khởi động của tiến trình con native.
 * Nhận: trạng thái tiến trình con (thuộc tính `env` bị thay bằng object rỗng mà chương trình thấy).
 * Trả: không.
 */
export function clearProgramEnvironment(state: { env: NodeJS.ProcessEnv }): void {
  for (const key of Object.keys(state.env)) {
    if (!STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase())) Reflect.deleteProperty(state.env, key);
  }
  state.env = Object.create(null);
}
//#endregion
//#region lib/types/persistent-process.js
/** Trạng thái tiến trình do tiến trình con REPL sở hữu; test cấp luồng và môi trường riêng của nó. Nhận: env · stdout · stderr · chdir. Trả: kiểu trạng thái tiến trình. */
export interface PersistentProcess {
  env: NodeJS.ProcessEnv;
  stdout: PatchableStream;
  stderr: PatchableStream;
  chdir(directory: string): void;
}

/** Mảnh thông điệp done mà một lượt đánh giá có thể gửi. */
type DoneResult = Omit<DoneMessage, "type">;

/** Một lượt đánh giá đang sống trong context REPL. */
interface Evaluation {
  id: number;
  logs: LogBuffer;
  maxOutputBytes: number;
  active: boolean;
  finish(result: DoneResult): void;
}

/** Mục lớp lỗi đã dựng cho một namespace. */
interface ErrorClassEntry {
  name: string;
  memberNameProperty: string;
  constructor: BindingErrorConstructor;
}

/**
 * Phục vụ các lượt đánh giá tuần tự cho tới khi host sở hữu đóng kênh điều khiển.
 * Nhận: luồng đầu mút điều khiển riêng đã kế thừa + trần byte khung/thông điệp + trạng thái tiến trình con
 * (môi trường, đầu ra và điều khiển thư mục, chỉ gắn trong context REPL).
 * Trả: Promise hoàn tất sau khi kênh đóng và REPL nhả các luồng của nó.
 */
export async function runPersistentMain(stream: Duplex, maxMessageBytes: number, processState: PersistentProcess): Promise<void> {
  if (!Number.isSafeInteger(maxMessageBytes) || maxMessageBytes <= 0 || maxMessageBytes > 4294967295) {
    throw new Error("invalid control message limit");
  }
  clearProgramEnvironment(processState);
  const context = new AsyncLocalStorage<Evaluation>();
  const closed = Promise.withResolvers<void>();
  const pending = new Map<number, PendingCall>();
  const nextId = { value: 1 };
  const errors = new Map<string, ErrorClassEntry>();
  const errorLookup = { get: (name: string): BindingErrorConstructor | undefined => errors.get(name)?.constructor };
  const replies: ((message: ReplyMessage) => void)[] = [];
  const input = new PassThrough();
  const output = new Writable({
    write(chunk, _encoding, callback) {
      const current = context.getStore();
      const message = chunk.toString().trim();
      if (current?.active && message) {
        current.finish(prepareException(message, current.logs.remainingOutputBytes(), current.maxOutputBytes));
      }
      callback();
    },
  });
  const repl = start({
    input,
    output,
    terminal: false,
    prompt: "",
    useGlobal: false,
    ignoreUndefined: true,
  });
  for (const name of ["_", "_error"]) {
    Object.defineProperty(repl.context, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined,
    });
  }
  let current: Evaluation | undefined;
  const send = (id: number, payload: ProgramToHost): void => {
    channel.send({ id, payload }).catch(() => {
      channel.close();
      closed.resolve(undefined);
    });
  };
  const port: BootstrapPort = {
    postMessage(payload: ProgramToHost): void {
      const evaluation = context.getStore();
      if (!evaluation?.active) throw new Error("PTC evaluation has ended; call this function from a new run_code evaluation");
      send(evaluation.id, payload);
    },
    on(_event: "message", listener: (message: ReplyMessage) => void): void {
      replies.push(listener);
    },
  };
  wireReplies(port, pending);
  const logSink = {
    push(text: string): void {
      const evaluation = context.getStore();
      if (evaluation?.active) evaluation.logs.push(text);
    },
  };
  repl.context.console = makeConsoleShim(logSink);
  Object.defineProperty(repl.context, "process", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: processState,
  });
  captureStreamWrites(logSink, processState.stdout);
  captureStreamWrites(logSink, processState.stderr);
  const channel = new JsonChannel(
    stream,
    maxMessageBytes,
    (raw) => {
      const message = raw as ReplyMessage | RunMessage;
      if (message.type === "reply") {
        for (const listener of replies) listener(message);
        return;
      }
      if (current?.active) {
        channel.close();
        closed.resolve(undefined);
        return;
      }
      const { id, data } = message;
      const logs = new LogBuffer(
        data.maxOutputBytes,
        (text) => {
          send(id, { type: "log", text });
        },
        () => {
          send(id, { type: "output-limit" });
        },
      );
      const evaluation: Evaluation = {
        id,
        logs,
        maxOutputBytes: data.maxOutputBytes,
        active: true,
        finish(result: DoneResult): void {
          if (!evaluation.active) return;
          evaluation.active = false;
          for (const call of pending.values()) {
            call.reject(new Error("PTC evaluation ended before the binding completed"));
          }
          pending.clear();
          send(id, { type: "done", ...result });
        },
      };
      current = evaluation;
      context.run(evaluation, () => {
        try {
          processState.chdir(message.cwd);
          for (const namespace of data.namespaces) {
            const descriptor = namespace.errorClass;
            if (!descriptor) {
              errors.delete(namespace.global);
              continue;
            }
            const previous = errors.get(namespace.global);
            if (previous?.name === descriptor.name && previous.memberNameProperty === descriptor.memberNameProperty) {
              continue;
            }
            const constructor = makeBindingErrorClass(descriptor);
            errors.set(namespace.global, {
              name: descriptor.name,
              memberNameProperty: descriptor.memberNameProperty,
              constructor,
            });
          }
          const namespaces = makeNamespaces(data, port, pending, nextId, errorLookup);
          for (const [index, namespace] of data.namespaces.entries()) {
            Object.defineProperty(repl.context, namespace.global, {
              configurable: true,
              value: namespaces[index],
            });
            if (namespace.errorClass) {
              Object.defineProperty(repl.context, namespace.errorClass.name, {
                configurable: true,
                value: errorLookup.get(namespace.global),
              });
            }
          }
          const program = data.code.trimStart().startsWith("{") ? `;${data.code}` : data.code;
          repl.eval(`${program}\n`, repl.context, "ptc-repl", (error, value) => {
            evaluation.finish(
              error
                ? prepareException(error, logs.remainingOutputBytes(), data.maxOutputBytes)
                : prepareCompletion(value, logs.remainingOutputBytes(), data.maxOutputBytes),
            );
          });
        } catch (error) {
          evaluation.finish(prepareException(error, logs.remainingOutputBytes(), data.maxOutputBytes));
        }
      });
    },
    () => {
      channel.close();
      closed.resolve(undefined);
    },
  );
  stream.once("close", () => {
    closed.resolve(undefined);
  });
  try {
    await channel.send({ type: "ready" });
    await closed.promise;
  } finally {
    if (current) current.active = false;
    repl.close();
    input.destroy();
    output.destroy();
    channel.close();
    context.disable();
  }
}
//#endregion
//#region lib/types/persistent-process-entry.js
/* Điểm vào (nguồn dòng 1184) KHÔNG đặt ở đây: theo quy ước của gói, `persistent-process-entry.ts` (do
 * orchestrator nối) gọi `runPersistentMain(openInheritedControlChannel(), Number(process.argv[2]), process)`
 * — nhờ vậy gói build ra `lib/persistent-process.js` có đúng một hiệu ứng phụ lúc chạy, còn module này
 * import được từ test. */
//#endregion
