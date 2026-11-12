/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm kho GitHub CÓ GIỚI HẠN bằng cấu hình Git và môi trường của trình cài đặt: trước khi pnpm
 *      chạy, `git ls-remote` chỉ-đọc xác nhận kho truy cập được (không tải, không build gói), ghi log
 *      đầy đủ vào `logPath`, giữ đầu ra bị cắt theo `outputBytes`, và hết hạn/huỷ kết liễu CẢ cây
 *      tiến trình con — còn xác thực và dự phòng vận chuyển vẫn thuộc pnpm.
 */

import { mkdir, mkdtemp, open } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
import { classifyInstallFailure } from "./install-failure.ts";
import type { ParsedInstallSpec } from "./install-spec.ts";
import type { PackageResult } from "./types.ts";

/**
 * Hạn chờ, chẩn đoán và huỷ cho MỘT lượt kiểm GitHub chỉ-đọc.
 * Nhận: `timeoutMs` (hạn chờ, mili giây), `outputBytes` (trần byte đầu ra giữ lại), `signal` (tín
 *      hiệu huỷ thao tác) và `env` tuỳ chọn — môi trường của trình quản lý gói do ứng dụng sở hữu.
 * Trả: hợp đồng tham số cho `checkGithubConnection`; không sinh giá trị lúc chạy.
 */
export interface GithubConnectionOptions {
  timeoutMs: number;
  outputBytes: number;
  signal: AbortSignal;
  /** Môi trường của trình quản lý gói do ứng dụng sở hữu, cũng dùng cho các tiến trình Git con. */
  env?: Readonly<Record<string, string>>;
}

/**
 * Kiểm kho GitHub TRƯỚC khi pnpm chạy, không tải và không build gói của nó. Git đọc cấu hình Git và
 * proxy của profile mà không gọi credential helper hay hỏi mật khẩu. Hết hạn và huỷ cũng kết liễu các
 * tiến trình con; pnpm vẫn sở hữu xác thực và dự phòng vận chuyển.
 * Nhận: `spec` — địa chỉ cài đã đọc (gói npm, đường dẫn cục bộ và host khác KHÔNG bị kiểm);
 *      `dir` — thư mục profile nơi lệnh cài chạy; `options` — hạn chờ, trần đầu ra và tín hiệu huỷ.
 * Trả: một kiểm THẤT BẠI kèm đầu ra có giới hạn và log đầy đủ ở `logPath`, hoặc `undefined` khi kho
 *      truy cập được hoặc spec không thuộc diện được kiểm.
 * @throws Lỗi hệ thống tệp khi tạo thư mục log, thư mục tạm, mở/đọc tệp log; lỗi của `execa` khi
 *      không khởi chạy được tiến trình Git (các kiểu hỏng của chính lượt kiểm được trả về, không ném).
 */
export async function checkGithubConnection(
  spec: ParsedInstallSpec,
  dir: string,
  options: GithubConnectionOptions,
): Promise<PackageResult | undefined> {
  if (spec.kind !== "git") return undefined;
  const host = spec.host.toLowerCase().replace(/:.*$/, "");
  if (host !== "github.com" && !host.endsWith(".github.com")) return undefined;
  const repository = spec.spec.replace(/#.*$/s, "")
    .replace(/^github:/i, "https://github.com/")
    .replace(/^gist:/i, "https://gist.github.com/")
    .replace(/^git\+/i, "");
  const logRoot = join(dir, ".plugin-manager", "logs");
  await mkdir(logRoot, { recursive: true, mode: 0o700 });
  const logDir = await mkdtemp(join(logRoot, "github-connection-"));
  const logPath = join(logDir, "git.log");
  const log = await open(logPath, "ax+", 0o600);
  try {
    const result = await execa("git", ["-c", "credential.helper=", "ls-remote", "--", repository, "HEAD"], {
      cwd: dir,
      env: {
        ...scrubbedParentEnv(), ...options.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "", SSH_ASKPASS: "", SSH_ASKPASS_REQUIRE: "never",
      },
      extendEnv: false,
      stdin: "ignore", stdout: "ignore", stderr: { file: logPath, append: true }, buffer: false, reject: false,
      timeout: options.timeoutMs, cancelSignal: options.signal, killDescendants: true, killSignal: "SIGKILL",
    });
    if (!result.failed) return undefined;
    if (result.timedOut)
      await log.write(`gbh: connection to ${spec.host} timed out after ${String(options.timeoutMs)}ms\n`);
    if ((await log.stat()).size === 0)
      await log.write(result.shortMessage ?? "GitHub connection check failed");
    const { size } = await log.stat();
    const bytes = Buffer.alloc(Math.min(size, options.outputBytes));
    await log.read(bytes, 0, bytes.length, size - bytes.length);
    const output = bytes.toString("utf8");
    return {
      exitCode: result.exitCode ?? (result.code === "ENOENT" ? 127 : 1), output, truncated: size > options.outputBytes, logPath,
      kind: classifyInstallFailure({ log: output, timedOut: result.timedOut }),
    };
  } finally {
    await log.close();
  }
}
