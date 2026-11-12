/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Manager subagent: lớp `SubagentManager` giữ NGUYÊN export của bản gốc, cộng cụm điều khiển
 *      (interrupt/drain/wait/chọn con, giao tin nhắn cha↔con) trên mặt cắt CẤU TRÚC `ManagerState`.
 *      Tách từ lib/types/manager.js (1.315 dòng); cụm spawn/fork ở ./manager-spawn.ts, cụm vòng
 *      đời/sự kiện ở ./manager-lifecycle.ts.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@galaxy-blackhole/gbh-agent";
import { contentHasImage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, MessageId, MessageSource, UserMessage } from "@deepseek-ai/dsh-llm";
import type { SessionId } from "@galaxy-blackhole/gbh-session";

import {
  ChildLock,
  activationAgent,
  requireLocalActivation,
  type Activation,
  type ActivationPool,
  type LocalActivation,
} from "./activation.ts";
import { createAgentMessage } from "./continuation-messages.ts";
import { SubagentError } from "./error.ts";
import type { ActivationObserver } from "./lifecycle.ts";
import {
  announce,
  assertAdmitting,
  dispose,
  failureMessage,
  holdOwnership,
  liveLineage,
  sendWaking,
} from "./manager-lifecycle.ts";
import {
  assertImageCapable,
  coldResume,
  startExternal,
  startLocal,
  submitAdmitted,
} from "./manager-spawn.ts";
import type {
  ContinuableCreateRequest,
  ContinuableCreateSpec,
  ResolvedSubagentStartRequest,
  SubagentActivation,
  SubagentActivationSpec,
  SubagentInterruptAuthority,
  SubagentRun,
  SubagentSendMessageOptions,
} from "./types.ts";

/**
 * Móc riêng trong gói do dịch vụ sở hữu cấp cho manager.
 *
 * Bản gốc khai interface này ngay trong `manager.d.ts` và không xuất khẩu; bản viết lại xuất khẩu
 * để dịch vụ (`index.ts`) và hai module anh em cùng dùng chung một hợp đồng CẤU TRÚC, không cộng gộp
 * module nào.
 */
export interface SubagentHost {
  /**
   * Khởi chạy một backend ngoài dưới quyền sở hữu Activation.
   * Nhận: `name` — provider đã đăng ký; `request` — yêu cầu đã chọn thư mục tuyệt đối.
   * Trả: handle lần chạy có kết quả và dispose.
   */
  startExternal(name: string, request: ResolvedSubagentStartRequest): Promise<SubagentRun>;
  /**
   * Phân giải đóng góp tạo con continuable TÁCH RỜI của một provider.
   * Nhận: `name` — provider đã đăng ký; `request` — yêu cầu tạo đã chọn thư mục tuyệt đối.
   * Trả: spec tạo (có hoặc không có seed lịch sử cha).
   */
  prepareContinuable(name: string, request: ContinuableCreateRequest): Promise<ContinuableCreateSpec>;
  /**
   * Dựng observer vòng đời cho MỘT epoch cư trú.
   * Nhận: `provider` — tên provider ghi trong descriptor; `childId` — id phiên con bền;
   *   `parent` — cha trực tiếp đang sống làm khoá dispatch theo phạm vi.
   * Trả: observer phát cạnh bắt đầu/kết thúc của epoch.
   */
  observeActivation(provider: string, childId: SessionId, parent: Agent): ActivationObserver;
}

/** Một lần hiện thực hoá đã được thu nạp trước khi drain, theo dõi xuyên suốt công bố hoặc quay lui. */
export interface Materialization {
  /** Dòng dõi Agent sống đã chụp khi bắt đầu hiện thực hoá. */
  readonly lineage: readonly Agent[];
  /** Lời hứa kết toán của lần hiện thực hoá (công bố xong hoặc đã quay lui). */
  readonly settled: Promise<void>;
  /** Huỷ riêng của lần hiện thực hoá, ghép với huỷ của bên gọi qua `AbortSignal.any`. */
  readonly controller: AbortController;
}

/**
 * Mặt cắt CẤU TRÚC của trạng thái manager mà cả ba module cùng thao tác.
 *
 * Bản gốc giữ các trường này là `private` trên lớp và chia sẻ chúng qua `this`; bản viết lại tách
 * lớp thành ba tệp nên trạng thái mutable được gom vào MỘT object cấu trúc, còn lớp chỉ giữ tham
 * chiếu `private readonly state`. Nhờ vậy không module nào phải cộng gộp lớp hay phá `private`.
 */
export interface ManagerState {
  /** Context của dịch vụ (Agents, Sessions, logger, teardown ownership). */
  readonly ctx: Context;
  /** Móc provider và quan sát vòng đời do dịch vụ sở hữu. */
  readonly host: SubagentHost;
  /** Công suất con hiện được cấu hình (đọc tại mỗi lần dành khe). */
  readonly maxActiveSubagents: () => number;
  /** Id phiên con → Activation đang sống. Cục bộ theo tiến trình, không bao giờ bền. */
  readonly resident: Map<SessionId, Activation>;
  /** Danh tính gốc giữ bể khe xuyên qua kết toán của con mà không giữ gốc đã chết. */
  readonly rootPools: WeakMap<Agent, ActivationPool>;
  /** Các lần hiện thực hoá đã thu nạp trước drain, theo dõi tới công bố hoặc quay lui. */
  readonly materializations: Set<Materialization>;
  /** Bộ tuần tự hoá theo từng con, dùng chung cho giao phẩm, nhả, và dọn dẹp. */
  readonly locks: ChildLock;
  /** Chủ sở hữu Cordis CẤU TRÚC của mọi handle Activation. */
  readonly ownerCtx: Context;
  /**
   * Đúng các gốc đã bắt đầu teardown của host, kèm các thành viên dòng dõi sống quan sát dưới gốc đó.
   * Mục còn lại cho tới khi gốc rời sổ Agent, đóng cổng thu nạp suốt teardown mà không đầu độc một
   * bản thay thế cùng id về sau.
   */
  readonly closingScopes: Map<Agent, Set<Agent>>;
  /** Đã bắt đầu drain toàn manager hay chưa. */
  draining: boolean;
}

/** Nguồn bền, huỷ, và đích hộp thư của MỘT lần giao phẩm do manager dựng. */
export interface SubagentDeliveryOptions {
  /** Nguồn bền của tin nhắn; vắng mặt nghĩa là tin nhắn do Agent khác soạn. */
  readonly source?: MessageSource;
  /** Huỷ của bên gọi, chỉ sở hữu thao tác cho tới khi hộp thư nhận. */
  readonly signal: AbortSignal;
  /** Đích hộp thư: `queue` mở một lượt riêng, `steer` nhắm bước gần nhất. */
  readonly delivery: "queue" | "steer";
}

/** Own subagent requests and the resources of every live activation. */
export class SubagentManager {
  /** Mặt cắt cấu trúc của toàn bộ trạng thái mutable mà ba module cùng thao tác. */
  private readonly state: ManagerState;

  /**
   * Dựng một manager trong context đã tiêm Agent của dịch vụ.
   * Nhận: `ctx` — context cấp Agents, Sessions và quyền sở hữu teardown; `host` — điều phối provider
   *   và quan sát vòng đời do dịch vụ sở hữu; `maxActiveSubagents` — công suất con hiện được cấu hình.
   * Trả: thực thể manager; đăng ký hiệu ứng Cordis dọn theo thứ tự con-trước-cha.
   */
  constructor(ctx: Context, host: SubagentHost, maxActiveSubagents: () => number) {
    // Ordinary Cordis owner effects unwind in reverse registration order, which
    // cannot express the dynamic child graph. Register the private scope's
    // structural disposer FIRST and the drain SECOND, so reverse unwind invokes
    // the drain before releasing the scope; a cleanup effect on the same scope
    // as the Agent handles would let structural handle disposal bypass
    // child-first ordering.
    const scope = ctx.plugin(function activationOwner() {});
    this.state = {
      ctx,
      host,
      maxActiveSubagents,
      resident: new Map(),
      rootPools: new WeakMap(),
      materializations: new Set(),
      locks: new ChildLock(),
      ownerCtx: scope.ctx,
      closingScopes: new Map(),
      draining: false,
    };
    ctx.on("agent/disposed", ({ agent }) => {
      // payload `agent/disposed` mang `Agent` cua KERNEL; Map cua ta giu `Agent` cua goi GBH => ep tai bien.
      this.state.closingScopes.delete(agent as unknown as Agent);
    });
    ctx.effect(
      function* (this: SubagentManager) {
        yield scope.dispose;
        yield () => this.drain();
      }.bind(this),
      "subagents.manager()",
    );
  }

  /**
   * Ngắt lượt hiện tại của MỘT con continuable đang sống dưới thẩm quyền được cấp.
   * Nhận: `targetSessionId` — id phiên con bền cần ngắt; `authority` — địa chỉ cha người dùng
   *   hoặc Agent tổ tiên sống đúng.
   * Trả: không trả gì; con không cư trú thì không làm gì.
   */
  interrupt(targetSessionId: SessionId, authority: SubagentInterruptAuthority): void {
    interrupt(this.state, targetSessionId, authority);
  }

  /**
   * Đóng cổng thu nạp, chờ mọi lần hiện thực hoá đã thu nạp xuyên qua công bố hoặc quay lui, rồi dọn
   * đồ thị Activation sống ổn định theo thứ tự con trước.
   * Nhận: không.
   * Trả: lời hứa hoàn tất khi mọi gốc đã được giải phóng.
   */
  drain(): Promise<void> {
    return drain(this.state);
  }

  /**
   * Nối vào công việc con đang tiến triển, để nguyên hộp thư đỗ rảnh đang cư trú.
   * Nhận: `parent` — cha sống đúng mà hậu duệ được quan sát.
   * Trả: `true` khi có công việc đã được nối và host phải soát lại việc hoàn tất của cha.
   */
  waitForChildren(parent: Agent): Promise<boolean> {
    return waitForChildren(this.state, parent);
  }

  /**
   * Dừng hậu duệ được quản của đúng các cha sống do host sở hữu.
   * Nhận: `parents` — các gốc sống đúng mà hậu duệ được quản phải dừng.
   * Trả: lời hứa hoàn tất khi mọi gốc chọn lọc đã giải phóng.
   */
  drainDescendants(parents: readonly Agent[]): Promise<void> {
    return drainDescendants(this.state, parents);
  }

  /**
   * Giải phóng các con trực tiếp đang cư trú được chọn của MỘT cha sống đúng.
   * Nhận: `parent` — cha trực tiếp sống đúng cho phép giải phóng; `childIds` — id con trực tiếp bền
   *   cần giải phóng khi đang cư trú.
   * Trả: lời hứa hoàn tất khi các Activation được chọn đã giải phóng.
   */
  drainChildren(parent: Agent, childIds: readonly SessionId[]): Promise<void> {
    return drainChildren(this.state, parent, childIds);
  }

  /**
   * Khởi chạy một con nền continuable và trả về ngay khi hộp thư nhận prompt đầu tiên. Mọi hỏng sớm hơn
   * đều dọn handle đã tạo và quay lui Activation + ownership của cha mà không trả id nào.
   * Nhận: `spec` — provider, yêu cầu uỷ nhiệm, và huỷ của bên gọi.
   * Trả: id con bền và id tin nhắn prompt đầu đã được nhận.
   */
  startLocal(spec: SubagentActivationSpec): Promise<SubagentActivation & { messageId: MessageId }> {
    return startLocal(this.state, spec);
  }

  /**
   * Khởi chạy một backend ngoài dưới quyền sở hữu Activation.
   * Nhận: `spec` — tác vụ, provider, huỷ, và chính sách giao kết quả.
   * Trả: Activation đã được nhận cùng năng lực kết quả/dọn dẹp của nó.
   */
  startExternal(spec: SubagentActivationSpec): Promise<SubagentActivation> {
    return startExternal(this.state, spec);
  }

  /**
   * Giao MỘT tin nhắn do model soạn cho con trực tiếp continuable hoặc cho cha trực tiếp của bên gửi.
   * Con trực tiếp vắng mặt sẽ được resume nguội qua vòng đời tiếp nối thông thường.
   * Nhận: `sender` — Agent sống đúng cấp quyền và là nguồn tin nhắn; `targetId` — id phiên cha trực
   *   tiếp hoặc con trực tiếp; `content` — nội dung do model soạn; `options` — huỷ trước khi nhận.
   * Trả: id hộp thư của tin nhắn đã được nhận.
   */
  sendMessage(
    sender: Agent,
    targetId: SessionId,
    content: ContentBlock[],
    options: SubagentSendMessageOptions,
  ): Promise<MessageId> {
    return sendMessage(this.state, sender, targetId, content, options);
  }

  /**
   * Xếp MỘT prompt do người soạn thành lượt riêng của con trực tiếp.
   * Nhận: `parent` — cha trực tiếp sống đúng cấp quyền giao; `childId` — id phiên con trực tiếp bền;
   *   `content` — khối prompt model thấy; `source` — nguồn ghi công bền cho prompt người;
   *   `signal` — huỷ của bên gọi trước khi hộp thư nhận.
   * Trả: id tin nhắn bền đã được nhận.
   */
  queuePrompt(
    parent: Agent,
    childId: SessionId,
    content: ContentBlock[],
    source: MessageSource,
    signal: AbortSignal,
  ): Promise<MessageId> {
    return queuePrompt(this.state, parent, childId, content, source, signal);
  }

  /**
   * Lái MỘT prompt do host soạn tới con trực tiếp continuable.
   * Nhận: `parent` — cha trực tiếp sống đúng cấp quyền giao; `childId` — id phiên con trực tiếp bền;
   *   `content` — khối prompt model thấy; `source` — nguồn ghi công bền cho prompt host;
   *   `signal` — huỷ của bên gọi trước khi hộp thư nhận.
   * Trả: id tin nhắn bền đã được nhận.
   */
  steerPrompt(
    parent: Agent,
    childId: SessionId,
    content: ContentBlock[],
    source: MessageSource,
    signal: AbortSignal,
  ): Promise<MessageId> {
    return steerPrompt(this.state, parent, childId, content, source, signal);
  }
}

/**
 * Ngắt lượt hiện tại của một con continuable đang sống dưới thẩm quyền được cấp.
 * Nhận: `state` — mặt cắt trạng thái; `targetSessionId` — id con bền; `authority` — thẩm quyền.
 * Trả: không trả gì.
 * Ném: `SubagentError` mã `UNAUTHORIZED` khi bên gọi không đúng Agent tổ tiên sống, tự ngắt chính nó,
 *   hoặc con thuộc cha khác.
 */
function interrupt(state: ManagerState, targetSessionId: SessionId, authority: SubagentInterruptAuthority): void {
  if (authority.kind === "ancestor") {
    const caller = authority.agent;
    if ((state.ctx.agents.get(caller.id) as unknown as Agent | undefined) !== caller) {
      throw new SubagentError(
        `interrupting "${targetSessionId}" requires the exact live ancestor agent`,
        "UNAUTHORIZED",
      );
    }
    if (caller.id === targetSessionId) {
      throw new SubagentError(`agent "${caller.id}" cannot interrupt itself`, "UNAUTHORIZED");
    }
  }
  const activation = state.resident.get(targetSessionId);
  if (activation === undefined) return;
  if (authority.kind === "user") {
    if (activation.parent.id !== authority.parentSessionId) {
      throw new SubagentError(`subagent "${targetSessionId}" belongs to another parent session`, "UNAUTHORIZED");
    }
  } else if (!activation.ancestry.has(authority.agent)) {
    throw new SubagentError(
      `subagent "${targetSessionId}" is not a live descendant of agent "${authority.agent.id}"`,
      "UNAUTHORIZED",
    );
  }
  // Disposal already stopped the target with a whole-Activation teardown;
  // a second cancel would be a redundant signal on a closing handle.
  if (activation.closing !== undefined) return;
  const kind = authority.kind === "user" ? "user" : "parent";
  if (activation.kind === "local") {
    activation.handle.agent.cancel({ kind }, { keepInbox: true });
  } else {
    activation.controller.abort({ kind });
    // The settlement observer reports teardown failures.
    void dispose(state, activation).catch(() => undefined);
  }
}

/**
 * Đóng cổng thu nạp, chờ mọi lần hiện thực hoá đã thu nạp, rồi dọn đồ thị Activation theo con trước.
 * Nhận: `state` — mặt cắt trạng thái.
 * Trả: lời hứa hoàn tất khi các gốc đã giải phóng.
 */
async function drain(state: ManagerState): Promise<void> {
  state.draining = true;
  for (const pending of state.materializations) pending.controller.abort();
  await Promise.all([...state.materializations].map((materialization) => materialization.settled));
  const owned = new Set<SessionId>();
  for (const activation of state.resident.values()) {
    for (const child of activation.ownedChildren) owned.add(child);
  }
  const roots = [...state.resident.values()].filter((activation) => !owned.has(activation.childId));
  await disposeRoots(state, roots, "activation(s)");
}

/**
 * Nối vào công việc con đang tiến triển, để nguyên hộp thư đỗ rảnh đang cư trú.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha sống đúng mà hậu duệ được quan sát.
 * Trả: `true` khi có công việc đã được nối.
 */
async function waitForChildren(state: ManagerState, parent: Agent): Promise<boolean> {
  let observed = false;
  while (true) {
    const pending = [...state.materializations].filter((item) => item.lineage.includes(parent));
    const children = [...state.resident.values()].filter(
      (item) => activationAgent(item) !== parent && item.ancestry.has(parent),
    );
    observed ||= children.some((item) => item.kind === "local" && item.handle.agent.status !== "idle");
    await Promise.all(children.flatMap((item) => (item.kind === "local" ? [item.handle.agent.whenIdle()] : [])));
    const waits: Promise<unknown>[] = pending.map((item) => item.settled);
    for (const item of children) {
      if (item.kind === "external" || item.closing !== undefined) {
        waits.push(item.result.promise.catch(() => undefined));
        continue;
      }
      if (item.handle.agent.status !== "idle") {
        waits.push(item.handle.agent.whenIdle());
        continue;
      }
      if (item.ownedChildren.size > 0) {
        // Published descendants are observed separately; preparation holds
        // keep the owner pending until publication or rollback wakes it.
        if ([...item.ownedChildren].some((id) => !state.resident.has(id))) waits.push(item.poke.promise);
        continue;
      }
      const inbox = item.handle.agent.inbox;
      if (item.failureAt === undefined && (inbox.nextTurn.length > 0 || inbox.nextStep.length > 0)) continue;
      waits.push(Promise.race([item.result.promise.catch(() => undefined), item.poke.promise]));
    }
    if (waits.length > 0) {
      observed = true;
      await Promise.all(waits);
      continue;
    }
    // A descendant can be published while whenIdle follows another child.
    if (
      [...state.materializations].some((item) => item.lineage.includes(parent) && !pending.includes(item))
      || [...state.resident.values()].some(
        (item) => activationAgent(item) !== parent && item.ancestry.has(parent) && !children.includes(item),
      )
    ) {
      continue;
    }
    return observed;
  }
}

/**
 * Dừng hậu duệ được quản của đúng các cha sống do host sở hữu.
 * Nhận: `state` — mặt cắt trạng thái; `parents` — các gốc sống đúng.
 * Trả: lời hứa hoàn tất khi các gốc chọn lọc đã giải phóng.
 */
async function drainDescendants(state: ManagerState, parents: readonly Agent[]): Promise<void> {
  const roots = new Set(parents.filter((parent) => (state.ctx.agents.get(parent.id) as unknown as Agent | undefined) === parent));
  if (roots.size === 0) return;
  for (const root of roots) {
    closingMembers(state, root).add(root);
  }
  const targets: Activation[] = [];
  for (const activation of state.resident.values()) {
    const child = activationAgent(activation);
    const lineage = liveLineage(state, child ?? activation.parent);
    const owners = [...roots].filter((root) => child !== root && activation.ancestry.has(root));
    if (owners.length === 0) continue;
    targets.push(activation);
    for (const owner of owners) {
      const members = closingMembers(state, owner);
      if (child !== undefined) members.add(child);
      for (const agent of lineage) members.add(agent);
    }
  }
  const materializations = [...state.materializations].filter((materialization) => {
    const owners = [...roots].filter((root) => materialization.lineage.includes(root));
    for (const owner of owners) {
      const members = closingMembers(state, owner);
      for (const agent of materialization.lineage) members.add(agent);
    }
    if (owners.length > 0) materialization.controller.abort();
    return owners.length > 0;
  });
  const ownedTargets = new Set<SessionId>();
  for (const activation of targets) {
    for (const child of activation.ownedChildren) ownedTargets.add(child);
  }
  const targetRoots = targets.filter((activation) => !ownedTargets.has(activation.childId));
  for (const activation of targets) {
    const disposal = dispose(state, activation);
    void disposal.catch(() => undefined);
  }
  await Promise.all(materializations.map((materialization) => materialization.settled));
  await disposeRoots(state, targetRoots, "scoped activation(s)");
}

/**
 * Giải phóng các con trực tiếp đang cư trú được chọn của một cha sống đúng.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp sống đúng; `childIds` — id con cần nhả.
 * Trả: lời hứa hoàn tất khi các Activation được chọn đã giải phóng.
 * Ném: `SubagentError` mã `UNAUTHORIZED` khi `parent` không còn đúng mục đăng ký hoặc con không phải
 *   con trực tiếp của nó.
 */
async function drainChildren(state: ManagerState, parent: Agent, childIds: readonly SessionId[]): Promise<void> {
  if ((state.ctx.agents.get(parent.id) as unknown as Agent | undefined) !== parent) {
    throw new SubagentError("selected child teardown requires the exact live parent agent", "UNAUTHORIZED");
  }
  const targets: Activation[] = [];
  for (const childId of new Set(childIds)) {
    const activation = state.resident.get(childId);
    if (activation === undefined) continue;
    if (activation.parent.id !== parent.id || !activation.ancestry.has(parent)) {
      throw new SubagentError(
        `subagent "${childId}" is not a direct child of agent "${parent.id}"`,
        "UNAUTHORIZED",
      );
    }
    targets.push(activation);
  }
  for (const activation of targets) {
    const disposal = dispose(state, activation);
    void disposal.catch(() => undefined);
  }
  await disposeRoots(state, targets, "selected activation(s)");
}

/**
 * Giao một tin nhắn do model soạn tới con trực tiếp continuable hoặc tới cha trực tiếp của bên gửi.
 * Nhận: `state` — mặt cắt trạng thái; `sender` — Agent sống đúng; `targetId` — id đích; `content` —
 *   nội dung model soạn; `options` — huỷ trước khi nhận.
 * Trả: id hộp thư của tin nhắn đã được nhận.
 * Ném: `SubagentError` mã `UNAUTHORIZED` khi bên gửi không sống đúng hoặc không phải con cư trú.
 */
async function sendMessage(
  state: ManagerState,
  sender: Agent,
  targetId: SessionId,
  content: ContentBlock[],
  options: SubagentSendMessageOptions,
): Promise<MessageId> {
  if ((state.ctx.agents.get(sender.id) as unknown as Agent | undefined) !== sender) {
    throw new SubagentError("message delivery requires the exact live sender agent", "UNAUTHORIZED");
  }
  assertAdmitting(state, sender);
  const senderActivation = state.resident.get(sender.id);
  if (
    senderActivation !== undefined
    && senderActivation.kind === "local"
    && senderActivation.handle.agent === sender
    && senderActivation.parent.id === targetId
  ) {
    options.signal.throwIfAborted();
    return sendToParent(state, senderActivation, sender, content);
  }
  if (sender.session.header.parentSession === targetId) {
    throw new SubagentError(
      `agent "${sender.id}" is not a resident continuable child and cannot send to parent "${targetId}"`,
      "UNAUTHORIZED",
    );
  }
  return deliverToChild(state, sender, targetId, content, {
    signal: options.signal,
    delivery: "steer",
  });
}

/**
 * Xếp một prompt do người soạn thành lượt riêng của con trực tiếp.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp sống đúng; `childId` — con bền;
 *   `content` — khối prompt; `source` — nguồn bền; `signal` — huỷ của bên gọi.
 * Trả: id tin nhắn bền đã được nhận.
 */
function queuePrompt(
  state: ManagerState,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  source: MessageSource,
  signal: AbortSignal,
): Promise<MessageId> {
  return deliverToChild(state, parent, childId, content, { source, signal, delivery: "queue" });
}

/**
 * Lái một prompt do host soạn tới con trực tiếp continuable.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp sống đúng; `childId` — con bền;
 *   `content` — khối prompt; `source` — nguồn bền; `signal` — huỷ của bên gọi.
 * Trả: id tin nhắn bền đã được nhận.
 */
function steerPrompt(
  state: ManagerState,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  source: MessageSource,
  signal: AbortSignal,
): Promise<MessageId> {
  return deliverToChild(state, parent, childId, content, { source, signal, delivery: "steer" });
}

/**
 * Định tuyến MỘT lần giao phẩm do cha khởi phát qua cư trú và resume nguội.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp; `childId` — con bền; `content` —
 *   khối nội dung; `options` — nguồn/huỷ/đích hộp thư.
 * Trả: id tin nhắn đã được nhận.
 */
async function deliverToChild(
  state: ManagerState,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  options: SubagentDeliveryOptions,
): Promise<MessageId> {
  assertAdmitting(state, parent);
  const releaseHold = holdOwnership(state, parent, childId);
  try {
    return await deliverFollowup(state, parent, childId, content, options);
  } catch (error) {
    releaseHold();
    throw error;
  }
}

/**
 * Vòng giao phẩm phía sau {@link deliverToChild}, chạy dưới giữ chỗ của cha.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp; `childId` — con bền; `content` —
 *   khối nội dung; `options` — nguồn/huỷ/đích hộp thư.
 * Trả: id tin nhắn đã được nhận (vòng lặp chỉ chạy lại khi lần giao thua điểm cắt dọn dẹp).
 */
async function deliverFollowup(
  state: ManagerState,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  options: SubagentDeliveryOptions,
): Promise<MessageId> {
  while (true) {
    const live = await state.locks.run(childId, async () => {
      const activation = state.resident.get(childId);
      if (activation === undefined) return coldResume(state, parent, childId, content, options);
      requireLocalActivation(activation);
      const disposal = activation.closing;
      /* v8 ignore next 3 -- the send-versus-dispose cutoff needs a delivery to
       * observe the transaction inside the same critical section that opened it. */
      if (disposal !== undefined) {
        return disposal.then(() => undefined, () => undefined);
      }
      if (contentHasImage(content)) {
        await assertImageCapable(state, requireLocalActivation(activation).handle.agent, options.signal);
        if (activation.closing !== undefined) {
          await Promise.allSettled([activation.closing]);
          return undefined;
        }
      }
      const messageId = submitAdmitted(state, activation, content, options, parent);
      announce(state, activation);
      return messageId;
    });
    /* v8 ignore start -- only a delivery that lost the disposal cutoff retries. */
    if (live !== undefined) return live;
    assertAdmitting(state, parent);
    options.signal.throwIfAborted();
    /* v8 ignore stop */
  }
}

/**
 * Giao tin nhắn của MỘT con continuable đang cư trú cho cha trực tiếp đang sống của nó.
 * Nhận: `state` — mặt cắt trạng thái; `activation` — con cư trú cục bộ; `sender` — Agent gửi;
 *   `content` — khối nội dung.
 * Trả: id tin nhắn đã giao.
 * Ném: `SubagentError` mã `ACTIVATION_CLOSING`/`PARENT_UNAVAILABLE` khi lượt đang dọn hoặc cha đã chết.
 */
function sendToParent(
  state: ManagerState,
  activation: LocalActivation,
  sender: Agent,
  content: ContentBlock[],
): MessageId {
  /* v8 ignore next 6 -- only synchronous re-entrant teardown can open this
   * transaction between exact-agent authorization and this no-await span. */
  if (activation.closing !== undefined) {
    throw new SubagentError(
      `subagent "${sender.id}" activation is being disposed; the message was not delivered`,
      "ACTIVATION_CLOSING",
    );
  }
  const parent = state.ctx.agents.get(activation.parent.id) as unknown as Agent | undefined;
  if (parent !== (activation.parent as unknown as Agent)) {
    throw new SubagentError("direct parent is not live; the message was not delivered", "PARENT_UNAVAILABLE");
  }
  const message = createAgentMessage(sender, content);
  sendAgentMessage(state, parent, message);
  return message.id;
}

/**
 * Gửi MỘT tin nhắn Agent trong khi chỉ dịch đúng lời từ chối của chính đích.
 * Nhận: `state` — mặt cắt trạng thái; `parent` — cha trực tiếp đích; `message` — tin nhắn đã dựng.
 * Trả: không trả gì.
 * Ném: `SubagentError` mã `PARENT_UNAVAILABLE` khi đích không còn sống.
 */
function sendAgentMessage(state: ManagerState, parent: Agent, message: UserMessage): void {
  try {
    sendWaking(state, parent, message, "steer");
  } catch (error) {
    throw new SubagentError("direct parent is not live; the message was not delivered", "PARENT_UNAVAILABLE", {
      cause: error,
    });
  }
}

/**
 * Trả tập thành viên được giữ cho MỘT gốc teardown theo phạm vi.
 * Nhận: `state` — mặt cắt trạng thái; `root` — gốc teardown đang sống.
 * Trả: tập thành viên đã có hoặc vừa tạo cho `root`.
 */
function closingMembers(state: ManagerState, root: Agent): Set<Agent> {
  const existing = state.closingScopes.get(root);
  if (existing !== undefined) return existing;
  const members = new Set<Agent>();
  state.closingScopes.set(root, members);
  return members;
}

/**
 * Dọn các gốc độc lập và báo MỌI lỗi nhánh sau khi tất cả đã lắng.
 * Nhận: `state` — mặt cắt trạng thái; `roots` — các gốc cần dọn; `failureSubject` — cụm danh từ
 *   dùng trong chuỗi lỗi (`activation(s)`, `scoped activation(s)`, …).
 * Trả: lời hứa hoàn tất khi mọi gốc đã dọn xong.
 * Ném: `SubagentError` mã `ACTIVATION_TEARDOWN_FAILED` khi có nhánh hỏng.
 */
async function disposeRoots(
  state: ManagerState,
  roots: readonly Activation[],
  failureSubject: string,
): Promise<void> {
  const failures = await Promise.all(
    roots.map(async (activation) => {
      try {
        await dispose(state, activation);
        return undefined;
      } catch (error) {
        return error;
      }
    }),
  );
  const reasons = failures.filter((failure) => failure !== undefined);
  if (reasons.length > 0) {
    throw new SubagentError(
      `subagent teardown failed for ${reasons.length} ${failureSubject}: `
        + reasons.map((reason) => failureMessage(reason)).join("; "),
      "ACTIVATION_TEARDOWN_FAILED",
    );
  }
}

export default SubagentManager;
