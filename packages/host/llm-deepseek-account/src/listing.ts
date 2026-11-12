/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Danh sách model của TÀI KHOẢN DeepSeek: một request có xác thực tới `GET /models` và phép giải
 *      mã từng mục (requirement theo sản phẩm, capabilities của Messages, modalities, trần ngữ cảnh).
 *      Bản viết lại của Galaxy Blackhole cho row llm-deepseek-account
 *      (@deepseek-ai/dsh-llm-deepseek-account) — nguồn đối chiếu: README.md của package (G4).
 */

import { APP_IDENTITY, LlmError, attributionHeaders } from "@deepseek-ai/dsh-llm";
import type { ModelModality } from "@deepseek-ai/dsh-llm";
import { timeoutOf } from "@deepseek-ai/dsh-timeout";

/** Các modality ĐẦU VÀO mà bản build này gửi được, theo thứ tự khai báo. */
const LISTED_MODALITIES: readonly ModelModality[] = ["text", "image"];

/** Mã lý do hết hạn của deadline danh sách; {@link requestModelListing} báo nó thành `TIMEOUT`. */
export const LISTING_TIMEOUT = "MODEL_LISTING_TIMEOUT";

/** Yêu cầu client mà MỘT mục danh sách khai dưới token sản phẩm của bản build này. */
export type ClientRequirement =
  | { readonly kind: "none" }
  | { readonly kind: "min-version"; readonly version: string }
  | { readonly kind: "invalid" };

/** Năng lực một mục danh sách DÙNG ĐƯỢC khai, theo từ vựng catalog. */
export interface ListedFacts {
  /** Modality đầu vào được nhận mà bản build này gửi được. */
  readonly inputModalities: readonly ModelModality[];
  /** Ngữ cảnh cộng dồn của request và phản hồi, khi có khai. */
  readonly contextWindow?: number;
  /** Năng lực đầu ra, khi có khai. */
  readonly maxOutputTokens?: number;
  /** Chế độ system prompt của Messages, khi có khai; giá trị khác `in-history` đọc thành `leading-only`. */
  readonly systemPromptUpdate?: "in-history" | "leading-only";
}

/** Năng lực đã khai, hoặc lý do transport Messages không lái được model đó. */
export type ListedCapabilities =
  | { readonly usable: true; readonly facts: ListedFacts }
  | { readonly usable: false; readonly reason: string };

/** Một mục danh sách đã giải mã; năng lực không dùng được KHÔNG che id, tên hay requirement của nó. */
export interface ListingEntry {
  /** Id model trên dây. */
  readonly id: string;
  /** Tên hiển thị, khi mục khai một tên không rỗng. */
  readonly name?: string;
  /** Requirement khai dưới `client_requirements[APP_IDENTITY.product]`. */
  readonly requirement: ClientRequirement;
  /** Năng lực đã khai. */
  readonly capabilities: ListedCapabilities;
}

/** Một danh sách đã giải mã, có ít nhất một mục. */
export interface ModelListing {
  /** Các mục theo thứ tự danh sách. */
  readonly entries: readonly ListingEntry[];
  /** Số dòng không có id dùng được, và số id lặp. */
  readonly skipped: number;
}

/**
 * Đọc một giá trị như object thường (không mảng, không null).
 * Nhận: giá trị bất kỳ từ thân phản hồi.
 * Trả: object dạng từ điển, hoặc `undefined` khi không phải object thường.
 */
function fieldsOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Lọc modalities đã khai về những modality bản build này gửi được, GIỮ thứ tự danh sách.
 * Nhận: giá trị `input_modalities`/`output_modalities` thô.
 * Trả: mảng modality không lặp, hoặc `undefined` khi giá trị không phải mảng.
 */
function knownModalities(value: unknown): ModelModality[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const listed = value as readonly ModelModality[];
  return LISTED_MODALITIES.filter((modality) => listed.includes(modality)).toSorted(
    (left, right) => listed.indexOf(left) - listed.indexOf(right),
  );
}

/**
 * Đọc một trần dung lượng đã khai.
 * Nhận: giá trị `context_window`/`max_output_tokens` thô.
 * Trả: `undefined` khi vắng, `false` khi không phải số nguyên an toàn dương.
 */
function capacity(value: unknown): number | false | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : false;
}

/**
 * Đọc requirement client của một mục dưới token sản phẩm của bản build này.
 * Nhận: một mục danh sách đã đọc thành từ điển.
 * Trả: requirement đã đóng (`none` · `min-version` · `invalid`).
 */
function requirementOf(entry: Record<string, unknown>): ClientRequirement {
  if (entry.client_requirements === undefined) return { kind: "none" };
  const requirements = fieldsOf(entry.client_requirements);
  if (requirements === undefined) return { kind: "invalid" };
  const declared = requirements[APP_IDENTITY.product];
  if (declared === undefined) return { kind: "none" };
  const own = fieldsOf(declared);
  if (own === undefined) return { kind: "invalid" };
  if (own.min_version === undefined) return { kind: "none" };
  return typeof own.min_version === "string" && own.min_version.length > 0
    ? { kind: "min-version", version: own.min_version }
    : { kind: "invalid" };
}

/**
 * Đọc năng lực của một mục xem transport Messages có lái được model đó không.
 * Nhận: một mục danh sách đã đọc thành từ điển.
 * Trả: `usable: true` kèm sự thật catalog, hoặc `usable: false` kèm lý do nguyên văn của bản gốc.
 */
function capabilitiesOf(entry: Record<string, unknown>): ListedCapabilities {
  const messages = fieldsOf(fieldsOf(entry.api_capabilities)?.anthropic_messages);
  if (messages === undefined) {
    return { usable: false, reason: "declares no api_capabilities.anthropic_messages" };
  }
  const defaults: ModelModality[] = ["text"];
  const outputs = entry.output_modalities === undefined ? defaults : knownModalities(entry.output_modalities);
  if (outputs?.includes("text") !== true) return { usable: false, reason: "declares no text output" };
  const inputs = entry.input_modalities === undefined ? defaults : knownModalities(entry.input_modalities);
  if (inputs === undefined || inputs.length === 0) {
    return { usable: false, reason: "declares no input modality Galaxy Blackhole supports" };
  }
  const contextWindow = capacity(entry.context_window);
  const maxOutputTokens = capacity(entry.max_output_tokens);
  if (contextWindow === false || maxOutputTokens === false) {
    return { usable: false, reason: "declares an invalid context_window or max_output_tokens" };
  }
  const update = messages.system_prompt_update;
  return {
    usable: true,
    facts: {
      inputModalities: inputs,
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
      ...(update === undefined ? {} : { systemPromptUpdate: update === "in-history" ? "in-history" : "leading-only" }),
    },
  };
}

/**
 * Giải mã thân `/models` theo TỪNG mục.
 * Nhận: thân phản hồi đã parse JSON.
 * Trả: các mục có id dùng được, theo thứ tự danh sách, kèm số dòng bị bỏ.
 * Ném: `LlmError` mã `INVALID_RESPONSE` khi thân không có mảng `data` hoặc không có mục nào dùng được.
 */
export function parseModelListing(body: unknown): ModelListing {
  const data = fieldsOf(body)?.data;
  if (!Array.isArray(data)) throw new LlmError('DeepSeek model listing has no "data" array', "INVALID_RESPONSE");
  const rows = data as readonly unknown[];
  const entries: ListingEntry[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const entry = fieldsOf(row);
    const id = entry?.id;
    if (entry === undefined || typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      ...(typeof entry.name === "string" && entry.name.length > 0 ? { name: entry.name } : {}),
      requirement: requirementOf(entry),
      capabilities: capabilitiesOf(entry),
    });
  }
  if (entries.length === 0) throw new LlmError("DeepSeek model listing contains no model entry", "INVALID_RESPONSE");
  return { entries, skipped: rows.length - entries.length };
}

/**
 * Xin và giải mã MỘT danh sách model. Chuyển hướng bị TỪ CHỐI, để credential không rời origin đã xin.
 * Nhận: endpoint danh sách, header xác thực cho endpoint đó, và tín hiệu huỷ/hạn chót của cả lượt.
 * Trả: danh sách đã giải mã.
 * Ném: `LlmError` mã `TIMEOUT` khi deadline {@link LISTING_TIMEOUT} hết trước thân đầy đủ,
 *   `ABORTED` khi bị huỷ vì lý do khác, `TRANSPORT` khi mạng hỏng, `HTTP_<status>` khi phản hồi
 *   không 2xx, và `INVALID_RESPONSE` khi thân không phải JSON danh sách.
 */
export async function requestModelListing(
  url: string,
  headers: Readonly<Record<string, string>>,
  signal: AbortSignal,
): Promise<ModelListing> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal,
      headers: {
        ...attributionHeaders(),
        accept: "application/json",
        ...headers,
      },
    });
    text = await response.text();
  } catch (error) {
    const expired = timeoutOf(signal, LISTING_TIMEOUT);
    if (expired !== undefined) {
      throw new LlmError(
        `DeepSeek model listing request to ${url} timed out after ${expired.timeoutMs} ms`,
        "TIMEOUT",
        { cause: error },
      );
    }
    throw signal.aborted
      ? new LlmError(`DeepSeek model listing request to ${url} was aborted`, "ABORTED", { cause: error })
      : new LlmError(`could not reach ${url}`, "TRANSPORT", { cause: error });
  }
  if (!response.ok) {
    throw new LlmError(`${url} answered HTTP ${response.status}`, `HTTP_${response.status}`, {
      status: response.status,
    });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new LlmError(`${url} did not answer with JSON`, "INVALID_RESPONSE", { cause: error });
  }
  return parseModelListing(body);
}
