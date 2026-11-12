/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi row ui-settings-web-search: inject nguyen van, locale, RPC credentials, slot plugins.item
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { buildPackage } from "../../packages/client/ui-settings-web-search/build.ts";
import { PACKAGE_NAME } from "../../packages/client/ui-settings-web-search/src/ids.ts";

/** Nạp bundle đã build trong một window giả, kèm §require§ giả cấp seed nền tảng. */
async function loadBundle() {
  const out = await mkdtemp(join(tmpdir(), "gbh-web-search-"));
  const built = await buildPackage(out);
  const code = readFileSync(built.client, "utf8");
  const calls: { id: string; factory: (require: (spec: string) => unknown) => { apply: (ctx: unknown) => void; inject: string[]; NS: string } }[] = [];
  new Function("window", code)({ __ModuleLoader__: { load: (registration: (typeof calls)[number]) => calls.push(registration) } });
  const recorded: { describes: string[][]; sets: [string, string][]; dictionaries: Record<string, unknown>[]; occupants: Record<string, unknown>[]; injectedSlots: string[]; served: string[][]; effects: string[] } = {
    describes: [],
    sets: [],
    dictionaries: [],
    occupants: [],
    injectedSlots: [],
    served: [],
    effects: [],
  };
  const primitives = {
    SettingsForm: () => undefined,
    SettingsSecretField: () => undefined,
    SettingsValueField: () => undefined,
    settingsTextField: (name: string) => ({ name }),
    settingsNumberField: (name: string) => ({ name }),
    SettingsFormModel: class {
      constructor(_scope: unknown, ..._rest: unknown[]) {}
      shell() {
        return {};
      }
      field(name: string) {
        return { name };
      }
      actions() {
        return { save: () => undefined, discard: () => undefined };
      }
      bind() {
        return { set: () => undefined };
      }
      dispose() {}
    },
  };
  const requireSeed = (spec: string): unknown => (spec === "react/jsx-runtime" ? { jsx: () => undefined, jsxs: () => undefined } : primitives);
  const registration = calls[0];
  if (registration === undefined) throw new Error("bundle khong dang ky factory nao");
  const moduleExports = registration.factory(requireSeed);
  const scope = { value: { apiKeyEnv: undefined as string | undefined } };
  const ctx = {
    effect: (callback: () => unknown, label?: string) => {
      recorded.effects.push(label ?? "?");
      const cleanup = callback();
      return cleanup;
    },
    locale: {
      bind: (namespace: string) => (key: string) => namespace + ":" + key,
      register: (namespace: string, dictionaries: Record<string, unknown>) => {
        recorded.dictionaries.push({ namespace, ...dictionaries });
      },
    },
    remote: {
      credentials: {
        describe: async (refs: string[]) => {
          recorded.describes.push(refs);
          return { ok: true, value: Object.fromEntries(refs.map((ref) => [ref, { configured: true, writable: false }])) };
        },
        set: async (ref: string, value: string) => {
          recorded.sets.push([ref, value]);
        },
      },
      $on: (_event: string, _listener: (ref: string) => void) => undefined,
    },
    configForms: {
      get: () => ({ getSnapshot: () => scope, subscribe: () => () => undefined }),
      whileServed: (namespaces: string[], callback: () => unknown) => {
        recorded.served.push(namespaces);
        return callback();
      },
    },
    slots: {
      inject: (slot: string, callback: () => unknown) => {
        recorded.injectedSlots.push(slot);
        return callback();
      },
      register: (occupant: Record<string, unknown>, _component: unknown) => {
        recorded.occupants.push(occupant);
      },
    },
  };
  return { moduleExports, ctx, recorded, code, calls };
}

describe("ui-settings-web-search — nửa client", () => {
  test("bundle chỉ đăng ký MỘT id (của ta) và giữ seed nền tảng ở dạng require", async () => {
    const { code, calls } = await loadBundle();
    // Chỉ MỘT lời gọi đăng ký module; các §id: …§ khác trong file là id của SLOT OCCUPANT và của field form.
    expect(code.match(/__ModuleLoader__\.load\(/g)?.length).toBe(1);
    expect(calls[0]?.id).toBe(PACKAGE_NAME);
    const ids = [...code.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1] ?? "");
    expect(ids).toContain("web-search");
    expect(code).toContain('require("react/jsx-runtime")');
    expect(code).toContain('require("@galaxy-blackhole/gbh-client-ui-primitives")');
  });

  test("inject 5 service NGUYÊN VĂN và đăng ký locale dưới namespace settings.webSearch", async () => {
    const { moduleExports, ctx, recorded } = await loadBundle();
    expect(moduleExports.inject).toEqual(["slots", "locale", "remote", "remote.credentials", "configForms"]);
    expect(moduleExports.NS).toBe("settings.webSearch");
    moduleExports.apply(ctx);
    expect(recorded.dictionaries.length).toBe(1);
    expect(recorded.dictionaries[0]?.namespace).toBe("settings.webSearch");
    expect(recorded.dictionaries[0]?.en).toBeDefined();
    expect(recorded.dictionaries[0]?.zh).toBeDefined();
  });

  test("RPC credentials đi qua seam remote: describe theo tham chiếu, set khi ghi khoá", async () => {
    const { moduleExports, ctx, recorded } = await loadBundle();
    moduleExports.apply(ctx);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(recorded.describes[0]).toEqual(["DEEPSEEK_API_KEY"]);
    // §writable: false§ từ Host ⇒ ô khoá bị khoá, nhưng seam vẫn nhận §set§ khi form ghi.
    await ctx.remote.credentials.set("DEEPSEEK_API_KEY", "khoa-moi");
    expect(recorded.sets).toEqual([["DEEPSEEK_API_KEY", "khoa-moi"]]);
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
    plugin.recorded.dictionaries.length = 0;
    plugin.recorded.injectedSlots.length = 0;
    plugin.recorded.occupants.length = 0;
    plugin.moduleExports.apply(plugin.ctx);
    expect(plugin.recorded.dictionaries.length).toBe(1);
    expect(plugin.recorded.injectedSlots).toEqual(["plugins.item"]);
    expect(plugin.recorded.occupants.length).toBe(1);
    // Lần thứ ba: cờ đã bật ⇒ KHÔNG đăng ký gì thêm.
    plugin.recorded.dictionaries.length = 0;
    plugin.recorded.occupants.length = 0;
    plugin.moduleExports.apply(plugin.ctx);
    expect(plugin.recorded.dictionaries.length).toBe(0);
    expect(plugin.recorded.occupants.length).toBe(0);
    // Nạp MODULE MỚI thì lại được phép đăng ký (cờ là phạm vi module).
    const fresh = await loadBundle();
    fresh.moduleExports.apply(fresh.ctx);
    expect(fresh.recorded.occupants.length).toBe(1);
  });

  test("slot occupant: TÊN SLOT nguyên văn tại chỗ đăng ký (check:rows đọc văn bản)", async () => {
    const { moduleExports, ctx, recorded } = await loadBundle();
    moduleExports.apply(ctx);
    expect(recorded.injectedSlots).toEqual(["plugins.item"]);
    // 09/11/2026 (quyết định chủ dự án): gói đổi tên `web-search-deepseek` → `@galaxy-blackhole/gbh-web-search`
    //   ⇒ namespace cài đặt thành `web-search-gbh`. Kỳ vọng đổi theo ĐÚNG giá trị mới, phép kiểm giữ nguyên độ mạnh
    //   (vẫn so BẰNG với danh sách namespace đã đăng ký, không nới thành `toContain`).
    expect(recorded.served).toEqual([["web-search-gbh"]]);
    expect(recorded.occupants.length).toBe(1);
    const occupant = recorded.occupants[0] ?? {};
    expect(occupant.name).toBe("plugins.item");
    expect(occupant.id).toBe("web-search");
    expect(occupant.order).toBe(20);
    expect(occupant.locale).toBe("settings.webSearch");
    expect(typeof occupant.label).toBe("function");
    expect(typeof occupant.inject).toBe("function");
    const face = (occupant.inject as () => { hooks: Record<string, unknown> })();
    expect(Object.keys(face.hooks)).toEqual(["webSearchCard"]);
  });

  test("chỉ đăng ký vào trang khi Host ĐANG phục vụ namespace của provider", async () => {
    const { moduleExports, ctx, recorded } = await loadBundle();
    recorded.served.length = 0;
    ctx.configForms.whileServed = (namespaces: string[], callback: () => unknown) => {
      recorded.served.push(namespaces);
      return undefined;
    };
    moduleExports.apply(ctx);
    // 09/11/2026: namespace mới `web-search-gbh` (xem chú thích ở ca trước) — vẫn khẳng định chính xác danh sách.
    expect(recorded.served).toEqual([["web-search-gbh"]]);
    expect(recorded.occupants.length).toBe(0);
  });
});

