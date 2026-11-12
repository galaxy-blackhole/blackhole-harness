/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chạy một argv CÓ HẠN, HUỶ ĐƯỢC, dưới chính sách tệp hiện có của phiên gọi — nguyên văn
 *      lib/types/process.js của bản gốc (bản viết lại, không chép mã).
 */

import { deadline } from "@deepseek-ai/dsh-timeout";

import type { SandboxExecutionPolicyLike, SandboxModeLike, SubprocessOutputReaderLike, WorktreeSeams } from "./seams.ts";
import type { Environment, ProcessConfig } from "./types.ts";

/** Mã hạn chót do chính năng lực này sở hữu; `timeoutOf` phân biệt nó với hạn chót lồng của bên khác. */
export const WORKTREE_TIMEOUT = "WORKTREE_TIMEOUT";

/**
 * Mười lăm bộ chọn Git phải XOÁ khỏi môi trường tiến trình con: repo, cây thuộc tính, cấu hình qua
 * dòng lệnh, và các gốc replacement-ref. Giá trị `undefined` là BIA MỘ (tombstone) — seam tiến trình
 * con hiểu `undefined` là "xoá biến thường của môi trường cha", nên một `GIT_DIR` thừa hưởng từ phiên
 * agent không thể đổi repo mà lệnh nhìn thấy.
 */
export const GIT_SELECTORS: readonly string[] = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_CEILING_DIRECTORIES",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_GRAFT_FILE",
  "GIT_REPLACE_REF_BASE",
  "GIT_ATTR_SOURCE",
];

/** Môi trường nền của MỌI lệnh Git của row này: mười lăm bia mộ, dựng một lần. */
export const GIT_ENV: Environment = Object.fromEntries(GIT_SELECTORS.map((key) => [key, undefined]));

/** Kết quả một lệnh đã chạy: đuôi đầu ra đã thu và mã thoát. */
export interface CommandResult {
  /** Toàn bộ stdout đã thu (đuôi khi bị cắt) — KHÔNG rò dữ liệu nào khác. */
  readonly stdout: string;
  /** Mã thoát của lệnh. */
  readonly exitCode: number;
}

/**
 * Chạy một argv không qua shell và chờ dải tiến trình được quản lý kết thúc hẳn.
 * Nhận: seams — nhà cung cấp tiến trình con + nhà cung cấp sandbox của cùng một thế giới thi hành;
 *       config — hạn tài nguyên đầy đủ của lượt chạy; policy — chính sách tệp NGUYÊN VẸN của phiên gọi;
 *       cwd — thư mục làm việc đã chuẩn hoá; argv — tệp thi hành + tham số nguyên văn;
 *       signal — huỷ lượt chạy; allowedExitCodes — mã thoát được coi là thành công của RIÊNG lệnh này;
 *       env — biến môi trường riêng của lệnh, áp SAU khi đã xoá bộ chọn Git.
 * Trả: stdout đầy đủ (đã giới hạn) và mã thoát. Ném khi hết hạn, khi bị huỷ, khi argv không chạy được,
 *       khi mã thoát ngoài danh sách cho phép, hoặc khi stdout vượt maxOutputBytes.
 */
export async function runCommand(
  seams: WorktreeSeams,
  config: ProcessConfig,
  policy: SandboxExecutionPolicyLike,
  cwd: string,
  argv: readonly [string, ...string[]],
  signal: AbortSignal,
  allowedExitCodes: readonly number[] = [0],
  env: Environment = {},
): Promise<CommandResult> {
  const timeout = deadline(signal, config.timeoutMs, WORKTREE_TIMEOUT);
  try {
    timeout.signal.throwIfAborted();
    const command = [await seams.subprocess.resolveExecutable(argv[0], undefined, timeout.signal), ...argv.slice(1)];
    // Chế độ toàn-quyền KHÔNG đi qua nhà cung cấp cưỡng chế; mọi chế độ khác phải được bọc, và lỗi của
    // nhà cung cấp đi thẳng ra ngoài (đóng an toàn — không bao giờ chạy trần khi đáng lẽ phải cưỡng chế).
    const wrapped =
      policy.mode === "danger-full-access"
        ? command
        : (
            await seams.sandbox.confine(
              command,
              // Bản gốc chép nguyên chính sách rồi đặt lại đúng `mode` (một vật thể MỚI, cùng giá trị);
              // nhánh toàn-quyền đã trả về ở trên nên chế độ ở đây chắc chắn là chế độ cưỡng chế.
              { ...policy, mode: policy.mode as Exclude<SandboxModeLike, "danger-full-access"> },
              timeout.signal,
            )
          ).argv;
    timeout.signal.throwIfAborted();
    const child = seams.subprocess.spawn({
      argv: wrapped,
      cwd,
      env: {
        ...GIT_ENV,
        GIT_TERMINAL_PROMPT: "0",
        GIT_LFS_SKIP_SMUDGE: "1",
        GIT_NO_LAZY_FETCH: "1",
        ...env,
      },
      signal: timeout.signal,
      graceMs: config.graceMs,
      stdio: {
        stdin: "ignore",
        stdout: { maxBytes: config.maxOutputBytes },
        stderr: { maxBytes: config.maxOutputBytes },
      },
    });
    try {
      const outcome = await child.done;
      timeout.signal.throwIfAborted();
      const captured = child.collected;
      // Bản gốc đọc thẳng bộ đọc của hai luồng collect (stdio ở trên LUÔN yêu cầu thu cả hai) — giữ đúng
      // hình dạng đó thay vì thêm một phép kiểm lúc chạy mà bản gốc không có.
      const stdout = (captured.stdout as SubprocessOutputReaderLike).readFrom(0);
      const stderr = (captured.stderr as SubprocessOutputReaderLike).readFrom(0);
      if (outcome.exitCode === null || !allowedExitCodes.includes(outcome.exitCode)) {
        throw new Error(`worktree command failed (${outcome.signal ?? outcome.exitCode}): ${stderr.text.trim()}`);
      }
      if (stdout.lossy) throw new Error("worktree command output exceeds maxOutputBytes");
      return { stdout: stdout.text, exitCode: outcome.exitCode };
    } finally {
      child.terminate();
      await child.waitForExit();
    }
  } finally {
    timeout[Symbol.dispose]();
  }
}
