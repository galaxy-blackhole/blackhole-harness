/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cấu hình và hằng số của skill-filesystem — port NGUYÊN VĂN region config của bundle gốc
 *      @galaxy-blackhole/gbh-skill-filesystem: name, inject, Config (schemastery), 5 rank root,
 *      4 hằng watcher, và bộ kiểm resolveWatchConfig/assertPositiveInteger.
 */

import z from "@deepseek-ai/schemastery";
import type { SkillSummary } from "@galaxy-blackhole/gbh-skill";

/**
 * Rank của root kỹ năng dự án `.dsh/skills` (thấp hơn thì thắng khi trùng tên).
 * Nhận: không.
 * Trả: hằng số 100.
 */
export const PROJECT_COMPAT_RANK = 100;

/**
 * Rank của root kỹ năng dự án `.agents/skills`.
 * Nhận: không.
 * Trả: hằng số 200.
 */
export const PROJECT_AGENTS_RANK = 200;

/**
 * Rank của các root tuỳ biến do người dùng cấu hình.
 * Nhận: không.
 * Trả: hằng số 300.
 */
export const CUSTOM_RANK = 300;

/**
 * Rank của root kỹ năng người dùng `<dshHome>/skills`.
 * Nhận: không.
 * Trả: hằng số 400.
 */
export const USER_COMPAT_RANK = 400;

/**
 * Rank của root kỹ năng người dùng `<agentsHome>/skills`.
 * Nhận: không.
 * Trả: hằng số 500.
 */
export const USER_AGENTS_RANK = 500;

/**
 * Độ ổn định mặc định (ms) trước khi một thay đổi kỹ năng được quan sát.
 * Nhận: không.
 * Trả: hằng số 200.
 */
export const DEFAULT_WATCH_STABILITY_THRESHOLD_MS = 200;

/**
 * Chu kỳ thăm dò mặc định (ms) của watcher.
 * Nhận: không.
 * Trả: hằng số 100.
 */
export const DEFAULT_WATCH_POLL_INTERVAL_MS = 100;

/**
 * Số dự án tối đa được giữ watcher cùng lúc.
 * Nhận: không.
 * Trả: hằng số 128.
 */
export const DEFAULT_WATCH_MAX_PROJECTS = 128;

/**
 * Tên plugin provider mà `ctx.skills` dùng để đăng ký.
 * Nhận: không.
 * Trả: chuỗi `"skill-filesystem"` y bản gốc.
 */
export const name = "skill-filesystem";

/**
 * Service mà plugin này cần có trước khi chạy (`ctx.skills`).
 * Nhận: không.
 * Trả: mảng một phần tử `["skills"]` y bản gốc.
 */
export const inject = ["skills"];

/**
 * Cấu hình của provider kỹ năng trên filesystem (y bản gốc index.d.ts).
 * Nhận: không (chỉ là kiểu).
 * Trả: hình dạng object cấu hình với mọi field tuỳ chọn.
 */
export interface Config {
  /** Tên provider duy nhất. Mặc định `filesystem`. */
  providerName?: string;
  /** Có gồm root dự án và root người dùng quanh các root tuỳ biến hay không. */
  includeDefaultRoots?: boolean;
  /** Gốc cấu hình harness (biến môi trường home, mặc định trong thư mục home người dùng). */
  dshHome?: string;
  /** Gốc cấu hình agent dùng chung. Mặc định `$DSH_AGENTS_HOME` hoặc `~/.agents`. */
  agentsHome?: string;
  /** Các root kỹ năng bổ sung, quét sau root dự án và trước root người dùng. */
  customSkillDirs?: string[];
  /** Có theo dõi các root kỹ năng cục bộ để cập nhật catalog hay không. */
  watch?: boolean;
  /** Chokidar dùng polling thay vì sự kiện filesystem gốc hay không. */
  watchUsePolling?: boolean;
  /** Số mili-giây một mục kỹ năng đã đổi phải ổn định trước khi được quan sát. */
  watchStabilityThresholdMs?: number;
  /** Số mili-giây giữa các lần thăm dò ổn định/polling của Chokidar. */
  watchPollIntervalMs?: number;
  /** Số root dự án tối đa còn được theo dõi thư mục kỹ năng. */
  watchMaxProjects?: number;
  /** Có đi theo tệp đích của liên kết tượng trưng đang được theo dõi hay không. */
  watchFollowSymlinks?: boolean;
  /** Root kỹ năng đóng gói; mặc định `$DSH_BUNDLED_SKILL_DIR` khi gồm root mặc định, ngược lại không mount. */
  bundledSkillDir?: string;
}

/**
 * Schema cấu hình mà loader dùng để kiểm và điền mặc định — giữ NGUYÊN VĂN thứ tự field,
 * kiểu, giá trị mặc định và chuỗi lỗi của bundle gốc.
 * Nhận: object cấu hình thô (mọi field đều tuỳ chọn).
 * Trả: object đã kiểm, đã điền mặc định (providerName "filesystem", watch true, …).
 * @throws {Error} ValidationError của schemastery khi field sai kiểu/rỗng.
 */
export const Config: z<Config> = z.object({
  providerName: z.string().min(1).default("filesystem"),
  includeDefaultRoots: z.boolean().default(true),
  dshHome: z.string(),
  agentsHome: z.string(),
  customSkillDirs: z.array(z.string()).default([]),
  watch: z.boolean().default(true),
  watchUsePolling: z.boolean().default(false),
  watchStabilityThresholdMs: z.number().default(DEFAULT_WATCH_STABILITY_THRESHOLD_MS),
  watchPollIntervalMs: z.number().default(DEFAULT_WATCH_POLL_INTERVAL_MS),
  watchMaxProjects: z.number().default(DEFAULT_WATCH_MAX_PROJECTS),
  watchFollowSymlinks: z.boolean().default(true),
  bundledSkillDir: z.string(),
});

/**
 * Một root kỹ năng đã chuẩn hoá cùng rank/nguồn/cờ tin cậy.
 * Nhận: không (chỉ là kiểu).
 * Trả: hình dạng root mà provider dùng để khám phá/watch.
 */
export interface SkillRoot {
  /** Đường dẫn tuyệt đối của root. */
  path: string;
  /** Nguồn công bố cho candidate (project-dsh, custom, bundled, …). */
  source: SkillSummary["source"];
  /** Rank thấp hơn thắng khi trùng tên trong cùng một lớp. */
  rank: number;
  /** Root dự án sở hữu root này (chỉ root dự án mới có). */
  projectRoot?: string;
  /** Bỏ qua thư mục hệ thống `.system` khi quét (root người dùng). */
  skipSystem?: boolean;
  /** Root do host tin cậy nên đọc trực tiếp bằng Node, không qua ctx.fs. */
  trustedHost?: boolean;
}

/**
 * Cấu hình watcher đã chuẩn hoá (mọi field bắt buộc).
 * Nhận: không (chỉ là kiểu).
 * Trả: hình dạng cấu hình watcher đã điền mặc định.
 */
export interface WatchConfig {
  /** Watcher có bật hay không. */
  enabled: boolean;
  /** Dùng polling thay vì sự kiện gốc. */
  usePolling: boolean;
  /** Độ ổn định (ms) trước khi quan sát thay đổi. */
  stabilityThresholdMs: number;
  /** Chu kỳ thăm dò (ms). */
  pollIntervalMs: number;
  /** Số dự án tối đa được theo dõi. */
  maxProjects: number;
  /** Có đi theo liên kết tượng trưng hay không. */
  followSymlinks: boolean;
}

/**
 * Chuẩn hoá cấu hình watcher và kiểm ba ngưỡng là số nguyên dương — giữ nguyên thứ tự kiểm
 * (stabilityThresholdMs, pollIntervalMs, maxProjects) và giá trị mặc định của bản gốc.
 * Nhận: config — cấu hình provider (mọi field tuỳ chọn).
 * Trả: {@link WatchConfig} đầy đủ field.
 * @throws {TypeError} khi một trong ba ngưỡng không phải số nguyên dương.
 */
export function resolveWatchConfig(config: Config): WatchConfig {
  const stabilityThresholdMs = config.watchStabilityThresholdMs ?? DEFAULT_WATCH_STABILITY_THRESHOLD_MS;
  const pollIntervalMs = config.watchPollIntervalMs ?? DEFAULT_WATCH_POLL_INTERVAL_MS;
  const maxProjects = config.watchMaxProjects ?? DEFAULT_WATCH_MAX_PROJECTS;
  assertPositiveInteger("watchStabilityThresholdMs", stabilityThresholdMs);
  assertPositiveInteger("watchPollIntervalMs", pollIntervalMs);
  assertPositiveInteger("watchMaxProjects", maxProjects);
  return {
    enabled: config.watch ?? true,
    usePolling: config.watchUsePolling ?? false,
    stabilityThresholdMs,
    pollIntervalMs,
    maxProjects,
    followSymlinks: config.watchFollowSymlinks ?? true,
  };
}

/**
 * Bắt buộc một ngưỡng là số nguyên dương — giữ nguyên văn thông điệp lỗi của bản gốc.
 * Nhận: field — tên trường trong thông điệp; value — giá trị cần kiểm.
 * Trả: không trả gì khi hợp lệ.
 * @throws {TypeError} khi value không phải số nguyên hoặc nhỏ hơn 1.
 */
export function assertPositiveInteger(field: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`skill-filesystem: ${field} must be a positive integer`);
}
