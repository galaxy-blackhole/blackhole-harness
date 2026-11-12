/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa browser của gbh-client-file-upload: service Cordis `fileUpload` — tải Blob/luồng byte
 *      bằng carrier nền (Worker + XHR/fetch có tiến độ, huỷ được), còn byte chính xác đi qua RPC Remote.
 *      Port 1:1 lib/client.js của @deepseek-ai/dsh-client-file-upload.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";

import { PACKAGE_NAME } from "./ids.ts";

/** Đường dẫn route tải tệp trên Host (nguyên văn bản gốc). */
export const FILE_UPLOAD_PATH = "/api/session/uploadFileBinary";

/** Dạng TƯƠNG ĐỐI theo document của route tải tệp (bản gốc cắt dấu / đầu). */
export const FILE_UPLOAD_ROUTE = FILE_UPLOAD_PATH.slice(1);

/** Cỡ khối khi mã hoá base64: 32768 byte, tránh tràn giới hạn đối số của String.fromCharCode. */
export const BASE64_CHUNK = 32768;

/**
 * Lỗi Remote dùng chung giữa chủ service, Gateway và consumer.
 * Bản bundle gốc NHÚNG lớp này (không require typert-protocol) — nhận diện bằng isDSHRemoteError/code.
 */
export class RemoteError extends Error {
  /** Mã lỗi ổn định khai trong bảng chi tiết của typert. */
  readonly code: string;
  /** Chi tiết có cấu trúc, kiểu theo mã lỗi. */
  readonly details: Record<string, unknown>;
  /** Dấu hiệu cấu trúc cho nhận diện xuyên realm. */
  isDSHRemoteError = true;

  /**
   * Tạo một lỗi Remote.
   * @param code - mã lỗi ổn định.
   * @param message - chẩn đoán người đọc được, mang nguyên qua dây.
   * @param details - chi tiết có cấu trúc theo mã lỗi.
   * @param options - tuỳ chọn chuẩn của Error (cause chỉ sống trong tiến trình).
   */
  constructor(code: string, message: string, details: Record<string, unknown>, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.details = details;
    this.name = "RemoteError";
  }
}

/** Tiến độ byte đơn điệu trong lúc carrier nền đọc thân. */
export interface FileUploadProgress {
  /** Số byte đã gửi/đọc tới thời điểm báo. */
  readonly loaded: number;
  /** Tổng số byte khi carrier biết trước (Blob); vắng với luồng. */
  readonly total?: number;
}

/** Thân yêu cầu mà service tải tệp phía browser nhận. */
export type FileUploadBody = Blob | ReadableStream<Uint8Array>;

/** Một yêu cầu gửi thân tệp qua carrier. */
export interface FileUploadRequest {
  /** Route tương đối theo document, kèm query. */
  readonly path: string;
  /** Thân: Blob hoặc luồng byte một lần. */
  readonly body: FileUploadBody;
  /** Header tuỳ chọn. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Huỷ giữa chừng. */
  readonly signal?: AbortSignal;
  /** Quan sát tiến độ byte. */
  readonly onProgress?: (progress: FileUploadProgress) => void;
}

/** Phản hồi thô của carrier. */
export interface FileUploadResponse {
  /** Mã trạng thái HTTP. */
  readonly status: number;
  /** Thân dạng chuỗi. */
  readonly body: string;
}

/** Thân yêu cầu mà Worker nền nhận. */
interface UploadWorkerStart {
  /** URL tuyệt đối đã giải theo document.baseURI. */
  readonly url: string;
  /** Thân: Blob hoặc luồng byte. */
  readonly body: FileUploadBody;
  /** Header gửi kèm. */
  readonly headers: Readonly<Record<string, string>>;
}

/** Thông điệp Worker nền gửi về trang. */
type UploadWorkerOutput =
  | { readonly kind: "progress"; readonly loaded: number; readonly total?: number }
  | { readonly kind: "complete"; readonly status: number; readonly body: string }
  | { readonly kind: "error"; readonly message: string };

/** Phạm vi Worker tối thiểu mà thân Worker dùng (để test được bằng vật giả). */
interface UploadWorkerScope {
  /** Nhận yêu cầu từ trang. */
  onmessage: ((event: MessageEvent<UploadWorkerStart>) => void) | null;
  /** Gửi thông điệp về trang. */
  postMessage(message: UploadWorkerOutput): void;
}

/** XHR tối thiểu mà thân Worker dùng cho nhánh Blob. */
interface UploadXhr {
  /** Sự kiện tiến độ tải lên. */
  readonly upload: { onprogress: ((event: ProgressEvent) => void) | null };
  /** Mã trạng thái sau khi xong. */
  status: number;
  /** Thân phản hồi dạng chuỗi. */
  responseText: string;
  /** Gửi kèm cookie phiên. */
  withCredentials: boolean;
  /** Xong. */
  onload: ((event: ProgressEvent) => void) | null;
  /** Hỏng vận chuyển. */
  onerror: ((event: ProgressEvent) => void) | null;
  /** Mở yêu cầu. */
  open(method: string, url: string): void;
  /** Đặt header. */
  setRequestHeader(name: string, value: string): void;
  /** Gửi thân Blob. */
  send(body: Blob): void;
}

/** Fetch dùng cho nhánh luồng byte (cần duplex: half). */
type UploadWorkerFetch = (input: string, init: RequestInit & { readonly duplex: "half" }) => Promise<Response>;

/** Carrier của một trang tự cấp Host transport (hook trước Cordis). */
export type FileUploadFetch = (input: string | URL, init: RequestInit) => Promise<Response>;

/** Tham chiếu tệp bền vững mà Host trả về. */
export interface FileUploadValue {
  /** Biên nhận staged. */
  readonly receiptId: string;
  /** Tham chiếu tệp bền vững. */
  readonly file: { readonly attachmentId: string; readonly name: string; readonly bytes: number };
}

/** Kết quả một lần tải: thành công kèm biên nhận, hoặc thất bại nghiệp vụ kèm RemoteError. */
export type FileUploadResult =
  | { readonly ok: true; readonly value: FileUploadValue }
  | { readonly ok: false; readonly error: RemoteError };

/** Service phía browser mà consumer gọi (ctx.fileUpload). */
export interface FileUploadService {
  /**
   * Lưu MỘT tệp cho một Session. Blob/luồng đi carrier nền; byte chính xác đi Remote.
   * @param sessionId - Session sở hữu biên nhận staged.
   * @param data - Blob, byte chính xác, hoặc luồng byte một lần.
   * @param name - tên hiển thị tuỳ chọn.
   * @param signal - huỷ cho lượt tải đang chạy.
   * @param onProgress - quan sát tiến độ byte cho thân nền.
   * @returns biên nhận staged + tham chiếu tệp, hoặc lỗi nghiệp vụ.
   */
  upload(
    sessionId: string,
    data: Blob | Uint8Array | ReadableStream<Uint8Array>,
    name?: string,
    signal?: AbortSignal,
    onProgress?: (progress: FileUploadProgress) => void,
  ): Promise<FileUploadResult>;
}

/** Carrier gửi thân tệp. */
export interface FileUploadTransport {
  /**
   * Gửi MỘT yêu cầu.
   * @param request - đích, thân, huỷ, và quan sát tiến độ.
   * @returns mã trạng thái và thân dạng chuỗi.
   */
  post(request: FileUploadRequest): Promise<FileUploadResponse>;
}

/** Mặt Remote mà host cấp cho nửa browser (ctx.remote.fileUploads). */
interface RemoteFileUploads {
  /**
   * Lưu tệp đã mã hoá base64 qua RPC.
   * @param sessionId - Session sở hữu biên nhận.
   * @param request - base64 canonical và tên hiển thị tuỳ chọn.
   * @param signal - huỷ trước khi lưu.
   * @returns kết quả Remote.
   */
  upload(sessionId: string, request: { readonly data: string; readonly name?: string }, signal?: AbortSignal): Promise<FileUploadResult>;
}

/** Context tối thiểu mà nửa browser đọc (khai theo CẤU TRÚC — luật 000d). */
interface ClientUploadContext {
  /** Dịch vụ Remote do row api-remotes cấp. */
  readonly remote: { readonly fileUploads: RemoteFileUploads };
}

/**
 * Mã hoá byte thành base64 chuẩn tắc theo từng khối 32768 byte.
 * @param data - mảng byte.
 * @returns chuỗi base64.
 */
export function bytesToBase64(data: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < data.length; offset += BASE64_CHUNK) {
    binary += String.fromCharCode(...data.subarray(offset, offset + BASE64_CHUNK));
  }
  return btoa(binary);
}

/**
 * Thân Worker TỰ CHỨA; dạng chuỗi của nó thành nguồn Blob Worker.
 * Nhánh Blob dùng XHR (có tiến độ, withCredentials); nhánh luồng dùng fetch với duplex: half.
 * @param scope - phạm vi Worker dùng để nhận yêu cầu và gửi tiến độ.
 * @param createXhr - factory XMLHttpRequest cho thân Blob.
 * @param doFetch - carrier Fetch cho thân ReadableStream một lần.
 * @returns không.
 */
export function fileUploadWorker(
  scope: UploadWorkerScope = self as unknown as UploadWorkerScope,
  createXhr: () => UploadXhr = () => new XMLHttpRequest() as unknown as UploadXhr,
  doFetch: UploadWorkerFetch = (input, init) => fetch(input, init),
): void {
  scope.onmessage = (event) => {
    const request = event.data;
    if (request.body instanceof Blob) {
      const xhr = createXhr();
      xhr.open("POST", request.url);
      xhr.withCredentials = true;
      for (const [name, value] of Object.entries(request.headers)) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = (progress) => {
        scope.postMessage({
          kind: "progress",
          loaded: progress.loaded,
          ...(progress.lengthComputable ? { total: progress.total } : {}),
        });
      };
      xhr.onload = () => {
        scope.postMessage({ kind: "complete", status: xhr.status, body: xhr.responseText });
      };
      xhr.onerror = () => {
        scope.postMessage({ kind: "error", message: "background upload transport failed" });
      };
      xhr.send(request.body);
      return;
    }
    if (!(request.body instanceof ReadableStream)) {
      scope.postMessage({ kind: "error", message: "background upload worker received an invalid body" });
      return;
    }
    const source = request.body;
    void (async () => {
      const reader = source.getReader();
      let loaded = 0;
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const item = await reader.read();
          if (item.done) {
            controller.close();
            return;
          }
          if (!(item.value instanceof Uint8Array)) throw new TypeError("background upload stream produced a non-Uint8Array chunk");
          loaded += item.value.byteLength;
          scope.postMessage({ kind: "progress", loaded });
          controller.enqueue(item.value);
        },
        async cancel(reason) {
          await reader.cancel(reason);
        },
      });
      const response = await doFetch(request.url, {
        method: "POST",
        headers: request.headers as Record<string, string>,
        credentials: "include",
        body,
        duplex: "half",
      });
      scope.postMessage({ kind: "complete", status: response.status, body: await response.text() });
    })().catch((error: unknown) => {
      scope.postMessage({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    });
  };
}

/**
 * Carrier dùng fetch được tiêm qua hook (trang tự cấp Host transport).
 * @param customFetch - hàm fetch thay thế.
 * @returns carrier.
 */
export function customTransport(customFetch: FileUploadFetch): FileUploadTransport {
  return {
    async post(request) {
      const init: RequestInit = {
        method: "POST",
        ...(request.headers === undefined ? {} : { headers: request.headers as Record<string, string> }),
        body: request.body,
        ...(request.body instanceof ReadableStream ? { duplex: "half" } : {}),
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      };
      const response = await customFetch(request.path, init);
      return { status: response.status, body: await response.text() };
    },
  };
}

/**
 * Carrier mặc định: một Worker nền cho MỖI lượt tải, huỷ được, có tiến độ.
 * Nguyên văn bản gốc: tên Worker 'dsh-file-upload' là nhãn debug nội bộ, không phải hợp đồng.
 * @returns carrier.
 */
export function workerTransport(): FileUploadTransport {
  return {
    post(request) {
      if (typeof Worker !== "function") return Promise.reject(new Error("background upload requires Web Worker support"));
      const workerUrl = URL.createObjectURL(new Blob(["(" + fileUploadWorker.toString() + ")()"], { type: "text/javascript" }));
      const worker = new Worker(workerUrl, { name: "dsh-file-upload" });
      URL.revokeObjectURL(workerUrl);
      return new Promise<FileUploadResponse>((resolve, reject) => {
        let settled = false;
        const abort = (): void => {
          settled = true;
          worker.terminate();
          request.signal?.removeEventListener("abort", abort);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        };
        const finish = (settle: () => void): void => {
          if (settled) return;
          settled = true;
          request.signal?.removeEventListener("abort", abort);
          worker.terminate();
          settle();
        };
        worker.onmessage = (event: MessageEvent<UploadWorkerOutput>) => {
          const output = event.data;
          if (output.kind === "progress") {
            request.onProgress?.({ loaded: output.loaded, ...(output.total === undefined ? {} : { total: output.total }) });
          } else if (output.kind === "complete") {
            finish(() => {
              resolve({ status: output.status, body: output.body });
            });
          } else {
            finish(() => {
              reject(new Error(output.message));
            });
          }
        };
        worker.onerror = (event: ErrorEvent) => {
          finish(() => {
            reject(new Error(event.message || "background upload worker failed"));
          });
        };
        if (request.signal?.aborted === true) {
          abort();
          return;
        }
        request.signal?.addEventListener("abort", abort, { once: true });
        const message: UploadWorkerStart = { url: new URL(request.path, document.baseURI).href, body: request.body, headers: request.headers ?? {} };
        if (request.body instanceof ReadableStream) worker.postMessage(message, [request.body]);
        else worker.postMessage(message);
      });
    },
  };
}

/**
 * Đọc thân JSON của route tải tệp thành kết quả có kiểu, kiểm chặt từng trường.
 * @param body - thân phản hồi dạng chuỗi.
 * @returns kết quả thành công hoặc thất bại nghiệp vụ.
 * @throws TypeError khi thân không đúng hợp đồng (khác lỗi nghiệp vụ).
 */
export function parseFileUploadResult(body: string): FileUploadResult {
  const value = JSON.parse(body) as unknown;
  if (!isRecord(value) || typeof value.ok !== "boolean") throw new TypeError("file upload transport returned an invalid result");
  if (!value.ok) {
    const error = value.error;
    if (!isRecord(error) || typeof error.code !== "string" || typeof error.message !== "string" || !isRecord(error.details)) {
      throw new TypeError("file upload transport returned an invalid failure");
    }
    return { ok: false, error: new RemoteError(error.code, error.message, error.details) };
  }
  const result = value.value;
  const file = isRecord(result) ? result.file : undefined;
  if (
    !isRecord(result) ||
    typeof result.receiptId !== "string" ||
    !isRecord(file) ||
    typeof file.attachmentId !== "string" ||
    typeof file.name !== "string" ||
    typeof file.bytes !== "number" ||
    !Number.isSafeInteger(file.bytes) ||
    file.bytes < 0
  ) {
    throw new TypeError("file upload transport returned an invalid receipt");
  }
  return { ok: true, value: { receiptId: result.receiptId, file: { attachmentId: file.attachmentId, name: file.name, bytes: file.bytes } } };
}

/**
 * Kiểm một giá trị có phải bản ghi thuần (không mảng, không null).
 * @param value - giá trị cần kiểm.
 * @returns true khi là object không phải mảng.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Service Cordis sở hữu một carrier nền cho mỗi lượt tải. */
export class FileUploadRuntime extends Service implements FileUploadService {
  /** Carrier đã chọn trước khi Cordis boot. */
  private readonly transport: FileUploadTransport;

  /**
   * Đăng ký service `fileUpload` và chọn carrier theo hook của trang (nếu có).
   * @param ctx - Context phía client đã có dịch vụ `remote`.
   */
  constructor(ctx: Context) {
    super(ctx, "fileUpload");
    const hook = (globalThis as { __GBH_FILE_UPLOAD__?: { fetch: FileUploadFetch } }).__GBH_FILE_UPLOAD__;
    this.transport = hook === undefined ? workerTransport() : customTransport(hook.fetch);
  }

  /**
   * Gửi MỘT thân với carrier đã chọn trước Cordis boot.
   * @param request - đích, thân, huỷ, và quan sát tiến độ.
   * @returns mã trạng thái và thân dạng chuỗi.
   */
  post(request: FileUploadRequest): Promise<FileUploadResponse> {
    return this.transport.post(request);
  }

  /**
   * Lưu MỘT tệp cho một Session.
   * @param sessionId - Session sở hữu biên nhận staged.
   * @param data - Blob, byte chính xác, hoặc luồng byte một lần.
   * @param name - tên hiển thị tuỳ chọn.
   * @param signal - huỷ cho lượt tải đang chạy.
   * @param onProgress - quan sát tiến độ byte cho thân nền.
   * @returns biên nhận staged + tham chiếu tệp, hoặc lỗi nghiệp vụ.
   * @throws Error khi carrier trả mã khác 200.
   */
  async upload(
    sessionId: string,
    data: Blob | Uint8Array | ReadableStream<Uint8Array>,
    name?: string,
    signal?: AbortSignal,
    onProgress?: (progress: FileUploadProgress) => void,
  ): Promise<FileUploadResult> {
    if (!(data instanceof Uint8Array)) {
      const query = new URLSearchParams({ sessionId });
      if (name !== undefined) query.set("name", name);
      const response = await this.post({
        path: FILE_UPLOAD_ROUTE + "?" + query.toString(),
        body: data,
        headers: { "content-type": "application/octet-stream" },
        ...(signal === undefined ? {} : { signal }),
        ...(onProgress === undefined ? {} : { onProgress }),
      });
      if (response.status !== 200) throw new Error("file upload transport failed with HTTP " + String(response.status));
      return parseFileUploadResult(response.body);
    }
    // Nguyên văn bản gốc: đọc qua this.ctx tại CHỖ GỌI (cordis gắn ctx của bên gọi vào service).
    return (this.ctx as unknown as ClientUploadContext).remote.fileUploads.upload(
      sessionId,
      { data: bytesToBase64(data), ...(name === undefined ? {} : { name }) },
      signal,
    );
  }
}

/** Service mà nửa browser cần trước khi cài (nguyên văn bản gốc). */
export const inject = ["remote"];

/**
 * Cài nửa browser: đăng ký service `fileUpload`.
 * @param ctx - Context cordis của client.
 * @returns không.
 */
export function apply(ctx: { plugin(plugin: unknown): unknown }): void {
  ctx.plugin(FileUploadRuntime);
}

/** Tên package, phơi lại cho test canh và cho wrapper của build. */
export { PACKAGE_NAME };
