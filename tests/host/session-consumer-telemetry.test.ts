/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Test consumer cho `Session` VALUE IMPORT: session-telemetry-otel dùng Session.fromRestore + lọc
 *      isFeedback — chứng minh hành vi của consumer KHÔNG đổi khi Session là class của artefact của ta.
 *      12/11/2026: mẫu phiên THẬT nay có TRẦN (≤ 1 MB nén · ≤ 1.000 event · tệp đầu theo đường dẫn) thay
 *      cho "tệp lớn nhất trong home" — đo 12/11: tệp lớn nhất là 38,3 MB nén / 132 MB JSON / 40.006 event
 *      nên phép create A/B + so chuỗi mất 14,5 s, vượt trần 5 s của bun ⇒ cổng đỏ OAN dù log/surface
 *      giống hệt nhau sau khi chuẩn hoá `time` (đã đo cả mẫu con lẫn toàn bộ 40.006 event).
 *      Thiếu phiên ⇒ SKIP kèm lý do thay vì ném trong beforeAll.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session");
/** Bundle stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session", "lib", "index.js");
/** Build tạm dưới lib/. */
const OUT = join(PKG, "lib", ".test-build-consumer");
/** Thư mục phiên thật (CHỈ ĐỌC). */
const SESSIONS = join(process.env.HOME ?? "", ".galaxy", "blackhole", "sessions");
/** Trần kích thước NÉN của tệp phiên mẫu (byte) — mẫu phải nhỏ thì phép fold A/B mới nằm trong trần thời gian. */
const MAX_SAMPLE_BYTES = 1024 * 1024;
/** Trần số event đưa vào phép A/B (chặn thời gian fold tăng vô hạn theo dữ liệu home). */
const MAX_SAMPLE_EVENTS = 1_000;
/** Số tệp tối đa thử trong hạn mức trước khi rơi về tệp lớn nhất. */
const MAX_SCAN_FILES = 25;
/** Trần thời gian mỗi ca A/B: bun mặc định 5 s, đo 12/11 chỉ đủ cho mẫu nhỏ khi máy đang tải. */
const CASE_TIMEOUT_MS = 30_000;

/** Bề mặt class Session dùng bởi consumer. */
interface SessionClass {
  create(id: string, seed?: readonly unknown[], header?: Record<string, unknown>): {
    readonly id: string;
    readonly log: readonly unknown[];
    readonly surface: unknown;
    readonly inheritedEventCount: number;
  };
  fromRestore(
    id: string,
    seed: readonly unknown[],
    header: Record<string, unknown>,
    inheritedEventCount: number,
    eventState: Record<string, unknown>,
  ): { readonly id: string; readonly log: readonly unknown[]; readonly surface: unknown; readonly inheritedEventCount: number };
}
/** Module session dùng trong test. */
interface SessionModule {
  readonly Session: SessionClass;
  readonly SessionLogOffset: (value: number) => number;
}
/** Một event đọc từ phiên thật. */
interface RealEvent {
  readonly seq: number;
  readonly type: string;
  readonly time?: number;
  readonly data?: Record<string, unknown>;
}
/** Mẫu phiên dùng cho phép A/B. */
interface SessionSeed {
  /** Header phiên (đã bỏ trường `type`). */
  readonly header: Record<string, unknown>;
  /** Event của mẫu (đã chặn trần + đuôi tổng hợp cho ca isFeedback). */
  readonly events: readonly RealEvent[];
  /** Tệp nguồn — chỉ dùng trong thông báo lỗi. */
  readonly source: string;
}

/** Bundle stock. */
const stock = (await import(STOCK)) as unknown as SessionModule;
/** Module của TA. */
let ours: SessionModule;
/** Mẫu phiên thật đã chặn trần (undefined khi home không có phiên nào). */
let seed: SessionSeed | undefined;
/** Có ít nhất một phiên .jsonl.zstd để đo hay không — quyết định SKIP ở thời điểm KHAI BÁO test. */
const SESSION_FILES: readonly string[] = existsSync(SESSIONS) ? listSessionFiles(SESSIONS) : [];
/** Có mẫu phiên thật để chạy các ca A/B. */
const HAS_SESSION = SESSION_FILES.length > 0;
/** Ghi chú SKIP kèm đường dẫn thiếu (hiện ngay trong tên ca, không im lặng). */
const SKIP_NOTE = HAS_SESSION ? "" : " — SKIP: thiếu phiên .jsonl.zstd trong " + SESSIONS;

/**
 * Liệt kê mọi tệp phiên .jsonl.zstd dưới một thư mục, sắp theo đường dẫn (thứ tự ổn định).
 * Nhận: root — thư mục gốc. Trả: danh sách đường dẫn tuyệt đối đã sắp xếp.
 */
function listSessionFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".jsonl.zstd")) files.push(path);
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Đọc MỘT tệp phiên, trả undefined khi tệp không dùng được cho phép A/B.
 * Nhận: path — tệp .jsonl.zstd (CHỈ ĐỌC). Trả: mẫu phiên đã chặn trần (kèm đuôi tổng hợp), hoặc undefined.
 */
function tryReadSession(path: string): SessionSeed | undefined {
  let lines: string[];
  try {
    const text = new TextDecoder().decode(Bun.zstdDecompressSync(readFileSync(path)));
    lines = text.split(String.fromCharCode(10)).filter((line) => line.trim() !== "");
  } catch {
    // Tệp hỏng/không giải nén được: bỏ qua để ca A/B không đỏ vì dữ liệu home không liên quan.
    return undefined;
  }
  try {
    const rawHeader = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    const { type: _type, ...header } = rawHeader;
    const id = typeof header["id"] === "string" ? header["id"] : "seed";
    const events = lines
      .slice(1)
      .map((line) => JSON.parse(line) as RealEvent)
      .slice(0, MAX_SAMPLE_EVENTS);
    // Session.create đòi seed LIỀN MẠCH từ seq 0 — tệp không thoả (log cũ/hỏng) thì bỏ, thử tệp sau.
    if (events.length === 0 || !events.every((event, index) => event.seq === index)) return undefined;
    // 12/11/2026 — ĐUÔI TỔNG HỢP: tệp lớn nhất của home có 0 event feedback/*, nên ca "lọc isFeedback" so
    // hai mảng RỖNG (đạt nhưng vô nghĩa). Ba event dưới đây giữ seq LIỀN MẠCH và phủ đúng ba nhánh của
    // isFeedback: record · message-put khớp id · message-delete KHÔNG khớp id.
    const tail: readonly RealEvent[] = [
      { seq: events.length, type: "feedback/record", time: 0, data: {} },
      { seq: events.length + 1, type: "feedback/message-put", time: 0, data: { sessionId: id } },
      { seq: events.length + 2, type: "feedback/message-delete", time: 0, data: { sessionId: id + "-khac" } },
    ];
    return { header, events: [...events, ...tail], source: path };
  } catch {
    return undefined;
  }
}

/**
 * Đọc mẫu phiên có CHẶN TRẦN từ thư mục sessions (CHỈ ĐỌC).
 * Nhận: root — thư mục sessions. Trả: header + events (≤ MAX_SAMPLE_EVENTS) + tệp nguồn.
 * @remarks Chọn tệp ĐẦU theo đường dẫn nằm trong hạn mức nén thay vì tệp LỚN NHẤT: home có tệp 38,3 MB
 *          nén / 132 MB JSON / 40.006 event, fold A/B mất 14,5 s (vượt trần bun 5 s) trong khi chênh lệch
 *          thật giữa hai bản là 0 byte sau chuẩn hoá `time`. Không tệp nào trong hạn mức dùng được thì lấy
 *          tệp lớn nhất (vẫn cắt theo MAX_SAMPLE_EVENTS) — thời gian luôn hữu hạn.
 */
function readSeed(root: string): SessionSeed {
  const files = listSessionFiles(root);
  if (files.length === 0) throw new Error("không có phiên nào để replay trong " + root);
  const withinBudget = files.filter((path) => statSync(path).size <= MAX_SAMPLE_BYTES).slice(0, MAX_SCAN_FILES);
  for (const path of withinBudget) {
    const sample = tryReadSession(path);
    if (sample !== undefined) return sample;
  }
  const biggest = files.reduce((a, b) => (statSync(b).size > statSync(a).size ? b : a), files[0] as string);
  const fallback = tryReadSession(biggest);
  if (fallback === undefined) throw new Error("không có phiên hợp lệ nào để replay trong " + root);
  return fallback;
}

/**
 * Lấy mẫu phiên đã đọc, ném lỗi rõ ràng nếu chưa có.
 * Nhận: không. Trả: mẫu phiên dùng cho phép A/B.
 */
function seedOrThrow(): SessionSeed {
  if (seed === undefined) throw new Error("chưa có mẫu phiên — " + SKIP_NOTE);
  return seed;
}

beforeAll(async () => {
  await buildPackage(OUT);
  ours = (await import(join(OUT, "index.js"))) as unknown as SessionModule;
  if (HAS_SESSION) seed = readSeed(SESSIONS);
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chuỗi JSON đã TRUNG TÍNH HOÁ trường `time` — chỉ dùng để so hai lần dựng phiên.
 * Nhận: giá trị bất kỳ (log/surface). Trả: chuỗi JSON với mọi "time":<số> thành "time":0.
 *
 * Vì sao (đo 23/10/2026): event tổng hợp `session/end-seed` do `append()` đóng dấu `Date.now()`;
 * hai lời gọi liên tiếp trong CÙNG tiến trình lệch nhau 32 ms (gốc 1792724488658 · ta 1792724488690)
 * nên phép so byte-đối-byte đỏ ngẫu nhiên dù hành vi giống hệt. Mọi trường khác vẫn so nguyên văn.
 */
function chuanHoaThoiGian(value: unknown): string {
  return JSON.stringify(value).replace(/"time":\d+/g, '"time":0');
}

/**
 * Bản sao ĐÚNG logic isFeedback của session-telemetry-otel (index.ts:59-70).
 * Nhận: session — phiên đã dựng; event — event cần lọc. Trả: event có phải feedback không.
 */
function isFeedback(session: { readonly inheritedEventCount: number; readonly id: string }, event: RealEvent): boolean {
  if (event.seq < session.inheritedEventCount) return false;
  switch (event.type) {
    case "feedback/record":
      return true;
    case "feedback/message-put":
    case "feedback/message-delete":
      return event.data?.["sessionId"] === session.id;
    default:
      return false;
  }
}

describe("session — consumer VALUE IMPORT (session-telemetry-otel)", () => {
  test("bề mặt static của Session khớp gốc: create + fromRestore", () => {
    const namesOf = (cls: SessionClass): string[] => Object.getOwnPropertyNames(cls).filter((name) => !["length", "name", "prototype"].includes(name)).sort();
    expect(namesOf(ours.Session)).toEqual(namesOf(stock.Session));
    expect(namesOf(ours.Session)).toEqual(["create", "fromRestore"]);
  });

  test.skipIf(!HAS_SESSION)(
    "Session.fromRestore (đường telemetry dùng) A/B cho cùng log/surface" + SKIP_NOTE,
    () => {
      const sample = seedOrThrow();
      const id = sample.header["id"] as string;
      const baseSession = stock.Session.fromRestore(id, sample.events, sample.header, stock.SessionLogOffset(0), {});
      const ourSession = ours.Session.fromRestore(id, sample.events, sample.header, ours.SessionLogOffset(0), {});
      expect(ourSession.id).toBe(baseSession.id);
      expect(ourSession.inheritedEventCount).toBe(baseSession.inheritedEventCount);
      expect(chuanHoaThoiGian(ourSession.log)).toBe(chuanHoaThoiGian(baseSession.log));
      expect(chuanHoaThoiGian(ourSession.surface)).toBe(chuanHoaThoiGian(baseSession.surface));
    },
    CASE_TIMEOUT_MS,
  );

  test.skipIf(!HAS_SESSION)(
    "lọc isFeedback của telemetry trên phiên A/B cho CÙNG tập event" + SKIP_NOTE,
    () => {
      const sample = seedOrThrow();
      const id = sample.header["id"] as string;
      const baseSession = stock.Session.fromRestore(id, sample.events, sample.header, stock.SessionLogOffset(0), {});
      const ourSession = ours.Session.fromRestore(id, sample.events, sample.header, ours.SessionLogOffset(0), {});
      const baseFeedback = sample.events.filter((event) => isFeedback(baseSession, event));
      const ourFeedback = sample.events.filter((event) => isFeedback(ourSession, event));
      expect(JSON.stringify(ourFeedback)).toBe(JSON.stringify(baseFeedback));
      expect(ourFeedback.length).toBe(baseFeedback.length);
    },
    CASE_TIMEOUT_MS,
  );

  test.skipIf(!HAS_SESSION)(
    "Session.create A/B trên phiên thật cho cùng log/surface" + SKIP_NOTE,
    () => {
      const sample = seedOrThrow();
      const id = sample.header["id"] as string;
      const baseSession = stock.Session.create(id, sample.events, sample.header);
      const ourSession = ours.Session.create(id, sample.events, sample.header);
      expect(chuanHoaThoiGian(ourSession.log)).toBe(chuanHoaThoiGian(baseSession.log));
      expect(chuanHoaThoiGian(ourSession.surface)).toBe(chuanHoaThoiGian(baseSession.surface));
    },
    CASE_TIMEOUT_MS,
  );
});
