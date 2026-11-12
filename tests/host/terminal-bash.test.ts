/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-terminal-bash: artefact byte-identical + export/Config + apply
 *      trên Context cordis THẬT + mọi nhánh spawn với process GIẢ (thành công/lỗi/thoát/timeout/abort); KHÔNG spawn thật
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle, stripSliceScaffold } from "../../packages/host/terminal-bash/src/assemble.ts";
import { PART_FILES } from "../../packages/host/terminal-bash/src/manifest.ts";
import {
  CONFIG_DEFAULTS,
  CONFIG_TEXT,
  ENCODING_PREAMBLE,
  EXPORT_NAMES,
  INJECT_NAMES,
  OUR_FILE,
  PKG,
  PROMPT,
  PWSH_PROMPT_SETUP,
  STOCK_BYTES,
  STOCK_BYTE_LENGTH,
  STOCK_LINE_COUNT,
  STOCK_SHA256,
  STOCK_TEXT,
  attempt,
  backendConfig,
  decoded,
  describeSpawn,
  makeCtx,
  makeTerminal,
  mountBackend,
  outcome,
  ours,
  pair,
  sha256,
} from "./terminal-bash-harness.ts";
import type { FakeTerminal, ReadView, SessionLike, SpawnTerminalFn } from "./terminal-bash-harness.ts";

describe("A · artefact BYTE-IDENTICAL bundle gốc", () => {
  test("lib/index.js = 37 846 B · 1 085 dòng · sha256 · delta 0", () => {
    const built = readFileSync(OUR_FILE);
    expect(built.equals(STOCK_BYTES)).toBe(true);
    expect(statSync(OUR_FILE).size).toBe(STOCK_BYTE_LENGTH);
    expect(STOCK_BYTES.length).toBe(STOCK_BYTE_LENGTH);
    expect(sha256(built)).toBe(STOCK_SHA256);
    expect(sha256(built)).toBe(sha256(STOCK_BYTES));
    expect((STOCK_TEXT.match(/\n/gu) ?? []).length).toBe(STOCK_LINE_COUNT);
    expect(built.toString("utf8")).toBe(STOCK_TEXT);
  });

  test("assembleBundle giữ NGUYÊN VĂN + đúng MỘT newline cuối; hai lát ≤ 1000 dòng", () => {
    const assembled = assembleBundle();
    expect(assembled).toBe(STOCK_TEXT);
    expect(assembled.endsWith("\n")).toBe(true);
    expect(assembled.endsWith("\n\n")).toBe(false);
    expect(PART_FILES).toEqual(["part-00.ts", "part-01.ts"]);
    for (const file of PART_FILES) {
      const lines = readFileSync(join(PKG, "src", "parts", file), "utf8").split("\n").length - 1;
      expect(lines).toBeLessThanOrEqual(1000);
    }
  });

  test("stripSliceScaffold: bỏ đúng giao kèo + 6 lỗi biên", () => {
    const header = ["/**", " * author Bùi Trọng Hiếu", " * email kevinbui210191@gmail.com", " * create date 15/10/2026", " * modify date 19/10/2026", " * desc x", " */"];
    const scaffold = (body: readonly string[]): string => [...header, "// @ts-nocheck", "", ...body, "", "export {};", ""].join("\n");
    expect(stripSliceScaffold(scaffold(["a", "b"]), "x.ts")).toEqual(["a", "b"]);
    const noMarker = [...header, "a", "", "export {};", ""].join("\n");
    expect(attempt(() => stripSliceScaffold(noMarker, "x.ts"))).toContain("khong thay dong danh dau");
    const noHeader = ["a", "// @ts-nocheck", "", "b", "", "export {};", ""].join("\n");
    expect(attempt(() => stripSliceScaffold(noHeader, "x.ts"))).toContain("thieu khoi header");
    const noTail = [...header, "// @ts-nocheck", "", "b", ""].join("\n");
    expect(attempt(() => stripSliceScaffold(noTail, "x.ts"))).toContain("thieu dong ket thuc");
    const noBlankAfter = [...header, "// @ts-nocheck", "b", "", "export {};", ""].join("\n");
    expect(attempt(() => stripSliceScaffold(noBlankAfter, "x.ts"))).toContain("thieu dong trong sau");
    const noBlankBefore = [...header, "// @ts-nocheck", "", "b", "export {};", ""].join("\n");
    expect(attempt(() => stripSliceScaffold(noBlankBefore, "x.ts"))).toContain("thieu dong trong truoc");
    const emptyBody = [...header, "// @ts-nocheck", "", "", "export {};", ""].join("\n");
    expect(attempt(() => stripSliceScaffold(emptyBody, "x.ts"))).toContain("than lat rong");
  });
});

describe("B · export runtime + Config A/B", () => {
  test("đúng 6 export, name, inject 5 dịch vụ, không default", async () => {
    const p = await pair((api) => ({
      keys: Object.keys(api).sort(),
      name: api.name,
      inject: [...api.inject],
      types: {
        backend: typeof api.BashTerminalBackend,
        config: typeof api.Config,
        prompt: typeof api.PWSH_PROMPT_SETUP,
        apply: typeof api.apply,
      },
      prompt: api.PWSH_PROMPT_SETUP,
      default: (api as unknown as { default?: unknown }).default ?? null,
    }));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      keys: string[];
      name: string;
      inject: string[];
      types: Record<string, string>;
      prompt: string;
      default: unknown;
    };
    expect(seen.keys).toEqual([...EXPORT_NAMES].sort());
    expect(seen.name).toBe("terminal-bash");
    expect(seen.inject).toEqual(INJECT_NAMES);
    expect(seen.types).toEqual({ backend: "function", config: "function", prompt: "string", apply: "function" });
    expect(seen.prompt).toBe(PWSH_PROMPT_SETUP);
    expect(seen.default).toBeNull();
  });

  test("String(Config) + 7 input (mặc định/pwsh/tường minh/unknown/sai kiểu/sai dialect) khớp từng chữ", async () => {
    const p = await pair((api) => ({
      text: String(api.Config),
      empty: api.Config(),
      blank: api.Config({}),
      pwsh: api.Config({ shellDialect: "pwsh" }),
      explicit: api.Config({ shellPath: "/bin/zsh", shellArgs: ["-l"], rows: 50, cols: 80 }),
      tiny: api.Config({ scrollbackLines: 5, scrollbackMaxBytes: 100, maxReadBytes: 50, timeoutMs: 1234, promptTailGraceMs: 0 }),
      emptyArgs: api.Config({ shellArgs: [] }),
      unknown: api.Config({ khongBiet: 1 }),
      wrongRows: attempt(() => api.Config({ rows: "x" })),
      wrongDialect: attempt(() => api.Config({ shellDialect: "fish" })),
    }));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as Record<string, Record<string, unknown> | string>;
    expect(seen.text).toBe(CONFIG_TEXT);
    expect(seen.empty).toEqual(CONFIG_DEFAULTS);
    expect(seen.blank).toEqual(CONFIG_DEFAULTS);
    expect(seen.pwsh).toEqual({ ...CONFIG_DEFAULTS, shellDialect: "pwsh" });
    expect(seen.explicit).toEqual({
      ...CONFIG_DEFAULTS,
      shellPath: "/bin/zsh",
      shellArgs: ["-l"],
      rows: 50,
      cols: 80,
    });
    expect(seen.tiny).toMatchObject({ scrollbackLines: 5, scrollbackMaxBytes: 100, maxReadBytes: 50, timeoutMs: 1234 });
    expect(seen.emptyArgs).toEqual(CONFIG_DEFAULTS);
    expect(seen.unknown).toMatchObject({ khongBiet: 1 });
    expect(String(seen.wrongRows)).toContain("nem|ValidationError|");
    expect(String(seen.wrongDialect)).toContain('expected "bash" | "pwsh" but got "fish"');
  });
});

describe("C · apply trên Context cordis THẬT", () => {
  test("đăng ký ĐỒNG BỘ đúng 1 backend type=shell, config mặc định bash, đủ 5 dịch vụ", async () => {
    const p = await pair((api) => {
      const rig = makeCtx();
      api.apply(rig.ctx, api.Config());
      const backend = rig.registered[0];
      return {
        count: rig.registered.length,
        immediate: rig.registered.length === 1,
        type: backend?.type ?? null,
        config: backend?.config ?? null,
        sameCtx: backend?.ctx === rig.ctx,
        spawnTerminal: typeof backend?.spawnTerminal,
        createSession: typeof backend?.createSession,
        logs: rig.logs,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      count: number;
      type: string;
      config: Record<string, unknown>;
      sameCtx: boolean;
      spawnTerminal: string;
      createSession: string;
      logs: string[];
    };
    expect(seen.count).toBe(1);
    expect(seen.type).toBe("shell");
    expect(seen.config).toMatchObject({
      backendType: "shell",
      shellDialect: "bash",
      shellPath: "/bin/bash",
      shellArgs: ["--noprofile", "--norc", "-i"],
      rows: 40,
      cols: 160,
      timeoutMs: 30000,
    });
    expect(seen.sameCtx).toBe(true);
    expect(seen.spawnTerminal).toBe("function");
    expect(seen.createSession).toBe("function");
    expect(seen.logs).toEqual([]);
    expect([...ours.inject]).toEqual(INJECT_NAMES);
  });

  test("resolveConfig: pwsh mặc định (pwsh · -NoLogo -NoProfile), tường minh thắng, rỗng ⇒ mặc định dialect", async () => {
    const p = await pair((api) => {
      const run = (input: unknown): unknown => {
        const rig = makeCtx();
        api.apply(rig.ctx, api.Config(input as Record<string, unknown>));
        const config = rig.registered[0]?.config ?? {};
        return {
          backendType: config.backendType,
          shellDialect: config.shellDialect,
          shellPath: config.shellPath,
          shellArgs: config.shellArgs,
        };
      };
      return {
        pwsh: run({ shellDialect: "pwsh" }),
        explicit: run({ shellPath: "/bin/zsh", shellArgs: ["-l"], backendType: "pty", rows: 50, cols: 80 }),
        empty: run({ shellPath: "", shellArgs: [] }),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as Record<string, Record<string, unknown>>;
    expect(seen.pwsh).toEqual({ backendType: "shell", shellDialect: "pwsh", shellPath: "pwsh", shellArgs: ["-NoLogo", "-NoProfile"] });
    expect(seen.explicit).toEqual({ backendType: "pty", shellDialect: "bash", shellPath: "/bin/zsh", shellArgs: ["-l"] });
    expect(seen.empty).toEqual({ backendType: "shell", shellDialect: "bash", shellPath: "/bin/bash", shellArgs: ["--noprofile", "--norc", "-i"] });
  });

  test("6 cấu hình SAI: ném ĐÚNG thông điệp, KHÔNG register backend", async () => {
    const cases = [
      { label: "backendType rong", input: { backendType: "" }, text: "terminal-bash: backendType must be non-empty" },
      { label: "timeoutMs 0", input: { timeoutMs: 0 }, text: "terminal-bash: timeoutMs must be a positive safe integer" },
      { label: "maxReadBytes > scrollbackMaxBytes", input: { maxReadBytes: 5000, scrollbackMaxBytes: 1000 }, text: "terminal-bash: maxReadBytes must not exceed scrollbackMaxBytes" },
      { label: "handoffGraceMs < pollIntervalMs", input: { handoffGraceMs: 10, pollIntervalMs: 50 }, text: "terminal-bash: handoffGraceMs must be at least pollIntervalMs so one readiness poll runs inside the grace window" },
      { label: "promptTailGraceMs nho khac 0", input: { promptTailGraceMs: 10, pollIntervalMs: 50 }, text: "terminal-bash: promptTailGraceMs must be zero or at least pollIntervalMs so a nonzero tolerance contains one readiness poll" },
      { label: "promptTailGraceMs am", input: { promptTailGraceMs: -1 }, text: "terminal-bash: promptTailGraceMs must be a non-negative safe integer" },
    ] as const;
    const p = await pair((api) => cases.map((item) => {
      const rig = makeCtx();
      const error = attempt(() => api.apply(rig.ctx, api.Config(item.input)));
      return { label: item.label, error, registered: rig.registered.length };
    }));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { label: string; error: string; registered: number }[];
    expect(seen).toHaveLength(cases.length);
    for (let index = 0; index < cases.length; index += 1) {
      expect(seen[index]?.error).toBe("nem|Error|-|" + cases[index]?.text);
      expect(seen[index]?.registered).toBe(0);
    }
  });
});

describe("D · spawn với process GIẢ (session THẬT, KHÔNG spawn)", () => {
  test("THÀNH CÔNG: argv/env/cwd đúng, motd+read+signal+status+close, dọn listener", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        behavior: { mode: "success", chunks: ["hello\r\n"], foreground: { processGroupId: 7, inputWaiting: false } },
        overrides: { idleSilenceMs: 5 },
      });
      const session = await mount.backend.spawn(mount.spec);
      const read = session.read({ offset: 0, count: 10 });
      const badOffset = attempt(() => session.read({ offset: -1 }));
      const badCount = attempt(() => session.read({ offset: 0, count: 0 }));
      const signal = await session.signal("SIGTERM");
      const before = session.status();
      const motd = session.motd;
      const pid = session.pid;
      await session.close("test-close");
      const terminal = mount.terminal();
      return {
        spawn: describeSpawn(mount.spawnCalls[0]),
        policyCalls: mount.rig.policyCalls,
        type: mount.backend.type,
        read,
        badOffset,
        badCount,
        signal,
        before,
        motd,
        pid,
        after: session.status(),
        terminateCalls: terminal?.terminateCalls ?? -1,
        signals: terminal?.signals ?? [],
        writes: terminal?.writes ?? [],
        listeners: {
          data: terminal?.output.listenerCount("data") ?? -1,
          end: terminal?.output.listenerCount("end") ?? -1,
          error: terminal?.output.listenerCount("error") ?? -1,
        },
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      spawn: {
        argv: string[];
        cwd: string;
        env: Record<string, string>;
        rows: number;
        cols: number;
        terminalType: string;
        graceMs: number;
        signal: string;
      };
      policyCalls: { session: { id: string } }[];
      type: string;
      read: ReadView;
      badOffset: string;
      badCount: string;
      signal: { delivered: boolean; targetPgid: number };
      before: { kind: string };
      motd: string;
      pid: number;
      after: { kind: string; exitCode: number; signal: string | null };
      terminateCalls: number;
      signals: string[];
      writes: string[];
      listeners: { data: number; end: number; error: number };
    };
    expect(seen.type).toBe("shell");
    expect(seen.spawn.argv).toEqual(["/bin/bash", "--noprofile", "--norc", "-i"]);
    expect(seen.spawn.cwd).toBe("/srv/cwd");
    expect(seen.spawn.env).toMatchObject({
      TERM: "dumb",
      PAGER: "cat",
      GIT_PAGER: "cat",
      DSH_SHELL: "1",
      DSH_SESSION_ID: "owner-1",
      DSH_PTY_SESSION_ID: "term-1",
      PS1: PROMPT,
      PROMPT_COMMAND: "printf \"\\033]133;D;%s\\007\" \"$?\"; PS1='dsh> '",
      BASH_SILENCE_DEPRECATION_WARNING: "1",
    });
    expect(seen.spawn.env.NO_COLOR).toBeUndefined();
    expect(seen.spawn).toMatchObject({ rows: 24, cols: 80, terminalType: "dumb", graceMs: 100, signal: "undefined" });
    expect(seen.policyCalls).toEqual([{ session: { id: "session-1" } }]);
    expect(seen.before).toEqual({ kind: "running" });
    expect(seen.motd).toBe("hello\n");
    expect(seen.pid).toBe(4242);
    expect(seen.read).toEqual({ text: "hello\n", totalLines: 2, lineBegin: 0, lineEnd: 2, truncated: false });
    expect(seen.badOffset).toBe("nem|Error|-|PTY read offset must be a non-negative safe integer");
    expect(seen.badCount).toBe("nem|Error|-|PTY read count must be a positive safe integer");
    expect(seen.signal).toEqual({ delivered: true, targetPgid: 7 });
    expect(seen.after).toEqual({ kind: "exited", exitCode: 0, signal: null });
    expect(seen.terminateCalls).toBe(1);
    expect(seen.signals).toEqual(["SIGTERM"]);
    expect(seen.writes).toEqual([]);
    expect(seen.listeners).toEqual({ data: 0, end: 0, error: 0 });
  });

  test("prompt OSC 133;D + CSI bị lọc: motd sạch, readiness qua prompt (session thật)", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        behavior: {
          mode: "success",
          chunks: ["\u001b[31mred\u001b[0m\r\n", "\u001b]133;D;", "0\u0007dsh> "],
          foreground: { processGroupId: 9, inputWaiting: true },
        },
      });
      const session = await mount.backend.spawn(mount.spec);
      const motd = session.motd;
      const read = session.read({ offset: 0, count: 10 });
      await session.close("prompt-close");
      return { motd, read, terminateCalls: mount.terminal()?.terminateCalls ?? -1 };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { motd: string; read: ReadView; terminateCalls: number };
    expect(seen.motd).toBe("red\n" + PROMPT);
    expect(seen.read).toMatchObject({ text: "red\n" + PROMPT, totalLines: 2, truncated: false });
    expect(seen.terminateCalls).toBe(1);
  });

  test("read cắt theo maxReadBytes (UTF-8 an toàn) + invalid offset/count", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        behavior: { mode: "success", chunks: ["aé\n"], foreground: { processGroupId: 1, inputWaiting: false } },
        overrides: { maxReadBytes: 3, idleSilenceMs: 5 },
      });
      const session = await mount.backend.spawn(mount.spec);
      const read = session.read({ count: 10 });
      await session.close("read-close");
      return { motd: session.motd, read };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { motd: string; read: ReadView };
    expect(seen.motd).toBe("é\n");
    expect(seen.read).toEqual({ text: "é\n", totalLines: 2, lineBegin: 0, lineEnd: 2, truncated: true });
  });

  test("THOÁT khi startup: 'PTY shell exited during startup' + cleanup terminate", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        behavior: { mode: "exit", exitCode: 7, foreground: { processGroupId: 1, inputWaiting: false } },
      });
      const error = await outcome(() => mount.backend.spawn(mount.spec));
      return { error, terminateCalls: mount.terminal()?.terminateCalls ?? -1, spawnCalls: mount.spawnCalls.length };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { error: string; terminateCalls: number; spawnCalls: number };
    expect(seen.error).toBe("nem|Error|-|PTY shell exited during startup");
    expect(seen.terminateCalls).toBe(1);
    expect(seen.spawnCalls).toBe(1);
  });

  test("TIMEOUT startup: câu lỗi timeout + cleanup terminate, không treo", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        behavior: { mode: "never" },
        overrides: { timeoutMs: 25, exactProbeAfterMs: 1000, idleSilenceMs: 1000 },
      });
      const started = Date.now();
      const error = await outcome(() => mount.backend.spawn(mount.spec));
      return { error, elapsedFast: Date.now() - started < 1000, terminateCalls: mount.terminal()?.terminateCalls ?? -1 };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { error: string; elapsedFast: boolean; terminateCalls: number };
    expect(seen.error).toBe("nem|Error|-|PTY shell did not reach readiness before startup timeout");
    expect(seen.elapsedFast).toBe(true);
    expect(seen.terminateCalls).toBe(1);
  });

  test("ABORT: trước spawn ⇒ ném reason, KHÔNG spawn; giữa startup ⇒ ném reason + cleanup", async () => {
    const p = await pair(async (api) => {
      const preController = new AbortController();
      preController.abort(new Error("pre-abort"));
      const pre = mountBackend(api, { signal: preController.signal });
      const preError = await outcome(() => pre.backend.spawn(pre.spec));

      const midController = new AbortController();
      const mid = mountBackend(api, {
        signal: midController.signal,
        behavior: { mode: "never" },
        overrides: { timeoutMs: 1000, exactProbeAfterMs: 1000, idleSilenceMs: 1000 },
      });
      setTimeout(() => midController.abort(new Error("mid-abort")), 5);
      const midError = await outcome(() => mid.backend.spawn(mid.spec));
      return {
        preError,
        preSpawnCalls: pre.spawnCalls.length,
        preTerminal: pre.terminal() === undefined ? null : "co",
        midError,
        midTerminateCalls: mid.terminal()?.terminateCalls ?? -1,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      preError: string;
      preSpawnCalls: number;
      preTerminal: string | null;
      midError: string;
      midTerminateCalls: number;
    };
    expect(seen.preError).toBe("nem|Error|-|pre-abort");
    expect(seen.preSpawnCalls).toBe(0);
    expect(seen.preTerminal).toBeNull();
    expect(seen.midError).toBe("nem|Error|-|mid-abort");
    expect(seen.midTerminateCalls).toBe(1);
  });

  test("LỖI transport: fail send + cleanup lỗi ⇒ TerminalBackendCleanupError (spawnError/cleanupError)", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        behavior: { mode: "error", error: new Error("pty exploded") },
      });
      const error = await outcome(() => mount.backend.spawn(mount.spec));
      return { error, terminateCalls: mount.terminal()?.terminateCalls ?? -1 };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { error: string; terminateCalls: number };
    expect(seen.error).toBe("nem|TerminalBackendCleanupError|-|PTY backend startup and cleanup both failed");
    expect(seen.terminateCalls).toBeGreaterThanOrEqual(1);
  });
});

describe("E · spawn lỗi/cleanup + sandbox + pwsh", () => {
  test("spawnTerminal ném ⇒ nguyên lỗi, không cleanup; createSession ném ⇒ terminate rồi ném", async () => {
    const p = await pair(async (api) => {
      const spawnFailure = mountBackend(api, { spawnError: new Error("spawn boom") });
      const spawnError = await outcome(() => spawnFailure.backend.spawn(spawnFailure.spec));

      const rig = makeCtx();
      let terminal: FakeTerminal | undefined;
      const spawnTerminal: SpawnTerminalFn = async (): Promise<FakeTerminal> => {
        terminal = makeTerminal({ mode: "never" });
        return terminal;
      };
      const backend = new api.BashTerminalBackend(
        rig.ctx,
        backendConfig(api),
        spawnTerminal,
        (): SessionLike => {
          throw new Error("session boom");
        },
      );
      const createError = await outcome(() => backend.spawn({
        owner: { id: "owner-1", session: { id: "session-1" }, ctx: rig.ctx },
        sessionId: "term-1",
        cwd: "/srv/cwd",
      }));
      return {
        spawnError,
        spawnCalls: spawnFailure.spawnCalls.length,
        spawnTerminate: spawnFailure.terminal()?.terminateCalls ?? -1,
        createError,
        createTerminate: terminal?.terminateCalls ?? -1,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      spawnError: string;
      spawnCalls: number;
      spawnTerminate: number;
      createError: string;
      createTerminate: number;
    };
    expect(seen.spawnError).toBe("nem|Error|-|spawn boom");
    expect(seen.spawnCalls).toBe(1);
    expect(seen.spawnTerminate).toBe(-1);
    expect(seen.createError).toBe("nem|Error|-|session boom");
    expect(seen.createTerminate).toBe(1);
  });

  test("sandbox: danger-full-access bỏ confine; read-only confine; thiếu ctx.sandbox ⇒ lỗi rõ", async () => {
    const p = await pair(async (api) => {
      const danger = mountBackend(api, { fakeSession: true, policy: { mode: "danger-full-access" } });
      const dangerSession = await danger.backend.spawn(danger.spec);
      const dangerSpawn = describeSpawn(danger.spawnCalls[0]);

      const confined = mountBackend(api, {
        fakeSession: true,
        policy: { mode: "read-only", read: ["/x"], write: [] },
        withSandbox: true,
        confinedArgv: ["/usr/bin/sandbox-exec", "-p", "(policy)", "/bin/bash", "--noprofile"],
      });
      const confinedSession = await confined.backend.spawn(confined.spec);
      const confinedSpawn = describeSpawn(confined.spawnCalls[0]);

      const missing = mountBackend(api, { fakeSession: true, policy: { mode: "read-only" } });
      const missingError = await outcome(() => missing.backend.spawn(missing.spec));

      return {
        dangerSpawn,
        dangerInit: danger.fakeSession?.initializeCalls ?? -1,
        dangerSpawnCount: danger.spawnCalls.length,
        dangerSessionPid: dangerSession.pid,
        confinedSpawn,
        confinedCalls: confined.rig.confineCalls.map((call) => ({
          argv: call.argv,
          mode: call.policy.mode,
          read: call.policy.read ?? null,
          signal: call.signal,
        })),
        confinedInit: confined.fakeSession?.initializeCalls ?? -1,
        confinedSessionPid: confinedSession.pid,
        missingError,
        missingSpawnCount: missing.spawnCalls.length,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      dangerSpawn: { argv: string[] };
      dangerInit: number;
      dangerSpawnCount: number;
      dangerSessionPid: number;
      confinedSpawn: { argv: string[] };
      confinedCalls: { argv: string[]; mode: string; read: unknown; signal: boolean }[];
      confinedInit: number;
      confinedSessionPid: number;
      missingError: string;
      missingSpawnCount: number;
    };
    expect(seen.dangerSpawn.argv).toEqual(["/bin/bash", "--noprofile", "--norc", "-i"]);
    expect(seen.dangerInit).toBe(1);
    expect(seen.dangerSpawnCount).toBe(1);
    expect(seen.dangerSessionPid).toBe(777);
    expect(seen.confinedSpawn.argv).toEqual(["/usr/bin/sandbox-exec", "-p", "(policy)", "/bin/bash", "--noprofile"]);
    expect(seen.confinedCalls).toEqual([{
      argv: ["/bin/bash", "--noprofile", "--norc", "-i"],
      mode: "read-only",
      read: ["/x"],
      signal: false,
    }]);
    expect(seen.confinedInit).toBe(1);
    expect(seen.confinedSessionPid).toBe(777);
    expect(seen.missingError).toBe('nem|Error|-|terminal-bash: sandbox mode "read-only" requires a ctx.sandbox provider in the execution world');
    expect(seen.missingSpawnCount).toBe(0);
  });

  test("pwsh: env NO_COLOR, KHÔNG PS1/PROMPT_COMMAND; startup gửi ENCODING_PREAMBLE + PWSH_PROMPT_SETUP", async () => {
    const p = await pair(async (api) => {
      const mount = mountBackend(api, {
        fakeSession: true,
        overrides: { shellDialect: "pwsh", shellPath: "/usr/bin/pwsh", shellArgs: ["-NoLogo", "-NoProfile"] },
        policy: { mode: "danger-full-access" },
      });
      const session = await mount.backend.spawn(mount.spec);
      return {
        spawn: describeSpawn(mount.spawnCalls[0]),
        sends: mount.fakeSession?.sends ?? [],
        motd: session.motd,
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      spawn: { argv: string[]; env: Record<string, string> };
      sends: { text: string; submit: boolean }[];
      motd: string;
    };
    expect(seen.spawn.argv).toEqual(["/usr/bin/pwsh", "-NoLogo", "-NoProfile"]);
    expect(seen.spawn.env).toMatchObject({
      TERM: "dumb",
      NO_COLOR: "1",
      DSH_SHELL: "1",
      DSH_SESSION_ID: "owner-1",
      DSH_PTY_SESSION_ID: "term-1",
    });
    expect(seen.spawn.env.PS1).toBeUndefined();
    expect(seen.spawn.env.PROMPT_COMMAND).toBeUndefined();
    expect(seen.sends).toEqual([{ text: ENCODING_PREAMBLE + PWSH_PROMPT_SETUP, submit: true }]);
    expect(seen.motd).toBe("pwsh-ready");
  });
});
