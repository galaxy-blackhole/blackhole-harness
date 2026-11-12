/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Do HO SO CHI PHI cua mot row truoc khi viet lai — vi so dong build KHONG ti le voi cong viet lai
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { bootJson } from "./app-health";
import { join } from "node:path";
import { ROOT, readMatrix, readStock } from "../scaffold/lib";

/** Thu muc chua ban goc cua DSH. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/**
 * Do ho so chi phi cua mot row: cac con so quyet dinh cong viet lai, khong chi kich thuoc.
 * @param rowId - id row (hoac ten package goc).
 * @returns dong tom tat, hoac null neu khong tim thay row.
 */
/** Ho so chi phi cua mot row: cac con so quyet dinh cong viet lai. */
export interface RowCost {
  /** Id row. */
  rowId: string;
  /** Ten package goc. */
  stock: string;
  /** So dong JS cua ban build goc (TINH CA chunk lazy chua thu vien). */
  lines: number;

  /** So dong cua CHINH row (khong tinh chunk lazy). */
  entryLines: number;

  /** So dong trong chunk lazy (phan lon la thu vien ben thu ba). */
  chunkLines: number;
  /** So service trong `dsh.client.inject` cua ban goc. */
  injects: number;
  /** So primitive/hook dinh danh duoc trong bundle. */
  primitives: number;
  /** So khoa tu dien uoc luong. */
  localeKeys: number;
  /** Co trang thai song (watch/observe/subscribe) khong. */
  live: boolean;
}

/**
 * Do ho so chi phi cua mot row.
 * @param rowId - id row (hoac ten package goc).
 * @returns ho so, hoac null neu khong tim thay row.
 */
export function profileOf(rowId: string): RowCost | null {
  const row = readMatrix().find((r) => r.rowId === rowId) ?? readMatrix().find((r) => r.stock.endsWith("/" + rowId));
  if (row === undefined) return null;
  const name = row.stock.split("/").pop() ?? "";
  const clientFile = join(STOCK, name, "lib", "client.js");
  const hostFile = join(STOCK, name, "lib", "index.js");
  const client = existsSync(clientFile) ? readFileSync(clientFile, "utf8") : "";
  const host = existsSync(hostFile) ? readFileSync(hostFile, "utf8") : "";
  const all = client + host;
  const prims = new Set<string>();
  for (const m of all.matchAll(/(?:Icon|use)[A-Z][A-Za-z0-9]+/g)) prims.add(m[0]);
  for (const m of all.matchAll(/require\(\"[^\"]*ui-primitives[^\"]*\"\)\.([A-Za-z0-9_$]+)/g)) if (m[1] !== undefined) prims.add(m[1]);
  const localeKeys = new Set<string>();
  for (const m of all.matchAll(/zh\s*:\s*\{/g)) {
    const from = (m.index ?? 0) + m[0].length;
    const chunk = all.slice(from, from + 4000);
    let depth = 1;
    let end = chunk.length;
    for (let i = 0; i < chunk.length; i += 1) {
      if (chunk[i] === "{") depth += 1;
      else if (chunk[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    for (const k of chunk.slice(0, end).matchAll(/([A-Za-z][A-Za-z0-9_.]{2,40})\s*:/g)) if (k[1] !== undefined) localeKeys.add(k[1]);
  }
  if (localeKeys.size === 0) {
    for (const k of all.matchAll(/\"([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)\"\s*:\s*\"/g)) if (k[1] !== undefined) localeKeys.add(k[1]);
  }
  const manifest = existsSync(join(STOCK, name, "package.json")) ? (JSON.parse(readFileSync(join(STOCK, name, "package.json"), "utf8")) as { dsh?: { client?: { inject?: unknown } } }) : {};
  const injectRaw = manifest.dsh?.client?.inject;
  return {
    rowId: row.rowId, stock: row.stock, lines: readStock(row.stock).builtLines,
    entryLines: readStock(row.stock).entryLines, chunkLines: readStock(row.stock).chunkLines,
    injects: Array.isArray(injectRaw) ? injectRaw.length : injectRaw === undefined ? 0 : 1,
    primitives: prims.size, localeKeys: localeKeys.size,
    live: /\b(watch|observe|subscribe|stream|onChange|useEffect)\b/.test(client),
  };
}

/**
 * In ho so chi phi duoi dang van ban doc duoc.
 * @param rowId - id row (hoac ten package goc).
 * @returns van ban, hoac null neu khong tim thay row.
 */
export function rowCost(rowId: string): string | null {
  const c = profileOf(rowId);
  if (c === null) return null;
  return [
    "row " + c.rowId + "  (" + c.stock + ")",
    "  dong CUA ROW       : " + c.entryLines + "   <- con so that de uoc luong cong viet lai",
    "  dong chunk lazy    : " + c.chunkLines + (c.chunkLines > 0 ? "   (phan lon la THU VIEN ben thu ba, khong phai code cua row)" : ""),
    "  dong build JS tong : " + c.lines,
    "  inject             : " + c.injects,
    "  primitive (uoc)    : " + c.primitives,
    "  khoa tu dien (uoc) : " + c.localeKeys,
    "  trang thai song    : " + (c.live ? "CO" : "khong thay"),
  ].join("\n");
}

/** @deprecated dung [[rowCost]] hoac [[profileOf]]. */
function legacyRowCost(rowId: string): string | null {
  const row = readMatrix().find((r) => r.rowId === rowId) ?? readMatrix().find((r) => r.stock.endsWith("/" + rowId));
  if (row === undefined) return null;
  const name = row.stock.split("/").pop() ?? "";
  const clientFile = join(STOCK, name, "lib", "client.js");
  const hostFile = join(STOCK, name, "lib", "index.js");
  const client = existsSync(clientFile) ? readFileSync(clientFile, "utf8") : "";
  const host = existsSync(hostFile) ? readFileSync(hostFile, "utf8") : "";
  const all = client + host;
  // Primitive dung tu ui-primitives: dem ten dinh danh duoc require/destructure.
  const prims = new Set<string>();
  for (const m of all.matchAll(/(?:Icon|use)[A-Z][A-Za-z0-9]+/g)) prims.add(m[0]);
  for (const m of all.matchAll(/require\(\"[^\"]*ui-primitives[^\"]*\"\)\.([A-Za-z0-9_$]+)/g)) if (m[1] !== undefined) prims.add(m[1]);
  // Khoa tu dien: dem cac chuoi trong loi goi register cua locale.
  // Khoa tu dien: trong bundle, tu dien la object co ca `en` lan `zh`; dem khoa trong khoi `zh`
  // (giong het `en`). Day la con so quyet dinh cong viet lai — khong suy ra duoc, chi doc duoc.
  const localeKeys = new Set<string>();
  for (const m of all.matchAll(/zh\s*:\s*\{/g)) {
    const from = (m.index ?? 0) + m[0].length;
    const chunk = all.slice(from, from + 4000);
    let depth = 1;
    let end = chunk.length;
    for (let i = 0; i < chunk.length; i += 1) {
      if (chunk[i] === "{") depth += 1;
      else if (chunk[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    for (const k of chunk.slice(0, end).matchAll(/([A-Za-z][A-Za-z0-9_.]{2,40})\s*:/g)) if (k[1] !== undefined) localeKeys.add(k[1]);
  }
  // Trang thai song: co watcher/stream/subscribe thi cong viet lai tang manh.
  const live = /\b(watch|observe|subscribe|stream|onChange|useEffect)\b/.test(client);
  // Du phong khi khong tim thay khoi `zh:{`: dem cac khoa duong dan (dotted) gan voi chuoi,
  // dung hinh dang cua khoa tu dien DSH ("terminal.exitCode": "exit {code}").
  if (localeKeys.size === 0) {
    for (const k of all.matchAll(/\"([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)\"\s*:\s*\"/g)) if (k[1] !== undefined) localeKeys.add(k[1]);
    if (localeKeys.size === 0) localeKeys.add("(khong do duoc — bundle khong giu khoa duong dan dang chuoi)");
  }
  // So inject: doc tu metadata cua ban goc (`dsh.client.inject`), khong co trong ma tran.
  const manifest = existsSync(join(STOCK, name, "package.json")) ? (JSON.parse(readFileSync(join(STOCK, name, "package.json"), "utf8")) as { dsh?: { client?: { inject?: unknown } } }) : {};
  const injectRaw = manifest.dsh?.client?.inject;
  const injects = Array.isArray(injectRaw) ? injectRaw.length : injectRaw === undefined ? 0 : 1;
  const lines = readStock(row.stock).builtLines;
  return [
    "row " + row.rowId + "  (" + row.stock + ")",
    "  dong build JS      : " + lines,
    "  inject             : " + injects,
    "  primitive (uoc)    : " + prims.size + (prims.size > 0 ? "  [" + [...prims].slice(0, 8).join(", ") + "]" : ""),
    "  khoa tu dien (uoc) : " + localeKeys.size,
    "  trang thai song    : " + (live ? "CO (watch/observe/subscribe/useEffect)" : "khong thay"),
    "  => cong viet lai KHONG ti le voi " + lines + " dong.",
  ].join("\n");
}

/**
 * Diem vao CLI: in ho so chi phi cho mot hoac nhieu row.
 * @returns ma thoat tien trinh.
 */
function main(): number {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    const rows = readMatrix().filter((r) => r.tier.startsWith("T3"));
    console.log("Chua truyen row nao. Vi du: bun run row:cost ui-jobs");
    console.log("Row T3 chua co package (nen do truoc khi nhan):");
    for (const r of rows.slice(0, 10)) console.log("  " + r.rowId);
    return 0;
  }
  for (const id of ids) {
    const out = rowCost(id);
    console.log(out === null ? "khong tim thay row " + id : out);
    console.log("");
  }
  return 0;
}

// Chi chay CLI khi file nay DUOC GOI TRUC TIEP — neu thieu guard nay thi moi lan import no
// se chay luon CLI cua no (loi that: m5-status.ts import row-cost.ts va bi no 'cuop' mat luong).
if (import.meta.main) process.exit(main());

/**
 * Do BAN KINH NO: bao nhieu row khac inject package nay (doc tu payload __GBH_BOOT__ (alias __DSH_BOOT__) that).
 * Chi phi (primitive + khoa) KHONG do duoc rui ro: row `locale` chi 13 diem nhung 48 row phu thuoc
 * va entry cua no la `immediately` (pha bootstrap) — thieu mot ham la MOI row UI mat tu dien.
 * @param pkg - ten package goc (vi du "@deepseek-ai/dsh-client-locale").
 * @returns so row inject no, hoac -1 neu khong doc duoc payload.
 */
export async function blastRadius(pkg: string): Promise<number> {
  const file = join(homedir(), ".galaxy", "blackhole", "ready-url.txt");
  if (!existsSync(file)) return -1;
  try {
    const url = readFileSync(file, "utf8").trim();
    const first = await fetch(url, { redirect: "manual" });
    const cookie = (first.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const html = first.status === 200 ? await first.text() : await (await fetch(new URL(url).origin + "/", { headers: cookie ? { cookie } : {} })).text();
    const raw = bootJson(html);
    if (raw === null) return -1;
    const json = JSON.parse(raw) as { entries?: { inject?: string[] }[] };
    let n = 0;
    for (const e of json.entries ?? []) for (const i of e.inject ?? []) if (i === pkg) n += 1;
    return n;
  } catch {
    return -1;
  }
}