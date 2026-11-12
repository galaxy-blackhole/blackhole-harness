<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Danh sách ĐẦY ĐỦ package đã hoàn thành (số lượng + tên), sinh tự động
-->

# Danh sách package đã hoàn thành

> Sinh tự động bằng script từ `packages/*/*/package.json` (đếm bằng `JSON.parse`, không grep).
> ⚠️ **Không dùng thước đo "đủ `lib/` + tests`"** — phần lớn gói build thẳng vào profile nên `lib/` thường vắng trong repo.

## 1. Tổng số (đo lại 18/10/2026, sau lượt dịch + khai `moduleIds`)

| hạng mục | số lượng | cách đo |
|---|---|---|
| **TỔNG package** | **133** | đếm thư mục `packages/*/*/` (77 host + 56 client) |
| package `host` | **77** | thư mục `packages/host/` |
| package `client` | **56** | thư mục `packages/client/` |
| **khai `gbh.row`** (đã thay row stock) | **118** | `bun run check:rows` — "118 package co gbh.row — TAT CA dat" |
| đang MOUNT trong app (đo bằng `--dump-config`) | **55 entry** `@galaxy-blackhole/gbh-client-*` · 51/56 gói client | cây entry đã hợp |
| còn `gbh.draft` / CHUA-KHAI | **5** | `file-upload` · `ui-plugin-manager` · `ui-renderer` · `ui-shortcuts` · `ui-theme` (xem `UI-PACKAGES-STATUS.md` §3) |
| có từ điển tiếng Việt `src/locales-vi.ts` | **40 gói** (+4 gói de-bundle nhúng literal trong lát) | `tools/locale/gen-vi.ts` |

## 2. Tiến độ M6

| mốc | row | % |
|---|---|---|
| mục tiêu M6 | 78 | 100% |
| **đã mount + đã khai** | **60** | **77%** (số của phiên trước, KHÔNG đổi trong lượt này) |
| đang viết | 0 | |
| còn lại | 18 | 23% |

## 2b. Tiếng Việt (đo 18/10/2026)

| hạng mục | số lượng | cách đo |
|---|---|---|
| khoá `en` của 40 gói client CÓ bản dịch `vi` | **1993 / 1994 = 100%** | `bun run tools/locale/gen-vi.ts` |
| namespace của gói GỐC DSH được dịch TẬP TRUNG ở gói `locale` | **9** | `settings.theme` · `shortcuts` · `model` · `slash.menu` · `cordis` · `question` · `agent-team` · `voice-input` · `session-log-download` |
| bản dịch viết tay (namespace chưa có trong bản nền + khoá lệch phiên bản) | **~330 khoá** | `tools/locale/gbh-locale-vi-manual.json` |
| phép đo trên DOM thật | Settings modal + menu tài khoản: **0 dòng tiếng Anh** trong mục Chung | probe Playwright mở modal, đọc `innerText` |

## 3. Package `host` (66)

| # | tên gói | thư mục | `gbh.row` | config | test | dòng `src` |
|---|---|---|---|---|---|---|
| 1 | `@galaxy-blackhole/gbh-api-account-controller` | `account-controller` | `account-controller` | — | ✓ | 421 |
| 2 | `@galaxy-blackhole/gbh-agent-default-model` | `agent-default-model` | `agent-default-model` | ✓ | ✓ | 149 |
| 3 | `@galaxy-blackhole/gbh-agent-preset` | `agent-preset` | — | — | ✓ | 70 |
| 4 | `@galaxy-blackhole/gbh-approval` | `approval` | `approval` | ✓ | ✓ | 472 |
| 5 | `@galaxy-blackhole/gbh-authorization` | `authorization` | `authorization` | — | ✓ | 550 |
| 6 | `@galaxy-blackhole/gbh-bash-sandbox` | `bash-sandbox` | `bash-sandbox` | ✓ | ✓ | 269 |
| 7 | `@galaxy-blackhole/gbh-commands` | `commands` | `commands` | — | ✓ | 846 |
| 8 | `@galaxy-blackhole/gbh-config-editor` | `config-editor` | — | — | ✓ | 359 |
| 9 | `@galaxy-blackhole/gbh-cordis-client-runner` | `cordis-client-runner` | `cordis-client-runner` | — | ✓ | 7773 |
| 10 | `@galaxy-blackhole/gbh-credentials-local` | `credentials-local` | `credentials` | ✓ | ✓ | 1151 |
| 11 | `@galaxy-blackhole/gbh-deepseek-account` | `deepseek-account` | — | — | ✓ | 503 |
| 12 | `@galaxy-blackhole/gbh-deepseek-llm-api-extensions` | `deepseek-llm-api-extensions` | `deepseek-llm-api-extensions` | — | ✓ | 279 |
| 13 | `@galaxy-blackhole/gbh-desktop-product-telemetry` | `desktop-product-telemetry` | — | — | ✓ | 176 |
| 14 | `@galaxy-blackhole/gbh-host-directory-picker-auto` | `directory-picker-auto` | `directory-picker` | — | ✓ | 346 |
| 15 | `@galaxy-blackhole/gbh-file-reference-local` | `file-reference-local` | `file-reference-local` | — | ✓ | 791 |
| 16 | `@galaxy-blackhole/gbh-fs-observation-policy` | `fs-observation-policy` | `fs-observation-policy` | — | ✓ | 232 |
| 17 | `@galaxy-blackhole/gbh-fs-sandbox` | `fs-sandbox` | `fs-sandbox` | — | ✓ | 249 |
| 18 | `@galaxy-blackhole/gbh-goal-round-driver` | `goal-round-driver` | `goal-round-driver` | — | ✓ | 632 |
| 19 | `@galaxy-blackhole/gbh-harness-dev-context` | `harness-dev-context` | `harness-dev-context` | — | ✓ | 269 |
| 20 | `@galaxy-blackhole/gbh-hmr` | `hmr` | `hmr` | ✓ | ✓ | 2133 |
| 21 | `@galaxy-blackhole/gbh-image-offload` | `image-offload` | `image-offload` | — | ✓ | 444 |
| 22 | `@galaxy-blackhole/gbh-jobs-local` | `jobs-local` | `jobs` | — | ✓ | 1164 |
| 23 | `@galaxy-blackhole/gbh-llm-deepseek` | `llm-deepseek` | — | — | ✓ | 184 |
| 24 | `@galaxy-blackhole/gbh-llm-retry` | `llm-retry` | `llm-retry` | — | ✓ | 545 |
| 25 | `@galaxy-blackhole/gbh-mcp-resources` | `mcp-resources` | `mcp-resources` | — | ✓ | 341 |
| 26 | `@galaxy-blackhole/gbh-message-feedback` | `message-feedback` | `message-feedback` | ✓ | ✓ | 762 |
| 27 | `@galaxy-blackhole/gbh-host-open-in-app` | `open-in-app` | `open-in-app` | ✓ | ✓ | 419 |
| 28 | `@galaxy-blackhole/gbh-optional-session-title-all-prompts` | `optional-session-title-all-prompts` | `optional-session-title-all-prompts` | ✓ | ✓ | 216 |
| 29 | `@galaxy-blackhole/gbh-otel` | `otel` | `otel` | — | ✓ | 665 |
| 30 | `@galaxy-blackhole/gbh-permission` | `permission` | `permission` | ✓ | ✓ | 797 |
| 31 | `@galaxy-blackhole/gbh-host-plugin-inventory` | `plugin-inventory` | `plugin-inventory` | — | ✓ | 248 |
| 32 | `@galaxy-blackhole/gbh-plugin-package-inventory-deepseek` | `plugin-package-inventory-deepseek` | `plugin-package-inventory-deepseek` | — | ✓ | 522 |
| 33 | `@galaxy-blackhole/gbh-pwsh-sandbox` | `pwsh-sandbox` | — | — | ✓ | 353 |
| 34 | `@galaxy-blackhole/gbh-sandbox-policy` | `sandbox-policy` | `sandbox-policy` | ✓ | ✓ | 294 |
| 35 | `@galaxy-blackhole/gbh-session-checkpoint-policy` | `session-checkpoint-policy` | `session-checkpoint-policy` | — | ✓ | 238 |
| 36 | `@galaxy-blackhole/gbh-session-inspector` | `session-inspector` | `session-inspector` | — | ✓ | 4627 |
| 37 | `@galaxy-blackhole/gbh-session-projection-cache` | `session-projection-cache` | `session-projection-cache` | ✓ | ✓ | 982 |
| 38 | `@galaxy-blackhole/gbh-session-projection` | `session-projection` | `session-projection` | — | ✓ | 815 |
| 39 | `@galaxy-blackhole/gbh-session-stats` | `session-stats` | `session-stats` | — | ✓ | 386 |
| 40 | `@galaxy-blackhole/gbh-session-telemetry-otel` | `session-telemetry-otel` | `session-telemetry-otel` | ✓ | ✓ | 364 |
| 41 | `@galaxy-blackhole/gbh-session-title` | `session-title` | `session-title` | ✓ | ✓ | 1559 |
| 42 | `@galaxy-blackhole/gbh-session-turn-outline` | `session-turn-outline` | `session-turn-outline` | — | ✓ | 366 |
| 43 | `@galaxy-blackhole/gbh-api-settings-controller` | `settings-controller` | `settings-controller` | — | ✓ | 507 |
| 44 | `@galaxy-blackhole/gbh-shell-env` | `shell-env` | `shell-env` | — | ✓ | 286 |
| 45 | `@galaxy-blackhole/gbh-spill-policy` | `spill-policy` | `spill-policy` | ✓ | ✓ | 651 |
| 46 | `@galaxy-blackhole/gbh-storage-domain` | `storage-domain` | `storage-domain` | ✓ | ✓ | 1011 |
| 47 | `@galaxy-blackhole/gbh-storage` | `storage` | `storage` | — | ✓ | 307 |
| 48 | `@galaxy-blackhole/gbh-subagent-fork-in-process` | `subagent-fork-in-process` | `subagent-fork-in-process` | ✓ | ✓ | 149 |
| 49 | `@galaxy-blackhole/gbh-subagent-model-selection-settings` | `subagent-model-selection-settings` | `subagent-model-selection-settings` | ✓ | ✓ | 144 |
| 50 | `@galaxy-blackhole/gbh-subagent-spawn-in-process` | `subagent-spawn-in-process` | `subagent-spawn-in-process` | ✓ | ✓ | 105 |
| 51 | `@galaxy-blackhole/gbh-subprocess` | `subprocess` | — | — | ✓ | 501 |
| 52 | `@galaxy-blackhole/gbh-system-prompt` | `system-prompt` | `system-prompt` | ✓ | ✓ | 706 |
| 53 | `@galaxy-blackhole/gbh-timeout-policy` | `timeout-policy` | `timeout-policy` | — | ✓ | 220 |
| 54 | `@galaxy-blackhole/gbh-timer` | `timer` | `timer` | — | ✓ | 234 |
| 55 | `@galaxy-blackhole/gbh-tool-working-directory` | `tool-working-directory` | `tool-working-directory` | — | ✓ | 78 |
| 56 | `@galaxy-blackhole/gbh-tool-worktree` | `tool-worktree` | `tool-worktree` | — | ✓ | 119 |
| 57 | `@galaxy-blackhole/gbh-host-typert-gateway` | `typert-gateway` | — | — | ✓ | 392 |
| 58 | `@galaxy-blackhole/gbh-typert-loader` | `typert-loader` | `typert-loader` | — | ✓ | 804 |
| 59 | `@galaxy-blackhole/gbh-user-questions` | `user-questions` | `user-questions` | — | ✓ | 1351 |
| 60 | `@galaxy-blackhole/gbh-web-runtime` | `web-runtime` | `web-runtime` | ✓ | ✓ | 352 |
| 61 | `@galaxy-blackhole/gbh-web-startup` | `web-startup` | `web-startup` | — | ✓ | 172 |
| 62 | `@galaxy-blackhole/gbh-web` | `web` | `web` | ✓ | ✓ | 365 |
| 63 | `@galaxy-blackhole/gbh-host-webserver` | `webserver` | `webserver` | ✓ | ✓ | 949 |
| 64 | `@galaxy-blackhole/gbh-workflow` | `workflow` | — | — | ✓ | 421 |
| 65 | `@galaxy-blackhole/gbh-working-directory` | `working-directory` | `working-directory` | — | ✓ | 512 |
| 66 | `@galaxy-blackhole/gbh-worktree` | `worktree` | `worktree` | — | ✓ | 727 |

## 4. Package `client` (55)

| # | tên gói | thư mục | `gbh.row` | test | dòng `src` |
|---|---|---|---|---|---|
| 1 | `@galaxy-blackhole/gbh-client-hmr` | `client-hmr` | `client-hmr` | ✓ | 576 |
| 2 | `@galaxy-blackhole/gbh-client-connection` | `connection` | `connection` | ✓ | 2535 |
| 3 | `@galaxy-blackhole/gbh-client-file-upload` | `file-upload` | — | ✓ | 579 |
| 4 | `@galaxy-blackhole/gbh-client-locale` | `locale` | `locale` | ✓ | 1179 |
| 5 | `@galaxy-blackhole/gbh-client-modules` | `modules` | `modules` | — | 3101 |
| 6 | `@galaxy-blackhole/gbh-client-product-analytics` | `product-analytics` | `product-analytics` | ✓ | 725 |
| 7 | `@galaxy-blackhole/gbh-client-resources` | `resources` | `resources` | ✓ | 436 |
| 8 | `@galaxy-blackhole/gbh-client-shortcuts` | `shortcuts` | `shortcuts` | — | 2393 |
| 9 | `@galaxy-blackhole/gbh-client-ui-agent-preset` | `ui-agent-preset` | `ui-agent-preset` | ✓ | 2860 |
| 10 | `@galaxy-blackhole/gbh-client-ui-approval` | `ui-approval` | `ui-approval` | ✓ | 819 |
| 11 | `@galaxy-blackhole/gbh-client-ui-attachment` | `ui-attachment` | `ui-attachment` | ✓ | 326 |
| 12 | `@galaxy-blackhole/gbh-client-ui-brand-official` | `ui-brand-official` | `ui-brand-official` | ✓ | 138 |
| 13 | `@galaxy-blackhole/gbh-client-ui-chat` | `ui-chat` | `ui-chat` | ✓ | 13848 |
| 14 | `@galaxy-blackhole/gbh-client-ui-commands` | `ui-commands` | `ui-commands` | ✓ | 2502 |
| 15 | `@galaxy-blackhole/gbh-client-ui-conversation` | `ui-conversation` | `ui-conversation` | ✓ | 21332 |
| 16 | `@galaxy-blackhole/gbh-client-ui-deliverables` | `ui-deliverables` | `ui-deliverables` | ✓ | 3545 |
| 17 | `@galaxy-blackhole/gbh-client-ui-goal` | `ui-goal` | `ui-goal` | ✓ | 1347 |
| 18 | `@galaxy-blackhole/gbh-client-ui-jobs` | `ui-jobs` | `ui-jobs` | ✓ | 432 |
| 19 | `@galaxy-blackhole/gbh-client-ui-layout` | `ui-layout` | `ui-layout` | ✓ | 1348 |
| 20 | `@galaxy-blackhole/gbh-client-ui-message-feedback` | `ui-message-feedback` | `ui-message-feedback` | ✓ | 1621 |
| 21 | `@galaxy-blackhole/gbh-client-ui-open-in-app` | `ui-open-in-app` | `ui-open-in-app` | ✓ | 1687 |
| 22 | `@galaxy-blackhole/gbh-client-ui-permission-presets` | `ui-permission` | `ui-permission` | ✓ | 1653 |
| 23 | `@galaxy-blackhole/gbh-client-ui-plan` | `ui-plan` | `ui-plan` | ✓ | 1827 |
| 24 | `@galaxy-blackhole/gbh-client-ui-plugin-manager` | `ui-plugin-manager` | draft | ✓ | 769 |
| 25 | `@galaxy-blackhole/gbh-client-ui-plugin-market` | `ui-plugin-market` | `ui-plugin-market` | ✓ | 2710 |
| 26 | `@galaxy-blackhole/gbh-client-ui-reference` | `ui-reference` | `ui-reference` | ✓ | 1112 |
| 27 | `@galaxy-blackhole/gbh-client-ui-renderer` | `ui-renderer` | draft | ✓ | 546 |
| 28 | `@galaxy-blackhole/gbh-client-ui-schedule` | `ui-schedule` | `ui-schedule` | ✓ | 8179 |
| 29 | `@galaxy-blackhole/gbh-client-ui-secret-mask` | `ui-secret-mask` | `ui-secret-mask` | ✓ | 1039 |
| 30 | `@galaxy-blackhole/gbh-client-ui-session` | `ui-session` | `ui-session` | ✓ | 1024 |
| 31 | `@galaxy-blackhole/gbh-client-ui-settings-account` | `ui-settings-account` | `ui-settings-account` | ✓ | 5519 |
| 32 | `@galaxy-blackhole/gbh-client-ui-settings-agent-loop` | `ui-settings-agent-loop` | `ui-settings-agent-loop` | ✓ | 443 |
| 33 | `@galaxy-blackhole/gbh-client-ui-settings-general` | `ui-settings-general` | `ui-settings-general` | ✓ | 2011 |
| 34 | `@galaxy-blackhole/gbh-client-ui-settings-models` | `ui-settings-models` | `ui-settings-models` | ✓ | 4276 |
| 35 | `@galaxy-blackhole/gbh-client-ui-settings-plugin-inventory` | `ui-settings-plugin-inventory` | `ui-settings-plugin-inventory` | ✓ | 1341 |
| 36 | `@galaxy-blackhole/gbh-client-ui-settings-plugins` | `ui-settings-plugins` | `ui-settings-plugins` | ✓ | 487 |
| 37 | `@galaxy-blackhole/gbh-client-ui-settings-session-log` | `ui-settings-session-log` | `ui-settings-session-log` | ✓ | 322 |
| 38 | `@galaxy-blackhole/gbh-client-ui-settings-shell` | `ui-settings-shell` | `ui-settings-shell` | ✓ | 483 |
| 39 | `@galaxy-blackhole/gbh-client-ui-settings-subagent` | `ui-settings-subagent` | `ui-settings-subagent` | ✓ | 1790 |
| 40 | `@galaxy-blackhole/gbh-client-ui-settings-web-search` | `ui-settings-web-search` | `ui-settings-web-search` | ✓ | 442 |
| 41 | `@galaxy-blackhole/gbh-client-ui-settings` | `ui-settings` | `ui-settings` | ✓ | 1188 |
| 42 | `@galaxy-blackhole/gbh-client-ui-shortcuts` | `ui-shortcuts` | draft | ✓ | 1055 |
| 43 | `@galaxy-blackhole/gbh-client-ui-sidebar-browser` | `ui-sidebar-browser` | `ui-sidebar-browser` | ✓ | 2237 |
| 44 | `@galaxy-blackhole/gbh-client-ui-sidebar-documentpreview` | `ui-sidebar-documentpreview` | `ui-sidebar-documentpreview` | ✓ | 5431 |
| 45 | `@galaxy-blackhole/gbh-client-ui-sidebar-files` | `ui-sidebar-files` | `ui-sidebar-files` | ✓ | 1623 |
| 46 | `@galaxy-blackhole/gbh-client-ui-sidebar-right` | `ui-sidebar-right` | `ui-sidebar-right` | ✓ | 3787 |
| 47 | `@galaxy-blackhole/gbh-client-ui-sidebar-terminal` | `ui-sidebar-terminal` | `ui-sidebar-terminal` | ✓ | 1538 |
| 48 | `@galaxy-blackhole/gbh-client-ui-sidebar` | `ui-sidebar` | `ui-sidebar` | ✓ | 1045 |
| 49 | `@galaxy-blackhole/gbh-client-ui-skill` | `ui-skill` | `ui-skill` | ✓ | 746 |
| 50 | `@galaxy-blackhole/gbh-client-ui-subagent` | `ui-subagent` | `ui-subagent` | ✓ | 2078 |
| 51 | `@galaxy-blackhole/gbh-client-ui-theme` | `ui-theme` | draft | ✓ | 675 |
| 52 | `@galaxy-blackhole/gbh-client-ui-tool` | `ui-tool` | `ui-tool` | ✓ | 6630 |
| 53 | `@galaxy-blackhole/gbh-client-ui-trajectory` | `ui-trajectory` | `ui-trajectory` | ✓ | 8840 |
| 54 | `@galaxy-blackhole/gbh-client-ui-workflow-run` | `ui-workflow-run` | `ui-workflow-run` | ✓ | 1489 |
| 55 | `@galaxy-blackhole/gbh-client-ui-workspace` | `ui-workspace` | `ui-workspace` | ✓ | 5907 |
