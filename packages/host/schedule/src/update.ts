/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sửa lạc quan tên, câu nhắc và thời gian của tác vụ Host đang giữ, KHÔNG đụng vào Session: so
 *      bản ghi quan sát đầy đủ rồi phân giải một thay đổi thời gian + nội dung. Port 1:1 từ update.js
 *      (163 dòng) của @deepseek-ai/dsh-schedule.
 */

import { isDeepStrictEqual } from "node:util";

import {
  ScheduleInputError,
  ScheduleLogError,
  canonicalizeTimeZone,
  decodeScheduleRecord,
  decodeStoredTitle,
  scheduleTitle,
} from "./codec.ts";
import {
  canonicalizeCronExpression,
  createAtScheduleRecord,
  createCronScheduleRecord,
  createDailyScheduleRecord,
  createEveryScheduleRecord,
  createWeeklyScheduleRecord,
  parseAtInput,
  parseCronInput,
  parseDailyInput,
  parseWeeklyInput,
} from "./records.ts";
import type { ScheduleRecord, ScheduleTimingChange, ScheduleUpdateContent, ScheduleUpdateResult } from "./types.ts";

/**
 * Nêu đúng tên thuộc tính selector mà mỗi kiểu thời gian phải mang, hoặc undefined khi discriminant
 * không thuộc tập đóng.
 * @param kind - Giá trị discriminant chưa tin cậy từ dây (có thể null, mảng, hay giá trị lạ).
 * @returns Tên thuộc tính selector tương ứng, hoặc undefined.
 */
function timingSelector(kind: unknown): string | undefined {
  switch (kind) {
    case "at": return "at";
    case "every": return "every_seconds";
    case "daily": return "daily";
    case "weekly": return "weekly";
    case "cron": return "cron";
    default: return undefined;
  }
}

/**
 * Kiểm đúng các khoá selector thời gian nhận được qua RPC.
 * @param value - Thay đổi thời gian chưa tin cậy; dây có thể mang null, mảng, hoặc discriminant lạ.
 * @returns Chính giá trị đó, đã thu hẹp về hợp thay đổi thời gian ĐÓNG.
 */
function validateChange(value: unknown): ScheduleTimingChange {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ScheduleInputError("invalid_rule", "Timing change must be an object with exactly one supported timing selector.");
  }
  const change = value as Record<string, unknown>;
  const selector = timingSelector(change["kind"]);
  const keys = Object.keys(change);
  if (selector === undefined || keys.length !== 2 || !keys.includes("kind") || !keys.includes(selector)) {
    throw new ScheduleInputError("invalid_rule", "Timing change must contain exactly kind and its matching timing selector.");
  }
  return change as unknown as ScheduleTimingChange;
}

/**
 * Kiểm một câu nhắc thay thế nhận được qua RPC.
 * @param prompt - Giá trị câu nhắc chưa tin cậy; dây có thể mang giá trị không phải chuỗi.
 * @returns Câu nhắc đã trim; câu nhắc không hợp lệ ném ScheduleInputError.
 */
function schedulePrompt(prompt: unknown): string {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new ScheduleInputError("invalid_prompt", "prompt must be non-empty after trimming.");
  }
  return prompt.trim();
}

/**
 * Tên mà MỘT lượt sửa phải hoặc giữ nguyên hoặc thay thế.
 *
 * Bản ghi đã giải mã luôn mang tên đã lưu. Giá trị bản ghi thiếu tên hợp lệ bị từ chối bằng đúng lỗi
 * giải mã bền, không suy ra tên từ câu nhắc.
 * @param record - Bản ghi Host đang hoạt động hiện tại.
 * @returns Tên đã lưu; tên thiếu, rỗng, chưa trim, hoặc quá dài ném ScheduleLogError.
 */
export function retainedTitle(record: ScheduleRecord): string {
  return decodeStoredTitle(record.title);
}

/**
 * Áp một tên và câu nhắc thay thế lên bản ghi đã lưu mà không chạm vào quy tắc của nó.
 * @param current - Bản ghi đang hoạt động giữ đích đã cam kết.
 * @param title - Tên thay thế đã kiểm, hoặc tên giữ nguyên.
 * @param prompt - Câu nhắc thay thế đã kiểm, hoặc câu nhắc giữ nguyên.
 * @returns Chính bản ghi đó khi cả hai không đổi; ngược lại một bản sao đã đóng băng mang nội dung mới.
 */
function withContent(current: ScheduleRecord, title: string, prompt: string): ScheduleRecord {
  return title === current.title && prompt === current.prompt
    ? current
    : Object.freeze({ ...current, title, prompt });
}

/**
 * Phân giải quy tắc được yêu cầu với bản ghi hiện tại, sau khi TOÀN BỘ bản ghi quan sát đã khớp.
 *
 * Kiểu thay đổi có thể khác kiểu của bản ghi hiện tại; thay đổi mà thời gian chuẩn hoá bằng quy tắc
 * hiện tại thì giữ đích đã cam kết và chỉ áp tên + câu nhắc được gửi, còn thay đổi khác thì tính lại
 * đích đúng như lúc tạo với cùng mốc now.
 * @param current - Bản ghi đang hoạt động hiện tại.
 * @param title - Tên đã kiểm (thay thế hoặc giữ nguyên).
 * @param prompt - Câu nhắc đã kiểm (thay thế hoặc giữ nguyên).
 * @param value - Selector thời gian nghiêm ngặt chưa tin cậy, hoặc undefined để giữ nguyên thời gian.
 * @param now - Mốc đồng hồ tường duy nhất của lượt được nhận trong FIFO.
 * @returns Bản ghi hiện tại hoặc bản ghi mới đã đóng băng.
 */
function changedRecord(
  current: ScheduleRecord,
  title: string,
  prompt: string,
  value: unknown,
  now: number,
): ScheduleRecord {
  if (value === undefined) return withContent(current, title, prompt);
  const change = validateChange(value);
  switch (change.kind) {
    case "at":
      if ((current.kind === "after" || current.kind === "at")
        && parseAtInput(change.at) === Date.parse(current.scheduledAt)) return withContent(current, title, prompt);
      return createAtScheduleRecord(current.id, prompt, change.at, now, title);
    case "every":
      if (current.kind === "every" && change.every_seconds === current.everySeconds) {
        return withContent(current, title, prompt);
      }
      return createEveryScheduleRecord(current.id, prompt, change.every_seconds, now, title);
    case "daily": {
      if (current.kind === "daily") {
        const normalized = parseDailyInput(change.daily);
        if (normalized.time === current.time
          && normalized.timeZone === canonicalizeTimeZone(current.timeZone)) return withContent(current, title, prompt);
      }
      return createDailyScheduleRecord(current.id, prompt, change.daily, now, title);
    }
    case "weekly": {
      if (current.kind === "weekly") {
        const normalized = parseWeeklyInput(change.weekly);
        if (normalized.time === current.time
          && normalized.timeZone === canonicalizeTimeZone(current.timeZone)
          && isDeepStrictEqual(normalized.weekdays, current.weekdays)) return withContent(current, title, prompt);
      }
      return createWeeklyScheduleRecord(current.id, prompt, change.weekly, now, title);
    }
    case "cron": {
      if (current.kind === "cron") {
        const normalized = parseCronInput(change.cron);
        if (normalized.expression === canonicalizeCronExpression(current.expression)
          && normalized.timeZone === canonicalizeTimeZone(current.timeZone)) return withContent(current, title, prompt);
      }
      return createCronScheduleRecord(current.id, prompt, change.cron, now, title);
    }
    /* v8 ignore next 4 -- validateChange rejects unknown discriminants before this closed union switch. */
    default: {
      const unreachable: never = change;
      throw new Error(`Unknown validated timing change: ${String(unreachable)}`);
    }
  }
}

/**
 * So TOÀN BỘ bản ghi quan sát rồi phân giải một lượt sửa tên, câu nhắc và thời gian bằng đúng MỘT mốc
 * đồng hồ lấy lúc xếp hàng.
 *
 * Thay đổi, tên, hoặc câu nhắc bỏ trống thì giữ giá trị đã lưu. Tên hay câu nhắc được gửi KHÔNG tự
 * neo lại lịch; thay đổi thời gian tương đương sau chuẩn hoá cũng giữ đích đã cam kết.
 * @param current - Bản ghi Host đang hoạt động hiện tại.
 * @param expected - Bản ghi đầy đủ chưa tin cậy do người gọi quan sát.
 * @param change - Selector thời gian nghiêm ngặt (kiểu có thể khác bản ghi hiện tại), hoặc undefined để giữ thời gian.
 * @param now - Mốc đồng hồ tường duy nhất của lượt được nhận trong FIFO.
 * @param content - Tên và câu nhắc thay thế chưa tin cậy; trường bỏ trống giữ giá trị đã lưu.
 * @returns Bản ghi hiện tại/mới, hoặc kết quả đầu vào/xung đột có biên; lỗi không liên quan được ném ra.
 */
export function resolveScheduleUpdate(
  current: ScheduleRecord,
  expected: ScheduleRecord,
  change: ScheduleTimingChange | undefined,
  now: number,
  content: ScheduleUpdateContent = {},
): ScheduleUpdateResult {
  let decoded: ScheduleRecord;
  try {
    decoded = decodeScheduleRecord(expected);
  } catch (error) {
    if (!(error instanceof ScheduleLogError)) throw error;
    return { code: "invalid_rule", message: "expected must be a complete valid Schedule record." };
  }
  if (!isDeepStrictEqual(current, decoded)) {
    return { id: current.id, updated: false, code: "schedule_conflict" };
  }
  try {
    const retained = retainedTitle(current);
    const title = content.title === undefined ? retained : scheduleTitle(content.title);
    const prompt = content.prompt === undefined ? current.prompt : schedulePrompt(content.prompt);
    const record = changedRecord(current, title, prompt, change, now);
    return { id: current.id, updated: record !== current, record };
  } catch (error) {
    if (!(error instanceof ScheduleInputError)) throw error;
    return { code: error.code, message: error.message };
  }
}
