/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng phía provider cho backend subagent NGOÀI TIẾN TRÌNH: quảng bá KHÔNG năng lực, kiểm trần
 *      thời gian, kiểm thư mục làm việc của con, kết lắng kết quả KHÔNG-BAO-GIỜ-TỪ-CHỐI và công bố tay
 *      nắm chạy chuẩn. Port 1:1 `lib/types/out-of-process.js` (176 dòng mã) + `out-of-process.d.ts`
 *      (92 dòng) của `@deepseek-ai/dsh-subagent`.
 */

/**
 * Từ vựng phía provider cho backend NGOÀI TIẾN TRÌNH — các mảnh ép hợp đồng của chính seam này quanh
 * một con nằm ở tiến trình khác: quảng bá không năng lực, kiểm trần thời gian, kiểm thư mục làm việc
 * của con, kết lắng kết quả không bao giờ từ chối, và việc công bố tay nắm chạy chuẩn. Backend tự ghép
 * các mảnh này với trình điều khiển dây của nó; máy móc tiến trình (spawn, rửa env, dọn dải quản lý)
 * thuộc seam `dsh-subprocess`.
 *
 * @module @galaxy-blackhole/gbh-subagent/out-of-process
 */

import { accessSync, constants, statSync } from "node:fs";
import { isAbsolute } from "node:path";

import type { ContentBlock } from "@deepseek-ai/dsh-llm";

import type { SubagentCapabilities, SubagentResult, SubagentRun, SubagentStopReason } from "./types.ts";

/** Trần kích thước UTF-8 của {@link SubagentResult.diagnostic}. */
const MAX_SUBAGENT_DIAGNOSTIC_BYTES = 4_096;

/** Hậu tố đánh dấu rõ phần chẩn đoán đã bị cắt (nguyên văn bản gốc). */
const DIAGNOSTIC_TRUNCATION_SUFFIX = "\n[diagnostic truncated]";

/** Bộ mã hoá UTF-8 dùng chung cho phép đo và phép cắt. */
const utf8Encoder = new TextEncoder();

/** Bộ giải mã UTF-8 dùng chung cho phép cắt. */
const utf8Decoder = new TextDecoder();

/**
 * Giới hạn chi tiết hỏng do provider soạn mà KHÔNG cắt đôi một chuỗi UTF-8.
 * Nhận: `diagnostic` — văn bản chẩn đoán an toàn do provider sinh.
 * Trả: văn bản gốc, hoặc một giá trị bị cắt thấy được nằm trong trần byte.
 */
function limitSubagentDiagnostic(diagnostic: string): string {
  const bytes = utf8Encoder.encode(diagnostic);
  if (bytes.byteLength <= MAX_SUBAGENT_DIAGNOSTIC_BYTES)
    return diagnostic;
  const suffixBytes = utf8Encoder.encode(DIAGNOSTIC_TRUNCATION_SUFFIX).byteLength;
  let prefixBytes = MAX_SUBAGENT_DIAGNOSTIC_BYTES - suffixBytes;
  // `noUncheckedIndexedAccess` khiến mỗi lượt đọc theo chỉ số mang thêm `undefined`; byte ngoài dải
  // đọc thành 0 nên vòng lặp dừng y hệt bản gốc. Vị trí này luôn nằm TRONG dải (chuỗi đã vượt trần),
  // nên nhánh `undefined` không bao giờ xảy ra lúc chạy.
  while (((bytes[prefixBytes] ?? 0) & 0b1100_0000) === 0b1000_0000) {
    prefixBytes -= 1;
  }
  return utf8Decoder.decode(bytes.subarray(0, prefixBytes))
    + DIAGNOSTIC_TRUNCATION_SUFFIX;
}

/**
 * Ép trần byte lên một chẩn đoán do provider trả về.
 * Nhận: `result` — kết quả chạy đã lắng.
 * Trả: chính kết quả đó khi không có chẩn đoán, ngược lại bản sao có chẩn đoán đã giới hạn.
 */
function normalizeSubagentDiagnostic(result: SubagentResult): SubagentResult {
  return result.diagnostic === undefined
    ? result
    : { ...result, diagnostic: limitSubagentDiagnostic(result.diagnostic) };
}

/**
 * Cho biết `path` có nêu một thư mục TỒN TẠI mà harness VÀO ĐƯỢC hay không. Phép dò quyền tìm kiếm
 * quan trọng: `statSync().isDirectory()` đúng với một thư mục mode-600, nhưng cwd của tiến trình con
 * cần `X_OK`, nếu không spawn hỏng với EACCES.
 * Nhận: `path` — đường dẫn ứng viên.
 * Trả: `true` khi đường dẫn là thư mục vào được, ngược lại `false`.
 */
function isEnterableDirectory(path: string): boolean {
  try {
    if (!statSync(path).isDirectory())
      return false;
    accessSync(path, constants.X_OK);
    return true;
  }
  catch {
    // statSync/accessSync chỉ ném lỗi truy cập hệ tệp ở đây (ENOENT/EACCES/ENOTDIR/…), và mọi lỗi
    // trong số đó đều nghĩa là đường dẫn không thể làm cwd của con.
    return false;
  }
}

/**
 * Quảng bá năng lực của một backend NGOÀI TIẾN TRÌNH: KHÔNG có gì. Một con ở tiến trình khác không thể
 * tôn trọng các tính năng khởi chạy do cha ép (`agentOptions`/`agentPreset`/`outputSchema`/`maxDepth`),
 * nên dịch vụ từ chối yêu cầu cần bất kỳ tính năng nào trong số đó TRƯỚC khi `start` chạy — không bao
 * giờ nhận-rồi-bỏ qua.
 */
export const NO_START_CAPABILITIES: SubagentCapabilities = Object.freeze({
  agentOptions: false,
  agentPreset: false,
  outputSchema: false,
  depthLimit: false,
});

/**
 * Khẳng định một trần thời gian đã cấu hình là số hữu hạn dương (nó chặn một lượt chờ dọn dẹp hoặc
 * tắt máy; số 0, số âm hay NaN sẽ bỏ qua hoặc làm kẹt lượt chờ đó).
 * Nhận: `prefix` — tiền tố chẩn đoán của plugin tiêu thụ (ví dụ `subagent-acp`); `name` — tên trường
 *        cấu hình, dùng cho chẩn đoán; `value` — giá trị đã cấu hình.
 * Trả: không khi giá trị hợp lệ.
 * Ném: {@link Error} khi giá trị không hữu hạn hoặc không dương.
 */
export function assertPositiveFinite(prefix: string, name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${prefix}: ${name} must be a positive finite number`);
  }
}

/**
 * Khẳng định `cwd` thật sự chứa được con: tuyệt đối (nó kiêm luôn danh tính workspace của con, và một
 * đường dẫn tương đối sẽ bị neo lại vào thư mục khởi chạy của tiến trình máy chủ) và là thư mục tồn
 * tại (hỏng tại đây, TRƯỚC ranh giới tiến trình, thay vì thành một spawn ENOENT mơ hồ).
 * Nhận: `prefix` — tiền tố chẩn đoán của plugin tiêu thụ; `label` — nguồn đã cấp giá trị, dùng cho
 *        chẩn đoán; `cwd` — thư mục làm việc ứng viên.
 * Trả: `cwd`, đã kiểm.
 * Ném: {@link Error} khi đường dẫn không tuyệt đối hoặc không phải thư mục vào được.
 */
export function assertUsableCwd(prefix: string, label: string, cwd: string): string {
  if (!isAbsolute(cwd)) {
    throw new Error(`${prefix}: ${label} must be an absolute path: ${cwd}`);
  }
  if (!isEnterableDirectory(cwd)) {
    throw new Error(`${prefix}: ${label} is not an accessible directory: ${cwd}`);
  }
  return cwd;
}

/**
 * Chuẩn hoá một giá trị bị ném chưa biết thành `Error` (ràng buộc catch là `unknown`).
 * Nhận: `value` — giá trị bất kỳ đã bị ném.
 * Trả: chính giá trị đó khi đã là `Error`, ngược lại một `Error` bọc `String(value)`.
 */
function toError(value: unknown): Error {
  // Các bề mặt từ chối (client dây, lỗi spawn) chỉ ném `Error`; nhánh `String(value)` là đường lùi
  // phòng thủ cho một giá trị ném không phải Error mà các bề mặt có kiểu không thể sinh ra.
  /* v8 ignore next */
  return value instanceof Error ? value : new Error(String(value));
}

/** Đầu vào của {@link settleRunResult}. */
export interface RunResultSettlement {
  /** Lượt thử của một lượt (thường đua với huỷ cục bộ); trả kết quả kết thúc. */
  attempt: () => Promise<SubagentResult>;
  /** Ảnh chụp provider phơi ra khi huỷ hoặc hỏng thắng việc kết lắng. */
  collectOutput: () => readonly ContentBlock[];
  /** Ảnh chụp chi tiết an toàn do provider soạn khi hỏng thắng việc kết lắng. */
  collectDiagnostic?: (() => string | undefined) | undefined;
  /** Việc huỷ cục bộ đã kết lắng trước khi quan sát được kết cục của lượt thử hay chưa. */
  cancelled: () => boolean;
  /** Sink chẩn đoán cho một lỗi bị làm phẳng thành lý do dừng; lỗi ném từ nó được chứa lại. */
  onError?: ((error: Error, stopReason: SubagentStopReason) => void) | undefined;
  /** Tín hiệu huỷ của yêu cầu (listener được gỡ lúc kết lắng). */
  signal: AbortSignal;
  /** Listener huỷ đã đăng ký trên {@link signal} lúc khởi chạy. */
  onAbort: () => void;
}

/**
 * Kết lắng kết quả chạy ngoài tiến trình theo hợp đồng của seam: `result` KHÔNG BAO GIỜ từ chối sau khi
 * công bố. Một lượt thử hoàn tất hoặc từ chối bình thường sẽ phân giải thành `aborted` khi việc huỷ
 * đã kết lắng cục bộ; một lần từ chối khác bị làm phẳng thành `stopReason: 'error'` qua sink chẩn
 * đoán đã chứa lỗi. Chẩn đoán do provider trả về dùng chung trần byte. Listener huỷ được gỡ trên MỌI
 * nhánh.
 * Nhận: `parts` — lượt thử, ảnh chụp đầu ra, trạng thái huỷ, sink, và cách nối tín hiệu.
 * Trả: kết quả kết thúc (không bao giờ là một lời từ chối).
 */
export async function settleRunResult(parts: RunResultSettlement): Promise<SubagentResult> {
  try {
    const result = await parts.attempt();
    return parts.cancelled()
      ? { output: parts.collectOutput(), stopReason: "aborted" }
      : normalizeSubagentDiagnostic(result);
  }
  catch (error) {
    // Phủ một lời từ chối đã vào hàng đợi từ trước lúc việc huỷ tới.
    if (parts.cancelled())
      return { output: parts.collectOutput(), stopReason: "aborted" };
    // Làm phẳng lỗi truyền tải sau công bố mà vẫn giữ chẩn đoán.
    try {
      parts.onError?.(toError(error), "error");
    }
    catch {
      // Sink chẩn đoán không được từ chối kết quả chạy.
    }
    const collected = parts.collectDiagnostic?.();
    const diagnostic = collected === undefined
      ? undefined
      : limitSubagentDiagnostic(collected);
    return {
      output: parts.collectOutput(),
      ...diagnostic === undefined ? {} : { diagnostic },
      stopReason: "error",
    };
  }
  finally {
    parts.signal.removeEventListener("abort", parts.onAbort);
  }
}

/** Đầu vào của {@link subprocessRunHandle}. */
export interface SubprocessRunHandleParts {
  /** Id chạy theo phạm vi CHA. */
  id: SubagentRun["id"];
  /** Kết quả đã làm phẳng, không bao giờ từ chối (hợp đồng của seam). */
  result: Promise<SubagentResult>;
  /** Tín hiệu huỷ của yêu cầu (listener được gỡ lúc dispose). */
  signal: AbortSignal;
  /** Listener huỷ đã đăng ký trên {@link signal} lúc khởi chạy. */
  onAbort: () => void;
  /** Kết lắng việc huỷ cục bộ để {@link result} phân giải mà không cần con. */
  requestCancel: () => void;
  /** Dọn tiến trình con tới trạng thái tĩnh lặng (thang dọn do backend sở hữu). */
  teardown: () => Promise<void>;
}

/**
 * Công bố tay nắm chạy của seam cho một con ngoài tiến trình. `dispose()` luỹ đẳng (MỘT lượt dọn được
 * ghi nhớ): nó gỡ listener huỷ, kết lắng việc huỷ cục bộ — không giả định con hợp tác — rồi chờ lượt
 * dọn của backend tới lúc thoát thật.
 * Nhận: `parts` — danh tính lần chạy, kết quả, cách nối huỷ, và lượt dọn.
 * Trả: tay nắm chạy bên ngoài.
 */
export function subprocessRunHandle(parts: SubprocessRunHandleParts): SubagentRun {
  let disposal: Promise<void> | undefined;
  return {
    id: parts.id,
    result: parts.result,
    dispose() {
      if (disposal !== undefined)
        return disposal;
      parts.signal.removeEventListener("abort", parts.onAbort);
      parts.requestCancel();
      disposal = parts.teardown();
      return disposal;
    },
  };
}
