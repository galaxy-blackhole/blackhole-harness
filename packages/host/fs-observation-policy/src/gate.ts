/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cổng trạng thái ĐÃ QUAN SÁT: một bản đồ yếu chủ-sở-hữu→đích ghi lại mọi quan sát có/không có
 *      thẩm quyền, và ba quyết định `fs/*` rút ra từ trạng thái đó. Một thực thể được tạo cho MỖI lượt
 *      `apply()` nên khi gỡ plugin là rơi sạch trạng thái (an toàn HMR), và hai lượt cài KHÔNG chia sẻ
 *      trạng thái (C6 — kiểm bằng DANH TÍNH).
 */

import { FsError } from "@deepseek-ai/dsh-fs";
import type { FsObservation, FsTarget, FsTargetKey, FsVersion, FsWriteIntent } from "@deepseek-ai/dsh-fs";
import type { FsObservationActor } from "./types.ts";

/**
 * Trạng thái quan sát CỦA MỘT bản cài plugin. Không service, không I/O: nó chỉ chuyển trạng thái đã
 * ghi thành bảo vệ tuỳ chọn của nhà cung cấp, còn nhà cung cấp làm phép kiểm tươi/mới NGUYÊN TỬ.
 */
export class ObservedStateGate {
  /**
   * Trạng thái đã quan sát, khoá TRƯỚC bằng object chủ sở hữu (giữ YẾU, nên một phiên bị thu hồi là
   * trạng thái của nó được giải phóng), rồi bằng {@link FsTarget.targetKey}. Sự CÓ MẶT của một mục
   * chính là bản ghi quan sát trước đó; discriminant của nó giữ "vắng mặt đã xác nhận" KHÁC với "chưa
   * từng thấy".
   */
  private observed = new WeakMap<object, Map<FsTargetKey, FsObservation>>();

  /**
   * Rút chủ sở hữu trạng thái quan sát từ actor đục lỗ của sự kiện — thường là phiên agent đang chạy.
   * Nhận: actor của sự kiện `fs/*` (có thể `undefined`).
   * Trả: phiên sở hữu, hoặc `undefined` khi không rút được (ví dụ lời gọi tool trực tiếp không agent);
   *        lời gọi như thế đọc tự do nhưng KHÔNG thoả được chính sách quan sát trước khi ghi/sửa.
   */
  owner(actor: object | undefined): object | undefined {
    return (actor as FsObservationActor | undefined)?.agent?.session;
  }

  /**
   * Đọc bản ghi quan sát của một cặp (chủ sở hữu, đích).
   * Nhận: object chủ sở hữu và khoá đích.
   * Trả: bản ghi đã có, hoặc `undefined` khi đích chưa từng được quan sát.
   */
  get(owner: object, targetKey: FsTargetKey): FsObservation | undefined {
    return this.observed.get(owner)?.get(targetKey);
  }

  /**
   * Ghi đè bản ghi quan sát của một cặp (chủ sở hữu, đích).
   * Nhận: object chủ sở hữu, khoá đích và bản ghi quan sát mới.
   * Trả: không.
   */
  set(owner: object, targetKey: FsTargetKey, observation: FsObservation): void {
    let byTarget = this.observed.get(owner);
    if (byTarget === undefined) {
      byTarget = new Map();
      this.observed.set(owner, byTarget);
    }
    byTarget.set(targetKey, observation);
  }

  /**
   * Rơi TOÀN BỘ trạng thái đã ghi (an toàn HMR / lúc gỡ plugin).
   * Nhận: không.
   * Trả: không; bản đồ yếu được thay bằng một bản đồ MỚI.
   */
  clear(): void {
    this.observed = new WeakMap();
  }

  /**
   * Quyết định ý định ghi: chưa thấy hoặc đã xác nhận vắng mặt ⇒ `createIfAbsent`; đã xác nhận có mặt
   * ⇒ `replaceIfVersion` tại phiên bản đã quan sát.
   * Nhận: đích sắp ghi và actor của lượt gọi.
   * Trả: ý định ghi mà tầng tool chuyển cho nhà cung cấp.
   */
  writeIntent(target: FsTarget, actor: object | undefined): FsWriteIntent {
    const owner = this.owner(actor);
    const prior = owner === undefined ? undefined : this.get(owner, target.targetKey);
    return prior?.kind === "present"
      ? { kind: "replaceIfVersion", version: prior.version }
      : { kind: "createIfAbsent" };
  }

  /**
   * Quyết định bảo vệ phiên bản cho lượt sửa: chưa thấy ⇒ từ chối với `FS_NOT_OBSERVED`; đã xác nhận
   * vắng mặt ⇒ từ chối với `FS_NOT_FOUND`; có mặt ⇒ trao phiên bản đã quan sát làm cơ sở CAS.
   * Nhận: đích sắp sửa và actor của lượt gọi.
   * Trả: bộ bảo vệ `{ version }` cho nhà cung cấp.
   * Ném: `FsError` mã `FS_NOT_OBSERVED` hoặc `FS_NOT_FOUND` — nguyên văn thông điệp của bản gốc.
   */
  editIntent(target: FsTarget, actor: object | undefined): { version: FsVersion } {
    const owner = this.owner(actor);
    const prior = owner === undefined ? undefined : this.get(owner, target.targetKey);
    if (owner === undefined || prior === undefined) {
      throw new FsError(`edit requires reading "${target.displayPath}" first`, "FS_NOT_OBSERVED");
    }
    if (prior.kind === "absent") {
      throw new FsError(`cannot edit "${target.displayPath}": not found`, "FS_NOT_FOUND");
    }
    return { version: prior.version };
  }

  /**
   * Ghi lại một quan sát CÓ hoặc KHÔNG CÓ thẩm quyền cho cặp (chủ sở hữu, đích) này.
   * Nhận: đích vừa được quan sát, bản ghi (có mặt kèm phiên bản / đã xác nhận vắng mặt) và actor.
   * Trả: không; actor không rút được chủ sở hữu thì KHÔNG ghi gì.
   */
  observe(target: FsTarget, observation: FsObservation, actor: object | undefined): void {
    const owner = this.owner(actor);
    if (owner !== undefined) this.set(owner, target.targetKey, observation);
  }
}
