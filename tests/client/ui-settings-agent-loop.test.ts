/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-settings-agent-loop (row ui-settings-agent-loop)
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/client/ui-settings-agent-loop/build.ts";
import {
  AGENT_LOOP_NAMESPACE,
  PACKAGE_NAME,
  PARALLEL_FIELD_ID,
  SLOT_OCCUPANT_ID,
  SLOT_ORDER,
  STOCK_PACKAGE_NAME,
} from "../../packages/client/ui-settings-agent-loop/src/ids.ts";
import { NS, en, zh, type LocaleKey } from "../../packages/client/ui-settings-agent-loop/src/locales.ts";
import type { ClientPlugin, RequireFn } from "../../packages/client/ui-settings-agent-loop/src/plugin.ts";

/** Một lời gọi `window.__ModuleLoader__.load` mà bundle thật đã phát ra. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười; chỉ chạy khi vạt chất hoá. */
  factory: (require: RequireFn) => unknown;
}

/** Mười hai khoá copy của trang — đọc lại từ bản gốc để test là bản đối chiếu độc lập. */
const LOCALE_KEYS: LocaleKey[] = [
  "title",
  "description",
  "maxParallel",
  "maxParallelHint",
  "overridden",
  "reset",
  "readOnly",
  "unavailable",
  "save",
  "saving",
  "saveFailed",
  "invalidNumber",
];

/** Tên slot mà trang phải đăng ký vào — chép lại từ bản gốc, KHÔNG lấy từ hằng của gói. */
const SLOT_NAME = "plugins.item";

/** Chuỗi tiếng Anh phải khớp từng ký tự (ma trận ảnh A/B so cả chữ). */
const EN_TITLE = "Agent loop";
/** Chuỗi tiếng Trung phải khớp từng ký tự. */
const ZH_TITLE = "Agent 循环";

/** Bản build thật, chỉ chạy một lần cho cả file test. */
let built: Promise<{ host: string; client: string }> | undefined;

/**
 * Build package vào thư mục tạm (một lần cho cả file).
 * Nhận: không.
 * Trả: đường dẫn hai nửa đã build.
 */
function buildOnce(): Promise<{ host: string; client: string }> {
  built ??= mkdtemp(join(tmpdir(), "gbh-ui-settings-agent-loop-")).then((out) => buildPackage(out));
  return built;
}

/**
 * Nạp bundle client thật trong một `window` giả và gom các lời gọi đăng ký.
 * Nhận: mã nguồn `lib/client.js`.
 * Trả: danh sách đăng ký theo đúng thứ tự script phát ra.
 */
function loadBundle(code: string): Registration[] {
  const calls: Registration[] = [];
  new Function("window", code)({ __ModuleLoader__: { load: (registration: Registration) => calls.push(registration) } });
  return calls;
}

/** Dấu vết của một lần render: props renderer nhận, và props ô nhập nhận. */
interface RenderRecord {
  /** Props của khung form dùng chung. */
  formProps?: Record<string, unknown>;
  /** Props của ô nhập số. */
  fieldProps?: Record<string, unknown>;
}

/** Bản thay thế ui-primitives: đủ để trang chạy và ghi lại đường dây nó nối. */
interface PrimitivesStub {
  /** Khung form dùng chung (ghi lại props). */
  SettingsForm: unknown;
  /** Ô nhập giá trị dùng chung (ghi lại props). */
  SettingsValueField: unknown;
  /** Mô hình form staged. */
  SettingsFormModel: new (scope: unknown, fields: unknown[]) => unknown;
  /** Khai trường số. */
  settingsNumberField: (name: string) => unknown;
  /** Dấu vết để test khẳng định. */
  record: Record<string, unknown>;
}

/**
 * Dựng bản thay thế ui-primitives.
 * Nhận: bản ghi để test đọc lại.
 * Trả: bề mặt `PrimitivesModule` tối thiểu.
 */
function makePrimitives(record: Record<string, unknown>): PrimitivesStub {
  class StubFormModel {
    /**
     * @param scope - scope cài đặt đã bind.
     * @param fields - danh sách trường đã khai.
     */
    constructor(scope: unknown, fields: unknown[]) {
      record.scope = scope;
      record.fields = fields;
    }
    /**
     * Theo dõi ảnh chụp form.
     * Nhận: hàm chiếu ảnh chụp.
     * Trả: store giả có `getSnapshot`.
     */
    bind(projection: () => Record<string, unknown>): Record<string, unknown> {
      record.projection = projection;
      const store = { getSnapshot: projection };
      record.store = store;
      return store;
    }
    /** Vỏ form dùng chung (đọc/ghi + lần lưu gần nhất). */
    shell(): Record<string, unknown> {
      return { writable: true, dirty: false, saving: false };
    }
    /** Trạng thái một trường đã khai. */
    field(name: string): Record<string, unknown> {
      return { value: "3", overridden: false, name };
    }
    /** Bộ hành động của form. */
    actions(): Record<string, unknown> {
      return {
        save: (...args: unknown[]) => ["save", ...args],
        discard: (...args: unknown[]) => ["discard", ...args],
        edit: (field: string, text: string) => ["edit", field, text],
        resetField: (field: string) => ["resetField", field],
      };
    }
    /** Giải phóng đăng ký. */
    dispose(): void {
      record.disposed = Number(record.disposed ?? 0) + 1;
    }
  }
  return {
    record,
    SettingsForm: (props: Record<string, unknown>) => {
      record.formProps = props;
      return { type: "SettingsForm", props };
    },
    SettingsValueField: (props: Record<string, unknown>) => {
      record.fieldProps = props;
      return { type: "SettingsValueField", props };
    },
    SettingsFormModel: StubFormModel,
    settingsNumberField: (name: string) => ({ field: name }),
  };
}

/** Dấu vết một lần `apply` chạy trên context giả. */
interface ContextRecord {
  /** Các hiệu ứng vòng đời đã đăng ký: thân đã chạy, kèm nhãn và hàm dọn dẹp nó trả về. */
  effects: { label: string | undefined; dispose: unknown }[];
  /** Namespace đã bind để đọc từ điển. */
  bound: string[];
  /** Từ điển đã đăng ký. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Namespace đã xin scope cài đặt. */
  scopes: string[];
  /** Cặp namespace mà trang chờ Host phục vụ. */
  servedWatch: string[][];
  /** Slot đã xin chỗ. */
  injected: string[];
  /** Occupant đã đăng ký. */
  occupants: { definition: Record<string, unknown>; component: unknown }[];
}

/**
 * Dựng context phía browser tối thiểu.
 * Nhận: `served` = Host có phục vụ namespace không, `slotPresent` = slot đã có người phục vụ chưa,
 * và bản ghi để test đọc lại.
 * Trả: context giả truyền cho `apply`.
 */
function makeContext(options: { served: boolean; slotPresent: boolean; record: ContextRecord }) {
  const { record } = options;
  return {
    effect(callback: () => unknown, label?: string): void {
      // cordis chạy thân hiệu ứng NGAY khi đăng ký và giữ hàm dọn dẹp nó trả về.
      record.effects.push({ label, dispose: callback() });
    },
    locale: {
      bind(namespace: string): (key: LocaleKey) => string {
        record.bound.push(namespace);
        return (key: LocaleKey) => en[key] ?? String(key);
      },
      register(namespace: string, copy: Record<string, Record<string, string>>): () => void {
        record.dictionaries.push({ namespace, copy });
        return () => undefined;
      },
    },
    slots: {
      register(definition: Record<string, unknown>, component: unknown): () => void {
        record.occupants.push({ definition, component });
        return () => undefined;
      },
      inject(slot: string, register: () => unknown): void {
        record.injected.push(slot);
        if (options.slotPresent) register();
      },
    },
    configForms: {
      get(namespace: string): unknown {
        record.scopes.push(namespace);
        return { namespace };
      },
      whileServed(namespaces: readonly string[], register: () => unknown): void {
        record.servedWatch.push([...namespaces]);
        if (options.served) register();
      },
    },
  };
}

/** Bản ghi rỗng cho một lần `apply`. */
function emptyRecord(): ContextRecord {
  return { effects: [], bound: [], dictionaries: [], scopes: [], servedWatch: [], injected: [], occupants: [] };
}

/**
 * Vạt chất hoá bundle thật thành mặt plugin, có ghi lại các specifier đã require.
 * Nhận: hàm build đã có, và bản ghi primitives.
 * Trả: plugin, danh sách specifier đã require, và bề mặt ui-primitives giả đã cấp.
 */
async function materialize(
  record: Record<string, unknown>,
): Promise<{ plugin: ClientPlugin; required: string[]; primitives: PrimitivesStub }> {
  const out = await buildOnce();
  const code = await readFile(out.client, "utf8");
  const registration = loadBundle(code)[0];
  expect(registration).toBeDefined();
  const primitives = makePrimitives(record);
  const required: string[] = [];
  const requireFn: RequireFn = (specifier) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    required.push(specifier);
    if (specifier === "react/jsx-runtime") {
      return { jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }) };
    }
    if (specifier .endsWith("-client-ui-primitives")) return primitives;
    throw new Error("khong duoc require " + specifier);
  };
  return { plugin: registration?.factory(requireFn) as ClientPlugin, required, primitives };
}

describe("khuôn bundle — MOT id module, script classic", () => {
  test("lib/client.js là script classic và KHÔNG đăng ký id slot occupant làm id module", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    // Loader nạp bundle bằng thẻ <script> classic: cú pháp ESM ở đây là SyntaxError lúc chạy.
    expect(/^\s*(?:import|export)\s/m.test(code)).toBe(false);
    expect(code).toContain("window.__ModuleLoader__.load(");
    const calls = loadBundle(code);
    expect(calls.map((call) => call.id)).toEqual([PACKAGE_NAME]);   // LUAT 17/10/2026: MOT id; id goc o gbh.row.aliases
    expect(calls.map((call) => call.id)).not.toContain(SLOT_OCCUPANT_ID);
    // MOT dang ky duy nhat ⇒ chi mot ban than module trong bang.
    expect(calls.length).toBe(1);
  });

  test("script chỉ ĐĂNG KÝ: không gọi require và không chạy thân module lúc nạp", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    const calls = loadBundle(code);
    // Nếu thân module chạy lúc nạp thì nó đã ném lỗi vì không có bảng module; ở đây chỉ khẳng định
    // script đăng ký xong mà không cần `require` nào (hợp đồng C2: chỉ xếp hàng, factory là lười).
    // LUAT 17/10/2026: bundle chi tu khai MOT id (id goc o gbh.row.aliases) => mot loi goi load().
    expect(calls.length).toBe(1);
    for (const call of calls) expect(typeof call.factory).toBe("function");
  });
});

describe("mặt plugin — hình dạng mà Loader nhận", () => {
  test("factory trả { NS, inject, apply } và require đúng hai specifier như bản gốc", async () => {
    const record: Record<string, unknown> = {};
    const { plugin, required } = await materialize(record);
    expect(required).toEqual(["react/jsx-runtime", "@deepseek-ai/dsh-client-ui-primitives"]);
    expect(plugin.NS).toBe("settings.agentLoop");
    expect(plugin.inject).toEqual(["slots", "locale", "configForms"]);
    expect(typeof plugin.apply).toBe("function");
  });
});

describe("hành vi chính — đăng ký trang vào Plugins", () => {
  test("apply đăng ký từ điển, mở form staged và gắn occupant id 'agent-loop' order 30", async () => {
    const primitivesRecord: Record<string, unknown> = {};
    const { plugin } = await materialize(primitivesRecord);
    const record = emptyRecord();
    const ctx = makeContext({ served: true, slotPresent: true, record });
    plugin.apply(ctx);

    // (1) từ điển: bind trước, rồi đăng ký ĐÚNG namespace của trang với đủ 12 khoá ở cả hai thứ tiếng.
    expect(record.bound).toEqual([NS]);
    expect(record.dictionaries.length).toBe(1);
    const dictionary = record.dictionaries[0];
    expect(dictionary?.namespace).toBe(NS);
    expect(Object.keys(dictionary?.copy.en ?? {}).sort()).toEqual([...LOCALE_KEYS].sort());
    expect(Object.keys(dictionary?.copy.zh ?? {}).sort()).toEqual([...LOCALE_KEYS].sort());
    expect(dictionary?.copy.en?.title).toBe(EN_TITLE);
    expect(dictionary?.copy.zh?.title).toBe(ZH_TITLE);
    for (const key of LOCALE_KEYS) {
      expect((dictionary?.copy.en?.[key] ?? "").length).toBeGreaterThan(0);
      expect((dictionary?.copy.zh?.[key] ?? "").length).toBeGreaterThan(0);
    }

    // (2) form staged: scope của namespace agent-loop, đúng MỘT trường là hạn mức song song.
    expect(record.scopes).toEqual([AGENT_LOOP_NAMESPACE]);
    expect(primitivesRecord.scope).toEqual({ namespace: AGENT_LOOP_NAMESPACE });
    expect(primitivesRecord.fields).toEqual([{ field: "maxParallelToolCalls" }]);

    // (3) cổng phục vụ + slot.
    expect(record.servedWatch).toEqual([[AGENT_LOOP_NAMESPACE]]);
    expect(record.injected).toEqual([SLOT_NAME]);
    expect(record.occupants.length).toBe(1);
    const definition = record.occupants[0]?.definition ?? {};
    expect(definition.name).toBe(SLOT_NAME);
    expect(definition.id).toBe(SLOT_OCCUPANT_ID);
    expect(definition.order).toBe(SLOT_ORDER);
    expect(definition.locale).toBe(NS);
    const label = definition.label as () => string;
    expect(label()).toBe(EN_TITLE);

    // (4) ba hiệu ứng vòng đời, nhãn giữ nguyên như bản gốc để log đối chiếu được.
    expect(record.effects.map((effect) => effect.label)).toEqual([
      "ui-settings-agent-loop: dictionaries",
      "ui-settings-agent-loop: form subscription",
      "ui-settings-agent-loop: page",
    ]);
  });

  test("mặt inject() của occupant: hook agentLoopCard + hành động của form", async () => {
    const primitivesRecord: Record<string, unknown> = {};
    const { plugin } = await materialize(primitivesRecord);
    const record = emptyRecord();
    plugin.apply(makeContext({ served: true, slotPresent: true, record }));
    const face = (record.occupants[0]?.definition.inject as () => Record<string, unknown>)();
    const hooks = face.hooks as Record<string, unknown>;
    expect(Object.keys(hooks)).toEqual(["agentLoopCard"]);
    expect(hooks.agentLoopCard).toBe(primitivesRecord.store);
    expect(typeof face.save).toBe("function");
    expect(typeof face.discard).toBe("function");
    expect(typeof face.edit).toBe("function");
    expect(typeof face.resetField).toBe("function");
    // Ảnh chụp = vỏ form dùng chung + trường của trang này.
    const projection = primitivesRecord.projection as () => Record<string, unknown>;
    const snapshot = projection();
    expect(snapshot.writable).toBe(true);
    expect(snapshot.maxParallelToolCalls).toEqual({ value: "3", overridden: false, name: "maxParallelToolCalls" });
  });

  test("hiệu ứng giải phóng gọi đúng dispose() của form", async () => {
    const primitivesRecord: Record<string, unknown> = {};
    const { plugin } = await materialize(primitivesRecord);
    const record = emptyRecord();
    plugin.apply(makeContext({ served: true, slotPresent: true, record }));
    const cleanup = record.effects[1]?.dispose as (() => void) | undefined;
    expect(typeof cleanup).toBe("function");
    cleanup?.();
    expect(primitivesRecord.disposed).toBe(1);
  });
});

describe("đường lỗi — không có dấu vết khi thiếu điều kiện", () => {
  test("Host KHÔNG phục vụ namespace agent-loop thì trang không đăng ký gì", async () => {
    const { plugin } = await materialize({});
    const record = emptyRecord();
    plugin.apply(makeContext({ served: false, slotPresent: true, record }));
    expect(record.servedWatch).toEqual([[AGENT_LOOP_NAMESPACE]]);
    expect(record.injected).toEqual([]);
    expect(record.occupants).toEqual([]);
    // Từ điển vẫn được đăng ký: nó thuộc plugin, không phụ thuộc Host có phục vụ namespace hay không.
    expect(record.dictionaries.length).toBe(1);
  });

  test("slot plugins.item chưa có người phục vụ thì không đăng ký occupant", async () => {
    const { plugin } = await materialize({});
    const record = emptyRecord();
    plugin.apply(makeContext({ served: true, slotPresent: false, record }));
    expect(record.injected).toEqual([SLOT_NAME]);
    expect(record.occupants).toEqual([]);
  });

  test("require specifier lạ bị từ chối, không im lặng", async () => {
    const out = await buildOnce();
    const code = await readFile(out.client, "utf8");
    const registration = loadBundle(code)[0];
    const thrown = (): unknown => {
      try {
        return registration?.factory((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
          throw new Error("khong duoc require " + specifier);
        });
      } catch (error) {
        return error;
      }
    };
    expect(String(thrown())).toContain("react/jsx-runtime");
  });
});

describe("render — dòng mô tả và form", () => {
  test("view=summary trả mô tả; view khác trả form với đúng props của bản gốc", async () => {
    const primitivesRecord: Record<string, unknown> = {};
    const { plugin, primitives } = await materialize(primitivesRecord);
    const record = emptyRecord();
    const ctx = makeContext({ served: true, slotPresent: true, record });
    plugin.apply(ctx);
    const component = record.occupants[0]?.component as (props: Record<string, unknown>) => unknown;
    const snapshot = { writable: true, maxParallelToolCalls: { value: "5", overridden: true } };
    const edits: unknown[] = [];
    const resets: unknown[] = [];
    const props = {
      view: "summary",
      t: (key: LocaleKey) => en[key] ?? String(key),
      useAgentLoopCard: (select: (state: unknown) => unknown) => select(snapshot),
      save: () => "save",
      discard: () => "discard",
      edit: (field: string, text: string) => edits.push([field, text]),
      resetField: (field: string) => resets.push(field),
    };

    expect(component(props)).toBe(en.description);

    const view = component({ ...props, view: "config" }) as { type: string; props: Record<string, unknown> };
    expect(view.type as unknown).toBe(primitives.SettingsForm);
    expect(view.props.state).toEqual(snapshot);
    expect(view.props.onSave).toBe(props.save);
    expect(view.props.onDiscard).toBe(props.discard);
    expect(view.props.labels).toEqual({
      unavailable: en.unavailable,
      readOnly: en.readOnly,
      saveFailed: en.saveFailed,
      save: en.save,
      saving: en.saving,
    });

    const field = view.props.children as { type: string; props: Record<string, unknown> };
    expect(field.type as unknown).toBe(primitives.SettingsValueField);
    expect(field.props.id).toBe(PARALLEL_FIELD_ID);
    expect(field.props.label).toBe(en.maxParallel);
    expect(field.props.hint).toBe(en.maxParallelHint);
    expect(field.props.overriddenLabel).toBe(en.overridden);
    expect(field.props.resetLabel).toBe(en.reset);
    expect(field.props.invalidLabel).toBe(en.invalidNumber);
    expect(field.props.numeric).toBe(true);
    expect(field.props.disabled).toBe(false);
    expect(field.props.value).toBe("5");

    (field.props.onEdit as (text: string) => void)("7");
    (field.props.onReset as () => void)();
    expect(edits).toEqual([["maxParallelToolCalls", "7"]]);
    expect(resets).toEqual(["maxParallelToolCalls"]);
  });

  test("deployment chỉ đọc thì ô nhập bị khoá (disabled = !writable)", async () => {
    const primitivesRecord: Record<string, unknown> = {};
    const { plugin } = await materialize(primitivesRecord);
    const record = emptyRecord();
    plugin.apply(makeContext({ served: true, slotPresent: true, record }));
    const component = record.occupants[0]?.component as (props: Record<string, unknown>) => { props: { children: { props: Record<string, unknown> } } };
    const view = component({
      view: "config",
      t: (key: LocaleKey) => en[key] ?? String(key),
      useAgentLoopCard: (select: (state: unknown) => unknown) => select({ writable: false, maxParallelToolCalls: {} }),
      save: () => undefined,
      discard: () => undefined,
      edit: () => undefined,
      resetField: () => undefined,
    });
    expect(view.props.children.props.disabled).toBe(true);
  });
});

describe("nửa host — đúng một hàm rỗng như bản gốc", () => {
  test("lib/index.js là ESM, chỉ xuất apply và không import gói ngoài", async () => {
    const out = await buildOnce();
    const code = await readFile(out.host, "utf8");
    const specifiers = [...code.matchAll(/from\s+"([^"\s]+)"/g)].map((match) => match[1] ?? "");
    for (const specifier of specifiers) {
      const allowed = specifier.startsWith("node:") || specifier === "@deepseek-ai/cordis" || specifier.startsWith("./");
      expect(allowed).toBe(true);
    }
    expect(code).toContain("export {");
    expect(code).toContain("apply");
    const module = (await import(out.host)) as { apply: () => void };
    expect(module.apply()).toBeUndefined();
  });
});
