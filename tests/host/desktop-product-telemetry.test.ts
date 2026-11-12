/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test doi chung cho @galaxy-blackhole/gbh-desktop-product-telemetry — do tren ARTIFACT, so voi
 *      chinh bundle goc cua DSH (schema Config · tuy chon kenh · vong doi shutdown · tap export), CONG
 *      bo ca MIRROR dieu kien tat cua oracle qua gbh.row.insertDisabled (khoi patch + ngu nghia profile).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/desktop-product-telemetry/build.ts";
import { parseGbhMetadata, renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata.ts";
import type { GbhRowMetadata } from "../../apps/cli/src/rewrite-metadata.ts";

/** Thu muc goc repo (tu vi tri file test). */
const REPO = join(import.meta.dir, "..", "..");
/** Thu muc package cua ta trong repo. */
const OURS_PKG = join(REPO, "packages", "host", "desktop-product-telemetry");
/** Thu muc goi GOC trong kernel (chi doc). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-product-telemetry-otel");
/** Bundle GOC (chi doc). */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** Ten package cua ta (PHAI khop thu muc trong node_modules — bai hoc 17/10/2026). */
const PKG = "@galaxy-blackhole/gbh-desktop-product-telemetry";
/** Goc gia lap mot profile: goc/node_modules/ten-package/lib/index.js. */
const ROOT = join("/tmp", "gbh-desktop-product-telemetry-test");
/** Thu muc node_modules cua profile gia lap. */
const MODULES = join(ROOT, "node_modules");
/** Thu muc package trong profile gia lap. */
const MOUNTED = join(MODULES, PKG);
/** Duong dan artifact cua ta sau khi build (trong profile gia lap). */
const ARTIFACT = join(MOUNTED, "lib", "index.js");
/** Cac peer phai duoc tro ve KERNEL (mount that lam viec nay bang gbh.peers). */
const PEERS: readonly string[] = ["@deepseek-ai/cordis", "@deepseek-ai/schemastery", "@opentelemetry/otlp-exporter-base"];

/** Cau hinh day du ma ca hai ban deu nhan (Loader da ap mac dinh truoc khi goi constructor). */
interface ConfigShape {
  /** URL log HTTP(S) day du. */
  endpoint: string;
  /** Header dinh tuyen cua collector. */
  channel: string;
  /** Resource service.name. */
  serviceName: string;
  /** Resource service.version. */
  serviceVersion: string;
  /** Nen gzip/none; bo qua thi theo moi truong SDK. */
  compression?: "none" | "gzip";
  /** So ban ghi toi da moi lan export. */
  maxExportBatchSize: number;
  /** So ban ghi toi da trong hang doi. */
  maxQueueSize: number;
  /** Tre truoc khi export lo chua day. */
  scheduledDelayMillis: number;
  /** Han HTTP cua exporter. */
  exportTimeoutMillis: number;
  /** Han cua mot lan export lo. */
  timeoutMillis: number;
  /** Han rut sach khi unload. */
  shutdownTimeoutMillis: number;
}

/** Tuy chon ma ban goc va ban viet lai deu chuyen cho `ctx.otel.createEventReporter`. */
interface ChannelOptions {
  /** Diem den + thiet lap HTTP. */
  exporter: { url: string; headers: Record<string, string>; timeoutMillis: number; compression?: "none" | "gzip" };
  /** Danh tinh ung dung tren resource. */
  resourceAttributes: Record<string, string>;
  /** Pham vi bao su kien. */
  scope: { name: string };
  /** Tham so gom lo cua SDK. */
  processor: Record<string, number>;
  /** Bao loi mang/SDK. */
  onFailure: (message: string, error?: Error) => void;
}

/** Mot lan dang ky dich vu ma context gia ghi lai. */
interface Registration {
  /** Ten dich vu. */
  name: string;
  /** The hien duoc dang ky. */
  value: unknown;
}

/** Nhat ky cua context gia (dung chung cho CA HAI ban — do la cach so sanh cong bang). */
interface FakeLog {
  /** Cac lan `reflect.provide`. */
  provided: Registration[];
  /** Tuy chon cua tung kenh duoc mo. */
  options: ChannelOptions[];
  /** Cac lan `logger.warn`. */
  warns: unknown[][];
  /** Cac ham don dep do `ctx.effect` nhan. */
  disposers: (() => Promise<void>)[];
  /** Ban ghi da duoc day vao kenh. */
  emitted: unknown[];
  /** Hieu huy ma kenh nhan duoc khi shutdown. */
  signals: (AbortSignal | undefined)[];
}

/**
 * Dung context toi thieu nhung DUNG hinh dang ma `Service` cordis va plugin nay cham:
 * `reflect.provide` (constructor cua Service) · `otel` (seam) · `logger` · `effect`.
 * @param shutdown - hanh vi shutdown cua kenh gia (mac dinh: hoan tat ngay).
 * @returns context gia va nhat ky de khang dinh.
 */
function fakeContext(shutdown?: (signal?: AbortSignal) => Promise<void>): { ctx: unknown; log: FakeLog } {
  const log: FakeLog = { provided: [], options: [], warns: [], disposers: [], emitted: [], signals: [] };
  const ctx = {
    reflect: {
      provide: (name: string, value: unknown): void => {
        log.provided.push({ name, value });
      },
    },
    otel: {
      createEventReporter: (options: ChannelOptions): { emit: (record: unknown) => void; shutdown: (signal?: AbortSignal) => Promise<void> } => {
        log.options.push(options);
        return {
          emit: (record: unknown): void => {
            log.emitted.push(record);
          },
          shutdown: async (signal?: AbortSignal): Promise<void> => {
            log.signals.push(signal);
            await (shutdown?.(signal) ?? Promise.resolve());
          },
        };
      },
    },
    logger: {
      warn: (...args: unknown[]): void => {
        log.warns.push(args);
      },
    },
    effect: (factory: () => () => Promise<void>): void => {
      log.disposers.push(factory());
    },
  };
  return { ctx, log };
}

/** Hinh dang toi thieu cua mot artifact (ca hai ban deu cung hinh dang nay). */
interface Artifact {
  /** Lop plugin. */
  default: (new (ctx: unknown, config: ConfigShape) => { emit(record: unknown): void }) & { inject?: string[] };
  /** Schema Loader. */
  Config: (input: Record<string, unknown>) => Record<string, unknown>;
}

/** Ban goc va ban cua ta da nap (memo hoa: build mot lan cho ca file test). */
let loaded: Promise<{ ours: Artifact; stock: Artifact }> | undefined;

/**
 * Dung lai DUNG cach mount that lam: node_modules cua profile + symlink tung peer ve kernel, roi build.
 * @returns duong dan artifact cua ta sau khi build.
 */
async function buildMountedArtifact(): Promise<string> {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(MOUNTED, { recursive: true });
  for (const peer of PEERS) {
    const source = join(REPO, "apps", "host", "node_modules", peer);
    expect(existsSync(source)).toBe(true);
    const link = join(MODULES, peer);
    mkdirSync(join(link, ".."), { recursive: true });
    symlinkSync(source, link, "dir");
  }
  return buildPackage(join(MOUNTED, "lib"));
}

/**
 * Nap artifact cua ta va bundle goc (chi mot lan cho moi file test).
 * @returns hai artifact theo cung mot kieu de so sanh truc tiep.
 */
function artifacts(): Promise<{ ours: Artifact; stock: Artifact }> {
  loaded ??= (async () => {
    const artifact = await buildMountedArtifact();
    return { ours: (await import(artifact)) as Artifact, stock: (await import(STOCK)) as Artifact };
  })();
  return loaded;
}

/**
 * Bo ham ra khoi tuy chon kenh de so sanh duoc bang `toEqual` (ham so sanh theo THAM CHIEU, luon khac).
 * @param options - tuy chon kenh ma mot ban da chuyen cho `otel`.
 * @returns vat the thuan du lieu, GIU nguyen su HIEN DIEN cua khoa `compression`.
 */
function plainOptions(options: ChannelOptions): unknown {
  return {
    exporter: { ...options.exporter },
    resourceAttributes: { ...options.resourceAttributes },
    scope: { ...options.scope },
    processor: { ...options.processor },
    onFailure: typeof options.onFailure,
  };
}

/** Cau hinh mau: Loader da ap mac dinh, nen day la vat the ma constructor thuc su nhan. */
function sampleConfig(overrides: Partial<ConfigShape> = {}): ConfigShape {
  return {
    endpoint: "https://example.test/v1/logs",
    channel: "dsh_otel_report",
    serviceName: "deepseek-harness-desktop",
    serviceVersion: "0.2.1-alpha.4",
    maxExportBatchSize: 512,
    maxQueueSize: 2048,
    scheduledDelayMillis: 30_000,
    timeoutMillis: 15_000,
    exportTimeoutMillis: 20_000,
    shutdownTimeoutMillis: 2_000,
    ...overrides,
  };
}

/**
 * Goi mot ham va tra ve thong diep loi thay vi nem (de so hai ban).
 * @param run - ham can goi.
 * @returns thong diep loi, hoac chuoi "khong loi".
 */
function messageOf(run: () => unknown): string {
  try {
    run();
    return "khong loi";
  } catch (error) {
    return String((error as { message?: unknown }).message ?? error);
  }
}

/** Khoi `gbh.row` ma test doc (chi cac truong test dung toi). */
interface RowShape {
  /** Id row stock bi tat. */
  id?: string;
  /** Gia tri `disabled` cua row STOCK (bo trong = true). */
  disabled?: boolean | { js: string };
  /** Gia tri `disabled` cua row DUOC CHEN (bo trong = row chen BAT). */
  insertDisabled?: boolean | { js: string };
  /** Cau hinh cua row duoc chen. */
  config?: Record<string, unknown>;
  /** Tep test chung minh hanh vi. */
  tests?: string[];
}

/** Manifest cua goi ta — du truong de kiem metadata bang MAY, khong bang tri nho. */
interface Manifest {
  /** Ten package. */
  name?: string;
  /** Khoi metadata cua repo. */
  gbh?: { peers?: string[]; row?: RowShape; row_unmounted_ly_do?: { row?: RowShape } };
  /** Hop dong voi trinh quan ly goi. */
  peerDependencies?: Record<string, string>;
}

/**
 * Doc manifest cua goi ta.
 * @returns manifest da parse.
 */
function ourManifest(): Manifest {
  return JSON.parse(readFileSync(join(OURS_PKG, "package.json"), "utf8")) as Manifest;
}

/**
 * Peer duoc khai de inject ma KHONG duoc khai trong `peerDependencies` (so PHAN TU, khong so luong).
 * @param peers - danh sach `gbh.peers`.
 * @param peerDependencies - khoi `peerDependencies` cua manifest.
 * @returns ten cac peer thieu, da sap xep.
 */
function peerGaps(peers: readonly string[], peerDependencies: Record<string, string>): string[] {
  const declared = new Set(Object.keys(peerDependencies));
  return peers.filter((peer) => !declared.has(peer)).sort();
}

describe("artifact @galaxy-blackhole/gbh-desktop-product-telemetry", () => {
  test("tap export ta = tap export goc (do tren ARTIFACT), va build.ts nhan argv[2]", async () => {
    const { ours, stock } = await artifacts();
    expect(Object.keys(stock).sort()).toEqual(["Config", "default"]);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    // Cung bo static + cung bo method nguyen mau (khong tu dat them be mat).
    expect(Object.getOwnPropertyNames(ours.default)).toEqual(Object.getOwnPropertyNames(stock.default));
    expect(ours.default.inject).toEqual(["otel"]);
    expect(stock.default.inject).toEqual(["otel"]);
    expect(Object.getOwnPropertyNames(ours.default.prototype)).toEqual(Object.getOwnPropertyNames(stock.default.prototype));
    // Review checklist A: build.ts phai nhan outDir qua argv[2], khong thi profile thieu lib/ => khong sinh entry.
    expect(readFileSync(join(OURS_PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("schema Config: cung mac dinh, cung loi khi thieu truong bat buoc", async () => {
    const { ours, stock } = await artifacts();
    const input = { serviceName: "deepseek-harness-desktop", serviceVersion: "0.2.1-alpha.4" };
    expect(ours.Config(input)).toEqual(stock.Config(input));
    expect(ours.Config(input)).toMatchObject({
      endpoint: "https://dsh-otel-collector.deepseeksvc.com/v1/logs",
      channel: "dsh_otel_report",
      maxExportBatchSize: 512,
      maxQueueSize: 2048,
      scheduledDelayMillis: 30_000,
      timeoutMillis: 15_000,
      exportTimeoutMillis: 20_000,
      shutdownTimeoutMillis: 21_000,
    });
    expect(messageOf(() => ours.Config({}))).toBe(messageOf(() => stock.Config({})));
    expect(messageOf(() => ours.Config({ serviceName: "a" }))).toBe(messageOf(() => stock.Config({ serviceName: "a" })));
  });

  test("constructor: dang ky dung ten `productTelemetry` va chuyen tuy chon kenh Y HET ban goc", async () => {
    const { ours, stock } = await artifacts();
    const ourSide = fakeContext();
    const stockSide = fakeContext();
    const ourService = new ours.default(ourSide.ctx, sampleConfig());
    const stockService = new stock.default(stockSide.ctx, sampleConfig());
    expect(ourSide.log.provided.map((entry) => entry.name)).toEqual(["productTelemetry"]);
    expect(stockSide.log.provided.map((entry) => entry.name)).toEqual(["productTelemetry"]);
    // The hien duoc dang ky PHAI la chinh no (ten service quyet dinh row khac inject vao).
    expect(ourSide.log.provided[0]?.value).toBe(ourService);
    expect(stockSide.log.provided[0]?.value).toBe(stockService);
    expect(plainOptions(ourSide.log.options[0] as ChannelOptions)).toEqual(plainOptions(stockSide.log.options[0] as ChannelOptions));
    // `compression` KHONG duoc gui khi cau hinh bo trong (de SDK ton trong bien moi truong).
    expect("compression" in (ourSide.log.options[0] as ChannelOptions).exporter).toBe(false);
    expect("compression" in (stockSide.log.options[0] as ChannelOptions).exporter).toBe(false);
    // Khi co cau hinh: ca hai map sang CUNG gia tri enum cua SDK (0.222.0: GZIP = "gzip" · NONE = "none").
    const ourGzip = fakeContext();
    const stockGzip = fakeContext();
    new ours.default(ourGzip.ctx, sampleConfig({ compression: "gzip" }));
    new stock.default(stockGzip.ctx, sampleConfig({ compression: "gzip" }));
    expect((ourGzip.log.options[0] as ChannelOptions).exporter.compression).toBe("gzip");
    expect((ourGzip.log.options[0] as ChannelOptions).exporter.compression).toBe((stockGzip.log.options[0] as ChannelOptions).exporter.compression);
    const ourNone = fakeContext();
    const stockNone = fakeContext();
    new ours.default(ourNone.ctx, sampleConfig({ compression: "none" }));
    new stock.default(stockNone.ctx, sampleConfig({ compression: "none" }));
    expect((ourNone.log.options[0] as ChannelOptions).exporter.compression).toBe("none");
    expect((ourNone.log.options[0] as ChannelOptions).exporter.compression).toBe((stockNone.log.options[0] as ChannelOptions).exporter.compression);
  });

  test("emit: chuyen NGUYEN VAT ban ghi cho kenh (khong cho mang, khong tu them truong)", async () => {
    const { ours, stock } = await artifacts();
    const record = { eventName: "desktop_launch", body: "app started", timestamp: 1_700_000_000_000, attributes: { os: "darwin" } };
    const ourSide = fakeContext();
    const stockSide = fakeContext();
    const ourService = new ours.default(ourSide.ctx, sampleConfig());
    const stockService = new stock.default(stockSide.ctx, sampleConfig());
    ourService.emit(record);
    stockService.emit(record);
    expect(ourSide.log.emitted[0]).toBe(record);
    expect(stockSide.log.emitted[0]).toBe(record);
  });

  test("shutdown khi unload: huy hieu duoc truyen, het han thi canh bao DUNG cau cua ban goc", async () => {
    const { ours, stock } = await artifacts();
    // Ca thuong: kenh shutdown xong ngay => khong canh bao, hieu huy KHONG bi abort.
    const ourOk = fakeContext();
    const stockOk = fakeContext();
    new ours.default(ourOk.ctx, sampleConfig());
    new stock.default(stockOk.ctx, sampleConfig());
    await ourOk.log.disposers[0]?.();
    await stockOk.log.disposers[0]?.();
    expect(ourOk.log.signals[0]?.aborted).toBe(false);
    expect(ourOk.log.warns).toEqual(stockOk.log.warns);
    expect(ourOk.log.warns).toEqual([]);
    // Ca het han: kenh chi tra khi bi huy => canh bao mat su kien va abort voi DUNG ly do.
    const hang = (signal?: AbortSignal): Promise<void> =>
      new Promise<void>((resolve) => {
        if (signal === undefined) return;
        if (signal.aborted) {
          resolve();
          return;
        }
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
    const ourLate = fakeContext(hang);
    const stockLate = fakeContext(hang);
    new ours.default(ourLate.ctx, sampleConfig({ shutdownTimeoutMillis: 10 }));
    new stock.default(stockLate.ctx, sampleConfig({ shutdownTimeoutMillis: 10 }));
    await ourLate.log.disposers[0]?.();
    await stockLate.log.disposers[0]?.();
    expect(ourLate.log.warns).toHaveLength(1);
    expect(String(ourLate.log.warns[0]?.[0])).toBe("Product telemetry shutdown deadline exceeded; pending events may be lost");
    expect(ourLate.log.signals[0]?.aborted).toBe(true);
    expect(String(ourLate.log.signals[0]?.reason)).toBe("Error: Product telemetry shutdown deadline exceeded");
    expect(ourLate.log.warns).toEqual(stockLate.log.warns);
  });

  test("duong loi cau hinh: 4 thong diep TRUNG NGUYEN VAN ban goc, nem TRUOC khi mo kenh", async () => {
    const { ours, stock } = await artifacts();
    const cases: { label: string; config: ConfigShape }[] = [
      { label: "endpoint khong phai URL", config: sampleConfig({ endpoint: "khong-phai-url" }) },
      { label: "channel khong phai header value", config: sampleConfig({ channel: "bad\nvalue" }) },
      { label: "giao thuc khong phai HTTP(S)", config: sampleConfig({ endpoint: "ftp://example.test/v1/logs" }) },
      { label: "batch vuot queue", config: sampleConfig({ maxExportBatchSize: 2048, maxQueueSize: 512 }) },
    ];
    const expected = [
      "product-telemetry-otel: endpoint must be a valid HTTP(S) URL",
      "product-telemetry-otel: channel must be a valid HTTP header value",
      "product-telemetry-otel: endpoint must use HTTP or HTTPS",
      "product-telemetry-otel: maxExportBatchSize must not exceed maxQueueSize",
    ];
    for (const [index, entry] of cases.entries()) {
      const ourSide = fakeContext();
      const stockSide = fakeContext();
      const ourMessage = messageOf(() => new ours.default(ourSide.ctx, entry.config));
      const stockMessage = messageOf(() => new stock.default(stockSide.ctx, entry.config));
      expect(ourMessage).toBe(expected[index] as string);
      expect(ourMessage).toBe(stockMessage);
      // Nem TRUOC `super()` => khong mo kenh, khong dang ky dich vu, khong treo.
      expect(ourSide.log.options).toHaveLength(0);
      expect(ourSide.log.provided).toHaveLength(0);
      expect(stockSide.log.options).toHaveLength(0);
    }
  });

  test("C6: vat the cau hinh DOC LAP giua hai the hien — kiem bang DANH TINH, khong bang so sau", async () => {
    const { ours, stock } = await artifacts();
    for (const artifact of [ours, stock]) {
      const first = fakeContext();
      const second = fakeContext();
      new artifact.default(first.ctx, sampleConfig());
      new artifact.default(second.ctx, sampleConfig({ channel: "kenh_khac" }));
      const a = first.log.options[0] as ChannelOptions;
      const b = second.log.options[0] as ChannelOptions;
      expect(a).not.toBe(b);
      expect(a.exporter.headers).not.toBe(b.exporter.headers);
      expect(a.resourceAttributes).not.toBe(b.resourceAttributes);
      expect(a.processor).not.toBe(b.processor);
      a.exporter.headers["x-channel"] = "bi-sua";
      expect(b.exporter.headers["x-channel"]).toBe("kenh_khac");
      a.resourceAttributes["service.name"] = "bi-sua";
      expect(b.resourceAttributes["service.name"]).toBe("deepseek-harness-desktop");
    }
  });

  test("metadata: gbh.peers ⊆ peerDependencies (co DOI CHUNG AM), peer co trong kernel, locale byte-for-byte", () => {
    const manifest = ourManifest();
    const peers = manifest.gbh?.peers ?? [];
    const peerDependencies = manifest.peerDependencies ?? {};
    expect(peers.length).toBeGreaterThan(0);
    expect(peerGaps(peers, peerDependencies)).toEqual([]);
    // DOI CHUNG AM: phep kiem phai BAT DUOC mot peer khong duoc khai (neu khong, no la verdict rong).
    expect(peerGaps([...peers, "@deepseek-ai/khong-duoc-khai"], peerDependencies)).toEqual(["@deepseek-ai/khong-duoc-khai"]);
    // Moi peer phai co trong kernel, neu khong mount se bao "thieu peer trong kernel".
    for (const peer of peers) expect(existsSync(join(REPO, "apps", "host", "node_modules", peer))).toBe(true);
    // 000e: locale phai byte-for-byte voi ban goc (tieu de hang trong man Plugins).
    for (const locale of ["en.json", "zh.json"]) {
      expect(readFileSync(join(OURS_PKG, "locale", locale)).equals(readFileSync(join(STOCK_PKG, "locale", locale)))).toBe(true);
    }
  });
});

/** Bieu thuc tat CO DIEU KIEN cua row stock, doc NGUYEN VAN tu dump cua oracle. */
const STOCK_DISABLED_EXPRESSION = "ctx.get('profileContext')?.name !== 'desktop'";

/** Duong dan dump dung lam bang chung "dieu kien cua oracle" (chi doc). */
const DUMP = join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml");

/**
 * Doc khoi YAML cua mot row trong dump parity.
 * Nhan: id row can tim.
 * Tra: cac dong cua khoi do (tu "- id: <id>" toi dong "- id:" ke tiep).
 */
function dumpRowBlock(rowId: string): string {
  const lines = readFileSync(DUMP, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === "- id: " + rowId);
  if (start < 0) throw new Error("khong thay row " + rowId + " trong dump " + DUMP);
  let end = start + 1;
  while (end < lines.length && !lines[end]?.startsWith("- id:")) end += 1;
  return lines.slice(start, end).join("\n");
}

/**
 * Tinh gia tri bieu thuc `disabled` nhu Loader cua kernel tinh.
 * Nhan: bieu thuc JS va ten profile dang chay.
 * Tra: true khi row bi TAT tren profile do.
 */
function evaluateDisabled(expression: string, profileName: string): boolean {
  const fake = { get: (key: string) => (key === "profileContext" ? { name: profileName } : undefined) };
  return Boolean(new Function("ctx", "return (" + expression + ")")(fake));
}

describe("@galaxy-blackhole/gbh-desktop-product-telemetry — khai gbh.row MIRROR dieu kien tat cua oracle", () => {
  test("row khai DUNG id + `insertDisabled` + KHONG khai `disabled` (row stock luon bi tat)", () => {
    const manifest = ourManifest();
    const row = manifest.gbh?.row;
    expect(row).toBeDefined();
    expect(row?.id).toBe("desktop-product-telemetry");
    // Row stock LUON tat: bo trong `disabled` = true (mac dinh cua renderRewriteBlock).
    expect(row?.disabled).toBeUndefined();
    // Row CHEN giu DUNG dieu kien tat cua oracle (truong Lead moi them 18/10/2026).
    expect(row?.insertDisabled).toEqual({ js: STOCK_DISABLED_EXPRESSION });
    // tests phai tro tep CO THAT (dieu kien cua cong hygiene + G4).
    expect(row?.tests).toEqual(["tests/host/desktop-product-telemetry.test.ts"]);
    expect(existsSync(join(REPO, "tests", "host", "desktop-product-telemetry.test.ts"))).toBe(true);
  });

  test("dieu kien MIRROR la NGUYEN VAN cua oracle — doc tu dump, khong phai tu che", () => {
    const block = dumpRowBlock("desktop-product-telemetry");
    // Dump ghi: `disabled: !!js ctx.get('profileContext')?.name !== 'desktop'`
    const line = block.split("\n").find((entry) => entry.trim().startsWith("disabled:"));
    expect(line).toBeDefined();
    const expression = (line ?? "").replace(/^\s*disabled:\s*!!js\s*/u, "").trim();
    expect(expression).toBe(STOCK_DISABLED_EXPRESSION);
    expect((ourManifest().gbh?.row?.insertDisabled as { js: string }).js).toBe(expression);
  });

  test("ngu nghia MIRROR: tat tren profile `blackhole`, BAT tren profile `desktop` (ca hai ban cung cong thuc)", () => {
    const expression = STOCK_DISABLED_EXPRESSION;
    expect(evaluateDisabled(expression, "blackhole")).toBe(true);
    expect(evaluateDisabled(expression, "desktop")).toBe(false);
    // Tren profile khac (web/lab) cung TAT — dung nhu oracle: khong gui telemetry o do.
    for (const profile of ["web", "lab", "sdk"]) expect(evaluateDisabled(expression, profile)).toBe(true);
  });

  test("cau hinh cua row chen MIRROR dung sau gia tri cua row stock trong dump (de tren `desktop` hanh vi khong doi)", () => {
    const block = dumpRowBlock("desktop-product-telemetry");
    const config = ourManifest().gbh?.row?.config ?? {};
    // Bon tran so nguyen: nguyen van tu dump.
    expect(config["scheduledDelayMillis"]).toBe(30000);
    expect(config["timeoutMillis"]).toBe(15000);
    expect(config["exportTimeoutMillis"]).toBe(20000);
    expect(config["shutdownTimeoutMillis"]).toBe(2000);
    expect(block).toContain("scheduledDelayMillis: 30000");
    expect(block).toContain("timeoutMillis: 15000");
    expect(block).toContain("exportTimeoutMillis: 20000");
    expect(block).toContain("shutdownTimeoutMillis: 2000");
    // serviceName la literal; serviceVersion + endpoint la BIEU THUC `!!js` => khai bang { js }.
    expect(config["serviceName"]).toBe("deepseek-harness-desktop");
    expect(block).toContain("serviceName: deepseek-harness-desktop");
    expect(config["serviceVersion"]).toEqual({ js: "process.env.DSH_CLIENT_VERSION" });
    expect(block).toContain("serviceVersion: !!js process.env.DSH_CLIENT_VERSION");
    expect(config["endpoint"]).toEqual({ js: "process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL" });
    expect(block).toContain("endpoint: !!js process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL");
  });

  test("KHỐI PATCH sinh ra đúng hình dạng: stock tat + row chen co `disabled: !!js …` (đo bằng chính CLI)", () => {
    const metadata = parseGbhMetadata(readFileSync(join(OURS_PKG, "package.json"), "utf8"));
    expect(metadata?.row).toBeDefined();
    const block = renderRewriteBlock(PKG, metadata?.row as GbhRowMetadata);
    const lines = block.trimEnd().split("\n");
    expect(lines[0]).toBe("- id: desktop-product-telemetry");
    expect(lines[1]).toBe("  disabled: true");
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("- insert:");
    expect(lines[4]).toBe("    - id: desktop-product-telemetry-ours");
    expect(lines[5]).toBe("      name: '" + PKG + "'");
    // DONG QUAN TRONG NHAT: neu thieu dong nay thi row chen BAT o moi profile (dung lop loi da cam khai).
    expect(lines[6]).toBe("      disabled: !!js " + STOCK_DISABLED_EXPRESSION);
    expect(block).toContain("      config:");
    expect(block).toContain("        serviceVersion: !!js process.env.DSH_CLIENT_VERSION");
    expect(block).toContain("        endpoint: !!js process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL");
  });

  test("test canh NGUOC: neu bo `insertDisabled` thi khoi patch MAT dong disabled ⇒ ca nay PHAI do", () => {
    const metadata = parseGbhMetadata(readFileSync(join(OURS_PKG, "package.json"), "utf8"));
    const row = metadata?.row as GbhRowMetadata;
    const without = { ...row, insertDisabled: undefined } as GbhRowMetadata;
    expect(renderRewriteBlock(PKG, without)).not.toContain("      disabled:");
    expect(renderRewriteBlock(PKG, row)).toContain("      disabled: !!js " + STOCK_DISABLED_EXPRESSION);
  });
});
