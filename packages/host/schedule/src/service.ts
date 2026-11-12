/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dịch vụ `ctx.schedule`: nhắc hẹn BỀN theo host — tạo/đọc/sửa/xoá không đánh thức Agent, cửa sổ
 *      lịch sử giao nhận theo cấu hình, và hai lượt nghe workspace chặn lưu trữ phiên còn nhắc hẹn armed.
 *      Viết lại 1:1 theo hành vi `lib/types/index.js` (bản KHÔNG bundle) của @deepseek-ai/dsh-schedule;
 *      seam kernel khai theo CẤU TRÚC nên tệp này không augment module nào.
 */

import { randomUUID } from "node:crypto";

import { Service, type Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { Session, SessionId } from "@deepseek-ai/dsh-session";
import { delegationDepthOf } from "@deepseek-ai/dsh-subagent";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { ScheduleId, ScheduleInputError, ScheduleLogError, scheduleTitle } from "./codec.ts";
import { deliveryHistoryPage } from "./delivery-history.ts";
import { foldScheduleEvents } from "./occurrence.ts";
import {
  createAfterScheduleRecord,
  createAtScheduleRecord,
  createCronScheduleRecord,
  createDailyScheduleRecord,
  createEveryScheduleRecord,
  createWeeklyScheduleRecord,
} from "./records.ts";
import { ScheduleRuntime } from "./runtime.ts";
import { scheduleDomain } from "./storage.ts";
import type { ScheduleTask } from "./storage.ts";
import type {
  Config,
  DeliveryRetentionBounds,
  ScheduleCatalogEntry,
  ScheduleCreateRequest,
  ScheduleDeleteRequest,
  ScheduleDeleteResult,
  ScheduleDeliveryHistoryRequest,
  ScheduleDeliveryHistoryResult,
  ScheduleListRequest,
  ScheduleRecord,
  ScheduleUpdateRequest,
  ScheduleUpdateResult,
  SubagentSessionError,
} from "./types.ts";
import { resolveScheduleUpdate } from "./update.ts";

/** Cửa sổ lịch sử giao nhận (ngày) áp khi triển khai không khai. */
const DEFAULT_DELIVERY_HISTORY_DAYS = 30;

/** Trần bản ghi lịch sử giao nhận áp khi triển khai không khai. */
const DEFAULT_DELIVERY_HISTORY_RECORDS = 200;

/** Danh tính một task bền — đúng kiểu khoá mà bảng `tasks` dùng (`ScheduleId` đã đóng dấu). */
type ScheduleTaskId = ScheduleTask["record"]["id"];

/** Bảng `tasks` của miền lưu trữ — đúng bốn phép mà dịch vụ gọi tới. */
interface ScheduleTaskTable {
  /** Liệt kê mọi dòng đã lưu (đồng bộ, theo thứ tự lưu trữ). */
  entries(): IterableIterator<[ScheduleTaskId, ScheduleTask]>;
  /** Đọc một dòng theo danh tính task, hoặc `undefined` khi chưa có. */
  get(id: ScheduleTaskId): ScheduleTask | undefined;
  /** Ghi bền một dòng rồi mới cập nhật bộ nhớ của miền. */
  put(id: ScheduleTaskId, task: ScheduleTask): Promise<void>;
  /** Xoá bền một dòng; trả `true` khi dòng đó thực sự tồn tại. */
  delete(id: ScheduleTaskId): Promise<boolean>;
}

/** Một miền lưu trữ đã mở — chỉ hai thành viên mà dịch vụ gọi tới. */
interface ScheduleDomainSeam {
  /** Lấy bảng theo tên đã khai trong spec của miền. */
  table(name: "tasks"): ScheduleTaskTable;
  /** Đóng miền, giải phóng tay nắm của backend. */
  close(): Promise<void>;
}

/** Cơ sở lưu trữ miền của kernel (`ctx.storageDomain`) — chỉ phép mở miền. */
interface ScheduleStorageFacility {
  /** Mở miền Schedule theo đúng spec `scheduleDomain` của gói này. */
  open(spec: typeof scheduleDomain): Promise<ScheduleDomainSeam>;
}

/** Sổ agent đang sống của kernel — chỉ phép tra mà phép từ chối Session subagent dùng. */
interface ScheduleAgentRegistry {
  /** Tra agent đang sống theo id phiên, hoặc `undefined`. */
  get(id: string): Agent | undefined;
}

/** Bộ ghi log của kernel — chỉ đường cảnh báo fail-soft. */
interface ScheduleLogger {
  /** Ghi một dòng cảnh báo. */
  warn(message: string): void;
}

/** Một mục hoạt động có danh tính riêng mà listener báo cho sổ workspace. */
interface ScheduleActivityItem {
  /** Danh tính riêng của họ hoạt động (ở đây là id task). */
  readonly id: string;
  /** Nhãn hiển thị của mục. */
  readonly label?: string;
}

/** Một họ hoạt động phiên mà listener `workspace/session-activity` báo. */
interface ScheduleActivity {
  /** Tên họ hoạt động; gói này trả lời họ `schedule`. */
  readonly kind: string;
  /** Các mục đang hoạt động của họ (vắng với họ không có danh tính riêng). */
  readonly items?: readonly ScheduleActivityItem[];
}

/** Payload của waterfall `workspace/session-activity` và sự kiện `workspace/session-stop`. */
interface ScheduleActivityRequest {
  /** Phiên đang được hỏi / sắp bị lưu trữ. */
  readonly sessionId: SessionId;
}

/** Thân hiệu ứng mà `ctx.effect` nhận: một hàm dọn, promise của nó, hoặc dãy các hàm dọn. */
type ScheduleEffect =
  | (() => unknown)
  | Promise<() => unknown>
  | Iterable<() => unknown>
  | AsyncIterable<() => unknown>;

/** Hàm dọn của một hiệu ứng cordis: gọi được VÀ chờ được (đúng hình dạng `ctx.effect` trả). */
type ScheduleDisposer = (() => Promise<void>) & PromiseLike<unknown>;

/**
 * Context cordis nhìn qua ĐÚNG phần bề mặt mà dịch vụ này gọi.
 * Vì sao khai theo cấu trúc thay vì augment `Context` của cordis: augment `schedule`/`agents`/
 * `storageDomain` bằng kiểu của TA sẽ ĐÈ kiểu thật của các gói kernel trong cùng chương trình tsc
 * (TS2717) — đúng lớp lỗi cấm của repo. Một phép ép kiểu ở ĐÚNG MỘT ranh giới thì không lan sang gói nào.
 */
interface ScheduleContextSeam {
  /** Cơ sở lưu trữ miền. */
  readonly storageDomain: ScheduleStorageFacility;
  /** Sổ agent đang sống. */
  readonly agents: ScheduleAgentRegistry;
  /** Logger của kernel. */
  readonly logger: ScheduleLogger;
  /**
   * Đăng ký một hiệu ứng sống theo vòng đời fiber.
   * Nhận: hàm dựng trả hàm dọn (hoặc promise/dãy hàm dọn), và nhãn chẩn đoán tuỳ chọn.
   * Trả: hàm dọn gọi được và chờ được.
   */
  effect(execute: () => ScheduleEffect, label?: string): ScheduleDisposer;
  /**
   * Nghe sự kiện `session/created` (một lần cho mỗi phiên mới).
   * Nhận: người nghe nhận phiên vừa tạo, và tuỳ chọn `global`.
   * Trả: hàm gỡ người nghe.
   */
  on(
    event: "session/created",
    listener: (session: Session) => void,
    options: { global?: boolean },
  ): () => void;
  /**
   * Nghe waterfall `workspace/session-activity` (hỏi phiên có đang hoạt động không).
   * Nhận: người nghe nhận payload và `next` của waterfall.
   * Trả: hàm gỡ người nghe.
   */
  on(
    event: "workspace/session-activity",
    listener: (
      payload: ScheduleActivityRequest,
      next: () => Promise<readonly ScheduleActivity[]>,
    ) => Promise<readonly ScheduleActivity[]>,
  ): () => void;
  /**
   * Nghe sự kiện `workspace/session-stop` (phiên đã được lưu trữ).
   * Nhận: người nghe nhận payload; giá trị trả bị bỏ qua.
   * Trả: hàm gỡ người nghe.
   */
  on(event: "workspace/session-stop", listener: (payload: ScheduleActivityRequest) => unknown): () => void;
  /**
   * Phát một sự kiện KHÔNG phạm vi của kernel.
   * Nhận: tên sự kiện và thân sự kiện.
   * Trả: không; lỗi đồng bộ của người nghe LAN ra người gọi (đúng `ctx.emit`).
   */
  emit(event: "schedule/changed"): void;
}

/**
 * Nhìn Context cordis qua chân trời CẤU TRÚC mà dịch vụ thật sự gọi tới.
 * Nhận: `ctx` — Context của plugin.
 * Trả: cùng thể hiện đó, khai hẹp còn đúng các seam cần dùng.
 */
function seamOf(ctx: Context): ScheduleContextSeam {
  return ctx as unknown as ScheduleContextSeam;
}

/**
 * Dịch vụ quản lý dùng chung; lượt đọc, lượt xoá và lượt sửa thời điểm KHÔNG BAO GIỜ đánh thức một Session.
 *
 * `sessionPersistence` là yêu cầu THỨ TỰ NẠP chứ không phải dịch vụ được gọi trực tiếp: một lượt giao
 * nhận chỉ cam kết khi `ctx.sessions.flush()` báo rằng có listener `session/flush` tham gia, và backend
 * bền cung cấp dịch vụ ấy chính là plugin đăng ký listener đó.
 */
export class ScheduleService extends TypertRemoteService {
  /** Năm seam phải sẵn sàng trước khi dịch vụ thức dậy (hai seam cuối chỉ là yêu cầu thứ tự nạp). */
  static inject = ["agents", "sessions", "storageDomain", "sessionController", "sessionPersistence"];

  /** Cấu hình plugin: hai ngưỡng lưu giữ lịch sử giao nhận (nguyên văn bản gốc). */
  static Config = z.object({
    deliveryHistoryDays: z.number().step(1).min(1).max(3650).default(DEFAULT_DELIVERY_HISTORY_DAYS),
    deliveryHistoryRecords: z.number().step(1).min(1).max(10_000).default(DEFAULT_DELIVERY_HISTORY_RECORDS),
  });

  /** Ngưỡng lưu giữ đã phân giải, chia sẻ với runtime nối acknowledgment. */
  private readonly retention: DeliveryRetentionBounds;

  /** Miền lưu trữ đã mở; reject khi khoá dòng lệch id bản ghi. */
  private readonly ready: Promise<ScheduleDomainSeam>;

  /** Hiệu ứng dọn theo vòng đời plugin — `Service.init` chờ nó. */
  private readonly initialized: ScheduleDisposer;

  /** Hàng đợi FIFO: mọi lượt ghi quản lý chạy tuần tự trên MỘT chuỗi. */
  private chain: Promise<unknown> = Promise.resolve();

  /** Runtime hẹn giờ + giao nhận; vắng cho tới khi effect khởi tạo chạy xong. */
  private runtime: ScheduleRuntime | undefined;

  /** Cờ dịch vụ đang dừng: lượt serialize mới bị từ chối. */
  private stopping = false;

  /**
   * Đăng ký dịch vụ `schedule`, mở miền lưu trữ, và nối ba hiệu ứng của bản gốc (dọn theo vòng đời,
   * nghe `session/created`, chặn lưu trữ phiên còn nhắc hẹn armed).
   * Nhận: `ctx` — Context sở hữu plugin; `config` — cấu hình lưu giữ đã kiểm (có thể rỗng).
   * Trả: thể hiện dịch vụ đã cài; runtime chỉ sống sau khi effect khởi tạo hoàn tất.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "schedule");
    const seam = seamOf(ctx);
    this.retention = {
      days: config.deliveryHistoryDays ?? DEFAULT_DELIVERY_HISTORY_DAYS,
      records: config.deliveryHistoryRecords ?? DEFAULT_DELIVERY_HISTORY_RECORDS,
    };
    this.ready = seam.storageDomain.open(scheduleDomain).then(async (domain) => {
      for (const [key, task] of domain.table("tasks").entries()) {
        if (key !== task.record.id) {
          // Sự lệch khoá là lỗi CẦN BÁO; một lượt đóng reject không được phép thay thế nó.
          try {
            await domain.close();
          } catch (error) {
            seam.logger.warn(`schedule: closing the domain after a key mismatch failed: ${String(error)}`);
          }
          throw new Error(`schedule: stored task key "${key}" differs from record id "${task.record.id}"`);
        }
      }
      return domain;
    });
    this.initialized = seam.effect(async (): Promise<() => unknown> => {
      const domain = await this.ready;
      // Kiểu GỌI ĐƯỢC thuần (không kèm thenable): một async effect trả giá trị thenable sẽ bị TS
      // "await" thành unknown ở chỗ return, nên biến dọn chỉ giữ phần hàm.
      let cleanup: () => Promise<void>;
      try {
        cleanup = seam.effect(() => async () => {
          this.stopping = true;
          await this.runtime?.dispose();
          await this.chain; // Chuỗi đã chứa lỗi sau khi trả chúng cho người gọi.
          await domain.close();
        });
      } catch (error) {
        this.stopping = true;
        await domain.close();
        throw error;
      }
      const tasks = domain.table("tasks");
      this.runtime = new ScheduleRuntime(
        ctx,
        () => [...tasks.entries()].map(([, task]) => task),
        (work) => this.serialize(work),
        async (task) => {
          await tasks.put(task.record.id, task);
          this.emitChanged();
        },
        this.retention,
      );
      this.runtime.requestDrive();
      return cleanup;
    });
    seam.on(
      "session/created",
      (session) => {
        // Sự kiện Schedule lịch sử vẫn đọc được nhưng KHÔNG nạp vào Host task.
        // Một listener `session/created` ném lỗi sẽ cuốn ngược lượt attach, nên luồng legacy
        // không đọc được chỉ được CẢNH BÁO ở đây thay vì chặn việc tạo Session.
        let activeLegacy = 0;
        try {
          activeLegacy = foldScheduleEvents(session.ownEvents()).active.length;
        } catch (error) {
          if (!(error instanceof ScheduleLogError)) throw error;
          seam.logger.warn(
            `schedule: Session "${session.id}" historical events could not be read (${error.message}); the legacy reminder is ignored.`,
          );
          return;
        }
        if (activeLegacy > 0) {
          seam.logger.warn(
            `schedule: Session "${session.id}" contains legacy reminders; recreate active reminders with schedule_create.`,
          );
        }
      },
      { global: true },
    );
    // Host task sống LÂU HƠN Agent của Session, nên lượt thu nhận lưu trữ đọc các dòng ĐÃ LƯU thay vì
    // runtime đang sống: một Session idle còn nhắc hẹn armed thì bị từ chối lưu trữ, và một lượt
    // `session-stop` đang lưu trữ thì xoá các dòng ấy thay vì để chúng giao vào Session đã đóng.
    seam.effect(() => {
      const activity = seam.on("workspace/session-activity", async ({ sessionId }, next) => {
        const active = await this.list({ sessionId });
        const rest = await next();
        if (active.length === 0) return rest;
        const own: ScheduleActivity = {
          kind: "schedule",
          items: active.map((record) => ({ id: record.id, label: record.title })),
        };
        return [own, ...rest];
      });
      const stop = seam.on("workspace/session-stop", async ({ sessionId }) => {
        await this.stopSessionTasks(sessionId);
      });
      return () => {
        stop();
        activity();
      };
    }, "schedule.archiveAdmission()");
  }

  /**
   * Chờ effect khởi tạo xong trước khi plugin được coi là đã nạp.
   * Nhận: không.
   * Trả: promise hoàn tất khi miền lưu trữ mở xong và runtime đã dựng.
   */
  async [Service.init](): Promise<void> {
    await this.initialized;
  }

  /**
   * Tạo một nhắc hẹn gắn với Session do người gọi chọn mà KHÔNG đánh thức Session ấy.
   *
   * Yêu cầu PHẢI có title; title thiếu, rỗng sau khi cắt khoảng trắng, hoặc quá dài bị từ chối với
   * `invalid_prompt` thay vì suy ra từ prompt. Session do một con được uỷ quyền sở hữu bị từ chối với
   * `subagent_session`, vì giao nhận không bao giờ chạm tới nó: con ấy là bên có độ sâu uỷ quyền lớn hơn 0.
   * Bản ghi được dựng từ mốc đồng hồ đọc TRƯỚC khi yêu cầu vào hàng đợi tuần tự, nên một lượt tạo phải
   * chờ sau thao tác dài vẫn giữ mốc lúc yêu cầu và có thể đã tới hạn khi hàng đợi chạm tới nó.
   * Nhận: `sessionId` — Session gốc nhận nhắc hẹn; `request` — bộ chọn đã kiểm, title bắt buộc, nội dung;
   * `signal` — huỷ tuỳ chọn, kiểm trước khi bắt đầu ghi bền (kể cả sau khi chờ FIFO).
   * Trả: lịch đã ghi bền; huỷ KHÔNG cuốn ngược một lượt ghi đang chạy.
   */
  async create(sessionId: SessionId, request: ScheduleCreateRequest, signal?: AbortSignal): Promise<ScheduleRecord> {
    if (
      Number(request.at !== undefined) + Number(request.after_seconds !== undefined)
      + Number(request.every_seconds !== undefined) + Number(request.daily !== undefined)
      + Number(request.weekly !== undefined) + Number(request.cron !== undefined) > 1
    ) {
      throw new ScheduleInputError("invalid_selector", "Exactly one reminder selector is required.");
    }
    const title = scheduleTitle(request.title);
    const id = ScheduleId(`schedule-${randomUUID()}`);
    const now = Date.now();
    let record: ScheduleRecord;
    if (request.at !== undefined) {
      record = createAtScheduleRecord(id, request.prompt, request.at, now, title);
    } else if (request.after_seconds !== undefined) {
      record = createAfterScheduleRecord(id, request.prompt, request.after_seconds, now, title);
    } else if (request.every_seconds !== undefined) {
      record = createEveryScheduleRecord(id, request.prompt, request.every_seconds, now, title);
    } else if (request.daily !== undefined) {
      record = createDailyScheduleRecord(id, request.prompt, request.daily, now, title);
    } else if (request.weekly !== undefined) {
      record = createWeeklyScheduleRecord(id, request.prompt, request.weekly, now, title);
    } else if (request.cron !== undefined) {
      record = createCronScheduleRecord(id, request.prompt, request.cron, now, title);
    } else {
      throw new ScheduleInputError("invalid_selector", "Exactly one reminder selector is required.");
    }
    return this.serialize(async () => {
      const refusal = this.reminderTargetRefusal(sessionId);
      if (refusal !== undefined) throw new ScheduleInputError("subagent_session", refusal.message);
      const domain = await this.getDomain();
      signal?.throwIfAborted();
      await domain.table("tasks").put(id, {
        sessionId,
        record,
        status: "active",
        deliveryHistory: { records: [], earlierRecordsUnavailable: false },
      });
      this.emitChanged();
      this.runtime?.requestDrive();
      return record;
    });
  }

  /**
   * Đọc các task đang hoạt động của Session đã chọn mà không đánh thức Agent của nó.
   * Nhận: `request` — Session cần đọc danh sách task.
   * Trả: các nhắc hẹn đã lưu, theo thứ tự lưu trữ.
   */
  @Remote("list")
  async list(request: ScheduleListRequest): Promise<ScheduleRecord[]> {
    const domain = await this.getDomain();
    return [...domain.table("tasks").entries()]
      .filter(([, task]) => task.sessionId === request.sessionId && task.status === "active")
      .map(([, task]) => task.record);
  }

  /**
   * Đọc MỌI nhắc hẹn Host (đang hoạt động lẫn đã ngừng) kèm ràng buộc Session gốc.
   * Một nhắc hẹn đã xoá thì không còn dòng nên vắng ở đây. Không đánh thức Session, không đọc lịch sử Session.
   * Nhận: không.
   * Trả: các nhắc hẹn xếp theo `scheduledAt` tăng dần, rồi theo `id` từ điển học.
   */
  @Remote("catalog")
  async catalog(): Promise<ScheduleCatalogEntry[]> {
    const domain = await this.getDomain();
    return [...domain.table("tasks").entries()]
      .map(([, task]): ScheduleCatalogEntry => ({
        ...task.record,
        sessionId: task.sessionId,
        status: task.status,
        ...(task.lastDelivery === undefined ? {} : { lastDelivery: task.lastDelivery }),
      }))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
  }

  /**
   * Đọc các lượt giao nhận đã lưu vào inbox mà không đánh thức hay đọc Session gốc.
   * Chính dòng của task cấp ràng buộc của nó, nên các bản ghi vẫn đọc được qua phép tra này.
   * Nhận: `request` — ràng buộc Session, danh tính task, giới hạn tường minh, và con trỏ message loại trừ.
   * Trả: các lượt giao nhận mới-nhất-trước theo thứ tự nối, hoặc lỗi tra task/con trỏ.
   * Ném `ScheduleInputError` khi `limit` không phải số nguyên an toàn từ 1 tới 100.
   */
  @Remote("history")
  async history(request: ScheduleDeliveryHistoryRequest): Promise<ScheduleDeliveryHistoryResult> {
    if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100) {
      throw new ScheduleInputError("invalid_rule", "Delivery history limit must be a safe integer from 1 through 100.");
    }
    const task = (await this.getDomain()).table("tasks").get(request.id);
    if (task === undefined || task.sessionId !== request.sessionId) {
      return { id: request.id, code: "schedule_not_found" };
    }
    return deliveryHistoryPage(task, request, this.retention);
  }

  /**
   * Xoá một task thuộc Session đã chọn, để nguyên các message đang xếp hàng.
   *
   * Dòng bị gỡ: task không còn lên lịch, rời `list` lẫn `catalog`, và các bản ghi giao nhận đã lưu đi
   * theo nó. Một task gắn với Session do con được uỷ quyền sở hữu VẪN xoá được dù lượt tạo và lượt sửa
   * thời điểm từ chối ràng buộc ấy, nhờ vậy task lưu từ trước khi có luật đó vẫn gỡ được.
   * Nhận: `request` — Session và danh tính task chính xác; `signal` — huỷ tuỳ chọn kiểm trước khi ghi bền
   * (kể cả sau khi chờ FIFO).
   * Trả: Session ấy có sở hữu một task vừa bị xoá hay không; huỷ KHÔNG cuốn ngược lượt ghi đang chạy.
   */
  @Remote("delete")
  async delete(request: ScheduleDeleteRequest, signal?: AbortSignal): Promise<ScheduleDeleteResult> {
    return this.serialize(async (): Promise<ScheduleDeleteResult> => {
      const tasks = (await this.getDomain()).table("tasks");
      signal?.throwIfAborted();
      const current = tasks.get(request.id);
      if (current === undefined || current.sessionId !== request.sessionId) {
        return { id: request.id, deleted: false, code: "schedule_not_found" };
      }
      await tasks.delete(request.id);
      this.emitChanged();
      this.runtime?.requestDrive();
      return { id: request.id, deleted: true };
    });
  }

  /**
   * Sửa tên, chỉ dẫn và thời điểm của một task đang hoạt động trong ĐÚNG ràng buộc Session gốc mà không
   * đánh thức Session hay đổi các lượt giao nhận đã lưu.
   *
   * Mỗi trường được cấp thay giá trị đã lưu; trường bỏ trống thì giữ nguyên. Chỉ đổi tên hoặc chỉ dẫn
   * KHÔNG đặt lại mốc đích đã cam kết. Session do con được uỷ quyền sở hữu trả kết quả KHÔNG-đột-biến
   * `subagent_session`, nên một lượt sửa không thể arm lại task gắn với Session mà giao nhận không bao
   * giờ chạm tới, và trình sửa trên Web giải thích được từ chối ấy qua chính kết quả nó đã hiển thị.
   * Nhận: `request` — ràng buộc task, bản ghi quan sát ĐẦY ĐỦ, và tổ hợp bất kỳ của thời điểm/tên/chỉ dẫn;
   * `signal` — huỷ, kiểm sau khi miền sẵn sàng và sau khi chờ FIFO, trước khi bắt đầu ghi bền.
   * Trả: bản ghi đã cam kết, bản ghi không đổi với lượt no-op, hoặc kết quả không-đột-biến
   * input/lookup/conflict/refusal. Lỗi lưu trữ và lỗi vòng đời thì reject; huỷ sau khi lượt ghi bắt đầu
   * KHÔNG cuốn ngược nó.
   */
  @Remote("update")
  async update(request: ScheduleUpdateRequest, signal?: AbortSignal): Promise<ScheduleUpdateResult> {
    return this.serialize(async (): Promise<ScheduleUpdateResult> => {
      const refusal = this.reminderTargetRefusal(request.sessionId);
      if (refusal !== undefined) return refusal;
      const tasks = (await this.getDomain()).table("tasks");
      signal?.throwIfAborted();
      const current = tasks.get(request.id);
      if (current === undefined || current.sessionId !== request.sessionId) {
        return { id: request.id, updated: false, code: "schedule_not_found" };
      }
      if (current.status === "inactive") {
        return { id: request.id, updated: false, code: "schedule_ended" };
      }
      const result = resolveScheduleUpdate(current.record, request.expected, request.change, Date.now(), request);
      if (!("record" in result) || !result.updated) return result;
      await tasks.put(request.id, { ...current, record: result.record });
      this.emitChanged();
      this.runtime?.requestDrive();
      return result;
    });
  }

  /**
   * Phát ĐÚNG MỘT thông báo `schedule/changed` sau khi cam kết, bao trọn lỗi listener ĐỒNG BỘ: mọi chỗ
   * gọi chỉ phát sau khi lượt ghi bền của nó đã đáp, nên một listener ném lỗi không được phép reject
   * người gọi hay bỏ qua `requestDrive()` theo sau.
   * Nhận: không.
   * Trả: không; lỗi đồng bộ của observer chỉ được ghi cảnh báo.
   */
  private emitChanged(): void {
    const seam = seamOf(this.ctx);
    try {
      seam.emit("schedule/changed");
    } catch (error) {
      // Chỉ nuốt ngoại lệ observer ĐỒNG BỘ: emit phát listener ngay tại chỗ và không có gì khác chạy
      // trong try. Sự kiện này là thông báo, không phải thành viên giao dịch.
      seam.logger.warn(`schedule: schedule/changed listener failed: ${String(error)}`);
    }
  }

  /**
   * Chờ lượt khởi tạo rồi trả miền lưu trữ đã mở.
   * Nhận: không.
   * Trả: miền `tasks` sẵn sàng dùng.
   */
  private async getDomain(): Promise<ScheduleDomainSeam> {
    await this.initialized;
    return this.ready;
  }

  /**
   * Từ chối một Session mà không lượt giao nhận nào chạm tới vì con được uỷ quyền sở hữu nó.
   *
   * Giao nhận phân giải Session ràng buộc qua `ctx.sessionController.resolveAgent`, phép này từ chối
   * Agent sống của một con được uỷ quyền; một task đã lưu cho Session như thế sẽ quá hạn vĩnh viễn và
   * thử lại mỗi lượt lái. Cả hai thao tác có thể arm một lượt giao nhận đều đọc CÙNG một sự thật ở đây
   * thay vì nói lại nó: con được uỷ quyền là bên có {@link delegationDepthOf} lớn hơn 0 — đúng phép đếm
   * mà chính trần uỷ quyền áp dụng, và nó sống sót qua lượt resume lạnh nhờ header đã lưu.
   * Nhận: `sessionId` — Session mà task sẽ ràng buộc.
   * Trả: từ chối ổn định cho Session của con được uỷ quyền, hoặc `undefined` khi Session đủ điều kiện.
   */
  private reminderTargetRefusal(sessionId: SessionId): SubagentSessionError | undefined {
    const agent = seamOf(this.ctx).agents.get(sessionId);
    if (agent === undefined || delegationDepthOf(agent) === 0) return undefined;
    return {
      code: "subagent_session",
      message: "This Session belongs to subagent routing, which never receives reminder delivery.",
    };
  }

  /**
   * Gỡ MỌI task đang hoạt động đã lưu cho một Session, BÊN TRONG hàng đợi mà các tool dùng.
   *
   * Liệt kê và xoá trong CÙNG một khe hàng đợi là thứ khiến một lượt stop lúc lưu trữ nằm sau lượt tạo
   * đang ghi dở: một lượt stop đọc bảng NGOÀI hàng đợi có thể bỏ sót dòng mà lượt tạo sắp cam kết và để
   * lại một nhắc hẹn armed. Gọi lại `delete()` công khai từ đây sẽ deadlock trên chính hàng đợi này,
   * nên các dòng được gỡ trực tiếp.
   * Nhận: `sessionId` — Session mà mọi task Host đang hoạt động phải dừng.
   * Trả: promise hoàn tất khi mọi dòng đã gỡ (hoặc lượt ghi đầu tiên lỗi được ném lại sau khi thử hết).
   */
  private async stopSessionTasks(sessionId: SessionId): Promise<void> {
    await this.serialize(async () => {
      const tasks = (await this.getDomain()).table("tasks");
      const active = [...tasks.entries()]
        .filter(([, task]) => task.sessionId === sessionId && task.status === "active")
        .map(([, task]) => task.record.id);
      if (active.length === 0) return;
      // Mỗi dòng một lượt ghi: bảng của miền không có xoá theo lô, và mỗi dòng bền độc lập, nên một lỗi
      // giữa đường để lại các dòng đã gỡ xong vẫn cam kết. Observer nghe về thay đổi ấy TRƯỚC khi lỗi
      // tới người gọi, và người gọi vẫn nhận lỗi.
      let removed = false;
      let failure: Error | undefined;
      for (const id of active) {
        try {
          await tasks.delete(id);
          removed = true;
        } catch (error) {
          // Mọi dòng đều được THỬ: lượt lưu trữ đã đáp, nên một dòng bị bỏ qua ở đây sẽ nằm armed trong
          // một Session mà runtime sau đó từ chối các bước model. Lý do reject không mang Error vẫn phải
          // báo lỗi, nên nó được bọc trước khi giữ lỗi ĐẦU TIÊN.
          failure ??= error instanceof Error ? error : new Error(`schedule stop failed: ${String(error)}`);
        }
      }
      if (removed) {
        this.emitChanged();
        this.runtime?.requestDrive();
      }
      if (failure !== undefined) throw failure;
    });
  }

  /**
   * Xếp một lượt ghi vào chuỗi FIFO của dịch vụ.
   * Nhận: `work` — lượt ghi cần chạy sau mọi lượt trước đó.
   * Trả: promise của chính lượt ghi; dịch vụ đang dừng thì reject ngay.
   */
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    if (this.stopping) return Promise.reject(new Error("Schedule service is stopping"));
    const pending = this.chain.then(work);
    this.chain = pending.catch(() => undefined); // Giữ FIFO chạy tiếp sau khi người gọi đã nhận lỗi.
    return pending;
  }
}
