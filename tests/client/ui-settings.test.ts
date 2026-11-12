/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-ui-settings (row ui-settings)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildPackage } from "../../packages/client/ui-settings/build.ts";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/ui-settings/src/ids.ts";
import { SettingsSchemaService } from "../../packages/client/ui-settings/src/schema.ts";
import { SettingsDescribeMirror } from "../../packages/client/ui-settings/src/mirror.ts";
import { ConfigFormController } from "../../packages/client/ui-settings/src/config-form.ts";
import { ConfigForms } from "../../packages/client/ui-settings/src/config-forms.ts";
import type { SnapshotStore } from "../../packages/client/ui-settings/src/types.ts";
import type { DocumentView, NamespaceView } from "../../packages/client/ui-settings/src/mirror.ts";

/**
 * Store gia co CUNG hinh dang module that (getSnapshot/subscribe/update/set) — rong hon la che loi.
 * @param initial - gia tri dau.
 * @returns store gia.
 */
function fakeStore<T>(initial: T): SnapshotStore<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update: (mutate) => {
      const draft = { ...(value as object) } as T;
      mutate(draft);
      value = draft;
      for (const listener of listeners) listener();
    },
    set: (next: T) => {
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

/** Remote gia: dem so lan describe, tra ve view cho truoc. */
function fakeRemote(view: DocumentView | undefined, fail = false) {
  const calls = { describe: 0 };
  return {
    calls,
    remote: {
      describe: async () => {
        calls.describe += 1;
        return fail
          ? { ok: false, error: { message: "boom" } }
          : { ok: true, value: view as DocumentView };
      },
    },
  };
}

/** View mot namespace cho truoc. */
function nsView(ns: string, value: unknown, revision = 1): NamespaceView {
  return { ns, revision, base: value, value };
}

describe("row ui-settings", () => {
  test("ca 1: settingsSchema — doc/ghi duong dan bat bien, tu tao container, xoa dung kieu mang", () => {
    const schema = new SettingsSchemaService(undefined);
    const root = { a: { b: 1 }, list: [1, 2, 3] };
    expect(schema.getPath(root, ["a", "b"])).toBe(1);
    expect(schema.hasPath(root, ["a", "b"])).toBe(true);
    expect(schema.hasPath(root, ["a", "zz"])).toBe(false);
    const set = schema.setPath(root, ["a", "c"], 9) as { a: { b: number; c: number } };
    expect(set.a.c).toBe(9);
    expect(root.a).toEqual({ b: 1 });
    const deep = schema.setPath(root, ["x", "y"], 1) as Record<string, Record<string, number>>;
    expect(deep["x"]?.["y"]).toBe(1);
    const removed = schema.deletePath(root, ["list", "1"]) as typeof root;
    expect(removed.list).toEqual([1, 3]);
    expect(schema.deletePath(root, ["a", "zz"])).toBe(root);
    expect(() => schema.setPath(root, [], 1)).toThrow();
    expect(schema.nodeAtPath({ type: "object", dict: { a: { type: "dict", inner: { type: "string" } } } }, ["a"])?.type).toBe("dict");
    expect(schema.nodeAtPath({ type: "object", dict: {} }, ["missing"])).toBeUndefined();
  });

  test("ca 2: validate tra thong bao loi thay vi nem", () => {
    const schema = new SettingsSchemaService(undefined);
    const ok = ((value: unknown) => {
      if (typeof value !== "object") throw new Error("expect object");
      return value;
    }) as never;
    expect(schema.validate(ok, { a: 1 })).toBeUndefined();
    expect(schema.validate(ok, 3)).toBe("expect object");
  });

  test("ca 3: mirror — load() gop lan doc dang chay va chay lai dung MOT lan khi bi invalidate giua chung", async () => {
    const view: DocumentView = { writable: true, namespaces: [nsView("ui-settings", { enabled: true })] };
    const { calls, remote } = fakeRemote(view);
    const mirror = new SettingsDescribeMirror(remote, fakeStore);
    expect(mirror.getSnapshot().status).toBe("idle");
    const first = mirror.load();
    await Promise.resolve();
    const second = mirror.load();
    await Promise.all([first, second]);
    expect(calls.describe).toBe(2);
    expect(mirror.getSnapshot().status).toBe("ready");
    expect(mirror.namespace("ui-settings")?.ns).toBe("ui-settings");
    await mirror.ensure();
    expect(calls.describe).toBe(2);
  });

  test("ca 4: mirror — acceptView gop cau tra loi cua lan ghi, khong doc qua mang", () => {
    const view: DocumentView = { writable: true, namespaces: [nsView("ui-settings", { enabled: false })] };
    const { calls, remote } = fakeRemote(view);
    const mirror = new SettingsDescribeMirror(remote, fakeStore);
    mirror.acceptView(nsView("other", { a: 1 }));
    expect(calls.describe).toBe(0);
    expect(mirror.getSnapshot().view).toBeUndefined();
    return mirror.load().then(() => {
      const before = calls.describe;
      mirror.acceptView(nsView("ui-settings", { enabled: true }, 7));
      expect(calls.describe).toBe(before);
      expect(mirror.namespace("ui-settings")?.revision).toBe(7);
    });
  });

  test("ca 5: configForm — set() gui dung op + revision hien tai, va recover khi Host tu choi", async () => {
    const view: DocumentView = { writable: true, namespaces: [nsView("ui-settings", { enabled: true }, 5)] };
    const sent: Array<{ ns: string; ops: unknown; revision: number | undefined }> = [];
    let accept = true;
    const remote = {
      settings: {
        describe: async () => ({ ok: true, value: view }),
        mutate: async (ns: string, ops: readonly unknown[], revision: number | undefined) => {
          sent.push({ ns, ops, revision });
          return accept ? { ok: true, value: nsView(ns, { enabled: false }, 6) } : { ok: false };
        },
      },
      schema: new SettingsSchemaService(undefined),
      rehydrate: (() => ((value: unknown) => value)) as never,
    };
    const mirror = new SettingsDescribeMirror(remote.settings, fakeStore);
    await mirror.load();
    const formCtx = { remote: { settings: remote.settings }, schema: remote.schema, rehydrate: remote.rehydrate };
    const form = new ConfigFormController(formCtx as never, { namespace: "ui-settings" }, mirror, fakeStore);
    expect(form.getSnapshot().status).toBe("ready");
    expect(await form.set("enabled", false)).toBe(true);
    expect(sent[0]?.ns).toBe("ui-settings");
    expect(sent[0]?.ops).toEqual([{ op: "set", path: ["enabled"], value: false }]);
    expect(sent[0]?.revision).toBe(5);
    accept = false;
    expect(await form.set("enabled", true)).toBe(false);
    await form.dispose();
    expect(await form.set("enabled", true)).toBe(false);
  });

  test("ca 6: configForms.whileServed — dang ky chay khi namespace duoc phuc vu, huy khi khong con", async () => {
    const view: DocumentView = { writable: true, namespaces: [nsView("a", {})] };
    const { remote } = fakeRemote(view);
    const mirror = new SettingsDescribeMirror(remote, fakeStore);
    const settingsRemote = { describe: remote.describe, mutate: async () => ({ ok: true }) };
    const forms = new ConfigForms(
      { remote: { settings: settingsRemote }, schema: new SettingsSchemaService(undefined), rehydrate: (() => ((v: unknown) => v)) as never },
      { mirror, createStore: fakeStore },
    );
    let registrations = 0;
    let disposals = 0;
    const off = forms.whileServed(["a"], () => {
      registrations += 1;
      return () => {
        disposals += 1;
      };
    });
    expect(registrations).toBe(0);
    await mirror.load();
    expect(registrations).toBe(1);
    expect(forms.get("a").getSnapshot().status).toBe("ready");
    off();
    expect(disposals).toBe(1);
  });

  test("ca 7 (CANON): artefact de-bundle dang ky DUNG MOT id o DONG LOADER, khong co ESM", async () => {
    const out = join(tmpdir(), "gbh-ui-settings-test-" + String(Date.now()));
    const files = await buildPackage(out);
    const built = files.find((file) => file.endsWith("client.js")) ?? "";
    const text = readFileSync(built, "utf8");
    // CANON (20/10/2026): chỉ DÒNG LOADER mang id của ta; các lần xuất hiện khác của id stock là DỮ LIỆU
    // (khoá slot/owner/nhãn) và phải giữ nguyên như bản gốc — xem tools/debundle-client.ts.
    const dongCoLoader = text.split(String.fromCharCode(10)).filter((line) => line.includes("__ModuleLoader__.load("));
    expect(dongCoLoader.length).toBe(1);
    // Id của ta nằm ở dòng NGAY SAU dòng loader (bundle gốc cũng vậy: load({ rồi id: "…").
    const viTri = text.indexOf("__ModuleLoader__.load(");
    const sau = text.slice(viTri, viTri + 200);
    expect(sau).toContain(PACKAGE_NAME);
    expect(sau).not.toContain(STOCK_PACKAGE_NAME);
    expect((text.match(/__ModuleLoader__/g) ?? []).length).toBe(1);
    expect(/^\s*(import|export)\s/m.test(text)).toBe(false);
  });

  test("ca 8: metadata khai du phan C (moduleIds + aliases) va dsh.client khop ban goc SAU KHI QUY ID", () => {
    const pkgPath = join(import.meta.dir, "..", "..", "packages", "client", "ui-settings", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[]; tests: string[] } };
      dsh: { client: { inject: string[] } };
    };
    expect(pkg.gbh.row.id).toBe("ui-settings");
    expect(pkg.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(pkg.gbh.row.aliases).toEqual([STOCK_PACKAGE_NAME]);
    // 20/10/2026 — inject đã REWRITE CÓ CHỦ ĐÍCH sang id GBH; quy id ta -> id stock rồi so SÂU cả client,
    // giữ literal stock làm chuẩn (đúng một gói, đúng platform), không nới ngưỡng.
    expect(sameAfterIdMap(pkg.dsh.client, { inject: ["@deepseek-ai/dsh-api-remotes"], platform: "web" })).toBe(true);
    expect(pkg.gbh.row.tests).toEqual(["tests/client/ui-settings.test.ts"]);
  });

  test("ca 9: doi chung TRUC TIEP voi bundle GOC — settingsSchema cho cung ket qua", () => {
    const stockPath = join(
      import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-settings", "lib", "client.js",
    );
    const source = readFileSync(stockPath, "utf8");
    type Factory = (require: (id: string) => unknown) => unknown;
    const loaded: { id: string; factory: Factory }[] = [];
    const fakeWindow = {
      __ModuleLoader__: {
        load: (registration: { id: string; factory: Factory }) => {
          loaded.push(registration);
        },
      },
    };
    new Function("window", source)(fakeWindow);
    expect(loaded.length).toBe(1);
    expect(loaded[0]?.id).toBe(STOCK_PACKAGE_NAME);

    type Callable = (...args: readonly unknown[]) => unknown;
    const services: { name: string; instance: Record<string, Callable> }[] = [];
    class FakeService {
      constructor(_ctx: unknown, name: string) {
        services.push({ name, instance: this as unknown as Record<string, Callable> });
      }
    }
    const requireFn = (id: string): unknown => {
      if (id === "@deepseek-ai/cordis") return { Service: FakeService };
      if (id .endsWith("-client-store")) return { createSnapshotStore: fakeStore };
      throw new Error("bundle goc require ngoai du kien: " + id);
    };
    const plugin = loaded[0]?.factory(requireFn) as { apply: (ctx: unknown) => void; inject: string[] };
    expect(plugin.inject).toEqual(["remote", "remote.settings"]);
    const view = { writable: true, namespaces: [{ ns: "ui-settings", revision: 1, value: { enabled: true }, base: { enabled: true } }] };
    plugin.apply({
      effect: () => undefined,
      on: () => () => undefined,
      remote: {
        settings: {
          describe: async () => ({ ok: true, value: view }),
          mutate: async () => ({ ok: true, value: view.namespaces[0] }),
        },
        $on: () => () => undefined,
      },
    });
    const stockRaw = services.find((entry) => entry.name === "settingsSchema")?.instance;
    expect(stockRaw).toBeDefined();
    if (stockRaw === undefined) throw new Error("khong lay duoc service settingsSchema cua bundle goc");
    /* Adapter co kieu tuong minh: bundle goc la JS khong khai kieu, goi truc tiep se lam tsc keu. */
    const stock = stockRaw as unknown as {
      getPath(value: unknown, path: readonly string[]): unknown;
      hasPath(value: unknown, path: readonly string[]): boolean;
      setPath(root: unknown, path: readonly string[], value: unknown): unknown;
      deletePath(root: unknown, path: readonly string[]): unknown;
      nodeAtPath(root: unknown, path: readonly string[]): unknown;
      validate(schema: unknown, draft: unknown): string | undefined;
    };
    const mine = new SettingsSchemaService(undefined);
    const root = { a: { b: 1 }, list: [1, 2, 3], flag: false };
    const paths: string[][] = [["a"], ["a", "b"], ["a", "zz"], ["list", "1"], ["missing"], []];
    for (const path of paths) {
      expect(mine.getPath(root, path)).toEqual(stock.getPath(root, path));
      expect(mine.hasPath(root, path)).toEqual(stock.hasPath(root, path));
    }
    expect(mine.setPath(root, ["a", "c"], 7)).toEqual(stock.setPath(root, ["a", "c"], 7));
    expect(root.a).toEqual({ b: 1 });
    expect(mine.deletePath(root, ["list", "1"])).toEqual(stock.deletePath(root, ["list", "1"]));
    expect(mine.deletePath(root, ["a", "zz"])).toBe(root);
    expect(stock.deletePath(root, ["a", "zz"])).toBe(root);
    const node = { type: "object", dict: { x: { type: "dict", inner: { type: "string" } } } };
    const mineNode = mine.nodeAtPath(node, ["x"]);
    const stockNode = stock.nodeAtPath(node, ["x"]);
    expect(mineNode as unknown).toEqual(stockNode);
    const mineMissing = mine.nodeAtPath(node, ["nope"]);
    const stockMissing = stock.nodeAtPath(node, ["nope"]);
    expect(mineMissing as unknown).toEqual(stockMissing);
    const callable = ((value: unknown) => value) as never;
    const mineFailure = mine.validate(callable, 1);
    const stockFailure = stock.validate(callable, 1);
    expect(mineFailure).toBe(stockFailure);
    // Bat buoc: service configForms PHAI co developerTools (consumer stock doc thang duong nay).
    const stockForms = services.find((entry) => entry.name === "configForms")?.instance as unknown as {
      developerTools: { enabled: { getSnapshot: () => boolean } };
    };
    expect(stockForms.developerTools).toBeDefined();
    expect(stockForms.developerTools.enabled.getSnapshot()).toBe(false);
    const mineForms = new ConfigForms(
      { remote: { settings: { mutate: async () => ({ ok: true }) } }, schema: mine, rehydrate: (() => ((v: unknown) => v)) as never },
      { mirror: new SettingsDescribeMirror({ describe: async () => ({ ok: true, value: { writable: false, namespaces: [] } }) }, fakeStore), createStore: fakeStore },
    );
    expect(typeof mineForms.developerTools.enabled.getSnapshot).toBe("function");
    expect(mineForms.developerTools.enabled.getSnapshot()).toBe(false);
    expect(mineForms.developerTools.scope).toBe(mineForms.get("ui-settings"));
  });
});
