/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nua host cua row ui-model-selection — apply RONG y ban goc; gói HAI MẶT nên chỉ port nửa host, KHÔNG khai gbh.row
 */

// BAN GOC (apps/host/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/index.js):
//   "Model selection plugin, node half. Pure UI plugin: the empty apply exists so the plugin
//    appears in the host cordis.yml / Loader; the browser half ships via exports ['./client'],
//    discovered through the package.json dsh.client declaration."
// ⇒ Nua host RONG la DUNG nghia, khong phai thieu viec: than cua row nam o lib/client.js (78.428 B).
/**
 * Diem vao cua Loader phia Host.
 * Nhận: khong co.
 * Trả: khong co — hanh vi host RONG y ban goc (plugin thuan giao dien: than nam o nua client).
 */
export function apply(): void {}
