/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Mục menu "Xoá phiên" trong menu ngữ cảnh của sidebar. Hộp xác nhận KHÔNG nằm trong cây này —
 *      nó được dựng ở một React root tách rời (xem dialog.ts) vì menu đóng ngay khi chọn mục, kéo theo
 *      mọi con của nó bị gỡ (đo thật 24/10/2026: hộp thoại biến mất trước khi người dùng xác nhận).
 */

import { DELETE_CLASS as css } from "./class-names.ts";
import { en } from "./locales.ts";

/** Bảng react tối thiểu mà mục menu dùng. */
export interface MenuItemReact {
  /** Hook trạng thái. */
  useState<T>(initial: T): [T, (next: T) => void];
}

/** Runtime do loader cấp cho component. */
export interface MenuItemRuntime {
  /** React (chỉ hook cần dùng). */
  readonly react: MenuItemReact;
  /** Dựng element MỘT con. */
  readonly jsx: (type: unknown, props: Record<string, unknown> | null) => unknown;
  /** Dựng element NHIỀU con. */
  readonly jsxs: (type: unknown, props: Record<string, unknown> | null) => unknown;
  /** Fragment. */
  readonly Fragment: unknown;
  /** Bảng primitive của DSH. */
  readonly primitives: Record<string, unknown>;
}

/** Hàm dịch do slot cấp. */
export type MenuTranslate = (key: string, vars?: Readonly<Record<string, string>>) => string;

/** Props mà slot sidebar.workspaces.session.menu.item truyền cho occupant. */
export interface SessionMenuItemProps {
  /** Phiên của dòng đang mở menu. */
  readonly sessionId: string;
  /** Tiêu đề hiển thị của phiên (để đưa vào lời cảnh báo). */
  readonly displayTitle?: string;
  /** Cặp [đang mở, hàm đặt] của menu. */
  readonly useMenuOpenState?: () => readonly [boolean, (next: boolean) => void];
  /** Hàm dịch của namespace session-delete. */
  readonly t?: MenuTranslate;
}

/** Mở hộp xác nhận xoá cho một phiên (do dialog.ts cung cấp). */
export type OpenDeleteDialog = (sessionId: string, title: string, t: MenuTranslate) => void;

/** Component mục menu do factory sinh ra. */
export type SessionDeleteMenuItem = (props: SessionMenuItemProps) => unknown;

/**
 * Dịch dự phòng khi slot không cấp t (chỉ xảy ra ngoài renderer thật).
 * Nhận: key — khoá từ điển; vars — tham số điền.
 * Trả: chuỗi tiếng Anh đã điền tham số.
 */
export function fallbackTranslate(key: string, vars?: Readonly<Record<string, string>>): string {
  const template = (en as Record<string, string>)[key] ?? key;
  if (vars === undefined) return template;
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/**
 * Dựng mục menu "Xoá phiên".
 * Nhận: runtime — react/jsx/primitives do loader cấp; openDialog — hàm mở hộp xác nhận ở root tách rời.
 * Trả: component nhận props của slot và vẽ DUY NHẤT một MenuItemButton.
 */
export function createDeleteSessionMenuItem(runtime: MenuItemRuntime, openDialog: OpenDeleteDialog): SessionDeleteMenuItem {
  const { jsx, primitives } = runtime;

  /**
   * Một mục menu "Xoá phiên".
   * Nhận: props — phiên, tiêu đề, cặp trạng thái menu, hàm dịch.
   * Trả: element MenuItemButton.
   */
  function DeleteSessionMenuItem(props: SessionMenuItemProps): unknown {
    const { sessionId, displayTitle } = props;
    const t: MenuTranslate = props.t ?? fallbackTranslate;
    const title = displayTitle === undefined || displayTitle === "" ? sessionId : displayTitle;
    return jsx(primitives.MenuItemButton, {
      icon: jsx(primitives.IconTrashOutlineRegular, {}),
      // Đỏ như "Xoá workspace": primitive Menu dùng cờ `danger` cho item phá huỷ; className là lớp
      // dự phòng nếu bản MenuItemButton của row không đọc cờ này.
      danger: true,
      className: css.menuDanger,
      onSelect: () => openDialog(sessionId, title, t),
      children: t("menu.deleteSession"),
    });
  }

  return DeleteSessionMenuItem;
}
