/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của seam truy cập web (ctx.web): request/result của search và fetch, hình dạng
 *      provider, và `WebError`. Search và fetch dùng CHUNG một seam để việc chọn provider, huỷ,
 *      lỗi và cấu hình sản phẩm chỉ có MỘT chủ — nhưng giữ kiểu request/result riêng.
 *      Nguồn đối chiếu (G4): xem README.md của package.
 */

import { HarnessError } from "@deepseek-ai/dsh-llm";

/**
 * Một lượt hỏi của backend tìm kiếm. Mỗi request mang MỘT câu hỏi; người gọi có thể phát nhiều request.
 * `maxResults` là biên của tầng `dsh-tool-web` đi qua nguyên vẹn và được CHÍNH seam thi hành khi kết quả về.
 */
export interface WebSearchRequest {
  /** Câu hỏi cần tìm. */
  readonly query: string;
  /** Trần số nguồn trả về; seam cắt xuống đúng trần này. Vắng = không biên. */
  readonly maxResults?: number;
}

/**
 * Một nguồn trích dẫn được. Nguồn LUÔN có URL; ba trường còn lại tuỳ chọn vì không phải provider nào cũng trả —
 * bắt adapter tự bịa sẽ làm seam nói sai (citation của Perplexity có thể chỉ có URL).
 */
export interface WebSearchSource {
  /** Địa chỉ của nguồn. */
  readonly url: string;
  /** Tiêu đề hiển thị; `dsh-tool-web` rơi về hostname khi vắng. */
  readonly title?: string;
  /** Đoạn trích của nguồn. */
  readonly snippet?: string;
  /** Dấu thời gian công bố/thu thập do provider cấp, dạng chuỗi ISO-8601. */
  readonly publishedAt?: string;
}

/**
 * Kết quả tìm kiếm đã chuẩn hoá. `content` là chữ trả lời/tóm tắt do provider sinh (tuỳ chọn);
 * `sources[]` là hình dạng trích dẫn di động; `truncated` do SEAM bật khi nó cắt `sources[]` xuống `maxResults`.
 */
export interface WebSearchResult {
  /** Chữ trả lời/tóm tắt do provider sinh, nếu có. */
  readonly content?: string;
  /** Nguồn trích dẫn được, đã cắt đúng `maxResults` của request. */
  readonly sources: readonly WebSearchSource[];
  /** `true` khi seam đã bỏ bớt nguồn để tôn trọng `maxResults`. */
  readonly truncated: boolean;
}

/**
 * Một lượt tải về của backend fetch. Request CỐ Ý không có timeout, format, prompt hay điều khiển trích xuất:
 * huỷ là tham số thi hành trực tiếp, còn trình bày và các mối quan tâm LLM bậc cao nằm ngoài phép tải an toàn.
 */
export interface WebFetchRequest {
  /** Địa chỉ cần tải về. */
  readonly url: string;
}

/**
 * Thân đã giải mã của tài nguyên tải về. HỢP ĐOÀN MỞ/ĐÓNG do `dsh-web` sở hữu: provider giải mã loại,
 * `dsh-tool-web` render — nên thêm một loại là thay đổi phối hợp giữa các gói đã biết, không phải điểm mở rộng plugin.
 * Mỗi nhánh vẫn là object literal riêng kể cả khi trường trùng nhau, để một nhánh có thể nhận thêm trường.
 */
export type WebFetchBody =
  | { readonly kind: "html"; readonly content: string }
  | { readonly kind: "text"; readonly content: string };

/**
 * Kết quả tải về đã chuẩn hoá. Một lượt tải mạng THÀNH CÔNG nhưng trả mã ngoài 2xx vẫn là KẾT QUẢ, không phải lỗi:
 * mã trạng thái là một phần trạng thái của tài nguyên. {@link WebError} chỉ dành cho việc KHÔNG thể tải an toàn
 * hoặc không thể biểu diễn tài nguyên.
 */
export interface WebFetchResult {
  /** URL cuối cùng sau các chuyển hướng được phép (URL gốc nằm trong request). */
  readonly url: string;
  /** Mã trạng thái HTTP của phản hồi đã tải. */
  readonly statusCode: number;
  /** Thân đã giải mã, phân loại theo loại nội dung. */
  readonly body: WebFetchBody;
  /** `true` khi provider đã cắt bớt thân đã giải mã. */
  readonly truncated: boolean;
}

/**
 * Một backend tìm kiếm được. Đăng ký bằng `ctx.web.registerSearchProvider`.
 * `id` là chuỗi ổn định, duy nhất trong CÙNG loại năng lực tìm kiếm.
 */
export interface WebSearchProvider {
  /** Khoá sổ đăng ký của provider. */
  readonly id: string;
  /** Phép kiểm dùng được RẺ, tại chỗ; KHÔNG được gọi mạng. */
  available(): boolean;
  /** Chạy một lượt tìm kiếm; tôn trọng `signal` để huỷ. */
  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}

/**
 * Một backend tải về được. Đăng ký bằng `ctx.web.registerFetchProvider`.
 * `id` là chuỗi ổn định, duy nhất trong CÙNG loại năng lực tải về.
 */
export interface WebFetchProvider {
  /** Khoá sổ đăng ký của provider. */
  readonly id: string;
  /** Phép kiểm dùng được RẺ, tại chỗ; KHÔNG được gọi mạng. */
  available(): boolean;
  /** Tải một URL; tôn trọng `signal` để huỷ. */
  fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult>;
}

/**
 * Lỗi web CÓ KIỂU, mang `code` kiểu chuỗi mở định tuyến được bằng máy và `cause` nối chuỗi.
 * Người dùng phải chịu được mã riêng của từng provider. Mã dùng chung phủ: provider không có, thiếu, không dùng được,
 * nhoè (nhiều provider cùng dùng được), trùng id, bị huỷ, và provider hỏng; provider tải về cục bộ còn phân biệt
 * URL không hợp lệ/bị chặn, chuyển hướng, giới hạn kích thước và thời gian, và loại nội dung không hỗ trợ.
 * Tầng thi hành tool phơi mã này trong metadata lỗi có cấu trúc.
 */
export class WebError extends HarnessError {}
