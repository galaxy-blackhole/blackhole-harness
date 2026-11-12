/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khử id DSH khỏi BẢNG MODULE WEB (task-137): đọc bản đồ alias do các gói ĐÃ MOUNT khai (gbh.row.aliases)
 *      rồi remap specifier `@deepseek-ai/dsh-*` → id của ta ĐÚNG LÚC DỰNG BẢNG. Không sửa manifest gói nào (giữ parity).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Tiền tố id gói của ta (dùng cho chẩn đoán, KHÔNG dùng để quyết định remap). */
export const OUR_SCOPE = "@galaxy-blackhole/";

/** Tiền tố id gói stock. */
export const STOCK_SCOPE = "@deepseek-ai/";

/**
 * Bản đồ id STOCK → id của TA, dựng từ metadata row của các gói đã mount.
 * Kiểu: Map<alias (id stock), tên package của ta>.
 */
export type DshAliasMap = ReadonlyMap<string, string>;

/**
 * Công tắc A/B: `GBH_DSH_REMAP=off|0|false` ⇒ TẮT remap (hành vi y như trước task-137).
 * Nhận: không. Trả: true khi remap được bật.
 */
export function dshRemapEnabled(): boolean {
  const raw = (process.env.GBH_DSH_REMAP ?? "").trim().toLowerCase();
  return raw !== "off" && raw !== "0" && raw !== "false";
}

/**
 * Thư mục node_modules của profile trong home app (`$GBH_HOME` hoặc `$DSH_HOME`).
 * Nhận: env — bản sao biến môi trường (mặc định process.env, cho test). Trả: đường dẫn (có thể không tồn tại).
 */
export function profileModulesDir(env: NodeJS.ProcessEnv = process.env): string {
  const home = (env.GBH_HOME ?? env.DSH_HOME ?? "").trim();
  if (home !== "") return join(home, "profiles", "node_modules");
  // 19/10/2026 (sự cố remap rỗng): `scripts/restart-host.sh` XOÁ GBH_HOME/DSH_HOME trước khi bật host ⇒ env rỗng
  // ⇒ trước đây trả "profiles/node_modules" (tương đối, không tồn tại) ⇒ bản đồ alias RỖNG ⇒ payload giữ id stock.
  // Fallback CHỈ ĐỌC, fail-soft: thử home mặc định của app rồi của dsh.
  const chinh = join(homedir(), ".galaxy", "blackhole", "profiles", "node_modules");
  if (existsSync(chinh)) return chinh;
  const phu = join(homedir(), ".dsh", "profiles", "node_modules");
  if (existsSync(phu)) return phu;
  return chinh;
}

/**
 * Đọc khai báo row (đã flip hoặc đang park) từ manifest.
 * Nhận: parsed — nội dung package.json đã parse. Trả: row hoặc undefined.
 */
function declaredRow(parsed: unknown): { aliases?: unknown; moduleIds?: unknown; stock?: unknown } | undefined {
  const gbh = (parsed as { gbh?: { row?: unknown; row_unmounted_ly_do?: { row?: unknown }; provenance?: { stock?: unknown } } } | undefined)?.gbh;
  if (gbh === undefined) return undefined;
  const row = (gbh.row ?? gbh.row_unmounted_ly_do?.row) as { aliases?: unknown; moduleIds?: unknown } | undefined;
  const stock = gbh.provenance?.stock;
  if (row === undefined && stock === undefined) return undefined;
  return { ...(row ?? {}), stock };
}

/**
 * Gói đích có ĐĂNG KÝ MODULE CLIENT không (có nửa client thật trong node_modules profile).
 * LUẬT (sự cố 19/10/2026): gói THƯ VIỆN không có mặt trong module table ⇒ remap sang id ta làm `require` trượt.
 * Nhận: pkgDir — thư mục gói đích. Trả: true khi có `dsh.client` + `lib/client.js`.
 */
function hasClientModule(pkgDir: string): boolean {
  const manifestPath = join(pkgDir, "package.json");
  if (!existsSync(manifestPath)) return false;
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as { dsh?: { client?: unknown } };
    return parsed.dsh?.client !== undefined && existsSync(join(pkgDir, "lib", "client.js"));
  } catch {
    return false;
  }
}

/**
 * Dựng bản đồ alias từ mọi package.json trong profile.
 * Vì sao quét TOÀN BỘ chứ không chỉ gói đang được phân giải: một consumer có thể được dựng meta TRƯỚC provider,
 * nên bản đồ phải đầy đủ ngay từ đầu (đúng thứ tự không xác định của Loader).
 * FAIL-SOFT: thiếu thư mục / JSON hỏng / mục lạ ⇒ bỏ qua, không ném; map rỗng ⇒ hành vi y như trước task-137.
 * Nhận: modulesDir — thư mục node_modules của profile (mặc định theo env). Trả: bản đồ alias.
 */
export function readDshAliasMap(modulesDir: string = profileModulesDir()): DshAliasMap {
  const map = new Map<string, string>();
  if (modulesDir === "" || !existsSync(modulesDir)) return map;
  let scopes: string[];
  try {
    scopes = readdirSync(modulesDir);
  } catch {
    return map;
  }
  for (const scope of scopes) {
    const scopeDir = join(modulesDir, scope);
    let names: string[];
    try {
      names = readdirSync(scopeDir);
    } catch {
      continue;
    }
    for (const name of names) {
      const manifestPath = join(scopeDir, name, "package.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown };
        const packageName = typeof parsed.name === "string" ? parsed.name : scope + "/" + name;
        const row = declaredRow(parsed);
        if (row === undefined) continue;
        // LUẬT 4: gói đích KHÔNG có module client (thư viện) ⇒ GIỮ NGUYÊN id stock.
        if (!hasClientModule(join(scopeDir, name))) continue;
        const aliases = Array.isArray(row.aliases) ? row.aliases.filter((item): item is string => typeof item === "string") : [];
        for (const alias of aliases) {
          if (alias === "" || alias === packageName) continue;
          map.set(alias, packageName);
        }
        // Nguồn (1b): moduleIds cũng là id stock ứng với gói này.
        const moduleIds = Array.isArray(row.moduleIds) ? row.moduleIds.filter((item): item is string => typeof item === "string") : [];
        for (const moduleId of moduleIds) {
          if (moduleId === "" || moduleId === packageName) continue;
          map.set(moduleId, packageName);
        }
        // Nguồn (2): gbh.provenance.stock.
        const stock = typeof row.stock === "string" ? row.stock : "";
        if (stock !== "" && stock !== packageName) map.set(stock, packageName);
        // Nguồn (3): quy ước tên — @deepseek-ai/dsh-X (và dsh-experimental-X) → tên package của TA.
        const ten = packageName.replace("@galaxy-blackhole/gbh-", "");
        if (ten !== packageName) {
          map.set("@deepseek-ai/dsh-" + ten, packageName);
          map.set("@deepseek-ai/dsh-experimental-" + ten, packageName);
        }
      } catch {
        continue;
      }
    }
  }
  return map;
}

/**
 * Remap MỘT specifier: có trong bản đồ ⇒ id của ta; KHÔNG có ⇒ giữ NGUYÊN (id lạ không bị đổi).
 * Nhận: specifier — tên module; map — bản đồ alias. Trả: specifier sau remap.
 */
export function remapSpecifier(specifier: string, map: DshAliasMap): string {
  const mapped = map.get(specifier);
  return mapped ?? specifier;
}

/**
 * Remap một danh sách GIỮ NGUYÊN ĐỘ DÀI + THỨ TỰ (không lọc trùng): số entry trong bảng inject phải KHÔNG đổi.
 * Nhận: list — danh sách specifier (có thể undefined); map — bản đồ alias. Trả: danh sách đã remap (hoặc undefined).
 */
export function remapSpecifiers(list: readonly string[] | undefined, map: DshAliasMap): readonly string[] | undefined {
  if (list === undefined) return undefined;
  if (map.size === 0) return list;
  return list.map((item) => remapSpecifier(item, map));
}