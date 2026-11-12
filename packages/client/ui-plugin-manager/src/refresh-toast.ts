/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Toast lỗi làm mới hiện NGAY CẢ khi đã rời bảng Plugins — port 1:1 vùng PluginRefreshToast của bundle gốc
 *      (@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js dòng 4267-4282)
 */

import { noticeText } from "./presentation.ts";
import type { PluginManagerModules } from "./runtime.ts";

/** Props của toast (do slot `shell.overlay` bơm). */
export interface RefreshToastProps {
  /** Hook đọc store của plugin manager. */
  readonly usePluginManager: (selector: (state: { readonly notice?: { readonly kind?: string; readonly seq?: number } }) => unknown) => unknown;
  /** Đóng notice hiện tại. */
  readonly dismissNotice: () => void;
  /** Hàm dịch của namespace. */
  readonly t: (key: string) => string;
}

/** Nguyên liệu primitive mà toast cần. */
interface ToastPrimitives {
  /** Primitive toast. */
  readonly Toast: unknown;
  /** Icon cảnh báo. */
  readonly IconWarningOutlineRegular: unknown;
}

/**
 * Dựng component toast từ bảng module của loader (bản gốc dùng biến module-scope; đây cùng một cây).
 * Nhận: modules — bảng module (react + jsx + primitive).
 * Trả: component toast.
 */
export function createPluginRefreshToast(modules: PluginManagerModules): (props: RefreshToastProps) => unknown {
  const { react, jsxRuntime } = modules;
  const { jsx } = jsxRuntime;
  const primitives = modules.primitives as unknown as ToastPrimitives;
  // Câu chữ của notice: gọi THẲNG noticeText của presentation ở phạm vi module — đúng như bản gốc, nên
  // slot chỉ cần inject {hooks, dismissNotice} (không thêm prop ⇒ parity hành vi với A).
  ;


  return function PluginRefreshToast({ usePluginManager, dismissNotice, t }) {
    const notice = usePluginManager((state) => state.notice) as { readonly kind?: string; readonly seq?: number } | undefined;
    if (notice?.kind !== "refresh-failed") return null;
    return jsx(primitives.Toast, {
      text: noticeText(notice as Parameters<typeof noticeText>[0], t),
      icon: jsx(primitives.IconWarningOutlineRegular, {}),
      onDone: dismissNotice,
    }, notice.seq);
  };
}