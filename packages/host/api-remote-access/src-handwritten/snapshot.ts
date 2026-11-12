/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khoá global mang ảnh chụp truy cập ĐẦU TIÊN của một trang, dùng chung giữa row Host (ghi) và mount
 *      Client (đọc) — bản viết lại 1:1 lib/types/snapshot.js của gói gốc.
 */

/** Thuộc tính `globalThis` mà một row chèn index gán làm baseline mở đầu của trang. */
export const REMOTE_ACCESS_SNAPSHOT_KEY = "__DSH_REMOTE_ACCESS__";
