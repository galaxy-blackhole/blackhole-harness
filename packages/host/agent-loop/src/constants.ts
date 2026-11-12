/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hằng số mặc định dùng chung của bộ điều khiển vòng lặp agent — port 1:1 vùng
 *      lib/types/constants.js (dòng 1292–1298) của @deepseek-ai/dsh-agent-loop.
 */

/**
 * Số lời gọi tool song song an toàn tối đa đang chạy trong MỘT bước của agent (NGUYÊN VĂN bản gốc).
 * Nhận: không.
 * Trả: `10` — trần mặc định cho `maxParallelToolCalls` khi cấu hình không khai.
 */
export const DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10;
