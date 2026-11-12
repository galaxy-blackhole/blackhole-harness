/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 06/11/2026
 * desc Test đối chứng A/B cho @galaxy-blackhole/gbh-tool-ralph: A = bundle gốc @deepseek-ai/dsh-tool-ralph,
 *      B = artefact lib/index.js của ta (byte-identical). Mỗi ca dựng HAI giàn GIỐNG HỆT NHAU trên Context
 *      cordis THẬT với 4 seam GIẢ đọc từ inject của bundle; KHÔNG mạng, KHÔNG spawn/shell. Phủ tập export,
 *      Config, bề mặt đăng ký, hành vi execute (lỗi/timeout/abort), gói metadata nested/peers/exports, locale.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/tool-ralph/build.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
// 06/11/2026 (P1b): artefact mang id GBH ⇒ quy id về dạng gốc trước khi so byte/sha với bundle stock.
import { chuanHoaHost } from "../lib/artefact-normalize.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "tool-ralph");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-ralph");
/** Bundle gốc (A). */
const STOCK_FILE = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục cài kernel của app (đích thật của mọi symlink peer/dep). */
const HOST_MODULES = join(REPO, "apps", "host", "node_modules");
/** Cấu hình ĐANG CHẠY của row (đo từ bundle): subagentProvider spawn · maxRounds 64. */
const RUNNING_CONFIG = { subagentProvider: "spawn", maxRounds: 64 };

/** Bề mặt module plugin (cả A lẫn B đều cùng khuôn). */
interface PluginApi {
  /** Tên plugin đăng ký với Loader. */
  readonly name: string;
  /** Bốn seam plugin cần trước khi chạy. */
  readonly inject: readonly string[];
  /** Schemastery config (gọi được, String() cho ra mô tả schema). */
  readonly Config: ((input?: unknown) => Record<string, unknown>) & { toString(): string };
  /** Thân plugin: đăng ký system-prompt section + công cụ ralph. */
  readonly apply: (ctx: unknown, config?: unknown) => void;
}

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ. */
  provide(name: string, value: unknown): () => void;
}

/** Một mục system prompt đã đăng ký. */
interface Section {
  name: string;
  order: number;
  text: string;
}

/** Một lời gọi workflowEngine.start đã bắt. */
interface StartRequest {
  script: string;
  meta: unknown;
  args: { objective: string; maxRounds: number; maxHandoffChars: number };
  subagentProvider: string;
  maxTotalAgents: number;
  parent: unknown;
  signal: AbortSignal;
}

/** Định nghĩa công cụ đã qua defineTool THẬT của kernel. */
interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  output: {
    schema: Record<string, unknown>;
    render(args: unknown, value: unknown): { type: string; text: string }[];
  };
  execute(args: unknown, exec: unknown): Promise<unknown>;
  presentCall(args: unknown): unknown;
  presentResult(args: unknown, value: unknown): unknown;
}

/** Kết quả workflow giả mà seam trả về. */
interface FakeSettled {
  stopReason: string;
  error?: string;
  value: unknown;
  agentsStarted: number;
}

/** Tuỳ chọn dựng giàn. */
interface HarnessOptions {
  /** Kết quả workflow mặc định (mặc định: complete 1 vòng). */
  settled?: FakeSettled;
  /** Promise result REJECT (mô phỏng timeout của seam — không dùng timer thật). */
  rejectWith?: Error;
  /** Giữ result chưa resolve để test abort GIỮA vòng. */
  hold?: boolean;
  /** Bản đồ provider subagent giả. */
  providers?: Record<string, unknown>;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  ctx: Ctx;
  sections: Section[];
  tools: ToolDef[];
  starts: StartRequest[];
  cancels: string[];
  disposes: number;
  /** Resolve result đang giữ (chỉ có tác dụng khi hold: true). */
  settle(value: FakeSettled): void;
}

/** Kết quả execute hoặc lỗi đã ném. */
interface RunOutcome {
  value?: unknown;
  error?: unknown;
}

/** Provider tươi HỢP LỆ mặc định. */
const FRESH_PROVIDER = { capabilities: { outputSchema: true }, inheritsParentContext: false };

/** Agent gọi giả (chỉ cần DANH TÍNH để so parent). */
const PARENT = { id: "agent-parent" };

/**
 * Một báo cáo vòng HỢP LỆ dùng lại trong nhiều ca.
 * Nhận: status — trạng thái báo cáo; overrides — trường ghi đè.
 * Trả: object báo cáo đúng 5 khoá.
 */
function reportOf(status: "continue" | "complete" | "blocked", overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const baseReport = {
    status,
    summary: "đã làm",
    evidence: status === "continue" ? [] : ["ev"],
    nextSteps: status === "continue" ? ["kế"] : [],
    blocker: status === "blocked" ? "vướng" : "",
  };
  return { ...baseReport, ...overrides };
}

/** Kết quả workflow THÀNH CÔNG mặc định (complete 1 vòng). */
const DEFAULT_SETTLED: FakeSettled = {
  stopReason: "completed",
  agentsStarted: 1,
  value: { status: "complete", roundsStarted: 1, report: reportOf("complete") },
};

/**
 * Dựng giàn cho MỘT bên trên Context cordis THẬT, cấp ĐÚNG các seam mà bundle khai trong inject.
 * Nhận: options — kết quả workflow/provider giả.
 * Trả: giàn đo (ctx + sổ đăng ký + sổ cancel/dispose).
 */
function makeHarness(options: HarnessOptions = {}): Harness {
  const sections: Section[] = [];
  const tools: ToolDef[] = [];
  const starts: StartRequest[] = [];
  const cancels: string[] = [];
  const providers = options.providers ?? { spawn: FRESH_PROVIDER };
  let settle: (value: FakeSettled) => void = () => undefined;
  const harness: Harness = {
    ctx: new ContextCtor() as Ctx,
    sections,
    tools,
    starts,
    cancels,
    disposes: 0,
    settle: (value) => settle(value),
  };
  const services: Record<string, unknown> = {
    systemPrompt: {
      section: (section: Section): (() => void) => {
        sections.push(section);
        return () => undefined;
      },
      getSectionOrder: (): number => 250,
    },
    tools: {
      register: (definition: ToolDef): (() => void) => {
        tools.push(definition);
        return () => undefined;
      },
    },
    subagents: {
      getProvider: (providerName: string): unknown => providers[providerName],
    },
    workflowEngine: {
      start: (request: StartRequest): Record<string, unknown> => {
        starts.push(request);
        let result: Promise<FakeSettled>;
        if (options.rejectWith !== undefined) result = Promise.reject(options.rejectWith);
        else if (options.hold === true) result = new Promise<FakeSettled>((resolve) => { settle = resolve; });
        else result = Promise.resolve(options.settled ?? DEFAULT_SETTLED);
        return {
          id: "run-fixed",
          result,
          cancel: (reason: string): void => { cancels.push(reason); },
          dispose: async (): Promise<void> => { harness.disposes += 1; },
        };
      },
    },
  };
  // Seam GIẢ theo ĐÚNG inject đọc từ bundle gốc: thiếu seam nào thì giàn phải nổ ngay, không im lặng.
  for (const service of stock.inject) {
    if (!(service in services)) throw new Error("thieu seam gia cho inject: " + service);
    harness.ctx.provide(service, services[service]);
  }
  return harness;
}

/**
 * Cài MỘT bản lên giàn rồi trả định nghĩa công cụ đã đăng ký.
 * Nhận: harness — giàn; apply — hàm apply của bản cần cài; config — cấu hình truyền vào.
 * Trả: định nghĩa công cụ (ném khi plugin không đăng ký gì).
 */
function install(harness: Harness, apply: PluginApi["apply"], config: unknown = RUNNING_CONFIG): ToolDef {
  apply(harness.ctx as never, config as never);
  const tool = harness.tools[0];
  if (tool === undefined) throw new Error("plugin khong dang ky tool");
  return tool;
}

/**
 * Chạy một lời gọi execute và trả { value } hoặc { error } thay vì ném.
 * Nhận: definition — định nghĩa công cụ; args — tham số; exec — { agent, signal }.
 * Trả: giá trị hoặc lỗi đã ném.
 */
async function runExecute(definition: ToolDef, args: unknown, exec: unknown): Promise<RunOutcome> {
  try {
    const value = await definition.execute(args, exec);
    return { value };
  } catch (error) {
    return { error };
  }
}

/**
 * Mô tả lỗi ổn định để so A/B.
 * Nhận: error — lỗi đã ném (có thể không phải Error).
 * Trả: chuỗi "TênLỗi: thông điệp" hoặc String(error).
 */
function errorText(error: unknown): string {
  return error instanceof Error ? error.name + ": " + error.message : String(error);
}

/** Exec mặc định: có agent, signal chưa huỷ. */
function defaultExec(): { agent: unknown; signal: AbortSignal } {
  return { agent: PARENT, signal: new AbortController().signal };
}

/**
 * Chạy CÙNG một ca trên HAI giàn rồi trả cả hai kết quả.
 * Nhận: args — tham số; exec — { agent, signal }; options — kết quả/provider giả.
 * Trả: { a, b, toolA, toolB, ra, rb } để từng ca tự khẳng định thêm.
 */
async function runBoth(args: unknown, exec: unknown, options: HarnessOptions = {}) {
  const a = makeHarness(options);
  const b = makeHarness(options);
  const toolA = install(a, mine.apply);
  const toolB = install(b, stock.apply);
  const ra = await runExecute(toolA, args, exec);
  const rb = await runExecute(toolB, args, exec);
  return { a, b, toolA, toolB, ra, rb };
}

/** Nội dung artefact của ta (B) — build NGAY khi nạp test, có cổng byte bên trong build.ts. */
const ARTIFACT = buildPackage();
/** B đã nạp như module ESM. */
const mine = (await import(pathToFileURL(ARTIFACT).href)) as PluginApi;
/** A nạp động từ bundle gốc (đường dẫn tính lúc chạy). */
const stock = (await import(pathToFileURL(STOCK_FILE).href)) as PluginApi;
/** Lớp Context THẬT của cordis (không phải object giả). */
const { Context: ContextCtor } = (await import(pathToFileURL(CORDIS_FILE).href)) as { Context: new () => unknown };

/**
 * Liệt kê file trong một cây (đệ quy), đường dẫn tương đối đã sắp xếp.
 * Nhận: dir — thư mục gốc; prefix — tiền tố tương đối.
 * Trả: mảng đường dẫn tương đối.
 */
function treeFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : prefix + "/" + entry.name;
    if (entry.isDirectory()) out.push(...treeFiles(join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

/** Siêu dữ liệu package.json (phần test chạm tới). */
interface PackageMeta {
  name?: string;
  private?: boolean;
  type?: string;
  main?: string;
  types?: string;
  exports?: Record<string, unknown>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: {
    peers?: string[];
    tests?: string[];
    row?: unknown;
    row_unmounted_ly_do?: unknown;
    nested?: unknown;
  };
}

describe("A. ARTEFACT + TẬP EXPORT RUNTIME", () => {
  test("artefact BYTE-IDENTICAL bundle gốc: cùng số byte, cùng sha256, delta 0", () => {
    const ours = readFileSync(ARTIFACT);
    const theirs = readFileSync(STOCK_FILE);
    // 06/11/2026 (P1b): artefact mang id CỦA TA ⇒ chuẩn hoá id về dạng gốc rồi mới so byte/sha với stock.
    const oursChuan = Buffer.from(chuanHoaHost(ours.toString("utf8")), "utf8");
    expect(oursChuan.equals(theirs)).toBe(true);
    expect(oursChuan.length).toBe(theirs.length);
    expect(oursChuan.length).toBe(17330);
    expect(createHash("sha256").update(oursChuan).digest("hex")).toBe(createHash("sha256").update(theirs).digest("hex"));
    // Vai trò ĐẢO: id ta có mặt trong artefact.
    expect(ours.toString("utf8").includes("@galaxy-blackhole/gbh-")).toBe(true);
  });

  test("tập export runtime BẰNG TỪNG TÊN: Config · apply · inject · name", () => {
    expect(Object.keys(mine).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(mine).sort()).toEqual(["Config", "apply", "inject", "name"]);
    const text = readFileSync(ARTIFACT, "utf8");
    expect(text.startsWith("import ")).toBe(true);
    expect(text).toContain("export { Config, apply, inject, name };");
    expect(text.includes("__ModuleLoader__")).toBe(false);
  });

  test("name/inject BẰNG bản gốc và đúng 4 seam", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-ralph");
    expect(mine.inject).toEqual(stock.inject);
    expect([...mine.inject]).toEqual(["tools", "workflowEngine", "subagents", "systemPrompt"]);
  });
});

describe("B. Config — String + ≥5 cấu hình", () => {
  test("String(Config) TRÙNG TỪNG KÝ TỰ; mặc định 4 trường như gốc", () => {
    expect(String(mine.Config)).toBe(String(stock.Config));
    expect(mine.Config({})).toEqual(stock.Config({}));
    expect(mine.Config({})).toEqual({ subagentProvider: "spawn", maxRounds: 256, maxHandoffChars: 16384, maxResultChars: 16384 });
  });

  test("≥5 cấu hình hợp lệ cho CÙNG kết quả ở hai bên", () => {
    const configs: Record<string, unknown>[] = [
      {},
      { maxRounds: 64 },
      { subagentProvider: "in-process" },
      { maxHandoffChars: 99 },
      { maxResultChars: 7 },
      { maxRounds: 3, maxHandoffChars: 5, maxResultChars: 9 },
    ];
    expect(configs.length).toBeGreaterThanOrEqual(5);
    for (const config of configs) expect(mine.Config(config)).toEqual(stock.Config(config));
    expect(mine.Config({ maxRounds: 64 })).toEqual({ subagentProvider: "spawn", maxRounds: 64, maxHandoffChars: 16384, maxResultChars: 16384 });
    expect(mine.Config({ subagentProvider: "in-process" })).toEqual({ subagentProvider: "in-process", maxRounds: 256, maxHandoffChars: 16384, maxResultChars: 16384 });
    expect(mine.Config({ maxHandoffChars: 99, maxResultChars: 7 })).toEqual({ subagentProvider: "spawn", maxRounds: 256, maxHandoffChars: 99, maxResultChars: 7 });
  });

  test("ĐỐI CHỨNG ÂM: cấu hình SAI số bị schema NÉM ở CẢ HAI bên; chuỗi rỗng qua schema, apply mới ném", () => {
    for (const bad of [{ maxRounds: 0 }, { maxRounds: 1.5 }, { maxHandoffChars: 0 }, { maxResultChars: -1 }]) {
      expect(() => mine.Config(bad)).toThrow();
      expect(() => stock.Config(bad)).toThrow();
    }
    expect(() => mine.Config({ subagentProvider: "" })).not.toThrow();
    expect(() => stock.Config({ subagentProvider: "" })).not.toThrow();
  });
});

describe("C. apply — bề mặt đăng ký", () => {
  test("đăng ký ĐÚNG MỘT section prompt + MỘT tool; id/description/parameters/schema BẰNG gốc", () => {
    const a = makeHarness();
    const b = makeHarness();
    const toolA = install(a, mine.apply);
    const toolB = install(b, stock.apply);
    expect(a.sections.length).toBe(1);
    expect(b.sections.length).toBe(1);
    expect(a.sections).toEqual(b.sections);
    expect(a.sections[0]?.name).toBe("tool:ralph");
    expect(a.sections[0]?.order).toBe(250);
    expect(a.sections[0]?.text).toContain("ONLY when the direct human explicitly asks");
    expect(a.tools.length).toBe(1);
    expect(toolA.name).toBe(toolB.name);
    expect(toolA.name).toBe("ralph");
    expect(toolA.description).toBe(toolB.description);
    expect(toolA.description).toContain("foreground fresh-agent Ralph loop");
    expect(toolA.parameters).toEqual(toolB.parameters);
    expect(toolA.parameters["type"]).toBe("object");
    expect(toolA.parameters["required"]).toEqual(["objective"]);
    expect(Object.keys(toolA.parameters["properties"] as Record<string, unknown>)).toEqual(["objective", "maxRounds"]);
    expect(toolA.output.schema).toEqual(toolB.output.schema);
    expect(toolA.output.schema["type"]).toBe("object");
    expect(toolA.output.schema["additionalProperties"]).toBe(false);
    expect(Object.keys(toolA.output.schema["properties"] as Record<string, unknown>).sort()).toEqual(["agentsStarted", "result", "runId"]);
    expect(toolA.output.schema["required"]).toEqual(["runId", "agentsStarted", "result"]);
  });

  test("presentCall/presentResult BẰNG bản gốc", () => {
    const toolA = install(makeHarness(), mine.apply);
    const toolB = install(makeHarness(), stock.apply);
    const args = { objective: "làm việc X" };
    expect(toolA.presentCall(args)).toEqual(toolB.presentCall(args));
    expect(toolA.presentResult(args, { content: [] })).toEqual(toolB.presentResult(args, { content: [] }));
  });

  test("cấu hình SAI ném TRƯỚC mọi đăng ký, thông điệp BẰNG bản gốc", () => {
    const cases: unknown[] = [undefined, { subagentProvider: " x" }, { maxRounds: 0 }, { maxHandoffChars: 1.5 }, { maxResultChars: 0 }];
    for (const config of cases) {
      const a = makeHarness();
      const b = makeHarness();
      let oursError: unknown;
      let stockError: unknown;
      try { mine.apply(a.ctx, config); } catch (error) { oursError = error; }
      try { stock.apply(b.ctx, config); } catch (error) { stockError = error; }
      expect(errorText(oursError)).toBe(errorText(stockError));
      expect(a.tools.length).toBe(0);
      expect(a.sections.length).toBe(0);
      expect(b.tools.length).toBe(0);
      expect(b.sections.length).toBe(0);
    }
  });
});

describe("D. execute — seam GIẢ: yêu cầu workflow + mọi nhánh", () => {
  test("workflowEngine.start nhận CÙNG script/meta/args/provider/maxTotalAgents/parent/signal", async () => {
    const a = makeHarness();
    const b = makeHarness();
    const toolA = install(a, mine.apply);
    const toolB = install(b, stock.apply);
    const controller = new AbortController();
    const exec = { agent: PARENT, signal: controller.signal };
    const ra = await runExecute(toolA, { objective: "  mục tiêu  " }, exec);
    const rb = await runExecute(toolB, { objective: "  mục tiêu  " }, exec);
    expect(ra.value).toEqual(rb.value);
    expect(a.starts.length).toBe(1);
    expect(b.starts.length).toBe(1);
    const startA = a.starts[0] as StartRequest;
    const startB = b.starts[0] as StartRequest;
    expect(startA.script).toBe(startB.script);
    expect(startA.script.length).toBeGreaterThan(4000);
    expect(startA.script).toContain("Ralph round:");
    expect(startA.meta).toEqual(startB.meta);
    expect(startA.args).toEqual(startB.args);
    expect(startA.args).toEqual({ objective: "mục tiêu", maxRounds: 64, maxHandoffChars: 16384 });
    expect(startA.subagentProvider).toBe(startB.subagentProvider);
    expect(startA.subagentProvider).toBe("spawn");
    expect(startA.maxTotalAgents).toBe(startB.maxTotalAgents);
    expect(startA.maxTotalAgents).toBe(64);
    expect(startA.parent).toBe(PARENT);
    expect(startA.signal).toBe(controller.signal);
    expect(a.disposes).toBe(1);
    expect(b.disposes).toBe(1);
  });

  test("4 trạng thái kết thúc HỢP LỆ: complete · blocked · budget-limited · round-failed", async () => {
    const scenarios: FakeSettled[] = [
      { stopReason: "completed", agentsStarted: 2, value: { status: "complete", roundsStarted: 2, report: reportOf("complete") } },
      { stopReason: "completed", agentsStarted: 3, value: { status: "blocked", roundsStarted: 3, report: reportOf("blocked") } },
      { stopReason: "completed", agentsStarted: 64, value: { status: "budget-limited", roundsStarted: 64, report: reportOf("continue") } },
      { stopReason: "completed", agentsStarted: 2, value: { status: "round-failed", roundsStarted: 2, lastReport: reportOf("continue") } },
      { stopReason: "completed", agentsStarted: 1, value: { status: "round-failed", roundsStarted: 1, lastReport: null } },
    ];
    for (const settled of scenarios) {
      const { a, b, ra, rb } = await runBoth({ objective: "x" }, defaultExec(), { settled });
      expect(errorText(ra.error)).toBe(errorText(rb.error));
      expect(ra.value).toEqual(rb.value);
      expect(a.disposes).toBe(1);
      expect(b.disposes).toBe(1);
    }
  });

  test("LỖI tham số + provider: thiếu agent · objective rỗng · vượt trần · 3 kiểu provider sai", async () => {
    const noAgent = await runBoth({ objective: "x" }, { signal: new AbortController().signal });
    expect(errorText(noAgent.ra.error)).toBe(errorText(noAgent.rb.error));
    expect(errorText(noAgent.ra.error)).toContain("requires a calling agent");
    expect(noAgent.a.starts.length).toBe(0);

    const emptyObjective = await runBoth({ objective: "   " }, defaultExec());
    expect(errorText(emptyObjective.ra.error)).toBe(errorText(emptyObjective.rb.error));
    expect(errorText(emptyObjective.ra.error)).toContain("non-empty string");

    const tooMany = await runBoth({ objective: "x", maxRounds: 65 }, defaultExec());
    expect(errorText(tooMany.ra.error)).toBe(errorText(tooMany.rb.error));
    expect(errorText(tooMany.ra.error)).toBe("TypeError: Ralph maxRounds 65 exceeds the deployment ceiling 64");
    expect(tooMany.a.starts.length).toBe(0);

    const providerCases: Record<string, unknown>[] = [
      {},
      { spawn: { capabilities: { outputSchema: false }, inheritsParentContext: false } },
      { spawn: { capabilities: { outputSchema: true }, inheritsParentContext: true } },
    ];
    for (const providers of providerCases) {
      const bad = await runBoth({ objective: "x" }, defaultExec(), { providers });
      expect(errorText(bad.ra.error)).toBe(errorText(bad.rb.error));
      expect(errorText(bad.ra.error)).toContain("Ralph subagent provider");
      expect(bad.a.starts.length).toBe(0);
    }
  });

  test("kết quả kết thúc HỎNG + lý do dừng KHÔNG sạch — BẰNG bản gốc, luôn dispose", async () => {
    const malformed: unknown[] = [
      null,
      { status: "complete", roundsStarted: 0, report: reportOf("complete") },
      { status: "complete", roundsStarted: 2, report: reportOf("complete"), extra: true },
      { status: "budget-limited", roundsStarted: 3, report: reportOf("continue") },
      { status: "weird", roundsStarted: 1, report: reportOf("complete") },
      { status: "complete", roundsStarted: 1, report: reportOf("blocked") },
      { status: "round-failed", roundsStarted: 2, lastReport: null },
      { status: "round-failed", roundsStarted: 1, lastReport: reportOf("continue") },
    ];
    for (const value of malformed) {
      const { a, ra, rb } = await runBoth({ objective: "x" }, defaultExec(), { settled: { stopReason: "completed", agentsStarted: 1, value } });
      expect(errorText(ra.error)).toBe(errorText(rb.error));
      expect(a.disposes).toBe(1);
    }
    const reasons: FakeSettled[] = [
      { stopReason: "cancelled", agentsStarted: 0, value: undefined },
      { stopReason: "cancelled", agentsStarted: 0, value: undefined, error: "người dùng huỷ" },
      { stopReason: "error", agentsStarted: 0, value: undefined },
      { stopReason: "error", agentsStarted: 0, value: undefined, error: "hỏng thật" },
      { stopReason: "teleported", agentsStarted: 0, value: undefined },
    ];
    for (const settled of reasons) {
      const { a, ra, rb } = await runBoth({ objective: "x" }, defaultExec(), { settled });
      expect(errorText(ra.error)).toBe(errorText(rb.error));
      expect(a.disposes).toBe(1);
    }
  });

  test("ABORT: signal đã huỷ TRƯỚC khi chạy + huỷ GIỮA vòng — cancel đúng lý do, listener được GỠ", async () => {
    const controller = new AbortController();
    controller.abort();
    const pre = await runBoth({ objective: "x" }, { agent: PARENT, signal: controller.signal });
    expect(pre.ra.value).toEqual(pre.rb.value);
    expect(pre.a.cancels).toEqual(["parent step aborted"]);
    expect(pre.a.cancels).toEqual(pre.b.cancels);
    controller.abort();
    expect(pre.a.cancels.length).toBe(1);
    expect(pre.b.cancels.length).toBe(1);

    /**
     * Chạy một bên với result GIỮ chưa resolve rồi huỷ GIỮA vòng.
     * Nhận: api — module plugin (A hoặc B).
     * Trả: giàn, kết quả, số cancel ngay sau khi huỷ.
     */
    const held = async (api: PluginApi) => {
      const harness = makeHarness({ hold: true });
      const tool = install(harness, api.apply);
      const midController = new AbortController();
      const pending = runExecute(tool, { objective: "x" }, { agent: PARENT, signal: midController.signal });
      expect(harness.starts.length).toBe(1);
      midController.abort();
      const rightAfterAbort = [...harness.cancels];
      harness.settle(DEFAULT_SETTLED);
      const outcome = await pending;
      midController.abort();
      return { harness, outcome, rightAfterAbort };
    };
    const heldA = await held(mine);
    const heldB = await held(stock);
    expect(heldA.rightAfterAbort).toEqual(["parent step aborted"]);
    expect(heldA.rightAfterAbort).toEqual(heldB.rightAfterAbort);
    expect(heldA.outcome.value).toEqual(heldB.outcome.value);
    expect(heldA.harness.cancels.length).toBe(1);
    expect(heldB.harness.cancels.length).toBe(1);
    expect(heldA.harness.disposes).toBe(1);
    expect(heldB.harness.disposes).toBe(1);
  });

  test("TIMEOUT (seam result reject — không timer thật): lỗi BẰNG bản gốc, vẫn dispose", async () => {
    const timeout = new Error("workflow timed out after 30000 ms");
    const { a, b, ra, rb } = await runBoth({ objective: "x" }, defaultExec(), { rejectWith: timeout });
    expect(errorText(ra.error)).toBe("Error: workflow timed out after 30000 ms");
    expect(errorText(ra.error)).toBe(errorText(rb.error));
    expect(a.disposes).toBe(1);
    expect(b.disposes).toBe(1);
  });

  test("render văn bản hướng phụ huynh BẰNG gốc, kể cả CẮT theo maxResultChars", () => {
    const values: unknown[] = [
      { runId: "r", agentsStarted: 1, result: { status: "complete", roundsStarted: 1, report: reportOf("complete") } },
      { runId: "r", agentsStarted: 2, result: { status: "blocked", roundsStarted: 2, report: reportOf("blocked") } },
      { runId: "r", agentsStarted: 64, result: { status: "budget-limited", roundsStarted: 64, report: reportOf("continue") } },
    ];
    for (const maxResultChars of [16384, 40, 10]) {
      const toolA = install(makeHarness(), mine.apply, { ...RUNNING_CONFIG, maxResultChars });
      const toolB = install(makeHarness(), stock.apply, { ...RUNNING_CONFIG, maxResultChars });
      for (const value of values) {
        const blocksA = toolA.output.render({ objective: "x" }, value);
        const blocksB = toolB.output.render({ objective: "x" }, value);
        expect(blocksA).toEqual(blocksB);
        expect(blocksA[0]?.type).toBe("text");
        expect(blocksA[0]?.text.length).toBeLessThanOrEqual(maxResultChars);
      }
    }
  });
});

describe("E. GÓI METADATA + locale", () => {
  test("package.json: tên/private/type/main/exports mirror stock (bỏ ./src/* + types nguồn)", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PackageMeta;
    const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as PackageMeta;
    expect(meta.name).toBe("@galaxy-blackhole/gbh-tool-ralph");
    expect(meta.private).toBe(true);
    expect(meta.type).toBe("module");
    expect(meta.main).toBe("lib/index.js");
    expect(meta.types).toBeUndefined();
    // 08/11/2026 (Lead): "." nay là OBJECT có điều kiện `types` (lib/types/index.d.ts CÓ THẬT) — cần cho consumer TS;
    //   bất biến thật là đích RUNTIME `default` trùng stock. Các subpath khác vẫn so nguyên văn.
    expect(meta.exports).toEqual({
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./package.json": "./package.json",
      "./locale/*.json": "./locale/*.json",
    });
    expect(Object.keys(meta.exports ?? {}).sort()).toEqual(Object.keys(stockMeta.exports ?? {}).filter((key) => key !== "./src/*").sort());
    expect(meta.exports?.["./src/*"]).toBeUndefined();
  });

  test("KHÔNG gbh.row — nested kind:'group' optional-ralph; tests + peers = peerDependencies + dependencies", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PackageMeta;
    const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as PackageMeta;
    expect(meta.gbh?.row).toBeUndefined();
    expect(meta.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(meta.gbh?.nested).toEqual({
      kind: "group",
      pluginId: "tool-ralph",
      stockId: "@deepseek-ai/dsh-tool-ralph",
      presets: ["optional-ralph"],
    });
    expect(meta.gbh?.tests).toEqual(["tests/host/tool-ralph.test.ts"]);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(meta.peerDependencies, stockMeta.peerDependencies)).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(meta.dependencies, stockMeta.dependencies)).toBe(true);
    const expectedPeers = [...Object.keys(stockMeta.peerDependencies ?? {}), ...Object.keys(stockMeta.dependencies ?? {})];
    expect(meta.gbh?.peers).toEqual(expectedPeers);
  });

  test("node_modules: mọi peer/dep có symlink riêng, phân giải được + dải khai báo PHỦ đúng bản kernel", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PackageMeta;
    const requireFromPkg = createRequire(join(PKG, "package.json"));
    const names = [...Object.keys(meta.peerDependencies ?? {}), ...Object.keys(meta.dependencies ?? {})];
    expect(names.length).toBe(8);
    for (const name of names) {
      const link = join(PKG, "node_modules", name);
      expect(lstatSync(link).isSymbolicLink()).toBe(true);
      expect(existsSync(requireFromPkg.resolve(name))).toBe(true);
      // Ghi chú 01/11/2026: phép so CŨ đòi realpath của link TRÙNG realpath trong apps/host/node_modules.
      // Layout node_modules do `bun install` quyết định — cây hiện tại trỏ node_modules/.bun cho MỌI gói
      // workspace, nên phép so đó báo đỏ một cây CÀI ĐÚNG. Hợp đồng mà GÓI kiểm soát được là KHAI BÁO: dải
      // version (peerDependencies/dependencies) phải PHỦ đúng phiên bản kernel đang chạy. Không rỗng: khai
      // lệch (vd 0.2.1-rc.5 khi kernel là 0.2.1-alpha.4) hoặc dải khác (^, >=, *) vẫn ĐỎ.
      const kernelVersion = (JSON.parse(readFileSync(join(HOST_MODULES, name, "package.json"), "utf8")) as { version: string }).version;
      const declared = String((meta.peerDependencies ?? {})[name] ?? (meta.dependencies ?? {})[name]);
      expect(Bun.semver.satisfies(kernelVersion, declared)).toBe(true);
    }
  });

  test("locale: TOÀN BỘ cây con KHỚP TỪNG BYTE bản gốc", () => {
    const stockLocale = join(STOCK_DIR, "locale");
    const ourLocale = join(PKG, "locale");
    const expected = treeFiles(stockLocale);
    expect(expected).toEqual(["en.json", "zh.json"]);
    // 20/10/2026: gói ta có THÊM locale/vi.json (bản dịch tiếng Việt CÓ CHỦ ĐÍCH).
    const own = treeFiles(ourLocale);
    expect(own.filter((file) => file !== "vi.json")).toEqual(expected);
    expect(own).toContain("vi.json");
    for (const rel of expected) {
      expect(readFileSync(join(ourLocale, rel)).equals(readFileSync(join(stockLocale, rel)))).toBe(true);
    }
  });
});