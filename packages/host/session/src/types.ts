/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Mặt kiểu và brand của log Session — port 1:1 'lib/types/types.d.ts' (557 dòng) cùng phần chạy của
 *      'lib/types/types.js' (55 dòng) thuộc @deepseek-ai/dsh-session: SessionId/SessionSeq/SessionLogOffset,
 *      SESSION_FORMAT_VERSION, SessionHeader, SessionEventMap/SessionEvent, PluginRecord. Khối 'declare module
 *      "@deepseek-ai/dsh-typert-protocol"' của bản gốc KHÔNG port (repo CẤM augment module — ADR 000d): hai
 *      mục của khối đó được khai theo CẤU TRÚC ở cuối tệp.
 */

import { brandNumber, brandString, type Branded, type BrandedNumber } from "@galaxy-blackhole/gbh-brand";
import type {
  AssistantMessage,
  DeveloperMessage,
  AssistantStreamRecord,
  ToolCallId,
  LlmCallConfig,
  LlmCallConfigAdapterDefaults,
  LlmFailure,
  SystemMessage,
  SystemPromptUpdate,
  TokenUsage,
  ToolResultMessage,
  ToolSchema,
  UserMessage,
} from "@galaxy-blackhole/gbh-llm";
import type { JsonValue } from "@galaxy-blackhole/gbh-util-values";

/**
 * Định danh MỘT session trong kho (và các tạo tác lưu trữ của nó).
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
/**
 * Đóng brand một string thành SessionId.
 * @param id - string id session thô.
 * @returns đúng string đó, kèm brand session-id.
 */
export function SessionId(id: string): SessionId {
  return brandString<SessionId>(id);
}

/**
 * Số thứ tự của MỘT sự kiện đã tồn tại trong log Session.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
/** Brand id phiên — kiểu danh nghĩa để không lẫn với string thường. */
export type SessionId = Branded<"SessionId">;

export type SessionSeq = BrandedNumber<"SessionSeq">;

/**
 * Nhận một giá trị số làm vị trí sự kiện Session đã tồn tại.
 * @param value - số nguyên an toàn không âm do thao tác log sở hữu chấp nhận.
 * @returns đúng số đó, kèm brand Session-sequence.
 */
export function SessionSeq(value: number): SessionSeq {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError("SessionSeq must be a non-negative safe integer, got " + String(value));
  }
  return brandNumber<SessionSeq>(value);
}

/**
 * Khoảng trống, độ dài tiền tố hoặc vị trí đọc của log Session — có thể BẰNG số sự kiện.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SessionLogOffset = BrandedNumber<"SessionLogOffset">;

/**
 * Nhận một giá trị số làm offset của log Session.
 * @param value - số nguyên an toàn không âm dùng làm khoảng trống hoặc độ dài tiền tố.
 * @returns đúng số đó, kèm brand Session-log-offset.
 */
export function SessionLogOffset(value: number): SessionLogOffset {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError("SessionLogOffset must be a non-negative safe integer, got " + String(value));
  }
  return brandNumber<SessionLogOffset>(value);
}

/**
 * Mốc nước sự kiện Session bao gồm hai đầu, hoặc -1 trước khi có sự kiện nào.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SessionSeqCursor = SessionSeq | -1;

/**
 * Một vị trí sự kiện Session đã tồn tại, hoặc vắng mặt tường minh.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type OptionalSessionSeq = SessionSeq | null;

/**
 * Phiên bản định dạng Session LOGIC hiện tại, được đóng vào mọi {@link SessionHeader} mới ghi.
 * Session hiện tại và mã lưu trữ CHỈ chấp nhận đúng giá trị này; bộ đọc chỉ-header phân loại các định
 * dạng lịch sử được hỗ trợ, còn một lần đọc thân sự kiện sẽ hợp thành chuỗi chuyển đổi LIỀN KỀ cố định
 * lúc build và chỉ công bố thế hệ cuối này trước khi dựng Session.
 *
 * Phiên bản là MỘT số nguyên đơn điệu, không chia major/minor. Giữ nguyên nó khi bộ đọc cũ resume đúng,
 * bảo toàn an toàn các bản ghi bỏ qua được, hoặc từ chối tính năng bắt buộc TRƯỚC khi chạy, sửa đổi hay
 * vá đuôi. Bộ đọc mới phải bảo toàn nghĩa lịch sử, kể cả log trộn biểu diễn bản ghi cũ và mới. Tăng khi
 * một discriminator sẵn có KHÔNG THỂ ngăn cách hiểu không an toàn; chỉ khác cấu trúc là chưa đủ. Trường
 * và giá trị lạ cần bằng chứng về hành vi chấp nhận thực tế của bộ đọc đã phát hành. Marker
 * {@link SessionEvent.ignorable} theo TỪNG sự kiện quyết định loại sự kiện lạ, không quyết định thay đổi
 * payload lồng nhau tuỳ ý. Bộ đọc CÙNG phiên bản giữ các biểu diễn cũ hơn: chuỗi chuyển đổi liền kề KHÔNG
 * chạy khi phiên bản lưu trữ và hiện tại trùng nhau. Một lần chuyển đổi sau đó phải tính đến MỌI biểu
 * diễn được hỗ trợ của nguồn nó. Rà soát tương thích và các nghĩa vụ chuyển đổi được giữ lại nằm trong
 * .agents/notes/implemented/process/2026-10-08-session-reader-compatibility-review.md.
 */
export const SESSION_FORMAT_VERSION = 4;

/**
 * Metadata lưu trữ ĐÃ KIỂM, bất biến, được giữ NGOÀI log sự kiện hội thoại.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface SessionHeader {
  /**
   * Phiên bản định dạng logic hiện tại, đóng dấu từ {@link SESSION_FORMAT_VERSION}. Header vật lý lịch
   * sử đã được dịch trước khi vào interface này.
   */
  readonly version: typeof SESSION_FORMAT_VERSION;
  /** Id của session (phản chiếu id của {@link Session}). */
  readonly id: SessionId;
  /** Unix epoch mili giây, số nguyên an toàn không âm, lúc session được tạo. */
  readonly createdAt: number;
  /** Thư mục làm việc tuyệt đối nơi session được tạo (nếu có). */
  readonly cwd?: string;
  /** Session mà session này được fork ra (dòng dõi seed), nếu có. */
  readonly parentSession?: SessionId;
  /**
   * Session này có tiền tố sự kiện THỪA KẾ từ fork hay không. Độ dài tiền tố chính xác là trạng thái
   * của Session chứ không phải metadata header thông thường.
   */
  readonly isSeeded: boolean;
  /**
   * Phân loại sản phẩm thô cho một session được tạo làm con của subagent. Đây là metadata TRÌNH BÀY,
   * không phải bằng chứng rằng con đó còn tiếp tục được.
   */
  readonly origin?: "subagent";
  /**
   * Độ sâu uỷ thác: vắng (bằng 0) với session cấp đầu, bằng độ sâu của cha + 1 với con subagent. Được
   * lưu để ngân sách đệ quy sống qua restart và resume — độ sâu chỉ có lúc chạy sẽ đặt một con đã
   * resume trở lại cấp đầu.
   */
  readonly delegationDepth?: number;
  /**
   * Id của agent preset mà agent của session này được hợp thành từ đó, khi deployment hợp thành theo
   * từng session. Bền vững vì preset quyết định tool và prompt của session: một lần resume khôi phục
   * hợp thành KHÁC sẽ phát lại lịch sử mà model không còn hành động được nữa.
   */
  readonly agentPreset?: string;
}

/**
 * Tuỳ chọn tạo một {@link Session} qua kho. seed phát lại/fork một log sự kiện đã có; meta mang các
 * trường lưu trữ do bên gọi cấp mà kho gộp vào {@link SessionHeader}.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface CreateSessionOptions {
  /** Lịch sử replay hoặc fork ban đầu cấp lúc dựng. */
  readonly seed?: readonly SessionEvent[];
  /**
   * Độ dài tiền tố thừa kế từ fork CHÍNH XÁC khi meta.isSeeded là true. Constructor thêm marker có tag
   * thuộc con tại vết cắt, trừ khi seed đã có marker đó theo sau là các closer fork thuộc con.
   */
  readonly inheritedEventCount?: SessionLogOffset;
  /**
   * Metadata lưu trữ đọc MỘT lần trước khi công bố. isSeeded đánh dấu dòng dõi fork; chỉ cấp lịch sử
   * replay không làm nó thành thừa kế.
   */
  readonly meta?: {
    readonly cwd?: string;
    readonly parentSession?: SessionId;
    readonly createdAt?: number;
    readonly isSeeded?: boolean;
    readonly origin?: "subagent";
    readonly delegationDepth?: number;
    readonly agentPreset?: string;
  };
}

/**
 * Trạng thái aliasing của một seed Session có thể nhận nuôi. shared-frozen cho phép các alias đông cứng
 * sâu cùng những giá trị CHƯA đông cứng thuộc sở hữu riêng trong CÙNG một seed.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SessionSeedEventState = "detached" | "shared-frozen";

/**
 * Giá trị lưu trữ có thể nhận nuôi, chuyển cho {@link SessionStore.prepare} mà KHÔNG sao chép hay đông
 * cứng thêm một lần nào.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface RestoredSessionOptions {
  /** Sự kiện thuộc sở hữu riêng hoặc đã đông cứng sâu. */
  readonly seed: SessionEvent[];
  /** Metadata lưu trữ thuộc sở hữu riêng, cần kiểm rồi đông cứng tại chỗ. */
  readonly meta: SessionHeader;
  /** Số sự kiện đầu thừa kế từ fork CHÍNH XÁC đã giải mã từ lưu trữ. */
  readonly inheritedEventCount: SessionLogOffset;
  /** Trạng thái aliasing mang từ thao tác đã sinh ra seed. */
  readonly eventState: SessionSeedEventState;
}

/**
 * Đầu vào được chấp nhận khi dựng một Session CHƯA công bố.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type PrepareSessionOptions =
  | (CreateSessionOptions & {
      readonly eventState?: undefined;
    })
  | RestoredSessionOptions;

/**
 * Vì sao một driver agent đang hoạt động bị huỷ.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type AgentCancelCause =
  | {
      readonly kind: "user";
    }
  | {
      readonly kind: "parent";
    }
  | {
      readonly kind: "hook";
      readonly reason: string;
    }
  | {
      readonly kind: "disposed";
    };

/**
 * Nguyên nhân huỷ bền vững, kể cả các lần import mà bản ghi thô gốc không mang nguyên nhân nào.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type TurnEndCancelCause =
  | AgentCancelCause
  | {
      readonly kind: "legacy";
    };

/**
 * Vì sao một lượt kết thúc. Kiểu tổng hợp mở rộng được bằng merge.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface TurnEndReasonMap {
  completed: {
    kind: "completed";
  };
  /** Một yêu cầu huỷ đã ngắt lượt đang sống. */
  aborted: {
    kind: "aborted";
    reason: TurnEndCancelCause;
  };
  blocked: {
    kind: "blocked";
  };
  /**
   * Lượt đã thất bại. error LUÔN là một failure có cấu trúc: đúng các sự thật LlmError, hoặc
   * { message: errorChain(error), code: 'UNKNOWN' } đã làm phẳng từ mọi lỗi khác.
   */
  error: {
    kind: "error";
    error: LlmFailure;
  };
  /** Ít nhất một bước đã chạm trần token đầu ra, kể cả khi một plugin đã tiếp tục lượt. */
  "max-tokens": {
    kind: "max-tokens";
  };
  /**
   * Một lượt bị bỏ rơi do crash đã được đóng SAU đó: agent-loop resume thêm closer này cho log đã lưu
   * mà lượt cuối chưa bao giờ kết thúc, và session-query tổng hợp nó khi đọc nguội. Vòng lặp KHÔNG bao
   * giờ phát marker này lúc sống, và các sự kiện đã ghi trước crash vẫn nguyên vẹn.
   */
  interrupted: {
    kind: "interrupted";
  };
  /**
   * Việc dựng seed của fork đã đóng một lượt còn MỞ tại ranh giới fork ở session nguồn. CHỈ seed của
   * fork mang marker này — vòng lặp không bao giờ phát nó — và các sự kiện nguồn trước ranh giới vẫn
   * nguyên vẹn trong con.
   */
  forked: {
    kind: "forked";
  };
}

/**
 * Hợp trên {@link TurnEndReasonMap} — vì sao một lượt kết thúc; plugin mở rộng nó bằng cách merge biến
 * thể vào map.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type TurnEndReason = TurnEndReasonMap[keyof TurnEndReasonMap];

/**
 * Trạng thái request đã ghi, NGOÀI lịch sử dẫn xuất: call config và tool. System prompt LÀ lịch sử dẫn
 * xuất — node 0 của surface, một sự kiện system/message. Snapshot request/header ĐẦY ĐỦ mới nhất dựng
 * lại header; các trường tuỳ chọn rỗng canonical thì VẮNG.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface EpochHeader {
  /** Cấu hình call của hội thoại (provider, model, reasoning effort và các scalar sampling). */
  config: LlmCallConfig;
  /** Các trường cấu hình hiệu lực được HIỆN THỰC HOÁ từ đúng adapter, không do bên gọi đề xuất. */
  adapterDefaults?: LlmCallConfigAdapterDefaults;
  /** Schema tool đã lắp ráp; vắng với request không có tool. */
  tools?: ToolSchema[];
  /** Văn bản request đã nghỉ hưu; system prompt thuộc về sự kiện system/message.
   * @persistenceReserved
   */
  system?: never;
}

/**
 * Metadata gắn đăng ký cho MỘT route model đã phân giải.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface RequestContext {
  /** Route provider đã đăng ký mà metadata thuộc về. */
  provider: string;
  /** Id model do provider sở hữu mà metadata thuộc về. */
  model: string;
  /** Tổng context tối đa của request và phản hồi, tính bằng token, khi route quảng cáo. */
  contextWindow?: number;
  /** 'in-history' khi route đọc message system MỚI NHẤT tại bất kỳ vị trí nào làm system prompt hiệu lực. */
  systemPromptUpdate?: SystemPromptUpdate;
}

/**
 * Vì sao một snapshot request/header được thêm: 'initial' — header ĐẦU của log (hội thoại mới);
 * 'resume' — request đầu của một thực thể vòng lặp trên log đã có sự kiện header (tiến trình restart,
 * seed của fork); 'change' — request sau dùng header KHÁC; 'series' — header KHÔNG đổi đã mở một chuỗi
 * message tách biệt tường minh hoặc đi sau một lần thay thế surface. Nguyên nhân khác mang startsSeries
 * khi một chuỗi mới trùng thời điểm.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type RequestHeaderReason = "initial" | "resume" | "change" | "series";

/**
 * Nguồn sự thật CHỈ THÊM, mở rộng được bằng merge, cho một tương tác agent. Lịch sử message được dẫn
 * xuất từ log này. Mọi sự kiện là JSON không mất mát và số thứ tự luôn liền mạch. Sự kiện attempt của
 * assistant nhúng đúng các stream thô đã nén của nó, nên lưu trữ giữ MỘT settlement bền cho mỗi attempt.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface SessionEventMap {
  /**
   * Mở lượt turn TRƯỚC khi vòng lặp nhận input đang xếp hàng hoặc chạy pre-step. Bị từ chối, input
   * rỗng, bị huỷ hoặc thất bại có thể đóng nó mà KHÔNG có bước nào; ngược lại sự kiện user/message có
   * định danh theo sau (hoặc lô của nó) ghi các message đi vào bước.
   */
  "turn/start": {
    turn: number;
  };
  /**
   * Đóng lượt turn với {@link TurnEndReason} đã kết thúc nó. Một lượt không có bước nào đã vào thì
   * không có step/start lẫn step/end. Vòng lặp KHÔNG chờ một lần flush tại ranh giới lượt:
   * dsh-session-checkpoint-policy sở hữu checkpoint bền theo từng request, và bên tiêu thụ đọc lưu trữ
   * sau whenIdle() phải tự flush. Thành công cam kết lượt; bị từ chối được báo lúc sống và KHÔNG ngăn
   * việc về sau.
   */
  "turn/end": {
    turn: number;
    reason: TurnEndReason;
  };
  /** Mở bước step của lượt turn — một lần gọi model cộng các lần chạy tool mà nó đã yêu cầu. */
  "step/start": {
    turn: number;
    step: number;
  };
  /** Đóng bước step của lượt turn. */
  "step/end": {
    turn: number;
    step: number;
  };
  /**
   * Một message vai trò user trên surface mà model NHÌN THẤY: prompt trực tiếp của người (message đang
   * xếp hàng được nhận cho lượt này), context tổng hợp do agent.inject() cấp (thông báo đổi tệp,
   * AGENTS.md thư mục con, nội dung skill, thông báo cron, …), hoặc một vòng tiếp tục goal đã vào. Cả ba
   * chiếu content NGUYÊN VĂN; source phân biệt chúng.
   */
  "user/message": UserMessage;
  /** Một thay đổi tăng dần của session agent được nhận tại lượt và bước đã nêu. */
  "developer/message": {
    turn: number;
    step: number;
    message: DeveloperMessage;
    /** request/header sớm hơn đã định nghĩa MỌI lần thêm tool; bắt buộc ĐÚNG khi có phần thêm tool. */
    headerSeq?: SessionSeq;
  };
  /**
   * System prompt đã kết xuất trên surface mà model nhìn thấy. Vòng lặp thêm cái ĐẦU TIÊN làm node 0
   * của surface trước user/message đầu của bước. Một route in-history đã chuẩn bị có thể thêm các thay
   * đổi KHÁC RỖNG trong một chuỗi đang tiếp diễn. Route không đủ năng lực hoặc chuỗi mới sẽ chuẩn hoá
   * văn bản về node system đầu tiên. Việc chuẩn hoá làm RỖNG các node sau vốn khác rỗng, rồi viết lại
   * node đầu nếu cần, qua các lần thay thế TỪNG NODE đã ghi. Một kết xuất rỗng LUÔN xoá mọi node system
   * đang hoạt động, không để lại chỉ dẫn cũ nào model nhìn thấy. Node sau rỗng là DORMANT và chiếu thành
   * không message; node đầu rỗng mà không có node sau đang hoạt động ghi nhận "không có system prompt".
   * Văn bản khác rỗng được khôi phục theo đúng quy tắc route và chuỗi; node rỗng KHÔNG BAO GIỜ khôi phục
   * văn bản cũ.
   */
  "system/message": {
    turn: number;
    step: number;
    message: SystemMessage;
  };
  /**
   * Message assistant đã lắp ráp cho một bước (lịch sử dẫn xuất dùng sự kiện này). Mang usage của bước
   * khi adapter đã báo token accounting, nên đầu ra của model và accounting của nó đi cùng nhau (không
   * có bản ghi usage riêng). usage VẮNG khi adapter không báo gì. Một lượt bị huỷ giữa stream chốt tiền
   * tố văn bản/reasoning đã giao làm chính sự kiện này với interrupted: true; các tool call chưa gửi đi
   * thì vắng. Marker phân biệt tiền tố đó mà KHÔNG phải suy lại việc ngắt từ ranh giới lượt. Một lượt
   * bị huỷ mà không có sự kiện như vậy thì đã không stream nội dung nào nhìn thấy được.
   */
  "assistant/message": {
    turn: number;
    step: number;
    message: AssistantMessage;
    /** Stream model có thời gian CHÍNH XÁC, đã nén mà không nối các ranh giới delta. */
    stream: AssistantStreamRecord[];
    usage?: TokenUsage;
    interrupted?: true;
  };
  /**
   * MỘT lần thử model đã cam kết mà không có message nào trên surface. Stream nhúng giữ lại một lần thử
   * thất bại, bị retry, bị huỷ hoặc lỗi stream đã tới settlement mà không bịa ra lịch sử model nhìn thấy.
   */
  "assistant/attempt": {
    turn: number;
    step: number;
    stream: AssistantStreamRecord[];
  };
  /**
   * Model đã yêu cầu MỘT lần gọi tool: name với arguments là string JSON THÔ đúng như model sinh ra
   * (chưa parse). callId ghép lần gọi này với tool/result của nó.
   */
  "tool/call": {
    turn: number;
    step: number;
    callId: ToolCallId;
    name: string;
    arguments: string;
  };
  /**
   * Kết quả hướng tới model của một lần gọi tool đã xong, kèm định danh lỗi nội bộ tuỳ chọn, lý do
   * hướng tới người dùng tuỳ chọn và payload trình bày meta riêng của tool tuỳ chọn. Lý do vẫn NẰM NGOÀI
   * message hướng tới model. meta là ĐỤC với lõi (tool sinh ra nó sở hữu hình dạng và đọc lại trong
   * presentResult) nhưng BẮT BUỘC tuần tự hoá được thành JSON: Session.append kiểm tra mọi data của sự
   * kiện bằng isJsonValue lúc chạy, nên meta không tuần tự hoá được sẽ bị từ chối ngay tại nguồn, và log
   * bền tái tạo đúng thẻ đó khi phát lại. Vắng trừ khi tool gắn một cái (ví dụ dsh-tool-fs mang diff
   * ngữ cảnh lúc có kết quả ở đây).
   */
  "tool/result": {
    turn: number;
    step: number;
    message: ToolResultMessage;
    /**
     * Định danh lỗi và lý do THÔ hướng tới người dùng, nằm ngoài nội dung model thấy; chỉ được phép khi
     * message có isError: true.
     */
    error?: {
      name: string;
      code: string;
      reason?: string;
    };
    meta?: JsonValue;
  };
  /**
   * Header ĐẦY ĐỦ cho request kế tiếp, được thêm BÊN TRONG bước của nó trước khi gửi. Sự kiện này chỉ
   * nằm trong log; snapshot mới nhất dựng lại request header.
   */
  "request/header": {
    header: EpochHeader;
    reason: RequestHeaderReason;
    /** Request này mở một chuỗi message model TÁCH BIỆT, độc lập với lý do của header. */
    startsSeries?: true;
  };
  /**
   * Metadata route cho request kế tiếp, chỉ được ghi khi route, năng lực, hoặc chế độ cập nhật system
   * prompt thay đổi. Nó KHÔNG tham gia việc dựng lại request hay so sánh header. Việc nhận prompt dùng
   * năng lực của call đã chuẩn bị và đã gắn, KHÔNG dùng snapshot này từ request sớm hơn.
   */
  "request/context": RequestContext;
  /**
   * Tách lịch sử thừa kế hoặc được khôi phục khỏi công việc do vòng đời sở hữu về sau. Marker CHỈ-LOG
   * này không cần nằm tại {@link Session.firstLiveSeq}: một seed của fork có thể đã chứa marker có tag
   * của nó cùng các closer tổng hợp thuộc con trước khi dựng.
   *
   * Một con fork mới sở hữu ĐÚNG MỘT marker { inherited: true } tại vết cắt tiền tố thừa kế chính xác
   * của nó, kể cả khi tiền tố đó kết thúc bằng marker của tổ tiên. buildForkSeed thêm marker đó trước
   * mọi closer tổng hợp; constructor của Session tự cấp nó khi chỉ được cho tiền tố thừa kế. Marker có
   * tag CUỐI CÙNG là vết cắt của Session hiện tại; marker không tag giữ ranh giới vòng đời khôi phục và
   * phát lại thông thường.
   *
   * CHỈ constructor của Session và buildForkSeed được tạo marker này. Session append KHÔNG từ chối bên
   * ghi khác, nên một plugin thêm marker như vậy sẽ âm thầm phân loại MỌI cặp mở/đóng đang sống trước nó
   * là lịch sử seed.
   *
   * Chủ sở hữu của một cặp mở/đóng độc lập (compaction/start … compaction/end) đọc nó vì lịch sử seed
   * và công việc đang sống nếu không thì GIỐNG NHAU từng byte: một marker mở không có cặp trước sự kiện
   * này thuộc về một vòng đời ĐÃ KẾT THÚC, bất kể cái gì đã kết thúc nó. KHÔNG phải tín hiệu sống còn
   * của bên ghi khác — một session đang sống đồng thời giữ ranh giới của CHÍNH nó ở nơi khác, nên việc
   * chấp nhận bên ghi đồng thời cần một tín hiệu ngoài log.
   */
  "session/end-seed": {
    inherited?: true;
  };
}

/**
 * Các khoá loại sự kiện CÓ THỂ THÊM của {@link SessionEventMap}, kể cả phần mở rộng do plugin merge.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SessionEventType = keyof SessionEventMap;

/**
 * Tập con của {@link SessionEventType} mà sự kiện của nó sinh message LLM và đủ điều kiện xuất hiện trên
 * surface có thứ tự. CHỈ các loại sự kiện này được mang {@link SurfaceOp}; sự kiện system, user và tool
 * cũng có thể dẫn các nguồn sớm hơn qua {@link SessionEvent.sourceEventSeqs}.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SurfaceEventType =
  | "system/message"
  | "developer/message"
  | "user/message"
  | "assistant/message"
  | "tool/result";

/**
 * Một sự kiện sinh message, mang surface op BẮT BUỘC của nó.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SurfaceEvent = SessionEvent<SurfaceEventType>;

/**
 * Cách một sự kiện session đã đi vào surface có thứ tự. CHỈ hợp lệ trên sự kiện thuộc
 * {@link SurfaceEventType}.
 *
 * - 'append': thêm vào đuôi — đường thông thường cho message user/assistant/tool.
 * - { op: 'replace', startSeq, endSeq }: thay các node surface từ startSeq (bao gồm) đến endSeq (bao
 *   gồm) bằng node này. Cả hai phải tồn tại làm node surface trong surface hiện tại. startSeq bằng
 *   endSeq thay MỘT node. {@link SessionEvent.sourceEventSeqs} của node phải chứa MỌI node surface bị
 *   che. Compaction dùng nó; mọi bên sinh thay thế surface đều có thể dùng.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SurfaceOp =
  | "append"
  | {
      op: "replace";
      startSeq: SessionSeq;
      endSeq: SessionSeq;
    };

/**
 * Vị trí trên surface và các seq sự kiện nguồn được dẫn cho {@link Session.append}. Bắt buộc trên sự
 * kiện sinh message và BỊ CẤM trên sự kiện chỉ-log.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export type SurfaceIntent<T extends SurfaceEventType = SurfaceEventType> = {
  surfaceOp: SurfaceOp;
} & (T extends "assistant/message"
  ? {
      /** Message assistant nhúng stream của provider thay vì dẫn seq sự kiện nguồn. */
      sourceEventSeqs?: never;
    }
  : {
      /** Tập ĐẦY ĐỦ, KHÁC RỖNG các seq sự kiện nguồn đã biết sớm hơn. */
      sourceEventSeqs?: SessionSeq[];
    });

/**
 * MỘT mục bất biến trong log session.
 *
 * Một union phân biệt ĐÚNG NGHĨA theo type (không phải hai union type/data độc lập), nên
 * switch (event.type) thu hẹp event.data mà KHÔNG cần ép kiểu.
 *
 * Hai trường sourceEventSeqs và surfaceOp là CÓ ĐIỀU KIỆN: chúng chỉ tồn tại trên các biến thể thuộc
 * {@link SurfaceEventType} (system/message, user/message, assistant/message, tool/result). Sự kiện
 * KHÔNG thuộc surface (marker ranh giới, attempt, lỗi) không bao giờ mang metadata surface — compiler
 * cưỡng chế điều đó tại nơi gọi {@link Session.append}.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type SessionEvent<T extends SessionEventType = SessionEventType> = {
  [K in SessionEventType]: {
    type: K;
    /** Số thứ tự ĐƠN ĐIỆU trong session. */
    seq: SessionSeq;
    /** Unix epoch mili giây. */
    time: number;
    data: SessionEventMap[K];
    /**
     * Đánh dấu một sự kiện mà bộ đọc ĐƯỢC PHÉP bỏ qua khi không nhận ra type. Vắng nghĩa là BẮT BUỘC:
     * bộ đọc gặp loại lạ mà không có marker này BẮT BUỘC từ chối dựng lại session thay vì âm thầm bỏ
     * sự kiện, vì một sự kiện bắt buộc không nhận ra có thể làm đổi cách hiểu phần còn lại của log. Bên
     * ghi chỉ đặt true trên các bản ghi thuần thông tin mà việc mất chúng không ảnh hưởng việc dựng lại;
     * mặc định là bắt buộc để một marker bị quên sẽ TỪ CHỐI QUÁ MỨC (một bất tiện) thay vì âm thầm resume
     * một session bị rỗng ruột.
     */
    ignorable?: true;
  } & (K extends SurfaceEventType
    ? SurfaceIntent<K>
    : {
        surfaceOp?: never;
        sourceEventSeqs?: never;
      });
}[T];

/**
 * Loại sự kiện của một bản ghi plugin thử nghiệm: plugin: theo sau là các đoạn phân cách bằng dấu chéo,
 * gồm chữ thường, chữ số, dấu chấm, gạch dưới và gạch nối, mỗi đoạn bắt đầu bằng chữ cái hoặc chữ số.
 * Một loại bản ghi KHÔNG BAO GIỜ là thành viên của {@link SessionEventMap}.
 * Nhận: không (kiểu chỉ mô tả một giá trị). Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type PluginRecordType = `plugin:${string}`;

/**
 * Payload do các gói thử nghiệm ghi, khoá theo tên bản ghi plugin: của chúng. Các gói merge vào map này
 * để định kiểu lần ghi và bước vào danh mục bản ghi plugin hiện tại; những khai báo đó KHÔNG đi vào
 * {@link SessionEventMap} hay schema lưu trữ đã phát hành. Bản ghi đã lưu vẫn cần chủ sở hữu kiểm.
 *
 * Bản gốc để các gói merge vào interface này bằng declare module; repo CẤM augment module (ADR 000d)
 * nên interface ở đây RỖNG và giữ nguyên tên cho parity.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface PluginRecordMap {}

/**
 * MỘT bản ghi plugin thử nghiệm đã cam kết, được đọc từ log bằng pluginRecordOf. Chủ sở hữu bản ghi kiểm
 * data trước khi dùng, vì một bản ghi được khôi phục mang bất kỳ JSON nào mà bản build trước của chủ nó
 * đã ghi, hoặc một sự kiện V3 mà một lần chuyển định dạng đã đổi tên vào không gian plugin:.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface PluginRecord {
  /** Loại bản ghi, do plugin sở hữu chọn. */
  readonly type: PluginRecordType;
  /** Vị trí của bản ghi trong log Session. */
  readonly seq: SessionSeq;
  /** Unix epoch mili giây lúc thêm. */
  readonly time: number;
  /** Payload JSON đúng như đã cam kết. */
  readonly data: unknown;
}

/*
 * Bản gốc cộng gộp hai bảng của seam typert bằng declare module: TypertResourceMap khoá 'session' với
 * giá trị TypertResource<SessionId>, và RemoteErrorDetailsMap khoá 'session/not-found'. Repo CẤM augment
 * module (ADR 000d) nên hai mục đó được khai theo CẤU TRÚC tại chỗ dưới đây: giữ NGUYÊN VĂN khoá và hình
 * dạng payload, bỏ lớp vỏ phantom TypertResource (interface chỉ mang định danh kiểu, không có thành viên
 * lúc chạy, và khoá [RESOURCE_ID] của nó là symbol riêng của gói protocol nên không khai lại được).
 */

/**
 * Mục resource 'session' của seam typert, khai theo CẤU TRÚC — thay cho phần TypertResourceMap trong
 * khối augment của bản gốc. Giá trị là chính định danh Session mà resource mang.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface SessionTypertResourceMap {
  /** Một Session; Session Controller đăng ký trường wire sessionId mặc định của nó. */
  readonly session: SessionId;
}

/**
 * Mục lỗi 'session/not-found' của seam typert, khai theo CẤU TRÚC — thay cho phần RemoteErrorDetailsMap
 * trong khối augment của bản gốc. Session được nêu tên không tồn tại; mọi tầng phân giải SessionId đều
 * sinh mã lỗi này.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface SessionRemoteErrorDetailsMap {
  /** Chi tiết lỗi: đúng SessionId đã không tìm thấy. */
  readonly "session/not-found": {
    readonly sessionId: SessionId;
  };
}