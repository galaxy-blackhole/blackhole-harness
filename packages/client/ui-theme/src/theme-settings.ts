/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc theme-settings: hang so + chuan hoa font + kiem tra gia tri — chuyen 1:1 tu theme-settings.js
 *   cua bundle goc (lib/index.js dong 2-125, lib/client.js dong 984-1131)
 */

/** Ba tuy chon theme dung san (thứ tự NGUYÊN VĂN của bản gốc). */
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;

/** Một tuỳ chọn theme. */
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Namespace settings của Host nơi row giữ tuỳ chọn. */
export const THEME_SETTINGS_NAMESPACE = "ui-theme";

/** Trường giữ tuỳ chọn theme đã chọn. */
export const THEME_PREFERENCE_FIELD = "preference";

/** Trường giữ cỡ chữ nội dung hội thoại. */
export const FONT_SIZE_FIELD = "fontSize";

/** Tuỳ chọn mặc định khi tài liệu settings chưa có ghi đè. */
export const DEFAULT_PREFERENCE: ThemePreference = "system";

/** Cỡ chữ nội dung nhỏ nhất (px). */
export const FONT_SIZE_MIN = 10;

/** Cỡ chữ nội dung lớn nhất (px). */
export const FONT_SIZE_MAX = 22;

/** Cỡ chữ nội dung mặc định (px). */
export const DEFAULT_FONT_SIZE = 14;

/** Ba vai trò font cấu hình độc lập. */
export const FONT_ROLES = ["text", "code", "terminal"] as const;

/** Vai trò font. */
export type FontRole = (typeof FONT_ROLES)[number];

/** Đặc tả một vai trò font (trường settings · biến CSS · khoảng · mặc định). */
export interface FontSizeSpec {
  /** Trường trong namespace settings. */
  readonly field: string;
  /** Biến CSS được Host đặt lên body. */
  readonly variable: string;
  /** Nhỏ nhất (px). */
  readonly min: number;
  /** Lớn nhất (px). */
  readonly max: number;
  /** Mặc định (px). */
  readonly default: number;
}

/**
 * Cỡ chữ theo vai trò. text là cỡ nội dung hội thoại; code là cỡ khối mã
 * (mã nội tuyến vẫn lớn hơn 1px); terminal là cỡ ô của terminal thanh bên.
 */
export const FONT_SIZE_SPECS: Readonly<Record<FontRole, FontSizeSpec>> = {
  text: { field: FONT_SIZE_FIELD, variable: "--dsh-content-font-size", min: 10, max: 22, default: 14 },
  code: { field: "codeFontSize", variable: "--dsh-code-font-size", min: 10, max: 16, default: 11 },
  terminal: { field: "terminalFontSize", variable: "--dsh-terminal-font-size", min: 10, max: 20, default: 13 },
};

/** Cỡ chữ mặc định theo vai trò. */
export const DEFAULT_FONT_SIZES: Readonly<Record<FontRole, number>> = Object.freeze({
  text: FONT_SIZE_SPECS.text.default,
  code: FONT_SIZE_SPECS.code.default,
  terminal: FONT_SIZE_SPECS.terminal.default,
});

/** Trường settings giữ danh sách font của từng vai trò. */
export const FONT_FAMILY_FIELDS: Readonly<Record<FontRole, string>> = {
  text: "textFontFamily",
  code: "codeFontFamily",
  terminal: "terminalFontFamily",
};

/** Cỡ chữ theo vai trò. */
export type FontSizes = Readonly<Record<FontRole, number>>;

/** Danh sách font theo vai trò. */
export type FontFamilies = Readonly<Record<FontRole, string>>;

/** Phần dữ liệu của namespace settings mà row đọc (đã được Host chấp nhận). */
export interface ThemeSection {
  /** Tuỳ chọn theme. */
  readonly preference: ThemePreference;
  /** Cỡ chữ nội dung. */
  readonly fontSize: number;
  /** Cỡ chữ khối mã. */
  readonly codeFontSize: number;
  /** Cỡ chữ terminal. */
  readonly terminalFontSize: number;
  /** Danh sách font nội dung. */
  readonly textFontFamily: string;
  /** Danh sách font mã. */
  readonly codeFontFamily: string;
  /** Danh sách font terminal. */
  readonly terminalFontFamily: string;
}

/**
 * Tên KIỂU theo ĐÚNG hợp đồng của stock (`dsh-client-ui-theme` `lib/types/theme-settings.d.ts:86`) —
 * consumer đổi alias id gọi được `ThemeSettings`; bản port đặt tên nội bộ là {@link ThemeSection}
 * với CÙNG 7 trường nên đây là alias danh nghĩa, không nhân bản hình dạng (review-4: R5 thiếu tên).
 */
export type ThemeSettings = ThemeSection;

/**
 * Biến body mang danh sách font đã chuẩn hoá của một vai trò.
 * @param kind - vai trò font.
 * @returns tên biến CSS (ví dụ --dsh-font-family-text).
 */
export function fontFamilyVariable(kind: FontRole): string {
  return "--dsh-font-family-" + kind;
}

/**
 * Gom cỡ chữ của mọi vai trò từ một section settings đã được chấp nhận.
 * @param section - phần dữ liệu theme đã chấp nhận.
 * @returns cỡ chữ (px, số nguyên) theo vai trò.
 */
export function sectionFontSizes(section: ThemeSection): FontSizes {
  return Object.freeze({
    text: section.fontSize,
    code: section.codeFontSize,
    terminal: section.terminalFontSize,
  });
}

/**
 * Một giá trị có phải cỡ chữ hợp lệ cho vai trò không.
 * @param role - vai trò font.
 * @param px - giá trị cần kiểm.
 * @returns true khi là số nguyên trong khoảng của vai trò.
 */
export function isFontSize(role: FontRole, px: unknown): boolean {
  const spec = FONT_SIZE_SPECS[role];
  return Number.isInteger(px) && (px as number) >= spec.min && (px as number) <= spec.max;
}

/** Từ khoá font chung/hệ thống của CSS Fonts — phải để KHÔNG có ngoặc kép. */
const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "-apple-system",
  "blinkmacsystemfont",
]);

/**
 * Chuẩn hoá input của người dùng thành danh sách font-family hợp lệ cho CSS: tách theo dấu phẩy,
 * bỏ ngoặc kép/gạch chéo/ngoặc nhọn/ký tự điều khiển, gộp khoảng trắng, và bọc ngoặc kép mọi tên
 * KHÔNG phải từ khoá chung. Chuẩn hoá lại kết quả thì trả về y nguyên.
 * @param value - danh sách font người dùng nhập hoặc đã lưu.
 * @returns danh sách đã chuẩn hoá, hoặc chuỗi rỗng khi không còn tên font nào.
 */
export function normalizeFontFamily(value: string): string {
  return value
    .split(",")
    .map((name) =>
      name
        .replace(/["'\\<>\u0000-\u001f\u007f]/gu, "")
        .replace(/\s+/gu, " ")
        .trim(),
    )
    .filter((name) => name !== "")
    .map((name) => (GENERIC_FAMILIES.has(name.toLowerCase()) ? name : '"' + name + '"'))
    .join(", ");
}

/**
 * Thu hẹp một giá trị (từ settings hoặc registry) thành tuỳ chọn theme lưu được.
 * @param value - giá trị đi qua biên settings/registry.
 * @returns true khi là một trong ba tuỳ chọn dựng sẵn.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value);
}
