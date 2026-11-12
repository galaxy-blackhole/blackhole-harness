/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa host của row ui-chat — lược đồ cài đặt công khai cho Settings, nguyên hành vi bản gốc
 */

import z from "@deepseek-ai/schemastery";
import {
  CHAT_SETTINGS_NAMESPACE,
  ChatSettingsFields,
  COLLAPSE_TIMING_FIELD,
  DEFAULT_TRANSCRIPT_VIEW_MODE,
  LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE,
  LEGACY_TRANSCRIPT_VIEW_MODE,
  PERFORMANCE_USAGE_MODES,
  TRANSCRIPT_VIEW_FIELD,
  TRANSCRIPT_VIEW_MODES,
} from "./chat-settings.ts";

export {
  CHAT_SETTINGS_NAMESPACE,
  DEFAULT_TRANSCRIPT_VIEW_MODE,
  LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE,
  LEGACY_TRANSCRIPT_VIEW_MODE,
  TRANSCRIPT_VIEW_FIELD,
  TRANSCRIPT_VIEW_MODES,
} from "./chat-settings.ts";

/** Tuỳ chọn sống được chiếu sang trình duyệt. */
export const Config = z.object({
  [TRANSCRIPT_VIEW_FIELD]: ChatSettingsFields[TRANSCRIPT_VIEW_FIELD].volatile(),
  [COLLAPSE_TIMING_FIELD]: ChatSettingsFields[COLLAPSE_TIMING_FIELD].volatile(),
  performanceUsage: ChatSettingsFields["performanceUsage"].volatile(),
  linkOpening: ChatSettingsFields.linkOpening.volatile(),
});

/** Ngữ cảnh plugin tối thiểu mà nửa host cần — chỉ seam `settings`. */
export interface HostContext {
  /** Tiêm dịch vụ rồi chạy thân với phạm vi đã đủ dịch vụ. */
  inject: (names: readonly string[], run: (scope: SettingsScope) => void) => unknown;
  /** Sợi của plugin, dùng làm chủ sở hữu cho cấu hình. */
  fiber: unknown;
}

/** Phạm vi có dịch vụ `settings` sau khi tiêm. */
export interface SettingsScope {
  /** Sợi của phạm vi con. */
  fiber: unknown;
  /** Đăng ký một hiệu ứng vòng đời. */
  effect: (run: () => void) => unknown;
  /** Dịch vụ cài đặt của kernel. */
  settings: {
    /** Khai cấu hình của plugin này cho Settings. */
    configure: (options: { readonly auto: boolean }, owner: unknown) => unknown;
  };
}

/**
 * Điểm vào nửa host: khai cấu hình Chat cho Settings, y như bản gốc.
 * Bản gốc: `ctx.inject(["settings"], (child) => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)))`.
 * Nhận: ctx — ngữ cảnh plugin phía Host.
 * Trả: không có.
 */
export function apply(ctx: HostContext): void {
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
}

;
