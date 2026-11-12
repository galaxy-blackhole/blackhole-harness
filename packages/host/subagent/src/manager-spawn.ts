/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cụm SPAWN/FORK của manager subagent: thu nạp yêu cầu, dành danh tính con, hiện thực hoá
 *      Activation cục bộ (tạo mới hoặc resume nguội) và khởi chạy backend ngoài. Tách từ
 *      lib/types/manager.js (1.315 dòng); giữ nguyên tên hàm, logic, chuỗi lỗi của bản gốc.
 */

import { randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import type { Agent, AgentHandle, AgentOptions, CreateAgentOptions } from "@galaxy-blackhole/gbh-agent";
import type {} from "@galaxy-blackhole/gbh-agent-preset-registry";
import { brandString } from "@deepseek-ai/dsh-brand";
import { ReasoningEffortId, contentHasImage, createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, MessageId } from "@deepseek-ai/dsh-llm";
import { SessionLogOffset } from "@galaxy-blackhole/gbh-session";
import type { Session, SessionEvent, SessionId } from "@galaxy-blackhole/gbh-session";
import type { SessionPersistence } from "@deepseek-ai/dsh-session-persistence";
import type { SessionObservation, SessionQueryEngine } from "@deepseek-ai/dsh-session-query";
import type { ObjectJsonSchema } from "@galaxy-blackhole/gbh-host-tools";
import type {} from "@galaxy-blackhole/gbh-working-directory";

import {
  activationAgent,
  observeLocalFailure,
  requireLocalActivation,
  type Activation,
  type ActivationPool,
  type ActivationResource,
} from "./activation.ts";
import { establishCatalogChild, establishExternalCatalogChild } from "./catalog.ts";
import {
  appendDelegatedPolicyOverrides,
  applyChildComposition,
  captureDelegatedPolicyOverrides,
  childSessionMeta,
  resolveChildAgentOptions,
  resolveChildDepth,
  type ChildComposition,
  type DelegatedPolicyOverrides,
} from "./child-agent.ts";
import { createAgentMessage, withContinuableReturnGuidance } from "./continuation-messages.ts";
import { assertSubagentMaxDepth } from "./depth.ts";
import {
  foldSubagentDescriptor,
  snapshotSubagentDescriptor,
  type ContinuableSubagentDescriptorData,
  type SubagentDescriptorLogEvent,
} from "./descriptor.ts";
import { SubagentError } from "./error.ts";
import { isAdjacentAgentSendMessageTool } from "./internal.ts";
import {
  acquireOwnership,
  announce,
  assertAdmitting,
  deliver,
  dispose,
  failureMessage,
  holdOwnership,
  liveLineage,
  rollbackUnpublished,
  rootPool,
  wake,
} from "./manager-lifecycle.ts";
import type { ManagerState, SubagentDeliveryOptions } from "./manager.ts";
import { attachStructuredRuntime, type StructuredAttachment } from "./structured.ts";
import type {
  SubagentActivation,
  SubagentActivationSpec,
  SubagentResult,
  SubagentRun,
  SubagentStartRequest,
} from "./types.ts";

/** Phần dùng chung của một yêu cầu hiện thực hoá Activation. */
interface MaterializeBase {
  /** Danh tính con bền đã dành sẵn (hoặc id tạm với backend ngoài). */
  readonly childId: SessionId;
  /** Tên provider đã đăng ký. */
  readonly provider: string;
  /** Agent cha đang sống sở hữu epoch. */
  readonly parent: Agent;
  /** Huỷ của bên gọi, chỉ sở hữu tới lúc con cư trú. */
  readonly signal: AbortSignal;
  /** Chính sách giao kết quả; bỏ trống thì mặc định `parent`. */
  readonly delivery?: "parent" | "caller";
}

/** Đầu vào hiện thực hoá một con CỤC BỘ (tạo mới, hoặc resume nguội khi vắng `create`). */
interface LocalMaterializeInputs extends MaterializeBase {
  /** Nhánh thực thi cục bộ. */
  readonly kind: "local";
  /** Dữ liệu tạo mới; vắng mặt nghĩa là resume nguội một phiên đã lưu. */
  readonly create?: {
    /** Thư mục tuyệt đối đã chụp trước khi hiện thực hoá. */
    readonly cwd: string;
    /** Tiền tố lượt cha đã đóng để mồi phiên con, nếu provider có gieo. */
    readonly seed: readonly SessionEvent[] | undefined;
    /** Metadata tạo phiên bền của con. */
    readonly meta: NonNullable<CreateAgentOptions["meta"]>;
    /** Số sự kiện thừa hưởng từ log cha. */
    readonly inheritedEventCount: SessionLogOffset;
    /** Chính sách uỷ nhiệm đã chụp đồng bộ trước `await` đầu tiên. */
    readonly delegatedPolicies: DelegatedPolicyOverrides;
    /** Descriptor continuable đã đóng băng. */
    readonly descriptor: ContinuableSubagentDescriptorData;
  };
  /** Tuỳ chọn route của con đã phân giải. */
  readonly agentOptions: AgentOptions;
  /** Bố cục con áp trong cửa sổ tạo. */
  readonly composition: ChildComposition;
  /** Schema kết quả có cấu trúc, khi được yêu cầu. */
  readonly outputSchema?: ObjectJsonSchema;
}

/** Đầu vào hiện thực hoá một lần thi hành BÊN NGOÀI do provider cấp handle. */
interface ExternalMaterializeInputs extends MaterializeBase {
  /** Nhánh thực thi bên ngoài. */
  readonly kind: "external";
  /** Khởi chạy backend ngoài dưới tín hiệu khởi động riêng. */
  readonly start: (signal: AbortSignal) => Promise<SubagentRun>;
}

/** Hợp của hai nhánh hiện thực hoá. */
type MaterializeInputs = LocalMaterializeInputs | ExternalMaterializeInputs;

/**
 * Mặt cắt CẤU TRÚC của `Session.append` cho event `subagent/descriptor`.
 *
 * Bản gốc cộng gộp `SessionEventMap`; repo CẤM ambient shim (ADR 000d) nên module anh em
 * `./descriptor.ts` khai event theo cấu trúc và KHÔNG cộng gộp. Mặt cắt này giữ đúng một lời gọi
 * ghi event với payload descriptor đã đóng băng.
 */
interface DescriptorEventAppendSeam {
  /**
   * Ghi một event `subagent/descriptor` vào log phiên con.
   * Nhận: `type` — tên event cố định; `data` — payload descriptor đã đóng băng.
   * Trả: event vừa ghi (không dùng tới).
   */
  append(type: "subagent/descriptor", data: unknown): unknown;
}

/**
 * Chạy một lần START CỤC BỘ cho con continuable và trả về ngay khi prompt đầu tiên được hộp thư nhận.
 * Mọi hỏng trước đó đều dọn handle đã tạo và quay lui Activation + ownership của cha, không trả id nào.
 * Nhận: `state` — mặt cắt trạng thái của manager; `spec` — provider, yêu cầu uỷ nhiệm, huỷ của bên gọi.
 * Trả: danh tính con bền và id tin nhắn prompt đầu đã được nhận.
 */
export async function startLocal(
  state: ManagerState,
  spec: SubagentActivationSpec,
): Promise<SubagentActivation & { messageId: MessageId }> {
  const request = spec.request;
  const parent = request.parent;
  assertAdmitting(state, parent);
  const persistence = spec.delivery === "caller" ? state.ctx.get("sessionPersistence") : requirePersistence(state);
  assertSubagentMaxDepth(request.maxDepth);
  const childId = spec.childId ?? brandString<SessionId>(randomUUID());
  assertChildIdAvailable(state, childId);
  const childDepth = resolveChildDepth(parent, request.maxDepth);
  // Snapshot before any await: invalid descriptor JSON rejects the call
  // before a child exists, and the detached value is what reaches the log.
  const agentOptions = resolveChildAgentOptions(parent, request.agentOptions, childDepth);
  const agentProvider = agentOptions.provider;
  const agentModel = agentOptions.model;
  const agentReasoningEffort = agentOptions.reasoningEffort;
  // Ban port khai `agentOptions` theo cau truc; kernel khai hop rong hon => ep TAI BIEN mot lan.
  const descriptor = snapshotSubagentDescriptor({
    mode: "continuable",
    provider: spec.provider,
    label: spec.label,
    ...(agentProvider !== undefined ? { agentProvider } : {}),
    ...(agentModel !== undefined ? { agentModel } : {}),
    ...(agentReasoningEffort !== undefined ? { agentReasoningEffort } : {}),
  } as unknown as Parameters<typeof snapshotSubagentDescriptor>[0]);
  // Capture before the first await: a later parent switch belongs to the
  // parent's future, not to this child.
  const delegatedPolicies = captureDelegatedPolicyOverrides(parent);
  // An idle continuation-managed parent must not settle while a caller is
  // still creating its child. A turn-scoped delegation does not need this,
  // but the service is also callable outside a turn.
  const releaseHold = holdOwnership(state, parent, childId);
  try {
    const cwd = await resolveDirectory(state, request, spec.signal);
    const prepared = await state.host.prepareContinuable(spec.provider, {
      sessionId: childId,
      cwd,
      parent,
      signal: spec.signal,
    });
    spec.signal.throwIfAborted();
    assertAdmitting(state, parent);
    const inheritedEventCount = SessionLogOffset(prepared.seed?.length ?? 0);
    const seed = prepared.seed;
    let established: Activation | undefined;
    const messageId = await state.locks.run(childId, async () => {
      spec.signal.throwIfAborted();
      assertAdmitting(state, parent);
      assertChildIdAvailable(state, childId);
      if (spec.childId !== undefined) {
        const persisted = await persistence?.stat(childId, { signal: spec.signal });
        spec.signal.throwIfAborted();
        assertAdmitting(state, parent);
        assertChildIdAvailable(state, childId);
        if (persisted !== undefined) {
          throw new SubagentError(`subagent "${childId}" already exists`, "DUPLICATE_CHILD");
        }
      }
      const activation = await materialize(state, {
        kind: "local",
        childId,
        provider: spec.provider,
        parent,
        create: {
          cwd,
          seed,
          meta: childSessionMeta(parent, childDepth, prepared.seed !== undefined, request.agentPreset),
          inheritedEventCount,
          delegatedPolicies,
          descriptor,
        },
        agentOptions,
        composition: { agentPreset: request.agentPreset },
        signal: spec.signal,
        delivery: spec.delivery,
        outputSchema: request.outputSchema,
      });
      established = activation;
      const child = requireLocalActivation(activation).handle.agent;
      const childHeader = child.session.header;
      return await submitMaterialized(
        state,
        activation,
        spec.delivery !== "caller"
          // `ctx.get("tools")` la seam cua KERNEL: `get(id, agent)` nhan `Agent` cua kernel => ep tai bien.
          && isAdjacentAgentSendMessageTool((state.ctx.get("tools") as unknown as { get(name: string, agent: unknown): Parameters<typeof isAdjacentAgentSendMessageTool>[0] } | undefined)?.get("send_message", child))
          ? withContinuableReturnGuidance(parent.id, request.prompt)
          : request.prompt,
        { source: { kind: "user" }, signal: spec.signal, delivery: "queue" },
        parent,
        () => {
          // Seam catalog cua kernel nhan `Session`; ban port dung `AgentSession` (cung hinh dang runtime) => ep tai bien.
          establishCatalogChild(parent.session as unknown as Parameters<typeof establishCatalogChild>[0], childHeader, descriptor);
        },
      );
    });
    return { ...receipt(state, established!), childId, messageId };
  } catch (error) {
    releaseHold();
    throw error;
  }
}

/**
 * Khởi chạy một backend NGOÀI dưới quyền sở hữu Activation.
 * Nhận: `state` — mặt cắt trạng thái; `spec` — tác vụ, provider, huỷ, và chính sách giao kết quả.
 * Trả: Activation đã được nhận cùng năng lực kết quả/dọn dẹp của nó.
 */
export async function startExternal(
  state: ManagerState,
  spec: SubagentActivationSpec,
): Promise<SubagentActivation> {
  const parent = spec.request.parent;
  assertAdmitting(state, parent);
  const pendingId = brandString<SessionId>(randomUUID());
  const releaseHold = holdOwnership(state, parent, pendingId);
  let activation: Activation | undefined;
  try {
    const cwd = await resolveDirectory(state, spec.request, spec.signal);
    activation = await materialize(state, {
      kind: "external",
      childId: pendingId,
      provider: spec.provider,
      parent,
      signal: spec.signal,
      delivery: spec.delivery,
      start: (signal) =>
        state.host.startExternal(spec.provider, {
          ...spec.request,
          cwd,
          label: spec.label,
          signal,
        }),
    });
    assertAdmitting(state, parent);
    assertLiveParent(state, parent, activation.childId);
    spec.signal.throwIfAborted();
    if (spec.delivery === "parent") {
      establishExternalCatalogChild(parent.session as unknown as Parameters<typeof establishExternalCatalogChild>[0], activation.childId, spec.label);
    }
    announce(state, activation);
    return receipt(state, activation);
  } catch (error) {
    if (activation !== undefined) {
      try {
        await dispose(state, activation);
      } catch (cleanupError) {
        state.ctx.logger.warn(
          `subagent "${activation.childId}" admission rollback failed: ${failureMessage(cleanupError)}`,
        );
      }
    }
    throw error;
  } finally {
    releaseHold();
  }
}

/**
 * Chụp thư mục tường minh hoặc thừa hưởng trong lúc cha còn sở hữu khởi động.
 * Nhận: `state` — mặt cắt trạng thái; `request` — yêu cầu uỷ nhiệm; `signal` — huỷ của bên gọi.
 * Trả: thư mục tuyệt đối của con.
 */
async function resolveDirectory(
  state: ManagerState,
  request: Omit<SubagentStartRequest, "label" | "signal">,
  signal: AbortSignal,
): Promise<string> {
  const cwd = request.cwd !== undefined && isAbsolute(request.cwd)
    ? request.cwd
    // `workingDirectory` la seam cua kernel: ban port gbh-agent khong khai augmentation tren `Context` => doc qua mat cau truc.
    : resolve(await (state.ctx as unknown as { readonly workingDirectory: { ensure(agent: unknown, signal: AbortSignal): Promise<string> } }).workingDirectory.ensure(request.parent, signal), request.cwd ?? ".");
  signal.throwIfAborted();
  return cwd;
}

/**
 * Từ chối một danh tính con đã thuộc về Agent hoặc Session đang sống.
 * Nhận: `state` — mặt cắt trạng thái; `childId` — id phiên con bền được đề xuất.
 * Trả: không trả gì; ném `SubagentError` mã `DUPLICATE_CHILD` khi id đã tồn tại.
 */
function assertChildIdAvailable(state: ManagerState, childId: SessionId): void {
  if (
    state.resident.has(childId)
    || state.ctx.agents.get(childId) !== undefined
    || state.ctx.get("sessions")?.get(childId) !== undefined
  ) {
    throw new SubagentError(`subagent "${childId}" already exists`, "DUPLICATE_CHILD");
  }
}

/**
 * Cấp quyền cho một thao tác dựa trên dòng dõi cha trực tiếp bền vững.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — Agent đang sống nhận quyền cha trực tiếp;
 *   `childId` — con bền mà thao tác nhắm tới; `parentSession` — id cha trực tiếp đã ghi trên con.
 * Trả: không trả gì; ném `SubagentError` mã `UNAUTHORIZED` khi quyền không khớp.
 */
function authorizeLineage(state: ManagerState, parent: Agent, childId: SessionId, parentSession: SessionId | undefined): void {
  assertLiveParent(state, parent, childId);
  if (parentSession !== parent.id) {
    throw new SubagentError(`subagent "${childId}" belongs to another parent session`, "UNAUTHORIZED");
  }
}

/**
 * Từ chối quyền cha sau khi mục trong sổ đăng ký sống đã đổi.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — Agent tự nhận quyền cha; `childId` — con được nhắm.
 * Trả: không trả gì; ném `SubagentError` mã `UNAUTHORIZED` khi `parent` không còn đúng mục đăng ký.
 */
/**
 * Mặt cấu trúc của sổ agent KERNEL mà manager chạm tới (chỉ `create`/`resume`).
 * 08/11/2026 (dev-1): bản port đóng gói `Agent` của gói GBH, kernel thì dùng `Agent` của nó — hai kiểu KHÁC danh tính
 * nhưng CÙNG hình dạng runtime, nên tại BIÊN gọi kernel ta đi qua mặt cấu trúc thay vì ép từng trường.
 */
interface KernelAgentsLike {
  /** Tạo một agent con. */
  create(options: Record<string, unknown>): Promise<unknown>;
  /** Nạp lại một agent từ phiên bền. */
  resume(options: Record<string, unknown>): Promise<unknown>;
}

function assertLiveParent(state: ManagerState, parent: Agent, childId: SessionId): void {
  // `ctx.agents.get` tra `Agent` cua KERNEL; `parent` la `Agent` cua goi GBH (cung hinh dang runtime) => ep tai bien.
  if ((state.ctx.agents.get(parent.id) as unknown as Agent | undefined) !== parent) {
    throw new SubagentError(`subagent "${childId}" delivery requires the exact live parent agent`, "UNAUTHORIZED");
  }
}

/**
 * Tạo hoặc resume MỘT Agent con rồi công bố Activation của nó.
 * Nhận: `state` — mặt cắt trạng thái; `inputs` — đầu vào tái dựng và thu nạp cho epoch cư trú.
 * Trả: Activation đã công bố, cục bộ theo tiến trình.
 */
function materialize(state: ManagerState, inputs: MaterializeInputs): Promise<Activation> {
  assertAdmitting(state, inputs.parent);
  inputs.signal.throwIfAborted();
  const lineage = liveLineage(state, inputs.parent);
  const pool = state.resident.get(inputs.parent.id)?.pool ?? rootPool(state, inputs.parent);
  const releaseSlot = pool.reserve(state.maxActiveSubagents());
  const settled = Promise.withResolvers<void>();
  const controller = new AbortController();
  const materialization = { lineage, settled: settled.promise, controller };
  state.materializations.add(materialization);
  return materializeTracked(
    state,
    { ...inputs, signal: AbortSignal.any([inputs.signal, controller.signal]) },
    lineage,
    pool,
    releaseSlot,
  ).catch((error) => {
    releaseSlot();
    if (error instanceof Error && error.name === "AbortError") assertAdmitting(state, inputs.parent);
    throw error;
  }).finally(() => {
    state.materializations.delete(materialization);
    settled.resolve();
  });
}

/**
 * Thực hiện MỘT lần hiện thực hoá có theo dõi, xuyên suốt công bố hoặc quay lui.
 * Nhận: `state` — mặt cắt trạng thái; `inputs` — đầu vào đã ghép tín hiệu huỷ; `parentLineage` —
 *   dòng dõi sống đã chụp; `pool` — bể khe dùng chung; `releaseSlot` — hàm nhả khe của epoch.
 * Trả: Activation đã cư trú.
 * Ném: `SubagentError` mã `UNAUTHORIZED` khi cha rời sổ trong lúc hiện thực hoá.
 */
async function materializeTracked(
  state: ManagerState,
  inputs: MaterializeInputs,
  parentLineage: readonly Agent[],
  pool: ActivationPool,
  releaseSlot: () => void,
): Promise<Activation> {
  const { provider, parent } = inputs;
  let childId = inputs.childId;
  inputs.signal.throwIfAborted();
  let resource: ActivationResource;
  if (inputs.kind === "external") {
    const controller = new AbortController();
    const cancelStartup = () => {
      controller.abort(inputs.signal.reason);
    };
    inputs.signal.addEventListener("abort", cancelStartup, { once: true });
    try {
      const run = await inputs.start(controller.signal);
      resource = { kind: "external", run, controller };
      void run.result.catch(() => undefined);
      childId = run.id;
      try {
        assertChildIdAvailable(state, childId);
      } catch (error) {
        await run.dispose();
        throw error;
      }
    } finally {
      inputs.signal.removeEventListener("abort", cancelStartup);
    }
  } else {
    const { create } = inputs;
    let structured: StructuredAttachment | undefined;
    const setup = async (childCtx: Context, child: Agent): Promise<void> => {
      // Only fresh creation appends the descriptor and delegated policy after
      // the inherited marker; a cold resume replays those persisted events.
      if (inputs.composition.agentPreset !== undefined) {
        await applyChildComposition(childCtx, parent, inputs.composition);
      }
      if (create !== undefined) {
        if (inputs.composition.agentPreset !== undefined) {
          // `append` co trong runtime cua kernel nhung khong khai tren `AgentSession` cua ban port => goi qua mat cau truc.
          (child.session as unknown as { append(type: string, data: unknown): void }).append("agent-preset/selected", { agentPreset: inputs.composition.agentPreset });
        }
        appendDescriptor(child.session as unknown as Parameters<typeof appendDescriptor>[0], create.descriptor);
        appendDelegatedPolicyOverrides(child.session as unknown as Parameters<typeof appendDelegatedPolicyOverrides>[0], create.delegatedPolicies);
        const workingDirectory = childCtx.get("workingDirectory");
        if (workingDirectory === undefined) {
          throw new Error("local subagents require the working-directory service");
        }
        // `workingDirectory.set` nhan `Agent` cua kernel; `child` la `Agent` cua goi GBH => ep tai bien.
        await (workingDirectory as unknown as { set(agent: unknown, cwd: string, signal: AbortSignal): Promise<void> }).set(child, create.cwd, inputs.signal);
      }
      if (inputs.composition.agentPreset === undefined) {
        await applyChildComposition(childCtx, parent, inputs.composition);
      }
      if (inputs.outputSchema !== undefined) {
        structured = attachStructuredRuntime(
          childCtx,
          inputs.outputSchema,
          () =>
            state.resident.get(childId)?.ownedChildren.size === 0
            && child.inbox.nextStep.length === 0
            && child.inbox.nextTurn.length === 0,
        );
      }
    };
    const handle = create === undefined
      ? await (state.ownerCtx.agents as unknown as KernelAgentsLike).resume({
        resumeSessionId: childId,
        parentAgent: parent,
        agentOptions: inputs.agentOptions,
        signal: inputs.signal,
        setup,
      }) as unknown as AgentHandle
      : await (state.ownerCtx.agents as unknown as KernelAgentsLike).create({
        sessionId: childId,
        parentAgent: parent,
        meta: create.meta,
        ...(create.seed === undefined ? {} : { seed: create.seed }),
        inheritedEventCount: create.inheritedEventCount,
        agentOptions: inputs.agentOptions,
        signal: inputs.signal,
        setup,
      });
    const typedHandle = handle as unknown as AgentHandle;
    resource = {
      kind: "local",
      handle: typedHandle,
      outputStart: typedHandle.agent.session.seq,
      structured,
      failureAt: undefined,
      poke: Promise.withResolvers<void>(),
    };
  }
  const observer = state.host.observeActivation(provider, childId, parent);
  const activation: Activation = {
    pool,
    releaseSlot,
    childId,
    ...resource,
    parent,
    delivery: inputs.delivery ?? "parent",
    result: Promise.withResolvers<SubagentResult>(),
    closing: undefined,
    ancestry: new WeakSet<Agent>(
      resource.kind === "external" ? [...parentLineage] : [resource.handle.agent, ...parentLineage],
    ),
    ownedChildren: new Set<SessionId>(),
    observer,
    announced: false,
  };
  void activation.result.promise.catch(() => undefined);
  state.resident.set(childId, activation);
  try {
    assertAdmitting(state, parent);
    inputs.signal.throwIfAborted();
    if ((state.ctx.agents.get(parent.id) as unknown as Agent | undefined) !== parent) {
      throw new SubagentError("subagent parent is no longer live", "UNAUTHORIZED");
    }
    acquireOwnership(state, parent, childId);
    const wakeSettlement = () => {
      wake(activation);
    };
    if (activation.kind === "local") {
      observeLocalFailure(activation, wakeSettlement);
      activation.handle.agent.ctx.on("agent/inbox/inserted", wakeSettlement);
      activation.handle.agent.ctx.on("agent/inbox/claimed", wakeSettlement);
      activation.handle.agent.ctx.on("agent/inbox/discarded", wakeSettlement);
    }
    observer.start(activationAgent(activation));
  } catch (error) {
    /* v8 ignore next -- rollback failure must not mask the admission failure
     * that prevented this operation from returning an accepted message id. */
    await rollbackUnpublished(state, activation, error).catch(() => undefined);
    throw error;
  }
  return activation;
}

/**
 * Ghi payload descriptor đã đóng băng vào log con qua mặt cắt cấu trúc.
 * Nhận: `session` — Session con chưa công bố; `descriptor` — payload continuable đã đóng băng.
 * Trả: không trả gì.
 */
function appendDescriptor(session: Session, descriptor: ContinuableSubagentDescriptorData): void {
  (session as unknown as DescriptorEventAppendSeam).append("subagent/descriptor", descriptor);
}

/**
 * Dịch nóng (cold-resume) một con đã lưu rồi giao lượt đang chờ. Descriptor cấp mọi đầu vào tái dựng;
 * KHÔNG provider subagent nào được điều động.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp đang sống; `childId` — con bền cần resume;
 *   `content` — khối nội dung cần giao; `options` — huỷ của bên gọi và chính sách giao.
 * Trả: id tin nhắn đã được hộp thư nhận.
 * Ném: `SubagentError` mã `NOT_RESUMABLE` khi con không quan sát được hoặc thiếu trạng thái tiếp nối.
 */
export async function coldResume(
  state: ManagerState,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  options: SubagentDeliveryOptions,
): Promise<MessageId> {
  const query = requireSessionQuery(state);
  let observation: SessionObservation;
  try {
    observation = await query.observeSession(childId, { signal: options.signal });
  } catch (error) {
    options.signal.throwIfAborted();
    throw new SubagentError(`subagent "${childId}" is unavailable`, "NOT_RESUMABLE", { cause: error });
  }
  using source = observation;
  assertAdmitting(state, parent);
  authorizeLineage(state, parent, childId, source.header.parentSession);
  const ownEvents = source.events.slice(source.inheritedEventCount);
  const descriptor = foldSubagentDescriptor(ownEvents);
  if (descriptor === undefined || descriptor.mode !== "continuable") {
    throw new SubagentError(
      `subagent "${childId}" has no supported continuation state and cannot be resumed; choose a different target`,
      "NOT_RESUMABLE",
    );
  }
  let activation: Activation;
  try {
    const independentlySelected = hasIndependentPresetSelection(ownEvents);
    // `SessionProjectionMap` cua kernel khai dong; ban port chi can truong `agentPreset` => doc qua mat cau truc.
    const projections = source.projections as unknown as { readonly values?: { readonly agentPreset?: string } } | undefined;
    const agentPreset = independentlySelected ? projections?.values?.agentPreset : undefined;
    if (independentlySelected && typeof agentPreset !== "string") {
      throw new SubagentError(`subagent "${childId}" has no agent preset projection for restoration`, "NOT_RESUMABLE");
    }
    activation = await materialize(state, {
      kind: "local",
      childId,
      provider: descriptor.provider,
      parent,
      agentOptions: {
        ...(descriptor.agentProvider !== undefined ? { provider: descriptor.agentProvider } : {}),
        ...(descriptor.agentModel !== undefined ? { model: descriptor.agentModel } : {}),
        ...(descriptor.agentReasoningEffort !== undefined
          ? { reasoningEffort: ReasoningEffortId(descriptor.agentReasoningEffort) }
          : {}),
      },
      composition: {
        agentPreset: agentPreset ?? undefined,
        persona: descriptor.persona,
        toolFilter: descriptor.toolFilter,
      },
      signal: options.signal,
    });
  } catch (error) {
    options.signal.throwIfAborted();
    if (error instanceof SubagentError) throw error;
    throw new SubagentError(`subagent "${childId}" is unavailable`, "NOT_RESUMABLE", { cause: error });
  }
  return await submitMaterialized(state, activation, content, options, parent);
}

/**
 * Nhận một con vừa hiện thực hoá, cam kết sự kiện tạo của nó, và giải phóng con khi hỏng.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — con vừa hiện thực hoá; `content` — khối nội dung;
 *   `options` — huỷ và chính sách giao; `parent` — cha trực tiếp đang sống; `commit` — cam kết
 *   sự kiện tạo (ví dụ ghi danh mục) chạy sau khi hộp thư nhận.
 * Trả: id tin nhắn đã được nhận.
 */
async function submitMaterialized(
  state: ManagerState,
  activation: Activation,
  content: ContentBlock[],
  options: SubagentDeliveryOptions,
  parent: Agent,
  commit?: () => void,
): Promise<MessageId> {
  try {
    if (contentHasImage(content)) {
      await assertImageCapable(state, requireLocalActivation(activation).handle.agent, options.signal);
      if (activation.closing !== undefined) {
        throw new SubagentError(`subagent "${activation.childId}" is closing`, "ACTIVATION_CLOSING");
      }
    }
    const messageId = submitAdmitted(state, activation, content, options, parent);
    commit?.();
    announce(state, activation);
    return messageId;
  } catch (error) {
    try {
      await dispose(state, activation);
    } catch (cleanupError) {
      state.ctx.logger.warn(
        `subagent continuation: disposal after admission or catalog append failure also failed: ${String(cleanupError)}`,
      );
    }
    throw error;
  }
}

/**
 * Dựng và giao MỘT tin nhắn xuyên qua điểm cắt thu nạp ĐỒNG BỘ cuối cùng.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — lượt nhận giao phẩm; `content` — khối nội dung;
 *   `options` — nguồn bền, huỷ, và đích hộp thư; `parent` — cha trực tiếp đang sống.
 * Trả: id bền của tin nhắn đã dựng.
 */
export function submitAdmitted(
  state: ManagerState,
  activation: Activation,
  content: ContentBlock[],
  options: SubagentDeliveryOptions,
  parent: Agent,
): MessageId {
  const message = options.source === undefined
    ? createAgentMessage(parent, content)
    : createUserMessage({ content, source: options.source });
  options.signal.throwIfAborted();
  assertAdmitting(state, parent);
  authorizeLineage(state, parent, activation.childId, activation.parent.id);
  acquireOwnership(state, parent, activation.childId);
  try {
    deliver(activation, message, options.delivery);
  } finally {
    wake(activation);
  }
  return message.id;
}

/**
 * Từ chối nội dung ảnh với con có model cố định chỉ nhận văn bản.
 * Nhận: `state` — mặt cắt trạng thái; `agent` — Agent con đích; `signal` — huỷ của bên gọi.
 * Trả: không trả gì khi model nhận ảnh (hoặc không khai modality).
 * Ném: `SubagentError` mã `MODEL_DOES_NOT_SUPPORT_IMAGES` khi route cố định không nhận ảnh.
 */
export async function assertImageCapable(state: ManagerState, agent: Agent, signal: AbortSignal): Promise<void> {
  const { provider, model } = agent.options;
  if (provider === undefined || model === undefined) return;
  const llm = state.ctx.get("llm");
  /* v8 ignore next -- without an LLM registry, delivery defers to projection. */
  if (llm === undefined) return;
  const info = await llm.resolveModelInfo(provider, model, signal);
  if (info.inputModalities !== undefined && !info.inputModalities.includes("image")) {
    throw new SubagentError(`Model "${model}" does not support image input.`, "MODEL_DOES_NOT_SUPPORT_IMAGES");
  }
}

/**
 * Phân giải dịch vụ lưu trữ mà con continuable cần, hoặc hỏng TO TIẾNG.
 * Nhận: `state` — mặt cắt trạng thái.
 * Trả: dịch vụ `sessionPersistence` đang đăng ký.
 * Ném: `SubagentError` mã `PERSISTENCE_UNAVAILABLE` khi chưa nạp backend lưu trữ.
 */
function requirePersistence(state: ManagerState): SessionPersistence {
  const persistence = state.ctx.get("sessionPersistence");
  if (persistence === undefined) {
    throw new SubagentError(
      "continuable subagents require session persistence (load a dsh-session-persistence backend)",
      "PERSISTENCE_UNAVAILABLE",
    );
  }
  return persistence;
}

/**
 * Phân giải dịch vụ truy vấn Session dùng cho quan sát con nguội.
 * Nhận: `state` — mặt cắt trạng thái.
 * Trả: dịch vụ `sessionQuery` đang đăng ký.
 * Ném: `SubagentError` mã `CONTINUATION_UNAVAILABLE` khi chưa nạp gói truy vấn.
 */
function requireSessionQuery(state: ManagerState): SessionQueryEngine {
  const query = state.ctx.get("sessionQuery");
  if (query === undefined) {
    throw new SubagentError(
      "continuable subagents require session query (load @deepseek-ai/dsh-session-query)",
      "CONTINUATION_UNAVAILABLE",
    );
  }
  return query;
}

/**
 * Trả năng lực gắn với ĐÚNG Activation này thay vì một thực thể cùng id trong tương lai.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — epoch cần cấp năng lực.
 * Trả: danh tính con, lời hứa kết quả, và `dispose` nhắm đúng epoch.
 */
function receipt(state: ManagerState, activation: Activation): SubagentActivation {
  return {
    childId: activation.childId,
    result: activation.result.promise,
    dispose: () => dispose(state, activation),
  };
}

/**
 * Cho biết log con có chọn preset ĐỘC LẬP trước descriptor của chính nó hay không; fork lịch sử có thể
 * chọn sau descriptor.
 * Nhận: `events` — các sự kiện riêng của epoch con.
 * Trả: `true` khi gặp `agent-preset/selected` trước `subagent/descriptor`.
 */
function hasIndependentPresetSelection(events: readonly SubagentDescriptorLogEvent[]): boolean {
  for (const event of events) {
    if (event.type === "subagent/descriptor") return false;
    if (event.type === "agent-preset/selected") return true;
  }
  /* v8 ignore next -- coldResume rejects logs without a supported own descriptor before this lookup. */
  return false;
}
