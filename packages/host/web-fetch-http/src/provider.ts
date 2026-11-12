/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc HttpFetchProvider — tải HTTP(S) an toàn cho ctx.web: ghim IP công cộng, chỉ theo redirect cùng origin,
 *      áp trần thời gian/kích thước, phân loại và giải mã văn bản (1:1 từ bundle gốc DSH)
 */

import { WebError } from "@deepseek-ai/dsh-web";
import type { WebFetchProvider, WebFetchRequest, WebFetchResult } from "@deepseek-ai/dsh-web";
import { deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import { proxyRouteFor } from "@deepseek-ai/dsh-http-proxy";
import { LOCAL_FETCH_PROVIDER_ID } from "./ids.ts";
import { isNonPublicIpLiteral, publicHttpNetwork, type NetworkOperations, type ResolvedAddress } from "./network.ts";
import { classifyContentType, decoderForCharset, isSameOrigin, parseCharset, validateFetchUrl } from "./policy.ts";

/** Giới hạn vận chuyển + phản hồi đã phân giải. */
export interface WebFetchLimits {
  /** Trần byte thân phản hồi. */
  maxResponseBytes: number;
  /** Trần ký tự thân đã giải mã. */
  maxBodyChars: number;
  /** Hạn chót cho CẢ lượt tải. */
  timeoutMs: number;
  /** Số hop redirect tối đa (0 = không theo). */
  maxRedirects: number;
  /** User-Agent gửi đi. */
  userAgent: string;
}

/** Kết quả một lượt gọi vận chuyển. */
interface Transport {
  /** Response HTTP. */
  response: Response;
  /** Giải phóng tài nguyên. */
  close: () => Promise<void>;
}

/** Provider tải HTTP(S) công cộng ẩn danh, đăng ký vào sổ fetch của seam ctx.web. */
export class HttpFetchProvider implements WebFetchProvider {
  /** Id ổn định của provider. */
  readonly id = LOCAL_FETCH_PROVIDER_ID;
  /** Giới hạn đã phân giải. */
  private readonly limits: WebFetchLimits;
  /** Hàm phân giải địa chỉ (mặc định bộ thao tác mạng thật). */
  private readonly resolveAddresses: (hostname: string, signal: AbortSignal) => Promise<ResolvedAddress[]>;
  /** Bộ thao tác mạng (cho test thay). */
  private readonly network: NetworkOperations;

  /**
   * Dựng provider.
   * @param limits giới hạn vận chuyển + phản hồi.
   * @param resolveAddresses hàm phân giải từ chối đích không công cộng (mặc định: publicHttpNetwork.resolve).
   * @param network bộ thao tác mạng (mặc định publicHttpNetwork; test dùng seam này vì Bun tích hợp sẵn
   *   module tên "undici" KHÔNG có Agent.close, nên transport undici thật không chạy được DƯỚI bun test).
   */
  constructor(
    limits: WebFetchLimits,
    resolveAddresses: (hostname: string, signal: AbortSignal) => Promise<ResolvedAddress[]> = publicHttpNetwork.resolve,
    network: NetworkOperations = publicHttpNetwork,
  ) {
    this.limits = limits;
    this.resolveAddresses = (hostname, signal) => resolveAddresses(hostname, signal);
    this.network = network;
  }

  /** Không có thông tin đăng nhập để kiểm — fetcher công cộng ẩn danh luôn dùng được. */
  available(): boolean {
    return true;
  }

  /**
   * Tải một URL.
   * @param request yêu cầu (url).
   * @param signal huỷ của người gọi.
   * @returns kết quả đã chuẩn hoá.
   */
  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    if (signal?.aborted) throw new WebError("web fetch aborted", "WEB_ABORTED");
    const d = deadline(signal, this.limits.timeoutMs, "WEB_FETCH_TIMEOUT");
    try {
      return await this.followAndRead(request.url, d.signal);
    } finally {
      d[Symbol.dispose]();
    }
  }

  /** Theo redirect cùng origin tới trần hop, rồi đọc phản hồi cuối. */
  private async followAndRead(initialUrl: string, signal: AbortSignal): Promise<WebFetchResult> {
    let currentUrl = validateFetchUrl(initialUrl);
    let redirectsFollowed = 0;
    for (;;) {
      const request = await this.requestOnce(currentUrl, signal);
      const { response } = request;
      try {
        if (isRedirectStatus(response.status)) {
          if (redirectsFollowed >= this.limits.maxRedirects) {
            await response.body?.cancel();
            throw new WebError("exceeded the maximum of " + String(this.limits.maxRedirects) + " redirects", "WEB_REDIRECT_BLOCKED");
          }
          const location = response.headers.get("location");
          if (location === null) {
            await response.body?.cancel();
            throw new WebError("redirect response (HTTP " + String(response.status) + ") without a Location header", "WEB_PROVIDER_ERROR");
          }
          const target = resolveRedirect(location, currentUrl);
          let validatedTarget: URL;
          try {
            validatedTarget = validateFetchUrl(target.toString());
            if (!isSameOrigin(validatedTarget, currentUrl)) {
              throw new WebError(
                "cross-origin redirect to " + validatedTarget.origin + " is not followed automatically; retry against that URL directly",
                "WEB_REDIRECT_BLOCKED",
              );
            }
          } catch (error) {
            await response.body?.cancel();
            throw error;
          }
          await response.body?.cancel();
          currentUrl = validatedTarget;
          redirectsFollowed += 1;
          continue;
        }
        return await this.readBody(response, currentUrl, signal);
      } finally {
        await request.close();
      }
    }
  }

  /** Một lượt yêu cầu: tuyến proxy hoặc ghim địa chỉ công cộng. */
  private async requestOnce(url: URL, signal: AbortSignal): Promise<Transport> {
    const headers = {
      "user-agent": this.limits.userAgent,
      accept: "text/html,application/xhtml+xml,text/*;q=0.9,application/json;q=0.8",
    };
    try {
      const route = proxyRouteFor(url) as { proxied: boolean; dispatcher: unknown };
      if (route.proxied && !isNonPublicIpLiteral(url.hostname)) {
        return await this.network.requestVia(route.dispatcher, url, headers, signal);
      }
      const addresses = await this.resolveAddresses(url.hostname, signal);
      return await this.network.request(url, addresses, headers, signal);
    } catch (error) {
      if (error instanceof WebError) throw error;
      throw translateAbortOrNetwork(error, signal);
    }
  }

  /** Đọc, cắt theo trần byte, phân loại và giải mã thân phản hồi cuối. */
  private async readBody(response: Response, finalUrl: URL, signal: AbortSignal): Promise<WebFetchResult> {
    const contentType = response.headers.get("content-type");
    const kind = classifyContentType(contentType);
    if (kind === undefined) {
      await response.body?.cancel();
      throw new WebError("unsupported content type " + JSON.stringify(contentType ?? "unknown"), "WEB_UNSUPPORTED_CONTENT_TYPE");
    }
    let decoder: TextDecoder;
    try {
      decoder = decoderForCharset(parseCharset(contentType));
    } catch (error) {
      await response.body?.cancel();
      throw error;
    }
    const { bytes, truncatedByBytes } = await this.readCapped(response, signal);
    const decoded = decoder.decode(bytes);
    const truncatedByChars = decoded.length > this.limits.maxBodyChars;
    const content = truncatedByChars ? decoded.slice(0, this.limits.maxBodyChars) : decoded;
    const body = kind === "html" ? { kind: "html" as const, content } : { kind: "text" as const, content };
    return { url: finalUrl.toString(), statusCode: response.status, body, truncated: truncatedByBytes || truncatedByChars };
  }

  /** Đọc luồng tới trần maxResponseBytes; Content-Length vượt trần ⇒ WEB_FETCH_TOO_LARGE, luồng vượt ⇒ cắt. */
  private async readCapped(response: Response, signal: AbortSignal): Promise<{ bytes: Uint8Array; truncatedByBytes: boolean }> {
    const declared = response.headers.get("content-length");
    if (declared !== null) {
      const length = Number(declared);
      if (Number.isFinite(length) && length > this.limits.maxResponseBytes) {
        await response.body?.cancel();
        throw new WebError("response exceeds the maximum of " + String(this.limits.maxResponseBytes) + " bytes", "WEB_FETCH_TOO_LARGE");
      }
    }
    if (response.body === null) return { bytes: new Uint8Array(0), truncatedByBytes: false };
    const chunks: Uint8Array[] = [];
    let total = 0;
    let truncatedByBytes = false;
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = this.limits.maxResponseBytes - total;
        if (value.byteLength > remaining) {
          chunks.push(value.subarray(0, remaining));
          total += remaining;
          truncatedByBytes = true;
          break;
        }
        chunks.push(value);
        total += value.byteLength;
      }
    } catch (error) {
      throw translateAbortOrNetwork(error, signal);
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, truncatedByBytes };
  }
}

/** Mã trạng thái redirect có Location. */
function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/** Phân giải Location (có thể tương đối) theo URL hiện tại. */
function resolveRedirect(location: string, base: URL): URL {
  try {
    return new URL(location, base);
  } catch (error) {
    throw new WebError("invalid redirect Location " + JSON.stringify(location), "WEB_PROVIDER_ERROR", { cause: error });
  }
}

/**
 * Dịch lỗi fetch/stream thành WebError, phân loại theo tín hiệu deadline (không theo giá trị ném):
 * timeout của TA ⇒ WEB_FETCH_TIMEOUT; abort khác ⇒ WEB_ABORTED; signal chưa abort ⇒ WEB_PROVIDER_ERROR.
 */
function translateAbortOrNetwork(error: unknown, signal: AbortSignal): WebError {
  const timeout = timeoutOf(signal, "WEB_FETCH_TIMEOUT");
  if (timeout !== undefined) return new WebError("web fetch timed out", "WEB_FETCH_TIMEOUT", { cause: timeout });
  if (signal.aborted) return new WebError("web fetch aborted", "WEB_ABORTED", { cause: error });
  return new WebError("web fetch failed: " + String(error), "WEB_PROVIDER_ERROR", { cause: error });
}
