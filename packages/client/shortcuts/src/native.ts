/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kieu du lieu phim native trao doi voi preload cua Electron (chi kieu, khong co ma chay)
 */

import type { ShortcutCommandId } from "./binding.ts";
import type { ShortcutRevision } from "./persistence.ts";

/**
 * Phím native mang theo danh tính cấu hình đã nhận; tên frame chỉ ra iframe hoặc guest đang có focus.
 */
export type DesktopShortcutInput = {
  /** Revision cấu hình đã nhận. */
  readonly revision: ShortcutRevision;
} & (
  | { readonly kind: "menu"; readonly commandId: ShortcutCommandId }
  | {
      readonly kind: "keyboard" | "iframe" | "webview";
      /** Tên frame gửi phím. */
      readonly frameName: string;
      /** Mã phím vật lý. */
      readonly code: string;
      /** Phím thứ hai của hợp âm. */
      readonly secondCode?: string;
      /** Trạng thái các phím bổ trợ. */
      readonly control: boolean;
      /** Trạng thái phím Alt. */
      readonly alt: boolean;
      /** Trạng thái phím Shift. */
      readonly shift: boolean;
      /** Trạng thái phím Meta. */
      readonly meta: boolean;
      /** Phím được giữ tự động lặp. */
      readonly repeat: boolean;
    }
);

/** Năng lực theo cửa sổ, chỉ phơi cho frame chính của sản phẩm. */
export interface DesktopKeyboardApi {
  /**
   * Theo dõi phím native đã xác minh.
   * Nhận: `listener` — người nhận của tài liệu hiện tại.
   * Trả: hàm gỡ.
   */
  subscribe(listener: (input: DesktopShortcutInput) => void): () => void;
  /**
   * Đóng cửa sổ sở hữu nếu cấu hình của nó còn là bản hiện tại.
   * Nhận: `revision` — danh tính cấu hình đã nhận.
   * Trả: xong khi IPC hoàn tất.
   */
  closeWindow(revision: ShortcutRevision): Promise<void>;
}
