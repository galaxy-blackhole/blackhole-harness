/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Biến môi trường khởi động mà executable native cần trước khi chương trình chạy — port 1:1 vùng
 *      environment của @deepseek-ai/dsh-ptc-runtime-node (index.js 795–806 + environment.d.ts)
 */

/**
 * Startup variables required by native executables before model evaluation.
 * Native executable search, Windows system paths, and sandbox temporary paths retained in the OS environment.
 * Nhận: không.
 * Trả: ReadonlySet<string> — đúng sáu tên biến (viết HOA) được GIỮ LẠI trong môi trường tiến trình con.
 */
export const STARTUP_ENVIRONMENT_NAMES: ReadonlySet<string> = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "TEMP",
  "TMP"
]);

/**
 * Clear inherited credentials while preserving native child-process startup paths.
 *
 * Bản gốc khai hàm này trong CÙNG module environment.js (environment.d.ts) nhưng nó bị tree-shake
 * khỏi index.js vì index không dùng — thân hàm lấy nguyên văn từ process.js (bản bootstrap).
 * Nhận: state — vật thể có trường `env` (môi trường của tiến trình con); mọi khoá KHÔNG thuộc
 *   STARTUP_ENVIRONMENT_NAMES bị xoá tại chỗ, rồi `state.env` được THAY bằng một vật thể
 *   null-prototype (đúng nguyên văn bản gốc: env rỗng mà chương trình nhìn thấy).
 * Trả: không (sửa trực tiếp `state.env`).
 */
export function clearProgramEnvironment(state: { env: NodeJS.ProcessEnv }): void {
  for (const key of Object.keys(state.env)) if (!STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase())) Reflect.deleteProperty(state.env, key);
  state.env = Object.create(null);
}
