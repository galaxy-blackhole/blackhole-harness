/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Từ vựng CÔNG KHAI của sổ đăng ký workspace (bản gốc: lib/types/types.d.ts): thương hiệu
 *      `WorkspaceId`, giao diện `Workspace` mà người dùng thấy, họ `SessionActivity`, và các SEAM
 *      khai theo CẤU TRÚC (header phiên · bảng KV · facility miền · session persistence) — nhờ vậy gói
 *      không phải khai peer ngoài bảng §3b của docs/recipes/HOST-ROW-REWRITE.md.
 */
import type { SessionId } from "@galaxy-blackhole/gbh-session/types";

/**
 * Chuỗi mang THƯƠNG HIỆU lúc biên dịch — cùng quy ước `Branded<T>` của kernel, khai TẠI CHỖ vì
 * `brandString` của `@deepseek-ai/dsh-brand` là hàm ĐỒNG NHẤT (đo được: `(value) => value`) nên
 * một bản sao cho giá trị y hệt; khai peer chỉ để lấy kiểu là cái giá không đáng.
 */
export type Branded<T extends string> = string & { readonly __gbhBrand?: T };

/**
 * Id của MỘT phiên — DÙNG LẠI brand của `gbh-session` (KHÔNG khai bản riêng): consumer
 * (api-workspace-controller · session · session-persistence) đều dùng `@deepseek-ai/dsh-session/types#SessionId`,
 * khai riêng thì hai thương hiệu KHÔNG gán được cho nhau ⇒ TS2322. Thuần KIỂU, không đổi runtime.
 */
export type { SessionId };

/**
 * Id của MỘT bản ghi workspace: uuid SINH RA, KHÔNG BAO GIỜ là đường dẫn — chuẩn tắc hoá đường dẫn
 * viết lại đường dẫn, còn mốc neo tham chiếu thì phải đứng yên.
 */
export type WorkspaceId = Branded<"WorkspaceId">;

/**
 * Các HỌ hoạt động mà một listener `workspace/session-activity` có thể báo. Gói này KHÔNG khai họ
 * nào (bản gốc cũng vậy: mỗi provider tự gộp khoá của mình); gói không ship `.d.ts` nên kiểu ở đây
 * để MỞ cho mọi chuỗi — đúng thứ mà một consumer gộp khoá của nó sẽ thấy.
 */
export interface SessionActivityKindMap {}

/** Một khoá họ hoạt động. */
export type SessionActivityKind = keyof SessionActivityKindMap | string;

/** Một mục đang hoạt động của một họ CÓ danh tính theo từng mục. */
export interface SessionActivityItem {
  /** Danh tính theo họ: id phiên, id job, hay id lịch. */
  readonly id: string;
  /** Nhãn hiển thị khi họ có nhãn (nhãn job, nhãn subagent). */
  readonly label?: string;
}

/**
 * Một lý do khiến phiên bị coi là ĐANG HOẠT ĐỘNG khi xét quyền lưu trữ. Họ có danh tính theo từng mục
 * thì liệt kê mục của nó để bên gọi gọi tên được thứ phải dừng.
 */
export interface SessionActivity {
  /** Họ hoạt động. */
  readonly kind: SessionActivityKind;
  /** Các mục đang hoạt động; vắng mặt với họ không có danh tính theo mục (`turn`). */
  readonly items?: readonly SessionActivityItem[];
}

/**
 * Một workspace: id ỔN ĐỊNH trên một thư mục có thật, một tiêu đề hiển thị, và một sổ ứng viên phiên
 * CÓ THỨ TỰ. Tư cách thành viên kiểm `cwd` trong header so với đường dẫn workspace, nhưng GIỮ NGUYÊN
 * một mục đã có khi `cwd` đầy đủ của nó biến mất. Người dùng chỉ thấy giao diện này; phần cài đặt ở
 * trong gói.
 */
export interface Workspace {
  /** Id bản ghi ổn định (uuid sinh ra). */
  readonly id: WorkspaceId;
  /** Đường dẫn thư mục ĐÃ CHUẨN TẮC (`fs.realpath` của đường dẫn lúc tạo). Không bao giờ viết lại. */
  readonly path: string;
  /** Tiêu đề hiển thị; mặc định là đoạn cuối của đường dẫn (hoặc chính cách viết gốc của ổ đĩa). */
  readonly title: string;
  /** Mốc tạo ISO-8601, đóng dấu lúc tạo và không bao giờ viết lại. */
  readonly createdAt: string;
  /** Mốc ISO-8601 của lượt thay đổi BỀN gần nhất (lượt tạo tính là một lượt). */
  readonly updatedAt: string;
  /** Các phiên đã kiểm header, theo thứ tự do người dùng sở hữu. */
  readonly sessionIds: readonly SessionId[];
  /**
   * Thay tiêu đề hiển thị một cách BỀN.
   * Nhận: tiêu đề mới (chuỗi bất kỳ; trùng giữa các workspace được phép).
   * Trả: promise phân giải sau khi bền.
   */
  setTitle(title: string): Promise<void>;
  /**
   * Đưa một phiên lên ĐẦU sổ ứng viên của workspace này.
   * Nhận: phiên cần ghi; `cwd` trong header của nó phải trỏ đúng thư mục này.
   * Trả: promise phân giải sau khi bền.
   */
  attachSession(sessionId: SessionId): Promise<void>;
  /**
   * Chuyển một phiên ĐÃ CÓ trong sổ, kiểu DOM-insertBefore: có mốc neo thì chèn TRƯỚC mốc đó, không
   * có thì nối vào CUỐI. Chỉ id được chuyển đổi vị trí.
   * Nhận: phiên cần chuyển và mốc neo (tuỳ chọn).
   * Trả: promise phân giải sau khi bền.
   */
  insertSessionBefore(sessionId: SessionId, beforeSessionId?: SessionId): Promise<void>;
  /**
   * Bỏ một phiên khỏi sổ của workspace này. Idempotent; KHÔNG BAO GIỜ chạm log đã lưu của phiên.
   * Nhận: phiên cần bỏ.
   * Trả: promise phân giải sau khi bền.
   */
  detachSession(sessionId: SessionId): Promise<void>;
  /**
   * Phép kiểm thư mục SỐNG, không cache: đường dẫn còn tồn tại và là thư mục không.
   * Nhận: không.
   * Trả: `'ok'` khi thư mục có thật, `'missing-dir'` khi không.
   */
  status(): Promise<"ok" | "missing-dir">;
}

/** Yêu cầu của waterfall `workspace/session-activity`: phiên sắp được lưu trữ. */
export interface SessionActivityRequest {
  /** Phiên sắp vào sổ lưu trữ. */
  readonly sessionId: SessionId;
}

/** Lựa chọn của bên gọi cho `WorkspaceRegistry.archiveSession`. */
export interface ArchiveSessionOptions {
  /**
   * Xin các provider DỪNG công việc đang chạy của phiên thay vì từ chối lưu trữ vì nó. Lượt lưu trữ
   * ghi TRƯỚC, các lượt dừng xin SAU; không chờ công việc đang chạy tới điểm kết, và provider hỏng chỉ
   * bị ghi log chứ không hoàn tác lượt lưu trữ.
   */
  readonly stopActivity?: boolean;
}

/**
 * Header phiên ở ĐÚNG phần mà sổ này đọc: id, `cwd` trong header, và mốc tạo. Khai theo CẤU TRÚC để
 * không phải khai peer `@deepseek-ai/dsh-session` (ngoài bảng §3b).
 */
export interface SessionHeaderLike {
  /** Id phiên. */
  readonly id: SessionId;
  /** Thư mục làm việc đã ghi trong header; vắng = phiên không khai được chỗ. */
  readonly cwd?: string;
  /** Mốc tạo (ms epoch) — dùng để xếp nhóm "mới nhất trước". */
  readonly createdAt: number;
}
