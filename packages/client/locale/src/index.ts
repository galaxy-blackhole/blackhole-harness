/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row locale: schema cai dat \`locale\` + dang ky pham vi cau hinh voi kernel
 */

import z from "@deepseek-ai/schemastery";
import { LOCALE_ID_PATTERN, LOCALE_PREFERENCE_FIELD } from "./ids.ts";

// Ba hằng số này thuộc BỀ MẶT của package (bản gốc export chúng ở gốc gói) — thiếu là `check:rows` báo
// "thiếu export", và cổng mount sẽ bỏ qua cả gói.
export { LOCALE_IDS, LOCALE_PREFERENCE_FIELD, LOCALE_SETTINGS_NAMESPACE } from "./ids.ts";

/** Các trường của schema ngôn ngữ (một lựa chọn tường minh, có thể vắng). */
const LocaleSettingsFields = {
  [LOCALE_PREFERENCE_FIELD]: z.string().pattern(LOCALE_ID_PATTERN).required(false),
};

/** Schema BỀN của mục cài đặt `locale` (cũng là phong bì wire mà nửa browser kiểm). */
z.object(LocaleSettingsFields);

/** Tuỳ chọn SỐNG mà nửa browser nhận: trường `preference` chỉ sống trong phiên. */
export const Config = z.object({ [LOCALE_PREFERENCE_FIELD]: LocaleSettingsFields[LOCALE_PREFERENCE_FIELD].volatile() });

/** Context host (chỉ seam mà row này dùng). */
export interface HostContext {
  /**
   * Chạy phần thân khi service `settings` đã có.
   * Nhận: `names` — tên service cần, `body` — thân chạy trong context con.
   * Trả: không.
   */
  inject(names: string[], body: (child: HostChildContext) => void): void;
  /** Sợi plugin (truyền cho `settings.configure` làm chủ sở hữu). */
  fiber: unknown;
}

/** Context con mà `ctx.inject` cấp. */
export interface HostChildContext {
  /** Gắn hiệu ứng vào vòng đời của context con. */
  effect(callback: () => unknown): void;
  /** Seam cài đặt của kernel. */
  settings: {
    /**
     * Cấu hình phạm vi cài đặt do plugin này sở hữu.
     * Nhận: `options` — `{ auto }` (false: mục cài đặt không tự hiện), `owner` — sợi plugin.
     * Trả: không.
     */
    configure(options: { auto: boolean }, owner: unknown): void;
  };
}

/**
 * Điểm vào phía host: đăng ký phạm vi cài đặt `locale` với kernel (không tự hiện thành mục).
 * Nhận: `ctx` — context host.
 * Trả: không.
 */
export function apply(ctx: HostContext): void {
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
