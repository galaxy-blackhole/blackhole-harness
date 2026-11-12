/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng HỢP ĐỒNG của bốn seam mà row working-directory dùng (`fs` · `sessionProjections` ·
 *      `systemPrompt` · hộp thư agent) — khai theo CẤU TRÚC, KHÔNG import gói seam nào.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { UserMessage } from "@deepseek-ai/dsh-llm";

/** Trạng thái của chiếu phiên `workingDirectory`: đường dẫn tuyệt đối, hoặc `null` khi chưa ghi nhận. */
export type DirectoryState = string | null;

/** Validator trạng thái đã lưu — đúng phần mà sổ chiếu dùng (`.parse`). */
export interface DirectoryStateSchema {
  /** Kiểm một giá trị đã lưu. Nhận: giá trị thô. Trả: đường dẫn tuyệt đối hoặc `null`; ném khi sai. */
  parse(value: unknown): DirectoryState;
}

/** Một sự kiện nhật ký phiên, ở dạng mà hàm gộp của chiếu cần. */
export interface ProjectionEventLike {
  /** Loại sự kiện (chiếu này chỉ quan tâm `working-directory/change`). */
  readonly type: string;
  /** Dữ liệu sự kiện — sự kiện đổi thư mục mang `cwd` tuyệt đối. */
  readonly data: { readonly cwd?: unknown };
}

/** Siêu dữ liệu bất biến của phiên. */
export interface SessionHeaderLike {
  /** Thư mục gốc của dự án lúc phiên mở; VẮNG khi phiên không có gốc. */
  readonly cwd?: string;
}

/** Định nghĩa một đơn vị chiếu phiên (hình dạng mà seam `sessionProjections` nhận). */
export interface ProjectionDefinition {
  /** Khoá chiếu; bản gốc dùng `workingDirectory`. */
  key: string;
  /** Phiên bản trạng thái lưu; dòng lưu lệch phiên bản bị bỏ và gộp lại từ `init`. */
  stateVersion: number;
  /** Validator cho trạng thái đã lưu. */
  stateSchema: DirectoryStateSchema;
  /** Trạng thái khởi đầu. Nhận: siêu dữ liệu phiên + số sự kiện thừa hưởng. Trả: `cwd` trong header, hoặc `null`. */
  init(header: SessionHeaderLike, inheritedEventCount: number): DirectoryState;
  /** Gộp một sự kiện. Nhận: trạng thái hiện tại + sự kiện. Trả: trạng thái kế tiếp (giữ nguyên tham chiếu khi không đổi). */
  apply(state: DirectoryState, event: ProjectionEventLike): DirectoryState;
  /** Bề mặt client: schema giá trị wire + hàm chiếu trạng thái sang giá trị đó. */
  wire?: {
    /** Validator giá trị wire trước khi rời host. */
    viewSchema: DirectoryStateSchema;
    /** Chiếu trạng thái sang giá trị wire. Nhận: trạng thái. Trả: giá trị cho client. */
    view(state: DirectoryState): DirectoryState;
  };
}

/** Seam sổ chiếu phiên (`ctx.sessionProjections`) — tra theo hình dạng, KHÔNG import gói seam. */
export interface SessionProjectionsSeam {
  /** Đăng ký một đơn vị chiếu. Nhận: định nghĩa. Trả: bộ huỷ do kernel cấp. */
  register(definition: ProjectionDefinition): unknown;
  /** Đọc trạng thái host của một đơn vị. Nhận: phiên + khoá. Trả: trạng thái, hoặc `undefined` khi chưa có. */
  stateOf(session: SessionLike, key: string): DirectoryState | undefined;
}

/** Một mục ngữ cảnh động đóng góp cho system prompt. */
export interface PromptContextLike {
  /** Tên duy nhất của mục. */
  readonly name: string;
  /** Thứ tự ghép (tăng dần). */
  readonly order: number;
  /** Chữ tĩnh hoặc nhà cung cấp chữ, tính lại mỗi lượt lắp prompt. */
  readonly text: string | ((context: AssembleContextLike) => string);
  /** Có nội suy biến `{{…}}` hay không. */
  readonly interpolate?: boolean;
  /** Giữ mục này kể cả khi runtime context tuỳ chọn bị tắt. */
  readonly required?: boolean;
}

/** Ngữ cảnh lắp prompt mà nhà cung cấp chữ nhận. */
export interface AssembleContextLike {
  /** Agent của lượt lắp này; VẮNG ở lượt chẩn đoán. */
  readonly agent?: AgentLike;
  /** Tín hiệu huỷ của lượt đã yêu cầu lắp. */
  readonly signal?: AbortSignal;
}

/** Một mục ngữ cảnh đã giải trong bản lắp prompt. */
export interface AssembledContextLike {
  /** Tên của mục đóng góp. */
  name: string;
  /** Chữ đã giải, CHƯA nội suy biến. */
  text: string;
  /** Có nội suy biến hay không. */
  interpolate?: boolean;
}

/** Bản lắp prompt — phần mà row này chạm tới. */
export interface PromptAssemblyLike {
  /** Các mục ngữ cảnh động, xếp theo thứ tự ghép. */
  contexts: AssembledContextLike[];
}

/** Seam system prompt (`ctx.systemPrompt`) — tra theo hình dạng, KHÔNG import gói seam. */
export interface SystemPromptSeam {
  /** Thứ tự chuẩn của một mục ngữ cảnh theo tên. Nhận: tên mục. Trả: số thứ tự. */
  getContextOrder(name: string): number;
  /** Đăng ký một mục ngữ cảnh. Nhận: mục. Trả: bộ huỷ do kernel cấp. */
  context(context: PromptContextLike): unknown;
}

/** Đích đã giải của seam `fs` — với row này là vật mang KHÔNG trong suốt. */
export interface FsTargetLike {
  /** Khoá đích ổn định do backend cấp; row này chỉ chuyển tiếp, không đọc. */
  readonly targetKey: string;
}

/** Kết quả `stat`: chỉ siêu dữ liệu, không nội dung. */
export interface FsInfoLike {
  /** Loại đích (`directory` cho thư mục). */
  readonly type: string;
}

/** Seam hệ tệp (`ctx.fs`) — đúng ba lời gọi mà row này dùng. */
export interface FsSeam {
  /** Giải một đường dẫn thành đích ổn định. Nhận: đường dẫn + tuỳ chọn (cwd, tín hiệu huỷ). Trả: đích. */
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTargetLike>;
  /** Đọc siêu dữ liệu của đích. Nhận: đích + tín hiệu. Trả: siêu dữ liệu, hoặc `undefined` khi không tồn tại. */
  stat(target: FsTargetLike, signal?: AbortSignal): Promise<FsInfoLike | undefined>;
  /** Đường dẫn tuyệt đối mà tiến trình trong thế giới thi hành mở được. Nhận: đích. Trả: đường dẫn. */
  processPath(target: FsTargetLike): string;
}

/** Phiên — nhật ký bền và siêu dữ liệu bất biến, đúng phần row này chạm tới. */
export interface SessionLike {
  /** Siêu dữ liệu bất biến của phiên (giữ dự án gốc). */
  readonly header: SessionHeaderLike;
  /** Ghi một sự kiện vào nhật ký bền. Nhận: loại sự kiện + dữ liệu. Trả: không. */
  append(type: string, data: unknown): void;
}

/** Vòng đời của agent: nơi row này kiểm fiber còn sống trước khi ghi bền. */
export interface AgentFiberLike {
  /** Ném lỗi khi fiber đã ngừng sống. Nhận: không. Trả: không. */
  assertActive(): void;
}

/** Agent sở hữu phiên — đúng phần row này chạm tới. */
export interface AgentLike {
  /** Phiên mà agent sở hữu. */
  readonly session: SessionLike;
  /** Context của agent, nơi vòng đời fiber được kiểm. */
  readonly ctx: { readonly fiber: AgentFiberLike };
  /** Xếp một thông báo ngữ cảnh vào hộp thư của agent. Nhận: tin người dùng đã nhận diện. Trả: không. */
  inject(message: UserMessage): void;
}

/** Log của kernel — chỉ phần row này dùng. */
export interface LoggerLike {
  /** Ghi cảnh báo. Nhận: thông điệp. Trả: không. */
  warn(message: string): void;
}

/** Một lượt của waterfall `system-prompt/assemble`: nhận bản lắp, ngữ cảnh, hàm gọi tiếp; trả bản lắp đã sửa. */
export type AssemblyStep = (
  assembly: PromptAssemblyLike,
  context: AssembleContextLike,
  next: () => Promise<PromptAssemblyLike>,
) => Promise<PromptAssemblyLike>;

/** Bốn seam + hai hook vòng đời của context mà plugin này dùng, khai trên MỘT hình dạng. */
export interface WorkingDirectorySeams {
  /** Hệ tệp của thế giới thi hành. */
  readonly fs: FsSeam;
  /** Sổ chiếu phiên. */
  readonly sessionProjections: SessionProjectionsSeam;
  /** Sổ mục system prompt. */
  readonly systemPrompt: SystemPromptSeam;
  /** Log của kernel. */
  readonly logger: LoggerLike;
  /** Đăng ký listener waterfall. Nhận: tên sự kiện, listener, tuỳ chọn. Trả: bộ huỷ của kernel. */
  on(event: "system-prompt/assemble", step: AssemblyStep, options?: { prepend?: boolean }): unknown;
  /** Đăng ký một hiệu ứng có hàm dọn. Nhận: hàm dựng hàm dọn. Trả: bộ huỷ của kernel. */
  effect(callback: () => () => Promise<void>): unknown;
}

/**
 * Nhìn context host qua hình dạng seam mà row này dùng.
 * Nhận: context cordis (thật, do kernel cấp).
 * Trả: CHÍNH context đó — không tạo thể hiện mới, không đăng ký gì; chỉ thu hẹp kiểu để khỏi import gói seam.
 */
export function seamsOf(ctx: Context): WorkingDirectorySeams {
  return ctx as unknown as WorkingDirectorySeams;
}
