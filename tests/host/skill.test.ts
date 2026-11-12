/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-skill: đo trên ARTIFACT đã build, rồi so TỪNG hành vi
 *      với CHÍNH bundle gốc của DSH (phơi `<skill_content>` · ngữ pháp tên · gộp catalog theo lớp
 *      phạm vi · thắng theo hạng · cache · huỷ · đường lỗi · danh tính vật thể cấu hình)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import Ours, {
  BUNDLED_SKILL_RANK,
  escapeText,
  isModelInvocable,
  isSkillName,
  isUserInvocable,
  renderSkillContent,
} from "../../packages/host/skill/src/index.ts";
import { buildPackage } from "../../packages/host/skill/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "skill");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-skill", "lib", "index.js");
/** Package gốc trên đĩa (đọc package.json + locale). */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-skill");
/** cordis của CHÍNH package ta (một bản cài riêng — khác lớp Context với bản của apps/host). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà bundle gốc nạp — phải dùng đúng bản này mới dựng được service gốc. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** dsh-scope của ta — nguồn của phép dựng phạm vi cho phép thử lớp. */
const OUR_SCOPE = join(PKG, "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
/** dsh-scope mà bundle gốc nạp. */
const STOCK_SCOPE = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Trần thời gian của MỌI lượt chờ trong file này (ms) — không có chờ vô hạn. */
const WAIT_CAP_MS = 2_000;

/** Hình dạng tối thiểu của một context cordis mà file này cần. */
interface Ctx {
  plugin(plugin: unknown, config?: Record<string, unknown>): unknown;
  get(name: string): unknown;
  on(name: string, listener: (...args: unknown[]) => unknown): unknown;
  logger: { warn(...parts: unknown[]): void };
}

/** Quyền điều khiển mà `registerProvider` trao cho nhà cung cấp. */
interface Control {
  readonly signal: AbortSignal;
  readonly invalidate: () => void;
}

/** Ứng viên tối thiểu — đúng hình dạng mà bundle gốc kiểm. */
interface TestCandidate {
  name: string;
  description: string;
  invocation: { modelInvocable: boolean; userInvocable: boolean };
  source: string;
  provider: string;
  rank: number;
  locator?: unknown;
  whenToUse?: string;
  path?: string;
  resourceBase?: Record<string, string>;
}

/** Định nghĩa đầy đủ mà `provider.get()` trả về. */
interface TestDefinition extends Omit<TestCandidate, "rank" | "locator"> {
  content: string;
}

/** Nhà cung cấp tối thiểu — nhận NGUYÊN VĂN tuỳ chọn tra của bên gọi. */
interface TestProvider {
  name: string;
  list(options?: unknown): Promise<readonly TestCandidate[] | { candidates: readonly TestCandidate[]; complete: boolean } | undefined>;
  get(candidate: TestCandidate, options?: unknown): Promise<TestDefinition | undefined>;
}

/** Tuỳ chọn nhìn/tra. */
interface ViewOptions {
  cwd?: string;
  signal?: AbortSignal;
  scope?: object;
}

/** Bản tóm tắt mà `list()` trả. */
interface Summary {
  name: string;
  description: string;
  provider: string;
  source: string;
  invocation: { modelInvocable: boolean; userInvocable: boolean };
  path?: string;
  whenToUse?: string;
  resourceBase?: Record<string, string>;
}

/** Sổ đăng ký ở dạng file test cần gọi (bản ta và bản gốc cùng hình dạng). */
interface Registry {
  registerProvider(create: (control: Control) => TestProvider): () => void;
  register(skill: Record<string, unknown>): () => void;
  list(options?: ViewOptions): Promise<Summary[]>;
  snapshot(options?: ViewOptions): Promise<{ skills: Summary[]; complete: boolean }>;
  get(name: string, options?: ViewOptions): Promise<TestDefinition | undefined>;
}

/** Module gốc nạp động — khai theo CẤU TRÚC, không dùng `any`. */
interface StockModule {
  default: unknown;
  SkillRegistry: unknown;
  BUNDLED_SKILL_RANK: number;
  renderSkillContent: (skill: unknown) => string;
  escapeText: (value: string) => string;
  isSkillName: (value: string) => boolean;
  isModelInvocable: (skill: { invocation: { modelInvocable: boolean } }) => boolean;
  isUserInvocable: (skill: { invocation: { userInvocable: boolean } }) => boolean;
}

/** Module dsh-scope ở dạng cần cho phép thử phạm vi. */
interface ScopeModule {
  createScope(ctx: unknown, key: object, options?: { parent?: object }): { ctx: unknown; dispose(): Promise<void> };
}

/** Lớp dịch vụ của ta, nhìn qua kiểu của file test (constructor nhận context bất kỳ). */
const OursClass = Ours as unknown as new (ctx: unknown, config?: Record<string, unknown>) => Registry;

/** Bộ nhớ đệm module gốc (nạp MỘT lần cho cả file). */
let stockCache: StockModule | undefined;

/**
 * Nạp bundle gốc đúng MỘT lần.
 * Nhận: không.
 * Trả: module gốc đã nạp, khai theo cấu trúc.
 */
async function stock(): Promise<StockModule> {
  if (stockCache === undefined) stockCache = (await import(STOCK)) as unknown as StockModule;
  return stockCache;
}

/**
 * Chờ có TRẦN tới khi `read()` trả giá trị khác undefined.
 * Nhận: hàm đọc, nhãn chẩn đoán, và trần thời gian.
 * Trả: giá trị đầu tiên khác undefined; ném lỗi khi quá trần (không treo test).
 */
async function waitFor<T>(read: () => T | undefined, label: string, timeoutMs = WAIT_CAP_MS): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) throw new Error(`waitFor("${label}") qua ${timeoutMs}ms — khong thay gia tri`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Chuỗi hoá TẤT ĐỊNH — giữ cả khoá có giá trị undefined (JSON.stringify nuốt chúng).
 * Nhận: giá trị bất kỳ.
 * Trả: chuỗi JSON ổn định để so hai bản.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (item === undefined ? "<undefined>" : item));
}

/**
 * Chạy một thao tác và lấy THÔNG ĐIỆP lỗi, có trần thời gian để không treo.
 * Nhận: hàm chạy và trần (ms).
 * Trả: thông điệp lỗi, hoặc nhãn "(khong nem)" / "(qua han …)".
 */
async function rejectionOf(run: () => Promise<unknown>, ceilingMs = WAIT_CAP_MS): Promise<string> {
  const settled = run().then(
    () => "(khong nem)",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );
  const ceiling = new Promise<string>((resolve) => {
    setTimeout(() => resolve(`(qua han ${ceilingMs}ms)`), ceilingMs);
  });
  return Promise.race([settled, ceiling]);
}

/**
 * Dựng MỘT bản (ta hoặc gốc) trên Context cordis thật của chính bản đó.
 * Nhận: lớp plugin, lớp Context, và cấu hình.
 * Trả: context đã dựng và service `skills` (chờ có trần, vì cordis có thể hoãn khởi tạo fiber).
 */
async function boot(
  plugin: unknown,
  ContextCtor: new () => unknown,
  config: Record<string, unknown> = {},
): Promise<{ ctx: Ctx; registry: Registry }> {
  const ctx = new ContextCtor() as unknown as Ctx;
  ctx.plugin(plugin, config);
  const registry = await waitFor(() => ctx.get("skills") as Registry | undefined, "service skills");
  return { ctx, registry };
}

/**
 * Dựng CẢ HAI bản (ta và gốc) với cùng cấu hình, mỗi bản trên cordis của chính nó.
 * Nhận: cấu hình truyền cho cả hai.
 * Trả: hai cặp context + sổ đăng ký.
 */
async function bootBoth(
  config: Record<string, unknown> = {},
): Promise<{ ours: { ctx: Ctx; registry: Registry }; theirs: { ctx: Ctx; registry: Registry } }> {
  const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => unknown };
  const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => unknown };
  const stockMod = await stock();
  const ours = await boot(OursClass, ourCordis.Context, config);
  const theirs = await boot(stockMod.default, stockCordis.Context, config);
  return { ours, theirs };
}

/**
 * Dựng một ứng viên đúng hình dạng kiểm.
 * Nhận: tên, nhà cung cấp, hạng, và các trường bổ sung tuỳ chọn.
 * Trả: ứng viên mới.
 */
function candidate(name: string, provider: string, rank: number, extra: Partial<TestCandidate> = {}): TestCandidate {
  return {
    name,
    description: `desc ${name}`,
    invocation: { modelInvocable: true, userInvocable: true },
    source: "project-dsh",
    provider,
    rank,
    ...extra,
  };
}

/**
 * Dựng một kỹ năng runtime mẫu.
 * Nhận: tên và các trường bổ sung tuỳ chọn.
 * Trả: đóng góp runtime đúng hình dạng `register()` nhận.
 */
function runtimeSkill(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name, description: `mo ta ${name}`, content: `than ${name}`, source: "runtime", ...extra };
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row skill — artifact và manifest", () => {
  test("ARTIFACT: tập export TRÙNG bản gốc (8 = 8), default === SkillRegistry, 0 id @deepseek-ai", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    // LUẬT MỘT BUNDLE ⇒ MỘT ID: row host nên không có lời gọi đăng ký module nào.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as Record<string, unknown>;
    const stockMod = (await import(STOCK)) as Record<string, unknown>;
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stockMod).sort());
    expect(Object.keys(artifact).sort()).toEqual([
      "BUNDLED_SKILL_RANK",
      "SkillRegistry",
      "default",
      "escapeText",
      "isModelInvocable",
      "isSkillName",
      "isUserInvocable",
      "renderSkillContent",
    ]);
    expect(artifact.default).toBe(artifact.SkillRegistry);
    expect(stockMod.default).toBe(stockMod.SkillRegistry);
    expect((artifact.SkillRegistry as { name: string }).name).toBe((stockMod.SkillRegistry as { name: string }).name);
    expect(Object.getOwnPropertyNames((artifact.SkillRegistry as { prototype: object }).prototype).sort()).toEqual(
      Object.getOwnPropertyNames((stockMod.SkillRegistry as { prototype: object }).prototype).sort(),
    );
    expect(artifact.BUNDLED_SKILL_RANK).toBe(stockMod.BUNDLED_SKILL_RANK as number);
    expect(BUNDLED_SKILL_RANK).toBe(stockMod.BUNDLED_SKILL_RANK as number);
    const config = (artifact.SkillRegistry as { Config: { toString(): string } }).Config;
    const stockConfig = (stockMod.SkillRegistry as { Config: { toString(): string } }).Config;
    expect(String(config)).toBe(String(stockConfig));
  });

  test("MANIFEST: gbh.row ở trạng thái TỰ NHẤT QUÁN (test canh hai chiều) · gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM · locale byte-for-byte", async () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name?: string;
      gbh?: { row?: unknown; peers?: string[] };
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    // TEST CANH HAI CHIỀU: tác giả gói để gói ở trạng thái CHƯA khai `gbh.row` (an toàn: không tắt
    // row stock của ai). Nếu Lead/một agent khác ĐÃ khai thì khai báo đó phải TỰ NHẤT QUÁN — đúng id
    // row stock, có test, và có dòng trong `packages/README.md` §4 (điều kiện của cổng `hygiene`).
    // Nhờ vậy test không đỏ oan khi có người khác khai, mà vẫn bắt được khai báo nửa vời.
    const row = manifest.gbh?.row as { id?: string; tests?: string[]; moved?: boolean } | undefined;
    if (row !== undefined) {
      expect(row.id).toBe("skill");
      expect(row.tests).toContain("tests/host/skill.test.ts");
      expect(row.moved).toBeUndefined();
      expect(readFileSync(join(ROOT, "packages", "README.md"), "utf8")).toContain("host/skill");
    }
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-skill");
    expect(manifest.dependencies).toBeUndefined();

    /**
     * Phép kiểm quy ước: mọi phần tử của gbh.peers phải có mặt trong peerDependencies.
     * Nhận: một manifest cùng hình dạng.
     * Trả: danh sách tên THIẾU (rỗng là đạt).
     */
    const missing = (input: { gbh?: { peers?: string[] }; peerDependencies?: Record<string, string> }): string[] => {
      const peers = input.gbh?.peers ?? [];
      const declared = new Set(Object.keys(input.peerDependencies ?? {}));
      return peers.filter((name) => !declared.has(name));
    };
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBe(3);
    // So PHẦN TỬ, không so số lượng.
    expect(missing(manifest)).toEqual([]);
    const peerKeys = Object.keys(manifest.peerDependencies ?? {});
    for (const peer of peers) expect(peerKeys).toContain(peer);
    // ĐỐI CHỨNG ÂM: phép kiểm KHÔNG được rỗng — ba manifest hỏng phải bị bắt đúng tên.
    const dropped: { gbh?: { peers?: string[] }; peerDependencies: Record<string, string> } = {
      ...manifest,
      peerDependencies: { ...(manifest.peerDependencies ?? {}) },
    };
    delete dropped.peerDependencies["@deepseek-ai/dsh-scope"];
    expect(missing(dropped)).toEqual(["@deepseek-ai/dsh-scope"]);
    expect(missing({ gbh: { peers }, peerDependencies: {} })).toEqual(peers);
    expect(missing({ gbh: { peers }, peerDependencies: { ...(manifest.peerDependencies ?? {}), "left-pad": "1.0.0" } })).toEqual([]);

    // 000e: locale phải byte-for-byte với bản gốc (thiếu là tiêu đề Plugins lệch oracle).
    for (const name of ["en.json", "zh.json"]) {
      const mine = readFileSync(join(PKG, "locale", name));
      const theirs = readFileSync(join(STOCK_PKG, "locale", name));
      expect(mine.equals(theirs)).toBe(true);
    }
  });
});
describe("row skill — sổ đăng ký trên Context cordis THẬT (hai bản cài riêng)", () => {
  test("register + list/snapshot: sắp theo tên, mặc định provider runtime, cờ complete = true", async () => {
    const { ours, theirs } = await bootBoth();
    for (const side of [ours, theirs]) {
      side.registry.register(runtimeSkill("b-skill"));
      side.registry.register(runtimeSkill("a-skill"));
    }
    const ourList = await ours.registry.list();
    const theirList = await theirs.registry.list();
    expect(canonical(ourList)).toBe(canonical(theirList));
    expect(ourList.map((item) => item.name)).toEqual(["a-skill", "b-skill"]);
    expect(ourList[0]?.provider).toBe("runtime");
    expect(ourList[0]?.invocation).toEqual({ modelInvocable: true, userInvocable: true });
    expect(ourList[0]?.description).toBe("mo ta a-skill");
    expect(canonical(await ours.registry.snapshot())).toBe(canonical(await theirs.registry.snapshot()));
    expect((await ours.registry.snapshot()).complete).toBe(true);
  });

  test("thắng theo HẠNG trong một lớp · runtime (250) thắng gói đóng gói (600)", async () => {
    const { ours, theirs } = await bootBoth();
    const setup = (registry: Registry): (() => void) => {
      registry.registerProvider(() => ({
        name: "late",
        list: async () => [candidate("dup", "late", 700, { source: "p-late" })],
        get: async () => undefined,
      }));
      registry.registerProvider(() => ({
        name: "early",
        list: async () => [candidate("dup", "early", 500, { source: "p-early" })],
        get: async () => undefined,
      }));
      return registry.register(runtimeSkill("dup", { source: "runtime" }));
    };
    const undoOurs = setup(ours.registry);
    const undoThers = setup(theirs.registry);
    const stageOne = canonical(await ours.registry.list());
    expect(stageOne).toBe(canonical(await theirs.registry.list()));
    const winner = JSON.parse(stageOne) as Summary[];
    expect(winner.length).toBe(1);
    expect(winner[0]?.provider).toBe("runtime");
    undoOurs();
    undoThers();
    const stageTwo = canonical(await ours.registry.list());
    expect(stageTwo).toBe(canonical(await theirs.registry.list()));
    const afterRuntime = JSON.parse(stageTwo) as Summary[];
    expect(afterRuntime[0]?.provider).toBe("early");
    expect(afterRuntime[0]?.source).toBe("p-early");
  });

  test("đăng ký trùng tên runtime: ai tới trước thắng, hàm dọn thứ hai RỖNG, cảnh báo đúng một dòng", async () => {
    const { ours, theirs } = await bootBoth();
    const run = async (side: { ctx: Ctx; registry: Registry }): Promise<{ list: string; warnings: string[]; afterUndo: string }> => {
      const warnings: string[] = [];
      side.ctx.logger.warn = (...parts: unknown[]) => {
        warnings.push(parts.map((part) => String(part)).join(" "));
      };
      side.registry.register(runtimeSkill("dup", { content: "dau tien" }));
      const noop = side.registry.register(runtimeSkill("dup", { content: "thu hai" }));
      noop();
      const list = canonical(await side.registry.list());
      return { list, warnings, afterUndo: canonical(await side.registry.list()) };
    };
    const ourRun = await run(ours);
    const theirRun = await run(theirs);
    expect(canonical(ourRun)).toBe(canonical(theirRun));
    expect(ourRun.warnings.length).toBe(1);
    expect(ourRun.warnings[0]).toContain('runtime skill "dup" ignored because it is already registered');
  });

  test("tên nhà cung cấp dành riêng: runtime ⇒ ném y hệt và KHÔNG để lại đăng ký", async () => {
    const { ours, theirs } = await bootBoth();
    const messageOf = (registry: Registry): string => {
      try {
        registry.registerProvider(() => ({ name: "runtime", list: async () => [], get: async () => undefined }));
        return "(khong nem)";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    };
    const ourMessage = messageOf(ours.registry);
    expect(ourMessage).toBe(messageOf(theirs.registry));
    expect(ourMessage).toBe('"runtime" is reserved for runtime skill registrations');
    expect(canonical(await ours.registry.list())).toBe(canonical(await theirs.registry.list()));
    expect((await ours.registry.list()).length).toBe(0);
  });

  test("provider NÉM ⇒ bỏ qua + cảnh báo + complete=false; provider trả undefined ⇒ bỏ qua, cờ giữ nguyên", async () => {
    const { ours, theirs } = await bootBoth();
    const run = async (side: { ctx: Ctx; registry: Registry }): Promise<{ warnings: string[]; snap: { skills: Summary[]; complete: boolean } }> => {
      const warnings: string[] = [];
      side.ctx.logger.warn = (...parts: unknown[]) => {
        warnings.push(parts.map((part) => String(part)).join(" "));
      };
      side.registry.registerProvider(() => ({
        name: "bad",
        list: async () => {
          throw new Error("noi that bai");
        },
        get: async () => undefined,
      }));
      side.registry.registerProvider(() => ({ name: "silent", list: async () => undefined, get: async () => undefined }));
      side.registry.registerProvider(() => ({
        name: "good",
        list: async () => [candidate("ok", "good", 600)],
        get: async () => undefined,
      }));
      return { warnings, snap: await side.registry.snapshot() };
    };
    const ourRun = await run(ours);
    const theirRun = await run(theirs);
    expect(canonical(ourRun)).toBe(canonical(theirRun));
    expect(ourRun.snap.complete).toBe(false);
    expect(ourRun.snap.skills.map((item) => item.name)).toEqual(["ok"]);
    expect(ourRun.warnings.length).toBe(1);
    expect(ourRun.warnings[0]).toContain('skill provider "bad" skipped: Error: noi that bai');
  });

  test("get(): nạp thân · tên KHÔNG hợp lệ ⇒ undefined (không chạm nhà cung cấp) · lệch tên ⇒ undefined + làm mới", async () => {
    const { ours, theirs } = await bootBoth();
    const run = async (side: { ctx: Ctx; registry: Registry }) => {
      let listCalls = 0;
      side.registry.registerProvider(() => ({
        name: "good",
        list: async () => {
          listCalls += 1;
          return [candidate("x", "good", 600)];
        },
        get: async () => ({ ...candidate("x", "good", 600), content: "than x" }),
      }));
      side.registry.registerProvider(() => ({
        name: "stale",
        list: async () => [candidate("z", "stale", 600)],
        get: async () => ({ ...candidate("z", "stale", 600), name: "y", content: "lech ten" }),
      }));
      const ok = await side.registry.get("x");
      const callsBefore = listCalls;
      const badName = await side.registry.get("Bad Name");
      const callsAfterBadName = listCalls;
      const missing = await side.registry.get("khong-co");
      const stale = await side.registry.get("z");
      const callsAfterStale = listCalls;
      await side.registry.list();
      return { ok, callsBefore, badName, callsAfterBadName, missing, stale, callsAfterStale, callsAfterList: listCalls };
    };
    const ourRun = await run(ours);
    const theirRun = await run(theirs);
    expect(canonical(ourRun)).toBe(canonical(theirRun));
    expect(ourRun.ok?.content).toBe("than x");
    expect(ourRun.badName).toBeUndefined();
    expect(ourRun.callsAfterBadName).toBe(ourRun.callsBefore);
    expect(ourRun.missing).toBeUndefined();
    expect(ourRun.stale).toBeUndefined();
    expect(ourRun.callsAfterList).toBe(ourRun.callsAfterStale + 1);
  });

  test("CACHE: hai lượt list CÙNG tuỳ chọn ⇒ MỘT lượt provider.list · cwd khác ⇒ khoá khác · invalidate() ⇒ lượt mới", async () => {
    const { ours, theirs } = await bootBoth();
    const run = async (side: { ctx: Ctx; registry: Registry }) => {
      let calls = 0;
      let control: Control | undefined;
      const seen: unknown[] = [];
      side.registry.registerProvider((granted) => {
        control = granted;
        return {
          name: "p",
          list: async (options?: unknown) => {
            calls += 1;
            seen.push(options);
            return [candidate("x", "p", 600)];
          },
          get: async () => undefined,
        };
      });
      const shared: ViewOptions = { cwd: "/tmp/ws" };
      const first = await side.registry.list(shared);
      const second = await side.registry.list(shared);
      const afterTwo = calls;
      await side.registry.list({ cwd: "/tmp/other" });
      const afterCwd = calls;
      control?.invalidate();
      const afterInvalidate = await side.registry.list(shared);
      return { first, second, afterInvalidate, afterTwo, afterCwd, calls, verbatim: seen[0] === shared };
    };
    const ourRun = await run(ours);
    const theirRun = await run(theirs);
    expect(canonical({ first: ourRun.first, second: ourRun.second, afterInvalidate: ourRun.afterInvalidate })).toBe(
      canonical({ first: theirRun.first, second: theirRun.second, afterInvalidate: theirRun.afterInvalidate }),
    );
    for (const result of [ourRun, theirRun]) {
      expect(result.afterTwo).toBe(1);
      expect(result.afterCwd).toBe(2);
      expect(result.calls).toBe(3);
      // Nhà cung cấp nhận CHÍNH vật thể tuỳ chọn của bên gọi (không bản sao).
      expect(result.verbatim).toBe(true);
    }
  });

  test("HUỶ: tín hiệu đã huỷ ⇒ ném NGAY; huỷ GIỮA lượt ⇒ từ chối, KHÔNG treo", async () => {
    const { ours, theirs } = await bootBoth();
    const run = async (side: { ctx: Ctx; registry: Registry }) => {
      side.registry.registerProvider(() => ({
        name: "hang",
        list: () => new Promise<readonly TestCandidate[]>(() => {}),
        get: async () => undefined,
      }));
      const pre = new AbortController();
      pre.abort(new Error("huy truoc"));
      const preflight = await rejectionOf(() => side.registry.list({ signal: pre.signal }), 1_500);
      const mid = new AbortController();
      const pending = rejectionOf(() => side.registry.list({ signal: mid.signal }), 1_500);
      setTimeout(() => mid.abort(new Error("huy giua luot")), 10);
      return { preflight, duringFlight: await pending };
    };
    const ourRun = await run(ours);
    const theirRun = await run(theirs);
    expect(canonical(ourRun)).toBe(canonical(theirRun));
    expect(ourRun.preflight).toBe("huy truoc");
    expect(ourRun.duringFlight).toBe("huy giua luot");
    expect(ourRun.duringFlight.startsWith("(qua han")).toBe(false);
  });

  test("skills/change: phát khi đăng ký và khi gỡ đăng ký", async () => {
    const { ours, theirs } = await bootBoth();
    const run = async (side: { ctx: Ctx; registry: Registry }) => {
      let fired = 0;
      side.ctx.on("skills/change", () => {
        fired += 1;
      });
      const undo = side.registry.register(runtimeSkill("x"));
      const afterRegister = fired;
      undo();
      return { afterRegister, afterUndo: fired };
    };
    const ourRun = await run(ours);
    const theirRun = await run(theirs);
    expect(canonical(ourRun)).toBe(canonical(theirRun));
    expect(ourRun.afterRegister).toBe(1);
    expect(ourRun.afterUndo).toBe(2);
  });
});

describe("row skill — lớp theo PHẠM VI", () => {
  test("đăng ký ở phạm vi CHA: không scope = rỗng · đúng scope = có · scope CON thừa hưởng · scope ANH EM = rỗng", async () => {
    const ourScopeModule = (await import(OUR_SCOPE)) as unknown as ScopeModule;
    const stockScopeModule = (await import(STOCK_SCOPE)) as unknown as ScopeModule;
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => unknown };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => unknown };
    const stockMod = await stock();
    const run = async (scopeModule: ScopeModule, ContextCtor: new () => unknown, plugin: unknown): Promise<string> => {
      const base = new ContextCtor() as unknown as Ctx;
      const parentKey: object = {};
      const childKey: object = {};
      const siblingKey: object = {};
      const parentScope = scopeModule.createScope(base, parentKey);
      const childScope = scopeModule.createScope(base, childKey, { parent: parentKey });
      const siblingScope = scopeModule.createScope(base, siblingKey);
      // Dựng THẲNG lớp dịch vụ trên context CÓ PHẠM VI: đó là cách duy nhất trong phép thử này
      // buộc lượt đăng ký rơi vào lớp của phạm vi (đường `ctx.plugin` trả một thể hiện gắn với
      // context gốc nên đăng ký thành TOÀN CỤC — đo được ở cả hai bản, nên không dùng để thử lớp).
      const RegistryCtor = plugin as new (ctx: unknown, config?: Record<string, unknown>) => Registry;
      const registry = new RegistryCtor(parentScope.ctx, {});
      registry.registerProvider(() => ({
        name: "scoped",
        list: async () => [candidate("s-one", "scoped", 600)],
        get: async () => undefined,
      }));
      const views = {
        none: await registry.list(),
        own: await registry.list({ scope: parentKey }),
        child: await registry.list({ scope: childKey }),
        sibling: await registry.list({ scope: siblingKey }),
      };
      await childScope.dispose();
      await siblingScope.dispose();
      await parentScope.dispose();
      return canonical(views);
    };
    const ourViews = await run(ourScopeModule, ourCordis.Context, OursClass);
    const theirViews = await run(stockScopeModule, stockCordis.Context, stockMod.default);
    expect(ourViews).toBe(theirViews);
    const parsed = JSON.parse(ourViews) as Record<string, Summary[]>;
    expect(parsed.none).toEqual([]);
    expect(parsed.sibling).toEqual([]);
    expect(parsed.own?.map((item) => item.name)).toEqual(["s-one"]);
    expect(parsed.child?.map((item) => item.name)).toEqual(["s-one"]);
  });
});

describe("row skill — C6: vật thể cấu hình phải ĐỘC LẬP (kiểm bằng DANH TÍNH)", () => {
  test("mỗi lượt list trả vật thể MỚI · hai kỹ năng KHÔNG chung công tắc gọi · hai sổ ĐỘC LẬP", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => unknown };
    const first = await boot(OursClass, ourCordis.Context);
    const second = await boot(OursClass, ourCordis.Context);
    first.registry.register(runtimeSkill("a"));
    first.registry.register(runtimeSkill("b"));
    const listOne = await first.registry.list();
    const listTwo = await first.registry.list();
    expect(listOne).not.toBe(listTwo);
    const skillA = listOne.find((item) => item.name === "a");
    const skillB = listOne.find((item) => item.name === "b");
    expect(skillA).toBeDefined();
    expect(skillB).toBeDefined();
    if (skillA === undefined || skillB === undefined) return;
    // DANH TÍNH, không phải so sâu: hai bản sao chia sẻ tham chiếu vẫn qua mọi phép so sâu.
    expect(listOne[0]).not.toBe(listTwo[0]);
    expect(skillA.invocation).not.toBe(skillB.invocation);
    skillA.invocation.modelInvocable = false;
    expect(skillB.invocation.modelInvocable).toBe(true);
    // Hai thực thể dịch vụ ⇒ hai sổ độc lập.
    expect((await second.registry.list()).length).toBe(0);
  });
});
