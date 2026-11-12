/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho @deepseek-ai/dsh-tool-skill: export · Config · tool · execute · hook gesture · hook catalog.
 *      Harness (import chéo + Context giả) nằm ở ./tool-skill-harness.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** schemastery mà CHÍNH package ta nạp (workspace) — TỆP khác trên đĩa so với bản kernel (nội dung y hệt). */
const OUR_SCHEMASTER = join(REPO, "packages", "host", "tool-skill", "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs");
/** Lớp `Schema` THẬT của schemastery phía TA: `instanceof` so DANH TÍNH LỚP nên phải so trong cùng cây cài. */
const OurSchemaClass = (await import(OUR_SCHEMASTER)).default as abstract new (...args: never[]) => object;
import {
  REPO,
  STOCK_DIR,
  STOCK,
  ALPHA,
  BETA,
  GAMMA,
  ALPHA_DEFINITION,
  BETA_DEFINITION,
  DEFAULT_SUMMARIES,
  DEFAULT_DEFINITIONS,
  LONG_DESCRIPTION,
  TICK,
  stock,
  mine,
  exportNames,
  install,
  toolOf,
  hookAt,
  agentWith,
  payload,
  userMessage,
  catalogMessage,
  catalogEvent,
  normalized,
  runExecute,
  messageOf,
  prepareArtifact,
  artifactPath,
  SchemaClass,
  SCHEMASTER,
} from "./tool-skill-harness.ts";
import type {
  CatalogEntry,
  DecisionLike,
  ExecLike,
  Hook,
  MessageLike,
  PluginLike,
  SkillDefinition,
  SkillResourceBase,
  SkillSummary,
  ToolLike,
} from "./tool-skill-harness.ts";
import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(prepareArtifact);

describe("A. TẬP EXPORT + name/inject — ta phải BẰNG bản gốc", () => {
  test("4 export BẰNG TỪNG TÊN trên artifact: Config · apply · inject · name", () => {
    const oursNames = exportNames(readFileSync(artifactPath(), "utf8"));
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["Config", "apply", "inject", "name"]);
    expect(Object.keys(mine).sort()).toEqual(Object.keys(stock).sort());
  });

  test("artifact nạp schemastery y NHƯ bản gốc (Config là z.object THẬT)", () => {
    const code = readFileSync(artifactPath(), "utf8");
    const stockCode = readFileSync(STOCK, "utf8");
    // Config giờ là z.object THẬT ⇒ artifact nạp schemastery đúng như bundle gốc (shim cũ thì không).
    expect(code.includes('from "@deepseek-ai/schemastery"')).toBe(true);
    expect(stockCode.includes('from "@deepseek-ai/schemastery"')).toBe(true);
    expect(code.match(/from "@deepseek-ai\/schemastery"/g)?.length).toBe(1);
    expect(stockCode.match(/from "@deepseek-ai\/schemastery"/g)?.length).toBe(1);
  });

  test("name tool-skill + inject bốn service — hai bản trùng khít", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-skill");
    expect(Array.isArray(mine.inject)).toBe(true);
    expect([...mine.inject]).toEqual([...stock.inject]);
    expect([...mine.inject]).toEqual(["agents", "tools", "skills", "workingDirectory"]);
  });

  test("thiếu service: apply/execute ném CÙNG chỗ như bản gốc; skills + workingDirectory chỉ chạm khi dùng", async () => {
    const missingTools = {};
    expect(messageOf(() => mine.apply(missingTools, mine.Config({}))))
      .toBe(messageOf(() => stock.apply(missingTools, stock.Config({}))));
    const toolsOnly = { tools: { register: (): void => undefined } };
    expect(messageOf(() => mine.apply(toolsOnly, mine.Config({}))))
      .toBe(messageOf(() => stock.apply(toolsOnly, stock.Config({}))));
    const lazy = { tools: { register: (): void => undefined }, on: (): void => undefined };
    expect(messageOf(() => mine.apply(lazy, mine.Config({})))).toBe("không ném");
    expect(messageOf(() => stock.apply(lazy, stock.Config({})))).toBe("không ném");
    const toolWith = (plugin: PluginLike, ctx: Record<string, unknown>): ToolLike => {
      let registered: ToolLike | undefined;
      plugin.apply({
        ...ctx,
        tools: { register: (tool: unknown): void => { registered = tool as ToolLike; } },
        on: (): void => undefined,
      }, plugin.Config({}));
      if (registered === undefined) throw new Error("không đăng ký tool");
      return registered;
    };
    const signal = new AbortController().signal;
    const exec: ExecLike = { agent: { id: "agent-1" }, signal };
    const oursMissingSkills = await runExecute(toolWith(mine, {
      workingDirectory: { ensure: async (): Promise<string> => "/cwd" },
    }), { name: "alpha" }, exec);
    const stockMissingSkills = await runExecute(toolWith(stock, {
      workingDirectory: { ensure: async (): Promise<string> => "/cwd" },
    }), { name: "alpha" }, exec);
    expect(oursMissingSkills.errorName).toBe(stockMissingSkills.errorName);
    expect(oursMissingSkills.errorMessage).toBe(stockMissingSkills.errorMessage);
    const oursMissingCwd = await runExecute(toolWith(mine, {
      skills: { list: async () => [], get: async () => undefined, snapshot: async () => ({ skills: [], complete: true }) },
    }), { name: "alpha" }, exec);
    const stockMissingCwd = await runExecute(toolWith(stock, {
      skills: { list: async () => [], get: async () => undefined, snapshot: async () => ({ skills: [], complete: true }) },
    }), { name: "alpha" }, exec);
    expect(oursMissingCwd.errorName).toBe(stockMissingCwd.errorName);
    expect(oursMissingCwd.errorMessage).toBe(stockMissingCwd.errorMessage);
  });
});

describe("B. Config — String + type/meta/dict + Standard Schema + mọi nhánh lỗi", () => {
  test("String(Config) TRÙNG từng ký tự; nút gốc type/meta/dict/toString trùng khít", () => {
    const ours = mine.Config;
    const theirs = stock.Config;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe("{ catalogDescriptionMaxLength?: number }");
    expect(ours.type).toBe(theirs.type);
    expect(ours.type).toBe("object");
    expect(ours.meta).toEqual(theirs.meta);
    expect(ours.meta).toEqual({ default: {} });
    expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
    const oursDict = ours.dict;
    const theirsDict = theirs.dict;
    expect(Object.keys(oursDict)).toEqual(Object.keys(theirsDict));
    expect(String(oursDict["catalogDescriptionMaxLength"])).toBe(String(theirsDict["catalogDescriptionMaxLength"]));
    expect(String(oursDict["catalogDescriptionMaxLength"])).toBe("number");
    expect((oursDict["catalogDescriptionMaxLength"] as { readonly meta?: unknown }).meta)
      .toEqual((theirsDict["catalogDescriptionMaxLength"] as { readonly meta?: unknown }).meta);
    expect(ours["~standard"].version).toBe(theirs["~standard"].version);
    expect(ours["~standard"].vendor).toBe(theirs["~standard"].vendor);
    expect(ours["~standard"].version).toBe(1);
    expect(ours["~standard"].vendor).toBe("schemastery");
  });

  test("Config của TA và của bản GỐC đều là schema THẬT của schemastery (mỗi bên một thể hiện lớp)", () => {
    expect(SchemaClass.name).toBe("Schema");
    expect(OurSchemaClass.name).toBe("Schema");
    // Mỗi bản là instance của lớp `Schema` THẬT trong CHÍNH cây phụ thuộc của nó — không phải object mô
    // phỏng cấu trúc. Repo có HAI cây cài (workspace cho ta, kernel cho bản gốc) nên hai lớp `Schema` là
    // hai thể hiện của module: so chéo `instanceof`/prototype giữa hai bên là so HAI BẢN SAO.
    expect(mine.Config instanceof OurSchemaClass).toBe(true);
    expect(stock.Config instanceof SchemaClass).toBe(true);
    expect(Object.getPrototypeOf(mine.Config)).toBe(OurSchemaClass.prototype);
    expect(Object.getPrototypeOf(stock.Config)).toBe(SchemaClass.prototype);
    // …và chúng là CÙNG MỘT hiện thực: tệp schemastery hai bên giống hệt từng byte (khác thể hiện, không khác mã).
    expect(readFileSync(OUR_SCHEMASTER, "utf8")).toBe(readFileSync(SCHEMASTER, "utf8"));
    // Nút con cũng là schema THẬT của schemastery, không phải object mô phỏng cấu trúc.
    const oursField = mine.Config.dict["catalogDescriptionMaxLength"];
    const stockField = stock.Config.dict["catalogDescriptionMaxLength"];
    expect((oursField as object) instanceof OurSchemaClass).toBe(true);
    expect((stockField as object) instanceof SchemaClass).toBe(true);
    // String(Config) vẫn khớp TỪNG KÝ TỰ sau khi đổi sang z.object thật.
    expect(String(mine.Config)).toBe(String(stock.Config));
    expect(String(mine.Config)).toBe("{ catalogDescriptionMaxLength?: number }");
    expect(String(oursField)).toBe(String(stockField));
    expect(String(oursField)).toBe("number");
  });

  test("Config mặc định + giá trị hợp lệ: cùng kết quả, cùng thứ tự khoá, giữ khoá lạ", () => {
    const ours = mine.Config;
    const theirs = stock.Config;
    const cases: unknown[] = [
      undefined,
      {},
      null,
      { catalogDescriptionMaxLength: undefined },
      { catalogDescriptionMaxLength: null },
      { catalogDescriptionMaxLength: 3 },
      { catalogDescriptionMaxLength: 0 },
      { catalogDescriptionMaxLength: 1.5 },
      { catalogDescriptionMaxLength: NaN },
      { catalogDescriptionMaxLength: Infinity },
      { extra: 1 },
      { extra: 1, catalogDescriptionMaxLength: 3 },
    ];
    for (const value of cases) {
      const oursValue = ours(value);
      const theirsValue = theirs(value);
      expect(oursValue).toEqual(theirsValue);
      expect(Object.keys(oursValue)).toEqual(Object.keys(theirsValue));
      expect(Object.keys(oursValue)[0]).toBe("catalogDescriptionMaxLength");
    }
    expect(ours({})).toEqual({ catalogDescriptionMaxLength: 500 });
    expect(ours({ extra: 1 })).toEqual({ catalogDescriptionMaxLength: 500, extra: 1 });
    expect(Object.is(ours({ catalogDescriptionMaxLength: NaN })["catalogDescriptionMaxLength"], NaN)).toBe(true);
  });

  test("Config nhánh lỗi + Standard Schema.validate: CÙNG thông điệp, cùng đường dẫn", () => {
    const ours = mine.Config;
    const theirs = stock.Config;
    const cases: unknown[] = [
      5,
      "x",
      true,
      [],
      { catalogDescriptionMaxLength: "5" },
      { catalogDescriptionMaxLength: true },
      { catalogDescriptionMaxLength: [] },
      { catalogDescriptionMaxLength: {} },
    ];
    for (const value of cases) {
      expect(messageOf(() => ours(value))).toBe(messageOf(() => theirs(value)));
      expect(messageOf(() => ours(value))).not.toBe("không ném");
      expect(ours["~standard"].validate(value)).toEqual(theirs["~standard"].validate(value));
    }
    expect(ours["~standard"].validate({})).toEqual({ value: { catalogDescriptionMaxLength: 500 } });
    expect(ours["~standard"].validate({ catalogDescriptionMaxLength: "5" })).toEqual({
      issues: [{
        message: "$.catalogDescriptionMaxLength expected number but got 5",
        path: ["catalogDescriptionMaxLength"],
      }],
    });
    expect(ours["~standard"].validate([])).toEqual({ issues: [{ message: "expected object but got " }] });
  });

  test("apply từ chối catalogDescriptionMaxLength < 3 / không nguyên — CÙNG thông điệp, không chạm ctx", () => {
    const poisoned = {
      tools: { register: (): never => { throw new Error("ctx.tools.register bị chạm trước khi kiểm config"); } },
      skills: {},
      workingDirectory: {},
      on: (): never => { throw new Error("ctx.on bị chạm trước khi kiểm config"); },
    };
    for (const value of [0, 1, 2, 2.5, NaN, Infinity, -1, "3"]) {
      const oursMessage = messageOf(() => mine.apply(poisoned, { catalogDescriptionMaxLength: value }));
      const stockMessage = messageOf(() => stock.apply(poisoned, { catalogDescriptionMaxLength: value }));
      expect(oursMessage).toBe(stockMessage);
      expect(oursMessage).toBe("tool-skill: catalogDescriptionMaxLength must be an integer greater than or equal to 3");
    }
    const oursHarness = install(mine, { config: { catalogDescriptionMaxLength: 3 } });
    const stockHarness = install(stock, { config: { catalogDescriptionMaxLength: 3 } });
    expect(oursHarness.tools.length).toBe(stockHarness.tools.length);
    expect(oursHarness.tools.length).toBe(1);
  });
});

describe("C. Định nghĩa tool skill — name/description/parameters/output/render/presentCall", () => {
  test("đăng ký ĐÚNG một tool, mọi trường schema TRÙNG bản gốc", () => {
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    expect(oursHarness.tools.length).toBe(1);
    expect(stockHarness.tools.length).toBe(1);
    const ours = toolOf(oursHarness);
    const theirs = toolOf(stockHarness);
    expect(ours.name).toBe(theirs.name);
    expect(ours.name).toBe("skill");
    expect(ours.description).toBe(theirs.description);
    expect(ours.description).toBe("Load the full instructions for a skill. Call it before acting on a task that names or clearly matches a skill in the session skill catalog.");
    expect(ours.parameters).toEqual(theirs.parameters);
    expect(ours.parameters).toEqual({
      type: "object",
      properties: {
        name: { type: "string", description: "The exact skill name from the available skills list." },
      },
      required: ["name"],
    });
    expect(ours.output.schema).toEqual(theirs.output.schema);
    expect(Object.keys(ours.output).sort()).toEqual(Object.keys(theirs.output).sort());
    expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
  });

  test("output.render TRÙNG khít cho cả bốn hình dạng resourceBase + tên cần thoát", () => {
    const ours = toolOf(install(mine));
    const theirs = toolOf(install(stock));
    const values: unknown[] = [
      { name: "alpha", provider: "provider-a", content: "body", resourceBase: { kind: "directory", path: "/skills/alpha" } },
      { name: "alpha", provider: "provider-a", content: "body", resourceBase: { kind: "url", url: "https://example.test/a?x=1&y=2" } },
      { name: "alpha", provider: "provider-a", content: "body", resourceBase: { kind: "opaque", description: "remote <bundle>" } },
      { name: "alpha", provider: "provider-a", content: "body" },
      { name: 'a&b"c<d', provider: "p&<", content: "line <tag>" },
    ];
    for (const value of values) {
      const oursBlocks = ours.output.render({}, value);
      const theirsBlocks = theirs.output.render({}, value);
      expect(oursBlocks).toEqual(theirsBlocks);
      expect(oursBlocks[0]?.type).toBe("text");
    }
    const directory = ours.output.render({}, values[0]);
    expect(directory).toEqual([{
      type: "text",
      text: [
        '<skill_content name="alpha">',
        "<skill_resources>",
        "Base directory for this skill: /skills/alpha",
        "Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.",
        "</skill_resources>",
        "",
        "<skill_instructions>",
        "body",
        "</skill_instructions>",
        "</skill_content>",
      ].join("\n"),
    }]);
    const absent = ours.output.render({}, values[3]);
    expect(absent[0]?.text ?? "").toContain('Resources for this skill are managed by provider "provider-a".');
  });

  test("presentCall TRÙNG bản gốc; tham số hỏng ⇒ undefined (soft-validate)", () => {
    const ours = toolOf(install(mine));
    const theirs = toolOf(install(stock));
    const calls: unknown[] = [{ name: "alpha" }, { name: "" }, { name: 5 }, {}, null, "alpha"];
    for (const args of calls) {
      expect(ours.presentCall?.(args)).toEqual(theirs.presentCall?.(args));
    }
    expect(ours.presentCall?.({ name: "alpha" })).toEqual({
      card: "generic",
      title: "Load skill alpha",
      kind: "read",
      rawInput: "alpha",
    });
    expect(ours.presentCall?.({})).toBeUndefined();
    expect(ours.presentCall?.({ name: 5 })).toBeUndefined();
  });
});

describe("D. execute — happy path + mọi nhánh lỗi", () => {
  test("happy path: kết quả + lookup (cwd/signal/scope) TRÙNG bản gốc; resourceBase là bản sao", async () => {
    const signal = new AbortController().signal;
    const agent = { id: "agent-1" };
    const exec: ExecLike = { agent, signal };
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    const ours = await runExecute(toolOf(oursHarness), { name: "alpha" }, exec);
    const theirs = await runExecute(toolOf(stockHarness), { name: "alpha" }, exec);
    expect(ours.value).toEqual(theirs.value);
    expect(ours.value).toEqual({ name: "alpha", provider: "provider-a", content: "# Alpha body" });
    expect(ours.errorMessage).toBeUndefined();
    expect(oursHarness.ensureCalls.length).toBe(1);
    expect(oursHarness.ensureCalls[0]?.agent).toBe(agent);
    expect(oursHarness.ensureCalls[0]?.signal).toBe(signal);
    expect(oursHarness.listLookups[0]).toEqual({ cwd: "/cwd", signal, scope: agent });
    expect(oursHarness.getCalls[0]).toEqual({ name: "alpha", lookup: { cwd: "/cwd", signal, scope: agent } });
    expect(stockHarness.listLookups[0]).toEqual(oursHarness.listLookups[0]);
    expect(stockHarness.getCalls[0]).toEqual(oursHarness.getCalls[0]);
    const resourceBase: SkillResourceBase = { kind: "url", url: "https://example.test/skill" };
    const definition: SkillDefinition = { ...ALPHA_DEFINITION, resourceBase };
    const customOurs = install(mine, { get: async () => definition });
    const customStock = install(stock, { get: async () => definition });
    const oursWithBase = await runExecute(toolOf(customOurs), { name: "alpha" }, exec);
    const theirsWithBase = await runExecute(toolOf(customStock), { name: "alpha" }, exec);
    expect(oursWithBase.value).toEqual(theirsWithBase.value);
    expect(oursWithBase.value).toEqual({
      name: "alpha",
      provider: "provider-a",
      resourceBase: { kind: "url", url: "https://example.test/skill" },
      content: "# Alpha body",
    });
    const produced = oursWithBase.value as { readonly resourceBase?: unknown };
    expect(produced.resourceBase).not.toBe(resourceBase);
  });

  test("không có agent ⇒ cwd undefined và KHÔNG gọi ensure — TRÙNG bản gốc", async () => {
    const signal = new AbortController().signal;
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    const ours = await runExecute(toolOf(oursHarness), { name: "alpha" }, { signal });
    const theirs = await runExecute(toolOf(stockHarness), { name: "alpha" }, { signal });
    expect(ours.value).toEqual(theirs.value);
    expect(oursHarness.ensureCalls.length).toBe(0);
    expect(stockHarness.ensureCalls.length).toBe(0);
    expect(oursHarness.listLookups[0]).toEqual({ cwd: undefined, signal, scope: undefined });
    expect(stockHarness.listLookups[0]).toEqual(oursHarness.listLookups[0]);
  });

  test("các nhánh lỗi execute TRÙNG thông điệp + lớp lỗi; thứ tự kiểm giữ nguyên", async () => {
    const signal = new AbortController().signal;
    const exec: ExecLike = { agent: { id: "agent-1" }, signal };
    const cases: {
      readonly label: string;
      readonly args: unknown;
      readonly get?: (name: string, lookup: unknown) => Promise<SkillDefinition | undefined>;
      readonly list?: (lookup: unknown) => Promise<readonly SkillSummary[]>;
      readonly message: string;
    }[] = [
      {
        label: "tên sai ngữ pháp",
        args: { name: "Bad Name" },
        message: 'invalid skill name "Bad Name"',
      },
      {
        label: "không có trong list",
        args: { name: "gamma" },
        list: async () => [],
        message: 'skill "gamma" is unknown or no longer available',
      },
      {
        label: "summary không cho model",
        args: { name: "beta" },
        message: 'skill "beta" is not available for model invocation',
      },
      {
        label: "get trả undefined",
        args: { name: "alpha" },
        get: async () => undefined,
        message: 'skill "alpha" is unknown or no longer available',
      },
      {
        label: "định nghĩa không cho model",
        args: { name: "alpha" },
        get: async () => BETA_DEFINITION,
        message: 'skill "alpha" is not available for model invocation',
      },
    ];
    for (const item of cases) {
      const oursHarness = install(mine, { get: item.get, list: item.list });
      const stockHarness = install(stock, { get: item.get, list: item.list });
      const ours = await runExecute(toolOf(oursHarness), item.args, exec);
      const theirs = await runExecute(toolOf(stockHarness), item.args, exec);
      expect(ours.errorMessage).toBe(theirs.errorMessage);
      expect(ours.errorName).toBe(theirs.errorName);
      expect(ours.errorMessage).toBe(item.message);
    }
    const invalidNameHarness = install(mine);
    await runExecute(toolOf(invalidNameHarness), { name: "Bad Name" }, exec);
    expect(invalidNameHarness.listLookups.length).toBe(0);
    expect(invalidNameHarness.getCalls.length).toBe(0);
    const nonModelHarness = install(mine);
    await runExecute(toolOf(nonModelHarness), { name: "beta" }, exec);
    expect(nonModelHarness.getCalls.length).toBe(0);
  });

  test("validate tham số của defineTool TRÙNG bản gốc (thiếu tên · sai kiểu)", async () => {
    const signal = new AbortController().signal;
    const exec: ExecLike = { agent: { id: "agent-1" }, signal };
    for (const args of [{}, { name: 5 }, { name: "alpha", extra: true }]) {
      const ours = await runExecute(toolOf(install(mine)), args, exec);
      const theirs = await runExecute(toolOf(install(stock)), args, exec);
      expect(ours.errorName).toBe(theirs.errorName);
      expect(ours.errorMessage).toBe(theirs.errorMessage);
    }
    const missing = await runExecute(toolOf(install(mine)), {}, exec);
    expect(missing.errorName).toBe("ToolArgsError");
    expect(missing.errorMessage).toBe('invalid arguments: missing required property "name"');
    const wrongType = await runExecute(toolOf(install(mine)), { name: 5 }, exec);
    expect(wrongType.errorName).toBe("ToolArgsError");
    expect(wrongType.errorMessage).toBe('invalid arguments: "name" must be a string');
  });
});

describe("E. Hook chèn kỹ năng theo gesture /name — hai hook + mọi nhánh", () => {
  test("đăng ký ĐÚNG HAI hook agent/pre-step, đúng thứ tự", () => {
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    expect(oursHarness.events).toEqual(stockHarness.events);
    expect(oursHarness.events).toEqual(["agent/pre-step", "agent/pre-step"]);
    expect(oursHarness.hooks.length).toBe(2);
    expect(stockHarness.hooks.length).toBe(2);
  });

  test("gesture: khử trùng, bỏ nguồn không phải user, bỏ khối không phải chữ, bỏ token không hợp lệ", async () => {
    const signal = new AbortController().signal;
    const messages: MessageLike[] = [
      userMessage("please /alpha and /beta and /alpha, /gamma /usr/bin 5/8 /Bad\n/delta"),
      { id: "a-1", role: "assistant", content: [{ type: "text", text: "/alpha" }], source: { kind: "model" } },
      { id: "u-2", role: "user", content: [{ type: "image" }], source: { kind: "user" } },
    ];
    const nextDecision: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    const ours = await hookAt(oursHarness, 0)(payload(messages, agentWith(), signal), async () => nextDecision);
    const theirs = await hookAt(stockHarness, 0)(payload(messages, agentWith(), signal), async () => nextDecision);
    expect(normalized(ours)).toEqual(normalized(theirs));
    const injections = (ours.messages ?? []).slice(1);
    expect(injections.length).toBe(2);
    expect(injections.map((message) => message.source["name"])).toEqual(["alpha", "beta"]);
    expect(injections[0]?.source).toEqual({ kind: "skill-invocation", name: "alpha", form: "instructions" });
    expect(injections[0]?.content[0]?.text ?? "").toContain('<skill_content name="alpha">');
    expect(injections[0]?.content[0]?.text ?? "").toContain("<skill_instructions>\n# Alpha body\n</skill_instructions>");
    expect(oursHarness.ensureCalls.length).toBe(1);
    expect(oursHarness.getCalls.map((call) => call.name)).toEqual(["alpha", "beta", "gamma", "delta"]);
    expect(oursHarness.listLookups.length).toBe(0);
  });

  test("reject đi xuyên qua; không gesture / không kỹ năng gọi được ⇒ quyết định NGUYÊN VẸN", async () => {
    const signal = new AbortController().signal;
    const rejected: DecisionLike = { kind: "reject" };
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    const oursReject = await hookAt(oursHarness, 0)(payload([userMessage("/alpha")], agentWith(), signal), async () => rejected);
    const theirsReject = await hookAt(stockHarness, 0)(payload([userMessage("/alpha")], agentWith(), signal), async () => rejected);
    expect(oursReject).toBe(rejected);
    expect(theirsReject).toBe(rejected);
    const plain: DecisionLike = { kind: "enter", messages: [userMessage("hello")] };
    const oursPlain = await hookAt(oursHarness, 0)(payload([userMessage("hello")], agentWith(), signal), async () => plain);
    expect(oursPlain).toBe(plain);
    const missing: DecisionLike = { kind: "enter", messages: [userMessage("/missing /gamma")] };
    const getMissing = async (name: string): Promise<SkillDefinition | undefined> =>
      name === "gamma" ? DEFAULT_DEFINITIONS["gamma"] : undefined;
    const oursMissingHarness = install(mine, { get: getMissing });
    const stockMissingHarness = install(stock, { get: getMissing });
    const oursMissing = await hookAt(oursMissingHarness, 0)(payload([userMessage("/missing /gamma")], agentWith(), signal), async () => missing);
    const theirsMissing = await hookAt(stockMissingHarness, 0)(payload([userMessage("/missing /gamma")], agentWith(), signal), async () => missing);
    expect(oursMissing).toBe(missing);
    expect(theirsMissing).toBe(missing);
    expect(normalized(oursMissing)).toEqual(normalized(theirsMissing));
  });

  test("tín hiệu đã huỷ ⇒ NÉM trước ensure, TRÙNG bản gốc", async () => {
    const controller = new AbortController();
    controller.abort();
    const signal = controller.signal;
    const decision: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const capture = async (hook: Hook): Promise<{ readonly name: string; readonly message: string }> => {
      try {
        await hook(payload([userMessage("/alpha")], agentWith(), signal), async () => decision);
        return { name: "không ném", message: "không ném" };
      } catch (error) {
        return { name: (error as Error).constructor.name, message: (error as Error).message };
      }
    };
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    const oursError = await capture(hookAt(oursHarness, 0));
    const stockError = await capture(hookAt(stockHarness, 0));
    expect(oursError).toEqual(stockError);
    expect(oursError.name).toBe("DOMException");
    expect(oursError.message).toBe("The operation was aborted.");
    expect(oursHarness.ensureCalls.length).toBe(0);
    expect(stockHarness.ensureCalls.length).toBe(0);
  });
});

describe("F. Hook catalog — công bố lần đầu, thay thế, gỡ, cắt mô tả, lịch sử hỏng", () => {
  test("công bố LẦN ĐẦU: chỉ kỹ năng model-invocable; chuỗi + source TRÙNG bản gốc", async () => {
    const signal = new AbortController().signal;
    const agent = agentWith();
    const decision: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const oursHarness = install(mine);
    const stockHarness = install(stock);
    const ours = await hookAt(oursHarness, 1)(payload([userMessage("hi")], agent, signal), async () => decision);
    const theirs = await hookAt(stockHarness, 1)(payload([userMessage("hi")], agent, signal), async () => decision);
    expect(normalized(ours)).toEqual(normalized(theirs));
    expect(ours.messages?.length).toBe(2);
    const catalog = ours.messages?.[1];
    expect(catalog?.source).toEqual({
      kind: "skill-catalog",
      form: "catalog",
      entries: [{ name: "alpha", description: "Alpha skill" }, { name: "gamma", description: "Gamma skill" }],
    });
    const text = catalog?.content[0]?.text ?? "";
    expect(text).toContain("A skill is a reusable set of task-specific instructions.");
    const alphaLine = "- " + TICK + "alpha" + TICK + ": Alpha skill";
    const gammaLine = "- " + TICK + "gamma" + TICK + ": Gamma skill";
    expect(text).toContain("<available_skills>\n" + alphaLine + "\n" + gammaLine + "\n</available_skills>");
    expect(oursHarness.snapshotCalls.length).toBe(1);
    expect(oursHarness.snapshotCalls[0]).toEqual({ cwd: "/cwd", signal, scope: agent });
    expect(stockHarness.snapshotCalls[0]).toEqual(oursHarness.snapshotCalls[0]);
  });

  test("snapshot chưa hoàn tất / tool không phải của plugin / reject ⇒ quyết định NGUYÊN VẸN", async () => {
    const signal = new AbortController().signal;
    const decision: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const incompleteOurs = install(mine, { snapshot: async () => ({ skills: DEFAULT_SUMMARIES, complete: false }) });
    const incompleteStock = install(stock, { snapshot: async () => ({ skills: DEFAULT_SUMMARIES, complete: false }) });
    const oursIncomplete = await hookAt(incompleteOurs, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    const theirsIncomplete = await hookAt(incompleteStock, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    expect(oursIncomplete).toBe(decision);
    expect(theirsIncomplete).toBe(decision);
    const mismatchOurs = install(mine, { toolLookup: () => "tool khác" });
    const mismatchStock = install(stock, { toolLookup: () => "tool khác" });
    const oursMismatch = await hookAt(mismatchOurs, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    const theirsMismatch = await hookAt(mismatchStock, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    expect(oursMismatch).toBe(decision);
    expect(theirsMismatch).toBe(decision);
    expect(mismatchOurs.snapshotCalls.length).toBe(0);
    const rejected: DecisionLike = { kind: "reject" };
    const oursReject = await hookAt(install(mine), 1)(payload([userMessage("hi")], agentWith(), signal), async () => rejected);
    expect(oursReject).toBe(rejected);
  });

  test("catalog đã có CÙNG digest ⇒ trả đúng đối tượng quyết định; digest KHÁC ⇒ thay message", async () => {
    const signal = new AbortController().signal;
    const sameEntries: readonly CatalogEntry[] = [
      { name: "alpha", description: "Alpha skill" },
      { name: "gamma", description: "Gamma skill" },
    ];
    const sameDecision: DecisionLike = { kind: "enter", messages: [userMessage("hi"), catalogMessage("cat-same", sameEntries)] };
    const oursSame = await hookAt(install(mine), 1)(payload([userMessage("hi")], agentWith(), signal), async () => sameDecision);
    const theirsSame = await hookAt(install(stock), 1)(payload([userMessage("hi")], agentWith(), signal), async () => sameDecision);
    expect(oursSame).toBe(sameDecision);
    expect(theirsSame).toBe(sameDecision);
    const oldEntries: readonly CatalogEntry[] = [{ name: "old", description: "Old skill" }];
    const oldDecision: DecisionLike = { kind: "enter", messages: [userMessage("hi"), catalogMessage("cat-old", oldEntries)] };
    const oursChanged = await hookAt(install(mine), 1)(payload([userMessage("hi")], agentWith(), signal), async () => oldDecision);
    const theirsChanged = await hookAt(install(stock), 1)(payload([userMessage("hi")], agentWith(), signal), async () => oldDecision);
    expect(normalized(oursChanged)).toEqual(normalized(theirsChanged));
    expect(oursChanged).not.toBe(oldDecision);
    expect(oursChanged.messages?.length).toBe(2);
    expect(oursChanged.messages?.[1]?.id).not.toBe("cat-old");
    expect(oursChanged.messages?.[1]?.source["update"]).toBeUndefined();
  });

  test("catalog đang NHÌN THẤY cùng digest ⇒ GỠ message cũ; đã công bố ⇒ dùng dạng THAY THẾ", async () => {
    const signal = new AbortController().signal;
    const entries: readonly CatalogEntry[] = [
      { name: "alpha", description: "Alpha skill" },
      { name: "gamma", description: "Gamma skill" },
    ];
    const events = [catalogEvent(0, entries)];
    const removeDecision: DecisionLike = { kind: "enter", messages: [userMessage("hi"), catalogMessage("cat-remove", entries)] };
    const oursRemoved = await hookAt(install(mine), 1)(payload([userMessage("hi")], agentWith(events, [0]), signal), async () => removeDecision);
    const theirsRemoved = await hookAt(install(stock), 1)(payload([userMessage("hi")], agentWith(events, [0]), signal), async () => removeDecision);
    expect(normalized(oursRemoved)).toEqual(normalized(theirsRemoved));
    expect(oursRemoved.messages?.length).toBe(1);
    expect(oursRemoved.messages?.[0]?.id).toBe("u-1");
    const updateDecision: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const oursUpdate = await hookAt(install(mine), 1)(payload([userMessage("hi")], agentWith(events, []), signal), async () => updateDecision);
    const theirsUpdate = await hookAt(install(stock), 1)(payload([userMessage("hi")], agentWith(events, []), signal), async () => updateDecision);
    expect(normalized(oursUpdate)).toEqual(normalized(theirsUpdate));
    const updated = oursUpdate.messages?.[1];
    expect(updated?.source["update"]).toBe(true);
    expect(updated?.source["entries"]).toEqual(entries);
    expect(updated?.content[0]?.text ?? "").toContain("The available skill catalog changed.");
    const oldEntries: readonly CatalogEntry[] = [{ name: "old", description: "Old skill" }];
    const replaceDecision: DecisionLike = { kind: "enter", messages: [userMessage("hi"), catalogMessage("cat-replace", oldEntries)] };
    const replaceEvents = [catalogEvent(0, oldEntries)];
    const oursReplaced = await hookAt(install(mine), 1)(payload([userMessage("hi")], agentWith(replaceEvents, [0]), signal), async () => replaceDecision);
    const theirsReplaced = await hookAt(install(stock), 1)(payload([userMessage("hi")], agentWith(replaceEvents, [0]), signal), async () => replaceDecision);
    expect(normalized(oursReplaced)).toEqual(normalized(theirsReplaced));
    expect(oursReplaced.messages?.[1]?.id).not.toBe("cat-replace");
    expect(oursReplaced.messages?.[1]?.source["update"]).toBe(true);
  });

  test("không kỹ năng + chưa công bố ⇒ không catalog; catalog rỗng cũ bị gỡ", async () => {
    const signal = new AbortController().signal;
    const emptyOurs = install(mine, { snapshot: async () => ({ skills: [], complete: true }) });
    const emptyStock = install(stock, { snapshot: async () => ({ skills: [], complete: true }) });
    const plain: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const oursPlain = await hookAt(emptyOurs, 1)(payload([userMessage("hi")], agentWith(), signal), async () => plain);
    const theirsPlain = await hookAt(emptyStock, 1)(payload([userMessage("hi")], agentWith(), signal), async () => plain);
    expect(oursPlain).toBe(plain);
    expect(theirsPlain).toBe(plain);
    const nonEmpty: DecisionLike = { kind: "enter", messages: [userMessage("hi"), catalogMessage("cat-nonempty", [{ name: "old", description: "Old skill" }])] };
    const oursRemoved = await hookAt(emptyOurs, 1)(payload([userMessage("hi")], agentWith(), signal), async () => nonEmpty);
    const theirsRemoved = await hookAt(emptyStock, 1)(payload([userMessage("hi")], agentWith(), signal), async () => nonEmpty);
    expect(normalized(oursRemoved)).toEqual(normalized(theirsRemoved));
    expect(oursRemoved.messages?.length).toBe(1);
    const emptyExisting: DecisionLike = { kind: "enter", messages: [userMessage("hi"), catalogMessage("cat-empty", [])] };
    const oursKept = await hookAt(emptyOurs, 1)(payload([userMessage("hi")], agentWith(), signal), async () => emptyExisting);
    const theirsKept = await hookAt(emptyStock, 1)(payload([userMessage("hi")], agentWith(), signal), async () => emptyExisting);
    expect(oursKept).toBe(emptyExisting);
    expect(theirsKept).toBe(emptyExisting);
  });

  test("mô tả được gộp khoảng trắng + cắt theo catalogDescriptionMaxLength (default 500)", async () => {
    const signal = new AbortController().signal;
    const decision: DecisionLike = { kind: "enter", messages: [userMessage("hi")] };
    const whitespaceSkills: readonly SkillSummary[] = [{
      name: "alpha",
      description: "  A   very   long   description   with spaces  ",
      invocation: { modelInvocable: true, userInvocable: true },
    }];
    const oursShort = install(mine, { config: { catalogDescriptionMaxLength: 10 }, snapshot: async () => ({ skills: whitespaceSkills, complete: true }) });
    const stockShort = install(stock, { config: { catalogDescriptionMaxLength: 10 }, snapshot: async () => ({ skills: whitespaceSkills, complete: true }) });
    const oursShortDecision = await hookAt(oursShort, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    const stockShortDecision = await hookAt(stockShort, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    expect(normalized(oursShortDecision)).toEqual(normalized(stockShortDecision));
    expect(oursShortDecision.messages?.[1]?.source["entries"]).toEqual([{ name: "alpha", description: "A very ..." }]);
    const longSkills: readonly SkillSummary[] = [{
      name: "alpha",
      description: LONG_DESCRIPTION,
      invocation: { modelInvocable: true, userInvocable: true },
    }];
    const oursLong = install(mine, { snapshot: async () => ({ skills: longSkills, complete: true }) });
    const stockLong = install(stock, { snapshot: async () => ({ skills: longSkills, complete: true }) });
    const oursLongDecision = await hookAt(oursLong, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    const stockLongDecision = await hookAt(stockLong, 1)(payload([userMessage("hi")], agentWith(), signal), async () => decision);
    expect(normalized(oursLongDecision)).toEqual(normalized(stockLongDecision));
    const entries = oursLongDecision.messages?.[1]?.source["entries"] as readonly CatalogEntry[];
    expect(entries[0]?.description.length).toBe(500);
    expect(entries[0]?.description.endsWith("...")).toBe(true);
  });
});
