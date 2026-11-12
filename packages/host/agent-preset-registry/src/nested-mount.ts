/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc ADR 0007 — mount row LONG (preset/group): doc ban do redirect `stockId -> specifier cua ta` tu metadata
 *      `gbh.nested` cua cac goi DA COPY vao profile, roi viet lai `name` trong danh sach plugins cua preset
 *      TRUOC khi prepareProfileEntries import. Fail-soft: thieu goi ⇒ giu ten stock + 1 dong canh bao, khong nem.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Khoa metadata trong package.json cua goi ta: khai bao plugin stock nao bi thay trong preset. */
export const NESTED_METADATA_KEY = "nested";

/** Mot khai bao mount row long. */
export interface NestedDeclaration {
  /** Ten module STOCK bi thay (khoa cua ban do redirect). */
  readonly stockId: string;
  /**
   * Loai row long: `preset` (plugin trong config.plugins cua PRESET — registry redirect xu ly) hay
   * `group` (con cua row cordis:group — do apps/cli/src/profile.ts sinh khoi patch, KHONG xu ly o day).
   * Mac dinh `preset` de tuong thich nguoc.
   */
  readonly kind?: "preset" | "group";
  /** Cac preset chua plugin nay; rong/khong khai = moi preset. */
  readonly presets?: readonly string[];
}

/** Ket qua doc ban do redirect: ban do + canh bao (fail-soft, KHONG nem). */
export interface NestedRedirects {
  /** stockId -> specifier cua ta. */
  readonly map: ReadonlyMap<string, string>;
  /** Cac dong canh bao (moi dong la mot goi khong dung duoc). */
  readonly warnings: readonly string[];
}

/**
 * Thu muc `node_modules` cua profile app: `<GBH_HOME|DSH_HOME>/profiles/node_modules`.
 * Nhan: khong. Tra: duong dan tuyet doi (khong kiem ton tai — noi goi tu quyet).
 */
export function profileModulesDir(): string {
  const home = process.env.GBH_HOME ?? process.env.DSH_HOME ?? "";
  return join(home, "profiles", "node_modules");
}

/**
 * Doc khai bao nested tu mot package.json da copy vao profile.
 * Nhan: text — noi dung package.json. Tra: khai bao hoac undefined.
 */
function readDeclaration(text: string): NestedDeclaration | undefined {
  let parsed: { gbh?: unknown };
  try {
    parsed = JSON.parse(text) as { gbh?: unknown };
  } catch {
    return undefined;
  }
  const gbh = parsed.gbh;
  if (typeof gbh !== "object" || gbh === null) return undefined;
  const nested = (gbh as Record<string, unknown>)[NESTED_METADATA_KEY];
  const value = Array.isArray(nested) ? nested[0] : nested;
  if (typeof value !== "object" || value === null) return undefined;
  const stockId = (value as { stockId?: unknown }).stockId;
  if (typeof stockId !== "string" || stockId.trim() === "") return undefined;
  const presets = (value as { presets?: unknown }).presets;
  const list = Array.isArray(presets) ? presets.filter((item): item is string => typeof item === "string") : undefined;
  const kind = (value as { kind?: unknown }).kind === "group" ? "group" : "preset";
  return { stockId, kind, ...(list === undefined ? {} : { presets: list }) };
}

/**
 * Doc ban do redirect tu cac goi da copy vao profile (`@galaxy-blackhole/*`).
 * FAIL-SOFT: goi khai `gbh.nested` nhung CHUA co `lib/index.js` trong profile thi BO QUA + ghi canh bao
 * (khong nem) — vi nem o day se lam chet ca cay boot nhu su co settings 18/10/2026.
 * Nhan: modulesDir — thu muc node_modules cua profile (mac dinh profileModulesDir()).
 * Tra: ban do + canh bao.
 */
export function readNestedRedirects(modulesDir: string = profileModulesDir()): NestedRedirects {
  const map = new Map<string, string>();
  const warnings: string[] = [];
  // Công tắc A/B (ADR 0007 §7.4): GBH_NESTED_REDIRECT=off ⇒ KHÔNG redirect gì (giữ nguyên tên stock) để đo
  // đối chứng "có cơ chế" vs "không cơ chế" trên CÙNG một bản dựng. Mặc định = bật.
  const mode = (process.env.GBH_NESTED_REDIRECT ?? "").trim().toLowerCase();
  if (mode === "off" || mode === "0" || mode === "false") {
    return { map, warnings: ["agent-preset: GBH_NESTED_REDIRECT=" + mode + " ⇒ TAT redirect row long (che do A/B)"] };
  }
  const scopeDir = join(modulesDir, "@galaxy-blackhole");
  if (!existsSync(scopeDir)) return { map, warnings };
  let entries: string[];
  try {
    entries = readdirSync(scopeDir).sort();
  } catch (error) {
    return { map, warnings: ["agent-preset: khong doc duoc " + scopeDir + ": " + String(error)] };
  }
  for (const name of entries) {
    const dir = join(scopeDir, name);
    const manifestPath = join(dir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const declaration = readDeclaration(readFileSync(manifestPath, "utf8"));
    if (declaration === undefined) continue;
    if (!existsSync(join(dir, "lib", "index.js"))) {
      warnings.push("agent-preset: goi " + name + " khai gbh.nested nhung CHUA co lib/index.js trong profile ⇒ giu ten stock " + declaration.stockId);
      continue;
    }
    // 19/10/2026 — BỎ nhánh bỏ qua kind='group' (lỗ hổng cơ chế #2, đo từ log app): group TOP-LEVEL đã được patch
    // thay tên trước nên map không khớp (không tác dụng phụ), còn group nằm TRONG `config.plugins` của preset thì
    // patch KHÔNG thấy (vd nhóm `persistent-shell` chỉ có trong presets/minimal.patch.yml) ⇒ PHẢI để registry thay.
    map.set(declaration.stockId, "@galaxy-blackhole/" + name);
  }
  return { map, warnings };
}

/**
 * Viet lai `name` cua cac entry plugin LONG theo ban do redirect (giu nguyen id/config/disabled/group o MOI do sau).
 * Nhan: plugins — danh sach entry cua preset; redirects — ban do stockId -> specifier; presetId — loc theo khai bao.
 * Tra: danh sach MOI (khong sua tham so vao) — idempotent: chay hai lan cho cung ket qua.
 */
export function rewriteNestedNames(
  plugins: readonly unknown[],
  redirects: ReadonlyMap<string, string>,
  presetId?: string,
): unknown[] {
  /**
   * Đổi một tên module theo bản đồ: ưu tiên khớp CHÍNH XÁC, sau đó khớp TIỀN TỐ cho entry phụ cùng gói
   * (vd `@deepseek-ai/dsh-tool-subagent-control/list-agents` ⇒ gói ta + `/list-agents`).
   * Nhận: name — tên module trong entry. Trả: tên mới, hoặc undefined khi không khớp.
   */
  const resolve = (name: string): string | undefined => {
    const exact = redirects.get(name);
    if (exact !== undefined) return exact;
    let best: string | undefined;
    for (const key of redirects.keys()) {
      if (name.startsWith(key + "/") && (best === undefined || key.length > best.length)) best = key;
    }
    if (best === undefined) return undefined;
    return redirects.get(best)! + name.slice(best.length);
  };
  const replaceName = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(replaceName);
    if (typeof value !== "object" || value === null) return value;
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) out[key] = key === "name" ? item : replaceName(item);
    const name = record["name"];
    if (typeof name === "string") {
      const target = resolve(name);
      if (target !== undefined) out["name"] = target;
    }
    return out;
  };
  void presetId;
  return plugins.map(replaceName);
}

/**
 * Có phải TÊN MODULE STOCK mà bản đồ chưa phủ hay không (khớp chính xác hoặc theo tiền tố entry phụ).
 * Nhận: name — tên module; redirects — bản đồ hiện có. Trả: true khi tên KHÔNG được bản đồ xử lý.
 */
export function isUnresolvedStockName(name: string, redirects: ReadonlyMap<string, string>): boolean {
  if (redirects.has(name)) return false;
  for (const key of redirects.keys()) if (name.startsWith(key + "/")) return false;
  return true;
}

/**
 * Thu mọi tên module trong một cây entry (đệ quy qua mảng/đối tượng, MỌI độ sâu).
 * Nhận: value — cây cấu hình. Trả: danh sách tên duy nhất theo thứ tự gặp.
 */
export function collectEntryNames(value: unknown): string[] {
  const names: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    const name = record["name"];
    if (typeof name === "string") names.push(name);
    for (const [key, item] of Object.entries(record)) if (key !== "name") walk(item);
  };
  walk(value);
  return names;
}

/**
 * Có phải ROW NHÓM của Loader cordis hay không (`name: cordis:group` hoặc cờ `group: true`).
 * Nhận: một row bất kỳ trong cây cấu hình.
 * Trả: true khi row là nhóm (con của nó nằm trong `config`, không phải plugin độc lập).
 */
export function isGroupRow(row: unknown): boolean {
  if (typeof row !== "object" || row === null) return false;
  const record = row as Record<string, unknown>;
  return record["group"] === true || record["name"] === "cordis:group";
}

/**
 * Viết lại `name` của các CON nằm trong MỘT row NHÓM (`cordis:group`) theo bản đồ redirect, giữ nguyên
 * `id`/`group`/`isolate`/`disabled` và mọi `config` của con. Nhận CẢ HAI hình dạng `config` đang có trong
 * cấu hình thật: MẢNG (`config: [ {id,name} … ]` — vd row top-level `optional-session-search`) và ĐỐI TƯỢNG
 * (`config: { plugins: [ … ] }` — vd nhóm `planning`/`compaction` lồng trong preset).
 * Nhận: row (không sửa tham số vào) và bản đồ `stockId -> specifier`.
 * Trả: row MỚI; row không phải nhóm trả nguyên bản sao KHÔNG đổi.
 */
export function rewriteGroupChildren(row: unknown, redirects: ReadonlyMap<string, string>): unknown {
  if (!isGroupRow(row)) return rewriteNestedNames([row], redirects)[0];
  const record = row as Record<string, unknown>;
  const config = record["config"];
  if (config === undefined) return { ...record };
  const rewrittenConfig = Array.isArray(config)
    ? rewriteNestedNames(config, redirects)
    : typeof config === "object" && config !== null
      ? (rewriteNestedNames([config], redirects)[0] as Record<string, unknown>)
      : config;
  return { ...record, config: rewrittenConfig };
}

/**
 * Viết lại con của MỌI row nhóm trong một danh sách row (dùng cho cây cấu hình top-level).
 * Nhận: danh sách row của profile và bản đồ redirect.
 * Trả: danh sách MỚI — row không phải nhóm đi qua `rewriteNestedNames` (giữ nguyên nếu không khớp).
 */
export function rewriteGroupRows(
  rows: readonly unknown[],
  redirects: ReadonlyMap<string, string>,
): unknown[] {
  if (redirects.size === 0) return rows.map((row) => (typeof row === "object" && row !== null ? { ...(row as Record<string, unknown>) } : row));
  return rows.map((row) => rewriteGroupChildren(row, redirects));
}
