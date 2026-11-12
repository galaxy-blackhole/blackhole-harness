/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Provider tìm kiếm web DeepSeek: gọi Messages API tương thích Anthropic với server-tool `web_search_20250305`, map kết quả thành nguồn có snippet. Port 1:1 lib/index.js của @deepseek-ai/dsh-web-search-deepseek (341 dòng); seam khai HẸP cục bộ (luật repo: không import tĩnh @deepseek-ai/*).
 */
import z from "@deepseek-ai/schemastery";

/** Mã lỗi web (giữ nguyên chuỗi của bản gốc). */
export type WebErrorCode = "WEB_PROVIDER_ERROR" | "WEB_PROVIDER_CREDENTIAL_MISSING" | "WEB_ABORTED";
/** Lỗi của seam web — hình dạng HẸP cục bộ (bản gốc `@deepseek-ai/dsh-web`). */
export class WebError extends Error {
  /** Mã lỗi. */
  readonly code: WebErrorCode;
  /**
   * Dựng lỗi.
   * Nhận: câu thông báo · mã · tuỳ chọn `{ cause }`.
   * Trả: instance.
   */
  constructor(message: string, code: WebErrorCode, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "WebError";
    this.code = code;
  }
}

/** Id provider ổn định. */
export const DEEPSEEK_PROVIDER_ID = "deepseek-official";
/** Endpoint tìm kiếm phụ mặc định (kèm `/v1`; `/messages` được nối thêm). */
export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic/v1";
/** Model Anthropic mặc định. */
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-flash";
/** Giá trị header `anthropic-version` mặc định. */
export const DEEPSEEK_DEFAULT_API_VERSION = "2023-06-01";
/** Trần token sinh cho request Messages. */
export const DEEPSEEK_DEFAULT_MAX_TOKENS = 4096;
/** Số lần dùng server-tool `web_search` tối đa mỗi request. */
export const DEEPSEEK_DEFAULT_MAX_USES = 5;
/** Header attribution gửi mỗi request. */
const USER_AGENT = "deepseek-harness/0.0.1";
/** Namespace cài đặt của provider. */
// 09/11/2026 - chu du an doi ten row/namespace sang web-search-gbh (khuon giong session-log);
// hang so giu ten cu de khong pha import, GIA TRI la namespace MOI.
export const WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE = "web-search-gbh";
/** Biến môi trường endpoint tìm kiếm phụ. */
const SEARCH_BASE_URL_ENV = "DEEPSEEK_SEARCH_BASE_URL";
/** Route provider của tài khoản DeepSeek. */
const ACCOUNT_PROVIDER = "deepseek-account";

/** Cấu hình đã chuẩn hoá của một lần tìm (mọi giá trị đã mặc định). */
export interface SearchOptions {
  apiKey?: string;
  apiKeyEnv?: string;
  resolveAccountToken?: (endpoint: string) => Promise<string | undefined>;
  resolveApiKey?: () => Promise<string | undefined>;
  baseURL: string;
  model: string;
  apiVersion: string;
  maxTokens: number;
  maxUses: number;
  recordRequest?: (request: { endpoint: string; apiVersion: string; body: unknown }) => void;
}
/** Yêu cầu tìm kiếm từ seam web. */
export interface SearchRequest { query: string; }
/** Nguồn kết quả đã chuẩn hoá. */
export interface SearchSource { url: string; title?: string; snippet?: string; publishedAt?: string; }
/** Kết quả tìm kiếm đã chuẩn hoá. */
export interface SearchResult { sources: SearchSource[]; truncated: boolean; }

/** Một khối nội dung của response Messages (hình dạng HẸP). */
interface ContentBlock {
  type: string;
  text?: string;
  url?: string;
  title?: string;
  page_age?: string;
  cited_text?: string;
  citations?: { url?: string; cited_text?: string }[];
  content?: { type: string; url: string; title?: string; page_age?: string }[];
}
/** Response Messages (hình dạng HẸP). */
interface MessagesResponse { content?: ContentBlock[]; }

/**
 * Dựng map `url → cited_text` từ `citations[]` của mọi khối `text`.
 * Nhận: các khối nội dung.
 * Trả: Map url → snippet (rỗng khi không có citation).
 */
function citationSnippets(blocks: ContentBlock[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of blocks) {
    if (block.type !== "text") continue;
    for (const cite of block.citations ?? []) {
      if (cite.url != null && cite.url.length > 0 && cite.cited_text != null && cite.cited_text.length > 0 && !map.has(cite.url)) map.set(cite.url, cite.cited_text);
    }
  }
  return map;
}

/**
 * Map response Messages sang kết quả tìm kiếm chuẩn hoá: dedupe theo url, ghép snippet từ citation.
 * Nhận: body response đã parse.
 * Trả: SearchResult (truncated luôn false — seam web cắt maxResults).
 */
export function mapAnthropicResponse(response: MessagesResponse): SearchResult {
  const blocks = response.content ?? [];
  const resultBlocks = blocks.filter((block) => block.type === "web_search_tool_result");
  if (resultBlocks.length === 0) throw new WebError("DeepSeek returned no web_search_tool_result blocks; the request may not have triggered native web search", "WEB_PROVIDER_ERROR");
  const snippets = citationSnippets(blocks);
  const seen = new Set<string>();
  const sources: SearchSource[] = [];
  for (const block of resultBlocks) {
    for (const item of block.content ?? []) {
      if (item.type !== "web_search_result" || item.url.length === 0 || seen.has(item.url)) continue;
      seen.add(item.url);
      const snippet = snippets.get(item.url);
      sources.push({
        url: item.url,
        ...(item.title != null && item.title.length > 0 ? { title: item.title } : {}),
        ...(snippet != null && snippet.length > 0 ? { snippet } : {}),
        ...(item.page_age != null && item.page_age.length > 0 ? { publishedAt: item.page_age } : {}),
      });
    }
  }
  return { sources, truncated: false };
}

/** True cho giới hạn request DeepSeek hợp lệ. */
function isPositiveInteger(value: number): boolean { return Number.isInteger(value) && value > 0; }
/** True cho lỗi abort của fetch/AbortSignal. */
function isAbortError(error: unknown): boolean { return error instanceof DOMException && error.name === "AbortError"; }
/**
 * Lỗi huỷ ổn định của provider (giữ lý do của bên gọi).
 * Nhận: signal · lỗi dự phòng.
 * Trả: WebError WEB_ABORTED.
 */
function searchAborted(signal?: AbortSignal, fallback?: unknown): WebError { return new WebError("DeepSeek search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback }); }
/** Ném lỗi huỷ khi bên gọi đã abort. */
function throwIfSearchAborted(signal?: AbortSignal): void { if (signal?.aborted === true) throw searchAborted(signal); }
/**
 * Đua một preflight async với huỷ của bên gọi; handler giữ quan sát để không thành unhandled rejection.
 * Nhận: promise · signal.
 * Trả: giá trị của promise.
 */
function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return operation;
  if (signal.aborted) return Promise.reject(searchAborted(signal));
  return new Promise<T>((resolveValue, reject) => {
    const onAbort = (): void => { reject(searchAborted(signal)); };
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolveValue(value); },
      (error: unknown) => { signal.removeEventListener("abort", onAbort); reject(new Error(String(error).replace(/^Error: /u, ""), { cause: error })); },
    );
  });
}

/**
 * Chạy một resolver credential dưới signal của lần tìm.
 * Nhận: resolver · signal.
 * Trả: credential hoặc undefined.
 */
async function resolveCredential(resolve: () => Promise<string | undefined>, signal?: AbortSignal): Promise<string | undefined> {
  throwIfSearchAborted(signal);
  try { return await abortable(resolve(), signal); }
  catch (error) {
    if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
    throw new WebError("DeepSeek search credential resolution failed: " + String(error), "WEB_PROVIDER_ERROR", { cause: error });
  }
}

/** Đổi hướng dẫn endpoint sang đăng nhập khi DeepSeek từ chối token tài khoản. */
function accountRejectedError(message: string): WebError {
  return new WebError(message + "\n\nDeepSeek rejected the account sign-in used for this web search. Guide the user to sign in to DeepSeek again; the search endpoint does not need changing.", "WEB_PROVIDER_ERROR");
}
/** Thêm hướng dẫn khôi phục endpoint cho lỗi xảy ra SAU khi bắt đầu dispatch. */
function searchEndpointError(endpoint: string, message: string, cause?: unknown): WebError {
  return new WebError(message + "\n\nThe web search request used endpoint " + JSON.stringify(endpoint) + ". Search endpoint configuration is separate from chat. If that endpoint is not intended, guide the user to Settings > Plugins > Plugin configuration > Web search, where they can change and save Endpoint. If that settings page is unavailable, the user can set DEEPSEEK_SEARCH_BASE_URL or configure web-search-deepseek.baseURL to a trusted Anthropic-compatible Messages API base. Only the user should choose or change the endpoint.", "WEB_PROVIDER_ERROR", cause === undefined ? undefined : { cause });
}

/** Provider tìm kiếm dùng DeepSeek (redirect HTTP hỏng ⇒ WEB_PROVIDER_ERROR). */
export class DeepSeekSearchProvider {
  /** Id provider. */
  readonly id = DEEPSEEK_PROVIDER_ID;
  /**
   * Dựng provider.
   * Nhận: hàm trả options cho lần tìm KẾ TIẾP (snapshot tại lúc vào mỗi thao tác).
   * Trả: instance.
   */
  constructor(private readonly resolveOptions: () => SearchOptions) {}
  /**
   * Provider có sẵn sàng không (có nguồn credential + baseURL/limits hợp lệ).
   * Nhận: không.
   * Trả: true/false.
   */
  available(): boolean {
    const options = this.resolveOptions();
    return ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== undefined || options.resolveAccountToken !== undefined) && URL.canParse(options.baseURL) && isPositiveInteger(options.maxTokens) && isPositiveInteger(options.maxUses);
  }
  /**
   * Chạy MỘT lần tìm.
   * Nhận: yêu cầu (query) · signal.
   * Trả: SearchResult đã chuẩn hoá.
   */
  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult> {
    const options = this.resolveOptions();
    const endpoint = options.baseURL + "/messages";
    const auth = await this.authHeaders(options, endpoint, signal);
    throwIfSearchAborted(signal);
    const body = {
      model: options.model,
      max_tokens: options.maxTokens,
      messages: [{ role: "user", content: [{ type: "text", text: "Perform a web search for the query: " + request.query }] }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: options.maxUses }],
    };
    options.recordRequest?.({ endpoint, apiVersion: options.apiVersion, body });
    throwIfSearchAborted(signal);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        headers: { ...auth.headers, "anthropic-version": options.apiVersion, "content-type": "application/json", accept: "application/json", "user-agent": USER_AGENT },
        body: JSON.stringify(body),
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch (error) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
      throw searchEndpointError(endpoint, "DeepSeek search request failed: " + String(error), error);
    }
    if (!response.ok) {
      const status = response.status;
      let message = "DeepSeek API error (HTTP " + String(status) + ")";
      try {
        const parsed = (await response.json()) as { error?: string | { message?: string }; message?: string };
        const detail = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message;
        if (detail !== undefined && detail.length > 0) message += ": " + detail;
      } catch (error) {
        if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
      }
      if (status === 401 && auth.kind === "account") throw accountRejectedError(message);
      throw searchEndpointError(endpoint, message);
    }
    try { return mapAnthropicResponse((await response.json()) as MessagesResponse); }
    catch (error) {
      if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
      throw searchEndpointError(endpoint, error instanceof WebError ? error.message : "DeepSeek returned an unprocessable response body: " + String(error), error);
    }
  }
  /**
   * Giải header xác thực của MỘT thao tác (không giữ credential trên provider).
   * Nhận: options snapshot · endpoint · signal.
   * Trả: header tài khoản khi có token, ngược lại header API key (kèm kind).
   */
  private async authHeaders(options: SearchOptions, endpoint: string, signal?: AbortSignal): Promise<{ kind: "account" | "api-key"; headers: Record<string, string> }> {
    const { resolveAccountToken } = options;
    const token = resolveAccountToken === undefined ? undefined : await resolveCredential(() => resolveAccountToken(endpoint), signal);
    if (token !== undefined && token.length > 0) return { kind: "account", headers: { "x-dsh-auth-token": token } };
    const apiKey = await this.apiKey(options, signal);
    return { kind: "api-key", headers: { "x-api-key": apiKey, authorization: "Bearer " + apiKey } };
  }
  /**
   * Giải API key của MỘT thao tác (không giữ lại trên provider).
   * Nhận: options snapshot · signal.
   * Trả: API key đã giải.
   */
  private async apiKey(options: SearchOptions, signal?: AbortSignal): Promise<string> {
    throwIfSearchAborted(signal);
    if (options.apiKey !== undefined && options.apiKey.length > 0) return options.apiKey;
    const { resolveApiKey } = options;
    const resolved = resolveApiKey === undefined ? undefined : await resolveCredential(resolveApiKey, signal);
    if (resolved !== undefined && resolved.length > 0) return resolved;
    throw new WebError("DeepSeek search has no API key for \"" + (options.apiKeyEnv ?? "DEEPSEEK_API_KEY") + "\"; store it through the credentials service (the web Models page writes it), export it in the launching environment, or set a literal \"apiKey\" in the web-search-deepseek config; a conversation using a DeepSeek Account model searches with the account sign-in instead", "WEB_PROVIDER_CREDENTIAL_MISSING");
  }
}

/** Cấu hình người dùng (bản gốc là schemastery section có `.get()` từng trường). */
export interface WebSearchDeepSeekConfig {
  apiKey?: string;
  apiKeyEnv: string;
  baseURL?: string;
  model: string;
  apiVersion: string;
  maxTokens: number;
  maxUses: number;
}
/**
 * Mô tả trường cấu hình — PHẢI là schema Schemastery như bản gốc DSH.
 * Nhận: không. Trả: schema `z.object` để kernel gọi `Config.validate(...)` khi resolve config.
 * 08/11/2026 (P0 "web-search-deepseek did not activate"): bản port từng khai Config bằng OBJECT THUẦN
 *   (`{ apiKey: { type: "string", … } }`) ⇒ cordis gọi `Config.validate` ⇒ TypeError
 *   "Cannot read properties of undefined (reading 'validate')" ⇒ plugin không activate.
 *   Nay dựng đúng khuôn stock: apps/host/node_modules/@deepseek-ai/dsh-web-search-deepseek/lib/index.js:276.
 */
export const Config = z.object({
  apiKey: z.string().role("secret").volatile(),
  apiKeyEnv: z.string().role("credential-ref").default("DEEPSEEK_API_KEY").volatile(),
  baseURL: z.string().volatile(),
  model: z.string().default(DEEPSEEK_DEFAULT_MODEL).volatile(),
  apiVersion: z.string().default(DEEPSEEK_DEFAULT_API_VERSION).volatile(),
  maxTokens: z.number().step(1).min(1).default(DEEPSEEK_DEFAULT_MAX_TOKENS).volatile(),
  maxUses: z.number().step(1).min(1).default(DEEPSEEK_DEFAULT_MAX_USES).volatile(),
});

/** Hình dạng HẸP của ctx plugin (chỉ phần provider đọc). */
export interface WebSearchDeepSeekCtx {
  web: { registerSearchProvider(provider: DeepSeekSearchProvider): void };
  get(name: string): unknown;
}

/**
 * Chiếu một section đã resolve sang options cho lần tìm kế tiếp (mọi giá trị đã mặc định).
 * Nhận: ctx · cấu hình hiện hành.
 * Trả: SearchOptions.
 */
export function resolveOptions(ctx: WebSearchDeepSeekCtx, config: WebSearchDeepSeekConfig): SearchOptions {
  const apiKeyEnv = config.apiKeyEnv;
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0 ? config.apiKey : undefined;
  const environment = ctx.get("launchEnvironment") as { get(name: string): { value: string } | undefined } | undefined;
  return {
    ...(literalApiKey === undefined ? {} : { apiKey: literalApiKey }),
    resolveAccountToken: async (endpoint: string) => {
      const agents = ctx.get("agents") as { currentInitiator(): { session: { requestContext(): { provider?: string } | undefined; append(kind: string, payload: unknown): void } } | undefined } | undefined;
      if (agents?.currentInitiator()?.session.requestContext()?.provider !== ACCOUNT_PROVIDER) return undefined;
      const account = ctx.get("deepseekAccount") as { resolveToken(endpoint: string): Promise<string | undefined> } | undefined;
      return await account?.resolveToken(endpoint);
    },
    resolveApiKey: async () => {
      const credentials = ctx.get("credentials") as { resolve(ref: string): Promise<{ value: string } | undefined> } | undefined;
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value;
      const ambient = environment?.get(apiKeyEnv);
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined;
    },
    apiKeyEnv,
    baseURL: config.baseURL ?? environment?.get(SEARCH_BASE_URL_ENV)?.value ?? DEEPSEEK_DEFAULT_BASE_URL,
    model: config.model,
    apiVersion: config.apiVersion,
    maxTokens: config.maxTokens,
    maxUses: config.maxUses,
    recordRequest: (request) => {
      const agents = ctx.get("agents") as { currentInitiator(): { session: { append(kind: string, payload: unknown): void } } | undefined } | undefined;
      agents?.currentInitiator()?.session.append("web/deepseek-search-llm-request", request);
    },
  };
}

/** Tên plugin cho chẩn đoán của loader. */
export const name = "web-search-gbh";
/** Seam web mà provider đăng ký vào. */
export const inject = ["web"];

/**
 * Đăng ký provider tìm kiếm DeepSeek với `ctx.web`.
 * Nhận: ctx · hàm trả cấu hình hiện hành (snapshot mỗi lần tìm).
 * Trả: không.
 */
export function apply(ctx: WebSearchDeepSeekCtx, config: () => WebSearchDeepSeekConfig): void {
  ctx.web.registerSearchProvider(new DeepSeekSearchProvider(() => resolveOptions(ctx, config())));
}
