/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bảng định danh của row connection: id module, đường dẫn giao vận, tên cookie và khoá ghi credentials
 */

/** Id MODULE chính — package của ta; bundle tự khai id này nên manifest của Host trỏ tới đây. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-connection";

/** Id MODULE phụ — package gốc DSH; gốc đăng ký ĐÚNG MỘT id nên bản viết lại đăng ký hai id cùng factory. */
export const STOCK_PACKAGE_NAME = "@galaxy-blackhole/gbh-client-connection";

/** Đường dẫn gốc của giao vận RPC trên HTTP. */
export const API_PATH = "/api";

/** Đường dẫn trao đổi token lấy cookie phiên. */
export const CONNECT_PATH = "/connect";

/** Tham số truy vấn mang token khởi động. */
export const TOKEN_QUERY = "token";

/** Tiền tố tên cookie phiên của trình duyệt. */
export const COOKIE_PREFIX = "dsh-auth-";

/** Phạm vi ghi bí mật phiên trong sổ credentials dùng chung. */
export const AUTH_RECORD_SCOPE = "client-connection";

/** Id bản ghi bí mật phiên trong sổ credentials. */
export const AUTH_RECORD_ID = "browser-session";

/** Khoá ghi đầy đủ, đúng định dạng <scope>/<id> mà sổ credentials chấp nhận. */
export const AUTH_RECORD_KEY = AUTH_RECORD_SCOPE + "/" + AUTH_RECORD_ID;

/** Tên biến toàn cục mang cấu hình phục hồi được tiêm vào trang. */
export const RECOVERY_GLOBAL = "__GBH_CONNECTION_RECOVERY__";

/** Tên biến toàn cục mang giao vận do vỏ tự dựng (shell khác cắm vào). */
export const TRANSPORT_GLOBAL = "__GBH_TRANSPORT__";

/** Tên plugin cordis ổn định (giống bản gốc). */
export const PLUGIN_NAME = "client-connection";

/** Kích thước tối đa mặc định của thân JSON cho mỗi yêu cầu /api (300 MiB). */
export const DEFAULT_MAX_REQUEST_BODY_BYTES = 314572800;
