/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-typert-loader: mọi ca chạy CẢ HAI bản (ta và chính bundle gốc
 *      @deepseek-ai/dsh-typert-loader) trên cùng một giàn giả rồi so từng thông điệp lỗi · từng lần
 *      đăng ký · từng lần gỡ; cộng ca tập export đo trên ARTIFACT, ca C6 danh tính, và ca
 *      gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/typert-loader/build.ts";
import {
  Config as OurConfig,
  TYPERT_HOST_EXPORT,
  apply as ourApply,
  inject,
  name,
  validateTypertManifest,
} from "../../packages/host/typert-loader/src/index.ts";
import type { LoaderEntrySeam, TypertContribution, TypertLoaderContext } from "../../packages/host/typert-loader/src/types.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-typert-loader/lib/index.js";

/** Hình dạng bundle gốc mà test này chạm tới (nạp động để tsc không kéo kiểu của nó vào chương trình). */
interface StockModule {
  /** Tên plugin. */
  name: string;
  /** Service bắt buộc. */
  inject: string[];
  /** Schema cấu hình. */
  Config: (input?: unknown) => { packages: string[] };
  /** Điểm vào plugin. */
  apply: (ctx: unknown, config: unknown) => Promise<void>;
  /** Ranh giới kiểm vật thể TYPERT. */
  validateTypertManifest: (pkgName: string, exported: unknown) => unknown;
  /** Khoá exports của tệp typert. */
  TYPERT_HOST_EXPORT: string;
}

const stock = (await import(STOCK)) as unknown as StockModule;

/** Một lần đăng ký đã ghi lại trên giàn. */
interface Registration {
  /** Đóng góp đã đăng ký. */
  contribution: TypertContribution;
  /** Cờ: hàm gỡ của sổ đăng ký đã được gọi. */
  disposed: boolean;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: bốn seam + đường phát `internal/plugin`. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: TypertLoaderContext;
  /** Entry của Loader, SỬA ĐƯỢC tại chỗ để mô phỏng mount/unmount. */
  entries: LoaderEntrySeam[];
  /** Mọi lần đăng ký, theo thứ tự. */
  registrations: Registration[];
  /** Mọi thông điệp lỗi đã rơi vào `logger.error`. */
  errors: string[];
  /** Phát `internal/plugin` cho một tên entry. */
  emit(entryName: string): void;
  /** Chạy hàm dọn vòng đời (plugin bị gỡ). */
  unload(): void;
}

/**
 * Dựng một giàn giả cho một neo cấu hình và một tập entry ban đầu.
 * @param baseUrl - neo cấu hình (file URL trong thư mục lab).
 * @param entries - entry của Loader; mảng này được giữ nguyên tham chiếu để test sửa tại chỗ.
 * @returns giàn với sổ đăng ký · log lỗi · đường phát sự kiện.
 */
function makeHarness(baseUrl: string, entries: LoaderEntrySeam[] = []): Harness {
  const registrations: Registration[] = [];
  const errors: string[] = [];
  const listeners: ((fiber: unknown) => void)[] = [];
  const teardown: (() => void)[] = [];
  const loader = { entries: () => entries };
  const typert = {
    register(contribution: TypertContribution): () => Promise<void> {
      const record: Registration = { contribution, disposed: false };
      registrations.push(record);
      return async () => {
        record.disposed = true;
      };
    },
  };
  const ctx: TypertLoaderContext = {
    baseUrl,
    loader,
    typert,
    logger: {
      error(error: unknown): void {
        errors.push(error instanceof Error ? error.message : String(error));
      },
    },
    get(serviceName: string): unknown {
      if (serviceName === "loader") return loader;
      if (serviceName === "typert") return typert;
      return undefined;
    },
    on(_event: "internal/plugin", listener: (fiber: unknown) => void): () => void {
      listeners.push(listener);
      return () => {};
    },
    effect(execute: () => Iterable<() => void>): unknown {
      for (const dispose of execute()) teardown.push(dispose);
      return () => {};
    },
  };
  return {
    ctx,
    entries,
    registrations,
    errors,
    emit(entryName: string): void {
      for (const listener of listeners) listener({ entry: { options: { name: entryName } } });
    },
    unload(): void {
      for (const dispose of teardown) dispose();
    },
  };
}

/**
 * Một entry của Loader với fiber sống (hoặc đã tắt) như kernel thật.
 * @param entryName - specifier của gói plugin.
 * @param live - có fiber đang chạy hay không.
 * @param disabled - cờ tắt của entry.
 * @returns entry đúng hình dạng seam.
 */
function entry(entryName: string, live = true, disabled = false): LoaderEntrySeam {
  return { options: { name: entryName }, fiber: live ? {} : undefined, disabled };
}

/** Thư mục lab: một cây `node_modules` giả để `createRequire` giải được gói thật trên đĩa. */
interface Lab {
  /** Thư mục gốc của lab. */
  dir: string;
  /** Neo cấu hình (file URL tới một tệp có thật trong lab). */
  baseUrl: string;
}

/**
 * Tạo một lab rỗng (kèm tệp neo để `createRequire` có gốc hợp lệ).
 * @returns lab với `dir` và `baseUrl`.
 */
function createLab(): Lab {
  const dir = mkdtempSync(join(tmpdir(), "gbh-typert-loader-"));
  const anchor = join(dir, "anchor.js");
  writeFileSync(anchor, "");
  return { dir, baseUrl: pathToFileURL(anchor).href };
}

/**
 * Cài một gói giả vào lab: manifest + `index.js` + (tuỳ chọn) `typert.js`.
 * @param lab - lab đích.
 * @param pkgName - tên package (có thể có scope).
 * @param options - nguồn `typert.js` và/hoặc khối `exports` ghi đè.
 * @returns đường dẫn thư mục gói vừa cài.
 */
function installPackage(lab: Lab, pkgName: string, options: { typert?: string; exports?: Record<string, unknown> } = {}): string {
  const dir = join(lab.dir, "node_modules", ...pkgName.split("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.js"), "export const apply = () => {};\n");
  if (options.typert !== undefined) writeFileSync(join(dir, "typert.js"), options.typert);
  const declared = options.exports ?? {
    ".": "./index.js",
    "./package.json": "./package.json",
    ...(options.typert === undefined ? {} : { "./typert": "./typert.js" }),
  };
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: pkgName, version: "0.0.0", type: "module", exports: declared }, null, 2));
  return dir;
}

/**
 * Sinh nguồn `typert.js` HỢP LỆ cho một gói, hoặc hỏng theo yêu cầu.
 * @param owner - tên package mà vật thể TYPERT phải khai.
 * @param body - phần thân thay thế (để dựng ca hỏng).
 * @returns nguồn ESM của tệp typert.
 */
function typertSource(owner: string, body?: string): string {
  if (body !== undefined) return body;
  return [
    "const schema = { name: \"SessionHeader\", create: () => ({}) };",
    "export const TYPERT = {",
    `  package: ${JSON.stringify(owner)},`,
    "  face: \"host\",",
    "  schemas: [schema],",
    "  model: { services: [], events: [], objects: [] },",
    "  invocations: [],",
    "};",
  ].join("\n");
}

/**
 * Chờ hai lượt macrotask để mọi vi mô (flush + import động) kịp lắng.
 * @returns promise hoàn tất sau hai lượt hẹn giờ 0 ms.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Chờ TỚI KHI một điều kiện thành đúng (hoặc hết hạn) — thay cho số lượt cố định.
 *
 * Vì sao cần: một lượt import động cần I/O; trên máy đang chạy cả bộ test, hai lượt
 * `setTimeout(0)` có thể KHÔNG đủ ⇒ test đỏ OAN dù hành vi đúng. Poll có trần thời gian thì
 * test vẫn TẤT ĐỊNH: đỏ chỉ khi hành vi thật sự sai.
 * @param predicate - điều kiện cần chờ.
 * @param timeoutMs - trần chờ (mặc định 15000 ms — máy chạy song song nhiều giàn test làm I/O chậm).
 * @returns promise hoàn tất khi điều kiện đúng hoặc khi hết hạn.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 15_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Chạy một phép gọi và trả thông điệp lỗi (hoặc null khi không ném).
 * @param run - phép gọi cần chạy.
 * @returns thông điệp lỗi, hoặc `null`.
 */
function errorOf(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Chạy một `apply` và trả thông điệp lỗi (hoặc null khi không ném).
 * @param run - `apply` cần chạy.
 * @returns thông điệp lỗi, hoặc `null`.
 */
async function applyErrorOf(run: () => Promise<void>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Trích TẬP TÊN mà một artefact ESM xuất, đọc trên VĂN BẢN artefact (không import lại).
 * @param text - nội dung tệp đã build.
 * @returns tên các export, đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const chunk of text.match(/export\s*\{([^}]*)\}/g) ?? []) {
    const body = chunk.slice(chunk.indexOf("{") + 1, chunk.lastIndexOf("}"));
    for (const part of body.split(",")) {
      const alias = part.trim().split(/\s+as\s+/);
      const found = (alias[alias.length - 1] ?? "").trim();
      if (found.length > 0) names.add(found);
    }
  }
  return [...names].sort();
}

// ---------------------------------------------------------------------------------------------------------

describe("A. ARTIFACT: tập export = bản gốc, và tên/hằng số/inject trùng", () => {
  test("sáu tên xuất, TRÙNG tập với bundle gốc; 0 dấu vết id @deepseek-ai", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "gbh-typert-loader-artifact-"));
    const built = await buildPackage(outDir);
    const text = readFileSync(built, "utf8");
    expect(exportNames(text)).toEqual(Object.keys(stock as unknown as Record<string, unknown>).sort());
    expect(exportNames(text)).toEqual(["Config", "TYPERT_HOST_EXPORT", "apply", "inject", "name", "validateTypertManifest"]);
    expect(text.match(/id: "@deepseek-ai/g) ?? []).toHaveLength(0);
    expect(name).toBe(stock.name);
    expect(inject).toEqual(stock.inject);
    expect(TYPERT_HOST_EXPORT).toBe(stock.TYPERT_HOST_EXPORT);
  });
});

describe("B. validateTypertManifest: đối chứng TRỰC TIẾP với bản gốc", () => {
  const OWNER = "@lab/owner";

  /** Codec hợp lệ tối thiểu (mode strict + typeSymbol + nhà máy create). */
  function strictCodec(): Record<string, unknown> {
    return { mode: "strict", typeSymbol: "SessionHeader", create: () => ({}) };
  }

  /** Một định nghĩa lời gọi Remote hợp lệ, thêm được trường theo ca. */
  function invocation(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { id: "i", service: "s", namespace: "n", method: "m", invocation: { kind: "direct" }, parameters: [], result: strictCodec(), ...extra };
  }

  /** Vật thể TYPERT hợp lệ của một gói. */
  function manifest(owner: string): Record<string, unknown> {
    return {
      package: owner,
      face: "host",
      schemas: [{ name: "SessionHeader", create: () => ({}) }],
      model: { services: [], events: [], objects: [] },
      invocations: [],
    };
  }

  /** Bản sao của vật thể hợp lệ, đã áp một phép sửa. */
  function mutated(change: (value: Record<string, unknown>) => void): Record<string, unknown> {
    const value = manifest(OWNER);
    change(value);
    return value;
  }

  /** Vật thể hợp lệ có mô hình đầy đủ (service · event · object · invocation). */
  function fullManifest(): Record<string, unknown> {
    return {
      package: OWNER,
      face: "host",
      schemas: [{ name: "SessionHeader", create: () => ({}) }],
      model: {
        services: [
          { key: "typert", exportName: "TypertRegistry", tags: [], members: [{ name: "register", signature: "(c) => void", kind: "method" }], types: [{ name: "T", declaration: "type T = 1" }] },
        ],
        events: [{ name: "loader/volatile-update", tags: [], signature: "(e) => void", mode: "emit" }],
        objects: [{ name: "symbols", exportName: "symbols", tags: [], members: [], types: [] }],
      },
      invocations: [invocation()],
    };
  }

  test("ca HỢP LỆ: cả hai trả CHÍNH vật thể đó (không sao chép)", () => {
    const value = fullManifest();
    expect(validateTypertManifest(OWNER, value)).toBe(value as unknown as TypertContribution);
    expect(stock.validateTypertManifest(OWNER, value)).toBe(value);
  });

  test("hai mươi vật thể HỎNG: thông điệp lỗi TRÙNG TỪNG KÝ TỰ với bản gốc", () => {
    const cases: { label: string; value: unknown }[] = [
      { label: "không phải object", value: null },
      { label: "sai chủ sở hữu", value: mutated((m) => { m.package = "@lab/other"; }) },
      { label: "sai mặt", value: mutated((m) => { m.face = "client"; }) },
      { label: "schemas không phải mảng", value: mutated((m) => { m.schemas = {}; }) },
      { label: "schema không phải object", value: mutated((m) => { m.schemas = [null]; }) },
      { label: "schema thiếu tên", value: mutated((m) => { m.schemas = [{ create: () => ({}) }]; }) },
      { label: "schema thiếu create", value: mutated((m) => { m.schemas = [{ name: "X" }]; }) },
      { label: "model không phải object", value: mutated((m) => { m.model = null; }) },
      { label: "services không phải mảng", value: mutated((m) => { m.model = { services: {}, events: [], objects: [] }; }) },
      { label: "service thiếu tags", value: mutated((m) => { m.model = { services: [{ key: "typert", exportName: "T" }], events: [], objects: [] }; }) },
      { label: "member thiếu chữ ký", value: mutated((m) => { m.model = { services: [{ key: "typert", exportName: "T", tags: [], members: [{ name: "m", kind: "method" }], types: [] }], events: [], objects: [] }; }) },
      { label: "member kind sai", value: mutated((m) => { m.model = { services: [{ key: "typert", exportName: "T", tags: [], members: [{ name: "m", signature: "s", kind: "magic" }], types: [] }], events: [], objects: [] }; }) },
      { label: "event mode sai", value: mutated((m) => { m.model = { services: [], events: [{ name: "e", tags: [], signature: "s", mode: 1 }], objects: [] }; }) },
      { label: "object thiếu exportName", value: mutated((m) => { m.model = { services: [], events: [], objects: [{ name: "o", tags: [], members: [], types: [] }] }; }) },
      { label: "invocation thiếu receiver", value: mutated((m) => { m.invocations = [{ id: "i", service: "s", namespace: "n", method: "m" }]; }) },
      { label: "receiver kind sai", value: mutated((m) => { m.invocations = [invocation({ invocation: { kind: "bogus" } })]; }) },
      { label: "tham số source sai", value: mutated((m) => { m.invocations = [invocation({ parameters: [{ name: "p", wire: "w", source: "bogus", codec: strictCodec() }] })]; }) },
      { label: "codec không strict", value: mutated((m) => { m.invocations = [invocation({ result: { mode: "loose" } })]; }) },
      { label: "cancellation sai", value: mutated((m) => { m.invocations = [invocation({ cancellation: { parameter: "token" } })]; }) },
      { label: "sourceLocation dòng sai", value: mutated((m) => { m.invocations = [invocation({ sourceLocation: { file: "f", line: 0, column: 1 } })]; }) },
    ];
    const oursMessages = cases.map((item) => errorOf(() => validateTypertManifest(OWNER, item.value)));
    const stockMessages = cases.map((item) => errorOf(() => stock.validateTypertManifest(OWNER, item.value)));
    expect(oursMessages.filter((message) => message === null)).toEqual([]);
    expect(oursMessages).toEqual(stockMessages);
  });
});

describe("C. hành vi chính: mount ⇒ đăng ký, unmount ⇒ gỡ (đối chứng bản gốc)", () => {
  test("chỉ gói CÓ ./typert được đăng ký; gỡ khi entry xuống; sau unload thì im lặng", async () => {
    const lab = createLab();
    installPackage(lab, "@lab/typert-fixture", { typert: typertSource("@lab/typert-fixture") });
    installPackage(lab, "@lab/no-typert", {});
    installPackage(lab, "@lab/disabled", { typert: typertSource("@lab/disabled") });
    const entries = [entry("@lab/typert-fixture"), entry("@lab/no-typert"), entry("@lab/disabled", true, true)];

    const ours = makeHarness(lab.baseUrl, [...entries]);
    await ourApply(ours.ctx, OurConfig({}));
    const theirs = makeHarness(lab.baseUrl, [...entries]);
    await stock.apply(theirs.ctx, stock.Config({}));

    expect(ours.registrations).toHaveLength(1);
    expect(theirs.registrations).toHaveLength(1);
    expect(ours.registrations[0]?.contribution.package).toBe("@lab/typert-fixture");
    expect(theirs.registrations[0]?.contribution.package).toBe("@lab/typert-fixture");
    expect(ours.errors).toEqual([]);
    expect(theirs.errors).toEqual([]);

    ours.entries.length = 0;
    theirs.entries.length = 0;
    ours.emit("@lab/typert-fixture");
    theirs.emit("@lab/typert-fixture");
    await waitFor(() => ours.registrations[0]?.disposed === true && theirs.registrations[0]?.disposed === true);
    expect(ours.registrations[0]?.disposed).toBe(true);
    expect(theirs.registrations[0]?.disposed).toBe(true);

    ours.unload();
    theirs.unload();
    ours.emit("@lab/typert-fixture");
    theirs.emit("@lab/typert-fixture");
    await settle();
    expect(ours.registrations).toHaveLength(1);
    expect(theirs.registrations).toHaveLength(1);
    expect(ours.errors).toEqual([]);
    expect(theirs.errors).toEqual([]);
    // Trần RIÊNG 20s: ca này cài 3 gói + hai lượt apply; đo dưới tải song song có lượt vượt trần
    // 5s mặc định của bun (đỏ OAN vì CHẬM, không phải vì hành vi sai) — trần rộng KHÔNG nới phép kiểm.
  }, 20_000);
});

describe("D. đường lỗi lúc kích hoạt: AggregateError với thông điệp y bản gốc", () => {
  test("bốn ca gói tường minh hỏng ⇒ cùng thông điệp, cùng kiểu lỗi, không treo", async () => {
    const lab = createLab();
    installPackage(lab, "@lab/no-typert", {});
    installPackage(lab, "@lab/broken-owner", { typert: typertSource("@lab/someone-else") });
    const cases: { label: string; packages: string[] }[] = [
      { label: "không giải được", packages: ["@lab/absent"] },
      { label: "không export ./typert", packages: ["@lab/no-typert"] },
      { label: "vật thể TYPERT sai chủ", packages: ["@lab/broken-owner"] },
      { label: "đường dẫn con (subpath)", packages: ["@lab/no-typert/sub"] },
    ];
    const oursMessages: (string | null)[] = [];
    const stockMessages: (string | null)[] = [];
    for (const item of cases) {
      const ours = makeHarness(lab.baseUrl, []);
      oursMessages.push(await applyErrorOf(() => ourApply(ours.ctx, OurConfig({ packages: item.packages }))));
      const theirs = makeHarness(lab.baseUrl, []);
      stockMessages.push(await applyErrorOf(() => stock.apply(theirs.ctx, stock.Config({ packages: item.packages }))));
    }
    expect(oursMessages.filter((message) => message === null)).toEqual([]);
    expect(oursMessages).toEqual(stockMessages);
  });

  test("thiếu baseUrl ⇒ ném ĐÚNG thông điệp của bản gốc", async () => {
    const ours = makeHarness(undefined as unknown as string, []);
    const theirs = makeHarness(undefined as unknown as string, []);
    const oursMessage = await applyErrorOf(() => ourApply(ours.ctx, OurConfig({})));
    const stockMessage = await applyErrorOf(() => stock.apply(theirs.ctx, stock.Config({})));
    expect(oursMessage).not.toBeNull();
    expect(oursMessage).toBe(stockMessage);
  });
});

describe("E. trạng thái ổn định: gói hỏng được GHI LOG, KHÔNG ném", () => {
  test("mount sau kích hoạt ⇒ logger.error đúng thông điệp bản gốc; sổ đăng ký không đổi", async () => {
    const lab = createLab();
    installPackage(lab, "@lab/ok", { typert: typertSource("@lab/ok") });
    installPackage(lab, "@lab/broken-owner", { typert: typertSource("@lab/someone-else") });

    const ours = makeHarness(lab.baseUrl, [entry("@lab/ok")]);
    await ourApply(ours.ctx, OurConfig({}));
    const theirs = makeHarness(lab.baseUrl, [entry("@lab/ok")]);
    await stock.apply(theirs.ctx, stock.Config({}));
    expect(ours.registrations).toHaveLength(1);
    expect(theirs.registrations).toHaveLength(1);

    ours.entries.push(entry("@lab/broken-owner"));
    theirs.entries.push(entry("@lab/broken-owner"));
    ours.emit("@lab/broken-owner");
    theirs.emit("@lab/broken-owner");
    await waitFor(() => ours.errors.length > 0 && theirs.errors.length > 0);

    expect(ours.registrations).toHaveLength(1);
    expect(theirs.registrations).toHaveLength(1);
    expect(ours.errors).toHaveLength(1);
    expect(ours.errors).toEqual(theirs.errors);
  });
});

describe("F. C6 DANH TÍNH + schema Config đối chứng bản gốc", () => {
  test("hai Config độc lập: sửa một KHÔNG lan sang cái kia", () => {
    const first = OurConfig({});
    const second = OurConfig({});
    const firstPackages = first.packages;
    const secondPackages = second.packages;
    expect(firstPackages).toBeInstanceOf(Array);
    expect(secondPackages).toBeInstanceOf(Array);
    if (firstPackages === undefined || secondPackages === undefined) throw new Error("Config phải điền mặc định packages");
    expect(firstPackages).not.toBe(secondPackages);
    firstPackages.push("@lab/x");
    expect(secondPackages).toEqual([]);
    expect(OurConfig({}).packages).toEqual([]);
  });

  test("schema Config: cùng đầu vào ⇒ cùng kết quả như bản gốc; đầu vào sai ⇒ cả hai cùng ném", () => {
    expect(OurConfig({})).toEqual(stock.Config({}));
    expect(OurConfig({ packages: ["@lab/a"] })).toEqual(stock.Config({ packages: ["@lab/a"] }));
    expect(errorOf(() => OurConfig({ packages: [""] }))).not.toBeNull();
    expect(errorOf(() => stock.Config({ packages: [""] }))).not.toBeNull();
  });

  test("hai lần apply KHÔNG chia sẻ sổ đăng ký; gỡ ở giàn A không lan sang giàn B", async () => {
    const lab = createLab();
    installPackage(lab, "@lab/typert-fixture", { typert: typertSource("@lab/typert-fixture") });
    const first = makeHarness(lab.baseUrl, [entry("@lab/typert-fixture")]);
    const second = makeHarness(lab.baseUrl, [entry("@lab/typert-fixture")]);
    await ourApply(first.ctx, OurConfig({}));
    await ourApply(second.ctx, OurConfig({}));
    expect(first.registrations).toHaveLength(1);
    expect(second.registrations).toHaveLength(1);
    expect(first.registrations[0]).not.toBe(second.registrations[0]);
    first.entries.length = 0;
    first.emit("@lab/typert-fixture");
    await waitFor(() => first.registrations[0]?.disposed === true);
    expect(first.registrations[0]?.disposed).toBe(true);
    expect(second.registrations[0]?.disposed).toBe(false);
  });
});

describe("G. gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + ĐỐI CHỨNG ÂM", () => {
  const meta = JSON.parse(readFileSync(new URL("../../packages/host/typert-loader/package.json", import.meta.url), "utf8")) as {
    name: string;
    peerDependencies: Record<string, string>;
    dependencies?: Record<string, string>;
    gbh: { peers: string[]; row?: unknown; tests?: string[] };
  };

  /**
   * Phép kiểm quy ước: phần tử của `gbh.peers` phải nằm trong `peerDependencies` (so PHẦN TỬ, không so số lượng).
   * @param gbhPeers - danh sách peer mà gói khai.
   * @param peerDependencies - khoá của khối peerDependencies.
   * @returns các tên THIẾU (rỗng nghĩa là đạt).
   */
  function missingPeers(gbhPeers: string[], peerDependencies: Record<string, string>): string[] {
    const declared = new Set(Object.keys(peerDependencies));
    return gbhPeers.filter((peerName) => !declared.has(peerName));
  }

  test("gói ta: mọi peer trong gbh.peers đều có trong peerDependencies; KHÔNG khai dependencies", () => {
    expect(meta.gbh.peers.length).toBeGreaterThan(0);
    expect(missingPeers(meta.gbh.peers, meta.peerDependencies)).toEqual([]);
    expect(meta.dependencies).toBeUndefined();
  });

  test("ĐỐI CHỨNG ÂM: bỏ MỘT peer khỏi peerDependencies ⇒ phép kiểm BẮT đúng tên đó", () => {
    const mutated: Record<string, string> = { ...meta.peerDependencies };
    const victim = meta.gbh.peers[0] as string;
    delete mutated[victim];
    expect(missingPeers(meta.gbh.peers, mutated)).toEqual([victim]);
  });

  });
