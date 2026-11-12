/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc NỬA HOST của row job-controller: chủ sở hữu namespace Remote 'job' — phát danh sách job nền mà
 *      một phiên NHÌN THẤY và đầu ra còn giữ của MỘT job cho trình duyệt qua namespace sinh tự động
 *      'job', và huỷ job thay mặt NGƯỜI. Các dòng là ẢNH CHỤP của `ctx.jobs`; con trỏ tiêu thụ và
 *      trạng thái thông báo phía model không bao giờ thấy chúng, và một lần huỷ của người KHÔNG phải
 *      của model nên thông báo hoàn tất vẫn tới agent sở hữu. Bản viết lại 1:1
 *      `@deepseek-ai/dsh-api-job-controller/lib/index.js` (nửa host). Nguồn đối chiếu: README.md (G4).
 */

import type { Context } from "@deepseek-ai/cordis";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { observeJobOutput } from "./observe.ts";
import { streamJobRows } from "./rows.ts";
import type { JobFollowFrame, JobFollowRequest, JobKillRequest, JobKillValue, JobListFrame, JobListRequest } from "./types.ts";

export type * from "./types.ts";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Chủ sở hữu namespace Remote 'job' phía Host. */
    jobController: JobController;
  }
}

/** Cửa sổ gộp mặc định giữa hai lần đọc, tính bằng mili giây. */
const DEFAULT_OBSERVE_FLUSH_MS = 100;

/** Ngân sách byte MỀM mặc định cho mỗi khung đầu ra. */
const DEFAULT_OBSERVE_MAX_FRAME_BYTES = 64 * 1024;

/** Chính sách triển khai của bộ điều phối job. */
export interface Config {
  /** Cửa sổ gộp sau một commit của sổ job trước lần đọc danh sách/đầu ra kế tiếp, mili giây (mặc định 100). */
  readonly observeFlushMs?: number;
  /** Ngân sách byte MỀM cho mỗi khung đầu ra (mặc định 65536); một mẩu lớn hơn đi nguyên khối. */
  readonly observeMaxFrameBytes?: number;
}

/** Service Host đứng sau namespace 'ctx.remote.job' sinh tự động. */
export class JobController extends TypertRemoteService {
  /** Seam bắt buộc: sổ job sống và sổ đăng ký reflection của typert. */
  static inject = ["jobs", "typert"];

  /** Schema Loader cho nhịp quan sát và chính sách đóng khung. */
  static Config = z.object({
    observeFlushMs: z.natural().min(1).default(DEFAULT_OBSERVE_FLUSH_MS),
    observeMaxFrameBytes: z.natural().min(1).default(DEFAULT_OBSERVE_MAX_FRAME_BYTES),
  }) as unknown as z<Config>;

  /** Cửa sổ gộp đã phân giải, tính bằng mili giây. */
  private readonly observeFlushMs: number;

  /** Trần byte mềm cho một khung đầu ra. */
  private readonly observeMaxFrameBytes: number;

  /**
   * Đăng ký service dưới khoá 'jobController' và gắn namespace wire 'job'.
   * Nhận: context Host mang sổ job sống; cấu hình nhịp quan sát và chính sách đóng khung (Loader đã áp mặc định).
   * Trả: không.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "jobController", { namespace: "job" });
    const resolved = config;
    this.observeFlushMs = resolved.observeFlushMs as number;
    this.observeMaxFrameBytes = resolved.observeMaxFrameBytes as number;
  }

  /**
   * Phát các job mà MỘT phiên nhìn thấy — job của chính nó cộng mọi job không chủ — thành khung cả-bộ:
   * một khung lúc mở, rồi một khung sau MỖI đợt commit vòng đời đã gộp. Dòng KHÔNG có kết thúc tự nhiên;
   * tầng vận chuyển đóng nó lại.
   * Nhận: phiên cần phản chiếu tập job nhìn thấy; tín hiệu huỷ do tầng vận chuyển Remote sở hữu.
   * Trả: dãy khung danh sách.
   */
  @Remote({ mode: "stream" })
  list(request: JobListRequest, signal: AbortSignal): AsyncIterable<JobListFrame> {
    return streamJobRows(this.ctx.jobs, request, { flushMs: this.observeFlushMs }, signal);
  }

  /**
   * Phát đầu ra còn giữ của MỘT job từ một mốc byte tuyệt đối, rồi ảnh chụp kết thúc của nó khi đã kết
   * thúc và rút hết. KHÔNG tiêu thụ: con trỏ phía model và trạng thái thông báo không bao giờ thấy các
   * lần đọc này. Phiên trong yêu cầu là bên gọi của phép đọc có hàng rào; registry từ chối job mà phiên
   * không nhìn thấy và job lạ.
   * Nhận: job đích, phiên sở hữu, mốc nối lại tuỳ chọn; tín hiệu huỷ do tầng vận chuyển Remote sở hữu.
   * Trả: neo 'opened', các khung 'output' đã gộp, và khung 'status' kết thúc.
   */
  @Remote({ mode: "stream" })
  follow(request: JobFollowRequest, signal: AbortSignal): AsyncIterable<JobFollowFrame> {
    return observeJobOutput(
      this.ctx.jobs,
      request,
      { flushMs: this.observeFlushMs, maxFrameBytes: this.observeMaxFrameBytes },
      signal,
    );
  }

  /**
   * Huỷ MỘT job nền thay mặt NGƯỜI. Phiên trong yêu cầu là bên gọi của phép đọc có hàng rào, nên job
   * phải là job mà phiên đó nhìn thấy: hàng rào chủ sở hữu của registry là quy tắc truy cập DUY NHẤT.
   * Lần huỷ ghi lý do 'cancelled by the user'; nó không phải do model yêu cầu, nên agent sở hữu vẫn nhận
   * thông báo hoàn tất.
   * Nhận: phiên mà danh sách job của nó mang job này, và id job.
   * Trả: biên nhận của registry cho yêu cầu huỷ.
   */
  @Remote("kill")
  kill(request: JobKillRequest): JobKillValue {
    const jobs = this.ctx.jobs;
    try {
      jobs.get(request.jobId, request.sessionId);
    } catch (error) {
      throw new RemoteError("job/not-found", String(error), {
        sessionId: request.sessionId,
        jobId: request.jobId,
      });
    }
    return { outcome: jobs.kill(request.jobId, request.sessionId, "cancelled by the user") };
  }
}

export default JobController;
