/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Mặt plugin của @galaxy-blackhole/gbh-shell-env — bản viết lại của row shell-env: môi trường
 *      shell độc lập với tool, sở hữu sổ ctx.shellEnv các biến DSH_* tin cậy mà dsh-tool-bash và
 *      dsh-tool-pwsh đọc ở mỗi lời gọi.
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

import { ShellEnvRegistry } from "./registry.ts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Sổ đăng ký biến DSH_* tin cậy cho từng lượt gọi shell của model. */
    shellEnv: ShellEnvRegistry;
  }
}

/** Tên plugin trong đồ thị nạp của kernel. */
export const name = "shell-env";

/** Seam cần có trước khi apply chạy — bản gốc không chờ dịch vụ nào. */
export const inject: string[] = [];

/** Cấu hình plugin (mọi trường tuỳ chọn — các sự thật dựng sẵn vẫn phân giải được khi không có). */
export interface Config {
  /** Thư mục home, phơi ra DSH_HOME; mặc định $GBH_HOME (mới) → $DSH_HOME (đường lùi) → ~/.dsh. */
  dshHome?: string;
}

/** Schema cấu hình lúc chạy cho plugin shell-env (dshHome bắt buộc ở tầng schema, y bản gốc). */
export const Config = z.object({ dshHome: z.string() }) as unknown as z<Config>;

export { ShellEnvRegistry };
// 08/11/2026 (R5 — hàng đợi dev-3): stock phơi thêm 3 KIỂU của hợp đồng env (BashEnvVariable · BashEnvContributor ·
// BashEnvVariableInfo) ở gốc; ta khai chúng trong ./types.ts nên tái xuất ở đây — thuần KIỂU, không đổi runtime.
export type * from "./types.ts";

/**
 * Nạp plugin shell-env: đăng ký dịch vụ sổ đăng ký ctx.shellEnv.
 * Nhận: context cordis sở hữu dịch vụ + cấu hình home (tuỳ chọn).
 * Trả: không — hiệu ứng là dịch vụ shellEnv đã có mặt trên context.
 */
export function apply(ctx: Context, config: Config = {}): void {
  new ShellEnvRegistry(ctx, config);
}
