/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu dùng chung của seam sandbox: chế độ file-effect, chính sách theo TỪNG lượt gọi, argv đã bọc,
 *      luật nhận diện runner hỏng — port 1:1 lib/types/index.d.ts của @deepseek-ai/dsh-sandbox
 */

import type { SessionId } from "@deepseek-ai/dsh-session";

/**
 * Chế độ file-effect cho tiến trình bị cầm giữ: `read-only` chỉ cho các sink bắt buộc như `/dev/null`;
 * `workspace-write` thêm workspace + vùng tạm; `danger-full-access` bỏ hẳn cầm giữ.
 */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** Chế độ CÓ cầm giữ (mọi chế độ trừ `danger-full-access`) — thứ một {@link SandboxPolicy} mang được. */
export type ConfinedSandboxMode = Exclude<SandboxMode, "danger-full-access">;

/**
 * Chính sách file-effect đã giải cho MỘT lượt gọi. Gốc workspace vẫn được mang cả ở chế độ không dùng tới
 * để bên gọi giải chính sách MỘT lần trước khi chọn đường cưỡng chế.
 */
export interface SandboxExecutionPolicy {
  /** Chế độ file-effect của lượt chạy này. */
  mode: SandboxMode;
  /** Thư mục gốc TUYỆT ĐỐI mà `workspace-write` được ghi dưới. */
  workspaceRoot: string;
  /** Danh tính phiên gọi (SessionId brand của `dsh-session`); vắng ở lượt gọi không có agent. */
  sessionId?: SessionId;
}

/**
 * Mức ĐẦY ĐỦ của cưỡng chế trên host này. `partial` nghĩa là backend đang bật hoặc ABI nhân cũ không
 * cai quản được mọi hiệu ứng file đã hứa — bên gọi cần ranh giới tuyệt đối KHÔNG được coi là `full`.
 */
export type SandboxEnforcement = "full" | "partial";

/**
 * Thứ MỘT lượt chạy bị cầm giữ được chạm — mang THEO TỪNG LƯỢT, không cố định trên provider: hai bên
 * gọi có thể cầm giữ dưới chính sách khác nhau cùng lúc, và một lượt thử lại đã được duyệt là lượt MỚI
 * với chính sách rộng hơn.
 */
export interface SandboxPolicy extends SandboxExecutionPolicy {
  /** Chế độ file-effect của lượt chạy này (đã hẹp hoá: chỉ chế độ có cầm giữ). */
  mode: ConfinedSandboxMode;
}

/**
 * Bằng chứng nhận diện runner sandbox hỏng TRƯỚC khi nó chạy lệnh được bọc: áp `allowedExitCodes` (nếu có),
 * bỏ `informationalLines` bằng SO KHỚP CẢ DÒNG không phân biệt hoa thường, rồi dò `fatalSignatures` trong
 * từng dòng stderr còn lại. Mã thoát một mình KHÔNG BAO GIỜ chứng minh runner hỏng.
 */
export interface RunnerFailureRule {
  /** Mã thoát KHÁC 0 mà luật này được phép khớp; bỏ trống = mọi mã khác 0. */
  allowedExitCodes?: readonly number[];
  /** Chuỗi con KHÁC RỖNG nhận diện chẩn đoán hỏng của runner trên MỘT dòng stderr. */
  fatalSignatures: readonly string[];
  /** Dòng stderr vô hại bị loại bằng SO KHỚP CẢ DÒNG trước khi dò chữ ký hỏng. */
  informationalLines?: readonly string[];
}

/**
 * Kết quả {@link SandboxProvider.confine}: argv để spawn THAY CHO argv của bên gọi, cộng mức đầy đủ mà
 * backend đã chọn đạt được cho nó.
 */
export interface ConfinedArgv {
  /** Argv đã bọc (runner, hồ sơ, dấu phân cách, rồi argv của bên gọi). */
  argv: string[];
  /** Mức đầy đủ của cưỡng chế file-effect theo chính sách. */
  enforcement: SandboxEnforcement;
  /** Phương ngữ TỪ CHỐI của backend đã chọn (chuỗi con stderr, không phân biệt hoa thường). */
  denialSignatures: readonly string[];
  /** Luật bằng chứng runner hỏng có cấu trúc. */
  runnerFailureRules: readonly RunnerFailureRule[];
}
