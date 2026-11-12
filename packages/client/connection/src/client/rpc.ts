/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bên gọi RPC phía trình duyệt: tự sở hữu tương quan yêu cầu và kiểm phong bì phản hồi
 */

import { API_PATH } from "../ids.ts";
import { RpcId } from "../rpc-id.ts";
import { parseBinaryResponse, parseConnectionResponse, type RpcResult } from "./api.ts";

/** Hàm fetch dùng để gửi (tiêm được cho test và cho vỏ tự dựng giao vận). */
export type RpcFetch = (input: string, init: RequestInit) => Promise<Response>;

/** Mở một luồng endpoint trên giao vận do vỏ cung cấp (worker tunnel). */
export type RpcStreamOpen = (endpoint: string, payload: unknown, signal: AbortSignal, uplink?: AsyncIterable<unknown>) => AsyncIterable<unknown>;

/** Bên gọi RPC chung mà service connection phơi ra. */
export interface ClientConnectionRpc {
  /** Gọi một endpoint, trả kết quả đã kiểm. */
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<RpcResult<unknown>>;
  /** Mở một luồng endpoint (chỉ khi giao vận có hỗ trợ). */
  open?(channel: string, endpoint: string, payload: unknown, signal: AbortSignal, uplink?: AsyncIterable<unknown>): AsyncIterable<unknown>;
}

/** Đoạn channel hợp lệ: một dấu / rồi các ký tự an toàn. */
const CHANNEL_PATTERN = /^\/[A-Za-z0-9._~-]+$/u;

/** Đoạn endpoint hợp lệ. */
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/u;

/** Sinh id tương quan ngẫu nhiên, dùng crypto của trình duyệt khi có. */
function randomUuid(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string; getRandomValues?: (array: Uint8Array) => Uint8Array } | undefined;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") cryptoApi.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Kiểm channel và endpoint trước khi gửi: sai thì ném ngay, không để lộ đường dẫn lạ lên dây.
 * @param channel - channel tuyệt đối.
 * @param endpoint - endpoint trong channel.
 * @throws Error khi channel hoặc endpoint sai hình dạng.
 */
function assertTarget(channel: string, endpoint: string): void {
  const segments = endpoint.split("/");
  const bad = segments.some((segment) => segment === "" || segment === "." || segment === ".." || !ENDPOINT_SEGMENT_PATTERN.test(segment));
  if (!CHANNEL_PATTERN.test(channel) || bad) {
    throw new Error("connection: invalid RPC target " + JSON.stringify(channel + "/" + endpoint));
  }
}

/**
 * Tạo bên gọi RPC dựa trên fetch của trang.
 * @param doFetch - giao vận thay thế; mặc định là fetch toàn cục.
 * @param openStream - giao vận luồng cục bộ của worker (tuỳ chọn).
 * @returns bên gọi tự sở hữu tương quan và kiểm phong bì.
 */
export function createWebConnectionRpc(doFetch?: RpcFetch, openStream?: RpcStreamOpen): ClientConnectionRpc {
  const send = doFetch ?? ((input: string, init: RequestInit) => globalThis.fetch(input, init));
  const caller: ClientConnectionRpc = {
    async call(channel, endpoint, payload, signal) {
      assertTarget(channel, endpoint);
      const rpcId = RpcId(randomUuid());
      const message = { type: "client-request", rpcId, method: endpoint, payload };
      const response = await send((channel + "/" + endpoint).slice(1), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message),
        ...(signal === undefined ? {} : { signal }),
      });
      if (!response.ok) throw new Error("transport failure for " + channel + "/" + endpoint + ": HTTP " + String(response.status));
      const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();
      const full = contentType === "multipart/form-data" ? await parseBinaryResponse(response) : parseConnectionResponse(await response.json());
      signal?.throwIfAborted();
      if (full.rpcId !== rpcId) throw new Error("rpcId mismatch for " + endpoint + ": sent " + rpcId + ", got " + full.rpcId);
      return full.result;
    },
  };
  if (openStream !== undefined) {
    caller.open = (channel, endpoint, payload, signal, uplink) => {
      assertTarget(channel, endpoint);
      if (channel !== API_PATH) throw new Error("connection: worker-local streams require the /api channel, got " + JSON.stringify(channel));
      return openStream(endpoint, payload, signal, uplink);
    };
  }
  return caller;
}
