/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu dữ liệu của nửa HOST session-log-export: mức nén, bộ dịch vụ một lần xuất cần, hình dạng
 *      một mục trong ZIP, và bề mặt service tối thiểu mà plugin chạm (commands · connection)
 */

import type { Context } from "@deepseek-ai/cordis";
import type { AttachmentStore, FileAttachmentRef, ImageAttachmentRef } from "@deepseek-ai/dsh-attachment";
import type { SessionEvent, SessionHeader, SessionId, SessionStore } from "@deepseek-ai/dsh-session";
import type { SessionPersistence } from "@deepseek-ai/dsh-session-persistence";
import type { SessionQueryEngine } from "@deepseek-ai/dsh-session-query";

export type { AttachmentStore, Context, FileAttachmentRef, ImageAttachmentRef, SessionEvent, SessionHeader, SessionId, SessionPersistence, SessionQueryEngine, SessionStore };

/** Mức nén DEFLATE hợp lệ mà fflate nhận cho mỗi mục ZIP (0 = không nén, 9 = nén tối đa). */
export type SessionLogCompressionLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Các dịch vụ mà một lần xuất log PHIÊN cần (sổ phiên sống là TUỲ CHỌN). */
export interface SessionLogExportDeps {
  /** Bộ máy truy vấn phiên — nguồn của cây dòng dõi subagent. */
  readonly sessionQuery: SessionQueryEngine | undefined;
  /** Kho lưu bền của sổ phiên — nguồn của log canonical đã ghi. */
  readonly sessionPersistence: SessionPersistence | undefined;
  /** Kho tệp đính kèm — nguồn byte của ảnh và tệp được log tham chiếu. */
  readonly attachments: AttachmentStore | undefined;
  /** Sổ phiên ĐANG SỐNG (tuỳ chọn) — chỉ dùng cho hàng rào flush trước khi đọc. */
  readonly sessions: SessionStore | undefined;
}

/** Các dịch vụ đã HẸP lại còn những cái đã có — đúng cái mà luồng ZIP thật đọc. */
export interface SessionLogExportReady {
  /** Bộ máy truy vấn phiên. */
  readonly sessionQuery: SessionQueryEngine;
  /** Kho lưu bền của sổ phiên. */
  readonly sessionPersistence: SessionPersistence;
  /** Kho tệp đính kèm. */
  readonly attachments: AttachmentStore;
  /** Sổ phiên đang sống (tuỳ chọn). */
  readonly sessions: SessionStore | undefined;
}

/** Một tệp được xuất: log phiên đã tuần tự hoá, hoặc một đối tượng đính kèm được tham chiếu. */
export type SessionLogZipEntry =
  | {
      /** Đường dẫn trong ZIP. */
      readonly path: string;
      /** Văn bản JSONL canonical của log. */
      readonly content: string;
    }
  | {
      /** Đường dẫn trong ZIP. */
      readonly path: string;
      /** Byte của một ảnh đã lưu (đọc trọn, có trần kích thước). */
      readonly data: Uint8Array;
    }
  | {
      /** Đường dẫn trong ZIP. */
      readonly path: string;
      /** Dòng byte của một tệp chung, đọc theo luồng. */
      readonly chunks: AsyncIterable<Uint8Array>;
    };

/** Một lời gọi lệnh của con người (phần plugin này đọc). */
export interface CommandInvocation {
  /** Toàn bộ văn bản người dùng gõ sau tên lệnh. */
  readonly rawInput: string;
}

/** Kết quả một lệnh của con người. */
export interface CommandResult {
  /** Loại kết quả. */
  readonly kind: "success" | "error";
  /** Văn bản hiển thị lại cho người dùng. */
  readonly text: string;
}

/** Định nghĩa một lệnh của con người đăng ký vào sổ lệnh của kernel. */
export interface CommandDefinition {
  /** Danh tính bền của định nghĩa (chuỗi brand của bản gốc). */
  readonly definitionId: string;
  /** Tên gõ trên khung chat. */
  readonly name: string;
  /** Mô tả hiển thị trong menu lệnh. */
  readonly description: string;
  /** Xử lý một lời gọi. */
  readonly handler: (invocation: CommandInvocation) => Promise<CommandResult>;
}

/** Sổ lệnh của con người do kernel cấp (chỉ phần plugin này dùng). */
export interface CommandRegistry {
  /** Đăng ký một lệnh; trả hàm huỷ đăng ký để ctx.effect gọi khi gỡ. */
  register(definition: CommandDefinition): () => void;
}

/** Đăng ký một route HTTP vào tầng vận chuyển của kernel (chỉ phần plugin này dùng). */
export interface ConnectionFetch {
  /** Đăng ký route; kernel tự kiểm quyền trước khi gọi handler. */
  register(route: FetchRoute): unknown;
}

/** Một route HTTP mà plugin này đăng ký. */
export interface FetchRoute {
  /** Đường dẫn tuyệt đối. */
  readonly path: string;
  /** Phương thức được nhận. */
  readonly methods: readonly string[];
  /** Thân yêu cầu được đệm trước khi giao cho handler. */
  readonly requestBody: "buffered";
  /** Xử lý một yêu cầu đã xác thực. */
  readonly fetch: (request: Request) => Promise<Response>;
}
