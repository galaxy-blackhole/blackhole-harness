/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bộ đặt bảng module giả cho test: phải được import TRƯỚC module client để bundle kịp đăng ký id
 */

/** Id module mà mọi lần đăng ký vào bảng module giả ghi lại được. */
export const registeredIds: string[] = [];

/** Bảng module giả của bộ nạp — chỉ ghi lại id, không dựng factory. */
export const fakeLoader: { load(registration: { id: string }): void } = {
  load: (registration: { id: string }): void => {
    registeredIds.push(registration.id);
  },
};

(globalThis as unknown as { __ModuleLoader__: typeof fakeLoader }).__ModuleLoader__ = fakeLoader;

/** Xoá danh sách id đã ghi để đo một lần nạp bundle riêng biệt. */
export function resetRegisteredIds(): void {
  registeredIds.length = 0;
}
