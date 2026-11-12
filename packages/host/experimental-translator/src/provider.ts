/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dựng URL/headers/body cho endpoint dịch ẩn danh Google/Bing, đọc JSON có giới hạn byte, chuẩn hoá thẻ ngôn ngữ tiếng Trung và giữ nguyên ngữ nghĩa lỗi/huỷ (bản gốc: lib/types/provider.js).
 */
import { createHash } from "node:crypto";
import { deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import { assertNever } from "@deepseek-ai/dsh-util-values";
import { TranslationError } from "./error.ts";
import type { Config } from "./plugin.ts";
import type { AnonymousTranslationProvider, AnonymousTranslationSpec } from "./types.ts";

/** Một yêu cầu HTTP đã dựng cho endpoint ẩn danh. */
interface AnonymousRequest {
  /** URL đích đã gắn query của giao thức. */
  readonly url: URL;
  /** Tuỳ chọn fetch: POST thân form (Google) hoặc JSON (Bing). */
  readonly init: RequestInit;
}

/**
 * Nhận diện ngữ nghĩa yêu cầu ẩn danh mà KHÔNG chuẩn hoá ngôn ngữ theo nhà cung cấp.
 * Nhận: `provider` — tuyến endpoint đã phân giải; `config` — endpoint triển khai (giá trị thô không được lưu vào recipe).
 * Trả: chuỗi JSON gồm phiên bản giao thức và fingerprint SHA-256 của endpoint hiệu dụng, dùng cho việc tái dùng kết quả bền.
 * @throws TypeError khi endpoint cấu hình không phải URL hợp lệ.
 */
export function anonymousRecipe(provider: AnonymousTranslationProvider, config: Config): string {
  const url: URL = new URL(provider === "google" ? config.googleEndpoint : config.bingEndpoint);
  const owned: readonly string[] = provider === "google" ? ["client", "sl", "tl", "dt", "q"] : ["from", "to", "isEnterpriseClient"];
  for (const key of owned) url.searchParams.delete(key);
  return JSON.stringify([provider === "google" ? "google-form-v1" : "bing-edge-v1", createHash("sha256").update(url.href).digest("hex")]);
}

/**
 * Chuẩn hoá thẻ ngôn ngữ tiếng Trung theo từng endpoint.
 * Nhận: `tag` — thẻ do người dùng cung cấp; `provider` — endpoint đích.
 * Trả: thẻ đã chuẩn hoá (`zh-CN`/`zh-TW` cho Google, `zh-Hans`/`zh-Hant` cho Bing), hoặc `tag` nguyên vẹn.
 */
function language(tag: string, provider: AnonymousTranslationProvider): string {
  const lower: string = tag.toLowerCase();
  if (["zh", "zh-cn", "zh-sg", "zh-hans"].includes(lower)) return provider === "google" ? "zh-CN" : "zh-Hans";
  if (["zh-tw", "zh-hk", "zh-mo", "zh-hant"].includes(lower)) return provider === "google" ? "zh-TW" : "zh-Hant";
  return tag;
}

/**
 * Dựng URL và thân yêu cầu cho endpoint ẩn danh đã chọn.
 * Nhận: `spec` — văn bản và lựa chọn ngôn ngữ đã phân giải; `config` — endpoint triển khai.
 * Trả: URL đã gắn query cùng `RequestInit` POST (form cho Google, JSON cho Bing).
 * @throws TypeError khi endpoint cấu hình không phải URL hợp lệ.
 */
function requestFor(spec: AnonymousTranslationSpec, config: Config): AnonymousRequest {
  const source: string = language(spec.sourceLanguage, spec.provider);
  const target: string = language(spec.targetLanguage, spec.provider);
  switch (spec.provider) {
    case "google": {
      const url: URL = new URL(config.googleEndpoint);
      const form: URLSearchParams = new URLSearchParams({ client: "gtx", sl: source, tl: target, dt: "t", q: spec.text });
      for (const key of form.keys()) url.searchParams.delete(key);
      return { url, init: { method: "POST", body: form.toString(), headers: { "content-type": "application/x-www-form-urlencoded" } } };
    }
    case "bing": {
      const url: URL = new URL(config.bingEndpoint);
      if (source !== "auto") url.searchParams.set("from", source);
      else url.searchParams.delete("from");
      url.searchParams.set("to", target);
      url.searchParams.set("isEnterpriseClient", "false");
      return { url, init: { method: "POST", body: JSON.stringify([spec.text]), headers: { "content-type": "application/json" } } };
    }
    /* v8 ignore next -- TranslationProvider là hợp kiểu đóng; JSON/config validation chịu trách nhiệm thu nhận. */
    default:
      return assertNever(spec.provider);
  }
}

/**
 * Tạo lỗi phản hồi không hợp lệ cho một endpoint.
 * Nhận: `provider` — endpoint đã trả phản hồi.
 * Trả: `TranslationError` mã `TRANSLATION_INVALID_RESPONSE` với thông điệp tiếng Anh nguyên văn.
 */
function invalidResponse(provider: AnonymousTranslationProvider): TranslationError {
  return new TranslationError("TRANSLATION_INVALID_RESPONSE", `${provider} returned an invalid translation response`);
}

/**
 * Trích văn bản đã dịch từ payload JSON theo giao thức của endpoint.
 * Nhận: `payload` — JSON đã đọc; `provider` — endpoint đã trả payload.
 * Trả: văn bản đã dịch.
 * @throws TranslationError `TRANSLATION_INVALID_RESPONSE` khi payload lệch hình dạng.
 */
function translationOf(payload: unknown, provider: AnonymousTranslationProvider): string {
  if (!Array.isArray(payload)) throw invalidResponse(provider);
  const first: unknown = payload[0];
  switch (provider) {
    case "google": {
      if (!Array.isArray(first) || first.length === 0) throw invalidResponse(provider);
      const segments: unknown[] = first;
      return segments
        .map((segment: unknown): string => {
          if (!Array.isArray(segment)) throw invalidResponse(provider);
          const text: unknown = segment[0];
          if (typeof text !== "string") throw invalidResponse(provider);
          return text;
        })
        .join("");
    }
    case "bing": {
      if (typeof first !== "object" || first === null || !("translations" in first) || !Array.isArray(first.translations)) {
        throw invalidResponse(provider);
      }
      const translated: unknown = first.translations[0];
      if (typeof translated !== "object" || translated === null || !("text" in translated) || typeof translated.text !== "string") {
        throw invalidResponse(provider);
      }
      return translated.text;
    }
    /* v8 ignore next -- TranslationProvider là hợp kiểu đóng; JSON/config validation chịu trách nhiệm thu nhận. */
    default:
      return assertNever(provider);
  }
}

/**
 * Đọc thân phản hồi thành JSON, chặn vượt giới hạn byte.
 * Nhận: `response` — phản hồi HTTP; `config` — giới hạn byte; `provider` — endpoint.
 * Trả: payload JSON đục.
 * @throws TranslationError `TRANSLATION_INVALID_RESPONSE` khi thân rỗng/JSON hỏng, `TRANSLATION_RESPONSE_LIMIT` khi vượt `config.maxResponseBytes`.
 */
async function responseJson(response: Response, config: Config, provider: AnonymousTranslationProvider): Promise<unknown> {
  if (response.body === null) throw invalidResponse(provider);
  const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes: number = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > config.maxResponseBytes) {
        await reader.cancel();
        throw new TranslationError("TRANSLATION_RESPONSE_LIMIT", `${provider} translation response exceeds ${config.maxResponseBytes} bytes`);
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return payload;
  } catch (_error) {
    throw new TranslationError("TRANSLATION_INVALID_RESPONSE", `${provider} returned invalid translation JSON`);
  }
}

/**
 * Gửi MỘT yêu cầu có giới hạn, không cookie, không credential, không redirect, không fallback nhà cung cấp.
 * Nhận: `spec` — văn bản và lựa chọn ngôn ngữ đã phân giải; `config` — endpoint, deadline và giới hạn byte phản hồi; `signal` — huỷ của người gọi và vòng đời service.
 * Trả: văn bản đã dịch.
 * @throws TranslationError `TRANSLATION_TIMEOUT`/`TRANSLATION_HTTP_ERROR`/`TRANSLATION_INVALID_RESPONSE`/`TRANSLATION_RESPONSE_LIMIT`/`TRANSLATION_REQUEST_FAILED`; lý do huỷ của người gọi được giữ nguyên.
 */
export async function translateText(spec: AnonymousTranslationSpec, config: Config, signal: AbortSignal): Promise<string> {
  using timeout = deadline(signal, config.timeoutMs, "TRANSLATION_TIMEOUT");
  try {
    timeout.signal.throwIfAborted();
    if (spec.text === "") return "";
    const { url, init } = requestFor(spec, config);
    const response: Response = await fetch(url, { ...init, redirect: "error", credentials: "omit", signal: timeout.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new TranslationError("TRANSLATION_HTTP_ERROR", `${spec.provider} translation failed (HTTP ${response.status})`);
    }
    const payload: unknown = await responseJson(response, config, spec.provider);
    timeout.signal.throwIfAborted();
    return translationOf(payload, spec.provider);
  } catch (error) {
    const expired = timeoutOf(timeout.signal, "TRANSLATION_TIMEOUT");
    if (expired !== undefined && expired !== signal.reason) {
      throw new TranslationError("TRANSLATION_TIMEOUT", `${spec.provider} translation timed out after ${expired.timeoutMs}ms`);
    }
    timeout.signal.throwIfAborted();
    if (error instanceof TranslationError) throw error;
    throw new TranslationError("TRANSLATION_REQUEST_FAILED", `${spec.provider} translation request failed`);
  }
}
