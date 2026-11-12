/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Service connection của Host: hàng rào tin cậy, xác thực phiên, sổ đăng ký RPC/Fetch và cầu node→fetch
 *      11/11/2026: kết quả RPC có trường NHỊ PHÂN (ảnh/tệp) gửi bằng multipart/form-data như bản gốc —
 *      trước đây lọt vào JSON nên client không gắn lại được byte ⇒ "workspaceFiles/readBytes failed: …
 *      [{\"code\":\"custom\",\"path\":[\"data\"]}]"; cầu node→fetch đọc BYTE thay vì giải UTF-8.
 */

import { randomUUID } from "node:crypto";

import { Service, type Context } from "@deepseek-ai/cordis";

import { API_PATH, CONNECT_PATH } from "../ids.ts";
import { BrowserAuth, type AuthRequest, type AuthResponse } from "./browser-auth.ts";
import { clientRequestSchema } from "./rpc-schema.ts";
import { isTrustedApiRequest, type RequestFacts } from "./trust.ts";

/** Người đứng sau một Peer: chủ sở hữu (trình duyệt đã xác thực) hay một toán tử độc lập. */
export interface PeerPrincipal {
  /** Loại chủ thể. */
  kind: "owner" | "operator";
}

/** Tham số tạo một Peer. */
export interface PeerOptions {
  /** Chủ thể mà Peer này nói thay. */
  principal: PeerPrincipal;
  /** Tham gia sự kiện chuyển tiếp: "answer" nghĩa là Peer này trả lời các yêu cầu chuyển tiếp. */
  interactions?: "answer" | "none";
}

/**
 * Một bên đã được Host chấp nhận.
 *
 * Bản gốc dùng gói `dsh-scope` để tạo scope riêng cho từng Peer; gói đó KHÔNG thuộc bảng peer §3b, nên bản
 * viết lại dùng chính context của chủ sở hữu làm `peer.ctx` (cách ly event theo từng Peer CHƯA làm — ghi rõ
 * trong README). Mọi thứ còn lại của hợp đồng Peer vẫn giữ: id ổn định, principal, interactions, tín hiệu
 * vòng đời và dispose idempotent.
 */
export class Peer {
  /** Id ổn định của Peer trong lượt chạy này. */
  readonly id: string;

  /** Chủ thể mà Peer nói thay. */
  readonly principal: PeerPrincipal;

  /** Tham gia sự kiện chuyển tiếp. */
  readonly interactions: "answer" | "none";

  /** Context dùng khi dispatch cho Peer này. */
  readonly ctx: Context;

  /** Tín hiệu vòng đời; abort khi Peer bị dispose. */
  readonly signal: AbortSignal;

  /** Bộ điều khiển vòng đời. */
  private readonly lifetime = new AbortController();

  /**
   * @param owner - context sở hữu Peer.
   * @param options - chủ thể và mức tham gia sự kiện.
   */
  constructor(owner: Context, options: PeerOptions) {
    this.id = randomUUID();
    this.principal = options.principal;
    this.interactions = options.interactions ?? "answer";
    this.ctx = owner;
    this.signal = this.lifetime.signal;
  }

  /**
   * Kết thúc vòng đời Peer; gọi lại lần nữa không có tác dụng.
   * @returns promise hoàn tất khi vòng đời đã đóng (hợp đồng `release` của admission).
   */
  async dispose(): Promise<void> {
    if (!this.lifetime.signal.aborted) this.lifetime.abort();
  }
}

/** Bộ xử lý Fetch của một channel chung (đúng hình dạng bản gốc). */
export interface ConnectionFetchHandler {
  /** Cách đọc thân cho một yêu cầu: đệm, hay chuyển tiếp luồng. */
  requestBodyMode(request: { method: string; url: string }): "buffered" | "stream";
  /** Phục vụ một yêu cầu đã qua hàng rào và xác thực. */
  fetch(request: Request, peer: Peer): Promise<Response>;
}

/** Đoạn endpoint hợp lệ trên dây. */
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/u;

/** Đường dẫn của một URL tuyệt đối hoặc tương đối. */
function pathnameOf(url: string): string {
  const at = url.indexOf("?");
  const withoutQuery = at === -1 ? url : url.slice(0, at);
  const schemeAt = withoutQuery.indexOf("://");
  if (schemeAt === -1) return withoutQuery;
  const slashAt = withoutQuery.indexOf("/", schemeAt + 3);
  return slashAt === -1 ? "/" : withoutQuery.slice(slashAt);
}

/**
 * Tách endpoint khỏi đường dẫn dưới một channel chung.
 * @param channel - channel chung (ví dụ "/api").
 * @param pathname - đường dẫn yêu cầu.
 * @returns endpoint hợp lệ, hoặc undefined khi không thuộc channel hay có đoạn sai.
 */
function endpointFromPath(channel: string, pathname: string): string | undefined {
  if (!pathname.startsWith(channel + "/")) return undefined;
  const endpoint = pathname.slice(channel.length + 1);
  const bad = endpoint.split("/").some((segment) => segment === "" || segment === "." || segment === ".." || !ENDPOINT_SEGMENT_PATTERN.test(segment));
  return bad ? undefined : endpoint;
}

/**
 * Một trường nhị phân của kết quả RPC (ảnh, tệp, PDF) mà hộp thư JSON không mang được.
 * Đường dẫn tính từ gốc `value`; chỗ giữ chỗ trên dây là `null` và được trình duyệt thay bằng byte thật.
 */
export interface RpcAttachment {
  /** Đường dẫn trường trong `value` (khoá chuỗi, hoặc chỉ số mảng). */
  readonly path: readonly (string | number)[];
  /** Byte thô của trường đó. */
  readonly bytes: Uint8Array;
}

/** Kết quả một lần dispatch RPC mà seam này chấp nhận từ bộ chặn. */
export type ConnectionRpcHandlerResult =
  | { readonly ok: true; readonly value: unknown; readonly attachments?: readonly RpcAttachment[] }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details?: Record<string, unknown> } };

/** Bộ chặn RPC đã đăng ký cho một channel. */
interface RpcInterceptor {
  /** Chủ sở hữu đăng ký (dùng để gỡ khi context chết). */
  readonly owner: Context;
  /** Nhận endpoint, trả true khi bộ chặn này phụ trách nó. */
  readonly matches: (endpoint: string) => boolean;
  /** Xử lý một lần gọi đã qua kiểm phong bì. */
  readonly handler: (endpoint: string, payload: unknown, signal: AbortSignal, peer: Peer) => Promise<ConnectionRpcHandlerResult>;
}

/** Tuyến Fetch CHÍNH XÁC (không qua phong bì RPC), đúng hình dạng các plugin khác đăng ký. */
export interface ConnectionFetchRoute {
  /** Đường dẫn chính xác (khớp cả chuỗi, ví dụ "/api/deliverables/1"). */
  readonly path: string;
  /** Các phương thức tuyến này nhận. */
  readonly methods: readonly string[];
  /** Cách đọc thân: "buffered" (mặc định) hoặc "stream" cho tải lên/xuống dài. */
  readonly requestBody?: "buffered" | "stream";
  /** Xử lý yêu cầu và trả phản hồi Fetch. */
  readonly fetch: (request: Request) => Promise<Response> | Response;
}

/** Yêu cầu node tối thiểu mà cầu cần. */
export interface NodeRequestLike extends AuthRequest {
  /** Đọc thân yêu cầu. */
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  /** Bỏ phần thân chưa đọc. */
  resume?(): void;
}

/** Phản hồi node tối thiểu mà cầu cần. */
export interface NodeResponseLike extends AuthResponse {
  /** Đã gửi header chưa. */
  headersSent?: boolean;
  /** Header đã gửi. */
  getHeader?(name: string): unknown;
  /** Ghi thêm header. */
  setHeader?(name: string, value: string): unknown;
}

/** Thân yêu cầu đã đệm. */
export type BodyResult = { ok: true; text: string } | { ok: false; status: 413 };

/**
 * Cầu một yêu cầu node đã xác thực sang bộ xử lý Fetch: đọc thân có ngưỡng, gọi bộ xử lý, ghi phản hồi.
 *
 * Ngưỡng bị vượt trả 413 ngay (và đóng kết nối) trước khi bất kỳ byte nào được phân tích — đúng hành vi
 * bản gốc, và là ca lỗi mà phép đo byte của ADR 0004 §8 nhắc tới.
 * @param request - yêu cầu node.
 * @param response - phản hồi node.
 * @param handler - bộ xử lý Fetch đã có Peer.
 * @param peer - Peer đang gọi.
 * @param maxBytes - ngưỡng thân.
 */
export async function bridgeNodeRequest(
  request: NodeRequestLike,
  response: NodeResponseLike,
  handler: ConnectionFetchHandler,
  peer: Peer,
  maxBytes: number,
): Promise<void> {
  /* Tuyến "stream" tự đọc thân: cầu chỉ đệm khi bộ xử lý nói cần đệm. */
  const streaming = handler.requestBodyMode({ method: request.method ?? "POST", url: request.url ?? "/" }) === "stream";
  const body = streaming ? ({ ok: true, text: "" } as const) : await readBody(request, maxBytes);
  if (!body.ok) {
    response.writeHead(413, { connection: "close" });
    response.end();
    return;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const target = new Request("http://dsh.invalid" + (request.url ?? "/"), {
    method: request.method ?? "POST",
    headers,
    ...(request.method === "GET" || request.method === "HEAD" || streaming ? {} : { body: body.text }),
  });
  const result = await handler.fetch(target, peer);
  // Header phải đọc TRƯỚC khi tiêu thụ thân: với phản hồi dựng từ FormData, Bun chỉ còn giữ content-type
  // (kèm boundary) khi thân chưa bị đọc — đọc thân trước rồi hỏi header sẽ ra null và mất luôn boundary.
  const contentType = result.headers.get("content-type") ?? "text/plain; charset=utf-8";
  // 11/11/2026 — phải đọc BYTE, không đọc CHỮ: phản hồi multipart (ảnh/tệp qua `readBytes`) mang byte thô,
  // `result.text()` giải UTF-8 sẽ làm hỏng mọi byte > 0x7F trước khi tới trình duyệt.
  const payload = Buffer.from(await result.arrayBuffer());
  const out: Record<string, string> = { "content-type": contentType };
  response.writeHead(result.status, out);
  response.end(payload);
}

/**
 * Đọc trọn thân yêu cầu vào bộ đệm, chặn ở ngưỡng cấu hình.
 * @param request - yêu cầu node.
 * @param maxBytes - ngưỡng byte.
 * @returns văn bản thân, hoặc 413 khi vượt ngưỡng.
 */
async function readBody(request: NodeRequestLike, maxBytes: number): Promise<BodyResult> {
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  return await new Promise<BodyResult>((resolve) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let settled = false;
    const finish = (result: BodyResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    request.on("data", (...args: unknown[]) => {
      const chunk = args[0] as Uint8Array;
      size += chunk.byteLength;
      if (size > maxBytes) {
        finish({ ok: false, status: 413 });
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    });
    request.on("error", () => {
      finish({ ok: true, text: "" });
    });
  });
}

/** Phản hồi lỗi vận chuyển dạng văn bản thuần. */
function textResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

/**
 * Dựng phản hồi `multipart/form-data` cho kết quả có trường nhị phân — ĐÚNG hợp đồng dây của bản gốc:
 * một part `metadata` mang phong bì JSON (với `attachments: [{path, codec: "bytes", part}]`), và mỗi
 * trường nhị phân một part `bytes-<n>`. Trình duyệt gỡ các part này thành `Uint8Array` tại đúng `path`.
 *
 * Vì sao cần: JSON không mang được `Uint8Array` (JSON.stringify biến nó thành `{type:'Buffer',data:[…]}`),
 * và bản gốc cũng KHÔNG gửi byte trong JSON. Thiếu nhánh này thì `workspaceFiles/readBytes` trả
 * `data: null` ⇒ codec kết quả của client từ chối ⇒ "workspaceFiles/readBytes failed: [{\"code\":\"custom\",…}]".
 * @param rpcId - id tương quan của lời gọi.
 * @param value - kết quả đã mã hoá (chỗ giữ chỗ nhị phân là `null`).
 * @param attachments - các trường nhị phân cần gửi kèm.
 * @returns phản hồi multipart mang đúng byte.
 */
export function multipartResponse(rpcId: string, value: unknown, attachments: readonly RpcAttachment[]): Response {
  const parts = new FormData();
  const metadata = attachments.map((attachment, index) => {
    const part = "bytes-" + String(index);
    parts.set(part, new Blob([new Uint8Array(attachment.bytes)]));
    return { path: [...attachment.path], codec: "bytes", part };
  });
  parts.set("metadata", JSON.stringify({ type: "server-response", rpcId, result: { ok: true, value }, attachments: metadata }));
  return new Response(parts);
}

/** Phong bì phản hồi thành công/thất bại theo đúng hợp đồng dây. */
export function envelopeOf(rpcId: string, result: ConnectionRpcHandlerResult): Response {
  if (result.ok) {
    // Bản gốc BỎ `attachments` khỏi JSON — chúng chỉ sống trong part nhị phân, không lặp lại trong metadata.
    const { attachments, ...value } = result;
    if (attachments !== undefined && attachments.length > 0) {
      return multipartResponse(rpcId, value.value, attachments);
    }
    const payload = { type: "server-response", rpcId, result: value };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }
  const payload = { type: "server-response", rpcId, result };
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}

/** Phong bì lỗi giao thức (HTTP 200, mã gateway/bad-request như bản gốc). */
function badRequest(rpcId: string, message: string): Response {
  return envelopeOf(rpcId, { ok: false, error: { code: "gateway/bad-request", message } });
}

/**
 * Service `connection` của Host.
 *
 * Sở hữu: hàng rào tin cậy (Host/Origin/cross-site), xác thực phiên, sổ đăng ký RPC và Fetch, và việc biến
 * một yêu cầu /api đã xác thực thành lời gọi endpoint. Khi `webServer` có mặt, plugin còn mount `/api` và
 * `/connect` (xem index.ts).
 */
export class HostConnectionService extends Service {
  /** Sổ đăng ký channel RPC chung. */
  readonly rpc: {
    /** Đăng ký bộ chặn cho một channel. */
    intercept(channel: string, matches: (endpoint: string) => boolean, handler: RpcInterceptor["handler"]): () => void;
    /** Đăng ký bộ xử lý nhận mọi endpoint của một channel. */
    register(channel: string, handler: RpcInterceptor["handler"]): () => void;
  };

  /** Sổ đăng ký tuyến Fetch chính xác (theo đường dẫn). */
  readonly fetch: {
    /** Đăng ký một tuyến; trả hàm gỡ. */
    register(route: ConnectionFetchRoute): () => void;
  };

  /** Peer chủ sở hữu mà mọi kết nối trình duyệt đã xác thực dùng chung. */
  readonly browserPeer: Peer;

  /** Deployment này có chấp nhận authority ngoài loopback hay không. */
  readonly allowsRemoteAuthorities: boolean;

  /** Authority tin cậy đã qua kiểm. */
  private readonly trustedHosts: readonly string[];

  /** Hàng rào xác thực phiên. */
  private readonly browserAuth: BrowserAuth;

  /** Bộ chặn RPC theo channel. */
  private readonly interceptors = new Map<string, RpcInterceptor[]>();

  /** Tuyến Fetch chính xác theo đường dẫn. */
  private readonly fetchRoutes = new Map<string, ConnectionFetchRoute>();

  /** Peer đã cấp phát (toán tử /connect hoặc Peer trong tiến trình), kèm trạng thái sở hữu socket. */
  private readonly peers = new Map<string, { peer: Peer; ownsSocket: boolean }>();

  /** Đã dispose chưa (mọi yêu cầu sau đó bị 401). */
  private disposed = false;

  /**
   * @param ctx - context của plugin.
   * @param trustedHosts - authority ngoài loopback mà deployment phục vụ.
   * @param browserAuth - hàng rào xác thực phiên trình duyệt.
   */
  constructor(ctx: Context, trustedHosts: readonly string[], browserAuth: BrowserAuth) {
    super(ctx, "connection");
    this.trustedHosts = trustedHosts;
    this.browserAuth = browserAuth;
    this.allowsRemoteAuthorities = trustedHosts.some((entry) => {
      const host = entry.includes(":") && !entry.startsWith("[") ? entry.slice(0, entry.lastIndexOf(":")) : entry;
      return host !== "localhost" && !/^127\./u.test(host.replace(/^\[/u, "").replace(/\]$/u, ""));
    });
    this.browserPeer = new Peer(ctx, { principal: { kind: "owner" } });
    this.rpc = {
      intercept: (channel, matches, handler) => this.addInterceptor(ctx, channel, matches, handler),
      register: (channel, handler) => this.addInterceptor(ctx, channel, () => true, handler),
    };
    this.fetch = { register: (route) => this.addRoute(ctx, route) };
    ctx.effect(() => () => {
      this.disposed = true;
      void this.browserPeer.dispose();
      for (const record of this.peers.values()) void record.peer.dispose();
      this.peers.clear();
    }, "client-connection: service lifetime");
  }

  /** Đăng ký một bộ chặn và gỡ nó khi context chủ chết. */
  private addInterceptor(owner: Context, channel: string, matches: (endpoint: string) => boolean, handler: RpcInterceptor["handler"]): () => void {
    const entry: RpcInterceptor = { owner, matches, handler };
    const list = this.interceptors.get(channel) ?? [];
    list.push(entry);
    this.interceptors.set(channel, list);
    const release = (): void => {
      const current = this.interceptors.get(channel);
      if (current === undefined) return;
      const at = current.indexOf(entry);
      if (at !== -1) current.splice(at, 1);
      if (current.length === 0) this.interceptors.delete(channel);
    };
    owner.effect(() => release, "client-connection: rpc interceptor");
    return release;
  }

  /**
   * Đăng ký một tuyến Fetch chính xác và gỡ nó khi context chủ chết.
   * @param owner - context sở hữu tuyến.
   * @param route - tuyến cần đăng ký.
   * @returns hàm gỡ.
   * @throws Error khi đường dẫn đã có tuyến khác (hai tuyến cùng path là lỗi lập trình, không im lặng).
   */
  private addRoute(owner: Context, route: ConnectionFetchRoute): () => void {
    if (this.fetchRoutes.has(route.path)) throw new Error("connection: exact Fetch route " + JSON.stringify(route.path) + " is already registered");
    this.fetchRoutes.set(route.path, route);
    const release = (): void => {
      if (this.fetchRoutes.get(route.path) === route) this.fetchRoutes.delete(route.path);
    };
    owner.effect(() => release, "client-connection: fetch route");
    return release;
  }

  /**
   * Yêu cầu này có được Host phục vụ hay không (hàng rào Host/Origin/cross-site).
   * @param request - sự thật header của yêu cầu.
   * @returns true khi địa chỉ là của ta và mọi dấu hiệu trình duyệt đều cùng origin.
   */
  isTrusted(request: RequestFacts): boolean {
    const carrier = this.ctx.get("webServer") as { host?: string; protocol?: string } | undefined;
    return isTrustedApiRequest(request, this.trustedHosts, carrier?.host, carrier?.protocol ?? "http:");
  }

  /** Giao thức của listener (https khi phục vụ TLS) — quyết định cookie Secure. */
  private secure(): boolean {
    return (this.ctx.get("webServer") as { protocol?: string } | undefined)?.protocol === "https:";
  }

  /**
   * Mã từ chối cho một yêu cầu /api, hoặc undefined khi được đi tiếp.
   *
   * Thứ tự giống bản gốc: hàng rào tin cậy trước (403), rồi tới phiên (401). Yêu cầu đã dispose luôn 401.
   * @param request - yêu cầu cần kiểm.
   * @returns 401, 403, hoặc undefined.
   */
  requestRejection(request: AuthRequest): 401 | 403 | 409 | undefined {
    const admission = this.admit(request);
    return "rejection" in admission ? admission.rejection : undefined;
  }

  /**
   * Chấp nhận một yêu cầu /api: trả Peer chủ sở hữu, hoặc mã từ chối.
   * @param request - yêu cầu cần chấp nhận.
   * @returns { peer } hoặc { rejection }.
   */
  admit(request: AuthRequest): { peer: Peer } | { rejection: 401 | 403 } {
    /* Thứ tự giống bản gốc: tin cậy (403) -> đã dispose (401) -> phiên trình duyệt -> toán tử -> 401. */
    if (!this.isTrusted(request)) return { rejection: 403 };
    if (this.disposed) return { rejection: 401 };
    const secure = this.secure();
    if (this.browserAuth.isAuthenticated(request, secure)) return { peer: this.browserPeer };
    const identity = this.browserAuth.authenticateApi(request, secure);
    const record = identity?.id === undefined ? undefined : this.peers.get(identity.id);
    return record === undefined ? { rejection: 401 } : { peer: record.peer };
  }

  /**
   * Chấp nhận một yêu cầu nâng cấp WebSocket (không có thân, nên chỉ hàng rào + phiên).
   * @param request - yêu cầu nâng cấp.
   * @returns { peer } hoặc { rejection }.
   */
  admitConnection(request: AuthRequest): { peer: Peer; release: () => Promise<void> } | { rejection: 401 | 403 | 409 } {
    const admission = this.admit(request);
    if ("rejection" in admission) return admission;
    const record = this.peers.get(admission.peer.id);
    if (record === undefined) return { ...admission, release: () => Promise.resolve() };
    if (record.ownsSocket) return { rejection: 409 };
    record.ownsSocket = true;
    let released: Promise<void> | undefined;
    return {
      peer: record.peer,
      release: () => {
        if (released !== undefined) return released;
        this.peers.delete(record.peer.id);
        released = record.peer.dispose();
        return released;
      },
    };
  }

  /**
   * Tạo một Peer trong tiến trình, chết cùng context đã đọc `ctx.connection`.
   * @param options - chủ thể và mức tham gia sự kiện.
   * @returns Peer mới.
   */
  createPeer(options: PeerOptions): Peer {
    const peer = new Peer(this.ctx, options);
    this.ctx.effect(() => () => peer.dispose(), "client-connection: peer lifetime");
    return peer;
  }

  /**
   * Cấp một toán tử độc lập cho một phiên /connect.
   * @param interactions - mức tham gia sự kiện chuyển tiếp.
   * @returns id của toán tử.
   */
  publishPeer(interactions: "answer" | "none"): string {
    const peer = new Peer(this.ctx, { principal: { kind: "owner" }, interactions });
    this.peers.set(peer.id, { peer, ownsSocket: false });
    return peer.id;
  }

  /**
   * Trao token khởi động lấy cookie phiên qua /connect.
   * @param request - yêu cầu /connect.
   * @param response - phản hồi do hàm này sở hữu.
   * @returns true khi đã cấp credential.
   */
  authorizeConnect(request: AuthRequest, response: AuthResponse): boolean {
    return this.browserAuth.authorizeConnect(request, response, false, (interactions) => this.publishPeer(interactions));
  }

  /**
   * Xác thực một yêu cầu index.
   * @param request - yêu cầu index.
   * @param response - phản hồi do hàm này sở hữu khi trả false.
   * @returns true khi bên gọi được phục vụ index.html.
   */
  authorizeIndex(request: AuthRequest, response: AuthResponse): boolean {
    return this.browserAuth.authorizeIndex(request, response);
  }

  /**
   * URL có token khởi động để mở lần đầu.
   * @param baseUrl - URL gốc của web surface.
   * @returns URL đã gắn token.
   */
  authenticatedUrl(baseUrl: string): string {
    return this.browserAuth.authenticatedUrl(baseUrl);
  }

  /**
   * Dựng bộ xử lý Fetch cho một channel chung: tuyến chính xác trước, rồi tới bộ chặn RPC của channel.
   *
   * Hình dạng trả về ĐÚNG như bản gốc: một đối tượng { requestBodyMode, fetch } để cầu node→fetch biết
   * phải đệm thân hay chuyển tiếp luồng, và để tuyến của plugin khác (tải tài liệu, media, log phiên) chạy.
   * @param channel - channel chung do Connection mount (ví dụ "/api").
   * @returns bộ xử lý Fetch của channel.
   */
  createSharedFetchHandler(channel: string): ConnectionFetchHandler {
    return {
      requestBodyMode: (request) => {
        const pathname = pathnameOf(request.url);
        const route = this.fetchRoutes.get(pathname);
        return route !== undefined && route.methods.includes(request.method) ? (route.requestBody ?? "buffered") : "buffered";
      },
      fetch: async (request, peer) => {
        const pathname = pathnameOf(request.url);
        const route = this.fetchRoutes.get(pathname);
        if (route !== undefined && route.methods.includes(request.method)) {
          /* Tuyến chính xác chỉ phục vụ chủ sở hữu: toán tử là bên thứ ba, không được đọc tài nguyên của trang. */
          if (peer.principal.kind !== "owner") return new Response("forbidden", { status: 403 });
          return await route.fetch(request);
        }
        const endpoint = endpointFromPath(channel, pathname);
        if (endpoint === undefined) return textResponse("not found", 404);
        const interceptor = this.claimInterceptor(channel, endpoint);
        if (interceptor === undefined) return textResponse("not found", 404);
        return await this.interceptRpc(request, peer, endpoint, interceptor);
      },
    };
  }

  /**
   * Dispatch một lời gọi RPC đã được một bộ chặn nhận, theo đúng bảng lỗi của bản gốc.
   * @param request - yêu cầu đã qua hàng rào và xác thực.
   * @param peer - Peer đang gọi.
   * @param endpoint - endpoint đã tách từ đường dẫn.
   * @param interceptor - bộ chặn nhận endpoint này.
   * @returns phản hồi HTTP.
   */
  private async interceptRpc(request: Request, peer: Peer, endpoint: string, interceptor: RpcInterceptor): Promise<Response> {
    if (request.method !== "POST") return textResponse("not found", 404);
    const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") return textResponse("content type must be application/json", 415);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await request.text());
    } catch {
      return textResponse("body is not JSON", 400);
    }
    const envelope = clientRequestSchema.safeParse(parsed);
    if (!envelope.success) return badRequest("invalid-request", "request body is not a Connection client-request envelope");
    try {
      const result = await interceptor.handler(endpoint, envelope.data.payload, peer.signal, peer);
      return envelopeOf(envelope.data.rpcId, result);
    } catch (error) {
      console.error("[connection] rpc handler failed:", error);
      return textResponse("handler failure: " + (error instanceof Error ? error.message : String(error)), 500);
    }
  }

  /**
   * Bộ chặn đầu tiên nhận endpoint này trong một channel.
   * @param channel - channel chung.
   * @param endpoint - endpoint đã tách.
   * @returns bộ chặn, hoặc undefined khi không ai nhận.
   */
  private claimInterceptor(channel: string, endpoint: string): RpcInterceptor | undefined {
    for (const entry of this.interceptors.get(channel) ?? []) if (entry.matches(endpoint)) return entry;
    return undefined;
  }
}
