/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-plan-mode: chạy cùng fixture trên Context cordis THẬT
 *      với seam giả rồi so sâu bề mặt export, resolveConfig, chiếu plan, section/pre-step,
 *      lệnh /plan, công cụ exit_plan_mode và cấu hình row/nested trong package.json — không mạng.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PKG,
  REPO,
  STOCK_DIR,
  attempt,
  cleanupSides,
  loadSides,
  mount,
  runCommand,
  runTool,
  runWaterfall,
  same,
  sameAttempt,
  sectionText,
  sha256,
  userQuestionError,
  type Attempt,
  type MountOptions,
  type Obj,
} from "./plan-mode-harness.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

beforeAll(async () => {
  await loadSides();
}, 120_000);

afterAll(cleanupSides);

describe("plan-mode — bề mặt export", () => {
  test("01 export 1:1 + default + inject + EXIT_PLAN_MODE + khoá chiếu", async () => {
    const result = await same((mod) => ({
      keys: Object.keys(mod).sort(),
      exit: mod.EXIT_PLAN_MODE,
      inject: [...((mod.PlanModeController as unknown as { inject?: string[] }).inject ?? [])],
      defaultIsClass: mod.default === mod.PlanModeController,
      resolveType: typeof mod.resolveConfig,
      projectionKey: mod.planProjectionDefinition.key,
      stateVersion: mod.planProjectionDefinition.stateVersion,
      viewType: typeof mod.planProjectionDefinition.wire?.view,
      viewSchemaType: typeof mod.planProjectionDefinition.wire?.viewSchema?.parse,
    }));
    const surface = result.ours as Obj;
    expect(surface.keys).toEqual([
      "EXIT_PLAN_MODE",
      "PlanModeController",
      "default",
      "planProjectionDefinition",
      "resolveConfig",
    ]);
    expect(surface.exit).toBe("exit_plan_mode");
    expect(surface.inject).toEqual(["tools", "systemPrompt", "sessionProjections"]);
    expect(surface.defaultIsClass).toBe(true);
    expect(surface.projectionKey).toBe("plan");
    expect(surface.stateVersion).toBe(3);
    expect(surface.viewType).toBe("function");
    expect(surface.viewSchemaType).toBe("function");
  });
});

describe("plan-mode — resolveConfig", () => {
  test("02 section hợp lệ: giữ nguyên + trả object tách rời", async () => {
    const sections = ["x", " x ", "line1\nline2", "   spaced   ", "Đoạn văn tiếng Việt"];
    for (const section of sections) {
      const result = await same((mod) => mod.resolveConfig({ section }));
      expect((result.ours as Obj).section).toBe(section);
    }
    const detached = await same((mod) => {
      const input = { section: "s" };
      const output = mod.resolveConfig(input);
      return { same: output === input, output };
    });
    expect(detached.ours).toEqual({ same: false, output: { section: "s" } });
  });

  test("03 section rỗng: ném CÙNG câu gốc", async () => {
    const sections = ["", " ", "\n", "	 \n "];
    for (const section of sections) {
      const result = await sameAttempt((mod) => mod.resolveConfig({ section }));
      expect(result.ours).toEqual({
        ok: false,
        failure: { name: "Error", message: "PlanModeConfig needs a non-empty `section`" },
      });
    }
  });

  test("04 section không phải chuỗi: ném CÙNG câu gốc", async () => {
    const inputs: Obj[] = [{}, { section: null }, { section: 5 }, { section: true }, { section: {} }, { section: [] }, { section: undefined }];
    for (const input of inputs) {
      const result = await sameAttempt((mod) => mod.resolveConfig(input));
      expect(result.ours).toEqual({
        ok: false,
        failure: { name: "Error", message: "PlanModeConfig needs a string `section`" },
      });
    }
  });

  test("05 khoá lạ: ném ĐÚNG danh sách + đúng câu gốc", async () => {
    const result = await sameAttempt((mod) => mod.resolveConfig({ section: "x", other: 1 }));
    expect(result.ours).toEqual({
      ok: false,
      failure: { name: "Error", message: "PlanModeConfig has unknown key(s) other — config is { section }" },
    });
    const many = await sameAttempt((mod) => mod.resolveConfig({ section: "x", a: 1, b: 2 }));
    expect(many.ours).toEqual({
      ok: false,
      failure: { name: "Error", message: "PlanModeConfig has unknown key(s) a, b — config is { section }" },
    });
    const precedence = await sameAttempt((mod) => mod.resolveConfig({ section: "", other: 1 }));
    expect(precedence.ours).toEqual({
      ok: false,
      failure: { name: "Error", message: "PlanModeConfig needs a non-empty `section`" },
    });
    const allowed = await sameAttempt((mod) => mod.resolveConfig({ section: "ok" }));
    expect(allowed.ours).toEqual({ ok: true, value: { section: "ok" } });
  });

  test("06 String(Config): bản gốc KHÔNG xuất schema Config — cả hai undefined", async () => {
    const result = await same((mod) => {
      const config = (mod as Obj).Config;
      return { hasConfig: "Config" in mod, type: typeof config, text: String(config) };
    });
    expect(result.ours).toEqual({ hasConfig: false, type: "undefined", text: "undefined" });
  });
});

describe("plan-mode — chiếu plan", () => {
  test("07 fold qua từng sự kiện + view + schema NGHIÊM", async () => {
    const events: Obj[] = [
      { type: "turn/start", data: { turn: 1 } },
      { type: "request/header", data: {} },
      { type: "command/run", data: { commandId: "c1", name: "plan", args: "on", source: { kind: "user" } } },
      { type: "command/done", data: { commandId: "c1", kind: "success", source: { kind: "user" } } },
      { type: "command/run", data: { commandId: "c2", name: "plan", args: "off", source: { kind: "user" } } },
      { type: "command/done", data: { commandId: "c2", kind: "error", text: "no", source: { kind: "user" } } },
      { type: "command/run", data: { commandId: "c3", name: "other", args: "on", source: { kind: "user" } } },
      { type: "plan/mode", data: { active: true } },
      { type: "request/header", data: {} },
      { type: "command/run", data: { commandId: "c4", name: "plan", args: "off", source: { kind: "user" } } },
      { type: "command/done", data: { commandId: "c4", kind: "success", source: { kind: "user" } } },
      { type: "plan/mode", data: { active: false } },
      { type: "command/run", data: { commandId: "c5", name: "plan", args: "on", source: { kind: "user" } } },
      { type: "command/done", data: { commandId: "c5", kind: "success", source: { kind: "user" } } },
    ];
    const result = await same((mod) => {
      const projection = mod.planProjectionDefinition;
      let state = projection.init();
      const trace = [{ state, view: projection.wire.view(state) }];
      for (const event of events) {
        state = projection.apply(state, event);
        trace.push({ state, view: projection.wire.view(state) });
      }
      return trace;
    });
    const trace = result.ours as Obj[];
    expect(trace.map((entry) => entry.view)).toEqual([
      { active: false, pending: false },
      { active: false, pending: false },
      { active: false, pending: false },
      { active: false, pending: true },
      { active: false, pending: true },
      { active: false, pending: false },
      { active: false, pending: false },
      { active: false, pending: false },
      { active: true, pending: false },
      { active: true, pending: false },
      { active: true, pending: true },
      { active: true, pending: true },
      { active: false, pending: false },
      { active: false, pending: true },
      { active: false, pending: true },
    ]);
    expect(trace[0]!.state).toEqual({ active: false, wanted: null, running: null, activeAtLastHeader: null });
    expect(trace[1]!.state).toEqual({ active: false, wanted: null, running: null, activeAtLastHeader: null });
    expect(trace[2]!.state).toEqual({ active: false, wanted: null, running: null, activeAtLastHeader: false });
    expect(trace[14]!.state).toEqual({ active: false, wanted: true, running: null, activeAtLastHeader: true });

    const sameReference = await same((mod) => {
      const projection = mod.planProjectionDefinition;
      const state = projection.init();
      return [
        { type: "turn/start", data: { turn: 1 } },
        { type: "command/run", data: { commandId: "c", name: "other", args: "on" } },
        { type: "command/run", data: { commandId: "c", name: "plan", args: undefined } },
        { type: "command/done", data: { commandId: "zzz", kind: "success" } },
      ].map((event) => projection.apply(state, event) === state);
    });
    expect(sameReference.ours).toEqual([true, true, true, true]);
  });

  test("08 schema trạng thái + schema wire: cùng chấp nhận/từ chối", async () => {
    const result = await same((mod) => {
      const projection = mod.planProjectionDefinition;
      const init = projection.init();
      const invalid = [
        { ...init, extra: true },
        { active: true, wanted: null, running: null },
        { ...init, active: "yes" },
        { ...init, running: { commandId: "c", wanted: true, extra: 1 } },
        { ...init, running: { commandId: 5, wanted: true } },
        { ...init, wanted: "yes" },
      ];
      const stateResults = [init, ...invalid].map((value) => {
        const parsed = projection.stateSchema.safeParse(value);
        return parsed.success ? "ok" : parsed.error.issues;
      });
      const viewResults = [
        { active: true, pending: false },
        { active: false, pending: true },
        { active: true },
        { active: "yes", pending: false },
      ].map((value) => {
        const parsed = projection.wire.viewSchema.safeParse(value);
        return parsed.success ? "ok" : parsed.error.issues;
      });
      return { stateResults, viewResults };
    });
    const stateResults = (result.ours as Obj).stateResults as Array<"ok" | Obj[]>;
    expect(stateResults[0]).toBe("ok");
    for (const entry of stateResults.slice(1)) expect(entry).not.toBe("ok");
    expect((stateResults[1] as Obj[])[0]!.code).toBe("unrecognized_keys");
    expect((stateResults[1] as Obj[])[0]!.keys).toEqual(["extra"]);
    expect((stateResults[2] as Obj[]).map((issue) => issue.path)).toEqual([["activeAtLastHeader"]]);
    expect((stateResults[3] as Obj[])[0]!.path).toEqual(["active"]);
    expect((stateResults[4] as Obj[])[0]!.code).toBe("unrecognized_keys");
    expect((stateResults[5] as Obj[])[0]!.path).toEqual(["running", "commandId"]);
    expect((stateResults[6] as Obj[])[0]!.path).toEqual(["wanted"]);

    const viewResults = (result.ours as Obj).viewResults as Array<"ok" | Obj[]>;
    expect(viewResults[0]).toBe("ok");
    expect(viewResults[1]).toBe("ok");
    expect(viewResults[2]).not.toBe("ok");
    expect((viewResults[2] as Obj[])[0]!.path).toEqual(["pending"]);
    expect(viewResults[3]).not.toBe("ok");
    expect((viewResults[3] as Obj[])[0]!.path).toEqual(["active"]);
  });
});

describe("plan-mode — section + pre-step", () => {
  test("09 section plan:policy: bật/tắt/pending + không agent + thiếu chiếu", async () => {
    const result = await same(async (mod) => {
      const installed = await mount(mod, { active: true, activeAtLastHeader: true });
      const trace = {
        section: installed.sections[0]!.name,
        order: installed.sections[0]!.order,
        orders: installed.orders,
        active: sectionText(installed),
        noAgent: sectionText(installed, false),
      };
      installed.state.active = false;
      const inactive = sectionText(installed);
      await installed.fiber.dispose();
      return { ...trace, inactive };
    });
    expect(result.ours).toEqual({
      section: "plan:policy",
      order: 500,
      orders: ["PLAN_POLICY"],
      active: "POLICY",
      noAgent: "",
      inactive: "",
    });

    const missing = await sameAttempt(async (mod) => {
      const installed = await mount(mod, { planProjection: false });
      try {
        return sectionText(installed);
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(missing.ours).toEqual({
      ok: false,
      failure: { name: "Error", message: "plan-mode requires the plan session projection" },
    });
  });

  test("10 pre-step: active không pending giữ nguyên quyết định", async () => {
    const result = await same(async (mod) => {
      const installed = await mount(mod, { active: true, activeAtLastHeader: true });
      const decision = await runWaterfall(installed, { decision: { kind: "enter", messages: [] } });
      const trace = { decision, appends: installed.appends, injected: installed.injected };
      await installed.fiber.dispose();
      return trace;
    });
    expect(result.ours).toEqual({ decision: { kind: "enter", messages: [] }, appends: [], injected: [] });
  });

  test("11 pre-step: queued on/off ghi plan/mode + narration; reject/aborted/không pending không ghi", async () => {
    const queuedOn = await same(async (mod) => {
      const installed = await mount(mod, { active: false, activeAtLastHeader: false, turnOpen: true });
      const outcome = installed.service.set(installed.agent, true);
      const before = installed.service.get(installed.agent);
      const active = sectionText(installed);
      const decision = await runWaterfall(installed, { decision: { kind: "enter", messages: [] } });
      const trace = { outcome, before, active, decision, appends: installed.appends, after: installed.service.get(installed.agent) };
      await installed.fiber.dispose();
      return trace;
    });
    expect((queuedOn.ours as Obj).outcome).toBe("queued");
    expect((queuedOn.ours as Obj).before).toEqual({ active: false, pending: true });
    expect((queuedOn.ours as Obj).active).toBe("POLICY");
    expect((queuedOn.ours as Obj).appends).toEqual([{ type: "plan/mode", data: { active: true } }]);
    expect((queuedOn.ours as Obj).after).toEqual({ active: true });
    expect(((queuedOn.ours as Obj).decision.messages as Obj[]).map((message) => message.content[0].text)).toEqual([
      "The user switched this session to plan mode.",
    ]);

    const queuedOff = await same(async (mod) => {
      const installed = await mount(mod, { active: true, activeAtLastHeader: true, turnOpen: true });
      const outcome = installed.service.set(installed.agent, false);
      const decision = await runWaterfall(installed);
      const trace = { outcome, decision, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect((queuedOff.ours as Obj).outcome).toBe("queued");
    expect((queuedOff.ours as Obj).appends).toEqual([{ type: "plan/mode", data: { active: false } }]);
    expect(((queuedOff.ours as Obj).decision.messages as Obj[]).map((message) => message.content[0].text)).toEqual([
      "The user switched this session back to the default mode.",
    ]);

    const rejected = await same(async (mod) => {
      const installed = await mount(mod, { active: false, activeAtLastHeader: false, turnOpen: true });
      installed.service.set(installed.agent, true);
      const decision = await runWaterfall(installed, { decision: { kind: "reject" } });
      const trace = { decision, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect(rejected.ours).toEqual({ decision: { kind: "reject" }, appends: [] });

    const aborted = await same(async (mod) => {
      const installed = await mount(mod, { active: false, activeAtLastHeader: false, turnOpen: true });
      installed.service.set(installed.agent, true);
      const decision = await runWaterfall(installed, { decision: { kind: "enter", messages: [] }, aborted: true });
      const trace = { decision, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect(aborted.ours).toEqual({ decision: { kind: "enter", messages: [] }, appends: [] });

    const cancelled = await same(async (mod) => {
      const installed = await mount(mod, { active: false, activeAtLastHeader: true, turnOpen: true });
      installed.service.set(installed.agent, true);
      const outcome = installed.service.set(installed.agent, false);
      const decision = await runWaterfall(installed);
      const trace = { outcome, decision, appends: installed.appends, after: installed.service.get(installed.agent) };
      await installed.fiber.dispose();
      return trace;
    });
    expect((cancelled.ours as Obj).outcome).toBe("cancelled");
    expect((cancelled.ours as Obj).appends).toEqual([]);
    expect((cancelled.ours as Obj).after).toEqual({ active: false });
    expect(((cancelled.ours as Obj).decision.messages as Obj[]).map((message) => message.content[0].text)).toEqual([
      "The user switched this session back to the default mode.",
    ]);
  });

  test("12 set: committed + inject narration; noop; cancelled; thiếu turnBoundary/plan", async () => {
    const committed = await same(async (mod) => {
      const installed = await mount(mod, { active: false, activeAtLastHeader: false });
      const outcome = installed.service.set(installed.agent, true);
      const trace = {
        outcome,
        appends: installed.appends,
        injected: installed.injected,
        after: installed.service.get(installed.agent),
      };
      await installed.fiber.dispose();
      return trace;
    });
    expect((committed.ours as Obj).outcome).toBe("committed");
    expect((committed.ours as Obj).appends).toEqual([{ type: "plan/mode", data: { active: true } }]);
    expect(((committed.ours as Obj).injected as Obj[]).map((message) => message.content[0].text)).toEqual([
      "The user switched this session to plan mode.",
    ]);
    expect((committed.ours as Obj).after).toEqual({ active: true });

    const noop = await same(async (mod) => {
      const installed = await mount(mod, { active: true, activeAtLastHeader: true });
      const outcome = installed.service.set(installed.agent, true);
      const trace = { outcome, appends: installed.appends, injected: installed.injected };
      await installed.fiber.dispose();
      return trace;
    });
    expect(noop.ours).toEqual({ outcome: "noop", appends: [], injected: [] });

    const missingTurn = await sameAttempt(async (mod) => {
      const installed = await mount(mod, { turnProjection: false });
      try {
        return installed.service.set(installed.agent, true);
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(missingTurn.ours).toEqual({
      ok: false,
      failure: { name: "Error", message: "plan-mode requires the turnBoundary session projection" },
    });

    const missingPlan = await sameAttempt(async (mod) => {
      const installed = await mount(mod, { planProjection: false });
      try {
        return installed.service.get(installed.agent);
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(missingPlan.ours).toEqual({
      ok: false,
      failure: { name: "Error", message: "plan-mode requires the plan session projection" },
    });
  });
});

describe("plan-mode — lệnh /plan", () => {
  test("13 mặc định lệnh + mọi nhánh kết quả + steer + attachment", async () => {
    const cases: Array<{ options: MountOptions; input: string; attachments?: Obj[] }> = [
      { options: { active: false }, input: " off" },
      { options: { active: true }, input: " off" },
      { options: { active: true }, input: " off", attachments: [{ type: "file", receiptId: "r1" }] },
      { options: { active: false }, input: "" },
      { options: { active: false }, input: " build it" },
      { options: { active: false }, input: " build it", attachments: [{ type: "file", receiptId: "r1" }] },
      { options: { active: false, turnOpen: true }, input: "" },
      { options: { active: true, turnOpen: true }, input: " off" },
      { options: { active: true, turnOpen: true }, input: "" },
      { options: { active: false, activeAtLastHeader: true }, input: "" },
    ];
    for (const item of cases) {
      const result = await same(async (mod) => {
        const installed = await mount(mod, item.options);
        const definition = installed.commands[0]!;
        const result = await runCommand(installed, item.input, item.attachments ?? []);
        const trace = {
          command: {
            definitionId: definition.definitionId,
            name: definition.name,
            description: definition.description,
            input: definition.input,
          },
          result,
          appends: installed.appends,
          injected: installed.injected,
          steered: installed.steered,
          after: installed.service.get(installed.agent),
        };
        await installed.fiber.dispose();
        return trace;
      });
      const trace = result.ours as Obj;
      expect(trace.command).toEqual({
        definitionId: "@deepseek-ai/dsh-plan-mode",
        name: "plan",
        description: "Enter or leave plan mode",
        input: { hint: "[off|message]", attachments: true },
      });
    }

    const offInactive = await same(async (mod) => {
      const installed = await mount(mod, { active: false });
      const result = await runCommand(installed, " off");
      const trace = { result, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect(offInactive.ours).toEqual({
      result: { kind: "success", text: "Plan mode is already inactive." },
      appends: [],
    });

    const offActive = await same(async (mod) => {
      const installed = await mount(mod, { active: true });
      const result = await runCommand(installed, " off");
      const trace = { result, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect(offActive.ours).toEqual({
      result: { kind: "success", text: "Plan mode off." },
      appends: [{ type: "plan/mode", data: { active: false } }],
    });

    const offAttachments = await same(async (mod) => {
      const installed = await mount(mod, { active: true });
      const result = await runCommand(installed, " off", [{ type: "file", receiptId: "r1" }]);
      const trace = { result, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect(offAttachments.ours).toEqual({
      result: { kind: "error", text: "Attachments cannot accompany /plan off." },
      appends: [],
    });

    const onText = await same(async (mod) => {
      const installed = await mount(mod, { active: false });
      const result = await runCommand(installed, " build it");
      const trace = { result, steered: installed.steered };
      await installed.fiber.dispose();
      return trace;
    });
    expect((onText.ours as Obj).result).toEqual({
      kind: "success",
      text: "Plan mode on. Use /plan off to leave.",
    });
    expect(((onText.ours as Obj).steered as Obj[])[0]!.content).toEqual([{ type: "text", text: "build it" }]);
    expect(((onText.ours as Obj).steered as Obj[])[0]!.source).toEqual({ kind: "user" });

    const onAttachment = await same(async (mod) => {
      const installed = await mount(mod, { active: false });
      const result = await runCommand(installed, " build it", [{ type: "file", receiptId: "r1" }]);
      const trace = { result, steered: installed.steered };
      await installed.fiber.dispose();
      return trace;
    });
    expect(((onAttachment.ours as Obj).steered as Obj[])[0]!.content).toEqual([
      { type: "file", receiptId: "r1" },
      { type: "text", text: "build it" },
    ]);

    const queued = await same(async (mod) => {
      const installed = await mount(mod, { active: false, turnOpen: true });
      const result = await runCommand(installed, "");
      const trace = { result, appends: installed.appends };
      await installed.fiber.dispose();
      return trace;
    });
    expect(queued.ours).toEqual({
      result: {
        kind: "success",
        text: "Entering plan mode (applies from the next step). Use /plan off to leave.",
      },
      appends: [],
    });
  });
});

describe("plan-mode — công cụ exit_plan_mode", () => {
  test("14 review question + approve + presenters + pre-step ghi plan/mode", async () => {
    const result = await same(async (mod) => {
      const installed = await mount(mod, {
        active: true,
        activeAtLastHeader: true,
        userQuestions: async () => ({ answers: [{ id: "plan-review", selected: ["Approve"] }] }),
      });
      const tool = installed.tools[0]!;
      const call = await attempt(() => runTool(installed, { plan: "# Plan X\nbody" }));
      const after = installed.service.get(installed.agent);
      const waterfall = await runWaterfall(installed);
      const trace = {
        tool: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
          schema: tool.output.schema,
          renderApproved: tool.output.render({ plan: "# Plan" }, { approved: true }),
          renderRejected: tool.output.render({ plan: "# Plan" }, { approved: false }),
        },
        call,
        asked: installed.asked,
        concluded: installed.concluded,
        after,
        appends: installed.appends,
        waterfall,
        presented: ["# Plan X\nbody", "## Sub", "plain", "# "].map((plan) => tool.presentCall({ plan })),
        presentedResult: tool.presentResult({ plan: "# Plan X" }, { content: [{ type: "text", text: "ok" }], isError: false }),
      };
      await installed.fiber.dispose();
      return trace;
    });
    const trace = result.ours as Obj;
    expect(trace.tool.name).toBe("exit_plan_mode");
    expect(trace.tool.parameters).toEqual({
      type: "object",
      properties: {
        plan: {
          type: "string",
          description: "The complete plan, as markdown, starting with a # heading that names it.",
        },
      },
      required: ["plan"],
    });
    expect(trace.tool.schema).toEqual({
      type: "object",
      additionalProperties: false,
      properties: { approved: { type: "boolean" } },
      required: ["approved"],
    });
    expect(trace.tool.renderApproved).toEqual([
      {
        type: "text",
        text: "Plan approved — plan mode exited; carry out the plan starting with your next step.",
      },
    ]);
    expect(trace.tool.renderRejected).toEqual([
      {
        type: "text",
        text: "The user dismissed the plan review to reply in their own words; plan mode remains active.",
      },
    ]);
    expect(trace.call).toEqual({ ok: true, value: { approved: true } });
    expect(trace.after).toEqual({ active: true, pending: false });
    expect(trace.appends).toEqual([{ type: "plan/mode", data: { active: false } }]);
    expect(trace.asked).toHaveLength(1);
    expect(trace.asked[0]!.questions).toEqual([
      {
        id: "plan-review",
        header: "Plan review",
        question: "Approve this plan and leave plan mode?",
        detail: "# Plan X\nbody",
        options: [
          {
            label: "Approve",
            description: "Leave plan mode; the plan is carried out from the next step.",
          },
          {
            label: "Keep planning",
            description: "Stay in plan mode; feedback goes back to the model.",
          },
        ],
        intent: { kind: "plan-review", approve: "Approve", callId: "call-1" },
      },
    ]);
    expect(trace.asked[0]!.agent).toBeDefined();
    expect(trace.asked[0]!.signal).toBeDefined();
    expect(trace.presented).toEqual([
      { card: "generic", title: "Plan X", kind: "other", content: [{ type: "text", text: "# Plan X\nbody" }] },
      { card: "generic", title: "Sub", kind: "other", content: [{ type: "text", text: "## Sub" }] },
      { card: "generic", title: "Plan", kind: "other", content: [{ type: "text", text: "plain" }] },
      { card: "generic", title: "Plan", kind: "other", content: [{ type: "text", text: "# " }] },
    ]);
    expect(trace.presentedResult).toEqual({
      card: "generic",
      title: "Plan review",
      content: [{ type: "text", text: "ok" }],
    });
  });

  test("15 lỗi công cụ: thiếu agent/không active/plan sai/thiếu user-questions", async () => {
    const cases: Array<{ options: MountOptions; args: Obj; noAgent?: boolean }> = [
      { options: { active: true }, args: { plan: "# Plan" }, noAgent: true },
      { options: { active: false }, args: { plan: "# Plan" } },
      { options: { active: true }, args: { plan: "" } },
      { options: { active: true }, args: { plan: "Plan" } },
      { options: { active: true }, args: { plan: "#" } },
      { options: { active: true }, args: { plan: "## Sub" } },
      { options: { active: true, userQuestions: false }, args: { plan: "# Plan" } },
    ];
    for (const item of cases) {
      const result = await sameAttempt(async (mod) => {
        const installed = await mount(mod, item.options);
        try {
          return await runTool(installed, item.args, { noAgent: item.noAgent === true });
        } finally {
          await installed.fiber.dispose();
        }
      });
      expect(result.ours.ok).toBe(false);
    }
    const detail = await sameAttempt(async (mod) => {
      const installed = await mount(mod, { active: true });
      try {
        return await runTool(installed, { plan: "Plan" });
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(detail.ours).toEqual({
      ok: false,
      failure: {
        name: "Error",
        message: "exit_plan_mode requires a non-empty markdown plan starting with a # heading",
      },
    });
    const noChannel = await sameAttempt(async (mod) => {
      const installed = await mount(mod, { active: true, userQuestions: false });
      try {
        return await runTool(installed, { plan: "# Plan" });
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(noChannel.ours).toEqual({
      ok: false,
      failure: {
        name: "Error",
        message:
          "no user-questions channel is available to review the plan; ask the user to switch the session mode instead",
      },
    });
  });

  test("16 review từ chối/feedback/ASK_CANCELLED/lỗi khác", async () => {
    const cases: Array<{ answer: () => Promise<Obj>; expected: Obj }> = [
      {
        answer: async () => ({ answers: [{ id: "plan-review", selected: ["Keep planning"] }] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; revise the plan and present it again." },
        },
      },
      {
        answer: async () => ({ answers: [{ id: "plan-review", selected: [], custom: "change X" }] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; their feedback: change X" },
        },
      },
      {
        answer: async () => ({ answers: [{ id: "plan-review", selected: ["Approve"], custom: "x" }] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; their feedback: x" },
        },
      },
      {
        answer: async () => ({ answers: [] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; revise the plan and present it again." },
        },
      },
      {
        answer: async () => ({ answers: [{ id: "other", selected: ["Approve"] }] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; revise the plan and present it again." },
        },
      },
      {
        answer: async () => ({
          answers: [
            { id: "plan-review", selected: ["Approve"] },
            { id: "plan-review", selected: ["Approve"] },
          ],
        }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; revise the plan and present it again." },
        },
      },
      {
        answer: async () => ({ answers: [{ id: "plan-review", selected: [] }] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; revise the plan and present it again." },
        },
      },
      {
        answer: async () => ({ answers: [{ id: "plan-review", selected: ["Approve", "Keep planning"] }] }),
        expected: {
          ok: false,
          failure: { name: "Error", message: "The user chose to keep planning; revise the plan and present it again." },
        },
      },
    ];
    for (const item of cases) {
      const result = await sameAttempt(async (mod) => {
        const installed = await mount(mod, { active: true, userQuestions: item.answer });
        try {
          return await runTool(installed, { plan: "# Plan" });
        } finally {
          await installed.fiber.dispose();
        }
      });
      expect(result.ours as unknown).toEqual(item.expected as unknown);
    }

    const cancelled = await sameAttempt(async (mod) => {
      const installed = await mount(mod, {
        active: true,
        userQuestions: async () => {
          throw userQuestionError("cancelled", "ASK_CANCELLED");
        },
      });
      try {
        const value = await runTool(installed, { plan: "# Plan" });
        return { value, concluded: installed.concluded, appends: installed.appends, after: installed.service.get(installed.agent) };
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(cancelled.ours).toEqual({
      ok: true,
      value: { value: { approved: false }, concluded: 1, appends: [], after: { active: true } },
    });

    const other = await sameAttempt(async (mod) => {
      const installed = await mount(mod, {
        active: true,
        userQuestions: async () => {
          throw userQuestionError("boom", "OTHER");
        },
      });
      try {
        return await runTool(installed, { plan: "# Plan" });
      } finally {
        await installed.fiber.dispose();
      }
    });
    expect(other.ours).toEqual({
      ok: false,
      failure: { name: "UserQuestionError", message: "boom", code: "OTHER" },
    });
  });
});

describe("plan-mode — gói + cấu hình dump", () => {
  test("17 package.json: tên/peer/deps + gbh.row + gbh.nested + hash 2 TEXT", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Obj;
    const stockJson = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Obj;
    expect(json.name).toBe("@galaxy-blackhole/gbh-plan-mode");
    expect(json.private).toBe(true);
    expect(json.type).toBe("module");
    expect(json.main).toBe("lib/index.js");
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true);
    expect(json.peerDependenciesMeta).toEqual(stockJson.peerDependenciesMeta);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    expect(json.gbh.peers).toEqual([...Object.keys(json.peerDependencies), ...Object.keys(json.dependencies)]);
    expect(json.gbh.tests).toEqual(["tests/host/plan-mode.test.ts"]);

    const row = json.gbh.row as Obj;
    const nested = json.gbh.nested as Obj;
    expect(row).toEqual({
      id: "plan-mode",
      // 19/10/2026 (Lead chốt): row stock đang disabled:true ⇒ row INSERT của ta phải tắt theo,
      // nếu không mount sẽ BẬT plan mode mặc định = đổi hành vi (tiền lệ session-title-first-prompt-llm).
      insertDisabled: true,
      config: row.config,
      disabled: true,
      tests: ["tests/host/plan-mode.test.ts"],
    });
    expect(Object.keys(row.config)).toEqual(["section"]);
    expect(nested).toEqual({
      kind: "preset",
      pluginId: "plan-mode",
      stockId: "@deepseek-ai/dsh-plan-mode",
      presetGroup: "planning",
      presets: ["preset-standard", "preset-ptc", "preset-cordis"],
      config: nested.config,
    });
    expect(Object.keys(nested.config)).toEqual(["section"]);
    expect(row.config.section.length).toBe(2361);
    expect(nested.config.section.length).toBe(2358);
    expect(sha256(row.config.section)).toBe("8e3b78ecab292f97fd0ce982c71756abf32651f3feb5e8519f6f2cfa4ae461b5");
    expect(sha256(nested.config.section)).toBe("eab4c75ea563561b1b70dec5ec228564281b979f3b610ec0adacadb435c08951");
    expect(row.config.section).toContain("only to keep the request shape stable");
    expect(nested.config.section).toContain("to keep the tool catalog unchanged");
    expect(nested.config.section).not.toContain("only to keep the request shape stable");
    expect(row.config.section).not.toContain("to keep the tool catalog unchanged");

    for (const [file, config] of [
      ["/tmp/plan-mode-row-config.json", row.config],
      ["/tmp/plan-mode-nested-config.json", nested.config],
    ] as const) {
      if (existsSync(file)) {
        const saved = JSON.parse(readFileSync(file, "utf8")) as Obj;
        expect(config).toEqual(saved.config);
      }
    }
  });

  test("18 cấu trúc row/nested khớp dump ours.yml (nếu .parity có mặt)", () => {
    const dump = join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml");
    if (!existsSync(dump)) return;
    const text = readFileSync(dump, "utf8");
    const lines = text.split("\n");
    expect(lines[282]).toBe("- id: plan-mode");
    expect(lines[283]).toBe("  name: '@deepseek-ai/dsh-plan-mode'");
    expect(lines[332]).toBe("  disabled: true");
    for (const index of [848, 1012, 1275]) {
      expect(lines[index]).toBe("          - id: plan-mode");
      expect(lines[index + 1]).toBe("            name: '@deepseek-ai/dsh-plan-mode'");
    }
  });
});
