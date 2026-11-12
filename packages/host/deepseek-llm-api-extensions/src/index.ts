/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt plugin của @galaxy-blackhole/gbh-deepseek-llm-api-extensions: phơi đúng HAI tên như bản gốc
 *      (`DeepSeekLlmApiExtensionRegistry` + `default`) và khai kiểu `ctx.deepseekLlmApiExtensions`.
 */

import type { DeepSeekLlmApiExtensionRegistry } from "./registry.ts";

export { DeepSeekLlmApiExtensionRegistry } from "./registry.ts";
export { DeepSeekLlmApiExtensionRegistry as default } from "./registry.ts";
export type * from "./types.ts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Sổ trường yêu cầu mở rộng của adapter LLM DeepSeek chính thức. */
    deepseekLlmApiExtensions: DeepSeekLlmApiExtensionRegistry;
  }
}
