/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test gói ui-plugin-market — luật một-id, slot plugins.tab nguyên văn, cổng idempotent, hành vi bộ điều khiển
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPlugin } from "../../packages/client/ui-plugin-market/src/plugin.ts";
import { DiscoverController } from "../../packages/client/ui-plugin-market/src/market-store.ts";
import {
  INITIAL_QUERY,
  declaredQuery,
  displayDeclarations,
  formatDate,
  indexLabel,
  installable,
  presentedVersion,
  sortMenuId,
  sourceFacts,
  unfiltered,
  withText,
} from "../../packages/client/ui-plugin-market/src/presentation.ts";
import type { MarketEntryLike, MarketSearchResultLike } from "../../packages/client/ui-plugin-market/src/types.ts";

/** Thư mục gói của ta (gốc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-plugin-market");
/** Tên package của ta — id duy nhất được phép đăng ký. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-plugin-market";
/** Tên package gốc — CHỈ được khai ở aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-plugin-market";
/** Slot mà bản gốc chiếm. */
const SLOT = "plugins.tab";

/** Một phiên bản tối thiểu trong chỉ mục thử. */
function version(versionText: string, compatible = true) {
  return {
    version: versionText,
    publishTimestamp: 1_700_000_000,
    source: { type: "npm" as const, registry: "https://registry.npmjs.org" },
    install: { spec: "demo@" + versionText, registry: "https://registry.npmjs.org" },
    compatibility: compatible
      ? { compatible: true }
      : { compatible: false, runtimeVersion: "0.2.1", requirements: { "engines.dsh": ">=9" }, exempted: false },
  };
}

/** Một plugin tối thiểu trong chỉ mục thử. */
function entry(name: string, overrides: Partial<MarketEntryLike> = {}): MarketEntryLike {
  return {
    name,
    metadata: { labels: [] },
    versions: [version("1.0.0")],
    defaultVersion: "1.0.0",
    installation: { status: "not-installed" },
    ...overrides,
  };
}

/** Một trang kết quả tối thiểu. */
function listing(entries: MarketEntryLike[], overrides: Partial<MarketSearchResultLike> = {}): MarketSearchResultLike {
  return {
    url: "https://market.example/index.json",
    title: { en: "Demo market" },
    metadata: { categories: {}, labels: {}, sortKeys: {} },
    fetchedAt: 1,
    entries,
    total: entries.length,
    nextOffset: null,
    ...overrides,
  };
}

/** Store tối giản thay @deepseek-ai/dsh-client-store (chỉ getSnapshot/set như row này dùng). */
function makeStore<T>(initial: T) {
  let value = initial;
  return {
    getSnapshot: (): T => value,
    set: (next: T): void => {
      value = next;
    },
  };
}

describe("row ui-plugin-market — khuôn bundle", () => {
  test("bundle đăng ký ĐÚNG MỘT id (id của ta), KHÔNG đăng ký id gốc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoá lại: id gốc đi qua gbh.row.aliases; đăng ký nó ⇒ bundle chạy hai lần ⇒ app trắng.
    expect(ids).not.toContain(STOCK_NAME);
    // Cổng chặn cài hai lần KHÔNG được khoá theo ctx (tools/check/surface.ts quét hai dấu hiệu này).
    expect(code.includes("installedContexts")).toBe(false);
    expect(code.includes("lastCtx")).toBe(false);
    expect(code.includes("marketInstalled")).toBe(true);
  });

  test("package.json khai một id + aliases giữ id gốc + đủ hai mặt", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      exports: Record<string, string>;
      dsh: { client: { inject: string[]; platform: string } };
      gbh: { row: { id: string; moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.id).toBe("ui-plugin-market");
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toEqual([STOCK_NAME]);
    expect(meta.exports["./client"]).toBe("./lib/client.js");
    // inject phải Y NHƯ bản gốc: thiếu id module thì entry nằm loading, thừa thì treo inject.
    expect(meta.dsh.client.inject).toEqual([
      "@deepseek-ai/dsh-api-remotes",
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-plugin-manager",
    ]);
    expect(meta.dsh.client.platform).toBe("web");
  });

  test("build.ts nhận thư mục đích qua process.argv[2] (thiếu ⇒ profile thiếu lib/ mà mọi phép kiểm vẫn xanh)", () => {
    const src = readFileSync(join(OURS, "build.ts"), "utf8");
    expect(src).toContain("export async function buildPackage(outDir?: string)");
    expect(src).toContain("const out = outDir ?? join(import.meta.dir, \"lib\")");
    expect(src).toContain("await buildPackage(process.argv[2])");
  });

  test("src khai slot plugins.tab NGUYÊN VĂN, id discover, component là THAM SỐ THỨ HAI", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    expect(src).toContain('name: "plugins.tab"');
    expect(src).toContain('id: "discover"');
    expect(/register\(\s*\{ name: "plugins\.tab", id: "discover"[\s\S]*?\},\s*DiscoverSection,?\s*\)/.test(src)).toBe(true);
  });

  test("cổng chống cài hai lần: PHẠM VI MODULE, và cờ bật SAU khi đăng ký xong", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let marketInstalled = false;");
    const flip = src.indexOf("marketInstalled = true;");
    expect(guard).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(guard);
    expect(src.indexOf("ctx.slots.inject")).toBeLessThan(flip);
    // Cổng phải nằm TRƯỚC JSDoc của hàm dựng plugin.
    expect(guard).toBeLessThan(src.indexOf("export function createPlugin"));
  });
});

describe("row ui-plugin-market — mặt inject và đăng ký slot", () => {
  test("apply đăng ký từ điển, nghe ba nguồn vô hiệu hoá, và chiếm plugins.tab với mặt đầy đủ", () => {
    const slots: { spec: Record<string, unknown>; component: unknown }[] = [];
    const dictionaries: string[] = [];
    const events: string[] = [];
    const effects: string[] = [];
    const remote = {
      $on: (event: string) => {
        events.push(event);
        return () => {};
      },
      pluginMarket: {
        listIndexes: () => Promise.resolve({ ok: true, value: [{ url: "https://market.example/index.json" }] }),
        search: () => Promise.resolve({ ok: true, value: listing([entry("demo")]) }),
        setIndexes: () => Promise.resolve({ ok: true, value: undefined }),
      },
    };
    const ctx = {
      effect: (callback: () => unknown, label?: string) => {
        effects.push(label ?? "?");
        return callback();
      },
      on: (event: string) => {
        events.push(event);
        return () => {};
      },
      slots: {
        inject: (_name: string, register: () => unknown) => register(),
        register: (spec: Record<string, unknown>, component: unknown) => {
          slots.push({ spec, component });
          return undefined;
        },
      },
      locale: {
        register: (namespace: string) => {
          dictionaries.push(namespace);
          return undefined;
        },
        bind: () => (key: string, params?: Record<string, string>) =>
          params === undefined ? key : key + ":" + Object.values(params).join(","),
        resolveText: (text: unknown) => {
          const record = text as Record<string, string>;
          return record["en"] ?? Object.values(record)[0] ?? "";
        },
      },
      remote,
    };
    const runtime = {
      jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => ({ type, props, key }),
      jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => ({ type, props, key }),
      Fragment: Symbol("Fragment"),
    };
    const react = {
      useState: <T,>(initial: T): [T, (next: T) => void] => [initial, () => {}],
      useEffect: (effect: () => void | (() => void)) => {
        effect();
      },
      useMemo: <T,>(factory: () => T): T => factory(),
    };
    const primitives = new Proxy({}, { get: () => () => null });
    const store = { createSnapshotStore: makeStore };
    const plugin = createPlugin((id: string) => {
      if (id === "react/jsx-runtime") return runtime;
      if (id === "react") return react;
      if (id .endsWith("-client-ui-primitives")) return primitives;
      if (id .endsWith("-client-store")) return store;
      throw new Error("require lạ: " + id);
    });
    expect(plugin.name).toBe(PACKAGE_NAME);
    expect(plugin.inject).toEqual(["slots", "locale", "remote", "remote.pluginMarket"]);
    plugin.apply(ctx as never);
    // Từ điển + tab.
    expect(dictionaries).toEqual(["pluginMarket"]);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.spec["name"]).toBe(SLOT);
    // Slot LIST BẮT BUỘC có id: thiếu ⇒ seam ném "requires options.id" ⇒ apply ném ⇒ trang chết.
    expect(slots[0]?.spec["id"]).toBe("discover");
    expect(slots[0]?.spec["locale"]).toBe("pluginMarket");
    expect(typeof slots[0]?.spec["label"]).toBe("function");
    // Component là THAM SỐ THỨ HAI của register(spec, Component).
    expect(typeof slots[0]?.component).toBe("function");
    // Ba nguồn vô hiệu hoá của bản gốc.
    expect(events).toEqual(["plugin-market/changed", "plugin-manager/changed", "connection/reset"]);
    expect(effects).toContain("ui-plugin-market: dictionaries");
    // Mặt inject có đủ mười hai hành động + hooks của bản gốc.
    const face = (slots[0]?.spec["inject"] as () => Record<string, unknown>)();
    expect(Object.keys(face).sort()).toEqual(
      [
        "addSource",
        "editDraft",
        "ensure",
        "hooks",
        "more",
        "refresh",
        "reload",
        "removeSource",
        "resolveText",
        "retry",
        "search",
        "select",
        "toggleSources",
      ].sort(),
    );
    // Vẽ thử tab bằng runtime giả: nhánh chưa đọc xong ⇒ khung xương có role status.
    const Section = slots[0]?.component as (props: Record<string, unknown>) => { props?: Record<string, unknown> } | null;
    const tree = Section({
      ...(face as Record<string, unknown>),
      t: (key: string) => key,
      install: () => {},
      openPackage: () => {},
      useDiscover: (selector: (snapshot: unknown) => unknown) => selector({ status: "ready", indexes: [], selected: null, listing: null, editing: false, draft: "", saving: false, sourceFailure: null }),
      useLocale: (selector: (snapshot: unknown) => unknown) => selector({ active: "en" }),
    }) as { props?: Record<string, unknown> } | null;
    expect(tree?.props?.["data-plugin-tab"]).toBe("discover");
  });
});

describe("row ui-plugin-market — hàm thuần của tab", () => {
  test("withText đổi thứ tự chỉ mục sang liên quan khi có chữ, và trả lại khi hết chữ", () => {
    const typed = withText(INITIAL_QUERY, "demo");
    expect(typed.sort).toEqual({ kind: "relevance" });
    expect(withText(typed, "   ").sort).toEqual({ kind: "index" });
    // Thứ tự người dùng chọn trong lúc có chữ thì giữ nguyên.
    const chosen = { ...typed, sort: { kind: "published", direction: "desc" } as const };
    expect(withText(chosen, "demo2").sort).toEqual({ kind: "published", direction: "desc" });
  });

  test("declaredQuery bỏ danh mục, nhãn và khoá sắp xếp mà chỉ mục không khai", () => {
    const metadata = {
      categories: { tools: { title: { en: "Tools" } } },
      labels: { official: { title: { en: "Official" } } },
      sortKeys: { stars: { title: { en: "Stars" }, order: "desc" as const } },
    };
    const query = { text: "", category: "missing", labels: ["official", "ghost"], sort: { kind: "key", id: "ghost", direction: "asc" } as const };
    const declared = declaredQuery(query, metadata);
    expect(declared.category).toBeNull();
    expect(declared.labels).toEqual(["official"]);
    expect(declared.sort).toEqual({ kind: "index" });
    // Mọi id đều được khai ⇒ trả CHÍNH đối tượng cũ (không tạo bản sao vô ích).
    const ok = { text: "", category: "tools", labels: ["official"], sort: { kind: "key", id: "stars", direction: "desc" } as const };
    expect(declaredQuery(ok, metadata)).toBe(ok);
  });

  test("presentedVersion lấy bản mặc định, và lùi về bản đầu khi không bản nào tương thích", () => {
    const compatible = entry("demo");
    expect(presentedVersion(compatible).version).toBe("1.0.0");
    const none = entry("demo", {
      defaultVersion: undefined,
      versions: [version("2.0.0", false), version("1.0.0", false)],
    });
    expect(presentedVersion(none).version).toBe("2.0.0");
    expect(installable(none.versions[0]!.compatibility)).toBe(false);
    expect(
      installable({ compatible: false, runtimeVersion: "0.2.1", requirements: { "engines.dsh": ">=9" }, exempted: true }),
    ).toBe(true);
  });

  test("sourceFacts nêu package + registry cho nguồn npm, và kho + commit cho nguồn git", () => {
    expect(sourceFacts("demo", version("1.2.3"))).toEqual([
      { kind: "package", value: "demo@1.2.3" },
      { kind: "registry", value: "https://registry.npmjs.org" },
    ]);
    const git = {
      ...version("1.2.3"),
      source: { type: "git" as const, url: "https://github.com/x/y", commit: "abc123", path: "packages/x" },
    };
    expect(sourceFacts("demo", git)).toEqual([
      { kind: "repository", value: "https://github.com/x/y" },
      { kind: "commit", value: "abc123" },
      { kind: "directory", value: "packages/x" },
    ]);
  });

  test("indexLabel dùng tiêu đề khi đã đọc được, ngược lại in host; URL hỏng thì in nguyên văn", () => {
    const resolve = (text: { en?: string }): string => text.en ?? "";
    expect(indexLabel({ url: "https://market.example/index.json", title: { en: "Demo" } }, resolve)).toBe("Demo");
    expect(indexLabel({ url: "https://market.example/index.json" }, resolve)).toBe("market.example");
    expect(indexLabel({ url: "khong-phai-url" }, resolve)).toBe("khong-phai-url");
  });

  test("displayDeclarations sắp theo tiêu đề đã dịch; unfiltered và sortMenuId đúng như bản gốc", () => {
    const items = { b: { title: { en: "Beta" } }, a: { title: { en: "Alpha" } } };
    expect(displayDeclarations(items, (text) => text.en ?? "", "en").map((item) => item.id)).toEqual(["a", "b"]);
    expect(unfiltered(INITIAL_QUERY)).toBe(true);
    expect(unfiltered({ ...INITIAL_QUERY, labels: ["x"] })).toBe(false);
    expect(sortMenuId({ kind: "key", id: "stars", direction: "asc" })).toBe("key:stars");
    expect(sortMenuId({ kind: "index" })).toBe("index");
    expect(formatDate(1_700_000_000, "en", "medium").length).toBeGreaterThan(0);
  });
});

describe("row ui-plugin-market — bộ điều khiển", () => {
  /** Dựng context giả có remote ghi lại lời gọi. */
  function harness(pages: Record<string, MarketSearchResultLike>, indexes: string[]) {
    const calls: { search: unknown[]; setIndexes: string[][] } = { search: [], setIndexes: [] };
    const ctx = {
      effect: () => undefined,
      on: () => () => {},
      slots: { inject: () => undefined, register: () => undefined },
      locale: { register: () => undefined, bind: () => () => "", resolveText: () => "" },
      remote: {
        $on: () => () => {},
        pluginMarket: {
          listIndexes: () => Promise.resolve({ ok: true, value: indexes.map((url) => ({ url })) }),
          search: (url: string, query: Record<string, unknown>) => {
            calls.search.push({ url, query });
            const page = pages[url];
            return Promise.resolve(page === undefined ? { ok: false, error: { code: "plugin-market/fetch-failed", message: "no" } } : { ok: true, value: page });
          },
          setIndexes: (urls: string[]) => {
            calls.setIndexes.push(urls);
            return Promise.resolve({ ok: true, value: undefined });
          },
        },
      },
    };
    const controller = new DiscoverController(ctx as never, makeStore as never);
    return { controller, ctx, calls };
  }

  test("ensure đọc nguồn, chọn nguồn đầu và nạp niêm yết của nó", async () => {
    const url = "https://market.example/index.json";
    const { controller, calls } = harness({ [url]: listing([entry("demo")]) }, [url]);
    controller.face((text) => String(text));
    controller.face(() => "");
    const face = controller.face(() => "");
    face.ensure();
    await Bun.sleep(1);
    const state = controller.store.getSnapshot();
    expect(state.status).toBe("ready");
    expect(state.selected).toBe(url);
    expect(state.listing?.status).toBe("ready");
    expect(state.listing?.value?.entries.map((item) => item.name)).toEqual(["demo"]);
    expect(calls.search.length).toBe(1);
    // ensure lần hai không đọc lại (chỉ đọc khi còn idle).
    face.ensure();
    await Bun.sleep(1);
    expect(calls.search.length).toBe(1);
  });

  test("nguồn rỗng ⇒ không niêm yết, và tab rơi vào nhánh 'chưa có thị trường'", async () => {
    const { controller } = harness({}, []);
    const face = controller.face(() => "");
    face.ensure();
    await Bun.sleep(1);
    const state = controller.store.getSnapshot();
    expect(state.status).toBe("ready");
    expect(state.selected).toBeNull();
    expect(state.listing).toBeNull();
  });

  test("lỗi đọc chỉ mục ⇒ status error; retry chạy lại lượt đọc niêm yết đã hỏng", async () => {
    const url = "https://market.example/index.json";
    const { controller, ctx } = harness({ [url]: listing([entry("demo")]) }, [url]);
    const face = controller.face(() => "");
    face.ensure();
    await Bun.sleep(1);
    // Đổi remote sang lỗi chỉ mục sai định dạng ⇒ lần đọc sau ghi failure 'invalid'.
    ctx.remote.pluginMarket.search = () =>
      Promise.resolve({ ok: false, error: { code: "plugin-market/invalid-index", message: "bad" } });
    face.refresh();
    await Bun.sleep(1);
    expect(controller.store.getSnapshot().listing?.failure).toBe("invalid");
    face.retry();
    await Bun.sleep(1);
    expect(controller.store.getSnapshot().listing?.status).toBe("error");
  });

  test("addSource ghi danh sách nguồn kèm URL nháp rồi chọn nguồn vừa thêm", async () => {
    const first = "https://a.example/index.json";
    const second = "https://b.example/index.json";
    const { controller, calls } = harness({ [first]: listing([entry("one")]), [second]: listing([entry("two")]) }, [first]);
    const face = controller.face(() => "");
    face.ensure();
    await Bun.sleep(1);
    face.editDraft("  " + second + "  ");
    expect(controller.store.getSnapshot().draft).toBe("  " + second + "  ");
    face.addSource();
    await Bun.sleep(1);
    expect(calls.setIndexes).toEqual([[first, second]]);
    // Danh sách nguồn của remote chưa đổi trong harness này ⇒ chọn vẫn là nguồn cũ; ô nháp đã được xoá.
    expect(controller.store.getSnapshot().draft).toBe("");
    expect(controller.store.getSnapshot().saving).toBe(false);
  });

  test("dispose chặn kết quả về muộn (không công bố trạng thái sau khi gỡ)", async () => {
    const url = "https://market.example/index.json";
    const { controller } = harness({ [url]: listing([entry("demo")]) }, [url]);
    const face = controller.face(() => "");
    face.ensure();
    controller.dispose();
    await Bun.sleep(1);
    expect(controller.store.getSnapshot().status).toBe("loading");
  });
});
