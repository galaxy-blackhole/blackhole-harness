/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Adapter ban phim cho tai lieu chinh: bo gop IME · modal · phan vung nhap
 */

import type { ShortcutFixedInput, ShortcutRegion } from "./types.ts";
import type { ShortcutPlatform, ShortcutRuntime } from "../protocol.ts";

/** Bảng `ui-primitives` (chỉ phần adapter bàn phím dùng). */
export interface PrimitivesSeam {
  /**
   * Theo dõi trạng thái bộ gõ (IME) của tài liệu.
   * Nhận: `document` — tài liệu sản phẩm.
   * Trả: bộ chặn + hàm dọn.
   */
  observeComposition(document: Document): { guards(event: KeyboardEvent): boolean; dispose(): void };
  /** Selector nhận diện phần tử modal. */
  modalSelector: string;
}

/** Phần sổ đăng ký mà adapter cần. */
export interface DispatchTarget {
  /** Nhận một lần gõ phím đã chuẩn hoá. */
  dispatch(
    gesture: {
      code: string;
      secondCode?: string;
      control: boolean;
      alt: boolean;
      shift: boolean;
      meta: boolean;
      repeat: boolean;
      composing: boolean;
      defaultPrevented: boolean;
    },
    context: { region: "page" | "editable" | "terminal"; modal: string | null; target: Element | null },
    consume: () => void,
  ): unknown;
  /** Vỏ ứng dụng. */
  readonly runtime: ShortcutRuntime;
  /** Thiết bị nhận phím. */
  readonly platform: ShortcutPlatform;
}

/**
 * Nhận diện thiết bị ĐANG TRUY CẬP, không bao giờ theo hệ điều hành của server.
 * Nhận: `document` — tài liệu sản phẩm (preload Electron có đánh dấu), `navigatorValue` — thông tin thiết bị của trình duyệt.
 * Trả: vỏ + thiết bị tường minh để giải mặc định.
 */
export function detectEnvironment(
  document: Document,
  navigatorValue: Navigator,
): { runtime: ShortcutRuntime; platform: ShortcutPlatform } {
  // CHỊU ĐƯỢC môi trường thiếu: hàm dựng service gọi hàm này, nên ném ở đây làm cả row kẹt `loading` rồi
  // cascade sang 18 entry khác. Đo được trên app 17/10/2026 (console, do cổng log của hàm dựng để lộ):
  //   gbh-client-shortcuts: apply nem loi TypeError ... 'documentElement.dataset.platform'
  // ⇒ đọc qua optional chaining + mặc định, KHÔNG ném. Khi DOM đầy đủ thì hành vi y như trước.
  const element = (document as { documentElement?: { dataset?: Record<string, string | undefined> } } | undefined)
    ?.documentElement;
  const desktop = element?.dataset?.["platform"];
  const device = desktop ?? (navigatorValue as { platform?: string } | undefined)?.platform ?? "";
  return {
    runtime: desktop === undefined ? "web" : "desktop",
    platform: /darwin|mac|iphone|ipad/iu.test(device) ? "macos" : /win/iu.test(device) ? "windows" : "linux",
  };
}

/**
 * Cài theo dõi bộ gõ, làm mới cache modal, và phân xử SAU khi bộ điều khiển cục bộ đã xử lý.
 * Nhận: `window` — cửa sổ nhập liệu, `shortcuts` — sổ đăng ký của cửa sổ, `fixed` — người nhận chuỗi cố định (tuỳ chọn), `native` — tầng native sở hữu binding sửa được.
 * Trả: hàm gỡ (gỡ mọi listener, observer modal và node đã cache).
 */
export function installKeyboard(
  window: Window,
  shortcuts: DispatchTarget,
  primitives: PrimitivesSeam,
  fixed?: (input: ShortcutFixedInput) => void,
  native = false,
): () => void {
  const document = window.document;
  const composition = primitives.observeComposition(document);
  let pending = false;
  let pendingTimer: number | undefined;
  const reset = (): void => {
    fixed?.({ type: "reset" });
  };
  let deadKey = false;
  let dialogs: NodeListOf<Element> | undefined;
  const blur = (): void => {
    deadKey = false;
    reset();
  };
  const containsModal = (node: Node): boolean =>
    node instanceof Element &&
    (node.matches(primitives.modalSelector) || node.querySelector(primitives.modalSelector) !== null);
  const changedModals = (records: MutationRecord[]): void => {
    if (records.length > 0) dialogs = undefined;
    if (
      records.some((record) =>
        record.type === "attributes"
          ? record.oldValue === "dialog" || record.oldValue === "true" || containsModal(record.target)
          : [...record.addedNodes, ...record.removedNodes].some(containsModal),
      )
    ) {
      reset();
    }
  };
  const observer = new MutationObserver(changedModals);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["role", "aria-modal"],
    attributeOldValue: true,
  });
  const capture = (): void => {
    if (pending) reset();
    window.clearTimeout(pendingTimer);
    changedModals(observer.takeRecords());
    pending = true;
    pendingTimer = window.setTimeout(() => {
      pending = false;
      pendingTimer = undefined;
      reset();
    }, 0);
  };
  const keydown = (event: KeyboardEvent): void => {
    window.clearTimeout(pendingTimer);
    pendingTimer = undefined;
    pending = false;
    const path = event.composedPath().find((value) => value instanceof Element);
    const element = path instanceof Element ? path : document.activeElement;
    const region: ShortcutRegion = element?.closest(".xterm")
      ? "terminal"
      : element?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
        ? "editable"
        : "page";
    changedModals(observer.takeRecords());
    dialogs ??= document.querySelectorAll(primitives.modalSelector);
    const top = dialogs[dialogs.length - 1];
    const context = {
      region,
      modal: top === undefined ? null : ((top as HTMLElement).dataset.shortcutModal ?? "other"),
      target: element instanceof Element ? element : null,
    };
    const guarded = composition.guards(event) || deadKey || event.getModifierState("AltGraph");
    const isDead = event.key === "Dead";
    const commandDeadKey =
      isDead &&
      shortcuts.runtime === "web" &&
      shortcuts.platform === "macos" &&
      event.code === "KeyN" &&
      event.metaKey &&
      event.altKey &&
      !event.ctrlKey &&
      !event.shiftKey;
    deadKey = isDead;
    const gesture = {
      code: event.code,
      control: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      repeat: event.repeat,
      composing: guarded || isDead,
      defaultPrevented: event.defaultPrevented,
    };
    const consume = (): void => {
      event.preventDefault();
      if (commandDeadKey) deadKey = false;
    };
    fixed?.({ type: "keydown", gesture, context, consume });
    if (native) return;
    shortcuts.dispatch(
      { ...gesture, composing: guarded || (isDead && !commandDeadKey), defaultPrevented: event.defaultPrevented },
      context,
      consume,
    );
  };
  document.addEventListener("compositionstart", reset, true);
  document.addEventListener("compositionend", reset, true);
  document.addEventListener("focusin", reset, true);
  document.addEventListener("pointerdown", reset, true);
  window.addEventListener("keydown", capture, true);
  window.addEventListener("keydown", keydown);
  window.addEventListener("blur", blur);
  return () => {
    pending = false;
    window.clearTimeout(pendingTimer);
    observer.disconnect();
    dialogs = undefined;
    composition.dispose();
    document.removeEventListener("compositionstart", reset, true);
    document.removeEventListener("compositionend", reset, true);
    document.removeEventListener("focusin", reset, true);
    document.removeEventListener("pointerdown", reset, true);
    window.removeEventListener("keydown", capture, true);
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("blur", blur);
  };
}
