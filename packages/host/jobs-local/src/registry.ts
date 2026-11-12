/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đăng ký job CỤC BỘ TRONG TIẾN TRÌNH: giữ vòng đời, vòng đệm đầu ra có chặn và con trỏ đọc
 *      của model trong bộ nhớ; đăng ký sống lâu hơn fiber của producer/controller; dọn dẹp theo
 *      owner và theo service đều huỷ việc đang chạy rồi chờ producer tuân thủ.
 */

import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { JobId, JobRegistry } from "@deepseek-ai/dsh-jobs";
import type { JobAppendOptions, JobEvent, JobEvents, JobOutcome, JobOutputRead, JobOutputSource, JobRead, JobSettleCause, JobSpec, JobView } from "@deepseek-ai/dsh-jobs";
import type { SessionId } from "@deepseek-ai/dsh-session";
import { ScopedLayers, scopeOf } from "@deepseek-ai/dsh-scope";
import { deadline, timeoutOf } from "@deepseek-ai/dsh-timeout";
import type { Deadline } from "@deepseek-ai/dsh-timeout";
import z from "@deepseek-ai/schemastery";
import { JobEventHub, JobLayer } from "./events.ts";
import { startPump } from "./pump.ts";
import { OutputRing } from "./ring.ts";
import type { JobRecord, JobState, ProducerSettlement, SettlementRecord } from "./types.ts";

/** Mã timeout phân biệt một lần chờ CÓ HẠN với việc người gọi tự huỷ. */
export const TASK_WAIT_TIMEOUT = "TASK_WAIT_TIMEOUT";

/** Trần mặc định số job đang chạy trong một nhóm chủ chính xác. */
const DEFAULT_MAX_CONCURRENT_JOBS_PER_OWNER = 10;
/** Ngân sách giữ vòng đệm SỐNG của mỗi job, tính bằng byte UTF-8. */
const DEFAULT_RETAIN_BYTES = 256 * 1024;
/** Ngân sách giữ vòng đệm SAU KHI job kết thúc, tính bằng byte UTF-8. */
const DEFAULT_SETTLED_RETAIN_BYTES = 16 * 1024;
/** Chu kỳ poll mặc định cho nguồn kéo, tính bằng mili giây. */
const DEFAULT_PUMP_POLL_MS = 150;

/**
 * Cho biết một trạng thái đã là kết thúc.
 * Nhận: trạng thái vòng đời.
 * Trả: true với `completed` · `killed` · `failed`.
 */
function isTerminal(status: JobRecord["status"]): boolean {
  return status === "completed" || status === "killed" || status === "failed";
}

/**
 * Giải phóng một deadline đã cấp, tức gọi `[Symbol.dispose]` của nó, mà KHÔNG phụ thuộc việc lib
 * chuẩn của chương trình có khai báo `Symbol.dispose` hay không. Ngữ nghĩa giống hệt `using` của
 * bản gốc: hẹn giờ được xoá ở nhánh `finally` của lời gọi chờ.
 * Nhận: deadline cần dọn.
 * Trả: không.
 */
function disposeDeadline(d: Deadline): void {
  const key = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (key === undefined) return;
  const release = (d as unknown as Record<symbol, (() => void) | undefined>)[key];
  release?.();
}

/** Cấu hình cho sổ đăng ký job cục bộ trong tiến trình. */
export interface Config {
  /**
   * Số job `running` + `stopping` tối đa cho một owner chính xác hoặc cho nhóm không chủ dùng
   * chung; bỏ trống thì mặc định 10.
   */
  maxConcurrentJobsPerOwner?: number;
  /** Ngân sách giữ vòng đệm sống của mỗi job, tính bằng byte UTF-8; bỏ trống thì mặc định 262144. */
  retainBytes?: number;
  /**
   * Ngân sách giữ vòng đệm sau khi job kết thúc, tính bằng byte UTF-8; bỏ trống thì mặc định 16384.
   * Lúc kết thúc, sổ đăng ký giữ MỌI byte mà con trỏ của model chưa tiêu thụ, TRÊN mức trần này;
   * lần đọc kết thúc đầu tiên của model mới cắt về đúng trần.
   */
  settledRetainBytes?: number;
  /** Chu kỳ poll cho nguồn kéo của một job, tính bằng mili giây; bỏ trống thì mặc định 150. */
  pumpPollMs?: number;
}

/**
 * Sổ đăng ký `jobs` trong bộ nhớ. Xem hợp đồng Service Definition ở `@deepseek-ai/dsh-jobs` để
 * biết ngữ nghĩa sở hữu, cách ly và vòng đời mà bản cài đặt này tuân theo.
 */
export class LocalJobRegistry extends JobRegistry {
  /** Lược đồ Schemastery cho cấu hình của row. */
  static Config = z.object({
    maxConcurrentJobsPerOwner: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_CONCURRENT_JOBS_PER_OWNER),
    retainBytes: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_RETAIN_BYTES),
    settledRetainBytes: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_SETTLED_RETAIN_BYTES),
    pumpPollMs: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_PUMP_POLL_MS),
  });

  /** Trần số job đang chạy, đã áp mặc định của Schemastery. */
  private readonly maxConcurrentJobsPerOwner: number;
  /** Trần giữ vòng đệm sống, đã áp mặc định của Schemastery. */
  private readonly retainBytes: number;
  /** Trần giữ vòng đệm sau khi kết thúc, đã áp mặc định của Schemastery. */
  private readonly settledRetainBytes: number;
  /** Chu kỳ poll nguồn kéo, đã áp mặc định của Schemastery. */
  private readonly pumpPollMs: number;
  /** Bản ghi sống của mọi job chưa bị bỏ, khoá theo id. */
  private store = new Map<JobId, JobRecord>();
  /**
   * Controller và subscription theo scope đã đăng ký, xếp lớp theo scope đã đăng ký chúng — đúng
   * khuôn của sổ công cụ: một đóng góp vào lớp của scope đăng ký nó, và một lần đọc hợp lớp toàn
   * cục với chuỗi scope của owner.
   *
   * Sổ đăng ký là MỘT thực thể toàn tiến trình phục vụ mọi composition, nên một bảng phẳng sẽ trả
   * lời câu hỏi theo-owner bằng phạm vi toàn tiến trình: tay điều khiển job của preset này sẽ giữ
   * `start()` của một agent mà composition của nó không nạp tay nào, và một lần kết thúc sẽ chạm
   * tới listener thông báo của mọi preset. Xếp lớp làm cả hai phép đọc đều tương đối theo owner.
   * Không có cache nào suy ra từ một lớp, nên thông báo thay đổi là vô hiệu.
   */
  private readonly layers = new ScopedLayers<JobLayer>(() => new JobLayer(), () => {});
  /** Bộ định tuyến sự kiện chia sẻ bảng lớp với tay bắt controller. */
  private readonly hub: JobEventHub;
  /** Agent chủ đã gắn dọn dẹp scope, ánh xạ tới ĐÚNG disposer của nó. */
  private ownerCleanups = new Map<Agent, () => void>();
  /** Context của service, dùng cho các continuation kết thúc tách rời và lúc dọn dẹp. */
  private readonly selfCtx: Context;

  /**
   * Dựng sổ đăng ký trên một context cordis; `JobRegistry` cha đã đăng ký service `jobs` và gắn
   * hai listener nhập học lưu trữ của Workspace.
   * Nhận: context đăng ký và cấu hình đã áp mặc định của Schemastery.
   * Trả: thực thể sổ đăng ký (đã tự gắn effect dọn dẹp theo vòng đời context).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx);
    const resolved = config;
    this.maxConcurrentJobsPerOwner = resolved.maxConcurrentJobsPerOwner ?? DEFAULT_MAX_CONCURRENT_JOBS_PER_OWNER;
    this.retainBytes = resolved.retainBytes ?? DEFAULT_RETAIN_BYTES;
    this.settledRetainBytes = resolved.settledRetainBytes ?? DEFAULT_SETTLED_RETAIN_BYTES;
    this.pumpPollMs = resolved.pumpPollMs ?? DEFAULT_PUMP_POLL_MS;
    this.selfCtx = ctx;
    this.hub = new JobEventHub(this.layers, (message) => {
      ctx.logger.warn(message);
    });
    ctx.effect(() => () => this.disposeAll(), "jobs teardown");
  }

  /**
   * Luồng sự kiện gắn với context đang truy cập: một subscription là effect của chính context đó,
   * và `{ owners: 'scope' }` định danh scope của nó.
   * Nhận: không.
   * Trả: mặt `JobEvents` chỉ có `subscribe`.
   */
  get events(): JobEvents {
    const registrar = this.ctx;
    return { subscribe: (filter, listener) => this.hub.subscribe(registrar, filter, listener) };
  }

  /**
   * Kiểm tra trước, đăng ký công việc và cấp id. Mọi từ chối ở bước kiểm tra đều KHÔNG để lại id
   * hay tài nguyên chạy; một `run` ném lỗi cũng không đăng ký gì; sau khi trả về thì việc đăng ký
   * không thể hỏng.
   * Nhận: spec của job (kind, label, owner, toolCall, outputLimitBytes, nguồn kéo, hàm `run`).
   * Trả: id do sổ đăng ký cấp (`<kind>-<16 hex>`).
   */
  start(spec: JobSpec): JobId {
    const owner = this.resolveOwner(spec.owner);
    if (!this.servesOwner(owner)) {
      throw new Error("background jobs unavailable: no job controller serves this agent (load @deepseek-ai/dsh-tool-jobs in its composition)");
    }
    if (spec.kind.length === 0) throw new Error("invalid job kind: expected a non-empty string");
    if (spec.label.length === 0) throw new Error("invalid job label: expected a non-empty string");
    if (spec.outputLimitBytes !== undefined && (!Number.isSafeInteger(spec.outputLimitBytes) || spec.outputLimitBytes <= 0)) {
      throw new Error(`invalid outputLimitBytes: expected a positive safe integer, got ${JSON.stringify(spec.outputLimitBytes)}`);
    }
    if (owner !== undefined) this.ensureOwnerCleanup(owner);
    if (this.activeJobCount(owner) >= this.maxConcurrentJobsPerOwner) {
      throw new Error(
        `background job limit reached for this owner (limit: ${this.maxConcurrentJobsPerOwner}); use job_kill to stop an unneeded job, wait for it to finish, then retry`,
      );
    }
    let id: JobId;
    do id = JobId(`${spec.kind}-${randomUUID().replaceAll("-", "").slice(0, 16)}`);
    while (this.store.has(id));
    const toolCall = spec.toolCall === undefined ? undefined : { ...spec.toolCall };
    const ring = new OutputRing();
    const state: JobState = { progress: undefined, job: undefined };
    const handle = {
      id,
      append: (text: string, options?: JobAppendOptions): void => {
        this.appendRing(state, ring, text, options, "producer");
      },
      updateProgress: (line: string): void => {
        this.updateProgress(state, line);
      },
    };
    const hooks = spec.run(handle);
    let markSettled: () => void = () => {};
    const settled = new Promise<void>((resolve) => {
      markSettled = resolve;
    });
    const job: JobRecord = {
      id,
      toolCall,
      kind: spec.kind,
      label: spec.label,
      outputLimitBytes: spec.outputLimitBytes,
      owner,
      cancel: hooks.cancel.bind(hooks),
      status: "running",
      ring,
      modelCursor: 0,
      resultDelivered: false,
      state,
      detail: undefined,
      result: undefined,
      startedAt: Date.now(),
      finishedAt: undefined,
      killReason: undefined,
      settleCause: undefined,
      settled,
      markSettled,
      waitResolvers: new Set(),
      pump: undefined,
      spillPaths: [],
    };
    state.job = job;
    this.store.set(id, job);
    this.recordSessionEvent(job);
    this.emit({ type: "registered", job: this.view(job) }, owner);
    const producerDone: Promise<ProducerSettlement> = hooks.done.then(
      (outcome) => ({ outcome, producerReported: true }),
      (error: unknown) => {
        this.selfCtx.logger.warn(`jobs: job ${job.id} producer done promise rejected (producer contract violation): ${String(error)}`);
        return { outcome: { status: "failed", detail: String(error) }, producerReported: false };
      },
    );
    if (spec.output !== undefined && spec.output.length > 0) {
      job.pump = startPump(
        spec.output.map((source) => this.guardSource(job, source)),
        {
          append: (text, options) => {
            this.appendRing(state, ring, text, options, "pump");
          },
          spill: (index, path) => {
            job.spillPaths[index] = path;
          },
        },
        this.pumpPollMs,
        Promise.race([producerDone, settled]),
      );
    }
    void producerDone.then(async ({ outcome, producerReported }) => {
      if (job.pump !== undefined) await job.pump.done;
      this.settle(job, outcome, job.settleCause ?? "producer", producerReported);
    });
    return id;
  }

  /**
   * Liệt kê job của người gọi và job không chủ, theo thứ tự đăng ký.
   * Nhận: phiên đang đọc (bỏ trống thì chỉ thấy job không chủ).
   * Trả: mảng bản chiếu MỚI.
   */
  list(caller?: SessionId): JobView[] {
    return [...this.store.values()].filter((job) => job.owner === undefined || job.owner.id === caller).map((job) => this.view(job));
  }

  /**
   * Chiếu một job mà KHÔNG đụng con trỏ đọc của nó.
   * Nhận: id job và phiên đang đọc (đối chiếu với chủ sở hữu).
   * Trả: bản chiếu mới; ném lỗi khi job không tồn tại hoặc thuộc phiên khác.
   */
  get(id: JobId, caller?: SessionId): JobView {
    return this.view(this.expect(id, caller));
  }

  /**
   * Tiêu thụ vòng đệm từ con trỏ của model rồi đẩy con trỏ tới tổng hiện tại. Sau khi job kết thúc,
   * lần đọc đầu tiên còn mang theo `result` của producer.
   * Nhận: id job và phiên đang đọc.
   * Trả: chunk từ con trỏ, cờ mất byte, `result` (một lần), và bản chiếu sau khi đọc.
   */
  read(id: JobId, caller?: SessionId): JobRead {
    return this.readJob(this.expect(id, caller));
  }

  /**
   * Đọc phần vòng đệm còn giữ mà KHÔNG dịch con trỏ của model; đọc tiếp bằng `next` của lần trước.
   * Nhận: id job, offset byte tuyệt đối cần đọc từ đó, và phiên đang đọc.
   * Trả: chunk giao với `[from, total)`, offset để đọc tiếp, và cờ mất byte; ném lỗi khi offset
   * không phải số nguyên an toàn không âm, hoặc job không tồn tại/thuộc phiên khác.
   */
  readAt(id: JobId, from: number, caller?: SessionId): JobOutputRead {
    const job = this.expect(id, caller);
    if (!Number.isSafeInteger(from) || from < 0) {
      throw new Error(`invalid output read offset: expected a non-negative safe integer, got ${JSON.stringify(from)}`);
    }
    return job.ring.readFrom(from);
  }

  /**
   * Yêu cầu huỷ rồi đánh dấu job đang dừng. Lỗi ném từ producer được truyền nguyên vẹn mà không đổi
   * trạng thái job; lý do (nếu có) được ghép vào `detail` khi job kết thúc là `killed`.
   * Nhận: id job, phiên đang kill, và lý do tuỳ chọn.
   * Trả: `requested` với việc còn sống, `already-finished` nếu đã kết thúc.
   */
  kill(id: JobId, caller?: SessionId, reason?: string): "requested" | "already-finished" {
    return this.killJob(this.expect(id, caller), reason);
  }

  /**
   * Chờ job kết thúc hoặc hết hạn mà KHÔNG huỷ job. Huỷ từ phía người gọi chỉ ném lỗi khi job còn
   * sống; sau khi kết thúc thì bản chiếu kết thúc thắng.
   * Nhận: id job, hạn chờ (ms, hữu hạn dương), phiên đang chờ, và tín hiệu huỷ tuỳ chọn.
   * Trả: bản chiếu tại lúc kết thúc hoặc lúc hết hạn; ném lỗi khi hạn không hợp lệ hoặc job
   * không tồn tại/thuộc phiên khác.
   */
  async wait(id: JobId, timeoutMs: number, caller?: SessionId, signal?: AbortSignal): Promise<JobView> {
    return this.waitJob(this.expect(id, caller), timeoutMs, signal);
  }

  /**
   * Bỏ bản ghi của MỘT job đã kết thúc khỏi tập nhìn thấy được và phát `removed`.
   * Nhận: id job đã kết thúc, và phiên đang bỏ.
   * Trả: không; ném lỗi khi job còn sống, không tồn tại, hoặc thuộc phiên khác.
   */
  remove(id: JobId, caller?: SessionId): void {
    const job = this.expect(id, caller);
    if (!isTerminal(job.status)) throw new Error(`job ${id} is still ${job.status}; kill it and wait for settlement before removing it`);
    this.drop([job]);
  }

  /**
   * Gắn một controller có phạm vi effect để đọc và dừng job. Nó phục vụ các owner mà scope của
   * context đăng ký bao phủ, và `start` từ chối một owner không controller nào phục vụ.
   * Nhận: nhãn chẩn đoán (trùng tên vẫn độc lập).
   * Trả: disposer để gỡ controller.
   */
  attachController(name: string): () => void {
    const token = Symbol(name);
    return this.layers.effect(this.ctx, (layer) => layer.controllers.append(token), { label: "jobs.attachController()" });
  }

  /**
   * Phân giải phiên chủ của spec thành Agent ĐANG SỐNG. Một đăng ký có chủ cần sổ agent, và phiên
   * phải đang có thực thể sống: chính việc huỷ thực thể đó là thứ huỷ và bỏ job.
   * Nhận: id phiên chủ (hoặc `undefined` với job không chủ).
   * Trả: Agent chủ, hoặc `undefined`; ném lỗi khi thiếu sổ agent hoặc phiên không có agent sống.
   */
  private resolveOwner(session: SessionId | undefined): Agent | undefined {
    if (session === undefined) return undefined;
    const agents = this.selfCtx.get("agents");
    if (agents === undefined) throw new Error("background job ownership requires the agent registry (load @deepseek-ai/dsh-agent)");
    const owner = agents.get(session);
    if (owner === undefined) throw new Error(`session "${session}" has no live agent (background job owner must be live)`);
    return owner;
  }

  /**
   * Cho biết có controller job nào đó phục vụ được `owner`. Lớp toàn cục giữ mọi controller gắn từ
   * context không scope — tay điều khiển của chính composition host — nên phục vụ MỌI owner; một
   * controller theo scope chỉ phục vụ đúng các agent được ghép bên dưới nó.
   * Nhận: owner của job, hoặc `undefined` với việc không chủ.
   * Trả: true khi có controller tiếp cận được phục vụ owner đó.
   */
  private servesOwner(owner: Agent | undefined): boolean {
    if (!this.layers.global.controllers.isEmpty()) return true;
    return this.layers.chainLayers(owner === undefined ? undefined : scopeOf(owner.ctx)).some((layer) => !layer.controllers.isEmpty());
  }

  /**
   * Đếm số bản ghi đang hoạt động của ĐÚNG một owner hoặc của nhóm không chủ dùng chung.
   * Nhận: owner cần đếm (hoặc `undefined`).
   * Trả: số job `running` hoặc `stopping` của owner đó.
   */
  private activeJobCount(owner: Agent | undefined): number {
    let count = 0;
    for (const job of this.store.values()) {
      if (job.owner === owner && (job.status === "running" || job.status === "stopping")) count += 1;
    }
    return count;
  }

  /**
   * Tra một job và áp hàng rào truy cập của người gọi.
   * Nhận: id job và phiên đang truy cập.
   * Trả: bản ghi sống; ném lỗi khi không tồn tại hoặc thuộc phiên khác.
   */
  private expect(id: JobId, caller: SessionId | undefined): JobRecord {
    const job = this.store.get(id);
    if (job === undefined) throw new Error(`unknown job ${id}`);
    this.assertAccess(job, caller);
    return job;
  }

  /**
   * Hàng rào cách ly: job CÓ chủ chỉ tiếp cận được bởi người gọi có id phiên trùng khớp (ngữ nghĩa
   * `!== undefined` — job không chủ là mở, và một lần đọc không kèm phiên không bao giờ khớp job có
   * chủ).
   * Nhận: bản ghi job và phiên đang truy cập.
   * Trả: không; ném lỗi khi job thuộc phiên khác.
   */
  private assertAccess(job: JobRecord, caller: SessionId | undefined): void {
    if (job.owner !== undefined && job.owner.id !== caller) throw new Error(`job ${job.id} belongs to another session`);
  }

  /**
   * Chiếu một bản chiếu CHỈ ĐỌC, MỚI, từ bản ghi đang thay đổi (không bao giờ trao trạng thái sống).
   * Nhận: bản ghi job.
   * Trả: `JobView` với các trường tuỳ chọn chỉ xuất hiện khi có giá trị.
   */
  private view(job: JobRecord): JobView {
    const owner = job.owner?.id;
    const spillPaths = [...new Set(job.spillPaths.filter((path) => path !== undefined))];
    return {
      id: job.id,
      kind: job.kind,
      label: job.label,
      ...(owner !== undefined ? { owner } : {}),
      ...(job.outputLimitBytes !== undefined ? { outputLimitBytes: job.outputLimitBytes } : {}),
      status: job.status,
      ...(job.state.progress !== undefined ? { progress: job.state.progress } : {}),
      ...(job.detail !== undefined ? { detail: job.detail } : {}),
      startedAt: job.startedAt,
      ...(job.finishedAt !== undefined ? { finishedAt: job.finishedAt } : {}),
      output: {
        total: job.ring.total,
        earliest: job.ring.earliest,
        ...(spillPaths.length > 0 ? { spillPaths } : {}),
      },
    };
  }

  /**
   * Phát một sự kiện vòng đời/đầu ra qua hub.
   * Nhận: sự kiện và owner của job.
   * Trả: không.
   */
  private emit(event: JobEvent, owner: Agent | undefined): void {
    this.hub.emit(event, owner);
  }

  /**
   * Ghi sự kiện vòng đời vào vết phiên TRƯỚC khi subscriber sống hay người chờ kết thúc phản ứng.
   * Nhận: bản ghi job và phần dữ liệu kết thúc (bỏ trống = ghi `job/registered`).
   * Trả: không (lỗi ghi vết chỉ được log, không phá vòng đời job).
   */
  private recordSessionEvent(job: JobRecord, settlement?: SettlementRecord): void {
    const owner = job.owner;
    if (owner === undefined) return;
    const session = owner.session;
    const data = {
      jobId: job.id,
      owner: owner.id,
      kind: job.kind,
      label: job.label,
      startedAt: job.startedAt,
      ...(job.toolCall !== undefined ? { toolCall: job.toolCall } : {}),
    };
    try {
      if (settlement === undefined) session.append("job/registered", data);
      else session.append("job/settled", { ...data, ...settlement });
    } catch (error) {
      this.selfCtx.logger.warn(`jobs: failed to record lifecycle for ${job.id}: ${String(error)}`);
    }
  }

  /**
   * Tiêu thụ vòng đệm từ con trỏ của model; `result` đi kèm ở lần đọc ĐẦU TIÊN sau khi kết thúc.
   * Một lần đọc khi đã kết thúc cũng là mốc mà dòng đã chốt hạ xuống trần `settledRetainBytes`:
   * lúc kết thúc, sổ đăng ký đã giữ mọi byte chưa tiêu thụ cho chính lần đọc này.
   * Nhận: bản ghi job.
   * Trả: chunk từ con trỏ, cờ mất byte, `result` (nếu tới lượt), và bản chiếu sau khi đọc.
   */
  private readJob(job: JobRecord): JobRead {
    const read = job.ring.readFrom(job.modelCursor);
    job.modelCursor = job.ring.total;
    const result = isTerminal(job.status) && !job.resultDelivered ? job.result : undefined;
    if (result !== undefined) job.resultDelivered = true;
    if (isTerminal(job.status)) job.ring.trim(this.settledRetainBytes);
    return { chunks: read.chunks, lossy: read.lossy, ...(result !== undefined ? { result } : {}), job: this.view(job) };
  }

  /**
   * Chuyển một job còn sống sang `stopping` và yêu cầu producer huỷ.
   * Nhận: bản ghi job và lý do kill tuỳ chọn.
   * Trả: `already-finished` khi job đã kết thúc, ngược lại `requested`.
   */
  private killJob(job: JobRecord, reason: string | undefined): "requested" | "already-finished" {
    if (isTerminal(job.status)) return "already-finished";
    job.cancel(reason);
    job.status = "stopping";
    if (reason !== undefined) job.killReason = reason;
    job.settleCause = "kill";
    this.emit({ type: "stopping", job: this.view(job) }, job.owner);
    return "requested";
  }

  /**
   * Chờ bản ghi job kết thúc trong hạn cho trước.
   * Nhận: bản ghi job, hạn chờ (ms), và tín hiệu huỷ tuỳ chọn của người gọi.
   * Trả: bản chiếu tại lúc kết thúc hoặc lúc hết hạn; ném `invalid wait timeout` khi hạn không hợp
   * lệ và `wait aborted` khi tín hiệu huỷ tới trước lúc job kết thúc (hết hạn thì KHÔNG ném).
   */
  private async waitJob(job: JobRecord, timeoutMs: number, signal: AbortSignal | undefined): Promise<JobView> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error(`invalid wait timeout: expected a positive number of milliseconds, got ${JSON.stringify(timeoutMs)}`);
    }
    if (!isTerminal(job.status)) {
      if (signal?.aborted) throw new Error("wait aborted");
      const d = deadline(signal, timeoutMs, TASK_WAIT_TIMEOUT);
      try {
        await new Promise<void>((resolve, reject) => {
          const onSettled = (): void => {
            job.waitResolvers.delete(onSettled);
            d.signal.removeEventListener("abort", onAbort);
            resolve();
          };
          const onAbort = (): void => {
            job.waitResolvers.delete(onSettled);
            if (timeoutOf(d.signal, TASK_WAIT_TIMEOUT) !== undefined) resolve();
            else reject(new Error("wait aborted"));
          };
          job.waitResolvers.add(onSettled);
          d.signal.addEventListener("abort", onAbort, { once: true });
        });
      } finally {
        disposeDeadline(d);
      }
    }
    return this.view(job);
  }

  /**
   * Ghi một chunk vào vòng đệm. Chunk của producer nhắm vào job đã kết thúc thì bị log rồi bỏ;
   * bơm của chính sổ đăng ký hút im lặng sau khi kết thúc (một lần kết thúc bị ép có thể tới trước
   * producer). Chunk ghi trong chính lời gọi `start` vẫn được giữ và KHÔNG báo cho người quan sát —
   * lần chốt đăng ký mới công bố nó.
   * Nhận: trạng thái soạn thảo, vòng đệm, text, tuỳ chọn nhãn/dấu mất byte, và nguồn ghi.
   * Trả: không.
   */
  private appendRing(
    state: JobState,
    ring: OutputRing,
    text: string,
    options: JobAppendOptions | undefined,
    writer: "producer" | "pump",
  ): void {
    const job = state.job;
    if (job !== undefined && isTerminal(job.status)) {
      if (writer === "producer") this.selfCtx.logger.warn(`jobs: append to settled job ${job.id} dropped`);
      return;
    }
    if (!ring.append(text, options, this.retainBytes)) return;
    if (job !== undefined) this.emitOutput(job);
  }

  /**
   * Bọc một nguồn kéo hay ném lỗi: lần ném ĐẦU TIÊN được log, và từ đó nguồn đọc như đã cạn, nên
   * job chạy tới lúc kết thúc với những gì vòng đệm đang có thay vì treo vì bơm hỏng.
   * Nhận: bản ghi job và nguồn của producer.
   * Trả: nguồn đã bọc, giữ nguyên nhãn luồng của nguồn gốc.
   */
  private guardSource(job: JobRecord, source: JobOutputSource): JobOutputSource {
    let failed = false;
    return {
      ...(source.channel !== undefined ? { channel: source.channel } : {}),
      read: (fromByte: number) => {
        if (failed) return { text: "", nextOffset: fromByte, lossy: false };
        try {
          return source.read(fromByte);
        } catch (error) {
          failed = true;
          this.selfCtx.logger.warn(`jobs: output source for ${job.id} failed; its stream stops here: ${String(error)}`);
          return { text: "", nextOffset: fromByte, lossy: false };
        }
      },
    };
  }

  /**
   * Báo rằng vòng đệm của một job vừa tiến (do ghi thêm hoặc do kết thúc).
   * Nhận: bản ghi job.
   * Trả: không.
   */
  private emitOutput(job: JobRecord): void {
    const owner = job.owner?.id;
    this.emit({ type: "output", id: job.id, ...(owner !== undefined ? { owner } : {}), total: job.ring.total }, job.owner);
  }

  /**
   * Thay dòng tiến độ sống qua mặt producer; ghi vào job đã kết thúc thì bị log rồi bỏ. Ghi trong
   * chính lời gọi `start` sẽ gieo bản chiếu lúc đăng ký và không báo cho người quan sát.
   * Nhận: trạng thái soạn thảo và dòng tiến độ mới.
   * Trả: không.
   */
  private updateProgress(state: JobState, line: string): void {
    const job = state.job;
    if (job !== undefined && isTerminal(job.status)) {
      this.selfCtx.logger.warn(`jobs: progress update on settled job ${job.id} dropped`);
      return;
    }
    state.progress = line;
    if (job !== undefined) this.emit({ type: "progress", job: this.view(job) }, job.owner);
  }

  /**
   * Chốt kết cục kết thúc ĐẦU TIÊN, giải phóng người chờ, rồi công bố việc kết thúc. "Ai tới trước
   * thắng" giữ được một lần ép hỏng lúc dọn dẹp trước một producer kết thúc muộn. Sự kiện `settled`
   * đi SAU mọi người chờ đã được giải phóng và báo nó có giải phóng ai không: một lần chờ đã hết
   * hạn hoặc bị huỷ thì đã rời tập hợp, nên chỉ lần chờ còn "nợ" bản chiếu mới được tính.
   * Nhận: bản ghi job, kết cục, nguồn kết thúc, và việc producer có tự báo hay không.
   * Trả: không (gọi lại trên job đã kết thúc là vô hiệu).
   */
  private settle(job: JobRecord, outcome: JobOutcome, cause: JobSettleCause, producerReported: boolean): void {
    if (isTerminal(job.status)) return;
    job.status = outcome.status;
    if (outcome.status === "killed" && job.killReason !== undefined) {
      job.detail = outcome.detail !== undefined ? `${outcome.detail}; ${job.killReason}` : job.killReason;
    } else if (outcome.detail !== undefined) job.detail = outcome.detail;
    job.state.progress = undefined;
    job.result = outcome.result;
    job.finishedAt = Date.now();
    this.recordSessionEvent(job, {
      finishedAt: job.finishedAt,
      status: outcome.status,
      cause,
      producerReported,
      ...(job.detail !== undefined ? { detail: job.detail } : {}),
    });
    job.ring.trim(Math.max(this.settledRetainBytes, job.ring.total - job.modelCursor));
    const waitResolvers = [...job.waitResolvers];
    job.waitResolvers.clear();
    for (const resolveWait of waitResolvers) resolveWait();
    job.markSettled();
    this.emit({ type: "settled", job: this.view(job), cause, awaited: waitResolvers.length > 0 }, job.owner);
    this.emitOutput(job);
  }

  /**
   * Gắn MỘT dọn dẹp được chờ qua đúng scope của owner. Nó sống sót qua các lần nạp lại producer và
   * nhập vào quiescence của agent; disposer được giữ lại để việc dọn service gỡ được effect
   * xuyên-fiber này.
   * Nhận: Agent chủ.
   * Trả: không (đã gắn thì gọi lại là vô hiệu).
   */
  private ensureOwnerCleanup(owner: Agent): void {
    if (this.ownerCleanups.has(owner)) return;
    const detach = owner.ctx.effect(() => async () => {
      this.ownerCleanups.delete(owner);
      await this.disposeOwned(owner);
    }, "jobs.ownerCleanup()");
    this.ownerCleanups.set(owner, detach);
  }

  /**
   * Huỷ, chờ mọi bản ghi kết thúc, rồi bỏ MỌI job của đúng một vòng đời agent.
   * Nhận: Agent chủ đã bị huỷ.
   * Trả: lời hứa thoả sau khi đã bỏ xong bản ghi.
   */
  private async disposeOwned(owner: Agent): Promise<void> {
    const owned = [...this.store.values()].filter((job) => job.owner === owner);
    this.cancelForTeardown(owned, "owner disposed");
    await Promise.all(owned.map((job) => job.settled));
    this.drop(owned);
  }

  /**
   * Bỏ bản ghi đã kết thúc và công bố từng lần gỡ — thay đổi DUY NHẤT của tập nhìn thấy được mà
   * không bản ghi theo-job nào mang.
   * Nhận: danh sách bản ghi cần bỏ.
   * Trả: không.
   */
  private drop(jobs: readonly JobRecord[]): void {
    for (const job of jobs) {
      this.store.delete(job.id);
      this.emit({ type: "removed", job: this.view(job) }, job.owner);
    }
  }

  /**
   * Huỷ job còn sống, chờ kết thúc, bỏ mọi bản ghi, và gỡ effect của các owner. Cancel ném lỗi được
   * ép hỏng để tránh deadlock lúc dọn dẹp.
   * Nhận: không.
   * Trả: lời hứa thoả sau khi dọn xong toàn bộ.
   */
  private async disposeAll(): Promise<void> {
    const all = [...this.store.values()];
    this.cancelForTeardown(all, "jobs service disposed");
    await Promise.all(all.map((job) => job.settled));
    this.drop(all);
    const ownerCleanups = [...this.ownerCleanups.values()];
    this.ownerCleanups.clear();
    await Promise.all(ownerCleanups.map((cleanup) => Promise.resolve(cleanup())));
  }

  /**
   * Huỷ job lúc dọn dẹp, bọc lỗi theo TỪNG job. Một cancel ném lỗi sẽ ép bản ghi hỏng và báo khả
   * năng còn tiến trình mồ côi; một cancel trả về mà không kết thúc thì không phân biệt được với
   * một lần dừng chậm và có thể treo.
   * Nhận: danh sách bản ghi và lý do dọn dẹp.
   * Trả: không.
   */
  private cancelForTeardown(jobs: readonly JobRecord[], reason: string): void {
    for (const job of jobs) {
      if (isTerminal(job.status)) continue;
      job.settleCause = "teardown";
      try {
        job.cancel(reason);
        job.status = "stopping";
        this.emit({ type: "stopping", job: this.view(job) }, job.owner);
      } catch (error) {
        const detail = `cancel threw during teardown; work may be orphaned: ${String(error)}`;
        this.selfCtx.logger.warn(`jobs: cancel of ${job.id} threw during teardown; job record forced failed and work may be orphaned: ${String(error)}`);
        this.settle(job, { status: "failed", detail }, "teardown", false);
      }
    }
  }
}

export default LocalJobRegistry;
