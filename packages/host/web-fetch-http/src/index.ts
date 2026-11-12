/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt plugin của row web-fetch-http: schema Config + kiểm giới hạn + đăng ký provider "http" vào ctx.web
 *      (1:1 từ @deepseek-ai/dsh-web-fetch-http; gói gốc MỘT MẶT, không có lib/client.js)
 */

import z from "@deepseek-ai/schemastery";
import type { Context } from "@deepseek-ai/cordis";
import type { WebFetchProvider } from "@deepseek-ai/dsh-web";
import { DEFAULT_USER_AGENT, MAX_NODE_TIMER_DELAY_MS, inject, name } from "./ids.ts";
import { HttpFetchProvider, type WebFetchLimits } from "./provider.ts";

export { DEFAULT_USER_AGENT, LOCAL_FETCH_PROVIDER_ID, inject, name } from "./ids.ts";
export { HttpFetchProvider } from "./provider.ts";
export type { WebFetchLimits } from "./provider.ts";

/** Cấu hình của row — mọi trường tuỳ chọn, mặc định y bản gốc. */
export interface Config {
  /** Trần byte thân phản hồi (mặc định 5.000.000). */
  maxResponseBytes?: number;
  /** Trần ký tự thân đã giải mã (mặc định 100.000). */
  maxBodyChars?: number;
  /** Hạn chót cả lượt tải, ms (mặc định 30000). */
  timeoutMs?: number;
  /** Số hop redirect tối đa (mặc định 5). */
  maxRedirects?: number;
  /** User-Agent gửi đi (mặc định DEFAULT_USER_AGENT). */
  userAgent?: string;
}

/** Giá trị mặc định của cấu hình — y bản gốc. */
export const CONFIG_DEFAULTS: Required<Config> = Object.freeze({
  maxResponseBytes: 5e6,
  maxBodyChars: 1e5,
  timeoutMs: 3e4,
  maxRedirects: 5,
  userAgent: DEFAULT_USER_AGENT,
});

/** Schema cấu hình lúc chạy — mặc định y bản gốc. */
export const Config = z.object({
  maxResponseBytes: z.number().default(5e6),
  maxBodyChars: z.number().default(1e5),
  timeoutMs: z.number().default(3e4),
  maxRedirects: z.number().default(5),
  userAgent: z.string().default(DEFAULT_USER_AGENT),
}) as unknown as Config;

/** Một giới hạn tài nguyên phải là số hữu hạn dương. */
function assertPositiveFinite(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error("web-fetch-http: " + label + " must be a positive finite number");
}

/** Node co timer lớn hơn trần về 1ms ⇒ từ chối ngay ở config. */
function assertTimeoutMs(value: number): void {
  assertPositiveFinite("timeoutMs", value);
  if (value > MAX_NODE_TIMER_DELAY_MS) throw new Error("web-fetch-http: timeoutMs must be no greater than " + String(MAX_NODE_TIMER_DELAY_MS));
}

/** Trần hop redirect phải là số nguyên không âm. */
function assertNonNegativeInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) throw new Error("web-fetch-http: " + label + " must be a non-negative integer");
}

/**
 * Phân giải cấu hình: trường vắng ⇒ mặc định của schema (cùng giá trị loader cấp).
 * @param config cấu hình thô của người dùng.
 * @returns cấu hình đủ trường.
 */
export function resolveConfig(config: Config = {}): Required<Config> {
  return {
    maxResponseBytes: config.maxResponseBytes ?? CONFIG_DEFAULTS.maxResponseBytes,
    maxBodyChars: config.maxBodyChars ?? CONFIG_DEFAULTS.maxBodyChars,
    timeoutMs: config.timeoutMs ?? CONFIG_DEFAULTS.timeoutMs,
    maxRedirects: config.maxRedirects ?? CONFIG_DEFAULTS.maxRedirects,
    userAgent: config.userAgent ?? CONFIG_DEFAULTS.userAgent,
  };
}

/** Seam ctx.web mà row cần (một phần của cordis Context). */
type WebSeamContext = Context & { web: { registerFetchProvider(provider: WebFetchProvider): () => void } };

/**
 * Đăng ký provider fetch HTTP(S) công cộng vào ctx.web (KHÔNG sở hữu service webFetch).
 * @param ctx context cordis có seam ctx.web.
 * @param config cấu hình của row (tuỳ chọn).
 */
export function apply(ctx: Context, config: Config = {}): void {
  const resolved = resolveConfig(config);
  assertPositiveFinite("maxResponseBytes", resolved.maxResponseBytes);
  assertPositiveFinite("maxBodyChars", resolved.maxBodyChars);
  assertTimeoutMs(resolved.timeoutMs);
  assertNonNegativeInteger("maxRedirects", resolved.maxRedirects);
  const limits: WebFetchLimits = {
    maxResponseBytes: resolved.maxResponseBytes,
    maxBodyChars: resolved.maxBodyChars,
    timeoutMs: resolved.timeoutMs,
    maxRedirects: resolved.maxRedirects,
    userAgent: resolved.userAgent,
  };
  (ctx as WebSeamContext).web.registerFetchProvider(new HttpFetchProvider(limits));
}
