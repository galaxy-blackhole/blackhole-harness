/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng discovery của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 2206–2436 (nguồn
 *      per-file: lib/types/discovery.js): trả lời câu "provider này phục vụ được model nào" cho thao
 *      tác "fetch available models" của bề mặt cấu hình. Route mà catalog pi-ai đã cài có thì trả lời
 *      TỪ catalog, KHÔNG gọi mạng; chỉ route catalog không mô tả (gateway, server tự dựng) mới bị hỏi
 *      qua dây. Không đường nào là refresh catalog và không gì được lưu lại: request mang draft người
 *      dùng còn sửa, reply là metadata ứng viên cho bề mặt nhận nuôi.
 *      Export: discoverModels · StoredModelDiscoveryProfile.
 */

/**
 * Answering "which models can this provider serve?" for the configuration
 * surface's "fetch available models" action.
 *
 * A route the installed pi-ai catalog ships is answered **from that catalog**,
 * with no network call at all: pi-ai's registry is the authoritative list for
 * its own providers, and it carries the capacities a listing endpoint would
 * not disclose. Only a route the catalog does not describe — a gateway, a
 * self-hosted server — is interrogated over the wire.
 *
 * Neither path is a catalog refresh. Nothing here is stored: the request
 * carries a draft the user is still editing, and the reply is candidate
 * metadata the surface offers for adoption. `cordis.patch.yml` remains the only
 * thing that decides what a route serves.
 *
 * OpenAI-compatible and Anthropic Messages protocols are interrogated through
 * their native model-listing endpoints. The parser accepts the standard
 * `data` array and the enriched `models` map some compatible gateways expose.
 * Every other protocol reports that it cannot be interrogated so the surface
 * falls back to hand-entry rather than guessing its response fields.
 *
 * @module dsh-llm-pi-ai/discovery
 */

import type { LlmDiscoveredModel, LlmModelDiscoveryOperation } from "@deepseek-ai/dsh-llm";
import { INVALID_CREDENTIAL_CODE, LlmError, attributionHeaders, normalizeApiKey } from "@deepseek-ai/dsh-llm";
import { catalogModels } from "./catalog.ts";

/**
 * Protocols whose model listing this module can read. OpenAI protocols use
 * bearer auth at `GET {baseURL}/models`; Anthropic Messages uses `x-api-key`
 * and `anthropic-version` at its native `GET /v1/models`. Azure is absent
 * despite its OpenAI lineage — it authenticates with an `api-key` header and
 * requires an `api-version` query — and Codex authenticates through OAuth;
 * guessing at either would report an authentication failure as a provider
 * with no models. pi-ai's remaining protocols are absent for the same reason.
 */
const LISTABLE_PROTOCOLS = new Set([
  "anthropic-messages",
  "openai-completions",
  "openai-responses",
]);

/** Stable API version required by Anthropic's model-listing endpoint. */
const ANTHROPIC_VERSION = "2023-06-01";

/** Largest model-list page accepted by Anthropic's public endpoint; discovery reads one page and does not follow `has_more`. */
const ANTHROPIC_MODEL_LIMIT = 1e3;

/**
 * Endpoint replies larger than this are refused. The endpoint is whatever URL
 * the user typed, so the ceiling holds on the bytes actually read rather than
 * on the length the server claims — the same two-stage shape `dsh-web-fetch`
 * uses for its own caller-supplied URLs, except that a truncated model listing
 * is not parseable, so overflow rejects instead of truncating.
 */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/**
 * One raw entry of a model-listing reply. Every field stays `unknown` until
 * `capacity` or `label` judges it, because the reply comes from an endpoint the
 * user typed rather than from a schema this build controls.
 */
interface ListingEntry {
  /** Id the endpoint accepts, or the fallback of an empty map-entry key. */
  readonly id?: unknown;
  /** Human-readable name field. */
  readonly name?: unknown;
  /** Snake-case display name field. */
  readonly display_name?: unknown;
  /** Camel-case display name field. */
  readonly displayName?: unknown;
  /** Context capacity fields in every spelling a gateway may publish. */
  readonly contextWindow?: unknown;
  /** Context capacity, snake-case spelling. */
  readonly context_window?: unknown;
  /** Context capacity, OpenAI-compatible spelling. */
  readonly context_length?: unknown;
  /** Context capacity, Anthropic-compatible spelling. */
  readonly max_input_tokens?: unknown;
  /** Nested capacity block some gateways publish. */
  readonly limit?: {
    /** Context capacity inside the nested block. */
    readonly context?: unknown;
    /** Output capacity inside the nested block. */
    readonly output?: unknown;
  } | null;
  /** Output capacity fields in every spelling a gateway may publish. */
  readonly maxOutputTokens?: unknown;
  /** Output capacity, snake-case spelling. */
  readonly max_output_tokens?: unknown;
  /** Output capacity, camel-case spelling. */
  readonly maxTokens?: unknown;
  /** Output capacity, snake-case short spelling. */
  readonly max_tokens?: unknown;
  /** Nested provider block some gateways publish. */
  readonly top_provider?: {
    /** Output capacity inside the nested provider block. */
    readonly max_completion_tokens?: unknown;
  } | null;
}

/** One reply envelope: the standard `data` array or the enriched `models` map. */
interface ListingReply {
  /** Standard OpenAI-compatible model array. */
  readonly data?: unknown;
  /** Enriched gateway model map. */
  readonly models?: unknown;
}

/** A positive integer field of a listing entry, or `undefined` when absent or unusable. */
function capacity(...candidates: unknown[]): number | undefined {
  for (const candidate of candidates)
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0) return candidate;
}

/** A non-empty string field of a listing entry, or `undefined`. */
function label(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) if (typeof candidate === "string" && candidate.length > 0) return candidate;
}

/**
 * Join the endpoint base with the protocol's listing path. The base is
 * treated as a prefix rather than a URL to resolve against, so a deployment
 * path such as `https://gateway.example/openai/v1` keeps its segments instead
 * of losing them to `URL` resolution. OpenAI protocols list at
 * `{baseURL}/models`. Anthropic lists at `{root}/v1/models`, where the root is
 * the base without trailing slashes and without one trailing `/v1` segment:
 * gateway documentation publishes both spellings of the same root. Only this
 * listing URL normalizes that segment; model requests receive the configured
 * `baseURL` unchanged.
 * Nhận: baseURL — endpoint người dùng gõ; api — giao thức dây của route.
 * Trả: URL listing đã ghép đúng quy ước của giao thức.
 */
function listingUrl(baseURL: string, api: string): string {
  const base = baseURL.replace(/\/+$/, "");
  if (api !== "anthropic-messages") return `${base}/models`;
  return `${base.endsWith("/v1") ? base.slice(0, -3) : base}/v1/models?limit=${String(ANTHROPIC_MODEL_LIMIT)}`;
}

/**
 * Read a reply body, refusing one that outgrows the ceiling. A declared length
 * is checked first so an honest server is turned away without transferring
 * anything; the accumulated total is what actually enforces the bound, because
 * a server that under-declares (or streams) tells us nothing up front.
 * Nhận: response — reply đang mở; url — URL đã hỏi, dùng cho thông điệp lỗi.
 * Trả: toàn văn body đã giải mã; ném LlmError khi vượt trần byte.
 */
async function readBounded(response: Response, url: string): Promise<string> {
  const oversized = (): LlmError => new LlmError(`${url} answered with more than ${MAX_RESPONSE_BYTES} bytes`, "DISCOVERY_FAILED");
  const declared = Number(response.headers.get("content-length") ?? NaN);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw oversized();
  }
  /* v8 ignore next -- fetch always exposes a body stream on a 2xx Response; the null guard is defensive. */
  if (response.body === null) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw oversized();
      chunks.push(value);
    }
  } finally {
    /* v8 ignore next 4 -- cancel() after a completed or abandoned read settles without rejecting; unobserved best-effort cleanup. */
    await reader.cancel().catch(() => {});
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

/**
 * Read one supported model-listing reply. The standard `data` array takes
 * precedence when both supported formats are present. An enriched `models`
 * map uses each property key as the endpoint-facing id; its nested `id` is
 * only a fallback for an empty key because gateways may put a canonical model
 * identity there instead of the alias they accept on requests. Only
 * object-valued map entries are models; primitive properties are ignored
 * because they may be directory metadata rather than model records.
 *
 * Entries without a usable id are skipped rather than failing the whole
 * interrogation: a single malformed row should not deny the user the rest of
 * a working endpoint's catalog. Missing names fall back to the adopted id so
 * the Web form receives a complete human-readable row.
 * Nhận: body — reply đã parse JSON, chưa kiểm hình dạng.
 * Trả: các model đọc được, theo thứ tự endpoint; ném LlmError khi reply không có cả `data` lẫn `models`.
 */
function readListing(body: unknown): LlmDiscoveredModel[] {
  const listing = body as ListingReply | null | undefined;
  const data = listing?.data;
  let listed: readonly { readonly key?: string; readonly raw: unknown }[];
  if (Array.isArray(data)) listed = data.map((raw: unknown) => ({ raw }));
  else {
    const models = listing?.models;
    if (models === null || typeof models !== "object" || Array.isArray(models))
      throw new LlmError(
        "the endpoint's model listing has neither a \"data\" array nor a \"models\" object; enter this provider's models by hand",
        "DISCOVERY_FAILED",
      );
    listed = Object.entries(models as Record<string, unknown>)
      .filter(([, raw]) => raw !== null && typeof raw === "object" && !Array.isArray(raw))
      .map(([key, raw]) => ({ key, raw }));
  }
  const models: LlmDiscoveredModel[] = [];
  for (const { key, raw } of listed) {
    const entry = raw as ListingEntry | null | undefined;
    const id = label(key, entry?.id);
    if (id === void 0) continue;
    const name = label(entry?.name, entry?.display_name, entry?.displayName) ?? id;
    const contextWindow = capacity(
      entry?.contextWindow,
      entry?.context_window,
      entry?.context_length,
      entry?.max_input_tokens,
      entry?.limit?.context,
    );
    const maxTokens = capacity(
      entry?.maxOutputTokens,
      entry?.max_output_tokens,
      entry?.maxTokens,
      entry?.max_tokens,
      entry?.limit?.output,
      entry?.top_provider?.max_completion_tokens,
    );
    models.push({
      id,
      name,
      ...contextWindow === void 0 ? {} : { contextWindow },
      ...maxTokens === void 0 ? {} : { maxTokens },
    });
  }
  return models;
}

/**
 * Accept one probe key, or refuse it before the header is built. Without this
 * the `fetch` below would throw a ByteString `TypeError` that this function's
 * catch reports as `could not reach <url>` — blaming the network for a local,
 * deterministic fault.
 * @param raw - the key typed into the form or read from storage.
 * @returns the trimmed, usable key.
 * Nhận: raw — khoá người dùng gõ vào form hoặc đọc từ storage.
 * Trả: khoá đã cắt khoảng trắng và dùng được; ném LlmError(INVALID_CREDENTIAL) khi khoá rỗng hoặc có ký tự header không mang được.
 */
function usableProbeKey(raw: string): string {
  const checked = normalizeApiKey(raw);
  if (checked.ok) return checked.value;
  throw new LlmError(
    checked.reason === "empty"
      ? "this provider's API key is blank; enter it on the Models page, or clear it to probe unauthenticated"
      : "this provider's API key contains characters no HTTP header can carry; paste the raw key only",
    INVALID_CREDENTIAL_CODE,
  );
}

/** Host-owned profile inputs that a configuration draft deliberately omits. */
export interface StoredModelDiscoveryProfile {
  /** Deployment headers configured on the named route. */
  readonly headers: Readonly<Record<string, string>> | undefined;
  /** Resolve the named route's credential only when the draft carries none. */
  readonly resolveApiKey: () => Promise<string | undefined>;
}

/**
 * Interrogate one draft provider endpoint for the models it advertises.
 * Nhận: request — endpoint, giao thức và credential dùng-một-lần; storedProfile —
 *   header do Host sở hữu và hàm phân giải credential lười cho route đã đặt tên
 *   (chỉ đọc trên đường có ra mạng; credential chỉ phân giải khi draft không mang).
 * Trả: các model quảng cáo, theo thứ tự endpoint.
 * @throws LlmError khi giao thức không có listing đọc được, endpoint từ chối/hỏng
 *   request, hoặc reply không phải model listing.
 */
export async function discoverModels(
  request: LlmModelDiscoveryOperation,
  storedProfile?: () => StoredModelDiscoveryProfile | undefined,
): Promise<readonly LlmDiscoveredModel[]> {
  if (request.provider !== void 0) {
    const installed = catalogModels(request.provider);
    if (installed.size > 0)
      return [...installed.values()].map((model) => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
        inputModalities: [...model.input],
      }));
  }
  if (request.baseURL === void 0 || request.baseURL.length === 0)
    throw new LlmError(
      `pi-ai ships no catalog for provider "${request.provider ?? ""}", so its models can only come from its endpoint; set a baseURL, or enter this provider's models by hand`,
      "DISCOVERY_FAILED",
    );
  const api = request.api ?? "openai-completions";
  if (!LISTABLE_PROTOCOLS.has(api))
    throw new LlmError(
      `pi-ai protocol "${api}" has no model listing this build can read; enter this provider's models by hand`,
      "DISCOVERY_UNSUPPORTED",
    );
  const url = listingUrl(request.baseURL, api);
  const stored = storedProfile?.();
  const supplied = request.apiKey ?? await stored?.resolveApiKey();
  const apiKey = supplied === void 0 ? void 0 : usableProbeKey(supplied);
  let response: Response;
  try {
    const headers = new Headers(stored?.headers === void 0 ? void 0 : Object.entries(stored.headers));
    headers.set("accept", "application/json");
    if (api === "anthropic-messages") {
      headers.set("anthropic-version", ANTHROPIC_VERSION);
      if (apiKey !== void 0) headers.set("x-api-key", apiKey);
    } else if (apiKey !== void 0) headers.set("authorization", `Bearer ${apiKey}`);
    for (const [name, value] of Object.entries(attributionHeaders())) headers.set(name, value);
    response = await fetch(url, {
      method: "GET",
      headers,
      ...request.signal === void 0 ? {} : { signal: request.signal },
    });
  } catch (error) {
    if (request.signal?.aborted) throw new LlmError("model discovery aborted by caller", "ABORTED", { cause: error });
    throw new LlmError(`could not reach ${url}`, "DISCOVERY_FAILED", { cause: error });
  }
  if (!response.ok)
    throw new LlmError(
      `${url} answered ${response.status}${response.status === 401 || response.status === 403 ? "; check the API key" : ""}`,
      "DISCOVERY_FAILED",
    );
  let text: string;
  try {
    text = await readBounded(response, url);
  } catch (error) {
    if (request.signal?.aborted) throw new LlmError("model discovery aborted by caller", "ABORTED", { cause: error });
    throw error;
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new LlmError(`${url} did not answer with JSON`, "DISCOVERY_FAILED", { cause: error });
  }
  return readListing(body);
}
