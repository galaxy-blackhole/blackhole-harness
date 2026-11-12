/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cấu hình provider API-key của DeepSeek: schema `Config` (trường giao thức của
 *      @deepseek-ai/dsh-llm-deepseek + `apiKeyEnv`) và HAI bước phân giải (plainOptions ·
 *      resolveAdapterOptions) mà plugin dùng cho mỗi thao tác. Bản viết lại của Galaxy Blackhole cho row
 *      llm-deepseek (@deepseek-ai/dsh-llm-deepseek-api-key) — nguồn đối chiếu: README.md của package (G4).
 */

import { credentialRef, type CredentialRef } from "@deepseek-ai/dsh-credentials";
import {
  deepSeekConfigFields,
  plainOptions as protocolPlainOptions,
  resolveAdapterOptions as protocolResolveAdapterOptions,
  type DeepSeekConnectionOptions,
  type Options as ProtocolOptions,
} from "@deepseek-ai/dsh-llm-deepseek";
import type { LaunchEnvironmentSnapshot } from "@deepseek-ai/dsh-launch-environment";
import type { Volatile } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { Config as ProtocolConfig } from "@deepseek-ai/dsh-llm-deepseek";

/** Cấu hình Messages của route chính thức, thêm MỘT tham chiếu credential đọc lại theo từng request. */
export interface Config extends ProtocolConfig {
  /** Tham chiếu credential được phân giải mỗi request; mặc định DEEPSEEK_API_KEY. */
  apiKeyEnv: Volatile<string>;
}

/**
 * Schema cấu hình lúc chạy: đúng bộ trường giao thức của gói adapter (`deepSeekConfigFields`) cộng
 * `apiKeyEnv` có vai trò `credential-ref` — để màn Models của web ghi được khoá và Settings render
 * đúng field. Dựng lại y nguyên cách bản gốc: cùng nguồn trường, cùng thứ tự, cùng volatile.
 */
export const Config = z.object({
  ...deepSeekConfigFields,
  apiKeyEnv: z.string().role("credential-ref").default("DEEPSEEK_API_KEY").volatile(),
});

/** Đầu vào triển khai dạng phẳng cho provider API-key. */
export type Options = ProtocolOptions & {
  /** Tên biến môi trường (chưa đóng dấu) mà credential được phân giải qua. */
  apiKeyEnv?: string;
};

/** Sự thật endpoint và tham chiếu credential được chụp từ CÙNG một thế hệ cấu hình. */
export interface ResolvedDeepSeekOptions extends DeepSeekConnectionOptions {
  /** Tham chiếu credential chỉ dùng cho ảnh chụp kết nối này. */
  apiKeyEnv: CredentialRef;
}

/**
 * Đọc giá trị hiện tại phía sau mọi tham chiếu của một Config đã kiểm.
 * Nhận: cấu hình sống của plugin (các trường volatile có `.get()`).
 * Trả: đầu vào phẳng cho bước phân giải, kèm `apiKeyEnv` đã lấy giá trị.
 */
export function plainOptions(config: Config): Options {
  return {
    ...protocolPlainOptions(config),
    apiKeyEnv: config.apiKeyEnv.get(),
  };
}

/**
 * Phân giải cấu hình khoá API và cấu hình giao thức trong CÙNG một lượt.
 * Nhận: cấu hình triển khai dạng phẳng và môi trường khởi động của ứng dụng.
 * Trả: sự thật endpoint đã kiểm, kèm tham chiếu credential ĐÃ ĐÓNG DẤU (mặc định DEEPSEEK_API_KEY).
 */
export function resolveAdapterOptions(
  config: Options,
  environment?: LaunchEnvironmentSnapshot,
): ResolvedDeepSeekOptions {
  return {
    ...protocolResolveAdapterOptions(config, environment),
    apiKeyEnv: credentialRef(config.apiKeyEnv ?? "DEEPSEEK_API_KEY"),
  };
}
