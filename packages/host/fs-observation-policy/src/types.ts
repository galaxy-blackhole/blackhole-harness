/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của chính sách quan sát tệp: góc nhìn CẤU TRÚC tối thiểu của một lượt thi hành tool (để
 *      rút ra chủ sở hữu trạng thái quan sát từ actor `object` mà các sự kiện `fs/*` mang theo) và ba
 *      điểm mở rộng mà plugin này đăng ký. Từ vựng của nhà cung cấp (`FsTarget`, `FsVersion`, hình dạng
 *      write/edit intent) được DÙNG LẠI từ `@deepseek-ai/dsh-fs`; package này chỉ sở hữu cấu trúc chủ
 *      sở hữu trạng thái quan sát ở trên nó.
 */

import type { FsObservation, FsTarget, FsVersion, FsWriteIntent } from "@deepseek-ai/dsh-fs";

/**
 * Góc nhìn cấu trúc tối thiểu của một lượt thi hành tool mà chính sách cần để rút ra chủ sở hữu trạng
 * thái quan sát. `ToolExecution` của `@deepseek-ai/dsh-tools` có đúng những trường này, nên tầng tool
 * chuyển thẳng `exec` làm actor `object` trên các sự kiện `fs/*`; package này thu hẹp actor đó thành
 * {@link FsObservationActor} mà KHÔNG import `dsh-tools`, `dsh-agent` hay `dsh-session`.
 *
 * Chủ sở hữu là `agent.session` khi có. Nó được coi là DANH TÍNH object (một khoá `WeakMap`); package
 * này không bao giờ đọc trường nào của nó.
 */
export interface FsObservationActor {
  /** Agent thay mặt nó mà lượt gọi chạy, khi có. */
  agent?: {
    /** Phiên sở hữu trạng thái quan sát tệp, dùng làm khoá đục lỗ. */
    session?: object;
  };
}

/**
 * Ba điểm mở rộng mà plugin đăng ký, khai theo CẤU TRÚC (không import `@deepseek-ai/cordis`) để
 * `apply` chỉ phụ thuộc đúng phần nó dùng: hai waterfall quyết định và một sự kiện ghi nhận, cộng
 * `effect` để đăng ký hàm dọn.
 *
 * Cả hai waterfall được phát KHÔNG ràng buộc `this`, nên listener nhận thẳng `(target, actor)` và
 * (với waterfall) `next` — đúng cách tầng tool phát chúng.
 */
export interface FsObservationContext {
  /**
   * Đăng ký listener cho một trong ba sự kiện `fs/*`.
   * Nhận: tên sự kiện và listener tương ứng.
   * Trả: hàm gỡ đăng ký.
   */
  on(
    event: "fs/write-intent",
    listener: (target: FsTarget, actor: object | undefined) => Promise<FsWriteIntent>,
  ): () => void;
  /**
   * Đăng ký listener quyết định bảo vệ phiên bản cho lượt sửa.
   * Nhận: tên sự kiện và listener tương ứng.
   * Trả: hàm gỡ đăng ký.
   */
  on(
    event: "fs/edit-intent",
    listener: (target: FsTarget, actor: object | undefined) => Promise<{ version: FsVersion }>,
  ): () => void;
  /**
   * Đăng ký listener GHI NHẬN (đồng bộ) cho quan sát có thẩm quyền.
   * Nhận: tên sự kiện và listener tương ứng.
   * Trả: hàm gỡ đăng ký.
   */
  on(
    event: "fs/observed",
    listener: (target: FsTarget, observation: FsObservation, actor: object | undefined) => void,
  ): () => void;
  /**
   * Chạy một hiệu ứng có hàm dọn; cordis gọi hàm dọn khi plugin bị gỡ.
   * Nhận: hàm trả về hàm dọn, và nhãn chẩn đoán.
   * Trả: giá trị do cordis trả (không dùng).
   */
  effect(callback: () => () => void, label?: string): unknown;
}
