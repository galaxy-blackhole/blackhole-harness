/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu DÙNG CHUNG của row account-platform: `Config` deployment (origin, desktop, hạn chờ, retry logout)
 *      và các alias mà protocol.ts · details.ts · logout.ts · platform.ts cùng đọc.
 *      Export: Config · DesktopPlatform · PlatformHeaders · AccountToken · AccountDetailPath · AccountField ·
 *      LogoutRetryPolicy · AccountErrorCode · AccountView (re-export) · SignInAttemptView (re-export).
 */

import type { AccountDetails, SignInErrorCode } from "@deepseek-ai/dsh-deepseek-account/types";

/** Provider Platform dùng lại trạng thái an toàn cho client của service tài khoản (y bản gốc types.d.ts). */
export type { AccountView, SignInAttemptView } from "@deepseek-ai/dsh-deepseek-account/types";

/** Hệ điều hành do tầng composition desktop cấp; `null` nghĩa là client web. */
export type DesktopPlatform = "darwin" | "win32" | null;

/**
 * Bộ header HTTP dạng tên→giá trị đã chuẩn hoá.
 * Dùng cho header deployment của Platform và header danh tính client; tên luôn chữ thường.
 */
export type PlatformHeaders = Record<string, string>;

/**
 * Grant tài khoản Platform đã lưu trong credentials.
 * Chỉ là chuỗi token opaque; KHÔNG mang issuer — issuer do platform.ts giữ riêng.
 */
export type AccountToken = string;

/**
 * Hai endpoint chi tiết tài khoản mà Platform phục vụ cho Host.
 * Giữ nguyên văn đường dẫn của bản gốc để `requestAccount` chỉ nhận đúng hai đích này.
 */
export type AccountDetailPath = "/auth-api/v0/users/current" | "/api/v0/users/get_user_summary";

/** Trường chi tiết tài khoản đọc độc lập: `profile` hoặc `balance` (khoá của `AccountDetails`). */
export type AccountField = keyof AccountDetails;

/** Mã hỏng an toàn mà `PlatformAuthError` phơi ra; y hệt `SignInErrorCode` của service tài khoản. */
export type AccountErrorCode = SignInErrorCode;

/**
 * Chính sách huỷ grant đã gỡ khỏi credentials (y bản gốc logout.d.ts).
 * `maxRetries` là số lần thử THÊM sau lần đầu; `delayMs` là hạn chờ trước lần thử lại đầu tiên,
 * mỗi lần sau gấp đôi; `requestTimeoutMs` là hạn của MỘT request logout.
 */
export interface LogoutRetryPolicy {
  /** Số lần thử lại tối đa sau lần gửi đầu tiên. */
  readonly maxRetries: number;
  /** Hạn chờ (mili giây) trước lần thử lại đầu tiên; các lần sau nhân đôi. */
  readonly delayMs: number;
  /** Hạn (mili giây) của một request logout. */
  readonly requestTimeoutMs: number;
}

/** Lựa chọn deployment của provider tài khoản Platform (y bản gốc index.d.ts; mọi trường đều tuỳ chọn). */
export interface Config {
  /** Origin Platform phục vụ auth-api và trang trình duyệt. */
  platformOrigin?: string;
  /** Danh tính desktop gốc cho request Host API và Platform nhúng; `null` nhận client là web. */
  desktopPlatform?: DesktopPlatform;
  /** Bộ chọn frontend deployment cho trang Usage và Top-up nhúng (tuỳ chọn). */
  embeddedPageDist?: string;
  /** Đúng origin HTTP(S) được phép nhận token tài khoản cho suy luận và tệp. */
  inferenceOrigin?: string;
  /** Chỉ cho phép HTTP trên loopback, phục vụ Mock lúc phát triển. */
  allowLoopbackHttp?: boolean;
  /** Ánh xạ trang uỷ quyền và trang hoàn tất về `platformOrigin` cho proxy phát triển nội bộ. */
  rewriteBrowserOrigin?: boolean;
  /** Header chỉ gửi tới `platformOrigin`; uỷ quyền tài khoản không thể ghi đè. */
  requestHeaders?: Record<string, string>;
  /** Ghi đè cho request hồ sơ, số dư và Platform nhúng; cặp Cookie gộp theo tên. Logout giữ `requestHeaders`. */
  accountRequestHeaders?: Record<string, string>;
  /** Hạn (mili giây) của mỗi request HTTP Platform. */
  requestTimeoutMs?: number;
  /** Hạn (mili giây) của truy vấn ví nạp; quá hạn trả kết cục `failed` cho số dư. */
  balanceTimeoutMs?: number;
  /** Số lần logout thêm sau khi request đầu hỏng, tối đa năm. */
  logoutMaxRetries?: number;
  /** Hạn chờ (mili giây) trước lần logout thử lại đầu tiên; các lần sau nhân đôi. */
  logoutRetryDelayMs?: number;
  /** Chặn trên (mili giây) cho TRỌN một lần thử cục bộ, kể cả khi server hứa TTL dài hơn. */
  attemptTimeoutMs?: number;
}
