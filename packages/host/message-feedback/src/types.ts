/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng CÔNG KHAI của row message-feedback: yêu cầu/giá trị/mã lỗi của ba thao tác Remote
 *      (list · put · delete) và hai event CHỈ-GHI-LOG mà row này ghi vào log phiên. File CHỈ có kiểu
 *      ⇒ bản build ra là một module rỗng, đúng như `lib/types/types.js` của bản gốc.
 *
 * ⚠️ KHÔNG khai `declare module` nào ở đây (kể cả `Events['feedback/committed']` hay
 * `SessionEventMap`). Khai toàn cục của TA sẽ HỢP NHẤT với khai của gói gốc — mà gói gốc vẫn nằm
 * trong chương trình `tsc` qua `import type {} from "@deepseek-ai/dsh-message-feedback"` của
 * `host/session-telemetry-otel` — và biến `inspection.meta.id` của họ thành `string | SessionId`
 * ⇒ `Session.fromRestore` đỏ ở FILE KHÔNG PHẢI CỦA TA (đo được 18/10/2026). Vì vậy kiểu của seam
 * được khai HẸP tại chỗ dùng (`HostContext` trong `service.ts`), không chiếm không gian toàn cục.
 */

import type { FeedbackCategory } from "@galaxy-blackhole/gbh-command-feedback/types";
import type { SessionEvent } from "@deepseek-ai/dsh-session/types";

/**
 * Token so-sánh-và-đặt cho đúng một phiên bản của một mục phản hồi.
 *
 * Bản gốc dùng `Branded<'MessageFeedbackVersion'>` của `dsh-brand`; brand chỉ có nghĩa LÚC BIÊN DỊCH
 * (bị xoá khi build) còn ở biên JSON nó là chuỗi UUID — ràng buộc thật nằm ở schema zod `z.uuid()`.
 */
export type MessageFeedbackVersion = string;

/** Đánh giá tổng thể của người dùng cho một tin nhắn assistant. */
export type MessageFeedbackRating = "positive" | "negative";

/** Định danh tin nhắn assistant trong phiên (ở biên JSON là chuỗi thuần, không brand). */
export type MessageId = string;

/** Định danh phiên đã lưu (ở biên JSON là chuỗi thuần, không brand). */
export type SessionId = string;

/** Một giá trị phản hồi hiện tại kèm token đột biến. */
export interface MessageFeedbackItem {
  /** Định danh ổn định của tin nhắn assistant trong phiên sở hữu. */
  readonly messageId: MessageId;
  /** Đánh giá tổng thể: thích hay không thích. */
  readonly rating: MessageFeedbackRating;
  /** Giải thích tuỳ chọn, giữ nguyên văn sau khi kiểm. */
  readonly note?: string;
  /** Nhóm mà người dùng xếp đánh giá vào. */
  readonly category?: FeedbackCategory;
  /** Token chỉ-dùng-để-so-sánh, được thay ở MỌI lượt tạo/sửa có nghĩa. */
  readonly version: MessageFeedbackVersion;
  /** Thời điểm tạo do Host gán, mili-giây Unix. */
  readonly createdAt: number;
  /** Thời điểm sửa có nghĩa gần nhất do Host gán. */
  readonly updatedAt: number;
}

/** Một lượt tạo/sửa có nghĩa, mang theo toàn bộ giá trị hiện tại. */
export interface MessageFeedbackPut {
  /** Phiên sở hữu; phản hồi thừa kế trong một fork thuộc về phiên cha. */
  readonly sessionId: SessionId;
  /** Giá trị sau lượt đột biến này, kể cả thời điểm tạo ban đầu. */
  readonly item: MessageFeedbackItem;
}

/** Một lượt xoá có nghĩa của một mục phản hồi hiện tại. */
export interface MessageFeedbackDelete {
  /** Phiên sở hữu phản hồi bị xoá. */
  readonly sessionId: SessionId;
  /** Tin nhắn có phản hồi đã bị gỡ. */
  readonly messageId: MessageId;
}

/** Yêu cầu đọc toàn bộ phản hồi của một vòng đời phiên đã lưu. */
export interface MessageFeedbackListRequest {
  /** Phiên cần đọc các event phản hồi. */
  readonly sessionId: SessionId;
}

/** Các giá trị phản hồi hiện tại của một phiên, theo thứ tự tạo lần đầu. */
export interface MessageFeedbackListValue {
  /** Ảnh chụp bất biến, mới mỗi lượt đọc. */
  readonly items: readonly MessageFeedbackItem[];
}

/** Tạo hoặc thay phản hồi cho một tin nhắn assistant. */
export interface MessageFeedbackPutRequest {
  /** Phiên đã lưu sở hữu tin nhắn đích. */
  readonly sessionId: SessionId;
  /** Định danh tin nhắn assistant đích. */
  readonly messageId: MessageId;
  /** Đánh giá tổng thể mong muốn. */
  readonly rating: MessageFeedbackRating;
  /** Giải thích tuỳ chọn, không được rỗng sau khi cắt khoảng trắng. */
  readonly note?: string;
  /** Nhóm tuỳ chọn; vắng mặt nghĩa là mục không được phân nhóm. */
  readonly category?: FeedbackCategory;
  /** Phiên bản đã quan sát, hoặc `null` để đòi hỏi mục CHƯA tồn tại. */
  readonly ifVersion: MessageFeedbackVersion | null;
}

/** Xoá phản hồi của một tin nhắn sau khi quan sát phiên bản hiện tại. */
export interface MessageFeedbackDeleteRequest {
  /** Phiên sở hữu phản hồi. */
  readonly sessionId: SessionId;
  /** Tin nhắn phải KHÔNG còn phản hồi sau thao tác này. */
  readonly messageId: MessageId;
  /** Phiên bản đã quan sát; bị bỏ qua khi mục vốn đã vắng. */
  readonly ifVersion: MessageFeedbackVersion;
}

/** Xác nhận xoá luỹ đẳng. */
export interface MessageFeedbackDeleteValue {
  /** Hậu điều kiện ổn định, dùng chung cho lượt xoá đầu và mọi lượt thử lại. */
  readonly absent: true;
}

/** Không có header phiên đã lưu nào cho id được yêu cầu. */
export interface MessageFeedbackSessionNotFound {
  /** Mã lỗi nghiệp vụ. */
  readonly code: "session-not-found";
  /** Phiên không tồn tại. */
  readonly sessionId: SessionId;
}

/** Id không trỏ tới một tin nhắn assistant gốc-append đã suy ra được. */
export interface MessageFeedbackTargetNotFound {
  /** Mã lỗi nghiệp vụ. */
  readonly code: "target-not-found";
  /** Phiên được hỏi. */
  readonly sessionId: SessionId;
  /** Tin nhắn không phải đích hợp lệ. */
  readonly messageId: MessageId;
}

/** Một lượt đột biến có nghĩa không khớp phiên bản hiện tại của mục được nhắm tới. */
export interface MessageFeedbackVersionConflict {
  /** Mã lỗi nghiệp vụ. */
  readonly code: "version-conflict";
  /** Mục hiện tại theo quyền quyết định, hoặc `null` khi nó không tồn tại. */
  readonly current: MessageFeedbackItem | null;
}

/** Ghi chú được gửi lên không có ký tự nào ngoài khoảng trắng. */
export interface MessageFeedbackNoteBlank {
  /** Mã lỗi nghiệp vụ. */
  readonly code: "note-blank";
}

/** Ghi chú được gửi lên vượt trần byte UTF-8 đã cấu hình. */
export interface MessageFeedbackNoteTooLarge {
  /** Mã lỗi nghiệp vụ. */
  readonly code: "note-too-large";
  /** Trần byte cho phép của cấu hình. */
  readonly maxBytes: number;
  /** Số byte UTF-8 thực tế của ghi chú. */
  readonly actualBytes: number;
}

/** Các lỗi nghiệp vụ dùng chung cho ba thao tác công khai. */
export type MessageFeedbackFailure =
  | MessageFeedbackSessionNotFound
  | MessageFeedbackTargetNotFound
  | MessageFeedbackVersionConflict
  | MessageFeedbackNoteBlank
  | MessageFeedbackNoteTooLarge;

/** Kết quả thành công của một thao tác công khai. */
export interface MessageFeedbackSuccess<T> {
  /** Dấu thành công. */
  readonly ok: true;
  /** Giá trị trả về. */
  readonly value: T;
}

/** Kết quả bị từ chối kèm một lỗi nghiệp vụ ổn định. */
export interface MessageFeedbackRejected<E extends MessageFeedbackFailure> {
  /** Dấu thất bại. */
  readonly ok: false;
  /** Lỗi nghiệp vụ cụ thể. */
  readonly error: E;
}

/** Kết quả của thao tác `list`. */
export type MessageFeedbackListResult =
  | MessageFeedbackSuccess<MessageFeedbackListValue>
  | MessageFeedbackRejected<MessageFeedbackSessionNotFound>;

/** Kết quả của thao tác `put`. */
export type MessageFeedbackPutResult =
  | MessageFeedbackSuccess<MessageFeedbackItem>
  | MessageFeedbackRejected<
      | MessageFeedbackSessionNotFound
      | MessageFeedbackTargetNotFound
      | MessageFeedbackVersionConflict
      | MessageFeedbackNoteBlank
      | MessageFeedbackNoteTooLarge
    >;

/** Kết quả của thao tác `delete`. */
export type MessageFeedbackDeleteResult =
  | MessageFeedbackSuccess<MessageFeedbackDeleteValue>
  | MessageFeedbackRejected<MessageFeedbackSessionNotFound | MessageFeedbackVersionConflict>;

/** Header phiên: ba trường mà row này đọc để đối chiếu handle với phiên đang sống. */
export interface SessionHeaderView {
  /** Định danh phiên. */
  readonly id: string;
  /** Thời điểm tạo phiên, mili-giây Unix. */
  readonly createdAt: number;
  /** Thư mục làm việc của phiên. */
  readonly cwd: string;
}

/** Tiền tố log canonical đã bền vững, mang phản hồi vừa ghi ở event CUỐI. */
export interface SessionInspection {
  /** Header đã lưu của phiên. */
  readonly meta: SessionHeaderView;
  /** Số event thừa kế từ phiên cha của fork. */
  readonly inheritedEventCount: number;
  /** Tiền tố canonical đã kiểm, gồm cả phản hồi ở cuối. */
  readonly events: readonly MessageFeedbackLogEvent[];
}

/** Một event `feedback/message-put` như nó nằm trong log (seq/time do tầng ghi đánh). */
export interface MessageFeedbackPutEvent {
  /** Loại event. */
  readonly type: "feedback/message-put";
  /** Thân event. */
  readonly data: MessageFeedbackPut;
  /** Số thứ tự trong log; vắng khi event mới được dựng, chưa ghi. */
  readonly seq?: number;
  /** Thời điểm ghi, mili-giây Unix; vắng khi chưa ghi. */
  readonly time?: number;
}

/** Một event `feedback/message-delete` như nó nằm trong log. */
export interface MessageFeedbackDeleteEvent {
  /** Loại event. */
  readonly type: "feedback/message-delete";
  /** Thân event. */
  readonly data: MessageFeedbackDelete;
  /** Số thứ tự trong log; vắng khi event mới được dựng, chưa ghi. */
  readonly seq?: number;
  /** Thời điểm ghi, mili-giây Unix; vắng khi chưa ghi. */
  readonly time?: number;
}

/** Hai loại event CHỈ-GHI-LOG mà row này ghi vào log phiên. */
export type MessageFeedbackEvent = MessageFeedbackPutEvent | MessageFeedbackDeleteEvent;

/**
 * Một dòng của log phiên mà row này đọc: event thật của Session HOẶC event phản hồi của row này.
 * Khai tại chỗ (không mở rộng `SessionEventMap`) để không chiếm kiểu toàn cục của gói khác.
 */
export type MessageFeedbackLogEvent = SessionEvent | MessageFeedbackEvent;
