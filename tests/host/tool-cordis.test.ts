/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-cordis: artefact BYTE-IDENTICAL bundle gốc + bề mặt export +
 *      apply trên Context cordis THẬT với seam tools/cordisInspect GIẢ (KHÔNG mạng, KHÔNG spawn/shell) +
 *      subpath ./host (6 tệp JS nguyên văn) + metadata gói + locale byte-for-byte
 */

import { beforeAll, describe, expect, test } from "bun:test";
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-cordis/build.ts";
import { assembleBundle, stripSliceScaffold } from "../../packages/host/tool-cordis/src/assemble.ts";
import {
  HOST_TYPES_FILES,
  LOCALE_FILES,
  PART_FILES,
  PACKAGE_NAME,
  STOCK_BUNDLE,
  STOCK_LOCALE_DIR,
  STOCK_PACKAGE_JSON,
  STOCK_PACKAGE_NAME,
  STOCK_TYPES_DIR,
} from "../../packages/host/tool-cordis/src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "tool-cordis");
/** Artefact chính của ta. */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Artefact subpath ./host của ta. */
const OURS_HOST_FILE = join(PKG, "lib", "types", "host.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_FILE = join(REPO, STOCK_BUNDLE);
/** Module host GỐC (CHỈ ĐỌC). */
const STOCK_HOST_FILE = join(REPO, STOCK_TYPES_DIR, "host.js");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Bytes bundle gốc. */
const STOCK_BYTES = readFileSync(STOCK_FILE);
/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);
/** ĐÚNG 2 tool plugin đăng ký, ĐÚNG thứ tự apply. */
const TOOL_NAMES = ["cordis_inspect_list", "cordis_inspect_query"];
/** ĐÚNG 3 tên export runtime (không default, không Config). */
const EXPORT_NAMES = ["apply", "inject", "name"];
/** Tham số query hợp lệ dùng lại nhiều ca. */
const QUERY_ARGS = { platform: "host", provider: "Service", method: "listService", input: { service: "agent" } };
/** Tổng byte của 6 tệp JS subpath ./host (đo từ bản gốc). */
const HOST_TYPES_BYTES = 678_089;

/** Bề mặt một tool đã defineTool (phần test chạm tới). */
interface ToolLike {
  /** Tên tool. */
  name: string;
  /** Mô tả model-facing. */
  description: string;
  /** JSON Schema tham số đã biên dịch. */
  parameters: unknown;
  /** Đầu ra: schema + render. */
  output: { schema: unknown; render(args: unknown, value: unknown): unknown };
  /** Bản trình bày lời gọi. */
  presentCall(args: unknown): unknown;
  /** Thân tool. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
}

/** Ngữ cảnh thực thi GIẢ. */
interface Exec {
  /** Tên tool. */
  name: string;
  /** Id lời gọi. */
  callId: string;
  /** Tín hiệu huỷ. */
  signal: AbortSignal;
  /** Agent gắn phiên (tuỳ chọn). */
  agent?: unknown;
}

/** Bề mặt module của ta hoặc bundle gốc. */
interface Surface {
  /** Tên plugin. */
  readonly name: string;
  /** Dịch vụ bắt buộc. */
  readonly inject: readonly string[];
  /** Đăng ký tool. */
  apply(ctx: unknown, config?: unknown): unknown;
  /** Bản gốc KHÔNG có Config; khai để so sự VẮNG MẶT. */
  Config?: unknown;
}

/** Fiber cordis (phần test chạm tới). */
interface FiberLike {
  /** Trạng thái fiber. */
  state?: number;
  /** Huỷ fiber. */
  dispose(): Promise<unknown>;
}

/** Context cordis tối thiểu mà test chạm tới (lớp THẬT của runtime). */
interface Ctx {
  /** Cấp dịch vụ. */
  provide(name: string, value: unknown): unknown;
  /** Nạp plugin qua vòng đời cordis. */
  plugin(plugin: unknown, config?: unknown): FiberLike;
  /** Đọc dịch vụ. */
  get(name: string): unknown;
  /** Đăng ký hiệu ứng có dọn dẹp. */
  effect(execute: () => unknown, label?: string): () => unknown;
}

/** Provider inspect (phần test chạm tới). */
interface ProviderLike {
  /** Manifest công khai. */
  manifest: { id: string; description: string; methods: readonly { name: string; description: string; inputSchema: unknown; outputSchema: unknown }[] };
  /** Trả lời một method. */
  query(method: string, input: unknown, context?: { agent?: unknown }): Promise<unknown>;
}

/** Tuỳ chọn dựng rig cho plugin agent. */
interface MountOptions {
  /** Danh sách provider mà seam list trả về. */
  providers?: unknown[];
  /** Lỗi seam list ném ra. */
  listError?: Error;
  /** Seam query thay thế. */
  query?: (args: unknown[]) => Promise<unknown>;
  /** Có cấp dịch vụ tools hay không. */
  withTools?: boolean;
  /** Có cấp dịch vụ cordisInspect hay không. */
  withInspect?: boolean;
  /** Config truyền vào apply (bản gốc bỏ qua). */
  config?: unknown;
}

/** Kết quả một lượt mount plugin agent. */
interface Rig {
  /** Context thật. */
  ctx: Ctx;
  /** Tool đã đăng ký. */
  tools: ToolLike[];
  /** Tham số seam query đã nhận. */
  calls: unknown[][];
  /** Provider đã đăng ký (chỉ dùng cho host). */
  register: ProviderLike[];
  /** Lỗi apply (null nếu sạch). */
  error: string | null;
}

/** Kết quả một lượt mount plugin host. */
interface HostRig {
  /** Context thật. */
  ctx: Ctx;
  /** Provider đã đăng ký qua effect. */
  providers: ProviderLike[];
  /** Agent đã truyền vào ctx.tools.schemas. */
  schemasCalls: unknown[];
  /** Lỗi apply (null nếu sạch). */
  error: string | null;
  /** Fiber của plugin. */
  fiber?: FiberLike;
}

/** Bề mặt module của ta (nạp sau beforeAll). */
let ours: Surface;
/** Bề mặt subpath ./host của ta (nạp sau beforeAll). */
let oursHost: Surface;

/** Bundle gốc dưới dạng module (A). */
const stock = (await import(STOCK_FILE)) as unknown as Surface;
/** Module host gốc dưới dạng module (A). */
const stockHost = (await import(STOCK_HOST_FILE)) as unknown as Surface;
/** Lớp Context cordis THẬT của runtime. */
const { Context } = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as {
  Context: new () => unknown;
};

beforeAll(async () => {
  if (!existsSync(OURS_FILE) || !existsSync(OURS_HOST_FILE)) buildPackage();
  ours = (await import(OURS_FILE)) as unknown as Surface;
  oursHost = (await import(OURS_HOST_FILE)) as unknown as Surface;
});

/**
 * Băm SHA-256 một buffer.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Định dạng lỗi thành "<name>|<message>".
 * Nhận: error — giá trị bắt được.
 * Trả: chuỗi ổn định để so A/B.
 */
function errorText(error: unknown): string {
  const failure = error as Error;
  return String(failure.name) + "|" + String(failure.message);
}

/**
 * Ép một giá trị JSON thành record để truy cập khoá.
 * Nhận: value — giá trị bất kỳ.
 * Trả: record tương ứng (không kiểm kiểu lúc chạy).
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

/**
 * Chạy một hàm async → "ok:<JSON>" hoặc "nem:<name>|<message>".
 * Nhận: run — hàm cần chạy.
 * Trả: chuỗi kết quả ổn định.
 */
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    return "nem:" + errorText(error);
  }
}

/**
 * Dựng exec GIẢ.
 * Nhận: overrides — các trường ghi đè.
 * Trả: exec hoàn chỉnh.
 */
function makeExec(overrides: Partial<Exec> = {}): Exec {
  return { name: "cordis_inspect_query", callId: "call-1", signal: new AbortController().signal, ...overrides };
}

/**
 * Dựng Context cordis THẬT + seam GIẢ rồi gọi apply của một bên (KHÔNG ném).
 * Nhận: api — bề mặt module; options — tuỳ chọn rig.
 * Trả: rig gồm tool đã đăng ký, tham số seam và lỗi apply.
 */
async function mount(api: Surface, options: MountOptions = {}): Promise<Rig> {
  const ctx = new Context() as unknown as Ctx;
  const tools: ToolLike[] = [];
  const calls: unknown[][] = [];
  const register: ProviderLike[] = [];
  if (options.withTools !== false) {
    ctx.provide("tools", { register: (tool: ToolLike) => { tools.push(tool); }, schemas: () => [] });
  }
  if (options.withInspect !== false) {
    ctx.provide("cordisInspect", {
      list: () => {
        if (options.listError !== undefined) throw options.listError;
        return options.providers ?? [];
      },
      query: (...args: unknown[]) => {
        calls.push(args);
        const seam = options.query ?? (async () => ({ argc: args.length }));
        return seam(args);
      },
      register: (provider: ProviderLike) => {
        register.push(provider);
        return () => {
          const at = register.indexOf(provider);
          if (at >= 0) register.splice(at, 1);
        };
      },
    });
  }
  let error: string | null = null;
  try {
    await api.apply(ctx, options.config);
  } catch (caught) {
    error = errorText(caught);
  }
  return { ctx, tools, calls, register, error };
}

/**
 * Dựng Context cordis THẬT + seam GIẢ rồi nạp plugin HOST qua vòng đời cordis.
 * Nhận: api — bề mặt module host.
 * Trả: rig gồm provider đã đăng ký, lời gọi schemas và fiber.
 */
async function mountHost(api: Surface): Promise<HostRig> {
  const ctx = new Context() as unknown as Ctx;
  const providers: ProviderLike[] = [];
  const schemasCalls: unknown[] = [];
  ctx.provide("cordisInspect", {
    list: () => [],
    query: async () => ({}),
    register: (provider: ProviderLike) => {
      providers.push(provider);
      return () => {
        const at = providers.indexOf(provider);
        if (at >= 0) providers.splice(at, 1);
      };
    },
  });
  ctx.provide("tools", {
    schemas: (agent: unknown) => {
      schemasCalls.push(agent);
      return [{ name: "read" }];
    },
    register: () => undefined,
  });
  let error: string | null = null;
  let fiber: FiberLike | undefined;
  try {
    fiber = ctx.plugin({ name: api.name, inject: api.inject, apply: api.apply });
  } catch (caught) {
    error = errorText(caught);
  }
  await new Promise((resolve) => setTimeout(resolve, 40));
  return { ctx, providers, schemasCalls, error, fiber };
}

/**
 * Lấy một tool theo tên.
 * Nhận: rig — kết quả mount; name — tên tool.
 * Trả: tool tương ứng.
 * @throws {Error} khi tool chưa được đăng ký.
 */
function toolOf(rig: Rig, name: string): ToolLike {
  const tool = rig.tools.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new Error("khong co tool " + name);
  return tool;
}

/**
 * Lấy một provider theo id.
 * Nhận: rig — kết quả mount host; id — id provider.
 * Trả: provider tương ứng.
 * @throws {Error} khi provider chưa được đăng ký.
 */
function providerOf(rig: HostRig, id: string): ProviderLike {
  const provider = rig.providers.find((candidate) => candidate.manifest.id === id);
  if (provider === undefined) throw new Error("khong co provider " + id);
  return provider;
}

/**
 * Chụp spec model-facing của một tool (kèm presentCall theo đúng tham số của tool đó).
 * Nhận: tool — tool đã defineTool.
 * Trả: record so sánh A/B.
 */
function specOf(tool: ToolLike): Record<string, unknown> {
  const args = tool.name === "cordis_inspect_list" ? {} : QUERY_ARGS;
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    output: tool.output.schema,
    presentCall: tool.presentCall(args),
  };
}

/**
 * Duyệt đệ quy các tệp thường dưới một thư mục, trả đường dẫn tương đối đã sắp xếp.
 * Nhận: root — thư mục gốc; prefix — tiền tố tương đối.
 * Trả: mảng đường dẫn tương đối kiểu POSIX.
 */
function walkFiles(root: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : prefix + "/" + entry.name;
    if (entry.isDirectory()) out.push(...walkFiles(root, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

/**
 * Đăng ký plugin qua vòng đời cordis THẬT rồi chụp trạng thái.
 * Nhận: api — bề mặt module; withServices — có cấp tools/cordisInspect hay không.
 * Trả: record gồm trạng thái fiber, tool đã đăng ký và lỗi.
 */
async function pluginSnapshot(api: Surface, withServices: boolean): Promise<Record<string, unknown>> {
  const ctx = new Context() as unknown as Ctx;
  const tools: ToolLike[] = [];
  if (withServices) {
    ctx.provide("tools", { register: (tool: ToolLike) => { tools.push(tool); }, schemas: () => [] });
    ctx.provide("cordisInspect", { list: () => [], query: async () => ({}), register: () => () => undefined });
  }
  let error: string | null = null;
  let fiber: FiberLike | undefined;
  try {
    fiber = ctx.plugin({ name: api.name, inject: api.inject, apply: api.apply });
  } catch (caught) {
    error = errorText(caught);
  }
  await new Promise((resolve) => setTimeout(resolve, 40));
  return { error, state: fiber?.state ?? null, tools: tools.map((tool) => tool.name) };
}

describe("artefact: cổng byte", () => {
  test("buildPackage() ĐỒNG BỘ: lib/index.js 3.687 B · delta 0 · cùng sha256 bundle gốc", () => {
    const returned = buildPackage();
    expect(typeof returned).toBe("string");
    expect(returned).toBe(OURS_FILE);
    const built = readFileSync(OURS_FILE);
    // 05/11/2026 (P1b): artefact mang id CUA TA ⇒ moi phep do byte/sha tinh tren DANG DA CHUAN HOA id.
    const builtChuan = Buffer.from(chuanHoaHost(built.toString("utf8")), "utf8");
    expect(builtChuan.length).toBe(3_687);
    expect(builtChuan.length).toBe(STOCK_BYTES.length);
    expect(builtChuan.equals(STOCK_BYTES)).toBe(true);
    expect(sha256(builtChuan)).toBe(sha256(STOCK_BYTES));
    expect(sha256(builtChuan)).toBe("ce0cd4d8983532c920cab7713dc51874f6d710c2c46c4a095167bfa980becdb0");
    expect(builtChuan.toString("utf8")).toBe(STOCK_TEXT);
  });

  test("assembleBundle(): 2 lát ghép = NGUYÊN VĂN stock + chia đúng ranh giới //#region", () => {
    const assembled = assembleBundle();
    expect(Buffer.byteLength(assembled, "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect(Buffer.from(assembled, "utf8").equals(Buffer.from(STOCK_TEXT, "utf8"))).toBe(true);
    expect(assembled).toBe(STOCK_TEXT);
    expect(assembled.endsWith(EOL)).toBe(true);
    expect(PART_FILES).toEqual(["part-00.ts", "part-01.ts"]);
    const lineCounts = PART_FILES.map((file) => readFileSync(join(PKG, "src", "parts", file), "utf8").split(EOL).length - 1);
    expect(lineCounts).toEqual([37, 86]);
    for (const count of lineCounts) expect(count).toBeLessThanOrEqual(1000);
    const first = stripSliceScaffold(readFileSync(join(PKG, "src", "parts", "part-00.ts"), "utf8"), "part-00.ts");
    const second = stripSliceScaffold(readFileSync(join(PKG, "src", "parts", "part-01.ts"), "utf8"), "part-01.ts");
    expect(first[first.length - 1]).toBe("//#endregion");
    expect(second[0]).toBe("//#region lib/types/index.js");
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

describe("bề mặt export runtime A/B", () => {
  test("cùng ĐÚNG 3 tên export {apply,inject,name} — KHÔNG Config, KHÔNG default", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(Object.keys(ours)).toHaveLength(3);
    expect("Config" in ours).toBe(false);
    expect("default" in ours).toBe(false);
  });

  test("name/inject trùng giá trị hai bên", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-cordis");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["tools", "cordisInspect"]);
    expect(ours.inject).not.toContain("systemPrompt");
  });
});

describe("Config: gói gốc KHÔNG export Config schema", () => {
  test("String(Config) hai bên đều \"undefined\" (bản gốc không có Config)", () => {
    expect("Config" in stock).toBe(false);
    expect(String(ours.Config)).toBe(String(stock.Config));
    expect(String(ours.Config)).toBe("undefined");
  });

  test("apply bỏ qua config: 7 biến thể cho CÙNG bề mặt đăng ký A≡B", async () => {
    const variants: unknown[] = [undefined, {}, { enabled: false, limit: 0 }, { nested: { deep: true } }, null, "ignored", 42];
    for (const config of variants) {
      const a = await mount(ours, { config });
      const b = await mount(stock, { config });
      expect(a.error).toBeNull();
      expect(b.error).toBeNull();
      expect(a.tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
      expect(JSON.stringify(a.tools.map(specOf))).toBe(JSON.stringify(b.tools.map(specOf)));
    }
    expect(variants.length).toBeGreaterThanOrEqual(5);
  });
});

describe("apply trên Context cordis THẬT với seam GIẢ", () => {
  test("đăng ký đúng 2 tool: name/description/parameters/output/presentCall A≡B (bản gốc không có section)", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
    expect(JSON.stringify(a.tools.map(specOf))).toBe(JSON.stringify(b.tools.map(specOf)));
    const list = toolOf(a, "cordis_inspect_list");
    const query = toolOf(a, "cordis_inspect_query");
    expect(list.parameters).toEqual({ type: "object", properties: {} });
    expect(asRecord(query.parameters)).toMatchObject({ type: "object", required: ["platform", "provider", "method"] });
    expect(query.description).toContain("Host queries run locally");
    expect(query.description).toContain("configured timeout");
    expect(list.description).toContain("List every Cordis Inspect Provider");
    expect(list.presentCall({})).toEqual({ card: "generic", kind: "read", title: "List Cordis Inspect Providers" });
    expect(query.presentCall(QUERY_ARGS)).toEqual({ card: "generic", kind: "read", title: "Query Cordis host Service.listService" });
    expect(query.presentCall({ platform: "client", provider: "UI", method: "slots" })).toEqual({
      card: "generic",
      kind: "read",
      title: "Query Cordis client UI.slots",
    });
    expect(a.ctx.get("systemPrompt")).toBeUndefined();
  });

  test("cordis_inspect_list: trả {providers} từ seam GIẢ + render JSON A≡B", async () => {
    const providers = [{ manifest: { id: "Service" } }, { manifest: { id: "Tool" } }];
    const a = await mount(ours, { providers });
    const b = await mount(stock, { providers });
    const exec = makeExec({ name: "cordis_inspect_list" });
    const valueA = await toolOf(a, "cordis_inspect_list").execute({}, exec);
    const valueB = await toolOf(b, "cordis_inspect_list").execute({}, exec);
    expect(valueA).toEqual({ providers });
    expect(JSON.stringify(valueA)).toBe(JSON.stringify(valueB));
    const rendered = toolOf(a, "cordis_inspect_list").output.render({}, valueA);
    expect(rendered).toEqual([{ type: "text", text: JSON.stringify(valueA, null, 2) }]);
    expect(JSON.stringify(rendered)).toBe(JSON.stringify(toolOf(b, "cordis_inspect_list").output.render({}, valueB)));
  });

  test("cordis_inspect_query: seam nhận ĐÚNG 6 tham số (platform/provider/method/input/agent/signal) + envelope A≡B", async () => {
    const agent = { session: { id: "s1" } };
    const exec = makeExec({ agent });
    const a = await mount(ours);
    const b = await mount(stock);
    const valueA = await toolOf(a, "cordis_inspect_query").execute(QUERY_ARGS, exec);
    const valueB = await toolOf(b, "cordis_inspect_query").execute(QUERY_ARGS, exec);
    expect(a.calls).toHaveLength(1);
    expect(a.calls[0]).toHaveLength(6);
    expect(a.calls[0]?.[0]).toBe("host");
    expect(a.calls[0]?.[1]).toBe("Service");
    expect(a.calls[0]?.[2]).toBe("listService");
    expect(a.calls[0]?.[3]).toEqual({ service: "agent" });
    expect(a.calls[0]?.[4]).toBe(agent);
    expect(a.calls[0]?.[5]).toBe(exec.signal);
    expect(valueA).toEqual({ platform: "host", provider: "Service", method: "listService", data: { argc: 6 } });
    expect(JSON.stringify(valueA)).toBe(JSON.stringify(valueB));
    expect(a.calls[0]?.length).toBe(b.calls[0]?.length);
  });

  test("query thiếu agent ⇒ lỗi Agent-backed; thiếu field ⇒ ToolArgsError A≡B", async () => {
    const a = await mount(ours);
    const b = await mount(stock);
    const noAgentA = await outcome(() => toolOf(a, "cordis_inspect_query").execute(QUERY_ARGS, makeExec()));
    const noAgentB = await outcome(() => toolOf(b, "cordis_inspect_query").execute(QUERY_ARGS, makeExec()));
    expect(noAgentA).toBe(noAgentB);
    expect(noAgentA).toContain("Error|Cordis inspection requires an Agent-backed session");
    const missingA = await outcome(() => toolOf(a, "cordis_inspect_query").execute({ platform: "host" }, makeExec({ agent: {} })));
    const missingB = await outcome(() => toolOf(b, "cordis_inspect_query").execute({ platform: "host" }, makeExec({ agent: {} })));
    expect(missingA).toBe(missingB);
    expect(missingA).toContain("ToolArgsError|invalid arguments");
    expect(missingA).toContain("provider");
  });

  test("seam query lỗi/timeout ⇒ lỗi lan truyền nguyên văn A≡B", async () => {
    const timeout = new Error("Cordis inspect query timed out after 3000ms");
    timeout.name = "TimeoutError";
    const options: MountOptions = { query: async () => { throw timeout; } };
    const a = await mount(ours, options);
    const b = await mount(stock, options);
    const exec = makeExec({ agent: {} });
    const timeoutA = await outcome(() => toolOf(a, "cordis_inspect_query").execute(QUERY_ARGS, exec));
    const timeoutB = await outcome(() => toolOf(b, "cordis_inspect_query").execute(QUERY_ARGS, exec));
    expect(timeoutA).toBe(timeoutB);
    expect(timeoutA).toBe("nem:TimeoutError|Cordis inspect query timed out after 3000ms");
  });

  test("seam query bị abort ⇒ AbortError lan truyền + signal đã abort A≡B", async () => {
    const controller = new AbortController();
    controller.abort();
    const abort = new DOMException("The operation was aborted.", "AbortError");
    const options: MountOptions = { query: async () => { throw abort; } };
    const a = await mount(ours, options);
    const b = await mount(stock, options);
    const exec = makeExec({ agent: {}, signal: controller.signal });
    expect(exec.signal.aborted).toBe(true);
    const abortA = await outcome(() => toolOf(a, "cordis_inspect_query").execute(QUERY_ARGS, exec));
    const abortB = await outcome(() => toolOf(b, "cordis_inspect_query").execute(QUERY_ARGS, exec));
    expect(abortA).toBe(abortB);
    expect(abortA).toBe("nem:AbortError|The operation was aborted.");
    expect(a.calls[0]?.[5]).toBe(controller.signal);
  });

  test("seam list lỗi ⇒ promise reject A≡B", async () => {
    const options: MountOptions = { listError: new Error("inspect registry offline") };
    const a = await mount(ours, options);
    const b = await mount(stock, options);
    const listA = await outcome(() => toolOf(a, "cordis_inspect_list").execute({}, makeExec()));
    const listB = await outcome(() => toolOf(b, "cordis_inspect_list").execute({}, makeExec()));
    expect(listA).toBe(listB);
    expect(listA).toBe("nem:Error|inspect registry offline");
  });

  test("seam query trả undefined ⇒ envelope vẫn giữ khoá data A≡B", async () => {
    const options: MountOptions = { query: async () => undefined };
    const a = await mount(ours, options);
    const b = await mount(stock, options);
    const exec = makeExec({ agent: {} });
    const valueA = asRecord(await toolOf(a, "cordis_inspect_query").execute(QUERY_ARGS, exec));
    const valueB = asRecord(await toolOf(b, "cordis_inspect_query").execute(QUERY_ARGS, exec));
    expect(Object.keys(valueA)).toEqual(["platform", "provider", "method", "data"]);
    expect("data" in valueA).toBe(true);
    expect(valueA["data"]).toBeUndefined();
    expect(Object.keys(valueA)).toEqual(Object.keys(valueB));
    expect(JSON.stringify(valueA)).toBe(JSON.stringify(valueB));
  });

  test("plugin qua vòng đời cordis THẬT: đủ service ⇒ 2 tool, thiếu service ⇒ 0 tool A≡B", async () => {
    const onA = await pluginSnapshot(ours, true);
    const onB = await pluginSnapshot(stock, true);
    expect(JSON.stringify(onA)).toBe(JSON.stringify(onB));
    expect(onA["tools"]).toEqual(TOOL_NAMES);
    const offA = await pluginSnapshot(ours, false);
    const offB = await pluginSnapshot(stock, false);
    expect(JSON.stringify(offA)).toBe(JSON.stringify(offB));
    expect(offA["tools"]).toEqual([]);
  });
});

describe("subpath ./host: 6 tệp JS + provider", () => {
  test("6 tệp lib/types/*.js byte-identical + cùng sha256 + đúng tổng bytes", () => {
    expect([...HOST_TYPES_FILES].sort()).toEqual(["api-catalog.js", "config.js", "host.js", "index.js", "present.js", "providers.js"]);
    let total = 0;
    for (const name of HOST_TYPES_FILES) {
      const mine = readFileSync(join(PKG, "lib", "types", name));
      const theirs = readFileSync(join(REPO, STOCK_TYPES_DIR, name));
      expect(mine.equals(theirs)).toBe(true);
      expect(sha256(mine)).toBe(sha256(theirs));
      total += mine.length;
    }
    expect(HOST_TYPES_FILES).toHaveLength(6);
    expect(total).toBe(HOST_TYPES_BYTES);
  });

  test("import lib/types/host.js với ctx GIẢ có cordisInspect+tools: 4 provider A≡B", async () => {
    const a = await mountHost(oursHost);
    const b = await mountHost(stockHost);
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(oursHost.name).toBe(stockHost.name);
    expect(oursHost.name).toBe("cordis-inspect-providers");
    expect(oursHost.inject).toEqual(stockHost.inject);
    expect(oursHost.inject).toEqual(["cordisInspect", "tools"]);
    expect(a.providers.map((provider) => provider.manifest.id)).toEqual(["Service", "Event", "Config", "Tool"]);
    expect(JSON.stringify(a.providers.map((provider) => provider.manifest))).toBe(JSON.stringify(b.providers.map((provider) => provider.manifest)));
  });

  test("provider Tool.listTools gọi ctx.tools.schemas(agent); method lạ ⇒ lỗi A≡B", async () => {
    const a = await mountHost(oursHost);
    const b = await mountHost(stockHost);
    const agent = { session: { id: "s1" } };
    const valueA = await providerOf(a, "Tool").query("listTools", {}, { agent });
    const valueB = await providerOf(b, "Tool").query("listTools", {}, { agent });
    expect(valueA).toEqual({ tools: [{ name: "read" }] });
    expect(JSON.stringify(valueA)).toBe(JSON.stringify(valueB));
    expect(a.schemasCalls[0]).toBe(agent);
    expect(b.schemasCalls[0]).toBe(agent);
    const badA = await outcome(() => providerOf(a, "Tool").query("nope", {}, { agent }));
    const badB = await outcome(() => providerOf(b, "Tool").query("nope", {}, { agent }));
    expect(badA).toBe(badB);
    expect(badA).toBe('nem:Error|unknown Tool inspect method "nope"');
  });

  test("Service/Event method lạ + Config thiếu Loader ⇒ lỗi rõ ràng A≡B", async () => {
    const a = await mountHost(oursHost);
    const b = await mountHost(stockHost);
    const serviceA = await outcome(() => providerOf(a, "Service").query("nope", {}));
    const serviceB = await outcome(() => providerOf(b, "Service").query("nope", {}));
    expect(serviceA).toBe(serviceB);
    expect(serviceA).toBe('nem:Error|unknown Service inspect method "nope"');
    const eventA = await outcome(() => providerOf(a, "Event").query("nope", {}));
    const eventB = await outcome(() => providerOf(b, "Event").query("nope", {}));
    expect(eventA).toBe(eventB);
    expect(eventA).toContain("unknown Event inspect method");
    const configA = await outcome(() => providerOf(a, "Config").query("listConfigs", {}));
    const configB = await outcome(() => providerOf(b, "Config").query("listConfigs", {}));
    expect(configA).toBe(configB);
    expect(configA).toContain("Config inspection requires the Loader that mounted this profile");
  });

  test("hiệu ứng cordis THẬT: đăng ký 4 provider, dispose ⇒ 0 provider A≡B", async () => {
    const a = await mountHost(oursHost);
    const b = await mountHost(stockHost);
    expect(a.providers).toHaveLength(4);
    expect(b.providers).toHaveLength(4);
    if (a.fiber === undefined || b.fiber === undefined) throw new Error("thieu fiber host");
    await a.fiber.dispose();
    await b.fiber.dispose();
    expect(a.providers).toHaveLength(0);
    expect(b.providers).toHaveLength(0);
    expect(a.fiber.state).toBe(4);
    expect(b.fiber.state).toBe(4);
  });
});

/** Đường dẫn dump parity MỚI NHẤT trong repo có oracleA_nopatch.yml (nguồn đo cấu trúc row). */
function latestParityDump(): string {
  const root = join(REPO, ".parity", "dumps");
  if (!existsSync(root)) throw new Error("khong thay .parity/dumps");
  const dirs = readdirSync(root)
    .filter((name) => existsSync(join(root, name, "oracleA_nopatch.yml")))
    .sort();
  const last = dirs[dirs.length - 1];
  if (last === undefined) throw new Error("khong thay dump oracle trong .parity/dumps");
  return join(root, last, "oracleA_nopatch.yml");
}

/** Một entry `- id:` đọc từ dump, kèm thụt lề và các khoá cấp 1. */
interface DumpEntry {
  /** Số dòng 1-based của dòng `- id:`. */
  line: number;
  /** Số khoảng trắng trước dấu `-` (0 = top-level). */
  indent: number;
  /** Id row. */
  id: string;
  /** Giá trị `name:` cùng cấp, nếu có. */
  name?: string;
  /** Các khoá cấp 1 (thụt lề = indent + 2), đúng thứ tự xuất hiện. */
  keys: string[];
}

/**
 * Cắt MỌI entry `- id:` của dump theo THỤT LỀ, không đoán theo thứ tự: entry kết thúc ở dòng
 * `- id:` kế tiếp có thụt lề ≤ của nó (hoặc dòng không phải list thụt nông hơn).
 * Nhận: text — nội dung dump YAML.
 * Trả: mảng entry theo đúng thứ tự xuất hiện trong file.
 */
function dumpEntries(text: string): DumpEntry[] {
  const lines = text.split(EOL);
  const out: DumpEntry[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const head = /^(\s*)- id:\s*(.*)$/.exec(lines[index] ?? "");
    if (head === null) continue;
    const indent = (head[1] ?? "").length;
    const entry: DumpEntry = {
      line: index + 1,
      indent,
      id: (head[2] ?? "").trim().replace(/^['"]|['"]$/g, ""),
      keys: [],
    };
    let end = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] ?? "";
      const lineIndent = line.length - line.trimStart().length;
      if (/^\s*- id:/.test(line) && lineIndent <= indent) {
        end = cursor;
        break;
      }
      if (line.trim() !== "" && lineIndent < indent) {
        end = cursor;
        break;
      }
    }
    const keyIndent = indent + 2;
    for (let cursor = index + 1; cursor < end; cursor += 1) {
      const line = lines[cursor] ?? "";
      if (line.length - line.trimStart().length !== keyIndent) continue;
      const key = /^([A-Za-z_][A-Za-z0-9_-]*):/.exec(line.trimStart());
      if (key?.[1] === undefined) continue;
      entry.keys.push(key[1]);
      if (key[1] === "name") {
        entry.name = line.trim().slice("name:".length).trim().replace(/^['"]|['"]$/g, "");
      }
    }
    out.push(entry);
  }
  return out;
}

describe("metadata gói + locale", () => {
  test("package.json: exports mirror stock (bỏ types/./src/*), peers CHÉP JSON, nested preset-cordis, KHÔNG gbh.row", () => {
    const mine = asRecord(JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as unknown);
    const their = asRecord(JSON.parse(readFileSync(join(REPO, STOCK_PACKAGE_JSON), "utf8")) as unknown);
    expect(mine["name"]).toBe(PACKAGE_NAME);
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-tool-cordis");
    expect(mine["private"]).toBe(true);
    expect(mine["type"]).toBe("module");
    expect(mine["main"]).toBe("lib/index.js");
    expect("types" in mine).toBe(false);
    const exportsMine = asRecord(mine["exports"]);
    const exportsTheirs = asRecord(their["exports"]);
    const stockSubpaths = Object.keys(exportsTheirs).filter((key) => key !== "./src/*");
    expect(Object.keys(exportsMine).sort()).toEqual([...stockSubpaths].sort());
    // 08/11/2026 (Lead): "." nay là OBJECT có điều kiện `types` (lib/types/index.d.ts CÓ THẬT) — cần cho consumer
    //   TS resolve theo id gói; bất biến thật là ĐÍCH RUNTIME `default` phải trùng stock. Khoá chặt hơn: object + default.
    expect(exportsMine["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(exportsMine["./host"]).toBe("./lib/types/host.js");
    expect(exportsMine["./host"]).toBe(asRecord(exportsTheirs["./host"])["default"]);
    expect(exportsMine["./host/locale/*.json"]).toBe(exportsTheirs["./host/locale/*.json"]);
    expect(exportsMine["./locale/*.json"]).toBe(exportsTheirs["./locale/*.json"]);
    expect(exportsMine["./package.json"]).toBe("./package.json");
    // 08/11/2026 (Lead): luật cũ "KHÔNG subpath nào có `types`" đã bị thay bằng luật CHẶT HƠN: nếu có `types` thì
    //   tệp đó PHẢI TỒN TẠI (cổng exports-targets canh toàn cây), còn đích RUNTIME `default` phải trùng stock.
    for (const [khoa, value] of Object.entries(exportsMine)) {
      if (typeof value === "string") continue;
      const obj = asRecord(value);
      const goc = exportsTheirs[khoa];
      if ("default" in obj) expect(obj["default"]).toBe(typeof goc === "string" ? goc : asRecord(goc)["default"]);
      if ("types" in obj) expect(existsSync(join(PKG, String(obj["types"])))).toBe(true);
    }
    expect(mine["peerDependencies"]).toEqual(their["peerDependencies"]);
    const peers = Object.keys(asRecord(mine["peerDependencies"]));
    const deps = Object.keys(asRecord(mine["dependencies"] ?? {}));
    expect(peers).toHaveLength(6);
    const gbh = asRecord(mine["gbh"]);
    expect(gbh["row"]).toBeUndefined();
    expect(gbh["peers"]).toEqual([...peers, ...deps]);
    expect(gbh["tests"]).toEqual(["tests/host/tool-cordis.test.ts"]);
    expect(gbh["nested"]).toEqual({
      kind: "preset",
      pluginId: "tool-cordis",
      stockId: STOCK_PACKAGE_NAME,
      presets: ["preset-cordis"],
    });
  });

  test("dump parity: KHÔNG có row TOP-LEVEL tool-cordis; đúng MỘT entry LỒNG trong preset-cordis, chỉ id+name", () => {
    const entries = dumpEntries(readFileSync(latestParityDump(), "utf8"));
    const topLevel = entries.filter((entry) => entry.id === "tool-cordis" && entry.indent === 0);
    const nested = entries.filter((entry) => entry.id === "tool-cordis" && entry.indent > 0);
    expect(topLevel).toHaveLength(0);
    expect(nested).toHaveLength(1);
    const entry = nested[0];
    if (entry === undefined) throw new Error("thieu entry long tool-cordis");
    expect(entry.indent).toBe(6);
    expect(entry.name).toBe(STOCK_PACKAGE_NAME);
    expect(entry.keys).toEqual(["name"]);
    const enclosing = entries.filter((candidate) => candidate.indent === 0 && candidate.line < entry.line).at(-1);
    expect(enclosing?.id).toBe("preset-cordis");
    const host = entries.find((candidate) => candidate.indent === 0 && candidate.name === STOCK_PACKAGE_NAME + "/host");
    expect(host?.id).toBe("cordis-inspect-providers");
    expect(host?.id).not.toBe("tool-cordis");
    expect(host?.keys).toEqual(["name"]);
  });

  test("manifest: CHỈ khai gbh.nested (KHÔNG gbh.row/row_unmounted_ly_do), presets đúng, draft ghi dòng 1418", () => {
    const gbh = asRecord(asRecord(JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as unknown)["gbh"]);
    expect(gbh["row"]).toBeUndefined();
    expect(gbh["row_unmounted_ly_do"]).toBeUndefined();
    const nested = asRecord(gbh["nested"]);
    expect(nested).toEqual({
      kind: "preset",
      pluginId: "tool-cordis",
      stockId: STOCK_PACKAGE_NAME,
      presets: ["preset-cordis"],
    });
    expect("config" in nested).toBe(false);
    expect("inject" in nested).toBe(false);
    expect("disabled" in nested).toBe(false);
    const draft = String(gbh["draft"] ?? "");
    expect(draft).toContain("1418");
    expect(draft).toContain("preset-cordis");
    expect(draft).toContain("CHƯA mount/flip");
    expect(draft).toContain("KHÔNG có row TOP-LEVEL");
    expect(draft).toContain("KHÔNG có khác biệt disabled");
  });

  test("manifest: gbh.provenance khớp stock (stock + version + sha256 bundle chính)", () => {
    const gbh = asRecord(asRecord(JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as unknown)["gbh"]);
    const provenance = asRecord(gbh["provenance"]);
    const stockJson = asRecord(JSON.parse(readFileSync(join(REPO, STOCK_PACKAGE_JSON), "utf8")) as unknown);
    expect(provenance["stock"]).toBe(STOCK_PACKAGE_NAME);
    expect(provenance["version"]).toBe(stockJson["version"]);
    expect(provenance["sha"]).toBe(sha256(STOCK_BYTES));
  });

  test("locale/**: ĐÚNG cây con của stock, 4 tệp byte-identical + cùng sha256", () => {
    const stockFiles = walkFiles(join(REPO, STOCK_LOCALE_DIR));
    const ourFiles = walkFiles(join(PKG, "locale"));
    // 20/10/2026: gói ta có THÊM locale/vi.json (bản dịch tiếng Việt CÓ CHỦ ĐÍCH) ⇒ so phần CÒN LẠI với stock
    // và xác nhận đúng một tệp vi.json ở gốc locale.
    expect(ourFiles.filter((file) => file !== "vi.json")).toEqual(stockFiles);
    expect(ourFiles).toEqual([...new Set([...stockFiles, "vi.json"])].sort());
    expect(ourFiles).toContain("vi.json");
    for (const name of stockFiles) {
      const mine = readFileSync(join(PKG, "locale", name));
      const theirs = readFileSync(join(REPO, STOCK_LOCALE_DIR, name));
      expect(mine.equals(theirs)).toBe(true);
      expect(sha256(mine)).toBe(sha256(theirs));
    }
  });

  test("node_modules: require.resolve mọi peer/dep từ gói đều OK + dải khai báo PHỦ đúng bản kernel", () => {
    const mine = asRecord(JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as unknown);
    const declaredPeer = asRecord(mine["peerDependencies"]);
    const specs = [...Object.keys(declaredPeer), ...Object.keys(asRecord(mine["dependencies"] ?? {}))];
    const requireFromPkg = createRequire(join(PKG, "package.json"));
    for (const spec of specs) {
      const resolved = requireFromPkg.resolve(spec);
      expect(existsSync(resolved)).toBe(true);
      // Ghi chú 01/11/2026: phép so CŨ đòi đường dẫn phân giải nằm trong apps/host/node_modules. Layout
      // node_modules do `bun install` quyết định — cây hiện tại trỏ node_modules/.bun cho MỌI gói trong
      // workspace (đo cả jobs-local/approval/session), nên phép so đó báo đỏ một cây CÀI ĐÚNG. Hợp đồng mà
      // GÓI kiểm soát được là KHAI BÁO: dải version trong manifest phải PHỦ đúng phiên bản kernel đang chạy.
      // Không rỗng: khai lệch (vd 0.2.1-rc.5 khi kernel là 0.2.1-alpha.4) vẫn ĐỎ.
      const kernelVersion = (JSON.parse(readFileSync(join(REPO, "apps", "host", "node_modules", spec, "package.json"), "utf8")) as {
        version: string;
      }).version;
      expect(Bun.semver.satisfies(kernelVersion, String(declaredPeer[spec] ?? asRecord(mine["dependencies"] ?? {})[spec]))).toBe(true);
    }
    expect(requireFromPkg.resolve("@deepseek-ai/dsh-tools")).toContain("@deepseek-ai/dsh-tools");
  });
});