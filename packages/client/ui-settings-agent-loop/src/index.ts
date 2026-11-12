/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row ui-settings-agent-loop: `apply` RONG nhu ban goc — row nay chi co nghia o phia browser
 */

/**
 * Thân plugin phía Host của row này.
 *
 * Bản gốc cũng để rỗng: nửa host tồn tại chỉ để Loader có một dòng entry, còn trang nằm ở nửa browser
 * (`exports["./client"]`, đọc từ khối `dsh.client` trong package.json). Namespace `agent-loop` mà
 * trang sửa là do agent loop đăng ký, gói này không đăng ký namespace nào.
 * Nhận: không.
 * Trả: không.
 */
export function apply(): void {}
