/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Định nghĩa service của seam truy cập web (`ctx.web`): sổ đăng ký provider và lượt thi hành
 *      CÓ CHỌN provider cho search và fetch. Id trùng bị từ chối. Lúc thi hành, provider đã cấu hình phải
 *      tồn tại và dùng được; không cấu hình thì phải có ĐÚNG MỘT provider dùng được — nên phép chọn
 *      KHÔNG BAO GIỜ phụ thuộc thứ tự đăng ký.
 *      Bản viết lại của Galaxy Blackhole cho row `web` (@deepseek-ai/dsh-web) — nguồn đối chiếu: README.md (G4).
 */

import type { Context } from "@deepseek-ai/cordis";
import { Service } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { capSources, resolveProvider } from "./selection.ts";
import { WebError } from "./types.ts";
import type {
  WebFetchProvider,
  WebFetchRequest,
  WebFetchResult,
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
} from "./types.ts";

export { WebError };
export type {
  WebFetchBody,
  WebFetchProvider,
  WebFetchRequest,
  WebFetchResult,
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from "./types.ts";

/**
 * Cấu hình của seam web. `searchProvider` / `fetchProvider` GHIM provider nào thắng cho từng năng lực;
 * cả hai tuỳ chọn (một provider dùng được duy nhất thì tự chọn). Ghi đè vận hành như biến môi trường phải
 * đổ vào CHÍNH hai trường này, không được dựng chuỗi ưu tiên ẩn.
 */
export interface WebRuntimeConfig {
  /** Id provider tìm kiếm chỉ định. Vắng = tự chọn khi có đúng một provider dùng được. */
  readonly searchProvider?: string;
  /** Id provider tải về chỉ định. Vắng = tự chọn khi có đúng một provider dùng được. */
  readonly fetchProvider?: string;
}

/**
 * Service truy cập web. Đăng ký thành `ctx.web` (một thể hiện cho mỗi context).
 *
 * Ngữ nghĩa chọn provider (giải tại THỜI ĐIỂM GỌI, không bao giờ phụ thuộc thứ tự):
 * - id đã cấu hình, có đăng ký và `available()` → chính provider đó.
 * - id đã cấu hình nhưng CHƯA đăng ký → `WEB_PROVIDER_CONFIGURED_MISSING`.
 * - id đã cấu hình, có đăng ký nhưng KHÔNG dùng được → `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`.
 * - không cấu hình, đúng MỘT provider dùng được → provider đó.
 * - không cấu hình, NHIỀU provider dùng được → `WEB_PROVIDER_AMBIGUOUS`.
 * - không cấu hình, KHÔNG provider nào dùng được → `WEB_PROVIDER_UNAVAILABLE`.
 */
export class WebRuntime extends Service {
  /**
   * Schema cấu hình chọn provider (schemastery) — để Settings/config-editor của kernel render được field.
   * Ghi đè vận hành đổ vào CÙNG hai trường: `$DSH_WEB_SEARCH_PROVIDER` / `$DSH_WEB_FETCH_PROVIDER`
   * tương đương `searchProvider` / `fetchProvider`, KHÔNG phải chuỗi ưu tiên ẩn.
   */
  static Config = z.object({
    searchProvider: z.string(),
    fetchProvider: z.string(),
  }) as unknown as z<WebRuntimeConfig>;

  /** Sổ provider tìm kiếm của THỂ HIỆN này — khoá theo `provider.id`. */
  private readonly searchProviders = new Map<string, WebSearchProvider>();

  /** Sổ provider tải về của THỂ HIỆN này — khoá theo `provider.id`. */
  private readonly fetchProviders = new Map<string, WebFetchProvider>();

  /** Id provider tìm kiếm đã ghim (Config hoặc biến môi trường); vắng = tự chọn. */
  private readonly searchProviderId: string | undefined;

  /** Id provider tải về đã ghim (Config hoặc biến môi trường); vắng = tự chọn. */
  private readonly fetchProviderId: string | undefined;

  /**
   * Đăng ký service `web` và chốt hai id provider đã ghim.
   * Nhận: context host và cấu hình đã qua schema (hai trường tuỳ chọn).
   * Trả: thực thể đã đăng ký; biến môi trường chỉ là nguồn DỰ PHÒNG khi Config không nói.
   */
  constructor(ctx: Context, config: WebRuntimeConfig = {}) {
    super(ctx, "web");
    this.searchProviderId = config.searchProvider ?? process.env.DSH_WEB_SEARCH_PROVIDER;
    this.fetchProviderId = config.fetchProvider ?? process.env.DSH_WEB_FETCH_PROVIDER;
  }

  /**
   * Đăng ký một provider tìm kiếm. Ném {@link WebError} `WEB_DUPLICATE_PROVIDER` khi id của nó đã có trong
   * sổ tìm kiếm. Trả hàm gỡ đăng ký; đăng ký bị gỡ theo fiber gọi nó.
   * Nhận: provider — `id` của nó là khoá sổ đăng ký.
   * Trả: hàm gỡ đăng ký provider đó.
   */
  registerSearchProvider(provider: WebSearchProvider): () => void {
    return this.registerProvider(this.searchProviders, provider);
  }

  /**
   * Đăng ký một provider tải về. Ném {@link WebError} `WEB_DUPLICATE_PROVIDER` khi id của nó đã có trong
   * sổ tải về. Trả hàm gỡ đăng ký; đăng ký bị gỡ theo fiber gọi nó.
   * Nhận: provider — `id` của nó là khoá sổ đăng ký.
   * Trả: hàm gỡ đăng ký provider đó.
   */
  registerFetchProvider(provider: WebFetchProvider): () => void {
    return this.registerProvider(this.fetchProviders, provider);
  }

  /**
   * Đăng ký chung cho cả hai sổ: từ chối id trùng, chèn provider trong một hiệu ứng của fiber hiện tại,
   * và gỡ nó khi hiệu ứng bị dọn.
   * Nhận: sổ đích (tìm kiếm hoặc tải về) và provider có `id`.
   * Trả: hàm gỡ đăng ký (idempotent — gọi lần hai không làm gì thêm).
   */
  private registerProvider<P extends { readonly id: string }>(store: Map<string, P>, provider: P): () => void {
    if (store.has(provider.id)) {
      throw new WebError(`a web provider with id "${provider.id}" is already registered`, "WEB_DUPLICATE_PROVIDER");
    }
    const dispose = this.ctx.effect(() => {
      store.set(provider.id, provider);
      return () => {
        store.delete(provider.id);
      };
    }, "web.registerProvider()");
    return () => void dispose();
  }

  /**
   * Chạy MỘT lượt tìm kiếm qua provider được chọn. Giải provider tại thời điểm gọi theo đúng luật chọn ở trên;
   * ném {@link WebError} khi năng lực không chạy được. Seam THI HÀNH `request.maxResults` trên kết quả:
   * provider trả quá tay thì `sources[]` bị cắt và `truncated` được bật.
   * Nhận: request — câu hỏi và trần kết quả tuỳ chọn; signal — tín hiệu huỷ tuỳ chọn, chuyển tiếp cho provider.
   * Trả: kết quả của provider, đã cắt đúng `request.maxResults`.
   */
  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const result = await resolveProvider({
      providers: this.searchProviders,
      ...(this.searchProviderId === undefined ? {} : { configuredId: this.searchProviderId }),
    }).search(request, signal);
    return capSources(result, request.maxResults);
  }

  /**
   * Tải MỘT URL qua provider được chọn. Giải provider tại thời điểm gọi theo đúng luật chọn ở trên;
   * ném {@link WebError} khi năng lực không chạy được. Phản hồi NGOÀI 2xx là KẾT QUẢ, không phải lỗi ném ra.
   * Nhận: request — URL cùng tuỳ chọn tải về; signal — tín hiệu huỷ tuỳ chọn, chuyển tiếp cho provider.
   * Trả: kết quả tải về; phản hồi ngoài 2xx trả về dưới dạng mô tả được.
   */
  async fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    return resolveProvider({
      providers: this.fetchProviders,
      ...(this.fetchProviderId === undefined ? {} : { configuredId: this.fetchProviderId }),
    }).fetch(request, signal);
  }
}

// ADR 000d — KHÔNG khai lại Context.web ở đây: kernel đã khai thuộc tính đó bằng LỚP CỦA NÓ
// (@deepseek-ai/dsh-web/lib/types/index.d.ts), khai lại bằng lớp của ta ⇒ TS2717
// "Property 'web' must be of type 'WebRuntime', but here has type 'WebRuntime'" (hai lớp khác định danh).
// Consumer tự khai seam theo CẤU TRÚC (vd web-fetch-http: Context & { web: { registerFetchProvider(...) } }),
// đúng luật 000d; không chỗ nào đọc kiểu Context["web"].

export default WebRuntime;
