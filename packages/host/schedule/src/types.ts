/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng KIỂU dùng chung của gói schedule, viết lại theo lib/types/*.d.ts của @deepseek-ai/dsh-schedule
 */

// Danh sách export (nhóm theo vai trò):
//   · Bản ghi: AfterScheduleRecord · AtScheduleRecord · EveryScheduleRecord · DailyScheduleRecord ·
//     WeeklyScheduleRecord · CronScheduleRecord · OneShotScheduleRecord · LegacyAfterScheduleRecord ·
//     LegacyAtScheduleRecord · LegacyEveryScheduleRecord · LegacyScheduleRecord · RecurringScheduleRecord ·
//     ScheduleRecord
//   · Đầu vào: DailyInput · WeeklyInput · CronInput · LocalAtInput · AtInput
//   · Giao nhận: ScheduleDeliveryReceipt · ScheduleDeliveryRecord · ScheduleDeliveryHistory
//   · Thay đổi bền: ScheduleCreateChange · ScheduleDeleteChange · OneShotScheduleDispatchChange ·
//     EveryScheduleDispatchChange · ScheduleDispatchChange · ScheduleChange · ScheduleChangeEvent
//   · Khung nhìn: ScheduleState · ScheduleDeliveryMode · ScheduleView · ScheduleCatalogEntry
//   · Lỗi công cụ: InvalidPromptError · InvalidSelectorError · InvalidRuleError · InvalidTimeZoneError ·
//     NotFutureError · TimeOutOfRangeError · FrequencyTooHighError · SubagentSessionError ·
//     InternalScheduleError · ScheduleToolError
//   · Giá trị công cụ: ScheduleCreateValue · ScheduleListValue · ScheduleDeleteResult ·
//     ScheduleDeleteValue · ScheduleUpdateMiss · ScheduleUpdateResult · ScheduleUpdateValue
//   · Yêu cầu: ScheduleCreateRequest · ScheduleListRequest · ScheduleDeleteRequest · ScheduleTimingChange ·
//     ScheduleUpdateContent · ScheduleUpdateRequest · ScheduleDeliveryHistoryRequest
//   · Lịch sử giao: DeliveryRetentionBounds · ScheduleDeliveryHistoryResult
//   · Dùng chung nội bộ: ScheduleId · FoldedSchedules · RecurringOccurrence · ScheduleTask ·
//     ScheduleDomain · Config · ScheduleMessageSource · ScheduleSessionActivity

import type { Branded } from "@deepseek-ai/dsh-brand";
import type { ContextFormed } from "@deepseek-ai/dsh-llm";
import type { MessageId } from "@deepseek-ai/dsh-llm/brand";
import type { SessionId } from "@deepseek-ai/dsh-session/types";
import type { DomainTableSpec } from "@deepseek-ai/dsh-storage-domain";

/** Danh tính nhắc hẹn bền, duy nhất toàn cục (chỉ đóng dấu ở mức KIỂU; lúc chạy vẫn là chuỗi, y bản gốc). */
export type ScheduleId = Branded<"ScheduleId">;

/** Nhắc hẹn một lần tạo từ một độ trễ dương. */
export interface AfterScheduleRecord {
  /** Danh tính tác vụ duy nhất toàn cục. */
  readonly id: ScheduleId;
  /** Dấu phân loại cho nhắc hẹn một lần có độ trễ. */
  readonly kind: "after";
  /** Tên tác vụ bắt buộc đã lưu; đã cắt khoảng trắng, khác rỗng, tối đa 120 ký tự. */
  readonly title: string;
  /** Nội dung nhắc hẹn đã cắt khoảng trắng, do lúc tạo cung cấp. */
  readonly prompt: string;
  /** Độ trễ an toàn dương được nhận lúc tạo. */
  readonly afterSeconds: number;
  /** Đích RFC 3339 UTC với năm bốn chữ số. */
  readonly scheduledAt: string;
}

/** Nhắc hẹn một lần tạo từ một thời điểm tuyệt đối. */
export interface AtScheduleRecord {
  /** Danh tính tác vụ duy nhất toàn cục. */
  readonly id: ScheduleId;
  /** Dấu phân loại cho nhắc hẹn một lần tuyệt đối. */
  readonly kind: "at";
  /** Tên tác vụ bắt buộc đã lưu; đã cắt khoảng trắng, khác rỗng, tối đa 120 ký tự. */
  readonly title: string;
  /** Nội dung nhắc hẹn đã cắt khoảng trắng, do lúc tạo cung cấp. */
  readonly prompt: string;
  /** Đích RFC 3339 UTC với năm bốn chữ số. */
  readonly scheduledAt: string;
}

/** Nhắc hẹn lặp đều, neo theo lúc tạo hoặc lần sửa nhịp gần nhất. */
export interface EveryScheduleRecord {
  /** Danh tính tác vụ duy nhất toàn cục. */
  readonly id: ScheduleId;
  /** Dấu phân loại cho nhắc hẹn lặp đều. */
  readonly kind: "every";
  /** Tên tác vụ bắt buộc đã lưu; đã cắt khoảng trắng, khác rỗng, tối đa 120 ký tự. */
  readonly title: string;
  /** Nội dung nhắc hẹn đã cắt khoảng trắng, do lúc tạo cung cấp. */
  readonly prompt: string;
  /** Nhịp cố định là số nguyên an toàn, không dưới một phút. */
  readonly everySeconds: number;
  /** Lần kế tiếp thẳng hàng neo khi đang hoạt động, hoặc lần cuối khi đã ngưng. */
  readonly scheduledAt: string;
}

/** Nhắc hẹn hằng ngày theo giờ tường; khoảng trống bỏ ngày, chồng lấn lấy thời điểm sớm hơn. */
export interface DailyScheduleRecord {
  /** Danh tính tác vụ duy nhất toàn cục. */
  readonly id: ScheduleId;
  /** Dấu phân loại cho nhắc hẹn hằng ngày. */
  readonly kind: "daily";
  /** Tên tác vụ bắt buộc đã lưu; đã cắt khoảng trắng, khác rỗng, tối đa 120 ký tự. */
  readonly title: string;
  /** Nội dung nhắc hẹn đã cắt khoảng trắng, do lúc tạo cung cấp. */
  readonly prompt: string;
  /** Giờ địa phương đã chuẩn hoá về HH:mm:ss.SSS. */
  readonly time: string;
  /** Vùng IANA tường minh; sửa thời gian tương đương vẫn giữ cách viết đã lưu. */
  readonly timeZone: string;
  /** Thời điểm UTC kế tiếp đã cam kết khi đang hoạt động, hoặc lần cuối khi đã ngưng. */
  readonly scheduledAt: string;
}

/** Nhắc hẹn hằng tuần theo giờ tường; khoảng trống bỏ ngày, chồng lấn lấy thời điểm sớm hơn. */
export interface WeeklyScheduleRecord {
  /** Danh tính tác vụ duy nhất toàn cục. */
  readonly id: ScheduleId;
  /** Dấu phân loại cho nhắc hẹn hằng tuần. */
  readonly kind: "weekly";
  /** Tên tác vụ bắt buộc đã lưu; đã cắt khoảng trắng, khác rỗng, tối đa 120 ký tự. */
  readonly title: string;
  /** Nội dung nhắc hẹn đã cắt khoảng trắng, do lúc tạo cung cấp. */
  readonly prompt: string;
  /** Giờ địa phương đã chuẩn hoá về HH:mm:ss.SSS. */
  readonly time: string;
  /** Vùng IANA chuẩn tường minh; sửa thời gian tương đương vẫn giữ cách viết đã lưu. */
  readonly timeZone: string;
  /** Thứ ISO duy nhất, tăng dần, Thứ Hai 1 tới Chủ Nhật 7. */
  readonly weekdays: number[];
  /** Thời điểm UTC kế tiếp đã cam kết khi đang hoạt động, hoặc lần cuối khi đã ngưng. */
  readonly scheduledAt: string;
}

/** Nhắc hẹn cron theo giờ tường; khoảng trống bỏ ngày, chồng lấn lấy thời điểm sớm hơn. */
export interface CronScheduleRecord {
  /** Danh tính tác vụ duy nhất toàn cục. */
  readonly id: ScheduleId;
  /** Dấu phân loại cho nhắc hẹn cron năm trường. */
  readonly kind: "cron";
  /** Tên tác vụ bắt buộc đã lưu; đã cắt khoảng trắng, khác rỗng, tối đa 120 ký tự. */
  readonly title: string;
  /** Nội dung nhắc hẹn đã cắt khoảng trắng, do lúc tạo cung cấp. */
  readonly prompt: string;
  /** Biểu thức cron năm trường chuẩn tắc: phút giờ ngày-trong-tháng tháng thứ-trong-tuần. */
  readonly expression: string;
  /** Vùng IANA tường minh; sửa thời gian tương đương vẫn giữ cách viết đã lưu. */
  readonly timeZone: string;
  /** Thời điểm UTC kế tiếp đã cam kết khi đang hoạt động, hoặc lần cuối khi đã ngưng. */
  readonly scheduledAt: string;
}

/** Bộ chọn giờ địa phương hằng ngày, dùng cho lúc tạo và khi sửa thời gian. */
export interface DailyInput {
  /** Giờ HH:mm:ss địa phương với 1–3 chữ số lẻ tuỳ chọn. */
  readonly time: string;
  /** Vùng UTC hoặc IANA Area/Location tường minh. */
  readonly time_zone: string;
}

/** Bộ chọn giờ địa phương + thứ trong tuần, dùng cho lúc tạo và khi sửa thời gian. */
export interface WeeklyInput {
  /** Giờ HH:mm:ss địa phương với 1–3 chữ số lẻ tuỳ chọn. */
  readonly time: string;
  /** Vùng UTC hoặc IANA Area/Location tường minh. */
  readonly time_zone: string;
  /** Tập thứ ISO khác rỗng, Thứ Hai 1 tới Chủ Nhật 7, không lặp. */
  readonly weekdays: number[];
}

/** Bộ chọn cron năm trường, dùng cho lúc tạo và khi sửa thời gian. */
export interface CronInput {
  /** Biểu thức cron Vixie năm trường: phút giờ ngày-trong-tháng tháng thứ-trong-tuần. */
  readonly expression: string;
  /** Vùng UTC hoặc IANA Area/Location tường minh. */
  readonly time_zone: string;
}

/** Bộ chọn lịch địa phương có cấu trúc, dùng cho lúc tạo và khi sửa thời gian. */
export interface LocalAtInput {
  /** Ngày lịch ISO bốn chữ số. */
  readonly date: string;
  /** Giờ tường địa phương với 1–3 chữ số lẻ tuỳ chọn. */
  readonly time: string;
  /** Vùng UTC hoặc IANA Area/Location tường minh. */
  readonly time_zone: string;
}

/** Bộ chọn tuyệt đối: chuỗi RFC 3339 có offset, hoặc lịch địa phương có cấu trúc. */
export type AtInput = string | LocalAtInput;

/** Các biến thể nhắc hẹn một lần. */
export type OneShotScheduleRecord = AfterScheduleRecord | AtScheduleRecord;

/** Độ trễ một lần do sự kiện phiên phiên bản 1 lưu, không có `title` về sau này. */
export interface LegacyAfterScheduleRecord extends Omit<AfterScheduleRecord, "title"> {
  /** Tên tác vụ đã lưu; vắng mặt trong sự kiện ghi trước khi có tên. */
  readonly title?: string;
}

/** Nhắc hẹn tuyệt đối một lần do sự kiện phiên phiên bản 1 lưu, không có `title` về sau này. */
export interface LegacyAtScheduleRecord extends Omit<AtScheduleRecord, "title"> {
  /** Tên tác vụ đã lưu; vắng mặt trong sự kiện ghi trước khi có tên. */
  readonly title?: string;
}

/** Nhắc hẹn lặp đều do sự kiện phiên phiên bản 1 lưu, không có `title` về sau này. */
export interface LegacyEveryScheduleRecord extends Omit<EveryScheduleRecord, "title"> {
  /** Tên tác vụ đã lưu; vắng mặt trong sự kiện ghi trước khi có tên. */
  readonly title?: string;
}

/**
 * Từ vựng sự kiện phiên và phép gộp đã đóng băng; quy tắc daily chỉ thuộc lưu trữ Host.
 *
 * Sự kiện phiên bản 1 ghi trước khi có tên không lưu thành viên `title`, nên `after`, `at`,
 * và `every` giải mã được khi thiếu nó và vẫn đọc được. Bản ghi tác vụ của Host bắt buộc
 * thành viên này và không bao giờ lưu bản ghi thiếu nó.
 */
export type LegacyScheduleRecord = LegacyAfterScheduleRecord | LegacyAtScheduleRecord | LegacyEveryScheduleRecord;

/** Các biến thể tác vụ lặp của Host. */
export type RecurringScheduleRecord = EveryScheduleRecord | DailyScheduleRecord | WeeklyScheduleRecord | CronScheduleRecord;

/** Quy tắc nhắc hẹn kèm đích, lưu cùng ràng buộc Session gốc. */
export type ScheduleRecord = OneShotScheduleRecord | RecurringScheduleRecord;

/** Biên nhận giao vào hộp thư bền của Session, không phải hoàn tất thực thi của model. */
export interface ScheduleDeliveryReceipt {
  /** Đích UTC chuẩn tắc của lần giao đã giao. */
  readonly scheduledAt: string;
  /** Thời điểm UTC chuẩn tắc lấy sau khi lưu trữ Session xác nhận đã giao. */
  readonly deliveredAt: string;
  /** Danh tính message đã giao, dùng chung cho các tác vụ trong một lô lặp. */
  readonly messageId: MessageId;
}

/** Lần giao đã lưu kèm câu nhắc bất biến đã gửi khi Host này ghi nhận. */
export interface ScheduleDeliveryRecord extends ScheduleDeliveryReceipt {
  /** Câu nhắc đã gửi cho lần này; không có với biên nhận cũ. */
  readonly prompt?: string;
}

/** Kho lịch sử giao đã lưu của MỘT tác vụ, cộng hai cờ nguồn gốc. */
export interface ScheduleDeliveryHistory {
  /** Các lần giao còn giữ, cũ nhất trước, theo thứ tự ghi. */
  records: ScheduleDeliveryRecord[];
  /** Có thể còn biên nhận cũ hơn không đọc được (thiếu bằng chứng, không dựng lại). */
  earlierRecordsUnavailable: boolean;
  /** Đã từng cắt bớt bản ghi đã lưu hay chưa. */
  earlierRecordsPruned?: boolean;
}

/** Tác vụ Host đã lưu: một schedule gắn với Session gốc; `status` vắng mặt giải mã là active. */
export interface ScheduleTask {
  /** Session gốc nhận nhắc hẹn khi tới hạn. */
  sessionId: SessionId;
  /** Bản ghi quy tắc bền của tác vụ. */
  record: ScheduleRecord;
  /** Tác vụ ngưng vẫn hiện nhưng không bao giờ hẹn giao lần nữa. */
  status: "active" | "inactive";
  /** Lần giao vào hộp thư được xác nhận bền gần nhất, khi có. */
  lastDelivery?: ScheduleDeliveryReceipt;
  /** Kho lịch sử giao còn giữ của tác vụ, khi đã từng ghi. */
  deliveryHistory?: ScheduleDeliveryHistory;
}

/** Khai báo miền lưu trữ bền của Host: định danh, phiên bản, và bảng tác vụ. */
export interface ScheduleDomain {
  /** Tên miền lưu trữ, cũng là tên đơn vị của backend. */
  readonly name: string;
  /** Phiên bản định dạng miền hiện tại. */
  readonly version: number;
  /** Bảng tác vụ duy nhất, khoá theo danh tính nhắc hẹn. */
  readonly tables: {
    /** Bảng tác vụ: một bản ghi cho mỗi nhắc hẹn. */
    readonly tasks: DomainTableSpec<ScheduleId, ScheduleTask>;
  };
}

/** Nhắc hẹn an toàn cho trình duyệt, kèm ràng buộc Session gốc. */
export type ScheduleCatalogEntry = ScheduleRecord & {
  /** Session nhận nhắc hẹn này khi tới hạn. */
  readonly sessionId: SessionId;
  /** Nhắc hẹn ngưng vẫn hiện nhưng không bao giờ hẹn giao lần nữa. */
  readonly status: "active" | "inactive";
  /** Lần giao vào hộp thư được xác nhận bền gần nhất, khi có. */
  readonly lastDelivery?: ScheduleDeliveryReceipt;
};

/** Tạo một bản ghi nhắc hẹn bền. */
export interface ScheduleCreateChange {
  /** Phiên bản giao thức bền. */
  readonly version: 1;
  /** Phép biến đổi: tạo mới. */
  readonly operation: "create";
  /** Bản ghi được tạo, theo từ vựng sự kiện phiên lịch sử. */
  readonly schedule: LegacyScheduleRecord;
}

/** Xoá một nhắc hẹn đang hoạt động. */
export interface ScheduleDeleteChange {
  /** Phiên bản giao thức bền. */
  readonly version: 1;
  /** Phép biến đổi: xoá. */
  readonly operation: "delete";
  /** Danh tính tác vụ bị xoá. */
  readonly id: ScheduleId;
}

/** Ghi nhận một nhắc hẹn một lần đã vào lịch sử điều phối bền. */
export interface OneShotScheduleDispatchChange {
  /** Phiên bản giao thức bền. */
  readonly version: 1;
  /** Phép biến đổi: điều phối. */
  readonly operation: "dispatch";
  /** Danh tính tác vụ đã điều phối. */
  readonly id: ScheduleId;
}

/** Ghi nhận một quyết định lặp đều và nhảy thẳng qua các lần bị lỡ. */
export interface EveryScheduleDispatchChange {
  /** Phiên bản giao thức bền. */
  readonly version: 1;
  /** Phép biến đổi: điều phối. */
  readonly operation: "dispatch";
  /** Danh tính tác vụ đã điều phối. */
  readonly id: ScheduleId;
  /** Thời điểm quyết định theo giờ tường, dùng để chọn lần tới hạn muộn nhất. */
  readonly acceptedAt: string;
}

/** Các dạng điều phối bền mà bộ quy tắc hiện tại hỗ trợ. */
export type ScheduleDispatchChange = OneShotScheduleDispatchChange | EveryScheduleDispatchChange;

/** Hợp thay đổi Schedule bền phiên bản 1, đóng và nghiêm ngặt. */
export type ScheduleChange = ScheduleCreateChange | ScheduleDeleteChange | ScheduleDispatchChange;

/**
 * Một sự kiện phiên mang thay đổi Schedule, khai theo CẤU TRÚC.
 *
 * Bản gốc mở rộng `SessionEventMap` của kernel; bản viết lại không augment module nên khai
 * hình dạng tối thiểu mà phép gộp cần để thu hẹp một `SessionEvent` bất kỳ.
 */
export interface ScheduleChangeEvent {
  /** Loại sự kiện do gói này sở hữu. */
  readonly type: "schedule/change";
  /** Payload bền chưa được giải mã. */
  readonly data: ScheduleChange;
}

/** Thời điểm giao hiện tại suy ra từ bản ghi bền và đồng hồ tường. */
export type ScheduleState = "scheduled" | "overdue";

/** Host chủ động giao và đánh thức lại Session gốc khi cần. */
export type ScheduleDeliveryMode = "host";

/** Khung nhìn đầy đủ mà model thấy về một nhắc hẹn đang hoạt động. */
export type ScheduleView = ScheduleRecord & {
  /** Đích còn ở tương lai hay không. */
  readonly state: ScheduleState;
  /** Nhắc hẹn không bao giờ rời khỏi session sở hữu. */
  readonly deliveryMode: ScheduleDeliveryMode;
};

/** Lỗi ổn định khi câu nhắc hoặc tên tác vụ rỗng, quá dài, hoặc chưa cắt khoảng trắng. */
export interface InvalidPromptError {
  /** Mã lỗi công khai. */
  readonly code: "invalid_prompt";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi bộ chọn thiếu, xung đột, hoặc không được hỗ trợ. */
export interface InvalidSelectorError {
  /** Mã lỗi công khai. */
  readonly code: "invalid_selector";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi quy tắc hoặc tham số quản lý không hợp lệ. */
export interface InvalidRuleError {
  /** Mã lỗi công khai. */
  readonly code: "invalid_rule";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi vùng IANA không hợp lệ hoặc không được hỗ trợ. */
export interface InvalidTimeZoneError {
  /** Mã lỗi công khai. */
  readonly code: "invalid_time_zone";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi đích tuyệt đối không thực sự ở tương lai. */
export interface NotFutureError {
  /** Mã lỗi công khai. */
  readonly code: "not_future";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi thời điểm tính được không dùng nổi năm UTC bốn chữ số. */
export interface TimeOutOfRangeError {
  /** Mã lỗi công khai. */
  readonly code: "time_out_of_range";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi quy tắc lặp đều chạy dày hơn mức hỗ trợ. */
export interface FrequencyTooHighError {
  /** Mã lỗi công khai. */
  readonly code: "frequency_too_high";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi ổn định khi Session đích thuộc định tuyến subagent, nơi không bao giờ nhận giao nhắc hẹn. */
export interface SubagentSessionError {
  /** Mã lỗi công khai. */
  readonly code: "subagent_session";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Lỗi dự phòng ổn định, không tiết lộ ngoại lệ nội bộ. */
export interface InternalScheduleError {
  /** Mã lỗi công khai. */
  readonly code: "internal_error";
  /** Câu chẩn đoán công khai ổn định. */
  readonly message: string;
}

/** Hợp lỗi quản lý Schedule v1 đã đóng. */
export type ScheduleToolError =
  | InvalidPromptError
  | InvalidSelectorError
  | InvalidRuleError
  | InvalidTimeZoneError
  | NotFutureError
  | TimeOutOfRangeError
  | FrequencyTooHighError
  | SubagentSessionError
  | InternalScheduleError;

/** Giá trị chuẩn tắc của `schedule_create`. */
export type ScheduleCreateValue = ScheduleView | ScheduleToolError;

/** Giá trị chuẩn tắc của `schedule_list`. */
export type ScheduleListValue = ScheduleView[] | ScheduleToolError;

/** Giá trị thành công của `schedule_delete`, gồm cả kết quả không-tìm-thấy không biến đổi dữ liệu. */
export type ScheduleDeleteResult =
  | {
      /** Danh tính tác vụ được yêu cầu xoá. */
      readonly id: ScheduleId;
      /** Đã xoá thật. */
      readonly deleted: true;
    }
  | {
      /** Danh tính tác vụ được yêu cầu xoá. */
      readonly id: ScheduleId;
      /** Không xoá gì. */
      readonly deleted: false;
      /** Mã không-tìm-thấy. */
      readonly code: "schedule_not_found";
    };

/** Giá trị chuẩn tắc của `schedule_delete`. */
export type ScheduleDeleteValue = ScheduleDeleteResult | ScheduleToolError;

/** Bộ chọn lúc tạo nhắc hẹn, dùng chung cho phía model và dịch vụ Host. */
export interface ScheduleCreateRequest {
  /** Câu nhắc khác rỗng. */
  prompt: string;
  /** Tên tác vụ bắt buộc, tối đa 120 ký tự, khác rỗng sau khi cắt khoảng trắng; đặt tên cho thẻ, tiêu đề chi tiết, và danh sách tác vụ. */
  title: string;
  /** Độ trễ tương đối một lần, tính bằng giây. */
  after_seconds?: number;
  /** Đích tuyệt đối một lần. */
  at?: AtInput;
  /** Nhịp lặp cố định, tính bằng giây. */
  every_seconds?: number;
  /** Giờ tường hằng ngày trong vùng IANA tường minh. */
  daily?: DailyInput;
  /** Giờ tường hằng tuần và tập thứ ISO tường minh trong vùng IANA. */
  weekly?: WeeklyInput;
  /** Biểu thức cron năm trường, tính trong vùng IANA tường minh. */
  cron?: CronInput;
}

/** Danh sách tác vụ theo phạm vi Session, không đánh thức Agent. */
export interface ScheduleListRequest {
  /** Ràng buộc Session gốc. */
  sessionId: SessionId;
}

/** Yêu cầu xoá, định danh một tác vụ trong ràng buộc Session gốc của nó. */
export interface ScheduleDeleteRequest extends ScheduleListRequest {
  /** Tác vụ cần bỏ. */
  id: ScheduleId;
}

/** Sửa chỉ phần thời gian; có thể chọn loại lặp khác bản ghi đã lưu, và đích một lần dùng `at` tuyệt đối. */
export type ScheduleTimingChange =
  | {
      /** Loại lặp được chọn. */
      readonly kind: "at";
      /** Đích tuyệt đối thay thế. */
      at: AtInput;
    }
  | {
      /** Loại lặp được chọn. */
      readonly kind: "every";
      /** Nhịp cố định thay thế, tính bằng giây. */
      every_seconds: number;
    }
  | {
      /** Loại lặp được chọn. */
      readonly kind: "daily";
      /** Giờ tường hằng ngày thay thế. */
      daily: DailyInput;
    }
  | {
      /** Loại lặp được chọn. */
      readonly kind: "weekly";
      /** Giờ tường hằng tuần thay thế. */
      weekly: WeeklyInput;
    }
  | {
      /** Loại lặp được chọn. */
      readonly kind: "cron";
      /** Biểu thức cron thay thế. */
      cron: CronInput;
    };

/** Tên tác vụ và câu nhắc thay thế đi kèm một yêu cầu so-sánh-và-sửa. */
export interface ScheduleUpdateContent {
  /** Tên tác vụ tối đa 120 ký tự, khác rỗng sau khi cắt khoảng trắng; bỏ trống thì giữ tên đã lưu. */
  readonly title?: string;
  /** Câu nhắc khác rỗng sau khi cắt khoảng trắng; bỏ trống thì giữ câu đã lưu. */
  readonly prompt?: string;
}

/** Yêu cầu so-sánh-và-sửa trong ràng buộc Session gốc. */
export interface ScheduleUpdateRequest extends ScheduleDeleteRequest, ScheduleUpdateContent {
  /** Bản ghi đầy đủ quan sát được khi bắt đầu sửa, gồm cả đích đã cam kết. */
  readonly expected: ScheduleRecord;
  /** Thời gian mới; loại của nó có thể khác loại bản ghi đã lưu, và bỏ trống thì giữ đích đã cam kết. */
  readonly change?: ScheduleTimingChange;
}

/** Kết quả so-sánh-và-sửa không biến đổi dữ liệu: không có, đã kết thúc, hoặc đã đổi từ lúc đọc. */
export interface ScheduleUpdateMiss {
  /** Danh tính tác vụ được yêu cầu sửa. */
  readonly id: ScheduleId;
  /** Không sửa gì. */
  readonly updated: false;
  /** Mã lý do không sửa được. */
  readonly code: "schedule_not_found" | "schedule_ended" | "schedule_conflict";
}

/** Bản ghi hiện tại sau khi sửa, kết quả tra cứu/xung đột không biến đổi, hoặc tên/câu nhắc/thời gian không hợp lệ. */
export type ScheduleUpdateResult =
  | {
      /** Danh tính tác vụ đã xử lý. */
      readonly id: ScheduleId;
      /** Có thay đổi bền hay không. */
      readonly updated: boolean;
      /** Bản ghi cam kết sau khi xử lý. */
      readonly record: ScheduleRecord;
    }
  | ScheduleUpdateMiss
  | ScheduleToolError;

/** Giá trị chuẩn tắc của `schedule_update`: bản ghi đã cam kết dưới dạng khung nhìn, hoặc kết quả tra cứu/xung đột không biến đổi. */
export type ScheduleUpdateValue = ScheduleView | ScheduleUpdateMiss | ScheduleToolError;

/** Truy vấn lịch sử giao đã lưu, giới hạn tường minh, trong một ràng buộc Session. */
export interface ScheduleDeliveryHistoryRequest extends ScheduleDeleteRequest {
  /** Cỡ trang bắt buộc, số nguyên an toàn từ 1 tới 100. */
  limit: number;
  /** Danh tính message của mục cũ nhất ở trang trước; bị loại khỏi trang này. */
  before?: MessageId;
}

/** Giới hạn cấu hình áp dụng khi nối thêm biên nhận giao của một tác vụ. */
export interface DeliveryRetentionBounds {
  /** Cửa sổ lưu giữ, tính bằng ngày, đo lùi từ lúc biên nhận được nối. */
  readonly days: number;
  /** Số bản ghi tối đa giữ lại cho mỗi tác vụ; bản mới nhất sống sót. */
  readonly records: number;
}

/** Lịch sử giao đã lưu, mới nhất trước, hoặc kết quả tra cứu tác vụ/con trỏ không biến đổi. */
export type ScheduleDeliveryHistoryResult =
  | {
      /** Danh tính tác vụ đã đọc lịch sử. */
      readonly id: ScheduleId;
      /** Trang lịch sử đã cắt, mới nhất trước, theo thứ tự ghi. */
      readonly records: ScheduleDeliveryRecord[];
      /** Có thể còn bản ghi giao cũ hơn không đọc được; biên nhận thiếu không bao giờ được dựng lại. */
      readonly earlierRecordsUnavailable: boolean;
      /** Chỉ đúng sau khi một lần nối đã bỏ bớt bản ghi đã lưu; thiếu bằng chứng cũ thì sai. */
      readonly earlierRecordsPruned: boolean;
      /** Cấu hình lưu giữ hiện tại của Host, cũng là cấu hình bộ ghi giao dùng. */
      readonly retention: DeliveryRetentionBounds;
      /** Danh tính message cũ nhất trong trang, chỉ có khi còn bản ghi cũ hơn. */
      readonly nextBefore?: MessageId;
    }
  | {
      /** Danh tính tác vụ được yêu cầu. */
      readonly id: ScheduleId;
      /** Mã lý do không đọc được. */
      readonly code: "schedule_not_found" | "delivery_cursor_not_found";
    };

/** Kết quả gộp thuần: giữ thứ tự tạo của các bản ghi đang hoạt động và mọi danh tính đã dùng. */
export interface FoldedSchedules {
  /** Bản ghi đang hoạt động, theo đúng thứ tự tạo ban đầu. */
  readonly active: readonly LegacyScheduleRecord[];
  /** Mọi danh tính từng được tạo trong đoạn cục bộ phiên này. */
  readonly seenIds: readonly ScheduleId[];
}

/** Một quyết định lặp chỉ-lấy-lần-mới-nhất, suy ra mà không liệt kê tồn đọng. */
export interface RecurringOccurrence {
  /** Lần tới hạn muộn nhất tại thời điểm quyết định. */
  readonly occurrenceAt: string;
  /** Đích hợp lệ đầu tiên sau thời điểm quyết định, hoặc đã cạn. */
  readonly nextScheduledAt?: string;
}

/** Cấu hình cho miền Schedule của Host. */
export interface Config {
  /**
   * Cửa sổ lịch sử giao giữ cho mỗi tác vụ, tính bằng ngày; bỏ trống mặc định 30.
   * Việc cắt bớt xảy ra khi nối một biên nhận, và `lastDelivery` luôn được giữ.
   */
  deliveryHistoryDays?: number;
  /**
   * Số bản ghi giao giữ cho mỗi tác vụ; bỏ trống mặc định 200. Giới hạn nào chặt hơn thì
   * thắng, và các bản ghi mới nhất sống sót.
   */
  deliveryHistoryRecords?: number;
}

/**
 * Nguồn message của một nhắc hẹn do Host giao, khai theo CẤU TRÚC.
 *
 * Bản gốc mở rộng `MessageSourceMap` của kernel với đúng hình dạng này; bản viết lại không
 * augment module nên khai thành một bí danh kiểu dùng được ở chỗ cần nguồn message.
 */
export type ScheduleMessageSource = { readonly kind: "schedule" } & ContextFormed;

/**
 * Dấu hoạt động phiên "còn nhắc hẹn đang bật", khai theo CẤU TRÚC.
 *
 * Bản gốc mở rộng `SessionActivityKindMap` của `dsh-workspace`; bản viết lại khai hình dạng
 * tương đương để nơi dựng hoạt động phiên dùng lại mà không augment module.
 */
export interface ScheduleSessionActivity {
  /** Session còn ít nhất một nhắc hẹn đang hoạt động. */
  readonly schedule: true;
}
