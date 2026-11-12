/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-bash: A = bundle gốc, B = artefact của ta;
 *      so tập export, String(Config), bộ tool/description/schema, presentCall/presentResult/render,
 *      và các nhánh execute (foreground · background · promoted · sandbox escalation · lỗi)
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";

import {
  DSH_ENV,
  EXPORT_NAMES,
  FENCE,
  INJECT_NAMES,
  KILL_TIMEOUT_DESCRIPTION,
  PROMOTE_TIMEOUT_DESCRIPTION,
  SESSION_CWD,
  STOCK_BYTES,
  STOCK_BYTE_LENGTH,
  STOCK_NEWLINE_COUNT,
  STOCK_SHA256,
  STOCK_TEXT,
  TOOL_NAMES,
  cleanupArtefact,
  decoded,
  exec,
  ourApi,
  ourFilePath,
  outcome,
  pair,
  prepareArtefact,
  sha256,
  stock,
  toolOf,
  trace,
} from "./tool-bash-harness.ts";
import type { JsonRecord, ParamSchema } from "./tool-bash-harness.ts";

beforeAll(prepareArtefact);
afterAll(cleanupArtefact);

describe("A · artefact byte-identical bundle gốc", () => {
  test("index.js dựng trong mkdtemp: CÙNG BYTE (28 064 B · 731 dòng · sha256) với bundle gốc", () => {
    const ourBytes = readFileSync(ourFilePath());
    expect(ourBytes.equals(STOCK_BYTES)).toBe(true);
    expect(statSync(ourFilePath()).size).toBe(STOCK_BYTE_LENGTH);
    expect(STOCK_BYTES.length).toBe(STOCK_BYTE_LENGTH);
    expect(sha256(ourBytes)).toBe(STOCK_SHA256);
    expect(sha256(ourBytes)).toBe(sha256(STOCK_BYTES));
    expect((STOCK_TEXT.match(/\n/gu) ?? []).length).toBe(STOCK_NEWLINE_COUNT);
    expect(ourBytes.toString("utf8")).toBe(STOCK_TEXT);
  });

  test("bề mặt module: đúng 4 export {Config, apply, inject, name}; name tên plugin; inject 5 dịch vụ; KHÔNG default", () => {
    const ours = ourApi();
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-bash");
    expect(typeof ours.apply).toBe("function");
    expect(typeof ours.Config).toBe("function");
    expect([...ours.inject]).toEqual([...stock.inject]);
    expect([...ours.inject]).toEqual([...INJECT_NAMES]);
    expect((ours as unknown as { default?: unknown }).default).toBeUndefined();
    expect((stock as unknown as { default?: unknown }).default).toBeUndefined();
  });
});

describe("B · Config (helper THUẦN duy nhất export) A/B", () => {
  test("String(Config) + 9 input (mặc định/tắt cờ/khoá lạ/sai kiểu) khớp từng chữ", async () => {
    const scenario = async (api: typeof stock) => ({
      text: String(api.Config),
      empty: api.Config(),
      blank: api.Config({}),
      offBackground: api.Config({ enableRunInBackground: false }),
      offPromote: api.Config({ promoteOnTimeout: false }),
      promoteOnly: api.Config({ enableRunInBackground: true, promoteOnTimeout: false }),
      backgroundOnly: api.Config({ enableRunInBackground: false, promoteOnTimeout: true }),
      unknownKey: await outcome(() => api.Config({ khongBiet: 1 })),
      wrongBackground: await outcome(() => api.Config({ enableRunInBackground: "yes" })),
      wrongPromote: await outcome(() => api.Config({ promoteOnTimeout: 3 })),
    });
    const p = await pair(scenario);
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      text: string;
      empty: JsonRecord;
      blank: JsonRecord;
      offBackground: JsonRecord;
      offPromote: JsonRecord;
      promoteOnly: JsonRecord;
      backgroundOnly: JsonRecord;
      unknownKey: string;
      wrongBackground: string;
      wrongPromote: string;
    };
    expect(seen.text).toBe("{ enableRunInBackground?: boolean, promoteOnTimeout?: boolean }");
    expect(seen.empty).toEqual({ enableRunInBackground: true, promoteOnTimeout: true });
    expect(seen.blank).toEqual({ enableRunInBackground: true, promoteOnTimeout: true });
    expect(seen.offBackground).toEqual({ enableRunInBackground: false, promoteOnTimeout: true });
    expect(seen.offPromote).toEqual({ enableRunInBackground: true, promoteOnTimeout: false });
    expect(seen.promoteOnly).toEqual({ enableRunInBackground: true, promoteOnTimeout: false });
    expect(seen.backgroundOnly).toEqual({ enableRunInBackground: false, promoteOnTimeout: true });
    expect(seen.wrongBackground.startsWith("nem|")).toBe(true);
    expect(seen.wrongPromote.startsWith("nem|")).toBe(true);
  });
});

describe("C · apply trên Context cordis THẬT (không có jobs)", () => {
  test("apply: đăng ký ĐỒNG BỘ đúng 1 tool bash; chỉ chạm register; section systemPrompt khớp", async () => {
    const p = await pair((_api, rig) => trace(rig));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      registered: string[];
      syncRegistered: number;
      toolKeys: string[];
      sections: { name: string; order: number; text: string }[];
      errors: string[];
      applyError: string | null;
    };
    expect(seen.registered).toEqual(TOOL_NAMES);
    expect(seen.syncRegistered).toBe(1);
    expect(seen.toolKeys).toEqual(["register"]);
    expect(seen.errors).toEqual([]);
    expect(seen.applyError).toBeNull();
    expect(seen.sections).toEqual([
      {
        name: "tool:bash",
        order: 30,
        text: "Check the [exit code: N] marker on every bash result; investigate failures before moving on.",
      },
    ]);
    expect(p.rig.registered).toHaveLength(1);
  });

  test("spec tool: description + parameters 4 khoá + output.schema 3 nhánh + presentationMeta khớp khít", async () => {
    const p = await pair((_api, rig) => {
      const tool = toolOf(rig, "bash");
      return {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        schema: tool.output.schema,
        outputKeys: Object.keys(tool.output),
        toolKeys: Object.keys(tool),
        presentCallKeys: Object.keys(tool.presentCall({ command: "echo x", description: "in x" }) ?? {}),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      name: string;
      description: string;
      parameters: { type?: string; properties: Record<string, ParamSchema | undefined>; required?: readonly string[] };
      schema: { oneOf?: readonly unknown[] };
      outputKeys: string[];
      toolKeys: string[];
    };
    expect(seen.name).toBe("bash");
    expect(seen.parameters.type).toBe("object");
    expect(Object.keys(seen.parameters.properties)).toEqual(["description", "command", "timeoutMs", "workdir"]);
    expect(seen.parameters.required).toEqual(["description", "command"]);
    expect(seen.parameters.properties.timeoutMs?.description).toBe(KILL_TIMEOUT_DESCRIPTION);
    expect(seen.parameters.properties.run_in_background).toBeUndefined();
    expect(seen.parameters.properties.sandbox_permissions).toBeUndefined();
    expect(seen.parameters.properties.justification).toBeUndefined();
    expect(seen.schema.oneOf).toHaveLength(3);
    expect(seen.outputKeys).toEqual(["schema", "render", "presentationMeta"]);
    expect(seen.toolKeys).toEqual(["name", "description", "parameters", "output", "execute", "presentCall", "presentResult"]);
    expect(seen.description).toContain("Execute a bash command");
    expect(seen.description).toContain("[sandbox: file access denied under <mode> mode]");
    expect(seen.description).toContain("in the arguments.");
  });
});

describe("D · trình bày (presentCall · presentResult · output.render) A/B", () => {
  test("presentCall 3 nhánh + presentResult 3 nhánh + render 4 giá trị (background/promoted/foreground/sandbox) khớp", async () => {
    const foreground = {
      kind: "foreground",
      cwd: "/srv/session",
      exitCode: 1,
      signal: null,
      timedOut: true,
      aborted: false,
      timeoutMs: 50,
      stdout: { text: "x", truncated: true, spillPath: "/tmp/out-1" },
      stderr: { text: "e", truncated: false },
    };
    const denied = {
      ...foreground,
      exitCode: 0,
      timedOut: false,
      stdout: { text: "y", truncated: false },
      sandbox: { mode: "workspace-write", denied: true },
    };
    const p = await pair((_api, rig) => {
      const tool = toolOf(rig, "bash");
      return {
        call: tool.presentCall({ command: "echo x", description: "in x" }),
        callBackground: tool.presentCall({ command: "sleep 1", description: "nap", run_in_background: true }),
        callInvalid: tool.presentCall({}) ?? null,
        callResultForeground:
          tool.presentResult?.(
            { command: "echo x", description: "in x" },
            { content: [{ type: "text", text: "x\n[exit code: 1]" }], value: foreground },
          ) ?? null,
        callResultBackground:
          tool.presentResult?.(
            { command: "sleep 1", description: "nap", run_in_background: true },
            {
              content: [{ type: "text", text: "started background job job-1\n" }],
              value: { kind: "background", jobId: "job-1", cwd: "/srv/session" },
            },
          ) ?? null,
        callResultError:
          tool.presentResult?.(
            { command: "echo x", description: "in x" },
            { content: [{ type: "text", text: "boom\n" }], isError: true, value: foreground },
          ) ?? null,
        renderBackground: tool.output.render({}, { kind: "background", jobId: "job-1", cwd: "/srv/session" }),
        renderPromoted: tool.output.render(
          {},
          { kind: "promoted", cwd: "/srv/session", jobId: "job-1", timeoutMs: 50, output: "part\n" },
        ),
        renderForeground: tool.output.render({}, foreground),
        renderDenied: tool.output.render({}, denied),
        presentation: tool.output.presentationMeta?.({}, foreground) ?? null,
      };
    });
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('"card":"terminal"');
    expect(p.our).toContain('"card":"generic"');
    expect(p.our).toContain('"callInvalid":null');
    expect(p.our).toContain("started background job job-1");
    expect(p.our).toContain("[still running after 50ms; moved to background job job-1]");
    expect(p.our).toContain("[output truncated; full output: /tmp/out-1]");
    expect(p.our).toContain("[timed out after 50ms]");
    expect(p.our).toContain("[exit code: 1]");
    expect(p.our).toContain("[sandbox: file access denied under workspace-write mode]");
    expect(p.our).toContain('"exitCode":1');
    expect(p.our).toContain('"cwd":"/srv/session"');
    expect(p.our).toContain(FENCE + "console\\nstarted background job job-1\\n" + FENCE);
    expect(p.our).toContain(FENCE + "console\\nboom\\n" + FENCE);
  });

  test("render kết quả có stderr: gộp stdout + [stderr] + marker, hai bên y hệt", async () => {
    const p = await pair((_api, rig) => {
      const tool = toolOf(rig, "bash");
      return tool.output.render({}, {
        kind: "foreground",
        cwd: "/srv/session",
        exitCode: 2,
        signal: null,
        timedOut: false,
        aborted: false,
        timeoutMs: 120000,
        stdout: { text: "out", truncated: false },
        stderr: { text: "err", truncated: false },
      });
    });
    expect(p.our).toBe(p.their);
    expect(p.our).toContain("out\\n[stderr]\\nerr");
    expect(p.our).toContain("[exit code: 2]");
  });
});

describe("E · execute foreground với shell GIẢ", () => {
  test("workdir: mặc định = cwd phiên · tương đối ghép cwd · tuyệt đối giữ nguyên; spec + kết quả canonical khớp", async () => {
    const p = await pair(async (_api, rig) => {
      const tool = toolOf(rig, "bash");
      return {
        plain: await tool.execute({ command: "echo a", description: "in a" }, exec()),
        relative: await tool.execute({ command: "echo b", description: "in b", workdir: "sub/dir" }, exec()),
        absolute: await tool.execute({ command: "echo c", description: "in c", workdir: "/abs/dir" }, exec()),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { plain: JsonRecord; relative: JsonRecord; absolute: JsonRecord };
    expect(seen.plain.cwd).toBe(SESSION_CWD);
    expect(seen.relative.cwd).toBe(SESSION_CWD + "/sub/dir");
    expect(seen.absolute.cwd).toBe("/abs/dir");
    expect(seen.plain.kind).toBe("foreground");
    expect(seen.plain.stdout).toEqual({ text: "ok", truncated: false });
    expect(seen.plain.stderr).toEqual({ text: "", truncated: false });
    expect(seen.plain.timeoutMs).toBe(120000);
    const resolves = p.rig.shellCalls.filter((call) => call.method === "resolve");
    expect(resolves).toHaveLength(3);
    expect(resolves[1]?.spec.command).toBe("echo b");
    expect(resolves[1]?.spec.workdir).toBe(SESSION_CWD + "/sub/dir");
    expect(resolves[1]?.spec.dshEnv).toEqual(DSH_ENV);
    expect(resolves[1]?.spec.signal).toBeInstanceOf(AbortSignal);
    expect(p.rig.shellCalls.filter((call) => call.method === "execute")).toHaveLength(3);
  });

  test("timeoutMs + workdir tuyệt đối đi nguyên vào spec; exit 1 + sandbox denied vào canonical khớp", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "echo d", description: "in d", timeoutMs: 250, workdir: "/abs/x" }, exec());
      },
      {
        result: {
          exitCode: 1,
          sandbox: { mode: "workspace-write", denied: true, enforcement: "partial", runnerFailed: false },
          stdout: { text: "out", truncated: true, spillPath: "/tmp/spill-out" },
          stderr: { text: "err", truncated: false },
        },
      },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as JsonRecord;
    expect(seen.exitCode).toBe(1);
    expect(seen.sandbox).toEqual({ mode: "workspace-write", denied: true, enforcement: "partial", runnerFailed: false });
    expect(seen.stdout).toEqual({ text: "out", truncated: true, spillPath: "/tmp/spill-out" });
    const resolve = p.rig.shellCalls[0];
    expect(resolve?.method).toBe("resolve");
    expect(resolve?.spec.timeoutMs).toBe(250);
    expect(resolve?.spec.workdir).toBe("/abs/x");
    expect(resolve?.spec.onExpiry).toBeUndefined();
  });

  test("aborted:true từ executor ⇒ cùng AbortError 'tool call aborted' (code ABORTED)", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "echo e", description: "in e" }, exec());
      },
      { result: { aborted: true, timedOut: false } },
    );
    expect(p.our).toBe(p.their);
    expect(p.our).toBe("nem|AbortError|ABORTED|tool call aborted");
  });

  test("7 tham số sai ⇒ cùng lỗi từng chữ, KHÔNG chạm shell/jobs", async () => {
    const p = await pair(async (_api, rig) => {
      const tool = toolOf(rig, "bash");
      return [
        await outcome(() => tool.execute({ description: "d", command: "   " }, exec())),
        await outcome(() => tool.execute({ description: "  ", command: "x" }, exec())),
        await outcome(() => tool.execute({ description: "d", command: "x", timeoutMs: 0 }, exec())),
        await outcome(() => tool.execute({ description: "d", command: "x", timeoutMs: -5 }, exec())),
        await outcome(() => tool.execute({ description: "d", command: "x", timeoutMs: "5" }, exec())),
        await outcome(() => tool.execute({ description: "d", command: "x", justification: "vì sao" }, exec())),
        await outcome(() => tool.execute({ description: "d", command: "x", sandbox_permissions: "workspace-write" }, exec())),
      ];
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as string[];
    expect(seen[0]).toContain("invalid command: expected a non-empty string");
    expect(seen[1]).toContain("invalid description: expected a non-empty string");
    expect(seen[2]).toContain("invalid timeoutMs: expected a positive number, got 0");
    expect(seen[3]).toContain("invalid timeoutMs: expected a positive number, got -5");
    expect(seen[4]).toContain("nem|ToolArgsError|INVALID_ARGS|");
    expect(seen[4]).toContain('"timeoutMs" must be a number');
    expect(seen[5]).toContain("invalid escalation: justification is only valid together with sandbox_permissions");
    expect(seen[6]).toContain("invalid escalation: sandbox_permissions requires a justification");
    expect(p.rig.shellCalls).toHaveLength(0);
    expect(p.rig.jobs.started).toHaveLength(0);
  });
});

describe("F · composition sandbox (escalation) A/B", () => {
  test("executor confine nhưng THIẾU ctx.sandboxPolicy: apply ném cùng thông điệp, 0 tool", async () => {
    const p = await pair((_api, rig) => trace(rig), { sandboxMode: "workspace-write", sandboxPolicy: false });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { registered: string[]; applyError: string | null };
    expect(seen.registered).toEqual([]);
    expect(seen.applyError).toBe("Error|-|tool-bash: the mounted bash executor confines but ctx.sandboxPolicy is missing");
    expect(p.rig.registered).toHaveLength(0);
  });

  test("có sandboxPolicy: schema quảng bá sandbox_permissions (2 enum) + justification; policy vào spec; cùng mode KHÔNG hỏi; widen HỎI + đổi mode", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return {
          params: Object.keys(tool.parameters.properties),
          enum: tool.parameters.properties.sandbox_permissions?.enum ?? null,
          plain: await tool.execute({ command: "echo a", description: "in a" }, exec()),
          sameMode: await tool.execute(
            { command: "echo b", description: "in b", sandbox_permissions: "workspace-write" },
            exec(),
          ),
          widened: await tool.execute(
            {
              command: "echo c",
              description: "in c",
              sandbox_permissions: "danger-full-access",
              justification: "cần ghi ra đĩa",
            },
            exec(),
          ),
          asks: rig.approvalAsks.map((ask) => ask.reason),
        };
      },
      { sandboxMode: "workspace-write", approvalOutcome: "allowed-once" },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      params: string[];
      enum: string[] | null;
      plain: JsonRecord;
      sameMode: JsonRecord;
      widened: JsonRecord;
      asks: string[];
    };
    expect(seen.params).toEqual([
      "description",
      "command",
      "timeoutMs",
      "workdir",
      "sandbox_permissions",
      "justification",
    ]);
    expect(seen.enum).toEqual(["workspace-write", "danger-full-access"]);
    expect(seen.asks).toEqual(["escalate sandbox to danger-full-access: cần ghi ra đĩa"]);
    expect(seen.plain.kind).toBe("foreground");
    expect(seen.sameMode.kind).toBe("foreground");
    expect(seen.widened.kind).toBe("foreground");
    const policies = p.rig.shellCalls
      .filter((call) => call.method === "resolve")
      .map((call) => call.spec.sandboxPolicy as JsonRecord);
    expect(policies[0]?.mode).toBe("workspace-write");
    expect(policies[1]?.mode).toBe("workspace-write");
    expect(policies[2]?.mode).toBe("danger-full-access");
    expect(policies[0]?.workspaceRoot).toBe("/ws");
    expect(policies[0]?.scope).toEqual({ session: { id: "s1" } });
    expect(p.rig.approvalAsks).toHaveLength(1);
  });

  test("escalation bị TỪ CHỐI ⇒ cùng lỗi the user rejected…, không chạm shell", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute(
          { command: "echo c", description: "in c", sandbox_permissions: "danger-full-access", justification: "cần" },
          exec(),
        );
      },
      { sandboxMode: "workspace-write", approvalOutcome: "rejected" },
    );
    expect(p.our).toBe(p.their);
    expect(p.our).toContain('the user rejected escalating this command to "danger-full-access"');
    expect(p.rig.shellCalls).toHaveLength(0);
    expect(p.rig.approvalAsks).toHaveLength(1);
  });

  test("escalation khi KHÔNG có dịch vụ approval ⇒ cùng lỗi no approval service is composed", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute(
          { command: "echo c", description: "in c", sandbox_permissions: "danger-full-access", justification: "cần" },
          exec(),
        );
      },
      { sandboxMode: "workspace-write" },
    );
    expect(p.our).toBe(p.their);
    expect(p.our).toContain(
      'sandbox escalation to "danger-full-access" requires approval, but no approval service is composed',
    );
    expect(p.rig.shellCalls).toHaveLength(0);
  });
});

describe("G · composition jobs (background · promoted) A/B", () => {
  test("có jobs: apply ĐỒNG BỘ 0 tool, sau settle đúng 1 tool; params thêm run_in_background + mô tả promote", async () => {
    const p = await pair((_api, rig) => trace(rig), { jobs: "complete" });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { registered: string[]; syncRegistered: number };
    expect(seen.syncRegistered).toBe(0);
    expect(seen.registered).toEqual(TOOL_NAMES);
    const tool = toolOf(p.rig, "bash");
    expect(Object.keys(tool.parameters.properties)).toEqual([
      "description",
      "command",
      "timeoutMs",
      "workdir",
      "run_in_background",
    ]);
    expect(tool.parameters.properties.timeoutMs?.description).toBe(PROMOTE_TIMEOUT_DESCRIPTION);
    expect(p.stockRig.registered).toHaveLength(1);
  });

  test("run_in_background:true ⇒ job spec {kind bash, label, toolCall, owner, 2 nguồn} + kết quả background khớp", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "sleep 1", description: "ngủ 1 giây", run_in_background: true }, exec());
      },
      { jobs: "complete" },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as JsonRecord;
    expect(seen.kind).toBe("background");
    expect(seen.jobId).toBe("job-1");
    expect(seen.cwd).toBe(SESSION_CWD);
    const started = p.rig.jobs.started[0];
    expect(started?.spec.kind).toBe("bash");
    expect(started?.spec.label).toBe("sleep 1");
    expect(started?.spec.toolCall).toEqual({ callId: "c1", rootCallId: "r1" });
    expect(started?.spec.owner).toBe("a1");
    expect(started?.spec.output.map((source) => source.channel)).toEqual(["stdout", "stderr"]);
    // Đăng ký job cần spec đã resolve (onExpiry "none") nhưng KHÔNG chạy shell.execute — runner mới gọi run().
    expect(p.rig.shellCalls.map((call) => call.method)).toEqual(["resolve"]);
    expect(p.rig.shellCalls[0]?.spec.onExpiry).toBe("none");
  });

  test("foreground + promote: wait hết hạn ⇒ kind promoted + ring/stderr/spill/sandbox; prepare-timeout ⇒ foreground timedOut", async () => {
    const promote = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "sleep 9", description: "ngủ lâu", timeoutMs: 50 }, exec());
      },
      { jobs: "promote", sandboxInfo: { mode: "workspace-write", denied: true } },
    );
    expect(promote.our).toBe(promote.their);
    const promoted = decoded(promote.our) as JsonRecord;
    expect(promoted.kind).toBe("promoted");
    expect(promoted.jobId).toBe("job-1");
    expect(promoted.timeoutMs).toBe(50);
    expect(promoted.output).toBe(
      "part\n[stderr]\nwarn\n[some output was dropped from memory; full output: /tmp/spill-1]\n" +
        "[sandbox: file access denied under workspace-write mode]",
    );
    expect(promote.rig.jobs.started).toHaveLength(1);
    expect(promote.rig.jobs.removed).toEqual([]);

    const timedOut = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "sleep 9", description: "ngủ lâu", timeoutMs: 50 }, exec());
      },
      { jobs: "prepare-timeout" },
    );
    expect(timedOut.our).toBe(timedOut.their);
    const pending = decoded(timedOut.our) as JsonRecord;
    expect(pending.kind).toBe("foreground");
    expect(pending.timedOut).toBe(true);
    expect(pending.exitCode).toBeNull();
    expect(pending.stdout).toEqual({ text: "", truncated: false });
    expect(timedOut.rig.jobs.killed).toEqual([{ id: "job-1", reason: "timed out during preparation" }]);
    expect(timedOut.rig.jobs.removed).toEqual(["job-1"]);
    expect(timedOut.rig.shellCalls.map((call) => call.method)).toEqual(["resolve"]);
    expect(timedOut.rig.shellCalls[0]?.spec.onExpiry).toBe("none");
  });

  test("caller huỷ khi đang wait ⇒ cùng AbortError + job bị kill 'tool call aborted'", async () => {
    const p = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "sleep 9", description: "ngủ lâu" }, exec());
      },
      { jobs: "abort" },
    );
    expect(p.our).toBe(p.their);
    expect(p.our).toBe("nem|AbortError|ABORTED|tool call aborted");
    expect(p.rig.jobs.killed).toEqual([{ id: "job-1", reason: "tool call aborted" }]);
    expect(p.rig.jobs.removed).toEqual(["job-1"]);
  });

  test("cấu hình tắt: enableRunInBackground=false ⇒ không run_in_background + lỗi khi đòi; promoteOnTimeout=false + jobs ⇒ KHÔNG dùng registry", async () => {
    const off = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return {
          params: Object.keys(tool.parameters.properties),
          timeout: tool.parameters.properties.timeoutMs?.description ?? null,
          background: await outcome(() =>
            tool.execute({ command: "sleep 1", description: "ngủ", run_in_background: true }, exec()),
          ),
        };
      },
      { config: { enableRunInBackground: false }, jobs: "complete" },
    );
    expect(off.our).toBe(off.their);
    const seen = decoded(off.our) as { params: string[]; timeout: string | null; background: string };
    expect(seen.params).toEqual(["description", "command", "timeoutMs", "workdir"]);
    expect(seen.timeout).toBe(KILL_TIMEOUT_DESCRIPTION);
    expect(seen.background).toContain("run_in_background is disabled for this deployment (enableRunInBackground: false)");
    expect(off.rig.jobs.started).toHaveLength(0);

    const noPromote = await pair(
      async (_api, rig) => {
        const tool = toolOf(rig, "bash");
        return tool.execute({ command: "echo fg", description: "foreground" }, exec());
      },
      { config: { promoteOnTimeout: false }, jobs: "complete" },
    );
    expect(noPromote.our).toBe(noPromote.their);
    const foreground = decoded(noPromote.our) as JsonRecord;
    expect(foreground.kind).toBe("foreground");
    expect(foreground.stdout).toEqual({ text: "ok", truncated: false });
    expect(noPromote.rig.jobs.started).toHaveLength(0);
    expect(noPromote.rig.shellCalls.map((call) => call.method)).toEqual(["resolve", "execute"]);
  });

  test("thiếu ctx.tools: apply ném CÙNG TypeError khi chạm ctx.tools.register, 0 tool, không log", async () => {
    const p = await pair((_api, rig) => trace(rig), { tools: false });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { registered: string[]; errors: string[]; applyError: string | null };
    expect(seen.registered).toEqual([]);
    expect(seen.applyError).toContain("TypeError|-|");
    expect(seen.applyError).toContain("ctx.tools.register");
    expect(seen.errors).toEqual([]);
    expect(p.rig.registered).toHaveLength(0);
  });
});
