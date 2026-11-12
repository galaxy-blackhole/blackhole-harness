/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của seam subprocess: yêu cầu spawn đầy đủ với chế độ stdio theo từng luồng kiểu Node,
 *      đầu ra thu gom có giới hạn kèm phục hồi bằng spill, luồng thô, và kết thúc theo dải tiến trình được quản lý
 */
import type { Duplex, Readable, Writable } from "node:stream";

/** Tiền tố namespace dành riêng cho các sự thật môi trường con do Galaxy Blackhole quản lý. */
export const DSH_ENV_PREFIX: "DSH_" = "DSH_";

/** Một khoá môi trường nằm trong namespace {@link DSH_ENV_PREFIX} được quản lý. */
export type DshEnvironmentKey = `${typeof DSH_ENV_PREFIX}${string}`;

/** Các biến Galaxy Blackhole đáng tin cho một lượt chạy tiến trình con. */
export type DshEnvironment = Readonly<Record<DshEnvironmentKey, string>>;

/** Một luồng đã bắt: chữ (có thể đã cắt) kèm thông tin phục hồi. */
export interface CollectedOutput {
  /** Chữ đã thu — là ĐUÔI của luồng khi bị cắt. */
  text: string;
  /** True khi đã có byte bị bỏ khỏi `text`. */
  truncated: boolean;
  /** Đường dẫn tới tệp chứa TOÀN BỘ luồng, khi bị cắt và có sẵn. */
  spillPath?: string;
}

/**
 * Cách xử lý stdin. `'ignore'` để fd 0 trên `/dev/null`; `'pipe'` phơi
 * {@link SubprocessHandle.stdin} cho các lượt ghi giao thức tiếp diễn của bên gọi;
 * `{ data }` ghi các byte đó rồi đóng (dạng lô).
 */
export type SubprocessStdinMode = "ignore" | "pipe" | {
  /** Byte (dạng chuỗi) ghi vào stdin rồi đóng. */
  readonly data: string;
};

/**
 * Thu gom có giới hạn trong bộ nhớ cho một luồng đầu ra, kèm tuỳ chọn tệp spill chứa toàn bộ luồng.
 * Bỏ `spill` thì chỉ giữ đuôi trong bộ nhớ — dạng "đuôi chẩn đoán" (stderr của language server);
 * khai nó thì toàn bộ luồng phục hồi được tới hạn của nó (dạng của tool bash).
 */
export interface SubprocessCollect {
  /** Hạn trong bộ nhớ, tính bằng byte; tràn thì giữ ĐUÔI. */
  maxBytes: number;
  /** Tệp spill chứa toàn bộ luồng; không khai thì tắt hẳn việc spill. */
  spill?: {
    /** Hạn byte cho toàn luồng; luồng lớn hơn sẽ bỏ tệp spill đã không còn đầy đủ. */
    maxBytes: number;
  };
}

/**
 * Cách xử lý stdout/stderr. `'pipe'` phơi `Readable` thô cho bên gọi tự giải mã giao thức;
 * `'inherit'` chuyển tiếp descriptor của tiến trình cha (chẩn đoán của con rơi vào luồng của chính harness);
 * một đối tượng {@link SubprocessCollect} đệm có giới hạn và đọc theo offset.
 */
export type SubprocessOutputMode = "pipe" | "inherit" | SubprocessCollect;

/** Cách xử lý stdio theo từng luồng, tất cả đều tường minh — seam này KHÔNG áp giá trị mặc định nào. */
export interface SubprocessStdio {
  /** Cách xử lý stdin. */
  stdin: SubprocessStdinMode;
  /** Cách xử lý stdout. */
  stdout: SubprocessOutputMode;
  /** Cách xử lý stderr. */
  stderr: SubprocessOutputMode;
  /** Yêu cầu thêm một kênh duplex chế độ byte riêng; bỏ trống thì không tạo. */
  control?: "pipe";
}

/**
 * Một yêu cầu spawn đã đặc tả đầy đủ. Seam này không áp mặc định: mọi cách xử lý, hạn mức và thư mục
 * đều tường minh, để cấu hình của bên gọi — chứ không phải một mặc định ẩn của dịch vụ subprocess —
 * quyết định chúng (khuôn mẫu sở hữu là cách tách request/spec của `dsh-shell`).
 */
export interface SubprocessSpawnSpec {
  /** Chương trình và tham số; `argv[0]` là chương trình. KHÔNG bao giờ được diễn giải qua shell ở đây. */
  argv: readonly string[];
  /** Thư mục làm việc của tiến trình con. */
  cwd: string;
  /** Cách xử lý stdio theo từng luồng. */
  stdio: SubprocessStdio;
  /**
   * Thời gian ân hạn dương, hữu hạn, tính bằng mili giây, không lớn hơn `MAX_TIMER_DELAY_MS`, dành cho
   * thủ tục kết thúc của provider và dùng để xả các ống thu gom còn mở sau khi tiến trình thoát (một
   * descriptor thừa kế do tiến trình sống sót giữ không được phép giữ kết quả mở vô hạn). Provider tự
   * ghi rõ việc kết thúc dải là theo bậc hay tức thời.
   */
  graceMs: number;
  /**
   * Tín hiệu huỷ — khởi động thang kết thúc trên dải được quản lý khi nó bắn. Bên gọi sở hữu hạn chót
   * và việc phân loại nguyên nhân; seam này chỉ phản ứng với tín hiệu huỷ.
   */
  signal?: AbortSignal | undefined;
  /**
   * Các mục môi trường tường minh, hợp vào nền đã khử của provider (xem `scrubbedParentEnv`), không
   * kiểm tra namespace. Một chuỗi là bên gọi CỐ Ý chọn, nên một credential được chuyển tiếp hay một
   * sự thật `DSH_*` hiện thời vẫn tới được tiến trình con; `undefined` là bia mộ xoá một mục thường
   * khỏi môi trường của con.
   */
  env?: NodeJS.ProcessEnv | undefined;
}

/**
 * Sự thật thoát của một tiến trình đã đóng — từ vựng của sự kiện `close` trong Node.
 * Cố ý KHÔNG mang phân loại timeout hay huỷ (bên gọi đọc tín hiệu mình sở hữu để phân loại nguyên nhân)
 * và KHÔNG mang đầu ra: các luồng đã thu vẫn đọc được qua {@link SubprocessHandle.collected} sau khi chốt,
 * nên bên gọi dạng lô và dạng luồng dùng chung một đường truy cập.
 */
export interface SubprocessOutcome {
  /** Mã thoát; null khi tiến trình chết vì tín hiệu. */
  exitCode: number | null;
  /** Tín hiệu đã giết (ví dụ 'SIGTERM'); null khi thoát bình thường. */
  signal: NodeJS.Signals | null;
}

/** Một lượt đọc tăng dần của {@link SubprocessOutputReader.readFrom}. */
export interface SubprocessOutputRead {
  /** Chữ của luồng tính từ offset đã yêu cầu (là toàn bộ đuôi còn giữ khi lần đọc bị mất mát). */
  text: string;
  /** Offset toàn luồng để đọc tiếp ở lượt sau. */
  nextOffset: number;
  /** True khi offset đã yêu cầu trượt khỏi cửa sổ đuôi trong bộ nhớ. */
  lossy: boolean;
  /** Đường dẫn tệp spill toàn luồng, khi đã tạo và còn nguyên vẹn. */
  spillPath?: string;
}

/**
 * Truy cập tăng dần KHÔNG con trỏ vào một luồng đầu ra đã thu. Offset là toạ độ byte trên toàn luồng,
 * do bên gọi sở hữu, nên các bên đọc độc lập không tiêu thụ mất đầu ra của nhau; `readFrom(0)` sau khi
 * chốt chính là kết quả dạng lô (khi đó `lossy` nghĩa là đuôi trong bộ nhớ đã mất phần đầu — sự thật
 * {@link CollectedOutput.truncated}).
 */
export interface SubprocessOutputReader {
  /**
   * Đọc mọi thứ đã bắt được kể từ `fromByte`. Khi offset đó đã trượt khỏi cửa sổ đuôi trong bộ nhớ thì
   * lượt đọc là `lossy` — nó trả toàn bộ đuôi còn giữ, và khoảng trống chỉ phục hồi được từ tệp spill.
   * Nhận: offset toàn luồng để đọc tiếp (là `nextOffset` của lượt trước; 0 cho lượt đầu).
   * Trả: chữ tăng thêm, offset kế tiếp, cờ `lossy`, và đường dẫn spill khi có.
   */
  readFrom(fromByte: number): SubprocessOutputRead;
}

/** Các bên đọc theo offset cho những luồng được spawn ở chế độ thu gom. */
export interface SubprocessCollectedOutputs {
  /** Có mặt khi và chỉ khi stdout là một {@link SubprocessCollect}. */
  readonly stdout?: SubprocessOutputReader;
  /** Có mặt khi và chỉ khi stderr là một {@link SubprocessCollect}. */
  readonly stderr?: SubprocessOutputReader;
}

/**
 * Một tiến trình con đang sống và dải tiến trình do provider quản lý. Đầu ra đã thu vẫn đọc được sau khi
 * thoát; các luồng dạng pipe thuộc về bên gọi.
 *
 * Việc kết thúc và {@link SubprocessHandle.waitForExit} dùng CÙNG dải được quản lý. Mỗi provider tự ghi rõ
 * dải nó quan sát được cùng các giới hạn tín hiệu và quan sát của nó.
 */
export interface SubprocessHandle {
  /** stdin của con, có mặt khi và chỉ khi spawn với `stdin: 'pipe'`. */
  readonly stdin: Writable | undefined;
  /** stdout thô của con, có mặt khi và chỉ khi spawn với `stdout: 'pipe'`. */
  readonly stdout: Readable | undefined;
  /** stderr thô của con, có mặt khi và chỉ khi spawn với `stderr: 'pipe'`. */
  readonly stderr: Readable | undefined;
  /** Kênh byte riêng thuộc bên gọi khi được yêu cầu; lỗi khởi động gốc có thể để nó vắng mặt. */
  readonly control: Duplex | undefined;
  /** Các bên đọc theo offset cho luồng ở chế độ thu gom (vẫn đọc được sau khi thoát). */
  readonly collected: SubprocessCollectedOutputs;
  /** Chốt bằng sự thật thoát của lệnh đã spawn; từ chối khi spawn hoặc provider hỏng. */
  readonly done: Promise<SubprocessOutcome>;
  /**
   * Bắt đầu thủ tục kết thúc đã ghi rõ của provider trên dải được quản lý — động từ kết thúc DUY NHẤT của
   * seam. Idempotent, là no-op khi dải đó đã hết, và cũng được kích hoạt bởi tín hiệu huỷ của spec.
   */
  terminate(): void;
  /**
   * Chờ tới khi CÙNG dải được quản lý rỗng — không chỉ tới khi lệnh đã spawn báo kết quả, để công việc
   * sống sót còn quan sát được.
   * Nhận: tín hiệu chặn trên tuỳ chọn cho lượt chờ.
   * Trả: `true` khi dải được quản lý rỗng, `false` khi tín hiệu huỷ trước.
   * Ném khi provider đã chọn không còn quan sát được dải của nó.
   */
  waitForExit(signal?: AbortSignal): Promise<boolean>;
}

/**
 * Các tín hiệu được primitive tiến trình-terminal hỗ trợ. Giữ ĐÚNG từng thành viên với `TerminalSignal`
 * trong `@deepseek-ai/dsh-terminal` mà không tạo phụ thuộc chéo seam; đổi thì đổi cả hai nơi.
 */
export type SubprocessTerminalSignal = "SIGINT" | "SIGTERM" | "SIGKILL" | "SIGTSTP" | "SIGHUP";

/** Sự thật chọn shell từ môi trường thực thi của provider subprocess. */
export interface SubprocessTerminalEnvironment {
  /** Họ hệ điều hành diễn giải đường dẫn executable và tham số shell. */
  platform: "posix" | "windows";
  /** Shell đăng nhập hoặc do môi trường chọn, khi provider tra được. */
  defaultShell?: string;
}

/** Một yêu cầu spawn tiến trình-terminal đã đặc tả đầy đủ. */
export interface SubprocessTerminalSpawnSpec {
  /** Chương trình và tham số; `argv[0]` là chương trình. */
  argv: readonly string[];
  /** Thư mục làm việc trong thế giới thực thi của provider subprocess này. */
  cwd: string;
  /** Môi trường tường minh, xếp lớp SAU bước khử môi trường xung quanh của provider. */
  env?: Record<string, string> | undefined;
  /** Số hàng ban đầu của terminal. */
  rows: number;
  /** Số cột ban đầu của terminal. */
  cols: number;
  /** Kiểu terminal emulation quảng bá cho con qua TERM. */
  terminalType: string;
  /** Yêu cầu quan sát vòng đời shell tương tác được hỗ trợ; lượt chạy không hỗ trợ báo hoạt động 'unknown'. */
  shellActivity?: boolean | undefined;
  /** Ân hạn dọn dẹp TERM-tới-KILL cho toàn bộ phiên terminal. */
  graceMs: number;
  /** Huỷ việc cấp phát terminal; handle đã công bố sở hữu vòng đời về sau của nó. */
  signal?: AbortSignal | undefined;
}

/** Sự thật nhóm tiến trình tiền cảnh hiện thời của một terminal. */
export interface SubprocessTerminalForeground {
  /** Id nhóm tiến trình tiền cảnh do trình điều khiển terminal công bố. */
  processGroupId: number;
  /** Provider có chứng minh được ngay lúc này rằng nhóm đó đang chờ nhập từ terminal hay không. */
  inputWaiting: boolean;
}

/** Quan sát của provider về vòng đời shell và các job còn sống sót thuộc sở hữu. */
export interface SubprocessTerminalActivity {
  /** 'idle' đòi hỏi bằng chứng prompt DƯƠNG và không quan sát thấy job tiền cảnh, nền hay dừng nào. */
  state: "idle" | "busy" | "unknown";
  /** Đổi theo nhập liệu, chuyển trạng thái shell và quan sát tiến trình đã đổi; phạm vi là handle này. */
  revision: number;
}

/**
 * Một tiến trình terminal đang sống và phiên hệ điều hành thuộc sở hữu của nó. Việc cấp phát terminal, soi
 * và gửi tín hiệu cho nhóm tiền cảnh, và sự lặng hẳn của toàn phiên là MỘT primitive subprocess sâu, vì
 * không thứ nào trong đó dựng lại được từ stdio dạng pipe thông thường mà không cần điều khiển tiến trình
 * đặc thù nền tảng.
 */
export interface SubprocessTerminalHandle {
  /** Id tiến trình terminal mức cao nhất. */
  readonly pid: number;
  /** Byte đầu ra UTF-8 của terminal theo đúng thứ tự giao; kết thúc sau khi xả hết đầu ra đã xếp hàng khi terminal thoát. */
  readonly output: Readable;
  /** Chốt khi tiến trình mức cao nhất thoát; từ chối khi khởi động terminal, provider hoặc vận chuyển sống hỏng. */
  readonly done: Promise<SubprocessOutcome>;
  /**
   * Ghi chữ vào đầu vào của terminal.
   * Nhận: chữ cần giao, không tự động chuyển thành xuống dòng.
   * Trả: promise chốt khi đã giao xong.
   */
  write(data: string): Promise<void>;
  /**
   * Đổi kích thước terminal và báo cho ứng dụng tiền cảnh.
   * Nhận: số cột dương và số hàng dương.
   * Trả: promise chốt khi terminal đã nhận kích thước mới.
   */
  resize(cols: number, rows: number): Promise<void>;
  /**
   * Soi nhóm tiến trình tiền cảnh hiện thời.
   * Trả: id nhóm và sự thật chờ-nhập, hoặc undefined khi không tra được nhóm tiền cảnh nào.
   */
  inspectForeground(): Promise<SubprocessTerminalForeground | undefined>;
  /**
   * Quan sát hoạt động lệnh mà không diễn giải đầu ra và không coi im lặng là hoàn tất.
   * Trả: một quan sát mới; shell không hỗ trợ và quan sát chưa đầy đủ báo 'unknown'.
   */
  inspectActivity(): Promise<SubprocessTerminalActivity>;
  /**
   * Giao một tín hiệu cho nhóm tiến trình tiền cảnh hiện thời.
   * Nhận: tín hiệu terminal được phép.
   * Trả: id chính xác của nhóm đã nhận tín hiệu.
   */
  signalForeground(signal: SubprocessTerminalSignal): Promise<number>;
  /**
   * Kết thúc idempotent mọi thành viên phiên terminal mà provider còn quan sát được, rồi chờ lặng hẳn.
   * Sau khi chốt, không lượt ghi, soi hay gửi tín hiệu nào còn đang bay. Provider tự ghi rõ giới hạn quan
   * sát đặc thù nền tảng.
   * Trả: promise chốt khi toàn phiên đã lặng.
   */
  terminate(): Promise<void>;
}
