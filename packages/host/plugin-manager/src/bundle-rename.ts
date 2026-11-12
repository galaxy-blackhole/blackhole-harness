/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Bảng quy tên gói stock về tên gói CỦA TA cho dữ liệu Host trả về trang Plugins: danh mục
 *      bundle đọc từ bản cài (kernel) nên vẫn mang tên stock; bảng này đổi tên bundle + tên module
 *      của từng row sang tên gói ta để UI không còn hiện @deepseek-ai/....
 *      11/11/2026: nạp lại 2 bundle agent con stock vào KHONG_HO_TRO (đo thật: repo KHÔNG có bản port 1:1) ⇒
 *      RPC pluginManager/listBundles không còn trả id @deepseek-ai/dsh-subagent-* cho trang Plugins.
 */

/** Tên gói stock → tên gói của ta. */
export const DOI_TEN: Readonly<Record<string, string>> = {
  "@deepseek-ai/cordis-plugin-group": "@galaxy-blackhole/gbh-cordis-plugin-group",
  "@deepseek-ai/dsh-acp": "@galaxy-blackhole/gbh-acp",
  "@deepseek-ai/dsh-acp-app": "@galaxy-blackhole/gbh-acp-app",
  "@deepseek-ai/dsh-agent": "@galaxy-blackhole/gbh-agent",
  "@deepseek-ai/dsh-agent-default-model": "@galaxy-blackhole/gbh-agent-default-model",
  "@deepseek-ai/dsh-agent-instructions": "@galaxy-blackhole/gbh-agent-instructions",
  "@deepseek-ai/dsh-agent-preset": "@galaxy-blackhole/gbh-agent-preset",
  "@deepseek-ai/dsh-agent-preset-registry": "@galaxy-blackhole/gbh-agent-preset-registry",
  "@deepseek-ai/dsh-agent-tool-presentation": "@galaxy-blackhole/gbh-agent-tool-presentation",
  "@deepseek-ai/dsh-anonymous-user-id": "@galaxy-blackhole/gbh-anonymous-user-id",
  "@deepseek-ai/dsh-api-account-controller": "@galaxy-blackhole/gbh-api-account-controller",
  "@deepseek-ai/dsh-api-gateway": "@galaxy-blackhole/gbh-api-gateway",
  "@deepseek-ai/dsh-api-job-controller": "@galaxy-blackhole/gbh-api-job-controller",
  "@deepseek-ai/dsh-api-remote-access": "@galaxy-blackhole/gbh-api-remote-access",
  "@deepseek-ai/dsh-api-remotes": "@galaxy-blackhole/gbh-api-remotes",
  "@deepseek-ai/dsh-api-session-controller": "@galaxy-blackhole/gbh-api-session-controller",
  "@deepseek-ai/dsh-api-settings-controller": "@galaxy-blackhole/gbh-api-settings-controller",
  "@deepseek-ai/dsh-api-terminal-controller": "@galaxy-blackhole/gbh-api-terminal-controller",
  "@deepseek-ai/dsh-api-workspace-controller": "@galaxy-blackhole/gbh-api-workspace-controller",
  "@deepseek-ai/dsh-api-workspace-files": "@galaxy-blackhole/gbh-api-workspace-files",
  "@deepseek-ai/dsh-app-boot": "@galaxy-blackhole/gbh-app-boot",
  "@deepseek-ai/dsh-atomic-write": "@galaxy-blackhole/gbh-atomic-write",
  "@deepseek-ai/dsh-attachment": "@galaxy-blackhole/gbh-attachment",
  "@deepseek-ai/dsh-attachment-local": "@galaxy-blackhole/gbh-attachment-local",
  "@deepseek-ai/dsh-authorization": "@galaxy-blackhole/gbh-authorization",
  "@deepseek-ai/dsh-base": "@galaxy-blackhole/gbh-base",
  "@deepseek-ai/dsh-bash-local": "@galaxy-blackhole/gbh-bash-local",
  "@deepseek-ai/dsh-bash-sandbox": "@galaxy-blackhole/gbh-bash-sandbox",
  "@deepseek-ai/dsh-brand": "@galaxy-blackhole/gbh-brand",
  "@deepseek-ai/dsh-chunked-list": "@galaxy-blackhole/gbh-chunked-list",
  "@deepseek-ai/dsh-client-connection": "@galaxy-blackhole/gbh-client-connection",
  "@deepseek-ai/dsh-client-file-upload": "@galaxy-blackhole/gbh-client-file-upload",
  "@deepseek-ai/dsh-client-hmr": "@galaxy-blackhole/gbh-client-hmr",
  "@deepseek-ai/dsh-client-locale": "@galaxy-blackhole/gbh-client-locale",
  "@deepseek-ai/dsh-client-modules": "@galaxy-blackhole/gbh-client-modules",
  "@deepseek-ai/dsh-client-product-analytics": "@galaxy-blackhole/gbh-client-product-analytics",
  "@deepseek-ai/dsh-client-resources": "@galaxy-blackhole/gbh-client-resources",
  "@deepseek-ai/dsh-client-shortcuts": "@galaxy-blackhole/gbh-client-shortcuts",
  "@deepseek-ai/dsh-client-ui-agent-preset": "@galaxy-blackhole/gbh-client-ui-agent-preset",
  "@deepseek-ai/dsh-client-ui-approval": "@galaxy-blackhole/gbh-client-ui-approval",
  "@deepseek-ai/dsh-client-ui-attachment": "@galaxy-blackhole/gbh-client-ui-attachment",
  "@deepseek-ai/dsh-client-ui-brand-official": "@galaxy-blackhole/gbh-client-ui-brand-official",
  "@deepseek-ai/dsh-client-ui-chat": "@galaxy-blackhole/gbh-client-ui-chat",
  "@deepseek-ai/dsh-client-ui-commands": "@galaxy-blackhole/gbh-client-ui-commands",
  "@deepseek-ai/dsh-client-ui-conversation": "@galaxy-blackhole/gbh-client-ui-conversation",
  "@deepseek-ai/dsh-client-ui-cordis": "@galaxy-blackhole/gbh-client-ui-cordis",
  "@deepseek-ai/dsh-client-ui-deliverables": "@galaxy-blackhole/gbh-client-ui-deliverables",
  "@deepseek-ai/dsh-client-ui-directory-picker-browse": "@galaxy-blackhole/gbh-client-ui-directory-picker-browse",
  "@deepseek-ai/dsh-client-ui-directory-picker-native": "@galaxy-blackhole/gbh-client-ui-directory-picker-native",
  "@deepseek-ai/dsh-client-ui-goal": "@galaxy-blackhole/gbh-client-ui-goal",
  "@deepseek-ai/dsh-client-ui-input-trigger": "@galaxy-blackhole/gbh-client-ui-input-trigger",
  "@deepseek-ai/dsh-client-ui-jobs": "@galaxy-blackhole/gbh-client-ui-jobs",
  "@deepseek-ai/dsh-client-ui-layout": "@galaxy-blackhole/gbh-client-ui-layout",
  "@deepseek-ai/dsh-client-ui-message-feedback": "@galaxy-blackhole/gbh-client-ui-message-feedback",
  "@deepseek-ai/dsh-client-ui-model-selection": "@galaxy-blackhole/gbh-client-ui-model-selection",
  "@deepseek-ai/dsh-client-ui-open-in-app": "@galaxy-blackhole/gbh-client-ui-open-in-app",
  "@deepseek-ai/dsh-client-ui-permission-presets": "@galaxy-blackhole/gbh-client-ui-permission-presets",
  "@deepseek-ai/dsh-client-ui-plan": "@galaxy-blackhole/gbh-client-ui-plan",
  "@deepseek-ai/dsh-client-ui-plugin-manager": "@galaxy-blackhole/gbh-client-ui-plugin-manager",
  "@deepseek-ai/dsh-client-ui-plugin-market": "@galaxy-blackhole/gbh-client-ui-plugin-market",
  "@deepseek-ai/dsh-client-ui-reference": "@galaxy-blackhole/gbh-client-ui-reference",
  "@deepseek-ai/dsh-client-ui-renderer": "@galaxy-blackhole/gbh-client-ui-renderer",
  "@deepseek-ai/dsh-client-ui-schedule": "@galaxy-blackhole/gbh-client-ui-schedule",
  "@deepseek-ai/dsh-client-ui-secret-mask": "@galaxy-blackhole/gbh-client-ui-secret-mask",
  "@deepseek-ai/dsh-client-ui-session": "@galaxy-blackhole/gbh-client-ui-session",
  "@deepseek-ai/dsh-client-ui-settings": "@galaxy-blackhole/gbh-client-ui-settings",
  "@deepseek-ai/dsh-client-ui-settings-account": "@galaxy-blackhole/gbh-client-ui-settings-account",
  "@deepseek-ai/dsh-client-ui-settings-agent-loop": "@galaxy-blackhole/gbh-client-ui-settings-agent-loop",
  "@deepseek-ai/dsh-client-ui-settings-general": "@galaxy-blackhole/gbh-client-ui-settings-general",
  "@deepseek-ai/dsh-client-ui-settings-models": "@galaxy-blackhole/gbh-client-ui-settings-models",
  "@deepseek-ai/dsh-client-ui-settings-plugin-inventory": "@galaxy-blackhole/gbh-client-ui-settings-plugin-inventory",
  "@deepseek-ai/dsh-client-ui-settings-plugins": "@galaxy-blackhole/gbh-client-ui-settings-plugins",
  "@deepseek-ai/dsh-client-ui-settings-session-log": "@galaxy-blackhole/gbh-client-ui-settings-session-log",
  "@deepseek-ai/dsh-client-ui-settings-shell": "@galaxy-blackhole/gbh-client-ui-settings-shell",
  "@deepseek-ai/dsh-client-ui-settings-subagent": "@galaxy-blackhole/gbh-client-ui-settings-subagent",
  "@deepseek-ai/dsh-client-ui-settings-web-search": "@galaxy-blackhole/gbh-client-ui-settings-web-search",
  "@deepseek-ai/dsh-client-ui-shortcuts": "@galaxy-blackhole/gbh-client-ui-shortcuts",
  "@deepseek-ai/dsh-client-ui-sidebar": "@galaxy-blackhole/gbh-client-ui-sidebar",
  "@deepseek-ai/dsh-client-ui-sidebar-browser": "@galaxy-blackhole/gbh-client-ui-sidebar-browser",
  "@deepseek-ai/dsh-client-ui-sidebar-documentpreview": "@galaxy-blackhole/gbh-client-ui-sidebar-documentpreview",
  "@deepseek-ai/dsh-client-ui-sidebar-files": "@galaxy-blackhole/gbh-client-ui-sidebar-files",
  "@deepseek-ai/dsh-client-ui-sidebar-right": "@galaxy-blackhole/gbh-client-ui-sidebar-right",
  "@deepseek-ai/dsh-client-ui-sidebar-terminal": "@galaxy-blackhole/gbh-client-ui-sidebar-terminal",
  "@deepseek-ai/dsh-client-ui-skill": "@galaxy-blackhole/gbh-client-ui-skill",
  "@deepseek-ai/dsh-client-ui-subagent": "@galaxy-blackhole/gbh-client-ui-subagent",
  "@deepseek-ai/dsh-client-ui-theme": "@galaxy-blackhole/gbh-client-ui-theme",
  "@deepseek-ai/dsh-client-ui-tool": "@galaxy-blackhole/gbh-client-ui-tool",
  "@deepseek-ai/dsh-client-ui-trajectory": "@galaxy-blackhole/gbh-client-ui-trajectory",
  "@deepseek-ai/dsh-client-ui-user-questions": "@galaxy-blackhole/gbh-client-ui-user-questions",
  "@deepseek-ai/dsh-client-ui-workflow-run": "@galaxy-blackhole/gbh-client-ui-workflow-run",
  "@deepseek-ai/dsh-client-ui-workspace": "@galaxy-blackhole/gbh-client-ui-workspace",
  "@deepseek-ai/dsh-cmdline": "@galaxy-blackhole/gbh-cmdline",
  "@deepseek-ai/dsh-command-compact": "@galaxy-blackhole/gbh-command-compact",
  "@deepseek-ai/dsh-command-feedback": "@galaxy-blackhole/gbh-command-feedback",
  "@deepseek-ai/dsh-command-goal": "@galaxy-blackhole/gbh-command-goal",
  "@deepseek-ai/dsh-commands": "@galaxy-blackhole/gbh-commands",
  "@deepseek-ai/dsh-compaction": "@galaxy-blackhole/gbh-compaction",
  "@deepseek-ai/dsh-compaction-basic": "@galaxy-blackhole/gbh-compaction-basic",
  "@deepseek-ai/dsh-compaction-image-offload": "@galaxy-blackhole/gbh-compaction-image-offload",
  "@deepseek-ai/dsh-compaction-tool-result-pruner": "@galaxy-blackhole/gbh-compaction-tool-result-pruner",
  "@deepseek-ai/dsh-config-editor": "@galaxy-blackhole/gbh-config-editor",
  "@deepseek-ai/dsh-cordis-client-runner": "@galaxy-blackhole/gbh-cordis-client-runner",
  "@deepseek-ai/dsh-credentials": "@galaxy-blackhole/gbh-credentials",
  "@deepseek-ai/dsh-credentials-local": "@galaxy-blackhole/gbh-credentials-local",
  "@deepseek-ai/dsh-deepseek-account": "@galaxy-blackhole/gbh-deepseek-account",
  "@deepseek-ai/dsh-deepseek-account-platform": "@galaxy-blackhole/gbh-account-platform",
  "@deepseek-ai/dsh-deepseek-llm-api-extensions": "@galaxy-blackhole/gbh-deepseek-llm-api-extensions",
  "@deepseek-ai/dsh-deque": "@galaxy-blackhole/gbh-deque",
  "@deepseek-ai/dsh-experimental-agent-team": "@galaxy-blackhole/gbh-experimental-agent-team",
  "@deepseek-ai/dsh-experimental-agent-team-profile": "@galaxy-blackhole/gbh-agent-team-profile",
  "@deepseek-ai/dsh-experimental-api-speech-to-text": "@galaxy-blackhole/gbh-experimental-api-speech-to-text",
  // 25/10/2026 — trỏ tên BUNDLE stock sang gói BUNDLE của ta (trước đây trỏ nhầm sang row package
  // ⇒ bật công tắc báo "Bật thất bại" với mã not-bundle). Row bên trong bundle vẫn là gbh-auto-review.
  "@deepseek-ai/dsh-experimental-auto-review": "@galaxy-blackhole/gbh-auto-review-bundle",
  "@deepseek-ai/dsh-experimental-badge-skill-bundle": "@galaxy-blackhole/gbh-badge-skill-bundle",
  "@deepseek-ai/dsh-experimental-client-ui-agent-team": "@galaxy-blackhole/gbh-client-ui-agent-team",
  "@deepseek-ai/dsh-experimental-client-ui-cot-translation": "@galaxy-blackhole/gbh-client-ui-cot-translation",
  "@deepseek-ai/dsh-experimental-client-ui-voice-input": "@galaxy-blackhole/gbh-experimental-client-ui-voice-input",
  "@deepseek-ai/dsh-experimental-cot-translation-bundle": "@galaxy-blackhole/gbh-cot-translation-bundle",
  "@deepseek-ai/dsh-experimental-inspector": "@galaxy-blackhole/gbh-experimental-inspector",
  "@deepseek-ai/dsh-experimental-inspector-profile": "@galaxy-blackhole/gbh-inspector-profile",
  "@deepseek-ai/dsh-experimental-plugin-market-bundle": "@galaxy-blackhole/gbh-plugin-market-bundle",
  "@deepseek-ai/dsh-experimental-ralph-bundle": "@galaxy-blackhole/gbh-ralph-bundle",
  "@deepseek-ai/dsh-experimental-session-inspector": "@galaxy-blackhole/gbh-session-inspector",
  "@deepseek-ai/dsh-experimental-session-search": "@galaxy-blackhole/gbh-session-search",
  "@deepseek-ai/dsh-experimental-session-titles-bundle": "@galaxy-blackhole/gbh-session-titles-bundle",
  "@deepseek-ai/dsh-experimental-speech-to-text": "@galaxy-blackhole/gbh-experimental-speech-to-text",
  "@deepseek-ai/dsh-experimental-speech-to-text-sensevoice": "@galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice",
  "@deepseek-ai/dsh-experimental-terminal-bundle": "@galaxy-blackhole/gbh-terminal-bundle",
  "@deepseek-ai/dsh-experimental-tool-agent-team": "@galaxy-blackhole/gbh-experimental-tool-agent-team",
  "@deepseek-ai/dsh-experimental-tool-worktree": "@galaxy-blackhole/gbh-tool-worktree-bundle",
  "@deepseek-ai/dsh-experimental-translator": "@galaxy-blackhole/gbh-translator",
  "@deepseek-ai/dsh-experimental-voice-input-bundle": "@galaxy-blackhole/gbh-voice-input-bundle",
  "@deepseek-ai/dsh-experimental-worktree": "@galaxy-blackhole/gbh-worktree",
  "@deepseek-ai/dsh-file-reference": "@galaxy-blackhole/gbh-file-reference",
  "@deepseek-ai/dsh-file-reference-local": "@galaxy-blackhole/gbh-file-reference-local",
  "@deepseek-ai/dsh-fs": "@galaxy-blackhole/gbh-fs",
  "@deepseek-ai/dsh-fs-local": "@galaxy-blackhole/gbh-fs-local",
  "@deepseek-ai/dsh-fs-observation-policy": "@galaxy-blackhole/gbh-fs-observation-policy",
  "@deepseek-ai/dsh-fs-sandbox": "@galaxy-blackhole/gbh-fs-sandbox",
  "@deepseek-ai/dsh-goal": "@galaxy-blackhole/gbh-goal",
  "@deepseek-ai/dsh-goal-round-driver": "@galaxy-blackhole/gbh-goal-round-driver",
  "@deepseek-ai/dsh-harness-dev-context": "@galaxy-blackhole/gbh-harness-dev-context",
  "@deepseek-ai/dsh-headless": "@galaxy-blackhole/gbh-headless",
  "@deepseek-ai/dsh-hmr": "@galaxy-blackhole/gbh-hmr",
  "@deepseek-ai/dsh-home-paths": "@galaxy-blackhole/gbh-home-paths",
  "@deepseek-ai/dsh-host-directory-picker": "@galaxy-blackhole/gbh-host-directory-picker",
  "@deepseek-ai/dsh-host-directory-picker-auto": "@galaxy-blackhole/gbh-host-directory-picker-auto",
  "@deepseek-ai/dsh-host-directory-picker-browse": "@galaxy-blackhole/gbh-host-directory-picker-browse",
  "@deepseek-ai/dsh-host-directory-picker-native": "@galaxy-blackhole/gbh-host-directory-picker-native",
  "@deepseek-ai/dsh-host-frontend-static": "@galaxy-blackhole/gbh-host-frontend-static",
  "@deepseek-ai/dsh-host-open-in-app": "@galaxy-blackhole/gbh-host-open-in-app",
  "@deepseek-ai/dsh-host-plugin-inventory": "@galaxy-blackhole/gbh-host-plugin-inventory",
  "@deepseek-ai/dsh-host-product-telemetry-otel": "@galaxy-blackhole/gbh-desktop-product-telemetry",
  "@deepseek-ai/dsh-host-webserver": "@galaxy-blackhole/gbh-host-webserver",
  "@deepseek-ai/dsh-http-proxy": "@galaxy-blackhole/gbh-http-proxy",
  "@deepseek-ai/dsh-jobs": "@galaxy-blackhole/gbh-jobs",
  "@deepseek-ai/dsh-jobs-local": "@galaxy-blackhole/gbh-jobs-local",
  "@deepseek-ai/dsh-launch-environment": "@galaxy-blackhole/gbh-launch-environment",
  "@deepseek-ai/dsh-lazy-require": "@galaxy-blackhole/gbh-lazy-require",
  "@deepseek-ai/dsh-llm": "@galaxy-blackhole/gbh-llm",
  "@deepseek-ai/dsh-llm-deepseek": "@galaxy-blackhole/gbh-llm-deepseek",
  "@deepseek-ai/dsh-llm-deepseek-account": "@galaxy-blackhole/gbh-llm-deepseek-account",
  "@deepseek-ai/dsh-llm-deepseek-api-key": "@galaxy-blackhole/gbh-llm-deepseek-api-key",
  "@deepseek-ai/dsh-llm-pi-ai": "@galaxy-blackhole/gbh-host-llm-pi-ai",
  "@deepseek-ai/dsh-llm-retry": "@galaxy-blackhole/gbh-llm-retry",
  "@deepseek-ai/dsh-mcp-client": "@galaxy-blackhole/gbh-mcp-client",
  "@deepseek-ai/dsh-mcp-resources": "@galaxy-blackhole/gbh-mcp-resources",
  "@deepseek-ai/dsh-message-feedback": "@galaxy-blackhole/gbh-message-feedback",
  "@deepseek-ai/dsh-native-command": "@galaxy-blackhole/gbh-native-command",
  "@deepseek-ai/dsh-office-to-pdf": "@galaxy-blackhole/gbh-office-to-pdf",
  "@deepseek-ai/dsh-otel": "@galaxy-blackhole/gbh-otel",
  "@deepseek-ai/dsh-output-retention": "@galaxy-blackhole/gbh-output-retention",
  "@deepseek-ai/dsh-package-manifest": "@galaxy-blackhole/gbh-package-manifest",
  "@deepseek-ai/dsh-permission-presets": "@galaxy-blackhole/gbh-permission",
  "@deepseek-ai/dsh-persona": "@galaxy-blackhole/gbh-persona",
  "@deepseek-ai/dsh-plan-mode": "@galaxy-blackhole/gbh-plan-mode",
  "@deepseek-ai/dsh-plugin-market": "@galaxy-blackhole/gbh-plugin-market",
  "@deepseek-ai/dsh-plugin-market-index": "@galaxy-blackhole/gbh-plugin-market-index",
  "@deepseek-ai/dsh-plugin-package-inventory-deepseek": "@galaxy-blackhole/gbh-plugin-package-inventory-deepseek",
  "@deepseek-ai/dsh-ptc-runtime": "@galaxy-blackhole/gbh-ptc-runtime",
  "@deepseek-ai/dsh-ptc-runtime-node": "@galaxy-blackhole/gbh-ptc-runtime-node",
  "@deepseek-ai/dsh-pwsh-local": "@galaxy-blackhole/gbh-pwsh-local",
  "@deepseek-ai/dsh-pwsh-sandbox": "@galaxy-blackhole/gbh-pwsh-sandbox",
  "@deepseek-ai/dsh-repeat-tool-reminder": "@galaxy-blackhole/gbh-host-repeat-tool-reminder",
  "@deepseek-ai/dsh-sandbox": "@galaxy-blackhole/gbh-sandbox",
  "@deepseek-ai/dsh-sandbox-local": "@galaxy-blackhole/gbh-sandbox-local",
  "@deepseek-ai/dsh-sandbox-policy": "@galaxy-blackhole/gbh-sandbox-policy",
  "@deepseek-ai/dsh-sandbox-windows-acl": "@galaxy-blackhole/gbh-sandbox-windows-acl",
  "@deepseek-ai/dsh-schedule": "@galaxy-blackhole/gbh-schedule",
  "@deepseek-ai/dsh-scope": "@galaxy-blackhole/gbh-scope",
  "@deepseek-ai/dsh-sdk-app": "@galaxy-blackhole/gbh-sdk-app",
  "@deepseek-ai/dsh-sdk-jsonrpc-server": "@galaxy-blackhole/gbh-sdk-jsonrpc-server",
  "@deepseek-ai/dsh-sdk-minimal": "@galaxy-blackhole/gbh-sdk-minimal",
  "@deepseek-ai/dsh-sdk-protocol": "@galaxy-blackhole/gbh-sdk-protocol",
  "@deepseek-ai/dsh-session": "@galaxy-blackhole/gbh-session",
  "@deepseek-ai/dsh-session-checkpoint-policy": "@galaxy-blackhole/gbh-session-checkpoint-policy",
  "@deepseek-ai/dsh-session-format": "@galaxy-blackhole/gbh-session-format",
  "@deepseek-ai/dsh-session-format-catalog": "@galaxy-blackhole/gbh-session-format-catalog",
  "@deepseek-ai/dsh-session-format-v0-to-v1": "@galaxy-blackhole/gbh-session-format-v0-to-v1",
  "@deepseek-ai/dsh-session-format-v1-to-v2": "@galaxy-blackhole/gbh-session-format-v1-to-v2",
  "@deepseek-ai/dsh-session-format-v2-to-v3": "@galaxy-blackhole/gbh-session-format-v2-to-v3",
  "@deepseek-ai/dsh-session-format-v3-to-v4": "@galaxy-blackhole/gbh-session-format-v3-to-v4",
  "@deepseek-ai/dsh-session-log-deepseek": "@galaxy-blackhole/gbh-session-log",
  "@deepseek-ai/dsh-session-log-export": "@galaxy-blackhole/gbh-session-log-export",
  "@deepseek-ai/dsh-session-persistence": "@galaxy-blackhole/gbh-session-persistence",
  "@deepseek-ai/dsh-session-persistence-jsonl": "@galaxy-blackhole/gbh-session-persistence-jsonl",
  "@deepseek-ai/dsh-session-projection": "@galaxy-blackhole/gbh-session-projection",
  "@deepseek-ai/dsh-session-projection-cache": "@galaxy-blackhole/gbh-session-projection-cache",
  "@deepseek-ai/dsh-session-query": "@galaxy-blackhole/gbh-session-query",
  "@deepseek-ai/dsh-session-query-sqlite": "@galaxy-blackhole/gbh-session-query-sqlite",
  "@deepseek-ai/dsh-session-reference": "@galaxy-blackhole/gbh-session-reference",
  "@deepseek-ai/dsh-session-stats": "@galaxy-blackhole/gbh-session-stats",
  "@deepseek-ai/dsh-session-telemetry": "@galaxy-blackhole/gbh-session-telemetry",
  "@deepseek-ai/dsh-session-telemetry-otel": "@galaxy-blackhole/gbh-session-telemetry-otel",
  "@deepseek-ai/dsh-session-title": "@galaxy-blackhole/gbh-session-title",
  "@deepseek-ai/dsh-session-title-all-prompts-llm": "@galaxy-blackhole/gbh-session-title-all-prompts-llm",
  "@deepseek-ai/dsh-session-title-first-prompt-llm": "@galaxy-blackhole/gbh-session-title-first-prompt-llm",
  "@deepseek-ai/dsh-session-title-llm": "@galaxy-blackhole/gbh-session-title-llm",
  "@deepseek-ai/dsh-session-turn-outline": "@galaxy-blackhole/gbh-session-turn-outline",
  "@deepseek-ai/dsh-settings": "@galaxy-blackhole/gbh-settings",
  "@deepseek-ai/dsh-shell": "@galaxy-blackhole/gbh-shell",
  "@deepseek-ai/dsh-shell-env": "@galaxy-blackhole/gbh-shell-env",
  "@deepseek-ai/dsh-skill": "@galaxy-blackhole/gbh-skill",
  "@deepseek-ai/dsh-skill-badge": "@galaxy-blackhole/gbh-skill-badge",
  "@deepseek-ai/dsh-skill-filesystem": "@galaxy-blackhole/gbh-host-skill-filesystem",
  "@deepseek-ai/dsh-skill-office": "@galaxy-blackhole/gbh-skill-office",
  "@deepseek-ai/dsh-spill": "@galaxy-blackhole/gbh-spill",
  "@deepseek-ai/dsh-spill-local": "@galaxy-blackhole/gbh-spill-local",
  "@deepseek-ai/dsh-spill-policy": "@galaxy-blackhole/gbh-spill-policy",
  "@deepseek-ai/dsh-storage": "@galaxy-blackhole/gbh-storage",
  "@deepseek-ai/dsh-storage-domain": "@galaxy-blackhole/gbh-storage-domain",
  "@deepseek-ai/dsh-storage-json": "@galaxy-blackhole/gbh-storage-json",
  "@deepseek-ai/dsh-subagent": "@galaxy-blackhole/gbh-subagent",
  "@deepseek-ai/dsh-subagent-fork-in-process": "@galaxy-blackhole/gbh-subagent-fork-in-process",
  "@deepseek-ai/dsh-subagent-spawn-in-process": "@galaxy-blackhole/gbh-subagent-spawn-in-process",
  "@deepseek-ai/dsh-subprocess": "@galaxy-blackhole/gbh-subprocess",
  "@deepseek-ai/dsh-subprocess-local": "@galaxy-blackhole/gbh-subprocess-local",
  "@deepseek-ai/dsh-system-prompt": "@galaxy-blackhole/gbh-system-prompt",
  "@deepseek-ai/dsh-terminal": "@galaxy-blackhole/gbh-terminal",
  "@deepseek-ai/dsh-terminal-bash": "@galaxy-blackhole/gbh-terminal-bash",
  "@deepseek-ai/dsh-time-context": "@galaxy-blackhole/gbh-time-context",
  "@deepseek-ai/dsh-timeout": "@galaxy-blackhole/gbh-timeout",
  "@deepseek-ai/dsh-tmux-context": "@galaxy-blackhole/gbh-tmux-context",
  "@deepseek-ai/dsh-token-meter": "@galaxy-blackhole/gbh-token-meter",
  "@deepseek-ai/dsh-tool-bash": "@galaxy-blackhole/gbh-tool-bash",
  "@deepseek-ai/dsh-tool-bash-persistent": "@galaxy-blackhole/gbh-tool-bash-persistent",
  "@deepseek-ai/dsh-tool-call-timeout-policy": "@galaxy-blackhole/gbh-timeout-policy",
  "@deepseek-ai/dsh-tool-cordis": "@galaxy-blackhole/gbh-tool-cordis",
  "@deepseek-ai/dsh-tool-fs": "@galaxy-blackhole/gbh-tool-fs",
  "@deepseek-ai/dsh-tool-fs-search": "@galaxy-blackhole/gbh-tool-fs-search",
  "@deepseek-ai/dsh-tool-goal": "@galaxy-blackhole/gbh-tool-goal",
  "@deepseek-ai/dsh-tool-jobs": "@galaxy-blackhole/gbh-host-tool-jobs",
  "@deepseek-ai/dsh-tool-pwsh": "@galaxy-blackhole/gbh-tool-pwsh",
  "@deepseek-ai/dsh-tool-pwsh-persistent": "@galaxy-blackhole/gbh-tool-pwsh-persistent",
  "@deepseek-ai/dsh-tool-ralph": "@galaxy-blackhole/gbh-tool-ralph",
  "@deepseek-ai/dsh-tool-schedule": "@galaxy-blackhole/gbh-tool-schedule",
  "@deepseek-ai/dsh-tool-session-query": "@galaxy-blackhole/gbh-tool-session-query",
  "@deepseek-ai/dsh-tool-skill": "@galaxy-blackhole/gbh-host-tool-skill",
  "@deepseek-ai/dsh-tool-str-replace-editor": "@galaxy-blackhole/gbh-tool-str-replace-editor",
  "@deepseek-ai/dsh-tool-subagent": "@galaxy-blackhole/gbh-host-tool-subagent",
  "@deepseek-ai/dsh-tool-subagent-control": "@galaxy-blackhole/gbh-tool-subagent-control",
  "@deepseek-ai/dsh-tool-terminal": "@galaxy-blackhole/gbh-tool-terminal",
  "@deepseek-ai/dsh-tool-todo": "@galaxy-blackhole/gbh-host-tool-todo",
  "@deepseek-ai/dsh-tool-web": "@galaxy-blackhole/gbh-host-tool-web",
  "@deepseek-ai/dsh-tool-workflow": "@galaxy-blackhole/gbh-tool-workflow",
  "@deepseek-ai/dsh-tool-working-directory": "@galaxy-blackhole/gbh-tool-working-directory",
  "@deepseek-ai/dsh-tool-workspace-dependencies": "@galaxy-blackhole/gbh-tool-workspace-dependencies",
  "@deepseek-ai/dsh-tools": "@galaxy-blackhole/gbh-host-tools",
  "@deepseek-ai/dsh-typert-loader": "@galaxy-blackhole/gbh-typert-loader",
  "@deepseek-ai/dsh-typert-protocol": "@galaxy-blackhole/gbh-typert-protocol",
  "@deepseek-ai/dsh-typert-registry": "@galaxy-blackhole/gbh-typert-registry",
  "@deepseek-ai/dsh-user-approval": "@galaxy-blackhole/gbh-approval",
  "@deepseek-ai/dsh-user-questions": "@galaxy-blackhole/gbh-user-questions",
  "@deepseek-ai/dsh-util-code-language": "@galaxy-blackhole/gbh-util-code-language",
  "@deepseek-ai/dsh-util-crypto": "@galaxy-blackhole/gbh-util-crypto",
  "@deepseek-ai/dsh-util-time": "@galaxy-blackhole/gbh-util-time",
  "@deepseek-ai/dsh-util-values": "@galaxy-blackhole/gbh-util-values",
  "@deepseek-ai/dsh-util-workspace-path": "@galaxy-blackhole/gbh-util-workspace-path",
  "@deepseek-ai/dsh-web": "@galaxy-blackhole/gbh-web",
  "@deepseek-ai/dsh-web-fetch-http": "@galaxy-blackhole/gbh-web-fetch-http",
  "@deepseek-ai/dsh-web-frontend": "@galaxy-blackhole/gbh-web-frontend",
  "@deepseek-ai/dsh-web-search-deepseek": "@galaxy-blackhole/gbh-web-search",
  "@deepseek-ai/dsh-win32-process": "@galaxy-blackhole/gbh-win32-process",
  "@deepseek-ai/dsh-workflow": "@galaxy-blackhole/gbh-workflow",
  "@deepseek-ai/dsh-workflow-ptc": "@galaxy-blackhole/gbh-workflow-ptc",
  "@deepseek-ai/dsh-working-directory": "@galaxy-blackhole/gbh-working-directory",
  "@deepseek-ai/dsh-workspace": "@galaxy-blackhole/gbh-workspace",
};

/**
 * Bundle stock KHÔNG có bản port trong repo này ⇒ ẩn khỏi trang Plugins (mục "Plugin thử nghiệm"/More).
 * Đây là CỜ PHÂN LOẠI ở tầng Host, KHÔNG phải CSS: tên trong tập này bị listBundles bỏ HẲN khỏi payload nên
 * client không còn thẻ để vẽ (kể cả thẻ "bật thất bại"). Đo 11/11/2026 — hai gói subagent stock KHÔNG có bản
 * port 1:1: bảng DOI_TEN không có cặp dsh-subagent-{claude-code,codex}; repo không có gói bundle-subagent-*;
 * profile không có @galaxy-blackhole/gbh-subagent-*; chúng còn khai @openai/codex và @anthropic-ai/claude-agent-sdk
 * mà bản cài profile KHÔNG có ⇒ provider không chạy được. Khi port xong (tồn tại gói @galaxy-blackhole/gbh-subagent-*)
 * thì xoá tên khỏi tập này.
 * Vì sao (đo thật 25/10/2026): bật chúng sẽ hỏng —
 *   · `auto-review` / `tool-worktree`: bảng DOI_TEN quy về gói ROW của ta (`gbh-auto-review`,
 *     `gbh-tool-worktree`) chứ không phải bundle ⇒ host trả `not-bundle` ⇒ UI hiện "Bật thất bại".
 *   · `subagent-claude-code` / `subagent-codex`: chỉ có gói stock trên npm, repo không port ⇒ bấm là
 *     mở hộp thoại cài từ registry rồi hỏng ("Cài plugin thất bại").
 */
export const KHONG_HO_TRO: ReadonlySet<string> = new Set([
  // 11/11/2026 — KHÔI PHỤC đúng ý định 25/10/2026. Lượt cuối 25/10 đã làm RỖNG tập này kèm ghi chú SAI rằng hai
  // gói đã có "bundle-subagent-claude-code/-codex" trong repo; đo lại 11/11/2026: KHÔNG có thư mục nào như thế
  // (packages/host chỉ có bundle-auto-review + bundle-tool-worktree) và lịch sử git chưa từng có.
  // Hệ quả đo được trên host 5439: RPC pluginManager/listBundles trả 2 bundle stock với official:true ⇒ trang
  // Plugins hiện "Agent con Claude Code" / "Agent con Codex" mang id @deepseek-ai/* kèm 2 row con stock.
  // Bật gói stock ấy cũng KHÔNG sinh mục cấu hình nào (settings/describe: 21 namespace, không có codex/claude).
  "@deepseek-ai/dsh-subagent-claude-code",
  "@deepseek-ai/dsh-subagent-codex",
]);

/**
 * Bảng quy tên BUNDLE stock về gói BUNDLE của ta (khác {@link DOI_TEN} — bảng đó quy tên ROW/module).
 * Cần bảng riêng vì có bundle stock trùng tên với row của nó (`dsh-subagent-codex`, `dsh-experimental-auto-review`):
 * nếu dùng chung, tên row sẽ bị đổi thành tên bundle ⇒ Loader không tìm thấy module.
 */
export const DOI_TEN_BUNDLE: Readonly<Record<string, string>> = {
  "@deepseek-ai/dsh-experimental-auto-review": "@galaxy-blackhole/gbh-auto-review-bundle",
  "@deepseek-ai/dsh-experimental-tool-worktree": "@galaxy-blackhole/gbh-tool-worktree-bundle",
};

/**
 * Quy tên BUNDLE stock về tên gói bundle của ta.
 * Nhận: ten — tên bundle stock hoặc của ta.
 * Trả: tên bundle của ta khi có trong bảng; ngược lại dùng {@link quyTen}.
 */
export function quyTenBundle(ten: string): string {
  return DOI_TEN_BUNDLE[ten] ?? quyTen(ten);
}

/**
 * Khoá TÍNH NĂNG của một lớp bundle: bỏ scope, bỏ tiền tố `gbh-`/`dsh-`/`experimental-`, bỏ hậu tố
 * `-bundle`/`-profile`. Nhờ nó nhận ra hai CÁCH VIẾT của cùng một lớp kể cả khi bảng
 * {@link DOI_TEN_BUNDLE} không còn tác dụng.
 *
 * ⚠️ 10/11/2026 (đo thật trên host 5439): bản cài trong profile bị `tools/p1b/denta-profile.ts` đổi
 * id stock → id GBH NGAY TRONG ARTEFACT, nên hai khoá của `DOI_TEN_BUNDLE` trong bản cài thành ánh xạ
 * ĐỒNG NHẤT (`gbh-auto-review-bundle → gbh-auto-review-bundle`). Vì vậy mọi phép so danh tính bundle
 * phải dựa trên KHOÁ TÍNH NĂNG (suy từ hình dạng tên), không dựa vào bảng.
 * @param ten - tên gói bundle (id stock hay tên của ta).
 * @returns khoá tính năng; chuỗi rỗng khi tên không có phần thân.
 */
export function khoaBundle(ten: string): string {
  return ten
    .replace(/^@[^/]+\//u, "")
    .replace(/^(?:gbh|dsh)-/u, "")
    .replace(/^experimental-/u, "")
    .replace(/-(?:bundle|profile)$/u, "");
}

/**
 * Hai tên gói có trỏ về CÙNG một lớp bundle hay không: trùng sau khi quy tên, hoặc trùng KHOÁ TÍNH NĂNG
 * (khoá phải từ 4 ký tự để không gộp hai tên ngắn khác nhau).
 * Vì sao cần: công tắc trên UI có lượt gửi **id STOCK** (`@deepseek-ai/dsh-experimental-…`) trong khi
 * `dsh.profile.bundles` khai **tên của ta**. Phép so chuỗi thô không khớp ⇒ lệnh TẮT thành no-op mà
 * vẫn trả `application: applied` ⇒ công tắc tắt, row vẫn mount (đúng sự cố "Tự động duyệt" 10/11/2026).
 * @param mot - tên thứ nhất (stock hoặc của ta).
 * @param hai - tên thứ hai (stock hoặc của ta).
 * @returns true khi cả hai là cùng một lớp bundle.
 */
export function laCungBundle(mot: string, hai: string): boolean {
  const motQuy = quyTenBundle(mot);
  const haiQuy = quyTenBundle(hai);
  if (motQuy === haiQuy) return true;
  const khoa = khoaBundle(motQuy);
  return khoa.length >= 4 && khoa === khoaBundle(haiQuy);
}


/**
 * Quy một tên gói stock về tên gói của ta.
 * Nhận: ten — tên gói (có thể kèm subpath).
 * Trả: tên gói của ta khi có trong bảng, ngược lại giữ nguyên.
 */
export function quyTen(ten: string): string {
  const truc = DOI_TEN[ten];
  if (truc !== undefined) return truc;
  for (const [stock, ta] of Object.entries(DOI_TEN)) {
    if (ten.startsWith(stock + "/")) return ta + ten.slice(stock.length);
  }
  return ten;
}
