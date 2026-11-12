/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Văn bản nhắc nhở của row repeat-tool-reminder (bản viết lại 1:1 từ
 *      @deepseek-ai/dsh-repeat-tool-reminder): hằng nguồn `repeat-tool-reminder`, câu nhắc nhẹ ở
 *      ngưỡng đầu, câu nhắc chi tiết cho các ngưỡng sau, và hàm dựng tin nhắn user đưa vào context.
 */

import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, ContextFormed, MessageSourceMap, UserMessage } from "@deepseek-ai/dsh-llm";

// Phép nối kiểu: bản gốc khai ĐÚNG khoá này trong `lib/types/index.d.ts` (kind + ContextFormed).
declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /**
     * Nguồn của mọi tin nhắc lặp do guard này chèn — nhãn là yếu tố BẮT BUỘC: một ngữ cảnh
     * không nhãn sẽ hiện như lời nhắc của NGƯỜI DÙNG trong lịch sử suy ra từ log.
     */
    "repeat-tool-reminder": { kind: "repeat-tool-reminder" } & ContextFormed;
  }
}

/**
 * Nguồn `{kind:'repeat-tool-reminder'}` đóng lên MỌI tin nhắc guard này chèn — nhãn là yếu tố
 * BẮT BUỘC: ngữ cảnh không nhãn sẽ hiện như lời nhắc người dùng trong lịch sử suy ra.
 * Nhận: không có — hằng số dùng chung, không tham số.
 * Trả: đối tượng nguồn `{ kind: 'repeat-tool-reminder' }`, bất biến trong một tiến trình.
 */
export const REMINDER_SOURCE: { readonly kind: "repeat-tool-reminder" } = { kind: "repeat-tool-reminder" };

/**
 * Câu nhắc NHẸ ở ngưỡng ĐẦU TIÊN. Gắn với `thresholds[0]` chứ không phải một số đếm cứng, nên
 * ngưỡng đầu tuỳ biến vẫn giữ được thang nhắc nhẹ-rồi-chi-tiết của bản gốc. Nguyên văn tiếng Anh.
 * Nhận: không có — hằng số văn bản, không tham số.
 * Trả: chuỗi tiếng Anh (nguyên văn) chèn vào context khi `count === thresholds[0]`.
 */
export const GENTLE_REMINDER: string =
  "You are repeating the exact same tool call with identical arguments. Carefully analyze the previous result before calling again: if the task is not complete, try a different approach or different arguments instead of repeating the call.";

/**
 * Câu nhắc CHI TIẾT cho các ngưỡng sau: nêu tên tool, độ dài chuỗi lặp, và arguments canonical.
 * Nhận: `toolName` — tên tool đang bị lặp; `count` — số lần gọi liên tiếp cùng cặp (tool, args);
 *        `canonicalArguments` — chuỗi arguments canonical ĐÃ cắt đầu theo `argumentsPreviewChars`
 *        (phần cắt do caller làm, y bản gốc: `previewArguments`).
 * Trả: chuỗi nhiều dòng tiếng Anh, nguyên văn bản gốc (giữ nguyên cả ngắt dòng).
 */
export function detailedReminder(toolName: string, count: number, canonicalArguments: string): string {
  // Dòng thứ hai cố ý bắt đầu ở cột 0: văn bản nhắc phải giữ NGUYÊN VĂN, không thêm thụt lề.
  return `Repeated tool call detected:
- tool: ${toolName}\n- consecutive_calls: ${count}\n- arguments: ${canonicalArguments}\nThe repeated calls are not making progress. Do not call this tool with these exact arguments again. Inspect the latest result and choose a different action, different arguments, or finish the task if enough evidence has been gathered.`;
}

/**
 * Dựng tin nhắn user chở lời nhắc lặp cho MỘT lần thử vừa chạm ngưỡng (phần tạo message trong
 * `observe` của bản gốc): một block text — câu nhẹ khi `count === thresholds[0]`, ngược lại câu
 * chi tiết — cùng nguồn `repeat-tool-reminder` dạng `notice` có summary `<tool> × <count>`.
 * Nhận: `toolName` — tên tool vừa chạy; `count` — độ dài chuỗi lặp hiện tại; `thresholds` — danh
 *        sách ngưỡng ĐÃ chuẩn hoá tăng dần (caller validate trước, y `validateThresholds`);
 *        `canonicalArguments` — arguments canonical đã cắt đầu theo `argumentsPreviewChars`.
 * Trả: tin nhắn user bất biến (đã đóng băng, id mới) do `createUserMessage` dựng.
 */
export function createReminder(
  toolName: string,
  count: number,
  thresholds: readonly number[],
  canonicalArguments: string,
): UserMessage {
  const text: string =
    count === thresholds[0] ? GENTLE_REMINDER : detailedReminder(toolName, count, canonicalArguments);
  const content: readonly ContentBlock[] = [{ type: "text", text }];
  const source: MessageSourceMap["repeat-tool-reminder"] = {
    ...REMINDER_SOURCE,
    form: "notice",
    summary: `${toolName} × ${count}`,
  };
  return createUserMessage({ content, source });
}
