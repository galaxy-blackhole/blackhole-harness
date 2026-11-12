/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số của row web-fetch-http: id provider, User-Agent mặc định, trần timer của Node, độ dài URL
 */

// 1:1 từ @deepseek-ai/dsh-web-fetch-http/lib/index.js (682 dòng) — chỉ đổi tên gói/thương hiệu, GIỮ NGUYÊN hành vi.

/** Trần timer của Node (setTimeout lớn hơn mức này bị co về 1ms). */
export const MAX_NODE_TIMER_DELAY_MS = 2147483647;

/** User-Agent mặc định: một tác nhân sản phẩm rõ ràng, KHÔNG giả dạng trình duyệt. */
export const DEFAULT_USER_AGENT = "galaxy-blackhole/0.0.1 (+https://github.com/galaxy-blackhole)";

/** Id ổn định mà provider này đăng ký vào sổ fetch của seam ctx.web. */
export const LOCAL_FETCH_PROVIDER_ID = "http";

/** Độ dài URL tối đa mà provider chấp nhận. */
export const WEB_FETCH_MAX_URL_LENGTH = 2048;

/** Tên plugin cordis dùng cho chẩn đoán của loader. */
export const name = "web-fetch-http";

/** Seam mà provider đăng ký vào. */
export const inject: string[] = ["web"];
