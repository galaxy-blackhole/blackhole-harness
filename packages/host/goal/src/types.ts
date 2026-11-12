/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng KIỂU của miền goal: danh tính goal, ảnh chụp bền, khung nhìn sống, thay đổi bền,
 *      nguồn message của vòng goal, phép gộp, và hai seam mà service gọi tới (sổ agent + sổ chiếu phiên).
 *      Viết lại theo hành vi của @deepseek-ai/dsh-goal; seam khai theo CẤU TRÚC để gói không kéo
 *      gói ngoài bảng §3b vào chương trình.
 */

import type { GoalId } from "./runtime.ts";

/** Danh tính goal đã đóng dấu thương hiệu ở mức KIỂU (lúc chạy vẫn là chuỗi thuần, y bản gốc). */
export type { GoalId };

/** Tham chiếu so-sánh-và-đặt cho ĐÚNG một revision của một goal. */
export interface GoalRef {
  /** Danh tính goal bền vững. */
  readonly id: GoalId;
  /** Revision dương; mỗi thay đổi bền tăng nó đúng một. */
  readonly revision: number;
}

/** Yêu cầu tạo goal; trần vòng bỏ trống sẽ do cấu hình triển khai quyết định. */
export interface CreateGoalRequest {
  /** Mục tiêu hoàn thành do người dùng yêu cầu. */
  readonly objective: string;
  /** Trần số vòng goal được nhận. */
  readonly maxGoalRounds?: number;
}

/** Xác nhận an toàn qua dây của một goal vừa tạo. */
export interface CreateGoalResult {
  /** Tham chiếu của goal vừa tạo. */
  readonly ref: GoalRef;
}

/** Các trường mà một lần sửa có thể thay; phải có ít nhất một trường. */
export interface EditGoalRequest {
  /** Mục tiêu thay thế. */
  readonly objective?: string;
  /** Trần vòng thay thế. */
  readonly maxGoalRounds?: number;
}

/** Pha vòng đời bền. Quyền tự động chạy là phạm vi tiến trình, tách khỏi pha này. */
export type GoalPhase = "active" | "paused" | "blocked" | "complete";

/** Lý do chặn: mã ổn định để định tuyến máy + câu giải thích cho người và model. */
export interface GoalBlockReason {
  /** Phân loại lower-kebab-case ổn định do chính sách chặn chọn. */
  readonly code: string;
  /** Câu giải thích khác rỗng, đã chuẩn hoá khoảng trắng hai đầu. */
  readonly message: string;
}

/** Toàn bộ trạng thái bền mà MỌI thay đổi không-phải-clear ghi ra. */
export interface GoalSnapshot extends GoalRef {
  /** Mục tiêu hoàn thành do người dùng yêu cầu. */
  readonly objective: string;
  /** Pha vòng đời bền. */
  readonly phase: GoalPhase;
  /** Có mặt ĐÚNG KHI `phase` là `blocked`. */
  readonly blockedReason?: GoalBlockReason;
  /** Trần tổng số vòng goal được nhận. */
  readonly maxGoalRounds: number;
}

/** Tiến trình này có được TỰ ĐỘNG chạy tiếp một goal đang `active` hay không. */
export type GoalActivation = "armed" | "disarmed";

/** Cập nhật quyền tự động (phạm vi tiến trình) phát cho Client. */
export interface GoalActivationChanged {
  /** Phiên có quyền tự động vừa đổi. */
  readonly sessionId: string;
  /** Quyền hiện tại; VẮNG khi không có goal hiện tại. */
  readonly goal?: {
    /** Danh tính goal hiện tại. */
    readonly id: GoalId;
    /** Revision hiện tại. */
    readonly revision: number;
    /** Quyền tự động hiện tại. */
    readonly activation: GoalActivation;
  };
}

/** Khung nhìn SỐNG của goal hiện tại: ảnh chụp bền + giá trị dẫn xuất + quyền tự động. */
export interface GoalView extends GoalSnapshot {
  /** Vòng cao nhất đã được nhận cho goal này. */
  readonly roundsStarted: number;
  /** Miligiây epoch của lần tạo. */
  readonly createdAt: number;
  /** Miligiây epoch của lần thay đổi gần nhất. */
  readonly updatedAt: number;
  /** Quyền tự động chạy tiếp (phạm vi tiến trình, không bao giờ ghi bền). */
  readonly activation: GoalActivation;
}

/** Giá trị của khoá chiếu `goal`: ảnh chụp bền + bộ đếm vòng đã nhận. */
export interface GoalProjection {
  /** Ảnh chụp bền hiện tại (tham chiếu CAS đi kèm nó). */
  readonly goal: GoalSnapshot;
  /** Vòng cao nhất đã được nhận. */
  readonly roundsStarted: number;
  /** Miligiây epoch của lần tạo. */
  readonly createdAt: number;
  /** Miligiây epoch của lần thay đổi gần nhất. */
  readonly updatedAt: number;
}

/** Trạng thái checkpoint NGHIÊM của khoá chiếu `goal`. */
export interface GoalProjectionState {
  /** Goal hiện tại hợp lệ gần nhất, hoặc `null` trước lần tạo đầu và sau tombstone clear. */
  readonly current: GoalProjection | null;
  /** Danh tính goal đã từng được tạo trong phiên (để từ chối dùng lại). */
  readonly seenGoalIds: GoalId[];
  /** Lỗi phát lại NGHIÊM đầu tiên, hoặc `null` khi dòng bền vẫn hợp lệ. */
  readonly failure: string | null;
}

/** Động từ thay đổi trạng thái goal được ghi vào thay đổi nguồn bền. */
export type GoalOperation = "create" | "edit" | "pause" | "resume" | "complete" | "block" | "clear";

/** Thay đổi toàn-ảnh-chụp do một sự kiện `goal/change` bền cam kết. */
export interface GoalSnapshotChangeMeta {
  /** Loại thay đổi của miền goal (nguyên văn trên dây). */
  readonly kind: "goal/change";
  /** Phiên bản thay đổi (nguyên văn trên dây). */
  readonly version: 1;
  /** Động từ đã cam kết (mọi động từ trừ `clear`). */
  readonly operation: Exclude<GoalOperation, "clear">;
  /** Ảnh chụp SAU thay đổi. */
  readonly goal: GoalSnapshot;
  /** Bộ đếm vòng đã nhận sau thay đổi. */
  readonly roundsStarted: number;
  /** Miligiây epoch của lần tạo. */
  readonly createdAt: number;
  /** Miligiây epoch của thay đổi này. */
  readonly updatedAt: number;
}

/** Tombstone giữ lại khi goal hiện tại bị xoá. */
export interface GoalClearChangeMeta {
  /** Loại thay đổi của miền goal (nguyên văn trên dây). */
  readonly kind: "goal/change";
  /** Phiên bản thay đổi (nguyên văn trên dây). */
  readonly version: 1;
  /** Động từ `clear`. */
  readonly operation: "clear";
  /** Tham chiếu một revision QUÁ revision bị xoá. */
  readonly cleared: GoalRef;
  /** Miligiây epoch của lần xoá. */
  readonly clearedAt: number;
}

/** Hợp của hai dạng thay đổi bền của miền goal. */
export type GoalChangeMeta = GoalSnapshotChangeMeta | GoalClearChangeMeta;

/** Hình dạng THÔ của một nguồn message trước khi thu hẹp (mọi trường đều chưa tin). */
export interface GoalSourceLike {
  /** Loại nguồn (chưa tin). */
  readonly kind?: unknown;
  /** Danh tính goal (chưa tin). */
  readonly goalId?: unknown;
  /** Revision (chưa tin). */
  readonly revision?: unknown;
  /** Số vòng (chưa tin). */
  readonly round?: unknown;
}

/** Nguồn message của một vòng continuation đã được nhận. */
export interface GoalMessageSource {
  /** Loại nguồn (nguyên văn). */
  readonly kind: "goal";
  /** Goal mà vòng này thuộc về. */
  readonly goalId: GoalId;
  /** Revision mà vòng này đã đặt chỗ. */
  readonly revision: number;
  /** Số vòng dương. */
  readonly round: number;
}

/** Kết quả phép gộp THUẦN trên các dự kiện bền của goal. */
export interface FoldedGoal {
  /** Goal hiện tại; vắng sau clear hoặc trước lần tạo đầu. */
  readonly goal?: GoalSnapshot;
  /** Vòng cao nhất đã nhận cho goal hiện tại. */
  readonly roundsStarted: number;
  /** Thời điểm tạo goal hiện tại; vắng khi không có goal. */
  readonly createdAt?: number;
  /** Thời điểm thay đổi gần nhất; vắng khi không có goal. */
  readonly updatedAt?: number;
  /** Tham chiếu thay đổi gần nhất, kể cả tombstone clear. */
  readonly lastRef?: GoalRef;
}

/** Trạng thái phép gộp đang được LÁI (giữ thêm tập id đã thấy + tham chiếu gần nhất). */
export interface GoalFoldState {
  /** Goal hiện tại. */
  goal: GoalSnapshot | undefined;
  /** Vòng cao nhất đã nhận. */
  roundsStarted: number;
  /** Thời điểm tạo. */
  createdAt: number | undefined;
  /** Thời điểm thay đổi gần nhất. */
  updatedAt: number | undefined;
  /** Tham chiếu thay đổi gần nhất. */
  lastRef: GoalRef | undefined;
  /** Danh tính goal đã từng được tạo trong phiên. */
  readonly seenGoalIds: Set<GoalId>;
}

/** Thông báo SỐNG sau khi một thay đổi bền của goal đã cam kết. */
export interface GoalChanged {
  /** Động từ đã cam kết. */
  readonly operation: GoalOperation;
  /** Tham chiếu của thay đổi vừa cam kết. */
  readonly ref: GoalRef;
  /** Khung nhìn sống sau thay đổi; vắng với tombstone clear. */
  readonly goal?: GoalView;
}

/** Mã lỗi ổn định cho các lượt đọc/ghi goal bị từ chối. */
export type GoalErrorCode =
  | "GOAL_AGENT_NOT_LIVE"
  | "GOAL_NOT_FOUND"
  | "GOAL_ALREADY_EXISTS"
  | "GOAL_STALE_REVISION"
  | "GOAL_INVALID_OBJECTIVE"
  | "GOAL_INVALID_MAX_ROUNDS"
  | "GOAL_INVALID_BLOCK_REASON"
  | "GOAL_INVALID_EDIT"
  | "GOAL_INVALID_TRANSITION";

/** Mặc định triển khai cho việc tạo goal. */
export interface Config {
  /** Tổng số vòng dùng khi yêu cầu tạo bỏ trống trần riêng. */
  defaultMaxGoalRounds?: number;
}

/** Mặc định đã PHÂN GIẢI (đã kiểm hợp lệ). */
export interface ResolvedConfig {
  /** Trần vòng mặc định, số nguyên an toàn dương. */
  defaultMaxGoalRounds: number;
}

/** Một sự kiện phiên ĐÃ CAM KẾT — chỉ ba trường mà phép gộp miền goal dùng. */
export interface SessionEventLike {
  /** Vị trí sự kiện trong log. */
  readonly seq: number;
  /** Loại sự kiện. */
  readonly type: string;
  /** Thân sự kiện (do phép gộp tự diễn giải theo loại). */
  readonly data?: any;
}

/** Phiên đang sống — chỉ hai thành viên mà service gọi tới (khai theo CẤU TRÚC). */
export interface GoalSessionLike {
  /** Danh tính phiên (dùng cho `goal/activation-changed`). */
  readonly id: string;
  /** Số sự kiện đã cam kết tại thời điểm đọc. */
  readonly seq: number;
  /**
   * Nối MỘT sự kiện vào log phiên và phát `session/event`.
   * Nhận: loại sự kiện và thân sự kiện.
   * Trả: sự kiện đã cam kết (có `seq`).
   */
  append(type: string, data: unknown): SessionEventLike;
}

/** Agent đang sống — chỉ hai thành viên mà service gọi tới (khai theo CẤU TRÚC). */
export interface GoalAgentLike {
  /** Danh tính agent. */
  readonly id: string;
  /** Phiên mà agent sở hữu. */
  readonly session: GoalSessionLike;
}

/** Sổ agent của kernel — chỉ phép tra mà `assertLive` dùng. */
export interface AgentRegistrySeam {
  /**
   * Tra agent đang sống theo danh tính.
   * Nhận: id agent.
   * Trả: đúng thể hiện agent đang sống, hoặc `undefined`.
   */
  get(id: string): GoalAgentLike | undefined;
}

/** Đơn vị chiếu `goal` — đúng hình dạng mà sổ chiếu phiên gọi tới. */
export interface GoalProjectionDefinition {
  /** Khoá chiếu mà đơn vị này sở hữu. */
  readonly key: "goal";
  /** Kiểm trạng thái đã lưu TRƯỚC khi mồi phép gộp. */
  readonly stateSchema: { parse(value: unknown): GoalProjectionState };
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không (bản gốc cũng bỏ qua tham số của seam).
   * Trả: trạng thái ban đầu.
   */
  init(): GoalProjectionState;
  /**
   * Phép chuyển THUẦN của đơn vị.
   * Nhận: trạng thái trước + sự kiện kế tiếp.
   * Trả: trạng thái sau (cùng tham chiếu khi sự kiện không liên quan).
   */
  apply(state: GoalProjectionState, event: SessionEventLike): GoalProjectionState;
  /** Khung nhìn dây phát cho Client. */
  readonly wire: {
    /** Schema của khung nhìn trên dây. */
    readonly viewSchema: { parse(value: unknown): GoalProjection | null };
    /**
     * Chiếu trạng thái đã gộp thành khung nhìn dây.
     * Nhận: trạng thái đã gộp.
     * Trả: goal hiện tại, hoặc `null`.
     */
    view(state: GoalProjectionState): GoalProjection | null;
  };
  /** Phiên bản làm mới kho checkpoint. */
  readonly stateVersion: number;
}

/** Sổ chiếu phiên của kernel — chỉ hai phép mà service gọi tới. */
export interface ProjectionRegistrySeam {
  /**
   * Đăng ký MỘT đơn vị chiếu.
   * Nhận: định nghĩa đơn vị.
   * Trả: hàm dọn của đăng ký (service bỏ qua giá trị này như bản gốc).
   */
  register(definition: GoalProjectionDefinition): unknown;
  /**
   * Đọc trạng thái đã gộp của MỘT khoá.
   * Nhận: phiên và khoá chiếu.
   * Trả: trạng thái đã gộp, hoặc `undefined` khi khoá chưa đăng ký.
   */
  stateOf(session: GoalSessionLike, key: "goal"): GoalProjectionState | undefined;
}

/** Chân trời mà service nhìn thấy trên Context cordis (khai theo CẤU TRÚC). */
export interface GoalContextSeam {
  /** Sổ agent đang sống. */
  readonly agents: AgentRegistrySeam;
  /** Sổ chiếu phiên. */
  readonly sessionProjections: ProjectionRegistrySeam;
  /**
   * Nghe MỘT sự kiện.
   * Nhận: tên sự kiện + người nghe.
   * Trả: hàm dọn do cordis cấp (service bỏ qua giá trị này như bản gốc).
   */
  on(name: string, listener: (...args: any[]) => unknown): unknown;
  /**
   * Phát MỘT sự kiện KHÔNG phạm vi.
   * Nhận: tên sự kiện + thân sự kiện.
   * Trả: không; lỗi của người nghe LAN ra người gọi (đúng `ctx.emit` của kernel).
   */
  emit(name: string, payload: unknown): void;
  /** Bộ ghi log của kernel (chỉ dùng cho chẩn đoán người nghe hỏng). */
  readonly logger: { warn(message: string): void };
  /** Chùm sự kiện của kernel (dùng để tự lái một lượt phát có vật mang phạm vi). */
  readonly events: {
    /**
     * Giải người nghe cho MỘT lượt phát.
     * Nhận: chế độ phát + mảng đối số (phần tử đầu có thể là `this`).
     * Trả: các callback đã gắn `this`; mảng đối số bị CẮT tại chỗ như bản gốc.
     */
    dispatch(mode: string, args: unknown[]): ((...args: unknown[]) => unknown)[];
  };
}

/** Trạng thái phạm vi tiến trình của MỘT phiên. */
export interface GoalRuntimeState {
  /** Quyền tự động chạy tiếp hiện tại. */
  activation: GoalActivation;
  /** Lượt cam kết đang chờ, được khớp với `seq` của sự kiện vừa ghi. */
  pendingActivation: { readonly offset: number; readonly activation: GoalActivation } | undefined;
}
