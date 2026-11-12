/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 'lib/types/index.js' (1.152 dòng) của @deepseek-ai/dsh-cordis-host-runner: service
 *      'dynamicCordisRunner' (class DynamicCordisRunnerService, extends TypertRemoteService) — sổ đăng ký
 *      Package bất biến, một run sống mỗi Plugin, kích hoạt nửa Client cần người duyệt, và invoke Host/Client.
 *      Phép toán miền tách sang ./service-support.ts để giữ mỗi tệp ≤1000 dòng (mọi tên phương thức giữ nguyên).
 */

import type { Context, Fiber } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";
import z from "@deepseek-ai/schemastery";

import { CordisInspectRegistryService } from "./inspect-registry.ts";
import { DynamicCordisRegistry } from "./registry.ts";
import type {
  DynamicCordisDefineReceipt, DynamicCordisDefineRequest, DynamicCordisDefinition, DynamicCordisPackageInspection,
  DynamicCordisPendingRequest, DynamicCordisPlugin, DynamicCordisPluginInspection, DynamicCordisReference,
  DynamicCordisRun,
} from "./registry.ts";
import { precheckCode } from "./sandbox.ts";
import {
  announceResolvedOn, brandApprovalRequestId, brandCordisDynamicPackageId, brandCordisDynamicPluginId,
  cancelPendingRequest, claimRuntimeFailureOf, cloneAttempt, commitActivationOf, diagnosticOf, emitRunnerEvent,
  errorDetails, failAttemptOf, guardFailureText, hostHandlerFailureText, injectAgent, missingPluginMessage, newAttempt,
  ownedPlugin, renderFailureText, resolveRunPlan, retractRun, runnerMessage, runOutcomeText, runResponseOf,
  settleActivationIn, startFreshIn, startHostIn, steerAgent, userRunOutcomeText,
} from "./service-support.ts";
import type { HostHalfStarted, PlannedRun, ResolvedRunnerConfig, RunPlan } from "./service-support.ts";
import type {
  ApprovalRequestId, CordisDynamicPackageId, CordisDynamicPluginId, CordisDynamicPluginRunId, CordisDynamicRunMode,
  CordisErrorDetails, CordisInspectProviderManifest, CordisInspectQueryResolution, CordisInspectRequestId,
  CordisInspectResolveAck, CordisRunDiagnostic, DynamicCordisClientSource, DynamicCordisHostHalfResult,
  DynamicCordisInventoryRow, DynamicCordisInvokeResult, DynamicCordisRenderFailure, DynamicCordisResolveAck,
  DynamicCordisRunAttempt, DynamicCordisRunResolution, DynamicCordisRunResponse, DynamicCordisStopResponse,
  DynamicCordisUndefineReceipt, RequestRunOutcome,
} from "./types.ts";

export { CordisInspectRegistryService };
export {
  brandApprovalRequestId as ApprovalRequestId,
  brandCordisDynamicPackageId as CordisDynamicPackageId,
  brandCordisDynamicPluginId as CordisDynamicPluginId,
  brandCordisDynamicPluginRunId as CordisDynamicPluginRunId,
} from "./service-support.ts";

/** Cấu hình runner. */
export interface Config {
  /** Thời gian chạy đồng bộ tối đa của VM, mili giây. */
  vmTimeoutMs?: number;
  /** Thời gian chờ tối đa một phản hồi inspect hợp lệ từ Client, mili giây. */
  clientInspectTimeoutMs?: number;
}

/** Ảnh chụp chỉ-Host mà inspect và render kết quả tool tiêu thụ. */
export interface DynamicCordisSnapshotRow {
  pluginId: CordisDynamicPluginId;
  currentPackageId?: CordisDynamicPackageId;
  nextPackageId?: CordisDynamicPackageId;
  packages: Array<{
    packageId: CordisDynamicPackageId;
    name: string;
    purpose: string;
    hasHostHalf: boolean;
    hasClientHalf: boolean;
  }>;
  activeRun?: {
    pluginRunId: CordisDynamicPluginRunId;
    packageId: CordisDynamicPackageId;
    fiber?: Fiber;
    handlers: string[];
    renderFailure?: DynamicCordisRenderFailure;
  };
  latestRun?: DynamicCordisRunAttempt;
}

/** Sổ đăng ký Plugin động và vòng đời nửa Host. */
export class DynamicCordisRunnerService extends TypertRemoteService {
  /** Seam bắt buộc: sổ tool của kernel (Host half đăng ký tool qua nó). */
  static inject = ["tools"];

  /** Schema cấu hình — nguyên văn bản gốc (default, step, min/max). */
  static Config = z.object({
    vmTimeoutMs: z.number().min(1).default(5000),
    clientInspectTimeoutMs: z.number().step(1).min(1).max(2_147_483_647).default(10_000),
  });

  private readonly rootCtx: Context;
  private readonly registry = new DynamicCordisRegistry();
  private readonly inspectRegistry: CordisInspectRegistryService;
  private readonly starting = new Map<CordisDynamicPluginId, Promise<DynamicCordisHostHalfResult>>();
  private readonly resolved: ResolvedRunnerConfig;
  private group: Fiber | undefined;

  /**
   * Dựng service dưới composition của Host.
   * Nhận: `ctx` — Context sở hữu; `config` — cấu hình row đã kiểm bởi `static Config`.
   * Trả: thể hiện service `dynamicCordisRunner` đã đăng ký (cordis dùng ngay sau khi dựng).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "dynamicCordisRunner");
    this.rootCtx = ctx;
    this.resolved = config as ResolvedRunnerConfig;
    this.inspectRegistry = new CordisInspectRegistryService(ctx, this.resolved.clientInspectTimeoutMs);
  }

  /**
   * Định nghĩa Package ĐẦU của một Plugin mới hoặc nối thêm Package vào Plugin đã có.
   * Nhận: `request` — quyền sở hữu phiên, lựa chọn Plugin, metadata và mã nguồn.
   * Trả: danh tính Plugin/Package do Host cấp kèm cờ khai báo từng nửa.
   * @throws khi `name`/`purpose` rỗng, thiếu cả hai nửa mã, `idPrefix` sai dạng, Plugin không thuộc phiên, hoặc mã không parse được.
   */
  define(request: DynamicCordisDefineRequest): DynamicCordisDefineReceipt {
    const name = request.name.trim();
    const purpose = request.purpose.trim();
    if (name.length === 0)
      throw new Error("cordis_define needs a non-empty `name`");
    if (purpose.length === 0)
      throw new Error("cordis_define needs a non-empty `purpose`");
    if (request.code.host === undefined && request.code.client === undefined) {
      throw new Error("cordis_define needs `code.host`, `code.client`, or both");
    }
    if (request.code.host !== undefined)
      precheckCode(request.code.host, "code.host");
    if (request.code.client !== undefined)
      precheckCode(request.code.client, "code.client");
    let plugin: DynamicCordisPlugin;
    if (request.plugin.kind === "new") {
      const prefix = request.plugin.idPrefix.trim();
      if (!/^[a-z]{3,6}$/.test(prefix)) {
        throw new Error("cordis_define `plugin.idPrefix` must contain 3–6 lowercase English letters");
      }
      const pluginId = brandCordisDynamicPluginId(this.registry.mintPluginId(prefix));
      plugin = {
        pluginId,
        sessionId: request.sessionId,
        packages: new Map(),
        approvedClientPackages: new Set(),
        clientVersionUpdatesApproved: false,
      };
      this.registry.add(plugin);
    } else {
      const found = this.registry.get(request.plugin.pluginId);
      if (found === undefined || found.sessionId !== request.sessionId) {
        throw new Error(missingPluginMessage(request.plugin.pluginId));
      }
      plugin = found;
    }
    const packageId = brandCordisDynamicPackageId(this.registry.mintPackageId());
    const definition: DynamicCordisDefinition = {
      packageId,
      name,
      purpose,
      ...request.code.host === undefined ? {} : { hostCode: request.code.host },
      ...request.code.client === undefined ? {} : { clientCode: request.code.client },
    };
    plugin.packages.set(packageId, definition);
    return {
      pluginId: plugin.pluginId,
      packageId,
      name,
      purpose,
      hasHostHalf: definition.hostCode !== undefined,
      hasClientHalf: definition.clientCode !== undefined,
    };
  }

  /**
   * Gỡ một Plugin, run đang sống và mọi Package bất biến của nó.
   * Nhận: `agent` — Agent mà Session phải sở hữu Plugin; `pluginId` — Plugin cần gỡ.
   * Trả: gỡ thành công (kèm cờ run đang chạy) hoặc từ chối `plugin-missing`.
   */
  async undefine(agent: Agent, pluginId: CordisDynamicPluginId): Promise<DynamicCordisUndefineReceipt> {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      return { ok: false, reason: "plugin-missing", message: missingPluginMessage(pluginId) };
    const wasRunning = plugin.run !== undefined;
    this.cancelPending(pluginId, `dynamic plugin "${pluginId}" was removed before approval`);
    if (plugin.run !== undefined)
      await this.retract(plugin);
    this.registry.delete(pluginId);
    return { ok: true, wasRunning };
  }

  /**
   * Gỡ một Plugin từ panel người dùng và xếp thay đổi trạng thái cho bước kế của model.
   * Nhận: `agent` — Agent sở hữu Plugin và nhận ngữ cảnh; `pluginId` — Plugin cần gỡ.
   * Trả: gỡ thành công (kèm cờ run đang chạy) hoặc từ chối `plugin-missing`.
   */
  @Remote("undefineFromPanel")
  async undefineFromPanel(agent: Agent, pluginId: CordisDynamicPluginId): Promise<DynamicCordisUndefineReceipt> {
    const result = await this.undefine(agent, pluginId);
    if (result.ok) {
      this.injectUserContext(agent, `The user removed Cordis Plugin ${pluginId} and all of its Packages. The Plugin no longer exists.`);
    }
    return result;
  }

  /**
   * Chạy hoặc cập nhật MỘT Package cho lời gọi tool của model.
   * Nhận: `agent`, `pluginId`, `packageId`, `mode` — ý định chạy/cập nhật, `signal` — tín hiệu huỷ lời gọi tool.
   * Trả: danh tính kích hoạt thành công, hoặc từ chối kèm hành động gợi ý.
   */
  async run(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    packageId: CordisDynamicPackageId,
    mode: CordisDynamicRunMode,
    signal?: AbortSignal,
  ): Promise<DynamicCordisRunResponse> {
    const plan = this.resolvePlan(agent, pluginId, packageId, mode);
    if (!plan.ok)
      return plan.response;
    if (signal?.aborted === true) {
      return {
        ok: false,
        reason: "cancelled",
        message: `the run request for dynamic plugin "${pluginId}" was cancelled before activation`,
      };
    }
    if (this.registry.pendingRequestFor(pluginId) !== undefined) {
      return { ok: false, reason: "transition-in-flight", message: `dynamic plugin "${pluginId}" already has a pending run request` };
    }
    const attempt = this.createAttempt(plan);
    plan.plugin.nextPackageId = packageId;
    plan.plugin.latestRun = attempt;
    if (plan.definition.clientCode === undefined) {
      const started = await this.activate(plan, undefined, false, attempt);
      if (started.ok)
        return this.runResponse(plan.plugin, started);
      this.failAttempt(plan.plugin, attempt, "host-load", started);
      return { ...started, reason: "host-half-failed" };
    }
    const requestId = brandApprovalRequestId(this.registry.mintApprovalRequestId());
    const requiresApproval = !plan.plugin.clientVersionUpdatesApproved
      && !plan.plugin.approvedClientPackages.has(packageId);
    attempt.approvalRequestId = requestId;
    attempt.requiresApproval = requiresApproval;
    attempt.status = requiresApproval ? "awaiting-approval" : "starting-host";
    this.registry.armRequest(requestId, {
      agentId: agent.id,
      pluginId,
      packageId,
      pluginRunId: attempt.pluginRunId,
      mode,
      requiresApproval,
    });
    emitRunnerEvent(this.ctx, "cordis/request-run", {
      requestId,
      agentId: agent.id,
      pluginId,
      packageId,
      mode,
      name: plan.definition.name,
      purpose: plan.definition.purpose,
      requiresApproval,
    });
    return {
      ok: true,
      status: requiresApproval ? "awaiting-approval" : "starting",
      pluginId,
      packageId,
      pluginRunId: attempt.pluginRunId,
      mode,
      waitingFor: [],
      ...plan.plugin.currentPackageId === undefined ? {} : { currentPackageId: plan.plugin.currentPackageId },
      nextPackageId: packageId,
    };
  }

  /**
   * Khởi động mã Host cho một yêu cầu đã duyệt hoặc một thao tác trực tiếp từ panel.
   * Nhận: `agent`, `pluginId`, `packageId`, `mode`; `requestId` — yêu cầu model-driven hoặc `null` cho người dùng;
   *        `approveFutureVersions` — duyệt có áp cho các Package sau cùng Plugin hay không.
   * Trả: kích hoạt Host chính xác hoặc thông điệp thất bại.
   */
  @Remote("runHostHalf")
  async runHostHalf(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    packageId: CordisDynamicPackageId,
    mode: CordisDynamicRunMode,
    requestId: ApprovalRequestId | null,
    approveFutureVersions: boolean,
  ): Promise<DynamicCordisHostHalfResult> {
    const plan = this.resolvePlan(agent, pluginId, packageId, mode, requestId === null);
    if (!plan.ok)
      return { ok: false, message: plan.response.message };
    let attempt: DynamicCordisRunAttempt;
    if (requestId !== null) {
      const pending = this.registry.peekRequest(requestId);
      if (pending === undefined || pending.pluginId !== pluginId || pending.packageId !== packageId || pending.mode !== mode) {
        return { ok: false, message: `run request "${requestId}" does not authorize ${pluginId}/${packageId}` };
      }
      const latest = plan.plugin.latestRun;
      const expectedStatus = pending.requiresApproval ? "awaiting-approval" : "starting-host";
      if (latest === undefined || latest.pluginRunId !== pending.pluginRunId
        || (latest.status !== expectedStatus && (!pending.requiresApproval && latest.status !== "client-pending"))) {
        return { ok: false, message: `run request "${requestId}" no longer identifies the latest run of ${pluginId}` };
      }
      attempt = latest;
      if (pending.requiresApproval) {
        plan.plugin.approvedClientPackages.add(packageId);
        if (approveFutureVersions)
          plan.plugin.clientVersionUpdatesApproved = true;
      }
    } else {
      const pending = this.registry.pendingRequestFor(pluginId);
      if (pending !== undefined)
        return { ok: false, message: `dynamic plugin "${pluginId}" has pending run request ${pending}` };
      const attached = plan.plugin.run?.packageId === packageId
        && plan.plugin.latestRun?.pluginRunId === plan.plugin.run.pluginRunId
        ? plan.plugin.latestRun
        : undefined;
      attempt = attached ?? this.createAttempt(plan);
      if (attached === undefined) {
        plan.plugin.nextPackageId = packageId;
        plan.plugin.latestRun = attempt;
      }
      if (plan.definition.clientCode !== undefined)
        plan.plugin.approvedClientPackages.add(packageId);
    }
    const attaching = attempt.pluginRunId === plan.plugin.run?.pluginRunId;
    if (!attaching) {
      attempt.status = "starting-host";
      if (attempt.host.status !== "absent")
        attempt.host = { status: "pending", waitingFor: [] };
    }
    const started = await this.activate(plan, requestId ?? undefined, attaching, attempt);
    if (!started.ok)
      this.failAttempt(plan.plugin, attempt, "host-load", started);
    return started;
  }

  /**
   * Lấy mã Client cho ĐÚNG run đang hoạt động.
   * Nhận: `agent` — Agent sở hữu Plugin; `pluginId` — Plugin cần đọc; `pluginRunId` — run được phép nhận mã.
   * Trả: mã Client kèm danh tính Plugin, Package và run.
   * @throws khi Plugin không thuộc phiên, run không còn hoạt động, hoặc Package không có nửa Client.
   */
  @Remote("getClientCode")
  getClientCode(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    pluginRunId: CordisDynamicPluginRunId,
  ): DynamicCordisClientSource {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      throw new Error(missingPluginMessage(pluginId));
    const run = plugin.run;
    if (run === undefined || run.pluginRunId !== pluginRunId) {
      throw new Error(`dynamic plugin "${pluginId}" is not running activation "${pluginRunId}"`);
    }
    const definition = plugin.packages.get(run.packageId);
    if (definition?.clientCode === undefined)
      throw new Error(`package "${run.packageId}" has no Client half`);
    return {
      code: definition.clientCode,
      name: definition.name,
      pluginId,
      packageId: run.packageId,
      pluginRunId,
    };
  }

  /**
   * Giải quyết MỘT yêu cầu kích hoạt Client do model khởi tạo.
   * Nhận: `requestId` — yêu cầu cần chốt một lần; `resolution` — trình duyệt từ chối hoặc kết quả kích hoạt chính xác.
   * Trả: yêu cầu còn treo có chấp nhận kết cục này hay không.
   */
  @Remote("resolveRequestRun")
  async resolveRequestRun(
    requestId: ApprovalRequestId,
    resolution: DynamicCordisRunResolution,
  ): Promise<DynamicCordisResolveAck> {
    const pending = this.registry.peekRequest(requestId);
    if (pending === undefined)
      return { accepted: false };
    const plugin = this.registry.get(pending.pluginId);
    if (resolution.ok && plugin?.run?.pluginRunId !== resolution.pluginRunId)
      return { accepted: false };
    if (!resolution.ok && resolution.pluginRunId !== undefined
      && plugin?.run?.pluginRunId !== resolution.pluginRunId)
      return { accepted: false };
    this.registry.claimRequest(requestId);
    const settled = await this.settleActivation(plugin, resolution, requestId);
    this.announceResolved(requestId, resolution, pending.requiresApproval ? undefined : "completed");
    this.steerRunOutcome(pending, settled);
    return { accepted: true };
  }

  /**
   * Chốt một run trực tiếp từ panel sau khi trang đã nạp hoặc hỏng nửa Client.
   * Nhận: `agent` — Agent sở hữu Plugin; `pluginId` — Plugin cần chốt; `resolution` — kết quả Client chính xác.
   * Trả: kích hoạt đã cam kết hoặc thất bại của nó.
   */
  @Remote("settleUserRun")
  async settleUserRun(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    resolution: DynamicCordisRunResolution,
  ): Promise<DynamicCordisRunResponse> {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      return { ok: false, reason: "plugin-missing", message: missingPluginMessage(pluginId) };
    const settled = await this.settleActivation(plugin, resolution);
    this.injectUserRunOutcome(agent, pluginId, settled);
    return settled;
  }

  /**
   * Dừng run đang hoạt động nhưng giữ mọi phiên bản Package.
   * Nhận: `agent` — Agent sở hữu Plugin; `pluginId` — Plugin cần dừng.
   * Trả: thành công hoặc lý do không có run nào bị dừng.
   */
  async stop(agent: Agent, pluginId: CordisDynamicPluginId): Promise<DynamicCordisStopResponse> {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      return { ok: false, reason: "plugin-missing", message: missingPluginMessage(pluginId) };
    const pending = this.registry.pendingRequestFor(pluginId);
    if (plugin.run === undefined && pending === undefined) {
      return { ok: false, reason: "not-running", message: `dynamic plugin "${pluginId}" is not running` };
    }
    if (pending !== undefined)
      this.cancelPending(pluginId, `dynamic plugin "${pluginId}" was stopped before approval`);
    if (plugin.run !== undefined)
      await this.retract(plugin);
    if (plugin.latestRun !== undefined) {
      plugin.latestRun.status = "stopped";
      if (plugin.latestRun.host.status !== "absent")
        plugin.latestRun.host = { status: "stopped", waitingFor: [] };
      if (plugin.latestRun.client.status !== "absent")
        plugin.latestRun.client = { status: "stopped", waitingFor: [] };
    }
    return { ok: true };
  }

  /**
   * Dừng một Plugin từ panel người dùng và xếp thay đổi trạng thái cho bước kế của model.
   * Nhận: `agent` — Agent sở hữu Plugin và nhận ngữ cảnh; `pluginId` — Plugin cần dừng.
   * Trả: thành công hoặc lý do không có run nào bị dừng.
   */
  @Remote("stopFromPanel")
  async stopFromPanel(agent: Agent, pluginId: CordisDynamicPluginId): Promise<DynamicCordisStopResponse> {
    const result = await this.stop(agent, pluginId);
    if (!result.ok)
      return result;
    const plugin = this.owned(agent, pluginId);
    this.injectUserContext(agent, `The user stopped Cordis Plugin ${pluginId}. Its Packages remain defined; currentPackageId is `
      + `${plugin?.currentPackageId ?? "none"}.`);
    return result;
  }

  /**
   * Thay bản sao Host của danh mục provider inspect phía Client.
   * Nhận: `providers` — manifest provider Client đầy đủ.
   * Trả: `null` sau khi nhận manifest.
   */
  @Remote("syncInspectManifest")
  syncInspectManifest(providers: readonly CordisInspectProviderManifest[]): null {
    this.inspectRegistry.syncClientManifest(providers);
    return null;
  }

  /**
   * Gửi kết quả hoặc thất bại inspect của Client cho MỘT truy vấn đang treo.
   * Nhận: `agent` — phiên sở hữu truy vấn; `requestId` — danh tính truy vấn; `resolution` — kết quả hoặc từ chối.
   * Trả: xác nhận với `accepted: true` CHỈ khi thành công hợp lệ chốt được truy vấn.
   */
  @Remote("resolveInspectQuery")
  resolveInspectQuery(
    agent: Agent,
    requestId: CordisInspectRequestId,
    resolution: CordisInspectQueryResolution,
  ): CordisInspectResolveAck {
    return this.inspectRegistry.resolveClientQuery(agent, requestId, resolution);
  }

  /**
   * Kiểm kê toàn khung, gộp thành một dòng cho mỗi Plugin ổn định.
   * Nhận: không.
   * Trả: metadata không kèm mã nguồn của mọi Plugin trong tiến trình.
   */
  @Remote("inventory")
  inventory(): DynamicCordisInventoryRow[] {
    return this.registry.all().map(plugin => ({
      pluginId: plugin.pluginId,
      agentId: plugin.sessionId,
      packages: [...plugin.packages.values()].map(definition => ({
        packageId: definition.packageId,
        name: definition.name,
        purpose: definition.purpose,
        hasHostHalf: definition.hostCode !== undefined,
        hasClientHalf: definition.clientCode !== undefined,
      })),
      ...plugin.currentPackageId === undefined ? {} : { currentPackageId: plugin.currentPackageId },
      ...plugin.nextPackageId === undefined ? {} : { nextPackageId: plugin.nextPackageId },
      ...plugin.run === undefined ? {} : {
        activeRun: { pluginRunId: plugin.run.pluginRunId, packageId: plugin.run.packageId },
      },
      ...plugin.latestRun === undefined ? {} : { latestRun: cloneAttempt(plugin.latestRun) },
    }));
  }

  /**
   * Đọc trạng thái giàu-Host của MỘT phiên để inspect và render kết quả.
   * Nhận: `agent` — Agent mà Session chọn các Plugin nhìn thấy được.
   * Trả: phiên bản Package, run đang sống, fiber Host và lỗi render.
   */
  snapshot(agent: Agent): DynamicCordisSnapshotRow[] {
    return this.registry.ofSession(agent.id).map(plugin => ({
      pluginId: plugin.pluginId,
      ...plugin.currentPackageId === undefined ? {} : { currentPackageId: plugin.currentPackageId },
      ...plugin.nextPackageId === undefined ? {} : { nextPackageId: plugin.nextPackageId },
      packages: [...plugin.packages.values()].map(definition => ({
        packageId: definition.packageId,
        name: definition.name,
        purpose: definition.purpose,
        hasHostHalf: definition.hostCode !== undefined,
        hasClientHalf: definition.clientCode !== undefined,
      })),
      ...plugin.run === undefined ? {} : {
        activeRun: {
          pluginRunId: plugin.run.pluginRunId,
          packageId: plugin.run.packageId,
          ...plugin.run.fiber === undefined ? {} : { fiber: plugin.run.fiber },
          handlers: [...plugin.run.handlers.keys()],
          ...plugin.run.renderFailure === undefined ? {} : { renderFailure: plugin.run.renderFailure },
        },
      },
      ...plugin.latestRun === undefined ? {} : { latestRun: cloneAttempt(plugin.latestRun) },
    }));
  }

  /**
   * Đọc ngữ cảnh không kèm mã nguồn cho thao tác `@pluginId` tường minh của người dùng.
   * Nhận: `agent` — Agent sở hữu Plugin; `pluginId` — Plugin người dùng tham chiếu.
   * Trả: nền sửa đổi ưu tiên, hoặc `undefined` khi không có.
   */
  reference(agent: Agent, pluginId: CordisDynamicPluginId): DynamicCordisReference | undefined {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      return undefined;
    const packageId = plugin.nextPackageId
      ?? plugin.currentPackageId
      ?? [...plugin.packages.keys()].at(-1);
    if (packageId === undefined)
      return undefined;
    const definition = plugin.packages.get(packageId);
    if (definition === undefined)
      return undefined;
    return {
      pluginId,
      packageId,
      name: definition.name,
      purpose: definition.purpose,
      ...plugin.currentPackageId === undefined ? {} : { currentPackageId: plugin.currentPackageId },
      ...plugin.nextPackageId === undefined ? {} : { nextPackageId: plugin.nextPackageId },
      ...plugin.run === undefined ? {} : {
        activeRun: { pluginRunId: plugin.run.pluginRunId, packageId: plugin.run.packageId },
      },
      ...plugin.latestRun === undefined ? {} : { latestRun: cloneAttempt(plugin.latestRun) },
    };
  }

  /**
   * Liệt kê tóm tắt Plugin không kèm mã nguồn do MỘT phiên sở hữu.
   * Nhận: `agent` — Agent mà Session chọn các Plugin nhìn thấy được.
   * Trả: mỗi Plugin một tóm tắt, theo thứ tự tạo.
   */
  listPlugins(agent: Agent): DynamicCordisPluginInspection[] {
    return this.registry.ofSession(agent.id).map(plugin => this.inspectPlugin(agent, plugin.pluginId));
  }

  /**
   * Inspect MỘT Plugin mà không trả mã nguồn Package.
   * Nhận: `agent` — Agent sở hữu Plugin; `pluginId` — Plugin cần inspect.
   * Trả: con trỏ phiên bản, run gần nhất và mọi tóm tắt Package.
   * @throws khi Plugin không thuộc phiên hoặc không có Package nào.
   */
  inspectPlugin(agent: Agent, pluginId: CordisDynamicPluginId): DynamicCordisPluginInspection {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      throw new Error(missingPluginMessage(pluginId));
    const reference = this.reference(agent, pluginId);
    if (reference === undefined)
      throw new Error(`dynamic plugin "${pluginId}" has no package`);
    return {
      ...reference,
      packages: [...plugin.packages.values()].map(definition => ({
        packageId: definition.packageId,
        name: definition.name,
        purpose: definition.purpose,
        hasHostHalf: definition.hostCode !== undefined,
        hasClientHalf: definition.clientCode !== undefined,
      })),
    };
  }

  /**
   * Đọc MỘT Package bất biến chính xác cùng mã Host và Client của nó.
   * Nhận: `agent` — Agent sở hữu Plugin; `pluginId` — Plugin chứa Package; `packageId` — Package cần inspect.
   * Trả: metadata Package, mã nguồn và con trỏ vòng đời của Plugin.
   * @throws khi Plugin không thuộc phiên hoặc Package không tồn tại trên Plugin đó.
   */
  inspectPackage(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    packageId: CordisDynamicPackageId,
  ): DynamicCordisPackageInspection {
    const plugin = this.owned(agent, pluginId);
    if (plugin === undefined)
      throw new Error(missingPluginMessage(pluginId));
    const definition = plugin.packages.get(packageId);
    if (definition === undefined) {
      throw new Error(`dynamic package "${packageId}" does not exist on plugin "${pluginId}"`);
    }
    return {
      pluginId,
      packageId,
      name: definition.name,
      purpose: definition.purpose,
      code: {
        ...definition.hostCode === undefined ? {} : { host: definition.hostCode },
        ...definition.clientCode === undefined ? {} : { client: definition.clientCode },
      },
      ...plugin.currentPackageId === undefined ? {} : { currentPackageId: plugin.currentPackageId },
      ...plugin.nextPackageId === undefined ? {} : { nextPackageId: plugin.nextPackageId },
      ...plugin.run === undefined ? {} : {
        activeRun: { pluginRunId: plugin.run.pluginRunId, packageId: plugin.run.packageId },
      },
      ...plugin.latestRun === undefined ? {} : { latestRun: cloneAttempt(plugin.latestRun) },
    };
  }

  /**
   * Ghi nhận lỗi render sau khi nạp cho ĐÚNG run đang hoạt động.
   * Nhận: `agent`, `pluginId`, `pluginRunId` — danh tính run; `failure` — slot, thông điệp và kết quả rút entry.
   * Trả: `null` sau khi ghi nhận hoặc bỏ qua báo cáo cũ.
   */
  @Remote("reportRenderFailure")
  async reportRenderFailure(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    pluginRunId: CordisDynamicPluginRunId,
    failure: DynamicCordisRenderFailure,
  ): Promise<null> {
    const plugin = this.owned(agent, pluginId);
    if (plugin?.run?.pluginRunId === pluginRunId) {
      const run = plugin.run;
      const definition = plugin.packages.get(plugin.run.packageId);
      const shouldSteer = run.renderFailure === undefined;
      run.renderFailure = failure;
      const attempt = plugin.latestRun;
      if (attempt?.pluginRunId === pluginRunId) {
        attempt.error = this.diagnostic(plugin, attempt, "client-render", failure);
        attempt.client = { status: "failed", waitingFor: attempt.client.waitingFor, error: failure.message };
        attempt.status = "failed";
      }
      if (definition !== undefined && shouldSteer) {
        this.steerRenderFailure(agent, plugin, definition, pluginRunId, failure);
      }
    }
    return await Promise.resolve(null);
  }

  /**
   * Báo một lần guard Client từ chối mã SAU khi Package đã kích hoạt xong.
   * Nhận: `agent`, `pluginId`, `pluginRunId` — danh tính run; `failure` — thông điệp và stack gốc.
   * Trả: `null` sau khi báo hoặc bỏ qua lỗi cũ/lúc khởi động.
   */
  @Remote("reportClientGuardFailure")
  async reportClientGuardFailure(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    pluginRunId: CordisDynamicPluginRunId,
    failure: CordisErrorDetails,
  ): Promise<null> {
    const plugin = this.owned(agent, pluginId);
    const run = plugin?.run;
    if (plugin !== undefined && run?.pluginRunId === pluginRunId) {
      this.steerGuardFailure(plugin, run, "Client", failure);
    }
    return await Promise.resolve(null);
  }

  /**
   * Gọi MỘT phương thức Host đang sống, từ chối run Client cũ.
   * Nhận: `pluginId` — Plugin sở hữu phương thức; `pluginRunId` — run cho phép gọi; `method` — handler đã đăng ký;
   *        `args` — đối số JSON giao cho handler.
   * Trả: kết quả JSON hoặc thất bại có mã kiểu.
   */
  @Remote("invoke")
  async invoke(
    pluginId: CordisDynamicPluginId,
    pluginRunId: CordisDynamicPluginRunId,
    method: string,
    args: JsonValue,
  ): Promise<DynamicCordisInvokeResult> {
    const plugin = this.registry.get(pluginId);
    if (plugin === undefined || plugin.run === undefined) {
      return { ok: false, code: "plugin-not-running", message: `dynamic plugin "${pluginId}" is not running` };
    }
    const run = plugin.run;
    if (run.pluginRunId !== pluginRunId) {
      return { ok: false, code: "stale-run", message: `activation "${pluginRunId}" is no longer active` };
    }
    const handler = run.handlers.get(method);
    if (handler === undefined) {
      return { ok: false, code: "method-not-found", message: `dynamic plugin "${pluginId}" registered no Host method "${method}"` };
    }
    try {
      return { ok: true, value: await handler(args) as JsonValue };
    } catch (error) {
      const failure = errorDetails(error);
      this.steerHostHandlerFailure(plugin, run, method, failure);
      return { ok: false, code: "handler-error", ...failure };
    }
  }

  /** Phân giải kế hoạch chạy (uỷ thác `resolveRunPlan`). Nhận: agent + danh tính đích + chế độ. Trả: {@link RunPlan}. */
  private resolvePlan(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    packageId: CordisDynamicPackageId,
    mode: CordisDynamicRunMode,
    allowActiveAttach = false,
  ): RunPlan {
    return resolveRunPlan(this.owned(agent, pluginId), pluginId, packageId, mode, allowActiveAttach, this.starting);
  }

  /** Ghép các lần kích hoạt đồng thời của MỘT Plugin. Nhận: plan + yêu cầu + cờ gắn + attempt. Trả: promise kết quả nửa Host. */
  private activate(
    plan: PlannedRun,
    requestId: ApprovalRequestId | undefined,
    allowActiveAttach: boolean,
    attempt: DynamicCordisRunAttempt,
  ): Promise<DynamicCordisHostHalfResult> {
    const inFlight = this.starting.get(plan.plugin.pluginId);
    if (inFlight !== undefined)
      return inFlight;
    const starting = this.startFresh(plan, requestId, allowActiveAttach, attempt);
    this.starting.set(plan.plugin.pluginId, starting);
    return starting.finally(() => { this.starting.delete(plan.plugin.pluginId); });
  }

  /** Bắt đầu MỘT run mới (uỷ thác `startFreshIn`). Nhận: plan + yêu cầu + cờ gắn + attempt. Trả: kết quả nửa Host. */
  private startFresh(
    plan: PlannedRun,
    requestId: ApprovalRequestId | undefined,
    allowActiveAttach: boolean,
    attempt: DynamicCordisRunAttempt,
  ): Promise<DynamicCordisHostHalfResult> {
    return startFreshIn(this.ctx, plan, requestId, allowActiveAttach, attempt,
      (plugin, hostCode, run) => this.startHost(plugin, hostCode, run));
  }

  /** Dựng nửa Host trong sandbox (uỷ thác `startHostIn`). Nhận: plugin + mã Host + run. Trả: lỗi hoặc `undefined`. */
  private startHost(
    plugin: DynamicCordisPlugin,
    hostCode: string,
    run: DynamicCordisRun,
  ): Promise<CordisErrorDetails | undefined> {
    return startHostIn(this.resolved.vmTimeoutMs, () => this.requireGroup(),
      (error) => this.steerGuardFailure(plugin, run, "Host", errorDetails(error)), plugin, hostCode, run);
  }

  /** Chốt kết cục Client (uỷ thác `settleActivationIn`). Nhận: plugin + kết cục + yêu cầu. Trả: phản hồi chạy. */
  private settleActivation(
    plugin: DynamicCordisPlugin | undefined,
    resolution: DynamicCordisRunResolution,
    requestId?: ApprovalRequestId,
  ): Promise<DynamicCordisRunResponse> {
    return settleActivationIn(this.ctx, plugin, resolution, requestId);
  }

  /** Cam kết MỘT run thành hiện tại (giữ tên prototype của bản gốc). Nhận: plugin + run. Trả: không (ghi tại chỗ). */
  private commitActivation(plugin: DynamicCordisPlugin, run: DynamicCordisRun): void {
    commitActivationOf(plugin, run);
  }

  /** Dựng phản hồi chạy thành công. Nhận: plugin + nhánh thành công nửa Host. Trả: phản hồi `ok: true`. */
  private runResponse(plugin: DynamicCordisPlugin, started: HostHalfStarted): DynamicCordisRunResponse {
    return runResponseOf(plugin, started);
  }

  /** Công bố kết cục yêu cầu chạy. Nhận: yêu cầu + kết cục + cờ ghi đè. Trả: không. */
  private announceResolved(
    requestId: ApprovalRequestId,
    resolution: DynamicCordisRunResolution,
    override?: RequestRunOutcome,
  ): void {
    announceResolvedOn(this.ctx, requestId, resolution, override);
  }

  /** Steer kết cục chạy về Agent sở hữu. Nhận: yêu cầu đã treo + kết cục. Trả: không. */
  private steerRunOutcome(pending: DynamicCordisPendingRequest, settled: DynamicCordisRunResponse): void {
    steerAgent(this.ctx, pending.agentId, () => runOutcomeText(pending, settled, this.registry.get(pending.pluginId)));
  }

  /** Steer lỗi render Client về Agent. Nhận: agent + danh tính + lỗi render. Trả: không. */
  private steerRenderFailure(
    agent: Agent,
    plugin: DynamicCordisPlugin,
    definition: DynamicCordisDefinition,
    pluginRunId: CordisDynamicPluginRunId,
    failure: DynamicCordisRenderFailure,
  ): void {
    agent.steer(runnerMessage(renderFailureText(plugin, definition, pluginRunId, failure)));
  }

  /** Steer lỗi Host handler (mỗi khoá một lần). Nhận: danh tính + method + lỗi. Trả: không. */
  private steerHostHandlerFailure(
    plugin: DynamicCordisPlugin,
    run: DynamicCordisRun,
    method: string,
    failure: CordisErrorDetails,
  ): void {
    const reportKey = `Host\u0000handler\u0000${method}\u0000${failure.message}`;
    if (!this.claimRuntimeFailure(plugin, run, reportKey))
      return;
    steerAgent(this.ctx, plugin.sessionId, () => hostHandlerFailureText(plugin, run, method, failure));
  }

  /** Steer một lần guard từ chối mã (mỗi khoá một lần). Nhận: danh tính + nền tảng + lỗi. Trả: không. */
  private steerGuardFailure(
    plugin: DynamicCordisPlugin,
    run: DynamicCordisRun,
    platform: "Host" | "Client",
    failure: CordisErrorDetails,
  ): void {
    const reportKey = `${platform}\u0000guard\u0000${failure.message}`;
    if (!this.claimRuntimeFailure(plugin, run, reportKey))
      return;
    steerAgent(this.ctx, plugin.sessionId, () => guardFailureText(plugin, run, platform, failure));
  }

  /** Giành quyền báo lỗi lúc chạy. Nhận: danh tính + khoá báo cáo. Trả: `true` khi lần đầu hợp lệ. */
  private claimRuntimeFailure(plugin: DynamicCordisPlugin, run: DynamicCordisRun, key: string): boolean {
    return claimRuntimeFailureOf(plugin, run, key);
  }

  /** Inject kết cục chạy tay vào Agent. Nhận: agent + Plugin + kết cục. Trả: không. */
  private injectUserRunOutcome(
    agent: Agent,
    pluginId: CordisDynamicPluginId,
    settled: DynamicCordisRunResponse,
  ): void {
    injectAgent(this.ctx, agent, () => userRunOutcomeText(pluginId, settled, this.owned(agent, pluginId)));
  }

  /** Inject ngữ cảnh vào Agent còn sống. Nhận: agent + câu văn bản. Trả: không. */
  private injectUserContext(agent: Agent, text: string): void {
    injectAgent(this.ctx, agent, () => text);
  }

  /** Huỷ yêu cầu chạy đang treo (uỷ thác `cancelPendingRequest`). Nhận: Plugin + lý do. Trả: không. */
  private cancelPending(pluginId: CordisDynamicPluginId, message: string): void {
    cancelPendingRequest(this.ctx, this.registry, pluginId, message);
  }

  /** Dựng attempt mới (uỷ thác `newAttempt`). Nhận: plan. Trả: attempt với run id mới. */
  private createAttempt(plan: PlannedRun): DynamicCordisRunAttempt {
    return newAttempt(this.registry, plan);
  }

  /** Đánh dấu attempt thất bại (uỷ thác `failAttemptOf`). Nhận: danh tính + pha + lỗi. Trả: không. */
  private failAttempt(
    plugin: DynamicCordisPlugin,
    attempt: DynamicCordisRunAttempt,
    phase: CordisRunDiagnostic["phase"],
    failure: CordisErrorDetails,
  ): void {
    failAttemptOf(plugin, attempt, phase, failure);
  }

  /** Dựng chẩn đoán cấu trúc (uỷ thác `diagnosticOf`). Nhận: danh tính + pha + lỗi. Trả: chẩn đoán. */
  private diagnostic(
    plugin: DynamicCordisPlugin,
    attempt: DynamicCordisRunAttempt,
    phase: CordisRunDiagnostic["phase"],
    failure: CordisErrorDetails | string,
  ): CordisRunDiagnostic {
    return diagnosticOf(plugin, attempt, phase, failure);
  }

  /** Rút run đang sống (uỷ thác `retractRun`). Nhận: plugin. Trả: promise hoàn tất sau khi dọn xong. */
  private retract(plugin: DynamicCordisPlugin): Promise<void> {
    return retractRun(this.ctx, plugin);
  }

  /** Đọc Plugin nếu thuộc phiên (uỷ thác `ownedPlugin`). Nhận: agent + Plugin. Trả: Plugin hoặc `undefined`. */
  private owned(agent: Agent, pluginId: CordisDynamicPluginId): DynamicCordisPlugin | undefined {
    return ownedPlugin(this.registry, agent, pluginId);
  }

  /**
   * Lấy (hoặc tạo một lần) fiber nhóm `cordis-dynamic` mà mọi nửa Host treo dưới.
   * Nhận: không.
   * Trả: fiber nhóm dùng chung của tiến trình.
   */
  private requireGroup(): Fiber {
    this.group ??= this.rootCtx.plugin({ name: "cordis-dynamic", apply: () => { } });
    return this.group;
  }
}

export default DynamicCordisRunnerService;
