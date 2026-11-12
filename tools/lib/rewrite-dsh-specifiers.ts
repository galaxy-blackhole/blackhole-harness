/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Rewrite specifier `require("@deepseek-ai/…")` trong artefact client sang id GBH (task-151) — bản đồ 3 nguồn
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tools/lib ⇒ ../.. ⇒ repo root). */
const REPO = join(import.meta.dir, "..", "..");

/** Bản đồ specifier stock → specifier GBH. */
export type SpecifierMap = Map<string, string>;

/**
 * Gói đích có ĐĂNG KÝ MODULE trong module table không (có nửa client thật).
 * LUẬT (Lead chốt 19/10/2026, sau sự cố app đỏ): chỉ rewrite stock→ta khi gói đích CÓ nửa client
 * (`dsh.client` trong package.json + file `lib/client.js` tồn tại). Gói THƯ VIỆN không có mặt trong
 * module table ⇒ rewrite sang id ta làm `require` trượt ⇒ app chết (`missed the module table`).
 * Nhận: dir — thư mục gói đích. Trả: true khi gói đăng ký module client.
 */
export function targetHasClientModule(dir: string): boolean {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) return false;
  const json = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dsh?: { client?: unknown };
    exports?: Record<string, unknown>;
  };
  const coDshClient = json.dsh?.client !== undefined;
  if (!coDshClient) return false;
  // 20/10/2026: KHÔNG chỉ `lib/client.js`. Gói có export `./client` (vd typert-gateway: `lib/client-entry.js`)
  // vẫn ĐĂNG KÝ module client thật ⇒ phải rewrite được, nếu không id stock của nó còn mãi trong payload.
  const coExportClient = Object.hasOwn(json.exports ?? {}, "./client");
  return existsSync(join(dir, "lib", "client.js")) || (coExportClient && existsSync(join(dir, "lib", "client-entry.js")));
}

/**
 * Dựng bản đồ specifier từ 3 nguồn ưu tiên: (1) gbh.row.aliases/moduleIds, (2) gbh.provenance.stock,
 * (3) quy ước tên @deepseek-ai/dsh-X → @galaxy-blackhole/gbh-X khi package đích TỒN TẠI trong packages/*.
 * Nhận: không. Trả: SpecifierMap.
 */
export function buildSpecifierMap(): SpecifierMap {
  const map: SpecifierMap = new Map();
  const byName = new Map<string, string>();
  for (const group of ["client", "host"]) {
    const base = join(REPO, "packages", group);
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base)) {
      const p = join(base, dir, "package.json");
      if (!existsSync(p)) continue;
      const json = JSON.parse(readFileSync(p, "utf8")) as {
        name?: string;
        gbh?: { row?: { aliases?: string[]; moduleIds?: string[] }; row_unmounted_ly_do?: { row?: { aliases?: string[]; moduleIds?: string[] } }; provenance?: { stock?: string } };
      };
      const ours = json.name ?? "";
      if (ours === "") continue;
      byName.set(ours, ours);
      // LUẬT: gói thư viện (không có nửa client) KHÔNG được map — id stock của nó được seed/alias cung cấp.
      const coModule = targetHasClientModule(join(base, dir));
      if (!coModule) continue;
      const row = json.gbh?.row ?? json.gbh?.row_unmounted_ly_do?.row;
      const aliases = row?.aliases ?? [];
      const moduleIds = row?.moduleIds ?? [];
      for (const alias of aliases) map.set(alias, ours);
      for (const moduleId of moduleIds) map.set(moduleId, ours);
      const stock = json.gbh?.provenance?.stock;
      if (typeof stock === "string") map.set(stock, ours);
      // Nguồn (3): quy ước tên — bắt được gói thư viện không khai row/provenance.
      const ten = ours.replace("@galaxy-blackhole/gbh-", "");
      map.set("@deepseek-ai/dsh-" + ten, ours);
      map.set("@deepseek-ai/dsh-experimental-" + ten, ours);
    }
  }
  return map;
}

/**
 * Đổi specifier trong một văn bản artefact; trả về văn bản mới + số lần đổi + specifier chưa map.
 * Nhận: text — văn bản artefact; map — SpecifierMap. Trả: { text, rewrites, skipped }.
 */
export function rewriteSpecifiers(text: string, map: SpecifierMap): { text: string; rewrites: number; skipped: string[]; pairs: [string, string][] } {
  const skipped: string[] = [];
  const pairs: [string, string][] = [];
  let rewrites = 0;
  // Nhận cả `require(...)` và `requireFn(...)` (nhiều bundle ta dùng tên sau), cả nháy đơn/kép.
  const out = text.replace(/(\brequire(?:Fn)?)(\(\s*["\'])([^"\']+)(["\']\s*\))/g, (whole, fn: string, open: string, spec: string, close: string) => {
    const mapped = map.get(spec);
    if (mapped !== undefined) {
      rewrites += 1;
      pairs.push([spec, mapped]);
      return fn + open + mapped + close;
    }
    // Thử map theo gói gốc khi spec là subpath (vd …/client).
    const slash = spec.indexOf("/", spec.indexOf("/") + 1);
    if (slash > 0) {
      const root = spec.slice(0, slash);
      const tail = spec.slice(slash);
      const rootMapped = map.get(root);
      if (rootMapped !== undefined) {
        rewrites += 1;
        pairs.push([spec, rootMapped + tail]);
        return fn + open + rootMapped + tail + close;
      }
    }
    if (spec.startsWith("@deepseek-ai/")) skipped.push(spec);
    return whole;
  });
  return { text: out, rewrites, skipped, pairs };
}

/**
 * Rewrite TẠI CHỖ một artefact client + cổng đảo ngược (chỉ specifier được đổi).
 * Nhận: file — đường dẫn artefact. Trả: { rewrites, skipped }.
 */
export function rewriteArtifact(file: string): { rewrites: number; skipped: string[] } {
  const goc = readFileSync(file, "utf8");
  const map = buildSpecifierMap();
  const ket = rewriteSpecifiers(goc, map);
  if (ket.rewrites > 0) {
    // Cổng ĐẢO NGƯỢC: đổi specifier GBH về stock rồi so byte ⇒ chứng minh chỉ đổi specifier.
    const nguoc: SpecifierMap = new Map();
    for (const [from, to] of ket.pairs) nguoc.set(to, from);
    const khoiPhuc = rewriteSpecifiers(ket.text, nguoc).text;
    if (khoiPhuc !== goc) throw new Error("rewrite-dsh-specifiers: dao nguoc KHONG khop ⇒ co thay doi ngoai specifier");
    writeFileSync(file, ket.text);
  }
  return { rewrites: ket.rewrites, skipped: ket.skipped };
}