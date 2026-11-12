/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mã timeout do CHÍNH plugin này sở hữu — dùng ĐỒNG THỜI làm mã phân loại của `deadline` và
 *      `error.code` trên kết quả tool thay thế.
 */

/**
 * Mã của plugin này. Vì nó vừa là mã phân loại của `deadline` vừa là `error.code` công khai, phạm vi
 * `timeoutOf` theo nó giữ cho một hạn chót LỒNG NHAU (bộ bọc `tools/execute` khác cháy trước) không bị
 * đọc nhầm thành timeout của ta — nó đọc như một lần huỷ thượng nguồn bình thường.
 */
export const TOOL_TIMEOUT = "TOOL_TIMEOUT";
