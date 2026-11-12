/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa HOST của row cordis-client-runner — rỗng y bản gốc (lib/index.js gốc 11 dòng: chỉ có export apply).
 */

/**
 * Điểm vào của Loader phía host.
 *
 * Bản gốc (@deepseek-ai/dsh-cordis-client-runner @0.2.1-alpha.4, lib/index.js 11 dòng) có thân hàm
 * RỖNG đúng như hàm này: toàn bộ khả năng của row nằm ở nửa BROWSER (lib/client.js, 7.408 dòng),
 * được khai qua dsh.client + exports["./client"] của package. Nửa host chỉ tồn tại để row có mặt
 * trong cordis.yml / Loader.
 *
 * KHÔNG có cổng chống cài hai lần: cổng đó canh việc ĐĂNG KÝ slot/service, mà hàm này không đăng ký
 * gì (gọi n lần = 0 hiệu ứng) nên thêm cờ chỉ tạo trạng thái chết. Cùng quy ước với nửa host rỗng
 * của packages/client/ui-open-in-app/src/index.ts. Ca test "apply.length === 0" và "không đọc/ghi
 * thuộc tính nào trên ctx" canh đúng điều đó.
 *
 * Nhận: không có tham số (bản gốc cũng không khai tham số; cordis truyền ctx nhưng hàm bỏ qua).
 * Trả: không trả gì (undefined) và không có tác dụng phụ.
 */
export function apply(): void {}
