/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test row ui-skill: do inject nguyen van, hai slot occupant, RPC catalog, luat tham chieu + chan mount
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { buildPackage } from "../../packages/client/ui-skill/build.ts";
import { PACKAGE_NAME } from "../../packages/client/ui-skill/src/ids.ts";
import { SKILL_ROW_CSS, SKILL_ROW_CLASSES } from "../../packages/client/ui-skill/src/skill-row-css.ts";

/** Fixture thật của hợp đồng C1. */
const FIXTURE = join(import.meta.dir, "..", "contract", "fixtures", "c1-boot-graph.json");
/** Package của ta cho row này. */
const PACKAGE_JSON = join(import.meta.dir, "..", "..", "packages", "client", "ui-skill", "package.json");

/** CSS của ta ở dạng đã bỏ khối header, để so với bản gốc. */
function oursCss(): string {
  return SKILL_ROW_CSS.split("*/").slice(1).join("*/").trim();
}

/** Nạp bundle đã build trong window giả + ctx giả, trả về mọi thứ đã ghi nhận. */
async function loadBundle() {
  const out = await mkdtemp(join(tmpdir(), "gbh-skill-"));
  const built = await buildPackage(out);
  const code = readFileSync(built.client, "utf8");
  const calls: { id: string; factory: (require: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: string[]; NS: string } }[] = [];
  new Function("window", code)({ __ModuleLoader__: { load: (r: (typeof calls)[number]) => calls.push(r) } });
  const rec = {
    dictionaries: [] as Record<string, unknown>[],
    occupants: [] as Record<string, unknown>[],
    injectedSlots: [] as string[],
    sources: [] as Record<string, unknown>[],
    rules: [] as Record<string, unknown>[],
    listCalls: [] as { sessionId: string }[],
    events: [] as string[],
    opened: [] as string[],
  };
  const skills = [{ name: "commit", description: "Tao commit", modelInvocable: true, path: "skills/commit.md" }];
  const ctx = {
    effect: (cb: () => unknown) => { cb(); return undefined; },
    locale: {
      bind: (ns: string) => (key: string) => ns + ":" + key,
      register: (ns: string, dict: Record<string, unknown>) => rec.dictionaries.push({ ns, ...dict }),
    },
    slots: {
      inject: (slot: string, cb: () => unknown) => { rec.injectedSlots.push(slot); return cb(); },
      register: (occupant: Record<string, unknown>) => rec.occupants.push(occupant),
    },
    uiConversation: { userText: { register: (rule: Record<string, unknown>) => rec.rules.push(rule) } },
    sessions: {
      binding: () => ({}),
      scope: () => ({}),
      subagentAddress: () => undefined,
      list: { getSnapshot: () => ({ byId: { s1: { cwd: "/w" } } }) },
      using: async (_id: string, _o: unknown, run: (ref: unknown) => Promise<unknown>) => run({ binding: { session: { getSnapshot: () => ({ openState: "open" }) } } }),
    },
    remote: {
      skills: {
        list: async (req: { sessionId: string }) => { rec.listCalls.push(req); return { ok: true as const, value: { skills } }; },
      },
      $on: (event: string) => { rec.events.push(event); return undefined; },
    },
    sidebarRight: { openResource: (addr: string) => rec.opened.push(addr) },
    inputTriggers: { registerSource: (src: Record<string, unknown>) => { rec.sources.push(src); return () => undefined; } },
    get: (name: string) => (name === "inputTriggers" ? { registerSource: (src: Record<string, unknown>) => { rec.sources.push(src); return () => undefined; } } : undefined),
    on: (event: string) => { rec.events.push(event); return undefined; },
  };
  const registration = calls[0];
  if (registration === undefined) throw new Error("bundle khong dang ky factory nao");
  const moduleExports = registration.factory(() => ({ rankByName: (items: unknown[]) => items }));
  return { moduleExports, ctx, rec, code, calls, skills };
}

describe("ui-skill — nửa client", () => {
  test("bundle: MỘT id đăng ký, giữ seed primitives ở dạng require", async () => {
    const { code, calls } = await loadBundle();
    expect(code.match(/__ModuleLoader__\.load\(/g)?.length).toBe(1);
    expect(calls[0]?.id).toBe(PACKAGE_NAME);
    expect(code).toContain('require("@galaxy-blackhole/gbh-client-ui-primitives")');
  });

  test("inject 8 service NGUYÊN VĂN + namespace skill", async () => {
    const { moduleExports } = await loadBundle();
    expect(moduleExports.inject).toEqual([
      "inputTriggers", "sessions", "slots", "locale", "remote", "remote.skills", "sidebarRight", "uiConversation",
    ]);
    expect(moduleExports.NS).toBe("skill");
  });

  test("hai slot occupant TÊN NGUYÊN VĂN + luật tham chiếu + nguồn gợi ý", async () => {
    const { moduleExports, ctx, rec } = await loadBundle();
    moduleExports.apply(ctx);
    expect(rec.injectedSlots).toEqual(["tool.call.toolview", "conversation.user.text.node"]);
    expect(rec.occupants[0]?.name).toBe("tool.call.toolview");
    expect(rec.occupants[0]?.key).toBe("skill");
    expect(rec.occupants[0]?.locale).toBe("skill");
    expect(rec.occupants[1]?.name).toBe("conversation.user.text.node");
    expect(rec.occupants[1]?.key).toBe("skill");
    expect(rec.occupants[1]?.priority).toBe(100);
    expect(rec.rules[0]?.id).toBe("skill");
    expect(rec.rules[0]?.order).toBe(20);
    expect(rec.sources.length).toBe(1);
    expect(rec.sources[0]?.trigger).toBe("/");
    expect(rec.sources[0]?.name).toBe("skill");
    expect(rec.sources[0]?.order).toBe(2);
    expect(rec.dictionaries[0]?.ns).toBe("skill");
    expect(rec.events).toContain("agent-preset/selected");
    expect(rec.events).toContain("connection/reset");
  });

  test("cổng chống cài hai lần: PHẠM VI MODULE, bật SAU khi đăng ký xong, KHÔNG khoá theo ctx", async () => {
    const plugin = await loadBundle();
    // Lần cài đầu NÉM giữa đường (đăng ký từ điển hỏng) ⇒ cờ PHẢI còn false.
    const register = plugin.ctx.locale.register;
    plugin.ctx.locale.register = () => {
      throw new Error("đăng ký hỏng giữa đường");
    };
    expect(() => plugin.moduleExports.apply(plugin.ctx)).toThrow();
    plugin.ctx.locale.register = register;
    // Cùng INSTANCE MODULE ⇒ lần hai phải đăng ký ĐỦ (nếu cờ bật sớm thì ca này trượt).
    plugin.rec.dictionaries.length = 0;
    plugin.rec.injectedSlots.length = 0;
    plugin.rec.occupants.length = 0;
    plugin.rec.sources.length = 0;
    plugin.moduleExports.apply(plugin.ctx);
    expect(plugin.rec.injectedSlots).toEqual(["tool.call.toolview", "conversation.user.text.node"]);
    expect(plugin.rec.occupants.length).toBe(2);
    expect(plugin.rec.sources.length).toBe(1);
    // Lần thứ ba: cờ đã bật ⇒ KHÔNG đăng ký gì thêm.
    plugin.rec.occupants.length = 0;
    plugin.rec.sources.length = 0;
    plugin.moduleExports.apply(plugin.ctx);
    expect(plugin.rec.occupants.length).toBe(0);
    expect(plugin.rec.sources.length).toBe(0);
    // Nạp MODULE MỚI thì lại được phép đăng ký (cờ là phạm vi module).
    const fresh = await loadBundle();
    fresh.moduleExports.apply(fresh.ctx);
    expect(fresh.rec.occupants.length).toBe(2);
  });

  test("RPC catalog: gọi skills.list theo phiên, memoize, huỷ khi Host đổi preset", async () => {
    const { moduleExports, ctx, rec } = await loadBundle();
    moduleExports.apply(ctx);
    const source = rec.sources[0] ?? {};
    const candidates = source.candidates as (s: { sessionId: string }, o: { query: string; signal: AbortSignal }) => Promise<{ name: string; description: string }[]>;
    const controller = new AbortController();
    const list = await candidates({ sessionId: "s1" }, { query: "", signal: controller.signal });
    expect(rec.listCalls.length).toBe(1);
    expect(rec.listCalls[0]).toEqual({ sessionId: "s1" });
    expect(list[0]?.name).toBe("commit");
    await candidates({ sessionId: "s1" }, { query: "", signal: controller.signal });
    expect(rec.listCalls.length).toBe(1); // memoize theo phiên
    const opener = source.openReference as (s: { sessionId: string }, r: { ref: string }) => boolean;
    expect(opener({ sessionId: "s1" }, { ref: "/commit" })).toBe(true);
    expect(rec.opened[0]).toBe("gbh-resource://file/session/s1/skills/commit.md");
  });

});

describe("ui-skill — CSS của thẻ (đối chiếu bản gốc)", () => {
  test("tập luật CSS khớp bản gốc sau khi bỏ khoảng trắng và đổi tiền tố lớp", () => {
    const stock = readFileSync(join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-skill", "lib", "client.js"), "utf8");
    const rules = stock.match(/\.[A-Za-z0-9_-]*_[a-zA-Z]+\{[^}]*\}/g) ?? [];
    expect(rules.length).toBe(20);
    const oracle = rules.join("").replace(/\.[A-Za-z0-9_-]+_/g, ".gbhSkill_").replace(/\s+/g, "");
    const ours = oursCss().replace(/\s+/g, "");
    expect(ours).toBe(oracle);
  });
});
