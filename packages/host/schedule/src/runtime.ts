/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bộ hẹn giờ của Host trên các tác vụ đã lưu: ScheduleRuntime giữ TỐI ĐA một timer qua mọi lần
 *      tính lại, giao nhắc vào đúng Session gốc rồi ghi trạng thái + biên nhận + lịch sử trong CÙNG một
 *      giao dịch. Việc kích hoạt Session chỉ là thao tác giao nhận. Port 1:1 từ runtime.js (167 dòng)
 *      của @deepseek-ai/dsh-schedule.
 */

import type { Context } from "@deepseek-ai/cordis";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { UserMessage } from "@deepseek-ai/dsh-llm";
import type { Session } from "@deepseek-ai/dsh-session";

import { appendDelivery } from "./delivery-history.ts";
import { renderReminderFraming, renderRecurringReminderBatchFraming } from "./framing.ts";
import { isRecurringScheduleRecord, resolveRecurringOccurrence } from "./occurrence.ts";
import type { ScheduleTask } from "./storage.ts";
import type { DeliveryRetentionBounds, RecurringScheduleRecord, ScheduleId } from "./types.ts";

/** Trần độ trễ mà timer của Node biểu diễn được mà không bị kẹp. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Một Agent sống mà runtime cần để giao nhắc: hộp thư followup và Session sở hữu nó.
 * Khai theo CẤU TRÚC để không kéo augmentation của gói agent vào chương trình.
 */
export interface ScheduleRuntimeAgent {
  /** Session sở hữu agent; cũng là đích của điểm kiểm bền. */
  readonly session: Session;
  /** Đưa tin nhắn vào hộp thư followup của agent (không chờ giao). */
  followup(message: UserMessage): void;
}

/** Kết quả phân giải một Session: Agent sống, hoặc lỗi miền phiên để ném lại nguyên vẹn. */
export type ScheduleRuntimeResolution =
  | { readonly agent: ScheduleRuntimeAgent }
  | { readonly error: unknown };

/** Chân trời Context mà runtime thật sự gọi tới (khai theo CẤU TRÚC, không augment module). */
export interface ScheduleRuntimeSeam {
  /** Sổ agent của Host: chạy một việc KHÔNG kế thừa initiator. */
  readonly agents: { withoutInitiator<T>(operation: () => T): T };
  /** Ghi cảnh báo của gói qua logger của Host. */
  readonly logger: { warn(message: string): void };
  /** Bộ điều khiển phiên: phân giải hoặc khôi phục Agent cho một Session. */
  readonly sessionController: { resolveAgent(sessionId: ScheduleTask["sessionId"]): Promise<ScheduleRuntimeResolution> };
  /** Sổ phiên: điểm kiểm bền duy nhất sau khi followup đã nối vào hộp thư. */
  readonly sessions: { flush(session: Session): Promise<boolean> };
}

/**
 * Nhìn Context cordis qua chân trời cấu trúc mà runtime thật sự gọi tới.
 * @param ctx - Context của plugin mang các dịch vụ Host.
 * @returns Cùng thể hiện đó, khai hẹp còn đúng bốn seam cần dùng.
 */
function seamOf(ctx: Context): ScheduleRuntimeSeam {
  return ctx as unknown as ScheduleRuntimeSeam;
}

/**
 * Giữ tối đa MỘT timer qua mọi lần tính lại; giao nhắc và thao tác quản lý dùng chung một thao tác
 * tuần tự.
 * Nhận: năm phụ thuộc của Host (Context, nguồn tác vụ hiện tại, hàm tuần tự hoá, hàm ghi bền, biên
 *        giữ lịch sử giao).
 * Trả: thể hiện runtime dùng được ngay, chưa có timer và chưa chạy lượt nào.
 */
export class ScheduleRuntime {
  private readonly ctx: Context;
  private readonly tasks: () => readonly ScheduleTask[];
  private readonly transact: (work: () => Promise<void>) => Promise<void>;
  private readonly commit: (task: ScheduleTask) => Promise<void>;
  private readonly retention: DeliveryRetentionBounds;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running: Promise<void> | undefined;
  private stopping = false;
  private requested = false;

  /**
   * Dựng runtime từ năm phụ thuộc của Host.
   * @param ctx - Dịch vụ Host dùng để khôi phục Session và nối hộp thư.
   * @param tasks - Tác vụ bền hiện tại.
   * @param transact - Tuần tự hoá giao nhắc với các lượt ghi quản lý.
   * @param commit - Ghi bền trạng thái, đích, biên nhận và lịch sử cùng nhau sau khi hộp thư đã nhận.
   * @param retention - Biên giữ lịch sử giao áp cho mỗi lần ghi.
   */
  constructor(
    ctx: Context,
    tasks: () => readonly ScheduleTask[],
    transact: (work: () => Promise<void>) => Promise<void>,
    commit: (task: ScheduleTask) => Promise<void>,
    retention: DeliveryRetentionBounds,
  ) {
    this.ctx = ctx;
    this.tasks = tasks;
    this.transact = transact;
    this.commit = commit;
    this.retention = retention;
  }

  /**
   * Tính lại nghĩa vụ gần nhất sau khởi động hoặc sau một thay đổi bền.
   * Lỗi điều phối được ghi log; lượt bị từ chối không tự thử lại.
   * @returns Không; lượt chạy nền được giữ ở trường `running` và tự xoá khi xong.
   */
  requestDrive(): void {
    if (this.stopping) return;
    this.requested = true;
    this.clearTimer();
    if (this.running !== undefined) return;
    const seam = seamOf(this.ctx);
    let run: Promise<void>;
    try {
      run = seam.agents.withoutInitiator(async () => {
        while (this.requested && !this.stopping) {
          this.requested = false;
          await this.transact(async () => { await this.drive(); });
        }
      });
    } catch (error) {
      // Ancestor unloading closes initiator admission before runtime cleanup runs.
      this.requested = false;
      seam.logger.warn(`schedule: dispatch stopped: ${String(error)}`);
      return;
    }
    this.running = run;
    void run.catch((error) => {
      seam.logger.warn(`schedule: dispatch stopped: ${String(error)}`);
    }).finally(() => {
      this.running = undefined;
      if (this.requested && !this.stopping) this.requestDrive();
    });
  }

  /**
   * Dừng timer và rút cạn một lượt giao đã nhận trước khi storage đóng.
   * @returns Promise xong khi runtime đã im lặng hoàn toàn; lỗi của lượt chạy bị nuốt vì
   *          `requestDrive` đã báo lỗi thực thi.
   */
  async dispose(): Promise<void> {
    this.stopping = true;
    this.clearTimer();
    // requestDrive reports execution failures; teardown only waits for quiescence.
    await this.running?.catch(() => undefined);
  }

  /**
   * Xoá timer hiện có (nếu có) và trả trường timer về rỗng.
   * @returns Không.
   */
  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /**
   * Quét mọi tác vụ đã đáo hạn, giao từng nhóm rồi đặt timer cho nghĩa vụ kế tiếp.
   * @returns Promise xong khi lượt quét kết thúc; lỗi từng nhóm chỉ được ghi log.
   */
  private async drive(): Promise<void> {
    this.clearTimer();
    const seam = seamOf(this.ctx);
    const failed = new Set<ScheduleId>();
    const handled = new Set<ScheduleId>();
    const scanNow = Date.now();
    const due = this.tasks().filter((task) => task.status === "active" && Date.parse(task.record.scheduledAt) <= scanNow);
    for (const task of due) {
      if (this.stopping) return;
      if (handled.has(task.record.id)) continue;
      const group = isRecurringScheduleRecord(task.record)
        ? due.filter((candidate) => candidate.sessionId === task.sessionId && isRecurringScheduleRecord(candidate.record))
        : [task];
      for (const member of group) handled.add(member.record.id);
      let admitted = group;
      const committed = new Set<ScheduleId>();
      try {
        const resolved = await seam.sessionController.resolveAgent(task.sessionId);
        if ("error" in resolved) throw resolved.error;
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Disposal can run while Session restoration is awaited.
        if (this.stopping) return;
        const now = Date.now();
        // Session restoration can span a wall-clock rollback; future members keep their timer obligation.
        admitted = group.filter((member) => Date.parse(member.record.scheduledAt) <= now);
        if (admitted.length === 0) continue;
        const recurring = admitted.filter(
          (member): member is ScheduleTask & { readonly record: RecurringScheduleRecord } =>
            isRecurringScheduleRecord(member.record),
        );
        const occurrences = recurring.map((member) => ({
          task: member, occurrence: resolveRecurringOccurrence(member.record, now),
        }));
        const text = isRecurringScheduleRecord(task.record)
          ? renderRecurringReminderBatchFraming(occurrences.map(({ task: member, occurrence }) => ({
            record: member.record, occurrenceAt: occurrence.occurrenceAt,
          })))
          : renderReminderFraming(task.record);
        // `MessageSourceMap` của dsh-llm đã cài KHÔNG khai khoá `schedule` (bản gốc augment module; bản
        // viết lại không augment), nên giữ NGUYÊN hành vi bằng MỘT phép ép kiểu tại đúng chỗ dựng message.
        const message = createUserMessage({
          content: [{ type: "text", text }], source: { kind: "schedule" },
        } as unknown as Parameters<typeof createUserMessage>[0]);
        // followup synchronously appends the inbox splice before flush observes the Session.
        resolved.agent.followup(message);
        const flushed = await seam.sessions.flush(resolved.agent.session);
        if (!flushed) throw new Error("Session persistence did not acknowledge the reminder");
        const deliveredAt = new Date(Date.now()).toISOString();
        if (!isRecurringScheduleRecord(task.record)) {
          await this.commit({
            ...task, status: "inactive",
            ...appendDelivery(task, { scheduledAt: task.record.scheduledAt, deliveredAt, messageId: message.id }, this.retention),
          });
          committed.add(task.record.id);
        }
        for (const { task: member, occurrence } of occurrences) {
          await this.commit({
            ...member,
            record: { ...member.record, scheduledAt: occurrence.nextScheduledAt ?? occurrence.occurrenceAt },
            status: occurrence.nextScheduledAt === undefined ? "inactive" : "active",
            ...appendDelivery(member, { scheduledAt: occurrence.occurrenceAt, deliveredAt, messageId: message.id }, this.retention),
          });
          committed.add(member.record.id);
        }
      } catch (error) {
        // Successful commits and targets made future by clock rollback keep their timer obligation.
        const pending = admitted.filter((member) => !committed.has(member.record.id));
        const failedAt = Date.now();
        for (const member of pending) {
          if (Date.parse(member.record.scheduledAt) <= failedAt) failed.add(member.record.id);
        }
        const ids = pending.map((member) => member.record.id);
        seam.logger.warn(`schedule: reminders ${JSON.stringify(ids)} were not acknowledged: ${String(error)}`);
      }
    }
    if (this.stopping) return;
    const next = this.tasks().filter((task) => task.status === "active" && !failed.has(task.record.id))
      .reduce<number | undefined>((at, task) => {
        const target = Date.parse(task.record.scheduledAt);
        return at === undefined ? target : Math.min(at, target);
      }, undefined);
    if (next !== undefined) {
      this.timer = setTimeout(() => { this.timer = undefined; this.requestDrive(); }, Math.max(0, Math.min(next - Date.now(), MAX_TIMER_DELAY_MS)));
      this.timer.unref();
    }
  }
}
