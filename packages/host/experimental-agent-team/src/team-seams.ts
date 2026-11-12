/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khai báo CẤU TRÚC các seam kernel mà row agent-team dùng (Session/Lead/sự kiện Team) — thay augmentation của bản gốc, không đụng kiểu gói nào.
 */
import type { SessionId } from "@deepseek-ai/dsh-session";

/** Một Session đang sống nhìn qua phần mà Team dùng. */
export interface TeamSession {
  /** Danh tính Session. */
  readonly id: SessionId;
  /** Ghi một sự kiện vào log. */
  append(type: string, data: unknown): void;
  /** Toàn bộ sự kiện KHÔNG kế thừa của Session này. */
  ownEvents(): readonly unknown[];
}

/** Lead của một Team (gốc implicit-root). */
export interface RootTeam {
  /** Session gốc sở hữu log Team (Agent hoặc Session của kernel). */
  readonly session: unknown;
}