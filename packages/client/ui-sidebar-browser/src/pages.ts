/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ghep dieu huong iframe va phan trinh bay DOM, khong co nhanh nen tang o noi tieu thu
 */

import { IframeImpl } from "./iframe-impl.ts";
import type { BrowserPage, BrowserPageOptions } from "./page.ts";
import type { SnapshotStoreLike } from "./types.ts";
import { IframePresentation } from "./view/iframe-presentation.ts";

/**
 * Ghep mot nha cung cap iframe nghi va phan trinh bay DOM cua no.
 * Nhan: options — dieu huong da luu va cac callback; createStore — ham store anh chup cua bang module.
 * Tra: doi tuong dieu huong va trinh bay cua trang Web.
 */
export function createIframePage(
  options: BrowserPageOptions,
  createStore: <T>(initial: T) => SnapshotStoreLike<T>,
): BrowserPage {
  const presentation = new IframePresentation({
    /** Bao nha cung cap rang tai lieu da tai xong. */
    loaded: (revision: number): void => {
      frame.handleLoaded(revision);
    },
    /** Bao nha cung cap rang tai lieu tai that bai. */
    failed: (revision: number): void => {
      frame.handleLoadFailed(revision);
    },
    /** Vung noi dung duoc gan lai thi tai lai trang da yeu cau. */
    remounted: (): void => {
      frame.reload();
    },
  });
  const frame = new IframeImpl(options, presentation, createStore);
  return { frame, presentation };
}
