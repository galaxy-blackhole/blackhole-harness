/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa HOST của row ui-cordis: thân plugin RỖNG y bản gốc — plugin THUẦN UI, chỉ cần hiện diện trong
 *      cordis.yml/Loader; nửa browser (thẻ cordis_define + công tắc chạy/dừng, 1.495 dòng) đi qua
 *      exports["./client"] của gói gốc và CHƯA port
 */

/**
 * Thân plugin HOST — KHÔNG có hành vi phía host cho mặt UI này (NGUYÊN VĂN hành vi bản gốc).
 * Nhận: không (Loader truyền ctx/config nhưng bản gốc BỎ QUA cả hai; hàm khai 0 tham số nên
 *        apply.length = 0 — dấu hiệu đo được rằng plugin này không chạm context nào).
 * Trả: undefined.
 */
export function apply(): void {}
