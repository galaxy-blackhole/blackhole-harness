/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mã hoá/giải mã BỀN của schedule: hằng số giao thức v1, hai lớp lỗi, thương hiệu ScheduleId,
 *      kiểm tra tên tác vụ, chuẩn hoá vùng IANA/thứ/giờ, và giải mã nghiêm ngặt bản ghi Host +
 *      payload `schedule/change`. Port 1:1 domain.js dòng 1–642 của @deepseek-ai/dsh-schedule.
 *
 * Danh sách export:
 *   · Hằng số: SCHEDULE_CHANGE_VERSION · MIN_EVERY_INTERVAL_SECONDS · MAX_TITLE_LENGTH ·
 *     CRON_SEARCH_HORIZON_YEARS · MIN_FOUR_DIGIT_YEAR_MS · MAX_FOUR_DIGIT_YEAR_MS · REQUIRED_TITLE_MESSAGE
 *   · Lỗi: ScheduleLogError · ScheduleInputError
 *   · Danh tính: ScheduleId (hàm đóng dấu)
 *   · Tên tác vụ: scheduleTitle · decodeStoredTitle
 *   · Vùng giờ/giờ: canonicalizeTimeZone · weeklyTime · dailyTime · localClockTime · normalizeWeekdays ·
 *     milliseconds · groupNumber · calendarEpoch · parseLocalAt · localInstant · resolveLocalInstant ·
 *     parseOffsetInstant · futureInstant
 *   · Giải mã: decodeScheduleRecord · decodeScheduleChange · decodeLegacyScheduleRecord ·
 *     decodeScheduleRecordTitle (private) · decodeHistoricalRecordTitle (private) · decodeId · decodeInstant
 *   · Tiện ích dùng chung: isRecord · hasExactKeys · hasExactKeysWithOptional · rethrowLogError
 */

import { Temporal } from "@js-temporal/polyfill";
import { parseCronExpression } from "./records.ts";
import type {
  AfterScheduleRecord,
  AtScheduleRecord,
  CronScheduleRecord,
  DailyScheduleRecord,
  EveryScheduleRecord,
  LegacyAfterScheduleRecord,
  LegacyAtScheduleRecord,
  LegacyEveryScheduleRecord,
  LegacyScheduleRecord,
  LocalAtInput,
  ScheduleChange,
  ScheduleId as ScheduleIdType,
  ScheduleRecord,
  WeeklyScheduleRecord,
} from "./types.ts";

/** Phiên bản giao thức Schedule bền mà gói này hiện thực. */
export const SCHEDULE_CHANGE_VERSION = 1;

/** Ngưỡng dưới cố định v1 cho một nhắc hẹn lặp đều. */
export const MIN_EVERY_INTERVAL_SECONDS = 60;

/** Ngưỡng trên cố định v1 cho tên tác vụ đã lưu. */
export const MAX_TITLE_LENGTH = 120;

/**
 * Chặng xa nhất của phép dò ngày cron, tính bằng năm, theo cả hai chiều.
 *
 * Chu kỳ nhuận và căn thứ của lịch Gregory lùi (proleptic) lặp lại mỗi 400 năm, nên một
 * quy tắc khớp được bất kỳ ngày địa phương nào sẽ có chỗ khớp trong cửa sổ này; đi xa hơn
 * chỉ có thể chạm tới quy tắc không bao giờ khớp. Chặn chặng dò giữ chi phí tạo và quyết
 * định của một quy tắc hợp lệ nhưng không thoả mãn ở mức cố định, thay vì liệt kê dần các
 * ngày ứng viên tới trần năm bốn chữ số.
 */
export const CRON_SEARCH_HORIZON_YEARS = 400;

/** Mốc UTC sớm nhất còn dùng được năm bốn chữ số. */
export const MIN_FOUR_DIGIT_YEAR_MS = Date.parse("0001-01-01T00:00:00.000Z");

/** Mốc UTC muộn nhất còn dùng được năm bốn chữ số. */
export const MAX_FOUR_DIGIT_YEAR_MS = Date.parse("9999-12-31T23:59:59.999Z");

/** Hồ sơ RFC 3339 UTC chuẩn tắc với năm bốn chữ số (không chấp nhận năm 0000). */
const UTC_INSTANT = /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;

/** Hồ sơ RFC 3339 có offset số tường minh nằm ngay trong đầu vào. */
const OFFSET_INSTANT = new RegExp(String.raw `^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})`
  + String.raw `T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})`
  + String.raw `(?:\.(?<fraction>\d{1,3}))?(?<zone>Z|(?<sign>[+-])`
  + String.raw `(?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$`);

/** Hồ sơ ngày lịch ISO bốn chữ số. */
const LOCAL_DATE = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

/** Hồ sơ giờ tường địa phương với 1–3 chữ số lẻ tuỳ chọn. */
const LOCAL_TIME = /^(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.(?<fraction>\d{1,3}))?$/;

/** Hồ sơ giờ đồng hồ địa phương nghiêm ngặt mà bộ chọn giờ tường dùng. */
const LOCAL_CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/;

/** Hồ sơ tên vùng IANA dạng Area/Location. */
const IANA_ZONE = /^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+)+$/;

/** Lỗi do dữ liệu Schedule bền bị hỏng hoặc vi phạm chuyển trạng thái. */
export class ScheduleLogError extends Error {
  /** Mã lỗi máy đọc được, ổn định. */
  readonly code: "corrupt_schedule_log" = "corrupt_schedule_log";

  /**
   * Dựng một lỗi sổ bền.
   * Nhận: message — bất biến của gói đã bị vi phạm.
   * Trả: thực thể lỗi đã đặt tên lớp; không trả giá trị.
   */
  constructor(message: string) {
    super(message);
    this.name = "ScheduleLogError";
  }
}

/** Mã lỗi công khai của một lần nhập Schedule không thể thành bản ghi. */
type ScheduleInputCode =
  | "invalid_prompt"
  | "invalid_selector"
  | "invalid_rule"
  | "invalid_time_zone"
  | "not_future"
  | "time_out_of_range"
  | "frequency_too_high"
  | "subagent_session";

/** Lỗi do quy tắc Schedule hoặc Session đích do model cung cấp mà không thể thành bản ghi. */
export class ScheduleInputError extends Error {
  /** Mã lỗi công khai, ổn định, của Schedule. */
  readonly code: ScheduleInputCode;

  /**
   * Dựng một lỗi nhập ổn định.
   * Nhận: code — dấu phân loại lỗi công khai; message — câu chẩn đoán công khai ổn định;
   *       options — nguyên nhân hiện thực được bọc, tuỳ chọn.
   * Trả: thực thể lỗi đã đặt tên lớp và mã; không trả giá trị.
   */
  constructor(code: ScheduleInputCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ScheduleInputError";
    this.code = code;
  }
}

/**
 * Đóng dấu thương hiệu cho một id cục bộ phiên mà không đổi giá trị lúc chạy.
 * Nhận: value — id cục bộ phiên thô.
 * Trả: đúng chuỗi đó mang thương hiệu Schedule.
 */
export function ScheduleId(value: string): ScheduleIdType {
  return value as ScheduleIdType;
}

/**
 * Cho biết một giá trị chưa biết có phải object không phải mảng hay không.
 * Nhận: value — giá trị chưa biết cần kiểm.
 * Trả: true khi value là object khác null và không phải mảng.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Đòi ĐÚNG tập khoá của một object bền.
 * Nhận: value — object đã biết là record; expected — danh sách khoá bắt buộc và duy nhất.
 * Trả: true khi có đủ mọi khoá và không thừa khoá nào.
 */
export function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const allowed = new Set(expected);
  return expected.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}

/**
 * Đòi các khoá bền bắt buộc nhưng vẫn nhận thêm thành viên tuỳ chọn.
 * Nhận: value — object đã biết là record; required — khoá bắt buộc; optional — khoá được phép thêm.
 * Trả: true khi đủ khoá bắt buộc và mọi khoá đều nằm trong required ∪ optional.
 */
export function hasExactKeysWithOptional(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => key in value) && Object.keys(value).every((key) => allowed.has(key));
}

/** Câu chẩn đoán ổn định cho tên tác vụ thiếu hoặc rỗng sau khi cắt khoảng trắng. */
export const REQUIRED_TITLE_MESSAGE = "title is required and must be non-empty after trimming.";

/**
 * Kiểm tên tác vụ do lúc tạo cung cấp.
 *
 * Lúc tạo bắt buộc phải có tên tường minh: giá trị thiếu, rỗng sau khi cắt khoảng trắng, hoặc
 * quá dài sẽ ném lỗi thay vì suy ra tên từ câu nhắc.
 * Nhận: title — tên tác vụ do lúc tạo cung cấp.
 * Trả: tên đã cắt khoảng trắng; tên không hợp lệ ném ScheduleInputError.
 */
export function scheduleTitle(title: string): string {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new ScheduleInputError("invalid_prompt", REQUIRED_TITLE_MESSAGE);
  }
  const normalized = title.trim();
  if (normalized.length > MAX_TITLE_LENGTH) {
    throw new ScheduleInputError("invalid_prompt", `title must be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  return normalized;
}

/**
 * Kiểm một tên tác vụ bắt buộc tại biên bền.
 *
 * Chỉ đọc bản ghi ghi sau khi tên trở thành bắt buộc: tên thiếu, rỗng sau khi cắt khoảng trắng,
 * chưa cắt khoảng trắng, hoặc quá dài đều không hợp lệ, và không suy ra tên nào từ câu nhắc.
 * Nhận: value — trường tên chưa tin cậy từ dữ liệu bền.
 * Trả: tên đã lưu; tên không hợp lệ ném ScheduleLogError.
 */
export function decodeStoredTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ScheduleLogError(REQUIRED_TITLE_MESSAGE);
  }
  if (value.length > MAX_TITLE_LENGTH) {
    throw new ScheduleLogError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
  }
  if (value.trim() !== value) {
    throw new ScheduleLogError("title must be a trimmed string");
  }
  return value;
}

/**
 * Giải mã tên bắt buộc của một bản ghi Host bền, rồi đòi đúng tập khoá của nó.
 *
 * Tên được giải mã trước để bản ghi thiếu khoá báo chẩn đoán về tên thay vì danh sách khoá.
 * Nhận: value — bản ghi bền chưa tin cậy đã biết là object; expected — đúng các khoá bắt buộc,
 *       gồm cả `title`; message — câu chẩn đoán nêu các khoá bắt buộc của bản ghi.
 * Trả: tên đã lưu; tên hoặc tập khoá không hợp lệ ném ScheduleLogError.
 */
function decodeRecordTitle(value: Record<string, unknown>, expected: readonly string[], message: string): string {
  const title = decodeStoredTitle(value["title"]);
  if (!hasExactKeys(value, expected)) throw new ScheduleLogError(message);
  return title;
}

/**
 * Giải mã tên đã lưu của một bản ghi tạo trong `schedule/change` lịch sử.
 *
 * Sự kiện phiên bản 1 ghi trước khi có tên không có thành viên `title`, nên tập khoá được đòi
 * mà không tính nó và thành viên vắng mặt giải mã thành undefined. Tên có mặt vẫn phải đúng
 * dạng chuẩn tắc đã lưu.
 * Nhận: value — bản ghi bền chưa tin cậy đã biết là object; expected — đúng các khoá bản ghi có
 *       thể mang, `title` là tuỳ chọn trong đó; message — câu chẩn đoán nêu các khoá của bản ghi.
 * Trả: tên đã lưu, hoặc undefined khi bản ghi lịch sử có trước tên.
 */
function decodeHistoricalRecordTitle(
  value: Record<string, unknown>,
  expected: readonly string[],
  message: string,
): string | undefined {
  const keys = expected.filter((key) => key !== "title");
  if (!hasExactKeysWithOptional(value, keys, ["title"])) throw new ScheduleLogError(message);
  return value["title"] === undefined ? undefined : decodeStoredTitle(value["title"]);
}

/**
 * Kiểm một id cục bộ phiên ổn định tại biên bền.
 * Nhận: value — id chưa tin cậy từ dữ liệu bền.
 * Trả: id đã đóng dấu thương hiệu; giá trị không hợp lệ ném ScheduleLogError.
 */
export function decodeId(value: unknown): ScheduleIdType {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new ScheduleLogError("schedule id must be a non-empty string without surrounding whitespace");
  }
  return ScheduleId(value);
}

/**
 * Kiểm một thời điểm UTC chuẩn tắc với năm bốn chữ số.
 * Nhận: value — thời điểm chưa tin cậy từ dữ liệu bền.
 * Trả: đúng chuỗi thời điểm đó; giá trị không hợp lệ hoặc không có thật ném ScheduleLogError.
 */
export function decodeInstant(value: unknown): string {
  if (typeof value !== "string" || !UTC_INSTANT.test(value)) {
    throw new ScheduleLogError("scheduledAt must be a canonical four-digit-year RFC 3339 UTC instant");
  }
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== value) {
    throw new ScheduleLogError("scheduledAt is not a real UTC calendar instant");
  }
  return value;
}

/**
 * Đọc một nhóm bắt buộc của biểu thức chính quy dưới dạng số.
 * Nhận: groups — các nhóm có tên của lần khớp; name — tên nhóm cần đọc.
 * Trả: giá trị số của nhóm; nhóm vắng mặt ném ScheduleInputError.
 */
export function groupNumber(groups: Record<string, string | undefined>, name: string): number {
  const value = groups[name];
  /* v8 ignore next -- biểu thức cố định khớp thành công luôn cung cấp đủ mọi nhóm được hỏi. */
  if (value === undefined) throw new ScheduleInputError("invalid_rule", "The at value has an invalid shape.");
  return Number(value);
}

/** Các trường lịch chính xác dùng để dựng một mốc UTC mà không cho phép chuẩn hoá. */
export interface CalendarParts {
  /** Năm lịch bốn chữ số. */
  readonly year: number;
  /** Tháng 1–12. */
  readonly month: number;
  /** Ngày trong tháng. */
  readonly day: number;
  /** Giờ 0–23. */
  readonly hour: number;
  /** Phút 0–59. */
  readonly minute: number;
  /** Giây 0–59. */
  readonly second: number;
  /** Mili-giây 0–999. */
  readonly millisecond: number;
}

/**
 * Đổi các trường lịch chính xác thành mốc kiểu UTC, đồng thời từ chối mọi chuẩn hoá.
 * Nhận: parts — các trường lịch đã tách.
 * Trả: mốc epoch mili-giây; trường không phải ngày giờ ISO có thật ném ScheduleInputError.
 */
export function calendarEpoch(parts: CalendarParts): number {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  value.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
  const epoch = value.getTime();
  if (
    !Number.isFinite(epoch) ||
    value.getUTCFullYear() !== parts.year ||
    value.getUTCMonth() + 1 !== parts.month ||
    value.getUTCDate() !== parts.day ||
    value.getUTCHours() !== parts.hour ||
    value.getUTCMinutes() !== parts.minute ||
    value.getUTCSeconds() !== parts.second ||
    value.getUTCMilliseconds() !== parts.millisecond
  ) {
    throw new ScheduleInputError("invalid_rule", "The at value must be a real ISO calendar date and time.");
  }
  return epoch;
}

/**
 * Chuẩn hoá phần giây lẻ 1–3 chữ số tuỳ chọn thành mili-giây.
 * Nhận: value — chuỗi chữ số lẻ, hoặc undefined khi đầu vào không có phần lẻ.
 * Trả: số mili-giây (0 khi không có phần lẻ).
 */
export function milliseconds(value: string | undefined): number {
  return value === undefined ? 0 : Number(value.padEnd(3, "0"));
}

/**
 * Đòi một đích UTC an toàn, biểu diễn được, và thực sự ở tương lai.
 * Nhận: epoch — mốc đích tính bằng mili-giây; now — mốc hiện tại của cùng một lần lấy đồng hồ.
 * Trả: chuỗi RFC 3339 UTC chuẩn tắc; ngoài tầm hoặc không ở tương lai ném ScheduleInputError.
 */
export function futureInstant(epoch: number, now: number): string {
  if (
    !Number.isSafeInteger(now) ||
    !Number.isSafeInteger(epoch) ||
    epoch < MIN_FOUR_DIGIT_YEAR_MS ||
    epoch > MAX_FOUR_DIGIT_YEAR_MS
  ) {
    throw new ScheduleInputError(
      "time_out_of_range",
      "The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.",
    );
  }
  if (epoch <= now) {
    throw new ScheduleInputError("not_future", "The scheduled time must be strictly in the future.");
  }
  const instant = new Date(epoch).toISOString();
  /* v8 ignore next -- một Date nguyên, trong tầm luôn định dạng ra hồ sơ UTC chuẩn tắc. */
  if (!UTC_INSTANT.test(instant)) {
    throw new ScheduleInputError(
      "time_out_of_range",
      "The scheduled time must be representable as a four-digit-year RFC 3339 UTC instant.",
    );
  }
  return instant;
}

/**
 * Phân tích một thời điểm RFC 3339 nghiêm ngặt có offset số nằm ngay trong đầu vào.
 * Nhận: value — chuỗi thời điểm ứng viên.
 * Trả: mốc epoch mili-giây; hình dạng, lịch, hoặc offset không hợp lệ ném ScheduleInputError.
 */
export function parseOffsetInstant(value: string): number {
  const match = OFFSET_INSTANT.exec(value);
  const groups = match?.groups;
  if (groups === undefined) {
    throw new ScheduleInputError(
      "invalid_rule",
      "at must use YYYY-MM-DDTHH:mm:ss with optional 1-3 digit fractional seconds and an explicit Z or numeric offset.",
    );
  }
  const parts: CalendarParts = {
    year: groupNumber(groups, "year"),
    month: groupNumber(groups, "month"),
    day: groupNumber(groups, "day"),
    hour: groupNumber(groups, "hour"),
    minute: groupNumber(groups, "minute"),
    second: groupNumber(groups, "second"),
    millisecond: milliseconds(groups["fraction"]),
  };
  if (parts.year === 0 || parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new ScheduleInputError("invalid_rule", "The at value must be a real ISO calendar date and time.");
  }
  const localEpoch = calendarEpoch(parts);
  if (groups["zone"] === "Z") return localEpoch;
  const offsetHour = groupNumber(groups, "offsetHour");
  const offsetMinute = groupNumber(groups, "offsetMinute");
  if (offsetHour > 23 || offsetMinute > 59 || (groups["sign"] === "-" && offsetHour === 0 && offsetMinute === 0)) {
    throw new ScheduleInputError("invalid_rule", "The at numeric offset is invalid.");
  }
  const direction = groups["sign"] === "+" ? 1 : -1;
  return localEpoch - direction * (offsetHour * 60 + offsetMinute) * 60_000;
}

/**
 * Kiểm và chuẩn hoá một bộ chọn vùng giờ IANA thô.
 * Nhận: value — tên ứng viên `UTC` hoặc IANA Area/Location.
 * Trả: tên IANA chuẩn tắc của runtime; tên không hợp lệ ném ScheduleInputError.
 */
export function canonicalizeTimeZone(value: string): string {
  if (value.length === 0 || value.trim() !== value || (value !== "UTC" && !IANA_ZONE.test(value))) {
    throw new ScheduleInputError("invalid_time_zone", "time_zone must be UTC or a valid IANA Area/Location name.");
  }
  let canonical: string;
  try {
    canonical = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch (error) {
    throw new ScheduleInputError("invalid_time_zone", "time_zone must be UTC or a valid IANA Area/Location name.", {
      cause: error,
    });
  }
  /* v8 ignore next -- Intl trả về đúng vùng được hỏi hoặc một bí danh chuẩn tắc IANA. */
  if (canonical !== "UTC" && !IANA_ZONE.test(canonical)) {
    throw new ScheduleInputError("invalid_time_zone", "time_zone must resolve to UTC or an IANA Area/Location name.");
  }
  return canonical;
}

/**
 * Phân tích các trường lịch địa phương nghiêm ngặt mà không hỏi vùng giờ của tiến trình.
 * Nhận: value — ngày, giờ, và vùng giờ địa phương có cấu trúc.
 * Trả: các trường lịch đã kiểm; hình dạng hoặc ngày giờ không thật ném ScheduleInputError.
 */
export function parseLocalAt(value: LocalAtInput): CalendarParts {
  const dateMatch = LOCAL_DATE.exec(value.date);
  const timeMatch = LOCAL_TIME.exec(value.time);
  const date = dateMatch?.groups;
  const time = timeMatch?.groups;
  if (date === undefined || time === undefined) {
    throw new ScheduleInputError(
      "invalid_rule",
      "Local at requires date YYYY-MM-DD and time HH:mm:ss with optional one-to-three digit milliseconds.",
    );
  }
  const parts: CalendarParts = {
    year: groupNumber(date, "year"),
    month: groupNumber(date, "month"),
    day: groupNumber(date, "day"),
    hour: groupNumber(time, "hour"),
    minute: groupNumber(time, "minute"),
    second: groupNumber(time, "second"),
    millisecond: milliseconds(time["fraction"]),
  };
  if (parts.year === 0 || parts.hour > 23 || parts.minute > 59 || parts.second > 59) {
    throw new ScheduleInputError("invalid_rule", "The local at value must be a real ISO calendar date and time.");
  }
  calendarEpoch(parts);
  return parts;
}

/**
 * Chỉ lấy thời điểm chồng lấn SỚM HƠN; một khoảng trống làm hỏng vòng khứ hồi trường địa phương.
 * Nhận: local — giờ tường địa phương cần giải; timeZone — vùng IANA đã chuẩn hoá.
 * Trả: mốc epoch mili-giây, hoặc undefined khi giờ tường đó không tồn tại trong vùng.
 */
export function localInstant(local: Temporal.PlainDateTime, timeZone: string): number | undefined {
  const zoned = local.toZonedDateTime(timeZone, { disambiguation: "earlier" });
  return zoned.toPlainDateTime().equals(local) ? zoned.epochMilliseconds : undefined;
}

/**
 * Giải một đích địa phương một lần, từ chối giờ tường không tồn tại.
 * Nhận: parts — các trường lịch địa phương đã kiểm; timeZone — vùng IANA đã chuẩn hoá.
 * Trả: mốc epoch mili-giây; giờ tường không tồn tại ném ScheduleInputError.
 */
export function resolveLocalInstant(parts: CalendarParts, timeZone: string): number {
  const target = localInstant(Temporal.PlainDateTime.from(parts, { overflow: "reject" }), timeZone);
  if (target === undefined) {
    throw new ScheduleInputError("invalid_rule", "The local at time does not exist in the selected time zone.");
  }
  return target;
}

/**
 * Giải mã đúng hình dạng bản ghi `after` phiên bản 1.
 * Nhận: value — giá trị bền chưa tin cậy.
 * Trả: bản ghi `after` đã đóng băng (không có `title` khi sự kiện lịch sử thiếu nó);
 *      trường không hợp lệ ném ScheduleLogError.
 */
function decodeAfterRecord(value: unknown): LegacyAfterScheduleRecord {
  /* v8 ignore next -- decodeLegacyScheduleRecord đã từ chối giá trị không phải object trước khi tới đây. */
  if (!isRecord(value)) throw new ScheduleLogError("after schedule must be an object");
  const title = decodeHistoricalRecordTitle(
    value,
    ["id", "kind", "title", "prompt", "afterSeconds", "scheduledAt"],
    "after schedule must contain exactly id, kind, title, prompt, afterSeconds, and scheduledAt",
  );
  const prompt = value["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.trim() !== prompt) {
    throw new ScheduleLogError("after prompt must be non-empty and already trimmed");
  }
  const afterSeconds = value["afterSeconds"] as number;
  if (!Number.isSafeInteger(afterSeconds) || afterSeconds <= 0) {
    throw new ScheduleLogError("afterSeconds must be a positive safe integer");
  }
  return Object.freeze({
    id: decodeId(value["id"]),
    kind: "after",
    ...(title === undefined ? {} : { title }),
    prompt,
    afterSeconds: afterSeconds,
    scheduledAt: decodeInstant(value["scheduledAt"]),
  });
}

/**
 * Giải mã đúng hình dạng bản ghi một lần tuyệt đối phiên bản 1.
 * Nhận: value — giá trị bền chưa tin cậy.
 * Trả: bản ghi `at` đã đóng băng (không có `title` khi sự kiện lịch sử thiếu nó);
 *      trường không hợp lệ ném ScheduleLogError.
 */
function decodeAtRecord(value: unknown): LegacyAtScheduleRecord {
  /* v8 ignore next -- decodeLegacyScheduleRecord đã từ chối giá trị không phải object trước khi tới đây. */
  if (!isRecord(value)) throw new ScheduleLogError("at schedule must be an object");
  const title = decodeHistoricalRecordTitle(
    value,
    ["id", "kind", "title", "prompt", "scheduledAt"],
    "at schedule must contain exactly id, kind, title, prompt, and scheduledAt",
  );
  const prompt = value["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.trim() !== prompt) {
    throw new ScheduleLogError("at prompt must be non-empty and already trimmed");
  }
  return Object.freeze({
    id: decodeId(value["id"]),
    kind: "at",
    ...(title === undefined ? {} : { title }),
    prompt,
    scheduledAt: decodeInstant(value["scheduledAt"]),
  });
}

/**
 * Giải mã đúng hình dạng bản ghi lặp đều phiên bản 1.
 * Nhận: value — giá trị bền chưa tin cậy.
 * Trả: bản ghi `every` đã đóng băng (không có `title` khi sự kiện lịch sử thiếu nó);
 *      trường không hợp lệ ném ScheduleLogError.
 */
function decodeEveryRecord(value: unknown): LegacyEveryScheduleRecord {
  /* v8 ignore next -- decodeLegacyScheduleRecord đã từ chối giá trị không phải object trước khi tới đây. */
  if (!isRecord(value)) throw new ScheduleLogError("every schedule must be an object");
  const title = decodeHistoricalRecordTitle(
    value,
    ["id", "kind", "title", "prompt", "everySeconds", "scheduledAt"],
    "every schedule must contain exactly id, kind, title, prompt, everySeconds, and scheduledAt",
  );
  const prompt = value["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.trim() !== prompt) {
    throw new ScheduleLogError("every prompt must be non-empty and already trimmed");
  }
  const everySeconds = value["everySeconds"] as number;
  const interval = typeof everySeconds === "number" ? everySeconds * 1_000 : Number.NaN;
  if (
    !Number.isSafeInteger(everySeconds) ||
    everySeconds < MIN_EVERY_INTERVAL_SECONDS ||
    !Number.isSafeInteger(interval)
  ) {
    throw new ScheduleLogError(`everySeconds must be a safe integer of at least ${MIN_EVERY_INTERVAL_SECONDS}`);
  }
  return Object.freeze({
    id: decodeId(value["id"]),
    kind: "every",
    ...(title === undefined ? {} : { title }),
    prompt,
    everySeconds: everySeconds,
    scheduledAt: decodeInstant(value["scheduledAt"]),
  });
}

/**
 * Phân tích một giờ đồng hồ địa phương nghiêm ngặt dùng chung cho các bộ chọn giờ tường.
 * Nhận: value — giờ ứng viên `HH:mm:ss` với 1–3 chữ số lẻ tuỳ chọn; selector — tên bộ chọn
 *       công khai dùng trong câu chẩn đoán.
 * Trả: giờ trơn đã phân tích; đầu vào không hợp lệ ném ScheduleInputError.
 */
export function localClockTime(value: string, selector: string): Temporal.PlainTime {
  if (!LOCAL_CLOCK_TIME.test(value)) {
    throw new ScheduleInputError(
      "invalid_rule",
      `${selector}.time must use HH:mm:ss with optional 1-3 fractional digits, without leap seconds or 24:00.`,
    );
  }
  return Temporal.PlainTime.from(value);
}

/**
 * Phân tích giờ tường của bộ chọn `daily`.
 * Nhận: value — giờ ứng viên `HH:mm:ss` với 1–3 chữ số lẻ tuỳ chọn.
 * Trả: giờ trơn đã phân tích; đầu vào không hợp lệ ném ScheduleInputError.
 */
export function dailyTime(value: string): Temporal.PlainTime {
  return localClockTime(value, "daily");
}

/**
 * Phân tích một giờ đồng hồ địa phương nghiêm ngặt mà bộ chọn `weekly` chấp nhận.
 * Nhận: value — giờ ứng viên `HH:mm:ss` với 1–3 chữ số lẻ tuỳ chọn.
 * Trả: giờ trơn đã phân tích; đầu vào không hợp lệ ném ScheduleInputError.
 */
export function weeklyTime(value: string): Temporal.PlainTime {
  return localClockTime(value, "weekly");
}

/**
 * Ném lại giá trị bền đã có kiểu mà không bọc lại chẩn đoán dữ liệu đã lưu.
 * Nhận: error — ngoại lệ vừa bắt trong một lần giải mã.
 * Trả: không trả; luôn ném (ScheduleLogError giữ nguyên, còn lại bọc thành ScheduleLogError).
 */
export function rethrowLogError(error: unknown): never {
  /* v8 ignore next -- mọi lần gọi được bọc đều ném ScheduleInputError, nên nhánh chuyển tiếp này không chạy. */
  if (error instanceof ScheduleLogError) throw error;
  throw new ScheduleLogError(String(error));
}

/**
 * Giải mã một quy tắc `daily` của Host mà không giải lại đích UTC đã cam kết.
 * Nhận: value — bản ghi bền chưa tin cậy đã nhận diện là daily.
 * Trả: bản ghi daily đã đóng băng, tách rời; trường không hợp lệ ném ScheduleLogError.
 */
function decodeDailyRecord(value: Record<string, unknown>): DailyScheduleRecord {
  const title = decodeRecordTitle(
    value,
    ["id", "kind", "title", "prompt", "time", "timeZone", "scheduledAt"],
    "daily schedule must contain exactly id, kind, title, prompt, time, timeZone, and scheduledAt",
  );
  const prompt = value["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.trim() !== prompt) {
    throw new ScheduleLogError("daily prompt must be non-empty and already trimmed");
  }
  const time = value["time"];
  const timeZone = value["timeZone"];
  if (typeof time !== "string" || typeof timeZone !== "string") {
    throw new ScheduleLogError("daily time and timeZone must be strings");
  }
  let normalized: string;
  try {
    normalized = dailyTime(time).toString({ fractionalSecondDigits: 3 });
    canonicalizeTimeZone(timeZone);
  } catch (error) {
    rethrowLogError(error);
  }
  if (time !== normalized) throw new ScheduleLogError("daily time must be normalized to HH:mm:ss.SSS");
  return Object.freeze({
    id: decodeId(value["id"]),
    kind: "daily",
    title,
    prompt,
    time,
    timeZone,
    scheduledAt: decodeInstant(value["scheduledAt"]),
  });
}

/**
 * Chuẩn hoá tập thứ ISO tường minh của một quy tắc `weekly`.
 * Nhận: weekdays — các giá trị thứ chưa tin cậy.
 * Trả: mảng thứ duy nhất, tăng dần, đã đóng băng, từ 1 (Thứ Hai) tới 7 (Chủ Nhật);
 *      tập không hợp lệ ném ScheduleInputError.
 */
export function normalizeWeekdays(weekdays: unknown): number[] {
  if (!Array.isArray(weekdays) || weekdays.length === 0) {
    throw new ScheduleInputError("invalid_rule", "weekly.weekdays must be a non-empty array of ISO weekday numbers.");
  }
  const unique = new Set<number>();
  for (const weekday of weekdays) {
    if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new ScheduleInputError(
        "invalid_rule",
        "Each weekly.weekdays entry must be an integer from 1 (Monday) through 7 (Sunday).",
      );
    }
    if (unique.has(weekday)) {
      throw new ScheduleInputError("invalid_rule", `weekly.weekdays must not repeat weekday ${weekday}.`);
    }
    unique.add(weekday);
  }
  const ordered = [...unique].sort((left, right) => left - right);
  Object.freeze(ordered);
  return ordered;
}

/**
 * Giải mã một quy tắc `weekly` của Host mà không giải lại đích UTC đã cam kết.
 * Nhận: value — bản ghi bền chưa tin cậy đã nhận diện là weekly.
 * Trả: bản ghi weekly đã đóng băng, tách rời; trường không hợp lệ ném ScheduleLogError.
 */
function decodeWeeklyRecord(value: Record<string, unknown>): WeeklyScheduleRecord {
  const title = decodeRecordTitle(
    value,
    ["id", "kind", "title", "prompt", "time", "timeZone", "weekdays", "scheduledAt"],
    "weekly schedule must contain exactly id, kind, title, prompt, time, timeZone, weekdays, and scheduledAt",
  );
  const prompt = value["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.trim() !== prompt) {
    throw new ScheduleLogError("weekly prompt must be non-empty and already trimmed");
  }
  const time = value["time"];
  const timeZone = value["timeZone"];
  if (typeof time !== "string" || typeof timeZone !== "string") {
    throw new ScheduleLogError("weekly time and timeZone must be strings");
  }
  try {
    canonicalizeTimeZone(timeZone);
  } catch (error) {
    rethrowLogError(error);
  }
  let normalized: string;
  try {
    normalized = weeklyTime(time).toString({ fractionalSecondDigits: 3 });
  } catch (error) {
    rethrowLogError(error);
  }
  if (time !== normalized) throw new ScheduleLogError("weekly time must be normalized to HH:mm:ss.SSS");
  // normalizeWeekdays đã chứng minh trường là mảng số trước khi phép so này đối chiếu bản sao đã giải mã.
  const stored = value["weekdays"] as readonly unknown[];
  let weekdays: number[];
  try {
    weekdays = normalizeWeekdays(stored);
  } catch (error) {
    rethrowLogError(error);
  }
  if (weekdays.some((weekday, index) => weekday !== stored[index])) {
    throw new ScheduleLogError("weekly weekdays must be normalized to unique ascending ISO weekday numbers");
  }
  return Object.freeze({
    id: decodeId(value["id"]),
    kind: "weekly",
    title,
    prompt,
    time,
    timeZone,
    weekdays,
    scheduledAt: decodeInstant(value["scheduledAt"]),
  });
}

/**
 * Giải mã một quy tắc `cron` của Host mà không giải lại đích UTC đã cam kết.
 * Nhận: value — bản ghi bền chưa tin cậy đã nhận diện là cron.
 * Trả: bản ghi cron đã đóng băng, tách rời; trường không hợp lệ ném ScheduleLogError.
 */
function decodeCronRecord(value: Record<string, unknown>): CronScheduleRecord {
  const title = decodeRecordTitle(
    value,
    ["id", "kind", "title", "prompt", "expression", "timeZone", "scheduledAt"],
    "cron schedule must contain exactly id, kind, title, prompt, expression, timeZone, and scheduledAt",
  );
  const prompt = value["prompt"];
  if (typeof prompt !== "string" || prompt.length === 0 || prompt.trim() !== prompt) {
    throw new ScheduleLogError("cron prompt must be non-empty and already trimmed");
  }
  const expression = value["expression"];
  const timeZone = value["timeZone"];
  if (typeof expression !== "string" || typeof timeZone !== "string") {
    throw new ScheduleLogError("cron expression and timeZone must be strings");
  }
  try {
    canonicalizeTimeZone(timeZone);
  } catch (error) {
    rethrowLogError(error);
  }
  let canonical: string;
  try {
    canonical = parseCronExpression(expression).expression;
  } catch (error) {
    rethrowLogError(error);
  }
  if (expression !== canonical) throw new ScheduleLogError("cron expression must be canonical");
  return Object.freeze({
    id: decodeId(value["id"]),
    kind: "cron",
    title,
    prompt,
    expression,
    timeZone,
    scheduledAt: decodeInstant(value["scheduledAt"]),
  });
}

/**
 * Giải mã một bản ghi tác vụ Host hiện tại, giữ nguyên đích đã cam kết và cách viết vùng đã lưu.
 *
 * Mọi biến thể bản ghi tác vụ Host đều mang tên, nên các biến thể một lần lịch sử được kiểm lại
 * thành viên đó sau khi hình dạng của chúng giải mã xong.
 * Nhận: value — bản ghi JSON bền chưa tin cậy.
 * Trả: bản ghi đã đóng băng, tách rời; trường không hợp lệ ném ScheduleLogError.
 */
export function decodeScheduleRecord(value: unknown): ScheduleRecord {
  if (isRecord(value) && value["kind"] === "daily") return decodeDailyRecord(value);
  if (isRecord(value) && value["kind"] === "weekly") return decodeWeeklyRecord(value);
  if (isRecord(value) && value["kind"] === "cron") return decodeCronRecord(value);
  const record = decodeLegacyScheduleRecord(value);
  if (record.title === undefined) throw new ScheduleLogError(REQUIRED_TITLE_MESSAGE);
  // Sau khi loại nhánh thiếu title, bản ghi lịch sử thoả ScheduleRecord (title trở thành bắt buộc);
  // TypeScript không tự thu hẹp thuộc tính tuỳ chọn thành bắt buộc qua một lần ném sớm.
  return record as ScheduleRecord;
}

/**
 * Chỉ giải mã các biến thể mà sự kiện phiên phiên bản 1 lịch sử chấp nhận.
 *
 * Bản ghi ghi trước khi có tên giải mã được khi thiếu thành viên đó, nên phép gộp vẫn đọc được
 * một sổ mà đường tạo hiện tại không thể ghi ra.
 * Nhận: value — bản ghi JSON bền chưa tin cậy từ một sự kiện phiên.
 * Trả: bản ghi đã đóng băng, tách rời, không có `title` khi sự kiện đã bỏ trống nó;
 *      giá trị không hợp lệ ném ScheduleLogError.
 */
export function decodeLegacyScheduleRecord(value: unknown): LegacyScheduleRecord {
  if (!isRecord(value)) throw new ScheduleLogError("schedule record must be an object");
  switch (value["kind"]) {
    case "after":
      return decodeAfterRecord(value);
    case "at":
      return decodeAtRecord(value);
    case "every":
      return decodeEveryRecord(value);
    default:
      throw new ScheduleLogError('v1 schedule kind must be "after", "at", or "every"');
  }
}

/**
 * Giải mã một payload `schedule/change` phiên bản 1 nghiêm ngặt.
 * Nhận: value — giá trị JSON bền chưa tin cậy.
 * Trả: thay đổi Schedule đã đóng băng, tách rời; payload không hợp lệ ném ScheduleLogError.
 */
export function decodeScheduleChange(value: unknown): ScheduleChange {
  if (!isRecord(value)) throw new ScheduleLogError("schedule/change payload must be an object");
  if (value["version"] !== SCHEDULE_CHANGE_VERSION) {
    throw new ScheduleLogError("schedule/change version must be 1");
  }
  switch (value["operation"]) {
    case "create":
      if (!hasExactKeys(value, ["version", "operation", "schedule"])) {
        throw new ScheduleLogError("schedule create must contain exactly version, operation, and schedule");
      }
      return Object.freeze({
        version: SCHEDULE_CHANGE_VERSION,
        operation: "create",
        schedule: decodeLegacyScheduleRecord(value["schedule"]),
      });
    case "delete": {
      if (!hasExactKeys(value, ["version", "operation", "id"])) {
        throw new ScheduleLogError("schedule delete must contain exactly version, operation, and id");
      }
      return Object.freeze({
        version: SCHEDULE_CHANGE_VERSION,
        operation: "delete",
        id: decodeId(value["id"]),
      });
    }
    case "dispatch": {
      if (hasExactKeys(value, ["version", "operation", "id"])) {
        return Object.freeze({
          version: SCHEDULE_CHANGE_VERSION,
          operation: "dispatch",
          id: decodeId(value["id"]),
        });
      }
      if (hasExactKeys(value, ["version", "operation", "id", "acceptedAt"])) {
        return Object.freeze({
          version: SCHEDULE_CHANGE_VERSION,
          operation: "dispatch",
          id: decodeId(value["id"]),
          acceptedAt: decodeInstant(value["acceptedAt"]),
        });
      }
      throw new ScheduleLogError("schedule dispatch must contain id and optional acceptedAt only");
    }
    default:
      throw new ScheduleLogError("schedule/change operation must be create, delete, or dispatch");
  }
}
