/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nửa host của row ui-sidebar-terminal: không có hành vi host, chỉ để entry activate
 */

/**
 * Thân plugin phía host — bề mặt này KHÔNG có hành vi phía host.
 *
 * Loader nạp đúng MỘT entry theo tên package của row và entry đó phải export hàm apply thì mới tính là
 * activate (bản gốc cũng vậy). Tab terminal là giao diện của nửa browser, phục vụ qua export "./client".
 *
 * Nhận: không tham số.
 * Trả: không trả gì.
 */
export function apply(): void {}
