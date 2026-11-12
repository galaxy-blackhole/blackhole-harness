/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giàn test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-bash: Context cordis THẬT + shell/tools/jobs/
 *      sandboxPolicy/approval GIẢ, artefact của ta dựng trong mkdtemp; KHÔNG mạng, KHÔNG spawn tiến trình thật
 */

import { normalizePackageNames } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/tool-bash/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "tool-bash");
/** Artefact ĐÃ build của ta (nếu có sẵn thì test chỉ chép sang mkdtemp). */
const BUILT_FILE = join(PKG, "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
export const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-bash", "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Nội dung + byte bundle gốc. */
export const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
export const STOCK_BYTES = readFileSync(STOCK_FILE);
/** Số byte / số dòng / sha256 của bundle gốc (chốt cứng để test bắt được drift của stock). */
export const STOCK_BYTE_LENGTH = 28064;
export const STOCK_NEWLINE_COUNT = 731;
export const STOCK_SHA256 = "a1215d7bcaf82c0755be48321ef6bb45075f1cb33296d6263009e9d10fd596f6";
/** Bốn export của gói (MỘT MẶT, không có default export). */
export const EXPORT_NAMES = ["Config", "apply", "inject", "name"];
/** Năm dịch vụ plugin khai trong inject, ĐÚNG thứ tự. */
export const INJECT_NAMES = ["tools", "shell", "systemPrompt", "shellEnv", "workingDirectory"];
/** Bộ tool plugin đăng ký. */
export const TOOL_NAMES = ["bash"];
/** cwd GIẢ mà dịch vụ workingDirectory giả trả về. */
export const SESSION_CWD = "/srv/session";
/** Snapshot DSH_ENV GIẢ. */
export const DSH_ENV = { DSH_CWD: SESSION_CWD, DSH_SESSION_ID: "s1" };
/** Ba dấu backtick — dựng bằng mã để tệp nguồn không chứa khối rào. */
export const FENCE = String.fromCharCode(96).repeat(3);
/** Mô tả timeoutMs khi promote BẬT (so khớp nguyên văn). */
export const PROMOTE_TIMEOUT_DESCRIPTION =
  "Timeout in milliseconds. The executor applies its configured default and cap; on expiry the command moves to the background as a job instead of being killed.";
/** Mô tả timeoutMs khi promote TẮT (so khớp nguyên văn). */
export const KILL_TIMEOUT_DESCRIPTION =
  "Timeout in milliseconds. The executor applies its configured default and cap, and kills the command on expiry.";

/** Bản ghi JSON đơn giản. */
export interface JsonRecord {
  /** Giá trị bất kỳ. */
  [key: string]: unknown;
}

/** Schema tham số một tool (bề mặt test chạm tới). */
export interface ParamSchema {
  /** Kiểu JSON. */
  type?: string;
  /** Mô tả model-facing của tham số. */
  description?: string;
  /** Tập giá trị cho phép. */
  enum?: readonly string[];
  /** Có bắt buộc không. */
  required?: boolean;
}

/** Tool đã defineTool (bề mặt test chạm tới). */
export interface ToolLike {
  /** Tên tool. */
  name: string;
  /** Mô tả model-facing. */
  description: string;
  /** JSON Schema tham số. */
  parameters: { type?: string; properties: Record<string, ParamSchema | undefined>; required?: readonly string[] };
  /** Vỏ output: schema + render (+ presentationMeta khi có). */
  output: {
    schema: JsonRecord;
    render(args: unknown, value: unknown): unknown;
    presentationMeta?(args: unknown, value: unknown): unknown;
  };
  /** Thân tool: validate tham số rồi chạy handler. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Card trình bày lời gọi (undefined khi tham số sai). */
  presentCall(args: unknown): unknown;
  /** Card trình bày kết quả (undefined khi tham số sai). */
  presentResult?(args: unknown, result: unknown): unknown;
}

/** Bề mặt module plugin (của ta hoặc bản gốc). */
export interface PluginApi {
  /** Tên plugin Loader đăng ký. */
  name: string;
  /** Dịch vụ plugin yêu cầu trước khi chạy. */
  inject: readonly string[];
  /** Schema cấu hình runtime của plugin. */
  Config(input?: unknown): JsonRecord;
  /** Thân plugin: đăng ký tool bash qua ctx.tools. */
  apply(ctx: CtxLike, config?: JsonRecord): void;
}

/** Bề mặt Context cordis tối thiểu mà apply/test chạm tới. */
interface CtxLike {
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ. */
  provide(name: string, value: unknown): () => Promise<void>;
  /** Tra dịch vụ (cordis: undefined khi chưa có). */
  get(name: string): unknown;
  /** Chạy callback khi đủ dịch vụ (cordis chạy BẤT ĐỒNG BỘ). */
  inject(names: readonly string[], callback: (scope: CtxLike) => void): unknown;
  /** Logger của Context (test thay error/warn để đếm lời gọi). */
  logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };
}

/** Một vết gọi dịch vụ shell GIẢ. */
interface ShellCall {
  /** Phương thức được gọi. */
  readonly method: "resolve" | "execute";
  /** Spec/request nguyên văn. */
  readonly spec: JsonRecord;
}

/** Kết quả một lần chạy shell GIẢ. */
export interface ShellResult {
  /** Mã thoát. */
  exitCode: number | null;
  /** Tín hiệu giết tiến trình. */
  signal: string | null;
  /** Có bị timeout không. */
  timedOut: boolean;
  /** Có bị caller huỷ không. */
  aborted: boolean;
  /** Deadline hiệu lực. */
  timeoutMs: number;
  /** Đầu ra chuẩn. */
  stdout: { text: string; truncated: boolean; spillPath?: string };
  /** Đầu ra lỗi. */
  stderr: { text: string; truncated: boolean; spillPath?: string };
  /** Sự kiện sandbox (chỉ khi chạy dưới sandbox). */
  sandbox?: JsonRecord;
}

/** Hook của một job GIẢ. */
interface JobHooks {
  /** Kết thúc khi tiến trình xong. */
  readonly done: Promise<unknown>;
  /** Huỷ job. */
  cancel(reason: string): void;
}

/** Một nguồn đọc output của job GIẢ. */
interface JobSource {
  /** Kênh: stdout/stderr. */
  readonly channel: string;
  /** Đọc không tiêu thụ. */
  read(fromByte: number): unknown;
}

/** Spec mà registry GIẢ nhận lúc start. */
interface JobSpec {
  /** Loại job. */
  readonly kind: string;
  /** Nhãn hiển thị. */
  readonly label: string;
  /** Lời gọi tool đã sinh job. */
  readonly toolCall: JsonRecord;
  /** Chủ sở hữu (agent id). */
  readonly owner?: string;
  /** Hai nguồn đọc stdout/stderr. */
  readonly output: readonly JobSource[];
  /** Chạy job — trả hook. */
  run(): JobHooks;
}

/** Một job đã start trong registry GIẢ. */
interface JobRecord {
  /** Id job. */
  readonly id: string;
  /** Spec đã nhận. */
  readonly spec: JobSpec;
  /** Hook sau khi job được chạy. */
  hooks?: JobHooks;
}

/** Registry jobs GIẢ + vết. */
interface FakeJobs {
  /** Job đã start, theo thứ tự. */
  readonly started: JobRecord[];
  /** Số lần wait. */
  waits: number;
  /** Id đã remove. */
  readonly removed: string[];
  /** Lời gọi kill. */
  readonly killed: { id: string; reason: string | undefined }[];
}

/** Kịch bản registry jobs GIẢ. */
export type JobsMode = "complete" | "promote" | "prepare-timeout" | "abort";

/** Kết quả một lần mount. */
export interface Rig {
  /** Context cordis THẬT vừa dựng. */
  readonly ctx: CtxLike;
  /** Tool đã đăng ký, theo thứ tự. */
  readonly registered: ToolLike[];
  /** Số tool đăng ký NGAY trong apply (trước mọi macrotask). */
  readonly syncRegistered: number;
  /** Khoá chuỗi đã đọc trên dịch vụ tools. */
  readonly toolKeys: string[];
  /** Section đã đăng ký vào systemPrompt. */
  readonly sections: { name: string; order: number; text: string }[];
  /** Vết gọi shell. */
  readonly shellCalls: ShellCall[];
  /** Registry jobs GIẢ + vết. */
  readonly jobs: FakeJobs;
  /** Yêu cầu approval đã phát. */
  readonly approvalAsks: JsonRecord[];
  /** Log lỗi mà cordis đẩy qua ctx.logger.error. */
  readonly errors: string[];
  /** Lỗi apply ném ra (null khi apply không ném). */
  readonly applyError: string | null;
}

/** Tuỳ chọn dựng rig. */
export interface MountOptions {
  /** Có dịch vụ jobs không + kịch bản registry GIẢ (mặc định "none"). */
  jobs?: JobsMode | "none";
  /** Chế độ sandbox của executor (undefined = executor KHÔNG confine). */
  sandboxMode?: string;
  /** Có ctx.sandboxPolicy không (mặc định true khi có sandboxMode). */
  sandboxPolicy?: boolean;
  /** Kết quả approval GIẢ (null/undefined = không có dịch vụ approval). */
  approvalOutcome?: string | null;
  /** Cấu hình truyền cho apply. */
  config?: JsonRecord;
  /** Có dịch vụ tools không (mặc định true). */
  tools?: boolean;
  /** Ghi đè kết quả shell GIẢ. */
  result?: Partial<ShellResult>;
  /** Sandbox facts gắn vào process handle (nhánh promoted đọc). */
  sandboxInfo?: JsonRecord;
}

/** Kết quả một phép so A/B: hai chuỗi outcome + hai rig. */
export interface Pair {
  /** Kết quả kịch bản trên artefact của ta. */
  readonly our: string;
  /** Kết quả kịch bản trên bundle gốc. */
  readonly their: string;
  /** Rig của ta. */
  readonly rig: Rig;
  /** Rig của bản gốc. */
  readonly stockRig: Rig;
}

/** Lớp Context cordis THẬT của runtime app. */
const ContextCtor = ((await import(CORDIS_FILE)) as { Context: new () => unknown }).Context;
/** Bundle GỐC nạp làm oracle. */
export const stock = (await import(STOCK_FILE)) as PluginApi;

/** Thư mục tạm dựng artefact (nằm TRONG gói để @deepseek-ai/* phân giải qua node_modules của gói). */
let tmpDir = "";
/** File artefact dùng để nạp trong test. */
let artefactFile = "";
/** Module của ta — chỉ có sau prepareArtefact. */
let ourModule: PluginApi | undefined;

/**
 * Dựng artefact của ta trong mkdtemp: chép lib/index.js nếu đã build, ngược lại gọi buildPackage.
 * Nhận: không.
 * Trả: Promise hoàn tất khi artefact đã sẵn sàng và module của ta đã nạp.
 */
export async function prepareArtefact(): Promise<void> {
  tmpDir = mkdtempSync(join(PKG, ".tmp-build-"));
  artefactFile = join(tmpDir, "index.js");
  if (existsSync(BUILT_FILE)) copyFileSync(BUILT_FILE, artefactFile);
  else buildPackage(tmpDir);
  ourModule = (await import(pathToFileURL(artefactFile).href)) as PluginApi;
}

/**
 * Dọn thư mục tạm của artefact.
 * Nhận: không.
 * Trả: không.
 */
export function cleanupArtefact(): void {
  if (tmpDir.length > 0) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = "";
}

/**
 * Đường dẫn artefact đang dùng trong test.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối của index.js trong mkdtemp.
 */
export function ourFilePath(): string {
  return artefactFile;
}

/**
 * Trả module của ta (ném nếu prepareArtefact chưa chạy).
 * Nhận: không.
 * Trả: bề mặt module plugin của artefact vừa build trong mkdtemp.
 */
export function ourApi(): PluginApi {
  if (ourModule === undefined) throw new Error("artefact cua ta chua duoc nap (prepareArtefact chua chay?)");
  return ourModule;
}

/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(normalizePackageNames(new TextDecoder().decode(bytes))).digest("hex");
}

/**
 * Chờ cordis chạy xong các fiber con (ctx.inject đăng ký tool BẤT ĐỒNG BỘ).
 * Nhận: không.
 * Trả: Promise hoàn tất sau một macrotask, đủ để mọi fiber đã thoả inject chạy.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 40));
}

/**
 * Gói một lỗi thành chuỗi so sánh được.
 * Nhận: value — giá trị bất kỳ mà logger/throw nhận.
 * Trả: "Name|code|message" cho Error, hoặc String(value).
 */
function textOfError(value: unknown): string {
  if (value instanceof Error) {
    const code = (value as Error & { code?: unknown }).code;
    return value.name + "|" + (typeof code === "string" ? code : "-") + "|" + value.message;
  }
  return String(value);
}

/**
 * Chạy một lượt và ghi kết quả hoặc lỗi thành chuỗi so sánh được.
 * Nhận: run — hàm cần chạy (sync hoặc async).
 * Trả: "ok:<JSON>" hoặc "nem|<Name>|<code>|<message>".
 */
export async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    return "nem|" + textOfError(error);
  }
}

/**
 * Thay AbortSignal bằng chuỗi "signal" để vết JSON so sánh được giữa hai bên.
 * Nhận: spec — request/spec nguyên văn.
 * Trả: bản ghi mới với signal được thay.
 */
function textOfSpec(spec: JsonRecord): JsonRecord {
  const out: JsonRecord = {};
  for (const [key, value] of Object.entries(spec)) out[key] = value instanceof AbortSignal ? "signal" : value;
  return out;
}

/**
 * Dịch vụ tools GIẢ: ghi lại từng tool register + mọi khoá bị đọc.
 * Nhận: registered — mảng nhận tool; keys — mảng nhận khoá chuỗi.
 * Trả: giá trị cấp cho ctx.provide("tools", …), có Proxy ghi vết.
 */
function makeTools(registered: ToolLike[], keys: string[]): unknown {
  const service = {
    register(tool: ToolLike): () => void {
      registered.push(tool);
      return () => {};
    },
    get(): undefined {
      return undefined;
    },
    schemas(): readonly unknown[] {
      return [];
    },
  };
  return new Proxy(service, {
    get(target, prop, receiver) {
      if (typeof prop === "string") keys.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Dựng kết quả shell GIẢ từ tuỳ chọn (mặc định: exit 0, stdout "ok").
 * Nhận: options — tuỳ chọn mount (có thể ghi đè result).
 * Trả: ShellResult đầy đủ.
 */
function makeResult(options: MountOptions): ShellResult {
  const base: ShellResult = {
    exitCode: 0,
    signal: null,
    timedOut: false,
    aborted: false,
    timeoutMs: 120000,
    stdout: { text: "ok", truncated: false },
    stderr: { text: "", truncated: false },
  };
  return { ...base, ...(options.result ?? {}) };
}

/**
 * Process handle GIẢ: đủ trường để bundle gốc chạy foreground/promoted mà KHÔNG spawn gì.
 * Nhận: result — kết quả result() trả; sandbox — sandbox facts (tuỳ chọn).
 * Trả: handle giả.
 */
function makeProcess(result: ShellResult, sandbox: JsonRecord | undefined): unknown {
  return {
    status: "completed",
    exitCode: result.exitCode,
    signal: result.signal,
    ...(sandbox === undefined ? {} : { sandbox }),
    done: Promise.resolve(),
    async result(): Promise<ShellResult> {
      return result;
    },
    readOutput(): JsonRecord {
      return { delta: "", lossy: false };
    },
    observed: {
      stdout: { readFrom(): JsonRecord { return { text: "", nextOffset: 0, lossy: false }; } },
      stderr: { readFrom(): JsonRecord { return { text: "", nextOffset: 0, lossy: false }; } },
    },
    kill(): void {},
  };
}

/**
 * Dịch vụ shell GIẢ: resolve/default + execute trả process handle, KHÔNG chạy lệnh thật.
 * Nhận: options — tuỳ chọn mount; calls — mảng nhận vết.
 * Trả: giá trị cấp cho ctx.provide("shell", …).
 */
function makeShell(options: MountOptions, calls: ShellCall[]): unknown {
  return {
    sandboxMode: options.sandboxMode,
    resolve(request: JsonRecord): JsonRecord {
      calls.push({ method: "resolve", spec: request });
      return {
        command: request.command,
        workdir: (request.workdir as string | undefined) ?? "/executor/default",
        timeoutMs: (request.timeoutMs as number | undefined) ?? 120000,
        onExpiry: (request.onExpiry as string | undefined) ?? "kill",
        stdoutMaxBytes: 1048576,
        signal: request.signal,
        dshEnv: request.dshEnv,
        sandboxPolicy: request.sandboxPolicy,
      };
    },
    async execute(spec: JsonRecord): Promise<unknown> {
      calls.push({ method: "execute", spec });
      return makeProcess(makeResult(options), options.sandboxInfo);
    },
  };
}

/**
 * Đăng ký sandboxPolicy GIẢ (chỉ có nghĩa khi executor confine).
 * Nhận: mode — chế độ hiệu lực của policy.
 * Trả: giá trị cấp cho ctx.provide("sandboxPolicy", …).
 */
function makeSandboxPolicy(mode: string): unknown {
  return {
    resolve(scope: unknown): JsonRecord {
      return { mode, workspaceRoot: "/ws", scope };
    },
  };
}

/**
 * Registry jobs GIẢ: start/wait/read/remove/kill + vết, KHÔNG chạm tiến trình thật.
 * Nhận: mode — kịch bản (complete/promote/prepare-timeout/abort).
 * Trả: { service, fake } để cấp dịch vụ và khẳng định vết.
 */
function makeJobs(mode: JobsMode): { service: unknown; fake: FakeJobs } {
  const fake: FakeJobs = { started: [], waits: 0, removed: [], killed: [] };
  const service = {
    start(spec: JobSpec): string {
      const id = "job-" + String(fake.started.length + 1);
      fake.started.push({ id, spec });
      return id;
    },
    kill(id: string, _owner: unknown, reason: string): void {
      fake.killed.push({ id, reason });
    },
    async wait(id: string): Promise<unknown> {
      const record = fake.started.find((entry) => entry.id === id);
      fake.waits += 1;
      const first = fake.waits === 1;
      if (record === undefined) throw new Error("khong co job " + id);
      if (mode === "abort") {
        if (first) throw new Error("waiter aborted");
        return { status: "killed" };
      }
      if (mode === "prepare-timeout") return first ? { status: "running" } : { status: "killed" };
      if (mode === "promote" && first) {
        record.hooks = record.spec.run();
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { status: "running" };
      }
      const hooks = record.hooks ?? (record.hooks = record.spec.run());
      await new Promise((resolve) => setTimeout(resolve, 10));
      await hooks.done;
      return { status: "completed", detail: "exit code: 0" };
    },
    read(): unknown {
      return {
        chunks: [
          { channel: "stdout", text: "part" },
          { channel: "stderr", text: "warn\n" },
        ],
        lossy: true,
        job: { output: { spillPaths: ["/tmp/spill-1"] } },
      };
    },
    remove(id: string): void {
      fake.removed.push(id);
    },
  };
  return { service, fake };
}

/**
 * Dựng Context cordis THẬT + các dịch vụ GIẢ rồi gọi apply của MỘT bên.
 * Nhận: api — bề mặt module plugin; options — bật/tắt dịch vụ + kịch bản giả.
 * Trả: Rig (Context, tool đã đăng ký, vết shell/jobs/approval, log lỗi, lỗi apply).
 */
export async function mount(api: PluginApi, options: MountOptions = {}): Promise<Rig> {
  const ctx = new ContextCtor() as unknown as CtxLike;
  const registered: ToolLike[] = [];
  const toolKeys: string[] = [];
  const sections: { name: string; order: number; text: string }[] = [];
  const shellCalls: ShellCall[] = [];
  const approvalAsks: JsonRecord[] = [];
  const errors: string[] = [];
  ctx.logger.error = (...args: unknown[]) => {
    errors.push(args.map(textOfError).join(" "));
  };
  ctx.logger.warn = () => {};
  if (options.tools !== false) ctx.provide("tools", makeTools(registered, toolKeys));
  ctx.provide("shell", makeShell(options, shellCalls));
  ctx.provide("systemPrompt", {
    section(section: { name: string; order: number; text: string }): void {
      sections.push({ name: section.name, order: section.order, text: section.text });
    },
    getSectionOrder(key: string): number {
      return key === "TOOL_BASH" ? 30 : 0;
    },
  });
  ctx.provide("shellEnv", {
    collect(): JsonRecord {
      return DSH_ENV;
    },
  });
  ctx.provide("workingDirectory", {
    async ensure(): Promise<string> {
      return SESSION_CWD;
    },
  });
  if (options.sandboxMode !== undefined && options.sandboxPolicy !== false) {
    ctx.provide("sandboxPolicy", makeSandboxPolicy(options.sandboxMode));
  }
  if (options.approvalOutcome !== undefined && options.approvalOutcome !== null) {
    const outcomeValue = options.approvalOutcome;
    ctx.provide("approval", {
      async request(ask: JsonRecord): Promise<string> {
        approvalAsks.push(ask);
        return outcomeValue;
      },
    });
  }
  const jobsMode = options.jobs ?? "none";
  const jobs = makeJobs(jobsMode === "none" ? "complete" : jobsMode);
  if (jobsMode !== "none") ctx.provide("jobs", jobs.service);
  let applyError: string | null = null;
  try {
    api.apply(ctx, options.config);
  } catch (caught) {
    applyError = textOfError(caught);
  }
  const syncRegistered = registered.length;
  await settle();
  return {
    ctx,
    registered,
    syncRegistered,
    toolKeys,
    sections,
    shellCalls,
    jobs: jobs.fake,
    approvalAsks,
    errors,
    applyError,
  };
}

/**
 * Chạy CÙNG một kịch bản trên artefact của ta và bundle gốc, mỗi bên một rig MỚI.
 * Nhận: scenario — kịch bản nhận (api, rig); options — tuỳ chọn dựng rig.
 * Trả: Pair gồm hai chuỗi outcome + hai rig.
 */
export async function pair(
  scenario: (api: PluginApi, rig: Rig) => unknown,
  options: MountOptions = {},
): Promise<Pair> {
  const rig = await mount(ourApi(), options);
  const stockRig = await mount(stock, options);
  const our = await outcome(() => scenario(ourApi(), rig));
  const their = await outcome(() => scenario(stock, stockRig));
  return { our, their, rig, stockRig };
}

/**
 * Vết cô đọng của một rig, JSON-so-sánh-được (bỏ hàm/Promise khỏi job spec).
 * Nhận: rig — kết quả mount.
 * Trả: object vết.
 */
export function trace(rig: Rig): unknown {
  return {
    registered: rig.registered.map((tool) => tool.name),
    syncRegistered: rig.syncRegistered,
    toolKeys: [...new Set(rig.toolKeys)],
    sections: rig.sections,
    errors: rig.errors,
    applyError: rig.applyError,
    shellCalls: rig.shellCalls.map((call) => ({ method: call.method, spec: textOfSpec(call.spec) })),
    jobs: {
      started: rig.jobs.started.map((record) => ({
        id: record.id,
        kind: record.spec.kind,
        label: record.spec.label,
        toolCall: record.spec.toolCall,
        owner: record.spec.owner ?? null,
        channels: record.spec.output.map((source) => source.channel),
        hooksStarted: record.hooks !== undefined,
      })),
      waits: rig.jobs.waits,
      removed: rig.jobs.removed,
      killed: rig.jobs.killed,
    },
    approvalAsks: rig.approvalAsks,
  };
}

/**
 * Lấy một tool theo tên từ rig, báo lỗi rõ khi thiếu.
 * Nhận: rig — kết quả mount; name — tên tool.
 * Trả: ToolLike.
 */
export function toolOf(rig: Rig, name: string): ToolLike {
  const tool = rig.registered.find((entry) => entry.name === name);
  if (tool === undefined) throw new Error("khong co tool " + name);
  return tool;
}

/**
 * Dựng exec GIẢ (agent + signal + callId) cho thân tool.
 * Nhận: extra — tắt agent hoặc dùng signal ĐÃ HUỶ.
 * Trả: object exec tối thiểu.
 */
export function exec(extra: { agent?: boolean; aborted?: boolean } = {}): JsonRecord {
  const controller = new AbortController();
  if (extra.aborted === true) controller.abort();
  return {
    signal: controller.signal,
    ...(extra.agent === false ? {} : { agent: { id: "a1", session: { id: "s1" } } }),
    callId: "c1",
    rootCallId: "r1",
  };
}

/**
 * Giải mã chuỗi "ok:<JSON>" của outcome.
 * Nhận: encoded — chuỗi outcome.
 * Trả: giá trị JSON đã giải mã; ném nếu là nhánh lỗi.
 */
export function decoded(encoded: string): unknown {
  if (!encoded.startsWith("ok:")) throw new Error("khong phai ket qua ok: " + encoded);
  return JSON.parse(encoded.slice(3));
}
