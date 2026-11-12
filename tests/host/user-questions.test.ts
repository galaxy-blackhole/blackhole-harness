/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-user-questions (row user-questions): tập export đo trên
 *      ARTIFACT, đối chứng taxonomy lỗi + phép gấp chiếu + bề mặt Remote + đường hỏi có hẹn giờ với
 *      CHÍNH bundle gốc, và hợp đồng 'vật mang phạm vi' mà dsh-api-remotes đòi.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, symlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
/**
 * Đổi một đường dẫn tương đối (theo CHÍNH file test) thành đường dẫn tuyệt đối.
 * Vì sao cần: readFile nhận đường dẫn tương đối theo CWD của tiến trình, còn import() theo file —
 * dùng chung một gốc để hai phép đo không lệch nhau.
 * @param relative - đường dẫn tương đối từ file test này.
 * @returns đường dẫn tuyệt đối.
 */
function here(relative: string): string {
  return new URL(relative, import.meta.url).pathname;
}

import { buildPackage } from "../../packages/host/user-questions/build.ts";
import { userQuestionProjectionDefinition } from "../../packages/host/user-questions/src/projection.ts";
import { isTimedAskUserQuestionSchema } from "../../packages/host/user-questions/src/schemas.ts";
import type {
  Agent,
  AgentsRegistry,
  AskUserQuestionAnswer,
  AskUserQuestionRequest,
  Session,
  UserQuestionProjectionState,
} from "../../packages/host/user-questions/src/types.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca A/B. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-user-questions/lib/index.js";
/** Bản build CỦA TA — mọi phép đo 'trên artifact' đọc đúng file này. */
const OURS = "../../packages/host/user-questions/lib/index.js";
/** Thư mục `@deepseek-ai` của KERNEL — mount thật symlink MỌI peer về đây, nên rig cũng phải nạp từ đây. */
const KERNEL_AI = here("../../apps/host/node_modules/@deepseek-ai");
/** Thư mục build tạm cho artefact ĐEM NẠP (nằm dưới node_modules của gói: gitignore + cổng lint miễn trừ). */
const BUILD_DIR = here("../../packages/host/user-questions/node_modules/.test-lib");
// LƯỢT ĐO 01/11/2026: bản của TA nạp từ ARTEFACT trong "profile giả" — `@deepseek-ai/*` trỏ KERNEL, đúng cách
// mount thật symlink peer. Nạp thẳng `src/index.ts` thì `@deepseek-ai/dsh-scope` phân giải về bản sao workspace
// (cùng nội dung, KHÁC mô-đun) nên `carrierKeyOf` của kernel không nhận ra vật mang của ta (1 ca đỏ).
const OURS_BUILT = await buildPackage(BUILD_DIR);
mkdirSync(join(BUILD_DIR, "node_modules"), { recursive: true });
symlinkSync(KERNEL_AI, join(BUILD_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(BUILD_DIR, "node_modules", "@galaxy-blackhole"), "dir");

/** Bề mặt module của bản TA (nạp từ artefact). */
const oursModule = (await import(OURS_BUILT)) as {
  /** Tham số hẹn giờ của tool. */
  TIMED_WAIT_PARAMETER: string;
  /** Lớp lỗi miền của row. */
  UserQuestionError: new (message: string, code: string) => Error & { code: string };
  /** Lớp service. */
  UserQuestionService: new (ctx: never) => unknown;
};
/** Bản của TA: ba tên dùng chung cho mọi ca. */
const { TIMED_WAIT_PARAMETER, UserQuestionError, UserQuestionService } = oursModule;

/** Đọc marker Remote qua ĐÚNG gói kernel cấp (một thể hiện duy nhất với bản gốc). */
const { remoteMethods } = (await import(join(KERNEL_AI, "dsh-typert-protocol", "lib", "index.js"))) as {
  remoteMethods: (service: unknown) => { method: string; mode?: string }[];
};
/** Nhận diện vật mang phạm vi qua ĐÚNG gói kernel cấp (cùng khoá `Symbol` với bản gốc). */
const { carrierKeyOf } = (await import(join(KERNEL_AI, "dsh-scope", "lib", "index.js"))) as { carrierKeyOf: (value: unknown) => unknown };
/** Lớp lỗi gốc của kernel — cũng là lớp cha của lỗi miền của ta. */
const { HarnessError } = (await import(join(KERNEL_AI, "dsh-llm", "lib", "index.js"))) as { HarnessError: new (...args: never[]) => Error };

/** Dọn thư mục build tạm sau khi xong. */
afterAll(() => {
  rmSync(BUILD_DIR, { recursive: true, force: true });
});

/** Bản gốc đã nạp; kiểu để hở vì đây là bundle đã build của gói khác. */
type StockModule = {
  UserQuestionService: new (ctx: never) => unknown;
  UserQuestionError: new (message: string, code: string) => Error & { code: string };
  TIMED_WAIT_PARAMETER: string;
  isTimedAskUserQuestionSchema: (tool: { name: string; parameters: Record<string, unknown> }) => boolean;
};

/** Một đơn vị chiếu đã đăng ký, ở dạng test cần. */
interface RegisteredProjection {
  /** Khai báo lại phần đăng ký (để đọc lại định nghĩa từ phòng test). */
  readonly key: string;
  /** Trạng thái ban đầu. */
  init(header: unknown, inheritedEventCount: number): UserQuestionProjectionState;
  /** Áp một sự kiện. */
  apply(state: UserQuestionProjectionState, event: unknown): UserQuestionProjectionState;
  /** Phần dây: rút ảnh chụp. */
  wire: { view(state: UserQuestionProjectionState): unknown };
}

/** Một người trả lời giả trong vòng đua: trả giá trị, hoặc ném để từ chối. */
type Answerer = (request: AskUserQuestionRequest) => AskUserQuestionAnswer;

/** Phòng test: context giả, sổ chiếu giả, agent giả, và bộ lái sự kiện phiên. */
interface Harness {
  /** Context giả truyền cho constructor của service. */
  ctx: never;
  /** Đơn vị chiếu đã được service đăng ký (khoá theo key). */
  projections: Map<string, RegisteredProjection>;
  /** Bộ lái một sự kiện phiên qua MỌI đơn vị chiếu đã đăng ký. */
  drive(session: Session, event: unknown): void;
  /** Ảnh chụp đã qua schema của một phiên. */
  view(session: Session): unknown;
  /** Vật mang phạm vi mà lần gọi waterfall gần nhất nhận (undefined nếu gọi không có 'this'). */
  lastCarrier(): unknown;
}

/**
 * Dựng phòng test cho MỘT lớp service (của ta hoặc của gốc — cùng một phòng, nên mọi khác biệt đo
 * được đều quy về chính lớp đó).
 * Nhận: Service — lớp service cần dựng; options — người trả lời giả và sổ agent giả.
 * Trả: phòng test kèm bộ lái sự kiện.
 */
function harness(
  Service: new (ctx: never) => unknown,
  options: { answerers?: Answerer[]; agents?: AgentsRegistry } = {},
): Harness {
  const projections = new Map<string, RegisteredProjection>();
  const states = new Map<Session, UserQuestionProjectionState>();
  let carrier: unknown;
  const registry = {
    register(definition: RegisteredProjection): unknown {
      projections.set(definition.key, definition);
      return undefined;
    },
    stateOf(session: Session): UserQuestionProjectionState | undefined {
      return states.get(session);
    },
  };
  const context = {
    reflect: { provide: () => () => undefined },
    get: (name: string) => (name === "agents" ? options.agents : name === "sessionProjections" ? registry : undefined),
    inject: (deps: readonly string[], callback: (ctx: { sessionProjections: typeof registry }) => void) => {
      if (deps.includes("sessionProjections")) callback({ sessionProjections: registry });
      return undefined;
    },
    effect: (callback: () => () => void) => callback(),
    on: () => () => undefined,
    waterfall: (...args: unknown[]) => {
      const list = [...args];
      if (typeof list[0] === "object" || typeof list[0] === "function") carrier = list.shift();
      list.shift();
      const fallback = list.pop() as () => Promise<unknown>;
      const request = list[0] as AskUserQuestionRequest;
      const answerer = (options.answerers ?? [])[0];
      return Promise.resolve().then(() => (answerer === undefined ? fallback() : answerer(request)));
    },
  };
  new Service(context as never);
  return {
    ctx: context as never,
    projections,
    drive: (session, event) => {
      for (const definition of projections.values()) {
        const current = states.get(session) ?? definition.init({}, 0);
        states.set(session, definition.apply(current, event));
      }
    },
    view: (session) => {
      const definition = projections.get("userQuestions") as unknown as {
        wire: { viewSchema: { parse(value: unknown): unknown }; view(state: UserQuestionProjectionState): unknown };
      };
      const state = states.get(session);
      if (definition === undefined || state === undefined) return undefined;
      return definition.wire.viewSchema.parse(definition.wire.view(state));
    },
    lastCarrier: () => carrier,
  };
}

/**
 * Một agent giả đang sống, có phiên và hộp thư rỗng.
 * Nhận: session — phiên mà agent sở hữu.
 * Trả: agent giả.
 */
function fakeAgent(session: Session): Agent {
  return { id: "session-1", session, inbox: { nextTurn: [], nextStep: [] }, steer: () => undefined };
}

/**
 * Sổ agent giả chỉ chứa đúng một agent gốc.
 * Nhận: agent — agent gốc.
 * Trả: sổ đăng ký giả.
 */
function fakeAgents(agent: Agent): AgentsRegistry {
  return { get: (id: string) => (id === agent.id ? agent : undefined), roots: () => [agent] };
}

/** Một câu hỏi mẫu. */
const QUESTION = { id: "q1", question: "Tiếp tục?", options: [{ label: "Có" }, { label: "Không" }] };

/** Tham số tool mẫu của một lời gọi có hẹn giờ. */
const CALL_ARGUMENTS = JSON.stringify({
  questions: [{ id: "q1", question: "Tiếp tục?", options: [{ label: "Có" }, { label: "Không" }], multi_select: false }],
});

/**
 * Chạy một thao tác và cô đọng kết cục thành chuỗi so sánh được.
 * Nhận: run — thao tác bất đồng bộ.
 * Trả: chuỗi 'ok:…' hoặc 'TênLỗi/mã/chữ'.
 */
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    const value = error as { name?: string; code?: string; message?: string };
    return [value.name, value.code, value.message].join("/");
  }
}

describe("row user-questions — tập export trên ARTIFACT", () => {
  test("ca 1: artifact của ta có ĐÚNG tập export của bundle gốc", async () => {
    const ours = (await import(OURS)) as Record<string, unknown>;
    const stock = (await import(STOCK)) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([
      "TIMED_WAIT_PARAMETER",
      "UserQuestionError",
      "UserQuestionService",
      "default",
      "isTimedAskUserQuestionSchema",
    ]);
    expect(ours["default"]).toBe(ours["UserQuestionService"]);
  });

  test("ca 1b: artifact là row HOST-ONLY — 0 đăng ký id module, 0 id của gói gốc", async () => {
    const text = await readFile(here(OURS), "utf8");
    expect(text.includes("__ModuleLoader__")).toBe(false);
    expect(text.match(/id: "@deepseek-ai/g) ?? []).toHaveLength(0);
    const build = await readFile(here("../../packages/host/user-questions/build.ts"), "utf8");
    expect(build.includes("process.argv[2]")).toBe(true);
    expect(build.includes("outDir ??")).toBe(true);
  });
});

describe("row user-questions — A/B với chính bundle gốc", () => {
  test("ca 2: TIMED_WAIT_PARAMETER và isTimedAskUserQuestionSchema khớp từng ca", async () => {
    const stock = (await import(STOCK)) as StockModule;
    expect(TIMED_WAIT_PARAMETER).toBe(stock.TIMED_WAIT_PARAMETER);
    const cases: { name: string; parameters: Record<string, unknown> }[] = [
      { name: "ask_user_question", parameters: { properties: { timeout: { type: "number" } } } },
      { name: "ask_user_question", parameters: { properties: { questions: {} } } },
      { name: "ask_user_question", parameters: { properties: {} } },
      { name: "ask_user_question", parameters: {} },
      { name: "other_tool", parameters: { properties: { timeout: {} } } },
    ];
    for (const item of cases) {
      expect(isTimedAskUserQuestionSchema(item)).toBe(stock.isTimedAskUserQuestionSchema(item));
    }
    expect(cases.map((item) => isTimedAskUserQuestionSchema(item))).toEqual([true, false, false, false, false]);
  });

  test("ca 3: bề mặt Remote (số phương thức · chế độ stream · thứ tự) khớp gốc", async () => {
    const stock = (await import(STOCK)) as StockModule;
    const ours = new UserQuestionService(harness(UserQuestionService).ctx);
    const theirs = new stock.UserQuestionService(harness(stock.UserQuestionService).ctx);
    const surface = (service: unknown): { method: string; mode?: string }[] => remoteMethods(service as never) as never;
    expect(surface(ours)).toEqual(surface(theirs));
    expect(surface(ours).map((marker) => [marker.method, marker.mode ?? "direct"])).toEqual([
      ["answer", "direct"],
      ["attachWait", "stream"],
    ]);
  });

  test("ca 4: taxonomy lỗi của ask/askTimed/answer/attachWait khớp gốc từng ca", async () => {
    const stock = (await import(STOCK)) as StockModule;
    const session = {};
    const agent = fakeAgent(session);
    const build = (Service: new (ctx: never) => unknown, agents: AgentsRegistry): Service4 => {
      const room = harness(Service, { agents });
      return new Service(room.ctx) as never as Service4;
    };
    const ours = build(UserQuestionService, fakeAgents(agent));
    const theirs = build(stock.UserQuestionService, fakeAgents(agent));
    const delegated: AgentsRegistry = { get: (id) => (id === agent.id ? agent : undefined), roots: () => [] };
    const oursDelegated = build(UserQuestionService, delegated);
    const theirsDelegated = build(stock.UserQuestionService, delegated);
    const stranger: Agent = { ...fakeAgent(session), id: "session-2" };
    const aborted = new AbortController();
    aborted.abort();
    const idle = new AbortController();
    const scenarios: [string, (service: Service4, delegated: Service4) => Promise<string>][] = [
      ["không có câu hỏi", (service) => outcome(() => service.ask({ questions: [] }))],
      [
        "ý định thiếu chi tiết",
        (service) =>
          outcome(() =>
            service.ask({ questions: [{ id: "q", question: "Q", options: [{ label: "Có" }], intent: { kind: "plan-review", approve: "Có" } }] }),
          ),
      ],
      [
        "nhãn đồng ý không thuộc lựa chọn",
        (service) =>
          outcome(() =>
            service.ask({
              questions: [{ id: "q", question: "Q", detail: "d", options: [{ label: "Có" }], intent: { kind: "plan-review", approve: "Không có" } }],
            }),
          ),
      ],
      ["không ai trả lời", (service) => outcome(() => service.ask({ questions: [QUESTION] }))],
      ["tín hiệu đã huỷ", (service) => outcome(() => service.ask({ questions: [QUESTION], signal: aborted.signal }))],
      ["agent không sống", (service) => outcome(() => service.ask({ questions: [QUESTION], agent: stranger }))],
      ["agent bị uỷ quyền", (_service, delegatedService) => outcome(() => delegatedService.ask({ questions: [QUESTION], agent }))],
      ["thời lượng 0", (service) => outcome(() => service.askTimed({ questions: [QUESTION], agent }, "call-1", 0))],
      ["thời lượng 1.5", (service) => outcome(() => service.askTimed({ questions: [QUESTION], agent }, "call-1", 1.5))],
      ["answer khi agent không sống", (service) => outcome(async () => service.answer(stranger, "call-1", { answers: [] }))],
      [
        "attachWait khi agent không sống",
        (service) => outcome(async () => service.attachWait(stranger, "call-1", idle.signal)[Symbol.asyncIterator]().next()),
      ],
    ];
    for (const [label, run] of scenarios) {
      const mine = await run(ours, oursDelegated);
      const theirResult = await run(theirs, theirsDelegated);
      expect([label, mine]).toEqual([label, theirResult]);
    }
  });

  test("ca 5: phép gấp chiếu khớp gốc SAU TỪNG sự kiện", async () => {
    const stock = (await import(STOCK)) as StockModule;
    const ours = harness(UserQuestionService);
    const theirs = harness(stock.UserQuestionService);
    const session = {};
    const pending = JSON.stringify({ pending: true, callId: "call-1" });
    const events: unknown[] = [
      { seq: 0, type: "request/header", data: { header: { tools: [{ name: "ask_user_question", parameters: { properties: { questions: {} } } }] } } },
      { seq: 1, type: "tool/call", data: { name: "ask_user_question", callId: "call-0", arguments: CALL_ARGUMENTS } },
      { seq: 2, type: "request/header", data: { header: { tools: [{ name: "ask_user_question", parameters: { properties: { timeout: { type: "number" } } } }] } } },
      { seq: 3, type: "tool/call", data: { name: "ask_user_question", callId: "call-1", arguments: CALL_ARGUMENTS } },
      { seq: 4, type: "tool/result", data: { message: { toolCallId: "call-1", content: [{ type: "text", text: pending }] } } },
      {
        seq: 5,
        type: "user/message",
        data: {
          id: "m-1",
          source: { kind: "user-question-reply", callId: "call-1" },
          content: [{ type: "text", text: JSON.stringify({ answers: [{ id: "q1", selected: ["Có"] }] }) }],
        },
      },
      { seq: 6, type: "tool/call", data: { name: "ask_user_question", callId: "call-2", arguments: CALL_ARGUMENTS } },
      { seq: 7, type: "tool/result", data: { message: { toolCallId: "call-2", content: [] }, error: { code: "TOOL_OUTCOME_UNKNOWN" } } },
      { seq: 8, type: "tool/call", data: { name: "ask_user_question", callId: "call-3", arguments: CALL_ARGUMENTS } },
      {
        seq: 9,
        type: "tool/result",
        data: {
          message: {
            toolCallId: "call-3",
            content: [{ type: "text", text: JSON.stringify({ answers: [{ id: "q1", selected: ["Không"], custom: "vì lý do" }] }) }],
          },
        },
      },
      {
        seq: 10,
        type: "tool/ptc-dispatch",
        data: { name: "ask_user_question", subCallId: "call-4", arguments: { questions: [{ id: "q1", question: "Tiếp tục?" }] }, content: [{ type: "text", text: pending }] },
      },
      { seq: 11, type: "tool/call", data: { name: "other_tool", callId: "call-5", arguments: CALL_ARGUMENTS } },
      { seq: 12, type: "turn/end", data: {} },
      { seq: 13, type: "tool/result", data: { message: { toolCallId: "call-4", isError: true, content: [] } } },
    ];
    for (const [index, event] of events.entries()) {
      ours.drive(session, event);
      theirs.drive(session, event);
      expect([index, ours.view(session)]).toEqual([index, theirs.view(session)]);
    }
    const view = ours.view(session) as { active: { callId: string; state: string }[]; settled: { callId: string }[] };
    expect(view.active.map((item) => [item.callId, item.state])).toEqual([["call-2", "continued"]]);
    expect(view.settled.map((item) => item.callId)).toEqual(["call-1", "call-3"]);
  });

  test("ca 6: đường hỏi có hẹn giờ + vật mang phạm vi khớp gốc và đúng hợp đồng của api-remotes", async () => {
    const stock = (await import(STOCK)) as StockModule;
    const answer: AskUserQuestionAnswer = { answers: [{ id: "q1", selected: ["Có"] }] };
    const session = {};
    const agent = fakeAgent(session);
    const run = async (room: Harness, Service: new (ctx: never) => unknown): Promise<string> => {
      const service = new Service(room.ctx) as Service4;
      return outcome(() => service.askTimed({ questions: [QUESTION], agent }, "call-1", 5000));
    };
    const oursAnswered = harness(UserQuestionService, { agents: fakeAgents(agent), answerers: [() => answer] });
    const theirsAnswered = harness(stock.UserQuestionService, { agents: fakeAgents(agent), answerers: [() => answer] });
    const mine = await run(oursAnswered, UserQuestionService);
    const theirResult = await run(theirsAnswered, stock.UserQuestionService);
    expect(mine).toBe(theirResult);
    expect(JSON.parse(mine.slice(3))).toEqual(answer);
    // dsh-api-remotes chỉ nhận sự kiện khi 'this' là VẬT MANG của @deepseek-ai/dsh-scope (tra bằng
    // WeakMap nội bộ của chính gói đó) — sai vật mang là NO_PROVIDER và UI không bao giờ thấy câu hỏi.
    expect(carrierKeyOf(oursAnswered.lastCarrier() as never)).toBe(agent);
    expect(carrierKeyOf(theirsAnswered.lastCarrier() as never)).toBe(agent);
    const timeoutRejection = (): Error => {
      const error = new Error("ask_user_question timed out before the user answered");
      error.name = "UserQuestionError";
      (error as Error & { code?: string }).code = "ASK_TIMED_OUT";
      return error;
    };
    const oursTimedOut = harness(UserQuestionService, {
      agents: fakeAgents(agent),
      answerers: [
        () => {
          throw timeoutRejection();
        },
      ],
    });
    const theirsTimedOut = harness(stock.UserQuestionService, {
      agents: fakeAgents(agent),
      answerers: [
        () => {
          throw timeoutRejection();
        },
      ],
    });
    const mineTimedOut = await run(oursTimedOut, UserQuestionService);
    expect(mineTimedOut).toBe(await run(theirsTimedOut, stock.UserQuestionService));
    expect(mineTimedOut).toBe('ok:{"pending":true,"callId":"call-1"}');
  });

  test("ca 7: answer() đẩy lời đáp vào agent — nguồn và thân tin nhắn khớp gốc", async () => {
    const stock = (await import(STOCK)) as StockModule;
    const session = {};
    const steered: unknown[] = [];
    const agent: Agent = { ...fakeAgent(session), steer: (message) => steered.push(message) };
    const timeline = (room: Harness): void => {
      room.drive(session, {
        seq: 0,
        type: "request/header",
        data: { header: { tools: [{ name: "ask_user_question", parameters: { properties: { timeout: { type: "number" } } } }] } },
      });
      room.drive(session, { seq: 1, type: "tool/call", data: { name: "ask_user_question", callId: "call-1", arguments: CALL_ARGUMENTS } });
      room.drive(session, {
        seq: 2,
        type: "tool/result",
        data: { message: { toolCallId: "call-1", content: [{ type: "text", text: JSON.stringify({ pending: true }) }] } },
      });
    };
    const call = async (Service: new (ctx: never) => unknown): Promise<string[]> => {
      const room = harness(Service, { agents: fakeAgents(agent) });
      const service = new Service(room.ctx) as Service4;
      timeline(room);
      return [
        await outcome(async () => service.answer(agent, "call-1", { answers: [{ id: "q1", selected: ["Có"] }] })),
        await outcome(async () => service.answer(agent, "call-1", { answers: [{ id: "q1", selected: ["Có"] }] })),
        await outcome(async () => service.answer(agent, "khong-co", { answers: [{ id: "q1", selected: ["Có"] }] })),
      ];
    };
    const mine = await call(UserQuestionService);
    expect(mine).toEqual(await call(stock.UserQuestionService));
    expect(mine).toEqual(["ok:true", "UserQuestionError/REPLY_QUEUED/a reply is already queued for this question", "ok:false"]);
    const first = steered[0] as { role: string; source: unknown; content: { text: string }[] };
    const second = steered[1] as typeof first;
    expect([first.role, first.source]).toEqual(["user", { kind: "user-question-reply", callId: "call-1", outcome: "answered" }]);
    expect(first.content[0]?.text).toBe(second.content[0]?.text);
    expect(JSON.parse(first.content[0]?.text ?? "{}")).toEqual({
      kind: "answer_to_pending_question",
      tool: "ask_user_question",
      callId: "call-1",
      questions: [{ id: "q1", question: "Tiếp tục?", options: [{ label: "Có" }, { label: "Không" }], multiSelect: false }],
      answers: [{ id: "q1", selected: ["Có"] }],
    });
    expect(
      await outcome(async () => {
        const room = harness(UserQuestionService, { agents: fakeAgents(agent) });
        const service = new UserQuestionService(room.ctx) as never as Service4;
        timeline(room);
        return service.answer(agent, "call-1", { answers: [] });
      }),
    ).toContain("UserQuestionError/BAD_ANSWER/");
  });

  test("ca 8: chi tiết lỗi khớp gốc; schema chiếu từ chối callId trùng ở CẢ HAI bản", async () => {
    const stock = (await import(STOCK)) as StockModule;
    const ours = new UserQuestionError("m", "C");
    const theirs = new stock.UserQuestionError("m", "C");
    expect([ours.name, ours.code, ours.message, ours instanceof Error]).toEqual([theirs.name, theirs.code, theirs.message, true]);
    expect(ours.name).toBe("UserQuestionError");
    // HỢP ĐỒNG LIÊN GÓI 1 (đo được, phải giữ): dsh-tools chỉ ghi { name, code } vào kết quả tool khi
    // lỗi là thể hiện của CHÍNH HarnessError mà kernel cấp — peer @deepseek-ai/dsh-llm bảo đảm điều đó.
    expect(ours instanceof HarnessError).toBe(true);
    // KHÁC BIỆT ĐÃ BIẾT (không giấu): dsh-plan-mode (gói gốc, chưa thay) bắt lỗi bằng
    // 'cause instanceof UserQuestionError' với lớp của GÓI GỐC, nên thể hiện của TA không thoả.
    // Hệ quả: nhánh ASK_CANCELLED của plan-review rơi vào 'throw cause' thay vì trả { approved: false }.
    // Khẳng định thành test để người sau THẤY nó, không phải đọc chú thích.
    expect(ours instanceof stock.UserQuestionError).toBe(false);
    const repeated = {
      inheritedEventCount: 0,
      timed: true,
      questions: {
        active: [
          { callId: "call-1", questions: [{ id: "q1", question: "Q" }], state: "open" },
          { callId: "call-1", questions: [{ id: "q1", question: "Q" }], state: "open" },
        ],
        settled: [],
      },
    };
    const rejected = (definition: unknown): string => {
      try {
        (definition as { stateSchema: { parse(value: unknown): unknown } }).stateSchema.parse(repeated);
        return "khong-nem";
      } catch (error) {
        return error instanceof Error ? "nem" : String(error);
      }
    };
    const theirsDefinition = harness(stock.UserQuestionService).projections.get("userQuestions");
    expect(rejected(userQuestionProjectionDefinition)).toBe("nem");
    expect(rejected(theirsDefinition)).toBe("nem");
  });
});

describe("row user-questions — luật đóng gói của repo", () => {
  });

/** Bề mặt service mà các ca test gọi tới (đủ để so hành vi giữa hai bản). */
interface Service4 {
  /** Hỏi người dùng qua vòng đua. */
  ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer>;
  /** Hỏi có hẹn giờ. */
  askTimed(request: AskUserQuestionRequest & { agent: Agent }, callId: string, timeoutMs: number): Promise<unknown>;
  /** Trả lời một câu hỏi đã chuyển lượt. */
  answer(agent: Agent, callId: string, answer: AskUserQuestionAnswer): boolean;
  /** Giữ một lượt chờ nền. */
  attachWait(agent: Agent, callId: string, signal: AbortSignal): AsyncIterable<unknown>;
}
