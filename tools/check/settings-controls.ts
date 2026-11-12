/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — tạo mới: bảng khai MỌI mục bấm được trong Cài đặt (render · ghi · namespace · field)
 *   để PHẦN C/D của tools/check/toggle-matrix.ts đối chiếu được. Lý do: 11/11/2026 đo được công tắc
 *   "Công cụ lập trình" và 4 namespace Cài đặt bấm KHÔNG lưu (thiếu đường ghi / row bị lớp overlay ghim).
 * desc Dữ liệu bảng công tắc Cài đặt: mỗi dòng là một mục người dùng bấm được, kèm toạ độ render (ui),
 *      toạ độ ghi (write), namespace + các field nó ghi. Toạ độ có "marker" để cổng canh phát hiện trôi dòng.
 */

import type { SettingsControl } from "./settings-surface.ts";

/**
 * Bảng mục bấm được trong Cài đặt — nguồn: quét packages/client/*&#47;src/** ngày 11/11/2026 rồi đối chiếu tay
 * từng mục với đường ghi của nó (controller/config form → settings/mutate).
 *
 * Thứ tự theo màn hình: tab Chung trước, rồi các tab có mục cài đặt riêng.
 */
export const CONTROLS: readonly SettingsControl[] = [
  {
    label: "Chung · Công cụ lập trình (công tắc)",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-general",
    ui: { file: "packages/client/ui-settings-general/src/items.ts", line: 104, marker: "onChange: toggle" },
    write: { file: "packages/client/ui-settings-general/src/plugin.ts", line: 358, marker: "configForms.developerTools.setEnabled" },
    ns: "ui-settings",
    fields: ["enabled"],
    writer: "setEnabled",
  },
  {
    label: "Chung · Chế độ xem hội thoại",
    pkg: "@galaxy-blackhole/gbh-client-ui-chat",
    ui: { file: "packages/client/ui-chat/src/parts/part-018.ts", line: 231, marker: "function TranscriptViewRow" },
    write: { file: "packages/client/ui-chat/src/parts/part-018.ts", line: 624, marker: "transcriptView.setMode" },
    ns: "ui-chat",
    fields: ["transcriptView", "collapseTiming"],
    writer: "setTranscriptView",
  },
  {
    label: "Chung · Mở liên kết",
    pkg: "@galaxy-blackhole/gbh-client-ui-chat",
    ui: { file: "packages/client/ui-chat/src/parts/part-018.ts", line: 325, marker: "function LinkOpeningRow" },
    write: { file: "packages/client/ui-chat/src/parts/part-018.ts", line: 578, marker: "chatSettings.set(\"linkOpening\"" },
    ns: "ui-chat",
    fields: ["linkOpening"],
    writer: "setLinkOpening",
  },
  {
    label: "Chung · Hiển thị hiệu năng",
    pkg: "@galaxy-blackhole/gbh-client-ui-chat",
    ui: { file: "packages/client/ui-chat/src/parts/part-018.ts", line: 359, marker: "function PerformanceUsageRow" },
    write: { file: "packages/client/ui-chat/src/parts/part-018.ts", line: 609, marker: "performancePolicy.setMode" },
    ns: "ui-chat",
    fields: ["performanceUsage"],
    writer: "setPerformanceUsage",
  },
  {
    label: "Chung · Enter khi agent bận",
    pkg: "@galaxy-blackhole/gbh-client-ui-conversation",
    ui: { file: "packages/client/ui-conversation/src/parts/part-44.ts", line: 68, marker: "function EnterBehaviorRow" },
    write: { file: "packages/client/ui-conversation/src/submission-settings.ts", line: 23, marker: "BUSY_ENTER_FIELD" },
    ns: "ui-conversation",
    fields: ["busyEnter"],
    writer: "setBusyEnter",
  },
  {
    label: "Chung · Giao diện (theme + cỡ chữ + font)",
    pkg: "@galaxy-blackhole/gbh-client-ui-theme",
    ui: { file: "packages/client/ui-theme/src/rows.ts", line: 145, marker: "function AppearanceRow" },
    write: { file: "packages/client/ui-theme/src/theme-runtime.ts", line: 385, marker: "host.set(\"preference\"" },
    ns: "ui-theme",
    fields: ["preference", "fontSize", "codeFontSize", "terminalFontSize", "textFontFamily", "codeFontFamily", "terminalFontFamily"],
    writer: "setTheme",
  },
  {
    label: "Chung · Ngôn ngữ",
    pkg: "@galaxy-blackhole/gbh-client-locale",
    ui: { file: "packages/client/locale/src/parts/part-04.ts", line: 362, marker: "settings.general.item" },
    write: { file: "packages/client/locale/src/locale-runtime.ts", line: 253, marker: "set(\"preference\"" },
    ns: "locale",
    fields: ["preference"],
    writer: "setLocale",
  },
  {
    label: "Chung · Quyền mặc định cho phiên mới",
    pkg: "@galaxy-blackhole/gbh-client-ui-permission",
    ui: { file: "packages/client/ui-permission/src/permission-row.ts", line: 71, marker: "function PermissionRow" },
    write: { file: "packages/client/ui-permission/src/settings-store.ts", line: 217, marker: "defaultPreset" },
    ns: "permission",
    fields: ["defaultPreset"],
  },
  {
    label: "Shell · timeout + trần output của bash",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-shell",
    ui: { file: "packages/client/ui-settings-shell/src/shell-card.ts", line: 87, marker: "resetField(\"timeoutMs\")" },
    write: { file: "packages/client/ui-settings-shell/src/shell-card-controller.ts", line: 71, marker: "SettingsFormModel" },
    ns: "bash-sandbox",
    fields: ["timeoutMs", "maxOutputBytes"],
  },
  {
    label: "Subagent · Giới hạn (độ sâu + số chạy song song)",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-subagent",
    ui: { file: "packages/client/ui-settings-subagent/src/limits-fields.ts", line: 94, marker: "resetField(\"maxDepth\")" },
    write: { file: "packages/client/ui-settings-subagent/src/subagent-limits-card-controller.ts", line: 92, marker: "SettingsFormModel" },
    ns: "subagent",
    fields: ["maxDepth", "maxActiveSubagents"],
  },
  {
    label: "Subagent · Dùng đúng model chính (công tắc + lưu)",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-subagent",
    ui: { file: "packages/client/ui-settings-subagent/src/model-selection-fields.ts", line: 102, marker: "props.toggleEnabled" },
    write: { file: "packages/client/ui-settings-subagent/src/subagent-model-selection-card-controller.ts", line: 349, marker: "scope.mutate" },
    ns: "subagent-model-selection-settings",
    fields: ["enabled", "allowedModels"],
    writer: "toggleEnabled",
  },
  {
    label: "Agent loop · Số tool chạy song song",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-agent-loop",
    ui: { file: "packages/client/ui-settings-agent-loop/src/parts/part-01.ts", line: 93, marker: "resetField(\"maxParallelToolCalls\")" },
    write: { file: "packages/client/ui-settings-agent-loop/src/plugin.ts", line: 134, marker: "PARALLEL_FIELD" },
    ns: "agent-loop",
    fields: ["maxParallelToolCalls"],
  },
  {
    label: "Web search · Cấu hình provider",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-web-search",
    ui: { file: "packages/client/ui-settings-web-search/src/client.ts", line: 238, marker: "resetField(\"baseURL\")" },
    write: { file: "packages/client/ui-settings-web-search/src/client.ts", line: 384, marker: "ctx.configForms.get(WEB_SEARCH_NS)" },
    ns: "web-search-gbh",
    fields: ["baseURL", "maxUses", "model", "apiKeyEnv"],
  },
  {
    label: "Model · Thẻ chào (đánh dấu đã đọc)",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-models",
    ui: { file: "packages/client/ui-settings-models/src/parts/part-12.ts", line: 69, marker: "WelcomeNoticeStore" },
    write: { file: "packages/client/ui-settings-models/src/onboarding-copy.ts", line: 13, marker: "WELCOME_NOTICE_ACK_FIELD" },
    ns: "ui-settings-general",
    fields: ["welcomeNoticeVersion"],
  },
  {
    label: "Onboarding · bước + mức dùng (ô chọn)",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-account",
    ui: { file: "packages/client/ui-settings-account/src/parts/part-10.ts", line: 151, marker: "checkbox" },
    write: { file: "packages/client/ui-settings-account/src/onboarding-state.ts", line: 294, marker: "transcriptView" },
    ns: "ui-settings-account",
    fields: ["step", "purpose", "process", "completion", "usage", "developerTools"],
  },
  {
    label: "Preset agent · Chọn preset mặc định",
    pkg: "@galaxy-blackhole/gbh-client-ui-agent-preset",
    ui: { file: "packages/client/ui-agent-preset/src/parts/part-06.ts", line: 87, marker: "remote.agentPresets.select" },
    write: { file: "packages/client/ui-agent-preset/src/roster.ts", line: 53, marker: "remote.settings.update" },
    ns: "agent-preset-registry",
    fields: ["selectedDefault"],
  },
  {
    label: "Dịch CoT · Provider + ngôn ngữ đích",
    pkg: "@galaxy-blackhole/gbh-client-ui-cot-translation",
    ui: { file: "packages/client/ui-cot-translation/src/client/translation-settings.ts", line: 122, marker: "resetField(\"provider\")" },
    write: { file: "packages/client/ui-cot-translation/src/parts/part-03.ts", line: 169, marker: "ctx.configForms.get(\"cot-translation\")" },
    ns: "cot-translation",
    fields: ["provider", "targetLanguage"],
  },
  {
    label: "Plugin market · Nguồn index",
    pkg: "@galaxy-blackhole/gbh-client-ui-plugin-market",
    ui: { file: "packages/client/ui-plugin-market/src/parts/part-04.ts", line: 371, marker: "pluginMarket.setIndexes" },
    write: { file: "packages/client/ui-plugin-market/src/market-store.ts", line: 358, marker: "remote.pluginMarket.setIndexes" },
    ns: "plugin-market",
    fields: ["indexes"],
    probe: "pluginMarket/setIndexes",
  },
  {
    label: "Chung · Nhật ký phiên (row đang TẮT)",
    pkg: "@galaxy-blackhole/gbh-client-ui-settings-session-log",
    ui: { file: "packages/client/ui-settings-session-log/src/client.ts", line: 189, marker: "primitives.Switch" },
    write: { file: "packages/client/ui-settings-session-log/src/client.ts", line: 249, marker: "preference.setEnabled" },
    ns: "session-log-gbh",
    fields: ["enabled"],
    writer: "setEnabled",
    hidden: "row session-log-gbh + ui-settings-session-log bị tắt trong app.patch.yml ⇒ mục không hiện",
  },
];
