/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu công khai + bảng thứ tự của sổ lắp ghép system prompt: mục prompt, ngữ cảnh động,
 *      schema tool, biến nội suy và bản lắp đã giải. Khai theo CẤU TRÚC nên không import gói seam nào.
 */

import type { ScopeKey } from "@deepseek-ai/dsh-scope";

/**
 * Thứ tự TRUNG TÂM của các mục system prompt do repo sở hữu — nguồn duy nhất để mọi row
 * đặt mục của mình đúng chỗ, thay vì mỗi bên tự chọn số.
 */
export const SECTION_ORDERS = {
  HARNESS_IDENTITY: -1000,
  DEPLOYMENT_PERSONA_PREFIX: 0,
  PLAN_POLICY: 500,
  TEAM_POLICY: 600,
  PTC_ONLY: 800,
  FILE_REFERENCE: 900,
  TOOL_BASH: 1000,
  TOOL_PWSH: 1010,
  TOOL_READ: 1100,
  TOOL_WRITE: 1200,
  TOOL_EDIT: 1300,
  TOOL_GLOB: 1400,
  TOOL_GREP: 1500,
  TOOL_JOBS: 1600,
  TOOL_PTY: 1700,
  TOOL_WEB_SEARCH: 2000,
  TOOL_WEB_FETCH: 2100,
  TOOL_LSP: 2200,
  TOOL_SESSION_QUERY: 2300,
  TOOL_GOAL: 2400,
  TOOL_WORKFLOW: 2600,
  TOOL_RALPH: 2700,
  TOOL_SUBAGENT: 2800,
  TOOL_REPORT: 2900,
  TOOL_COMPUTER_USE: 3000,
  MCP_SERVERS: 3100,
  TOOLS_SDK: 5000,
  DELIVERABLE_FILE_REFERENCES: 9000,
  STRUCTURED_OUTPUT: 9900,
  HARNESS_SOURCE: 10000,
  WEB_SURFACE: 10100,
  DEPLOYMENT_PERSONA_SUFFIX: 10200,
} as const;

/** Tên một chỗ đặt mục prompt do trung tâm cấp phát. */
export type PromptSectionOrderName = keyof typeof SECTION_ORDERS;

/** Thứ tự TRUNG TÂM của các dòng runtime context do repo sở hữu. */
export const CONTEXT_ORDERS = {
  WORKING_DIRECTORY: 100,
  SANDBOX_POLICY: 110,
  APPROVAL_POLICY: 115,
  SUBAGENT_DELEGATION: 120,
  TEAM_IDENTITY: 125,
  HARNESS_SOURCE: 200,
  WEB_SURFACE: 210,
} as const;

/** Tên một chỗ đặt runtime context do trung tâm cấp phát. */
export type PromptContextOrderName = keyof typeof CONTEXT_ORDERS;

/** Ngữ cảnh của MỘT lượt lắp prompt; các plugin được phép mở rộng thêm trường của mình. */
export interface AssembleContext {
  /** Phạm vi có provider và người nghe waterfall tham gia; vắng mặt = chỉ global. */
  readonly scope?: ScopeKey;
  /** Tín hiệu huỷ của riêng lượt lắp này (không giữ lại để điều khiển lượt sau). */
  readonly signal?: AbortSignal;
  /** Trường do plugin định nghĩa thêm cho lượt lắp này. */
  readonly [key: string]: unknown;
}

/** Một mục được đóng góp vào system prompt (đầu vào của sổ đăng ký). */
export interface PromptSection {
  /** Tên duy nhất — trùng tên trong cùng một lớp thì ném lỗi. */
  readonly name: string;
  /** Các mục được nối theo thứ tự tăng dần; bằng nhau thì so tên theo code-unit. */
  readonly order: number;
  /** Chữ tĩnh, hoặc provider chạy lại mỗi lượt lắp với {@link AssembleContext} của lượt đó. */
  readonly text: string | ((context: AssembleContext) => string);
  /** Có nội suy biến `{{variable}}` hay không; mặc định `true`, `false` giữ nguyên văn. */
  readonly interpolate?: boolean;
  /** Coi mục này là TOÀN BỘ system prompt; quá một mục "complete" đang hiệu lực thì lắp thất bại. */
  readonly complete?: boolean;
}

/** Ngữ cảnh động được hiện thực hoá thành ảnh chụp vai trò người dùng bền vững. */
export interface PromptContext {
  /** Tên duy nhất — trùng tên trong cùng một lớp thì ném lỗi. */
  readonly name: string;
  /** Các ngữ cảnh được nối theo thứ tự tăng dần. */
  readonly order: number;
  /** Chữ tĩnh hoặc provider; chữ rỗng thì không đóng góp gì. */
  readonly text: string | ((context: AssembleContext) => string);
  /** Có nội suy biến `{{variable}}` hay không; mặc định `true`, `false` giữ nguyên văn. */
  readonly interpolate?: boolean;
  /** Giữ dòng ngữ cảnh vận hành này khi ngữ cảnh runtime tuỳ chọn bị tắt. */
  readonly required?: boolean;
}

/** Một mục của bản lắp: {@link PromptSection} đã giải chữ nhưng CHƯA nội suy. */
export interface AssembledSection {
  /** Tên của mục đóng góp. */
  name: string;
  /** Chữ đã giải (chưa nội suy biến). */
  text: string;
  /** Có nội suy biến hay không; vắng mặt = có. */
  interpolate?: boolean;
}

/** Một đóng góp ngữ cảnh động đã giải. */
export interface AssembledContext {
  /** Tên của ngữ cảnh đóng góp. */
  name: string;
  /** Chữ trước khi nội suy biến. */
  text: string;
  /** Có nội suy biến hay không; vắng mặt = có. */
  interpolate?: boolean;
}

/** Hình dạng schema tool mà sổ này chép lại cho model (đúng bốn trường của bản gốc). */
export interface ToolSchema {
  /** Tên tool như model thấy. */
  name: string;
  /** Mô tả một dòng cho model. */
  description: string;
  /** JSON Schema của tham số. */
  parameters: Record<string, unknown>;
  /** Yêu cầu nạp trễ định nghĩa tool (thuật ngữ `defer_loading`). */
  deferLoading?: true;
}

/** Schema tool nhìn thấy trong một lượt lắp + tập tên TRƯỚC khi bị giới hạn theo phạm vi. */
export interface ToolProviderResult {
  /** Các schema provider này đóng góp cho CHÍNH lượt lắp này. */
  readonly schemas: readonly ToolSchema[];
  /** Vũ trụ tên trước khi giới hạn, dùng để kiểm `toolOrder`; mặc định = tên của `schemas`. */
  readonly knownNames?: readonly string[];
}

/** Một đoạn của ảnh chụp ngữ cảnh runtime, giữ nguyên tên nguồn đóng góp. */
export interface ContextSnapshotSection {
  /** Tên hệ con đã đóng góp. */
  readonly name: string;
  /** Chữ hướng tới model, đúng như đã lắp. */
  readonly text: string;
}

/** Đầu vào model đã lắp; các plugin được phép mở rộng thêm trường của mình. */
export interface PromptAssembly {
  /** Các mục prompt đã giải chữ, theo thứ tự chuẩn. */
  sections: AssembledSection[];
  /** Các dòng ngữ cảnh động đã giải, theo thứ tự chuẩn. */
  contexts: AssembledContext[];
  /** Schema tool đã ở thứ tự chuẩn. */
  tools: ToolSchema[];
  /** Giá trị biến nội suy của lượt lắp này. */
  variables: Record<string, string | undefined>;
}
