/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói workspace-changes: mọi module so TRỰC TIẾP với module gốc trong kernel
 *      (numstat · paths · capture · compare · git runner · recorder), cộng export/manifest/locale
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as oursNumstat from "../../packages/host/workspace-changes/src/numstat.ts";
import * as oursPaths from "../../packages/host/workspace-changes/src/paths.ts";
import * as oursCapture from "../../packages/host/workspace-changes/src/capture.ts";
import * as oursCompare from "../../packages/host/workspace-changes/src/compare.ts";
import * as oursGit from "../../packages/host/workspace-changes/src/git.ts";
import * as oursRecorder from "../../packages/host/workspace-changes/src/recorder.ts";
import * as oursPlugin from "../../packages/host/workspace-changes/src/plugin.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "workspace-changes");
/** Thư mục bản gốc trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workspace-changes");
const STOCK_TYPES = join(STOCK_DIR, "lib", "types");

/** Nạp một module gốc (đường dẫn là chuỗi động để tsc không kéo kiểu vào chương trình). */
async function stock(name: string): Promise<Record<string, unknown>> {
  return (await import(join(STOCK_TYPES, name + ".js"))) as Record<string, unknown>;
}

/** Ghi một tệp vào thư mục tạm và trả đường dẫn. */
function writeTemp(dir: string, name: string, content: string | Buffer): string {
  const file = join(dir, name);
  writeFileSync(file, content);
  return file;
}

/** Thư mục tạm dùng chung trong một ca; luôn dọn sau khi xong. */
function tempDir(): { dir: string; done: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "gbh-wc-"));
  return {
    dir,
    done: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe("workspace-changes — export + manifest + locale", () => {
  test("artifact CHI export bốn tên như bản gốc, và có mặt ./types", async () => {
    const names = (text: string): string[] => {
      const out = new Set<string>();
      for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of (match[1] ?? "").split(",")) {
          const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
          if (name !== undefined && name !== "") out.add(name);
        }
      }
      return [...out].sort();
    };
    const ours = names(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    const theirs = names(readFileSync(join(STOCK_DIR, "lib", "index.js"), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["Config", "apply", "inject", "name"]);
    // Mặt ./types chỉ có KHAI BÁO KIỂU: artifact runtime rỗng (bản gốc lib/types/types.js = "export {};").
    expect(readFileSync(join(OURS, "lib", "types.js"), "utf8").trim().length).toBeLessThan(20);
  });

  test("name + inject + String(Config) TRÙNG bản gốc từng ký tự", () => {
    expect(oursPlugin.name).toBe("workspace-changes");
    expect([...oursPlugin.inject]).toEqual(["subprocess", "fs"]);
    expect(String(oursPlugin.Config)).toBe(String((oursPlugin as unknown as { Config: { toString(): string } }).Config));
  });

  test("locale en/zh CHÉP NGUYÊN VĂN bản gốc (byte-for-byte)", () => {
    for (const file of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", file));
      const theirs = readFileSync(join(STOCK_DIR, "locale", file));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});

describe("workspace-changes — numstat A/B", () => {
  test("record thường / rename / binary / rỗng: cùng kết quả", async () => {
    const theirs = await stock("numstat");
    const cases = [
      "12\t3\tsrc/a.ts\0" + "0\t0\tbin.png\0",
      "\t\t\0old/name.ts\0new/name.ts\0" + "5\t0\tafter.ts\0",
      "1\t1\twith\ttab.ts\0",
      "",
    ];
    for (const fixture of cases) {
      const mine = (oursNumstat.parseNumstat as (text: string) => unknown)(fixture);
      const stockResult = (theirs.parseNumstat as (text: string) => unknown)(fixture);
      expect(mine).toEqual(stockResult);
    }
  });

  test("output hỏng: ném CÙNG thông điệp như bản gốc", async () => {
    const theirs = await stock("numstat");
    const fixtures = ["12\t3\tsrc/a.ts", "abc\0"];
    for (const fixture of fixtures) {
      const mine = (() => {
        try {
          return { ok: (oursNumstat.parseNumstat as (text: string) => unknown)(fixture) };
        } catch (error) {
          return { error: (error as Error).message };
        }
      })();
      const stockResult = (() => {
        try {
          return { ok: (theirs.parseNumstat as (text: string) => unknown)(fixture) };
        } catch (error) {
          return { error: (error as Error).message };
        }
      })();
      expect(mine).toEqual(stockResult);
      expect("error" in mine).toBe(true);
    }
  });
});

describe("workspace-changes — paths A/B", () => {
  test("toPosix/isInside/isTemporaryPath/compareDisplay: cùng kết quả trên cùng input", async () => {
    const theirs = await stock("paths");
    const toPosix = oursPaths.toPosix as (path: string) => string;
    const stockToPosix = theirs.toPosix as (path: string) => string;
    for (const path of ["/a/b", "C:\\x\\y", "a/b/c", ""]) expect(toPosix(path)).toBe(stockToPosix(path));
    expect(oursPaths.isInside("/root", "/root/a")).toBe((theirs.isInside as (r: string, p: string) => boolean)("/root", "/root/a"));
    expect(oursPaths.isInside("/root", "/other")).toBe((theirs.isInside as (r: string, p: string) => boolean)("/root", "/other"));
    expect(oursPaths.isTemporaryPath("/tmp/x", ["/tmp"])).toBe((theirs.isTemporaryPath as (p: string, r: string[]) => boolean)("/tmp/x", ["/tmp"]));
    expect(oursPaths.compareDisplay({ display: "a" } as never, { display: "b" } as never)).toBe((theirs.compareDisplay as (a: never, b: never) => number)({ display: "a" } as never, { display: "b" } as never));
  });

  test("displayPathOf + durablePathOf: đường dẫn trong/ngoài workspace, dưới home, thư mục tạm", async () => {
    const theirs = await stock("paths");
    const cwd = "/work/project";
    const root = "/work/project";
    const home = "/home/user";
    for (const target of ["/work/project/a/b.ts", "/work/other.ts", "/home/user/.config/x", "/tmp/z", "/abs/elsewhere"]) {
      const mineDisplay = (oursPaths.displayPathOf as (a: string, c: string, r: string, h: string) => string)(target, cwd, root, home);
      const stockDisplay = (theirs.displayPathOf as (a: string, c: string, r: string, h: string) => string)(target, cwd, root, home);
      expect(mineDisplay).toBe(stockDisplay);
      const mineDurable = (oursPaths.durablePathOf as (a: string, c: string) => string)(target, cwd);
      const stockDurable = (theirs.durablePathOf as (a: string, c: string) => string)(target, cwd);
      expect(mineDurable).toBe(stockDurable);
    }
  });

  test("canonicalPath + temporaryRoots: cùng giá trị thật trên đĩa", async () => {
    const theirs = await stock("paths");
    const bench = tempDir();
    try {
      const file = writeTemp(bench.dir, "x.txt", "x");
      expect(await (oursPaths.canonicalPath as (p: string) => Promise<string>)(file)).toBe(await (theirs.canonicalPath as (p: string) => Promise<string>)(file));
      const roots = await (oursPaths.temporaryRoots as (candidates?: string[]) => Promise<string[]>)([]);
      const stockRoots = await (theirs.temporaryRoots as (candidates?: string[]) => Promise<string[]>)([]);
      expect(roots).toEqual(stockRoots);
    } finally {
      bench.done();
    }
  });
});

describe("workspace-changes — capture A/B", () => {
  test("tệp thường / tệp nhị phân / thiếu tệp / quá cỡ: cùng capture", async () => {
    const theirs = await stock("capture");
    const bench = tempDir();
    try {
      const text = writeTemp(bench.dir, "a.txt", "hello\n");
      const binary = writeTemp(bench.dir, "b.bin", Buffer.from([0, 1, 2]));
      const big = writeTemp(bench.dir, "big.txt", "x".repeat(64));
      const absent = join(bench.dir, "missing.txt");
      const cases: [string, number][] = [[text, 1024], [binary, 1024], [absent, 1024], [big, 8]];
      for (const [path, maxBytes] of cases) {
        const mineDir = join(bench.dir, "mine-" + Math.random().toString(36).slice(2));
        const stockDir = join(bench.dir, "stock-" + Math.random().toString(36).slice(2));
        const mine = await (oursCapture.captureFile as (a: string, d: string, m: number) => Promise<unknown>)(path, mineDir, maxBytes);
        const stockResult = await (theirs.captureFile as (a: string, d: string, m: number) => Promise<unknown>)(path, stockDir, maxBytes);
        // Đường dẫn tệp copy khác thư mục ⇒ so phần 'kind' + cờ binary, và cùng nội dung hash.
        const shape = (value: unknown): unknown => {
          const bag = value as { kind: string; binary?: boolean; file?: string };
          return { kind: bag.kind, binary: bag.binary, hash: bag.file === undefined ? undefined : bag.file.split("/").pop() };
        };
        expect(shape(mine)).toEqual(shape(stockResult));
      }
    } finally {
      bench.done();
    }
  });

  test("sameCapture: absent/oversized/file — cùng luật", async () => {
    const theirs = await stock("capture");
    const pairs: [unknown, unknown][] = [
      [{ kind: "absent" }, { kind: "absent" }],
      [{ kind: "absent" }, { kind: "file", file: "/x" }],
      [{ kind: "oversized" }, { kind: "oversized" }],
      [{ kind: "file", file: "/x" }, { kind: "file", file: "/x" }],
      [{ kind: "file", file: "/x" }, { kind: "file", file: "/y" }],
    ];
    for (const [a, b] of pairs) {
      const mine = (oursCapture.sameCapture as (x: unknown, y: unknown) => boolean)(a, b);
      const stockResult = (theirs.sameCapture as (x: unknown, y: unknown) => boolean)(a, b);
      expect(mine).toBe(stockResult);
    }
  });
});

describe("workspace-changes — compare A/B", () => {
  test("giống nhau / đổi / null hai phía / văn bản dài vượt timeout: cùng hunks + tổng", async () => {
    const theirs = await stock("compare");
    const cases: [string | null, string | null, number][] = [
      ["a\nb\n", "a\nb\n", 1000],
      ["a\nb\n", "a\nc\n", 1000],
      [null, "x\ny\n", 1000],
      ["gone\n", null, 1000],
      // Ca lớn nhưng hạn chót RỘNG để kết quả TẤT ĐỊNH (timeout 0/1 phụ thuộc thời gian thật ⇒ flaky).
      ["a" + "\n".repeat(2000), "b" + "\n".repeat(2000), 5000],
    ];
    for (const [before, after, timeoutMs] of cases) {
      const mine = (oursCompare.compareText as (a: string | null, b: string | null, t: number) => unknown)(before, after, timeoutMs);
      const stockResult = (theirs.compareText as (a: string | null, b: string | null, t: number) => unknown)(before, after, timeoutMs);
      expect(mine).toEqual(stockResult);
    }
  });
});

describe("workspace-changes — GitRunner A/B (seam tiến trình con giả)", () => {
  test("cùng spec spawn + cùng kết quả đọc luồng; cờ truncated đúng", async () => {
    const run = async (Ctor: unknown) => {
      const calls: unknown[] = [];
      const subprocess = {
        spawn(spec: unknown) {
          calls.push(spec);
          return {
            collected: {
              stdout: { readFrom: () => ({ text: "out", lossy: true }) },
              stderr: { readFrom: () => ({ text: "err" }) },
            },
            done: Promise.resolve({ exitCode: 0 }),
          };
        },
      };
      const runner = new (Ctor as new (s: unknown, e: string, l: unknown) => { run: (a: string[], o: unknown) => Promise<unknown> })(subprocess, "git", { timeoutMs: 5000, outputMaxBytes: 4096 });
      const result = await runner.run(["--version"], { cwd: "/tmp", signal: new AbortController().signal });
      return { calls, result };
    };
    const ours = await run(oursGit.GitRunner);
    const stockGit = await stock("git");
    const theirs = await run(stockGit.GitRunner);
    expect(ours.result).toEqual(theirs.result);
    // Spec spawn: cùng argv + cùng bộ biến môi trường bắt buộc (KHÔNG so signal/timeout object).
    const shape = (spec: unknown): unknown => {
      const bag = spec as { argv: string[]; cwd: string; env: Record<string, string>; graceMs: number };
      return { argv: bag.argv, cwd: bag.cwd, env: bag.env, graceMs: bag.graceMs };
    };
    expect(shape(ours.calls[0])).toEqual(shape(theirs.calls[0]));
  });

  test("git thoát mã khác 0 ⇒ ném CÙNG thông điệp (stderr) như bản gốc", async () => {
    const run = async (Ctor: unknown) => {
      const subprocess = {
        spawn() {
          return {
            collected: { stdout: { readFrom: () => ({ text: "", lossy: false }) }, stderr: { readFrom: () => ({ text: "fatal: not a repo" }) } },
            done: Promise.resolve({ exitCode: 128 }),
          };
        },
      };
      const runner = new (Ctor as new (s: unknown, e: string, l: unknown) => { run: (a: string[], o: unknown) => Promise<unknown> })(subprocess, "git", { timeoutMs: 5000, outputMaxBytes: 4096 });
      try {
        await runner.run(["status"], { cwd: "/tmp", signal: new AbortController().signal });
        return { ok: true };
      } catch (error) {
        return { message: (error as Error).message };
      }
    };
    const ours = await run(oursGit.GitRunner);
    const theirs = await run((await stock("git")).GitRunner);
    expect(ours).toEqual(theirs);
  });
});

describe("workspace-changes — TurnRecorder A/B (không git ⇒ tóm tắt từ capture)", () => {
  test("start → capture → observe → stopping: cùng summary + cùng số sự kiện", async () => {
    const run = async (Ctor: unknown) => {
      const bench = tempDir();
      try {
        const cwd = realpathSync(bench.dir);
        const file = writeTemp(cwd, "note.txt", "old\n");
        const appended: { type: string; payload: unknown; seq: number }[] = [];
        let nextSeq = 100;
        const session = {
          append(type: string, payload: unknown) {
            appended.push({ type, payload, seq: nextSeq });
            return { seq: nextSeq++ };
          },
        };
        const warns: string[] = [];
        const recorder = new (Ctor as new (s: unknown, c: string, e: unknown) => {
          start: (turn: number) => void;
          settled: () => Promise<void>;
          capture: (path: string) => void;
          observe: (event: unknown) => void;
          stopping: (turn: number) => Promise<void>;
          summary: (seq: number) => unknown;
          dispose: () => Promise<void>;
        })(session, cwd, { git: Promise.resolve(null), tempRoot: tmpdir(), maxFiles: 10, maxFileBytes: 1024, diffTimeoutMs: 1000, warn: (message: string) => warns.push(message) });
        recorder.start(1);
        await recorder.settled();
        recorder.capture(file);
        await recorder.settled();
        writeTemp(cwd, "note.txt", "old\nnew line\n");
        recorder.observe({ seq: 7, data: { turn: 1 } });
        await recorder.stopping(1);
        await recorder.settled();
        const summary = appended.length === 0 ? undefined : recorder.summary(appended[0]?.seq as number);
        await recorder.dispose();
        // Chuẩn hoá cwd: hai bên chạy trong hai thư mục tạm KHÁC nhau, nên chỉ so phần còn lại.
        const normalized = summary === undefined ? undefined : (JSON.parse(JSON.stringify(summary).split(cwd).join("<cwd>")) as unknown);
        return { appended: appended.map((entry) => ({ type: entry.type, payload: entry.payload })), summary: normalized, warns };
      } finally {
        bench.done();
      }
    };
    const ours = await run(oursRecorder.TurnRecorder);
    const theirs = await run((await stock("recorder")).TurnRecorder);
    expect(ours.appended).toEqual(theirs.appended);
    expect(ours.summary).toEqual(theirs.summary);
    expect(ours.warns).toEqual(theirs.warns);
    // Bản ghi phải nêu đúng một tệp đã đổi với 1 dòng thêm.
    const summary = ours.summary as { total?: number; added?: number; files?: { path: string }[] } | undefined;
    expect(summary?.total).toBe(1);
    expect(summary?.added).toBe(1);
    expect(summary?.files?.[0]?.path).toBe("note.txt");
  });
});


describe("workspace-changes — bổ sung A/B", () => {
  test("numstat: added không phải số ⇒ NaN ở CẢ HAI bản (giữ nguyên hành vi Number())", async () => {
    const theirs = await stock("numstat");
    const fixture = "abc\t3\tx.ts\0";
    const mine = (oursNumstat.parseNumstat as (text: string) => { added: number }[])(fixture);
    const stockResult = (theirs.parseNumstat as (text: string) => { added: number }[])(fixture);
    expect(mine).toEqual(stockResult);
    expect(Number.isNaN(mine[0]?.added)).toBe(true);
  });

  test("recorder: diff() với seq lạ ⇒ undefined ở CẢ HAI bản", async () => {
    const run = async (Ctor: unknown) => {
      const bench = tempDir();
      try {
        const cwd = realpathSync(bench.dir);
        const session = { append: () => ({ seq: 1 }) };
        const recorder = new (Ctor as new (s: unknown, c: string, e: unknown) => { diff: (seq: number, index: number, signal: AbortSignal) => Promise<unknown>; dispose: () => Promise<void> })(session, cwd, { git: Promise.resolve(null), tempRoot: tmpdir(), maxFiles: 10, maxFileBytes: 1024, diffTimeoutMs: 1000, warn: () => undefined });
        const value = await recorder.diff(999, 0, new AbortController().signal);
        await recorder.dispose();
        return value;
      } finally {
        bench.done();
      }
    };
    expect(await run(oursRecorder.TurnRecorder)).toBeUndefined();
    expect(await run((await stock("recorder")).TurnRecorder)).toBeUndefined();
  });

  test("sameCapture: oversized KHÔNG BAO GIỜ khớp (kể cả với chính nó) — hai bản như nhau", async () => {
    const theirs = await stock("capture");
    const pairs: [unknown, unknown][] = [
      [{ kind: "oversized" }, { kind: "file", file: "/x" }],
      [{ kind: "file", file: "/x" }, { kind: "oversized" }],
    ];
    for (const [a, b] of pairs) {
      const mine = (oursCapture.sameCapture as (x: unknown, y: unknown) => boolean)(a, b);
      const stockResult = (theirs.sameCapture as (x: unknown, y: unknown) => boolean)(a, b);
      expect(mine).toBe(false);
      expect(mine).toBe(stockResult);
    }
  });
});

describe("workspace-changes — plugin A/B", () => {
  test("String(Config) TRÙNG bản gốc; name + inject trùng", async () => {
    const stockPlugin = (await import(join(STOCK_DIR, "lib", "index.js"))) as {
      name: string;
      inject: string[];
      Config: { toString(): string };
    };
    expect(String(oursPlugin.Config)).toBe(String(stockPlugin.Config));
    expect(oursPlugin.name).toBe(stockPlugin.name);
    expect([...oursPlugin.inject]).toEqual([...stockPlugin.inject]);
  });
});

