/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho package @galaxy-blackhole/gbh-agent-instructions: chờ src/ + build.ts ổn định, build gói ta
 *      vào mkdtemp, symlink node_modules về apps/host rồi so sâu với bản gốc @deepseek-ai/dsh-agent-instructions
 *      trên CÙNG fixture — bề mặt export, Config, digest, render, files (host fs + fs seam giả), state/apply.
 *      KHÔNG gọi mạng; stock CHỈ ĐỌC.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "agent-instructions");
/** node_modules của kernel — đích symlink cho dep external của bundle build tạm. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(APP_MODULES, "@deepseek-ai", "dsh-agent-instructions", "lib", "index.js");
/** Ngân sách byte chuẩn của row (config thật trong 3 preset: maxBytes: 65536). */
const BUDGET = 65536;
/** Hạn chờ nguồn ổn định (ms). */
const WAIT_MS = 300_000;
/** Tên bề mặt công khai của stock — mọi ca export đều so đúng bảy tên này. */
const SURFACE = [
  "Config",
  "apply",
  "discoverBaselineInstructionFiles",
  "inject",
  "loadBaselineInstructions",
  "name",
  "renderAgentInstructions",
] as const;

/** Ngủ ms mili giây. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Tệp chỉ dẫn đã nạp — đủ trường cho render + dedup. */
interface InstructionFileLike {
  absolutePath: string;
  displayPath: string;
  content?: string;
  version?: unknown;
}

/** Kết quả render model-facing. */
interface RenderedLike {
  text: string;
  omitted: readonly { absolutePath: string; displayPath: string }[];
  truncated: readonly { displayPath: string; originalBytes: number; includedBytes: number }[];
}

/** Bề mặt plugin dùng trong test (bảy tên stock). */
interface PluginModule {
  readonly name: string;
  readonly inject: readonly string[];
  readonly Config: (input: unknown) => unknown;
  readonly apply: (ctx: unknown, config: unknown) => void;
  readonly discoverBaselineInstructionFiles: (
    options: Record<string, unknown>,
  ) => Promise<readonly { absolutePath: string; displayPath: string }[]>;
  readonly loadBaselineInstructions: (
    options: Record<string, unknown>,
    fileSystem?: unknown,
  ) => Promise<RenderedLike | undefined>;
  readonly renderAgentInstructions: (
    files: readonly InstructionFileLike[],
    options: { maxBytes: number; replacePreviousBaseline?: boolean },
  ) => RenderedLike;
}

/** Lỗi đã chuẩn hoá để so sâu giữa hai bản. */
interface FailureLike {
  name: string;
  message: string;
  code?: unknown;
  cause?: unknown;
}

/** Kết quả chạy một phép (giá trị hoặc lỗi) — dùng cho mọi ca "sai ⇒ lỗi". */
type Outcome<T> = { ok: true; value: T } | { ok: false; error: FailureLike };

/** Mô-đun build.ts của gói ta. */
interface BuildModule {
  buildPackage(outDir?: string): Promise<unknown>;
}

/** Tệp trong provider giả. */
interface MemoryFile {
  content: string;
  version: number;
  size?: number;
}

/** Kết quả chạy pre-step trên ctx giả. */
interface StepResult {
  decision: unknown;
  inbox: readonly unknown[];
}

/** Fixture thật trên đĩa (host fs). */
interface HostFixture {
  readonly project: string;
  readonly cwd: string;
  readonly dshHome: string;
  readonly agentsHome: string;
}

/** Thư mục tạm (dọn ở afterAll). */
let TEMP = "";
/** Fixture host fs dùng chung cho cả stock lẫn ours. */
let FIXTURE: HostFixture;
/** Bundle stock đã nạp động. */
let stock: PluginModule;
/** Bundle của ta đã build + nạp động. */
let ours: PluginModule;

/** Chữ ký nguồn: mọi tệp trong src/ + build.ts (tên, size, mtime). */
function sourceSignature(): string {
  const src = join(PKG, "src");
  const names = existsSync(src) ? readdirSync(src).filter((name) => name.endsWith(".ts")).sort() : [];
  return [join(PKG, "build.ts"), ...names.map((name) => join(src, name))]
    .map((file) => {
      try {
        const info = statSync(file);
        return `${file}:${info.size}:${info.mtimeMs}`;
      } catch {
        return `${file}:-1`;
      }
    })
    .join("|");
}

/** Chờ src/ + build.ts tồn tại và KHÔNG đổi qua hai lần đo cách 300ms (hạn: deadline). */
async function waitForSources(deadline: number): Promise<void> {
  let signature = sourceSignature();
  while (Date.now() < deadline) {
    await sleep(300);
    const next = sourceSignature();
    if (!next.includes(":-1") && next === signature) return;
    signature = next;
  }
  throw new Error("nguồn " + PKG + " không ổn định sau " + WAIT_MS + "ms (" + sourceSignature() + ")");
}

/** Chuẩn hoá cause của lỗi thành giá trị so sâu được. */
function errorCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return cause;
  const value = cause as Error & { code?: unknown };
  return {
    name: value.name,
    message: value.message,
    ...(value.code === undefined ? {} : { code: value.code }),
  };
}

/** Chạy phép đồng bộ/bất đồng bộ, bắt lỗi thành object chuẩn hoá để so A/B. */
async function capture<T>(run: () => T | Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const value = error as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
    return {
      ok: false,
      error: {
        name: String(value.name),
        message: String(value.message),
        ...(value.code === undefined ? {} : { code: value.code }),
        ...(value.cause === undefined ? {} : { cause: errorCause(value.cause) }),
      },
    };
  }
}

/** Ghi một tệp fixture, tự tạo thư mục cha. */
function writeFixture(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

/** Dựng fixture host fs: dự án có .git + AGENTS/CLAUDE/local lồng nhau, hai home chỉ dẫn. */
function makeHostFixture(root: string): HostFixture {
  const project = join(root, "project");
  mkdirSync(join(project, ".git"), { recursive: true });
  writeFixture(join(project, "AGENTS.md"), "# Root\n\nRoot rules.\n");
  writeFixture(join(project, "CLAUDE.md"), "# Claude\n\nClaude rules.\n");
  writeFixture(join(project, "AGENTS.local.md"), "Local overlay.\n");
  writeFixture(join(project, "sub", "AGENTS.md"), "Nested rules.\n");
  writeFixture(join(project, "sub", "deep", "CLAUDE.md"), "Deep claude rules.\n");
  const dshHome = join(root, "dsh-home");
  const agentsHome = join(root, "agents-home");
  writeFixture(join(dshHome, "AGENTS.md"), "Global harness instructions.\n");
  writeFixture(join(agentsHome, "AGENTS.md"), "Global agents instructions.\n");
  return { project, cwd: join(project, "sub", "deep"), dshHome, agentsHome };
}

/** Tuỳ chọn dò chuẩn trên fixture host fs. */
function hostOptions(): Record<string, unknown> {
  return {
    cwd: FIXTURE.cwd,
    dshHome: FIXTURE.dshHome,
    agentsHome: FIXTURE.agentsHome,
    projectRootMarkers: [".git"],
    instructionFileCandidates: ["AGENTS.md", "CLAUDE.md"],
    localInstructionFileCandidates: ["AGENTS.local.md", "CLAUDE.local.md"],
  };
}

/** Tuỳ chọn nạp chuẩn trên fixture host fs. */
function hostLoadOptions(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...hostOptions(), maxBytes: BUDGET, maxSourceBytes: 1048576, ...overrides };
}

/** Provider fs giả trong bộ nhớ — cùng một đối tượng được CẢ stock lẫn ours đọc. */
class MemoryFs {
  readonly files = new Map<string, MemoryFile>();
  readonly directories = new Set<string>();
  readonly statErrors = new Map<string, Error>();
  readonly resolveErrors = new Map<string, Error>();
  readonly readErrors = new Set<string>();

  /** Thêm tệp (kèm thư mục cha) với version tuỳ chọn. */
  addFile(absolutePath: string, content: string, version = 1): void {
    this.files.set(absolutePath, { content, version });
    this.directories.add(dirname(absolutePath));
  }

  /** Thêm thư mục (dùng cho marker .git). */
  addDirectory(absolutePath: string): void {
    this.directories.add(absolutePath);
  }

  /** Ép stat một đường dẫn ném lỗi. */
  failStat(absolutePath: string, error: Error): void {
    this.statErrors.set(absolutePath, error);
  }

  /** Ép resolve một đường dẫn ném lỗi. */
  failResolve(absolutePath: string, error: Error): void {
    this.resolveErrors.set(absolutePath, error);
  }

  /** Ép đọc nội dung một tệp ném lỗi. */
  failRead(absolutePath: string): void {
    this.readErrors.add(absolutePath);
  }

  /** Seam resolve: trả target bất biến mang đúng đường dẫn. */
  async resolve(path: string): Promise<{ key: string }> {
    const error = this.resolveErrors.get(path);
    if (error !== undefined) throw error;
    return { key: path };
  }

  /** Seam stat: tệp/thư mục/vắng mặt, tôn trọng lỗi đã cài. */
  async stat(target: { key: string }): Promise<{ type: string; version: number; size?: number } | undefined> {
    const error = this.statErrors.get(target.key);
    if (error !== undefined) throw error;
    const file = this.files.get(target.key);
    if (file !== undefined) {
      return {
        type: "file",
        version: file.version,
        size: file.size ?? Buffer.byteLength(file.content, "utf8"),
      };
    }
    if (this.directories.has(target.key)) return { type: "directory", version: 1 };
    return undefined;
  }

  /** Seam streamText: phát đúng một chunk hoặc ném lỗi đọc đã cài. */
  async *streamText(target: { key: string }): AsyncGenerator<string> {
    if (this.readErrors.has(target.key)) throw new Error("read failed: " + target.key);
    const file = this.files.get(target.key);
    if (file === undefined) throw Object.assign(new Error("FS_NOT_FOUND: " + target.key), { code: "FS_NOT_FOUND" });
    yield file.content;
  }
}

/** Lỗi có code kiểu errno để mô phỏng seam fs. */
function pathError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

/** Dựng provider giả cho vùng files/state. */
function makeMemoryProject(): MemoryFs {
  const fs = new MemoryFs();
  fs.addDirectory("/proj/.git");
  fs.addDirectory("/proj");
  fs.addDirectory("/proj/sub");
  fs.addDirectory("/proj/sub/deep");
  fs.addFile("/proj/AGENTS.md", "Root rules\n");
  fs.addFile("/proj/CLAUDE.md", "  Root rules\n\n");
  fs.addFile("/proj/AGENTS.local.md", "Root local overlay\n");
  fs.addFile("/proj/sub/AGENTS.md", "Nested rules\n");
  fs.addFile("/proj/sub/AGENTS.local.md", "Nested local overlay\n");
  fs.addFile("/proj/sub/deep/CLAUDE.md", "Deep rules\n");
  fs.addFile("/dsh/AGENTS.md", "Global harness instructions.\n");
  fs.addFile("/agents/AGENTS.md", "  Global harness instructions.\n\n");
  return fs;
}

/** Tuỳ chọn dò/nạp trên provider giả (home tường minh để hiển thị là $DSH_HOME/$DSH_AGENTS_HOME). */
function memoryOptions(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cwd: "/proj/sub/deep",
    dshHome: "/dsh",
    agentsHome: "/agents",
    projectRootMarkers: [".git"],
    instructionFileCandidates: ["AGENTS.md", "CLAUDE.md"],
    localInstructionFileCandidates: ["AGENTS.local.md", "CLAUDE.local.md"],
    maxBytes: BUDGET,
    maxSourceBytes: 1048576,
    ...overrides,
  };
}

/** Đăng ký plugin trên ctx giả; trả handlers/effects/warnings quan sát được. */
interface FakeMount {
  readonly ctx: Record<string, unknown>;
  readonly handlers: Map<string, ((...args: unknown[]) => unknown)[]>;
  readonly effects: string[];
  readonly warnings: readonly unknown[][];
}

/** Dựng ctx giả tối thiểu cho apply: effect/on/get/workingDirectory/sessionProjections/logger. */
function mount(module: PluginModule, fs: MemoryFs | undefined, cwd: string, config: { maxBytes: number } = { maxBytes: BUDGET }): FakeMount {
  const handlers = new Map<string, ((...args: unknown[]) => unknown)[]>();
  const effects: string[] = [];
  const warnings: unknown[][] = [];
  const ctx: Record<string, unknown> = {
    effect(factory: () => unknown, label: string): unknown {
      effects.push(label);
      return factory();
    },
    on(event: string, handler: (...args: unknown[]) => unknown): void {
      const list = handlers.get(event);
      if (list === undefined) handlers.set(event, [handler]);
      else list.push(handler);
    },
    get(name: string): unknown {
      return name === "fs" ? fs : undefined;
    },
    workingDirectory: { ensure: async (): Promise<string> => cwd },
    sessionProjections: {
      stateOf: (): unknown => ({ openTurnStartSeq: null, lastStepBoundary: undefined }),
    },
    logger: { warn: (...args: unknown[]): void => void warnings.push(args) },
  };
  if (fs !== undefined) Object.defineProperty(ctx, "fs", { enumerable: true, get: () => fs });
  module.apply(ctx, config);
  return { ctx, handlers, effects, warnings };
}

/** Agent giả: session rỗng + inbox next-step có prepend/replace/remove. */
interface FakeAgent {
  readonly agent: Record<string, unknown>;
  readonly messages: unknown[];
}

/** Dựng agent giả với inbox ghi nhận thao tác. */
function makeAgent(): FakeAgent {
  const messages: unknown[] = [];
  const agent: Record<string, unknown> = {
    session: { surface: { nodes: [] as number[] }, eventAt: (): unknown => undefined },
    inbox: {
      get nextStep(): readonly unknown[] {
        return messages.slice();
      },
      prepend: (_slot: string, message: unknown): void => void messages.unshift(message),
      replace: (id: string, message: unknown): void => {
        const index = messages.findIndex((item) => (item as { id?: string }).id === id);
        if (index >= 0) messages[index] = message;
      },
      remove: (id: string): void => {
        const index = messages.findIndex((item) => (item as { id?: string }).id === id);
        if (index >= 0) messages.splice(index, 1);
      },
    },
  };
  return { agent, messages };
}

/** Chạy handler agent/pre-step đã đăng ký, với decision "enter" rỗng. */
async function preStep(fake: FakeMount, agent: Record<string, unknown>, step: number, claimed: readonly unknown[]): Promise<StepResult> {
  const handler = fake.handlers.get("agent/pre-step")?.[0];
  if (handler === undefined) throw new Error("apply không đăng ký agent/pre-step");
  const signal = new AbortController().signal;
  const decision = { kind: "enter", messages: [] as unknown[] };
  const result = await handler({ agent, messages: claimed, step, signal }, async () => decision);
  return { decision: result, inbox: (agent.inbox as { nextStep: readonly unknown[] }).nextStep };
}

/** Bỏ id ngẫu nhiên do createUserMessage sinh; giữ role/content/source để so sâu. */
function normalizeMessage(message: unknown): unknown {
  const value = message as { role?: unknown; content?: unknown; source?: unknown };
  return { role: value.role, content: value.content, source: value.source };
}

/** Chuẩn hoá decision (giữ mọi trường khác, chỉ bỏ id trong messages). */
function normalizeDecision(decision: unknown): unknown {
  const value = decision as { messages?: readonly unknown[]; [key: string]: unknown };
  const { messages, ...rest } = value;
  return { ...rest, messages: (messages ?? []).map(normalizeMessage) };
}

/** Chuẩn hoá inbox. */
function normalizeInbox(messages: readonly unknown[]): unknown[] {
  return messages.map(normalizeMessage);
}

/** Lấy message baseline khỏi inbox rồi gỡ nó (mô phỏng agent claim next-step). */
function claim(agent: FakeAgent): unknown {
  const message = (agent.agent.inbox as { nextStep: readonly unknown[] }).nextStep[0];
  (agent.agent.inbox as { remove(id: string): void }).remove((message as { id: string }).id);
  return message;
}

/** Một bước apply đầy đủ trên fixture mới: mount → pre-step(step 1) → decision + inbox. */
async function applyOnce(module: PluginModule, fs: MemoryFs | undefined, cwd: string): Promise<StepResult> {
  const fake = mount(module, fs, cwd);
  const agent = makeAgent();
  return preStep(fake, agent.agent, 1, []);
}

/** Chạy trọn chuỗi state: baseline → không đổi → sửa → xoá, trên provider RIÊNG cho từng bản. */
async function applySequence(module: PluginModule): Promise<Record<string, unknown>> {
  const fs = makeMemoryProject();
  const fake = mount(module, fs, "/proj/sub");
  const agent = makeAgent();
  const first = await preStep(fake, agent.agent, 1, []);
  const baseline = claim(agent);
  const second = await preStep(fake, agent.agent, 2, [baseline]);
  fs.addFile("/proj/sub/AGENTS.md", "Nested rules changed\n", 2);
  const third = await preStep(fake, agent.agent, 3, [baseline]);
  const changed = (third.decision as { messages: readonly unknown[] }).messages[0];
  fs.files.delete("/proj/sub/AGENTS.md");
  const fourth = await preStep(fake, agent.agent, 4, [baseline, changed]);
  return {
    baseline: { decision: normalizeDecision(first.decision), inbox: normalizeInbox(first.inbox) },
    unchanged: { decision: normalizeDecision(second.decision), inbox: normalizeInbox(second.inbox) },
    changed: { decision: normalizeDecision(third.decision), inbox: normalizeInbox(third.inbox) },
    removed: { decision: normalizeDecision(fourth.decision), inbox: normalizeInbox(fourth.inbox) },
  };
}

/** SHA-1 thập lục phân của nội dung UTF-8 — kỳ vọng cho digest trong state. */
function sha1(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

beforeAll(async () => {
  TEMP = mkdtempSync(join(tmpdir(), "gbh-agent-instructions-"));
  FIXTURE = makeHostFixture(TEMP);
  const deadline = Date.now() + WAIT_MS;
  await waitForSources(deadline);
  const build = (await import(pathToFileURL(join(PKG, "build.ts")).href)) as BuildModule;
  let output: unknown;
  for (;;) {
    try {
      output = await build.buildPackage(join(TEMP, "lib"));
      break;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await sleep(500);
    }
  }
  const entry =
    typeof output === "string"
      ? output
      : (output as { service?: string } | undefined)?.service;
  if (entry === undefined) throw new Error("buildPackage không trả đường dẫn lib/index.js: " + String(output));
  symlinkSync(APP_MODULES, join(TEMP, "node_modules"), "dir");
  stock = (await import(pathToFileURL(STOCK).href)) as unknown as PluginModule;
  ours = (await import(pathToFileURL(entry).href)) as unknown as PluginModule;
});

afterAll(() => {
  if (TEMP !== "") rmSync(TEMP, { recursive: true, force: true });
});

describe("bề mặt xuất", () => {
  test("bảy tên stock có mặt với cùng kiểu; name/inject khớp từng byte", () => {
    const kinds = (module: PluginModule): Record<string, string> =>
      Object.fromEntries(SURFACE.map((name) => [name, typeof module[name]]));
    expect(kinds(ours)).toEqual(kinds(stock));
    expect({ name: ours.name, inject: ours.inject }).toEqual({ name: stock.name, inject: stock.inject });
    expect(stock.name).toBe("agent-instructions");
    expect(stock.inject).toEqual(["sessionProjections", "workingDirectory"]);
    expect(typeof ours.apply).toBe("function");
    expect(typeof ours.Config).toBe("function");
    expect(typeof ours.discoverBaselineInstructionFiles).toBe("function");
    expect(typeof ours.loadBaselineInstructions).toBe("function");
    expect(typeof ours.renderAgentInstructions).toBe("function");
  });
});

describe("config", () => {
  test("maxBytes 65536 chuẩn hoá y hệt stock (mặc định projectRootMarkers/candidates)", () => {
    const actual = ours.Config({ maxBytes: BUDGET });
    expect(actual).toEqual(stock.Config({ maxBytes: BUDGET }));
    expect(actual).toEqual({
      projectRootMarkers: [".git"],
      maxBytes: BUDGET,
      maxSourceBytes: 1048576,
      instructionFileCandidates: ["AGENTS.md", "CLAUDE.md"],
      localInstructionFileCandidates: ["AGENTS.local.md", "CLAUDE.local.md"],
    });
  });

  test("maxBytes thiếu/sai kiểu, maxSourceBytes dưới 1 ⇒ cùng lỗi ValidationError", async () => {
    const inputs: unknown[] = [
      {},
      { maxBytes: "x" },
      { maxBytes: Number.NaN },
      { maxBytes: BUDGET, maxSourceBytes: 0 },
      { maxBytes: BUDGET, projectRootMarkers: "x" },
    ];
    for (const input of inputs) {
      const expected = await capture(() => stock.Config(input));
      const actual = await capture(() => ours.Config(input));
      expect(actual).toEqual(expected);
    }
    expect((await capture(() => stock.Config({}))).ok).toBe(false);
    expect((await capture(() => stock.Config({ maxBytes: "x" }))).ok).toBe(false);
  });

  test("Config giữ nguyên ứng viên (bộ lọc chạy ở bước dò, không phải schema)", async () => {
    const input = {
      maxBytes: BUDGET,
      instructionFileCandidates: ["AGENTS.md", "nested/AGENTS.md", "..", ".", "", "CLAUDE.md"],
      localInstructionFileCandidates: ["AGENTS.local.md", "nested\\LOCAL.md", ".."],
    };
    const expected = await capture(() => stock.Config(input));
    const actual = await capture(() => ours.Config(input));
    expect(actual).toEqual(expected);
    expect(actual.ok).toBe(true);
    if (!actual.ok) return;
    expect(actual.value).toMatchObject({
      instructionFileCandidates: input.instructionFileCandidates,
      localInstructionFileCandidates: input.localInstructionFileCandidates,
    });
  });
});

describe("render", () => {
  test("hai tệp lồng nhau ⇒ cùng text, intro và thứ tự section", () => {
    const files: InstructionFileLike[] = [
      { absolutePath: "/p/AGENTS.md", displayPath: "AGENTS.md", content: "Root rules.\n" },
      { absolutePath: "/p/sub/AGENTS.md", displayPath: "sub/AGENTS.md", content: "Nested rules.\n" },
    ];
    const expected = stock.renderAgentInstructions(files, { maxBytes: BUDGET });
    const actual = ours.renderAgentInstructions(files, { maxBytes: BUDGET });
    expect(actual).toEqual(expected);
    expect(actual.text).toContain("<system-reminder>");
    expect(actual.text).toContain("Instructions from: AGENTS.md");
    expect(actual.text).toContain("Instructions from: sub/AGENTS.md");
    expect(actual.text.indexOf("AGENTS.md")).toBeLessThan(actual.text.indexOf("sub/AGENTS.md"));
    expect(actual.omitted).toEqual([]);
    expect(actual.truncated).toEqual([]);
  });

  test("rỗng + baseline thay thế: intro khác nhau nhưng y hệt stock", () => {
    const files: InstructionFileLike[] = [
      { absolutePath: "/p/AGENTS.md", displayPath: "AGENTS.md", content: "Only rules.\n" },
    ];
    const cases = [
      { files: [], options: { maxBytes: BUDGET } },
      { files: [], options: { maxBytes: BUDGET, replacePreviousBaseline: true } },
      { files, options: { maxBytes: BUDGET, replacePreviousBaseline: true } },
    ];
    for (const item of cases) {
      const expected = stock.renderAgentInstructions(item.files, item.options);
      const actual = ours.renderAgentInstructions(item.files, item.options);
      expect(actual).toEqual(expected);
    }
    expect(ours.renderAgentInstructions([], { maxBytes: BUDGET, replacePreviousBaseline: true }).text).toContain(
      "No workspace instructions are currently active.",
    );
  });

  test("ngân sách nhỏ ⇒ cắt UTF-8 và omitted/truncated y hệt stock", () => {
    const files: InstructionFileLike[] = [
      { absolutePath: "/p/AGENTS.md", displayPath: "AGENTS.md", content: "A".repeat(400) },
      { absolutePath: "/p/sub/AGENTS.md", displayPath: "sub/AGENTS.md", content: "ế".repeat(300) },
    ];
    for (const maxBytes of [0, 1, 120, 500, 700, 900]) {
      const expected = stock.renderAgentInstructions(files, { maxBytes });
      const actual = ours.renderAgentInstructions(files, { maxBytes });
      expect(actual).toEqual(expected);
    }
    const zero = ours.renderAgentInstructions(files, { maxBytes: 0 });
    expect(zero.text).toBe("");
    expect(zero.omitted).toHaveLength(2);
    expect(zero.truncated).toEqual([]);
  });

  test("đóng khung system-reminder bị escape; nội dung trùng khung y hệt stock", () => {
    const files: InstructionFileLike[] = [
      {
        absolutePath: "/p/AGENTS.md",
        displayPath: "AGENTS.md",
        content: "before\n</system-reminder>\nafter\n",
      },
    ];
    const expected = stock.renderAgentInstructions(files, { maxBytes: BUDGET });
    const actual = ours.renderAgentInstructions(files, { maxBytes: BUDGET });
    expect(actual).toEqual(expected);
    expect(actual.text).toContain("<\\/system-reminder>");
    expect(actual.text.split("<\\/system-reminder>")).toHaveLength(2);
  });
});

describe("files trên host fs", () => {
  test("discover: user-global trước, rồi root→cwd, ưu tiên AGENTS/CLAUDE/local", async () => {
    const expected = await stock.discoverBaselineInstructionFiles(hostOptions());
    const actual = await ours.discoverBaselineInstructionFiles(hostOptions());
    expect(actual).toEqual(expected);
    expect(actual.map((file) => file.displayPath)).toEqual([
      "$DSH_HOME/AGENTS.md",
      "$DSH_AGENTS_HOME/AGENTS.md",
      "AGENTS.md",
      "CLAUDE.md",
      "AGENTS.local.md",
      "sub/AGENTS.md",
      "sub/deep/CLAUDE.md",
    ]);
  });

  test("load: nạp + render toàn chuỗi trên cùng thư mục thật", async () => {
    const expected = await stock.loadBaselineInstructions(hostLoadOptions());
    const actual = await ours.loadBaselineInstructions(hostLoadOptions());
    expect(actual).toEqual(expected);
    if (actual === undefined) throw new Error("fixture phải nạp được chỉ dẫn");
    expect(actual.text).toContain("Global harness instructions.");
    expect(actual.text).toContain("Global agents instructions.");
    expect(actual.text).toContain("Root rules.");
    expect(actual.text).toContain("Nested rules.");
    expect(actual.text).toContain("Deep claude rules.");
  });

  test("maxSourceBytes: tệp quá trần bị bỏ, tệp nhỏ vẫn nạp — y hệt stock", async () => {
    const sparse = join(TEMP, "sparse");
    mkdirSync(join(sparse, ".git"), { recursive: true });
    writeFixture(join(sparse, "AGENTS.md"), "ok\n");
    writeFixture(join(sparse, "CLAUDE.md"), "C".repeat(100));
    const options = {
      cwd: sparse,
      dshHome: join(TEMP, "dsh-empty"),
      agentsHome: join(TEMP, "agents-empty"),
      projectRootMarkers: [".git"],
      maxBytes: BUDGET,
      maxSourceBytes: 10,
    };
    const expected = await stock.loadBaselineInstructions(options);
    const actual = await ours.loadBaselineInstructions(options);
    expect(actual).toEqual(expected);
    expect(actual?.text).toContain("ok");
    expect(actual?.text).not.toContain("CCCC");
  });

  test("thư mục không có chỉ dẫn ⇒ cùng undefined", async () => {
    const empty = join(TEMP, "empty");
    mkdirSync(empty, { recursive: true });
    const options = {
      cwd: empty,
      dshHome: join(TEMP, "dsh-empty"),
      agentsHome: join(TEMP, "agents-empty"),
      maxBytes: BUDGET,
      maxSourceBytes: 1048576,
    };
    const expected = await stock.loadBaselineInstructions(options);
    const actual = await ours.loadBaselineInstructions(options);
    expect(actual).toEqual(expected);
    expect(actual).toBeUndefined();
  });

  test("home chỉ dẫn hiển thị $DSH_HOME/$DSH_AGENTS_HOME và cùng thứ tự", async () => {
    const options = hostLoadOptions({ cwd: FIXTURE.project });
    const expected = await stock.loadBaselineInstructions(options);
    const actual = await ours.loadBaselineInstructions(options);
    expect(actual).toEqual(expected);
    expect(actual?.text).toContain("Instructions from: $DSH_HOME/AGENTS.md");
    expect(actual?.text).toContain("Instructions from: $DSH_AGENTS_HOME/AGENTS.md");
  });
});

describe("files qua fs seam giả", () => {
  test("load trên provider giả: cùng danh sách hiệu lực, cùng render", async () => {
    const fs = makeMemoryProject();
    fs.addFile("/agents/AGENTS.md", "Distinct global agents instructions.\n");
    const expected = await stock.loadBaselineInstructions(memoryOptions(), fs);
    const actual = await ours.loadBaselineInstructions(memoryOptions(), fs);
    expect(actual).toEqual(expected);
    if (actual === undefined) throw new Error("provider giả phải nạp được chỉ dẫn");
    expect(actual.text).toContain("$DSH_HOME/AGENTS.md");
    expect(actual.text).toContain("$DSH_AGENTS_HOME/AGENTS.md");
    expect(actual.text).toContain("Instructions from: sub/deep/CLAUDE.md");
  });

  test("dò bỏ ứng viên có dấu phân cách/đoạn dành riêng — y hệt stock", async () => {
    const options = {
      ...hostOptions(),
      instructionFileCandidates: ["AGENTS.md", "nested/AGENTS.md", "..", ".", "", "CLAUDE.md"],
      localInstructionFileCandidates: ["AGENTS.local.md", "nested\\LOCAL.md", ".."],
    };
    const expected = await stock.discoverBaselineInstructionFiles(options);
    const actual = await ours.discoverBaselineInstructionFiles(options);
    expect(actual).toEqual(expected);
    expect(actual.map((file) => file.displayPath)).toEqual([
      "$DSH_HOME/AGENTS.md",
      "$DSH_AGENTS_HOME/AGENTS.md",
      "AGENTS.md",
      "CLAUDE.md",
      "AGENTS.local.md",
      "sub/AGENTS.md",
      "sub/deep/CLAUDE.md",
    ]);
  });

  test("dedup theo nội dung trim: home/project trùng bị gộp, giữ ứng viên sớm", async () => {
    const fs = makeMemoryProject();
    const expected = await stock.loadBaselineInstructions(memoryOptions(), fs);
    const actual = await ours.loadBaselineInstructions(memoryOptions(), fs);
    expect(actual).toEqual(expected);
    if (actual === undefined) throw new Error("provider giả phải nạp được chỉ dẫn");
    expect(actual.text).toContain("$DSH_HOME/AGENTS.md");
    expect(actual.text).not.toContain("$DSH_AGENTS_HOME/AGENTS.md");
    expect(actual.text).toContain("Instructions from: AGENTS.md");
    expect(actual.text).not.toContain("Instructions from: CLAUDE.md");
  });

  test("stat lỗi/unavailable ⇒ bỏ qua tệp; resolve marker lỗi ⇒ cùng lỗi", async () => {
    const fs = makeMemoryProject();
    fs.failStat("/proj/sub/deep/CLAUDE.md", pathError("EACCES", "stat denied"));
    const expected = await stock.loadBaselineInstructions(memoryOptions(), fs);
    const actual = await ours.loadBaselineInstructions(memoryOptions(), fs);
    expect(actual).toEqual(expected);
    expect(actual?.text).not.toContain("Deep rules");

    const markerFs = makeMemoryProject();
    markerFs.failResolve("/proj/.git", pathError("EACCES", "marker unreadable"));
    const expectedError = await capture(() => stock.loadBaselineInstructions(memoryOptions(), markerFs));
    const actualError = await capture(() => ours.loadBaselineInstructions(memoryOptions(), markerFs));
    expect(actualError).toEqual(expectedError);
    expect(actualError.ok).toBe(false);
  });

  test("đọc tệp lỗi bị bỏ qua; signal đã abort ⇒ cùng AbortError", async () => {
    const fs = makeMemoryProject();
    fs.failRead("/proj/AGENTS.md");
    fs.failRead("/proj/CLAUDE.md");
    const expected = await stock.loadBaselineInstructions(memoryOptions(), fs);
    const actual = await ours.loadBaselineInstructions(memoryOptions(), fs);
    expect(actual).toEqual(expected);
    expect(actual?.text).not.toContain("Instructions from: AGENTS.md");

    const aborted = memoryOptions({ signal: AbortSignal.abort() });
    const expectedAbort = await capture(() => stock.loadBaselineInstructions(aborted, makeMemoryProject()));
    const actualAbort = await capture(() => ours.loadBaselineInstructions(aborted, makeMemoryProject()));
    expect(actualAbort).toEqual(expectedAbort);
    expect(actualAbort.ok).toBe(false);
  });
});

describe("apply + state", () => {
  test("apply đăng ký đúng effect + ba handler, không ném", () => {
    const expected = mount(stock, undefined, "/proj");
    const actual = mount(ours, undefined, "/proj");
    expect({
      effects: actual.effects,
      events: [...actual.handlers.keys()].sort(),
      counts: Object.fromEntries([...actual.handlers].map(([event, list]) => [event, list.length])),
    }).toEqual({
      effects: expected.effects,
      events: [...expected.handlers.keys()].sort(),
      counts: Object.fromEntries([...expected.handlers].map(([event, list]) => [event, list.length])),
    });
    expect(expected.effects).toEqual(["agent-instructions.projectionLifecycle"]);
    expect([...expected.handlers.keys()].sort()).toEqual(["agent/pre-step", "session/event", "tools/result"]);
  });

  test("baseline pre-step: cùng decision/inbox, digest SHA-1 và dedup trim", async () => {
    const expected = await applyOnce(stock, makeMemoryProject(), "/proj/sub");
    const actual = await applyOnce(ours, makeMemoryProject(), "/proj/sub");
    expect({ decision: normalizeDecision(actual.decision), inbox: normalizeInbox(actual.inbox) }).toEqual({
      decision: normalizeDecision(expected.decision),
      inbox: normalizeInbox(expected.inbox),
    });
    expect((expected.decision as { messages: unknown[] }).messages).toEqual([]);
    expect(expected.inbox).toHaveLength(1);
    const message = expected.inbox[0] as {
      content: { text: string }[];
      source: { baseline?: boolean; form?: string; changes: { action: string; path: string; digest: string }[] };
    };
    expect(message.source.baseline).toBe(true);
    expect(message.source.form).toBe("instructions");
    expect(message.source.changes.map((change) => [change.action, change.path])).toEqual([
      ["set", "AGENTS.md"],
      ["set", "AGENTS.local.md"],
      ["set", "sub/AGENTS.md"],
      ["set", "sub/AGENTS.local.md"],
    ]);
    expect(message.source.changes[0]?.digest).toBe(sha1("Root rules\n"));
    expect(message.source.changes[1]?.digest).toBe(sha1("Root local overlay\n"));
    expect(message.source.changes[2]?.digest).toBe(sha1("Nested rules\n"));
    expect(message.content[0]?.text).not.toContain("CLAUDE.md");
    expect(message.content[0]?.text).not.toContain("$DSH_HOME");
  });

  test("state: không đổi ⇒ không message; sửa ⇒ replace; xoá ⇒ remove — y hệt stock", async () => {
    const expected = await applySequence(stock);
    const actual = await applySequence(ours);
    expect(actual).toEqual(expected);
    const baseline = (expected.baseline as { inbox: unknown[] }).inbox[0];
    if (baseline === undefined) throw new Error("baseline phải vào inbox");
    expect((expected.unchanged as { decision: { messages: unknown[] } }).decision.messages).toEqual([]);
    expect((expected.unchanged as { inbox: unknown[] }).inbox).toEqual([]);
    const changed = (expected.changed as { decision: { messages: { source: { changes: { action: string; scope: string; path: string; digest: string }[] }; content: { text: string }[] }[] } }).decision.messages[0];
    if (changed === undefined) throw new Error("sửa tệp phải sinh message replace");
    expect(changed.source.changes).toEqual([
      { action: "replace", scope: "sub\u0000AGENTS.md", path: "sub/AGENTS.md", digest: sha1("Nested rules changed\n") },
    ]);
    expect(changed.content[0]?.text).toContain("Updated instructions from: sub/AGENTS.md");
    const removed = (expected.removed as { decision: { messages: { source: { changes: { action: string; scope: string; path: string }[] }; content: { text: string }[] }[] } }).decision.messages[0];
    if (removed === undefined) throw new Error("xoá tệp phải sinh message remove");
    expect(removed.source.changes).toEqual([
      { action: "remove", scope: "sub\u0000AGENTS.md", path: "sub/AGENTS.md" },
    ]);
    expect(removed.content[0]?.text).toContain("Instructions removed: sub/AGENTS.md");
  });

  test("ctx không có fs ⇒ no-op; maxBytes 0 ⇒ tắt nạp — cùng decision/inbox", async () => {
    const expectedNoFs = await applyOnce(stock, undefined, "/proj/sub");
    const actualNoFs = await applyOnce(ours, undefined, "/proj/sub");
    expect({ decision: normalizeDecision(actualNoFs.decision), inbox: normalizeInbox(actualNoFs.inbox) }).toEqual({
      decision: normalizeDecision(expectedNoFs.decision),
      inbox: normalizeInbox(expectedNoFs.inbox),
    });
    expect(actualNoFs.inbox).toEqual([]);

    const runZero = async (module: PluginModule): Promise<StepResult> => {
      const fs = makeMemoryProject();
      const fake = mount(module, fs, "/proj/sub", { maxBytes: 0 });
      const agent = makeAgent();
      return preStep(fake, agent.agent, 1, []);
    };
    const expectedZero = await runZero(stock);
    const actualZero = await runZero(ours);
    expect({ decision: normalizeDecision(actualZero.decision), inbox: normalizeInbox(actualZero.inbox) }).toEqual({
      decision: normalizeDecision(expectedZero.decision),
      inbox: normalizeInbox(expectedZero.inbox),
    });
    expect(actualZero.inbox).toEqual([]);
  });
});
