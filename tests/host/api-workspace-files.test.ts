/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho NỬA HOST của @galaxy-blackhole/gbh-api-workspace-files: mỗi ca dựng HAI giàn
 *      giống hệt nhau trên Context cordis THẬT + filesystem GIẢ điều khiển được, rồi chạy CẢ HAI bản cài
 *      (gói của ta và bundle gốc @deepseek-ai/dsh-api-workspace-files) — so trang đọc, cửa sổ byte, thống
 *      kê, liệt kê, dòng thay đổi, mọi mã lỗi, và bộ tra cứu workspaceFileScope.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/api-workspace-files/build.ts";
import * as ours from "../../packages/host/api-workspace-files/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "api-workspace-files");
/** Phép kiểm CHUẨN cho dải peer của row (parity với manifest stock + phủ bản kernel đang chạy). */
import { peerRangeProblems } from "./peer-range-harness.ts";
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-workspace-files");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** typert-protocol của kernel: đọc marker Remote. */
const TYPERT = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");

/** Context cordis THẬT. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** Đọc marker Remote của một Service đang sống. */
const { remoteMethods } = (await import(TYPERT)) as { remoteMethods(service: unknown): unknown };

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as {
  WorkspaceFiles: new (ctx: unknown, config: Record<string, number>) => unknown;
  default: new (ctx: unknown, config: Record<string, number>) => unknown;
};
/** Bản của ta nhìn qua cùng hình dạng. */
const mine = ours as unknown as typeof stock;

/** MỘT mục trong filesystem giả. */
interface Entry {
  /** Loại của đích. */
  type: "file" | "directory" | "symlink" | "other";
  /** Dấu độ tươi. */
  version: string;
  /** Nội dung văn bản (chỉ với tệp). */
  text?: string;
  /** Byte không giải mã được (tệp nhị phân). */
  binary?: boolean;
  /** Các con (chỉ với thư mục). */
  children?: string[];
  /** Đích của symlink (đường dẫn tuyệt đối). */
}

/** Đích giả của filesystem (khoá = đường dẫn tuyệt đối đã chuẩn hoá). */
interface Target {
  /** Đường dẫn tuyệt đối. */
  targetKey: string;
}

/** Service nhìn qua hình dạng động (kind principal tự do ⇒ đọc dễ hơn). */
interface LooseService {
  /** Đọc một trang dòng. */
  read(scope: Scope, path: string, range: Range, signal: AbortSignal): Promise<Record<string, unknown>>;
  /** Đọc byte. */
  readBytes(scope: Scope, path: string, options: Options, signal: AbortSignal): Promise<Record<string, unknown>>;
  /** Thống kê một tệp. */
  stat(scope: Scope, path: string, signal: AbortSignal): Promise<Record<string, unknown>>;
  /** Liệt kê một thư mục. */
  list(scope: Scope, path: string, signal: AbortSignal): Promise<Record<string, unknown>>;
  /** Dòng thay đổi của một đích. */
  changes(scope: Scope, path: string, signal: AbortSignal): AsyncIterable<Record<string, unknown>>;
}

/** Phạm vi của một phiên. */
interface Scope {
  /** Id phiên. */
  sessionId: string;
  /** Gốc workspace của phiên. */
  workspaceRoot: string;
}

/** Cửa sổ dòng. */
interface Range {
  /** Dòng đầu. */
  offset?: number;
  /** Số dòng. */
  limit?: number;
}

/** Tuỳ chọn đọc byte. */
interface Options {
  /** Cửa sổ byte. */
  range?: { offset?: number; length?: number };
  /** Tệp gốc. */
  baseFile?: string;
}

/** Giàn đo của MỘT bên cài. */
interface Rig {
  /** Service đã dựng. */
  service: LooseService;
  /** Bảng mục của filesystem giả. */
  entries: Map<string, Entry>;
  /** Các lần đăng ký bộ tra cứu Typert. */
  lookups: { name: string; descriptor: Record<string, unknown> }[];
  /** Callback dọn đã đăng ký (theo nhãn). */
  effects: { label?: string; dispose: () => Promise<void> | void }[];
  /** Listener fs/observed đã đăng ký. */
  observed: ((target: Target, observation: unknown) => void)[];
  /** Các lần watch đã gọi. */
  watches: { target: string }[];
  /** Gọi listener fs/observed để mô phỏng MỘT lần mất hiệu lực. */
  emit(target: string): void;
}

/** Sổ phiên giả: cho phép đặt đầu mục sống và đầu mục đã lưu. */
interface Sessions {
  /** Đầu mục sống theo id. */
  live: Map<string, { cwd?: string }>;
  /** Đầu mục đã lưu theo id. */
  stored: Map<string, { cwd?: string }>;
}

/** Đường dẫn gốc workspace dùng trong phần lớn ca. */
const ROOT = "/ws";

/**
 * Dựng giàn cho MỘT bên cài: Context cordis THẬT + filesystem GIẢ điều khiển được + sổ phiên giả.
 * Nhận: lớp gói, bảng mục, và cấu hình trần.
 * Trả: giàn đo.
 */
function makeRig(
  plugin: typeof stock,
  entries: Map<string, Entry>,
  config: Record<string, number>,
  sessions: Sessions = { live: new Map(), stored: new Map() },
): Rig {
  const lookups: Rig["lookups"] = [];
  const effects: Rig["effects"] = [];
  const observed: Rig["observed"] = [];
  const watches: Rig["watches"] = [];
  const targetOf = (path: string, cwd?: string): Target => ({
    targetKey: path.startsWith("/") ? path : join(cwd ?? ROOT, path),
  });
  const infoOf = (target: Target): Record<string, unknown> | undefined => {
    const entry = entries.get(target.targetKey);
    if (entry === undefined) return undefined;
    const text = entry.text ?? "";
    const size = entry.type === "file" ? Buffer.byteLength(text, "utf8") : undefined;
    return { type: entry.type, version: entry.version, ...(size === undefined ? {} : { size }) };
  };
  const fs = {
    resolve(path: string, opts?: { cwd?: string }) {
      return Promise.resolve(targetOf(path, opts?.cwd));
    },
    lstat(path: string, opts?: { cwd?: string }) {
      return Promise.resolve(infoOf(targetOf(path, opts?.cwd)) as never);
    },
    stat(target: Target) {
      return Promise.resolve(infoOf(target) as never);
    },
    listDir(target: Target) {
      const entry = entries.get(target.targetKey);
      const children = (entry?.children ?? []).map((name) => {
        const child = entries.get(join(target.targetKey, name));
        return { name, type: child?.type ?? "other", ...(child?.type === "file" ? { size: (child?.text ?? "").length } : {}) };
      });
      return Promise.resolve(children);
    },
    readBytes(target: Target, _signal: AbortSignal | undefined, maxBytes: number) {
      const entry = entries.get(target.targetKey);
      const data = Buffer.from(entry?.text ?? "", "utf8");
      if (data.length > maxBytes) return Promise.reject({ code: "FS_TOO_LARGE" });
      return Promise.resolve(new Uint8Array(data));
    },
    readByteRange(target: Target, range: { offset: number; length: number }) {
      const data = Buffer.from(entries.get(target.targetKey)?.text ?? "", "utf8");
      return Promise.resolve(new Uint8Array(data.subarray(range.offset, range.offset + range.length)));
    },
    async streamText(target: Target) {
      const entry = entries.get(target.targetKey);
      if (entry?.binary === true) {
        const refusal = { code: "FS_NOT_TEXT" };
        return (async function* () {
          throw refusal;
          yield "";
        })();
      }
      const chunks = (entry?.text ?? "").match(/[^\n]*\n|[^\n]+/gu) ?? [];
      return (async function* () {
        for (const chunk of chunks) yield chunk;
      })();
    },
    watch(target: Target) {
      watches.push({ target: target.targetKey });
      return Promise.resolve(async () => undefined);
    },
    contains(parent: Target, child: Target) {
      return child.targetKey === parent.targetKey || child.targetKey.startsWith(parent.targetKey + "/");
    },
    fileUrl(target: Target) {
      return "file://" + target.targetKey;
    },
    processPath(target: Target) {
      return target.targetKey;
    },
  };
  const sandboxPolicy = { workspaceRoot: ROOT };
  const scope = {
    sessions: {
      get(id: string) {
        const header = sessions.live.get(id);
        return header === undefined ? undefined : { header };
      },
    },
    typert: {
      lookups: {
        register(name: string, descriptor: Record<string, unknown>) {
          lookups.push({ name, descriptor });
          return () => undefined;
        },
      },
    },
    sandboxPolicy,
    get(key: string) {
      if (key !== "sessionPersistence") return undefined;
      return {
        stat(id: string) {
          const header = sessions.stored.get(id);
          return Promise.resolve(header === undefined ? undefined : { header });
        },
      };
    },
  };
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "fs") return fs;
      if (prop === "sandboxPolicy") return sandboxPolicy;
      if (prop === "logger") return { error() {} };
      if (prop === "on") {
        return (event: string, listener: (target: Target, observation: unknown) => void) => {
          if (event === "fs/observed") observed.push(listener);
          return () => undefined;
        };
      }
      if (prop === "effect") {
        return (callback: () => () => Promise<void> | void, label?: string) => {
          const dispose = callback();
          effects.push({ label, dispose });
          return () => undefined;
        };
      }
      if (prop === "inject") {
        return (deps: string[], callback: (child: unknown) => void) => {
          // Chỉ chạy callback khi ĐÚNG bộ phụ thuộc mà dịch vụ này cần (giống kernel thật).
          if (deps.includes("sessions") && deps.includes("typert")) callback(scope);
          return () => undefined;
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  const service = new plugin.WorkspaceFiles(ctx, config) as unknown as LooseService;
  return {
    service,
    entries,
    lookups,
    effects,
    observed,
    watches,
    emit(target: string) {
      const resolved: Target = { targetKey: target };
      for (const listener of observed) listener(resolved, undefined);
    },
  };
}

/** Cấu hình mặc định của cả hai ca dùng chung. */
const CONFIG = { maxBytes: 64, maxFileBytes: 128, maxLines: 5, maxEntries: 2 };

/**
 * Dựng bảng mục chuẩn: /ws là gốc, có tệp, thư mục con, và một tệp ngoài workspace.
 * Nhận: không.
 * Trả: bảng mục.
 */
function standardEntries(): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  entries.set(ROOT, { type: "directory", version: "d1", children: ["a.txt", "sub", "big.txt", "bin.dat"] });
  entries.set(join(ROOT, "a.txt"), { type: "file", version: "v1", text: "one\ntwo\nthree\n" });
  entries.set(join(ROOT, "big.txt"), { type: "file", version: "v2", text: "x".repeat(200) });
  entries.set(join(ROOT, "bin.dat"), { type: "file", version: "v3", text: "\u0000\u0001", binary: true });
  entries.set(join(ROOT, "sub"), { type: "directory", version: "d2", children: ["b.txt", "c.txt", "d.txt"] });
  entries.set(join(ROOT, "sub", "b.txt"), { type: "file", version: "v4", text: "inner\n" });
  entries.set(join(ROOT, "sub", "c.txt"), { type: "file", version: "v5", text: "c\n" });
  entries.set(join(ROOT, "sub", "d.txt"), { type: "file", version: "v6", text: "d\n" });
  entries.set("/outside.txt", { type: "file", version: "v7", text: "outside\n" });
  // MỘT THƯ MỤC thật ngoài workspace: để cổng "thư mục phải trong workspace" của changes/list có cái chạm.
  entries.set("/outside", { type: "directory", version: "o1", children: [] });
  entries.set("/link-file", { type: "symlink", version: "s1" });
  return entries;
}

/** Phạm vi mặc định: phiên có gốc /ws. */
const SCOPE: Scope = { sessionId: "s1", workspaceRoot: ROOT };

/**
 * Chạy MỘT phép gọi trên cả hai bản và trả kết quả đã chuẩn hoá (lỗi → { code, message, details }).
 * Nhận: hàm nhận service.
 * Trả: hai kết quả.
 */
async function ab(run: (service: LooseService, entries: Map<string, Entry>) => Promise<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const plugin of [mine, stock]) {
    const rig = makeRig(plugin, standardEntries(), CONFIG);
    try {
      out.push(await run(rig.service, rig.entries));
    } catch (error) {
      const failure = error as { code?: unknown; message?: string; details?: unknown };
      out.push({ code: failure.code, message: failure.message, details: failure.details });
    }
  }
  return out;
}

/**
 * Tên export của một file ESM đã build.
 * Nhận: văn bản artifact.
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

/** Tín hiệu không huỷ. */
const SIGNAL = new AbortController().signal;


/** Id row thật của gói trong dump oracle (KHÔNG phải tên thư mục). */
const ROW_ID = "workspace-files";

describe("bề mặt gói + dựng service", () => {
  test("tập export của ta BẰNG bản gốc — đo trên ARTIFACT", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-awf-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["WorkspaceFiles", "default"]);
    expect(mine.default).toBe(mine.WorkspaceFiles);
    for (const specifier of ["@deepseek-ai/dsh-deque", "@deepseek-ai/dsh-typert-protocol", "@deepseek-ai/schemastery"]) {
      expect(oursText.includes('from "' + specifier + '"')).toBe(true);
      expect(stockText.includes('from "' + specifier + '"')).toBe(true);
    }
    expect(oursText.includes('from "@deepseek-ai/cordis"')).toBe(false);
  });

  test("inject · Config · marker Remote TRÙNG bản gốc", () => {
    const oursCls = mine.WorkspaceFiles as unknown as { inject: string[]; Config: { toString(): string } };
    const stockCls = stock.WorkspaceFiles as unknown as { inject: string[]; Config: { toString(): string } };
    expect(oursCls.inject).toEqual(stockCls.inject);
    expect(oursCls.inject).toEqual(["fs", "sandboxPolicy", "sessions", "typert"]);
    expect(String(oursCls.Config)).toBe(String(stockCls.Config));
    const ourMarkers = remoteMethods(makeRig(mine, standardEntries(), CONFIG).service) as unknown[];
    const stockMarkers = remoteMethods(makeRig(stock, standardEntries(), CONFIG).service) as unknown[];
    expect(ourMarkers).toEqual(stockMarkers);
    expect(ourMarkers).toEqual([
      { method: "read", invocation: { kind: "direct" } },
      { method: "readBytes", invocation: { kind: "direct" } },
      { method: "stat", invocation: { kind: "direct" } },
      { method: "list", invocation: { kind: "direct" } },
      { method: "changes", mode: "stream", invocation: { kind: "direct" } },
    ]);
  });

  test("bộ tra cứu workspaceFileScope: MÔ TẢ trùng + giải được 3 đường (sống · đã lưu · không có)", async () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const sessions: Sessions = { live: new Map([["s1", { cwd: "/proj" }]]), stored: new Map([["s2", { cwd: "/old" }]]) };
      const rig = makeRig(plugin, standardEntries(), CONFIG, sessions);
      const registered = rig.lookups[0] as { name: string; descriptor: Record<string, unknown>; resolve?: never };
      const descriptor = registered.descriptor as {
        parameter: string;
        wire: string;
        resource: string;
        hostTypeSymbol: string;
        wireTypeSymbol: string;
        resolve(id: string): Promise<unknown>;
      };
      traces.push({
        name: registered.name,
        parameter: descriptor.parameter,
        wire: descriptor.wire,
        resource: descriptor.resource,
        hostTypeSymbol: descriptor.hostTypeSymbol,
        wireTypeSymbol: descriptor.wireTypeSymbol,
        live: await descriptor.resolve("s1"),
        stored: await descriptor.resolve("s2"),
        missing: await descriptor.resolve("nope"),
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      name: "workspaceFileScope",
      parameter: "workspaceFileScope",
      wire: "workspaceFileScopeId",
      resource: "session",
      hostTypeSymbol: "@deepseek-ai/dsh-api-workspace-files#WorkspaceFileScope",
      wireTypeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
      live: { sessionId: "s1", workspaceRoot: "/proj" },
      stored: { sessionId: "s2", workspaceRoot: "/old" },
      missing: undefined,
    });
  });
});

describe("read() — trang dòng", () => {
  test("trang mặc định + cửa sổ dòng + eof + version/bytes TRÙNG bản gốc", async () => {
    const traces = await ab(async (service) => {
      const all = await service.read(SCOPE, "a.txt", {}, SIGNAL);
      const page2 = await service.read(SCOPE, "a.txt", { offset: 2, limit: 2 }, SIGNAL);
      const past = await service.read(SCOPE, "a.txt", { offset: 9, limit: 2 }, SIGNAL);
      return [all, page2, past];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14, offset: 1, text: "one\ntwo\nthree", lines: 3, eof: true },
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14, offset: 2, text: "two\nthree", lines: 2, eof: true },
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14, offset: 9, text: "", lines: 0, eof: true },
    ]);
  });

  test("lỗi read: thiếu path · không tồn tại · không phải tệp thường · limit vượt trần — TRÙNG mã+thông điệp", async () => {
    const traces = await ab(async (service) => {
      return [
        await service.read(SCOPE, "", {}, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.read(SCOPE, "nope.txt", {}, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.read(SCOPE, "sub", {}, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.read(SCOPE, "a.txt", { limit: 6 }, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.read(SCOPE, "a.txt", { offset: 0 }, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
      ];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      "gateway/bad-request | path is required",
      'workspace-file/not-found | no entry at "nope.txt"',
      'workspace-file/not-regular-file | "sub" is a directory',
      "gateway/bad-request | limit must be at most 5",
      "gateway/bad-request | offset must be a safe integer of at least 1",
    ]);
  });

  test("NUL trong trang ⇒ not-text; tệp nhị phân ⇒ not-text; trang vượt trần byte ⇒ too-large", async () => {
    const traces = await ab(async (service) => {
      return [
        await service.read(SCOPE, "bin.dat", {}, SIGNAL).catch((error: { code: string }) => error.code),
        await service.read(SCOPE, "big.txt", {}, SIGNAL).catch((error: { code: string }) => error.code),
      ];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual(["workspace-file/not-text", "workspace-file/too-large"]);
  });
});

describe("readBytes() · stat() · list()", () => {
  test("readBytes: cả tệp · cửa sổ · eof hai phía · tệp gốc tương đối", async () => {
    const traces = await ab(async (service) => {
      const whole = await service.readBytes(SCOPE, "a.txt", {}, SIGNAL);
      const window = await service.readBytes(SCOPE, "a.txt", { range: { offset: 4, length: 3 } }, SIGNAL);
      const toEnd = await service.readBytes(SCOPE, "a.txt", { range: { offset: 12, length: 8 } }, SIGNAL);
      const relative = await service.readBytes(SCOPE, "b.txt", { baseFile: "sub/b.txt" }, SIGNAL);
      return [
        { ...whole, data: [...(whole["data"] as Uint8Array)] },
        { ...window, data: [...(window["data"] as Uint8Array)] },
        { ...toEnd, data: [...(toEnd["data"] as Uint8Array)] },
        { ...relative, data: [...(relative["data"] as Uint8Array)] },
      ];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14, offset: 0, data: [...Buffer.from("one\ntwo\nthree\n")], eof: true },
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14, offset: 4, data: [...Buffer.from("two")], eof: false },
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14, offset: 12, data: [...Buffer.from("e\n")], eof: true },
      { absolutePath: "/ws/sub/b.txt", version: "v4", bytes: 6, offset: 0, data: [...Buffer.from("inner\n")], eof: true },
    ]);
  });

  test("readBytes lỗi: cửa sổ vượt trần · cả tệp vượt trần · baseFile + path tuyệt đối — TRÙNG", async () => {
    const traces = await ab(async (service) => {
      return [
        await service.readBytes(SCOPE, "a.txt", { range: { length: 65 } }, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.readBytes(SCOPE, "big.txt", {}, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.readBytes(SCOPE, "/etc/passwd", { baseFile: "a.txt" }, SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
      ];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      'workspace-file/too-large | 65 bytes of "a.txt" exceed the 64 byte cap',
      'workspace-file/too-large | "big.txt" exceeds the 128 byte full-file cap',
      "gateway/bad-request | path must be relative when baseFile is provided",
    ]);
  });

  test("stat: tệp NGOÀI workspace vẫn đọc được (đọc tệp KHÔNG bị giữ trong workspace)", async () => {
    const traces = await ab(async (service) => {
      return [await service.stat(SCOPE, "a.txt", SIGNAL), await service.stat(SCOPE, "/outside.txt", SIGNAL)];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      { absolutePath: "/ws/a.txt", version: "v1", bytes: 14 },
      { absolutePath: "/outside.txt", version: "v7", bytes: 8 },
    ]);
  });

  test("list: gốc (path rỗng) · cắt theo trần mục · không phải thư mục · ngoài workspace", async () => {
    const traces = await ab(async (service) => {
      return [
        await service.list(SCOPE, ROOT, SIGNAL),
        await service.list(SCOPE, "sub", SIGNAL),
        await service.list(SCOPE, "a.txt", SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
        await service.list(SCOPE, "/outside", SIGNAL).catch((error: { code: string; message: string }) => error.code + " | " + error.message),
      ];
    });
    expect(traces[0]).toEqual(traces[1]);
    expect((traces[0] as unknown[])[0]).toEqual({
      path: "",
      entries: [
        { name: "a.txt", type: "file", size: 14 },
        { name: "sub", type: "directory" },
      ],
      truncated: true,
    });
    expect((traces[0] as unknown[])[1]).toEqual({
      path: "sub",
      entries: [
        { name: "b.txt", type: "file", size: 6 },
        { name: "c.txt", type: "file", size: 2 },
      ],
      truncated: true,
    });
    expect((traces[0] as unknown[])[2]).toBe('workspace-file/not-directory | "a.txt" is a file');
  });
});

describe("changes() — dòng thay đổi của đích", () => {
  test("ready rồi change khi fs/observed báo đích: TRÙNG cả hai bản; watcher được gọi đúng đích", async () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin, standardEntries(), CONFIG);
      const controller = new AbortController();
      const iter = rig.service.changes(SCOPE, "a.txt", controller.signal)[Symbol.asyncIterator]();
      const ready = await iter.next();
      rig.emit("/ws/a.txt");
      const change = await iter.next();
      // Mất hiệu lực của ĐÍCH KHÁC bị bỏ qua.
      rig.emit("/ws/sub");
      // Đích MẤT ⇒ khung absent.
      rig.entries.delete("/ws/a.txt");
      rig.emit("/ws/a.txt");
      const absent = await iter.next();
      controller.abort();
      await iter.next();
      traces.push({ ready: ready.value, change: change.value, absent: absent.value, watches: rig.watches, labels: rig.effects.map((entry) => entry.label) });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      ready: { kind: "ready" },
      change: { kind: "change", change: { absolutePath: "/ws/a.txt", version: "v1" } },
      absent: { kind: "change", change: { absolutePath: "/ws/a.txt", absent: true } },
      watches: [{ target: "/ws/a.txt" }],
      labels: ["workspace-files.changes"],
    });
  });

  test("thư mục NGOÀI workspace ⇒ outside-workspace (cả hai bản)", async () => {
    const traces = await ab(async (service) => {
      const controller = new AbortController();
      const iter = service.changes({ sessionId: "s1", workspaceRoot: "/ws" }, "/outside", controller.signal)[Symbol.asyncIterator]();
      try {
        await iter.next();
        return "KHONG NEM";
      } catch (error) {
        return (error as { code: string }).code;
      } finally {
        controller.abort();
      }
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toBe("workspace-file/outside-workspace");
  });
});

describe("quy ước repo — HAI MẶT đã port đủ 4 artefact, KHÔNG khai gbh.row", () => {
  test("không gbh.row + đối chứng DƯƠNG gói HAI MẶT + không trùng tên service", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: { row?: unknown; peers?: string[]; tests?: string[]; draft?: string };
      exports: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    // 19/10/2026 — BẤT BIẾN MỚI (thay 'KHÔNG khai gbh.row' đã stale sau khi row được khai/mount, như agent-loop đã làm):
    // row PHẢI được khai ở ĐÚNG MỘT trong hai khoá (flip ⇒ `gbh.row`; chưa flip ⇒ `gbh.row_unmounted_ly_do`),
    // có `id` + `tests`, và TUYỆT ĐỐI KHÔNG khai đồng thời cả hai (khai cả hai ⇒ patch mâu thuẫn, mount không xác định).
    const gbh = json.gbh as
      | { row?: { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] }; row_unmounted_ly_do?: { row?: { id?: string } } }
      | undefined;
    const daFlip = gbh?.row !== undefined;
    const dangPark = gbh?.row_unmounted_ly_do !== undefined;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    expect(gbh?.row?.id ?? gbh?.row_unmounted_ly_do?.row?.id).toBe(ROW_ID);
    // 19/10/2026 — CẬP NHẬT theo trạng thái mới (de-bundle 4 artefact): draft nay mô tả gói HAI MẶT, không còn "NỬA HOST".
    // Ca giữ nguyên, chỉ đổi khẳng định sang điều ĐÚNG với trạng thái mới.
    expect((json.gbh?.draft ?? "").includes("4 artefact")).toBe(true);
    // 19/10/2026 — gói đã de-bundle 4 artefact nên có THÊM bộ test A/B halves; gbh.tests liệt kê cả hai.
    expect(json.gbh?.tests).toEqual(["tests/host/api-workspace-files.test.ts", "tests/host/api-workspace-files-halves.test.ts"]);
    // 19/10/2026 — nay gói xuất CẢ 8 mục như bản gốc (client + 2 typert + locale), không còn chỉ nửa host.
    expect(Object.keys(json.exports).sort()).toEqual([".", "./client", "./locale/*.json", "./package.json", "./remote", "./src/*", "./typert", "./types"]);
    // Đối chứng DƯƠNG: bản gốc THẬT SỰ có nửa client + manifest remote.
    const stockPkg = JSON.parse(readFileSync(join(STOCK_PKG, "package.json"), "utf8")) as {
      dsh?: { client?: { platform?: string; inject?: string[] } };
      exports: Record<string, unknown>;
    };
    expect(stockPkg.dsh?.client?.platform).toBe("web");
    expect(stockPkg.dsh?.client?.inject).toContain("@deepseek-ai/dsh-api-gateway");
    expect(Object.keys(stockPkg.exports)).toContain("./client");
    expect(Object.keys(stockPkg.exports)).toContain("./remote");
    // Không package GBH nào khác cấp khoá service workspaceFiles.
    // 19/10/2026 — api-remote-access đã de-bundle: bản viết tay chuyển vào src-handwritten/service.ts; đọc bản đó.
    const other = readFileSync(join(REPO, "packages", "host", "api-remote-access", "src-handwritten", "service.ts"), "utf8");
    expect(other.includes("workspaceFiles")).toBe(false);
  });

  test("gbh.peers ⊆ peerDependencies, dependencies RỖNG", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: { peers?: string[] };
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    // 01/11/2026 — đồng bộ manifest theo stock: danh sách chọn lọc nay có thêm `@deepseek-ai/cordis` ⇒ danh sách
    // cứng 3 tên là kỳ vọng CŨ. Giữ TẬP CON bắt buộc + phép kiểm dải CHUẨN của repo (`peerRangeProblems`).
    expect(declared).toEqual(expect.arrayContaining([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-deque",
      "@deepseek-ai/dsh-typert-protocol",
      "@deepseek-ai/schemastery",
    ]));
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(peerRangeProblems(PKG)).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
  });
});

describe("Dia chi tep — hoi quy 01/11/2026 (chip hien dsh-resource roi bam khong mo duoc)", () => {
  test("nua client PHAT gbh-resource://file/ va VAN doc scheme cu", () => {
    const client = readFileSync(join(PKG, "lib", "client.js"), "utf8");
    expect(client).toContain('const FILE_ADDRESS_PREFIX = "gbh-resource://file/"');
    expect(client).toContain('const LEGACY_FILE_ADDRESS_PREFIX = "dsh-resource://file/"');
    expect(client).toContain("address.slice(prefix.length");
  });
});
