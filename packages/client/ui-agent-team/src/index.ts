/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban viet lai cua Galaxy Blackhole cho NUA HOST cua row agent-team (goc:
 *      @deepseek-ai/dsh-experimental-client-ui-agent-team) — vo rong, hanh vi nam o nua browser
 */
//
// NGUỒN ĐỐI CHIẾU (CHỈ ĐỌC): apps/host/node_modules/@deepseek-ai/dsh-experimental-client-ui-agent-team
//   · lib/index.js = 7 dòng, export DUY NHẤT `apply` rỗng:
//       /** Pure host half for the browser-discovered Agent Teams UI plugin. */
//       /** Host plugin body; Team behavior lives in the browser export and Host RPC domain. */
//       function apply() {}
//       export { apply };
//   · lib/client.js = 515 dòng (gói HAI MẶT: dsh.client.platform=web + 5 inject) ⇒ theo
//     CONVERSION-RUNBOOK §4d: gói hai mặt thì CHỈ port nửa host và **KHÔNG khai gbh.row**.
//
// Vì sao nửa host RỖNG là ĐÚNG (không phải thiếu): hành vi của Agent Teams nằm ở nửa browser
// (bundle client tự đăng ký slot/UI) và ở miền RPC phía Host do gói khác cấp. Row host chỉ cần tồn tại
// để Loader import được; thiếu `apply` thì Loader báo "failed to import".

/**
 * Điểm vào phía Host của row agent-team — giữ NGUYÊN hành vi bản gốc: KHÔNG làm gì.
 *
 * Bản gốc (lib/index.js dòng 3–4) là `function apply() {}` trần: mọi hành vi Team nằm ở nửa browser và
 * miền RPC của Host, nên port sang đây không được thêm/bớt gì (thêm việc = bịa hành vi).
 *
 * Nhận: không (bản gốc không khai tham số).
 * Trả: không.
 */
export function apply(): void {}
