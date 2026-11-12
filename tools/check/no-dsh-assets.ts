/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cổng N1–N4: không còn asset/thương hiệu DSH trong phần ta sở hữu + asset thương hiệu GBH truy được về nguồn
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { GBH_FAVICON_SOURCE_SHA256, GBH_LOGO_SOURCE_SHA256 } from "../../packages/client/ui-primitives/src/brand.ts";
import { DSH_TO_GBH_ICON } from "../../packages/client/ui-primitives/src/gbh-icon-specs.ts";

/** Gốc repo (tools/check -> repo). */
export const REPO_ROOT = join(import.meta.dir, "..", "..");

/** Tiền tố path của logo cá DSH — dấu hiệu asset thương hiệu DSH còn sót. */
export const FISH_PATH_PREFIX = "M22.9168";

/** Tiền tố path của wordmark "deepseek HARNESS" của DSH. */
export const DSH_WORDMARK_PREFIX = "M68.416 18.2447";

/** Chuỗi thương hiệu DSH hiển thị cho người dùng. */
export const DSH_BRAND_STRING = "DeepSeek Harness";

/** sha256 của favicon DSH (không được xuất hiện trong asset của ta). */
export const DSH_FAVICON_SHA256 = "9e983b4f649c25c6ca0623a50be1a6e705fd8f49f756638b980fa13b40575ab6";

/**
 * Danh sách ĐÓNG các tên icon không có trong sổ GBH mà vẫn xuất hiện trong bundle của ta — kèm lý do.
 * Mọi tên khác lọt vào = cổng ĐỎ (bắt được icon mới chưa khai báo).
 */
export const ICON_TOKEN_ALLOWLIST: Readonly<Record<string, string>> = Object.freeze({
  IconActions: "chỉ có trong CHÚ THÍCH + tên CSS module (MessageIconActions), không phải icon được vẽ",
  IconCalendarOutlineRegular: "icon VIẾT TAY trong ui-schedule (định nghĩa cục bộ, không lấy từ primitives)",
  IconClose: "biến cục bộ alias của primitives.IconCloseOutlineRegular (ui-settings-general)",
});

/** Thư mục gốc được quét cho N1/N2 (phần TA sở hữu; docs/tests/tools được miễn vì là bằng chứng/đo). */
const OWNED_ROOTS = ["packages", "apps/desktop/ui", "profiles"] as const;

/** Đuôi tệp văn bản được quét. */
const TEXT_EXTENSIONS = [".ts", ".tsx", ".css", ".html", ".svg", ".yml", ".yaml"] as const;

/** Một phát hiện của cổng. */
export interface NoDshFinding {
  /** Luật: N1 asset DSH, N2 chuỗi thương hiệu, N3 icon chưa khai, N4 nguồn asset GBH. */
  rule: "N1" | "N2" | "N3" | "N4";
  /** Tệp (tương đối repo) hoặc "(repo)" khi là phát hiện toàn cục. */
  file: string;
  /** Mô tả ngắn. */
  detail: string;
}

/**
 * Duyệt đệ quy một thư mục, bỏ node_modules/.git/dist/target.
 * Nhận: dir — thư mục gốc; exts — đuôi tệp cần lấy.
 * Trả: mảng đường dẫn tuyệt đối của tệp khớp.
 */
export function walkFiles(dir: string, exts: readonly string[]): string[] {
  const out: string[] = [];
  /** Muc trong mot thu muc: chi can ten + co phai thu muc (tranh phu thuoc kieu Dirent cua @types/node). */
  type Entry = { name: string; isDirectory: () => boolean };
  const walk = (at: string): void => {
    let entries: Entry[];
    try {
      entries = readdirSync(at, { withFileTypes: true }) as unknown as Entry[];
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(at, entry.name);
      if (entry.isDirectory()) {
        // 20/10/2026: bỏ thêm `client-parts`/`parts` — đây là LÁT NGUYÊN VĂN của bundle gốc (de-bundle),
        // chứa chuỗi thương hiệu DSH theo đúng thiết kế; id/brand được quy đổi LÚC BUILD nên quét lát là quét sai đối tượng.
        if (["node_modules", ".git", "dist", "target", "lib", "client-parts", "parts"].includes(entry.name)) continue;
        walk(full);
        continue;
      }
      if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * Đọc nội dung văn bản của một tệp, trả chuỗi rỗng khi không đọc được.
 * Nhận: file — đường dẫn tệp.
 * Trả: nội dung văn bản (utf8).
 */
function readText(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * N1 — không còn artwork thương hiệu DSH (fish logo / wordmark) trong phần ta sở hữu.
 * Nhận: root — gốc repo (mặc định REPO_ROOT).
 * Trả: danh sách phát hiện (rỗng = đạt).
 */
export function checkN1(root = REPO_ROOT): NoDshFinding[] {
  const findings: NoDshFinding[] = [];
  for (const rel of OWNED_ROOTS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    for (const file of walkFiles(dir, TEXT_EXTENSIONS)) {
      const text = readText(file);
      if (text.includes(FISH_PATH_PREFIX)) {
        findings.push({ rule: "N1", file: relative(root, file), detail: "còn path fish logo DSH (" + FISH_PATH_PREFIX + "…)" });
      }
      if (text.includes(DSH_WORDMARK_PREFIX)) {
        findings.push({ rule: "N1", file: relative(root, file), detail: "còn wordmark DSH (" + DSH_WORDMARK_PREFIX + "…)" });
      }
    }
  }
  return findings;
}

/**
 * N2 — không còn chuỗi thương hiệu "DeepSeek Harness" trong nguồn UI của ta (locale/asset/HTML).
 * Nhận: root — gốc repo.
 * Trả: danh sách phát hiện (rỗng = đạt).
 */
export function checkN2(root = REPO_ROOT): NoDshFinding[] {
  const findings: NoDshFinding[] = [];
  for (const rel of OWNED_ROOTS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    for (const file of walkFiles(dir, TEXT_EXTENSIONS)) {
      const text = readText(file);
      if (!text.includes(DSH_BRAND_STRING)) continue;
      const count = text.split(DSH_BRAND_STRING).length - 1;
      findings.push({ rule: "N2", file: relative(root, file), detail: "còn chuỗi thương hiệu DSH x" + String(count) });
    }
  }
  return findings;
}

/**
 * N3 — mọi tên icon trong bundle client phải có trong sổ GBH, ngoại trừ danh sách ĐÓNG có lý do.
 * Nhận: root — gốc repo.
 * Trả: danh sách phát hiện (rỗng = đạt).
 */
export function checkN3(root = REPO_ROOT): NoDshFinding[] {
  const findings: NoDshFinding[] = [];
  const known = new Set(Object.keys(DSH_TO_GBH_ICON));
  const clientRoot = join(root, "packages", "client");
  if (!existsSync(clientRoot)) return findings;
  for (const pkg of readdirSync(clientRoot)) {
    const file = join(clientRoot, pkg, "lib", "client.js");
    if (!existsSync(file)) continue;
    const text = readText(file);
    for (const match of text.matchAll(/\bIcon[A-Z][A-Za-z0-9]+\b/g)) {
      const token = match[0];
      if (known.has(token) || ICON_TOKEN_ALLOWLIST[token] !== undefined) continue;
      findings.push({ rule: "N3", file: relative(root, file), detail: "icon chưa khai trong sổ GBH: " + token });
    }
  }
  return findings;
}

/**
 * N4 — asset thương hiệu GBH trong repo phải khớp sha256 nguồn; không được có favicon DSH.
 * Nhận: root — gốc repo.
 * Trả: danh sách phát hiện (rỗng = đạt).
 */
export function checkN4(root = REPO_ROOT): NoDshFinding[] {
  const findings: NoDshFinding[] = [];
  const logo = join(root, "packages", "client", "ui-primitives", "assets", "gbh-logo.svg");
  const favicon = join(root, "packages", "client", "ui-primitives", "assets", "gbh-favicon.svg");
  const cases: { file: string; expected: string; label: string }[] = [
    { file: logo, expected: GBH_LOGO_SOURCE_SHA256, label: "gbh-logo.svg" },
    { file: favicon, expected: GBH_FAVICON_SOURCE_SHA256, label: "gbh-favicon.svg" },
  ];
  for (const item of cases) {
    if (!existsSync(item.file)) {
      findings.push({ rule: "N4", file: relative(root, item.file), detail: "thiếu asset " + item.label });
      continue;
    }
    const digest = createHash("sha256").update(readFileSync(item.file)).digest("hex");
    if (digest !== item.expected) {
      findings.push({ rule: "N4", file: relative(root, item.file), detail: "sha256 " + digest.slice(0, 12) + "… != nguồn " + item.expected.slice(0, 12) + "…" });
    }
  }
  // Không được có BẢN SAO favicon DSH trong phần ta sở hữu (dù đổi tên).
  for (const rel of OWNED_ROOTS) {
    const dir = join(root, rel);
    if (!existsSync(dir)) continue;
    for (const file of walkFiles(dir, [".svg", ".png", ".ico", ".icns"])) {
      const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
      if (digest === DSH_FAVICON_SHA256) findings.push({ rule: "N4", file: relative(root, file), detail: "là bản sao favicon DSH" });
    }
  }
  return findings;
}

/**
 * Chạy cả 4 luật và gom phát hiện.
 * Nhận: root — gốc repo.
 * Trả: { findings, status } — danh sách phát hiện và trạng thái từng luật.
 */
export function runNoDshAssets(root = REPO_ROOT): {
  findings: NoDshFinding[];
  status: Record<"N1" | "N2" | "N3" | "N4", number>;
} {
  const findings = [...checkN1(root), ...checkN2(root), ...checkN3(root), ...checkN4(root)];
  const status: Record<"N1" | "N2" | "N3" | "N4", number> = { N1: 0, N2: 0, N3: 0, N4: 0 };
  for (const finding of findings) status[finding.rule] += 1;
  return { findings, status };
}

if (import.meta.main) {
  const { findings, status } = runNoDshAssets();
  console.log("N1 asset DSH      : " + String(status.N1) + " phát hiện");
  console.log("N2 chuỗi thương hiệu: " + String(status.N2) + " phát hiện");
  console.log("N3 icon chưa khai : " + String(status.N3) + " phát hiện");
  console.log("N4 nguồn asset    : " + String(status.N4) + " phát hiện");
  for (const finding of findings.slice(0, 40)) console.log("  [" + finding.rule + "] " + finding.file + " — " + finding.detail);
  if (findings.length > 40) console.log("  … còn " + String(findings.length - 40) + " phát hiện");
  console.log("KẾT LUẬN: " + (findings.length === 0 ? "ĐẠT" : "CHƯA ĐẠT (" + String(findings.length) + " phát hiện)"));
  process.exit(findings.length === 0 ? 0 : 1);
}
