/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-host-tool-ask-user: dựng HAI giàn GIỐNG HỆT NHAU trên Context cordis THẬT rồi cài CẢ HAI bản (của ta + chính bundle gốc @deepseek-ai/dsh-tool-ask-user) — so tập export, Config (cùng là instance của lớp Schema THẬT của schemastery), tên/mô tả/tham số/hình dạng tool, đăng ký, mọi nhánh execute legacy/timed và các nhánh lỗi; không gọi mạng.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-ask-user/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "tool-ask-user");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-ask-user");
/**
 * Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp cordis/schemastery/… cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ `instanceof` và `getPrototypeOf` TRƯỢT. Dựng artefact
 * rồi symlink ĐÚNG thư mục kernel vào node_modules của nó (pattern tests/host/shell.test.ts) thì hai
 * bên dùng CHUNG một lớp.
 */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Bundle gốc đã build. */
const STOCK_BUNDLE = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** schemastery của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Schema. */
const SCHEMASTER = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs");

/** Context cordis THẬT (không phải object giả). */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** Lớp `Schema` THẬT của schemastery (default export của gói): dùng cho phép thử `instanceof`. */
const { default: SchemaClass } = (await import(SCHEMASTER)) as { default: abstract new (...args: never[]) => object };
/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK_BUNDLE)) as unknown as ModuleLike;
/** Bản của ta (ARTEFACT đã build trong beforeAll) nhìn qua CÙNG hình dạng để so hai bên. */
let mine: ModuleLike;

/** Đường dẫn ARTIFACT của ta (gán trong beforeAll). */
let artifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-tool-ask-user-"));
  artifact = await buildPackage(outDir);
  mkdirSync(join(outDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(outDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(outDir, "node_modules", "@galaxy-blackhole"), "dir");
  mine = (await import(artifact)) as unknown as ModuleLike;
}, 60_000);

afterAll(() => {
  if (outDir !== "") rmSync(outDir, { recursive: true, force: true });
});

/** Một schema lá tối thiểu mà Config công bố cho loader. */
interface LooseSchemaNode {
  /** In nút thành chuỗi. */
  toString(): string;
  /** Metadata của nút. */
  readonly meta: unknown;
  /** Kiểu nút. */
  readonly type: string;
}

/** Schema Config nhìn qua hình dạng cấu trúc. */
interface LooseConfig {
  /** Gọi schema để kiểm/điền mặc định. */
  (value?: unknown): unknown;
  /** In schema thành chuỗi. */
  toString(): string;
  /** Rút gọn cấu hình. */
  simplify(value: unknown): unknown;
  /** Hai nút con. */
  readonly dict: Record<string, LooseSchemaNode>;
  /** Metadata nút gốc. */
  readonly meta: unknown;
  /** Giao thức Standard Schema. */
  readonly "~standard": { validate(value: unknown): unknown };
}

/** Hình dạng module mà test dùng để so hai bản. */
interface ModuleLike {
  /** Tên plugin. */
  readonly name: string;
  /** Service bắt buộc. */
  readonly inject: string[];
  /** Schema cấu hình. */
  readonly Config: LooseConfig;
  /** Cài row. */
  apply(ctx: unknown, config?: unknown): void;
}

/** Định nghĩa tool nhìn qua hình dạng cấu trúc. */
interface LooseTool {
  /** Tên tool. */
  readonly name: string;
  /** Mô tả gửi mô hình. */
  readonly description: string;
  /** JSON schema tham số đã biên dịch. */
  readonly parameters: Record<string, unknown>;
  /** Schema đầu ra + hàm render. */
  readonly output: {
    readonly schema: unknown;
    render(args: unknown, value: unknown): { type: string; text: string }[];
  };
  /** Thân thực thi. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
}

/** Một lời gọi ask đã bắt. */
interface AskRecord {
  /** Yêu cầu service nhận. */
  readonly request: Record<string, unknown>;
}

/** Một lời gọi askTimed đã bắt. */
interface TimedRecord {
  /** Yêu cầu service nhận. */
  readonly request: Record<string, unknown>;
  /** Call id service nhận. */
  readonly callId: unknown;
  /** Thời gian chờ (ms) service nhận. */
  readonly timeoutMs: unknown;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cordis thật. */
  readonly ctx: unknown;
  /** Các định nghĩa tool đã đăng ký. */
  readonly tools: LooseTool[];
  /** Các lời gọi ask đã bắt. */
  readonly asks: AskRecord[];
  /** Các lời gọi askTimed đã bắt. */
  readonly timed: TimedRecord[];
}

/** Kết quả giả mà service sẽ trả. */
interface HarnessOptions {
  /** Giá trị ask trả. */
  askResult?: unknown;
  /** Lỗi ask ném. */
  askError?: unknown;
  /** Giá trị askTimed trả. */
  timedResult?: unknown;
  /** Lỗi askTimed ném. */
  timedError?: unknown;
}

/**
 * Dựng giàn cho MỘT bên cài trên Context cordis THẬT.
 * Nhận: options — kết quả/lỗi giả của service (mặc định lô rỗng).
 * Trả: giàn đo với tools/asks/timed.
 */
function makeHarness(options: HarnessOptions = {}): Harness {
  const tools: LooseTool[] = [];
  const asks: AskRecord[] = [];
  const timed: TimedRecord[] = [];
  const service = {
    async ask(request: Record<string, unknown>): Promise<unknown> {
      asks.push({ request });
      if (options.askError !== undefined) throw options.askError;
      return options.askResult ?? { answers: [] };
    },
    async askTimed(request: Record<string, unknown>, callId: unknown, timeoutMs: unknown): Promise<unknown> {
      timed.push({ request, callId, timeoutMs });
      if (options.timedError !== undefined) throw options.timedError;
      return options.timedResult ?? { answers: [] };
    },
  };
  const ctx = new ContextCtor() as {
    provide(name: string, value: unknown): void;
  };
  ctx.provide("tools", {
    register(definition: LooseTool): () => void {
      tools.push(definition);
      return () => undefined;
    },
  });
  ctx.provide("userQuestions", service);
  return { ctx, tools, asks, timed };
}

/**
 * Cài MỘT bản lên giàn rồi trả định nghĩa tool đã đăng ký.
 * Nhận: harness — giàn; module — bản cần cài; config — cấu hình truyền vào.
 * Trả: định nghĩa tool đã đăng ký.
 * @throws {Error} khi apply ném (ca cấu hình sai).
 */
function install(harness: Harness, module: ModuleLike, config: unknown = {}): LooseTool {
  module.apply(harness.ctx, config);
  const tool = harness.tools[0];
  if (tool === undefined) throw new Error("apply did not register a tool");
  return tool;
}

/**
 * Chạy một lời gọi execute và trả { value, error } thay vì ném.
 * Nhận: tool — định nghĩa; args — tham số; exec — { callId, agent?, signal }.
 * Trả: giá trị hoặc lỗi đã ném.
 */
async function runExecute(tool: LooseTool, args: unknown, exec: unknown): Promise<{ value?: unknown; error?: unknown }> {
  try {
    return { value: await tool.execute(args, exec) };
  } catch (error) {
    return { error };
  }
}

/**
 * Bắt lỗi của một phép gọi đồng bộ thành chuỗi.
 * Nhận: callback — phép gọi có thể ném.
 * Trả: chuỗi lỗi, hoặc "(khong nem)" khi không ném.
 */
function errorOf(callback: () => unknown): string {
  try {
    callback();
    return "(khong nem)";
  } catch (error) {
    return String(error);
  }
}

/** Agent gọi giả (chỉ cần DANH TÍNH để so agent). */
const PARENT = { id: "agent-parent" };

/** Một câu hỏi ĐẦY ĐỦ dùng lại trong nhiều ca. */
function fullQuestion(): { id: string; question: string; header: string; options: { label: string; description: string }[]; multi_select: boolean } {
  return { id: "q1", question: "Chọn cách chạy?", header: "Chọn", options: [{ label: "A", description: "Cách A" }, { label: "B", description: "Cách B" }], multi_select: true };
}

/**
 * Exec có agent, tín hiệu chưa huỷ, callId cố định.
 * Nhận: agent — agent gọi (mặc định PARENT); callId — id lời gọi (mặc định "call-1").
 * Trả: object exec cho execute.
 */
function execWith(agent: unknown = PARENT, callId = "call-1"): { callId: string; agent: unknown; signal: AbortSignal } {
  return { callId, agent, signal: new AbortController().signal };
}

/**
 * Exec KHÔNG có agent (thuộc tính vắng hẳn như kernel khi không có phiên).
 * Nhận: callId — id lời gọi (mặc định "call-1").
 * Trả: object exec cho execute.
 */
function execWithoutAgent(callId = "call-1"): { callId: string; signal: AbortSignal } {
  return { callId, signal: new AbortController().signal };
}

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG bốn khuôn mà tools/check/rows.ts dùng.
 * Nhận: nội dung artifact.
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name);
    }
  }
  return [...out].sort();
}

/** Thông điệp pending NGUYÊN VĂN của bản gốc. */
const PENDING_NOTICE = "No answer batch arrived before the timeout. This is pending, not a skipped answer. Continue useful independent work. The user can still answer; their reply will be a user message identified as answer_to_pending_question with this callId and the original questions. Do not treat this as permission.";

describe("A. TẬP EXPORT + ARTIFACT — ta phải BẰNG bản gốc", () => {
  test("4 export BẰNG TỪNG TÊN: Config · apply · inject · name", () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(STOCK_BUNDLE, "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["Config", "apply", "inject", "name"]);
  });

  test("artifact là ESM host, không có __ModuleLoader__, nạp schemastery y NHƯ bản gốc", () => {
    const code = readFileSync(artifact, "utf8");
    const stockCode = readFileSync(STOCK_BUNDLE, "utf8");
    expect(/^import\s/m.test(code)).toBe(true);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    // Config giờ là z.object THẬT ⇒ artifact nạp schemastery đúng như bundle gốc (shim cũ thì không).
    expect(code.includes('from "@deepseek-ai/schemastery"')).toBe(true);
    expect(stockCode.includes('from "@deepseek-ai/schemastery"')).toBe(true);
    expect(code.includes("@deepseek-ai/dsh-user-questions")).toBe(true);
  });

  test("name/inject BẰNG bản gốc", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-ask-user");
    expect(mine.inject).toEqual(stock.inject);
    expect(mine.inject).toEqual(["tools", "userQuestions"]);
  });
});

describe("B. Config — đối chứng TRỰC TIẾP với schema gốc", () => {
  test("String(Config) TRÙNG TỪNG KÝ TỰ; mặc định mode/timeout như gốc", () => {
    expect(String(mine.Config)).toBe(String(stock.Config));
    expect(mine.Config({})).toEqual(stock.Config({}));
    expect(mine.Config({})).toEqual({ mode: "legacy", timeout: 120 });
    expect(mine.Config({ mode: "timed" })).toEqual({ mode: "timed", timeout: 120 });
    expect(mine.Config(null)).toEqual({ mode: "legacy", timeout: 120 });
    expect(mine.Config({ extra: 1 })).toEqual(stock.Config({ extra: 1 }));
  });

  test("ĐỐI CHỨNG ÂM: mode/timeout sai bị NÉM ở CẢ HAI bên, cùng tên lớp + thông điệp", () => {
    const cases: unknown[] = [{ mode: "x" }, { timeout: 0 }, { timeout: 1.5 }, { timeout: 2147484 }, { timeout: "5" }, 5, true, []];
    for (const value of cases) {
      const ours = errorOf(() => mine.Config(value));
      const theirs = errorOf(() => stock.Config(value));
      expect(ours).toBe(theirs);
      expect(ours.startsWith("ValidationError: ")).toBe(true);
    }
  });

  test("simplify · dict · meta · Standard Schema BẰNG bản gốc", () => {
    expect(mine.Config.simplify({ mode: "legacy", timeout: 120 })).toEqual(stock.Config.simplify({ mode: "legacy", timeout: 120 }));
    expect(mine.Config.simplify({ mode: "timed" })).toEqual(stock.Config.simplify({ mode: "timed" }));
    expect(mine.Config.simplify({})).toEqual(stock.Config.simplify({}));
    expect(mine.Config.simplify({ mode: "legacy", timeout: 120, extra: 1 })).toEqual(stock.Config.simplify({ mode: "legacy", timeout: 120, extra: 1 }));
    expect(JSON.stringify(mine.Config({ extra: 1 }))).toBe(JSON.stringify(stock.Config({ extra: 1 })));
    expect(mine.Config.meta).toEqual(stock.Config.meta);
    expect(mine.Config.dict["mode"]?.toString()).toBe(stock.Config.dict["mode"]?.toString());
    expect(mine.Config.dict["timeout"]?.toString()).toBe(stock.Config.dict["timeout"]?.toString());
    expect(JSON.parse(JSON.stringify(mine.Config["~standard"].validate({ mode: "x" })))).toEqual(JSON.parse(JSON.stringify(stock.Config["~standard"].validate({ mode: "x" }))));
    expect(JSON.parse(JSON.stringify(mine.Config["~standard"].validate({})))).toEqual(JSON.parse(JSON.stringify(stock.Config["~standard"].validate({}))));
  });

  test("Config của TA và của bản GỐC cùng instanceof lớp Schema THẬT của schemastery", () => {
    expect(SchemaClass.name).toBe("Schema");
    expect(mine.Config instanceof SchemaClass).toBe(true);
    expect(stock.Config instanceof SchemaClass).toBe(true);
    // Cùng MỘT lớp (không phải hai bản schemastery): prototype của hai schema TRÙNG NHAU và TRÙNG lớp.
    expect(Object.getPrototypeOf(mine.Config)).toBe(Object.getPrototypeOf(stock.Config));
    expect(Object.getPrototypeOf(mine.Config)).toBe(SchemaClass.prototype);
    expect(mine.Config.constructor).toBe(stock.Config.constructor);
    // Hai nút con cũng là schema THẬT của schemastery, không phải object mô phỏng cấu trúc.
    expect(mine.Config.dict["mode"] instanceof SchemaClass).toBe(true);
    expect(mine.Config.dict["timeout"] instanceof SchemaClass).toBe(true);
  });

  test("String(Config) vẫn TRÙNG TỪNG KÝ TỰ sau khi đổi sang z.object thật", () => {
    expect(String(mine.Config)).toBe('{ mode?: "legacy" | "timed", timeout?: -1 | number }');
    expect(String(mine.Config)).toBe(String(stock.Config));
    expect(String(mine.Config.dict["mode"])).toBe(String(stock.Config.dict["mode"]));
    expect(String(mine.Config.dict["timeout"])).toBe(String(stock.Config.dict["timeout"]));
  });
});

describe("C. apply LEGACY — đăng ký + execute đối chứng", () => {
  test("đăng ký ĐÚNG MỘT tool; name/description/parameters/output.schema BẰNG bản gốc", () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine);
    const stockTool = install(b, stock);
    expect(a.tools.length).toBe(1);
    expect(b.tools.length).toBe(1);
    expect(oursTool.name).toBe(stockTool.name);
    expect(oursTool.name).toBe("ask_user_question");
    expect(oursTool.description).toBe(stockTool.description);
    expect(oursTool.description).toBe("Ask the user a concise question when you need confirmation, a choice, or missing information before proceeding.");
    expect(oursTool.parameters).toEqual(stockTool.parameters);
    expect(oursTool.output.schema).toEqual(stockTool.output.schema);
    expect(Object.keys(oursTool).sort()).toEqual(Object.keys(stockTool).sort());
    expect(Object.keys(oursTool).sort()).toEqual(["description", "execute", "name", "output", "parameters"]);
    expect(Object.keys(oursTool.output).sort()).toEqual(Object.keys(stockTool.output).sort());
  });

  test("execute gọi ask với questions/agent/signal NGUYÊN VẸN, KHÔNG có wait; options KHÔNG bị sao chép", async () => {
    const answer = { answers: [{ id: "q1", selected: ["A", "B"], custom: "ghi chú" }] };
    const a = makeHarness({ askResult: answer });
    const b = makeHarness({ askResult: answer });
    const oursTool = install(a, mine);
    const stockTool = install(b, stock);
    const question = fullQuestion();
    const args = { questions: [question] };
    const exec = execWith();
    const ours = await runExecute(oursTool, args, exec);
    const theirs = await runExecute(stockTool, args, exec);
    expect(ours.error).toBeUndefined();
    expect(ours.value).toEqual(theirs.value);
    expect(ours.value).toEqual(answer);
    expect(a.asks.length).toBe(1);
    expect(b.asks.length).toBe(1);
    expect(a.asks[0]?.request).toEqual(b.asks[0]?.request);
    expect(a.asks[0]?.request["wait"]).toBeUndefined();
    expect(a.asks[0]?.request["agent"]).toBe(PARENT);
    expect(a.asks[0]?.request["signal"]).toBe(exec.signal);
    const requestQuestions = a.asks[0]?.request["questions"] as { options: unknown; header: string; multiSelect: boolean }[];
    expect(requestQuestions[0]?.options).toBe(question.options);
    expect(requestQuestions[0]?.header).toBe("Chọn");
    expect(requestQuestions[0]?.multiSelect).toBe(true);
  });

  test("không có exec.agent ⇒ request KHÔNG có khoá agent ở CẢ HAI bên", async () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine);
    const stockTool = install(b, stock);
    const exec = execWithoutAgent();
    await runExecute(oursTool, { questions: [{ id: "q1", question: "Q?" }] }, exec);
    await runExecute(stockTool, { questions: [{ id: "q1", question: "Q?" }] }, exec);
    expect(a.asks[0]?.request).toEqual(b.asks[0]?.request);
    expect("agent" in (a.asks[0]?.request ?? {})).toBe(false);
    expect(a.asks[0]?.request["signal"]).toBe(exec.signal);
  });

  test("kết quả là BẢN SAO: selected được clone, custom giữ nguyên; render BẰNG bản gốc", async () => {
    const selected = ["A"];
    const answer = { answers: [{ id: "q1", selected, custom: "x" }] };
    const a = makeHarness({ askResult: answer });
    const b = makeHarness({ askResult: answer });
    const oursTool = install(a, mine);
    const stockTool = install(b, stock);
    const args = { questions: [{ id: "q1", question: "Q?" }] };
    const ours = await runExecute(oursTool, args, execWith());
    const theirs = await runExecute(stockTool, args, execWith());
    const oursSelected = (ours.value as { answers: { selected: string[] }[] }).answers[0]?.selected as string[];
    expect(oursSelected).toEqual(["A"]);
    expect(oursSelected).not.toBe(selected);
    expect(ours.value).toEqual(theirs.value);
    const renderArgs = [{ questions: [{ id: "q1", question: "Q?" }] }, ours.value];
    const callRender = (tool: LooseTool): unknown => tool.output.render(renderArgs[0], renderArgs[1]);
    expect(callRender(oursTool)).toEqual(callRender(stockTool));
    expect(callRender(oursTool)).toEqual([{ type: "text", text: JSON.stringify(ours.value) }]);
  });

  test("legacy KHÔNG kiểm id trùng (nhánh gốc): cả hai vẫn gọi ask đúng một lần", async () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine);
    const stockTool = install(b, stock);
    const args = { questions: [{ id: "dup", question: "Một?" }, { id: "dup", question: "Hai?" }] };
    const ours = await runExecute(oursTool, args, execWith());
    const theirs = await runExecute(stockTool, args, execWith());
    expect(ours.error).toBeUndefined();
    expect(theirs.error).toBeUndefined();
    expect(a.asks.length).toBe(1);
    expect(b.asks.length).toBe(1);
    expect(a.asks[0]?.request).toEqual(b.asks[0]?.request);
  });
});

describe("D. apply TIMED — tham số hẹn giờ + mọi nhánh execute", () => {
  test("timeout mặc định 120 hiện ĐÚNG trong mô tả tham số; parameters BẰNG bản gốc", () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine, { mode: "timed" });
    const stockTool = install(b, stock, { mode: "timed" });
    expect(oursTool.parameters).toEqual(stockTool.parameters);
    const properties = oursTool.parameters["properties"] as Record<string, { description: string }>;
    expect(properties["timeout"]?.description).toBe("Wait seconds for the entire batch (default 120); omit unless the user specifies a duration. Use -1 only when an answer is required before proceeding.");
    expect(oursTool.output.schema).toEqual(stockTool.output.schema);
    expect(oursTool.description).toBe(stockTool.description);
    expect(Object.keys(oursTool).sort()).toEqual(Object.keys(stockTool).sort());
    expect(Object.keys(oursTool.output).sort()).toEqual(Object.keys(stockTool.output).sort());
  });

  test("timeout cấu hình 5 hiện ĐÚNG trong mô tả tham số; parameters BẰNG bản gốc", () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine, { mode: "timed", timeout: 5 });
    const stockTool = install(b, stock, { mode: "timed", timeout: 5 });
    expect(oursTool.parameters).toEqual(stockTool.parameters);
    const properties = oursTool.parameters["properties"] as Record<string, { description: string }>;
    expect(properties["timeout"]?.description).toBe("Wait seconds for the entire batch (default 5); omit unless the user specifies a duration. Use -1 only when an answer is required before proceeding.");
  });

  test("execute gọi askTimed với request/callId/timeoutMs BẰNG bản gốc; options ĐƯỢC sao chép", async () => {
    const answer = { answers: [{ id: "q1", selected: ["A"], custom: "x" }] };
    const a = makeHarness({ timedResult: answer });
    const b = makeHarness({ timedResult: answer });
    const oursTool = install(a, mine, { mode: "timed", timeout: 5 });
    const stockTool = install(b, stock, { mode: "timed", timeout: 5 });
    const question = fullQuestion();
    const args = { questions: [question] };
    const exec = execWith();
    const ours = await runExecute(oursTool, args, exec);
    const theirs = await runExecute(stockTool, args, exec);
    expect(ours.error).toBeUndefined();
    expect(ours.value).toEqual(theirs.value);
    expect(ours.value).toEqual(answer);
    expect(a.timed.length).toBe(1);
    expect(b.timed.length).toBe(1);
    expect(a.timed[0]?.callId).toBe("call-1");
    expect(a.timed[0]?.callId).toBe(b.timed[0]?.callId);
    expect(a.timed[0]?.timeoutMs).toBe(5000);
    expect(a.timed[0]?.timeoutMs).toBe(b.timed[0]?.timeoutMs);
    expect(a.timed[0]?.request).toEqual(b.timed[0]?.request);
    expect(a.timed[0]?.request["agent"]).toBe(PARENT);
    expect(a.timed[0]?.request["signal"]).toBe(exec.signal);
    const requestQuestions = a.timed[0]?.request["questions"] as { options: unknown }[];
    expect(requestQuestions[0]?.options).toEqual(question.options);
    expect(requestQuestions[0]?.options).not.toBe(question.options);
  });

  test("kết quả pending: callId + message NGUYÊN VĂN; BẰNG bản gốc", async () => {
    const pending = { pending: true, callId: "call-1" };
    const a = makeHarness({ timedResult: pending });
    const b = makeHarness({ timedResult: pending });
    const oursTool = install(a, mine, { mode: "timed" });
    const stockTool = install(b, stock, { mode: "timed" });
    const args = { questions: [{ id: "q1", question: "Q?" }] };
    const ours = await runExecute(oursTool, args, execWith());
    const theirs = await runExecute(stockTool, args, execWith());
    expect(ours.value).toEqual(theirs.value);
    expect(ours.value).toEqual({ pending: true, callId: "call-1", message: PENDING_NOTICE });
  });

  test("cấu hình timeout -1: mô tả tham số hiện -1 và lời gọi mặc định rơi về ask có wait; BẰNG bản gốc", async () => {
    const answer = { answers: [{ id: "q1", selected: ["A"] }] };
    const a = makeHarness({ askResult: answer });
    const b = makeHarness({ askResult: answer });
    const oursTool = install(a, mine, { mode: "timed", timeout: -1 });
    const stockTool = install(b, stock, { mode: "timed", timeout: -1 });
    expect(oursTool.parameters).toEqual(stockTool.parameters);
    const properties = oursTool.parameters["properties"] as Record<string, { description: string }>;
    expect(properties["timeout"]?.description).toBe("Wait seconds for the entire batch (default -1); omit unless the user specifies a duration. Use -1 only when an answer is required before proceeding.");
    const ours = await runExecute(oursTool, { questions: [{ id: "q1", question: "Q?" }] }, execWithoutAgent());
    const theirs = await runExecute(stockTool, { questions: [{ id: "q1", question: "Q?" }] }, execWithoutAgent());
    expect(ours.error).toBeUndefined();
    expect(ours.value).toEqual(theirs.value);
    expect(a.asks.length).toBe(1);
    expect(a.asks[0]?.request["wait"]).toEqual({ callId: "call-1" });
    expect(a.timed.length).toBe(0);
  });

  test("timeout -1 rơi về ask có wait { callId } và KHÔNG cần agent; BẰNG bản gốc", async () => {
    const answer = { answers: [{ id: "q1", selected: [] }] };
    const a = makeHarness({ askResult: answer });
    const b = makeHarness({ askResult: answer });
    const oursTool = install(a, mine, { mode: "timed" });
    const stockTool = install(b, stock, { mode: "timed" });
    const args = { questions: [{ id: "q1", question: "Q?" }], timeout: -1 };
    const exec = execWithoutAgent();
    const ours = await runExecute(oursTool, args, exec);
    const theirs = await runExecute(stockTool, args, exec);
    expect(ours.error).toBeUndefined();
    expect(ours.value).toEqual(theirs.value);
    expect(a.asks.length).toBe(1);
    expect(b.asks.length).toBe(1);
    expect(a.asks[0]?.request).toEqual(b.asks[0]?.request);
    expect(a.asks[0]?.request["wait"]).toEqual({ callId: "call-1" });
    expect("agent" in (a.asks[0]?.request ?? {})).toBe(false);
    expect(a.timed.length).toBe(0);
  });

  test("timeout khác -1 mà thiếu agent ⇒ ném CÙNG thông điệp, không gọi service", async () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine, { mode: "timed" });
    const stockTool = install(b, stock, { mode: "timed" });
    const args = { questions: [{ id: "q1", question: "Q?" }] };
    const ours = await runExecute(oursTool, args, execWithoutAgent());
    const theirs = await runExecute(stockTool, args, execWithoutAgent());
    expect(String(ours.error)).toBe(String(theirs.error));
    expect(String(ours.error)).toBe("Error: timed questions require a live agent");
    expect(a.timed.length).toBe(0);
    expect(b.timed.length).toBe(0);
  });

  test("timeout trong args sai: số nguyên ngoài miền rơi vào validateTimeout, số thực bị schema chặn — CẢ HAI bên CÙNG lỗi", async () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine, { mode: "timed" });
    const stockTool = install(b, stock, { mode: "timed" });
    for (const timeout of [0, -2, 2147484]) {
      const args = { questions: [{ id: "q1", question: "Q?" }], timeout };
      const ours = await runExecute(oursTool, args, execWith());
      const theirs = await runExecute(stockTool, args, execWith());
      expect(String(ours.error)).toBe(String(theirs.error));
      expect(String(ours.error)).toBe("Error: timeout must be -1 or a positive integer up to 2147483 seconds");
    }
    const fractional = await runExecute(oursTool, { questions: [{ id: "q1", question: "Q?" }], timeout: 1.5 }, execWith());
    const stockFractional = await runExecute(stockTool, { questions: [{ id: "q1", question: "Q?" }], timeout: 1.5 }, execWith());
    expect(String(fractional.error)).toBe(String(stockFractional.error));
    expect(String(fractional.error)).toBe('ToolArgsError: invalid arguments: "timeout" must be an integer');
    expect(a.timed.length).toBe(0);
    expect(b.timed.length).toBe(0);
  });

  test("id câu hỏi trùng ở chế độ timed ⇒ ném CÙNG thông điệp, không gọi service", async () => {
    const a = makeHarness();
    const b = makeHarness();
    const oursTool = install(a, mine, { mode: "timed" });
    const stockTool = install(b, stock, { mode: "timed" });
    const args = { questions: [{ id: "dup", question: "Một?" }, { id: "dup", question: "Hai?" }] };
    const ours = await runExecute(oursTool, args, execWith());
    const theirs = await runExecute(stockTool, args, execWith());
    expect(String(ours.error)).toBe(String(theirs.error));
    expect(String(ours.error)).toBe('Error: question id "dup" must be unique within this call');
    expect(a.timed.length).toBe(0);
    expect(b.timed.length).toBe(0);
  });

  test("cấu hình timed với timeout sai ⇒ apply NÉM TRƯỚC đăng ký ở CẢ HAI bên", () => {
    for (const timeout of [0, 1.5, 2147484]) {
      const a = makeHarness();
      const b = makeHarness();
      const ours = errorOf(() => mine.apply(a.ctx, { mode: "timed", timeout }));
      const theirs = errorOf(() => stock.apply(b.ctx, { mode: "timed", timeout }));
      expect(ours).toBe(theirs);
      expect(ours).toBe("Error: timeout must be -1 or a positive integer up to 2147483 seconds");
      expect(a.tools.length).toBe(0);
      expect(b.tools.length).toBe(0);
    }
  });
});

describe("E. Khai báo gói + luật tệp", () => {
  test("manifest có gbh.nested (pluginId/stockId/presets) và KHÔNG có gbh.row", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: { nested?: { pluginId?: string; stockId?: string; presets?: string[] }; row?: unknown; tests?: string[] };
    };
    expect(meta.gbh?.nested?.pluginId).toBe("tool-ask-user");
    expect(meta.gbh?.nested?.stockId).toBe("@deepseek-ai/dsh-tool-ask-user");
    expect(meta.gbh?.nested?.presets).toEqual(["preset-standard", "preset-ptc", "preset-cordis"]);
    expect(meta.gbh?.row).toBeUndefined();
    expect(meta.gbh?.tests).toEqual(["tests/host/tool-ask-user.test.ts"]);
  });

  test("src/index.ts ≤ 1000 dòng và header đúng 5 dòng luật repo", () => {
    const source = readFileSync(join(PKG, "src", "index.ts"), "utf8");
    expect(source.split("\n").length).toBeLessThanOrEqual(1000);
    const header = source.split("\n").slice(0, 6);
    expect(header[0]).toBe("/**");
    expect(header[1]).toBe(" * author Bùi Trọng Hiếu");
    expect(header[2]).toBe(" * email kevinbui210191@gmail.com");
    expect(header[3]).toBe(" * create date 15/10/2026");
    expect(header[4]).toBe(" * modify date 19/10/2026");
    expect(header[5]).toContain(" * desc ");
  });
});
