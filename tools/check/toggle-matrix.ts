/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — thêm PHẦN B (công tắc phải có hàm ghi qua `inject`) và PHẦN C/D (settings-surface.ts:
 *   mọi mục Cài đặt phải có đường ghi + field có trong schema, đo thật bằng RPC). Lý do: 11/11/2026 đo được công tắc
 *   "Công cụ lập trình" bấm không đổi gì, và 2 namespace Cài đặt bị lớp overlay `app.patch.yml` ghim ⇒ không lưu được.
 * desc Bảng chứng minh công tắc bật/tắt plugin có tác dụng THẬT: mỗi bundle trong profile, mỗi row riêng của nó,
 *      và mọi row bị cắm ở lớp patch NGOÀI bundle (app.patch.yml / parity.patch.yml) — nơi luôn thắng bundle.
 *      PHẦN B canh lớp lỗi "công tắc vô hiệu" phía UI: mọi đăng ký slot mà bản gốc cấp hàm ghi (`set*` trong
 *      `inject`) thì bản của ta PHẢI cấp đúng tên hàm đó trong cùng đăng ký.
 *
 * VÌ SAO CẦN (sự cố thật 10/11/2026): người dùng tắt plugin mà tính năng vẫn chạy. Cơ chế:
 *   (1) bundle patch cắm row `<id>` trỏ gói của ta;
 *   (2) metadata `gbh.row` của chính gói đó sinh thêm một khối trong `app.patch.yml` (lớp CUỐI CÙNG):
 *       `- id: <id> / disabled: true` + `- insert: <id>-ours` cùng gói;
 *   (3) tắt bundle ⇒ (1) biến mất, nhưng (2) vẫn nạp gói ⇒ tính năng vẫn sống.
 * Thuốc chữa: `gbh.row.ownedByBundle: true` trong package.json của gói ⇒ `renderRewriteBlock` KHÔNG phát khối
 * nữa (xem apps/cli/src/rewrite-metadata.ts). Công cụ này chỉ ra ĐÚNG gói cần thêm cờ đó.
 *
 * CHẠY: bun run tools/check/toggle-matrix.ts [--home <thư mục home>] [--profile <tên>] [--bundle <spec>] [--verbose]
 * THOÁT: 0 = mọi bundle PASS và mọi công tắc UI có đường ghi · 1 = có ít nhất một ca FAIL
 *        (row bị cắm ngoài bundle, hoặc công tắc UI không có hàm ghi ⇒ bấm không có tác dụng).
 */

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { runSettingsSurface } from "./settings-surface.ts";

/** Gốc repo, suy từ vị trí tệp này (chạy được từ bất kỳ cwd). */
const REPO_ROOT = resolve(import.meta.dir, "..", "..");

/** Thư mục home mặc định của app (khớp apps/cli/src/paths.ts: `$GBH_HOME` hoặc `~/.galaxy/blackhole`). */
const DEFAULT_HOME = process.env.GBH_HOME ?? join(homedir(), ".galaxy", "blackhole");

/** Tên profile mặc định (khớp DEFAULT_PROFILE của CLI). */
const DEFAULT_PROFILE = "blackhole";

/** Bundle NỀN (95 row, do task-191 sinh từ patch của stock) — bỏ qua theo yêu cầu: nó KHÔNG phải công tắc. */
const FOUNDATION_BUNDLES = new Set(["@galaxy-blackhole/gbh-bundle", "@galaxy-blackhole/gbh-base"]);

/** Nơi một entry được đọc ra: `row` = khối `- id:` cấp 0 · `insert` = con của `- insert:` · `nested` = trong config. */
export type EntryBlock = "row" | "insert" | "nested";

/** Một entry `- id:` đọc từ văn bản patch YAML. */
export interface PatchEntry {
  /** id của row/plugin. */
  readonly id: string;
  /** `name` (specifier gói) nếu entry cắm một module — dấu hiệu entry đang NẠP gói. */
  readonly name?: string;
  /** Giá trị `disabled` khi khai tường minh. */
  readonly disabled?: boolean;
  /** Số dòng (1-based) trong tệp nguồn. */
  readonly line: number;
  /** Thụt lề của dòng `- id:`. */
  readonly indent: number;
  /** Entry thuộc loại khối nào. */
  readonly block: EntryBlock;
}

/** Một lớp patch (tệp) đã đọc. */
export interface PatchLayer {
  /** Nhãn ngắn để in bảng. */
  readonly label: string;
  /** Đường dẫn tuyệt đối. */
  readonly file: string;
  /** Các entry đọc được. */
  readonly entries: readonly PatchEntry[];
}

/** Kết luận của một dòng trong bảng. */
export type Verdict = "PASS" | "FAIL" | "CẢNH BÁO";

/** Một dòng của bảng: bundle × row × "có bị cắm ngoài bundle không". */
export interface RowCheck {
  /** Bundle đang xét. */
  readonly bundle: string;
  /** id row. */
  readonly row: string;
  /** Specifier gói mà row cắm (nếu có). */
  readonly name?: string;
  /** `riêng` = bundle tự cắm; `thay-thế` = bundle tắt row của lớp khác (phải quay về lớp đó khi tắt). */
  readonly kind: "riêng" | "thay-thế";
  /** Cờ `gbh.row.ownedByBundle` của gói sở hữu (undefined = không tìm thấy gói trong repo). */
  readonly ownedByBundle?: boolean;
  /** Kết luận. */
  readonly verdict: Verdict;
  /** Bằng chứng: nơi row bị cắm ngoài (hoặc nơi row thay-thế quay về). */
  readonly evidence: readonly string[];
  /** Ghi chú thông tin (gói dùng chung ở row khác của lớp khác) — chỉ in khi --verbose. */
  readonly info?: readonly string[];
  /** Việc cần làm khi FAIL: gói nào phải khai `gbh.row.ownedByBundle`. */
  readonly hint?: string;
}

/** Báo cáo một bundle. */
export interface BundleReport {
  /** Specifier bundle. */
  readonly bundle: string;
  /** Có phải bundle nền (bị bỏ qua) không. */
  readonly foundation: boolean;
  /** Các dòng của bảng. */
  readonly rows: readonly RowCheck[];
}

/** Bối cảnh một lần chạy: các lớp patch ngoài bundle + chỉ mục gói của repo. */
export interface ScanContext {
  /** Lớp patch NGOÀI bundle, theo thứ tự ưu tiên (app.patch.yml trước, parity sau). */
  readonly outside: readonly PatchLayer[];
  /** specifier gói → thư mục gói trong repo (để đọc `gbh.row.ownedByBundle`). */
  readonly repoPackages: ReadonlyMap<string, string>;
  /** Các lớp patch của MỌI bundle đã đọc, để tìm "row thay-thế quay về lớp nào". */
  readonly layersByBundle: ReadonlyMap<string, readonly PatchLayer[]>;
}

/**
 * Bỏ cặp nháy bao quanh một scalar YAML.
 * Nhận: chuỗi thô (vd `'@galaxy-blackhole/gbh-x'`).
 * Trả: chuỗi đã bỏ nháy (không đổi nếu không có nháy).
 */
export function unquoteScalar(raw: string): string {
  const text = raw.trim();
  if (text.length >= 2 && ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"')))) {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * Đọc mọi entry `- id:` của một văn bản patch, kèm `name`/`disabled` và loại khối.
 *
 * VÌ SAO KHÔNG DÙNG THƯ VIỆN YAML: patch của ta chứa tag riêng `!!js` với biểu thức có dấu `:` và `?`
 * (`policy: !!js (process.env.X ?? 'a') === 'b' ? 'never' : 'ask'`) — `yaml.parse` coi đó là "Nested mappings
 * are not allowed in compact mappings" và trả về cây SAI (đo 10/11/2026). Ở đây chỉ cần id/name/disabled nên
 * đọc theo dòng + thụt lề là đủ và bền.
 * Nhận: văn bản patch.
 * Trả: mảng entry theo thứ tự xuất hiện.
 */
export function parsePatchEntries(text: string): PatchEntry[] {
  const lines = text.split(String.fromCharCode(10));
  const out: PatchEntry[] = [];
  let block: EntryBlock | "none" = "none";
  let current: { id: string; name?: string; disabled?: boolean; line: number; indent: number; block: EntryBlock } | undefined;
  const flush = (): void => {
    if (current !== undefined) out.push({ ...current, ...(current.name === undefined ? {} : { name: current.name }), ...(current.disabled === undefined ? {} : { disabled: current.disabled }) });
    current = undefined;
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!!")) continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      flush();
      if (/^- insert:\s*$/u.test(line)) {
        block = "insert";
        continue;
      }
      const rowMatch = /^- id:\s*(\S+)\s*$/u.exec(line);
      if (rowMatch !== null) {
        block = "row";
        current = { id: rowMatch[1] as string, line: index + 1, indent: 0, block: "row" };
        continue;
      }
      block = "none";
      continue;
    }
    const idMatch = /^(\s*)- id:\s*(\S+)\s*$/u.exec(line);
    if (idMatch !== null) {
      flush();
      const inner: EntryBlock = block === "insert" ? "insert" : "nested";
      current = { id: idMatch[2] as string, line: index + 1, indent: (idMatch[1] as string).length, block: inner };
      continue;
    }
    if (current === undefined) continue;
    const nameMatch = /^\s+name:\s*(.+?)\s*$/u.exec(line);
    if (nameMatch !== null) {
      if (current.name === undefined) current.name = unquoteScalar(nameMatch[1] as string);
      continue;
    }
    const disabledMatch = /^\s+disabled:\s*(true|false)\s*$/u.exec(line);
    if (disabledMatch !== null && current.disabled === undefined) current.disabled = disabledMatch[1] === "true";
  }
  flush();
  return out;
}

/**
 * Đọc một tệp patch thành lớp patch; tệp thiếu thì trả undefined (fail-soft, app vẫn kiểm được).
 * Nhận: đường dẫn và nhãn in bảng.
 * Trả: lớp patch, hoặc undefined khi tệp không tồn tại.
 */
export function readLayer(file: string, label: string): PatchLayer | undefined {
  if (!existsSync(file)) return undefined;
  try {
    return { label, file, entries: parsePatchEntries(readFileSync(file, "utf8")) };
  } catch {
    return undefined;
  }
}

/**
 * Duyệt `packages/<nhóm>/<gói>` của repo và lập chỉ mục specifier → thư mục.
 * Nhận: không.
 * Trả: Map tên gói → đường dẫn tuyệt đối.
 */
export function indexRepoPackages(): Map<string, string> {
  const out = new Map<string, string>();
  const packagesRoot = join(REPO_ROOT, "packages");
  if (!existsSync(packagesRoot)) return out;
  for (const group of readdirSync(packagesRoot)) {
    const groupDir = join(packagesRoot, group);
    let entries: string[];
    try {
      if (!statSync(groupDir).isDirectory()) continue;
      entries = readdirSync(groupDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const dir = join(groupDir, name);
      const manifest = join(dir, "package.json");
      if (!existsSync(manifest)) continue;
      try {
        const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
        if (typeof parsed.name === "string" && parsed.name.trim() !== "") out.set(parsed.name, dir);
      } catch {
        continue;
      }
    }
  }
  return out;
}

/**
 * Tìm thư mục package của một specifier: ưu tiên bản đã cài trong profile, rồi tới repo.
 * Nhận: specifier và các thư mục node_modules của profile.
 * Trả: đường dẫn tuyệt đối, hoặc undefined khi không thấy.
 */
export function resolvePackageDir(specifier: string, moduleDirs: readonly string[], repoPackages: ReadonlyMap<string, string>): string | undefined {
  for (const modules of moduleDirs) {
    const candidate = join(modules, specifier);
    if (!existsSync(join(candidate, "package.json"))) continue;
    try {
      return realpathSync(candidate);
    } catch {
      return candidate;
    }
  }
  return repoPackages.get(specifier);
}

/**
 * Đọc danh sách tệp patch của một bundle từ `dsh.bundle.patch` (chuỗi hoặc mảng).
 * Nhận: thư mục bundle.
 * Trả: các lớp patch theo đúng thứ tự bundle áp.
 */
export function readBundleLayers(bundleDir: string, bundle: string): PatchLayer[] {
  const out: PatchLayer[] = [];
  let patch: unknown;
  try {
    const manifest = JSON.parse(readFileSync(join(bundleDir, "package.json"), "utf8")) as { dsh?: { bundle?: { patch?: unknown } } };
    patch = manifest.dsh?.bundle?.patch;
  } catch {
    return out;
  }
  const files = Array.isArray(patch) ? patch.map(String) : typeof patch === "string" ? [patch] : [];
  for (const rel of files) {
    const layer = readLayer(join(bundleDir, rel), bundle + " · " + rel);
    if (layer !== undefined) out.push(layer);
  }
  return out;
}

/**
 * Đọc danh sách bundle của profile: `dsh.profile.bundles` hợp với `extra-bundles.json`.
 * Nhận: thư mục profile.
 * Trả: danh sách specifier (đã bỏ trùng, giữ thứ tự).
 */
export function profileBundles(profileDir: string): string[] {
  const out: string[] = [];
  try {
    const manifest = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8")) as { dsh?: { profile?: { bundles?: unknown } } };
    const declared = manifest.dsh?.profile?.bundles;
    if (Array.isArray(declared)) out.push(...declared.map(String));
  } catch {
    /* thiếu manifest ⇒ danh sách rỗng, in cảnh báo ở main */
  }
  try {
    const extra = JSON.parse(readFileSync(join(profileDir, "extra-bundles.json"), "utf8")) as unknown;
    if (Array.isArray(extra)) out.push(...extra.map(String));
  } catch {
    /* extra-bundles.json là tuỳ chọn */
  }
  return [...new Set(out)];
}

/**
 * Đọc cờ `gbh.row.ownedByBundle` của gói sở hữu một row.
 * Nhận: thư mục gói (có thể undefined).
 * Trả: true/false, hoặc undefined khi không đọc được manifest.
 */
export function readOwnedByBundle(packageDir: string | undefined): boolean | undefined {
  if (packageDir === undefined) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as { gbh?: { row?: { ownedByBundle?: unknown } } };
    return parsed.gbh?.row?.ownedByBundle === true;
  } catch {
    return undefined;
  }
}

/**
 * Có phải "name" chỉ là dấu hiệu row NHÓM (`cordis:group`) — không phải một gói được nạp.
 * Nhận: name của entry.
 * Trả: true khi là row nhóm.
 */
export function isGroupName(name: string | undefined): boolean {
  return name !== undefined && name.startsWith("cordis:");
}

/**
 * Soi một row RIÊNG của bundle: nó có bị cắm ở lớp patch NGOÀI bundle không.
 *
 * Ba luật, đúng theo cơ chế sinh patch (apps/cli/src/profile.ts + rewrite-metadata.ts):
 *  (1) FAIL khi lớp ngoài cắm CÙNG ROW: `id: <row>` (trùng id) hoặc `id: <row>-ours` (khối metadata
 *      "disable row + insert <id>-ours") — đây chính là lỗi "tắt plugin mà tính năng vẫn chạy".
 *  (2) FAIL khi lớp ngoài `id: <row>` + `disabled: false` (ép bật lại).
 *  (3) CẢNH BÁO khi lớp ngoài chỉ có khối `id: <row>` vô hiệu (disable/config) — tắt bundle thì khối đó
 *      thành khối thừa, không gỡ được gì; giữ lại thì mỗi lượt boot sinh cảnh báo.
 * Gói DÙNG CHUNG ở một row KHÁC của lớp khác (vd preset nạp cùng gói dưới id `pty`) KHÔNG phải FAIL:
 * đó là hai row khác nhau; ghi vào `info` để người đọc biết vì sao tính năng còn sống ở nơi khác.
 * Nhận: entry của row, các lớp ngoài.
 * Trả: kết luận + bằng chứng + gói cần khai cờ (khi FAIL).
 */
export function checkOwnRow(row: PatchEntry, outside: readonly PatchLayer[]): { verdict: Verdict; evidence: string[]; info: string[]; hint?: string } {
  const evidence: string[] = [];
  const info: string[] = [];
  let verdict: Verdict = "PASS";
  let hint: string | undefined;
  const ownName = isGroupName(row.name) ? undefined : row.name;
  for (const layer of outside) {
    for (const entry of layer.entries) {
      const where = layer.label + ":" + String(entry.line);
      if (entry.id === row.id || entry.id === row.id + "-ours") {
        if (entry.name !== undefined && !isGroupName(entry.name)) {
          evidence.push("CẮM NGOÀI " + where + " · id '" + entry.id + "' nạp '" + entry.name + "'");
          verdict = "FAIL";
          hint = entry.name;
          continue;
        }
        if (entry.disabled === false) {
          evidence.push("ÉP BẬT " + where + " · id '" + entry.id + "' disabled: false");
          verdict = "FAIL";
          hint = ownName;
          continue;
        }
        evidence.push("KHỐI THỪA " + where + " · id '" + entry.id + "' (tắt bundle thì khối này vô hiệu)");
        if (verdict === "PASS") verdict = "CẢNH BÁO";
        continue;
      }
      if (ownName !== undefined && entry.name === ownName) {
        info.push("gói dùng chung: " + where + " · id '" + entry.id + "' cũng nạp '" + ownName + "' (row khác, lớp khác)");
      }
    }
  }
  return { verdict, evidence, info, ...(hint === undefined ? {} : { hint }) };
}

/**
 * Soi một row THAY THẾ (bundle tắt row của lớp khác): khi tắt bundle, row đó có nguồn khác để quay về không.
 * Nhận: row mà bundle tắt, các lớp khác (bundle khác + ngoài bundle).
 * Trả: kết luận + nơi quay về.
 */
export function checkReplacedRow(row: PatchEntry, elsewhere: readonly PatchLayer[]): { verdict: Verdict; evidence: string[] } {
  for (const layer of elsewhere) {
    for (const entry of layer.entries) {
      if (entry.id !== row.id) continue;
      const what = entry.name !== undefined ? " · name '" + entry.name + "'" : entry.disabled === true ? " · disabled: true" : "";
      return { verdict: "PASS", evidence: ["quay về " + layer.label + ":" + String(entry.line) + what] };
    }
  }
  return { verdict: "CẢNH BÁO", evidence: ["không lớp nào khác cắm row này ⇒ tắt bundle là mất hẳn row (kiểm lại thiết kế)"] };
}

/**
 * Dựng bảng cho một bundle.
 * Nhận: specifier bundle, thư mục bundle, bối cảnh quét.
 * Trả: báo cáo của bundle.
 */
export function checkBundle(bundle: string, bundleDir: string | undefined, context: ScanContext): BundleReport {
  const foundation = FOUNDATION_BUNDLES.has(bundle);
  if (bundleDir === undefined) {
    return { bundle, foundation, rows: [{ bundle, row: "(không tìm thấy gói)", kind: "riêng", verdict: "CẢNH BÁO", evidence: ["không resolve được bundle trong profile lẫn repo"] }] };
  }
  const layers = readBundleLayers(bundleDir, bundle);
  if (layers.length === 0) {
    return { bundle, foundation, rows: [{ bundle, row: "(không có dsh.bundle.patch)", kind: "riêng", verdict: "CẢNH BÁO", evidence: ["manifest không khai dsh.bundle.patch ⇒ bundle không cắm row nào"] }] };
  }
  const otherLayers: PatchLayer[] = [...context.outside];
  for (const [otherBundle, otherBundleLayers] of context.layersByBundle) {
    if (otherBundle !== bundle) otherLayers.push(...otherBundleLayers);
  }
  const rows: RowCheck[] = [];
  const seenOwn = new Set<string>();
  for (const layer of layers) {
    for (const entry of layer.entries) {
      if (entry.block !== "insert" || entry.name === undefined) continue;
      if (seenOwn.has(entry.id)) continue;
      seenOwn.add(entry.id);
      const group = isGroupName(entry.name);
      const packageDir = group ? undefined : resolvePackageDir(entry.name as string, [], context.repoPackages);
      const ownedByBundle = group ? undefined : readOwnedByBundle(packageDir);
      const { verdict, evidence, info, hint } = checkOwnRow(entry, context.outside);
      // Gói phải khai cờ = gói bị cắm NGOÀI (bằng chứng FAIL), không phải gói mà row trong bundle trỏ tới.
      const hintDir = hint === undefined ? undefined : resolvePackageDir(hint, [], context.repoPackages);
      rows.push({
        bundle,
        row: entry.id,
        ...(group ? {} : { name: entry.name }),
        kind: "riêng",
        ...(ownedByBundle === undefined ? {} : { ownedByBundle }),
        verdict,
        evidence,
        ...(info.length === 0 ? {} : { info }),
        ...(hint === undefined ? {} : {
          hint: "thêm \"ownedByBundle\": true vào gbh.row của " + hint + (hintDir === undefined ? " (không thấy gói trong repo)" : " · " + hintDir),
        }),
      });
    }
  }
  const seenReplaced = new Set<string>();
  for (const layer of layers) {
    for (const entry of layer.entries) {
      if (entry.block !== "row" || entry.disabled !== true) continue;
      if (seenReplaced.has(entry.id)) continue;
      seenReplaced.add(entry.id);
      const { verdict, evidence } = checkReplacedRow(entry, otherLayers);
      rows.push({ bundle, row: entry.id, kind: "thay-thế", verdict, evidence });
    }
  }
  return { bundle, foundation, rows };
}

/** Một lần đăng ký slot đọc được từ văn bản JS/TS (khối `slots.register({...})`). */
export interface SlotRegistration {
  /** Tên slot. */
  readonly slot: string;
  /** id của mục (nếu khai). */
  readonly id?: string;
  /** Nguyên văn khối đăng ký `{...}` — nơi chứa `inject`/`props`. */
  readonly text: string;
}

/** Một đăng ký của TA, kèm tệp nguồn để in bằng chứng. */
export interface OursRegistration extends SlotRegistration {
  /** Đường dẫn tệp nguồn. */
  readonly file: string;
}

/** Một ca của PHẦN B: bản gốc cấp hàm ghi cho slot này — bản của ta có cấp lại không. */
export interface SwitchCheck {
  /** Specifier gói của ta. */
  readonly ours: string;
  /** Specifier bundle gốc (nguồn đối chứng). */
  readonly stock: string;
  /** Slot của đăng ký. */
  readonly slot: string;
  /** id của mục (nếu bản gốc khai). */
  readonly id?: string;
  /** Tên các hàm ghi (`set*`) bản gốc cấp qua `inject`. */
  readonly writers: readonly string[];
  /** Kết luận. */
  readonly verdict: Verdict;
  /** Bằng chứng (tệp:dòng không có — chỉ tệp, vì khối đăng ký đọc theo văn bản). */
  readonly evidence: readonly string[];
}

/**
 * Tìm chỉ số đóng ngoặc nhọn khớp với `{` ở `open`, BỎ QUA chuỗi và chú thích.
 * Nhận: văn bản và chỉ số `{` mở.
 * Trả: chỉ số `}` khớp, hoặc -1 khi không cân.
 */
function matchingBrace(text: string, open: number): number {
  let depth = 0;
  let quote: string | undefined;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (quote !== undefined) {
      if (char === "\\") { index += 1; continue; }
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") { quote = char; continue; }
    if (char === "/" && text[index + 1] === "/") { const lineEnd = text.indexOf(String.fromCharCode(10), index); index = lineEnd < 0 ? text.length : lineEnd; continue; }
    if (char === "/" && text[index + 1] === "*") { const close = text.indexOf("*/", index + 2); index = close < 0 ? text.length : close + 1; continue; }
    if (char === "{") depth += 1;
    else if (char === "}") { depth -= 1; if (depth === 0) return index; }
  }
  return -1;
}

/**
 * Đọc mọi lần đăng ký slot trong một văn bản nguồn/bundle.
 * Nhận: văn bản JS/TS.
 * Trả: các đăng ký theo thứ tự xuất hiện.
 */
export function parseSlotRegistrations(text: string): SlotRegistration[] {
  const out: SlotRegistration[] = [];
  const marker = "slots.register({";
  // Vùng chú thích khối: quét bằng regex thay vì tokenize cả tệp — bundle gốc 20k dòng có regex literal
  // chứa dấu nháy, tokenize toàn tệp sẽ lệch trạng thái và BỎ SÓT đăng ký thật (đo 11/11/2026:
  // mất ca "composer-enter" của ui-conversation).
  const blockComments: Array<[number, number]> = [];
  for (const match of text.matchAll(/\/\*[\s\S]*?\*\//gu)) {
    const start = match.index ?? 0;
    blockComments.push([start, start + match[0].length]);
  }
  const inBlockComment = (at: number): boolean => blockComments.some(([start, end]) => at >= start && at < end);
  let at = text.indexOf(marker);
  while (at >= 0) {
    const lineStart = text.lastIndexOf(String.fromCharCode(10), at) + 1;
    const prefix = text.slice(lineStart, at);
    // (1) Nằm sau "//" trên CÙNG dòng ⇒ là chú thích, không phải mã.
    // (2) Nằm trong chú thích khối ⇒ bỏ.
    // (3) Nằm trong một chuỗi đang mở trên dòng (số dấu nháy trước đó là LẺ) ⇒ bỏ.
    const inLineComment = prefix.includes("//");
    const unbalanced = ['"', "'", "`"].some((quote) => {
      const opened = prefix.split(quote).length - 1;
      return opened % 2 === 1;
    });
    if (inLineComment || inBlockComment(at) || unbalanced) {
      at = text.indexOf(marker, at + marker.length);
      continue;
    }
    const open = at + marker.length - 1;
    const end = matchingBrace(text, open);
    if (end < 0) break;
    const body = text.slice(open, end + 1);
    const slot = /name:\s*"([^"]+)"/u.exec(body)?.[1];
    const id = /id:\s*"([^"]+)"/u.exec(body)?.[1];
    if (slot !== undefined) out.push({ slot, ...(id === undefined ? {} : { id }), text: body });
    at = text.indexOf(marker, end + 1);
  }
  return out;
}

/**
 * Tên các HÀM GHI mà một khối đăng ký cấp (quy ước DSH: prop hàm ghi đặt tên `set*`).
 * Nhận: nguyên văn khối đăng ký.
 * Trả: danh sách tên duy nhất, theo thứ tự xuất hiện.
 */
export function writerProps(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/(?:^|[,{\s])(set[A-Z][A-Za-z0-9]*)\s*:/gu)) {
    const name = match[1];
    if (name !== undefined && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Soi MỘT ca: bản gốc cấp hàm ghi cho đăng ký này, bản của ta có cấp lại đúng tên đó không.
 *
 * VÌ SAO ĐÂY LÀ CỔNG ĐÚNG: một công tắc UI chỉ sống khi component nhận được hàm ghi qua prop; bản gốc cấp
 * nó bằng `inject` của đăng ký slot. Bản port quên `inject` ⇒ prop undefined ⇒ `onChange` gọi vào hư không,
 * KHÔNG lỗi, KHÔNG request — đúng lớp "công tắc vô hiệu" (đo thật 11/11/2026 với "Công cụ lập trình").
 * Nhận: đăng ký GỐC, các đăng ký của TA, specifier hai bên.
 * Trả: ca kết luận, hoặc undefined khi bản gốc không cấp hàm ghi nào.
 */
export function checkSwitchRegistration(
  stock: SlotRegistration,
  ours: readonly OursRegistration[],
  labels: { oursPackage: string; stockBundle: string },
): SwitchCheck | undefined {
  const writers = writerProps(stock.text);
  if (writers.length === 0) return undefined;
  const matched = ours.filter((registration) => registration.slot === stock.slot && (stock.id === undefined || registration.id === stock.id));
  const base = {
    ours: labels.oursPackage,
    stock: labels.stockBundle,
    slot: stock.slot,
    ...(stock.id === undefined ? {} : { id: stock.id }),
    writers,
  };
  if (matched.length === 0) {
    return {
      ...base,
      verdict: "FAIL",
      evidence: ["không thấy đăng ký '" + stock.slot + "'" + (stock.id === undefined ? "" : " id '" + stock.id + "'") + " trong src/"],
    };
  }
  const missing: string[] = [];
  const found: string[] = [];
  for (const registration of matched) {
    for (const writer of writers) {
      if (registration.text.includes(writer)) found.push(writer);
      else missing.push(writer);
    }
  }
  const where = matched.map((registration) => registration.file).join(" · ");
  if (missing.length === writers.length * matched.length) {
    return {
      ...base,
      verdict: "FAIL",
      evidence: [where + " — đăng ký KHÔNG cấp " + writers.join(", ") + " ⇒ công tắc bấm không có tác dụng"],
    };
  }
  if (found.length === 0) {
    return { ...base, verdict: "FAIL", evidence: [where + " — không thấy hàm ghi " + writers.join(", ")] };
  }
  return { ...base, verdict: "PASS", evidence: [where + " — cấp " + writers.join(", ")] };
}

/**
 * Đọc mọi tệp `.ts` dưới `src/` của một gói (bỏ node_modules/lib).
 * Nhận: thư mục gói trong repo.
 * Trả: danh sách đường dẫn tuyệt đối.
 */
function sourceFiles(packageDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const abs = join(dir, name);
      let isDir = false;
      try { isDir = statSync(abs).isDirectory(); } catch { continue; }
      if (isDir) walk(abs);
      else if (abs.endsWith(".ts")) out.push(abs);
    }
  };
  walk(join(packageDir, "src"));
  return out;
}

/**
 * Quét MỌI gói của repo có `gbh.provenance.stock` và đối chứng hàm ghi của bản gốc.
 * Nhận: chỉ mục gói của repo + các thư mục node_modules để tìm bundle gốc.
 * Trả: các ca PHẦN B (chỉ ca có hàm ghi).
 */
export function scanSwitchWiring(repoPackages: ReadonlyMap<string, string>, moduleDirs: readonly string[]): SwitchCheck[] {
  const out: SwitchCheck[] = [];
  for (const [specifier, dir] of repoPackages) {
    let stock: string | undefined;
    try {
      const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { gbh?: { provenance?: { stock?: unknown } } };
      const value = manifest.gbh?.provenance?.stock;
      if (typeof value === "string") stock = value;
    } catch {
      continue;
    }
    if (stock === undefined) continue;
    const candidates = [join(REPO_ROOT, "apps", "host", "node_modules", stock, "lib", "client.js"), ...moduleDirs.map((modules) => join(modules, stock, "lib", "client.js"))];
    const stockPath = candidates.find((candidate) => existsSync(candidate));
    if (stockPath === undefined) continue;
    let stockText: string;
    try { stockText = readFileSync(stockPath, "utf8"); } catch { continue; }
    const stockRegistrations = parseSlotRegistrations(stockText).filter((registration) => writerProps(registration.text).length > 0);
    if (stockRegistrations.length === 0) continue;
    const ours: OursRegistration[] = [];
    for (const file of sourceFiles(dir)) {
      let text: string;
      try { text = readFileSync(file, "utf8"); } catch { continue; }
      for (const registration of parseSlotRegistrations(text)) ours.push({ ...registration, file: file.slice(REPO_ROOT.length + 1) });
    }
    for (const registration of stockRegistrations) {
      const check = checkSwitchRegistration(registration, ours, { oursPackage: specifier, stockBundle: stock });
      if (check !== undefined) out.push(check);
    }
  }
  return out;
}

/**
 * In bảng PHẦN B.
 * Nhận: các ca và cờ verbose.
 * Trả: số ca FAIL.
 */
export function printSwitchTable(cases: readonly SwitchCheck[], verbose: boolean): number {
  console.log("");
  console.log("=== PHẦN B — CÔNG TẮC TRONG UI PHẢI CÓ ĐƯỜNG GHI (hàm ghi `set*` của bản gốc qua `inject`) ===");
  if (cases.length === 0) {
    console.log("(không có ca nào: chưa thấy bundle gốc hoặc bản gốc không cấp hàm ghi)");
    return 0;
  }
  const pkgWidth = 46;
  const slotWidth = 28;
  const idWidth = 20;
  const writerWidth = 16;
  console.log("GÓI CỦA TA".padEnd(pkgWidth) + " SLOT".padEnd(slotWidth + 1) + "ID".padEnd(idWidth) + "HÀM GHI".padEnd(writerWidth) + "KẾT");
  console.log("-".repeat(pkgWidth + slotWidth + idWidth + writerWidth + 14));
  let fails = 0;
  for (const item of cases) {
    if (item.verdict === "FAIL") fails += 1;
    console.log(fit(item.ours, pkgWidth) + fit(item.slot, slotWidth) + fit(item.id ?? "-", idWidth) + fit(item.writers.join(","), writerWidth) + item.verdict);
    if (verbose || item.verdict !== "PASS") for (const line of item.evidence) console.log(" ".repeat(pkgWidth) + "↳ " + line);
  }
  return fails;
}

/**
 * Cắt chuỗi cho vừa cột bảng, giữ nguyên chuỗi khi đã ngắn.
 * Nhận: chuỗi và độ rộng tối đa.
 * Trả: chuỗi đã cắt (thêm '…' khi bị cắt).
 */
function fit(text: string, width: number): string {
  const cell = text.length <= width ? text.padEnd(width) : text.slice(0, Math.max(0, width - 1)) + "…";
  // Luôn có MỘT dấu cách phân cột: chuỗi dài ĐÚNG bằng width sẽ dính vào cột sau nếu chỉ padEnd.
  return cell + " ";
}

/**
 * In bảng kết quả.
 * Nhận: các báo cáo, danh sách lớp ngoài, cờ verbose.
 * Trả: số dòng FAIL.
 */
export function printTable(reports: readonly BundleReport[], outside: readonly PatchLayer[], verbose: boolean): number {
  const bundleWidth = 46;
  const rowWidth = 34;
  const kindWidth = 9;
  console.log("");
  console.log("BUNDLE".padEnd(bundleWidth) + " ROW RIÊNG CỦA BUNDLE".padEnd(rowWidth + 1) + "LOẠI".padEnd(kindWidth) + "OWNED".padEnd(7) + "CẮM NGOÀI?".padEnd(12) + "KẾT");
  console.log("-".repeat(bundleWidth + rowWidth + kindWidth + 7 + 12 + 14));
  let fails = 0;
  for (const report of reports) {
    if (report.foundation) {
      console.log(fit(report.bundle, bundleWidth) + fit("(bundle nền — bỏ qua)", rowWidth) + fit("-", kindWidth) + fit("-", 7) + fit("-", 12) + "BỎ QUA");
      continue;
    }
    if (report.rows.length === 0) {
      console.log(fit(report.bundle, bundleWidth) + fit("(không cắm row nào)", rowWidth) + fit("-", kindWidth) + fit("-", 7) + fit("không", 12) + "PASS");
      continue;
    }
    for (const row of report.rows) {
      if (row.verdict === "FAIL") fails += 1;
      const owned = row.kind === "riêng" ? (row.ownedByBundle === undefined ? "?" : row.ownedByBundle ? "có" : "KHÔNG") : "-";
      const outsideCell = row.verdict === "FAIL" ? "CÓ" : row.verdict === "CẢNH BÁO" ? "khối thừa" : "không";
      console.log(fit(report.bundle, bundleWidth) + fit(row.row, rowWidth) + fit(row.kind, kindWidth) + fit(owned, 7) + fit(outsideCell, 12) + row.verdict);
      const showEvidence = verbose || row.verdict !== "PASS";
      const indent = " ".repeat(bundleWidth);
      if (showEvidence) for (const line of row.evidence) console.log(indent + "↳ " + line);
      if (row.hint !== undefined && row.verdict === "FAIL") console.log(indent + "↳ CÁCH CHỮA: " + row.hint);
      if (verbose && row.info !== undefined) for (const line of row.info) console.log(indent + "↳ (info) " + line);
    }
  }
  console.log("");
  console.log("nguồn NGOÀI bundle đã quét: " + (outside.length === 0 ? "(không có)" : outside.map((layer) => layer.label + " = " + String(layer.entries.length) + " entry").join(" · ")));
  return fails;
}

/**
 * Điểm vào: đọc profile + các lớp patch ngoài, dựng bảng, in, trả mã thoát.
 * Nhận: argv (bỏ tên tệp script) — hỗ trợ `--home`, `--profile`, `--bundle`, `--verbose`.
 * Trả: 0 khi mọi bundle PASS, 1 khi có FAIL.
 */
export async function main(argv: readonly string[]): Promise<number> {
  const arg = (name: string, fallback: string): string => {
    const index = argv.indexOf(name);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };
  const home = arg("--home", DEFAULT_HOME);
  const profile = arg("--profile", DEFAULT_PROFILE);
  const only = arg("--bundle", "");
  const verbose = argv.includes("--verbose");
  const profileDir = join(home, "profiles", profile);
  const moduleDirs = [join(home, "profiles", "node_modules"), join(profileDir, "node_modules")];
  const repoPackages = indexRepoPackages();
  const outside: PatchLayer[] = [];
  const appPatch = readLayer(join(home, "app.patch.yml"), "app.patch.yml");
  if (appPatch !== undefined) outside.push(appPatch);
  const repoAppPatch = readLayer(join(REPO_ROOT, "profiles", profile, "app.patch.yml"), "profiles/" + profile + "/app.patch.yml");
  if (repoAppPatch !== undefined && appPatch === undefined) outside.push(repoAppPatch);
  const parity = readLayer(join(REPO_ROOT, "profiles", profile, "parity.patch.yml"), "parity.patch.yml");
  if (parity !== undefined) outside.push(parity);
  console.log("=== BẢNG CÔNG TẮC: bundle × row riêng × row có bị cắm NGOÀI bundle không (10/11/2026) ===");
  console.log("profile : " + profileDir);
  console.log("ngoài   : " + outside.map((layer) => layer.file).join(" · "));
  if (!existsSync(join(profileDir, "package.json"))) {
    console.error("KHÔNG thấy " + join(profileDir, "package.json") + " — dùng --home/--profile để chỉ đúng hồ sơ.");
    return 1;
  }
  const allBundles = profileBundles(profileDir);
  const layersByBundle = new Map<string, readonly PatchLayer[]>();
  // Nạp patch của MỌI bundle TRƯỚC khi lọc: phần "row thay-thế quay về lớp nào" cần cả những bundle
  // không được in ra (nếu không, chạy --bundle sẽ báo oan "không lớp nào khác cắm row này").
  for (const bundle of allBundles) {
    const dir = resolvePackageDir(bundle, moduleDirs, repoPackages);
    if (dir === undefined) continue;
    const layers = readBundleLayers(dir, bundle);
    if (layers.length > 0) layersByBundle.set(bundle, layers);
  }
  const bundles = allBundles.filter((specifier) => only === "" || specifier === only);
  const contextDraft: ScanContext = { outside, repoPackages, layersByBundle };
  const reports: BundleReport[] = bundles.map((bundle) => checkBundle(bundle, resolvePackageDir(bundle, moduleDirs, repoPackages), contextDraft));
  const bundleFails = printTable(reports, outside, verbose);
  const totalRows = reports.filter((r) => !r.foundation).reduce((sum, r) => sum + r.rows.filter((row) => row.kind === "riêng").length, 0);
  const totalReplaced = reports.filter((r) => !r.foundation).reduce((sum, r) => sum + r.rows.filter((row) => row.kind === "thay-thế").length, 0);
  const bundleCount = reports.filter((r) => !r.foundation).length;
  console.log("");
  console.log("TỔNG PHẦN A: " + String(bundleCount) + " bundle (bỏ qua " + String(reports.length - bundleCount) + " bundle nền) · " +
    String(totalRows) + " row riêng · " + String(totalReplaced) + " row thay-thế · " + String(bundleFails) + " FAIL");
  // PHẦN B (11/11/2026): công tắc TRONG UI phải có đường ghi — xem chú thích checkSwitchRegistration.
  const switchCases = scanSwitchWiring(repoPackages, moduleDirs);
  const switchFails = printSwitchTable(switchCases, verbose);
  const switchPass = switchCases.filter((item) => item.verdict === "PASS").length;
  console.log("");
  console.log("TỔNG PHẦN B: " + String(switchCases.length) + " ca · " + String(switchPass) + " PASS · " + String(switchFails) + " FAIL");
  // PHẦN C + PHẦN D (11/11/2026): mục bấm được trong Cài đặt phải có đường ghi tới settings/mutate, field phải có
  // trong schema của Host, và (với --rpc) một lượt ghi đổi-rồi-trả-lại phải chứng minh Host NHẬN giá trị mới.
  const surfaceFails = await runSettingsSurface({ repoRoot: REPO_ROOT, home, rpc: argv.includes("--rpc"), verbose });
  const fails = bundleFails + switchFails + surfaceFails;
  if (fails === 0) {
    console.log("KẾT LUẬN: PASS — (A) tắt bundle nào thì row của bundle đó biến mất khỏi cây config, không lớp ngoài nào cắm lại;");
    console.log("  (B) mọi công tắc UI mà bản gốc cấp hàm ghi đều có đường ghi ở bản của ta;");
    console.log("  (C) mọi mục bấm được trong Cài đặt khai đúng namespace + field và field có trong schema của Host;");
    console.log("  (D) mọi mục đo được bằng RPC đều GHI ĐƯỢC và đã trả lại giá trị cũ (chỉ in khi chạy --rpc).");
    return 0;
  }
  if (bundleFails > 0) {
    console.log("KẾT LUẬN PHẦN A: FAIL — " + String(bundleFails) + " row vẫn sống khi tắt bundle. Cách chữa: thêm \"ownedByBundle\": true vào");
    console.log("  gbh.row trong package.json của gói được in ở cột OWNED = KHÔNG, rồi xoá khối tương ứng trong parity.patch.yml (nếu có).");
  }
  if (switchFails > 0) {
    console.log("KẾT LUẬN PHẦN B: FAIL — " + String(switchFails) + " công tắc UI KHÔNG có hàm ghi ⇒ bấm không có tác dụng.");
    console.log("  Cách chữa: đăng ký slot của ta phải khai \"inject\" trả đúng hàm ghi của bản gốc (vd setEnabled), và component phải gọi nó.");
  }
  if (surfaceFails > 0) {
    console.log("KẾT LUẬN PHẦN C/D: FAIL — " + String(surfaceFails) + " mục Cài đặt có đường ghi hỏng/không ghi được.");
    console.log("  Cách chữa: (1) toạ độ render/ghi trôi ⇒ cập nhật bảng ở tools/check/settings-controls.ts;");
    console.log("  (2) field không có trong schema ⇒ sửa tên field cho khớp settings.describe;");
    console.log("  (3) Host từ chối settings/mutate ⇒ row của namespace đang bị lớp overlay app.patch.yml cắm/ghim:");
    console.log("      khai row đó ở patch của BUNDLE (packages/host/bundle/*.yml) để tài liệu người dùng ghi đè được.");
  }
  return 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
