/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai component inline cua row ui-reference: chip tep (co hop thoai loi dieu huong) + chip thu muc
 */

import type { Translator } from "./candidates.ts";

/** Bảng hook React mà hai component dùng. */
export interface ReactHooks {
  /** Trả về cặp [giá trị, hàm đặt giá trị]. */
  useState<S>(initial: S): [S, (value: S | ((previous: S) => S)) => void];
}

/** Bảng `react/jsx-runtime` (chỉ phần dùng). */
export interface JsxRuntime {
  /** Fragment của React. */
  Fragment: unknown;
  /** Dựng phần tử có một con. */
  jsx(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
  /** Dựng phần tử có nhiều con. */
  jsxs(type: unknown, props: Record<string, unknown>, key?: unknown): unknown;
}

/** Bảng `ui-primitives` (chỉ phần dùng: chip, hộp thoại, nút). */
export interface PrimitivesModule {
  /** Chip tham chiếu inline (`appearance`: file/folder/session). */
  ReferenceChip: unknown;
  /** Hộp thoại có tiêu đề, mô tả và chân trang. */
  Modal: unknown;
  /** Nút theo biến thể của DSH. */
  Button: unknown;
}

/** Bộ giá trị chạy mà view cần, do `require` của bảng module cấp. */
export interface ViewRuntime {
  /** Hook React. */
  hooks: ReactHooks;
  /** jsx runtime. */
  jsx: JsxRuntime;
  /** Bảng ui-primitives. */
  primitives: PrimitivesModule;
}

/** Dữ liệu một node tham chiếu trong văn bản người dùng. */
export interface ReferenceNode {
  /** Đường dẫn và nhãn đã phân giải. */
  data: { path: string; label: string };
}

/** Props của chip tệp. */
export interface FileReferenceProps {
  /** Node dữ liệu của tham chiếu. */
  node: ReferenceNode;
  /** Cách viết nguyên bản trong văn bản (dùng làm tooltip). */
  raw: string;
  /** Văn bản này có cho phép điều hướng không. */
  interactive: boolean;
  /** Điều hướng theo quyền của phiên gốc. */
  openFile: (path: string) => void;
  /** Hàm dịch của namespace `reference`. */
  t: Translator;
}

/** Props của chip thư mục. */
export interface FolderReferenceProps {
  /** Node dữ liệu của tham chiếu. */
  node: ReferenceNode;
  /** Cách viết nguyên bản trong văn bản (dùng làm tooltip). */
  raw: string;
}

/** Hai component mà row đăng ký vào slot `conversation.user.text.node`. */
export interface ReferenceViews {
  /** Chip tệp + hộp thoại khi điều hướng hỏng. */
  FileReference: (props: FileReferenceProps) => unknown;
  /** Chip thư mục (không điều hướng). */
  FolderReference: (props: FolderReferenceProps) => unknown;
}

/**
 * Dựng hai component với bộ giá trị chạy cho trước.
 * Nhận: `runtime` — hook React, jsx runtime và bảng ui-primitives.
 * Trả: cặp component để đăng ký vào slot.
 */
export function createViews(runtime: ViewRuntime): ReferenceViews {
  const { hooks, primitives } = runtime;
  const { Fragment, jsx, jsxs } = runtime.jsx;

  /**
   * Chip tệp: hiện nhãn, mở tệp khi được phép; lỗi điều hướng được GIỮ LẠI thành hộp thoại của chính
   * tham chiếu đó (không ẩn tham chiếu đi) và có nút thử lại.
   * Nhận: `props` — node, cách viết gốc, quyền tương tác, hàm mở tệp và hàm dịch.
   * Trả: cây element React.
   */
  function FileReference(props: FileReferenceProps): unknown {
    const [failedPath, setFailedPath] = hooks.useState<string | null>(null);
    const { path, label } = props.node.data;
    const close = (): void => {
      setFailedPath(null);
    };
    const open = (): void => {
      try {
        props.openFile(path);
      } catch {
        setFailedPath(path);
        return;
      }
      setFailedPath(null);
    };
    return jsxs(Fragment, {
      children: [
        jsx(primitives.ReferenceChip, {
          appearance: "file",
          label,
          title: props.raw,
          ...(props.interactive ? { onActivate: open } : {}),
        }),
        // Giữ nguyên DẠNG của bản gốc: khi không có hộp thoại thì con này là `false` (không phải `null`).
        props.interactive &&
          failedPath === path &&
          jsx(primitives.Modal, {
            open: true,
            onClose: close,
            closeLabel: props.t("fileOpen.close"),
            title: props.t("fileOpen.title"),
            description: props.t("fileOpen.failed", { path }),
            footer: jsxs(Fragment, {
              children: [
                jsx(primitives.Button, {
                  variant: "outline",
                  onClick: close,
                  children: props.t("fileOpen.close"),
                }),
                jsx(primitives.Button, {
                  variant: "primary",
                  onClick: open,
                  children: props.t("fileOpen.retry"),
                }),
              ],
            }),
          }),
      ],
    });
  }

  /**
   * Chip thư mục: luôn chỉ là nhãn, kể cả khi văn bản chứa nó cho phép điều hướng tệp.
   * Nhận: `props` — node và cách viết gốc.
   * Trả: cây element React.
   */
  function FolderReference(props: FolderReferenceProps): unknown {
    return jsx(primitives.ReferenceChip, {
      appearance: "folder",
      label: props.node.data.label,
      title: props.raw,
    });
  }

  return { FileReference, FolderReference };
}
