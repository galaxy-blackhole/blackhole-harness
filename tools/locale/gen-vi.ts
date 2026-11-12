/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Sinh từ điển tiếng Việt cho TỪNG gói client từ nguồn gbh-locale-vi.json (+ bản dịch tay
 *   gbh-locale-vi-manual.json), rồi báo ĐỘ PHỦ so với từ điển en của chính gói.
 *   11/11/2026: lý do sửa — header của tệp SINH RA đổi sang 11/11/2026 kèm lý do "đổi thương hiệu
 *   DSH → GBH trong chuỗi tiếng Việt hiển thị cho người dùng" (nguồn: toast "phiên đang được dùng").
 *   11/11/2026 (lần 2): lý do sửa — CỔNG CHẶN BẢNG RỖNG. Dòng PLAN của viSessionDelete trỏ
 *   viNs "session-delete" — namespace KHÔNG có trong gbh-locale-vi.json lẫn bản dịch tay ⇒
 *   dictionaryFor() trả {} ⇒ sinh ra "export const viSessionDelete = { };" ⇒ client rơi về tiếng Anh
 *   ("Delete session" ở menu chuột phải phiên). Lỗi im lặng: không cổng nào bắt. Nay mọi dòng PLAN có
 *   bảng rỗng làm tiến trình DỪNG với mã 1 trước khi ghi bất kỳ tệp nào.
 *   10/11/2026: thêm namespace "conversation" vào PLAN (màn hình chào vẫn in "Into the Unknown" —
 *   xem chú thích tại dòng PLAN tương ứng).
 *
 * CÁCH DÙNG (chuẩn của repo):
 *   ~/.bun/bin/bun run tools/locale/gen-vi.ts            # chỉ BÁO CÁO (không ghi)
 *   ~/.bun/bin/bun run tools/locale/gen-vi.ts --write    # ghi src/locales-vi.ts cho từng gói
 *
 * NGUỒN: galaxy-code/web/brand/dsh-locale-keys.json (bộ khoá DSH) và vi.locales.json (bản dịch vi
 * đã có sẵn của blackhole web) — copy vào tools/locale/, ĐỔI TÊN theo luật gbh-*.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/** Gốc repo (tools/locale/../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục chứa dữ liệu nguồn. */
const DATA = import.meta.dir;

/** Một từ điển cần sinh cho một gói. */
interface PlanEntry {
  /** Thư mục gói dưới packages/client/. */
  pkg: string;
  /** Tên export trong src/locales-vi.ts (viết tắt khi gói có nhiều namespace). */
  exportName: string;
  /** Namespace nguồn trong gbh-locale-vi.json (khác namespace của ta khi bản gốc dùng tên khác). */
  viNs: string;
  /** Tên biến namespace trong mã nguồn của gói (để nối vào lời gọi register). */
  varName: string;
  /** File chứa lời gọi register (tương đối so với thư mục gói). */
  file: string;
  /**
   * Tên file nguồn sinh ra trong packages/client/<pkg>/src/ (mặc định "locales-vi.ts").
   * 07/11/2026: cần tách file vì luật ≤1000 dòng/file — bộ "dịch tất cả" cho các namespace CỦA BẢN GỐC
   *   (chat · trajectory · job · settings.sessionLog · permission.access) cộng vào locales-vi.ts hiện có
   *   (529 dòng) sẽ vượt ngưỡng. Mỗi nhóm ghi một file riêng để KHÔNG nới ngưỡng.
   */
  outFile?: string;
}

/** Kế hoạch: mỗi dòng là một namespace của MỘT gói client của ta. */
const PLAN: readonly PlanEntry[] = [
  { pkg: "locale", exportName: "viCommon", viNs: "common", varName: "COMMON_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viSettings", viNs: "settings.locale", varName: "SETTINGS_NS", file: "src/plugin.ts" },
  // CÁC NAMESPACE CỦA GÓI CÒN LÀ BẢN GỐC DSH (chưa viết lại): bảng vi được đăng ký TẬP TRUNG ở gói locale
  // để "dịch TẤT CẢ" đúng nghĩa — đây là các dòng mà bản gốc chỉ có zh+en và UI vẫn hiện tiếng Anh.
  { pkg: "locale", exportName: "viTheme", viNs: "settings.theme", varName: "STOCK_THEME_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viShortcuts", viNs: "shortcuts", varName: "STOCK_SHORTCUTS_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viModel", viNs: "model", varName: "STOCK_MODEL_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viSlashMenu", viNs: "slash.menu", varName: "STOCK_SLASH_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viCordis", viNs: "cordis", varName: "STOCK_CORDIS_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viQuestion", viNs: "question", varName: "STOCK_QUESTION_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viAgentTeam", viNs: "agent-team", varName: "STOCK_AGENT_TEAM_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viVoiceInput", viNs: "voice-input", varName: "STOCK_VOICE_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viSessionLogDownload", viNs: "session-log-download", varName: "STOCK_SESSION_LOG_NS", file: "src/plugin.ts" },
  // 07/11/2026 — BỔ SUNG vào PLAN hai mục TRƯỚC ĐÂY chỉ có trong file đã sinh (thêm tay 24/10 và 26/10).
  //   Sinh lại từ PLAN đã XOÁ MẤT chúng ⇒ plugin locale không build được ("No matching export"). Nay PLAN
  //   là nguồn duy nhất: mọi export trong locales-vi.ts đều phải có một dòng ở đây.
  { pkg: "locale", exportName: "viSessionDelete", viNs: "session-delete", varName: "STOCK_SESSION_DELETE_NS", file: "src/plugin.ts" },
  { pkg: "locale", exportName: "viSettingsAccount", viNs: "settings.account", varName: "STOCK_SETTINGS_ACCOUNT_NS", file: "src/plugin.ts" },
  // 10/11/2026 (Lead): màn hình chào của phiên mới vẫn in "Into the Unknown" dù thanh bên đã là tiếng
  //   Việt. Nguyên nhân ĐO ĐƯỢC: bản dịch tay trước đó nằm SAI namespace ("common") — mà
  //   LocaleRuntime.translate() tra namespace của chính lời gọi trước (chuỗi vi→en của "conversation"),
  //   và từ điển en CỦA ARTEFACT đã có "hero.headline": "Into the Unknown" ⇒ bản dịch ở "common" không
  //   bao giờ tới được. Từ nay "conversation" là namespace SINH TỰ ĐỘNG như mọi namespace stock khác:
  //   381 khoá lấy từ gbh-locale-vi.json["conversation"] + bản dịch tay gbh-locale-vi-manual.json
  //   (tay thắng — đây là chỗ đặt "Bước vào vùng chưa biết"). Ghi file RIÊNG để giữ luật ≤1000 dòng/file
  //   (nhồi vào locales-vi.ts 649 dòng sẽ vượt ngưỡng).
  { pkg: "locale", exportName: "viConversation", viNs: "conversation", varName: "STOCK_CONVERSATION_NS", file: "src/plugin.ts", outFile: "locales-vi-conversation.ts" },
  // 07/11/2026 — BỔ SUNG "DỊCH TẤT CẢ": các namespace của bản gốc mà UI ĐANG hiện tiếng Anh trên app thật
  //   (đo bằng tools/dev/dom-text.ts): "Work details"/"When to Collapse Work Details" (chat) · nhãn tiến
  //   trình "Completed in …" (chat) · bảng chạy của lượt (trajectory) · tác vụ nền (job) · nhật ký phiên
  //   (settings.sessionLog) · nhãn chế độ quyền ở composer (permission.access).
  { pkg: "locale", exportName: "viChat", viNs: "chat", varName: "STOCK_CHAT_NS", file: "src/plugin.ts", outFile: "locales-vi-stock.ts" },
  // ⚠️ KHÔNG thêm "trajectory": artifacts ui-trajectory ĐÃ tự đăng ký { vi: UI_TRAJECTORY_VI } (dòng 8307)
  //   ⇒ đăng ký trung tâm sẽ ném "already has locale vi" và làm chết cả UI (bài học workspace 24/10/2026).
  { pkg: "locale", exportName: "viJob", viNs: "job", varName: "STOCK_JOB_NS", file: "src/plugin.ts", outFile: "locales-vi-stock.ts" },
  { pkg: "locale", exportName: "viSessionLog", viNs: "settings.sessionLog", varName: "STOCK_SESSION_LOG_SETTINGS_NS", file: "src/plugin.ts", outFile: "locales-vi-stock.ts" },
  { pkg: "locale", exportName: "viPermissionAccess", viNs: "permission.access", varName: "STOCK_PERMISSION_ACCESS_NS", file: "src/plugin.ts", outFile: "locales-vi-stock.ts" },
  { pkg: "ui-agent-preset", exportName: "vi", viNs: "settings.agentPreset", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-approval", exportName: "vi", viNs: "approval", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-attachment", exportName: "vi", viNs: "ui-attachment", varName: "NS", file: "src/client.ts" },
  // Gói DE-BUNDLE (ui-chat · ui-conversation · ui-schedule · ui-trajectory): từ điển do embed-vi-parts.ts
  // nhúng thẳng vào lát dưới dạng JSON.parse — KHÔNG sinh src/locales-vi.ts cho các gói này.
  { pkg: "ui-chat", exportName: "vi", viNs: "chat", varName: "NS", file: "src/parts/part-18.ts" },
  { pkg: "ui-commands", exportName: "vi", viNs: "command", varName: "LOCALE_NS", file: "src/plugin.ts" },
  { pkg: "ui-conversation", exportName: "vi", viNs: "conversation", varName: "NS", file: "src/parts/104-types-client-apply.ts" },
  { pkg: "ui-deliverables", exportName: "vi", viNs: "deliverables", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-goal", exportName: "vi", viNs: "goal", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-jobs", exportName: "vi", viNs: "job", varName: "LOCALE_KEY", file: "src/plugin.ts" },
  { pkg: "ui-layout", exportName: "vi", viNs: "shortcuts.layout", varName: "SHORTCUT_NS", file: "src/plugin.ts" },
  { pkg: "ui-message-feedback", exportName: "vi", viNs: "feedback", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-open-in-app", exportName: "vi", viNs: "open-in-app", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-permission", exportName: "viAccess", viNs: "settings.permission", varName: "NS_ACCESS", file: "src/plugin.ts" },
  { pkg: "ui-permission", exportName: "vi", viNs: "settings.permission", varName: "NS_SETTINGS", file: "src/plugin.ts" },
  { pkg: "ui-plan", exportName: "vi", viNs: "plan", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-plugin-market", exportName: "vi", viNs: "pluginMarket", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-reference", exportName: "vi", viNs: "reference", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-schedule", exportName: "vi", viNs: "schedule.catalog", varName: "NS", file: "src/parts/49-plugin.ts" },
  { pkg: "ui-schedule", exportName: "viManager", viNs: "schedule.manager", varName: "MANAGER_NS", file: "src/parts/49-plugin.ts" },
  { pkg: "ui-secret-mask", exportName: "vi", viNs: "secretMask", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-account", exportName: "vi", viNs: "settings.account", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-agent-loop", exportName: "vi", viNs: "settings.agentLoop", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-general", exportName: "vi", viNs: "settings", varName: "NS", file: "src/dictionaries.ts" },
  { pkg: "ui-settings-models", exportName: "vi", viNs: "settings.models", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-plugin-inventory", exportName: "vi", viNs: "settings.pluginInventory", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-plugins", exportName: "vi", viNs: "settings.plugins", varName: "LOCALE_KEY", file: "src/client.ts" },
  { pkg: "ui-settings-session-log", exportName: "vi", viNs: "settings.sessionLog", varName: "LOCALE_KEY", file: "src/client.ts" },
  { pkg: "ui-settings-shell", exportName: "vi", viNs: "settings.shell", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-subagent", exportName: "vi", viNs: "settings.subagent", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-settings-web-search", exportName: "vi", viNs: "settings.webSearch", varName: "NS", file: "src/client.ts" },
  { pkg: "ui-sidebar", exportName: "vi", viNs: "sidebar", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-sidebar-browser", exportName: "vi", viNs: "sidebarBrowser", varName: "namespace", file: "src/plugin.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "vi", viNs: "sidebarDocumentPreview", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viOffice", viNs: "sidebarOffice", varName: "NS_OFFICE", file: "src/office/office-kind.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viExcel", viNs: "sidebarExcel", varName: "NS_EXCEL", file: "src/excel/excel-kind.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viMarkdown", viNs: "documentMarkdown", varName: "NS_MARKDOWN", file: "src/kinds.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viHtml", viNs: "documentHtml", varName: "NS_HTML", file: "src/kinds.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viImage", viNs: "sidebarImage", varName: "NS_IMAGE", file: "src/kinds.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viPdf", viNs: "sidebarPdf", varName: "NS_PDF", file: "src/kinds.ts" },
  { pkg: "ui-sidebar-documentpreview", exportName: "viCode", viNs: "sidebarCodePreview", varName: "NS_CODE", file: "src/kinds.ts" },
  { pkg: "ui-sidebar-files", exportName: "vi", viNs: "sidebarFiles", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-sidebar-right", exportName: "vi", viNs: "sidebarRight", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-sidebar-terminal", exportName: "vi", viNs: "sidebarTerminal", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-skill", exportName: "vi", viNs: "skill", varName: "NS", file: "src/client.ts" },
  { pkg: "ui-subagent", exportName: "vi", viNs: "subagent", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-trajectory", exportName: "vi", viNs: "trajectory", varName: "NS", file: "src/parts/part-12.ts" },
  { pkg: "ui-workflow-run", exportName: "vi", viNs: "workflowRun", varName: "NS", file: "src/plugin.ts" },
  { pkg: "ui-workspace", exportName: "vi", viNs: "workspace", varName: "NS", file: "src/plugin.ts" },
];

/** Bốn gói DE-BUNDLE: từ điển nằm trong lát (embed-vi-parts.ts), KHÔNG có src/locales-vi.ts. */
const DE_BUNDLE_PACKAGES = new Set(["ui-chat", "ui-conversation", "ui-schedule", "ui-trajectory"]);

/** Đọc JSON, ném lỗi có tên file khi hỏng. */
function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(DATA, file), "utf8")) as Record<string, unknown>;
}

/** Bản dịch nền (blackhole web) theo namespace. */
const VI = readJson("gbh-locale-vi.json") as Record<string, Record<string, string>>;
/** Bản dịch tay cho namespace chưa có trong bản nền (và các khoá lệch phiên bản). */
const MANUAL = readJson("gbh-locale-vi-manual.json") as Record<string, Record<string, string>>;

/**
 * Gộp bản dịch nền và bản dịch tay của một namespace (tay thắng).
 * Nhận: viNs — tên namespace.
 * Trả: bảng khoá → chuỗi tiếng Việt.
 */
function dictionaryFor(viNs: string): Record<string, string> {
  return { ...(VI[viNs] ?? {}), ...(MANUAL[viNs] ?? {}) };
}

/**
 * Rút khoá của một biến từ điển tiếng Anh trong một file TS (theo AST, có phân giải spread cùng file).
 * Nhận: file — đường dẫn tuyệt đối; name — tên biến (en/EN).
 * Trả: danh sách khoá, hoặc null nếu file không có biến đó.
 */
function englishKeys(file: string, name = "en"): string[] | null {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS);
  /** Bảng khai báo trong file: tên → biểu thức khởi tạo. */
  const declarations = new Map<string, ts.Expression>();
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const target = declarations.get(name) ?? declarations.get(name.toUpperCase());
  if (target === undefined) return null;

  /**
   * Tính khoá của một biểu thức đối tượng (hỗ trợ identifier và spread cùng file).
   * Nhận: expr — biểu thức; depth — độ sâu phân giải.
   * Trả: danh sách khoá.
   */
  const keysOf = (expr: ts.Expression, depth = 0): string[] => {
    if (depth > 8) return [];
    if (ts.isIdentifier(expr)) {
      const declared = declarations.get(expr.text);
      return declared === undefined ? [] : keysOf(declared, depth + 1);
    }
    if (ts.isParenthesizedExpression(expr)) return keysOf(expr.expression, depth + 1);
    if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)) return keysOf(expr.expression, depth + 1);
    if (!ts.isObjectLiteralExpression(expr)) return [];
    const out: string[] = [];
    for (const prop of expr.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const propName = prop.name;
        if (ts.isIdentifier(propName) || ts.isStringLiteral(propName) || ts.isNoSubstitutionTemplateLiteral(propName)) out.push(propName.text);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        out.push(prop.name.text);
      } else if (ts.isSpreadAssignment(prop)) {
        out.push(...keysOf(prop.expression, depth + 1));
      }
    }
    return out;
  };
  return keysOf(target);
}

/** Kết quả độ phủ của một gói. */
interface Coverage {
  /** Gói. */
  pkg: string;
  /** Số khoá en của gói. */
  en: number;
  /** Số khoá en CÓ bản dịch vi. */
  covered: number;
  /** Khoá en còn thiếu bản dịch. */
  missing: string[];
}

/**
 * Đo độ phủ của một gói: khoá en của gói có mặt trong bản dịch vi của namespace tương ứng.
 * Nhận: pkg — thư mục gói; name — tên biến en.
 * Trả: độ phủ, hoặc null khi không đọc được từ điển en.
 */
function coverageOf(pkg: string, name = "en"): Coverage | null {
  const dir = join(REPO, "packages", "client", pkg, "src");
  const entries = PLAN.filter((entry) => entry.pkg === pkg);
  // Tìm MỌI file nguồn (đệ quy): từ điển en của một số gói nằm trong parts/ (bản de-bundle) chứ
  // không ở locales.ts, nên danh sách ứng viên cố định sẽ bỏ sót oan.
  const candidates: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) candidates.push(path);
    }
  };
  walk(dir);
  let keys: string[] | null = null;
  for (const file of candidates) {
    keys = englishKeys(file, name);
    if (keys === null || keys.length === 0) keys = englishKeys(file, "EN");
    if (keys !== null && keys.length > 0) break;
  }
  if (keys === null || keys.length === 0) return null;
  const dict = Object.assign({}, ...entries.map((entry) => dictionaryFor(entry.viNs)));
  const unique = [...new Set(keys)];
  const missing = unique.filter((key) => typeof dict[key] !== "string");
  return { pkg, en: unique.length, covered: unique.length - missing.length, missing };
}

/** Bảng chữ tiếng Việt của một gói, sắp theo khoá để diff ổn định. */
function renderDictionary(viNs: string): string {
  const dict = dictionaryFor(viNs);
  return Object.keys(dict)
    .sort()
    .map((key) => "  " + JSON.stringify(key) + ": " + JSON.stringify(dict[key]) + ",")
    .join("\n");
}

/** Năm dòng header bắt buộc của repo cho file sinh ra. */
function header(pkg: string): string {
  return [
    "/**",
    " * author Bùi Trọng Hiếu",
    " * email kevinbui210191@gmail.com",
    " * create date 15/10/2026",
    " * modify date 11/11/2026",
    " * desc Từ điển tiếng Việt của @galaxy-blackhole/gbh-client-" + pkg + " — SINH TỰ ĐỘNG bởi",
    " *   tools/locale/gen-vi.ts từ gbh-locale-vi.json + gbh-locale-vi-manual.json. Không sửa tay.",
    " *   11/11/2026: đổi thương hiệu DSH → GBH trong chuỗi tiếng Việt hiển thị cho người dùng",
    " *   11/11/2026: nạp lại bảng \"session-delete\" (menu phiên hết hiện tiếng Anh) + gen-vi.ts chặn bảng rỗng",
    " */",
    "",
  ].join("\n");
}


/**
 * Sinh nội dung MỘT file từ điển của một gói (mọi namespace ghi vào file đó).
 * Nhận: pkg — thư mục gói; outFile — tên file nguồn cần sinh.
 * Trả: văn bản file.
 */
function renderFile(pkg: string, outFile = "locales-vi.ts"): string {
  const entries = PLAN.filter((entry) => entry.pkg === pkg && (entry.outFile ?? "locales-vi.ts") === outFile);
  const blocks = entries.map((entry) => {
    const doc =
      "/**\n * Từ điển tiếng Việt của namespace \"" + entry.viNs + "\" (nguồn: gbh-locale-vi.json" +
      (MANUAL[entry.viNs] === undefined ? "" : " + bản dịch tay gbh-locale-vi-manual.json") +
      ").\n * Nhận: không.\n * Trả: bảng khoá → chuỗi hiển thị tiếng Việt.\n */";
    return doc + "\nexport const " + entry.exportName + ": Readonly<Record<string, string>> = {\n" + renderDictionary(entry.viNs) + "\n};\n";
  });
  return header(pkg) + blocks.join("\n");
}

/**
 * Các dòng PLAN có bảng vi RỖNG — namespace không có trong nguồn (VI lẫn MANUAL).
 * Nhận: không.
 * Trả: danh sách dòng PLAN rỗng (rỗng = mọi namespace đều có dữ liệu).
 */
function emptyEntries(): PlanEntry[] {
  return PLAN.filter((entry) => Object.keys(dictionaryFor(entry.viNs)).length === 0);
}

/**
 * Cổng chặn: một dòng PLAN không có khoá nào nghĩa là UI sẽ rơi về tiếng Anh ở ĐÚNG namespace đó.
 * Nhận: không.
 * Trả: không — in danh sách rỗng rồi THOÁT mã 1 (không ghi tệp nào).
 */
function guardEmpty(): void {
  const empty = emptyEntries();
  if (empty.length === 0) return;
  for (const entry of empty) {
    console.error("RONG  " + entry.pkg + "  viNs=" + entry.viNs + "  export=" + entry.exportName + "  (khong co khoa nao trong VI/MANUAL)");
  }
  console.error(
    "\nDUNG: " + empty.length + " dong PLAN co bang vi RONG ⇒ sinh ra tu dien rong va UI roi ve tieng Anh. " +
      "Sua NGUON: them namespace vao tools/locale/gbh-locale-vi-manual.json (hoac gbh-locale-vi.json) " +
      "dung bang khoa cua tu dien en cua goi.",
  );
  process.exit(1);
}

/**
 * Điểm vào: in báo cáo độ phủ và (khi có --write) ghi file từ điển cho từng gói.
 * Nhận: không.
 * Trả: không — in bảng ra stdout.
 */
function main(): void {
  // 11/11/2026 — chạy cổng chặn TRƯỚC mọi thao tác ghi: tệp rỗng không bao giờ được sinh ra nữa.
  guardEmpty();
  const write = process.argv.includes("--write");
  // 07/11/2026: --only=<gói>[,<gói>] — chỉ ghi file của các gói được nêu (tránh sinh lại 40 file khi
  //   phạm vi thay đổi chỉ nằm ở gói locale).
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg === undefined ? null : new Set(onlyArg.slice("--only=".length).split(",").map((name) => name.trim()));
  const packages = [...new Set(PLAN.map((entry) => entry.pkg))];
  const rows: Coverage[] = [];
  for (const pkg of packages) {
    const dir = join(REPO, "packages", "client", pkg, "src");
    if (!existsSync(dir)) {
      console.log("THIEU GOI  " + pkg + " — khong thay " + dir);
      continue;
    }
    // Gói DE-BUNDLE không sinh locales-vi.ts: từ điển của chúng do embed-vi-parts.ts nhúng vào lát.
    if (write && !DE_BUNDLE_PACKAGES.has(pkg) && (only === null || only.has(pkg))) {
      const outs = [...new Set(PLAN.filter((entry) => entry.pkg === pkg).map((entry) => entry.outFile ?? "locales-vi.ts"))];
      for (const outFile of outs) writeFileSync(join(dir, outFile), renderFile(pkg, outFile));
    }
    const coverage = coverageOf(pkg);
    if (coverage !== null) rows.push(coverage);
    else console.log("KHONG DOC DUOC en  " + pkg);
  }
  const totalEn = rows.reduce((sum, row) => sum + row.en, 0);
  const totalCovered = rows.reduce((sum, row) => sum + row.covered, 0);
  console.log("| gói | khoá en | có vi | thiếu |");
  console.log("|---|---|---|---|");
  for (const row of rows.sort((a, b) => (a.pkg < b.pkg ? -1 : 1))) {
    console.log("| " + row.pkg + " | " + row.en + " | " + row.covered + " | " + (row.missing.length === 0 ? "0" : row.missing.join(", ")) + " |");
  }
  const percent = totalEn === 0 ? 0 : Math.round((totalCovered / totalEn) * 100);
  console.log("\nTONG: " + totalCovered + "/" + totalEn + " khoá en có bản dịch vi (" + percent + "%) trên " + rows.length + " gói");
  console.log(write ? "DA GHI src/locales-vi.ts cho " + packages.length + " gói" : "KHONG GHI (thêm --write để ghi file)");
}

main();
