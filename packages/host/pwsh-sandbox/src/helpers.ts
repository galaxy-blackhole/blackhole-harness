/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép chiếu kết quả shell trên chẩn đoán sandbox (bản viết lại trung thành của vùng
 *      `lib/types/helpers.js` nằm TRONG bundle gốc của @deepseek-ai/dsh-pwsh-sandbox)
 */

import { accessSync, constants, statSync } from "node:fs";
import type { RunnerFailureRule } from "@deepseek-ai/dsh-sandbox";
import type { ShellRunResult } from "@deepseek-ai/dsh-shell";

// ⚠️ Bản gốc KHÔNG nhập bốn hàm này từ seam: bundle của nó mang theo bản sao riêng của phương ngữ
// chẩn đoán (vùng `lib/types/helpers.js` ở đầu `lib/index.js`). Bản viết lại giữ ĐÚNG như vậy —
// cùng công thức, cùng thứ tự kiểm — để hành vi không phụ thuộc phiên bản của seam bên ngoài.

/** Mã lỗi spawn cục bộ của Node được chứng minh là chỉ ra việc phân giải tệp thi hành hoặc thiếu quyền chạy. */
const EXECUTABLE_SPAWN_CODES = new Set(["EACCES", "ENOENT"]);

/**
 * Thư mục làm việc do bên gọi sở hữu có vào được không.
 * Nhận: đường dẫn thư mục làm việc.
 * Trả: true khi đường dẫn là thư mục VÀ tiến trình có quyền đi vào (X_OK).
 */
function isUsableWorkdir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Quy lỗi spawn ENOENT/EACCES của Node cho runner CHỈ khi đường dẫn hoặc syscall của lỗi chỉ đích
 * danh argv[0] của runner, sau khi đã độc lập loại trừ thư mục làm việc do bên gọi sở hữu. Có
 * đường dẫn thì nó phải TRÙNG KHÍT runner; không có thì syscall phải trùng khít. Với một cwd dùng
 * được, hai mã ấy mô tả việc phân giải hoặc quyền chạy của chính argv[0] (hay shebang của nó).
 * cwd được kiểm LÚC PHÂN LOẠI, không nguyên tử với lúc spawn; việc thay đường dẫn đồng thời có thể
 * đổi chỗ quy lỗi nhưng KHÔNG thể cho phép một lần chạy không bị cưỡng chế.
 * Nhận: lỗi spawn gốc, argv[0] của nhà cung cấp (tệp thi hành lập ra cưỡng chế), cwd do bên gọi sở hữu.
 * Trả: lỗi đó có bằng chứng DƯƠNG về tệp thi hành của runner hay không.
 */
export function isRunnerSpawnFailure(error: unknown, runnerProgram: string | undefined, workdir: string): boolean {
  if (runnerProgram === undefined || !isUsableWorkdir(workdir)) return false;
  if (typeof error !== "object" || error === null) return false;
  const { code, path, syscall } = error as { code?: unknown; path?: unknown; syscall?: unknown };
  if (typeof code !== "string" || !EXECUTABLE_SPAWN_CODES.has(code)) return false;
  if (typeof syscall !== "string") return false;
  const exactSyscall = `spawn ${runnerProgram}`;
  if (path === undefined) return syscall === exactSyscall;
  if (typeof path !== "string" || path.length === 0 || path !== runnerProgram) return false;
  return syscall === "spawn" || syscall === exactSyscall;
}

/**
 * Phân loại một lần chạy hỏng theo phương ngữ từ chối của backend đang chọn.
 * Nhận: kết quả foreground đã kết thúc và danh sách chữ ký từ chối (không phân biệt hoa thường).
 * Trả: true khi lần chạy hỏng đó khớp phương ngữ từ chối ấy.
 */
export function classifyDenial(result: ShellRunResult, signatures: readonly string[]): boolean {
  return matchesSignature(result.exitCode, result.stderr.text, signatures);
}

/** Bằng chứng runner hỏng được giữ lại để làm chi tiết cho lỗi hạ tầng. */
interface RunnerFailureMatch {
  /** Dòng stderr GỐC đã khớp một chữ ký chí tử. */
  detail: string;
}

/**
 * Phân loại một tiến trình đã kết thúc theo các luật runner-hỏng có cấu trúc của backend đang chọn.
 * Mỗi luật đòi một mã thoát khác 0, cổng mã thoát tuỳ chọn của nó, và một chữ ký chí tử trên MỘT
 * dòng stderr sau khi đã loại trừ những dòng thông tin bằng đúng nguyên văn.
 * Nhận: mã thoát (null = chết vì tín hiệu), toàn văn stderr (giữ nguyên), các luật của lần bọc đang dùng.
 * Trả: dòng chí tử ĐẦU TIÊN khớp, hoặc undefined khi bằng chứng chưa đủ.
 */
export function classifyRunnerFailure(
  exitCode: number | null,
  stderr: string,
  rules: readonly RunnerFailureRule[],
): RunnerFailureMatch | undefined {
  if (exitCode === null || exitCode === 0) return undefined;
  const lines = stderr.split(/\r?\n/);
  for (const rule of rules) {
    if (rule.allowedExitCodes !== undefined && !rule.allowedExitCodes.includes(exitCode)) continue;
    const informationalLines = new Set((rule.informationalLines ?? []).map((line) => line.toLowerCase()));
    const fatalSignatures = rule.fatalSignatures
      .filter((signature) => signature.trim().length > 0)
      .map((signature) => signature.toLowerCase());
    for (const line of lines) {
      const lowered = line.toLowerCase();
      if (informationalLines.has(lowered)) continue;
      if (fatalSignatures.some((signature) => lowered.includes(signature))) return { detail: line };
    }
  }
  return undefined;
}

/**
 * Khớp một mã thoát khác 0 với các chữ ký stderr (không phân biệt hoa thường).
 * Nhận: mã thoát (null = chết vì tín hiệu), toàn văn stderr đã gom, các chuỗi con của phương ngữ backend.
 * Trả: true khi đây là lần chạy khác 0 mà stderr khớp ít nhất một chữ ký.
 */
export function matchesSignature(exitCode: number | null, stderr: string, signatures: readonly string[]): boolean {
  if (exitCode === null || exitCode === 0) return false;
  const lowered = stderr.toLowerCase();
  return signatures.some((signature) => lowered.includes(signature.toLowerCase()));
}
