/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa HOST của row ui-sidebar-files: giữ nguyên bề mặt export của bản gốc (chỉ có `apply`).
 */

/**
 * Điểm vào của Loader phía host. Bản gốc export hàm này (rỗng về hành vi) — thiếu nó thì Loader báo
 * 'failed to import'.
 * @returns không.
 */
export function apply(): void {}
