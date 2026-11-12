/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace `sidebar` (en/zh) — chuoi giu NGUYEN nhu ban goc de ma tran anh A/B khong lech
 */

/** Từ điển tiếng Trung — cũng là NGUỒN SỰ THẬT của tập khoá (bản gốc làm y vậy). */
export const zh = {
  "session.new": "新会话",
  "session.new.label": "新建会话",
  "toggle.open": "打开侧边栏",
  "toggle.collapse": "收起侧边栏",
  "panels.label": "全局面板",
};

/** Tập khoá copy của namespace `sidebar`. */
export type SidebarKey = keyof typeof zh;

/** Từ điển tiếng Anh — bắt buộc đủ và đúng tập khoá của {@link zh}. */
export const en: Record<SidebarKey, string> = {
  "session.new": "New Session",
  "session.new.label": "New session",
  "toggle.open": "Open sidebar",
  "toggle.collapse": "Collapse sidebar",
  "panels.label": "Global panels",
};
