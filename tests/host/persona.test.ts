/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-persona (packages/host/persona): build THẬT vào thư mục tạm, nạp lib của ta lẫn bundle gốc @deepseek-ai/dsh-persona, rồi so SÂU trên CÙNG fixture giả — export · Config · apply (section/order/text/complete/suppress/effect-dispose/lỗi).
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo — file này nằm ở tests/host. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "persona");
/** Build script của package — nạp ĐỘNG trong beforeAll, sau khi nguồn đã ổn định. */
const BUILD = join(PKG, "build.ts");
/** Bundle GỐC trong cây cài của kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-persona", "lib", "index.js");
/** Registry prompt gốc — nguồn của hai hằng số section, cũng là peer của cả hai bản. */
const STOCK_SYSTEM_PROMPT = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-system-prompt", "lib", "index.js");
/** Cây node_modules của kernel — symlink vào thư mục build tạm để phân giải peer. */
const PEERS = join(REPO, "apps", "host", "node_modules");

/** Tên section prefix do registry prompt đặt. */
const PREFIX_SECTION = "deployment:persona-prefix";
/** Tên section suffix do registry prompt đặt. */
const SUFFIX_SECTION = "deployment:persona-suffix";
/** Vị trí GIẢ của hai section — số lạ để bắt việc truyền sai khoá. */
const ORDERS = { DEPLOYMENT_PERSONA_PREFIX: 13, DEPLOYMENT_PERSONA_SUFFIX: 37 } as const;

/** Config thô mà cordis chuyển vào apply (đã hoặc chưa qua schema). */
interface ConfigInput {
  /** Persona prefix. */
  prefix?: unknown;
  /** Persona suffix. */
  suffix?: unknown;
  /** Cờ "prefix là cả system prompt". */
  complete?: unknown;
  /** Cờ "có đưa runtime context vào prompt". */
  includeRuntimeContext?: unknown;
}

/** Lời gọi Config của một bản. */
type ConfigCall = (input: ConfigInput) => Record<string, unknown>;

/** Bề mặt mô-đun mà cả hai bản phải có. */
interface PersonaModule {
  /** Tên plugin cordis. */
  name: string;
  /** Dịch vụ mà plugin inject. */
  inject: string[];
  /** Schema runtime của config. */
  Config: ConfigCall;
  /** Đăng ký hai section persona cho scope đang mount. */
  apply(ctx: FakeContext, config: ConfigInput): void;
  /** Hằng số tên section prefix (re-export từ registry prompt). */
  PERSONA_PREFIX_SECTION: string;
  /** Hằng số tên section suffix (re-export từ registry prompt). */
  PERSONA_SUFFIX_SECTION: string;
}

/** Một section đã đăng ký trên ctx giả. */
interface Section {
  /** Tên section. */
  name: string;
  /** Thứ tự sắp xếp. */
  order: number;
  /** Nội dung. */
  text: string;
  /** Chỉ có mặt khi section là "complete prompt". */
  complete?: boolean;
}

/** Bề mặt ctx giả — đủ cho apply của cả hai bản, không cần cordis thật. */
interface FakeContext {
  /** Chạy factory ngay và trả disposer (như Cordis). */
  effect(factory: () => unknown, label?: string): () => void;
  /** Seam prompt của scope đang mount. */
  systemPrompt: {
    /** Đăng ký một section, trả disposer. */
    section(section: Section): () => void;
    /** Tra thứ tự của một vị trí trung tâm. */
    getSectionOrder(name: string): number | undefined;
    /** Tắt runtime context của scope, trả disposer. */
    suppressRuntimeContext(): () => void;
  };
}

/** Lỗi cài sẵn cho một lần đăng ký section. */
interface Failure {
  /** Section nào sẽ ném. */
  at: "prefix" | "suffix";
  /** Lỗi ném ra. */
  error: Error;
}

/** Tuỳ chọn dựng fixture. */
interface FixtureOptions {
  /** Bảng thứ tự giả (thiếu khoá ⇒ trả undefined như registry thật). */
  orders?: Record<string, number>;
  /** Lỗi cài sẵn. */
  failure?: Failure;
}

/** Trạng thái ghi nhận của ctx giả. */
interface FakeState {
  /** Section đã đăng ký. */
  sections: Section[];
  /** Khoá đã hỏi getSectionOrder. */
  orderQueries: string[];
  /** Nhãn effect đã chạy. */
  effectLabels: string[];
  /** Số lần gọi suppressRuntimeContext. */
  suppressions: number;
  /** Nhãn effect đã dispose. */
  disposals: string[];
  /** Disposer đang chờ (effect + suppress của service giả). */
  disposers: (() => void)[];
  /** Số lần cleanup section được gọi. */
  sectionCleanups: number;
  /** Số lần cleanup suppressor được gọi. */
  suppressCleanups: number;
  /** Số lần section() được gọi (kể cả lần ném). */
  sectionCalls: number;
  /** Lỗi cài sẵn, nếu có. */
  failure: Failure | null;
}

/** Fixture = ctx giả + trạng thái ghi nhận. */
interface Fixture {
  /** Ctx truyền vào apply. */
  ctx: FakeContext;
  /** Trạng thái để chụp lát cắt. */
  state: FakeState;
}

/** Mốc cắt trạng thái trước một lần apply. */
interface Mark {
  /** Chiều dài sections. */
  sections: number;
  /** Chiều dài orderQueries. */
  orderQueries: number;
  /** Chiều dài effectLabels. */
  effectLabels: number;
  /** Số lần suppress. */
  suppressions: number;
  /** Chiều dài disposals. */
  disposals: number;
  /** Số cleanup section. */
  sectionCleanups: number;
  /** Số cleanup suppressor. */
  suppressCleanups: number;
}

/** Ảnh chụp lỗi để so hai bên mà không làm đỏ test giữa đường. */
interface ErrorSnapshot {
  /** Tên lớp lỗi. */
  name: string;
  /** Thông điệp. */
  message: string;
  /** Mã lỗi (nếu có). */
  code: string | null;
  /** Nguyên nhân (nếu có). */
  cause: string | null;
}

/** Ảnh chụp MỘT lần apply trên ctx giả. */
interface Snapshot {
  /** Section đăng ký trong lần này. */
  sections: Section[];
  /** Khoá order đã hỏi trong lần này. */
  orderQueries: string[];
  /** Nhãn effect trong lần này. */
  effectLabels: string[];
  /** Số lần suppress trong lần này. */
  suppressions: number;
  /** Nhãn effect đã dispose trong lần này. */
  disposals: string[];
  /** Số cleanup section trong lần này. */
  sectionCleanups: number;
  /** Số cleanup suppressor trong lần này. */
  suppressCleanups: number;
  /** Lỗi apply ném ra, hoặc null. */
  error: ErrorSnapshot | null;
}

/** Module của ta đã build (điền trong beforeAll). */
let oursMod: PersonaModule;
/** Module gốc nạp từ kernel (điền trong beforeAll). */
let stockMod: PersonaModule;
/** Thư mục tạm chứa artifact + symlink peer. */
let tempDir: string | undefined;

/** Artifact mà build.ts của package trả về (object có khoá service). */
interface BuildArtifact {
  /** Đường dẫn tuyệt đối của lib/index.js đã build. */
  service: string;
}

/** Bề mặt build script tối thiểu mà test cần. */
interface BuildModule {
  /** Build package vào outDir; trả artifact (chuỗi, mảng, hoặc object { service }). */
  buildPackage(outDir?: string): Promise<string | string[] | BuildArtifact>;
}

/**
 * Chuẩn hoá kết quả buildPackage về MỘT đường dẫn artifact.
 * Nhận: kết quả buildPackage.
 * Trả: đường dẫn tuyệt đối của entry đã build.
 */
function artifactPath(built: string | string[] | BuildArtifact): string {
  if (typeof built === "string") return built;
  if (Array.isArray(built)) {
    const first = built[0];
    if (first === undefined) throw new Error("build.ts không trả về artifact nào");
    return first;
  }
  return built.service;
}

beforeAll(async (): Promise<void> => {
  const build = (await import(BUILD)) as BuildModule;
  tempDir = await mkdtemp(join(tmpdir(), "gbh-persona-"));
  await writeFile(join(tempDir, "package.json"), JSON.stringify({ type: "module" }), "utf8");
  await symlink(PEERS, join(tempDir, "node_modules"), "dir");
  const built = await build.buildPackage(join(tempDir, "lib"));
  const artifact = artifactPath(built);
  if (!artifact.startsWith(tempDir)) throw new Error("build.ts ghi ra ngoài thư mục tạm: " + artifact);
  oursMod = (await import(artifact)) as PersonaModule;
  stockMod = (await import(STOCK)) as PersonaModule;
});

afterAll(async (): Promise<void> => {
  if (tempDir !== undefined) await rm(tempDir, { recursive: true, force: true });
});

/**
 * Dựng ctx giả ghi lại mọi lượt gọi của apply.
 * Nhận: bảng order giả và lỗi cài sẵn (tuỳ chọn).
 * Trả: fixture gồm ctx + trạng thái.
 */
function createFixture(options: FixtureOptions = {}): Fixture {
  const orders: Record<string, number> = options.orders ?? { ...ORDERS };
  const state: FakeState = {
    sections: [],
    orderQueries: [],
    effectLabels: [],
    suppressions: 0,
    disposals: [],
    disposers: [],
    sectionCleanups: 0,
    suppressCleanups: 0,
    sectionCalls: 0,
    failure: options.failure ?? null,
  };
  const ctx: FakeContext = {
    effect(factory, label) {
      const tag = label ?? "(khong-nhan)";
      state.effectLabels.push(tag);
      const cleanup = factory();
      let disposed = false;
      const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        state.disposals.push(tag);
        if (typeof cleanup === "function") cleanup();
      };
      state.disposers.push(dispose);
      return dispose;
    },
    systemPrompt: {
      section(section) {
        state.sectionCalls += 1;
        const failure = state.failure;
        const at = section.name === SUFFIX_SECTION ? "suffix" : "prefix";
        if (failure !== null && failure.at === at) throw failure.error;
        if (!Number.isFinite(section.order)) throw new TypeError('prompt section "' + section.name + '" order must be a finite number');
        state.sections.push(structuredClone(section));
        return (): void => {
          state.sectionCleanups += 1;
        };
      },
      getSectionOrder(name) {
        state.orderQueries.push(name);
        return orders[name];
      },
      suppressRuntimeContext() {
        state.suppressions += 1;
        const dispose = (): void => {
          state.suppressCleanups += 1;
        };
        state.disposers.push(dispose);
        return dispose;
      },
    },
  };
  return { ctx, state };
}

/**
 * Ghi mốc cắt trạng thái trước một lần apply.
 * Nhận: trạng thái ctx giả.
 * Trả: mốc.
 */
function mark(state: FakeState): Mark {
  return {
    sections: state.sections.length,
    orderQueries: state.orderQueries.length,
    effectLabels: state.effectLabels.length,
    suppressions: state.suppressions,
    disposals: state.disposals.length,
    sectionCleanups: state.sectionCleanups,
    suppressCleanups: state.suppressCleanups,
  };
}

/**
 * Cắt lát trạng thái phát sinh từ một mốc.
 * Nhận: trạng thái ctx giả + mốc.
 * Trả: ảnh chụp chưa kèm lỗi.
 */
function since(state: FakeState, before: Mark): Omit<Snapshot, "error"> {
  return {
    sections: state.sections.slice(before.sections),
    orderQueries: state.orderQueries.slice(before.orderQueries),
    effectLabels: state.effectLabels.slice(before.effectLabels),
    suppressions: state.suppressions - before.suppressions,
    disposals: state.disposals.slice(before.disposals),
    sectionCleanups: state.sectionCleanups - before.sectionCleanups,
    suppressCleanups: state.suppressCleanups - before.suppressCleanups,
  };
}

/**
 * Chụp một lỗi thành JSON thuần (name/message/code/cause).
 * Nhận: giá trị bị ném.
 * Trả: ảnh chụp lỗi.
 */
function errorSnapshot(caught: unknown): ErrorSnapshot {
  if (!(caught instanceof Error)) return { name: typeof caught, message: String(caught), code: null, cause: null };
  const subject = caught as Error & { code?: unknown; cause?: unknown };
  const cause = subject.cause;
  return {
    name: subject.name,
    message: subject.message,
    code: subject.code === undefined ? null : String(subject.code),
    cause: cause === undefined ? null : cause instanceof Error ? cause.name + ": " + cause.message : String(cause),
  };
}

/**
 * Chạy apply của một bản trên fixture và chụp lát cắt của CHÍNH lần đó.
 * Nhận: module, fixture, config.
 * Trả: ảnh chụp kèm lỗi (nếu có).
 */
function runApply(module: PersonaModule, fixture: Fixture, config: ConfigInput): Snapshot {
  const before = mark(fixture.state);
  let error: ErrorSnapshot | null = null;
  try {
    module.apply(fixture.ctx, config);
  } catch (caught) {
    error = errorSnapshot(caught);
  }
  return { ...since(fixture.state, before), error };
}

/**
 * Dispose MỌI disposer đang chờ của fixture (effect của apply + suppressor của service).
 * Nhận: fixture.
 * Trả: không.
 */
function disposeAll(fixture: Fixture): void {
  const pending = fixture.state.disposers.splice(0);
  for (const dispose of pending) dispose();
}

/**
 * Chạy apply rồi dispose NGAY, để đo cả cleanup.
 * Nhận: module, fixture, config.
 * Trả: ảnh chụp sau dispose, kèm lỗi apply (nếu có).
 */
function runAndDispose(module: PersonaModule, fixture: Fixture, config: ConfigInput): Snapshot {
  const before = mark(fixture.state);
  let error: ErrorSnapshot | null = null;
  try {
    module.apply(fixture.ctx, config);
  } catch (caught) {
    error = errorSnapshot(caught);
  }
  disposeAll(fixture);
  return { ...since(fixture.state, before), error };
}

/**
 * Gọi Config của một bản và chụp lỗi validate (nếu có).
 * Nhận: module + input.
 * Trả: ảnh chụp lỗi, hoặc null khi hợp lệ.
 */
function configError(module: PersonaModule, input: ConfigInput): ErrorSnapshot | null {
  try {
    module.Config(input);
    return null;
  } catch (caught) {
    return errorSnapshot(caught);
  }
}

describe("persona — bề mặt export", () => {
  test("tập export · name · inject bằng bản gốc", () => {
    expect(Object.keys(oursMod).sort()).toEqual(Object.keys(stockMod).sort());
    expect(oursMod.name).toBe(stockMod.name);
    expect(oursMod.inject).toEqual(stockMod.inject);
    expect(oursMod.name).toBe("persona");
    expect(oursMod.inject).toEqual(["systemPrompt"]);
    expect(typeof oursMod.Config).toBe(typeof stockMod.Config);
    expect(typeof oursMod.apply).toBe(typeof stockMod.apply);
  });

  test("PERSONA_PREFIX_SECTION / PERSONA_SUFFIX_SECTION bằng hằng của registry gốc", async () => {
    const registry = (await import(STOCK_SYSTEM_PROMPT)) as {
      PERSONA_PREFIX_SECTION: string;
      PERSONA_SUFFIX_SECTION: string;
    };
    expect(oursMod.PERSONA_PREFIX_SECTION).toBe(stockMod.PERSONA_PREFIX_SECTION);
    expect(oursMod.PERSONA_SUFFIX_SECTION).toBe(stockMod.PERSONA_SUFFIX_SECTION);
    expect(oursMod.PERSONA_PREFIX_SECTION).toBe(registry.PERSONA_PREFIX_SECTION);
    expect(oursMod.PERSONA_SUFFIX_SECTION).toBe(registry.PERSONA_SUFFIX_SECTION);
    expect(oursMod.PERSONA_PREFIX_SECTION).toBe(PREFIX_SECTION);
    expect(oursMod.PERSONA_SUFFIX_SECTION).toBe(SUFFIX_SECTION);
  });
});

describe("persona — Config", () => {
  test("mặc định suffix '' · complete false · includeRuntimeContext true", () => {
    const input: ConfigInput = { prefix: "Bạn là trợ lý." };
    const ours = oursMod.Config(input);
    const stock = stockMod.Config(input);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({ prefix: "Bạn là trợ lý.", suffix: "", complete: false, includeRuntimeContext: true });
  });

  test("giá trị tường minh đi qua nguyên vẹn", () => {
    const input: ConfigInput = { prefix: "P", suffix: "S", complete: true, includeRuntimeContext: false };
    const ours = oursMod.Config(input);
    const stock = stockMod.Config(input);
    expect(ours).toEqual(stock);
    expect(ours).toEqual({ prefix: "P", suffix: "S", complete: true, includeRuntimeContext: false });
  });

  test("String(Config) khớp bản gốc", () => {
    expect(String(oursMod.Config)).toBe(String(stockMod.Config));
    expect(String(oursMod.Config)).toBe(
      "{ prefix: string, suffix?: string, complete?: boolean, includeRuntimeContext?: boolean }",
    );
  });

  test("thiếu prefix ném ValidationError y hệt bản gốc", () => {
    const input: ConfigInput = {};
    const ours = configError(oursMod, input);
    const stock = configError(stockMod, input);
    expect(ours).toEqual(stock);
    expect(ours?.name).toBe("ValidationError");
    expect(ours?.message).toBe("$.prefix missing required value");
    expect(ours?.code).toBeNull();
  });

  test("sai kiểu ở cả bốn khoá ném cùng thông điệp", () => {
    const matrix: ConfigInput[] = [
      { prefix: 1 },
      { prefix: "p", suffix: 2 },
      { prefix: "p", complete: "yes" },
      { prefix: "p", includeRuntimeContext: "no" },
      { prefix: null },
    ];
    for (const input of matrix) {
      const ours = configError(oursMod, input);
      const stock = configError(stockMod, input);
      expect(ours).toEqual(stock);
      expect(ours?.name).toBe("ValidationError");
      expect(ours?.message?.startsWith("$.")).toBe(true);
    }
  });
});

describe("persona — apply trên ctx giả", () => {
  test("mặc định: hai section đúng tên/order/text, không complete, không suppress", () => {
    const fixture = createFixture();
    const config: ConfigInput = { prefix: "P" };
    const ours = runApply(oursMod, fixture, config);
    const stock = runApply(stockMod, fixture, config);
    expect(ours).toEqual(stock);
    expect(ours.sections).toEqual([
      { name: PREFIX_SECTION, order: 13, text: "P" },
      { name: SUFFIX_SECTION, order: 37, text: "" },
    ]);
    expect(ours.orderQueries).toEqual(["DEPLOYMENT_PERSONA_PREFIX", "DEPLOYMENT_PERSONA_SUFFIX"]);
    expect(ours.effectLabels).toEqual(["persona.section()", "persona.suffix()"]);
    expect(ours.suppressions).toBe(0);
    expect(ours.error).toBeNull();
  });

  test("complete true (kể cả truthy lạ) ⇒ CHỈ prefix mang complete", () => {
    for (const complete of [true, 1]) {
      const fixture = createFixture();
      const config: ConfigInput = { prefix: "P", suffix: "S", complete };
      const ours = runApply(oursMod, fixture, config);
      const stock = runApply(stockMod, fixture, config);
      expect(ours).toEqual(stock);
      expect(ours.sections.at(0)).toEqual({ name: PREFIX_SECTION, order: 13, text: "P", complete: true });
      expect(Object.hasOwn(ours.sections.at(1) ?? {}, "complete")).toBe(false);
    }
  });

  test("complete false (kể cả 0) ⇒ không section nào mang complete", () => {
    for (const complete of [false, 0]) {
      const fixture = createFixture();
      const config: ConfigInput = { prefix: "P", suffix: "S", complete };
      const ours = runApply(oursMod, fixture, config);
      const stock = runApply(stockMod, fixture, config);
      expect(ours).toEqual(stock);
      expect(ours.sections.every((section) => !Object.hasOwn(section, "complete"))).toBe(true);
    }
  });

  test("includeRuntimeContext false ⇒ gọi suppressRuntimeContext đúng một lần", () => {
    const fixture = createFixture();
    const config: ConfigInput = { prefix: "P", includeRuntimeContext: false };
    const ours = runAndDispose(oursMod, fixture, config);
    const stock = runAndDispose(stockMod, fixture, config);
    expect(ours).toEqual(stock);
    expect(ours.suppressions).toBe(1);
    expect(ours.suppressCleanups).toBe(1);
    expect(ours.effectLabels).toEqual(["persona.section()", "persona.suffix()"]);
  });

  test("suffix thiếu hoặc rỗng ⇒ text '' như bản gốc", () => {
    for (const suffix of [undefined, ""]) {
      const fixture = createFixture();
      const config: ConfigInput = { prefix: "P", suffix };
      const ours = runApply(oursMod, fixture, config);
      const stock = runApply(stockMod, fixture, config);
      expect(ours).toEqual(stock);
      expect(ours.sections.at(1)?.text).toBe("");
    }
  });

  test("dispose effect ⇒ gọi cleanup của section đúng một lần mỗi effect", () => {
    const fixture = createFixture();
    const config: ConfigInput = { prefix: "P", suffix: "S" };
    const ours = runAndDispose(oursMod, fixture, config);
    const stock = runAndDispose(stockMod, fixture, config);
    expect(ours).toEqual(stock);
    expect(ours.disposals).toEqual(["persona.section()", "persona.suffix()"]);
    expect(ours.sectionCleanups).toBe(2);
  });

  test("section đăng ký NÉM ⇒ apply ném y hệt và dừng đúng chỗ", () => {
    const prefixError = new Error('prompt section "deployment:persona-prefix" is already registered in this scope');
    const prefixFixture = createFixture({ failure: { at: "prefix", error: prefixError } });
    const config: ConfigInput = { prefix: "P", suffix: "S" };
    const oursPrefix = runApply(oursMod, prefixFixture, config);
    const stockPrefix = runApply(stockMod, prefixFixture, config);
    expect(oursPrefix).toEqual(stockPrefix);
    expect(oursPrefix.error).toEqual({
      name: "Error",
      message: prefixError.message,
      code: null,
      cause: null,
    });
    expect(oursPrefix.sections).toEqual([]);
    expect(oursPrefix.effectLabels).toEqual(["persona.section()"]);
    expect(oursPrefix.suppressions).toBe(0);

    const suffixFixture = createFixture({ failure: { at: "suffix", error: new Error("suffix boom") } });
    const oursSuffix = runApply(oursMod, suffixFixture, config);
    const stockSuffix = runApply(stockMod, suffixFixture, config);
    expect(oursSuffix).toEqual(stockSuffix);
    expect(oursSuffix.sections).toHaveLength(1);
    expect(oursSuffix.effectLabels).toEqual(["persona.section()", "persona.suffix()"]);
    expect(oursSuffix.error?.message).toBe("suffix boom");
  });

  test("order không hữu hạn (bảng thiếu khoá) ⇒ TypeError y hệt", () => {
    const cases: { orders: Record<string, number>; failing: string; count: number }[] = [
      { orders: {}, failing: PREFIX_SECTION, count: 0 },
      { orders: { DEPLOYMENT_PERSONA_PREFIX: 13 }, failing: SUFFIX_SECTION, count: 1 },
    ];
    for (const item of cases) {
      const fixture = createFixture({ orders: item.orders });
      const config: ConfigInput = { prefix: "P", suffix: "S" };
      const ours = runApply(oursMod, fixture, config);
      const stock = runApply(stockMod, fixture, config);
      expect(ours).toEqual(stock);
      expect(ours.error?.name).toBe("TypeError");
      expect(ours.error?.message).toBe('prompt section "' + item.failing + '" order must be a finite number');
      expect(ours.sections).toHaveLength(item.count);
    }
  });

  test("config ĐÔNG CỨNG vẫn chạy y nhau và không bị ghi", () => {
    const config = Object.freeze({ prefix: "P", suffix: "S", complete: false, includeRuntimeContext: true });
    const expected = { ...config };
    const fixture = createFixture();
    const ours = runApply(oursMod, fixture, config);
    const stock = runApply(stockMod, fixture, config);
    expect(ours).toEqual(stock);
    expect(ours.error).toBeNull();
    expect(config).toEqual(expected);
  });

  test("nhật ký ĐẦY ĐỦ (prefix nhiều dòng + suffix + complete + suppress + dispose) bằng bản gốc", () => {
    const fixture = createFixture();
    const config: ConfigInput = {
      prefix: "Dòng 1\nDòng 2 {{ten_agent}}",
      suffix: "Kết thúc.",
      complete: true,
      includeRuntimeContext: false,
    };
    const ours = runAndDispose(oursMod, fixture, config);
    const stock = runAndDispose(stockMod, fixture, config);
    expect(ours).toEqual(stock);
    expect(ours.sections).toEqual([
      { name: PREFIX_SECTION, order: 13, text: "Dòng 1\nDòng 2 {{ten_agent}}", complete: true },
      { name: SUFFIX_SECTION, order: 37, text: "Kết thúc." },
    ]);
    expect(ours.orderQueries).toEqual(["DEPLOYMENT_PERSONA_PREFIX", "DEPLOYMENT_PERSONA_SUFFIX"]);
    expect(ours.effectLabels).toEqual(["persona.section()", "persona.suffix()"]);
    expect(ours.suppressions).toBe(1);
    expect(ours.disposals).toEqual(["persona.section()", "persona.suffix()"]);
    expect(ours.sectionCleanups).toBe(2);
    expect(ours.suppressCleanups).toBe(1);
  });
});