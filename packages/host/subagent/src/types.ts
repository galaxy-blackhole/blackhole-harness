/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hợp đồng hướng bên tiêu thụ của seam subagent: request/result/năng lực cho SubagentProvider,
 *      cùng payload `subagent/start` và `subagent/end` mà plugin và host quan sát. Port 1:1
 *      `lib/types/types.js` (19 dòng) + `lib/types/types.d.ts` (343 dòng) của `@deepseek-ai/dsh-subagent`.
 */

/**
 * Hợp đồng hướng bên tiêu thụ của seam: kiểu request, result và năng lực cho {@link SubagentProvider},
 * cùng payload `subagent/start` và `subagent/end` mà plugin và host quan sát. Giao diện điều khiển
 * nội bộ nằm cùng phần cài đặt của nó — observer vòng đời trong `./lifecycle.ts`, host quản lý trong
 * `./manager.ts` — để module này vẫn là bề mặt công bố thay vì một túi kiểu vạn năng.
 *
 * @module @galaxy-blackhole/gbh-subagent/types
 */

import type { Agent, AgentOptions } from "@galaxy-blackhole/gbh-agent";
import { brandString, type Branded } from "@deepseek-ai/dsh-brand";
import type { ContentBlock, MessageId } from "@deepseek-ai/dsh-llm";
import type { SessionEvent, SessionId } from "@galaxy-blackhole/gbh-session";
import type { ObjectJsonSchema } from "@galaxy-blackhole/gbh-host-tools";

/** Định danh MỘT lần chạy subagent đã được chấp nhận, xuyên suốt cặp sự kiện vòng đời của nó. */
export type SubagentRunId = Branded<"SubagentRunId">;

/**
 * Đóng dấu một chuỗi thành {@link SubagentRunId}.
 * Nhận: id — id chạy thô.
 * Trả: chính chuỗi đó, đã mang dấu kiểu {@link SubagentRunId}.
 */
export function SubagentRunId(id: string): SubagentRunId {
  return brandString<SubagentRunId>(id);
}

/** MỘT lần thi hành con được quản lý, kèm chính sách giao kết quả. */
export interface SubagentActivationSpec {
  /** Backend đã đăng ký để dùng. */
  readonly provider: string;
  /** Nhãn tác vụ ngắn, được giữ trong tư cách thành viên con đã lập danh mục. */
  readonly label: string;
  /** Danh tính dành riêng tuỳ chọn cho con cục bộ; backend ngoài tự cấp id của nó. */
  readonly childId?: SessionId;
  /** Tác vụ, cha, và các tuỳ chọn thi hành mà backend hỗ trợ. */
  readonly request: Omit<SubagentStartRequest, "label" | "signal">;
  /** Huỷ trước khi công bố; bên gọi sở hữu việc huỷ về sau qua dispose. */
  readonly signal: AbortSignal;
  /** Giao cho cha thì báo cho model; giao cho bên gọi chỉ trả kết quả. Con cục bộ luôn vào danh mục cha. */
  readonly delivery: "parent" | "caller";
}

/** MỘT lần thi hành được quản lý; dispose nhắm ĐÚNG lần kích hoạt này, không bao giờ nhắm lần chạy lại sau đó. */
export interface SubagentActivation {
  /** Danh tính ổn định của con. */
  readonly childId: SessionId;
  /** Tin nhắn đã được hộp thư nhận, khi backend có hộp thư cục bộ. */
  readonly messageId?: MessageId;
  /**
   * Kết quả thi hành sau khi teardown lắng và thông báo đã gửi; lỗi chụp kết quả thì promise bị từ chối.
   * Lỗi teardown do dispose() báo, không thay thế kết quả đã chụp.
   */
  readonly result: Promise<SubagentResult>;
  /** Dừng và giải phóng lần kích hoạt này cùng mọi hậu duệ nó sở hữu; từ chối khi teardown hỏng. */
  dispose(): Promise<void>;
}

/**
 * Thẩm quyền mà MỘT yêu cầu ngắt được nhận theo. `user` mang địa chỉ cha trực tiếp bền vững mà client
 * người dùng đã trình; `ancestor` mang đúng đối tượng Agent đang sống mà dòng dõi đã ghi của nó phải
 * chứa bên gọi.
 */
export type SubagentInterruptAuthority =
  | {
      readonly kind: "user";
      readonly parentSessionId: SessionId;
    }
  | {
      readonly kind: "ancestor";
      readonly agent: Agent;
    };

/** Tuỳ chọn cho MỘT tin nhắn do model soạn giữa hai Agent liền kề. */
export interface SubagentSendMessageOptions {
  /** Huỷ của bên gọi, chỉ sở hữu thao tác cho tới khi hộp thư nhận. */
  readonly signal: AbortSignal;
}

/**
 * Chi tiết định danh CHỈ để quan sát của một lần chạy subagent đã công bố, mang bởi `subagent/start`.
 * Lần kích hoạt cục bộ và bên ngoài dùng chung payload này.
 */
export interface SubagentRunInfo {
  /** Danh tính duy nhất, chia sẻ với sự kiện kết thúc đi kèm. */
  readonly runId: SubagentRunId;
  /**
   * Tên provider được ghi khi con được tạo lần đầu, vẫn giữ kể cả sau khi provider đó bị gỡ đăng ký.
   */
  readonly provider: string;
  /** Id của Agent con. */
  readonly id: SessionId;
  /** Lần kích hoạt này có sở hữu một Agent cục bộ hay không, cố định tại lúc công bố. */
  readonly local: boolean;
}

/**
 * Chi tiết kết cục CHỈ để quan sát của một lần chạy subagent đã lắng, mang bởi `subagent/end` và được
 * ghép với đúng một {@link SubagentRunInfo} qua `runId`.
 */
export interface SubagentRunEndInfo {
  /** Danh tính duy nhất, chia sẻ với sự kiện bắt đầu đi kèm. */
  readonly runId: SubagentRunId;
  /** Đúng tên provider mà sự kiện bắt đầu đi kèm mang. */
  readonly provider: string;
  /** Id của Agent con. */
  readonly id: SessionId;
  /** Lần kích hoạt này có sở hữu một Agent cục bộ hay không, cố định tại lúc công bố. */
  readonly local: boolean;
  /** Lý do dừng kết thúc. */
  readonly stopReason: SubagentResult["stopReason"];
  /**
   * Đầu ra trợ lý cuối cùng của con, chọn theo đúng quy tắc của {@link SubagentResult.output}; vắng
   * mặt khi bị hạ tầng từ chối hoặc khi con không sinh ra gì.
   */
  readonly lastAssistantMessage?: readonly ContentBlock[];
}

/**
 * Tuỳ chọn lúc khởi chạy mà một backend đã đăng ký hỗ trợ. Quản lý kiểm MỌI tuỳ chọn được yêu cầu
 * trước khi chuẩn bị con cục bộ hoặc khởi chạy thi hành ngoài. `depthLimit` điều khiển `maxDepth`; các
 * tên cờ còn lại khớp trường của SubagentStartRequest.
 */
export interface SubagentCapabilities {
  readonly agentOptions: boolean;
  /** Hỗ trợ chọn preset độc lập với thành phần hợp thành của cha. */
  readonly agentPreset: boolean;
  readonly outputSchema: boolean;
  readonly depthLimit: boolean;
}

/**
 * Tác vụ và các năng lực tuỳ chọn cấp cho một backend. `startActivation` mang các trường này trong
 * `request` trong khi tự sở hữu nhãn, việc huỷ, và chính sách giao kết quả một cách riêng.
 */
export interface SubagentStartRequest {
  /** Thư mục con ban đầu; đường dẫn tương đối phân giải theo thư mục hiện tại của cha. Bỏ trống thì thừa hưởng thư mục đó lúc khởi chạy. */
  readonly cwd?: string;
  /**
   * Id preset độc lập; bỏ trống thì nhập vào thế hệ hiện tại của cha. Đòi provider có
   * `capabilities.agentPreset` và không thừa hưởng ngữ cảnh cha.
   */
  readonly agentPreset?: string;
  /** Nhãn hiển thị ngắn tuỳ chọn, được lưu cùng con có Session làm nền. */
  readonly label?: string;
  /** Nội dung được giao làm tin nhắn người dùng của con. */
  readonly prompt: ContentBlock[];
  /**
   * Agent sinh ra con. Thư mục hiệu lực của nó cấp `cwd` mặc định; con trong cùng tiến trình giữ nguyên
   * gốc, dòng dõi và độ sâu uỷ nhiệm của nó.
   */
  readonly parent: Agent;
  /**
   * Tín hiệu huỷ từ ngữ cảnh sinh ra con (thường là `exec.signal` của công cụ). Đây là kênh huỷ chuẩn
   * cho cả trước lẫn sau khởi động: provider dọn tài nguyên dở dang rồi từ chối `start()` khi tín hiệu
   * phát trước lúc lần chạy được công bố, và huỷ phần việc lượt còn lại của lần chạy đã công bố khi tín
   * hiệu phát sau đó.
   */
  readonly signal: AbortSignal;
  /**
   * Tuỳ chọn ghi đè provider, model, reasoning-effort và output-token của Agent chủ. Đòi
   * {@link SubagentCapabilities.agentOptions}; provider trong cùng tiến trình gộp chúng lên tuỳ chọn
   * của Agent cha khi tạo con, còn provider DSH SDK gộp chúng lên giá trị mặc định của instance trước
   * khi khởi tạo runtime con riêng.
   */
  readonly agentOptions?: AgentOptions;
  /**
   * JSON Schema gốc-đối-tượng nằm trong tập con mà `assertObjectJsonSchema` áp đặt. Lúc khởi chạy sẽ từ
   * chối schema không hỗ trợ hoặc provider thiếu năng lực. Dữ liệu phải là JSON thuần của realm host;
   * con thành công trả đúng giá trị khớp về {@link SubagentResult.structured}.
   */
  readonly outputSchema?: ObjectJsonSchema;
  /**
   * Chặn trên độ sâu uỷ nhiệm tuyệt đối, tuỳ chọn, cho con đang được khởi chạy: độ sâu tính được của
   * nó phải nhỏ hơn hoặc bằng số nguyên an toàn không âm này. Đòi
   * {@link SubagentCapabilities.depthLimit}; nếu không thì bị từ chối lúc khởi chạy.
   */
  readonly maxDepth?: number;
}

/** Yêu cầu hướng provider với thư mục tuyệt đối đã chọn trước khi khởi chạy. */
export interface ResolvedSubagentStartRequest extends SubagentStartRequest {
  /** Thư mục con tuyệt đối, chụp từ cha hoặc từ yêu cầu tường minh. */
  readonly cwd: string;
}

/**
 * Thứ mà quản lý tiếp nối hỏi provider khi hiện thực hoá lần kích hoạt ĐẦU TIÊN của một con tiếp nối
 * được. Quản lý đã dành sẵn danh tính con bền vững và sở hữu mọi thao tác về sau, nên yêu cầu này chỉ
 * mang thứ phân biệt con mới với con được mồi bằng lịch sử cha.
 */
export interface ContinuableCreateRequest {
  /** Thư mục ban đầu tuyệt đối, chụp trước khi provider chuẩn bị. */
  readonly cwd: string;
  /** Id phiên con bền vững đã dành sẵn, dùng cho chẩn đoán của provider. */
  readonly sessionId: SessionId;
  /** Agent cha uỷ nhiệm, nguồn mà provider mồi đọc lịch sử. */
  readonly parent: Agent;
  /**
   * Huỷ của bên gọi, chỉ sở hữu phần chuẩn bị cho tới khi quản lý nhận lời nhắc đầu tiên vào hộp thư
   * của con.
   */
  readonly signal: AbortSignal;
}

/**
 * Phần đóng góp TÁCH RỜI của provider cho việc tạo một con tiếp nối được. Đây là DỮ LIỆU, không bao giờ
 * là năng lực: nó không mang Agent, `AgentHandle`, việc giao prompt, kết quả, dispose hay thao tác chạy
 * lại, vì quản lý tiếp nối sở hữu toàn bộ vòng đời của con sau phần chuẩn bị.
 */
export interface ContinuableCreateSpec {
  /**
   * Tiền tố lượt đã đóng của log cha để mồi phiên con, hoặc vắng mặt với con hoàn toàn mới. Cùng hợp
   * đồng bền vững như `CreateAgentOptions.seed`: liên tục từ seq 0, JSON không mất mát, cân bằng.
   */
  readonly seed?: readonly SessionEvent[];
}

/**
 * Vì sao một lần chạy subagent kết thúc. Mở rộng được bằng cách gộp (backend có thể thêm biến thể); bên
 * tiêu thụ rẽ nhánh trên các trường hợp đã biết và rơi xuống `default`. Các trường hợp đã biết phản
 * chiếu từ vựng kết thúc lượt của harness để tầng công cụ ánh xạ được kết quả khác `completed` thành
 * kết quả công cụ `isError`.
 */
export interface SubagentStopReasonMap {
  /** Con kết thúc lượt của nó bình thường. */
  completed: "completed";
  /** Bị huỷ qua tín hiệu của yêu cầu hoặc qua dispose. */
  aborted: "aborted";
  /** Lỗi model hoặc lỗi truyền tải. */
  error: "error";
  /** Con chạm trần token trước khi hoàn tất. */
  "max-tokens": "max-tokens";
  /** Con từ chối tác vụ. */
  refusal: "refusal";
}

/** Hợp trên {@link SubagentStopReasonMap} — tự mở rộng khi backend gộp thêm biến thể. */
export type SubagentStopReason = SubagentStopReasonMap[keyof SubagentStopReasonMap];

/** Kết cục kết thúc của một lần chạy subagent, do {@link SubagentRun.result} phân giải. */
export interface SubagentResult {
  /**
   * Đầu ra trợ lý cuối cùng của con là nội dung tin nhắn trợ lý KHÔNG RỖNG cuối cùng. Tin nhắn rỗng
   * nội dung — kể cả tin chỉ mang usage — bị bỏ qua. Không có tin nào không rỗng thì đầu ra là dòng
   * văn bản trợ lý đã tích luỹ, hoặc `[]` khi con không sinh ra cả hai.
   */
  readonly output: readonly ContentBlock[];
  /**
   * Kết quả có cấu trúc sau khi `outputSchema` được yêu cầu đã thoả thành công. Yêu cầu schema KHÔNG
   * bảo đảm có mặt: provider có thể kết thúc với `stopReason: 'error'` khi con hỏng hoặc kết thúc mà
   * không chụp được giá trị hợp lệ. Provider kiểm giá trị có cấu trúc theo schema đã yêu cầu; ở đây là
   * `unknown` vì seam không gắn với schema cụ thể nào.
   */
  readonly structured?: unknown;
  /**
   * Chi tiết hỏng do provider soạn, không phải nội dung trợ lý, cho kết quả khác `completed`. Provider
   * giữ văn bản này sạch khỏi đầu vào công cụ, nội dung tệp, giá trị môi trường, thông tin xác thực và
   * payload giao thức thô, đồng thời giới hạn nó ở 4096 byte UTF-8. Bên tiêu thụ trình bày nó tách
   * khỏi {@link output}.
   */
  readonly diagnostic?: string;
  /** Vì sao lần chạy kết thúc. Lý do khác `completed` nghĩa là `output` có thể chỉ là một phần. */
  readonly stopReason: SubagentStopReason;
}

/**
 * Tay nắm thi hành của backend, do sổ đăng ký kích hoạt sở hữu trực tiếp. Kết quả có thể sẵn sàng trước
 * khi tài nguyên được giải phóng; quản lý luôn dispose tay nắm và chờ dọn dẹp. Lỗi khởi động của
 * backend dọn tài nguyên dở dang rồi mới từ chối, còn lỗi thi hành đã được nhận thì lắng qua `result`.
 */
export interface SubagentRun {
  /** Id do provider đúc, duy nhất trên toàn bộ cha, provider và Session cục bộ trong runtime này. */
  readonly id: SessionId;
  /**
   * Phân giải bằng {@link SubagentResult} kết thúc của con khi lần chạy lắng. KHÔNG từ chối vì lỗi cấp
   * con — lỗi model/truyền tải phân giải với `stopReason: 'error'` để bên tiêu thụ ánh xạ thành kết
   * quả công cụ `isError`. Từ chối khi lỗi hạ tầng mà seam không biểu diễn được thành lý do dừng.
   */
  readonly result: Promise<SubagentResult>;
  /**
   * Huỷ phần việc còn lại, đạt trạng thái tĩnh lặng của con, và giải phóng tài nguyên. Lũy đẳng.
   */
  dispose(): Promise<void>;
}

/**
 * MỘT kênh vận chuyển đã đăng ký để chạy Agent con. Provider là cài đặt cùng tiến trình đáng tin cậy;
 * bên gọi coi descriptor và giá trị trả về là dữ liệu bất biến mượn. Dịch vụ có thể gọi đồng thời một
 * provider cho các con khác nhau. Provider cô lập trạng thái thay đổi được theo từng thao tác; bộ điều
 * khiển năng lực dùng chung có thể hoãn một thao tác nhưng không được buộc việc lắng hay dọn dẹp của
 * nó vào một thao tác anh em.
 */
export interface SubagentProvider {
  /** Tên đăng ký duy nhất (ví dụ `spawn`, `fork`, `acp`). */
  readonly name: string;
  /** Các tính năng lúc khởi chạy mà provider này hỗ trợ (xem {@link SubagentCapabilities}). */
  readonly capabilities: SubagentCapabilities;
  /**
   * Con có thấy tiền tố lượt đã đóng của cha hay không. Đây là thông tin mô tả, KHÔNG phải năng lực
   * khởi chạy được dịch vụ kiểm: công cụ hướng model rút ra lời lẽ trung thực từ nó. Nó không nói gì về
   * đăng ký công cụ, dịch vụ được tiêm, hay thẩm quyền được thừa hưởng.
   */
  readonly inheritsParentContext: boolean;
  /**
   * Tuyến provider/model TUỲ CHỌN do provider sở hữu, dùng cho tuỳ chọn Agent của con. Bên tiêu thụ gộp
   * ghi đè của công cụ/model lên các giá trị này trước khi tiền kiểm; provider có tuyến rút từ cha thì
   * bỏ trống. Giá trị là dữ liệu bất biến tách rời và đòi hỗ trợ `agentOptions`.
   */
  readonly agentRouteDefaults?: Readonly<{
    provider: string;
    model: string;
  }>;
  /**
   * Thiết lập MỘT lần thi hành bên ngoài và trả tay nắm nó sở hữu. Dịch vụ đã kiểm mọi năng lực khởi
   * chạy được yêu cầu là có hỗ trợ. Trước khi hoàn tất, provider sở hữu phần dựng và dọn mọi tài nguyên
   * dở dang chưa công bố trước khi từ chối. Quyền sở hữu chuyển giao khi hoàn tất; lỗi lượt hoặc lỗi hạ
   * tầng về sau lắng qua lần chạy đã trả. Các lần khởi chạy khác nhau có thể chồng lấn; huỷ, hỏng, lắng
   * kết quả và dispose vẫn độc lập cho từng lần chạy.
   */
  start?(request: ResolvedSubagentStartRequest): Promise<SubagentRun>;
  /**
   * TUỲ CHỌN (năng lực tạo tiếp nối được): đóng góp đầu vào tạo dựng tách rời để phân biệt con tiếp nối
   * được của provider này — chỉ là phiên con có được mồi bằng lịch sử cha hay không. Sự có mặt của
   * phương thức chọn thi hành kích hoạt cục bộ. Provider không có nó thì thi hành qua `start` và không
   * nhận tin nhắn về sau.
   *
   * Đây là tham gia DUY NHẤT của provider vào một con tiếp nối được. Quản lý tiếp nối sở hữu việc dành
   * danh tính, hợp thành, tạo Agent, giao prompt, chạy lại nguội, quyền sở hữu và dispose, nên provider
   * không bao giờ thấy Agent, tay nắm, lượt hay teardown của con. Các lần chuẩn bị khác nhau có thể chồng
   * lấn; mỗi lần theo tín hiệu của chính nó và trả dữ liệu chỉ thuộc `request.sessionId`.
   */
  prepareContinuable?(request: ContinuableCreateRequest): Promise<ContinuableCreateSpec>;
}
