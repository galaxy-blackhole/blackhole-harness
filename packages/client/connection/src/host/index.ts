/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Nửa HOST của row connection: service connection, hàng rào /api, phiên trình duyệt và Config
 *      11/11/2026: kiểu phản hồi node của tuyến /api nhận thân BYTE (multipart mang ảnh/tệp).
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

import { API_PATH, CONNECT_PATH, DEFAULT_MAX_REQUEST_BODY_BYTES, PLUGIN_NAME, RECOVERY_GLOBAL } from "../ids.ts";
import { resolveConnectionConfig } from "../recovery-config.ts";
import { RpcId, transportError } from "../rpc-id.ts";
import { BrowserAuth, type CredentialsLike } from "./browser-auth.ts";
import { bridgeNodeRequest, HostConnectionService, Peer } from "./rpc-host.ts";
import { clientRequestSchema, rpcErrorSchema, rpcIdSchema, rpcMessageSchema, rpcResultSchema, serverResponseSchema } from "./rpc-schema.ts";
import { assertTrustedAuthority } from "./trust.ts";

export { API_PATH, CONNECT_PATH } from "../ids.ts";
export { RpcId, transportError } from "../rpc-id.ts";
export { HostConnectionService, Peer, type PeerOptions, type PeerPrincipal } from "./rpc-host.ts";
export { clientRequestSchema, rpcErrorSchema, rpcIdSchema, rpcMessageSchema, rpcResultSchema, serverResponseSchema } from "./rpc-schema.ts";

/** Headroom cho các trường JSON bao quanh payload ảnh base64. */
const REQUEST_ENVELOPE_HEADROOM_BYTES = 1024 * 1024;

/** Giá trị lớn nhất của một bộ đếm thời gian. */
const MAX_TIMER_MS = 2147483647;

/**
 * Bảo đảm ngưỡng thân yêu cầu đủ chỗ cho hạn mức ảnh đã cấu hình.
 * @param ctx - context có thể có service attachments.
 * @param maxRequestBodyBytes - ngưỡng đang cấu hình.
 * @throws Error khi ngưỡng nhỏ hơn mức cần cho hạn mức ảnh.
 */
function assertImageBodyCapacity(ctx: Context, maxRequestBodyBytes: number): void {
  const attachments = ctx.get("attachments") as { imageLimits?: { maxMessageImageBytes?: number } } | undefined;
  const imageBytes = attachments?.imageLimits?.maxMessageImageBytes;
  if (typeof imageBytes !== "number") return;
  const required = Math.ceil((imageBytes * 4) / 3) + REQUEST_ENVELOPE_HEADROOM_BYTES;
  if (maxRequestBodyBytes < required) {
    throw new Error("client-connection maxRequestBodyBytes (" + String(maxRequestBodyBytes) + ") must be at least " + String(required) + " for the configured aggregate image limit");
  }
}

/** Tên plugin cordis ổn định. */
export const name = PLUGIN_NAME;

/** Service cần có trước khi cung cấp Connection. */
export const inject: string[] = ["credentials"];

/** Cấu hình của plugin: nhịp phục hồi, authority tin cậy, tuổi thọ cookie, ngưỡng thân yêu cầu. */
export interface ConnectionConfig {
  /** Nhịp phục hồi của trình duyệt, được tiêm vào mỗi trang phục vụ. */
  recovery?: Record<string, unknown>;
  /** Authority ngoài loopback mà deployment phục vụ (host:port, hoặc host không port khớp mọi port). */
  trustedHosts?: string[];
  /** Tuổi thọ cookie tính bằng ngày. Mặc định 30. */
  cookieMaxAgeDays?: number;
  /** Ngưỡng thân JSON đệm cho mỗi yêu cầu /api. Mặc định 300 MiB. */
  maxRequestBodyBytes?: number;
}

/** Nhịp phục hồi dùng chung cho cả hai nửa (Host cấu hình, trang đọc lại qua biến toàn cục). */
const recoverySchema = z.object({
  backoffBaseMs: z.natural().min(1).max(MAX_TIMER_MS).default(500),
  backoffFactor: z.number().min(1).default(2),
  backoffMaxMs: z.natural().min(1).max(MAX_TIMER_MS).default(10000),
  generationReadyWarnMs: z.natural().min(1).max(MAX_TIMER_MS).default(3000),
  generationReadyTimeoutMs: z.natural().min(1).max(MAX_TIMER_MS).default(15000),
});

/** Schema cấu hình, giữ schemastery để config-editor của kernel render được trường (C7). */
export const Config: unknown = z.object({
  recovery: recoverySchema.default({}),
  trustedHosts: z.array(String).default([]),
  cookieMaxAgeDays: z.natural().min(1).default(30),
  maxRequestBodyBytes: z.natural().min(1).default(DEFAULT_MAX_REQUEST_BODY_BYTES),
});

/**
 * Cung cấp sổ đăng ký RPC và Fetch trung lập với giao vận. Khi `webServer` có mặt, plugin còn mount giao vận
 * `/api` cho trình duyệt (kèm phép kiểm Host/Origin và phiên bền) và tuyến `/connect`.
 * @param ctx - context của plugin Host.
 * @param config - cấu hình đã áp mặc định.
 * @returns promise hoàn tất khi đã đăng ký xong.
 */
export async function apply(ctx: Context, config?: ConnectionConfig): Promise<void> {
  const recovery = resolveConnectionConfig(config?.recovery);
  const trustedHosts = config?.trustedHosts ?? [];
  const cookieMaxAgeDays = config?.cookieMaxAgeDays ?? 30;
  const maxRequestBodyBytes = config?.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES;
  for (const entry of trustedHosts) assertTrustedAuthority(entry);
  assertImageBodyCapacity(ctx, maxRequestBodyBytes);
  const credentials = ctx.get("credentials") as CredentialsLike | undefined;
  if (credentials === undefined) throw new Error("client-connection: service credentials chua san sang");
  const connection = new HostConnectionService(ctx, trustedHosts, await BrowserAuth.create(ctx.root, credentials, cookieMaxAgeDays));
  const handler = connection.createSharedFetchHandler(API_PATH);
  ctx.inject(["webServer"] as never, (webCtx: Context) => {
    assertImageBodyCapacity(webCtx, maxRequestBodyBytes);
    /* Tiêm nhịp phục hồi vào trang: webserver gom bảng này rồi in thành biến toàn cục trong index.html. */
    (webCtx as unknown as { on(event: string, listener: (table: Array<Record<string, unknown>>) => void): void }).on("webserver/index-inject", (table) => {
      table.push({ kind: "global", name: RECOVERY_GLOBAL, value: recovery });
    });
    const webServer = webCtx.get("webServer") as { register(route: unknown): () => void } | undefined;
    if (webServer === undefined) return;
    webCtx.effect(() => webServer.register({
      kind: "prefix",
      path: API_PATH,
      handler: async (req: unknown, res: unknown) => {
        const admission = connection.admit(req as never);
        const nodeRes = res as { writeHead(status: number, headers?: Record<string, string>): void; end(body?: string | Uint8Array): void };
        if ("rejection" in admission) {
          nodeRes.writeHead(admission.rejection);
          nodeRes.end(admission.rejection === 401 ? "unauthorized" : "forbidden");
          return;
        }
        try {
          await bridgeNodeRequest(req as never, res as never, handler, admission.peer, maxRequestBodyBytes);
        } catch (error) {
          /* Không nuốt lỗi: một cầu RPC hỏng phải đọc được từ log của host, không phải đoán qua 400/0B. */
          console.error("[connection] /api bridge failed:", error);
          nodeRes.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
          nodeRes.end("handler failure: " + (error instanceof Error ? error.message : String(error)));
        }
      },
    }), "client-connection: /api route");
    webCtx.effect(() => webServer.register({
      kind: "exact",
      path: CONNECT_PATH,
      handler: (req: unknown, res: unknown) => {
        connection.authorizeConnect(req as never, res as never);
      },
    }), "client-connection: /connect route");
  });
  ctx.inject(["attachments"] as never, (attachmentCtx: Context) => {
    assertImageBodyCapacity(attachmentCtx, maxRequestBodyBytes);
  });
}

/** Giữ RpcId và transportError trong bề mặt host đúng như bản gốc. */
export const __surface = { RpcId, transportError };
