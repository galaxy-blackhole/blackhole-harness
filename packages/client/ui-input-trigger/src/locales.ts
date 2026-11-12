/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/client/locales.js của bản gốc — hai từ điển namespace slash.menu, NGUYÊN VĂN chuỗi
 */

/**
 * Từ điển tiếng Trung giản thể (nguồn sự thật của tập khóa).
 * Nhận: không có.
 * Trả: đối tượng khóa → chuỗi.
 */
export const zh = {
  command: "指令",
  skill: "技能",
  subagent: "子智能体",
  loading: "正在加载…",
  "drill.aria": "进入目录",
  "drill.hint": "进入目录",
  "drill.key": "Tab",
  "crumbs.aria": "目录导航",
  "suggestions.aria": "触发候选建议",
};

/**
 * Tập khóa của namespace slash.menu.
 * Nhận: không có.
 * Trả: kiểu MenuKey.
 */
export type MenuKey = keyof typeof zh;

/**
 * Từ điển tiếng Anh, đã đối chiếu đủ tập khóa của zh.
 * Nhận: không có.
 * Trả: đối tượng khóa → chuỗi.
 */
export const en: Record<MenuKey, string> = {
  command: "Commands",
  skill: "Skills",
  subagent: "Subagents",
  loading: "Loading…",
  "drill.aria": "Browse folder",
  "drill.hint": "Browse folder",
  "drill.key": "Tab",
  "crumbs.aria": "Folder navigation",
  "suggestions.aria": "Trigger suggestions",
};
