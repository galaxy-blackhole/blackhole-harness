/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test cho row ui-settings-subagent: DOI CHUNG bundle goc (khoa tuyen · ung vien · so tuyen · truong so)
 *      + the/card/apply + TEST CANH CSS ba module + khuon bundle
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/client/ui-settings-subagent/build.ts";
import { createPlugin } from "../../packages/client/ui-settings-subagent/src/plugin.ts";
import { createLimitsFields } from "../../packages/client/ui-settings-subagent/src/limits-fields.ts";
import { createModelSelectionFields } from "../../packages/client/ui-settings-subagent/src/model-selection-fields.ts";
import { createSubagentCard } from "../../packages/client/ui-settings-subagent/src/subagent-card.ts";
import { subagentCardFace, subagentCardShell } from "../../packages/client/ui-settings-subagent/src/subagent-card-controller.ts";
import {
  sameRoutes,
  subagentModelCandidates,
  subagentModelKey,
  SubagentModelSelectionCardController,
} from "../../packages/client/ui-settings-subagent/src/subagent-model-selection-card-controller.ts";
import { limitField, SubagentLimitsCardController } from "../../packages/client/ui-settings-subagent/src/subagent-limits-card-controller.ts";
import { LIMITS_CLASS, MODELS_CLASS, CARD_CLASS } from "../../packages/client/ui-settings-subagent/src/class-names.ts";
import { en, formLabels, zh } from "../../packages/client/ui-settings-subagent/src/locales.ts";
import { INJECT, NS, SLOT, SUBAGENT_MODEL_SELECTION_NS, SUBAGENT_NS } from "../../packages/client/ui-settings-subagent/src/ids.ts";
import type { ModelGroup, SubagentPrimitives } from "../../packages/client/ui-settings-subagent/src/types.ts";
import type { CardPrimitives } from "../../packages/client/ui-settings-subagent/src/card-types.ts";

/** Đường dẫn bundle gốc (CHỈ ĐỌC) — nguồn đối chứng. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-settings-subagent", "lib", "client.js");

/**
 * Rút một hàm khai bằng `function tên(...)` khỏi văn bản, cắt theo ngoặc cân bằng.
 * Nhận: văn bản nguồn và tên hàm.
 * Trả: mã nguồn của hàm.
 */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf("function " + name + "(");
  if (start < 0) throw new Error("khong thay ham " + name + " trong bundle goc");
  let depth = 0;
  for (let at = start; at < source.length; at += 1) {
    const ch = source[at];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, at + 1);
    }
  }
  throw new Error("ham " + name + " khong dong ngoac");
}

/**
 * Dựng lại các hàm THUẦN của bản gốc trong một phạm vi riêng.
 * Nhận: hàm `settingsNumberField` giả để tiêm vào `limitField`.
 * Trả: các hàm của bản gốc.
 */
async function loadStock(numberField: (field: unknown) => { parse: (text: string) => unknown }) {
  const source = await readFile(STOCK, "utf8");
  const body = [
    extractFunction(source, "subagentModelKey"),
    extractFunction(source, "subagentModelCandidates"),
    extractFunction(source, "sameRoutes"),
    extractFunction(source, "subagentCardShell"),
    "const _deepseek_ai_dsh_client_ui_primitives = { settingsNumberField: __numberField };",
    extractFunction(source, "limitField"),
    "return { subagentModelKey: subagentModelKey, subagentModelCandidates: subagentModelCandidates, sameRoutes: sameRoutes, subagentCardShell: subagentCardShell, limitField: limitField };",
  ].join("\n");
  const factory = new Function("__numberField", body) as (nf: unknown) => Record<string, unknown>;
  return factory(numberField) as {
    subagentModelKey: (route: { provider: string; model: string }) => string;
    subagentModelCandidates: (groups: readonly ModelGroup[], stored: readonly { provider: string; model: string }[], selected: ReadonlySet<string>) => unknown;
    sameRoutes: (left: readonly { provider: string; model: string }[], right: readonly { provider: string; model: string }[]) => boolean;
    subagentCardShell: (limits: never, models: never) => unknown;
    limitField: (field: string, minimum: number) => { parse: (text: string) => unknown };
  };
}

/** Bộ nguyên thuỷ giả: trường số đọc số nguyên, form model ghi lại lời gọi, store đơn giản. */
function makePrimitives() {
  const calls: string[] = [];
  const numberField = () => ({
    parse: (text: string) => {
      const trimmed = text.trim();
      if (trimmed === "") return undefined;
      const value = Number(trimmed);
      return Number.isNaN(value) ? undefined : { kind: "set", value };
    },
    value: "",
    invalid: false,
  });
  const primitives: SubagentPrimitives & CardPrimitives & Record<string, unknown> = {
    settingsNumberField: numberField,
    SettingsFormModel: class {
      constructor() { calls.push("SettingsFormModel"); }
      shell() { return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }; }
      field(name: string) { return { value: name, overridden: false, invalid: false }; }
      bind(select: () => unknown) { calls.push("bind"); return { getSnapshot: select, set: () => undefined }; }
      actions() { return { edit: () => undefined, resetField: () => undefined, save: () => undefined, discard: () => undefined }; }
      dispose() { calls.push("dispose"); }
    } as never,
    createSnapshotStore: <T>(initial: T) => {
      let current = initial;
      return { getSnapshot: () => current, subscribe: () => () => undefined, set: (next: T) => { current = next; } };
    },
    SettingsValueField: "SettingsValueField",
    Switch: "Switch",
    SettingsForm: "SettingsForm",
  };
  return { primitives, calls };
}

describe("ĐỐI CHỨNG bundle gốc — logic thuần", () => {
  test("subagentModelKey: giống bản gốc trên lưới provider/model", async () => {
    const stock = await loadStock(() => ({ parse: () => undefined }));
    const providers = ["openai", "anthropic", "", "a\u0000b", "x/y"];
    const models = ["gpt-5", "claude", "", "m\u0000n", "z"];
    for (const provider of providers) {
      for (const model of models) {
        expect(subagentModelKey({ provider, model })).toBe(stock.subagentModelKey({ provider, model }));
      }
    }
  });

  test("subagentModelCandidates: giống bản gốc trên lưới (danh mục × đã lưu × đang chọn)", async () => {
    const stock = await loadStock(() => ({ parse: () => undefined }));
    const groups: ModelGroup[] = [
      { id: "openai", name: "OpenAI", models: [{ id: "gpt-5", name: "GPT-5" }, { id: "gpt-5-mini", name: "GPT-5 mini" }] },
      { id: "anthropic", name: "Anthropic", models: [{ id: "claude", name: "Claude" }] },
      { id: "empty", name: "Empty", models: [] },
    ];
    const storedSets = [
      [],
      [{ provider: "openai", model: "gpt-5" }],
      [{ provider: "gone", model: "legacy" }],
      [{ provider: "openai", model: "gpt-5" }, { provider: "gone", model: "legacy" }],
    ];
    const selectedSets = [new Set<string>(), new Set([subagentModelKey({ provider: "openai", model: "gpt-5" })]), new Set([subagentModelKey({ provider: "gone", model: "legacy" })])];
    let compared = 0;
    for (const stored of storedSets) {
      for (const selected of selectedSets) {
        const mine = subagentModelCandidates(groups, stored, selected);
        const theirs = stock.subagentModelCandidates(groups, stored, selected);
        expect(JSON.stringify(mine)).toBe(JSON.stringify(theirs));
        compared += 1;
      }
    }
    expect(compared).toBe(12);
  });

  test("sameRoutes: giống bản gốc (kể cả trùng khoá và thứ tự khác)", async () => {
    const stock = await loadStock(() => ({ parse: () => undefined }));
    const cases: { provider: string; model: string }[][] = [
      [],
      [{ provider: "a", model: "1" }],
      [{ provider: "a", model: "1" }, { provider: "b", model: "2" }],
      [{ provider: "b", model: "2" }, { provider: "a", model: "1" }],
      [{ provider: "a", model: "1" }, { provider: "a", model: "1" }],
      [{ provider: "a", model: "1" }, { provider: "b", model: "3" }],
    ];
    for (const left of cases) {
      for (const right of cases) {
        expect(sameRoutes(left, right)).toBe(stock.sameRoutes(left, right));
      }
    }
  });

  test("limitField: luật hợp lệ của trường số giống bản gốc (số nguyên an toàn · ≥ min · không -0)", async () => {
    const numberField = () => ({
      parse: (text: string) => {
        const trimmed = text.trim();
        if (trimmed === "") return undefined;
        const value = Number(trimmed);
        return Number.isNaN(value) ? { kind: "invalid" } : { kind: "set", value };
      },
    });
    const stock = await loadStock(numberField);
    const mine = { primitives: { settingsNumberField: numberField } as unknown as SubagentPrimitives, calls: [] as string[] };
    const texts = ["0", "1", "2", "10", "-0", "-1", "1.5", "abc", "", " 3 ", "9007199254740993", "1e3", "0x10", "Infinity", "NaN"];
    for (const minimum of [0, 1]) {
      const stockField = stock.limitField("maxDepth", minimum);
      const myField = limitField(mine.primitives, "maxDepth", minimum);
      for (const text of texts) {
        expect(JSON.stringify(myField.parse(text))).toBe(JSON.stringify(stockField.parse(text)));
      }
    }
  });

  test("subagentCardShell: giống bản gốc trên lưới cờ của hai khối", async () => {
    const stock = await loadStock(() => ({ parse: () => undefined }));
    const flags = [true, false];
    let compared = 0;
    for (const a1 of flags) for (const w1 of flags) for (const d1 of flags) for (const i1 of flags) for (const s1 of flags) for (const f1 of flags) {
      for (const a2 of flags) for (const d2 of flags) for (const c2 of flags) {
        const limits = { available: a1, writable: w1, dirty: d1, invalid: i1, saving: s1, failed: f1 };
        const models = { available: a2, dirty: d2, conflicted: c2 };
        expect(JSON.stringify(subagentCardShell(limits as never, models as never))).toBe(
          JSON.stringify(stock.subagentCardShell(limits as never, models as never)),
        );
        compared += 1;
      }
    }
    expect(compared).toBe(512);
  });
});
/** Cho các promise đang chờ chạy xong (2 vòng microtask + 1 macrotask). */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("controller — hành vi staged", () => {
  /** Mục cài đặt giả có thể ghi + phát sự kiện. */
  function makeScope(initial: { enabled?: boolean; allowedModels?: { provider: string; model: string }[] }, options: { status?: string; writable?: boolean } = {}) {
    let snapshot = { status: options.status ?? "ready", writable: options.writable ?? true, revision: 1, value: initial };
    const listeners = new Set<() => void>();
    const mutations: unknown[][] = [];
    return {
      mutations,
      set(next: Partial<typeof snapshot>) { snapshot = { ...snapshot, ...next }; for (const listener of listeners) listener(); },
      scope: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
        mutate: (operations: readonly unknown[], revision: number | undefined) => { mutations.push([operations, revision]); return Promise.resolve({ ok: true }); },
      },
    };
  }

  test("thẻ giới hạn: inject phơi hook + bốn action của form", () => {
    const { primitives, calls } = makePrimitives();
    const controller = new SubagentLimitsCardController(makeScope({}).scope as never, primitives);
    const face = controller.inject();
    expect(typeof face.hooks.subagentLimitsCard).toBe("object");
    for (const name of ["edit", "resetField", "save", "discard"]) expect(typeof (face as unknown as Record<string, unknown>)[name]).toBe("function");
    controller.dispose();
    expect(calls).toContain("dispose");
  });

  test("thẻ chọn model: bật công tắc mở bản nháp; chọn model thêm tuyến; bỏ thì xoá", async () => {
    const { primitives } = makePrimitives();
    const fake = makeScope({ enabled: false, allowedModels: [] });
    const catalog: ModelGroup[] = [{ id: "openai", name: "OpenAI", models: [{ id: "gpt-5", name: "GPT-5" }] }];
    const controller = new SubagentModelSelectionCardController(
      fake.scope as never,
      { remote: { session: { modelCatalog: () => Promise.resolve({ ok: true, value: { groups: catalog, failures: [] } }) } } },
      primitives,
    );
    const store = (controller.inject().hooks.subagentModelSelectionCard as { getSnapshot: () => Record<string, unknown> });
    expect(store.getSnapshot().available).toBe(true);
    expect(store.getSnapshot().enabled).toBe(false);
    expect(store.getSnapshot().dirty).toBe(false);
    controller.inject().toggleEnabled();
    expect(store.getSnapshot().enabled).toBe(true);
    expect(store.getSnapshot().dirty).toBe(true);
    // Bật xong thì danh mục tự nạp; phải để nó về ready rồi mới chọn được tuyến.
    await flush();
    expect(store.getSnapshot().catalogStatus).toBe("ready");
    // Chọn một tuyến từ danh mục.
    const key = subagentModelKey({ provider: "openai", model: "gpt-5" });
    controller.inject().toggleModel(key);
    const candidates = store.getSnapshot().candidates as { key: string; selected: boolean }[];
    expect(candidates.find((candidate) => candidate.key === key)?.selected).toBe(true);
    expect((store.getSnapshot().invalid as boolean)).toBe(false);
    controller.inject().toggleModel(key);
    const after = store.getSnapshot().candidates as { key: string; selected: boolean }[];
    expect(after.find((candidate) => candidate.key === key)?.selected).toBe(false);
    // Đang bật mà không chọn gì ⇒ invalid.
    expect(store.getSnapshot().invalid).toBe(true);
    controller.dispose();
  });

  test("thẻ chọn model: bật ⇒ tự nạp danh mục; lỗi ⇒ catalogStatus error; đã gỡ thì bỏ qua kết quả muộn", async () => {
    const { primitives } = makePrimitives();
    const fake = makeScope({ enabled: true, allowedModels: [] });
    let mode: "ok" | "fail" = "ok";
    const groups: ModelGroup[] = [{ id: "p", name: "P", models: [{ id: "m", name: "M" }] }];
    const controller = new SubagentModelSelectionCardController(
      fake.scope as never,
      {
        remote: {
          session: {
            modelCatalog: () =>
              Promise.resolve(mode === "ok" ? { ok: true, value: { groups, failures: [] } } : { ok: false }),
          },
        },
      },
      primitives,
    );
    const store = controller.inject().hooks.subagentModelSelectionCard as { getSnapshot: () => Record<string, unknown> };
    expect(store.getSnapshot().catalogStatus).toBe("loading");
    await flush();
    expect(store.getSnapshot().catalogStatus).toBe("ready");
    expect((store.getSnapshot().candidates as unknown[]).length).toBe(1);
    // Làm mới: trạng thái về idle rồi nạp lại. Đổi chế độ TRƯỚC khi gọi,
    // vì controller gọi modelCatalog() NGAY trong refreshCatalog (đúng như bản gốc).
    mode = "fail";
    controller.refreshCatalog();
    expect(store.getSnapshot().catalogStatus).toBe("loading");
    await flush();
    expect(store.getSnapshot().catalogStatus).toBe("error");
    controller.dispose();
  });

  test("thẻ chọn model: revision đổi ở nơi khác ⇒ xung đột khi bản nháp khác giá trị đã lưu", () => {
    const { primitives } = makePrimitives();
    const fake = makeScope({ enabled: false, allowedModels: [] });
    const controller = new SubagentModelSelectionCardController(
      fake.scope as never,
      { remote: { session: { modelCatalog: () => Promise.resolve({ ok: true, value: { groups: [], failures: [] } }) } } },
      primitives,
    );
    const face = controller.inject();
    const store = face.hooks.subagentModelSelectionCard as { getSnapshot: () => Record<string, unknown> };
    face.toggleEnabled();
    // Tài liệu đổi ở nơi khác với giá trị KHÁC bản nháp ⇒ báo xung đột.
    fake.set({ revision: 2, value: { enabled: false, allowedModels: [{ provider: "x", model: "y" }] } });
    expect(store.getSnapshot().conflicted).toBe(true);
    controller.dispose();
  });
});

describe("thẻ dùng chung — ghép hai khối", () => {
  test("save: chỉ gọi hai khối khi trạng thái chung cho phép; bỏ qua khi invalid/saving/không bẩn", () => {
    const saved: string[] = [];
    const limits = {
      hooks: { subagentLimitsCard: { getSnapshot: () => ({ available: true, writable: true, dirty: true }) } },
      edit: () => undefined,
      resetField: () => undefined,
      save: () => saved.push("limits"),
      discard: () => undefined,
    };
    const models = {
      hooks: { subagentModelSelectionCard: { getSnapshot: () => ({ available: true, writable: true, dirty: true }) } },
      toggleEnabled: () => undefined,
      toggleModel: () => undefined,
      retryCatalog: () => undefined,
      save: () => saved.push("models"),
      discard: () => undefined,
    };
    const face = subagentCardFace(limits as never, models as never);
    expect(Object.keys(face.hooks).sort()).toEqual(["subagentLimitsCard", "subagentModelSelectionCard"]);
    face.save();
    // Model trước, giới hạn sau (đúng thứ tự bản gốc).
    expect(saved).toEqual(["models", "limits"]);
    // Khối không bẩn thì không gọi.
    const clean = subagentCardFace(
      { ...limits, hooks: { subagentLimitsCard: { getSnapshot: () => ({ available: true, writable: true, dirty: false }) } } } as never,
      { ...models, hooks: { subagentModelSelectionCard: { getSnapshot: () => ({ available: true, writable: true, dirty: true }) } } } as never,
    );
    saved.length = 0;
    clean.save();
    expect(saved).toEqual(["models"]);
    // invalid ⇒ không lưu gì.
    const invalid = subagentCardFace(
      { ...limits, hooks: { subagentLimitsCard: { getSnapshot: () => ({ available: true, writable: true, dirty: true, invalid: true }) } } } as never,
      models as never,
    );
    saved.length = 0;
    invalid.save();
    expect(saved).toEqual([]);
  });

  test("discard: gọi cả hai, trừ khi đang lưu", () => {
    const discarded: string[] = [];
    const snapshot = { available: true, writable: true, dirty: true, saving: false };
    const limits = { hooks: { subagentLimitsCard: { getSnapshot: () => snapshot } }, edit: () => undefined, resetField: () => undefined, save: () => undefined, discard: () => discarded.push("limits") };
    const models = { hooks: { subagentModelSelectionCard: { getSnapshot: () => snapshot } }, toggleEnabled: () => undefined, toggleModel: () => undefined, retryCatalog: () => undefined, save: () => undefined, discard: () => discarded.push("models") };
    const face = subagentCardFace(limits as never, models as never);
    face.discard();
    expect(discarded).toEqual(["limits", "models"]);
    const saving = subagentCardFace(
      { ...limits, hooks: { subagentLimitsCard: { getSnapshot: () => ({ ...snapshot, saving: true }) } } } as never,
      models as never,
    );
    discarded.length = 0;
    saving.discard();
    expect(discarded).toEqual([]);
  });
});
/** Element giả: chỉ ghi type/props/key để soi cây. */
interface Element {
  /** Loại element. */
  type: unknown;
  /** Props. */
  props: Record<string, unknown>;
  /** Khoá. */
  key?: unknown;
}

/** jsx giả: KHÔNG render sâu — chỉ dựng cây element. */
function fakeJsx(type: unknown, props: Record<string, unknown>, key?: unknown): Element {
  return { type, props, key };
}

/** Danh sách con của một node: jsx nhận MỘT con, và React DUỖI mảng lồng nhau. */
function listOf(node: Element): unknown[] {
  const flat: unknown[] = [];
  const push = (value: unknown): void => {
    if (Array.isArray(value)) for (const entry of value) push(entry);
    else flat.push(value);
  };
  push(node.props.children);
  return flat;
}

/** Các element con của một node. */
function childrenOf(node: Element): Element[] {
  return listOf(node).filter((child): child is Element => typeof child === "object" && child !== null && "type" in child);
}

/** Tìm element theo loại. */
function elementByType(root: unknown, type: unknown): Element | undefined {
  const found: Element[] = [];
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null || !("type" in node)) return;
    const element = node as Element;
    if (element.type === type) found.push(element);
    for (const child of listOf(element)) walk(child);
  };
  walk(root);
  return found[0];
}

/** Đếm element theo loại. */
function countByType(root: unknown, type: unknown): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null || !("type" in node)) return;
    const element = node as Element;
    if (element.type === type) count += 1;
    for (const child of listOf(element)) walk(child);
  };
  walk(root);
  return count;
}

/** React giả cho ba component của thẻ. */
function makeCardReact() {
  let id = 0;
  return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment", useId: () => { id += 1; return "r" + String(id); } };
}

describe("hai ô giới hạn — cây và luật", () => {
  test("ô độ sâu có bảng giải thích 0/1 và nút trả mặc định; ô song song chỉ có một đoạn trợ giúp", () => {
    const { primitives } = makePrimitives();
    const t = (key: string) => "«" + key + "»";
    const LimitsFields = createLimitsFields(makeCardReact(), primitives);
    const edited: string[] = [];
    const node = (LimitsFields as unknown as (p: Record<string, unknown>) => Element)({
      t,
      state: { writable: true, saving: false, maxDepth: { value: "2" }, maxActiveSubagents: { value: "3" } },
      edit: (field: string, text: string) => edited.push(field + "=" + text),
      resetField: (field: string) => edited.push("reset:" + field),
    });
    const outer = childrenOf(node)[0] as Element;
    expect(outer.props.className).toBe(LIMITS_CLASS.limits);
    const cells = childrenOf(outer);
    expect(cells.length).toBe(2);
    const depth = elementByType(cells[0], "SettingsValueField") as Element;
    expect(depth.props.id).toBe("plugin-config-subagent-depth");
    expect(depth.props.label).toBe("«subagentMaxDepth»");
    expect(depth.props.numeric).toBe(true);
    expect(depth.props.disabled).toBe(false);
    expect((depth.props.value as string)).toBe("2");
    const table = elementByType((depth.props.help as { content: unknown }).content, "table") as Element;
    expect(table.props.className).toBe(LIMITS_CLASS.depthTable);
    expect(countByType(table, "tr")).toBe(2);
    (depth.props.onEdit as (text: string) => void)("5");
    (depth.props.onReset as () => void)();
    expect(edited).toEqual(["maxDepth=5", "reset:maxDepth"]);
    const capacity = elementByType(cells[1], "SettingsValueField") as Element;
    expect(capacity.props.id).toBe("plugin-config-subagent-capacity");
    expect(countByType((capacity.props.help as { content: unknown }).content, "table")).toBe(0);
    // Chỉ đọc hoặc đang lưu ⇒ cả hai ô bị tắt.
    const disabled = (LimitsFields as unknown as (p: Record<string, unknown>) => Element)({ t, state: { writable: false, saving: true }, edit: () => undefined, resetField: () => undefined });
    expect((elementByType(disabled, "SettingsValueField") as Element).props.disabled).toBe(true);
  });
});

describe("ô chọn model — cây và trạng thái", () => {
  test("tắt: chỉ có công tắc + câu gợi ý; không vẽ danh sách", () => {
    const { primitives } = makePrimitives();
    const t = (key: string) => key;
    const Fields = createModelSelectionFields(makeCardReact(), primitives);
    const node = (Fields as unknown as (p: Record<string, unknown>) => Element)({
      t,
      state: { enabled: false, writable: true, saving: false, candidates: [], catalogStatus: "idle" },
      toggleEnabled: () => undefined,
      toggleModel: () => undefined,
      retryCatalog: () => undefined,
    });
    const permission = elementByType(node, "div") as Element;
    expect(permission.props.className).toBe(MODELS_CLASS.permission);
    expect(elementByType(node, "Switch")).toBeDefined();
    expect(countByType(node, "fieldset")).toBe(0);
    expect(elementByType(node, "p")?.props.children).toBe("subagentModelSelectionOff");
  });

  test("bật: nhóm theo nhà cung cấp, nhóm tuyến đã lưu mà không còn trong danh mục, và các câu báo", () => {
    const { primitives } = makePrimitives();
    const t = (key: string) => key;
    const Fields = createModelSelectionFields(makeCardReact(), primitives);
    const candidates = subagentModelCandidates(
      [{ id: "openai", name: "OpenAI", models: [{ id: "gpt-5", name: "GPT-5" }] }],
      [{ provider: "gone", model: "legacy" }],
      new Set([subagentModelKey({ provider: "openai", model: "gpt-5" })]),
    );
    const toggled: string[] = [];
    const node = (Fields as unknown as (p: Record<string, unknown>) => Element)({
      t,
      state: {
        enabled: true,
        writable: true,
        saving: false,
        candidates,
        catalogStatus: "ready",
        catalogPartial: true,
        invalid: true,
        conflicted: true,
      },
      toggleEnabled: () => undefined,
      toggleModel: (key: string) => toggled.push(key),
      retryCatalog: () => undefined,
    });
    const fieldset = elementByType(node, "fieldset") as Element;
    expect(fieldset.props.className).toBe(MODELS_CLASS.models);
    // Danh mục sống nhóm theo provider; tuyến đã lưu mà biến mất nằm ở nhóm riêng.
    const groups = childrenOf(fieldset).filter((child) => child.props.className === MODELS_CLASS.modelGroup);
    expect(groups.length).toBe(2);
    expect(groups[1]?.key).toBe(undefined);
    expect(((childrenOf(groups[1] as Element)[0] as Element).props.children)).toBe("subagentModelSelectionUnavailableGroup");
    const checkbox = elementByType(node, "input") as Element;
    expect(checkbox.props.type).toBe("checkbox");
    (checkbox.props.onChange as () => void)();
    expect(toggled.length).toBe(1);
    expect(elementByType(node, "p")?.props).toBeDefined();
    expect(node.props.children).toBeDefined();
    // Câu báo một phần / bắt buộc / xung đột đều có mặt.
    const texts: string[] = [];
    const collect = (entry: unknown): void => {
      if (typeof entry === "string") { texts.push(entry); return; }
      if (Array.isArray(entry)) { for (const child of entry) collect(child); return; }
      if (typeof entry !== "object" || entry === null || !("props" in entry)) return;
      collect((entry as Element).props.children);
    };
    collect(node);
    for (const key of ["subagentModelSelectionPartial", "subagentModelSelectionRequired", "subagentModelSelectionConflict"]) {
      expect(texts).toContain(key);
    }
  });

  test("đang nạp và lỗi: có câu trạng thái và nút thử lại gọi retryCatalog", () => {
    const { primitives } = makePrimitives();
    const Fields = createModelSelectionFields(makeCardReact(), primitives);
    let retried = 0;
    const node = (Fields as unknown as (p: Record<string, unknown>) => Element)({
      t: (key: string) => key,
      state: { enabled: true, writable: true, saving: false, candidates: [], catalogStatus: "error", catalogPartial: false },
      toggleEnabled: () => undefined,
      toggleModel: () => undefined,
      retryCatalog: () => { retried += 1; },
    });
    const divs: Element[] = [];
    const collectDivs = (entry: unknown): void => {
      if (typeof entry !== "object" || entry === null || !("type" in entry)) return;
      const element = entry as Element;
      if (element.type === "div") divs.push(element);
      for (const child of listOf(element)) collectDivs(child);
    };
    collectDivs(node);
    const alert = divs.find((element) => element.props.role === "alert") as Element;
    expect(alert).toBeDefined();
    expect(alert.props.className).toBe(MODELS_CLASS.catalogError);
    const retry = elementByType(node, "button") as Element;
    (retry.props.onClick as () => void)();
    expect(retried).toBe(1);
    const loading = (Fields as unknown as (p: Record<string, unknown>) => Element)({
      t: (key: string) => key,
      state: { enabled: true, writable: true, saving: false, candidates: [], catalogStatus: "loading" },
      toggleEnabled: () => undefined,
      toggleModel: () => undefined,
      retryCatalog: () => undefined,
    });
    expect(countByType(loading, "fieldset")).toBe(0);
  });
});

describe("thẻ Subagent — khung form và hai khối", () => {
  test("view summary: trả đúng một dòng mô tả", () => {
    const { primitives } = makePrimitives();
    const t = (key: string) => "«" + key + "»";
    const Card = createSubagentCard({
      react: makeCardReact(),
      primitives,
      LimitsFields: (() => "limits") as never,
      ModelSelectionFields: (() => "models") as never,
    });
    const summary = (Card as unknown as (p: Record<string, unknown>) => unknown)({
      view: "summary",
      t,
      useSubagentLimitsCard: () => ({ available: true }),
      useSubagentModelSelectionCard: () => ({ available: true }),
    });
    expect(summary).toBe("«subagentDescription»");
  });

  test("form: khung SettingsForm nhận nhãn từ điển + trạng thái chung; chỉ vẽ khối đang phục vụ", () => {
    const { primitives } = makePrimitives();
    const t = (key: string) => "«" + key + "»";
    /** Component khoi gioi han gia — React KHONG goi no trong test nay, nen tra theo chinh ham. */
    const renderLimits = (props: Record<string, unknown>) => ({ type: "Limits", props });
    const LimitsFields = renderLimits as never;
    const ModelSelectionFields = ((props: Record<string, unknown>) => ({ type: "Models", props })) as never;
    const Card = createSubagentCard({ react: makeCardReact(), primitives, LimitsFields, ModelSelectionFields });
    const node = (Card as unknown as (p: Record<string, unknown>) => Element)({
      t,
      useSubagentLimitsCard: () => ({ available: true, writable: true, dirty: true, maxDepth: { value: "1" } }),
      useSubagentModelSelectionCard: () => ({ available: false, writable: true, dirty: false }),
      editLimit: () => undefined,
      resetLimit: () => undefined,
      toggleEnabled: () => undefined,
      toggleModel: () => undefined,
      retryCatalog: () => undefined,
      save: () => undefined,
      discard: () => undefined,
    });
    expect(node.type).toBe("SettingsForm");
    expect(node.props.labels).toEqual(formLabels(t));
    expect(node.props.state).toEqual({ available: true, writable: true, dirty: true, invalid: false, saving: false, failed: false });
    const sections = childrenOf(node);
    expect(sections.length).toBe(1);
    expect(sections[0]?.props.className).toBe(CARD_CLASS.section);
    const heading = elementByType(sections[0], "h3") as Element;
    expect(heading.props.className).toBe(CARD_CLASS.heading);
    expect(heading.props.children).toBe("«subagentLimitsTitle»");
    expect(String(heading.props.id)).toMatch(/-limits$/);
    expect((sections[0]?.props["aria-labelledby"])).toBe(heading.props.id);
    const fields = elementByType(sections[0], LimitsFields) as Element;
    expect((fields.props.state as Record<string, unknown>).saving).toBe(false);
    expect(fields.props.edit).toBeDefined();
  });
});
describe("TEST CANH — CSS ba module phải TRÙNG NGUYÊN VĂN bản gốc", () => {
  test("bỏ khoảng trắng thì khớp tuyệt đối, và ngoặc cân bằng", async () => {
    const source = await readFile(STOCK, "utf8");
    /** Lấy nguyên văn một chuỗi css trong bundle gốc (quét chuỗi JSON, không dùng regex lồng). */
    const take = (name: string): string => {
      const anchor = "const " + name + " = \"";
      const start = source.indexOf(anchor);
      expect(start).toBeGreaterThan(-1);
      let at = start + anchor.length;
      // Quét tới dấu " chưa bị thoát.
      while (at < source.length) {
        if (source[at] === "\\") { at += 2; continue; }
        if (source[at] === "\"") break;
        at += 1;
      }
      const literal = source.slice(start + anchor.length - 1, at + 1);
      return JSON.parse(literal) as string;
    };
    const pairs: [string, string][] = [
      ["SubagentLimitsFields.module.css", take("css$2")],
      ["SubagentModelSelectionFields.module.css", take("css$1")],
      ["SubagentCard.module.css", take("css")],
    ];
    const squash = (text: string): string => text.split(/\s+/).join("");
    let bytes = 0;
    for (const [file, original] of pairs) {
      const mine = await readFile(join(import.meta.dir, "..", "..", "packages", "client", "ui-settings-subagent", "src", file), "utf8");
      const body = mine.split("*/")[1] ?? "";
      expect(squash(body)).toBe(squash(original));
      expect((body.match(/\{/g) ?? []).length).toBe((body.match(/\}/g) ?? []).length);
      bytes += original.length;
    }
    expect(bytes).toBe(633 + 1898 + 152);
  });

  test("ba bảng tên lớp khớp hash trong CSS gốc", async () => {
    const source = await readFile(STOCK, "utf8");
    for (const [hash, table] of [["hF0LTq_", LIMITS_CLASS], ["UPHdGa_", MODELS_CLASS], ["AZSXYW_", CARD_CLASS]] as [string, Record<string, string>][]) {
      for (const value of Object.values(table)) {
        expect(value.startsWith(hash)).toBe(true);
        expect(source).toContain("." + value);
      }
    }
  });
});

describe("hang rao idempotent — MOT bundle chi cai MOT lan (boolean pham vi module)", () => {
  test("ban module MOI: apply lan dau cai; lan hai (du ctx KHAC) KHONG cai lai", async () => {
    // Nap MOT BAN MODULE MOI de co co `installed = false` sach (co nam o pham vi module).
    const fresh = await import("../../packages/client/ui-settings-subagent/src/plugin.ts?hangrao=" + String(Date.now()));
    const { primitives } = makePrimitives();
    const globals = globalThis as { document?: unknown; window?: unknown };
    const previousDocument = globals.document;
    const previousWindow = globals.window;
    globals.document = { querySelector: () => null, createElement: () => ({ dataset: {}, textContent: "", remove: () => undefined }), head: { appendChild: () => undefined } };
    globals.window = { innerWidth: 1440 };
    try {
      const requireFn = (specifier: string): unknown => {
        if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
        if (specifier === "react") return { useId: () => "r1" };
        if (specifier .endsWith("-client-ui-primitives")) return primitives;
        return { createSnapshotStore: primitives.createSnapshotStore };
      };
      const recorded: string[] = [];
      const makeCtx = () => {
        const scope = {
          getSnapshot: () => ({ status: "ready", writable: true, revision: 1, value: { enabled: false, allowedModels: [] } }),
          subscribe: () => () => undefined,
          mutate: () => Promise.resolve({ ok: true }),
        };
        return {
          effect: (callback: () => unknown, label: string) => { recorded.push(label); void callback; },
          on: () => () => undefined,
          locale: { register: () => () => undefined, bind: () => (key: string) => key },
          remote: { session: { modelCatalog: () => Promise.resolve({ ok: true, value: { groups: [], failures: [] } }) }, $on: () => () => undefined },
          configForms: { get: () => scope, whileServed: () => () => undefined },
          slots: { inject: () => undefined, register: () => undefined },
        };
      };
      const first = (fresh.createPlugin as (r: (s: string) => unknown) => { apply: (c: unknown) => void })(requireFn);
      const ctx = makeCtx();
      first.apply(ctx);
      expect(recorded.length).toBe(7);
      // Lan cai thu hai = dung ca bundle HAI id bi goi factory lan nua ⇒ phai la NO-OP.
      const second = (fresh.createPlugin as (r: (s: string) => unknown) => { apply: (c: unknown) => void })(requireFn);
      // CUNG ctx (dung ca production: bundle hai id goi factory hai lan tren cung ctx) => NO-OP.
      second.apply(ctx);
      expect(recorded.length).toBe(7);
      // LUAT BOOLEAN PHAM VI MODULE (khong khoa theo ctx): hai entry co HAI ctx khac nhau, nen cong phai chan
      // theo bundle, khong theo identity cua ctx. Vi vay ctx KHAC van la NO-OP — day la ca da tra gia that.
      second.apply(makeCtx());
      expect(recorded.length).toBe(7);
    } finally {
      globals.document = previousDocument;
      globals.window = previousWindow;
    }
  });
});

describe("khuon bundle — script classic, MOT id, mot factory", () => {
  test("dang ky DUNG MOT id bang mot factory, khong co cu phap ESM, co du ba CSS", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-subagent-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((match) => JSON.parse(match[1] as string) as string);
    expect(ids).toEqual(["@galaxy-blackhole/gbh-client-ui-settings-subagent"]);
    // MOT id: id goc chi nam o gbh.row.aliases. Hai id => bundle chay hai lan => duplicate factory registration
    // => app trang (su co that 17/10/2026).
    expect(ids).not.toContain("@deepseek-ai/dsh-client-ui-settings-subagent");
    const factories = [...code.matchAll(/factory: (\w+)/g)].map((match) => match[1]);
    expect(new Set(factories).size).toBe(1);
    expect(/^\s*(export|import)\s/m.test(code)).toBe(false);
    for (const hash of ["hF0LTq_", "UPHdGa_", "AZSXYW_"]) expect(code).toContain(hash);
  });

  test("chạy bundle trong window giả: mặt plugin đúng tên, ĐÚNG NĂM seam, bốn specifier đúng thứ tự", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-subagent-"));
    const built = await buildPackage(out);
    const code = await readFile(built.client, "utf8");
    const registrations: { factory: (require: (s: string) => unknown) => { name: string; inject: readonly string[] } }[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: never) => registrations.push(registration) } });
    const required: string[] = [];
    const plugin = registrations[0]?.factory((specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
      required.push(specifier);
      if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
      if (specifier === "react") return { useId: () => "r1" };
      if (specifier .endsWith("-client-ui-primitives")) return makePrimitives().primitives;
      return { createSnapshotStore: makePrimitives().primitives.createSnapshotStore };
    });
    expect(plugin?.name).toBe("@galaxy-blackhole/gbh-client-ui-settings-subagent");
    expect(plugin?.inject).toEqual(["slots", "locale", "remote", "remote.session", "configForms"]);
    expect(required).toEqual([
      "react/jsx-runtime",
      "react",
      "@deepseek-ai/dsh-client-ui-primitives",
      "@deepseek-ai/dsh-client-store",
    ]);
  });
});

describe("apply — nối dây đúng thứ tự bản gốc", () => {
  test("bảy hiệu ứng đúng nhãn; hai bản dịch; bốn hiệu ứng vô hiệu hoá; ô plugins.item đúng id/order/locale", () => {
    const { primitives } = makePrimitives();
    const record = {
      effects: [] as { label: string; cleanup?: () => void }[],
      dictionaries: [] as string[],
      bound: [] as string[],
      remoteEvents: [] as string[],
      ctxEvents: [] as string[],
      whileServed: [] as string[][],
      injections: [] as string[],
      registrations: [] as Record<string, unknown>[],
    };
    /** Chạy callback của hiệu ứng NGAY như cordis thật, và ghi hàm dọn. */
    const effect = (callback: () => unknown, label: string): void => {
      const cleanup = callback();
      record.effects.push({ label, cleanup: typeof cleanup === "function" ? (cleanup as () => void) : undefined });
    };
    const scopes: Record<string, unknown> = {};
    const ctx = {
      effect,
      on: (event: string, listener: () => void) => {
        record.ctxEvents.push(event);
        void listener;
        return () => undefined;
      },
      locale: {
        register: (ns: string) => { record.dictionaries.push(ns); return () => undefined; },
        bind: (ns: string) => { record.bound.push(ns); return (key: string) => "«" + key + "»"; },
      },
      remote: {
        session: { modelCatalog: () => Promise.resolve({ ok: true, value: { groups: [], failures: [] } }) },
        $on: (event: string) => { record.remoteEvents.push(event); return () => undefined; },
      },
      configForms: {
        get: (ns: string) => {
          scopes[ns] = scopes[ns] ?? {
            getSnapshot: () => ({ status: "ready", writable: true, revision: 1, value: { enabled: false, allowedModels: [] } }),
            subscribe: () => () => undefined,
            mutate: () => Promise.resolve({ ok: true }),
          };
          return scopes[ns];
        },
        whileServed: (namespaces: string[], run: () => void) => { record.whileServed.push([...namespaces]); run(); return () => undefined; },
      },
      slots: {
        inject: (name: string, register: () => void) => { record.injections.push(name); register(); },
        register: (options: Record<string, unknown>) => { record.registrations.push(options); },
      },
    };
    const globals = globalThis as { document?: unknown; window?: unknown };
    const previousDocument = globals.document;
    const previousWindow = globals.window;
    globals.document = { querySelector: () => null, createElement: () => ({ dataset: {}, textContent: "", remove: () => undefined }), head: { appendChild: () => undefined } };
    globals.window = { innerWidth: 1440 };
    try {
      const plugin = createPlugin((specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
        if (specifier === "react/jsx-runtime") return { jsx: fakeJsx, jsxs: fakeJsx, Fragment: "Fragment" };
        if (specifier === "react") return { useId: () => "r1" };
        if (specifier .endsWith("-client-ui-primitives")) return primitives;
        return { createSnapshotStore: primitives.createSnapshotStore };
      });
      (plugin.apply as unknown as (c: unknown) => void)(ctx);
      expect(record.effects.map((entry) => entry.label)).toEqual([
        "ui-settings-subagent: dictionaries",
        "ui-settings-subagent: limits form subscription",
        "ui-settings-subagent: adapter invalidations",
        "ui-settings-subagent: settings invalidations",
        "ui-settings-subagent: connection generation",
        "ui-settings-subagent: model preference",
        "ui-settings-subagent: page",
      ]);
      expect(record.dictionaries).toEqual([NS]);
      expect(record.bound).toEqual([NS]);
      expect(record.remoteEvents).toEqual(["llm/adapters-updated", "settings/document-updated"]);
      expect(record.ctxEvents).toEqual(["connection/reset"]);
      expect(record.whileServed).toEqual([[SUBAGENT_NS, SUBAGENT_MODEL_SELECTION_NS]]);
      expect(record.injections).toEqual(["plugins.item"]);
      const options = record.registrations[0] ?? {};
      expect(options.name).toBe("plugins.item");
      expect(options.id).toBe(SLOT.id);
      expect(options.order).toBe(10);
      expect(options.locale).toBe(NS);
      expect((options.label as () => string)()).toBe("«subagentTitle»");
      const face = (options.inject as () => Record<string, unknown>)();
      expect(Object.keys(face.hooks as Record<string, unknown>).sort()).toEqual(["subagentLimitsCard", "subagentModelSelectionCard"]);
      for (const name of ["editLimit", "resetLimit", "toggleEnabled", "toggleModel", "retryCatalog", "save", "discard"]) {
        expect(typeof face[name]).toBe("function");
      }
      // CẢ BẢY hiệu ứng đều trả hàm dọn (locale · $on ×2 · on · hai ghế · whileServed).
      const cleanups = record.effects.filter((entry) => entry.cleanup !== undefined);
      expect(cleanups.length).toBe(7);
      for (const entry of cleanups) entry.cleanup?.();
    } finally {
      globals.document = previousDocument;
      globals.window = previousWindow;
    }
  });
});
