/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chuỗi runner theo nền tảng của sandbox cục bộ: chọn theo nền tảng TRƯỚC, dò chức năng SAU, kèm bảng dialect từ chối + luật lỗi runner của từng rung
 */

import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import type { RunnerFailureRule, SandboxEnforcement } from "@deepseek-ai/dsh-sandbox";
import { LAUNCHER_BIN, LAUNCHER_FAILURE_EXIT } from "@deepseek-ai/node-addon-system/landlock-run";
import { bwrapProfileArgs, seatbeltProfileArgs } from "./profiles.ts";

/** Runner cục bộ mà một nền tảng có thể dùng để cưỡng chế tiến trình. */
export type LocalRunner = "bwrap" | "landlock" | "seatbelt" | "windows-acl";

/** Kết luận của chuỗi runner: runner nào cưỡng chế, và cưỡng chế ĐẦY ĐỦ tới đâu. */
export interface RunnerVerdict {
  /** Runner được chọn cho quãng đời provider. */
  runner: LocalRunner;
  /** Mức cưỡng chế runner ấy đạt được trên host này. */
  enforcement: SandboxEnforcement;
}

/** Kết luận chuỗi: hoặc một runner, hoặc `unavailable` (đóng cửa, lệnh KHÔNG chạy). */
export type ChainVerdict = RunnerVerdict | "unavailable";

/**
 * Chuỗi runner của từng nền tảng — chọn theo NỀN TẢNG trước, dò sau: chuỗi chỉ bị dò khi có NHIỀU hơn một
 * ứng viên (dò để TRỌNG TÀI, không để kiểm lại một lựa chọn không có phương án thay thế). Nền tảng không có
 * chuỗi thì đóng cửa ngay tại `confine()`.
 */
export const PLATFORM_CHAINS: Record<string, readonly LocalRunner[]> = {
  linux: ["bwrap", "landlock"],
  darwin: ["seatbelt"],
  win32: ["windows-acl"],
};

/**
 * Mức cưỡng chế một rung TỰ KHAI khi được chọn KHÔNG qua dò (chuỗi một ứng viên). bwrap và Seatbelt cưỡng
 * chế mọi hiệu ứng tệp đã hứa ngay từ cấu tạo hồ sơ; `landlock` có mặt cho bảng đủ, nhưng chỉ được chọn
 * qua phép dò (chuỗi Linux có hai rung) nên báo cáo của phép dò mới là thứ phân biệt đầy đủ với từng phần ABI.
 */
export const STATIC_ENFORCEMENT: Record<LocalRunner, SandboxEnforcement> = {
  bwrap: "full",
  landlock: "full",
  seatbelt: "full",
  "windows-acl": "partial",
};

/**
 * Phương ngữ TỪ CHỐI của từng runner — các chuỗi con (không phân biệt hoa thường) mà stderr sinh ra khi một
 * hiệu ứng tệp bị chặn dưới runner ấy; đi kèm MỌI lần bọc (hợp đồng `ConfinedArgv.denialSignatures`).
 */
export const DENIAL_SIGNATURES: Record<LocalRunner | "runnerCommand", readonly string[]> = {
  bwrap: ["read-only file system"],
  landlock: ["permission denied"],
  seatbelt: ["operation not permitted"],
  "windows-acl": ["access is denied", "access to the path", "permission denied", "operation not permitted"],
  runnerCommand: ["read-only file system", "permission denied"],
};

/**
 * Chẩn đoán CHÍ TỬ do runner phát. Landlock có hợp đồng exit-125 có phiên bản kèm dòng chí tử; bwrap thoát 1
 * nhưng hợp đồng công khai không giữ mã ấy, còn sandbox-exec không công bố mã lỗi launcher nào — hai backend
 * ấy chỉ còn dấu hiệu chuỗi. Runner windows-acl in `windows-acl-run: <chi tiết>` và thoát 127, nên luật
 * được CHẶN theo mã thoát để một lệnh chỉ IN ra dấu hiệu ấy không bị xếp nhầm thành "lệnh không chạy".
 */
export const RUNNER_FAILURE_RULES: Record<LocalRunner, readonly RunnerFailureRule[]> = {
  bwrap: [{ fatalSignatures: ["bwrap: "] }],
  landlock: [
    {
      allowedExitCodes: [LAUNCHER_FAILURE_EXIT],
      fatalSignatures: [`${LAUNCHER_BIN}: `],
      informationalLines: [`${LAUNCHER_BIN}: partial enforcement (older Landlock ABI)`],
    },
  ],
  seatbelt: [{ fatalSignatures: ["sandbox-exec: "] }],
  "windows-acl": [{ allowedExitCodes: [127], fatalSignatures: ["windows-acl-run: "] }],
};

/**
 * Dò CHỨC NĂNG của bwrap: dựng hồ sơ read-only thật rồi chạy `true` dưới nó.
 * Nhận: trần thời gian của phép dò (ms).
 * Trả: `true` khi tiến trình con thoát 0 (hồ sơ được kernel chấp nhận và cưỡng chế).
 */
export function defaultProbeBwrap(timeoutMs: number): boolean {
  return (
    spawnSync("bwrap", [...bwrapProfileArgs({ mode: "read-only", workspaceRoot: "/" }), "--", "true"], {
      timeout: timeoutMs,
      stdio: "ignore",
    }).status === 0
  );
}

/**
 * Dò CHỨC NĂNG của Seatbelt: áp hồ sơ `read-only` thật qua `sandbox-exec -p` rồi chạy `true`.
 * Nhận: tệp sandbox-exec sẽ gọi, và trần thời gian (ms).
 * Trả: `true` khi thoát 0 — thiếu `sandbox-exec` (mọi host không phải macOS) thì spawn hỏng ⇒ `false`.
 */
export function defaultProbeSeatbelt(seatbeltExec: string, timeoutMs: number): boolean {
  return (
    spawnSync(seatbeltExec, [...seatbeltProfileArgs({ mode: "read-only", workspaceRoot: "/" }), "--", "true"], {
      timeout: timeoutMs,
      stdio: "ignore",
    }).status === 0
  );
}

/**
 * Dò CHỨC NĂNG của windows-acl: chạy runner ở chế độ read-only (không grant, không sửa ACL) quanh
 * `cmd /c exit 0`.
 * Nhận: tiền tố argv của runner, và trần thời gian (ms).
 * Trả: `true` khi thoát 0 (runner tạo được token hạn chế và spawn con dưới nó).
 */
export function defaultProbeWindowsAcl(runnerInvocation: readonly string[], timeoutMs: number): boolean {
  const program = runnerInvocation[0];
  if (program === undefined) return false;
  return (
    spawnSync(
      program,
      [
        ...runnerInvocation.slice(1),
        "--workspace",
        tmpdir(),
        "--temp",
        tmpdir(),
        "--mode",
        "read-only",
        "--",
        "cmd",
        "/c",
        "exit",
        "0",
      ],
      { timeout: timeoutMs, stdio: "ignore" },
    ).status === 0
  );
}

/**
 * Kiểm một trần thời gian phải là số DƯƠNG hữu hạn: Node coi `spawnSync({ timeout: 0 })` là KHÔNG có trần,
 * nên một số 0 chưa kiểm sẽ lặng lẽ mang nghĩa "vô hạn" — ngược hẳn lời hứa của trường.
 * Nhận: tên trường (để thông điệp lỗi) và giá trị.
 * Trả: không trả gì; ném Error khi giá trị không dương hoặc không hữu hạn.
 */
export function assertPositiveFinite(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`sandbox-local: ${name} must be a positive finite number`);
}

/**
 * Chốt nhánh KHÔNG BAO GIỜ tới của một union đã vét cạn — ném thay vì trả một giá trị bịa.
 * Nhận: giá trị đã thu về `never`.
 * Trả: không bao giờ trả; ném Error mang chính giá trị ấy.
 */
export function assertNever(value: never): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant: ${rendered}`);
}
