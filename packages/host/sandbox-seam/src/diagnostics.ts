/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phân loại lỗi runner sandbox quan sát được và từ chối hiệu ứng file: mã spawn của Node, cwd của bên
 *      gọi, luật chữ ký stderr — port 1:1 lib/types/diagnostics.js
 */

import { accessSync, constants, statSync } from "node:fs";

import type { RunnerFailureRule } from "./types.ts";

/** Mã spawn CỦA NODE đã được chứng minh là nhận diện lỗi giải đường dẫn thực thi hoặc lỗi quyền. */
const EXECUTABLE_SPAWN_CODES = new Set(["EACCES", "ENOENT"]);

/**
 * Cho biết cwd do bên gọi sở hữu có VÀO ĐƯỢC không.
 * Nhận: path — thư mục cần kiểm.
 * Trả: true khi là thư mục và truy cập được (X_OK); false khi mọi lỗi/thay thế.
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
 * Chỉ quy kết lỗi ENOENT/EACCES của Node khi đường của lỗi BẰNG argv[0], sau khi đã ĐỘC LẬP loại trừ cwd
 * của bên gọi. Kèm cwd DÙNG ĐƯỢC, các mã này mô tả việc giải hoặc quyền chạy cho chính argv[0] đó hoặc
 * interpreter shebang của nó. cwd được kiểm LÚC PHÂN LOẠI, không nguyên tử với spawn; thay đường đồng thời
 * có thể đổi quy kết nhưng KHÔNG THỂ cho phép một lượt chạy không cầm giữ.
 * Nhận: error — lỗi spawn gốc; runnerProgram — argv[0] của provider (chương trình lập ra cầm giữ);
 *        workdir — cwd do bên gọi sở hữu.
 * Trả: true khi lỗi có bằng chứng ĐẶC THÙ cho chương trình runner.
 */
export function isRunnerSpawnFailure(error: unknown, runnerProgram: string | undefined, workdir: string): boolean {
  if (runnerProgram === void 0 || !isUsableWorkdir(workdir)) return false;
  if (typeof error !== "object" || error === null) return false;
  const { code, path, syscall } = error as { code?: unknown; path?: unknown; syscall?: unknown };
  if (typeof code !== "string" || !EXECUTABLE_SPAWN_CODES.has(code)) return false;
  if (typeof syscall !== "string") return false;
  const exactSyscall = `spawn ${runnerProgram}`;
  if (path === void 0) return syscall === exactSyscall;
  if (typeof path !== "string" || path.length === 0 || path !== runnerProgram) return false;
  return syscall === "spawn" || syscall === exactSyscall;
}

/**
 * Phân loại MỘT tiến trình đã kết thúc theo luật runner-hỏng có cấu trúc của backend đã chọn. Mỗi luật cần
 * mã thoát KHÁC 0, cổng mã thoát (nếu có), và một chữ ký CHÍ MẠNG trên MỘT dòng stderr sau khi đã loại các
 * dòng thông tin bằng SO KHỚP CHÍNH XÁC.
 * Nhận: exitCode — mã thoát (null = bị tín hiệu giết); stderr — toàn bộ stderr, KHÔNG đổi;
 *        rules — luật runner-hỏng từ wrap đang bật.
 * Trả: dòng chí mạng ĐẦU TIÊN khớp, hoặc undefined khi bằng chứng chưa đủ.
 */
export function classifyRunnerFailure(exitCode: number | null, stderr: string, rules: readonly RunnerFailureRule[]): { detail: string } | undefined {
  if (exitCode === null || exitCode === 0) return undefined;
  const lines = stderr.split(/\r?\n/);
  for (const rule of rules) {
    if (rule.allowedExitCodes !== void 0 && !rule.allowedExitCodes.includes(exitCode)) continue;
    const informationalLines = new Set((rule.informationalLines ?? []).map((line) => line.toLowerCase()));
    const fatalSignatures = rule.fatalSignatures.filter((signature) => signature.trim().length > 0).map((signature) => signature.toLowerCase());
    for (const line of lines) {
      const lowered = line.toLowerCase();
      if (informationalLines.has(lowered)) continue;
      if (fatalSignatures.some((signature) => lowered.includes(signature))) return { detail: line };
    }
  }
  return undefined;
}

/**
 * Khớp một mã thoát KHÁC 0 với các chữ ký stderr KHÔNG phân biệt hoa thường.
 * Nhận: exitCode — mã thoát (null = bị tín hiệu giết); stderr — stderr đã gom; signatures — chuỗi con
 *        nhận diện phương ngữ của backend đã chọn.
 * Trả: true khi là mã thoát khác 0 mà stderr khớp một chữ ký.
 */
export function matchesSignature(exitCode: number | null, stderr: string, signatures: readonly string[]): boolean {
  if (exitCode === null || exitCode === 0) return false;
  const lowered = stderr.toLowerCase();
  return signatures.some((signature) => lowered.includes(signature.toLowerCase()));
}
