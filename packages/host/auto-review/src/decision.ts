/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đọc dòng chunk của bộ duyệt: gom khối, đòi ĐÚNG một khối chữ cuối cùng, rồi phân tích giao
 *      thức risk/decision đóng. Nguyên văn hành vi gói gốc (lib/index.js dòng 333–396).
 */

import { BlockAssembler } from "@deepseek-ai/dsh-llm";
import type { StreamChunk } from "@deepseek-ai/dsh-llm";
import type { ReviewDecision } from "./types.ts";

/**
 * Đếm số thành viên ở mức NGOÀI CÙNG của một vật thể JSON thô.
 * Nhận: `text` — văn bản JSON (có thể chứa chuỗi lồng dấu ngoặc).
 * Trả: số dấu `:` ở độ sâu 1 — tức số thành viên, kể cả thành viên TRÙNG tên.
 */
export function topLevelMemberCount(text: string): number {
  const syntax = text.replace(/"(?:\\.|[^"\\])*"/gs, "");
  let depth = 0;
  let count = 0;
  for (const char of syntax)
    switch (char) {
      case "{":
      case "[":
        depth += 1;
        break;
      case "}":
      case "]":
        depth -= 1;
        break;
      case ":":
        if (depth === 1) count += 1;
    }
  return count;
}

/**
 * Phân tích giao thức risk/decision ĐÓNG và các tổ hợp an toàn cố định.
 * Nhận: `text` — văn bản JSON của bộ duyệt.
 * Trả: kết luận hợp lệ; ném khi không phải một vật thể, khi lặp thành viên, hoặc tổ hợp không hợp lệ.
 */
export function parseDecision(text: string): ReviewDecision {
  const value: unknown = JSON.parse(text);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("auto-review: reviewer output must be one JSON object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (topLevelMemberCount(text) !== keys.length) throw new Error("auto-review: reviewer output repeats a JSON member");
  const risk = record["risk"];
  const decision = record["decision"];
  if (keys.length === 2 && decision === "allow" && (risk === "low" || risk === "medium")) return { risk, decision };
  if (keys.length === 2 && decision === "deny" && (risk === "medium" || risk === "high")) return { risk, decision };
  if (
    decision === "deny" &&
    (risk === "medium" || risk === "high") &&
    keys.length === 3 &&
    Object.hasOwn(record, "reason") &&
    typeof record["reason"] === "string"
  ) {
    return { risk, decision, reason: record["reason"] };
  }
  throw new Error("auto-review: reviewer output does not match the risk/decision protocol");
}

/**
 * Đọc zero hoặc nhiều khối suy luận, ĐÚNG MỘT khối chữ JSON, và một mốc kết thúc.
 * Nhận: `stream` — dòng chunk của bộ duyệt.
 * Trả: kết luận đã phân tích; ném khi có dữ liệu sau mốc kết thúc, khi kết thúc không phải `stop`,
 * khi thiếu mốc kết thúc, hoặc hình dạng khối sai.
 */
export async function readDecision(stream: AsyncIterable<StreamChunk>): Promise<ReviewDecision> {
  const assembler = new BlockAssembler();
  let finished = false;
  for await (const chunk of stream) {
    if (finished) throw new Error("auto-review: reviewer emitted data after its terminal finish");
    assembler.push(chunk);
    if (chunk.type === "finish") {
      finished = true;
      if (chunk.reason.kind === "error" || chunk.reason.kind === "aborted") {
        const { code, message } = chunk.reason.failure;
        throw new Error(`auto-review: reviewer ended with ${chunk.reason.kind} ${code}: ${message}`);
      }
      if (chunk.reason.kind !== "stop") throw new Error(`auto-review: reviewer ended with ${chunk.reason.kind}`);
    }
  }
  if (!finished) throw new Error("auto-review: reviewer emitted no terminal finish");
  const blocks = assembler.blocks();
  const final = blocks.at(-1);
  if (final?.type !== "text" || blocks.slice(0, -1).some((block) => block.type !== "reasoning")) {
    throw new Error("auto-review: reviewer must emit zero or more reasoning blocks followed by exactly one text block");
  }
  return parseDecision(final.text);
}
