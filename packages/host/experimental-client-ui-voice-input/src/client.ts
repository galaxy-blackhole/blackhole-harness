/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Marker entry của nửa CLIENT voice-input — Bun.build riêng thành lib/client-entry.js;
 *      bundle client THẬT (lib/client.js) do P5 ghép từ src/client-parts + src/client-assemble.ts
 */

/**
 * Định danh entry marker của nửa client.
 *
 * Nhận: không.
 * Trả: hằng chuỗi `experimental-client-ui-voice-input/client-entry` — CHỈ để chứng minh entry
 * `src/client.ts` được build RIÊNG thành `lib/client-entry.js`; bundle thật `lib/client.js` do
 * P5 ghép cơ học từ part nguyên văn (xem `build.ts` → `buildClient`), KHÔNG import hằng này.
 */
export const CLIENT_ENTRY_MARKER = "experimental-client-ui-voice-input/client-entry";
