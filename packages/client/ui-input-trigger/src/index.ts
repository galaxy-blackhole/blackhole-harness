/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nua HOST cua row ui-input-trigger — port 1:1 tu @deepseek-ai/dsh-client-ui-input-trigger
 *   (lib/index.js: 11 dong, apply RONG). Hanh vi nam o nua CLIENT (da port: src/client.ts)
 */

/**
 * Than plugin phia Host — KHONG co hanh vi host nao cho row nay (nguyen van ban goc).
 *
 * Vi sao de trong: row nay la plugin UI thuan tuy; apply rong chi de plugin XUAT HIEN trong
 * cordis.yml / Loader cua Host, con nua browser di qua exports["./client"] duoc khai o
 * package.json (dsh.client). Nua client da port day du (src/client.ts + 12 vung #region, xem
 * README.md muc 3); goi nay VAN khong khai gbh.row — row PARKED cho Lead boot-smoke.
 * Nhận: không có (mọi tham số đều bị bỏ qua, đúng như bản gốc).
 * Trả: không có (undefined) — apply rỗng.
 */
export function apply(): void {
  // Khong lam gi — dung y ban goc.
}
