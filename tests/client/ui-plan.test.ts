/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test row ui-plan: luat mot-id tren ARTIFACT, sau slot + bon hieu ung, kieu tab, cong idempotent,
 *       doc plan tu lich su, dia chi tai nguyen, va render nam component
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/client/ui-plan/build.ts";
import {
  EFFECT,
  INJECT,
  NS,
  PACKAGE_NAME,
  SLOT_ENTRY_ID,
  TAB_KIND,
  TAB_PATTERNS,
  TAB_PRIORITY,
  TAB_TYPE_ID,
} from "../../packages/client/ui-plan/src/ids.ts";
// Id package GOC nhap tu src/ids-stock.ts — hang do CHI dung cho test/host, khong nhanh client nao import.
import { STOCK_PACKAGE_NAME } from "../../packages/client/ui-plan/src/ids-stock.ts";
import { en, zh } from "../../packages/client/ui-plan/src/locales.ts";
import { PLAN_KEYS } from "../../packages/client/ui-plan/src/plan-keys.ts";
import { isSubagentMode, parsePlanAddress, planAddress, submittedPlan, type PlanEvent } from "../../packages/client/ui-plan/src/plan.ts";
import {
  PLAN_ADDRESS_PATTERN,
  PLAN_ADDRESS_PREFIX,
  REVIEW_ADDRESS_PATTERN,
} from "../../packages/client/ui-plan/src/ids.ts";
import { planDefinition } from "../../packages/client/ui-plan/src/plan-definition.ts";
import { PlanResourceError, planResourceErrorOf, planResourceProvider } from "../../packages/client/ui-plan/src/plan-resource.ts";
import { createPlanViews, type PlanViews } from "../../packages/client/ui-plan/src/plan-views.ts";
import { createPlugin } from "../../packages/client/ui-plan/src/plugin.ts";
import { isReviewPreviewAddress, mintReviewWindow, reviewPreviewAddress } from "../../packages/client/ui-plan/src/review-preview.ts";

/** Thu muc package cua ta. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-plan");
/** Sau ten slot NGUYEN VAN ma ban goc dang ky. */
const SLOT_NAMES = [
  "conversation.chat.turnTail",
  "conversation.plan-review.actions",
  "sidebar.right.pane.tab",
  "sidebar.right.pane.tab.title",
  "conversation.input.plan",
];
/** Hai slot KIEU LIST — theo hop dong `slots`, chung BAT BUOC co `id` nguyen van cua ban goc. */
const LIST_SLOTS = ["conversation.chat.turnTail", "conversation.plan-review.actions"];

/** Element gia: chi ghi lai type/props/key de soi cay. */
interface Element {
  /** Loai element. */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoa. */
  key?: unknown;
}

/**
 * jsx gia: KHONG render sau — chi dung cay element.
 * Nhan: type — loai; props — props; key — khoa.
 * Tra: element gia.
 */
function fakeJsx(type: unknown, props: Record<string, unknown>, key?: unknown): Element {
  return { type, props, key };
}

/**
 * Khung JSX/hook gia — CO Y KHONG co jsx/jsxs tren module react that (chung o react/jsx-runtime).
 * Nhan: record — ban ghi ham don dep.
 * Tra: khung ma createPlanViews nhan.
 */
function makeShell(record: { cleanups: (() => void)[] }): Parameters<typeof createPlanViews>[0] {
  return {
    jsx: fakeJsx,
    jsxs: fakeJsx,
    Fragment: "Fragment",
    useState: <T,>(initial: T): [T, (next: T) => void] => [initial, () => undefined],
    useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
    useEffect: (callback: () => void | (() => void)): void => {
      const cleanup = callback();
      if (typeof cleanup === "function") record.cleanups.push(cleanup);
    },
    useMemo: <T,>(factory: () => T): T => factory(),
  };
}

/** Primitive gia — dung hinh dang module that, chi gom ten ma row nay dung. */
const PRIMITIVES = {
  FileTypeIcon: "FileTypeIcon",
  IconChevronRightOutlineRegular: "IconChevronRightOutlineRegular",
  IconPlanOutlineRegular: "IconPlanOutlineRegular",
  IconCloseCircleFillRegular: "IconCloseCircleFillRegular",
  MarkdownText: "MarkdownText",
  extractMarkdownPlainText: (text: string): string => text.split("\n")[0] ?? "",
};

/** Mot lan dang ky slot da ghi lai. */
interface SlotRecord {
  /** Ten slot (nguyen van tai cho dang ky). */
  name: string;
  /** Dinh danh occupant. */
  spec: Record<string, unknown>;
  /** Component — THAM SO THU HAI cua register(spec, Component). */
  component: unknown;
}

/** Ban ghi cua mot lan apply. */
interface ApplyRecord {
  /** Cac lan dang ky slot. */
  slots: SlotRecord[];
  /** Nhan hieu ung kem gia tri ma than hieu ung tra ve. */
  effects: { label: string; value: unknown }[];
  /** Dinh nghia kieu tab da dang ky. */
  tab: Record<string, unknown> | undefined;
  /** Provider tai nguyen da dang ky. */
  provider: unknown;
  /** Dinh nghia chieu node da dang ky. */
  definition: unknown;
  /** Nhung lenh da gui qua Remote. */
  commands: string[];
}

/**
 * Ngu canh goc gia — chi nhung gi row nay that su goi.
 * Nhan: commands — mang ghi lai lenh Remote.
 * Tra: ngu canh gia kem ban ghi.
 */
function makeCtx(commands: string[] = []): { ctx: unknown; record: ApplyRecord } {
  const record: ApplyRecord = { slots: [], effects: [], tab: undefined, provider: undefined, definition: undefined, commands };
  const mounted = { getSnapshot: (): string | undefined => undefined, subscribe: (): (() => void) => () => undefined };
  const ctx = {
    effect: (callback: () => unknown, label: string): unknown => {
      const value = callback();
      record.effects.push({ label, value });
      return value;
    },
    slots: {
      inject: (_name: string, register: () => unknown): unknown => register(),
      register: (spec: Record<string, unknown>, component: unknown): unknown => {
        record.slots.push({ name: String(spec.name), spec, component });
        return component;
      },
    },
    locale: {
      register: (namespace: string, dictionaries: unknown): unknown => ({ namespace, dictionaries }),
      bind: (namespace: string): ((key: string) => string) => (key: string) => namespace + ":" + key,
    },
    uiConversation: {
      events: {
        register: (definition: unknown): unknown => {
          record.definition = definition;
          return definition;
        },
      },
      binding: (): { target: () => { getSnapshot: () => undefined } } => ({ target: () => ({ getSnapshot: () => undefined }) }),
    },
    resources: {
      register: (provider: unknown): unknown => {
        record.provider = provider;
        return provider;
      },
    },
    sidebarRight: { mounted, openResource: (): void => undefined },
    sidebarRightTabs: {
      register: (definition: Record<string, unknown>): unknown => {
        record.tab = definition;
        return definition;
      },
    },
    sessions: { binding: (): undefined => undefined, subagentAddress: (): undefined => undefined },
    remote: {
      commands: {
        execute: (sessionId: string, command: string): Promise<{ ok: boolean; value?: unknown; error: { code: string; message: string } }> => {
          commands.push(sessionId + " " + command);
          return Promise.resolve({ ok: true, value: "", error: { code: "", message: "" } });
        },
      },
      session: {},
    },
  };
  return { ctx, record };
}

/**
 * Bang module gia: chi co dung nhung module ma nua client require.
 * Nhan: khong.
 * Tra: ham require gia.
 */
function makeRequire(): (specifier: string) => unknown {
  const table: Record<string, unknown> = {
    "react/jsx-runtime": { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" },
    react: {
      useState: (value: unknown) => [value, () => undefined],
      useRef: (value: unknown) => ({ current: value }),
      useEffect: () => undefined,
      useMemo: (factory: () => unknown) => factory(),
    },
    "@deepseek-ai/dsh-client-ui-primitives": PRIMITIVES,
    "@deepseek-ai/dsh-client-store": { defineStore: (definition: unknown) => definition },
  };
  return (specifier: string): unknown => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (!(specifier in table)) throw new Error("module not found: " + specifier);
    return table[specifier];
  };
}

/** Artifact build ra trong thu muc tam (do tren ban THAT, khong grep src/). */
let artifact = "";
/** Ban ghi cua lan apply DAU TIEN — cong chong cai hai lan o pham vi module nen chi co mot lan. */
let applied: ApplyRecord | undefined;

describe("row ui-plan — khuon bundle (do tren ARTIFACT)", () => {
  test("build ra lib/index.js + lib/client.js, bundle dang ky DUNG MOT id (id cua ta)", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-ui-plan-"));
    await buildPackage(out);
    const code = await readFile(join(out, "client.js"), "utf8");
    artifact = code;
    const ids = [...code.matchAll(/__ModuleLoader__[.]load[(][{] id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no => bundle chay hai lan => app trang.
    expect(ids).not.toContain(STOCK_PACKAGE_NAME);
    expect(existsSync(join(out, "index.js"))).toBe(true);
  });

  test("artifact KHONG con bieu thuc dang ky id nao cua goi goc, nhung slot list VAN giu id nguyen van", () => {
    // Hai phep do cua reviewer, do thang tren artifact: id cua GOI GOC = 0 dong · id CUA TA = 1 dong (loi goi load).
    expect((artifact.match(/id: "@deepseek-ai/g) ?? []).length).toBe(0);
    expect((artifact.match(/id: "@galaxy-blackhole/g) ?? []).length).toBe(1);
    expect(artifact).toContain("id: SLOT_ENTRY_ID");
    // Luat MOT-ID (19/10/2026): chuoi id goi goc VANG hoan toan khoi artifact; slot list VAN giu NGUYEN VAN
    // gia tri do, nhung no duoc GHEP tu PACKAGE_NAME luc chay (hang tai lieu o src/ids-stock.ts, chi test import).
    expect(artifact).not.toContain(STOCK_PACKAGE_NAME);
    expect(SLOT_ENTRY_ID).toBe(STOCK_PACKAGE_NAME);
    // Khoa dispatch cua HAI slot keyed KHONG duoc dung id cua goi goc nua (xem ca "khoa dispatch" o duoi).
    expect(artifact).not.toContain("key: SLOT_ENTRY_ID");
  });

  test("artifact dang ky DU sau slot cua ban goc, va nhung CSS cua ca hai module", () => {
    for (const name of SLOT_NAMES) expect(artifact).toContain('name: "' + name + '"');
    expect(artifact).toContain("k74WwW_cards");
    expect(artifact).toContain("rS3zOq_chip");
    expect(artifact).toContain("data-plugin-css");
  });

  test("package.json khai mot id + aliases giu id goc, va tro test ve file nay", async () => {
    const meta = JSON.parse(await readFile(join(OURS, "package.json"), "utf8")) as {
      gbh?: { row?: { id?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[] } };
      dsh?: { client?: { platform?: string } };
    };
    expect(meta.gbh?.row?.id).toBe("ui-plan");
    expect(meta.gbh?.row?.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh?.row?.aliases).toContain(STOCK_PACKAGE_NAME);
    expect(meta.gbh?.row?.moduleIds ?? []).not.toContain(STOCK_PACKAGE_NAME);
    expect(meta.gbh?.row?.tests).toEqual(["tests/client/ui-plan.test.ts"]);
    expect(meta.dsh?.client?.platform).toBe("web");
  });

  test("build.ts nhan process.argv[2] (khong hard-code lib/) va co du hai loi goi Bun.build", async () => {
    const src = await readFile(join(OURS, "build.ts"), "utf8");
    expect(src).toContain("export async function buildPackage(outDir?: string)");
    expect(src).toContain('const out = outDir ?? join(import.meta.dir, "lib")');
    expect(src).toContain("await buildPackage(process.argv[2]);");
    expect([...src.matchAll(/Bun[.]build[(]/g)].length).toBeGreaterThanOrEqual(2);
  });
});

describe("row ui-plan — mat plugin", () => {
  // CA DAU TIEN phai la ca goi apply: cong chong cai hai lan o PHAM VI MODULE, nen sau ca nay co da bat.
  test("apply dang ky DU sau slot + bon hieu ung + kieu tab plan, component la THAM SO THU HAI", () => {
    const plugin = createPlugin(makeRequire());
    const { ctx, record } = makeCtx();
    plugin.apply(ctx as never);
    applied = record;
    expect(plugin.name).toBe(PACKAGE_NAME);
    expect([...plugin.inject]).toEqual([...INJECT]);
    expect(record.slots.map((slot) => slot.name).sort()).toEqual([...SLOT_NAMES].sort());
    for (const slot of record.slots) {
      // Ten slot LITERAL tai cho dang ky, va component la THAM SO THU HAI cua register(spec, Component).
      expect(artifact).toContain('name: "' + slot.name + '"');
      expect(typeof slot.component).toBe("function");
    }
    for (const name of LIST_SLOTS) {
      const slot = record.slots.find((item) => item.name === name);
      expect(slot?.spec.id).toBe(SLOT_ENTRY_ID);
      expect(slot?.spec.id).toBe(STOCK_PACKAGE_NAME);
    }
    for (const name of ["sidebar.right.pane.tab", "sidebar.right.pane.tab.title"]) {
      const slot = record.slots.find((item) => item.name === name);
      // HAI slot KEYED: `key` PHAI bang id cua kieu tab (TAB_TYPE_ID = id CUA TA), khong dung id goi goc.
      expect(slot?.spec.key).toBe(TAB_TYPE_ID);
      expect(slot?.spec.key).not.toBe(STOCK_PACKAGE_NAME);
    }
    expect(record.slots.find((item) => item.name === "conversation.input.plan")?.spec.locale).toBe(NS);
    expect(record.effects.map((effect) => effect.label).sort()).toEqual(
      [EFFECT.dictionaries, EFFECT.conversationDefinition, EFFECT.resources, EFFECT.sidebarType].sort(),
    );
    expect(record.definition).toBe(planDefinition);
    expect(record.provider).not.toBeUndefined();
    expect(record.tab?.id).toBe(TAB_TYPE_ID);
    expect(record.tab?.id).toBe(PACKAGE_NAME);
    expect(record.tab?.kind).toBe(TAB_KIND);
    expect(record.tab?.priority).toBe(TAB_PRIORITY);
    expect(record.tab?.patterns).toEqual([...TAB_PATTERNS]);
    const canOpen = record.tab?.canOpen as (address: string) => boolean;
    expect(canOpen(planAddress({ session: { kind: "session", sessionId: "s1" }, callId: "c1" }))).toBe(true);
    expect(canOpen(reviewPreviewAddress("s1", "r1"))).toBe(true);
    expect(canOpen("gbh-resource://other/x")).toBe(false);
    const dictionaries = record.effects.find((effect) => effect.label === EFFECT.dictionaries)?.value as {
      dictionaries?: { zh?: unknown; en?: unknown };
    };
    expect(dictionaries.dictionaries?.zh).toBe(zh);
    expect(dictionaries.dictionaries?.en).toBe(en);
  });

  // ⚠️ 18/10/2026 — CA KHOA DUNG CAI SAI CU: test truoc day khang dinh HAI VE LECH NHAU (key slot = SLOT_ENTRY_ID
  //   con id kieu tab = TAB_TYPE_ID) nen XANH trong khi chuc nang van gay: sidebar tinh
  //   `entryKey = definition?.id ?? tab.kind` roi tra `entriesOfSlot(slotKey).find(e => e.options.key === entryKey)`
  //   ⇒ truot ⇒ render fallback `tab.unavailable`, KHONG kem loi console nao.
  test("khoa dispatch: key cua HAI slot keyed BANG id cua kieu tab (do tren mat dang ky VA tren artifact)", () => {
    expect(applied).not.toBeUndefined();
    const record = applied as ApplyRecord;
    // Bat bien: hai ve la MOT gia tri, khong phai hai phep do doc lap.
    expect(record.tab?.id).toBe(TAB_TYPE_ID);
    expect(TAB_TYPE_ID).not.toBe(SLOT_ENTRY_ID);
    for (const name of ["sidebar.right.pane.tab", "sidebar.right.pane.tab.title"]) {
      const slot = record.slots.find((item) => item.name === name);
      expect(slot?.spec.key).toBe(record.tab?.id);
      expect(slot?.spec.key).toBe(TAB_TYPE_ID);
    }
    // Do lai tren ARTIFACT: MOT `id:` cua kieu tab + dung HAI `key:` tro cung hang so do.
    expect(artifact).toContain("id: TAB_TYPE_ID");
    expect(artifact).toContain("var TAB_TYPE_ID = PACKAGE_NAME");
    expect((artifact.match(/key: TAB_TYPE_ID/g) ?? []).length).toBe(2);
    expect(artifact).not.toContain("key: SLOT_ENTRY_ID");
  });

  test("inject cua tung occupant dung API cua seam va nem loi ro rang khi thieu phien", async () => {
    expect(applied).not.toBeUndefined();
    const record = applied as ApplyRecord;
    const turnTail = record.slots.find((slot) => slot.name === "conversation.chat.turnTail");
    const injectTurnTail = turnTail?.spec.inject as (sessionId: string) => Record<string, unknown>;
    expect(() => injectTurnTail("missing")).toThrow(/unknown session/);
    const review = record.slots.find((slot) => slot.name === "conversation.plan-review.actions");
    const injectReview = review?.spec.inject as (sessionId: string) => { hooks: { sidebarMounted: unknown }; openReview: unknown };
    expect(typeof injectReview("s1").openReview).toBe("function");
    expect(injectReview("s1").hooks.sidebarMounted).not.toBeUndefined();
    expect(review?.spec.store).not.toBeUndefined();
    const chip = record.slots.find((slot) => slot.name === "conversation.input.plan");
    const injectChip = chip?.spec.inject as (sessionId: string) => { exitPlanMode: () => Promise<string | null> };
    expect(await injectChip("s7").exitPlanMode()).toBeNull();
    expect(record.commands).toEqual(["s7 /plan off"]);
  });

  test("cong chong cai hai lan: co PHAM VI MODULE, KHONG khoa theo ctx, bat SAU khi dang ky xong", async () => {
    const src = await readFile(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let bundleInstalled = false;");
    const flip = src.indexOf("bundleInstalled = true;");
    const entry = src.indexOf("export function createPlugin");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(entry);
    expect(flip).toBeGreaterThan(src.indexOf("applyInner(ctx);"));
    // Do tren ARTIFACT (cung phep do ma check:rows dung): cong chan KHAO THEO ctx khong bao gio kich
    // hoat trong ca HAI ENTRY ⇒ apply chay hai lan ⇒ service da dang ky.
    expect(artifact).toContain("bundleInstalled");
    expect(/(lastCtx|installedContexts)/.test(artifact)).toBe(false);
    // Lan cai thu hai (ctx KHAC) phai la no-op: chinh vi cong khong khoa theo ctx.
    const plugin = createPlugin(makeRequire());
    const second = makeCtx();
    plugin.apply(second.ctx as never);
    expect(second.record.slots).toEqual([]);
    expect(second.record.effects).toEqual([]);
  });
});

describe("row ui-plan — doc plan, dia chi va render", () => {
  test("submittedPlan doc dung loi goi tool va bo qua du lieu hong", () => {
    const call: PlanEvent = {
      type: "tool/call",
      data: { name: "exit_plan_mode", callId: "c1", arguments: JSON.stringify({ plan: "# Ke hoach\n\nnoi dung" }) },
    };
    expect(submittedPlan(call)).toEqual({ callId: "c1", markdown: "# Ke hoach\n\nnoi dung", title: "Ke hoach" });
    expect(submittedPlan({ type: "tool/call", data: { name: "bash", callId: "c2", arguments: "{}" } })).toBeUndefined();
    expect(submittedPlan({ type: "tool/call", data: { name: "exit_plan_mode", callId: "c3", arguments: "{hong" } })).toBeUndefined();
    expect(
      submittedPlan({ type: "tool/call", data: { name: "exit_plan_mode", callId: "c4", arguments: JSON.stringify({ plan: "khong co tieu de" }) } }),
    ).toBeUndefined();
    expect(submittedPlan({ type: "tool/ptc-dispatch", data: { name: "exit_plan_mode", subCallId: "c5", arguments: { plan: "# PTC" } } })).toEqual({
      callId: "c5",
      markdown: "# PTC",
      title: "PTC",
    });
  });

  test("dia chi plan di va ve tron ven cho ca phien thuong lan phien con", () => {
    const plain = { session: { kind: "session", sessionId: "s 1" } as const, callId: "call/1" };
    const address = planAddress(plain);
    expect(address).toBe("gbh-resource://plan/s%201/call%2F1");
    expect(parsePlanAddress(address)).toEqual({ session: { kind: "session", sessionId: "s 1" }, callId: "call/1" });
    const nested = planAddress({
      session: { kind: "subagent", parentSessionId: "p", childSessionId: "c", mode: "continuable" },
      callId: "call2",
    });
    expect(parsePlanAddress(nested)).toEqual({
      session: { kind: "subagent", parentSessionId: "p", childSessionId: "c", mode: "continuable" },
      callId: "call2",
    });
    expect(parsePlanAddress("gbh-resource://plan/a/b/c")).toBeUndefined();
    expect(parsePlanAddress("gbh-resource://plan-review/a/b")).toBeUndefined();
    expect(isSubagentMode("unknown")).toBe(true);
    expect(isSubagentMode("khac")).toBe(false);
  });

  test("dia chi plan tam thoi nhan dung, va cua so review la mot UUID v4", () => {
    const address = reviewPreviewAddress("s1", "r1");
    expect(address).toBe("gbh-resource://plan-review/s1/r1");
    expect(isReviewPreviewAddress(address)).toBe(true);
    expect(isReviewPreviewAddress("gbh-resource://plan/s1/r1")).toBe(false);
    const minted = mintReviewWindow();
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(minted)).toBe(true);
    expect(mintReviewWindow()).not.toBe(minted);
  });

  test("planDefinition chieu node an, va PTC quyet toan sau GIU NGUYEN vi tri the", () => {
    const call: PlanEvent & { seq: number } = {
      type: "tool/call",
      seq: 4,
      data: { name: "exit_plan_mode", callId: "c1", arguments: JSON.stringify({ plan: "# A" }) },
    };
    expect(planDefinition.match(call)).toEqual({ id: "c1", role: "start" });
    expect(planDefinition.kind).toBe("submitted-plan");
    expect(planDefinition.target).toBe("chat");
    const start = { event: call, location: { kind: "chat" } };
    const node = planDefinition.buildViewNode({ key: "k", id: "c1", start, matches: [start] });
    expect(node?.anchorSeq).toBe(4);
    expect(node?.visibility).toBe("hidden");
    expect(node?.data).toEqual({ callId: "c1", markdown: "# A", title: "A" });
    expect(planDefinition.update({ key: "k", id: "c1", state: node?.data, start, matches: [start] })).toEqual(node?.data);
    expect(planDefinition.buildViewNode({ key: "k", id: "c1", matches: [] })).toBeNull();
    expect(planDefinition.match({ type: "tool/call", data: { name: "bash", callId: "x", arguments: "{}" } })).toBeNull();
  });

  test("provider tai nguyen plan doc dung loi goi va giu nguyen ma loi cua Host", async () => {
    const record: { calls: string[] } = { calls: [] };
    const snapshotFrame = {
      type: "snapshot",
      cursor: 9,
      hasMore: false,
      records: [{ event: { type: "tool/call", seq: 2, data: { name: "exit_plan_mode", callId: "c1", arguments: JSON.stringify({ plan: "# A" }) } } }],
    };
    async function* follow(): AsyncGenerator<unknown> {
      yield { type: "status" };
      yield snapshotFrame;
    }
    const remote = {
      follow: () => follow(),
      page: (query: { beforeSeq: number }): Promise<unknown> => {
        record.calls.push(String(query.beforeSeq));
        return Promise.resolve({ ok: true, value: { records: [], hasMore: false } });
      },
    };
    const provider = planResourceProvider(remote as never);
    expect(provider.protocol).toBe("plan");
    const address = planAddress({ session: { kind: "session", sessionId: "s1" }, callId: "c1" });
    const frames: unknown[] = [];
    for await (const frame of provider.open(address, { signal: new AbortController().signal })) frames.push(frame);
    expect(frames).toEqual([{ ok: true, value: { callId: "c1", markdown: "# A", title: "A" } }]);
    expect(record.calls).toEqual([]);
    const missing = planAddress({ session: { kind: "session", sessionId: "s1" }, callId: "khong-co" });
    const notFound: { error?: { code: string } }[] = [];
    for await (const frame of provider.open(missing, { signal: new AbortController().signal })) notFound.push(frame as { error?: { code: string } });
    expect(notFound[0]?.error?.code).toBe("plan/not-found");
    const invalid: { error?: { code: string } }[] = [];
    for await (const frame of provider.open("khong-phai-dia-chi", { signal: new AbortController().signal })) invalid.push(frame as { error?: { code: string } });
    expect(invalid[0]?.error?.code).toBe("plan/invalid-address");
    expect(planResourceErrorOf(new PlanResourceError("plan/x", "hong"))).toEqual({ code: "plan/x", message: "hong" });
    expect(planResourceErrorOf(new Error("hong"))).toBeUndefined();
  });

  test("the plan render du the, chip tra null khi plan mode khong bat", () => {
    const views: PlanViews = createPlanViews(makeShell({ cleanups: [] }), PRIMITIVES);
    const cards = views.PlanCards({
      turn: { turn: 3 },
      usePlans: () => [
        { callId: "c1", markdown: "# A", title: "A" },
        { callId: "c2", markdown: "# B", title: "B" },
      ],
      openPlan: () => undefined,
      t: (key) => key,
    }) as Element;
    expect(cards.props["data-plan-artifacts"]).toBe(true);
    expect(cards.props.className).toBe("k74WwW_cards");
    const items = cards.props.children as Element[];
    expect(items.length).toBe(2);
    expect(items[1]?.props["data-plan-card"]).toBe("c2");
    expect(items[0]?.key).toBe("c1");
    expect(views.PlanCards({ turn: { turn: 3 }, usePlans: () => undefined, openPlan: () => undefined, t: (key) => key })).toBeNull();
    const chipProps = { locked: false, exitPlanMode: () => Promise.resolve(null), t: (key: string) => key };
    expect(views.PlanChip({ ...chipProps, useProjection: () => undefined })).toBeNull();
    expect(views.PlanChip({ ...chipProps, useProjection: () => ({ pending: false, active: false }) })).toBeNull();
    const chip = views.PlanChip({ ...chipProps, useProjection: () => ({ pending: false, active: true }) }) as Element;
    expect(chip.props.className).toBe("rS3zOq_wrap");
    const address = "gbh-resource://plan/s1/c1";
    const pre = views.PlanPreview({
      useTabInfo: () => ({ tab: { title: "t", navigation: { address } } }),
      useResource: () => ({ status: "ready", value: { markdown: "# A", title: "A" } }),
      t: (key) => key,
    }) as Element;
    expect(pre.props["data-plan-preview"]).toBe(address);
    expect(pre.props["aria-label"]).toBe("A");
    const loading = views.PlanPreview({
      useTabInfo: () => ({ tab: { title: "t", navigation: { address } } }),
      useResource: () => ({ status: "loading" }),
      t: (key) => key,
    }) as Element;
    expect((loading.props.children as unknown[])[0]).toBe("preview.loading");
  });

  test("tu dien namespace plan du khoa o CA HAI ngon ngu", () => {
    expect(Object.keys(zh).sort()).toEqual([...PLAN_KEYS].sort());
    expect(Object.keys(en).sort()).toEqual([...PLAN_KEYS].sort());
    for (const key of PLAN_KEYS) expect(en[key].length).toBeGreaterThan(0);
  });
});

// task-29 (Wave D): URI scheme dual — client PHÁT scheme mới, NHẬN cả scheme cũ, scheme lạ bị TỪ CHỐI.
describe("task-29 — scheme resource: phát mới, nhận cả cũ", () => {
  test("phát gbh-resource:// (không còn dsh-resource:// ở nơi phát)", () => {
    expect(PLAN_ADDRESS_PREFIX).toBe("gbh-resource://plan/");
    const address = planAddress({ session: { kind: "session", sessionId: "s1" }, callId: "c1" });
    expect(address).toBe("gbh-resource://plan/s1/c1");
    expect(address.startsWith("dsh-resource://")).toBe(false);
  });

  test("pattern tab nhận CẢ HAI scheme, scheme lạ bị từ chối", () => {
    expect(TAB_PATTERNS).toEqual([
      "gbh-resource://plan/**",
      "gbh-resource://plan-review/**",
      "dsh-resource://plan/**",
      "dsh-resource://plan-review/**",
    ]);
    expect(PLAN_ADDRESS_PATTERN.test("gbh-resource://plan/a")).toBe(true);
    expect(PLAN_ADDRESS_PATTERN.test("dsh-resource://plan/a")).toBe(true);
    expect(PLAN_ADDRESS_PATTERN.test("http://plan/a")).toBe(false);
    expect(REVIEW_ADDRESS_PATTERN.test("gbh-resource://plan-review/a/b")).toBe(true);
    expect(REVIEW_ADDRESS_PATTERN.test("dsh-resource://plan-review/a/b")).toBe(true);
    expect(REVIEW_ADDRESS_PATTERN.test("gbh-la://plan-review/a/b")).toBe(false);
  });

  test("parsePlanAddress: round-trip hai chiều — địa chỉ mới và địa chỉ cũ cho CÙNG kết quả", () => {
    const mine = planAddress({ session: { kind: "session", sessionId: "s1" }, callId: "c1" });
    const legacy = "dsh-resource://plan/s1/c1";
    expect(parsePlanAddress(mine)).toEqual({ session: { kind: "session", sessionId: "s1" }, callId: "c1" });
    expect(parsePlanAddress(legacy)).toEqual(parsePlanAddress(mine));
    expect(parsePlanAddress("http://plan/s1/c1")).toBeUndefined();
  });
});
