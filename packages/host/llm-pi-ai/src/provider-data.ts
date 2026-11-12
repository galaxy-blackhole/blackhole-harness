/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng provider-data của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 2794–2812
 *      (nguồn per-file: lib/types/provider-data.js): đọc metadata provider đã sinh cho bề mặt cấu
 *      hình mà KHÔNG chạy xác thực; provider chưa ghi nhận chỉ trả endpoint công khai cố định.
 *      Export: providerDefaultsOf.
 */

import type { LlmConfigurableProvider } from "@deepseek-ai/dsh-llm";
import type { Provider } from "@earendil-works/pi-ai";
import { PROVIDER_DATA } from "./provider-data.generated.ts";

/** Installed provider defaults for configuration surfaces. */

/**
 * Return generated display metadata without executing authentication.
 * Nhận: provider — provider catalog đã cài, có thể đến từ dependency mới hơn của consumer.
 * Trả: metadata đã biết, hoặc chỉ endpoint công khai cố định cho provider chưa ghi nhận.
 */
export function providerDefaultsOf(
  provider: Provider,
): Pick<LlmConfigurableProvider, "nativeAuth" | "defaultBaseURL" | "baseURLEnv"> {
  const data = PROVIDER_DATA[provider.id];
  if (data === void 0) return provider.baseUrl && !provider.baseUrl.includes("{") ? { defaultBaseURL: provider.baseUrl } : {};
  const { env, ...endpoint } = data;
  return {
    ...endpoint,
    nativeAuth: {
      env,
      oauth: provider.auth.oauth !== void 0,
    },
  };
}
