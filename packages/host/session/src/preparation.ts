/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Sở hữu một Session CHƯA công bố trước khi đăng ký (port 1:1 preparation.js): SessionPreparation + dispose đồng bộ idempotent.
 */
import type { Session } from "./session.ts";

/** Tuỳ chọn của một preparation: cách provider nhả trạng thái khi dispose. */
export interface SessionPreparationOptions {
  /** Nhả trạng thái provider (cache hoặc bỏ) — gọi tối đa một lần. */
  readonly release?: () => void;
}

/** Một Session CHƯA công bố + trạng thái provider giữ nó dùng được. */
export class SessionPreparation implements Disposable {
  /** Session chính xác để dựng và công bố. */
  readonly session: Session;
  /** Tuỳ chọn nhả trạng thái. */
  private readonly options: SessionPreparationOptions;
  /** Đã nhả chưa (idempotent). */
  private released = false;

  /**
   * Dựng preparation.
   * Nhận: session — Session chưa công bố; options — cách nhả trạng thái. Trả: không.
   */
  private constructor(session: Session, options: SessionPreparationOptions) {
    this.session = session;
    this.options = options;
  }

  /**
   * Bọc một Session chưa công bố trong một đời preparation.
   * Nhận: session — Session chưa công bố; options — cách nhả trạng thái (tuỳ chọn). Trả: preparation.
   */
  static create(session: Session, options?: SessionPreparationOptions): SessionPreparation {
    return new SessionPreparation(session, options ?? {});
  }

  /** Nhả trạng thái provider đúng một lần khi preparation rời người gọi. */
  [Symbol.dispose](): void {
    if (this.released) return;
    this.released = true;
    this.options.release?.();
  }
}