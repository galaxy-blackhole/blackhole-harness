/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói LỒNG alias-only @galaxy-blackhole/gbh-agent-preset — so lớp AgentPreset (surface,
 *      Config, đăng ký qua seam agentPresets) với bản gốc, và chứng minh mount KHÔNG sinh khối patch nào
 *      cho 4 row preset-* (cơ chế alias-only: chỉ symlink module, rows giữ nguyên config).
 */
import { generatePresetRedirect, resolvesInProfile } from "../../packages/host/agent-preset/src/preset-redirect.ts";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Service } from "../../apps/host/node_modules/@deepseek-ai/cordis";
import { EntryGroup } from "../../apps/host/node_modules/@deepseek-ai/cordis-plugin-loader";
import Ours, { redirectPresetPlugins, writeBackRowConfig } from "../../packages/host/agent-preset/src/index.ts";
/** Lớp mặc định (AgentPreset) để test task-173 — `Ours` đã là default import. */
const AgentPreset = Ours;
/** Kieu instance cua lop AgentPreset, suy ra tu default import (dung cho `new` trong test). */
type AgentPresetInstance = InstanceType<typeof AgentPreset>;
/** Hook init cua Cordis (`Service.init`) tra theo symbol — goi qua kieu tuong minh. */
type InitHook = () => AsyncGenerator<() => Promise<void>>;
import { writeAppPatch } from "../../apps/cli/src/profile.ts";

const ROOT = join(import.meta.dir, "..", "..");
const STOCK_BUNDLE = join(ROOT, "apps/host/node_modules/@deepseek-ai/dsh-agent-preset/lib/index.js");
const OUR_PKG_DIR = join(ROOT, "packages/host/agent-preset");

/** Nạp bản gốc (chỉ đọc) làm vế A. */
async function loadStock(): Promise<{ default: unknown }> {
  return (await import(STOCK_BUNDLE)) as { default: unknown };
}

interface FakeRegistry { calls: unknown[]; disposers: number; register(config: unknown): () => Promise<void> }

/** Sổ preset giả: ghi lại config nhận được và đếm số lần disposer được gọi. */
function fakeRegistry(): FakeRegistry {
  const calls: unknown[] = [];
  const state = { calls, disposers: 0 };
  return {
    calls,
    get disposers() { return state.disposers; },
    register(config: unknown) {
      calls.push(config);
      return async () => { state.disposers += 1; };
    },
  } as FakeRegistry;
}

/** Dựng context tối thiểu đủ cho [Service.init] (chỉ cần seam agentPresets). */
function ctxWith(registry: FakeRegistry): { agentPresets: FakeRegistry } {
  return { agentPresets: registry };
}

/** Chạy [Service.init] của một instance và trả disposer đã nhả. */
async function initOf(instance: object): Promise<() => Promise<void>> {
  const key = Service.init as unknown as symbol;
  const init = (instance as unknown as Record<symbol, (this: object) => AsyncGenerator<() => Promise<void>> | undefined>)[key];
  if (init === undefined) throw new Error("thiếu [Service.init]");
  const generator = init.call(instance);
  if (generator === undefined) throw new Error("thiếu generator");
  const first = await generator.next();
  return first.value as () => Promise<void>;
}

/** Class constructor của bản gốc lấy từ default export. */
async function stockClass(): Promise<new (ctx: unknown, config: unknown) => object> {
  const mod = await loadStock();
  return mod.default as new (ctx: unknown, config: unknown) => object;
}

const FULL = { id: "standard", name: "Standard", description: "mô tả", order: 1, plugins: [{ id: "persona", name: "@deepseek-ai/dsh-persona" }] };

describe("A/B · surface lớp AgentPreset", () => {
  test("default export là class cùng tên AgentPreset", async () => {
    const Stock = await stockClass();
    expect(Ours.name).toBe(Stock.name);
    expect(Ours.name).toBe("AgentPreset");
    expect(typeof Ours).toBe("function");
  });

  test("static inject A≡B = [agentPresets]", async () => {
    const Stock = await stockClass();
    expect((Ours as unknown as { inject: string[] }).inject).toEqual((Stock as unknown as { inject: string[] }).inject);
    expect((Ours as unknown as { inject: string[] }).inject).toEqual(["agentPresets"]);
  });

  test("static [EntryGroup.key] A≡B = true (giữ biểu thức con)", async () => {
    const Stock = await stockClass();
    const key = EntryGroup.key as unknown as symbol;
    expect((Ours as unknown as Record<symbol, boolean>)[key]).toBe((Stock as unknown as Record<symbol, boolean>)[key]);
    expect((Ours as unknown as Record<symbol, boolean>)[key]).toBe(true);
  });

  test("constructor arity A≡B = 2 (ctx, config)", async () => {
    const Stock = await stockClass();
    expect(Ours.length).toBe(Stock.length);
    expect(Ours.length).toBe(2);
  });

  test("có [Service.init] là generator function (A≡B)", async () => {
    const Stock = await stockClass();
    const ours = (Ours.prototype as unknown as Record<symbol, unknown>)[Service.init as unknown as symbol];
    const stock = (Stock.prototype as unknown as Record<symbol, unknown>)[Service.init as unknown as symbol];
    expect(typeof ours).toBe(typeof stock);
    expect((ours as object).constructor.name).toBe("AsyncGeneratorFunction");
  });
});

describe("A/B · Config schema (kiểm cấu trúc, không cần runtime schemastery)", () => {
  test("tập khoá của dict A≡B = id, name, description, order, plugins", async () => {
    const Stock = await stockClass();
    const ours = (Ours as unknown as { Config: { dict?: Record<string, unknown> } }).Config;
    const stock = (Stock as unknown as { Config: { dict?: Record<string, unknown> } }).Config;
    const oursKeys = Object.keys(ours.dict ?? {}).sort();
    const stockKeys = Object.keys(stock.dict ?? {}).sort();
    expect(oursKeys).toEqual(stockKeys);
    expect(oursKeys).toEqual(["description", "id", "name", "order", "plugins"]);
  });

  test("required( id · plugins ) A≡B", async () => {
    const Stock = await stockClass();
    const ours = (Ours as unknown as { Config: { dict?: Record<string, { meta?: { required?: boolean } }> } }).Config;
    const stock = (Stock as unknown as { Config: { dict?: Record<string, { meta?: { required?: boolean } }> } }).Config;
    const requiredOf = (schema: typeof ours): string[] =>
      Object.entries(schema.dict ?? {}).filter(([, value]) => value.meta?.required === true).map(([key]) => key).sort();
    expect(requiredOf(ours)).toEqual(requiredOf(stock));
    expect(requiredOf(ours)).toEqual(["id", "plugins"]);
  });

  test("String(Config) A≡B (cùng mô tả 5 trường)", async () => {
    const Stock = await stockClass();
    const ours = String((Ours as unknown as { Config: unknown }).Config);
    const stock = String((Stock as unknown as { Config: unknown }).Config);
    expect(ours).toBe(stock);
  });
});
describe("A/B · đăng ký qua seam agentPresets", () => {
  test("init đăng ký ĐÚNG config của row lên sổ (A≡B)", async () => {
    const Stock = await stockClass();
    const oursRegistry = fakeRegistry();
    const stockRegistry = fakeRegistry();
    const ours = new Ours(ctxWith(oursRegistry) as never, FULL as never);
    const stock = new Stock(ctxWith(stockRegistry), FULL);
    const oursDispose = await initOf(ours);
    const stockDispose = await initOf(stock);
    expect(oursRegistry.calls).toEqual([FULL]);
    expect(stockRegistry.calls).toEqual([FULL]);
    expect(typeof oursDispose).toBe("function");
    expect(typeof stockDispose).toBe("function");
  });

  test("disposer của sổ được gọi khi dispose (A≡B)", async () => {
    const Stock = await stockClass();
    const oursRegistry = fakeRegistry();
    const stockRegistry = fakeRegistry();
    const oursDispose = await initOf(new Ours(ctxWith(oursRegistry) as never, FULL as never));
    const stockDispose = await initOf(new Stock(ctxWith(stockRegistry), FULL));
    await oursDispose();
    await stockDispose();
    expect(oursRegistry.disposers).toBe(1);
    expect(stockRegistry.disposers).toBe(1);
  });
});

describe("alias-only · mount KHÔNG sinh khối patch cho 4 row preset", () => {
  test("writeAppPatch với rewrite alias-only không chứa khối preset-* và không có insert của gói ta", () => {
    const patch = writeAppPatch({
      rewrites: [{ specifier: "@galaxy-blackhole/gbh-agent-preset", dir: OUR_PKG_DIR, built: false, peers: [], ok: true }],
    });
    for (const id of ["preset-standard", "preset-ptc", "preset-minimal", "preset-cordis"]) {
      expect(patch.includes("- id: " + id)).toBe(false);
    }
    expect(patch.includes("@galaxy-blackhole/gbh-agent-preset")).toBe(false);
  });

  test("manifest khai alias-only đúng: stockId + hostAliases + presets rỗng, KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(OUR_PKG_DIR, "package.json"), "utf8")) as { gbh?: Record<string, unknown> };
    const nested = (manifest.gbh ?? {}).nested as { stockId?: string; hostAliases?: string[]; presets?: string[] };
    expect(nested.stockId).toBe("@deepseek-ai/dsh-agent-preset");
    expect(nested.hostAliases).toEqual(["@deepseek-ai/dsh-agent-preset"]);
    expect(nested.presets).toEqual([]);
    expect((manifest.gbh ?? {}).row).toBeUndefined();
  });
});

describe("Config schema cùng LOẠI với bản gốc (cùng prototype constructor)", () => {
  test("prototype của Config A≡B", async () => {
    const Stock = await stockClass();
    const ours = (Ours as unknown as { Config: object }).Config;
    const stock = (Stock as unknown as { Config: object }).Config;
    expect(Object.getPrototypeOf(ours).constructor.name).toBe(Object.getPrototypeOf(stock).constructor.name);
    expect(typeof ours).toBe(typeof stock);
  });
});

describe("task-173 · cây config mang id GBH (ghi lại config row preset)", () => {
  /** Fake context tối thiểu: fiber.entry.options.config + service agentPresets. */
  const makeCtx = (plugins: readonly unknown[]): { ctx: Record<string, unknown>; captured: { config?: unknown }; entry: { options: { config: Record<string, unknown> } } } => {
    const entry = { options: { config: { id: "preset-standard", plugins } } };
    const captured: { config?: unknown } = {};
    const ctx = {
      fiber: { entry },
      agentPresets: {
        register: async (config: unknown) => { captured.config = config; return async () => {}; },
        redirectNestedNames: (value: readonly unknown[]) => redirectPresetPlugins({ agentPresets: { redirectNestedNames: (v: readonly unknown[]) => rewriteForTest(v) } }, value),
      },
    };
    return { ctx, captured, entry };
  };
  /** Rewrite giả lập ĐÚNG hành vi registry: đổi mọi tên khớp bản đồ, giữ id/config, kể cả group lồng. */
  const rewriteForTest = (value: unknown): unknown => {
    const map = new Map([["@deepseek-ai/dsh-tool-subagent-control", "@galaxy-blackhole/gbh-tool-subagent-control"]]);
    const walk = (node: unknown): unknown => {
      const resolve = (name: string): string | undefined => {
        const exact = map.get(name);
        if (exact !== undefined) return exact;
        for (const [key, target] of map) if (name.startsWith(key + "/")) return target + name.slice(key.length);
        return undefined;
      };
      if (Array.isArray(node)) return node.map(walk);
      if (typeof node !== "object" || node === null) return node;
      const record = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(record)) out[key] = walk(item);
      if (typeof record["name"] === "string") { const target = resolve(record["name"]); if (target !== undefined) out["name"] = target; }
      return out;
    };
    return walk(value);
  };

  test("init: config đăng ký VÀ entry.options.config đều mang id GBH, số entry không đổi", async () => {
    const plugins = [
      { id: "delegation", name: "cordis:group", group: true, isolate: { workflowEngine: true }, config: [
        { id: "tool-subagent-control", name: "@deepseek-ai/dsh-tool-subagent-control" },
        { id: "tool-subagent-list-agents", name: "@deepseek-ai/dsh-tool-subagent-control/list-agents" },
        { id: "tool-subagent", name: "@deepseek-ai/dsh-tool-subagent" },
      ] },
    ];
    const { ctx, captured, entry } = makeCtx(plugins);
    const plugin = new (AgentPreset as unknown as new (c: unknown, cfg: unknown) => AgentPresetInstance)(ctx, { id: "preset-standard", plugins });
    const initHook = (plugin as unknown as Record<symbol, InitHook | undefined>)[Service.init as unknown as symbol];
    if (initHook === undefined) throw new Error("AgentPreset: khong tim thay hook Service.init");
    const iterator = initHook.call(plugin);
    for await (const dispose of iterator) { await dispose(); }
    const registered = (captured.config as { plugins: unknown[] }).plugins;
    expect(JSON.stringify(registered).includes("@deepseek-ai/dsh-tool-subagent-control")).toBe(false);
    expect(JSON.stringify(registered)).toContain("@galaxy-blackhole/gbh-tool-subagent-control/list-agents");
    const treePlugins = (entry.options.config as { plugins: unknown[] }).plugins;
    expect(JSON.stringify(treePlugins).includes("@deepseek-ai/dsh-tool-subagent-control")).toBe(false);
    expect(treePlugins.length).toBe(plugins.length);
    expect((treePlugins[0] as { isolate: unknown }).isolate).toEqual({ workflowEngine: true });
  });

  test("dịch vụ kernel stock (không có redirectNestedNames) ⇒ giữ nguyên config, không ném", async () => {
    const plugins = [{ id: "tool-subagent-control", name: "@deepseek-ai/dsh-tool-subagent-control" }];
    const entry = { options: { config: { id: "preset-standard", plugins } } };
    let registered: unknown;
    const ctx = { fiber: { entry }, agentPresets: { register: async (config: unknown) => { registered = config; return async () => {}; } } };
    const plugin = new (AgentPreset as unknown as new (c: unknown, cfg: unknown) => AgentPresetInstance)(ctx, { id: "preset-standard", plugins });
    const initHook = (plugin as unknown as Record<symbol, InitHook | undefined>)[Service.init as unknown as symbol];
    if (initHook === undefined) throw new Error("AgentPreset: khong tim thay hook Service.init");
    const iterator = initHook.call(plugin);
    for await (const dispose of iterator) { await dispose(); }
    expect(registered).toEqual({ id: "preset-standard", plugins });
    expect(JSON.stringify(entry.options.config).includes("@deepseek-ai/dsh-tool-subagent-control")).toBe(true);
  });

  test("writeBackRowConfig: false khi thiếu entry; true khi có (chỉ đổi plugins, giữ khoá khác)", () => {
    expect(writeBackRowConfig({}, [])).toBe(false);
    // 20/10/2026: khai KIỂU tường minh cho entry — nếu để suy luận, `plugins: []` bị suy ra `never[]`
    // và tsc báo TS2769 ở lời gọi `writeBackRowConfig` (overload không khớp), dù runtime đúng.
    const entry: { options: { config: { id: string; description: string; plugins: { id: string; name: string }[] } } } = {
      options: { config: { id: "preset-ptc", description: "giữ nguyên", plugins: [] } },
    };
    expect(writeBackRowConfig({ fiber: { entry } }, [{ id: "x", name: "@galaxy-blackhole/gbh-x" }])).toBe(true);
    expect(entry.options.config).toEqual({ id: "preset-ptc", description: "giữ nguyên", plugins: [{ id: "x", name: "@galaxy-blackhole/gbh-x" }] });
  });

  test("task-187 · cây preset CORDIS dựng được: có entry tool-schedule và không ném", () => {
    // Sinh lại patch preset từ metadata repo (nguồn duy nhất) — phép sinh KHÔNG được ném.
    const generated = generatePresetRedirect();
    expect(generated.presetIds).toContain("preset-cordis");
    const text = generated.text;
    const cordisStart = text.indexOf("- id: preset-cordis");
    expect(cordisStart).toBeGreaterThan(-1);
    const block = text.slice(cordisStart);
    // Entry tool-schedule phải có trong cây cordis và trỏ gói CỦA TA.
    expect(block).toContain("- id: tool-schedule");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-tool-schedule'");
    // Mọi entry trỏ module KHÔNG có trong profile phải bị TẮT (sửa dữ liệu, không để Loader ném).
    const unresolved = [...block.matchAll(/- id: ([a-z0-9-]+)\n\s+name: '([^']+)'/g)].filter(
      (match) => !resolvesInProfile(match[2] ?? "") ,
    );
    for (const match of unresolved) {
      const entryText = block.slice(match.index ?? 0, (match.index ?? 0) + 260);
      expect(entryText).toContain("disabled: true");
    }
  });
});
