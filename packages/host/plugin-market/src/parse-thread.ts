/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/parse-thread.js' của @deepseek-ai/dsh-plugin-market (vùng lib/index.js dòng 40–123):
 *      workerSpawn + isResult + parseIndexInWorker — chạy parseIndexBody trong MỘT Worker Thread mới, chuyển
 *      transferList [body.buffer], terminate, theo dõi error/exit/message và AbortSignal. KHÁC stock ĐÚNG MỘT
 *      chỗ bắt buộc: nhánh đã build trỏ './worker.js' (gói ta build ra lib/worker.js; stock là './worker.cjs');
 *      nhánh source giữ nguyên bootstrap tsx như stock (chỉ dùng khi chạy source trực tiếp).
 */
import { Worker } from "node:worker_threads";
import type { IndexParseRequest, IndexParseResult } from "./parse.ts";

/** Entry Worker và tuỳ chọn khởi tạo mà `workerSpawn` chọn cho môi trường chạy hiện tại. */
interface WorkerSpawn {
  /** URL entry: file `.js` đã build, hoặc `data:` URL bootstrap tsx khi chạy source trực tiếp. */
  readonly entry: URL;
  /** Tuỳ chọn `Worker` bổ sung — luôn rỗng `execArgv` để Worker không thừa kế cờ của tiến trình cha. */
  readonly options: { readonly execArgv: string[] };
}

/** Hình dạng tối thiểu của một message Worker — `isResult` kiểm từng trường trước khi tin. */
interface WorkerMessage {
  /** `true` khi parse thành công. */
  readonly ok?: unknown;
  /** Index đã validate khi `ok === true`. */
  readonly index?: unknown;
  /** JSON path của vi phạm khi `ok === false`. */
  readonly path?: unknown;
  /** Luật bị vi phạm khi `ok === false`. */
  readonly reason?: unknown;
  /** Chẩn đoán khi `ok === false`. */
  readonly message?: unknown;
}

/** Runs index parsing in a fresh Worker Thread, so a large index does not block the Host event loop. */
function workerSpawn(): WorkerSpawn {
  // KHÁC stock ĐÚNG MỘT chỗ bắt buộc: gói ta build ra lib/worker.js (xem build.ts), stock build ra worker.cjs.
  /* v8 ignore next -- built-artifact runs own the bundled path. */
  if (!import.meta.url.endsWith(".ts"))
    return { entry: new URL("./worker.js", import.meta.url), options: { execArgv: [] } };
  const bootstrap = [
    `import { register as registerEsm } from ${JSON.stringify(import.meta.resolve("tsx/esm/api"))}`,
    `import { register as registerCjs } from ${JSON.stringify(import.meta.resolve("tsx/cjs/api"))}`,
    "registerCjs()",
    "registerEsm()",
    `await import(${JSON.stringify(new URL("./worker.ts", import.meta.url).href)})`,
  ].join("\n");
  return { entry: new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), options: { execArgv: [] } };
}

/** Whether a Worker message is a parse result: an index object, or a violation's path, reason, and message. */
function isResult(value: unknown): value is IndexParseResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as WorkerMessage;
  return result.ok === true
    ? typeof result.index === "object" && result.index !== null
    : result.ok === false && [result.path, result.reason, result.message].every((field) => typeof field === "string");
}

/**
 * Run `parseIndexBody` in a fresh Worker Thread. The body's buffer is transferred to the Worker and is unusable
 * afterwards; the result is copied back by structured clone.
 * @param body - the complete response body; it must own its whole buffer.
 * @param url - the index URL.
 * @param signal - terminates the Worker and rejects with the signal's reason.
 * @returns the Worker's result.
 * @throws the abort reason, or an Error when the Worker fails, exits without a result, or reports an unexpected value.
 */
export async function parseIndexInWorker(
  body: Uint8Array,
  url: string,
  signal: AbortSignal,
): Promise<IndexParseResult> {
  signal.throwIfAborted();
  const { entry, options } = workerSpawn();
  const request: IndexParseRequest = { body, url };
  // transferList nhận THẲNG buffer của thân phản hồi (body phải sở hữu trọn buffer, như stock); `as ArrayBuffer`
  // chỉ thu hẹp ArrayBufferLike → ArrayBuffer cho typings của WorkerOptions, KHÔNG đổi giá trị chuyển giao.
  const worker = new Worker(entry, { ...options, workerData: request, transferList: [body.buffer as ArrayBuffer] });
  return await new Promise<IndexParseResult>((resolve, reject) => {
    let settled = false;
    const settle = (finish: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      // The outcome stands whether or not termination succeeds.
      worker.terminate().then(finish, finish);
    };
    const abort = (): void => {
      settle(() => {
        reject(signal.reason);
      });
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", (value: unknown) => {
      settle(() => {
        if (isResult(value)) resolve(value);
        else reject(new Error("index parser reported an unexpected value"));
      });
    });
    worker.once("error", (error) => {
      settle(() => {
        reject(error);
      });
    });
    worker.once("exit", (code) => {
      settle(() => {
        reject(new Error(`index parser exited before reporting a result (code ${String(code)})`));
      });
    });
  });
}
