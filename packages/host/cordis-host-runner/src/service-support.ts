/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Helper tách từ 'lib/types/index.js' (1.152 dòng) của @deepseek-ai/dsh-cordis-host-runner: toàn bộ
 *      phép toán miền của runner (đóng dấu id, phân giải kế hoạch, dựng/huỷ run, chốt kích hoạt, chẩn đoán,
 *      steer/inject Agent, phát sự kiện `cordis/*`) nhận seam TƯỜNG MINH để src/service.ts giữ ≤1000 dòng.
 *      Luật 000d: không augment module — seam khai theo CẤU TRÚC tại đây.
 */

import type { Context, Fiber } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { UserMessage } from "@deepseek-ai/dsh-llm";

import { isPlugin, normalizeHandler } from "./guard.ts";
import { missingServices, startHostHalf } from "./lifecycle.ts";
import type {
  DynamicCordisDefinition, DynamicCordisPendingRequest, DynamicCordisPlugin, DynamicCordisRegistry, DynamicCordisRun,
} from "./registry.ts";
import { createSandbox, evaluateHostCode } from "./sandbox.ts";
import type {
  ApprovalRequestId, CordisDynamicPackageId, CordisDynamicPluginId, CordisDynamicPluginRunId, CordisDynamicRunMode,
  CordisErrorDetails, CordisRunDiagnostic, DynamicCordisHostHalfResult, DynamicCordisRenderFailure, DynamicCordisRunAttempt,
  DynamicCordisRunResolution, DynamicCordisRunResponse,
} from "./types.ts";

/** Cấu hình row đã phân giải: hai trường SỐ bắt buộc sau khi `static Config` áp default. */
export interface ResolvedRunnerConfig {
  /** Thời gian chạy đồng bộ tối đa của VM, mili giây. */
  readonly vmTimeoutMs: number;
  /** Thời gian chờ tối đa một phản hồi inspect hợp lệ từ Client, mili giây. */
  readonly clientInspectTimeoutMs: number;
}

/** Kết quả phân giải một yêu cầu chạy: hoặc kế hoạch đã đủ, hoặc phản hồi từ chối. */
export type RunPlan =
  | {
    readonly ok: true;
    readonly plugin: DynamicCordisPlugin;
    readonly definition: DynamicCordisDefinition;
    readonly mode: CordisDynamicRunMode;
  }
  | { readonly ok: false; readonly response: Extract<DynamicCordisRunResponse, { ok: false }> };

/** Kế hoạch chạy ĐÃ ĐỦ (nhánh `ok: true` của {@link RunPlan}). */
export type PlannedRun = Extract<RunPlan, { ok: true }>;

/** Nhánh THÀNH CÔNG của kết quả nửa Host. */
export type HostHalfStarted = Extract<DynamicCordisHostHalfResult, { ok: true }>;

/** Chân trời phát sự kiện KHÔNG khai báo của Context cordis (khai theo CẤU TRÚC). */
interface RunnerEventEmitter {
  /**
   * Phát MỘT sự kiện.
   * Nhận: tên sự kiện + thân sự kiện.
   * Trả: không; lỗi người nghe LAN ra người gọi.
   */
  emit(name: string, payload: unknown): void;
}

/**
 * Đóng dấu MỘT Plugin ID do Host cấp.
 * Nhận: `id` — định danh mờ do sổ đăng ký Host cấp.
 * Trả: định danh Plugin đã đóng dấu (nguyên văn chuỗi đầu vào).
 */
export function brandCordisDynamicPluginId(id: string): CordisDynamicPluginId {
  return id as CordisDynamicPluginId;
}

/**
 * Đóng dấu MỘT Package ID do Host cấp.
 * Nhận: `id` — định danh mờ do sổ đăng ký Host cấp.
 * Trả: định danh Package đã đóng dấu (nguyên văn chuỗi đầu vào).
 */
export function brandCordisDynamicPackageId(id: string): CordisDynamicPackageId {
  return id as CordisDynamicPackageId;
}

/**
 * Đóng dấu MỘT Plugin Run ID do Host cấp.
 * Nhận: `id` — định danh mờ do sổ đăng ký Host cấp.
 * Trả: định danh Plugin Run đã đóng dấu (nguyên văn chuỗi đầu vào).
 */
export function brandCordisDynamicPluginRunId(id: string): CordisDynamicPluginRunId {
  return id as CordisDynamicPluginRunId;
}

/**
 * Đóng dấu MỘT approval request ID do Host cấp.
 * Nhận: `id` — định danh mờ do sổ đăng ký Host cấp.
 * Trả: định danh approval request đã đóng dấu (nguyên văn chuỗi đầu vào).
 */
export function brandApprovalRequestId(id: string): ApprovalRequestId {
  return id as ApprovalRequestId;
}

/**
 * Dịch vụ mà fiber của một run còn thiếu.
 * Nhận: `ctx` — Context để đối chiếu dịch vụ; `run` — run đang chạy.
 * Trả: tên các dịch vụ còn thiếu (rỗng khi run không có fiber), đúng thứ tự khai `inject`.
 */
export function missingFor(ctx: Context, run: DynamicCordisRun): string[] {
  return run.fiber === undefined ? [] : missingServices(ctx, run.fiber);
}

/**
 * Câu thông điệp chuẩn khi không tìm thấy Plugin động.
 * Nhận: `id` — định danh Plugin.
 * Trả: câu tiếng Anh NGUYÊN VĂN của bản gốc, RIÊNG nhãn harness đã đổi sang "Galaxy Blackhole" (chuỗi đi vào model).
 */
export function missingPluginMessage(id: CordisDynamicPluginId): string {
  return `no dynamic plugin "${id}" in this process — it may have been removed or lost on Galaxy Blackhole restart`;
}

/**
 * Đọc `message`/`stack` từ một giá trị bị ném bất kỳ.
 * Nhận: `error` — giá trị bắt được trong `catch`.
 * Trả: `{ message, stack? }` giữ nguyên văn bản gốc (chuỗi hoá khi không phải object).
 */
export function errorDetails(error: unknown): CordisErrorDetails {
  if (typeof error !== "object" || error === null) return { message: String(error) };
  const message = "message" in error && typeof error.message === "string"
    ? error.message
    : Object.prototype.toString.call(error);
  const stack = "stack" in error && typeof error.stack === "string" ? error.stack : undefined;
  return { message, ...stack === undefined ? {} : { stack } };
}

/**
 * Soạn phần `message`/`stack` của một thất bại thành văn bản gửi Agent.
 * Nhận: `failure` — chi tiết lỗi đã chuẩn hoá.
 * Trả: chuỗi `message: …` kèm khối `stack:` khi có.
 */
function formatErrorDetails(failure: CordisErrorDetails): string {
  return `message: ${failure.message}`
    + (failure.stack === undefined ? "" : `\nstack:\n${failure.stack}`);
}

/**
 * Sao chép MỘT attempt để không lộ tham chiếu nội bộ ra ngoài service.
 * Nhận: `attempt` — bản ghi attempt đang sống.
 * Trả: bản sao nông, với `host`/`client`/`waitingFor`/`error` được sao tiếp.
 */
export function cloneAttempt(attempt: DynamicCordisRunAttempt): DynamicCordisRunAttempt {
  return {
    ...attempt,
    host: { ...attempt.host, waitingFor: [...attempt.host.waitingFor] },
    client: { ...attempt.client, waitingFor: [...attempt.client.waitingFor] },
    ...attempt.error === undefined ? {} : { error: { ...attempt.error } },
  };
}

/**
 * Phát MỘT sự kiện do runner công bố trên Context.
 * Nhận: `ctx` — Context phát; `name` — tên sự kiện; `payload` — thân sự kiện.
 * Trả: không; lỗi người nghe LAN ra người gọi (đúng `ctx.emit` của kernel).
 */
export function emitRunnerEvent(ctx: Context, name: string, payload: unknown): void {
  (ctx as unknown as RunnerEventEmitter).emit(name, payload);
}

/**
 * Dựng tin nhắn user mà runner đẩy vào Agent (nguồn `cordis-host-runner`).
 * Nhận: `text` — nội dung văn bản MỘT khối.
 * Trả: tin nhắn user bất biến mang nguồn `cordis-host-runner` và id mới.
 */
export function runnerMessage(text: string): UserMessage {
  return createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: "cordis-host-runner" },
  } as unknown as Parameters<typeof createUserMessage>[0]);
}

/**
 * Đọc Plugin NẾU nó thuộc đúng phiên của Agent.
 * Nhận: `registry` — sổ đăng ký tiến trình; `agent` — Agent đòi quyền sở hữu; `pluginId` — Plugin cần đọc.
 * Trả: Plugin khi cùng phiên, ngược lại `undefined`.
 */
export function ownedPlugin(
  registry: DynamicCordisRegistry,
  agent: Agent,
  pluginId: CordisDynamicPluginId,
): DynamicCordisPlugin | undefined {
  const plugin = registry.get(pluginId);
  return plugin?.sessionId === agent.id ? plugin : undefined;
}

/**
 * Phân giải một yêu cầu chạy thành kế hoạch hoặc phản hồi từ chối (giữ nguyên thứ tự kiểm của bản gốc).
 * Nhận: `plugin` — Plugin đã đối chiếu quyền sở hữu; `pluginId`, `packageId`, `mode`, `allowActiveAttach`;
 *        `starting` — sổ các Plugin đang khởi động.
 * Trả: kế hoạch đã đủ hoặc phản hồi từ chối nguyên văn.
 */
export function resolveRunPlan(
  plugin: DynamicCordisPlugin | undefined,
  pluginId: CordisDynamicPluginId,
  packageId: CordisDynamicPackageId,
  mode: CordisDynamicRunMode,
  allowActiveAttach: boolean,
  starting: { has(id: CordisDynamicPluginId): boolean },
): RunPlan {
  if (plugin === undefined)
    return { ok: false, response: { ok: false, reason: "plugin-missing", message: missingPluginMessage(pluginId) } };
  const definition = plugin.packages.get(packageId);
  if (definition === undefined) {
    return { ok: false, response: { ok: false, reason: "package-missing", message: `plugin "${pluginId}" has no package "${packageId}"` } };
  }
  const current = plugin.currentPackageId;
  if (mode === "update" && (current === undefined || current === packageId)) {
    return {
      ok: false,
      response: {
        ok: false,
        reason: "invalid-mode",
        message: current === undefined
          ? `plugin "${pluginId}" has no successful version yet; start "${packageId}" with mode "run"`
          : `package "${packageId}" is already current; use mode "run"`,
      },
    };
  }
  if (mode === "run" && current !== undefined && current !== packageId) {
    return {
      ok: false,
      response: {
        ok: false,
        reason: "invalid-mode",
        message: `package "${packageId}" differs from current "${current}"; use mode "update"`,
      },
    };
  }
  if (!allowActiveAttach && starting.has(pluginId)) {
    return { ok: false, response: { ok: false, reason: "transition-in-flight", message: `plugin "${pluginId}" is already starting` } };
  }
  return { ok: true, plugin, definition, mode };
}

/**
 * Dựng bản ghi attempt mới cho một kế hoạch chạy.
 * Nhận: `registry` — sổ cấp id; `plan` — kế hoạch đã đủ.
 * Trả: attempt với run id mới và trạng thái hai nửa theo mã đã khai.
 */
export function newAttempt(registry: DynamicCordisRegistry, plan: PlannedRun): DynamicCordisRunAttempt {
  return {
    pluginRunId: brandCordisDynamicPluginRunId(registry.mintPluginRunId()),
    packageId: plan.definition.packageId,
    mode: plan.mode,
    status: "starting-host",
    host: {
      status: plan.definition.hostCode === undefined ? "absent" : "pending",
      waitingFor: [],
    },
    client: {
      status: plan.definition.clientCode === undefined ? "absent" : "pending",
      waitingFor: [],
    },
  };
}

/**
 * Dựng chẩn đoán cấu trúc cho MỘT attempt hỏng.
 * Nhận: `plugin` — Plugin liên quan; `attempt` — attempt hỏng; `phase` — pha hỏng; `failure` — lỗi hoặc chuỗi.
 * Trả: chẩn đoán kèm danh tính Plugin, Package và run.
 */
export function diagnosticOf(
  plugin: DynamicCordisPlugin,
  attempt: DynamicCordisRunAttempt,
  phase: CordisRunDiagnostic["phase"],
  failure: CordisErrorDetails | string,
): CordisRunDiagnostic {
  const details = typeof failure === "string" ? { message: failure } : failure;
  return {
    phase,
    ...details,
    pluginId: plugin.pluginId,
    packageId: attempt.packageId,
    pluginRunId: attempt.pluginRunId,
  };
}

/**
 * Đánh dấu MỘT attempt thất bại ở đúng nửa tương ứng.
 * Nhận: `plugin` — Plugin liên quan; `attempt` — attempt hỏng; `phase` — pha hỏng; `failure` — chi tiết lỗi.
 * Trả: không (ghi tại chỗ lên `attempt`).
 */
export function failAttemptOf(
  plugin: DynamicCordisPlugin,
  attempt: DynamicCordisRunAttempt,
  phase: CordisRunDiagnostic["phase"],
  failure: CordisErrorDetails,
): void {
  attempt.status = "failed";
  attempt.error = diagnosticOf(plugin, attempt, phase, failure);
  if (phase.startsWith("host"))
    attempt.host = { status: "failed", waitingFor: [], error: failure.message };
  else
    attempt.client = { status: "failed", waitingFor: [], error: failure.message };
}

/**
 * Cam kết MỘT run thành phiên bản hiện tại và dọn con trỏ chuyển tiếp.
 * Nhận: `plugin` — Plugin nhận cam kết; `run` — run vừa thành công.
 * Trả: không (ghi tại chỗ lên `plugin`/`latestRun`).
 */
export function commitActivationOf(plugin: DynamicCordisPlugin, run: DynamicCordisRun): void {
  plugin.currentPackageId = run.packageId;
  delete plugin.nextPackageId;
  delete run.startedForRequest;
  const attempt = plugin.latestRun;
  if (attempt?.pluginRunId === run.pluginRunId) {
    attempt.status = attempt.host.status === "waiting" || attempt.client.status === "waiting" ? "waiting" : "running";
    delete attempt.approvalRequestId;
    delete attempt.requiresApproval;
    delete attempt.error;
  }
}

/**
 * Dựng phản hồi chạy thành công từ một kích hoạt Host đã xong.
 * Nhận: `plugin` — Plugin liên quan; `started` — nhánh thành công của kết quả nửa Host.
 * Trả: phản hồi `ok: true` với chế độ lấy từ attempt gần nhất.
 */
export function runResponseOf(plugin: DynamicCordisPlugin, started: HostHalfStarted): DynamicCordisRunResponse {
  return {
    ok: true,
    status: "running",
    pluginId: plugin.pluginId,
    packageId: started.packageId,
    pluginRunId: started.pluginRunId,
    waitingFor: started.waitingFor,
    currentPackageId: started.packageId,
    mode: plugin.latestRun?.pluginRunId === started.pluginRunId ? plugin.latestRun.mode : "run",
  };
}

/**
 * Công bố kết cục của MỘT yêu cầu chạy đã rời trạng thái treo.
 * Nhận: `ctx` — Context phát; `requestId` — yêu cầu; `resolution` — kết cục Client; `override` — kết cục ghi đè.
 * Trả: không; lỗi người nghe LAN ra người gọi (đúng `ctx.emit`).
 */
export function announceResolvedOn(
  ctx: Context,
  requestId: ApprovalRequestId,
  resolution: DynamicCordisRunResolution,
  override?: "approved" | "completed" | "rejected" | "cancelled" | "failed",
): void {
  const outcome = override ?? (resolution.ok ? "approved" : resolution.reason === "rejected" ? "rejected" : "failed");
  emitRunnerEvent(ctx, "cordis/request-run-resolved", { requestId, outcome });
}

/**
 * Giành quyền báo MỘT lỗi lúc chạy cho run đang sống (mỗi khoá một lần).
 * Nhận: `plugin`/`run` — danh tính; `key` — khoá báo cáo.
 * Trả: `true` khi lần đầu báo cho run đang sống và attempt đang chạy/chờ.
 */
export function claimRuntimeFailureOf(plugin: DynamicCordisPlugin, run: DynamicCordisRun, key: string): boolean {
  const attempt = plugin.latestRun;
  if (plugin.run !== run || attempt?.pluginRunId !== run.pluginRunId
    || (attempt.status !== "running" && attempt.status !== "waiting"))
    return false;
  if (run.reportedRuntimeErrors.has(key))
    return false;
  run.reportedRuntimeErrors.add(key);
  return true;
}

/**
 * Rút run đang sống: dọn handler, huỷ fiber và công bố sự kiện rút.
 * Nhận: `ctx` — Context phát sự kiện; `plugin` — Plugin cần rút run.
 * Trả: promise hoàn tất sau khi fiber (nếu có) dispose xong.
 */
export async function retractRun(ctx: Context, plugin: DynamicCordisPlugin): Promise<void> {
  const run = plugin.run;
  if (run === undefined)
    return;
  delete plugin.run;
  for (const dispose of run.handlerDisposers.splice(0))
    dispose();
  if (run.fiber !== undefined)
    await run.fiber.dispose();
  emitRunnerEvent(ctx, "cordis/dynamic-retract", {
    pluginId: plugin.pluginId,
    packageId: run.packageId,
    pluginRunId: run.pluginRunId,
  });
}

/**
 * Huỷ yêu cầu chạy đang treo của MỘT Plugin và đánh dấu attempt tương ứng.
 * Nhận: `ctx` — Context phát sự kiện; `registry` — sổ yêu cầu; `pluginId` — Plugin cần huỷ; `message` — lý do.
 * Trả: không.
 */
export function cancelPendingRequest(
  ctx: Context,
  registry: DynamicCordisRegistry,
  pluginId: CordisDynamicPluginId,
  message: string,
): void {
  const requestId = registry.pendingRequestFor(pluginId);
  if (requestId === undefined)
    return;
  const pending = registry.claimRequest(requestId);
  if (pending === undefined)
    return;
  const plugin = registry.get(pluginId);
  if (plugin?.latestRun?.pluginRunId === pending.pluginRunId) {
    plugin.latestRun.status = "cancelled";
    plugin.latestRun.error = diagnosticOf(plugin, plugin.latestRun, "approval", message);
    delete plugin.latestRun.approvalRequestId;
    delete plugin.latestRun.requiresApproval;
  }
  announceResolvedOn(ctx, requestId, { ok: false, reason: "rejected" }, "cancelled");
}

/**
 * Steer MỘT câu về Agent sở hữu phiên (bỏ qua khi Agent không còn sống).
 * Nhận: `ctx` — Context đọc sổ Agent; `sessionId` — phiên đích; `text` — hàm dựng câu (chỉ gọi khi cần).
 * Trả: không; lỗi người nhận LAN ra người gọi (đúng `agent.steer`).
 */
export function steerAgent(ctx: Context, sessionId: DynamicCordisPlugin["sessionId"], text: () => string): void {
  const agents = ctx.get("agents");
  const agent = agents?.get(sessionId);
  if (agent === undefined)
    return;
  agent.steer(runnerMessage(text()));
}

/**
 * Inject ngữ cảnh vào Agent, CHỈ khi Agent đó còn là thể hiện đang sống.
 * Nhận: `ctx` — Context đọc sổ Agent; `agent` — Agent đích; `text` — hàm dựng câu.
 * Trả: không.
 */
export function injectAgent(ctx: Context, agent: Agent, text: () => string): void {
  const agents = ctx.get("agents");
  if (agents?.get(agent.id) !== agent)
    return;
  agent.inject(runnerMessage(text()));
}

/**
 * Dựng sandbox, đánh giá mã Host và gắn fiber con vào nhóm `cordis-dynamic`.
 * Nhận: `vmTimeoutMs` — trần chạy đồng bộ; `group` — hàm lấy fiber nhóm; `reportGuardFailure` — báo guard;
 *        `plugin` — Plugin nhận run; `hostCode` — thân hàm Host; `run` — run đang dựng.
 * Trả: `undefined` khi thành công, hoặc chi tiết lỗi đã chuẩn hoá (handler đã được dọn).
 */
export async function startHostIn(
  vmTimeoutMs: number,
  group: () => Fiber,
  reportGuardFailure: (error: Error) => void,
  plugin: DynamicCordisPlugin,
  hostCode: string,
  run: DynamicCordisRun,
): Promise<CordisErrorDetails | undefined> {
  const handle = (method: unknown, fn: unknown) => {
    const normalized = normalizeHandler(method, fn);
    run.handlers.set(normalized.method, normalized.handler);
    const dispose = () => {
      if (run.handlers.get(normalized.method) === normalized.handler)
        run.handlers.delete(normalized.method);
    };
    run.handlerDisposers.push(dispose);
    return dispose;
  };
  try {
    const sandbox = createSandbox(plugin.pluginId, { handle });
    const evaluated = await evaluateHostCode(sandbox, hostCode, plugin.pluginId, vmTimeoutMs);
    if (!isPlugin(evaluated)) {
      throw new Error(evaluated === undefined
        ? "the Host half returned `undefined` — did you forget `return`?"
        : "the Host half must return a Plugin function or an object with apply(ctx)");
    }
    run.fiber = await startHostHalf(group(), evaluated, reportGuardFailure);
    return undefined;
  } catch (error) {
    for (const dispose of run.handlerDisposers.splice(0))
      dispose();
    return errorDetails(error);
  }
}

/**
 * Bắt đầu MỘT run mới cho Package đã chọn (hoặc gắn vào run tương thích đang sống).
 * Nhận: `ctx` — Context phát sự kiện; `plan`, `requestId`, `allowActiveAttach`, `attempt`;
 *        `startHost` — hàm dựng nửa Host.
 * Trả: kích hoạt Host thành công (kèm `startedHere`) hoặc thất bại đã chuẩn hoá.
 */
export async function startFreshIn(
  ctx: Context,
  plan: PlannedRun,
  requestId: ApprovalRequestId | undefined,
  allowActiveAttach: boolean,
  attempt: DynamicCordisRunAttempt,
  startHost: (plugin: DynamicCordisPlugin, hostCode: string, run: DynamicCordisRun) => Promise<CordisErrorDetails | undefined>,
): Promise<DynamicCordisHostHalfResult> {
  const { plugin, definition, mode } = plan;
  if (allowActiveAttach
    && plugin.run?.packageId === definition.packageId
    && plugin.run.pluginRunId === attempt.pluginRunId) {
    return {
      ok: true,
      pluginId: plugin.pluginId,
      packageId: definition.packageId,
      pluginRunId: plugin.run.pluginRunId,
      waitingFor: missingFor(ctx, plugin.run),
      startedHere: false,
    };
  }
  if (plugin.run !== undefined)
    await retractRun(ctx, plugin);
  if (mode === "update" || plugin.currentPackageId === undefined)
    plugin.nextPackageId = definition.packageId;
  const run: DynamicCordisRun = {
    pluginRunId: attempt.pluginRunId,
    packageId: definition.packageId,
    handlers: new Map(),
    handlerDisposers: [],
    reportedRuntimeErrors: new Set(),
    ...requestId === undefined ? {} : { startedForRequest: requestId },
  };
  if (definition.hostCode !== undefined) {
    const failure = await startHost(plugin, definition.hostCode, run);
    if (failure !== undefined)
      return { ok: false, ...failure };
  }
  plugin.run = run;
  emitRunnerEvent(ctx, "cordis/dynamic-package", {
    pluginId: plugin.pluginId,
    packageId: definition.packageId,
    pluginRunId: run.pluginRunId,
    name: definition.name,
  });
  attempt.host = {
    status: run.fiber === undefined ? "absent" : missingFor(ctx, run).length === 0 ? "running" : "waiting",
    waitingFor: missingFor(ctx, run),
  };
  if (definition.clientCode === undefined) {
    commitActivationOf(plugin, run);
  } else {
    attempt.status = "client-pending";
    attempt.client = { status: "pending", waitingFor: [] };
  }
  return {
    ok: true,
    pluginId: plugin.pluginId,
    packageId: definition.packageId,
    pluginRunId: run.pluginRunId,
    waitingFor: missingFor(ctx, run),
    startedHere: true,
  };
}

/**
 * Chốt MỘT kết cục Client cho run đang sống (hoặc ghi nhận từ chối).
 * Nhận: `ctx` — Context để đọc dịch vụ còn thiếu; `plugin` — Plugin liên quan (có thể đã bị gỡ);
 *        `resolution` — kết cục Client; `requestId` — yêu cầu nguồn.
 * Trả: phản hồi chạy đã cam kết hoặc thất bại nguyên văn.
 */
export async function settleActivationIn(
  ctx: Context,
  plugin: DynamicCordisPlugin | undefined,
  resolution: DynamicCordisRunResolution,
  requestId?: ApprovalRequestId,
): Promise<DynamicCordisRunResponse> {
  if (plugin === undefined)
    return { ok: false, reason: "plugin-missing", message: "the dynamic plugin was removed during activation" };
  const attempt = plugin.latestRun;
  if (!resolution.ok) {
    if (resolution.reason === "rejected") {
      if (attempt !== undefined) {
        attempt.status = "rejected";
        attempt.error = diagnosticOf(plugin, attempt, "approval", resolution.message ?? "the run request was declined");
        attempt.client = { status: "stopped", waitingFor: [] };
      }
      return { ok: false, reason: "rejected", message: resolution.message ?? "the run request was declined" };
    }
    const run = plugin.run;
    const ownsRun = run !== undefined
      && resolution.pluginRunId === run.pluginRunId
      && (requestId === undefined || run.startedForRequest === requestId)
      && resolution.startedHere !== false;
    if (ownsRun)
      await retractRun(ctx, plugin);
    if (attempt !== undefined && (resolution.pluginRunId === undefined || attempt.pluginRunId === resolution.pluginRunId)) {
      failAttemptOf(plugin, attempt, resolution.reason === "host-half-failed" ? "host-apply" : "client-apply", {
        message: resolution.message ?? resolution.reason,
        ...resolution.stack === undefined ? {} : { stack: resolution.stack },
      });
    }
    return {
      ok: false,
      reason: resolution.reason,
      message: resolution.message ?? resolution.reason,
      ...resolution.stack === undefined ? {} : { stack: resolution.stack },
    };
  }
  const run = plugin.run;
  if (run === undefined || run.pluginRunId !== resolution.pluginRunId) {
    return { ok: false, reason: "client-half-failed", message: `activation "${resolution.pluginRunId}" is no longer active` };
  }
  if (attempt !== undefined && attempt.pluginRunId === run.pluginRunId) {
    attempt.client = {
      status: resolution.waitingFor === undefined || resolution.waitingFor.length === 0 ? "running" : "waiting",
      waitingFor: resolution.waitingFor ?? [],
    };
  }
  commitActivationOf(plugin, run);
  return {
    ...runResponseOf(plugin, {
      ok: true,
      pluginId: plugin.pluginId,
      packageId: run.packageId,
      pluginRunId: run.pluginRunId,
      waitingFor: missingFor(ctx, run),
      startedHere: false,
    }),
    ...resolution.waitingFor === undefined ? {} : { clientWaitingFor: resolution.waitingFor },
  };
}

/**
 * Soạn câu steer khi một yêu cầu chạy model-driven đã kết thúc.
 * Nhận: `pending` — yêu cầu đã treo; `settled` — kết cục; `plugin` — Plugin liên quan (nếu còn).
 * Trả: văn bản NGUYÊN VĂN theo ba nhánh thành công/từ chối/thất bại của bản gốc.
 */
export function runOutcomeText(
  pending: DynamicCordisPendingRequest,
  settled: DynamicCordisRunResponse,
  plugin: DynamicCordisPlugin | undefined,
): string {
  const identity = `${pending.pluginId}/${pending.packageId} (${pending.pluginRunId})`;
  if (settled.ok) {
    return `Cordis ${pending.mode} ${identity} completed successfully. `
      + `currentPackageId is ${settled.currentPackageId ?? pending.packageId}. Continue using the running Plugin.`;
  }
  if (settled.reason === "rejected") {
    return `The user rejected Cordis ${pending.mode} ${identity}. `
      + "Do not request the same activation again unless the user asks.";
  }
  const returnedStatus = pending.requiresApproval ? "awaiting-approval" : "starting";
  return `Cordis ${pending.mode} ${identity} failed after the runner returned ${returnedStatus}: `
    + `${settled.reason}\n${formatErrorDetails(settled)}\n`
    + `currentPackageId: ${plugin?.currentPackageId ?? "none"}\n`
    + `nextPackageId: ${plugin?.nextPackageId ?? pending.packageId}\n`
    + "Report the failure to the user; the definition can be managed through the Cordis panel.";
}

/**
 * Soạn câu steer khi nửa Client hỏng lúc render sau khi đã kích hoạt.
 * Nhận: `plugin`/`definition`/`pluginRunId` — danh tính chính xác; `failure` — lỗi render.
 * Trả: văn bản NGUYÊN VĂN của bản gốc (slot, thông điệp, cờ abdicated).
 */
export function renderFailureText(
  plugin: DynamicCordisPlugin,
  definition: DynamicCordisDefinition,
  pluginRunId: CordisDynamicPluginRunId,
  failure: DynamicCordisRenderFailure,
): string {
  return `Cordis Client UI ${plugin.pluginId}/${definition.packageId} (${pluginRunId}) failed while rendering `
    + `Slot "${failure.slot}" after activation.\n`
    + `${formatErrorDetails(failure)}\n`
    + `entryAbdicated: ${failure.abdicated}\n`
    + "Report the Client render failure to the user; the definition can be stopped through the Cordis panel.";
}

/**
 * Soạn câu steer khi một Host handler ném trong lúc Client gọi.
 * Nhận: `plugin`/`run` — danh tính run; `method` — tên handler; `failure` — lỗi đã chuẩn hoá.
 * Trả: văn bản NGUYÊN VĂN của bản gốc.
 */
export function hostHandlerFailureText(
  plugin: DynamicCordisPlugin,
  run: DynamicCordisRun,
  method: string,
  failure: CordisErrorDetails,
): string {
  return `Cordis Host handler ${plugin.pluginId}/${run.packageId} (${run.pluginRunId}) failed when the Client called `
    + `host.call(${JSON.stringify(method)}).\n`
    + `${formatErrorDetails(failure)}\n`
    + "The Plugin remains running. Report the Host handler failure to the user. If the handler needs a Service, either declare "
    + "that Service in the returned Plugin inject list or read it with ctx.get(name) and handle undefined.";
}

/**
 * Soạn câu steer khi guard của một nền tảng từ chối mã lúc chạy.
 * Nhận: `plugin`/`run` — danh tính run; `platform` — nền tảng bị từ chối; `failure` — lỗi.
 * Trả: văn bản NGUYÊN VĂN của bản gốc.
 */
export function guardFailureText(
  plugin: DynamicCordisPlugin,
  run: DynamicCordisRun,
  platform: "Host" | "Client",
  failure: CordisErrorDetails,
): string {
  return `Cordis ${platform} guard rejected runtime code in ${plugin.pluginId}/${run.packageId} `
    + `(${run.pluginRunId}) after activation.\n${formatErrorDetails(failure)}\n`
    + "The Plugin remains running. Report the guard rejection to the user; it can be stopped through the Cordis panel.";
}

/**
 * Soạn câu inject khi NGƯỜI DÙNG chạy tay một Plugin từ panel.
 * Nhận: `pluginId` — Plugin vừa chạy; `settled` — kết cục; `plugin` — Plugin sau khi chạy (nếu còn).
 * Trả: văn bản NGUYÊN VĂN theo hai nhánh thành công/thất bại của bản gốc.
 */
export function userRunOutcomeText(
  pluginId: CordisDynamicPluginId,
  settled: DynamicCordisRunResponse,
  plugin: DynamicCordisPlugin | undefined,
): string {
  if (settled.ok) {
    return `The user manually ran Cordis Plugin ${pluginId}, Package ${settled.packageId}, `
      + `as ${settled.pluginRunId}. The activation succeeded; currentPackageId is ${settled.currentPackageId}.`;
  }
  const attempt = plugin?.latestRun;
  return `The user manually ran Cordis Plugin ${pluginId}`
    + `${attempt === undefined ? "" : `, Package ${attempt.packageId}, as ${attempt.pluginRunId}`}, but it failed: `
    + `${settled.reason}\n${formatErrorDetails(settled)}\n`
    + `currentPackageId: ${plugin?.currentPackageId ?? "none"}\n`
    + `nextPackageId: ${plugin?.nextPackageId ?? "none"}`;
}
