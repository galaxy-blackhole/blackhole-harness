/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Sinh `profiles/blackhole/preset-redirect.patch.yml` (task-173): patch VĂN BẢN override `config` của các
 *      row preset stock (preset-standard/ptc/minimal/cordis) với `name` plugin đã đổi sang id GBH theo metadata
 *      `gbh.nested` của repo. Nhờ vậy `dsh --dump-config` (công cụ OFFLINE, không nạp plugin) cũng sạch id stock.
 *      11/11/2026: persona của ba preset "coding agent" dùng `{{model_label}}` thay `{{model}}` — route `auto`
 *      đọc là "Galaxy Blackhole", route khác vẫn in tên model thật (lỗi người dùng: prompt ghi deepseek-v4.1-flash).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { entryListSchema } from "@deepseek-ai/cordis-plugin-include";

/** Nạp CJS từ ESM (js-yaml không có .d.ts trong repo này). */
const requireCjs = createRequire(import.meta.url);

/** `load`/`dump` của js-yaml, kiểu tối thiểu — ĐÚNG dialect entry-list (`!!js`) nhờ `entryListSchema`. */
const yaml = requireCjs("js-yaml") as {
  load(text: string, options: { schema: unknown }): unknown;
  dump(value: unknown, options: Record<string, unknown>): string;
};

/** Gốc repo (packages/host/agent-preset/src ⇒ bốn cấp lên). */
const REPO = join(import.meta.dir, "..", "..", "..", "..");
/** Thư mục preset của gói stock CHỈ ĐỌC (nguồn duy nhất của định nghĩa preset). */
const STOCK_PRESETS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-app", "presets");
/** Tệp patch đích (do generator này sở hữu — ĐỪNG sửa tay). */
export const OUTPUT = join(REPO, "profiles", "blackhole", "preset-redirect.patch.yml");
/** Id các row preset cần override (đúng bốn preset của cây thật). */
const PRESET_IDS = ["preset-standard", "preset-ptc", "preset-minimal", "preset-cordis"] as const;
/** Tiền tố scope gói của ta. */
const OUR_SCOPE = "@galaxy-blackhole/";

/** Thư mục `profiles/node_modules` của app đang chạy (mặc định `~/.galaxy/blackhole`) — nơi phải TỒN TẠI đích redirect. */
const PROFILE_MODULES = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules");

/** Một khai báo `gbh.nested` đọc từ package.json trong repo. */
interface Declaration {
  /** Thư mục gói. */ readonly dir: string;
  /** Tên GÓI trong package.json (vd `@galaxy-blackhole/gbh-persona`) — đích của redirect. */ readonly name: string;
  /** Id stock cần đổi. */ readonly stockId: string;
}

/** Kết quả sinh patch. */
export interface GeneratedPatch {
  /** Toàn văn tệp patch (đã gồm header 5 dòng). */ readonly text: string;
  /** Id preset đã override. */ readonly presetIds: string[];
  /** Cảnh báo fail-soft (stockId không thấy preset, declaration không thấy trong preset…). */ readonly warnings: string[];
}

/**
 * Đọc mọi khai báo `gbh.nested` của repo.
 * Nhận: không. Trả: danh sách khai báo (khử trùng theo stockId) — rỗng khi repo chưa có khai báo nào.
 */
export function readDeclarations(): Declaration[] {
  const out: Declaration[] = [];
  const seen = new Set<string>();
  for (const tier of ["host", "client", "shared"]) {
    const tierDir = join(REPO, "packages", tier);
    let names: string[];
    try {
      names = readdirSync(tierDir).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      let manifest: { name?: string; gbh?: { nested?: unknown } };
      try {
        manifest = JSON.parse(readFileSync(join(tierDir, name, "package.json"), "utf8")) as { name?: string; gbh?: { nested?: unknown } };
      } catch {
        continue;
      }
      const nested = Array.isArray(manifest.gbh?.nested) ? manifest.gbh?.nested[0] : manifest.gbh?.nested;
      if (typeof nested !== "object" || nested === null) continue;
      const stockId = (nested as { stockId?: unknown }).stockId;
      if (typeof stockId !== "string" || stockId === "" || seen.has(stockId)) continue;
      seen.add(stockId);
      const packageName = typeof manifest.name === "string" && manifest.name !== "" ? manifest.name : OUR_SCOPE + "gbh-" + name;
      out.push({ dir: join(tierDir, name), name: packageName, stockId });
    }
  }
  return out;
}

/**
 * Đích redirect có THẬT trong profile hay không (gói tồn tại + có `lib/index.js`; với entry PHỤ `/x` thì gói cơ sở
 * phải khai subpath đó trong `exports`). Dùng để KHÔNG đổi tên khi đích chưa được cài — đổi mù sẽ làm Loader
 * không dựng nổi cây preset (triệu chứng thật 21/10/2026: preset `cordis` báo "Tải thất bại", log
 * "khong thay entry tool-schedule trong cay").
 * Nhận: specifier đích (có thể kèm subpath) và thư mục `profiles/node_modules`.
 * Trả: true khi đích phân giải được.
 */
export function resolvesInProfile(target: string, modulesDir: string = PROFILE_MODULES): boolean {
  const parts = target.split("/");
  const packageName = target.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? target);
  const subpath = parts.slice(target.startsWith("@") ? 2 : 1).join("/");
  const dir = join(modulesDir, packageName);
  if (!existsSync(join(dir, "lib", "index.js"))) return false;
  if (subpath === "") return true;
  try {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { exports?: Record<string, unknown> };
    return Object.prototype.hasOwnProperty.call(manifest.exports ?? {}, "./" + subpath);
  } catch {
    return false;
  }
}

/**
 * Đổi tên module trong một cây entry (mọi độ sâu, mọi hình dạng group) theo bản đồ redirect.
 * Nhận: value — cây config; redirects — bản đồ stockId → specifier của ta. Trả: cây MỚI.
 */
export function rewriteNames(value: unknown, redirects: ReadonlyMap<string, string>): unknown {
  /** Khớp chính xác trước, rồi khớp TIỀN TỐ cho entry phụ cùng gói (`/list-agents`). */
  const resolve = (name: string): string | undefined => {
    const exact = redirects.get(name);
    if (exact !== undefined) return exact;
    let best: string | undefined;
    for (const key of redirects.keys()) if (name.startsWith(key + "/") && (best === undefined || key.length > best.length)) best = key;
    return best === undefined ? undefined : (redirects.get(best) as string) + name.slice(best.length);
  };
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (typeof node !== "object" || node === null) return node;
    const record = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) out[key] = walk(item);
    const name = record["name"];
    if (typeof name === "string") {
      const target = resolve(name);
      if (target !== undefined && resolvesInProfile(target)) {
        // Đổi tên khi đích của TA có thật trong profile.
        out["name"] = target;
      } else if (!resolvesInProfile(name)) {
        // ⚠️ 21/10/2026 (task-187): entry trỏ module KHÔNG có trong profile (bản gốc DSH có, profile của ta thì
        // không) ⇒ Loader ném khi dựng cây ⇒ cả preset báo "Tải thất bại". Giữ nguyên tên nhưng TẮT entry —
        // sửa DỮ LIỆU, không che UI; và không đổi sang đích của ta khi đích đó cũng chưa cài.
        out["disabled"] = true;
      }
    }
    return out;
  };
  return walk(value);
}

/**
 * Đọc định nghĩa `config` của bốn row preset từ các tệp patch stock.
 * Nhận: không. Trả: bản đồ presetId → config gốc (giữ NGUYÊN mọi khoá) + id preset không tìm thấy.
 */
export function readStockPresetConfigs(): { readonly configs: ReadonlyMap<string, Record<string, unknown>>; readonly missing: readonly string[] } {
  const configs = new Map<string, Record<string, unknown>>();
  for (const file of readdirSync(STOCK_PRESETS).filter((name) => name.endsWith(".patch.yml")).sort()) {
    const text = readFileSync(join(STOCK_PRESETS, file), "utf8");
    const patches = yaml.load(text, { schema: entryListSchema }) as Array<{ insert?: Array<Record<string, unknown>> }> | undefined;
    for (const patch of patches ?? []) {
      for (const entry of patch.insert ?? []) {
        const id = entry["id"];
        if (typeof id !== "string" || !(PRESET_IDS as readonly string[]).includes(id)) continue;
        const config = entry["config"];
        if (typeof config !== "object" || config === null) continue;
        configs.set(id, config as Record<string, unknown>);
      }
    }
  }
  return { configs, missing: PRESET_IDS.filter((id) => !configs.has(id)) };
}

/**
 * Sinh toàn văn patch override: mỗi row preset một khối `- id: <preset>` + `config` ĐẦY ĐỦ (đã đổi tên).
 * Nhận: declarations — khai báo gbh.nested (mặc định đọc repo). Trả: GeneratedPatch.
 */
/**
 * Bản đồ ĐỔI TÊN theo PROVENANCE: mọi gói ta khai `gbh.provenance.stock` (hoặc `gbh.row.aliases`) đều sinh một cặp
 * stock → tên gói ta. Dùng để đổi tên các row preset/plugin mà gói đó CHƯA khai `gbh.nested` (đo 21/10/2026: 18 dòng
 * `name: '@deepseek-ai/...'` còn sót trong preset-redirect ⇒ màn Plugin hiện tên stock dù gói đã chuyển).
 * Nhận: không. Trả: bản đồ stockSpecifier → specifier của ta (rỗng khi chưa có provenance nào).
 */
export function readProvenanceRedirects(): Map<string, string> {
  const ra = new Map<string, string>();
  for (const tier of ["host", "client"]) {
    const goc = join(REPO, "packages", tier);
    let ten: string[];
    try {
      ten = readdirSync(goc);
    } catch {
      continue;
    }
    for (const thuMuc of ten) {
      let manifest: { name?: string; gbh?: { provenance?: { stock?: unknown }; row?: { aliases?: unknown } } };
      try {
        manifest = JSON.parse(readFileSync(join(goc, thuMuc, "package.json"), "utf8")) as typeof manifest;
      } catch {
        continue;
      }
      const ta = manifest.name;
      if (typeof ta !== "string" || ta === "") continue;
      const ds: string[] = [];
      const stock = manifest.gbh?.provenance?.stock;
      if (typeof stock === "string") ds.push(stock);
      const aliases = manifest.gbh?.row?.aliases;
      if (Array.isArray(aliases)) for (const a of aliases) if (typeof a === "string") ds.push(a);
      for (const s of ds) if (!ra.has(s)) ra.set(s, ta);
    }
  }
  return ra;
}

/** Persona stock của ba preset "coding agent" — in id model trên dây, kể cả khi route là `auto`. */
export const STOCK_PERSONA_PREFIX = "You are a coding agent powered by the {{model}} model.";

/** Persona của ta: nhãn HIỂN THỊ của route (route `auto` ⇒ "Galaxy Blackhole", route khác ⇒ id model thật). */
export const OUR_PERSONA_PREFIX = "You are a coding agent powered by the {{model_label}} model.";

/**
 * Đổi persona của MỌI row `persona` còn nguyên văn bản stock sang `{{model_label}}` (đệ quy cả group).
 * Vì sao: preset chạy sau persona của deployment nên `prefix` của nó QUYẾT ĐỊNH câu mở đầu; để nguyên
 * `{{model}}` thì route `auto` in ra "…deepseek-v4.1-flash model" — sai thương hiệu (lỗi người dùng 11/11/2026).
 * Chỉ đổi ĐÚNG chuỗi stock: preset nào tự đặt persona riêng (minimal) thì giữ nguyên.
 * Nhận: value — cây config của preset.
 * Trả: cây MỚI (không sửa đối tượng đầu vào).
 */
export function rewritePersonaPrefix(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(rewritePersonaPrefix);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) out[key] = rewritePersonaPrefix(item);
  if (out["prefix"] === STOCK_PERSONA_PREFIX) out["prefix"] = OUR_PERSONA_PREFIX;
  return out;
}

/**
 * Sinh toàn văn tệp patch đổi tên module trong bốn preset (standard · ptc · minimal · cordis).
 * Nhận: declarations — khai báo `gbh.nested` của repo (mặc định đọc từ manifest của mọi gói trong packages).
 * Trả: {@link GeneratedPatch} gồm toàn văn tệp, id preset đã override và cảnh báo fail-soft.
 */
export function generatePresetRedirect(declarations: Declaration[] = readDeclarations()): GeneratedPatch {
  // 21/10/2026 (task-204): GIU DUOI subpath khi doi ten. Truoc day map chi lay ten goi nen
  // '@deepseek-ai/dsh-plugin-manager/tools' thanh '@galaxy-blackhole/gbh-host-plugin-manager' (mat '/tools')
  // => realm preset nap lai MODULE CHINH => service 'pluginManager' dang ky LAN HAI => audit FAILED => preset
  // cordis bao "Tai that bai". Cong thuc: ten goi ta + duoi cua stockId sau phan '@scope/ten'.
  // 21/10/2026: gộp HAI nguồn — (1) provenance (đổi tên MỌI row còn tên stock), (2) khai báo `gbh.nested`
  // (giữ đuôi subpath như `/list-agents`). Khai báo thắng provenance vì nó chỉ đích chính xác hơn.
  const redirects = new Map<string, string>(readProvenanceRedirects());
  for (const declaration of declarations) {
    const phan = declaration.stockId.split("/");
    const gocStock = phan.slice(0, 2).join("/");
    const duoi = declaration.stockId.slice(gocStock.length);
    redirects.set(declaration.stockId, declaration.name + duoi);
  }
  const { configs, missing } = readStockPresetConfigs();
  const warnings: string[] = missing.map((id) => "preset-redirect: khong thay dinh nghia preset " + id + " trong stock ⇒ bo qua");
  const used = new Set<string>();
  const blocks: Array<{ id: string; config: unknown }> = [];
  for (const presetId of PRESET_IDS) {
    const config = configs.get(presetId);
    if (config === undefined) continue;
    // 11/11/2026: đổi persona SAU khi đổi tên — câu mở đầu phải là nhãn hiển thị của route, không phải id dây.
    const rewritten = rewritePersonaPrefix(rewriteNames(config, redirects)) as Record<string, unknown>;
    blocks.push({ id: presetId, config: rewritten });
    const text = JSON.stringify(config);
    for (const declaration of declarations) if (text.includes(declaration.stockId)) used.add(declaration.stockId);
  }
  for (const declaration of declarations) {
    if (!used.has(declaration.stockId)) warnings.push("preset-redirect: khong thay " + declaration.stockId + " trong preset nao ⇒ bo qua");
  }
  const header = [
    "# author Bùi Trọng Hiếu",
    "# email kevinbui210191@gmail.com",
    "# create date 15/10/2026",
    "# modify date 11/11/2026",
    "# desc PATCH SINH TU DONG (task-173) — override config.plugins cua 4 row preset stock voi id GBH theo gbh.nested.",
    "# 11/11/2026: persona cua standard/ptc/cordis dung {{model_label}} (auto ⇒ 'Galaxy Blackhole', khac ⇒ ten model that).",
    "# Sinh boi packages/host/agent-preset/src/preset-redirect.ts; DUNG SUA TAY. Include trong resolveLaunch.",
  ].join("\n");
  const body = yaml
    .dump(blocks, { schema: entryListSchema, lineWidth: -1, noRefs: true, sortKeys: false })
    .trimEnd();
  return { text: header + "\n\n" + body + "\n", presetIds: blocks.map((block) => block.id), warnings };
}

/**
 * Sinh patch rồi GHI ra `profiles/blackhole/preset-redirect.patch.yml`.
 * Nhận: không. Trả: kết quả đã sinh (kèm cảnh báo).
 */
export function writePresetRedirect(): GeneratedPatch {
  const generated = generatePresetRedirect();
  writeFileSync(OUTPUT, generated.text, "utf8");
  return generated;
}

if (import.meta.main) {
  const generated = writePresetRedirect();
  for (const warning of generated.warnings) console.warn("[bh] " + warning);
  console.log("GHI " + OUTPUT + " · preset " + String(generated.presetIds.length) + ": " + generated.presetIds.join(", "));
}

/**
 * Parse một tệp patch entry-list theo ĐÚNG dialect của loader (`!!js` round-trip) — dùng cho test dump-level.
 * Nhận: text — toàn văn YAML. Trả: danh sách block patch đã parse.
 */
export function parsePresetPatch(text: string): unknown[] {
  return (yaml.load(text, { schema: entryListSchema }) as unknown[] | undefined) ?? [];
}
