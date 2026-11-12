/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-str-replace-editor: mỗi ca cài CẢ HAI bản (ta + bundle gốc @deepseek-ai/dsh-tool-str-replace-editor) lên cùng một giàn ctx.fs giả rồi so tập export, Config, schema tham số, presentCall, bốn lệnh view/create/str_replace/insert và MỌI chuỗi lỗi; cộng ca khẳng định gbh.provenance và bề mặt lib/index.js.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { buildPackage } from "../../packages/host/tool-str-replace-editor/build.ts";
import * as oursModule from "../../packages/host/tool-str-replace-editor/src/index.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-str-replace-editor");
/** Bundle gốc đã build (346 dòng) — bản đối chứng. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục gói của ta. */
const OURS = join(REPO, "packages", "host", "tool-str-replace-editor");
/** Artifact của ta (build TRONG thư mục gói nên nhãn comment là `// src/index.ts`). */
const ARTIFACT = join(OURS, "lib", "index.js");
/** Lớp FsError của kernel — để khẳng định CÙNG một lớp. */
const FS_MODULE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-fs", "lib", "index.js");
/**
 * Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp dsh-fs/dsh-tools/… cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ `toBeInstanceOf(KernelFsError)` TRƯỢT ở ca 15 và ca 20
 * (ca 20 còn mất phần dịch dấu từ chối sandbox). Nạp artefact từ thư mục có symlink node_modules/
 * @deepseek-ai → kernel (pattern tests/host/shell.test.ts) thì hai bên dùng CHUNG một lớp lỗi.
 */
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

/** Định nghĩa công cụ đã đăng ký (sau khi defineTool biên dịch). */
interface ToolLike {
  /** Tên công cụ. */
  readonly name: string;
  /** Mô tả hướng mô hình. */
  readonly description: string;
  /** JSON Schema tham số sau khi defineTool biên dịch. */
  readonly parameters: Record<string, unknown>;
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
  /** Trình bày lời gọi đang chờ. */
  readonly presentCall?: (args: unknown) => unknown;
  /**
   * Thực thi sau khi registry kiểm tham số.
   * Nhận: args — tham số; exec — ngữ cảnh thực thi.
   * Trả: giá trị canonical.
   */
  execute(args: unknown, exec: unknown): Promise<unknown>;
}

/** Ngữ cảnh thực thi giả. */
interface ExecLike {
  /** Mã lời gọi. */
  readonly callId: string;
  /** Tín hiệu huỷ. */
  readonly signal: AbortSignal;
  /** Agent gọi (mang đúng một `session` để policy phân giải). */
  readonly agent: { readonly session: { readonly id: string } };
}

/** Một mục trong fs giả. */
interface FakeNode {
  /** Loại mục. */
  readonly type: "file" | "directory" | "symlink";
  /** Nội dung (với mục `file`). */
  readonly content?: string;
}

/** Chính sách sandbox giả — đúng hai thành viên mà plugin đọc. */
interface FakePolicy {
  /** Chế độ hiệu lực. */
  readonly mode: string;
  /**
   * Phân giải chính sách cho một lời gọi.
   * Nhận: input — `{}` hoặc `{ session }`.
   * Trả: chính sách `{ mode }`.
   */
  resolve(input: { readonly session?: unknown }): { readonly mode: string };
}

/** Tuỳ chọn dựng giàn đo. */
interface HarnessOptions {
  /** Các mục fs ban đầu (đường dẫn tuyệt đối → mục). */
  readonly nodes?: Record<string, FakeNode>;
  /** Có mặt `fs.sandboxMode` hay không (undefined = fs không giam giữ). */
  readonly sandboxMode?: string;
  /** Có service `sandboxPolicy` hay không; giá trị là `mode` nó trả. */
  readonly policyMode?: string;
  /** Phiên bản mà waterfall `fs/edit-intent` chốt (undefined = để fallback). */
  readonly editIntentVersion?: number;
  /** Lỗi mà `writeText` ném (đo nhánh từ chối sandbox). */
  readonly writeThrows?: unknown;
  /** Cấu hình thô đi qua `Config` thật. */
  readonly config?: Record<string, unknown>;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cấu trúc. */
  readonly ctx: Record<string, unknown>;
  /** Các định nghĩa công cụ đã đăng ký. */
  readonly tools: ToolLike[];
  /** Nhật ký gọi service theo thứ tự. */
  readonly calls: string[];
  /** Ngữ cảnh thực thi mặc định. */
  readonly exec: ExecLike;
  /** Công cụ DUY NHẤT đã đăng ký. */
  readonly tool: () => ToolLike;
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
const stock = (await import(STOCK)) as unknown as PluginLike;
/** Lớp FsError của kernel — dùng để khẳng định CÙNG một lớp. */
const { FsError: KernelFsError } = (await import(FS_MODULE)) as { FsError: new (message: string, code: string) => Error };
/** Bản của ta (ARTEFACT đã build trong beforeAll) nhìn qua CÙNG hình dạng để so hai bên. */
let mine: PluginLike;

/** Đường dẫn artifact build trong beforeAll (thư mục tạm). */
let builtArtifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll) — ca 3 đòi CHỈ có index.js + types. */
let outDir = "";
/** Thư mục tạm NẠP artifact, có node_modules/@deepseek-ai → kernel (gán trong beforeAll) — tách RIÊNG để ca 3 vẫn thấy thư mục build sạch. */
let runDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-tool-str-replace-editor-"));
  builtArtifact = await buildPackage(outDir);
  // Bản NẠP riêng: chép artifact sang thư mục khác rồi symlink peer kernel, để thư mục build vẫn SẠCH
  // (ca 3 đòi đúng hai mục index.js + types) mà artefact vẫn dùng chung lớp lỗi với kernel.
  runDir = mkdtempSync(join(tmpdir(), "gbh-tool-str-replace-editor-run-"));
  copyFileSync(builtArtifact, join(runDir, "index.js"));
  mkdirSync(join(runDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(runDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(runDir, "node_modules", "@galaxy-blackhole"), "dir");
  mine = (await import(join(runDir, "index.js"))) as unknown as PluginLike;
}, 60_000);

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
  if (runDir !== "") await rm(runDir, { recursive: true, force: true });
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
 * Gọi một hàm đồng bộ và bắt tên lớp + thông điệp lỗi.
 * Nhận: fn — hàm cần gọi.
 * Trả: { name, message }; "không ném" khi không có lỗi.
 */
function caught(fn: () => unknown): { readonly name: string; readonly message: string } {
  try {
    fn();
    return { name: "không ném", message: "không ném" };
  } catch (error) {
    const e = error as Error;
    return { name: e.name, message: e.message };
  }
}

/**
 * Dựng fs giả + context cấu trúc, ghi lại MỌI lời gọi service theo thứ tự.
 * Nhận: options — tuỳ chọn mục fs/sandbox/waterfall/lỗi ghi.
 * Trả: giàn đo rỗng (chưa cài plugin).
 */
function makeHarness(options: HarnessOptions = {}): Harness {
  const tools: ToolLike[] = [];
  const calls: string[] = [];
  const nodes = new Map<string, FakeNode>(Object.entries(options.nodes ?? {}));
  const policy: FakePolicy | undefined = options.policyMode === undefined ? undefined : {
    mode: options.policyMode,
    resolve: (input: { readonly session?: unknown }): { readonly mode: string } => {
      calls.push("policy.resolve:" + JSON.stringify(input));
      return { mode: options.policyMode as string };
    }
  };
  const fs: Record<string, unknown> = {
    resolve: (path: string, opts?: { readonly signal?: AbortSignal }): Promise<{ readonly displayPath: string }> => {
      calls.push("resolve:" + path + ":" + String(opts?.signal !== undefined));
      return Promise.resolve({ displayPath: path });
    },
    stat: (target: { readonly displayPath: string }): Promise<{ readonly type: string; readonly version: number } | undefined> => {
      calls.push("stat:" + target.displayPath);
      const node = nodes.get(target.displayPath);
      return Promise.resolve(node === undefined ? undefined : { type: node.type, version: 1 });
    },
    readText: (target: { readonly displayPath: string }): Promise<string> => {
      calls.push("readText:" + target.displayPath);
      return Promise.resolve(nodes.get(target.displayPath)?.content ?? "");
    },
    writeText: (target: { readonly displayPath: string }, content: string, intent: unknown, _signal: AbortSignal | undefined, sandboxPolicy: { readonly mode: string } | undefined): Promise<{ readonly type: string; readonly version: number }> => {
      calls.push("writeText:" + target.displayPath + ":" + JSON.stringify(content) + ":" + JSON.stringify(intent) + ":" + (sandboxPolicy === undefined ? "-" : sandboxPolicy.mode));
      if (options.writeThrows !== undefined) return Promise.reject(options.writeThrows);
      nodes.set(target.displayPath, { type: "file", content });
      return Promise.resolve({ type: "file", version: 2 });
    },
    listDir: (target: { readonly displayPath: string }): Promise<readonly { readonly name: string; readonly type: string; readonly target: { readonly displayPath: string } }[]> => {
      calls.push("listDir:" + target.displayPath);
      const out: { name: string; type: string; target: { displayPath: string } }[] = [];
      for (const [path, node] of nodes) {
        if (dirname(path) === target.displayPath) out.push({ name: basename(path), type: node.type, target: { displayPath: path } });
      }
      return Promise.resolve(out);
    }
  };
  if (options.sandboxMode !== undefined) fs["sandboxMode"] = options.sandboxMode;
  const ctx: Record<string, unknown> = {
    tools: {
      register: (definition: unknown): void => {
        tools.push(definition as ToolLike);
      }
    },
    fs,
    waterfall: (name: string, _target: unknown, _exec: unknown, fallback: () => unknown): Promise<unknown> => {
      calls.push("waterfall:" + name);
      if (name === "fs/edit-intent" && options.editIntentVersion !== undefined) return Promise.resolve({ version: options.editIntentVersion });
      return Promise.resolve(fallback());
    },
    emit: (event: string, target: { readonly displayPath: string }, info: unknown, _exec: unknown): void => {
      const record = info as { readonly kind?: string; readonly version?: unknown };
      calls.push("emit:" + event + ":" + target.displayPath + ":" + String(record.kind) + ":" + String(record.version));
    },
    get: (name: string): unknown => {
      calls.push("get:" + name);
      return policy;
    }
  };
  const exec: ExecLike = { callId: "call_1", signal: new AbortController().signal, agent: { session: { id: "session-1" } } };
  return {
    ctx,
    tools,
    calls,
    exec,
    tool: (): ToolLike => {
      const tool = tools[0];
      if (tool === undefined) throw new Error("plugin không đăng ký công cụ nào");
      return tool;
    }
  };
}

/**
 * Cài MỘT bản lên giàn mới rồi trả giàn đã có đăng ký.
 * Nhận: plugin — bản cần cài; options — tuỳ chọn giàn (cấu hình đi qua Config thật).
 * Trả: giàn đo đã cài.
 */
function install(plugin: PluginLike, options: HarnessOptions = {}): Harness {
  const harness = makeHarness(options);
  plugin.apply(harness.ctx, plugin.Config(options.config ?? {}));
  return harness;
}

/**
 * Cài CẢ HAI bản trên hai giàn cùng tuỳ chọn.
 * Nhận: options — tuỳ chọn giàn dùng chung.
 * Trả: { ours, theirs } — hai giàn đo song song.
 */
function installBoth(options: HarnessOptions = {}): { readonly ours: Harness; readonly theirs: Harness } {
  return { ours: install(mine, options), theirs: install(stock, options) };
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
async function runRaw(tool: ToolLike, args: unknown, exec: unknown): Promise<{ readonly value?: unknown; readonly error?: unknown }> {
  try {
    return { value: await tool.execute(args, exec) };
  } catch (error) {
    return { error };
  }
}

/**
 * Cài cả hai bản, chạy CÙNG một lời gọi trên hai giàn, rồi so kết quả + nhật ký gọi.
 * Nhận: options — tuỳ chọn giàn; args — tham số lời gọi.
 * Trả: { a, b } — kết quả hai bên sau khi đã so khớp.
 */
async function bothCall(options: HarnessOptions, args: unknown): Promise<{ readonly a: RunOutcome; readonly b: RunOutcome }> {
  const { ours, theirs } = installBoth(options);
  const a = await run(ours.tool(), args, ours.exec);
  const b = await run(theirs.tool(), args, theirs.exec);
  expect(a).toEqual(b);
  expect(ours.calls).toEqual(theirs.calls);
  return { a, b };
}
/** Mục fs của một tệp văn bản dùng lại ở nhiều ca. */
const FILE_NODES: Record<string, FakeNode> = { "/repo/a.txt": { type: "file", content: "alpha\nbeta\ngamma\n" } };

/** Cây thư mục 3 mức để đo đệ quy 2 mức + lọc mục ẩn/node_modules/__pycache__. */
const DIR_NODES: Record<string, FakeNode> = {
  "/repo": { type: "directory" },
  "/repo/a.txt": { type: "file", content: "A" },
  "/repo/z.txt": { type: "file", content: "Z" },
  "/repo/.hidden": { type: "file", content: "h" },
  "/repo/node_modules": { type: "directory" },
  "/repo/node_modules/pkg.txt": { type: "file", content: "p" },
  "/repo/__pycache__": { type: "directory" },
  "/repo/__pycache__/c.pyc": { type: "file", content: "c" },
  "/repo/sub": { type: "directory" },
  "/repo/sub/b.txt": { type: "file", content: "B" },
  "/repo/sub/deep": { type: "directory" },
  "/repo/sub/deep/c.txt": { type: "file", content: "C" },
  "/repo/sub/deep/deeper": { type: "directory" },
  "/repo/sub/deep/deeper/d.txt": { type: "file", content: "D" }
};

describe("A. TẬP EXPORT + name/inject — ta phải BẰNG bản gốc", () => {
  test("ca 1: 4 export BẰNG TỪNG TÊN trên artifact + trên src: Config · apply · inject · name", async () => {
    const artifact = (await import(ARTIFACT)) as Record<string, unknown>;
    const stockKeys = Object.keys(stock as unknown as Record<string, unknown>).sort();
    expect(Object.keys(artifact).sort()).toEqual(stockKeys);
    expect(Object.keys(artifact).sort()).toEqual(["Config", "apply", "inject", "name"]);
    expect(Object.hasOwn(artifact, "default")).toBe(false);
    expect(Object.keys(oursModule).sort()).toEqual(stockKeys);
    expect(Object.keys(oursModule).sort()).toEqual(["Config", "apply", "inject", "name"]);
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(exportNames(readFileSync(ARTIFACT, "utf8"))).toEqual(stockNames);
    expect(exportNames(readFileSync(builtArtifact, "utf8"))).toEqual(stockNames);
    expect(stockNames).toEqual(["Config", "apply", "inject", "name"]);
  });

  test("ca 2: name 'tool-str-replace-editor' + inject đúng hai service — hai bản trùng khít", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-str-replace-editor");
    expect([...mine.inject]).toEqual([...stock.inject]);
    expect([...mine.inject]).toEqual(["tools", "fs"]);
    expect(Array.isArray(mine.inject)).toBe(true);
  });

  test("ca 3: manifest trỏ ĐÚNG một artifact: main + exports['.'] = './lib/index.js'", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { main: string; exports: Record<string, unknown> };
    expect(manifest.main).toBe("lib/index.js");
    // 19/10/2026 (Lead duyệt (a)): parity TYPE với stock ⇒ exports["."] là OBJECT { types, default } như stock.
    expect(manifest.exports["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./package.json"]);
    // 19/10/2026 (Lead duyệt (a)): lib/types (parity TYPE với stock) ⇒ thư mục có 2 mục.
    expect([...readdirSync(outDir)].sort()).toEqual(["index.js", "types"]);
  });
});

describe("B. Config + hằng số mặc định — String/defaults/lỗi", () => {
  test("ca 4: Config — String/type/meta/dict + mặc định 16000/1119 ký tự TRÙNG bản gốc", () => {
    const ours = mine.Config;
    const theirs = stock.Config;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe("{ maxOutputChars?: number, description?: string }");
    expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
    expect(ours.type).toBe(theirs.type);
    expect(ours.type).toBe("object");
    expect(ours.meta).toEqual(theirs.meta);
    const oursDict = asRecord(ours.dict);
    const theirsDict = asRecord(theirs.dict);
    expect(Object.keys(oursDict)).toEqual(Object.keys(theirsDict));
    expect(Object.keys(oursDict)).toEqual(["maxOutputChars", "description"]);
    expect(asRecord(oursDict["maxOutputChars"]).type).toBe("number");
    expect(asRecord(oursDict["description"]).type).toBe("string");
    expect(ours["~standard"].version).toBe(theirs["~standard"].version);
    expect(ours["~standard"].version).toBe(1);
    expect(ours["~standard"].vendor).toBe(theirs["~standard"].vendor);
    expect(ours["~standard"].vendor).toBe("schemastery");
    const defaults = ours({});
    expect(defaults).toEqual(theirs({}));
    expect(defaults["maxOutputChars"]).toBe(16000);
    const description = defaults["description"];
    expect(typeof description).toBe("string");
    if (typeof description !== "string") throw new Error("description phải là chuỗi");
    expect(description.length).toBe(1119);
    expect(description.startsWith("Custom editing tool for viewing, creating and editing files\n* State is persistent across command calls and discussions with the user")).toBe(true);
    expect(description.endsWith("should contain the edited lines that should replace the `old_str`")).toBe(true);
    expect(description.includes("\n\nNotes for using the `str_replace` command:\n")).toBe(true);
  });

  test("ca 5: Config nhận 11 đầu vào — CÙNG kết quả + CÙNG khoá", () => {
    const cases: unknown[] = [
      undefined,
      null,
      {},
      { maxOutputChars: 16000 },
      { maxOutputChars: 5 },
      { maxOutputChars: 0 },
      { maxOutputChars: NaN },
      { maxOutputChars: null },
      { description: "abc" },
      { description: "" },
      { x: 1 },
      new Date(0)
    ];
    for (const value of cases) {
      const ours = mine.Config(value);
      const theirs = stock.Config(value);
      expect(ours).toEqual(theirs);
      expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    }
    expect(mine.Config({ x: 1 })).toEqual({ maxOutputChars: 16000, description: mine.Config({})["description"], x: 1 });
    expect(Object.is(mine.Config({ maxOutputChars: NaN })["maxOutputChars"], NaN)).toBe(true);
  });

  test("ca 6: Config nhánh lỗi — CÙNG tên lớp + thông điệp trên 9 đầu vào", () => {
    const bad: unknown[] = [{ maxOutputChars: "x" }, { maxOutputChars: true }, { description: 5 }, 5, "x", true, [], [1], () => undefined];
    for (const value of bad) {
      const ours = caught(() => mine.Config(value));
      const theirs = caught(() => stock.Config(value));
      expect(ours).toEqual(theirs);
      expect(ours.name).not.toBe("không ném");
      expect(ours.message).not.toBe("không ném");
    }
  });

  test("ca 7: apply từ chối cấu hình hỏng — CÙNG nguyên văn; cấu hình hợp lệ đăng ký đúng MỘT công cụ", () => {
    for (const maxOutputChars of [0, -1, 1.5, NaN, Infinity, "8"]) {
      const config = { maxOutputChars } as Record<string, unknown>;
      const ours = caught(() => mine.apply(makeHarness().ctx, config));
      const theirs = caught(() => stock.apply(makeHarness().ctx, config));
      expect(ours).toEqual(theirs);
      expect(ours.message).toBe("tool-str-replace-editor: maxOutputChars must be a positive safe integer");
    }
    for (const description of ["", "   ", "\t\n"]) {
      const config = { maxOutputChars: 16000, description };
      const ours = caught(() => mine.apply(makeHarness().ctx, config));
      const theirs = caught(() => stock.apply(makeHarness().ctx, config));
      expect(ours).toEqual(theirs);
      expect(ours.message).toBe("tool-str-replace-editor: description must be non-empty");
    }
    const ok = installBoth({ config: { maxOutputChars: 32, description: "mô tả riêng" } });
    expect(ok.ours.tools.length).toBe(1);
    expect(ok.theirs.tools.length).toBe(1);
    expect(ok.ours.tool().description).toBe("mô tả riêng");
    expect(ok.theirs.tool().description).toBe("mô tả riêng");
  });
});

describe("C. Định nghĩa công cụ str_replace_editor — name/description/parameters/output/presentCall", () => {
  test("ca 8: name 'str_replace_editor' + description NGUYÊN VĂN + đúng 6 khoá", () => {
    const { ours, theirs } = installBoth();
    const tool = ours.tool();
    const stockTool = theirs.tool();
    expect(tool.name).toBe(stockTool.name);
    expect(tool.name).toBe("str_replace_editor");
    expect(tool.description).toBe(stockTool.description);
    expect(tool.description).toBe(mine.Config({})["description"] as string);
    expect(tool.description.length).toBe(1119);
    expect(Object.keys(tool)).toEqual(Object.keys(stockTool));
    expect(Object.keys(tool)).toEqual(["name", "description", "parameters", "output", "execute", "presentCall"]);
  });

  test("ca 9: parameters — JSON Schema biên dịch TRÙNG từng phần tử + đúng hợp đồng gốc", () => {
    const { ours, theirs } = installBoth();
    const parameters = ours.tool().parameters;
    expect(parameters).toEqual(theirs.tool().parameters);
    expect(Object.keys(parameters)).toEqual(["type", "properties", "required"]);
    expect(parameters["type"]).toBe("object");
    expect(parameters["required"]).toEqual(["command", "path"]);
    const properties = asRecord(parameters["properties"]);
    expect(Object.keys(properties)).toEqual(["command", "path", "file_text", "insert_line", "new_str", "old_str", "view_range"]);
    expect(asRecord(properties["command"])["enum"]).toEqual(["view", "create", "str_replace", "insert"]);
    expect(asRecord(properties["command"])["type"]).toBe("string");
    expect(asRecord(properties["path"])["type"]).toBe("string");
    const viewRange = asRecord(properties["view_range"]);
    const branches = viewRange["oneOf"] as unknown[];
    expect(branches.length).toBe(2);
    expect(asRecord(branches[0])["type"]).toBe("array");
    expect(asRecord(asRecord(branches[0])["items"])["type"]).toBe("integer");
    expect(asRecord(branches[1])["type"]).toBe("null");
    for (const name of ["file_text", "insert_line", "new_str", "old_str"]) expect((asRecord(properties[name])["oneOf"] as unknown[]).length).toBe(2);
  });

  test("ca 10: output — schema 'string' + render TRÙNG", () => {
    const { ours, theirs } = installBoth();
    const tool = ours.tool();
    expect(tool.output.schema).toEqual(theirs.tool().output.schema);
    expect(tool.output.schema).toEqual({ type: "string" });
    expect(Object.keys(tool.output).sort()).toEqual(["render", "schema"]);
    expect(tool.output.render({}, "hello")).toEqual([{ type: "text", text: "hello" }]);
    expect(tool.output.render({}, "hello")).toEqual(theirs.tool().output.render({}, "hello"));
    expect(tool.output.render({}, "")).toEqual(theirs.tool().output.render({}, ""));
  });

  test("ca 11: presentCall — bốn nhánh TRÙNG + số dòng insert đúng Math.max(1, insert_line + 1)", () => {
    const { ours, theirs } = installBoth();
    const cases: unknown[] = [
      { command: "view", path: "/repo/a.txt" },
      { command: "create", path: "/repo/a.txt", file_text: "x" },
      { command: "create", path: "/repo/a.txt" },
      { command: "str_replace", path: "/repo/a.txt", old_str: "o" },
      { command: "str_replace", path: "/repo/a.txt", old_str: "o", new_str: null },
      { command: "str_replace", path: "/repo/a.txt", old_str: "o", new_str: "n" },
      { command: "insert", path: "/repo/a.txt", new_str: "x", insert_line: 0 },
      { command: "insert", path: "/repo/a.txt", new_str: "x", insert_line: 4 },
      { command: "insert", path: "/repo/a.txt", new_str: "x", insert_line: null }
    ];
    for (const args of cases) expect(ours.tool().presentCall?.(args)).toEqual(theirs.tool().presentCall?.(args));
    const presentCall = ours.tool().presentCall;
    expect(presentCall?.({ command: "view", path: "/a" })).toEqual({ card: "generic", title: "view /a", kind: "read", locations: [{ path: "/a" }] });
    expect(presentCall?.({ command: "create", path: "/a" })).toEqual({ card: "diff", title: "create /a", diffs: [{ path: "/a", oldText: null, newText: "" }], locations: [{ path: "/a" }] });
    expect(presentCall?.({ command: "str_replace", path: "/a", old_str: "o" })).toEqual({ card: "diff", title: "str_replace /a", diffs: [{ path: "/a", oldText: "o", newText: "" }], locations: [{ path: "/a" }] });
    expect(presentCall?.({ command: "insert", path: "/a", new_str: "x", insert_line: 4 })).toEqual({ card: "generic", title: "insert /a", kind: "edit", locations: [{ path: "/a", line: 5 }] });
    expect(presentCall?.({ command: "insert", path: "/a", new_str: "x", insert_line: null })).toEqual({ card: "generic", title: "insert /a", kind: "edit", locations: [{ path: "/a" }] });
  });

  test("ca 12: defineTool từ chối CÙNG tập tham số hỏng — cùng tên lỗi + thông điệp, KHÔNG chạm fs", async () => {
    const { ours, theirs } = installBoth();
    const bad: unknown[] = [
      undefined,
      {},
      { command: "view" },
      { command: "x", path: "/a" },
      { command: "view", path: 5 },
      { command: "view", path: "/a", view_range: "x" },
      { command: "view", path: "/a", view_range: [1.5] },
      { command: "insert", path: "/a", insert_line: 1.5, new_str: "x" }
    ];
    for (const args of bad) {
      const a = await run(ours.tool(), args, ours.exec);
      const b = await run(theirs.tool(), args, theirs.exec);
      expect(a).toEqual(b);
      expect(a.error).toBeDefined();
      expect(a.error?.name).toBe(b.error?.name);
      expect(ours.calls).toEqual([]);
      expect(theirs.calls).toEqual([]);
    }
    // Gốc tham số là object MỞ: khoá lạ ĐI QUA được (bản gốc cũng vậy) và chạm fs như thường.
    const extraArgs = { command: "view", path: "/a", extra: 1 };
    const extraA = await run(ours.tool(), extraArgs, ours.exec);
    const extraB = await run(theirs.tool(), extraArgs, theirs.exec);
    expect(extraA).toEqual(extraB);
    expect(extraA.error?.code).toBe("FS_NOT_FOUND");
    expect(ours.calls).toEqual(theirs.calls);
  });
});

describe("D. execute — lệnh view", () => {
  test("ca 13: view tệp — văn bản có số dòng TRÙNG (đủ, [2,3], [2,-1], [4,4]) + thứ tự gọi fs", async () => {
    const full = await bothCall({ nodes: FILE_NODES }, { command: "view", path: "/repo/a.txt" });
    expect(full.a.value).toBe("Here's the content of /repo/a.txt with line numbers (which has a total of 4 lines):\n     1  alpha\n     2  beta\n     3  gamma\n     4  \n");
    const middle = await bothCall({ nodes: FILE_NODES }, { command: "view", path: "/repo/a.txt", view_range: [2, 3] });
    expect(middle.a.value).toBe("Here's the content of /repo/a.txt with line numbers (which has a total of 4 lines) with view_range=[2, 3]:\n     2  beta\n     3  gamma\n");
    const tail = await bothCall({ nodes: FILE_NODES }, { command: "view", path: "/repo/a.txt", view_range: [2, -1] });
    expect(tail.a.value).toBe("Here's the content of /repo/a.txt with line numbers (which has a total of 4 lines) with view_range=[2, -1]:\n     2  beta\n     3  gamma\n     4  \n");
    const lone = await bothCall({ nodes: FILE_NODES }, { command: "view", path: "/repo/a.txt", view_range: [4, 4] });
    expect(lone.a.value).toBe("Here's the content of /repo/a.txt with line numbers (which has a total of 4 lines) with view_range=[4, 4]:\n     4  \n");
    const { ours } = installBoth({ nodes: FILE_NODES });
    await run(ours.tool(), { command: "view", path: "/repo/a.txt" }, ours.exec);
    expect(ours.calls).toEqual(["resolve:/repo/a.txt:true", "stat:/repo/a.txt", "readText:/repo/a.txt", "emit:fs/observed:/repo/a.txt:present:1"]);
  });

  test("ca 14: view thư mục — 2 mức, bỏ ẩn/node_modules/__pycache__, sắp codepoint TRÙNG bản gốc", async () => {
    const expected = "Here're the files and directories up to 2 levels deep in /repo, excluding hidden items, node_modules, and Python cache directories:\nd\t/repo\nf\t/repo/a.txt\nd\t/repo/sub\nf\t/repo/sub/b.txt\nd\t/repo/sub/deep\nf\t/repo/z.txt\n\n";
    const { a } = await bothCall({ nodes: DIR_NODES }, { command: "view", path: "/repo" });
    expect(a.value).toBe(expected);
    const text = String(a.value);
    expect(text.includes(".hidden")).toBe(false);
    expect(text.includes("node_modules/pkg.txt")).toBe(false);
    expect(text.includes("__pycache__")).toBe(false);
    expect(text.includes("/repo/sub/deep/c.txt")).toBe(false);
    expect(text.includes("d\t/repo/sub/deep")).toBe(true);
  });

  test("ca 15: view lỗi — CÙNG tên lớp/mã/nguyên văn (thiếu tệp, không phải tệp, view_range sai, đường dẫn sai)", async () => {
    const missing = await bothCall({ nodes: FILE_NODES }, { command: "view", path: "/repo/missing.txt" });
    expect(missing.a.error?.name).toBe("FsError");
    expect(missing.a.error?.code).toBe("FS_NOT_FOUND");
    expect(missing.a.error?.message).toBe("The path /repo/missing.txt does not exist. Please provide a valid path.");
    const notFile = await bothCall({ nodes: { "/repo/link": { type: "symlink" } } }, { command: "view", path: "/repo/link" });
    expect(notFile.a.error?.code).toBe("FS_NOT_REGULAR_FILE");
    expect(notFile.a.error?.message).toBe('cannot view "/repo/link": not a regular file or directory');
    const dirRange = await bothCall({ nodes: DIR_NODES }, { command: "view", path: "/repo", view_range: [1, 2] });
    expect(dirRange.a.error?.message).toBe("The `view_range` parameter is not allowed when `path` points to a directory.");
    const ranges: { value: number[]; message: string }[] = [
      { value: [1], message: "Invalid `view_range`. It should be a list of two integers." },
      { value: [0, 1], message: "Invalid `view_range`: [0, 1]. Its first element `0` should be within the range of lines of the file: [1, 4]" },
      { value: [1, 99], message: "Invalid `view_range`: [1, 99]. Its second element `99` should be smaller than the number of lines in the file: `4`" },
      { value: [3, 2], message: "Invalid `view_range`: [3, 2]. Its second element `2` should be larger or equal than its first `3`" }
    ];
    for (const item of ranges) {
      const result = await bothCall({ nodes: FILE_NODES }, { command: "view", path: "/repo/a.txt", view_range: item.value });
      expect(result.a.error?.message).toBe(item.message);
    }
    const relative = await bothCall({}, { command: "view", path: "rel.txt" });
    expect(relative.a.error?.message).toBe("The path rel.txt is not an absolute path, it should start with `/`. Maybe you meant /rel.txt?");
    const empty = await bothCall({}, { command: "view", path: "   " });
    expect(empty.a.error?.message).toBe("path must be a non-empty string");
    const harness = installBoth({ nodes: FILE_NODES });
    await run(harness.ours.tool(), { command: "view", path: "/repo/missing.txt" }, harness.ours.exec);
    expect(harness.ours.calls).toContain("emit:fs/observed:/repo/missing.txt:absent:undefined");
    const rawOurs = await runRaw(harness.ours.tool(), { command: "view", path: "/repo/missing.txt" }, harness.ours.exec);
    const rawTheirs = await runRaw(harness.theirs.tool(), { command: "view", path: "/repo/missing.txt" }, harness.theirs.exec);
    expect(rawOurs.error).toBeInstanceOf(KernelFsError);
    expect(rawTheirs.error).toBeInstanceOf(KernelFsError);
  });

  test("ca 16: cắt kết quả theo maxOutputChars=40 — TRÙNG và gắn đúng thông điệp cắt", async () => {
    const { a } = await bothCall({ nodes: { "/repo/a.txt": { type: "file", content: "line one\nline two\n" } }, config: { maxOutputChars: 40 } }, { command: "view", path: "/repo/a.txt" });
    expect(a.value).toBe("Here's the content of /repo/a.txt with l<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>");
  });
});
describe("E. execute — ba lệnh ghi + sandbox", () => {
  test("ca 17: create — ghi createIfAbsent, báo đã tạo; tệp tồn tại/thư mục/thiếu file_text CÙNG nguyên văn", async () => {
    const created = await bothCall({}, { command: "create", path: "/repo/new.txt", file_text: "abc" });
    expect(created.a.value).toBe("New file created successfully at: /repo/new.txt");
    const { ours } = installBoth({});
    await run(ours.tool(), { command: "create", path: "/repo/new.txt", file_text: "abc" }, ours.exec);
    expect(ours.calls).toEqual([
      "resolve:/repo/new.txt:true",
      "stat:/repo/new.txt",
      "waterfall:fs/write-intent",
      "writeText:/repo/new.txt:" + JSON.stringify("abc") + ":" + JSON.stringify({ kind: "createIfAbsent" }) + ":-",
      "emit:fs/observed:/repo/new.txt:present:2"
    ]);
    const exists = await bothCall({ nodes: { "/repo/a.txt": { type: "file", content: "x" } } }, { command: "create", path: "/repo/a.txt", file_text: "y" });
    expect(exists.a.error?.message).toBe("File already exists at: /repo/a.txt. Cannot overwrite files using command `create`.");
    const directory = await bothCall({ nodes: { "/repo": { type: "directory" } } }, { command: "create", path: "/repo", file_text: "y" });
    expect(directory.a.error?.message).toBe("File already exists at: /repo. Cannot overwrite files using command `create`.");
    const missingText = await bothCall({}, { command: "create", path: "/repo/new.txt" });
    expect(missingText.a.error?.message).toBe("Parameter `file_text` is required for command: create");
  });

  test("ca 18: str_replace — thay MỘT lần, intent replaceIfVersion, mọi nhánh lỗi CÙNG nguyên văn", async () => {
    const edited = await bothCall({ nodes: FILE_NODES }, { command: "str_replace", path: "/repo/a.txt", old_str: "beta", new_str: "BETA" });
    expect(edited.a.value).toBe("The file /repo/a.txt has been edited successfully.");
    const { ours } = installBoth({ nodes: FILE_NODES });
    await run(ours.tool(), { command: "str_replace", path: "/repo/a.txt", old_str: "beta", new_str: "BETA" }, ours.exec);
    expect(ours.calls).toEqual([
      "resolve:/repo/a.txt:true",
      "waterfall:fs/edit-intent",
      "stat:/repo/a.txt",
      "readText:/repo/a.txt",
      "writeText:/repo/a.txt:" + JSON.stringify("alpha\nBETA\ngamma\n") + ":" + JSON.stringify({ kind: "replaceIfVersion", version: 1 }) + ":-",
      "emit:fs/observed:/repo/a.txt:present:2"
    ]);
    const withIntent = installBoth({ nodes: FILE_NODES, editIntentVersion: 9 });
    await run(withIntent.ours.tool(), { command: "str_replace", path: "/repo/a.txt", old_str: "beta", new_str: "BETA" }, withIntent.ours.exec);
    await run(withIntent.theirs.tool(), { command: "str_replace", path: "/repo/a.txt", old_str: "beta", new_str: "BETA" }, withIntent.theirs.exec);
    expect(withIntent.ours.calls).toEqual(withIntent.theirs.calls);
    expect(withIntent.ours.calls).toContain("writeText:/repo/a.txt:" + JSON.stringify("alpha\nBETA\ngamma\n") + ":" + JSON.stringify({ kind: "replaceIfVersion", version: 9 }) + ":-");
    const ambiguous = await bothCall({ nodes: { "/repo/a.txt": { type: "file", content: "x\nalpha\ny\nalpha\n" } } }, { command: "str_replace", path: "/repo/a.txt", old_str: "alpha", new_str: "A" });
    expect(ambiguous.a.error?.code).toBe("FS_AMBIGUOUS_EDIT");
    expect(ambiguous.a.error?.message).toBe("No replacement was performed. Multiple occurrences of old_str `alpha` in lines [2, 4]. Please ensure it is unique");
    const notFound = await bothCall({ nodes: FILE_NODES }, { command: "str_replace", path: "/repo/a.txt", old_str: "nope", new_str: "A" });
    expect(notFound.a.error?.code).toBe("FS_EDIT_NOT_FOUND");
    expect(notFound.a.error?.message).toBe("No replacement was performed, old_str `nope` did not appear verbatim in /repo/a.txt.");
    const emptyOld = await bothCall({ nodes: FILE_NODES }, { command: "str_replace", path: "/repo/a.txt", old_str: "", new_str: "A" });
    expect(emptyOld.a.error?.message).toBe("Parameter `old_str` is empty for command: str_replace");
    const missingOld = await bothCall({ nodes: FILE_NODES }, { command: "str_replace", path: "/repo/a.txt", new_str: "A" });
    expect(missingOld.a.error?.message).toBe("Parameter `old_str` is required for command: str_replace");
    const nullNew = await bothCall({ nodes: FILE_NODES }, { command: "str_replace", path: "/repo/a.txt", old_str: "alpha", new_str: null });
    expect(nullNew.a.error?.message).toBe("Parameter `new_str` must be omitted or contain a string for command: str_replace");
    const directory = await bothCall({ nodes: { "/repo": { type: "directory" } } }, { command: "str_replace", path: "/repo", old_str: "a", new_str: "b" });
    expect(directory.a.error?.message).toBe("The path /repo is a directory and only the `view` command can be used on directories");
    const link = await bothCall({ nodes: { "/repo/link": { type: "symlink" } } }, { command: "str_replace", path: "/repo/link", old_str: "a", new_str: "b" });
    expect(link.a.error?.code).toBe("FS_NOT_REGULAR_FILE");
    expect(link.a.error?.message).toBe('cannot edit "/repo/link": not a regular file');
  });

  test("ca 19: insert — chèn SAU dòng, intent replaceIfVersion, mọi nhánh lỗi CÙNG nguyên văn", async () => {
    const nodes: Record<string, FakeNode> = { "/repo/a.txt": { type: "file", content: "a\nb\nc\n" } };
    const top = await bothCall({ nodes }, { command: "insert", path: "/repo/a.txt", insert_line: 0, new_str: "X" });
    expect(top.a.value).toBe("The file /repo/a.txt has been edited successfully.");
    const { ours } = installBoth({ nodes });
    await run(ours.tool(), { command: "insert", path: "/repo/a.txt", insert_line: 1, new_str: "X" }, ours.exec);
    expect(ours.calls).toEqual([
      "resolve:/repo/a.txt:true",
      "waterfall:fs/edit-intent",
      "stat:/repo/a.txt",
      "readText:/repo/a.txt",
      "writeText:/repo/a.txt:" + JSON.stringify("a\nX\nb\nc\n") + ":" + JSON.stringify({ kind: "replaceIfVersion", version: 1 }) + ":-",
      "emit:fs/observed:/repo/a.txt:present:2"
    ]);
    const tooBig = await bothCall({ nodes }, { command: "insert", path: "/repo/a.txt", insert_line: 99, new_str: "X" });
    expect(tooBig.a.error?.message).toBe("Invalid `insert_line` parameter: 99. It should be within the range of lines of the file: [0, 4]");
    const negative = await bothCall({ nodes }, { command: "insert", path: "/repo/a.txt", insert_line: -1, new_str: "X" });
    expect(negative.a.error?.message).toBe("Invalid `insert_line` parameter: -1. It should be within the range of lines of the file: [0, 4]");
    const noLine = await bothCall({ nodes }, { command: "insert", path: "/repo/a.txt", new_str: "X" });
    expect(noLine.a.error?.message).toBe("Parameter `insert_line` is required for command: insert");
    const noText = await bothCall({ nodes }, { command: "insert", path: "/repo/a.txt", insert_line: 0 });
    expect(noText.a.error?.message).toBe("Parameter `new_str` is required for command: insert");
    const directory = await bothCall({ nodes: { "/repo": { type: "directory" } } }, { command: "insert", path: "/repo", insert_line: 0, new_str: "X" });
    expect(directory.a.error?.message).toBe("The path /repo is a directory and only the `view` command can be used on directories");
    const link = await bothCall({ nodes: { "/repo/link": { type: "symlink" } } }, { command: "insert", path: "/repo/link", insert_line: 0, new_str: "X" });
    expect(link.a.error?.message).toBe('cannot insert into "/repo/link": not a regular file');
    expect(link.a.error?.code).toBe("FS_NOT_REGULAR_FILE");
  });

  test("ca 20: sandbox — phân giải policy, dấu từ chối, fs không giam giữ, thiếu sandboxPolicy/ctx.fs", async () => {
    const confined = installBoth({ nodes: FILE_NODES, sandboxMode: "workspace-write", policyMode: "workspace-write" });
    expect(confined.ours.calls).toEqual(["get:sandboxPolicy"]);
    expect(confined.theirs.calls).toEqual(["get:sandboxPolicy"]);
    const created = await run(confined.ours.tool(), { command: "create", path: "/repo/b.txt", file_text: "z" }, confined.ours.exec);
    const createdTheirs = await run(confined.theirs.tool(), { command: "create", path: "/repo/b.txt", file_text: "z" }, confined.theirs.exec);
    expect(created).toEqual(createdTheirs);
    expect(confined.ours.calls).toEqual(confined.theirs.calls);
    expect(confined.ours.calls).toContain("policy.resolve:" + JSON.stringify({ session: { id: "session-1" } }));
    expect(confined.ours.calls.some((call) => call.startsWith("writeText:") && call.endsWith(":workspace-write"))).toBe(true);
    const denied = installBoth({ nodes: FILE_NODES, sandboxMode: "workspace-write", policyMode: "workspace-write", writeThrows: new KernelFsError("fake denied", "FS_SANDBOX_DENIED") });
    const deniedRun = await run(denied.ours.tool(), { command: "str_replace", path: "/repo/a.txt", old_str: "alpha", new_str: "A" }, denied.ours.exec);
    const deniedTheirs = await run(denied.theirs.tool(), { command: "str_replace", path: "/repo/a.txt", old_str: "alpha", new_str: "A" }, denied.theirs.exec);
    expect(deniedRun).toEqual(deniedTheirs);
    expect(deniedRun.error?.name).toBe("FsError");
    expect(deniedRun.error?.code).toBe("FS_SANDBOX_DENIED");
    expect(deniedRun.error?.message).toBe("[sandbox: file access denied under workspace-write mode]");
    const rawDenied = await runRaw(denied.ours.tool(), { command: "str_replace", path: "/repo/a.txt", old_str: "alpha", new_str: "A" }, denied.ours.exec);
    expect(rawDenied.error).toBeInstanceOf(KernelFsError);
    const plain = installBoth({ nodes: FILE_NODES });
    expect(plain.ours.calls).toEqual([]);
    const plainRun = await run(plain.ours.tool(), { command: "create", path: "/repo/c.txt", file_text: "q" }, plain.ours.exec);
    expect(plainRun.error).toBeUndefined();
    expect(plain.ours.calls.some((call) => call.startsWith("writeText:") && call.endsWith(":-"))).toBe(true);
    const broken = caught(() => install(mine, { sandboxMode: "workspace-write" }));
    const brokenStock = caught(() => install(stock, { sandboxMode: "workspace-write" }));
    expect(broken).toEqual(brokenStock);
    expect(broken.message).toBe("tool-str-replace-editor: the mounted filesystem confines but ctx.sandboxPolicy is missing");
    const noCtx = caught(() => mine.apply({}, { maxOutputChars: 16000, description: "x" }));
    const noCtxStock = caught(() => stock.apply({}, { maxOutputChars: 16000, description: "x" }));
    expect(noCtx).toEqual(noCtxStock);
    expect(noCtx.name).toBe("TypeError");
  });
});

describe("F. Metadata + provenance + artifact", () => {
  test("ca 21: gbh.provenance { stock, version, sha } khớp stock (version + sha256 lib/index.js)", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { name: string; version: string };
    const sha = createHash("sha256").update(readFileSync(STOCK)).digest("hex");
    expect(manifest.gbh.provenance?.stock).toBe(stockManifest.name);
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-tool-str-replace-editor");
    expect(manifest.gbh.provenance?.version).toBe(stockManifest.version);
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha);
    expect(sha).toBe("14a7380c94b53150ec5545dfb8fcf28bb26c99b6deef9b27bb9cf4ff6fabb616");
  });

  test("ca 22: stock không locale/không client half ⇒ gói ta không locale, KHÔNG gbh.row, có draft + tests", () => {
    expect(existsSync(join(STOCK_DIR, "locale"))).toBe(false);
    expect(existsSync(join(OURS, "locale"))).toBe(false);
    const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Record<string, unknown>;
    expect(Object.hasOwn(stockManifest, "dsh")).toBe(false);
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> & { tests?: string[]; draft?: string } };
    expect(manifest.gbh["row"]).toBeUndefined();
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(typeof manifest.gbh["draft"]).toBe("string");
    expect(manifest.gbh.tests).toEqual(["tests/host/tool-str-replace-editor.test.ts"]);
    expect(existsSync(join(REPO, "tests", "host", "tool-str-replace-editor.test.ts"))).toBe(true);
  });

  test("ca 23: peerDependencies chép đúng JSON stock + artifact lib/index.js đúng bề mặt/sha", () => {
    const oursManifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { peerDependencies: Record<string, string>; exports: Record<string, unknown> };
    const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(oursManifest.peerDependencies, stockManifest.peerDependencies)).toBe(true);
    expect(oursManifest.exports["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(existsSync(ARTIFACT)).toBe(true);
    const bytes = readFileSync(ARTIFACT);
    expect(bytes.length).toBeGreaterThan(10000);
    expect(bytes.toString("utf8").startsWith("// src/index.ts")).toBe(true);
    expect(createHash("sha256").update(bytes).digest("hex")).toMatch(/^[0-9a-f]{64}$/);
    expect([...readdirSync(join(OURS, "lib"))].sort()).toEqual(["index.js", "types"]);
    // 19/10/2026 (Lead duyệt (a)): NGƯỢC với trước đây — stock CÓ lib/types/index.d.ts nên ta PHẢI có,
    // và phải BYTE-IDENTICAL với stock (parity type).
    expect(existsSync(join(OURS, "lib", "types", "index.d.ts"))).toBe(true);
    const stockTypes = readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-str-replace-editor", "lib", "types", "index.d.ts"));
    expect(readFileSync(join(OURS, "lib", "types", "index.d.ts")).equals(stockTypes)).toBe(true);
  });
});
