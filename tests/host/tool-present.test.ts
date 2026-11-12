/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho gói tool-present: mỗi ca cài CẢ HAI bản (ta + bundle gốc @deepseek-ai/dsh-tool-present) lên cùng một giàn cấu trúc rồi so tập export, name/inject, Config (String/defaults/lỗi), định nghĩa công cụ present, execute thành công và mọi nhánh lỗi/thiếu service.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-present/build.ts";
import * as oursModule from "../../packages/host/tool-present/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-present");
/** Bundle gốc đã build (127 dòng) — bản đối chứng. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Module dsh-fs của kernel — để khẳng định FsError CÙNG một lớp. */
const FS_MODULE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-fs", "lib", "index.js");
/** Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp dsh-fs cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ `toBeInstanceOf`/`instanceof` TRƯỢT. Dựng artefact rồi
 * symlink ĐÚNG thư mục kernel vào node_modules của nó (pattern tests/host/shell.test.ts) thì hai bên
 * dùng CHUNG một lớp lỗi. */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");

/** Hình dạng plugin tối thiểu mà test dùng (cả hai bản đều khớp). */
interface PluginLike {
  /** Tên plugin. */
  readonly name: string;
  /** Service bắt buộc. */
  readonly inject: readonly string[];
  /** Schema cấu hình (callable + Standard Schema). */
  readonly Config: ConfigSchemaLike;
  /**
   * Cài plugin lên context.
   * Nhận: ctx — Context cấu trúc; config — cấu hình đã chuẩn hoá.
   * Trả: không.
   */
  readonly apply: (ctx: unknown, config: unknown) => void;
}

/** Schema cấu hình nhìn theo CẤU TRÚC: gọi trực tiếp như schemastery + giao diện chuẩn. */
interface ConfigSchemaLike {
  /** Chuẩn hoá cấu hình; ném khi sai. */
  (value?: unknown): Record<string, unknown>;
  /** Loại nút gốc. */
  readonly type: string;
  /** Metadata nút gốc. */
  readonly meta: unknown;
  /** Từ điển trường của nút gốc. */
  readonly dict: Record<string, unknown>;
  /** Giao diện chuẩn (Standard Schema) mà cordis đọc. */
  readonly "~standard": {
    /** Phiên bản giao diện. */
    readonly version: number;
    /** Nhà cung cấp giao diện. */
    readonly vendor: string;
    /** Chuẩn hoá + kiểm; trả value hoặc issues. */
    validate(value: unknown): unknown;
  };
}

/** Một khối nội dung mà render trả về. */
interface ResultBlockLike {
  /** Loại khối. */
  readonly type: string;
  /** Văn bản (với khối text). */
  readonly text?: string;
}

/** Định nghĩa công cụ đã đăng ký. */
interface ToolLike {
  /** Tên công cụ. */
  readonly name: string;
  /** Mô tả hướng mô hình. */
  readonly description: string;
  /** JSON Schema tham số sau khi defineTool biên dịch. */
  readonly parameters: unknown;
  /** Schema đầu ra + hàm hiển thị. */
  readonly output: {
    /** JSON Schema đầu ra. */
    readonly schema: unknown;
    /**
     * Chiếu giá trị canonical thành nội dung.
     * Nhận: args — tham số; value — giá trị canonical.
     * Trả: mảng khối nội dung.
     */
    render(args: unknown, value: unknown): ResultBlockLike[];
  };
  /** Trình bày lời gọi đang chờ (không khai trong bản gốc). */
  readonly presentCall?: (args: unknown) => unknown;
  /** Trình bày kết quả (không khai trong bản gốc). */
  readonly presentResult?: (args: unknown, result: unknown) => unknown;
  /** Phân loại song song (không khai trong bản gốc). */
  readonly isConcurrencySafe?: (args: unknown) => boolean;
  /** Hạn chờ (không khai trong bản gốc). */
  readonly timeoutMs?: number;
  /** Nạp trễ (không khai trong bản gốc). */
  readonly deferLoading?: true;
  /**
   * Thực thi sau khi registry kiểm tham số.
   * Nhận: args — tham số; exec — ngữ cảnh thực thi.
   * Trả: giá trị canonical.
   */
  execute(args: unknown, exec: unknown): Promise<unknown>;
}

/** Trạng thái turnBoundary mà giàn giả trả về. */
interface Boundary {
  /** Seq của lượt đang mở, hoặc null. */
  readonly openTurnStartSeq: number | null;
  /** Số lượt mới nhất. */
  readonly lastTurn: number;
}

/** Service có thể bỏ khỏi giàn để đo hành vi thiếu service. */
type OmitService = "tools" | "on" | "fs" | "sessionProjections" | "workingDirectory";

/** Tuỳ chọn dựng giàn đo. */
interface HarnessOptions {
  /** Trạng thái turnBoundary; "missing" = stateOf trả undefined. */
  readonly boundary?: Boundary | "missing";
  /** Thư mục làm việc giả. */
  readonly cwd?: string;
  /** Số tệp tối đa (đi qua Config thật). */
  readonly maxFiles?: number;
  /** Ghi đè lstat. */
  readonly lstat?: (path: string) => { readonly type: string } | undefined;
  /** Ghi đè resolve. */
  readonly resolve?: (path: string) => unknown;
  /** Ghi đè stat. */
  readonly stat?: (target: unknown) => { readonly type: string } | undefined;
  /** Ghi đè processPath. */
  readonly processPath?: (target: unknown) => string;
  /** Bỏ MỘT service để đo nhánh thiếu service. */
  readonly omit?: OmitService;
}

/** Một sự kiện đã ghi vào phiên giả. */
interface Appended {
  /** Loại sự kiện. */
  readonly type: string;
  /** Dữ liệu sự kiện. */
  readonly data: unknown;
}

/** Ngữ cảnh thực thi giả. */
interface ExecLike {
  /** Mã lời gọi. */
  readonly callId: string;
  /** Tín hiệu huỷ. */
  readonly signal: AbortSignal;
  /** Agent (vắng khi đo nhánh thiếu agent). */
  readonly agent?: {
    /** Phiên ghi sự kiện. */
    readonly session: {
      /**
       * Ghi sự kiện.
       * Nhận: type — loại; data — dữ liệu.
       * Trả: không.
       */
      append(type: string, data: unknown): void;
    };
  };
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cấu trúc. */
  readonly ctx: Record<string, unknown>;
  /** Các định nghĩa công cụ đã đăng ký. */
  readonly tools: ToolLike[];
  /** Các listener đã đăng ký. */
  readonly listeners: ((exec: unknown, result: unknown) => void)[];
  /** Sự kiện phiên đã ghi. */
  readonly appended: Appended[];
  /** Nhật ký gọi service theo thứ tự. */
  readonly calls: string[];
  /** Ngữ cảnh thực thi mặc định. */
  readonly exec: ExecLike;
  /** Công cụ DUY NHẤT đã đăng ký. */
  readonly tool: () => ToolLike;
  /**
   * Bắn sự kiện tools/result tới mọi listener.
   * Nhận: exec — lời gọi; isError — kết quả lỗi hay không.
   * Trả: không.
   */
  readonly notify: (exec: unknown, isError: boolean) => void;
}

/** Kết quả một lời gọi execute (đã bắt lỗi). */
interface RunOutcome {
  /** Giá trị khi thành công. */
  readonly value?: unknown;
  /** Lỗi khi thất bại. */
  readonly error?: {
    /** Tên lớp lỗi. */
    readonly name: string;
    /** Thông điệp. */
    readonly message: string;
    /** Mã lỗi (nếu có). */
    readonly code?: string;
    /** Có phải Error hay không. */
    readonly isError: boolean;
  };
}

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as PluginLike;
/** Lớp FsError của kernel — dùng để khẳng định CÙNG một lớp. */
const { FsError: KernelFsError } = (await import(FS_MODULE)) as { FsError: new (message: string, code: string) => Error };
/** Bản của ta (ARTEFACT đã build trong beforeAll) nhìn qua CÙNG hình dạng để so hai bên. */
let mine: PluginLike;

/** Đường dẫn ARTIFACT của ta (gán trong beforeAll). */
let artifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-tool-present-"));
  artifact = await buildPackage(outDir);
  mkdirSync(join(outDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(outDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(outDir, "node_modules", "@galaxy-blackhole"), "dir");
  mine = (await import(artifact)) as unknown as PluginLike;
}, 60_000);

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
 * Chuẩn hoá một giá trị thành Record để soi bằng khoá.
 * Nhận: value — giá trị bất kỳ (object hoặc hàm có thuộc tính, như nút schema của schemastery).
 * Trả: chính giá trị đó dưới dạng Record.
 * @throws {Error} khi giá trị không phải object/hàm.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) throw new Error("giá trị không phải object");
  return value as Record<string, unknown>;
}

/**
 * Đọc khoá định danh của một đích fs giả.
 * Nhận: target — đích bất kỳ.
 * Trả: chuỗi targetKey (hoặc String(target)).
 */
function targetKeyOf(target: unknown): string {
  if (typeof target === "object" && target !== null && "targetKey" in target) return String((target as { targetKey: unknown }).targetKey);
  return String(target);
}

/**
 * Dựng exec giả có phiên ghi sự kiện vào mảng cho trước.
 * Nhận: appended — mảng nhận sự kiện; callId — mã lời gọi; signal — tín hiệu huỷ (mặc định mới).
 * Trả: exec truyền cho execute.
 */
function makeExec(appended: Appended[], callId = "call_1", signal?: AbortSignal): ExecLike {
  return {
    callId,
    signal: signal ?? new AbortController().signal,
    agent: {
      session: {
        append: (type: string, data: unknown): void => {
          appended.push({ type, data });
        },
      },
    },
  };
}

/**
 * Dựng giàn đo cấu trúc: ghi lại đăng ký công cụ/listener, thứ tự gọi service và sự kiện phiên.
 * Nhận: options — tuỳ chọn trạng thái/ghi đè/service bỏ.
 * Trả: giàn đo (rỗng, chưa cài plugin).
 */
function makeHarness(options: HarnessOptions = {}): Harness {
  const tools: ToolLike[] = [];
  const listeners: ((exec: unknown, result: unknown) => void)[] = [];
  const appended: Appended[] = [];
  const calls: string[] = [];
  const defaultBoundary: Boundary = { openTurnStartSeq: 3, lastTurn: 7 };
  const ctx: Record<string, unknown> = {
    tools: {
      register: (definition: unknown): void => {
        tools.push(definition as ToolLike);
      },
    },
    on: (event: string, listener: (exec: unknown, result: unknown) => void): void => {
      if (event === "tools/result") listeners.push(listener);
    },
    sessionProjections: {
      stateOf: (_session: unknown, key: string): Boundary | undefined => {
        calls.push("stateOf:" + key);
        if (options.boundary === "missing") return undefined;
        return options.boundary ?? defaultBoundary;
      },
    },
    workingDirectory: {
      ensure: (_agent: unknown, signal?: AbortSignal): Promise<string> => {
        calls.push("ensure:" + String(signal !== undefined));
        return Promise.resolve(options.cwd ?? "/work");
      },
    },
    fs: {
      lstat: (path: string, opts?: { cwd?: string }, signal?: AbortSignal): Promise<{ readonly type: string } | undefined> => {
        calls.push("lstat:" + path + ":" + (opts?.cwd ?? "-") + ":" + String(signal !== undefined));
        return Promise.resolve((options.lstat ?? (() => ({ type: "file" })))(path));
      },
      resolve: (path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<unknown> => {
        calls.push("resolve:" + path + ":" + (opts?.cwd ?? "-") + ":" + String(opts?.signal !== undefined));
        return Promise.resolve((options.resolve ?? ((p: string) => ({ targetKey: "target:" + p })))(path));
      },
      stat: (target: unknown, signal?: AbortSignal): Promise<{ readonly type: string } | undefined> => {
        calls.push("stat:" + targetKeyOf(target) + ":" + String(signal !== undefined));
        const info = options.stat === undefined ? { type: "file" } : options.stat(target);
        return Promise.resolve(info);
      },
      processPath: (target: unknown): string => {
        calls.push("processPath:" + targetKeyOf(target));
        return (options.processPath ?? ((t: unknown) => "/proc/" + targetKeyOf(t)))(target);
      },
    },
  };
  if (options.omit !== undefined) delete ctx[options.omit];
  const exec = makeExec(appended);
  return {
    ctx,
    tools,
    listeners,
    appended,
    calls,
    exec,
    tool: (): ToolLike => {
      const tool = tools[0];
      if (tool === undefined) throw new Error("plugin không đăng ký công cụ nào");
      return tool;
    },
    notify: (target: unknown, isError: boolean): void => {
      for (const listener of listeners) listener(target, { isError });
    },
  };
}

/**
 * Cài MỘT bản lên giàn mới rồi trả giàn đã có đăng ký.
 * Nhận: plugin — bản cần cài; options — tuỳ chọn giàn (maxFiles đi qua Config thật).
 * Trả: giàn đo đã cài.
 */
function install(plugin: PluginLike, options: HarnessOptions = {}): Harness {
  const harness = makeHarness(options);
  plugin.apply(harness.ctx, plugin.Config(options.maxFiles === undefined ? {} : { maxFiles: options.maxFiles }));
  return harness;
}

/**
 * Chạy một lời gọi execute và bắt lỗi thành dữ liệu so sánh được.
 * Nhận: tool — định nghĩa công cụ; args — tham số; exec — ngữ cảnh thực thi.
 * Trả: { value } khi thành công, { error } khi ném.
 */
async function run(tool: ToolLike, args: unknown, exec: unknown): Promise<RunOutcome> {
  try {
    return { value: await tool.execute(args, exec) };
  } catch (error) {
    const e = error as Error & { code?: string };
    return { error: { name: e.name, message: e.message, code: e.code, isError: e instanceof Error } };
  }
}

/**
 * Chạy execute và giữ NGUYÊN đối tượng lỗi (để kiểm instanceof).
 * Nhận: tool — định nghĩa công cụ; args — tham số; exec — ngữ cảnh thực thi.
 * Trả: { value } hoặc { error }.
 */
async function runRaw(tool: ToolLike, args: unknown, exec: unknown): Promise<{ value?: unknown; error?: unknown }> {
  try {
    return { value: await tool.execute(args, exec) };
  } catch (error) {
    return { error };
  }
}

/**
 * Gọi một hàm đồng bộ và bắt tên lớp + thông điệp lỗi.
 * Nhận: fn — hàm cần gọi.
 * Trả: { name, message }; "không ném" khi không có lỗi.
 */
function caught(fn: () => unknown): { name: string; message: string } {
  try {
    fn();
    return { name: "không ném", message: "không ném" };
  } catch (error) {
    const e = error as Error;
    return { name: e.name, message: e.message };
  }
}

describe("A. TẬP EXPORT + name/inject — ta phải BẰNG bản gốc", () => {
  test("ca 1: 4 export BẰNG TỪNG TÊN trên artifact: Config · apply · inject · name", async () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["Config", "apply", "inject", "name"]);
    expect(Object.keys(oursModule).sort()).toEqual(Object.keys(stock as unknown as Record<string, unknown>).sort());
    expect(Object.keys(oursModule).sort()).toEqual(["Config", "apply", "inject", "name"]);
    expect(Object.hasOwn(oursModule, "default")).toBe(false);
  });

  test("ca 2: name 'tool-present' + inject đúng 4 service — hai bản trùng khít", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-present");
    expect([...mine.inject]).toEqual([...stock.inject]);
    expect([...mine.inject]).toEqual(["tools", "fs", "sessionProjections", "workingDirectory"]);
    expect(Array.isArray(mine.inject)).toBe(true);
  });
});

describe("B. Config — String/defaults/lỗi/~standard", () => {
  test("ca 3: String(Config) + type/meta/dict + ~standard TRÙNG từng phần tử", () => {
    const ours = mine.Config;
    const theirs = stock.Config;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe("{ maxFiles?: number }");
    expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
    expect(ours.type).toBe(theirs.type);
    expect(ours.type).toBe("object");
    expect(ours.meta).toEqual(theirs.meta);
    expect(ours.meta).toEqual({ default: {} });
    const oursDict = asRecord(ours.dict);
    const theirsDict = asRecord(theirs.dict);
    expect(Object.keys(oursDict)).toEqual(Object.keys(theirsDict));
    expect(Object.keys(oursDict)).toEqual(["maxFiles"]);
    const oursNode = asRecord(oursDict.maxFiles);
    const theirsNode = asRecord(theirsDict.maxFiles);
    expect(oursNode.type).toBe(theirsNode.type);
    expect(oursNode.type).toBe("number");
    expect(oursNode.meta).toEqual(theirsNode.meta);
    expect(oursNode.meta).toEqual({ default: 8 });
    expect(String(oursDict.maxFiles)).toBe(String(theirsDict.maxFiles));
    expect(String(oursDict.maxFiles)).toBe("number");
    expect(ours["~standard"].version).toBe(theirs["~standard"].version);
    expect(ours["~standard"].version).toBe(1);
    expect(ours["~standard"].vendor).toBe(theirs["~standard"].vendor);
    expect(ours["~standard"].vendor).toBe("schemastery");
  });

  test("ca 4: Config điền mặc định + giữ khoá lạ — cùng kết quả trên 14 đầu vào", () => {
    const cases: unknown[] = [
      undefined,
      null,
      {},
      { maxFiles: 8 },
      { maxFiles: 4 },
      { maxFiles: 0 },
      { maxFiles: -3 },
      { maxFiles: 1.5 },
      { maxFiles: NaN },
      { maxFiles: Infinity },
      { x: 1 },
      { maxFiles: null },
      new Date(0),
      Object.create(null) as Record<string, unknown>,
    ];
    for (const value of cases) {
      const ours = mine.Config(value);
      const theirs = stock.Config(value);
      expect(ours).toEqual(theirs);
      expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    }
    expect(mine.Config({})).toEqual({ maxFiles: 8 });
    expect(mine.Config({ x: 1 })).toEqual({ maxFiles: 8, x: 1 });
    expect(Object.is(mine.Config({ maxFiles: NaN }).maxFiles, NaN)).toBe(true);
    expect(mine.Config({ maxFiles: Infinity }).maxFiles).toBe(Infinity);
  });

  test("ca 5: Config nhánh lỗi — CÙNG tên lớp + thông điệp trên 10 đầu vào", () => {
    const bad: unknown[] = [{ maxFiles: "4" }, { maxFiles: true }, { maxFiles: [] }, { maxFiles: {} }, 5, "x", true, [], [1], () => {}];
    for (const value of bad) {
      const ours = caught(() => mine.Config(value));
      const theirs = caught(() => stock.Config(value));
      expect(ours).toEqual(theirs);
      expect(ours.name).toBe("ValidationError");
      expect(ours.message).not.toBe("không ném");
    }
  });

  test("ca 6: ~standard.validate trả value/issues GIỐNG HỆT (cordis đọc đúng đường này)", () => {
    const cases: unknown[] = [undefined, null, {}, { maxFiles: 4 }, { maxFiles: "x" }, { x: 1 }, 5, [], [1], "x"];
    for (const value of cases) {
      expect(mine.Config["~standard"].validate(value)).toEqual(stock.Config["~standard"].validate(value));
    }
    expect(mine.Config["~standard"].validate({ maxFiles: "x" })).toEqual({
      issues: [{ message: "$.maxFiles expected number but got x", path: ["maxFiles"] }],
    });
    const root = asRecord(mine.Config["~standard"].validate(5));
    const issue = (root.issues as Record<string, unknown>[])[0];
    if (issue === undefined) throw new Error("validate(5) phải trả issue");
    expect(issue.message).toBe("expected object but got 5");
    expect(Object.hasOwn(issue, "path")).toBe(true);
    expect(issue.path).toBeUndefined();
  });

  test("ca 7: apply từ chối maxFiles không nguyên dương — CÙNG nguyên văn; 1/2/8 đăng ký đúng một công cụ", () => {
    const bad = [0, -1, 1.5, NaN, Infinity, "8"];
    for (const maxFiles of bad) {
      const config = { maxFiles } as unknown as { maxFiles: number };
      const ours = caught(() => mine.apply(makeHarness().ctx, config));
      const theirs = caught(() => stock.apply(makeHarness().ctx, config));
      expect(ours).toEqual(theirs);
      expect(ours.message).toBe("present requires a positive integer maxFiles");
    }
    for (const maxFiles of [1, 2, 8]) {
      const ours = install(mine, { maxFiles });
      const theirs = install(stock, { maxFiles });
      expect(ours.tools.length).toBe(1);
      expect(theirs.tools.length).toBe(1);
      expect(ours.listeners.length).toBe(1);
      expect(theirs.listeners.length).toBe(1);
    }
  });
});

describe("C. Định nghĩa công cụ present — name/description/parameters/output/render/presentCall", () => {
  test("ca 8: name 'present' + description NGUYÊN VĂN + đúng 5 khoá công cụ", () => {
    const ours = install(mine).tool();
    const theirs = install(stock).tool();
    expect(ours.name).toBe(theirs.name);
    expect(ours.name).toBe("present");
    expect(ours.description).toBe(theirs.description);
    expect(ours.description).toBe(
      "Declare existing files as final deliverables for the user. Use it when the user needs a separate file, especially Office documents, spreadsheets, and slide decks; prefer your final response when that suffices. The user opens the current files; their contents are not copied.",
    );
    expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    expect(Object.keys(ours)).toEqual(["name", "description", "parameters", "output", "execute"]);
  });

  test("ca 9: parameters + JSON Schema đầu ra TRÙNG từng phần tử", () => {
    const ours = install(mine).tool();
    const theirs = install(stock).tool();
    expect(ours.parameters).toEqual(theirs.parameters);
    expect(ours.parameters).toEqual({
      type: "object",
      properties: {
        files: {
          type: "array",
          description: "Usually the 1-2 most important deliverables; at most 4 per call.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              path: {
                type: "string",
                description: "Path of an existing regular file. Relative paths use the Session working directory.",
              },
              description: { type: "string", description: "Brief description for the user." },
            },
            required: ["path"],
          },
        },
      },
      required: ["files"],
    });
    expect(ours.output.schema).toEqual(theirs.output.schema);
    expect(ours.output.schema).toEqual({
      type: "object",
      additionalProperties: false,
      properties: {
        turn: { type: "integer" },
        files: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: { path: { type: "string" }, description: { type: "string" } },
            required: ["path"],
          },
        },
      },
      required: ["turn", "files"],
    });
  });

  test("ca 10: render ghép 'Presented <path>' bằng xuống dòng — 0/1/2 tệp", () => {
    const ours = install(mine).tool();
    const theirs = install(stock).tool();
    const cases: unknown[] = [
      { files: [] },
      { files: [{ path: "a" }] },
      { files: [{ path: "a" }, { path: "b", description: "d" }] },
    ];
    for (const value of cases) {
      expect(ours.output.render({}, value)).toEqual(theirs.output.render({}, value));
    }
    expect(ours.output.render({}, { files: [] })).toEqual([{ type: "text", text: "" }]);
    expect(ours.output.render({}, { files: [{ path: "a" }, { path: "b" }] })).toEqual([{ type: "text", text: "Presented a\nPresented b" }]);
    expect(Object.keys(ours.output).sort()).toEqual(Object.keys(theirs.output).sort());
    expect(Object.keys(ours.output).sort()).toEqual(["render", "schema"]);
  });

  test("ca 11: presentCall/presentResult/isConcurrencySafe/timeoutMs/deferLoading đều VẮNG như bản gốc", () => {
    const ours = install(mine).tool();
    const theirs = install(stock).tool();
    expect(ours.presentCall).toBeUndefined();
    expect(theirs.presentCall).toBeUndefined();
    expect(ours.presentResult).toBeUndefined();
    expect(theirs.presentResult).toBeUndefined();
    expect(ours.isConcurrencySafe).toBeUndefined();
    expect(theirs.isConcurrencySafe).toBeUndefined();
    expect(ours.timeoutMs).toBeUndefined();
    expect(theirs.timeoutMs).toBeUndefined();
    expect(ours.deferLoading).toBeUndefined();
    expect(theirs.deferLoading).toBeUndefined();
  });

  test("ca 12: defineTool từ chối CÙNG tập tham số hỏng — cùng tên lỗi + thông điệp", async () => {
    const ours = install(mine);
    const theirs = install(stock);
    const bad: unknown[] = [
      undefined,
      {},
      { files: "x" },
      { files: null },
      { files: [{}] },
      { files: [{ path: 5 }] },
      { files: [{ path: "a", description: 5 }] },
      { files: [{ path: "a", extra: 1 }] },
    ];
    for (const args of bad) {
      const a = await run(ours.tool(), args, ours.exec);
      const b = await run(theirs.tool(), args, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error).toBeDefined();
      expect(a.error?.name).toBe(b.error?.name);
    }
  });
});

describe("D. execute — đường THÀNH CÔNG + sự kiện deliverables/presented", () => {
  test("ca 13: execute 1 tệp — cùng kết quả + cùng thứ tự gọi fs; CHƯA ghi sự kiện trước tools/result", async () => {
    const ours = install(mine);
    const theirs = install(stock);
    const args = { files: [{ path: "notes.md", description: "Bản nháp" }] };
    const a = await run(ours.tool(), args, ours.exec);
    const b = await run(theirs.tool(), args, theirs.exec);
    expect(a).toEqual(b);
    expect(a.value).toEqual({ turn: 7, files: [{ path: "/proc/target:notes.md", description: "Bản nháp" }] });
    expect(ours.calls).toEqual(theirs.calls);
    expect(ours.calls).toEqual([
      "stateOf:turnBoundary",
      "ensure:true",
      "lstat:notes.md:/work:true",
      "resolve:notes.md:/work:true",
      "stat:target:notes.md:true",
      "processPath:target:notes.md",
    ]);
    expect(ours.appended).toEqual([]);
    expect(theirs.appended).toEqual([]);
  });

  test("ca 14: tools/result thành công ghi ĐÚNG MỘT deliverables/presented rồi xoá pending", async () => {
    const ours = install(mine);
    const theirs = install(stock);
    const args = { files: [{ path: "notes.md", description: "Bản nháp" }] };
    await run(ours.tool(), args, ours.exec);
    await run(theirs.tool(), args, theirs.exec);
    ours.notify(ours.exec, false);
    theirs.notify(theirs.exec, false);
    expect(ours.appended).toEqual(theirs.appended);
    expect(ours.appended).toEqual([
      { type: "deliverables/presented", data: { turn: 7, callId: "call_1", files: [{ path: "/proc/target:notes.md", description: "Bản nháp" }] } },
    ]);
    ours.notify(ours.exec, false);
    theirs.notify(theirs.exec, false);
    expect(ours.appended.length).toBe(1);
    expect(theirs.appended.length).toBe(1);
  });

  test("ca 15: result.isError VẪN xoá pending nhưng KHÔNG ghi; exec lạ không làm gì", async () => {
    const ours = install(mine);
    const theirs = install(stock);
    const args = { files: [{ path: "a" }] };
    await run(ours.tool(), args, ours.exec);
    await run(theirs.tool(), args, theirs.exec);
    ours.notify(ours.exec, true);
    theirs.notify(theirs.exec, true);
    expect(ours.appended).toEqual([]);
    expect(theirs.appended).toEqual([]);
    ours.notify(ours.exec, false);
    theirs.notify(theirs.exec, false);
    expect(ours.appended).toEqual([]);
    expect(theirs.appended).toEqual([]);
    ours.notify({ callId: "ghost" }, false);
    theirs.notify({ callId: "ghost" }, false);
    expect(ours.appended).toEqual([]);
    expect(theirs.appended).toEqual([]);
  });

  test("ca 16: hai exec độc lập — mỗi lượt một sự kiện, đúng callId, đúng thứ tự", async () => {
    const ours = install(mine);
    const theirs = install(stock);
    const args = { files: [{ path: "a" }, { path: "b" }] };
    const oursSecond = makeExec(ours.appended, "call_2");
    const theirsSecond = makeExec(theirs.appended, "call_2");
    await run(ours.tool(), args, ours.exec);
    await run(ours.tool(), args, oursSecond);
    await run(theirs.tool(), args, theirs.exec);
    await run(theirs.tool(), args, theirsSecond);
    ours.notify(oursSecond, false);
    ours.notify(ours.exec, false);
    theirs.notify(theirsSecond, false);
    theirs.notify(theirs.exec, false);
    expect(ours.appended).toEqual(theirs.appended);
    expect(ours.appended.map((event) => asRecord(event.data).callId)).toEqual(["call_2", "call_1"]);
    expect(asRecord(ours.appended[0]?.data).files).toEqual([
      { path: "/proc/target:a" },
      { path: "/proc/target:b" },
    ]);
  });
});

describe("E. execute — các nhánh lỗi + thiếu service", () => {
  test("ca 17: thiếu agent ⇒ 'present requires an agent Session' TRƯỚC mọi service", async () => {
    const ours = install(mine);
    const theirs = install(stock);
    const exec = { callId: "call_x", signal: new AbortController().signal };
    const a = await run(ours.tool(), { files: [{ path: "a" }] }, exec);
    const b = await run(theirs.tool(), { files: [{ path: "a" }] }, exec);
    expect(a).toEqual(b);
    expect(a.error?.message).toBe("present requires an agent Session");
    expect(ours.calls).toEqual([]);
    expect(theirs.calls).toEqual([]);
  });

  test("ca 18: thiếu turnBoundary HOẶC openTurnStartSeq=null ⇒ 'present requires an open turn'", async () => {
    const boundaries: (Boundary | "missing")[] = ["missing", { openTurnStartSeq: null, lastTurn: 7 }];
    for (const boundary of boundaries) {
      const ours = install(mine, { boundary });
      const theirs = install(stock, { boundary });
      const a = await run(ours.tool(), { files: [{ path: "a" }] }, ours.exec);
      const b = await run(theirs.tool(), { files: [{ path: "a" }] }, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error?.message).toBe("present requires an open turn");
      expect(ours.calls).toEqual(["stateOf:turnBoundary"]);
      expect(theirs.calls).toEqual(["stateOf:turnBoundary"]);
    }
  });

  test("ca 19: 0 tệp hoặc vượt maxFiles ⇒ 'present accepts 1 to N files' TRƯỚC ensure", async () => {
    const cases: { maxFiles: number; files: { path: string }[]; message: string }[] = [
      { maxFiles: 8, files: [], message: "present accepts 1 to 8 files" },
      { maxFiles: 1, files: [{ path: "a" }, { path: "b" }], message: "present accepts 1 to 1 files" },
      { maxFiles: 2, files: [{ path: "a" }, { path: "b" }, { path: "c" }], message: "present accepts 1 to 2 files" },
    ];
    for (const item of cases) {
      const ours = install(mine, { maxFiles: item.maxFiles });
      const theirs = install(stock, { maxFiles: item.maxFiles });
      const a = await run(ours.tool(), { files: item.files }, ours.exec);
      const b = await run(theirs.tool(), { files: item.files }, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error?.message).toBe(item.message);
      expect(ours.calls).toEqual(["stateOf:turnBoundary"]);
      expect(theirs.calls).toEqual(["stateOf:turnBoundary"]);
    }
  });

  test("ca 20: path rỗng/toàn khoảng trắng ⇒ 'present requires a non-empty file path' TRƯỚC lstat", async () => {
    for (const path of ["", "   ", "\t\n"]) {
      const ours = install(mine, { lstat: () => { throw new Error("lstat không được gọi"); } });
      const theirs = install(stock, { lstat: () => { throw new Error("lstat không được gọi"); } });
      const a = await run(ours.tool(), { files: [{ path }] }, ours.exec);
      const b = await run(theirs.tool(), { files: [{ path }] }, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error?.message).toBe("present requires a non-empty file path");
      expect(ours.calls).toEqual(["stateOf:turnBoundary", "ensure:true"]);
      expect(theirs.calls).toEqual(["stateOf:turnBoundary", "ensure:true"]);
    }
  });

  test("ca 21: lstat thấy directory/symlink ⇒ 'Cannot present X: not a regular file' TRƯỚC resolve", async () => {
    for (const type of ["directory", "symlink"] as const) {
      const ours = install(mine, { lstat: () => ({ type }) });
      const theirs = install(stock, { lstat: () => ({ type }) });
      const a = await run(ours.tool(), { files: [{ path: "dir" }] }, ours.exec);
      const b = await run(theirs.tool(), { files: [{ path: "dir" }] }, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error?.message).toBe("Cannot present dir: not a regular file");
      expect(ours.calls).toEqual(["stateOf:turnBoundary", "ensure:true", "lstat:dir:/work:true"]);
      expect(theirs.calls).toEqual(["stateOf:turnBoundary", "ensure:true", "lstat:dir:/work:true"]);
    }
  });

  test("ca 22: stat undefined ⇒ FsError 'FS_NOT_FOUND' — CÙNG LỚP kernel + nguyên văn", async () => {
    const ours = install(mine, { stat: () => undefined });
    const theirs = install(stock, { stat: () => undefined });
    const a = await runRaw(ours.tool(), { files: [{ path: "missing.md" }] }, ours.exec);
    const b = await runRaw(theirs.tool(), { files: [{ path: "missing.md" }] }, theirs.exec);
    expect(a.error).toBeInstanceOf(Error);
    expect(b.error).toBeInstanceOf(Error);
    expect(a.error).toBeInstanceOf(KernelFsError);
    expect(b.error).toBeInstanceOf(KernelFsError);
    const oursError = a.error as Error & { code?: string };
    const theirsError = b.error as Error & { code?: string };
    expect(oursError.name).toBe("FsError");
    expect(oursError.code).toBe("FS_NOT_FOUND");
    expect(oursError.message).toBe("Cannot present missing.md: file not found. Check the path, create the file if needed, and retry.");
    expect(oursError.name).toBe(theirsError.name);
    expect(oursError.code).toBe(theirsError.code);
    expect(oursError.message).toBe(theirsError.message);
    expect(ours.calls).toEqual(theirs.calls);
    ours.notify(ours.exec, false);
    theirs.notify(theirs.exec, false);
    expect(ours.appended).toEqual([]);
    expect(theirs.appended).toEqual([]);
  });

  test("ca 23: stat thấy directory ⇒ 'Cannot present X: not a regular file' SAU resolve", async () => {
    const ours = install(mine, { stat: () => ({ type: "directory" }) });
    const theirs = install(stock, { stat: () => ({ type: "directory" }) });
    const a = await run(ours.tool(), { files: [{ path: "dir" }] }, ours.exec);
    const b = await run(theirs.tool(), { files: [{ path: "dir" }] }, theirs.exec);
    expect(a).toEqual(b);
    expect(a.error?.message).toBe("Cannot present dir: not a regular file");
    expect(ours.calls).toEqual([
      "stateOf:turnBoundary",
      "ensure:true",
      "lstat:dir:/work:true",
      "resolve:dir:/work:true",
      "stat:target:dir:true",
    ]);
    expect(theirs.calls).toEqual(ours.calls);
  });

  test("ca 24: signal đã huỷ ⇒ throwIfAborted SAU khi mọi tệp qua fs; KHÔNG set pending", async () => {
    const controller = new AbortController();
    controller.abort();
    const ours = install(mine);
    const theirs = install(stock);
    const oursExec = makeExec(ours.appended, "call_abort", controller.signal);
    const theirsExec = makeExec(theirs.appended, "call_abort", controller.signal);
    const a = await run(ours.tool(), { files: [{ path: "a" }] }, oursExec);
    const b = await run(theirs.tool(), { files: [{ path: "a" }] }, theirsExec);
    expect(a).toEqual(b);
    expect(a.error?.name).toBe("AbortError");
    expect(ours.calls).toEqual(theirs.calls);
    expect(ours.calls).toEqual([
      "stateOf:turnBoundary",
      "ensure:true",
      "lstat:a:/work:true",
      "resolve:a:/work:true",
      "stat:target:a:true",
      "processPath:target:a",
    ]);
    ours.notify(oursExec, false);
    theirs.notify(theirsExec, false);
    expect(ours.appended).toEqual([]);
    expect(theirs.appended).toEqual([]);
  });

  test("ca 25: thứ tự kiểm — turn trước count, count trước fs, path rỗng trước lstat", async () => {
    const cases: { label: string; options: HarnessOptions; args: unknown; message: string; calls: string[] }[] = [
      {
        label: "turn trước count",
        options: { boundary: "missing", omit: "fs" },
        args: { files: [] },
        message: "present requires an open turn",
        calls: ["stateOf:turnBoundary"],
      },
      {
        label: "count trước fs",
        options: { omit: "fs" },
        args: { files: [] },
        message: "present accepts 1 to 8 files",
        calls: ["stateOf:turnBoundary"],
      },
      {
        label: "path rỗng trước lstat",
        options: { lstat: () => { throw new Error("lstat không được gọi"); } },
        args: { files: [{ path: " " }] },
        message: "present requires a non-empty file path",
        calls: ["stateOf:turnBoundary", "ensure:true"],
      },
    ];
    for (const item of cases) {
      const ours = install(mine, item.options);
      const theirs = install(stock, item.options);
      const a = await run(ours.tool(), item.args, ours.exec);
      const b = await run(theirs.tool(), item.args, theirs.exec);
      expect(a.error?.message).toBe(item.message);
      expect(b.error?.message).toBe(item.message);
      expect(ours.calls).toEqual(item.calls);
      expect(theirs.calls).toEqual(item.calls);
    }
  });

  test("ca 26: thiếu service — apply thiếu tools/on + execute thiếu projections/workingDirectory/fs CÙNG TypeError", async () => {
    const oursNoTools = caught(() => mine.apply({}, { maxFiles: 8 }));
    const theirsNoTools = caught(() => stock.apply({}, { maxFiles: 8 }));
    expect(oursNoTools).toEqual(theirsNoTools);
    expect(oursNoTools.name).toBe("TypeError");
    expect(oursNoTools.message).toBe("undefined is not an object (evaluating 'ctx.tools.register')");

    const oursNoOn = caught(() => mine.apply({ tools: { register: (): void => undefined } }, { maxFiles: 8 }));
    const theirsNoOn = caught(() => stock.apply({ tools: { register: (): void => undefined } }, { maxFiles: 8 }));
    expect(oursNoOn.name).toBe("TypeError");
    expect(theirsNoOn.name).toBe("TypeError");
    expect(oursNoOn.message).toContain("ctx.on");
    expect(theirsNoOn.message).toContain("ctx.on");

    const missing: { omit: OmitService; message: string }[] = [
      { omit: "sessionProjections", message: "undefined is not an object (evaluating 'ctx.sessionProjections.stateOf')" },
      { omit: "workingDirectory", message: "undefined is not an object (evaluating 'ctx.workingDirectory.ensure')" },
      { omit: "fs", message: "undefined is not an object (evaluating 'ctx.fs.lstat')" },
    ];
    for (const item of missing) {
      const ours = install(mine, { omit: item.omit });
      const theirs = install(stock, { omit: item.omit });
      const a = await run(ours.tool(), { files: [{ path: "a" }] }, ours.exec);
      const b = await run(theirs.tool(), { files: [{ path: "a" }] }, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error?.name).toBe("TypeError");
      expect(a.error?.message).toBe(item.message);
    }
  });

  test("ca 27: maxFiles=1 nhận ĐÚNG 1 tệp và ghi sự kiện; tệp thứ hai bị từ chối", async () => {
    const ours = install(mine, { maxFiles: 1 });
    const theirs = install(stock, { maxFiles: 1 });
    const single = { files: [{ path: "only.md" }] };
    const a = await run(ours.tool(), single, ours.exec);
    const b = await run(theirs.tool(), single, theirs.exec);
    expect(a).toEqual(b);
    expect(a.value).toEqual({ turn: 7, files: [{ path: "/proc/target:only.md" }] });
    ours.notify(ours.exec, false);
    theirs.notify(theirs.exec, false);
    expect(ours.appended).toEqual(theirs.appended);
    expect(ours.appended.length).toBe(1);

    const two = { files: [{ path: "a" }, { path: "b" }] };
    const c = await run(ours.tool(), two, ours.exec);
    const d = await run(theirs.tool(), two, theirs.exec);
    expect(c).toEqual(d);
    expect(c.error?.message).toBe("present accepts 1 to 1 files");
  });
});
