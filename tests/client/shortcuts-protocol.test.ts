/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc A/B protocol phim vat ly cua row shortcuts: so TUNG HAM voi chinh lib/protocol.js cua ban goc
 *      (goc la file ESM rieng, import duoc truc tiep trong Bun — oracle manh nhat cho tang nay)
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/** Protocol GỐC (CHỈ ĐỌC) và protocol của ta. */
const STOCK_PROTOCOL = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-client-shortcuts/lib/protocol.js");
const OUR_PROTOCOL = join(REPO, "packages/client/shortcuts/src/protocol.ts");

/** Một bên protocol. */
type ProtocolSide = Record<string, unknown>;

/**
 * Nạp cả hai bên.
 * Nhận: không.
 * Trả: hai bề mặt protocol.
 */
async function bothSides(): Promise<{ ours: ProtocolSide; stock: ProtocolSide }> {
  return {
    ours: (await import(OUR_PROTOCOL)) as ProtocolSide,
    stock: (await import(STOCK_PROTOCOL)) as ProtocolSide,
  };
}

/**
 * Gọi một hàm và gói kết quả (giá trị hoặc thông báo lỗi) để so được hai bên.
 * Nhận: `fn` — hàm, `args` — tham số.
 * Trả: `{ ok, value }` hoặc `{ ok: false, error }`.
 */
function call(fn: unknown, ...args: unknown[]): unknown {
  try {
    return { ok: true, value: (fn as (...input: unknown[]) => unknown)(...args) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** Binding đem thử ở mọi hàm. */
const BINDINGS: unknown[] = [
  { code: "KeyK", modifiers: ["primary"] },
  { code: "KeyK", modifiers: ["primary", "shift"] },
  { code: "KeyK", modifiers: ["shift"] },
  { code: "KeyK", modifiers: [] },
  { code: "Slash", modifiers: ["primary"] },
  { code: "Comma", modifiers: ["primary", "shift"] },
  { code: "Period", modifiers: ["primary", "shift"] },
  { code: "Backquote", modifiers: ["control"] },
  { code: "Backslash", modifiers: ["meta"] },
  { code: "Digit1", modifiers: ["primary", "alt"] },
  { code: "F4", modifiers: ["alt"] },
  { code: "KeyA", modifiers: ["primary"] },
  { code: "KeyC", modifiers: ["primary"] },
  { code: "Escape", modifiers: ["primary"] },
  { code: "Enter", modifiers: ["alt"] },
  { code: "Enter", modifiers: ["primary"] },
  { code: "Space", modifiers: ["primary"] },
  { code: "KeyJ", secondCode: "KeyK", modifiers: ["primary"] },
  { code: "KeyK", secondCode: "KeyJ", modifiers: ["primary"] },
  { code: "KeyK", secondCode: "KeyK", modifiers: ["primary"] },
  { code: "KeyЖ", modifiers: ["primary"] },
  { code: "KeyK", modifiers: ["hyper"] },
  { code: "KeyK", modifiers: ["primary"], extra: 1 },
  { code: "KeyK", modifiers: ["primary", "primary"] },
  { code: 5, modifiers: ["primary"] },
  null,
];

/** Ba hệ điều hành và hai vỏ ứng dụng. */
const PLATFORMS = ["macos", "windows", "linux"] as const;
const RUNTIMES = ["desktop", "web"] as const;

describe("row shortcuts — protocol A/B với lib/protocol.js gốc", () => {
  test("ca 1: normalizeBinding · bindingKey · presentBinding · isWebBindingAllowed", async () => {
    const { ours, stock } = await bothSides();
    for (const binding of BINDINGS) {
      for (const platform of PLATFORMS) {
        expect(call(ours.normalizeBinding, binding, platform)).toEqual(call(stock.normalizeBinding, binding, platform));
      }
    }
    for (const platform of PLATFORMS) {
      const normalized = (stock.normalizeBinding as (b: unknown, p: string) => unknown)(
        { code: "KeyJ", secondCode: "KeyK", modifiers: ["primary"] },
        platform,
      );
      expect(call(ours.bindingKey, normalized)).toEqual(call(stock.bindingKey, normalized));
      expect(call(ours.presentBinding, normalized, platform)).toEqual(call(stock.presentBinding, normalized, platform));
      expect(call(ours.presentBinding, null, platform)).toEqual(call(stock.presentBinding, null, platform));
      for (const binding of BINDINGS) {
        const candidate = call(stock.normalizeBinding, binding, platform) as { ok: boolean; value?: unknown };
        if (!candidate.ok) continue;
        expect(call(ours.isWebBindingAllowed, candidate.value, platform)).toEqual(
          call(stock.isWebBindingAllowed, candidate.value, platform),
        );
      }
    }
  });

  test("ca 2: bindingIssue — ma trận mã phím × phím bổ trợ × vỏ × thiết bị", async () => {
    const { ours, stock } = await bothSides();
    const codes = [
      "KeyA", "KeyC", "KeyV", "KeyX", "KeyZ", "KeyY", "KeyQ", "KeyH", "KeyK", "Digit1",
      "F1", "F2", "F4", "Slash", "Comma", "Period", "Backquote", "Backslash", "BracketLeft",
      "Enter", "Escape", "Tab", "Space", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    ];
    const modifierSets: string[][] = [
      [], ["shift"], ["control"], ["alt"], ["meta"], ["primary"],
      ["control", "alt"], ["control", "shift"], ["meta", "alt"], ["meta", "shift"],
      ["control", "alt", "shift"], ["meta", "alt", "shift"], ["control", "alt", "shift", "meta"],
    ];
    let compared = 0;
    for (const code of codes) {
      for (const modifiers of modifierSets) {
        for (const platform of PLATFORMS) {
          for (const runtime of RUNTIMES) {
            const normalized = {
              code,
              modifiers: modifiers.map((m) => (m === "primary" ? (platform === "macos" ? "meta" : "control") : m)),
            };
            expect(call(ours.bindingIssue, normalized, runtime, platform)).toEqual(
              call(stock.bindingIssue, normalized, runtime, platform),
            );
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(codes.length * modifierSets.length * PLATFORMS.length * RUNTIMES.length);
  });

  test("ca 3: parseBinding + parseShortcutDocument (mọi nhánh hỏng)", async () => {
    const { ours, stock } = await bothSides();
    for (const binding of BINDINGS) {
      expect(call(ours.parseBinding, binding)).toEqual(call(stock.parseBinding, binding));
    }
    const chord = { code: "KeyS", secondCode: "KeyK", modifiers: ["primary"] };
    const documents: (string | null)[] = [
      null, "", "not json", "[]", "{}",
      JSON.stringify({ schemaVersion: 1, profiles: {} }),
      JSON.stringify({ schemaVersion: 2, profiles: {} }),
      JSON.stringify({ schemaVersion: 3, profiles: {} }),
      JSON.stringify({ schemaVersion: "1", profiles: {} }),
      JSON.stringify({ schemaVersion: 1, profiles: {}, extra: true }),
      JSON.stringify({ schemaVersion: 1, profiles: { "web:macos": { "app.save": { code: "KeyS", modifiers: ["primary"] } } } }),
      JSON.stringify({ schemaVersion: 1, profiles: { "web:macos": { "app.save": null } } }),
      JSON.stringify({ schemaVersion: 1, profiles: { "web:unknown": {} } }),
      JSON.stringify({ schemaVersion: 1, profiles: { "web:macos": { BadId: null } } }),
      JSON.stringify({ schemaVersion: 1, profiles: { "web:macos": { "app.save": chord } } }),
      JSON.stringify({ schemaVersion: 2, profiles: { "web:macos": { "app.save": chord } } }),
      JSON.stringify({ schemaVersion: 2, profiles: { "desktop:windows": { "app.save": { code: "KeyS", modifiers: ["primary"] } }, "web:linux": { "app.close": null } } }),
      JSON.stringify({ schemaVersion: 1, profiles: { "web:macos": { "app.save": { code: "KeyS", modifiers: ["primary"], junk: 1 } } } }),
    ];
    for (const raw of documents) {
      expect(call(ours.parseShortcutDocument, raw)).toEqual(call(stock.parseShortcutDocument, raw));
    }
  });

  test("ca 4: effectiveShortcuts + resolveShortcutDefault + overlappingBindings", async () => {
    const { ours, stock } = await bothSides();
    const definitions = [
      { id: "app.save", defaults: { "web:macos": { code: "KeyS", modifiers: ["primary"] }, "desktop:windows": { code: "KeyS", modifiers: ["control"] } } },
      { id: "app.close", defaults: { "web:macos": { code: "KeyW", modifiers: ["primary"] } } },
      { id: "app.palette", defaults: { "web:macos": { code: "KeyK", modifiers: ["primary"] } } },
      { id: "input.stop", fixed: [{ code: "Escape", modifiers: [] }] },
      { id: "app.chord", defaults: { "web:macos": { code: "KeyJ", secondCode: "KeyK", modifiers: ["primary"] } } },
    ];
    const documents = [
      { schemaVersion: 1 as const, profiles: {} },
      { schemaVersion: 1 as const, profiles: { "web:macos": { "app.save": { code: "KeyK", modifiers: ["primary"] as const } } } },
      { schemaVersion: 2 as const, profiles: { "web:macos": { "app.save": null, "app.chord": { code: "KeyJ", secondCode: "KeyK", modifiers: ["primary"] as const } } } },
      { schemaVersion: 1 as const, profiles: { "desktop:linux": { "app.save": { code: "KeyS", modifiers: ["primary"] as const } } } },
    ];
    for (const document of documents) {
      for (const runtime of RUNTIMES) {
        for (const platform of PLATFORMS) {
          expect(call(ours.effectiveShortcuts, definitions, document, runtime, platform)).toEqual(
            call(stock.effectiveShortcuts, definitions, document, runtime, platform),
          );
        }
      }
    }
    for (const definition of definitions) {
      for (const runtime of RUNTIMES) {
        for (const platform of PLATFORMS) {
          expect(call(ours.resolveShortcutDefault, definition, runtime, platform)).toEqual(
            call(stock.resolveShortcutDefault, definition, runtime, platform),
          );
        }
      }
    }
    const pairs: [unknown, unknown][] = [
      [{ code: "KeyK", modifiers: ["meta"] }, { code: "KeyK", modifiers: ["meta"] }],
      [{ code: "KeyK", modifiers: ["meta"] }, { code: "KeyJ", modifiers: ["meta"] }],
      [{ code: "KeyK", modifiers: ["meta"] }, { code: "KeyK", modifiers: ["alt"] }],
      [{ code: "KeyJ", secondCode: "KeyK", modifiers: ["meta"] }, { code: "KeyK", modifiers: ["meta"] }],
      [{ code: "KeyJ", secondCode: "KeyK", modifiers: ["meta"] }, { code: "KeyJ", secondCode: "KeyK", modifiers: ["meta"] }],
      [{ code: "KeyJ", secondCode: "KeyK", modifiers: ["meta"] }, { code: "KeyK", secondCode: "KeyL", modifiers: ["meta"] }],
    ];
    for (const [left, right] of pairs) {
      expect(call(ours.overlappingBindings, left, right)).toEqual(call(stock.overlappingBindings, left, right));
    }
  });

  test("ca 5: parseShortcutEdit + parseShortcutDefinitions + editShortcutDocument", async () => {
    const { ours, stock } = await bothSides();
    const edits: unknown[] = [
      { type: "reset-all" },
      { type: "reset-all", id: "app.save" },
      { type: "reset", id: "app.save" },
      { type: "reset", id: "BadId" },
      { type: "set", id: "app.save", binding: { code: "KeyS", modifiers: ["primary"] } },
      { type: "set", id: "app.save", binding: null },
      { type: "set", id: "app.save" },
      { type: "set", id: "app.save", binding: { code: "KeyS", modifiers: ["primary"] }, extra: 1 },
      { type: "nope", id: "app.save" },
      null,
      "reset-all",
    ];
    for (const edit of edits) {
      expect(call(ours.parseShortcutEdit, edit)).toEqual(call(stock.parseShortcutEdit, edit));
    }
    const save = { code: "KeyS", modifiers: ["primary"] };
    const catalogs: unknown[] = [
      [],
      [{ id: "app.save", defaults: { "web:macos": save } }],
      [{ id: "app.save", defaults: {} }, { id: "app.close", defaults: {} }],
      [{ id: "app.save", defaults: {} }, { id: "app.save", defaults: {} }],
      [{ id: "app.save", defaults: { "web:macos": save }, fixed: [save] }],
      [{ id: "app.save", defaults: { "web:macos": { code: "Escape", modifiers: ["primary"] } } }],
      [{ id: "app.save", defaults: { "web:macos": { code: "KeyK", modifiers: ["primary"] } } }, { id: "app.palette", defaults: { "web:macos": { code: "KeyK", modifiers: ["primary"] } } }],
      [{ id: "app.stop", defaults: {}, fixed: [{ code: "Escape", modifiers: [] }] }],
      [{ id: "app.save", defaults: { "web:bad": {} } }],
      [{ id: "app.save" }],
      "nope",
    ];
    for (const catalog of catalogs) {
      expect(call(ours.parseShortcutDefinitions, catalog)).toEqual(call(stock.parseShortcutDefinitions, catalog));
    }
    const raws: (string | null)[] = [
      null,
      JSON.stringify({ schemaVersion: 2, profiles: { "web:macos": { "app.save": save } } }),
      JSON.stringify({ schemaVersion: 1, profiles: { "desktop:macos": { "app.close": save } } }),
    ];
    for (const raw of raws) {
      const stockDocument = (stock.parseShortcutDocument as (r: string | null) => unknown)(raw);
      for (const edit of [{ type: "set", id: "app.save", binding: null }, { type: "reset", id: "app.save" }, { type: "reset-all" }]) {
        for (const runtime of RUNTIMES) {
          for (const platform of PLATFORMS) {
            expect(call(ours.editShortcutDocument, stockDocument, edit, runtime, platform)).toEqual(
              call(stock.editShortcutDocument, stockDocument, edit, runtime, platform),
            );
          }
        }
      }
    }
  });

  test("ca 6: initialShortcutConfig + ShortcutPersistence — cùng chuỗi hành vi trên kho giả", async () => {
    const { ours, stock } = await bothSides();
    const mineInitial = (ours.initialShortcutConfig as () => Record<string, unknown>)();
    const theirInitial = (stock.initialShortcutConfig as () => Record<string, unknown>)();
    expect({ ...mineInitial, revision: "R" }).toEqual({ ...theirInitial, revision: "R" });

    const makeStorage = (initial: string | null, failWrite = false) => {
      const written: string[] = [];
      let readError = false;
      return {
        written,
        failRead: () => {
          readError = true;
        },
        read: () => {
          if (readError) throw new Error("read boom");
          return initial;
        },
        write: (raw: string) => {
          if (failWrite) throw new Error("write boom");
          written.push(raw);
        },
      };
    };
    const definitions = [{ id: "app.save", defaults: { "web:macos": { code: "KeyS", modifiers: ["primary"] } } }];
    /**
     * Thay mọi `revision` bằng một hằng số: hai bên sinh UUID NGẪU NHIÊN nên chỉ so được phần còn lại.
     * Nhận: `value` — giá trị bất kỳ.
     * Trả: bản sao sâu với `revision` đã chuẩn hoá.
     */
    /**
     * Lay ban chup tu ket qua edit (kieu khai la Record<string, unknown> nen phai thu hep tuong minh).
     * Nhan: result - ket qua cua edit.
     * Tra: ban chup da thu hep kieu.
     */
    const snapshotOf = (result: Record<string, unknown>): Record<string, unknown> =>
      result["snapshot"] as Record<string, unknown>;
    const normalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map((item) => normalize(item));
      if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
          out[key] = key === "revision" ? "R" : normalize(item);
        }
        return out;
      }
      return value;
    };
    const drive = async (Persistence: unknown, storage: ReturnType<typeof makeStorage>, reread: boolean) => {
      const published: Record<string, unknown>[] = [];
      const owner = new (Persistence as new (...args: unknown[]) => Record<string, unknown>)(
        storage,
        "web",
        "macos",
        reread,
        (snapshot: Record<string, unknown>) => published.push({ ...snapshot, revision: "R" }),
      );
      (owner.setDefinitions as (d: unknown) => void)(definitions);
      const first = await (owner.readCurrent as () => Promise<Record<string, unknown>>)();
      const editResult = await (owner.edit as (e: unknown, r: unknown) => Promise<Record<string, unknown>>)(
        { type: "set", id: "app.save", binding: { code: "KeyK", modifiers: ["primary"] } },
        first.revision,
      );
      const stale = await (owner.edit as (e: unknown, r: unknown) => Promise<Record<string, unknown>>)({ type: "reset-all" }, "not-the-revision");
      const unknownCommand = await (owner.edit as (e: unknown, r: unknown) => Promise<Record<string, unknown>>)(
        { type: "set", id: "app.nope", binding: null },
        snapshotOf(editResult).revision,
      );
      const conflict = await (owner.edit as (e: unknown, r: unknown) => Promise<Record<string, unknown>>)(
        { type: "set", id: "app.save", binding: { code: "Escape", modifiers: ["primary"] } },
        snapshotOf(editResult).revision,
      );
      (owner.dispose as () => void)();
      const afterDispose = await (owner.edit as (e: unknown, r: unknown) => Promise<Record<string, unknown>>)(
        { type: "reset-all" },
        snapshotOf(conflict).revision,
      );
      return {
        first: { ...first, revision: "R" },
        edit: { ...editResult, snapshot: { ...snapshotOf(editResult), revision: "R" } },
        stale,
        unknownCommand,
        conflict: { ...conflict, snapshot: { ...snapshotOf(conflict), revision: "R" } },
        afterDispose,
        published,
        written: storage.written,
      };
    };
    const cases: [string | null, boolean][] = [
      [null, false],
      ["not json", false],
      [JSON.stringify({ schemaVersion: 9, profiles: {} }), true],
      [JSON.stringify({ schemaVersion: 1, profiles: { "web:macos": { "app.save": { code: "KeyJ", modifiers: ["primary"] } } } }), true],
    ];
    for (const [initial, reread] of cases) {
      expect(normalize(await drive(ours.ShortcutPersistence, makeStorage(initial), reread))).toEqual(
        normalize(await drive(stock.ShortcutPersistence, makeStorage(initial), reread)),
      );
    }
    const mineRead = makeStorage(null);
    mineRead.failRead();
    const theirsRead = makeStorage(null);
    theirsRead.failRead();
    expect(normalize(await drive(ours.ShortcutPersistence, mineRead, false))).toEqual(
      normalize(await drive(stock.ShortcutPersistence, theirsRead, false)),
    );
    expect(normalize(await drive(ours.ShortcutPersistence, makeStorage(null, true), false))).toEqual(
      normalize(await drive(stock.ShortcutPersistence, makeStorage(null, true), false)),
    );
  });
});
