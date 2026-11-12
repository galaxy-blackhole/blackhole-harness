/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Quet ten export/slot tu van ban JS/TS cho cong chan mount (tach khoi rows.ts de giu file <= 1000 dong)
 *      12/11/2026: tach khoi tools/check/rows.ts — rows.ts phai chay duoc bang Node (--experimental-strip-types)
 *      de cong chan mount khong bi bo qua khi app desktop chay launcher bang Node
 */

/**
 * Liet ke ten export trong mot file ESM da build.
 * @param text - noi dung file.
 * @returns tap ten export.
 */
export function exportNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return out;
}

/**
 * Rut ten cac slot ma mot doan ma dang ky (ctx.slots.register({ name: "X", ... })).
 * @param text - noi dung file nguon hoac ban build.
 * @returns tap ten slot.
 */
export function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
  return out;
}
