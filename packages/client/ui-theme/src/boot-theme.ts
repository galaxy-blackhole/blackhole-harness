/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc boot-theme: hai dong bom giao dien TRUOC khi plugin chay (CSS to mau canvas o head + script body dat
 *   palette/font) — chuyen 1:1 tu boot-theme.js cua bundle goc (lib/index.js dong 126-184)
 */

import {
  DEFAULT_FONT_SIZES,
  DEFAULT_PREFERENCE,
  FONT_ROLES,
  FONT_SIZE_SPECS,
  fontFamilyVariable,
  normalizeFontFamily,
} from "./theme-settings.ts";
import type { FontFamilies, FontSizes, ThemePreference } from "./theme-settings.ts";

/** Mau nen canvas khi che do sang (NGUYÊN VĂN bản gốc). */
const LIGHT_BACKGROUND = "#fff";

/** Mau nen canvas khi che do toi (NGUYÊN VĂN bản gốc). */
const DARK_BACKGROUND = "#151517";

/** Một dòng bơm vào index của Host (đúng hình dạng IndexInjection của dsh-host-webserver). */
export interface IndexInjection {
  /** Loại dòng: style hoặc script. */
  readonly kind: "style" | "script";
  /** Vị trí (chỉ script dùng: body). */
  readonly placement?: "body";
  /** Văn bản chèn. */
  readonly text: string;
}

/**
 * CSS to mau canvas TRƯỚC khi script nào chạy.
 * @param preference - tuỳ chọn theme hiện tại của Host.
 * @returns văn bản CSS (một dòng như bản gốc).
 */
export function bootThemeStyle(preference: ThemePreference): string {
  const light = ":root{color-scheme:light}body{background-color:" + LIGHT_BACKGROUND + ";--dsh-boot-bg:" + LIGHT_BACKGROUND + "}";
  const dark = ":root{color-scheme:dark}body{background-color:" + DARK_BACKGROUND + ";--dsh-boot-bg:" + DARK_BACKGROUND + "}";
  if (preference === "light") return light;
  if (preference === "dark") return dark;
  return light + "@media(prefers-color-scheme:dark){" + dark + "}";
}

/**
 * Dựng script body đặt bộ chọn palette (data-ds-theme-source / data-ds-dark-theme) và biến font.
 * @param preference - tuỳ chọn theme hiện tại.
 * @param fontSizes - cỡ chữ theo vai trò (px).
 * @param fontFamilies - danh sách font theo vai trò (sẽ được chuẩn hoá).
 * @returns mã script (chuỗi nhiều dòng như bản gốc).
 */
export function bootThemeBodyScript(preference: ThemePreference, fontSizes: FontSizes, fontFamilies: FontFamilies): string {
  const sizes = FONT_ROLES.map(
    (role) => "\n  document.body.style.setProperty(" + JSON.stringify(FONT_SIZE_SPECS[role].variable) + ", " + JSON.stringify(fontSizes[role] + "px") + ")",
  ).join("");
  const families = FONT_ROLES.flatMap((kind) => {
    const list = normalizeFontFamily(fontFamilies[kind]);
    return list === "" ? [] : ["\n  document.body.style.setProperty(" + JSON.stringify(fontFamilyVariable(kind)) + ", " + JSON.stringify(list) + ")"];
  }).join("");
  return (
    "(() => {\n" +
    "  const preference = " + JSON.stringify(preference) + "\n" +
    "  const systemDark = preference === 'system'\n" +
    "    && typeof matchMedia !== 'undefined'\n" +
    "    && matchMedia('(prefers-color-scheme: dark)').matches\n" +
    "  const dark = preference === 'dark' || systemDark\n" +
    "  document.documentElement.dataset.dsThemeSource = preference\n" +
    "  document.body.toggleAttribute('data-ds-dark-theme', dark)" + sizes + families + "\n" +
    "})()"
  );
}

/**
 * Hai dòng bơm theme: CSS ở head to màu canvas trước lần vẽ đầu, rồi script body đặt palette + cỡ chữ +
 * danh sách font trước khi vỏ và module script chạy.
 * @param preference - tuỳ chọn dựng sẵn hiện tại của Host (mặc định "system").
 * @param fontSizes - cỡ chữ hiện tại theo vai trò (mặc định = bảng mặc định).
 * @param fontFamilies - danh sách font hiện tại theo vai trò (mặc định rỗng = dùng stack dựng sẵn).
 * @returns hai dòng theo ĐÚNG thứ tự thực thi của bản gốc.
 */
export function bootThemeInjections(
  preference: ThemePreference = DEFAULT_PREFERENCE,
  fontSizes: FontSizes = DEFAULT_FONT_SIZES,
  fontFamilies: FontFamilies = { text: "", code: "", terminal: "" },
): IndexInjection[] {
  return [
    { kind: "style", text: bootThemeStyle(preference) },
    { kind: "script", placement: "body", text: bootThemeBodyScript(preference, fontSizes, fontFamilies) },
  ];
}
