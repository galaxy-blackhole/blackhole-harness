/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phep kiem BE MAT SERVICE (ham thuan) + escapeRe — tach khoi tools/check/rows.ts vi luat <=1000 dong/file
 */

/** Các ký tự phải thoát khi nhúng một chuỗi vào RegExp. */
const REGEX_SPECIALS = new Set<string>([".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"]);

/**
 * Thoát ký tự đặc biệt của RegExp trong một chuỗi.
 * Nhận: `value` — chuỗi cần thoát.
 * Trả: chuỗi đã thoát.
 */
export function escapeRe(value: string): string {
  let out = "";
  for (const ch of value) out += REGEX_SPECIALS.has(ch) ? "\\" + ch : ch;
  return out;
}

/**
 * So khop be mat service giua van ban goi GOC va bundle cua ta — HAM THUAN de test duoc bang fixture.
 *
 * Tach ra khoi serviceSurfaceIssues de chung minh duoc ve "BAT DUOC": mot cong chi khang dinh "khong bao
 * oan" thi chua chung minh no bat duoc gi (bai hoc 17/10/2026 voi configForms.developerTools).
 * @param stockText - toan bo van ban goi goc (bundle + moi file .d.ts).
 * @param ourCode - van ban bundle cua ta (ban DANG PHUC VU).
 * @returns danh sach chuoi "<service>.<thuoc-tinh>" co trong bundle cua ta ma KHONG thay o goi goc.
 */
export function missingServiceProperties(stockText: string, ourCode: string): string[] {
  const out: string[] = [];
  const services = new Set<string>();
  for (const m of stockText.matchAll(/provide\(\s*["']([A-Za-z_$][\w$]*)["']/g)) if (m[1] !== undefined) services.add(m[1]);
  for (const m of stockText.matchAll(/\bset\(\s*["']([A-Za-z_$][\w$]*)["']/g)) if (m[1] !== undefined) services.add(m[1]);
  for (const service of services) {
    const chain = new RegExp("\\b" + escapeRe(service) + "\\.([A-Za-z_$][\\w$]*)", "g");
    for (const m of ourCode.matchAll(chain)) {
      const property = m[1];
      if (property === undefined || property === "length" || property === "name") continue;
      if (stockText.includes(property)) continue;
      const label = service + "." + property;
      if (!out.includes(label)) out.push(label);
    }
  }
  return out;
}

/**
 * Bat lop loi TON CA NGAY 17/10/2026: cong chan cai hai lan KHOA THEO ctx (lastCtx / installedContexts)
 * nam trong bundle.
 *
 * Vi sao SAI: ca that la HAI ENTRY ⇒ HAI ctx (loader.create cho moi entry ⇒ parent.extend({fiber}) ⇒ ctx
 * MOI) ⇒ cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay lan hai ⇒ service has been registered ⇒
 * entry ket loading ⇒ cascade. Do duoc: 10 goi con lastCtx trong artifact.
 *
 * Cach dung DUNG: let <ten>Installed = false O PHAM VI MODULE — boolean khong quan tam ctx nao.
 * (Gia phai tra: boolean dinh giua cac ca test cung file ⇒ nap module TUOI moi ca.)
 * @param code - noi dung artifact da build (ban DANG PHUC VU).
 * @returns danh sach ten bien/dau hieu khoa-theo-ctx tim thay (rong = dat).
 */
export function contextKeyedGuardTokens(code: string): string[] {
  const out: string[] = [];
  for (const token of ["lastCtx", "installedContexts"]) {
    if (code.includes(token)) out.push(token);
  }
  return out;
}
