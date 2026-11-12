/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-workflow: A = bundle gốc, B = artefact của ta;
 *      so tập export, String(Config) + 11 config, bề mặt tool/section/schema, các nhánh foreground (completed ·
 *      cancelled · error · abnormal · abort · lồng · ghi vết hỏng), background (completed · killed · failed ·
 *      thiếu jobs · mirror ring), gói metadata, locale byte-for-byte và mirror subpath ./types
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { assembleBundle, stripSliceScaffold } from "../../packages/host/tool-workflow/src/assemble.ts";
import {
  MODULE_TAIL,
  OUT_FILE_NAME,
  PACKAGE_NAME,
  PART_FILES,
  SLICE_MARKER,
  STOCK_BUNDLE,
  STOCK_PACKAGE_NAME,
  TYPE_MIRROR_FILES,
} from "../../packages/host/tool-workflow/src/manifest.ts";
import {
  EXPORT_NAMES,
  INJECT_NAMES,
  PKG,
  SECTION_KEY,
  SECTION_ORDER,
  STOCK_BYTES,
  STOCK_BYTE_LENGTH,
  STOCK_DIR,
  STOCK_FILE,
  STOCK_NEWLINE_COUNT,
  STOCK_SHA256,
  STOCK_TEXT,
  TOOL_NAME,
  agentOf,
  cleanupArtefact,
  decoded,
  exec,
  mount,
  ourApi,
  ourFilePath,
  outcome,
  pair,
  prepareArtefact,
  sha256,
  stock,
  toolOf,
  trace,
} from "./tool-workflow-harness.ts";
import type { EngineStep, JsonRecord, ParamSchema, PluginApi, Rig } from "./tool-workflow-harness.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Meta HỢP LỆ tối thiểu cho mọi lời gọi tool. */
const META = { name: "audit", description: "audit every file" };

/** Văn bản section systemPrompt mà plugin đăng ký (toolName mặc định). */
const SECTION_TEXT =
  "Use the workflow tool ONLY when the user explicitly asks for a workflow or for large multi-agent orchestration: you write a JavaScript script (the tool description documents the exact format) that fans work out across many subagents with phases and structured results. For one or two delegations, prefer plain subagent calls.";

/** Mô tả tham số run_in_background (so khớp nguyên văn). */
const BACKGROUND_DESCRIPTION =
  "Run as a background job: return a job id immediately instead of waiting; the return value arrives with the completion notice.";

/**
 * Liệt kê MỌI tệp dưới một thư mục (đi cả thư mục con — locale của stock có thể có cây con).
 * Nhận: dir — thư mục gốc cần duyệt.
 * Trả: mảng đường dẫn TƯƠNG ĐỐI so với dir, đã sắp xếp.
 */
function walkingFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string, prefix: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const rel = prefix.length === 0 ? entry.name : prefix + "/" + entry.name;
      if (entry.isDirectory()) walk(join(current, entry.name), rel);
      else out.push(rel);
    }
  };
  walk(dir, "");
  return out.sort();
}

beforeAll(prepareArtefact);
afterAll(cleanupArtefact);

describe("A · artefact byte-identical bundle gốc", () => {
  test("index.js dựng: CÙNG BYTE (17 100 B · 442 dòng · sha256) với bundle gốc, newline cuối giữ nguyên", () => {
    const ourBytes = readFileSync(ourFilePath());
    expect(ourBytes.equals(STOCK_BYTES)).toBe(true);
    expect(statSync(ourFilePath()).size).toBe(STOCK_BYTE_LENGTH);
    expect(STOCK_BYTES.length).toBe(STOCK_BYTE_LENGTH);
    expect(ourBytes.toString("utf8")).toBe(STOCK_TEXT);
    expect(sha256(ourBytes)).toBe(STOCK_SHA256);
    expect(sha256(ourBytes)).toBe(sha256(STOCK_BYTES));
    expect((STOCK_TEXT.match(/\n/gu) ?? []).length).toBe(STOCK_NEWLINE_COUNT);
    expect(STOCK_TEXT.endsWith("\n")).toBe(true);
    expect(STOCK_TEXT.endsWith("\n\n")).toBe(false);
  });

  test("bề mặt module: đúng 4 export {Config, apply, inject, name}; inject 3 dịch vụ; KHÔNG default", () => {
    const ours = ourApi();
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-workflow");
    expect(typeof ours.apply).toBe("function");
    expect(typeof ours.Config).toBe("function");
    expect([...ours.inject]).toEqual([...stock.inject]);
    expect([...ours.inject]).toEqual([...INJECT_NAMES]);
    expect((ours as unknown as { default?: unknown }).default).toBeUndefined();
    expect((stock as unknown as { default?: unknown }).default).toBeUndefined();
  });
});

describe("B · Config (helper THUẦN duy nhất export) A/B", () => {
  test("String(Config) + 11 input (mặc định/tên/trần/khoá lạ/sai kiểu) khớp từng chữ, hai bên y hệt", async () => {
    const scenario = async (api: PluginApi) => ({
      text: String(api.Config),
      empty: api.Config(),
      blank: api.Config({}),
      renamed: api.Config({ toolName: "flow" }),
      capped: api.Config({ maxResultChars: 10 }),
      offBackground: api.Config({ enableRunInBackground: false }),
      unknownKey: api.Config({ khongBiet: 1 }),
      wrongName: await outcome(() => api.Config({ toolName: 3 })),
      zeroCap: await outcome(() => api.Config({ maxResultChars: 0 })),
      fractionalCap: await outcome(() => api.Config({ maxResultChars: 2.5 })),
      wrongBackground: await outcome(() => api.Config({ enableRunInBackground: "yes" })),
    });
    const p = await pair(scenario);
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      text: string;
      empty: JsonRecord;
      blank: JsonRecord;
      renamed: JsonRecord;
      capped: JsonRecord;
      offBackground: JsonRecord;
      unknownKey: JsonRecord;
      wrongName: string;
      zeroCap: string;
      fractionalCap: string;
      wrongBackground: string;
    };
    expect(seen.text).toBe("{ toolName?: string, maxResultChars?: number, enableRunInBackground?: boolean }");
    expect(seen.empty).toEqual({ toolName: "workflow", maxResultChars: 50000, enableRunInBackground: true });
    expect(seen.blank).toEqual({ toolName: "workflow", maxResultChars: 50000, enableRunInBackground: true });
    expect(seen.renamed).toEqual({ toolName: "flow", maxResultChars: 50000, enableRunInBackground: true });
    expect(seen.capped).toEqual({ toolName: "workflow", maxResultChars: 10, enableRunInBackground: true });
    expect(seen.offBackground).toEqual({ toolName: "workflow", maxResultChars: 50000, enableRunInBackground: false });
    expect(seen.unknownKey).toEqual({
      toolName: "workflow",
      maxResultChars: 50000,
      enableRunInBackground: true,
      khongBiet: 1,
    });
    expect(seen.wrongName).toBe("nem|ValidationError|-|$.toolName expected string but got 3");
    expect(seen.zeroCap).toBe("nem|ValidationError|-|$.maxResultChars expected number >= 1 but got 0");
    expect(seen.fractionalCap).toBe("nem|ValidationError|-|$.maxResultChars expected number multiple of 1 but got 2.5");
    expect(seen.wrongBackground).toBe("nem|ValidationError|-|$.enableRunInBackground expected boolean but got yes");
  });
});

describe("C · apply trên Context cordis THẬT", () => {
  test("apply: đăng ký ĐỒNG BỘ đúng 1 tool workflow; chỉ chạm register; section tool:<toolName> order TOOL_WORKFLOW", async () => {
    const p = await pair((_api, rig) => trace(rig));
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      registered: string[];
      toolKeys: string[];
      sections: { name: string; order: number; text: string }[];
      engine: { requests: unknown[]; cancels: unknown[]; disposals: string[] };
      jobs: { started: unknown[] };
      appends: unknown[];
      warnings: string[];
      applyError: string | null;
    };
    expect(seen.registered).toEqual([TOOL_NAME]);
    expect(seen.toolKeys).toEqual(["register"]);
    expect(seen.sections).toEqual([{ name: "tool:workflow", order: SECTION_ORDER, text: SECTION_TEXT }]);
    expect(seen.engine.requests).toEqual([]);
    expect(seen.engine.disposals).toEqual([]);
    expect(seen.jobs.started).toEqual([]);
    expect(seen.appends).toEqual([]);
    expect(seen.warnings).toEqual([]);
    expect(seen.applyError).toBeNull();
    expect(p.rig.registered).toHaveLength(1);
  });

  test("spec tool: description + parameters 4 khoá + meta 4 khoá + output.schema 2 nhánh + output keys khớp khít", async () => {
    const p = await pair((_api, rig) => {
      const tool = toolOf(rig, TOOL_NAME);
      return {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        schema: tool.output.schema,
        outputKeys: Object.keys(tool.output),
        toolKeys: Object.keys(tool),
        presentCallKeys: Object.keys((tool.presentCall({ script: "return 1", meta: META }) ?? {}) as JsonRecord),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      name: string;
      description: string;
      parameters: { type?: string; properties: Record<string, ParamSchema | undefined>; required?: readonly string[] };
      schema: { oneOf?: readonly { properties?: Record<string, ParamSchema | undefined>; required?: readonly string[] }[] };
      outputKeys: string[];
      toolKeys: string[];
      presentCallKeys: string[];
    };
    expect(seen.name).toBe(TOOL_NAME);
    expect(seen.description).toContain("Run a JavaScript workflow script that orchestrates subagents at scale.");
    expect(seen.description).toContain("A stage throw drops that ITEM to `null`");
    expect(seen.parameters.type).toBe("object");
    expect(Object.keys(seen.parameters.properties)).toEqual(["script", "meta", "args", "run_in_background"]);
    expect(seen.parameters.required).toEqual(["script", "meta"]);
    expect(seen.parameters.properties.script?.type).toBe("string");
    expect(seen.parameters.properties.meta?.additionalProperties).toBe(true);
    expect(Object.keys(seen.parameters.properties.meta?.properties ?? {})).toEqual([
      "name",
      "description",
      "whenToUse",
      "phases",
    ]);
    expect(seen.parameters.properties.meta?.required).toEqual(["name", "description"]);
    expect(seen.parameters.properties.args?.additionalProperties).toBe(true);
    expect(seen.parameters.properties.run_in_background?.description).toBe(BACKGROUND_DESCRIPTION);
    expect(Object.keys(seen.parameters.properties.meta?.properties?.phases?.items?.properties ?? {})).toEqual([
      "title",
      "detail",
      "provider",
      "model",
    ]);
    expect(seen.schema.oneOf).toHaveLength(2);
    expect(seen.schema.oneOf?.[0]?.properties?.kind).toMatchObject({ type: "string", const: "background" });
    expect(seen.schema.oneOf?.[1]?.properties?.kind).toMatchObject({ type: "string", const: "foreground" });
    expect(seen.schema.oneOf?.[1]?.properties?.agentsStarted).toMatchObject({ type: "integer" });
    expect(seen.schema.oneOf?.[0]?.required).toEqual(["kind", "jobId", "runId"]);
    expect(seen.schema.oneOf?.[1]?.required).toEqual(["kind", "runId", "agentsStarted", "result"]);
    expect(seen.outputKeys).toEqual(["schema", "render"]);
    expect(seen.toolKeys).toEqual([
      "name",
      "description",
      "parameters",
      "output",
      "execute",
      "presentCall",
      "presentResult",
    ]);
    expect(seen.presentCallKeys).toEqual(["card", "title", "rawInput"]);
  });

  test("config đổi bề mặt: toolName ⇒ tên tool + section; enableRunInBackground:false ⇒ bỏ tham số + lỗi khi đòi", async () => {
    const p = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, "flow");
        return {
          name: tool.name,
          params: Object.keys(tool.parameters.properties),
          sections: rig.sections.map((section) => [section.name, section.order]),
          background: await outcome(() =>
            tool.execute({ script: "return 1", meta: META, run_in_background: true }, exec({ agent })),
          ),
        };
      },
      { config: { toolName: "flow", enableRunInBackground: false } },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { name: string; params: string[]; sections: [string, number][]; background: string };
    expect(seen.name).toBe("flow");
    expect(seen.params).toEqual(["script", "meta", "args"]);
    expect(seen.sections).toEqual([["tool:flow", SECTION_ORDER]]);
    expect(seen.background).toBe("nem|Error|-|run_in_background is disabled for this tool");
    expect(p.rig.jobs.started).toHaveLength(0);
  });

  test("Context THIẾU tools ⇒ cùng TypeError tại ctx.tools.register, 0 tool, không log (section đã đăng ký trước đó)", async () => {
    const noTools = await pair((_api, rig) => trace(rig), { tools: false });
    expect(noTools.our).toBe(noTools.their);
    const seen = decoded(noTools.our) as {
      registered: string[];
      sections: { name: string; order: number; text: string }[];
      applyError: string | null;
      warnings: string[];
    };
    expect(seen.registered).toEqual([]);
    expect(seen.sections).toEqual([{ name: "tool:workflow", order: SECTION_ORDER, text: SECTION_TEXT }]);
    expect(seen.applyError).toBe("TypeError|-|undefined is not an object (evaluating 'ctx.tools.register')");
    expect(seen.warnings).toEqual([]);
    expect(noTools.rig.registered).toHaveLength(0);
  });
});

describe("D · trình bày (presentCall · presentResult · output.render) A/B", () => {
  test("presentCall 2 nhánh + presentResult + render 4 nhánh khớp khít", async () => {
    const p = await pair((_api, rig) => {
      const tool = toolOf(rig, TOOL_NAME);
      const args = { script: "return 1", meta: META };
      return {
        call: tool.presentCall(args),
        callInvalid: tool.presentCall({}) ?? null,
        result: tool.presentResult?.(args, { card: "generic" }) ?? null,
        renderBackground: tool.output.render(args, { kind: "background", jobId: "job-1", runId: "run-1" }),
        renderForeground: tool.output.render(args, {
          kind: "foreground",
          runId: "run-1",
          agentsStarted: 2,
          result: { a: 1 },
        }),
        renderSingle: tool.output.render(args, { kind: "foreground", runId: "run-1", agentsStarted: 1, result: "done" }),
      };
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      call: JsonRecord;
      callInvalid: unknown;
      result: JsonRecord;
      renderBackground: { type: string; text: string }[];
      renderForeground: { type: string; text: string }[];
      renderSingle: { type: string; text: string }[];
    };
    expect(seen.call).toEqual({ card: "generic", title: "workflow: audit", rawInput: "return 1" });
    expect(seen.callInvalid).toBeNull();
    expect(seen.result).toEqual({ card: "generic" });
    expect(seen.renderBackground).toEqual([
      {
        type: "text",
        text: 'workflow "audit" started in the background as job job-1. Its return value arrives with the completion notice; check on it with job_output, stop it with job_kill.',
      },
    ]);
    expect(seen.renderForeground[0]?.text).toBe('workflow "audit" completed (2 agents).\nReturn value:\n{\n  "a": 1\n}');
    expect(seen.renderSingle[0]?.text).toBe('workflow "audit" completed (1 agent).\nReturn value:\n"done"');
  });

  test("render cắt theo maxResultChars: 20 ⇒ [truncated: N more characters] khớp số", async () => {
    const p = await pair(
      (_api, rig) => {
        const tool = toolOf(rig, TOOL_NAME);
        return tool.output.render({ meta: { name: "a" } }, {
          kind: "foreground",
          agentsStarted: 1,
          result: { text: "x".repeat(80) },
        });
      },
      { config: { maxResultChars: 20 } },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { type: string; text: string }[];
    expect(seen[0]?.text).toContain('"text": "xxxxxxx');
    expect(seen[0]?.text).toContain("\n… [truncated: 76 more characters]");
  });
});

describe("E · execute foreground với engine GIẢ", () => {
  test("completed: request {script,meta,args,parent,signal} + ghi run-start/run-end + dispose đúng 1 lần", async () => {
    const step: EngineStep = { mode: "completed", agentsStarted: 2, value: { ok: true } };
    const p = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        const value = await tool.execute({ script: "return 1", meta: META, args: { files: ["a"] } }, exec({ agent }));
        return { value, trace: trace(rig) };
      },
      { engine: step },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      value: JsonRecord;
      trace: {
        engine: {
          requests: {
            script: string;
            meta: JsonRecord;
            args: unknown;
            hasArgs: boolean;
            parent: string | null;
            hasSignal: boolean;
          }[];
          disposals: string[];
        };
        appends: { type: string; data: unknown }[];
      };
    };
    expect(seen.value).toEqual({ kind: "foreground", runId: "run-1", agentsStarted: 2, result: { ok: true } });
    expect(seen.trace.engine.requests).toEqual([
      { script: "return 1", meta: META, args: { files: ["a"] }, hasArgs: true, parent: "a1", hasSignal: true },
    ]);
    expect(seen.trace.engine.disposals).toEqual(["run-1"]);
    expect(seen.trace.appends).toEqual([
      { type: "tool-workflow/run-start", data: { runId: "run-1", name: "audit" } },
      { type: "tool-workflow/run-end", data: { runId: "run-1", stopReason: "completed" } },
    ]);
  });

  test("3 cách kết thúc xấu: cancelled/error/abnormal ⇒ cùng thông điệp, dispose vẫn chạy, run-end vẫn ghi", async () => {
    const cancelled = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        return {
          result: await outcome(() => tool.execute({ script: "s", meta: META }, exec({ agent }))),
          trace: trace(rig),
        };
      },
      { engine: { mode: "cancelled", error: "user cancelled" } },
    );
    expect(cancelled.our).toBe(cancelled.their);
    const seenCancelled = decoded(cancelled.our) as {
      result: string;
      trace: { engine: { disposals: string[] }; appends: { type: string; data: unknown }[] };
    };
    expect(seenCancelled.result).toBe("nem|Error|-|workflow run was cancelled (user cancelled)");
    expect(seenCancelled.trace.engine.disposals).toEqual(["run-1"]);
    expect(seenCancelled.trace.appends[1]).toEqual({
      type: "tool-workflow/run-end",
      data: { runId: "run-1", stopReason: "cancelled" },
    });

    const failed = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        return { result: await outcome(() => tool.execute({ script: "s", meta: META }, exec({ agent }))), trace: trace(rig) };
      },
      { engine: { mode: "error", error: "script threw" } },
    );
    expect(failed.our).toBe(failed.their);
    expect((decoded(failed.our) as { result: string }).result).toBe("nem|Error|-|workflow run failed: script threw");
    expect(failed.rig.engine.disposals).toEqual(["run-1"]);

    const abnormal = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        return { result: await outcome(() => tool.execute({ script: "s", meta: META }, exec({ agent }))), trace: trace(rig) };
      },
      { engine: { mode: "abnormal" } },
    );
    expect(abnormal.our).toBe(abnormal.their);
    expect((decoded(abnormal.our) as { result: string }).result).toBe(
      "nem|Error|-|workflow run ended abnormally (surprise)",
    );
    expect(abnormal.rig.engine.disposals).toEqual(["run-1"]);
  });

  test("ABORT giữa lượt: signal huỷ ⇒ run.cancel('parent step aborted') + lỗi cancelled + dispose vẫn chạy", async () => {
    const p = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        const controller = new AbortController();
        const pending = tool.execute({ script: "s", meta: META }, exec({ agent, controller }));
        controller.abort();
        return { result: await outcome(() => pending), trace: trace(rig) };
      },
      { engine: { mode: "pending" } },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      result: string;
      trace: { engine: { cancels: { id: string; reason: string }[]; disposals: string[] } };
    };
    expect(seen.result).toBe("nem|Error|-|workflow run was cancelled (parent step aborted)");
    expect(seen.trace.engine.cancels).toEqual([{ id: "run-1", reason: "parent step aborted" }]);
    expect(seen.trace.engine.disposals).toEqual(["run-1"]);
  });

  test("lời gọi LỒNG (exec.parent) ⇒ KHÔNG ghi vết bền, vẫn chạy + dispose; thiếu agent ⇒ lỗi rõ", async () => {
    const nested = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        return {
          value: await tool.execute({ script: "s", meta: META, args: {} }, exec({ agent, parent: true })),
          trace: trace(rig),
        };
      },
      { engine: { mode: "completed", agentsStarted: 1, value: 7 } },
    );
    expect(nested.our).toBe(nested.their);
    const seenNested = decoded(nested.our) as {
      value: JsonRecord;
      trace: { engine: { requests: { args: unknown; hasArgs: boolean }[]; disposals: string[] }; appends: unknown[] };
    };
    expect(seenNested.value).toEqual({ kind: "foreground", runId: "run-1", agentsStarted: 1, result: 7 });
    expect(seenNested.trace.engine.requests[0]?.args).toEqual({});
    expect(seenNested.trace.engine.requests[0]?.hasArgs).toBe(true);
    expect(seenNested.trace.engine.disposals).toEqual(["run-1"]);
    expect(seenNested.trace.appends).toEqual([]);

    const noAgent = await pair(async (_api, rig) => {
      const tool = toolOf(rig, TOOL_NAME);
      return { result: await outcome(() => tool.execute({ script: "s", meta: META }, exec())) };
    });
    expect(noAgent.our).toBe(noAgent.their);
    expect((decoded(noAgent.our) as { result: string }).result).toBe(
      "nem|Error|-|workflow tool requires a calling agent (exec.agent was undefined)",
    );
    expect(noAgent.rig.engine.requests).toEqual([]);
  });

  test("ghi vết bền HỎNG (append ném) ⇒ logger.warn + vẫn trả kết quả, KHÔNG ném", async () => {
    const p = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        return {
          value: await tool.execute({ script: "s", meta: META }, exec({ agent })),
          warnings: rig.warnings,
          appends: rig.appends,
        };
      },
      { engine: { mode: "completed", agentsStarted: 1, value: "ok" }, appendFails: ["tool-workflow/run-start"] },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as { value: JsonRecord; warnings: string[]; appends: unknown[] };
    expect(seen.value).toEqual({ kind: "foreground", runId: "run-1", agentsStarted: 1, result: "ok" });
    expect(seen.appends).toEqual([]);
    expect(seen.warnings).toEqual([
      "tool-workflow: disabled durable record after tool-workflow/run-start append failed: Error: append failed: tool-workflow/run-start",
    ]);
  });

  test("tham số SAI: 5 ca ⇒ cùng ToolArgsError từng chữ, KHÔNG chạm engine", async () => {
    const p = await pair(async (_api, rig, agent) => {
      const tool = toolOf(rig, TOOL_NAME);
      return [
        await outcome(() => tool.execute({ script: "s" }, exec({ agent }))),
        await outcome(() => tool.execute({ script: 3, meta: META }, exec({ agent }))),
        await outcome(() => tool.execute({ script: "s", meta: { name: "a" } }, exec({ agent }))),
        await outcome(() => tool.execute({ script: "s", meta: META, args: 5 }, exec({ agent }))),
        await outcome(() => tool.execute({ script: "s", meta: META, run_in_background: "yes" }, exec({ agent }))),
      ];
    });
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as string[];
    expect(seen[0]).toBe('nem|ToolArgsError|INVALID_ARGS|invalid arguments: missing required property "meta"');
    expect(seen[1]).toBe('nem|ToolArgsError|INVALID_ARGS|invalid arguments: "script" must be a string');
    expect(seen[2]).toBe(
      'nem|ToolArgsError|INVALID_ARGS|invalid arguments: missing required property "meta.description"',
    );
    expect(seen[3]).toBe('nem|ToolArgsError|INVALID_ARGS|invalid arguments: "args" must be an object');
    expect(seen[4]).toBe('nem|ToolArgsError|INVALID_ARGS|invalid arguments: "run_in_background" must be a boolean');
    expect(p.rig.engine.requests).toEqual([]);
  });
});

describe("F · execute background với registry jobs GIẢ", () => {
  test("completed: job spec {kind workflow,label,owner,toolCall} + done {completed, detail, result render}", async () => {
    const p = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        const value = await tool.execute({ script: "s", meta: META, run_in_background: true }, exec({ agent }));
        const record = rig.jobs.started[0];
        const done = record === undefined ? null : await record.hooks.done;
        return { value, done, trace: trace(rig) };
      },
      { jobs: true, engine: { mode: "completed", agentsStarted: 2, value: { ok: true } } },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      value: JsonRecord;
      done: JsonRecord;
      trace: {
        jobs: {
          started: {
            id: string;
            kind: string;
            label: string;
            owner: string | null;
            toolCall: JsonRecord;
            appends: { text: string; channel: string }[];
            progresses: string[];
          }[];
        };
        engine: { disposals: string[]; requests: { hasSignal: boolean }[] };
        appends: { type: string; data: unknown }[];
      };
    };
    expect(seen.value).toEqual({ kind: "background", jobId: "job-1", runId: "run-1" });
    expect(seen.done).toEqual({
      status: "completed",
      detail: "2 agents",
      result: 'workflow "audit" completed (2 agents).\nReturn value:\n{\n  "ok": true\n}',
    });
    expect(seen.trace.jobs.started).toEqual([
      {
        id: "job-1",
        kind: "workflow",
        label: "audit",
        owner: "a1",
        toolCall: { callId: "c1", rootCallId: "r1" },
        appends: [],
        progresses: [],
      },
    ]);
    expect(seen.trace.engine.requests[0]?.hasSignal).toBe(false);
    expect(seen.trace.engine.disposals).toEqual(["run-1"]);
    expect(seen.trace.appends).toEqual([
      { type: "tool-workflow/run-start", data: { runId: "run-1", name: "audit" } },
      { type: "tool-workflow/run-end", data: { runId: "run-1", stopReason: "completed" } },
    ]);
  });

  test("background kết thúc xấu: cancelled ⇒ killed; error ⇒ failed (detail lỗi)", async () => {
    const cancelled = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        await tool.execute({ script: "s", meta: META, run_in_background: true }, exec({ agent }));
        return rig.jobs.started[0]?.hooks.done ?? null;
      },
      { jobs: true, engine: { mode: "cancelled", error: "cancelled" } },
    );
    expect(cancelled.our).toBe(cancelled.their);
    expect(decoded(cancelled.our)).toEqual({ status: "killed" });
    expect(cancelled.rig.appends).toEqual([
      { type: "tool-workflow/run-start", data: { runId: "run-1", name: "audit" } },
      { type: "tool-workflow/run-end", data: { runId: "run-1", stopReason: "cancelled" } },
    ]);

    const failed = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        await tool.execute({ script: "s", meta: META, run_in_background: true }, exec({ agent }));
        return rig.jobs.started[0]?.hooks.done ?? null;
      },
      { jobs: true, engine: { mode: "error", error: "script exploded" } },
    );
    expect(failed.our).toBe(failed.their);
    expect(decoded(failed.our)).toEqual({ status: "failed", detail: "script exploded" });
  });

  test("mirror ring: phase/log/agent-start/agent-end ⇒ log chunk + updateProgress; kill có lý do (timeout) ⇒ run.cancel", async () => {
    const p = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        const value = (await tool.execute({ script: "s", meta: META, run_in_background: true }, exec({ agent }))) as JsonRecord;
        const id = String(value.runId);
        rig.ctx.emit("workflow/phase", { id }, "Phase A");
        rig.ctx.emit("workflow/log", { id }, "hello");
        rig.ctx.emit("workflow/agent-start", { id }, { seq: 1, label: "audit:a" });
        rig.ctx.emit("workflow/agent-end", { id }, { seq: 1, outcome: "ok" });
        rig.ctx.emit("workflow/log", { id: "run-other" }, "ignored");
        rig.jobsService.kill(String(value.jobId), undefined, "job killed: timed out after 50ms");
        const done = await (rig.jobs.started[0]?.hooks.done ?? null);
        rig.ctx.emit("workflow/log", { id }, "after settle");
        return { value, done, trace: trace(rig) };
      },
      { jobs: true, engine: { mode: "pending" } },
    );
    expect(p.our).toBe(p.their);
    const seen = decoded(p.our) as {
      done: JsonRecord;
      trace: {
        jobs: { started: { appends: { text: string; channel: string }[]; progresses: string[] }[]; killed: unknown[] };
        engine: { cancels: { id: string; reason: string }[]; disposals: string[] };
      };
    };
    expect(seen.done).toEqual({ status: "killed" });
    const job = seen.trace.jobs.started[0];
    expect(job?.appends).toEqual([
      { text: "▸ Phase A\n", channel: "log" },
      { text: "hello\n", channel: "log" },
      { text: "agent #1 audit:a started\n", channel: "log" },
      { text: "agent #1 ok\n", channel: "log" },
    ]);
    expect(job?.progresses).toEqual(["Phase A"]);
    expect(seen.trace.jobs.killed).toEqual([{ id: "job-1", reason: "job killed: timed out after 50ms" }]);
    expect(seen.trace.engine.cancels).toEqual([{ id: "run-1", reason: "job killed: timed out after 50ms" }]);
    expect(seen.trace.engine.disposals).toEqual(["run-1"]);
  });

  test("background thiếu jobs ⇒ lỗi rõ, KHÔNG chạm engine; run_in_background:false ⇒ vẫn foreground", async () => {
    const noJobs = await pair(async (_api, rig, agent) => {
      const tool = toolOf(rig, TOOL_NAME);
      return {
        result: await outcome(() =>
          tool.execute({ script: "s", meta: META, run_in_background: true }, exec({ agent })),
        ),
      };
    });
    expect(noJobs.our).toBe(noJobs.their);
    expect((decoded(noJobs.our) as { result: string }).result).toBe(
      "nem|Error|-|background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs",
    );
    expect(noJobs.rig.engine.requests).toEqual([]);

    const foreground = await pair(
      async (_api, rig, agent) => {
        const tool = toolOf(rig, TOOL_NAME);
        return tool.execute({ script: "s", meta: META, run_in_background: false }, exec({ agent }));
      },
      { jobs: true, engine: { mode: "completed", agentsStarted: 1, value: "x" } },
    );
    expect(foreground.our).toBe(foreground.their);
    expect(decoded(foreground.our)).toEqual({ kind: "foreground", runId: "run-1", agentsStarted: 1, result: "x" });
    expect(foreground.rig.jobs.started).toHaveLength(0);
  });
});

describe("G · giao kèo gói + manifest + assemble + mirror ./types", () => {
  test("package.json: peer/deps CHÉP stock · gbh peers/tests/nested preset · row ĐÃ KHAI đủ field · exports mirror ./types", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as JsonRecord & {
      name: string;
      private: boolean;
      type: string;
      main: string;
      exports: Record<string, string>;
      peerDependencies: JsonRecord;
      dependencies: JsonRecord;
      gbh: {
        peers: string[];
        tests: string[];
        nested: JsonRecord;
        draft?: string;
        provenance?: JsonRecord;
        row?: unknown;
        row_unmounted_ly_do?: { ly_do?: string; row?: JsonRecord };
      };
    };
    const stockJson = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as {
      peerDependencies: JsonRecord;
      dependencies: JsonRecord;
      exports: Record<string, string>;
    };
    expect(json.name).toBe("@galaxy-blackhole/gbh-tool-workflow");
    expect(json.private).toBe(true);
    expect(json.type).toBe("module");
    expect(json.main).toBe("lib/index.js");
    // 08/11/2026 (Lead): "." nay là OBJECT có điều kiện `types` (lib/types/index.d.ts CÓ THẬT trong gói này)
    // ⇒ consumer TS resolve theo id gói mới thấy kiểu. Khác biệt còn lại vẫn so nguyên văn.
    // 08/11/2026 (dev-1): ep ve Record de bun:test chon duoc overload cua toEqual (mang dieu kien types la object).
    expect(json.exports as Record<string, unknown>).toEqual({
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./types": "./lib/types/types.js",
      "./package.json": "./package.json",
      "./locale/*.json": "./locale/*.json",
    });
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    expect(json.gbh.peers).toEqual([...Object.keys(json.peerDependencies), ...Object.keys(json.dependencies)]);
    expect(json.gbh.tests).toEqual(["tests/host/tool-workflow.test.ts"]);
    // 19/10/2026 (reviewer): gbh có thêm `provenance`; và khi Lead flip thì row xuất hiện thay cho
    // row_unmounted_ly_do. Bất biến đúng: tập khoá ⊆ danh sách cho phép, và ĐÚNG MỘT trong hai dạng
    // (đã mount: row; chưa mount: row_unmounted_ly_do).
    const allowed = ["draft", "nested", "peers", "provenance", "row", "row_unmounted_ly_do", "tests"];
    expect(Object.keys(json.gbh).filter((key) => !allowed.includes(key))).toEqual([]);
    if (json.gbh.row !== undefined) {
      expect(json.gbh.row_unmounted_ly_do).toBeUndefined();
    } else {
      expect(json.gbh.row_unmounted_ly_do).toBeDefined();
    }
    // 20/10/2026 (Lead mount): manifest mount KHÔNG còn `draft`; đối chứng dump chuyển sang ca metadata
    // đọc .parity (giữ nguyên) + `provenance` ghi nguồn stock.
    expect(json.gbh.draft).toBeUndefined();
    const provenance = json.gbh.provenance as JsonRecord;
    expect(provenance["stock"]).toBe("@deepseek-ai/dsh-tool-workflow");
    // 20/10/2026 (Lead mount 6 gói host-tool): row ĐÃ KHAI + mount ⇒ bất biến mới là `gbh.row` ĐỦ
    // id/moduleIds/aliases/hostAliases/tests; KHÔNG còn `row_unmounted_ly_do`.
    expect(json.gbh.row_unmounted_ly_do).toBeUndefined();
    const mounted = json.gbh.row as JsonRecord;
    expect(mounted["id"]).toBe("tool-workflow");
    expect(mounted["moduleIds"]).toEqual(["@galaxy-blackhole/gbh-tool-workflow"]);
    expect(mounted["aliases"]).toEqual(["@deepseek-ai/dsh-tool-workflow"]);
    expect(mounted["hostAliases"]).toEqual(["@deepseek-ai/dsh-tool-workflow"]);
    expect(mounted["tests"]).toEqual(["tests/host/tool-workflow.test.ts"]);
    expect("config" in mounted).toBe(false);
    expect("inject" in mounted).toBe(false);
    // 20/10/2026 (Lead mount): metadata nested chỉ giữ 4 khoá parity đọc; khác biệt disabled giữa preset
    // (ptc TẮT entry lồng) đã ghi ở README thay vì manifest.
    expect(json.gbh.nested).toEqual({
      kind: "preset",
      pluginId: "tool-workflow",
      stockId: "@deepseek-ai/dsh-tool-workflow",
      presets: ["preset-standard", "preset-ptc", "preset-cordis"],
    });
    // Stock có ./src/* và các điều kiện "types" trỏ vào cây kiểu nguồn ⇒ ta BỎ (không ship .d.ts/src).
    expect(Object.keys(stockJson.exports)).toEqual([".", "./types", "./src/*", "./package.json", "./locale/*.json"]);
    // 08/11/2026 (dev-5, sau lượt quét toàn cây của Lead): "." nay là OBJECT có điều kiện `types`
    // (lib/types/index.d.ts CÓ THẬT trong gói này) ⇒ consumer TS resolve theo id gói mới thấy kiểu.
    expect(json.exports["."] as unknown as Record<string, string>).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(existsSync(join(PKG, json.exports["./types"] ?? ""))).toBe(true);
    const require = createRequire(join(PKG, "package.json"));
    for (const name of json.gbh.peers) {
      expect(existsSync(join(PKG, "node_modules", name, "package.json"))).toBe(true);
      expect(() => require.resolve(name)).not.toThrow();
    }
  });

  test("locale byte-for-byte (en/zh) + mirror lib/types byte-identical + ./types import chạy được (record mirror)", async () => {
    const stockLocale = join(STOCK_DIR, "locale");
    const ourLocale = join(PKG, "locale");
    const names = walkingFiles(stockLocale);
    expect(names.length).toBeGreaterThan(0);
    // 20/10/2026: gói ta có THÊM locale/vi.json (bản dịch tiếng Việt CÓ CHỦ ĐÍCH) — chỉ cho phép đúng tệp đó;
    // mọi tệp locale của stock vẫn phải có mặt và BYTE-IDENTICAL.
    expect(walkingFiles(ourLocale).filter((name) => !names.includes(name))).toEqual(["vi.json"]);
    for (const name of names) expect(walkingFiles(ourLocale)).toContain(name);
    for (const name of names) {
      const ours = readFileSync(join(ourLocale, name));
      expect(ours.equals(readFileSync(join(stockLocale, name)))).toBe(true);
      expect(sha256(ours)).toBe(sha256(readFileSync(join(stockLocale, name))));
    }
    for (const [source, target] of TYPE_MIRROR_FILES) {
      const ours = readFileSync(join(PKG, "lib", target));
      const theirs = readFileSync(join(REPO, source));
      expect(ours.equals(theirs)).toBe(true);
      expect(sha256(ours)).toBe(sha256(theirs));
    }
    const types = (await import(pathToFileURL(join(PKG, "lib", "types", "types.js")).href)) as JsonRecord;
    expect(Object.keys(types)).toEqual([]);
    const record = (await import(pathToFileURL(join(PKG, "lib", "types", "record.js")).href)) as {
      createWorkflowRecordMirror(ctx: unknown): { start(runId: string, job: unknown): void; stop(runId: string): void };
    };
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    const job = {
      updates: [] as string[],
      logs: [] as string[],
      updateProgress(title: string): void {
        job.updates.push(title);
      },
      append(text: string, options: { channel: string }): void {
        job.logs.push(options.channel + "|" + text);
      },
    };
    const mirror = record.createWorkflowRecordMirror({
      on(name: string, listener: (...args: unknown[]) => void): void {
        const bucket = listeners.get(name) ?? [];
        bucket.push(listener);
        listeners.set(name, bucket);
      },
    });
    const emit = (name: string, ...args: unknown[]): void => {
      for (const listener of listeners.get(name) ?? []) listener(...args);
    };
    mirror.start("run-1", job);
    emit("workflow/phase", { id: "run-1" }, "Phase A");
    emit("workflow/log", { id: "run-1" }, "hello");
    emit("workflow/agent-start", { id: "run-1" }, { seq: 1, label: "audit:a" });
    emit("workflow/agent-end", { id: "run-1" }, { seq: 1, outcome: "ok" });
    expect(job.updates).toEqual(["Phase A"]);
    expect(job.logs).toEqual([
      "log|▸ Phase A\n",
      "log|hello\n",
      "log|agent #1 audit:a started\n",
      "log|agent #1 ok\n",
    ]);
    mirror.stop("run-1");
    emit("workflow/log", { id: "run-1" }, "sau khi stop");
    expect(job.logs).toHaveLength(4);
  });

  test("manifest hằng số + assemble == stock + stripSliceScaffold từ chối lát thiếu giao kèo", () => {
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-tool-workflow");
    expect(STOCK_PACKAGE_NAME).toBe("@deepseek-ai/dsh-tool-workflow");
    expect(STOCK_BUNDLE).toBe("apps/host/node_modules/@deepseek-ai/dsh-tool-workflow/lib/index.js");
    expect(SLICE_MARKER).toBe("// @ts-nocheck");
    expect(MODULE_TAIL).toBe("export {};");
    expect(PART_FILES).toEqual(["part-00.ts"]);
    expect(OUT_FILE_NAME).toBe("index.js");
    expect(TYPE_MIRROR_FILES).toEqual([
      ["apps/host/node_modules/@deepseek-ai/dsh-tool-workflow/lib/types/types.js", "types/types.js"],
      ["apps/host/node_modules/@deepseek-ai/dsh-tool-workflow/lib/types/record.js", "types/record.js"],
    ]);
    expect(assembleBundle()).toBe(readFileSync(STOCK_FILE, "utf8"));
    expect(assembleBundle()).toBe(STOCK_TEXT);
    const good = "/**\n * desc x\n */\n// @ts-nocheck\n\nA\n\nB\n\nexport {};\n";
    expect(stripSliceScaffold(good, "good.ts")).toEqual(["A", "", "B"]);
    expect(() => stripSliceScaffold("// @ts-nocheck\n\nA\n\nexport {};\n", "no-header.ts")).toThrow(
      "thieu khoi header 5 dong bat buoc",
    );
    expect(() =>
      stripSliceScaffold("/**\n * desc x\n */\n/* @ts-nocheck */\n\nA\n\nexport {};\n", "no-marker.ts"),
    ).toThrow("khong thay dong danh dau lat nguyen van");
    expect(() => stripSliceScaffold("/**\n * desc x\n */\n// @ts-nocheck\n\nA\n", "no-tail.ts")).toThrow(
      "thieu dong ket thuc module",
    );
    expect(() => stripSliceScaffold("/**\n * desc x\n */\n// @ts-nocheck\nA\n\nexport {};\n", "no-gap.ts")).toThrow(
      "thieu dong trong sau dong danh dau",
    );
    expect(() => stripSliceScaffold("/**\n * desc x\n */\n// @ts-nocheck\n\nexport {};\n", "empty.ts")).toThrow(
      "than lat rong",
    );
  });

  test("cổng BYTE của build: delta 0 tuyệt đối + hằng số section khớp bundle (đọc từ artefact)", async () => {
    const rig: Rig = await mount(ourApi(), {});
    expect(rig.sections[0]?.name).toBe("tool:" + TOOL_NAME);
    expect(rig.sections[0]?.order).toBe(SECTION_ORDER);
    expect(rig.sections[0]?.text).toBe(SECTION_TEXT);
    expect(SECTION_KEY).toBe("TOOL_WORKFLOW");
    expect(sha256(Buffer.from(assembleBundle(), "utf8"))).toBe(STOCK_SHA256);
    const bytes = Buffer.from(assembleBundle(), "utf8");
    expect(bytes.equals(STOCK_BYTES)).toBe(true);
    expect(bytes.length - STOCK_BYTES.length).toBe(0);
    expect(agentOf(rig).id).toBe("a1");
  });
});