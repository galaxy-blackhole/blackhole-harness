/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Kiểu công khai + helper của service lõi `tools`: hợp đồng output tool, kết quả thi hành,
 *      quyết định pre/post, lỗi chuẩn hoá, token tương quan, gộp tín hiệu huỷ và lớp đăng ký theo
 *      scope. Tách từ src/service.ts (bản gốc lib/types/index.js) để giữ mỗi tệp ≤ 1000 dòng.
 */

import type { Agent } from "@galaxy-blackhole/gbh-agent";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, ToolCallId, ToolSchema } from "@deepseek-ai/dsh-llm";
import type { SandboxExecutionPolicy } from "@deepseek-ai/dsh-sandbox";
import type { Scoped } from "@deepseek-ai/dsh-scope";
import { AnonymousEntries, NamedEntries } from "@deepseek-ai/dsh-scope";
import type { ScopeKey } from "@deepseek-ai/dsh-scope";
import type { Session, UserMessage } from "@deepseek-ai/dsh-session";
import { deepFreeze, snapshotJsonValue } from "@deepseek-ai/dsh-util-values";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";

import { isNamedError } from "./error-identity.ts";
import type { JsonSchemaNode } from "./json-schema.ts";
import type { ToolCallView, ToolResultView } from "./presentation.ts";
import type { ToolRuntime } from "./service.ts";

/**
 * Hợp đồng đầu ra do tool tự sở hữu, dùng sau khi thân tool trả về một giá trị JSON.
 * Nhận: hình dạng đầu ra mà mọi tool đăng ký phải khai (schema + render + meta tuỳ chọn).
 * Trả: (kiểu) hợp đồng để registry validate, render và chiếu phần trình bày.
 */
export interface ToolOutputDefinition {
  /** JSON Schema thô nằm trong tập được hỗ trợ, ép lên MỌI giá trị chuẩn tắc thành công. */
  readonly schema: JsonSchemaNode;
  /** Phép chiếu thuần từ tham số đã validate và giá trị sang nội dung Native/model. */
  render(args: unknown, value: JsonValue): ContentBlock[];
  /** Phép chiếu trình bày thuần, phát lại được, cho cả lời gọi native lẫn lời gọi lồng. */
  presentationMeta?(args: unknown, value: JsonValue): JsonValue;
}

/**
 * Một tool đã đăng ký: schema cộng hàm thi hành.
 * Nhận: các trường schema mô hình thấy (name/description/parameters/deferLoading) và hợp đồng đầu ra.
 * Trả: (kiểu) định nghĩa mà {@link ToolRuntime.register} nhận và registry thi hành.
 */
export interface ToolDefinition extends ToolSchema {
  /** Khai báo đầu ra chuẩn tắc BẮT BUỘC. */
  readonly output: ToolOutputDefinition;
  /**
   * Chạy MỘT lời gọi đã được chấp nhận và chỉ trả về giá trị JSON chuẩn tắc không mất mát.
   * Việc bất đồng bộ phải quan sát hoặc chuyển tiếp `exec.signal` và chỉ kết thúc sau khi công
   * việc nó sở hữu đã lắng. Registry giữ việc huỷ của người gọi xuyên qua việc thay signal ở
   * around-dispatch và không bỏ rơi promise này, nhưng nó không thể ép dừng mã trong cùng tiến trình.
   * Nhận: args — tham số của model đã chụp không mất mát và đóng băng; exec — định danh thi hành,
   * tín hiệu huỷ và chỗ hoãn ngữ cảnh.
   * Trả: giá trị chuẩn tắc đúng như `output.schema` khai.
   */
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>;
  /**
   * Cài nội dung đã chuẩn bị lúc thi hành TRƯỚC các chính sách `tools/post-execute`.
   * Callback được chụp lúc lời gọi bắt đầu và chạy đúng một lần cho một kết quả đã chuẩn hoá đi vào
   * post-execute. Thay thế của chính sách vẫn là chung thẩm; lỗi pipeline bỏ qua post-execute thì
   * cũng bỏ qua phép chiếu này.
   * Nhận: exec — định danh thi hành bất biến kèm tham số; result — kết quả đã chuẩn hoá trước chính sách.
   * Trả: nội dung thay thế, hoặc undefined để giữ nguyên đầu ra của renderer.
   */
  projectContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
  /**
   * Phép biến đổi đồng bộ chặng cuối cho nội dung hướng model. Registry chụp callback này lúc bắt
   * đầu thi hành và gọi nó đúng một lần cho mọi kết quả đã chuẩn hoá, kể cả lỗi pipeline bỏ qua
   * `tools/post-execute`, ngay trước khi materialize không mất mát. Trả `undefined` để giữ nguyên
   * nội dung; mọi trường khác của kết quả vẫn thuộc registry. Callback phải toàn phần và không ném.
   * Nhận: exec — định danh thi hành bất biến kèm tham số; result — kết quả đã chuẩn hoá đầy đủ trước materialize.
   * Trả: nội dung thay thế, hoặc `undefined` để giữ nguyên.
   */
  finalizeContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
  /**
   * Ngân sách thời gian hợp tác cho một lời gọi tool, tính bằng mili giây. Bỏ trống nghĩa là không
   * có hạn. Do gói dsh-tool-call-timeout-policy cưỡng chế (một wrapper `tools/execute`); trường
   * này KHÔNG BAO GIỜ gửi cho model — `schemas()` chỉ cho qua name/description/parameters.
   * Khai nó là cam kết tool chuyển tiếp `exec.signal` cho một hiện thực hợp tác có thể lắng khi signal huỷ.
   */
  timeoutMs?: number;
  /**
   * Bộ phân loại đồng bộ thuần cho việc chồng lấn với các lời gọi tool anh em. Chỉ `true` mới
   * chọn tham gia; bỏ trống, ném lỗi, trả giá trị khác `true`, hoặc tham số `defineTool` không hợp lệ
   * đều là độc quyền. Siêu dữ liệu này không bao giờ hiện với model.
   *
   * Lần thi hành đã chọn tham gia không được biến đổi trạng thái do cấp cha sở hữu. Trạng thái chia
   * sẻ phải chịu được phát đồng thời; tranh chấp ghi chỉ được phép khi chúng giao hoán hoặc đóng an toàn.
   * Nhận: args — tham số đã phân tích; `defineTool` validate trước khi gọi.
   * Trả: lời gọi này có được ghép vào một nhóm song song hay không.
   */
  isConcurrencySafe?(args: unknown): boolean;
  /**
   * Tuỳ chọn: cách trình bày trạng thái CHỜ của một lời gọi trong UI, suy từ `args` của lời gọi
   * (tham số đã phân tích, `unknown` — tool tự validate/thu hẹp đầu vào của nó). Trả một
   * {@link ToolCallView} (ý định render gắn thẻ `card`), hoặc `undefined` (hoặc bỏ phương thức) để
   * rơi về cách trình bày chung (tiêu đề = tên tool, tham số thô làm đầu vào). Thuần và không tác
   * dụng phụ: UI có thể gọi nó lúc streaming SỐNG và cả lúc phát lại session log, nên nó chỉ được
   * phụ thuộc `args`.
   * Nhận: args — tham số thô của lời gọi đang chờ.
   * Trả: ý định render thẻ, hoặc undefined để dùng cách trình bày chung.
   */
  presentCall?(args: unknown): ToolCallView | undefined;
  /**
   * Tuỳ chọn: cách trình bày trạng thái ĐÃ XONG, với cùng `args` và phép chiếu kết quả bền
   * (`content`, trạng thái lỗi, và `meta` tuỳ chọn). Trả một {@link ToolResultView}, hoặc
   * `undefined` (hoặc bỏ phương thức) để giữ tiêu đề đang chờ và render nội dung kết quả thô.
   * Thuần và không tác dụng phụ vì cùng lý do phát lại.
   * Nhận: args — tham số thô của lời gọi; result — kết quả đã xong mà tool nhận.
   * Trả: ý định render thẻ kết quả, hoặc undefined để giữ cách trình bày chung.
   */
  presentResult?(args: unknown, result: ToolResult): ToolResultView | undefined;
}

/**
 * Kết quả đã xong được trao cho {@link ToolDefinition.presentResult}.
 * Nhận: nội dung hướng model cuối cùng, cờ lỗi, và meta trình bày riêng của tool.
 * Trả: (kiểu) lát cắt kết quả mà presenter đọc.
 */
export interface ToolResult {
  /** Nội dung hướng model cuối cùng (hoặc chữ lỗi đã render khi thất bại). */
  content: ContentBlock[];
  /** Lời gọi có thất bại hay không. */
  isError: boolean;
  /**
   * Dữ liệu trình bày riêng của tool do khai báo output của nó chiếu ra. Nó được ghi bền trên
   * `tool/result` hoặc `tool/ptc-dispatch` để presenter Host và renderer Client tự thu hẹp. Vắng
   * mặt khi tool không khai projector nào.
   */
  meta?: JsonValue;
}

declare const toolExecutionTokenBrand: unique symbol;

/**
 * Định danh lời gọi đục lỗ, cho phép tương quan mà không lộ trạng thái thi hành khả biến.
 * Nhận: không (kiểu thương hiệu trên `symbol`).
 * Trả: (kiểu) token chỉ registry phát ra được.
 */
export type ToolExecutionToken = symbol & {
  readonly [toolExecutionTokenBrand]: true;
};

/**
 * Mô tả do người gọi cấp cho MỘT lời gọi tool. {@link ToolRuntime.execute} thêm token do registry
 * sở hữu để tạo thành một {@link ToolExecution} của pipeline; người gọi không chọn token đó.
 * Nhận: định danh lời gọi, định danh gốc tuỳ chọn, tên tool, schema lồng tuỳ chọn, tham số, agent,
 * token cha tuỳ chọn và tín hiệu huỷ bắt buộc.
 * Trả: (kiểu) đầu vào mà `execute` và `createExecution` nhận.
 */
export interface ToolExecutionInput {
  readonly callId: ToolCallId;
  /**
   * Lời gọi gốc do model yêu cầu, sở hữu cả cây thi hành này. Người gọi bỏ trống cho một lần thi
   * hành gốc; bộ phát lồng chuyển tiếp giá trị bao ngoài.
   */
  readonly rootCallId?: ToolCallId;
  readonly name: string;
  /** Schema tool lúc gắn kết cho một lời gọi PTC bên trong; do bên sản xuất đóng băng và không bao giờ ghi log. */
  readonly schema?: ToolSchema;
  /** Tham số đã phân tích, tuần tự hoá JSON không mất mát (tool tự validate schema của nó). */
  readonly arguments: unknown;
  /** Agent mà lời gọi chạy thay mặt (do vòng lặp agent đặt). */
  readonly agent?: Agent;
  /**
   * Token đục lỗ của lần thi hành transport bao ngoài, khi có. Chế độ PTC đặt trường này trên các
   * lần phát con của SDK để observer kiểu commit chờ được kết quả `run_code` ngoài mà không nhận
   * lần thi hành sống khả biến của nó. Token này cũng đánh dấu lời gọi là lần phát con của
   * transport chứ không phải lời gọi trực tiếp của model: dưới `mode: 'ptc'`, chỉ lời gọi CÓ cha
   * mới được thi hành một tên tool native — lời gọi trực tiếp (không cha) bị từ chối như
   * `UNKNOWN_TOOL` trước cả pipeline chính sách. Xem {@link ToolRuntime.execute}.
   */
  readonly parent?: ToolExecutionToken;
  /** Tín hiệu huỷ bắt buộc do người gọi sở hữu cho lần gọi này. */
  readonly signal: AbortSignal;
}

/**
 * Chế độ lập lịch cho một lời gọi đang chờ. `parallel` có thể chồng lấn với anh em;
 * `exclusive` chạy một mình và tạo hàng rào thứ tự.
 * Nhận: không (kiểu hợp của hai chế độ).
 * Trả: (kiểu) chế độ mà `executionMode` trả về.
 */
export type ToolExecutionMode =
  | { kind: "parallel" }
  | { kind: "exclusive" };

/**
 * Một lần phát con `run_code` đã lắng, sắp được ghi log, như waterfall
 * `tools/ptc-dispatch-log` nhìn thấy: lần thi hành cha (chủ session, định danh lời gọi ngoài),
 * định danh lời gọi con, và kết quả mà người nghe có thể định hình lại bản sao bền. `content` là
 * phép chiếu kết quả ĐÃ RENDER (đúng thứ một `tool/result` native sẽ mang) — chương trình nhận
 * giá trị có cấu trúc (hoặc chỉ chữ lỗi khi thất bại); chỉ bản sao của sự kiện
 * `tool/ptc-dispatch` thay đổi.
 * Nhận: lần thi hành ngoài, agent tuỳ chọn, định danh lời gọi con, tên, cờ lỗi và nội dung.
 * Trả: (kiểu) payload được waterfall đó nhận.
 */
export interface PtcDispatchLog {
  /** Lần thi hành `run_code` ngoài. */
  readonly exec: ToolExecution;
  /** Agent đang gọi (khoá định tuyến scope và chủ spill), khi lời gọi ngoài có agent. */
  readonly agent?: Agent;
  /** Định danh lời gọi con đục lỗ; lời gọi mới dùng `<parent>:ptc:<n>`. */
  readonly subCallId: ToolCallId;
  /** Tên tool con đã phát. */
  readonly name: string;
  /** Lời gọi con có lắng dưới dạng lỗi hay không. */
  readonly isError: boolean;
  /** Nội dung hướng model đầy đủ của lời gọi con (payload mặc định của sự kiện lắng). */
  readonly content: ContentBlock[];
}

/**
 * Một lời gọi tool đang chờ trong pipeline của registry. Tham số đã phân tích đi qua đúng một biên
 * materialize JSON không mất mát trước chính sách và được đóng băng sâu; định danh lời gọi, tín
 * hiệu người gọi, và {@link ToolExecutionToken} do registry cấp đều chỉ đọc. Registry đóng băng
 * toàn bộ đối tượng trước khi observer `tools/result` chạy.
 * Nhận: mọi trường của {@link ToolExecutionInput} cộng định danh gốc đã giải và token registry cấp.
 * Trả: (kiểu) đối tượng lời gọi mà các chặng pipeline thấy.
 */
export interface ToolExecution extends ToolExecutionInput {
  /** Lời gọi gốc do model yêu cầu, đã giải cho mọi lần thi hành gốc lẫn lồng. */
  readonly rootCallId: ToolCallId;
  /** Định danh do registry cấp, chỉ chia sẻ với lời gọi lồng dưới dạng token `parent` đục lỗ. */
  readonly token: ToolExecutionToken;
}

/**
 * Góc nhìn around-dispatch của một {@link ToolExecution}. Wrapper `tools/execute` có thể thay
 * tín hiệu cho vòng đời nó uỷ thác, nhưng không thể bỏ tín hiệu. Registry gộp mọi thay thế với
 * tín hiệu người gọi đã chụp.
 * Nhận: {@link ToolExecution} trừ `signal`.
 * Trả: (kiểu) đối tượng mà waterfall `tools/execute` và thân tool nhận.
 */
export interface ToolDispatchExecution extends Omit<ToolExecution, "signal"> {
  /** Tín hiệu huỷ mà wrapper kế hoặc thân tool nhìn thấy. */
  signal: AbortSignal;
}

/**
 * Ngữ cảnh thi hành trao cho hiện thực tool sau khi registry chấp nhận một {@link ToolExecution}.
 * {@link ToolRunContext.deferContext} gắn ngữ cảnh vào chính kết quả của lần thi hành này — một
 * tool tổng hợp chở ngữ cảnh của lần phát lồng về kết quả ngoài, còn tool lá có thể tạo một chỉ
 * dẫn mới có nguồn từ plugin; vòng lặp chỉ nối nó vào SAU `tool/result`.
 * Nhận: {@link ToolExecution} cộng hai phương thức hoãn ngữ cảnh và đánh dấu kết thúc lượt.
 * Trả: (kiểu) ngữ cảnh mà `execute(args, exec)` nhận.
 */
export interface ToolRunContext extends ToolExecution {
  /**
   * Hoãn MỘT ngữ cảnh — thường là ngữ cảnh của lần phát lồng do tool tổng hợp chở, hoặc một chỉ dẫn
   * mới có nguồn từ plugin — cho tới khi kết quả cuối của tool này tới vòng lặp agent. Ngữ cảnh giữ
   * nguồn và siêu dữ liệu riêng và được phát theo thứ tự lời gọi.
   * Nhận: context — tin nhắn người dùng cần hoãn.
   * Trả: không.
   */
  deferContext(context: UserMessage): void;
  /**
   * Đánh dấu một kết quả cuối thành công là kết thúc lượt hiện tại của agent. Dấu này đi kèm chính
   * kết quả của lần thi hành (`concludesTurn` chỉ có trên {@link ToolExecutionSuccess}); một tool
   * tổng hợp phát lời gọi lồng sẽ chuyển tiếp nó từ kết quả lồng, đúng như `additionalContexts`,
   * nên chỉ một thành công lồng có thẩm quyền mới kết thúc được lượt bao ngoài.
   * Nhận: không.
   * Trả: không.
   */
  concludeTurn(): void;
}

/**
 * Kết quả chỉ dành cho bộ lập lịch sau pre-execute có thứ tự và các guard. `post-result` vẫn phải
 * qua post-execute; `final-result` bỏ qua nó.
 * Nhận: một trong ba trạng thái (dispatch / post-result / final-result) kèm lần thi hành.
 * Trả: (kiểu) đầu ra của chặng chuẩn bị.
 * @internal
 */
export type ScheduledToolPreparation =
  | { kind: "dispatch"; exec: ToolRunContext }
  | { kind: "post-result"; exec: ToolRunContext; result: ToolExecutionResult }
  | { kind: "final-result"; exec: ToolRunContext; result: ToolExecutionResult };

/**
 * Kết quả phát chỉ dành cho bộ lập lịch. `post-result` vẫn phải qua post-execute; `final-result`
 * đã khớp ngữ nghĩa thất bại của {@link ToolRuntime.execute}.
 * Nhận: một trong hai trạng thái kèm kết quả.
 * Trả: (kiểu) đầu ra của chặng phát.
 * @internal
 */
export type ScheduledToolDispatch =
  | { kind: "post-result"; result: ToolExecutionResult }
  | { kind: "final-result"; result: ToolExecutionResult };

/**
 * Góc nhìn bộ lập lịch gắn khoá symbol, giữ chính sách trước/sau có thứ tự trong khi các lần phát
 * chồng lấn. Người gọi thường dùng {@link ToolRuntime.execute}; đây không phải điểm mở rộng plugin.
 * Nhận: bốn chặng thi hành mà vòng lặp agent gọi theo thứ tự.
 * Trả: (kiểu) giao diện bộ lập lịch mà `ctx.tools[TOOL_RUNTIME_SCHEDULER]` lộ ra.
 * @internal
 */
export interface ToolRuntimeScheduler {
  /** Materialize đầu vào, chạy cổng pre-execute/guard có thứ tự, và quyết định chặng kế. */
  prepare(exec: ToolExecutionInput): Promise<ScheduledToolPreparation>;
  /** Chỉ chạy chặng around-dispatch/thân tool. */
  dispatch(exec: ToolRunContext): Promise<ScheduledToolDispatch>;
  /** Chạy post-execute và phần hoàn thiện nội dung do tool sở hữu, rồi materialize và thông báo. */
  finalize(exec: ToolRunContext, result: ToolExecutionResult): Promise<ToolExecutionResult>;
  /** Chạy phần hoàn thiện nội dung do tool sở hữu, rồi materialize và thông báo mà không qua post-execute. */
  finish(exec: ToolRunContext, result: ToolExecutionResult): ToolExecutionResult;
}

/**
 * Điểm vào bộ lập lịch, bị bỏ khỏi API dịch vụ có tên được sinh ra.
 * Nhận: không.
 * Trả: biểu tượng duy nhất dùng làm khoá thuộc tính bộ lập lịch trên service `tools`.
 * @internal
 */
export const TOOL_RUNTIME_SCHEDULER = Symbol("@deepseek-ai/dsh-tools.scheduler");

/**
 * Mã lỗi chuẩn tắc cho việc huỷ SAU khi thân tool đã được gọi.
 * Nhận: không.
 * Trả: chuỗi `ABORTED` dùng trong `error.info.code`.
 */
export const TOOL_ABORTED = "ABORTED";

/**
 * Mã lỗi chuẩn tắc cho việc huỷ TRƯỚC khi thân tool được gọi.
 * Nhận: không.
 * Trả: chuỗi `ABORTED_BEFORE_DISPATCH` dùng trong `error.info.code`.
 */
export const TOOL_ABORTED_BEFORE_DISPATCH = "ABORTED_BEFORE_DISPATCH";

/**
 * Siêu dữ liệu lỗi có cấu trúc cho một lời gọi tool thất bại (song song với chữ hướng model).
 * Nhận: tên lớp lỗi, mã máy, và lý do thô tuỳ chọn.
 * Trả: (kiểu) `error.info` của một kết quả thất bại.
 */
export interface ToolErrorInfo {
  name: string;
  code: string;
  /** Chi tiết thô tuỳ chọn hướng người dùng; phép chiếu bền giữ nó nhưng nội dung hướng model thì không. */
  reason?: string;
}

/**
 * Chi tiết thất bại chuẩn tắc; thông tin định tuyến nội bộ vẫn tuỳ chọn.
 * Nhận: message bắt buộc và info nội bộ tuỳ chọn.
 * Trả: (kiểu) `error` của một kết quả thất bại.
 */
export interface ToolFailure {
  /** Thông báo người đọc hiểu, không kèm vỏ `Error: ` của Native. */
  message: string;
  /** Lớp/mã lỗi nội bộ dùng cho chính sách và chẩn đoán bền. */
  info?: ToolErrorInfo;
}

/**
 * Ném (nội bộ) khi model yêu cầu một tool chưa đăng ký. Mở rộng {@link HarnessError}
 * (`code: 'UNKNOWN_TOOL'`) để thất bại "không có tool" cũng định tuyến được như thất bại do thân
 * tool ném — mã retry/sandbox/replay phân biệt được nó với lỗi riêng của thân tool.
 * Nhận: toolName — tên người gọi hỏi; reachableFrom — cách model chạm tool này thay thế, khi tên
 * CÓ hiển thị và chỉ phần trình bày cấm gọi trực tiếp (bỏ trống khi tên không đăng ký ở đâu cả).
 * Trả: thực thể lỗi với `name` = "ToolNotFoundError" và `code` = "UNKNOWN_TOOL".
 */
export class ToolNotFoundError extends HarnessError {
  /**
   * Dựng lỗi "không có tool" với thông báo đúng như bản gốc.
   * Nhận: toolName — tên người gọi hỏi; reachableFrom — tuyến thay thế tuỳ chọn.
   * Trả: thực thể lỗi mã UNKNOWN_TOOL.
   */
  constructor(toolName: string, reachableFrom?: string) {
    super(
      reachableFrom === undefined
        ? `unknown tool "${toolName}"`
        : `unknown tool "${toolName}": ${reachableFrom}`,
      "UNKNOWN_TOOL",
    );
    this.name = "ToolNotFoundError";
  }
}

/**
 * Ném khi thân tool hoặc giá trị sau chính sách vi phạm khai báo đầu ra của nó.
 * Nhận: toolName — tên tool vi phạm; violations — danh sách vi phạm theo thứ tự validate.
 * Trả: thực thể lỗi với `name` = "ToolOutputError", `code` = "INVALID_TOOL_OUTPUT" và `violations`.
 */
export class ToolOutputError extends HarnessError {
  /** Vi phạm schema/giá trị theo thứ tự validate. */
  readonly violations: string[];

  /**
   * Dựng lỗi "đầu ra không hợp lệ" với danh sách vi phạm đã cho.
   * Nhận: toolName — tên tool vi phạm; violations — các vi phạm theo thứ tự validate.
   * Trả: thực thể lỗi mã INVALID_TOOL_OUTPUT.
   */
  constructor(toolName: string, violations: string[]) {
    super(`tool "${toolName}" returned invalid output: ${violations.join("; ")}`, "INVALID_TOOL_OUTPUT");
    this.name = "ToolOutputError";
    this.violations = violations;
  }
}

/**
 * Kết quả thi hành tool chuẩn tắc thành công, kèm phép chiếu Native/model của nó.
 * Nhận: giá trị chuẩn tắc cục bộ, nội dung hướng model, meta và ngữ cảnh kèm theo tuỳ chọn.
 * Trả: (kiểu) nhánh thành công của {@link ToolExecutionResult}.
 */
export interface ToolExecutionSuccess {
  readonly isError: false;
  /** Giá trị chuẩn tắc cục bộ của lần thi hành; cố ý bỏ khỏi sự kiện bền. */
  readonly value: JsonValue;
  readonly content: ContentBlock[];
  readonly error?: never;
  readonly meta?: JsonValue;
  readonly additionalContexts?: UserMessage[];
  /** Vòng lặp agent dừng sau khi ghi lô kết quả thành công này. */
  readonly concludesTurn?: true;
}

/**
 * Kết quả thi hành tool chuẩn tắc thất bại; thất bại không bao giờ mang giá trị thành công.
 * Nhận: lỗi có cấu trúc, nội dung hướng model, meta và ngữ cảnh kèm theo tuỳ chọn.
 * Trả: (kiểu) nhánh thất bại của {@link ToolExecutionResult}.
 */
export interface ToolExecutionFailure {
  readonly isError: true;
  readonly error: ToolFailure;
  readonly value?: never;
  readonly content: ContentBlock[];
  readonly meta?: JsonValue;
  readonly additionalContexts?: UserMessage[];
  readonly concludesTurn?: never;
}

/**
 * Kết quả phân biệt được, cục bộ lần thi hành, của MỘT lời gọi tool.
 * Nhận: không (kiểu hợp của hai nhánh).
 * Trả: (kiểu) kết quả mà `execute` trả về và observer `tools/result` nhận.
 */
export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;

/**
 * Quyết định trước khi phát. `allow` chạy lời gọi; `deny` materialize lý do hướng model và định
 * danh lỗi có cấu trúc tuỳ chọn; `cancel` chọn kết quả huỷ chuẩn tắc mà không trình bày một lý do
 * chính sách; `ask` chỉ chạy sau khi dịch vụ approval trả `allowed-once` và nếu không thì từ chối;
 * `reason` của nó là lý do approval được kiểm toán và `displayReason` tuỳ chọn là chữ nhắc đã bản
 * địa hoá. Việc viết lại đầu vào bị loại vì tham số đã được ghi log và trình bày.
 * Nhận: không (kiểu hợp bốn quyết định).
 * Trả: (kiểu) giá trị mà waterfall `tools/pre-execute` trả về.
 */
export type PreToolDecision =
  | { kind: "allow" }
  | { kind: "deny"; reason: string; info?: ToolErrorInfo }
  | { kind: "cancel" }
  | {
      kind: "ask";
      reason?: string;
      displayReason?: {
        readonly en: string;
        readonly [locale: string]: string;
      };
    };

/**
 * Quyết định sau khi phát: chấp nhận, thay một phép chiếu, gắn ngữ cảnh cho yêu cầu kế, hoặc chặn
 * bằng cách biến phản hồi sửa sai thành kết quả lỗi.
 * Nhận: không (kiểu hợp ba quyết định).
 * Trả: (kiểu) giá trị mà waterfall `tools/post-execute` trả về.
 */
export type PostToolDecision =
  | {
      kind: "accept";
      content?: ContentBlock[];
      value?: never;
      additionalContexts?: UserMessage[];
    }
  | {
      kind: "accept";
      value: JsonValue;
      content?: never;
      additionalContexts?: UserMessage[];
    }
  | {
      kind: "block";
      feedback: ContentBlock[];
      additionalContexts?: UserMessage[];
    };

/**
 * Cách registry trình bày tool của nó cho model (xem {@link Config.mode}).
 * Nhận: không.
 * Trả: (kiểu) `native` hoặc `ptc`.
 */
export type ToolPresentationMode = "native" | "ptc";

/**
 * Cấu hình plugin: cách các tool đã đăng ký được trình bày cho model.
 * Nhận: chế độ trình bày và chặn trên số lời gọi con song song, đều tuỳ chọn.
 * Trả: (kiểu) cấu hình mà `static Config` validate và constructor nhận.
 */
export interface Config {
  /**
   * Chế độ trình bày. `native` (mặc định) gửi mọi schema hiển thị; `ptc` chỉ gửi `run_code` cộng
   * một prompt SDK được sinh và thu gọn executor về đúng bề mặt đó (một lời gọi trực tiếp của model
   * chỉ được nêu `run_code`; các lần phát con của SDK `run_code` giữ mọi tool hiển thị). Chế độ PTC
   * cần một `ctx.ptcRuntime` có `language` đã đăng ký renderer SDK (TypeScript hoặc Python) và làm
   * việc lắp prompt thất bại khi thiếu hoặc không có renderer. Dưới `ptc`, tên native trong
   * `toolOrder` là không hợp lệ.
   */
  mode?: ToolPresentationMode;
  /**
   * Chặn trên đồng thời cho các lời gọi con chồng lấn của một chương trình `run_code`
   * (mặc định 10, cũng là mặc định của bộ lập lịch vòng lặp). Lời gọi con theo đúng hợp đồng lập
   * lịch native — chỉ lời gọi mà tool phân loại an toàn đồng thời mới chồng lấn; lời gọi độc quyền
   * tạo hàng rào — nên `1` phục hồi phát tuần tự nghiêm ngặt. Phải là số nguyên dương.
   */
  maxParallelSubCalls?: number;
}

/**
 * Bộ lọc theo scope trên các tool TOÀN CỤC. Các bộ lọc giao nhau và không ảnh hưởng đăng ký theo
 * scope hay transport PTC dành riêng.
 * Nhận: danh sách tên giữ lại (`allow`) và/hoặc danh sách tên bỏ đi (`deny`).
 * Trả: (kiểu) bộ lọc mà {@link ToolRuntime.restrict} nhận.
 */
export interface ToolRestriction {
  /** Tên tool toàn cục còn hiển thị; mọi tên khác bị bỏ. */
  readonly allow?: readonly string[];
  /** Tên tool toàn cục bị bỏ khỏi tầm nhìn. */
  readonly deny?: readonly string[];
}

/**
 * Guard thi hành đơn điệu, được đánh giá sau MỌI người nghe `tools/pre-execute` và trước thân tool.
 * Trả một lý do là từ chối lời gọi; trả `undefined` là giữ nguyên. Vì guard không có kết quả
 * "cho phép", thứ tự người nghe không thể biến một lần từ chối trở lại thành quyền.
 * Nhận: execution — lời gọi được bảo vệ định danh sau khi chính sách pre-execute mở rộng xong.
 * Trả: lý do từ chối cuối cùng, hoặc `undefined` để giữ lời gọi được phép.
 */
export type ToolGuard = (execution: Readonly<ToolExecution>) => string | undefined;

/**
 * Phép biến đổi nội dung chặng cuối do tool sở hữu, đã chụp lúc bắt đầu lời gọi.
 * Nhận: exec — định danh thi hành bất biến; result — kết quả đã chuẩn hoá trước materialize.
 * Trả: nội dung thay thế, hoặc undefined để giữ nguyên.
 */
export type ToolContentFinalizer = NonNullable<ToolDefinition["finalizeContent"]>;

/**
 * Phép cài nội dung đã chuẩn bị lúc thi hành, do tool sở hữu.
 * Nhận: exec — định danh thi hành bất biến; result — kết quả đã chuẩn hoá trước post-execute.
 * Trả: nội dung thay thế, hoặc undefined để giữ đầu ra của renderer.
 */
export type ToolContentProjector = NonNullable<ToolDefinition["projectContent"]>;

/**
 * Trạng thái huỷ của MỘT lần thi hành, giữ NGOÀI đối tượng exec mà wrapper có thể biến đổi.
 * Nhận: tín hiệu gốc của người gọi và cờ thân tool đã được gọi hay chưa.
 * Trả: (kiểu) giá trị trong `cancellationStates`.
 */
export interface ToolCancellationState {
  /** Tín hiệu huỷ gốc do người gọi cấp. */
  readonly callerSignal: AbortSignal;
  /** `true` sau khi thân tool đã được gọi. */
  bodyInvoked: boolean;
}

/**
 * Tín hiệu huỷ đã gộp từ người gọi và wrapper, kèm hàm dọn listener.
 * Nhận: không (do hàm gộp tín hiệu dựng).
 * Trả: (kiểu) `{ signal, dispose }`.
 */
export interface FusedToolSignals {
  /** Tín hiệu gộp nhìn thấy bởi thân tool. */
  readonly signal: AbortSignal;
  /** Gỡ listener mà phép gộp đã gắn. */
  dispose(): void;
}

/**
 * Bộ lọc đã biên dịch của MỘT lớp scope (đã đổi sang `Set`).
 * Nhận: hai tập tên giữ lại/bỏ đi, đều tuỳ chọn.
 * Trả: (kiểu) giá trị trong bảng restrictions của lớp scope.
 */
export interface ToolLayerFilter {
  /** Tên còn hiển thị; vắng mặt nghĩa là không lọc theo danh sách cho phép. */
  readonly allow?: ReadonlySet<string>;
  /** Tên bị bỏ; vắng mặt nghĩa là không lọc theo danh sách cấm. */
  readonly deny?: ReadonlySet<string>;
}
/**
 * Bề mặt CẤU TRÚC của dịch vụ thư mục làm việc mà `run_code` cần khi lời gọi có Agent.
 * Khai theo hình dạng thay vì augment module (ADR 000d).
 * Nhận: agent sở hữu và signal tuỳ chọn.
 * Trả: (kiểu) `{ ensure }` — đường dẫn thư mục làm việc đã bảo đảm.
 */
export interface WorkingDirectorySeam {
  /**
   * Bảo đảm thư mục làm việc của một agent.
   * Nhận: agent — chủ session; signal — tín hiệu huỷ tuỳ chọn.
   * Trả: promise của đường dẫn tuyệt đối.
   */
  ensure(agent: Agent, signal?: AbortSignal): Promise<string>;
}

/**
 * Bề mặt CẤU TRÚC của dịch vụ chính sách sandbox mà transport PTC cần.
 * Khai theo hình dạng thay vì augment module (ADR 000d).
 * Nhận: yêu cầu tuỳ chọn gồm session và chế độ đã duyệt.
 * Trả: (kiểu) `{ resolve }` — chính sách thi hành sandbox.
 */
export interface SandboxPolicySeam {
  /**
   * Giải chính sách sandbox cho MỘT lời gọi.
   * Nhận: request — session tuỳ chọn (và chế độ đã duyệt, nếu có).
   * Trả: chính sách thi hành sandbox đã giải đầy đủ.
   */
  resolve(request?: { session?: Session }): SandboxExecutionPolicy;
}

/**
 * Chuyển MỘT ngoại lệ của projector thành thất bại "đầu ra không hợp lệ" chuẩn tắc.
 * Nhận: toolName — tên tool; projector — tên phép chiếu ("render" hoặc "presentationMeta"); error — giá trị đã ném.
 * Trả: {@link ToolOutputError} mang đúng một vi phạm `output.<projector> failed: <message>`.
 */
export function projectionError(toolName: string, projector: string, error: unknown): ToolOutputError {
  return new ToolOutputError(toolName, [`output.${projector} failed: ${errorMessage(error)}`]);
}

/**
 * Chụp MỘT kết quả projector trước khi materialize kết quả bền về sau.
 * Nhận: toolName — tên tool; projector — tên phép chiếu; candidate — giá trị projector trả về.
 * Trả: bản sao JSON tách rời, cùng kiểu với đầu vào.
 * @throws {ToolOutputError} khi giá trị không tuần tự hoá JSON không mất mát.
 */
export function snapshotProjection<T>(toolName: string, projector: string, candidate: T): T {
  try {
    const detached = snapshotJsonValue(candidate);
    if (detached === undefined) {
      throw new ToolOutputError(toolName, [`output.${projector} returned non-lossless JSON`]);
    }
    return detached;
  } catch (error) {
    if (error instanceof ToolOutputError) throw error;
    throw projectionError(toolName, projector, error);
  }
}

/**
 * Chụp MỘT giá trị của thân tool hoặc của chính sách vào lớp thất bại "đầu ra không hợp lệ" chuẩn tắc.
 * Nhận: toolName — tên tool; candidate — giá trị cần chụp.
 * Trả: bản sao JSON tách rời của giá trị.
 * @throws {ToolOutputError} khi giá trị không phải JSON không mất mát, hoặc việc chụp ném lỗi.
 */
export function snapshotToolValue(toolName: string, candidate: unknown): JsonValue {
  try {
    const detached = snapshotJsonValue(candidate) as JsonValue | undefined;
    if (detached === undefined) throw new ToolOutputError(toolName, ["value is not lossless JSON"]);
    return detached;
  } catch (error) {
    if (error instanceof ToolOutputError) throw error;
    throw new ToolOutputError(toolName, [`value snapshot failed: ${errorMessage(error)}`]);
  }
}

/**
 * Thông báo người đọc hiểu, cố gắng hết sức, từ một giá trị bị ném bất kỳ: thực thể Error dùng
 * `.message`; đối tượng không phải Error có thuộc tính `message` kiểu chuỗi (ví dụ
 * `throw { message: 'denied' }`) cũng dùng nó; mọi thứ còn lại được chuyển thành chuỗi.
 * Nhận: error — giá trị bị ném.
 * Trả: chuỗi mô tả; `<unprintable thrown value>` khi chính việc đọc cũng ném.
 */
export function errorMessage(error: unknown): string {
  try {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    return String(error);
  } catch {
    // Một giá trị bị ném thù địch có thể bẫy `instanceof`, truy cập thuộc tính, hoặc ép chuỗi.
    // Chuẩn hoá lỗi là biên an toàn ngoài cùng, nên đường dự phòng của nó cũng phải toàn phần.
    return "<unprintable thrown value>";
  }
}

/**
 * Rút MỘT thông báo thất bại từ phản hồi của chính sách mà không đổi các khối đã render của nó.
 * Nhận: content — các khối phản hồi của quyết định chặn.
 * Trả: chữ đã nối; `tool result blocked by post-execute policy` khi rỗng.
 */
export function failureMessageFromContent(content: ContentBlock[]): string {
  const text = content.map((block) => (block.type === "text" ? block.text : `[${block.type} content]`)).join("\n");
  return text.length > 0 ? text : "tool result blocked by post-execute policy";
}

/**
 * Chụp và đóng băng MỘT phép chiếu kết quả tool bền, hoặc từ chối dữ liệu mất mát.
 * Nhận: candidate — giá trị cần materialize.
 * Trả: bản sao đã đóng băng sâu, cùng kiểu với đầu vào.
 * @throws {TypeError} khi giá trị không tuần tự hoá JSON không mất mát.
 */
export function materializePresentation<T>(candidate: T): T {
  const detached = snapshotJsonValue(candidate);
  if (detached === undefined) {
    throw new TypeError("tool result must be losslessly JSON-serializable");
  }
  return deepFreeze(detached);
}

/**
 * Cặp `{ name, code }` có cấu trúc cho một HarnessError bị ném, nếu không thì undefined.
 * Nhận: error — giá trị bị ném.
 * Trả: định danh lỗi rút gọn, hoặc undefined khi không phải HarnessError (hoặc khi việc đọc ném).
 */
export function errorInfo(error: unknown): ToolErrorInfo | undefined {
  try {
    if (!isNamedError(error, "HarnessError")) return undefined;
    const failure = error as HarnessError;
    return { name: failure.name, code: failure.code };
  } catch {
    return undefined;
  }
}

/**
 * Giải chặn trên `run_code` tại biên cấu hình sở hữu (dựng trực tiếp thì bỏ qua schema của Loader).
 * Nhận: value — giá trị cấu hình thô, có thể vắng.
 * Trả: số nguyên dương đã kiểm (mặc định 10).
 * @throws {Error} khi giá trị không phải số nguyên dương.
 */
export function resolveMaxParallelSubCalls(value: number | undefined): number {
  const maxParallelSubCalls = value ?? 10;
  if (!Number.isInteger(maxParallelSubCalls) || maxParallelSubCalls < 1) {
    throw new Error("maxParallelSubCalls must be a positive integer");
  }
  return maxParallelSubCalls;
}

/**
 * Phát MỘT token tương quan trong cùng tiến trình, mà danh tính của nó chính là giá trị.
 * Nhận: không.
 * Trả: token mới mang thương hiệu {@link ToolExecutionToken}.
 */
export function createExecutionToken(): ToolExecutionToken {
  return Symbol("dsh.tool.execution") as ToolExecutionToken;
}

/**
 * Dựng kết quả lỗi chuẩn tắc từ một giá trị bị ném bất kỳ.
 * Nhận: error — giá trị bị ném ở thân tool, listener, hay pipeline.
 * Trả: kết quả thất bại với nội dung `Error: <message>` và `error.info` khi có.
 */
export function toolErrorResult(error: unknown): ToolExecutionFailure {
  const info = errorInfo(error);
  const message = errorMessage(error);
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
    error: { message, ...(info ? { info } : {}) },
  };
}

/**
 * Đọc trạng thái huỷ sống xuyên một `await` mà không coi nó là bất biến đồng bộ.
 * Nhận: signal — tín hiệu cần đọc.
 * Trả: `signal.aborted` tại thời điểm gọi.
 */
export function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/**
 * Gộp việc huỷ của người gọi và của wrapper mà không lồng `AbortSignal.any`. Giữ relay trong phạm
 * vi một lần phát cũng gỡ listener khi công việc lắng.
 * Nhận: caller — tín hiệu gốc của người gọi; wrapper — tín hiệu do wrapper around-dispatch thay vào.
 * Trả: tín hiệu gộp và hàm dọn; khi hai tín hiệu trùng nhau thì trả chính tín hiệu đó.
 */
export function fuseToolSignals(caller: AbortSignal, wrapper: AbortSignal): FusedToolSignals {
  if (caller === wrapper) return { signal: caller, dispose() {} };
  const controller = new AbortController();
  let listening = false;
  const dispose = (): void => {
    if (!listening) return;
    listening = false;
    caller.removeEventListener("abort", abortFromCaller);
    wrapper.removeEventListener("abort", abortFromWrapper);
  };
  const abortFrom = (source: AbortSignal): void => {
    const reason = source.reason as unknown;
    controller.abort(reason);
    dispose();
  };
  const abortFromCaller = (): void => {
    abortFrom(caller);
  };
  const abortFromWrapper = (): void => {
    abortFrom(wrapper);
  };
  if (wrapper.aborted) abortFromWrapper();
  else if (caller.aborted) abortFromCaller();
  else {
    listening = true;
    caller.addEventListener("abort", abortFromCaller, { once: true });
    wrapper.addEventListener("abort", abortFromWrapper, { once: true });
  }
  return { signal: controller.signal, dispose };
}

/**
 * Kết quả chuẩn tắc khi việc huỷ thay thế một thành công SAU khi thân tool đã được gọi.
 * Nhận: prior — kết quả trước đó (nguồn ngữ cảnh kèm theo), có thể vắng.
 * Trả: kết quả thất bại `ABORTED` giữ lại ngữ cảnh kèm theo của `prior`.
 */
export function toolAbortedResult(prior?: ToolExecutionResult): ToolExecutionFailure {
  const additionalContexts = prior?.additionalContexts ?? [];
  return {
    content: [{ type: "text", text: "Error: tool call aborted" }],
    isError: true,
    error: {
      message: "tool call aborted",
      info: { name: "AbortError", code: TOOL_ABORTED },
    },
    ...(additionalContexts.length > 0 ? { additionalContexts } : {}),
  };
}

/**
 * Kết quả chuẩn tắc khi việc huỷ ngăn thân tool được gọi.
 * Nhận: prior — kết quả trước đó (nguồn ngữ cảnh kèm theo), có thể vắng.
 * Trả: kết quả thất bại `ABORTED_BEFORE_DISPATCH` giữ lại ngữ cảnh kèm theo của `prior`.
 */
export function toolAbortedBeforeDispatchResult(prior?: ToolExecutionResult): ToolExecutionFailure {
  const additionalContexts = prior?.additionalContexts ?? [];
  return {
    content: [{ type: "text", text: "Error: tool call aborted before dispatch" }],
    isError: true,
    error: {
      message: "tool call aborted before dispatch",
      info: { name: "AbortError", code: TOOL_ABORTED_BEFORE_DISPATCH },
    },
    ...(additionalContexts.length > 0 ? { additionalContexts } : {}),
  };
}

/**
 * Đóng góp hoàn chỉnh của MỘT scope vào sổ đăng ký tool.
 * Nhận: scope — định danh scope sở hữu lớp này (undefined cho lớp toàn cục).
 * Trả: lớp giữ bảng tool, bộ lọc, guard và chế độ trình bày của scope đó.
 */
export class ToolLayer {
  /** Bảng tên → định nghĩa tool của lớp này, theo thứ tự chèn. */
  readonly tools: NamedEntries<ToolDefinition>;
  /** Các bộ lọc toàn cục do scope này áp, theo thứ tự đăng ký. */
  readonly restrictions = new AnonymousEntries<ToolLayerFilter>();
  /** Các guard đơn điệu do scope này đăng ký, theo thứ tự đăng ký. */
  readonly guards = new AnonymousEntries<ToolGuard>();
  /**
   * Phần trình bày mà agent của scope này tự khai, che mặc định của deployment. Một ô chứ không
   * phải bảng: hai câu trả lời cho "model thấy dạng nào" là mâu thuẫn, không phải phép gộp.
   */
  mode: ToolPresentationMode | undefined;

  /**
   * Dựng lớp của một scope với chẩn đoán trùng tên riêng cho scope đó.
   * Nhận: scope — định danh scope (undefined cho lớp toàn cục).
   * Trả: lớp rỗng với bảng tên chưa có mục nào.
   */
  constructor(scope: ScopeKey | undefined) {
    this.tools = new NamedEntries<ToolDefinition>((name) =>
      new Error(
        scope === undefined
          ? `tool "${name}" is already registered (for a per-agent variant, register through that agent's \`agent.ctx\` instead)`
          : `tool "${name}" is already registered in this scope`,
      ),
    );
  }

  /**
   * Cho biết mọi bảng đóng góp trong lớp tổng hợp này có rỗng hay không.
   * Nhận: không.
   * Trả: `true` khi không có tool, bộ lọc, guard hay chế độ nào.
   */
  isEmpty(): boolean {
    return this.tools.isEmpty() && this.restrictions.isEmpty() && this.guards.isEmpty() && this.mode === undefined;
  }

  /**
   * Cho biết mọi bộ lọc đã biên dịch trong lớp này có chấp nhận một tên tool toàn cục hay không.
   * Nhận: name — tên tool toàn cục cần xét.
   * Trả: `true` khi không bộ lọc nào loại tên đó.
   */
  admits(name: string): boolean {
    for (const filter of this.restrictions.values()) {
      if ((filter.allow !== undefined && !filter.allow.has(name)) || (filter.deny !== undefined && filter.deny.has(name))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Lý do từ chối đơn điệu ĐẦU TIÊN từ các guard đang sống của lớp này.
   * Nhận: exec — lời gọi đã qua chính sách pre-execute.
   * Trả: chuỗi lý do, hoặc undefined khi không guard nào từ chối.
   */
  guardReason(exec: Readonly<ToolExecution>): string | undefined {
    for (const guard of this.guards.values()) {
      const reason = guard(exec);
      if (reason !== undefined) return reason;
    }
    return undefined;
  }
}

/**
 * Một mục prompt mà service tools đăng ký với ctx.systemPrompt.
 * Nhận: tên duy nhất, thứ tự, chữ hoặc provider chữ, cờ nội suy tuỳ chọn.
 * Trả: (kiểu) giá trị mà systemPrompt.section nhận.
 */
export interface ToolsPromptSection {
  /** Tên duy nhất của mục trong phạm vi đăng ký. */
  readonly name: string;
  /** Thứ tự tăng dần khi lắp prompt. */
  readonly order: number;
  /** Chữ tĩnh hoặc provider được gọi cho mỗi lượt lắp. */
  readonly text: string | ((context: ToolsAssembleContext) => string);
  /** `false` để miễn nội suy biến cho mục này. */
  readonly interpolate?: boolean;
}

/**
 * Ngữ cảnh MỘT lượt lắp prompt mà provider schema tool nhận.
 * Nhận: scope đang lắp (hoặc undefined) và signal tuỳ chọn.
 * Trả: (kiểu) tham số của provider.
 */
export interface ToolsAssembleContext {
  /** Scope đang lắp; vắng mặt nghĩa là chỉ provider toàn cục tham gia. */
  readonly scope?: ScopeKey;
  /** Signal điều khiển tường minh của lượt yêu cầu lắp, khi có. */
  readonly signal?: AbortSignal;
}

/**
 * Kết quả MỘT provider schema tool: schema mô hình thấy cộng tên đã biết.
 * Nhận: danh sách schema và danh sách tên đã biết.
 * Trả: (kiểu) giá trị provider trả về.
 */
export interface ToolsWireSchemas {
  /** Schema tool theo thứ tự chèn của sổ đăng ký. */
  readonly schemas: ToolSchema[];
  /** Tên đã biết ở scope này, dùng để validate toolOrder. */
  readonly knownNames: string[];
}

/**
 * Bề mặt CẤU TRÚC của dịch vụ systemPrompt mà service tools đọc (ADR 000d).
 * Nhận: đăng ký provider schema, đăng ký mục prompt, tra thứ tự mục.
 * Trả: (kiểu) `{ tools, section, getSectionOrder }`.
 */
export interface ToolsSystemPrompt {
  /** Đăng ký provider schema tool. Nhận: provider. Trả: bộ huỷ effect. */
  tools(provider: (context: ToolsAssembleContext) => ToolsWireSchemas): () => void;
  /** Đăng ký một mục prompt. Nhận: mục. Trả: bộ huỷ effect. */
  section(section: ToolsPromptSection): () => void;
  /** Tra thứ tự mục prompt. Nhận: tên chỗ đặt. Trả: thứ tự dạng số. */
  getSectionOrder(name: string): number;
}

/**
 * Bề mặt CẤU TRÚC các sự kiện mà service tools phát và tiêu thụ (ADR 000d).
 * Nhận: một lần phát tools/change và bốn waterfall có lọc phạm vi.
 * Trả: (kiểu) `{ emit, waterfall }`.
 */
export interface ToolsEventSurface {
  /** Bề mặt systemPrompt của host — nơi service tools đăng ký provider schema và các mục prompt. Nhận: không (thuộc tính). Trả: seam `{ tools, section, getSectionOrder }`. */
  readonly systemPrompt: ToolsSystemPrompt;
  /** Phát tools/change (không lọc phạm vi). Nhận: tên sự kiện. Trả: không. */
  emit(event: "tools/change"): void;
  /** Waterfall cổng trước khi phát. Nhận: mang phạm vi, lời gọi, next. Trả: quyết định pre-execute. */
  waterfall(receiver: Scoped<ToolRuntime>, event: "tools/pre-execute", exec: ToolExecution, next: () => Promise<PreToolDecision>): Promise<PreToolDecision>;
  /** Waterfall around-dispatch. Nhận: mang phạm vi, lời gọi, next. Trả: kết quả đã chuẩn hoá. */
  waterfall(receiver: Scoped<ToolRuntime>, event: "tools/execute", exec: ToolDispatchExecution, next: () => Promise<ToolExecutionResult>): Promise<ToolExecutionResult>;
  /** Waterfall sau khi phát. Nhận: mang phạm vi, lời gọi, kết quả, next. Trả: quyết định post-execute. */
  waterfall(receiver: Scoped<ToolRuntime>, event: "tools/post-execute", exec: ToolExecution, result: Readonly<ToolExecutionResult>, next: () => Promise<PostToolDecision>): Promise<PostToolDecision>;
  /** Waterfall định hình bản sao log. Nhận: mang phạm vi, lần phát, next. Trả: nội dung sẽ ghi. */
  waterfall(receiver: Scoped<ToolRuntime>, event: "tools/ptc-dispatch-log", dispatch: PtcDispatchLog, next: () => Promise<ContentBlock[]>): Promise<ContentBlock[]>;
}
