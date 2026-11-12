/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu theo CẤU TRÚC cho các seam mà @galaxy-blackhole/gbh-file-reference-local chạm tới —
 *      chỉ mượn KIỂU, không import lúc chạy: sổ agent, thư mục làm việc, prompt hệ thống, sổ tool, và
 *      hình dạng sự kiện phiên. Nhờ vậy row HOST-ONLY này không kéo thêm thể hiện nào của kernel.
 */

import type { Agent } from "@deepseek-ai/dsh-agent";

/**
 * Một mục ngữ cảnh prompt hệ thống do row này cài cho từng agent.
 * Nguyên văn hình dạng mà `systemPrompt.section` của bản gốc nhận.
 */
export interface FileReferencePromptSection {
  /** Tên mục — nguyên văn `context:file-reference` của bản gốc. */
  name: string;
  /** Thứ tự của mục, lấy từ `getSectionOrder("FILE_REFERENCE")` chứ không tự đặt số. */
  order: number;
  /** Hàm dựng chữ — gọi MỖI lượt, nên chữ phản ánh trạng thái sổ tool tại thời điểm dựng. */
  text: () => string;
}

/** Seam prompt hệ thống: cài một mục và đọc thứ tự chuẩn của họ mục `FILE_REFERENCE`. */
export interface FileReferenceSystemPromptSeam {
  /**
   * Cài một mục ngữ cảnh prompt.
   * Nhận: mục cần cài (tên · thứ tự · hàm dựng chữ).
   * Trả: không; việc gỡ thuộc fiber đã cài nó.
   */
  section(section: FileReferencePromptSection): unknown;
  /**
   * Đọc thứ tự chuẩn của một họ mục.
   * Nhận: tên họ mục (`FILE_REFERENCE`).
   * Trả: số thứ tự để truyền lại cho `section`.
   */
  getSectionOrder(family: string): number;
}

/** Sổ tool của agent — row này chỉ hỏi một câu: agent có tool `read` không. */
export interface FileReferenceToolsSeam {
  /**
   * Tra một tool theo tên cho một agent.
   * Nhận: tên tool + agent cần tra.
   * Trả: thể hiện tool, hoặc `undefined` khi agent không có tool đó.
   */
  get(name: string, agent: Agent): unknown;
}

/** Phạm vi mà `agent.ctx.inject(["systemPrompt", "tools"], …)` cấp cho callback. */
export interface FileReferencePromptScope {
  /** Seam prompt hệ thống của agent. */
  systemPrompt: FileReferenceSystemPromptSeam;
  /** Sổ tool của agent. */
  tools: FileReferenceToolsSeam;
}

/** Fiber mà một lời gọi `inject` trả về — gỡ nó là rút mục prompt đã cài. */
export interface FileReferencePromptFiber {
  /**
   * Gỡ mục prompt đã cài.
   * Nhận: không.
   * Trả: promise hoàn tất khi phạm vi đã đóng.
   */
  dispose(): Promise<void>;
}

/** Context RIÊNG của một agent — nơi mục prompt được cài và gỡ theo vòng đời agent. */
export interface FileReferencePromptContext {
  /** Sổ tool của CHÍNH agent — mục prompt đọc nó để biết agent có tool `read` hay không. */
  tools: FileReferenceToolsSeam;
  /**
   * Cài một callback vào phạm vi đã có đủ các seam đã nêu.
   * Nhận: danh sách tên seam cần chờ + callback nhận phạm vi đó.
   * Trả: fiber đại diện cho lần cài, gỡ được bằng `dispose`.
   */
  inject(dependencies: readonly string[], callback: (scope: FileReferencePromptScope) => void): FileReferencePromptFiber;
}

/** Sổ agent của host: liệt kê agent đang sống và tra theo id phiên. */
export interface FileReferenceAgentsSeam {
  /**
   * Liệt kê agent đang sống.
   * Nhận: không.
   * Trả: mảng agent (thứ tự do kernel quyết định).
   */
  list(): Agent[];
  /**
   * Tra agent theo id phiên.
   * Nhận: id phiên.
   * Trả: agent, hoặc `undefined` khi phiên không có agent sống.
   */
  get(sessionId: string): Agent | undefined;
}

/** Seam thư mục làm việc: chốt cwd của agent, có thể chờ và huỷ được. */
export interface FileReferenceWorkingDirectorySeam {
  /**
   * Chốt thư mục làm việc của một agent.
   * Nhận: agent + tín hiệu huỷ của người gọi.
   * Trả: đường dẫn tuyệt đối của cwd.
   */
  ensure(agent: Agent, signal?: AbortSignal): Promise<string>;
}

/** Ghi cảnh báo của plugin — chỉ dùng cho lỗi dọn dẹp không được phép làm hỏng lượt gỡ. */
export interface FileReferenceLoggerSeam {
  /**
   * Ghi một dòng cảnh báo.
   * Nhận: chữ cần ghi.
   * Trả: không.
   */
  warn(message: string): void;
}

/** Một sự kiện phiên ở dạng row này cần đọc — chỉ trường `type`. */
export interface FileReferenceSessionEvent {
  /** Loại sự kiện; row này chỉ quan tâm `tool/result`. */
  type: string;
}

/** Phiên ở dạng row này cần đọc — chỉ trường `id`. */
export interface FileReferenceSession {
  /** Id phiên, dùng để tra agent tương ứng. */
  id: string;
}

/**
 * Context host mà plugin này cần: cộng thêm bốn seam lên Context cordis.
 * Khai theo cấu trúc để row HOST-ONLY không phải kéo thể hiện thứ hai của gói nào.
 */
export interface FileReferenceContext {
  /** Sổ agent. */
  agents: FileReferenceAgentsSeam;
  /** Thư mục làm việc của agent. */
  workingDirectory: FileReferenceWorkingDirectorySeam;
  /** Ghi cảnh báo. */
  logger: FileReferenceLoggerSeam;
  /**
   * Đăng ký một hiệu ứng dọn dẹp gắn với vòng đời plugin.
   * Nhận: hàm dựng hàm dọn + nhãn để đọc trong nhật ký.
   * Trả: không.
   */
  effect(setup: () => () => Promise<void>, label: string): unknown;
  /**
   * Nghe một sự kiện của host.
   * Nhận: tên sự kiện + handler.
   * Trả: không.
   */
  on(event: "agent/created", handler: (payload: { agent: Agent }) => Promise<void>): unknown;
  on(event: "agent/disposed", handler: (payload: { agent: Agent }) => void): unknown;
  on(event: "session/event", handler: (session: FileReferenceSession, event: FileReferenceSessionEvent) => void): unknown;
}

/** Một ứng viên gợi ý: đường dẫn TƯƠNG ĐỐI so với gốc, không kèm nội dung tệp. */
export interface FileSearchCandidate {
  /** Đường dẫn hiển thị (dấu `/` làm ngăn cách). */
  path: string;
  /** `directory` giữ completion mở; `file` chốt lời nhắc. */
  kind: "file" | "directory";
}

/** Cấu hình đã chốt của bộ tìm: ba trường, đều BẮT BUỘC sau khi hợp nhất mặc định. */
export interface FileSearchConfig {
  /** Trần số ứng viên trả cho MỘT truy vấn. */
  maxResults: number;
  /** Trần số mục giữ trong chỉ mục của một workspace. */
  maxEntries: number;
  /** Tên thư mục bị bỏ qua khi duyệt. */
  excludedDirectories: string[];
}

/** Cấu hình người dùng cấp — mọi trường tuỳ chọn; constructor hợp nhất với mặc định. */
export interface FileSearchConfigInput {
  /** Trần số ứng viên; mặc định `DEFAULT_FILE_SEARCH_MAX_RESULTS`. */
  maxResults?: number;
  /** Trần số mục chỉ mục; mặc định `DEFAULT_FILE_SEARCH_MAX_ENTRIES`. */
  maxEntries?: number;
  /** Tên thư mục bị bỏ qua; mặc định `DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES`. */
  excludedDirectories?: string[];
}
