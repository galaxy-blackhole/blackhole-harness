/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khoá API DeepSeek cho LLM: đăng ký route chính thức `deepseek-official` dưới dạng provider
 *      cấu hình được, phân giải khoá theo TỪNG request (credentials trước, môi trường khởi động sau),
 *      và chỉ khám phá model khi đã có khoá dùng được. Bản viết lại của Galaxy Blackhole cho row
 *      llm-deepseek (@deepseek-ai/dsh-llm-deepseek-api-key) — nguồn đối chiếu: README.md (G4).
 */

import type { Context } from "@deepseek-ai/cordis";
import { LlmError, assertUsableApiKey } from "@deepseek-ai/dsh-llm";
import { catalogModelInfo, registerDeepSeekProvider } from "@deepseek-ai/dsh-llm-deepseek";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { Config, plainOptions, resolveAdapterOptions } from "./config.ts";
import type { Options, ResolvedDeepSeekOptions } from "./config.ts";

export { Config, plainOptions, resolveAdapterOptions };
export type { Options, ResolvedDeepSeekOptions };

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "llm-deepseek-api-key";

/** Service bắt buộc: sổ provider của LLM (`llm`). */
export const inject: string[] = ["llm"];

/** Route mà row này sở hữu — nguyên văn của bản gốc. */
const PROVIDER = "deepseek-official";

/** Ảnh chụp trường `entry` mà tầng nạp gắn lên fiber (kiểu thật đến từ `cordis-plugin-loader`). */
interface EntryCarrier {
  /** Entry đang nạp plugin này, nếu có. */
  entry?: {
    /** Tuỳ chọn của entry — `id` là id row. */
    options: { id?: string };
  };
}

/**
 * Đọc id của ROW đang nạp plugin; dùng làm không gian tên cấu hình của provider.
 * Nhận: context cordis của plugin.
 * Trả: id entry, hoặc `undefined` khi plugin không được nạp từ một entry của loader.
 */
function entryIdOf(ctx: Context): string | undefined {
  return (ctx.fiber as unknown as EntryCarrier).entry?.options.id;
}

/**
 * Cài đặt route chính thức của DeepSeek: khai provider cấu hình được, đăng ký adapter với hàm phân giải
 * khoá theo từng request và hàm khám phá model bị chặn bởi credential.
 * Nhận: context cordis (đã có seam `llm`) và cấu hình đã kiểm bởi {@link Config}.
 * Trả: không; ném ngay khi cấu hình không phân giải được (fail loud như bản gốc).
 */
export function apply(ctx: Context, config: Config): void {
  /** Ảnh chụp cấu hình MỚI cho mỗi thao tác — không bao giờ dùng lại vật của lượt trước. */
  const options = (): ResolvedDeepSeekOptions => resolveAdapterOptions(plainOptions(config), launchEnvironmentOf(ctx));
  // Phân giải ngay lúc nạp: cấu hình sai phải nổ ở đây, không phải ở request đầu tiên.
  options();

  /**
   * Phân giải khoá API cho MỘT request: credentials trước, rồi môi trường khởi động khi không có seam.
   * Nhận: ảnh chụp kết nối của request (mang tham chiếu credential).
   * Trả: khoá đã kiểm và cắt khoảng trắng; ném `LlmError` khi thiếu hoặc không dùng được.
   */
  const resolveApiKey = async (connection: ResolvedDeepSeekOptions): Promise<string> => {
    const ref = connection.apiKeyEnv;
    const credentials = ctx.get("credentials");
    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref);
      if (hit !== undefined) return assertUsableApiKey(hit.value, "llm-deepseek", ref);
    } else {
      const ambient = launchEnvironmentOf(ctx).get(ref);
      if (ambient !== undefined && ambient.value.length > 0) return assertUsableApiKey(ambient.value, "llm-deepseek", ref);
    }
    throw new LlmError(
      `llm-deepseek: no API key for provider route "${PROVIDER}"; store ${ref} through the credentials service (the web Models page writes it), or export ${ref} in the launching environment`,
      "MISSING_CREDENTIAL",
    );
  };

  ctx.llm.registerConfigurableProviders([
    {
      provider: PROVIDER,
      displayName: "DeepSeek",
      settingsNs: entryIdOf(ctx) ?? "llm-deepseek-api-key",
      settingsPath: [],
    },
  ]);
  registerDeepSeekProvider(ctx, PROVIDER, {
    options,
    providerName: "DeepSeek",
    resolveAuth: async (connection) => ({ headers: { "x-api-key": await resolveApiKey(connection) } }),
    discoverModels: async (provider) => {
      // Cấu hình hỏng KHÔNG bị nuốt ở đây (khác nhánh thiếu khoá bên dưới) — y như bản gốc.
      const connection = options();
      try {
        await resolveApiKey(connection);
      } catch (error) {
        if (error instanceof LlmError && error.code === "MISSING_CREDENTIAL") return [];
        throw error;
      }
      return connection.models.map((model) => catalogModelInfo(provider, model));
    },
  });
}
