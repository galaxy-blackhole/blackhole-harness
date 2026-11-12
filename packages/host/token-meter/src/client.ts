/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Phép chiếu không gian tên client của các hợp đồng an toàn cho trình duyệt của token-meter — bản viết lại
 *      1:1 `lib/types/client.js` (runtime) + `lib/types/client.d.ts` (kiểu) của `@deepseek-ai/dsh-token-meter`.
 */

export { deriveTurnTokenUsage } from "./turn-usage.ts";
export type { TurnTokenUsage, TurnTokenUsageRoute } from "./turn-usage.ts";
// Bản gốc `client.d.ts` còn `export type * from './projection.ts';`; tệp `projection.ts` chưa có trong bản port
// nên dòng đó chỉ bổ sung được khi tệp kia xuất hiện — `client.js` (runtime) của gốc cũng chỉ re-export một hàm.
