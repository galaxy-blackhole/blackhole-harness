/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 25/10/2026
 * desc Provider tìm kiếm web qua Galaxy cloud (Ollama, `/api/web_search`) — hàng `auto` mà app patch chọn
 *      (`web.searchProvider: auto`). Trước đây app patch trỏ "auto" nhưng KHÔNG có provider nào đăng ký id đó,
 *      nên mọi lượt tìm kiếm trả 'configured web provider "auto" is not registered'.
 */
import z from "@deepseek-ai/schemastery";

import { WebError } from "@deepseek-ai/dsh-web";

/** Id provider — PHẢI trùng `web.searchProvider` trong app patch. */
export const OLLAMA_SEARCH_PROVIDER_ID = "auto";
/** Endpoint mặc định của Galaxy cloud (Ollama). */
export const OLLAMA_DEFAULT_BASE_URL = "https://ollama.com";
/** Biến môi trường chứa khoá Galaxy. */
export const OLLAMA_DEFAULT_API_KEY_ENV = "GBH_GALAXY_API_KEY";
/** Trần kết quả gửi kèm. */
const MAX_RESULTS = 8;

/** Cấu hình đã chuẩn hoá cho một lần tìm. */
export interface SearchOptions {
  baseURL: string;
  apiKey?: string;
  resolveApiKey: () => Promise<string | undefined>;
  /** Trần kết quả (đọc từ cấu hình `maxUses`, mặc định 8). */
  maxResults?: number;
  recordRequest?: (body: unknown) => void;
}

/** Một nguồn kết quả đã chuẩn hoá. */
export interface SearchSource { url: string; title?: string; snippet?: string; publishedAt?: string; }
/** Kết quả tìm kiếm đã chuẩn hoá. */
export interface SearchResult { sources: SearchSource[]; truncated: boolean; }

/** Item thô của response (nhiều biến thể tên trường). */
interface RawItem {
  url?: unknown; link?: unknown; title?: unknown; name?: unknown;
  content?: unknown; snippet?: unknown; description?: unknown; text?: unknown;
  published_at?: unknown; publishedAt?: unknown; date?: unknown;
}
/** Response thô: chấp nhận mảng trần hoặc object bọc nhiều khoá. */
type RawResponse = RawItem[] | { results?: RawItem[]; data?: RawItem[]; sources?: RawItem[]; web?: { results?: RawItem[] } };

/**
 * Lấy chuỗi đầu tiên không rỗng trong các khoá ứng viên.
 * Nhận: item · danh sách khoá.
 * Trả: chuỗi đã trim, hoặc undefined.
 */
function pick(item: RawItem, keys: readonly (keyof RawItem)[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

/**
 * Chọn mảng kết quả từ response thô.
 * Nhận: body đã parse.
 * Trả: mảng item (rỗng khi không nhận dạng được).
 */
export function itemsOf(body: RawResponse): RawItem[] {
  if (Array.isArray(body)) return body;
  for (const candidate of [body.results, body.data, body.sources, body.web?.results]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

/**
 * Map response của Galaxy cloud sang kết quả chuẩn hoá: bỏ item không có URL, dedupe theo URL.
 * Nhận: body đã parse · trần số kết quả.
 * Trả: SearchResult.
 */
export function mapOllamaResponse(body: RawResponse, maxResults = MAX_RESULTS): SearchResult {
  const seen = new Set<string>();
  const sources: SearchSource[] = [];
  for (const item of itemsOf(body)) {
    const url = pick(item, ["url", "link"]);
    if (url === undefined || seen.has(url)) continue;
    seen.add(url);
    const title = pick(item, ["title", "name"]);
    const snippet = pick(item, ["content", "snippet", "description", "text"]);
    const publishedAt = pick(item, ["published_at", "publishedAt", "date"]);
    sources.push({
      url,
      ...(title === undefined ? {} : { title }),
      ...(snippet === undefined ? {} : { snippet }),
      ...(publishedAt === undefined ? {} : { publishedAt }),
    });
    if (sources.length >= maxResults) break;
  }
  return { sources, truncated: sources.length >= maxResults };
}

/**
 * Provider tìm kiếm web qua Galaxy cloud.
 * Nhận: hàm trả options cho lần tìm KẾ TIẾP.
 * Trả: instance dùng được với `ctx.web.registerSearchProvider`.
 */
export class OllamaSearchProvider {
  /** Id provider (trùng `web.searchProvider`). */
  readonly id = OLLAMA_SEARCH_PROVIDER_ID;
  constructor(private readonly resolveOptions: () => SearchOptions) {}

  /**
   * Đọc options và CHUẨN HOÁ điểm cuối: chuỗi rỗng/toàn khoảng trắng nghĩa là "chưa đặt" ⇒ mặc định Galaxy cloud.
   * Nhận: không. Trả: options với baseURL luôn là một URL dùng được.
   */
  private options(): SearchOptions {
    const raw = this.resolveOptions();
    const dat = raw.baseURL?.trim();
    return { ...raw, baseURL: dat !== undefined && dat !== "" ? dat : OLLAMA_DEFAULT_BASE_URL };
  }

  /**
   * Provider có sẵn sàng không: có baseURL hợp lệ và có đường lấy khoá.
   * Nhận: không. Trả: true/false.
   */
  available(): boolean {
    const options = this.options();
    return URL.canParse(options.baseURL) && ((options.apiKey?.length ?? 0) > 0 || options.resolveApiKey !== undefined);
  }

  /**
   * Chạy MỘT lượt tìm.
   * Nhận: request (query) · signal.
   * Trả: SearchResult đã chuẩn hoá.
   * @throws WebError khi thiếu khoá, HTTP lỗi, hoặc body không phải JSON hợp lệ.
   */
  async search(request: { query: string }, signal?: AbortSignal): Promise<SearchResult> {
    const options = this.options();
    const key = options.apiKey ?? (await options.resolveApiKey());
    if (key === undefined || key.length === 0) throw new WebError("Galaxy cloud search: chưa có khoá GBH_GALAXY_API_KEY", "WEB_PROVIDER_UNAVAILABLE");
    const endpoint = options.baseURL.replace(/\/+$/, "") + "/api/web_search";
    const body = { query: request.query, max_results: options.maxResults ?? MAX_RESULTS };
    options.recordRequest?.(body);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key, "user-agent": "galaxy-blackhole/0.1.0" },
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new WebError("Galaxy cloud search HTTP " + String(response.status) + (detail === "" ? "" : ": " + detail.slice(0, 200)), "WEB_PROVIDER_HTTP_ERROR");
    }
    let parsed: RawResponse;
    try {
      parsed = (await response.json()) as RawResponse;
    } catch (error) {
      throw new WebError("Galaxy cloud search: body không phải JSON — " + String(error), "WEB_PROVIDER_BAD_RESPONSE");
    }
    return mapOllamaResponse(parsed);
  }
}

/** Tên plugin cho chẩn đoán của loader. */
export const name = "web-search-ollama";
/** Seam web mà provider đăng ký vào. */
export const inject = ["web"];

/** Hình dạng HẸP của ctx (chỉ phần provider đọc). */
export interface OllamaSearchCtx {
  web: { registerSearchProvider(provider: OllamaSearchProvider): void };
  get(name: string): unknown;
}

/** Cấu hình người dùng (đều tuỳ chọn). */
export interface OllamaSearchConfig {
  baseURL?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  maxUses?: number;
}

/**
 * Schema cấu hình — HOST đọc để dựng form "Web search" trên trang Plugin
 * (client stock mở mục này khi namespace `web-search-deepseek` có form được phục vụ).
 * Nhận: không. Trả: schema với mặc định của Galaxy cloud.
 */
export const Config = z.object({
  apiKey: z.string().role("secret").volatile(),
  apiKeyEnv: z.string().role("credential-ref").default(OLLAMA_DEFAULT_API_KEY_ENV).volatile(),
  baseURL: z.string().default(OLLAMA_DEFAULT_BASE_URL).volatile(),
  maxUses: z.number().step(1).min(1).default(MAX_RESULTS).volatile(),
});

/**
 * Đăng ký provider `auto` với seam web.
 * Nhận: ctx · hàm trả cấu hình hiện hành.
 * Trả: không.
 */
export function apply(ctx: OllamaSearchCtx, raw: (() => OllamaSearchConfig) | OllamaSearchConfig | undefined): void {
  // 26/10/2026: loader của Host truyền CONFIG TĨNH (đã áp default theo schema) chứ không phải getter
  // ⇒ nhận cả hai dạng, tránh "config is not a function" ở lượt tìm đầu tiên.
  const config = typeof raw === "function" ? raw : (): OllamaSearchConfig => raw ?? {};
  const resolveOptions = (): SearchOptions => {
    const current = config();
    const apiKeyEnv = current.apiKeyEnv ?? OLLAMA_DEFAULT_API_KEY_ENV;
    const environment = ctx.get("launchEnvironment") as { get(name: string): { value: string } | undefined } | undefined;
    const literal = current.apiKey !== undefined && current.apiKey.length > 0 ? current.apiKey : undefined;
    // 26/10/2026 (câu hỏi của chủ dự án: "xoá Điểm cuối thì sao?"): form gửi chuỗi RỖNG chứ không phải undefined,
    // nên `??` không bắt được ⇒ endpoint thành "/api/web_search" và provider tự coi là KHÔNG dùng được. Nay chuỗi
    // rỗng/toàn khoảng trắng được coi là "chưa đặt" ⇒ rơi về biến môi trường rồi mới tới mặc định Galaxy cloud,
    // đúng như gợi ý "Để trống để dùng mặc định của nhà cung cấp."
    const dat = current.baseURL?.trim();
    const tuMoiTruong = environment?.get("GBH_GALAXY_BASE_URL")?.value?.trim();
    const baseURL = dat !== undefined && dat !== ""
      ? dat
      : tuMoiTruong !== undefined && tuMoiTruong !== "" ? tuMoiTruong : OLLAMA_DEFAULT_BASE_URL;
    return {
      baseURL,
      ...(literal === undefined ? {} : { apiKey: literal }),
      resolveApiKey: async () => {
        const credentials = ctx.get("credentials") as { resolve(ref: string): Promise<{ value: string } | undefined> } | undefined;
        if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value;
        const ambient = environment?.get(apiKeyEnv);
        return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined;
      },
      maxResults: current.maxUses ?? MAX_RESULTS,
      recordRequest: (body) => {
        const agents = ctx.get("agents") as { currentInitiator(): { session: { append(kind: string, payload: unknown): void } } | undefined } | undefined;
        agents?.currentInitiator()?.session.append("web/gbh-search-request", body);
      },
    };
  };
  ctx.web.registerSearchProvider(new OllamaSearchProvider(resolveOptions));
}
