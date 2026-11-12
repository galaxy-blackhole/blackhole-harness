/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ai/dsh-subprocess):
 *      dịch vụ trừu tượng ctx.subprocess + hàm khử môi trường cha dùng chung cho mọi spawner
 */
import type { Context } from "@deepseek-ai/cordis";
import { Service } from "@deepseek-ai/cordis";
import { proxyEnvironmentForChild } from "@deepseek-ai/dsh-http-proxy";
import { DSH_ENV_PREFIX } from "./types.ts";
import type {
  SubprocessHandle,
  SubprocessSpawnSpec,
  SubprocessTerminalEnvironment,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from "./types.ts";

export { DSH_ENV_PREFIX };
export type {
  CollectedOutput,
  DshEnvironment,
  DshEnvironmentKey,
  SubprocessCollect,
  SubprocessCollectedOutputs,
  SubprocessHandle,
  SubprocessOutcome,
  SubprocessOutputMode,
  SubprocessOutputRead,
  SubprocessOutputReader,
  SubprocessSpawnSpec,
  SubprocessStdinMode,
  SubprocessStdio,
  SubprocessTerminalActivity,
  SubprocessTerminalEnvironment,
  SubprocessTerminalForeground,
  SubprocessTerminalHandle,
  SubprocessTerminalSignal,
  SubprocessTerminalSpawnSpec,
} from "./types.ts";

/**
 * Tên biến môi trường có HÌNH DẠNG credential thì KHÔNG được chuyển tiếp cho tiến trình con (khoá và bí
 * mật của chính harness — `DEEPSEEK_API_KEY` cùng các secret khác — không được rò vào một tiến trình
 * được spawn một cách ngầm nhiên). MỘT heuristic cho mọi spawner trong repo; một mục do bên gọi CỐ Ý
 * cấp vẫn sống sót, vì các lớp `env` tường minh hợp vào SAU bước khử này.
 */
export const SENSITIVE_ENV_PATTERN: RegExp = /KEY|PASSWORD|SECRET|TOKEN/i;

/**
 * Môi trường cha đang có, TRỪ các tên có hình dạng credential và TRỪ mọi tên `DSH_*` — nền chuẩn mà mọi
 * tiến trình con của harness khởi đầu từ đó. `PATH`, `HOME`, locale và các biến proxy sống sót, nên CLI
 * của con chạy bình thường; danh tính harness không bao giờ rò ngầm nhiên (một credential được chuyển
 * tiếp có chủ ý, hoặc một sự thật `DSH_*` hiện thời, đi qua `env` tường minh của spec, mà lớp đó hợp
 * vào SAU bước khử này). Cả hai bước khử đều so KHÔNG phân biệt hoa thường: tên biến môi trường trên
 * Windows vốn không phân biệt hoa thường, nên một mục `dsh_*` của cha sẽ sống sót và đọc lại thành
 * `$env:DSH_*` trong con; còn tên `dsh_*` viết thường có chủ ý trên POSIX là chuyện khó xảy ra. Hàm được
 * export như một hàm thuần để các spawner không thể đi qua dịch vụ (backend node-pty, vận chuyển do SDK
 * quản lý) dùng CHUNG đúng một định nghĩa khử.
 *
 * Khi có proxy đang hoạt động, kết quả còn mang các tên proxy đã giải và cờ mà một tiến trình Node con cần
 * để tôn trọng chúng, nên con thừa hưởng đúng tuyến mạng như cha nó.
 * Nhận: không (đọc `process.env` hiện thời, không tham số).
 * Trả: một đối tượng môi trường MỚI, an toàn để đưa cho một lượt spawn tiến trình con.
 */
export function scrubbedParentEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !SENSITIVE_ENV_PATTERN.test(key) && !key.toUpperCase().startsWith(DSH_ENV_PREFIX)) {
      env[key] = value;
    }
  }
  for (const [name, value] of Object.entries(proxyEnvironmentForChild())) {
    if (value === undefined) Reflect.deleteProperty(env, name);
    else env[name] = value;
  }
  return env;
}

/**
 * Dịch vụ subprocess TRỪU TƯỢNG. Hãy kế thừa, cài đặt {@link SubprocessRuntime.spawn}, rồi nạp lớp con như
 * một plugin — nó đăng ký thành `ctx.subprocess` (một bản cài cho mỗi context; nạp bản thứ hai sẽ ném,
 * đúng hành vi trùng-dịch-vụ chuẩn của cordis).
 *
 * Bản cài đặt PHẢI tôn trọng các ngữ nghĩa sau:
 * - Đường dẫn executable thuộc MỘT thế giới thực thi, dùng chung với provider filesystem đã mount.
 * - {@link SubprocessRuntime.spawn} trả về handle đang sống NGAY (đồng bộ). Danh tính mục tiêu vẫn là
 *   chuyện riêng của provider; `done` chốt bằng sự thật thoát của lệnh đã spawn và có thể từ chối khi
 *   spawn hoặc provider hỏng.
 * - Bên đọc ở chế độ thu gom dựa trên offset và KHÔNG tiêu thụ, nên các bên đọc độc lập không ăn mất đầu
 *   ra của nhau; lượt đọc mất mát báo cờ cắt và tệp spill giữ toàn bộ luồng khi có. Luồng dạng pipe được
 *   giao THÔ cho bên gọi và không bao giờ đệm ở đây.
 * - {@link SubprocessHandle.terminate} (và tín hiệu huỷ của spec) khởi động thủ tục đã ghi rõ của provider
 *   trên dải nó quản lý. {@link SubprocessHandle.waitForExit} quan sát ĐÚNG dải đó, để thang dọn dẹp do
 *   bên tiêu thụ sở hữu giữ được từng bậc trên sự lặng thật; mỗi provider tự ghi rõ giới hạn tín hiệu và
 *   quan sát của nó.
 * - Việc dọn dịch vụ kết thúc mọi tiến trình được quản lý còn chạy và chờ chúng thoát.
 * - {@link SubprocessRuntime.spawnTerminal} sở hữu việc cấp phát terminal, vận chuyển chữ, nhóm tiền cảnh,
 *   tín hiệu, và sự lặng của TOÀN phiên sau một phương thức kết thúc có chờ; readiness và chính sách shell
 *   bền nằm ở bên tiêu thụ PTY. Luồng đầu ra của nó kết thúc sau khi xả hết đầu ra terminal đã xếp hàng khi
 *   tiến trình mức cao nhất thoát.
 */
export abstract class SubprocessRuntime extends Service {
  /**
   * Đăng ký dịch vụ `subprocess` vào context hiện tại (một bản cài cho mỗi context; bản thứ hai sẽ ném).
   * Nhận: context host đã cấp dịch vụ.
   * Trả: thực thể đã đăng ký — lớp con cài đặt các phương thức trừu tượng bên dưới.
   */
  constructor(ctx: Context) {
    super(ctx, "subprocess");
  }

  /**
   * Tra MỘT executable đã cấu hình trong thế giới thực thi của provider này. Đường dẫn tuyệt đối được
   * kiểm chứng; tên trần dùng `PATH` đã khử của provider cùng các ghi đè môi trường tường minh. Đường
   * dẫn tương đối có dấu phân cách bị TỪ CHỐI: gốc quy chiếu không xác định, nên provider báo lỗi to
   * thay vì đoán.
   * Nhận: `command` — đường dẫn executable tuyệt đối hoặc tên trần trên PATH; `env` — các mục môi trường
   * tường minh dùng cho tra cứu; `signal` — huỷ tra cứu từ xa hoặc cục bộ.
   * Trả: một đường dẫn executable đã chuẩn hoá.
   */
  abstract resolveExecutable(
    command: string,
    env?: Readonly<Record<string, string>>,
    signal?: AbortSignal,
  ): Promise<string>;

  /**
   * Soi các sự thật CHỌN SHELL trong môi trường thực thi của provider.
   * Nhận: `signal` — huỷ việc soi môi trường từ xa.
   * Trả: nền tảng và shell ưu tiên; tra executable và cấp phát vẫn là hai thao tác riêng.
   */
  abstract terminalEnvironment(signal?: AbortSignal): Promise<SubprocessTerminalEnvironment>;

  /**
   * Khởi động MỘT tiến trình con được quản lý từ một spec đã đặc tả đầy đủ; seam này không áp mặc định nào.
   * Nhận: `spec` — argv, thư mục, cách xử lý stdio, ân hạn, huỷ, và môi trường.
   * Trả: handle của tiến trình đang sống (luồng/bên đọc, tín hiệu, promise kết quả).
   * Ném ĐỒNG BỘ khi spec đã bị huỷ trước, hoặc khi argv, cwd, môi trường hay ân hạn không hợp lệ trước lúc
   * tạo handle.
   */
  abstract spawn(spec: SubprocessSpawnSpec): SubprocessHandle;

  /**
   * Cấp phát MỘT terminal thật và khởi động một phiên tiến trình thuộc sở hữu. Đây là primitive tiến trình
   * DUY NHẤT không phải pipe: bản cài đặt sở hữu I/O byte của terminal, nhóm tiền cảnh, tín hiệu, và sự
   * lặng của toàn phiên.
   * Nhận: `spec` — argv, cwd, môi trường, kích thước, ân hạn, và huỷ việc cấp phát, tất cả đã đặc tả đầy đủ.
   * Trả: handle terminal đang sống sau khi cấp phát thành công.
   */
  abstract spawnTerminal(spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle>;
}

/**
 * Lỗi báo việc tra executable đã hoàn tất mà KHÔNG tìm thấy tệp executable nào.
 * Nhận: `message` — chẩn đoán tra cứu đặc thù provider; `options` — lỗi gốc của provider, khi có.
 * Trả: một thể hiện Error mang tên ổn định `SubprocessExecutableNotFoundError`.
 */
export class SubprocessExecutableNotFoundError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SubprocessExecutableNotFoundError";
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Seam tiến trình con của host — một bản cài cho mỗi context. */
    subprocess: SubprocessRuntime;
  }
}

export default SubprocessRuntime;
