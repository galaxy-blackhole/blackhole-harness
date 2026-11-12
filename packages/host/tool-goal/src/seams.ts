/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc SEAM CẤU TRÚC tại biên cho row tool-goal (ADR 000d, 08/11/2026 dev-1): bản port của các gói GBH
 *      KHÔNG tái khai augmentation service trên Context của bản gốc, nên mọi service được đọc qua ctx.get()
 *      với mặt cấu trúc CHỈ gồm phần row này dùng; thiếu seam là lỗi cấu hình nên ném NGAY.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { GoalService } from "@galaxy-blackhole/gbh-goal";
import type { Agent } from "@galaxy-blackhole/gbh-agent";

/** Mặt cấu trúc của sổ goal — LẤY NGUYÊN từ lớp dịch vụ của gói GBH (không tự đoán chữ ký). */
export type GoalsSeamLike = GoalService;

/** Mặt cấu trúc của sổ tool mà row này dùng (đăng ký định nghĩa tool). */
export interface ToolsSeamLike {
  /** Đăng ký một định nghĩa tool; trả hàm gỡ. */
  register(definition: unknown): () => void;
}

/** Mặt cấu trúc của sổ agent mà row này dùng. */
export interface AgentsSeamLike {
  /** Agent đang sống theo id, hoặc undefined. */
  get(id: unknown): unknown;
  /** Danh sách agent gốc (không có cha). */
  roots(): readonly unknown[];
  /** Agent khởi tạo lượt hiện tại. */
  currentInitiator(): unknown;
}

/** Mặt cấu trúc của sổ projection phiên. */
export interface SessionProjectionsSeamLike {
  /** Trạng thái một đơn vị projection của phiên, hoặc undefined khi chưa có. */
  stateOf(session: unknown, key: string): unknown;
}

/**
 * Lấy một service theo HAI đường kernel công bố, thiếu thì ném ngay.
 * Nhận: ctx — context host; name — tên service. Trả: mặt dịch vụ dưới kiểu T.
 */
function seamOf<T>(ctx: Context, name: string): T {
  const viaGet = typeof ctx.get === "function" ? (ctx.get(name) as T | undefined) : undefined;
  const viaProperty = (ctx as unknown as Record<string, T | undefined>)[name];
  const seam = viaGet ?? viaProperty;
  if (seam === undefined) {
    throw new TypeError('tool-goal requires the ' + name + ' seam (ctx.get("' + name + '"))');
  }
  return seam;
}

/**
 * Sổ goal của kernel. Nhận: ctx. Trả: mặt cấu trúc của sổ goal.
 */
export function goalsOf(ctx: Context): GoalsSeamLike {
  return seamOf<GoalsSeamLike>(ctx, "goals");
}

/**
 * Sổ tool của kernel. Nhận: ctx. Trả: mặt cấu trúc của sổ tool.
 */
export function toolsOf(ctx: Context): ToolsSeamLike {
  return seamOf<ToolsSeamLike>(ctx, "tools");
}

/**
 * Sổ agent của kernel. Nhận: ctx. Trả: mặt cấu trúc của sổ agent.
 */
export function agentsOf(ctx: Context): AgentsSeamLike {
  return seamOf<AgentsSeamLike>(ctx, "agents");
}

/**
 * Sổ projection phiên của kernel. Nhận: ctx. Trả: mặt cấu trúc của sổ projection.
 */
export function sessionProjectionsOf(ctx: Context): SessionProjectionsSeamLike {
  return seamOf<SessionProjectionsSeamLike>(ctx, "sessionProjections");
}

/** Kiểu 'agent' mà dịch vụ goal của GÓI GBH nhận (lấy từ chính chữ ký dịch vụ; khác danh tính với Agent của kernel
 * nhưng CÙNG hình dạng runtime). */
export type GoalAgentArg = Parameters<GoalService["get"]>[0];

/**
 * Ép Agent của kernel sang kiểu agent mà seam goal nhận (thuần kiểu, không đổi runtime).
 * Nhận: agent — agent do kernel cấp. Trả: cùng vật thể dưới kiểu của gói GBH.
 */
export function asGoalAgent(agent: Agent): GoalAgentArg {
  return agent as unknown as GoalAgentArg;
}

/** Trạng thái unit turnBoundary mà row này đọc (chỉ một trường). */
export interface TurnBoundaryStateLike {
  /** Mốc bắt đầu lượt đang mở, hoặc null khi không mở lượt nào. */
  readonly openTurnStartSeq: unknown;
}
