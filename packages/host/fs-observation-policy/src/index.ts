/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách quan sát tệp CHỈ-BẰNG-SỰ-KIỆN: đọc-trước-khi-sửa + ghi/sửa có bảo vệ phiên bản, trên
 *      cổng sự kiện `fs/*` (không service API). Bản viết lại của Galaxy Blackhole cho row
 *      fs-observation-policy (@deepseek-ai/dsh-fs-observation-policy) — nguồn đối chiếu: README.md (G4).
 */

import { ObservedStateGate } from "./gate.ts";
import type { FsObservationContext } from "./types.ts";

export type { FsObservationActor } from "./types.ts";

/** Tên plugin cordis dùng cho chẩn đoán của bộ nạp — nguyên văn của bản gốc. */
export const name = "fs-observation-policy";

/**
 * Đăng ký ba listener `fs/*`. Không `inject` — plugin này không đọc service nào; nó chỉ làm việc trên
 * `WeakMap` của chính nó. Hai waterfall được phát KHÔNG ràng buộc `this` (tầng tool phát chúng như
 * vậy), nên listener nhận thẳng cặp `(target, actor)`.
 *
 * Thứ tự đăng ký giữ NGUYÊN bản gốc (`fs/write-intent` → `fs/edit-intent` → `fs/observed`): slot quyết
 * định là first-wins theo thứ tự đăng ký, nên thứ tự này là một phần hợp đồng.
 * Hai listener quyết định trả PROMISE (lỗi thành promise bị từ chối, không phải ném đồng bộ) để giữ
 * đúng ngữ nghĩa bất đồng bộ của bản gốc.
 *
 * Nhận: context host (có `on` và `effect`).
 * Trả: không.
 */
export function apply(ctx: FsObservationContext): void {
  const gate = new ObservedStateGate();
  ctx.effect(
    () => () => {
      gate.clear();
    },
    "fs-observation-policy observed-state teardown",
  );
  ctx.on("fs/write-intent", (target, actor) => Promise.resolve().then(() => gate.writeIntent(target, actor)));
  ctx.on("fs/edit-intent", (target, actor) => Promise.resolve().then(() => gate.editIntent(target, actor)));
  ctx.on("fs/observed", (target, observation, actor) => {
    gate.observe(target, observation, actor);
  });
}
