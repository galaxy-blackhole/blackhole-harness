/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Seam CẤU TRÚC cho tool-jobs: Context cordis, sổ jobs, sổ công cụ, systemPrompt, agent và thông điệp — khai theo hình dạng thay vì augment module (ADR 000d); mọi kiểu bám đúng bundle gốc @deepseek-ai/dsh-tool-jobs.
 */

import type { JobEvent, JobRead, JobView } from "@galaxy-blackhole/gbh-jobs";
import type { ToolDefinition, ToolExecution } from "@galaxy-blackhole/gbh-host-tools";

/** Ảnh chiếu job an toàn cho mô hình — NGUYÊN VĂN hình dạng PublicJobSnapshot của bản gốc. Nhận: không. Trả: hình dạng object mà ba tool công bố. */
export interface PublicJob {
  /** Id do sổ cấp. */
  readonly id: string;
  /** Loại nhà sản xuất (bash, …). */
  readonly kind: string;
  /** Nhãn một dòng do nhà sản xuất cấp. */
  readonly label: string;
  /** Trạng thái vòng đời. */
  readonly status: JobView["status"];
  /** Tiến trình khi đang chạy, lý do kết thúc khi đã dừng. */
  readonly detail?: string;
  /** Mốc đăng ký (epoch ms). */
  readonly startedAt: number;
  /** Mốc dừng (epoch ms), vắng khi còn chạy. */
  readonly finishedAt?: number;
}

/** Giá trị canonical của job_output. Nhận: không. Trả: hình dạng { text, job } mà schema đầu ra ép. */
export interface JobOutputValue {
  /** Phần đọc được kể từ con trỏ mô hình. */
  readonly text: string;
  /** Ảnh chiếu công khai sau lần đọc. */
  readonly job: PublicJob;
}

/** Giá trị canonical của job_kill. Nhận: không. Trả: hình dạng { outcome, job } mà schema đầu ra ép. */
export interface JobKillValue {
  /** cancellation-requested khi còn sống, already-finished khi đã dừng. */
  readonly outcome: "cancellation-requested" | "already-finished";
  /** Ảnh chiếu công khai sau lời gọi. */
  readonly job: PublicJob;
}

/** Khối nội dung tối thiểu mà plugin đọc/ghi — NGUYÊN VĂN hình dạng ContentBlock phía văn bản. Nhận: không. Trả: hình dạng block văn bản. */
export interface ContentBlockLike {
  /** Loại block. */
  readonly type: string;
  /** Văn bản của block (khi có). */
  readonly text?: string;
}

/** Nguồn thông điệp tối thiểu — tool-jobs khai kind/form/summary theo cấu trúc. Nhận: không. Trả: hình dạng nguồn thông điệp. */
export interface MessageSourceLike {
  /** Loại nhà sản xuất (user, tool-jobs, …). */
  readonly kind: string;
  /** Dạng ngữ cảnh (notice, …). */
  readonly form?: string;
  /** Tài khoản một dòng cho dạng notice. */
  readonly summary?: string;
}

/** Thông điệp người dùng do plugin dựng — NGUYÊN VĂN hình dạng UserMessage của kernel. Nhận: không. Trả: hình dạng thông điệp đã đóng băng. */
export interface UserMessageLike {
  /** Danh tính ổn định (UUID). */
  readonly id: string;
  /** Vai trò luôn là user. */
  readonly role: "user";
  /** Các khối nội dung. */
  readonly content: readonly ContentBlockLike[];
  /** Nguồn sản xuất. */
  readonly source: MessageSourceLike;
}

/** Agent tối thiểu mà plugin chạm tới — đúng ba thành viên bản gốc dùng. Nhận: không. Trả: hình dạng agent. */
export interface AgentLike {
  /** Id phiên của agent. */
  readonly id: string;
  /** Trạng thái sống. */
  readonly status: "idle" | "running";
  /**
   * Mở một lượt mới cho thông điệp.
   * Nhận: message — thông điệp người dùng đã dựng.
   * Trả: không.
   */
  followup(message: UserMessageLike): void;
  /**
   * Chèn thông điệp vào bước kế tiếp.
   * Nhận: message — thông điệp người dùng đã dựng.
   * Trả: không.
   */
  inject(message: UserMessageLike): void;
}

/** Sổ agent để tra chủ sở hữu job — chỉ dùng get. Nhận: không. Trả: hình dạng ctx.get("agents"). */
export interface AgentRegistryLike {
  /**
   * Tra agent theo id phiên.
   * Nhận: id — id phiên.
   * Trả: agent, hoặc undefined khi không có.
   */
  get(id: string): AgentLike | undefined;
}

/** Bộ lọc đăng ký sự kiện job — bản gốc dùng { owners: "scope" }. Nhận: không. Trả: hình dạng bộ lọc. */
export interface JobEventFilterLike {
  /** Phạm vi chủ sở hữu. */
  readonly owners: "scope";
}

/** Dòng sự kiện job tối thiểu mà plugin đọc — chính là JobEvent của dsh-jobs. Nhận: không. Trả: hình dạng sự kiện. */
export type JobEventLike = JobEvent;

/** Id job có thương hiệu — chính JobId của dsh-jobs. Nhận: không. Trả: kiểu chuỗi đã đánh dấu. */
export type JobIdLike = ReturnType<typeof import("@galaxy-blackhole/gbh-jobs").JobId>;

/** Sổ jobs tối thiểu mà plugin gọi — đúng bảy thành viên bản gốc dùng. Nhận: không. Trả: hình dạng ctx.jobs. */
export interface JobsLike {
  /**
   * Gắn controller theo hiệu ứng.
   * Nhận: name — nhãn chẩn đoán.
   * Trả: hàm gỡ controller.
   */
  attachController(name: string): () => void;
  /** Dòng sự kiện vòng đời + đầu ra. */
  readonly events: {
    /**
     * Đăng ký nghe sự kiện.
     * Nhận: filter — phạm vi chủ sở hữu; listener — hàm nhận sự kiện.
     * Trả: hàm gỡ đăng ký.
     */
    subscribe(filter: JobEventFilterLike, listener: (event: JobEventLike) => void): () => void;
  };
  /**
   * Liệt kê job người gọi thấy.
   * Nhận: caller — id phiên đọc.
   * Trả: ảnh chiếu mới.
   */
  list(caller?: string): readonly JobView[];
  /**
   * Chiếu một job.
   * Nhận: id — job cần đọc; caller — id phiên đọc.
   * Trả: ảnh chiếu mới.
   */
  get(id: JobIdLike, caller?: string): JobView;
  /**
   * Đọc phần đã tích luỹ kể từ con trỏ mô hình.
   * Nhận: id — job cần đọc; caller — id phiên đọc.
   * Trả: phần đọc được + ảnh chiếu sau đọc.
   */
  read(id: JobIdLike, caller?: string): JobRead;
  /**
   * Yêu cầu huỷ.
   * Nhận: id — job cần huỷ; caller — id phiên huỷ; reason — lý do chuyển tiếp.
   * Trả: requested khi còn sống, already-finished khi đã dừng.
   */
  kill(id: JobIdLike, caller?: string, reason?: string): "requested" | "already-finished";
  /**
   * Chờ job dừng hoặc hết hạn.
   * Nhận: id — job cần chờ; timeoutMs — trần chờ; caller — id phiên chờ; signal — huỷ lượt chờ.
   * Trả: ảnh chiếu lúc dừng/hết hạn.
   */
  wait(id: JobIdLike, timeoutMs: number, caller?: string, signal?: AbortSignal): Promise<JobView>;
}

/** Mục system prompt mà plugin đăng ký. Nhận: không. Trả: hình dạng PromptSection. */
export interface PromptSection {
  /** Tên mục. */
  readonly name: string;
  /** Thứ tự sắp xếp. */
  readonly order: number;
  /** Văn bản hướng mô hình. */
  readonly text: string;
}

/** Payload sự kiện agent/inbox/claimed mà plugin đọc. Nhận: không. Trả: hình dạng payload. */
export interface InboxClaimedPayload {
  /** Agent vừa nhận thông điệp. */
  readonly agent: AgentLike;
  /** Thông điệp vừa được nhận. */
  readonly message: {
    /** Nguồn thông điệp (chỉ đọc source.kind). */
    readonly source: { readonly kind: string };
  };
}

/** Context cordis tối thiểu — KHAI THEO CẤU TRÚC, không augment Context (ADR 000d). Nhận: không. Trả: hình dạng context plugin dùng. */
export interface ToolJobsContext {
  /** Sổ jobs. */
  readonly jobs: JobsLike;
  /** Sổ công cụ. */
  readonly tools: {
    /**
     * Đăng ký một định nghĩa công cụ.
     * Nhận: definition — định nghĩa đã dựng bằng defineTool.
     * Trả: hàm gỡ đăng ký.
     */
    register(definition: ToolDefinition): () => void;
  };
  /** Sổ system prompt. */
  readonly systemPrompt: {
    /**
     * Đăng ký một mục prompt.
     * Nhận: section — mục cần đăng ký.
     * Trả: hàm gỡ đăng ký.
     */
    section(section: PromptSection): () => void;
    /**
     * Tra thứ tự chuẩn của một vị trí mục.
     * Nhận: name — tên vị trí (TOOL_JOBS).
     * Trả: số thứ tự.
     */
    getSectionOrder(name: string): number;
  };
  /**
   * Tra một service theo tên.
   * Nhận: name — tên service (agents).
   * Trả: service, hoặc undefined.
   */
  get(name: string): unknown;
  /**
   * Nghe sự kiện agent/inbox/claimed.
   * Nhận: event — tên sự kiện; listener — hàm nhận payload.
   * Trả: không dùng.
   */
  on(event: "agent/inbox/claimed", listener: (payload: InboxClaimedPayload) => void): unknown;
  /**
   * Nghe waterfall tools/pre-execute.
   * Nhận: event — tên sự kiện; listener — hàm nhận exec + next; options — tuỳ chọn { prepend }.
   * Trả: không dùng.
   */
  on(
    event: "tools/pre-execute",
    listener: (exec: ToolExecution, next: () => Promise<unknown>) => unknown,
    options?: { readonly prepend?: boolean },
  ): unknown;
}
