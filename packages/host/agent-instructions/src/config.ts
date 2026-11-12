/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chuẩn hoá cấu hình cho việc dò + kết xuất chỉ dẫn workspace — port 1:1 vùng config
 *      (stock lib/index.js 10–89 = region lib/types/config.js) của @deepseek-ai/dsh-agent-instructions.
 */
import { relative } from "node:path";
import { resolveAgentsHome, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import z from "@deepseek-ai/schemastery";

/** Marker thư mục gốc dự án mặc định (stock lib/index.js:16). */
const DEFAULT_PROJECT_ROOT_MARKERS = [".git"];

/** Tên tệp chỉ dẫn gốc mặc định (stock lib/index.js:17). */
const DEFAULT_INSTRUCTION_FILE_CANDIDATES = ["AGENTS.md", "CLAUDE.md"];

/** Tên tệp chỉ dẫn ghi đè cục bộ mặc định (stock lib/index.js:18). */
const DEFAULT_LOCAL_INSTRUCTION_FILE_CANDIDATES = ["AGENTS.local.md", "CLAUDE.local.md"];

/** Trần byte đọc từ MỘT tệp chỉ dẫn, mặc định 1 MiB (stock lib/index.js:19). */
const DEFAULT_MAX_SOURCE_BYTES = 1048576;

/** Đoạn đường dẫn không bao giờ được nhận làm tên ứng viên tệp chỉ dẫn (stock lib/index.js:20–24). */
const RESERVED_PATH_SEGMENTS = new Set(["", ".", ".."]);

/** Cấu hình dò chỉ dẫn workspace do người dùng khai (stock lib/types/config.d.ts:8–25). */
export interface Config {
  /** Các mục thư mục nhận ra gốc dự án khi đi ngược lên từ thư mục làm việc hiện tại. */
  projectRootMarkers?: string[];
  /** Trần byte UTF-8 cho một baseline hoặc một lô động đã kết xuất; không dương hoặc không hữu hạn thì tắt nạp. */
  maxBytes: number;
  /** Số byte UTF-8 tối đa đọc từ một tệp chỉ dẫn; tệp lớn hơn bị bỏ qua. */
  maxSourceBytes?: number;
  /**
   * Ứng viên tệp chỉ dẫn dự án TRONG CÙNG thư mục, theo thứ tự; mọi tệp tồn tại đều được nạp, với
   * nội dung trùng (sau khi trim) trong một thư mục bị gộp về ứng viên sớm nhất.
   */
  instructionFileCandidates?: string[];
  /**
   * Ứng viên tệp ghi đè cục bộ trong cùng thư mục, nạp SAU các tệp gốc dưới cùng phép gộp trùng
   * theo thư mục; danh sách rỗng thì tắt phần ghi đè.
   */
  localInstructionFileCandidates?: string[];
}

/** Schema cấu hình chỉ dẫn workspace — giữ nguyên thứ tự + mặc định của stock (lib/index.js:25–31). */
export const Config: z<Config> = z.object({
  projectRootMarkers: z.array(z.string()).default([...DEFAULT_PROJECT_ROOT_MARKERS]),
  maxBytes: z.number().required(),
  maxSourceBytes: z.number().step(1).min(1).default(DEFAULT_MAX_SOURCE_BYTES),
  instructionFileCandidates: z.array(z.string()).default([...DEFAULT_INSTRUCTION_FILE_CANDIDATES]),
  localInstructionFileCandidates: z.array(z.string()).default([...DEFAULT_LOCAL_INSTRUCTION_FILE_CANDIDATES]),
}) as unknown as z<Config>;

/** Cấu hình dò chỉ dẫn đã chuẩn hoá (stock lib/types/config.d.ts:27–33). */
export interface ResolvedDiscoveryConfig {
  /** Gốc dữ liệu harness đã giải (DSH_HOME, mặc định ~/.dsh). */
  dshHome: string;
  /** Gốc cấu hình agent dùng chung đã giải (DSH_AGENTS_HOME, mặc định ~/.agents). */
  agentsHome: string;
  /** Marker gốc dự án sau chuẩn hoá. */
  projectRootMarkers: string[];
  /** Ứng viên tệp chỉ dẫn dự án đã lọc hợp lệ. */
  instructionFileCandidates: string[];
  /** Ứng viên tệp ghi đè cục bộ đã lọc hợp lệ. */
  localInstructionFileCandidates: string[];
}

/** Cấu hình đầy đủ dùng cho dò + đối soát (stock lib/types/config.d.ts:35–39). */
export interface ResolvedConfig extends ResolvedDiscoveryConfig {
  /** Trần byte của một lần kết xuất. */
  maxBytes: number;
  /** Trần byte đọc từ một tệp nguồn. */
  maxSourceBytes: number;
}

/**
 * Nhận diện ngữ nghĩa dò, thứ tự ưu tiên và ngân sách byte của MỘT baseline.
 * Nhận: config — cấu hình plugin đã chuẩn hoá; cwd — thư mục làm việc tuyệt đối của phiên;
 *      projectRoot — gốc dự án đã chọn cho baseline hiện tại.
 * Trả: chuỗi định danh ổn định để kiểm tra tương thích khi khôi phục phiên (stock lib/index.js:39–48).
 */
export function workspaceBaselineIdentity(config: ResolvedConfig, cwd: string, projectRoot: string): string {
  return JSON.stringify({
    projectRoot: relative(cwd, projectRoot),
    projectRootMarkers: config.projectRootMarkers,
    maxBytes: config.maxBytes,
    maxSourceBytes: config.maxSourceBytes,
    instructionFileCandidates: config.instructionFileCandidates,
    localInstructionFileCandidates: config.localInstructionFileCandidates,
  });
}

/**
 * Giải mặc định của row, gốc harness của TIẾN TRÌNH và các ứng viên cùng thư mục hợp lệ.
 * Trường row không khai thì không thể ghi đè gốc của tiến trình.
 * Nhận: config — cấu hình plugin do người dùng khai.
 * Trả: cấu hình runtime đã chuẩn hoá (stock lib/index.js:55–65).
 */
export function resolveConfig(config: Config): ResolvedConfig {
  return {
    ...resolveDiscoveryConfig({
      ...(config.projectRootMarkers === undefined ? {} : { projectRootMarkers: config.projectRootMarkers }),
      ...(config.instructionFileCandidates === undefined
        ? {}
        : { instructionFileCandidates: config.instructionFileCandidates }),
      ...(config.localInstructionFileCandidates === undefined
        ? {}
        : { localInstructionFileCandidates: config.localInstructionFileCandidates }),
    }),
    maxBytes: config.maxBytes,
    maxSourceBytes: config.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES,
  };
}

/**
 * Giải phần cấu hình dùng TRƯỚC khi nội dung chỉ dẫn được kết xuất.
 *
 * Gốc harness lấy từ môi trường tiến trình qua resolveDshHome; row không thể trỏ việc nạp chỉ dẫn
 * sang gốc thứ hai mà các consumer khác của harness không dùng chung. Chủ sở hữu đã giải gốc thì truyền
 * dshHome và agentsHome, và chúng được chuẩn hoá tại đây để dò + đối soát dùng cùng một giá trị.
 * Nhận: config — điều khiển dò tuỳ chọn kèm hai gốc đã giải.
 * Trả: gốc, marker gốc dự án và ứng viên tệp chỉ dẫn đã chuẩn hoá (stock lib/index.js:77–85).
 */
export function resolveDiscoveryConfig(
  config: Pick<Config, "projectRootMarkers" | "instructionFileCandidates" | "localInstructionFileCandidates"> & {
    dshHome?: string;
    agentsHome?: string;
  },
): ResolvedDiscoveryConfig {
  return {
    dshHome: resolveDshHome(config.dshHome),
    agentsHome: resolveAgentsHome(config.agentsHome),
    projectRootMarkers: config.projectRootMarkers ?? [...DEFAULT_PROJECT_ROOT_MARKERS],
    instructionFileCandidates: resolveInstructionFileCandidates(
      config.instructionFileCandidates,
      DEFAULT_INSTRUCTION_FILE_CANDIDATES,
    ),
    localInstructionFileCandidates: resolveInstructionFileCandidates(
      config.localInstructionFileCandidates,
      DEFAULT_LOCAL_INSTRUCTION_FILE_CANDIDATES,
    ),
  };
}

/**
 * Lọc danh sách ứng viên tệp chỉ dẫn: bỏ đoạn đường dẫn dành riêng và mọi tên chứa dấu phân cách.
 * Nhận: candidates — danh sách người dùng khai (có thể vắng); fallback — danh sách mặc định.
 * Trả: danh sách ứng viên còn hợp lệ, giữ nguyên thứ tự (stock lib/index.js:86–88).
 */
function resolveInstructionFileCandidates(candidates: string[] | undefined, fallback: readonly string[]): string[] {
  return (candidates ?? [...fallback]).filter(
    (candidate) => !RESERVED_PATH_SEGMENTS.has(candidate) && !/[\\/]/.test(candidate),
  );
}
