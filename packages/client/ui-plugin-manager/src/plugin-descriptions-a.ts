/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Nửa A của bảng mô tả plugin (tách để giữ luật <= 1000 dòng/gói)
 */

import type { PluginDescription } from "./plugin-descriptions.ts";

export const PLUGIN_DESCRIPTIONS_A: Record<string, PluginDescription> = {
  "@galaxy-blackhole/gbh-http-proxy": {
    en: "Process-wide outbound HTTP proxy policy for Galaxy Blackhole: resolve it from the launch environment and install it as undici's global dispatcher",
    zh: "",
    vi: "Chính sách proxy HTTP đi ra toàn tiến trình: xác định proxy theo môi trường và áp dụng cho mọi kết nối mạng.",
  },
  "@galaxy-blackhole/gbh-jobs": {
    en: "Background job registry (ctx.jobs) for the Galaxy Blackhole — shared ids, owner isolation, polling, cancellation, and completion listeners for long-running tool work",
    zh: "",
    vi: "Sổ đăng ký job nền (ctx.jobs): định danh dùng chung, quyền sở hữu và vòng đời job.",
  },
  "@galaxy-blackhole/gbh-launch-environment": {
    en: "Immutable Galaxy Blackhole launch environment that records which layer supplied each value",
    zh: "",
    vi: "Môi trường khởi chạy bất biến, ghi lại lớp nào đã cung cấp từng giá trị cấu hình.",
  },
  "@galaxy-blackhole/gbh-lazy-require": {
    en: "Caller-relative, success-cached lazy loading for CommonJS-compatible Host dependencies",
    zh: "",
    vi: "Nạp lười theo vị trí người gọi, có cache thành công, cho phụ thuộc Host kiểu CommonJS.",
  },
  "@galaxy-blackhole/gbh-llm-deepseek": {
    en: "DeepSeek Messages adapter",
    zh: "使用 API 密钥连接 DeepSeek 模型服务。",
    vi: "Bộ chuyển tiếp giao thức Messages của DeepSeek.",
  },
  "@galaxy-blackhole/gbh-mcp-client": {
    en: "MCP client bridge: connects to MCP servers and registers their tools on ctx.tools",
    zh: "",
    vi: "Cầu nối MCP: kết nối tới máy chủ MCP và đăng ký công cụ của chúng vào hệ công cụ.",
  },
  "@galaxy-blackhole/gbh-native-command": {
    en: "Host-native command and path-opening utilities with shell-free execution, cancellation, desktop detection, and WSL handoff",
    zh: "",
    vi: "Tiện ích lệnh gốc của Host và mở đường dẫn, chạy không qua shell, có huỷ và giới hạn.",
  },
  "@galaxy-blackhole/gbh-output-retention": {
    en: "Zero-dependency bounded-retention primitive: ItemRetainer/TextRetainer + neutral notice helpers (what did we keep, what did we omit)",
    zh: "",
    vi: "Nguyên thuỷ giữ đầu ra có giới hạn, không phụ thuộc thư viện: bộ giữ mục và bộ giữ văn bản.",
  },
  "@galaxy-blackhole/gbh-package-manifest": {
    en: "Shared type declarations for package.json.gbh configuration fields",
    zh: "",
    vi: "Khai báo kiểu dùng chung cho các trường cấu hình `gbh` trong package.json.",
  },
  "@galaxy-blackhole/gbh-persona": {
    en: "Composition-authored deployment persona section for the Galaxy Blackhole",
    zh: "为当前智能体提供组合中定义的角色与行为说明。",
    vi: "Phần persona triển khai do tác giả cấu hình ghép, dùng cho phiên làm việc.",
  },
  "@galaxy-blackhole/gbh-plugin-market-index": {
    en: "Plugin market index format 1: JSON validation, relative icon resolution, and pinned install arguments",
    zh: "",
    vi: "Định dạng chỉ mục chợ plugin phiên bản 1: kiểm tra JSON, phân giải biểu tượng tương đối và ghim phiên bản.",
  },
  "@galaxy-blackhole/gbh-plugin-market": {
    en: "Configured plugin market indexes for the Web Discover page and the plugin_market agent tool",
    zh: "",
    vi: "Chỉ mục chợ plugin đã cấu hình cho trang Khám phá trên web và công cụ plugin market.",
  },
  "@galaxy-blackhole/gbh-ptc-runtime": {
    en: "Abstract PTC execution seam (ctx.ptcRuntime) for the Galaxy Blackhole",
    zh: "",
    vi: "Điểm nối thực thi PTC trừu tượng (ctx.ptcRuntime) của hệ.",
  },
  "@galaxy-blackhole/gbh-pwsh-local": {
    en: "Local PowerShell implementation of the Galaxy Blackhole bash executor seam",
    zh: "",
    vi: "Cài đặt PowerShell cục bộ cho điểm nối thực thi bash.",
  },
  "@galaxy-blackhole/gbh-sandbox-local": {
    en: "Bản sao 1:1 (nguyên văn lib/) của @deepseek-ai/dsh-sandbox-local — sandbox cục bộ: thực thi lệnh trong thư mục làm việc với chính sách hộp cát.",
    zh: "按操作系统提供进程隔离，限制命令的访问范围。",
    vi: "Bản sao 1:1 (nguyên văn lib/) của gói sandbox cục bộ — chạy lệnh trong hộp cát trên máy.",
  },
  "@galaxy-blackhole/gbh-sandbox-windows-acl": {
    en: "Windows ACL write-restriction sandbox backend (restricted-token spawn with capability-SID write allowlist) for the Galaxy Blackhole sandbox seam",
    zh: "",
    vi: "Backend hộp cát hạn chế ghi bằng ACL trên Windows: tiến trình chạy bằng token hạn chế.",
  },
  "@galaxy-blackhole/gbh-sandbox": {
    en: "Abstract process-sandbox seam (ctx.sandbox) for the Galaxy Blackhole: same-world confinement vocabulary and the SandboxProvider contract",
    zh: "",
    vi: "Điểm nối hộp cát tiến trình trừu tượng (ctx.sandbox) cho toàn hệ.",
  },
  "@galaxy-blackhole/gbh-scope": {
    en: "Scoped-context registration primitive (scope tags, scope-filtered event dispatch) for the Galaxy Blackhole",
    zh: "",
    vi: "Nguyên thuỷ đăng ký ngữ cảnh có phạm vi: thẻ phạm vi và phát sự kiện đã lọc theo phạm vi.",
  },
  "@galaxy-blackhole/gbh-sdk-jsonrpc-server": {
    en: "Stdio JSON-RPC server plugin for out-of-process Galaxy Blackhole SDK clients",
    zh: "",
    vi: "Máy chủ JSON-RPC qua stdio cho client SDK chạy ngoài tiến trình.",
  },
  "@galaxy-blackhole/gbh-sdk-protocol": {
    en: "Shared wire protocol for the Galaxy Blackhole SDK runtime: the newline-delimited JSON-RPC stdio transport and the named request, result, and notification types spoken between the runtime server and SDK clients",
    zh: "",
    vi: "Giao thức truyền dùng chung cho runtime SDK: bản ghi phân tách bằng dòng mới.",
  },
  "@galaxy-blackhole/gbh-session-format-catalog": {
    en: "Build-static first-party Session format codec and migration catalog",
    zh: "",
    vi: "Danh mục codec định dạng phiên và di trú, dựng tĩnh cho các định dạng bên thứ nhất.",
  },
  "@galaxy-blackhole/gbh-session-format-v0-to-v1": {
    en: "Frozen released-v0 Session codec and identity migration to v1",
    zh: "",
    vi: "Codec phiên bản v0 đã phát hành (đóng băng) và di trú danh tính sang v1.",
  },
  "@galaxy-blackhole/gbh-session-format-v1-to-v2": {
    en: "Frozen released-v1 Session codec and assistant-stream migration to v2",
    zh: "",
    vi: "Codec phiên bản v1 đã phát hành (đóng băng) và di trú luồng trợ lý sang v2.",
  },
  "@galaxy-blackhole/gbh-client-settings-about": {
    en: "Menu Thong tin (About) cho popup Settings — package DOC LAP, khong thay row nao cua GBH; chung minh duong cai plugin ngoai (G1) o tang UI.",
    zh: "",
    vi: "Menu Thông tin (About) cho popup Settings — gói độc lập, không thay row nào của GBH.",
  },
  "@galaxy-blackhole/gbh-client-ui-agent-team": {
    en: "View team members and shared tasks, and navigate to member conversations.",
    zh: "查看团队成员和共享任务，并切换到成员会话。",
    vi: "Xem thành viên nhóm và tác vụ chung, điều hướng tới hội thoại của từng thành viên.",
  },
  "@galaxy-blackhole/gbh-client-ui-brand": {
    en: "Gói brand của Galaxy Blackhole KHÔNG thay row stock: cấp dấu hố đen cho slot HERO (conversation.hero.brand.mark) — slot đó trong bundle ui-conversation chỉ có fallback CÁ GBH. Hai slot sidebar do row ui-brand-official của ta giữ (slot `single` chỉ một chủ).",
    zh: "",
    vi: "Gói thương hiệu Galaxy Blackhole: cấp dấu hố đen cho slot HERO và các điểm nhận diện, không thay row gốc.",
  },
  "@galaxy-blackhole/gbh-client-ui-cot-translation": {
    en: "Display expanded reasoning in another language using machine translation.",
    zh: "将展开的思考内容机器翻译为其他语言。",
    vi: "Hiển thị phần suy luận đã mở rộng bằng ngôn ngữ khác thông qua dịch máy.",
  },
  "@galaxy-blackhole/gbh-client-ui-plugin-market": {
    en: "Discover tab of the gbh web Plugins page: browse configured plugin market indexes and install their bundles",
    zh: "",
    vi: "Tab Khám phá của trang Plugins: duyệt các chỉ mục chợ plugin đã cấu hình và cài đặt từ đó.",
  },
  "@galaxy-blackhole/gbh-client-ui-primitives": {
    en: "Galaxy Blackhole port of the stock plugin",
    zh: "",
    vi: "Bản port của Galaxy Blackhole cho bộ thành phần nguyên thuỷ dùng chung của client web.",
  },
  "@galaxy-blackhole/gbh-acp": {
    en: "Automation-only Agent Client Protocol server for driving Galaxy Blackhole agents over JSON-RPC stdio",
    zh: "",
    vi: "Máy chủ Agent Client Protocol chỉ dành cho tự động hoá, điều khiển agent Galaxy Blackhole qua JSON-RPC.",
  },
  "@galaxy-blackhole/gbh-host-agent-loop": {
    en: "The agent loop: inbox, runtime-context projection, assistant streaming and tool-call execution, plus the AgentLoop launcher.",
    zh: "协调模型请求、工具调用和后续步骤，推进智能体任务。",
    vi: "Vòng lặp agent: hộp thư, chiếu ngữ cảnh runtime, phát trực tiếp câu trả lời và thực thi lời gọi công cụ.",
  },
  "@galaxy-blackhole/gbh-anonymous-user-id": {
    en: "Shared anonymous user identity for Galaxy Blackhole telemetry and feedback correlation",
    zh: "",
    vi: "Định danh người dùng ẩn danh dùng chung cho telemetry và đối chiếu phản hồi.",
  },
  "@galaxy-blackhole/gbh-api-remote-access": {
    en: "Method-level Remote access control for non-owner Peers and the per-Peer access snapshot",
    zh: "",
    vi: "Kiểm soát truy cập Remote ở mức phương thức cho Peer không phải chủ sở hữu và ảnh chụp quyền theo Peer.",
  },
  "@galaxy-blackhole/gbh-app-boot": {
    en: "Shared boot glue for the app bins: .env loading, fail-loud Loader guards, snapshot-aware config resolution, and the Loader boot sequence",
    zh: "",
    vi: "Keo khởi động dùng chung cho các binary của ứng dụng: nạp .env, chốt kiểm tra Loader và ảnh chụp trạng thái.",
  },
  "@galaxy-blackhole/gbh-approval": {
    en: "User-approval seam (ctx.approval) for the Galaxy Blackhole: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default",
    zh: "向用户请求操作授权，并返回本次审批结果。",
    vi: "Điểm nối phê duyệt của người dùng (ctx.approval): quyết định quyền một lần cho từng hành động.",
  },
  "@galaxy-blackhole/gbh-atomic-write": {
    en: "Zero-dependency atomic file replacement: exclusive-create random-suffix temp + rename carrying the caller-stated permissions (writeFileAtomic)",
    zh: "",
    vi: "Thay thế tệp nguyên tử không phụ thuộc thư viện: tạo tệp tạm hậu tố ngẫu nhiên rồi đổi tên.",
  },
  "@galaxy-blackhole/gbh-attachment": {
    en: "Durable immutable attachment storage seam for the Galaxy Blackhole",
    zh: "",
    vi: "Kho lưu tệp đính kèm bền vững, bất biến của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-auto-review": {
    en: "Add an Auto review permission mode that uses the model to assess authorization before each tool call.",
    zh: "提供自动审查权限模式，由模型在每次工具调用前判断是否授权。",
    vi: "Thêm chế độ quyền Tự động duyệt: dùng mô hình đánh giá uỷ quyền trước mỗi hành động.",
  },
  "@galaxy-blackhole/gbh-bash-local": {
    en: "Local-subprocess implementation of the Galaxy Blackhole bash executor seam",
    zh: "",
    vi: "Cài đặt tiến trình con cục bộ cho điểm nối thực thi bash.",
  },
  "@galaxy-blackhole/gbh-brand": {
    en: "Stateless branded primitive types for the Galaxy Blackhole",
    zh: "",
    vi: "Kiểu nguyên thuỷ mang thương hiệu, không trạng thái, dùng chung cho toàn hệ.",
  },
  "@galaxy-blackhole/gbh-acp-app": {
    en: "The gbh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over gbh-base",
    zh: "",
    vi: "Bundle profile ACP: JSON-RPC qua stdio chỉ dành cho tự động hoá và vòng đời tiến trình.",
  },
  "@galaxy-blackhole/gbh-agent-team-profile": {
    en: "Enable team collaboration, team tools, the member roster, and the shared task board.",
    zh: "启用团队协作、团队工具、成员列表和共享任务看板。",
    vi: "Bật cộng tác nhóm, công cụ nhóm, danh sách thành viên và bảng tác vụ chung.",
  },
  "@galaxy-blackhole/gbh-badge-skill-bundle": {
    // 08/11/2026 (Lead, anh-plugin-08-11.png): bỏ dấu vết "dsh" lộ ra giao diện — dùng "Galaxy Blackhole".
    en: "Let agents add a “powered by Galaxy Blackhole” badge to documents, pull requests, and other outputs.",
    zh: "让 Agent 为文档、PR 等产出添加「powered by Galaxy Blackhole」徽章。",
    vi: "Cho phép agent gắn huy hiệu “powered by Galaxy Blackhole” vào tài liệu, pull request và đầu ra khác.",
  },
  "@galaxy-blackhole/gbh-base": {
    en: "The shared gbh core as a profile bundle: the first patch layer of base-backed profiles, inserting core rows over the empty profile root",
    zh: "",
    vi: "Lõi dùng chung dưới dạng bundle profile: lớp patch đầu tiên của các profile dựa trên base.",
  },
  "@galaxy-blackhole/gbh-cot-translation-bundle": {
    en: "Machine translation of expanded reasoning; source text is sent to the selected service",
    zh: "机器翻译展开的思考内容；原文会发送给所选服务",
    vi: "Dịch máy phần suy luận đã mở rộng; văn bản nguồn được gửi tới dịch vụ đã chọn.",
  },
  "@galaxy-blackhole/gbh-inspector-profile": {
    en: "Inspect and debug raw session data, grouped chat messages, and the NodeJS backend.",
    zh: "查看调试会话原始数据、聊天消息分组数据，以及调试 NodeJS 后端",
    vi: "Xem và gỡ lỗi dữ liệu phiên thô, tin nhắn đã nhóm và backend NodeJS.",
  },
  "@galaxy-blackhole/gbh-plugin-market-bundle": {
    en: "Adds a Discover tab to Plugins for browsing and installing bundles from plugin market indexes you add",
    zh: "在插件页添加「发现」标签页，从你添加的插件市场索引浏览和安装插件。",
    vi: "Thêm tab Khám phá vào Plugins để duyệt và cài bundle từ các chỉ mục chợ plugin.",
  },
  "@galaxy-blackhole/gbh-ralph-bundle": {
    en: "Run explicitly requested repeated work with fresh agents.",
    zh: "使用新智能体执行用户明确要求的循环工作。",
    vi: "Chạy công việc lặp lại được yêu cầu rõ ràng bằng các agent mới.",
  },
  "@galaxy-blackhole/gbh-sdk-app": {
    en: "The gbh SDK profile bundle: stdio JSON-RPC serving and process lifecycle over gbh-base",
    zh: "",
    vi: "Bundle profile SDK: phục vụ JSON-RPC qua stdio và vòng đời tiến trình trên nền lõi.",
  },
  "@galaxy-blackhole/gbh-sdk-minimal": {
    en: "The standalone minimal SDK profile bundle: JSON-RPC, one DeepSeek adapter, persistent shell, and JSONL sessions",
    zh: "",
    vi: "Bundle profile SDK tối giản độc lập: JSON-RPC, một adapter mô hình và shell bền vững.",
  },
  "@galaxy-blackhole/gbh-session-search": {
    en: "Give Agents tools to search and read earlier sessions from the current workspace.",
    zh: "为智能体提供搜索和读取当前工作区历史会话的工具。",
    vi: "Cấp cho agent công cụ tìm và đọc các phiên trước đó trong cùng workspace.",
  },
  "@galaxy-blackhole/gbh-session-titles-bundle": {
    en: "Refresh session titles as new human prompts arrive.",
    zh: "在收到新的用户提示时更新会话标题。",
    vi: "Làm mới tiêu đề phiên mỗi khi có câu nhắc mới từ người dùng.",
  },
  "@galaxy-blackhole/gbh-terminal-bundle": {
    en: "Keep shell processes alive across tool calls.",
    zh: "让 shell 进程在多次工具调用之间保持运行。",
    vi: "Giữ tiến trình shell sống xuyên suốt các lời gọi công cụ.",
  },
  "@galaxy-blackhole/gbh-voice-input-bundle": {
    en: "Transcribe recordings locally with SenseVoice; first use requires installing dependencies",
    zh: "在本机使用 SenseVoice 转写录音，首次使用需安装依赖。",
    vi: "Chép lời bản ghi ngay trên máy bằng SenseVoice; lần dùng đầu cần cài mô hình.",
  },
  "@galaxy-blackhole/gbh-account-platform": {
    en: "DeepSeek account authorization via browser PKCE, keeping the grant in the credential store.",
    zh: "通过浏览器 PKCE 授权 DeepSeek 账号，并把授权保存在凭据库中。",
    vi: "Uỷ quyền tài khoản DeepSeek qua trình duyệt bằng PKCE, lưu quyền truy cập trong kho bí mật.",
  },
  "@galaxy-blackhole/gbh-agent": {
    en: "Agent interface, registry, initiator scope, and event vocabulary for the Galaxy Blackhole",
    zh: "管理智能体实例及其运行上下文和事件。",
    vi: "Giao diện agent, registry, phạm vi initiator và bộ từ vựng sự kiện cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-agent-default-model": {
    en: "Default model selection shared by Agent entry points",
    zh: "为新建智能体提供默认模型选择。",
    vi: "Chọn mô hình mặc định dùng chung cho các điểm khởi tạo agent.",
  },
  "@galaxy-blackhole/gbh-agent-instructions": {
    en: "Workspace context loader for AGENTS.md/CLAUDE.md instruction files",
    zh: "读取 AGENTS.md、CLAUDE.md 等文件，为 AI 提供工作区规则。",
    vi: "Bộ nạp ngữ cảnh workspace từ các tệp chỉ dẫn AGENTS.md/CLAUDE.md.",
  },
  "@galaxy-blackhole/gbh-agent-preset": {
    en: "Declare an Agent capability composition in Cordis YAML",
    zh: "声明一个 Agent 预设及其使用的插件组合。",
    vi: "Khai báo thành phần năng lực của agent bằng Cordis YAML.",
  },
  "@galaxy-blackhole/gbh-agent-preset-registry": {
    en: "Declarative Agent preset registry and profile-backed editing",
    zh: "注册 Agent 预设，并保存对预设组成的修改。",
    vi: "Sổ đăng ký preset agent dạng khai báo, chỉnh sửa dựa trên profile.",
  },
  "@galaxy-blackhole/gbh-agent-tool-presentation": {
    en: "Agent-plane presentation selector: composes one agent's tools as PTC mode or native tool calls",
    zh: "选择智能体通过原生工具或 PTC 代码来调用工具。",
    vi: "Bộ chọn cách trình bày ở tầng agent: ghép tool của một agent thành chế độ PTC hoặc lời gọi tool native.",
  },
  "@galaxy-blackhole/gbh-api-account-controller": {
    en: "Expose safe account operations over authenticated Remote",
    zh: "向已认证的客户端提供账号操作能力。",
    vi: "Cung cấp các thao tác tài khoản an toàn qua Remote đã xác thực.",
  },
  "@galaxy-blackhole/gbh-api-gateway": {
    en: "Typert Remote Host dispatcher and Client API endpoint",
    zh: "接收客户端的接口调用，并分发给对应的服务。",
    vi: "Bộ điều phối Typert Remote phía Host và điểm cuối API cho Client.",
  },
  "@galaxy-blackhole/gbh-api-job-controller": {
    en: "Job Remote observation stream and the reference-counted client job-output service",
    zh: "向客户端持续提供后台任务的状态和输出。",
    vi: "Luồng quan sát job qua Remote và dịch vụ xuất kết quả job cho client có đếm tham chiếu.",
  },
  "@galaxy-blackhole/gbh-api-remotes": {
    en: "Remote BFF assembly for application-selected Host capabilities",
    zh: "汇总应用向客户端开放的服务端能力。",
    vi: "Lắp ghép BFF Remote cho các năng lực Host do ứng dụng lựa chọn mở ra.",
  },
  "@galaxy-blackhole/gbh-api-session-controller": {
    en: "Session Remote commands, cold reads, and live control transport",
    zh: "向客户端提供会话读取、运行控制和状态更新能力。",
    vi: "Lệnh Remote trên session, đọc nguội và đường truyền điều khiển trực tiếp.",
  },
  "@galaxy-blackhole/gbh-api-settings-controller": {
    en: "Remote owner for the configuration surfaces over the settings-domain seams",
    zh: "向客户端提供各项设置的读取与修改能力。",
    vi: "Đảm nhận phía Remote cho các bề mặt cấu hình, dựa trên các seam của miền settings.",
  },
  "@galaxy-blackhole/gbh-api-terminal-controller": {
    en: "Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control",
    zh: "向客户端提供会话终端的创建、输入、读取和恢复能力。",
    vi: "Terminal tương tác thuộc sở hữu của session, kèm dò shell, phục hồi màn hình và điều khiển Remote có kiểu.",
  },
  "@galaxy-blackhole/gbh-api-workspace-controller": {
    en: "Workspace Remote commands and reconnect-safe state transport",
    zh: "向客户端提供工作区操作和可在重连后恢复的状态。",
    vi: "Lệnh Remote cho workspace và đường truyền trạng thái an toàn khi kết nối lại.",
  },
  "@galaxy-blackhole/gbh-api-workspace-files": {
    en: "Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace",
    zh: "提供工作区文件读取、目录列表和文件信息更新。",
    vi: "Dịch vụ tệp của workspace và nhà cung cấp tài nguyên cho Client: đọc có giới hạn, liệt kê thư mục và metadata trực tiếp qua namespace Remote workspaceFiles.",
  },
  "@galaxy-blackhole/gbh-attachment-local": {
    en: "Private content-addressed GBH_HOME attachment storage",
    zh: "保存会话中的图片等附件，并按内容标识读取。",
    vi: "Lưu trữ tệp đính kèm riêng tư trong GBH_HOME, địa chỉ hoá theo nội dung (content-addressed).",
  },
  "@galaxy-blackhole/gbh-authorization": {
    en: "Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human",
    zh: "组织需要用户参与的登录和凭据授权流程。",
    vi: "Điểm nối trừu tượng cho uỷ quyền (ctx.authorization): các luồng do plugin sở hữu, lấy thông tin xác thực qua hội thoại với người dùng.",
  },
  "@galaxy-blackhole/gbh-bash-sandbox": {
    en: "Sandbox-consuming implementation of the Galaxy Blackhole bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts)",
    zh: "在当前沙箱权限范围内执行 Bash 命令。",
    vi: "Bản triển khai dùng sandbox cho điểm nối bash executor của Galaxy Blackhole: bọc mọi lệnh qua ctx.sandbox và báo lại sự thật về việc bị từ chối cùng mức cưỡng chế.",
  },
  "@galaxy-blackhole/gbh-client-connection": {
    en: "Authenticated RPC transport and generation lifecycle",
    zh: "建立已认证的客户端通信，并管理连接生命周期。",
    vi: "Truyền tải RPC có xác thực và vòng đời thế hệ kết nối.",
  },
  "@galaxy-blackhole/gbh-client-file-upload": {
    en: "Agent-scoped browser file upload, streaming intake, and staged receipt service",
    zh: "将浏览器中的文件上传到当前会话，供消息和工具使用。",
    vi: "Tải tệp lên trong trình duyệt theo phạm vi agent, nhận dữ liệu theo luồng và dịch vụ biên nhận tạm.",
  },
  "@galaxy-blackhole/gbh-client-hmr": {
    en: "Web client graph synchronization and rebuilt-bundle reload transport",
    zh: "同步浏览器中的插件，并在代码重建后更新相关界面。",
    vi: "Đồng bộ đồ thị client web và truyền tải nạp lại bundle khi có bản dựng mới.",
  },
  "@galaxy-blackhole/gbh-client-locale": {
    en: "Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries",
    zh: "管理界面语言偏好和各插件的翻译文案。",
    vi: "Plugin ngôn ngữ: tuỳ chọn do Host cung cấp, danh mục ngôn ngữ mở rộng, dự phòng phía trình duyệt và bộ từ điển có kiểu.",
  },
  "@galaxy-blackhole/gbh-client-modules": {
    en: "Client module system, dual-face: node half composes the entry graph (có alias tương thích với tên cũ) (incremental gbh.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam",
    zh: "管理浏览器插件模块及其加载依赖。",
    vi: "Hệ module client hai mặt: nửa node dựng đồ thị entry boot (quét gbh.client tăng dần, ghép wire); nửa browser chạy hệ module sống.",
  },
  "@galaxy-blackhole/gbh-client-product-analytics": {
    en: "Desktop product event collection and authenticated Host reporting",
    zh: "采集桌面端指定交互事件，并提交给产品统计服务。",
    vi: "Thu thập sự kiện sản phẩm trên Desktop và báo cáo có xác thực về Host.",
  },
  "@galaxy-blackhole/gbh-client-resources": {
    en: "Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook",
    zh: "将文件等资源地址解析为可供界面读取的内容。",
    vi: "Mô hình tài nguyên client thống nhất: provider đăng ký theo giao thức, biến địa chỉ URL thành giá trị sống.",
  },
  "@galaxy-blackhole/gbh-client-shortcuts": {
    en: "Application keyboard command registry and physical-key routing",
    zh: "注册应用快捷键，并将按键操作分发到对应功能。",
    vi: "Sổ đăng ký lệnh bàn phím của ứng dụng và định tuyến phím vật lý.",
  },
  "@galaxy-blackhole/gbh-client-ui-agent-preset": {
    en: "Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor",
    zh: "选择当前及新会话的 Agent 预设，并编辑预设使用的插件。",
    vi: "Các bề mặt agent-preset: mặc định cho phiên sau, ghế của phiên này và trình soạn thành phần.",
  },
  "@galaxy-blackhole/gbh-client-ui-approval": {
    en: "Approval composer takeover over the scoped Remote Event waterfall",
    zh: "展示待审批的操作，并将用户选择返回给运行中的任务。",
    vi: "Tiếp quản composer phê duyệt trên thác sự kiện Remote có phạm vi.",
  },
  "@galaxy-blackhole/gbh-client-ui-attachment": {
    en: "Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots",
    zh: "在消息输入、对话和运行记录中展示附件与图片。",
    vi: "Trình bày tệp đính kèm động cho ô nhập hội thoại, ảnh tin nhắn và ảnh trajectory.",
  },
  "@galaxy-blackhole/gbh-client-ui-brand-official": {
    en: "Official Galaxy Blackhole brand occupants for the Web client's sidebar slots",
    zh: "在应用侧栏等位置展示官方品牌元素。",
    vi: "Vật thể thương hiệu chính thức của Galaxy Blackhole cho các slot sidebar của client web.",
  },
  "@galaxy-blackhole/gbh-client-ui-chat": {
    en: "Chat Conversation target, node definitions, renderers, and details surface",
    zh: "渲染聊天消息、工具内容和相关详情。",
    vi: "Mục tiêu Conversation kiểu Chat: định nghĩa node, bộ render và bề mặt chi tiết.",
  },
  "@galaxy-blackhole/gbh-client-ui-commands": {
    en: "Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry",
    zh: "在输入框中提供斜杠命令菜单和相关操作界面。",
    vi: "Bề mặt lệnh phía client: cache thư mục toàn cục, nguồn lệnh '/', ba kiểu giao diện lệnh và registry popupSelect.",
  },
  "@galaxy-blackhole/gbh-client-ui-conversation": {
    en: "Target-neutral Conversation assembly, shell, composer, queue, and view navigation",
    zh: "组织对话内容、输入框、消息队列和视图导航。",
    vi: "Lắp ghép Conversation trung lập theo mục tiêu: khung, composer, hàng đợi và điều hướng view.",
  },
  "@galaxy-blackhole/gbh-client-ui-cordis": {
    en: "Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch",
    zh: "展示动态插件定义，并提供运行和停止控件。",
    vi: "Thẻ định nghĩa plugin động Cordis: row công cụ cordis_define kèm công tắc chạy/dừng.",
  },
  "@galaxy-blackhole/gbh-client-ui-deliverables": {
    en: "Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web",
    zh: "展示修改过的文件、内容对比和交付文件入口。",
    vi: "Thẻ tệp thay đổi với tab so sánh từng tệp, thẻ bàn giao và liên kết tệp trong câu trả lời cuối.",
  },
  "@galaxy-blackhole/gbh-client-ui-directory-picker-browse": {
    en: "In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives",
    zh: "在应用中浏览、创建并选择工作区目录。",
    vi: "Màn duyệt thư mục trong ứng dụng: chủ luồng thư mục của workspace, hiển thị danh sách và tạo thư mục từ Host.",
  },
  "@galaxy-blackhole/gbh-client-ui-directory-picker-native": {
    en: "Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser",
    zh: "连接工作区选择入口与系统目录选择对话框。",
    vi: "Màn chọn thư mục gốc: phần không giao diện của luồng thư mục workspace, điều khiển hộp thoại chọn thư mục của Desktop.",
  },
  "@galaxy-blackhole/gbh-client-ui-goal": {
    en: "Session goal surface: GoalBar docked above the composer, read from the goal session projection",
    zh: "在输入框上方展示当前会话的目标和状态。",
    vi: "Bề mặt mục tiêu phiên: GoalBar neo trên composer, đọc từ projection goal của phiên.",
  },
  "@galaxy-blackhole/gbh-client-ui-input-trigger": {
    en: "Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources",
    zh: "识别输入中的 / 和 @，展示并选择对应候选项。",
    vi: "Đường ống kích hoạt ô nhập: phát hiện '/' và '@', menu gợi ý và định tuyến lựa chọn tới nguồn đã đăng ký.",
  },
  "@galaxy-blackhole/gbh-client-ui-jobs": {
    en: "Session-header background-job list with on-demand streaming record panels",
    zh: "在会话中查看后台任务列表、状态和实时输出。",
    vi: "Danh sách job nền ở header phiên kèm bảng bản ghi dạng luồng theo yêu cầu.",
  },
  "@galaxy-blackhole/gbh-client-ui-layout": {
    en: "Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels)",
    zh: "组织导航、会话和侧边面板，并支持拖动调整布局。",
    vi: "Plugin khung: AppFrame ba cột có tay kéo và dịch vụ trạng thái xem (điều hướng và panel).",
  },
  "@galaxy-blackhole/gbh-client-ui-message-feedback": {
    en: "The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes",
    zh: "提供回复的赞踩按钮及会话反馈弹窗。",
    vi: "Phản hồi tin nhắn (thích/không thích) trên bề mặt hội thoại.",
  },
  "@galaxy-blackhole/gbh-client-ui-model-selection": {
    en: "Model selection over the shared model catalog, Session projection, and session.selectModel",
    zh: "查看可用模型，并切换当前会话使用的模型。",
    vi: "Chọn mô hình: bảng chọn trong composer và luồng làm quen mô hình ban đầu.",
  },
  "@galaxy-blackhole/gbh-client-ui-open-in-app": {
    en: "Web \"Open In...\" controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file",
    zh: "在会话和文档预览中提供「打开方式」入口。",
    vi: "Nút chia \"Mở bằng…\" ở header phiên: mở thư mục workspace bằng ứng dụng ngoài trên Desktop.",
  },
  "@galaxy-blackhole/gbh-client-ui-permission-presets": {
    en: "Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection",
    zh: "设置新会话的默认权限，并切换当前会话的权限模式。",
    vi: "Bề mặt quyền: mặc định cho phiên mới trong Cài đặt › Chung và lệnh /permission cho phiên hiện tại.",
  },
  "@galaxy-blackhole/gbh-client-ui-plan": {
    en: "Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews",
    zh: "展示计划模式控件、计划卡片和 Markdown 预览。",
    vi: "Điều khiển chế độ Plan, thẻ kế hoạch lưu trong bản ghi hội thoại và bản xem trước Markdown ở sidebar.",
  },
  "@galaxy-blackhole/gbh-client-ui-plugin-manager": {
    en: "Plugin management for the gbh web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages",
    zh: "查看和安装插件包，并进行启用、停用和重试等操作。",
    vi: "Quản lý plugin cho client web GBH: panel Plugins ở sidebar để cài, bật, tắt và cấu hình plugin.",
  },
  "@galaxy-blackhole/gbh-client-ui-reference": {
    en: "Unified Web @file and @session reference source",
    zh: "通过 @ 在输入框中引用文件或其他会话。",
    vi: "Nguồn tham chiếu @file và @session thống nhất cho web.",
  },
  "@galaxy-blackhole/gbh-client-ui-renderer": {
    en: "Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root",
    zh: "将各插件提供的界面组件组装到应用中。",
    vi: "Bộ render lõi: dựng nội dung tin nhắn, markdown và các khối nội dung phức hợp.",
  },
  "@galaxy-blackhole/gbh-client-ui-schedule": {
    en: "Host task management page and Session reminder catalog",
    zh: "侧栏的自动化任务页面，以及会话里的任务卡片和提醒标记。",
    vi: "Trang quản lý tác vụ trên Host và danh mục nhắc hẹn theo phiên.",
  },
  "@galaxy-blackhole/gbh-client-ui-secret-mask": {
    en: "Web display masking for recognized credentials in sent user text",
    zh: "遮挡已发送消息中可识别的密钥、令牌与密码。",
    vi: "Masks recognized keys, tokens, and passwords in sent messages.",
  },
  "@galaxy-blackhole/gbh-client-ui-session": {
    en: "Session Controller adapter for React and session-scoped slots",
    zh: "将会话控制和状态连接到 React 界面组件。",
    vi: "Bộ chuyển tiếp Session Controller cho React và các slot theo phạm vi phiên.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings": {
    en: "Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract",
    zh: "提供设置页面的基础表单和插件扩展位置。",
    vi: "Popup Settings và hệ thống mục cài đặt có thể mở rộng.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-account": {
    en: "Manage DeepSeek login and open Platform billing pages",
    zh: "管理 DeepSeek 登录，并打开平台账单页面。",
    vi: "Quản lý đăng nhập và mở trang thanh toán của nền tảng.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-agent-loop": {
    en: "Settings page of the agent loop on the gbh web client's Plugins page: the parallel tool-call cap of the agent-loop namespace",
    zh: "配置同时执行的工具调用数量上限。",
    vi: "Trang cài đặt vòng lặp agent: hạn mức gọi công cụ song song và các tuỳ chọn liên quan.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-general": {
    en: "Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice",
    zh: "提供通用设置、设置窗口文案和首次使用提示。",
    vi: "Chủ sở hữu mục Cài đặt › Chung và luồng làm quen sản phẩm: nội dung phần Chung, nút mở và tiêu đề.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-models": {
    en: "Models settings and shared product-onboarding dialogs over existing settings and credential joins",
    zh: "管理模型服务及其接入配置，并提供相关引导。",
    vi: "Cài đặt mô hình và hộp thoại làm quen sản phẩm dùng chung, dựa trên cài đặt và khoá bí mật sẵn có.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-plugin-inventory": {
    en: "Read-only Cordis Loader inventory tab in Web Plugins settings",
    zh: "在设置中查看全局插件和各 Agent 预设使用的插件。",
    vi: "Tab chỉ đọc liệt kê plugin mà Cordis Loader đang nạp, trong Cài đặt › Plugins.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-plugins": {
    en: "Built-in plugins settings section for the gbh web client: the Settings navigation entry and the tab chrome feature-owned tabs register into",
    zh: "提供设置中的内置插件入口及其功能标签页。",
    vi: "Mục cài đặt plugin tích hợp: điểm vào trong điều hướng Cài đặt và nội dung trang tương ứng.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-session-log": {
    en: "General settings control for Session-log upload with DeepSeek API requests",
    zh: "设置是否随 DeepSeek 官方模型 API 请求上传会话日志。",
    vi: "Điều khiển trong Cài đặt › Chung cho việc tải nhật ký phiên lên cùng yêu cầu API.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-shell": {
    en: "Settings page of the shell executor on the gbh web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace",
    zh: "配置命令执行超时和输出长度上限。",
    vi: "Trang cài đặt bộ thực thi shell: thời gian chờ lệnh và các tuỳ chọn liên quan.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-subagent": {
    en: "Settings page of Subagent delegation on the gbh web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents",
    zh: "配置委派深度、并发数量和可选模型。",
    vi: "Trang cài đặt uỷ thác cho subagent: độ sâu đệ quy và các tham số liên quan.",
  },
  "@galaxy-blackhole/gbh-client-ui-settings-web-search": {
    en: "Settings page of the DeepSeek web-search provider on the gbh web client's Plugins page: its API key, endpoint, and per-request search budget",
    zh: "配置 DeepSeek 网页搜索的密钥、服务地址和请求预算。",
    vi: "Trang cài đặt nhà cung cấp tìm kiếm web: khoá API và các tuỳ chọn.",
  },
  "@galaxy-blackhole/gbh-client-ui-shortcuts": {
    en: "Keyboard shortcut reference, recording, and local preference editing",
    zh: "查看、录入和修改键盘快捷键。",
    vi: "Bảng tra cứu phím tắt, ghi phím mới và chỉnh sở thích cục bộ.",
  },
  "@galaxy-blackhole/gbh-client-ui-sidebar": {
    en: "Sidebar plugin: session multi-level tree, search, grouping, state dots",
    zh: "展示会话列表，提供搜索、分组和状态提示。",
    vi: "Sidebar chính của client web: danh sách phiên và điều hướng.",
  },
  "@galaxy-blackhole/gbh-client-ui-sidebar-browser": {
    en: "Sandboxed Web browser tabs for the right Sidebar",
    zh: "在右侧面板中打开和浏览网页。",
    vi: "Tab trình duyệt web chạy trong sandbox ở sidebar phải.",
  },
  "@galaxy-blackhole/gbh-client-ui-sidebar-documentpreview": {
    en: "Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text",
    zh: "在右侧面板预览文档、表格、代码、图片和网页等文件。",
    vi: "Bản xem trước mở rộng ở sidebar cho tài liệu Office, bảng tính, Markdown, mã, ảnh, PDF và HTML.",
  },
  "@galaxy-blackhole/gbh-client-ui-sidebar-files": {
    en: "Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar",
    zh: "浏览工作区目录，并在右侧面板中打开文件。",
    vi: "Tab cây tệp workspace ở sidebar phải: liệt kê thư mục theo nhu cầu qua dịch vụ tệp workspace.",
  },
  "@galaxy-blackhole/gbh-client-ui-sidebar-right": {
    en: "Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it",
    zh: "管理右侧面板的展开状态、内容和导航。",
    vi: "Sidebar phải: trạng thái neo theo phiên của bề mặt dock, panel và nút mở rộng header.",
  },
  "@galaxy-blackhole/gbh-client-ui-sidebar-terminal": {
    en: "Interactive shell tabs for the right Sidebar",
    zh: "在右侧面板中使用交互式命令终端。",
    vi: "Tab shell tương tác ở sidebar phải.",
  },
  "@galaxy-blackhole/gbh-client-ui-skill": {
    en: "Web skill references and the dedicated skill tool row",
    zh: "在会话中提供技能引用和技能调用展示。",
    vi: "Tham chiếu skill trên web và row công cụ skill chuyên dụng.",
  },
  "@galaxy-blackhole/gbh-client-ui-subagent": {
    en: "Subagent conversation catalog, continuation routing UI, and '@' reference source",
    zh: "查看和跳转子智能体会话，并支持继续对话和 @ 引用。",
    vi: "Danh mục hội thoại subagent, giao diện định tuyến tiếp nối và nguồn tham chiếu '@'.",
  },
  "@galaxy-blackhole/gbh-client-ui-theme": {
    en: "Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row",
    zh: "提供浅色、深色和跟随系统的主题设置。",
    vi: "Plugin giao diện: khởi tạo theme từ Host, chuyển sáng/tối và bảng màu.",
  },
  "@galaxy-blackhole/gbh-client-ui-tool": {
    en: "Client Tool call-tree renderer and keyed per-tool presentation slot",
    zh: "展示工具调用过程、嵌套关系和各工具的结果界面。",
    vi: "Hiển thị cây gọi tool trong hội thoại, kèm quan hệ lồng nhau và slot trình bày riêng cho từng tool.",
  },
  "@galaxy-blackhole/gbh-client-ui-trajectory": {
    en: "Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service)",
    zh: "按轮次查看消息、工具调用、耗时和 Token 等运行记录。",
    vi: "Sổ sự kiện trajectory kèm tổng quan thời gian tương tác; plugin chỉ tiêu thụ, đăng ký vào ViewMap của hội thoại, không cung cấp service.",
  },
  "@galaxy-blackhole/gbh-client-ui-user-questions": {
    en: "Web ask_user_question composer takeover and plan-review presentation UI",
    zh: "在会话中展示 AI 的提问和计划审阅请求，并收集用户回答。",
    vi: "Giao diện hỏi đáp trong phiên: chiếm ô soạn thảo cho ask_user_question và trình bày yêu cầu duyệt kế hoạch để bạn trả lời.",
  },
  "@galaxy-blackhole/gbh-client-ui-workflow-run": {
    en: "Durable workflow-run Conversation Node and nested member disclosure for gbh web",
    zh: "在会话中展示工作流运行记录及其成员详情。",
    vi: "Node hội thoại cho một lượt chạy workflow bền, kèm phần bung chi tiết để xem các thành viên lồng bên trong trên web gbh.",
  },
  "@galaxy-blackhole/gbh-client-ui-workspace": {
    en: "Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots",
    zh: "在侧栏和新会话页面中选择工作区。",
    vi: "Bề mặt workspace: quản lý tệp, thay đổi và các tab ngữ cảnh.",
  },
  "@galaxy-blackhole/gbh-command-compact": {
    en: "Human-facing slash command for explicit session compaction",
    zh: "让用户通过命令主动压缩当前会话上下文。",
    vi: "Lệnh slash /compact để bạn chủ động nén ngữ cảnh của phiên hiện tại.",
  },
  "@galaxy-blackhole/gbh-command-feedback": {
    en: "Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command",
    zh: "通过 /feedback 等入口记录用户对会话的评价。",
    vi: "Đánh giá phiên ở dạng chỉ ghi log: sự kiện record, Host Remote sessionFeedback và lệnh /feedback để bạn gửi nhận xét.",
  },
  "@galaxy-blackhole/gbh-command-goal": {
    en: "Human-facing slash command for persisted same-session goals",
    zh: "通过用户命令设置和管理当前会话目标。",
    vi: "Lệnh gạch chéo /goal dành cho người dùng: xem, tạo, sửa, tạm dừng, tiếp tục và xoá mục tiêu được lưu bền trong cùng phiên.",
  },
  "@galaxy-blackhole/gbh-commands": {
    en: "Plugin-owned human command registry for Galaxy Blackhole UIs",
    zh: "注册和管理插件提供的用户命令。",
    vi: "Đăng ký và quản lý các lệnh dành cho người dùng do plugin cung cấp, dùng chung cho mọi giao diện của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-compaction-basic": {
    en: "Token-meter-driven compaction policy and LLM summarization backend for the Galaxy Blackhole",
    zh: "在上下文达到阈值时，使用模型总结历史内容。",
    vi: "Backend nén ngữ cảnh: chính sách dựa trên đồng hồ token, khi ngữ cảnh chạm ngưỡng thì gọi model tóm tắt phần lịch sử.",
  },
  "@galaxy-blackhole/gbh-compaction-tool-result-pruner": {
    en: "Replay-safe model-free head/middle/tail pruning for tool-result surface nodes",
    zh: "在上下文压力较大时，精简过长的工具输出并保留首尾内容。",
    vi: "Khi ngữ cảnh căng, cắt gọn kết quả công cụ quá dài theo kiểu đầu/giữa/cuối mà không gọi model và vẫn an toàn khi replay.",
  },
  "@galaxy-blackhole/gbh-config-editor": {
    en: "Persist plugin configuration through profile patches and Loader reconciliation",
    zh: "保存插件配置，并将变更应用到当前运行配置。",
    vi: "Dịch vụ ctx.configEditor: đọc và sửa cấu hình plugin trong profile, ghi thành patch rồi để Loader đồng bộ lại.",
  },
  "@galaxy-blackhole/gbh-cordis-client-runner": {
    en: "Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries",
    zh: "加载并运行临时动态插件的浏览器部分。",
    vi: "Nửa trình duyệt của gói plugin động hai nửa: đăng ký sự kiện, đánh giá closure, facade bảo vệ và các entry nạp plugin.",
  },
  "@galaxy-blackhole/gbh-credentials-local": {
    en: "File-backed credentials provider ($GBH_HOME/.env under the live process environment) for the Galaxy Blackhole",
    zh: "保存 API 密钥等凭据，并按优先级读取环境变量和本地凭据文件。",
    vi: "Provider thông tin xác thực dựa trên tệp cho Galaxy Blackhole: môi trường của tiến trình đang chạy được ưu tiên trước $GBH_HOME/.env.",
  },
  "@galaxy-blackhole/gbh-deepseek-llm-api-extensions": {
    en: "Additive request-field registry for the official DeepSeek LLM API adapter",
    zh: "允许其他插件向 DeepSeek 模型请求添加扩展字段。",
    vi: "Sổ đăng ký trường yêu cầu bổ sung cho adapter DeepSeek LLM chính thức, để plugin khác thêm trường vào request.",
  },
  "@galaxy-blackhole/gbh-experimental-agent-team": {
    en: "Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG",
    zh: "管理团队成员、成员消息和共享任务。",
    vi: "Manage team members, member messages, and shared tasks.",
  },
  "@galaxy-blackhole/gbh-cmdline": {
    en: "Immutable command-line handoff from a gbh launcher to any app plugin that injects cmdlineArgs",
    vi: "Chuyển giao command line bất biến từ launcher gbh tới mọi app plugin có inject cmdlineArgs.",
  },
  "@galaxy-blackhole/gbh-compaction": {
    en: "Abstract compaction service seam (ctx.compaction) for the Galaxy Blackhole",
    vi: "Điểm nối (seam) trừu tượng cho dịch vụ compaction — ctx.compaction — của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-compaction-image-offload": {
    en: "",
    zh: "将超出模型图片预算的历史图片替换为附件引用，再重试请求。",
    vi: "Thay ảnh trong lịch sử vượt ngân sách ảnh của model bằng tham chiếu attachment rồi thử lại request.",
  },
  "@galaxy-blackhole/gbh-cordis-plugin-group": {
    en: "Nested plugin group for cordis",
    vi: "Nhóm plugin lồng nhau (nested plugin group) cho cordis.",
  },
  "@galaxy-blackhole/gbh-credentials": {
    en: "Abstract credential seam (ctx.credentials): settings carry references to secrets, providers own the values",
    vi: "Lớp ghép trừu tượng cho thông tin xác thực (ctx.credentials): settings chỉ mang tham chiếu tới secret, còn giá trị thật do các provider nắm giữ.",
  },
  "@galaxy-blackhole/gbh-deepseek-account": {
    en: "Read account state and resolve official API credentials",
    vi: "Đọc trạng thái tài khoản và phân giải thông tin xác thực của API chính thức.",
  },
  "@galaxy-blackhole/gbh-deque": {
    en: "Zero-dependency circular deque with amortized constant-time end operations and bounded vacant storage",
    vi: "Deque vòng không phụ thuộc: thao tác ở hai đầu với thời gian khấu hao hằng số và vùng lưu trữ trống có giới hạn.",
  },
  "@galaxy-blackhole/gbh-desktop-product-telemetry": {
    en: "Explicit product usage events exported through OpenTelemetry HTTP logs",
    zh: "通过 OpenTelemetry 向配置的服务上报指定产品使用事件。",
    vi: "Các sự kiện sử dụng sản phẩm được ghi nhận tường minh và xuất qua log HTTP OpenTelemetry.",
  },
  "@galaxy-blackhole/gbh-file-reference": {
    en: "File-reference discovery contract and shared @file grammar",
    vi: "Hợp đồng khám phá tham chiếu tệp và ngữ pháp @file dùng chung.",
  },
  "@galaxy-blackhole/gbh-fs": {
    en: "Abstract filesystem capability seam (ctx.fs) for the Galaxy Blackhole — vocabulary types, the FileSystem service (text IO + optional version-guarded atomic mutations), and the fs/* policy event vocabulary",
    vi: "Lớp ghép năng lực hệ thống tệp trừu tượng (ctx.fs) cho Galaxy Blackhole — các kiểu từ vựng, dịch vụ FileSystem (IO văn bản + thao tác ghi nguyên tử có bảo vệ phiên bản tùy chọn) và bộ từ vựng sự kiện chính sách fs/*.",
  },
  "@galaxy-blackhole/gbh-fs-local": {
    en: "Local-filesystem implementation of the Galaxy Blackhole filesystem seam (ctx.fs)",
    vi: "Triển khai trên hệ thống tệp cục bộ cho lớp ghép hệ thống tệp của Galaxy Blackhole (ctx.fs).",
  },
  "@galaxy-blackhole/gbh-harness-dev-context": {
    en: "Model context naming the Galaxy Blackhole checkout and Web GUI URL without letting either change the system prompt",
    vi: "Ngữ cảnh model nêu rõ đường dẫn checkout Galaxy Blackhole và URL của Web GUI, nhưng không để cả hai thay đổi system prompt.",
  },
  "@galaxy-blackhole/gbh-headless": {
    en: "The gbh one-shot bundle: a direct core Agent/Session runner over gbh-base with no Host, HTTP, or browser layer",
    vi: "Bundle one-shot của gbh: chạy trực tiếp Agent/Session lõi trên gbh-base, không có tầng Host, HTTP hay trình duyệt.",
  },
  "@galaxy-blackhole/gbh-home-paths": {
    en: "Shared filesystem path helpers for the Galaxy Blackhole",
    vi: "Các helper xử lý đường dẫn filesystem dùng chung cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-host-directory-picker": {
    en: "Abstract workspace-directory picking seam (ctx.directoryPicker) for the Galaxy Blackhole web GUI host",
    vi: "Seam trừu tượng để chọn thư mục workspace (ctx.directoryPicker) cho host Web GUI của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-host-directory-picker-browse": {
    en: "In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem)",
    zh: "提供本地目录的列表和创建能力，供应用内选择目录。",
    vi: "Backend duyệt thư mục trong ứng dụng của seam directory-picker: cung cấp primitive liệt kê và tạo thư mục trên filesystem của host.",
  },
  "@galaxy-blackhole/gbh-host-directory-picker-native": {
    en: "Native-OS-chooser backend of the directory-picker seam for the Galaxy Blackhole web GUI host",
    zh: "调用操作系统的目录选择对话框。",
    vi: "Backend dùng hộp thoại chọn thư mục của hệ điều hành cho seam directory-picker trong host Web GUI Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-host-frontend-static": {
    en: "SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses",
    vi: "Server phân phối bản dist SPA cho Web shell: giữ ghế fallback của webserver, phục vụ các index entry được chỉ định cùng asset tĩnh, từ chối truy cập traversal và trả 404 khi thiếu file.",
  },
  "@galaxy-blackhole/gbh-host-shell-identity": {
    en: "Lớp vỏ L3 của Galaxy Blackhole: đè /favicon.svg + /favicon-dark.svg + /manifest.webmanifest bằng asset GBH và tapIndex đổi <title> thành 'Galaxy Blackhole' — KHÔNG chạm bootstrap/module-loader.",
    vi: "Lớp vỏ L3 của Galaxy Blackhole: ghi đè /favicon.svg, /favicon-dark.svg và /manifest.webmanifest bằng asset của GBH, đồng thời tapIndex đổi <title> thành 'Galaxy Blackhole' — không chạm vào bootstrap/module-loader.",
  },
  "@galaxy-blackhole/gbh-bundle": {
    en: "Bundle-native patch layers and profile presets: the Galaxy Blackhole core, web-app, and experimental bundle patches applied over a profile.",
    zh: "提供前端页面资源，并连接 Web 应用所需的运行配置。",
    vi: "Gói bundle gồm các lớp patch và preset profile: lõi Galaxy Blackhole, lớp web-app và các experimental bundle, áp lên một profile.",
  },
  "@galaxy-blackhole/gbh-chunked-list": {
    en: "Persistent append-only chunked lists with bounded copying and JSON checkpoint validation",
    vi: "Danh sách chia khúc chỉ ghi thêm, lưu bền, với sao chép có giới hạn và kiểm tra checkpoint JSON.",
  },
  "@galaxy-blackhole/gbh-session-format-v2-to-v3": {
    en: "Streaming system-prompt, canonical-envelope and PTC migration into V3",
    vi: "Di trú định dạng phiên v2 → v3: system prompt dạng streaming, phong bì chuẩn hoá và PTC.",
  },
  "@galaxy-blackhole/gbh-session-format-v3-to-v4": {
    en: "Streaming tool-role migration and delivery validation from Session V3 to V4",
    vi: "Di trú định dạng phiên v3 → v4: chuyển vai trò cho lời gọi công cụ dạng streaming và kiểm tra phân phối.",
  },
  "@galaxy-blackhole/gbh-session-inspector": {
    en: "Experimental virtualized Session log and live Chat group/node inspectors",
    zh: "在会话侧边栏启用当前会话的原始数据和聊天分组数据分析功能",
    vi: "Trình xem nhật ký phiên và nhóm/node chat trực tiếp, ảo hoá (thử nghiệm).",
  },
  "@galaxy-blackhole/gbh-session-persistence": {
    en: "Abstract durable session persistence seam (ctx.sessionPersistence) for the Galaxy Blackhole",
    vi: "Seam lưu phiên bền vững trừu tượng (ctx.sessionPersistence).",
  },
  "@galaxy-blackhole/gbh-session-query": {
    en: "Combined session query service contract with concrete reads, traces, and filters",
    vi: "Hợp đồng dịch vụ truy vấn phiên kết hợp đọc cụ thể, dấu vết và thống kê.",
  },
  "@galaxy-blackhole/gbh-session-telemetry": {
    en: "SessionTelemetryBackend seam for the Galaxy Blackhole: session-event capture, projection, redaction, and handoff to a reporting backend",
    vi: "Seam SessionTelemetryBackend cho Galaxy Blackhole: ghi nhận sự kiện phiên.",
  },
  "@galaxy-blackhole/gbh-session-title-all-prompts-llm": {
    en: "Sinh tiêu đề phiên từ toàn bộ prompt của người dùng bằng mô hình ngôn ngữ.",
    vi: "Sinh tiêu đề phiên từ toàn bộ prompt của người dùng bằng mô hình ngôn ngữ.",
  },
  "@galaxy-blackhole/gbh-session-title-llm": {
    en: "Shared LLM generation policy for Galaxy Blackhole session-title providers",
    vi: "Chính sách sinh tiêu đề phiên dùng chung cho các nhà cung cấp tiêu đề của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-shell": {
    en: "Abstract bash executor seam (ctx.shell) for the Galaxy Blackhole",
    vi: "Seam thực thi bash trừu tượng (ctx.shell) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-skill-office": {
    en: "Bundled Word, PowerPoint, and Excel workflows and LibreOffice Kit operations",
    vi: "Bộ quy trình Word, PowerPoint và Excel kèm LibreOffice Kit đã đóng gói.",
  },
  "@galaxy-blackhole/gbh-spill": {
    en: "Abstract spill storage seam (ctx.spillStore) for the Galaxy Blackhole — save oversized tool text and return a retrieval locator",
    vi: "Seam lưu kết quả tràn trừu tượng (ctx.spillStore) cho Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-subprocess": {
    en: "Subprocess seam (ctx.subprocess) for the Galaxy Blackhole — managed process groups, bounded spill-backed output, and escalated kills behind one abstract service",
    vi: "Seam tiến trình con (ctx.subprocess) cho Galaxy Blackhole: quản lý tiến trình do plugin khởi chạy.",
  },
  "@galaxy-blackhole/gbh-terminal": {
    en: "Persistent PTY session seam for the Galaxy Blackhole — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup",
    zh: "管理可持续交互的终端会话及其输入、输出和清理。",
    vi: "Seam phiên PTY bền vững cho Galaxy Blackhole, giới hạn theo chủ sở hữu.",
  },
  "@galaxy-blackhole/gbh-terminal-bash": {
    en: "Persistent shell PTY backend over the Galaxy Blackhole subprocess terminal primitive",
    zh: "提供可跨多次调用保留状态的 Shell 终端。",
    vi: "Backend PTY shell bền vững chạy trên seam tiến trình con của Galaxy Blackhole.",
  },
  "@galaxy-blackhole/gbh-time-context": {
    en: "Durable per-step context with the current time and elapsed time",
    zh: "每一步把当前时间、浏览器时区和距上一条消息的时长告诉模型。",
    vi: "Ngữ cảnh bền vững cho từng bước, kèm thời điểm hiện tại và thời gian đã trôi qua.",
  },
};
