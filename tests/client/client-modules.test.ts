/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test hanh vi bo nap module client bang CHINH fixture that c1-boot-graph.json (72 entry, 3 batch)
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { profileModulesDir, readDshAliasMap } from "../../packages/client/modules/src/remap.ts";
import { ClientModuleSystem, type RegistrationTarget } from "../../packages/client/modules/src/client/system.ts";
import { parseBootManifest, stripClientSuffix } from "../../packages/client/modules/src/client/manifest.ts";
import { ClientEntries, type ClientLoader, type LoaderEntry } from "../../packages/client/modules/src/client/entries.ts";

/** Fixture thật: đồ thị boot đo từ oracle, nguyên văn. */
const FIXTURE = join(import.meta.dir, "..", "contract", "fixtures", "c1-boot-graph.json");
/** Revision thay cho chỗ giữ `<rev>` của fixture: chỉ cần ổn định và duy nhất trong một lần chạy. */
const REV = "0123456789ab";
/** Package bootstrap của fixture (row `modules` bản stock lúc chụp). */
const BOOTSTRAP_ID = "@deepseek-ai/dsh-client-modules";

/**
 * Ba global mà mã client đọc trực tiếp. Bun KHÔNG có DOM, nên mỗi ca trong file này phải bắt đầu
 * với chúng VẮNG MẶT: một file test khác cài `globalThis.document` giả rồi quên gỡ sẽ làm bộ nạp
 * đi nhầm nhánh "đang ở trình duyệt" (đo được: ui-settings-general từng để lại document thiếu
 * `querySelectorAll` ⇒ 12 ca của file này đỏ khi chạy CẢ bộ, xanh khi chạy riêng).
 */
interface SandboxGlobals {
  /** `document` (chỉ tồn tại trong trình duyệt). */
  document?: unknown;
  /** `window` (chỉ tồn tại trong trình duyệt). */
  window?: unknown;
  /** Facade `window.__ModuleLoader__` — file này truyền facade qua tham số, không đọc global. */
  __ModuleLoader__?: unknown;
}

/** Ảnh chụp ba global NGAY TRƯỚC ca đang chạy, để trả nguyên trạng sau khi ca xong. */
let savedGlobals: SandboxGlobals | undefined;

/**
 * Trả một global về đúng trạng thái trước ca: cũ là `undefined` thì xoá hẳn khoá, còn lại thì gán lại.
 * Nhận: phạm vi global, tên khoá, giá trị cũ.
 * Trả: không.
 */
function restoreGlobal(scope: SandboxGlobals, key: keyof SandboxGlobals, value: unknown): void {
  if (value === undefined) delete scope[key];
  else scope[key] = value;
}

// Dựng lại trạng thái sạch trước MỖI ca rồi khôi phục nguyên trạng sau mỗi ca: thứ tự chạy file
// không còn đổi được kết quả của file này.
beforeEach(() => {
  const scope = globalThis as SandboxGlobals;
  savedGlobals = { document: scope.document, window: scope.window, __ModuleLoader__: scope.__ModuleLoader__ };
  restoreGlobal(scope, "document", undefined);
  restoreGlobal(scope, "window", undefined);
  restoreGlobal(scope, "__ModuleLoader__", undefined);
});

afterEach(() => {
  const scope = globalThis as SandboxGlobals;
  const saved = savedGlobals ?? {};
  restoreGlobal(scope, "document", saved.document);
  restoreGlobal(scope, "window", saved.window);
  restoreGlobal(scope, "__ModuleLoader__", saved.__ModuleLoader__);
  savedGlobals = undefined;
});

/** Một dòng entry của đồ thị fixture. */
interface FixtureEntry {
  /** Tên package. */
  id: string;
  /** URL một-plugin. */
  url: string;
  /** Revision. */
  rev: string;
  /** Package phải nạp trước. */
  inject?: string[];
  /** Yêu cầu module động. */
  external?: string[];
  /** Tier nạp ngay. */
  immediately?: boolean;
}

/** Một batch của đồ thị fixture. */
interface FixtureBatch {
  /** Pha khởi động. */
  phase: string;
  /** URL combo. */
  url: string;
  /** Revision combo. */
  rev: string;
  /** Id các entry. */
  entries: string[];
}

/** Bản chụp fixture: các dòng/batch cộng thêm metadata hợp đồng đã ghi lúc chụp. */
interface FixtureCapture {
  /** Phiên bản release của Host lúc chụp. */
  releaseVersion: string;
  /** Commit nguồn của Host lúc chụp. */
  releaseCommit: string;
  /** Khoá cấp 1 của `__DSH_BOOT__` lúc chụp (hợp đồng C1). */
  topKeys: string[];
  /** Các dòng entry. */
  entries: FixtureEntry[];
  /** Các batch. */
  batches: FixtureBatch[];
  /** Kết luận đã ĐO của lần chụp: id mồ côi và các chu trình. */
  graph: { unresolved: string[]; cycles: string[] };
}

/** Đồ thị fixture đã dựng lại thành wire thật, với revision đã thay. */
interface FixtureGraph {
  /** Revision đồ thị. */
  rev: string;
  /** Danh tính release. */
  release: { version: string; commit?: string };
  /** Các dòng entry. */
  entries: FixtureEntry[];
  /** Các batch. */
  batches: FixtureBatch[];
}

/**
 * Đọc fixture thật, thay mọi chỗ giữ `<rev>` bằng một revision ổn định, rồi dựng lại đúng wire
 * mà Host đã phát cho trang — fixture lưu các phần rời (entries/batches + danh tính release).
 * Nhận: không.
 * Trả: bản chụp đã parse và đồ thị wire tương ứng.
 */
function loadFixture(): { capture: FixtureCapture; graph: FixtureGraph } {
  const capture = JSON.parse(readFileSync(FIXTURE, "utf8").split("<rev>").join(REV)) as FixtureCapture;
  const graph: FixtureGraph = {
    rev: REV,
    release: { version: capture.releaseVersion, commit: capture.releaseCommit },
    entries: capture.entries,
    batches: capture.batches,
  };
  return { capture, graph };
}

/**
 * Đọc riêng đồ thị wire của fixture.
 * Nhận: không.
 * Trả: đồ thị wire.
 */
function loadGraph(): FixtureGraph {
  return loadFixture().graph;
}

/** Trang giả: facade đăng ký, bộ nạp script và sổ ghi các URL đã yêu cầu. */
interface FakePage {
  /** Facade `window.__ModuleLoader__`. */
  target: RegistrationTarget;
  /** URL đã được yêu cầu, theo thứ tự. */
  requested: string[];
  /** Id mà bộ nạp giả sẽ làm hỏng (mọi URL chứa nó). */
  failing: Set<string>;
  /** Id đã đăng ký (một batch chỉ chạy một lần). */
  registered: Set<string>;
  /** Bộ nạp script truyền cho hệ module. */
  loadBundle: (url: string) => Promise<void>;
}

/**
 * Tách id các entry mà một URL combo bao phủ.
 * Nhận: URL dạng `plugins/??a/client.js,b/client.js&rev=..` (hoặc một tài nguyên đơn).
 * Trả: danh sách id.
 */
function idsOf(url: string): string[] {
  const start = url.indexOf("??");
  if (start < 0) return [];
  const rest = url.slice(start + 2);
  const stop = rest.indexOf("&rev=");
  const list = stop < 0 ? rest : rest.slice(0, stop);
  return list
    .split(",")
    .map((part) => stripClientSuffix(part.split("/client.js")[0] ?? part))
    .filter((id) => id !== "");
}

/**
 * Dựng một trang giả: facade đăng ký + bộ nạp script mô phỏng đúng cách HTML nạp combo.
 * Mỗi URL combo đăng ký factory cho MỌI id nó chứa; factory require đúng các yêu cầu `external`
 * của dòng đó (giống bundle thật), nên đường vạt chất hoá đệ quy cũng được chạy thật.
 * Nhận: đồ thị đang dùng và bảng seed nền tảng.
 * Trả: trang giả.
 */
function createPage(graph: FixtureGraph, seeds: Record<string, unknown>): FakePage {
  const requested: string[] = [];
  const failing = new Set<string>();
  const registered = new Set<string>();
  const rows = new Map(graph.entries.map((entry) => [entry.id, entry]));
  const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
  const page: FakePage = {
    target,
    requested,
    failing,
    registered,
    loadBundle: async (url) => {
      requested.push(url);
      if (url.includes("client.js.map")) return;
      const ids = idsOf(url);
      const broken = ids.find((id) => failing.has(id));
      if (broken !== undefined) throw new Error("bundle script " + url + " failed to load");
      for (const id of ids) {
        if (registered.has(id)) continue;
        registered.add(id);
        const row = rows.get(id);
        const external = row?.external ?? [];
        target.load({
          id,
          factory: (require) => ({
            id,
            loaded: external.map((specifier) => require(specifier)),
          }),
        });
      }
    },
  };
  page.loadBundle = page.loadBundle.bind(page);
  return page;
}

/**
 * Id được tham chiếu bởi `external` nhưng KHÔNG phải một dòng trong đồ thị: chúng phải có mặt trong
 * bảng seed nền tảng (bundle gộp của vỏ), nếu không thì require sẽ ném lỗi.
 * Nhận: đồ thị.
 * Trả: bảng seed với mọi id mồ côi như vậy.
 */
function orphanSeeds(graph: FixtureGraph): Record<string, unknown> {
  const rowIds = new Set(graph.entries.map((entry) => entry.id));
  const seeds: Record<string, unknown> = { react: { react: true }, "react-dom": { reactDom: true } };
  for (const entry of graph.entries) {
    for (const specifier of entry.external ?? []) {
      const id = stripClientSuffix(specifier);
      if (!rowIds.has(id)) seeds[id] = { merged: true, id };
    }
  }
  return seeds;
}

/**
 * Dựng hệ module trên đồ thị fixture với một trang giả.
 * Nhận: đồ thị và trang giả.
 * Trả: hệ module đã sẵn sàng.
 */
function createSystem(graph: FixtureGraph, page: FakePage): ClientModuleSystem {
  return new ClientModuleSystem({
    manifest: graph,
    staticModules: orphanSeeds(graph),
    registrationTarget: page.target,
    bootstrapModule: { id: BOOTSTRAP_ID, exports: { apply: () => undefined, createClientModuleSystem: () => undefined } },
    loadBundle: (url) => page.loadBundle(url),
  });
}

describe("cách ly môi trường — global của file test khác không rò vào file này", () => {
  test("document · window · __ModuleLoader__ đều VẮNG trước mỗi ca (Bun không có DOM)", () => {
    const scope = globalThis as SandboxGlobals;
    // Ca này CHÍNH LÀ phép đo lỗi rò: chạy sau một file để lại document giả mà thiếu harness
    // dựng lại trạng thái thì nó đỏ, còn có harness thì luôn xanh bất kể thứ tự file.
    expect("document" in scope).toBe(false);
    expect("window" in scope).toBe(false);
    expect("__ModuleLoader__" in scope).toBe(false);
  });
});

describe("bộ nạp module client — dữ liệu thật c1-boot-graph.json", () => {
  test("fixture thật: 72 entry, 3 batch, 1 id mồ côi và 2 chu trình qua inject", () => {
    const { capture, graph } = loadFixture();
    expect(graph.entries.length).toBe(72);
    expect(graph.batches.length).toBe(3);
    expect(capture.topKeys).toEqual(["batches", "entries", "release", "rev"]);
    expect(graph.batches.map((batch) => batch.phase)).toEqual(["bootstrap", "application", "application"]);
    expect(graph.batches.map((batch) => batch.entries.length)).toEqual([1, 57, 14]);

    const rowIds = new Set(graph.entries.map((entry) => entry.id));
    const referenced = new Set<string>();
    for (const entry of graph.entries) {
      for (const specifier of [...(entry.inject ?? []), ...(entry.external ?? [])]) referenced.add(stripClientSuffix(specifier));
    }
    const orphans = [...referenced].filter((id) => !rowIds.has(id));
    expect(orphans).toEqual(["@deepseek-ai/dsh-client-ui-primitives"]);
    expect(orphans).toEqual(capture.graph.unresolved);

    // Chu trình qua `inject`: Loader chờ service nên bộ nạp phải chịu được, không được ném lỗi.
    const injectEdges = new Map<string, string[]>();
    for (const entry of graph.entries) injectEdges.set(entry.id, (entry.inject ?? []).filter((id) => rowIds.has(id)));
    const cycles = findCycles(injectEdges);
    expect(cycles.length).toBe(2);
    expect(cycles.map((cycle) => cycle.join(" -> ")).sort()).toEqual([...capture.graph.cycles].sort());
  });

  test("parseBootManifest nhận đủ 72 dòng và gán batch đầu tiên cho từng dòng", () => {
    const graph = loadGraph();
    const manifest = parseBootManifest(graph);
    expect(manifest.modules.length).toBe(72);
    expect(manifest.plugins.length).toBe(72);
    for (const row of manifest.modules) {
      expect(row.initialUrl.length).toBeGreaterThan(0);
      expect(manifest.rev).toBe(graph.rev);
    }
  });

  test("nạp đủ 72 entry, mỗi entry vạt chất hoá đúng một lần", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    for (const entry of graph.entries) {
      const exports = await system.import(entry.id);
      if (entry.id === BOOTSTRAP_ID) {
        expect(exports).toBe(system.loadCache.get(BOOTSTRAP_ID)?.exports);
        continue;
      }
      expect((exports as { id: string }).id).toBe(entry.id);
    }
    expect(system.loadCache.size).toBe(72);
    expect(page.requested.length).toBe(2);
    expect(page.requested).not.toContain(graph.batches[0]?.url ?? "");
  });

  test("chịu được 2 chu trình qua inject: nạp conversation và workspace đều trả export", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    const conversation = (await system.import("@deepseek-ai/dsh-client-ui-conversation")) as { id: string };
    const workspace = (await system.import("@deepseek-ai/dsh-client-ui-workspace")) as { id: string };
    const sidebar = (await system.import("@deepseek-ai/dsh-client-ui-sidebar")) as { id: string };
    expect(conversation.id).toBe("@deepseek-ai/dsh-client-ui-conversation");
    expect(workspace.id).toBe("@deepseek-ai/dsh-client-ui-workspace");
    expect(sidebar.id).toBe("@deepseek-ai/dsh-client-ui-sidebar");
  });

  test("chịu được id mồ côi: 4 dòng inject nó mà nó KHÔNG phải row, và nó không nạp được như một dòng", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    const orphan = "@deepseek-ai/dsh-client-ui-primitives";
    expect(graph.entries.some((entry) => entry.id === orphan)).toBe(false);
    const owners = graph.entries.filter((entry) => (entry.inject ?? []).some((id) => stripClientSuffix(id) === orphan));
    expect(owners.length).toBe(4);
    for (const owner of owners) {
      const exports = (await system.import(owner.id)) as { id: string };
      expect(exports.id).toBe(owner.id);
    }
    await expect(system.import(orphan)).rejects.toThrow(/cannot resolve ".*dsh-client-ui-primitives"/);
  });

  test("thứ tự batch: dependency nạp trước consumer, batch bootstrap không bao giờ bị yêu cầu lại", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    await system.prefetch(graph.batches[1]?.entries[0] ?? "");
    expect([...new Set(page.requested)]).toEqual([graph.batches[2]?.url ?? "", graph.batches[1]?.url ?? ""]);
    expect(page.requested).not.toContain(graph.batches[0]?.url ?? "");
  });

  test("entry thiếu bundle: báo lỗi rõ ràng trong thời gian hữu hạn, KHÔNG treo", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const missing = "@deepseek-ai/dsh-client-ui-goal";
    page.failing.add(missing);
    const system = createSystem(graph, page);
    const outcome = await Promise.race([
      system.import(missing).then(
        () => "resolved",
        (error: Error) => error,
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve("treo"), 2000)),
    ]);
    expect(outcome).not.toBe("treo");
    const error = outcome as Error;
    expect(error.message).toContain('client-modules: could not load "' + missing + '"');
    expect(error.message).toContain("failed to load");
    expect(error.message).toContain("/client.js");
  });

  test("một batch hỏng không kéo theo các dòng khác cùng batch", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const missing = "@deepseek-ai/dsh-client-ui-goal";
    page.failing.add(missing);
    const system = createSystem(graph, page);
    await expect(system.import(missing)).rejects.toThrow(/could not load/);
    const neighbour = graph.batches[1]?.entries.find((id) => id !== missing) ?? "";
    const exports = (await system.import(neighbour)) as { id: string };
    expect(exports.id).toBe(neighbour);
  });

  test("script chạy hai lần CÙNG nguồn ⇒ cảnh báo, GIỮ factory đầu (không từ chối)", async () => {
    const id = "@galaxy-blackhole/gbh-same-src";
    const rev = "r1";
    const url = "plugins/??" + id + "/client.js&rev=" + rev;
    const graph = { rev, release: { version: "1.0.0", commit: "abc" }, entries: [{ id, url, rev }], batches: [{ phase: "application" as const, url, rev, entries: [id] }] };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => {
        target.load({ id, factory: () => ({ mark: "first" }), sourceUrl: "app://bundle-a" });
        target.load({ id, factory: () => ({ mark: "second" }), sourceUrl: "app://bundle-a" });
      },
    });
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
    let loaded: { mark?: string };
    try { loaded = (await system.import(id)) as { mark?: string }; } finally { console.warn = original; }
    expect(loaded.mark).toBe("first");
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("same bundle source");
  });

  test("hai bundle KHÁC nguồn cùng cấp một id ⇒ VẪN từ chối (trùng thật)", () => {
    const id = "@galaxy-blackhole/gbh-diff-src";
    const rev = "r1";
    const url = "plugins/??" + id + "/client.js&rev=" + rev;
    const graph = { rev, release: { version: "1.0.0", commit: "abc" }, entries: [{ id, url, rev }], batches: [{ phase: "application" as const, url, rev, entries: [id] }] };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    // eslint-disable-next-line no-new -- chỉ cần facade tiếp quản `target.load`
    new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => undefined,
    });
    target.load({ id, factory: () => ({}), sourceUrl: "app://bundle-a" });
    expect(() => target.load({ id, factory: () => ({}), sourceUrl: "app://bundle-b" })).toThrow(/DIFFERENT bundle/);
  });

  test("chunk cục bộ: require.async nạp `client.<ten>.js` rồi memoize", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    const owner = "@deepseek-ai/dsh-client-ui-sidebar-terminal";
    const row = graph.entries.find((entry) => entry.id === owner);
    expect(row).toBeDefined();
    const chunkName = "client.terminal.js";
    const arrive = page.loadBundle;
    page.loadBundle = async (url: string) => {
      if (!url.includes(chunkName)) return arrive(url);
      expect(url.startsWith("plugins/" + owner + "/" + chunkName + "?rev=")).toBe(true);
      page.requested.push(url);
      page.target.load({ id: owner, chunk: chunkName, factory: () => ({ chunk: true }) });
    };
    system.register({ id: owner, factory: (require) => require.async("./" + chunkName) });
    const first = await system.import(owner);
    expect(first).toEqual({ chunk: true });
    const second = await system.import(owner);
    expect(second).toEqual({ chunk: true });
    expect(page.requested.filter((url) => url.includes(chunkName)).length).toBe(1);
  });
});

/**
 * Tìm mọi chu trình của một đồ thị có hướng.
 * Nhận: bảng kề.
 * Trả: danh sách chu trình, mỗi chu trình là dãy id.
 */
function findCycles(edges: Map<string, string[]>): string[][] {
  const state = new Map<string, number>();
  const stack: string[] = [];
  const found: string[][] = [];
  const visit = (id: string): void => {
    state.set(id, 1);
    stack.push(id);
    for (const next of edges.get(id) ?? []) {
      const seen = state.get(next) ?? 0;
      if (seen === 1) found.push([...stack.slice(stack.indexOf(next)), next]);
      else if (seen === 0) visit(next);
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of edges.keys()) if ((state.get(id) ?? 0) === 0) visit(id);
  return found;
}

describe("bộ điều phối entry — đồ thị thật", () => {
  test("start tạo một entry cho mỗi dòng plugin và không có lỗi", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    const created: string[] = [];
    const loader: ClientLoader = {
      ctx: { effect: () => undefined },
      entries: () => created.map((name) => fakeEntry(name)),
      ensureId: (options) => options.name,
      create: async (options) => {
        created.push(options.name);
        await system.prefetch(options.name);
        return undefined;
      },
      resolve: (entryId) => fakeEntry(entryId),
      remove: () => undefined,
      await: async () => undefined,
    };
    const entries = new ClientEntries(system, {
      update: () => undefined,
      invalidateForReplacement: () => undefined,
      prune: () => undefined,
    });
    await entries.start(loader, system.manifest);
    expect(created.length).toBe(72);
    expect(created[0]).toBe(graph.entries[0]?.id ?? "");
    expect(entries.state.getSnapshot().failures).toEqual([]);
  });

  test("đồ thị của release KHÁC không được áp, và cổng release báo thay đổi", async () => {
    const graph = loadGraph();
    const page = createPage(graph, {});
    const system = createSystem(graph, page);
    const entries = new ClientEntries(system, {
      update: () => undefined,
      invalidateForReplacement: () => undefined,
      prune: () => undefined,
    });
    let notified = 0;
    entries.releaseChange.subscribe(() => {
      notified += 1;
    });
    const other = { ...graph, release: { version: "9.9.9", commit: "deadbeef" }, entries: [], batches: [] };
    await entries.sync(other);
    expect(notified).toBeGreaterThan(0);
    expect(entries.releaseChange.getSnapshot()?.host?.version).toBe("9.9.9");
    expect(system.manifest.rev).toBe(graph.rev);
  });
});

/**
 * Entry Loader giả tối thiểu cho bộ điều phối.
 * Nhận: tên entry.
 * Trả: entry với fiber đã ACTIVE.
 */
function fakeEntry(name: string): LoaderEntry {
  const fiber = {
    state: 2,
    await: async () => undefined,
    update: () => undefined,
    inertia: undefined,
    runtime: null,
  };
  return {
    id: name,
    options: { name },
    fiber,
    ctx: { effect: () => undefined, registry: { delete: () => undefined } },
    refresh: async () => undefined,
  };
}

/** Đồ thị nhỏ cho phép thử alias: một row khai alias id stock, một consumer require id stock đó. */
function aliasGraph() {
  const rev = "0123456789ab";
  const ours = "@galaxy-blackhole/gbh-ours";
  const stock = "@deepseek-ai/dsh-stock";
  const consumer = "@galaxy-blackhole/gbh-consumer";
  const boot = "@galaxy-blackhole/gbh-boot";
  return {
    rev,
    release: { version: "0.1.0" },
    entries: [
      { id: boot, url: "plugins/??" + boot + "/client.js&rev=" + rev, rev, inject: [] },
      { id: ours, url: "plugins/??" + ours + "/client.js&rev=" + rev, rev, inject: [], aliases: [stock] },
      { id: consumer, url: "plugins/??" + consumer + "/client.js&rev=" + rev, rev, inject: [], external: [stock + "/client"] },
    ],
    batches: [
      { phase: "bootstrap", url: "plugins/??" + boot + "/client.js&rev=" + rev, rev, entries: [boot] },
      { phase: "application", url: "plugins/??" + ours + "/client.js," + consumer + "/client.js&rev=" + rev, rev, entries: [ours, consumer] },
    ],
  };
}

describe("alias id module — khai báo gbh.row.aliases, loader lo HMR", () => {
  test("manifest đọc được danh sách alias của dòng", () => {
    const manifest = parseBootManifest(aliasGraph());
    const row = manifest.modules.find((entry) => entry.id === "@galaxy-blackhole/gbh-ours");
    expect(row?.aliases).toEqual(["@deepseek-ai/dsh-stock"]);
    expect(manifest.modules.find((entry) => entry.id === "@galaxy-blackhole/gbh-consumer")?.aliases).toEqual([]);
  });

  test("gói phụ thuộc require id ALIAS ⇒ nhận ĐÚNG MỘT instance của module row sở hữu", async () => {
    const graph = aliasGraph();
    const rev = graph.rev;
    const ours = "@galaxy-blackhole/gbh-ours";
    const stock = "@deepseek-ai/dsh-stock";
    const consumer = "@galaxy-blackhole/gbh-consumer";
    const page = createPage(graph as never, {});
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    const system = new ClientModuleSystem({
      manifest: graph,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async (url: string) => {
        page.requested.push(url);
        if (url.includes(ours)) {
          // Bundle thật của row hai mặt gọi load() HAI lần: id của ta và id alias đã khai.
          const factory = () => ({ id: ours, marker: "ours" });
          target.load({ id: ours, factory });
          target.load({ id: stock, factory });
        } else if (url.includes(consumer)) {
          target.load({ id: consumer, factory: (require: (spec: string) => unknown) => ({ seen: require(stock + "/client") }) });
        }
      },
    });
    const oursExports = await system.import(ours);
    const consumerExports = (await system.import(consumer)) as { seen: unknown };
    // ALIAS không còn là bản ghi Y HỆT: nó là bản sao có `apply` no-op (một bundle ⇒ MỘT plugin, N id).
    const seen = consumerExports.seen as { id?: string; marker?: string; apply?: () => void };
    const ownerView = oursExports as { id?: string; marker?: string; apply?: () => void };
    expect(seen.id).toBe(ownerView.id);
    expect(seen.marker).toBe(ownerView.marker);
    expect(typeof seen.apply).toBe("function");
    expect(seen.apply).not.toBe(ownerView.apply); // cài plugin lần hai là NO-OP
    expect(system.ownerOf(stock)).toBe(ours); // hai id quy về CÙNG một row sở hữu (nền của hợp đồng một-plugin)
    expect(page.requested.some((url) => url.includes(ours) && url.includes(consumer))).toBe(true);
  });

  test("vô hiệu hoá row sở hữu ⇒ xoá CẢ khoá alias (HMR không giữ code cũ)", async () => {
    const graph = aliasGraph();
    const ours = "@galaxy-blackhole/gbh-ours";
    const stock = "@deepseek-ai/dsh-stock";
    const consumer = "@galaxy-blackhole/gbh-consumer";
    const page = createPage(graph as never, {});
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    let generation = 0;
    const system = new ClientModuleSystem({
      manifest: graph,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async (url: string) => {
        page.requested.push(url);
        if (url.includes(ours)) {
          generation += 1;
          const mark = "v" + String(generation);
          target.load({ id: ours, factory: () => ({ mark }) });
          target.load({ id: stock, factory: () => ({ mark }) });
        } else if (url.includes(consumer)) {
          // Consumer yêu cầu id ALIAS, đúng như bundle stock require id stock.
          target.load({ id: consumer, factory: (require: (spec: string) => unknown) => ({ seen: require(stock + "/client") }) });
        }
      },
    });
    await system.import(ours);
    await system.import(consumer);
    expect((system.loadCache.get(stock)?.exports as { mark: string }).mark).toBe("v1");
    expect(system.loadCache.get(stock)).toBe(system.loadCache.get(ours));
    system.invalidate(ours);
    // Khoá alias phải bị xoá cùng row sở hữu: id alias không còn factory/cache nào.
    await expect(system.import(stock)).rejects.toThrow(/cannot resolve/);
    expect(system.loadCache.has(stock)).toBe(false);
    expect(system.loadCache.has(ours)).toBe(false);
    await system.import(ours);
    expect((system.loadCache.get(ours)?.exports as { mark: string }).mark).toBe("v2");
    // Consumer cũ đã memoize nên nó giữ bản v1; đường ALIAS phải trả bản mới và dùng CHUNG một bản ghi.
    const viaAlias = (await system.import(stock)) as { mark: string };
    expect(viaAlias.mark).toBe("v2");
    expect(system.loadCache.get(stock)).toBe(system.loadCache.get(ours));
  });
});


describe("entry alias — hai entry cùng URL, MỘT lần nạp", () => {
  test("host phát entry id stock trỏ về URL row sở hữu; bundle chỉ chạy một lần, hai id cùng một bản ghi", async () => {
    const ours = "@galaxy-blackhole/gbh-owner";
    const stock = "@deepseek-ai/dsh-stock-alias";
    const rev = "r1";
    const url = "plugins/??" + ours + "/client.js&rev=" + rev;
    const graph = {
      rev,
      release: { version: "1.0.0", commit: "abc" },
      entries: [
        { id: ours, url, rev, aliases: [stock] },
        { id: stock, url, rev },
      ],
      batches: [{ phase: "application", url, rev, entries: [ours, stock] }],
    };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    let loads = 0;
    let installs = 0; // số lần vỏ CÀI plugin (apply) — hợp đồng: một bundle ⇒ đúng MỘT lần
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => {
        loads += 1;
        // Bundle tự đăng ký id CỦA NÓ (khuôn một-id); entry alias dùng chung URL nên không nạp lần hai.
        target.load({ id: ours, factory: () => ({ mark: "once", apply: () => { installs += 1; } }) });
      },
    });
    // Thứ tự THẬT trong app: entry alias (id stock) tới TRƯỚC entry của ta.
    const viaStock = await system.import(stock);
    const viaOwner = await system.import(ours);
    expect(loads).toBe(1); // CÙNG URL ⇒ đúng MỘT lần nạp (không lần thực thi thứ hai ⇒ không duplicate registration)
    // HỢP ĐỒNG: MỘT bundle ⇒ MỘT plugin. Entry id sở hữu nhận export THẬT (vỏ cài plugin ở đây);
    // entry ALIAS nhận bản sao có `apply` no-op ⇒ vỏ không cài plugin lần thứ hai ⇒ `service has been registered` không xảy ra.
    const ownerExports = viaOwner as { apply?: () => void; mark?: string };
    const aliasExports = viaStock as { apply?: () => void; mark?: string };
    expect(typeof ownerExports.apply).toBe("function");
    expect(typeof aliasExports.apply).toBe("function");
    expect(aliasExports.apply).not.toBe(ownerExports.apply);
    expect(aliasExports.mark).toBe(ownerExports.mark); // consumer vẫn dùng được export thật
    (ownerExports.apply as () => void)();  // vỏ cài plugin cho ENTRY SỞ HỮU
    (aliasExports.apply as () => void)();  // vỏ cài cho ENTRY ALIAS ⇒ phải là no-op
    expect(installs).toBe(1);              // ⇒ `apply` chạy ĐÚNG MỘT LẦN cho một bundle hai id
    expect(system.loadCache.get(stock)?.exports).not.toBe(ownerExports);
  });
});


describe("apply của MỌI plugin — không còn bị cordis nuốt im lặng", () => {
  test("apply ném ⇒ có console.error KÈM ID và lỗi vẫn được ném tiếp", async () => {
    const id = "@galaxy-blackhole/gbh-boom";
    const rev = "r1";
    const url = "plugins/??" + id + "/client.js&rev=" + rev;
    const graph = {
      rev,
      release: { version: "1.0.0", commit: "abc" },
      entries: [{ id, url, rev }],
      batches: [{ phase: "application", url, rev, entries: [id] }],
    };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => {
        target.load({
          id,
          factory: () => ({ inject: ["slots"], apply: () => { throw new Error("boom"); } }),
        });
      },
    });
    const plugin = (await system.import(id)) as { inject?: string[]; apply: (ctx: unknown) => unknown };
    expect(plugin.inject).toEqual(["slots"]); // bản bọc GIỮ NGUYÊN mọi trường khác
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { lines.push(String(args[0])); };
    try {
      expect(() => plugin.apply({})).toThrow("boom"); // KHÔNG nuốt: lỗi vẫn ném tiếp
    } finally {
      console.error = original;
    }
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain(id);      // log KÈM ID ⇒ lần sau không phải suy luận tầng nào
    expect(lines[0]).toContain("boom");
  });
});


describe("entry alias với URL KHÁC — neo theo danh tính bundle, không theo URL", () => {
  test("alias trỏ URL khác vẫn KHÔNG nạp lại bundle của row sở hữu (không duplicate factory)", async () => {
    const ours = "@galaxy-blackhole/gbh-owner2";
    const stock = "@deepseek-ai/dsh-stock2";
    const rev = "r2";
    const urlOwner = "plugins/??" + ours + "/client.js&rev=" + rev;
    const urlAlias = "plugins/??bootstrap-combo/client.js&rev=" + rev; // CỐ Ý khác URL (đúng ca bootstrap vs combo)
    const graph = {
      rev,
      release: { version: "1.0.0", commit: "abc" },
      entries: [
        { id: ours, url: urlOwner, rev, aliases: [stock] },
        { id: stock, url: urlAlias, rev },
      ],
      batches: [
        { phase: "bootstrap" as const, url: urlOwner, rev, entries: [ours] },
        { phase: "application" as const, url: urlAlias, rev, entries: [stock] },
      ],
    };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    let loads = 0;
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => {
        loads += 1;
        target.load({ id: ours, factory: () => ({ mark: "once", apply: () => undefined }) });
      },
    });
    await system.import(ours);
    const viaAlias = (await system.import(stock)) as { mark?: string };
    expect(loads).toBe(1); // KHÔNG nạp URL thứ hai ⇒ không có lần thực thi thứ hai
    expect(viaAlias.mark).toBe("once");
  });
});


describe("đăng ký trùng — cảnh báo, KHÔNG giết trang", () => {
  test("script chạy hai lần: lần hai là no-op + console.warn, factory ĐẦU được giữ", async () => {
    const id = "@galaxy-blackhole/gbh-twice";
    const rev = "r1";
    const url = "plugins/??" + id + "/client.js&rev=" + rev;
    const graph = { rev, release: { version: "1.0.0", commit: "abc" }, entries: [{ id, url, rev }], batches: [{ phase: "application" as const, url, rev, entries: [id] }] };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => {
        target.load({ id, factory: () => ({ mark: "first" }) });
        target.load({ id, factory: () => ({ mark: "second" }) }); // lần thực thi thứ hai
      },
    });
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
    let loaded: { mark?: string };
    try {
      loaded = (await system.import(id)) as { mark?: string };
    } finally {
      console.warn = original;
    }
    expect(loaded.mark).toBe("first"); // factory ĐẦU được giữ ⇒ một bundle, một plugin
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain(id);
    expect(warnings[0]).toContain("same bundle source");
  });
});

describe("remap — fallback home khi env RỖNG (sự cố 19/10/2026: restart-host.sh xoá GBH_HOME/DSH_HOME)", () => {
  test("env rỗng ⇒ profileModulesDir trả đường dẫn TUYỆT ĐỐI mặc định (không phải chuỗi tương đối)", () => {
    const dir = profileModulesDir({});
    expect(dir.startsWith("/")).toBe(true);
    expect(dir.endsWith("profiles/node_modules")).toBe(true);
    // Thư mục mặc định tồn tại trên máy này ⇒ bản đồ alias phải có mục (map > 0).
    if (existsSync(dir)) expect(readDshAliasMap(dir).size).toBeGreaterThan(0);
    else expect(readDshAliasMap(dir).size).toBe(0);
  });

  test("env rỗng + thư mục KHÔNG tồn tại ⇒ map rỗng, KHÔNG ném (fail-soft)", () => {
    const khongCo = join(tmpdir(), "gbh-khong-ton-tai-" + String(Date.now()));
    expect(existsSync(khongCo)).toBe(false);
    expect(() => readDshAliasMap(khongCo)).not.toThrow();
    expect(readDshAliasMap(khongCo).size).toBe(0);
    // Và env trỏ vào thư mục không tồn tại cũng không ném.
    const quaEnv = profileModulesDir({ GBH_HOME: khongCo });
    expect(quaEnv).toBe(join(khongCo, "profiles", "node_modules"));
    expect(readDshAliasMap(quaEnv).size).toBe(0);
  });
});

describe("Settings → Plugin: KHÔNG còn 'loaded without registering' khi factory bị xoá", () => {
  // Sự cố thật (ảnh người dùng 10/11/2026 00:45, sau khi tắt vài bundle): khối đỏ
  // "Một số plugin không đồng bộ được trên trang này" kèm nguyên văn
  //   client-modules: could not load "<id>": plugins/??…,…,<id>/client.js&rev=<rev>: loaded without
  //   registering "<id>" via __ModuleLoader__.load
  // Nguyên nhân: `invalidate()` nhét rev CỦA DÒNG vào URL CỦA BATCH; `loadShared()` dedupe theo danh
  // tính bundle (bỏ rev) ⇒ batch coi như đã chạy ⇒ không chạy lại ⇒ factory vừa xoá không bao giờ
  // được đăng ký lại. Ca dưới đây chạy ĐÚNG đường của trang: `entries.reload` → `replace` →
  // `invalidate` → `prefetch`, rồi khẳng định `entries.state` (thứ mà tab Plugin đọc) RỖNG.
  test("HMR đổi rev một dòng trong batch ⇒ nạp lại bằng URL MỘT-BUNDLE, batch chạy đúng MỘT lần", async () => {
    const boot = "@galaxy-blackhole/gbh-batch-boot";
    const first = "@galaxy-blackhole/gbh-batch-a";
    const second = "@galaxy-blackhole/gbh-batch-b";
    const rev = "aaaaaaaaaaaa";
    const newRev = "bbbbbbbbbbbb";
    const batchUrl = "plugins/??" + first + "/client.js," + second + "/client.js&rev=" + rev;
    const graph = {
      rev,
      release: { version: "1.0.0", commit: "abc" },
      entries: [
        { id: first, url: batchUrl, rev },
        { id: second, url: batchUrl, rev },
      ],
      batches: [{ phase: "application" as const, url: batchUrl, rev, entries: [first, second] }],
    };
    const requested: string[] = [];
    let executions = 0;
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: boot, exports: {} },
      loadBundle: async (url: string) => {
        requested.push(url);
        executions += 1;
        const mark = "v" + String(executions);
        for (const id of idsOf(url)) target.load({ id, factory: () => ({ id, mark }) });
      },
    });
    // Loader giả: `refresh()` dựng lại fiber, đúng như Loader thật sau khi thay code.
    const made = new Map<string, LoaderEntry>();
    const loader: ClientLoader = {
      ctx: { effect: () => undefined },
      entries: () => [...made.values()],
      ensureId: (options) => options.name,
      create: async (options) => {
        await system.prefetch(options.name);
        const name = options.name;
        const entry: LoaderEntry = {
          id: name,
          options: { name },
          fiber: { state: 2, await: async () => undefined, update: () => undefined, inertia: undefined, runtime: null },
          ctx: { effect: () => undefined, registry: { delete: () => undefined } },
          refresh: async () => {
            entry.fiber = { state: 2, await: async () => undefined, update: () => undefined, inertia: undefined, runtime: null };
          },
        };
        made.set(name, entry);
        return undefined;
      },
      resolve: (entryId) => {
        const entry = made.get(entryId);
        if (entry === undefined) throw new Error("loader: unknown entry " + entryId);
        return entry;
      },
      remove: () => undefined,
      await: async () => undefined,
    };
    const entries = new ClientEntries(system, {
      update: () => undefined,
      invalidateForReplacement: (id, nextRev) => {
        system.invalidate(id, nextRev);
      },
      prune: () => undefined,
    });
    await entries.start(loader, system.manifest);
    expect(entries.state.getSnapshot().failures).toEqual([]);
    expect(requested).toEqual([batchUrl]); // hai dòng CÙNG batch ⇒ đúng MỘT lần nạp

    await entries.reload(first, newRev);

    const failures = entries.state.getSnapshot().failures;
    expect(failures).toEqual([]); // TRƯỚC KHI SỬA: một mục "loaded without registering" ở đây
    expect(JSON.stringify(failures)).not.toContain("loaded without registering");
    // Lần nạp thứ hai là URL MỘT-BUNDLE của CHÍNH dòng đó: chỉ đăng ký một id ⇒ không đăng ký trùng.
    expect(requested[1]).toBe("plugins/??" + first + "/client.js&rev=" + newRev);
    expect(requested.filter((url) => url === batchUrl).length).toBe(1); // batch KHÔNG chạy lại
    expect((system.loadCache.get(first)?.exports as { mark?: string }).mark).toBe("v2");
    // Hàng xóm trong batch giữ nguyên code cũ: lần chạy lại KHÔNG chạm vào nó.
    expect(((await system.import(second)) as { mark?: string }).mark).toBe("v1");
  });

  test("id NGOÀI đồ thị boot vẫn bị từ chối: không URL nào được bịa thêm", async () => {
    const rev = "aaaaaaaaaaaa";
    const only = "@galaxy-blackhole/gbh-only-row";
    const url = "plugins/??" + only + "/client.js&rev=" + rev;
    const graph = { rev, release: { version: "1.0.0", commit: "abc" }, entries: [{ id: only, url, rev }], batches: [{ phase: "application" as const, url, rev, entries: [only] }] };
    const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
    const system = new ClientModuleSystem({
      manifest: graph as never,
      staticModules: {},
      registrationTarget: target,
      bootstrapModule: { id: "@galaxy-blackhole/gbh-boot", exports: {} },
      loadBundle: async () => undefined,
    });
    // Hàng rào "bảng module = đồ thị boot": id không có row thì không có đường nạp nào.
    await expect(system.prefetch("@galaxy-blackhole/gbh-not-in-graph")).rejects.toThrow(/not a graph entry/);
    await expect(system.import("@galaxy-blackhole/gbh-not-in-graph")).rejects.toThrow(/not a row in the boot graph/);
  });
});
