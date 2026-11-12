/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu THUẦN của miền plan: nơi DUY NHẤT khai khoá chiếu `plan` (PlanUnitState/PlanProjection)
 *      trên bảng của @deepseek-ai/dsh-session-projection, không kéo giá trị host-side nào.
 */

import type { CommandId } from "@deepseek-ai/dsh-commands/brand";

/**
 * Giá trị wire của chiếu `plan`. `active` là trạng thái đã ghi đang có hiệu lực
 * (lần `plan/mode` cuối, không active trước lần đầu); `pending` đúng khi một
 * lựa chọn `/plan` đã ghi nhắm tới trạng thái KHÁC `active`, chưa thất bại qua
 * `command/done` đi kèm, và chưa có `plan/mode` nào sau đó ghi nhận trạng thái ấy.
 * Vắng năng lực (plan-mode không được ghép) là VẮNG khoá, không bao giờ là một giá trị.
 */
export interface PlanProjection {
  /** Plan mode đã ghi đang có hiệu lực. */
  active: boolean;
  /** Có lựa chọn đang chờ bước kế tiếp được chấp nhận. */
  pending: boolean;
}

/** Trạng thái host dùng để suy ra {@link PlanProjection}. */
export interface PlanUnitState {
  /** Plan mode đã ghi trong log. */
  active: boolean;
  /** Trạng thái đích của lựa chọn; null khi không có lựa chọn nào đang chờ. */
  wanted: boolean | null;
  /** Lệnh plan gần nhất đang chờ sự kiện kết toán đi kèm. */
  running: {
    /** Id lệnh do executor cấp. */
    commandId: CommandId;
    /** Trạng thái người dùng chọn cho lệnh này. */
    wanted: boolean;
  } | null;
  /** Trạng thái active do `request/header` gần nhất ghi lại, hoặc null. */
  activeAtLastHeader: boolean | null;
}

declare module "@deepseek-ai/dsh-session-projection/types" {
  interface SessionProjectionStateMap {
    /** Trạng thái gấp của plan-mode phía host. */
    plan: PlanUnitState;
  }

  interface SessionProjectionMap {
    /** Trạng thái cộng tác plan gấp từ vòng đời lệnh plan và các sự kiện `plan/mode`. */
    plan: PlanProjection;
  }
}
