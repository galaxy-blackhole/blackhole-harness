/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu WIRE của namespace Remote 'job' do gói này sở hữu — client-safe, KHÔNG import Host:
 *      dòng danh sách job của một phiên, dòng quan sát MỘT job, và yêu cầu huỷ job thay mặt người.
 */

import type { JobId } from "@deepseek-ai/dsh-jobs/brand";
import type { JobChunk, JobView } from "@deepseek-ai/dsh-jobs/view";
import type { SessionId } from "@deepseek-ai/dsh-session/types";

export type { JobChunk, JobView } from "@deepseek-ai/dsh-jobs/view";

/** Đích của một dòng 'job.list': phiên mà tập job NHÌN THẤY được phản chiếu. */
export interface JobListRequest {
  /** Phiên gọi; registry dùng nó làm hàng rào chủ sở hữu. */
  readonly sessionId: SessionId;
}

/**
 * Một khung 'job.list': TOÀN BỘ tập job mà phiên nhìn thấy — job của chính nó cộng mọi job
 * không chủ — sau một lần đổi vòng đời. Thay cả bộ, nên khung đầu của lượt nối lại đã là sự thật.
 */
export interface JobListFrame {
  /** Loại khung danh sách. */
  readonly type: "rows";
  /** Ảnh chụp toàn bộ tập job nhìn thấy được. */
  readonly jobs: readonly JobView[];
}

/** Huỷ job nền do NGƯỜI khởi xướng, trên một job mà phiên nhìn thấy. */
export interface JobKillRequest {
  /** Phiên mà danh sách job của nó mang job này; phép tra có hàng rào đọc như phiên đó. */
  readonly sessionId: SessionId;
  /** Job cần huỷ. */
  readonly jobId: JobId;
}

/** Biên nhận sau khi registry chấp nhận yêu cầu huỷ của người. */
export interface JobKillValue {
  /** 'requested' khi việc đang sống; 'already-finished' khi đã kết thúc. */
  readonly outcome: "requested" | "already-finished";
}

declare module "@deepseek-ai/dsh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    /** Danh sách job của phiên không còn dòng nào huỷ được dưới id đó. */
    "job/not-found": {
      /** Phiên đã tra. */
      readonly sessionId: SessionId;
      /** Id job không tra được. */
      readonly jobId: JobId;
    };
  }
}

/** Đích của một dòng 'job.follow': job, phiên sở hữu, và mốc nối lại tuỳ chọn. */
export interface JobFollowRequest {
  /**
   * Phiên sở hữu cho phép đọc có hàng rào. Bỏ trống với job KHÔNG CHỦ — khi đó ai cũng quan sát được.
   */
  readonly sessionId?: SessionId;
  /** Job cần quan sát. */
  readonly jobId: JobId;
  /**
   * Mốc byte tuyệt đối để nối lại (chính 'next' của khung trước). Bỏ trống thì dòng bắt đầu ở
   * byte còn giữ CŨ NHẤT.
   */
  readonly from?: number;
}

/**
 * Các khung của dòng quan sát một job: một neo 'opened' mang ảnh chụp job (output.earliest và
 * output.total lúc mở) cùng mốc mà khung 'output' đầu tiếp nối, rồi các lô 'output' đã gộp, rồi —
 * khi job đã kết thúc và vòng đệm đã rút hết — MỘT khung 'status' cuối mang ảnh chụp đã kết thúc,
 * sau đó dòng đóng bình thường. 'status' đi CÙNG dòng với 'output' nên việc kết thúc không bao giờ
 * tranh được với một kênh đầu ra còn mở.
 */
export type JobFollowFrame =
  | {
      /** Neo đầu dòng: ảnh chụp job lúc mở và mốc bắt đầu đọc. */
      readonly type: "opened";
      /** Ảnh chụp job tại lúc mở dòng. */
      readonly job: JobView;
      /** Mốc byte mà khung 'output' đầu tiếp nối. */
      readonly from: number;
    }
  | {
      /** Một lô đầu ra đã gộp. */
      readonly type: "output";
      /** Các mẩu nằm trong khoảng đã đọc. */
      readonly chunks: readonly JobChunk[];
      /** Mốc byte để nối lại sau khung này. */
      readonly next: number;
      /** Byte giữa mốc yêu cầu và 'chunks' đã bị xoá khỏi vòng đệm. */
      readonly lossy?: true;
    }
  | {
      /** Khung cuối: ảnh chụp đã kết thúc của job. */
      readonly type: "status";
      /** Ảnh chụp job lúc kết thúc. */
      readonly job: JobView;
    };
