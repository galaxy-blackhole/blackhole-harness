/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tang 2 cua gateway: discovery + dispatch + wire (4 phan da duyet trong docs/recipes/HOST-ROW-REWRITE.md).
 */
import { Service, symbols } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { remoteMethods } from "@deepseek-ai/dsh-typert-protocol";
import type { WireResult } from "./wire.ts";

/** Loi cua gateway: mang ma on dinh di qua duong wire. */
export class TypertGatewayError extends Error {
  /** Ma loi on dinh (gateway/…). */
  readonly code: string;
  /** Endpoint dang xu ly. */
  readonly endpoint: string;

  /**
   * Tao mot loi gateway.
   * @param code - ma loi on dinh.
   * @param endpoint - endpoint canonical.
   * @param message - chan doan huong cach sua.
   */
  constructor(code: string, endpoint: string, message: string) {
    super(message);
    this.name = "TypertGatewayError";
    this.code = code;
    this.endpoint = endpoint;
  }
}

/** Binding cong khai ma mot remote phoi ra (xem TypertRemoteService). */
interface TypertRemoteBinding {
  readonly service: object;
  readonly serviceKey: string;
  readonly namespace: string;
}

/** Mot marker method remote do decorator @Remote gan vao descriptor. */
interface RemoteMethodMarker {
  readonly method: string;
  readonly exportName?: string;
}

/** Ket qua dispatch ma seam connection mong doi (ConnectionRpcHandlerResult). */
export type DispatchResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Thong diep co dinh cua upstream cho payload sai hinh dang (tang giao thuc, HTTP 200). */
const ARGS_MESSAGE = "Remote payload must contain exactly one plain-object args field";

/** Thong diep co dinh khi khong co remote nao phoi endpoint. */
const UNAVAILABLE_MESSAGE = "no active Remote method exports this endpoint";

/**
 * Bo proxy cua cordis de lay object goc — moi metadata (typertRemote, descriptor @Remote) chi thay tren object goc.
 * @param receiver - instance lay tu ctx.get().
 * @returns object goc.
 */
function originalOf(receiver: object): object {
  const original = Reflect.get(receiver, symbols.original as unknown as string);
  return typeof original === "object" && original !== null ? (original as object) : receiver;
}

/**
 * Ghep endpoint canonical tu namespace va ten method.
 * @param namespace - namespace tren wire.
 * @param name - ten method (exportName hoac ten ham).
 * @returns endpoint dang <namespace>/<name>.
 */
function endpointOf(namespace: string, name: string): string {
  return namespace + "/" + name;
}

/**
 * Doc truong args duy nhat trong payload.
 * @param payload - payload da duoc seam connection boc.
 * @returns args dang object, hoac undefined khi hinh dang sai.
 */
function readArgs(payload: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== "args") return undefined;
  const args = (payload as Record<string, unknown>).args;
  if (typeof args !== "object" || args === null || Array.isArray(args)) return undefined;
  return args as Record<string, unknown>;
}

/**
 * Gateway RPC cua kernel: nhan dien endpoint nao do remote nao phoi, roi dieu phoi lan goi.
 *
 * Ranh gioi tang (docs/recipes/HOST-ROW-REWRITE.md): seam `connection` da parse envelope va tra loi 6/12 ca loi
 * (2/3/4 gateway/bad-request, 8/9/11 loi van chuyen); lop nay so huu ca 1/5/6/7/10/12 — tuc kiem `payload.args`,
 * discovery, dispatch va ket qua tra ve. Phan STREAM (RemoteStreamMuxServer) CHUA lam.
 */
export class TypertGatewayService extends Service {
  /** Cache claim, xoa moi khi co service dang ky (event internal/service). */
  private srcClaims: Set<string> | undefined;

  /**
   * Dang ky service `typertGateway` roi intercept tien to /api tren seam connection.
   * @param ctx - context cua plugin.
   */
  constructor(ctx: Context) {
    super(ctx, "typertGateway");
    // Event noi bo cua cordis khong nam trong kieu EventsService cua goi nay: goi qua khuon ham on() hep.
    (ctx as unknown as { on(event: string, listener: () => void): void }).on("internal/service", () => {
      this.srcClaims = undefined;
    });
    ctx.inject(["connection"] as never, (connectionCtx: Context) => {
      const connection = connectionCtx.get("connection" as never) as
        | { rpc: { intercept(channel: string, matches: (endpoint: string) => boolean, handler: unknown): unknown } }
        | undefined;
      connection?.rpc.intercept(
        "/api",
        (endpoint: string) => this.claimsEndpoint(endpoint),
        async (endpoint: string, payload: unknown) => this.dispatchRpc(endpoint, payload),
      );
    });
  }

  /**
   * Endpoint nay co thuoc gateway khong (dua tren claim da quet).
   * @param endpoint - endpoint canonical.
   * @returns true khi co remote phoi endpoint do.
   */
  claimsEndpoint(endpoint: string): boolean {
    return this.claims().has(endpoint);
  }

  /**
   * Quet moi service dang ky co binding `typertRemote` de lay tap endpoint claim.
   * @returns tap endpoint (da cache, xoa khi co service moi).
   */
  claims(): Set<string> {
    this.srcClaims ??= this.collectClaims();
    return this.srcClaims;
  }

  /**
   * Duyet reflect.props cua kernel, loc service, doc binding tren object GOC roi liet ke endpoint.
   * @returns tap endpoint ma cac remote phoi ra.
   */
  collectClaims(): Set<string> {
    const out = new Set<string>();
    const props = (this.ctx as unknown as { reflect?: { props?: Record<string, { type?: string }> } }).reflect?.props ?? {};
    for (const [serviceKey, definition] of Object.entries(props)) {
      if (definition.type !== "service") continue;
      const receiver = (this.ctx as unknown as { get(key: string): unknown }).get(serviceKey);
      if (typeof receiver !== "object" || receiver === null) continue;
      const original = originalOf(receiver);
      const binding = Reflect.get(original, "typertRemote") as TypertRemoteBinding | undefined;
      if (binding === undefined || typeof Reflect.get(binding, "namespace") !== "string") continue;
      const namespace = Reflect.get(binding, "namespace") as string;
      for (const marker of remoteMethods(original) as readonly RemoteMethodMarker[]) {
        out.add(endpointOf(namespace, marker.exportName ?? marker.method));
      }
    }
    return out;
  }

  /**
   * Dieu phoi mot lan goi: kiem payload, tim binding, goi method, tra ket qua.
   * @param endpoint - endpoint canonical.
   * @param payload - payload da duoc seam connection boc.
   * @returns ket qua hay loi cho seam connection.
   */
  async dispatchRpc(endpoint: string, payload: unknown): Promise<DispatchResult> {
    const args = readArgs(payload);
    if (args === undefined) return { ok: false, error: { code: "gateway/internal", message: ARGS_MESSAGE } };
    const target = this.findBinding(endpoint);
    if (target === undefined) {
      return { ok: false, error: { code: "gateway/invocation-unavailable", message: UNAVAILABLE_MESSAGE } };
    }
    try {
      const value = await (target.handler as (args: Record<string, unknown>) => unknown).call(target.receiver, args);
      return { ok: true, value };
    } catch (error) {
      const failure = error as { code?: unknown; message?: unknown };
      return {
        ok: false,
        error: {
          code: typeof failure.code === "string" ? failure.code : "internal",
          message: typeof failure.message === "string" ? failure.message : String(error),
        },
      };
    }
  }

  /**
   * Tim receiver + method phoi endpoint (quet lai nhu luc claim).
   * @param endpoint - endpoint canonical.
   * @returns receiver, handler va namespace, hoac undefined.
   */
  findBinding(endpoint: string): { receiver: object; handler: unknown } | undefined {
    const props = (this.ctx as unknown as { reflect?: { props?: Record<string, { type?: string }> } }).reflect?.props ?? {};
    for (const [serviceKey, definition] of Object.entries(props)) {
      if (definition.type !== "service") continue;
      const receiver = (this.ctx as unknown as { get(key: string): unknown }).get(serviceKey);
      if (typeof receiver !== "object" || receiver === null) continue;
      const original = originalOf(receiver);
      const binding = Reflect.get(original, "typertRemote") as TypertRemoteBinding | undefined;
      if (binding === undefined || typeof Reflect.get(binding, "namespace") !== "string") {
        continue;
      }
      const namespace = Reflect.get(binding, "namespace") as string;
      for (const marker of remoteMethods(original) as readonly RemoteMethodMarker[]) {
        if (endpointOf(namespace, marker.exportName ?? marker.method) !== endpoint) continue;
        const handler = Reflect.get(original, marker.method);
        if (typeof handler === "function") return { receiver: original, handler };
      }
    }
    // Binding thieu namespace la loi ro rang chu khong phai im lang (gateway/binding-invalid).
    for (const [serviceKey, definition] of Object.entries(props)) {
      if (definition.type !== "service") continue;
      const receiver = (this.ctx as unknown as { get(key: string): unknown }).get(serviceKey);
      if (typeof receiver !== "object" || receiver === null) continue;
      const original = originalOf(receiver);
      if (Reflect.get(original, "typertRemote") !== undefined) continue;
      if (endpoint.startsWith(serviceKey + "/")) {
        throw new TypertGatewayError(
          "gateway/binding-invalid",
          endpoint,
          "Service " + JSON.stringify(serviceKey) + " has no visible typertRemote binding",
        );
      }
    }
    return undefined;
  }
}

export default TypertGatewayService;
