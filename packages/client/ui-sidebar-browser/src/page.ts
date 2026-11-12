/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghep mot nha cung cap dieu huong voi phan trinh bay cua no
 */

import type { BrowserFrame } from "./frame.ts";
import type { BrowserTabState } from "./persistence.ts";
import type { BrowserPresentation } from "./view/presentation.ts";

/** Dau vao dung nha cung cap; luu tru khong di vao giao dien dieu huong dang song. */
export interface BrowserPageOptions {
  /** Checkpoint da luu cua tab. */
  readonly initial: BrowserTabState | undefined;
  /** Ghi checkpoint moi. */
  readonly persist: (state: BrowserTabState) => void;
  /** Trang tu xin mo mot dia chi ra ngoai tab hien tai. */
  readonly openRequested: (url: string) => void;
}

/** Controller so huu se dispose frame; giao dien chi gan phan trinh bay. */
export interface BrowserPage {
  /** Mat dieu huong. */
  readonly frame: BrowserFrame;
  /** Mat trinh bay. */
  readonly presentation: BrowserPresentation;
}

/**
 * Dung mot nha cung cap nghi, chua gan DOM.
 * Nhan: options — checkpoint da luu va cac callback.
 * Tra: hai mat dieu huong va trinh bay.
 */
export type BrowserPageFactory = (options: BrowserPageOptions) => BrowserPage;
