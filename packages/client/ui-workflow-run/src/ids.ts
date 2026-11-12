/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang so dinh danh cua row ui-workflow-run: ten package (id module) va namespace tu dien
 */

/**
 * Id module của GÓI GỐC — cũng được bundle đăng ký như một KHOÁ ALIAS trong CÙNG một lần thực thi.
 *
 * Vì sao cần: khi ta thay row, id stock **biến mất khỏi đồ thị** nhưng các entry stock khác (đo được nhiều
 * nhất là 50 row) vẫn `inject` đúng id đó ⇒ chúng treo `loading`/waiting. Đăng ký thêm id stock trong
 * chính bundle của ta làm id đó phân giải được. Một lần thực thi, một lần cài đặt: cờ chống cài hai lần
 * ở phạm vi MODULE lo phần đó (xem `plugin.ts` / `client.ts`).
 */
export const STOCK_MODULE_ID = "@deepseek-ai/dsh-client-ui-workflow-run";

/** Tên package của ta — cũng là **id module** mà bundle tự khai (khai thêm ở `gbh.row.moduleIds`). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-workflow-run";

/** Namespace từ điển của row (giữ nguyên như bản gốc). */
export const NS = "workflowRun";

/** Khoá occupant của slot `conversation.chat.node` — KHÔNG phải id module. */
export const CHAT_NODE_KEY = "workflow-run";
