/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Mặt khai báo của row ui-session-delete: tên gói, id slot/occupant, các hàm thuần để test, và
 *      apply rỗng cho nửa host (mọi hành vi nằm ở nửa browser).
 */

export { createDeleteDialog, deleteErrorMessage } from "./dialog.ts";
export type { DeleteDialogController, DialogRoot, DialogRuntime, RequestDelete } from "./dialog.ts";
export { INJECT, NS, OCCUPANT_ID, OCCUPANT_ORDER, PACKAGE_NAME, SLOT_SESSION_MENU_ITEM } from "./ids.ts";
export { createDeleteSessionMenuItem, fallbackTranslate } from "./menu-item.ts";
export type { MenuTranslate, SessionDeleteMenuItem, SessionMenuItemProps } from "./menu-item.ts";
export { registerSessionDeleteUi } from "./mount.ts";
export type { SessionDeleteBoundCtx, SessionDeleteClientCtx } from "./mount.ts";
export { TYPERT_REMOTE } from "./remote.ts";

/**
 * Nửa host của row này không làm gì — giữ đúng hình dạng export mà tầng nạp chờ đợi.
 * Nhận: không.
 * Trả: không.
 */
export function apply(): void {
  // Row thuần client: mọi hành vi nằm ở nửa browser (xem src/client.ts).
}
