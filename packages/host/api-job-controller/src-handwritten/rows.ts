/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thế hệ danh sách job theo PHIÊN: tập job mà bên gọi nhìn thấy, được THAY CẢ BỘ sau mỗi lần đổi
 *      vòng đời — bản viết lại 1:1 `streamJobRows` (lib/types/rows.js).
 */

import type { JobRegistry } from "@deepseek-ai/dsh-jobs";

import type { JobListFrame, JobListRequest } from "./types.ts";
import { OutputWaiter, sleep } from "./wake.ts";

/** Trần nhịp cho MỘT thế hệ danh sách. */
export interface RowsOptions {
  /** Cửa sổ gộp sau một sự kiện vòng đời trước lần đọc danh sách kế tiếp, tính bằng mili giây. */
  readonly flushMs: number;
}

/**
 * Phát các job mà MỘT phiên nhìn thấy: một khung lúc mở, rồi một khung sau MỖI lần commit vòng đời
 * chạm vào một job nhìn thấy (đăng ký, tiến độ, đang dừng, kết thúc, xoá), gộp qua 'flushMs'. Lần ghi
 * đầu ra KHÔNG BAO GIỜ làm mới danh sách — ảnh chụp kết thúc đã mang số byte cuối — nên dòng im lặng
 * khi job chỉ đang ghi. Các lần đọc là ảnh chụp; con trỏ và trạng thái thông báo của model không thấy.
 * Nhận: sổ job đang sống; phiên cần phản chiếu tập nhìn thấy; cửa sổ gộp; và tín hiệu huỷ của thế hệ.
 * Trả: dãy khung danh sách của MỘT thế hệ.
 */
export async function* streamJobRows(
  registry: JobRegistry,
  request: JobListRequest,
  options: RowsOptions,
  signal: AbortSignal,
): AsyncIterable<JobListFrame> {
  signal.throwIfAborted();
  const waiter = new OutputWaiter();
  const unsubscribe = registry.events.subscribe({ owners: "all" }, (event) => {
    if (event.type === "output") return;
    const owner = event.job.owner;
    if (owner === undefined || owner === request.sessionId) waiter.wake();
  });
  try {
    yield { type: "rows", jobs: registry.list(request.sessionId) };
    while (true) {
      await waiter.wait(signal);
      await sleep(options.flushMs, signal);
      if (signal.aborted) return;
      yield { type: "rows", jobs: registry.list(request.sessionId) };
    }
  } finally {
    unsubscribe();
  }
}
