/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giàn THẬT dùng chung cho test `workspace`: Context cordis thật + kho và dạng-dữ-liệu-miền của TA
 *      + session persistence GIẢ ghi vết, để MỖI ca chạy CẢ HAI bản cài (bản viết lại + chính bundle
 *      gốc) rồi so từng bước. Tách khỏi file test để mỗi file ≤ 1000 dòng (luật repo).
 */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");

/** cordis mà CHÍNH gói ta nạp (symlink tới kernel) — cùng một tệp thật với kernel. */
const OUR_CORDIS = join(REPO, "packages", "host", "workspace", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Kho của ta (dịch vụ `storage`) — nguồn của facet `kv` mà miền dùng. */
const OUR_STORAGE = join(REPO, "packages", "host", "storage", "src", "index.ts");
/** Dạng dữ liệu MIỀN của ta (dịch vụ `storageDomain`) — seam THẬT của sổ đăng ký. */
const OUR_DOMAIN = join(REPO, "packages", "host", "storage-domain", "src", "index.ts");
/** Bản viết lại đang được kiểm. */
const OUR_ROW = join(REPO, "packages", "host", "workspace", "src", "index.ts");
/** Bản GỐC (chỉ đọc) — đối chứng A/B. */
const STOCK_ROW = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-workspace", "lib", "index.js");

/** Kiểu mô-đun động (mọi bên đều là ESM). */
export type Mod = Record<string, any>;

/** Context cordis THẬT (một tệp kernel duy nhất cho mọi bên). */
export const cordis = (await import(OUR_CORDIS)) as { Context: new () => any };
/** Mô-đun của TA. */
export const OUR = (await import(OUR_ROW)) as Mod;
/** Mô-đun GỐC. */
export const STOCK = (await import(STOCK_ROW)) as Mod;

/** Trần chờ mặc định cho mọi phép chờ trạng thái (ms) — KHÔNG bao giờ chờ vô hạn. */
export const WAIT_CEILING_MS = 3000;

/**
 * Chờ tới khi điều kiện đúng, CÓ TRẦN thời gian.
 * Nhận: hàm kiểm, nhãn để báo lỗi, và trần (ms).
 * Trả: promise phân giải khi điều kiện đúng; NÉM khi hết trần.
 */
export async function waitFor(check: () => boolean, label: string, timeoutMs = WAIT_CEILING_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("waitFor het tran " + timeoutMs + "ms: " + label);
}

/**
 * Mô tả một lỗi ĐỒNG BỘ để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi JSON `{name, message, sessionId, workspaceId, activity, code}`.
 */
export function errorOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    return describe(error);
  }
}

/**
 * Mô tả một lỗi BẤT ĐỒNG BỘ (promise bị từ chối).
 * Nhận: hàm trả promise cần chạy.
 * Trả: promise của chuỗi mô tả như {@link errorOf}.
 */
export async function rejectionOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    return describe(error);
  }
}

/**
 * Mô tả một giá trị ném ra: lớp, câu, và các trường dữ liệu mà người gọi phân nhánh theo.
 * Nhận: giá trị bị ném.
 * Trả: chuỗi JSON ổn định để so giữa hai bên.
 */
function describe(error: unknown): string {
  const subject = error as {
    name?: string;
    message?: string;
    code?: string;
    sessionId?: string;
    workspaceId?: string;
    activity?: { kind?: string; items?: unknown }[];
  };
  return JSON.stringify({
    name: subject.name,
    message: subject.message,
    code: subject.code,
    sessionId: subject.sessionId,
    workspaceId: subject.workspaceId,
    activity: subject.activity?.map((entry) => ({ kind: entry.kind, items: entry.items })),
  });
}

/** Header phiên GIẢ (đúng phần mà sổ đăng ký đọc). */
export interface FakeHeader {
  /** Id phiên. */
  id: string;
  /** Thư mục làm việc đã ghi trong header. */
  cwd?: string;
  /** Mốc tạo (ms epoch). */
  createdAt: number;
}

/** Bản ghi đã lưu mà backend giả phục vụ cho một lượt `loadAll`. */
export interface UnitSeed {
  /** Bản ghi theo bảng. */
  tables?: Record<string, Record<string, unknown>>;
  /** Ô singleton toàn cục; `null`/vắng = "chưa từng ghi". */
  global?: unknown;
}

/** Một đơn vị backend GIẢ: ghi lại mọi lượt gọi để so từng bước. */
export interface FakeUnit {
  /** Các lượt `putRecord`, dạng `bảng/khoá=JSON`. */
  puts: string[];
  /** Các lượt `deleteRecord`, dạng `bảng/khoá`. */
  deletes: string[];
  /** Các lượt `setGlobal`, dạng JSON. */
  globals: string[];
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
  /** `close` của hợp đồng đơn vị. */
  close(): Promise<void>;
}

/**
 * Dựng MỘT đơn vị backend giả có bộ ghi.
 * Nhận: bản ghi/global gieo sẵn trong môi trường lưu.
 * Trả: đơn vị đúng hình dạng facet `kv` mà miền gọi (chỉ bốn phép miền dùng).
 */
export function makeUnit(seed: UnitSeed): FakeUnit {
  const snapshot = structuredClone(seed);
  const unit: FakeUnit = {
    puts: [],
    deletes: [],
    globals: [],
    closes: 0,
    loadAll: async () => ({
      tables: structuredClone(snapshot.tables ?? {}),
      global: snapshot.global === undefined ? null : structuredClone(snapshot.global),
    }),
    putRecord: async (table: string, key: string, value: unknown) => {
      unit.puts.push(table + "/" + key + "=" + JSON.stringify(value));
      snapshot.tables = { ...(snapshot.tables ?? {}), [table]: { ...(snapshot.tables?.[table] ?? {}), [key]: structuredClone(value) } };
    },
    deleteRecord: async (table: string, key: string) => {
      unit.deletes.push(table + "/" + key);
      if (snapshot.tables?.[table] !== undefined) delete snapshot.tables[table][key];
    },
    setGlobal: async (value: unknown) => {
      unit.globals.push(JSON.stringify(value));
      snapshot.global = structuredClone(value);
    },
    close: async () => {
      unit.closes += 1;
    },
  };
  return unit;
}

/** Một giàn THẬT cho MỘT bên. */
export interface Rig {
  /** Context cordis thật. */
  readonly ctx: any;
  /** Dịch vụ `workspaceRegistry` của bên đó (đã ACTIVE). */
  readonly registry: any;
  /** Mô-đun của bên đó (để lấy lớp lỗi/spec/hàm thuần SO SÁNH đúng bên). */
  readonly mod: Mod;
  /** Các dòng log plugin ghi (qua exporter của cordis). */
  readonly logs: string[];
  /** Nguồn header của persistence giả — test sửa TRƯỚC khi mount hoặc trong lúc sống. */
  readonly headers: Map<string, FakeHeader>;
  /** Các phiên ĐANG SỐNG (chỉ có khi rig khai `sessions`). */
  readonly live: Map<string, FakeHeader>;
  /** Đơn vị backend đã mở (bộ ghi). */
  readonly unit: FakeUnit;
  /** Các fiber đã dựng, để dọn. */
  readonly fibers: any[];
}

/** Tuỳ chọn dựng giàn. */
export interface RigOptions {
  /** Bản ghi/global gieo sẵn trong môi trường lưu. */
  readonly seed?: UnitSeed;
  /** Header phiên đã lưu (persistence giả phục vụ). */
  readonly stored?: readonly FakeHeader[];
  /** Phiên ĐANG SỐNG; có mặt thì rig cấp dịch vụ `sessions`. */
  readonly sessions?: readonly FakeHeader[];
}

/**
 * Dựng giàn thật cho một bên: Context cordis + kho + miền của TA + persistence giả + sổ đăng ký.
 * Nhận: mô-đun của bên đó và tuỳ chọn {@link RigOptions}.
 * Trả: promise của {@link Rig} khi sổ đăng ký đã chạy xong lượt khởi động.
 */
export async function makeRig(mod: Mod, options: RigOptions = {}): Promise<Rig> {
  const ctx: any = new cordis.Context();
  const logs: string[] = [];
  // `levels.default` phải ≥ 3: cordis LỌC theo ngưỡng (mặc định 1 = chỉ error), nên CẢNH BÁO (level 2)
  // sẽ BIẾN MẤT nếu exporter không khai ngưỡng — đây là bẫy thật, không phải chi tiết phụ.
  ctx.logger.exporter({ levels: { default: 4 }, export: (message: any) => logs.push(String(message.args[0])) });
  const fibers: any[] = [];
  const { Storage } = (await import(OUR_STORAGE)) as Mod;
  fibers.push(ctx.plugin(Storage));
  await waitFor(() => ctx.get("storage") !== undefined, "dich vu storage");
  const unit = makeUnit(options.seed ?? { tables: { workspaces: {} }, global: null });
  const backend = { closes: 0, kv: { open: async () => unit }, close: async () => {} };
  ctx.get("storage").backend.register("json", backend);
  ctx.provide("storage.backend.json", backend);
  const domainMod = (await import(OUR_DOMAIN)) as Mod;
  fibers.push(ctx.plugin(domainMod, { backend: "json" }));
  await waitFor(() => ctx.get("storageDomain") !== undefined, "dich vu storageDomain");
  const headers = new Map<string, FakeHeader>();
  for (const header of options.stored ?? []) headers.set(header.id, header);
  ctx.provide("sessionPersistence", {
    list: async () => [...headers.values()].map((header) => ({ header })),
  });
  const live = new Map<string, FakeHeader>();
  for (const header of options.sessions ?? []) live.set(header.id, header);
  if (options.sessions !== undefined) {
    ctx.provide("sessions", {
      get: (id: string) => (live.has(id) ? { header: live.get(id) } : undefined),
      list: () => [...live.values()].map((header) => ({ header })),
    });
  }
  const fiber = ctx.plugin((mod as { default: unknown }).default);
  fibers.push(fiber);
  await fiber;
  await waitFor(() => ctx.get("workspaceRegistry") !== undefined, "dich vu workspaceRegistry");
  return { ctx, registry: ctx.get("workspaceRegistry"), mod, logs, headers, live, unit, fibers };
}

/**
 * Dọn một giàn: gỡ các fiber theo thứ tự NGƯỢC.
 * Nhận: giàn cần dọn.
 * Trả: promise phân giải sau khi mọi fiber đã xuống.
 */
export async function disposeRig(rig: Rig): Promise<void> {
  for (const fiber of [...rig.fibers].reverse()) await fiber.dispose();
}

/** Một thư mục tạm đã tạo, kèm hàm dọn. */
export interface TempRoot {
  /** Đường dẫn tuyệt đối của gốc tạm. */
  readonly path: string;
  /**
   * Dọn gốc tạm.
   * Nhận: không.
   * Trả: promise phân giải khi đã xoá xong.
   */
  clean(): Promise<void>;
}

/**
 * Tạo một gốc tạm RIÊNG cho một bên (symlink/realpath cần thư mục CÓ THẬT).
 * Nhận: không.
 * Trả: promise của {@link TempRoot}.
 */
export async function makeTempRoot(): Promise<TempRoot> {
  const path = await mkdtemp(join(tmpdir(), "gbh-ws-"));
  return { path, clean: async () => await rm(path, { recursive: true, force: true }) };
}

/**
 * Xoá dấu vết KHÔNG SO ĐƯỢC giữa hai bên: gốc tạm và mốc ISO-8601 do đồng hồ sinh ra.
 * Nhận: giá trị bất kỳ và gốc tạm của bên đó.
 * Trả: BẢN SAO đã thay `<root>` và `<iso>`.
 */
export function scrub(value: unknown, root: string): unknown {
  const text = JSON.stringify(value);
  const replaced = text
    .split(root)
    .join("<root>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<iso>");
  return JSON.parse(replaced);
}

/**
 * Ảnh chụp danh sách workspace đã chuẩn hoá để hai bên so được từng trường.
 * Nhận: dịch vụ sổ đăng ký.
 * Trả: mảng `{index, path, title, sessionIds, sameTimestamps, status}` (bất đồng bộ vì `status`).
 */
export async function snapshot(registry: any): Promise<unknown[]> {
  const out: unknown[] = [];
  const list = registry.list();
  for (let index = 0; index < list.length; index += 1) {
    const workspace = list[index];
    out.push({
      index,
      path: workspace.path,
      title: workspace.title,
      sessionIds: [...workspace.sessionIds],
      firstWrite: workspace.createdAt === workspace.updatedAt,
      isoCreated: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(workspace.createdAt),
      status: await workspace.status(),
    });
  }
  return out;
}
