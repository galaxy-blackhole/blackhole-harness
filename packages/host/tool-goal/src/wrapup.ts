/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Văn bản kết lượt model thấy sau khi một vòng goal tự động báo complete/blocked —
 *      port 1:1 vùng stock lib/index.js dòng 82–99 (region lib/types/wrapup.js): thay
 *      chỗ dừng lượt cứng cũ bằng một lời nhắn đóng, để model vẫn nói với người dùng một lần.
 */

import type { ContentBlock } from "@deepseek-ai/dsh-llm";

/** Câu đóng cho goal `complete` — nguyên văn của bản gốc, gồm cả newline trước thẻ đóng. */
const COMPLETE_INSTRUCTION =
  "The goal is marked complete and this autonomous run is ending. Write the closing message to the user now: state the outcome, summarize what was done and how it was verified, and point to the concrete results (files, commits, or other artifacts). Report only what earlier rounds and tool results in this session actually establish; when a detail is not in the session, say so instead of inventing it. Note anything the user should review or do next. Address the user directly. Do not call any more tools in this run; further work waits for the user's next instruction.\n</goal_complete>";

/** Câu đóng cho goal `blocked` — nguyên văn của bản gốc, gồm cả newline trước thẻ đóng. */
const BLOCKED_INSTRUCTION =
  "The goal is marked blocked and this autonomous run is ending. Write the closing message to the user now: state what has been completed so far, describe the concrete blocking condition and what you tried, and say exactly what you need from the user to continue. Report only what earlier rounds and tool results in this session actually establish; when a detail is not in the session, say so instead of inventing it. Address the user directly. Do not call any more tools in this run; further work waits for the user's next instruction.\n</goal_blocked>";

/**
 * Dựng chỉ dẫn đóng lượt mà model thấy sau khi một vòng goal tự động báo `complete` hoặc `blocked`.
 * Nhận: objective — mục tiêu của goal đã kết thúc (lặp lại để neo ngữ cảnh); blockedReason — báo cáo
 *       đã kiểm cho `blocked` (bỏ trống với `complete`).
 * Trả: MỘT khối văn bản mới dành cho `ToolRunContext.deferContext()`.
 */
export function renderWrapupContext(objective: string, blockedReason?: string): ContentBlock[] {
  const heading = `Objective: ${JSON.stringify(objective)}\n`;
  return [
    {
      type: "text",
      text:
        blockedReason === void 0
          ? "<goal_complete>\n" + heading + COMPLETE_INSTRUCTION
          : "<goal_blocked>\n" + heading + `Blocked: ${JSON.stringify(blockedReason)}\n` + BLOCKED_INSTRUCTION,
    },
  ];
}
