/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của seam workflow: kiểu yêu cầu/lượt chạy/kết quả mà một workflow engine
 *      tiêu thụ và sinh ra, cùng hình dạng thân của sáu sự kiện `workflow/*`.
 *      CHỈ KIỂU (cộng hàm đóng dấu id) — bản gốc cũng vậy, để nửa browser dùng được.
 */

import type { Branded } from "@deepseek-ai/dsh-brand";
import type { SessionId } from "@deepseek-ai/dsh-session/types";

/** Định danh MỘT lượt chạy workflow. */
export type WorkflowRunId = Branded<"WorkflowRunId">;

/**
 * Đóng dấu một chuỗi thành {@link WorkflowRunId}.
 * Nhận: chuỗi id thô (engine tự sinh UUID; test có thể truyền fixture).
 * Trả: CHÍNH chuỗi đó, mang thêm dấu kiểu — không bọc object, không đổi giá trị.
 */
export function WorkflowRunId(id: string): WorkflowRunId {
  return id as WorkflowRunId;
}

/**
 * Một pha khai trong `meta.phases` của script — CHỈ là từ vựng tiến độ: pha gom nhóm agent
 * trong mắt người quan sát/UI, nó KHÔNG áp cấu trúc thi hành nào lên script.
 */
export interface WorkflowPhase {
  /** Tiêu đề pha; lời gọi `phase()` khớp với nó theo chuỗi NGUYÊN VĂN. */
  title: string;
  /** Mô tả một dòng (tuỳ chọn) về việc pha này làm gì. */
  detail?: string;
  /** Provider mà pha này dự kiến dùng (tuỳ chọn, chỉ để tham khảo). */
  provider?: string;
  /** Model mà pha này dự kiến dùng (tuỳ chọn, chỉ để tham khảo). */
  model?: string;
}

/**
 * Khối danh tính của script: dữ liệu JSON thuần đi KÈM thân script (tầng tool chở nó ở tham số
 * `meta`), và được engine kiểm trước khi thân script chạy. `name`/`description` bắt buộc.
 */
export interface WorkflowMeta {
  /** Tên workflow ngắn kiểu kebab-case (dùng để hiển thị và làm khoá lưu trữ). */
  name: string;
  /** Mô tả một dòng về việc workflow này làm gì. */
  description: string;
  /** Gợi ý (tuỳ chọn) về lúc nên dùng workflow này — hiện trong danh sách. */
  whenToUse?: string;
  /** Khai báo pha (tuỳ chọn) để các lời gọi `phase()` khớp vào. */
  phases?: WorkflowPhase[];
}

/**
 * Vì sao một lượt chạy kết thúc. TẬP ĐÓNG do engine sở hữu, bên tiêu thụ được phép xét cạn:
 * `completed` = script chạy tới `return` cuối; `cancelled` = lượt chạy bị huỷ (người gọi gọi
 * `cancel()` hoặc tín hiệu huỷ); `error` = script ném, một `WorkflowError` fatal lan ra, hoặc
 * kết quả không hiện thực hoá được.
 */
export type WorkflowStopReason = "completed" | "cancelled" | "error";

/**
 * Kết quả mà một lượt chạy workflow đang sống hiện thực hoá. `value` là giá trị trả về đã hiện
 * thực hoá của script (dữ liệu JSON thuần ở realm host; `null` khi script trả `undefined`) —
 * chỉ có nghĩa khi `stopReason` là `completed`. Lý do khác `completed` mang hỏng hóc ở `error`.
 */
export interface WorkflowResult {
  /** Giá trị trả về của script (dữ liệu JSON host; `null` khi không trả gì). */
  value: unknown;
  /** Vì sao lượt chạy kết thúc. */
  stopReason: WorkflowStopReason;
  /** Thông điệp hỏng hóc (có mặt KHI VÀ CHỈ KHI `stopReason` khác `completed`). */
  error?: string;
  /**
   * Số lời gọi `agent()` mà lượt chạy đã nhận trong cả vòng đời. Khi kết thúc êm, đây là số đếm
   * phía script (kể cả lời gọi còn xếp hàng chờ chỗ đồng thời); trên đường bị chấm dứt (huỷ hoặc
   * tiến trình hỏng và chết) nó thoái hoá thành số đếm phía host — lời gọi còn xếp hàng trong
   * script đã bị chấm dứt thì không thể biết.
   */
  agentsStarted: number;
}

/**
 * Danh tính một lượt chạy: dữ liệu BẤT BIẾN đi kèm MỌI sự kiện `workflow/*` — người nghe nhận
 * ảnh chụp này, KHÔNG BAO GIỜ nhận chính lượt chạy đang sống (để không điều khiển được nó).
 */
export interface WorkflowRunInfo {
  /** Id của lượt chạy. */
  id: WorkflowRunId;
  /** Khối meta đã được kiểm của lượt chạy. */
  meta: WorkflowMeta;
}

/** Danh tính MỘT lời gọi `agent()` trong lượt chạy — thân của sự kiện `workflow/agent-start`. */
export interface WorkflowAgentInfo {
  /** Số thứ tự 1-based của lời gọi `agent()` này trong lượt chạy. */
  seq: number;
  /** Nhãn hiển thị (tuỳ chọn `label`, hoặc một đoạn của prompt). */
  label: string;
  /** Pha mà agent này thuộc về (tuỳ chọn `phase`, nếu không thì tiêu đề `phase()` hiện hành). */
  phase?: string;
  /** Id của agent con trên seam subagent. */
  childId: SessionId;
}

/** Cách MỘT lời gọi `agent()` kết thúc: kết quả sạch, agent con hỏng (script thấy `null`), hoặc lượt chạy bị huỷ. */
export type WorkflowAgentOutcome = "completed" | "failed" | "cancelled";

/** Kết thúc của MỘT lời gọi `agent()` — thân của sự kiện `workflow/agent-end`. */
export interface WorkflowAgentEndInfo extends WorkflowAgentInfo {
  /** Cách lời gọi kết thúc. */
  outcome: WorkflowAgentOutcome;
}

/**
 * Kết cục của một lượt chạy ĐÃ kết thúc, dưới dạng dữ liệu sự kiện (thân của `workflow/end`):
 * chính {@link WorkflowResult} nhưng BỎ `value` — người nghe kết cục không được nhận bí danh
 * của giá trị kết quả mà người gọi đang giữ (ai cần giá trị thì giữ lượt chạy và chờ `result`).
 */
export interface WorkflowResultInfo {
  /** Vì sao lượt chạy kết thúc. */
  stopReason: WorkflowStopReason;
  /** Thông điệp hỏng hóc (có mặt KHI VÀ CHỈ KHI `stopReason` khác `completed`). */
  error?: string;
  /** Số lời gọi `agent()` mà lượt chạy đã nhận (xem {@link WorkflowResult.agentsStarted}). */
  agentsStarted: number;
}

/** TẬP ĐẦY ĐỦ tên sự kiện `workflow/*` mà {@link WorkflowEngine.emitWorkflowEvent} phát đi. */
export type WorkflowEventName =
  | "workflow/start"
  | "workflow/phase"
  | "workflow/log"
  | "workflow/agent-start"
  | "workflow/agent-end"
  | "workflow/end";

/**
 * Mã hỏng workflow FATAL, định tuyến được bằng máy: lỗi parse/meta/đối số/schema, chạm trần tài
 * nguyên, hỏng hạ tầng subagent, giá trị ở biên không tuần tự hoá được, và huỷ. Một agent con hỏng
 * thông thường thì mục đó thành `null` — KHÔNG thuộc tập mã fatal này.
 */
export type WorkflowErrorCode =
  | "SCRIPT_PARSE"
  | "META_INVALID"
  | "INVALID_ARGUMENT"
  | "UNSUPPORTED_OPTION"
  | "UNSUPPORTED_SCHEMA"
  | "AGENT_CAP"
  | "ITEM_CAP"
  | "AGENT_START"
  | "AGENT_RESULT"
  | "RESULT_UNSERIALIZABLE"
  | "CANCELLED";
