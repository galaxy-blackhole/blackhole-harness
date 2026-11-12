/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-approval: id MODULE (vao bang module) va cac ten slot/copy quan sat duoc
 */

/**
 * Id MODULE chính — package của ta. Bundle tự khai id này trong `__ModuleLoader__.load`, nên đây là
 * dòng mà manifest của Host trỏ tới và là `ownerId` để HMR tra `rev` (và để gỡ style đã chèn).
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-approval";

/**
 * Id MODULE phụ — package gốc của DSH. Bản gốc đăng ký ĐÚNG MỘT id module (không có `chunk:`), nên
 * bản viết lại đăng ký hai id (của ta + stock) bằng cùng một factory.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-approval";

/**
 * Id của hiệu ứng đăng ký phím tắt cố định — hai chuỗi này giữ nguyên như bản gốc để log/chẩn đoán
 * của cordis đối chiếu được.
 */
export const FIXED_SHORTCUT_IDS = {
  /** Cho phép một lần (Enter). */
  allow: "approval.allow",
  /** Từ chối (Esc). */
  reject: "approval.reject",
} as const;

/** Nhóm phím tắt mà hai phím của row này thuộc về. */
export const SHORTCUT_GROUP = "approval";

/** Sự kiện Remote mà row này tiêu thụ: một yêu cầu duyệt đi qua waterfall có phạm vi. */
export const APPROVAL_EVENT = "approval/request";

/**
 * Tên slot của composer (ghi thẳng bằng chuỗi tại chỗ đăng ký trong src/plugin.ts — xem ghi chú ở đó).
 * Khai ở đây chỉ để tài liệu hoá; KHÔNG dùng hằng này ở chỗ đăng ký.
 */
export const COMPOSER_SLOT = "conversation.composer";

/** Slot con (do Host cấp) chứa phần chi tiết do Tool sở hữu, khoá theo `callId`. */
export const DETAIL_SLOT = "conversation.approval.detail";
