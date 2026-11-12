/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của miền "tiêu đề phiên" — vật thể của phép gộp, hợp đồng provider, và các seam mà
 *      row này chạm, khai theo CẤU TRÚC (không import gói seam nào): `sessions` + `session/event` +
 *      `session/disposed` do @deepseek-ai/dsh-session cấp, `sessionProjections` do
 *      @deepseek-ai/dsh-session-projection cấp, `llm/stream` do tầng LLM cấp. Nguồn gốc:
 *      lib/types/index.d.ts + lib/types/types.d.ts (bản gốc 0.2.1-alpha.4).
 */

import type { SessionSeq, SessionTitleProviderId } from "./brand.ts";

/** Một khối nội dung của tin — khai theo CẤU TRÚC: chỉ khối `text` mang văn bản. */
export interface ContentBlock {
  /** Loại khối; mọi loại khác `text` bị bỏ qua khi trích tiêu đề. */
  readonly type: string;
  /** Văn bản của khối — chỉ đọc SAU khi đã xác nhận `type === "text"`. */
  readonly text: string;
}

/** Một sự kiện phiên đã cam kết, khai theo CẤU TRÚC: chỉ phần miền tiêu đề đọc. */
export interface SessionEvent {
  /** Loại sự kiện (`user/message` · `request/header` · `session/title` · …). */
  readonly type: string;
  /** Vị trí của sự kiện trong log phiên. */
  readonly seq: SessionSeq;
  /** Thời điểm sự kiện — nguồn của `updatedAt` trong ảnh chụp tiêu đề. */
  readonly time: number;
  /** Dữ liệu sự kiện; từng nhánh `switch` tự khai hình dạng nó đọc. */
  readonly data: unknown;
}

/** Dữ liệu của `user/message`: nguồn phát và các khối nội dung. */
export interface UserMessageData {
  /** Nguồn phát tin; chỉ `kind === "user"` là prompt người dùng. */
  readonly source: {
    /** Loại nguồn (`user` · `agent` · …). */
    readonly kind: string;
  };
  /** Các khối nội dung của tin. */
  readonly content: readonly ContentBlock[];
}

/** Tuyến mô hình chính xác đã sinh ra một tiêu đề. */
export interface SessionTitleModelIdentity {
  /** Tuyến provider LLM đã đăng ký. */
  readonly provider: string;
  /** Id mô hình của provider. */
  readonly model: string;
}

/** Bản ghi sở hữu BỀN của một tiêu đề đã được nhận. */
export type SessionTitleSource =
  | {
      /** Tiêu đề do phép dự phòng tất định của dịch vụ sinh. */
      readonly kind: "fallback";
    }
  | {
      /** Tiêu đề do một provider đã đăng ký sinh. */
      readonly kind: "provider";
      /** Provider đã sinh tiêu đề. */
      readonly provider: SessionTitleProviderId;
      /** Tuyến mô hình phụ, khi việc sinh dùng mô hình. */
      readonly model?: SessionTitleModelIdentity;
    }
  | {
      /** Người dùng đổi tên tường minh: GHIM tiêu đề — sinh tự động ngừng lên lịch. */
      readonly kind: "user";
    };

/** Dữ liệu của sự kiện chỉ-ghi-log `session/title`. */
export interface SessionTitleEventData {
  /** Văn bản tiêu đề đã chuẩn hoá, không rỗng. */
  readonly title: string;
  /** Seq `user/message` người-dùng CHÍNH XÁC đã dùng để suy tiêu đề; RỖNG khi người dùng đổi tên. */
  readonly messageSeqs: SessionSeq[];
  /** Nguồn: phép dự phòng có sẵn, provider đã đăng ký, hay người dùng. */
  readonly source: SessionTitleSource;
}

/** Tiêu đề đã gộp mới nhất cộng các dữ kiện phong bì bền của sự kiện tiêu đề. */
export interface SessionTitleSnapshot extends SessionTitleEventData {
  /** Seq của sự kiện `session/title` mới nhất. */
  readonly eventSeq: SessionSeq;
  /** Thời điểm của sự kiện `session/title` mới nhất. */
  readonly updatedAt: number;
}

/** Giá trị đơn vị chiếu `title` phía host. */
export type TitleProjection = SessionTitleSnapshot;

/** MỘT tin văn bản người dùng hợp lệ được phơi cho provider tiêu đề. */
export interface SessionTitleUserMessage {
  /** Seq của sự kiện `user/message` nguồn. */
  readonly seq: SessionSeq;
  /** Nội dung các khối văn bản đã nối CHÍNH XÁC. */
  readonly text: string;
}

/** Đầu vào tiêu đề hợp lệ được giữ dưới dạng tổng hợp CÓ BIÊN. */
export interface TitleInputState {
  /** Tin hợp lệ CŨ NHẤT, hoặc null trước khi có tin nào. */
  readonly first: SessionTitleUserMessage | null;
  /** Tổng số tin hợp lệ đã gộp tới nay. */
  readonly count: number;
  /** Seq của tin hợp lệ MỚI NHẤT, hoặc null trước khi có tin nào. */
  readonly lastSeq: SessionSeq | null;
}

/** Cấu hình bắt buộc: giới hạn của phép dự phòng và của mọi tiêu đề được nhận. */
export interface Config {
  /** Số từ tối đa (tách theo khoảng trắng) trong phép dự phòng có sẵn. */
  readonly fallbackMaxWords: number;
  /** Số byte UTF-8 tối đa trong phép dự phòng có sẵn. */
  readonly fallbackMaxBytes: number;
  /** Số byte UTF-8 tối đa trong MỌI tiêu đề được nhận. */
  readonly maxTitleBytes: number;
}

/** Nhịp sinh tự động do một provider đã đăng ký sở hữu. */
export type SessionTitleAutomaticMode = "first-prompt" | "all-prompts";

/** Đầu vào BẤT BIẾN cấp cho MỘT lời gọi provider tiêu đề. */
export interface SessionTitleProviderRequest {
  /** Phiên đang sống đang được đặt tiêu đề. */
  readonly session: Session;
  /** MỌI tin người dùng hợp lệ tính tới phiên bản sinh này. */
  readonly messages: readonly SessionTitleUserMessage[];
  /** Tuyến yêu cầu chính đã ghi trong log, khi đã có. */
  readonly route?: SessionTitleModelIdentity;
  /**
   * Tiêu đề đã được nhận mới nhất, chụp LÚC GỌI — kể cả tiêu đề dự phòng đã nhận mà sự kiện của nó
   * có thể nằm SAU tin hợp lệ cuối. Vắng mặt trước khi có tiêu đề nào. Provider tự quyết dùng hay không.
   */
  readonly currentTitle?: SessionTitleSnapshot;
  /** Huỷ cho lần bị thay thế, lần gỡ nạp, lần ghép thời hạn, hoặc do người gọi tường minh. */
  readonly signal: AbortSignal;
}

/** Đầu ra của provider TRƯỚC khi dịch vụ chuẩn hoá và nhận vào log. */
export interface SessionTitleProviderResult {
  /** Văn bản tiêu đề đề nghị. */
  readonly title: string;
  /** Seq CHÍNH XÁC trong `request.messages` mà kết quả này dùng. */
  readonly messageSeqs: readonly SessionSeq[];
  /** Tuyến LLM phụ, khi việc sinh có dùng mô hình. */
  readonly model?: SessionTitleModelIdentity;
}

/** MỘT cài đặt tiêu đề bất đồng bộ tuỳ chọn đã đăng ký với dịch vụ. */
export interface SessionTitleProvider {
  /** Id ổn định của provider, được ghi cùng tiêu đề. */
  readonly id: SessionTitleProviderId;
  /** Khi nào prompt người dùng mới khởi động sinh tự động. */
  readonly automatic: SessionTitleAutomaticMode;
  /**
   * Sinh MỘT phiên bản tiêu đề.
   * Nhận: ảnh chụp tin nhắn, tiêu đề hiện tại, tuyến hiện tại, phiên, và tín hiệu huỷ.
   * Trả: tiêu đề đề nghị cộng các seq đầu vào chính xác và tuyến provider/mô hình tuỳ chọn.
   */
  generate(request: SessionTitleProviderRequest): Promise<SessionTitleProviderResult>;
}

/** Phiên sống, khai theo CẤU TRÚC: chỉ phần miền tiêu đề chạm tới. */
export interface Session {
  /** Id phiên — khoá tra trong sổ phiên của kernel. */
  readonly id: string;
  /** Phong bì đầu phiên: `parentSession` vắng mặt nghĩa là phiên gốc. */
  readonly header: {
    /** Phiên cha, khi đây là phiên con. */
    readonly parentSession?: unknown;
  };
  /**
   * Ghi MỘT sự kiện vào log phiên; đây là đường DUY NHẤT tiêu đề đi vào log.
   * Nhận: loại sự kiện và dữ liệu của nó.
   * Trả: không.
   */
  append(type: "session/title", data: SessionTitleEventData): void;
  /** Ảnh chụp log phiên — nguồn sự thật của tiêu đề. */
  snapshotEvents(): readonly SessionEvent[];
  /** Tuyến yêu cầu chính đã ghi, khi đã có. */
  requestHeader():
    | {
        /** Cấu hình lời gọi đã ghi. */
        readonly config: SessionTitleModelIdentity;
      }
    | undefined;
}

/** Schema của seam: seam thật CHỈ gọi `parse` trước khi mồi phép gộp và trước khi phát khung nhìn. */
export interface ProjectionSchema<T> {
  /**
   * Kiểm và chuẩn hoá một giá trị đã lưu.
   * Nhận: giá trị chưa biết (đã đọc từ log hoặc từ dây).
   * Trả: giá trị đúng kiểu; ném khi không hợp lệ.
   */
  parse(value: unknown): T;
}

/** Khung nhìn dây của một đơn vị chiếu: schema của khung nhìn + hàm chiếu từ trạng thái. */
export interface ProjectionWire<State, View> {
  /** Schema của khung nhìn trên dây (đúng schema bản gốc khai). */
  readonly viewSchema: ProjectionSchema<View>;
  /**
   * Chiếu trạng thái phép gộp thành khung nhìn trên dây.
   * Nhận: trạng thái đã gộp.
   * Trả: khung nhìn sẽ phát.
   */
  view(state: State): View;
}

/** Một đơn vị chiếu host-only mà seam `sessionProjections` nhận. */
export interface ProjectionDefinition<State, View> {
  /** Khoá chiếu; bản gốc dùng `title` và `titleInput`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu; bản gốc dùng `1` cho `title` và `3` cho `titleInput`. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: ProjectionSchema<State>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không.
   * Trả: trạng thái rỗng — `titleInput` dùng CHUNG một vật thể cho mọi phiên (đo được ở bản gốc).
   */
  init(): State;
  /**
   * Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau.
   * Nhận: trạng thái trước và sự kiện đã cam kết.
   * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi sự kiện không đổi gì.
   */
  apply(state: State, event: SessionEvent): State;
  /** Khung nhìn dây của đơn vị chiếu; `titleInput` KHÔNG khai (bản gốc chỉ đăng ký phép gộp). */
  readonly wire?: ProjectionWire<State, View>;
}

/** Seam `sessionProjections`: nơi row đăng ký đơn vị chiếu và đọc trạng thái của row khác. */
export interface SessionProjectionsSeam {
  /** Đăng ký một đơn vị chiếu; seam thật gỡ nó khi fiber của plugin này rút. */
  register(definition: ProjectionDefinition<unknown, unknown>): unknown;
  /**
   * Đọc trạng thái ĐÃ GỘP của một đơn vị chiếu trên một phiên.
   * Nhận: phiên và khoá chiếu.
   * Trả: trạng thái của đơn vị chiếu đó — hình dạng do bên gọi khai.
   */
  stateOf(session: Session, key: string): unknown;
}

/** Seam `sessions`: sổ phiên sống của kernel. */
export interface SessionsSeam {
  /** Tra một phiên sống theo id; vắng mặt khi phiên đã chết hoặc chưa tồn tại. */
  get(id: string): Session | undefined;
  /** Liệt kê mọi phiên đang sống. */
  list(): readonly Session[];
}

/** Fiber cordis của plugin sở hữu dịch vụ — dùng để biết plugin còn sống hay đã bắt đầu gỡ. */
export interface OwnerFiber {
  /** Định danh fiber, hoặc null sau khi fiber đã rút khỏi cây. */
  readonly uid: number | null;
  /** Trạng thái fiber; `2` là trạng thái ĐANG CHẠY của kernel. */
  readonly state: number;
}

/** Tuỳ chọn của lời gọi `llm/stream` — chỉ phần nhận diện tuyến mà row này đọc. */
export interface LlmStreamOptions {
  /** Phiên của lời gọi, khi có. */
  readonly sessionId?: string;
  /** Tuyến provider của lời gọi. */
  readonly provider: string;
  /** Mô hình của lời gọi. */
  readonly model: string;
}

/** Tuỳ chọn của một hook cordis — chỉ hai cờ mà row này dùng (`global`/`prepend` của waterfall). */
export interface HookOptions {
  /** Nghe cả sự kiện phát từ context khác (waterfall của `llm/stream` cần cờ này). */
  readonly global?: boolean;
  /** Chèn hàm xử lý lên ĐẦU chuỗi waterfall. */
  readonly prepend?: boolean;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: seam + hook, không import gói seam nào. */
export interface SessionTitleHost {
  /** Sổ phiên sống. */
  readonly sessions: SessionsSeam;
  /** Sổ chiếu phiên — nơi hai đơn vị chiếu `title`/`titleInput` được đăng ký. */
  readonly sessionProjections: SessionProjectionsSeam;
  /** Fiber sở hữu plugin này. */
  readonly fiber: OwnerFiber;
  /** Bộ ghi log của kernel. */
  readonly logger: {
    /**
     * Ghi một cảnh báo.
     * Nhận: thông điệp đã định dạng.
     * Trả: không.
     */
    warn(message: string): void;
  };
  /**
   * Đăng ký MỘT hiệu ứng: thân chạy ngay, hàm dọn chạy khi fiber rút.
   * Nhận: hàm trả hàm dọn, và nhãn hiệu ứng (kernel dùng để chẩn đoán).
   * Trả: hàm dọn của chính hiệu ứng.
   */
  effect(callback: () => () => unknown, label?: string): unknown;
  /**
   * Nghe `session/event`: MỌI sự kiện đã cam kết của mọi phiên.
   * Nhận: hàm xử lý nhận (phiên, sự kiện) và tuỳ chọn hook.
   * Trả: hàm dọn.
   */
  on(
    event: "session/event",
    listener: (session: Session, event: SessionEvent) => void,
    options?: HookOptions,
  ): unknown;
  /**
   * Nghe `session/disposed`: một phiên vừa chết.
   * Nhận: hàm xử lý nhận phiên và tuỳ chọn hook.
   * Trả: hàm dọn.
   */
  on(event: "session/disposed", listener: (session: Session) => void, options?: HookOptions): unknown;
  /**
   * Nghe `llm/stream`: waterfall của MỌI lời gọi LLM (bản gốc đăng ký `global` + `prepend`).
   * Nhận: hàm xử lý nhận (tuỳ chọn lời gọi, `next`) và tuỳ chọn hook.
   * Trả: hàm dọn.
   */
  on(
    event: "llm/stream",
    listener: (options: LlmStreamOptions, next: () => unknown) => unknown,
    options?: HookOptions,
  ): unknown;
}
