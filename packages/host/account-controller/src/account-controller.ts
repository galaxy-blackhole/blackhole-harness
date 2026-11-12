/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Controller: service remote accountController
 *      (namespace account) phơi các thao tác tài khoản AN TOÀN qua Remote, uỷ quyền cho service
 *      deepseekAccount của kernel và tự dựng luồng watchExpiry từ event credential hết hạn.
 */

import type { Context } from "@deepseek-ai/cordis";
import { Remote, TypertRemoteService } from "@galaxy-blackhole/gbh-typert-protocol";

import {
  type AccountBonusBatch,
  type AccountBonusOrderId,
  type AccountClientMetadata,
  type AccountDetails,
  type AccountProvider,
  type AccountUserId,
  type AccountView,
  type AgentsProvider,
  SESSION_EXPIRED_EVENT,
  type SignInAttemptId,
  isRunningAccountTask,
} from "./types.ts";

/**
 * Context của Host: API tra service + API event của cordis.
 *
 * Vì sao tra service bằng ctx.get thay vì đọc thẳng thuộc tính: khi Gateway gọi một phương thức Remote,
 * nó chạy trên context của bên gọi — nơi KHÔNG áp danh sách inject của row — nên truy cập kiểu thuộc tính
 * ném lỗi "cannot get property ... without inject" (đo được trên lab 5461, 17/10/2026).
 * ctx.get là API tra service không cần inject; static inject vẫn giữ nguyên để cordis chờ seam sẵn sàng.
 * Gói plugin-inventory của ta cũng đi đúng đường này.
 */
type HostContext = Context & {
  /** Tra service theo tên, không cần inject. */
  get(name: string): unknown;
  /** Đăng ký nghe event; trả về hàm huỷ đăng ký. */
  on(name: string, listener: () => void): () => void;
};

/**
 * Thao tác tài khoản qua Remote có xác thực, kèm luồng trạng thái sống qua được lần kết nối lại.
 *
 * Peer @galaxy-blackhole/gbh-typert-protocol thuộc seam RPC của kernel (bảng §3b của packages/README.md):
 * lớp này PHẢI kế thừa đúng base class đó để Gateway của kernel discovery được, và ở M3 kernel của ta
 * phơi cùng tên gói. Hai service uỷ quyền được tra qua Context, KHÔNG import gói của chúng.
 */
export class AccountController extends TypertRemoteService {
  /** Seam cần có: nhà cung cấp tài khoản và sổ task đang chạy. */
  static inject = ["deepseekAccount", "agents"];

  /**
   * Đăng ký service accountController và bind cùng key vào Typert Gateway với namespace account.
   * @param ctx - context của plugin.
   */
  constructor(ctx: Context) {
    super(ctx, "accountController", { namespace: "account" });
  }

  /**
   * Context của Host đã hẹp hoá kiểu (API tra service + event).
   * @returns context dùng cho các phương thức bên dưới.
   */
  private host(): HostContext {
    return this.ctx as unknown as HostContext;
  }

  /**
   * Lấy nhà cung cấp tài khoản của kernel, báo lỗi rõ ràng nếu seam vắng.
   * @returns service deepseekAccount.
   * @throws Error khi service chưa sẵn sàng (khác bản gốc ở THÔNG ĐIỆP, không khác hành vi thành công).
   */
  private provider(): AccountProvider {
    const provider = this.host().get("deepseekAccount") as AccountProvider | undefined;
    if (provider === undefined) throw new Error("gbh-host-account-controller: service deepseekAccount chưa sẵn sàng");
    return provider;
  }

  /**
   * Đọc bản chiếu tài khoản an toàn.
   * @returns trạng thái tài khoản và lần đăng nhập gần nhất.
   */
  @Remote
  async getState(): Promise<AccountView> {
    return this.provider().getState();
  }

  /**
   * Truy vấn dữ liệu hồ sơ Platform đã lọc để hiển thị.
   * @param client - danh tính UI đang gọi; Host suy header Platform từ nó.
   * @returns kết quả hồ sơ, hoặc null khi chưa có credential hay grant đã đổi.
   */
  @Remote
  async getProfile(client: AccountClientMetadata): Promise<AccountDetails["profile"] | null> {
    return this.provider().getProfile(client);
  }

  /**
   * Truy vấn số dư ví nạp của Platform.
   * @param client - danh tính UI đang gọi; Host suy header Platform từ nó.
   * @returns kết quả số dư, hoặc null khi chưa có credential hay grant đã đổi.
   */
  @Remote
  async getBalance(client: AccountClientMetadata): Promise<AccountDetails["balance"] | null> {
    return this.provider().getBalance(client);
  }

  /**
   * Truy vấn các đơn thưởng Platform chưa ghi nhận là đã hiển thị.
   * @param client - danh tính UI đang gọi; ngôn ngữ của nó chọn lời nhắn do server soạn.
   * @returns các đơn thưởng kèm tài khoản, hoặc null khi chưa có credential hay grant đã đổi.
   */
  @Remote
  async getUnnotifiedBonuses(client: AccountClientMetadata): Promise<AccountBonusBatch | null> {
    return this.provider().getUnnotifiedBonuses(client);
  }

  /**
   * Ghi nhận một đơn thưởng đã hiển thị cho tài khoản sở hữu nó.
   * @param accountId - tài khoản mà thông báo đã được đọc.
   * @param orderId - đơn thưởng người dùng đã thấy.
   * @param client - danh tính UI đang gọi; Host suy header Platform từ nó.
   * @returns true khi Platform đã ghi nhận; false khi tài khoản vắng hoặc đã đổi.
   */
  @Remote
  async ackBonusNotified(accountId: AccountUserId, orderId: AccountBonusOrderId, client: AccountClientMetadata): Promise<boolean> {
    return this.provider().ackBonusNotified(accountId, orderId, client);
  }

  /**
   * Bắt đầu đăng nhập bằng trình duyệt.
   * @param client - danh tính UI đang gọi, được ghi vào lần thử mới.
   * @param callbackOrigin - origin HTTP loopback mà trình duyệt mở được.
   * @param loginSource - UI khởi phát, dùng để quay về khi trao đổi lỗi.
   * @returns một lần thử mới, hoặc lần thử đang hoạt động.
   */
  @Remote
  async startSignIn(client: AccountClientMetadata, callbackOrigin: string, loginSource: "web" | "desktop"): Promise<AccountView> {
    return this.provider().startSignIn(client, callbackOrigin, loginSource);
  }

  /**
   * Huỷ lần thử cục bộ đã nêu tên.
   * @param attemptId - lần thử cần huỷ.
   * @returns trạng thái đã chốt của việc huỷ hoặc commit.
   */
  @Remote
  async cancelSignIn(attemptId: SignInAttemptId): Promise<AccountView> {
    return this.provider().cancelSignIn(attemptId);
  }

  /**
   * Kiểm task đang chạy có ngữ cảnh request mới nhất trên tuyến account, kể cả tool và lần thử lại.
   * @returns true khi có task như vậy; false khi seam agents vắng hoặc không task nào khớp.
   */
  @Remote
  hasRunningAccountTasks(): boolean {
    const agents = this.host().get("agents") as AgentsProvider | undefined;
    if (agents === undefined) return false;
    return agents.list().some(isRunningAccountTask);
  }

  /**
   * Xoá grant tài khoản cục bộ và thu hồi nền qua Platform, KHÔNG xoá API key.
   * @param client - danh tính UI đang gọi, ghi lại cho các lần thu hồi nền.
   * @returns trạng thái sau khi xoá grant cục bộ.
   */
  @Remote
  async signOut(client: AccountClientMetadata): Promise<AccountView> {
    return this.provider().signOut(client);
  }

  /**
   * Theo dõi credential hết hạn, KHÔNG phát lại thông báo trước đó.
   *
   * Cầu nối event sang async iterator: gom số lần phát vào bộ đếm, đánh thức vòng lặp, và gỡ listener
   * trong finally để không rò đăng ký khi bên gọi huỷ.
   * @param signal - vòng đời của luồng.
   * @returns các thông báo phát ra trong lúc đang đăng ký.
   */
  @Remote({ mode: "stream" })
  async *watchExpiry(signal: AbortSignal): AsyncIterable<"session-expired"> {
    let pending = 0;
    let wake: (() => void) | undefined;
    const stop = this.host().on(SESSION_EXPIRED_EVENT, () => {
      pending += 1;
      wake?.();
    });
    const onAbort = (): void => wake?.();
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      while (!signal.aborted) {
        if (pending > 0) {
          pending -= 1;
          yield "session-expired";
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      stop();
      signal.removeEventListener("abort", onAbort);
    }
  }

  /**
   * Phát luồng bản chiếu tài khoản an toàn.
   * @param signal - vòng đời của luồng.
   * @returns ảnh chụp đầu tiên rồi các thay đổi sau đó.
   */
  @Remote({ mode: "stream" })
  watch(signal: AbortSignal): AsyncIterable<AccountView> {
    return this.provider().watch(signal);
  }
}

export default AccountController;
