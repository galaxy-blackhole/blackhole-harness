/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 đoạn OCCURRENCE + REPLAY của domain.js (@deepseek-ai/dsh-schedule, dòng 643–1046): phân
 *      giải lần tới hạn MUỘN NHẤT cho every · daily · weekly · cron mà không liệt kê backlog, nhận diện
 *      bản ghi lặp, áp thay đổi đã giải mã lên fold, và fold vết phiên sau mốc seed — thuần, không I/O.
 */

import { Temporal } from "@js-temporal/polyfill";

import { SessionLogOffset } from "@deepseek-ai/dsh-session";
import type { SessionLogOffset as SessionLogOffsetType } from "@deepseek-ai/dsh-session";

import {
  CRON_SEARCH_HORIZON_YEARS,
  MAX_FOUR_DIGIT_YEAR_MS,
  MIN_FOUR_DIGIT_YEAR_MS,
  ScheduleLogError,
  dailyTime,
  decodeScheduleChange,
  localInstant,
  normalizeWeekdays,
  weeklyTime,
} from "./codec.ts";
import { parseCronExpression } from "./records.ts";
import type {
  CronScheduleRecord,
  DailyScheduleRecord,
  EveryScheduleRecord,
  FoldedSchedules,
  LegacyScheduleRecord,
  RecurringOccurrence,
  RecurringScheduleRecord,
  ScheduleChange,
  ScheduleDispatchChange,
  ScheduleId,
  ScheduleRecord,
  WeeklyScheduleRecord,
} from "./types.ts";

/** Kết quả gộp và quyết định lặp dùng chung với `records.ts`; nguồn duy nhất là `types.ts`. */
export type { FoldedSchedules, RecurringOccurrence };

/** Các trường thời gian mà MỘT quyết định every cần từ bản ghi của nó. */
type EveryOccurrenceInput = Pick<EveryScheduleRecord, "everySeconds" | "scheduledAt">;

/**
 * Các trường của MỘT luật cron ĐÃ PARSE mà phép chọn ngày/giờ cần, khai theo CẤU TRÚC.
 * Nhờ vậy tệp này không phụ thuộc kiểu cụ thể của mô-đun parse cron, chỉ phụ thuộc hình dạng.
 */
interface CronRuleFields {
  /** Phút khớp, tăng dần. */
  readonly minutes: readonly number[];
  /** Giờ khớp, tăng dần. */
  readonly hours: readonly number[];
  /** Ngày-trong-tháng khớp, tăng dần. */
  readonly daysOfMonth: readonly number[];
  /** Tháng khớp, tăng dần. */
  readonly months: readonly number[];
  /** Thứ khớp, tăng dần, đã gập Chủ nhật 7 về 0. */
  readonly daysOfWeek: readonly number[];
  /** Trường day-of-month bắt đầu bằng `*`. */
  readonly dayOfMonthStar: boolean;
  /** Trường day-of-week bắt đầu bằng `*`. */
  readonly dayOfWeekStar: boolean;
}

/**
 * Mục tối thiểu của vết phiên mà phép gộp cần.
 *
 * Bản gốc nhận `readonly SessionEvent[]` nhờ augment `SessionEventMap`; bản viết lại khai theo CẤU
 * TRÚC (không augment module) nên nhận mọi phần tử có `type` và `data` — `SessionEvent[]` vẫn gán được.
 */
export interface ScheduleLogEvent {
  /** Loại sự kiện phiên. */
  readonly type: string;
  /** Payload bền chưa giải mã. */
  readonly data: unknown;
}

/**
 * Phân giải MỘT quyết định đều cố định mà không liệt kê các lần bị lỡ.
 * @param record - Bản ghi đang hoạt động có đích là lần chưa-nhận SỚM NHẤT.
 * @param acceptedAt - Thời điểm quyết định theo giờ tường, epoch mili giây.
 * @returns Lần tới hạn muộn nhất và đích TƯƠNG LAI NGHIÊM NGẶT đầu tiên, nếu biểu diễn được.
 */
export function resolveEveryOccurrence(record: EveryOccurrenceInput, acceptedAt: number): RecurringOccurrence {
  const target = Date.parse(record.scheduledAt);
  const interval = record.everySeconds * 1_000;
  if (
    !Number.isSafeInteger(acceptedAt)
    || acceptedAt < MIN_FOUR_DIGIT_YEAR_MS
    || acceptedAt > MAX_FOUR_DIGIT_YEAR_MS
  ) {
    throw new ScheduleLogError("every acceptedAt must be a representable four-digit-year instant");
  }
  if (!Number.isSafeInteger(interval) || interval <= 0) {
    throw new ScheduleLogError("every interval milliseconds must be a positive safe integer");
  }
  if (acceptedAt < target) {
    throw new ScheduleLogError("every dispatch cannot precede the active scheduledAt");
  }
  const steps = Math.floor((acceptedAt - target) / interval);
  const occurrence = target + steps * interval;
  /* v8 ignore next -- bounded operands and a quotient-derived product stay safe. */
  if (!Number.isSafeInteger(occurrence) || occurrence < target || occurrence > acceptedAt) {
    throw new ScheduleLogError("every occurrence arithmetic must stay within the accepted interval");
  }
  const occurrenceAt = new Date(occurrence).toISOString();
  const next = occurrence + interval;
  if (!Number.isSafeInteger(next) || next > MAX_FOUR_DIGIT_YEAR_MS) {
    return Object.freeze({ occurrenceAt });
  }
  return Object.freeze({
    occurrenceAt,
    nextScheduledAt: new Date(next).toISOString(),
  });
}

/**
 * Chiếu MỘT instant tường minh thành ngày lịch ở vùng của luật.
 * @param epoch - Instant, epoch mili giây.
 * @param timeZone - Vùng IANA diễn giải ngày.
 * @returns Ngày địa phương tại instant đó.
 */
function localDate(epoch: number, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(timeZone).toPlainDate();
}

/** Bỏ qua mọi ngày địa phương; dùng cho luật chỉ chọn theo giờ. */
const EVERY_DATE = (): boolean => true;

/**
 * Chọn đúng các thứ ISO tường minh của MỘT luật weekly đã chuẩn hoá.
 * @param weekdays - Các thứ ISO duy nhất, tăng dần (1 = Thứ Hai … 7 = Chủ Nhật).
 * @returns Vị từ ngày địa phương có thuộc tập đã chọn hay không.
 */
function weekdaySet(weekdays: readonly number[]): (date: Temporal.PlainDate) => boolean {
  const selected = new Set(weekdays);
  return date => selected.has(date.dayOfWeek);
}

/**
 * Tìm lần tới hạn THỰC TẾ đầu tiên sau now và, khi có, sau một ngày đã giao.
 * @param time - Giờ đồng hồ địa phương của luật.
 * @param timeZone - Vùng IANA diễn giải giờ ấy.
 * @param now - Thời điểm quyết định, epoch mili giây.
 * @param matches - Vị từ ngày địa phương đủ điều kiện.
 * @param afterDate - Ngày địa phương của lần đã giao, bị loại khỏi tìm kiếm.
 * @returns Đích tương lai nghiêm ngặt đầu tiên, hoặc cạn kiệt là undefined.
 */
function nextMatchingTarget(
  time: Temporal.PlainTime,
  timeZone: string,
  now: number,
  matches: (date: Temporal.PlainDate) => boolean,
  afterDate?: Temporal.PlainDate,
): string | undefined {
  let date = localDate(now, timeZone);
  const lastDate = localDate(MAX_FOUR_DIGIT_YEAR_MS, "UTC").add({ days: 1 });
  if (afterDate !== undefined && Temporal.PlainDate.compare(date, afterDate) <= 0) {
    date = afterDate.add({ days: 1 });
  }
  for (; Temporal.PlainDate.compare(date, lastDate) <= 0; date = date.add({ days: 1 })) {
    if (!matches(date)) continue;
    const target = localInstant(date.toPlainDateTime(time), timeZone);
    if (target === undefined) continue;
    if (target > MAX_FOUR_DIGIT_YEAR_MS) return undefined;
    if (target >= MIN_FOUR_DIGIT_YEAR_MS && target > now) return new Date(target).toISOString();
  }
  return undefined;
}

/**
 * Tìm lần tới hạn THỰC TẾ muộn nhất tại-hoặc-trước một quyết định mà không rời mốc đã chốt.
 * @param timeZone - Vùng IANA diễn giải giờ của luật.
 * @param matches - Vị từ ngày địa phương đủ điều kiện.
 * @param time - Giờ đồng hồ địa phương của luật.
 * @param acceptedAt - Thời điểm quyết định, epoch mili giây.
 * @param savedTarget - Đích đã chốt, vẫn tới hạn dù dữ liệu vùng hiện tại đặt luật trước nó.
 * @returns Lần tới hạn muộn nhất tại-hoặc-trước quyết định.
 */
function latestDueOccurrence(
  timeZone: string,
  matches: (date: Temporal.PlainDate) => boolean,
  time: Temporal.PlainTime,
  acceptedAt: number,
  savedTarget: number,
): number {
  // Offset nhỏ hơn 24 giờ; một cú lùi đường đổi-ngày có thể làm ngày địa phương hiện tại
  // sớm hơn một ngày đã tới hạn.
  let date = localDate(acceptedAt, "UTC").add({ days: 1 });
  for (;; date = date.subtract({ days: 1 })) {
    if (!matches(date)) continue;
    const candidate = localInstant(date.toPlainDateTime(time), timeZone);
    if (candidate === undefined || candidate > acceptedAt) continue;
    // Đích đã chốt vẫn tới hạn dù tzdata hiện tại đặt luật trước nó.
    return Math.max(candidate, savedTarget);
  }
}

/**
 * Nhận một quyết định đồng hồ treo tường CHỈ KHI nó ở instant bốn-chữ-số-năm biểu diễn được.
 * @param selector - Tên công khai của bộ chọn, dùng trong chẩn đoán.
 * @param acceptedAt - Thời điểm quyết định, epoch mili giây.
 * @returns Chính thời điểm quyết định đã kiểm.
 */
function acceptedDecision(selector: string, acceptedAt: number): number {
  if (
    !Number.isSafeInteger(acceptedAt)
    || acceptedAt < MIN_FOUR_DIGIT_YEAR_MS || acceptedAt > MAX_FOUR_DIGIT_YEAR_MS
  ) {
    throw new ScheduleLogError(`${selector} acceptedAt must be a representable four-digit-year instant`);
  }
  return acceptedAt;
}

/**
 * Tìm lần tới hạn daily THỰC TẾ đầu tiên sau now và, khi có, sau một ngày đã giao.
 * @param time - Giờ đồng hồ địa phương của luật.
 * @param timeZone - Vùng IANA diễn giải giờ ấy.
 * @param now - Thời điểm quyết định, epoch mili giây.
 * @param afterDate - Ngày địa phương của lần đã giao, bị loại khỏi tìm kiếm.
 * @returns Đích tương lai nghiêm ngặt đầu tiên, hoặc cạn kiệt là undefined.
 */
export function nextDailyTarget(
  time: Temporal.PlainTime,
  timeZone: string,
  now: number,
  afterDate?: Temporal.PlainDate,
): string | undefined {
  return nextMatchingTarget(time, timeZone, now, EVERY_DATE, afterDate);
}

/**
 * Phân giải MỘT quyết định daily quanh ngày địa phương của quyết định, không quét lịch sử bị lỡ.
 * @param record - Luật daily với đích UTC chưa-nhận SỚM NHẤT đã chốt.
 * @param acceptedAt - Thời điểm quyết định tường minh, tại-hoặc-sau đích đã chốt.
 * @returns Lần tới hạn THỰC TẾ muộn nhất và lần tương lai kế tiếp ở MỘT ngày địa phương sau.
 */
export function resolveDailyOccurrence(record: DailyScheduleRecord, acceptedAt: number): RecurringOccurrence {
  const decision = acceptedDecision("daily", acceptedAt);
  const savedTarget = Date.parse(record.scheduledAt);
  if (decision < savedTarget) throw new ScheduleLogError("daily dispatch cannot precede the active scheduledAt");
  const time = dailyTime(record.time);
  const occurrence = latestDueOccurrence(record.timeZone, EVERY_DATE, time, decision, savedTarget);
  const occurrenceAt = new Date(occurrence).toISOString();
  const nextScheduledAt = nextDailyTarget(time, record.timeZone, decision, localDate(occurrence, record.timeZone));
  return Object.freeze(nextScheduledAt === undefined ? { occurrenceAt } : { occurrenceAt, nextScheduledAt });
}

/**
 * Tìm lần tới hạn weekly THỰC TẾ đầu tiên sau now và, khi có, sau một ngày đã giao.
 * @param time - Giờ đồng hồ địa phương của luật.
 * @param timeZone - Vùng IANA diễn giải giờ ấy.
 * @param weekdays - Các thứ ISO tường minh của luật, đã chuẩn hoá.
 * @param now - Thời điểm quyết định, epoch mili giây.
 * @param afterDate - Ngày địa phương của lần đã giao, bị loại khỏi tìm kiếm.
 * @returns Đích tương lai nghiêm ngặt đầu tiên, hoặc cạn kiệt là undefined.
 */
export function nextWeeklyTarget(
  time: Temporal.PlainTime,
  timeZone: string,
  weekdays: readonly number[],
  now: number,
  afterDate?: Temporal.PlainDate,
): string | undefined {
  return nextMatchingTarget(time, timeZone, now, weekdaySet(weekdays), afterDate);
}

/**
 * Phân giải MỘT quyết định weekly quanh ngày địa phương của quyết định, không quét lịch sử bị lỡ.
 * @param record - Luật weekly với đích UTC chưa-nhận SỚM NHẤT đã chốt.
 * @param acceptedAt - Thời điểm quyết định tường minh, tại-hoặc-sau đích đã chốt.
 * @returns Lần tới hạn THỰC TẾ muộn nhất và lần tương lai kế tiếp ở MỘT thứ đã chọn.
 */
export function resolveWeeklyOccurrence(record: WeeklyScheduleRecord, acceptedAt: number): RecurringOccurrence {
  const decision = acceptedDecision("weekly", acceptedAt);
  const savedTarget = Date.parse(record.scheduledAt);
  if (decision < savedTarget) throw new ScheduleLogError("weekly dispatch cannot precede the active scheduledAt");
  const time = weeklyTime(record.time);
  const weekdays = normalizeWeekdays(record.weekdays);
  const occurrence = latestDueOccurrence(record.timeZone, weekdaySet(weekdays), time, decision, savedTarget);
  const occurrenceAt = new Date(occurrence).toISOString();
  const nextScheduledAt = nextWeeklyTarget(time, record.timeZone, weekdays, decision, localDate(occurrence, record.timeZone));
  return Object.freeze(nextScheduledAt === undefined ? { occurrenceAt } : { occurrenceAt, nextScheduledAt });
}

/**
 * Dựng vị từ ngày địa phương của MỘT luật cron đã parse, theo ngữ nghĩa Vixie cho
 * day-of-month/day-of-week.
 *
 * Cờ star CHỈ chọn nhánh; nó không bao giờ miễn trừ giá trị khớp của một trường. Khi text của
 * TRƯỜNG nào cũng bắt đầu bằng `*`, một ngày địa phương phải thoả CẢ HAI trường, nên star có bước
 * như `*` rồi `/2` vẫn giới hạn ngày nó khớp. Một `*` trần khớp mọi giá trị, khiến trường ấy
 * luôn đúng và phép AND thoái hoá về trường còn lại — đúng như phép thử `DOM_STAR`/`DOW_STAR` của
 * Vixie. Chỉ khi CẢ HAI text trường đều KHÔNG bắt đầu bằng `*` thì khớp MỘT trong hai trường là đủ.
 * @param parsed - Luật cron đã parse với text trường chuẩn và các giá trị khớp.
 * @returns Một ngày địa phương có khớp luật hay không.
 */
function cronDateMatch(parsed: CronRuleFields): (date: Temporal.PlainDate) => boolean {
  const months = new Set(parsed.months);
  const daysOfMonth = new Set(parsed.daysOfMonth);
  const daysOfWeek = new Set(parsed.daysOfWeek);
  const dayOfMonthRestricted = !parsed.dayOfMonthStar;
  const dayOfWeekRestricted = !parsed.dayOfWeekStar;
  return (date: Temporal.PlainDate): boolean => {
    /* v8 ignore next -- both callers pre-filter by month before matching a date. */
    if (!months.has(date.month)) return false;
    const dayOfMonth = daysOfMonth.has(date.day);
    const dayOfWeek = daysOfWeek.has(date.dayOfWeek % 7);
    if (dayOfMonthRestricted && dayOfWeekRestricted) return dayOfMonth || dayOfWeek;
    return dayOfMonth && dayOfWeek;
  };
}

/**
 * Liệt kê các giờ-trong-ngày địa phương của MỘT luật cron đã parse, tăng dần theo giờ tường.
 * @param parsed - Luật cron đã parse.
 * @returns Các giờ đồng hồ địa phương theo thứ tự tăng dần.
 */
function cronTimes(parsed: CronRuleFields): Temporal.PlainTime[] {
  const times: Temporal.PlainTime[] = [];
  for (const hour of parsed.hours) {
    for (const minute of parsed.minutes) times.push(Temporal.PlainTime.from({ hour, minute }));
  }
  return times;
}

/**
 * Tìm lần tới hạn cron TƯƠNG LAI NGHIÊM NGẶT đầu tiên mà không rời miền năm UTC bốn chữ số.
 *
 * Lượt đi dừng tại {@link CRON_SEARCH_HORIZON_YEARS} năm sau ngày mốc khi chân trời ấy đứng trước
 * trần bốn chữ số: luật không khớp bên trong chân trời thì không bao giờ khớp, nên tìm kiếm của nó
 * cạn kiệt thay vì quét tới trần.
 * @param parsed - Luật cron đã parse.
 * @param timeZone - Vùng IANA tường minh diễn giải ngày và giờ địa phương của nó.
 * @param floor - Instant mà MỌI đích trả về phải vượt qua.
 * @returns Đích khớp đầu tiên, hoặc cạn kiệt là undefined.
 */
export function nextCronTarget(parsed: CronRuleFields, timeZone: string, floor: number): string | undefined {
  const times = cronTimes(parsed);
  const matches = cronDateMatch(parsed);
  const months = new Set(parsed.months);
  const firstDate = localDate(floor, timeZone);
  let date = firstDate;
  // Giờ tường địa phương CỦA CHÍNH mốc, để ngày đầu chỉ quy đổi các ứng viên có thể vượt nó
  // thay vì cả ngày giờ của ngày ấy.
  const floorTime = Temporal.Instant.fromEpochMilliseconds(floor).toZonedDateTimeISO(timeZone).toPlainTime();
  const ceiling = localDate(MAX_FOUR_DIGIT_YEAR_MS, "UTC").add({ days: 1 });
  const horizon = date.add({ years: CRON_SEARCH_HORIZON_YEARS });
  const lastDate = Temporal.PlainDate.compare(horizon, ceiling) < 0 ? horizon : ceiling;
  while (Temporal.PlainDate.compare(date, lastDate) <= 0) {
    if (!months.has(date.month)) {
      date = date.add({ months: 1 }).with({ day: 1 });
      continue;
    }
    if (matches(date)) {
      for (const time of times) {
        if (date.equals(firstDate) && Temporal.PlainTime.compare(time, floorTime) < 0) continue;
        const target = localInstant(date.toPlainDateTime(time), timeZone);
        if (target === undefined) continue;
        if (target > MAX_FOUR_DIGIT_YEAR_MS) return undefined;
        if (target >= MIN_FOUR_DIGIT_YEAR_MS && target > floor) return new Date(target).toISOString();
      }
    }
    date = date.add({ days: 1 });
  }
  return undefined;
}

/**
 * Tìm lần tới hạn cron khớp MUỘN NHẤT tại-hoặc-trước một quyết định mà không rời mốc đã chốt.
 *
 * Lượt đi dừng tại {@link CRON_SEARCH_HORIZON_YEARS} năm trước ngày quyết định khi chân trời ấy
 * đứng sau mốc bốn chữ số, tức ngày địa phương chứa instant mốc ấy trong CHÍNH vùng của luật:
 * luật không khớp bên trong chân trời thì giữ đích đã chốt thay vì quét ngược về mốc, và ứng viên
 * trước instant mốc bị bỏ qua.
 * @param parsed - Luật cron đã parse.
 * @param timeZone - Vùng IANA tường minh diễn giải ngày và giờ địa phương của nó.
 * @param decision - Thời điểm quyết định theo giờ tường, epoch mili giây.
 * @param savedTarget - Đích đã chốt, vẫn tới hạn dù dữ liệu vùng hiện tại phân giải vượt nó.
 * @returns Lần tới hạn muộn nhất, hoặc đích đã chốt khi không lần địa phương nào biểu diễn được.
 */
function latestCronOccurrence(
  parsed: CronRuleFields,
  timeZone: string,
  decision: number,
  savedTarget: number,
): number {
  const times = cronTimes(parsed);
  const matches = cronDateMatch(parsed);
  const months = new Set(parsed.months);
  // Offset nhỏ hơn 24 giờ; một cú lùi đường đổi-ngày có thể làm ngày địa phương đã tới hạn
  // MUỘN hơn ngày quyết định theo UTC, nên lượt đi bắt đầu từ một ngày sau ngày ấy.
  let date = localDate(decision, "UTC").add({ days: 1 });
  // Mốc là một instant: ngày địa phương sớm nhất mà lượt đi được chạm là ngày chứa nó trong
  // CHÍNH vùng của luật, và ứng viên dưới nó bị bỏ qua, nên offset âm vẫn phân giải được một
  // phút địa phương đã tới hạn mang ngày TRƯỚC mốc UTC.
  const floorDate = localDate(MIN_FOUR_DIGIT_YEAR_MS, timeZone);
  const horizon = date.subtract({ years: CRON_SEARCH_HORIZON_YEARS });
  const firstDate = Temporal.PlainDate.compare(horizon, floorDate) > 0 ? horizon : floorDate;
  while (Temporal.PlainDate.compare(date, firstDate) >= 0) {
    if (!months.has(date.month)) {
      date = date.with({ day: 1 }).subtract({ days: 1 });
      continue;
    }
    if (matches(date)) {
      // MỘT phép quy đổi giờ tường sớm nhất của ngày quyết định cả ngày ấy có nằm ngoài quyết định
      // hay không: mọi giờ muộn hơn trên ngày ấy cũng muộn hơn, nên lượt đi lùi lại thay vì quy
      // đổi phần còn lại của một ngày không thể khớp. Giờ sớm nhất bị lỗ DST xoá thì ràng buộc rơi
      // về giờ đầu tiên TỒN TẠI, và ngày không có giờ tồn tại nào giữ nguyên lượt đi đầy đủ.
      const earliest = times.reduce<number | undefined>(
        (found, time) => found ?? localInstant(date.toPlainDateTime(time), timeZone),
        undefined,
      );
      if (earliest !== undefined && earliest > decision) {
        date = date.subtract({ days: 1 });
        continue;
      }
      for (const time of [...times].reverse()) {
        const candidate = localInstant(date.toPlainDateTime(time), timeZone);
        if (candidate === undefined || candidate > decision || candidate < MIN_FOUR_DIGIT_YEAR_MS) continue;
        // Đích đã chốt vẫn tới hạn dù tzdata hiện tại đặt luật trước nó.
        return Math.max(candidate, savedTarget);
      }
    }
    date = date.subtract({ days: 1 });
  }
  return savedTarget;
}

/**
 * Phân giải MỘT quyết định cron quanh ngày địa phương của quyết định, không quét lịch sử bị lỡ.
 * @param record - Luật cron với đích UTC chưa-nhận SỚM NHẤT đã chốt.
 * @param acceptedAt - Thời điểm quyết định tường minh, tại-hoặc-sau đích đã chốt.
 * @returns Lần tới hạn THỰC TẾ muộn nhất và lần tương lai đầu tiên.
 */
export function resolveCronOccurrence(record: CronScheduleRecord, acceptedAt: number): RecurringOccurrence {
  const decision = acceptedDecision("cron", acceptedAt);
  const savedTarget = Date.parse(record.scheduledAt);
  if (decision < savedTarget) throw new ScheduleLogError("cron dispatch cannot precede the active scheduledAt");
  const parsed = parseCronExpression(record.expression);
  const occurrence = latestCronOccurrence(parsed, record.timeZone, decision, savedTarget);
  const occurrenceAt = new Date(occurrence).toISOString();
  const nextScheduledAt = nextCronTarget(parsed, record.timeZone, decision);
  return Object.freeze(nextScheduledAt === undefined ? { occurrenceAt } : { occurrenceAt, nextScheduledAt });
}

/**
 * Nhận diện bản ghi Host LẶP một cách tường minh, loại trừ cả hai biến thể một-lần.
 * @param record - Bản ghi schedule hiện tại của Host.
 * @returns Bản ghi có dùng luật lặp hay không.
 */
export function isRecurringScheduleRecord(record: ScheduleRecord): record is RecurringScheduleRecord {
  return record.kind === "every" || record.kind === "daily" || record.kind === "weekly" || record.kind === "cron";
}

/**
 * Phân giải MỘT bản ghi Host lặp đã tới hạn bằng số học lịch hoặc chu kỳ riêng của luật nó.
 * @param record - Luật lặp đã tới hạn.
 * @param acceptedAt - Thời điểm quyết định tường minh, epoch mili giây.
 * @returns Lần tới hạn muộn nhất và đích tương lai tuỳ chọn.
 */
export function resolveRecurringOccurrence(record: RecurringScheduleRecord, acceptedAt: number): RecurringOccurrence {
  switch (record.kind) {
    case "every": return resolveEveryOccurrence(record, acceptedAt);
    case "daily": return resolveDailyOccurrence(record, acceptedAt);
    case "weekly": return resolveWeeklyOccurrence(record, acceptedAt);
    case "cron": return resolveCronOccurrence(record, acceptedAt);
  }
}

/**
 * Áp MỘT dispatch đã giải mã lên đúng bản ghi đang hoạt động của nó.
 * @param record - Bản ghi đang hoạt động bị điều phối.
 * @param change - Thay đổi dispatch đã giải mã.
 * @returns Bản ghi kế tiếp cho every, hoặc undefined khi một-lần đã kết thúc.
 */
function dispatchedRecord(record: LegacyScheduleRecord, change: ScheduleDispatchChange): LegacyScheduleRecord | undefined {
  const hasAcceptedAt = "acceptedAt" in change;
  if (record.kind !== "every") {
    if (hasAcceptedAt) throw new ScheduleLogError("one-shot dispatch must not contain acceptedAt");
    return undefined;
  }
  if (!hasAcceptedAt) throw new ScheduleLogError("every dispatch must contain acceptedAt");
  const occurrence = resolveEveryOccurrence(record, Date.parse(change.acceptedAt));
  return occurrence.nextScheduledAt === undefined
    ? undefined
    : Object.freeze({ ...record, scheduledAt: occurrence.nextScheduledAt });
}

/**
 * Áp các thay đổi Schedule ĐÃ GIẢI MÃ lên một giá trị gộp hoàn chỉnh.
 *
 * Cơ quan chuyển trạng thái cho replay toàn-log. MỘT cặp Map/Set khả biến trải khắp cả lô; các
 * mảng trả về được hiện thực hoá và đóng băng đúng một lần.
 * @param folded - Bản ghi đang hoạt động hoàn chỉnh và lịch sử id đã dùng trước các thay đổi.
 * @param changes - Các đột biến bền đã giải mã nghiêm ngặt, theo thứ tự log.
 * @returns Giá trị gộp hoàn chỉnh sau mọi đột biến.
 */
export function applyScheduleChanges(folded: FoldedSchedules, changes: Iterable<ScheduleChange>): FoldedSchedules {
  const active = new Map<ScheduleId, LegacyScheduleRecord>(
    folded.active.map(record => [record.id, record] as const),
  );
  const seen = new Set<ScheduleId>(folded.seenIds);
  for (const change of changes) {
    switch (change.operation) {
      case "create":
        if (seen.has(change.schedule.id)) {
          throw new ScheduleLogError(`schedule id ${JSON.stringify(change.schedule.id)} was reused`);
        }
        seen.add(change.schedule.id);
        active.set(change.schedule.id, change.schedule);
        break;
      case "delete":
        if (!active.delete(change.id)) {
          throw new ScheduleLogError(`schedule delete targets inactive id ${JSON.stringify(change.id)}`);
        }
        break;
      case "dispatch": {
        const record = active.get(change.id);
        if (record === undefined) {
          throw new ScheduleLogError(`schedule dispatch targets inactive id ${JSON.stringify(change.id)}`);
        }
        const next = dispatchedRecord(record, change);
        if (next === undefined) active.delete(change.id);
        else active.set(change.id, next);
        break;
      }
      /* v8 ignore next 3 -- decodeScheduleChange returns a closed operation union. */
      default: {
        const unreachable = change;
        throw new ScheduleLogError(`unknown decoded schedule change ${String(unreachable)}`);
      }
    }
  }
  return Object.freeze({
    active: Object.freeze([...active.values()]),
    seenIds: Object.freeze([...seen]),
  });
}

/**
 * Gộp luồng do gói sở hữu SAU ranh giới seed của nhánh bền.
 * @param events - Vết phiên đầy đủ theo thứ tự, hoặc vết đã nối ứng viên.
 * @param inheritedEventCount - Độ dài tiền tố kế thừa, bị loại khỏi quyền sở hữu của con.
 * @returns Bản ghi đang hoạt động và mọi id từng dùng.
 */
export function foldScheduleEvents(
  events: readonly ScheduleLogEvent[],
  inheritedEventCount: SessionLogOffsetType = SessionLogOffset(0),
): FoldedSchedules {
  if (
    !Number.isSafeInteger(inheritedEventCount)
    || inheritedEventCount < 0
    || inheritedEventCount > events.length
  ) {
    throw new ScheduleLogError("schedule inheritedEventCount must be within the supplied event log");
  }
  const initial: FoldedSchedules = Object.freeze({
    active: Object.freeze([]),
    seenIds: Object.freeze([]),
  });
  const changes = function* (): Generator<ScheduleChange> {
    for (const event of events.slice(inheritedEventCount)) {
      if (event.type === "schedule/change") yield decodeScheduleChange(event.data);
    }
  };
  return applyScheduleChanges(initial, changes());
}