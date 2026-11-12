/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Ca canh nua browser cua gbh-client-file-upload: carrier Worker (Blob/XHR + luong/fetch),
 *      tien do dang OBJECT, huy giua chung, service Cordis `fileUpload` that, va duong Remote base64.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  BASE64_CHUNK,
  FileUploadRuntime,
  RemoteError,
  apply,
  bytesToBase64,
  customTransport,
  fileUploadWorker,
  inject,
  parseFileUploadResult,
  workerTransport,
} from "../../packages/client/file-upload/src/client.ts";

/** Gốc repo (file này nằm ở tests/client). */
const REPO = join(import.meta.dir, "..", "..");
/** cordis mà nửa browser nạp — cần Context THẬT để Service đăng ký được tên `fileUpload`. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis tối thiểu mà test dùng (khai theo CẤU TRÚC). */
interface CordisContext {
  /** Cấp MỘT dịch vụ cho cây. */
  provide(name: string, value: unknown): unknown;
  /** Tra dịch vụ theo tên. */
  get(name: string): unknown;
  /** Đăng ký plugin. */
  plugin(plugin: unknown): unknown;
}

/** cordis Context của kernel. */
const { Context } = (await import(CORDIS)) as { Context: new () => CordisContext };

/** Thân yêu cầu mà Worker nền nhận (chỉ phần test đọc). */
interface WorkerStart {
  /** URL tuyệt đối. */
  url: string;
  /** Thân. */
  body: unknown;
  /** Header. */
  headers: Record<string, string>;
}

/** Thông điệp Worker nền gửi về (chỉ phần test đọc). */
interface WorkerOutput {
  /** Loại thông điệp. */
  kind: string;
  /** Byte đã xong (progress). */
  loaded?: number;
  /** Tổng byte (progress). */
  total?: number;
  /** Mã trạng thái (complete). */
  status?: number;
  /** Thân phản hồi (complete). */
  body?: string;
  /** Thông điệp lỗi (error). */
  message?: string;
}

/** Phạm vi Worker giả. */
interface FakeScope {
  /** Nhận yêu cầu. */
  onmessage: ((event: { data: WorkerStart }) => void) | null;
  /** Gửi thông điệp về trang. */
  postMessage(message: WorkerOutput): void;
}

/** XHR giả ghi lại mọi lời gọi. */
interface FakeXhr {
  /** Sự kiện tiến độ. */
  upload: { onprogress: ((event: { loaded: number; total: number; lengthComputable: boolean }) => void) | null };
  /** Mã trạng thái. */
  status: number;
  /** Thân phản hồi. */
  responseText: string;
  /** Gửi cookie. */
  withCredentials: boolean;
  /** Xong. */
  onload: (() => void) | null;
  /** Hỏng. */
  onerror: (() => void) | null;
  /** Mở. */
  open(method: string, url: string): void;
  /** Đặt header. */
  setRequestHeader(name: string, value: string): void;
  /** Gửi. */
  send(body: unknown): void;
  /** Nhật ký. */
  log: { method?: string; url?: string; headers: Record<string, string>; sent?: unknown };
}

/**
 * Tạo XHR giả.
 * @returns XHR giả với nhật ký lời gọi.
 */
function fakeXhr(): FakeXhr {
  const xhr: FakeXhr = {
    upload: { onprogress: null },
    status: 0,
    responseText: "",
    withCredentials: false,
    onload: null,
    onerror: null,
    open(method, url) {
      xhr.log.method = method;
      xhr.log.url = url;
    },
    setRequestHeader(name, value) {
      xhr.log.headers[name] = value;
    },
    send(body) {
      xhr.log.sent = body;
    },
    log: { headers: {} },
  };
  return xhr;
}

/** Worker giả cho workerTransport. */
class FakeWorker {
  /** Worker gần nhất được tạo. */
  static last: FakeWorker | undefined;
  /** URL Blob đã dùng. */
  static urls: string[] = [];
  /** Nhận thông điệp từ Worker. */
  onmessage: ((event: { data: WorkerOutput }) => void) | null = null;
  /** Lỗi Worker. */
  onerror: ((event: { message?: string }) => void) | null = null;
  /** Đã terminate chưa. */
  terminated = false;
  /** Thông điệp đã đăng. */
  posted: { message: WorkerStart; transfer?: unknown[] }[] = [];
  /**
   * Ghi lại worker vừa tạo.
   * @param url - URL Blob.
   * @param options - tuỳ chọn Worker (tên).
   */
  constructor(url: string | URL, public readonly options?: { name?: string }) {
    FakeWorker.last = this;
    FakeWorker.urls.push(String(url));
  }
  /**
   * Nhận thông điệp từ trang.
   * @param message - yêu cầu.
   * @param transfer - danh sách chuyển giao.
   */
  postMessage(message: WorkerStart, transfer?: unknown[]): void {
    this.posted.push({ message, ...(transfer === undefined ? {} : { transfer }) });
  }
  /** Kết thúc Worker. */
  terminate(): void {
    this.terminated = true;
  }
}

/** Bản lưu global để khôi phục sau mỗi ca. */
const saved = {
  /** Worker thật (nếu có). */
  worker: (globalThis as { Worker?: unknown }).Worker,
  /** createObjectURL thật. */
  create: URL.createObjectURL,
  /** revokeObjectURL thật. */
  revoke: URL.revokeObjectURL,
  /** document thật (nếu có). */
  document: (globalThis as { document?: unknown }).document,
  /** hook fetch thật. */
  // 20/10/2026 — LÔ ĐỔI TÊN BRAND: hook carrier đổi `__DSH_FILE_UPLOAD__` → `__GBH_FILE_UPLOAD__`
  // (rename CÓ CHỦ ĐÍCH); test phải gắn đúng tên mà carrier thật đọc, không sửa kỳ vọng lỗi HTTP.
  hook: (globalThis as { __GBH_FILE_UPLOAD__?: unknown }).__GBH_FILE_UPLOAD__,
};

/** Khôi phục global sau mỗi ca (bun chạy chung một tiến trình). */
afterEach(() => {
  (globalThis as Record<string, unknown>).Worker = saved.worker;
  URL.createObjectURL = saved.create;
  URL.revokeObjectURL = saved.revoke;
  (globalThis as Record<string, unknown>).document = saved.document;
  (globalThis as Record<string, unknown>).__GBH_FILE_UPLOAD__ = saved.hook;
  FakeWorker.last = undefined;
  FakeWorker.urls = [];
});

/**
 * Cài Worker giả + document giả để workerTransport chạy được trong bun.
 * @returns danh sách URL đã revoke.
 */
function installWorkerStubs(): string[] {
  const revoked: string[] = [];
  (globalThis as Record<string, unknown>).Worker = FakeWorker;
  URL.createObjectURL = (() => "blob:fake-url") as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;
  (globalThis as Record<string, unknown>).document = { baseURI: "http://127.0.0.1:5439/" };
  return revoked;
}

describe("nửa browser — hợp đồng đã chốt với bản gốc", () => {
  test("bytesToBase64 khớp base64 chuẩn tắc qua MỐC khối 32768", () => {
    const bytes = new Uint8Array(40000);
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    expect(BASE64_CHUNK).toBe(32768);
  });

  test("parseFileUploadResult: biên nhận hợp lệ, thất bại nghiệp vụ, và thân sai", () => {
    const ok = parseFileUploadResult(JSON.stringify({ ok: true, value: { receiptId: "r1", file: { attachmentId: "a1", name: "x.txt", bytes: 3 } } }));
    expect(ok).toEqual({ ok: true, value: { receiptId: "r1", file: { attachmentId: "a1", name: "x.txt", bytes: 3 } } });
    const failed = parseFileUploadResult(JSON.stringify({ ok: false, error: { code: "session/not-found", message: "m", details: { sessionId: "s" } } }));
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.isDSHRemoteError).toBe(true);
      expect(failed.error.code).toBe("session/not-found");
      expect(failed.error).toBeInstanceOf(RemoteError);
    }
    expect(() => parseFileUploadResult(JSON.stringify({ ok: true, value: { receiptId: "r", file: { attachmentId: "a", name: "n", bytes: -1 } } }))).toThrow(TypeError);
    expect(() => parseFileUploadResult(JSON.stringify({ ok: true }))).toThrow(TypeError);
  });

  test("customTransport chỉ đặt duplex:half khi thân là ReadableStream, KHÔNG tự gọi onProgress", async () => {
    const seen: RequestInit[] = [];
    let progressCalls = 0;
    const transport = customTransport((async (_url: string | URL, init: RequestInit) => {
      seen.push(init);
      return { status: 200, text: async () => JSON.stringify({ ok: true, value: { receiptId: "r", file: { attachmentId: "a", name: "n", bytes: 0 } } }) };
    }) as unknown as typeof fetch);
    await transport.post({ path: "api/p", body: new Blob(["x"]), onProgress: () => { progressCalls += 1; } });
    expect("duplex" in (seen[0] ?? {})).toBe(false);
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } });
    await transport.post({ path: "api/p", body: stream });
    expect((seen[1] as { duplex?: string }).duplex).toBe("half");
    expect(progressCalls).toBe(0);
  });

  test("apply cài service qua ctx.plugin và khai inject remote", () => {
    const registered: unknown[] = [];
    apply({ plugin: (plugin) => registered.push(plugin) });
    expect(registered).toEqual([FileUploadRuntime]);
    expect(inject).toContain("remote");
  });
});

describe("thân Worker — nhánh Blob dùng XHR có tiến độ + withCredentials", () => {
  test("progress có total khi lengthComputable, KHÔNG có khoá total khi không", () => {
    const messages: WorkerOutput[] = [];
    const xhr = fakeXhr();
    const scope: FakeScope = { onmessage: null, postMessage: (message) => { messages.push(message); } };
    fileUploadWorker(scope as never, () => xhr, async () => new Response("unused"));
    scope.onmessage!({ data: { url: "http://h/api/session/uploadFileBinary?sessionId=s1", body: new Blob(["ab"]), headers: { "content-type": "application/octet-stream" } } });
    expect(xhr.log.method).toBe("POST");
    expect(xhr.log.url).toBe("http://h/api/session/uploadFileBinary?sessionId=s1");
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.log.headers).toEqual({ "content-type": "application/octet-stream" });
    expect(xhr.log.sent).toBeInstanceOf(Blob);
    xhr.upload.onprogress!({ loaded: 5, total: 10, lengthComputable: true });
    xhr.upload.onprogress!({ loaded: 6, total: 0, lengthComputable: false });
    expect(messages).toEqual([
      { kind: "progress", loaded: 5, total: 10 },
      { kind: "progress", loaded: 6 },
    ]);
    expect("total" in messages[1]!).toBe(false);
    xhr.status = 200;
    xhr.responseText = "done";
    xhr.onload!();
    expect(messages.at(-1)).toEqual({ kind: "complete", status: 200, body: "done" });
    xhr.onerror!();
    expect(messages.at(-1)).toEqual({ kind: "error", message: "background upload transport failed" });
  });
});

describe("thân Worker — nhánh luồng byte dùng fetch duplex:half", () => {
  test("chuyển từng khối, báo progress, gửi credentials + header, trả complete", async () => {
    const messages: WorkerOutput[] = [];
    const scope: FakeScope = { onmessage: null, postMessage: (message) => { messages.push(message); } };
    const seen: { url?: string; init?: RequestInit } = {};
    const doFetch = async (url: string, init: RequestInit & { readonly duplex: "half" }) => {
      seen.url = url;
      seen.init = init;
      // fetch THẬT đọc thân ⇒ phải đọc để luồng được pull (nếu không sẽ không có progress).
      const body = init.body as ReadableStream<Uint8Array>;
      const reader = body.getReader();
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
      }
      return new Response("stream-done");
    };
    fileUploadWorker(scope as never, fakeXhr, doFetch as never);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    scope.onmessage!({ data: { url: "http://h/api/x", body: stream, headers: { a: "b" } } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(seen.url).toBe("http://h/api/x");
    expect(seen.init?.method).toBe("POST");
    expect((seen.init as { credentials?: string }).credentials).toBe("include");
    expect((seen.init as { duplex?: string }).duplex).toBe("half");
    expect(seen.init?.headers).toEqual({ a: "b" });
    expect(messages).toEqual([
      { kind: "progress", loaded: 2 },
      { kind: "progress", loaded: 3 },
      { kind: "complete", status: 200, body: "stream-done" },
    ]);
  });

  test("thân không hợp lệ và lỗi fetch đều trả thông điệp error (không treo)", async () => {
    const messages: WorkerOutput[] = [];
    const scope: FakeScope = { onmessage: null, postMessage: (message) => { messages.push(message); } };
    fileUploadWorker(scope as never, fakeXhr, (async () => { throw new Error("net down"); }) as never);
    scope.onmessage!({ data: { url: "http://h/api/x", body: {}, headers: {} } });
    expect(messages.at(-1)).toEqual({ kind: "error", message: "background upload worker received an invalid body" });
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } });
    scope.onmessage!({ data: { url: "http://h/api/x", body: stream, headers: {} } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(messages.at(-1)).toEqual({ kind: "error", message: "net down" });
  });
});

describe("workerTransport — một Worker nền cho MỖI lượt, huỷ được, URL theo document.baseURI", () => {
  test("tạo worker tên dsh-file-upload, revoke URL, gửi URL tuyệt đối + progress là OBJECT", async () => {
    const revoked = installWorkerStubs();
    const progress: { loaded: number; total?: number }[] = [];
    const pending = workerTransport().post({
      path: "api/session/uploadFileBinary?sessionId=s1",
      body: new Blob(["x"]),
      headers: { "content-type": "application/octet-stream" },
      onProgress: (value) => { progress.push(value); },
    });
    const worker = FakeWorker.last!;
    expect(worker.options?.name).toBe("dsh-file-upload");
    expect(revoked).toEqual(["blob:fake-url"]);
    expect(worker.posted[0]?.message.url).toBe("http://127.0.0.1:5439/api/session/uploadFileBinary?sessionId=s1");
    expect(worker.posted[0]?.message.headers).toEqual({ "content-type": "application/octet-stream" });
    worker.onmessage!({ data: { kind: "progress", loaded: 3, total: 9 } });
    worker.onmessage!({ data: { kind: "progress", loaded: 4 } });
    expect(progress).toEqual([{ loaded: 3, total: 9 }, { loaded: 4 }]);
    worker.onmessage!({ data: { kind: "complete", status: 200, body: "ok" } });
    expect(await pending).toEqual({ status: 200, body: "ok" });
    expect(worker.terminated).toBe(true);
  });

  test("thông điệp error ⇒ reject; terminate; không resolve lần hai", async () => {
    installWorkerStubs();
    const pending = workerTransport().post({ path: "api/x", body: new Blob(["x"]) });
    const worker = FakeWorker.last!;
    worker.onmessage!({ data: { kind: "error", message: "boom" } });
    let thrown: unknown;
    try {
      await pending;
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe("boom");
    expect(worker.terminated).toBe(true);
  });

  test("huỷ SAU khi bắt đầu ⇒ AbortError + terminate; huỷ TRƯỚC ⇒ reject ngay không tạo worker", async () => {
    installWorkerStubs();
    const controller = new AbortController();
    const pending = workerTransport().post({ path: "api/x", body: new Blob(["x"]), signal: controller.signal });
    const worker = FakeWorker.last!;
    controller.abort();
    let thrown: unknown;
    try {
      await pending;
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).name).toBe("AbortError");
    expect((thrown as Error).message).toBe("The operation was aborted.");
    expect(worker.terminated).toBe(true);

    const before = new AbortController();
    before.abort();
    let immediate: unknown;
    try {
      await workerTransport().post({ path: "api/x", body: new Blob(["x"]), signal: before.signal });
    } catch (error) {
      immediate = error;
    }
    expect((immediate as Error).name).toBe("AbortError");
    // Nguyên văn bản gốc: worker được TẠO trước khi kiểm aborted, rồi bị terminate ngay;
    // KHÔNG có thông điệp nào được đăng.
    expect(FakeWorker.last?.terminated).toBe(true);
    expect(FakeWorker.last?.posted).toEqual([]);
  });

  test("thân luồng được CHUYỂN GIAO cho Worker; thiếu Worker ⇒ reject thông điệp rõ", async () => {
    installWorkerStubs();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } });
    void workerTransport().post({ path: "api/x", body: stream });
    const worker = FakeWorker.last!;
    expect(worker.posted[0]?.transfer).toEqual([stream]);
    (globalThis as Record<string, unknown>).Worker = undefined;
    let thrown: unknown;
    try {
      await workerTransport().post({ path: "api/x", body: new Blob(["x"]) });
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe("background upload requires Web Worker support");
  });
});

describe("service fileUpload — Cordis thật + hai nhánh tải", () => {
  test("đăng ký ĐÚNG tên fileUpload trên Context; byte chính xác đi Remote (base64), KHÔNG qua transport", async () => {
    const ctx = new Context();
    const calls: { sessionId: string; input: { data: string; name?: string }; hasSignal: boolean }[] = [];
    ctx.provide("remote", {
      fileUploads: {
        upload: async (sessionId: string, input: { data: string; name?: string }, signal?: AbortSignal) => {
          calls.push({ sessionId, input, hasSignal: signal !== undefined });
          return { ok: true as const, value: { receiptId: "r", file: { attachmentId: "a", name: "n", bytes: 2 } } };
        },
      },
    });
    const runtime = new FileUploadRuntime(ctx as never);
    expect((ctx.get("fileUpload") as { name: string }).name).toBe("fileUpload");
    const controller = new AbortController();
    const result = await runtime.upload("s1", new Uint8Array([1, 2]), "n.txt", controller.signal);
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ sessionId: "s1", input: { data: Buffer.from([1, 2]).toString("base64"), name: "n.txt" }, hasSignal: true }]);
  });

  test("Blob đi carrier: path TƯƠNG ĐỐI theo document, header octet-stream, kết quả parse đúng", async () => {
    const ctx = new Context();
    ctx.provide("remote", { fileUploads: { upload: async () => ({ ok: true as const, value: { receiptId: "r", file: { attachmentId: "a", name: "n", bytes: 1 } } }) } });
    const seen: { url?: string; init?: RequestInit } = {};
    (globalThis as Record<string, unknown>).__GBH_FILE_UPLOAD__ = {
      fetch: async (url: string | URL, init: RequestInit) => {
        seen.url = String(url);
        seen.init = init;
        return new Response(JSON.stringify({ ok: true, value: { receiptId: "r2", file: { attachmentId: "a2", name: "n2", bytes: 1 } } }), { status: 200 });
      },
    };
    const runtime = new FileUploadRuntime(ctx as never);
    const result = await runtime.upload("s1", new Blob(["x"]), "n.txt");
    expect(seen.url).toBe("api/session/uploadFileBinary?sessionId=s1&name=n.txt");
    expect((seen.init?.headers as Record<string, string>)["content-type"]).toBe("application/octet-stream");
    expect(seen.init?.method).toBe("POST");
    expect(result).toEqual({ ok: true, value: { receiptId: "r2", file: { attachmentId: "a2", name: "n2", bytes: 1 } } });
  });

  test("carrier trả mã khác 200 ⇒ ném Error nêu HTTP; lỗi nghiệp vụ trong thân 200 ⇒ trả RemoteError", async () => {
    const ctx = new Context();
    ctx.provide("remote", { fileUploads: { upload: async () => ({ ok: true as const, value: { receiptId: "r", file: { attachmentId: "a", name: "n", bytes: 1 } } }) } });
    let body = "x";
    let status = 500;
    (globalThis as Record<string, unknown>).__GBH_FILE_UPLOAD__ = {
      fetch: async () => new Response(body, { status }),
    };
    const runtime = new FileUploadRuntime(ctx as never);
    let thrown: unknown;
    try {
      await runtime.upload("s1", new Blob(["x"]));
    } catch (error) {
      thrown = error;
    }
    expect((thrown as Error).message).toBe("file upload transport failed with HTTP 500");
    status = 200;
    body = JSON.stringify({ ok: false, error: { code: "gateway/internal", message: "m", details: {} } });
    const result = await runtime.upload("s1", new Blob(["x"]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("gateway/internal");
  });
});
