/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nối từ điển tiếng Việt vào lời gọi ctx.locale.register của TỪNG gói client:
 *   thêm import từ ./locales-vi.ts và một cặp vi: <tên export> trong bảng từ điển.
 *
 * CÁCH DÙNG:
 *   ~/.bun/bin/bun run tools/locale/wire-vi.ts          # chỉ BÁO CÁO
 *   ~/.bun/bin/bun run tools/locale/wire-vi.ts --write  # sửa file
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Một điểm nối cần thực hiện. */
interface Wire {
  /** Thư mục gói dưới packages/client/. */
  pkg: string;
  /** File chứa lời gọi register (tương đối so với thư mục gói). */
  file: string;
  /** Biến namespace trong lời gọi register. */
  varName: string;
  /** Tên export trong locales-vi.ts. */
  exportName: string;
}

/** Danh sách điểm nối — mỗi dòng là một lời gọi register của một gói thường (không phải gói de-bundle). */
const WIRES: readonly Wire[] = [
  { pkg: "locale", file: "src/plugin.ts", varName: "COMMON_NS", exportName: "viCommon" },
  { pkg: "locale", file: "src/plugin.ts", varName: "SETTINGS_NS", exportName: "viSettings" },
  { pkg: "ui-agent-preset", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-approval", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-attachment", file: "src/client.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-commands", file: "src/plugin.ts", varName: "LOCALE_NS", exportName: "vi" },
  { pkg: "ui-deliverables", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-goal", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-jobs", file: "src/plugin.ts", varName: "LOCALE_KEY", exportName: "vi" },
  { pkg: "ui-layout", file: "src/plugin.ts", varName: "SHORTCUT_NS", exportName: "vi" },
  { pkg: "ui-message-feedback", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-open-in-app", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-permission", file: "src/plugin.ts", varName: "NS_ACCESS", exportName: "viAccess" },
  { pkg: "ui-permission", file: "src/plugin.ts", varName: "NS_SETTINGS", exportName: "vi" },
  { pkg: "ui-plan", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-plugin-market", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-reference", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-secret-mask", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-account", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-agent-loop", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-models", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-plugin-inventory", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-plugins", file: "src/client.ts", varName: "LOCALE_KEY", exportName: "vi" },
  { pkg: "ui-settings-session-log", file: "src/client.ts", varName: "LOCALE_KEY", exportName: "vi" },
  { pkg: "ui-settings-shell", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-subagent", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-settings-web-search", file: "src/client.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-sidebar", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-sidebar-browser", file: "src/plugin.ts", varName: "namespace", exportName: "vi" },
  { pkg: "ui-sidebar-documentpreview", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-sidebar-documentpreview", file: "src/office/office-kind.ts", varName: "NS_OFFICE", exportName: "viOffice" },
  { pkg: "ui-sidebar-documentpreview", file: "src/excel/excel-kind.ts", varName: "NS_EXCEL", exportName: "viExcel" },
  { pkg: "ui-sidebar-documentpreview", file: "src/kinds.ts", varName: "NS_MARKDOWN", exportName: "viMarkdown" },
  { pkg: "ui-sidebar-documentpreview", file: "src/kinds.ts", varName: "NS_HTML", exportName: "viHtml" },
  { pkg: "ui-sidebar-documentpreview", file: "src/kinds.ts", varName: "NS_IMAGE", exportName: "viImage" },
  { pkg: "ui-sidebar-documentpreview", file: "src/kinds.ts", varName: "NS_PDF", exportName: "viPdf" },
  { pkg: "ui-sidebar-documentpreview", file: "src/kinds.ts", varName: "NS_CODE", exportName: "viCode" },
  { pkg: "ui-sidebar-files", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-sidebar-right", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-sidebar-terminal", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-skill", file: "src/client.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-subagent", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-workflow-run", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
  { pkg: "ui-workspace", file: "src/plugin.ts", varName: "NS", exportName: "vi" },
];

/**
 * Chèn import sau câu import CUỐI CÙNG của file (theo AST, không đoán bằng dòng).
 * Nhận: text — nội dung file; file — đường dẫn; spec — đường dẫn import; names — tên export.
 * Trả: nội dung mới, hoặc null khi file đã có import đó.
 */
function insertImport(text: string, file: string, spec: string, names: readonly string[]): string | null {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TS);
  const imports = sf.statements.filter(ts.isImportDeclaration);
  for (const decl of imports) {
    const from = decl.moduleSpecifier;
    if (!ts.isStringLiteral(from) || from.text !== spec) continue;
    const named = decl.importClause?.namedBindings;
    const present = named !== undefined && ts.isNamedImports(named) ? named.elements.map((el) => el.name.text) : [];
    if (names.every((name) => present.includes(name))) return null;
  }
  const last = imports[imports.length - 1];
  const line = "import { " + names.join(", ") + " } from " + JSON.stringify(spec) + ";";
  if (last === undefined) return line + String.fromCharCode(10) + text;
  return text.slice(0, last.end) + String.fromCharCode(10) + line + text.slice(last.end);
}

/**
 * Chèn cặp vi vào một lời gọi register.
 * Nhận: text — nội dung file; varName — biến namespace; exportName — tên export.
 * Trả: nội dung mới, hoặc null khi không tìm thấy lời gọi.
 */
function insertRegistration(text: string, varName: string, exportName: string): string | null {
  const needle = "register(" + varName + ", {";
  const at = text.indexOf(needle);
  if (at < 0) return null;
  const insert = exportName === "vi" ? " vi," : " vi: " + exportName + ",";
  const end = at + needle.length;
  return text.slice(0, end) + insert + text.slice(end);
}

/**
 * Điểm vào: nối từng điểm trong bảng WIRES (hoặc chỉ báo cáo khi không có --write).
 * Nhận: không.
 * Trả: không — in bảng ra stdout.
 */
function main(): void {
  const write = process.argv.includes("--write");
  const groups = new Map<string, Wire[]>();
  for (const wire of WIRES) {
    const key = wire.pkg + "/" + wire.file;
    const list = groups.get(key) ?? [];
    list.push(wire);
    groups.set(key, list);
  }
  let done = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const [key, wires] of groups) {
    const file = join(REPO, "packages", "client", key);
    if (!existsSync(file)) {
      failed.push(key + " — khong thay file");
      continue;
    }
    let text = readFileSync(file, "utf8");
    if (text.includes("vi: vi,") || text.includes(" vi,")) {
      skipped += 1;
      continue;
    }
    for (const wire of wires) {
      const next = insertRegistration(text, wire.varName, wire.exportName);
      if (next === null) {
        failed.push(key + " — khong thay register(" + wire.varName + ", {");
        break;
      }
      text = next;
    }
    const rel = relative(dirname(file), join(REPO, "packages", "client", wires[0]?.pkg ?? "", "src", "locales-vi.ts"));
    const spec = rel.startsWith(".") ? rel : "./" + rel;
    const withImport = insertImport(text, file, spec, [...new Set(wires.map((wire) => wire.exportName))]);
    if (withImport !== null) text = withImport;
    if (write) writeFileSync(file, text);
    done += 1;
  }
  console.log("nối được: " + done + " file · bỏ qua (đã nối): " + skipped + " · lỗi: " + failed.length);
  for (const line of failed) console.log("  LOI  " + line);
  console.log(write ? "DA GHI" : "KHONG GHI (thêm --write)");
}

main();
