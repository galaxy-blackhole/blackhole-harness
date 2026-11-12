/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu dữ liệu tài khoản DeepSeek dùng chung cho Platform/API/model: danh tính UI gọi, ảnh chụp
 *      trạng thái đăng nhập, hồ sơ + hai ví, và lô bonus chưa báo; kèm hai sự kiện cordis của gói gốc.
 */

import type { Branded } from "@deepseek-ai/dsh-brand";

/** Danh tính của UI đang gọi một thao tác tài khoản; Host dựng header request Platform từ chính nó. */
export interface AccountClientMetadata {
  /** Phiên bản của UI gọi. */
  readonly version: string;
  /** Ngôn ngữ UI đang bật; chỉ tiểu nhãn đầu chọn locale đường truyền của Platform. */
  readonly locale: string;
  /** Độ lệch so với UTC tính bằng giây, dương về phía đông Greenwich. */
  readonly timezoneOffsetSeconds: number;
}

/** Danh tính của MỘT lần đăng nhập cục bộ, không liên quan request ID của platform. */
export type SignInAttemptId = Branded<"SignInAttemptId">;

/**
 * Mã hỏng AN TOÀN để render qua từ điển của bên gọi.
 * `no-response`: fetch không trả Response; `network`: hỏng HTTP hoặc không lấy được chi tiết tài khoản.
 * `protocol`: phản hồi hoặc dữ liệu uỷ quyền sai; `expired`: uỷ quyền hết hạn;
 * `storage`: không đọc/ghi được thông tin xác thực cục bộ.
 */
export type SignInErrorCode = "no-response" | "network" | "protocol" | "expired" | "storage";

/** Lần đăng nhập gần nhất, gồm cả kết cục cuối cho tới lần thử kế tiếp. */
export interface SignInAttemptView {
  /** Danh tính lần thử do Host cấp. */
  readonly id: SignInAttemptId;
  /** Pha hiện tại của lần thử. */
  readonly phase:
    | "initializing"
    | "waiting-browser"
    | "exchanging"
    | "committing"
    | "succeeded"
    | "cancelled"
    | "expired"
    | "failed";
  /** Địa chỉ uỷ quyền trên trình duyệt, có sau khi pha khởi tạo xong. */
  readonly authorizeUrl?: string;
  /** Mốc hết hạn của lần thử (mili giây), nếu đã biết. */
  readonly expiresAt?: number;
  /** Mã hỏng an toàn khi lần thử kết thúc ở `failed` hoặc `expired`. */
  readonly errorCode?: SignInErrorCode;
}

/** Đích trên trình duyệt suy từ cấu hình platform của Host; KHÔNG bao giờ mang token. */
export interface AccountLinks {
  /** Trang xem mức dùng. */
  readonly usageUrl: string;
  /** Trang nạp thêm số dư. */
  readonly topUpUrl: string;
}

/** Sự hiện diện của tài khoản đã lưu KHÔNG phải lời khẳng định server đã kiểm token đó. */
export interface AccountView {
  /** `credential-stored` chỉ nói có bản ghi cục bộ. */
  readonly status: "signed-out" | "credential-stored";
  /** Hai đích trên trình duyệt của deployment. */
  readonly links: AccountLinks;
  /** Lần đăng nhập gần nhất, hoặc null khi chưa có lần nào. */
  readonly attempt: SignInAttemptView | null;
}

/** Danh tính tài khoản Platform do endpoint current-user cấp. */
export type AccountUserId = Branded<"AccountUserId">;

/** Danh tính hiển thị; phần liên hệ giữ nguyên cách che của Platform. */
export interface AccountProfile {
  /** Danh tính ổn định, null khi Platform không trả. */
  readonly id: AccountUserId | null;
  /** Tên hiển thị, null khi chưa đặt. */
  readonly name: string | null;
  /** Liên hệ đã được Platform che, null khi chưa có. */
  readonly contact: string | null;
  /** Địa chỉ ảnh hồ sơ do Platform cấp; vắng khi chưa cấu hình ảnh. */
  readonly avatarUrl?: string | null;
}

/** Số dư ví nạp thêm hoặc ví bonus; chuỗi thập phân giữ đúng độ chính xác của server. */
export interface AccountWallet {
  /** Đơn vị tiền tệ của ví. */
  readonly currency: "CNY" | "USD";
  /** Số dư dạng chuỗi thập phân, nguyên văn từ server. */
  readonly balance: string;
}

/** Hai kết quả truy vấn ĐỘC LẬP để hỏng hồ sơ và hỏng số dư render riêng được. */
export interface AccountDetails {
  /** Kết quả truy vấn hồ sơ. */
  readonly profile: { readonly status: "ready"; readonly value: AccountProfile } | { readonly status: "failed" };
  /** Kết quả truy vấn ví: ví nạp thêm và ví bonus. */
  readonly balance:
    | { readonly status: "ready"; readonly value: readonly AccountWallet[]; readonly bonusWallets: readonly AccountWallet[] }
    | { readonly status: "failed" };
}

/** Danh tính của MỘT đơn bonus đã cấp; ổn định qua thiết bị và lần đăng nhập. */
export type AccountBonusOrderId = Branded<"AccountBonusOrderId">;

/** Một bonus đã cấp mà Platform chưa ghi nhận là đã hiển thị; chữ do server viết. */
export interface AccountBonusNotification {
  /** Mã đơn của bonus. */
  readonly orderId: AccountBonusOrderId;
  /** Tên chiến dịch cấp bonus. */
  readonly campaign: string;
  /** Số tiền được cấp dạng thập phân, giữ độ chính xác của server; không phải số dư còn lại. */
  readonly amount: string;
  /** Đơn vị tiền tệ của bonus. */
  readonly currency: "CNY" | "USD";
  /** Thời điểm cấp, nguyên văn từ Platform. */
  readonly grantedAt: string;
  /** Thời điểm hết hạn, nguyên văn từ Platform. */
  readonly expiresAt: string;
  /** Câu chữ thuần do server bản địa hoá, sẵn sàng để hiển thị. */
  readonly message: string;
}

/** Bonus chưa báo kèm tài khoản chúng thuộc về, theo đúng thứ tự Platform trả. */
export interface AccountBonusBatch {
  /** Tài khoản sở hữu lô bonus này. */
  readonly accountId: AccountUserId;
  /** Danh sách bonus chưa ghi nhận đã hiển thị. */
  readonly bonuses: readonly AccountBonusNotification[];
}

declare module "@deepseek-ai/cordis" {
  interface Events {
    /** Server từ chối và đã xoá thông tin xác thực của tài khoản hiện tại; thông báo này KHÔNG phát lại.
     * @mode emit
     */
    "deepseek-account/session-expired"(): void;
    /** Một request model bằng tài khoản cần người dùng đăng nhập.
     * @mode emit
     */
    "deepseek-account/model-sign-in-required"(): void;
  }
}
