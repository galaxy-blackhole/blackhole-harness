/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu thực thi của seam bash executor (ctx.shell): yêu cầu/đặc tả đã phân giải, kết quả
 *      foreground, handle tiến trình nền và sự thật sandbox — port 1:1 lib/types/types.d.ts của
 *      @deepseek-ai/dsh-shell; từ vựng DSH_* và output thu được tái xuất từ dsh-subprocess.
 */

/**
 * Kiểu thực thi cho seam bash executor. Ngữ nghĩa job nền thuộc `@deepseek-ai/dsh-jobs`; seam này
 * chỉ phơi handle tiến trình. Từ vựng môi trường được quản lý và output thu được do seam subprocess
 * sở hữu, tái xuất ở đây để consumer bash chỉ cần một gốc import.
 * @module @galaxy-blackhole/gbh-shell/types
 */

import type { SandboxEnforcement, SandboxExecutionPolicy, SandboxMode } from "@deepseek-ai/dsh-sandbox";
import type { CollectedOutput, DshEnvironment, SubprocessOutputReader } from "@deepseek-ai/dsh-subprocess";

/**
 * Tái xuất NGUYÊN VĂN từ vựng output/môi trường của seam subprocess: consumer bash không phải import
 * thêm `@deepseek-ai/dsh-subprocess` chỉ để mô tả stdout/stderr hay snapshot `DSH_*`.
 */
export type {
  CollectedOutput,
  DshEnvironment,
  DshEnvironmentKey,
  SubprocessOutputRead,
  SubprocessOutputReader,
} from "@deepseek-ai/dsh-subprocess";

/**
 * Các reader theo offset, KHÔNG tiêu thụ, trên hai luồng đã thu của một tiến trình nền — dành cho
 * quan sát viên độc lập với con trỏ tiêu thụ của {@link ShellProcess.readOutput}. Mọi tiến trình nền
 * đều phơi cả hai luồng; một lần spawn bị từ chối không tạo output tiến trình, nên reader stderr của
 * nó phục vụ ghi chú `spawn failed: …` như toàn bộ luồng.
 */
export interface ShellObservedStreams {
  /** Reader theo offset trên stdout đã thu. */
  stdout: SubprocessOutputReader;
  /** Reader theo offset trên stderr đã thu (ghi chú spawn-failure sau một lần spawn bị từ chối). */
  stderr: SubprocessOutputReader;
}

/**
 * Sự thật sandbox cho một lần chạy, chỉ hiện diện khi một executor có sandbox xử lý lần chạy đó.
 * Sự thật được báo độc lập với trạng thái thoát của tiến trình để bên gọi phân biệt được lỗi lệnh với
 * từ chối chính sách và lỗi runner.
 */
export interface ShellSandboxInfo {
  /** Chế độ mà lệnh thực sự chạy dưới đó. */
  mode: SandboxMode;
  /** Sandbox có từ chối một thao tác tệp hay không. */
  denied: boolean;
  /** Runner đã cưỡng chế chế độ được yêu cầu đầy đủ tới mức nào. */
  enforcement?: SandboxEnforcement;
  /** Runner sandbox có hỏng trước khi lệnh kịp chạy hay không. */
  runnerFailed?: boolean;
}

/**
 * Executor làm gì khi hết hạn: `kill` dừng lệnh và phân loại kết quả `timedOut` (mặc định), còn
 * `none` không đặt hạn nào cả, để tín hiệu của bên gọi và {@link ShellProcess.kill} là những cách
 * duy nhất dừng lệnh. Consumer muốn chờ thêm một lúc nhưng có giới hạn thì chạy lệnh dưới `none` và
 * tự giới hạn thời gian chờ của mình.
 */
export type ShellExpiryPolicy = "kill" | "none";

/**
 * YÊU CẦU thực thi của bên gọi: `workdir` và `timeoutMs` là tuỳ chọn và được
 * {@link ShellExecutor.resolve} điền từ cấu hình của implementation. Đây là hình dạng hướng tới
 * model/plugin; truyền nó cho `resolve()` để nhận {@link ShellExecSpec} đã phân giải đầy đủ.
 */
export interface ShellExecRequest {
  /** Câu lệnh cần chạy, đúng như bên gọi muốn. */
  command: string;
  /** Ghi đè thư mục làm việc (mặc định: do implementation cấu hình). */
  workdir?: string | undefined;
  /** Ghi đè thời gian chờ tính bằng mili giây (implementation đặt trần). */
  timeoutMs?: number | undefined;
  /** Chính sách hạn chót khi `timeoutMs` hết (mặc định `'kill'`). */
  onExpiry?: ShellExpiryPolicy | undefined;
  /**
   * Ngân sách thu stdout cho lần chạy foreground, tính bằng byte. Vắng mặt thì dùng trần output mặc
   * định của executor. Consumer tin cậy trong cùng tiến trình dùng trường này khi cần phân tích toàn
   * bộ stdout tới giới hạn có kiểm soát của chính họ; tool bash hướng tới model không phơi nó thành
   * tham số.
   */
  stdoutMaxBytes?: number | undefined;
  /**
   * Tín hiệu huỷ — implementation giết lệnh khi nó phát, và coi tín hiệu đã bị huỷ từ trước là đã phát.
   */
  signal?: AbortSignal | undefined;
  /**
   * Byte cần ghi vào stdin của lệnh, rồi đóng stdin. Vắng mặt thì stdin đóng/rỗng (mặc định cho lời
   * gọi tool do model điều khiển). Các plugin trong cùng tiến trình (ví dụ cầu nối hooks, vốn ghi
   * payload JSON của lệnh hook vào stdin) đặt trường này; tool bash hướng tới model không phơi nó
   * thành tham số (model cần stdin thì dùng cú pháp shell như heredoc hoặc pipe).
   */
  stdin?: string | undefined;
  /**
   * Các mục môi trường thường cho lệnh, được gộp SAU bước khử credential. Sự thật do harness quản lý
   * thuộc về {@link dshEnv}, vốn gộp sau map này, nên một mục ở đây không bao giờ đẩy được một mục
   * được quản lý đi. Các plugin trong cùng tiến trình (cầu nối hooks đặt `CLAUDE_PROJECT_DIR`,
   * `CLAUDE_PLUGIN_ROOT`, …) đặt trường này; tool bash hướng tới model không phơi nó thành tham số.
   */
  env?: Record<string, string> | undefined;
  /**
   * Các biến `DSH_*` do harness sở hữu cho lần thực thi này (đã gõ kiểu theo khoá được quản lý).
   * Executor loại bỏ các mục `DSH_*` từ môi trường xung quanh trước khi gộp snapshot này CUỐI CÙNG,
   * nên một sự thật hiện thời không sẵn có không thể thừa hưởng giá trị cũ từ tiến trình harness và
   * một mục {@link env} của bên gọi cũng không thể đẩy mục được quản lý đi.
   */
  dshEnv?: DshEnvironment | undefined;
  /** Chính sách sandbox đã phân giải đầy đủ cho từng lời gọi; executor có sandbox đặt mặc định. */
  sandboxPolicy?: SandboxExecutionPolicy | undefined;
}

/**
 * Đặc tả thực thi đã phân giải. {@link ShellExecutor.resolve} điền và đặt trần cho các trường bắt
 * buộc; dưới `onExpiry: 'none'` thì `timeoutMs` đã phân giải KHÔNG đặt hẹn giờ và chỉ được phản chiếu
 * vào {@link ShellRunResult.timeoutMs}.
 */
export interface ShellExecSpec {
  /** Câu lệnh đã phân giải; `resolve` không đổi nội dung câu lệnh. */
  command: string;
  /** Thư mục làm việc hiệu lực (đã áp mặc định của implementation). */
  workdir: string;
  /** Thời gian chờ hiệu lực, đã áp mặc định/trần. */
  timeoutMs: number;
  /** Chính sách hạn chót khi `timeoutMs` hết ({@link ShellExecutor.resolve} mặc định `'kill'`). */
  onExpiry: ShellExpiryPolicy;
  /**
   * Ngân sách thu stdout đã phân giải, tính bằng byte, áp cho mọi lần thực thi; stderr giữ trần output
   * của chính executor.
   */
  stdoutMaxBytes: number;
  /**
   * Tín hiệu huỷ — implementation giết lệnh khi nó phát, và coi tín hiệu đã bị huỷ từ trước là đã phát.
   */
  signal?: AbortSignal | undefined;
  /** Byte cần ghi vào stdin trước khi đóng nó; vắng mặt nghĩa là không có stdin. */
  stdin?: string | undefined;
  /**
   * Các mục môi trường thường được mang qua từ {@link ShellExecRequest.env}; {@link dshEnv} vẫn gộp
   * sau chúng. TUỲ CHỌN trên spec vì cùng lý do như `stdin`: vắng mặt nghĩa là không có môi trường
   * thường bổ sung.
   */
  env?: Record<string, string> | undefined;
  /** Snapshot `DSH_*` được quản lý (đã gõ kiểu theo khoá được quản lý); gộp sau {@link env}. */
  dshEnv?: DshEnvironment | undefined;
  /** Chính sách sandbox đã phân giải; bị bỏ qua bởi executor không cưỡng chế. */
  sandboxPolicy: SandboxExecutionPolicy | undefined;
}

/** Kết cục của một lần chạy foreground, bao gồm cả hết hạn trong lúc chuẩn bị. */
export interface ShellRunResult {
  /** Mã thoát; `null` khi bước chuẩn bị hết hạn hoặc tiến trình chết vì tín hiệu. */
  exitCode: number | null;
  /** Tín hiệu kết liễu, hoặc `null` khi không có tín hiệu nào được báo, kể cả hết hạn chuẩn bị. */
  signal: NodeJS.Signals | null;
  /**
   * `true` khi hạn chót của chính executor là nguyên nhân ĐẦU TIÊN cắt lệnh ngắn. Loại trừ lẫn nhau
   * với {@link aborted}: một hạn chót hợp nhất điều khiển cả timeout lẫn huỷ của bên gọi, nên một
   * timeout và một abort chạy đua trước khi tiến trình đóng sẽ báo nguyên nhân hủy ĐẦU TIÊN duy nhất,
   * không báo cả hai.
   */
  timedOut: boolean;
  /**
   * `true` khi `AbortSignal` của bên gọi là nguyên nhân ĐẦU TIÊN giết lệnh (và đó không phải hạn chót
   * của chính executor). Loại trừ lẫn nhau với {@link timedOut} — xem ở đó về phân loại nguyên nhân
   * đầu tiên.
   */
  aborted: boolean;
  /** Thời gian chờ hiệu lực đã áp cho lần chạy này (sau khi đặt mặc định/trần). */
  timeoutMs: number;
  /** Stdout đã thu (có thể bị cắt, kèm đường dẫn spill khi có). */
  stdout: CollectedOutput;
  /** Stderr đã thu (có thể bị cắt, kèm đường dẫn spill khi có). */
  stderr: CollectedOutput;
  /** Sự thật thực thi sandbox, vắng mặt với executor không sandbox. */
  sandbox?: ShellSandboxInfo;
}

/** Vòng đời của một tiến trình nền. */
export type ShellProcessStatus = "running" | "completed" | "killed";

/** Một lần đọc TĂNG DẦN của {@link ShellProcess.readOutput}. */
export interface ShellProcessRead {
  /** Output phát sinh kể từ lần đọc trước (stderr nằm trong một đoạn có đánh dấu). */
  delta: string;
  /** `true` khi việc cắt bỏ đã làm mất byte chưa đọc mà delta không thể chứa. */
  lossy: boolean;
  /** Tệp spill đầy đủ của stdout, khi stdout bị cắt và có đường dẫn an toàn. */
  stdoutSpillPath?: string;
  /** Tệp spill đầy đủ của stderr, khi stderr bị cắt và có đường dẫn an toàn. */
  stderrSpillPath?: string;
}

/**
 * Handle tiến trình nền do {@link ShellExecutor.execute} trả về. Đây là đường truy cập DUY NHẤT;
 * output đã đệm vẫn đọc được sau khi tiến trình thoát. Việc dỡ bỏ composition (disposal của dịch vụ
 * subprocess) giết các tiến trình đang chạy và chờ {@link done}; một lần reload CHỈ executor thì để
 * chúng tiếp tục chạy.
 */
export interface ShellProcess {
  /** Trạng thái vòng đời (chốt đúng một lần). */
  status: ShellProcessStatus;
  /** Mã thoát khi đã xong (`null` = bị tín hiệu giết / vẫn đang chạy). */
  exitCode: number | null;
  /** Tên tín hiệu kết liễu, khi bị giết bởi tín hiệu. */
  signal: NodeJS.Signals | null;
  /**
   * Settle khi tiến trình bên dưới chốt (KHÔNG BAO GIỜ reject — provider từ chối settle thành
   * `killed` với một lỗi trung lập theo tầng trên stderr).
   */
  readonly done: Promise<void>;
  /** Sự thật sandbox, được đóng dấu một khi tiến trình bị cưỡng chế chốt. */
  sandbox?: ShellSandboxInfo;
  /**
   * Đọc output phát sinh kể từ lần đọc trước (TIÊU THỤ — các lần đọc liên tiếp không bao giờ giao lại).
   * Lần đọc bị mất dữ liệu đặt cờ `lossy` và chỉ tới tệp spill của toàn luồng khi có.
   */
  readOutput(): ShellProcessRead;
  /**
   * Các reader theo offset, KHÔNG tiêu thụ, trên cùng hai luồng đã thu mà con trỏ tiêu thụ
   * {@link readOutput} rút ra, kể cả ghi chú lỗi provider mà một lần spawn bị từ chối để lại trên
   * stderr. Quan sát viên độc lập đọc ở đây theo offset của riêng họ mà không lấy byte của
   * `readOutput`.
   */
  observed: ShellObservedStreams;
  /**
   * Kết thúc khoảng do provider quản lý. Trả `false` khi nó đã xong từ trước (no-op); idempotent.
   */
  kill(): boolean;
}

/**
 * Handle thực thi DUY NHẤT mà {@link ShellExecutor.execute} trả về: chính {@link ShellProcess} đang
 * sống cộng phép chiếu foreground `result()`.
 */
export interface ShellExecution extends ShellProcess {
  /**
   * Phép chiếu foreground: settle khi tiến trình đóng, với hai luồng đã thu được tách ra và phân loại
   * `timedOut`/`aborted` theo nguyên nhân đầu tiên. CHỈ reject vì lỗi hạ tầng (một lần spawn không
   * bao giờ tạo được tiến trình); mã thoát khác 0, timeout kill và abort kill đều resolve với một kết
   * quả mô tả được. Được tạo theo yêu cầu và memoized — bên gọi không bao giờ gọi nó (nhà sản xuất nền)
   * cũng không bao giờ thấy lần reject; đường `done`/read của handle mang câu chuyện spawn-failure cho
   * họ.
   * @returns Kết quả foreground đã settle cho lần thực thi này.
   */
  result(): Promise<ShellRunResult>;
}
