/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua host cua row ui-settings-plugins: dung nhu ban goc — khong co hanh vi phia host, chi ton tai de Loader mount duoc row
 */

/**
 * Điểm vào của Loader. Bản gốc `@deepseek-ai/dsh-client-ui-settings-plugins/lib/index.js` export hàm này
 * (thân rỗng) để row xuất hiện trong cây plugin của host; toàn bộ hành vi thật nằm ở nửa browser
 * (`exports["./client"]`, phát hiện qua khai báo `dsh.client` trong package.json).
 * Nhận: không.
 * Trả: không.
 */
export function apply(): void {}
