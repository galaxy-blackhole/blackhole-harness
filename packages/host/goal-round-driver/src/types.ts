/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vật thể trạng thái và KIỂU của bộ điều khiển vòng goal: một lượt đặt chỗ (reservation), trạng thái
 *      sống theo từng agent, và mặt cắt HEP của seam subagent mà driver chờ (kế thừa kiểu kernel, không bọc lại).
 */

import type { Agent } from "@deepseek-ai/dsh-agent";
import type { GoalView } from "@galaxy-blackhole/gbh-goal";
import type { ContentBlock, MessageId, MessageSource, UserMessage } from "@deepseek-ai/dsh-llm";

/**
 * Nguồn message của MỘT vòng goal tự động — KHAI TẠI ĐÂY (ADR 000d, 08/11/2026 dev-1, Lead chỉ định).
 *
 * Bản gốc khai biến thể này bằng augmentation `declare module "@deepseek-ai/dsh-llm" { interface MessageSourceMap
 * { goal: GoalMessageSource } }` NGAY TRONG gói goal; bản port GBH không tái khai augmentation nên hợp
 * `MessageSource` của kernel KHÔNG có `goal` ⇒ `Extract<MessageSource, { kind: "goal" }>` co lại thành `never`
 * (kéo theo 16 lỗi typecheck). Khai mặt cấu trúc CÙNG HÌNH DẠNG với khai báo gốc
 * (`kind`/`goalId`/`revision`/`round`) để phép thu hẹp có kiểu thật; biên giao với kernel vẫn ép kiểu tại chỗ.
 */
export interface GoalRoundSource {
  /** Dấu hiệu nguồn do driver gắn cho vòng tự động. */
  readonly kind: "goal";
  /** Goal mà vòng này thuộc về. */
  readonly goalId: GoalView["id"];
  /** Revision của goal tại lúc nhận vòng. */
  readonly revision: number;
  /** Số vòng tự động đã nhận (dương; vòng 0 là message người tạo goal). */
  readonly round: number;
}

/** Một message người dùng CHẮC CHẮN mang nguồn vòng goal — kết quả của phép tìm có thu hẹp kiểu. */
export type GoalRoundMessage = Omit<UserMessage, "source"> & { readonly source: GoalRoundSource };

/** Pha của một lượt đặt chỗ: đã xếp hàng · đã được nhận vào bước · đã vào phiên. */
export type AttemptPhase = "queued" | "claimed" | "admitted";

/**
 * MỘT lượt vòng goal driver đã đặt chỗ cho đúng một bản goal/revision.
 * `content` giữ mảng GỐC đã dựng nên message (message nhận bản sao sâu), để phép so `isDeepStrictEqual`
 * so được với `content` mà inbox/sự kiện phiên trả lại.
 */
export interface GoalAttempt {
  /** Danh tính goal lúc đặt chỗ. */
  readonly goalId: GoalView["id"];
  /** Revision goal lúc đặt chỗ. */
  readonly revision: number;
  /** Số vòng đã đặt chỗ (số dương). */
  readonly round: number;
  /** Danh tính message đã đưa vào inbox. */
  readonly messageId: MessageId;
  /** Nội dung GỐC đã dựng nên message (dùng cho phép so đầy đủ). */
  readonly content: readonly ContentBlock[];
  /** Pha hiện tại của lượt đặt chỗ. */
  phase: AttemptPhase;
  /** Lượt đã bị bỏ (huỷ lượt hoặc bị đẩy khỏi inbox). */
  cancelled: boolean;
  /** Lượt đã thành CŨ (có prompt tranh chấp hoặc hàng rào bước đã bỏ nó). */
  stale: boolean;
}

/** Trạng thái sống của driver cho MỘT agent, khoá theo ĐÚNG danh tính agent. */
export interface AgentState {
  /** Agent sở hữu trạng thái này. */
  readonly agent: Agent;
  /** Lượt đã đặt chỗ, hoặc `undefined` khi không có. */
  attempt: GoalAttempt | undefined;
  /** Có prompt KHÁC đang chờ ở ranh giới lượt (không phải vòng của driver). */
  competingQueued: boolean;
  /** Có thay đổi goal chưa được ghi bền ⇒ phải checkpoint trước khi lái tiếp. */
  needsCheckpoint: boolean;
  /** Có yêu cầu lái đang chờ vòng lặp xử lý. */
  requested: boolean;
  /** Vòng lặp lái đang chạy (đã hợp nhất mọi yêu cầu), hoặc `undefined`. */
  run: Promise<void> | undefined;
  /** Plugin đang dỡ: mọi kích thích mới bị bỏ. */
  stopping: boolean;
}

/**
 * Mặt cắt HEP của seam subagent mà driver chờ — CHỈ một phương thức, đúng hình dạng
 * `ctx.get("subagents")` của kernel (dịch vụ này là tuỳ chọn nên có thể vắng mặt).
 */
export interface SubagentSeam {
  /**
   * Chờ mọi hậu duệ đang tiến triển của MỘT agent, KHÔNG huỷ chúng.
   * Nhận: `parent` — đúng agent cha đang được quan sát.
   * Trả: promise hoàn tất khi việc của hậu duệ đã khép lại.
   */
  waitForChildren(parent: Agent): Promise<boolean>;
}
