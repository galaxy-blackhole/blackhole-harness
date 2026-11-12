/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-fs (row LỒNG preset): artefact TRÙNG TỪNG BYTE bundle gốc,
 *      bề mặt export runtime, String(Config) + 6 đầu vào Config, apply() trên Context cordis THẬT với service
 *      tools/systemPrompt/fs GIẢ (register/get/schemas) đăng ký ĐÚNG bộ tool id/description/schema, A/B 7 đầu
 *      vào read + 6 đầu vào write/edit + 4 đầu vào read_image, 6 đường lỗi, prompt section, và giao kèo
 *      package.json + locale byte-for-byte. KHÔNG mạng, KHÔNG spawn tiến trình.
 */

import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-fs/build.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "tool-fs");
/** Artefact chuẩn của ta (đã build sẵn). */
const LIB = join(PKG, "lib", "index.js");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-fs");
/** Bundle GỐC — oracle của mọi phép so hành vi. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — CÙNG một thể hiện cho cả hai bản. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Module fs THẬT — chỉ dùng để dựng FsError ĐÚNG lớp cho seam giả. */
const FS_MODULE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-fs", "lib", "index.js");
/**
 * Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp dsh-fs cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ `error instanceof FsError` TRƯỢT, nên artefact (dù
 * BYTE-IDENTICAL bundle gốc) không dịch được FS_STALE_VERSION/FS_SANDBOX_DENIED như bản gốc.
 * Nạp artefact từ thư mục tạm TRONG gói có symlink node_modules/@deepseek-ai → kernel thì hai bên
 * dùng CHUNG một lớp lỗi (pattern tests/host/shell.test.ts).
 */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Workspace GIẢ của phiên. */
const CWD = "/ws";
/** Bộ export runtime ĐÚNG của gói MỘT MẶT. */
const EXPORT_NAMES = ["Config", "apply", "inject", "name"];
/** Bốn tool plugin đăng ký (read_image chỉ có khi có attachments). */
const TOOL_NAMES = ["read", "write", "edit", "read_image"];
/** Byte PNG tối thiểu đủ qua sniff (8 byte chữ ký + đệm). */
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 0, 0, 0, 0]);
/** Kết quả thực thi KHÔNG có phiên (agent trống). */
const EXEC_PLAIN: any = { callId: "call-1", signal: undefined, agent: undefined };
/** Kết quả thực thi CÓ agent + route — cần cho cổng năng lực ảnh của read_image. */
const EXEC_IMAGE: any = {
  callId: "call-2",
  signal: undefined,
  agent: {
    session: { requestHeader: () => ({ config: { provider: "deepseek", model: "m1" } }) },
    options: { provider: "deepseek", model: "m1" },
  },
};

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, any>;

/** Một spec section systemPrompt đã bắt. */
interface SectionSpec {
  /** Tên section. */
  name: string;
  /** Thứ tự section. */
  order: unknown;
  /** Hàm sinh văn bản theo phạm vi. */
  text(input: { scope?: unknown }): unknown;
}

/** Tool đã defineTool (bề mặt test chạm tới). */
interface ToolLike {
  /** Tên tool. */
  name: string;
  /** Mô tả tool. */
  description: string;
  /** JSON Schema tham số đã biên dịch. */
  parameters: any;
  /** Vỏ output: schema + render + presentationMeta tuỳ chọn. */
  output: {
    schema: any;
    render(args: any, value: any): unknown;
    presentationMeta?(args: any, value: any): unknown;
  };
  /** Thân tool. */
  execute(args: any, exec: any): Promise<any>;
  /** Card trình bày lời gọi (nếu có). */
  presentCall?(args: any): unknown;
  /** Card trình bày kết quả (nếu có). */
  presentResult?(args: any, result: any): unknown;
  /** Cờ an toàn đồng thời (nếu có). */
  isConcurrencySafe?(args: any): unknown;
}

/** Bản ghi lời gọi dịch vụ GIẢ. */
interface Recorder {
  /** Tool đã register, tra theo tên. */
  tools: Map<string, ToolLike>;
  /** Thứ tự đăng ký. */
  order: string[];
  /** Các section systemPrompt đã nhận. */
  sections: SectionSpec[];
}

/** Seam fs GIẢ: service + vết gọi. */
interface FakeFs {
  /** Giá trị cấp cho Context qua provide("fs"). */
  service: Record<string, any>;
  /** Vết gọi provider, đã chuẩn hoá undefined ⇒ null. */
  calls: unknown[][];
}

/** Tuỳ chọn seam fs giả. */
interface FakeFsOptions {
  /** fs.sandboxMode = "workspace-write" (composition bị sandbox) hay không. */
  sandboxed?: boolean;
  /** Nội dung text trả về cho readText/streamText. */
  text?: string;
  /** Kiểu stat trả về (mặc định file). */
  statType?: "file" | "directory";
  /** stat trả undefined (file không tồn tại). */
  missing?: boolean;
  /** Kích thước stat ghi đè (điều khiển nhánh stream). */
  size?: number;
  /** operation của writeText (create/update). */
  operation?: "create" | "update";
  /** before của writeText (null = tạo mới). */
  before?: string | null;
  /** writeText ném lỗi này. */
  writeThrows?: Error;
  /** editText ném lỗi này. */
  editThrows?: Error;
  /** Byte ảnh trả cho readBytes. */
  png?: Uint8Array;
}

/** Context cordis tối thiểu mà test chạm tới. */
interface CtxLike {
  /** Cấp một dịch vụ GIẢ. */
  provide(name: string, value: unknown): void;
  /** Nghe sự kiện của Context THẬT. */
  on(event: string, listener: (...args: any[]) => void): unknown;
  /** Tra dịch vụ đã cấp (đi qua getter của cordis). */
  get(name: string): any;
}

/** Kết quả một lượt mount. */
interface Mount {
  /** Context vừa dựng. */
  ctx: CtxLike;
  /** Bản ghi dịch vụ giả. */
  rec: Recorder;
  /** Seam fs giả của lượt này. */
  fs: FakeFs;
  /** Sự kiện fs/observed đã bắt. */
  observed: unknown[][];
}

/** Tuỳ chọn mount. */
interface MountOptions {
  /** Cấu hình truyền cho Config/apply. */
  config?: Record<string, unknown>;
  /** Có cấp attachments (mở read_image) hay không. */
  attachments?: boolean;
  /** Có cấp llm (mặc định true khi có attachments). */
  llm?: boolean;
  /** Composition CÓ sandbox (fs.sandboxMode = workspace-write) hay không. */
  sandbox?: boolean;
  /** Có cấp sandboxPolicy hay không (mặc định true khi sandbox). */
  withPolicy?: boolean;
  /** tools.get luôn trả undefined (đo prompt khi KHÔNG có tool). */
  hideTools?: boolean;
  /** Tuỳ chọn seam fs giả. */
  fs?: FakeFsOptions;
}

/** Kết quả một lượt gọi tool, đã bắt cả nhánh lỗi. */
interface Outcome {
  /** Thành công hay không. */
  ok: boolean;
  /** Giá trị trả về (khi thành công). */
  value?: any;
  /** Nội dung model-facing của output.render. */
  render?: unknown;
  /** Metadata của output.presentationMeta. */
  meta?: unknown;
  /** Card của presentCall. */
  presentCall?: unknown;
  /** Card của presentResult. */
  presentResult?: unknown;
  /** Cờ isConcurrencySafe. */
  concurrency?: unknown;
  /** Tên lớp lỗi (khi hỏng). */
  error?: string;
  /** Mã lỗi có cấu trúc (FsError.code). */
  code?: unknown;
  /** Thông điệp lỗi. */
  message?: string;
}

let ours: Api;
let stock: Api;
let ContextCtor: new () => CtxLike;
let FsErrorCtor: new (message: string, code?: string, options?: unknown) => Error;
/** Lớp FsError của artefact TA (khác danh tính với kernel). */
let FsErrorCtorOurs: new (message: string, code?: string, options?: unknown) => Error;
let artifactFile: string;
let tempDir: string | undefined;

beforeAll(async () => {
  // B chạy trên lib/index.js của ta; nếu chưa build thì build vào thư mục tạm TRONG gói
  // (để import bare-specifier vẫn đi qua node_modules symlink của gói) rồi dọn ở afterAll.
  // Luôn build lại vào thư mục tạm TRONG gói: bare-specifier khác đi qua node_modules của gói, còn
  // @deepseek-ai thì symlink sang ĐÚNG bản kernel (xem KERNEL_AI) để hai bên dùng chung một lớp lỗi.
  tempDir = mkdtempSync(join(PKG, ".ab-build-"));
  buildPackage(tempDir);
  artifactFile = join(tempDir, "index.js");
  mkdirSync(join(tempDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(tempDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(tempDir, "node_modules", "@galaxy-blackhole"), "dir");
  ours = (await import(artifactFile)) as Api;
  stock = (await import(STOCK)) as Api;
  ContextCtor = ((await import(CORDIS)) as { Context: new () => CtxLike }).Context;
  FsErrorCtor = ((await import(FS_MODULE)) as { FsError: new (message: string, code?: string, options?: unknown) => Error }).FsError;
  // 06/11/2026 (P1b): lớp FsError CỦA TA — artefact của ta nạp bản này nên `instanceof` chỉ đúng với nó.
  const fsOurs = (await import(join(REPO, "packages", "host", "fs", "lib", "index.js"))) as {
    FsError: new (message: string, code?: string, options?: unknown) => Error;
  };
  FsErrorCtorOurs = fsOurs.FsError;
}, 60_000);

afterAll(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Dựng seam fs GIẢ tối thiểu đúng hợp đồng mà bundle gọi, có ghi vết từng lời gọi.
 * Nhận: options — hành vi provider (nội dung, stat, lỗi ghi/sửa…).
 * Trả: { service, calls } — service cấp cho Context và vết gọi.
 */
function makeFs(options: FakeFsOptions = {}): FakeFs {
  const calls: unknown[][] = [];
  const text = options.text ?? "alpha\nbeta\ngamma\n";
  const png = options.png ?? PNG_BYTES;
  const service: Record<string, any> = {
    sandboxMode: options.sandboxed === true ? "workspace-write" : undefined,
    resolve: async (path: string, resolveOptions: unknown) => {
      calls.push(["resolve", path, resolveOptions ?? null]);
      return { displayPath: CWD + "/" + path, path };
    },
    stat: async (target: any, signal: unknown) => {
      calls.push(["stat", target.displayPath, signal ?? null]);
      if (options.missing === true) return undefined;
      return { type: options.statType ?? "file", version: 7, size: options.size ?? text.length };
    },
    readText: async (target: any, signal: unknown) => {
      calls.push(["readText", target.displayPath, signal ?? null]);
      return text;
    },
    streamText: async function* streamText(target: any, signal: unknown) {
      calls.push(["streamText", target.displayPath, signal ?? null]);
      yield text;
    },
    readBytes: async (target: any, signal: unknown, cap: number) => {
      calls.push(["readBytes", target.displayPath, signal ?? null, cap]);
      return png;
    },
    processPath: (target: any) => {
      calls.push(["processPath", target.displayPath]);
      return target.displayPath;
    },
    writeText: async (target: any, content: string, intent: unknown, signal: unknown, policy: unknown) => {
      calls.push(["writeText", target.displayPath, content, intent ?? null, signal ?? null, policy ?? null]);
      if (options.writeThrows !== undefined) throw options.writeThrows;
      return {
        version: 9,
        operation: options.operation ?? "update",
        before: options.before === undefined ? "old" : options.before,
        after: content,
      };
    },
    editText: async (target: any, edit: any, intent: unknown, signal: unknown, policy: unknown) => {
      calls.push(["editText", target.displayPath, edit ?? null, intent ?? null, signal ?? null, policy ?? null]);
      if (options.editThrows !== undefined) throw options.editThrows;
      return { version: 10, before: "alpha", after: edit.newString };
    },
  };
  return { service, calls };
}

/**
 * Dựng dịch vụ attachments GIẢ đủ trường imageLimits + saveImage.
 * Nhận: không.
 * Trả: object thoả bề mặt attachments mà read_image chạm tới.
 */
function makeAttachments(): Record<string, any> {
  return {
    imageLimits: {
      mediaTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      maxImageBytes: 4096,
      maxMessageImageBytes: 4096,
      maxImageDimension: 2048,
      maxImagePixels: 4_000_000,
    },
    saveImage: async (input: any) => ({
      attachmentId: "att_1",
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      width: 1,
      height: 1,
      name: input.name,
    }),
  };
}

/**
 * Dựng dịch vụ llm GIẢ: route hiện tại KHAI BÁO nhận ảnh.
 * Nhận: không.
 * Trả: object thoả bề mặt llm.resolveModelInfo.
 */
function makeLlm(): Record<string, any> {
  return {
    resolveModelInfo: async (provider: string, model: string) => ({ provider, model, inputModalities: ["text", "image"] }),
  };
}

/**
 * Dựng Context cordis THẬT + dịch vụ GIẢ rồi gọi apply của một bên.
 * Nhận: api — bề mặt module; options — cấu hình + dịch vụ giả.
 * Trả: Mount (Context, bản ghi, seam fs, sự kiện đã bắt). Ném lỗi apply nếu có.
 */
async function mount(api: Api, options: MountOptions = {}): Promise<Mount> {
  const ctx = new ContextCtor();
  const rec: Recorder = { tools: new Map(), order: [], sections: [] };
  const fake = makeFs({ ...(options.fs ?? {}), sandboxed: options.sandbox === true });
  const observed: unknown[][] = [];
  ctx.provide("tools", {
    register: (tool: ToolLike) => {
      rec.order.push(tool.name);
      rec.tools.set(tool.name, tool);
    },
    get: (name: string) => (options.hideTools === true ? undefined : rec.tools.get(name)),
    schemas: () => [...rec.tools.values()].map((tool) => ({ name: tool.name, parameters: tool.parameters })),
  });
  ctx.provide("systemPrompt", {
    section: (spec: SectionSpec) => {
      rec.sections.push(spec);
    },
    getSectionOrder: () => 700,
  });
  ctx.provide("fs", fake.service);
  ctx.provide("workingDirectory", { ensure: async () => CWD });
  if (options.attachments === true) ctx.provide("attachments", makeAttachments());
  if (options.attachments === true && options.llm !== false) ctx.provide("llm", makeLlm());
  if (options.sandbox === true && options.withPolicy !== false) ctx.provide("sandboxPolicy", { resolve: () => ({ mode: "workspace-write" }) });
  ctx.on("fs/observed", (target: any, info: any) => {
    observed.push([target.displayPath, info]);
  });
  api.apply(ctx, api.Config(options.config ?? {}));
  // read_image đăng ký qua ctx.inject(["attachments"], …) ⇒ chạy sau một nhịp.
  await new Promise((resolve) => setTimeout(resolve, 1));
  return { ctx, rec, fs: fake, observed };
}

/**
 * Lấy một tool đã đăng ký, báo lỗi rõ khi composition thiếu tool.
 * Nhận: mounted — kết quả mount; name — tên tool.
 * Trả: ToolLike.
 */
function tool(mounted: Mount, name: string): ToolLike {
  const found = mounted.rec.tools.get(name);
  if (found === undefined) throw new Error("khong co tool " + name + " trong composition");
  return found;
}

/**
 * Chạy một tool và gom mọi bề mặt quan sát được (giá trị, render, meta, card, lỗi).
 * Nhận: target — tool cần chạy; args — tham số; exec — ngữ cảnh thực thi.
 * Trả: Outcome (không bao giờ ném).
 */
async function outcomeOf(target: ToolLike, args: any, exec: any): Promise<Outcome> {
  try {
    const value = await target.execute(args, exec);
    const render = target.output.render(args, value);
    const meta = target.output.presentationMeta === undefined ? undefined : target.output.presentationMeta(args, value);
    return {
      ok: true,
      value,
      render,
      meta,
      presentCall: target.presentCall === undefined ? undefined : target.presentCall(args),
      presentResult: target.presentResult === undefined ? undefined : target.presentResult(args, { isError: false, meta, content: render }),
      concurrency: target.isConcurrencySafe === undefined ? undefined : target.isConcurrencySafe(args),
    };
  } catch (error) {
    const failure = error as { name?: string; code?: unknown; message?: string };
    return { ok: false, error: failure.name ?? "Error", code: failure.code ?? null, message: failure.message ?? String(error) };
  }
}

/**
 * Chạy CÙNG một ca trên A (của ta) và B (gốc) rồi so khít: kết quả, vết gọi fs, sự kiện observed.
 * Nhận: toolName — tool cần chạy; args — tham số; options — tuỳ chọn mount; exec — ngữ cảnh thực thi.
 * Trả: { a, b, aMount, bMount } để ca kiểm tự khẳng định thêm giá trị cụ thể.
 */
/**
 * Chạy một kịch bản trên CẢ HAI bên, mỗi bên dùng tuỳ chọn (và lớp lỗi) CỦA CHÍNH NÓ.
 * Nhận: toolName — tên tool; args — tham số; options — hàm trả tuỳ chọn mount theo bên.
 * Trả: kết quả hai bên (đã so khớp).
 *
 * Vì sao (06/11/2026, P1b): artefact của ta nạp `FsError` của GÓI TA, bản stock nạp `FsError` của kernel;
 * ném CÙNG một đối tượng cho cả hai bên thì `instanceof` chỉ đúng ở một bên ⇒ đỏ oan.
 */
async function abRunTheoBen(
  toolName: string,
  args: Record<string, unknown>,
  options: (ben: "a" | "b") => MountOptions,
): Promise<{ a: Outcome; b: Outcome; aMount: Mount; bMount: Mount }> {
  const aMount = await mount(ours, options("a"));
  const bMount = await mount(stock, options("b"));
  const a = await outcomeOf(tool(aMount, toolName), args, EXEC_PLAIN);
  const b = await outcomeOf(tool(bMount, toolName), args, EXEC_PLAIN);
  expect(b).toEqual(a);
  return { a, b, aMount, bMount };
}

async function abRun(
  toolName: string,
  args: Record<string, unknown>,
  options: MountOptions = {},
  exec: any = EXEC_PLAIN,
): Promise<{ a: Outcome; b: Outcome; aMount: Mount; bMount: Mount }> {
  const aMount = await mount(ours, options);
  const bMount = await mount(stock, options);
  const a = await outcomeOf(tool(aMount, toolName), args, exec);
  const b = await outcomeOf(tool(bMount, toolName), args, exec);
  expect(b).toEqual(a);
  expect(bMount.fs.calls).toEqual(aMount.fs.calls);
  expect(bMount.observed).toEqual(aMount.observed);
  return { a, b, aMount, bMount };
}

/**
 * Gọi mount và bắt lỗi (dùng cho ca apply ném).
 * Nhận: api — bề mặt module; options — tuỳ chọn mount.
 * Trả: { name, message } của lỗi, hoặc "none" khi không ném.
 */
async function mountError(api: Api, options: MountOptions): Promise<{ name: string; message: string }> {
  try {
    await mount(api, options);
    return { name: "none", message: "none" };
  } catch (error) {
    return { name: (error as Error).name, message: (error as Error).message };
  }
}

/**
 * Ảnh chụp JSON-được của một tool: id, mô tả, schema tham số, schema output, bộ khoá, các hàm có mặt.
 * Nhận: target — tool cần chụp.
 * Trả: object so được bằng toEqual.
 */
function toolSnapshot(target: ToolLike): Record<string, unknown> {
  return {
    name: target.name,
    description: target.description,
    parameters: target.parameters,
    outputSchema: target.output.schema,
    keys: Object.keys(target).sort(),
    presentCall: typeof target.presentCall === "function",
    presentResult: typeof target.presentResult === "function",
    concurrencySafe: typeof target.isConcurrencySafe === "function",
  };
}

/**
 * Ảnh chụp một section systemPrompt, gọi text với registry ĐANG có của lượt mount.
 * Nhận: spec — section đã bắt.
 * Trả: { name, order, text } so được bằng toEqual.
 */
function sectionSnapshot(spec: SectionSpec): Record<string, unknown> {
  return { name: spec.name, order: spec.order, text: spec.text({ scope: undefined }) };
}

/**
 * Gọi Config trên một bề mặt module, gom cả nhánh ném.
 * Nhận: api — bề mặt module; input — đầu vào thô.
 * Trả: { value } hoặc { error, message }.
 */
function configCall(api: Api, input: Record<string, unknown>): Record<string, unknown> {
  try {
    return { value: api.Config(input) };
  } catch (error) {
    return { error: (error as Error).name, message: (error as Error).message };
  }
}

/**
 * Gọi validator chuẩn ~standard của Config trên một bề mặt module.
 * Nhận: api — bề mặt module; input — đầu vào thô.
 * Trả: kết quả validate (value/issues) hoặc { error }.
 */
function configValidate(api: Api, input: Record<string, unknown>): Record<string, unknown> {
  try {
    return api.Config["~standard"].validate(input) as Record<string, unknown>;
  } catch (error) {
    return { error: (error as Error).name, message: (error as Error).message };
  }
}

describe("gbh-tool-fs — A/B với bundle gốc", () => {
  test("A0 artefact của ta TRÙNG TỪNG BYTE bundle gốc (cùng độ dài, cùng sha256)", () => {
    const ourBytes = readFileSync(artifactFile);
    const stockBytes = readFileSync(STOCK);
    // 06/11/2026 (P1b): artefact mang id CUA TA ⇒ moi phep do byte/sha tren DANG DA CHUAN HOA.
    const ourChuan = Buffer.from(chuanHoaHost(ourBytes.toString("utf8")), "utf8");
    expect(ourChuan.length).toBe(49479);
    expect(stockBytes.length).toBe(ourChuan.length);
    expect(ourChuan.equals(stockBytes)).toBe(true);
    expect(sha256(ourChuan.toString("utf8"))).toBe("eb97bc3a840ac8f67903e1218106a93feec76464fa25bc2b7c99d564dbd17d7d");
    expect(sha256(stockBytes.toString("utf8"))).toBe(sha256(ourChuan.toString("utf8")));
  });

  test("A0b buildPackage(outDir) trả CHUỖI đường dẫn và ghi artefact delta 0", () => {
    const out = mkdtempSync(join(PKG, ".ab-gate-"));
    try {
      const file = buildPackage(out);
      expect(typeof file).toBe("string");
      expect(file).toBe(join(out, "index.js"));
      // 06/11/2026 (P1b): so tren dang da chuan hoa id.
      expect(Buffer.from(chuanHoaHost(readFileSync(file, "utf8")), "utf8").equals(readFileSync(STOCK))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("A1 bề mặt export runtime A≡B: Config, apply, inject, name", () => {
    expect(Object.keys(ours).sort()).toEqual(EXPORT_NAMES);
    expect(Object.keys(stock).sort()).toEqual(EXPORT_NAMES);
    for (const key of EXPORT_NAMES) expect(typeof ours[key]).toBe(typeof stock[key]);
    expect(ours.name).toBe("tool-fs");
    expect(stock.name).toBe(ours.name);
    expect(ours.inject).toEqual(["tools", "fs", "systemPrompt", "workingDirectory"]);
    expect(stock.inject).toEqual(ours.inject);
    expect(typeof ours.apply).toBe("function");
    expect(typeof ours.Config).toBe("function");
  });

  test("A2 Config A≡B: String(Config) + 6 đầu vào (mặc định · hợp lệ · sai kiểu)", () => {
    expect(String(ours.Config)).toBe(String(stock.Config));
    const inputs: Record<string, unknown>[] = [
      {},
      { read: false, readImage: false, write: false, edit: false },
      { readLimit: 5, readMaxLineLength: 10, readMaxBytes: 20, readStreamMinSize: 30 },
      { readLimit: 0 },
      { readLimit: 1.5 },
      { read: "yes" },
    ];
    for (const input of inputs) {
      expect(configCall(stock, input)).toEqual(configCall(ours, input));
      expect(configValidate(stock, input)).toEqual(configValidate(ours, input));
    }
    expect(ours.Config({})).toEqual({
      read: true,
      readImage: true,
      write: true,
      edit: true,
      readLimit: 2000,
      readMaxLineLength: 2000,
      readMaxBytes: 51200,
      readStreamMinSize: 10485760,
    });
  });

  test("A3 apply() trên Context cordis THẬT đăng ký ĐÚNG 3 tool như gốc (không attachments)", async () => {
    const a = await mount(ours, {});
    const b = await mount(stock, {});
    expect(a.rec.order).toEqual(["read", "write", "edit"]);
    expect(b.rec.order).toEqual(a.rec.order);
    for (const name of a.rec.order) expect(toolSnapshot(tool(b, name))).toEqual(toolSnapshot(tool(a, name)));
    expect(tool(a, "read").description).toBe("Read a UTF-8 text file and return line-numbered content.");
    expect(tool(a, "write").description).toBe("Create or fully replace a UTF-8 text file.");
    expect(tool(a, "edit").description).toBe("Edit an existing UTF-8 text file by replacing literal text.");
    expect((tool(a, "read").parameters as any).required).toEqual(["file_path"]);
    expect((tool(a, "write").parameters as any).required).toEqual(["file_path", "content"]);
    expect((tool(a, "edit").parameters as any).required).toEqual(["file_path", "old_string", "new_string"]);
    for (const name of TOOL_NAMES.slice(0, 3)) expect(a.rec.tools.has(name)).toBe(true);
    expect(a.rec.tools.has("read_image")).toBe(false);
  });

  test("A4 có attachments ⇒ read_image đăng ký THÊM với schema/description A≡B", async () => {
    const a = await mount(ours, { attachments: true });
    const b = await mount(stock, { attachments: true });
    expect(a.rec.order).toEqual(TOOL_NAMES);
    expect(b.rec.order).toEqual(a.rec.order);
    for (const name of a.rec.order) expect(toolSnapshot(tool(b, name))).toEqual(toolSnapshot(tool(a, name)));
    expect(tool(a, "read_image").description).toContain("PNG/JPEG/WebP/GIF");
    expect(toolSnapshot(tool(a, "read_image")).presentResult).toBe(false);
  });

  test("A5 composition CÓ sandbox ⇒ write/edit thêm sandbox_permissions + justification A≡B", async () => {
    const a = await mount(ours, { sandbox: true });
    const b = await mount(stock, { sandbox: true });
    const aParams = tool(a, "write").parameters as any;
    expect(aParams.properties.sandbox_permissions.enum).toEqual(["workspace-write", "danger-full-access"]);
    expect(aParams.properties.justification.type).toBe("string");
    expect((tool(b, "write").parameters as any)).toEqual(aParams);
    expect(tool(b, "edit").parameters).toEqual(tool(a, "edit").parameters);
    const plain = await mount(ours, {});
    expect((tool(plain, "write").parameters as any).properties.sandbox_permissions).toBeUndefined();
    expect((tool(plain, "edit").parameters as any).properties.sandbox_permissions).toBeUndefined();
    expect(await mountError(stock, { sandbox: true, withPolicy: false })).toEqual(await mountError(ours, { sandbox: true, withPolicy: false }));
  });

  test("A6 read A/B trên 7 đầu vào: mặc định · offset · limit · cắt dòng · cắt byte · stream · lỗi offset", async () => {
    const plain = await abRun("read", { file_path: "note.txt" });
    expect(plain.a.ok).toBe(true);
    expect(plain.a.value).toEqual({
      path: "/ws/note.txt",
      offset: 1,
      lines: [
        { number: 1, text: "alpha" },
        { number: 2, text: "beta" },
        { number: 3, text: "gamma" },
      ],
      totalLines: 3,
    });
    expect(plain.a.render).toEqual([
      { type: "text", text: "<path>/ws/note.txt</path>\n<type>file</type>\n<content>\n1: alpha\n2: beta\n3: gamma\n\n(End of file - total 3 lines)\n</content>" },
    ]);
    expect(plain.aMount.fs.calls.some((call) => call[0] === "readText")).toBe(true);
    const ranged = await abRun("read", { file_path: "note.txt", offset: 2, limit: 1 });
    expect((ranged.a.value as any).lines).toEqual([{ number: 2, text: "beta" }]);
    expect((ranged.a.value as any).totalLines).toBe(3);
    await abRun("read", { file_path: "note.txt", offset: 2 });
    const cut = await abRun("read", { file_path: "note.txt" }, { config: { readMaxLineLength: 4 }, fs: { text: "abcdefgh\nok\n" } });
    expect((cut.a.value as any).lines[0].text).toBe("abcd... (line truncated to 4 chars)");
    const capped = await abRun("read", { file_path: "note.txt" }, { config: { readMaxBytes: 6 } });
    expect((capped.a.value as any).lines.length).toBe(1);
    expect(JSON.stringify(capped.a.render)).toContain("Output capped. Showing lines 1-1");
    const streamed = await abRun("read", { file_path: "note.txt" }, { config: { readStreamMinSize: 4 } });
    expect(streamed.aMount.fs.calls.some((call) => call[0] === "streamText")).toBe(true);
    const outOfRange = await abRun("read", { file_path: "note.txt", offset: 99 });
    expect(outOfRange.a.ok).toBe(false);
    expect(outOfRange.a.code).toBe("FS_NOT_FOUND");
    expect(outOfRange.a.message).toBe('offset 99 is out of range for "/ws/note.txt" (3 lines)');
  });

  test("A7 write/edit A/B trên 6 đầu vào (create · update · replace_all · 3 lỗi validate)", async () => {
    const created = await abRun("write", { file_path: "new.txt", content: "hello" }, { fs: { operation: "create", before: null } });
    expect(created.a.value).toEqual({ path: "/ws/new.txt", operation: "create", before: null, after: "hello" });
    expect(created.a.render).toEqual([{ type: "text", text: "<path>/ws/new.txt</path>\n<type>file</type>\n<content>\nCreated file\n</content>" }]);
    const updated = await abRun("write", { file_path: "new.txt", content: "next" }, { fs: { operation: "update", before: "hello" } });
    expect((updated.a.value as any).operation).toBe("update");
    const edited = await abRun("edit", { file_path: "new.txt", old_string: "alpha", new_string: "omega" });
    expect(edited.a.value).toEqual({ path: "/ws/new.txt", before: "alpha", after: "omega" });
    expect(edited.a.render).toEqual([{ type: "text", text: "The file /ws/new.txt has been updated successfully." }]);
    const editCall = edited.aMount.fs.calls[1] as unknown[];
    expect(editCall[0]).toBe("editText");
    expect(editCall[2]).toEqual({ oldString: "alpha", newString: "omega", replaceAll: false });
    expect(editCall[5]).toBeNull();
    const replaced = await abRun("edit", { file_path: "new.txt", old_string: "alpha", new_string: "omega", replace_all: true });
    expect(replaced.a.render).toEqual([{ type: "text", text: "The file /ws/new.txt has been updated. All occurrences were successfully replaced." }]);
    expect(((replaced.aMount.fs.calls[1] as unknown[])[2] as any).replaceAll).toBe(true);
    const blank = await abRun("write", { file_path: "   ", content: "x" });
    expect(blank.a.message).toBe("file_path must be a non-empty string");
    const same = await abRun("edit", { file_path: "new.txt", old_string: "alpha", new_string: "alpha" });
    expect(same.a.message).toBe("old_string and new_string must differ");
  });

  test("A8 read_image A/B: 1 ca thành công + 3 ca lỗi (đuôi lạ · thiếu route · path rỗng)", async () => {
    const ok = await abRun("read_image", { file_path: "pixel.png" }, { attachments: true }, EXEC_IMAGE);
    expect(ok.a.value).toEqual({
      path: "/ws/pixel.png",
      image: { attachmentId: "att_1", mediaType: "image/png", bytes: 16, width: 1, height: 1, name: "pixel.png" },
    });
    expect(JSON.stringify(ok.a.render)).toContain("image/png image, 1x1 px, 16 bytes");
    const extension = await abRun("read_image", { file_path: "note.txt" }, { attachments: true }, EXEC_IMAGE);
    expect(extension.a.message).toContain("the .txt extension does not declare a supported image format");
    const noRoute = await abRun("read_image", { file_path: "pixel.png" }, { attachments: true, llm: false }, EXEC_IMAGE);
    expect(noRoute.a.message).toContain("the current model route could not be resolved");
    const blank = await abRun("read_image", { file_path: "  " }, { attachments: true }, EXEC_IMAGE);
    expect(blank.a.message).toBe("file_path must be a non-empty string");
  });

  test("A9 6 đường lỗi A≡B: thiếu file · không phải file · stale · not-observed · sandbox denied · escalation", async () => {
    const missing = await abRun("read", { file_path: "ghost.txt" }, { fs: { missing: true } });
    expect(missing.a.code).toBe("FS_NOT_FOUND");
    expect(missing.a.message).toBe('cannot read "/ws/ghost.txt": not found');
    expect(missing.aMount.observed).toEqual([["/ws/ghost.txt", { kind: "absent" }]]);
    const directory = await abRun("read", { file_path: "folder" }, { fs: { statType: "directory" } });
    expect(directory.a.code).toBe("FS_NOT_REGULAR_FILE");
    expect(directory.a.message).toBe('cannot read "/ws/folder": not a regular file');
    // 06/11/2026 (P1b): mỗi bên ném lớp FsError CỦA CHÍNH NÓ (xem abRunTheoBen).
    const stale = await abRunTheoBen("write", { file_path: "a.txt", content: "x" }, (ben) => ({
      fs: { writeThrows: new (ben === "a" ? FsErrorCtorOurs : FsErrorCtor)("version mismatch", "FS_STALE_VERSION") },
    }));
    expect(stale.a.code).toBe("FS_STALE_VERSION");
    expect(stale.a.message).toBe("version mismatch — re-read the file, then retry");
    const notObserved = await abRunTheoBen("edit", { file_path: "a.txt", old_string: "alpha", new_string: "beta" }, (ben) => ({
      fs: { editThrows: new (ben === "a" ? FsErrorCtorOurs : FsErrorCtor)("not read", "FS_NOT_OBSERVED") },
    }));
    expect(notObserved.a.code).toBe("FS_NOT_OBSERVED");
    expect(notObserved.a.message).toBe('cannot modify "/ws/a.txt": file has not been read — read the file, then retry');
    const denied = await abRunTheoBen("write", { file_path: "a.txt", content: "x" }, (ben) => ({
      sandbox: true,
      fs: { writeThrows: new (ben === "a" ? FsErrorCtorOurs : FsErrorCtor)("denied by policy", "FS_SANDBOX_DENIED") },
    }));
    expect(denied.a.code).toBe("FS_SANDBOX_DENIED");
    expect(denied.a.message).toContain("[sandbox: file access denied under workspace-write mode]");
    const escalate = await abRun("write", { file_path: "a.txt", content: "x", sandbox_permissions: "danger-full-access", justification: "can ghi" }, { sandbox: true });
    expect(escalate.a.message).toContain("requires approval, but no approval service is composed");
  });

  test("A10 prompt section A≡B khi registry CÓ tool và khi registry RỖNG", async () => {
    const a = await mount(ours, {});
    const b = await mount(stock, {});
    expect(a.rec.sections.map((spec) => spec.name)).toEqual(["tool:read", "tool:write", "tool:edit"]);
    expect(b.rec.sections.map((spec) => spec.name)).toEqual(a.rec.sections.map((spec) => spec.name));
    for (let index = 0; index < a.rec.sections.length; index += 1) {
      expect(sectionSnapshot(b.rec.sections[index]!)).toEqual(sectionSnapshot(a.rec.sections[index]!));
    }
    expect(sectionSnapshot(a.rec.sections[1]!).text).toBe(
      "Read an existing file before overwriting it with write (the default fs-observation-policy requires it) and prefer edit for targeted changes.",
    );
    const emptyA = await mount(ours, { hideTools: true });
    const emptyB = await mount(stock, { hideTools: true });
    for (const spec of emptyA.rec.sections) expect(sectionSnapshot(spec).text).toBe("");
    for (let index = 0; index < emptyA.rec.sections.length; index += 1) {
      expect(sectionSnapshot(emptyB.rec.sections[index]!)).toEqual(sectionSnapshot(emptyA.rec.sections[index]!));
    }
  });

  test("A11 giao kèo package.json + symlink peer/dep + locale byte-for-byte", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    const stockJson = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as any;
    expect(json.name).toBe("@galaxy-blackhole/gbh-tool-fs");
    expect(json.private).toBe(true);
    expect(json.type).toBe("module");
    expect(json.main).toBe("lib/index.js");
    // 08/11/2026 (dev-5, task-17/N2): "." nay là OBJECT { types, default } — lần quét toàn cây của Lead
    // thêm điều kiện `types` cho mọi gói có lib/types CÓ THẬT (consumer TS resolve theo id gói mới thấy kiểu).
    // Phần còn lại của giao kèo (peer/dep đã quy id, gbh.peers, gbh.nested, locale byte-for-byte) GIỮ NGUYÊN.
    expect(json.exports).toEqual({
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./locale/*.json": "./locale/*.json",
      "./package.json": "./package.json",
    });
    expect(existsSync(join(PKG, "lib/types/index.d.ts"))).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    expect(json.gbh.peers).toEqual([...Object.keys(json.peerDependencies), ...Object.keys(json.dependencies)]);
    expect(json.gbh.tests).toEqual(["tests/host/tool-fs.test.ts"]);
    expect(json.gbh.row).toBeUndefined();
    expect(json.gbh.nested).toEqual({
      kind: "preset",
      pluginId: "tool-fs",
      stockId: "@deepseek-ai/dsh-tool-fs",
      presets: ["preset-standard", "preset-ptc", "preset-minimal", "preset-cordis"],
    });
    for (const name of json.gbh.peers as string[]) expect(existsSync(join(PKG, "node_modules", name, "package.json"))).toBe(true);
    for (const file of ["en.json", "zh.json"]) {
      expect(readFileSync(join(PKG, "locale", file)).equals(readFileSync(join(STOCK_DIR, "locale", file)))).toBe(true);
    }
  });
});
