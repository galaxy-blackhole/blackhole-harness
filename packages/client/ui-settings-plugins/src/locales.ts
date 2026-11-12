/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien cua muc Settings -> Built-in plugins (en/zh) — giu NGUYEN chuoi cua ban goc de ma tran anh A/B khong lech
 */

/** Khoá locale của mục Plugins trong Settings — giữ nguyên như bản gốc. */
export const LOCALE_KEY = "settings.plugins";

/** Năm khoá mà mục Plugins hiển thị. */
export type PluginsLocaleKey = "nav" | "title" | "intro" | "tabs" | "empty";

/** Bản tiếng Anh (nguyên văn của DSH). */
export const en: Record<PluginsLocaleKey, string> = {
  nav: "Built-in plugins",
  title: "Built-in plugins",
  intro: "Inspect the plugins this deployment ships.",
  tabs: "Plugin views",
  empty: "This deployment exposes no plugin views.",
};

/** Bản tiếng Trung giản thể (nguyên văn của DSH). */
export const zh: Record<PluginsLocaleKey, string> = {
  nav: "内置插件",
  title: "内置插件",
  intro: "查看内置部署的插件列表",
  tabs: "插件视图",
  empty: "本部署没有开放任何插件视图。",
};
