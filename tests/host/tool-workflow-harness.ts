/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giàn test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-workflow: Context cordis THẬT + workflowEngine/jobs/
 *      tools/systemPrompt GIẢ, artefact của ta dựng trong mkdtemp; KHÔNG mạng, KHÔNG spawn tiến trình thật
 */

import { normalizePackageNames } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage, mirrorTypeFiles } from "../../packages/host/tool-workflow/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
export const PKG = join(REPO, "packages", "host", "tool-workflow");
/** Artefact ĐÃ build của ta (nếu có sẵn thì test chỉ chép sang mkdtemp). */
const BUILT_FILE = join(PKG, "lib", "index.js");
/** Thư mục bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
export const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-workflow");
/** Bundle GỐC. */
export const STOCK_FILE = join(STOCK_DIR, "lib", "index.js");
/** Cordis THẬT của runtime app. */
const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Nội dung + byte bundle gốc. */
export const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
export const STOCK_BYTES = readFileSync(STOCK_FILE);
/** Số byte / số dòng / sha256 của bundle gốc (chốt cứng để test bắt được drift của stock). */
export const STOCK_BYTE_LENGTH = 17100;
export const STOCK_NEWLINE_COUNT = 442;
export const STOCK_SHA256 = "9d7ccb5238318aae82cbf6ae497f00c2b45e4afa29ed430c7b5c7e7e2cd409e4";
/** Bốn export của gói (MỘT MẶT, không có default export). */
export const EXPORT_NAMES = ["Config", "apply", "inject", "name"];
/** Ba dịch vụ plugin khai trong inject, ĐÚNG thứ tự. */
export const INJECT_NAMES = ["tools", "workflowEngine", "systemPrompt"];
/** Tên tool mặc định. */
export const TOOL_NAME = "workflow";
/** Khoá section systemPrompt mà plugin đọc để lấy thứ tự. */
export const SECTION_KEY = "TOOL_WORKFLOW";
/** Thứ tự section GIẢ mà dịch vụ systemPrompt giả trả về. */
export const SECTION_ORDER = 45;

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
  /** Có bắt buộc không (boolean ở cấp tham số, mảng tên ở cấp object). */
  required?: boolean | readonly string[];
  /** Tập khoá con (khi là object). */
  properties?: Record<string, ParamSchema | undefined>;
  /** Có cho khoá lạ không. */
  additionalProperties?: boolean;
  /** Schema phần tử (khi là array). */
  items?: ParamSchema;
  /** Giá trị hằng (khi là biến thể của oneOf). */
  const?: string;
}

/** Tool đã defineTool (bề mặt test chạm tới). */
export interface ToolLike {
  /** Tên tool. */
  name: string;
  /** Mô tả model-facing. */
  description: string;
  /** JSON Schema tham số. */
  parameters: { type?: string; properties: Record<string, ParamSchema | undefined>; required?: readonly string[] };
  /** Vỏ output: schema + render. */
  output: { schema: JsonRecord; render(args: unknown, value: unknown): unknown };
  /** Thân tool: validate tham số rồi chạy handler. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Card trình bày lời gọi (undefined khi tham số sai). */
  presentCall(args: unknown): unknown;
  /** Card trình bày kết quả. */
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
  /** Thân plugin: đăng ký tool workflow + section systemPrompt. */
  apply(ctx: CtxLike, config?: JsonRecord): void;
}

/** Bề mặt Context cordis tối thiểu mà apply/test chạm tới. */
export interface CtxLike {
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ. */
  provide(name: string, value: unknown): () => Promise<void>;
  /** Tra dịch vụ (cordis: undefined khi chưa có). */
  get(name: string): unknown;
  /** Nghe sự kiện trên bus của Context. */
  on(name: string, listener: (...args: unknown[]) => void): unknown;
  /** Phát sự kiện trên bus của Context. */
  emit(name: string, ...args: unknown[]): void;
  /** Logger của Context (test thay warn/error để đếm lời gọi). */
  logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };
}

/** Một lượt start mà workflowEngine GIẢ đã nhận. */
export interface EngineRequest {
  /** Script nguyên văn. */
  readonly script: string;
  /** Định danh workflow. */
  readonly meta: JsonRecord;
  /** Tham số args (null khi khoá vắng mặt). */
  readonly args: unknown;
  /** Có khoá args trong request không. */
  readonly hasArgs: boolean;
  /** Id agent gọi (null khi thiếu). */
  readonly parent: string | null;
  /** Có signal trong request không. */
  readonly hasSignal: boolean;
}

/** Kịch bản settlement của một lượt chạy. */
export interface EngineStep {
  /** Cách kết thúc: completed/cancelled/error/abnormal/pending (pending = chỉ kết thúc khi bị cancel). */
  mode?: "completed" | "cancelled" | "error" | "abnormal" | "pending";
  /** Số agent đã chạy. */
  agentsStarted?: number;
  /** Giá trị trả về của script. */
  value?: unknown;
  /** Thông điệp lỗi/huỷ. */
  error?: string;
}

/** Engine GIẢ + vết. */
export interface FakeEngine {
  /** Request đã nhận, theo thứ tự. */
  readonly requests: EngineRequest[];
  /** Lời gọi cancel (id + lý do). */
  readonly cancels: { id: string; reason: string }[];
  /** Run đã dispose, theo thứ tự. */
  readonly disposals: string[];
}

/** Job GIẢ mà mirror ghi vào. */
export interface FakeJob {
  /** Id job. */
  readonly id: string;
  /** Dòng tiến trình đã cập nhật. */
  readonly progresses: string[];
  /** Chunk đã append vào ring. */
  readonly appends: { text: string; channel: string }[];
  /** Mirror cập nhật dòng tiến trình sống của job. */
  updateProgress(title: string): void;
  /** Mirror append một chunk narration vào ring của job. */
  append(text: string, options: { channel: string }): void;
}

/** Spec registry jobs GIẢ nhận lúc start. */
export interface JobSpec {
  /** Loại job. */
  readonly kind: string;
  /** Nhãn hiển thị. */
  readonly label: string;
  /** Lời gọi tool đã sinh job. */
  readonly toolCall: JsonRecord;
  /** Chủ sở hữu (agent id). */
  readonly owner?: string;
  /** Chạy job — trả hook. */
  run(job: FakeJob): { cancel(reason?: string): void; done: Promise<unknown> };
}

/** Một job đã start trong registry GIẢ. */
export interface JobRecord {
  /** Id job. */
  readonly id: string;
  /** Spec đã nhận. */
  readonly spec: JobSpec;
  /** Job GIẢ mà mirror ghi vào. */
  readonly job: FakeJob;
  /** Hook sau khi run() chạy. */
  readonly hooks: { cancel(reason?: string): void; done: Promise<unknown> };
}

/** Bề mặt dịch vụ jobs GIẢ (test gọi kill để mô phỏng registry huỷ job). */
export interface JobsService {
  /** Đăng ký job, gọi run() NGAY như registry thật; trả id. */
  start(spec: JobSpec): string;
  /** Huỷ job kèm lý do (registry thật chuyển tiếp lý do cho run.cancel). */
  kill(id: string, owner: unknown, reason: string): void;
  /** Chờ job xong (dùng trong test nếu cần). */
  wait(id: string): Promise<unknown>;
  /** Đọc ring của job (rỗng — test chỉ cần hình dạng). */
  read(): unknown;
  /** Bỏ job khỏi registry. */
  remove(id: string): void;
}

/** Registry jobs GIẢ + vết. */
export interface FakeJobs {
  /** Job đã start, theo thứ tự. */
  readonly started: JobRecord[];
  /** Lời gọi kill. */
  readonly killed: { id: string; reason: string | undefined }[];
  /** Id đã remove. */
  readonly removed: string[];
}

/** Kết quả một lần mount. */
export interface Rig {
  /** Context cordis THẬT vừa dựng. */
  readonly ctx: CtxLike;
  /** Tool đã đăng ký, theo thứ tự. */
  readonly registered: ToolLike[];
  /** Khoá chuỗi đã đọc trên dịch vụ tools. */
  readonly toolKeys: string[];
  /** Section đã đăng ký vào systemPrompt. */
  readonly sections: { name: string; order: number; text: string }[];
  /** Engine GIẢ + vết. */
  readonly engine: FakeEngine;
  /** Registry jobs GIẢ + vết. */
  readonly jobs: FakeJobs;
  /** Dịch vụ jobs GIẢ (gọi kill để mô phỏng registry huỷ job). */
  readonly jobsService: JobsService;
  /** Session GIẢ của agent gọi (recorder ghi run-start/run-end vào đây). */
  readonly session: { id: string; append(type: string, data: unknown): void };
  /** Bản ghi bền đã append vào Session GIẢ. */
  readonly appends: { type: string; data: unknown }[];
  /** Log cảnh báo mà plugin đẩy qua ctx.logger.warn. */
  readonly warnings: string[];
  /** Lỗi apply ném ra (null khi apply không ném). */
  readonly applyError: string | null;
}

/** Tuỳ chọn dựng rig. */
export interface MountOptions {
  /** Kịch bản engine (mặc định: một lượt completed, 1 agent). */
  engine?: EngineStep;
  /** Có dịch vụ jobs không (mặc định false). */
  jobs?: boolean;
  /** Cấu hình truyền cho apply. */
  config?: JsonRecord;
  /** Có dịch vụ tools không (mặc định true). */
  tools?: boolean;
  /** Các loại bản ghi mà Session.append sẽ NÉM (mô phỏng ghi vết hỏng). */
  appendFails?: readonly string[];
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

/** Thư mục tạm dựng artefact (nằm TRONG lib/ của gói để @deepseek-ai/* phân giải qua node_modules của gói). */
let tmpDir = "";
/** File artefact dùng để nạp trong test. */
let artefactFile = "";
/** Module của ta — chỉ có sau prepareArtefact. */
let ourModule: PluginApi | undefined;

/**
 * Dựng artefact của ta: build nếu chưa có, bảo đảm mirror lib/types, rồi chép sang mkdtemp để nạp.
 * Nhận: không.
 * Trả: Promise hoàn tất khi artefact đã sẵn sàng và module của ta đã nạp.
 */
export async function prepareArtefact(): Promise<void> {
  mkdirSync(join(PKG, "lib"), { recursive: true });
  if (!existsSync(BUILT_FILE)) buildPackage();
  mirrorTypeFiles(join(PKG, "lib"));
  tmpDir = mkdtempSync(join(PKG, "lib", ".tmp-build-"));
  artefactFile = join(tmpDir, "index.js");
  copyFileSync(BUILT_FILE, artefactFile);
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
 * Trả: bề mặt module plugin của artefact vừa dựng.
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
  };
  return new Proxy(service, {
    get(target, prop, receiver) {
      if (typeof prop === "string") keys.push(prop);
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * Dựng engine GIẢ: mỗi lượt start trả một run có id tăng dần, kết thúc theo kịch bản.
 * Nhận: step — kịch bản settlement của lượt chạy.
 * Trả: { service, fake } để cấp dịch vụ và khẳng định vết.
 */
function makeEngine(step: EngineStep): { service: unknown; fake: FakeEngine } {
  const fake: FakeEngine = { requests: [], cancels: [], disposals: [] };
  const service = {
    start(request: JsonRecord): JsonRecord {
      const id = "run-" + String(fake.requests.length + 1);
      const meta = request.meta as JsonRecord;
      const args = request.args ?? null;
      fake.requests.push({
        script: String(request.script),
        meta,
        args,
        hasArgs: Object.hasOwn(request, "args"),
        parent: (request.parent as JsonRecord | undefined) === undefined ? null : String((request.parent as JsonRecord).id),
        hasSignal: request.signal !== undefined,
      });
      let settle = (_stopReason: string, _error?: string): void => {};
      const result = new Promise<JsonRecord>((resolve) => {
        let settled = false;
        settle = (stopReason: string, error?: string): void => {
          if (settled) return;
          settled = true;
          resolve({
            id,
            stopReason,
            agentsStarted: step.agentsStarted ?? 0,
            value: step.value ?? null,
            ...(error === undefined ? {} : { error }),
          });
        };
      });
      const mode = step.mode ?? "completed";
      if (mode === "completed") settle("completed");
      if (mode === "error") settle("error", step.error ?? "boom");
      if (mode === "abnormal") settle("surprise", step.error);
      if (mode === "cancelled") settle("cancelled", step.error ?? "cancelled by user");
      return {
        id,
        meta,
        result,
        cancel(reason: string): void {
          fake.cancels.push({ id, reason });
          settle("cancelled", reason);
        },
        async dispose(): Promise<void> {
          fake.disposals.push(id);
        },
      };
    },
  };
  return { service, fake };
}

/**
 * Registry jobs GIẢ: start gọi run() NGAY (như registry thật) + kill/read/remove tối thiểu.
 * Nhận: không.
 * Trả: { service, fake } để cấp dịch vụ và khẳng định vết.
 */
function makeJobs(): { service: JobsService; fake: FakeJobs } {
  const fake: FakeJobs = { started: [], killed: [], removed: [] };
  const service: JobsService = {
    start(spec: JobSpec): string {
      const id = "job-" + String(fake.started.length + 1);
      const job: FakeJob = {
        id,
        progresses: [],
        appends: [],
        updateProgress(title: string): void {
          job.progresses.push(title);
        },
        append(text: string, options: { channel: string }): void {
          job.appends.push({ text, channel: options.channel });
        },
      };
      const record = { id, spec, job, hooks: spec.run(job) };
      fake.started.push(record);
      return id;
    },
    kill(id: string, _owner: unknown, reason: string): void {
      fake.killed.push({ id, reason });
      fake.started.find((entry) => entry.id === id)?.hooks.cancel(reason);
    },
    async wait(id: string): Promise<unknown> {
      const record = fake.started.find((entry) => entry.id === id);
      if (record === undefined) throw new Error("khong co job " + id);
      await record.hooks.done;
      return { status: "completed" };
    },
    read(): unknown {
      return { chunks: [], lossy: false };
    },
    remove(id: string): void {
      fake.removed.push(id);
    },
  };
  return { service, fake };
}

/**
 * Dựng Context cordis THẬT + các dịch vụ GIẢ rồi gọi apply của MỘT bên (config đi qua
 * schema của chính plugin, đúng như Loader thật làm trước khi gọi apply).
 * Nhận: api — bề mặt module plugin; options — bật/tắt dịch vụ + kịch bản giả + config.
 * Trả: Rig (Context, tool đã đăng ký, vết engine/jobs/appends, cảnh báo, lỗi apply).
 */
export async function mount(api: PluginApi, options: MountOptions = {}): Promise<Rig> {
  const ctx = new ContextCtor() as unknown as CtxLike;
  const registered: ToolLike[] = [];
  const toolKeys: string[] = [];
  const sections: { name: string; order: number; text: string }[] = [];
  const appends: { type: string; data: unknown }[] = [];
  const warnings: string[] = [];
  ctx.logger.error = (...args: unknown[]) => {
    warnings.push("error|" + args.map(textOfError).join(" "));
  };
  ctx.logger.warn = (...args: unknown[]) => {
    warnings.push(args.map(textOfError).join(" "));
  };
  if (options.tools !== false) ctx.provide("tools", makeTools(registered, toolKeys));
  ctx.provide("systemPrompt", {
    section(section: { name: string; order: number; text: string }): void {
      sections.push({ name: section.name, order: section.order, text: section.text });
    },
    getSectionOrder(key: string): number {
      return key === SECTION_KEY ? SECTION_ORDER : -1;
    },
  });
  const engine = makeEngine(options.engine ?? {});
  ctx.provide("workflowEngine", engine.service);
  const jobs = makeJobs();
  if (options.jobs === true) ctx.provide("jobs", jobs.service);
  const session = {
    id: "s1",
    append(type: string, data: unknown): void {
      if ((options.appendFails ?? []).includes(type)) throw new Error("append failed: " + type);
      appends.push({ type, data });
    },
  };
  let applyError: string | null = null;
  try {
    // Loader thật chạy config qua schema trước khi gọi apply — giàn test làm y hệt để hai bên cùng một đầu vào.
    api.apply(ctx, api.Config(options.config ?? {}));
  } catch (caught) {
    applyError = textOfError(caught);
  }
  return {
    ctx,
    registered,
    toolKeys,
    sections,
    engine: engine.fake,
    jobs: jobs.fake,
    jobsService: jobs.service,
    session,
    appends,
    warnings,
    applyError,
  };
}

/**
 * Session GIẢ dùng cho mọi lời gọi tool trong một rig (recorder ghi run-start/run-end vào đây).
 * Nhận: rig — kết quả mount.
 * Trả: đối tượng agent {id, session} cắm vào exec.
 */
export function agentOf(rig: Rig): JsonRecord {
  return { id: "a1", session: rig.session };
}

/**
 * Chạy CÙNG một kịch bản trên artefact của ta và bundle gốc, mỗi bên một rig MỚI.
 * Nhận: scenario — kịch bản nhận (api, rig, agent); options — tuỳ chọn dựng rig.
 * Trả: Pair gồm hai chuỗi outcome + hai rig.
 */
export async function pair(
  scenario: (api: PluginApi, rig: Rig, agent: JsonRecord) => unknown,
  options: MountOptions = {},
): Promise<Pair> {
  const rig = await mount(ourApi(), options);
  const stockRig = await mount(stock, options);
  const our = await outcome(() => scenario(ourApi(), rig, agentOf(rig)));
  const their = await outcome(() => scenario(stock, stockRig, agentOf(stockRig)));
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
    toolKeys: [...new Set(rig.toolKeys)],
    sections: rig.sections,
    engine: {
      requests: rig.engine.requests,
      cancels: rig.engine.cancels,
      disposals: rig.engine.disposals,
    },
    jobs: {
      started: rig.jobs.started.map((record) => ({
        id: record.id,
        kind: record.spec.kind,
        label: record.spec.label,
        owner: record.spec.owner ?? null,
        toolCall: record.spec.toolCall,
        appends: record.job.appends,
        progresses: record.job.progresses,
      })),
      killed: rig.jobs.killed,
      removed: rig.jobs.removed,
    },
    appends: rig.appends,
    warnings: rig.warnings,
    applyError: rig.applyError,
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
 * Nhận: extra — tắt agent, thêm parent (lời gọi lồng), hoặc controller để test huỷ giữa lượt.
 * Trả: object exec tối thiểu mà bundle đọc.
 */
export function exec(
  extra: { agent?: JsonRecord; parent?: boolean; controller?: AbortController } = {},
): JsonRecord {
  const controller = extra.controller ?? new AbortController();
  return {
    signal: controller.signal,
    ...(extra.agent === undefined ? {} : { agent: extra.agent }),
    callId: "c1",
    rootCallId: "r1",
    ...(extra.parent === true ? { parent: { callId: "p1", rootCallId: "r0" } } : {}),
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
