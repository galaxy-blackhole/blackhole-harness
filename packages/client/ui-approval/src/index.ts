/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row ui-approval: `apply` RONG nhu ban goc — trinh bay duyet la viec cua browser
 */

/**
 * Thân plugin phía Host của row này.
 *
 * Bản gốc cũng để rỗng: năng lực duyệt phía Host được ghép độc lập, gói này chỉ mang phần trình bày
 * trên browser (`exports["./client"]`, đọc từ khối `dsh.client` trong package.json). Nửa host tồn tại
 * để Loader có một dòng entry.
 * Nhận: không.
 * Trả: không.
 */
export function apply(): void {}
