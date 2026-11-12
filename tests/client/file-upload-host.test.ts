/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test hành vi nửa Host của gbh-client-file-upload — chạy CẢ HAI bản (ta + chính bundle
 *      gốc) trên CÙNG hình dạng giàn cordis thật: route tải byte thô, upload/uploadStream,
 *      biên nhận staged, bind/retire, resolver Agent lạnh, ma trận lỗi Remote, sự kiện phiên,
 *      và C6 danh tính. Kèm đối chứng bề mặt export/prototype trên ARTIFACT.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import OursDefault, { FileUploads as OursFileUploads } from "../../packages/client/file-upload/src/index.ts";

/** Gốc repo (file này nằm ở tests/client). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục bản gốc trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-file-upload");
/** Artifact bản gốc (CHỈ ĐỌC). */
const STOCK_BUNDLE = join(STOCK_DIR, "lib", "index.js");
/** cordis mà CẢ HAI bản nạp (phải cùng thể hiện thì Service mới đăng ký được trên cùng Context). */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Tham chiếu tệp mặc định của giàn. */
const FILE = { attachmentId: "a1", name: "n.txt", bytes: 3 };

/** Context cordis tối thiểu mà giàn dùng (khai theo CẤU TRÚC). */
interface CordisContext {
  /** Cấp MỘT dịch vụ cho cây. */
  provide(name: string, value: unknown): unknown;
  /** Tra dịch vụ theo tên. */
  get(name: string): unknown;
  /** Nghe sự kiện. */
  on(name: string, listener: (...args: any[]) => unknown): unknown;
  /** Phát sự kiện. */
  emit(name: string, ...args: unknown[]): void;
  /** Đăng ký hiệu ứng vòng đời. */
  effect(callback: () => () => unknown, label?: string): unknown;
}

/** Agent giả đúng phần service đọc. */
interface AgentLike {
  /** Danh tính (bằng id phiên). */
  readonly id: string;
  /** Phiên với header. */
  readonly session: { readonly header: { readonly origin?: string } };
}

/** Tham chiếu tệp. */
interface FileRef {
  /** Định danh lưu trữ. */
  attachmentId: string;
  /** Tên hiển thị. */
  name: string;
  /** Số byte. */
  bytes: number;
}

/** Giá trị một lần tải trả về. */
interface UploadValue {
  /** Biên nhận staged. */
  receiptId: string;
  /** Tham chiếu tệp. */
  file: FileRef;
}

/** Guard gắn biên nhận. */
interface BindingLike {
  /** Đánh dấu prompt đã gửi. */
  commit(): void;
  /** Hỗ trợ using. */
  [Symbol.dispose](): void;
}

/** Bề mặt service mà test gọi (khai theo CẤU TRÚC). */
interface ServiceLike {
  /** Đăng ký resolver Agent lạnh. */
  registerAgentResolver(resolve: (sessionId: string) => Promise<AgentLike>): () => void;
  /** Nhánh Remote: tệp đã mã hoá base64. */
  upload(agent: AgentLike, request: { data: string; name?: string }, signal: AbortSignal): Promise<UploadValue>;
  /** Nhánh route: byte thô theo luồng. */
  uploadStream(request: { sessionId: string; data: AsyncIterable<Uint8Array>; signal?: AbortSignal; name?: string }): Promise<UploadValue>;
  /** Giải biên nhận. */
  resolve(agent: AgentLike, receiptId: string): FileRef | undefined;
  /** Gắn biên nhận vào prompt. */
  bindPrompt(agent: AgentLike, receiptIds: readonly string[], requestId: string): BindingLike;
  /** Gỡ biên nhận của một prompt. */
  retirePrompt(agent: AgentLike, requestId: string): void;
}

/** Lớp plugin của một bản cài. */
type PluginClass = new (ctx: unknown) => ServiceLike;

/** Một route Fetch mà Connection nhận đăng ký. */
interface RouteLike {
  /** Đường dẫn. */
  path: string;
  /** Phương thức. */
  methods: readonly string[];
  /** Chế độ thân. */
  requestBody: string;
  /** Xử lý request. */
  fetch(request: Request): Promise<Response>;
}

/** Trạng thái quan sát được của một giàn. */
interface RigState {
  /** Route đã đăng ký (nếu còn). */
  route?: RouteLike;
  /** Resolver biên nhận của commands (nếu còn). */
  receiptResolver?: (agent: AgentLike, receiptId: string) => FileRef | undefined;
  /** Các lần admitEncodedFile. */
  admitCalls: { data: string; name?: string }[];
  /** Các lần saveFileStream. */
  saveCalls: { name?: string; hasSignal: boolean; bytes: number[] }[];
}

/** Một giàn cordis thật với bốn seam giả. */
interface Rig {
  /** Context cordis thật. */
  ctx: CordisContext;
  /** Service vừa dựng. */
  service: ServiceLike;
  /** Sổ Agent giả (test tự thêm/xoá). */
  agents: Map<string, AgentLike>;
  /** Trạng thái quan sát được. */
  state: RigState;
}

/** Cấu hình lỗi/kết quả của giàn. */
interface RigOptions {
  /** Tham chiếu tệp trả về (mặc định FILE). */
  file?: FileRef;
  /** Lỗi ném từ admitEncodedFile. */
  admitError?: unknown;
  /** Lỗi ném từ saveFileStream. */
  streamError?: unknown;
  /** Bộ nhận diện lỗi attachment. */
  isAttachmentError?: (error: unknown) => boolean;
}

/** Bản gốc nạp động (đường dẫn tính lúc chạy nên tsc không kéo .d.ts của nó vào chương trình). */
const stockModule = (await import(STOCK_BUNDLE)) as { FileUploads: PluginClass; default: PluginClass };
/** cordis Context của kernel. */
const { Context } = (await import(CORDIS)) as { Context: new () => CordisContext };

/**
 * Dựng MỘT giàn: Context cordis thật + seam agents/attachments/commands/connection giả + service.
 * @param Plugin - lớp service của bản cần đo.
 * @param options - kết quả/lỗi mà seam giả trả.
 * @returns giàn đã sẵn sàng gọi.
 */
function createRig(Plugin: PluginClass, options: RigOptions = {}): Rig {
  const ctx = new Context();
  const agents = new Map<string, AgentLike>();
  const state: RigState = { admitCalls: [], saveCalls: [] };
  ctx.provide("agents", {
    get: (id: string) => agents.get(id),
  });
  ctx.provide("attachments", {
    admitEncodedFile: async (input: { data: string; name?: string }) => {
      state.admitCalls.push(input);
      if (options.admitError !== undefined) throw options.admitError;
      return options.file ?? FILE;
    },
    saveFileStream: async (input: { data: AsyncIterable<Uint8Array>; signal?: AbortSignal; name?: string }) => {
      const bytes: number[] = [];
      for await (const chunk of input.data) bytes.push(...chunk);
      state.saveCalls.push({ name: input.name, hasSignal: input.signal !== undefined, bytes });
      if (options.streamError !== undefined) throw options.streamError;
      return options.file ?? FILE;
    },
    isAttachmentError: options.isAttachmentError ?? (() => false),
  });
  ctx.provide("commands", {
    registerFileReceiptResolver: (resolver: (agent: AgentLike, receiptId: string) => FileRef | undefined) => {
      state.receiptResolver = resolver;
      return () => {
        state.receiptResolver = undefined;
      };
    },
  });
  ctx.provide("connection", {
    fetch: {
      register: (route: RouteLike) => {
        state.route = route;
        return async () => {
          state.route = undefined;
        };
      },
    },
  });
  const service = new Plugin(ctx);
  return { ctx, service, agents, state };
}

/**
 * Tạo Agent giả.
 * @param id - danh tính (mặc định s1).
 * @param origin - header.origin (chỉ đặt khi cần ca subagent).
 * @returns Agent giả.
 */
function agentOf(id = "s1", origin?: string): AgentLike {
  return { id, session: { header: origin === undefined ? {} : { origin } } };
}

/**
 * Tạo luồng byte từ danh sách khối.
 * @param chunks - các khối byte.
 * @returns ReadableStream đọc được một lần.
 */
function streamOf(chunks: readonly number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
  });
}

/**
 * Bắt giá trị bị ném từ một promise (giữ nguyên lỗi, không bọc).
 * @param promise - promise cần chờ.
 * @returns giá trị bị ném; ném lại lỗi của chính test khi promise lại RESOLVE.
 */
async function rejectionOf(promise: Promise<unknown>): Promise<Record<string, any>> {
  try {
    await promise;
  } catch (error) {
    return error as Record<string, any>;
  }
  throw new Error("kỳ vọng promise bị từ chối nhưng nó đã resolve");
}

/**
 * Chạy CÙNG một kịch bản trên CẢ HAI bản cài rồi trả kết quả của từng bên.
 * @param scenario - hàm nhận giàn và trả kết quả đo.
 * @param options - cấu hình lỗi/kết quả của giàn.
 * @returns cặp [của ta, bản gốc].
 */
async function both<T>(
  scenario: (rig: Rig) => Promise<T> | T,
  options: RigOptions = {},
): Promise<[T, T]> {
  const ours = createRig(OursFileUploads as unknown as PluginClass, options);
  const stock = createRig(stockModule.FileUploads, options);
  return [await scenario(ours), await scenario(stock)];
}

describe("file-upload (host) — bề mặt ARTIFACT và prototype phải trùng bản gốc", () => {
  test("export lúc chạy = đúng hai tên của bản gốc; default CHÍNH là lớp FileUploads", () => {
    expect(Object.keys({ FileUploads: OursFileUploads, default: OursDefault }).sort()).toEqual(
      Object.keys(stockModule).sort(),
    );
    expect(OursDefault).toBe(OursFileUploads);
    expect(OursFileUploads.name).toBe(stockModule.FileUploads.name);
  });

  test("prototype 12 tên trùng TỪNG TÊN; static inject trùng từng phần tử", () => {
    const ours = Object.getOwnPropertyNames(OursFileUploads.prototype).sort();
    const stock = Object.getOwnPropertyNames(stockModule.FileUploads.prototype).sort();
    expect(ours).toEqual(stock);
    expect((OursFileUploads as unknown as { inject: string[] }).inject).toEqual(
      (stockModule.FileUploads as unknown as { inject: string[] }).inject,
    );
  });

  test("artifact đã build: KHÔNG có id gốc, có đúng một id của ta ở vị trí đăng ký", () => {
    const client = readFileSync(join(REPO, "packages", "client", "file-upload", "lib", "client.js"), "utf8");
    expect([...client.matchAll(/id:\s*"@deepseek-ai/g)].length).toBe(0);
    expect([...client.matchAll(/id:\s*"@galaxy-blackhole/g)].length).toBe(1);
    expect(client).toContain("@galaxy-blackhole/gbh-client-file-upload");
  });
});

describe("file-upload (host) — route tải byte thô", () => {
  test("đăng ký ĐÚNG path/methods/requestBody như bản gốc", async () => {
    const [ours, stock] = await both((rig) => ({
      path: rig.state.route?.path,
      methods: rig.state.route?.methods,
      requestBody: rig.state.route?.requestBody,
    }));
    expect(ours).toEqual(stock);
    expect(ours).toEqual({ path: "/api/session/uploadFileBinary", methods: ["POST"], requestBody: "streaming" });
  });

  test("POST hợp lệ ⇒ 200 JSON ok:true + no-store, và byte chảy NGUYÊN THỨ TỰ tới seam", async () => {
    const run = async (rig: Rig) => {
      rig.agents.set("s1", agentOf());
      const response = await rig.state.route!.fetch(new Request("http://127.0.0.1/api/session/uploadFileBinary?sessionId=s1&name=a.txt", {
        method: "POST",
        headers: { "content-type": "application/octet-stream" },
        body: streamOf([[1, 2], [3]]),
        duplex: "half",
      } as RequestInit));
      const body = (await response.json()) as { ok: boolean; value?: UploadValue };
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        contentType: response.headers.get("content-type"),
        ok: body.ok,
        file: body.value?.file,
        receipt: typeof body.value?.receiptId,
        saveCalls: rig.state.saveCalls,
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.status).toBe(200);
    expect(ours.cache).toBe("no-store");
    expect(ours.contentType).toBe("application/json; charset=utf-8");
    expect(ours.ok).toBe(true);
    expect(ours.file).toEqual(FILE);
    expect(ours.receipt).toBe("string");
    expect(ours.saveCalls).toEqual([{ name: "a.txt", hasSignal: true, bytes: [1, 2, 3] }]);
  });

  test("yêu cầu sai: 405 + allow, 415 content type, 400 thiếu sessionId — trùng cả hai bản", async () => {
    const run = async (rig: Rig) => {
      const route = rig.state.route!;
      const get = await route.fetch(new Request("http://127.0.0.1/api/session/uploadFileBinary?sessionId=s1"));
      const wrongType = await route.fetch(new Request("http://127.0.0.1/api/session/uploadFileBinary?sessionId=s1", { method: "POST", headers: { "content-type": "application/json" }, body: "x" }));
      const noSession = await route.fetch(new Request("http://127.0.0.1/api/session/uploadFileBinary", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x" }));
      const charset = await route.fetch(new Request("http://127.0.0.1/api/session/uploadFileBinary?sessionId=s1", { method: "POST", headers: { "content-type": "application/octet-stream; charset=binary" }, body: "x" }));
      return {
        get: { status: get.status, allow: get.headers.get("allow") },
        wrongType: { status: wrongType.status, text: await wrongType.text() },
        noSession: { status: noSession.status, text: await noSession.text() },
        charset: charset.status,
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.get).toEqual({ status: 405, allow: "POST" });
    expect(ours.wrongType).toEqual({ status: 415, text: "content type must be application/octet-stream" });
    expect(ours.noSession).toEqual({ status: 400, text: "sessionId is required" });
    expect(ours.charset).toBe(200);
  });

  test("lỗi nghiệp vụ của route ⇒ VẪN 200, ok:false, mã lỗi Remote giữ nguyên — trùng cả hai bản", async () => {
    const [ours, stock] = await both(
      async (rig) => {
        const response = await rig.state.route!.fetch(new Request("http://127.0.0.1/api/session/uploadFileBinary?sessionId=cold", { method: "POST", headers: { "content-type": "application/octet-stream" }, body: "x" }));
        const body = (await response.json()) as { ok: boolean; error?: { code: string; message: string; details: Record<string, unknown> } };
        return { status: response.status, body };
      },
    );
    expect(ours).toEqual(stock);
    expect(ours.status).toBe(200);
    expect(ours.body).toEqual({ ok: false, error: { code: "session/not-found", message: 'session "cold" is not attached', details: { sessionId: "cold" } } });
  });
});

describe("file-upload (host) — uploadStream và biên nhận staged", () => {
  test("agent sống ⇒ staged theo ĐÚNG phiên + receipt UUID; resolve chỉ đúng phiên đó", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const value = await rig.service.uploadStream({ sessionId: agent.id, data: streamOf([[9, 8]]), name: "z.bin" });
      return {
        value,
        sameSession: rig.service.resolve(agent, value.receiptId),
        otherSession: rig.service.resolve(agentOf("s2"), value.receiptId),
        unknown: rig.service.resolve(agent, "no-such-receipt"),
        saveCalls: rig.state.saveCalls,
      };
    };
    const [ours, stock] = await both(run);
    expect({ ...ours, value: { ...ours.value, receiptId: "<uuid>" } }).toEqual({ ...stock, value: { ...stock.value, receiptId: "<uuid>" } });
    expect(ours.value.receiptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(ours.value.file).toEqual(FILE);
    expect(ours.sameSession).toEqual(FILE);
    expect(ours.otherSession).toBeUndefined();
    expect(ours.unknown).toBeUndefined();
    expect(ours.saveCalls).toEqual([{ name: "z.bin", hasSignal: false, bytes: [9, 8] }]);
  });

  test("phiên lạnh: chưa có resolver ⇒ session/not-found; có resolver ⇒ lưu được; resolver trùng ⇒ ném; disposer gỡ", async () => {
    const run = async (rig: Rig) => {
      const cold = await rejectionOf(rig.service.uploadStream({ sessionId: "s1", data: streamOf([[1]]) }));
      const agent = agentOf();
      const dispose = rig.service.registerAgentResolver(async (sessionId) => {
        expect(sessionId).toBe("s1");
        rig.agents.set(agent.id, agent);
        return agent;
      });
      let duplicate: Record<string, any> | undefined;
      try {
        rig.service.registerAgentResolver(async () => agent);
      } catch (error) {
        duplicate = error as Record<string, any>;
      }
      const value = await rig.service.uploadStream({ sessionId: "s1", data: streamOf([[2]]) });
      rig.agents.delete(agent.id);
      dispose();
      const afterDispose = await rejectionOf(rig.service.uploadStream({ sessionId: "s1", data: streamOf([[3]]) }));
      return {
        cold: { code: cold.code, message: cold.message, details: cold.details },
        duplicate: duplicate === undefined ? undefined : { name: duplicate.name, message: duplicate.message },
        file: value.file,
        afterDispose: { code: afterDispose.code, message: afterDispose.message },
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.cold).toEqual({ code: "session/not-found", message: 'session "s1" is not attached', details: { sessionId: "s1" } });
    expect(ours.duplicate).toEqual({ name: "Error", message: "file-upload: Agent resolver is already registered" });
    expect(ours.file).toEqual(FILE);
    expect(ours.afterDispose.code).toBe("session/not-found");
  });

  test("phiên bị dọn TRƯỚC khi lưu xong ⇒ session/not-found kèm sessionId (không stage)", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      // Xoá agent trong lúc seam lưu: dùng lỗi KHÔNG phải attachment để đi tiếp tới phép kiểm sống.
      const pending = rig.service.uploadStream({
        sessionId: agent.id,
        data: (async function* () {
          rig.agents.delete(agent.id);
          yield new Uint8Array([1]);
        })(),
      });
      const failure = await rejectionOf(pending);
      return { code: failure.code, message: failure.message, details: failure.details };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({
      code: "session/not-found",
      message: 'session "s1" was disposed before its file upload completed',
      details: { sessionId: "s1" },
    });
  });
});

describe("file-upload (host) — nhánh Remote upload()", () => {
  test("admitEncodedFile nhận NGUYÊN data/name; receipt staged; cả hai bản trùng", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const signal = new AbortController().signal;
      const withName = await rig.service.upload(agent, { data: "AAEC", name: "x.png" }, signal);
      const withoutName = await rig.service.upload(agent, { data: "AwQ=" }, signal);
      return {
        withName: { file: withName.file, resolve: rig.service.resolve(agent, withName.receiptId) },
        withoutName: { file: withoutName.file, resolve: rig.service.resolve(agent, withoutName.receiptId) },
        admitCalls: rig.state.admitCalls,
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.withName.file).toEqual(FILE);
    expect(ours.withName.resolve).toEqual(FILE);
    expect(ours.withoutName.resolve).toEqual(FILE);
    expect(ours.admitCalls).toEqual([{ data: "AAEC", name: "x.png" }, { data: "AwQ=" }]);
  });

  test("signal đã huỷ ⇒ ném TRƯỚC khi chạm kho attachment (cả hai bản)", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      let thrown: Record<string, any> | undefined;
      try {
        await rig.service.upload(agent, { data: "AA==" }, AbortSignal.abort());
      } catch (error) {
        thrown = error as Record<string, any>;
      }
      return { name: thrown?.name, message: thrown?.message, admitCalls: rig.state.admitCalls.length };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.admitCalls).toBe(0);
    expect(ours.name).toBe("AbortError");
  });

  test("phiên subagent ⇒ subagent/attachment-invalid + SUBAGENT_FILE_UNSUPPORTED, KHÔNG lưu", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf("sub", "subagent");
      rig.agents.set(agent.id, agent);
      const failure = await rejectionOf(rig.service.upload(agent, { data: "AA==" }, new AbortController().signal));
      return {
        code: failure.code,
        message: failure.message,
        details: failure.details,
        admitCalls: rig.state.admitCalls.length,
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({
      code: "subagent/attachment-invalid",
      message: "subagent conversations do not accept file uploads",
      details: { reason: "SUBAGENT_FILE_UNSUPPORTED" },
      admitCalls: 0,
    });
  });

  test("ma trận lỗi lưu: lỗi attachment ⇒ session/attachment-invalid + reason; lỗi khác ⇒ gateway/internal + cause", async () => {
    const attachmentError = { code: "ATTACHMENT_TOO_LARGE", message: "too big" };
    const runAttachment = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const failure = await rejectionOf(rig.service.upload(agent, { data: "AA==" }, new AbortController().signal));
      return { code: failure.code, message: failure.message, details: failure.details };
    };
    const [oursAttachment, stockAttachment] = await both(runAttachment, {
      admitError: attachmentError,
      isAttachmentError: (error) => error === attachmentError,
    });
    expect(oursAttachment).toEqual(stockAttachment);
    expect(oursAttachment).toEqual({ code: "session/attachment-invalid", message: "too big", details: { reason: "ATTACHMENT_TOO_LARGE" } });

    const genericError = new Error("boom");
    const runGeneric = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const failure = await rejectionOf(rig.service.upload(agent, { data: "AA==" }, new AbortController().signal));
      return { code: failure.code, message: failure.message, details: failure.details, causeSame: failure.cause === genericError };
    };
    const [oursGeneric, stockGeneric] = await both(runGeneric, { admitError: genericError });
    expect(oursGeneric).toEqual(stockGeneric);
    expect(oursGeneric).toEqual({ code: "gateway/internal", message: "failed to store file upload: Error: boom", details: {}, causeSame: true });
  });
});

describe("file-upload (host) — bindPrompt / retirePrompt / sự kiện phiên", () => {
  test("bind → retirePrompt gỡ; guard dispose khôi phục prompt CŨ; commit giữ biên nhận", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const stream = () => streamOf([[1]]);
      const first = await rig.service.uploadStream({ sessionId: agent.id, data: stream() });
      const second = await rig.service.uploadStream({ sessionId: agent.id, data: stream() });
      const guardP1 = rig.service.bindPrompt(agent, [first.receiptId], "p1");
      const guardP2 = rig.service.bindPrompt(agent, [first.receiptId], "p2");
      guardP2[Symbol.dispose](); // trả first về p1
      rig.service.retirePrompt(agent, "p2");
      const afterRetireP2 = rig.service.resolve(agent, first.receiptId);
      rig.service.retirePrompt(agent, "p1");
      const afterRetireP1 = rig.service.resolve(agent, first.receiptId);
      const committed = rig.service.bindPrompt(agent, [second.receiptId], "p3");
      committed.commit();
      committed[Symbol.dispose]();
      rig.service.retirePrompt(agent, "p3");
      const afterCommittedRetire = rig.service.resolve(agent, second.receiptId);
      guardP1[Symbol.dispose]();
      return { afterRetireP2, afterRetireP1, afterCommittedRetire };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({ afterRetireP2: FILE, afterRetireP1: undefined, afterCommittedRetire: undefined });
  });

  test("bindPrompt biên nhận chưa staged ⇒ RemoteError nguyên văn (cả hai bản)", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const failure = await rejectionOf(Promise.resolve().then(() => rig.service.bindPrompt(agent, ["missing"], "p1")));
      return { code: failure.code, message: failure.message, details: failure.details, isRemote: failure.isDSHRemoteError };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({
      code: "session/attachment-invalid",
      message: "File was not uploaded for this session.",
      details: { reason: "FILE_NOT_STAGED" },
      isRemote: true,
    });
  });

  test("session/event user/message ⇒ gỡ biên nhận của ĐÚNG rpcId; sự kiện khác bị bỏ qua", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const bound = await rig.service.uploadStream({ sessionId: agent.id, data: streamOf([[1]]) });
      const unbound = await rig.service.uploadStream({ sessionId: agent.id, data: streamOf([[2]]) });
      rig.service.bindPrompt(agent, [bound.receiptId], "rpc-1");
      rig.ctx.emit("session/event", agent.session, { type: "user/message", data: { source: { kind: "user" } } });
      const afterNoRpc = rig.service.resolve(agent, bound.receiptId);
      rig.ctx.emit("session/event", agent.session, { type: "assistant/message", data: { source: { kind: "user", rpcId: "rpc-1" } } });
      const afterWrongType = rig.service.resolve(agent, bound.receiptId);
      rig.ctx.emit("session/event", agent.session, { type: "user/message", data: { source: { kind: "system", rpcId: "rpc-1" } } });
      const afterWrongKind = rig.service.resolve(agent, bound.receiptId);
      rig.ctx.emit("session/event", agent.session, { type: "user/message", data: { source: { kind: "user", rpcId: "rpc-1" } } });
      const afterRpc = rig.service.resolve(agent, bound.receiptId);
      return {
        afterNoRpc,
        afterWrongType,
        afterWrongKind,
        afterRpc,
        unboundStillThere: rig.service.resolve(agent, unbound.receiptId),
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.afterNoRpc).toEqual(FILE);
    expect(ours.afterWrongType).toEqual(FILE);
    expect(ours.afterWrongKind).toEqual(FILE);
    expect(ours.afterRpc).toBeUndefined();
    expect(ours.unboundStillThere).toEqual(FILE);
  });

  test("session/disposed ⇒ xoá toàn bộ biên nhận của phiên đó (cả hai bản)", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const value = await rig.service.uploadStream({ sessionId: agent.id, data: streamOf([[1]]) });
      rig.ctx.emit("session/disposed", agent.session);
      return { resolve: rig.service.resolve(agent, value.receiptId) };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.resolve).toBeUndefined();
  });

  test("resolver biên nhận của commands trả ĐÚNG tham chiếu tệp đã staged (cả hai bản)", async () => {
    const run = async (rig: Rig) => {
      const agent = agentOf();
      rig.agents.set(agent.id, agent);
      const value = await rig.service.uploadStream({ sessionId: agent.id, data: streamOf([[1]]) });
      const resolver = rig.state.receiptResolver!;
      return {
        forStaged: resolver(agent, value.receiptId),
        forMissing: resolver(agent, "missing"),
      };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours.forStaged).toEqual(FILE);
    expect(ours.forMissing).toBeUndefined();
  });
});

describe("file-upload (host) — C6 danh tính và cổng dọn", () => {
  test("hai service độc lập: stage ở giàn A KHÔNG thấy ở giàn B; cùng receipt id cũng vậy", async () => {
    const first = createRig(OursFileUploads as unknown as PluginClass);
    const second = createRig(OursFileUploads as unknown as PluginClass);
    const agent = agentOf();
    first.agents.set(agent.id, agent);
    second.agents.set(agent.id, agent);
    const value = await first.service.uploadStream({ sessionId: agent.id, data: streamOf([[1]]) });
    expect(first.service.resolve(agent, value.receiptId)).toEqual(FILE);
    expect(second.service.resolve(agent, value.receiptId)).toBeUndefined();
    expect((first.ctx.get("fileUploads") as { name: string }).name).toBe("fileUploads");
    expect((second.ctx.get("fileUploads") as { name: string }).name).toBe("fileUploads");
    expect(first.ctx.get("fileUploads")).not.toBe(second.ctx.get("fileUploads"));
  });

  test("hiệu ứng dọn gỡ route + resolver khi fiber tắt (cả hai bản)", async () => {
    const run = async (rig: Rig) => {
      expect(rig.state.route).toBeDefined();
      expect(rig.state.receiptResolver).toBeDefined();
      const fiber = (rig.ctx as unknown as { fiber?: { dispose?: () => Promise<void> } }).fiber;
      await fiber?.dispose?.();
      return { route: rig.state.route, resolver: rig.state.receiptResolver };
    };
    const [ours, stock] = await both(run);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({ route: undefined, resolver: undefined });
  });
});
