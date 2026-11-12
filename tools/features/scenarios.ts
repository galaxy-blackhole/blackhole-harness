/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Danh mục kịch bản chụp cặp A/B theo từng màn hình/tính năng UI (app 5439 vs blackhole web 4001)
 */

import type { MaskRegion, Readiness, Scenario, Step } from "./lib/types.ts";

/**
 * Vùng TRẠNG THÁI của danh sách workspace/session ở sidebar.
 * Chỉ phủ dải có thể chứa chữ của danh sách (y 0.27..0.56), KHÔNG phủ hàng nút
 * Plugins/Automation tasks (y 0.13..0.22) để cổng ảnh vẫn bắt được lệch thật ở đó.
 */
const STATE_SESSIONS: MaskRegion = {
  name: "state-sidebar-sessions",
  kind: "state",
  reason:
    "Danh sách workspace/session là TRẠNG THÁI sống của từng instance: 4001 có workspace galaxy + session cũ " +
    "(Đọc hiểu dự án này), app mới chỉ có Default workspace + New Session. Cây session ở sidebar cao 246..854 px " +
    "@1440x900 (đo từ DOM: role=tree 270x608) nên dải mask phủ hết chiều cao đó, chỉ chừa hàng nút Workspaces phía trên " +
    "và hàng More phía dưới.",
  x: 0,
  y: 0.27,
  w: 0.2,
  h: 0.68,
};

/** Vùng TRẠNG THÁI của hàng chip in tên workspace đang chọn (galaxy vs Default workspace). */
const STATE_CHIP: MaskRegion = {
  name: "state-chip-workspace",
  kind: "state",
  reason:
    "Hàng chip dưới ô soạn tin in TÊN workspace đang chọn nên bề rộng chip khác nhau làm cả hàng dịch ngang — " +
    "trạng thái, không phải bố cục. Chỉ áp cho màn hình KHÔNG bị hộp thoại Settings che.",
  x: 0.2,
  y: 0.4,
  w: 0.4,
  h: 0.085,
};

/**
 * Điều kiện sẵn sàng cho màn hình có dữ liệu lấy qua RPC (inventory plugin, preset, session...).
 * Không thấy nội dung thật trong 15 giây, hoặc còn request treo, thì rig ghi SKIP kèm lý do
 * — tuyệt đối không ghi thành lỗi giao diện.
 * Nhận: mô tả cho người đọc, bộ chọn (tùy chọn) và cờ đòi phản hồi RPC 200.
 * Trả: điều kiện sẵn sàng dùng cho một kịch bản.
 */
function dataReady(description: string, selector?: string, requireApi = true): Readiness {
  return { description, selector, minCount: 1, timeoutMs: 15_000, requireApi };
}

/** Bước mở menu tài khoản (More) — cửa vào Settings, dùng lại ở nhiều kịch bản. */
const OPEN_MORE: Step = { label: "mở menu More", kind: "click", value: 'button[aria-label="Account menu"]', required: true };

/** Bước mở hộp thoại Settings từ menu More. */
const OPEN_SETTINGS: Step = { label: "mở Settings", kind: "click", value: "text=Settings", required: true };

/** Bước mở ngăn kéo bên phải (right sidebar). */
const OPEN_RIGHT: Step = { label: "mở ngăn kéo phải", kind: "click", value: 'button[aria-label="Open right sidebar"]', required: true };

/** Bước mở trang Plugins từ sidebar. */
const OPEN_PLUGINS: Step = { label: "mở Plugins", kind: "click", value: 'button[aria-label="Plugins"]', required: true };

/**
 * Bước bấm vào một tab trong hộp thoại Settings theo chữ hiển thị.
 * Nhận: tên tab (General, Models, Built-in plugins, Agent presets...).
 * Trả: bước thao tác bấm đúng nút trong role=dialog.
 */
function settingsTab(name: string): Step {
  return { label: "tab " + name, kind: "click", value: '[role="dialog"] button:has-text("' + name + '")', required: true };
}

/**
 * Bước mở một session trong danh sách sidebar.
 * Nhận: không.
 * Trả: bước bấm vào mục session tên New Session.
 */
function openSession(): Step {
  return { label: "mở session", kind: "click", value: 'div[role="treeitem"]:has-text("New Session")', required: true };
}

/** Danh mục kịch bản — mọi màn hình người dùng nhìn thấy trong app, chụp giống hệt nhau ở hai bên. */
export const SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: "welcome",
    title: "Màn chào (Into the Unknown) + sidebar mở rộng",
    group: "Trang chào",
    feature: "Trang chào DSH: hero, chip workspace/mode, ô soạn tin, danh sách session ở sidebar",
    steps: [],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "welcome-dark",
    title: "Màn chào ở chế độ tối (prefers-color-scheme: dark)",
    group: "Trang chào",
    feature: "Hệ token --dsw-* ở chế độ tối",
    scheme: "dark",
    steps: [],
    masks: [STATE_SESSIONS, STATE_CHIP],
    note: "Ép prefers-color-scheme=dark cho cả hai bên (không đổi cài đặt của instance).",
  },
  {
    id: "sidebar-collapsed",
    title: "Sidebar thu gọn (rail icon)",
    group: "Sidebar",
    feature: "Thu gọn sidebar: rail icon, nút mở lại, bố cục nội dung dịch sang trái",
    steps: [{ label: "thu gọn sidebar", kind: "click", value: 'button[aria-label="Collapse sidebar"]', required: true }],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "sidebar-roundtrip",
    title: "Sidebar mở rộng trở lại (đã thu gọn rồi mở)",
    group: "Sidebar",
    feature: "Mở lại sidebar từ rail: trạng thái quay về đúng bố cục ban đầu",
    steps: [
      { label: "thu gọn sidebar", kind: "click", value: 'button[aria-label="Collapse sidebar"]', required: true },
      { label: "mở lại sidebar", kind: "click", value: 'button[aria-label="Open sidebar"]', required: true },
    ],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "session-search",
    validity: { searchLabel: "Search sessions" },
    title: "Danh sách session + ô tìm kiếm",
    group: "Session",
    feature: "Tìm session trong sidebar (bấm kính lúp để hiện ô nhập)",
    steps: [{ label: "mở tìm kiếm session", kind: "click", value: 'button[aria-label="Search sessions"]', required: true }],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "view-options",
    title: "Popover tuỳ chọn hiển thị danh sách session",
    group: "Session",
    feature: "View options: Group by / Order by / Filter sessions",
    steps: [{ label: "mở view options", kind: "click", value: 'button[aria-label="View options"]', required: true }],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "session-open",
    title: "Mở session: khung chat + ô soạn tin",
    group: "Chat",
    feature: "Khung hội thoại (transcript) và composer của DSH",
    steps: [openSession()],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "composer-plus-menu",
    title: "Menu dấu + của ô soạn tin (/ commands, file, goal, plan...)",
    group: "Chat",
    feature: "Trigger suggestions: File, Goal, Plan, Compact, Permission, Model, Export, journey",
    steps: [{ label: "mở menu dấu +", kind: "click", value: 'button[aria-label^="Add files"]', required: true }],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "composer-model-menu",
    title: "Menu chọn model và reasoning effort",
    group: "Chat",
    feature: "Chọn model/effort ngay trong composer",
    steps: [{ label: "mở menu model", kind: "click", value: 'button[aria-label^="Select model"]', required: true }],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "composer-access-menu",
    title: "Menu quyền truy cập (Access mode)",
    group: "Chat",
    feature: "Preset quyền: Workspace Write / Read Only / Full Access...",
    steps: [{ label: "mở menu quyền", kind: "click", value: 'button[aria-label^="Access mode"]', required: true }],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "more-menu",
    title: "Menu More (Settings · Feedback · Sign in)",
    group: "Menu",
    feature: "Menu tài khoản ở đáy sidebar",
    steps: [OPEN_MORE],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "plugins-installed",
    validity: { composer: false },
    ready: dataReady("thấy dòng plugin đầu tiên trong danh sách (dữ liệu từ RPC inventory)", "text=Subagent"),
    title: "Plugins → tab Installed",
    group: "Plugins",
    feature: "Built-in plugin settings + Experimental plugins (bật/tắt)",
    steps: [OPEN_PLUGINS],
    masks: [STATE_SESSIONS],
  },
  {
    id: "plugins-discover",
    validity: { composer: false },
    ready: dataReady("kho plugin đã trả xong (mạng lặng + có phản hồi RPC 200)"),
    title: "Plugins → tab Discover",
    group: "Plugins",
    feature: "Kho plugin để cài thêm",
    steps: [OPEN_PLUGINS, { label: "tab Discover", kind: "click", value: "text=Discover", required: true }],
    masks: [STATE_SESSIONS],
  },
  {
    id: "plugins-add-menu",
    validity: { composer: false },
    title: "Plugins → menu Add plugin",
    group: "Plugins",
    feature: "Cách thêm plugin (từ package, từ thư mục...)",
    steps: [OPEN_PLUGINS, { label: "mở menu Add plugin", kind: "click", value: "text=Add plugin", required: true }],
    masks: [STATE_SESSIONS],
  },
  {
    id: "automation-tasks",
    validity: { composer: false, anchorText: "Automation tasks" },
    title: "Automation tasks",
    group: "Automation",
    feature: "Trang tác vụ tự động: tab All/Enabled/Inactive, ô tìm, trạng thái rỗng",
    steps: [{ label: "mở Automation tasks", kind: "click", value: 'button[aria-label="Automation tasks"]', required: true }],
    masks: [STATE_SESSIONS],
  },
  {
    id: "right-sidebar",
    title: "Ngăn kéo phải — panel Start",
    group: "Ngăn kéo phải",
    feature: "Workspace files · New terminal · Session Log",
    steps: [OPEN_RIGHT],
    masks: [STATE_SESSIONS, STATE_CHIP],
  },
  {
    id: "terminal-panel",
    ready: dataReady("terminal đã mở xong (mạng lặng; ruột terminal được mask vì là trạng thái)", undefined, false),
    title: "Ngăn kéo phải — mở terminal",
    group: "Ngăn kéo phải",
    feature: "Terminal trong workspace của session",
    steps: [
      OPEN_RIGHT,
      { label: "mở New terminal", kind: "clickAt", value: "1117,462", required: false },
      { label: "chờ shell lên", kind: "wait", value: "3500" },
    ],
    masks: [
      STATE_SESSIONS,
      STATE_CHIP,
      {
        name: "state-terminal-body",
        kind: "state",
        reason:
          "Nội dung terminal là TRẠNG THÁI sống (prompt in đường dẫn workspace khác nhau giữa hai instance), " +
          "chỉ giữ lại khung/thanh tiêu đề của ngăn kéo để so giao diện.",
        x: 0.55,
        y: 0.05,
        w: 0.45,
        h: 0.95,
      },
    ],
  },
  {
    id: "session-log",
    ready: dataReady("panel Session Log đã lấy xong dữ liệu session", undefined, true),
    title: "Ngăn kéo phải — Session Log",
    group: "Ngăn kéo phải",
    feature: "Ngăn kéo công cụ: log thô + chat đã nhóm của session",
    steps: [
      OPEN_RIGHT,
      { label: "mở Session Log", kind: "clickAt", value: "1117,544", required: false },
      { label: "chờ panel", kind: "wait", value: "2500" },
    ],
    masks: [
      STATE_SESSIONS,
      STATE_CHIP,
      {
        name: "state-session-log-body",
        kind: "state",
        reason:
          "Ruột panel Session Log là dữ liệu session của từng instance (4001 có session cũ, app mới trống) — " +
          "giữ khung panel để so bố cục.",
        x: 0.55,
        y: 0.05,
        w: 0.45,
        h: 0.95,
      },
    ],
  },
  {
    id: "settings-general",
    title: "Settings → General",
    group: "Settings",
    feature: "Permission · Language · Appearance · Font size · Work details · Keyboard shortcuts · Send behavior",
    steps: [OPEN_MORE, OPEN_SETTINGS],
    masks: [STATE_SESSIONS],
  },
  {
    id: "settings-general-dark",
    title: "Settings → General (chế độ tối)",
    group: "Settings",
    feature: "Token --dsw-* trong hộp thoại Settings ở chế độ tối",
    scheme: "dark",
    steps: [OPEN_MORE, OPEN_SETTINGS],
    masks: [STATE_SESSIONS],
  },
  {
    id: "settings-models",
    ready: dataReady("danh sách nhà cung cấp model đã tải (RPC 200)", undefined, true),
    title: "Settings → Models",
    group: "Settings",
    feature: "Nhà cung cấp model, khoá API, model mặc định",
    steps: [OPEN_MORE, OPEN_SETTINGS, settingsTab("Models")],
    masks: [STATE_SESSIONS],
  },
  {
    id: "settings-builtin-plugins",
    validity: { searchLabel: "Search plugins" },
    ready: dataReady("danh sách plugin kèm theo đã tải (thấy mục persona)", "text=persona"),
    title: "Settings → Built-in plugins",
    group: "Settings",
    feature: "Danh sách plugin kèm theo bản cài (session plugins, persona, agent-instructions...)",
    steps: [OPEN_MORE, OPEN_SETTINGS, settingsTab("Built-in plugins")],
    masks: [STATE_SESSIONS],
  },
  {
    id: "settings-presets",
    ready: dataReady("danh sách preset đã tải (mạng lặng + RPC 200)", undefined, true),
    title: "Settings → Agent presets",
    group: "Settings",
    feature: "Preset agent (Standard mode...) và thành phần của chúng",
    steps: [OPEN_MORE, OPEN_SETTINGS, settingsTab("Agent presets")],
    // KHÔNG mask mục CUSTOM: rác đã được dọn, phần này phải so thật (xem §3 của docs/UI-PARITY.md).
    masks: [STATE_SESSIONS],
  },
  {
    id: "settings-features",
    ready: dataReady("danh sách tính năng thử nghiệm đã tải (thấy Agent Teams)", "text=Agent Teams"),
    title: "Settings → Tính năng (Experimental features)",
    group: "Settings",
    feature: "Bật/tắt tính năng thử nghiệm: Agent Teams, Tác vụ tự động",
    steps: [OPEN_MORE, OPEN_SETTINGS, settingsTab("Tính năng")],
    masks: [STATE_SESSIONS],
  },
  {
    id: "settings-about",
    title: "Settings → Thông tin (About)",
    group: "Settings",
    feature: "Thông tin bản dựng: tác giả, website, phiên bản",
    steps: [OPEN_MORE, OPEN_SETTINGS, settingsTab("Thông tin")],
    masks: [STATE_SESSIONS],
  },
  {
    id: "tool-drawer-running",
    title: "Ngăn kéo tool đang chạy (work details của lượt model đang chạy)",
    group: "Chat",
    feature: "Tool call đang chạy: thẻ tool, tham số, trạng thái streaming",
    steps: [],
    masks: [STATE_SESSIONS, STATE_CHIP],
    note:
      "Rig KHÔNG chạy lượt model thật (tốn API key và làm bẩn session của cả hai instance), nên màn hình " +
      "này không mở được; cột ghi chú của ma trận ghi rõ lý do và trỏ sang dòng gần nhất mở được " +
      "(session-log / right-sidebar).",
  },
]);

/**
 * Tra một kịch bản theo khoá.
 * Nhận: id kịch bản.
 * Trả: kịch bản tương ứng, hoặc null nếu không có trong danh mục.
 */
export function findScenario(id: string): Scenario | null {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}
