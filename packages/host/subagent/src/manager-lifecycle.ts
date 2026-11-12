/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vòng đời và sự kiện của manager subagent: cư trú — kết toán — dọn dẹp Activation, quan hệ
 *      ownership của con, cổng thu nạp đầu vào, và thông báo kết toán về cha. Tách từ
 *      lib/types/manager.js (1.315 dòng) theo cụm chức năng tự nhiên; giữ nguyên tên hàm, logic,
 *      chuỗi lỗi và tên event của bản gốc.
 */

import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { UserMessage } from "@deepseek-ai/dsh-llm";
import { errorChain } from "@deepseek-ai/dsh-llm";
import type { SessionId } from "@galaxy-blackhole/gbh-session";

import {
  ActivationPool,
  activationAgent,
  captureLocalResult,
  requireLocalActivation,
  type Activation,
  type LocalActivation,
} from "./activation.ts";
import { createSettlementMessage } from "./continuation-messages.ts";
import { SubagentError } from "./error.ts";
import type { ManagerState } from "./manager.ts";
import type { SubagentResult } from "./types.ts";

/** Trạng thái kết toán mà bộ theo dõi cục bộ đọc trước khi đóng cổng nhận đầu vào. */
type SettlementState = "closed" | "retry" | "wait" | "ready";

/**
 * Bộ ba promise/định-vị, khai theo CẤU TRÚC tại chỗ.
 *
 * Lib ES2023 mà cổng dùng CHƯA khai kiểu toàn cục `PromiseWithResolvers`; `./activation.ts` cũng
 * khai đúng hình này, nên đây là cùng một kiểu cấu trúc với `Activation.poke`.
 */
interface PromiseWithResolvers<T> {
  /** Lời hứa mà bộ theo dõi chờ. */
  readonly promise: Promise<T>;
  /** Giải quyết lời hứa. */
  readonly resolve: (value: T) => void;
  /** Từ chối lời hứa. */
  readonly reject: (reason?: unknown) => void;
}

/**
 * Chỉ hiện phần thông điệp AN TOÀN bên ngoài của lỗi thi hành hoặc lỗi teardown.
 * Nhận: `error` — giá trị bắt được, chưa biết kiểu.
 * Trả: `message` của Error, hoặc `'unknown teardown failure'` khi không phải Error.
 */
export function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown teardown failure";
}

/**
 * Doc `session.seq` qua mat CAU TRUC (ADR 000d, 08/11/2026 dev-1): ban port gbh-agent khong khai `seq` tren AgentSession.
 * Nhan: `agent` - agent co `session`. Tra: so thu tu su kien hien tai cua phien.
 */
function sessionSeqOf(agent: { readonly session: unknown }): number {
  return (agent.session as unknown as { readonly seq: number }).seq;
}

/**
 * Trả CHÍNH XÁC dòng dõi hiện đang phân giải được, từ `agent` đi lên.
 * Nhận: `state` — mặt cắt trạng thái của manager; `agent` — Agent đang sống bắt đầu dò.
 * Trả: mảng bắt đầu bằng `agent`, rồi cha, ông… dừng khi gặp id đã thấy hoặc Agent rời sổ đăng ký.
 */
export function liveLineage(state: ManagerState, agent: Agent): Agent[] {
  const lineage: Agent[] = [agent];
  // ADR 000d (08/11/2026 dev-1): `agent.id` cua goi GBH la chuoi, kernel dung `SessionId` (brand) => ep tai bien.
  const seen = new Set<SessionId>([agent.id as unknown as SessionId]);
  let parentSession = (agent.session as unknown as { readonly header: { readonly parentSession?: SessionId } }).header.parentSession;
  while (parentSession !== undefined) {
    const parent = state.ctx.agents.get(parentSession) as unknown as Agent | undefined;
    if (parent === undefined || seen.has(parent.id as unknown as SessionId)) break;
    lineage.push(parent);
    seen.add(parent.id as unknown as SessionId);
    parentSession = (parent.session as unknown as { readonly header: { readonly parentSession?: SessionId } }).header.parentSession;
  }
  return lineage;
}

/**
 * Trả lần teardown đã đóng cổng thu nạp continuable cho dòng dõi của Agent này.
 * Nhận: `state` — mặt cắt trạng thái; `agent` — Agent cần xét quyền thu nạp.
 * Trả: `'manager'` khi cả manager đang drain, gốc teardown theo phạm vi khi dòng dõi chạm gốc đó,
 *   hoặc `undefined` khi vẫn thu nạp bình thường.
 */
function closingTeardownFor(state: ManagerState, agent: Agent): "manager" | Agent | undefined {
  if (state.draining) return "manager";
  const lineage = liveLineage(state, agent);
  for (const [root, members] of state.closingScopes) {
    if (members.has(agent) || lineage.includes(root)) return root;
  }
  return undefined;
}

/**
 * Từ chối thu nạp mới một khi manager hoặc đúng cây cha này đã bắt đầu drain.
 * Nhận: `state` — mặt cắt trạng thái; `agent` — Agent đang sống mà dòng dõi quyết định việc thu nạp.
 * Trả: không trả gì; ném `SubagentError` mã `DRAINING` khi cổng đã đóng.
 */
export function assertAdmitting(state: ManagerState, agent: Agent): void {
  const closing = closingTeardownFor(state, agent);
  if (closing === undefined) return;
  throw new SubagentError(
    closing === "manager"
      ? "subagents are draining; the operation was not admitted"
      : `subagents below parent "${closing.id}" are draining; the operation was not admitted`,
    "DRAINING",
  );
}

/**
 * Phân giải bể khe của một gốc ĐÚNG MỘT LẦN; hậu duệ thừa hưởng bể của cha đang cư trú trực tiếp.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — Agent gốc cần bể công suất.
 * Trả: bể khe đã có hoặc vừa tạo cho `parent`.
 */
export function rootPool(state: ManagerState, parent: Agent): ActivationPool {
  let pool = state.rootPools.get(parent);
  if (pool === undefined) {
    pool = new ActivationPool();
    state.rootPools.set(parent, pool);
  }
  return pool;
}

/**
 * Đăng ký trước `childId` vào tập con sở hữu của cha do continuation quản, để cha không kết toán
 * trong lúc bên gọi còn đang lập hoặc chạy lại con đó. Trả bộ nhả cho nhánh hỏng; nó chỉ gỡ đúng
 * một giữ chỗ do lần gọi này thêm, và giữ nguyên ownership khi đã có Activation sống cho con.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp đang sống; `childId` — con bền cần giữ chỗ.
 * Trả: hàm nhả cho nhánh hỏng; no-op khi không thêm gì.
 * Ném: `SubagentError` mã `ACTIVATION_CLOSING` khi chính cha đang bị dọn.
 */
export function holdOwnership(state: ManagerState, parent: Agent, childId: SessionId): () => void {
  const parentActivation = state.resident.get(parent.id as unknown as SessionId);
  if (parentActivation === undefined || activationAgent(parentActivation) !== parent) return () => {};
  if (parentActivation.closing !== undefined) {
    throw new SubagentError(
      `subagent parent "${parent.id}" is being disposed; the child was not established`,
      "ACTIVATION_CLOSING",
    );
  }
  if (parentActivation.ownedChildren.has(childId)) return () => {};
  parentActivation.ownedChildren.add(childId);
  return () => {
    const live = state.resident.get(childId);
    /* v8 ignore next 4 -- reaching this arm needs another delivery to establish the child
     * between this operation's failure and its releaser running, which no test can schedule
     * deterministically: the ownership edge then belongs to that live Activation, so the
     * conservative keep leaves it for finishDisposal's releaseOwnership. */
    if (live !== undefined && live.closing === undefined) return;
    if (parentActivation.ownedChildren.delete(childId)) wake(parentActivation);
  };
}

/**
 * Ghi con vào tập sở hữu của cha do continuation quản.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp đang sống; `childId` — con bền vừa cư trú.
 * Trả: không trả gì; đánh thức bộ theo dõi kết toán của cha.
 * Ném: `SubagentError` mã `ACTIVATION_CLOSING` khi cha đang bị dọn.
 */
export function acquireOwnership(state: ManagerState, parent: Agent, childId: SessionId): void {
  const parentActivation = state.resident.get(parent.id as unknown as SessionId);
  if (parentActivation === undefined) return;
  if (parentActivation.closing !== undefined) {
    throw new SubagentError(
      `subagent parent "${parent.id}" is being disposed; the child was not established`,
      "ACTIVATION_CLOSING",
    );
  }
  parentActivation.ownedChildren.add(childId);
  wake(parentActivation);
}

/**
 * Gỡ một con khỏi tập sở hữu của chủ đang sống và để chủ đó tự soát lại kết toán.
 * Nhận: `state` — mặt cắt trạng thái; `childId` — con bền cần gỡ.
 * Trả: không trả gì.
 */
function releaseOwnership(state: ManagerState, childId: SessionId): void {
  for (const candidate of state.resident.values()) {
    if (candidate.ownedChildren.delete(childId)) wake(candidate);
  }
}

/**
 * Đánh thức bộ theo dõi kết toán để nó soát lại cư trú sau khi trạng thái liên quan đổi.
 * Nhận: `activation` — lượt cư trú cần đổi mới `poke`.
 * Trả: không trả gì; lượt thi hành bên ngoài không có bộ theo dõi nên bỏ qua.
 */
export function wake(activation: Activation): void {
  if (activation.kind === "external") return;
  activation.poke.resolve();
  activation.poke = Promise.withResolvers<void>();
}

/**
 * Thu nạp đầu vào cục bộ MỘT CÁCH ĐỒNG BỘ trước khi mọi teardown có thể bắt đầu.
 * Nhận: `activation` — lượt cư trú cục bộ nhận giao phẩm; `message` — tin nhắn bền đã dựng;
 *   `delivery` — đích hộp thư: `steer` (bước gần nhất) hay `queue` (lượt riêng kế tiếp).
 * Trả: không trả gì.
 * Ném: `SubagentError` mã `ACTIVATION_CLOSING` khi lượt đang bị dọn, mã `INPUT_CLOSED` khi con đã
 *   gửi hoặc đang gửi kết quả có cấu trúc.
 */
export function deliver(activation: Activation, message: UserMessage, delivery: "queue" | "steer"): void {
  if (activation.closing !== undefined) {
    throw new SubagentError("subagent activation is being disposed; the message was not accepted", "ACTIVATION_CLOSING");
  }
  const local = requireLocalActivation(activation);
  if (local.structured?.acceptsInput() === false) {
    throw new SubagentError(
      "subagent is submitting or has submitted its structured result; the message was not accepted",
      "INPUT_CLOSED",
    );
  }
  // Kernel khai steer/followup nhan `AgentUserMessage`; ban port dung `UserMessage` => ep tai bien.
  if (delivery === "steer") local.handle.agent.steer(message as unknown as Parameters<typeof local.handle.agent.steer>[0]);
  else local.handle.agent.followup(message as unknown as Parameters<typeof local.handle.agent.followup>[0]);
}

/**
 * Áp cổng thu nạp của Activation lên một cha đang cư trú trước khi giao đầu vào.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — Agent đang sống nhận tin nhắn;
 *   `message` — tin nhắn người dùng bền cần giao; `delivery` — đích hộp thư nhận.
 * Trả: không trả gì; cha không cư trú thì đi thẳng qua `steer`/`followup` của Agent.
 */
export function sendWaking(
  state: ManagerState,
  parent: Agent,
  message: UserMessage,
  delivery: "queue" | "steer",
): void {
  const parentActivation = state.resident.get(parent.id as unknown as SessionId);
  if (parentActivation !== undefined && activationAgent(parentActivation) === parent) {
    try {
      deliver(parentActivation, message, delivery);
    } finally {
      wake(parentActivation);
    }
    return;
  }
  // Kernel khai steer/followup nhan `AgentUserMessage`; ban port dung `UserMessage` => ep tai bien.
  if (delivery === "steer") parent.steer(message as unknown as Parameters<typeof parent.steer>[0]);
  else parent.followup(message as unknown as Parameters<typeof parent.followup>[0]);
}

/**
 * Đóng cổng thu nạp ĐỒNG BỘ và chia sẻ đúng một giao dịch giải phóng, kể cả quay lui lúc khởi động.
 * Nhận: `activation` — epoch cư trú cần đóng; `release` — thân giải phóng của epoch.
 * Trả: giao dịch đóng dùng chung (đã công bố trước khi `release` chạy).
 */
function close(activation: Activation, release: () => Promise<void>): Promise<void> {
  if (activation.closing !== undefined) return activation.closing;
  const completion = Promise.withResolvers<void>();
  activation.closing = completion.promise;
  void release().then(completion.resolve, completion.reject);
  return completion.promise;
}

/**
 * Dừng và giải phóng MỘT Activation qua giao dịch đóng đã ghi nhớ.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — đúng epoch cư trú cần đóng.
 * Trả: giao dịch đóng dùng chung.
 */
export function dispose(state: ManagerState, activation: Activation): Promise<void> {
  return close(activation, () => finishDisposal(state, activation, true));
}

/**
 * Bắt đầu quan sát kết toán sau khi lần nhận đầu tiên đã được ghi.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — lượt đã được nhận cần quan sát.
 * Trả: không trả gì; chỉ quan sát đúng một lần cho mỗi epoch.
 */
export function announce(state: ManagerState, activation: Activation): void {
  if (activation.announced) return;
  activation.announced = true;
  if (activation.kind === "local") {
    watchLocalSettlement(state, activation);
  } else {
    const finish = () => close(activation, () => finishDisposal(state, activation, false));
    void activation.run.result.then(finish, finish).catch((error) => {
      reportTeardownFailure(state, activation, error);
    });
  }
}

/**
 * Giải phóng một Activation mà cạnh khởi động chưa được công bố.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — epoch chưa công bố; `error` — lỗi thu nạp
 *   khiến thao tác không trả được id tin nhắn đã nhận.
 * Trả: giao dịch đóng dùng chung, đã dọn handle, xoá cư trú, nhả khe và từ chối `result`.
 */
export function rollbackUnpublished(state: ManagerState, activation: Activation, error: unknown): Promise<void> {
  return close(activation, async () => {
    try {
      await (activation.kind === "local" ? activation.handle.dispose() : activation.run.dispose());
    } finally {
      state.resident.delete(activation.childId);
      activation.releaseSlot();
      releaseOwnership(state, activation.childId);
      activation.result.reject(error);
    }
  });
}

/**
 * Soát đầu vào đang chờ và con đang sở hữu trước khi đóng cổng nhận.
 * Nhận: `activation` — lượt cục bộ đang xét; `observation` — `poke` đã chụp trước khi chờ `whenIdle`.
 * Trả: `closed` khi đã có giao dịch đóng, `retry` khi `poke` đã đổi, `wait` khi còn việc, `ready` khi kết toán được.
 */
function settlementState(activation: LocalActivation, observation: PromiseWithResolvers<void>): SettlementState {
  if (activation.closing !== undefined) return "closed";
  if (activation.poke !== observation) return "retry";
  const inbox = activation.handle.agent.inbox;
  if (activation.ownedChildren.size > 0) return "wait";
  if (activation.failureAt === undefined && (inbox.nextTurn.length > 0 || inbox.nextStep.length > 0)) return "wait";
  return "ready";
}

/**
 * Theo một Activation cục bộ tới kết toán tự nhiên.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — lượt cục bộ đã được nhận.
 * Trả: không trả gì; vòng lặp chạy dưới khoá của chính con cho tới khi đóng hoặc kết toán xong.
 */
function watchLocalSettlement(state: ManagerState, activation: LocalActivation): void {
  void (async () => {
    while (true) {
      const idleObservation = activation.poke;
      await activation.handle.agent.whenIdle();
      if (activation.closing !== undefined) return;
      const readiness = await state.locks.run(activation.childId, () =>
        Promise.resolve(settlementState(activation, idleObservation)),
      );
      if (readiness === "closed") return;
      if (readiness === "retry") continue;
      if (readiness === "wait") {
        await idleObservation.promise;
        continue;
      }
      const finalSeq = sessionSeqOf(activationAgent(activation) ?? activation.handle.agent);
      await flushFinalState(state, activation);
      const attempt = await state.locks.run(activation.childId, async () => {
        const stateNow = settlementState(activation, idleObservation);
        if (stateNow !== "ready") return stateNow;
        if (sessionSeqOf(activationAgent(activation) ?? activation.handle.agent) !== finalSeq) {
          return "retry" as const;
        }
        let done: Promise<void> | undefined;
        try {
          void activation.handle.agent.runMaintenance(() => {
            done = close(activation, () => finishDisposal(state, activation, false));
            return Promise.resolve();
          });
        } catch (_error) {
          // Another activity already owns the Agent's idle phase.
          return "retry" as const;
        }
        return { done };
      });
      if (typeof attempt === "string") {
        if (attempt === "closed") return;
        continue;
      }
      try {
        await attempt.done;
      } catch (error) {
        reportTeardownFailure(state, activation, error);
      }
      return;
    }
  })();
}

/**
 * Báo lỗi dọn dẹp ĐÚNG MỘT LẦN sau khi bộ quan sát kết toán tự nhiên kết thúc.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — epoch vừa dọn; `error` — lỗi teardown.
 * Trả: không trả gì; chỉ ghi cảnh báo qua logger của context.
 */
function reportTeardownFailure(state: ManagerState, activation: Activation, error: unknown): void {
  state.ctx.logger.warn(
    `subagent "${activation.childId}" activation teardown failed: ${failureMessage(error)}`,
  );
}

/**
 * Truyền lệnh dừng ĐỒNG BỘ và chờ quay lui khởi động của hậu duệ trước khi giải phóng.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — epoch cần dọn; `stop` — có dừng công việc
 *   đang chạy (`true`) hay chỉ chờ kết toán tự nhiên (`false`).
 * Trả: không trả gì khi teardown thành công.
 * Ném: `SubagentError` mã `ACTIVATION_TEARDOWN_FAILED` khi một hoặc nhiều ranh giới dọn dẹp hỏng.
 */
async function finishDisposal(state: ManagerState, activation: Activation, stop: boolean): Promise<void> {
  wake(activation);
  const { childId } = activation;
  const failures: SubagentError[] = [];
  let result: SubagentResult = { output: [], stopReason: "error" };
  let resultFailure: { error: unknown } | undefined;
  let externalDisposal: Promise<void> | undefined;
  const child = activationAgent(activation);
  const detail = (error: unknown): string => (child === undefined ? failureMessage(error) : errorChain(error));
  try {
    if (activation.kind === "external") {
      if (stop) {
        activation.controller.abort({ kind: "parent" });
        // Some backends settle their result only when disposal begins.
        externalDisposal = Promise.resolve().then(() => activation.run.dispose());
        void externalDisposal.catch(() => undefined);
      }
      result = await activation.run.result;
    } else {
      if (stop) {
        activation.handle.agent.cancel({ kind: "parent" });
        const idle = activation.handle.agent.whenIdle();
        const children = [...activation.ownedChildren]
          .map((owned) => state.resident.get(owned))
          .filter((candidate): candidate is Activation => candidate !== undefined);
        const pending = [...state.materializations].filter((item) =>
          item.lineage.includes(activation.handle.agent),
        );
        const childDisposals = children.map((candidate) => dispose(state, candidate));
        for (const item of pending) item.controller.abort();
        childDisposals.push(...pending.map((item) => item.settled));
        const childFailures = await Promise.all(
          childDisposals.map(async (disposal) => {
            try {
              await disposal;
              return undefined;
            } catch (error) {
              return error;
            }
          }),
        );
        const reasons = childFailures.filter((reason) => reason !== undefined);
        if (reasons.length > 0) {
          failures.push(
            new SubagentError(
              `subagent "${childId}" child teardown failed: ${reasons.map((reason) => failureMessage(reason)).join("; ")}`,
              "ACTIVATION_TEARDOWN_FAILED",
            ),
          );
        }
        await idle;
        await flushFinalState(state, activation);
      }
      result = captureLocalResult(activation);
    }
  } catch (error) {
    resultFailure = { error };
    failures.push(
      new SubagentError(
        `subagent "${childId}" activation teardown failed: ${detail(error)}`,
        "ACTIVATION_TEARDOWN_FAILED",
        { cause: error },
      ),
    );
  }
  try {
    if (activation.kind === "local") await activation.handle.dispose();
    else await (externalDisposal ?? activation.run.dispose());
  } catch (error) {
    failures.push(
      new SubagentError(
        `subagent "${childId}" activation handle disposal failed: ${detail(error)}`,
        "ACTIVATION_TEARDOWN_FAILED",
        { cause: error },
      ),
    );
  }
  let failure: SubagentError | undefined;
  if (failures.length === 1) {
    failure = failures[0];
  } else if (failures.length > 1) {
    failure = new SubagentError(
      `subagent "${childId}" activation teardown failed at ${failures.length} boundaries: `
        + failures.map((item) => detail(item)).join("; "),
      "ACTIVATION_TEARDOWN_FAILED",
      { cause: new AggregateError(failures) },
    );
  }
  state.resident.delete(childId);
  activation.releaseSlot();
  const terminal: SubagentResult = failure === undefined ? result : { output: [], stopReason: "error" };
  notifySettlement(state, activation, result);
  releaseOwnership(state, childId);
  activation.observer.settle(terminal);
  if (resultFailure === undefined) activation.result.resolve(result);
  else activation.result.reject(resultFailure.error);
  if (failure !== undefined) throw failure;
}

/**
 * Giao kết quả thi hành đã chụp cho cha trực tiếp bền vững SAU khi dọn dẹp xong.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — epoch vừa kết toán; `terminal` — kết cục đã chụp.
 * Trả: không trả gì; cha đã drain thì `inject` để không đánh thức nó, ngược lại giao theo trạng thái cha.
 */
function notifySettlement(state: ManagerState, activation: Activation, terminal: SubagentResult): void {
  if (!activation.announced || activation.delivery === "caller") return;
  try {
    // `ctx.agents.get` tra `Agent` cua KERNEL; ban port dung `Agent` cua goi GBH (cung hinh dang runtime) => ep tai bien.
    const parent = state.ctx.agents.get(activation.parent.id) as unknown as Agent | undefined;
    if (parent !== (activation.parent as unknown as Agent)) return;
    const message = createSettlementMessage(
      activation.childId,
      terminal,
      activationAgent(activation) !== undefined,
    );
    if (closingTeardownFor(state, parent) !== undefined) {
      // `inject` co trong runtime cua kernel nhung khong khai tren `Agent` cua ban port => goi qua mat cau truc.
      (parent as unknown as { inject(message: unknown): void }).inject(message);
      return;
    }
    sendWaking(state, parent, message, parent.status === "idle" ? "queue" : "steer");
  } catch (error) {
    state.ctx.logger.warn(
      `subagent "${activation.childId}" settlement notice was not delivered to its parent: `
        + errorChain(error),
    );
  }
}

/**
 * Yêu cầu một lần flush Session cuối CỐ GẮNG HẾT SỨC trước khi đóng cổng nhận kết toán tự nhiên.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — lượt cục bộ sắp kết toán.
 * Trả: không trả gì; lỗi flush chỉ ghi cảnh báo, không chặn kết toán.
 */
async function flushFinalState(state: ManagerState, activation: LocalActivation): Promise<void> {
  try {
    // Seam `sessions.flush` cua kernel nhan `Session`; `agent.session` la `AgentSession` cua ban port => ep tai bien.
    await activation.handle.agent.ctx.sessions.flush(activation.handle.agent.session as unknown as Parameters<typeof activation.handle.agent.ctx.sessions.flush>[0]);
  } catch (error) {
    state.ctx.logger.warn(
      `subagent "${activation.childId}" best-effort final session flush failed; `
        + `the persisted state may be unavailable or stale on resume: ${errorChain(error)}`,
    );
  }
}
