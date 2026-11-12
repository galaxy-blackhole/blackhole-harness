/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa HOST của row session-inspector (@deepseek-ai/dsh-experimental-session-inspector):
 *      entry khám phá KHÔNG làm gì — toàn bộ bề mặt thanh tra nằm ở nửa CLIENT của gói gốc.
 *      Bản viết lại trung thành của Galaxy Blackhole; nguồn đối chiếu: README.md của package (G4).
 */

/**
 * Cài đặt nửa HOST của Session Inspector, giữ TRUNG THÀNH hành vi bản gốc: không đọc `ctx`, không đọc
 * `config`, không đăng ký service/slot/route/event, không ghi tệp, không ghi log — bản gốc cũng chỉ là
 * `function apply() {}` vì "Session inspection belongs to the Client" (nguyên văn chú thích gói gốc).
 * Nhận: không tham số (cordis gọi kèm `ctx` và `config` nhưng gói bỏ qua cả hai, y bản gốc).
 * Trả: `undefined`, và không có tác dụng phụ nào.
 */
export function apply(): void {}
