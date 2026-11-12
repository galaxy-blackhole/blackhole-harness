/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Nửa client của row ui-cordis: cài bốn thẻ tool view + bảng Cordis, đăng ký từ điển, đọc inventory và nối sự kiện Remote — port 1:1 vùng #region index.js
 */

import type {
  ApprovalRequestId,
  CordisActionResult,
  CordisDynamicPluginId,
  CordisRunActivity,
  CordisRunFailure,
  CordisUserRunRequest,
  DynamicCordisInventoryRow,
  DynamicCordisLivePackage,
  DynamicCordisRenderFailure,
  DynamicCordisRunRequest,
  HostObservable,
  SessionId,
} from "./events.ts";
import { createCordisActionRow } from "./action-row.ts";
import { createCordisDefineRow } from "./define-row.ts";
import {
  createCordisInventory,
  type CordisDynamicPort,
  type CordisInventory,
  type CordisInventorySnapshot,
} from "./inventory.ts";
import { DICTIONARY_EFFECT_LABEL, INJECT, INVENTORY_ERROR_LABEL, RECONCILE_EFFECT_LABEL } from "./ids.ts";
import { en, NS, zh } from "./locales.ts";
import { createCordisPanel } from "./panel.ts";
import { CordisRunCardRegistry } from "./run-card-index.ts";
import { createCordisRunRow } from "./run-row.ts";
import { createRuntime, type RequireFn } from "./runtime.ts";
import { injectStyles } from "./styles/inject.ts";

/** Trả lời RPC của api-remotes: hoặc giá trị, hoặc lỗi có mã. */
export type RemoteAnswer<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** Kết quả thao tác dừng bên Host (có thể `not-running`). */
export interface RunnerStopOutcome {
  /** Thao tác thành công. */
  readonly ok: boolean;
  /** Lý do khi không thành công (`not-running` được coi là thành công). */
  readonly reason?: string | undefined;
  /** Câu lỗi khi thất bại. */
  readonly message: string;
}

/** Kết quả thao tác xoá bên Host. */
export interface RunnerRemoveOutcome {
  /** Thao tác thành công. */
  readonly ok: boolean;
  /** Câu lỗi khi thất bại. */
  readonly message: string;
}

/** Seam Remote của runner động — ba lời gọi bảng dùng. */
export interface DynamicCordisRunnerRemote {
  /**
   * Dừng một Plugin từ bảng.
   * Nhận: sessionId — phiên sở hữu; pluginId — Plugin cần dừng.
   * Trả: lời đáp có mã lỗi chuẩn.
   */
  stopFromPanel(sessionId: SessionId, pluginId: CordisDynamicPluginId): Promise<RemoteAnswer<RunnerStopOutcome>>;
  /**
   * Xoá một Plugin từ bảng.
   * Nhận: sessionId — phiên sở hữu; pluginId — Plugin cần xoá.
   * Trả: lời đáp có mã lỗi chuẩn.
   */
  undefineFromPanel(sessionId: SessionId, pluginId: CordisDynamicPluginId): Promise<RemoteAnswer<RunnerRemoveOutcome>>;
  /**
   * Đọc inventory.
   * Nhận: không.
   * Trả: lời đáp chứa các dòng Plugin.
   */
  inventory(): Promise<RemoteAnswer<readonly DynamicCordisInventoryRow[]>>;
}

/** Seam `remote` của context phía browser (chỉ phần row này dùng). */
export interface CordisRemoteSeam {
  /**
   * Nghe một sự kiện Remote.
   * Nhận: tên sự kiện; hàm nhận payload.
   * Trả: không.
   */
  $on(event: string, listener: (payload: DynamicCordisRunRequest) => void): void;
  /** Runner Plugin động phía Host. */
  dynamicCordisRunner: DynamicCordisRunnerRemote;
}

/** Dịch vụ runner động phía client (thứ row này inject). */
export interface CordisRunner {
  /**
   * Đọc tập gói client đã nạp trong trang.
   * Nhận: không.
   * Trả: các gói đã nạp.
   */
  getSnapshot(): readonly DynamicCordisLivePackage[];
  /**
   * Nghe thay đổi của tập gói đã nạp.
   * Nhận: hàm được gọi mỗi lần đổi.
   * Trả: hàm gỡ đăng ký.
   */
  subscribe(listener: () => void): () => void;
  /**
   * Đối chiếu lại các yêu cầu phê duyệt đang chờ với inventory vừa đọc.
   * Nhận: rows — các dòng inventory.
   * Trả: không.
   */
  reconcileApprovals(rows: readonly DynamicCordisInventoryRow[]): void;
  /**
   * Phê duyệt một yêu cầu.
   * Nhận: requestId — yêu cầu cần duyệt; approveFutureVersions — duyệt cho mọi phiên bản sau.
   * Trả: promise hoàn tất khi Host nhận.
   */
  approve(requestId: ApprovalRequestId, approveFutureVersions: boolean): Promise<void>;
  /**
   * Từ chối một yêu cầu.
   * Nhận: requestId — yêu cầu cần từ chối.
   * Trả: promise hoàn tất khi Host nhận.
   */
  decline(requestId: ApprovalRequestId): Promise<void>;
  /**
   * Chạy một Package theo yêu cầu người dùng.
   * Nhận: request — yêu cầu chạy.
   * Trả: kết quả thao tác (có thể rỗng).
   */
  startUserRun(request: CordisUserRunRequest): Promise<CordisActionResult | undefined>;
  /** Hoạt động chạy theo Plugin. */
  readonly activeRuns: HostObservable<ReadonlyMap<CordisDynamicPluginId, CordisRunActivity>>;
  /** Lỗi chạy gần nhất theo Plugin. */
  readonly lastRunError: HostObservable<ReadonlyMap<CordisDynamicPluginId, CordisRunFailure>>;
  /** Lỗi render slot theo Plugin. */
  readonly renderFailures: HostObservable<ReadonlyMap<CordisDynamicPluginId, DynamicCordisRenderFailure>>;
}

/** Seam `locale` của context phía browser (chỉ phần row này dùng). */
export interface CordisLocaleSeam {
  /**
   * Đăng ký từ điển cho một namespace.
   * Nhận: namespace — tên namespace; copy — bảng dịch theo ngôn ngữ.
   * Trả: hàm gỡ đăng ký.
   */
  register(namespace: string, copy: Readonly<Record<string, Readonly<Record<string, string>>>>): () => void;
}

/** Seam `slots` của context phía browser (chỉ phần row này dùng). */
export interface CordisSlotsSeam {
  /**
   * Đăng ký vào một slot ngay khi slot đó sống.
   * Nhận: slot — tên slot; register — hàm đăng ký occupant.
   * Trả: không.
   */
  inject(slot: string, register: () => unknown): void;
  /**
   * Chiếm một chỗ trong slot.
   * Nhận: spec — mô tả occupant; component — component được render.
   * Trả: giá trị do tầng slot trả về.
   */
  register(spec: Readonly<Record<string, unknown>>, component: unknown): unknown;
}

/** Context plugin phía browser mà row này cần (đúng phần bản gốc dùng). */
export interface CordisClientContext {
  /**
   * Gắn một hiệu ứng vào vòng đời plugin.
   * Nhận: callback — hàm hiệu ứng (trả hàm dọn dẹp nếu cần); label — nhãn chẩn đoán.
   * Trả: không.
   */
  effect(callback: () => void | (() => void), label: string): void;
  /**
   * Nghe một sự kiện của context.
   * Nhận: event — tên sự kiện; listener — hàm xử lý.
   * Trả: không.
   */
  on(event: string, listener: () => void): void;
  /** Seam từ điển. */
  readonly locale: CordisLocaleSeam;
  /** Seam Remote. */
  readonly remote: CordisRemoteSeam;
  /** Seam slot. */
  readonly slots: CordisSlotsSeam;
  /** Runner Plugin động phía client. */
  readonly dynamicCordisRunner: CordisRunner;
}

/** Bề mặt plugin mà Loader phía browser nhận (tương đương hai export `apply`/`inject` của bản gốc). */
export interface CordisPlugin {
  /**
   * Cài toàn bộ bề mặt UI Cordis lên context.
   * Nhận: ctx — context plugin phía browser.
   * Trả: không.
   */
  apply(ctx: CordisClientContext): void;
  /** Danh sách seam cần cho Loader (5 mục, đúng thứ tự bản gốc). */
  inject: string[];
}

/**
 * Dựng bề mặt plugin của row từ bảng module của tầng nạp.
 * Nhận: requireFn — hàm require do bảng module cấp (react, react/jsx-runtime, ui-primitives).
 * Trả: bề mặt plugin `{ apply, inject }` để factory trả cho Loader.
 */
export function createPlugin(requireFn: RequireFn): CordisPlugin {
  const runtime = createRuntime(requireFn);
  injectStyles();
  const CordisDefineRow = createCordisDefineRow(runtime);
  const CordisRunRow = createCordisRunRow(runtime);
  const CordisActionRow = createCordisActionRow(runtime);
  const CordisPanel = createCordisPanel(runtime);

  /**
   * Cài mọi bề mặt Cordis phía browser trên inventory dùng chung của Host.
   * Nhận: ctx — context plugin phía browser.
   * Trả: không.
   */
  function apply(ctx: CordisClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), DICTIONARY_EFFECT_LABEL);
    const port: CordisDynamicPort = {
      stop: async (sessionId, pluginId) => {
        const answered = await ctx.remote.dynamicCordisRunner.stopFromPanel(sessionId, pluginId);
        if (!answered.ok) {
          return {
            ok: false,
            message: `${answered.error.code}: ${answered.error.message}`,
          };
        }
        if (answered.value.ok || answered.value.reason === "not-running") return { ok: true };
        return {
          ok: false,
          message: answered.value.message,
        };
      },
      remove: async (sessionId, pluginId) => {
        const answered = await ctx.remote.dynamicCordisRunner.undefineFromPanel(sessionId, pluginId);
        if (!answered.ok) {
          return {
            ok: false,
            message: `${answered.error.code}: ${answered.error.message}`,
          };
        }
        return answered.value.ok
          ? { ok: true }
          : {
              ok: false,
              message: answered.value.message,
            };
      },
      inventory: async () => {
        const answered = await ctx.remote.dynamicCordisRunner.inventory();
        if (!answered.ok) throw new Error(`${answered.error.code}: ${answered.error.message}`);
        return answered.value;
      },
    };
    const inventory: CordisInventory = createCordisInventory(port, (error) => {
      console.error(INVENTORY_ERROR_LABEL, error);
    });
    const runner = ctx.dynamicCordisRunner;
    const loaded: HostObservable<readonly DynamicCordisLivePackage[]> = {
      getSnapshot: () => runner.getSnapshot(),
      subscribe: (fn) => runner.subscribe(fn),
    };
    const runCards = new CordisRunCardRegistry();
    ctx.effect(
      () =>
        inventory.subscribe(() => {
          const snapshot: CordisInventorySnapshot = inventory.getSnapshot();
          if (snapshot.read) runner.reconcileApprovals(snapshot.rows);
        }),
      RECONCILE_EFFECT_LABEL,
    );
    ctx.remote.$on("cordis/dynamic-package", () => {
      inventory.refresh();
    });
    ctx.remote.$on("cordis/dynamic-retract", () => {
      inventory.refresh();
    });
    ctx.remote.$on("cordis/request-run", (request) => {
      if (!inventory.getSnapshot().rows.some((row) => row.pluginId === request.pluginId)) inventory.refresh();
    });
    ctx.remote.$on("cordis/request-run-resolved", () => {
      inventory.refresh();
    });
    ctx.on("connection/reset", () => {
      inventory.reset();
      inventory.refresh();
    });
    ctx.slots.inject("sidebar.footer.action", () =>
      ctx.slots.register(
        {
          name: "sidebar.footer.action",
          id: "cordis-panel",
          locale: NS,
          inject: () => ({
            hooks: {
              inventory,
              activeRuns: runner.activeRuns,
              runErrors: runner.lastRunError,
              loaded,
              renderFailures: runner.renderFailures,
            },
            onApprove: (requestId: ApprovalRequestId, approveFutureVersions: boolean) =>
              runner.approve(requestId, approveFutureVersions),
            onDecline: (requestId: ApprovalRequestId) => runner.decline(requestId),
            onRun: (request: CordisUserRunRequest) => runner.startUserRun(request),
            onStop: async (sessionId: SessionId, pluginId: CordisDynamicPluginId) => {
              const result = await port.stop(sessionId, pluginId);
              inventory.refresh();
              return result;
            },
            onRemove: async (sessionId: SessionId, pluginId: CordisDynamicPluginId) => {
              const result = await port.remove(sessionId, pluginId);
              if (result.ok) inventory.retire(pluginId);
              inventory.refresh();
              return result;
            },
            onRefresh: () => {
              inventory.refresh();
            },
          }),
        },
        CordisPanel,
      ),
    );
    const cardFace = () => ({ hooks: { inventory, loaded } });
    ctx.slots.inject("tool.call.toolview", () =>
      ctx.slots.register(
        {
          name: "tool.call.toolview",
          key: "cordis_define",
          locale: NS,
          inject: cardFace,
        },
        CordisDefineRow,
      ),
    );
    ctx.slots.inject("tool.call.toolview", () =>
      ctx.slots.register(
        {
          name: "tool.call.toolview",
          key: "cordis_run",
          locale: NS,
          children: {
            "tool.view.cordis": {
              kind: "keyed",
              scope: "session",
            },
          },
          inject: (sessionId: SessionId) => {
            const store = runCards.forSession(sessionId);
            return {
              hooks: {
                inventory,
                loaded,
                runCards: store,
                activeRuns: runner.activeRuns,
              },
              onObserveRunCard: (pointer: Parameters<typeof store.observe>[0]) => {
                store.observe(pointer);
              },
            };
          },
        },
        CordisRunRow,
      ),
    );
    ctx.slots.inject("tool.call.toolview", function* () {
      yield ctx.slots.register(
        {
          name: "tool.call.toolview",
          key: "cordis_stop",
          locale: NS,
        },
        CordisActionRow,
      );
      yield ctx.slots.register(
        {
          name: "tool.call.toolview",
          key: "cordis_undefine",
          locale: NS,
        },
        CordisActionRow,
      );
    });
    inventory.refresh();
  }

  return { apply, inject: INJECT };
}
