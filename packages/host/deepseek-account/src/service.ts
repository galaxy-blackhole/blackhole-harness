/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Định nghĩa Service `deepseekAccount` mà Platform/API/model cùng dùng: mười ba thao tác tài khoản
 *      (chỉ Host lấy được thông tin xác thực request) + ảnh chụp Host-only cho tài liệu Platform nhúng.
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type {
  AccountBonusBatch,
  AccountBonusOrderId,
  AccountClientMetadata,
  AccountDetails,
  AccountUserId,
  AccountView,
  SignInAttemptId,
} from "./types.ts";

/**
 * Thông tin xác thực Host-only cho một tài liệu Platform nhúng.
 * KHÔNG BAO GIỜ phơi qua RPC tài khoản.
 */
export interface PlatformSession {
  /** Gốc origin của Platform mà thông tin xác thực thuộc về. */
  readonly origin: string;
  /** Token request Host-only. */
  readonly token: string;
  /** Danh tính tài khoản ổn định từ lần đọc hồ sơ THÀNH CÔNG gần nhất; null đòi kho trình duyệt dùng-một-lần. */
  readonly userId: AccountUserId | null;
  /** Giá trị truy vấn `dist` tuỳ chọn, chọn bản triển khai frontend nhúng. */
  readonly embeddedPageDist?: string;
  /** Header request của deployment (Host-only); client tiêu thụ tự thêm danh tính động, cả hai không tới bootstrap renderer. */
  readonly requestHeaders?: Readonly<Record<string, string>>;
}

/**
 * Thao tác tài khoản; chỉ consumer phía Host lấy được thông tin xác thực request.
 * Lớp này là ĐỊNH NGHĨA: mọi phương thức đều trừu tượng, bản cài thật do row platform cấp.
 */
export abstract class DeepSeekAccount extends Service {
  /** @param ctx - context sở hữu bản cài tài khoản này. */
  constructor(ctx: Context) {
    super(ctx, "deepseekAccount");
  }

  /**
   * Đọc sự hiện diện của tài khoản đã lưu và lần đăng nhập gần nhất.
   * @returns ảnh chụp KHÔNG kèm thông tin xác thực hay bí mật PKCE.
   */
  abstract getState(): Promise<AccountView>;

  /**
   * Truy vấn hồ sơ Platform độc lập với số dư ví.
   * Kết quả `ready` có danh tính ổn định lần đầu xuất hiện (hoặc đổi) sẽ báo cho consumer watch có bật
   * danh tính để chúng đọc lại getPlatformSession; danh tính lặp lại thì im lặng.
   * @param client - danh tính UI đang gọi.
   * @returns kết quả hồ sơ, hoặc null khi đã đăng xuất / uỷ quyền đổi giữa lúc truy vấn.
   */
  abstract getProfile(client: AccountClientMetadata): Promise<AccountDetails["profile"] | null>;

  /**
   * Truy vấn số dư ví nạp thêm và ví bonus độc lập với dữ liệu hồ sơ.
   * @param client - danh tính UI đang gọi.
   * @returns kết quả số dư, hoặc null khi đã đăng xuất / uỷ quyền đổi giữa lúc truy vấn.
   */
  abstract getBalance(client: AccountClientMetadata): Promise<AccountDetails["balance"] | null>;

  /**
   * Truy vấn các bonus đã cấp mà Platform chưa ghi nhận là đã hiển thị.
   * @param client - danh tính UI đang gọi; ngôn ngữ của nó chọn câu chữ do server viết.
   * @returns bonus kèm tài khoản của chúng, hoặc null khi đã đăng xuất / uỷ quyền đổi giữa lúc truy vấn.
   */
  abstract getUnnotifiedBonuses(client: AccountClientMetadata): Promise<AccountBonusBatch | null>;

  /**
   * Ghi nhận MỘT bonus đã hiển thị là đã báo, cho đúng tài khoản sở hữu nó.
   * @param accountId - tài khoản mà thông báo được đọc cho; tài khoản hiện tại khác thì KHÔNG bao giờ xác nhận.
   * @param orderId - đơn bonus đã cấp mà người dùng đã thấy.
   * @param client - danh tính UI đang gọi.
   * @returns true khi Platform đã ghi nhận; false khi đã đăng xuất hoặc tài khoản đã đổi.
   */
  abstract ackBonusNotified(
    accountId: AccountUserId,
    orderId: AccountBonusOrderId,
    client: AccountClientMetadata,
  ): Promise<boolean>;

  /**
   * Tham gia một lần thử đang chạy hoặc bắt đầu uỷ quyền trên trình duyệt.
   * @param client - danh tính UI đang gọi; lần thử MỚI chụp nó, còn tham gia thì giữ danh tính của lần gốc.
   * @param callbackOrigin - origin HTTP loopback mà trình duyệt với tới được, gồm cả cổng SSH local nếu có.
   * @param loginSource - UI khởi phát, dùng để quay về khi trao đổi hỏng.
   * @returns ảnh chụp ban đầu, KHÔNG chờ người dùng duyệt trên trình duyệt.
   */
  abstract startSignIn(
    client: AccountClientMetadata,
    callbackOrigin: string,
    loginSource: "web" | "desktop",
  ): Promise<AccountView>;

  /**
   * Huỷ ĐÚNG lần thử được nêu tên; lần thử đang commit thì để nó kết thúc trước khi trả.
   * @param id - danh tính lần thử do Host này cấp.
   * @returns trạng thái sau khi huỷ, hoặc sau khi commit đã bắt đầu.
   */
  abstract cancelSignIn(id: SignInAttemptId): Promise<AccountView>;

  /**
   * Gỡ uỷ quyền cục bộ trong khi GIỮ LẠI API key; provider thu hồi nền.
   * @param client - danh tính UI đang gọi, được chụp lại cho các lượt thu hồi nền.
   * @returns trạng thái đã đăng xuất sau khi gỡ cục bộ; hỏng phía server không bao giờ dựng lại uỷ quyền.
   */
  abstract signOut(client: AccountClientMetadata): Promise<AccountView>;

  /**
   * Theo dõi ảnh chụp, gồm cả trạng thái đầu đầy đủ.
   * @param signal - vòng đời đăng ký; kết thúc nó KHÔNG huỷ việc đăng nhập.
   * @param includeIdentityChanges - báo thêm khi danh tính Platform đã cache đổi; mặc định false.
   * @returns ảnh chụp đầy đủ mỗi khi trạng thái tài khoản đổi.
   */
  abstract watch(signal: AbortSignal, includeIdentityChanges?: boolean): AsyncIterable<AccountView>;

  /**
   * Lấy thông tin xác thực CHỈ cho origin suy luận mà provider cho phép.
   * @param url - đích request thật hoặc URL gốc của API.
   * @returns token đã lưu, hoặc undefined với origin khác hay tài khoản đã đăng xuất.
   */
  abstract resolveToken(url: string): Promise<string | undefined>;

  /**
   * Gỡ token bị suy luận từ chối, CHỈ khi nó còn khớp lần đăng nhập đã lưu.
   * @param token - token mà request suy luận bị từ chối đã chụp.
   * @returns sau khi thông tin xác thực khớp bị gỡ và sự kiện hết hạn đã được phát.
   */
  abstract rejectToken(token: string): Promise<void>;

  /**
   * Đọc thông tin xác thực cho origin Platform đã cấu hình, gắn với môi trường đã cấp chúng, và ghép với
   * danh tính tài khoản của lần đọc hồ sơ THÀNH CÔNG gần nhất; KHÔNG gọi request hồ sơ nào.
   * @returns ảnh chụp Host-only, hoặc null khi đã đăng xuất / thông tin xác thực đổi giữa lúc đọc.
   */
  abstract getPlatformSession(): Promise<PlatformSession | null>;

  /**
   * Đọc danh tính đăng nhập sẵn có mà KHÔNG tạo thiết bị và KHÔNG trả thông tin xác thực.
   * @returns mã thiết bị/tài khoản tuỳ chọn và chuỗi phiên bản hệ điều hành của provider.
   */
  abstract getDeviceIdentity(): Promise<{ deviceId?: string; userId?: AccountUserId; osVersion: string }>;
}

declare module "@deepseek-ai/cordis" {
  interface Events {
    /** Việc gỡ uỷ quyền cục bộ đã xong.
     * @mode emit
     */
    "deepseek-account/signed-out"(): void;
  }
  interface Context {
    /** Service tài khoản DeepSeek do row platform cấp. */
    deepseekAccount: DeepSeekAccount;
  }
}
