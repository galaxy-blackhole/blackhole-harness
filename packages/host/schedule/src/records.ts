/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 đoạn RECORDS + CRON của domain.js (@deepseek-ai/dsh-schedule, dòng 1047–1546): cấp id
 *      kế tiếp, tạo bản ghi bền cho after · at · every · daily · weekly · cron, và TOÀN BỘ máy parse
 *      cron năm trường (tách trường · mở rộng tập giá trị · mã hoá lại · cờ star) — thuần, không I/O.
 */

import type {
  AfterScheduleRecord,
  AtInput,
  AtScheduleRecord,
  CronInput,
  CronScheduleRecord,
  DailyInput,
  DailyScheduleRecord,
  EveryScheduleRecord,
  ScheduleId as ScheduleIdType,
  WeeklyInput,
  WeeklyScheduleRecord,
} from "./types.ts";
import {
  MAX_FOUR_DIGIT_YEAR_MS,
  MIN_EVERY_INTERVAL_SECONDS,
  MIN_FOUR_DIGIT_YEAR_MS,
  ScheduleId,
  ScheduleInputError,
  ScheduleLogError,
  canonicalizeTimeZone,
  dailyTime,
  futureInstant,
  hasExactKeys,
  isRecord,
  normalizeWeekdays,
  parseLocalAt,
  parseOffsetInstant,
  resolveLocalInstant,
  scheduleTitle,
  weeklyTime,
} from "./codec.ts";
import type { FoldedSchedules } from "./occurrence.ts";
import { nextCronTarget, nextDailyTarget, nextWeeklyTarget } from "./occurrence.ts";

/**
 * Cấp id kế tiếp dạng `schedule-N` mà KHÔNG tái dùng bất kỳ id nào của phiên.
 * Xuất phát từ `seenIds.size + 1` rồi nhảy qua mọi id đã dùng (kể cả khi lịch sử id bị đục lỗ).
 * @param folded - Kết quả fold chứa toàn bộ id đã tạo trước đó.
 * @returns Danh tính `schedule-N` còn trống.
 */
export function allocateScheduleId(folded: FoldedSchedules): ScheduleIdType {
  const seen = new Set(folded.seenIds);
  let sequence = seen.size + 1;
  let candidate = ScheduleId(`schedule-${sequence}`);
  while (seen.has(candidate)) {
    sequence += 1;
    candidate = ScheduleId(`schedule-${sequence}`);
  }
  return candidate;
}

/**
 * Nhận một model "after" sau khi luật đã đúng và tính đích bền của nó.
 * Prompt được trim rồi bắt buộc khác rỗng; `afterSeconds` phải là số nguyên an toàn dương.
 * @param id - Id đã cấp trước đó.
 * @param prompt - Nội dung nhắc do người tạo gửi.
 * @param afterSeconds - Độ trễ dương được yêu cầu.
 * @param now - Mốc đồng hồ DUY NHẤT lúc nhận luật, tính bằng epoch mili giây.
 * @param title - Tên tác vụ bắt buộc do người tạo gửi.
 * @returns Bản ghi after bền, đã đóng băng.
 */
export function createAfterScheduleRecord(
  id: ScheduleIdType,
  prompt: string,
  afterSeconds: number,
  now: number,
  title: string,
): AfterScheduleRecord {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  if (!Number.isSafeInteger(afterSeconds) || afterSeconds <= 0) {
    throw new ScheduleInputError("invalid_rule", "after_seconds must be a positive safe integer.");
  }
  const delay = afterSeconds * 1_000;
  const target = now + delay;
  return Object.freeze({
    id,
    kind: "after",
    title: scheduleTitle(title),
    prompt: normalizedPrompt,
    afterSeconds,
    scheduledAt: futureInstant(target, now),
  });
}

/**
 * Nhận một selector tuyệt đối và tính đích UTC bền duy nhất của nó.
 * @param id - Id đã cấp trước đó.
 * @param prompt - Nội dung nhắc do người tạo gửi.
 * @param at - Instant có offset tường minh, hoặc giá trị lịch địa phương có cấu trúc.
 * @param now - Mốc đồng hồ DUY NHẤT lúc nhận luật, tính bằng epoch mili giây.
 * @param title - Tên tác vụ bắt buộc do người tạo gửi.
 * @returns Bản ghi một-lần tuyệt đối bền, đã đóng băng.
 */
export function createAtScheduleRecord(
  id: ScheduleIdType,
  prompt: string,
  at: AtInput,
  now: number,
  title: string,
): AtScheduleRecord {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  return Object.freeze({
    id,
    kind: "at",
    title: scheduleTitle(title),
    prompt: normalizedPrompt,
    scheduledAt: futureInstant(parseAtInput(at), now),
  });
}

/**
 * Phân giải một selector tuyệt đối mà KHÔNG đòi nó phải ở tương lai.
 * @param at - Instant có offset tường minh, hoặc giá trị lịch địa phương nghiêm ngặt.
 * @returns Mốc epoch mili giây đã phân giải; đầu vào sai hình dạng ném ScheduleInputError.
 */
export function parseAtInput(at: AtInput): number {
  let target: number;
  if (typeof at === "string") {
    target = parseOffsetInstant(at);
  } else if (isRecord(at)) {
    if (!hasExactKeys(at, ["date", "time", "time_zone"])) {
      throw new ScheduleInputError("invalid_rule", "Local at must contain exactly date, time, and time_zone.");
    }
    if (typeof at["date"] !== "string" || typeof at["time"] !== "string") {
      throw new ScheduleInputError("invalid_rule", "Local at date and time must be strings.");
    }
    const rawTimeZone = at["time_zone"];
    if (typeof rawTimeZone !== "string") {
      throw new ScheduleInputError("invalid_time_zone", "time_zone must be a string.");
    }
    const local = {
      date: at["date"],
      time: at["time"],
      time_zone: rawTimeZone,
    };
    target = resolveLocalInstant(parseLocalAt(local), canonicalizeTimeZone(rawTimeZone));
  } else {
    throw new ScheduleInputError("invalid_rule", "at must be an explicit-offset string or local calendar object.");
  }
  return target;
}

/**
 * Nhận một selector "every" cố định và tính đích đầu tiên của mốc chu kỳ mới.
 * @param id - Id đã cấp trước đó.
 * @param prompt - Nội dung nhắc do người tạo gửi.
 * @param everySeconds - Chu kỳ cố định, số nguyên an toàn, được yêu cầu.
 * @param now - Mốc đồng hồ DUY NHẤT lúc nhận luật, tính bằng epoch mili giây.
 * @param title - Tên tác vụ bắt buộc do người tạo gửi.
 * @returns Bản ghi every bền, đã đóng băng.
 */
export function createEveryScheduleRecord(
  id: ScheduleIdType,
  prompt: string,
  everySeconds: number,
  now: number,
  title: string,
): EveryScheduleRecord {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  if (!Number.isSafeInteger(everySeconds)) {
    throw new ScheduleInputError("invalid_rule", "every_seconds must be a safe integer.");
  }
  if (everySeconds < MIN_EVERY_INTERVAL_SECONDS) {
    throw new ScheduleInputError("frequency_too_high", `every_seconds must be at least ${MIN_EVERY_INTERVAL_SECONDS}.`);
  }
  const interval = everySeconds * 1_000;
  const target = now + interval;
  return Object.freeze({
    id,
    kind: "every",
    title: scheduleTitle(title),
    prompt: normalizedPrompt,
    everySeconds,
    scheduledAt: futureInstant(target, now),
  });
}

/**
 * Tạo luật đồng hồ treo tường hằng ngày với đích UTC bền ở TƯƠNG LAI NGHIÊM NGẶT.
 * @param id - Danh tính tác vụ đã cấp.
 * @param prompt - Nội dung nhắc do người tạo gửi.
 * @param daily - Giờ địa phương nghiêm ngặt và vùng IANA tường minh.
 * @param now - Mốc đồng hồ DUY NHẤT lúc nhận luật, tính bằng epoch mili giây.
 * @param title - Tên tác vụ bắt buộc do người tạo gửi.
 * @returns Bản ghi daily đã đóng băng; không có ngày tương lai thì ném time_out_of_range.
 */
export function createDailyScheduleRecord(
  id: ScheduleIdType,
  prompt: string,
  daily: DailyInput,
  now: number,
  title: string,
): DailyScheduleRecord {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  const { time, timeZone } = parseDailyInput(daily);
  if (!Number.isSafeInteger(now) || now < MIN_FOUR_DIGIT_YEAR_MS || now > MAX_FOUR_DIGIT_YEAR_MS) {
    throw new ScheduleInputError("time_out_of_range", "Daily creation time must be a representable four-digit-year UTC instant.");
  }
  const scheduledAt = nextDailyTarget(dailyTime(time), timeZone, now);
  if (scheduledAt === undefined) {
    throw new ScheduleInputError("time_out_of_range", "No future daily occurrence is representable as a four-digit-year UTC instant.");
  }
  return Object.freeze({
    id, kind: "daily", title: scheduleTitle(title), prompt: normalizedPrompt, time, timeZone, scheduledAt,
  });
}

/**
 * Chuẩn hoá một selector "daily" mà KHÔNG tính đích bền mới.
 * @param daily - Giờ địa phương nghiêm ngặt và vùng IANA tường minh.
 * @returns Giờ đã chuẩn hoá và vùng chuẩn; đầu vào sai hình dạng ném ScheduleInputError.
 */
export function parseDailyInput(daily: DailyInput): { readonly time: string; readonly timeZone: string } {
  if (!isRecord(daily) || !hasExactKeys(daily, ["time", "time_zone"]) || typeof daily["time"] !== "string") {
    throw new ScheduleInputError("invalid_rule", "daily must contain exactly time and time_zone, with time HH:mm:ss and optional 1-3 fractional digits.");
  }
  if (typeof daily["time_zone"] !== "string") {
    throw new ScheduleInputError("invalid_time_zone", "time_zone must be a string.");
  }
  return {
    time: dailyTime(daily["time"]).toString({ fractionalSecondDigits: 3 }),
    timeZone: canonicalizeTimeZone(daily["time_zone"]),
  };
}

/**
 * Tạo luật đồng hồ treo tường hằng tuần với đích UTC bền ở TƯƠNG LAI NGHIÊM NGẶT.
 * @param id - Danh tính tác vụ đã cấp.
 * @param prompt - Nội dung nhắc do người tạo gửi.
 * @param weekly - Giờ địa phương nghiêm ngặt, vùng IANA tường minh và tập thứ ISO tường minh.
 * @param now - Mốc đồng hồ DUY NHẤT lúc nhận luật, tính bằng epoch mili giây.
 * @param title - Tên tác vụ bắt buộc do người tạo gửi.
 * @returns Bản ghi weekly đã đóng băng; không có thứ tương lai thì ném time_out_of_range.
 */
export function createWeeklyScheduleRecord(
  id: ScheduleIdType,
  prompt: string,
  weekly: WeeklyInput,
  now: number,
  title: string,
): WeeklyScheduleRecord {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  const { time, timeZone, weekdays } = parseWeeklyInput(weekly);
  if (!Number.isSafeInteger(now) || now < MIN_FOUR_DIGIT_YEAR_MS || now > MAX_FOUR_DIGIT_YEAR_MS) {
    throw new ScheduleInputError("time_out_of_range", "Weekly creation time must be a representable four-digit-year UTC instant.");
  }
  const scheduledAt = nextWeeklyTarget(weeklyTime(time), timeZone, weekdays, now);
  if (scheduledAt === undefined) {
    throw new ScheduleInputError("time_out_of_range", "No future weekly occurrence is representable as a four-digit-year UTC instant.");
  }
  return Object.freeze({
    id, kind: "weekly", title: scheduleTitle(title), prompt: normalizedPrompt, time, timeZone,
    weekdays, scheduledAt,
  });
}

/**
 * Tạo luật cron đồng hồ treo tường với đích UTC bền ở TƯƠNG LAI NGHIÊM NGẶT.
 * @param id - Danh tính tác vụ đã cấp.
 * @param prompt - Nội dung nhắc do người tạo gửi.
 * @param cron - Biểu thức năm trường nghiêm ngặt và vùng IANA tường minh.
 * @param now - Mốc đồng hồ DUY NHẤT lúc nhận luật, tính bằng epoch mili giây.
 * @param title - Tên tác vụ bắt buộc do người tạo gửi.
 * @returns Bản ghi cron đã đóng băng; không có lần khớp tương lai thì ném time_out_of_range.
 */
export function createCronScheduleRecord(
  id: ScheduleIdType,
  prompt: string,
  cron: CronInput,
  now: number,
  title: string,
): CronScheduleRecord {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  const { expression, timeZone } = parseCronInput(cron);
  if (!Number.isSafeInteger(now) || now < MIN_FOUR_DIGIT_YEAR_MS || now > MAX_FOUR_DIGIT_YEAR_MS) {
    throw new ScheduleInputError("time_out_of_range", "Cron creation time must be a representable four-digit-year UTC instant.");
  }
  const scheduledAt = nextCronTarget(parseCronExpression(expression), timeZone, now);
  if (scheduledAt === undefined) {
    throw new ScheduleInputError("time_out_of_range", "No future cron occurrence is representable as a four-digit-year UTC instant.");
  }
  return Object.freeze({
    id, kind: "cron", title: scheduleTitle(title), prompt: normalizedPrompt, expression, timeZone, scheduledAt,
  });
}

/**
 * Chuẩn hoá một selector "weekly" mà KHÔNG tính đích bền mới.
 * @param weekly - Giờ địa phương nghiêm ngặt, vùng IANA tường minh và tập thứ ISO tường minh.
 * @returns Giờ đã chuẩn hoá, vùng chuẩn và các thứ duy nhất tăng dần; đầu vào sai hình dạng ném ScheduleInputError.
 */
export function parseWeeklyInput(weekly: WeeklyInput): {
  readonly time: string;
  readonly timeZone: string;
  readonly weekdays: number[];
} {
  if (
    !isRecord(weekly)
    || !hasExactKeys(weekly, ["time", "time_zone", "weekdays"])
    || typeof weekly["time"] !== "string"
  ) {
    throw new ScheduleInputError("invalid_rule", "weekly must contain exactly time, time_zone, and weekdays, with time HH:mm:ss and optional 1-3 fractional digits.");
  }
  if (typeof weekly["time_zone"] !== "string") {
    throw new ScheduleInputError("invalid_time_zone", "time_zone must be a string.");
  }
  return {
    time: weeklyTime(weekly["time"]).toString({ fractionalSecondDigits: 3 }),
    timeZone: canonicalizeTimeZone(weekly["time_zone"]),
    weekdays: normalizeWeekdays(weekly["weekdays"]),
  };
}

/** Năm trường cron theo ĐÚNG thứ tự Vixie: minute · hour · day-of-month · month · day-of-week. */
const CRON_FIELDS = [
  { name: "minute", min: 0, max: 59, canonicalMax: 59 },
  { name: "hour", min: 0, max: 23, canonicalMax: 23 },
  { name: "day-of-month", min: 1, max: 31, canonicalMax: 31 },
  { name: "month", min: 1, max: 12, canonicalMax: 12 },
  { name: "day-of-week", min: 0, max: 7, canonicalMax: 6 },
];

/** Miền giá trị và trần chuẩn hoá của MỘT trường cron. */
interface CronFieldSpec {
  /** Tên trường như xuất hiện trong chẩn đoán. */
  readonly name: string;
  /** Giá trị nhỏ nhất chấp nhận được. */
  readonly min: number;
  /** Giá trị lớn nhất chấp nhận được (day-of-week nhận cả 7). */
  readonly max: number;
  /** Giá trị lớn nhất sau khi gập về miền chuẩn (day-of-week gập 7 về 0). */
  readonly canonicalMax: number;
}

/** Một trường cron đã parse: tập giá trị khớp, cách viết chuẩn, và cờ star. */
interface ParsedCronField {
  /** Các giá trị khớp, tăng dần và duy nhất. */
  readonly values: readonly number[];
  /** Cách viết chuẩn tái parse ra đúng tập giá trị này. */
  readonly canonical: string;
  /** Trường có bắt đầu bằng `*` hay không (quyết định nhánh AND/OR của Vixie). */
  readonly star: boolean;
}

/** Biểu thức cron năm trường đã parse và chuẩn hoá. */
export interface ParsedCronExpression {
  /** Biểu thức chuẩn: năm trường cách nhau một dấu cách. */
  readonly expression: string;
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
 * Dựng chẩn đoán ổn định cho MỘT phần tử trường cron sai hình dạng.
 * @param spec - Trường đang parse.
 * @param element - Phần tử thô nằm giữa hai dấu phẩy.
 * @returns Lỗi đầu vào với thông điệp cố định.
 */
function invalidCronField(spec: CronFieldSpec, element: string): ScheduleInputError {
  return new ScheduleInputError(
    "invalid_rule",
    `cron.expression ${spec.name} field element ${JSON.stringify(element)} must be *, a value, a-b, */n, a-b/n, `
      + "or a comma-separated list of those.",
  );
}

/**
 * Đọc MỘT giá trị cron nằm trong miền của trường.
 * @param text - Text số của giá trị.
 * @param spec - Trường đang parse.
 * @returns Giá trị đã kiểm.
 */
function cronFieldValue(text: string, spec: CronFieldSpec): number {
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < spec.min || value > spec.max) {
    throw new ScheduleInputError("invalid_rule", `cron.expression ${spec.name} field value ${text} is outside ${spec.min}-${spec.max}.`);
  }
  return value;
}

/**
 * Đọc MỘT bước cron dương.
 * @param text - Text số của bước.
 * @param spec - Trường đang parse.
 * @returns Bước nguyên dương đã kiểm.
 */
function cronFieldStep(text: string, spec: CronFieldSpec): number {
  const step = Number(text);
  if (!Number.isSafeInteger(step) || step < 1) {
    throw new ScheduleInputError("invalid_rule", `cron.expression ${spec.name} field step must be a positive integer.`);
  }
  return step;
}

/**
 * Mở rộng MỘT trường cron (danh sách ngăn bởi dấu phẩy) thành tập giá trị khớp.
 * @param raw - Text trường thô.
 * @param spec - Trường đang parse.
 * @returns Các giá trị khớp đã gập miền chuẩn, tăng dần.
 */
function cronFieldValues(raw: string, spec: CronFieldSpec): number[] {
  const matched = new Set<number>();
  for (const element of raw.split(",")) {
    if (element.length === 0) {
      throw new ScheduleInputError("invalid_rule", `cron.expression ${spec.name} field must not contain an empty list element.`);
    }
    if (element === "*") {
      for (let value = spec.min; value <= spec.max; value += 1) matched.add(value);
      continue;
    }
    if (element.startsWith("*")) {
      const stepped = /^\*\/(?<step>\d+)$/.exec(element);
      const groups = stepped?.groups;
      if (groups === undefined) throw invalidCronField(spec, element);
      const stepText = groups["step"];
      /* v8 ignore next -- a successful fixed regex always provides the step group. */
      if (stepText === undefined) throw invalidCronField(spec, element);
      const step = cronFieldStep(stepText, spec);
      for (let value = spec.min; value <= spec.max; value += step) matched.add(value);
      continue;
    }
    const parsed = /^(?<start>\d+)(?:-(?<end>\d+))?(?:\/(?<step>\d+))?$/.exec(element);
    const groups = parsed?.groups;
    if (groups === undefined) throw invalidCronField(spec, element);
    const startText = groups["start"];
    /* v8 ignore next -- a successful fixed regex always provides the start group. */
    if (startText === undefined) throw invalidCronField(spec, element);
    const start = cronFieldValue(startText, spec);
    const end = groups["end"];
    const stepText = groups["step"];
    if (end === undefined) {
      if (stepText !== undefined) throw invalidCronField(spec, element);
      matched.add(start);
      continue;
    }
    const last = cronFieldValue(end, spec);
    if (start > last) {
      throw new ScheduleInputError("invalid_rule", `cron.expression ${spec.name} field range ${start}-${last} is inverted.`);
    }
    const step = stepText === undefined ? 1 : cronFieldStep(stepText, spec);
    for (let value = start; value <= last; value += step) matched.add(value);
  }
  const values = new Set<number>();
  for (const value of matched) {
    values.add(spec.canonicalMax !== spec.max && value === spec.max ? spec.min : value);
  }
  return [...values].sort((left, right) => left - right);
}

/**
 * Đọc một giá trị mà bộ mã hoá đã chứng minh là có mặt.
 * @param values - Tập giá trị khớp mà bộ parse luôn làm đầy.
 * @param index - Chỉ số do bên gọi suy ra từ chính tập đó.
 * @returns Giá trị tại chỉ số ấy.
 */
function cronFieldValueAt(values: readonly number[], index: number): number {
  const value = values[index];
  /* v8 ignore next -- a parsed cron field always matches at least one value. */
  if (value === undefined) throw new ScheduleLogError("cron field encoding requires a non-empty value set");
  return value;
}

/**
 * Mã hoá MỘT tập giá trị khớp thành trường cron ngắn nhất tương đương.
 * @param values - Các giá trị khớp theo thứ tự tăng dần.
 * @returns Text trường parse lại ra ĐÚNG `values`, không bao giờ viết bằng `*` đứng đầu.
 */
function encodeCronField(values: readonly number[]): string {
  const first = cronFieldValueAt(values, 0);
  if (values.length === 1) return String(first);
  const last = cronFieldValueAt(values, values.length - 1);
  const step = cronFieldValueAt(values, 1) - first;
  let uniform = true;
  for (let index = 2; index < values.length; index += 1) {
    if (cronFieldValueAt(values, index) - cronFieldValueAt(values, index - 1) !== step) {
      uniform = false;
      break;
    }
  }
  if (uniform) {
    if (step === 1) return `${first}-${last}`;
    return `${first}-${last}/${step}`;
  }
  const parts: string[] = [];
  let runStart = first;
  for (let index = 1; index < values.length; index += 1) {
    const current = cronFieldValueAt(values, index);
    const previous = cronFieldValueAt(values, index - 1);
    if (current === previous + 1) continue;
    parts.push(runStart === previous ? String(runStart) : `${runStart}-${previous}`);
    runStart = current;
  }
  const final = cronFieldValueAt(values, values.length - 1);
  parts.push(runStart === final ? String(runStart) : `${runStart}-${final}`);
  return parts.join(",");
}

/**
 * Một lượt đi đều từ giá trị nhỏ nhất của trường, gập ĐÚNG như bộ parse gập.
 * @param spec - Miền giá trị và trần chuẩn của trường.
 * @param step - Bước dương của lượt đi.
 * @returns Các giá trị tăng dần mà bước này sinh ra từ giá trị nhỏ nhất.
 */
function starWalk(spec: CronFieldSpec, step: number): number[] {
  const walked = new Set<number>();
  for (let value = spec.min; value <= spec.max; value += step) {
    walked.add(spec.canonicalMax !== spec.max && value === spec.max ? spec.min : value);
  }
  return [...walked].sort((left, right) => left - right);
}

/**
 * Cách viết chuẩn của trường có text BẮT ĐẦU bằng `*`.
 *
 * Chỉ cách viết mở đầu bằng `*` mới giữ được cờ star, và chỉ star trần hoặc star-step
 * (`*` rồi `/n`) mới nhận `*` đứng đầu; nên bộ mã hoá dùng star trần khi khớp toàn miền,
 * ngược lại dùng lượt star-step RỘNG NHẤT cộng phần giá trị còn lại thành danh sách.
 * Nhờ vậy parse lại tái tạo cả cờ star lẫn tập khớp — điều giữ cho phép chọn AND/OR của
 * day-of-month/day-of-week ổn định qua biểu thức chuẩn đã lưu.
 * @param values - Các giá trị khớp theo thứ tự tăng dần.
 * @param spec - Miền giá trị và trần chuẩn của trường.
 * @returns Text trường chuẩn, bắt đầu bằng `*`.
 */
function encodeStarCronField(values: readonly number[], spec: CronFieldSpec): string {
  if (values.length === spec.canonicalMax - spec.min + 1) return "*";
  const present = new Set(values);
  let bestStep: number | undefined;
  let bestWalk: number[] = [];
  for (let step = 1; step <= spec.max - spec.min + 1; step += 1) {
    const walk = starWalk(spec, step);
    if (walk.length > bestWalk.length && walk.every(value => present.has(value))) {
      bestStep = step;
      bestWalk = walk;
    }
  }
  /* v8 ignore next -- the widest step yields the single minimum, which every `*`-led field matches. */
  if (bestStep === undefined) {
    throw new ScheduleInputError("invalid_rule", `${spec.name} cannot keep a leading \`*\`.`);
  }
  const walked = new Set(bestWalk);
  const remaining = values.filter(value => !walked.has(value));
  const walkText = `*/${bestStep}`;
  return remaining.length === 0 ? walkText : `${walkText},${encodeCronField(remaining)}`;
}

/**
 * Parse MỘT trường cron thành tập giá trị khớp, cách viết chuẩn và cờ star.
 *
 * Cờ star xét ký tự ĐẦU của text trường — đúng cách Vixie đặt `DOM_STAR`/`DOW_STAR`: star có bước
 * (`*` rồi `/2`) vẫn là star dù chỉ khớp nửa miền, còn dải đầy đủ viết tường minh như `1-31` là bị
 * giới hạn. Bộ chuẩn hoá giữ nguyên cờ: trường mở đầu bằng `*` giữ cách viết mở đầu bằng `*`,
 * và trường KHÔNG mở đầu bằng `*` không bao giờ bị viết lại thành star-step.
 * @param raw - Text trường thô.
 * @param spec - Trường đang parse.
 * @returns Trường đã parse, đã đóng băng.
 */
function parseCronField(raw: string, spec: CronFieldSpec): ParsedCronField {
  const values = cronFieldValues(raw, spec);
  const star = raw.startsWith("*");
  return Object.freeze({
    values: Object.freeze(values),
    canonical: star ? encodeStarCronField(values, spec) : encodeCronField(values),
    star,
  });
}

/**
 * Parse và chuẩn hoá MỘT biểu thức cron năm trường nghiêm ngặt.
 * @param expression - Ứng viên `minute hour day-of-month month day-of-week`.
 * @returns Biểu thức đã parse, đã đóng băng; sai hình dạng ném ScheduleInputError.
 */
export function parseCronExpression(expression: string): ParsedCronExpression {
  if (typeof expression !== "string" || expression.length === 0 || expression.trim() !== expression) {
    throw new ScheduleInputError("invalid_rule", "cron.expression must be a non-empty trimmed string.");
  }
  const fields = expression.split(/\s+/);
  if (fields.length !== 5) {
    throw new ScheduleInputError("invalid_rule", "cron.expression must contain exactly five whitespace-separated fields: "
      + "minute hour day-of-month month day-of-week.");
  }
  const parsedFields = fields.map((field, index) => {
    const fieldSpec = CRON_FIELDS[index];
    /* v8 ignore next -- the five-field split bounds this index. */
    if (fieldSpec === undefined) throw new ScheduleLogError("cron field specification is missing");
    return parseCronField(field, fieldSpec);
  });
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parsedFields;
  /* v8 ignore next -- the five-field split bounds this destructuring. */
  if (minute === undefined || hour === undefined || dayOfMonth === undefined || month === undefined || dayOfWeek === undefined) {
    throw new ScheduleLogError("cron field specification is missing");
  }
  return Object.freeze({
    expression: [minute, hour, dayOfMonth, month, dayOfWeek].map(field => field.canonical).join(" "),
    minutes: minute.values,
    hours: hour.values,
    daysOfMonth: dayOfMonth.values,
    months: month.values,
    daysOfWeek: dayOfWeek.values,
    dayOfMonthStar: dayOfMonth.star,
    dayOfWeekStar: dayOfWeek.star,
  });
}

/**
 * Chuẩn hoá MỘT biểu thức cron năm trường nghiêm ngặt.
 * @param expression - Ứng viên `minute hour day-of-month month day-of-week`.
 * @returns Biểu thức chuẩn; đầu vào sai hoặc không hỗ trợ ném ScheduleInputError.
 */
export function canonicalizeCronExpression(expression: string): string {
  return parseCronExpression(expression).expression;
}

/**
 * Chuẩn hoá một selector "cron" mà KHÔNG tính đích bền mới.
 * @param cron - Biểu thức năm trường nghiêm ngặt và vùng IANA tường minh.
 * @returns Biểu thức chuẩn và vùng chuẩn; đầu vào sai hình dạng ném ScheduleInputError.
 */
export function parseCronInput(cron: CronInput): { readonly expression: string; readonly timeZone: string } {
  if (!isRecord(cron) || !hasExactKeys(cron, ["expression", "time_zone"]) || typeof cron["expression"] !== "string") {
    throw new ScheduleInputError("invalid_rule", "cron must contain exactly expression and time_zone, with a five-field cron expression.");
  }
  if (typeof cron["time_zone"] !== "string") {
    throw new ScheduleInputError("invalid_time_zone", "time_zone must be a string.");
  }
  return {
    expression: parseCronExpression(cron["expression"]).expression,
    timeZone: canonicalizeTimeZone(cron["time_zone"]),
  };
}
