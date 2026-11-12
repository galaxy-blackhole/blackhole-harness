/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai phép thuần của seam web: CHỌN provider tại thời điểm gọi (không phụ thuộc thứ tự đăng ký)
 *      và THI HÀNH biên `maxResults` trên kết quả tìm kiếm. Không giữ trạng thái, không chạm mạng.
 */

import { WebError } from "./types.ts";
import type { WebSearchResult } from "./types.ts";

/** Một provider ở dạng TỐI THIỂU mà phép chọn cần: có `id` và phép kiểm dùng được. */
export interface SelectableProvider {
  /** Khoá sổ đăng ký của provider. */
  readonly id: string;
  /** Phép kiểm dùng được rẻ, tại chỗ. */
  available(): boolean;
}

/** Sổ provider mà phép chọn đọc — đúng phần bề mặt `Map` mà bản gốc dùng. */
export interface ProviderRegistry<P extends SelectableProvider> {
  /** Tra provider theo id; `undefined` khi chưa đăng ký. */
  get(id: string): P | undefined;
  /** Mọi provider đã đăng ký, theo thứ tự chèn. */
  values(): IterableIterator<P>;
}

/** Đầu vào của phép chọn provider. */
export interface ProviderSelection<P extends SelectableProvider> {
  /** Id đã cấu hình (từ Config hoặc biến môi trường); vắng = tự chọn. */
  readonly configuredId?: string;
  /** Sổ provider của loại năng lực đang gọi. */
  readonly providers: ProviderRegistry<P>;
}

/**
 * Giải provider được chọn, hoặc ném {@link WebError} khớp đúng ca.
 * Nhận: id đã cấu hình (nếu có) và sổ provider của loại năng lực.
 * Trả: provider sẽ thi hành lượt gọi — đúng MỘT provider, không phụ thuộc thứ tự đăng ký.
 */
export function resolveProvider<P extends SelectableProvider>(selection: ProviderSelection<P>): P {
  const { configuredId, providers } = selection;
  if (configuredId !== undefined) {
    const provider = providers.get(configuredId);
    if (provider === undefined) {
      throw new WebError(`configured web provider "${configuredId}" is not registered`, "WEB_PROVIDER_CONFIGURED_MISSING");
    }
    if (!provider.available()) {
      throw new WebError(`configured web provider "${configuredId}" is registered but unavailable`, "WEB_PROVIDER_CONFIGURED_UNAVAILABLE");
    }
    return provider;
  }
  const usable = [...providers.values()].filter((provider) => provider.available());
  const [single] = usable;
  if (single === undefined) throw new WebError("no usable web provider is registered", "WEB_PROVIDER_UNAVAILABLE");
  if (usable.length > 1) {
    throw new WebError(
      `multiple usable web providers are registered (${usable.map((provider) => provider.id).join(", ")}); configure one explicitly`,
      "WEB_PROVIDER_AMBIGUOUS",
    );
  }
  return single;
}

/**
 * Thi hành biên `maxResults` trên một kết quả tìm kiếm: cắt `sources[]` và bật cờ `truncated`.
 * Nhận: kết quả provider trả về và trần số nguồn của request (có thể vắng).
 * Trả: chính kết quả đó khi không phải cắt, hoặc một bản sao ĐÃ CẮT kèm `truncated: true`.
 */
export function capSources(result: WebSearchResult, maxResults: number | undefined): WebSearchResult {
  if (maxResults === undefined || result.sources.length <= maxResults) return result;
  return { ...result, sources: result.sources.slice(0, maxResults), truncated: true };
}
