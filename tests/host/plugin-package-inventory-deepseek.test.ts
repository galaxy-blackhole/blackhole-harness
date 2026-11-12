/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-plugin-package-inventory-deepseek: ĐỐI CHỨNG TRỰC TIẾP
 *      với chính bundle gốc trên cùng một giàn giả (cây Loader · seam pluginPackages · sổ preset ·
 *      sổ trường mở rộng), cộng ca tập export đo trên ARTIFACT, ca gbh.peers ⊆ peerDependencies có
 *      ĐỐI CHỨNG ÂM, ca C6 (DANH TÍNH) và TEST CANH "chưa khai gbh.row".
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/plugin-package-inventory-deepseek/build.ts";
import { apply } from "../../packages/host/plugin-package-inventory-deepseek/src/index.ts";

/** Thư mục package của ta. */
const PKG = join(import.meta.dir, "../../packages/host/plugin-package-inventory-deepseek");
/** Gói gốc trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca A/B. */
const STOCK_DIR = join(
  import.meta.dir,
  "../../apps/host/node_modules/@deepseek-ai/dsh-plugin-package-inventory-deepseek",
);
/** Bundle gốc đã build (CHỈ ĐỌC). */
const STOCK_ENTRY = join(STOCK_DIR, "lib/index.js");

/** Hàm \`apply\` ở dạng test gọi được cho CẢ HAI bên (kiểu của bản gốc không import vào đây). */
type ApplyFn = (ctx: never, config: { enabled?: boolean }) => void;

/** Hình dạng tối thiểu của một bundle (cả hai bên đều cùng hình dạng này). */
interface Artifact {
  /** Tên plugin cordis. */
  name: string;
  /** Service bắt buộc. */
  inject: string[];
  /** Schema cấu hình. */
  Config: unknown;
  /** Điểm vào plugin. */
  apply: ApplyFn;
}

/** Build THẬT vào \`lib/\` của package rồi nạp — mọi phép đo "trên ARTIFACT" đọc đúng file này. */
const ARTIFACT = await buildPackage(join(PKG, "lib"));
const ours = (await import(ARTIFACT)) as unknown as Artifact;
const stock = (await import(STOCK_ENTRY)) as unknown as Artifact;

/** Một entry giả ĐÚNG hình dạng entry của Loader mà row này đọc. */
interface FakeEntry {
  /** \`options.name\` là tên module, \`options.group\` đánh dấu entry nhóm. */
  options: { name: string; group?: boolean };
  /** Entry bị tắt trong cấu hình. */
  disabled?: boolean;
  /** Fiber cordis; 2 = ACTIVE. */
  fiber?: { state?: number };
  /** Cây cha — nơi entry thừa hưởng base URL. */
  parent: { tree: { ctx: { baseUrl?: string } } };
}

/** Một lượt \`register\` đã ghi lại trên sổ trường mở rộng. */
interface Registration {
  /** Tên trường trên dây. */
  field: string;
  /** Bộ tính giá trị của trường. */
  contribution: { prepare(request: { sessionId?: string }): { value: unknown } };
}

/** Giàn giả: context, sổ đăng ký, và log cảnh báo. */
interface Harness {
  /** Context đưa cho \`apply\` (ép kiểu ở chỗ gọi — test không import kiểu của seam nào). */
  ctx: never;
  /** Mọi lượt đăng ký, theo thứ tự. */
  registered: Registration[];
  /** Mọi lượt \`logger.warn\` (nguyên tham số). */
  warns: unknown[][];
  /** Id phiên mà \`agents.get\` đã nhận, theo thứ tự. */
  agentLookups: string[];
}

/** Đầu vào phụ của một lượt cài: seam tuỳ chọn, agent/preset, và cấu hình. */
interface InstallOptions {
  /** Seam \`pluginPackages\`; vắng = dùng đường \`createRequire\`. */
  packages?: { packageOf(name: string, anchor: string): { manifestPath: string } | undefined };
  /** Seam \`agentPresets\`; vắng = không đọc bố cục preset. */
  presets?: { inspectCompositions(agentContext: unknown): readonly { modules: readonly Record<string, unknown>[] }[] };
  /** Agent mà \`agents.get\` trả về (chỉ khi id khớp \`agentId\`). */
  agent?: { ctx: unknown };
  /** Id phiên mà agent được gán cho. */
  agentId?: string;
}

/** Thư mục gói giả dùng chung cho mọi ca (dựng MỘT lần). */
const ROOT = mkdtempSync(join(tmpdir(), "gbh-ppi-"));
/** Base URL của "host" trong gói giả. */
const HOST_BASE = pathToFileURL(join(ROOT, "host/")).href;
/** Base URL của một cây Loader KHÁC (để phân biệt neo của bố cục preset). */
const TREE_BASE = pathToFileURL(join(ROOT, "tree/")).href;

/**
 * Ghi một \`package.json\` giả vào thư mục gói.
 * Nhận: đường dẫn tương đối trong ROOT và nội dung manifest.
 * Trả: đường dẫn tuyệt đối tới manifest vừa ghi.
 */
function writeManifest(relative: string, manifest: unknown): string {
  const dir = join(ROOT, relative);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
  return join(dir, "package.json");
}

writeManifest("node_modules/@scope/alpha", { name: "@scope/alpha", version: "1.2.3" });
writeManifest("node_modules/@scope/beta", { name: "@scope/beta" });
writeManifest("node_modules/@scope/blankversion", { name: "@scope/blankversion", version: "   " });
writeManifest("node_modules/@scope/blank", { name: "  ", version: "1.0.0" });
writeManifest("node_modules/plain", { name: "plain", version: "0.0.1" });
writeManifest("host/plugins/one", { name: "local-one", version: "9.9.9" });
writeManifest("tree/node_modules/@scope/gamma", { name: "@scope/gamma", version: "2.0.0" });
mkdirSync(join(ROOT, "host/plugins/one/lib"), { recursive: true });
writeFileSync(join(ROOT, "host/plugins/one/lib/index.js"), "export {};\n");

/**
 * Dựng một entry Loader giả.
 * Nhận: tên module và các cờ tuỳ chọn (nhóm/tắt/trạng thái fiber/base URL).
 * Trả: entry đúng hình dạng mà row đọc.
 */
function entry(name: string, options: { group?: boolean; disabled?: boolean; state?: number; baseUrl?: string } = {}): FakeEntry {
  return {
    options: { name, ...(options.group === true ? { group: true } : {}) },
    ...(options.disabled === true ? { disabled: true } : {}),
    fiber: { state: options.state ?? 2 },
    parent: { tree: { ctx: { baseUrl: options.baseUrl ?? HOST_BASE } } },
  };
}

/**
 * Dựng một giàn giả ĐÚNG hình dạng seam mà row dùng.
 * Nhận: danh sách entry của cây Loader và các seam tuỳ chọn.
 * Trả: giàn có context, sổ đăng ký, log cảnh báo, và vết tra agent.
 */
function harness(entries: readonly FakeEntry[], options: InstallOptions = {}): Harness {
  const registered: Registration[] = [];
  const warns: unknown[][] = [];
  const agentLookups: string[] = [];
  const ctx = {
    baseUrl: HOST_BASE,
    loader: { entries: () => entries },
    agents: {
      get: (sessionId: string) => {
        agentLookups.push(sessionId);
        return sessionId === (options.agentId ?? "s1") ? options.agent : undefined;
      },
    },
    logger: { warn: (...args: unknown[]) => warns.push(args) },
    deepseekLlmApiExtensions: {
      register: (field: string, contribution: Registration["contribution"]) => registered.push({ field, contribution }),
    },
    get: (key: string) =>
      key === "pluginPackages" ? options.packages : key === "agentPresets" ? options.presets : undefined,
  };
  return { ctx: ctx as never, registered, warns, agentLookups };
}

/**
 * Cài plugin trên một giàn MỚI rồi trả giàn đó (mỗi lần gọi = MỘT lần cài độc lập).
 * Nhận: hàm \`apply\` của bên cần đo, entry, seam tuỳ chọn, và cấu hình.
 * Trả: giàn đã cài (đăng ký + log).
 */
function install(fn: ApplyFn, entries: readonly FakeEntry[], options: InstallOptions & { config?: { enabled?: boolean } } = {}): Harness {
  const h = harness(entries, options);
  fn(h.ctx, options.config ?? {});
  return h;
}

/**
 * Gọi \`prepare\` trên lượt đăng ký ĐẦU TIÊN của một giàn.
 * Nhận: giàn đã cài và id phiên của request (có thể vắng).
 * Trả: giá trị sẽ đi trên dây.
 */
function prepare(h: Harness, sessionId?: string): unknown {
  const registration = h.registered[0];
  if (registration === undefined) throw new Error("plugin chưa đăng ký trường nào");
  return registration.contribution.prepare(sessionId === undefined ? {} : { sessionId }).value;
}

/** Đọc \`package.json\` của gói ta (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Metadata của ta. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Bản đồ subpath xuất ra. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
}

/**
 * Đọc manifest của gói ta.
 * Nhận: không.
 * Trả: nội dung \`package.json\`.
 */
function manifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
}

/**
 * Phép kiểm luật M6 §1d: \`gbh.peers\` phải là TẬP CON của \`peerDependencies\`, so PHẦN TỬ.
 * Nhận: một manifest.
 * Trả: các tên peer nằm trong \`gbh.peers\` mà KHÔNG có trong \`peerDependencies\` (rỗng = đạt).
 */
function missingPeers(input: Manifest): string[] {
  const peers = input.gbh?.peers ?? [];
  const declared = new Set(Object.keys(input.peerDependencies ?? {}));
  return peers.filter((peer) => !declared.has(peer)).sort();
}

describe("A. tập export đo trên ARTIFACT — ta phải BẰNG bản gốc", () => {
  test("ca A1: tập tên export khớp TỪNG TÊN với bundle gốc, không có default", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["Config", "apply", "inject", "name"]);
    expect(typeof ours.apply).toBe("function");
    expect(typeof stock.apply).toBe("function");
  });

  test("ca A2: row HOST-ONLY — artifact KHÔNG đăng ký id module nào (grep id gốc = 0), build.ts nhận argv[2]", () => {
    const text = readFileSync(ARTIFACT, "utf8");
    expect(text.includes("__ModuleLoader__")).toBe(false);
    expect(text.match(/id: "@deepseek-ai\//g) ?? []).toHaveLength(0);
    const build = readFileSync(join(PKG, "build.ts"), "utf8");
    expect(build.includes("process.argv[2]")).toBe(true);
    expect(build.includes("outDir ??")).toBe(true);
  });
});

describe("B. hành vi CHÍNH — cùng cây Loader ⇒ cùng dây, đối chứng với chính bundle gốc", () => {
  /** Cây Loader của ca chính: đủ loại entry mà bộ lọc phải xử lý. */
  const entries: FakeEntry[] = [
    entry("@scope/alpha"),
    entry("@scope/alpha/lib/deep/path.js"),
    entry("@scope/beta"),
    entry("@scope/blankversion"),
    entry("@scope/blank"),
    entry("plain"),
    entry("./plugins/one/lib/index.js"),
    entry("cordis:internal"),
    entry("node:fs"),
    entry("@scope/alpha", { state: 1 }),
    entry("@scope/alpha", { state: 3 }),
    entry("@scope/alpha", { disabled: true }),
    entry("@scope/alpha", { group: true }),
  ];

  test("ca B1: lọc entry nhóm/tắt/không ACTIVE · khử trùng · phiên bản rỗng ⇒ bỏ · tên rỗng ⇒ bỏ hẳn", () => {
    const mine = install(ours.apply, entries);
    const theirs = install(stock.apply, entries);
    expect(prepare(mine)).toEqual(prepare(theirs));
    expect(prepare(mine)).toEqual({
      version: 1,
      packages: [
        { name: "@scope/alpha", version: "1.2.3" },
        { name: "@scope/beta" },
        { name: "@scope/blankversion" },
        { name: "local-one", version: "9.9.9" },
        { name: "plain", version: "0.0.1" },
      ],
    });
    expect(mine.warns).toHaveLength(0);
  });

  test("ca B2: sắp xếp theo MÃ KÝ TỰ (không localeCompare) — chữ HOA đứng trước chữ thường", () => {
    writeManifest("node_modules/Zed", { name: "Zed", version: "1.0.0" });
    writeManifest("node_modules/alpha", { name: "alpha", version: "1.0.0" });
    const mixed = [entry("alpha"), entry("Zed"), entry("@scope/beta")];
    const mine = install(ours.apply, mixed);
    const theirs = install(stock.apply, mixed);
    expect(prepare(mine)).toEqual(prepare(theirs));
    const packages = (prepare(mine) as { packages: { name: string }[] }).packages;
    expect(packages.map((item) => item.name)).toEqual(["@scope/beta", "Zed", "alpha"]);
    expect("Zed" < "alpha").toBe(true);
  });

  test("ca B3: bố cục preset — chỉ đọc khi CÓ sessionId + agentPresets + agent; useHostBase neo ở base URL HOST", () => {
    const anchors: { name: string; anchor: string }[] = [];
    const packages = {
      packageOf: (name: string, anchor: string) => {
        anchors.push({ name, anchor });
        if (name === "@scope/gamma") return { manifestPath: join(ROOT, "tree/node_modules/@scope/gamma/package.json") };
        if (name === "@scope/beta") return { manifestPath: join(ROOT, "node_modules/@scope/beta/package.json") };
        if (name === "plain") return { manifestPath: join(ROOT, "node_modules/plain/package.json") };
        return undefined;
      },
    };
    // Module của preset mang baseUrl RIÊNG: `useHostBase` phải ĐÈ baseUrl đó bằng base URL của HOST,
    // còn module không đánh dấu thì giữ baseUrl của chính nó (đúng phép biến đổi của bản gốc).
    const presets = {
      inspectCompositions: () => [
        { modules: [{ moduleName: "@scope/gamma", useHostBase: true, baseUrl: TREE_BASE }, { moduleName: "plain", baseUrl: TREE_BASE }] },
      ],
    };
    const agent = { ctx: { agent: true } };
    const options: InstallOptions = { packages, presets, agent, agentId: "s1" };
    const baseEntries = [entry("@scope/beta", { baseUrl: TREE_BASE })];

    // `prepare` mới là lúc phân giải — phải đo neo SAU lượt prepare, không phải sau install.
    const mine = install(ours.apply, baseEntries, options);
    const mineValue = prepare(mine, "s1");
    const mineAnchors = [...anchors];
    anchors.length = 0;
    const theirs = install(stock.apply, baseEntries, options);
    const theirsValue = prepare(theirs, "s1");
    const stockAnchors = [...anchors];
    anchors.length = 0;

    expect(mineValue).toEqual(theirsValue);
    expect(mine.agentLookups).toEqual(["s1"]);
    expect(theirs.agentLookups).toEqual(["s1"]);
    const firstAnchor = (name: string, list: { name: string; anchor: string }[]): string | undefined =>
      list.find((item) => item.name === name)?.anchor;
    // entry của cây: neo ở base của cây; gamma (useHostBase): neo ở HOST; plain: neo ở baseUrl của nó.
    expect(firstAnchor("@scope/beta", mineAnchors)).toBe(TREE_BASE);
    expect(firstAnchor("@scope/gamma", mineAnchors)).toBe(HOST_BASE);
    expect(firstAnchor("plain", mineAnchors)).toBe(TREE_BASE);
    // Toàn bộ neo (bỏ neo cuối là `import.meta.url` — khác nhau theo từng bundle) phải TRÙNG bản gốc.
    const anchorList = (name: string, list: { name: string; anchor: string }[]): string[] =>
      list
        .filter((item) => item.name === name)
        .map((item) => item.anchor)
        .filter((anchor) => !anchor.endsWith("/lib/index.js"));
    for (const name of ["@scope/beta", "@scope/gamma", "plain"]) {
      expect(anchorList(name, mineAnchors)).toEqual(anchorList(name, stockAnchors));
    }
    expect((mineValue as { packages: { name: string }[] }).packages.map((item) => item.name)).toEqual([
      "@scope/beta",
      "@scope/gamma",
      "plain",
    ]);
  });
});

describe("B (tiếp). bố cục preset + seam — các nhánh còn lại", () => {
  test("ca B4: KHÔNG có sessionId / KHÔNG có agent / KHÔNG có preset ⇒ bỏ qua bố cục preset", () => {
    const packages = {
      packageOf: (name: string) => {
        if (name === "plain") return { manifestPath: join(ROOT, "node_modules/plain/package.json") };
        if (name === "@scope/beta") return { manifestPath: join(ROOT, "node_modules/@scope/beta/package.json") };
        return undefined;
      },
    };
    const presets = { inspectCompositions: () => [{ modules: [{ moduleName: "plain", useHostBase: false }] }] };
    const agent = { ctx: {} };
    const baseEntries = [entry("@scope/beta")];

    const noSession = install(ours.apply, baseEntries, { packages, presets, agent });
    expect(prepare(noSession)).toEqual({ version: 1, packages: [{ name: "@scope/beta" }] });
    expect(noSession.agentLookups).toHaveLength(0);

    const noAgent = install(ours.apply, baseEntries, { packages, presets, agentId: "khac" });
    expect(prepare(noAgent, "s1")).toEqual({ version: 1, packages: [{ name: "@scope/beta" }] });
    expect(noAgent.agentLookups).toEqual(["s1"]);

    const noPresets = install(ours.apply, baseEntries, { packages, agent });
    expect(prepare(noPresets, "s1")).toEqual({ version: 1, packages: [{ name: "@scope/beta" }] });
    expect(prepare(install(stock.apply, baseEntries, { packages, presets, agent }))).toEqual(prepare(noSession));
  });

  test("ca B5: seam pluginPackages CÓ mặt ⇒ KHÔNG rơi về createRequire (bỏ hẳn đường dò đĩa)", () => {
    const seamThatFails = { packageOf: () => undefined };
    const mine = install(ours.apply, [entry("@scope/alpha")], { packages: seamThatFails });
    const theirs = install(stock.apply, [entry("@scope/alpha")], { packages: seamThatFails });
    expect(prepare(mine)).toEqual(prepare(theirs));
    expect(prepare(mine)).toEqual({ version: 1, packages: [] });
    expect(mine.warns).toHaveLength(1);
    expect(theirs.warns).toHaveLength(1);
    expect(prepare(install(ours.apply, [entry("@scope/alpha")]))).toEqual({
      version: 1,
      packages: [{ name: "@scope/alpha", version: "1.2.3" }],
    });
  });
});

describe("C. đường LỖI — cảnh báo MỘT lần cho mỗi tên, câu y bản gốc, không ném ra ngoài", () => {
  test("ca C1: module không phân giải được ⇒ cảnh báo đúng câu gốc, prepare sau KHÔNG cảnh báo lại", () => {
    const entries = [entry("@scope/khong-ton-tai"), entry("plain")];
    const mine = install(ours.apply, entries);
    const theirs = install(stock.apply, entries);
    expect(prepare(mine)).toEqual(prepare(theirs));
    expect(prepare(mine)).toEqual(prepare(theirs));
    expect(mine.warns).toHaveLength(1);
    expect(theirs.warns).toHaveLength(1);
    expect(mine.warns[0]?.[0]).toBe(theirs.warns[0]?.[0] as unknown);
    expect(mine.warns[0]?.[0]).toBe(
      "plugin-package-inventory-deepseek: omitting unreadable package identity for %s: %o",
    );
    expect(mine.warns[0]?.[1]).toBe("@scope/khong-ton-tai");
    expect(mine.warns[0]?.[2]).toBeInstanceOf(Error);
    expect((mine.warns[0]?.[2] as Error).message).toBe(
      'plugin-package-inventory-deepseek: cannot resolve active package "@scope/khong-ton-tai"',
    );
    expect((theirs.warns[0]?.[2] as Error).message).toBe((mine.warns[0]?.[2] as Error).message);
    expect((prepare(mine) as { packages: { name: string }[] }).packages.map((item) => item.name)).toEqual(["plain"]);
  });

  test("ca C2: enabled: false ⇒ KHÔNG đăng ký gì; bật/mặc định ⇒ đăng ký ĐÚNG MỘT lần", () => {
    for (const fn of [ours.apply, stock.apply]) {
      expect(install(fn, [], { config: { enabled: false } }).registered).toHaveLength(0);
      expect(install(fn, [], { config: { enabled: true } }).registered).toHaveLength(1);
      expect(install(fn, [], { config: {} }).registered).toHaveLength(1);
    }
    const mine = install(ours.apply, []);
    expect(mine.registered[0]?.field).toBe("dsh_plugin_packages");
    expect(mine.registered[0]?.field).toBe(install(stock.apply, []).registered[0]?.field as string);
  });

  test("ca C3: mọi entry đều hỏng ⇒ inventory RỖNG nhưng vẫn đúng hình dạng (không ném, không treo)", () => {
    const mine = install(ours.apply, [entry("@scope/khong-1"), entry("@scope/khong-2")]);
    const theirs = install(stock.apply, [entry("@scope/khong-1"), entry("@scope/khong-2")]);
    expect(prepare(mine)).toEqual({ version: 1, packages: [] });
    expect(prepare(mine)).toEqual(prepare(theirs));
    expect(mine.warns.map((warn) => warn[1])).toEqual(["@scope/khong-1", "@scope/khong-2"]);
  });
});

describe("D. C6 — DANH TÍNH: hai lần cài KHÔNG chia sẻ trạng thái hay vật thể", () => {
  test("ca D1: cùng entry trong CÙNG một lần cài ⇒ CÙNG vật thể (cache); hai lần cài ⇒ vật thể KHÁC nhau", () => {
    const entries = [entry("plain")];
    const first = install(ours.apply, entries);
    const second = install(ours.apply, entries);
    const firstValue = prepare(first) as { packages: { name: string }[] };
    const firstAgain = prepare(first) as { packages: { name: string }[] };
    const secondValue = prepare(second) as { packages: { name: string }[] };
    expect(firstValue.packages[0] as unknown).toBe(firstAgain.packages[0] as unknown);
    expect(firstValue.packages[0] as unknown).not.toBe(secondValue.packages[0] as unknown);
    (firstValue.packages[0] as { name: string }).name = "mutated";
    expect(secondValue.packages[0]?.name).toBe("plain");
    expect((firstAgain.packages[0] as { name: string }).name).toBe("mutated");

    const stockFirst = install(stock.apply, entries);
    const stockSecond = install(stock.apply, entries);
    const stockFirstValue = prepare(stockFirst) as { packages: { name: string }[] };
    const stockAgain = prepare(stockFirst) as { packages: { name: string }[] };
    const stockSecondValue = prepare(stockSecond) as { packages: { name: string }[] };
    expect(stockFirstValue.packages[0] as unknown).toBe(stockAgain.packages[0] as unknown);
    expect(stockFirstValue.packages[0] as unknown).not.toBe(stockSecondValue.packages[0] as unknown);
    (stockFirstValue.packages[0] as { name: string }).name = "mutated";
    expect(stockSecondValue.packages[0]?.name).toBe("plain");
  });

  test("ca D2: sổ cảnh báo 'đã báo' là RIÊNG từng lần cài — lần cài thứ hai vẫn cảnh báo lại", () => {
    const entries = [entry("@scope/khong-ton-tai")];
    const measure = (fn: ApplyFn): number[] => {
      const first = install(fn, entries);
      const second = install(fn, entries);
      prepare(first);
      prepare(first);
      prepare(second);
      return [first.warns.length, second.warns.length];
    };
    expect(measure(ours.apply)).toEqual([1, 1]);
    expect(measure(stock.apply)).toEqual([1, 1]);
  });
});

describe("E. metadata + luật gói", () => {
  test("ca E1: gbh.peers ⊆ peerDependencies (so PHẦN TỬ) và mọi peer có phiên bản thật", () => {
    const json = manifest();
    expect(json.gbh?.peers).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/schemastery"]);
    expect(missingPeers(json)).toEqual([]);
    for (const peer of json.gbh?.peers ?? []) expect(typeof json.peerDependencies?.[peer]).toBe("string");
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies).toBeUndefined();
  });

  test("ca E2: ĐỐI CHỨNG ÂM — thiếu tên / lệch phần tử vẫn PHẢI bị bắt; thừa tên thì ĐẠT", () => {
    const broken: Manifest = {
      name: "x",
      gbh: { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] },
      peerDependencies: { "@deepseek-ai/cordis": "1" },
    };
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    const sameCount: Manifest = {
      name: "y",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/b"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/c": "1" },
    };
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/b"]);
    const emptied: Manifest = { ...manifest(), peerDependencies: {} };
    expect(missingPeers(emptied)).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/schemastery"]);
    const generous: Manifest = {
      ...manifest(),
      peerDependencies: { ...(manifest().peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" },
    };
    expect(missingPeers(generous)).toEqual([]);
  });

  
  test("ca E4: 000e — locale/en.json + locale/zh.json chép BYTE-FOR-BYTE, và export ./locale/*.json", () => {
    for (const file of ["en", "zh"]) {
      const mine = readFileSync(join(PKG, "locale", file + ".json"));
      const theirs = readFileSync(join(STOCK_DIR, "locale", file + ".json"));
      expect(mine.equals(theirs)).toBe(true);
    }
    expect(manifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
    const en = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta: { title: string } };
    expect(en.meta.title).toBe("plugin-package-inventory-deepseek");
  });

  test("ca E5: name · inject · Config khớp bản gốc từng chữ", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("plugin-package-inventory-deepseek");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["agents", "deepseekLlmApiExtensions", "loader"]);
    expect(typeof ours.Config).toBe("function");
    expect(String(ours.Config)).toBe(String(stock.Config));
    const schema = ours.Config as unknown as (value: unknown) => unknown;
    const stockSchema = stock.Config as unknown as (value: unknown) => unknown;
    expect(schema({})).toEqual(stockSchema({}));
    expect(schema({})).toEqual({ enabled: true });
    expect(schema({ enabled: false })).toEqual({ enabled: false });
  });
});
