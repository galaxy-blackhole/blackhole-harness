/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nhan lenh ban phim cua khung (namespace shortcuts.layout) — giu NGUYEN chuoi ban goc
 */

/** Nhãn lệnh bàn phím của khung — tiếng Trung (nguồn sự thật của tập khoá). */
export const zh = { toggle: "展开／收起左侧栏" };

/** Tập khoá nhãn lệnh của khung. */
export type LayoutShortcutKey = keyof typeof zh;

/** Nhãn tiếng Anh cho đúng tập khoá của {@link zh}. */
export const en: Record<LayoutShortcutKey, string> = { toggle: "Toggle left sidebar" };
