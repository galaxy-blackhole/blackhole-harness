/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc MẶT PLUGIN của row: `inject`, phép chuẩn bị baseline + đối soát động và `apply` nối vòng đời —
 *      port 1:1 vùng index (stock lib/index.js 1184–1446 = region lib/types/index.js).
 *      PHASE B (08/11/2026): đổi nguồn KIỂU `ToolExecution`/`ToolExecutionToken` sang
 *      `@galaxy-blackhole/gbh-host-tools` (ADR 000d) — tệp không đọc sổ tool nên không cần seam.
 */
import { isDeepStrictEqual } from "node:util";
import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { FileSystem } from "@deepseek-ai/dsh-fs";
import { type ContentBlock, createUserMessage, type UserMessage } from "@deepseek-ai/dsh-llm";
import type { Session } from "@deepseek-ai/dsh-session";
import type {} from "@deepseek-ai/dsh-session-projection";
// PHASE B chặng 1 (08/11/2026, dev-1): thay vì mượn kiểu của gói GBH (làm gập hợp đồng danh tính với bản đồ
// `Events` mà kernel cấp), tệp khai SEAM CẤU TRÚC tại chỗ — đúng khuôn ADR 000d, không đổi runtime.
// Bản đồ `Events` vẫn do @deepseek-ai/dsh-tools khai (R6b augmentation) ⇒ nạp kiểu rỗng để giữ `ctx.on("tools/result", …)`.
import type {} from "@deepseek-ai/dsh-tools";

/**
 * Seam CẤU TRÚC của MỘT lượt thực thi tool (ADR 000d — PHASE B 08/11/2026, dev-1): chỉ khai đúng phần tệp này đọc,
 * nhờ vậy listener `tools/result` nhận kiểu do kernel cấp mà không phải mượn kiểu của gói GBH.
 */
interface ToolExecutionLike {
  /** Tên tool được gọi (dùng để lọc tool chạm tệp). */
  readonly name: string;
  /** Tham số của lượt gọi; chỉ đọc `file_path`. */
  readonly arguments?: unknown;
  /** Token định danh lượt — cũng là khoá sổ gom "chạm tệp" (kiểu brand do kernel cấp, đối xử như khoá bất biến). */
  readonly token: unknown;
  /** Agent sở hữu lượt; vắng khi lượt do máy chủ phát. */
  readonly agent?: Agent;
  /** Tín hiệu huỷ của lượt. */
  readonly signal: AbortSignal;
  /** Token của lượt CHA khi đây là subagent (cùng kiểu brand với {@link token}). */
  readonly parent?: unknown;
}
import type {} from "@deepseek-ai/dsh-working-directory";
import { type Config, resolveConfig, workspaceBaselineIdentity } from "./config.ts";
import { trimmedInstructionDigest } from "./digest.ts";
import { findProjectRoot, loadBaselineInstructionSet } from "./files.ts";
import {
  type AgentInstructionChange,
  instructionCandidateGroup,
  instructionScopeKey,
  scopeForDisplayPath,
} from "./render.ts";
import {
  type AgentInstructionSource,
  type InstructionVersionCache,
  agentInstructionsMessage,
  applyInstructionVersionUpdates,
  baselineInstructionState,
  reconcileInstructionContext,
} from "./state.ts";

/** Dịch vụ mà phép chiếu chỉ dẫn workspace yêu cầu (stock index.js:1196). */
export const inject: string[] = ["sessionProjections", "workingDirectory"];

/** Một lần chạm tệp của tool, gắn với agent sở hữu (nội bộ, stock index.js:1389–1398). */
interface Touch {
  /** Agent đã chạm tệp. */
  agent: Agent;
  /** Đường dẫn tệp tool khai. */
  path: string;
}

/** Sự chuẩn bị baseline của MỘT phiên: định danh baseline + các phạm vi baseline bị loại (stock index.js:1250–1287). */
interface BaselinePreparation {
  /** Định danh dò/ưu tiên/ngân sách của baseline đã chuẩn bị. */
  identity: string;
  /** Phạm vi baseline đã đọc được nhưng bị gộp trùng, nên không cần dò lại. */
  excludedScopes: Set<string>;
}

/** Nguồn baseline đang HIỂN THỊ trong ngữ cảnh có thẩm quyền hoặc mặt phiên (stock index.js:1197–1203). */
function visibleBaselineSource(
  agent: Agent,
  authorityMessages: readonly UserMessage[],
): AgentInstructionSource | undefined {
  for (const message of authorityMessages.toReversed())
    if (message.source.kind === "agent-instructions" && message.source.baseline === true) return message.source;
  for (const seq of agent.session.surface.nodes.toReversed()) {
    const event = agent.session.eventAt(seq);
    if (event?.type === "user/message" && event.data.source.kind === "agent-instructions" && event.data.source.baseline === true)
      return event.data.source;
  }
  return undefined;
}

/**
 * Nhận ra tin nhắn do row này sản xuất trong hộp thư.
 * Nhận: message — tin nhắn vai người-dùng đang chờ.
 * Trả: true khi nguồn là chỉ dẫn workspace (stock index.js:1204–1206).
 */
function isAgentInstructionsMessage(message: UserMessage): boolean {
  return message.source.kind === "agent-instructions";
}

/**
 * So hai tin nhắn có CÙNG nội dung và CÙNG nguồn hay không.
 * Nhận: left — tin nhắn thứ nhất; right — tin nhắn thứ hai.
 * Trả: true khi nội dung và nguồn bằng nhau sâu (stock index.js:1207–1209).
 */
function sameContextPayload(left: UserMessage, right: UserMessage): boolean {
  return isDeepStrictEqual(left.content, right.content) && isDeepStrictEqual(left.source, right.source);
}

/** Tên tool được coi là CHẠM tệp (stock index.js:1210–1214). */
const FILE_TOUCH_TOOL_NAMES = new Set(["read", "write", "edit"]);

/**
 * Rút đường dẫn tệp từ tham số của một lần gọi tool.
 * Nhận: exec — một lần thực thi tool đã kết thúc.
 * Trả: đường dẫn đã trim, hoặc `undefined` khi tool không chạm tệp hay tham số không hợp lệ
 * (stock index.js:1215–1221).
 */
function filePathFromExecution(exec: Readonly<ToolExecutionLike>): string | undefined {
  if (!FILE_TOUCH_TOOL_NAMES.has(exec.name)) return undefined;
  const args = exec.arguments;
  if (typeof args !== "object" || args === null) return undefined;
  if (!("file_path" in args) || typeof args.file_path !== "string") return undefined;
  const filePath = args.file_path.trim();
  return filePath.length > 0 ? filePath : undefined;
}

/**
 * Gắn plugin nạp chỉ dẫn workspace vào ngữ cảnh: nạp baseline trước yêu cầu đầu và chiếu các tệp chỉ
 * dẫn bị chạm/đổi/xoá vào hộp thư ngay sau khi tool fs thành công.
 * Nhận: ctx — ngữ cảnh cordis của plugin; config — cấu hình row do người dùng khai.
 * Trả: không (đăng ký hiệu ứng, listener và dịch vụ trên `ctx`) (stock index.js:1222–1445).
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config);
  const instructionVersions: InstructionVersionCache = new WeakMap();
  const baselinePreparations = new WeakMap<Session, BaselinePreparation>();
  const projectionLifecycle = new AbortController();
  const executionTouches = new Map<unknown, Touch[]>();
  ctx.effect(
    () => () => {
      projectionLifecycle.abort(new Error("agent-instructions disposed"));
      executionTouches.clear();
    },
    "agent-instructions.projectionLifecycle",
  );
  const projectionTails = new WeakMap<Agent, Promise<void>>();
  const stepTouches = new WeakMap<Session, Touch[]>();
  const compose = async (
    agent: Agent,
    signal: AbortSignal,
    claimed: readonly UserMessage[],
    pending: readonly UserMessage[],
    touchedPaths: readonly string[] = [],
  ): Promise<UserMessage | undefined> => {
    signal.throwIfAborted();
    if (resolved.maxBytes <= 0 || !Number.isFinite(resolved.maxBytes)) return undefined;
    const fileSystem: FileSystem | undefined = ctx.get("fs");
    if (fileSystem === undefined) return undefined;
    const content: ContentBlock[] = [];
    const changes: AgentInstructionChange[] = [];
    let desiredBaseline = false;
    const authorityMessages: UserMessage[] = [...claimed];
    const cwd = await ctx.workingDirectory.ensure(agent, signal);
    const projectRoot = await findProjectRoot(cwd, resolved.projectRootMarkers, fileSystem, signal);
    const identity = workspaceBaselineIdentity(resolved, cwd, projectRoot);
    if (touchedPaths.length === 0 && pending.length > 0 && baselinePreparations.get(agent.session)?.identity === identity)
      return pending[0];
    const visibleBaseline = visibleBaselineSource(agent, authorityMessages);
    const baselinePresent = visibleBaseline !== undefined;
    const keepVisibleBaseline = visibleBaseline?.baselineIdentity === identity;
    const prepared = baselinePreparations.get(agent.session);
    let excludedBaselineScopes =
      keepVisibleBaseline && prepared?.identity === identity ? prepared.excludedScopes : undefined;
    let nextPreparation: BaselinePreparation | undefined;
    if (!baselinePresent || !keepVisibleBaseline || excludedBaselineScopes === undefined) {
      const replacePreviousBaseline = baselinePresent && !keepVisibleBaseline;
      const instructions = await loadBaselineInstructionSet(
        {
          cwd,
          dshHome: resolved.dshHome,
          agentsHome: resolved.agentsHome,
          projectRootMarkers: resolved.projectRootMarkers,
          maxBytes: resolved.maxBytes,
          maxSourceBytes: resolved.maxSourceBytes,
          instructionFileCandidates: resolved.instructionFileCandidates,
          localInstructionFileCandidates: resolved.localInstructionFileCandidates,
          projectRoot,
          replacePreviousBaseline,
          signal,
        },
        fileSystem,
      );
      const baseline = baselineInstructionState(instructions?.included ?? []);
      const observedBaseline = baselineInstructionState(instructions?.observed ?? []);
      const includedDigestsByGroup = new Map<string, Set<string>>();
      for (const file of instructions?.included ?? []) {
        const group = instructionCandidateGroup(scopeForDisplayPath(file.displayPath));
        const digests = includedDigestsByGroup.get(group) ?? new Set<string>();
        digests.add(trimmedInstructionDigest(file.content));
        includedDigestsByGroup.set(group, digests);
      }
      const excludedScopes = new Set(observedBaseline.changes.keys());
      for (const scope of baseline.changes.keys()) excludedScopes.delete(scope);
      for (const file of instructions?.deduped ?? []) {
        const group = instructionCandidateGroup(scopeForDisplayPath(file.displayPath));
        if (includedDigestsByGroup.get(group)?.has(trimmedInstructionDigest(file.content)))
          excludedScopes.delete(instructionScopeKey(file.displayPath));
      }
      excludedBaselineScopes = excludedScopes;
      nextPreparation = { identity, excludedScopes };
      let versionStates = instructionVersions.get(agent.session);
      if (versionStates === undefined && baseline.versions.size > 0) {
        versionStates = new Map();
        instructionVersions.set(agent.session, versionStates);
      }
      for (const [scope, state] of baseline.versions) versionStates?.set(scope, state);
      if (!keepVisibleBaseline && instructions !== undefined && instructions.rendered.text.length > 0) {
        const baselineContent = agentInstructionsMessage(instructions.rendered.text).content;
        content.push(...baselineContent);
        const replacementScopes = new Set(baseline.changes.keys());
        const baselineChanges: AgentInstructionChange[] = [
          ...(replacePreviousBaseline
            ? (visibleBaseline?.changes ?? []).flatMap((change): AgentInstructionChange[] =>
                change.action === "remove" || replacementScopes.has(change.scope)
                  ? []
                  : [{ action: "remove", scope: change.scope, path: change.path }],
              )
            : []),
          ...baseline.changes.values(),
        ];
        changes.push(...baselineChanges);
        authorityMessages.push(
          createUserMessage({
            content: baselineContent,
            source: {
              kind: "agent-instructions",
              form: "instructions",
              baseline: true,
              baselineIdentity: identity,
              changes: baselineChanges,
            },
          }),
        );
        desiredBaseline = true;
      }
    }
    const update = await reconcileInstructionContext(agent, resolved, instructionVersions, fileSystem, {
      cwd,
      authorityMessages,
      scopeMessages: pending,
      includeBaselineScopes: keepVisibleBaseline,
      ...(keepVisibleBaseline ? { excludedBaselineScopes } : {}),
      touchedPaths,
      projectRoot,
      signal,
    });
    if (update !== undefined) {
      content.push(...update.context.content);
      /* v8 ignore next -- phép đối soát chỉ dựng ngữ cảnh agent-instructions. */
      if (update.context.source.kind === "agent-instructions") changes.push(...update.context.source.changes);
      applyInstructionVersionUpdates(agent.session, update.versionUpdates, instructionVersions);
    }
    if (nextPreparation !== undefined) baselinePreparations.set(agent.session, nextPreparation);
    if (content.length === 0) return undefined;
    return createUserMessage({
      content,
      source: {
        kind: "agent-instructions",
        form: "instructions",
        ...(desiredBaseline ? { baseline: true } : {}),
        ...(desiredBaseline ? { baselineIdentity: identity } : {}),
        changes,
      },
    });
  };
  const syncInbox = (agent: Agent, claimed: readonly UserMessage[], desired: UserMessage | undefined): void => {
    const pending = agent.inbox.nextStep.filter(isAgentInstructionsMessage);
    const alreadySupplied =
      desired !== undefined &&
      (claimed.some((message) => sameContextPayload(message, desired)) ||
        agent.session.surface.nodes.some((seq) => {
          const event = agent.session.eventAt(seq);
          return event?.type === "user/message" && sameContextPayload(event.data, desired);
        }));
    if (desired === undefined || alreadySupplied) {
      for (const message of pending) agent.inbox.remove(message.id);
      return;
    }
    const reusable = pending.find((message) => sameContextPayload(message, desired));
    if (reusable !== undefined) {
      for (const message of pending) if (message !== reusable) agent.inbox.remove(message.id);
      return;
    }
    const replaced = pending[0];
    if (replaced === undefined) agent.inbox.prepend("next-step", desired);
    else agent.inbox.replace(replaced.id, desired);
    for (const message of pending.slice(1)) agent.inbox.remove(message.id);
  };
  const composeAndSync = async (
    agent: Agent,
    signal: AbortSignal,
    claimed: readonly UserMessage[],
    touchedPaths: readonly string[] = [],
  ): Promise<void> => {
    const desired = await compose(agent, signal, claimed, agent.inbox.nextStep.filter(isAgentInstructionsMessage), touchedPaths);
    signal.throwIfAborted();
    syncInbox(agent, claimed, desired);
  };
  const queueProjection = (agent: Agent, touchedPath: string): void => {
    const current = (projectionTails.get(agent) ?? Promise.resolve())
      .then(() => composeAndSync(agent, projectionLifecycle.signal, [], [touchedPath]))
      .catch((error: unknown) => {
        if (!projectionLifecycle.signal.aborted)
          ctx.logger.warn("workspace instruction refresh failed: %o", error);
      });
    projectionTails.set(agent, current);
    current.then(() => {
      if (projectionTails.get(agent) === current) projectionTails.delete(agent);
    });
  };
  const waitForProjections = async (agent: Agent): Promise<void> => {
    let projection: Promise<void> | undefined;
    while ((projection = projectionTails.get(agent)) !== undefined) await projection;
  };
  const stepIsOpen = (session: Session): boolean => {
    const boundary = ctx.sessionProjections.stateOf(session, "turnBoundary");
    if (boundary === undefined) throw new Error("agent-instructions requires the turnBoundary session projection");
    return (
      boundary.openTurnStartSeq !== null &&
      boundary.lastStepBoundary?.kind === "start" &&
      boundary.lastStepBoundary.seq > boundary.openTurnStartSeq
    );
  };
  const projectTouch = (touch: Touch): void => {
    const session = touch.agent.session;
    if (!stepIsOpen(session)) {
      queueProjection(touch.agent, touch.path);
      return;
    }
    const pending = stepTouches.get(session);
    if (pending === undefined) stepTouches.set(session, [touch]);
    else pending.push(touch);
  };
  ctx.on("session/event", (session, event) => {
    if (event.type !== "step/end") return;
    const pending = stepTouches.get(session);
    if (pending === undefined) return;
    stepTouches.delete(session);
    for (const touch of pending) queueProjection(touch.agent, touch.path);
  });
  ctx.on("agent/pre-step", async ({ agent, messages, step, signal }, next) => {
    const decision = await next();
    await waitForProjections(agent);
    const pending = agent.inbox.nextStep.filter(isAgentInstructionsMessage);
    const desired = await compose(agent, signal, messages, pending);
    signal.throwIfAborted();
    if (decision.kind === "reject" || (step === 1 && decision.messages.length === 0)) {
      syncInbox(agent, messages, desired);
      return decision;
    }
    for (const message of pending) agent.inbox.remove(message.id);
    if (desired === undefined || decision.messages.some((message) => sameContextPayload(message, desired)))
      return decision;
    const lastClaimedIndex = decision.messages.findLastIndex((message) => messages.includes(message));
    const entered = decision.messages.toSpliced(lastClaimedIndex + 1, 0, desired);
    return { ...decision, messages: entered };
  });
  ctx.on("tools/result", (exec, result) => {
    const touches = executionTouches.get(exec.token) ?? [];
    executionTouches.delete(exec.token);
    if (!result.isError && exec.agent !== undefined && !exec.signal.aborted) {
      const ownPath = filePathFromExecution(exec);
      if (ownPath !== undefined) touches.push({ agent: exec.agent, path: ownPath });
    }
    if (exec.parent !== undefined) {
      if (touches.length > 0) {
        const parentTouches = executionTouches.get(exec.parent);
        if (parentTouches === undefined) executionTouches.set(exec.parent, touches);
        else parentTouches.push(...touches);
      }
      return;
    }
    for (const touch of touches) projectTouch(touch);
  });
}
