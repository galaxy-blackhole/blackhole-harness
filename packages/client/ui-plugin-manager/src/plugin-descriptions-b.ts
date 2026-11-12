/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Nửa B của bảng mô tả plugin (tách để giữ luật <= 1000 dòng/gói)
 */

import type { PluginDescription } from "./plugin-descriptions.ts";

export const PLUGIN_DESCRIPTIONS_B: Record<string, PluginDescription> = {
  "@galaxy-blackhole/gbh-tmux-context": {
    en: "Opt-in durable per-step context with this agent's tmux pane and window location",
    zh: "",
    vi: "Ngữ cảnh bền vững tuỳ chọn cho từng bước, kèm vị trí pane và cửa sổ tmux của agent.",
  },
  "@galaxy-blackhole/gbh-tool-bash": {
    en: "Model-facing bash tool with optional generic background-job and sandbox-escalation support",
    zh: "让 AI 执行 Bash 命令，并按配置管理后台运行和权限申请。",
    vi: "Công cụ bash cho mô hình, có hỗ trợ job nền và nâng quyền hộp cát khi cần.",
  },
  "@galaxy-blackhole/gbh-tool-bash-persistent": {
    en: "Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service",
    zh: "让 AI 在保留状态的 Bash 会话中连续执行命令。",
    vi: "Công cụ Bash bền vững theo chủ sở hữu, dựng trên dịch vụ PTY của bộ khung.",
  },
  "@galaxy-blackhole/gbh-tool-cordis": {
    en: "Read-only runtime API inspection for Harness plugin development",
    zh: "让 AI 在开发插件前查询服务端和浏览器端的可用 API。",
    vi: "Xem API runtime chỉ đọc để phát triển plugin của bộ khung.",
  },
  "@galaxy-blackhole/gbh-tool-fs": {
    en: "Model-facing filesystem tools (read, write, edit) over the Galaxy Blackhole filesystem seam (ctx.fs)",
    zh: "让 AI 读取、创建和编辑工作文件。",
    vi: "Bộ công cụ hệ thống tệp cho mô hình (đọc, ghi, sửa) trên điểm nối hệ thống tệp.",
  },
  "@galaxy-blackhole/gbh-tool-fs-search": {
    en: "Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep)",
    zh: "让 AI 按文件名或文本内容搜索本地文件。",
    vi: "Công cụ tìm kiếm hệ thống tệp cho mô hình (glob, grep) dùng binary ripgrep đóng gói sẵn.",
  },
  "@galaxy-blackhole/gbh-tool-pwsh-persistent": {
    en: "Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service",
    zh: "让 AI 在保留状态的 PowerShell 会话中连续执行命令。",
    vi: "Công cụ PowerShell bền vững theo chủ sở hữu, dựng trên dịch vụ PTY của bộ khung.",
  },
  "@galaxy-blackhole/gbh-tool-ralph": {
    en: "Model-facing fresh-agent Ralph loop over the workflow and subagent seams",
    zh: "围绕同一目标逐轮运行新的子智能体，并传递上一轮的简要报告。",
    vi: "Vòng lặp Ralph dùng agent mới, chạy trên các điểm nối workflow và subagent.",
  },
  "@galaxy-blackhole/gbh-tool-schedule": {
    en: "Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, schedule_delete) over the Host ctx.schedule service",
    zh: "",
    vi: "Bộ công cụ quản lý nhắc hẹn cho mô hình: tạo, liệt kê, cập nhật và xoá lịch.",
  },
  "@galaxy-blackhole/gbh-tool-session-query": {
    en: "Workspace-authorized model-facing session history search, trace, and event read tools",
    zh: "",
    vi: "Bộ công cụ tìm kiếm, truy vết và đọc sự kiện lịch sử phiên đã được uỷ quyền theo workspace.",
  },
  "@galaxy-blackhole/gbh-tool-str-replace-editor": {
    en: "Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service",
    zh: "",
    vi: "Công cụ xem, tạo, thay thế nguyên văn và chèn dòng trên hệ thống tệp của bộ khung.",
  },
  "@galaxy-blackhole/gbh-tool-terminal": {
    en: "Six model-facing persistent PTY tools with owner isolation and generic background-job integration",
    zh: "",
    vi: "Sáu công cụ PTY bền vững cho mô hình, cách ly theo chủ sở hữu và tích hợp job nền.",
  },
  "@galaxy-blackhole/gbh-tool-working-directory": {
    en: "Read and change the active Session working directory",
    zh: "",
    vi: "Đọc và đổi thư mục làm việc hiện hành của phiên.",
  },
  "@galaxy-blackhole/gbh-tool-workspace-dependencies": {
    en: "The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload",
    zh: "",
    vi: "Công cụ load_workspace_dependencies: trả đường dẫn tuyệt đối vào Python, Node.js và gói phụ thuộc đóng sẵn.",
  },
  "@galaxy-blackhole/gbh-tool-worktree": {
    en: "Let the agent create a new Git branch and worktree, then continue there.",
    zh: "让智能体创建新的 Git 分支与工作树，并在其中继续工作。",
    vi: "Cho agent tạo nhánh Git và worktree mới rồi tiếp tục làm việc ở đó.",
  },
  "@galaxy-blackhole/gbh-session-format-v2-to-v3": {
    en: "Streaming system-prompt, canonical-envelope and PTC migration into V3",
    zh: "",
    vi: "Di trú định dạng phiên v2 → v3: system-prompt dạng luồng, phong bì chuẩn hoá và chuyển PTC sang V3.",
  },
  "@galaxy-blackhole/gbh-session-format-v3-to-v4": {
    en: "Streaming tool-role migration and delivery validation from Session V3 to V4",
    zh: "",
    vi: "Di trú v3 → v4: vai trò công cụ dạng luồng và kiểm định bàn giao của phiên.",
  },
  "@galaxy-blackhole/gbh-session-inspector": {
    en: "Enable analysis of the current session's raw data and grouped chat messages in the session sidebar.",
    zh: "在会话侧边栏启用当前会话的原始数据和聊天分组数据分析功能",
    vi: "Cho phép phân tích dữ liệu thô của phiên hiện tại và tin nhắn đã nhóm ngay trong ứng dụng.",
  },
  "@galaxy-blackhole/gbh-session-persistence": {
    en: "Abstract durable session persistence seam (ctx.sessionPersistence) for the Galaxy Blackhole",
    zh: "",
    vi: "Điểm nối lưu trữ phiên bền vững trừu tượng (ctx.sessionPersistence) của hệ.",
  },
  "@galaxy-blackhole/gbh-session-query": {
    en: "Combined session query service contract with concrete reads, traces, and filters",
    zh: "",
    vi: "Hợp đồng dịch vụ truy vấn phiên kết hợp đọc cụ thể, dấu vết và bộ lọc.",
  },
  "@galaxy-blackhole/gbh-session-telemetry": {
    en: "SessionTelemetryBackend seam for the Galaxy Blackhole: session-event capture, projection, redaction, and handoff to a reporting backend",
    zh: "",
    vi: "Điểm nối backend telemetry phiên: thu sự kiện phiên và xử lý dữ liệu liên quan.",
  },
  "@galaxy-blackhole/gbh-session-title-llm": {
    en: "Shared LLM generation policy for Galaxy Blackhole session-title providers",
    zh: "",
    vi: "Chính sách sinh tiêu đề phiên bằng mô hình, dùng chung cho các nhà cung cấp tiêu đề.",
  },
  "@galaxy-blackhole/gbh-shell": {
    en: "Abstract bash executor seam (ctx.shell) for the Galaxy Blackhole",
    zh: "",
    vi: "Điểm nối thực thi bash trừu tượng (ctx.shell) của hệ.",
  },
  "@galaxy-blackhole/gbh-skill-office": {
    en: "Bundled Word, PowerPoint, and Excel workflows and LibreOffice Kit operations",
    zh: "",
    vi: "Bộ quy trình Word, PowerPoint, Excel đóng gói sẵn và các thao tác với LibreOffice Kit.",
  },
  "@galaxy-blackhole/gbh-spill": {
    en: "Abstract spill storage seam (ctx.spillStore) for the Galaxy Blackhole — save oversized tool text and return a retrieval locator",
    zh: "",
    vi: "Điểm nối lưu trữ tràn (ctx.spillStore): cất phần dữ liệu vượt hạn mức để đọc lại sau.",
  },
  "@galaxy-blackhole/gbh-subprocess": {
    en: "Subprocess seam (ctx.subprocess) for the Galaxy Blackhole — managed process groups, bounded spill-backed output, and escalated kills behind one abstract service",
    zh: "",
    vi: "Điểm nối tiến trình con (ctx.subprocess): quản lý nhóm tiến trình và vòng đời của chúng.",
  },
  "@galaxy-blackhole/gbh-terminal-bash": {
    en: "Persistent shell PTY backend over the Galaxy Blackhole subprocess terminal primitive",
    zh: "提供可跨多次调用保留状态的 Shell 终端。",
    vi: "Backend PTY shell bền vững, dựng trên nguyên thuỷ terminal của bộ tiến trình con.",
  },
  "@galaxy-blackhole/gbh-terminal": {
    en: "Persistent PTY session seam for the Galaxy Blackhole — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup",
    zh: "管理可持续交互的终端会话及其输入、输出和清理。",
    vi: "Điểm nối phiên PTY bền vững: định danh theo chủ sở hữu và backend tương ứng.",
  },
  "@galaxy-blackhole/gbh-time-context": {
    en: "Tells the model the current time, the browser's time zone, and the time since the previous message at each step.",
    zh: "每一步把当前时间、浏览器时区和距上一条消息的时长告诉模型。",
    vi: "Cho mô hình biết thời gian hiện tại, múi giờ của trình duyệt và khoảng thời gian đã trôi qua.",
  },
  "@galaxy-blackhole/gbh-timeout": {
    en: "Zero-dependency timeout/deadline primitive: clampTimeout, deadline, timeoutOf, TimeoutReason (timing + classification only, no termination)",
    zh: "",
    vi: "Nguyên thuỷ thời hạn không phụ thuộc thư viện: kẹp thời gian chờ, hạn chót và tiện ích liên quan.",
  },
  "@galaxy-blackhole/gbh-experimental-api-speech-to-text": {
    en: "Authenticated experimental speech transcription for browser clients",
    zh: "为浏览器提供录音转写接口。",
    vi: "Chuyển giọng nói thành văn bản thử nghiệm, có xác thực, cho client trình duyệt.",
  },
  "@galaxy-blackhole/gbh-experimental-client-ui-voice-input": {
    en: "Record speech and insert editable text into the conversation draft",
    zh: "录制语音，将识别结果填入会话草稿，支持编辑后发送。",
    vi: "Record speech and insert editable text into the conversation draft.",
  },
  "@galaxy-blackhole/gbh-experimental-inspector": {
    en: "Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection",
    zh: "按 Ctrl/Cmd+Shift+. 在底部面板打开 Chrome DevTools 进行开发调试",
    vi: "Press Ctrl/Cmd+Shift+. to open Chrome DevTools in the bottom panel for development and debugging.",
  },
  "@galaxy-blackhole/gbh-experimental-speech-to-text": {
    en: "Experimental speech recognition with independently selectable providers",
    zh: "管理语音转写服务，并选择识别服务。",
    vi: "Quản lý dịch vụ chuyển giọng nói thành văn bản và chọn dịch vụ nhận dạng.",
  },
  "@galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice": {
    en: "Local SenseVoice ONNX transcription with a managed sherpa-onnx process",
    zh: "使用本机 SenseVoice 将录音转写为文字。",
    vi: "Transcribe recordings into text locally with SenseVoice.",
  },
  "@galaxy-blackhole/gbh-experimental-tool-agent-team": {
    en: "Scoped model-facing Agent Teams tools over ctx.agentTeams",
    zh: "为智能体提供成员协调、消息通信和共享任务管理工具。",
    vi: "Give agents tools to coordinate members, exchange messages, and manage shared tasks.",
  },
  "@galaxy-blackhole/gbh-file-reference-local": {
    en: "Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes",
    zh: "提供本地文件的搜索和引用能力。",
    vi: "Cung cấp khả năng tìm kiếm và tham chiếu tệp cục bộ.",
  },
  "@galaxy-blackhole/gbh-fs-observation-policy": {
    en: "File-context policy plugin for the Galaxy Blackhole — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API)",
    zh: "要求 AI 编辑前先读取文件，并在文件发生变化时重新确认内容。",
    vi: "Bắt buộc đọc tệp trước khi sửa và xác nhận lại khi tệp đã thay đổi.",
  },
  "@galaxy-blackhole/gbh-fs-sandbox": {
    en: "Sandbox-enforcing implementation of the Galaxy Blackhole filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through",
    zh: "按当前权限模式限制文件写入和编辑范围。",
    vi: "Giới hạn phạm vi ghi và sửa tệp theo chế độ quyền hiện hành.",
  },
  "@galaxy-blackhole/gbh-goal": {
    en: "Event-sourced same-session goal state and lifecycle service for the Galaxy Blackhole",
    zh: "记录会话目标，并管理目标的状态和生命周期。",
    vi: "Ghi lại mục tiêu của phiên và quản lý trạng thái, vòng đời của mục tiêu.",
  },
  "@galaxy-blackhole/gbh-goal-round-driver": {
    en: "Race-fenced same-session goal-round driver",
    zh: "在条件和额度允许时，让 AI 继续推进当前会话的目标。",
    vi: "Cho phép AI tiếp tục đẩy mục tiêu của phiên khi điều kiện và hạn mức cho phép.",
  },
  "@galaxy-blackhole/gbh-hmr": {
    en: "Coordinated module and profile configuration hot reload",
    zh: "在应用运行期间重新加载插件代码和配置。",
    vi: "Nạp lại mã và cấu hình của plugin ngay khi ứng dụng đang chạy.",
  },
  "@galaxy-blackhole/gbh-host-agent-loop": {
    en: "The agent loop: inbox, runtime-context projection, assistant streaming and tool-call execution, plus the AgentLoop launcher.",
    zh: "智能体主循环：收件箱、运行时上下文投影、流式输出与工具调用执行，以及 AgentLoop 启动器。",
    vi: "Vòng lặp agent: hộp thư, chiếu runtime-context, stream câu trả lời, thi hành lời gọi tool và launcher AgentLoop.",
  },
  "@galaxy-blackhole/gbh-host-cordis-host-runner": {
    en: "Transport runner for the cordis host: define, run and cancel dynamic plugins, with sandbox, guards and registry inspection.",
    zh: "cordis 宿主的传输运行器：定义、运行与取消动态插件，含沙箱、守卫与注册表检查。",
    vi: "Runner transport của cordis host: định nghĩa/chạy/huỷ plugin động, kèm sandbox, guard và kiểm tra registry.",
  },
  "@galaxy-blackhole/gbh-host-directory-picker-auto": {
    en: "Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the Galaxy Blackhole web GUI host",
    zh: "根据运行环境选择系统目录对话框或应用内目录浏览。",
    vi: "Tự chọn hộp thoại thư mục của hệ điều hành hoặc trình duyệt thư mục trong ứng dụng theo môi trường chạy.",
  },
  "@galaxy-blackhole/gbh-host-experimental-translator": {
    en: "Machine translation service: providers, request shape and the translate RPC used by the client.",
    zh: "机器翻译服务：提供方、请求结构与客户端调用的 translate RPC。",
    vi: "Dịch máy: nhà cung cấp, hình dạng yêu cầu và RPC translate mà client gọi.",
  },
  "@galaxy-blackhole/gbh-host-llm-pi-ai": {
    en: "LLM provider backed by pi-ai: adapters, catalog, replay, auth, discovery and login, registered on the llm service.",
    zh: "基于 pi-ai 的语言模型提供方：适配器、目录、重放、鉴权、发现与登录，注册到 llm 服务。",
    vi: "Provider LLM qua pi-ai: adapter, catalog, replay, auth, discovery và login, đăng ký vào service llm.",
  },
  "@galaxy-blackhole/gbh-host-open-in-app": {
    en: "Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes",
    zh: "查找可用的本地应用，并用所选应用打开文件或工作区。",
    vi: "Tìm ứng dụng cục bộ phù hợp và mở tệp hoặc workspace bằng ứng dụng đã chọn.",
  },
  "@galaxy-blackhole/gbh-host-plugin-inventory": {
    en: "Read-only Remote projection of current Cordis Loader plugin state",
    zh: "提供当前插件条目、配置启用状态和运行状态的只读清单。",
    vi: "Cung cấp danh mục chỉ đọc về plugin hiện có, trạng thái bật/tắt và trạng thái chạy.",
  },
  "@galaxy-blackhole/gbh-host-plugin-manager": {
    en: "Plugin install/remove infrastructure used by the Market: install specs, registry, patch application and build approval.",
    zh: "插件市场的安装/卸载基础设施：安装规格、注册表、补丁应用与构建审批。",
    vi: "Hạ tầng cài/gỡ plugin cho Market: spec cài đặt, registry, áp bản vá và duyệt bản build.",
  },
  "@galaxy-blackhole/gbh-host-repeat-tool-reminder": {
    en: "Detects repeated identical tool calls in a row and adds an advisory reminder to the context.",
    zh: "检测连续重复的相同工具调用，并在上下文中加入提醒。",
    vi: "Phát hiện lời gọi tool lặp y hệt liên tiếp và chèn nhắc nhở vào ngữ cảnh.",
  },
  "@galaxy-blackhole/gbh-host-tool-ask-user": {
    en: "The ask-user tool: lets the agent ask the user a question mid-turn, registered through the tools service.",
    zh: "ask-user 工具：让智能体在轮次中向用户提问，通过 tools 服务注册。",
    vi: "Tool ask-user: cho agent hỏi người dùng ngay giữa lượt, đăng ký qua service tools.",
  },
  "@galaxy-blackhole/gbh-host-tool-present": {
    en: "The present tool: lets the agent hand the user a file as a deliverable, registered through the tools service.",
    zh: "present 工具：让智能体把文件作为交付物交给用户，通过 tools 服务注册。",
    vi: "Tool present: cho agent trao tệp cho người dùng như sản phẩm bàn giao, đăng ký qua service tools.",
  },
  "@galaxy-blackhole/gbh-host-tool-todo": {
    en: "Agent tool for a structured todo list, registered through the tools service.",
    zh: "通过 tools 服务注册的结构化待办工具。",
    vi: "Tool của agent cho danh sách việc cần làm, đăng ký qua service tools.",
  },
  "@galaxy-blackhole/gbh-host-tool-web": {
    en: "The web tool: search and page fetching for the agent, registered through the tools service.",
    zh: "web 工具：为智能体提供搜索与网页抓取，通过 tools 服务注册。",
    vi: "Tool web: tìm kiếm và đọc trang cho agent, đăng ký qua service tools.",
  },
  "@galaxy-blackhole/gbh-host-webserver": {
    en: "Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts",
    zh: "注册网页和接口路由，提供 HTTP 服务。",
    vi: "Đăng ký route cho trang và API, cung cấp dịch vụ HTTP.",
  },
  "@galaxy-blackhole/gbh-host-workspace-changes": {
    en: "Records per-turn workspace file changes (git snapshot plus full-file capture) and diffs each file for the workspace UI.",
    zh: "按轮次记录工作区文件改动（git 快照加全文件捕获），并逐个文件比较供工作区界面使用。",
    vi: "Ghi nhận thay đổi tệp trong workspace theo từng lượt (snapshot git và bắt toàn bộ tệp), so sánh từng tệp cho giao diện workspace.",
  },
  "@galaxy-blackhole/gbh-image-offload": {
    en: "Keeps images out of the context window during compaction by recording an image/offload decision for each one.",
    zh: "压缩上下文时把图片移出窗口，为每张图片记录 image/offload 决定。",
    vi: "Đưa ảnh ra khỏi ngữ cảnh khi nén, ghi một quyết định image/offload cho từng ảnh.",
  },
  "@galaxy-blackhole/gbh-jobs-local": {
    en: "Process-local implementation of the Galaxy Blackhole background job registry seam",
    zh: "管理当前进程中的后台任务及其运行状态。",
    vi: "Quản lý tác vụ chạy nền trong tiến trình hiện tại và trạng thái của chúng.",
  },
  "@galaxy-blackhole/gbh-llm": {
    en: "Provider-neutral LLM service interface for the Galaxy Blackhole",
    zh: "为不同模型提供统一的调用接口。",
    vi: "Cung cấp một giao diện gọi model thống nhất cho nhiều nhà cung cấp.",
  },
  "@galaxy-blackhole/gbh-llm-deepseek-account": {
    en: "DeepSeek account provider authentication and discovery",
    zh: "使用已登录的 DeepSeek 账号连接模型服务。",
    vi: "Kết nối dịch vụ model bằng tài khoản DeepSeek đã đăng nhập.",
  },
  "@galaxy-blackhole/gbh-llm-deepseek-adapter": {
    en: "Library adapter that speaks the DeepSeek chat-completion API for the llm service.",
    zh: "为 llm 服务提供 DeepSeek 对话补全接口的库适配器。",
    vi: "Adapter thư viện nói API chat-completion của DeepSeek cho service llm.",
  },
  "@galaxy-blackhole/gbh-llm-deepseek-api-key": {
    en: "DeepSeek api-key provider authentication and discovery",
    zh: "使用 API 密钥连接 DeepSeek 模型服务。",
    vi: "Kết nối dịch vụ model DeepSeek bằng API key.",
  },
  "@galaxy-blackhole/gbh-llm-retry": {
    en: "Provider-routed LLM request retry policy for the Galaxy Blackhole",
    zh: "按模型提供方的策略重试失败的请求。",
    vi: "Thử lại yêu cầu thất bại theo chính sách của nhà cung cấp model.",
  },
  "@galaxy-blackhole/gbh-mcp-resources": {
    en: "Scoped MCP resource discovery and reading through shared model tools",
    zh: "让 AI 发现并读取已接入 MCP 服务提供的资源。",
    vi: "Cho AI khám phá và đọc tài nguyên do các dịch vụ MCP đã kết nối cung cấp.",
  },
  "@galaxy-blackhole/gbh-message-feedback": {
    en: "Canonical Session-log ratings and notes for finalized assistant messages",
    zh: "记录用户对助手回复的赞、踩和补充意见。",
    vi: "Ghi nhận phản hồi của người dùng (thích, không thích, góp ý) cho câu trả lời của trợ lý.",
  },
  "@galaxy-blackhole/gbh-office-to-pdf": {
    en: "Shared Office-to-PDF conversion with bounded queues and caching",
    zh: "将 Word、Excel 和 PowerPoint 等文档转换为 PDF，供预览使用。",
    vi: "Chuyển tài liệu Word, Excel và PowerPoint sang PDF để xem trước.",
  },
  "@galaxy-blackhole/gbh-optional-session-title-all-prompts": {
    en: "Generates a session title from all of the user prompts in the conversation.",
    zh: "根据对话中全部用户提示生成会话标题。",
    vi: "Sinh tiêu đề phiên từ toàn bộ prompt của người dùng trong cuộc trò chuyện.",
  },
  "@galaxy-blackhole/gbh-otel": {
    en: "Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels",
    zh: "为产品事件和会话日志提供独立的数据上报通道。",
    vi: "Cung cấp kênh gửi dữ liệu riêng cho sự kiện sản phẩm và nhật ký phiên.",
  },
  "@galaxy-blackhole/gbh-permission": {
    en: "Permission decisions for tool use, including the policy that answers approval requests.",
    zh: "工具使用的权限判定，以及应答审批请求的策略。",
    vi: "Quyết định cấp quyền cho việc dùng tool, gồm chính sách trả lời yêu cầu phê duyệt.",
  },
  "@galaxy-blackhole/gbh-plan-mode": {
    en: "Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit",
    zh: "让 AI 先制定计划，并在用户审阅后切换到执行。",
    vi: "Cho AI lập kế hoạch trước và chuyển sang thực thi sau khi người dùng duyệt.",
  },
  "@galaxy-blackhole/gbh-plugin-package-inventory-deepseek": {
    en: "Active Loader-backed plugin package inventory for official DeepSeek LLM API requests",
    zh: "随官方模型 API 请求发送当前活跃插件包的清单。",
    vi: "Gửi danh mục gói plugin đang hoạt động kèm yêu cầu tới API model chính thức.",
  },
  "@galaxy-blackhole/gbh-ptc-runtime-node": {
    en: "Node PTC execution with per-call sandboxed processes or in-memory REPL state",
    zh: "在沙箱中的 Node 进程里执行用于调用工具的代码。",
    vi: "Chạy mã dùng để gọi công cụ trong tiến trình Node nằm trong sandbox.",
  },
  "@galaxy-blackhole/gbh-pwsh-sandbox": {
    en: "Sandbox-consuming implementation of the Galaxy Blackhole PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts)",
    zh: "在当前沙箱权限范围内执行 PowerShell 命令。",
    vi: "Chạy lệnh PowerShell trong phạm vi quyền của sandbox hiện hành.",
  },
  "@galaxy-blackhole/gbh-sandbox-policy": {
    en: "Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family",
    zh: "根据当前会话的权限模式和工作区，确定每次操作的限制。",
    vi: "Xác định giới hạn cho từng thao tác dựa trên chế độ quyền của phiên và workspace.",
  },
  "@galaxy-blackhole/gbh-sandbox-seam": {
    en: "Abstraction seam for sandbox providers: provider contract, unavailability error and escalation vocabulary.",
    zh: "沙箱提供方的抽象接缝：提供方契约、不可用错误与升级用语。",
    vi: "Seam trừu tượng cho nhà cung cấp sandbox: hợp đồng provider, lỗi không khả dụng và từ vựng escalation.",
  },
  "@galaxy-blackhole/gbh-schedule": {
    en: "Host-wide durable reminders with shared management and original-Session delivery",
    zh: "保存自动化任务，到点后在原会话中执行，并为智能体提供管理任务的工具。",
    vi: "Stores automation tasks, runs each in its original session when it is due, and gives the agent tools to manage them.",
  },
  "@galaxy-blackhole/gbh-session": {
    en: "Event-sourced session store for the Galaxy Blackhole",
    zh: "记录会话中的消息、工具调用和运行事件。",
    vi: "Ghi lại tin nhắn, lời gọi công cụ và sự kiện chạy trong phiên.",
  },
  "@galaxy-blackhole/gbh-session-checkpoint-policy": {
    en: "Semantic session durability checkpoints before model requests and tool side effects",
    zh: "在模型请求和可能产生外部影响的工具操作前保存会话记录。",
    vi: "Lưu ảnh chụp phiên trước mỗi yêu cầu model và trước thao tác công cụ có thể gây ảnh hưởng bên ngoài.",
  },
  "@galaxy-blackhole/gbh-session-log": {
    en: "Incremental lossless session-log request extension for the official DeepSeek LLM API",
    zh: "启用后，随官方模型 API 请求向 DeepSeek 上传会话日志。",
    vi: "Khi được bật, tải nhật ký phiên lên DeepSeek kèm yêu cầu tới API model chính thức.",
  },
  "@galaxy-blackhole/gbh-session-log-export": {
    en: "Web Session-log export command and shared download dialog",
    zh: "提供会话日志导出命令和下载功能。",
    vi: "Cung cấp lệnh xuất nhật ký phiên và chức năng tải về.",
  },
  "@galaxy-blackhole/gbh-session-persistence-jsonl": {
    en: "JSONL durable session persistence backend for the Galaxy Blackhole",
    zh: "将会话日志保存为本地 JSONL 文件，供后续恢复和读取。",
    vi: "Lưu nhật ký phiên thành tệp JSONL cục bộ để khôi phục và đọc lại.",
  },
  "@galaxy-blackhole/gbh-session-projection": {
    en: "Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state",
    zh: "从会话日志生成标题、状态等信息，供其他功能读取。",
    vi: "Sinh tiêu đề, trạng thái và thông tin khác từ nhật ký phiên cho các tính năng khác đọc.",
  },
  "@galaxy-blackhole/gbh-session-projection-cache": {
    en: "Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read",
    zh: "缓存从会话日志生成的状态，供会话列表等功能快速读取。",
    vi: "Lưu đệm trạng thái sinh từ nhật ký phiên để danh sách phiên đọc nhanh.",
  },
  "@galaxy-blackhole/gbh-session-query-sqlite": {
    en: "Concrete ctx.sessionQuery backend with SQLite FTS5 search",
    zh: "查询会话记录，并在配置启用时提供 SQLite 全文搜索。",
    vi: "Truy vấn nhật ký phiên và cung cấp tìm kiếm toàn văn bằng SQLite khi được bật.",
  },
  "@galaxy-blackhole/gbh-session-reference": {
    en: "Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver)",
    zh: "为 AI 提供其他会话的只读内容快照。",
    vi: "Cung cấp cho AI ảnh chụp chỉ đọc nội dung của các phiên khác.",
  },
  "@galaxy-blackhole/gbh-session-stats": {
    en: "Whole-log conversation counts and wall times projection (sessionStats) for the Galaxy Blackhole",
    zh: "汇总会话的交互次数和耗时等统计信息。",
    vi: "Tổng hợp số lượt tương tác và thời gian xử lý của phiên.",
  },
  "@galaxy-blackhole/gbh-session-telemetry-otel": {
    en: "Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests",
    zh: "按反馈授权策略，通过 OpenTelemetry 上传相关会话日志。",
    vi: "Tải nhật ký phiên liên quan qua OpenTelemetry theo chính sách đồng ý phản hồi.",
  },
  "@galaxy-blackhole/gbh-session-title": {
    en: "Log-backed session title service and provider registry for the Galaxy Blackhole",
    zh: "保存和读取会话标题，并管理标题生成方式。",
    vi: "Lưu và đọc tiêu đề phiên, đồng thời quản lý cách sinh tiêu đề.",
  },
  "@galaxy-blackhole/gbh-session-title-first-prompt-llm": {
    en: "First-message LLM provider plugin for Galaxy Blackhole session titles",
    zh: "根据会话中的首条消息，使用模型生成标题。",
    vi: "Sinh tiêu đề phiên từ tin nhắn đầu tiên bằng model.",
  },
  "@galaxy-blackhole/gbh-session-turn-outline": {
    en: "Whole-log turn outline projection (turnOutline) for the Galaxy Blackhole",
    zh: "生成会话轮次目录，支持定位和跳转历史交互。",
    vi: "Sinh mục lục các lượt của phiên để định vị và nhảy tới lượt cũ.",
  },
  "@galaxy-blackhole/gbh-settings": {
    en: "Abstract user-settings seam (ctx.settings) for the Galaxy Blackhole",
    zh: "为其他插件提供统一的用户设置接口。",
    vi: "Cung cấp giao diện cấu hình người dùng thống nhất cho các plugin khác.",
  },
  "@galaxy-blackhole/gbh-shell-env": {
    en: "Tool-independent managed shell environment registry for Galaxy Blackhole",
    zh: "为命令执行工具统一提供 Galaxy Blackhole 环境变量。",
    vi: "Cung cấp thống nhất biến môi trường của Galaxy Blackhole cho các công cụ chạy lệnh.",
  },
  "@galaxy-blackhole/gbh-skill": {
    en: "Agent skill provider registry for the Galaxy Blackhole",
    zh: "汇总不同来源的技能，供 AI 查询和使用。",
    vi: "Tổng hợp kỹ năng từ nhiều nguồn để AI tra cứu và sử dụng.",
  },
  "@galaxy-blackhole/gbh-skill-badge": {
    en: "Bundled gbh badge skill provider for Galaxy Blackhole",
    zh: "提供官方的 Galaxy Blackhole 徽章技能。",
    vi: "Cung cấp kỹ năng gắn huy hiệu chính thức cho tài liệu, bài đăng và các đầu ra khác.",
  },
  "@galaxy-blackhole/gbh-spill-local": {
    en: "Local-filesystem implementation of the Galaxy Blackhole spill storage seam (private session-scoped files)",
    zh: "将过长的工具结果保存到会话专用的本地文件。",
    vi: "Lưu kết quả công cụ quá dài vào tệp cục bộ riêng của phiên.",
  },
  "@galaxy-blackhole/gbh-spill-policy": {
    en: "Token-budgeted tool-result retention with recoverable text and image paths",
    zh: "限制直接放入上下文的工具结果长度，并保留完整结果的读取路径。",
    vi: "Giới hạn độ dài kết quả công cụ đưa trực tiếp vào ngữ cảnh và giữ đường dẫn đọc kết quả đầy đủ.",
  },
  "@galaxy-blackhole/gbh-storage": {
    en: "Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the Galaxy Blackhole",
    zh: "统一管理插件使用的存储后端和数据访问方式。",
    vi: "Quản lý thống nhất backend lưu trữ và cách truy cập dữ liệu cho plugin.",
  },
  "@galaxy-blackhole/gbh-storage-domain": {
    en: "Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the Galaxy Blackhole",
    zh: "按数据结构校验和保存键值数据，并通知其他插件发生了变更。",
    vi: "Kiểm tra và lưu dữ liệu khoá-giá trị theo cấu trúc, đồng thời thông báo thay đổi cho plugin khác.",
  },
  "@galaxy-blackhole/gbh-storage-json": {
    en: "JSON file KV storage backend for the Galaxy Blackhole storage hub",
    zh: "将键值数据保存为本地 JSON 文件。",
    vi: "Lưu dữ liệu khoá-giá trị thành tệp JSON cục bộ.",
  },
  "@galaxy-blackhole/gbh-subagent": {
    en: "Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents",
    zh: "管理子智能体后端，为任务委派提供统一接口。",
    vi: "Quản lý backend subagent và cung cấp giao diện thống nhất cho việc giao việc.",
  },
  "@galaxy-blackhole/gbh-subagent-fork-in-process": {
    en: "In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log",
    zh: "使用父会话的一段历史创建子智能体。",
    vi: "Tạo subagent từ một đoạn lịch sử của phiên cha.",
  },
  "@galaxy-blackhole/gbh-subagent-model-selection-settings": {
    en: "Sub-agent model selection: reads the chosen model and exposes it as a small settings service.",
    zh: "子智能体模型选择：读取所选模型并以小型设置服务对外提供。",
    vi: "Dịch vụ chọn model cho subagent: đọc lựa chọn model và cấp qua service cấu hình nhỏ.",
  },
  "@galaxy-blackhole/gbh-subagent-spawn-in-process": {
    en: "In-process spawn subagent backend: runs a fresh child agent on ctx.agents",
    zh: "在当前进程中新建子智能体，执行独立任务。",
    vi: "Tạo subagent mới trong tiến trình hiện tại để thực hiện nhiệm vụ độc lập.",
  },
  "@galaxy-blackhole/gbh-subprocess-local": {
    en: "Local-subprocess implementation of the Galaxy Blackhole subprocess seam",
    zh: "为其他插件提供本地进程的启动和管理能力。",
    vi: "Cung cấp cho plugin khác khả năng khởi chạy và quản lý tiến trình cục bộ.",
  },
  "@galaxy-blackhole/gbh-system-prompt": {
    en: "System prompt assembly registry for the Galaxy Blackhole",
    zh: "汇总各插件提供的系统提示词内容。",
    vi: "Tổng hợp nội dung system prompt do các plugin đóng góp.",
  },
  "@galaxy-blackhole/gbh-timeout-policy": {
    en: "Tool-call timeout policy: arms the deadline each tool declares for itself.",
    zh: "工具调用超时策略：按每个工具自述的期限设定截止时间。",
    vi: "Chính sách timeout cho lượt gọi tool: đặt hạn chót theo mức từng tool tự khai.",
  },
  "@galaxy-blackhole/gbh-timer": {
    en: "Fiber-scoped timing service: timeout, interval, throttle and debounce.",
    zh: "随 fiber 生命周期的定时服务：timeout、interval、throttle 与 debounce。",
    vi: "Dịch vụ hẹn giờ sống theo fiber: timeout, interval, throttle và debounce.",
  },
  "@galaxy-blackhole/gbh-token-meter": {
    en: "Replay-aware token measurement service (ctx.tokenMeter) for the Galaxy Blackhole",
    zh: "估算模型上下文的 Token 用量，供压缩等功能判断预算。",
    vi: "Ước lượng lượng token của ngữ cảnh model để các tính năng như nén chọn ngân sách.",
  },
  "@galaxy-blackhole/gbh-tool-goal": {
    en: "Model-facing same-session goal tools with execution-time authority checks",
    zh: "让 AI 设置、查看和更新当前会话目标。",
    vi: "Cho AI đặt, xem và cập nhật mục tiêu của phiên hiện tại.",
  },
  "@galaxy-blackhole/gbh-tool-pwsh": {
    en: "Model-facing pwsh tool over the bash executor seam",
    zh: "让 AI 执行 PowerShell 命令。",
    vi: "Cho AI thực thi lệnh PowerShell.",
  },
  "@galaxy-blackhole/gbh-tool-subagent-control": {
    en: "Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations",
    zh: "让 AI 向子智能体发送消息或中断其运行。",
    vi: "Cho AI gửi tin nhắn tới subagent hoặc ngắt hoạt động của nó.",
  },
  "@galaxy-blackhole/gbh-tool-workflow": {
    en: "Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine",
    zh: "让 AI 编写并运行 JavaScript 脚本，编排多项工具操作。",
    vi: "Cho AI viết và chạy script JavaScript để điều phối nhiều thao tác công cụ.",
  },
  "@galaxy-blackhole/gbh-typert-loader": {
    en: "Loader integration for generated Typert package contributions",
    zh: "加载插件生成的类型信息，供运行时查询和调用。",
    vi: "Nạp thông tin kiểu do plugin sinh ra để truy vấn và gọi lúc chạy.",
  },
  "@galaxy-blackhole/gbh-typert-registry": {
    en: "Runtime registry for generated package reflection and Zod schemas",
    zh: "为插件提供运行时类型信息和远程调用定义。",
    vi: "Cung cấp thông tin kiểu lúc chạy và định nghĩa gọi từ xa cho plugin.",
  },
  "@galaxy-blackhole/gbh-user-questions": {
    en: "Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs",
    zh: "让运行中的 AI 向用户提问并等待回答。",
    vi: "Cho AI đang chạy đặt câu hỏi cho người dùng và chờ câu trả lời.",
  },
  "@galaxy-blackhole/gbh-web": {
    en: "Abstract web access capability seam (ctx.web) for the Galaxy Blackhole — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy",
    zh: "统一管理网页搜索和内容获取的服务提供方。",
    vi: "Quản lý thống nhất nhà cung cấp dịch vụ tìm kiếm và lấy nội dung web.",
  },
  "@galaxy-blackhole/gbh-web-fetch-http": {
    en: "Anonymous public HTTP(S) fetch provider for the Galaxy Blackhole web capability seam (ctx.web)",
    zh: "读取无需登录的 HTTP 或 HTTPS 网页内容。",
    vi: "Đọc nội dung trang HTTP hoặc HTTPS không cần đăng nhập.",
  },
  "@galaxy-blackhole/gbh-web-runtime": {
    en: "Mounts the fallback dist owner, provides the webApp service and exports the địa chỉ web nội bộ variable with the startup URL line.",
    zh: "承载回退 dist、提供 webApp 服务，并导出 địa chỉ web nội bộ 变量与启动时的 URL 行。",
    vi: "Mount chủ sở hữu dist dự phòng, cấp service webApp, xuất biến địa chỉ web nội bộ và dòng URL lúc khởi động.",
  },
  "@galaxy-blackhole/gbh-web-startup": {
    en: "Command-line flag provider for the web app: host, port, public URL, trusted hosts, no-open and TLS options.",
    zh: "Web 应用命令行参数提供者：host、port、public URL、受信主机、no-open 与 TLS。",
    vi: "Bộ cấp cờ dòng lệnh của app web: host, port, public URL, trusted host, no-open và TLS.",
  },
  "@galaxy-blackhole/gbh-workspace": {
    en: "Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the Galaxy Blackhole",
    zh: "保存工作区信息，并管理工作区与会话的关联。",
    vi: "Lưu thông tin workspace và quản lý liên kết giữa workspace với phiên.",
  },
  "@galaxy-blackhole/gbh-acp": {
    en: "Automation-only Agent Client Protocol server for driving Galaxy Blackhole agents over JSON-RPC stdio",
    vi: "Máy chủ Agent Client Protocol chỉ dành cho tự động hoá, phục vụ điều khiển agent từ bên ngoài.",
  },
  "@galaxy-blackhole/gbh-acp-app": {
    en: "The gbh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over gbh-base",
    vi: "Gói profile ACP: cầu JSON-RPC chỉ dành cho tự động hoá, không mở phiên tương tác.",
  },
  "@galaxy-blackhole/gbh-agent-team-profile": {
    en: "Agent Teams collaboration, tools, and Web UI in one experimental bundle",
    zh: "启用团队协作、团队工具、成员列表和共享任务看板。",
    vi: "Cộng tác Agent Teams, công cụ và giao diện web trong một gói trải nghiệm.",
  },
  "@galaxy-blackhole/gbh-anonymous-user-id": {
    en: "Shared anonymous user identity for Galaxy Blackhole telemetry and feedback correlation",
    vi: "Danh tính người dùng ẩn danh dùng chung cho dữ liệu đo lường của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-api-remote-access": {
    en: "Method-level Remote access control for non-owner Peers and the per-Peer access snapshot",
    vi: "Kiểm soát quyền truy cập Remote ở mức từng method cho các peer không phải chủ sở hữu.",
  },
  "@galaxy-blackhole/gbh-app-boot": {
    en: "Shared boot glue for the app bins: .env loading, fail-loud Loader guards, snapshot-aware config resolution, and the Loader boot sequence",
    vi: "Keo khởi động dùng chung cho các app: nạp .env và xử lý lỗi sớm khi khởi động.",
  },
  "@galaxy-blackhole/gbh-approval": {
    en: "User-approval seam (ctx.approval) for the Galaxy Blackhole: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default",
    zh: "向用户请求操作授权，并返回本次审批结果。",
    vi: "Seam phê duyệt của người dùng (ctx.approval) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-atomic-write": {
    en: "Zero-dependency atomic file replacement: exclusive-create random-suffix temp + rename carrying the caller-stated permissions (writeFileAtomic)",
    vi: "Ghi tệp nguyên tử không phụ thuộc thư viện: tạo tệp tạm rồi thay thế một bước.",
  },
  "@galaxy-blackhole/gbh-attachment": {
    en: "Durable immutable attachment storage seam for the Galaxy Blackhole",
    vi: "Seam lưu trữ tệp đính kèm bền vững, bất biến cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-auto-review": {
    en: "Per-tool LLM authorization review for the Galaxy Blackhole Auto permission preset",
    zh: "提供自动审查权限模式，由模型在每次工具调用前判断是否授权。",
    vi: "Duyệt tự động bằng LLM cho từng lời gọi công cụ theo chính sách của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-badge-skill-bundle": {
    // 08/11/2026 (Lead, anh-plugin-08-11.png): zh còn "powered by dsh" ⇒ thống nhất "Galaxy Blackhole" cả 3 ngữ.
    en: "Let agents add a “powered by Galaxy Blackhole” badge to documents, pull requests, and other outputs.",
    zh: "让 Agent 为文档、PR 等产出添加「powered by Galaxy Blackhole」徽章。",
    vi: "Cho agent gắn huy hiệu “powered by Galaxy Blackhole” vào tài liệu, trang và bài trình bày.",
  },
  "@galaxy-blackhole/gbh-base": {
    en: "The shared gbh core as a profile bundle: the first patch layer of base-backed profiles, inserting core rows over the empty profile root",
    vi: "Lõi dùng chung của gbh dưới dạng bundle profile: bản vá đầu tiên khi dựng môi trường.",
  },
  "@galaxy-blackhole/gbh-bash-local": {
    en: "Local-subprocess implementation of the Galaxy Blackhole bash executor seam",
    vi: "Bản chạy trên tiến trình cục bộ cho công cụ shell của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-brand": {
    en: "Stateless branded primitive types for the Galaxy Blackhole",
    vi: "Kiểu nguyên thuỷ mang thương hiệu, không trạng thái, dùng trong toàn bộ Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-bundle": {
    en: "Gói profile gộp các thành phần lõi của Galaxy Blackhole để dựng môi trường chạy.",
    vi: "Gói profile gộp các thành phần lõi của Galaxy Blackhole để dựng môi trường chạy.",
  },
  "@galaxy-blackhole/gbh-chunked-list": {
    en: "Persistent append-only chunked lists with bounded copying and JSON checkpoint validation",
    vi: "Danh sách phân khúc chỉ ghi thêm, lưu bền, sao chép có giới hạn.",
  },
  "@galaxy-blackhole/gbh-client-settings-about": {
    en: "Menu Thong tin (About) cho popup Settings — package DOC LAP, khong thay row nao cua GBH; chung minh duong cai plugin ngoai (G1) o tang UI.",
    vi: "Mục Thông tin (About) trong popup Cài đặt.",
  },
  "@galaxy-blackhole/gbh-client-ui-agent-team": {
    en: "Web Agent Teams roster, task board, and teammate navigation",
    zh: "查看团队成员和共享任务，并切换到成员会话。",
    vi: "Giao diện web cho Agent Teams: danh sách thành viên, bảng công việc và điều hướng đồng đội.",
  },
  "@galaxy-blackhole/gbh-client-ui-brand": {
    en: "Gói brand của Galaxy Blackhole KHÔNG thay row stock: cấp dấu hố đen cho slot HERO (conversation.hero.brand.mark) — slot đó trong bundle ui-conversation chỉ có fallback CÁ GBH. Hai slot sidebar do row ui-brand-official của ta giữ (slot `single` chỉ một chủ).",
    vi: "Gói thương hiệu của Galaxy Blackhole, không thay thế row của bản gốc.",
  },
  "@galaxy-blackhole/gbh-client-ui-cot-translation": {
    en: "Optional machine translation of expanded reasoning, preserving original Session text",
    zh: "将展开的思考内容机器翻译为其他语言。",
    vi: "Dịch máy tuỳ chọn cho phần suy luận mở rộng trước khi hiển thị.",
  },
  "@galaxy-blackhole/gbh-client-ui-plugin-market": {
    en: "Discover tab of the gbh web Plugins page: browse configured plugin market indexes and install their bundles",
    vi: "Tab Khám phá của trang Plugins trên web: duyệt các nguồn chợ plugin đã cấu hình.",
  },
  "@galaxy-blackhole/gbh-client-ui-primitives": {
    en: "Galaxy Blackhole port of the stock plugin",
    vi: "Bản port của Galaxy Blackhole cho gói plugin nguyên thuỷ của bản gốc.",
  },
  "@galaxy-blackhole/gbh-cmdline": {
    en: "Immutable command-line handoff from a gbh launcher to any app plugin that injects cmdlineArgs",
    vi: "Bàn giao tham số dòng lệnh bất biến từ trình khởi chạy gbh sang tiến trình agent.",
  },
  "@galaxy-blackhole/gbh-compaction": {
    en: "Abstract compaction service seam (ctx.compaction) for the Galaxy Blackhole",
    vi: "Seam dịch vụ nén ngữ cảnh trừu tượng (ctx.compaction) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-compaction-image-offload": {
    en: "Đưa ảnh ra khỏi ngữ cảnh khi nén bằng cách ghi quyết định image/offload cho từng ảnh.",
    zh: "将超出模型图片预算的历史图片替换为附件引用，再重试请求。",
    vi: "Đưa ảnh ra khỏi ngữ cảnh khi nén bằng cách ghi quyết định image/offload cho từng ảnh.",
  },
  "@galaxy-blackhole/gbh-cordis-plugin-group": {
    en: "Nested plugin group for cordis",
    vi: "Nhóm plugin lồng nhau cho cordis.",
  },
  "@galaxy-blackhole/gbh-cot-translation-bundle": {
    en: "Experimental machine translation of expanded reasoning",
    zh: "机器翻译展开的思考内容；原文会发送给所选服务",
    vi: "Bản dịch máy thử nghiệm cho phần suy luận mở rộng.",
  },
  "@galaxy-blackhole/gbh-credentials": {
    en: "Abstract credential seam (ctx.credentials): settings carry references to secrets, providers own the values",
    vi: "Seam thông tin xác thực trừu tượng (ctx.credentials): lưu trong cấu hình và đọc theo tham chiếu.",
  },
  "@galaxy-blackhole/gbh-deepseek-account": {
    en: "Read account state and resolve official API credentials",
    vi: "Đọc trạng thái tài khoản và lấy thông tin xác thực chính thức của API.",
  },
  "@galaxy-blackhole/gbh-deque": {
    en: "Zero-dependency circular deque with amortized constant-time end operations and bounded vacant storage",
    vi: "Hàng đợi vòng hai đầu không phụ thuộc thư viện, thao tác khấu hao hằng số.",
  },
  "@galaxy-blackhole/gbh-desktop-product-telemetry": {
    en: "Explicit product usage events exported through OpenTelemetry HTTP logs",
    zh: "通过 OpenTelemetry 向配置的服务上报指定产品使用事件。",
    vi: "Sự kiện đo lường sử dụng sản phẩm, xuất qua OpenTelemetry.",
  },
  "@galaxy-blackhole/gbh-file-reference": {
    en: "File-reference discovery contract and shared @file grammar",
    vi: "Hợp đồng khám phá tham chiếu tệp và ngữ pháp @file dùng chung.",
  },
  "@galaxy-blackhole/gbh-fs": {
    en: "Abstract filesystem capability seam (ctx.fs) for the Galaxy Blackhole — vocabulary types, the FileSystem service (text IO + optional version-guarded atomic mutations), and the fs/* policy event vocabulary",
    vi: "Seam năng lực hệ thống tệp trừu tượng (ctx.fs) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-fs-local": {
    en: "Local-filesystem implementation of the Galaxy Blackhole filesystem seam (ctx.fs)",
    vi: "Bản triển khai trên hệ thống tệp cục bộ của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-harness-dev-context": {
    en: "Model context naming the Galaxy Blackhole checkout and Web GUI URL without letting either change the system prompt",
    vi: "Ngữ cảnh mô hình nêu rõ checkout Galaxy Blackhole và URL Web GUI.",
  },
  "@galaxy-blackhole/gbh-headless": {
    en: "The gbh one-shot bundle: a direct core Agent/Session runner over gbh-base with no Host, HTTP, or browser layer",
    vi: "Bundle chạy một lần của gbh: chạy trực tiếp lõi Agent/Session không cần vỏ web.",
  },
  "@galaxy-blackhole/gbh-home-paths": {
    en: "Shared filesystem path helpers for the Galaxy Blackhole",
    vi: "Hàm dựng đường dẫn hệ thống tệp dùng chung cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-host-directory-picker": {
    en: "Abstract workspace-directory picking seam (ctx.directoryPicker) for the Galaxy Blackhole web GUI host",
    vi: "Seam chọn thư mục workspace trừu tượng (ctx.directoryPicker).",
  },
  "@galaxy-blackhole/gbh-host-directory-picker-browse": {
    en: "In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem)",
    zh: "提供本地目录的列表和创建能力，供应用内选择目录。",
    vi: "Backend duyệt thư mục trong ứng dụng của seam chọn thư mục.",
  },
  "@galaxy-blackhole/gbh-host-directory-picker-native": {
    en: "Native-OS-chooser backend of the directory-picker seam for the Galaxy Blackhole web GUI host",
    zh: "调用操作系统的目录选择对话框。",
    vi: "Backend hộp thoại chọn thư mục của hệ điều hành.",
  },
  "@galaxy-blackhole/gbh-host-frontend-static": {
    en: "SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses",
    vi: "Máy chủ dist SPA cho vỏ web: sở hữu các route tệp tĩnh của webserver.",
  },
  "@galaxy-blackhole/gbh-host-shell-identity": {
    en: "Lớp vỏ L3 của Galaxy Blackhole: đè /favicon.svg + /favicon-dark.svg + /manifest.webmanifest bằng asset GBH và tapIndex đổi <title> thành 'Galaxy Blackhole' — KHÔNG chạm bootstrap/module-loader.",
    vi: "Lớp vỏ L3 của Galaxy Blackhole: ghi đè favicon và nhận diện thương hiệu.",
  },
  "@galaxy-blackhole/gbh-host-skill-filesystem": {
    en: "Local filesystem skill provider for the Galaxy Blackhole",
    zh: "从本地目录发现和读取技能。",
    vi: "Cung cấp kỹ năng từ hệ thống tệp cục bộ cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-host-tool-jobs": {
    en: "Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry",
    zh: "让 AI 查看后台任务、读取输出或停止任务。",
    vi: "Bộ công cụ điều khiển tác vụ chạy nền cho mô hình: xem, đọc kết quả và dừng tác vụ.",
  },
  "@galaxy-blackhole/gbh-host-tool-skill": {
    en: "Model-facing skill loading tool for the Galaxy Blackhole",
    zh: "让 AI 按需加载技能说明。",
    vi: "Công cụ nạp hướng dẫn kỹ năng theo yêu cầu của mô hình.",
  },
  "@galaxy-blackhole/gbh-host-tool-subagent": {
    en: "Model-facing subagent delegation tool over the ctx.subagents seam",
    zh: "让 AI 将任务交给子智能体，并获取运行结果。",
    vi: "Công cụ giao việc cho subagent qua seam ctx.subagents.",
  },
  "@deepseek-ai/dsh-tools": {
    en: "Tool registry and execution pipeline for the Galaxy Blackhole",
    zh: "管理可用工具及其调用执行流程。",
    vi: "Sổ đăng ký công cụ và luồng thực thi lời gọi công cụ của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-host-typert-gateway": {
    en: "Typert Remote Host dispatcher and Client API endpoint",
    zh: "接收客户端的接口调用，并分发给对应的服务。",
    vi: "Bộ điều phối Typert Remote của host và điểm cuối API cho client.",
  },
  "@galaxy-blackhole/gbh-host-webserver-legacy": {
    en: "Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts",
    vi: "Plugin đăng ký route web: route HTTP và nâng cấp, biến đổi chỉ mục trang.",
  },
  "@galaxy-blackhole/gbh-http-proxy": {
    en: "Process-wide outbound HTTP proxy policy for Galaxy Blackhole: resolve it from the launch environment and install it as undici's global dispatcher",
    vi: "Chính sách proxy HTTP ra ngoài ở phạm vi tiến trình: phân giải proxy theo cấu hình môi trường.",
  },
  "@galaxy-blackhole/gbh-jobs": {
    en: "Background job registry (ctx.jobs) for the Galaxy Blackhole — shared ids, owner isolation, polling, cancellation, and completion listeners for long-running tool work",
    vi: "Sổ đăng ký tác vụ chạy nền (ctx.jobs) dùng chung trong Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-launch-environment": {
    en: "Immutable Galaxy Blackhole launch environment that records which layer supplied each value",
    vi: "Môi trường khởi chạy bất biến của Galaxy Blackhole, ghi lại lớp nào đã cấp giá trị.",
  },
  "@galaxy-blackhole/gbh-lazy-require": {
    en: "Caller-relative, success-cached lazy loading for CommonJS-compatible Host dependencies",
    vi: "Nạp lười theo vị trí người gọi, có nhớ kết quả, cho môi trường CommonJS.",
  },
  "@galaxy-blackhole/gbh-llm-deepseek": {
    en: "DeepSeek Messages adapter",
    vi: "Adapter DeepSeek Messages cho dịch vụ llm.",
  },
  "@galaxy-blackhole/gbh-mcp-client": {
    en: "MCP client bridge: connects to MCP servers and registers their tools on ctx.tools",
    vi: "Cầu MCP: kết nối tới các máy chủ MCP và đăng ký công cụ của chúng.",
  },
  "@galaxy-blackhole/gbh-native-command": {
    en: "Host-native command and path-opening utilities with shell-free execution, cancellation, desktop detection, and WSL handoff",
    vi: "Tiện ích lệnh gốc của hệ điều hành và mở đường dẫn, thực thi không qua shell.",
  },
  "@galaxy-blackhole/gbh-output-retention": {
    en: "Zero-dependency bounded-retention primitive: ItemRetainer/TextRetainer + neutral notice helpers (what did we keep, what did we omit)",
    vi: "Nguyên thuỷ giữ kết quả có giới hạn, không phụ thuộc thư viện: ItemRetainer/TextRetainer.",
  },
  "@galaxy-blackhole/gbh-package-manifest": {
    en: "Shared type declarations for package.json.gbh configuration fields",
    vi: "Khai báo kiểu dùng chung cho các trường cấu hình package.json.gbh.",
  },
  "@galaxy-blackhole/gbh-persona": {
    en: "Composition-authored deployment persona section for the Galaxy Blackhole",
    zh: "为当前智能体提供组合中定义的角色与行为说明。",
    vi: "Phần persona triển khai do composition soạn cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-plugin-market": {
    en: "Configured plugin market indexes for the Web Discover page and the plugin_market agent tool",
    vi: "Cấu hình các nguồn chợ plugin cho trang Khám phá và trang Plugins.",
  },
  "@galaxy-blackhole/gbh-plugin-market-index": {
    en: "Plugin market index format 1: JSON validation, relative icon resolution, and pinned install arguments",
    vi: "Định dạng chỉ mục chợ plugin phiên bản 1: kiểm JSON và phân giải biểu tượng tương đối.",
  },
  "@galaxy-blackhole/gbh-ptc-runtime": {
    en: "Abstract PTC execution seam (ctx.ptcRuntime) for the Galaxy Blackhole",
    vi: "Seam thực thi PTC trừu tượng (ctx.ptcRuntime) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-pwsh-local": {
    en: "Local PowerShell implementation of the Galaxy Blackhole bash executor seam",
    vi: "Bản chạy PowerShell cục bộ cho bộ thực thi bash của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-sandbox": {
    en: "Abstract process-sandbox seam (ctx.sandbox) for the Galaxy Blackhole: same-world confinement vocabulary and the SandboxProvider contract",
    vi: "Seam sandbox tiến trình trừu tượng (ctx.sandbox) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-sandbox-local": {
    en: "Bản sao 1:1 (nguyên văn lib/) của @deepseek-ai/dsh-sandbox-local — sandbox cục bộ: thực thi lệnh trong thư mục làm việc với chính sách hộp cát.",
    zh: "按操作系统提供进程隔离，限制命令的访问范围。",
    vi: "Bản sao 1:1 của gói sandbox-local: sandbox tiến trình chạy trên máy cục bộ.",
  },
  "@galaxy-blackhole/gbh-session-format": {
    en: "Streaming adjacent Session format migration machinery",
    vi: "Cơ chế di trú định dạng Session chạy theo luồng giữa các phiên bản định dạng liền kề.",
  },

  "@galaxy-blackhole/gbh-translator": {
    en: "Bản sao 1:1 (nguyên văn lib/) của @deepseek-ai/dsh-experimental-translator — Machine translation with reusable Session results",
    vi: "Bản sao 1:1 của dịch vụ dịch máy thử nghiệm: nhà cung cấp, hình dạng yêu cầu và RPC translate cho client.",
  },
  "@galaxy-blackhole/gbh-typert-protocol": {
    en: "Compiler-independent Remote metadata and Typert provider protocols",
    vi: "Siêu dữ liệu Remote độc lập trình biên dịch và hợp đồng Typert dùng chung giữa host và client.",
  },
  "@galaxy-blackhole/gbh-util-code-language": {
    en: "Single file-extension to syntax-highlighting language table shared by Client code surfaces and the Host read card",
    vi: "Ánh xạ đơn tệp: từ phần mở rộng tệp sang ngôn ngữ tô sáng cú pháp.",
  },
  "@galaxy-blackhole/gbh-util-crypto": {
    en: "Zero-dependency browser-safe UUID and byte-encoding helpers",
    vi: "Tiện ích UUID và mã hoá byte an toàn trên trình duyệt, không phụ thuộc thư viện.",
  },
  "@galaxy-blackhole/gbh-util-time": {
    en: "Zero-dependency time vocabulary shared by wire boundaries: canonicalClientTimeZone (IANA zone validation and canonicalization only, no formatting)",
    vi: "Từ vựng thời gian dùng chung cho wire và giao diện, không phụ thuộc thư viện.",
  },
  "@galaxy-blackhole/gbh-util-values": {
    en: "Duplicate-install-safe value primitives for the Galaxy Blackhole",
    vi: "Nguyên thuỷ giá trị an toàn khi cài trùng cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-util-workspace-path": {
    en: "Browser-safe Workspace path and display helpers",
    vi: "Tiện ích đường dẫn và hiển thị của workspace, an toàn trên trình duyệt.",
  },
  "@galaxy-blackhole/gbh-web-frontend": {
    en: "Máy chủ tệp tĩnh (dist) cho vỏ web của Galaxy Blackhole.",
    vi: "Máy chủ tệp tĩnh (dist) cho vỏ web của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-web-search": {
    en: "DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the Galaxy Blackhole web capability seam (ctx.web)",
    zh: "通过 DeepSeek 提供网页搜索结果。",
    vi: "Nhà cung cấp tìm kiếm dùng DeepSeek (web_search gốc).",
  },
  "@galaxy-blackhole/gbh-win32-process": {
    en: "Shared low-level Win32 process, stdio, and Job Object primitives",
    vi: "Tiện ích cấp thấp dùng chung cho tiến trình, stdio và Job Object trên Win32.",
  },
  "@galaxy-blackhole/gbh-workflow": {
    en: "Workflow capability seam: ctx.workflowEngine service, run vocabulary, and workflow/* events",
    vi: "Seam năng lực workflow: dịch vụ ctx.workflowEngine.",
  },
  "@galaxy-blackhole/gbh-workflow-ptc": {
    en: "Workflow orchestration in the shared sandboxed Node PTC runtime",
    zh: "使用共享的 PTC 运行时执行工作流编排代码。",
    vi: "Điều phối workflow trong tiến trình Node chạy trong sandbox dùng chung.",
  },
  "@galaxy-blackhole/gbh-working-directory": {
    en: "Session working directories with durable changes and model context",
    vi: "Thư mục làm việc của phiên với thay đổi bền vững và ngữ cảnh cho mô hình.",
  },
  "@galaxy-blackhole/gbh-worktree": {
    en: "Creates a named Git worktree and changes the calling Session working directory",
    vi: "Tạo Git worktree có tên và đổi thư mục làm việc của phiên gọi nó.",
  },
};
