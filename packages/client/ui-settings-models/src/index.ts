/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa host của row ui-settings-models — phát tuỳ chọn onboarding công khai vào trang
 */

import z from "@deepseek-ai/schemastery";
import { ONBOARDING_CONFIG_GLOBAL } from "./ids.ts";

/** Tuỳ chọn cấu hình của plugin, do Loader áp mặc định của schema trước khi gọi apply. */
export interface ConfigShape {
  /** Có bật bước nhập khoá DeepSeek chính thức cho người dùng chạy lần đầu không. */
  readonly credentialOnboarding: boolean;
}

/**
 * Schema cấu hình của plugin — schemastery, để Settings/config-editor của kernel render được field.
 *
 * Giữ nguyên như bản gốc: §z.object({ credentialOnboarding: z.boolean().default(true) })§ — người dùng
 * có thể tắt riêng bước credential, phần còn lại của onboarding vẫn chạy.
 */
export const Config = z.object({ credentialOnboarding: z.boolean().default(true) });

/** Một dòng trong bảng dữ liệu khởi tạo trang của webserver. */
export interface IndexInjectEntry {
  /** Loại giá trị: hằng toàn cục của trang. */
  readonly kind: "global";
  /** Tên biến toàn cục. */
  readonly name: string;
  /** Giá trị công khai. */
  readonly value: { readonly credentialOnboarding: boolean };
}

/** Bề mặt context phía host mà row này dùng. */
export interface HostCtx {
  /** Nghe một sự kiện của kernel; row này chỉ dùng webserver/index-inject. */
  on(event: "webserver/index-inject", run: (table: IndexInjectEntry[]) => void): void;
}

/**
 * Điểm vào nửa host: phát tuỳ chọn onboarding công khai trước khi plugin phía browser kích hoạt.
 * @param ctx - context phía host.
 * @param config - tuỳ chọn plugin sau khi Loader áp mặc định của schema.
 * @returns không.
 */
export function apply(ctx: HostCtx, config: ConfigShape): void {
  ctx.on("webserver/index-inject", (table) => {
    table.push({
      kind: "global",
      name: ONBOARDING_CONFIG_GLOBAL,
      value: { credentialOnboarding: config.credentialOnboarding },
    });
  });
}
