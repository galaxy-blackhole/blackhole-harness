/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhúng từ điển tiếng Việt vào các gói DE-BUNDLE (các lát nối thành MỘT phạm vi hàm phẳng nên
 *   KHÔNG import được module): ghi một dòng literal JSON.parse giữa hai dấu gbh-vi-locale.
 *
 * Vì sao phải có script: 4 gói ui-chat · ui-conversation · ui-schedule · ui-trajectory được ghép VĂN BẢN
 * từ các lát của bundle gốc. Một file .ts riêng không thể tham gia vào phạm vi hàm đó, nên từ điển phải
 * nằm NGAY TRONG lát, dưới dạng literal — script này sinh lại literal đó một cách lặp lại được.
 *
 * CÁCH DÙNG:
 *   ~/.bun/bin/bun run tools/locale/embed-vi-parts.ts          # chỉ báo cáo
 *   ~/.bun/bin/bun run tools/locale/embed-vi-parts.ts --write  # ghi lại literal trong lát
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Một điểm nhúng. */
interface Embed {
  /** Thư mục gói. */
  pkg: string;
  /** Lát nguồn (tương đối so với thư mục gói). */
  file: string;
  /** Namespace nguồn trong gbh-locale-vi.json. */
  viNs: string;
  /** Tên hằng sẽ khai trong lát. */
  constName: string;
}

/** Bốn điểm nhúng — mỗi gói de-bundle một file. */
const EMBEDS: readonly Embed[] = [
  { pkg: "ui-chat", file: "src/parts/plugin-surface.ts", viNs: "chat", constName: "UI_CHAT_VI" },
  { pkg: "ui-conversation", file: "src/parts/plugin-surface.ts", viNs: "conversation", constName: "UI_CONVERSATION_VI" },
  { pkg: "ui-schedule", file: "src/parts/plugin-surface.ts", viNs: "schedule.catalog", constName: "UI_SCHEDULE_VI" },
  { pkg: "ui-schedule", file: "src/parts/plugin-surface.ts", viNs: "schedule.manager", constName: "UI_SCHEDULE_MANAGER_VI" },
  { pkg: "ui-trajectory", file: "src/parts/plugin-surface.ts", viNs: "trajectory", constName: "UI_TRAJECTORY_VI" },
];

/** Dấu mở khối sinh tự động. */
const OPEN = "// >>> gbh-vi-locale (SINH TU DONG boi tools/locale/embed-vi-parts.ts — khong sua tay)";
/** Dấu đóng khối sinh tự động. */
const CLOSE = "// <<< gbh-vi-locale";

/** Đọc một file JSON dữ liệu trong tools/locale. */
function readJson(file: string): Record<string, Record<string, string>> {
  return JSON.parse(readFileSync(join(import.meta.dir, file), "utf8")) as Record<string, Record<string, string>>;
}

/** Bản dịch nền (blackhole web). */
const VI = readJson("gbh-locale-vi.json");
/** Bản dịch tay (namespace chưa có trong bản nền + khoá lệch phiên bản). */
const MANUAL = readJson("gbh-locale-vi-manual.json");

/**
 * Gộp bản dịch nền và bản dịch tay của một namespace (tay thắng), sắp theo khoá.
 * Nhận: viNs — tên namespace.
 * Trả: bảng khoá → chuỗi tiếng Việt đã sắp.
 */
function dictionaryFor(viNs: string): Record<string, string> {
  const merged = { ...(VI[viNs] ?? {}), ...(MANUAL[viNs] ?? {}) };
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(merged).sort()) sorted[key] = merged[key] as string;
  return sorted;
}

/**
 * Sinh khối literal cho MỌI lần nhúng của cùng một file (một khối duy nhất, nhiều dòng const).
 * Nhận: embeds — các điểm nhúng trong cùng file.
 * Trả: các dòng của khối (gồm dấu mở/đóng).
 */
function blockOf(embeds: readonly Embed[]): string[] {
  return [
    OPEN,
    ...embeds.map((embed) => "\t\tconst " + embed.constName + " = JSON.parse(" + JSON.stringify(JSON.stringify(dictionaryFor(embed.viNs))) + ");"),
    CLOSE,
  ];
}

/**
 * Thay khối cũ (nếu có) hoặc chèn khối mới ngay SAU dòng mốc đầu tiên của file.
 * Nhận: text — nội dung file; embed — điểm nhúng.
 * Trả: nội dung mới.
 */
function applyEmbed(text: string, embeds: readonly Embed[]): string {
  const lines = text.split(String.fromCharCode(10));
  const begin = lines.findIndex((line) => line.trim() === OPEN);
  if (begin >= 0) {
    const end = lines.findIndex((line, index) => index > begin && line.trim() === CLOSE);
    if (end >= 0) return [...lines.slice(0, begin), ...blockOf(embeds), ...lines.slice(end + 1)].join(String.fromCharCode(10));
  }
  // Chưa có: chèn ngay sau dòng khai CỜ CHỐNG CÀI HAI LẦN của phần gbh (mọi lát đều có dòng này ở đầu
  // khối viết tay); không thấy thì chèn sau dòng #region của phần gbh.
  const anchor = lines.findIndex((line) => /let\s+\w*Installed\s*=\s*false/.test(line));
  const region = lines.findIndex((line) => line.includes("//#region gbh-client-"));
  const at = anchor >= 0 ? anchor + 1 : region >= 0 ? region + 1 : 0;
  return [...lines.slice(0, at), ...blockOf(embeds), ...lines.slice(at)].join(String.fromCharCode(10));
}

/**
 * Điểm vào: nhúng (hoặc chỉ báo cáo) từ điển của bốn gói de-bundle.
 * Nhận: không.
 * Trả: không — in kết quả ra stdout.
 */
function main(): void {
  const write = process.argv.includes("--write");
  const groups = new Map<string, Embed[]>();
  for (const embed of EMBEDS) {
    const key = embed.pkg + "/" + embed.file;
    const list = groups.get(key) ?? [];
    list.push(embed);
    groups.set(key, list);
  }
  for (const [key, embeds] of groups) {
    const file = join(REPO, "packages", "client", key);
    if (!existsSync(file)) {
      console.log("LOI  thieu file " + key);
      continue;
    }
    let text = readFileSync(file, "utf8");
    text = applyEmbed(text, embeds);
    const size = blockOf(embeds).join("").length;
    console.log((write ? "GHI  " : "SE GHI  ") + key + " · " + embeds.length + " từ điển · ~" + size + " byte literal");
    if (write) writeFileSync(file, text);
  }
  console.log(write ? "DA GHI" : "KHONG GHI (thêm --write)");
}

main();
