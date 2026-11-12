/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ban viet lai cua Galaxy Blackhole cho row ui-attachment (goc: @deepseek-ai/dsh-client-ui-attachment).
 */
// TODO: doc .d.ts + lib/*.js cua @deepseek-ai/dsh-client-ui-attachment trong apps/host/node_modules (CHI DOC),
// nam HANH VI roi viet lai — khong chep code.
// Giu nguyen be mat service / ten event / schema Config cua ban goc.

/**
 * Diem vao cua Loader. NHIEU ROW CLIENT CUA DSH export ham nay (thuong rong) —
 * KE CA khi phan that nam o nua browser. Thieu no thi Loader bao 'failed to import'.
 * Doi chieu ban goc: neu lib/index.js goc co export apply thi o day PHAI co.
 */
export function apply(): void {}