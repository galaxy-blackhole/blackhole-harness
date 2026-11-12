/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-client-connection: hàng rào tin cậy, phiên cookie, bảng lỗi RPC,
 *      ca BYTE của phản hồi multipart (CẢ hai đầu: host mã hoá + client gỡ), và vòng đời thế hệ kết nối phía trình duyệt.
 *      11/11/2026: thêm ca host — envelopeOf phải gửi multipart và cầu node→fetch phải giữ NGUYÊN byte.
 */
import { describe, expect, test } from "bun:test";

import { API_PATH, CONNECT_PATH } from "../../packages/client/connection/src/ids.ts";
import { BrowserAuth } from "../../packages/client/connection/src/host/browser-auth.ts";
import { rpcErrorSchema, clientRequestSchema, rpcMessageSchema, rpcResultSchema, serverResponseSchema, rpcIdSchema } from "../../packages/client/connection/src/host/rpc-schema.ts";
import { assertTrustedAuthority, isTrustedApiRequest, parseAuthority } from "../../packages/client/connection/src/host/trust.ts";
import { isLoopbackHostname } from "../../packages/client/connection/src/host/loopback.ts";
import { bridgeNodeRequest, envelopeOf, Peer, type ConnectionFetchHandler, type NodeRequestLike, type NodeResponseLike } from "../../packages/client/connection/src/host/rpc-host.ts";
import { resolveConnectionConfig } from "../../packages/client/connection/src/recovery-config.ts";
import { RpcId, transportError } from "../../packages/client/connection/src/rpc-id.ts";
import { parseBinaryResponse, parseConnectionResponse } from "../../packages/client/connection/src/client/api.ts";
import { createWebConnectionRpc } from "../../packages/client/connection/src/client/rpc.ts";
import { openConnectionWebSocket } from "../../packages/client/connection/src/client/socket.ts";
import { ConnectionController } from "../../packages/client/connection/src/client/connection.ts";
import { installConnection } from "../../packages/client/connection/src/client/plugin.ts";

/** Header tối thiểu của một yêu cầu /api hợp lệ. */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { host: "127.0.0.1:5439", ...extra };
}

/** Sổ credentials giả: giữ bản ghi trong bộ nhớ và đếm số lần sửa. */
function fakeCredentials(): { modifyRecord(key: string, change: (current: unknown) => unknown): Promise<unknown>; records: Map<string, unknown> } {
  const records = new Map<string, unknown>();
  return {
    records,
    async modifyRecord(key, change) {
      const next = change(records.get(key));
      records.set(key, next);
      return next;
    },
  };
}

/** Phản hồi giả ghi lại trạng thái và header. */
function fakeResponse(): { status: number; headers: Record<string, string>; body: string; writeHead(status: number, extra?: Record<string, string>): void; end(body?: string): void } {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, extra) {
      this.status = status;
      this.headers = extra ?? {};
    },
    end(body) {
      this.body = body ?? "";
    },
  };
}

/** Yêu cầu node giả phát thân theo từng mảnh, đủ cho cầu node→fetch. */
interface FakeNodeRequest extends NodeRequestLike {
  /** Phát một sự kiện cho các listener đã đăng ký. */
  emit(event: string, ...args: unknown[]): void;
  /** Phát toàn bộ thân rồi kết thúc. */
  emitAll(): void;
}

/**
 * Dựng yêu cầu node giả.
 * @param options - đường dẫn, header và các mảnh thân.
 * @returns yêu cầu giả có thể tự phát sự kiện.
 */
function fakeNodeRequest(options: { url: string; headers: Record<string, string>; chunks: string[] }): FakeNodeRequest {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const request = {
    url: options.url,
    method: "POST",
    headers: options.headers,
    on(event: string, listener: (...args: unknown[]) => void) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
      return request;
    },
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
    emitAll() {
      for (const chunk of options.chunks) request.emit("data", new TextEncoder().encode(chunk));
      request.emit("end");
    },
  };
  return request as unknown as FakeNodeRequest;
}

describe("hàng rào tin cậy của /api", () => {
  test("chấp nhận loopback, địa chỉ bind và authority được cấu hình; từ chối phần còn lại", () => {
    expect(isTrustedApiRequest({ headers: headers() }, [], "127.0.0.1")).toBe(true);
    expect(isTrustedApiRequest({ headers: headers({ host: "localhost:5439" }) }, [], undefined)).toBe(true);
    expect(isTrustedApiRequest({ headers: headers({ host: "192.168.1.9:5439" }) }, [], "192.168.1.9")).toBe(true);
    expect(isTrustedApiRequest({ headers: headers({ host: "gbh.example:443" }) }, ["gbh.example"], undefined)).toBe(true);
    expect(isTrustedApiRequest({ headers: headers({ host: "gbh.example:443" }) }, ["gbh.example:8443"], undefined)).toBe(false);
    expect(isTrustedApiRequest({ headers: headers({ host: "ke-la.example" }) }, [], "127.0.0.1")).toBe(false);
    expect(isTrustedApiRequest({ headers: {} }, [], "127.0.0.1")).toBe(false);
  });

  test("chặn cross-site và Origin khác authority", () => {
    expect(isTrustedApiRequest({ headers: headers({ "sec-fetch-site": "cross-site" }) }, [], undefined)).toBe(false);
    expect(isTrustedApiRequest({ headers: headers({ origin: "http://127.0.0.1:5439" }) }, [], undefined)).toBe(true);
    expect(isTrustedApiRequest({ headers: headers({ origin: "http://evil.example" }) }, [], undefined)).toBe(false);
  });

  test("entry cấu hình phải là authority trần chuẩn tắc", () => {
    expect(() => assertTrustedAuthority("gbh.example")).not.toThrow();
    expect(() => assertTrustedAuthority("gbh.example:8443")).not.toThrow();
    expect(() => assertTrustedAuthority("https://gbh.example")).toThrow();
    expect(() => assertTrustedAuthority("gbh.example/path")).toThrow();
    expect(() => assertTrustedAuthority("")).toThrow();
    expect(parseAuthority("gbh.example:8443")?.port).toBe("8443");
    expect(parseAuthority("gbh.example")?.port).toBe("");
  });

  test("phân loại loopback đúng như bản gốc", () => {
    for (const host of ["localhost", "[::1]", "127.0.0.1", "127.9.9.9"]) expect(isLoopbackHostname(host)).toBe(true);
    for (const host of ["0.0.0.0", "10.0.0.1", "127.0.0.1.example", "[::2]", "example.com"]) expect(isLoopbackHostname(host)).toBe(false);
  });
});

describe("phiên trình duyệt: token đổi lấy cookie rồi dùng cookie", () => {
  test("302 qua /connect cấp cookie, và cookie đó xác thực được /api", async () => {
    const credentials = fakeCredentials();
    const auth = await BrowserAuth.create({}, credentials, 30);
    const url = auth.authenticatedUrl("http://127.0.0.1:5439/");
    expect(url).toContain("?token=");
    const token = new URL(url).searchParams.get("token") ?? "";
    const res = fakeResponse();
    const granted = auth.authorizeConnect({ method: "GET", url: "/connect?token=" + token + "&interactions=answer", headers: headers() }, res, false, () => "peer-1");
    expect(granted).toBe(true);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(API_PATH);
    const cookie = (res.headers["set-cookie"] ?? "").split(";", 1)[0] ?? "";
    expect(cookie).toContain("dsh-auth-");
    expect(res.headers["set-cookie"]).toContain("HttpOnly");
    const apiRequest = { method: "POST", url: "/api/account/getState", headers: headers({ cookie }) };
    expect(auth.isAuthenticated(apiRequest)).toBe(true);
    const identity = auth.authenticateApi(apiRequest);
    expect(identity?.authority).toBe("127.0.0.1:5439");
    expect(identity?.id).toBe("peer-1");
  });

  test("token sai, khai báo interactions sai, và cookie của authority khác đều bị từ chối", async () => {
    const auth = await BrowserAuth.create({}, fakeCredentials(), 30);
    const wrongInteractions = fakeResponse();
    auth.authorizeConnect({ method: "GET", url: "/connect?token=x&interactions=maybe", headers: headers() }, wrongInteractions, false, () => "peer");
    expect(wrongInteractions.status).toBe(400);
    const wrongToken = fakeResponse();
    auth.authorizeConnect({ method: "GET", url: "/connect?token=khong-dung", headers: headers() }, wrongToken, false, () => "peer");
    expect(wrongToken.status).toBe(401);
    expect(wrongToken.body).toBe("unauthorized\n");
    const otherAuthority = await BrowserAuth.create({}, fakeCredentials(), 30);
    auth.authorizeConnect({ method: "GET", url: "/connect?token=x", headers: headers() }, fakeResponse(), false, () => "peer");
    expect(auth.isAuthenticated({ method: "GET", url: "/", headers: headers({ cookie: "dsh-auth-0000000000000000=v1.abc.def" }) })).toBe(false);
    expect(otherAuthority.isAuthenticated({ method: "GET", url: "/", headers: headers() })).toBe(false);
  });

  test("index: token hợp lệ mint cookie rồi chuyển hướng 303; không cookie thì 401", async () => {
    const auth = await BrowserAuth.create({}, fakeCredentials(), 30);
    const token = new URL(auth.authenticatedUrl("http://127.0.0.1:5439/")).searchParams.get("token") ?? "";
    const minted = fakeResponse();
    expect(auth.authorizeIndex({ method: "GET", url: "/?token=" + token, headers: headers() }, minted, false)).toBe(false);
    expect(minted.status).toBe(303);
    expect(minted.headers.location).toBe("./");
    const denied = fakeResponse();
    expect(auth.authorizeIndex({ method: "GET", url: "/", headers: headers() }, denied, false)).toBe(false);
    expect(denied.status).toBe(401);
    const cookie = (minted.headers["set-cookie"] ?? "").split(";", 1)[0] ?? "";
    expect(auth.authorizeIndex({ method: "GET", url: "/", headers: headers({ cookie }) }, fakeResponse(), false)).toBe(true);
  });

  test("sổ credentials chỉ tạo bí mật một lần và tái dùng qua các lượt nạp", async () => {
    const credentials = fakeCredentials();
    const first = await BrowserAuth.create({}, credentials, 30);
    const second = await BrowserAuth.create({}, credentials, 30);
    expect(credentials.records.size).toBe(1);
    const record = credentials.records.get("client-connection/browser-session") as { payload?: { secret?: string } };
    expect(typeof record.payload?.secret).toBe("string");
    const token = new URL(first.authenticatedUrl("http://127.0.0.1:5439/")).searchParams.get("token") ?? "";
    const res = fakeResponse();
    first.authorizeConnect({ method: "GET", url: "/connect?token=" + token, headers: headers() }, res, false, () => "p");
    const cookie = (res.headers["set-cookie"] ?? "").split(";", 1)[0] ?? "";
    /* Cùng bí mật ⇒ cookie của lượt trước vẫn dùng được ở lượt nạp sau. */
    expect(second.isAuthenticated({ method: "POST", url: "/api/x/y", headers: headers({ cookie }) })).toBe(true);
  });
});

describe("phong bì RPC: kiểm lúc chạy và ca BYTE của phản hồi multipart", () => {
  test("schema nhận phong bì đúng và từ chối phong bì sai", () => {
    expect(clientRequestSchema.safeParse({ type: "client-request", rpcId: "a", method: "m", payload: {} }).success).toBe(true);
    expect(clientRequestSchema.safeParse({ type: "server-response", rpcId: "a", method: "m", payload: {} }).success).toBe(false);
    expect(clientRequestSchema.safeParse({ type: "client-request", rpcId: 1, method: "m", payload: {} }).success).toBe(false);
    expect(rpcIdSchema.parse("probe")).toBe("probe");
    expect(serverResponseSchema.safeParse({ type: "server-response", rpcId: "a", result: { ok: true } }).success).toBe(true);
    expect(rpcErrorSchema.safeParse({ code: "x", message: "y", details: {} }).success).toBe(true);
    expect(rpcMessageSchema.safeParse({ type: "client-request", rpcId: "a", method: "m", payload: {} }).success).toBe(true);
    expect(rpcResultSchema({ parse: (value: unknown) => value, safeParse: () => ({ success: true as const, data: undefined }), optional: () => rpcIdSchema }) as unknown).toBeDefined();
    /* Khoá lạ bị BỎ, đúng ngữ nghĩa object của bản gốc. */
    const parsed = clientRequestSchema.parse({ type: "client-request", rpcId: "a", method: "m", payload: {}, extra: 1 }) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["method", "payload", "rpcId", "type"]);
  });

  test("phản hồi JSON hợp lệ được phân tích, sai thì ném TypeError", () => {
    const ok = parseConnectionResponse({ type: "server-response", rpcId: "probe1", result: { ok: true, value: { status: "signed-out" } } });
    expect(ok.result).toEqual({ ok: true, value: { status: "signed-out" } });
    expect(() => parseConnectionResponse({ type: "nope" })).toThrow(TypeError);
    expect(() => parseConnectionResponse({ type: "server-response", rpcId: "a", result: { ok: false, error: { code: 1 } } })).toThrow(TypeError);
  });

  test("CA BYTE: multipart gỡ được byte thật, và byte phải nhận qua ArrayBuffer.isView", async () => {
    const envelope = {
      type: "server-response",
      rpcId: "probe-byte",
      result: { ok: true, value: { data: null } },
      attachments: [{ codec: "bytes", part: "data", path: ["data"] }],
    };
    const form = new FormData();
    form.set("metadata", JSON.stringify(envelope));
    const bytes = new Uint8Array([0, 1, 2, 255, 128]);
    form.set("data", new Blob([bytes], { type: "application/octet-stream" }));
    /* KHÔNG tự đặt boundary: Response sinh boundary thật, đặt tay sẽ làm FormData không parse được. */
    const response = new Response(form, { status: 200 });
    const parsed = await parseBinaryResponse(response);
    expect(parsed.result.ok).toBe(true);
    const value = (parsed.result as { ok: true; value: { data: unknown } }).value;
    /* Byte phải là VÙNG NHỊ PHÂN thật: ArrayBuffer.isView rộng hơn Buffer.isBuffer (ADR 0004 §8). */
    expect(ArrayBuffer.isView(value.data)).toBe(true);
    expect(Array.from(value.data as Uint8Array)).toEqual([0, 1, 2, 255, 128]);
    /* Vì sao phải dùng ArrayBuffer.isView: Uint8Array KHÔNG phải Buffer, nên vị từ hẹp sẽ bỏ sót nó. */
    expect(Buffer.isBuffer(value.data)).toBe(false);
    expect(typeof value.data).toBe("object");
    expect(value.data instanceof Uint8Array).toBe(true);
  });

  test("multipart sai hình dạng bị từ chối, không trả dữ liệu nửa vời", async () => {
    const form = new FormData();
    form.set("metadata", JSON.stringify({ type: "server-response", rpcId: "a", result: { ok: true, value: 1 }, attachments: [] }));
    const response = new Response(form, { status: 200 });
    await expect(parseBinaryResponse(response)).rejects.toThrow(TypeError);
  });
});

describe("bên gọi RPC phía trình duyệt", () => {
  test("gửi đúng phong bì và trả kết quả khi rpcId khớp", async () => {
    const seen: Array<{ input: string; init: RequestInit }> = [];
    const rpc = createWebConnectionRpc(async (input, init) => {
      seen.push({ input, init });
      const sent = JSON.parse(String(init.body)) as { rpcId: string };
      return new Response(JSON.stringify({ type: "server-response", rpcId: sent.rpcId, result: { ok: true, value: 42 } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const result = await rpc.call("/api", "account/getState", { args: {} });
    expect(result).toEqual({ ok: true, value: 42 });
    expect(seen[0]?.input).toBe("api/account/getState");
    expect(seen[0]?.init.method).toBe("POST");
    const sent = JSON.parse(String(seen[0]?.init.body)) as Record<string, unknown>;
    expect(sent.type).toBe("client-request");
    expect(sent.method).toBe("account/getState");
    expect(sent.payload).toEqual({ args: {} });
  });

  test("lỗi vận chuyển, rpcId lệch và đích sai đều ném lỗi rõ ràng", async () => {
    const failing = createWebConnectionRpc(async () => new Response("nope", { status: 500 }));
    await expect(failing.call("/api", "x/y", {})).rejects.toThrow("transport failure for /api/x/y: HTTP 500");
    const mismatched = createWebConnectionRpc(async () => new Response(JSON.stringify({ type: "server-response", rpcId: "khac", result: { ok: true, value: 1 } }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(mismatched.call("/api", "x/y", {})).rejects.toThrow("rpcId mismatch");
    const rpc = createWebConnectionRpc(async () => new Response("{}", { status: 200 }));
    await expect(rpc.call("/api", "../etc/passwd", {})).rejects.toThrow("invalid RPC target");
    await expect(rpc.call("api", "x/y", {})).rejects.toThrow("invalid RPC target");
    expect(rpc.open).toBeUndefined();
  });

  test("open chỉ có khi giao vận cung cấp, và chỉ chấp nhận channel /api", async () => {
    const rpc = createWebConnectionRpc(async () => new Response("{}", { status: 200 }), async function* (endpoint) {
      yield endpoint;
    });
    expect(rpc.open).toBeDefined();
    const signal = new AbortController().signal;
    const stream = rpc.open?.("/api", "sessions/watch", {}, signal) as AsyncIterable<unknown>;
    const iterator = stream[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toBe("sessions/watch");
    expect(() => rpc.open?.("/khac", "x/y", {}, signal)).toThrow("worker-local streams require the /api channel");
  });
});

describe("socket và vòng đời thế hệ", () => {
  test("openConnectionWebSocket đổi scheme và cần base ngoài document", () => {
    const opened: string[] = [];
    const factory = (url: string) => {
      opened.push(url);
      return { readyState: 0 } as unknown as WebSocket;
    };
    openConnectionWebSocket("/connect", factory, "https://gbh.example/");
    expect(opened[0]).toBe("wss://gbh.example/connect");
    openConnectionWebSocket("/connect", factory, "http://127.0.0.1:5439/");
    expect(opened[1]).toBe("ws://127.0.0.1:5439/connect");
    /* Không có document và không có base ⇒ lỗi rõ ràng, không đoán bừa. */
    expect(() => openConnectionWebSocket("/connect", factory)).toThrow("requires streamBaseUrl");
  });

  test("controller mở thế hệ, phát trạng thái, và nối lại khi nguồn mất", async () => {
    const states: string[] = [];
    const hosts: string[] = [];
    let opens = 0;
    const controller = new ConnectionController((signal, ready) => {
      opens += 1;
      const generation = opens;
      ready({ home: "/tmp/home-" + String(generation) });
      return new Promise<void>((resolve) => {
        /* Nguồn sống tới khi bị abort; abort nghĩa là mất kết nối. */
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
    }, {
      onConnected: (host) => hosts.push(host.home ?? ""),
      onStateChange: (state) => states.push(state),
    }, { backoffBaseMs: 1, backoffMaxMs: 2, generationReadyTimeoutMs: 200 });
    controller.start();
    await Bun.sleep(30);
    expect(hosts.length).toBeGreaterThanOrEqual(1);
    expect(states).toContain("connected");
    const before = opens;
    controller.reconnect();
    await Bun.sleep(30);
    expect(opens).toBeGreaterThan(before);
    controller.stop();
    const after = opens;
    await Bun.sleep(20);
    expect(opens).toBe(after);
  });

  test("nguồn không bao giờ ready thì bỏ cuộc theo generationReadyTimeoutMs", async () => {
    const states: string[] = [];
    const controller = new ConnectionController((signal) => new Promise<void>((resolve) => {
      /* Nguồn KHÔNG bao giờ báo ready, nhưng vẫn settle khi bị abort (nguồn tử tế). */
      signal.addEventListener("abort", () => resolve(), { once: true });
    }), {
      onStateChange: (state) => states.push(state),
    }, { backoffBaseMs: 1, backoffMaxMs: 1, generationReadyTimeoutMs: 20, generationReadyWarnMs: 5 });
    controller.start();
    await Bun.sleep(60);
    controller.stop();
    expect(states).toContain("connecting");
    expect(states).not.toContain("connected");
  });

  test("offline thì tạm dừng thử lại, có mạng lại thì nối tiếp", async () => {
    let opens = 0;
    const states: string[] = [];
    const controller = new ConnectionController((signal, ready) => {
      opens += 1;
      ready({});
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    }, { onStateChange: (state) => states.push(state) }, { backoffBaseMs: 1, backoffMaxMs: 1, generationReadyTimeoutMs: 100 });
    controller.start();
    await Bun.sleep(10);
    controller.setNetworkAvailable(false);
    await Bun.sleep(10);
    expect(states).toContain("disconnected");
    controller.setNetworkAvailable(true);
    await Bun.sleep(20);
    controller.stop();
    expect(opens).toBeGreaterThanOrEqual(1);
  });
});

describe("cài service connection vào context", () => {
  test("provide ctx.connection với đủ bề mặt, và chặn hai nguồn/hai chủ vòng lặp", async () => {
    const provided = new Map<string, unknown>();
    const handle = installConnection({ provide: (name, value) => provided.set(name, value) }, { location: { hostname: "127.0.0.1" } });
    expect(provided.get("connection")).toBe(handle);
    expect(handle.interactions).toBe("answer");
    expect(handle.isLoopback).toBe(true);
    expect(handle.generation.getSnapshot()).toBeUndefined();
    expect(handle.state.getSnapshot()).toBeUndefined();
    let notified = 0;
    const unsubscribe = handle.generation.subscribe(() => {
      notified += 1;
    });
    const source = (signal: AbortSignal, ready: (host: { home?: string }) => void) => {
      ready({ home: "/tmp/x" });
      return new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    };
    handle.registerGenerationSource(source);
    expect(() => handle.registerGenerationSource(source)).toThrow("a generation source is already registered");
    const loop = handle.start({});
    await Bun.sleep(10);
    expect(handle.generation.getSnapshot()?.id).toBe(1);
    expect(handle.state.getSnapshot()).toBe("connected");
    expect(notified).toBeGreaterThan(0);
    expect(() => handle.start({})).toThrow("already owned by another consumer");
    loop.stop();
    await Bun.sleep(5);
    expect(handle.generation.getSnapshot()).toBeUndefined();
    unsubscribe();
    /* Trang KHÔNG phải loopback thì mất bề mặt đặc quyền. */
    const remote = installConnection({ provide: () => {} }, { location: { hostname: "gbh.example" } });
    expect(remote.isLoopback).toBe(false);
    expect(remote.interactions).toBe("answer");
    /* Không có vị trí trang (worker) ⇒ mặc định none, và vẫn coi là loopback. */
    const worker = installConnection({ provide: () => {} }, {});
    expect(worker.interactions).toBe("none");
    expect(worker.isLoopback).toBe(true);
    await Bun.sleep(0);
  });
});

describe("hằng số công khai và lỗi vận chuyển", () => {
  test("đường dẫn mount và hàm chuẩn hoá lỗi giữ đúng hợp đồng", () => {
    expect(API_PATH).toBe("/api");
    expect(CONNECT_PATH).toBe("/connect");
    expect(RpcId("probe")).toBe("probe");
    expect(transportError(new Error("no"))).toEqual({ code: "gateway/internal", message: "no", details: {} });
    expect(transportError({ code: "gateway/bad-request", message: "x", details: { a: 1 } })).toEqual({ code: "gateway/bad-request", message: "x", details: { a: 1 } });
    const peer = new Peer({} as never, { principal: { kind: "owner" } });
    expect(peer.interactions).toBe("answer");
    expect(peer.signal.aborted).toBe(false);
    peer.dispose();
    expect(peer.signal.aborted).toBe(true);
  });

  test("nhịp phục hồi áp đúng mặc định của bản gốc và từ chối giá trị sai", () => {
    expect(resolveConnectionConfig()).toEqual({ backoffBaseMs: 500, backoffFactor: 2, backoffMaxMs: 10000, generationReadyWarnMs: 3000, generationReadyTimeoutMs: 15000 });
    expect(resolveConnectionConfig({ backoffBaseMs: 5 }).backoffBaseMs).toBe(5);
    expect(() => resolveConnectionConfig({ backoffBaseMs: 0 })).toThrow(RangeError);
    expect(() => resolveConnectionConfig({ backoffFactor: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => resolveConnectionConfig({ backoffFactor: 0.5 })).toThrow(RangeError);
  });
});

describe("(4b) idempotent apply — hai ca BẮT BUỘC", () => {
  test("gọi apply HAI lần ⇒ lần hai là NO-OP (số lần cài không tăng)", async () => {
    /* Nạp module TƯƠI cho mỗi ca: cờ 'installed' ở phạm vi module sẽ dính giữa các ca nếu dùng import tĩnh.
       Giữ biến kiểu string để TS không phân giải đường dẫn có query. */
    const spec: string = "../../packages/client/connection/src/client/plugin.ts?idempotent";
    const module_ = (await import(spec)) as { apply(ctx: { provide(name: string, value: unknown): void }): void };
    let installs = 0;
    const ctx = {
      provide: () => {
        installs += 1;
      },
    };
    module_.apply(ctx);
    expect(installs).toBe(1);
    module_.apply(ctx);
    /* Lần thứ hai KHÔNG được cài lại: đó là điều kiện để row hai-id activate được. */
    expect(installs).toBe(1);
  });

  test("apply ném lỗi ⇒ có ĐÚNG 1 dòng console.error VÀ lỗi vẫn được ném tiếp", async () => {
    const spec: string = "../../packages/client/connection/src/client/plugin.ts?throwing";
    const module_ = (await import(spec)) as { apply(ctx: { provide(name: string, value: unknown): void }): void };
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      /* ctx làm provide ném lỗi ⇒ đi đúng nhánh catch của khuôn (4b). */
      const ctx = {
        provide: () => {
          throw new Error("provide no");
        },
      };
      expect(() => module_.apply(ctx)).toThrow("provide no");
      expect(logged.length).toBe(1);
      expect(String(logged[0]?.[0] ?? "")).toContain("gbh-client-connection: apply nem loi");
    } finally {
      console.error = original;
    }
  });
});

/**
 * Phản hồi node giả GIỮ NGUYÊN BYTE của thân (khác `fakeResponse` chỉ giữ chuỗi).
 * @returns đối tượng ghi lại trạng thái, header và byte.
 */
function fakeByteResponse(): NodeResponseLike & { status: number; headers: Record<string, string>; body: Buffer } {
  return {
    status: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(status: number, extra?: Record<string, string>) {
      this.status = status;
      this.headers = extra ?? {};
    },
    end(body?: string | Uint8Array) {
      this.body = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body ?? new Uint8Array());
    },
  };
}

describe("phía HOST của ca BYTE: readBytes trả multipart, không nhét byte vào JSON", () => {
  test("envelopeOf: kết quả có attachments ⇒ multipart/form-data, client gỡ ra Uint8Array đúng byte", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x80]);
    const response = envelopeOf("probe-bytes", { ok: true, value: { data: null, offset: 0, eof: true }, attachments: [{ path: ["data"], bytes }] });
    /* Hợp đồng dây của bản gốc: KHÔNG phải JSON — byte chỉ đi trong part nhị phân. */
    expect(response.headers.get("content-type") ?? "").toContain("multipart/form-data");
    /* Đọc bằng CHÍNH bộ gỡ của trình duyệt: hai đầu phải khớp nhau. */
    const parsed = await parseBinaryResponse(response);
    expect(parsed.result.ok).toBe(true);
    const value = (parsed.result as { ok: true; value: { data: Uint8Array; offset: number; eof: boolean } }).value;
    expect(value.data instanceof Uint8Array).toBe(true);
    expect(Array.from(value.data)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x80]);
    expect(value.offset).toBe(0);
    expect(value.eof).toBe(true);
  });

  test("envelopeOf: không có attachments (và kết quả lỗi) vẫn là JSON như cũ", async () => {
    const plain = envelopeOf("probe-json", { ok: true, value: { lines: 3 } });
    expect(plain.headers.get("content-type")).toBe("application/json");
    expect(await plain.json()).toEqual({ type: "server-response", rpcId: "probe-json", result: { ok: true, value: { lines: 3 } } });
    const empty = envelopeOf("probe-empty", { ok: true, value: 1, attachments: [] });
    expect(await empty.json()).toEqual({ type: "server-response", rpcId: "probe-empty", result: { ok: true, value: 1 } });
    const failure = envelopeOf("probe-fail", { ok: false, error: { code: "gateway/input-invalid", message: "x" } });
    expect(await failure.json()).toEqual({ type: "server-response", rpcId: "probe-fail", result: { ok: false, error: { code: "gateway/input-invalid", message: "x" } } });
  });

  test("cầu node→fetch: thân multipart tới trình duyệt NGUYÊN BYTE (byte > 0x7F không bị giải UTF-8)", async () => {
    /* Dãy KHÔNG hợp lệ UTF-8: đọc bằng `text()` sẽ biến thành U+FFFD và làm hỏng ảnh. */
    const bytes = new Uint8Array([0xc3, 0x28, 0xff, 0x00, 0xa9]);
    const handler: ConnectionFetchHandler = {
      requestBodyMode: () => "buffered",
      fetch: async () => envelopeOf("probe-bridge", { ok: true, value: { data: null }, attachments: [{ path: ["data"], bytes }] }),
    };
    const request = fakeNodeRequest({ url: "/api/workspaceFiles/readBytes", headers: { "content-type": "application/json" }, chunks: ['{"type":"client-request"}'] });
    const response = fakeByteResponse();
    const bridge = bridgeNodeRequest(request, response, handler, {} as never, 1024);
    request.emitAll();
    await bridge;
    expect(response.status).toBe(200);
    expect(response.headers["content-type"] ?? "").toContain("multipart/form-data");
    expect(response.body.byteLength).toBeGreaterThan(bytes.byteLength);
    const parsed = await parseBinaryResponse(new Response(new Uint8Array(response.body), { status: response.status, headers: response.headers }));
    const value = (parsed.result as { ok: true; value: { data: Uint8Array } }).value;
    expect(Array.from(value.data)).toEqual([0xc3, 0x28, 0xff, 0x00, 0xa9]);
  });
});
