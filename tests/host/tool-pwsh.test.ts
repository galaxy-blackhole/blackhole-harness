/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 05/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-pwsh: A = bundle gốc lib/index.js của
 *      @deepseek-ai/dsh-tool-pwsh 0.2.1-alpha.4, B = lib/index.js của ta (Bun.build từ src/).
 *      Mỗi ca dựng HAI giàn giống hệt nhau trên seam GIẢ 100% (shell · jobs · sandbox-policy ·
 *      approval — không spawn tiến trình, không chạm đĩa), rồi so tập export, Config, định nghĩa
 *      tool, mọi kết cục thi hành, mọi chuỗi lỗi, locale và provenance.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

import { buildPackage } from "../../packages/host/tool-pwsh/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "tool-pwsh");
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-pwsh");
/** Bundle GỐC (A). */
const STOCK_FILE = join(STOCK_PKG, "lib", "index.js");
/** Artefact của ta (B). */
const OURS_FILE = join(PKG, "lib", "index.js");

/** Thư mục tạm cần dọn (chỉ có khi lib chưa tồn tại). */
let tempDir: string | undefined;
/** Đường dẫn artefact của ta đang dùng. */
let oursFile = OURS_FILE;

/** Bề mặt module mà test chạm tới (A và B cùng hình dạng). */
interface Surface {
  /** Tên plugin. */
  readonly name: string;
  /** Dịch vụ plugin yêu cầu. */
  readonly inject: readonly string[];
  /** Lược đồ cấu hình (callable + String()). */
  readonly Config: ((value?: unknown) => Record<string, unknown>) & { toString(): string };
  /** Cài plugin lên context. */
  apply(ctx: unknown, config?: unknown): void;
}

/** Định nghĩa tool đã đăng ký (chỉ trường test đọc). */
interface ToolLike {
  /** Tên tool hướng model. */
  readonly name: string;
  /** Mô tả hướng model. */
  readonly description: string;
  /** Lược đồ tham số đã biên dịch. */
  readonly parameters: Record<string, unknown>;
  /** Lược đồ đầu ra + hàm render. */
  readonly output: {
    readonly schema: unknown;
    render(args: unknown, value: unknown): { type: string; text: string }[];
  };
  /** Gọi tool. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Thẻ hiển thị lời gọi. */
  presentCall?(args: unknown): unknown;
  /** Thẻ hiển thị kết quả. */
  presentResult?(args: unknown, result: unknown): unknown;
}

/** Kết quả một lần chạy tiền cảnh trên seam giả. */
interface ResultLike {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  aborted: boolean;
  timeoutMs: number;
  stdout: { text: string; truncated: boolean; spillPath?: string };
  stderr: { text: string; truncated: boolean; spillPath?: string };
  sandbox?: { mode: string; denied: boolean; enforcement?: string; runnerFailed?: boolean };
}

/** Hình chiếu job mà seam giả trả cho wait(). */
interface ViewLike {
  status: string;
  detail?: string;
  output?: { spillPaths?: string[] };
}

/** Một mẩu ring mà seam giả trả cho read(). */
interface ChunkLike {
  channel: "stdout" | "stderr";
  text: string;
  at: number;
}

/** Hook mà starter của job trả. */
interface JobHooksLike {
  done: Promise<{ status: string; detail: string }>;
  cancel(reason: string): void;
}

/** Đặc tả job mà seam giả nhận. */
interface JobSpecLike {
  kind: string;
  label: string;
  toolCall: { callId: string; rootCallId: string };
  owner?: string;
  output: { channel: string; read(fromByte: number): { text: string; nextOffset: number; lossy: boolean } }[];
  run(): JobHooksLike;
}

/** Đầu đọc luồng giả. */
interface ReaderLike {
  text: string;
}

/** Tuỳ chọn dựng giàn đo. */
interface RigOptions {
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
  jobs?: boolean;
  startThrows?: boolean;
  executePending?: boolean;
  views?: ViewLike[];
  chunks?: ChunkLike[];
  lossy?: boolean;
  spillPaths?: string[];
  result?: Partial<ResultLike>;
  observed?: { stdout?: string; stderr?: string };
  fiberState?: number;
  approval?: { request(request: unknown): Promise<string> };
  policyMode?: "read-only" | "workspace-write" | "danger-full-access";
  dshEnv?: Record<string, string>;
}

/** Giàn đo của MỘT bên cài. */
interface Rig {
  ctx: Record<string, unknown>;
  tools: ToolLike[];
  sections: { name: string; order: number; text: string }[];
  warns: string[];
  shellResolves: Record<string, unknown>[];
  shellExecutes: Record<string, unknown>[];
  jobSpecs: JobSpecLike[];
  registryCalls: unknown[][];
  hooks: JobHooksLike[];
  injections: string[][];
  effects: (() => void)[];
  unregisters: number;
  handleKills: number;
  pendingResolvers: (() => void)[];
  approvalRequests: unknown[];
}

/** Bản gốc nạp động (A). */
const stock = (await import(STOCK_FILE)) as unknown as Surface;
/** Bản của ta (B) — nạp sau beforeAll. */
let ours: Surface;

/** Nạp artefact B: ưu tiên lib đã build, chưa có thì build vào thư mục tạm TRONG gói. */
beforeAll(async () => {
  if (!existsSync(OURS_FILE)) {
    tempDir = mkdtempSync(join(PKG, ".tmp-build-"));
    oursFile = await buildPackage(tempDir);
  }
  ours = (await import(oursFile)) as unknown as Surface;
});

/** Dọn thư mục tạm. */
afterAll(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Dựng giàn đo cho MỘT bên cài: seam shell/jobs/sandbox-policy/approval GIẢ điều khiển được.
 * Nhận: options — kịch bản phản hồi và bố cục service.
 * Trả: giàn đo ghi vết mọi lời gọi.
 */
function makeRig(options: RigOptions = {}): Rig {
  const rig: Rig = {
    ctx: {},
    tools: [],
    sections: [],
    warns: [],
    shellResolves: [],
    shellExecutes: [],
    jobSpecs: [],
    registryCalls: [],
    hooks: [],
    injections: [],
    effects: [],
    unregisters: 0,
    handleKills: 0,
    pendingResolvers: [],
    approvalRequests: [],
  };
  let jobCounter = 0;
  let viewIndex = 0;
  const result = (timeoutMs: number): ResultLike => ({
    exitCode: options.result?.exitCode ?? 0,
    signal: options.result?.signal ?? null,
    timedOut: options.result?.timedOut ?? false,
    aborted: options.result?.aborted ?? false,
    timeoutMs: options.result?.timeoutMs ?? timeoutMs,
    stdout: options.result?.stdout ?? { text: "", truncated: false },
    stderr: options.result?.stderr ?? { text: "", truncated: false },
    ...options.result?.sandbox !== undefined ? { sandbox: options.result.sandbox } : {},
  });
  const reader = (text: string): ReaderLike & { readFrom(from: number): { text: string; nextOffset: number; lossy: boolean } } => ({
    text,
    readFrom: (from: number) => ({ text: text.slice(from), nextOffset: text.length, lossy: false }),
  });
  const registry = {
    start(spec: JobSpecLike): string {
      rig.jobSpecs.push(spec);
      rig.registryCalls.push(["start", spec.kind, spec.label, spec.toolCall.callId, spec.toolCall.rootCallId, spec.owner ?? null]);
      if (options.startThrows === true) throw new Error("registration refused");
      const hooks = spec.run();
      rig.hooks.push(hooks);
      jobCounter += 1;
      return "pwsh-" + String(jobCounter);
    },
    kill(id: string, caller?: string, reason?: string): string {
      rig.registryCalls.push(["kill", id, caller ?? null, reason ?? null]);
      rig.hooks[rig.hooks.length - 1]?.cancel(reason ?? "");
      return "requested";
    },
    async wait(id: string, timeoutMs: number, caller?: string, signal?: AbortSignal): Promise<ViewLike> {
      rig.registryCalls.push(["wait", id, timeoutMs, caller ?? null, signal !== undefined]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const views = options.views ?? [{ status: "completed", detail: "exit code: 0" }];
      const view = views[Math.min(viewIndex, views.length - 1)] as ViewLike;
      viewIndex += 1;
      return view;
    },
    read(id: string, caller?: string): { chunks: ChunkLike[]; lossy: boolean; job: ViewLike } {
      rig.registryCalls.push(["read", id, caller ?? null]);
      return {
        chunks: options.chunks ?? [],
        lossy: options.lossy ?? false,
        job: { status: "running", output: { spillPaths: options.spillPaths ?? [] } },
      };
    },
    remove(id: string, caller?: string): void {
      rig.registryCalls.push(["remove", id, caller ?? null]);
    },
  };
  const policy = {
    resolve: (subject: { session?: unknown }) => {
      rig.registryCalls.push(["policy", subject.session === undefined ? "none" : "session"]);
      return { mode: options.policyMode ?? "read-only" };
    },
  };
  const approver = options.approval === undefined
    ? undefined
    : {
      request: async (request: unknown) => {
        rig.approvalRequests.push(request);
        return options.approval?.request(request) ?? "unavailable";
      },
    };
  const shell = {
    sandboxMode: options.sandboxMode,
    resolve(request: Record<string, unknown>): Record<string, unknown> {
      rig.shellResolves.push(request);
      return {
        ...request,
        workdir: (request.workdir as string | undefined) ?? "/workspace",
        timeoutMs: (request.timeoutMs as number | undefined) ?? 120000,
        onExpiry: (request.onExpiry as string | undefined) ?? "kill",
      };
    },
    async execute(spec: Record<string, unknown>): Promise<Record<string, unknown>> {
      rig.shellExecutes.push(spec);
      const ready = result((spec.timeoutMs as number | undefined) ?? 120000);
      const handle = {
        status: ready.exitCode === null && ready.signal !== null ? "killed" : "completed",
        exitCode: ready.exitCode,
        signal: ready.signal,
        done: Promise.resolve(),
        ...ready.sandbox !== undefined ? { sandbox: ready.sandbox } : {},
        observed: {
          stdout: reader(options.observed?.stdout ?? ""),
          stderr: reader(options.observed?.stderr ?? ""),
        },
        kill(): boolean {
          rig.handleKills += 1;
          return true;
        },
        result: async () => ready,
      };
      if (options.executePending === true) {
        await new Promise<void>((resolve) => rig.pendingResolvers.push(resolve));
      }
      return handle;
    },
  };
  const ctx: Record<string, unknown> = {
    tools: {
      register(tool: ToolLike): () => void {
        rig.tools.push(tool);
        return () => { rig.unregisters += 1; };
      },
    },
    shell,
    systemPrompt: {
      section(section: { name: string; order: number; text: string }): void { rig.sections.push(section); },
      getSectionOrder: () => 35,
    },
    shellEnv: { collect: () => options.dshEnv ?? {} },
    workingDirectory: { ensure: async () => "/cwd" },
    logger: { warn: (message: string) => { rig.warns.push(message); } },
    fiber: { state: options.fiberState ?? 0 },
    get: (name: string) => {
      // 08/11/2026 (PHASE B): bundle của TA đọc sổ tool qua đường CẤU TRÚC `ctx.get("tools")` (ADR 000d),
      // còn bundle GỐC đọc `ctx.tools` trực tiếp ⇒ giả lập CẢ HAI đường trên CÙNG một sổ tool.
      if (name === "tools") return ctx.tools;
      if (name === "jobs") return options.jobs === false ? undefined : registry;
      if (name === "sandboxPolicy") return options.sandboxMode === undefined ? undefined : policy;
      if (name === "approval") return approver;
      return undefined;
    },
    inject: (deps: string[], callback: (jobCtx: Record<string, unknown>) => void) => {
      rig.injections.push([...deps]);
      if (options.jobs === false) return;
      callback({
        ...ctx,
        jobs: registry,
        effect: (register: () => () => void) => {
          rig.effects.push(register());
          return () => undefined;
        },
      });
    },
  };
  rig.ctx = ctx;
  return rig;
}

/**
 * Cấu hình đã qua schema của CHÍNH bên đó.
 * Nhận: plugin — lớp gói; raw — phần ghi đè thô.
 * Trả: cấu hình đã phân giải.
 */
function configOf(plugin: Surface, raw: Record<string, unknown> = {}): Record<string, unknown> {
  return plugin.Config(raw);
}

/**
 * Cài MỘT bên lên giàn của nó.
 * Nhận: plugin — lớp gói; rig — giàn; raw — phần ghi đè cấu hình thô.
 * Trả: không.
 */
function install(plugin: Surface, rig: Rig, raw: Record<string, unknown> = {}): void {
  plugin.apply(rig.ctx, configOf(plugin, raw));
}

/** Agent giả gọi tool. */
const AGENT = { id: "agent-1", session: { id: "session-1" } };

/**
 * Gọi tool của giàn, trả THÔ giá trị hoặc thông điệp lỗi.
 * Nhận: rig — giàn; args — tham số model; signal — tín hiệu của lời gọi.
 * Trả: { value } hoặc { error, errorName }.
 */
async function call(
  rig: Rig,
  args: Record<string, unknown>,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ value?: unknown; error?: string; errorName?: string }> {
  const tool = rig.tools[0];
  if (tool === undefined) throw new Error("apply không đăng ký tool nào");
  try {
    return { value: await tool.execute(args, { callId: "call-1", rootCallId: "call-root", agent: AGENT, signal }) };
  } catch (error) {
    return { error: (error as Error).message, errorName: (error as Error).name };
  }
}

/**
 * Tên export của một file ESM đã build.
 * Nhận: text — văn bản artifact.
 * Trả: danh sách tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Hình dạng package.json của gói ta mà test đọc. */
interface PkgJson {
  name: string;
  main?: string;
  exports?: Record<string, unknown>;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: {
    tests?: string[];
    peers?: string[];
    provenance?: { stock?: string; version?: string; sha?: string };
    row?: unknown;
    row_unmounted_ly_do?: { row?: { id?: string; disabled?: boolean; moduleIds?: string[]; aliases?: string[]; tests?: string[] } };
  };
}

/**
 * Đọc package.json của gói ta.
 * Nhận: không.
 * Trả: nội dung đã parse.
 */
function pkgJson(): PkgJson {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PkgJson;
}

/**
 * Băm SHA-256 một buffer.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("A. Bề mặt gói — export · Config · định nghĩa tool", () => {
  test("artefact export ĐÚNG bốn tên như bundle gốc + nạp đúng sáu import ngoài", () => {
    const built = readFileSync(oursFile, "utf8");
    const stockText = readFileSync(STOCK_FILE, "utf8");
    expect(exportNames(built)).toEqual(exportNames(stockText));
    expect(exportNames(built)).toEqual(["Config", "apply", "inject", "name"]);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    for (const specifier of [
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-tools",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-sandbox",
      "@deepseek-ai/dsh-shell",
      "node:path",
    ]) {
      expect(built.includes('from "' + specifier + '"')).toBe(true);
      expect(stockText.includes('from "' + specifier + '"')).toBe(true);
    }
  });

  test("name · inject · String(Config) · mặc định và mọi ghi đè TRÙNG bản gốc", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-pwsh");
    expect([...ours.inject]).toEqual([...stock.inject]);
    expect([...ours.inject]).toEqual(["tools", "shell", "systemPrompt", "shellEnv", "workingDirectory"]);
    expect(String(ours.Config)).toBe(String(stock.Config));
    expect(String(ours.Config)).toBe("{ enableRunInBackground?: boolean, promoteOnTimeout?: boolean }");
    const raws: Record<string, unknown>[] = [
      {},
      { enableRunInBackground: false },
      { promoteOnTimeout: false },
      { enableRunInBackground: false, promoteOnTimeout: false },
      { extra: 1 },
    ];
    for (const raw of raws) {
      expect(configOf(ours, raw)).toEqual(configOf(stock, raw));
      expect(Object.keys(configOf(ours, raw))).toEqual(Object.keys(configOf(stock, raw)));
    }
    expect(configOf(ours)).toEqual({ enableRunInBackground: true, promoteOnTimeout: true });
  });

  test("định nghĩa tool TRÙNG: tên · mô tả · tham số · schema đầu ra · presentCall (không sandbox)", () => {
    const traces = [ours, stock].map((plugin) => {
      const rig = makeRig();
      install(plugin, rig);
      const tool = rig.tools[0] as ToolLike;
      return {
        count: rig.tools.length,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        schema: tool.output.schema,
        present: tool.presentCall?.({ description: "liệt kê tệp", command: "Get-ChildItem" }),
        presentBackground: tool.presentCall?.({ description: "liệt kê tệp", command: "Get-ChildItem", run_in_background: true }),
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.count).toBe(1);
    expect(traces[0]?.name).toBe("pwsh");
    expect(traces[0]?.description.length).toBe(1083);
    expect(traces[0]?.description.includes("Execute a PowerShell command (`pwsh -Command`)")).toBe(true);
    expect(traces[0]?.present).toEqual({ card: "terminal", title: "Get-ChildItem", description: "liệt kê tệp" });
    expect(traces[0]?.presentBackground).toEqual({
      card: "generic",
      title: "Get-ChildItem",
      kind: "execute",
      rawInput: "Get-ChildItem",
      content: [{ type: "text", text: "liệt kê tệp" }],
    });
  });

  test("bố cục CÓ sandbox: mô tả dài + enum escalate + thứ tự tham số TRÙNG bản gốc", () => {
    const traces = [ours, stock].map((plugin) => {
      const rig = makeRig({ sandboxMode: "read-only", policyMode: "read-only" });
      install(plugin, rig);
      const tool = rig.tools[0] as ToolLike;
      return {
        description: tool.description,
        parameters: tool.parameters,
        keys: Object.keys(tool.parameters),
        properties: Object.keys((tool.parameters.properties ?? {}) as object),
        sandboxEnum: ((tool.parameters.properties ?? {}) as Record<string, { enum?: string[] }>).sandbox_permissions?.enum,
        sections: rig.sections,
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.description.length).toBe(2007);
    expect(traces[0]?.sandboxEnum).toEqual(["workspace-write", "danger-full-access"]);
    expect(traces[0]?.properties).toEqual([
      "description",
      "command",
      "timeoutMs",
      "workdir",
      "run_in_background",
      "sandbox_permissions",
      "justification",
    ]);
    expect(traces[0]?.sections).toEqual([{
      name: "tool:pwsh",
      order: 35,
      text: "Non-zero exits are reported as `[exit code: N]` markers; investigate failures before moving on. On Windows a killed process settles as `[exit code: 1]` without a signal marker; treat a bare exit 1 after an interruption as a termination, not a command failure.",
    }]);
  });

  test("apply THIẾU ctx.sandboxPolicy khi executor giam ⇒ CÙNG câu lỗi, không đăng ký tool", () => {
    const messages: string[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ sandboxMode: "read-only" });
      rig.ctx = { ...rig.ctx, get: (name: string) => (name === "jobs" ? undefined : undefined) };
      try {
        install(plugin, rig);
        messages.push("KHONG NEM");
      } catch (error) {
        messages.push((error as Error).message);
      }
      expect(rig.tools.length).toBe(0);
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toBe("tool-pwsh: the mounted bash executor confines but ctx.sandboxPolicy is missing");
  });
});

describe("B. Kiểm tham số — mọi chuỗi lỗi NGUYÊN VĂN", () => {
  test("command/description/timeoutMs/escalation: CÙNG thông điệp, KHÔNG chạm shell", async () => {
    const cases: { args: Record<string, unknown>; expected: string }[] = [
      { args: { description: "d", command: "   " }, expected: "invalid command: expected a non-empty string" },
      { args: { description: "  ", command: "Get-Date" }, expected: "invalid description: expected a non-empty string" },
      { args: { description: "d", command: "x", timeoutMs: 0 }, expected: "invalid timeoutMs: expected a positive number, got 0" },
      { args: { description: "d", command: "x", timeoutMs: -2 }, expected: "invalid timeoutMs: expected a positive number, got -2" },
      { args: { description: "d", command: "x", sandbox_permissions: "danger-full-access" }, expected: "invalid escalation: sandbox_permissions requires a justification" },
      { args: { description: "d", command: "x", justification: "vì sao" }, expected: "invalid escalation: justification is only valid together with sandbox_permissions" },
      { args: { description: "d", command: "x", sandbox_permissions: "workspace-write", justification: "   " }, expected: "invalid justification: expected a non-empty sentence" },
    ];
    for (const entry of cases) {
      const messages: string[] = [];
      for (const plugin of [ours, stock]) {
        const rig = makeRig({ sandboxMode: "read-only", policyMode: "read-only" });
        install(plugin, rig);
        messages.push((await call(rig, entry.args)).error ?? "KHONG NEM");
        expect(rig.shellExecutes).toEqual([]);
        expect(rig.shellResolves).toEqual([]);
        expect(rig.jobSpecs).toEqual([]);
      }
      expect(messages[0]).toBe(messages[1]);
      expect(messages[0]).toBe(entry.expected);
    }
  });

  test("timeoutMs không hữu hạn ⇒ schema từ chối TRƯỚC execute, cùng thông điệp", async () => {
    const messages: string[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig();
      install(plugin, rig);
      messages.push((await call(rig, { description: "d", command: "x", timeoutMs: Number.POSITIVE_INFINITY })).error ?? "KHONG NEM");
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toContain("timeoutMs");
  });
});

describe("C. Thi hành — tiền cảnh (không jobs) đối chứng TỪNG KẾT CỤC", () => {
  test("thoát sạch + stderr + cắt/spill + timeout + tín hiệu + sandbox: canonical và render TRÙNG", async () => {
    const scenarios: Partial<ResultLike>[] = [
      {},
      { exitCode: 1, stdout: { text: "boom", truncated: false } },
      { stdout: { text: "out", truncated: false }, stderr: { text: "err", truncated: false } },
      { stdout: { text: "đã cắt", truncated: true, spillPath: "/tmp/spill.txt" }, stderr: { text: "e", truncated: true } },
      { timedOut: true, timeoutMs: 2500 },
      { signal: "SIGKILL", exitCode: null },
      { sandbox: { mode: "read-only", denied: true } },
      { sandbox: { mode: "workspace-write", denied: false, runnerFailed: true, enforcement: "partial" } },
      { sandbox: { mode: "workspace-write", denied: false, enforcement: "full" }, exitCode: 2 },
      { aborted: false, exitCode: 0, stdout: { text: "x", truncated: false }, stderr: { text: "", truncated: false } },
    ];
    for (const scenario of scenarios) {
      const traces: { value?: unknown; render?: unknown; requests: unknown[]; executes: unknown[] }[] = [];
      for (const plugin of [ours, stock]) {
        const rig = makeRig({ result: scenario });
        install(plugin, rig);
        const tool = rig.tools[0] as ToolLike;
        const args = { description: "chạy thử", command: "Get-Date", workdir: "sub" };
        const outcome = await call(rig, args);
        traces.push({
          value: outcome.value,
          render: tool.output.render(args, outcome.value),
          requests: rig.shellResolves,
          executes: rig.shellExecutes,
        });
      }
      expect(traces[0]).toEqual(traces[1]);
      expect(traces[0]?.executes[0]).toMatchObject({ workdir: "/cwd/sub", signal: expect.anything() });
    }
  });

  test("thư mục làm việc tuyệt đối giữ nguyên; agent vắng ⇒ cwd do executor quyết; DSH env đi nguyên vẹn", async () => {
    const traces: { absolute: unknown; noAgent: unknown; requests: unknown[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ dshEnv: { DSH_SESSION_ID: "s-1" } });
      install(plugin, rig);
      const tool = rig.tools[0] as ToolLike;
      const absolute = await tool.execute({ description: "d", command: "Get-Date", workdir: "/abs/dir" }, { callId: "c", rootCallId: "r", agent: AGENT, signal: new AbortController().signal });
      const noAgent = await tool.execute({ description: "d", command: "Get-Date" }, { callId: "c", rootCallId: "r", signal: new AbortController().signal });
      traces.push({ absolute, noAgent, requests: rig.shellResolves });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.requests[0]).toMatchObject({ workdir: "/abs/dir", dshEnv: { DSH_SESSION_ID: "s-1" } });
    expect(traces[0]?.requests[1]).toMatchObject({ dshEnv: { DSH_SESSION_ID: "s-1" } });
    expect((traces[0]?.requests[1] as Record<string, unknown>)["workdir"]).toBeUndefined();
    expect(traces[0]?.absolute).toMatchObject({ kind: "foreground", cwd: "/abs/dir" });
    expect(traces[0]?.noAgent).toMatchObject({ kind: "foreground", cwd: "/workspace" });
  });

  test("huỷ giữa chừng: result.aborted ⇒ ném lỗi AbortError/ABORTED, KHÔNG trả canonical", async () => {
    const traces: { value?: unknown; error?: string; errorName?: string; aborted: boolean }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ jobs: false, result: { aborted: true } });
      install(plugin, rig);
      const outcome = await call(rig, { description: "d", command: "Get-Date" });
      traces.push({
        value: outcome.value,
        error: outcome.error,
        errorName: outcome.errorName,
        aborted: (outcome.value as { aborted?: boolean } | undefined)?.aborted ?? false,
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.error).toBe("tool call aborted");
    expect(traces[0]?.errorName).toBe("AbortError");
  });

  test("run_in_background khi jobs VẮNG ⇒ CÙNG câu lỗi; khi bị tắt ⇒ CÙNG câu lỗi", async () => {
    const traces: string[][] = [];
    for (const plugin of [ours, stock]) {
      const messages: string[] = [];
      const noJobs = makeRig({ jobs: false });
      install(plugin, noJobs);
      const tool = noJobs.tools[0] as ToolLike;
      const first = await tool.execute({ description: "d", command: "x", run_in_background: true }, { callId: "c", rootCallId: "r", agent: AGENT, signal: new AbortController().signal }).then(
        () => "KHONG NEM",
        (error: Error) => error.message,
      );
      messages.push(first);
      const disabled = makeRig({ jobs: false });
      install(plugin, disabled, { enableRunInBackground: false });
      const toolDisabled = disabled.tools[0] as ToolLike;
      const second = await toolDisabled.execute({ description: "d", command: "x", run_in_background: true }, { callId: "c", rootCallId: "r", agent: AGENT, signal: new AbortController().signal }).then(
        () => "KHONG NEM",
        (error: Error) => error.message,
      );
      messages.push(second);
      traces.push(messages);
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      "background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs",
      "run_in_background is disabled for this deployment (enableRunInBackground: false)",
    ]);
  });
});

describe("D. Thi hành — job nền và chuyển nền sau hạn chót", () => {
  test("chạy nền: giá trị background + render + kết cục job TRÙNG bản gốc", async () => {
    const traces: { value?: unknown; render?: unknown; outcome?: unknown; calls: unknown[][] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ result: { exitCode: 3 }, observed: { stdout: "a", stderr: "b" } });
      install(plugin, rig);
      const tool = rig.tools[0] as ToolLike;
      const args = { description: "việc nền", command: "Start-Sleep -Seconds 1", run_in_background: true };
      const outcome = await call(rig, args);
      const jobOutcome = await Promise.all(rig.hooks.map((hooks) => hooks.done));
      traces.push({
        value: outcome.value,
        render: tool.output.render(args, outcome.value),
        outcome: jobOutcome,
        calls: rig.registryCalls,
      });
      expect(rig.jobSpecs[0]?.owner).toBe("agent-1");
      expect(rig.jobSpecs[0]?.toolCall).toEqual({ callId: "call-1", rootCallId: "call-root" });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toEqual({ kind: "background", jobId: "pwsh-1", cwd: "/cwd" });
    expect(traces[0]?.render).toEqual([{ type: "text", text: "started background job pwsh-1" }]);
    expect(traces[0]?.outcome).toEqual([{ status: "completed", detail: "exit code: 3" }]);
  });

  test("chuyển nền sau hạn chót: giá trị promoted + render + ghi chú đọc job TRÙNG", async () => {
    const traces: { value?: unknown; render?: unknown; calls: unknown[][] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({
        views: [{ status: "running", output: { spillPaths: ["/tmp/a.txt"] } }],
        chunks: [
          { channel: "stdout", text: "dòng 1", at: 0 },
          { channel: "stderr", text: "lỗi", at: 6 },
        ],
        lossy: true,
        spillPaths: ["/tmp/a.txt"],
        result: { sandbox: { mode: "read-only", denied: true } },
      });
      install(plugin, rig);
      const tool = rig.tools[0] as ToolLike;
      const args = { description: "việc dài", command: "Start-Sleep -Seconds 9", timeoutMs: 20 };
      const outcome = await call(rig, args);
      traces.push({ value: outcome.value, render: tool.output.render(args, outcome.value), calls: rig.registryCalls });
    }
    expect(traces[0]).toEqual(traces[1]);
    const value = traces[0]?.value as { kind: string; jobId: string; timeoutMs: number; output: string };
    expect(value.kind).toBe("promoted");
    expect(value.jobId).toBe("pwsh-1");
    expect(value.timeoutMs).toBe(20);
    expect(value.output).toContain("dòng 1");
    expect(value.output).toContain("[stderr]\nlỗi");
    expect(value.output).toContain("[some output was dropped from memory; full output: /tmp/a.txt]");
    expect(value.output).toContain("[sandbox: file access denied under read-only mode]");
    expect((traces[0]?.render as { text: string }[])[0]?.text).toBe(
      "dòng 1\n[stderr]\nlỗi\n[some output was dropped from memory; full output: /tmp/a.txt]\n[sandbox: file access denied under read-only mode]\n[still running after 20ms; moved to background job pwsh-1]\nThe command keeps running in the background. You will be notified when it finishes; read newer output with job_output, stop it with job_kill.",
    );
  });

  test("hết hạn LÚC CHUẨN BỊ: foreground timedOut + sandbox mode + hai lý do dừng TRÙNG", async () => {
    const traces: { value?: unknown; calls: unknown[][]; kills: number }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({
        sandboxMode: "read-only",
        policyMode: "read-only",
        executePending: true,
        views: [
          { status: "running" },
          { status: "killed", detail: "timed out during preparation" },
        ],
      });
      install(plugin, rig);
      const outcome = await call(rig, { description: "d", command: "Start-Sleep -Seconds 9", timeoutMs: 5 });
      traces.push({ value: outcome.value, calls: rig.registryCalls, kills: rig.handleKills });
      for (const resolve of rig.pendingResolvers) resolve();
      await Promise.all(rig.hooks.map((hooks) => hooks.done));
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toEqual({
      kind: "foreground",
      cwd: "/cwd",
      exitCode: null,
      signal: null,
      timedOut: true,
      aborted: false,
      timeoutMs: 5,
      stdout: { text: "", truncated: false },
      stderr: { text: "", truncated: false },
      sandbox: { mode: "read-only", denied: false },
    });
    expect(traces[0]?.calls).toContainEqual(["kill", "pwsh-1", "agent-1", "timed out during preparation"]);
  });

  test("registry TỪ CHỐI nhận job ⇒ cảnh báo NGUYÊN VĂN rồi chạy tiền cảnh theo hạn chót", async () => {
    const traces: { value?: unknown; warns: string[]; executes: unknown[]; calls: unknown[][] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ startThrows: true, result: { exitCode: 4 } });
      install(plugin, rig);
      const outcome = await call(rig, { description: "d", command: "Get-Date" });
      traces.push({ value: outcome.value, warns: rig.warns, executes: rig.shellExecutes, calls: rig.registryCalls });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.warns).toEqual(["pwsh: job registration refused, running in the foreground with the timeout kill instead: Error: registration refused"]);
    expect((traces[0]?.value as { kind: string }).kind).toBe("foreground");
    expect((traces[0]?.executes[0] as Record<string, unknown>)["signal"]).toBeDefined();
  });
});

describe("E. Escalate sandbox qua ctx.approval", () => {
  test("được duyệt: chế độ đã duyệt đi vào policy của lời gọi, nguyên liệu approval TRÙNG", async () => {
    const traces: { value?: unknown; requests: unknown[]; calls: unknown[][] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({
        sandboxMode: "read-only",
        policyMode: "read-only",
        approval: { request: async () => "allowed-once" },
      });
      install(plugin, rig);
      const outcome = await call(rig, {
        description: "d",
        command: "Remove-Item C:\\tmp\\x",
        sandbox_permissions: "danger-full-access",
        justification: "cần xoá tệp tạm của chính lời gọi này",
      });
      traces.push({ value: outcome.value, requests: rig.approvalRequests, calls: rig.registryCalls });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.requests).toEqual([{
      agent: AGENT,
      toolName: "pwsh",
      callId: "call-1",
      reason: "escalate sandbox to danger-full-access: cần xoá tệp tạm của chính lời gọi này",
      displayReason: {
        en: "Allow this operation with danger-full-access permissions: cần xoá tệp tạm của chính lời gọi này",
        zh: "允许本次操作使用 danger-full-access 权限：cần xoá tệp tạm của chính lời gọi này",
      },
      signal: expect.anything(),
    }]);
    expect(traces[0]?.calls).toContainEqual(["policy", "session"]);
  });

  test("fail-closed: không approval · người dùng từ chối · không strictly wider — CÙNG câu lỗi", async () => {
    const cases: { approval?: { request(): Promise<string> }; mode: string; expected: string }[] = [
      { mode: "danger-full-access", expected: 'sandbox escalation to "danger-full-access" requires approval, but no approval service is composed' },
      { approval: { request: async () => "rejected" }, mode: "workspace-write", expected: 'the user rejected escalating this command to "workspace-write"; it stays denied, so stop and explain instead of working around it' },
      { approval: { request: async () => "cancelled" }, mode: "workspace-write", expected: 'approval for escalating to "workspace-write" was cancelled' },
      { approval: { request: async () => "unavailable" }, mode: "workspace-write", expected: 'sandbox escalation to "workspace-write" requires approval, but no approval channel is available' },
    ];
    for (const entry of cases) {
      const messages: string[] = [];
      for (const plugin of [ours, stock]) {
        const rig = makeRig({ sandboxMode: "read-only", policyMode: "read-only", approval: entry.approval });
        install(plugin, rig);
        const outcome = await call(rig, {
          description: "d",
          command: "x",
          sandbox_permissions: entry.mode,
          justification: "vì sao",
        });
        messages.push(outcome.error ?? "KHONG NEM");
        expect(rig.shellExecutes).toEqual([]);
      }
      expect(messages[0]).toBe(messages[1]);
      expect(messages[0]).toBe(entry.expected);
    }
  });
});

describe("F. Trình bày kết quả + vòng đời", () => {
  test("presentResult: thẻ terminal có pill mã thoát, generic cho nền/chuyển nền/lỗi — TRÙNG", () => {
    const traces: unknown[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig();
      install(plugin, rig);
      const tool = rig.tools[0] as ToolLike;
      const cases: { args: Record<string, unknown>; result: Record<string, unknown> }[] = [
        { args: { description: "d", command: "Get-Date" }, result: { content: [{ type: "text", text: "ok\n[exit code: 2]" }], isError: false } },
        { args: { description: "d", command: "Get-Date" }, result: { content: [{ type: "text", text: "ok" }], isError: false } },
        { args: { description: "d", command: "Get-Date", run_in_background: true }, result: { content: [{ type: "text", text: "started background job x" }], isError: false } },
        { args: { description: "d", command: "Get-Date" }, result: { content: [{ type: "text", text: "x" }], isError: false, value: { kind: "promoted" } } },
        { args: { description: "d", command: "Get-Date" }, result: { content: [{ type: "text", text: "lỗi" }], isError: true } },
        { args: { description: "d", command: "Get-Date" }, result: { content: [{ type: "image" }], isError: false } },
        { args: { description: "d", command: "Get-Date" }, result: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }], isError: false } },
      ];
      traces.push(cases.map((entry) => tool.presentResult?.(entry.args, entry.result)));
    }
    expect(traces[0]).toEqual(traces[1]);
    const cards = traces[0] as unknown[];
    expect(cards[0]).toEqual({ card: "terminal", output: "ok", exitCode: 2 });
    expect(cards[2]).toEqual({ card: "generic", content: [{ type: "text", text: "```console\nstarted background job x\n```" }] });
    expect(cards[5]).toBeUndefined();
    expect(cards[6]).toBeUndefined();
  });

  test("vòng đời jobs: đăng ký lại khi jobs xuất hiện, dọn khi effect chạy, hạ cánh khi fiber.state === 2", () => {
    const traces: unknown[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ fiberState: 2 });
      install(plugin, rig);
      const beforeDispose = { tools: rig.tools.length, injections: rig.injections, effects: rig.effects.length, unregisters: rig.unregisters };
      for (const dispose of rig.effects) dispose();
      traces.push({
        beforeDispose,
        after: { tools: rig.tools.length, unregisters: rig.unregisters },
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      beforeDispose: { tools: 1, injections: [["jobs"]], effects: 1, unregisters: 0 },
      after: { tools: 2, unregisters: 1 },
    });
  });

  test("không có jobs ⇒ chỉ MỘT lần đăng ký, KHÔNG inject; tắt background ⇒ không inject", () => {
    const traces: unknown[] = [];
    for (const plugin of [ours, stock]) {
      const noJobs = makeRig({ jobs: false });
      install(plugin, noJobs);
      const disabled = makeRig({ jobs: false });
      install(plugin, disabled, { enableRunInBackground: false });
      traces.push({
        noJobs: { tools: noJobs.tools.length, injections: noJobs.injections },
        disabled: { tools: disabled.tools.length, injections: disabled.injections },
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      noJobs: { tools: 1, injections: [["jobs"]] },
      disabled: { tools: 1, injections: [] },
    });
  });
});

describe("G. Quy ước repo — provenance · locale · manifest", () => {
  test("gbh.provenance khớp ĐÚNG stock (version + sha256 bundle gốc)", () => {
    const json = pkgJson();
    const stockJson = JSON.parse(readFileSync(join(STOCK_PKG, "package.json"), "utf8")) as { version: string };
    const stockSha = sha256(readFileSync(STOCK_FILE));
    expect(json.gbh?.provenance).toEqual({
      stock: "@deepseek-ai/dsh-tool-pwsh",
      version: stockJson.version,
      sha: stockSha,
    });
    expect(stockJson.version).toBe("0.2.1-alpha.4");
    expect(stockSha).toBe("94c7f68c425e62c8006907b3f4fea771935321581fd2327b7ee1f0ba8d15eec1");
  });

  test("locale en/zh BYTE-FOR-BYTE như stock + phơi qua exports", () => {
    const json = pkgJson();
    for (const file of ["en.json", "zh.json"]) {
      expect(existsSync(join(STOCK_PKG, "locale", file))).toBe(true);
      expect(readFileSync(join(PKG, "locale", file))).toEqual(readFileSync(join(STOCK_PKG, "locale", file)));
      expect(Object.keys(json.exports ?? {})).toContain("./locale/*.json");
    }
    const zh = JSON.parse(readFileSync(join(PKG, "locale", "zh.json"), "utf8")) as { meta: { title: string; description: string } };
    expect(zh.meta.description).toBe("让 AI 执行 PowerShell 命令。");
  });

  test("manifest: main/exports['.'] = './lib/index.js', row tool-pwsh ĐÃ KHAI đủ field, KHÔNG config/inject", () => {
    const json = pkgJson();
    expect(json.name).toBe("@galaxy-blackhole/gbh-tool-pwsh");
    expect(json.main).toBe("./lib/index.js");
    // 05/11/2026 — P1b: khai báo kiểu (.d.ts) đã có ⇒ exports["."] theo ĐÚNG hình dạng của bản gốc (object types+default).
    expect(json.exports?.["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(json.gbh?.tests).toEqual(["tests/host/tool-pwsh.test.ts"]);
    // 20/10/2026 (Lead mount 6 gói host-tool): row ĐÃ KHAI + mount ⇒ đủ id/moduleIds/aliases/hostAliases/tests;
    // KHÔNG còn `row_unmounted_ly_do`. (disabled của row stock do cơ chế mount quyết, không phải khoá metadata.)
    expect(json.gbh?.row_unmounted_ly_do).toBeUndefined();
    const row = json.gbh?.row;
    expect(row).toEqual({
      id: "tool-pwsh",
      moduleIds: ["@galaxy-blackhole/gbh-tool-pwsh"],
      aliases: ["@deepseek-ai/dsh-tool-pwsh"],
      hostAliases: ["@deepseek-ai/dsh-tool-pwsh"],
      tests: ["tests/host/tool-pwsh.test.ts"],
    });
  });

  test("mọi gbh.peers PHÂN GIẢI ĐƯỢC từ gói ta (node_modules liên kết kernel)", () => {
    const json = pkgJson();
    const require = createRequire(join(PKG, "package.json"));
    const peers = (json.gbh?.peers ?? []);
    // 08/11/2026 — PHASE B (Lead duyệt công thức docs/tien-do/PHASE-B-12-GOI.md §3 bước 4): khi import đã đổi sang
    // `@galaxy-blackhole/gbh-host-tools` (ROW, mount tự cài) thì `@deepseek-ai/dsh-tools` phải BỎ khỏi `gbh.peers`
    // ⇒ 12 tên thay vì 13. Phép kiểm "mọi peer phân giải được" giữ nguyên.
    expect(peers.length).toBe(12);
    for (const name of peers) expect(typeof require.resolve(name)).toBe("string");
    expect(Object.keys(json.peerDependencies ?? {}).length).toBe(12);
    expect(json.dependencies).toEqual({ "@deepseek-ai/schemastery": "~3.18.5-alpha.2" });
  });
});
