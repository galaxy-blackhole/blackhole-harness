/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang so dinh danh cua row agent-team (chi nua host — goi HAI MAT nen KHONG khai gbh.row)
 */

/** Tên package của ta (nửa host). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-agent-team";

/** Id module của gói gốc DSH — chỉ để đối chiếu tài liệu/test. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-experimental-client-ui-agent-team";
// ── Nửa client (task-41) — lấy NGUYÊN VĂN từ bundle gốc ──────────────────────────────────────────────

/** Namespace từ điển của nửa client (nguồn: src/locales.ts). */
export { NS } from "./locales.ts";

/** Bốn service mà nửa client cần (bundle gốc dòng 457–462, đúng thứ tự). */
export const INJECT: readonly string[] = ["sessions", "uiWorkspace", "slots", "locale"];

/** Slot mà row này chiếm — action trên header của phiên hội thoại. */
export const SLOT_CONVERSATION_HEADER_ACTIONS = "conversation.session.header.actions";

/** Id occupant của slot trên (bundle gốc dòng 493). */
export const TEAM_ACTION_ID = "agent-team";

/**
 * Thứ tự occupant. Bản gốc là `-20`; ta ĐỔI thành `9` (24/10/2026) để "Nhóm agent" đứng NGAY CẠNH
 * danh mục subagent (`subagent-catalog`, order 10) thay vì bị nhãn chế độ (`agent-preset`, order -10)
 * chen giữa. Đây là sai lệch CÓ CHỦ Ý so với gói gốc — xem docs/adr/0014-header-action-order.md.
 */
export const TEAM_ACTION_ORDER = 9;

/** Id thẻ `<style data-plugin-css>` của CSS TeamAction (bản gốc dùng "<id gói>/TeamAction.module.css"). */
export const STYLE_TAG = PACKAGE_NAME + "/TeamAction.module.css";

/** Tag CSS RIÊNG của hàng toolview cho tool BỔ SUNG `set_team_limits` (ADR 0013). */
export const SET_LIMITS_STYLE_TAG = PACKAGE_NAME + "/set-team-limits.module.css";
