/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nửa host của row ui-secret-mask: không có hành vi host, chỉ để entry activate trong cordis.yml
 */

/**
 * Thân plugin phía host — bề mặt này KHÔNG có hành vi phía host.
 *
 * Vì sao vẫn phải có: Loader nạp đúng MỘT entry theo tên package của row và entry đó phải export hàm
 * apply thì mới tính là activate (bản gốc cũng vậy: lib/index.js chỉ có apply). Việc che credential
 * hoàn toàn nằm ở nửa browser, phục vụ qua export "./client" mà harness dò từ khai báo dsh.client.
 *
 * Nhận: không tham số.
 * Trả: không trả gì (chỉ đánh dấu plugin đã activate).
 */
export function apply(): void {}
