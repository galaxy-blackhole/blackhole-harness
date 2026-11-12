/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-session-telemetry-otel: mỗi ca hành vi dựng HAI giàn giống hệt
 *      nhau rồi cài CẢ HAI bản (ta và chính bundle gốc) trên Context cordis THẬT, so vết đo (bản ghi đã báo,
 *      tuỳ chọn kênh log, cảnh báo logger, lỗi cấu hình); cộng ca tập export trên ARTIFACT, ca
 *      gbh.peers ⊆ peerDependencies (có ĐỐI CHỨNG ÂM), ca C6 (DANH TÍNH), ca 000e locale và TEST CANH.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session-telemetry-otel/build.ts";

/** Thư mục gốc repo (file này nằm ở tests/host). */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "session-telemetry-otel");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-telemetry-otel");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** `Context` của kernel — MỘT lớp cho cả hai bên cài (cùng một tệp thật). */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");
/**
 * Thư viện API logs của kernel — nguồn của `SeverityNumber`.
 * Đường dẫn TÍNH LÚC CHẠY nên `tsc` không kéo kiểu của nó vào chương trình (quy ước của repo).
 */
const API_LOGS = join(ROOT, "apps", "host", "node_modules", "@opentelemetry", "api-logs", "build", "src", "index.js");

/** Enum severity của OTel do kernel cấp — dùng để khẳng định ánh xạ ba mức của backend. */
const { SeverityNumber } = (await import(API_LOGS)) as unknown as {
  /** Đánh số các mức severity của OTel. */
  SeverityNumber: { INFO: number; WARN: number; ERROR: number };
};

/** Thư mục home TẠM cho `getOrCreateAnonymousUserId` — KHÔNG bao giờ chạm home thật của app. */
const TMP_HOME = mkdtempSync(join(tmpdir(), "gbh-sto-home-"));

// `getOrCreateAnonymousUserId()` đọc `DSH_HOME`; trỏ vào home tạm để test không ghi vào home thật.
const PREVIOUS_DSH_HOME = process.env.DSH_HOME;
process.env.DSH_HOME = TMP_HOME;

afterAll(async () => {
  if (PREVIOUS_DSH_HOME === undefined) delete process.env.DSH_HOME;
  else process.env.DSH_HOME = PREVIOUS_DSH_HOME;
  await rm(TMP_HOME, { recursive: true, force: true });
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
  rmSync(SURFACE_DIR, { recursive: true, force: true });
});

/** Tuỳ chọn mà bên cài đã đưa cho `ctx.otel.createSessionLogReporter`. */
interface ReporterOptions {
  /** Danh tính instrumentation scope gửi kèm mọi record. */
  scope: { name: string; version?: string };
  /** Vận chuyển HTTP của SDK (URL đã kiểm). */
  exporter: Record<string, unknown> & { url?: string };
  /** Hàng đợi chặn byte (chỉ có khi cấu hình khai). */
  processor?: Record<string, unknown>;
  /** Trần byte request (chỉ có khi cấu hình khai). */
  maxRequestBytes?: number;
  /** Danh tính sản phẩm + người dùng ẩn danh gắn trên resource OTLP. */
  resourceAttributes: Record<string, unknown>;
  /** Báo lỗi mạng/bản ghi cho tầng trên, không ghi nội dung. */
  onFailure: (message: string, error?: Error) => void;
}

/** Một bản ghi mà kênh log phiên đã nhận. */
interface ReportedRecord {
  /** Phiên sở hữu sự kiện. */
  sessionId: unknown;
  /** Phong bì sự kiện canonical + thân đã làm sạch. */
  event: { type?: string; seq?: number; time?: number; data?: unknown };
  /** Số severity OTel đã ánh xạ. */
  severityNumber?: number;
  /** Thuộc tính danh tính do coordinator dựng. */
  attributes?: Record<string, unknown>;
}

/** Thực thể dịch vụ quan sát được (ba thành viên công khai của bản gốc). */
interface ServiceLike {
  /** Chế độ chia sẻ đã công bố. */
  sharing: string;
  /** Bỏ mọi bản ghi đi thẳng. */
  emit(record: unknown): void;
  /** Rút cạn request đang xếp hàng trong hạn chót. */
  shutdown(): Promise<void>;
}

/** Lớp plugin của MỘT bên cài (ta hoặc gốc). */
interface PluginClass {
  /** Dựng backend trên một Context; cấu hình đã qua schema. */
  new (ctx: unknown, config: unknown): ServiceLike;
  /** Schema schemastery, đồng thời là hàm chuẩn hoá cấu hình. */
  Config: (value: unknown) => unknown;
  /** Hai seam mà tầng nạp chờ. */
  inject: string[];
}

/** Context cordis tối thiểu mà phép đo chạm tới. */
interface HarnessContext {
  /** Cấp một dịch vụ giả trong phạm vi của fiber hiện tại. */
  provide(name: string, value: unknown): unknown;
  /** Tra một dịch vụ đã cấp. */
  get(name: string): unknown;
  /** Nạp một plugin (đường THẬT mà tầng nạp dùng); trả fiber dạng thenable. */
  plugin(plugin: unknown, config: unknown): Promise<unknown>;
  /** Phát một sự kiện trên bus của kernel (lan xuống listener của plugin). */
  emit(name: string, ...args: unknown[]): void;
  /** Logger của kernel — ta thay `warn` để bắt cảnh báo. */
  logger: { warn: (...args: unknown[]) => void };
}

/** Dấu vết của một lần dựng giàn. */
interface Booted {
  /** Context đã cấp hai seam. */
  ctx: HarnessContext;
  /** Thực thể dịch vụ (undefined khi lượt dựng ném). */
  service: ServiceLike | undefined;
  /** Lỗi lượt dựng ném ra (undefined khi thành công). */
  pluginError: Error | undefined;
  /** Mọi lượt `logger.warn` đã bắt, theo thứ tự. */
  warns: string[];
  /** Tuỳ chọn của từng kênh log phiên đã tạo. */
  options: ReporterOptions[];
  /** Mọi bản ghi kênh log phiên đã nhận, theo thứ tự. */
  reports: ReportedRecord[];
  /** Số lượt `stopPending` đã gọi trên kênh log. */
  stopPending: () => number;
}

/** Bản gốc nạp động: cùng sáu export như ta. */
const stock = (await import(STOCK)) as unknown as {
  Config: (value: unknown) => unknown;
  DEFAULT_SHUTDOWN_TIMEOUT_MILLIS: number;
  DEFAULT_TELEMETRY_MODE: string;
  OpenTelemetrySessionBackend: PluginClass;
  SessionTelemetryMode: Record<string, string>;
  default: PluginClass;
};

/** `Context` của cordis kernel. */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => HarnessContext };

// ĐO TRÊN ARTIFACT, và artefact phải phân giải peer về ĐÚNG instance kernel (pattern tests/host/shell.test.ts):
// nạp thẳng src/ hay lib/ trong workspace thì `cordis`/`dsh-llm` trỏ về bản .bun của workspace — khác realpath
// kernel ⇒ sai lớp nền và sai service.version (0.2.1-rc.5 thay vì 0.2.1-alpha.4).
// Gói đọc `createRequire(import.meta.url)("../package.json")` ⇒ thư mục dựng tạm phải có package.json của gói
// NGAY TRÊN `lib/`, còn peer thì trỏ về kernel. build.ts xoá outDir nên symlink phải dựng SAU khi build xong.
const SURFACE_DIR = mkdtempSync(join(tmpdir(), "gbh-sto-surface-"));
const OURS_ARTIFACT = await buildPackage(join(SURFACE_DIR, "lib"));
copyFileSync(join(PKG, "package.json"), join(SURFACE_DIR, "package.json"));
mkdirSync(join(SURFACE_DIR, "node_modules"), { recursive: true });
symlinkSync(
  join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"),
  join(SURFACE_DIR, "node_modules", "@deepseek-ai"),
  "dir",
);
// Gói còn import trần @opentelemetry/api-logs — cùng phải là bản kernel cấp.
symlinkSync(
  join(ROOT, "apps", "host", "node_modules", "@opentelemetry"),
  join(SURFACE_DIR, "node_modules", "@opentelemetry"),
  "dir",
);
/** Sáu export runtime của artefact ta — nguồn của mọi phép đo hành vi lẫn bề mặt. */
const oursModule = (await import(OURS_ARTIFACT)) as unknown as {
  Config: (value: unknown) => unknown;
  DEFAULT_SHUTDOWN_TIMEOUT_MILLIS: number;
  DEFAULT_TELEMETRY_MODE: string;
  OpenTelemetrySessionBackend: PluginClass;
  SessionTelemetryMode: Record<string, string>;
  default: PluginClass;
};
const { Config, DEFAULT_SHUTDOWN_TIMEOUT_MILLIS, DEFAULT_TELEMETRY_MODE, OpenTelemetrySessionBackend, SessionTelemetryMode } =
  oursModule;

/** Chế độ shutdown của kênh log giả: tắt bình thường, treo mãi, hay từ chối. */
type ShutdownMode = "resolved" | "hang" | "reject";

/**
 * Dựng MỘT bên cài trên Context cordis thật, kèm hai seam giả có ghi vết.
 * Nhận: lớp plugin, cấu hình thô, và chế độ shutdown của kênh log giả.
 * Trả: dấu vết đầy đủ để so hai bên.
 */
async function boot(plugin: PluginClass, raw: Record<string, unknown>, shutdownMode: ShutdownMode = "resolved"): Promise<Booted> {
  const warns: string[] = [];
  const options: ReporterOptions[] = [];
  const reports: ReportedRecord[] = [];
  let stopped = 0;
  const ctx = new Context();
  ctx.provide("sessions", { messageProjections: [], list: () => [] });
  ctx.provide("otel", {
    createSessionLogReporter(reporterOptions: ReporterOptions): unknown {
      options.push(reporterOptions);
      return {
        reportSessionLog(record: ReportedRecord): void {
          reports.push(record);
        },
        stopPending(): void {
          stopped += 1;
        },
        shutdown(): Promise<void> {
          if (shutdownMode === "hang") return new Promise<void>(() => {});
          if (shutdownMode === "reject") return Promise.reject(new Error("transport chet"));
          return Promise.resolve();
        },
      };
    },
  });
  ctx.logger.warn = (...args: unknown[]): void => {
    warns.push(args.map((arg) => String(arg)).join(" "));
  };
  let pluginError: Error | undefined;
  try {
    await ctx.plugin(plugin, raw);
  } catch (error) {
    pluginError = error instanceof Error ? error : new Error(String(error));
  }
  return {
    ctx,
    service: ctx.get("sessionTelemetry") as ServiceLike | undefined,
    pluginError,
    warns,
    options,
    reports,
    stopPending: () => stopped,
  };
}

/** Phiên giả ĐÚNG hình dạng mà coordinator đọc: header, id, inheritedEventCount, log canonical. */
interface FakeSession {
  /** Id phiên. */
  id: string;
  /** Số sự kiện thừa kế từ cha (fork). */
  inheritedEventCount: number;
  /** Seq đầu tiên thuộc vòng đời này. */
  firstLifecycleSeq: number;
  /** Header đã kiểm (identityOf đọc version/cwd/parentSession/isSeeded). */
  header: { version: number; isSeeded: boolean; cwd?: string; parentSession?: string };
  /** Tra ĐÚNG đối tượng sự kiện đang sống ở seq đó (dùng cho phép kiểm canonical). */
  eventAt(seq: number): FakeEvent | undefined;
  /** Ảnh chụp log canonical từ offset (byte/seq) chỉ định. */
  snapshotEvents(offset: number): FakeEvent[];
}

/** Một sự kiện canonical giả. */
interface FakeEvent {
  /** Loại sự kiện (thuộc `SessionEventMap`). */
  type: string;
  /** Số thứ tự trong log. */
  seq: number;
  /** Thời điểm thêm vào log (epoch ms). */
  time: number;
  /** Thân sự kiện. */
  data: Record<string, unknown>;
}

/**
 * Dựng một phiên giả với ĐÚNG một sự kiện canonical.
 * Nhận: loại sự kiện, thân sự kiện, và cờ "đối tượng `eventAt` trả KHÁC đối tượng đang phát".
 * Trả: phiên giả (cast sang `Session` ở chỗ phát).
 */
function makeSession(
  type: string,
  data: Record<string, unknown>,
  options: { nonCanonical?: boolean; inheritedEventCount?: number; sessionId?: string } = {},
): { session: FakeSession; event: FakeEvent } {
  const inheritedEventCount = options.inheritedEventCount ?? 0;
  const id = options.sessionId ?? "11111111-1111-4111-8111-111111111111";
  const event: FakeEvent = { type, seq: inheritedEventCount, time: 1_760_000_000_000, data };
  const canonical = options.nonCanonical === true ? { ...event } : event;
  const session: FakeSession = {
    id,
    inheritedEventCount,
    firstLifecycleSeq: 0,
    header: { version: 4, isSeeded: inheritedEventCount > 0 },
    eventAt: (seq: number): FakeEvent | undefined => (seq === event.seq ? canonical : undefined),
    snapshotEvents: (offset: number): FakeEvent[] => (event.seq >= offset ? [event] : []),
  };
  return { session, event };
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Phiên bản gói. */
  version: string;
  /** Khối phụ thuộc thật (peer phải VẮNG ở đây). */
  dependencies?: Record<string, string>;
  /** Khối phụ thuộc phát triển. */
  devDependencies?: Record<string, string>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Bảng export của gói. */
  exports?: Record<string, unknown>;
  /** Metadata của ta (không được khai `row`). */
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói ta.
 * Nhận: không.
 * Trả: manifest đã phân tích.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu, đã sắp xếp.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return [...(manifest.gbh?.peers ?? [])].filter((peer) => !declared.has(peer)).sort();
}

/**
 * Nhân bản manifest để phá mà không chạm bản gốc.
 * Nhận: manifest nguồn.
 * Trả: bản sao sâu.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/** Bản gốc nạp động dưới dạng lớp plugin. */
const STOCK_PLUGIN = stock.default;

describe("row session-telemetry-otel · chế độ DISABLED — đối chứng với CHÍNH bundle gốc", () => {
  test("cùng trạng thái chia sẻ, cùng cảnh báo cho ĐÚNG bốn hình dạng sự kiện, cùng bỏ qua phần còn lại", async () => {
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const booted = await boot(plugin, { mode: "DISABLED" });
      expect(booted.pluginError).toBeUndefined();
      expect(booted.service?.sharing).toBe("disabled");
      // DISABLED không dựng SDK: KHÔNG một kênh log nào.
      expect(booted.options.length).toBe(0);
      const emit = (session: FakeSession, event: FakeEvent): void => {
        booted.ctx.emit("session/event", session, event);
      };
      // (1) phản hồi canonical của CHÍNH phiên ⇒ cảnh báo.
      const record = makeSession("feedback/record", { text: "sai" });
      emit(record.session, record.event);
      // (2) sự kiện KHÔNG phải phản hồi ⇒ không cảnh báo.
      const turn = makeSession("turn/start", { turn: 1 });
      emit(turn.session, turn.event);
      // (3) phản hồi nằm TRƯỚC ranh giới thừa kế (seed của fork) ⇒ không cảnh báo.
      const inherited = makeSession("feedback/record", {}, { inheritedEventCount: 5 });
      expect(inherited.event.seq).toBe(5);
      emit(
        { ...inherited.session, inheritedEventCount: 6 },
        inherited.event,
      );
      // (4) phản hồi của phiên KHÁC ⇒ không cảnh báo; phản hồi message của CHÍNH phiên ⇒ cảnh báo.
      const foreign = makeSession("feedback/message-put", { sessionId: "22222222-2222-4222-8222-222222222222" });
      emit(foreign.session, foreign.event);
      const own = makeSession("feedback/message-delete", { sessionId: "11111111-1111-4111-8111-111111111111" });
      emit(own.session, own.event);
      expect(booted.warns).toEqual([
        "OpenTelemetry session upload is DISABLED; this feedback is not uploaded through OpenTelemetry",
        "OpenTelemetry session upload is DISABLED; this feedback is not uploaded through OpenTelemetry",
      ]);
      // (5) shutdown ở DISABLED là no-op đã hoàn tất (không có nhà cung cấp).
      await booted.service?.shutdown();
      expect(booted.stopPending()).toBe(0);
    }
  });
});

describe("row session-telemetry-otel · FEEDBACK_ONLY — ma trận lỗi cấu hình, đối chứng TỪNG CHỮ", () => {
  /** Cấu hình hợp lệ tối thiểu — mỗi ca chỉ phá ĐÚNG một trường. */
  const VALID = { mode: "FEEDBACK_ONLY", exporter: { url: "https://collector.example.com/v1/logs" } };

  /** Sáu hình dạng cấu hình phải ném, kèm nhãn đọc được. */
  const CASES: { label: string; raw: Record<string, unknown> }[] = [
    { label: "thiếu url", raw: { mode: "FEEDBACK_ONLY" } },
    { label: "url rỗng", raw: { mode: "FEEDBACK_ONLY", exporter: { url: "" } } },
    { label: "url không hợp lệ", raw: { mode: "FEEDBACK_ONLY", exporter: { url: "khong-phai-url" } } },
    { label: "url sai giao thức", raw: { mode: "FEEDBACK_ONLY", exporter: { url: "ftp://collector.example.com/v1/logs" } } },
    { label: "batch size 0", raw: { ...VALID, processor: { maxExportBatchSize: 0 } } },
    { label: "batch size lẻ", raw: { ...VALID, processor: { maxExportBatchSize: 1.5 } } },
    { label: "hạn chót 0", raw: { ...VALID, shutdownTimeoutMillis: 0 } },
    { label: "hạn chót vô cực", raw: { ...VALID, shutdownTimeoutMillis: Number.POSITIVE_INFINITY } },
    { label: "hạn chót vượt trần 2^31-1", raw: { ...VALID, shutdownTimeoutMillis: 2147483648 } },
  ];

  test("mọi ca ném ĐÚNG cùng một thông điệp ở cả hai bên, và KHÔNG đăng ký dịch vụ", async () => {
    expect(CASES.length).toBeGreaterThanOrEqual(9);
    for (const ca of CASES) {
      const ours = await boot(OpenTelemetrySessionBackend as unknown as PluginClass, ca.raw);
      const theirs = await boot(STOCK_PLUGIN, ca.raw);
      expect([ca.label, ours.pluginError?.message]).toEqual([ca.label, theirs.pluginError?.message]);
      expect(ours.pluginError?.message).toBeString();
      expect(ours.pluginError?.message.length ?? 0).toBeGreaterThan(20);
      expect(ours.service).toBeUndefined();
      expect(theirs.service).toBeUndefined();
    }
  });

  test("DISABLED KHÔNG đọc endpoint lẫn hạn chót: cùng cấu hình rác vẫn dựng được ở cả hai bên", async () => {
    // Schema vẫn chạy trước (nên KHÔNG dùng `maxRequestBytes: 0`); thứ DISABLED bỏ qua là endpoint + hạn chót.
    const raw = { mode: "DISABLED", exporter: { url: "ftp://rac" }, shutdownTimeoutMillis: -1 };
    const ours = await boot(OpenTelemetrySessionBackend as unknown as PluginClass, raw);
    const theirs = await boot(STOCK_PLUGIN, raw);
    expect(ours.pluginError).toBeUndefined();
    expect(theirs.pluginError).toBeUndefined();
    expect(ours.service?.sharing).toBe(theirs.service?.sharing);
    expect(ours.service?.sharing).toBe("disabled");
    expect(ours.options.length).toBe(0);
  });

  test("schema Config: cùng chuỗi mô tả, cùng mặc định, cùng thông điệp khi mode lạ", () => {
    const ours = (Config as unknown as (value: unknown) => unknown);
    expect(String(Config)).toBe(String(stock.Config));
    expect(ours({})).toEqual(stock.Config({}));
    expect(ours({})).toEqual({ mode: "FEEDBACK_ONLY" });
    expect(ours(VALID)).toEqual(stock.Config(VALID));
    let oursError = "";
    let theirsError = "";
    try {
      ours({ mode: "KHONG_CO" });
    } catch (error) {
      oursError = String(error);
    }
    try {
      stock.Config({ mode: "KHONG_CO" });
    } catch (error) {
      theirsError = String(error);
    }
    expect(oursError).toBe(theirsError);
    expect(oursError).toContain("KHONG_CO");
  });
});

describe("row session-telemetry-otel · FEEDBACK_ONLY — nối seam và thu ĐẦU-CUỐI", () => {
  test("cùng tuỳ chọn kênh log (scope · exporter · processor · trần byte · resource) ở cả hai bên", async () => {
    const raw = {
      mode: "FEEDBACK_ONLY",
      exporter: { url: "https://collector.example.com/v1/logs", compression: "gzip", timeoutMillis: 1000 },
      processor: { maxExportBatchSize: 2048, scheduledDelayMillis: 10000 },
      maxRequestBytes: 4_000_000,
      shutdownTimeoutMillis: 3000,
    };
    const ours = await boot(OpenTelemetrySessionBackend as unknown as PluginClass, raw);
    const theirs = await boot(STOCK_PLUGIN, raw);
    expect(ours.pluginError).toBeUndefined();
    expect(theirs.pluginError).toBeUndefined();
    expect(ours.service?.sharing).toBe(theirs.service?.sharing);
    expect(ours.service?.sharing).toBe("feedback-only");
    const shape = (options: ReporterOptions): Record<string, unknown> => ({
      scope: options.scope,
      exporter: options.exporter,
      processor: options.processor,
      maxRequestBytes: options.maxRequestBytes,
      resourceAttributes: options.resourceAttributes,
      onFailure: typeof options.onFailure,
    });
    const oursOptions = ours.options[0];
    const theirsOptions = theirs.options[0];
    if (oursOptions === undefined || theirsOptions === undefined) throw new Error("thiếu tuỳ chọn kênh log");
    expect(shape(oursOptions)).toEqual(shape(theirsOptions));
    // Danh tính instrumentation PHẢI trùng oracle (tên stock, phiên bản đọc từ manifest của gói).
    expect(oursOptions.scope).toEqual({ name: "@deepseek-ai/dsh-session-telemetry-otel", version: "0.2.1-alpha.4" });
    expect(oursOptions.exporter.url).toBe("https://collector.example.com/v1/logs");
    expect(oursOptions.exporter.compression).toBe("gzip");
    expect(oursOptions.maxRequestBytes).toBe(4_000_000);
    // `onFailure` đi thẳng vào `ctx.logger.warn` — kiểm BẰNG HÀNH VI, không bằng tham chiếu.
    oursOptions.onFailure("mang hong", new Error("ECONN"));
    theirsOptions.onFailure("mang hong", new Error("ECONN"));
    expect(ours.warns).toEqual(theirs.warns);
    expect(ours.warns).toEqual(["mang hong Error: ECONN"]);
  });

  test("một phản hồi canonical ⇒ ĐÚNG một bản ghi, cùng hình dạng ở cả hai bên", async () => {
    const raw = { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" } };
    const traces: unknown[] = [];
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const booted = await boot(plugin, raw);
      const record = makeSession("feedback/record", { text: "cam on" });
      booted.ctx.emit("session/event", record.session, record.event);
      expect(booted.warns).toEqual([]);
      expect(booted.reports.length).toBe(1);
      expect(booted.reports[0]?.severityNumber).toBe(SeverityNumber.INFO);
      expect(booted.reports[0]?.event.type).toBe("feedback/record");
      expect(booted.reports[0]?.event.data).toEqual({ text: "cam on" });
      expect(booted.reports[0]?.attributes?.["event.seq"]).toBe(0);
      expect(booted.reports[0]?.attributes?.["session.id"]).toBe("11111111-1111-4111-8111-111111111111");
      traces.push(booted.reports);
    }
    // Hai bên báo ĐÚNG cùng một vết.
    expect(traces[0]).toEqual(traces[1]);
  });

  test("sự kiện KHÔNG canonical ⇒ cảnh báo và KHÔNG báo; sự kiện không phải phản hồi ⇒ im lặng", async () => {
    const raw = { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" } };
    const traces: unknown[] = [];
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const booted = await boot(plugin, raw);
      const stale = makeSession("feedback/record", {}, { nonCanonical: true });
      booted.ctx.emit("session/event", stale.session, stale.event);
      const turn = makeSession("turn/start", { turn: 1 });
      booted.ctx.emit("session/event", turn.session, turn.event);
      expect(booted.reports.length).toBe(0);
      expect(booted.warns).toEqual(["session telemetry ignored an event absent from the canonical session log"]);
      traces.push(booted.warns);
    }
    expect(traces[0]).toEqual(traces[1]);
  });

  test("feedback/committed RỖNG ⇒ cả hai bên trả về im lặng (không dựng lại phiên)", async () => {
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const booted = await boot(plugin, { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" } });
      booted.ctx.emit("feedback/committed", { meta: { version: 4, id: "x", createdAt: 1, isSeeded: false }, events: [], inheritedEventCount: 0 });
      expect(booted.reports.length).toBe(0);
      expect(booted.warns).toEqual([]);
    }
  });
});

describe("row session-telemetry-otel · shutdown — hạn chót ngoài cùng", () => {
  test("kênh log treo ⇒ từ chối ĐÚNG hạn chót, gọi stopPending, và thông điệp TRÙNG oracle", async () => {
    const raw = { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" }, shutdownTimeoutMillis: 20 };
    const messages: string[] = [];
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const booted = await boot(plugin, raw, "hang");
      const service = booted.service;
      if (service === undefined) throw new Error("thiếu dịch vụ");
      let message = "";
      try {
        await service.shutdown();
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }
      expect(message).toContain("session-telemetry-otel: provider shutdown exceeded 20ms");
      // Watchdog KHÔNG nhả chỗ vận chuyển chưa quyết: kênh log phải được bảo dừng.
      expect(booted.stopPending()).toBe(1);
      messages.push(message);
    }
    expect(messages[0]).toBe(messages[1]);
  });

  test("kênh log tắt bình thường ⇒ hoàn tất, KHÔNG gọi stopPending", async () => {
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const booted = await boot(plugin, { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" } });
      await booted.service?.shutdown();
      expect(booted.stopPending()).toBe(0);
    }
  });
});

describe("row session-telemetry-otel · bề mặt plugin đo trên ARTIFACT", () => {
  test("tập export ta = tập export gốc (0 thiếu · 0 thừa), 0 id module, cùng prototype", async () => {
    // Dùng CHÍNH artefact của bề mặt (đã dựng + symlink peer kernel ở đầu tệp) để phép so lớp nền có nghĩa.
    const file = OURS_ARTIFACT;
    const code = readFileSync(file, "utf8");
    // Row MỘT MẶT + host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy).
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as unknown as Record<string, unknown> & {
      Config: (value: unknown) => unknown;
      OpenTelemetrySessionBackend: PluginClass;
      SessionTelemetryMode: Record<string, string>;
      default: unknown;
    };
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual([
      "Config",
      "DEFAULT_SHUTDOWN_TIMEOUT_MILLIS",
      "DEFAULT_TELEMETRY_MODE",
      "OpenTelemetrySessionBackend",
      "SessionTelemetryMode",
      "default",
    ]);
    // `default` LÀ lớp backend (bản gốc cũng vậy) — loader nạp theo tên package.
    expect(artifact.default).toBe(artifact.OpenTelemetrySessionBackend);
    expect(artifact.SessionTelemetryMode).toEqual(stock.SessionTelemetryMode);
    expect(artifact.SessionTelemetryMode).toEqual({ FEEDBACK_ONLY: "FEEDBACK_ONLY", DISABLED: "DISABLED" });
    expect(String(DEFAULT_TELEMETRY_MODE)).toBe(stock.DEFAULT_TELEMETRY_MODE);
    // Đảo vế: `SessionTelemetryMode` khai `Record<string, string>` nên dưới `noUncheckedIndexedAccess` vế phải là
    // `string | undefined`; so theo chiều này vẫn khẳng định ĐÚNG một đẳng thức giá trị.
    expect(SessionTelemetryMode.FEEDBACK_ONLY).toBe(DEFAULT_TELEMETRY_MODE);
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MILLIS).toBe(stock.DEFAULT_SHUTDOWN_TIMEOUT_MILLIS);
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MILLIS).toBe(3000);
    expect(String(artifact.Config)).toBe(String(stock.Config));
    expect(artifact.OpenTelemetrySessionBackend.inject).toEqual(stock.OpenTelemetrySessionBackend.inject);
    expect(artifact.OpenTelemetrySessionBackend.inject).toEqual(["sessions", "otel"]);
    // KẾ THỪA ĐÚNG lớp nền của kernel — hai bản sao lớp nền sẽ làm lệch hành vi.
    expect(Object.getPrototypeOf(artifact.OpenTelemetrySessionBackend)).toBe(
      Object.getPrototypeOf(stock.OpenTelemetrySessionBackend),
    );
    expect(Object.getPrototypeOf(artifact.OpenTelemetrySessionBackend).name).toBe("SessionTelemetryBackend");
  });
});

describe("row session-telemetry-otel · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ) và có thật trong kernel", () => {
    const manifest = readManifest();
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...(manifest.gbh?.peers ?? [])].sort()).toEqual([
      "@deepseek-ai/dsh-anonymous-user-id",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-otel",
      "@deepseek-ai/dsh-session",
      "@deepseek-ai/dsh-session-telemetry",
      "@opentelemetry/api-logs",
    ]);
    expect(missingPeers(manifest)).toEqual([]);
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(ROOT, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      const declared = manifest.peerDependencies?.[peer] ?? "";
      expect(declared.length).toBeGreaterThan(0);
      const floor = declared.replace(/^[~^]/, "").split(".").slice(0, 2).join(".");
      expect(kernel.version.startsWith(floor)).toBe(true);
      // Peer LUÔN là peerDependencies — khai vào dependencies là dựng thể hiện THỨ HAI.
      expect(deps.has(peer)).toBe(false);
      expect(manifest.devDependencies?.[peer]).toBe(declared);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau vẫn PHẢI bị bắt; THỪA tên thì ĐẠT", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    mutated.gbh = { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] };
    mutated.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5", "@deepseek-ai/dsh-session": "0.2.1-alpha.4" };
    expect(mutated.gbh.peers?.length).toBe(Object.keys(mutated.peerDependencies).length);
    expect(missingPeers(mutated)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("row session-telemetry-otel · C6 — DANH TÍNH vật thể cấu hình giữa hai thực thể", () => {
  test("mỗi lượt dựng tạo vật thể RIÊNG; sửa bản này KHÔNG lan sang bản kia (cả hai bên)", async () => {
    const raw = { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" } };
    for (const plugin of [OpenTelemetrySessionBackend as unknown as PluginClass, STOCK_PLUGIN]) {
      const first = await boot(plugin, raw);
      const second = await boot(plugin, raw);
      const a = first.options[0];
      const b = second.options[0];
      if (a === undefined || b === undefined) throw new Error("thiếu tuỳ chọn kênh log");
      // DANH TÍNH, không phải giá trị: `toEqual` sẽ ĐẠT dù hai thực thể chia sẻ tham chiếu.
      expect(a).not.toBe(b);
      expect(a.resourceAttributes).not.toBe(b.resourceAttributes);
      expect(a.scope).not.toBe(b.scope);
      expect(a.exporter).not.toBe(b.exporter);
      // Sửa một bên KHÔNG lan sang bên kia.
      a.resourceAttributes["user.id"] = "da-sua";
      a.scope.name = "da-sua";
      expect(b.resourceAttributes["user.id"]).not.toBe("da-sua");
      expect(b.scope.name).toBe("@deepseek-ai/dsh-session-telemetry-otel");
    }
  });

  test("hai thực thể giữ kênh log ĐỘC LẬP: sự kiện trên giàn này không tới giàn kia", async () => {
    const raw = { mode: "FEEDBACK_ONLY", exporter: { url: "http://127.0.0.1:4318/v1/logs" } };
    const first = await boot(OpenTelemetrySessionBackend as unknown as PluginClass, raw);
    const second = await boot(OpenTelemetrySessionBackend as unknown as PluginClass, raw);
    const record = makeSession("feedback/record", { text: "chi giàn một" });
    first.ctx.emit("session/event", record.session, record.event);
    expect(first.reports.length).toBe(1);
    expect(second.reports.length).toBe(0);
  });
});

describe("row session-telemetry-otel · 000e locale + hợp đồng metadata", () => {
  test("locale en/zh chép byte-for-byte từ gói gốc và manifest export chúng", () => {
    const manifest = readManifest();
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
    const oursZh = JSON.parse(readFileSync(join(PKG, "locale", "zh.json"), "utf8")) as { meta?: { title?: string } };
    const theirsZh = JSON.parse(readFileSync(join(STOCK_DIR, "locale", "zh.json"), "utf8")) as { meta?: { title?: string } };
    expect(oursZh.meta?.title).toBe(theirsZh.meta?.title);
  });

  // Trước 08:41 ngày 18/10 ca này là **TEST CANH** (`gbh.row` phải VẮNG — tác giả gói KHÔNG tự khai mount).
  // LEAD đã khai row lúc 08:41 ⇒ ca này đổi chiều thành **hợp đồng metadata**, đúng mẫu ở recipe §7: canh
  // id ĐÚNG row stock, config ĐÚNG cấu hình đang chạy, test trỏ ĐÚNG file này, và row MỘT MẶT KHÔNG được
  // kéo theo `moduleIds`/`aliases` (không có nửa client để nạp).
  test("`gbh.row` (do LEAD khai, KHÔNG phải tác giả gói) trỏ ĐÚNG row, ĐÚNG config đang chạy, ĐÚNG test này", () => {
    const manifest = readManifest();
    const row = manifest.gbh?.row as
      | { id?: string; config?: Record<string, unknown>; tests?: string[]; moduleIds?: unknown; aliases?: unknown }
      | undefined;
    expect(row?.id).toBe("session-telemetry-otel");
    // `ours.yml` (dump mới nhất) đang chạy đúng một trường này — patch của profile đặt `mode: DISABLED`.
    expect(row?.config).toEqual({ mode: "DISABLED" });
    expect(row?.tests).toEqual(["tests/host/session-telemetry-otel.test.ts"]);
    expect(row?.moduleIds).toBeUndefined();
    expect(row?.aliases).toBeUndefined();
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-session-telemetry-otel");
    // Phiên bản gói = phiên bản oracle để `scope.version` gửi đi TRÙNG bản gốc (xem README gói §6).
    expect(manifest.version).toBe("0.2.1-alpha.4");
  });
});
