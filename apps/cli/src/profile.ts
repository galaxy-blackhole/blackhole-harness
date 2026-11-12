/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Seed profile cua app trong ~/.galaxy/blackhole/profiles + sinh patch ghim credentials dung chung
 *      11/11/2026: bundleDefinedNames() dung repoRoot() thay import.meta.dir (chay duoc bang Node)
 *      12/11/2026: writeAppPatch() chi GHI khi no dung doi (stamp .gbh-app-patch-stamp)
 *      12/11/2026: readKernelBundlePatches() doc kernel qua kernelModulesDir() (ban npm khong co apps/host)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { renderRewriteBlock } from "./rewrite-metadata.ts";
import type { MountResult } from "./mount.ts";
import {
  DEFAULT_PROFILE,
  appPatchPath,
  appPatchStampPath,
  credentialsPath,
  kernelModulesDir,
  parityTemplatePath,
  profileDir,
  profileTemplateDir,
  repoAppPatchPath,
  repoRoot,
} from "./paths.ts";

/**
 * Bundles the app profile mounts, in composition order. This mirrors the bundle list of the
 * running blackhole web install, so `bh host --dump-config` composes the same rows as the oracle.
 */
/**
 * Bundle tính năng (mỗi tính năng thử nghiệm một bundle) mà hồ sơ MỚI nhận sẵn — nhờ vậy chúng
 * hiện trong *Plugin thử nghiệm* ở trạng thái BẬT và tắt được thật (row do chính bundle đó cắm,
 * không còn nằm trong bundle lõi). Hồ sơ đã tồn tại KHÔNG bị thêm lại: người dùng tắt là tắt luôn.
 * `voice-input` cố ý không có trong danh sách (mặc định TẮT như bản DSH).
 */
export const DEFAULT_FEATURE_BUNDLES: readonly string[] = [
  "@galaxy-blackhole/gbh-plugin-market-bundle",
  "@galaxy-blackhole/gbh-terminal-bundle",
  "@galaxy-blackhole/gbh-session-search",
  "@galaxy-blackhole/gbh-inspector-profile",
  "@galaxy-blackhole/gbh-agent-team-profile",
  "@galaxy-blackhole/gbh-auto-review-bundle",
  "@galaxy-blackhole/gbh-tool-worktree-bundle",
  "@galaxy-blackhole/gbh-badge-skill-bundle",
  "@galaxy-blackhole/gbh-cot-translation-bundle",
  "@galaxy-blackhole/gbh-ralph-bundle",
  "@galaxy-blackhole/gbh-session-titles-bundle",
];

export const APP_PROFILE_BUNDLES: readonly string[] = [
  // 21/10/2026 (task-195) — CHUYEN SANG CACH DSH LAM: bundle patch cua TA (packages/host/bundle) dinh nghia row
  // voi id STOCK + name goi ta. Truoc day ta mount bang "disable row stock + insert <id>-ours" trong app.patch.yml,
  // nhung tang patch cua DSH KHONG cho doi "name" (applyEntryPatches: name mismatch -> skip) nen id row bi lech;
  // moi thu tra theo id (settings/config/slot/typert) deu truot: "Could not save", thieu dong Permission,
  // preset cordis do. Bundle cua ta sinh tu 17 tep patch cua stock, giu nguyen id/order/disabled/config.
  "@galaxy-blackhole/gbh-bundle",
];

/** What `ensureProfile` did to the app home on this boot. */
export interface ProfileSeed {
  /** Absolute profile directory under the app home. */
  dir: string;
  /** Files written because they did not exist yet. */
  created: string[];
  /** Files rewritten because their bundle list drifted from this build's intent. */
  updated: string[];
  /** Files left exactly as they were. */
  reused: string[];
  /** Bundle list the profile now declares. */
  bundles: string[];
}

/** The pnpm workspace file the harness's own profile initializer writes; kept for plugin installs. */
const PNPM_WORKSPACE = "packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n";

/**
 * Expands a leading `~` inside quoted YAML scalars so a template can stay portable while the
 * seeded file carries the absolute path the harness needs.
 * @param text - template text.
 * @param home - the operating-system home used for the expansion.
 * @returns the text with `"~/..."` and `"~"` scalars replaced.
 */
export function expandTildeInScalars(text: string, home: string): string {
  return text.replace(/(["'])(~[^"']*)\1/gu, (_match, quote: string, scalar: string) => {
    const suffix = scalar.startsWith("~/") ? scalar.slice(2) : "";
    return `${quote}${suffix === "" ? home : join(home, suffix)}${quote}`;
  });
}

/**
 * Reads one profile template file from this repo.
 * @param file - file name inside `profiles/<name>`.
 * @returns the template text, or undefined when this checkout has no such file.
 */
function readTemplate(file: string): string | undefined {
  try {
    return readFileSync(join(profileTemplateDir(), file), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Seeds and reconciles the app-owned profile under the app home.
 *
 * The profile belongs to the app, not to the person: `cordis.yml` is always the empty entry list,
 * `cordis.patch.yml` is seeded once and then owned by the person, and `package.json` has its
 * `dsh.profile.bundles` reconciled with {@link APP_PROFILE_BUNDLES} on every boot. Composition
 * changes therefore ship with the app, while per-person tuning stays in the patch layer.
 * @param name - profile name; defaults to `blackhole`.
 * @returns what was created, updated and reused, plus the effective bundle list.
 */
export function ensureProfile(name: string = DEFAULT_PROFILE): ProfileSeed {
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true });
  const created: string[] = [];
  const updated: string[] = [];
  const reused: string[] = [];

  const cordisPath = join(dir, "cordis.yml");
  if (!existsSync(cordisPath)) {
    writeFileSync(cordisPath, readTemplate("cordis.yml") ?? "# dsh profile root — an empty entry list.\n[]\n");
    created.push("cordis.yml");
  } else {
    reused.push("cordis.yml");
  }

  const patchPath = join(dir, "cordis.patch.yml");
  if (!existsSync(patchPath)) {
    const template = readTemplate("cordis.patch.yml");
    writeFileSync(patchPath, template === undefined ? "[]\n" : expandTildeInScalars(template, homedir()));
    created.push("cordis.patch.yml");
  } else {
    reused.push("cordis.patch.yml");
  }

  const manifestPath = join(dir, "package.json");
  const manifest = ((): Record<string, unknown> => {
    try {
      return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const declared = ((manifest.dsh as { profile?: { bundles?: unknown } } | undefined)?.profile?.bundles ?? []) as unknown;
  const current = Array.isArray(declared) ? declared.map(String) : [];
  // ⚠️ 18/10/2026 — SUA CHO GIONG DSH (lo hong G1). Truoc day dong nay GHI DE danh sach bundle
  //   moi lan boot bang hang so APP_PROFILE_BUNDLES => KHONG co duong nao cai plugin ngoai.
  //   DSH (dsh-app-boot initProfile) CHI ghi package.json KHI CHUA TON TAI, va lenh
  //   dsh plugin --profile <n> add <pkg> di qua pnpm de cai that. Nay ta: (1) HOP entry nguoi
  //   dung da them (khong xoa), (2) doc them file nguoi dung extra-bundles.json.
  const extra = ((): string[] => {
    try {
      const raw = readFileSync(join(dir, "extra-bundles.json"), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();
  // 21/10/2026 (task-195): bundle cua ta THAY THE cac bundle stock ⇒ bo chung khoi danh sach de khong nap
  // hai lan (DSH: bundle sau ghi de row truoc theo id; nap ca hai thi row stock quay lai va id lai lech).
  const dungBundleTa = APP_PROFILE_BUNDLES.some((ten) => ten.startsWith("@galaxy-blackhole/"));
  // 25/10/2026 — CỨU bundle stock do người dùng CÀI THẬT (pnpm) khỏi bị lọc: trước đây mọi tên
  // `@deepseek-ai/dsh-*` bị bỏ ⇒ cài "Claude Code (agent con)" / "Codex (agent con)" xong, boot sau
  // danh sách bundle bị ghi lại và hai bundle biến mất (row không nạp, công tắc về TẮT).
  // Chỉ lọc các bundle stock mà TA ĐÃ THAY THẾ; bundle stock chưa có bản port thì giữ nguyên.
  const BUNDLE_STOCK_CON_GIU: ReadonlySet<string> = new Set([
    "@deepseek-ai/dsh-subagent-claude-code",
    "@deepseek-ai/dsh-subagent-codex",
  ]);
  const giuLai = dungBundleTa
    ? current.filter((ten) => !ten.startsWith("@deepseek-ai/dsh-") || BUNDLE_STOCK_CON_GIU.has(ten))
    : current;
  // 25/10/2026 (ADR 0026) — hồ sơ MỚI nhận thêm bundle tính năng (mặc định BẬT, tắt được thật);
  // hồ sơ ĐÃ TỒN TẠI chỉ reconcile về danh sách lõi, không thêm lại thứ người dùng đã tắt.
  const bundles = existsSync(manifestPath)
    ? [...new Set([...APP_PROFILE_BUNDLES, ...giuLai, ...extra])]
    : [...new Set([...APP_PROFILE_BUNDLES, ...DEFAULT_FEATURE_BUNDLES, ...extra])];
  if (!existsSync(manifestPath)) {
    writeFileSync(manifestPath, JSON.stringify(manifestOf(name, manifest, bundles), null, 2) + "\n");
    created.push("package.json");
  } else if (current.join("\n") !== bundles.join("\n")) {
    writeFileSync(manifestPath, JSON.stringify(manifestOf(name, manifest, bundles), null, 2) + "\n");
    updated.push("package.json");
  } else {
    reused.push("package.json");
  }

  const workspacePath = join(dir, "pnpm-workspace.yaml");
  if (!existsSync(workspacePath)) {
    writeFileSync(workspacePath, PNPM_WORKSPACE);
    created.push("pnpm-workspace.yaml");
  } else {
    reused.push("pnpm-workspace.yaml");
  }

  return { dir, created, updated, reused, bundles };
}

/**
 * Builds the profile manifest, preserving every field the person or the harness added.
 * @param name - profile name used for the package name.
 * @param manifest - the manifest read from disk, possibly empty.
 * @param bundles - the bundle list this build declares.
 * @returns the manifest to write.
 */
function manifestOf(name: string, manifest: Record<string, unknown>, bundles: string[]): Record<string, unknown> {
  const dsh = (manifest.dsh ?? {}) as Record<string, unknown>;
  return {
    ...manifest,
    name: `gbh-profile-${name}`,
    private: true,
    dependencies: manifest.dependencies ?? {},
    dsh: { ...dsh, profile: { ...(dsh.profile as Record<string, unknown> | undefined), bundles } },
  };
}


/** Tên khối brand trong template parity. */
const BRAND_BLOCK = "brand-galaxy";

/**
 * Đọc template ngữ nghĩa patch của oracle.
 * @returns nội dung file, hoặc chuỗi rỗng khi checkout này chưa có template.
 */
/**
 * Đọc các BUNDLE PATCH của kernel: package có `dsh.bundle.patch` trong manifest (vd
 * `@deepseek-ai/dsh-experimental-session-search` khai `./cordis.patch.yml`) — nơi THẬT SỰ chứa các row nhóm.
 * Vì sao cần: `profiles/blackhole/parity.patch.yml` KHÔNG chứa row nhóm nào (đo 19/10/2026: 0 khớp) ⇒ nếu chỉ tìm ở đó
 * thì `renderGroupRewriteBlocks` luôn fail-soft và tool con không bao giờ tới agent.
 * FAIL-SOFT: thiếu thư mục/JSON hỏng/không đọc được file ⇒ bỏ qua, không ném.
 * Nhận: không. Trả: danh sách văn bản patch (theo thứ tự đọc được).
 */
export function readKernelBundlePatches(): string[] {
  const out: string[] = [];
  // 12/11/2026 — bản npm: kernel nằm ở thư mục node_modules của chính gói, nên dùng helper thay đường dẫn cứng.
  const kernel = join(kernelModulesDir(), "@deepseek-ai");
  if (!existsSync(kernel)) return out;
  let entries: string[];
  try {
    entries = readdirSync(kernel).sort();
  } catch {
    return out;
  }
  for (const name of entries) {
    const manifestPath = join(kernel, name, "package.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { dsh?: { bundle?: { patch?: unknown } } };
      const patch = manifest.dsh?.bundle?.patch;
      if (typeof patch !== "string" || patch.trim() === "") continue;
      const patchPath = join(kernel, name, patch);
      if (!existsSync(patchPath)) continue;
      out.push(readFileSync(patchPath, "utf8"));
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * Đọc template patch của oracle (`profiles/blackhole/parity.patch.yml`) — lớp patch nghĩa sản phẩm.
 * Nhận: không. Trả: văn bản template, hoặc chuỗi rỗng khi thiếu tệp (fail-soft).
 */
export function readParityTemplate(): string {
  try {
    return readFileSync(parityTemplatePath(), "utf8");
  } catch {
    return "";
  }
}

/**
 * Đọc lớp patch PHỤ `profiles/blackhole/preset-redirect.patch.yml` (task-173) — do package `agent-preset` sinh
 * từ `gbh.nested` + preset stock, để cây config offline (và Sổ cài đặt → Plugin) mang id GBH thay vì id stock.
 * Nhận: không. Trả: thân patch đã bỏ header (hoặc chuỗi rỗng khi thiếu tệp ⇒ fail-soft, app vẫn boot).
 */
export function readPresetRedirectPatch(): string {
  try {
    const text = readFileSync(join(profileTemplateDir(), "preset-redirect.patch.yml"), "utf8");
    return text
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join("\n")
      .trim();
  } catch {
    return "";
  }
}

/**
 * Bỏ 5 dòng header của template để file sinh ra chỉ có một header.
 * @param text - nội dung template.
 * @returns nội dung không còn dòng `# author`/`# email`/`# create date`/`# modify date`/`# desc` đầu file.
 */
export function stripTemplateHeader(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^#\s(?:author|email|create date|modify date|desc)\b/u.test(line))
    .join("\n");
}

/**
 * Giữ hoặc bỏ một khối có dấu `# >>> <tên>` … `# <<< <tên>` trong template (kể cả dấu).
 * @param text - nội dung template.
 * @param name - tên khối, ví dụ `brand-galaxy` hay `webserver-ours`.
 * @param keep - true để giữ các dòng bên trong, false để bỏ cả khối.
 * @returns nội dung đã lọc.
 */
export function selectBlock(text: string, name: string, keep: boolean): string {
  const open = "# >>> " + name;
  const close = "# <<< " + name;
  const lines: string[] = [];
  let inside = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === open) {
      inside = true;
      continue;
    }
    if (trimmed === close) {
      inside = false;
      continue;
    }
    if (!inside || keep) lines.push(line);
  }
  return lines.join("\n");
}

/**
 * Giữ hoặc bỏ khối `brand-galaxy`.
 * @param text - nội dung template.
 * @param keep - true để giữ khối.
 * @returns nội dung đã lọc.
 */
export function selectBrandBlock(text: string, keep: boolean): string {
  return selectBlock(text, BRAND_BLOCK, keep);
}

/** Một khai báo row lồng: gói stock nào được thay bằng specifier nào. */
export interface NestedRedirect {
  /** id gói stock đang nằm trong row nhóm (khớp CHÍNH XÁC chuỗi `name`). */
  readonly stockId: string;
  /** specifier của gói ta sẽ thay vào. */
  readonly specifier: string;
  /**
   * Loại row lồng: `preset` (plugin trong `config.plugins` của PRESET — registry redirect xử lý lúc mount) hay
   * `group` (con của row `cordis:group` — phải sinh khối patch ở đây). Mặc định `preset` để tương thích ngược.
   */
  readonly kind?: "preset" | "group";
}

/** Kết quả sinh khối patch cho row NHÓM (ADR 0011). */
export interface GroupRewriteResult {
  /** Các khối patch, mỗi khối thay MỘT row nhóm. */
  readonly blocks: string[];
  /** Cảnh báo FAIL-SOFT: khai `gbh.nested` mà không tìm thấy row nhóm tương ứng. */
  readonly warnings: string[];
}

/**
 * Độ thụt lề (số dấu cách) của một dòng YAML.
 * Nhận: dòng văn bản.
 * Trả: số dấu cách đứng đầu.
 */
function indentOf(line: string): number {
  return line.length - line.replace(/^ +/u, "").length;
}

/**
 * Tìm dòng bắt đầu ROW (`- id: …`) BAO QUANH một dòng con, theo ĐỘ THỤT LỀ.
 * Nhận: các dòng của văn bản, chỉ số dòng con.
 * Trả: chỉ số dòng tổ tiên gần nhất có thụt lề NHỎ HƠN, hoặc -1.
 */
function enclosingGroupStart(lines: readonly string[], childIndex: number): number {
  const childIndent = indentOf(lines[childIndex] ?? "");
  for (let i = childIndex - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? "";
    if (!/^\s*- id:/u.test(line)) continue;
    const candidateIndent = indentOf(line);
    if (candidateIndent >= childIndent) continue;
    // Phạm vi khối của ứng viên: tới dòng CÓ NỘI DUNG đầu tiên có thụt lề <= ứng viên.
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      const inner = lines[j] ?? "";
      if (/\S/u.test(inner) && indentOf(inner) <= candidateIndent) {
        end = j;
        break;
      }
    }
    // Điều kiện QUYẾT ĐỊNH: dòng con phải NẰM TRONG khối của ứng viên. Chỉ "đứng trước + thụt lề nhỏ hơn" là
    // KHÔNG đủ — sẽ nhận nhầm row đứng TRƯỚC (đã gặp: row top-level `optional-session-search` bị coi là cha của
    // một row top-level khác đứng sau nó).
    if (childIndex >= end) continue;
    const block = lines.slice(i, end);
    if (block.some((entry) => entry.trim() === "group: true" || entry.trim() === "name: cordis:group")) return i;
  }
  return -1;
}

/**
 * Sinh khối patch cho các row NHÓM (`cordis:group`) có con cần thay (task-114 / ADR 0011).
 *
 * Với mỗi `stockId`, tìm dòng `name: '<stockId>'` trong văn bản profile, truy ngược ROW CHA theo thụt lề; nếu
 * cha đúng là nhóm (`group: true` hoặc `name: cordis:group`) thì sinh khối: tắt row nhóm
 * (`- id: <groupId>` + `disabled: true`) rồi `- insert:` một BẢN SAO nhóm (`name: 'cordis:group'`) đã viết lại
 * `name` của con. Mọi dòng khác của nhóm (`group: true`, `isolate`, `config`) được GIỮ NGUYÊN.
 * Fail-soft: không tìm thấy nhóm, hoặc cha không phải nhóm ⇒ chỉ cảnh báo, KHÔNG ném.
 * Nhận: văn bản profile (template hoặc patch gốc) và danh sách redirect.
 * Trả: `{ blocks, warnings }`.
 */
export function renderGroupRewriteBlocks(
  text: string,
  nested: readonly NestedRedirect[],
): GroupRewriteResult {
  return renderGroupRewriteBlocksFrom([text], nested);
}

/**
 * Như `renderGroupRewriteBlocks` nhưng nhận NHIỀU nguồn văn bản (parity template + các bundle patch của kernel).
 * Vì sao cần: row nhóm có thể KHÔNG nằm trong `profiles/blackhole/parity.patch.yml` mà do một BUNDLE PATCH của kernel
 * chèn (vd `@deepseek-ai/dsh-experimental-session-search/cordis.patch.yml`, khai `dsh.bundle.patch`). Đo 19/10/2026:
 * tìm trong parity template ⇒ 0 khớp ⇒ không sinh được khối ⇒ tool con không tới được agent.
 * Nhận: sources — các văn bản nguồn (theo thứ tự ưu tiên); nested — danh sách redirect.
 * Trả: `{ blocks, warnings }`; chỉ xét redirect có `kind === "group"`.
 */
export function renderGroupRewriteBlocksFrom(
  sources: readonly string[],
  nested: readonly NestedRedirect[],
): GroupRewriteResult {
  const groupNested = nested.filter((entry) => entry.kind === "group");
  if (groupNested.length === 0) return { blocks: [], warnings: [] };
  const merged = sources.filter((text) => text.trim() !== "").join(String.fromCharCode(10));
  if (merged.trim() === "") return { blocks: [], warnings: groupNested.map((entry) => "khong co nguon van ban nao de tim " + entry.stockId) };
  const ketQua = renderGroupRewriteBlocksSingle(merged, groupNested);
  return ketQua;
}

/**
 * Phần lõi (một nguồn đã gộp) — tách riêng để hàm cũ giữ nguyên chữ ký và hành vi.
 * Nhận: text — văn bản nguồn đã gộp; nested — CHỈ các redirect kind 'group'.
 * Trả: `{ blocks, warnings }`.
 */
function renderGroupRewriteBlocksSingle(
  text: string,
  nested: readonly NestedRedirect[],
): GroupRewriteResult {
  const lines = text.split(String.fromCharCode(10));
  const warnings: string[] = [];
  /** Một row nhóm đã gom: nhiều gói ta cùng nằm trong MỘT group ⇒ chỉ phát MỘT khối insert. */
  interface GroupBucket {
    readonly groupId: string;
    readonly groupBaseIndent: number;
    readonly groupLines: readonly string[];
    readonly targets: { readonly stockId: string; readonly specifier: string }[];
  }
  const buckets = new Map<string, GroupBucket>();
  const handledStock = new Set<string>();
  // Pha (a): quét MỌI redirect kind 'group'. MỘT stockId có thể xuất hiện trong NHIỀU nhóm (vd dsh-terminal
  // nằm ở `persistent-shell` và `optional-persistent-terminals`) ⇒ gom target vào bucket của TỪNG nhóm chứa nó.
  for (const redirect of nested) {
    if (handledStock.has(redirect.stockId)) continue;
    const quoted = ["name: '" + redirect.stockId + "'", 'name: "' + redirect.stockId + '"'];
    const childIndexes = lines.flatMap((line, index) => (quoted.some((needle) => line.trim() === needle) ? [index] : []));
    if (childIndexes.length === 0) {
      warnings.push("khong thay dong name cua " + redirect.stockId + " trong profile ⇒ bo qua (fail-soft)");
      continue;
    }
    let matched = 0;
    for (const childIndex of childIndexes) {
      const groupIndex = enclosingGroupStart(lines, childIndex);
      if (groupIndex === -1) continue;
      const groupLine = (lines[groupIndex] ?? "").trim();
      const groupId = groupLine.replace(/^- id:\s*/u, "").trim();
      const groupBaseIndent = indentOf(lines[groupIndex] ?? "");
      const existing = buckets.get(groupId);
      if (existing === undefined) {
        const groupIndent = indentOf(lines[groupIndex] ?? "");
        // Kết thúc khối = dòng CÓ NỘI DUNG đầu tiên có thụt lề <= nhóm (comment `# == …` ở thụt lề 0 cũng kết thúc khối).
        let groupBlockEnd = lines.length;
        for (let k = groupIndex + 1; k < lines.length; k += 1) {
          const line = lines[k] ?? "";
          if (/\S/u.test(line) && indentOf(line) <= groupIndent) { groupBlockEnd = k; break; }
        }
        const groupLines = lines.slice(groupIndex, groupBlockEnd);
        const isGroup = groupLines.some((line) => line.trim() === "group: true" || line.trim() === "cordis:group");
        if (!isGroup) {
          warnings.push("row cha cua " + redirect.stockId + " (" + groupId + ") khong phai cordis:group ⇒ bo qua (fail-soft)");
          continue;
        }
        buckets.set(groupId, { groupId, groupBaseIndent, groupLines, targets: [{ stockId: redirect.stockId, specifier: redirect.specifier }] });
      } else if (!existing.targets.some((target) => target.stockId === redirect.stockId)) {
        existing.targets.push({ stockId: redirect.stockId, specifier: redirect.specifier });
      }
      matched += 1;
    }
    if (matched === 0) {
      warnings.push("khong thay row cha cua " + redirect.stockId + " ⇒ bo qua (fail-soft)");
      continue;
    }
    handledStock.add(redirect.stockId);
  }
  // Pha (b): mỗi group phát ĐÚNG MỘT khối — thay TẤT CẢ stockId thuộc nhóm, giữ thụt lề tương đối + isolate/config.
  const blocks: string[] = [];
  for (const bucket of buckets.values()) {
    const names = new Map<string, string>();
    for (const target of bucket.targets) {
      names.set("name: '" + target.stockId + "'", target.specifier);
      names.set('name: "' + target.stockId + '"', target.specifier);
    }
    const rewritten = bucket.groupLines.map((line) => {
      const target = names.get(line.trim());
      if (target === undefined) return line;
      return line.replace(/name:\s*['"]?[^'"]+['"]?/u, "name: '" + target + "'");
    });
    const tail = rewritten.slice(1).map((line) => {
      if (line.trim() === "") return "";
      const lech = indentOf(line) - bucket.groupBaseIndent;
      return " ".repeat(Math.max(6, 6 + (lech - 2))) + line.trimStart();
    });
    blocks.push(
      [
        "# Thay row NHOM " + bucket.groupId + " — con " + bucket.targets.map((t) => t.stockId).join(" · ") + " ⇒ gói ta (ADR 0011)",
        "- id: " + bucket.groupId,
        "  disabled: true",
        "",
        "- insert:",
        "    - id: " + bucket.groupId + "-ours",
        ...tail,
      ].join(String.fromCharCode(10)),
    );
  }
  return { blocks, warnings };
}

/**
 * Sinh app patch: khối brand (tuỳ chọn) + khối thay row từ metadata từng package + khối thay row NHÓM (nested).
 * Nhận: options — brand?: boolean (có chèn khối brand), rewrites?: kết quả mount (nguồn khối thay row).
 * Trả: đường dẫn file patch đã ghi.
 */
/**
 * Writes the app's own `--patch` overlay — the last layer applied, so it decides the product
 * semantics for the whole app: the oracle's M1a rows (provider `auto`, brand, telemetry, feedback),
 * the Galaxy brand block, and the shared credentials document. It is regenerated on every boot, is
 * written both into the app home and into the repo copy parity reads, and never holds a secret:
 * only paths and environment-variable names.
 * @param options - `brand: false` / `webserver: false` forces a substitution block out (used when the
 * package cannot resolve or build), keeping the stock DSH row instead.
 * @returns absolute path of the runtime patch file in the app home.
 */
// ============================================================================================
// CHUA DUNG DUOC (ghi ngay 17/10/2026, de nguoi sau khong viet lai y het):
//
// (a) Ham spliceAfterRow + truong metadata insertAfter HIEN KHONG duoc dung: khong row nao khai.
// (b) LY DO no khong chay duoc o tang nay: moc insertAfter (vi du row ui-brand-official) NAM O PATCH GOC
//     CUA APP, do harness ghep vao luc BOOT - no KHONG co trong van ban ma writeAppPatch sinh ra.
//     Vi vay spliceAfterRow khong tim thay id dich, roi vao nhanh thoai hoa (tra nguyen van ban),
//     va khoi cua row do BI ROI KHOI PATCH. Da do duoc: patch home tam chi 28 row, khong co gbh-brand;
//     parity nhay sang THIEU 1 - DOI 1 va luot boot sau se mat brand Galaxy. Da revert ngay.
// (c) Muon khop thu tu THAT thi phai tac dong SAU KHI BOOT (len file cuoi cung trong <home>/) hoac dung
//     mot co che khac cua harness de kiem soat vi tri row. Day la viec can THIET KE + LAB + CUA SO RESTART,
//     khong phai mot sua doi nho. Con so doi chieu: oracle dat gbh-brand o vi tri 204, ta o 220.
// ============================================================================================
/**
 * Chen mot khoi patch ngay SAU row co id cho truoc (task-17: khop thu tu row voi oracle).
 *
 * Chi dung cho row co khai gbh.row.insertAfter; moi row khac giu nguyen hanh vi (noi vao cuoi).
 * @param text - van ban patch day du.
 * @param rowId - id cua row ma khoi se duoc chen ngay sau.
 * @param block - van ban khoi (da trimEnd).
 * @returns van ban moi; neu khong tim thay rowId thi tra ve nguyen ban (thoai hoa an toan).
 */
function spliceAfterRow(text: string, rowId: string, block: string): string {
  const lines = text.split(String.fromCharCode(10));
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start === -1) return text;
  let end = start + 1;
  while (end < lines.length && !(lines[end] ?? "").startsWith("- id:")) end += 1;
  return [...lines.slice(0, end), "", ...block.split(String.fromCharCode(10)), ...lines.slice(end)].join(String.fromCharCode(10));
}
/**
 * Sinh NOI DUNG file app patch: khoi template (co the bo khoi brand) + moi khoi thay row do
 * metadata cua tung package sinh ra. Ham THUAN (khong ghi file) — noi goi tu quyet dinh ghi o dau.
 * @param options - `brand`: co giu khoi brand trong template khong; `rewrites`: ket qua mount cua tung package.
 * @returns van ban patch day du de ghi vao `<home>/app.patch.yml`.
 */
/**
 * Doc TAT CA ten goi duoc bundle cua ta dinh nghia (dsh.bundle.patch trong packages/host/bundle).
 * Nhan: khong. Tra: tap specifier (vd '@galaxy-blackhole/gbh-tool-schedule') de bo cac khoi patch row trung.
 */
export function bundleDefinedNames(): Set<string> {
  const ten = new Set<string>();
  // 11/11/2026 — dung repoRoot() (Bun/Node deu dung) thay import.meta.dir: Node khong co import.meta.dir.
  const goc = join(repoRoot(), "packages", "host", "bundle");
  if (!existsSync(goc)) return ten;
  const duyet = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const duong = join(dir, entry.name);
      if (entry.isDirectory()) {
        duyet(duong);
        continue;
      }
      if (!entry.name.endsWith(".yml")) continue;
      for (const m of readFileSync(duong, "utf8").matchAll(new RegExp("name: '([^']+)'", "gu"))) ten.add(String(m[1]));
    }
  };
  duyet(goc);
  return ten;
}

/**
 * Sinh file patch cua app (lop patch cua profile) tu metadata cac goi da mount.
 * Nhan: options.brand — co chen khoi brand khong; options.rewrites — ket qua mount kem gbh.row tung goi.
 * Tra: duong dan file patch vua ghi (de truyen cho harness qua --patch).
 */
export function writeAppPatch(options: { brand?: boolean; rewrites?: readonly MountResult[] } = {}): string {
  const brand = options.brand ?? false;
  // 21/10/2026 (task-195): goi nao DA duoc bundle cua ta dinh nghia row thi KHONG sinh khoi disable+insert nua —
  // row do da co san voi id stock, dung y DSH. Chi cac row NGOAI bundle moi can patch.
  const trongBundle = bundleDefinedNames();
  const body = selectBlock(stripTemplateHeader(readParityTemplate()), BRAND_BLOCK, brand).trim();
  // Khoi thay row duoc SINH TU METADATA cua tung package (task-13): them mot package = tao thu muc,
  // khong sua file dung chung nao. Mount that bai (hoac GBH_DISABLE_REWRITES=1) => khong co khoi nao.
  const extraBlocks = (options.rewrites ?? [])
    .filter((mount) => mount.ok && mount.row !== undefined)
    .filter((mount) => !trongBundle.has(mount.specifier))
    .map((mount) => {
      const row = mount.row as NonNullable<MountResult["row"]>;
      const block = renderRewriteBlock(mount.specifier, row);
      // 25/10/2026 — row do bundle tính năng cắm: không phát khối (bundle patch là nguồn duy nhất).
      if (block.trim() === "") return "";
      return (
        "# Thay row " + row.id + " — metadata trong package.json cua " + mount.specifier + " (ADR 0004 §11)" +
        "\n" +
        block.trimEnd()
      );
    });
  // task-114 / ADR 0011: khối thay row NHÓM — con của `cordis:group` (vd `optional-session-search`).
  const nested: NestedRedirect[] = (options.rewrites ?? [])
    .filter((mount) => mount.ok)
    .filter((mount) => !trongBundle.has(mount.specifier))
    .filter((mount) => !trongBundle.has(mount.specifier))
    .flatMap((mount) => {
      try {
        const manifest = JSON.parse(readFileSync(join(mount.dir, "package.json"), "utf8")) as {
          gbh?: { nested?: { stockId?: unknown; kind?: unknown } };
        };
        const stockId = manifest.gbh?.nested?.stockId;
        if (typeof stockId !== "string" || stockId === "") return [];
        // 19/10/2026 — ADR 0011 §7: chỉ mục kind='group' mới cần khối patch ở đây; mục 'preset' (mặc định) do registry
        // redirect lúc mount preset xử lý ⇒ không đưa vào để khỏi sinh cảnh báo rác như trước.
        const kind = manifest.gbh?.nested?.kind === "group" ? "group" : "preset";
        return [{ stockId, specifier: mount.specifier, kind }];
      } catch {
        return [];
      }
    });
  const groupRewrite =
    nested.length === 0
      ? { blocks: [] as string[], warnings: [] as string[] }
      : renderGroupRewriteBlocksFrom([readParityTemplate(), ...readKernelBundlePatches()], nested);
  for (const warning of groupRewrite.warnings) console.warn("[bh] row nhom: " + warning);
  const groupBlocks = groupRewrite.blocks;
  // 20/10/2026 (task-173): lớp patch PHỤ `preset-redirect.patch.yml` — sinh tự động từ `gbh.nested` + preset stock.
  // Vì sao cần: `host --dump-config` là công cụ OFFLINE (parse entry list + applyEntryPatches, KHÔNG nạp plugin)
  // nên redirect lúc mount KHÔNG thể làm dump sạch id stock; muốn Sổ cài đặt → Plugin hiện id GBH thì phải sửa
  // Ở TẦNG VĂN BẢN. Tệp do package agent-preset sinh, ở đây chỉ ĐỌC và chèn vào cuối (fail-soft khi thiếu).
  // Chỉ chèn lớp patch phụ khi CÓ ít nhất một row thay thế đã mount: nếu bản viết lại bị tắt
  // (`GBH_DISABLE_REWRITES=1`) thì cây plugin vẫn là stock ⇒ redirect preset sẽ trỏ vào gói KHÔNG tồn tại.
  const presetRedirect = (options.rewrites ?? []).some((mount) => mount.ok) ? readPresetRedirectPatch() : "";
  const text = [
    "# author Bùi Trọng Hiếu",
    "# email kevinbui210191@gmail.com",
    "# create date 15/10/2026",
    "# modify date 20/10/2026",
    "# desc Lop patch CUOI CUNG cua app: ngu nghia san pham Galaxy (M1a) + credentials dung chung",
    "#",
    "# Sinh boi `bh host` moi lan boot: ghep tu profiles/blackhole/parity.patch.yml (ngu nghia patch cua",
    "# oracle — xem docs/ADR/0003), roi ghim credentials o cuoi. KHONG chua secret: chi duong dan file",
    "# va ten bien env (GBH_GALAXY_API_KEY duoc khai la apiKeyEnv, gia tri nam trong credential store).",
    ...(body === "" ? [] : ["", ...body.split("\n")]),
    ...extraBlocks.flatMap((block) => ["", ...block.split("\n")]),
    ...groupBlocks.flatMap((block) => ["", ...block.split("\n")]),
    ...(presetRedirect === "" ? [] : ["", ...presetRedirect.split("\n")]),
    "",
    "# Mot tai lieu credentials duy nhat cho ca he sinh thai Galaxy.",
    "- id: credentials",
    "  config:",
    `    path: ${JSON.stringify(credentialsPath())}`,
    "",
  ].join("\n");
  // Ban sao trong repo chi de parity/nguoi doc thay dung lop cuoi cua ban cai mac dinh: khi home cua app
  // bi doi (test, may khac), khong duoc ghi de len no.
  const overridden = (process.env.GBH_HOME ?? "").trim() !== "";
  const dich = overridden ? [appPatchPath()] : [appPatchPath(), repoAppPatchPath()];
  // 12/11/2026 — KHONG SINH LAI khi input khong doi (yêu cầu tối ưu khởi động): văn bản patch là hàm của
  //   parity.patch.yml + metadata từng gói + bundle patch + đường dẫn credentials, nên băm CHÍNH văn bản
  //   sinh ra là phép so ĐẦY ĐỦ NHẤT (mạnh hơn băm từng input). Đo trước khi vá: 19 ms/lượt và mtime của
  //   app.patch.yml đổi mỗi lượt boot dù nội dung y hệt.
  const stamp = createHash("sha256").update(text).digest("hex");
  const stampPath = appPatchStampPath();
  const stampCu = existsSync(stampPath) ? readFileSync(stampPath, "utf8").trim() : "";
  if (stampCu === stamp && dich.every((file) => existsSync(file))) return appPatchPath();
  for (const file of dich) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      // 10/11/2026 (Lead): ghi NGUYEN TU (tmp + rename). Đo được: hai `bh host` chạy song song trên cùng
      // GBH_HOME làm `app.patch.yml` bị cắt còn 379 byte / toàn NUL vì writeFileSync ghi đè tại chỗ; lượt
      // boot sau đọc phải tệp rỗng ⇒ app.patch hỏng, mount sai. rename(2) trong cùng thư mục là thao tác
      // nguyên tử nên tệp luôn là bản cũ hoặc bản mới trọn vẹn, không bao giờ là bản dở dang.
      const tam = `${file}.tmp-${process.pid}`;
      writeFileSync(tam, text);
      renameSync(tam, file);
    } catch (error) {
      console.warn(`[bh] khong ghi duoc ${file}: ${String(error)}`);
    }
  }
  try {
    writeFileSync(stampPath, stamp + "\n");
  } catch {
    // Không ghi được stamp chỉ làm lượt sau ghi lại patch, không làm hỏng boot.
  }
  return appPatchPath();
}

/**
 * Reads the app patch back; used by `bh doctor` to show what the host will apply.
 * @returns the patch text, or a hint when this app home has never booted.
 */
export function readAppPatch(): string {
  try {
    return readFileSync(appPatchPath(), "utf8");
  } catch {
    return "(chua sinh — chay: bh host)";
  }
}
