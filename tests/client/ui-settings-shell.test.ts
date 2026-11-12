/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-client-ui-settings-shell: từ điển, hai cầu nối form,
 *      occupant slot shell, hai id module và hình dạng export của nửa host
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

// PHẢI đứng trước import src/client.ts: module đó tự gọi __ModuleLoader__.load khi được nạp.
import { registeredIds, resetRegisteredIds } from "./ui-settings-shell.loader-fixture.ts";
import { NS, PLUGIN_ID, STOCK_ID, createPlugin } from "../../packages/client/ui-settings-shell/src/plugin.ts";
import { en, formLabels, zh } from "../../packages/client/ui-settings-shell/src/locales.ts";
import { createShellCard } from "../../packages/client/ui-settings-shell/src/shell-card.ts";
import {
  BASH_NS,
  PWSH_NS,
  createShellCardController,
} from "../../packages/client/ui-settings-shell/src/shell-card-controller.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/**
 * Nạp một file .js đã build mà không cần khai báo kiểu (specifier là biến nên tsc không kiểm).
 * Nhận: đường dẫn tuyệt đối tới file .js.
 * Trả: bảng export của module đó.
 */
async function loadBuilt(path: string): Promise<Record<string, unknown>> {
  return (await import(path)) as Record<string, unknown>;
}

/** Bản ghi một lần dựng mô hình form trong primitives giả. */
interface FormRecord {
  /** Scope cấu hình đã nhận. */
  scope: unknown;
  /** Danh sách trường đã khai. */
  fields: string[];
  /** Đã bị dispose chưa. */
  disposed: boolean;
}

/** Bộ đệm ghi lại mọi tương tác của context giả. */
interface Recorder {
  /** Từ điển đã đăng ký theo namespace. */
  locales: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Các namespace đã hỏi scope cấu hình. */
  scopesAsked: string[];
  /** Các mô hình form đã dựng. */
  forms: FormRecord[];
  /** Các occupant slot đã đăng ký. */
  slots: { slot: string; definition: Record<string, unknown>; component: unknown }[];
  /** Các hàm huỷ hiệu ứng đã đăng ký. */
  effects: (() => void)[];
}

/**
 * Dựng bộ primitives giả ghi lại mọi lời gọi (không cần browser).
 * Nhận: bộ đệm ghi.
 * Trả: module primitives giả để truyền cho createPlugin/createShellCardController.
 */
function fakePrimitives(recorder: Recorder): Record<string, unknown> {
  return {
    SettingsForm: "SettingsForm",
    SettingsValueField: "SettingsValueField",
    settingsNumberField: (name: string) => "number:" + name,
    SettingsFormModel: class {
      /** Bản ghi của CHÍNH mô hình này (để dispose đánh dấu đúng nó). */
      private readonly record: FormRecord;

      /** Ghi lại scope và danh sách trường khi primitives dựng mô hình. */
      constructor(scope: unknown, fields: unknown[]) {
        this.record = { scope, fields: fields.map((entry) => String(entry)), disposed: false };
        recorder.forms.push(this.record);
      }

      /** Phần khung form dùng chung. */
      shell(): Record<string, unknown> {
        return { writable: true };
      }

      /** Trạng thái một trường số đã khai. */
      field(name: string): Record<string, unknown> {
        return { value: name === "timeoutMs" ? "120000" : "1048576" };
      }

      /** Store phát lại theo hàm chiếu của trang. */
      bind(projection: () => Record<string, unknown>): { getSnapshot: () => Record<string, unknown> } {
        return { getSnapshot: () => projection() };
      }

      /** Hành động của form (save/discard). */
      actions(): Record<string, unknown> {
        return { save: () => "saved", discard: () => "discarded" };
      }

      /** Huỷ đăng ký của mô hình form. */
      dispose(): void {
        this.record.disposed = true;
      }
    },
  };
}

/**
 * Dựng context giả của browser ghi lại mọi đăng ký.
 * Nhận: không.
 * Trả: { ctx, recorder, fireServed } — fireServed gọi callback whileServed với tập namespace đang phục vụ.
 */
function fakeContext(): { ctx: unknown; recorder: Recorder; fireServed: (served: string[]) => void } {
  const recorder: Recorder = { locales: [], scopesAsked: [], forms: [], slots: [], effects: [] };
  let servedCallback: ((served: Set<string>) => unknown) | null = null;
  const ctx = {
    effect: (callback: () => void | (() => void)): unknown => {
      const result = callback();
      if (typeof result === "function") recorder.effects.push(result);
      return result;
    },
    locale: {
      // Bind giả nhưng ĐÚNG hành vi: trả chuỗi từ từ điển en của chính package này.
      bind: (_namespace: string) => (key: string) => (en as Record<string, string>)[key] ?? key,
      register: (namespace: string, copy: Record<string, Record<string, string>>): void => {
        recorder.locales.push({ namespace, copy });
      },
    },
    slots: {
      register: (definition: Record<string, unknown>, component: unknown): void => {
        recorder.slots.push({ slot: String(definition.name ?? ""), definition, component });
      },
      inject: (_slot: string, register: () => unknown): void => {
        register();
      },
    },
    configForms: {
      get: (namespace: string): unknown => {
        recorder.scopesAsked.push(namespace);
        return { namespace };
      },
      whileServed: (_namespaces: readonly string[], register: (served: Set<string>) => unknown): void => {
        servedCallback = register;
      },
    },
  };
  return {
    ctx,
    recorder,
    fireServed: (served: string[]): void => {
      servedCallback?.(new Set(served));
    },
  };
}

/**
 * Dựng require giả cho factory: chỉ cấp jsx runtime và ui-primitives.
 * Nhận: module primitives giả.
 * Trả: hàm require(id) — ném lỗi rõ ràng nếu bundle hỏi module lạ.
 */
function fakeRequire(primitives: Record<string, unknown>): (id: string) => unknown {
  return (id: string): unknown => {
    if (id === "react/jsx-runtime") {
      return {
        jsx: (type: unknown, props: unknown) => ({ type, props }),
        jsxs: (type: unknown, props: unknown) => ({ type, props }),
      };
    }
    if (id .endsWith("-client-ui-primitives")) return primitives;
    throw new Error("module lạ: " + id);
  };
}

describe("row ui-settings-shell — nửa client", () => {
  test("ca 1: hành vi chính giống bản gốc (từ điển + hai cầu nối form + occupant slot shell)", () => {
    const { ctx, recorder, fireServed } = fakeContext();
    const plugin = createPlugin(fakeRequire(fakePrimitives(recorder)));
    expect(plugin.inject).toEqual(["slots", "locale", "configForms"]);
    plugin.apply(ctx as never);

    expect(recorder.locales.map((entry) => entry.namespace)).toEqual([NS]);
    // 18/10/2026 — thêm tiếng Việt (phần THÊM CÓ CHỦ ĐÍCH): so zh/en như cũ, khẳng định thêm bảng vi.
    expect(recorder.locales[0]?.copy.zh).toEqual(zh);
    expect(recorder.locales[0]?.copy.en).toEqual(en);
    expect(Object.keys(recorder.locales[0]?.copy.vi ?? {}).length).toBe(Object.keys(en).length);
    expect(recorder.scopesAsked).toEqual([BASH_NS, PWSH_NS]);
    expect(recorder.forms.map((form) => form.fields)).toEqual([
      ["number:timeoutMs", "number:maxOutputBytes"],
      ["number:timeoutMs", "number:maxOutputBytes"],
    ]);

    // Host chưa phục vụ namespace nào thì chưa được đăng ký occupant nào.
    expect(recorder.slots.length).toBe(0);
    fireServed([BASH_NS]);
    expect(recorder.slots.length).toBe(1);
    const registered = recorder.slots[0];
    expect(registered?.slot).toBe("plugins.item");
    expect(registered?.definition.id).toBe("shell");
    expect(registered?.definition.order).toBe(40);
    expect(registered?.definition.locale).toBe(NS);
    expect((registered?.definition.label as () => string)()).toBe("Shell");
    expect(typeof registered?.definition.inject).toBe("function");
  });

  test("ca 2: Host không phục vụ namespace thì không đăng ký gì, không treo, dispose sạch", () => {
    const { ctx, recorder } = fakeContext();
    const plugin = createPlugin(fakeRequire(fakePrimitives(recorder)));
    plugin.apply(ctx as never);
    expect(recorder.slots.length).toBe(0);
    for (const dispose of [...recorder.effects].reverse()) dispose();
    expect(recorder.forms.every((form) => form.disposed)).toBe(true);
  });

  test("ca 3: view summary trả đúng một dòng mô tả, không dựng form", () => {
    const Card = createShellCard(
      {
        jsx: (type: unknown, props: unknown) => ({ type, props }),
        jsxs: (type: unknown, props: unknown) => ({ type, props }),
      },
      { SettingsForm: "SettingsForm", SettingsValueField: "SettingsValueField" },
    );
    const t = (key: keyof typeof en): string => en[key];
    const summary = Card({
      view: "summary",
      t,
      useShellCard: (selector) => selector({ writable: true, timeoutMs: {}, maxOutputBytes: {} } as never),
      save: () => undefined,
      discard: () => undefined,
      edit: () => undefined,
      resetField: () => undefined,
    });
    expect(summary).toBe(en.description);
  });

  test("ca 4: cầu nối form khai đúng hai trường số và dispose gọi dispose của mô hình", () => {
    const { recorder } = fakeContext();
    const controller = createShellCardController(fakePrimitives(recorder) as never, { namespace: BASH_NS });
    expect(recorder.forms[0]?.fields).toEqual(["number:timeoutMs", "number:maxOutputBytes"]);
    const face = controller.inject();
    expect(face.hooks.shellCard).toBeDefined();
    controller.dispose();
    expect(recorder.forms[0]?.disposed).toBe(true);
  });
});

describe("row ui-settings-shell — hình dạng export và bảng module", () => {
  test("nửa host của ta export ĐÚNG tập export của bản gốc (apply)", async () => {
    const stock = await loadBuilt(
      join(import.meta.dir, "../../apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-shell/lib/index.js"),
    );
    const stockExports = Object.keys(stock).filter((key) => key !== "default").sort();
    expect(stockExports).toEqual(["apply"]);
    const ours = await loadBuilt(
      join(import.meta.dir, "../../packages/client/ui-settings-shell/lib/index.js"),
    );
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(stockExports);
    expect(typeof ours.apply).toBe("function");
  });

  test("nửa client đăng ký ĐÚNG MOT id module (id gốc ở gbh.row.aliases), không đăng ký thừa", async () => {
    // (a) bản nguồn: src/client.ts CHỈ xuất factory — việc đăng ký id nằm ở tầng script của build.ts.
    const source = await Bun.file(
      join(import.meta.dir, "../../packages/client/ui-settings-shell/src/client.ts"),
    ).text();
    expect(source).toContain("createPlugin");
    // Không có lời gọi đăng ký nào ở cấp cao nhất (chữ trong chú thích thì không tính).
    expect(/^\s*(window\.)?__ModuleLoader__\s*\./mu.test(source)).toBe(false);
    // (b) bản ĐÃ BUILD: bundle là SCRIPT CLASSIC (không phải ESM) nên chạy nó trong window giả.
    resetRegisteredIds();
    const code = await Bun.file(
      join(import.meta.dir, "../../packages/client/ui-settings-shell/lib/client.js"),
    ).text();
    const fakeWindow = {
      __ModuleLoader__: {
        load: (registration: { id: string }): void => {
          registeredIds.push(registration.id);
        },
      },
    };
    new Function("window", code)(fakeWindow);
    expect(registeredIds.length).toBe(1);   // LUAT 17/10/2026: bundle chi tu khai MOT id; id goc khai o gbh.row.aliases
    // LUAT 17/10/2026: id goc KHONG tu dang ky trong bundle (no o gbh.row.aliases) => chi con id cua ta.
    expect(new Set(registeredIds)).toEqual(new Set([PLUGIN_ID]));
    // Bundle không được chứa cú pháp ESM nào (loader nạp bằng thẻ script classic).
    expect(/^\s*(export|import)\s/mu.test(code)).toBe(false);
  });

  test("từ điển en/zh cùng tập khoá, formLabels lấy đúng chuỗi", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(formLabels((key) => en[key]).save).toBe(en.save);
    expect(formLabels((key) => en[key]).saving).toBe(en.saving);
  });
});
