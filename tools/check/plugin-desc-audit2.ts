/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Audit mô tả plugin: tổng gói · số gói có bản vi · danh sách thiếu · số chuỗi "DeepSeek Harness"
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Thư mục repo (gốc blackhole-tauri). */
const REPO = join(import.meta.dir, "..", "..");

/** Chuỗi thương hiệu cũ phải bằng 0 trong mô tả người dùng thấy. */
const OLD_BRAND = "DeepSeek Harness";

/** Một gói có `gbh.row` cùng trạng thái mô tả của nó. */
interface Row {
  readonly name: string;
  readonly hasVi: boolean;
  readonly viInTable: boolean;
}

/**
 * Đọc `meta.description` tiếng Việt của một thư mục gói.
 * @param dir - thư mục gói.
 * @returns mô tả tiếng Việt hoặc undefined.
 */
function viDescription(dir: string): string | undefined {
  const file = join(dir, "locale", "vi.json");
  if (!existsSync(file)) return undefined;
  const locale = JSON.parse(readFileSync(file, "utf8")) as { meta?: { description?: string } };
  const text = locale.meta?.description;
  return text === undefined || text.trim() === "" ? undefined : text;
}

/**
 * Liệt kê mọi gói khai `gbh.row` trong `packages/<tier>/<pkg>`.
 * @returns danh sách gói kèm trạng thái mô tả tiếng Việt.
 */
function collect(): Row[] {
  const tableFile = join(REPO, "packages", "client", "ui-plugin-manager", "src", "plugin-descriptions.ts");
  const table = existsSync(tableFile) ? readFileSync(tableFile, "utf8") : "";
  const rows: Row[] = [];
  for (const tier of ["client", "host", "tools"]) {
    const base = join(REPO, "packages", tier);
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base)) {
      const pkgFile = join(base, dir, "package.json");
      if (!existsSync(pkgFile)) continue;
      const meta = JSON.parse(readFileSync(pkgFile, "utf8")) as { name?: string; gbh?: { row?: unknown }; description?: string };
      if (meta.gbh?.row === undefined || meta.name === undefined) continue;
      rows.push({ name: meta.name, hasVi: viDescription(join(base, dir)) !== undefined, viInTable: table.includes(JSON.stringify(meta.name)) });
    }
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * In báo cáo audit và trả mã thoát theo số gói còn thiếu bản vi.
 * @returns 0 khi mọi gói có bản vi, 1 khi còn thiếu.
 */
function main(): number {
  const rows = collect();
  const missing = rows.filter((row) => !row.hasVi && !row.viInTable);
  const brand = rows.filter((row) => row.name.includes(OLD_BRAND)).length;
  const descBrand = (() => {
    let count = 0;
    for (const tier of ["client", "host", "tools"]) {
      const base = join(REPO, "packages", tier);
      if (!existsSync(base)) continue;
      for (const dir of readdirSync(base)) {
        const text = viDescription(join(base, dir));
        if (text !== undefined && text.includes(OLD_BRAND)) count += 1;
      }
    }
    return count;
  })();
  console.log("[plugin-desc] tong goi co gbh.row      : " + String(rows.length));
  console.log("[plugin-desc] so goi co mo ta tieng Viet: " + String(rows.filter((row) => row.hasVi || row.viInTable).length));
  console.log("[plugin-desc] so goi con THIEU          : " + String(missing.length));
  for (const row of missing.slice(0, 20)) console.log("    - " + row.name);
  console.log("[plugin-desc] chuoi \"" + OLD_BRAND + "\" trong ten goi: " + String(brand) + " · trong mo ta vi: " + String(descBrand));
  return missing.length === 0 ? 0 : 1;
}

process.exit(main());
