/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hợp đồng dây (wire contract) của row account-controller: kiểu giá trị đi qua Remote, tên event
 *      credential hết hạn, và hình dạng hai service mà row uỷ quyền (deepseekAccount · agents).
 *      Không import gói DSH nào ngoài bảng §3b của packages/README.md — kiểu ở đây là của ta.
 */

/** Nhãn thương hiệu nội bộ: giữ đúng TÊN kiểu của upstream mà không cần gói dsh-brand. */
export type Branded<T extends string> = string & { readonly __brand?: T };

/** Danh tính của UI đang gọi; Host tự suy header Platform từ nó. */
export interface AccountClientMetadata {
  /** Phiên bản UI. */
  readonly version: string;
  /** Ngôn ngữ UI đang dùng; chỉ tiểu nhãn đầu chọn ngôn ngữ dây của Platform. */
  readonly locale: string;
  /** Lệch múi giờ so với UTC (giây), dương khi ở phía đông Greenwich. */
  readonly timezoneOffsetSeconds: number;
}

/** Danh tính một lần đăng nhập cục bộ (khác request id của Platform). */
export type SignInAttemptId = Branded<"SignInAttemptId">;

/**
 * Mã lỗi an toàn, hiển thị qua từ điển của bên gọi.
 * `no-response`: fetch không trả Response · `network`: HTTP hoặc lấy chi tiết tài khoản lỗi ·
 * `protocol`: phản hồi/authorization không hợp lệ · `expired`: authorization hết hạn · `storage`: đọc/ghi credential lỗi.
 */
export type SignInErrorCode = "no-response" | "network" | "protocol" | "expired" | "storage";

/** Lần đăng nhập gần nhất, kể cả kết quả cuối, giữ tới lần thử kế tiếp. */
export interface SignInAttemptView {
  /** Định danh lần thử. */
  readonly id: SignInAttemptId;
  /** Pha hiện tại. */
  readonly phase: "initializing" | "waiting-browser" | "exchanging" | "committing" | "succeeded" | "cancelled" | "expired" | "failed";
  /** URL uỷ quyền để mở trình duyệt. */
  readonly authorizeUrl?: string;
  /** Thời điểm hết hạn (ms). */
  readonly expiresAt?: number;
  /** Mã lỗi khi pha là thất bại. */
  readonly errorCode?: SignInErrorCode;
}

/** Hai đích trình duyệt suy từ cấu hình Platform của Host; không bao giờ mang token. */
export interface AccountLinks {
  /** Trang xem hạn mức. */
  readonly usageUrl: string;
  /** Trang nạp tiền. */
  readonly topUpUrl: string;
}

/** Có credential đã lưu KHÔNG đồng nghĩa Platform đã xác thực token đó. */
export interface AccountView {
  /** Trạng thái tài khoản. */
  readonly status: "signed-out" | "credential-stored";
  /** Hai đích trình duyệt. */
  readonly links: AccountLinks;
  /** Lần đăng nhập gần nhất, null khi chưa thử. */
  readonly attempt: SignInAttemptView | null;
}

/** Định danh tài khoản Platform do endpoint current-user cấp. */
export type AccountUserId = Branded<"AccountUserId">;

/** Danh tính hiển thị; liên hệ giữ nguyên mặt nạ của Platform. */
export interface AccountProfile {
  /** Id tài khoản. */
  readonly id: AccountUserId | null;
  /** Tên hiển thị. */
  readonly name: string | null;
  /** Liên hệ (đã che theo Platform). */
  readonly contact: string | null;
  /** URL ảnh đại diện do Platform cấp; vắng khi chưa cấu hình. */
  readonly avatarUrl?: string | null;
}

/** Số dư ví nạp hoặc ví thưởng; chuỗi thập phân giữ độ chính xác của server. */
export interface AccountWallet {
  /** Đơn vị tiền tệ. */
  readonly currency: "CNY" | "USD";
  /** Số dư dạng chuỗi. */
  readonly balance: string;
}

/** Hai kết quả truy vấn ĐỘC LẬP để lỗi hồ sơ và lỗi số dư hiển thị riêng. */
export interface AccountDetails {
  /** Kết quả hồ sơ. */
  readonly profile: { readonly status: "ready"; readonly value: AccountProfile } | { readonly status: "failed" };
  /** Kết quả số dư. */
  readonly balance:
    | { readonly status: "ready"; readonly value: readonly AccountWallet[]; readonly bonusWallets: readonly AccountWallet[] }
    | { readonly status: "failed" };
}

/** Định danh một đơn thưởng đã cấp; ổn định giữa các thiết bị và lần đăng nhập. */
export type AccountBonusOrderId = Branded<"AccountBonusOrderId">;

/** Một đơn thưởng Platform chưa ghi nhận là đã hiển thị; lời nhắn do server soạn. */
export interface AccountBonusNotification {
  /** Định danh đơn thưởng. */
  readonly orderId: AccountBonusOrderId;
  /** Chiến dịch cấp thưởng. */
  readonly campaign: string;
  /** Số tiền được cấp, giữ độ chính xác của server; không phải số dư còn lại. */
  readonly amount: string;
  /** Đơn vị tiền tệ. */
  readonly currency: "CNY" | "USD";
  /** Thời điểm cấp theo Platform. */
  readonly grantedAt: string;
  /** Thời điểm hết hạn theo Platform. */
  readonly expiresAt: string;
  /** Văn bản thuần đã bản địa hoá, sẵn sàng hiển thị. */
  readonly message: string;
}

/** Các đơn thưởng chưa thông báo kèm tài khoản sở hữu, theo thứ tự Platform. */
export interface AccountBonusBatch {
  /** Tài khoản sở hữu các đơn thưởng. */
  readonly accountId: AccountUserId;
  /** Danh sách đơn thưởng. */
  readonly bonuses: readonly AccountBonusNotification[];
}

/** Tên event phát khi server từ chối credential hiện tại (không phát lại lần trước). */
export const SESSION_EXPIRED_EVENT = "deepseek-account/session-expired";

/**
 * Phần bề mặt của service `deepseekAccount` mà row này uỷ quyền.
 * Row KHÔNG import gói peer này (ngoài bảng §3b): nó lấy service qua Context của kernel.
 */
export interface AccountProvider {
  /** Đọc trạng thái tài khoản an toàn. */
  getState(): Promise<AccountView>;
  /** Truy vấn hồ sơ Platform. */
  getProfile(client: AccountClientMetadata): Promise<AccountDetails["profile"] | null>;
  /** Truy vấn số dư ví. */
  getBalance(client: AccountClientMetadata): Promise<AccountDetails["balance"] | null>;
  /** Truy vấn các đơn thưởng chưa thông báo. */
  getUnnotifiedBonuses(client: AccountClientMetadata): Promise<AccountBonusBatch | null>;
  /** Ghi nhận một đơn thưởng đã hiển thị. */
  ackBonusNotified(accountId: AccountUserId, orderId: AccountBonusOrderId, client: AccountClientMetadata): Promise<boolean>;
  /** Bắt đầu đăng nhập bằng trình duyệt. */
  startSignIn(client: AccountClientMetadata, callbackOrigin: string, loginSource: "web" | "desktop"): Promise<AccountView>;
  /** Huỷ một lần thử cục bộ. */
  cancelSignIn(attemptId: SignInAttemptId): Promise<AccountView>;
  /** Xoá credential cục bộ và thu hồi nền qua Platform. */
  signOut(client: AccountClientMetadata): Promise<AccountView>;
  /** Theo dõi trạng thái tài khoản. */
  watch(signal: AbortSignal): AsyncIterable<AccountView>;
}

/** Một task đang chạy, chỉ phần mà phép kiểm `hasRunningAccountTasks` cần. */
export interface RunningAgentLike {
  /** Trạng thái task. */
  readonly status?: unknown;
  /** Session của task, nếu đã gắn. */
  readonly session?: { requestContext?(): { provider?: unknown } | undefined } | undefined;
}

/** Phần bề mặt của service `agents` mà row này dùng. */
export interface AgentsProvider {
  /** Danh sách task hiện có. */
  list(): readonly RunningAgentLike[];
}

/**
 * Task đang chạy có ngữ cảnh request MỚI NHẤT trên tuyến account hay không.
 * Viết lại theo hành vi của `isRunningAccountTask` (bản gốc nằm trong gói peer ngoài bảng §3b):
 * chỉ đúng khi task đang chạy VÀ provider của request context là `deepseek-account`.
 * @param agent - một phần tử của `agents.list()`.
 * @returns true khi task thuộc tuyến account và đang chạy.
 */
export function isRunningAccountTask(agent: RunningAgentLike): boolean {
  if (agent.status !== "running") return false;
  const context = agent.session?.requestContext?.();
  return context?.provider === "deepseek-account";
}
