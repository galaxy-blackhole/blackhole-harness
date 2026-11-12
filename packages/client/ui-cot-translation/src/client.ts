/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào nửa client của row cot-translation — NGUYÊN VĂN vùng lib/types/client/index.js
 *      trong bundle gốc lib/client.js (vùng 11): export apply + inject, KHÔNG tự đăng ký id
 */

import { mountTranslation } from "./client/mount.ts";
import type { ClientContextLike } from "./client/mount.ts";
import { TYPERT_REMOTE } from "./client/typert-remote-client.ts";

export { inject } from "./client/mount.ts";

/**
 * Mount phần trình bày suy luận thí nghiệm và các phương thức Remote của nó.
 * Nhận: ctx — context plugin phía browser.
 * Trả: hàm gỡ, gộp cả rút UI lẫn rút Remote.
 */
export async function apply(ctx: ClientContextLike): Promise<() => Promise<void>> {
	return await mountTranslation(ctx, TYPERT_REMOTE);
}
