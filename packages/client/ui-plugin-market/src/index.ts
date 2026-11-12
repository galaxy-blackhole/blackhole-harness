/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa host của row ui-plugin-market — plugin thuần giao diện, apply rỗng như bản gốc
 */

/**
 * Điểm vào của Loader phía Host.
 * Bản gốc (lib/index.js) chỉ có một hàm apply rỗng: dịch vụ pluginMarket do row riêng của nó dựng, còn
 * nửa browser nằm ở ./client. Thiếu hàm này thì Loader báo "failed to import" và entry không activate.
 * Nhận: không tham số.
 * Trả: không trả gì — chỉ đánh dấu plugin đã activate.
 */
export function apply(): void {}
