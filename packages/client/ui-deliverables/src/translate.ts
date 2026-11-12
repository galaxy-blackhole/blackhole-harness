/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu ham dich ma row ui-deliverables dung — khop ctx.locale.bind(namespace)
 */

/**
 * Ham dich da khoa vao namespace deliverables.
 * Nhan: key — khoa tu dien (vi du "changes.title"); params — tham so noi suy tuy chon.
 * Tra: chuoi da dich.
 */
export type Translations = (key: string, params?: Record<string, string | number>) => string;
