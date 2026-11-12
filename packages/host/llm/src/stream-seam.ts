/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Kiểu của seam waterfall `llm/stream`, lấy TỪ CHÍNH bảng `Events` của cordis thay vì import lớp peer:
 *      workspace có thể có HAI bản cài `@deepseek-ai/dsh-llm` (bản gói ta trỏ tới và bản hoisted), mỗi bản khai
 *      `LlmRuntime` riêng với private `adapters` (so kiểu NOMINAL) và `ReasoningEffortId` với symbol `BRAND`
 *      riêng — nên kiểu của bản này không gán được cho bản kia dù hình dạng y hệt.
 */

import type { Events } from "@deepseek-ai/cordis";

/** Kiểu `this` mà seam `llm/stream` đòi — luôn trúng ĐÚNG bản dsh-llm mà `ctx.waterfall` đang tham chiếu. */
export type LlmStreamThisArg = ThisParameterType<Events["llm/stream"]>;

/** Kiểu `options` của seam `llm/stream` (brand `ReasoningEffortId` theo bản cài mà `Events` tham chiếu). */
export type LlmStreamOptions = Parameters<Events["llm/stream"]>[0];

/** Kết quả seam trả về — `AsyncIterable` chunk của bản dsh-llm mà `Events` tham chiếu. */
export type LlmStreamResult = ReturnType<Events["llm/stream"]>;

/** `ctx.waterfall` của seam `llm/stream`, ép về ĐÚNG chữ ký trong bảng `Events`. */
export type LlmStreamDispatch = (
  thisArg: LlmStreamThisArg,
  name: "llm/stream",
  options: LlmStreamOptions,
  next: () => LlmStreamResult,
) => LlmStreamResult;
