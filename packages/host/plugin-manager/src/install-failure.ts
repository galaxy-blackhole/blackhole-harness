/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/install-failure.js' (33 dòng) của @deepseek-ai/dsh-plugin-manager: một lần chạy
 *      pnpm thất bại là gì, đọc từ cách nó kết thúc và những gì nó in ra — pnpm đặt tên lỗi bằng mã ổn định
 *      ERR_PNPM_* và tên errno của Node, thứ mà phần đuôi output thu được mang theo bất kể locale.
 */
import type { PluginInstallFailureKind } from "./types.ts";

/** Cách một lần chạy kết thúc, ngoài mã thoát của nó. */
export interface InstallFailureFacts {
  /** Phần đuôi output mà lỗi báo cáo. */
  readonly log: string;
  /** Lỗi spawn, khi tiến trình con chưa từng chạy. */
  readonly cause?: unknown;
  /** Lần chạy có sống quá giới hạn của nó không. */
  readonly timedOut?: boolean;
}

/** Hình dạng tối thiểu của một lỗi spawn mà bộ phân loại đọc: chỉ errno `code` của Node. */
interface SpawnErrorLike {
  /** Mã errno của Node, ví dụ `ENOENT` khi pnpm không có trên PATH. */
  readonly code?: unknown;
}

/** Các mẫu theo ĐÚNG thứ tự chúng quyết định: một mã cụ thể trước cả họ lỗi mạng chung. */
const LOG_KINDS: readonly (readonly [PluginInstallFailureKind, RegExp])[] = [
  ["build-blocked", /ERR_PNPM_IGNORED_BUILDS|Ignored build scripts/],
  ["not-found", /ERR_PNPM_FETCH_404|\bE404\b|404 Not Found|Not Found - GET/],
  ["no-matching-version", /ERR_PNPM_NO_MATCHING_VERSION|\bETARGET\b|No matching version/],
  ["disk-full", /\bENOSPC\b|no space left on device/i],
  ["permission", /\bEACCES\b|\bEPERM\b|permission denied/i],
  ["integrity", /ERR_PNPM_TARBALL_INTEGRITY|ERR_PNPM_BAD_TARBALL_SIZE|\bEINTEGRITY\b/],
  ["unknown", /The requested URL returned error: 40[134]\b/],
  ["network", /\bENOTFOUND\b|\bECONNRESET\b|\bETIMEDOUT\b|\bECONNREFUSED\b|\bEAI_AGAIN\b|ERR_PNPM_META_FETCH_FAIL|ERR_PNPM_FETCH_5\d\d|ERR_PNPM_FETCH_TIMEOUT|\bFETCH_ERROR\b|socket hang up|Could not resolve host|unable to access/],
];

/**
 * Phân loại một lần chạy thất bại.
 * Nhận: `facts` — cách lần chạy kết thúc và những gì nó in ra (`log`, `cause`, `timedOut`).
 * Trả: loại lỗi (`PluginInstallFailureKind`): `timeout` khi quá giới hạn, `pnpm-missing` khi errno của
 * `cause` là `ENOENT`, ngược lại loại đầu tiên trong `LOG_KINDS` khớp `log`, và `unknown` khi không mẫu nào
 * nêu tên được nó.
 * @throws không ném — chỉ đọc thuộc tính và chạy regex trên chuỗi.
 */
export function classifyInstallFailure(facts: InstallFailureFacts): PluginInstallFailureKind {
  if (facts.timedOut === true) return "timeout";
  if ((facts.cause as SpawnErrorLike | undefined)?.code === "ENOENT") return "pnpm-missing";
  for (const [kind, pattern] of LOG_KINDS) {
    if (pattern.test(facts.log)) return kind;
  }
  return "unknown";
}
