/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Dinh tuyen phim native (menu · frame chinh · frame nhung) qua so dang ky dung chung
 */

import type { DesktopKeyboardApi, ShortcutConfigSnapshot } from "../protocol.ts";
import type { PrimitivesSeam } from "./dom.ts";
import type { ShortcutRegistry } from "./registry.ts";
import type { ShortcutRegion } from "./types.ts";

/** Cửa sổ sản phẩm có thể mang frame nhúng/wwebview được đánh dấu. */
interface ProductWindow extends Window {
  /** Frame nhúng của sidebar/webview có thể được đánh dấu bằng `name`. */
  readonly document: Document & { activeElement: Element | null };
}

/**
 * Định tuyến phím native (menu, frame chính, frame nhúng) qua sổ đăng ký dùng chung.
 * Nhận: `window` — tài liệu sản phẩm đã tin, `keyboard` — năng lực preload của frame trên, `registry` — chủ lệnh của cửa sổ, `snapshot` — đọc tuy chọn mới nhất, `primitives` — seam ui-primitives, `reset` — xoá chuỗi cố định đang chờ khi phím native bỏ qua DOM.
 * Trả: hàm gỡ.
 */
export function installNativeKeyboard(
  window: ProductWindow,
  keyboard: DesktopKeyboardApi,
  registry: ShortcutRegistry,
  snapshot: () => ShortcutConfigSnapshot,
  primitives: PrimitivesSeam,
  reset?: () => void,
): () => void {
  return keyboard.subscribe((input) => {
    if (input.revision !== snapshot().revision) return;
    reset?.();
    let target: Element | null = window.document.activeElement;
    while ((target as (Element & { shadowRoot?: { activeElement: Element | null } | null }) | null)?.shadowRoot?.activeElement != null) {
      const embedded = target as Element & { shadowRoot: { activeElement: Element | null } };
      if (embedded.matches("webview[data-sidebar-browser-frame]")) break;
      target = embedded.shadowRoot.activeElement;
    }
    const dialogs = [...window.document.querySelectorAll(primitives.modalSelector)];
    const top = dialogs.at(-1) as HTMLElement | undefined;
    const region: ShortcutRegion = target?.closest(".xterm")
      ? "terminal"
      : target?.matches('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
        ? "editable"
        : "page";
    const context = {
      target,
      region,
      modal: top?.dataset.shortcutModal ?? (top === undefined ? null : "other"),
    };
    if (input.kind === "menu") {
      registry.invoke(input.commandId, context);
      return;
    }
    if (input.kind === "keyboard") {
      registry.dispatch({ ...input, composing: false, defaultPrevented: false }, context, () => undefined);
      return;
    }
    if (input.kind === "webview") {
      if (
        target?.matches("webview[data-sidebar-browser-frame]") !== true ||
        !target.isConnected ||
        input.frameName === "" ||
        target.getAttribute("name") !== input.frameName
      ) {
        return;
      }
      registry.dispatch({ ...input, composing: false, defaultPrevented: false }, { ...context, source: "webview" }, () => undefined);
      return;
    }
    if (
      !(target instanceof HTMLIFrameElement) ||
      !target.isConnected ||
      !target.matches("iframe[data-sidebar-browser-frame], iframe[data-html-preview]") ||
      input.frameName === "" ||
      target.name !== input.frameName
    ) {
      return;
    }
    registry.dispatch({ ...input, composing: false, defaultPrevented: false }, { ...context, source: "iframe" }, () => undefined);
  });
}
