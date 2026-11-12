/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng dây của row approval: id yêu cầu có thương hiệu, từ vựng kết quả ĐÓNG, hình dạng
 *      yêu cầu duyệt, cấu hình plugin, và ba phép khai kiểu (sự kiện phiên · nguồn tin nhắn
 *      `user-approval` · waterfall `approval/request`) — tệp này KHÔNG import lớp service
 */

import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Branded } from "@deepseek-ai/dsh-brand";
import type { ContextFormed, ToolCallId } from "@deepseek-ai/dsh-llm";
import type { Scoped } from "@deepseek-ai/dsh-scope";

/**
 * Danh tính một cặp sự kiện kiểm toán `approval/asked` + `approval/decided`.
 * Do service cấp (một id mới cho MỖI lượt gọi {@link ApprovalService.request}).
 *
 * Dùng `Branded` của `@deepseek-ai/dsh-brand` (peer, CHỈ KIỂU) chứ KHÔNG tự khai `unique symbol` tại chỗ:
 * bản gốc khai `Branded<'ApprovalRequestId'>`, và hai `unique symbol` khác nhau thì KHÔNG gán được cho nhau ⇒
 * khi cả hai bên cùng khai một khoá `SessionEventMap`/`Context`, tsc báo **TS2717** dù in ra y hệt.
 * Xem ADR 0009 (một chủ sở hữu cho brand).
 */
export type ApprovalRequestId = Branded<"ApprovalRequestId">;

/**
 * Đóng thương hiệu cho một chuỗi id thô.
 * Nhận: `id` — chuỗi id thô do service sinh.
 * Trả: chính chuỗi đó, mang thương hiệu {@link ApprovalRequestId}.
 */
export function ApprovalRequestId(id: string): ApprovalRequestId {
  return id as ApprovalRequestId;
}

/**
 * Từ vựng kết quả ĐÓNG của một yêu cầu duyệt: cấp MỘT LẦN, bị từ chối, bị rút, hoặc không có
 * người trả lời. Người gọi coi `unavailable` là ĐÓNG (fail closed).
 */
export type ApprovalOutcome = "allowed-once" | "rejected" | "cancelled" | "unavailable";

/** Mọi {@link ApprovalOutcome}, dùng để chuẩn hoá giá trị trả về của người trả lời lúc chạy. */
export const OUTCOMES: readonly ApprovalOutcome[] = ["allowed-once", "rejected", "cancelled", "unavailable"];

/**
 * Chính sách duyệt của một phiên — điều xảy ra với một yêu cầu TRƯỚC khi bất kỳ người trả lời
 * tương tác nào nhìn thấy nó:
 *
 * - `'ask'` (mặc định) — chuyển cho chuỗi người trả lời đã lắp; không có ai thì rơi về
 *   `'unavailable'` (đóng).
 * - `'never'` — không hỏi ai: mọi yêu cầu trả `'rejected'` tất định. Lập trường headless
 *   nghiêm ngặt (CI, lượt chạy không người trông).
 */
export type ApprovalPolicy = "ask" | "never";

/**
 * Một yêu cầu duyệt CHỈ-ĐỌC trong cùng tiến trình. `callId` trỏ tới một lời gọi tool đã trình
 * bày, nên tham số không bị nhân đôi ở đây.
 */
export interface ApprovalRequestEvent {
  /** Danh tính agent được chiếu sang Context phía Client khi truyền. */
  readonly agent: Agent;
  /** Tool mà thao tác của nó cần một quyết định. */
  readonly toolName: string;
  /** Lời gọi tool chính xác đang được quyết, khi có. */
  readonly callId?: ToolCallId;
  /** Lý do người hỏi đưa ra, dạng người đọc được. */
  readonly reason?: string;
  /** Chỉ để trình bày theo ngôn ngữ; KHÔNG BAO GIỜ được ghi vào sự kiện kiểm toán. */
  readonly displayReason?: { readonly en: string; readonly [locale: string]: string };
  /** Vòng đời huỷ của yêu cầu đang chờ. */
  readonly signal?: AbortSignal;
}

/**
 * Yêu cầu duyệt mà {@link ApprovalService.request} nhận: sự kiện công khai cộng danh tính agent
 * (agent định tuyến câu hỏi và nhận cặp sự kiện kiểm toán trên nhật ký phiên của nó).
 */
export interface ApprovalRequest extends ApprovalRequestEvent {
  /** Agent mà câu hỏi được hỏi thay mặt; nhật ký phiên của nó nhận cặp kiểm toán. */
  readonly agent: Agent;
}

/** Cấu hình plugin. Mọi trường tuỳ chọn — `static Config` cấp giá trị mặc định. */
export interface Config {
  /**
   * {@link ApprovalPolicy} mặc định của deployment cho phiên KHÔNG có ghi đè `approval/policy`
   * — `'ask'` chuyển cho người trả lời đã lắp (đóng khi không có ai); `'never'` tự từ chối mọi
   * yêu cầu mà không hỏi ai (lập trường CI/không người trông, tất định).
   */
  readonly policy?: ApprovalPolicy;
}

declare module "@deepseek-ai/dsh-session/types" {
  interface SessionEventMap {
    /**
     * Một câu hỏi duyệt đã được đặt cho chuỗi người trả lời — kiểm toán CHỈ-GHI-LOG (như `hook/*`;
     * KHÔNG phải sự kiện bề mặt, không mang `surfaceOp`). `id` ghép nó với `approval/decided`
     * luôn theo sau; `toolName` là tool được hỏi, `callId` là lời gọi chính xác khi người hỏi có,
     * `reason` là lời giải thích của người hỏi.
     */
    "approval/asked": {
      id: ApprovalRequestId;
      toolName: string;
      callId?: ToolCallId;
      reason?: string;
    };
    /**
     * Kết quả của một `approval/asked` trước đó (cùng `id`) — kiểm toán CHỈ-GHI-LOG. Đúng MỘT
     * sự kiện cho mỗi lần hỏi, ghi khi biết kết quả: một quyết định, một lần huỷ, hoặc
     * `'unavailable'` do đóng.
     */
    "approval/decided": {
      id: ApprovalRequestId;
      outcome: ApprovalOutcome;
    };
    /**
     * Chính sách duyệt của phiên đã được chuyển — chỉ ghi log, bền, phát lại được, KHÔNG BAO GIỜ
     * vào bản ghi hội thoại của model (model học chính sách từ ảnh chụp ngữ cảnh lúc chạy và từ
     * thông báo chuyển chính sách). Sự kiện CUỐI CÙNG như vậy là ghi đè của phiên.
     * `source: 'delegation'` đánh dấu ghi đè được gieo vào một phiên con; vắng `source` là lượt
     * chuyển lúc chạy.
     */
    "approval/policy": {
      policy: ApprovalPolicy;
      /** Đánh dấu ghi đè được gieo vào phiên con lúc uỷ nhiệm. */
      source?: "delegation";
    };
  }
}

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /** Thông báo chuyển chính sách duyệt do NGƯỜI DÙNG đổi, đẩy vào lượt kế tiếp của model. */
    "user-approval": { kind: "user-approval" } & ContextFormed;
  }
}

declare module "@deepseek-ai/cordis" {
  interface Events {
    /**
     * Hỏi các người trả lời đã lắp để quyết MỘT yêu cầu. Trả một kết quả để nhận yêu cầu, hoặc
     * gọi `next()` để chuyển tiếp. Phân phát có lọc phạm vi (`@deepseek-ai/dsh-scope`): người
     * nghe gắn phạm vi agent chỉ nhận yêu cầu của agent đó.
     * @param req - yêu cầu đang chờ quyết.
     * @param next - phần còn lại của chuỗi; gọi để chuyển tiếp.
     * @returns kết quả đóng cho yêu cầu này.
     * @mode waterfall
     */
    "approval/request"(
      this: Scoped<Agent>,
      req: ApprovalRequestEvent,
      next: () => Promise<ApprovalOutcome>,
    ): Promise<ApprovalOutcome>;
  }
}
