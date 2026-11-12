/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-settings-agent-loop: id MODULE (vao bang module) tach han id SLOT OCCUPANT
 */

/**
 * Id MODULE chính — package của ta. Đây là id bundle tự khai trong `__ModuleLoader__.load`,
 * nên nó là dòng mà manifest của Host trỏ tới và là `ownerId` mà HMR tra `rev`.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-agent-loop";

/**
 * Id MODULE phụ — package gốc của DSH. Bundle của ta đăng ký THÊM id này để mọi bundle phụ thuộc
 * `require("@galaxy-blackhole/gbh-client-ui-settings-agent-loop")` vẫn tìm thấy bảng module.
 * Bản gốc chỉ đăng ký ĐÚNG MỘT id module (không có `chunk:`), nên tổng số id của ta là hai.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-settings-agent-loop";

/**
 * Id SLOT OCCUPANT của trang trong slot `plugins.item` — KHÔNG phải id module.
 * Nó chỉ định danh người ngồi trong slot; giữ nguyên như bản gốc để trang Plugins đối chiếu được.
 */
export const SLOT_OCCUPANT_ID = "agent-loop";

// Tên slot `plugins.item` CỐ Ý không đặt thành hằng ở đây: nó phải hiện nguyên văn ngay tại chỗ
// `ctx.slots.inject`/`ctx.slots.register` trong src/plugin.ts để grep và `bun run check:rows` thấy được.

/** Thứ tự của occupant trong slot; bản gốc xếp 30. */
export const SLOT_ORDER = 30;

/** Namespace cài đặt mà trang này sửa; do agent loop phía Host đăng ký, không phải gói này. */
export const AGENT_LOOP_NAMESPACE = "agent-loop";

/** Id của ô nhập số trong form — bản gốc dùng id này cho `SettingsValueField`. */
export const PARALLEL_FIELD_ID = "plugin-config-agent-loop-parallel";
