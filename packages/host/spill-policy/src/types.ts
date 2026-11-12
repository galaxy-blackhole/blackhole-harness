/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Từ vựng MẶT CẮT mà chính sách tràn ngữ cảnh dùng, khai theo CẤU TRÚC (không import gói seam
 *      nào): lượt gọi tool, quyết định của waterfall `tools/post-execute`, kho tràn (`spillStore`),
 *      định giá ảnh theo tuyến, ánh xạ đường dẫn của kho tệp và của tệp đính kèm.
 */

import type { ContentBlock, LlmImageRequestPricing } from "@galaxy-blackhole/gbh-llm";

/**
 * Tham chiếu ảnh bền của kho đính kèm.
 * Lấy ĐÚNG kiểu từ khối ảnh của `dsh-llm` (không import gói `dsh-attachment`: nó là peer của `dsh-llm`,
 * không phải của ta) — nhờ vậy ta không mở thêm một tên peer chỉ để đặt tên cho kiểu này.
 */
export type ImageAttachmentRef = Extract<ContentBlock, { type: "image" }>["attachment"];

/** Mã phiên: thương hiệu `SessionId` của kernel chỉ tồn tại lúc biên dịch, lúc chạy là chuỗi. */
export type SessionId = string;

/** Phần của `SpillRef` mà thông báo tràn dùng: chỗ lưu bản đầy đủ và câu hướng dẫn đọc lại. */
export interface SpillNoticeRef {
  /** Định vị bản đầy đủ (đường dẫn tệp trong kho tràn). */
  readonly locator: string;
  /** Câu hướng dẫn đọc lại, do kho tràn đặt (ví dụ "Use read with offset/limit …"). */
  readonly retrievalHint: string;
}

/** Tham chiếu do kho tràn trả sau khi lưu: `SpillNoticeRef` cộng thêm định danh của kho. */
export interface SpillRef extends SpillNoticeRef {
  /** Định danh bản ghi trong kho tràn (bản gốc không đọc trường này). */
  readonly id?: string;
}

/** Yêu cầu lưu một bản đầy đủ vào kho tràn. */
export interface SpillSaveRequest {
  /** Phiên sở hữu bản ghi — cùng danh tính mà mọi hệ con khác dùng. */
  readonly owner: { readonly sessionId: SessionId };
  /** Nguồn sinh ra bản ghi: một lượt gọi tool, kèm nhãn `result` hay `dispatch`. */
  readonly source: {
    /** Luôn `tool`: chính sách chỉ tràn kết quả tool. */
    readonly kind: "tool";
    /** Tên tool đã sinh kết quả. */
    readonly toolName: string;
    /** Mã lượt gọi của tool. */
    readonly callId: string;
    /** Nhãn bản ghi: `result` cho kết quả top-level, `dispatch` cho bản ghi log PTC. */
    readonly label: string;
  };
  /** Tên tệp gợi ý (bản gốc dùng `<toolName>.txt`). */
  readonly suggestedName: string;
  /** Toàn bộ chữ của kết quả, kèm một dòng mô tả ảnh ở mỗi vị trí ảnh. */
  readonly content: string;
}

/** Kho tràn mà chính sách gọi vào: chỉ cần khả năng lưu chữ và trả tham chiếu đọc lại. */
export interface SpillStoreSeam {
  /**
   * Lưu bản đầy đủ của một kết quả tool.
   * Nhận: yêu cầu lưu (chủ sở hữu, nguồn, tên gợi ý, toàn bộ chữ).
   * Trả: tham chiếu có định vị và câu hướng dẫn đọc lại; NÉM lỗi khi kho không ghi được.
   */
  saveText(request: SpillSaveRequest): Promise<SpillRef>;
}

/** Định giá ảnh của MỘT tuyến model — kernel cấp qua `ctx.get("llm")`. */
export interface ImagePricingRoute {
  /**
   * Lấy bộ định giá ảnh của một tuyến model.
   * Nhận: khoá provider và id model của tuyến đang phục vụ request.
   * Trả: bộ định giá của tuyến đó, hoặc `undefined` khi tuyến không định giá ảnh.
   */
  imageRequestPricing(provider: string, model: string): LlmImageRequestPricing | undefined;
}

/** Mặt cắt của kho tệp đính kèm: ánh xạ vị trí lưu trên máy chủ của một ảnh. */
export interface AttachmentPathSeam {
  /**
   * Vị trí lưu trên máy chủ của một ảnh đã chuẩn hoá.
   * Nhận: tham chiếu ảnh bền của kho đính kèm.
   * Trả: đường dẫn tuyệt đối trên máy chủ, hoặc `undefined` khi kho không giữ ảnh đó.
   */
  imageHostPath(ref: ImageAttachmentRef): string | undefined;
}

/** Mặt cắt của kho tệp: đổi đường dẫn máy chủ sang đường dẫn mà tool đọc được. */
export interface FsSeam {
  /**
   * Đổi một đường dẫn trên máy chủ sang thế giới thực thi của tool.
   * Nhận: đường dẫn tuyệt đối trên máy chủ.
   * Trả: đường dẫn đọc được trong thế giới thực thi, hoặc `undefined` khi không ánh xạ được.
   */
  processPathFromHostPath(hostPath: string): string | undefined;
}

/** Tuyến model của request đang chạy, đọc từ đầu đề request của phiên. */
export interface RequestHeaderView {
  /** Cấu hình tuyến đã định tuyến cho request gần nhất. */
  readonly config?: {
    /** Khoá provider của tuyến. */
    readonly provider?: string;
    /** Id model của tuyến. */
    readonly model?: string;
  };
}

/** Agent chịu trách nhiệm một lượt gọi tool — chính sách chỉ đọc danh tính phiên và tuyến model. */
export interface ToolAgentView {
  /** Phiên của agent: đầu đề mang mã phiên (chủ sở hữu bản tràn) và tuyến model của request. */
  readonly session: {
    /** Đầu đề phiên — đọc ĐÚNG một trường: `id`. */
    readonly header: { readonly id: SessionId };
    /** Đầu đề request gần nhất của phiên (có thể chưa có request nào). */
    requestHeader(): RequestHeaderView | undefined;
  };
  /** Tuỳ chọn của agent — tuyến dự phòng khi phiên chưa có request. */
  readonly options: {
    /** Khoá provider mặc định của agent. */
    readonly provider?: string;
    /** Id model mặc định của agent. */
    readonly model?: string;
  };
}

/**
 * Lượt gọi tool đang đi qua waterfall — mặt cắt chính sách đọc.
 * Tên kiểu giữ NGUYÊN của bản gốc (`SpillPolicyExec`); ở đây rộng hơn bản gốc một chút vì hai listener
 * waterfall cần thêm tên · mã lượt gọi · token cha, còn chủ sở hữu bản tràn vẫn chỉ đọc `agent.session.header.id`.
 */
export interface SpillPolicyExec {
  /** Tên tool (bản gốc bỏ qua tool `read`). */
  readonly name: string;
  /** Mã lượt gọi của tool. */
  readonly callId: string;
  /** Token của lượt vận chuyển bao ngoài (PTC): có mặt nghĩa là lời gọi LỒNG NHAU. */
  readonly parent?: unknown;
  /** Agent chịu trách nhiệm lượt gọi; vắng mặt ở lời gọi không thuộc agent nào. */
  readonly agent?: ToolAgentView;
}

/** Kết quả canonical của một lượt gọi tool mà waterfall đưa vào. */
export interface PostExecuteResult {
  /** Nội dung model nhìn thấy trước khi chính sách viết lại. */
  readonly content: readonly ContentBlock[];
  /** Kết quả là lỗi (chính sách chỉ đọc cờ này ở nhánh PTC). */
  readonly isError?: boolean;
}
/** Quyết định của waterfall `tools/post-execute` — chính sách chỉ rẽ theo `kind` và đọc ba trường ở nhánh `accept`. */
export interface ToolPostExecuteDecision {
  /** Loại quyết định của tầng dưới (`accept` là nhánh duy nhất chính sách can thiệp). */
  readonly kind: string;
  /** Nội dung đã thay cho kết quả tool. */
  readonly content?: readonly ContentBlock[];
  /** Thay thế bằng một giá trị của chương trình (PTC) — chính sách không đụng vào. */
  readonly value?: unknown;
  /** Ngữ cảnh gửi kèm cho model ở lượt sau. */
  readonly additionalContexts?: readonly unknown[];
}

/** Hàm gọi tiếp của waterfall `tools/post-execute`: chạy tầng dưới rồi trả quyết định của nó. */
export type PostExecuteNext = () => Promise<ToolPostExecuteDecision>;

/** Listener waterfall `tools/post-execute`: nhận lượt gọi + kết quả + hàm gọi tiếp, trả quyết định. */
export type PostExecuteListener = (
  exec: SpillPolicyExec,
  result: PostExecuteResult,
  next: PostExecuteNext,
) => Promise<ToolPostExecuteDecision>;

/** Bản ghi log PTC đang đi qua waterfall: lượt gọi con và tên của nó. */
export interface PtcDispatchLogView {
  /** Lượt gọi con (đã có `parent`). */
  readonly exec: SpillPolicyExec;
  /** Tên tool của lời gọi con. */
  readonly name: string;
  /** Mã lời gọi con trong chương trình PTC. */
  readonly subCallId: string;
}

/** Hàm gọi tiếp của waterfall `tools/ptc-dispatch-log`: trả nội dung log của tầng dưới. */
export type PtcDispatchLogNext = () => Promise<readonly ContentBlock[]>;

/** Listener waterfall `tools/ptc-dispatch-log`: nhận bản ghi + hàm gọi tiếp, trả nội dung đã giới hạn. */
export type PtcDispatchLogListener = (
  dispatch: PtcDispatchLogView,
  next: PtcDispatchLogNext,
) => Promise<readonly ContentBlock[]>;

/** Tuỳ chọn đăng ký listener waterfall của cordis. */
export interface WaterfallOptions {
  /** Chèn listener lên ĐẦU chuỗi (bản gốc dùng cho cả hai sự kiện). */
  readonly prepend?: boolean;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: hai điểm mở rộng + bốn khoá `ctx.get`. */
export interface SpillPolicyContext {
  /**
   * Đăng ký listener cho waterfall `tools/post-execute`.
   * Nhận: tên sự kiện, listener, và tuỳ chọn chèn lên đầu chuỗi.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "tools/post-execute", listener: PostExecuteListener, options?: WaterfallOptions): () => void;
  /**
   * Đăng ký listener cho waterfall `tools/ptc-dispatch-log`.
   * Nhận: tên sự kiện, listener, và tuỳ chọn chèn lên đầu chuỗi.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "tools/ptc-dispatch-log", listener: PtcDispatchLogListener, options?: WaterfallOptions): () => void;
  /** Định giá ảnh theo tuyến model (có thể vắng khi kernel chưa lắp dịch vụ LLM). */
  get(name: "llm"): ImagePricingRoute | undefined;
  /** Kho tràn — thiếu nó thì chính sách giữ nguyên nội dung và ghi cảnh báo. */
  get(name: "spillStore"): SpillStoreSeam | undefined;
  /** Kho tệp đính kèm — thiếu nó thì ảnh không có đường dẫn đọc lại. */
  get(name: "attachments"): AttachmentPathSeam | undefined;
  /** Kho tệp — thiếu nó thì ảnh không có đường dẫn trong thế giới thực thi. */
  get(name: "fs"): FsSeam | undefined;
  /** Ghi cảnh báo: mọi lỗi của chính sách là best-effort, không được làm mất nội dung tool. */
  readonly logger: { warn(message: string): void };
}
