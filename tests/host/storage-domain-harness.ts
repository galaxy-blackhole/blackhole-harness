/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giàn THẬT dùng chung cho test `storage-domain`: Context cordis thật + plugin kho của ta + backend
 *      giả ghi lại từng lượt gọi, cộng bốn kịch bản A/B (bảng · global · ma trận lỗi · backup-and-skip).
 *      Tách khỏi file test để mỗi file ≤ 1000 dòng (luật repo).
 */
import { join } from "node:path";

import { Storage } from "../../packages/host/storage/src/index.ts";
import { z as zod } from "../../apps/host/node_modules/zod/index.js";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với kernel. */
const OUR_CORDIS = join(REPO, "packages", "host", "storage-domain", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Kiểu mô-đun động (hai bên đều là ESM đã build). */
export type Mod = Record<string, any>;

/** Context cordis THẬT dùng cho CẢ HAI bên (cùng một tệp kernel). */
export const cordis = (await import(OUR_CORDIS)) as { Context: new () => any };

/** Trần chờ mặc định cho các phép chờ trạng thái (ms) — KHÔNG bao giờ chờ vô hạn. */
export const WAIT_CEILING_MS = 3000;

/**
 * Chờ tới khi điều kiện đúng, có TRẦN thời gian.
 * Nhận: hàm kiểm, nhãn để báo lỗi, và trần (ms).
 * Trả: promise phân giải khi điều kiện đúng; NÉM khi hết trần.
 */
export async function waitFor(check: () => boolean, label: string, timeoutMs = WAIT_CEILING_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("waitFor hết trần " + timeoutMs + "ms: " + label);
}

/**
 * Mô tả một lỗi (hoặc "(khong nem)") để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi JSON `{name, code, message, detail}`.
 */
export function errorOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; code?: string; message?: string; detail?: unknown };
    return JSON.stringify({ name: subject.name, code: subject.code, message: subject.message, detail: subject.detail });
  }
}

/**
 * Mô tả một lỗi BẤT ĐỒNG BỘ (promise bị từ chối) để so hai bên.
 * Nhận: promise cần chạy.
 * Trả: promise của chuỗi mô tả như {@link errorOf}.
 */
export async function rejectionOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; code?: string; message?: string; detail?: unknown };
    return JSON.stringify({ name: subject.name, code: subject.code, message: subject.message, detail: subject.detail });
  }
}

/** Bản ghi đã lưu mà backend giả phục vụ cho một lượt `loadAll`. */
export interface UnitSeed {
  /** Bản ghi theo bảng. */
  readonly tables?: Record<string, Record<string, unknown>>;
  /** Ô singleton toàn cục; `null`/vắng = "chưa từng ghi". */
  readonly global?: unknown;
}

/** Một đơn vị backend GIẢ: ghi lại mọi lượt gọi để hai bên so được từng bước. */
export interface FakeUnit {
  /** Các lượt `putRecord`, dạng `bảng/khoá=JSON`. */
  readonly puts: string[];
  /** Các lượt `deleteRecord`, dạng `bảng/khoá`. */
  readonly deletes: string[];
  /** Các lượt `setGlobal`, dạng JSON. */
  readonly globals: string[];
  /** Các lượt `backupRecord`, dạng `bảng/khoá`. */
  readonly backups: string[];
  /** Số lượt `close`. */
  closes: number;
  /** `loadAll` của hợp đồng. */
  loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }>;
  /** `putRecord` của hợp đồng. */
  putRecord(table: string, key: string, value: unknown): Promise<void>;
  /** `deleteRecord` của hợp đồng. */
  deleteRecord(table: string, key: string): Promise<void>;
  /** `setGlobal` của hợp đồng. */
  setGlobal(value: unknown): Promise<void>;
  /** `backupRecord` của hợp đồng (chỉ có khi bật). */
  backupRecord?: (table: string, key: string) => Promise<string>;
  /** `close` của hợp đồng đơn vị. */
  close(): Promise<void>;
}

/** Một backend GIẢ của kho, mang facet `kv` và bộ ghi. */
export interface FakeBackend {
  /** Mô tả nhận được ở mỗi lượt `open`. */
  readonly descriptors: any[];
  /** Các đơn vị đã mở, theo thứ tự. */
  readonly units: FakeUnit[];
  /** Số lượt `close` của chính backend. */
  closes: number;
  /** Facet `kv`; VẮNG khi test cần ca `facet-unsupported`. */
  kv?: { open(descriptor: any): Promise<FakeUnit> };
  /** `close` của hợp đồng backend. */
  close(): Promise<void>;
}

/** Tuỳ chọn dựng một backend giả. */
export interface FakeBackendOptions {
  /** Bản ghi gieo sẵn trong medium. */
  readonly seed?: UnitSeed;
  /** Có facet `kv` hay không (mặc định CÓ). */
  readonly hasKv?: boolean;
  /** Có `backupRecord` hay không (mặc định KHÔNG). */
  readonly withBackup?: boolean;
  /** `putRecord` NÉM để đo nhánh "bền hỏng thì bộ nhớ không đổi". */
  readonly failPut?: boolean;
}

/**
 * Dựng MỘT backend giả có bộ ghi.
 * Nhận: tuỳ chọn {@link FakeBackendOptions}.
 * Trả: backend đúng hình dạng seam `StorageBackend` của kho.
 */
export function makeBackend(options: FakeBackendOptions = {}): FakeBackend {
  const backend: FakeBackend = {
    descriptors: [],
    units: [],
    closes: 0,
    close: async () => {
      backend.closes += 1;
    },
  };
  if (options.hasKv === false) return backend;
  backend.kv = {
    open: async (descriptor: any) => {
      backend.descriptors.push(descriptor);
      const seed: UnitSeed = structuredClone(options.seed ?? { tables: {}, global: null });
      const unit: FakeUnit = {
        puts: [],
        deletes: [],
        globals: [],
        backups: [],
        closes: 0,
        loadAll: async () => ({
          tables: structuredClone(seed.tables ?? {}),
          global: seed.global === undefined ? null : structuredClone(seed.global),
        }),
        putRecord: async (table: string, key: string, value: unknown) => {
          if (options.failPut === true) throw new Error("medium down");
          unit.puts.push(table + "/" + key + "=" + JSON.stringify(value));
        },
        deleteRecord: async (table: string, key: string) => {
          unit.deletes.push(table + "/" + key);
        },
        setGlobal: async (value: unknown) => {
          unit.globals.push(JSON.stringify(value));
        },
        close: async () => {
          unit.closes += 1;
        },
      };
      if (options.withBackup === true) {
        unit.backupRecord = async (table: string, key: string) => {
          unit.backups.push(table + "/" + key);
          return table + "/" + key + ".json.bak.1";
        };
      }
      backend.units.push(unit);
      return unit;
    },
  };
  return backend;
}

/** Một lượt `domain/changed` mà test ghi lại. */
export interface ChangeLike {
  /** Miền. */
  readonly domain: string;
  /** Bảng (`''` cho global). */
  readonly table: string;
  /** Khoá (`''` cho global). */
  readonly key: string;
  /** Dấu phép toán. */
  readonly operation: string;
  /** Giá trị mới (chỉ có ở `put`). */
  readonly value?: unknown;
}

/** Một giàn THẬT: Context cordis + kho của ta + các backend giả. */
export interface Hub {
  /** Context cordis thật. */
  readonly ctx: any;
  /** Kho lưu trữ của ta (dịch vụ `storage`). */
  readonly storage: any;
  /** Vết thứ tự các lượt gọi (medium + sự kiện) để so hai bên. */
  readonly trace: string[];
  /** Các lượt `domain/changed` đã phát. */
  readonly events: ChangeLike[];
  /** Các dòng log mà plugin ghi (qua exporter của cordis). */
  readonly logs: string[];
  /** Backend giả theo tên. */
  readonly backends: Map<string, FakeBackend>;
  /** Các fiber đã dựng, để dọn. */
  readonly fibers: any[];
}

/** Tuỳ chọn dựng giàn. */
export interface HubOptions {
  /** Các backend cần đăng ký (mặc định: một backend `json` có `kv`). */
  readonly backends?: readonly { readonly name: string; readonly options?: FakeBackendOptions }[];
}

/**
 * Dựng giàn thật: Context cordis + plugin kho của ta + backend giả + bộ ghi sự kiện/log.
 * Nhận: tuỳ chọn {@link HubOptions}.
 * Trả: promise của {@link Hub} đã sẵn sàng (dịch vụ `storage` đã sống).
 */
export async function makeHub(options: HubOptions = {}): Promise<Hub> {
  const ctx: any = new cordis.Context();
  const trace: string[] = [];
  const events: ChangeLike[] = [];
  const logs: string[] = [];
  const backends = new Map<string, FakeBackend>();
  const fibers: any[] = [];
  fibers.push(ctx.plugin(Storage));
  await waitFor(() => ctx.get("storage") !== undefined, "dịch vụ storage");
  const storage = ctx.get("storage");
  for (const entry of options.backends ?? [{ name: "json" }]) {
    const backend = makeBackend(entry.options ?? {});
    backends.set(entry.name, backend);
    storage.backend.register(entry.name, backend);
    ctx.provide("storage.backend." + entry.name, backend);
  }
  ctx.on("domain/changed", (change: ChangeLike) => {
    events.push(change);
    trace.push("event:" + change.operation + ":" + change.table + "/" + change.key);
  });
  ctx.logger.exporter({ export: (message: any) => logs.push(String(message.args[0])) });
  return { ctx, storage, trace, events, logs, backends, fibers };
}

/**
 * Mount plugin miền của MỘT bên lên giàn rồi chờ facility xuất hiện.
 * Nhận: giàn, mô-đun của bên đó, và cấu hình plugin.
 * Trả: promise của facility đã cấp qua `ctx.storageDomain`.
 */
export async function mountDomain(hub: Hub, mod: Mod, config: Record<string, unknown> = { backend: "json" }): Promise<any> {
  hub.fibers.push(hub.ctx.plugin(mod, config));
  await waitFor(() => hub.ctx.get("storageDomain") !== undefined, "dịch vụ storageDomain");
  return hub.ctx.get("storageDomain");
}

/**
 * Dọn một giàn: gỡ các fiber theo thứ tự NGƯỢC.
 * Nhận: giàn cần dọn.
 * Trả: promise phân giải sau khi mọi fiber đã xuống.
 */
export async function disposeHub(hub: Hub): Promise<void> {
  for (const fiber of [...hub.fibers].reverse()) await fiber.dispose();
}

/**
 * Lấy backend giả theo tên.
 * Nhận: giàn và tên backend.
 * Trả: backend đã đăng ký; thiếu thì NÉM để test không đọc nhầm chỗ.
 */
export function backendOf(hub: Hub, name = "json"): FakeBackend {
  const backend = hub.backends.get(name);
  if (backend === undefined) throw new Error("thiếu backend giả " + name);
  return backend;
}

/**
 * Lấy đơn vị ĐẦU TIÊN đã mở của một backend giả.
 * Nhận: giàn và tên backend.
 * Trả: đơn vị đã mở; chưa mở thì NÉM.
 */
export function unitOf(hub: Hub, name = "json"): FakeUnit {
  const unit = backendOf(hub, name).units[0];
  if (unit === undefined) throw new Error("backend " + name + " chưa mở đơn vị nào");
  return unit;
}

/**
 * Dựng spec miền cho một bên (dùng `domainTable` của CHÍNH bên đó).
 * Nhận: mô-đun của bên đó.
 * Trả: spec có hai bảng — `rows` (bản ghi số) và `empty`.
 */
export function makeSpec(mod: Mod): any {
  return {
    name: "demo",
    version: 1,
    tables: {
      rows: mod.domainTable(zod.object({ n: zod.number() })),
      empty: mod.domainTable(zod.object({})),
    },
  };
}

/**
 * Dựng spec có ô global (schema zod thật) cho một bên.
 * Nhận: mô-đun của bên đó.
 * Trả: spec có global `{ theme }` với `initial` là `{ theme: "light" }`.
 */
export function makeGlobalSpec(mod: Mod): any {
  return {
    name: "demo",
    version: 2,
    global: { schema: zod.object({ theme: zod.string() }), initial: { theme: "light" } },
    tables: { rows: mod.domainTable(zod.object({ n: zod.number() })) },
  };
}

/** Ảnh chụp một kịch bản BẢNG để hai bên so được từng trường. */
export interface TableSnapshot {
  /** Tên miền. */
  readonly domainName: string;
  /** Số bản ghi ngay sau khi mở. */
  readonly sizeAfterOpen: number;
  /** Bản ghi `a` đọc đồng bộ. */
  readonly getA: unknown;
  /** Ảnh chụp cặp ngay sau khi mở. */
  readonly entries: [string, unknown][];
  /** Ảnh chụp khoá ngay sau khi mở. */
  readonly keys: string[];
  /** Số bản ghi sau lượt `put`. */
  readonly sizeAfterPut: number;
  /** Bản ghi sau lượt `update`. */
  readonly updated: unknown;
  /** Kết quả `delete("a")`. */
  readonly deletePresent: boolean;
  /** Kết quả `delete("zzz")` (vắng sẵn). */
  readonly deleteMissing: boolean;
  /** Ảnh chụp cuối cùng. */
  readonly finalEntries: [string, unknown][];
  /** Sửa mảng ảnh chụp có chạm bảng không (phải KHÔNG). */
  readonly snapshotIsDetached: boolean;
  /** Câu lỗi khi chạm bảng không khai. */
  readonly undeclaredTable: string;
  /** Câu lỗi khi chạm global trên spec không khai global. */
  readonly noGlobal: string;
  /** Câu lỗi khi mở lại cùng tên. */
  readonly alreadyOpen: string;
  /** Câu lỗi khi GHI sau khi đóng. */
  readonly closedWrite: string;
  /** Câu lỗi khi ĐỌC sau khi đóng. */
  readonly closedRead: string;
  /** Hai lượt `close()` có trả CÙNG một promise không. */
  readonly closeShared: boolean;
  /** Miền còn trong facility sau khi đóng không. */
  readonly facilityAfterClose: string;
  /** Các lượt `domain/changed` đã phát. */
  readonly events: readonly ChangeLike[];
  /** Vết thứ tự (medium + sự kiện). */
  readonly trace: readonly string[];
  /** Vết medium của đơn vị. */
  readonly medium: { readonly puts: readonly string[]; readonly deletes: readonly string[]; readonly closes: number };
  /** Mô tả mà backend nhận ở lượt `open`. */
  readonly descriptor: unknown;
  /** Số lượt `close` của backend. */
  readonly backendCloses: number;
}

/**
 * Chạy MỘT kịch bản bảng đầy đủ trên một bên (mở · đọc · ghi · sửa · xoá · đóng).
 * Nhận: mô-đun của bên đó.
 * Trả: promise của {@link TableSnapshot} đã chuẩn hoá để so với bên kia.
 */
export async function runTableScenario(mod: Mod): Promise<TableSnapshot> {
  const hub = await makeHub({
    backends: [
      { name: "json", options: { seed: { tables: { rows: { a: { n: 1 }, b: { n: 2 } }, empty: {} }, global: null } } },
    ],
  });
  try {
    const facility = await mountDomain(hub, mod);
    const domain = await facility.open(makeSpec(mod));
    const rows = domain.table("rows");
    const sizeAfterOpen = rows.size;
    const getA = rows.get("a");
    const entries = [...rows.entries()];
    const keys = [...rows.keys()];
    // Ảnh chụp phải TÁCH KHỎI bảng: sửa mảng thu được không đổi số bản ghi.
    const probe = [...rows.entries()];
    probe.push(["bia", { n: 0 }]);
    const snapshotIsDetached = rows.size === sizeAfterOpen && rows.get("bia") === undefined;
    await rows.put("c", { n: 3 });
    const sizeAfterPut = rows.size;
    const updated = await rows.update("c", (current: any) => ({ n: current.n + 1 }));
    const deletePresent = await rows.delete("a");
    const deleteMissing = await rows.delete("zzz");
    const finalEntries = [...rows.entries()];
    const undeclaredTable = errorOf(() => domain.table("nope"));
    const noGlobal = errorOf(() => domain.global);
    const alreadyOpen = await rejectionOf(() => facility.open(makeSpec(mod)));
    const first = domain.close();
    const second = domain.close();
    const closeShared = first === second;
    await first;
    const closedWrite = await rejectionOf(() => rows.put("d", { n: 4 }));
    const closedRead = errorOf(() => rows.size);
    const facilityAfterClose = String(facility.get("demo"));
    const unit = unitOf(hub);
    return {
      domainName: domain.name,
      sizeAfterOpen,
      getA,
      entries,
      keys,
      sizeAfterPut,
      updated,
      deletePresent,
      deleteMissing,
      finalEntries,
      snapshotIsDetached,
      undeclaredTable,
      noGlobal,
      alreadyOpen,
      closedWrite,
      closedRead,
      closeShared,
      facilityAfterClose,
      events: hub.events,
      trace: hub.trace,
      medium: { puts: unit.puts, deletes: unit.deletes, closes: unit.closes },
      descriptor: backendOf(hub).descriptors[0],
      backendCloses: backendOf(hub).closes,
    };
  } finally {
    await disposeHub(hub);
  }
}

/** Ảnh chụp kịch bản Ô GLOBAL để hai bên so được từng trường. */
export interface GlobalSnapshot {
  /** Giá trị đọc TRƯỚC lượt `set` đầu. */
  readonly beforeSet: unknown;
  /** Giá trị đọc SAU lượt `set`. */
  readonly afterSet: unknown;
  /** Các lượt `setGlobal` của medium. */
  readonly globals: readonly string[];
  /** Các lượt `domain/changed` đã phát. */
  readonly events: readonly ChangeLike[];
}

/**
 * Chạy MỘT kịch bản ô global trên một bên.
 * Nhận: mô-đun của bên đó và giá trị global gieo sẵn trong medium (`null` = chưa từng ghi).
 * Trả: promise của {@link GlobalSnapshot}.
 */
export async function runGlobalScenario(mod: Mod, seedGlobal: unknown): Promise<GlobalSnapshot> {
  const hub = await makeHub({
    backends: [{ name: "json", options: { seed: { tables: { rows: {} }, global: seedGlobal } } }],
  });
  try {
    const facility = await mountDomain(hub, mod);
    const domain = await facility.open(makeGlobalSpec(mod));
    const beforeSet = domain.global.get();
    await domain.global.set({ theme: "dark" });
    const afterSet = domain.global.get();
    const globals = unitOf(hub).globals;
    return { beforeSet, afterSet, globals, events: hub.events };
  } finally {
    await disposeHub(hub);
  }
}

/** Ảnh chụp MA TRẬN ĐƯỜNG LỖI để hai bên so từng câu. */
export interface ErrorSnapshot {
  /** Backend không có trong sổ. */
  readonly backendNotFound: string;
  /** Backend có trong sổ nhưng KHÔNG có facet `kv`. */
  readonly facetUnsupported: string;
  /** Bản ghi hỏng schema. */
  readonly invalidRecord: string;
  /** Loại lỗi gốc (`cause`) của ca `invalid-record`. */
  readonly invalidRecordCause: string;
  /** Ô global đã lưu hỏng schema. */
  readonly invalidGlobal: string;
  /** `update` trên khoá vắng. */
  readonly missingKey: string;
  /** Mở lại được sau một lượt mở HỎNG (tên đã được trả tự do). */
  readonly reopenAfterFailure: string;
  /** Tuyến theo miền GHI ĐÈ backend mặc định. */
  readonly routedDescriptor: unknown;
  /** Đơn vị của lượt mở hỏng đã được ĐÓNG chưa (số lượt). */
  readonly failedUnitCloses: number;
}

/**
 * Chạy MA TRẬN đường lỗi trên MỘT bên (facility dựng trực tiếp để chạm được mọi nhánh).
 * Nhận: mô-đun của bên đó.
 * Trả: promise của {@link ErrorSnapshot}.
 */
export async function runErrorMatrix(mod: Mod): Promise<ErrorSnapshot> {
  const hub = await makeHub({
    backends: [
      { name: "json", options: { seed: { tables: { rows: { a: { n: 1 } } }, global: null } } },
      { name: "nokv", options: { hasKv: false } },
      { name: "bad", options: { seed: { tables: { rows: { a: { n: 1 }, oops: { n: "x" } } }, global: null } } },
      { name: "badglobal", options: { seed: { tables: { rows: {} }, global: { theme: 42 } } } },
    ],
  });
  try {
    const simple = (): any => ({ name: "demo", version: 1, tables: { rows: mod.domainTable(zod.object({ n: zod.number() })) } });
    const missing = new mod.DomainFacility(hub.ctx, { backend: "nope" });
    const backendNotFound = await rejectionOf(() => missing.open(simple()));
    const noKv = new mod.DomainFacility(hub.ctx, { backend: "nokv" });
    const facetUnsupported = await rejectionOf(() => noKv.open(simple()));
    const bad = new mod.DomainFacility(hub.ctx, { backend: "bad" });
    const invalidRecord = await rejectionOf(() => bad.open(simple()));
    let invalidRecordCause = "(khong co cause)";
    try {
      await bad.open(simple());
    } catch (error) {
      const cause = (error as { cause?: { name?: string; issues?: { code?: string }[] } }).cause;
      invalidRecordCause = String(cause?.name) + ":" + String(cause?.issues?.[0]?.code);
    }
    const failedUnitCloses = unitOf(hub, "bad").closes;
    // Lượt mở HỎNG phải TRẢ TỰ DO tên miền ⇒ mở lại (trên backend tốt) phải được.
    const good = new mod.DomainFacility(hub.ctx, { backend: "json" });
    const reopened = await good.open(simple());
    const reopenAfterFailure = reopened.name;
    await reopened.close();
    const badGlobal = new mod.DomainFacility(hub.ctx, { backend: "badglobal" });
    const invalidGlobal = await rejectionOf(() => badGlobal.open(makeGlobalSpec(mod)));
    const rows = (await good.open(simple())).table("rows");
    await rows.put("b", { n: 2 });
    const missingKey = await rejectionOf(() => rows.update("zzz", () => ({ n: 0 })));
    // Tuyến theo TÊN MIỀN ghi đè backend mặc định (mặc định là backend KHÔNG có kv).
    const routed = new mod.DomainFacility(hub.ctx, { backend: "nokv", routes: { demo: "json" } });
    const routedDomain = await routed.open(simple());
    const routedDescriptor = backendOf(hub, "json").descriptors.at(-1);
    await routedDomain.close();
    return {
      backendNotFound,
      facetUnsupported,
      invalidRecord,
      invalidRecordCause,
      invalidGlobal,
      missingKey,
      reopenAfterFailure,
      routedDescriptor,
      failedUnitCloses,
    };
  } finally {
    await disposeHub(hub);
  }
}

/** Ảnh chụp kịch bản `backup-and-skip`. */
export interface BackupSnapshot {
  /** Kết cục của lượt mở. */
  readonly outcome: { readonly ok: boolean; readonly keys?: readonly string[]; readonly code?: string; readonly message?: string };
  /** Các lượt `backupRecord`. */
  readonly backups: readonly string[];
  /** Số lượt `close` của đơn vị (mở hỏng ⇒ 1; mở được ⇒ 0). */
  readonly unitCloses: number;
  /** Các dòng log của plugin. */
  readonly logs: readonly string[];
  /** Mô tả nhận ở lượt `open`. */
  readonly descriptor: unknown;
}

/**
 * Chạy kịch bản `invalidRecords: 'backup-and-skip'` trên MỘT bên.
 * Nhận: mô-đun của bên đó và việc backend có `backupRecord` hay không.
 * Trả: promise của {@link BackupSnapshot}.
 */
export async function runBackupScenario(mod: Mod, withBackup: boolean): Promise<BackupSnapshot> {
  const hub = await makeHub({
    backends: [
      { name: "json", options: { withBackup, seed: { tables: { rows: { good: { n: 1 }, oops: { n: "x" } } }, global: null } } },
    ],
  });
  try {
    const facility = await mountDomain(hub, mod);
    const spec = {
      name: "demo",
      version: 1,
      layout: "per-record",
      invalidRecords: "backup-and-skip",
      tables: { rows: mod.domainTable(zod.object({ n: zod.number() })) },
    };
    const outcome = await (async () => {
      try {
        const domain = await facility.open(spec);
        return { ok: true, keys: [...domain.table("rows").keys()] };
      } catch (error) {
        const subject = error as { code?: string; message?: string };
        return { ok: false, code: subject.code, message: subject.message };
      }
    })();
    const unit = unitOf(hub);
    return {
      outcome,
      backups: unit.backups,
      unitCloses: unit.closes,
      logs: hub.logs,
      descriptor: backendOf(hub).descriptors[0],
    };
  } finally {
    await disposeHub(hub);
  }
}
