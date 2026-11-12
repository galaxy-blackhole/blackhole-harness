/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-subagent — luat mot-id · DU NAM slot nguyen van cua ban goc · cong idempotent pham vi
 *      module · tai nguyen tab chat · tu dien 41 khoa · va bo chon cho soan tin chi doc
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import {
  parseSubagentChatAddress,
  subagentChatAddress,
} from "../../packages/client/ui-subagent/src/sidebar-chat.ts";
import { SUBAGENT_CHAT_ADDRESS } from "../../packages/client/ui-subagent/src/ids.ts";
import { selectReadOnlySubagent } from "../../packages/client/ui-subagent/src/read-only-composer.ts";
import { en, NS, zh } from "../../packages/client/ui-subagent/src/locales.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-subagent");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-subagent";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-subagent";

/** Nam slot ma BAN GOC dang ky — row nay phai dang ky du, dung ten. */
const SLOT_NAMES = [
  "sidebar.right.pane.tab",
  "sidebar.chat.conversation",
  "conversation.session.header.lineage",
  "conversation.session.header.actions",
  "conversation.composer",
].sort();

/** Mot dang ky bat duoc tu bundle. */
type Registration = { id: string; factory: (require: (spec: string) => unknown) => unknown };

/** Mot lan register(spec, component) bat duoc tu context gia. */
interface RegisterCall {
  /** Spec slot. */
  spec: Record<string, unknown>;
  /** Component — THAM SO THU HAI. */
  component: unknown;
}

/** Bo ghi cua context gia. */
interface Recorder {
  /** Ten slot da inject, theo thu tu. */
  injected: string[];
  /** Cac lan register kem ca hai tham so. */
  registered: RegisterCall[];
  /** Nhan hieu ung vong doi. */
  effects: string[];
  /** Tu dien da dang ky. */
  locales: { ns: string; dictionaries: { zh: unknown; en: unknown } }[];
  /** Nha cung cap tai nguyen da dang ky. */
  resourceProviders: Record<string, unknown>[];
  /** Loai tab thanh ben phai da dang ky. */
  tabs: Record<string, unknown>[];
  /** Cac lan mo tai nguyen thanh tab. */
  opened: { address: string; options: Record<string, unknown> }[];
}

/**
 * Nap lai module client TƯƠI (co bundleInstalled o pham vi module nen import tinh se dinh giua cac ca).
 * @param tag - hau to query de moi ca co mot instance module rieng.
 * @returns ham createPlugin cua instance do.
 */
async function freshCreatePlugin(tag: string): Promise<(requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: readonly string[] }> {
  const spec: string = "../../packages/client/ui-subagent/src/plugin.ts?" + tag;
  const mod = (await import(spec)) as {
    createPlugin: (requireFn: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: readonly string[] };
  };
  return mod.createPlugin;
}

/** Runtime gia: jsx/jsxs tra ve cay node, primitives la cac ten, react-dom co portal. */
function fakeRequire(spec: string): unknown {
  if (spec === "react/jsx-runtime") {
    const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
    return { jsx, jsxs: jsx, Fragment: "Fragment" };
  }
  if (spec === "react") {
    return {
      useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, () => undefined],
      useRef: (initial: unknown) => ({ current: initial }),
      useEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
    };
  }
  if (spec === "react-dom") return { createPortal: (children: unknown) => children };
  return {
    IconRefreshOutlineRegular: "IconRefreshOutlineRegular",
    IconChevronRightOutlineRegular: "IconChevronRightOutlineRegular",
    IconChevronDownOutlineRegular: "IconChevronDownOutlineRegular",
    StateDot: "StateDot",
    Tooltip: "Tooltip",
  };
}

/**
 * Context gia: ghi lai moi dang ky va chay ngay callback cua inject (giong vo that).
 * @param options.failRegister - true thi register nem ngay lan dau (de kiem cong idempotent).
 * @returns context gia (ep kieu never khi goi apply) va bo ghi.
 */
function stubContext(options: { failRegister?: boolean } = {}): { ctx: unknown; record: Recorder } {
  const record: Recorder = { injected: [], registered: [], effects: [], locales: [], resourceProviders: [], tabs: [], opened: [] };
  const scope = {
    effect: (run: () => void, label: string) => {
      record.effects.push(label);
      run();
    },
    resources: { register: (provider: Record<string, unknown>) => record.resourceProviders.push(provider) },
    sessions: { retain: () => ({ release: () => undefined }), list: { getSnapshot: () => ({ byId: {} }) }, refreshProjections: () => undefined },
    sidebarRightTabs: { register: (spec: Record<string, unknown>) => record.tabs.push(spec) },
    slots: {
      inject: (name: string, body: () => unknown) => {
        record.injected.push(name);
        body();
      },
      register: (spec: Record<string, unknown>, component: unknown) => {
        if (options.failRegister === true) throw new Error("register hong (ca kiem cong idempotent)");
        record.registered.push({ spec, component });
      },
    },
  };
  const ctx = {
    effect: scope.effect,
    inject: (names: readonly string[], run: (value: typeof scope) => void) => {
      expect(names).toEqual(["resources", "sidebarRightTabs"]);
      run(scope);
    },
    slots: scope.slots,
    locale: {
      register: (ns: string, dictionaries: { zh: unknown; en: unknown }) => record.locales.push({ ns, dictionaries }),
      bind: () => (key: string) => key,
    },
    sessions: { refreshProjections: () => undefined },
    uiWorkspace: { openSession: () => undefined },
    sidebarRight: {
      openResource: (address: string, options: Record<string, unknown>) => record.opened.push({ address, options }),
    },
  };
  return { ctx, record };
}

/** Duong dan file nguon plugin. */
const PLUGIN_SRC = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
/** Duong dan file nguon tab chat. */
const CHAT_SRC = readFileSync(join(OURS, "src", "sidebar-chat.ts"), "utf8");

describe("row ui-subagent — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no => bundle chay hai lan => app trang.
    expect(ids).not.toContain(STOCK_NAME);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      dsh: { client: { inject: string[] } };
      gbh: { row: { moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
    // 20/10/2026 — inject cua manh nay van la CHIN goi cua ban goc, chi khac ID (rewrite CO CHU DICH): quy id ta
    //   -> id stock roi so DEEP-EQUAL (mang giu THU TU), literal STOCK giu nguyen lam chuan — KHONG noi contains.
    expect(sameAfterIdMap(meta.dsh.client.inject, [
      "@deepseek-ai/dsh-api-session-controller",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-resources",
      "@deepseek-ai/dsh-client-ui-chat",
      "@deepseek-ai/dsh-client-ui-conversation",
      "@deepseek-ai/dsh-client-ui-primitives",
      "@deepseek-ai/dsh-client-ui-sidebar-right",
      "@deepseek-ai/dsh-client-ui-input-trigger",
      "@deepseek-ai/dsh-client-ui-workspace",
    ])).toBe(true);
  });
});

describe("row ui-subagent — mat plugin", () => {
  test("apply dang ky DU NAM slot nguyen van cua ban goc, moi slot kem component la THAM SO THU HAI", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case2");
    const plugin = createPlugin(fakeRequire);
    plugin.apply(ctx);
    expect([...record.injected].sort()).toEqual(SLOT_NAMES);
    expect(record.registered.map((entry) => entry.spec.name as string).sort()).toEqual(SLOT_NAMES);
    for (const entry of record.registered) expect(typeof entry.component).toBe("function");
    // Nam seam nguyen van cua ban goc.
    expect([...plugin.inject]).toEqual(["sessions", "uiWorkspace", "slots", "locale", "sidebarRight"]);
    // Ten slot PHAI la LITERAL dung khuon ma check:rows nhan dang — chay lai CHINH hai regex cua cong
    // tren ma nguon cua ta, de khang dinh cong thay du nam slot (truu tuong hoa ten slot tung lam
    // cong bao THIEU ca 9 slot cua mot row khac).
    const detected = new Set<string>();
    for (const m of (PLUGIN_SRC + CHAT_SRC).matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) detected.add(m[1] as string);
    for (const m of (PLUGIN_SRC + CHAT_SRC).matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) detected.add(m[1] as string);
    expect([...detected].sort()).toEqual(SLOT_NAMES);
  });

  test("spec cua tung slot giu nguyen id/order/priority/locale va con cua ban goc", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case3");
    createPlugin(fakeRequire).apply(ctx);
    const byName = new Map(record.registered.map((entry) => [entry.spec.name as string, entry.spec]));
    expect(byName.get("conversation.session.header.actions")).toMatchObject({ id: "subagent-catalog", order: 10, locale: NS });
    expect(byName.get("conversation.composer")).toMatchObject({ priority: -10, locale: NS });
    expect(byName.get("conversation.session.header.lineage")).toMatchObject({ locale: NS });
    expect(byName.get("sidebar.right.pane.tab")).toMatchObject({
      key: STOCK_NAME,
      children: { "sidebar.chat.conversation": { kind: "single", scope: "session" } },
    });
    // "select" cua cho soan tin la bo chon cua ta (ham thuan, khang dinh bang chinh no).
    expect(typeof byName.get("conversation.composer")?.select).toBe("function");
    // Nghiep vu danh muc tiem vao hai slot hang dau.
    for (const name of ["conversation.session.header.lineage", "conversation.session.header.actions"]) {
      const injected = (byName.get(name)?.inject as (parentSessionId: string) => Record<string, unknown>)("s1");
      expect(typeof injected.openChild).toBe("function");
      expect(typeof injected.openChildAside).toBe("function");
      const openAside = injected.openChildAside as (address: Record<string, unknown>) => void;
      openAside({ parentSessionId: "s1", childSessionId: "s2", mode: "continuable" });
    }
    expect(record.opened[0]?.address).toBe("gbh-resource://subagentchat/session/s2?parent=s1&mode=continuable");
    expect(record.opened[0]?.options).toEqual({ kind: "subagentchat", preferNewPane: true });
  });

  test("cong chong cai hai lan: PHAM VI MODULE, va bat SAU khi dang ky xong", async () => {
    const createPlugin = await freshCreatePlugin("case4");
    const plugin = createPlugin(fakeRequire);
    // (1) Lan cai DAU nem giua duong (register hong) => co PHAI con false.
    const failing = stubContext({ failRegister: true });
    expect(() => plugin.apply(failing.ctx)).toThrow();
    // (2) Lan cai thu hai phai dang ky LAI du nam slot — neu co bat som thi ca nay ra 0 slot
    //     => renderer gap undefined => React #130 (ca that ui-settings-general 18/10/2026).
    const good = stubContext();
    plugin.apply(good.ctx);
    expect(good.record.registered.length).toBe(SLOT_NAMES.length);
    // (3) Lan cai thu ba: da xong nen khong dang ky lai (slot trung => app trang).
    plugin.apply(good.ctx);
    expect(good.record.registered.length).toBe(SLOT_NAMES.length);
    // (4) Dang nguon: co la bien PHAM VI MODULE, va duoc bat SAU loi goi applyInner.
    const guard = PLUGIN_SRC.indexOf("let uiSubagentInstalled = false;");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(PLUGIN_SRC.indexOf("export function createPlugin"));
    expect(PLUGIN_SRC.indexOf("applyInner(ctx);")).toBeLessThan(PLUGIN_SRC.indexOf("uiSubagentInstalled = true;"));
    // Khong duoc khoa theo ctx: artifact khong duoc chua lastCtx/installedContexts.
    expect(/lastCtx|installedContexts/.test(PLUGIN_SRC)).toBe(false);
  });
});

describe("row ui-subagent — tab chat va tu dien", () => {
  test("tab chat: chu tai nguyen + loai tab + dia chi tai nguyen tron vong", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case5");
    createPlugin(fakeRequire).apply(ctx);
    expect(record.resourceProviders[0]?.protocol).toBe("subagentchat");
    const tab = record.tabs[0] as { id: string; kind: string; patterns: string[]; priority: string; canOpen: (a: string) => boolean };
    expect(tab).toMatchObject({ id: STOCK_NAME, kind: "subagentchat", priority: "builtin" });
    expect(tab.patterns).toEqual(["gbh-resource://subagentchat/session/**"]);
    const address = { parentSessionId: "p1", childSessionId: "c 1", mode: "one-shot" };
    const encoded = subagentChatAddress(address);
    expect(encoded).toBe("gbh-resource://subagentchat/session/c%201?parent=p1&mode=one-shot");
    expect(parseSubagentChatAddress(encoded)).toEqual(address);
    expect(tab.canOpen(encoded)).toBe(true);
    // Dia chi khac giao thuc / thieu mode / sai duong dan => undefined (khong nem).
    expect(parseSubagentChatAddress("gbh-resource://other/session/c1?parent=p1&mode=one-shot")).toBeUndefined();
    expect(parseSubagentChatAddress("gbh-resource://subagentchat/session/c1?parent=p1")).toBeUndefined();
    expect(parseSubagentChatAddress("gbh-resource://subagentchat/other/c1?parent=p1&mode=unknown")).toBeUndefined();
    expect(parseSubagentChatAddress("khong-phai-url")).toBeUndefined();
  });

  test("tu dien 41 khoa hai ngu va bo chon cho soan tin chi doc", async () => {
    const { ctx, record } = stubContext();
    const createPlugin = await freshCreatePlugin("case6");
    createPlugin(fakeRequire).apply(ctx);
    expect(record.locales.map((entry) => entry.ns)).toEqual([NS]);
    expect(record.effects).toEqual([
      "ui-subagent: dictionaries",
      "ui-subagent: Sidebar chat resources",
      "ui-subagent: Sidebar chat type",
      "ui-subagent: Sidebar chat body",
      "ui-subagent: Sidebar Conversation",
    ]);
    const keys = Object.keys(zh);
    expect(keys.length).toBe(41);
    expect(Object.keys(en)).toEqual(keys);
    expect(record.locales[0]?.dictionaries.zh).toBe(zh);
    // Bon nhanh cua bo chon (ban goc): khong co subagent · unknown · one-shot · cha khong con.
    expect(selectReadOnlySubagent({ session: {} })).toBeNull();
    expect(selectReadOnlySubagent({ session: { subagent: null } })).toBeNull();
    expect(selectReadOnlySubagent({ session: { subagent: { address: { mode: "unknown" } } } })).toEqual({ reason: "unknown" });
    expect(selectReadOnlySubagent({ session: { subagent: { address: { mode: "one-shot" } } } })).toEqual({ reason: "one-shot" });
    expect(selectReadOnlySubagent({ session: { subagent: { address: { mode: "continuable" }, parentAvailable: false }, running: false } })).toEqual({ reason: "parent-unavailable" });
    expect(selectReadOnlySubagent({ session: { subagent: { address: { mode: "continuable" }, parentAvailable: true } } })).toBeNull();
    expect(selectReadOnlySubagent({ session: { subagent: { address: { mode: "continuable" }, parentAvailable: false }, running: true } })).toBeNull();
  });
});

describe("row ui-subagent — render hai component hang dau (khong can React)", () => {
  test("nut danh muc va duong dan pha he dung cay, dung nhan, khong nem", async () => {
    const { createHeaderLineageComponents } = await import("../../packages/client/ui-subagent/src/header-lineage.ts");
    // JSX gia co GOI component ham (React that lam viec nay) — nho vay cay duoc dung that su, khong
    // chi tra ve { type: CatalogDropdown }: day la khac biet giua "dang ky duoc" va "render duoc".
    const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown =>
      typeof type === "function" ? (type as (value: Record<string, unknown>) => unknown)(props) : { type, props, key };
    const react = fakeRequire("react") as { useState: unknown; useRef: unknown; useEffect: unknown; useMemo: unknown };
    const primitives = fakeRequire("@deepseek-ai/dsh-client-ui-primitives");
    const { SubagentCatalogAction, SubagentHeaderLineage } = createHeaderLineageComponents({
      jsx,
      jsxs: jsx as never,
      Fragment: "Fragment",
      react: react as never,
      createPortal: (children: unknown) => children,
      primitives: primitives as never,
    });
    /** Anh chup bang phien gia: mot phien goc co hai con, mot con dang chay. */
    const state = {
      projectionsBySession: {
        "root-1": {
          state: "ready",
          values: {
            subagentCatalog: [
              { id: "child-a", label: "Alpha", mode: "continuable" },
              { id: "child-b", mode: "one-shot" },
            ],
          },
        },
      },
      byId: {
        "root-1": { origin: "root" },
        "child-a": {
          title: "Alpha title",
          running: true,
          projectionValues: {
            subagentTiming: { settledMs: 65_000, active: { since: 0, through: 5_000 }, lastTurnCompleted: false },
            tokenUsage: { uncachedInputTokens: 1_200, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 },
          },
        },
      },
    };
    const useSessions = <T,>(selector: (value: typeof state) => T): T => selector(state);
    const useSessionStatus = <T,>(selector: (value: Map<string, { running?: boolean }>) => T): T =>
      selector(new Map([["child-a", { running: true }]]));
    /** Dich gia: giu nguyen khoa + tham so de khang dinh duoc noi suy. */
    const t = (key: string, params?: Record<string, string | number>): string => (params === undefined ? key : key + JSON.stringify(params));
    const actions = { openChild: () => undefined, openChildAside: () => undefined, refreshProjection: () => undefined };

    // (a) Nut danh muc cua phien GOC: cat theo so con dang chay.
    const count = SubagentCatalogAction({ sessionId: "root-1", useSessions, useSessionStatus, t, ...actions });
    expect((count as { type: unknown }).type).toBe("div");
    const countProps = (count as { props: Record<string, unknown> }).props;
    expect(String(countProps.className)).toContain("ZKlsPq_root");
    const trigger = (countProps.children as unknown[])[0] as { type: unknown; props: Record<string, unknown> };
    expect(trigger.type).toBe("button");
    expect(trigger.props["aria-label"]).toBe('count.running.one{"count":1}');
    expect(trigger.props["aria-expanded"]).toBe(false);
    // Menu khong mo nen khong co portal nao duoc dung.
    expect((countProps.children as unknown[])[1]).toBeNull();

    // (b) Duong dan pha he cua phien CON: nut doi phien + nut danh muc con cua chinh no.
    const switcher = SubagentHeaderLineage({
      lineageSessionId: "child-a",
      displayTitle: "Alpha title",
      useSessions,
      useSessionStatus,
      useSession: <T,>(selector: (session: { subagent?: { address: { parentSessionId: string; childSessionId: string; mode: string } } }) => T): T =>
        selector({ subagent: { address: { parentSessionId: "root-1", childSessionId: "child-a", mode: "continuable" } } }),
      t,
      ...actions,
    });
    const switcherChildren = (switcher as { props: Record<string, unknown> }).props.children as unknown[];
    expect(switcherChildren.length).toBe(2);
    const switcherRoot = switcherChildren[0] as { props: Record<string, unknown> };
    expect(String(switcherRoot.props.className)).toContain("ZKlsPq_switcherRoot");
    const switcherTrigger = (switcherRoot.props.children as unknown[])[0] as { props: Record<string, unknown> };
    expect(String(switcherTrigger.props.className)).toContain("ZKlsPq_switcherTrigger");
    // Nhan cua nut doi phien lay tu chinh danh muc (label cua phien dang mo), khong phai displayTitle.
    const titleSpan = (switcherTrigger.props.children as unknown[])[0] as { props: Record<string, unknown> };
    expect(titleSpan.props.children).toBe("Alpha");
    // Con cua phien con chua co danh muc => khong render gi (khong nem).
    expect(switcherChildren[1]).toBeNull();
    // Phien goc (khong phai subagent) => duong dan pha he tra null.
    expect(
      SubagentHeaderLineage({
        lineageSessionId: "root-1",
        useSessions: <T,>(selector: (value: {
          byId: Record<string, { origin?: string } | undefined>;
          projectionsBySession: Record<string, { state: string; values: { subagentCatalog?: readonly { id: string; mode: string }[] } } | undefined>;
        }) => T): T => selector({ byId: { "root-1": { origin: "root" } }, projectionsBySession: {} }),
        useSessionStatus,
        useSession: <T,>(selector: (session: Record<string, unknown>) => T): T => selector({}),
        t,
        ...actions,
      }),
    ).toBeNull();
  });
});

// task-29 (Wave D): scheme dual — PHÁT gbh-resource://, NHẬN cả dsh-resource://, scheme lạ bị TỪ CHỐI.
describe("task-29 — scheme resource của subagent chat", () => {
  test("phát scheme MỚI", () => {
    expect(SUBAGENT_CHAT_ADDRESS).toBe("gbh-resource://subagentchat/session/");
    const address = subagentChatAddress({ parentSessionId: "p1", childSessionId: "s1", mode: "continuable" });
    expect(address.startsWith("gbh-resource://")).toBe(true);
    expect(address.startsWith("dsh-resource://")).toBe(false);
  });

  test("round-trip hai chiều: địa chỉ cũ (dsh-resource) và mới cho CÙNG kết quả", () => {
    const mine = "gbh-resource://subagentchat/session/c1?parent=p1&mode=one-shot";
    const legacy = "dsh-resource://subagentchat/session/c1?parent=p1&mode=one-shot";
    expect(parseSubagentChatAddress(mine)).toEqual(parseSubagentChatAddress(legacy));
    expect(parseSubagentChatAddress(mine)?.childSessionId).toBe("c1");
  });

  test("scheme lạ bị từ chối", () => {
    for (const bad of [
      "http://subagentchat/session/c1?parent=p1&mode=one-shot",
      "gbh-la://subagentchat/session/c1?parent=p1&mode=one-shot",
      "gbh-resource://other/session/c1?parent=p1&mode=one-shot",
    ]) {
      expect(parseSubagentChatAddress(bad)).toBeUndefined();
    }
  });
});
