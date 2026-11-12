/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package plugin-package-inventory-deepseek: đăng ký trường mở rộng
 *      `dsh_plugin_packages` cho request tới API DeepSeek chính thức. Danh tính gói được phân
 *      giải LÚC REQUEST (entry host + bố cục preset của agent đang gọi), không phải lúc nạp.
 *      Bản viết lại của Galaxy Blackhole cho row `plugin-package-inventory-deepseek`.
 */

import z from "@deepseek-ai/schemastery";

import { PackageIdentityResolver } from "./identity.ts";
import { collectActivePluginPackages } from "./inventory.ts";
import type {
  DeepSeekExtensionContribution,
  PackageRegistry,
  PluginPackageInventoryContext,
} from "./types.ts";

export type * from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "plugin-package-inventory-deepseek";

/** Service bắt buộc: sổ agent, sổ trường mở rộng request DeepSeek, và cây Loader. */
export const inject: string[] = ["agents", "deepseekLlmApiExtensions", "loader"];

/** Cấu hình của trường `dsh_plugin_packages`. */
export interface Config {
  /** Có đóng góp `dsh_plugin_packages` vào request chính thức hay không; mặc định `true`. */
  enabled?: boolean;
}

/** Schema cấu hình lúc chạy cho {@link Config}: mặc định BẬT, để Settings/config-editor render được field. */
export const Config = z.object({ enabled: z.boolean().default(true) });

/**
 * Đăng ký trường `dsh_plugin_packages` khi cấu hình không tắt nó.
 * Nhận: context cordis (loader · agents · deepseekLlmApiExtensions · logger · `get`) và cấu hình
 * đã kiểm bởi {@link Config}.
 * Trả: không trả gì — tác dụng phụ DUY NHẤT là một lượt `register` trên sổ trường mở rộng; mỗi
 * lần gọi tạo bộ phân giải và sổ cảnh báo RIÊNG (hai lần cài không chia sẻ trạng thái).
 * @param ctx - context plugin.
 * @param config - cấu hình đã kiểm.
 * @returns không trả gì.
 */
export function apply(ctx: PluginPackageInventoryContext, config: Config): void {
  if (config.enabled === false) return;
  const hostBaseUrl = ctx.baseUrl ?? import.meta.url;
  const resolver = new PackageIdentityResolver(
    hostBaseUrl,
    ctx.get("pluginPackages") as PackageRegistry | undefined,
  );
  const unreadable = new Set<string>();
  const contribution: DeepSeekExtensionContribution = {
    prepare: (request) => {
      return {
        value: {
          version: 1,
          packages: collectActivePluginPackages(ctx, resolver, hostBaseUrl, unreadable, request.sessionId),
        },
      };
    },
  };
  ctx.deepseekLlmApiExtensions.register("dsh_plugin_packages", contribution);
}
