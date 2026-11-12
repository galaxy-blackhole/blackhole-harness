/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nửa host của row ui-settings-general: khai Config (welcomeNoticeVersion) và bảo kernel settings chạy auto=false
 */

import z from "@deepseek-ai/schemastery";

/**
 * Cấu hình sống của row: phiên bản thông báo chào đang giữ ở lớp profile.
 *
 * Gốc: `z.object({ welcomeNoticeVersion: z.string().volatile() })` (lib/index.js của bản gốc). Trường `volatile()`
 * nghĩa là giá trị không nằm trong file cấu hình mà do lớp profile/Host cấp lúc chạy — đúng cách row này được ghim
 * trong app.patch.yml.
 */
export const Config = z.object({ welcomeNoticeVersion: z.string().volatile() });

/** Context tối thiểu của nửa host (seam settings của kernel). */
interface HostContext {
  /** Fiber của plugin (dùng khi báo kernel cấu hình). */
  readonly fiber: unknown;
  /**
   * Inject seam settings (tùy chọn ở môi trường rút gọn — thiếu thì cảnh báo, KHÔNG ném).
   * @param names - tên seam.
   * @param run - hàm chạy khi seam có.
   */
  inject?(names: readonly string[], run: (child: SettingsChild) => void): void;
}

/** Context con sau khi inject seam settings. */
interface SettingsChild {
  /**
   * Đăng ký hiệu ứng sống theo plugin.
   * @param effect - hàm trả về disposer.
   */
  effect(effect: () => void | (() => void)): void;
  /** Seam settings của kernel. */
  readonly settings: {
    /**
     * Báo kernel rằng cấu hình của row này không do kernel tự quản.
     * @param options - tùy chọn (auto).
     * @param fiber - fiber của plugin.
     */
    configure(options: { auto: boolean }, fiber: unknown): void;
  };
}

/**
 * Thân plugin phía host.
 *
 * Gốc làm đúng hai việc: `Config` ở trên, và `settings.configure({ auto: false })` để kernel không tự ghi cấu hình
 * (giá trị đến từ lớp profile). Bản viết lại giữ nguyên hai việc đó; thiếu seam `settings` (môi trường rút gọn) thì
 * chỉ cảnh báo — khuôn #5: tính năng phụ tắt, KHÔNG giết cả cây.
 * @param ctx - context phía host.
 */
export function apply(ctx: HostContext): void {
  if (typeof ctx.inject !== "function") {
    console.warn("gbh-client-ui-settings-general: host context khong co inject — bo qua settings.configure");
    return;
  }
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}
