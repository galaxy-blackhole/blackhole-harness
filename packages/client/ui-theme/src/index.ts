/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Nua HOST cua row ui-theme: bom bang mau TRUOC khi plugin chay (webserver/index-inject) + schema Config
 *   — chuyen 1:1 tu lib/index.js cua goi goc (@deepseek-ai/dsh-client-ui-theme)
 */

import z from "@deepseek-ai/schemastery";

import { bootThemeInjections } from "./boot-theme.ts";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_PREFERENCE,
  FONT_SIZE_FIELD,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_SPECS,
  THEME_PREFERENCES,
  THEME_PREFERENCE_FIELD,
  THEME_SETTINGS_NAMESPACE,
} from "./theme-settings.ts";
import type { FontSizeSpec, ThemePreference, ThemeSection } from "./theme-settings.ts";

/** Kiểu tối thiểu của schemastery mà nửa host dùng (giữ đúng chuỗi gọi của bản gốc). */
interface SchemaApi {
  /** Schema số. */
  number(): { step(n: number): { min(n: number): { max(n: number): { default(n: number): unknown } } } };
  /** Schema chuỗi. */
  string(): { default(v: string): { volatile(): unknown } };
  /** Hợp các giá trị. */
  union(values: string[]): { default(v: string): { volatile(): unknown } };
  /** Schema đối tượng. */
  object(shape: Record<string, unknown>): unknown;
}

/** schemastery dưới dạng hàm gọi được (bản gốc import mặc định). */
const schema = z as unknown as SchemaApi;

/**
 * Schema số nguyên px cho cỡ chữ của một vai trò.
 * @param spec - khoảng và mặc định của vai trò.
 * @returns schema đã validate.
 */
function fontSizeSchema(spec: FontSizeSpec): { volatile(): unknown } {
  return schema.number().step(1).min(spec.min).max(spec.max).default(spec.default) as { volatile(): unknown };
}

/** Tuỳ chọn theme/typography sống của Host (bản gốc: Config trong lib/index.js dòng 187-195). */
export const Config = schema.object({
  preference: schema.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE).volatile(),
  fontSize: fontSizeSchema(FONT_SIZE_SPECS.text).volatile(),
  codeFontSize: fontSizeSchema(FONT_SIZE_SPECS.code).volatile(),
  terminalFontSize: fontSizeSchema(FONT_SIZE_SPECS.terminal).volatile(),
  textFontFamily: schema.string().default("").volatile(),
  codeFontFamily: schema.string().default("").volatile(),
  terminalFontFamily: schema.string().default("").volatile(),
});

/** Một giá trị cấu hình đọc được bằng get() (cordis volatile). */
export interface VolatileValue<T> {
  /** @returns giá trị hiện tại. */
  get(): T;
}

/** Cấu hình đã validate mà apply nhận (bản gốc: interface Config trong lib/types/index.d.ts). */
export interface ThemeConfig {
  /** Tuỳ chọn palette của trình duyệt. */
  preference: VolatileValue<ThemePreference>;
  /** Cỡ chữ nội dung (px). */
  fontSize: VolatileValue<number>;
  /** Cỡ chữ khối mã (px). */
  codeFontSize: VolatileValue<number>;
  /** Cỡ chữ terminal thanh bên (px). */
  terminalFontSize: VolatileValue<number>;
  /** Danh sách font giao diện/nội dung. */
  textFontFamily: VolatileValue<string>;
  /** Danh sách font mã. */
  codeFontFamily: VolatileValue<string>;
  /** Danh sách font terminal. */
  terminalFontFamily: VolatileValue<string>;
}

/** Phần context cordis mà nửa host dùng. */
export interface HostContext {
  /**
   * Chạy callback khi dịch vụ có mặt.
   * @param services - tên dịch vụ.
   * @param callback - hàm nhận scope con.
   */
  inject(services: readonly string[], callback: (scope: HostScope) => void): void;
  /**
   * Nghe sự kiện (tuỳ chọn prepend).
   * @param event - tên sự kiện.
   * @param listener - hàm xử lý; nhận bảng dòng bơm index.
   * @param options - tuỳ chọn prepend.
   */
  on(event: string, listener: (table: unknown[]) => void, options?: { prepend?: boolean }): void;
  /** Sợi plugin hiện tại (dùng khi cấu hình settings tự động). */
  fiber?: unknown;
}

/** Scope con khi dịch vụ settings có mặt. */
export interface HostScope {
  /** Chạy hiệu ứng sống theo plugin. */
  effect(effect: () => void | (() => void)): void;
  /** Seam settings của kernel. */
  settings: {
    /**
     * Cấu hình namespace do plugin sở hữu.
     * @param options - tuỳ chọn (auto:false = tắt tự động).
     * @param owner - sợi sở hữu.
     */
    configure(options: { auto: boolean }, owner?: unknown): void;
  };
}

/**
 * Cấp bảng màu hiện tại TRƯỚC khi plugin browser chạy: bơm CSS ở head (tô màu canvas) + script ở body
 * (đặt palette và biến font), rồi tắt cấu hình tự động của settings cho namespace này.
 * @param ctx - context cordis phía Host.
 * @param config - tuỳ chọn theme/typography đã validate.
 * @returns không.
 */
export function apply(ctx: HostContext, config: ThemeConfig): void {
  ctx.inject(["settings"], (child) => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  });
  ctx.on(
    "webserver/index-inject",
    (table) => {
      table.push(
        ...bootThemeInjections(
          config.preference.get(),
          { text: config.fontSize.get(), code: config.codeFontSize.get(), terminal: config.terminalFontSize.get() },
          { text: config.textFontFamily.get(), code: config.codeFontFamily.get(), terminal: config.terminalFontFamily.get() },
        ),
      );
    },
    { prepend: true },
  );
}

export {
  DEFAULT_FONT_SIZE,
  DEFAULT_PREFERENCE,
  FONT_SIZE_FIELD,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  THEME_PREFERENCES,
  THEME_PREFERENCE_FIELD,
  THEME_SETTINGS_NAMESPACE,
};
/** Bí danh CÔNG KHAI của stock: gói gốc xuất `ThemeSettings` (theme-settings.d.ts:86); ta đặt `ThemeSection`.
 * Nhận: không (chỉ là bí danh kiểu). Trả: không — giữ cho consumer viết theo tên stock vẫn biên dịch được. */
type ThemeSettings = ThemeSection;

export type { ThemePreference, ThemeSettings };