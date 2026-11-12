/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu của seam uỷ quyền: từ vựng đi qua dây (thông báo · câu hỏi · kết quả) và hợp đồng của
 *      luồng (flow), phiên một lượt (session) với bề mặt hội thoại (interaction) — viết lại theo hợp
 *      đồng của @deepseek-ai/dsh-authorization.
 */

import type { CredentialKey, CredentialRecord } from "@deepseek-ai/dsh-credentials";

/** Một cách để luồng lấy credential của nó, do CHÍNH luồng đặt tên. */
export interface AuthorizationMethod {
  /** Định danh do luồng sở hữu; được trả lại nguyên văn khi bên gọi chọn cách này. */
  id: string;
  /** Nhãn cho người đọc, dùng trong danh sách chọn. */
  label: string;
}

/** Báo cáo của một luồng đang chạy cho bất kỳ ai theo dõi nó. Không bao giờ mang bí mật. */
export interface AuthorizationNotice {
  /** Điều đang diễn ra, hoặc việc người dùng phải làm tiếp theo. */
  message: string;
  /** Trang người dùng phải mở để tiếp tục. */
  url?: string;
  /** Mã ngắn người dùng phải nhập trên trang đó. */
  code?: string;
}

/** Một lựa chọn mà câu hỏi kiểu `select` đưa ra. */
export interface AuthorizationPromptOption {
  /** Giá trị trả về khi lựa chọn này được chọn. */
  id: string;
  /** Nhãn cho người đọc. */
  label: string;
  /** Ngữ cảnh thêm, chỉ bề mặt có khả năng mới render. */
  description?: string;
}

/**
 * Một câu hỏi mà luồng phải có câu trả lời trước khi đi tiếp. `secret` chỉ khác `text` ở cách
 * trình bày — bề mặt che nó và giữ nó ngoài log — còn `select` trả về `id` của lựa chọn đã chọn.
 */
export type AuthorizationPrompt = {
  /**
   * Huỷ RIÊNG câu hỏi này, để luồng vẫn chạy. Luồng đua một mã gõ tay với callback trình duyệt sẽ
   * abort câu hỏi thua ở đây; còn huỷ CẢ lượt uỷ quyền thì đi qua `signal` của yêu cầu.
   */
  signal?: AbortSignal;
} & (
  | { kind: "text"; message: string; placeholder?: string }
  | { kind: "secret"; message: string; placeholder?: string }
  | { kind: "select"; message: string; options: readonly AuthorizationPromptOption[] }
);

/** Một lượt uỷ quyền đã kết thúc ra sao, theo chính bên gọi nó. */
export type AuthorizationStatus = "authorized" | "cancelled";

/**
 * Một lượt đã kết thúc ra sao, theo người ĐỨNG NGOÀI nhìn vào. Thất bại đến tay bên gọi dưới dạng
 * lỗi ném ra chứ không phải một kết quả, nên `failed` chỉ tồn tại ở đây — trên dòng sự kiện, nơi
 * người theo dõi không khởi xướng lượt đó không có cách nào khác để phân biệt từ chối với sự cố.
 */
export type AuthorizationSettlement = AuthorizationStatus | "failed";

/** Kết quả của MỘT lượt `begin()`. */
export interface AuthorizationOutcome {
  /** `authorized` khi bản ghi đã commit và đã quan sát; `cancelled` khi người dùng hoặc bên gọi rút. */
  status: AuthorizationStatus;
}

/** Một luồng đã đăng ký, như bề mặt nhìn thấy: uỷ quyền cho cái gì và có đang bận không. */
export interface AuthorizationEntry {
  /** Bản ghi credential mà luồng này ghi. */
  key: CredentialKey;
  /** Tên cho người đọc của thứ đang được uỷ quyền. */
  label: string;
  /** Các cách luồng này đưa ra, ưu tiên giảm dần. */
  methods: readonly AuthorizationMethod[];
  /** Có một lượt cho khoá này đang chạy ngay lúc này hay không. */
  inFlight: boolean;
}

/**
 * Thứ một luồng đang chạy được cấp để nói chuyện với người dùng. Mọi thành viên đều thuộc MỘT
 * lượt: luồng không biết và cũng không chọn bề mặt nào đang nghe.
 */
export interface AuthorizationSession {
  /** Id cách thức mà bên gọi đã chọn, luôn là một cách luồng này đã khai. */
  readonly method: string;
  /** Bị abort khi bên gọi rút hoặc khi `cancel()` được gọi cho khoá này. */
  readonly signal: AbortSignal;
  /**
   * Commit một bản ghi, đồng thời từ chối các lượt đã bị huỷ.
   * Nhận: `record` — credential thuộc sở hữu của luồng này.
   * Trả: sau khi kho credential đã commit bản ghi.
   */
  commit(record: CredentialRecord): Promise<void>;
  /**
   * Báo tiến độ, hoặc nói cho người dùng biết phải làm gì tiếp.
   * Nhận: `notice` — thông điệp, kèm trang hoặc mã mà nó nhắc tới.
   * Trả: không (bắn-rồi-quên: bề mặt không render được thông báo cũng không được làm luồng khựng).
   */
  notify(notice: AuthorizationNotice): void;
  /**
   * Hỏi người dùng một câu mà luồng không tự trả lời được.
   * Nhận: `prompt` — hỏi gì và trình bày ra sao.
   * Trả: chữ người dùng gõ, hoặc `id` của lựa chọn đã chọn.
   */
  prompt(prompt: AuthorizationPrompt): Promise<string>;
}

/**
 * Hiểu biết của MỘT plugin về cách lấy MỘT credential. Luồng sở hữu việc ghi: `run()` phân giải
 * nghĩa là bản ghi cho `key` đã được commit qua `ctx.credentials` trong chính lượt đó, và seam
 * xác nhận điều đó (commit quan sát được trong lượt, còn nguyên sau lượt) trước khi báo thành công.
 */
export interface AuthorizationFlow {
  /** Bản ghi credential mà luồng này ghi. Scope của nó gọi tên plugin sở hữu. */
  readonly key: CredentialKey;
  /** Tên cho người dùng của thứ đang được uỷ quyền. */
  readonly label: string;
  /**
   * Các cách đưa ra, ưu tiên nhất đứng đầu; bên gọi không nêu cách nào thì nhận cách đầu tiên.
   * Kiểu buộc KHÔNG RỖNG vì luồng không có gì để chạy là luồng không thể bắt đầu.
   */
  readonly methods: readonly [AuthorizationMethod, ...AuthorizationMethod[]];
  /**
   * Chạy MỘT lượt để lấy và commit credential.
   * Nhận: `session` — cách thức đã chọn, tín hiệu huỷ, và các callback hội thoại.
   * Trả: khi bản ghi đã commit.
   */
  run(session: AuthorizationSession): Promise<void>;
}

/**
 * Nửa BỀ MẶT của một lượt. Được cấp kèm yêu cầu chứ không đăng ký trước, vì bên khởi xướng uỷ
 * quyền chính là bên nói được với người dùng về nó: câu hỏi tới đúng trang đã hỏi, còn bên gọi
 * không có bề mặt thì cấp một interaction biết từ chối.
 */
export interface AuthorizationInteraction {
  /**
   * Render một thông báo từ luồng đang chạy.
   * Nhận: `notice` — thông điệp, kèm trang hoặc mã mà nó nhắc tới.
   * Trả: không.
   */
  notify(notice: AuthorizationNotice): void;
  /**
   * Đặt một câu hỏi cho người dùng rồi chờ.
   * Nhận: `prompt` — hỏi gì và trình bày ra sao.
   * Trả: chữ đã gõ, hoặc `id` của lựa chọn đã chọn.
   */
  prompt(prompt: AuthorizationPrompt): Promise<string>;
}

/** Một yêu cầu uỷ quyền cho một khoá. */
export interface AuthorizationRequest {
  /** Bản ghi credential cần uỷ quyền; phải có một luồng đã đăng ký cho nó. */
  key: CredentialKey;
  /** Chạy cách nào trong các cách của luồng. Bỏ trống thì dùng cách đầu tiên. */
  method?: string;
  /** Bề mặt sẽ render thông báo và câu hỏi của lượt này. */
  interaction: AuthorizationInteraction;
  /** Rút TOÀN BỘ lượt. */
  signal?: AbortSignal;
}
