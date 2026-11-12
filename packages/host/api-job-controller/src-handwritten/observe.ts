/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thế hệ quan sát MỘT job: neo mở dòng, các khung đầu ra đã gộp, và khung trạng thái kết thúc —
 *      bản viết lại 1:1 `observeJobOutput` của `@deepseek-ai/dsh-api-job-controller` (lib/types/observe.js).
 */

import { Buffer } from "node:buffer";

import type { JobRegistry } from "@deepseek-ai/dsh-jobs";
import type { JobChunk } from "@deepseek-ai/dsh-jobs/view";

import type { JobFollowFrame, JobFollowRequest } from "./types.ts";
import { OutputWaiter, sleep } from "./wake.ts";

/** Nhịp và trần đóng khung cho MỘT thế hệ quan sát. */
export interface ObserveJobOptions {
  /** Cửa sổ gộp sau một lượt đánh thức trước khi đọc, tính bằng mili giây. */
  readonly flushMs: number;
  /**
   * Trần byte MỀM cho mỗi khung 'output'. Các mẩu tích luỹ sẽ được đẩy đi khi chạm trần; một mẩu
   * LỚN HƠN trần đi NGUYÊN KHỐI (trần giữ của registry mới là chặn cứng cho từng mẩu).
   */
  readonly maxFrameBytes: number;
}

/**
 * Trạng thái đã kết thúc chưa (mọi trạng thái khác 'running'/'stopping').
 * Nhận: trạng thái của job.
 * Trả: true khi job không còn sống.
 */
function isTerminal(status: string): boolean {
  return status !== "running" && status !== "stopping";
}

/**
 * Chia MỘT lần đọc thành các khung theo ngân sách byte mềm của từng khung.
 * Nhận: các mẩu đã đọc, mốc nối lại, cờ mất byte, và trần byte mỗi khung.
 * Trả: dãy khung 'output' (rỗng khi không có mẩu và không mất byte).
 */
function* outputFrames(
  chunks: readonly JobChunk[],
  next: number,
  lossy: boolean,
  maxFrameBytes: number,
): Generator<JobFollowFrame> {
  let batch: JobChunk[] = [];
  let batchBytes = 0;
  let flaggedLossy = lossy;
  for (const chunk of chunks) {
    batch.push(chunk);
    batchBytes += Buffer.byteLength(chunk.text, "utf8");
    if (batchBytes >= maxFrameBytes) {
      const last = batch[batch.length - 1];
      // Một lô khác rỗng LUÔN có mẩu cuối; nhánh dưới chỉ để thoả noUncheckedIndexedAccess.
      const end = last === undefined ? next : last.at + Buffer.byteLength(last.text, "utf8");
      yield {
        type: "output",
        chunks: batch,
        next: end,
        ...(flaggedLossy ? { lossy: true as const } : {}),
      };
      flaggedLossy = false;
      batch = [];
      batchBytes = 0;
    }
  }
  if (batch.length > 0 || flaggedLossy) {
    yield { type: "output", chunks: batch, next, ...(flaggedLossy ? { lossy: true as const } : {}) };
  }
}

/**
 * Phát dòng đầu ra còn giữ của MỘT job từ một mốc tuyệt đối: một neo 'opened', các khung 'output' đã
 * gộp khi vòng đệm tiến, rồi một 'status' kết thúc sau khi job đã kết thúc và rút hết — sau đó thế hệ
 * đóng BÌNH THƯỜNG. Một lượt xoá được báo giữa thế hệ (chủ sở hữu dọn) đóng dòng bằng ảnh chụp kết
 * thúc của job bị xoá thay vì một lần đọc hỏng. Các lần đọc KHÔNG tiêu thụ: con trỏ và trạng thái
 * thông báo phía model không bao giờ thấy chúng; bên gọi nối lại bằng cách truyền 'next' của khung
 * cuối làm 'from'. Phiên trong yêu cầu CHÍNH LÀ bên gọi của phép đọc có hàng rào: registry từ chối
 * job mà phiên không nhìn thấy và job lạ.
 * Nhận: sổ job đang sống; yêu cầu (job đích, phiên sở hữu, mốc nối lại tuỳ chọn); nhịp + trần khung;
 *       và tín hiệu huỷ của thế hệ do tầng vận chuyển Remote sở hữu.
 * Trả: dãy khung quan sát của MỘT thế hệ.
 */
export async function* observeJobOutput(
  registry: JobRegistry,
  request: JobFollowRequest,
  options: ObserveJobOptions,
  signal: AbortSignal,
): AsyncIterable<JobFollowFrame> {
  if (request.from !== undefined && (!Number.isSafeInteger(request.from) || request.from < 0)) {
    throw new Error(
      `invalid observe offset: expected a non-negative safe integer, got ${JSON.stringify(request.from)}`,
    );
  }
  signal.throwIfAborted();
  const id = String(request.jobId);
  const waiter = new OutputWaiter();
  let removed: ReturnType<JobRegistry["get"]> | undefined;
  const unsubscribe = registry.events.subscribe({ owners: "all" }, (event) => {
    if ((event.type === "output" ? event.id : event.job.id) !== id) return;
    if (event.type === "removed") removed = event.job;
    waiter.wake();
  });
  try {
    let job = registry.get(request.jobId, request.sessionId);
    let cursor = request.from ?? job.output.earliest;
    yield { type: "opened", job, from: cursor };
    while (!signal.aborted) {
      if (removed !== undefined) {
        yield { type: "status", job: removed };
        return;
      }
      const read = registry.readAt(request.jobId, cursor, request.sessionId);
      if (read.chunks.length > 0 || read.lossy) {
        yield* outputFrames(read.chunks, read.next, read.lossy, options.maxFrameBytes);
      }
      cursor = read.next;
      job = registry.get(request.jobId, request.sessionId);
      if (isTerminal(job.status) && cursor >= job.output.total) {
        yield { type: "status", job };
        return;
      }
      await waiter.wait(signal);
      await sleep(options.flushMs, signal);
    }
  } finally {
    unsubscribe();
  }
}
