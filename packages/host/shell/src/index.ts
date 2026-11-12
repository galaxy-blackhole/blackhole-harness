/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cổng 1:1 của @deepseek-ai/dsh-shell (stock lib/index.js 95 dòng + lib/types/*.d.ts, host-only):
 *      seam trừu tượng `ctx.shell` cho lệnh foreground và handle tiến trình nền, cùng hàm tách marker
 *      trạng thái thoát — giữ nguyên toàn bộ bề mặt và hành vi gốc.
 */

/**
 * Service Definition cho seam năng lực `ctx.shell`, bao trùm lệnh foreground và handle tiến trình
 * nền. Id job, quyền sở hữu, thăm dò và thông báo thuộc `@deepseek-ai/dsh-jobs`, giữ cho executor độc
 * lập với phiên.
 * @module @galaxy-blackhole/gbh-shell
 */

import { Service, type Context } from "@deepseek-ai/cordis";
import type { SandboxMode } from "@deepseek-ai/dsh-sandbox";
import type { ShellExecRequest, ShellExecSpec, ShellExecution } from "./types.ts";

/**
 * Tiền tố namespace biến môi trường do harness quản lý — tái xuất NGUYÊN VĂN từ
 * `@deepseek-ai/dsh-subprocess` (cùng ràng buộc, cùng chuỗi `DSH_`). Consumer bash giữ một gốc import.
 */
export { DSH_ENV_PREFIX } from "@deepseek-ai/dsh-subprocess";

/**
 * Tái xuất đúng bộ kiểu mà d.ts gốc phơi qua entry `.`: yêu cầu/đặc tả thực thi, kết quả foreground,
 * vòng đời tiến trình nền, sự thật sandbox, cùng từ vựng output/môi trường của seam subprocess.
 */
export type {
  CollectedOutput,
  DshEnvironment,
  DshEnvironmentKey,
  ShellExecRequest,
  ShellExecSpec,
  ShellExecution,
  ShellExpiryPolicy,
  ShellProcess,
  ShellProcessRead,
  ShellProcessStatus,
  ShellRunResult,
  ShellSandboxInfo,
} from "./types.ts";

/** Kiểu trạng thái thoát đã tách marker, tái xuất từ module render nội bộ. */
export type { ParsedExitStatus } from "./render.ts";

/**
 * Tách marker `[exit code: N]` / `[killed by signal: X]` ở cuối kết quả tool shell đã render, trả
 * thân output không marker kèm trạng thái thoát có cấu trúc. Hành vi chi tiết ở `render.ts`; entry này
 * phơi đúng một hàm như stock.
 */
export { parseExitStatus } from "./render.ts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Executor bash đang đăng ký — mỗi context chỉ một implementation, nạp cái thứ hai sẽ ném. */
    shell: ShellExecutor;
  }
}

/**
 * Service thực thi bash TRỪU TƯỢNG. Hãy kế thừa, cài đặt các phương thức trừu tượng, rồi nạp lớp con
 * như một plugin — nó đăng ký thành `ctx.shell` (mỗi context chỉ một implementation; nạp cái thứ hai
 * sẽ ném, đúng hành vi dịch vụ trùng lặp chuẩn của cordis).
 *
 * {@link execute} resolve với handle tiến trình sau bước chuẩn bị. "Foreground" là thuộc tính của thứ
 * bên gọi CHỜ, không phải của lần spawn — bên gọi chờ {@link ShellExecution.result} đã chạy lệnh ở
 * foreground; bên gọi giữ handle đã chạy nó ở nền. Bên gọi chỉ chờ một lúc thì chạy lệnh dưới
 * `onExpiry: 'none'` và tự giới hạn thời gian chờ; handle vẫn hợp lệ sau khi bên gọi thôi chờ.
 *
 * Các implementation PHẢI tôn trọng những ngữ nghĩa sau:
 * - {@link ShellExecution.result} chỉ reject vì lỗi hạ tầng. Mã thoát khác 0, timeout kill và abort
 *   kill đều resolve với kết quả mô tả được: `timedOut`/`aborted` theo nguyên nhân đầu tiên, kèm
 *   `timeoutMs` của spec được phản chiếu.
 * - Handle được công bố sau bước chuẩn bị. `done` settle lúc tiến trình đóng và không bao giờ reject;
 *   lỗi spawn settle thành `killed` với lỗi trên đường đọc, còn `result()` mang cùng lỗi đó dưới dạng
 *   reject.
 * - `onExpiry: 'none'` không đặt hạn nào; `'kill'` giết lúc hết hạn. Hết hạn trong lúc chuẩn bị trả
 *   một handle timed-out đã settle, không output.
 * - {@link ShellProcess.readOutput} là tăng dần: các lần đọc liên tiếp không bao giờ lặp output. Lần
 *   đọc mất dữ liệu báo truncation và tệp spill có sẵn.
 * - Một tiến trình còn chạy bị dừng và chờ khi composition sở hữu nó dỡ bỏ. Với seam subprocess, ranh
 *   giới đó là disposal của `ctx.subprocess`, nên một tiến trình sống sót qua lần reload chỉ executor.
 */
export abstract class ShellExecutor extends Service {
  /**
   * Đăng ký dịch vụ dưới tên `shell` trong context hiện tại; cordis tự gỡ nó khi fiber sở hữu unload.
   * @param ctx Context cordis nơi executor đăng ký dịch vụ.
   */
  constructor(ctx: Context) {
    super(ctx, "shell");
  }

  /**
   * Chế độ sandbox mà executor này áp mặc định, hoặc `undefined` khi nó không sandbox lệnh.
   * @returns Chế độ sandbox mặc định đã cấu hình, khi được hỗ trợ; seam trừu tượng trả `undefined`.
   */
  get sandboxMode(): SandboxMode | undefined {
    return undefined;
  }

  /**
   * Áp mặc định và trần do implementation sở hữu cho một yêu cầu trước khi thực thi.
   * @param request Yêu cầu của bên gọi; trường vắng mặt nhận mặc định của implementation này, trường có
   *   trần bị kẹp lại.
   * @returns Đặc tả đã đầy đủ để trao cho {@link execute}.
   */
  abstract resolve(request: ShellExecRequest): ShellExecSpec;

  /**
   * Chuẩn bị và spawn lệnh dưới hạn chót đã phân giải.
   * @param spec Đặc tả đã phân giải từ {@link resolve}, không bao giờ là yêu cầu thô.
   * @returns Handle đã chuẩn bị, gồm cả phép chiếu result của nó; hết hạn chuẩn bị trả một handle đã
   *   settle không output.
   * @throws Khi chuẩn bị hỏng hoặc bên gọi huỷ trước lúc tiến trình được công bố.
   */
  abstract execute(spec: ShellExecSpec): Promise<ShellExecution>;
}

export default ShellExecutor;
