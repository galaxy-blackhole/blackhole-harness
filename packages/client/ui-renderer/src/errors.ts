/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Loi dung chung cua tang renderer — phai thoat duoc khoi error boundary cua component
 */

/**
 * Lỗi lắp ráp của tầng renderer. Cố ý là lớp riêng để các lỗi này **thoát khỏi** error boundary của
 * component (chúng là lỗi thứ tự boot, không phải lỗi hiển thị), đúng như bản gốc.
 */
export class SlotAssemblyError extends Error {}
