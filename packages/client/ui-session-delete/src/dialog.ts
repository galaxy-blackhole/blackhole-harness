/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Hộp xác nhận "Xoá vĩnh viễn phiên này?" dựng ở một React ROOT TÁCH RỜI (gắn vào document.body),
 *      cùng khuôn "Xoá workspace" của ui-workspace: Modal + title/description + hai Button + dòng trạng
 *      thái role=status và dòng lỗi role=alert. Tách rời vì menu ngữ cảnh đóng ngay khi chọn mục.
 */

import { DELETE_CLASS as css } from "./class-names.ts";
import { fallbackTranslate } from "./menu-item.ts";
import type { MenuItemRuntime, MenuTranslate } from "./menu-item.ts";

/** Hàm xoá một phiên do tầng mount bơm vào (đã gắn remote + refresh danh sách). */
export type RequestDelete = (sessionId: string) => Promise<void>;

/** Root React tối thiểu mà hộp thoại cần (react-dom/client). */
export interface DialogRoot {
  /** Vẽ lại nội dung root. */
  render(node: unknown): void;
  /** Gỡ root. */
  unmount(): void;
}

/** Runtime của hộp thoại: thêm hàm tạo root so với runtime của mục menu. */
export interface DialogRuntime extends MenuItemRuntime {
  /** Tạo một React root trên một phần tử DOM. */
  readonly createRoot: (container: unknown) => DialogRoot;
}

/** Bộ điều khiển hộp thoại dùng chung cho cả phiên chạy. */
export interface DeleteDialogController {
  /** Mở hộp xác nhận cho một phiên. */
  open(sessionId: string, title: string, t: MenuTranslate): void;
  /** Gỡ root + phần tử chứa (gọi khi plugin bị tháo). */
  destroy(): void;
}

/** Khoá từ điển của lỗi theo mã Remote. */
const ERROR_KEYS: Readonly<Record<string, string>> = {
  "session/delete-live": "error.live",
  "session/delete-not-found": "error.notFound",
};

/**
 * Đổi lỗi Remote thành câu hiển thị trong hộp thoại.
 * Nhận: error — lỗi từ lượt gọi; t — hàm dịch.
 * Trả: câu đã dịch.
 */
export function deleteErrorMessage(error: unknown, t: MenuTranslate): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  const key = ERROR_KEYS[code];
  if (key !== undefined) return t(key);
  const message = error instanceof Error ? error.message : String(error);
  return t("error.failed", { message });
}

/**
 * Dựng bộ điều khiển hộp xác nhận xoá phiên.
 * Nhận: runtime — react/jsx/primitives + createRoot; requestDelete — hàm xoá thật.
 * Trả: controller có open() và destroy().
 */
export function createDeleteDialog(runtime: DialogRuntime, requestDelete: RequestDelete): DeleteDialogController {
  const { react, jsx, jsxs, Fragment, primitives, createRoot } = runtime;
  let root: DialogRoot | undefined;
  let container: HTMLElement | undefined;
  let closeCurrent: (() => void) | undefined;

  /**
   * Hộp xác nhận cho một phiên.
   * Nhận: props — phiên, tiêu đề, hàm dịch, hàm đóng.
   * Trả: element Modal.
   */
  function DeleteDialog(props: { sessionId: string; title: string; t: MenuTranslate; close: () => void }): unknown {
    const { sessionId, title, t, close } = props;
    const [pending, setPending] = react.useState(false);
    const [error, setError] = react.useState<string | null>(null);
    const cancel = (): void => {
      if (pending) return;
      close();
    };
    const confirm = (): void => {
      if (pending) return;
      setPending(true);
      setError(null);
      void requestDelete(sessionId)
        .then(() => {
          setPending(false);
          close();
        })
        .catch((reason: unknown) => {
          setPending(false);
          setError(deleteErrorMessage(reason, t));
        });
    };
    return jsx(primitives.Modal, {
      open: true,
      onClose: cancel,
      closeLabel: t("dialog.cancel"),
      title: t("dialog.title"),
      description: t("dialog.desc", { title }),
      footer: jsxs(Fragment, {
        children: [
          jsx(primitives.Button, { variant: "outline", disabled: pending, onClick: cancel, children: t("dialog.cancel") }),
          jsx(primitives.Button, {
            variant: "outline",
            className: css.confirmDanger,
            disabled: pending,
            onClick: confirm,
            children: t("dialog.confirm"),
          }),
        ],
      }),
      children: [
        pending ? jsx("div", { role: "status", children: t("dialog.pending") }) : null,
        error === null ? null : jsx("div", { role: "alert", children: error }),
      ],
    });
  }

  return {
    open(sessionId: string, title: string, t: MenuTranslate): void {
      if (typeof document === "undefined") return;
      if (root === undefined) {
        container = document.createElement("div");
        container.dataset.gbh = "session-delete-dialog";
        document.body.appendChild(container);
        root = createRoot(container);
      }
      const host = root;
      const close = (): void => {
        host.render(null);
        closeCurrent = undefined;
      };
      closeCurrent = close;
      host.render(jsx(DeleteDialog, { sessionId, title, t, close }));
    },
    destroy(): void {
      closeCurrent?.();
      root?.unmount();
      container?.remove();
      root = undefined;
      container = undefined;
    },
  };
}
