/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số + schema + phép gộp THUẦN của miền preset quyền: hai tên dành riêng (custom · auto),
 *      bộ hai núm cố định của Auto, trạng thái núm rỗng, schema trạng thái chiếu `permissions`, và
 *      phép gộp một sự kiện phiên.
 */

import { z as zod } from "zod/v4";
import type { KnobState, PermissionProjectionState, PresetSpec } from "./types.ts";

/**
 * Trả về khi giá trị núm hiệu lực không khớp preset nào. Client được phép hiện nó như giá trị hiện
 * tại, nhưng nó KHÔNG BAO GIỜ là đích chuyển hay payload sự kiện.
 */
export const CUSTOM_PRESET = "custom";

/** Danh tính chuẩn tắc của preset duyệt-từng-lượt thử nghiệm (Auto). */
export const AUTO_PRESET = "auto";

/**
 * Bộ thi hành CỐ ĐỊNH của tích hợp Auto đang sống. `ask` đẩy phán quyết từ chối của bộ duyệt về
 * cho người; một danh tính Auto đã lưu cũng khớp `never` — chính sách mà một con được uỷ quyền ghim
 * để phán quyết từ chối của bộ duyệt nó là chung thẩm.
 */
export const AUTO_PRESET_SPEC: PresetSpec = { sandbox: "danger-full-access", approval: "ask" };

/** Trạng thái cho log rỗng: mọi núm ở mặc định thành phần. */
export const EMPTY_KNOBS: KnobState = { preset: null, sandbox: null, approval: null };

/**
 * Bảng preset mặc định của schema — đúng hai mục như bản gốc, kèm phần trình bày của chúng.
 * Chỉ dùng khi Config KHÔNG khai `presets`.
 */
export const DEFAULT_PRESETS: Record<string, PresetSpec> = {
  "workspace-write": {
    sandbox: "workspace-write",
    approval: "ask",
    name: "workspace-write",
    description: "Write inside the workspace and permitted temporary directories; wider retries require approval.",
  },
  "danger-full-access": {
    sandbox: "danger-full-access",
    approval: "never",
    name: "danger-full-access",
    description: "Full file access without approval prompts.",
  },
};

/**
 * Schema trạng thái của đơn vị chiếu `permissions`: ba núm (mỗi núm nullable vì mặc định thành phần
 * áp ở lúc đọc) cộng dấu gieo hạt; kiểm TĂNG NGHIÊM NGẶT — một khoá thừa là dữ liệu hỏng.
 */
export const permissionStateSchema = zod
  .object({
    preset: zod.string().nullable(),
    sandbox: zod
      .union([zod.literal("read-only"), zod.literal("workspace-write"), zod.literal("danger-full-access")])
      .nullable(),
    approval: zod.union([zod.literal("ask"), zod.literal("never")]).nullable(),
    seeded: zod.boolean(),
  })
  .strict();

/**
 * Một bước chuyển trạng thái quyền (thân `apply` của đơn vị chiếu). Sự kiện không liên quan trả về
 * ĐÚNG tham chiếu cũ — cổng thay đổi của sổ chiếu dựa vào `Object.is`.
 * Nhận: `state` — trạng thái núm đã gộp TRƯỚC `event`; `event` — một sự kiện phiên đã cam kết.
 * Trả: trạng thái kế tiếp; cùng tham chiếu khi sự kiện không liên quan.
 */
export function applyPermissionEvent(state: PermissionProjectionState, event: { type: string; data: unknown }): PermissionProjectionState {
  switch (event.type) {
    case "permission/preset":
      return { ...state, preset: (event.data as { preset: string }).preset };
    case "sandbox/mode":
      return { ...state, sandbox: (event.data as { mode: PermissionProjectionState["sandbox"] }).mode };
    case "approval/policy":
      return { ...state, approval: (event.data as { policy: PermissionProjectionState["approval"] }).policy };
    case "session/end-seed":
      return { ...state, seeded: true };
    default:
      return state;
  }
}
