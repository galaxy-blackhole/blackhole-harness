/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tu dien namespace `plan` — NGUYEN VAN ban goc (zh la nguon su that ve tap khoa, en doi chieu du)
 */
import type { PlanKey } from "./plan-keys.ts";

/** Bang tu dien cua mot ngon ngu: moi khoa cua namespace `plan` deu phai co mat. */
export type PlanDictionary = Readonly<Record<PlanKey, string>>;

/** Tu dien tieng Trung gian the — nguon su that ve TAP KHOA cua namespace (ban goc). */
export const zh: PlanDictionary = {
  "chip.label": "计划",
  "preview.title": "计划",
  "preview.document": "计划 · Markdown",
  "preview.action": "打开",
  "preview.open": "在侧边栏打开计划",
  "preview.full": "查看全文",
  "preview.openNamed": "打开计划：{title}",
  "preview.loading": "正在读取计划…",
  "preview.failed": "无法读取计划",
  "preview.invalidAddress": "计划地址无效",
  "preview.historyUnavailable": "无法读取会话历史",
  "preview.notFound": "未找到这份计划",
  "preview.unavailable": "计划预览不可用",
  "preview.expired": "临时计划预览已失效，请从仍在等待审批的卡片重新打开。",
  "chip.on.aria": "计划模式已开启，按下关闭",
  "chip.on.title": "计划模式已开启 — 点击关闭（/plan off）",
  "chip.exitFailed": "退出计划模式失败",
};

/** Tu dien tieng Anh — da doi chieu DU theo tap khoa cua `zh` (ban goc). */
export const en: PlanDictionary = {
  "chip.label": "Plan",
  "preview.title": "Plan",
  "preview.document": "Plan · Markdown",
  "preview.action": "Open",
  "preview.open": "Open plan in sidebar",
  "preview.full": "View full plan",
  "preview.openNamed": "Open plan: {title}",
  "preview.loading": "Loading plan…",
  "preview.failed": "Could not load plan",
  "preview.invalidAddress": "Invalid plan address",
  "preview.historyUnavailable": "Session history is unavailable",
  "preview.notFound": "This plan was not found",
  "preview.unavailable": "Plan preview is unavailable",
  "preview.expired": "This temporary plan preview has expired. Reopen it from the pending review card.",
  "chip.on.aria": "Plan mode on, press to turn off",
  "chip.on.title": "Plan mode on — click to turn off (/plan off)",
  "chip.exitFailed": "Failed to exit plan mode",
};
