/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-host-tools: đo trên src + ARTIFACT đã build và so
 *      từng hành vi với CHÍNH bundle gốc @deepseek-ai/dsh-tools (defineTool/validateArgs, JSON schema,
 *      SDK TS/Py, hằng số, năm lớp lỗi, mặt export, manifest PARKED, an toàn mount, boot cordis THẬT).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import * as ours from "../../packages/host/tools/src/index.ts";
import { buildPackage } from "../../packages/host/tools/build.ts";

/** Thư mục gốc repo blackhole-tauri. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package tools của ta (manifest + build tạm). */
const PKG = join(ROOT, "packages", "host", "tools");
/** Thư mục build tạm nằm TRONG package để peer dependency phân giải được. */
const OUT = join(PKG, ".test-lib");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_LIB = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tools", "lib", "index.js");
/** cordis THẬT mà cả hai bản dùng (cùng một realpath qua symlink của package). */
const CORDIS_LIB = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Module nguồn của ta (mọi phép so chức năng). */
const port: any = ours;
/** Bundle gốc làm oracle. */
const stock: any = await import(STOCK_LIB);
/** cordis thật để dựng Context cho ca mount. */
const cordis: any = await import(CORDIS_LIB);
/** SystemPrompt + bộ mint scope THẬT của kernel (nạp theo đường dẫn, không gọi mạng). */
const PROMPT_LIB = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-system-prompt", "lib", "index.js");
const SCOPE_LIB = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
const prompt: any = await import(PROMPT_LIB);
const scopeKit: any = await import(SCOPE_LIB);
/** Bộ mint phạm vi của CHÍNH package ta (workspace): `dsh-scope` gắn khoá bằng `Symbol("dsh.scope")` — Symbol
 * CỤC BỘ MÔ-ĐUN, không phải `Symbol.for`, nên hai cây cài (hai tệp riêng, nội dung y hệt) không thấy phạm vi
 * của nhau ⇒ mỗi bên phải mint phạm vi bằng ĐÚNG bản scope mà chính nó nạp. */
const OUR_SCOPE_LIB = join(PKG, "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
const ourScopeKit: any = await import(OUR_SCOPE_LIB);
/** Ký tự backtick, dùng để so văn bản SDK mà không phải nhúng literal vào mã sinh. */
const BT = String.fromCharCode(96);

/** Hình dạng so sánh được của một ngoại lệ (name/code/message/violations). */
interface ThrownShape {
  /** Tên lớp lỗi. */
  name: string;
  /** Mã HarnessError. */
  code: string;
  /** Thông điệp người đọc được. */
  message: string;
  /** Danh sách vi phạm, nếu lớp lỗi có. */
  violations?: unknown;
}

/**
 * Chạy một phép gọi và bắt ngoại lệ thành hình dạng so sánh được.
 * Nhận: run — phép gọi đồng bộ hoặc bất đồng bộ.
 * Trả: name/code/message/violations; đánh dấu "(khong nem)" khi không ném.
 */
async function rejectionOf(run: () => unknown | Promise<unknown>): Promise<ThrownShape> {
  try {
    await run();
    return { name: "(khong nem)", code: "", message: "" };
  } catch (error) {
    const thrown = error as { name?: string; code?: string; message?: string; violations?: unknown };
    return {
      name: thrown.name ?? "",
      code: thrown.code ?? "",
      message: thrown.message ?? "",
      ...(thrown.violations === undefined ? {} : { violations: thrown.violations }),
    };
  }
}

/** Một mục prompt đã đăng ký lên seam systemPrompt (chỉ trường so sánh được). */
interface SectionLog {
  /** Tên mục prompt. */
  name: string;
  /** Thứ tự mục. */
  order: number;
  /** Cờ nội suy, nếu mục khai. */
  interpolate?: boolean;
}

/** Vết đăng ký lên seam systemPrompt trong một lượt boot. */
interface PromptLog {
  /** Số lần đăng ký provider schema tool. */
  toolsProviders: number;
  /** Các mục prompt đã đăng ký. */
  sections: SectionLog[];
  /** Các tên mục đã hỏi thứ tự. */
  orders: string[];
}

/** Kết quả một lượt boot service trên Context cordis THẬT. */
interface Boot {
  /** Context sở hữu service. */
  ctx: any;
  /** Thực thể service tools. */
  svc: any;
  /** Vết đăng ký prompt. */
  log: PromptLog;
}

/**
 * Dựng một service trên Context cordis THẬT với seam systemPrompt ghi vết.
 * Nhận: plugin — lớp service cần mount (ta hoặc gốc); config — cấu hình truyền cho plugin.
 * Trả: Context, thực thể tools và vết đăng ký prompt.
 */
async function boot(plugin: any, config: Record<string, unknown>): Promise<Boot> {
  const ctx: any = new cordis.Context();
  const log: PromptLog = { toolsProviders: 0, sections: [], orders: [] };
  ctx.provide("systemPrompt", {
    tools: (_provider: unknown) => {
      log.toolsProviders += 1;
      return () => {};
    },
    section: (section: any) => {
      log.sections.push({ name: section.name, order: section.order, ...(section.interpolate === undefined ? {} : { interpolate: section.interpolate }) });
      return () => {};
    },
    getSectionOrder: (name: string) => {
      log.orders.push(name);
      return name === "PTC_ONLY" ? 90 : 100;
    },
  });
  ctx.plugin(plugin, config);
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { ctx, svc: ctx.get("tools"), log };
}

/**
 * Dựng một tool echo cho một trong hai module (ta/gốc).
 * Nhận: module — module chứa defineTool.
 * Trả: định nghĩa tool echo có schema đầu ra object đóng.
 */
function echoTool(module: any): any {
  return module.defineTool({
    name: "echo",
    description: "Echo the input text.",
    parameters: { text: { type: "string", required: true } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { echoed: { type: "string", required: true } },
      },
      render: (_args: unknown, value: any) => [{ type: "text", text: value.echoed }],
    },
    execute: async (args: any) => ({ echoed: args.text }),
  });
}

/** Tín hiệu huỷ mới cho mỗi lời gọi tool. */
function signal(): AbortSignal {
  return new AbortController().signal;
}

/**
 * Thu mọi tệp nguồn dưới một thư mục, bỏ qua thư mục dẫn xuất.
 * Nhận: dir — gốc duyệt.
 * Trả: đường dẫn tuyệt đối của tệp .ts/.tsx/.js/.jsx.
 */
async function sourceFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (["node_modules", "lib", "dist", ".test-lib", "target"].includes(entry.name)) continue;
      found.push(...(await sourceFiles(join(dir, entry.name))));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) found.push(join(dir, entry.name));
  }
  return found;
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row tools — mặt export, artifact và manifest", () => {
  test("mặt export nguồn: 23 tên khớp bản gốc, default = ToolRuntime, inject + Config", () => {
    const ourKeys = Object.keys(port).sort();
    expect(ourKeys).toEqual(Object.keys(stock).sort());
    expect(ourKeys.length).toBe(23);
    expect(port.default).toBe(port.ToolRuntime);
    expect(stock.default).toBe(stock.ToolRuntime);
    expect(port.ToolRuntime.inject).toEqual(stock.ToolRuntime.inject);
    expect(port.ToolRuntime.inject).toEqual(["systemPrompt"]);
    expect(String(port.ToolRuntime.Config)).toBe(String(stock.ToolRuntime.Config));
    expect(String(port.ToolRuntime.Config)).toBe('{ mode?: "native" | "ptc", maxParallelSubCalls?: number }');
  });

  test("ARTIFACT: de-bundle 1:1 — buildPackage CHÉP nguyên cây lib/ và mặt export khớp bundle gốc", async () => {
    const files = await buildPackage(OUT);
    // task-186: artefact = bản gốc nguyên văn (index.js + lib/types/*.js), KHÔNG còn 3 tệp phẳng của bản viết tay.
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(OUT, "index.js"))).toBe(true);
    const artifact: any = await import(join(OUT, "index.js"));
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).length).toBe(23);
    expect(artifact.default).toBe(artifact.ToolRuntime);
    expect(artifact.ToolRuntime.inject).toEqual(["systemPrompt"]);
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as { main?: string };
    expect(manifest.main).toBe("lib/index.js");
  });

  test("hằng số: TOOL_ABORTED / BEFORE_DISPATCH / RUN_CODE_NAME / scheduler symbol khớp gốc", () => {
    expect(port.TOOL_ABORTED).toBe("ABORTED");
    expect(port.TOOL_ABORTED_BEFORE_DISPATCH).toBe("ABORTED_BEFORE_DISPATCH");
    expect(port.RUN_CODE_NAME).toBe("run_code");
    expect(port.TOOL_ABORTED).toBe(stock.TOOL_ABORTED);
    expect(port.TOOL_ABORTED_BEFORE_DISPATCH).toBe(stock.TOOL_ABORTED_BEFORE_DISPATCH);
    expect(port.RUN_CODE_NAME).toBe(stock.RUN_CODE_NAME);
    expect(String(port.TOOL_RUNTIME_SCHEDULER)).toBe(String(stock.TOOL_RUNTIME_SCHEDULER));
    expect(String(port.TOOL_RUNTIME_SCHEDULER)).toContain("dsh-tools.scheduler");
  });

  test("năm lớp lỗi public: name/code/message/violations khớp gốc", async () => {
    const cases: [string, (module: any) => unknown][] = [
      ["JsonSchemaError", (module) => new module.JsonSchemaError(["a", "b"])],
      ["ToolArgsError", (module) => new module.ToolArgsError(["missing x", "bad y"])],
      ["ToolNotFoundError", (module) => new module.ToolNotFoundError("nope")],
      ["ToolNotFoundError-route", (module) => new module.ToolNotFoundError("native_only", "call it inside run_code")],
      ["ToolOutputError", (module) => new module.ToolOutputError("echo", ["value.x must be a string"])],
      ["CodeRunFailedError", (module) => new module.CodeRunFailedError("program failed")],
    ];
    for (const [label, build] of cases) {
      const ourShape = await rejectionOf(() => { throw build(port); });
      const stockShape = await rejectionOf(() => { throw build(stock); });
      expect({ label, ...ourShape }).toEqual({ label, ...stockShape });
      expect(ourShape.code.length).toBeGreaterThan(0);
      expect(ourShape.name).not.toBe("(khong nem)");
    }
    const args = await rejectionOf(() => { throw new port.ToolArgsError(["x"]); });
    expect(args).toEqual({ name: "ToolArgsError", code: "INVALID_ARGS", message: "invalid arguments: x", violations: ["x"] });
    const output = await rejectionOf(() => { throw new port.ToolOutputError("t", ["v"]); });
    expect(output.code).toBe("INVALID_TOOL_OUTPUT");
    const notFound = await rejectionOf(() => { throw new port.ToolNotFoundError("t"); });
    expect(notFound.code).toBe("UNKNOWN_TOOL");
  });

  test("manifest: row ĐÃ FLIP đúng id tools, hostAliases/moduleIds/tests đã khai", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as {
      readonly gbh: {
        readonly row?: { readonly id?: string; readonly hostAliases?: readonly string[]; readonly moduleIds?: readonly string[]; readonly tests?: readonly string[] };
        readonly row_unmounted_ly_do?: unknown;
        readonly tests?: readonly string[];
      };
    };
    expect(manifest.gbh.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh.row?.id).toBe("tools");
    expect(manifest.gbh.row?.hostAliases).toEqual(["@deepseek-ai/dsh-tools"]);
    expect(manifest.gbh.row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-host-tools"]);
    expect(manifest.gbh.row?.tests).toEqual(["tests/host/tools.test.ts"]);
    expect(manifest.gbh.tests).toEqual(["tests/host/tools.test.ts"]);
  });
  test("an toàn mount: chỉ packages/host/tools/src/service.ts gọi super(ctx, tools)", async () => {
    const files = await sourceFiles(join(ROOT, "packages"));
    const pattern = /super\(\s*ctx\s*,\s*["']tools["']\s*\)/;
    const hits: string[] = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      if (pattern.test(text)) hits.push(file);
    }
    expect(hits.map((file) => file.slice(ROOT.length + 1))).toEqual(["packages/host/tools/src/service.ts"]);
    // Ca này đọc TOÀN BỘ cây packages/ (~4,3 s) — dưới tải song song, trần 5 s mặc định của bun là quá sát.
  }, 30_000);
});

describe("row tools — defineTool + validateArgs", () => {
  const parameters: any = {
    path: { type: "string", required: true, description: "duong dan" },
    limit: { type: "integer", enum: [1, 5, 10] },
    nested: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { type: "string", const: "fast", required: true },
        tags: { type: "array", items: { type: "string" } },
      },
      required: true,
    },
    choice: { oneOf: [{ type: "number" }, { type: "boolean" }], required: true },
  };

  test("defineTool: mặt định nghĩa + hai schema khớp bản gốc, deferLoading/timeoutMs giữ nguyên", () => {
    const options = {
      name: "probe",
      description: "Probe tool.",
      parameters,
      output: {
        schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean", required: true } } },
        render: (_args: any, value: any) => [{ type: "text", text: String(value.ok) }],
      },
      execute: async () => ({ ok: true }),
      deferLoading: true as const,
      timeoutMs: 25,
    };
    const ourTool = port.defineTool(options as any);
    const stockTool = stock.defineTool(options as any);
    expect(Object.keys(ourTool).sort()).toEqual(Object.keys(stockTool).sort());
    expect(ourTool.name).toBe("probe");
    expect(ourTool.description).toBe(stockTool.description);
    expect(ourTool.parameters).toEqual(stockTool.parameters);
    expect(ourTool.output.schema).toEqual(stockTool.output.schema);
    expect(ourTool.parameters).toEqual(port.parameterSchemaSpecToJsonSchema(parameters));
    expect(ourTool.output.schema).toEqual(port.valueSchemaSpecToJsonSchema(options.output.schema as any));
    expect(ourTool.deferLoading).toBe(true);
    expect(ourTool.timeoutMs).toBe(25);
    expect(stockTool.deferLoading).toBe(true);
    expect(stockTool.timeoutMs).toBe(25);
  });

  test("defineTool.execute: đúng trả giá trị, sai ném ToolArgsError khớp name/code/message/violations", async () => {
    const ourTool = port.defineTool({
      name: "probe",
      description: "Probe.",
      parameters,
      output: { schema: { type: "json" }, render: () => [] },
      execute: async (args: any) => args,
    } as any);
    const stockTool = stock.defineTool({
      name: "probe",
      description: "Probe.",
      parameters,
      output: { schema: { type: "json" }, render: () => [] },
      execute: async (args: any) => args,
    } as any);
    const good = { path: "/tmp", limit: 5, nested: { mode: "fast", tags: ["a"] }, choice: true };
    expect(await ourTool.execute(good, {})).toEqual(await stockTool.execute(good, {}));
    const ourError = await rejectionOf(() => ourTool.execute({ path: 7, choice: "no", nested: { mode: "slow" } }, {}));
    const stockError = await rejectionOf(() => stockTool.execute({ path: 7, choice: "no", nested: { mode: "slow" } }, {}));
    expect(ourError).toEqual(stockError);
    expect(ourError.name).toBe("ToolArgsError");
    expect(ourError.code).toBe("INVALID_ARGS");
    expect(ourError.violations).toEqual([
      '"path" must be a string',
      '"nested.mode" must be "fast"',
      '"choice" must match exactly one oneOf branch (matched 0)',
    ]);
    expect(ourError.message).toBe('invalid arguments: "path" must be a string; "nested.mode" must be "fast"; "choice" must match exactly one oneOf branch (matched 0)');
  });

  test("defineTool presenter kiểm MỀM: args lệch trả undefined, không ném; args đúng khớp gốc", async () => {
    const build = (module: any) => module.defineTool({
      name: "probe",
      description: "Probe.",
      parameters: { text: { type: "string", required: true } },
      output: { schema: { type: "json" }, render: () => [] },
      execute: async () => ({}),
      presentCall: (args: any) => ({ kind: "generic", title: "call " + args.text }),
      presentResult: (args: any, result: any) => ({ kind: "generic", title: args.text + ":" + String(result.isError) }),
    } as any);
    const ourTool = build(port);
    const stockTool = build(stock);
    expect(ourTool.presentCall({ text: "x" })).toEqual(stockTool.presentCall({ text: "x" }));
    expect(ourTool.presentResult({ text: "x" }, { isError: false })).toEqual(stockTool.presentResult({ text: "x" }, { isError: false }));
    expect(ourTool.presentCall({ text: 3 })).toBeUndefined();
    expect(stockTool.presentCall({ text: 3 })).toBeUndefined();
    expect(ourTool.presentResult({}, {})).toBeUndefined();
    expect(stockTool.presentResult({}, {})).toBeUndefined();
  });

  test("defineTool isConcurrencySafe kiểm mềm: chỉ true khi args hợp lệ", () => {
    const build = (module: any) => module.defineTool({
      name: "probe",
      description: "Probe.",
      parameters: { text: { type: "string", required: true } },
      output: { schema: { type: "json" }, render: () => [] },
      execute: async () => ({}),
      isConcurrencySafe: (args: any) => args.text === "ok",
    } as any);
    const ourTool = build(port);
    const stockTool = build(stock);
    expect(ourTool.isConcurrencySafe({ text: "ok" })).toBe(true);
    expect(stockTool.isConcurrencySafe({ text: "ok" })).toBe(true);
    expect(ourTool.isConcurrencySafe({ text: "no" })).toBe(false);
    expect(stockTool.isConcurrencySafe({ text: "no" })).toBe(false);
    expect(ourTool.isConcurrencySafe({ text: 3 })).toBe(false);
    expect(stockTool.isConcurrencySafe({ text: 3 })).toBe(false);
  });

  test("defineTool timeoutMs không hợp lệ: ném y hệt gốc cho 0/âm/Infinity/NaN", async () => {
    for (const timeoutMs of [0, -1, Infinity, NaN]) {
      const build = (module: any) => module.defineTool({
        name: "probe",
        description: "Probe.",
        parameters: {},
        output: { schema: { type: "json" }, render: () => [] },
        execute: async () => ({}),
        timeoutMs,
      } as any);
      const ourError = await rejectionOf(() => build(port));
      const stockError = await rejectionOf(() => build(stock));
      expect(ourError).toEqual(stockError);
      expect(ourError.message).toBe("defineTool(probe): timeoutMs must be a positive finite number");
    }
  });

  test("defineTool schema vi phạm DSL: ném JsonSchemaError khớp gốc (object lồng thiếu additionalProperties)", async () => {
    const build = (module: any) => module.defineTool({
      name: "probe",
      description: "Probe.",
      parameters: { nested: { type: "object" } },
      output: { schema: { type: "json" }, render: () => [] },
      execute: async () => ({}),
    } as any);
    const ourError = await rejectionOf(() => build(port));
    const stockError = await rejectionOf(() => build(stock));
    expect(ourError).toEqual(stockError);
    expect(ourError.name).toBe("JsonSchemaError");
    expect(ourError.code).toBe("UNSUPPORTED_SCHEMA");
    expect(ourError.message).toContain("parameters.nested.additionalProperties must be explicitly true or false");
  });

  test("defineContentToolFixture: hợp đồng mảng JSON + execute/render/lỗi args khớp gốc", async () => {
    const options = {
      name: "fixture_demo",
      description: "Fixture demo.",
      parameters: { text: { type: "string", required: true } },
      execute: async (args: any) => [{ type: "text", text: args.text }],
    };
    const ourFixture = port.defineContentToolFixture(options as any);
    const stockFixture = stock.defineContentToolFixture(options as any);
    expect(Object.keys(ourFixture).sort()).toEqual(Object.keys(stockFixture).sort());
    expect(ourFixture.output.schema).toEqual(stockFixture.output.schema);
    expect(await ourFixture.execute({ text: "hi" }, {})).toEqual(await stockFixture.execute({ text: "hi" }, {}));
    expect(ourFixture.output.render({}, [{ type: "text", text: "x" }])).toEqual(stockFixture.output.render({}, [{ type: "text", text: "x" }]));
    const ourError = await rejectionOf(() => ourFixture.execute({ text: 1 }, {}));
    const stockError = await rejectionOf(() => stockFixture.execute({ text: 1 }, {}));
    expect(ourError).toEqual(stockError);
    expect(ourError).toEqual({ name: "ToolArgsError", code: "INVALID_ARGS", message: 'invalid arguments: "text" must be a string', violations: ['"text" must be a string'] });
  });

  test("validateArgs: đúng trả rỗng; thiếu required trả đúng đường dẫn, khớp gốc", () => {
    expect(port.validateArgs(parameters, { path: "/tmp", choice: 3, nested: { mode: "fast" } })).toEqual([]);
    expect(port.validateArgs(parameters, { path: "/tmp", choice: 3, nested: { mode: "fast" } })).toEqual(stock.validateArgs(parameters, { path: "/tmp", choice: 3, nested: { mode: "fast" } }));
    const missing = port.validateArgs(parameters, { choice: 2 });
    expect(missing).toEqual(stock.validateArgs(parameters, { choice: 2 }));
    expect(missing).toEqual(['missing required property "path"', 'missing required property "nested"']);
  });

  test("validateArgs: sai kiểu + enum + const khớp từng chuỗi với gốc", () => {
    const args = { path: 3, limit: 7, choice: "no", nested: { mode: "slow" } };
    const violations = port.validateArgs(parameters, args);
    expect(violations).toEqual(stock.validateArgs(parameters, args));
    expect(violations).toEqual([
      '"path" must be a string',
      '"limit" must be one of [1,5,10]',
      '"nested.mode" must be "fast"',
      '"choice" must match exactly one oneOf branch (matched 0)',
    ]);
  });

  test("validateArgs: object/array lồng nhau trả đúng đường dẫn a.b[i], khớp gốc", () => {
    const spec: any = {
      rows: {
        type: "array",
        required: true,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { id: { type: "integer", required: true }, tags: { type: "array", items: { type: "string" } } },
        },
      },
      note: { type: "string" },
    };
    const args = { rows: [{ id: 1, tags: ["a", 2] }, { tags: [] }, 7] };
    const violations = port.validateArgs(spec, args);
    expect(violations).toEqual(stock.validateArgs(spec, args));
    expect(violations).toEqual([
      '"rows[0].tags[1]" must be a string',
      'missing required property "rows[1].id"',
      '"rows[2]" must be an object',
    ]);
    expect(port.validateArgs(spec, { rows: [], extra: true })).toEqual([]);
  });

  test("validateArgs: additionalProperties:false từ chối khoá lạ, khớp gốc", () => {
    const spec: any = { nested: { type: "object", additionalProperties: false, properties: { mode: { type: "string", required: true } }, required: true } };
    const extra = { nested: { mode: "x", extra: 1 } };
    expect(port.validateArgs(spec, extra)).toEqual(stock.validateArgs(spec, extra));
    expect(port.validateArgs(spec, extra)).toEqual(['"nested.extra" is not a declared property (additionalProperties: false)']);
    expect(port.validateArgs(spec, { nested: 5 })).toEqual(stock.validateArgs(spec, { nested: 5 }));
    expect(port.validateArgs(spec, { nested: 5 })).toEqual(['"nested" must be an object']);
  });

  test("validateArgs: oneOf đúng-một nhánh, 0 nhánh, 2 nhánh — khớp gốc", () => {
    expect(port.validateArgs(parameters, { path: "/x", choice: "no", nested: { mode: "fast" } })).toEqual(
      stock.validateArgs(parameters, { path: "/x", choice: "no", nested: { mode: "fast" } }),
    );
    expect(port.validateArgs(parameters, { path: "/x", choice: "no", nested: { mode: "fast" } })).toEqual([
      '"choice" must match exactly one oneOf branch (matched 0)',
    ]);
    const overlap = { flag: { oneOf: [{ type: "number" }, { type: "integer" }] } };
    expect(port.validateArgs(overlap as any, { flag: 3 })).toEqual(stock.validateArgs(overlap as any, { flag: 3 }));
    expect(port.validateArgs(overlap as any, { flag: 3 })).toEqual(['"flag" must match exactly one oneOf branch (matched 2)']);
  });
});

describe("row tools — JSON schema", () => {
  test("valueSchemaSpecToJsonSchema: scalar + annotation khớp gốc", () => {
    const specs: any[] = [
      { type: "string", description: "d", title: "t", default: "x", examples: ["y"] },
      { type: "number", const: 1.5 },
      { type: "integer", enum: [1, 2, 3] },
      { type: "boolean", const: true },
      { type: "null" },
      { type: "json", description: "anything" },
    ];
    for (const spec of specs) {
      expect(port.valueSchemaSpecToJsonSchema(spec)).toEqual(stock.valueSchemaSpecToJsonSchema(spec));
    }
    expect(port.valueSchemaSpecToJsonSchema({ type: "null" })).toEqual({ type: "null" });
    expect(port.valueSchemaSpecToJsonSchema({ type: "json", description: "anything" })).toEqual({ description: "anything" });
  });

  test("valueSchemaSpecToJsonSchema: array/object/oneOf khớp gốc", () => {
    const specs: any[] = [
      { type: "array", items: { type: "integer" } },
      { type: "array" },
      { type: "object", additionalProperties: false, properties: { a: { type: "string", required: true } } },
      { type: "object", additionalProperties: true },
      { oneOf: [{ type: "null" }, { type: "string" }] },
      { oneOf: [{ type: "string" }, { type: "object", additionalProperties: false, properties: {} }], description: "union" },
    ];
    for (const spec of specs) {
      expect(port.valueSchemaSpecToJsonSchema(spec)).toEqual(stock.valueSchemaSpecToJsonSchema(spec));
    }
    expect(port.valueSchemaSpecToJsonSchema({ type: "object", additionalProperties: false, properties: { a: { type: "string", required: true } } })).toEqual({
      type: "object",
      additionalProperties: false,
      properties: { a: { type: "string" } },
      required: ["a"],
    });
  });

  test("parameterSchemaSpecToJsonSchema: required + thứ tự khoá khớp gốc", () => {
    const spec: any = {
      zed: { type: "string", required: true },
      alpha: { type: "integer" },
      nested: { type: "object", additionalProperties: false, properties: { b: { type: "boolean", required: true } }, required: true },
    };
    const oursSchema = port.parameterSchemaSpecToJsonSchema(spec);
    expect(oursSchema).toEqual(stock.parameterSchemaSpecToJsonSchema(spec));
    expect(Object.keys(oursSchema.properties)).toEqual(["zed", "alpha", "nested"]);
    expect(oursSchema.required).toEqual(["zed", "nested"]);
    expect(oursSchema).toEqual({
      type: "object",
      properties: {
        zed: { type: "string" },
        alpha: { type: "integer" },
        nested: { type: "object", additionalProperties: false, properties: { b: { type: "boolean" } }, required: ["b"] },
      },
      required: ["zed", "nested"],
    });
  });

  test("assertSupportedJsonSchema: nhận hợp lệ, vi phạm ném JsonSchemaError khớp gốc", async () => {
    const valid: any[] = [{ type: "object" }, { type: "array" }, { type: "string", enum: ["a"] }, { oneOf: [{ type: "null" }, { type: "integer" }] }];
    for (const schema of valid) {
      expect(() => port.assertSupportedJsonSchema(schema)).not.toThrow();
      expect(() => stock.assertSupportedJsonSchema(schema)).not.toThrow();
    }
    const invalid: any[] = [
      { type: "strin" },
      { oneOf: [{ type: "string" }] },
      { type: "array", items: { type: "bogus" } },
      { type: "number", const: "x" },
      { type: "object", properties: { a: { type: "string" } }, required: ["b"] },
      { type: "string", enum: [] },
    ];
    for (const schema of invalid) {
      const ourError = await rejectionOf(() => port.assertSupportedJsonSchema(schema));
      const stockError = await rejectionOf(() => stock.assertSupportedJsonSchema(schema));
      expect({ schema, ...ourError }).toEqual({ schema, ...stockError });
      expect(ourError.name).toBe("JsonSchemaError");
      expect(ourError.code).toBe("UNSUPPORTED_SCHEMA");
      expect(Array.isArray(ourError.violations)).toBe(true);
      expect((ourError.violations as string[]).length).toBeGreaterThan(0);
    }
    const message = await rejectionOf(() => port.assertSupportedJsonSchema({ type: "strin" }));
    expect(message.message).toBe("unsupported JSON schema: schema.type must be one of object/array/string/number/integer/boolean/null");
  });

  test("assertObjectJsonSchema: từ chối gốc không object / schema hỏng, khớp gốc", async () => {
    expect(() => port.assertObjectJsonSchema({ type: "object", properties: {} })).not.toThrow();
    expect(() => stock.assertObjectJsonSchema({ type: "object", properties: {} })).not.toThrow();
    for (const schema of [{ type: "array", items: { type: "string" } }, { type: "string" }, { description: "annotation only" }]) {
      const ourError = await rejectionOf(() => port.assertObjectJsonSchema(schema));
      const stockError = await rejectionOf(() => stock.assertObjectJsonSchema(schema));
      expect({ schema, ...ourError }).toEqual({ schema, ...stockError });
      expect(ourError.message).toContain('schema.type must be "object" (structured output is object-rooted)');
    }
    const unsupported = await rejectionOf(() => port.assertObjectJsonSchema({ type: "bogus" }));
    const stockUnsupported = await rejectionOf(() => stock.assertObjectJsonSchema({ type: "bogus" }));
    expect(unsupported).toEqual(stockUnsupported);
  });

  test("validateJsonSchemaValue: scalar/enum/const khớp gốc từng vi phạm", () => {
    const cases: [any, unknown][] = [
      [{ type: "string", enum: ["a", "b"] }, "c"],
      [{ type: "number", const: 4 }, 5],
      [{ type: "integer" }, 1.5],
      [{ type: "boolean" }, 1],
      [{ type: "null" }, undefined],
      [{ type: "string" }, "ok"],
      [{ type: "number" }, Number.POSITIVE_INFINITY],
    ];
    for (const [schema, value] of cases) {
      expect(port.validateJsonSchemaValue(schema, value)).toEqual(stock.validateJsonSchemaValue(schema, value));
    }
    expect(port.validateJsonSchemaValue({ type: "string", enum: ["a", "b"] }, "c")).toEqual(['"value" must be one of ["a","b"]']);
    expect(port.validateJsonSchemaValue({ type: "integer" }, 1.5)).toEqual(['"value" must be an integer']);
  });

  test("validateJsonSchemaValue: object/array/required trả đúng đường dẫn, khớp gốc", () => {
    const schema: any = {
      type: "object",
      additionalProperties: false,
      properties: { a: { type: "string" }, b: { type: "integer" } },
      required: ["a"],
    };
    expect(port.validateJsonSchemaValue(schema, { b: 2 })).toEqual(stock.validateJsonSchemaValue(schema, { b: 2 }));
    expect(port.validateJsonSchemaValue(schema, { b: 2 })).toEqual(['missing required property "value.a"']);
    expect(port.validateJsonSchemaValue({ type: "array", items: { type: "string" } }, ["a", 2])).toEqual(
      stock.validateJsonSchemaValue({ type: "array", items: { type: "string" } }, ["a", 2]),
    );
    expect(port.validateJsonSchemaValue({ type: "array", items: { type: "string" } }, ["a", 2])).toEqual(['"value[1]" must be a string']);
    expect(port.validateJsonSchemaValue(schema, { a: "x", extra: true })).toEqual(
      stock.validateJsonSchemaValue(schema, { a: "x", extra: true }),
    );
  });

  test("validateJsonSchemaValue: oneOf + path tuỳ biến khớp gốc", () => {
    const schema: any = { oneOf: [{ type: "string" }, { type: "integer" }] };
    for (const value of ["x", 3, true]) {
      expect(port.validateJsonSchemaValue(schema, value, "args.flag")).toEqual(stock.validateJsonSchemaValue(schema, value, "args.flag"));
    }
    expect(port.validateJsonSchemaValue(schema, true, "args.flag")).toEqual(['"args.flag" must match exactly one oneOf branch (matched 0)']);
    const overlap: any = { oneOf: [{ type: "number" }, { type: "integer" }] };
    expect(port.validateJsonSchemaValue(overlap, 3, "x")).toEqual(stock.validateJsonSchemaValue(overlap, 3, "x"));
    expect(port.validateJsonSchemaValue(overlap, 3, "x")).toEqual(['"x" must match exactly one oneOf branch (matched 2)']);
  });
});

describe("row tools — SDK TypeScript/Python", () => {
  /** Bộ schema mẫu dùng chung cho các phép render. */
  const schemas: any[] = [
    {
      name: "bash",
      description: "Run a shell command.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" }, description: { type: "string" } },
        required: ["command", "description"],
      },
      output: { type: "object", properties: { stdout: { type: "string" } }, required: ["stdout"] },
    },
    {
      name: "read_file",
      description: "Read a file.",
      parameters: { type: "object", properties: { path: { type: "string" }, offset: { type: "integer" } }, required: ["path"] },
      output: { type: "string" },
    },
    { name: "weird-name", description: "", parameters: { type: "object", properties: {} }, output: { type: "null" } },
    {
      name: "nested",
      description: "Nested shapes.",
      parameters: {
        type: "object",
        properties: {
          items: { type: "array", items: { oneOf: [{ type: "string" }, { type: "number" }] } },
          choice: { type: "string", enum: ["a", "b"] },
        },
        required: ["items"],
      },
      output: { type: "array", items: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean", required: true } } } },
    },
  ];

  test("jsonSchemaToTs: byte khớp gốc trên bộ schema + fallback unknown", () => {
    const shapes: any[] = [
      { type: "string", enum: ["a", "b"] },
      { type: "integer", const: 3 },
      { oneOf: [{ type: "null" }, { type: "array", items: { type: "string" } }] },
      { type: "object", additionalProperties: false, properties: { a: { type: "string" }, b: { type: "object", additionalProperties: true, properties: { c: { type: "boolean" } } } }, required: ["a"] },
      { type: "array", items: { type: "object", additionalProperties: false, properties: { k: { type: "json" } } } },
      { description: "no type" },
      { type: "bogus" },
    ];
    for (const shape of shapes) {
      expect(port.jsonSchemaToTs(shape)).toBe(stock.jsonSchemaToTs(shape));
    }
    expect(port.jsonSchemaToTs({ type: "string", enum: ["a", "b"] })).toBe('"a" | "b"');
    expect(port.jsonSchemaToTs({ type: "integer", const: 3 })).toBe("3");
    expect(port.jsonSchemaToTs({ type: "bogus" })).toBe("unknown");
    expect(port.jsonSchemaToTs({ description: "no type" })).toBe("JsonValue");
  });

  test("jsonSchemaToPy: byte khớp gốc + fallback Any", () => {
    const shapes: any[] = [
      { type: "string", enum: ["a", "b"] },
      { type: "integer", const: 3 },
      { oneOf: [{ type: "null" }, { type: "array", items: { type: "string" } }] },
      { type: "object", additionalProperties: false, properties: { a: { type: "string" } }, required: ["a"] },
      { type: "bogus" },
    ];
    for (const shape of shapes) {
      expect(port.jsonSchemaToPy(shape)).toBe(stock.jsonSchemaToPy(shape));
    }
    expect(port.jsonSchemaToPy({ type: "string", enum: ["a", "b"] })).toBe('Literal["a", "b"]');
    expect(port.jsonSchemaToPy({ type: "bogus" })).toBe("Any");
  });

  test("renderToolsSdk: byte khớp gốc, tất định, ví dụ bash bám schema hiện tại", () => {
    const text = port.renderToolsSdk(schemas);
    expect(text).toBe(stock.renderToolsSdk(schemas));
    expect(text).toBe(port.renderToolsSdk([...schemas].reverse()));
    expect(text).toContain("## Writing code for run_code");
    expect(text).toContain("invoke a declared " + BT + "bash" + BT + " binding");
    expect(text).toContain("command: 'pwd'");
    const noBash = port.renderToolsSdk(schemas.filter((schema) => schema.name !== "bash"));
    expect(noBash).toBe(stock.renderToolsSdk(schemas.filter((schema) => schema.name !== "bash")));
    expect(noBash).not.toContain("invoke a declared");
    const empty = port.renderToolsSdk([]);
    expect(empty).toBe(stock.renderToolsSdk([]));
  });

  test("renderToolsSdkPy: byte khớp gốc, tất định, tên lạ/khoá cứng dùng subscript", () => {
    const text = port.renderToolsSdkPy(schemas);
    expect(text).toBe(stock.renderToolsSdkPy(schemas));
    expect(text).toBe(port.renderToolsSdkPy([...schemas].reverse()));
    expect(text).toContain("from typing import");
    expect(text).toContain("class Tools(Protocol):");
    expect(text).toContain('tools["weird-name"]');
    expect(text).toContain("class BashArgs(TypedDict)");
    const empty = port.renderToolsSdkPy([]);
    expect(empty).toBe(stock.renderToolsSdkPy([]));
    expect(empty).toContain("pass");
  });
});

describe("row tools — mount cordis THẬT", () => {
  test("boot native: service tên tools, một provider schema, không mục prompt — khớp gốc", async () => {
    const ourBoot = await boot(port.ToolRuntime, {});
    const stockBoot = await boot(stock.ToolRuntime, {});
    expect(ourBoot.svc).toBeDefined();
    expect(ourBoot.svc.name).toBe("tools");
    expect(ourBoot.svc.constructor.name).toBe("ToolRuntime");
    expect(stockBoot.svc.name).toBe("tools");
    expect(ourBoot.log).toEqual(stockBoot.log);
    expect(ourBoot.log).toEqual({ toolsProviders: 1, sections: [], orders: [] });
    expect(ourBoot.ctx.get("tools")?.constructor.name).toBe("ToolRuntime");
  });

  test("boot ptc: đăng ký tools:ptc-only + tools:sdk đúng thứ tự/interpolate — khớp gốc", async () => {
    const ourBoot = await boot(port.ToolRuntime, { mode: "ptc" });
    const stockBoot = await boot(stock.ToolRuntime, { mode: "ptc" });
    expect(ourBoot.svc).toBeDefined();
    expect(ourBoot.log).toEqual(stockBoot.log);
    expect(ourBoot.log.orders).toEqual(["PTC_ONLY", "TOOLS_SDK"]);
    expect(ourBoot.log.sections).toEqual([
      { name: "tools:ptc-only", order: 90 },
      { name: "tools:sdk", order: 100, interpolate: false },
    ]);
  });

  test("execute trên Context thật: thành công / args sai / tool lạ đều khớp bundle gốc", async () => {
    const ourBoot = await boot(port.ToolRuntime, {});
    const stockBoot = await boot(stock.ToolRuntime, {});
    const disposeOurs = ourBoot.svc.register(echoTool(port));
    const disposeStock = stockBoot.svc.register(echoTool(stock));
    const inputs = [
      { callId: "c1", name: "echo", arguments: { text: "hi" }, signal: signal() },
      { callId: "c2", name: "echo", arguments: { text: 3 }, signal: signal() },
      { callId: "c3", name: "missing", arguments: {}, signal: signal() },
    ];
    for (const input of inputs) {
      const ourResult = await ourBoot.svc.execute(input);
      const stockResult = await stockBoot.svc.execute({ ...input, signal: signal() });
      expect(ourResult).toEqual(stockResult);
    }
    expect(ourBoot.svc.get("echo")?.name).toBe("echo");
    expect(ourBoot.svc.schemas().map((schema: any) => schema.name)).toEqual(stockBoot.svc.schemas().map((schema: any) => schema.name));
    expect(await ourBoot.svc.execute({ callId: "c4", name: "echo", arguments: { text: 5 }, signal: signal() })).toMatchObject({
      isError: true,
      error: { message: 'invalid arguments: "text" must be a string', info: { name: "ToolArgsError", code: "INVALID_ARGS" } },
    });
    disposeOurs();
    disposeStock();
    expect(ourBoot.svc.get("echo")).toBeUndefined();
    expect(stockBoot.svc.get("echo")).toBeUndefined();
  });

  test("register an toàn: trùng tên + tên run_code dành riêng ném y hệt gốc", async () => {
    const ourBoot = await boot(port.ToolRuntime, {});
    const stockBoot = await boot(stock.ToolRuntime, {});
    ourBoot.svc.register(echoTool(port));
    stockBoot.svc.register(echoTool(stock));
    const ourDup = await rejectionOf(() => ourBoot.svc.register(echoTool(port)));
    const stockDup = await rejectionOf(() => stockBoot.svc.register(echoTool(stock)));
    expect(ourDup).toEqual(stockDup);
    expect(ourDup.message).toBe("tool " + JSON.stringify("echo") + " is already registered (for a per-agent variant, register through that agent's " + BT + "agent.ctx" + BT + " instead)");
    const reserved = { ...echoTool(port), name: port.RUN_CODE_NAME };
    const ourReserved = await rejectionOf(() => ourBoot.svc.register(reserved));
    const stockReserved = await rejectionOf(() => stockBoot.svc.register({ ...echoTool(stock), name: stock.RUN_CODE_NAME }));
    expect(ourReserved).toEqual(stockReserved);
    expect(ourReserved.message).toBe('tool name "run_code" is reserved for the PTC mode presentation transport and cannot be registered or shadowed');
    const invalidTimeout = { ...echoTool(port), timeoutMs: 0 };
    const ourTimeout = await rejectionOf(() => ourBoot.svc.register(invalidTimeout));
    const stockTimeout = await rejectionOf(() => stockBoot.svc.register({ ...echoTool(stock), timeoutMs: 0 }));
    expect(ourTimeout).toEqual(stockTimeout);
  });

  test("cấu hình sai maxParallelSubCalls: ném y hệt gốc trên Context thật", async () => {
    const ourError = await rejectionOf(() => new port.ToolRuntime(new cordis.Context(), { maxParallelSubCalls: 0 }));
    const stockError = await rejectionOf(() => new stock.ToolRuntime(new cordis.Context(), { maxParallelSubCalls: 0 }));
    expect(ourError).toEqual(stockError);
    expect(ourError.message).toBe("maxParallelSubCalls must be a positive integer");
    const ourFraction = await rejectionOf(() => new port.ToolRuntime(new cordis.Context(), { maxParallelSubCalls: 1.5 }));
    const stockFraction = await rejectionOf(() => new stock.ToolRuntime(new cordis.Context(), { maxParallelSubCalls: 1.5 }));
    expect(ourFraction).toEqual(stockFraction);
  });
});

/** Tên các schema theo đúng thứ tự trả về. */
function names(schemas: any[]): string[] { return schemas.map((schema) => schema.name); }

/** Chuẩn hoá JSON đệ quy (khoá sắp xếp) để hai bản so được với nhau. */
function canonical(value: unknown): string {
  const sort = (_key: string, item: any): any => item !== null && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
  return JSON.stringify(value, sort);
}

/** Tool tổng quát cho các ca runtime; overrides thay hành vi/schema khi cần. */
function toolFor(module: any, name: string, overrides: Record<string, unknown> = {}): any {
  return module.defineTool({
    name,
    description: "Tool " + name,
    parameters: { text: { type: "string" } },
    output: { schema: { type: "string" }, render: (_args: unknown, value: any) => [{ type: "text", text: value }] },
    execute: async (args: any) => args.text ?? "ok",
    ...overrides,
  });
}

/** Dựng service trên Context cordis THẬT + SystemPrompt THẬT của kernel, không gọi mạng. */
function runtimeOf(plugin: any, mode: "native" | "ptc" = "native"): any {
  const ctx: any = new cordis.Context();
  new prompt.SystemPrompt(ctx, prompt.SystemPrompt.Config({ includeRuntimeContext: false }));
  if (mode === "ptc") ctx.provide("ptcRuntime", { language: "typescript" });
  return { ctx, svc: new plugin(ctx, { mode }) };
}

/** Execute một lời gọi với tín hiệu huỷ mới. */
function call(svc: any, input: Record<string, unknown>): Promise<any> {
  return svc.execute({ callId: "ca", arguments: {}, signal: signal(), ...input });
}

describe("row tools — 5 ca runtime bổ sung (Context thật, scope thật)", () => {
  test("schemas(): đúng thứ tự đăng ký, không lẫn tool scope khác, restrict chỉ tác động scope", async () => {
    const scenario = (module: any, kit: any) => {
      const boot = runtimeOf(module.ToolRuntime);
      boot.svc.register(toolFor(module, "alpha"));
      boot.svc.register(toolFor(module, "beta"));
      const keyA = {}, keyB = {};
      const a = kit.createScope(boot.ctx, keyA);
      const b = kit.createScope(boot.ctx, keyB);
      a.ctx.tools.register(toolFor(module, "only-a"));
      b.ctx.tools.register(toolFor(module, "only-b"));
      const before = { global: names(boot.svc.schemas()), a: names(boot.svc.schemas(keyA)), b: names(boot.svc.schemas(keyB)) };
      const lift = b.ctx.tools.restrict({ deny: ["beta"] });
      const restricted = { a: names(boot.svc.schemas(keyA)), b: names(boot.svc.schemas(keyB)) };
      lift();
      return { before, restricted, lifted: names(boot.svc.schemas(keyB)) };
    };
    const mine = scenario(port, ourScopeKit), theirs = scenario(stock, scopeKit);
    expect(mine.before).toEqual(theirs.before);
    expect(mine.restricted).toEqual(theirs.restricted);
    expect(mine.lifted).toEqual(theirs.lifted);
    expect(mine.before.global).toEqual(["alpha", "beta"]);
    expect(mine.before.a).toEqual(["alpha", "beta", "only-a"]);
    expect(mine.before.b).toEqual(["alpha", "beta", "only-b"]);
    expect(mine.before.a).not.toContain("only-b");
    expect(mine.restricted.a).toEqual(["alpha", "beta", "only-a"]);
    expect(mine.restricted.b).toEqual(["alpha", "only-b"]);
    expect(mine.lifted).toEqual(["alpha", "beta", "only-b"]);
  });

  test("execute(): kết quả LỖI + ABORT trước/sau khi thân chạy chuẩn hoá y hệt bản gốc", async () => {
    const scenario = async (module: any) => {
      const { svc } = runtimeOf(module.ToolRuntime);
      svc.register(toolFor(module, "boom", { execute: async () => { throw new Error("boom"); } }));
      svc.register(toolFor(module, "any"));
      const pre = new AbortController(); pre.abort(new Error("stop"));
      const before = await svc.execute({ callId: "c1", name: "any", arguments: {}, signal: pre.signal });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let started = false;
      svc.register(toolFor(module, "slow", { execute: async () => { started = true; await gate; return "late"; } }));
      const middle = new AbortController();
      const pending = svc.execute({ callId: "c2", name: "slow", arguments: {}, signal: middle.signal });
      for (let tick = 0; !started && tick < 1000; tick += 1) await Promise.resolve();
      middle.abort(); release();
      return { failure: await call(svc, { name: "boom", arguments: {} }), before, after: await pending };
    };
    const mine = await scenario(port), theirs = await scenario(stock);
    expect(canonical(mine)).toBe(canonical(theirs));
    expect(mine.failure).toMatchObject({ isError: true, error: { message: "boom" } });
    expect(mine.before).toMatchObject({ isError: true, error: { info: { code: "ABORTED_BEFORE_DISPATCH" } } });
    expect(mine.after).toMatchObject({ isError: true, error: { info: { code: "ABORTED" } } });
  });

  test("register trùng tên: global + trong scope ném đúng câu gốc; scope che global không ném", async () => {
    const scenario = async (module: any, kit: any) => {
      const boot = runtimeOf(module.ToolRuntime);
      boot.svc.register(toolFor(module, "dup"));
      const global = await rejectionOf(() => boot.svc.register(toolFor(module, "dup")));
      const scope = kit.createScope(boot.ctx, {});
      scope.ctx.tools.register(toolFor(module, "inner"));
      const scoped = await rejectionOf(() => scope.ctx.tools.register(toolFor(module, "inner")));
      const shadow = await rejectionOf(() => scope.ctx.tools.register(toolFor(module, "dup")));
      await scope.dispose();
      return { global, scoped, shadow };
    };
    const mine = await scenario(port, ourScopeKit), theirs = await scenario(stock, scopeKit);
    expect(mine).toEqual(theirs);
    expect(mine.global.message).toBe('tool "dup" is already registered (for a per-agent variant, register through that agent\'s `agent.ctx` instead)');
    expect(mine.scoped.message).toBe('tool "inner" is already registered in this scope');
    expect(mine.shadow.name).toBe("(khong nem)");
  });

  test("executionMode + systemPrompt: tool mới đổi schemas/section y hệt bản gốc", async () => {
    const kindOf = (svc: any, safe: boolean): string => svc.executionMode({ callId: "c", name: "echo", arguments: { text: "x", safe }, signal: signal() }).kind;
    const scenario = async (module: any, mode: "native" | "ptc") => {
      const boot = runtimeOf(module.ToolRuntime, mode);
      const snapshot = async () => {
        const assembly = await boot.ctx.systemPrompt.assemble({ scope: undefined });
        return {
          schemas: assembly.tools.filter((tool: any) => tool.name !== "run_code").map((tool: any) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })),
          sections: assembly.sections.map((section: any) => ({ name: section.name, text: section.text })),
        };
      };
      const before = await snapshot();
      const beforeKinds = [kindOf(boot.svc, true), kindOf(boot.svc, false)];
      boot.svc.register(toolFor(module, "echo", { parameters: { text: { type: "string" }, safe: { type: "boolean" } }, isConcurrencySafe: (args: any) => args.safe === true }));
      return { before, after: await snapshot(), beforeKinds, afterKinds: [kindOf(boot.svc, true), kindOf(boot.svc, false)] };
    };
    const mineNative = await scenario(port, "native"), theirsNative = await scenario(stock, "native");
    const minePtc = await scenario(port, "ptc"), theirsPtc = await scenario(stock, "ptc");
    expect(mineNative).toEqual(theirsNative);
    expect(minePtc).toEqual(theirsPtc);
    expect(mineNative.before.schemas).toEqual([]);
    expect(mineNative.after.schemas.map((tool: any) => tool.name)).toEqual(["echo"]);
    expect(mineNative.beforeKinds).toEqual(["exclusive", "exclusive"]);
    expect(mineNative.afterKinds).toEqual(["parallel", "exclusive"]);
    const sdkBefore = minePtc.before.sections.find((section: any) => section.name === "tools:sdk")!.text;
    const sdkAfter = minePtc.after.sections.find((section: any) => section.name === "tools:sdk")!.text;
    expect(sdkBefore).not.toContain("echo");
    expect(sdkAfter).toContain("echo");
  });

  test("dispose giữa chừng: tool biến mất khỏi schemas/get, gọi lại lỗi y hệt; abort không rò rỉ", async () => {
    const scenario = async (module: any, kit: any) => {
      const boot = runtimeOf(module.ToolRuntime);
      const key = {};
      const scope = kit.createScope(boot.ctx, key);
      const offScoped = scope.ctx.tools.register(toolFor(module, "scoped"));
      const scopedBefore = { schemas: names(boot.svc.schemas(key)), present: boot.svc.get("scoped", key) !== undefined, call: await call(boot.svc, { name: "scoped", agent: key }) };
      offScoped();
      const scopedAfter = { schemas: names(boot.svc.schemas(key)), present: boot.svc.get("scoped", key) !== undefined, call: await call(boot.svc, { name: "scoped", agent: key }) };
      scope.ctx.tools.register(toolFor(module, "scoped"));
      await scope.dispose();
      const scopeAfter = { schemas: names(boot.svc.schemas(key)), present: boot.svc.get("scoped", key) !== undefined, call: await call(boot.svc, { name: "scoped", agent: key }) };
      const offGlobal = boot.svc.register(toolFor(module, "global"));      const globalBefore = { schemas: names(boot.svc.schemas()), present: boot.svc.get("global") !== undefined, call: await call(boot.svc, { name: "global" }) };
      offGlobal();
      const globalAfter = { schemas: names(boot.svc.schemas()), present: boot.svc.get("global") !== undefined, call: await call(boot.svc, { name: "global" }) };
      const offAborted = boot.svc.register(toolFor(module, "aborted"));
      const aborted = new AbortController(); aborted.abort(new Error("stop"));
      const abortedBefore = { schemas: names(boot.svc.schemas()), present: boot.svc.get("aborted") !== undefined };
      offAborted();
      const abortedAfter = { schemas: names(boot.svc.schemas()), present: boot.svc.get("aborted") !== undefined };
      return { scopedBefore, scopedAfter, scopeAfter, globalBefore, globalAfter, abortedBefore, abortedAfter };
    };
    const mine = await scenario(port, ourScopeKit), theirs = await scenario(stock, scopeKit);
    expect(mine).toEqual(theirs);
    expect(mine.abortedBefore.present).toBe(true);
    expect(mine.abortedAfter.present).toBe(false);
  });
});
