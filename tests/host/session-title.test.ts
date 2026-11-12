/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-session-title (row session-title): bước 0 đọc cặp row và
 *      `config` gốc trong oracle dump, tập export đo trên ARTIFACT, đối chứng TỪNG BƯỚC với chính
 *      bundle gốc trên Context cordis THẬT (chuẩn hoá · hai đơn vị chiếu · dịch vụ · đường lỗi),
 *      quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca C6 (DANH TÍNH), luật 000e (locale
 *      byte-for-byte), và TEST CANH chống khai gbh.row sớm.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session-title/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-title");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của MỌI ca A/B. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-title");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với bản của bundle gốc. */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Cấu hình gốc đo được trong oracle dump — KHÔNG có trường nào khác. */
const STOCK_CONFIG = { fallbackMaxWords: 5, fallbackMaxBytes: 40, maxTitleBytes: 80 };

/** Một sự kiện phiên dựng trong test (khai theo CẤU TRÚC như seam thật). */
interface Event {
  /** Loại sự kiện. */
  type: string;
  /** Vị trí trong log. */
  seq: number;
  /** Thời điểm. */
  time: number;
  /** Dữ liệu sự kiện. */
  data: unknown;
}

/** Ảnh chụp tiêu đề mà cả hai bản cài trả về. */
interface Snapshot {
  /** Văn bản tiêu đề đã chuẩn hoá. */
  readonly title: string;
  /** Các seq người dùng được trích. */
  readonly messageSeqs: readonly number[];
  /** Nguồn tiêu đề. */
  readonly source: {
    /** `fallback` · `provider` · `user`. */
    readonly kind: string;
    /** Provider đã sinh (khi `kind === "provider"`). */
    readonly provider?: string;
    /** Tuyến mô hình phụ (khi có). */
    readonly model?: { readonly provider: string; readonly model: string };
  };
  /** Seq của sự kiện tiêu đề. */
  readonly eventSeq: number;
  /** Thời điểm của sự kiện tiêu đề. */
  readonly updatedAt: number;
}

/** Phiên giả dùng cho cả hai bản cài. */
interface FakeSession {
  /** Id phiên. */
  readonly id: string;
  /** Phong bì đầu phiên. */
  readonly header: { readonly parentSession?: unknown };
  /** Log sự kiện (mảng sống để test đọc). */
  readonly events: Event[];
  /** Ghi một sự kiện — đúng đường mà dịch vụ dùng. */
  append(type: string, data: unknown): void;
  /** Ảnh chụp log. */
  snapshotEvents(): readonly Event[];
  /** Tuyến yêu cầu chính đã ghi. */
  requestHeader(): { readonly config: { readonly provider: string; readonly model: string } } | undefined;
}

/** Yêu cầu mà provider nhận. */
interface ProviderRequest {
  /** Phiên đang được đặt tiêu đề. */
  readonly session: FakeSession;
  /** Các tin hợp lệ của lần sinh này. */
  readonly messages: readonly { readonly seq: number; readonly text: string }[];
  /** Tuyến đã ghi (nếu có). */
  readonly route?: { readonly provider: string; readonly model: string };
  /** Tiêu đề đã nhận mới nhất lúc gọi (nếu có). */
  readonly currentTitle?: Snapshot;
  /** Tín hiệu huỷ. */
  readonly signal: AbortSignal;
}

/** Một lần đăng ký provider. */
interface Provider {
  /** Id provider. */
  readonly id: string;
  /** Nhịp sinh. */
  readonly automatic: "first-prompt" | "all-prompts";
  /**
   * Sinh một tiêu đề.
   * Nhận: yêu cầu của dịch vụ.
   * Trả: kết quả đề nghị.
   */
  generate(request: ProviderRequest): Promise<{
    /** Văn bản đề nghị. */
    readonly title: string;
    /** Các seq nguồn. */
    readonly messageSeqs: readonly number[];
    /** Tuyến mô hình phụ (khi có). */
    readonly model?: { readonly provider: string; readonly model: string };
  }>;
}

/** Một đơn vị chiếu (khai theo CẤU TRÚC, đúng hình dạng seam nhận). */
interface Definition<State, View> {
  /** Khoá chiếu. */
  readonly key: string;
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
  /** Schema trạng thái — seam CHỈ gọi `parse`. */
  readonly stateSchema: { parse(value: unknown): State };
  /** Trạng thái rỗng. */
  init(): State;
  /** Phép gộp thuần. */
  apply(state: State, event: Event): State;
  /** Khung nhìn dây (chỉ `title` khai). */
  readonly wire?: {
    /** Schema khung nhìn. */
    readonly viewSchema: { parse(value: unknown): View };
    /** Hàm chiếu. */
    view(state: State): View;
  };
}

/** Bề mặt dịch vụ mà test dùng. */
interface Service {
  /** Đọc tiêu đề đã gộp. */
  get(session: FakeSession): Snapshot | undefined;
  /** Đổi tên tường minh. */
  rename(session: FakeSession, title: string): Snapshot;
  /** Thử lại provider hoặc vật chất hoá dự phòng. */
  refresh(session: FakeSession, signal?: AbortSignal): Promise<Snapshot | undefined>;
  /** Đăng ký provider duy nhất. */
  register(provider: Provider): () => Promise<void>;
}

/** Hình dạng module của CẢ HAI bản cài (cùng một tập export). */
interface Module {
  /** Lớp dịch vụ. */
  readonly SessionTitleService: new (ctx: unknown, config: typeof STOCK_CONFIG) => Service;
  /** Hàm đóng dấu provider id. */
  readonly SessionTitleProviderId: (id: string) => string;
  /** Lớp lỗi đầu vào. */
  readonly SessionTitleInvalidError: new (message: string) => Error;
  /** Đơn vị chiếu `title`. */
  readonly titleProjectionDefinition: Definition<string | null, string | null>;
  /** Phép dự phòng tất định. */
  readonly fallbackSessionTitle: (input: string, maxWords: number, maxBytes: number) => string;
  /** Chuẩn hoá tiêu đề. */
  readonly normalizeSessionTitle: (input: string, maxBytes: number) => string;
  /** Cắt theo ngân sách byte UTF-8. */
  readonly truncateTitleUtf8: (input: string, maxBytes: number) => string;
  /** Gộp tiêu đề từ log. */
  readonly foldSessionTitle: (events: readonly Event[]) => Snapshot | undefined;
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata nửa client của DSH (bản gốc không có). */
  dsh?: { client?: unknown };
  /** Metadata row — `row` do LEAD khai; `row_unmounted_ly_do` là dạng ĐÃ GỠ (`{ ly_do, row }`). */
  gbh?: {
    /** Peer của ta — phải ⊆ `peerDependencies`. */
    peers?: string[];
    /** Khoá row đang mount. */
    row?: { id: string; config?: unknown; tests?: string[] } & Record<string, unknown>;
    /** Dạng ĐÃ GỠ MOUNT: giữ nguyên row cũ + lý do. */
    row_unmounted_ly_do?: { ly_do?: string; row?: unknown };
    /** Đường dẫn test được máy kiểm (ràng buộc G4). */
    tests?: string[];
  };
}

/** Context cordis tối thiểu mà test dùng. */
interface CordisContext {
  /** Cấp một service giả cho seam. */
  provide(name: string, value: unknown): void;
  /** Tra một service theo tên. */
  get(name: string): unknown;
  /** Phát một sự kiện. */
  emit(...args: unknown[]): void;
  /** Fiber của context gốc. */
  fiber: { uid: number | null; state: number };
}

/** Bản gốc đã nạp; kiểu để hở vì đây là bundle đã build của gói khác. */
const stock = (await import(join(STOCK, "lib", "index.js"))) as unknown as Module;
/** Bản CỦA TA nạp từ NGUỒN (artifact được đo riêng bằng văn bản ở ca 1). */
const ours = (await import(join(PKG, "src", "index.ts"))) as unknown as Module;
/** cordis của kernel — nạp theo đường dẫn tính lúc chạy. */
const cordis = (await import(OUR_CORDIS)) as { Context: new () => CordisContext };

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

/** Sổ chiếu giả của một lần cài: giữ định nghĩa đã đăng ký và trạng thái đã gộp. */
interface ProjectionBook {
  /** Định nghĩa theo khoá. */
  readonly definitions: Map<string, Definition<unknown, unknown>>;
  /** Trạng thái đã gộp theo khoá. */
  readonly states: Map<string, unknown>;
}

/** Một lần cài trên Context cordis THẬT: context, dịch vụ, sổ phiên, sổ chiếu. */
interface Installed {
  /** Context cordis. */
  readonly ctx: CordisContext;
  /** Dịch vụ đã đăng ký. */
  readonly service: Service;
  /** Sổ phiên sống theo id. */
  readonly sessions: Map<string, FakeSession>;
  /** Sổ chiếu. */
  readonly book: ProjectionBook;
  /**
   * Dựng một phiên sống gắn vào sổ này.
   * Nhận: id phiên và phong bì đầu phiên.
   * Trả: phiên giả; mỗi `append` cập nhật sổ chiếu rồi phát `session/event`.
   */
  makeSession(id: string, header?: { readonly parentSession?: unknown }): FakeSession;
}

/**
 * Cài MỘT bản dịch vụ trên Context cordis THẬT với hai seam giả có ghi vết.
 * Nhận: module cần cài (ta hoặc gốc).
 * Trả: context, dịch vụ, sổ phiên và sổ chiếu để chạy kịch bản.
 */
function install(module: Module): Installed {
  const ctx = new cordis.Context();
  const book: ProjectionBook = { definitions: new Map(), states: new Map() };
  const sessions = new Map<string, FakeSession>();
  ctx.provide("sessionProjections", {
    register(definition: Definition<unknown, unknown>): () => void {
      book.definitions.set(definition.key, definition);
      book.states.set(definition.key, definition.init());
      return () => book.definitions.delete(definition.key);
    },
    stateOf(_session: FakeSession, key: string): unknown {
      return book.states.get(key);
    },
  });
  ctx.provide("sessions", {
    get: (id: string): FakeSession | undefined => sessions.get(id),
    list: (): FakeSession[] => [...sessions.values()],
  });
  const service = new module.SessionTitleService(ctx, STOCK_CONFIG);
  const makeSession = (id: string, header: { readonly parentSession?: unknown } = {}): FakeSession => {
    const events: Event[] = [];
    const session: FakeSession = {
      id,
      header,
      events,
      append(type: string, data: unknown): void {
        const event: Event = { type, seq: events.length, time: 1000 + events.length, data };
        events.push(event);
        for (const [key, definition] of book.definitions) {
          book.states.set(key, definition.apply(book.states.get(key), event));
        }
        ctx.emit("session/event", session, event);
      },
      snapshotEvents(): readonly Event[] {
        return events;
      },
      requestHeader(): { readonly config: { readonly provider: string; readonly model: string } } | undefined {
        const header = events.findLast((event) => event.type === "request/header");
        return (header?.data as { header: { config: { provider: string; model: string } } } | undefined)?.header;
      },
    };
    sessions.set(id, session);
    return session;
  };
  return { ctx, service, sessions, book, makeSession };
}

/**
 * Dựng MỘT dịch vụ trên context MỚI với cấu hình cho trước — dùng để đo ĐƯỜNG LỖI CẤU HÌNH.
 * Nhận: module và cấu hình thô (có thể hỏng).
 * Trả: thực thể dịch vụ; ném khi cấu hình hỏng.
 */
function construct(module: Module, config: unknown): Service {
  const ctx = new cordis.Context();
  ctx.provide("sessionProjections", { register: () => () => undefined, stateOf: () => undefined });
  ctx.provide("sessions", { get: () => undefined, list: () => [] });
  return new module.SessionTitleService(ctx, config as typeof STOCK_CONFIG);
}

/** Một sự kiện `user/message` từ nguồn cho trước. */
function userEvent(source: string, text: string): unknown {
  return { source: { kind: source }, content: [{ type: "text", text }] };
}

/** Chờ cho các lời gọi đã `defer` chạy xong. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 15));
}

/**
 * Chạy một phép rồi mô tả kết quả thành chuỗi "lớp: câu" (hoặc "ok") — để so HAI bên.
 * Nhận: hàm cần chạy.
 * Trả: mô tả kết quả.
 */
async function outcome(run: () => unknown): Promise<string> {
  try {
    await run();
    return "ok";
  } catch (error) {
    const err = error as Error;
    return err.constructor.name + ": " + err.message;
  }
}

describe("bước 0 — cặp row trong oracle dump + hình dạng gói", () => {
  test("ca 0a: cặp '- id: session-title' + name gốc CÓ THẬT trong ours.yml mới nhất, KHÔNG disabled, config nguyên văn", () => {
    const dumps = join(REPO, ".parity", "dumps");
    expect(existsSync(dumps)).toBe(true);
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .at(-1);
    expect(newest).toBeDefined();
    // ⚠️ KHÔNG chỉ đọc dump MỚI NHẤT: ngay khi row của ta được MOUNT, row stock trong dump mới sẽ bị
    // `disabled: true` (đúng vậy với `session-turn-outline` trong dump 2026-10-18T01-31-57 — test ca 0a
    // của gói đó đỏ vì đọc cứng dump mới nhất). Vì vậy: lấy dump MỚI NHẤT mà row còn ĐANG BẬT.
    const active = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .reverse()
      .find((name) => {
        const text = readFileSync(join(dumps, name, "ours.yml"), "utf8");
        const start = text.split("\n").findIndex((line) => line.trim() === "- id: session-title");
        if (start < 0) return false;
        const rows = text.split("\n");
        const stop = rows.findIndex((line, index) => index > start && line.startsWith("- "));
        return !rows.slice(start, stop < 0 ? rows.length : stop).some((line) => line.includes("disabled"));
      });
    expect(active).toBeDefined();
    const lines = readFileSync(join(dumps, active as string, "ours.yml"), "utf8").split("\n");
    const at = lines.findIndex((line) => line.trim() === "- id: session-title");
    expect(at).toBeGreaterThanOrEqual(0);
    // SÁU dòng nguyên văn: id · name · config: · ba trường. Đây là config GỐC phải chép y nguyên —
    // và việc cả sáu dòng khớp chứng minh chúng là SCALAR THUẦN, KHÔNG có dạng !!js.
    expect(lines.slice(at, at + 6).map((line) => line.trim())).toEqual([
      "- id: session-title",
      "name: '@deepseek-ai/dsh-session-title'",
      "config:",
      "fallbackMaxWords: 5",
      "fallbackMaxBytes: 40",
      "maxTitleBytes: 80",
    ]);
    // Row ĐANG BẬT: không có disabled trong khối của row, và không có biểu thức !!js nào.
    const end = lines.findIndex((line, index) => index > at && line.startsWith("- "));
    const block = lines.slice(at, end < 0 ? lines.length : end);
    expect(block.some((line) => line.includes("disabled"))).toBe(false);
    expect(block.some((line) => line.includes("!!js"))).toBe(false);
  });

  test("ca 0b: gói gốc MỘT MẶT — lib/client.js KHÔNG tồn tại, lib/types/client.js chỉ là export rỗng", () => {
    expect(existsSync(join(STOCK, "lib", "client.js"))).toBe(false);
    const typesClient = readFileSync(join(STOCK, "lib", "types", "client.js"), "utf8");
    expect(typesClient).toContain("export {};");
    expect(typesClient).not.toContain("__ModuleLoader__");
    expect(typesClient).not.toContain("import ");
    const manifest = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as Manifest;
    expect(manifest.dsh?.client).toBeUndefined();
  });

  test("ca 0c: khoá row do LEAD khai NGOÀI phiên viết gói — hình dạng đúng: id + config GỐC + tests, KHÔNG moduleIds/aliases", () => {
    // Phiên viết gói KHÔNG tự khai row (chỉ đạo của Lead). Khoá xuất hiện trong lúc phiên này đang
    // chạy — do LEAD khai, với ĐÚNG bộ config ba trường đã ghi ở ca 0a. Ca test ghi lại HÌNH DẠNG
    // phải có và khẳng định không ai thêm `moduleIds`/`aliases`/`insertAs` (row MỘT MẶT, không bundle).
    // Đọc CẢ HAI dạng `row` (đang mount) và `row_unmounted_ly_do?.row` (đã gỡ) như công thức dặn.
    const manifest = readManifest();
    const row = manifest.gbh?.row ?? manifest.gbh?.row_unmounted_ly_do?.row;
    expect(row).toEqual({
      id: "session-title",
      config: { fallbackMaxWords: 5, fallbackMaxBytes: 40, maxTitleBytes: 80 },
      tests: ["tests/host/session-title.test.ts"],
    });
    expect(Object.keys(row as Record<string, unknown>).sort()).toEqual(["config", "id", "tests"]);
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.tests).toEqual(["tests/host/session-title.test.ts"]);
    expect(manifest.gbh?.peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-session-projection",
      "@deepseek-ai/schemastery",
    ]);
  });
});

describe("ARTIFACT — khuôn bundle và tập export", () => {
  test("ca 1: tập export ta = tập export gốc (đo trên văn bản lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-session-title-")));
    const artifactText = readFileSync(artifact, "utf8");
    const mine = exportNames(artifactText);
    const theirs = exportNames(readFileSync(join(STOCK, "lib", "index.js"), "utf8"));
    expect(mine).toEqual(theirs);
    expect(mine).toEqual([
      "SessionTitleInvalidError",
      "SessionTitleProviderId",
      "SessionTitleService",
      "default",
      "fallbackSessionTitle",
      "foldSessionTitle",
      "normalizeSessionTitle",
      "titleProjectionDefinition",
      "truncateTitleUtf8",
    ]);
    // Row HOST-ONLY: bundle không đăng ký id module nào, không đụng bộ nạp client.
    expect(artifactText.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(artifactText.match(/__ModuleLoader__/g)?.length ?? 0).toBe(0);
  });

  test("ca 2: build.ts nhận thư mục đích qua process.argv[2] (thiếu ⇒ profile không có lib ⇒ không sinh entry)", () => {
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("ca 3: luật 000e — locale/{en,zh}.json chép BYTE-FOR-BYTE và có trong exports", () => {
    for (const locale of ["en", "zh"]) {
      const name = join("locale", locale + ".json");
      expect(sha256(readFileSync(join(PKG, name), "utf8"))).toBe(sha256(readFileSync(join(STOCK, name), "utf8")));
    }
    expect(readManifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});

describe("peer — gbh.peers ⊆ peerDependencies, so PHẦN TỬ", () => {
  test("ca 4: manifest thật có 0 tên lệch, và peer KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["zod"]);
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-session-projection",
      "@deepseek-ai/schemastery",
    ]);
  });

  test("ca 5: ĐỐI CHỨNG ÂM — xoá peerDependencies ⇒ phép kiểm PHẢI báo đúng tên khai trong gbh.peers", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = {};
    expect(missingPeers(broken)).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-session-projection",
      "@deepseek-ai/schemastery",
    ]);
  });

  test("ca 6: đối chứng âm thứ hai — CÙNG số lượng mà lệch phần tử vẫn PHẢI bị bắt; thừa tên vẫn ĐẠT", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5" };
    expect(missingPeers(broken)).toEqual([
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-session-projection",
      "@deepseek-ai/schemastery",
    ]);
    const extra = cloneManifest(readManifest());
    extra.peerDependencies = { ...extra.peerDependencies, "@deepseek-ai/dsh-session": "0.2.1-alpha.4" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("chuẩn hoá văn bản — A/B với chính bundle gốc", () => {
  /** Bộ văn bản thô dùng cho cả ba hàm: mã màu, ký tự hướng, CJK, xuống dòng, rỗng. */
  const CORPUS = [
    "  Xin chào   thế giới  ",
    "\u001b[31mđỏ\u001b[0m và \u001b]0;tiêu đề\u0007 sau",
    "trái \u202Ephải\u202C",
    "một\nhai\tba",
    "tiếng Việt có dấu — và cả 中文 tiếng Trung",
    "   ",
    "",
    "x".repeat(120),
  ];

  test("ca 7: ba hàm chuẩn hoá khớp TỪNG KÝ TỰ trên bộ văn bản thô (nhiều ngân sách)", () => {
    for (const input of CORPUS) {
      for (const maxBytes of [1, 5, 40, 80, 200]) {
        expect(ours.normalizeSessionTitle(input, maxBytes)).toBe(stock.normalizeSessionTitle(input, maxBytes));
        expect(ours.truncateTitleUtf8(input, maxBytes)).toBe(stock.truncateTitleUtf8(input, maxBytes));
        for (const maxWords of [1, 3, 5]) {
          expect(ours.fallbackSessionTitle(input, maxWords, maxBytes)).toBe(
            stock.fallbackSessionTitle(input, maxWords, maxBytes),
          );
        }
      }
    }
  });

  test("ca 8: neo giá trị CỤ THỂ — cắt theo BYTE không chẻ đôi điểm mã, và trần từ của dự phòng", () => {
    // 中 là 3 byte: ngân sách 4 chỉ chứa được MỘT ký tự (3 byte), không phải hai.
    expect(ours.truncateTitleUtf8("中文", 4)).toBe("中");
    expect(ours.truncateTitleUtf8("中文", 3)).toBe("中");
    expect(ours.truncateTitleUtf8("中文", 2)).toBe("");
    expect(ours.fallbackSessionTitle("one two three four five six seven", 5, 40)).toBe("one two three four five");
    // "một" = 5 byte (ộ là 3 byte) · +space 6 · "h" 7 · "a" 8 · "i" 9 ⇒ dừng ở "một ha".
    expect(ours.fallbackSessionTitle("một hai ba bốn", 5, 8)).toBe("một ha");
    expect(ours.normalizeSessionTitle("\u001b[31mđỏ\u001b[0m", 80)).toBe("đỏ");
  });

  test("ca 9: đường lỗi — ngân sách 0/âm/không nguyên ném CÙNG lớp và CÙNG câu", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      let mine = "";
      let theirs = "";
      try {
        ours.normalizeSessionTitle("x", bad);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        stock.normalizeSessionTitle("x", bad);
      } catch (error) {
        theirs = (error as Error).message;
      }
      expect(mine).toBe(theirs);
      expect(mine).toBe("maxBytes must be a positive integer");
    }
    expect(() => ours.fallbackSessionTitle("x", 0, 40)).toThrow("maxWords must be a positive integer");
    expect(() => stock.fallbackSessionTitle("x", 0, 40)).toThrow("maxWords must be a positive integer");
  });
});

describe("hai đơn vị chiếu — A/B trên cùng một kịch bản", () => {
  /** Kịch bản: tin người dùng, tin agent, tin rỗng sau chuẩn hoá, tiêu đề, rồi tin thứ hai. */
  const SCRIPT: readonly Event[] = [
    { type: "session/start", seq: 0, time: 1, data: { header: {} } },
    { type: "user/message", seq: 1, time: 2, data: userEvent("user", "  Một  ") },
    { type: "user/message", seq: 2, time: 3, data: userEvent("agent", "bỏ qua") },
    { type: "user/message", seq: 3, time: 4, data: userEvent("user", "   ") },
    { type: "session/title", seq: 4, time: 5, data: { title: "Tiêu đề", messageSeqs: [1], source: { kind: "fallback" } } },
    { type: "user/message", seq: 5, time: 6, data: userEvent("user", "Hai") },
  ];

  test("ca 10: title — key/stateVersion/init/apply KHỚP TỪNG BƯỚC, và stateSchema LÀ viewSchema (một thể hiện)", () => {
    const mine = ours.titleProjectionDefinition;
    const theirs = stock.titleProjectionDefinition;
    expect(mine.key).toBe(theirs.key);
    expect(mine.key).toBe("title");
    expect(mine.stateVersion).toBe(theirs.stateVersion);
    expect(mine.stateVersion).toBe(1);
    expect(mine.init()).toBe(theirs.init());
    expect(mine.init()).toBeNull();
    const mineStateSchema: unknown = mine.stateSchema;
    const mineViewSchema: unknown = mine.wire?.viewSchema;
    const theirsStateSchema: unknown = theirs.stateSchema;
    const theirsViewSchema: unknown = theirs.wire?.viewSchema;
    // Bản gốc dùng CHÍNH một thể hiện schema cho cả trạng thái lẫn khung nhìn — đo DANH TÍNH.
    expect(mineStateSchema).toBe(mineViewSchema);
    expect(theirsStateSchema).toBe(theirsViewSchema);
    let a: string | null = mine.init();
    let b: string | null = theirs.init();
    for (const event of SCRIPT) {
      a = mine.apply(a, event);
      b = theirs.apply(b, event);
      expect(a).toBe(b);
    }
    expect(a).toBe("Tiêu đề");
    expect(mine.wire?.view(a)).toBe(theirs.wire?.view(b));
  });

  test("ca 11: titleInput — trạng thái tổng hợp O(1) KHỚP TỪNG BƯỚC (đo qua sổ chiếu lúc chạy)", () => {
    const mine = install(ours);
    const theirs = install(stock);
    const sessionMine = mine.makeSession("s1");
    const sessionTheirs = theirs.makeSession("s1");
    expect([...mine.book.definitions.keys()].sort()).toEqual([...theirs.book.definitions.keys()].sort());
    expect([...mine.book.definitions.keys()].sort()).toEqual(["title", "titleInput"]);
    for (const event of SCRIPT) {
      sessionMine.append(event.type, event.data);
      sessionTheirs.append(event.type, event.data);
      expect(mine.book.states.get("titleInput")).toEqual(theirs.book.states.get("titleInput"));
    }
    expect(mine.book.states.get("titleInput")).toEqual({ first: { seq: 1, text: "  Một  " }, count: 2, lastSeq: 5 });
    const titleInputMine = mine.book.definitions.get("titleInput") as Definition<unknown, unknown>;
    const titleInputTheirs = theirs.book.definitions.get("titleInput") as Definition<unknown, unknown>;
    expect(titleInputMine.key).toBe(titleInputTheirs.key);
    expect(titleInputMine.stateVersion).toBe(titleInputTheirs.stateVersion);
    expect(titleInputMine.stateVersion).toBe(3);
    expect(titleInputMine.wire).toBeUndefined();
    expect(titleInputTheirs.wire).toBeUndefined();
  });

  test("ca 12: schema — cùng chấp nhận, cùng từ chối, cùng câu lỗi (5 dạng hỏng)", () => {
    const stateSchema = (install(ours).book.definitions.get("titleInput") as Definition<unknown, unknown>).stateSchema;
    const stockStateSchema = (install(stock).book.definitions.get("titleInput") as Definition<unknown, unknown>)
      .stateSchema;
    const valid = { first: { seq: 1, text: "x" }, count: 1, lastSeq: 1 };
    expect(stateSchema.parse(valid)).toEqual(stockStateSchema.parse(valid));
    const broken: unknown[] = [
      { first: null, count: 1, lastSeq: 1 },
      { first: { seq: 2, text: "x" }, count: 1, lastSeq: 1 },
      { first: null, count: 0, lastSeq: 0 },
      { first: { seq: -1, text: "x" }, count: 1, lastSeq: 1 },
      { first: null, count: 0, lastSeq: null, extra: true },
    ];
    for (const value of broken) {
      let mine = "ok";
      let theirs = "ok";
      try {
        stateSchema.parse(value);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        stockStateSchema.parse(value);
      } catch (error) {
        theirs = (error as Error).message;
      }
      expect(mine).toBe(theirs);
      expect(mine).not.toBe("ok");
    }
    let message = "";
    try {
      stateSchema.parse(broken[0]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("title input state must pair its count with first and last message seqs");
  });
});

describe("dịch vụ tiêu đề — A/B trên Context cordis THẬT", () => {
  test("ca 13: get + rename + refresh khớp giá trị TRÊN CÙNG một kịch bản", async () => {
    const mine = install(ours);
    const theirs = install(stock);
    const a = mine.makeSession("s1");
    const b = theirs.makeSession("s1");
    for (const target of [a, b]) target.append("user/message", userEvent("user", "  one two three four five six  "));
    await settle();
    expect(mine.service.get(a)).toEqual(theirs.service.get(b));
    expect(mine.service.get(a)?.title).toBe("one two three four five");
    expect(mine.service.get(a)?.source).toEqual({ kind: "fallback" });
    const renamedMine = mine.service.rename(a, "  Đổi\u001b[31m tên  ");
    const renamedTheirs = theirs.service.rename(b, "  Đổi\u001b[31m tên  ");
    expect(renamedMine).toEqual(renamedTheirs);
    expect(renamedMine.title).toBe("Đổi tên");
    expect(renamedMine.messageSeqs).toEqual([]);
    expect(renamedMine.source).toEqual({ kind: "user" });
    // refresh trên tiêu đề ĐÃ GHIM: ghi đè bằng dự phòng — chính là đường BỎ GHIM.
    const refreshedMine = await mine.service.refresh(a);
    const refreshedTheirs = await theirs.service.refresh(b);
    expect(refreshedMine).toEqual(refreshedTheirs);
    expect(refreshedMine?.source).toEqual({ kind: "fallback" });
    expect(refreshedMine?.messageSeqs).toEqual([0]);
  });

  test("ca 14: nhịp provider — chờ ĐÚNG mốc request/header, rồi ghi tiêu đề provider kèm currentTitle", async () => {
    const seenMine: ProviderRequest[] = [];
    const seenTheirs: ProviderRequest[] = [];
    const mine = install(ours);
    const theirs = install(stock);
    const provider = (seen: ProviderRequest[]): Provider => ({
      id: "p1",
      automatic: "first-prompt",
      async generate(request: ProviderRequest) {
        seen.push(request);
        return {
          title: "Provider title",
          messageSeqs: [request.messages[0]?.seq ?? 0],
          model: { provider: "x", model: "y" },
        };
      },
    });
    const disposeMine = mine.service.register(provider(seenMine));
    const disposeTheirs = theirs.service.register(provider(seenTheirs));
    const a = mine.makeSession("s1");
    const b = theirs.makeSession("s1");
    for (const target of [a, b]) target.append("user/message", userEvent("user", "hello provider world"));
    await settle();
    // CHƯA có tuyến trong log ⇒ provider CHƯA được gọi; phép dự phòng đã vật chất hoá.
    expect(seenMine.length).toBe(seenTheirs.length);
    expect(seenMine.length).toBe(0);
    expect(mine.service.get(a)).toEqual(theirs.service.get(b));
    for (const target of [a, b]) target.append("request/header", { header: { config: { provider: "x", model: "y" } } });
    await settle();
    expect(seenMine.length).toBe(1);
    expect(seenTheirs.length).toBe(1);
    expect(Object.keys(seenMine[0] ?? {}).sort()).toEqual(Object.keys(seenTheirs[0] ?? {}).sort());
    expect(Object.keys(seenMine[0] ?? {}).sort()).toEqual(["currentTitle", "messages", "route", "session", "signal"]);
    expect(seenMine[0]?.currentTitle).toEqual(seenTheirs[0]?.currentTitle);
    expect(seenMine[0]?.currentTitle?.source).toEqual({ kind: "fallback" });
    expect(mine.service.get(a)).toEqual(theirs.service.get(b));
    expect(mine.service.get(a)?.source).toEqual({
      kind: "provider",
      provider: "p1",
      model: { provider: "x", model: "y" },
    });
    await disposeMine();
    await disposeTheirs();
  });

  test("ca 15: register — provider thứ hai bị từ chối khi provider đầu CHƯA đóng, và được nhận SAU khi đóng", async () => {
    const provider = (id: string): Provider => ({
      id,
      automatic: "all-prompts",
      async generate() {
        return { title: id, messageSeqs: [0] };
      },
    });
    for (const module of [ours, stock]) {
      const installed = install(module);
      const dispose = installed.service.register(provider("p1"));
      expect(() => installed.service.register(provider("p2"))).toThrow(
        'session-title provider "p1" is already registered',
      );
      await dispose();
      const second = installed.service.register(provider("p2"));
      await second();
    }
  });

  test("ca 16: đường lỗi khớp CÙNG lớp và CÙNG câu (rename · phiên chết · provider hỏng · cấu hình hỏng)", async () => {
    const mine = install(ours);
    const theirs = install(stock);
    const a = mine.makeSession("s1");
    const b = theirs.makeSession("s1");
    const ghostMine: FakeSession = { ...a, id: "ghost" };
    const ghostTheirs: FakeSession = { ...b, id: "ghost" };
    expect(await outcome(() => mine.service.rename(a, "   "))).toBe(await outcome(() => theirs.service.rename(b, "   ")));
    expect(await outcome(() => mine.service.rename(a, "   "))).toBe(
      "SessionTitleInvalidError: session title must contain visible characters",
    );
    expect(await outcome(() => mine.service.rename(ghostMine, "x"))).toBe(
      await outcome(() => theirs.service.rename(ghostTheirs, "x")),
    );
    expect(await outcome(() => mine.service.rename(ghostMine, "x"))).toBe(
      'Error: session "ghost" is not live in this store',
    );
    const brokenProviders: Provider[] = [
      { id: "", automatic: "first-prompt", generate: async () => ({ title: "x", messageSeqs: [0] }) },
      {
        id: "p",
        automatic: "sometimes" as unknown as Provider["automatic"],
        generate: async () => ({ title: "x", messageSeqs: [0] }),
      },
      { id: "p", automatic: "first-prompt", generate: 1 as unknown as Provider["generate"] },
    ];
    for (const broken of brokenProviders) {
      expect(await outcome(() => mine.service.register(broken))).toBe(
        await outcome(() => theirs.service.register(broken)),
      );
    }
    const badConfigs: unknown[] = [
      { fallbackMaxWords: 0, fallbackMaxBytes: 40, maxTitleBytes: 80 },
      { fallbackMaxWords: 5, fallbackMaxBytes: 40.5, maxTitleBytes: 80 },
      { fallbackMaxWords: 5, fallbackMaxBytes: 80, maxTitleBytes: 40 },
      null,
    ];
    for (const config of badConfigs) {
      expect(await outcome(() => construct(ours, config))).toBe(await outcome(() => construct(stock, config)));
    }
    expect(await outcome(() => construct(ours, badConfigs[0]))).toBe(
      "Error: session-title: fallbackMaxWords must be a positive integer",
    );
    expect(await outcome(() => construct(ours, badConfigs[2]))).toBe(
      "Error: session-title: fallbackMaxBytes must not exceed maxTitleBytes",
    );
  });

  test("ca 17: C6 DANH TÍNH — ảnh chụp đóng băng sâu, mảng messageSeqs RIÊNG mỗi lần gộp, sửa một KHÔNG lan", () => {
    const event: Event = {
      type: "session/title",
      seq: 3,
      time: 9,
      data: { title: "T", messageSeqs: [1, 2], source: { kind: "provider", provider: "p1", model: { provider: "x", model: "y" } } },
    };
    const a = ours.foldSessionTitle([event]) as Snapshot;
    const b = ours.foldSessionTitle([event]) as Snapshot;
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.messageSeqs).not.toBe(b.messageSeqs);
    expect(a.source).not.toBe(b.source);
    expect(a.source.model).not.toBe(b.source.model);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.messageSeqs)).toBe(true);
    // Vật thể của LOG không được là vật thể của ảnh chụp: sửa log KHÔNG lan vào ảnh chụp đã trả.
    const logSource = (event.data as { source: { provider: string } }).source;
    expect(a.source).not.toBe(logSource);
    logSource.provider = "sửa log";
    expect(a.source.provider).toBe("p1");
    // Bản gốc đo được Y HỆT (đây là hành vi phải tái hiện, không phải khác biệt).
    const theirs = stock.foldSessionTitle([event]) as Snapshot;
    expect(theirs.messageSeqs).not.toBe((stock.foldSessionTitle([event]) as Snapshot).messageSeqs);
    expect(Object.isFrozen(theirs)).toBe(true);
  });

  test("ca 18: C6 DANH TÍNH — titleInput.init() DÙNG CHUNG vật thể là hành vi CỦA BẢN GỐC (đo cả hai bên)", () => {
    const mine = install(ours).book.definitions.get("titleInput") as Definition<unknown, unknown>;
    const theirs = install(stock).book.definitions.get("titleInput") as Definition<unknown, unknown>;
    expect(mine.init()).toBe(mine.init());
    expect(theirs.init()).toBe(theirs.init());
    expect(mine.init()).toEqual(theirs.init());
  });
});
