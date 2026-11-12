/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-session-projection-cache (row session-projection-cache): bước 0 đọc
 *      CẶP row trong ours.yml, đo tập export trên ARTIFACT, đối chứng TRỰC TIẾP với chính bundle gốc trên
 *      Context cordis THẬT (ghi · phép xem · gợi ý tiêu đề · nạp · đọc lạnh · tiết lưu · fail-soft),
 *      A/B schema miền + `defineDomain` + Config, ca dấu kiểu với kernel, quy ước
 *      `gbh.peers ⊆ peerDependencies` có ĐỐI CHỨNG ÂM, ca C6 (DANH TÍNH), luật 000e (locale
 *      byte-for-byte) và ca 0c ghi lại HÌNH DẠNG khai báo row do LEAD thêm ngoài phiên viết gói.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPackage } from "../../packages/host/session-projection-cache/build.ts";

/** Thư mục package của ta — gốc của mọi phép đọc manifest/nguồn. */
const PKG = join(import.meta.dir, "..", "..", "packages", "host", "session-projection-cache");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của MỌI ca A/B. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-projection-cache");
/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Kernel modules — nguồn của các gói ngoài (CHỈ ĐỌC). */
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** cordis của KERNEL — artifact của ta phân giải peer về đây (bản workspace là MÔ-ĐUN khác ⇒ lệch danh tính). */
const OUR_CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà bundle gốc nạp. */
const STOCK_CORDIS = join(KERNEL, "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer lúc nạp. */
const OUT = join(PKG, ".test-lib");

/** Nhãn một bên của phép A/B. */
type SideName = "ta" | "gốc";

/** Cấu hình dùng cho hầu hết ca (ngưỡng thời gian dài để không có hẹn giờ lạc). */
const CONFIG = { writeEveryEvents: 200, writeIntervalMs: 60_000 };

/** Một sự kiện phiên dựng trong test. */
interface FakeEvent {
  /** Loại sự kiện. */
  readonly type: string;
  /** Vị trí trong log. */
  readonly seq: number;
  /** Dữ liệu sự kiện. */
  readonly data?: unknown;
}

/** Nhật ký một lượt chạy giàn thử. */
interface Recorder {
  /** Các lượt `put` vào bảng `sessions` (thứ tự = thứ tự thật). */
  readonly puts: { key: string; value: Record<string, unknown> }[];
  /** Các dòng `logger.warn`. */
  readonly warnings: string[];
  /** Các spec đã `open`. */
  readonly opened: Record<string, unknown>[];
  /** Các lượt `sessions.flush` (theo id). */
  readonly flushes: string[];
  /** Số lượt `close` của miền. */
  closed: number;
  /** Khi `true`: mọi lượt `put` NÉM (để đo đường fail-soft). */
  failPut: boolean;
}

/** Một phép cắt chiếu (hình dạng mà cả hai bên trả về). */
interface Snapshot {
  /** Seq của sự kiện cuối mà mọi giá trị phản ánh. */
  readonly asOfSeq: number;
  /** Giá trị theo khoá. */
  readonly values: Record<string, unknown>;
}

/** Bề mặt dịch vụ cache mà test gọi (khai theo CẤU TRÚC, không import gói seam nào). */
interface CacheLike {
  /** Ghi bền checkpoint của một phiên đang sống. */
  write(session: unknown): Promise<void>;
  /** Phép đọc liệt kê không I/O. */
  cachedSnapshot(meta: unknown, keys?: readonly string[]): Snapshot | undefined;
  /** Gợi ý tiêu đề của bản ghi tiền nhiệm. */
  cachedPredecessorTitle(meta: unknown): Snapshot | undefined;
  /** Đọc lạnh từ log đầy đủ. */
  coldSnapshot(meta: unknown, inheritedEventCount: number, events: readonly FakeEvent[]): Snapshot;
  /** Nạp cho một phiên đã chuẩn bị. */
  hydratePrepared(session: unknown, events: readonly FakeEvent[]): Snapshot;
}

/** Một giàn thử: Context cordis THẬT + dịch vụ cache của MỘT bên. */
interface Harness {
  /** Context cordis thật (có `on`/`emit`/`effect`). */
  readonly ctx: Record<string, unknown> & { emit(name: string, ...args: unknown[]): void };
  /** Dịch vụ cache của bên đó. */
  readonly cache: CacheLike;
  /** Sổ chiếu THẬT của kernel (cùng một bản cho cả hai bên). */
  readonly registry: Record<string, unknown>;
  /** Nhật ký. */
  readonly rec: Recorder;
  /** Trạng thái bảng `sessions` (như miền giữ trong bộ nhớ). */
  readonly table: Map<string, Record<string, unknown>>;
  /** Phiên đang sống theo id (để đo nhánh `flush`). */
  readonly live: Map<string, unknown>;
}

/** Một bên của phép A/B: mô-đun + cordis + hàm dựng của CHÍNH bên đó. */
interface Side {
  /** Nhãn. */
  readonly name: SideName;
  /** Mô-đun đã nạp (artifact của ta, hoặc bundle gốc). */
  readonly mod: Record<string, unknown>;
  /** Hàm dựng Context của cordis mà bên này nạp. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- hàm dựng Context của cordis
  readonly Context: new () => any;
}

/** Header phiên giả. */
interface Header {
  /** Id phiên. */
  id: string;
  /** Thế hệ định dạng. */
  version: number;
  /** Mốc tạo. */
  createdAt: number;
  /** Thư mục làm việc. */
  cwd?: string;
  /** Cờ tiền tố thừa kế. */
  isSeeded: boolean;
}

/** Phiên giả đúng hình dạng mà sổ chiếu đọc (seq = số sự kiện đã cam kết). */
class FakeSession {
  /** Log trong bộ nhớ, chỉ số mảng TRÙNG seq. */
  readonly events: FakeEvent[] = [];
  /** Metadata bất biến. */
  readonly header: Header;
  /** Độ dài tiền tố thừa kế khi fork. */
  readonly inheritedEventCount: number;
  /** Id phiên (trùng `header.id`). */
  readonly id: string;

  /**
   * Dựng một phiên rỗng.
   * Nhận: header và độ dài tiền tố thừa kế.
   * Trả: phiên có `seq === 0`.
   */
  constructor(header: Header, inheritedEventCount = 0) {
    this.header = header;
    this.id = header.id;
    this.inheritedEventCount = inheritedEventCount;
  }

  /** Số sự kiện đã cam kết — con trỏ của phiên. */
  get seq(): number {
    return this.events.length;
  }

  /**
   * Nối MỘT sự kiện vào log.
   * Nhận: sự kiện cần nối (seq phải bằng độ dài log hiện tại).
   * Trả: không.
   */
  append(event: FakeEvent): void {
    this.events.push(event);
  }

  /**
   * Cắt một đoạn log.
   * Nhận: seq bắt đầu và seq kết thúc KHÔNG tính.
   * Trả: các sự kiện trong khoảng.
   */
  snapshotEvents(fromSeq = 0, toSeqExclusive: number = this.seq): readonly FakeEvent[] {
    return this.events.filter((event) => event.seq >= fromSeq && event.seq < toSeqExclusive);
  }

  /**
   * Tra một sự kiện theo seq.
   * Nhận: seq cần tra.
   * Trả: sự kiện, hoặc `undefined` khi ngoài log.
   */
  eventAt(seq: number): FakeEvent | undefined {
    return this.events[seq];
  }
}

/** Đọc manifest của gói từ đĩa. */
function readManifest(): {
  name: string;
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
  dsh?: unknown;
  gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: { row?: unknown } };
} {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: ReturnType<typeof readManifest>): ReturnType<typeof readManifest> {
  return JSON.parse(JSON.stringify(manifest));
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: ReturnType<typeof readManifest>): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE. */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/**
 * Chạy một lượt gọi và mô tả kết quả thay vì ném — để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi `ok:<json>` hoặc `<name>: <message>`.
 */
function outcome(run: () => unknown): string {
  try {
    return "ok:" + JSON.stringify(run());
  } catch (error) {
    const value = error as { name?: string; message?: string };
    return String(value.name) + ": " + String(value.message);
  }
}


/**
 * Chạy một lượt gọi BẤT ĐỒNG BỘ và mô tả kết quả (kể cả lỗi) — để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi `ok:<json>` hoặc `<name>: <message>`.
 */
async function capture(run: () => Promise<unknown> | unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    const value = error as { name?: string; message?: string };
    return String(value.name) + ": " + String(value.message);
  }
}

/**
 * Dựng một dịch vụ cache ĐÃ ĐĂNG KÝ nhưng CHƯA chạy init (để đo câu lỗi "chưa init" của cả hai bên).
 * Nhận: bên cần dựng.
 * Trả: thể hiện dịch vụ (bảng "sessions" còn undefined).
 */
function makeUninitialized(side: Side): CacheLike {
  const ctx = new side.Context() as Record<string, unknown>;
  const services: Record<string, unknown> = {
    storageDomain: {
      open: async (): Promise<never> => {
        throw new Error("không được mở miền khi chưa init");
      },
    },
    sessions: {
      get: (): undefined => undefined,
      flush: async (): Promise<void> => undefined,
    },
    logger: {
      warn: (): void => undefined,
    },
    sessionProjections: {},
  };
  for (const [name, value] of Object.entries(services)) {
    Object.defineProperty(ctx, name, { value, configurable: true, writable: true });
  }
  const Cache = side.mod.SessionProjectionCache as new (ctx: unknown, config: unknown) => CacheLike;
  return new Cache(ctx, CONFIG);
}

/** Chờ có TRẦN một điều kiện (ca flaky: hẹn giờ tiết lưu) — không bao giờ treo test. */
async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor quá trần " + timeoutMs + "ms");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Xả hết microtask (mọi lượt `put`/`flush` của đường fail-soft đều giải quyết bằng microtask). */
async function drain(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Đơn vị chiếu văn bản: một khoá, một loại sự kiện, trạng thái `{text}`. */
interface TextUnit {
  /** Khoá chiếu. */
  readonly key: string;
  /** Loại sự kiện mà đơn vị này tiêu thụ. */
  readonly eventType: string;
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
  /** Có khung nhìn dây hay không (đơn vị chỉ-host thì không). */
  readonly wire: boolean;
}

/**
 * Dựng một định nghĩa đơn vị chiếu văn bản đúng hình dạng seam.
 * Nhận: khai báo đơn vị.
 * Trả: định nghĩa có `init`/`apply`/`stateSchema` (và `wire` khi cần).
 */
function textDefinition(unit: TextUnit): Record<string, unknown> {
  const stateSchema = {
    parse(value: unknown): { text: string } {
      const candidate = value as { text?: unknown };
      if (typeof candidate?.text !== "string") throw new Error(unit.key + " state must be {text: string}");
      return { text: candidate.text };
    },
  };
  const base: Record<string, unknown> = {
    key: unit.key,
    stateVersion: unit.stateVersion,
    stateSchema,
    init(): { text: string } {
      return { text: "" };
    },
    apply(state: { text: string }, event: FakeEvent): { text: string } {
      if (event.type !== unit.eventType) return state;
      const next = String(event.data ?? "");
      return next === state.text ? state : { text: next };
    },
  };
  if (!unit.wire) return base;
  base.wire = {
    viewSchema: {
      parse(value: unknown): string {
        if (typeof value !== "string") throw new Error(unit.key + " view must be a string");
        return value;
      },
    },
    view(state: { text: string }): string {
      return state.text;
    },
  };
  return base;
}

/** Ba đơn vị dùng chung cho mọi ca A/B: hai đơn vị có khung nhìn và một đơn vị CHỈ HOST. */
const UNITS: readonly TextUnit[] = [
  { key: "title", eventType: "session/title", stateVersion: 1, wire: true },
  { key: "draft", eventType: "session/draft", stateVersion: 1, wire: true },
  { key: "notes", eventType: "session/note", stateVersion: 1, wire: false },
];

/** Kịch bản 6 sự kiện dùng cho mọi ca A/B. */
const SCRIPT: readonly FakeEvent[] = [
  { type: "session/title", seq: 0, data: "A" },
  { type: "session/note", seq: 1, data: "n1" },
  { type: "session/draft", seq: 2, data: "d1" },
  { type: "turn/end", seq: 3 },
  { type: "session/title", seq: 4, data: "B" },
  { type: "session/draft", seq: 5, data: "d2" },
];

/** Header chuẩn của mọi ca. */
const HEADER: Header = { id: "s1", version: 5, createdAt: 1000, cwd: "/repo", isSeeded: false };

/** Mô-đun CỦA TA, mô-đun GỐC, sổ chiếu của kernel và cordis — điền trong `beforeAll`. */
let ourMod: Record<string, unknown>;
/** Bên TA. */
let OURS: Side;
/** Bên GỐC. */
let STOCKED: Side;
/** Symbol `Service.init` của kernel (Symbol.for nên DÙNG CHUNG giữa mọi bản cordis). */
let SERVICE_INIT: symbol;
/** Lớp sổ chiếu của kernel. */
let RegistryClass: new (ctx: unknown) => Record<string, unknown>;

beforeAll(async () => {
  const artifact = await buildPackage(OUT);
  // LƯỢT ĐO 01/11/2026: peer của artifact phải phân giải về KERNEL (KHÔNG phải bản SAO workspace): thiếu
  // `zod` của kernel thì spec miền mở ra khác bản gốc (zod 4.6 bỏ `minValue/maxValue/isInt` trong
  // toJSONSchema), còn lệch `cordis` thì `Service`/`Context` khác danh tính lớp.
  mkdirSync(join(OUT, "node_modules"), { recursive: true });
  symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir"); symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
  symlinkSync(join(REPO, "apps", "host", "node_modules", "zod"), join(OUT, "node_modules", "zod"), "dir");
  ourMod = (await import(pathToFileURL(artifact).href)) as Record<string, unknown>;
  const ourCordis = (await import(pathToFileURL(OUR_CORDIS).href)) as { Context: new () => unknown; Service: { init: symbol } };
  const stockCordis = (await import(pathToFileURL(STOCK_CORDIS).href)) as { Context: new () => unknown; Service: { init: symbol } };
  const stockMod = (await import(pathToFileURL(join(STOCK, "lib", "index.js")).href)) as Record<string, unknown>;
  const registryMod = (await import(pathToFileURL(join(KERNEL, "dsh-session-projection", "lib", "index.js")).href)) as {
    SessionProjectionRegistry: new (ctx: unknown) => Record<string, unknown>;
  };
  SERVICE_INIT = ourCordis.Service.init;
  expect(stockCordis.Service.init).toBe(SERVICE_INIT);
  RegistryClass = registryMod.SessionProjectionRegistry;
  OURS = { name: "ta", mod: ourMod, Context: ourCordis.Context };
  STOCKED = { name: "gốc", mod: stockMod, Context: stockCordis.Context };
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/**
 * Dựng một giàn thử: Context cordis THẬT, ba seam giả (miền lưu trữ · sổ phiên · logger), sổ chiếu THẬT
 * của kernel, rồi dựng dịch vụ cache của bên cần đo và chạy `init`.
 * Nhận: bên cần đo và cấu hình.
 * Trả: giàn thử đã init xong.
 */
async function makeHarness(side: Side, config = CONFIG): Promise<Harness> {
  const ctx = new side.Context() as Harness["ctx"];
  const rec: Recorder = { puts: [], warnings: [], opened: [], flushes: [], closed: 0, failPut: false };
  const table = new Map<string, Record<string, unknown>>();
  const live = new Map<string, unknown>();
  const handle = {
    get: (key: string): Record<string, unknown> | undefined => table.get(key),
    put: async (key: string, value: Record<string, unknown>): Promise<void> => {
      if (rec.failPut) throw new Error("medium hỏng");
      rec.puts.push({ key, value });
      table.set(key, value);
    },
  };
  const storageDomain = {
    open: async (spec: Record<string, unknown>): Promise<Record<string, unknown>> => {
      rec.opened.push(spec);
      return {
        close: (): void => {
          rec.closed += 1;
        },
        table: (name: string): unknown => {
          if (name !== "sessions") throw new Error("tên bảng lạ: " + name);
          return handle;
        },
      };
    },
  };
  const sessions = {
    get: (id: string): unknown => live.get(id),
    flush: async (session: { id: string }): Promise<void> => {
      rec.flushes.push(session.id);
    },
  };
  const logger = { warn: (message: string): void => void rec.warnings.push(message) };
  Object.defineProperty(ctx, "storageDomain", { value: storageDomain, configurable: true, writable: true });
  Object.defineProperty(ctx, "sessions", { value: sessions, configurable: true, writable: true });
  Object.defineProperty(ctx, "logger", { value: logger, configurable: true, writable: true });
  const registry = new RegistryClass(ctx);
  Object.defineProperty(ctx, "sessionProjections", { value: registry, configurable: true, writable: true });
  for (const unit of UNITS) (registry.register as (definition: unknown) => void)(textDefinition(unit));
  const Cache = side.mod.SessionProjectionCache as new (ctx: unknown, config: unknown) => Harness["cache"];
  const cache = new Cache(ctx, config);
  const init = (cache as unknown as Record<symbol, (() => Promise<void>) | undefined>)[SERVICE_INIT];
  if (init === undefined) throw new Error("artifact thiếu phương thức [Service.init]");
  await init.call(cache);
  return { ctx, cache, registry, rec, table, live };
}

/**
 * Chạy kịch bản chuẩn trên một giàn: tạo phiên (đăng ký sống), rồi lái từng sự kiện.
 * Nhận: giàn thử.
 * Trả: phiên đã lái xong.
 */
function runScript(harness: Harness): FakeSession {
  const session = new FakeSession(HEADER);
  harness.live.set(session.id, session);
  harness.ctx.emit("session/created", session);
  for (const event of SCRIPT) {
    session.append(event);
    harness.ctx.emit("session/event", session, event);
  }
  return session;
}

/**
 * Gieo một bản ghi THẲNG vào bảng của cả hai bên (để đo các quy tắc nhân dạng mà không phải dựng log).
 * Nhận: giàn thử và bản ghi cần gieo.
 * Trả: không.
 */
function seed(harness: Harness, record: Record<string, unknown>): void {
  harness.table.set("s1", record);
}

/** Một dòng checkpoint dựng tay. */
function row(ver: number, seq: number, val: unknown): Record<string, unknown> {
  return { ver, seq, val };
}
describe("bước 0 — cặp row trong oracle dump + hình dạng gói gốc", () => {
  test("ca 0a: cặp '- id: session-projection-cache' + name gốc CÓ THẬT trong ours.yml MỚI NHẤT, ĐANG BẬT, config hai khoá", () => {
    const dumps = join(REPO, ".parity", "dumps");
    expect(existsSync(dumps)).toBe(true);
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .at(-1);
    expect(newest).toBeDefined();
    const yml = readFileSync(join(dumps, newest as string, "ours.yml"), "utf8").split("\n");
    const at = yml.findIndex((line) => line.trim() === "- id: session-projection-cache");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(yml[at + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-session-projection-cache'");
    // CONFIG GỐC (đọc từ ours.yml ĐANG CHẠY, KHÔNG từ oracleA_nopatch): hai scalar thuần.
    expect(yml[at + 2]?.trim()).toBe("config:");
    expect(yml[at + 3]?.trim()).toBe("writeEveryEvents: 200");
    expect(yml[at + 4]?.trim()).toBe("writeIntervalMs: 5000");
    // HÌNH DẠNG GỐC: KHÔNG `inject:` và KHÔNG `!!js` (nên không có ctx.<X> nào cần inject).
    const end = yml.findIndex((line, index) => index > at && line.startsWith("- "));
    const rowText = yml.slice(at, end < 0 ? yml.length : end).join("\n");
    expect(rowText.includes("inject:")).toBe(false);
    expect(rowText.includes("!!js")).toBe(false);
    expect(rowText.includes("disabled:")).toBe(false);
  });
  test("ca 0b: gói MỘT MẶT — lib/client.js KHÔNG tồn tại, cả hai manifest KHÔNG có dsh.client", () => {
    expect(existsSync(join(STOCK, "lib", "client.js"))).toBe(false);
    const stockManifest = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { dsh?: unknown };
    expect(stockManifest.dsh).toBeUndefined();
    expect(readManifest().dsh).toBeUndefined();
    expect(existsSync(join(PKG, "src", "client.ts"))).toBe(false);
  });
  test("ca 0c: hình dạng khai báo row do LEAD thêm NGOÀI phiên viết gói (đọc CẢ HAI dạng) + peers/exports", () => {
    const manifest = readManifest();
    // `gbh.row` do LEAD khai ngoài phiên này (patch đã sinh cặp disable+insert). Gỡ mount thì khoá
    // chuyển sang `gbh.row_unmounted_ly_do.row` ⇒ đọc CẢ HAI dạng (mẫu recipe mục 7).
    const row = (manifest.gbh?.row ?? manifest.gbh?.row_unmounted_ly_do?.row) as Record<string, unknown> | undefined;
    expect(row).toEqual({
      id: "session-projection-cache",
      config: { writeEveryEvents: 200, writeIntervalMs: 5000 },
      tests: ["tests/host/session-projection-cache.test.ts"],
    });
    // `config` BẰNG ĐÚNG config gốc ở ca 0a (không thêm/bớt khoá), và row MỘT MẶT ⇒ không id module.
    expect(Object.keys((row?.config ?? {}) as Record<string, unknown>)).toEqual(["writeEveryEvents", "writeIntervalMs"]);
    expect(row?.moduleIds).toBeUndefined();
    expect(row?.aliases).toBeUndefined();
    expect(manifest.gbh?.peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-util-values",
      "zod",
    ]);
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-session-projection-cache");
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    // Peer KHÔNG được nằm ở `dependencies` (tạo thể hiện thứ hai).
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
  });
  test("ca 0d: gbh.peers ⊆ peerDependencies — so PHẦN TỬ, có ĐỐI CHỨNG ÂM", () => {
    const manifest = readManifest();
    expect(manifest.gbh?.peers?.length).toBeGreaterThan(0);
    expect(missingPeers(manifest)).toEqual([]);
    // ĐỐI CHỨNG ÂM 1: xoá MỘT tên khỏi peerDependencies ⇒ phép kiểm PHẢI bắt được.
    const removed = cloneManifest(manifest);
    delete removed.peerDependencies?.["@deepseek-ai/dsh-util-values"];
    expect(missingPeers(removed)).toEqual(["@deepseek-ai/dsh-util-values"]);
    // ĐỐI CHỨNG ÂM 2: CÙNG SỐ LƯỢNG nhưng lệch phần tử ⇒ so số lượng sẽ ĐẠT oan, so phần tử mới đúng.
    const sameCount = cloneManifest(manifest);
    delete sameCount.peerDependencies?.zod;
    if (sameCount.peerDependencies !== undefined) sameCount.peerDependencies["left-pad"] = "1.0.0";
    expect(Object.keys(sameCount.peerDependencies ?? {}).length).toBe(Object.keys(manifest.peerDependencies ?? {}).length);
    expect(missingPeers(sameCount)).toEqual(["zod"]);
    // Thừa tên trong peerDependencies vẫn ĐẠT — quy ước là ⊆, KHÔNG phải =.
    const extra = cloneManifest(manifest);
    if (extra.peerDependencies !== undefined) extra.peerDependencies["@deepseek-ai/dsh-session"] = "0.2.1-alpha.4";
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("ARTIFACT — khuôn bundle, tập export và locale", () => {
  test("ca 1: tập export ta = tập export gốc (đo trên văn bản lib/index.js đã build)", () => {
    const artifact = readFileSync(join(OUT, "index.js"), "utf8");
    const ours = exportNames(artifact);
    const theirs = exportNames(readFileSync(join(STOCK, "lib", "index.js"), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      "Config",
      "SessionProjectionCache",
      "checkpointIdentity",
      "checkpointRecord",
      "checkpointRow",
      "default",
      "projectionCacheDomainSpec",
    ]);
    // LUẬT: bundle KHÔNG đăng ký id của gói gốc và KHÔNG có bộ nạp module (row host-only).
    expect(artifact.split("id: @deepseek-ai").length - 1).toBe(0);
    expect(artifact.includes("__ModuleLoader__")).toBe(false);
    // export default LÀ CHÍNH lớp (kernel nạp row theo export này).
    expect(ourMod.default).toBe(ourMod.SessionProjectionCache);
    expect(STOCKED.mod.default).toBe(STOCKED.mod.SessionProjectionCache);
    // build.ts nhận outDir qua process.argv[2] (thiếu ⇒ profile không có lib ⇒ không sinh entry).
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });
  test("ca 2: locale/{en,zh}.json CHÉP BYTE-FOR-BYTE từ bản gốc (luật 000e)", () => {
    const shas: Record<string, string> = {};
    for (const name of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", name), "utf8");
      const theirs = readFileSync(join(STOCK, "locale", name), "utf8");
      expect(ours).toBe(theirs);
      shas[name] = sha256(ours);
    }
    expect(shas["en.json"]).toBe("80cf67ef9bc0ee7e41314ff72dcbf90e0ed6595a1cfb33f9387886ea19800b57");
    expect(shas["zh.json"]).toBe("ec17f39ff8a9a4eb67e57db5780a12154bfe3ec0c3c7cd7b15250b3fa203e786");
  });
  test("ca 3: nguồn KHÔNG import gói NGOÀI bảng §3b và KHÔNG khai ambient declare module (luật 000d)", () => {
    const files = readdirSync(join(PKG, "src")).filter((name) => name.endsWith(".ts"));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const name of files) {
      const text = readFileSync(join(PKG, "src", name), "utf8");
      // Ba gói này nằm NGOÀI bảng peer §3b ⇒ không được import; bề mặt của chúng khai theo CẤU TRÚC.
      expect(text).not.toContain('from "@deepseek-ai/dsh-session"');
      expect(text).not.toContain('from "@deepseek-ai/dsh-session-projection"');
      expect(text).not.toContain('from "@deepseek-ai/dsh-storage-domain"');
      // Chỉ một declare module được phép: MERGE Context của cordis (không phải shim một module thật).
      for (const match of text.matchAll(/declare module "([^"]+)"/g)) expect(match[1]).toBe("@deepseek-ai/cordis");
    }
  });
});
describe("A/B miền, schema và Config với chính gói gốc", () => {
  /** Hình dạng so được của một spec miền. */
  const domainShape = (spec: Record<string, any>): Record<string, unknown> => ({
    name: spec.name,
    version: spec.version,
    compatibleVersions: [...(spec.compatibleVersions ?? [])],
    invalidRecords: spec.invalidRecords,
    layout: spec.layout,
    tables: Object.keys(spec.tables),
    tableKeys: Object.keys(spec.tables.sessions),
  });
  test("ca 4: spec miền khớp TỪNG TRƯỜNG và defineDomain khớp TỪNG CÂU LỖI", async () => {
    const ours = ourMod.projectionCacheDomainSpec as Record<string, any>;
    const theirs = STOCKED.mod.projectionCacheDomainSpec as Record<string, any>;
    expect(domainShape(ours)).toEqual(domainShape(theirs));
    expect(domainShape(ours)).toEqual({
      name: "session_projcache",
      version: 7,
      compatibleVersions: [3, 4, 5, 6],
      invalidRecords: "backup-and-skip",
      layout: "per-record",
      tables: ["sessions"],
      tableKeys: ["valueSchema"],
    });
    const ourDomain = (await import(pathToFileURL(join(PKG, "src", "domain.ts")).href)) as {
      defineDomain(spec: unknown): unknown;
    };
    const stockDomain = (await import(pathToFileURL(join(KERNEL, "dsh-storage-domain", "lib", "index.js")).href)) as {
      defineDomain(spec: unknown): unknown;
    };
    const specs: Record<string, unknown>[] = [
      { name: "ok_domain", version: 7, tables: {} },
      { name: "Bad", version: 7, tables: {} },
      { name: "ok", version: -1, tables: {} },
      { name: "ok", version: 1.5, tables: {} },
      { name: "ok", version: 7, compatibleVersions: [7], tables: {} },
      { name: "ok", version: 7, compatibleVersions: [-1], tables: {} },
      { name: "ok", version: 7, layout: "weird", tables: {} },
      { name: "ok", version: 7, invalidRecords: "ignore", tables: {} },
      { name: "ok", version: 7, tables: { Bad: { valueSchema: {} } } },
      { name: "ok", version: 7, tables: {}, global: { schema: { safeParse: () => ({ success: true }) } } },
      { name: "ok", version: 7, tables: {}, global: { schema: { safeParse: () => ({ success: false }) } } },
    ];
    for (const spec of specs) {
      expect(outcome(() => ourDomain.defineDomain(spec))).toBe(outcome(() => stockDomain.defineDomain(spec)));
    }
  });
  test("ca 5: schema bản ghi — cùng chấp nhận/từ chối, cùng issues, cùng phép biến đổi seq", () => {
    const ours = ourMod.projectionCacheDomainSpec as Record<string, any>;
    const theirs = STOCKED.mod.projectionCacheDomainSpec as Record<string, any>;
    const ourSchema = ours.tables.sessions.valueSchema as Record<string, any>;
    const stockSchema = theirs.tables.sessions.valueSchema as Record<string, any>;
    const identity = { formatVersion: 5, createdAt: 1000, cwd: "/repo", isSeeded: false, inheritedEventCount: 0 };
    const describe = (result: Record<string, any>): unknown =>
      result.success === true
        ? { ok: result.data }
        : { fail: result.error.issues.map((issue: Record<string, any>) => [issue.code, issue.path.join("."), issue.message]) };
    const cases: unknown[] = [
      { identity, rows: { title: row(1, -1, null) } },
      { identity, rows: { title: row(1, 0, { text: "x" }), notes: row(2, 3, [1, true, "y"]) } },
      { identity: { createdAt: 1000 }, rows: {} },
      { identity: {}, rows: {} },
      { identity: { createdAt: -1 }, rows: {} },
      { identity: { createdAt: 1, formatVersion: 1.5 }, rows: {} },
      { identity, rows: { title: row(-1, 0, {}) } },
      { identity, rows: { title: row(1, -2, {}) } },
      { identity, rows: { title: row(1.5, 0, {}) } },
      { identity, rows: { title: { ver: 1, seq: 0 } } },
      { identity, rows: { title: row(1, 0, undefined) } },
      { identity, rows: { title: row(1, 0, Number.NaN) } },
      { identity, rows: { title: row(1, 0, { nested: { deep: [1, 2] } }) } },
      { identity, rows: [] },
    ];
    for (const value of cases) {
      expect(describe(ourSchema.safeParse(value))).toEqual(describe(stockSchema.safeParse(value)));
    }
    // seq là SỐ ĐỒNG NHẤT sau transform, kể cả nhánh -1 (brand của kernel là hàm đồng nhất).
    const parsedOurs = ourSchema.parse({ identity, rows: { title: row(1, 4, { text: "x" }) } }) as Record<string, any>;
    const parsedStock = stockSchema.parse({ identity, rows: { title: row(1, 4, { text: "x" }) } }) as Record<string, any>;
    expect(parsedOurs.rows.title.seq).toBe(4);
    expect(parsedOurs).toEqual(parsedStock);
    // Ba schema con cũng phải khớp nhau khi gọi TRỰC TIẾP (bản gốc export chúng).
    for (const key of ["checkpointRow", "checkpointIdentity", "checkpointRecord"]) {
      const a = ourMod[key] as Record<string, any>;
      const b = STOCKED.mod[key] as Record<string, any>;
      for (const value of cases) expect(describe(a.safeParse(value))).toEqual(describe(b.safeParse(value)));
    }
  });
  test("ca 6: Config — cùng giá trị hợp lệ, cùng câu lỗi; lớp giữ ĐÚNG schema và ĐÚNG danh sách inject", () => {
    const ourConfig = ourMod.Config as (value: unknown) => unknown;
    const stockConfig = STOCKED.mod.Config as (value: unknown) => unknown;
    const cases: unknown[] = [
      { writeEveryEvents: 200, writeIntervalMs: 5000 },
      { writeEveryEvents: 1, writeIntervalMs: 1 },
      { writeEveryEvents: 0, writeIntervalMs: 5000 },
      { writeEveryEvents: 200, writeIntervalMs: 0 },
      { writeEveryEvents: 1.5, writeIntervalMs: 5000 },
      { writeEveryEvents: -2, writeIntervalMs: 5000 },
      { writeEveryEvents: "200", writeIntervalMs: 5000 },
      { writeEveryEvents: 200 },
      {},
      undefined,
    ];
    for (const value of cases) {
      expect(outcome(() => ourConfig(value))).toBe(outcome(() => stockConfig(value)));
    }
    expect((ourMod.SessionProjectionCache as Record<string, any>).Config).toBe(ourMod.Config);
    expect((ourMod.SessionProjectionCache as Record<string, any>).inject).toEqual(["storageDomain", "sessionProjections", "sessions"]);
    expect((STOCKED.mod.SessionProjectionCache as Record<string, any>).inject).toEqual([
      "storageDomain",
      "sessionProjections",
      "sessions",
    ]);
  });
});
describe("A/B hành vi trên Context cordis THẬT", () => {
  test("ca 7: write() — cùng bản ghi đã lưu, cùng thứ tự flush, cùng spec miền đã mở", async () => {
    const a = await makeHarness(OURS);
    const b = await makeHarness(STOCKED);
    const sa = runScript(a);
    const sb = runScript(b);
    // Kịch bản có HAI mốc bắt buộc (tạo phiên + turn/end) ⇒ hai lượt ghi nền đã xong sau khi xả microtask.
    await drain();
    const before = a.rec.puts.length;
    expect(before).toBe(2);
    expect(b.rec.puts).toEqual(a.rec.puts);
    await a.cache.write(sa);
    await b.cache.write(sb);
    expect(a.rec.puts).toEqual(b.rec.puts);
    expect(a.rec.puts).toHaveLength(before + 1);
    expect(a.rec.flushes).toEqual(b.rec.flushes);
    expect(a.rec.flushes.length).toBeGreaterThanOrEqual(1);
    expect(a.rec.flushes.every((id) => id === "s1")).toBe(true);
    expect(a.rec.puts.at(-1)?.key).toBe("s1");
    expect(a.rec.puts.at(-1)?.value).toEqual({
      identity: { formatVersion: 5, createdAt: 1000, cwd: "/repo", isSeeded: false, inheritedEventCount: 0 },
      rows: {
        title: { ver: 1, seq: 5, val: { text: "B" } },
        draft: { ver: 1, seq: 5, val: { text: "d2" } },
        notes: { ver: 1, seq: 5, val: { text: "n1" } },
      },
    });
    // Miền được mở ĐÚNG MỘT LẦN, cùng spec ở cả hai bên.
    expect(a.rec.opened).toHaveLength(1);
    expect(JSON.stringify(a.rec.opened)).toBe(JSON.stringify(b.rec.opened));
  });
  test("ca 8: cachedSnapshot/cachedPredecessorTitle — CÙNG quyết định trên 9 bản ghi dựng tay", async () => {
    const a = await makeHarness(OURS);
    const b = await makeHarness(STOCKED);
    const current = { formatVersion: 5, createdAt: 1000, cwd: "/repo", isSeeded: false, inheritedEventCount: 0 };
    const rows = { title: row(1, 4, { text: "T" }), draft: row(1, 2, { text: "D" }), notes: row(1, 1, { text: "N" }) };
    const records: Record<string, unknown>[] = [
      { identity: current, rows },
      { identity: { ...current, formatVersion: 4 }, rows },
      { identity: { ...current, formatVersion: 6 }, rows },
      { identity: { createdAt: 1000, cwd: "/repo", isSeeded: false }, rows },
      { identity: { ...current, createdAt: 999 }, rows },
      { identity: { ...current, cwd: "/khac" }, rows },
      { identity: { ...current, isSeeded: true }, rows },
      { identity: { ...current, inheritedEventCount: 3 }, rows },
      { identity: current, rows: { title: row(2, 4, { text: "T" }), draft: row(1, 2, { text: "D" }) } },
      { identity: current, rows: {} },
    ];
    for (const record of records) {
      seed(a, record);
      seed(b, record);
      expect(a.cache.cachedSnapshot(HEADER)).toEqual(b.cache.cachedSnapshot(HEADER));
      expect(a.cache.cachedPredecessorTitle(HEADER)).toEqual(b.cache.cachedPredecessorTitle(HEADER));
    }
    // Ba kết quả then chốt, ghi rõ để người sau khỏi đoán:
    seed(a, { identity: current, rows });
    seed(b, { identity: current, rows });
    const block = a.cache.cachedSnapshot(HEADER);
    expect(block).toEqual({ asOfSeq: 2, values: { title: "T", draft: "D" } });
    expect(a.cache.cachedPredecessorTitle(HEADER)).toBeUndefined();
    seed(a, { identity: { ...current, formatVersion: 4 }, rows });
    seed(b, { identity: { ...current, formatVersion: 4 }, rows });
    expect(a.cache.cachedSnapshot(HEADER)).toBeUndefined();
    expect(a.cache.cachedPredecessorTitle(HEADER)).toEqual({ asOfSeq: 4, values: { title: "T" } });
    expect(a.cache.cachedPredecessorTitle(HEADER)).toEqual(b.cache.cachedPredecessorTitle(HEADER));
  });
  test("ca 9: hydratePrepared — nhánh mồi được và nhánh LÙI về nạp từ đầu khi dòng hỏng", async () => {
    const a = await makeHarness(OURS);
    const b = await makeHarness(STOCKED);
    const events = SCRIPT;
    const current = { formatVersion: 5, createdAt: 1000, cwd: "/repo", isSeeded: false, inheritedEventCount: 0 };
    // (1) dòng DÙNG ĐƯỢC: giá trị mồi THẮNG giá trị gộp (đúng ngữ nghĩa "đã gộp tới seq đó").
    const good = { title: row(1, 5, { text: "MỒI" }), draft: row(1, 5, { text: "d2" }) };
    seed(a, { identity: current, rows: good });
    seed(b, { identity: current, rows: good });
    const seededA = a.cache.hydratePrepared(new FakeSession(HEADER), events);
    const seededB = b.cache.hydratePrepared(new FakeSession(HEADER), events);
    expect(seededA).toEqual(seededB);
    expect(seededA.values.title).toBe("MỒI");
    // (2) dòng HỎNG schema trạng thái: bản gốc NUỐT lỗi và nạp LẠI TỪ ĐẦU ⇒ ra giá trị gộp thật.
    const broken = { title: row(1, 5, { text: 42 }), draft: row(1, 5, { text: "d2" }) };
    seed(a, { identity: current, rows: broken });
    seed(b, { identity: current, rows: broken });
    const fallbackA = a.cache.hydratePrepared(new FakeSession(HEADER), events);
    const fallbackB = b.cache.hydratePrepared(new FakeSession(HEADER), events);
    expect(fallbackA).toEqual(fallbackB);
    expect(fallbackA.values.title).toBe("B");
    // (3) KHÔNG có bản ghi ⇒ nạp từ đầu, hai bên bằng nhau.
    a.table.clear();
    b.table.clear();
    expect(a.cache.hydratePrepared(new FakeSession(HEADER), events)).toEqual(
      b.cache.hydratePrepared(new FakeSession(HEADER), events),
    );
  });
  test("ca 10: coldSnapshot — cùng phép cắt, cùng lượt GHI LẠI, và cùng cảnh báo khi ghi lại hỏng", async () => {
    const a = await makeHarness(OURS);
    const b = await makeHarness(STOCKED);
    const current = { formatVersion: 5, createdAt: 1000, cwd: "/repo", isSeeded: false, inheritedEventCount: 0 };
    const rows = { title: row(1, -1, { text: "S" }) };
    seed(a, { identity: current, rows });
    seed(b, { identity: current, rows });
    const coldA = a.cache.coldSnapshot(HEADER, 0, SCRIPT);
    const coldB = b.cache.coldSnapshot(HEADER, 0, SCRIPT);
    expect(coldA).toEqual(coldB);
    expect(coldA.values.title).toBe("B");
    await drain();
    expect(a.rec.puts).toEqual(b.rec.puts);
    expect(a.rec.puts).toHaveLength(1);
    // Đường fail-soft của lượt ghi lại: medium hỏng ⇒ CÙNG một câu cảnh báo, phép cắt vẫn trả về.
    const failingA = await makeHarness(OURS);
    const failingB = await makeHarness(STOCKED);
    failingA.rec.failPut = true;
    failingB.rec.failPut = true;
    expect(failingA.cache.coldSnapshot(HEADER, 0, SCRIPT)).toEqual(failingB.cache.coldSnapshot(HEADER, 0, SCRIPT));
    await drain();
    expect(failingA.rec.warnings).toEqual(failingB.rec.warnings);
    expect(failingA.rec.warnings[0]).toContain("cold-read write-back for \"s1\" failed (cache stays stale)");
  });
  test("ca 11: tiết lưu — mốc bắt buộc (tạo · turn/end · đóng) và hai ngưỡng, cùng số lượt ghi", async () => {
    const config = { writeEveryEvents: 2, writeIntervalMs: 60_000 };
    const a = await makeHarness(OURS, config);
    const b = await makeHarness(STOCKED, config);
    const run = async (h: Harness): Promise<void> => {
      const session = new FakeSession(HEADER);
      h.live.set(session.id, session);
      h.ctx.emit("session/created", session); // mốc bắt buộc: create
      await drain();
      session.append({ type: "session/title", seq: 0, data: "A" });
      h.ctx.emit("session/event", session, session.events[0]); // pending 1
      await drain();
      session.append({ type: "session/title", seq: 1, data: "B" });
      h.ctx.emit("session/event", session, session.events[1]); // pending 2 ⇒ count threshold
      await drain();
      session.append({ type: "turn/end", seq: 2 });
      h.ctx.emit("session/event", session, session.events[2]); // mốc bắt buộc: turn/end
      await drain();
      h.ctx.emit("session/disposed", session); // mốc bắt buộc: detach
      await drain();
      session.append({ type: "session/title", seq: 3, data: "C" });
      h.ctx.emit("session/event", session, session.events[3]); // sau khi đóng: chỉ đếm lại
      await drain();
    };
    await run(a);
    await run(b);
    expect(a.rec.puts.length).toBe(b.rec.puts.length);
    expect(a.rec.puts.map((entry) => entry.value)).toEqual(b.rec.puts.map((entry) => entry.value));
    expect(a.rec.puts).toHaveLength(4);
    expect(a.rec.warnings).toEqual(b.rec.warnings);
    expect(a.rec.warnings).toHaveLength(0);
  });
  test("ca 12: ngưỡng THỜI GIAN — hẹn giờ tiết lưu bắn sau writeIntervalMs (chờ có TRẦN, không treo)", async () => {
    const config = { writeEveryEvents: 200, writeIntervalMs: 10 };
    const a = await makeHarness(OURS, config);
    const b = await makeHarness(STOCKED, config);
    const fire = async (h: Harness): Promise<void> => {
      const session = new FakeSession(HEADER);
      h.live.set(session.id, session);
      h.ctx.emit("session/created", session);
      await drain();
      session.append({ type: "session/title", seq: 0, data: "A" });
      h.ctx.emit("session/event", session, session.events[0]);
      await waitFor(() => h.rec.puts.length >= 2, 2000);
    };
    await fire(a);
    await fire(b);
    expect(a.rec.puts).toHaveLength(2);
    expect(b.rec.puts).toHaveLength(2);
    expect(a.rec.puts[1]?.value).toEqual(b.rec.puts[1]?.value);
    expect(a.rec.warnings).toEqual([]);
  });
  test("ca 13: đường LỖI — cùng lớp và cùng CÂU: trạng thái không phải JSON · nhân dạng chưa gieo · chưa init", async () => {
    const run = async (side: Side): Promise<string[]> => {
      const h = await makeHarness(side);
      // Một đơn vị có trạng thái CHỨA `undefined` ⇒ phép chụp JSON KHÔNG MẤT MÁT phải thất bại.
      (h.registry.register as (definition: unknown) => void)({
        key: "broken",
        stateVersion: 1,
        stateSchema: {
          parse(value: unknown): unknown {
            return value;
          },
        },
        init(): { bad?: unknown } {
          return { bad: undefined };
        },
        apply(state: unknown): unknown {
          return state;
        },
      });
      const messages: string[] = [];
      // (a) trạng thái đơn vị không phải JSON thuần ⇒ TypeError cùng câu với bản gốc.
      messages.push(await capture(() => h.cache.write(new FakeSession(HEADER))));
      // (b) phiên CHƯA gieo mà mang tiền tố thừa kế ⇒ nhân dạng đầy đủ từ chối.
      messages.push(await capture(() => h.cache.write(new FakeSession(HEADER, 3))));
      // (c) dịch vụ CHƯA init ⇒ chưa có bảng (đúng câu của bản gốc).
      messages.push(await capture(() => makeUninitialized(side).cachedSnapshot(HEADER)));
      return messages;
    };
    const ours = await run(OURS);
    const theirs = await run(STOCKED);
    expect(ours).toEqual(theirs);
    expect(ours[0]).toBe("TypeError: projection checkpoint is not losslessly JSON-serializable (a unit state violates the plain-JSON contract)");
    expect(ours[1]).toBe("Error: unseeded projection-cache identity inherited event count must be 0");
    expect(ours[2]).toBe("Error: session projection cache is not initialized");
  });
  test("ca 14: SessionSeq/SessionLogOffset — cùng phép kiểm và cùng CÂU với kernel (7 dạng × 2 hàm)", async () => {
    const ourBrand = (await import(pathToFileURL(join(PKG, "src", "brand.ts")).href)) as Record<string, (value: number) => number>;
    const kernel = (await import(pathToFileURL(join(KERNEL, "dsh-session", "lib", "index.js")).href)) as Record<string, (value: number) => number>;
    const values = [0, 5, -1, 1.5, Number.MAX_SAFE_INTEGER + 2, -0, Number.NaN];
    for (const fn of ["SessionSeq", "SessionLogOffset"]) {
      for (const value of values) {
        expect(outcome(() => ourBrand[fn]?.(value))).toBe(outcome(() => kernel[fn]?.(value)));
      }
    }
    expect(ourBrand.SessionSeq?.(7)).toBe(7); // hàm ĐỒNG NHẤT: giá trị đi qua KHÔNG đổi
  });
  test("ca 15: C6 — DANH TÍNH (không phải so sâu): sổ bẩn, trạng thái bẩn, bản ghi đã ghi, và nhân dạng", async () => {
    const a = await makeHarness(OURS);
    const b = await makeHarness(STOCKED);
    type WithDirty = { dirty: Map<unknown, unknown>; config: unknown };
    const dirtyA = (a.cache as unknown as WithDirty).dirty;
    const dirtyB = (b.cache as unknown as WithDirty).dirty;
    expect(dirtyA).not.toBe(dirtyB); // HAI lần cài ⇒ HAI sổ độc lập
    const one = new FakeSession(HEADER);
    a.ctx.emit("session/event", one, { type: "session/title", seq: 0, data: "A" });
    expect(dirtyA.size).toBe(1);
    expect(dirtyB.size).toBe(0); // sửa bên này KHÔNG lan bên kia
    const two = new FakeSession({ ...HEADER, id: "s2" });
    a.ctx.emit("session/event", two, { type: "session/title", seq: 0, data: "B" });
    expect(dirtyA.get(one)).not.toBe(dirtyA.get(two)); // HAI vật thể trạng thái RIÊNG trong CÙNG cache
    const live = new FakeSession(HEADER);
    a.ctx.emit("session/created", live);
    await drain();
    await a.cache.write(live);
    await a.cache.write(live);
    const lastTwo = a.rec.puts.slice(-2);
    expect(lastTwo[0]?.value).toEqual(lastTwo[1]?.value);
    expect(lastTwo[0]?.value).not.toBe(lastTwo[1]?.value); // bản ghi là bản sao TÁCH RỜI
    type Rows = { rows: Record<string, { val: { text: string } } | undefined> };
    const firstRecord = lastTwo[0]?.value as unknown as Rows;
    const secondRecord = lastTwo[1]?.value as unknown as Rows;
    if (firstRecord.rows.title !== undefined) firstRecord.rows.title.val.text = "SỬA";
    expect(secondRecord.rows.title?.val.text).toBe("");
    const identityMod = (await import(pathToFileURL(join(PKG, "src", "identity.ts")).href)) as {
      lifecycleIdentityOf(header: unknown): { createdAt: number };
    };
    const firstIdentity = identityMod.lifecycleIdentityOf(HEADER);
    const secondIdentity = identityMod.lifecycleIdentityOf(HEADER);
    expect(firstIdentity).not.toBe(secondIdentity); // object MỚI mỗi lần gọi
    firstIdentity.createdAt = 1;
    expect(secondIdentity.createdAt).toBe(1000);
    // Cấu hình DÙNG CHUNG một tham chiếu là hành vi CỦA BẢN GỐC — đo cả hai bên, không 'sửa' nó.
    const config = { writeEveryEvents: 5, writeIntervalMs: 5 };
    const oursShared = await makeHarness(OURS, config);
    const stockShared = await makeHarness(STOCKED, config);
    expect((oursShared.cache as unknown as WithDirty).config).toBe(config);
    expect((stockShared.cache as unknown as WithDirty).config).toBe(config);
  });
});
