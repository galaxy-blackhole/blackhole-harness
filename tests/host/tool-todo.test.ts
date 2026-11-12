/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói tool-todo: mỗi ca cài CẢ HAI bản (ta + bundle gốc @deepseek-ai/dsh-tool-todo) lên CÙNG một giàn Context cordis THẬT rồi so tập export artifact, name/inject, Config, đơn vị chiếu `todos`, công cụ `todo_write` và mọi nhánh lỗi của execute.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-todo/build.ts";
import * as oursModule from "../../packages/host/tool-todo/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-todo");
/** Bundle gốc đã build (196 dòng) — bản đối chứng. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis THẬT (không phải object giả). */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as PluginLike;
/** Bản của ta nhìn qua CÙNG hình dạng để so hai bên. */
const mine = oursModule as unknown as PluginLike;

/** Hình dạng plugin tối thiểu mà test dùng (cả hai bản đều khớp). */
interface PluginLike {
  /** Tên plugin. */
  readonly name: string;
  /** Service bắt buộc. */
  readonly inject: readonly string[];
  /** Schema cấu hình (callable + Standard Schema). */
  readonly Config: unknown;
  /**
   * Cài plugin lên context.
   * Nhận: ctx — Context cordis thật; config — cấu hình đã chuẩn hoá.
   * Trả: không.
   */
  readonly apply: (ctx: object, config: unknown) => void;
}

/** Schema cấu hình nhìn theo CẤU TRÚC: gọi trực tiếp như schemastery + `~standard`. */
interface ConfigSchemaLike {
  /** Chuẩn hoá cấu hình; ném khi sai. */
  (value?: unknown): Record<string, unknown>;
  /** Giao diện chuẩn mà cordis đọc. */
  readonly "~standard": {
    /** Phiên bản giao diện. */
    readonly version: number;
    /** Nhà cung cấp giao diện. */
    readonly vendor: string;
    /** Chuẩn hoá + kiểm; trả `{ value }` hoặc `{ issues }`. */
    validate(value: unknown): unknown;
  };
}

/** Schema của một đơn vị chiếu (seam chỉ gọi `parse`). */
interface ProjectionSchemaLike {
  /** Kiểm + chuẩn hoá một giá trị. */
  parse(value: unknown): unknown;
}

/** Đơn vị chiếu đã đăng ký. */
interface ProjectionLike {
  /** Khoá đơn vị chiếu. */
  readonly key: string;
  /** Schema trạng thái. */
  readonly stateSchema: ProjectionSchemaLike;
  /** Trạng thái ban đầu. */
  init(...args: unknown[]): unknown;
  /** Phép gộp một sự kiện. */
  apply(state: unknown, event: unknown): unknown;
  /** Khung nhìn dây. */
  readonly wire?: { readonly viewSchema: ProjectionSchemaLike; view(state: unknown): unknown };
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
}

/** Định nghĩa công cụ đã đăng ký. */
interface ToolLike {
  /** Tên công cụ. */
  readonly name: string;
  /** Mô tả hướng mô hình. */
  readonly description: string;
  /** JSON Schema tham số sau khi `defineTool` biên dịch. */
  readonly parameters: unknown;
  /** Schema đầu ra + hàm hiển thị. */
  readonly output: { readonly schema: unknown; render(args: unknown, value: unknown): { type: string; text?: string }[] };
  /** Thực thi sau khi validate tham số. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
  /** Trình bày lời gọi đang chờ (đã bọc soft-validate). */
  presentCall?(args: unknown): unknown;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cordis thật. */
  readonly ctx: object;
  /** Các đơn vị chiếu đã đăng ký. */
  readonly projections: ProjectionLike[];
  /** Các định nghĩa công cụ đã đăng ký. */
  readonly tools: Record<string, unknown>[];
}

/** Một sự kiện đã ghi vào log phiên giả. */
interface Appended {
  /** Loại sự kiện. */
  readonly type: string;
  /** Dữ liệu sự kiện. */
  readonly data: unknown;
}

/** Đường dẫn ARTIFACT của ta (gán trong beforeAll). */
let artifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-tool-todo-"));
  artifact = await buildPackage(outDir);
});

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

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
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/**
 * Dựng giàn đo trên Context cordis THẬT: `provide` hai service mà plugin `inject` đòi.
 * Nhận: không.
 * Trả: giàn đo (rỗng, chưa cài plugin).
 */
function makeHarness(): Harness {
  const projections: ProjectionLike[] = [];
  const tools: Record<string, unknown>[] = [];
  const ctx = new ContextCtor() as { provide(name: string, value?: unknown): () => void };
  ctx.provide("sessionProjections", {
    register: (definition: ProjectionLike): (() => void) => {
      projections.push(definition);
      return () => undefined;
    },
  });
  ctx.provide("tools", {
    register: (definition: Record<string, unknown>): (() => void) => {
      tools.push(definition);
      return () => undefined;
    },
  });
  return { ctx, projections, tools };
}

/**
 * Chuẩn hoá cấu hình qua schema của CHÍNH bản cần cài (hai bản phải cho CÙNG kết quả).
 * Nhận: plugin — bản cần cài; allowParallel — giá trị chính sách.
 * Trả: cấu hình đã chuẩn hoá.
 */
function configOf(plugin: PluginLike, allowParallel: boolean): Record<string, unknown> {
  return (plugin.Config as ConfigSchemaLike)({ allowParallelInProgress: allowParallel });
}

/**
 * Cài MỘT bản lên giàn rồi trả giàn đã có đăng ký.
 * Nhận: plugin — bản cần cài; allowParallel — chính sách song song (mặc định false).
 * Trả: giàn đo đã cài.
 */
function install(plugin: PluginLike, allowParallel = false): Harness {
  const harness = makeHarness();
  plugin.apply(harness.ctx, configOf(plugin, allowParallel));
  return harness;
}

/**
 * Lấy đơn vị chiếu DUY NHẤT đã đăng ký.
 * Nhận: harness — giàn đã cài.
 * Trả: đơn vị chiếu.
 * @throws {Error} khi plugin không đăng ký đơn vị chiếu nào.
 */
function projectionOf(harness: Harness): ProjectionLike {
  const projection = harness.projections[0];
  if (projection === undefined) throw new Error("plugin không đăng ký đơn vị chiếu nào");
  return projection;
}

/**
 * Lấy định nghĩa công cụ DUY NHẤT đã đăng ký.
 * Nhận: harness — giàn đã cài.
 * Trả: định nghĩa công cụ.
 * @throws {Error} khi plugin không đăng ký công cụ nào.
 */
function toolOf(harness: Harness): ToolLike {
  const tool = harness.tools[0];
  if (tool === undefined) throw new Error("plugin không đăng ký công cụ nào");
  return tool as unknown as ToolLike;
}

/**
 * Chuẩn hoá một giá trị thành Record để soi bằng khoá.
 * Nhận: value — giá trị bất kỳ.
 * Trả: chính giá trị đó dưới dạng Record.
 * @throws {Error} khi giá trị không phải object.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new Error("giá trị không phải object");
  return value as Record<string, unknown>;
}

/**
 * Chạy một lời gọi execute và trả kết quả thay vì ném.
 * Nhận: tool — định nghĩa công cụ; args — tham số; exec — ngữ cảnh thực thi.
 * Trả: `{ value }` khi thành công, `{ error }` (thông điệp) khi ném.
 */
async function runExecute(tool: ToolLike, args: unknown, exec: unknown): Promise<{ value?: unknown; error?: string }> {
  try {
    return { value: await tool.execute(args, exec) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Dựng exec có agent giả ghi lại mọi sự kiện append.
 * Nhận: appended — mảng nhận sự kiện.
 * Trả: exec truyền cho `execute`.
 */
function execWithAgent(appended: Appended[]): { agent: { session: { append(type: string, data: unknown): void } } } {
  return { agent: { session: { append: (type: string, data: unknown): void => { appended.push({ type, data }); } } } };
}

/** Một danh sách todo hợp lệ dùng lại trong nhiều ca. */
const TODOS = [
  { content: "đọc bản gốc", status: "completed" },
  { content: "viết lại", status: "in_progress" },
  { content: "viết test", status: "pending" },
] as const;

/** Danh sách todo ở hình dạng ĐÃ CHUẨN HOÁ (bản gốc dựng lại object chỉ có content/status). */
const CANONICAL = TODOS.map((todo) => ({ content: todo.content, status: todo.status }));

describe("A. TẬP EXPORT + name/inject — ta phải BẰNG bản gốc", () => {
  test("4 export BẰNG TỪNG TÊN trên artifact: Config · apply · inject · name", () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["Config", "apply", "inject", "name"]);
  });

  test("name 'tool-todo' + inject ['tools','sessionProjections'] — hai bản trùng khít", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-todo");
    expect([...mine.inject]).toEqual([...stock.inject]);
    expect([...mine.inject]).toEqual(["tools", "sessionProjections"]);
  });
});

describe("B. Config — String + Standard Schema + mọi nhánh lỗi", () => {
  test("String(Config) TRÙNG từng ký tự; version 1 · vendor schemastery", () => {
    const ours = mine.Config as ConfigSchemaLike;
    const theirs = stock.Config as ConfigSchemaLike;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe("{ allowParallelInProgress: boolean }");
    expect(ours["~standard"].version).toBe(theirs["~standard"].version);
    expect(ours["~standard"].vendor).toBe(theirs["~standard"].vendor);
    // Hình dạng nút gốc mà Loader đọc khi so khác biệt config: type · meta · dict · toString.
    // Schema là FUNCTION (callable như schemastery) nên soi khoá qua ép kiểu, không qua asRecord.
    const oursNode = ours as unknown as Record<string, unknown>;
    const theirsNode = theirs as unknown as Record<string, unknown>;
    expect(Object.keys(oursNode).sort()).toEqual(Object.keys(theirsNode).sort());
    expect(oursNode["type"]).toBe(theirsNode["type"]);
    expect(oursNode["meta"]).toEqual(theirsNode["meta"]);
    const oursDict = asRecord(oursNode["dict"]);
    const theirsDict = asRecord(theirsNode["dict"]);
    expect(Object.keys(oursDict)).toEqual(Object.keys(theirsDict));
    expect(String(oursDict["allowParallelInProgress"])).toBe(String(theirsDict["allowParallelInProgress"]));
  });

  test("Config hợp lệ: cùng kết quả, giữ nguyên khoá lạ như bản gốc", () => {
    const ours = mine.Config as ConfigSchemaLike;
    const theirs = stock.Config as ConfigSchemaLike;
    expect(ours({ allowParallelInProgress: true })).toEqual(theirs({ allowParallelInProgress: true }));
    expect(ours({ allowParallelInProgress: false })).toEqual({ allowParallelInProgress: false });
    expect(ours({ allowParallelInProgress: true, extra: 1 })).toEqual(theirs({ allowParallelInProgress: true, extra: 1 }));
    expect(asRecord(ours({ allowParallelInProgress: true, extra: 1 }))["extra"]).toBe(1);
  });

  test("Config nhánh lỗi: thiếu trường · sai kiểu · gốc không phải object — CÙNG thông điệp", () => {
    const ours = mine.Config as ConfigSchemaLike;
    const theirs = stock.Config as ConfigSchemaLike;
    const cases: unknown[] = [{}, undefined, null, { allowParallelInProgress: "yes" }, { allowParallelInProgress: 0 }, 5, "x", []];
    for (const value of cases) {
      const messageOf = (schema: ConfigSchemaLike): string => {
        try {
          schema(value);
          return "không ném";
        } catch (error) {
          return (error as Error).message;
        }
      };
      expect(messageOf(ours)).toBe(messageOf(theirs));
      expect(messageOf(ours)).not.toBe("không ném");
    }
  });

  test("~standard.validate trả giá trị/issues giống hệt (cordis đọc ĐÚNG đường này)", () => {
    const ours = (mine.Config as ConfigSchemaLike)["~standard"];
    const theirs = (stock.Config as ConfigSchemaLike)["~standard"];
    expect(ours.validate({ allowParallelInProgress: true })).toEqual(theirs.validate({ allowParallelInProgress: true }));
    expect(ours.validate({ allowParallelInProgress: "yes" })).toEqual(theirs.validate({ allowParallelInProgress: "yes" }));
    expect(ours.validate({})).toEqual(theirs.validate({}));
  });
});

describe("C. Đăng ký đơn vị chiếu todos — key · stateVersion · 4 nhánh fold · wire", () => {
  test("register ĐÚNG một lần: key 'todos' · stateVersion 2 · init() = null", () => {
    const ours = projectionOf(install(mine));
    const theirs = projectionOf(install(stock));
    expect(ours.key).toBe(theirs.key);
    expect(ours.key).toBe("todos");
    expect(ours.stateVersion).toBe(theirs.stateVersion);
    expect(ours.stateVersion).toBe(2);
    expect(ours.init({ id: "s" }, 0)).toEqual(theirs.init({ id: "s" }, 0));
    expect(ours.init({ id: "s" }, 0)).toBeNull();
  });

  test("fold 4 nhánh: todo/write thay TOÀN BỘ · turn/start xoá · sự kiện khác giữ NGUYÊN tham chiếu", () => {
    const ours = projectionOf(install(mine));
    const theirs = projectionOf(install(stock));
    const written = { type: "todo/write", data: { todos: TODOS } };
    expect(ours.apply(null, written)).toEqual(theirs.apply(null, written));
    expect(ours.apply(null, written)).toEqual(CANONICAL);
    expect(ours.apply(TODOS, { type: "turn/start", data: {} })).toEqual(theirs.apply(TODOS, { type: "turn/start", data: {} }));
    expect(ours.apply(TODOS, { type: "turn/start", data: {} })).toBeNull();
    const state = [{ content: "giữ nguyên", status: "pending" }];
    expect(ours.apply(state, { type: "session/end", data: {} })).toBe(state);
    expect(theirs.apply(state, { type: "session/end", data: {} })).toBe(state);
  });

  test("wire.view là phép chiếu ĐỒNG NHẤT; viewSchema.parse giữ nội dung + BỎ khoá lạ", () => {
    const ours = projectionOf(install(mine));
    const theirs = projectionOf(install(stock));
    expect(ours.wire?.view(TODOS)).toBe(TODOS);
    expect(theirs.wire?.view(TODOS)).toBe(TODOS);
    const withExtra = [{ content: "a", status: "pending", extra: 1 }];
    expect(ours.wire?.viewSchema.parse(withExtra)).toEqual(theirs.wire?.viewSchema.parse(withExtra));
    expect(ours.wire?.viewSchema.parse(withExtra)).toEqual([{ content: "a", status: "pending" }]);
    expect(ours.wire?.viewSchema.parse(null)).toBeNull();
    expect(theirs.wire?.viewSchema.parse(null)).toBeNull();
  });

  test("viewSchema từ chối payload hỏng ở CẢ HAI bản (lỗi khác lớp, cùng hành vi từ chối)", () => {
    const ours = projectionOf(install(mine));
    const theirs = projectionOf(install(stock));
    const bad: unknown[] = [{ content: "a" }, [{ content: "a", status: "done" }], "x", 5, [{ content: 1, status: "pending" }]];
    for (const value of bad) {
      expect(() => ours.wire?.viewSchema.parse(value)).toThrow();
      expect(() => theirs.wire?.viewSchema.parse(value)).toThrow();
    }
  });
});

describe("D. Đăng ký công cụ todo_write — name · description · parameters · output", () => {
  test("register ĐÚNG một công cụ, name 'todo_write' ở cả hai bản", () => {
    const ours = install(mine);
    const theirs = install(stock);
    expect(ours.tools.length).toBe(theirs.tools.length);
    expect(ours.tools.length).toBe(1);
    expect(toolOf(ours).name).toBe(toolOf(theirs).name);
    expect(toolOf(ours).name).toBe("todo_write");
  });

  test("description: mệnh đề song song khi allowParallelInProgress=true — TRÙNG từng ký tự", () => {
    const ours = toolOf(install(mine, true)).description;
    const theirs = toolOf(install(stock, true)).description;
    expect(ours).toBe(theirs);
    expect(ours).toContain("keep the todos being worked on `in_progress`, several only when work runs in parallel.");
    expect(ours).toContain("Record and update a task list to plan multi-step work and show progress;");
    expect(ours.endsWith("Mark each todo `completed` as soon as it is done.")).toBe(true);
  });

  test("description: mệnh đề MỘT việc khi allowParallelInProgress=false — TRÙNG từng ký tự", () => {
    const ours = toolOf(install(mine, false)).description;
    const theirs = toolOf(install(stock, false)).description;
    expect(ours).toBe(theirs);
    expect(ours).toContain("While work remains, keep exactly one todo `in_progress`.");
    expect(ours).not.toContain("several only when work runs in parallel");
  });

  test("parameters: JSON Schema biên dịch TRÙNG KHÍT bản gốc (enum 3 trạng thái · additionalProperties false)", () => {
    const ours = toolOf(install(mine)).parameters;
    const theirs = toolOf(install(stock)).parameters;
    expect(ours).toEqual(theirs);
    const properties = asRecord(asRecord(ours)["properties"]);
    const items = asRecord(asRecord(properties["todos"])["items"]);
    expect(items["additionalProperties"]).toBe(false);
    const status = asRecord(asRecord(items["properties"])["status"]);
    expect(status["enum"]).toEqual(["pending", "in_progress", "completed"]);
    expect(asRecord(ours)["required"]).toEqual(["todos"]);
    expect(items["required"]).toEqual(["content", "status"]);
  });

  test("output.schema + render: schema TRÙNG KHÍT, chuỗi hiển thị TRÙNG từng ký tự", () => {
    const ours = toolOf(install(mine));
    const theirs = toolOf(install(stock));
    expect(ours.output.schema).toEqual(theirs.output.schema);
    const value = { todos: CANONICAL, counts: { pending: 1, inProgress: 1, completed: 1 } };
    expect(ours.output.render({ todos: TODOS }, value)).toEqual(theirs.output.render({ todos: TODOS }, value));
    expect(ours.output.render({ todos: TODOS }, value)).toEqual([{ type: "text", text: "Updated todo list: 1 pending, 1 in progress, 1 completed." }]);
  });

  test("presentCall: thẻ generic 'Update todo list' + rawInput là danh sách — hai bản như nhau", () => {
    const ours = toolOf(install(mine)).presentCall?.({ todos: TODOS });
    const theirs = toolOf(install(stock)).presentCall?.({ todos: TODOS });
    expect(ours).toEqual(theirs);
    expect(ours).toEqual({ card: "generic", title: "Update todo list", kind: "other", rawInput: TODOS });
  });

  test("presentCall soft-validate: tham số hỏng ⇒ undefined ở CẢ HAI bản (defineTool bọc lại)", () => {
    const ours = toolOf(install(mine)).presentCall?.({ todos: [{ content: "a", status: "done" }] });
    const theirs = toolOf(install(stock)).presentCall?.({ todos: [{ content: "a", status: "done" }] });
    expect(ours).toBeUndefined();
    expect(theirs).toBeUndefined();
    expect(toolOf(install(mine)).presentCall?.({})).toBeUndefined();
    expect(toolOf(install(stock)).presentCall?.({})).toBeUndefined();
  });
});

describe("E. execute — đường thành công + MỌI nhánh lỗi", () => {
  test("thành công: ghi ĐÚNG một sự kiện todo/write + trả todos đã canonical + counts", async () => {
    const run = async (plugin: PluginLike): Promise<{ appended: Appended[]; result: { value?: unknown; error?: string } }> => {
      const appended: Appended[] = [];
      const result = await runExecute(toolOf(install(plugin)), { todos: TODOS }, execWithAgent(appended));
      return { appended, result };
    };
    const ours = await run(mine);
    const theirs = await run(stock);
    expect(ours).toEqual(theirs);
    expect(ours.appended).toEqual([{ type: "todo/write", data: { todos: CANONICAL } }]);
    expect(ours.result.value).toEqual({ todos: CANONICAL, counts: { pending: 1, inProgress: 1, completed: 1 } });
  });

  test("content được TRIM trước khi ghi log; counts đếm theo trạng thái đã chuẩn hoá", async () => {
    const run = async (plugin: PluginLike): Promise<{ appended: Appended[]; result: { value?: unknown; error?: string } }> => {
      const appended: Appended[] = [];
      const result = await runExecute(toolOf(install(plugin)), { todos: [{ content: "  a  ", status: "pending" }, { content: "b", status: "completed" }] }, execWithAgent(appended));
      return { appended, result };
    };
    const ours = await run(mine);
    const theirs = await run(stock);
    expect(ours).toEqual(theirs);
    expect(asRecord(ours.result.value)["todos"]).toEqual([{ content: "a", status: "pending" }, { content: "b", status: "completed" }]);
    expect(asRecord(asRecord(ours.result.value)["counts"])).toEqual({ pending: 1, inProgress: 0, completed: 1 });
  });

  test("không có agent ⇒ CÙNG thông điệp 'todo_write requires an owning agent session', không ghi gì", async () => {
    const ours = await runExecute(toolOf(install(mine)), { todos: TODOS }, {});
    const theirs = await runExecute(toolOf(install(stock)), { todos: TODOS }, {});
    expect(ours.error).toBe(theirs.error);
    expect(ours.error).toBe("todo_write requires an owning agent session");
  });

  test("content rỗng/toàn khoảng trắng ⇒ CÙNG lỗi 'invalid todo: content must be a non-empty string'", async () => {
    const args = { todos: [{ content: "   ", status: "pending" }] };
    const ours = await runExecute(toolOf(install(mine)), args, execWithAgent([]));
    const theirs = await runExecute(toolOf(install(stock)), args, execWithAgent([]));
    expect(ours.error).toBe(theirs.error);
    expect(ours.error).toBe("invalid todo: `content` must be a non-empty string");
    // THỨ TỰ KIỂM: kiểm danh sách TRƯỚC khi kiểm agent — không agent vẫn phải ra lỗi `content`, không phải lỗi agent.
    const oursNoAgent = await runExecute(toolOf(install(mine)), args, {});
    const theirsNoAgent = await runExecute(toolOf(install(stock)), args, {});
    expect(oursNoAgent.error).toBe(theirsNoAgent.error);
    expect(oursNoAgent.error).toBe("invalid todo: `content` must be a non-empty string");
  });

  test("content TRÙNG sau trim ⇒ CÙNG lỗi duplicate kèm JSON.stringify nội dung", async () => {
    const args = { todos: [{ content: "a", status: "pending" }, { content: " a ", status: "completed" }] };
    const ours = await runExecute(toolOf(install(mine)), args, execWithAgent([]));
    const theirs = await runExecute(toolOf(install(stock)), args, execWithAgent([]));
    expect(ours.error).toBe(theirs.error);
    expect(ours.error).toBe("invalid todos: duplicate content " + JSON.stringify("a"));
  });

  test("hai in_progress khi allowParallelInProgress=false ⇒ CÙNG lỗi; =true ⇒ CẢ HAI cùng thành công", async () => {
    const args = { todos: [{ content: "a", status: "in_progress" }, { content: "b", status: "in_progress" }] };
    const oursBlocked = await runExecute(toolOf(install(mine, false)), args, execWithAgent([]));
    const theirsBlocked = await runExecute(toolOf(install(stock, false)), args, execWithAgent([]));
    expect(oursBlocked.error).toBe(theirsBlocked.error);
    expect(oursBlocked.error).toBe("invalid todos: at most one task may be in_progress (got 2)");
    const oursParallel = await runExecute(toolOf(install(mine, true)), args, execWithAgent([]));
    const theirsParallel = await runExecute(toolOf(install(stock, true)), args, execWithAgent([]));
    expect(oursParallel.value).toEqual(theirsParallel.value);
    expect(asRecord(asRecord(oursParallel.value)["counts"])).toEqual({ pending: 0, inProgress: 2, completed: 0 });
  });

  test("tham số SAI SCHEMA (khoá lạ trong mục) bị defineTool từ chối GIỐNG NHAU, không chạy execute", async () => {
    const appended: Appended[] = [];
    const args = { todos: [{ content: "a", status: "pending", id: "x" }] };
    const ours = await runExecute(toolOf(install(mine)), args, execWithAgent(appended));
    const theirs = await runExecute(toolOf(install(stock)), args, execWithAgent(appended));
    expect(ours.error).toBe(theirs.error);
    expect(ours.error).toBeDefined();
    expect(appended).toEqual([]);
  });
});
