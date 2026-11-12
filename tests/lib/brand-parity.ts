/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 20/10/2026
 * modify date 20/10/2026
 * desc Chuẩn hoá ĐỐI XỨNG token brand cho test parity: artefact của ta mang `--gbh-*`/`__GBH_*` (đổi tên CÓ CHỦ ĐÍCH,
 *      HANDOVER §10) còn bản stock mang `--dsh-*`/`__DSH_*`. Quy NGƯỢC cả hai vế về DSH trước khi so byte/sha,
 *      GIỮ NGUYÊN 4 tên vỏ dist `__GBH_BOOT__` · `__GBH_BOOT_READY__` · `__GBH_TRANSPORT__` · `__GBH_CODE_ICON_INSTANCE__`.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** 4 định danh vỏ SPA dist — KHÔNG được quy ngược (vỏ đọc đúng tên GBH này). */
export const DIST_READ_NAMES: readonly string[] = Object.freeze([
  "__GBH_BOOT__",
  "__GBH_BOOT_READY__",
  "__GBH_TRANSPORT__",
  "__GBH_CODE_ICON_INSTANCE__",
]);

/**
 * Quy NGƯỢC token brand GBH → DSH trên một văn bản, giữ nguyên 4 tên vỏ dist.
 * Nhận: text — văn bản artefact (của ta hoặc stock).
 * Trả: văn bản chuẩn hoá (vỏ dist giữ `__GBH_*`, còn lại thành `__DSH_*`/`--dsh-*`).
 */
export function normalizeBrand(text: string): string {
  const che: string[] = [];
  let tam = text;
  DIST_READ_NAMES.forEach((ten, chiSo) => {
    const mau = "\u0000BRAND_TEST_" + String(chiSo) + "\u0000";
    che.push(ten);
    tam = tam.split(ten).join(mau);
  });
  tam = tam.split("__GBH_").join("__DSH_").split("--gbh-").join("--dsh-");
  return tam.replace(/\u0000BRAND_TEST_(\d+)\u0000/gu, (_khop, chiSo: string) => che[Number(chiSo)] ?? "");
}

/**
 * So HAI văn bản sau khi chuẩn hoá brand ĐỐI XỨNG ở cả hai vế.
 * Nhận: mot — văn bản thứ nhất; hai — văn bản thứ hai.
 * Trả: true khi bằng nhau sau chuẩn hoá.
 */
export function brandEqual(mot: string, hai: string): boolean {
  return normalizeBrand(mot) === normalizeBrand(hai);
}

/**
 * sha256 (hex) của văn bản ĐÃ chuẩn hoá brand — dùng khi test canh sha của artefact.
 * Nhận: text — văn bản artefact.
 * Trả: chuỗi hex 64 ký tự.
 */
export function sha256Brand(text: string): string {
  return createHash("sha256").update(normalizeBrand(text), "utf8").digest("hex");
}

/** Bản đồ id ta → id stock, dựng từ manifest các gói (provenance/aliases/nested.stockId). */
let idMapCache: Map<string, string> | undefined;

/**
 * Dựng (và cache) bản đồ id gói CỦA TA → id gói STOCK tương ứng.
 * Nhận: không.
 * Trả: Map id-ta → id-stock (gồm cả biến thể subpath `/client`).
 */
/**
 * Nam ID AO do vo SPA cap luc chay (khong phai goi npm) -> ten tuong ung cua ta.
 *
 * Vi sao can: cac id nay khong co gbh.provenance.stock nen bang quy doi theo manifest khong biet chung;
 * thieu bang nay thi moi phep so artefact voi bundle goc se do ngay khi ta doi ten id (P3).
 */
export const VIRTUAL_IDS: ReadonlyMap<string, string> = new Map([
  ['@galaxy-blackhole/gbh-client-store', '@deepseek-ai/dsh-client-store'],
  ['@galaxy-blackhole/gbh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-primitives'],
  ['@galaxy-blackhole/gbh-client-ui-slots', '@deepseek-ai/dsh-client-ui-slots'],
  ['@galaxy-blackhole/gbh-client-ui-dockkit', '@deepseek-ai/dsh-client-ui-dockkit'],
  ['@galaxy-blackhole/gbh-typert-generator', '@deepseek-ai/dsh-typert-generator'],
]);

export function ourToStockIds(): Map<string, string> {
  if (idMapCache !== undefined) return idMapCache;
  const map = new Map<string, string>(VIRTUAL_IDS);
  const root = join(import.meta.dir, "..", "..");
  for (const org of readdirSync(join(root, "packages"))) {
    const orgDir = join(root, "packages", org);
    let entries: string[];
    try { entries = readdirSync(orgDir); } catch { continue; }
    for (const dir of entries) {
      const manifestPath = join(orgDir, dir, "package.json");
      if (!existsSync(manifestPath)) continue;
      let pkg: Record<string, unknown>;
      try { pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>; } catch { continue; }
      const name = typeof pkg.name === "string" ? pkg.name : undefined;
      const gbh = pkg.gbh as Record<string, unknown> | undefined;
      if (name === undefined || gbh === undefined) continue;
      const provenance = gbh.provenance as { stock?: unknown } | undefined;
      const row = gbh.row as { aliases?: unknown[] } | undefined;
      const park = (gbh.row_unmounted_ly_do as { row?: { aliases?: unknown[] } } | undefined)?.row;
      const nested = gbh.nested as { stockId?: unknown } | undefined;
      let stock = typeof provenance?.stock === "string" ? provenance.stock
        : typeof row?.aliases?.[0] === "string" ? row.aliases[0]
        : typeof park?.aliases?.[0] === "string" ? park.aliases[0]
        : typeof nested?.stockId === "string" ? nested.stockId
        : undefined;
      // 20/10/2026 — nhiều gói KHÔNG khai provenance/aliases: suy id stock theo QUY ƯỚC tên thư mục
      // (host-<x> → dsh-<x>, còn lại dsh-<basename>) rồi xác nhận thư mục stock CÓ THẬT trong kernel.
      if (stock === undefined) {
        const candidates = dir.startsWith("host-") ? [dir.slice("host-".length), dir] : [dir];
        for (const candidate of candidates) {
          if (existsSync(join(root, "apps", "host", "node_modules", "@deepseek-ai", "dsh-" + candidate, "package.json"))) {
            stock = "@deepseek-ai/dsh-" + candidate;
            break;
          }
        }
      }
      if (stock === undefined) continue;
      map.set(name, stock);
      map.set(name + "/client", stock + "/client");
    }
  }
  idMapCache = map;
  return map;
}

/**
 * Quy mọi id gói CỦA TA trong một văn bản về id STOCK tương ứng (sau khi đã chuẩn hoá brand).
 * Nhận: text — văn bản artefact/payload.
 * Trả: văn bản đã quy id (id lạ giữ nguyên).
 */
export function normalizeIdsInText(text: string): string {
  let out = normalizeBrand(text);
  const pairs = [...ourToStockIds().entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [ours, stock] of pairs) out = out.split(ours).join(stock);
  return out;
}

/** Sắp xếp khoá object để so sâu ổn định. */
function sortedDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort((a, b) => a[0].localeCompare(b[0]));
    return Object.fromEntries(entries.map(([key, item]) => [key, sortedDeep(item)]));
  }
  return value;
}

/**
 * Chuẩn hoá sâu một cấu trúc JSON: chuỗi → chuẩn hoá brand + quy id ta về id stock.
 * Nhận: value — giá trị bất kỳ (thường là `dsh.client` hoặc metadata).
 * Trả: cấu trúc đã chuẩn hoá, khoá sắp xếp.
 */
export function normalizeIdMapDeep(value: unknown): unknown {
  if (typeof value === "string") return normalizeIdsInText(value);
  if (Array.isArray(value)) return value.map(normalizeIdMapDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort((a, b) => a[0].localeCompare(b[0]));
    return Object.fromEntries(entries.map(([key, item]) => [key, normalizeIdMapDeep(item)]));
  }
  return value;
}

/**
 * So HAI cấu trúc (vd `dsh.client`) sau khi chuẩn hoá ĐỐI XỨNG brand + quy id ta → id stock.
 * Dùng cho ca parity inject/external khi id đã được rewrite CÓ CHỦ ĐÍCH.
 * Nhận: mot — cấu trúc của ta; hai — cấu trúc stock (hoặc kỳ vọng).
 * Trả: true khi bằng nhau sau chuẩn hoá.
 */
export function sameAfterIdMap(mot: unknown, hai: unknown): boolean {
  return JSON.stringify(sortedDeep(normalizeIdMapDeep(mot))) === JSON.stringify(sortedDeep(normalizeIdMapDeep(hai)));
}

/**
 * Quy NGƯỢC mọi tên gói CỦA TA trong một chuỗi về tên gốc, để so byte sau khi đổi tên (P1b).
 *
 * Vì sao cần: các phép byte-parity so artefact của ta với artefact gốc. Khi đổi tên P1b, artefact
 * của ta chứa `@galaxy-blackhole/gbh-*` còn bản gốc chứa `@deepseek-ai/*`; nếu so byte trần thì
 * MỌI tệp đều lệch. Chuẩn hoá cả hai vế về tên gốc giữ nguyên được bất biến mạnh: khác biệt chỉ
 * được phép nằm ở ĐÚNG những chỗ bản đồ đổi tên chỉ ra.
 * @param text nội dung cần chuẩn hoá (mã nguồn, JSON, hoặc chuỗi bất kỳ).
 * @returns nội dung đã quy ngược tên gói về tên gốc.
 */
export function normalizePackageNames(text: string): string {
  const map = ourToStockIds();
  const names = [...map.keys()].sort((a, b) => b.length - a.length);
  let out = text;
  for (const ours of names) {
    const stock = map.get(ours);
    if (stock === undefined) continue;
    out = out.split(ours).join(stock);
  }
  return out;
}

/**
 * Băm sha256 của nội dung SAU khi quy ngược tên gói — dùng cho phép byte-parity thời P1b.
 * @param text nội dung tệp.
 * @returns chuỗi hex sha256.
 */
export function sha256Renamed(text: string): string {
  return createHash('sha256').update(normalizePackageNames(text)).digest('hex');
}

/**
 * Bỏ các điều kiện `types` do ta TỰ THÊM vào `exports` của manifest (P1b: cần để TS phân giải kiểu).
 *
 * Bản gốc không có điều kiện này, nên mọi phép so `exports` với stock phải đi qua hàm này;
 * nếu không, mỗi lần thêm `types` là một test đỏ giả.
 * @param value giá trị `exports` (hoặc bất kỳ object lồng nhau).
 * @returns bản sao đã bỏ mọi khoá `types`.
 */
export function stripTypesConditions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((one) => stripTypesConditions(one));
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'types') continue;
    out[key] = stripTypesConditions(item);
  }
  return out;
}
