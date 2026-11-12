<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bảng theo dõi chuyển đổi DSH → GBH: MỌI package DSH đang cài + cột convert. SINH TỰ ĐỘNG.
-->

# Ma trận chuyển đổi DSH → Galaxy Blackhole

> **Sinh tự động — KHÔNG sửa tay.** Chạy lại: `~/.bun/bin/bun run tools/check/conversion-matrix.ts`.
> Nguồn: cây entry `host --dump-config` · `apps/host/node_modules/@deepseek-ai/*` · `gbh.row.aliases` · `docs/contracts/data/conversion-signoff.json`.

## 1. Quy ước cột và trạng thái

| cột | nghĩa |
|---|---|
| **X** | **chưa chuyển** — chưa có package GBH thay thế (hoặc không ánh xạ được 1:1) |
| **-** | **đang chuyển** — đã có package GBH nhưng CHƯA đủ 3 chữ ký |
| **✓** | **đã chuyển thành công** — đủ 3 chữ ký: subagent phát triển · teammate phụ trách · teammate reviewer |
| **mount** | package GBH đang chạy thật trong cây entry đã hợp |
| **test** | package GBH có tệp test khai trong `gbh.row.tests` |
| **ký** | ba ô theo thứ tự dev · owner · reviewer (`·` = chưa ký, `✓` = đã ký) |

## 2. Tổng quan

| hạng mục | số lượng |
|---|---|
| package DSH đang cài | **292** |
| ✓ đã chuyển + đủ chữ ký | **292** |
| - đang chuyển (có GBH, chờ ký) | **0** |
| X chưa chuyển | **0** |
| entry GỐC còn đang chạy (phải thay) | **0** |

## 3. Bảng theo nhóm

### acp (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-acp` | Automation-only Agent Client Protocol server for driving DeepSeek Harness agents over JSON | `gbh-acp` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-acp-app` | The dsh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over dsh- | `gbh-acp-app` | — | — | ✓✓✓ | ✓ |

### agent (7)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-agent` | Agent interface, registry, initiator scope, and event vocabulary for the DeepSeek Harness | `gbh-agent` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-agent-default-model` | Default model selection shared by Agent entry points | `gbh-agent-default-model` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-agent-instructions` | Workspace context loader for AGENTS.md/CLAUDE.md instruction files | `gbh-agent-instructions` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-agent-loop` | The concrete agent loop plugin for the DeepSeek Harness | `gbh-host-agent-loop` | C | C | ✓✓✓ | ✓ |
| 5 | `dsh-agent-preset` | Declare an Agent capability composition in Cordis YAML | `gbh-agent-preset` | — | — | ✓✓✓ | ✓ |
| 6 | `dsh-agent-preset-registry` | Declarative Agent preset registry and profile-backed editing | `gbh-agent-preset-registry` | C | C | ✓✓✓ | ✓ |
| 7 | `dsh-agent-tool-presentation` | Agent-plane presentation selector: composes one agent's tools as PTC mode or native tool c | `gbh-agent-tool-presentation` | — | — | ✓✓✓ | ✓ |

### anonymous (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-anonymous-user-id` | Shared anonymous user identity for DeepSeek Harness telemetry and feedback correlation | `gbh-anonymous-user-id` | — | — | ✓✓✓ | ✓ |

### api (10)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-api-account-controller` | Expose safe account operations over authenticated Remote | `gbh-api-account-controller` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-api-gateway` | Typert Remote Host dispatcher and Client API endpoint | `gbh-host-typert-gateway` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-api-job-controller` | Job Remote observation stream and the reference-counted client job-output service | `gbh-api-job-controller` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-api-remote-access` | Method-level Remote access control for non-owner Peers and the per-Peer access snapshot | `gbh-api-remote-access` | C | C | ✓✓✓ | ✓ |
| 5 | `dsh-api-remotes` | Remote BFF assembly for application-selected Host capabilities | `gbh-api-remotes` | C | C | ✓✓✓ | ✓ |
| 6 | `dsh-api-session-controller` | Session Remote commands, cold reads, and live control transport | `gbh-api-session-controller` | C | C | ✓✓✓ | ✓ |
| 7 | `dsh-api-settings-controller` | Remote owner for the configuration surfaces over the settings-domain seams | `gbh-api-settings-controller` | C | C | ✓✓✓ | ✓ |
| 8 | `dsh-api-terminal-controller` | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote | `gbh-api-terminal-controller` | C | C | ✓✓✓ | ✓ |
| 9 | `dsh-api-workspace-controller` | Workspace Remote commands and reconnect-safe state transport | `gbh-api-workspace-controller` | C | C | ✓✓✓ | ✓ |
| 10 | `dsh-api-workspace-files` | Workspace file service and Client resource provider: bounded reads, directory listing, and | `gbh-api-workspace-files` | C | C | ✓✓✓ | ✓ |

### app (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-app-boot` | Shared boot glue for the app bins: .env loading, fail-loud Loader guards, snapshot-aware c | `gbh-app-boot` | — | — | ✓✓✓ | ✓ |

### atomic (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-atomic-write` | Zero-dependency atomic file replacement: exclusive-create random-suffix temp + rename carr | `gbh-atomic-write` | — | — | ✓✓✓ | ✓ |

### attachment (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-attachment` | Durable immutable attachment storage seam for the DeepSeek Harness | `gbh-attachment` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-attachment-local` | Private content-addressed DSH_HOME attachment storage | `gbh-attachment-local` | C | C | ✓✓✓ | ✓ |

### authorization (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-authorization` | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential throug | `gbh-authorization` | C | C | ✓✓✓ | ✓ |

### base (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-base` | The shared dsh core as a profile bundle: the first patch layer of base-backed profiles, in | `gbh-base` | — | — | ✓✓✓ | ✓ |

### bash (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-bash-local` | Local-subprocess implementation of the DeepSeek Harness bash executor seam | `gbh-bash-local` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-bash-sandbox` | Sandbox-consuming implementation of the DeepSeek Harness bash executor seam (confines ever | `gbh-bash-sandbox` | C | C | ✓✓✓ | ✓ |

### brand (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-brand` | Stateless branded primitive types for the DeepSeek Harness | `gbh-brand` | — | — | ✓✓✓ | ✓ |

### chunked (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-chunked-list` | Persistent append-only chunked lists with bounded copying and JSON checkpoint validation | `gbh-chunked-list` | — | — | ✓✓✓ | ✓ |

### client (8)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-client-connection` | Authenticated RPC transport and generation lifecycle | `gbh-client-connection` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-client-file-upload` | Agent-scoped browser file upload, streaming intake, and staged receipt service | `gbh-client-file-upload` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-client-hmr` | Web client graph synchronization and rebuilt-bundle reload transport | `gbh-client-hmr` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-client-locale` | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and  | `gbh-client-locale` | C | C | ✓✓✓ | ✓ |
| 5 | `dsh-client-modules` | Client module system, dual-face: node half composes the __DSH_BOOT__ entry graph (incremen | `gbh-client-modules` | C | C | ✓✓✓ | ✓ |
| 6 | `dsh-client-product-analytics` | Desktop product event collection and authenticated Host reporting | `gbh-client-product-analytics` | C | C | ✓✓✓ | ✓ |
| 7 | `dsh-client-resources` | Unified client resource model: protocol-registered providers turn URL addresses into live  | `gbh-client-resources` | C | C | ✓✓✓ | ✓ |
| 8 | `dsh-client-shortcuts` | Application keyboard command registry and physical-key routing | `gbh-client-shortcuts` | C | C | ✓✓✓ | ✓ |

### client-ui (53)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-client-ui-agent-preset` | Agent-preset surfaces: the default for later sessions, this session's seat, and the compos | `gbh-client-ui-agent-preset` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-client-ui-approval` | Approval composer takeover over the scoped Remote Event waterfall | `gbh-client-ui-approval` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-client-ui-attachment` | Dynamic attachment presentation plugin for conversation input, message-image, and trajecto | `gbh-client-ui-attachment` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-client-ui-brand-official` | Official DeepSeek Harness brand occupants for the Web client's sidebar slots | `gbh-client-ui-brand-official` | C | C | ✓✓✓ | ✓ |
| 5 | `dsh-client-ui-chat` | Chat Conversation target, node definitions, renderers, and details surface | `gbh-client-ui-chat` | C | C | ✓✓✓ | ✓ |
| 6 | `dsh-client-ui-commands` | Client command surface: global directory cache, '/' source, three command UI kinds, popupS | `gbh-client-ui-commands` | C | C | ✓✓✓ | ✓ |
| 7 | `dsh-client-ui-conversation` | Target-neutral Conversation assembly, shell, composer, queue, and view navigation | `gbh-client-ui-conversation` | C | C | ✓✓✓ | ✓ |
| 8 | `dsh-client-ui-cordis` | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop  | `gbh-client-ui-cordis` | C | C | ✓✓✓ | ✓ |
| 9 | `dsh-client-ui-deliverables` | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-resp | `gbh-client-ui-deliverables` | C | C | ✓✓✓ | ✓ |
| 10 | `dsh-client-ui-directory-picker-browse` | In-app directory browsing surface: the workspace directory-flow owner rendering the host's | `gbh-client-ui-directory-picker-browse` | — | — | ✓✓✓ | ✓ |
| 11 | `dsh-client-ui-directory-picker-native` | Native directory-picker surface: the renderless workspace directory-flow occupant driving  | `gbh-client-ui-directory-picker-native` | — | — | ✓✓✓ | ✓ |
| 12 | `dsh-client-ui-goal` | Session goal surface: GoalBar docked above the composer, read from the goal session projec | `gbh-client-ui-goal` | C | C | ✓✓✓ | ✓ |
| 13 | `dsh-client-ui-input-trigger` | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered  | `gbh-client-ui-input-trigger` | C | C | ✓✓✓ | ✓ |
| 14 | `dsh-client-ui-jobs` | Session-header background-job list with on-demand streaming record panels | `gbh-client-ui-jobs` | C | C | ✓✓✓ | ✓ |
| 15 | `dsh-client-ui-layout` | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (n | `gbh-client-ui-layout` | C | C | ✓✓✓ | ✓ |
| 16 | `dsh-client-ui-message-feedback` | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip a | `gbh-client-ui-message-feedback` | — | C | ✓✓✓ | ✓ |
| 17 | `dsh-client-ui-model-selection` | Model selection over the shared model catalog, Session projection, and session.selectModel | `gbh-client-ui-model-selection` | C | C | ✓✓✓ | ✓ |
| 18 | `dsh-client-ui-open-in-app` | Web "Open In..." controls: the Session-header split button opening the workspace directory | `gbh-client-ui-open-in-app` | C | C | ✓✓✓ | ✓ |
| 19 | `dsh-client-ui-permission-presets` | Permission surfaces: a new-session default in General settings and a current-session /perm | `gbh-client-ui-permission-presets` | C | C | ✓✓✓ | ✓ |
| 20 | `dsh-client-ui-plan` | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews | `gbh-client-ui-plan` | C | C | ✓✓✓ | ✓ |
| 21 | `dsh-client-ui-plugin-manager` | Plugin management for the dsh web client: the sidebar Plugins panel installs, enables, dis | `gbh-client-ui-plugin-manager` | C | C | ✓✓✓ | ✓ |
| 22 | `dsh-client-ui-plugin-market` | Discover tab of the dsh web Plugins page: browse configured plugin market indexes and inst | `gbh-client-ui-plugin-market` | C | C | ✓✓✓ | ✓ |
| 23 | `dsh-client-ui-reference` | Unified Web @file and @session reference source | `gbh-client-ui-reference` | C | C | ✓✓✓ | ✓ |
| 24 | `dsh-client-ui-renderer` | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application ro | `gbh-client-ui-renderer` | C | C | ✓✓✓ | ✓ |
| 25 | `dsh-client-ui-schedule` | Host task management page and Session reminder catalog | `gbh-client-ui-schedule` | C | C | ✓✓✓ | ✓ |
| 26 | `dsh-client-ui-secret-mask` | Web display masking for recognized credentials in sent user text | `gbh-client-ui-secret-mask` | C | C | ✓✓✓ | ✓ |
| 27 | `dsh-client-ui-session` | Session Controller adapter for React and session-scoped slots | `gbh-client-ui-session` | C | C | ✓✓✓ | ✓ |
| 28 | `dsh-client-ui-settings` | Settings domain base plugin: shared configuration forms and the canonical settings slot-ty | `gbh-client-ui-settings` | C | C | ✓✓✓ | ✓ |
| 29 | `dsh-client-ui-settings-account` | Manage DeepSeek login and open Platform billing pages | `gbh-client-ui-settings-account` | C | C | ✓✓✓ | ✓ |
| 30 | `dsh-client-ui-settings-agent-loop` | Settings page of the agent loop on the dsh web client's Plugins page: the parallel tool-ca | `gbh-client-ui-settings-agent-loop` | C | C | ✓✓✓ | ✓ |
| 31 | `dsh-client-ui-settings-general` | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/ | `gbh-client-ui-settings-general` | C | C | ✓✓✓ | ✓ |
| 32 | `dsh-client-ui-settings-models` | Models settings and shared product-onboarding dialogs over existing settings and credentia | `gbh-client-ui-settings-models` | C | C | ✓✓✓ | ✓ |
| 33 | `dsh-client-ui-settings-plugin-inventory` | Read-only Cordis Loader inventory tab in Web Plugins settings | `gbh-client-ui-settings-plugin-inventory` | C | C | ✓✓✓ | ✓ |
| 34 | `dsh-client-ui-settings-plugins` | Built-in plugins settings section for the dsh web client: the Settings navigation entry an | `gbh-client-ui-settings-plugins` | C | C | ✓✓✓ | ✓ |
| 35 | `dsh-client-ui-settings-session-log` | General settings control for Session-log upload with DeepSeek API requests | `gbh-client-ui-settings-session-log` | C | C | ✓✓✓ | ✓ |
| 36 | `dsh-client-ui-settings-shell` | Settings page of the shell executor on the dsh web client's Plugins page: the command time | `gbh-client-ui-settings-shell` | C | C | ✓✓✓ | ✓ |
| 37 | `dsh-client-ui-settings-subagent` | Settings page of Subagent delegation on the dsh web client's Plugins page: recursion depth | `gbh-client-ui-settings-subagent` | C | C | ✓✓✓ | ✓ |
| 38 | `dsh-client-ui-settings-web-search` | Settings page of the DeepSeek web-search provider on the dsh web client's Plugins page: it | `gbh-client-ui-settings-web-search` | C | C | ✓✓✓ | ✓ |
| 39 | `dsh-client-ui-shortcuts` | Keyboard shortcut reference, recording, and local preference editing | `gbh-client-ui-shortcuts` | C | C | ✓✓✓ | ✓ |
| 40 | `dsh-client-ui-sidebar` | Sidebar plugin: session multi-level tree, search, grouping, state dots | `gbh-client-ui-sidebar` | C | C | ✓✓✓ | ✓ |
| 41 | `dsh-client-ui-sidebar-browser` | Sandboxed Web browser tabs for the right Sidebar | `gbh-client-ui-sidebar-browser` | C | C | ✓✓✓ | ✓ |
| 42 | `dsh-client-ui-sidebar-documentpreview` | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PD | `gbh-client-ui-sidebar-documentpreview` | C | C | ✓✓✓ | ✓ |
| 43 | `dsh-client-ui-sidebar-files` | Workspace file tree tab type for the right Sidebar: lazy directory listing over the worksp | `gbh-client-ui-sidebar-files` | C | C | ✓✓✓ | ✓ |
| 44 | `dsh-client-ui-sidebar-right` | Right Sidebar: the docking surface's session-bound state, its panel and header expand cont | `gbh-client-ui-sidebar-right` | C | C | ✓✓✓ | ✓ |
| 45 | `dsh-client-ui-sidebar-terminal` | Interactive shell tabs for the right Sidebar | `gbh-client-ui-sidebar-terminal` | C | C | ✓✓✓ | ✓ |
| 46 | `dsh-client-ui-skill` | Web skill references and the dedicated skill tool row | `gbh-client-ui-skill` | C | C | ✓✓✓ | ✓ |
| 47 | `dsh-client-ui-subagent` | Subagent conversation catalog, continuation routing UI, and '@' reference source | `gbh-client-ui-subagent` | C | C | ✓✓✓ | ✓ |
| 48 | `dsh-client-ui-theme` | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/d | `gbh-client-ui-theme` | C | C | ✓✓✓ | ✓ |
| 49 | `dsh-client-ui-tool` | Client Tool call-tree renderer and keyed per-tool presentation slot | `gbh-client-ui-tool` | C | C | ✓✓✓ | ✓ |
| 50 | `dsh-client-ui-trajectory` | Trajectory event ledger with an interactive timing overview: pure-consumer plugin register | `gbh-client-ui-trajectory` | C | C | ✓✓✓ | ✓ |
| 51 | `dsh-client-ui-user-questions` | Web ask_user_question composer takeover and plan-review presentation UI | `gbh-client-ui-user-questions` | C | C | ✓✓✓ | ✓ |
| 52 | `dsh-client-ui-workflow-run` | Durable workflow-run Conversation Node and nested member disclosure for dsh web | `gbh-client-ui-workflow-run` | C | C | ✓✓✓ | ✓ |
| 53 | `dsh-client-ui-workspace` | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state w | `gbh-client-ui-workspace` | C | C | ✓✓✓ | ✓ |

### cmdline (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-cmdline` | Immutable command-line handoff from a dsh launcher to any app plugin that injects cmdlineA | `gbh-cmdline` | — | — | ✓✓✓ | ✓ |

### command (3)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-command-compact` | Human-facing slash command for explicit session compaction | `gbh-command-compact` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-command-feedback` | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the huma | `gbh-command-feedback` | — | C | ✓✓✓ | ✓ |
| 3 | `dsh-command-goal` | Human-facing slash command for persisted same-session goals | `gbh-command-goal` | — | C | ✓✓✓ | ✓ |

### commands (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-commands` | Plugin-owned human command registry for DeepSeek Harness UIs | `gbh-commands` | C | C | ✓✓✓ | ✓ |

### compaction (4)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-compaction` | Abstract compaction service seam (ctx.compaction) for the DeepSeek Harness | `gbh-compaction` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-compaction-basic` | Token-meter-driven compaction policy and LLM summarization backend for the DeepSeek Harnes | `gbh-compaction-basic` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-compaction-image-offload` | Durable image offload for image-capable routes: replace over-budget request images with pl | `gbh-image-offload` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-compaction-tool-result-pruner` | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes | `gbh-compaction-tool-result-pruner` | — | — | ✓✓✓ | ✓ |

### config (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-config-editor` | Persist plugin configuration through profile patches and Loader reconciliation | `gbh-config-editor` | C | C | ✓✓✓ | ✓ |

### cordis (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-cordis-client-runner` | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, | `gbh-cordis-client-runner` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-cordis-host-runner` | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table | `gbh-host-cordis-host-runner` | C | C | ✓✓✓ | ✓ |

### credentials (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-credentials` | Abstract credential seam (ctx.credentials): settings carry references to secrets, provider | `gbh-credentials` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-credentials-local` | File-backed credentials provider ($DSH_HOME/.env under the live process environment) for t | `gbh-credentials-local` | C | C | ✓✓✓ | ✓ |

### deepseek (3)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-deepseek-account` | Read account state and resolve official API credentials | `gbh-deepseek-account` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-deepseek-account-platform` | Authorize DeepSeek accounts through browser PKCE | `gbh-account-platform` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-deepseek-llm-api-extensions` | Additive request-field registry for the official DeepSeek LLM API adapter | `gbh-deepseek-llm-api-extensions` | C | C | ✓✓✓ | ✓ |

### deque (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-deque` | Zero-dependency circular deque with amortized constant-time end operations and bounded vac | `gbh-deque` | — | — | ✓✓✓ | ✓ |

### experimental (24)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-experimental-agent-team` | Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG | `gbh-experimental-agent-team` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-experimental-agent-team-profile` | Agent Teams collaboration, tools, and Web UI in one experimental bundle | `gbh-agent-team-profile` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-experimental-api-speech-to-text` | Authenticated experimental speech transcription for browser clients | `gbh-experimental-api-speech-to-text` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-experimental-auto-review` | Per-tool LLM authorization review for the DeepSeek Harness Auto permission preset | `gbh-auto-review` | C | C | ✓✓✓ | ✓ |
| 5 | `dsh-experimental-badge-skill-bundle` | Let agents add a “powered by dsh” badge to documents, pull requests, and other outputs. | `gbh-badge-skill-bundle` | — | — | ✓✓✓ | ✓ |
| 6 | `dsh-experimental-client-ui-agent-team` | Web Agent Teams roster, task board, and teammate navigation | `gbh-client-ui-agent-team` | C | C | ✓✓✓ | ✓ |
| 7 | `dsh-experimental-client-ui-cot-translation` | Optional machine translation of expanded reasoning, preserving original Session text | `gbh-client-ui-cot-translation` | C | C | ✓✓✓ | ✓ |
| 8 | `dsh-experimental-client-ui-voice-input` | Record speech and insert editable text into the conversation draft | `gbh-experimental-client-ui-voice-input` | C | C | ✓✓✓ | ✓ |
| 9 | `dsh-experimental-cot-translation-bundle` | Experimental machine translation of expanded reasoning | `gbh-cot-translation-bundle` | — | — | ✓✓✓ | ✓ |
| 10 | `dsh-experimental-inspector` | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection | `gbh-experimental-inspector` | C | C | ✓✓✓ | ✓ |
| 11 | `dsh-experimental-inspector-profile` | Optional Web bundle for raw Session logs and Chat node inspection | `gbh-inspector-profile` | — | — | ✓✓✓ | ✓ |
| 12 | `dsh-experimental-plugin-market-bundle` | Experimental custom plugin markets: a Discover tab that browses and installs bundles from  | `gbh-plugin-market-bundle` | — | — | ✓✓✓ | ✓ |
| 13 | `dsh-experimental-ralph-bundle` | Run explicitly requested repeated work with fresh agents. | `gbh-ralph-bundle` | — | — | ✓✓✓ | ✓ |
| 14 | `dsh-experimental-session-inspector` | Experimental virtualized Session log and live Chat group/node inspectors | `gbh-session-inspector` | C | C | ✓✓✓ | ✓ |
| 15 | `dsh-experimental-session-search` | Give Agents tools to search and read earlier sessions from the current workspace. | `gbh-session-search` | — | — | ✓✓✓ | ✓ |
| 16 | `dsh-experimental-session-titles-bundle` | Refresh session titles as new human prompts arrive. | `gbh-session-titles-bundle` | — | — | ✓✓✓ | ✓ |
| 17 | `dsh-experimental-speech-to-text` | Experimental speech recognition with independently selectable providers | `gbh-experimental-speech-to-text` | C | C | ✓✓✓ | ✓ |
| 18 | `dsh-experimental-speech-to-text-sensevoice` | Local SenseVoice ONNX transcription with a managed sherpa-onnx process | `gbh-experimental-speech-to-text-sensevoice` | C | C | ✓✓✓ | ✓ |
| 19 | `dsh-experimental-terminal-bundle` | Keep shell processes alive across tool calls. | `gbh-terminal-bundle` | — | — | ✓✓✓ | ✓ |
| 20 | `dsh-experimental-tool-agent-team` | Scoped model-facing Agent Teams tools over ctx.agentTeams | `gbh-experimental-tool-agent-team` | C | C | ✓✓✓ | ✓ |
| 21 | `dsh-experimental-tool-worktree` | Model tool that creates and enters a new Git worktree | `gbh-tool-worktree` | C | C | ✓✓✓ | ✓ |
| 22 | `dsh-experimental-translator` | Machine translation with reusable Session results | `gbh-host-experimental-translator` | C | C | ✓✓✓ | ✓ |
| 23 | `dsh-experimental-voice-input-bundle` | Experimental voice input with local SenseVoice; downloads its runtime on first use | `gbh-voice-input-bundle` | — | — | ✓✓✓ | ✓ |
| 24 | `dsh-experimental-worktree` | Creates a named Git worktree and changes the calling Session working directory | `gbh-worktree` | C | C | ✓✓✓ | ✓ |

### file (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-file-reference` | File-reference discovery contract and shared @file grammar | `gbh-file-reference` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-file-reference-local` | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes | `gbh-file-reference-local` | C | C | ✓✓✓ | ✓ |

### fs (4)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-fs` | Abstract filesystem capability seam (ctx.fs) for the DeepSeek Harness — vocabulary types,  | `gbh-fs` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-fs-local` | Local-filesystem implementation of the DeepSeek Harness filesystem seam (ctx.fs) | `gbh-fs-local` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-fs-observation-policy` | File-context policy plugin for the DeepSeek Harness — observed-state, read-before-edit, an | `gbh-fs-observation-policy` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-fs-sandbox` | Sandbox-enforcing implementation of the DeepSeek Harness filesystem seam: fences write/edi | `gbh-fs-sandbox` | C | C | ✓✓✓ | ✓ |

### goal (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-goal` | Event-sourced same-session goal state and lifecycle service for the DeepSeek Harness | `gbh-goal` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-goal-round-driver` | Race-fenced same-session goal-round driver | `gbh-goal-round-driver` | C | C | ✓✓✓ | ✓ |

### harness (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-harness-dev-context` | Model context naming the DeepSeek Harness checkout and Web GUI URL without letting either  | `gbh-harness-dev-context` | C | C | ✓✓✓ | ✓ |

### headless (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-headless` | The dsh one-shot bundle: a direct core Agent/Session runner over dsh-base with no Host, HT | `gbh-headless` | — | — | ✓✓✓ | ✓ |

### hmr (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-hmr` | Coordinated module and profile configuration hot reload | `gbh-hmr` | C | C | ✓✓✓ | ✓ |

### home (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-home-paths` | Shared filesystem path helpers for the DeepSeek Harness | `gbh-home-paths` | — | — | ✓✓✓ | ✓ |

### host (9)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-host-directory-picker` | Abstract workspace-directory picking seam (ctx.directoryPicker) for the DeepSeek Harness w | `gbh-host-directory-picker` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-host-directory-picker-auto` | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mou | `gbh-host-directory-picker-auto` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-host-directory-picker-browse` | In-app browsing backend of the directory-picker seam (listing/creation primitives over the | `gbh-host-directory-picker-browse` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-host-directory-picker-native` | Native-OS-chooser backend of the directory-picker seam for the DeepSeek Harness web GUI ho | `gbh-host-directory-picker-native` | — | — | ✓✓✓ | ✓ |
| 5 | `dsh-host-frontend-static` | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit inde | `gbh-host-frontend-static` | — | — | ✓✓✓ | ✓ |
| 6 | `dsh-host-open-in-app` | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as  | `gbh-host-open-in-app` | C | C | ✓✓✓ | ✓ |
| 7 | `dsh-host-plugin-inventory` | Read-only Remote projection of current Cordis Loader plugin state | `gbh-host-plugin-inventory` | C | C | ✓✓✓ | ✓ |
| 8 | `dsh-host-product-telemetry-otel` | Explicit product usage events exported through OpenTelemetry HTTP logs | `gbh-desktop-product-telemetry` | C | C | ✓✓✓ | ✓ |
| 9 | `dsh-host-webserver` | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static d | `gbh-host-webserver` | C | C | ✓✓✓ | ✓ |

### http (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-http-proxy` | Process-wide outbound HTTP proxy policy for DeepSeek Harness: resolve it from the launch e | `gbh-http-proxy` | — | — | ✓✓✓ | ✓ |

### jobs (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-jobs` | Background job registry (ctx.jobs) for the DeepSeek Harness — shared ids, owner isolation, | `gbh-jobs` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-jobs-local` | Process-local implementation of the DeepSeek Harness background job registry seam | `gbh-jobs-local` | C | C | ✓✓✓ | ✓ |

### launch (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-launch-environment` | Immutable DeepSeek Harness launch environment that records which layer supplied each value | `gbh-launch-environment` | — | — | ✓✓✓ | ✓ |

### lazy (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-lazy-require` | Caller-relative, success-cached lazy loading for CommonJS-compatible Host dependencies | `gbh-lazy-require` | — | — | ✓✓✓ | ✓ |

### llm (6)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-llm` | Provider-neutral LLM service interface for the DeepSeek Harness | `gbh-llm` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-llm-deepseek` | DeepSeek Messages adapter | — | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-llm-deepseek-account` | DeepSeek account provider authentication and discovery | `gbh-llm-deepseek-account` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-llm-deepseek-api-key` | DeepSeek api-key provider authentication and discovery | `gbh-llm-deepseek` | — | — | ✓✓✓ | ✓ |
| 5 | `dsh-llm-pi-ai` | pi-ai-backed DeepSeek adapter for the DeepSeek Harness LLM seam (design-verification twin  | `gbh-host-llm-pi-ai` | C | C | ✓✓✓ | ✓ |
| 6 | `dsh-llm-retry` | Provider-routed LLM request retry policy for the DeepSeek Harness | `gbh-llm-retry` | C | C | ✓✓✓ | ✓ |

### mcp (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-mcp-client` | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools | `gbh-mcp-client` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-mcp-resources` | Scoped MCP resource discovery and reading through shared model tools | `gbh-mcp-resources` | C | C | ✓✓✓ | ✓ |

### message (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-message-feedback` | Canonical Session-log ratings and notes for finalized assistant messages | `gbh-message-feedback` | C | C | ✓✓✓ | ✓ |

### native (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-native-command` | Host-native command and path-opening utilities with shell-free execution, cancellation, de | `gbh-native-command` | — | — | ✓✓✓ | ✓ |

### office (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-office-to-pdf` | Shared Office-to-PDF conversion with bounded queues and caching | `gbh-office-to-pdf` | C | C | ✓✓✓ | ✓ |

### otel (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-otel` | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels | `gbh-otel` | C | C | ✓✓✓ | ✓ |

### output (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-output-retention` | Zero-dependency bounded-retention primitive: ItemRetainer/TextRetainer + neutral notice he | `gbh-output-retention` | — | — | ✓✓✓ | ✓ |

### package (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-package-manifest` | Shared type declarations for package.json.dsh configuration fields | `gbh-package-manifest` | — | — | ✓✓✓ | ✓ |

### permission (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-permission-presets` | User-facing permission presets (ctx.permissionPresets) for the DeepSeek Harness: one produ | `gbh-permission` | C | C | ✓✓✓ | ✓ |

### persona (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-persona` | Composition-authored deployment persona section for the DeepSeek Harness | `gbh-persona` | — | — | ✓✓✓ | ✓ |

### plan (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-plan-mode` | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-re | `gbh-plan-mode` | — | C | ✓✓✓ | ✓ |

### plugin (4)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-plugin-manager` | Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools | `gbh-host-plugin-manager` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-plugin-market` | Configured plugin market indexes for the Web Discover page and the plugin_market agent too | `gbh-plugin-market` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-plugin-market-index` | Plugin market index format 1: JSON validation, relative icon resolution, and pinned instal | `gbh-plugin-market-index` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-plugin-package-inventory-deepseek` | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests | `gbh-plugin-package-inventory-deepseek` | C | C | ✓✓✓ | ✓ |

### ptc (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-ptc-runtime` | Abstract PTC execution seam (ctx.ptcRuntime) for the DeepSeek Harness | `gbh-ptc-runtime` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-ptc-runtime-node` | Node PTC execution with per-call sandboxed processes or in-memory REPL state | `gbh-ptc-runtime-node` | C | C | ✓✓✓ | ✓ |

### pwsh (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-pwsh-local` | Local PowerShell implementation of the DeepSeek Harness bash executor seam | `gbh-pwsh-local` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-pwsh-sandbox` | Sandbox-consuming implementation of the DeepSeek Harness PowerShell executor seam (confine | `gbh-pwsh-sandbox` | C | C | ✓✓✓ | ✓ |

### repeat (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-repeat-tool-reminder` | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool ca | `gbh-host-repeat-tool-reminder` | C | C | ✓✓✓ | ✓ |

### sandbox (4)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-sandbox` | Abstract process-sandbox seam (ctx.sandbox) for the DeepSeek Harness: same-world confineme | — | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-sandbox-local` | Local process-sandbox backends for the DeepSeek Harness sandbox seam: bwrap, the npm-distr | `gbh-sandbox` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-sandbox-policy` | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each | `gbh-sandbox-policy` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-sandbox-windows-acl` | Windows ACL write-restriction sandbox backend (restricted-token spawn with capability-SID  | `gbh-sandbox-windows-acl` | — | — | ✓✓✓ | ✓ |

### schedule (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-schedule` | Host-wide durable reminders with shared management and original-Session delivery | `gbh-schedule` | C | C | ✓✓✓ | ✓ |

### scope (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-scope` | Scoped-context registration primitive (scope tags, scope-filtered event dispatch) for the  | `gbh-scope` | — | — | ✓✓✓ | ✓ |

### sdk (4)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-sdk-app` | The dsh SDK profile bundle: stdio JSON-RPC serving and process lifecycle over dsh-base | `gbh-sdk-app` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-sdk-jsonrpc-server` | Stdio JSON-RPC server plugin for out-of-process DeepSeek Harness SDK clients | `gbh-sdk-jsonrpc-server` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-sdk-minimal` | The standalone minimal SDK profile bundle: JSON-RPC, one DeepSeek adapter, persistent shel | `gbh-sdk-minimal` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-sdk-protocol` | Shared wire protocol for the DeepSeek Harness SDK runtime: the newline-delimited JSON-RPC  | `gbh-sdk-protocol` | — | — | ✓✓✓ | ✓ |

### session (25)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-session` | Event-sourced session store for the DeepSeek Harness | `gbh-session` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-session-checkpoint-policy` | Semantic session durability checkpoints before model requests and tool side effects | `gbh-session-checkpoint-policy` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-session-format` | Streaming adjacent Session format migration machinery | `gbh-session-format` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-session-format-catalog` | Build-static first-party Session format codec and migration catalog | `gbh-session-format-catalog` | — | — | ✓✓✓ | ✓ |
| 5 | `dsh-session-format-v0-to-v1` | Frozen released-v0 Session codec and identity migration to v1 | `gbh-session-format-v0-to-v1` | — | — | ✓✓✓ | ✓ |
| 6 | `dsh-session-format-v1-to-v2` | Frozen released-v1 Session codec and assistant-stream migration to v2 | `gbh-session-format-v1-to-v2` | — | — | ✓✓✓ | ✓ |
| 7 | `dsh-session-format-v2-to-v3` | Streaming system-prompt, canonical-envelope and PTC migration into V3 | `gbh-session-format-v2-to-v3` | — | — | ✓✓✓ | ✓ |
| 8 | `dsh-session-format-v3-to-v4` | Streaming tool-role migration and delivery validation from Session V3 to V4 | `gbh-session-format-v3-to-v4` | — | — | ✓✓✓ | ✓ |
| 9 | `dsh-session-log-deepseek` | Incremental lossless session-log request extension for the official DeepSeek LLM API | `gbh-session-log-deepseek` | — | C | ✓✓✓ | ✓ |
| 10 | `dsh-session-log-export` | Web Session-log export command and shared download dialog | `gbh-session-log-export` | C | C | ✓✓✓ | ✓ |
| 11 | `dsh-session-persistence` | Abstract durable session persistence seam (ctx.sessionPersistence) for the DeepSeek Harnes | `gbh-session-persistence` | — | — | ✓✓✓ | ✓ |
| 12 | `dsh-session-persistence-jsonl` | JSONL durable session persistence backend for the DeepSeek Harness | `gbh-session-persistence-jsonl` | C | C | ✓✓✓ | ✓ |
| 13 | `dsh-session-projection` | Session-projection seam: the merge-extensible projection type table, the provider contract | `gbh-session-projection` | C | C | ✓✓✓ | ✓ |
| 14 | `dsh-session-projection-cache` | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint re | `gbh-session-projection-cache` | C | C | ✓✓✓ | ✓ |
| 15 | `dsh-session-query` | Combined session query service contract with concrete reads, traces, and filters | `gbh-session-query` | — | — | ✓✓✓ | ✓ |
| 16 | `dsh-session-query-sqlite` | Concrete ctx.sessionQuery backend with SQLite FTS5 search | `gbh-session-query-sqlite` | C | C | ✓✓✓ | ✓ |
| 17 | `dsh-session-reference` | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenc | `gbh-session-reference` | C | C | ✓✓✓ | ✓ |
| 18 | `dsh-session-stats` | Whole-log conversation counts and wall times projection (sessionStats) for the DeepSeek Ha | `gbh-session-stats` | C | C | ✓✓✓ | ✓ |
| 19 | `dsh-session-telemetry` | SessionTelemetryBackend seam for the DeepSeek Harness: session-event capture, projection,  | `gbh-session-telemetry` | — | — | ✓✓✓ | ✓ |
| 20 | `dsh-session-telemetry-otel` | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests | `gbh-session-telemetry-otel` | C | C | ✓✓✓ | ✓ |
| 21 | `dsh-session-title` | Log-backed session title service and provider registry for the DeepSeek Harness | `gbh-session-title` | C | C | ✓✓✓ | ✓ |
| 22 | `dsh-session-title-all-prompts-llm` | All-user-messages LLM provider plugin for DeepSeek Harness session titles | `gbh-optional-session-title-all-prompts` | C | C | ✓✓✓ | ✓ |
| 23 | `dsh-session-title-first-prompt-llm` | First-message LLM provider plugin for DeepSeek Harness session titles | `gbh-session-title-first-prompt-llm` | — | C | ✓✓✓ | ✓ |
| 24 | `dsh-session-title-llm` | Shared LLM generation policy for DeepSeek Harness session-title providers | `gbh-session-title-llm` | — | — | ✓✓✓ | ✓ |
| 25 | `dsh-session-turn-outline` | Whole-log turn outline projection (turnOutline) for the DeepSeek Harness | `gbh-session-turn-outline` | C | C | ✓✓✓ | ✓ |

### settings (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-settings` | Abstract user-settings seam (ctx.settings) for the DeepSeek Harness | `gbh-settings` | C | C | ✓✓✓ | ✓ |

### shell (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-shell` | Abstract bash executor seam (ctx.shell) for the DeepSeek Harness | `gbh-shell` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-shell-env` | Tool-independent managed DSH_* shell environment registry | `gbh-shell-env` | C | C | ✓✓✓ | ✓ |

### skill (4)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-skill` | Agent skill provider registry for the DeepSeek Harness | `gbh-skill` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-skill-badge` | Bundled dsh badge skill provider for DeepSeek Harness | `gbh-skill-badge` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-skill-filesystem` | Local filesystem skill provider for the DeepSeek Harness | `gbh-host-skill-filesystem` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-skill-office` | Bundled Word, PowerPoint, and Excel workflows and LibreOffice Kit operations | `gbh-skill-office` | — | — | ✓✓✓ | ✓ |

### spill (3)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-spill` | Abstract spill storage seam (ctx.spillStore) for the DeepSeek Harness — save oversized too | `gbh-spill` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-spill-local` | Local-filesystem implementation of the DeepSeek Harness spill storage seam (private sessio | `gbh-spill-local` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-spill-policy` | Token-budgeted tool-result retention with recoverable text and image paths | `gbh-spill-policy` | C | C | ✓✓✓ | ✓ |

### storage (3)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-storage` | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for th | `gbh-storage` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-storage-domain` | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over st | `gbh-storage-domain` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-storage-json` | JSON file KV storage backend for the DeepSeek Harness storage hub | `gbh-storage-json` | C | C | ✓✓✓ | ✓ |

### subagent (3)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-subagent` | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child ag | `gbh-subagent` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-subagent-fork-in-process` | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's  | `gbh-subagent-fork-in-process` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-subagent-spawn-in-process` | In-process spawn subagent backend: runs a fresh child agent on ctx.agents | `gbh-subagent-spawn-in-process` | C | C | ✓✓✓ | ✓ |

### subprocess (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-subprocess` | Subprocess seam (ctx.subprocess) for the DeepSeek Harness — managed process groups, bounde | `gbh-subprocess` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-subprocess-local` | Local-subprocess implementation of the DeepSeek Harness subprocess seam | `gbh-subprocess-local` | C | C | ✓✓✓ | ✓ |

### system (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-system-prompt` | System prompt assembly registry for the DeepSeek Harness | `gbh-system-prompt` | C | C | ✓✓✓ | ✓ |

### terminal (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-terminal` | Persistent PTY session seam for the DeepSeek Harness — owner-scoped ids, backend registry, | `gbh-terminal` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-terminal-bash` | Persistent shell PTY backend over the DeepSeek Harness subprocess terminal primitive | `gbh-terminal-bash` | — | — | ✓✓✓ | ✓ |

### time (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-time-context` | Durable per-step context with the current time and elapsed time | `gbh-time-context` | — | — | ✓✓✓ | ✓ |

### timeout (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-timeout` | Zero-dependency timeout/deadline primitive: clampTimeout, deadline, timeoutOf, TimeoutReas | `gbh-timeout` | — | — | ✓✓✓ | ✓ |

### tmux (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-tmux-context` | Opt-in durable per-step context with this agent's tmux pane and window location | `gbh-tmux-context` | — | — | ✓✓✓ | ✓ |

### token (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-token-meter` | Replay-aware token measurement service (ctx.tokenMeter) for the DeepSeek Harness | `gbh-token-meter` | C | C | ✓✓✓ | ✓ |

### tool (25)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-tool-ask-user` | Model-facing ask_user_question tool over the ctx.userQuestions seam | `gbh-host-tool-ask-user` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-tool-bash` | Model-facing bash tool with optional generic background-job and sandbox-escalation support | `gbh-tool-bash` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-tool-bash-persistent` | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service | `gbh-tool-bash-persistent` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-tool-call-timeout-policy` | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.si | `gbh-timeout-policy` | C | C | ✓✓✓ | ✓ |
| 5 | `dsh-tool-cordis` | Read-only runtime API inspection for Harness plugin development | `gbh-tool-cordis` | — | — | ✓✓✓ | ✓ |
| 6 | `dsh-tool-fs` | Model-facing filesystem tools (read, write, edit) over the DeepSeek Harness filesystem sea | `gbh-tool-fs` | — | — | ✓✓✓ | ✓ |
| 7 | `dsh-tool-fs-search` | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary | `gbh-tool-fs-search` | — | — | ✓✓✓ | ✓ |
| 8 | `dsh-tool-goal` | Model-facing same-session goal tools with execution-time authority checks | `gbh-tool-goal` | — | C | ✓✓✓ | ✓ |
| 9 | `dsh-tool-jobs` | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jo | `gbh-host-tool-jobs` | — | C | ✓✓✓ | ✓ |
| 10 | `dsh-tool-present` | Explicit workspace file delivery declarations for the DeepSeek Harness | `gbh-host-tool-present` | — | — | ✓✓✓ | ✓ |
| 11 | `dsh-tool-pwsh` | Model-facing pwsh tool over the bash executor seam | `gbh-tool-pwsh` | — | C | ✓✓✓ | ✓ |
| 12 | `dsh-tool-pwsh-persistent` | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service | `gbh-tool-pwsh-persistent` | — | — | ✓✓✓ | ✓ |
| 13 | `dsh-tool-ralph` | Model-facing fresh-agent Ralph loop over the workflow and subagent seams | `gbh-tool-ralph` | C | — | ✓✓✓ | ✓ |
| 14 | `dsh-tool-schedule` | Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, s | `gbh-tool-schedule` | — | — | ✓✓✓ | ✓ |
| 15 | `dsh-tool-session-query` | Workspace-authorized model-facing session history search, trace, and event read tools | `gbh-tool-session-query` | C | — | ✓✓✓ | ✓ |
| 16 | `dsh-tool-skill` | Model-facing skill loading tool for the DeepSeek Harness | `gbh-host-tool-skill` | — | C | ✓✓✓ | ✓ |
| 17 | `dsh-tool-str-replace-editor` | Model-facing view, create, literal replace, and line insert tool over the Harness filesyst | `gbh-tool-str-replace-editor` | — | — | ✓✓✓ | ✓ |
| 18 | `dsh-tool-subagent` | Model-facing subagent delegation tool over the ctx.subagents seam | `gbh-host-tool-subagent` | — | C | ✓✓✓ | ✓ |
| 19 | `dsh-tool-subagent-control` | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents con | `gbh-tool-subagent-control` | — | C | ✓✓✓ | ✓ |
| 20 | `dsh-tool-terminal` | Six model-facing persistent PTY tools with owner isolation and generic background-job inte | `gbh-tool-terminal` | C | — | ✓✓✓ | ✓ |
| 21 | `dsh-tool-todo` | Model-facing todo_write tool over the DeepSeek Harness event-sourced session log | `gbh-host-tool-todo` | — | C | ✓✓✓ | ✓ |
| 22 | `dsh-tool-web` | Model-facing web tools (web_search, web_fetch) over the DeepSeek Harness web capability se | `gbh-host-tool-web` | — | C | ✓✓✓ | ✓ |
| 23 | `dsh-tool-workflow` | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine | `gbh-tool-workflow` | — | C | ✓✓✓ | ✓ |
| 24 | `dsh-tool-working-directory` | Read and change the active Session working directory | `gbh-tool-working-directory` | C | C | ✓✓✓ | ✓ |
| 25 | `dsh-tool-workspace-dependencies` | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and p | `gbh-tool-workspace-dependencies` | — | — | ✓✓✓ | ✓ |

### tools (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-tools` | Tool registry and execution pipeline for the DeepSeek Harness | `gbh-host-tools` | C | C | ✓✓✓ | ✓ |

### typert (3)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-typert-loader` | Loader integration for generated Typert package contributions | `gbh-typert-loader` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-typert-protocol` | Compiler-independent Remote metadata and Typert provider protocols | `gbh-typert-protocol` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-typert-registry` | Runtime registry for generated package reflection and Zod schemas | `gbh-typert-registry` | C | C | ✓✓✓ | ✓ |

### user (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-user-approval` | User-approval seam (ctx.approval) for the DeepSeek Harness: one-shot permission decisions  | `gbh-approval` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-user-questions` | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs | `gbh-user-questions` | C | C | ✓✓✓ | ✓ |

### util (5)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-util-code-language` | Single file-extension to syntax-highlighting language table shared by Client code surfaces | `gbh-util-code-language` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-util-crypto` | Zero-dependency browser-safe UUID and byte-encoding helpers | `gbh-util-crypto` | — | — | ✓✓✓ | ✓ |
| 3 | `dsh-util-time` | Zero-dependency time vocabulary shared by wire boundaries: canonicalClientTimeZone (IANA z | `gbh-util-time` | — | — | ✓✓✓ | ✓ |
| 4 | `dsh-util-values` | Duplicate-install-safe value primitives for the DeepSeek Harness | `gbh-util-values` | — | — | ✓✓✓ | ✓ |
| 5 | `dsh-util-workspace-path` | Browser-safe Workspace path and display helpers | `gbh-util-workspace-path` | — | — | ✓✓✓ | ✓ |

### web (5)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-web` | Abstract web access capability seam (ctx.web) for the DeepSeek Harness — search/fetch prov | `gbh-web` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-web-app` | The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue pl | `gbh-web-startup` | C | C | ✓✓✓ | ✓ |
| 3 | `dsh-web-fetch-http` | Anonymous public HTTP(S) fetch provider for the DeepSeek Harness web capability seam (ctx. | `gbh-web-fetch-http` | C | C | ✓✓✓ | ✓ |
| 4 | `dsh-web-frontend` | Web application entry: vite build over the @deepseek-ai/dsh-client-web shell library; dist | — | — | — | ✓✓✓ | ✓ |
| 5 | `dsh-web-search-deepseek` | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for t | `gbh-web-search-deepseek` | — | — | ✓✓✓ | ✓ |

### win32 (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-win32-process` | Shared low-level Win32 process, stdio, and Job Object primitives | `gbh-win32-process` | — | — | ✓✓✓ | ✓ |

### workflow (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-workflow` | Workflow capability seam: ctx.workflowEngine service, run vocabulary, and workflow/* event | `gbh-workflow` | — | — | ✓✓✓ | ✓ |
| 2 | `dsh-workflow-ptc` | Workflow orchestration in the shared sandboxed Node PTC runtime | `gbh-workflow-ptc` | — | — | ✓✓✓ | ✓ |

### working (1)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-working-directory` | Session working directories with durable changes and model context | `gbh-working-directory` | C | C | ✓✓✓ | ✓ |

### workspace (2)

| # | package DSH | mô tả | GBH thay thế | mount | test | ký | trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | `dsh-workspace` | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validate | `gbh-workspace` | C | C | ✓✓✓ | ✓ |
| 2 | `dsh-workspace-changes` | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file ca | `gbh-host-workspace-changes` | C | C | ✓✓✓ | ✓ |

## 4. Việc kế tiếp đề xuất (entry GỐC còn đang chạy)

Xếp theo số dòng bundle host gốc tăng dần — làm gói nhỏ trước để lấy đà và giữ rủi ro thấp.

| # | package gốc còn chạy | nhóm | dòng host | đã có GBH nháp |
|---|---|---|---|---|

## 5. Việc phải làm để đạt mục tiêu "không còn DSH"

1. Mọi dòng **X** phải có package GBH (ánh xạ 1:1, đối chiếu source DSH) + test + mount.
2. Mọi dòng **-** phải qua reviewer: chạy lại test, đối chiếu source, chạy lab/e2e, rồi ký.
3. Chỉ khi đủ 3 chữ ký trong `docs/contracts/data/conversion-signoff.json` thì dòng đó mới thành **✓**.
4. Icon/asset cũng phải chuyển: không còn tham chiếu SVG/bundle DSH trong UI của ta.
