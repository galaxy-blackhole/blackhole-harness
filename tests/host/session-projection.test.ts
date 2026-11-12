/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-session-projection (row session-projection): bước 0 đọc CẶP row
 *      trong ours.yml, đo tập export trên ARTIFACT, đối chứng TRỰC TIẾP với chính bundle gốc trên
 *      Context cordis THẬT (đăng ký · lái eager · ảnh chụp · kênh thay đổi · checkpoint/restore/hydrate),
 *      ca SESSIONSEQ với kernel, quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca C6 (DANH
 *      TÍNH), luật 000e (locale byte-for-byte) và TEST CANH "gói CHƯA khai gbh.row".
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/session-projection/build.ts";
import { SessionLogOffset, SessionSeq } from "../../packages/host/session-projection/src/brand.ts";

/** Thư mục package của ta — gốc của mọi phép đọc manifest/nguồn. */
const PKG = join(import.meta.dir, "..", "..", "packages", "host", "session-projection");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của MỌI ca A/B. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-projection");
/** Gốc repo (để đọc .parity/dumps). */
const REPO = join(import.meta.dir, "..", "..");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà bundle gốc nạp. */
const STOCK_CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer lúc nạp. */
const OUT = join(PKG, ".test-lib");

/** Một sự kiện phiên dựng trong test (đúng hai trường seam dùng cộng dữ liệu tuỳ ý). */
interface FakeEvent {
  /** Loại sự kiện. */
  readonly type: string;
  /** Vị trí trong log. */
  readonly seq: number;
  /** Dữ liệu sự kiện. */
  readonly data?: unknown;
}

/** Trạng thái phép gộp của hai đơn vị dựng trong test. */
interface TestState {
  /** Danh sách mục. */
  readonly items: readonly string[];
  /** Số lần đổi trạng thái (đổi mà KHÔNG đổi khung nhìn). */
  readonly count: number;
}

/** Một đơn vị chiếu dựng trong test (đúng hình dạng `ProjectionDefinition` của seam). */
interface Definition {
  /** Khoá chiếu. */
  readonly key: string;
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
  /** Schema trạng thái — seam CHỈ gọi `parse`. */
  readonly stateSchema: { parse(value: unknown): TestState };
  /** Trạng thái rỗng. */
  init(header: unknown, inheritedEventCount: number): TestState;
  /** Phép gộp thuần. */
  apply(state: TestState, event: FakeEvent): TestState;
  /** Khung nhìn dây (vắng với đơn vị chỉ-host). */
  readonly wire?: {
    /** Schema khung nhìn. */
    readonly viewSchema: { parse(value: unknown): readonly string[] };
    /** Hàm chiếu. */
    view(state: TestState): readonly string[];
  };
}

/** Ảnh chụp mà cả hai bản cài trả về. */
interface Snapshot {
  /** Seq của sự kiện cuối mà mọi giá trị phản ánh. */
  readonly asOfSeq: number;
  /** Giá trị theo khoá. */
  readonly values: Record<string, unknown>;
}

/** Một dòng checkpoint. */
interface CheckpointRow {
  /** Phiên bản trạng thái lúc gộp. */
  readonly ver: number;
  /** Seq đã gộp. */
  readonly seq: number;
  /** Trạng thái. */
  readonly val: unknown;
}

/** Các dòng checkpoint theo khoá. */
type Checkpoint = Record<string, CheckpointRow>;

/** Bề mặt của sổ chiếu mà test gọi (khai theo CẤU TRÚC, không import gói seam nào). */
interface RegistryLike {
  /** Đăng ký một đơn vị chiếu; trả hàm dọn. */
  register(definition: Definition): () => void;
  /** Theo dõi kênh thay đổi; trả hàm dọn. */
  onChanged(listener: (session: unknown, key: string, value: unknown, seq: number) => void): () => void;
  /** Đọc trạng thái đã gộp của một khoá. */
  stateOf(session: unknown, key: string): unknown;
  /** Phép cắt nhất quán trên mọi khoá hiện cho Client. */
  snapshot(session: unknown, keys?: readonly string[]): Snapshot;
  /** Phép cắt trên các ô ĐÃ vật chất hoá. */
  cachedSnapshot(session: unknown, keys?: readonly string[]): Snapshot | undefined;
  /** Checkpoint mức trạng thái. */
  checkpoint(session: unknown): Checkpoint;
  /** Offset bắt đầu lượt đọc đuôi cho `restore`. */
  restoreFloor(checkpoint: Checkpoint): number | undefined;
  /** Xem checkpoint KHÔNG đọc log. */
  viewCheckpoint(checkpoint: Checkpoint, keys?: readonly string[]): Record<string, unknown>;
  /** Đọc lạnh trên một hậu tố log. */
  restore(
    checkpoint: Checkpoint,
    events: readonly FakeEvent[],
    baseSeq: number,
    header: unknown,
    inheritedEventCount: number,
  ): { snapshot: Snapshot; checkpoint: Checkpoint };
  /** Khôi phục đúng một phép cắt và cài trạng thái lên phiên. */
  hydrate(session: unknown, checkpoint: Checkpoint, events: readonly FakeEvent[], baseSeq: number): Snapshot;
}

/** Mô-đun của một bản cài: đúng hai export của bản gốc. */
interface RegistryModule {
  /** Lớp sổ chiếu. */
  readonly SessionProjectionRegistry: new (ctx: unknown) => RegistryLike;
  /** Export mặc định — CHÍNH lớp đó. */
  readonly default: unknown;
}

/** Context cordis tối thiểu mà test dùng (khai theo CẤU TRÚC). */
interface CordisContext {
  /** Phát một sự kiện tới mọi listener đã đăng ký. */
  emit(event: string, ...args: unknown[]): unknown;
  /** Tra một dịch vụ theo tên. */
  get(name: string): unknown;
  /** Nạp một plugin qua ĐƯỜNG NẠP THẬT của kernel (đúng đường `bh host` dùng cho row). */
  plugin(plugin: unknown): unknown;
  /** Trạng thái fiber của context (2 = ACTIVE). */
  readonly fiber?: { readonly state: number };
}

/** Hàm dựng Context của cordis. */
type ContextCtor = new () => CordisContext;

/** Một giàn thử: context thật + sổ chiếu của một bản cài. */
interface Rig {
  /** Context cordis (thật) sở hữu sổ. */
  readonly ctx: CordisContext;
  /** Sổ chiếu của bản cài. */
  readonly registry: RegistryLike;
}

/** Một bản cài (mô-đun + hàm dựng Context của chính nó) — đơn vị của mọi phép A/B. */
interface Install {
  /** Mô-đun của bản cài. */
  readonly mod: RegistryModule;
  /** Hàm dựng Context của bản cài. */
  readonly Context: ContextCtor;
}

/** Khoá row mà LEAD khai trong manifest của gói (hình dạng phải giữ, kể cả khi gỡ mount). */
interface DeclaredRow {
  /** Id row stock bị tắt. */
  id?: string;
  /** Đường dẫn test chứng minh hành vi (ràng buộc G4). */
  tests?: string[];
  /** Cấu hình sinh vào patch — row gốc KHÔNG có nên phải VẮNG. */
  config?: unknown;
  /** Id module — row host-only nên phải VẮNG. */
  moduleIds?: unknown;
  /** Id alias — row host-only nên phải VẮNG. */
  aliases?: unknown;
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies`. */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Metadata nửa client của DSH (bản gốc không có). */
  dsh?: unknown;
  /** Metadata row của ta — đọc CẢ hai dạng (đã mount: `row`; đã gỡ: `row_unmounted_ly_do.row`). */
  gbh?: { peers?: string[]; row?: DeclaredRow; row_unmounted_ly_do?: { ly_do?: string; row?: DeclaredRow } };
}

/** Phiên giả đúng hình dạng `ProjectedSession` (seq = số sự kiện đã cam kết). */
class FakeSession {
  /** Log trong bộ nhớ, chỉ số mảng TRÙNG seq. */
  readonly events: FakeEvent[] = [];
  /** Metadata bất biến của phiên. */
  readonly header: unknown;
  /** Độ dài tiền tố thừa kế khi fork. */
  readonly inheritedEventCount = 0;

  /**
   * Dựng một phiên rỗng.
   * Nhận: header tuỳ chọn.
   * Trả: phiên có `seq === 0`.
   */
  constructor(header: unknown = { id: "s1" }) {
    this.header = header;
  }

  /** Số sự kiện đã cam kết — con trỏ của phiên. */
  get seq(): number {
    return this.events.length;
  }

  /**
   * Nối MỘT sự kiện vào log (seq của nó phải bằng đúng độ dài log hiện tại).
   * Nhận: sự kiện cần nối.
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

/** Đổi đường dẫn tương đối (theo CHÍNH file test) thành tuyệt đối. */
function here(relative: string): string {
  return new URL(relative, import.meta.url).pathname;
}

/** Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`). */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE. */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
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

/**
 * Chạy một lượt gọi và trả mô tả lỗi thay vì ném — để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi `{name}: {message}` hoặc `(khong nem)`.
 */
function errorOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    const value = error as { name?: string; message?: string };
    return String(value.name) + ": " + String(value.message);
  }
}

/** `SessionSeq`/`SessionLogOffset` của KERNEL — nguồn đối chứng của ca dấu kiểu. */
const kernel = (await import(here("../../apps/host/node_modules/@deepseek-ai/dsh-session/lib/index.js"))) as unknown as {
  SessionSeq(value: number): number;
  SessionLogOffset(value: number): number;
};

/** Mô-đun CỦA TA đã build; `Context`/mô-đun GỐC — điền trong `beforeAll`. */
let ourMod: RegistryModule;
/** Bản cài của TA. */
let OUR: Install;
/** Bản cài GỐC. */
let STOCKED: Install;

beforeAll(async () => {
  const artifact = await buildPackage(OUT);
  ourMod = (await import(pathToFileURL(artifact).href)) as unknown as RegistryModule;
  const OurContext = ((await import(OUR_CORDIS)) as unknown as { Context: ContextCtor }).Context;
  const StockContext = ((await import(STOCK_CORDIS)) as unknown as { Context: ContextCtor }).Context;
  const stockMod = (await import(here("../../apps/host/node_modules/@deepseek-ai/dsh-session-projection/lib/index.js"))) as unknown as RegistryModule;
  OUR = { mod: ourMod, Context: OurContext };
  STOCKED = { mod: stockMod, Context: StockContext };
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/**
 * Dựng một giàn thử: Context cordis THẬT + sổ chiếu của một bản cài.
 * Nhận: bản cài cần dựng.
 * Trả: giàn thử (context + sổ).
 */
function makeRig(install: Install): Rig {
  const ctx = new install.Context();
  const registry = new install.mod.SessionProjectionRegistry(ctx);
  return { ctx, registry };
}

/**
 * Đơn vị chiếu `todos` — CÓ khung nhìn dây; hai nhánh: `todo/add` đổi cả trạng thái lẫn khung
 * nhìn, `todo/tick` đổi trạng thái nhưng GIỮ khung nhìn.
 * Nhận: không.
 * Trả: định nghĩa đúng hình dạng seam.
 */
function todoDefinition(): Definition {
  return {
    key: "todos",
    stateVersion: 1,
    stateSchema: {
      parse(value: unknown): TestState {
        const candidate = value as { items?: unknown; count?: unknown };
        if (!Array.isArray(candidate.items) || typeof candidate.count !== "number") {
          throw new Error("todo state must be {items: string[], count: number}");
        }
        return { items: candidate.items as string[], count: candidate.count };
      },
    },
    init(): TestState {
      return { items: [], count: 0 };
    },
    apply(state: TestState, event: FakeEvent): TestState {
      if (event.type === "todo/add") return { items: [...state.items, String(event.data)], count: state.count + 1 };
      if (event.type === "todo/tick") return { items: state.items, count: state.count + 1 };
      return state;
    },
    wire: {
      viewSchema: {
        parse(value: unknown): readonly string[] {
          if (!Array.isArray(value)) throw new Error("todo view must be string[]");
          return value as string[];
        },
      },
      view(state: TestState): readonly string[] {
        return state.items;
      },
    },
  };
}

/**
 * Đơn vị chiếu `notes` — CHỈ HOST (không khung nhìn), để kiểm việc loại khỏi ảnh chụp Client.
 * Nhận: không.
 * Trả: định nghĩa đúng hình dạng seam.
 */
function noteDefinition(): Definition {
  return {
    key: "notes",
    stateVersion: 1,
    stateSchema: {
      parse(value: unknown): TestState {
        const candidate = value as { items?: unknown; count?: unknown };
        if (!Array.isArray(candidate.items) || typeof candidate.count !== "number") {
          throw new Error("note state must be {items: string[], count: number}");
        }
        return { items: candidate.items as string[], count: candidate.count };
      },
    },
    init(): TestState {
      return { items: [], count: 0 };
    },
    apply(state: TestState, event: FakeEvent): TestState {
      if (event.type === "note/add") return { items: [...state.items, String(event.data)], count: state.count + 1 };
      return state;
    },
  };
}

/** Kịch bản dùng cho MỌI ca A/B — 8 sự kiện thật của vòng agent (seq 0..7). */
const SCRIPT: readonly FakeEvent[] = [
  { type: "session/start", seq: 0, data: { header: {} } },
  { type: "todo/add", seq: 1, data: "việc một" },
  { type: "todo/tick", seq: 2 },
  { type: "note/add", seq: 3, data: "ghi chú" },
  { type: "todo/add", seq: 4, data: "việc hai" },
  { type: "turn/end", seq: 5 },
  { type: "todo/add", seq: 6, data: "việc ba" },
  { type: "turn/end", seq: 7 },
];

/** Dấu vết một lượt chạy: ảnh chụp + trạng thái + ảnh chụp đã nhớ ở TỪNG bước. */
interface Trace {
  /** Ảnh chụp sau mỗi sự kiện. */
  readonly snapshots: Snapshot[];
  /** Trạng thái Host sau mỗi sự kiện. */
  readonly states: unknown[];
  /** Ảnh chụp đã nhớ sau mỗi sự kiện. */
  readonly cached: (Snapshot | undefined)[];
  /** Các lượt gọi kênh thay đổi. */
  readonly feed: { key: string; value: unknown; seq: number }[];
}

/**
 * Chạy MỘT kịch bản trên một giàn: đăng ký HAI đơn vị, tạo phiên, rồi lái từng sự kiện.
 * Nhận: giàn thử và kịch bản.
 * Trả: dấu vết để đối chứng từng bước với bản kia.
 */
function runScript(rig: Rig, script: readonly FakeEvent[]): Trace {
  const feed: { key: string; value: unknown; seq: number }[] = [];
  rig.registry.register(todoDefinition());
  rig.registry.register(noteDefinition());
  rig.registry.onChanged((_session, key, value, seq) => {
    feed.push({ key, value, seq });
  });
  const session = new FakeSession();
  rig.ctx.emit("session/created", session);
  const trace: Trace = { snapshots: [], states: [], cached: [], feed };
  for (const event of script) {
    session.append(event);
    rig.ctx.emit("session/event", session, event);
    trace.snapshots.push(rig.registry.snapshot(session));
    trace.states.push(rig.registry.stateOf(session, "todos"));
    trace.cached.push(rig.registry.cachedSnapshot(session));
  }
  return trace;
}

describe("bước 0 — cặp row trong oracle dump + hình dạng gói", () => {
  test("ca 0a: cặp '- id: session-projection' + name gốc CÓ THẬT trong ours.yml mới nhất, ĐANG BẬT, KHÔNG config", () => {
    const dumps = join(REPO, ".parity", "dumps");
    expect(existsSync(dumps)).toBe(true);
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .at(-1);
    expect(newest).toBeDefined();
    const yml = readFileSync(join(dumps, newest as string, "ours.yml"), "utf8").split("\n");
    const at = yml.findIndex((line) => line.trim() === "- id: session-projection");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(yml[at + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-session-projection'");
    // HÌNH DẠNG GỐC: chỉ `name` — KHÔNG `config` (kể cả dạng `!!js …`). Bản dump MỚI NHẤT có thể mang
    // thêm `disabled: true` nếu patch của ta đã tắt row (đúng cơ chế disable+insert) ⇒ bỏ đúng dòng đó
    // rồi so phần còn lại; `config` thì KHÔNG BAO GIỜ được xuất hiện.
    const end = yml.findIndex((line, index) => index > at && line.startsWith("- "));
    const rowLines = yml.slice(at + 1, end < 0 ? yml.length : end).filter((line) => line.trim() !== "" && !line.startsWith("#"));
    expect(rowLines.some((line) => line.includes("config:"))).toBe(false);
    const canonical = rowLines.filter((line) => !line.trim().startsWith("disabled:"));
    expect(canonical.length).toBe(1);
    expect(canonical[0]?.trim()).toBe("name: '@deepseek-ai/dsh-session-projection'");
  });

  test("ca 0b: gói gốc MỘT MẶT — lib/client.js KHÔNG tồn tại, manifest gốc KHÔNG có dsh.client", () => {
    expect(existsSync(join(STOCK, "lib", "client.js"))).toBe(false);
    const stockManifest = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { dsh?: unknown };
    expect(stockManifest.dsh).toBeUndefined();
    expect(readManifest().dsh).toBeUndefined();
  });

  test("ca 0c: `gbh.row` do LEAD khai NGOÀI phiên viết gói — hình dạng ĐÚNG: id + tests, KHÔNG config", () => {
    // ⚠️ Phiên này viết gói ở trạng thái CHƯA khai; khoá `row` xuất hiện trong lúc phiên đang chạy
    // (do Lead, cùng lượt sinh `profiles/blackhole/app.patch.yml`) — KHÔNG phải phiên này khai.
    // Ca test ghi lại HÌNH DẠNG phải giữ, và đọc CẢ HAI dạng để gỡ mount không làm đỏ oan (recipe
    // mục "gỡ mount": `gbh.row ?? gbh.row_unmounted_ly_do?.row`).
    const manifest = readManifest();
    const row = manifest.gbh?.row ?? manifest.gbh?.row_unmounted_ly_do?.row;
    expect(row).toEqual({ id: "session-projection", tests: ["tests/host/session-projection.test.ts"] });
    // Row MỘT MẶT và row gốc KHÔNG mang `config` ⇒ ba khoá này phải VẮNG.
    expect(row?.config).toBeUndefined();
    expect(row?.moduleIds).toBeUndefined();
    expect(row?.aliases).toBeUndefined();
    expect(manifest.gbh?.peers).toEqual(["@deepseek-ai/cordis"]);
  });

  test("ca 0d: KHÔNG import @deepseek-ai/dsh-session (ngoài bảng §3b) và KHÔNG shim ambient cho nó", () => {
    for (const name of ["brand.ts", "types.ts", "registry.ts", "index.ts"]) {
      const text = readFileSync(join(PKG, "src", name), "utf8");
      expect(text).not.toContain('from "@deepseek-ai/dsh-session"');
      expect(text).not.toContain('declare module "@deepseek-ai/dsh-session"');
    }
  });
});

describe("ARTIFACT — khuôn bundle và tập export", () => {
  test("ca 1: tập export ta = tập export gốc (đo trên văn bản lib/index.js đã build)", () => {
    const artifact = readFileSync(join(OUT, "index.js"), "utf8");
    const ours = exportNames(artifact);
    const theirs = exportNames(readFileSync(join(STOCK, "lib", "index.js"), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["SessionProjectionRegistry", "default"]);
    // Row HOST-ONLY: bundle không đăng ký id module nào, không đụng bộ nạp client.
    expect(artifact.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(artifact.match(/__ModuleLoader__/g)?.length ?? 0).toBe(0);
    // Export mặc định LÀ chính lớp đó (đúng bản gốc), không phải một factory khác.
    expect(ourMod.default).toBe(ourMod.SessionProjectionRegistry);
    expect(STOCKED.mod.default).toBe(STOCKED.mod.SessionProjectionRegistry);
  });

  test("ca 2: build.ts nhận thư mục đích qua process.argv[2]", () => {
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("ca 3: luật 000e — locale/{en,zh}.json chép BYTE-FOR-BYTE và có trong exports", () => {
    for (const locale of ["en", "zh"]) {
      const name = `locale/${locale}.json`;
      expect(sha256(readFileSync(join(PKG, name), "utf8"))).toBe(sha256(readFileSync(join(STOCK, name), "utf8")));
    }
    expect(readManifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});

describe("peer — gbh.peers ⊆ peerDependencies, so PHẦN TỬ", () => {
  test("ca 4: manifest thật 0 tên lệch; peer KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(["@deepseek-ai/cordis"]);
    expect(manifest.dependencies).toBeUndefined();
  });

  test("ca 5: ĐỐI CHỨNG ÂM — xoá peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = {};
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/cordis"]);
  });

  test("ca 6: đối chứng âm thứ hai — CÙNG số lượng mà lệch phần tử vẫn bị bắt; thừa tên vẫn ĐẠT", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = { "@deepseek-ai/schemastery": "~3.18.5" };
    expect(Object.keys(broken.peerDependencies).length).toBe(1);
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/cordis"]);
    const extra = cloneManifest(readManifest());
    extra.peerDependencies = { ...extra.peerDependencies, "@deepseek-ai/schemastery": "~3.18.5" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("SessionSeq/SessionLogOffset — bản địa phương phải Y HỆT kernel", () => {
  test("ca 7: giá trị hợp lệ trả CHÍNH số đó; giá trị sai ném CÙNG lớp + CÙNG câu (5 dạng mỗi hàm)", () => {
    for (const value of [0, 1, 2, 41, Number.MAX_SAFE_INTEGER]) {
      expect(Object.is(SessionSeq(value), kernel.SessionSeq(value))).toBe(true);
      expect(Object.is(SessionLogOffset(value), kernel.SessionLogOffset(value))).toBe(true);
      expect(SessionSeq(value) as number).toBe(value);
      expect(SessionLogOffset(value) as number).toBe(value);
    }
    const bad = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, -0];
    for (const value of bad) {
      expect(errorOf(() => SessionSeq(value))).toBe(errorOf(() => kernel.SessionSeq(value)));
      expect(errorOf(() => SessionSeq(value))).toBe(
        `TypeError: SessionSeq must be a non-negative safe integer, got ${String(value)}`,
      );
      expect(errorOf(() => SessionLogOffset(value))).toBe(errorOf(() => kernel.SessionLogOffset(value)));
      expect(errorOf(() => SessionLogOffset(value))).toBe(
        `TypeError: SessionLogOffset must be a non-negative safe integer, got ${String(value)}`,
      );
    }
  });
});

describe("bề mặt dịch vụ — mount trên Context cordis THẬT", () => {
  test("ca 8: cài `sessionProjections` đúng tên; cùng prototype; KHÔNG Config, KHÔNG inject tĩnh", async () => {
    const ours = makeRig(OUR);
    const theirs = makeRig(STOCKED);
    // `ctx.get` trả thể hiện ĐÃ ĐĂNG KÝ của kernel (cordis bọc dịch vụ), không phải chính vật ta dựng
    // — nên so TÊN + BỀ MẶT, không so danh tính với biến cục bộ.
    const installedOurs = ours.ctx.get("sessionProjections") as { name?: string; snapshot?: unknown };
    const installedTheirs = theirs.ctx.get("sessionProjections") as { name?: string; snapshot?: unknown };
    expect(installedOurs.name).toBe(installedTheirs.name);
    expect(installedOurs.name).toBe("sessionProjections");
    expect(typeof installedOurs.snapshot).toBe("function");
    expect(typeof installedTheirs.snapshot).toBe("function");
    expect((ours.registry as unknown as { name: string }).name).toBe("sessionProjections");
    expect(ours.ctx.fiber?.state).toBe(2);
    const oursStatics = ourMod.SessionProjectionRegistry as unknown as { Config?: unknown; inject?: unknown };
    const theirsStatics = STOCKED.mod.SessionProjectionRegistry as unknown as { Config?: unknown; inject?: unknown };
    expect(oursStatics.Config).toBeUndefined();
    expect(theirsStatics.Config).toBeUndefined();
    expect(oursStatics.inject).toBeUndefined();
    expect(theirsStatics.inject).toBeUndefined();
    const ourService = ((await import(OUR_CORDIS)) as unknown as { Service: { prototype: object } }).Service;
    expect(Object.getPrototypeOf(ourMod.SessionProjectionRegistry.prototype) as object).toBe(ourService.prototype);
  });

  test("ca 8b: ĐƯỜNG NẠP THẬT của kernel (`ctx.plugin`) cài đúng dịch vụ cho CẢ HAI bản cài", async () => {
    for (const install of [OUR, STOCKED]) {
      const ctx = new install.Context();
      ctx.plugin(install.mod.default);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const service = ctx.get("sessionProjections") as { name?: string } | undefined;
      expect(service).toBeDefined();
      expect(service?.name).toBe("sessionProjections");
      expect(service instanceof install.mod.SessionProjectionRegistry).toBe(true);
      expect(ctx.fiber?.state).toBe(2);
    }
  });

  test("ca 9: stateVersion sai / khoá trùng khác phiên bản ⇒ NÉM đúng câu của bản gốc", () => {
    const ours = makeRig(OUR);
    const theirs = makeRig(STOCKED);
    const bad = { ...todoDefinition(), stateVersion: 1.5 };
    const badOurs = errorOf(() => ours.registry.register(bad));
    const badTheirs = errorOf(() => theirs.registry.register(bad));
    expect(badOurs).toBe(badTheirs);
    expect(badOurs).toBe('Error: session projection "todos" stateVersion must be a non-negative integer, got 1.5');
    ours.registry.register(todoDefinition());
    theirs.registry.register(todoDefinition());
    const clash = { ...todoDefinition(), stateVersion: 2 };
    const clashOurs = errorOf(() => ours.registry.register(clash));
    const clashTheirs = errorOf(() => theirs.registry.register(clash));
    expect(clashOurs).toBe(clashTheirs);
    expect(clashOurs).toContain("is already registered at stateVersion 1; refusing to share it with stateVersion 2");
  });
});

describe("hành vi — A/B trực tiếp với chính bundle gốc trên CÙNG kịch bản", () => {
  test("ca 10: lái eager khớp TỪNG BƯỚC (ảnh chụp · trạng thái · ảnh chụp đã nhớ · kênh thay đổi)", () => {
    const mine = runScript(makeRig(OUR), SCRIPT);
    const theirs = runScript(makeRig(STOCKED), SCRIPT);
    expect(mine.snapshots.length).toBe(SCRIPT.length);
    for (let index = 0; index < SCRIPT.length; index += 1) {
      expect(mine.snapshots[index]).toEqual(theirs.snapshots[index]);
      expect(mine.states[index]).toEqual(theirs.states[index]);
      expect(mine.cached[index]).toEqual(theirs.cached[index]);
    }
    // Neo giá trị cụ thể để test không "xanh rỗng" khi cả hai cùng sai.
    expect(mine.states.at(-1)).toEqual({ items: ["việc một", "việc hai", "việc ba"], count: 4 });
    expect(mine.snapshots.at(-1)).toEqual({ asOfSeq: 7, values: { todos: ["việc một", "việc hai", "việc ba"] } });
    // Đơn vị CHỈ-HOST không bao giờ lọt vào ảnh chụp Client.
    expect(Object.keys(mine.snapshots.at(-1)?.values ?? {})).toEqual(["todos"]);
    expect(mine.feed).toEqual(theirs.feed);
    // `todo/tick` (seq 2) đổi TRẠNG THÁI mà GIỮ khung nhìn ⇒ KHÔNG phát; các lượt thêm thì phát.
    expect(mine.feed.map((call) => call.seq)).toEqual([1, 4, 6]);
    expect(mine.feed.map((call) => call.key)).toEqual(["todos", "todos", "todos"]);
  });

  test("ca 11: lọc `keys` + không có listener ⇒ kênh im; nghe lại thì phát đúng MỘT lần", () => {
    const script: readonly FakeEvent[] = [
      { type: "session/start", seq: 0 },
      { type: "todo/add", seq: 1, data: "một" },
      { type: "todo/tick", seq: 2 },
      { type: "todo/add", seq: 3, data: "hai" },
    ];
    const run = (rig: Rig): unknown => {
      const feed: string[] = [];
      rig.registry.register(todoDefinition());
      rig.registry.register(noteDefinition());
      const session = new FakeSession();
      rig.ctx.emit("session/created", session);
      session.append(script[0] as FakeEvent);
      rig.ctx.emit("session/event", session, script[0]);
      const filtered = rig.registry.snapshot(session, ["notes"]);
      const dispose = rig.registry.onChanged((_s, key, _value, seq) => feed.push(`${key}@${seq}`));
      session.append(script[1] as FakeEvent);
      rig.ctx.emit("session/event", session, script[1]);
      session.append(script[2] as FakeEvent);
      rig.ctx.emit("session/event", session, script[2]);
      const afterTick = [...feed];
      session.append(script[3] as FakeEvent);
      rig.ctx.emit("session/event", session, script[3]);
      dispose();
      return { filtered, afterTick, feed: [...feed] };
    };
    const mine = run(makeRig(OUR));
    const theirs = run(makeRig(STOCKED));
    expect(mine).toEqual(theirs);
    const typed = mine as { filtered: Snapshot; afterTick: string[]; feed: string[] };
    expect(typed.filtered).toEqual({ asOfSeq: 0, values: {} });
    expect(typed.afterTick).toEqual(["todos@1"]);
    expect(typed.feed).toEqual(["todos@1", "todos@3"]);
  });

  test("ca 12: checkpoint (bản sao TÁCH RỜI) · restoreFloor · viewCheckpoint khớp bản gốc", () => {
    const run = (install: Install): unknown => {
      const rig = makeRig(install);
      rig.registry.register(todoDefinition());
      rig.registry.register(noteDefinition());
      const session = new FakeSession();
      rig.ctx.emit("session/created", session);
      for (const event of SCRIPT.slice(0, 5)) {
        session.append(event);
        rig.ctx.emit("session/event", session, event);
      }
      const rows = rig.registry.checkpoint(session);
      return {
        rows,
        floor: rig.registry.restoreFloor(rows),
        viewed: rig.registry.viewCheckpoint(rows),
        viewedOnly: rig.registry.viewCheckpoint(rows, ["todos"]),
        stale: rig.registry.viewCheckpoint({
          todos: { ver: 2, seq: 4, val: { items: ["cũ"], count: 1 } },
          notes: { ver: 1, seq: 4, val: { items: [], count: 0 } },
        }),
        malformed: rig.registry.viewCheckpoint({ todos: { ver: 1, seq: 4, val: { hỏng: true } } }),
        floorEmpty: makeRig(install).registry.restoreFloor({}),
      };
    };
    const mine = run(OUR);
    const theirs = run(STOCKED);
    expect(mine).toEqual(theirs);
    const typed = mine as { rows: Checkpoint; floor: number; viewed: Record<string, unknown>; floorEmpty: undefined };
    expect(typed.rows.todos).toEqual({ ver: 1, seq: 4, val: { items: ["việc một", "việc hai"], count: 3 } });
    expect(typed.floor).toBe(4);
    expect(typed.viewed).toEqual({ todos: ["việc một", "việc hai"] });
    expect(typed.floorEmpty).toBeUndefined();
  });

  test("ca 13: restore khớp — mồi từ checkpoint, gộp lại khi dòng cũ, và 2 ĐƯỜNG LỖI", () => {
    const run = (install: Install): unknown => {
      const rig = makeRig(install);
      rig.registry.register(todoDefinition());
      const session = new FakeSession();
      rig.ctx.emit("session/created", session);
      for (const event of SCRIPT.slice(0, 4)) {
        session.append(event);
        rig.ctx.emit("session/event", session, event);
      }
      const rows = rig.registry.checkpoint(session);
      const events = session.snapshotEvents(0, session.seq);
      return {
        seeded: rig.registry.restore(rows, events, SessionLogOffset(0), session.header, SessionLogOffset(0)),
        refolded: rig.registry.restore(
          { todos: { ver: 9, seq: 3, val: { items: ["cũ"], count: 1 } } },
          events,
          SessionLogOffset(0),
          session.header,
          SessionLogOffset(0),
        ),
        staleRejected: errorOf(() =>
          rig.registry.restore(
            { todos: { ver: 9, seq: 3, val: {} } },
            events,
            SessionLogOffset(1),
            session.header,
            SessionLogOffset(0),
          ),
        ),
        gap: errorOf(() =>
          rig.registry.restore(
            {},
            [SCRIPT[0] as FakeEvent, SCRIPT[2] as FakeEvent],
            SessionLogOffset(0),
            session.header,
            SessionLogOffset(0),
          ),
        ),
      };
    };
    const mine = run(OUR);
    const theirs = run(STOCKED);
    expect(mine).toEqual(theirs);
    const typed = mine as {
      seeded: { snapshot: Snapshot; checkpoint: Checkpoint };
      refolded: { snapshot: Snapshot };
      staleRejected: string;
      gap: string;
    };
    expect(typed.seeded.snapshot).toEqual({ asOfSeq: 3, values: { todos: ["việc một"] } });
    expect(typed.seeded.checkpoint.todos?.ver).toBe(1);
    expect(typed.refolded.snapshot).toEqual({ asOfSeq: 3, values: { todos: ["việc một"] } });
    expect(typed.staleRejected).toContain("cannot restore from seq 1: its checkpoint row is missing");
    expect(typed.gap).toBe('Error: session projection "todos" cannot restore across missing seq 1');
  });

  test("ca 14: hydrate khớp — cài ô từ checkpoint rồi lái tiếp; và nhánh ô ĐÃ ĐỦ", () => {
    const run = (install: Install, preDriven: boolean): unknown => {
      const rig = makeRig(install);
      rig.registry.register(todoDefinition());
      const seeded = new FakeSession();
      rig.ctx.emit("session/created", seeded);
      for (const event of SCRIPT.slice(0, 4)) {
        seeded.append(event);
        rig.ctx.emit("session/event", seeded, event);
      }
      const rows = rig.registry.checkpoint(seeded);
      const target = new FakeSession();
      for (const event of SCRIPT.slice(0, 4)) target.append(event);
      if (preDriven) {
        rig.ctx.emit("session/created", target);
        for (const event of SCRIPT.slice(0, 4)) rig.ctx.emit("session/event", target, event);
      }
      const hydrated = rig.registry.hydrate(target, rows, SCRIPT.slice(0, 4), SessionLogOffset(0));
      target.append(SCRIPT[4] as FakeEvent);
      rig.ctx.emit("session/event", target, SCRIPT[4]);
      return { hydrated, after: rig.registry.snapshot(target) };
    };
    for (const preDriven of [false, true]) {
      const mine = run(OUR, preDriven);
      const theirs = run(STOCKED, preDriven);
      expect(mine).toEqual(theirs);
    }
    const fresh = run(OUR, false) as { hydrated: Snapshot; after: Snapshot };
    expect(fresh.hydrated).toEqual({ asOfSeq: 3, values: { todos: ["việc một"] } });
    expect(fresh.after).toEqual({ asOfSeq: 4, values: { todos: ["việc một", "việc hai"] } });
  });
});

describe("C6 — vật thể cấu hình/trạng thái phải ĐỘC LẬP (kiểm bằng DANH TÍNH)", () => {
  test("ca 15: hai sổ có sổ đăng ký RIÊNG; gỡ mount bên này không lan bên kia", () => {
    const a = makeRig(OUR);
    const b = makeRig(OUR);
    const disposeA = a.registry.register(todoDefinition());
    b.registry.register(todoDefinition());
    expect((a.registry as unknown as { registrations: unknown }).registrations).not.toBe(
      (b.registry as unknown as { registrations: unknown }).registrations,
    );
    const session = new FakeSession();
    a.ctx.emit("session/created", session);
    b.ctx.emit("session/created", session);
    disposeA();
    expect(a.registry.stateOf(session, "todos")).toBeUndefined();
    expect(b.registry.stateOf(session, "todos")).toEqual({ items: [], count: 0 });
  });

  test("ca 16: ĐẾM người đăng ký cùng khoá — khoá sống tới lượt CUỐI rút (ta và gốc giống nhau)", () => {
    for (const install of [OUR, STOCKED]) {
      const rig = makeRig(install);
      const first = rig.registry.register(todoDefinition());
      const second = rig.registry.register(todoDefinition());
      const session = new FakeSession();
      rig.ctx.emit("session/created", session);
      first();
      expect(rig.registry.stateOf(session, "todos")).toEqual({ items: [], count: 0 });
      second();
      expect(rig.registry.stateOf(session, "todos")).toBeUndefined();
    }
  });

  test("ca 17: checkpoint trả bản sao TÁCH RỜI mỗi lượt; sửa bản sao KHÔNG lan vào ô sống", () => {
    for (const install of [OUR, STOCKED]) {
      const rig = makeRig(install);
      const dispose = rig.registry.register(todoDefinition());
      const session = new FakeSession();
      rig.ctx.emit("session/created", session);
      for (const event of SCRIPT.slice(0, 2)) {
        session.append(event);
        rig.ctx.emit("session/event", session, event);
      }
      const first = rig.registry.checkpoint(session);
      const second = rig.registry.checkpoint(session);
      expect(first.todos).toEqual(second.todos);
      expect(first.todos).not.toBe(second.todos);
      expect(first.todos?.val).not.toBe(second.todos?.val);
      expect(first.todos?.val).not.toBe(rig.registry.stateOf(session, "todos"));
      (first.todos?.val as { items: string[] }).items.push("bị sửa");
      expect(rig.registry.stateOf(session, "todos")).toEqual({ items: ["việc một"], count: 1 });
      // Hai ẢNH CHỤP cũng là hai vật thể riêng.
      expect(rig.registry.snapshot(session).values).not.toBe(rig.registry.snapshot(session).values);
      dispose();
    }
  });

  test("ca 18: hai PHIÊN có ô RIÊNG; phiên cũ hơn sổ được gộp LƯỜI đúng như bản gốc", () => {
    const script: readonly FakeEvent[] = [
      { type: "session/start", seq: 0 },
      { type: "todo/add", seq: 1, data: "việc một" },
      { type: "todo/add", seq: 2, data: "việc hai" },
    ];
    for (const install of [OUR, STOCKED]) {
      const rig = makeRig(install);
      const dispose = rig.registry.register(todoDefinition());
      // Phiên CŨ HƠN sổ: log đã có sẵn TRƯỚC khi sổ này nghe sự kiện.
      const older = new FakeSession();
      for (const event of script) older.append(event);
      const newer = new FakeSession();
      rig.ctx.emit("session/created", newer);
      newer.append(script[0] as FakeEvent);
      rig.ctx.emit("session/event", newer, script[0]);
      newer.append(script[1] as FakeEvent);
      rig.ctx.emit("session/event", newer, script[1]);
      expect(rig.registry.snapshot(newer)).toEqual({ asOfSeq: 1, values: { todos: ["việc một"] } });
      expect(rig.registry.snapshot(older)).toEqual({ asOfSeq: 2, values: { todos: ["việc một", "việc hai"] } });
      expect(rig.registry.stateOf(older, "todos")).toEqual({ items: ["việc một", "việc hai"], count: 2 });
      dispose();
    }
  });
});
