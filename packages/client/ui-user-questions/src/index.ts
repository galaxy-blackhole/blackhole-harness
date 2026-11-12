/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nua host cua row ui-user-questions — apply RONG y ban goc; toan bo than nam o nua client (lib/client.js)
 */

// BAN GOC (apps/host/node_modules/@deepseek-ai/dsh-client-ui-user-questions/lib/index.js):
//   "Web question plugin, node half. Mounting ask_user_question in the tools registry's global
//    layer expands every agent's tool list regardless of its preset. Rendering a question is a
//    host UI capability; the model-facing tool belongs to the presets that include it and to the
//    TUI composition, which has no presets." ⇒ nua host RONG la CHU Y; than nam o lib/client.js.
/**
 * Diem vao cua Loader phia Host.
 * Nhận: khong co.
 * Trả: khong co — hanh vi host RONG y ban goc (plugin thuan giao dien: than nam o nua client).
 */
export function apply(): void {}
