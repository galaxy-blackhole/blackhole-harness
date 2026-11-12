/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-host-skill-filesystem: mỗi ca chạy CẢ HAI bản (gói ta và
 *      bundle gốc @deepseek-ai/dsh-skill-filesystem) trên thư mục tạm thật rồi so: 5 export, name,
 *      inject, Config (schema/defaults/lỗi), apply (registerProvider/effect/fs-observed), roots theo
 *      rank, frontmatter, invocation, get, các nhánh lỗi ctx.fs (vắng service, FS_NOT_FOUND,
 *      FS_NOT_TEXT), bundled trustedHost, watcher và observeHostMutation. KHÔNG gọi mạng.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import * as ours from "../../packages/host/skill-filesystem/src/index.ts";
import type { Config as SkillFilesystemConfig } from "../../packages/host/skill-filesystem/src/config.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");

/** Bundle GỐC đã build trong kernel (chỉ đọc). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-skill-filesystem", "lib", "index.js");

/** Bản gốc nạp động, ép về cùng kiểu bề mặt với gói ta để so A/B. */
const stock = (await import(STOCK)) as unknown as typeof ours;

/** Kiểu bề mặt công khai của gói ta. */
type Lib = typeof ours;

/** Instance provider, dùng để suy ra mọi kiểu tra cứu từ chính gói ta. */
type ProviderInstance = InstanceType<Lib["FileSystemSkillProvider"]>;

/** Kết quả `list`: mảng candidate hoặc observation. */
type ListResult = Awaited<ReturnType<ProviderInstance["list"]>>;

/** Một candidate trong mảng kết quả (phân phối trên union). */
type CandidateOf<T> = T extends readonly (infer U)[] ? U : never;

/** Một candidate do provider trả. */
type Candidate = CandidateOf<ListResult>;

/** Một definition đầy đủ (có thể undefined khi tệp biến mất). */
type Definition = Awaited<ReturnType<ProviderInstance["get"]>>;

/** Tuỳ chọn tra cứu của provider. */
type LookupOptions = Parameters<ProviderInstance["list"]>[0];

/** Context mà constructor provider nhận (suy ra, không import trực tiếp). */
type ProviderContext = ConstructorParameters<Lib["FileSystemSkillProvider"]>[0];

/** Control vòng đời mà constructor provider nhận. */
type ProviderControl = ConstructorParameters<Lib["FileSystemSkillProvider"]>[1];

/** Bề mặt provider tối thiểu mà test dùng (đủ cho cả hai bản). */
interface ProviderLike {
  /** Tên provider. */
  readonly name: string;
  /** Khám phá candidate. */
  list(options: LookupOptions): Promise<ListResult>;
  /** Nạp thân kỹ năng. */
  get(candidate: Candidate, options: LookupOptions): Promise<Definition>;
  /** Invalidate sau ghi/sửa của host. */
  observeHostMutation(path: string): void;
  /** Đóng watcher. */
  dispose(): Promise<void>;
}

/** Target tối thiểu của filesystem giả. */
interface FakeTarget {
  /** Đường dẫn hiển thị. */
  displayPath: string;
}

/** Metadata tối thiểu của filesystem giả. */
interface FakeInfo {
  /** Loại target. */
  type: "file";
}

/** Entry tối thiểu của filesystem giả. */
interface FakeEntry {
  /** Tên mục. */
  name: string;
  /** Loại mục. */
  type: "file" | "directory";
  /** Target của mục. */
  target: FakeTarget;
}

/** Dịch vụ filesystem giả cấu trúc (không cần kế thừa lớp stock). */
interface FakeFs {
  /** Resolve đường dẫn thành target. */
  resolve(path: string): Promise<FakeTarget>;
  /** Liệt kê thư mục. */
  listDir(target: FakeTarget): Promise<FakeEntry[]>;
  /** Metadata target. */
  stat(target: FakeTarget, signal?: AbortSignal): Promise<FakeInfo | undefined>;
  /** Đọc text. */
  readText(target: FakeTarget, signal?: AbortSignal): Promise<string>;
  /** Đường dẫn tiến trình. */
  processPath(target: FakeTarget): string;
}

/** Trạng thái của filesystem giả. */
interface FakeFsState {
  /** Nội dung các thư mục. */
  entries?: Map<string, FakeEntry[]>;
  /** Nội dung các tệp. */
  files?: Map<string, string>;
  /** resolve luôn ném FS_NOT_FOUND. */
  missingResolve?: boolean;
  /** Các tệp readText ném FS_NOT_TEXT. */
  notText?: Set<string>;
  /** Nhật ký lời gọi. */
  calls: string[];
}

/** Harness context giả ghi lại mọi tương tác của apply. */
interface CtxHarness {
  /** Context đã ép kiểu cho provider. */
  readonly ctx: ProviderContext;
  /** Cảnh báo logger. */
  readonly logs: string[];
  /** Factory provider do registerProvider nhận. */
  readonly registered: Array<(control: ProviderControl) => ProviderLike>;
  /** Effect đã đăng ký cùng disposer đã lấy ra. */
  readonly effects: Array<{ label: string | undefined; disposers: Array<() => unknown> }>;
  /** Listener sự kiện đã đăng ký. */
  readonly events: Array<{ event: string; listener: (...args: unknown[]) => void }>;
}

/** Một lỗi có mã kiểu Node/ctx.fs. */
type CodedError = Error & { code: string };

/**
 * Gắn mã lỗi vào một Error.
 * Nhận: error — lỗi gốc; code — mã cần gắn.
 * Trả: chính error đã có `code`.
 */
function withCode(error: Error, code: string): CodedError {
  return Object.assign(error, { code });
}

/**
 * Tạo thư mục tạm chứa các tệp/thư mục cho trước.
 * Nhận: files — bản đồ đường dẫn tương đối → nội dung; dirs — thư mục rỗng cần tạo.
 * Trả: đường dẫn tuyệt đối của gốc tạm.
 */
function makeTemp(files: Record<string, string>, dirs: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "gbh-skill-fs-"));
  for (const dir of dirs) mkdirSync(join(root, dir), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/**
 * Sinh nội dung một tệp kỹ năng có frontmatter.
 * Nhận: name — tên kỹ năng; description — mô tả; extra — dòng frontmatter bổ sung (có \n cuối).
 * Trả: chuỗi Markdown hoàn chỉnh.
 */
function skillFile(name: string, description: string, extra = ""): string {
  return `---\nname: ${name}\ndescription: ${description}\n${extra}---\nBody of ${name}.\n`;
}

/**
 * Thay mọi đường dẫn gốc tạm (và realpath của nó) bằng token <ROOT> để so A/B trên hai thư mục khác nhau.
 * Nhận: value — kết quả bất kỳ; root — gốc tạm của lần chạy.
 * Trả: bản sao sâu đã thay đường dẫn, giữ nguyên khoá undefined.
 */
function scrub<T>(value: T, root: string): T {
  const paths = [root, realpathSync(root)].sort((left, right) => right.length - left.length);
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      let text = node;
      for (const path of paths) text = text.split(path).join("<ROOT>");
      return text;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]));
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * Chạy cùng một phép trên gói ta rồi bản gốc, mỗi bên một thư mục tạm riêng.
 * Nhận: files/dirs — nội dung thư mục tạm; run — phép nhận (thư viện, gốc tạm).
 * Trả: cặp kết quả [của ta, bản gốc].
 */
async function abWithFixture<T>(
  files: Record<string, string>,
  dirs: string[],
  run: (lib: Lib, root: string) => Promise<T> | T,
): Promise<[T, T]> {
  const results: T[] = [];
  for (const lib of [ours, stock] as const) {
    const root = makeTemp(files, dirs);
    try {
      results.push(scrub(await run(lib, root), root));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  return [results[0] as T, results[1] as T];
}

/**
 * Chạy cùng một phép trên hai thư viện mà không cần thư mục tạm.
 * Nhận: run — phép nhận thư viện.
 * Trả: cặp kết quả [của ta, bản gốc].
 */
async function ab<T>(run: (lib: Lib) => Promise<T> | T): Promise<[T, T]> {
  return [await run(ours), await run(stock)];
}

/**
 * Bắt lỗi đồng bộ/bất đồng bộ thành dữ liệu so sánh được.
 * Nhận: run — phép có thể ném.
 * Trả: { name, message } của lỗi, hoặc "NO_ERROR".
 */
async function caught(run: () => Promise<unknown> | unknown): Promise<{ name: string; message: string }> {
  try {
    await run();
    return { name: "NO_ERROR", message: "" };
  } catch (error) {
    const err = error as Error;
    return { name: err.constructor.name, message: err.message };
  }
}

/**
 * Dựng context giả có logger/skills/effect/on và `get("fs")` tuỳ chọn.
 * Nhận: fs — dịch vụ filesystem giả (undefined nghĩa là THIẾU service); withSkills — có ctx.skills hay không.
 * Trả: harness ghi lại log/registration/effect/event.
 */
function makeCtx(fs?: FakeFs, withSkills = true): CtxHarness {
  const logs: string[] = [];
  const registered: Array<(control: ProviderControl) => ProviderLike> = [];
  const effects: Array<{ label: string | undefined; disposers: Array<() => unknown> }> = [];
  const events: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];
  const ctx = {
    get: (name: string) => (name === "fs" ? (fs as unknown as FakeFs) : undefined),
    logger: { warn: (message: string) => logs.push(message) },
    effect: (execute: () => Generator<() => unknown>, label?: string) => {
      effects.push({ label, disposers: [...execute()] });
      return () => {};
    },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      events.push({ event, listener });
      return () => {};
    },
  } as Record<string, unknown>;
  if (withSkills) {
    ctx.skills = {
      registerProvider: (create: (control: ProviderControl) => ProviderLike) => {
        registered.push(create);
        return () => {};
      },
    };
  }
  return { ctx: ctx as unknown as ProviderContext, logs, registered, effects, events };
}

/** Config nền trỏ vào các thư mục con của gốc tạm. */
function baseConfig(root: string, overrides: Partial<SkillFilesystemConfig> = {}): SkillFilesystemConfig {
  return {
    includeDefaultRoots: false,
    watch: false,
    customSkillDirs: [join(root, "custom")],
    dshHome: join(root, "user-dsh"),
    agentsHome: join(root, "user-agents"),
    bundledSkillDir: join(root, "bundled"),
    ...overrides,
  };
}

/** Provider kèm harness và bộ đếm invalidate. */
interface ProviderHarness {
  /** Harness context. */
  harness: CtxHarness;
  /** Provider đang test. */
  provider: ProviderLike;
  /** Bộ điều khiển tín hiệu huỷ. */
  abort: AbortController;
  /** Số lần invalidate. */
  invalidates: number[];
}

/**
 * Dựng provider cho một thư viện.
 * Nhận: lib — gói ta hoặc bản gốc; config — cấu hình; fs — dịch vụ filesystem giả tuỳ chọn.
 * Trả: provider cùng harness/invalidate/abort.
 */
function makeProvider(lib: Lib, config: SkillFilesystemConfig, fs?: FakeFs): ProviderHarness {
  const harness = makeCtx(fs);
  const abort = new AbortController();
  const invalidates: number[] = [];
  const control: ProviderControl = {
    signal: abort.signal,
    invalidate: () => invalidates.push(1),
  };
  const provider = new lib.FileSystemSkillProvider(harness.ctx, control, config);
  return { harness, provider, abort, invalidates };
}

/** Chuẩn hoá kết quả list thành mảng candidate. */
function candidatesOf(result: ListResult): readonly Candidate[] {
  return Array.isArray(result) ? (result as readonly Candidate[]) : (result as { candidates: readonly Candidate[] }).candidates;
}

/** Tóm tắt một candidate để so sâu, gồm cả rank/source/locator. */
function candidateSummary(candidate: Candidate): Record<string, unknown> {
  const base = candidate.resourceBase;
  return {
    name: candidate.name,
    description: candidate.description,
    whenToUse: candidate.whenToUse,
    invocation: candidate.invocation,
    provider: candidate.provider,
    source: candidate.source,
    rank: candidate.rank,
    path: candidate.path,
    resourceBasePath: base?.kind === "directory" ? base.path : undefined,
    metadata: candidate.metadata,
  };
}

/** Tóm tắt một definition để so sâu. */
function definitionSummary(definition: Definition): Record<string, unknown> | undefined {
  if (definition === undefined) return undefined;
  const base = definition.resourceBase;
  return {
    name: definition.name,
    description: definition.description,
    whenToUse: definition.whenToUse,
    invocation: definition.invocation,
    provider: definition.provider,
    source: definition.source,
    path: definition.path,
    resourceBasePath: base?.kind === "directory" ? base.path : undefined,
    metadata: definition.metadata,
    content: definition.content,
  };
}

/** Dựng một entry filesystem giả. */
function fsEntry(name: string, type: "file" | "directory", path: string): FakeEntry {
  return { name, type, target: { displayPath: path } };
}

/**
 * Dựng filesystem giả cấu trúc có ghi nhật ký lời gọi.
 * Nhận: state — bảng thư mục/tệp và cờ lỗi.
 * Trả: FakeFs dùng cho ctx.get("fs").
 */
function makeFakeFs(state: FakeFsState): FakeFs {
  return {
    async resolve(path) {
      state.calls.push(`resolve ${path}`);
      if (state.missingResolve === true) throw withCode(new Error("gone"), "FS_NOT_FOUND");
      return { displayPath: path };
    },
    async listDir(target) {
      state.calls.push(`listDir ${target.displayPath}`);
      const entries = state.entries?.get(target.displayPath);
      if (entries === undefined) throw withCode(new Error("not-dir"), "FS_NOT_DIRECTORY");
      return entries;
    },
    async stat(target) {
      state.calls.push(`stat ${target.displayPath}`);
      return { type: "file" };
    },
    async readText(target) {
      state.calls.push(`readText ${target.displayPath}`);
      if (state.notText?.has(target.displayPath) === true) throw withCode(new Error("binary"), "FS_NOT_TEXT");
      return state.files?.get(target.displayPath) ?? "";
    },
    processPath(target) {
      state.calls.push(`processPath ${target.displayPath}`);
      return `process:${target.displayPath}`;
    },
  };
}

describe("bề mặt A/B (export · name · inject · Config)", () => {
  test("đúng 5 export như bundle gốc, không thêm không bớt", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["Config", "FileSystemSkillProvider", "apply", "inject", "name"]);
    expect("default" in ours).toBe(false);
    expect("execute" in ours).toBe(false);
  });

  test("name/inject/arity giống hệt", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("skill-filesystem");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["skills"]);
    expect(Array.isArray(ours.inject)).toBe(true);
    expect(ours.apply.length).toBe(stock.apply.length);
    expect(ours.FileSystemSkillProvider.length).toBe(stock.FileSystemSkillProvider.length);
  });

  test("Config: String(schema) và defaults điền đầy đủ giống hệt", () => {
    expect(String(ours.Config)).toBe(String(stock.Config));
    expect(ours.Config({})).toEqual(stock.Config({}));
    expect(ours.Config({})).toEqual({
      providerName: "filesystem",
      includeDefaultRoots: true,
      customSkillDirs: [],
      watch: true,
      watchUsePolling: false,
      watchStabilityThresholdMs: 200,
      watchPollIntervalMs: 100,
      watchMaxProjects: 128,
      watchFollowSymlinks: true,
    });
  });

  test("Config: giá trị tuỳ biến và 4 lỗi validation giống hệt", async () => {
    const custom = { providerName: "mine", includeDefaultRoots: false, customSkillDirs: ["a", "b"], watch: false, watchUsePolling: true, watchStabilityThresholdMs: 7, watchPollIntervalMs: 8, watchMaxProjects: 9, watchFollowSymlinks: false, dshHome: "/d", agentsHome: "/a", bundledSkillDir: "/b" };
    expect(ours.Config(custom)).toEqual(stock.Config(custom));
    expect(ours.Config(custom)).toEqual(custom);
    const invalid: unknown[] = [{ providerName: "" }, { providerName: 5 }, { watch: "yes" }, { customSkillDirs: "x" }];
    for (const value of invalid) {
      const mine = await caught(() => ours.Config(value as never));
      const theirs = await caught(() => stock.Config(value as never));
      expect(mine).toEqual(theirs);
      expect(mine.name).toBe("ValidationError");
    }
  });
});

describe("apply và hành vi thiếu service", () => {
  test("apply đăng ký provider, effect đóng watcher và listener fs/observed", async () => {
    const [mine, theirs] = await abWithFixture({}, ["custom"], async (lib, root) => {
      const harness = makeCtx();
      lib.apply(harness.ctx, baseConfig(root));
      const provider = harness.registered[0]?.({
        signal: new AbortController().signal,
        invalidate: () => {},
      });
      if (provider === undefined) throw new Error("apply did not register a provider");
      await provider.list({ cwd: root });
      await harness.effects[0]?.disposers[0]?.();
      return {
        registered: harness.registered.length,
        label: harness.effects[0]?.label,
        event: harness.events[0]?.event,
        providerName: provider.name,
        logs: harness.logs,
      };
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({
      registered: 1,
      label: "skill-filesystem watcher",
      event: "fs/observed",
      providerName: "filesystem",
      logs: [],
    });
  });

  test("apply thiếu ctx.skills ⇒ ném cùng lỗi", async () => {
    const [mine, theirs] = await ab(async (lib) => {
      const harness = makeCtx(undefined, false);
      return await caught(() => lib.apply(harness.ctx, { watch: false }));
    });
    expect(mine).toEqual(theirs);
    expect(mine.name).toBe("TypeError");
  });

  test("listener fs/observed chỉ edit/write và chỉ đường dẫn đúng hình dạng kỹ năng", async () => {
    const [mine, theirs] = await abWithFixture({}, ["custom"], async (lib, root) => {
      const harness = makeCtx();
      lib.apply(harness.ctx, baseConfig(root));
      const invalidates: number[] = [];
      const provider = harness.registered[0]?.({
        signal: new AbortController().signal,
        invalidate: () => invalidates.push(1),
      });
      if (provider === undefined) throw new Error("apply did not register a provider");
      await provider.list({ cwd: root });
      const fire = (path: string, actor: object | undefined): void => {
        harness.events[0]?.listener({ displayPath: path }, {}, actor);
      };
      fire(join(root, "custom", "a.md"), { name: "edit" });
      await Promise.resolve();
      const edit = invalidates.length;
      fire(join(root, "custom", "a.md"), { name: "write" });
      await Promise.resolve();
      const write = invalidates.length;
      fire(join(root, "custom", "a.md"), { name: "read" });
      fire(join(root, "custom", "a.md"), undefined);
      await Promise.resolve();
      const otherTools = invalidates.length;
      fire(join(root, "custom", "a.txt"), { name: "edit" });
      fire(join(root, "custom", "x", "SKILL.md", "y"), { name: "edit" });
      await Promise.resolve();
      const shape = invalidates.length;
      await harness.effects[0]?.disposers[0]?.();
      return { edit, write, otherTools, shape, logs: harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({ edit: 1, write: 2, otherTools: 2, shape: 2, logs: [] });
  });

  test("dispose dùng chung một promise; abort tín hiệu cũng dispose được", async () => {
    const [mine, theirs] = await abWithFixture({}, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root));
      const first = h.provider.dispose();
      const second = h.provider.dispose();
      h.abort.abort();
      await first;
      await h.provider.dispose();
      return { samePromise: first === second, resolved: true };
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({ samePromise: true, resolved: true });
  });
});

describe("roots và discovery", () => {
  test("thứ tự root/rank/source: project-dsh 100 → project-agents 200 → custom 300 → user 400/500 → bundled 600", async () => {
    const files = {
      ".dsh/skills/alpha/SKILL.md": skillFile("alpha", "Alpha", "whenToUse: when alpha\nmetadata:\n  team: core\n"),
      ".dsh/skills/beta.md": skillFile("beta", "Beta flat"),
      ".agents/skills/gamma/SKILL.md": skillFile("gamma", "Gamma"),
      "custom/deep/SKILL.md": skillFile("deep", "Deep custom"),
      "custom/zflat.md": skillFile("zflat", "Z flat"),
      "custom/readme.txt": "ignored",
      "user-dsh/skills/delta.md": skillFile("delta", "Delta user"),
      "user-dsh/skills/.system/ignored.md": skillFile("ignored", "Ignored"),
      "user-agents/skills/epsilon/SKILL.md": skillFile("epsilon", "Epsilon"),
      "bundled/zeta/SKILL.md": skillFile("zeta", "Zeta bundled"),
    };
    const [mine, theirs] = await abWithFixture(files, [".git", "custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root, { includeDefaultRoots: true }));
      const candidates = candidatesOf(await h.provider.list({ cwd: root }));
      await h.provider.dispose();
      return {
        summaries: candidates.map(candidateSummary),
        sources: candidates.map((candidate) => candidate.source),
        ranks: candidates.map((candidate) => candidate.rank),
      };
    });
    expect(mine).toEqual(theirs);
    expect(mine.sources).toEqual(["project-dsh", "project-dsh", "project-agents", "custom", "custom", "user-dsh", "user-agents", "bundled"]);
    expect(mine.ranks).toEqual([100, 100, 200, 300, 300, 400, 500, 600]);
    expect(mine.summaries.map((row) => row.name)).toEqual(["alpha", "beta", "gamma", "deep", "zflat", "delta", "epsilon", "zeta"]);
    expect(mine.summaries[0]?.whenToUse).toBe("when alpha");
    expect(mine.summaries[0]?.metadata).toEqual({ team: "core" });
  });

  test("includeDefaultRoots=false chỉ còn custom + bundled; cwd undefined không thêm root dự án", async () => {
    const files = {
      "custom/one.md": skillFile("one", "One"),
      "bundled/two/SKILL.md": skillFile("two", "Two"),
      "user-dsh/skills/three.md": skillFile("three", "Three"),
    };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const noDefaults = makeProvider(lib, baseConfig(root), undefined);
      const onlyCustom = candidatesOf(await noDefaults.provider.list({ cwd: root })).map((candidate) => candidate.name);
      await noDefaults.provider.dispose();
      const withDefaults = makeProvider(lib, baseConfig(root, { includeDefaultRoots: true }), undefined);
      const noCwd = candidatesOf(await withDefaults.provider.list({})).map((candidate) => candidate.name);
      await withDefaults.provider.dispose();
      return { onlyCustom, noCwd };
    });
    expect(mine).toEqual(theirs);
    expect(mine.onlyCustom).toEqual(["one", "two"]);
    expect(mine.noCwd).toEqual(["one", "three", "two"]);
  });

  test("skipSystem bỏ .system ở root user-dsh nhưng không bỏ ở custom", async () => {
    const files = {
      "custom/.system/SKILL.md": skillFile("system-custom", "System custom"),
      "user-dsh/skills/.system/SKILL.md": skillFile("system-user", "System user"),
      "user-dsh/skills/kept-user.md": skillFile("kept-user", "Kept user"),
    };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root, { includeDefaultRoots: true }));
      const names = candidatesOf(await h.provider.list({ cwd: root })).map((candidate) => candidate.name);
      await h.provider.dispose();
      return names;
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual(["system-custom", "kept-user"]);
  });

  test("DSH_BUNDLED_SKILL_DIR chỉ dùng khi includeDefaultRoots bật", async () => {
    const files = { "bundled/env/SKILL.md": skillFile("env", "From env") };
    const [mine, theirs] = await abWithFixture(files, [], async (lib, root) => {
      const previous = process.env.DSH_BUNDLED_SKILL_DIR;
      process.env.DSH_BUNDLED_SKILL_DIR = join(root, "bundled");
      try {
        const enabled = makeProvider(lib, { includeDefaultRoots: true, watch: false, dshHome: join(root, "d"), agentsHome: join(root, "a") });
        const fromEnv = candidatesOf(await enabled.provider.list({ cwd: root })).map((candidate) => candidate.name);
        await enabled.provider.dispose();
        const disabled = makeProvider(lib, { includeDefaultRoots: false, watch: false });
        const withoutDefaults = candidatesOf(await disabled.provider.list({ cwd: root })).map((candidate) => candidate.name);
        await disabled.provider.dispose();
        return { fromEnv, withoutDefaults };
      } finally {
        if (previous === undefined) delete process.env.DSH_BUNDLED_SKILL_DIR;
        else process.env.DSH_BUNDLED_SKILL_DIR = previous;
      }
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({ fromEnv: ["env"], withoutDefaults: [] });
  });
});

describe("frontmatter và invocation", () => {
  test("get trả đủ whenToUse/metadata/content trim và resourceBase", async () => {
    const files = {
      "custom/alpha/SKILL.md": skillFile("alpha", "Alpha", "whenToUse: when alpha\nmetadata:\n  team: core\n"),
    };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root));
      const candidates = candidatesOf(await h.provider.list({ cwd: root }));
      const definition = await h.provider.get(candidates[0] as Candidate, {});
      await h.provider.dispose();
      return definitionSummary(definition);
    });
    expect(mine).toEqual(theirs);
    expect(mine).toMatchObject({
      name: "alpha",
      description: "Alpha",
      whenToUse: "when alpha",
      metadata: { team: "core" },
      content: "Body of alpha.",
    });
    expect(mine?.path).toBe("<ROOT>/custom/alpha/SKILL.md");
    expect(mine?.resourceBasePath).toBe("<ROOT>/custom/alpha");
    expect(mine?.content).toBe("Body of alpha.");
  });

  test("mọi nhánh cảnh báo frontmatter giống hệt và đúng thứ tự", async () => {
    const files = {
      "custom/badbool.md": skillFile("badbool", "Bad bool", "disable-model-invocation: maybe\n"),
      "custom/badname.md": skillFile("Bad Name", "Bad name"),
      "custom/badyaml.md": "---\nname: [unclosed\n---\nBody\n",
      "custom/legacy.md": skillFile("legacy", "Legacy", "disableModelInvocation: true\n"),
      "custom/nodesc.md": "---\nname: nodesc\n---\nBody\n",
      "custom/nofm.md": "Body only\n",
      "custom/valid.md": skillFile("valid", "Valid"),
    };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root));
      const names = candidatesOf(await h.provider.list({ cwd: root })).map((candidate) => candidate.name);
      await h.provider.dispose();
      return { names, logs: h.harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine.names).toEqual(["valid"]);
    expect(mine.logs).toHaveLength(6);
    expect(mine.logs[0]).toContain("invalid invocation frontmatter");
    expect(mine.logs[1]).toContain('invalid skill name "Bad Name"');
    expect(mine.logs[2]).toContain("invalid YAML frontmatter");
    expect(mine.logs[3]).toContain('"disableModelInvocation" is unsupported');
    expect(mine.logs[4]).toContain("frontmatter requires name and description");
    expect(mine.logs[5]).toContain("missing YAML frontmatter");
  });

  test("invocation: disable-model-invocation/user-invocable và 1/0/yes/off", async () => {
    const files = {
      "custom/dm.md": skillFile("dm", "DM", "disable-model-invocation: true\n"),
      "custom/off.md": skillFile("off", "Off", "user-invocable: off\n"),
      "custom/one.md": skillFile("one", "One", "disable-model-invocation: 1\nuser-invocable: 0\n"),
      "custom/plain.md": skillFile("plain", "Plain"),
      "custom/yes.md": skillFile("yes", "Yes", "disable-model-invocation: yes\n"),
    };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root));
      const rows = candidatesOf(await h.provider.list({ cwd: root })).map((candidate) => ({
        name: candidate.name,
        invocation: candidate.invocation,
      }));
      await h.provider.dispose();
      return rows;
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual([
      { name: "dm", invocation: { modelInvocable: false, userInvocable: true } },
      { name: "off", invocation: { modelInvocable: true, userInvocable: false } },
      { name: "one", invocation: { modelInvocable: false, userInvocable: false } },
      { name: "plain", invocation: { modelInvocable: true, userInvocable: true } },
      { name: "yes", invocation: { modelInvocable: false, userInvocable: true } },
    ]);
  });

  test("get: tệp biến mất sau list ⇒ undefined; signal đã huỷ ⇒ cùng lỗi huỷ", async () => {
    const files = { "custom/alpha/SKILL.md": skillFile("alpha", "Alpha") };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root));
      const candidate = candidatesOf(await h.provider.list({ cwd: root }))[0] as Candidate;
      unlinkSync(join(root, "custom", "alpha", "SKILL.md"));
      const missing = await h.provider.get(candidate, {});
      const controller = new AbortController();
      controller.abort();
      const aborted = await caught(() => h.provider.get(candidate, { signal: controller.signal }));
      await h.provider.dispose();
      return { missing, aborted };
    });
    expect(mine).toEqual(theirs);
    expect(mine.missing).toBeUndefined();
    expect(mine.aborted.name).toBe("DOMException");
    expect(mine.aborted.message.length).toBeGreaterThan(0);
  });
});

describe("seam ctx.fs và các nhánh lỗi", () => {
  test("CÓ ctx.fs: list/get đi qua resolve → listDir → stat → processPath/readText", async () => {
    const files = { "custom/one/SKILL.md": skillFile("one", "One FS"), "custom/flat.md": skillFile("flat", "Flat FS") };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const state: FakeFsState = {
        entries: new Map([
          [join(root, "custom"), [fsEntry("one", "directory", join(root, "custom", "one")), fsEntry("flat.md", "file", join(root, "custom", "flat.md"))]],
          [join(root, "custom", "one"), []],
        ]),
        files: new Map([
          [join(root, "custom", "one", "SKILL.md"), skillFile("one", "One FS")],
          [join(root, "custom", "flat.md"), skillFile("flat", "Flat FS")],
        ]),
        calls: [],
      };
      const h = makeProvider(lib, baseConfig(root), makeFakeFs(state));
      const candidates = candidatesOf(await h.provider.list({ cwd: root }));
      const definitions = [];
      for (const candidate of candidates) definitions.push(definitionSummary(await h.provider.get(candidate, {})));
      await h.provider.dispose();
      return { candidates: candidates.map(candidateSummary), definitions, calls: state.calls, logs: h.harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine.candidates.map((candidate) => candidate.name)).toEqual(["flat", "one"]);
    expect(mine.definitions.map((definition) => definition?.path)).toEqual([
      mine.candidates[0]?.path,
      mine.candidates[1]?.path,
    ]);
    expect(mine.candidates[0]?.path).toBe("process:<ROOT>/custom/flat.md");
    expect(mine.calls[0]?.startsWith("resolve ")).toBe(true);
    expect(mine.calls.some((call) => call.startsWith("listDir "))).toBe(true);
    expect(mine.calls.some((call) => call.startsWith("stat "))).toBe(true);
    expect(mine.calls.some((call) => call.startsWith("readText "))).toBe(true);
    expect(mine.logs).toEqual([]);
  });

  test("THIẾU ctx.fs: fallback Node cho cả list lẫn get", async () => {
    const files = { "custom/one/SKILL.md": skillFile("one", "One Node") };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root), undefined);
      const candidates = candidatesOf(await h.provider.list({ cwd: root }));
      const definition = await h.provider.get(candidates[0] as Candidate, {});
      await h.provider.dispose();
      return { candidates: candidates.map(candidateSummary), definition: definitionSummary(definition), logs: h.harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine.candidates).toHaveLength(1);
    expect(mine.definition?.content).toBe("Body of one.");
    expect(mine.logs).toEqual([]);
  });

  test("FS_NOT_TEXT khi readText ⇒ cảnh báo + bỏ kỹ năng; FS_NOT_FOUND khi resolve ⇒ []", async () => {
    const files = { "custom/binary.md": skillFile("binary", "Binary"), "custom/ok.md": skillFile("ok", "Ok") };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const textState: FakeFsState = {
        entries: new Map([
          [join(root, "custom"), [fsEntry("binary.md", "file", join(root, "custom", "binary.md")), fsEntry("ok.md", "file", join(root, "custom", "ok.md"))]],
        ]),
        files: new Map([[join(root, "custom", "ok.md"), skillFile("ok", "Ok")]]),
        notText: new Set([join(root, "custom", "binary.md")]),
        calls: [],
      };
      const text = makeProvider(lib, baseConfig(root), makeFakeFs(textState));
      const names = candidatesOf(await text.provider.list({ cwd: root })).map((candidate) => candidate.name);
      const textLogs = text.harness.logs;
      await text.provider.dispose();
      const absentState: FakeFsState = { missingResolve: true, calls: [] };
      const absent = makeProvider(lib, baseConfig(root), makeFakeFs(absentState));
      const absentNames = candidatesOf(await absent.provider.list({ cwd: root })).map((candidate) => candidate.name);
      const absentLogs = absent.harness.logs;
      await absent.provider.dispose();
      return { names, textLogs, absentNames, absentLogs };
    });
    expect(mine).toEqual(theirs);
    expect(mine.names).toEqual(["ok"]);
    expect(mine.textLogs).toHaveLength(1);
    expect(mine.textLogs[0]).toContain("failed to read text file at");
    expect(mine.absentNames).toEqual([]);
    expect(mine.absentLogs).toEqual([]);
  });

  test("bundled trustedHost đọc bằng Node, KHÔNG gọi ctx.fs", async () => {
    const files = { "bundled/zeta/SKILL.md": skillFile("zeta", "Zeta") };
    const [mine, theirs] = await abWithFixture(files, [], async (lib, root) => {
      const state: FakeFsState = { missingResolve: true, calls: [] };
      const h = makeProvider(lib, baseConfig(root, { customSkillDirs: [] }), makeFakeFs(state));
      const candidates = candidatesOf(await h.provider.list({ cwd: root }));
      const definition = await h.provider.get(candidates[0] as Candidate, {});
      await h.provider.dispose();
      return { names: candidates.map((candidate) => candidate.name), content: definition?.content, calls: state.calls, logs: h.harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine.names).toEqual(["zeta"]);
    expect(mine.content).toBe("Body of zeta.");
    expect(mine.calls).toEqual([]);
  });
});

describe("watcher, giới hạn dự án và quan sát ghi/sửa", () => {
  test("watch bật: mở chokidar, list đủ candidate, dispose sạch", async () => {
    const files = { "custom/one/SKILL.md": skillFile("one", "One") };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root, { watch: true, watchUsePolling: true, watchStabilityThresholdMs: 10, watchPollIntervalMs: 10 }));
      const result = await h.provider.list({ cwd: root });
      const isArray = Array.isArray(result);
      const names = candidatesOf(result).map((candidate) => candidate.name);
      await h.provider.dispose();
      return { isArray, names, logs: h.harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({ isArray: true, names: ["one"], logs: [] });
  });

  test("watchMaxProjects=1 đuổi dự án cũ và invalidate đúng một lần", async () => {
    const files = { "p1/.dsh/skills/a.md": skillFile("a", "A"), "p2/.dsh/skills/b.md": skillFile("b", "B") };
    const [mine, theirs] = await abWithFixture(files, [".git", "p1/.git", "p2/.git"], async (lib, root) => {
      const h = makeProvider(lib, {
        includeDefaultRoots: true,
        watch: false,
        watchMaxProjects: 1,
        dshHome: join(root, "d"),
        agentsHome: join(root, "a"),
      });
      const first = candidatesOf(await h.provider.list({ cwd: join(root, "p1") })).map((candidate) => candidate.name);
      const firstInvalidates = h.invalidates.length;
      const second = candidatesOf(await h.provider.list({ cwd: join(root, "p2") })).map((candidate) => candidate.name);
      const secondInvalidates = h.invalidates.length;
      await h.provider.dispose();
      return { first, firstInvalidates, second, secondInvalidates, logs: h.harness.logs };
    });
    expect(mine).toEqual(theirs);
    expect(mine.first).toEqual(["a"]);
    expect(mine.firstInvalidates).toBe(0);
    expect(mine.second).toEqual(["b"]);
    expect(mine.secondInvalidates).toBe(1);
  });

  test("observeHostMutation: đúng cấp/cấu trúc, tôn trọng skipSystem và root bundled", async () => {
    const files = { "custom/a/SKILL.md": skillFile("a", "A"), "bundled/z/SKILL.md": skillFile("z", "Z") };
    const [mine, theirs] = await abWithFixture(files, ["custom"], async (lib, root) => {
      const h = makeProvider(lib, baseConfig(root, { includeDefaultRoots: true }));
      await h.provider.list({ cwd: root });
      const fire = (path: string): void => h.provider.observeHostMutation(path);
      fire(join(root, "custom", "x.md"));
      const one = h.invalidates.length;
      fire(join(root, "custom", "x.txt"));
      fire(join(root, "custom", "a", "b", "SKILL.md"));
      const shape = h.invalidates.length;
      fire(join(root, "user-dsh", "skills", ".system", "x.md"));
      const system = h.invalidates.length;
      fire(join(root, "bundled", "z", "SKILL.md"));
      const bundled = h.invalidates.length;
      fire(join(tmpdir(), "outside.md"));
      const outside = h.invalidates.length;
      await h.provider.dispose();
      return { one, shape, system, bundled, outside };
    });
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({ one: 1, shape: 1, system: 1, bundled: 2, outside: 2 });
  });

  test("constructor chặn 3 ngưỡng watcher không phải số nguyên dương", async () => {
    const [mine, theirs] = await ab(async (lib) => {
      const rows = [];
      for (const config of [
        { watchStabilityThresholdMs: 0 },
        { watchPollIntervalMs: 0 },
        { watchMaxProjects: 0 },
      ]) {
        const harness = makeCtx();
        rows.push(
          await caught(
            () =>
              new lib.FileSystemSkillProvider(
                harness.ctx,
                { signal: new AbortController().signal, invalidate: () => {} },
                config,
              ).dispose(),
          ),
        );
      }
      return rows;
    });
    expect(mine).toEqual(theirs);
    expect(mine.map((row) => row.message)).toEqual([
      "skill-filesystem: watchStabilityThresholdMs must be a positive integer",
      "skill-filesystem: watchPollIntervalMs must be a positive integer",
      "skill-filesystem: watchMaxProjects must be a positive integer",
    ]);
  });
});
