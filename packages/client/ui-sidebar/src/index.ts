/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row ui-sidebar: `apply` RONG nhu ban goc — sidebar la be mat cua browser
 */

/**
 * Thân plugin phía Host của row này.
 *
 * Bản gốc cũng để rỗng (`Provides no host-side behavior`): toàn bộ cột sidebar nằm ở nửa browser
 * (`exports["./client"]`, đọc từ khối `dsh.client` trong package.json). Nửa host tồn tại để Loader có
 * một dòng entry.
 * Nhận: không.
 * Trả: không.
 */
export function apply(): void {}
