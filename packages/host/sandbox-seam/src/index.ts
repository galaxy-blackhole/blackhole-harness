/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Seam năng lực cầm giữ tiến trình CÙNG THẾ GIỚI (`ctx.sandbox`): bọc argv chính xác dưới chính sách file
 *      theo đường của host — port 1:1 lib/index.js của @deepseek-ai/dsh-sandbox (289 dòng, 16 export)
 *
 *      GÓI NÀY THAY `@deepseek-ai/dsh-sandbox` (seam trừu tượng), KHÔNG phải `dsh-sandbox-local`
 *      (`@galaxy-blackhole/gbh-sandbox` đã là bản của local). Là THƯ VIỆN: consumer inline (import trực tiếp),
 *      KHÔNG mount ⇒ KHÔNG khai gbh.row.
 */

import { Service } from "@deepseek-ai/cordis";
import { HarnessError } from "@deepseek-ai/dsh-llm";

import type { ConfinedArgv, ConfinedSandboxMode, SandboxPolicy } from "./types.ts";

export { ESCALATION_TARGETS, WIDER_MODES, approveEscalation, escalationHintMarker, sandboxDenialMarker, sandboxPermissionsDescription, validateEscalationArgs } from "./escalation.ts";
export type { EscalationApproval, EscalationApprover, EscalationOutcome, EscalationRequest } from "./escalation.ts";
export { canonicalPath, writableRoots } from "./roots.ts";
export { classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature } from "./diagnostics.ts";
export type {
  ConfinedArgv,
  ConfinedSandboxMode,
  RunnerFailureRule,
  SandboxEnforcement,
  SandboxExecutionPolicy,
  SandboxMode,
  SandboxPolicy,
} from "./types.ts";

/**
 * Mã lỗi cho một chế độ bị cầm giữ được yêu cầu khi KHÔNG có backend dùng được. Provider đóng cửa khi hỏng,
 * và `HarnessError` mang mã này qua `tool/result` để bên gọi phân biệt được "thiếu cầm giữ" với "lệnh hỏng".
 */
export const SANDBOX_UNAVAILABLE = "SANDBOX_UNAVAILABLE";

/**
 * Ném khi {@link SandboxProvider.confine} KHÔNG cầm giữ được chế độ được yêu cầu. Mang
 * {@link SANDBOX_UNAVAILABLE} qua kênh lỗi có cấu trúc.
 */
export class SandboxUnavailableError extends HarnessError {
  /**
   * Dựng lỗi với thông điệp NGUYÊN VĂN của bản gốc (kèm chi tiết runner khi có).
   * Nhận: mode — chế độ bị cầm giữ được yêu cầu; detail — chi tiết hỏng của runner, nếu có.
   * Trả: không (lỗi đã dựng).
   */
  constructor(mode: ConfinedSandboxMode, detail?: string) {
    super(
      `sandbox mode "${mode}" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.`
        + (detail === void 0 ? "" : ` Runner failure: ${detail}`),
      SANDBOX_UNAVAILABLE,
    );
    this.name = "SandboxUnavailableError";
  }
}

/**
 * Dịch vụ sandbox tiến trình TRỪU TƯỢNG. {@link confine} phải trả argv CÓ cưỡng chế hoặc đóng cửa khi hỏng ở
 * lúc bọc hoặc lúc chạy runner; chuyển tiếp KHÔNG cầm giữ mà im lặng là ĐIỀU CẤM. Phép dò chức năng phân
 * xử chuỗi nhiều runner và có thể bỏ qua khi chỉ có MỘT ứng viên, vì chính sự từ chối của nó là điểm
 * đóng-cửa-khi-hỏng.
 */
export abstract class SandboxProvider extends Service {
  /**
   * Đăng ký provider vào context dưới tên dịch vụ `sandbox`.
   * Nhận: ctx — context host.
   * Trả: không.
   */
  /* v8 ignore next -- dựng dịch vụ trừu tượng đã được phủ qua các gói provider cụ thể. */
  constructor(ctx: ConstructorParameters<typeof Service>[0]) {
    super(ctx, "sandbox");
  }

  /**
   * Bọc `argv` để nó chạy CÓ CẦM GIỮ dưới `policy` trên host này; bên gọi spawn argv trả về THAY CHO argv
   * của mình.
   * Nhận: argv — argv chính xác bên gọi sắp spawn (chương trình + tham số), KHÔNG phải chuỗi shell;
   *        policy — chính sách file-effect theo TỪNG lượt; signal — huỷ khi provider giải chính sách/runner.
   * Trả: argv để spawn thay thế + mức đầy đủ của cầm giữ.
   */
  abstract confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv>;
}

/**
 * Khai báo CỘNG GỘP: seam cung cấp dịch vụ `ctx.sandbox` (NGUYÊN VĂN bản gốc). Giữ ở đây để consumer
 * chuyển sang gói này vẫn có `ctx.sandbox` đúng kiểu; nếu phát hiện xung đột trần với bản gốc thì đây là
 * điểm phải xử lý khi repoint consumer (xem README).
 */
declare module "@deepseek-ai/cordis" {
  interface Context {
    sandbox: SandboxProvider;
  }
}

export default SandboxProvider;
