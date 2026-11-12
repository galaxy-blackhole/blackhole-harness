/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 06/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-fs-search: artefact BYTE-IDENTICAL bundle gốc + bề mặt export +
 *      Config + apply trên Context cordis THẬT với dịch vụ tools/systemPrompt/subprocess/workingDirectory GIẢ
 *      (KHÔNG spawn tiến trình thật) + helper thuần + 2 tool glob/grep + vòng post-execute spill
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-fs-search/build.ts";
import { assembleBundle, stripSliceScaffold } from "../../packages/host/tool-fs-search/src/assemble.ts";
import { PART_FILES, STOCK_BUNDLE } from "../../packages/host/tool-fs-search/src/manifest.ts";
// 06/11/2026 (P1b): artefact mang id GBH ⇒ quy id về dạng gốc trước khi so byte/sha với bundle stock.
import { chuanHoaHost } from "../lib/artefact-normalize.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "tool-fs-search");
/** Artefact của ta. */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_FILE = join(REPO, STOCK_BUNDLE);
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Workdir GIẢ của caller. */
const WORKDIR = "/tmp/gbh-fs-search-ws";
/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);
/** Hai tool plugin đăng ký, ĐÚNG thứ tự apply. */
const TOOL_NAMES = ["glob", "grep"];
/** ĐÚNG 34 tên export runtime của gói MỘT MẶT (không có default export). */
const EXPORT_NAMES = ["Config", "GLOB_MAX_RESULTS", "GLOB_VCS_EXCLUDES", "GREP_MAX_LINE_BYTES", "GREP_MAX_MATCHES", "RAW_OUTPUT_MAX_BYTES", "SEARCH_GRACE_MS", "SEARCH_META_MAX_BYTES", "SEARCH_STDERR_MAX_BYTES", "SEARCH_TIMEOUT_MS", "SearchError", "apply", "applyGlobTool", "applyGrepTool", "buildGlobCommand", "buildGrepCommand", "formatGlobOutput", "formatGrepMatches", "formatGrepOutput", "inject", "name", "parseGlobArgs", "parseGrepArgs", "parseGrepMatches", "presentGlobCall", "presentGlobResult", "presentGrepCall", "presentGrepResult", "previewLine", "resolveRgPath", "runRipgrep", "sampleAcrossTopLevel", "toWorkdirRelative", "trySaveFormattedResult"];

interface Match { path: string; lineNumber: number; line: string }
interface GlobInput { pattern: string; path?: string }
interface GrepInput { pattern: string; path?: string; include?: string }
interface Retained { items: Match[]; seen: number; kept: number; truncated: boolean }
interface SpillRef { locator: string; retrievalHint: string }
interface Sample { items: string[]; shown: number; total: number }
interface ConfigSchema { "~standard": { validate(value: unknown): { value?: unknown; issues?: unknown } } }
interface FiberLike { state?: number }
interface Section { name: string; order: number; text(ctx: { scope?: unknown }): string }
interface ToolResult { isError?: boolean; value?: unknown; meta?: unknown }
interface Reader { readFrom(from?: number): { text: string; lossy: boolean; nextOffset: number } }
interface SpawnHandle { done: Promise<{ exitCode: number | null; signal: string | null }>; collected: { stdout?: Reader; stderr?: Reader } }

/** Yêu cầu spawn mà runRipgrep gửi seam. */
interface SpawnRequest { argv: string[]; cwd: string; stdio: { stdin: string; stdout: { maxBytes: number }; stderr: { maxBytes: number } }; graceMs: number; signal: AbortSignal }
/** Ngữ cảnh thực thi GIẢ. */
interface Exec { agent?: { session: { id: string; header: { id: string; cwd: string } } }; name: string; callId: string; parent?: unknown; signal: AbortSignal }
/** Tool đã defineTool (bề mặt test chạm tới). */
interface ToolLike {
  name: string;
  description: string;
  parameters: unknown;
  output: { schema: unknown; render(args: unknown, value: unknown): unknown; presentationMeta?(args: unknown, value: unknown): unknown };
  timeoutMs?: number;
  execute(args: unknown, exec: unknown): Promise<unknown>;
  presentCall(args: unknown): unknown;
  presentResult(args: unknown, result: ToolResult): unknown;
}
/** Context cordis tối thiểu mà test chạm tới (lớp THẬT của app). */
interface Ctx {
  provide(name: string, value: unknown): () => Promise<void>;
  plugin(plugin: unknown, config?: unknown): FiberLike;
  logger: { warn(...args: unknown[]): void };
  get(name: string): unknown;
  waterfall(...args: unknown[]): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => unknown): unknown;
}
/** Bản ghi lời gọi dịch vụ GIẢ. */
interface Recorder { tools: ToolLike[]; sections: Section[]; orders: unknown[]; spawns: SpawnRequest[]; warns: unknown[][]; saves: unknown[] }
/** Tuỳ chọn dựng rig. */
interface MountOptions { config?: Record<string, unknown>; rawConfig?: Record<string, unknown>; withTools?: boolean; withPrompt?: boolean; withSpill?: boolean; spawn?: (request: SpawnRequest) => SpawnHandle }
/** Kết quả một lượt mount. */
interface Rig { ctx: Ctx; rec: Recorder; tools: Map<string, ToolLike>; config: Record<string, unknown>; error: Error | null }
/** Bề mặt một module (của ta hoặc bundle gốc) — chỉ khai phần test dùng. */
interface Surface {
  readonly name: string;
  readonly inject: readonly string[];
  apply(ctx: unknown, config: Record<string, unknown>): Promise<void>;
  readonly Config: ConfigSchema;
  readonly SearchError: new (message: string, code: string, options?: { cause?: unknown }) => Error & { code: string };
  readonly RAW_OUTPUT_MAX_BYTES: number;
  readonly SEARCH_TIMEOUT_MS: number;
  readonly SEARCH_STDERR_MAX_BYTES: number;
  readonly SEARCH_GRACE_MS: number;
  readonly SEARCH_META_MAX_BYTES: number;
  readonly GLOB_MAX_RESULTS: number;
  readonly GLOB_VCS_EXCLUDES: readonly string[];
  readonly GREP_MAX_MATCHES: number;
  readonly GREP_MAX_LINE_BYTES: number;
  buildGlobCommand(input: GlobInput): string[];
  buildGrepCommand(input: GrepInput): string[];
  parseGlobArgs(args: { pattern: string; path?: string }): GlobInput;
  parseGrepArgs(args: { pattern: string; path?: string; include?: string }): GrepInput;
  parseGrepMatches(stdout: string): Match[];
  formatGrepMatches(matches: Match[]): string;
  formatGrepOutput(retained: Retained, spillRef?: SpillRef): string;
  formatGlobOutput(sample: Sample, seen: number, spillRef?: SpillRef): string;
  toWorkdirRelative(path: string, workdir: string): string;
  previewLine(line: string, maxBytes: number): string;
  sampleAcrossTopLevel(paths: string[], maxItems: number, root?: string): Sample;
  presentGlobCall(args: { pattern: string; path?: string }): unknown;
  presentGrepCall(args: { pattern: string; path?: string; include?: string }): unknown;
  presentGlobResult(args: unknown, result: ToolResult): unknown;
  presentGrepResult(args: unknown, result: ToolResult): unknown;
  trySaveFormattedResult(ctx: unknown, exec: Exec, suggestedName: string, content: string): Promise<unknown>;
  runRipgrep(ctx: unknown, exec: Exec, toolName: string, argv: string[], rawOutputMaxBytes: number, graceMs: number, stderrMaxBytes: number): Promise<{ stdout: string; noMatches: boolean; workdir: string }>;
  resolveRgPath(): Promise<string>;
}

/** Bề mặt module của ta (nạp sau beforeAll). */
let ours: Surface;
/** Đường dẫn artefact đang dùng (lib hoặc bản build tạm). */
let oursFile = OURS_FILE;
/** Thư mục tạm cần dọn (chỉ có khi lib chưa tồn tại). */
let tempDir: string | undefined;

/** Nội dung bundle gốc dưới dạng module (A). */
const stock = (await import(STOCK_FILE)) as unknown as Surface;
/** Lớp lỗi HarnessError THẬT của kernel. */
const { HarnessError } = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-llm", "lib", "index.js"))) as { HarnessError: new (...args: unknown[]) => Error };
/** 06/11/2026 (P1b): artefact mang id GBH ⇒ lớp lỗi của TA thừa hưởng HarnessError của GÓI TA (farm), không phải kernel. */
const { HarnessError: OurHarnessError } = (await import(join(REPO, "node_modules", "@galaxy-blackhole", "gbh-llm", "lib", "index.js"))) as {
  HarnessError: new (...args: unknown[]) => Error;
};
/** Lớp Context cordis THẬT của runtime. */
const { Context } = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as { Context: new () => Ctx };

beforeAll(async () => {
  // Luôn build lại vào thư mục tạm TRONG gói (bare specifier khác vẫn đi qua node_modules của gói) rồi
  // symlink HAI nhánh sang bản KERNEL: @deepseek-ai (cordis/dsh-llm/…) và @vscode (@vscode/ripgrep).
  // Vì sao (01/11/2026): bundle của ta BYTE-IDENTICAL bản gốc, nhưng peer phân giải qua node_modules/.bun
  // ⇒ (a) `error instanceof HarnessError` TRƯỢT nên SearchError không cùng lớp kernel; (b) `resolveRgPath`
  // (`await import("@vscode/ripgrep")`) trả binary của .bun thay vì binary kernel. Nạp artefact từ thư mục
  // có symlink kernel (pattern tests/host/shell.test.ts) thì hai bên dùng CHUNG một lớp + một binary.
  tempDir = mkdtempSync(join(PKG, ".tmp-build-"));
  oursFile = buildPackage(tempDir);
  mkdirSync(join(tempDir, "node_modules"), { recursive: true });
  symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(tempDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(tempDir, "node_modules", "@galaxy-blackhole"), "dir");
  symlinkSync(join(REPO, "apps", "host", "node_modules", "@vscode"), join(tempDir, "node_modules", "@vscode"), "dir");
  ours = (await import(oursFile)) as unknown as Surface;
}, 60_000);

afterAll(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
});

/** Băm SHA-256 một buffer → chuỗi hex 64 ký tự. */
function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Validate cấu hình qua schema của một bên → { value } hoặc { issues }. */
function validateConfig(api: Surface, input: Record<string, unknown>): { value?: Record<string, unknown>; issues?: unknown } {
  const result = api.Config["~standard"].validate(input);
  return { value: result.value as Record<string, unknown> | undefined, issues: result.issues };
}

/** Định dạng lỗi thành "nem|<name>|<code>|<message>". */
function errorText(error: unknown): string {
  const failure = error as Error & { code?: string };
  return ["nem", failure.name, failure.code ?? "-", failure.message].join("|");
}

/** Chạy hàm sync → "ok:<JSON>" hoặc chuỗi lỗi. */
function outcome(run: () => unknown): string {
  try { return "ok:" + JSON.stringify(run()); } catch (error) { return errorText(error); }
}

/** Chạy hàm async → "ok:<JSON>" hoặc chuỗi lỗi. */
async function outcomeAsync(run: () => Promise<unknown>): Promise<string> {
  try { return "ok:" + JSON.stringify(await run()); } catch (error) { return errorText(error); }
}

/** Reader GIẢ cho stdout/stderr. */
function readerOf(text: string, lossy: boolean): Reader {
  return { readFrom: () => ({ text, lossy, nextOffset: text.length }) };
}

/** Handle subprocess GIẢ từ stdout/stderr/exitCode/signal/lossy mong muốn. */
function handleOf(facts: { stdout?: string; stderr?: string; lossy?: boolean; exitCode?: number | null; signal?: string | null }): SpawnHandle {
  return {
    done: Promise.resolve({ exitCode: facts.exitCode === undefined ? 0 : facts.exitCode, signal: facts.signal === undefined ? null : facts.signal }),
    collected: { stdout: readerOf(facts.stdout ?? "", facts.lossy ?? false), stderr: readerOf(facts.stderr ?? "", false) },
  };
}

/** Spawn mặc định: exit 0, hai luồng rỗng (KHÔNG chạm tiến trình thật). */
function defaultSpawn(_request: SpawnRequest): SpawnHandle {
  return handleOf({});
}

/** Bản ghi rỗng. */
function makeRecorder(): Recorder {
  return { tools: [], sections: [], orders: [], spawns: [], warns: [], saves: [] };
}

/** Dịch vụ tools GIẢ: register/get/schemas; get tôn trọng scope để đo section text. */
function toolsService(rec: Recorder): Record<string, unknown> {
  return {
    register: (tool: ToolLike) => { rec.tools.push(tool); },
    get: (name: string, scope?: unknown) => {
      if (scope === "none") return undefined;
      if (name === "read") return scope === "with-read" ? { name: "read" } : undefined;
      return rec.tools.find((tool) => tool.name === name);
    },
    schemas: () => rec.tools.map((tool) => tool.name),
  };
}

/** Dịch vụ systemPrompt GIẢ: ghi section + khoá order. */
function promptService(rec: Recorder): Record<string, unknown> {
  return {
    section: (section: Section) => { rec.sections.push(section); },
    getSectionOrder: (key: string) => { rec.orders.push(key); return key === "TOOL_GLOB" ? 610 : 620; },
  };
}

/** Dịch vụ subprocess GIẢ: ghi yêu cầu rồi trả handle của runner giả. */
function subprocessService(rec: Recorder, spawn: (request: SpawnRequest) => SpawnHandle): Record<string, unknown> {
  return { spawn: (request: SpawnRequest) => { rec.spawns.push(request); return spawn(request); } };
}

/** Dịch vụ spillStore GIẢ: ghi saveText rồi trả tham chiếu. */
function spillService(rec: Recorder): Record<string, unknown> {
  return {
    saveText: async (save: unknown) => {
      rec.saves.push(save);
      return { locator: "gbh-spill://" + String((save as { suggestedName?: unknown }).suggestedName ?? "x"), retrievalHint: "doc lai bang read" };
    },
  };
}

/** Dựng Context cordis THẬT + dịch vụ GIẢ rồi gọi apply của một bên (KHÔNG ném). */
async function mount(api: Surface, options: MountOptions = {}): Promise<Rig> {
  const ctx = new Context();
  const rec = makeRecorder();
  let config: Record<string, unknown>;
  if (options.rawConfig !== undefined) config = options.rawConfig;
  else {
    const validated = validateConfig(api, { sampleOverCapGlobResults: true, ...options.config });
    if (validated.issues !== undefined) throw new Error("config test khong hop le: " + JSON.stringify(validated.issues));
    config = validated.value ?? {};
  }
  if (options.withTools !== false) ctx.provide("tools", toolsService(rec));
  if (options.withPrompt !== false) ctx.provide("systemPrompt", promptService(rec));
  ctx.provide("subprocess", subprocessService(rec, options.spawn ?? defaultSpawn));
  ctx.provide("workingDirectory", { ensure: async () => WORKDIR });
  if (options.withSpill !== false) ctx.provide("spillStore", spillService(rec));
  ctx.logger.warn = (...args: unknown[]) => { rec.warns.push(args); };
  let error: Error | null = null;
  try { await api.apply(ctx, config); } catch (caught) { error = caught as Error; }
  const tools = new Map<string, ToolLike>();
  for (const tool of rec.tools) tools.set(tool.name, tool);
  return { ctx, rec, tools, config, error };
}

/** Chụp spec model-facing của một tool. */
function specOf(tool: ToolLike): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    output: tool.output.schema,
    hasPresentationMeta: typeof tool.output.presentationMeta === "function",
    timeoutMs: tool.timeoutMs ?? null,
    presentCall: tool.presentCall({ pattern: "*.ts" }),
  };
}

/** Chụp section systemPrompt theo 3 scope (có tool / ẩn tool / có read). */
function sectionFacts(rig: Rig): Record<string, unknown>[] {
  return rig.rec.sections.map((section) => ({
    name: section.name,
    order: section.order,
    texts: [section.text({ scope: undefined }), section.text({ scope: "none" }), section.text({ scope: "with-read" })],
  }));
}

/** Bóc tiền tố "ok:" của outcome rồi parse JSON. */
function parsed(text: string): unknown {
  return JSON.parse(text.slice(3));
}

/** Chạy thân một tool rồi gói kết quả/lỗi thành chuỗi. */
async function runTool(rig: Rig, name: string, args: unknown, exec: Exec): Promise<string> {
  const tool = rig.tools.get(name);
  if (tool === undefined) throw new Error("khong co tool " + name);
  return outcomeAsync(() => tool.execute(args, exec));
}

/** Dựng exec GIẢ. */
function makeExec(name: string, overrides: Partial<Exec> = {}): Exec {
  const base: Exec = { agent: { session: { id: "s1", header: { id: "s1", cwd: WORKDIR } } }, name, callId: "call-1", signal: new AbortController().signal };
  return { ...base, ...overrides };
}

/** Dựng ctx tối thiểu cho trySaveFormattedResult. */
function spillCtx(spillStore: unknown, warns: unknown[][]): Record<string, unknown> {
  return { get: (name: string) => (name === "spillStore" ? spillStore : undefined), logger: { warn: (...args: unknown[]) => { warns.push(args); } } };
}

/** Dựng ctx tối thiểu cho runRipgrep. */
function runnerCtx(spawn: (request: SpawnRequest) => SpawnHandle): Record<string, unknown> {
  return { workingDirectory: { ensure: async () => WORKDIR }, subprocess: { spawn } };
}

/** Đăng ký plugin qua vòng đời cordis THẬT rồi chụp trạng thái. */
async function pluginSnapshot(api: Surface, withServices: boolean): Promise<Record<string, unknown>> {
  const ctx = new Context();
  const rec = makeRecorder();
  if (withServices) {
    ctx.provide("tools", toolsService(rec));
    ctx.provide("systemPrompt", promptService(rec));
    ctx.provide("subprocess", subprocessService(rec, defaultSpawn));
    ctx.provide("workingDirectory", { ensure: async () => WORKDIR });
    ctx.provide("spillStore", spillService(rec));
  }
  const plugin = { name: api.name, inject: api.inject, apply: api.apply, Config: api.Config };
  let error: string | null = null;
  let fiber: FiberLike | undefined;
  try { fiber = ctx.plugin(plugin, { sampleOverCapGlobResults: true }); } catch (caught) { error = String(caught); }
  await new Promise((resolve) => setTimeout(resolve, 40));
  return { error, state: fiber?.state ?? null, tools: rec.tools.map((tool) => tool.name), sections: rec.sections.map((section) => section.name), orders: rec.orders };
}

/** Đọc text của content[0] trong một quyết định post-execute. */
function decisionText(decision: Record<string, unknown>): string {
  const content = decision["content"] as { text?: string }[] | undefined;
  return content?.[0]?.text ?? "";
}

/** Chạy waterfall tools/post-execute với next trả decision cho trước. */
async function hookDecision(rig: Rig, exec: Exec, result: ToolResult, decision: Record<string, unknown> = { kind: "accept" }): Promise<Record<string, unknown>> {
  return (await rig.ctx.waterfall("tools/post-execute", exec, result, async () => decision)) as Record<string, unknown>;
}

describe("artefact: cổng byte", () => {
  test("lib/index.js: 55.688 B, delta 0, trùng từng byte + cùng sha256", () => {
    const built = readFileSync(oursFile);
    const stockBytes = readFileSync(STOCK_FILE);
    // 06/11/2026 (P1b): artefact mang id CỦA TA ⇒ chuẩn hoá id về dạng gốc rồi mới so byte/sha với stock.
    const builtChuan = chuanHoaHost(built.toString("utf8"));
    const builtChuanBytes = Buffer.from(builtChuan, "utf8");
    expect(builtChuanBytes.length).toBe(stockBytes.length);
    expect(builtChuanBytes.length).toBe(55_688);
    expect(statSync(oursFile).size).toBe(Buffer.byteLength(built.toString("utf8"), "utf8"));
    expect(builtChuanBytes.equals(stockBytes)).toBe(true);
    expect(sha256(builtChuanBytes)).toBe(sha256(stockBytes));
    expect(sha256(builtChuanBytes)).toBe("8d64d2e8a5310b442ae66bc0daf7d6957ec095dbe43cabd9eb208f7370e381ed");
    // Vai trò ĐẢO: id ta có mặt trong artefact, id stock thì không.
    expect(built.toString("utf8").includes("@galaxy-blackhole/gbh-")).toBe(true);
  });

  test("assembleBundle(): 2 lát ghép = NGUYÊN VĂN bundle gốc + chia đúng ranh giới //#region", () => {
    const assembled = assembleBundle();
    expect(Buffer.byteLength(assembled, "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect(Buffer.from(assembled, "utf8").equals(Buffer.from(STOCK_TEXT, "utf8"))).toBe(true);
    expect(assembled).toBe(STOCK_TEXT);
    expect(PART_FILES).toEqual(["part-00.ts", "part-01.ts"]);
    const lineCounts = PART_FILES.map((file) => readFileSync(join(PKG, "src", "parts", file), "utf8").split(EOL).length - 1);
    expect(lineCounts).toEqual([532, 763]);
    for (const count of lineCounts) expect(count).toBeLessThanOrEqual(1000);
    const first = stripSliceScaffold(readFileSync(join(PKG, "src", "parts", "part-00.ts"), "utf8"), "part-00.ts");
    const second = stripSliceScaffold(readFileSync(join(PKG, "src", "parts", "part-01.ts"), "utf8"), "part-01.ts");
    expect(first[first.length - 1]).toBe("//#endregion");
    expect(second[0]).toBe("//#region lib/types/glob.js");
    expect(second[second.length - 1]).toBe("");
  });

  test("stripSliceScaffold: bỏ header/marker/dòng biên; báo lỗi khi thiếu giao kèo", () => {
    const good = ["/**", " * desc x", " */", "// @ts-nocheck", "", "const a = 1;", "", "export {};", ""].join(EOL);
    expect(stripSliceScaffold(good, "x.ts")).toEqual(["const a = 1;"]);
    expect(() => stripSliceScaffold(good.split("// @ts-nocheck").join("// khac"), "x.ts")).toThrow("khong thay dong danh dau");
    expect(() => stripSliceScaffold(good.split(" */" + EOL).join(""), "x.ts")).toThrow("thieu khoi header");
    expect(() => stripSliceScaffold(good.split("export {};").join(""), "x.ts")).toThrow("thieu dong ket thuc module");
    expect(() => stripSliceScaffold(good.split("// @ts-nocheck" + EOL + EOL).join("// @ts-nocheck" + EOL), "x.ts")).toThrow("thieu dong trong sau dong danh dau");
    expect(() => stripSliceScaffold(good.split(EOL + EOL + "export {};").join(EOL + "export {};"), "x.ts")).toThrow("thieu dong trong truoc dong ket thuc");
  });
});

describe("bề mặt export A/B", () => {
  test("cùng ĐÚNG 34 tên export runtime với bundle gốc", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(Object.keys(ours)).toHaveLength(34);
  });

  test("name/inject/hằng số công khai trùng giá trị hai bên", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-fs-search");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["tools", "systemPrompt", "subprocess", "workingDirectory"]);
    const constants = ["RAW_OUTPUT_MAX_BYTES", "SEARCH_TIMEOUT_MS", "SEARCH_STDERR_MAX_BYTES", "SEARCH_GRACE_MS", "SEARCH_META_MAX_BYTES", "GLOB_MAX_RESULTS", "GREP_MAX_MATCHES", "GREP_MAX_LINE_BYTES"] as const;
    for (const key of constants) expect(ours[key]).toBe(stock[key]);
    expect(ours.RAW_OUTPUT_MAX_BYTES).toBe(20_000_000);
    expect(ours.SEARCH_TIMEOUT_MS).toBe(30_000);
    expect(ours.SEARCH_STDERR_MAX_BYTES).toBe(65_536);
    expect(ours.SEARCH_GRACE_MS).toBe(3_000);
    expect(ours.SEARCH_META_MAX_BYTES).toBe(65_536);
    expect(ours.GLOB_MAX_RESULTS).toBe(100);
    expect(ours.GREP_MAX_MATCHES).toBe(250);
    expect(ours.GREP_MAX_LINE_BYTES).toBe(2_000);
    expect(ours.GLOB_VCS_EXCLUDES).toEqual(stock.GLOB_VCS_EXCLUDES);
    expect(ours.GLOB_VCS_EXCLUDES).toEqual([".git", ".svn", ".hg", ".bzr", ".jj", ".sl"]);
  });

  test("SearchError: cùng lớp HarnessError, cùng name/code/message/cause", () => {
    const cause = new Error("goc");
    const a = new ours.SearchError("hong", "SEARCH_FAILED", { cause });
    const b = new stock.SearchError("hong", "SEARCH_FAILED", { cause });
    expect([a.name, a.code, a.message, a.cause === cause]).toEqual([b.name, b.code, b.message, b.cause === cause]);
    expect(a.name).toBe("SearchError");
    expect(a.code).toBe("SEARCH_FAILED");
    expect(a.message).toBe("hong");
    // 06/11/2026 (P1b): artefact mang id GBH ⇒ SearchError của TA thừa hưởng HarnessError của GÓI TA.
    expect(a instanceof OurHarnessError).toBe(true);
    expect(b instanceof HarnessError).toBe(true);
  });
});

describe("Config schema A/B", () => {
  test("String(Config) trùng nhau + validate default ra cùng object 9 khoá", () => {
    expect(String(ours.Config)).toBe(String(stock.Config));
    expect(String(ours.Config)).toBe("{ sampleOverCapGlobResults: boolean, globMaxResults?: number, grepMaxMatches?: number, grepMaxLineBytes?: number, searchMetaMaxBytes?: number, rawOutputMaxBytes?: number, graceMs?: number, stderrMaxBytes?: number, timeoutMs?: number }");
    const a = validateConfig(ours, { sampleOverCapGlobResults: true });
    const b = validateConfig(stock, { sampleOverCapGlobResults: true });
    expect(a.issues).toBeUndefined();
    expect(b.issues).toBeUndefined();
    expect(JSON.stringify(a.value)).toBe(JSON.stringify(b.value));
    expect(a.value).toEqual({ sampleOverCapGlobResults: true, globMaxResults: 100, grepMaxMatches: 250, grepMaxLineBytes: 2_000, searchMetaMaxBytes: 65_536, rawOutputMaxBytes: 20_000_000, graceMs: 3_000, stderrMaxBytes: 65_536, timeoutMs: 30_000 });
  });

  test("validate sai/thiếu ⇒ cùng issues (cùng thông điệp, cùng path)", () => {
    const bad = [{}, { sampleOverCapGlobResults: "yes" }, { sampleOverCapGlobResults: true, globMaxResults: "abc" }, { sampleOverCapGlobResults: true, timeoutMs: {} }];
    for (const [index, input] of bad.entries()) {
      const a = validateConfig(ours, input);
      const b = validateConfig(stock, input);
      expect(a.value).toBeUndefined();
      expect(b.value).toBeUndefined();
      expect(JSON.stringify(a.issues)).toBe(JSON.stringify(b.issues));
      if (index === 0) expect(JSON.stringify(a.issues)).toContain("missing required value");
      else expect(JSON.stringify(a.issues)).toContain("expected");
    }
  });
});

describe("apply trên Context cordis THẬT với dịch vụ GIẢ", () => {
  test("đăng ký đúng 2 tool glob/grep: name/description/parameters/output/timeoutMs A≡B", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.rec.tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    expect(a.rec.orders).toEqual(["TOOL_GLOB", "TOOL_GREP"]);
    expect(JSON.stringify(a.rec.tools.map(specOf))).toBe(JSON.stringify(b.rec.tools.map(specOf)));
    const specs = a.rec.tools.map(specOf);
    expect(String(specs[0]?.description)).toContain("Returns up to 100 paths");
    expect(String(specs[0]?.description)).toContain("sampled across top-level entries");
    expect(String(specs[1]?.description)).toContain("Returns up to 250 matches");
    expect(specs.map((spec) => spec.timeoutMs)).toEqual([30_000, 30_000]);
    expect(specs.map((spec) => spec.hasPresentationMeta)).toEqual([true, true]);
  });

  test("2 section systemPrompt: cùng name/order/text theo scope (ẩn tool ⇒ rỗng; có read ⇒ thêm câu read)", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    expect(JSON.stringify(sectionFacts(a))).toBe(JSON.stringify(sectionFacts(b)));
    const facts = sectionFacts(a);
    expect(facts.map((fact) => fact.name)).toEqual(["tool:glob", "tool:grep"]);
    expect(facts.map((fact) => fact.order)).toEqual([610, 620]);
    const globTexts = facts[0]?.texts as string[];
    const grepTexts = facts[1]?.texts as string[];
    expect(globTexts[0]).toBe("Use the glob tool — not shell find — to discover files by path pattern.");
    expect(globTexts[1]).toBe("");
    expect(grepTexts[0]).toBe("Use the grep tool — not shell grep or rg — to search file contents.");
    expect(grepTexts[1]).toBe("");
    expect(grepTexts[2]).toContain("Use read on a matched file");
  });

  test("config ghi đè: cùng description/timeoutMs; sampleOverCap=false đổi câu mô tả", async () => {
    const config = { globMaxResults: 3, grepMaxMatches: 5, timeoutMs: 1_234, sampleOverCapGlobResults: false };
    const a = await mount(ours, { config });
    const b = await mount(stock, { config });
    expect(JSON.stringify(a.rec.tools.map(specOf))).toBe(JSON.stringify(b.rec.tools.map(specOf)));
    const globTool = a.rec.tools[0];
    const grepTool = a.rec.tools[1];
    expect(String(globTool?.description)).toContain("up to 3 paths");
    expect(String(globTool?.description)).toContain("keeps the first paths");
    expect(String(grepTool?.description)).toContain("up to 5 matches");
    expect([globTool?.timeoutMs, grepTool?.timeoutMs]).toEqual([1_234, 1_234]);
  });

  test("apply với Config SAI ⇒ cùng lỗi (globMaxResults=0, timeoutMs=1.5, graceMs quá trần, thiếu trường)", async () => {
    const base = { sampleOverCapGlobResults: true, globMaxResults: 100, grepMaxMatches: 250, grepMaxLineBytes: 2_000, searchMetaMaxBytes: 65_536, rawOutputMaxBytes: 20_000_000, graceMs: 3_000, stderrMaxBytes: 65_536, timeoutMs: 30_000 };
    const cases: Record<string, unknown>[] = [
      { ...base, globMaxResults: 0 },
      { ...base, timeoutMs: 1.5 },
      { ...base, graceMs: 2_147_483_648 },
      {},
    ];
    const ourErrors: string[] = [];
    const theirErrors: string[] = [];
    for (const rawConfig of cases) {
      ourErrors.push((await mount(ours, { rawConfig })).error?.message ?? "khong nem");
      theirErrors.push((await mount(stock, { rawConfig })).error?.message ?? "khong nem");
    }
    expect(ourErrors).toEqual(theirErrors);
    expect(ourErrors[0]).toBe("tool-fs-search: globMaxResults must be a positive integer");
    expect(ourErrors[1]).toBe("tool-fs-search: timeoutMs must be a positive integer");
    expect(ourErrors[2]).toBe("tool-fs-search: graceMs must be no greater than 2147483647");
    expect(ourErrors[3]).toBe("tool-fs-search: globMaxResults must be a positive integer");
  });

  test("apply thiếu dịch vụ: cùng lỗi systemPrompt/tools (section ghi trước rồi mới ném)", async () => {
    const a = await mount(ours, { withPrompt: false });
    const b = await mount(stock, { withPrompt: false });
    expect(a.error?.message).toBe(b.error?.message ?? "");
    expect(a.error?.message).toContain("systemPrompt.section");
    expect(a.rec.sections).toHaveLength(0);
    const c = await mount(ours, { withTools: false });
    const d = await mount(stock, { withTools: false });
    expect(c.error?.message).toBe(d.error?.message ?? "");
    expect(c.error?.message).toContain("tools.register");
    expect(c.rec.sections).toHaveLength(1);
    expect(c.rec.tools).toHaveLength(0);
  });

  test("ctx.plugin THẬT: inject đủ ⇒ 2 tool + 2 section + state 2; thiếu dịch vụ ⇒ không đăng ký gì", async () => {
    const a = await pluginSnapshot(ours, true);
    const b = await pluginSnapshot(stock, true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.tools).toEqual(TOOL_NAMES);
    expect(a.sections).toEqual(TOOL_NAMES.map((name) => "tool:" + name));
    expect(a.state).toBe(2);
    const c = await pluginSnapshot(ours, false);
    const d = await pluginSnapshot(stock, false);
    expect(JSON.stringify(c)).toBe(JSON.stringify(d));
    expect(c.tools).toEqual([]);
    expect(c.sections).toEqual([]);
  });
});

describe("helper THUẦN A/B (sync)", () => {
  test("parse + build argv glob/grep trên 10 input (kể cả nhánh lỗi)", () => {
    const cases: [string, (api: Surface) => unknown][] = [
      ["glob co ban", (api) => api.buildGlobCommand(api.parseGlobArgs({ pattern: "*.ts" }))],
      ["glob path", (api) => api.buildGlobCommand(api.parseGlobArgs({ pattern: "src/**/*.ts", path: "src" }))],
      ["glob path dash", (api) => api.buildGlobCommand(api.parseGlobArgs({ pattern: "*", path: "-rf" }))],
      ["glob pattern rong", (api) => api.parseGlobArgs({ pattern: "  " })],
      ["glob path rong", (api) => api.parseGlobArgs({ pattern: "x", path: " " })],
      ["grep co ban", (api) => api.buildGrepCommand(api.parseGrepArgs({ pattern: "foo" }))],
      ["grep include", (api) => api.buildGrepCommand(api.parseGrepArgs({ pattern: "a b", path: "src", include: "*.{ts,tsx}" }))],
      ["grep include am", (api) => api.parseGrepArgs({ pattern: "x", include: "!*.ts" })],
      ["grep include danh sach", (api) => api.parseGrepArgs({ pattern: "x", include: "*.ts,*.js" })],
      ["grep pattern rong", (api) => api.parseGrepArgs({ pattern: "" })],
    ];
    for (const [label, run] of cases) expect([label, outcome(() => run(ours))]).toEqual([label, outcome(() => run(stock))]);
    expect(ours.buildGlobCommand({ pattern: "*.ts" })).toEqual(stock.buildGlobCommand({ pattern: "*.ts" }));
    expect(ours.buildGlobCommand({ pattern: "*.ts" })).toEqual([
      "--files", "--glob=*.ts", "--sort=modified", "--no-ignore", "--hidden",
      "--glob=!**/.git", "--glob=!**/.git/**", "--glob=!**/.svn", "--glob=!**/.svn/**",
      "--glob=!**/.hg", "--glob=!**/.hg/**", "--glob=!**/.bzr", "--glob=!**/.bzr/**",
      "--glob=!**/.jj", "--glob=!**/.jj/**", "--glob=!**/.sl", "--glob=!**/.sl/**",
    ]);
    expect(ours.buildGrepCommand({ pattern: "x", include: "*.ts", path: "p" })).toEqual(["--json", "--regexp=x", "--glob=*.ts", "--", "p"]);
  });

  test("toWorkdirRelative + previewLine + sampleAcrossTopLevel + formatGlobOutput trên 10 input", () => {
    const cases: [string, (api: Surface) => unknown][] = [
      ["path trong workdir", (api) => api.toWorkdirRelative(WORKDIR + "/src/a.ts", WORKDIR)],
      ["path ngoai workdir", (api) => api.toWorkdirRelative("/other/x.ts", WORKDIR)],
      ["path tuong doi", (api) => api.toWorkdirRelative("src/a.ts", WORKDIR)],
      ["path bang workdir", (api) => api.toWorkdirRelative(WORKDIR, WORKDIR)],
      ["preview cat", (api) => api.previewLine("abcdef", 3)],
      ["preview du", (api) => api.previewLine("ab", 3)],
      ["sample 4/6", (api) => api.sampleAcrossTopLevel(["a/1", "a/2", "b/1", "c/1", "c/2", "c/3"], 4)],
      ["sample root src", (api) => api.sampleAcrossTopLevel(["src/a/1", "src/b/1", "lib/c/1"], 2, "src")],
      ["format glob co spill", (api) => api.formatGlobOutput({ items: ["a.ts", "b.ts"], shown: 2, total: 2 }, 2, { locator: "gbh://g", retrievalHint: "doc lai" })],
      ["format glob khong spill", (api) => api.formatGlobOutput({ items: ["a.ts"], shown: 1, total: 1 }, 3)],
    ];
    for (const [label, run] of cases) expect([label, outcome(() => run(ours))]).toEqual([label, outcome(() => run(stock))]);
    expect(ours.sampleAcrossTopLevel(["a/1", "a/2", "b/1", "c/1", "c/2", "c/3"], 4)).toEqual({ items: ["a/1", "a/2", "b/1", "c/1"], shown: 3, total: 3 });
    expect(ours.previewLine("abcdef", 3)).toBe("abc (line truncated)");
    expect(ours.toWorkdirRelative("/other/x.ts", WORKDIR)).toBe("/other/x.ts");
  });

  test("parseGrepMatches + formatGrepMatches + formatGrepOutput + present* trên 13 input", () => {
    const record = (path: string, lineNumber: number, text: string) => JSON.stringify({ type: "match", data: { path: { text: path }, line_number: lineNumber, lines: { text } } });
    const ndjson = [
      JSON.stringify({ type: "begin", data: {} }),
      record("src/a.ts", 1, "const a = 1;" + EOL),
      record("/tmp/gbh-fs-search-ws/src/a.ts", 2, "const b = 2;" + EOL),
      JSON.stringify({ type: "match", data: { path: { text: "src/bin.ts" }, line_number: 3, lines: { bytes: "AAAA" } } }),
      JSON.stringify({ type: "summary", data: {} }),
    ].join(EOL);
    const retained: Retained = { items: [{ path: "src/a.ts", lineNumber: 1, line: "const a = 1;" }, { path: "src/a.ts", lineNumber: 2, line: "const b = 2;" }], seen: 2, kept: 2, truncated: false };
    const capped: Retained = { items: [{ path: "src/a.ts", lineNumber: 1, line: "x" }], seen: 3, kept: 1, truncated: true };
    const cases: [string, (api: Surface) => unknown][] = [
      ["parse ndjson", (api) => api.parseGrepMatches(ndjson)],
      ["parse rong", (api) => api.parseGrepMatches("")],
      ["parse khong phai json", (api) => api.parseGrepMatches("khong-json")],
      ["parse thieu path", (api) => api.parseGrepMatches(JSON.stringify({ type: "match", data: {} }))],
      ["parse thieu line number", (api) => api.parseGrepMatches(JSON.stringify({ type: "match", data: { path: { text: "a" }, lines: { text: "x" } } }))],
      ["parse khong co text/bytes", (api) => api.parseGrepMatches(JSON.stringify({ type: "match", data: { path: { text: "a" }, line_number: 1, lines: {} } }))],
      ["format matches", (api) => api.formatGrepMatches(retained.items)],
      ["format output du", (api) => api.formatGrepOutput(retained)],
      ["format output cap + spill", (api) => api.formatGrepOutput(capped, { locator: "gbh://grep", retrievalHint: "doc lai" })],
      ["format output cap khong spill", (api) => api.formatGrepOutput(capped)],
      ["present glob call", (api) => api.presentGlobCall({ pattern: "*.ts", path: "src" })],
      ["present grep call", (api) => api.presentGrepCall({ pattern: "x", path: "p", include: "*.ts" })],
      ["present view sai/rong", (api) => [api.presentGlobResult({}, { isError: true }), api.presentGrepResult({}, { isError: false, meta: { shape: "paths", paths: [] } }), api.presentGlobResult({}, { isError: false, meta: "x" })]],
    ];
    for (const [label, run] of cases) expect([label, outcome(() => run(ours))]).toEqual([label, outcome(() => run(stock))]);
    expect(ours.parseGrepMatches(ndjson)).toEqual([
      { path: "src/a.ts", lineNumber: 1, line: "const a = 1;" },
      { path: "/tmp/gbh-fs-search-ws/src/a.ts", lineNumber: 2, line: "const b = 2;" },
      { path: "src/bin.ts", lineNumber: 3, line: "(line is not valid UTF-8)" },
    ]);
    expect(ours.formatGrepOutput(capped, { locator: "gbh://grep", retrievalHint: "doc lai" })).toContain("Found 1 of 3 matches");
    expect(ours.formatGrepOutput(capped, { locator: "gbh://grep", retrievalHint: "doc lai" })).toContain("gbh://grep");
    expect(ours.formatGrepOutput(capped)).toContain("The complete result could not be saved");
    expect(ours.formatGrepOutput(retained)).toBe("Found 2 matches" + EOL + EOL + "src/a.ts" + EOL + "Line 1: const a = 1;" + EOL + "Line 2: const b = 2;");
    expect(ours.presentGlobCall({ pattern: "*.ts", path: "src" })).toEqual({ card: "generic", title: "Glob *.ts in src", kind: "search", rawInput: "*.ts" });
    expect(ours.presentGrepCall({ pattern: "x", path: "p", include: "*.ts" })).toEqual({ card: "generic", title: "Grep x in p (*.ts)", kind: "search", rawInput: "x" });
    expect(ours.presentGlobResult({}, { isError: false, meta: { shape: "paths", paths: ["a.ts"], truncated: false, total: 1 } })).toEqual({ card: "search", shape: "paths", paths: ["a.ts"], truncated: false, total: 1 });
    expect(ours.presentGrepResult({}, { isError: false, meta: { shape: "matches", files: [{ path: "a.ts", matches: [{ lineNumber: 1, line: "x" }] }], truncated: false, total: 1 } })).toEqual({ card: "search", shape: "matches", files: [{ path: "a.ts", matches: [{ lineNumber: 1, line: "x" }] }], truncated: false, total: 1 });
    expect(ours.presentGlobResult({}, { isError: true, meta: { shape: "paths", paths: [], truncated: false, total: 0 } })).toBeUndefined();
  });
});

describe("helper THUẦN A/B (async, không spawn/mạng)", () => {
  test("trySaveFormattedResult: 4 nhánh (lưu được / không session / không store / saveText ném)", async () => {
    const save = { locator: "gbh://g", retrievalHint: "doc lai" };
    const saved = (api: Surface): Promise<unknown> => api.trySaveFormattedResult(spillCtx({ saveText: async () => save }, []), makeExec("glob"), "glob-results.txt", "a" + EOL + "b");
    const noSession = (api: Surface): Promise<unknown> => api.trySaveFormattedResult(spillCtx({ saveText: async () => save }, []), makeExec("glob", { agent: undefined }), "glob-results.txt", "x");
    const noStore = (api: Surface): Promise<unknown> => api.trySaveFormattedResult(spillCtx(undefined, []), makeExec("grep"), "grep-results.txt", "x");
    const failed = (api: Surface): Promise<unknown> => api.trySaveFormattedResult(spillCtx({ saveText: async () => { throw new Error("disk full"); } }, []), makeExec("grep"), "grep-results.txt", "x");
    const cases: [string, (api: Surface) => Promise<unknown>][] = [["luu duoc", saved], ["khong session", noSession], ["khong store", noStore], ["saveText nem", failed]];
    for (const [label, run] of cases) expect([label, await outcomeAsync(() => run(ours))]).toEqual([label, await outcomeAsync(() => run(stock))]);
    expect(await outcomeAsync(() => saved(ours))).toBe("ok:" + JSON.stringify(save));
    expect(await outcomeAsync(() => noSession(ours))).toBe("ok:undefined");
    expect(await outcomeAsync(() => noStore(ours))).toBe("ok:undefined");
    expect(await outcomeAsync(() => failed(ours))).toBe("ok:undefined");
    const oursWarns: unknown[][] = [];
    const stockWarns: unknown[][] = [];
    await ours.trySaveFormattedResult(spillCtx(undefined, oursWarns), makeExec("grep"), "grep-results.txt", "x");
    await stock.trySaveFormattedResult(spillCtx(undefined, stockWarns), makeExec("grep"), "grep-results.txt", "x");
    expect(JSON.stringify(oursWarns)).toBe(JSON.stringify(stockWarns));
    expect(String(oursWarns[0]?.[0])).toContain("no ctx.spillStore backend loaded");
  });

  test("resolveRgPath: hai bên trỏ cùng binary đóng gói @vscode/ripgrep (không chạy nó)", async () => {
    const [ourPath, stockPath] = await Promise.all([ours.resolveRgPath(), stock.resolveRgPath()]);
    expect(ourPath).toBe(stockPath);
    expect(ourPath.endsWith(join("bin", "rg"))).toBe(true);
    expect(ourPath).toContain("ripgrep");
  });
});

describe("execute 2 tool với subprocess GIẢ (KHÔNG spawn thật)", () => {
  test("glob: paths tương đối workdir + root + argv/stdio/graceMs/signal đúng", async () => {
    const spawns: SpawnRequest[] = [];
    const spawn = (request: SpawnRequest): SpawnHandle => {
      spawns.push(request);
      return handleOf({ stdout: WORKDIR + "/src/a.ts" + EOL + "lib/b.ts" + EOL });
    };
    const a = await mount(ours, { spawn });
    const b = await mount(stock, { spawn });
    const exec = makeExec("glob");
    const ourValue = await runTool(a, "glob", { pattern: "*.ts" }, exec);
    expect(ourValue).toBe(await runTool(b, "glob", { pattern: "*.ts" }, exec));
    expect(parsed(ourValue)).toEqual({ root: ".", paths: ["src/a.ts", "lib/b.ts"] });
    const request = a.rec.spawns[0];
    expect(request).toBeDefined();
    expect(request?.argv[0]).toBe(await ours.resolveRgPath());
    expect(request?.argv.slice(1)).toEqual(["--no-config", ...ours.buildGlobCommand({ pattern: "*.ts" })]);
    expect(request?.cwd).toBe(WORKDIR);
    expect(request?.stdio).toEqual({ stdin: "ignore", stdout: { maxBytes: 20_000_000 }, stderr: { maxBytes: 65_536 } });
    expect(request?.graceMs).toBe(3_000);
    expect(request?.signal).toBe(exec.signal);
    expect(spawns).toHaveLength(2);
  });

  test("glob: noMatches (exit 1) ⇒ paths rỗng; path tuyệt đối ⇒ root tương đối", async () => {
    const noMatch = (_request: SpawnRequest): SpawnHandle => handleOf({ exitCode: 1 });
    const a = await mount(ours, { spawn: noMatch });
    const b = await mount(stock, { spawn: noMatch });
    const emptyValue = await runTool(a, "glob", { pattern: "*.nope" }, makeExec("glob"));
    expect(emptyValue).toBe(await runTool(b, "glob", { pattern: "*.nope" }, makeExec("glob")));
    expect(parsed(emptyValue)).toEqual({ root: ".", paths: [] });
    const rooted = (_request: SpawnRequest): SpawnHandle => handleOf({ stdout: WORKDIR + "/src/a.ts" + EOL });
    const c = await mount(ours, { spawn: rooted });
    const d = await mount(stock, { spawn: rooted });
    const args = { pattern: "*", path: WORKDIR + "/src" };
    const rootedValue = await runTool(c, "glob", args, makeExec("glob"));
    expect(rootedValue).toBe(await runTool(d, "glob", args, makeExec("glob")));
    expect(parsed(rootedValue)).toEqual({ root: "src", paths: ["src/a.ts"] });
    const invalid = await runTool(a, "glob", { pattern: "  " }, makeExec("glob"));
    expect(invalid).toContain("pattern must be a non-empty string");
    expect(invalid).toBe(await runTool(b, "glob", { pattern: "  " }, makeExec("glob")));
  });

  test("grep: parse --json, path tương đối, noMatches, record bytes, malformed, thiếu tham số", async () => {
    const record = (path: string, lineNumber: number, text: string) => JSON.stringify({ type: "match", data: { path: { text: path }, line_number: lineNumber, lines: { text } } });
    const stdout = [record(WORKDIR + "/src/a.ts", 1, "const a = 1;" + EOL), record("lib/b.ts", 7, "let b = 2;" + EOL)].join(EOL) + EOL;
    const spawn = (_request: SpawnRequest): SpawnHandle => handleOf({ stdout });
    const a = await mount(ours, { spawn });
    const b = await mount(stock, { spawn });
    const exec = makeExec("grep");
    const ourValue = await runTool(a, "grep", { pattern: "const", include: "*.ts" }, exec);
    expect(ourValue).toBe(await runTool(b, "grep", { pattern: "const", include: "*.ts" }, exec));
    expect(parsed(ourValue)).toEqual({ matches: [{ path: "src/a.ts", lineNumber: 1, line: "const a = 1;" }, { path: "lib/b.ts", lineNumber: 7, line: "let b = 2;" }] });
    expect(a.rec.spawns[0]?.argv.slice(1)).toEqual(["--no-config", ...ours.buildGrepCommand({ pattern: "const", include: "*.ts" })]);
    const empty = await mount(ours, { spawn: () => handleOf({ exitCode: 1 }) });
    const emptyB = await mount(stock, { spawn: () => handleOf({ exitCode: 1 }) });
    const emptyValue = await runTool(empty, "grep", { pattern: "x" }, makeExec("grep"));
    expect(emptyValue).toBe(await runTool(emptyB, "grep", { pattern: "x" }, makeExec("grep")));
    expect(parsed(emptyValue)).toEqual({ matches: [] });
    const bad = await mount(ours, { spawn: () => handleOf({ stdout: "khong-json" }) });
    const badB = await mount(stock, { spawn: () => handleOf({ stdout: "khong-json" }) });
    const badValue = await runTool(bad, "grep", { pattern: "x" }, makeExec("grep"));
    expect(badValue).toBe(await runTool(badB, "grep", { pattern: "x" }, makeExec("grep")));
    expect(badValue).toContain("SearchError|SEARCH_FAILED|grep received malformed ripgrep --json output (a line is not JSON)");
    const invalid = await runTool(a, "grep", {}, exec);
    expect(invalid).toContain("ToolArgsError");
    expect(invalid).toBe(await runTool(b, "grep", {}, exec));
  });
});

describe("runRipgrep: các nhánh lỗi A≡B", () => {
  test("abort trước / spawn ném / done reject / abort khi chạy / exit 2 / signal / lossy / quá trần / thiếu luồng", async () => {
    const aborted = new AbortController();
    aborted.abort();
    const cases: [string, (api: Surface) => Promise<unknown>][] = [
      ["abort truoc", (api) => api.runRipgrep(runnerCtx(defaultSpawn), makeExec("glob", { signal: aborted.signal }), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["spawn nem", (api) => api.runRipgrep(runnerCtx(() => { throw new Error("khong co rg"); }), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["done reject", (api) => api.runRipgrep(runnerCtx(() => ({ done: Promise.resolve().then(() => { throw new Error("provider hong"); }), collected: { stdout: readerOf("", false), stderr: readerOf("", false) } })), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["abort khi dang chay", (api) => {
        const controller = new AbortController();
        const ctx = runnerCtx(() => { controller.abort(); return handleOf({}); });
        return api.runRipgrep(ctx, makeExec("glob", { signal: controller.signal }), "glob", ["--files"], 20_000_000, 3_000, 65_536);
      }],
      ["exit 2 pattern sai", (api) => api.runRipgrep(runnerCtx(() => handleOf({ exitCode: 2, stderr: "regex parse error: bad" })), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["exit 2 khac", (api) => api.runRipgrep(runnerCtx(() => handleOf({ exitCode: 2, stderr: "boom" })), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["bi signal", (api) => api.runRipgrep(runnerCtx(() => handleOf({ exitCode: null, signal: "SIGTERM" })), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["stdout lossy", (api) => api.runRipgrep(runnerCtx(() => handleOf({ stdout: "abc", lossy: true })), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
      ["stdout qua tran", (api) => api.runRipgrep(runnerCtx(() => handleOf({ stdout: "abcd" })), makeExec("glob"), "glob", ["--files"], 3, 3_000, 65_536)],
      ["thieu collected", (api) => api.runRipgrep(runnerCtx(() => ({ done: Promise.resolve({ exitCode: 0, signal: null }), collected: {} })), makeExec("glob"), "glob", ["--files"], 20_000_000, 3_000, 65_536)],
    ];
    const ourResults: string[] = [];
    for (const [label, run] of cases) {
      const ourOutcome = await outcomeAsync(() => run(ours));
      expect([label, ourOutcome]).toEqual([label, await outcomeAsync(() => run(stock))]);
      ourResults.push(ourOutcome);
    }
    expect(ourResults[0]).toContain("SearchError|SEARCH_ABORTED|glob was aborted before completion");
    expect(ourResults[1]).toContain("SearchError|SEARCH_FAILED|glob could not start its search command (ripgrep launch failed)");
    expect(ourResults[2]).toContain("SearchError|SEARCH_FAILED|glob subprocess failed before reporting an outcome (ripgrep provider failure)");
    expect(ourResults[3]).toContain("SearchError|SEARCH_ABORTED|");
    expect(ourResults[4]).toContain("SearchError|SEARCH_INVALID_PATTERN|glob pattern rejected by ripgrep: regex parse error: bad");
    expect(ourResults[5]).toContain("SearchError|SEARCH_FAILED|glob search failed (exit 2): boom");
    expect(ourResults[6]).toContain("SearchError|SEARCH_FAILED|glob search command was killed by signal SIGTERM");
    expect(ourResults[7]).toContain("SEARCH_RAW_OUTPUT_OVERFLOW");
    expect(ourResults[8]).toContain("glob produced 4 bytes of raw output, over the 3-byte cap");
    expect(ourResults[9]).toContain("glob search command produced no collected output streams");
  });
});

describe("vòng post-execute: spill kết quả đầy đủ", () => {
  test("trong trần ⇒ giữ decision; glob quá trần ⇒ spill + text recovery; grep quá trần ⇒ header + footer", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    const globExec = makeExec("glob");
    const grepExec = makeExec("grep");
    const within = await hookDecision(a, globExec, { isError: false, value: { root: ".", paths: ["a.ts"] }, meta: {} });
    const withinB = await hookDecision(b, globExec, { isError: false, value: { root: ".", paths: ["a.ts"] }, meta: {} });
    expect(JSON.stringify(within)).toBe(JSON.stringify(withinB));
    expect(within).toEqual({ kind: "accept" });
    const globPaths = Array.from({ length: 101 }, (_, index) => "src/f" + String(index) + ".ts");
    const over = await hookDecision(a, globExec, { isError: false, value: { root: ".", paths: globPaths }, meta: {} });
    const overB = await hookDecision(b, globExec, { isError: false, value: { root: ".", paths: globPaths }, meta: {} });
    expect(JSON.stringify(over)).toBe(JSON.stringify(overB));
    expect(over.kind).toBe("accept");
    expect(decisionText(over)).toContain("Full sorted result stored at: gbh-spill://glob-results.txt");
    expect(a.rec.saves).toHaveLength(1);
    expect(String((a.rec.saves[0] as { content?: unknown }).content).split(EOL)).toHaveLength(101);
    const matches = Array.from({ length: 251 }, (_, index) => ({ path: "src/a.ts", lineNumber: index + 1, line: "L" + String(index) }));
    const overGrep = await hookDecision(a, grepExec, { isError: false, value: { matches }, meta: {} });
    const overGrepB = await hookDecision(b, grepExec, { isError: false, value: { matches }, meta: {} });
    expect(JSON.stringify(overGrep)).toBe(JSON.stringify(overGrepB));
    expect(decisionText(overGrep)).toContain("Found 250 of 251 matches");
    expect(decisionText(overGrep)).toContain("Full grep result stored at: gbh-spill://grep-results.txt");
    expect(a.rec.saves).toHaveLength(2);
    const noStore = await mount(ours, { withSpill: false });
    const noStoreB = await mount(stock, { withSpill: false });
    const unsaved = await hookDecision(noStore, globExec, { isError: false, value: { root: ".", paths: globPaths }, meta: {} });
    const unsavedB = await hookDecision(noStoreB, globExec, { isError: false, value: { root: ".", paths: globPaths }, meta: {} });
    expect(JSON.stringify(unsaved)).toBe(JSON.stringify(unsavedB));
    expect(decisionText(unsaved)).toContain("The complete result could not be saved");
    expect(noStore.rec.warns.length).toBe(1);
  });

  test("các nhánh defer của acceptedDirectCallValue: quyết định khác/content/value/parent/isError ⇒ giữ nguyên", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    const paths = Array.from({ length: 101 }, (_, index) => "src/f" + String(index) + ".ts");
    const result = { isError: false, value: { root: ".", paths }, meta: {} };
    const scenarios: [string, Exec, ToolResult, unknown][] = [
      ["decision khong accept", makeExec("glob"), result, { kind: "reject" }],
      ["decision co content", makeExec("glob"), result, { kind: "accept", content: [{ type: "text", text: "x" }] }],
      ["decision co value", makeExec("glob"), result, { kind: "accept", value: 1 }],
      ["co parent", makeExec("glob", { parent: { name: "agent" } }), result, { kind: "accept" }],
      ["isError", makeExec("glob"), { isError: true, value: { root: ".", paths }, meta: {} }, { kind: "accept" }],
    ];
    for (const [label, exec, toolResult, decision] of scenarios) {
      const ourDecision = await hookDecision(a, exec, toolResult, decision as Record<string, unknown>);
      const theirDecision = await hookDecision(b, exec, toolResult, decision as Record<string, unknown>);
      expect([label, JSON.stringify(ourDecision)]).toEqual([label, JSON.stringify(theirDecision)]);
      expect(ourDecision).toEqual(decision as Record<string, unknown>);
    }
    expect(a.rec.saves).toHaveLength(0);
  });
});
