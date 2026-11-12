/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bo doc dump-config YAML doc lap: lay row theo thu tu that (id, name, disabled, khoa config) khong phu thuoc bo chuan hoa khac
 */

/** Một row đọc trực tiếp từ dump-config của harness. */
export interface ParsedRow {
  /** Vị trí row trong cây (0-based). */
  index: number;
  /** Số dòng trong file dump (1-based). */
  line: number;
  /** id row. */
  id: string;
  /** Tên package. */
  name: string;
  /** Row bị patch tắt. */
  disabled: boolean;
  /** Các khoá cấp 1 trong config (đã sắp xếp). */
  configKeys: string[];
}

/** Kết quả đọc một file dump-config. */
export interface ParsedDump {
  /** Các row theo đúng thứ tự trong cây. */
  rows: ParsedRow[];
  /** Số dòng "- id:" ở mọi cấp (kể cả entry lồng trong config). */
  allIdLines: number;
  /** Số dòng "- id:" bị thụt lề (entry lồng). */
  nestedIdLines: number;
  /** Tổng số dòng file. */
  totalLines: number;
}

/**
 * Đọc dump-config YAML bằng bộ quét dòng (không cần thư viện YAML).
 * Chỉ lấy row ở thụt lề 0 — đó mới là row plugin; entry lồng trong config chỉ được đếm.
 * Nhận: nội dung file dump.
 * Trả: ParsedDump kèm số liệu đếm để tài liệu ghi rõ quy tắc.
 */
export function parseRawDumpYaml(text: string): ParsedDump {
  const lines = text.split("\n");
  const rows: ParsedRow[] = [];
  let allIdLines = 0;
  let nestedIdLines = 0;
  let current: ParsedRow | null = null;
  let inConfig = false;
  const push = (): void => {
    if (current !== null) rows.push(current);
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (/^\s*- id:/.test(raw)) {
      allIdLines++;
      if (/^\s+- id:/.test(raw)) nestedIdLines++;
    }
    const top = raw.match(/^- id:\s*(.+)$/);
    if (top) {
      push();
      current = {
        index: rows.length,
        line: i + 1,
        id: (top[1] ?? "").trim().replace(/^['"]|['"]$/g, ""),
        name: "",
        disabled: false,
        configKeys: [],
      };
      inConfig = false;
      continue;
    }
    if (current === null) continue;
    const nameMatch = raw.match(/^  name:\s*'?([^']+)'?\s*$/);
    if (nameMatch?.[1]) {
      current.name = nameMatch[1].replace(/'$/, "").trim();
      continue;
    }
    if (/^  disabled:\s*\S/.test(raw)) {
      current.disabled = true;
      continue;
    }
    if (/^  config:\s*$/.test(raw)) {
      inConfig = true;
      continue;
    }
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:/.test(raw)) {
      inConfig = false;
      continue;
    }
    if (inConfig) {
      const key = raw.match(/^    ([A-Za-z_][A-Za-z0-9_-]*):/);
      if (key?.[1]) current.configKeys.push(key[1]);
    }
  }
  push();
  for (const row of rows) row.configKeys = [...new Set(row.configKeys)].sort();
  return { rows, allIdLines, nestedIdLines, totalLines: lines.length };
}

/**
 * Bản rút gọn để so sánh: id + tên + disabled + khoá config (bỏ giá trị để tránh phụ thuộc môi trường).
 * Nhận: một row đã đọc.
 * Trả: chuỗi JSON ổn định dùng làm khoá so sánh.
 */
export function rowFingerprint(row: ParsedRow): string {
  return JSON.stringify({ id: row.id, name: row.name, disabled: row.disabled, configKeys: row.configKeys });
}

/**
 * Tìm gói gốc từ tên đầy đủ (bỏ subpath).
 * Nhận: tên như "@deepseek-ai/dsh-tool-bash" hoặc kèm "/tools".
 * Trả: tên gói gốc.
 */
export function basePackageName(name: string): string {
  const parts = name.split("/");
  return parts.length <= 2 ? name : parts.slice(0, 2).join("/");
}
