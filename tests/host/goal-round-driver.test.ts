/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-goal-round-driver: mỗi ca dựng HAI giàn giống hệt nhau rồi
 *      chạy CẢ HAI bản cài (apply của ta và apply của chính bundle gốc), so vết gọi seam + kết quả; cộng ca
 *      tập export trên ARTIFACT, ca gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM), ca độc lập vật thể
 *      (C6 danh tính), ca locale chép byte-for-byte (000e) và TEST CANH chưa khai gbh.row.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { apply, inject, name, renderGoalRoundPrompt } from "../../packages/host/goal-round-driver/src/index.ts";
import { buildPackage } from "../../packages/host/goal-round-driver/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "goal-round-driver");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-goal-round-driver");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");

/** Context mà `apply` nhận — suy ra từ CHÍNH chữ ký của ta, không import kiểu kernel (tests/ không resolve @deepseek-ai). */
type OurContext = Parameters<typeof apply>[0];
/** Bản goal mà câu lệnh vòng goal nhận. */
type GoalType = Parameters<typeof renderGoalRoundPrompt>[0];
/** Một khối nội dung model nhìn thấy. */
type BlockType = ReturnType<typeof renderGoalRoundPrompt>[number];

/** Hình dạng bundle GỐC sau khi nạp động (đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình). */
interface StockModule {
  /** Điểm vào của Loader — không nhận tham số cấu hình, chỉ nhận context. */
  apply: (ctx: OurContext) => void;
  /** Ba seam driver chờ. */
  inject: string[];
  /** Tên plugin cordis. */
  name: string;
  /** Câu lệnh một vòng goal. */
  renderGoalRoundPrompt: (goal: GoalType, round: number) => BlockType[];
}

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as StockModule;

/** Chữ ký chung của hai bản cài: cùng nhận một context như nhau. */
type Apply = (ctx: OurContext) => void;

/** Goal giả trong sổ của giàn — ĐÚNG hình dạng mà driver đọc (không hơn). */
interface FakeGoal {
  /** Danh tính goal. */
  id: string;
  /** Revision sống, tăng mỗi lần ghi. */
  revision: number;
  /** Câu mục tiêu của người. */
  objective: string;
  /** Pha bền. */
  phase: "active" | "paused" | "blocked" | "complete";
  /** Quyền tự động (phạm vi tiến trình). */
  activation: "armed" | "disarmed";
  /** Trần vòng. */
  maxGoalRounds: number;
  /** Số vòng đã nhận. */
  roundsStarted: number;
  /** Lý do chặn, chỉ có khi `phase` là `blocked`. */
  blockedReason?: { code: string; message: string };
}

/** Message giả đi qua inbox của giàn. */
interface FakeMessage {
  /** Danh tính message. */
  id: string;
  /** Khối nội dung (message thật do kernel đóng băng nên chỉ đọc). */
  content: readonly { readonly type: string; readonly text?: string }[];
  /** Nguồn message: vòng goal của driver, hay prompt người. */
  source: { readonly kind: string; readonly goalId?: string; readonly revision?: number; readonly round?: number };
}

/** Agent giả: chỉ những thành viên mà driver chạm tới. */
interface FakeAgent {
  /** Mã agent = mã phiên (dùng chung như kernel). */
  id: string;
  /** Phiên đang sống — driver chỉ chuyển DANH TÍNH cho `sessions.flush`. */
  session: { id: string };
  /** Trạng thái vòng đời. */
  status: "idle" | "running";
  /** Hai ranh giới inbox + hai thao tác driver dùng. */
  inbox: {
    /** Prompt chờ riêng một lượt. */
    nextTurn: FakeMessage[];
    /** Input chờ ranh giới bước. */
    nextStep: FakeMessage[];
    /** Đặt một message lên ĐẦU một ranh giới. */
    prepend(target: string, message: FakeMessage): void;
    /** Gỡ một message khỏi inbox. */
    remove(id: string): boolean;
  };
  /** Xếp một lượt follow-up và đánh thức driver. */
  followup(message: FakeMessage): void;
  /** Huỷ lượt đang chạy (cause + tuỳ chọn giữ inbox). */
  cancel(cause: { kind: string }, options?: { keepInbox?: boolean }): void;
  /** Chờ agent yên. */
  whenIdle(): Promise<void>;
}

/** Một lượt ghi sổ goal, ghi dạng chữ để hai bên so được từng phần tử. */
type GoalCall = string;

/** Tuỳ chọn dựng giàn. */
interface HarnessOptions {
  /** Goal ban đầu; `null` = chưa có goal nào. */
  goal?: Partial<FakeGoal> | null;
  /** Số agent trong sổ (mặc định 1). */
  agents?: number;
  /** Trạng thái vòng đời của agent[0] (mặc định `idle`). */
  status?: "idle" | "running";
  /** Trạng thái fiber cordis (mặc định 2 = ACTIVE). */
  fiberState?: number;
  /** Lỗi mà `sessions.flush` ném ra. */
  flushError?: Error;
  /** Có seam `subagents` hay không (mặc định không — kernel cho phép vắng mặt). */
  subagents?: boolean;
  /** `currentInitiator()` trả về agent[0] hay `undefined` (mặc định `undefined`). */
  initiatorIsAgent?: boolean;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: sổ agent, sổ goal, sổ phiên, sổ listener. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: OurContext;
  /** Agent điều khiển được (agent[0]). */
  agent: FakeAgent;
  /** Mọi agent trong sổ, theo thứ tự. */
  agents: FakeAgent[];
  /** Goal hiện tại của agent[0], hoặc `undefined`. */
  goal(): FakeGoal | undefined;
  /** Đặt goal hiện tại (dùng cho ca đổi revision/activation giữa chừng). */
  setGoal(goal: FakeGoal | undefined): void;
  /** Trạng thái fiber — đổi được để đo hàng rào. */
  setFiberState(state: number): void;
  /** Đổi trạng thái vòng đời của agent[0] (mô phỏng kernel chuyển idle ⇄ running). */
  setStatus(status: "idle" | "running"): void;
  /** Lượt gọi sổ goal, theo đúng thứ tự. */
  goalCalls: GoalCall[];
  /** Các lượt ép ghi bền, theo thứ tự (mã phiên). */
  flushes: string[];
  /** Log cảnh báo, nguyên văn. */
  logs: string[];
  /** Nhãn các effect đã đăng ký. */
  effectLabels: string[];
  /** Các message đã được `followup`, đã chuẩn hoá để so. */
  followups: { source: FakeMessage["source"]; text: string }[];
  /** Các lượt `cancel`, dạng chữ. */
  cancels: string[];
  /** Các lượt chờ subagent, dạng chữ. */
  subagentWaits: string[];
  /** Các message đã bị `inbox.remove`, theo thứ tự. */
  removals: string[];
  /** Đăng ký listener của MỘT sự kiện (ném khi chưa đăng ký). */
  listener(event: string): (...args: unknown[]) => unknown;
  /** Phát một sự kiện emit tới mọi listener đã đăng ký. */
  emit(event: string, ...args: unknown[]): void;
  /** Chạy waterfall `agent/pre-step` với một tầng dưới cho trước. */
  preStep(payload: unknown, next: () => Promise<unknown>): Promise<unknown>;
  /** Chờ mọi vòng lái đã khởi động khép lại (kể cả vòng tự hẹn lại). */
  settled(): Promise<void>;
  /** Dỡ plugin: chạy disposer của effect (mô phỏng cordis). */
  dispose(): Promise<void>;
}
/**
 * Dựng một giàn giả.
 * Nhận: tuỳ chọn (goal ban đầu, trạng thái agent, lỗi flush, seam subagent).
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc — mọi thứ driver chạm tới đều ghi vết.
 */
function harness(options: HarnessOptions = {}): Harness {
  /** Danh sách agent, agent[0] là bên điều khiển được. */
  const agents: FakeAgent[] = [];
  const total = options.agents ?? 1;
  for (let index = 0; index < total; index += 1) {
    const id = "s" + String(index + 1);
    const agent: FakeAgent = {
      id,
      session: { id },
      status: index === 0 ? options.status ?? "idle" : "idle",
      inbox: {
        nextTurn: [],
        nextStep: [],
        prepend(target: string, message: FakeMessage): void {
          (target === "next-step" ? agent.inbox.nextStep : agent.inbox.nextTurn).unshift(message);
        },
        remove(idToRemove: string): boolean {
          removals.push(idToRemove);
          for (const list of [agent.inbox.nextStep, agent.inbox.nextTurn]) {
            const at = list.findIndex((candidate) => candidate.id === idToRemove);
            if (at >= 0) {
              list.splice(at, 1);
              return true;
            }
          }
          return false;
        },
      },
      followup(message: FakeMessage): void {
        agent.inbox.nextTurn.push(message);
        followups.push({ source: message.source, text: textOf(message) });
      },
      cancel(cause: { kind: string }, cancelOptions?: { keepInbox?: boolean }): void {
        cancels.push(cause.kind + (cancelOptions?.keepInbox === true ? "+keep" : ""));
      },
      whenIdle(): Promise<void> {
        return Promise.resolve();
      },
    };
    agents.push(agent);
  }
  const primary = agents[0] as FakeAgent;
  let current: FakeGoal | undefined = options.goal === null ? undefined : makeGoal(options.goal);
  const goalCalls: GoalCall[] = [];
  const flushes: string[] = [];
  const logs: string[] = [];
  const effectLabels: string[] = [];
  const followups: { source: FakeMessage["source"]; text: string }[] = [];
  const cancels: string[] = [];
  const subagentWaits: string[] = [];
  const removals: string[] = [];
  const pending: Promise<unknown>[] = [];
  const disposers: (() => unknown)[] = [];
  const listeners = new Map<string, ((...args: unknown[]) => unknown)[]>();
  let fiberState = options.fiberState ?? 2;
  const ctx = {
    agents: {
      get: (id: string): FakeAgent | undefined => agents.find((candidate) => candidate.id === id),
      list: (): FakeAgent[] => agents,
      currentInitiator: (): FakeAgent | undefined => (options.initiatorIsAgent === true ? primary : undefined),
      withoutInitiator<T>(operation: () => T): T {
        const result = operation();
        if (result instanceof Promise) pending.push(result);
        return result;
      },
    },
    goals: {
      get: (agent: FakeAgent): FakeGoal | undefined => (agent === primary ? current : undefined),
      disarm(agent: FakeAgent): FakeGoal | undefined {
        goalCalls.push("disarm:" + agent.id);
        // HỢP ĐỒNG kernel: `disarm` gỡ quyền theo PHẠM VI TIẾN TRÌNH — KHÔNG đổi pha bền, KHÔNG đổi revision.
        if (agent !== primary || current === undefined) return undefined;
        current = { ...current, activation: "disarmed" };
        return current;
      },
      pause(agent: FakeAgent, ref: { revision: number }): FakeGoal | undefined {
        goalCalls.push("pause:" + agent.id + ":" + String(ref.revision));
        return mutateSilently(agent, { phase: "paused", activation: "disarmed" });
      },
      block(agent: FakeAgent, ref: { revision: number }, reason: { code: string; message: string }): FakeGoal | undefined {
        goalCalls.push("block:" + agent.id + ":" + String(ref.revision) + ":" + reason.code + ":" + reason.message);
        return mutateSilently(agent, { phase: "blocked", activation: "disarmed", blockedReason: reason });
      },
    },
    sessions: {
      flush: (session: { id: string }): Promise<boolean> => {
        flushes.push(session.id);
        if (options.flushError !== undefined) return Promise.reject(options.flushError);
        return Promise.resolve(true);
      },
    },
    fiber: {
      get state(): number {
        return fiberState;
      },
    },
    get(name: string): unknown {
      if (name !== "subagents" || options.subagents !== true) return undefined;
      return {
        waitForChildren(agent: FakeAgent): Promise<boolean> {
          subagentWaits.push(agent.id);
          return Promise.resolve(false);
        },
      };
    },
    logger: {
      warn: (message: string): void => {
        logs.push(message);
      },
    },
    on(event: string, listener: (...args: unknown[]) => unknown): () => void {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return () => undefined;
    },
    effect(execute: () => unknown, label?: string): void {
      effectLabels.push(label ?? "");
      const produced = execute();
      if (typeof produced === "function") disposers.push(produced as () => unknown);
      else if (produced !== null && typeof produced === "object" && Symbol.iterator in produced) {
        for (const disposer of produced as Iterable<() => unknown>) disposers.push(disposer);
      }
    },
  };
  /** Ghi một lượt ghi goal TỪ SỔ: chỉ đổi vật thể goal, KHÔNG đẩy thêm dòng vào `goalCalls`. */
  function mutateSilently(agent: FakeAgent, patch: Partial<FakeGoal>): FakeGoal | undefined {
    if (agent !== primary || current === undefined) return undefined;
    current = { ...current, ...patch, revision: current.revision + 1 };
    return current;
  }
  return {
    ctx: ctx as unknown as OurContext,
    agent: primary,
    agents,
    goal: () => current,
    setGoal: (goal: FakeGoal | undefined): void => {
      current = goal;
    },
    setFiberState: (state: number): void => {
      fiberState = state;
    },
    setStatus: (status: "idle" | "running"): void => {
      primary.status = status;
    },
    goalCalls,
    flushes,
    logs,
    effectLabels,
    followups,
    cancels,
    subagentWaits,
    removals,
    listener: (event: string): ((...args: unknown[]) => unknown) => {
      const found = listeners.get(event) ?? [];
      const first = found[0];
      if (first === undefined) throw new Error("chưa đăng ký listener " + event);
      return first;
    },
    emit(event: string, ...args: unknown[]): void {
      for (const registered of listeners.get(event) ?? []) registered(...args);
    },
    async preStep(payload: unknown, next: () => Promise<unknown>): Promise<unknown> {
      return this.listener("agent/pre-step")(payload, next);
    },
    async settled(): Promise<void> {
      for (let round = 0; round < 50; round += 1) {
        if (pending.length === 0) return;
        const batch = pending.splice(0, pending.length);
        await Promise.allSettled(batch);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      throw new Error("vòng lái không khép lại sau 50 lượt chờ");
    },
    async dispose(): Promise<void> {
      while (disposers.length > 0) {
        const disposer = disposers.pop();
        if (disposer !== undefined) await disposer();
      }
    },
  };
}

/**
 * Dựng một goal giả từ các trường cho trước.
 * Nhận: các trường ghi đè (mặc định: goal `active` + `armed`, revision 3, trần 3 vòng, đã nhận 0 vòng).
 * Trả: goal đúng hình dạng sổ goal trả về.
 */
function makeGoal(patch: Partial<FakeGoal> = {}): FakeGoal {
  return {
    id: "goal-1",
    revision: 3,
    objective: "Hoàn tất báo cáo",
    phase: "active",
    activation: "armed",
    maxGoalRounds: 3,
    roundsStarted: 0,
    ...patch,
  };
}

/**
 * Rút chữ của một message để so giữa hai bên (danh tính message là NGẪU NHIÊN nên không so).
 * Nhận: message bất kỳ có `content`. Trả: các khối chữ nối lại bằng xuống dòng.
 */
function textOf(message: { readonly content: readonly { readonly type: string; readonly text?: string }[] }): string {
  return message.content.map((block) => block.text ?? "[" + block.type + "]").join("\n");
}
/** Ảnh chụp một lượt chạy giàn: mọi thứ đo được, đã chuẩn hoá để hai bên so được với nhau. */
interface Snapshot {
  /** Giá trị kịch bản trả về (ví dụ quyết định của hàng rào bước). */
  result: unknown;
  /** Lượt gọi sổ goal, theo đúng thứ tự. */
  goalCalls: string[];
  /** Các lượt ép ghi bền (mã phiên). */
  flushes: string[];
  /** Log cảnh báo, nguyên văn. */
  logs: string[];
  /** Nhãn effect đã đăng ký. */
  effectLabels: string[];
  /** Các message đã xếp hàng, kèm nguồn. */
  followups: { source: FakeMessage["source"]; text: string }[];
  /** Các lượt cancel, dạng chữ. */
  cancels: string[];
  /** Các lượt chờ subagent. */
  subagentWaits: string[];
  /** SỐ message bị gỡ khỏi inbox (id là ngẫu nhiên nên chỉ so số). */
  removals: number;
  /** Trạng thái goal sau khi chạy. */
  goal: FakeGoal | undefined;
  /** Message còn chờ ở ranh giới lượt. */
  nextTurn: string[];
  /** Message còn chờ ở ranh giới bước. */
  nextStep: string[];
}

/**
 * Chạy MỘT kịch bản trên MỘT bản cài rồi chụp lại mọi dấu vết.
 * Nhận: hàm `apply` cần đo, kịch bản (nhận giàn, trả giá trị tuỳ ý), và tuỳ chọn dựng giàn.
 * Trả: ảnh chụp so được giữa bản của ta và bản gốc. Lưu ý: `apply` LUÔN dỡ quyền ở phép quét ban đầu
 *       nên `goalCalls[0]` của mọi kịch bản có goal armed là `disarm:<id>` — kịch bản phải gọi
 *       {@link armGoal} để bật lại quyền y như một lượt `resume` của người dùng.
 */
async function observe(applyFn: Apply, script: (h: Harness) => Promise<unknown>, options: HarnessOptions = {}): Promise<Snapshot> {
  const h = harness(options);
  applyFn(h.ctx);
  const result = await script(h);
  await h.settled();
  return {
    result,
    goalCalls: [...h.goalCalls],
    flushes: [...h.flushes],
    logs: [...h.logs],
    effectLabels: [...h.effectLabels],
    followups: h.followups.map((entry) => ({ source: entry.source, text: entry.text })),
    cancels: [...h.cancels],
    subagentWaits: [...h.subagentWaits],
    removals: h.removals.length,
    goal: h.goal(),
    nextTurn: h.agent.inbox.nextTurn.map(textOf),
    nextStep: h.agent.inbox.nextStep.map(textOf),
  };
}

/** Kịch bản rỗng: chỉ cài plugin rồi chụp (đo phép quét dỡ quyền ban đầu + nhãn effect). */
async function installOnly(): Promise<unknown> {
  return "installed";
}

/**
 * Bật LẠI quyền tự động sau khi plugin cài — mô phỏng lượt `resume` của người dùng.
 * Nhận: giàn có goal. Trả: không; chỉ đổi `activation` (pha bền và revision KHÔNG đổi, đúng như sổ goal).
 */
function armGoal(h: Harness): void {
  const goal = h.goal();
  if (goal === undefined) throw new Error("không có goal để bật quyền");
  h.setGoal({ ...goal, phase: "active", activation: "armed" });
}

/**
 * Xếp MỘT vòng rồi NHẬN nó vào bước y như kernel: claim message, chạy hàng rào `agent/pre-step`,
 * sau đó (nếu bước được nhận) mới tăng `roundsStarted` và ghi sự kiện `user/message`.
 * Nhận: giàn, quyết định mà tầng dưới trả cho waterfall (mặc định: nhận bước).
 * Trả: quyết định hàng rào trả về + message đã xếp hàng (ném khi không có gì để nhận).
 */
async function admitOneRound(
  h: Harness,
  nextDecision: unknown = { kind: "enter", messages: [] },
): Promise<{ decision: unknown; message: FakeMessage }> {
  const message = h.agent.inbox.nextTurn[0];
  if (message === undefined) throw new Error("không có message nào đã xếp hàng để nhận");
  h.agent.inbox.nextTurn.shift();
  h.emit("agent/inbox/claimed", { agent: h.agent, message, turn: 1 });
  const signal = new AbortController().signal;
  const decision = (await h.preStep(
    { agent: h.agent, messages: [message], turn: 1, step: 1, signal },
    () => Promise.resolve(nextDecision),
  )) as { kind?: string };
  if (decision.kind === "enter") {
    const goal = h.goal();
    if (goal !== undefined) h.setGoal({ ...goal, roundsStarted: goal.roundsStarted + 1 });
    h.emit("session/event", h.agent.session, { type: "user/message", seq: 1, time: 0, data: message });
  }
  return { decision, message };
}

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});

describe("row goal-round-driver · đối chứng hành vi với chính bundle gốc", () => {
  test("ca 1: câu lệnh vòng goal TRÙNG TỪNG KÝ TỰ với bản gốc (5 tổ hợp)", () => {
    const cases: [Partial<FakeGoal>, number][] = [
      [{}, 1],
      [{ objective: "" }, 3],
      [{ objective: "Xong \"báo cáo\" ✓ — dòng 2\nkết thúc" }, 2],
      [{ maxGoalRounds: 12, roundsStarted: 11 }, 12],
      [{ objective: "a".repeat(400) }, 1],
    ];
    for (const [patch, round] of cases) {
      const goal = makeGoal(patch) as unknown as GoalType;
      const ours = renderGoalRoundPrompt(goal, round);
      const theirs = stock.renderGoalRoundPrompt(goal, round);
      // So SÂU và so CHUỖI: chuỗi bắt cả thứ tự khoá của khối JSON.
      expect(ours).toEqual(theirs);
      expect(JSON.stringify(ours)).toBe(JSON.stringify(theirs));
    }
    // Ghim nguyên văn ba mốc của câu lệnh — để một "cải tiến" câu chữ bị bắt ngay.
    const pinned = renderGoalRoundPrompt(makeGoal({ objective: "Xong \"báo cáo\" ✓" }) as unknown as GoalType, 2);
    expect(pinned.length).toBe(1);
    const block = pinned[0] as { type: string; text: string };
    expect(block.type).toBe("text");
    expect(block.text.startsWith("<goal_round>\nObjective: ")).toBe(true);
    expect(block.text.endsWith("\n</goal_round>")).toBe(true);
    expect(block.text.includes("\nRound: 2/3\n\nContinue working toward the objective in this same session.")).toBe(true);
    expect(block.text.includes("\"Xong \\\"báo cáo\\\" ✓\"")).toBe(true);
  });

  test("ca 2: agent idle + goal ĐÃ BẬT LẠI ⇒ xếp ĐÚNG MỘT vòng (nguồn + câu lệnh + revision), 0 flush", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return "driven";
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    expect(ours.followups.length).toBe(1);
    const queued = ours.followups[0] as { source: FakeMessage["source"]; text: string };
    expect(queued.source).toEqual({ kind: "goal", goalId: "goal-1", revision: 3, round: 1 });
    expect(queued.text).toBe(textOf({ content: renderGoalRoundPrompt(makeGoal() as unknown as GoalType, 1) }));
    expect(ours.flushes).toEqual([]);
    expect(ours.logs).toEqual([]);
    // Phần tử ĐẦU là phép quét lúc cài; sau đó không có lượt ghi goal nào khác.
    expect(ours.goalCalls).toEqual(["disarm:s1"]);
  });

  test("ca 3: phép quét lúc CÀI dỡ quyền mọi agent đang armed, và chỉ MỘT effect được đăng ký", async () => {
    const ours = await observe(apply, installOnly, { agents: 2 });
    const theirs = await observe(stock.apply, installOnly, { agents: 2 });
    expect(ours).toEqual(theirs);
    // Agent thứ hai KHÔNG có goal ⇒ sổ goal không được gọi cho nó (chỉ agent[0] armed).
    expect(ours.goalCalls).toEqual(["disarm:s1"]);
    expect(ours.effectLabels).toEqual(["goal-round-driver lifecycle"]);
    expect(ours.followups).toEqual([]);
    expect(ours.goal?.activation).toBe("disarmed");
  });

  test("ca 4: chạm trần vòng ⇒ CHẶN với mã round-limit, câu chặn nguyên văn", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return "at-limit";
    };
    const options: HarnessOptions = { goal: { roundsStarted: 3, maxGoalRounds: 3 } };
    const ours = await observe(apply, script, options);
    const theirs = await observe(stock.apply, script, options);
    expect(ours).toEqual(theirs);
    expect(ours.followups).toEqual([]);
    expect(ours.goalCalls).toEqual(["disarm:s1", "block:s1:3:round-limit:Goal reached its configured limit of 3 rounds."]);
    expect(ours.goal?.phase).toBe("blocked");
    expect(ours.goal?.blockedReason).toEqual({ code: "round-limit", message: "Goal reached its configured limit of 3 rounds." });
  });

  test("ca 5: checkpoint ghi bền HỎNG ⇒ log + dỡ quyền, KHÔNG xếp vòng nào", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("goal/changed", { agent: h.agent, change: { operation: "resume", ref: { id: "goal-1", revision: 3 } } });
      return "checkpoint-failed";
    };
    const options: HarnessOptions = { flushError: new Error("dia chi ghi ben hong") };
    const ours = await observe(apply, script, options);
    const theirs = await observe(stock.apply, script, options);
    expect(ours).toEqual(theirs);
    expect(ours.flushes).toEqual(["s1"]);
    expect(ours.logs).toEqual(['goal-round-driver: durability checkpoint failed for agent "s1": dia chi ghi ben hong']);
    expect(ours.goalCalls).toEqual(["disarm:s1", "disarm:s1"]);
    expect(ours.followups).toEqual([]);
  });

  test("ca 6: goal/changed thành công ⇒ checkpoint rồi mới xếp vòng; flush đi TRƯỚC followup", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("goal/changed", { agent: h.agent, change: { operation: "resume", ref: { id: "goal-1", revision: 3 } } });
      return "changed";
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    expect(ours.flushes).toEqual(["s1"]);
    expect(ours.followups.length).toBe(1);
    expect(ours.logs).toEqual([]);
  });

  test("ca 7: goal/changed operation=pause khi agent ĐANG chạy và KHÔNG phải người khởi phát ⇒ cancel user+keepInbox", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("goal/changed", { agent: h.agent, change: { operation: "pause", ref: { id: "goal-1", revision: 3 } } });
      return "paused";
    };
    const options: HarnessOptions = { status: "running" };
    const ours = await observe(apply, script, options);
    const theirs = await observe(stock.apply, script, options);
    expect(ours).toEqual(theirs);
    expect(ours.cancels).toEqual(["user+keep"]);
    expect(ours.followups).toEqual([]);
  });

  test("ca 8: prompt TRANH CHẤP vào inbox ⇒ không lái vòng mới, đặt chỗ cũ thành CŨ", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      const human: FakeMessage = { id: "m-nguoi", content: [{ type: "text", text: "người hỏi" }], source: { kind: "user" } };
      h.agent.inbox.nextTurn.push(human);
      h.emit("agent/inbox/inserted", { agent: h.agent, message: human });
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return "competing";
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    // Vòng 1 đã xếp hàng TRƯỚC khi prompt người tới ⇒ vẫn đúng MỘT followup, không có vòng 2.
    expect(ours.followups.length).toBe(1);
    expect(ours.cancels).toEqual([]);
  });

  test("ca 9: hàng rào bước NHẬN vòng hợp lệ (startsRequestSeries) rồi tăng roundsStarted", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      const admitted = await admitOneRound(h, { kind: "enter", messages: [] });
      return admitted.decision;
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    expect(ours.result).toEqual({ kind: "enter", messages: [], startsRequestSeries: true });
    expect(ours.goal?.roundsStarted).toBe(1);
    // Vòng được nhận KHÔNG đổi revision (roundsStarted là dữ kiện dẫn xuất từ log phiên).
    expect(ours.goal?.revision).toBe(3);
  });

  test("ca 10: goal bị GỠ QUYỀN sau khi claim ⇒ hàng rào TỪ CHỐI, message được đặt lại, không chặn goal", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      const message = h.agent.inbox.nextTurn[0] as FakeMessage;
      h.agent.inbox.nextTurn.shift();
      h.emit("agent/inbox/claimed", { agent: h.agent, message, turn: 1 });
      const goal = h.goal() as FakeGoal;
      h.setGoal({ ...goal, activation: "disarmed" });
      // MỘT message KHÁC cùng bị gỡ khỏi inbox cho bước này ⇒ hàng rào phải ĐẶT LẠI nó, không nuốt.
      const other: FakeMessage = { id: "m-khac", content: [{ type: "text", text: "ngữ cảnh khác" }], source: { kind: "user" } };
      const signal = new AbortController().signal;
      const decision = await h.preStep(
        { agent: h.agent, messages: [other, message], turn: 1, step: 1, signal },
        () => Promise.resolve({ kind: "enter", messages: [] }),
      );
      return decision;
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    expect(ours.result).toEqual({ kind: "reject" });
    expect(ours.nextStep.length).toBe(1);
    expect(ours.nextStep[0]).toBe("ngữ cảnh khác");
    // Hàng rào KHÔNG gọi `inbox.remove`: nó chỉ ĐẶT LẠI message khác; việc gỡ message đã claim thuộc kernel.
    expect(ours.removals).toBe(0);
    // Gỡ quyền ≠ chặn: goal vẫn `active`, chỉ mất quyền tự động.
    expect(ours.goal?.phase).toBe("active");
    expect(ours.goal?.activation).toBe("disarmed");
  });

  test("ca 11: tầng dưới TỪ CHỐI bước ⇒ chặn goal với mã prompt-rejected, trả nguyên quyết định", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      const admitted = await admitOneRound(h, { kind: "reject" });
      return admitted.decision;
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    expect(ours.result).toEqual({ kind: "reject" });
    expect(ours.goalCalls).toEqual(["disarm:s1", "block:s1:3:prompt-rejected:Goal round was rejected before entering its step."]);
    expect(ours.goal?.blockedReason?.code).toBe("prompt-rejected");
    expect(ours.goal?.roundsStarted).toBe(0);
  });

  test("ca 12: turn/end max-tokens ⇒ dỡ quyền NGAY (không chờ vòng sau)", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("session/event", h.agent.session, { type: "turn/end", seq: 2, time: 0, data: { turn: 1, reason: { kind: "max-tokens" } } });
      return "max-tokens";
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    // Phần tử CUỐI là lượt dỡ quyền do max-tokens; phần tử đầu là phép quét lúc cài.
    expect(ours.goalCalls).toEqual(["disarm:s1", "disarm:s1"]);
    expect(ours.goal?.activation).toBe("disarmed");
  });

  test("ca 13: turn/end aborted khi đặt chỗ ĐÃ VÀO phiên ⇒ chỉ đánh dấu canceled (KHÔNG dỡ quyền)", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      await admitOneRound(h);
      const before = [...h.goalCalls];
      h.emit("session/event", h.agent.session, {
        type: "turn/end",
        seq: 3,
        time: 0,
        data: { turn: 1, reason: { kind: "aborted", reason: { kind: "user" } } },
      });
      return before.length;
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    // KHÔNG có lượt ghi goal nào sau khi vòng đã vào phiên: chỉ dỡ quyền lúc cài.
    expect(ours.goalCalls).toEqual(["disarm:s1"]);
    expect(ours.goal?.activation).toBe("armed");
  });

  test("ca 14: turn/end aborted khi KHÔNG có đặt chỗ ⇒ dỡ quyền", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("session/event", h.agent.session, {
        type: "turn/end",
        seq: 2,
        time: 0,
        data: { turn: 1, reason: { kind: "aborted", reason: { kind: "user" } } },
      });
      return "aborted";
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    expect(ours).toEqual(theirs);
    expect(ours.goalCalls).toEqual(["disarm:s1", "disarm:s1"]);
  });

  test("ca 15: seam `subagents` có mặt ⇒ chờ hậu duệ TRƯỚC khi xếp vòng", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return "children";
    };
    const options: HarnessOptions = { subagents: true };
    const ours = await observe(apply, script, options);
    const theirs = await observe(stock.apply, script, options);
    expect(ours).toEqual(theirs);
    expect(ours.subagentWaits).toEqual(["s1"]);
    expect(ours.followups.length).toBe(1);
  });

  test("ca 16: fiber KHÔNG ACTIVE ⇒ không lái, không flush, không xếp vòng", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return "inactive";
    };
    const options: HarnessOptions = { fiberState: 1 };
    const ours = await observe(apply, script, options);
    const theirs = await observe(stock.apply, script, options);
    expect(ours).toEqual(theirs);
    expect(ours.followups).toEqual([]);
    expect(ours.flushes).toEqual([]);
  });

  test("ca 17: DỠ plugin khi agent đang chạy và CÓ đặt chỗ ⇒ dỡ quyền + cancel parent + chờ whenIdle", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      h.setStatus("running");
      return "queued-then-running";
    };
    const h = harness();
    apply(h.ctx);
    await script(h);
    await h.dispose();
    const stockHarness = harness();
    stock.apply(stockHarness.ctx);
    await script(stockHarness);
    await stockHarness.dispose();
    expect(h.cancels).toEqual(stockHarness.cancels);
    expect(h.goalCalls).toEqual(stockHarness.goalCalls);
    expect(h.cancels).toEqual(["parent"]);
    // Hai lượt: phép quét lúc cài + lượt dỡ quyền lúc DỠ plugin.
    expect(h.goalCalls).toEqual(["disarm:s1", "disarm:s1"]);
  });
});
describe("row goal-round-driver · bề mặt plugin đo trên ARTIFACT", () => {
  test("ARTIFACT: tập export = gốc, 0 id module, `name`/`inject`/arity nguyên văn", async () => {
    const file = await buildPackage(ARTIFACT_DIR);
    const code = readFileSync(file, "utf8");
    // Row HOST-ONLY: KHÔNG đăng ký id module nào (bản gốc cũng vậy) ⇒ cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as StockModule;
    // TẬP EXPORT = tập export của bản gốc: 0 thiếu · 0 thừa.
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["apply", "inject", "name", "renderGoalRoundPrompt"]);
    expect("default" in artifact).toBe(false);
    expect(artifact.name).toBe(stock.name);
    expect(artifact.name).toBe("goal-round-driver");
    // `inject` phải TRÙNG cả phần tử lẫn THỨ TỰ (kernel chờ service theo đúng danh sách này).
    expect(artifact.inject).toEqual(stock.inject);
    expect(artifact.inject).toEqual(["agents", "goals", "sessions"]);
    expect(inject).toEqual(artifact.inject);
    expect(name).toEqual(artifact.name);
    // Arity: `apply(ctx)` = 1, `renderGoalRoundPrompt(goal, round)` = 2 — trùng bản gốc.
    expect(artifact.apply.length).toBe(stock.apply.length);
    expect(artifact.apply.length).toBe(1);
    expect(artifact.renderGoalRoundPrompt.length).toBe(stock.renderGoalRoundPrompt.length);
    expect(artifact.renderGoalRoundPrompt.length).toBe(2);
  });

  test("000e: locale en/zh chép byte-for-byte từ gói gốc, và manifest export chúng", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ dùng lúc chạy: `dsh-llm` (`createUserMessage` — factory message của kernel). */
const RUNTIME_PEERS = ["@deepseek-ai/dsh-llm"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Bảng export của gói. */
  exports?: Record<string, string>;
  /** Hợp đồng với trình quản lý gói: một thể hiện do kernel cấp. */
  peerDependencies?: Record<string, string>;
  /** Cấm khai peer ở đây (tạo thể hiện thứ hai). */
  dependencies?: Record<string, string>;
  /** Metadata rewrite của ta. */
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import` — test không resolve `@deepseek-ai/*`).
 * Nhận: không. Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm. Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc. Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("row goal-round-driver · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá hết tên khỏi `gbh.peers` thì phép ⊆ dưới đây ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...RUNTIME_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, đúng phiên bản, và KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(ROOT, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      expect(manifest.peerDependencies?.[peer]).toBe(kernel.version);
      expect(deps.has(peer)).toBe(false);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const mutated = cloneManifest(readManifest());
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
  });
});

describe("row goal-round-driver · C6: vật thể ĐỘC LẬP theo DANH TÍNH", () => {
  test("mỗi lượt dựng câu lệnh trả MẢNG + KHỐI mới; sửa bản này KHÔNG lan sang bản kia", () => {
    const goal = makeGoal() as unknown as GoalType;
    const left = renderGoalRoundPrompt(goal, 1);
    const right = renderGoalRoundPrompt(goal, 1);
    // Phép so SÂU ĐẠT (giá trị bằng nhau) nhưng DANH TÍNH khác — đúng lớp lỗi C6.
    expect(left).toEqual(right);
    expect(left).not.toBe(right);
    const leftBlock = left[0] as { text: string };
    expect(leftBlock).not.toBe(right[0] as unknown);
    leftBlock.text = "SỬA BẢN TRÁI";
    expect((right[0] as { text: string }).text).not.toBe("SỬA BẢN TRÁI");
  });

  test("hai thể hiện driver (hai giàn riêng) chạy cùng kịch bản ⇒ hai sổ goal độc lập", async () => {
    const drive = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return null;
    };
    const first = await observe(apply, drive);
    const second = await observe(apply, drive);
    expect(first.followups.length).toBe(1);
    expect(second.followups.length).toBe(1);
    // Hai vật thể message RIÊNG (id ngẫu nhiên khác nhau) — không có hằng chia sẻ giữa hai lượt.
    expect(first.followups[0]).not.toBe(second.followups[0]);
    expect(first.goalCalls).toEqual(["disarm:s1"]);
    expect(second.goalCalls).toEqual(["disarm:s1"]);
  });

  test("hai vòng liên tiếp trong CÙNG một giàn ⇒ hai message RIÊNG, số vòng tăng đúng một", async () => {
    const script = async (h: Harness): Promise<unknown> => {
      armGoal(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      await h.settled();
      const first = await admitOneRound(h);
      h.emit("agent/status", { agent: h.agent, status: "idle" });
      return first.message.id;
    };
    const ours = await observe(apply, script);
    const theirs = await observe(stock.apply, script);
    // `result` là id message NGẪU NHIÊN của từng bên ⇒ so phần còn lại, rồi so DANH TÍNH riêng.
    const { result: oursId, ...oursRest } = ours;
    const { result: theirsId, ...theirsRest } = theirs;
    expect(oursRest).toEqual(theirsRest);
    expect(ours.followups.length).toBe(2);
    expect(ours.followups.map((entry) => entry.source.round)).toEqual([1, 2]);
    expect(ours.goal?.roundsStarted).toBe(1);
    // Vòng 1 của HAI bên là hai message RIÊNG (id ngẫu nhiên) — không dùng lại vật thể của nhau.
    expect(typeof oursId).toBe("string");
    expect(oursId).not.toBe(theirsId);
    // Vòng 1 đã được nhận vào bước (bị chính test gỡ), vòng 2 còn chờ ⇒ đúng MỘT message trong inbox.
    expect(ours.nextTurn.length).toBe(1);
    // Không lượt `inbox.remove` nào: driver chỉ gỡ message của mình ở nhánh agent/idle-bị-huỷ, không ở đây.
    expect(ours.removals).toBe(0);
  });
});

describe("row goal-round-driver · cổng an toàn mount", () => {
  
  test("package KHÔNG được kéo bất kỳ gói @galaxy-stack nào (luật bất biến)", () => {
    expect(readFileSync(MANIFEST, "utf8").includes("@galaxy-stack/")).toBe(false);
  });
});