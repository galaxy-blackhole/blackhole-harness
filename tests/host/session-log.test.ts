/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-session-log-deepseek: mỗi ca hành vi dựng HAI giàn
 *      giống hệt nhau (Context cordis THẬT + seam ghi vết) rồi chạy CẢ HAI bản cài — lớp của ta và
 *      chính bundle gốc (@deepseek-ai/dsh-session-log-deepseek) — so trường request đã chuẩn bị, sự
 *      kiện mốc đã ghi, cảnh báo đã log; cộng ca tập export trên ARTIFACT, ca gbh.peers ⊆
 *      peerDependencies (có ĐỐI CHỨNG ÂM), ca 000e (locale byte-for-byte) và ca C6 (danh tính).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session-log/build.ts";
import * as ours from "../../packages/host/session-log/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-log");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-log-deepseek");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis THẬT (không phải object giả): chỉ seam được đắp thêm bằng Proxy. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: ((value: unknown) => unknown) & { toString(): string };
  apply(ctx: unknown, config: unknown): void;
  acceptedThrough(session: unknown): number;
};

/** Bản của ta nhìn qua cùng hình dạng để so hai bên. */
const mine = ours as unknown as typeof stock;

/** Một sự kiện canonical giả trong log của phiên. */
interface FakeEvent {
  /** Loại sự kiện (khoá của SessionEventMap hoặc loại lạ). */
  type: string;
  /** Số thứ tự trong log, tăng nghiêm ngặt. */
  seq: number;
  /** Thời điểm ghi (mili giây Unix). */
  time: number;
  /** Thân sự kiện. */
  data: Record<string, unknown>;
  /** Dấu "được phép bỏ qua". */
  ignorable?: true;
  /** Cách sự kiện vào mặt có thứ tự (chỉ sự kiện sinh-thông-điệp). */
  surfaceOp?: "append" | { op: "replace"; startSeq: number; endSeq: number };
  /** Tập nguồn đã trích. */
  sourceEventSeqs?: number[];
}

/** Thân đầu phiên giả — đúng những trường wireHeader đọc. */
interface FakeHeader {
  /** Thế hệ định dạng phiên. */
  version: number;
  /** Danh tính phiên trong đầu phiên. */
  id: string;
  /** Thời điểm tạo (mili giây Unix). */
  createdAt: number;
  /** Thư mục làm việc, nếu có. */
  cwd?: string;
  /** Phiên cha, nếu có. */
  parentSession?: string;
  /** Có tiền tố kế thừa hay không. */
  isSeeded: boolean;
  /** Phiên con của subagent. */
  origin?: "subagent";
  /** Độ sâu uỷ nhiệm. */
  delegationDepth?: number;
  /** Preset agent. */
  agentPreset?: string;
}

/** Phiên giả có ĐÚNG hình dạng mà bộ đóng góp đọc: log, đầu phiên, và đường GHI mốc. */
interface FakeSession {
  /** Danh tính phiên. */
  id: string;
  /** Độ dài log đã chụp. */
  seq: number;
  /** Đầu phiên. */
  header: FakeHeader;
  /** Số sự kiện kế thừa từ fork. */
  inheritedEventCount: number;
  /**
   * Đọc một sự kiện theo số thứ tự.
   * Nhận: số thứ tự (0-based).
   * Trả: sự kiện nằm ở số thứ tự đó, hoặc undefined khi vượt độ dài đã chụp.
   */
  eventAt(seq: number): FakeEvent | undefined;
  /**
   * Chụp các sự kiện từ một mốc tới hết.
   * Nhận: mốc bắt đầu (0-based).
   * Trả: mảng sự kiện còn chờ tải lên.
   */
  snapshotEvents(from: number): readonly FakeEvent[];
  /**
   * Ghi một sự kiện vào log.
   * Nhận: loại sự kiện và thân sự kiện.
   * Trả: không (giàn tự ghi vào sổ appends).
   */
  append(type: string, data: Record<string, unknown>): void;
}

/** Giàn đo của MỘT bên cài. */
interface Harness {
  /** Context cordis THẬT đã đắp seam. */
  ctx: unknown;
  /** Mọi trường request đã đăng ký: tên trường + provider. */
  fields: { field: string; provider: { prepare(request: unknown): unknown } }[];
  /** Mọi bản ghi phiên theo thứ tự. */
  appends: { type: string; data: Record<string, unknown> }[];
  /** Mọi lời gọi logger.warn, đã nối thành chuỗi. */
  warns: string[];
  /** Sổ phiên giả theo id. */
  sessions: Map<string, FakeSession>;
  /** Provider của trường dsh_session_log (ném khi plugin không đăng ký gì). */
  provider(): { prepare(request: unknown): unknown };
}

/**
 * Dựng giàn cho MỘT bên cài trên Context cordis THẬT.
 * Nhận: không.
 * Trả: giàn đo có sổ phiên, sổ trường đã đăng ký, sổ ghi phiên và sổ cảnh báo.
 */
function makeHarness(): Harness {
  const fields: Harness["fields"] = [];
  const appends: Harness["appends"] = [];
  const warns: string[] = [];
  const sessions = new Map<string, FakeSession>();
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "deepseekLlmApiExtensions") {
        return {
          register(field: string, provider: Harness["fields"][number]["provider"]): () => Promise<void> {
            fields.push({ field, provider });
            return async () => undefined;
          },
        };
      }
      if (prop === "sessions") {
        return {
          get: (id: string): FakeSession | undefined => sessions.get(String(id)),
        };
      }
      if (prop === "logger") {
        return {
          warn: (...args: unknown[]): void => {
            warns.push(args.map((arg) => String(arg)).join(" "));
          },
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  return {
    ctx,
    fields,
    appends,
    warns,
    sessions,
    provider(): { prepare(request: unknown): unknown } {
      const found = fields.find((entry) => entry.field === "dsh_session_log");
      if (found === undefined) throw new Error("plugin không đăng ký trường dsh_session_log");
      return found.provider;
    },
  };
}

/**
 * Dựng một phiên giả từ dãy sự kiện.
 * Nhận: đầu phiên (phần ghi đè), dãy sự kiện, và sổ appends của giàn để đường ghi mốc có chỗ ghi.
 * Trả: phiên giả đúng hình dạng bộ đóng góp đọc.
 */
function fakeSession(
  header: Partial<FakeHeader>,
  events: readonly FakeEvent[],
  appends: Harness["appends"],
): FakeSession {
  const fullHeader: FakeHeader = {
    version: 4,
    id: "session-1",
    createdAt: 1_700_000_000_000,
    isSeeded: false,
    ...header,
  };
  return {
    id: fullHeader.id,
    seq: events.length,
    header: fullHeader,
    inheritedEventCount: 0,
    eventAt: (seq: number) => events[seq],
    snapshotEvents: (from: number) => events.slice(from),
    append(type: string, data: Record<string, unknown>): void {
      appends.push({ type, data });
    },
  };
}

/**
 * Một sự kiện user/message bình thường trên mặt.
 * Nhận: số thứ tự và chữ của tin nhắn.
 * Trả: sự kiện giả đúng hình dạng log canonical.
 */
function userMessage(seq: number, text: string): FakeEvent {
  return {
    type: "user/message",
    seq,
    time: 1_700_000_000_000 + seq,
    data: { content: [{ type: "text", text }] },
    surfaceOp: "append",
  };
}

/**
 * Một sự kiện mốc đã-nhận, đúng hình dạng bản gốc ghi.
 * Nhận: số thứ tự của mốc, throughSeq đã nhận, id phiên, và thế hệ định dạng.
 * Trả: sự kiện giả loại session-log-deepseek/delivery-accepted.
 */
function accepted(
  seq: number,
  throughSeq: number,
  sessionId = "session-1",
  sessionFormatVersion: number | null = 4,
): FakeEvent {
  return {
    type: "session-log-deepseek/delivery-accepted",
    seq,
    time: 1_700_000_000_000 + seq,
    data: { sessionId, throughSeq, ...(sessionFormatVersion === null ? {} : { sessionFormatVersion }) },
  };
}

/**
 * Request giả mà sổ đăng ký THẬT trao cho provider.
 * Nhận: id phiên (bỏ trống = request không mang phiên).
 * Trả: sự thật request tối thiểu mà provider đọc.
 */
function request(sessionId?: string): { body: Record<string, never>; sessionId?: string; signal: AbortSignal } {
  return { body: {}, ...(sessionId === undefined ? {} : { sessionId }), signal: new AbortController().signal };
}

/**
 * Chạy MỘT lượt chuẩn bị trên một bên cài rồi gọi accept() nếu có.
 * Nhận: lớp plugin, giàn, cấu hình thô (đi qua schema của CHÍNH bên đó), và id phiên của request.
 * Trả: giá trị đã chuẩn bị (hoặc undefined).
 */
function prepareOnce(
  plugin: typeof stock,
  harness: Harness,
  raw: Record<string, unknown>,
  sessionId: string | undefined = "session-1",
): unknown {
  plugin.apply(harness.ctx, plugin.Config({ maxBytes: 8 * 1024 * 1024, ...raw }));
  const prepared = harness.provider().prepare(request(sessionId)) as
    | { value: unknown; accept?: () => void }
    | undefined;
  prepared?.accept?.();
  return prepared === undefined ? undefined : prepared.value;
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: văn bản của artifact.
 * Trả: danh sách tên export đã sắp xếp.
 */
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

/** Hình dạng package.json của gói ta mà test đọc. */
interface PkgJson {
  /** Tên package. */
  name: string;
  /** Metadata thay row. */
  gbh?: { peers?: string[]; row?: { id?: string; tests?: string[]; config?: Record<string, unknown> } };
  /** Peer khai báo. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật (phải RỖNG). */
  dependencies?: Record<string, string>;
  /** Bảng exports. */
  exports?: Record<string, unknown>;
}

/**
 * Đọc package.json của gói ta.
 * Nhận: không.
 * Trả: nội dung đã parse.
 */
function pkgJson(): PkgJson {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PkgJson;
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-sl-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["Config", "acceptedThrough", "apply", "inject", "name"]);
    // Row host thuần: KHÔNG có bộ nạp module client, KHÔNG có id module nào trong artifact.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Ba module ngoài nạp LÚC CHẠY — đúng bản gốc; cordis/dsh-util-values chỉ mượn KIỂU nên bị xoá.
    for (const specifier of ["@deepseek-ai/schemastery", "@deepseek-ai/dsh-brand", "@deepseek-ai/dsh-session"]) {
      expect(oursText).toContain('from "' + specifier + '"');
      expect(stockText).toContain('from "' + specifier + '"');
    }
    expect(oursText).not.toContain('from "@deepseek-ai/cordis"');
    expect(oursText).not.toContain("@deepseek-ai/dsh-util-values");
  });

  test("name · inject · String(Config) TRÙNG bản gốc; schema TỪ CHỐI cùng thông điệp", () => {
    // 08/11/2026 — chủ dự án đổi tên row/namespace sang `session-log-gbh` (quyết định đã duyệt) ⇒ tên KHÔNG
    // còn trùng bản gốc. Giữ NGUYÊN ĐỘ MẠNH: chuẩn hoá tên về dạng stock (khuôn task-17/N2) rồi vẫn so bằng,
    // đồng thời khẳng định dứt khoát tên MỚI để không âm thầm quay lại tên cũ.
    const chuanHoaTen = (ten: string): string => ten.replaceAll("session-log-gbh", "session-log-deepseek");
    expect(chuanHoaTen(mine.name)).toBe(chuanHoaTen(stock.name));
    expect(mine.name).toBe("session-log-gbh");
    expect(mine.inject).toEqual(stock.inject);
    expect(mine.inject).toEqual(["deepseekLlmApiExtensions", "sessions"]);
    expect(String(mine.Config)).toBe(String(stock.Config));
    const failure = (schema: (value: unknown) => unknown, raw: unknown): string => {
      try {
        schema(raw);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    const schema = mine.Config as unknown as (value: unknown) => unknown;
    const stockSchema = stock.Config as unknown as (value: unknown) => unknown;
    for (const raw of [{ maxBytes: 0 }, { maxBytes: 1.5 }, { maxBytes: "x" }]) {
      expect(failure(schema, raw)).toBe(failure(stockSchema, raw));
      expect(failure(schema, raw)).not.toBe("KHONG NEM");
    }
    // Mặc định của schema: maxBytes = 8 MiB, enabled = true.
    const parsed = schema({}) as { maxBytes: number; enabled: { get(): boolean } };
    expect(parsed.maxBytes).toBe(8 * 1024 * 1024);
    expect(parsed.enabled.get()).toBe(true);
  });

  test("cài đặt đăng ký ĐÚNG MỘT trường dsh_session_log, và KHÔNG đăng ký trường nào khác", () => {
    for (const plugin of [mine, stock]) {
      const harness = makeHarness();
      plugin.apply(harness.ctx, plugin.Config({}));
      expect(harness.fields.map((entry) => entry.field)).toEqual(["dsh_session_log"]);
    }
  });
});

describe("enabled=false — mirror Ý ĐỊNH SẢN PHẨM: provider vẫn đăng ký nhưng KHÔNG gửi byte nào", () => {
  test("prepare() trả undefined ở CẢ HAI bản ⇒ 0 trường, 0 byte, 0 sự kiện mốc", () => {
    const results: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const harness = makeHarness();
      harness.sessions.set(
        "session-1",
        fakeSession({}, [userMessage(0, "hello"), userMessage(1, "world")], harness.appends),
      );
      const value = prepareOnce(plugin, harness, { enabled: false });
      // Đo ĐÚNG triệu chứng: không có giá trị ⇒ sổ đăng ký KHÔNG có gì để ghép vào request.
      expect(value).toBe(undefined);
      expect(JSON.stringify(value)).toBeUndefined();
      expect(harness.appends).toEqual([]);
      expect(harness.warns).toEqual([]);
      expect(harness.fields).toHaveLength(1);
      results.push(value);
    }
    expect(results[0]).toBe(results[1]);
  });

  test("enabled=false và request KHÔNG có sessionId ⇒ vẫn undefined (nhánh chặn đầu tiên)", () => {
    for (const plugin of [mine, stock]) {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({}, [userMessage(0, "hi")], harness.appends));
      expect(prepareOnce(plugin, harness, { enabled: false }, undefined)).toBe(undefined);
      expect(harness.warns).toEqual([]);
    }
  });
});

describe("enabled=true — đối chứng TỪNG BYTE với chính bundle gốc trên Context cordis THẬT", () => {
  test("ba sự kiện chờ ⇒ cùng envelope, cùng phong bì sự kiện, cùng sự kiện mốc đã ghi", () => {
    const events = [userMessage(0, "a"), userMessage(1, "b"), userMessage(2, "c")];
    const traces = [mine, stock].map((plugin) => {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({ cwd: "/tmp/w", agentPreset: "auto" }, events, harness.appends));
      const value = prepareOnce(plugin, harness, {});
      return { value, appends: [...harness.appends], warns: [...harness.warns] };
    });
    expect(traces[0]?.value).toEqual(traces[1]?.value);
    const value = traces[0]?.value as {
      version: number;
      sessionFormatVersion: number;
      session: Record<string, unknown>;
      afterSeq: number;
      throughSeq: number;
      events: { type: string; seq: number }[];
    };
    expect(value.version).toBe(1);
    expect(value.sessionFormatVersion).toBe(4);
    expect(value.afterSeq).toBe(-1);
    expect(value.throughSeq).toBe(2);
    expect(value.events.map((event) => event.type)).toEqual(["user/message", "user/message", "user/message"]);
    expect(value.events.map((event) => event.seq)).toEqual([0, 1, 2]);
    expect(value.session).toEqual({
      version: 4,
      id: "session-1",
      createdAt: 1_700_000_000_000,
      cwd: "/tmp/w",
      agentPreset: "auto",
    });
    // Sự kiện mốc: ĐÚNG một bản ghi, đúng hình dạng bản gốc, và hai bên BẰNG NHAU.
    // 08/11/2026 - chu du an doi ten row/namespace sang session-log-gbh (quyet dinh da duyet) => su kien moc
    // do ta ghi mang loai MOI, ban goc ghi loai cu. Giu NGUYEN DO MANH: chuan hoa TEN loai su kien (khuon
    // task-17/N2) roi van so SAU TUNG TRUONG bang toEqual - khong doi sang toContain, khong bo ve nao.
    const chuanHoaLoai = (ds: readonly { type: string }[] | undefined): readonly { type: string }[] | undefined =>
      ds?.map((e) => ({ ...e, type: e.type.replaceAll("session-log-gbh/delivery-accepted", "session-log-deepseek/delivery-accepted") }));
    expect(chuanHoaLoai(traces[0]?.appends)).toEqual(chuanHoaLoai(traces[1]?.appends));
    expect(traces[0]?.appends).toEqual([
      {
        // 08/11/2026 - chu du an doi ten: su kien MOC do TA ghi nay mang loai MOI (xem KE-HOACH-MIGRATE-SESSION-LOG.md).
        type: "session-log-gbh/delivery-accepted",
        data: { sessionId: "session-1", sessionFormatVersion: 4, throughSeq: 2 },
      },
    ]);
    expect(traces[0]?.warns).toEqual([]);
  });

  test("thao tác mặt replace + trích nguồn + bản ghi LẠ ignorable ⇒ wire TRÙNG bản gốc từng trường", () => {
    const events: FakeEvent[] = [
      { type: "system/message", seq: 0, time: 5, data: { text: "sys" }, surfaceOp: "append" },
      {
        type: "assistant/message",
        seq: 1,
        time: 6,
        data: { role: "assistant" },
        surfaceOp: { op: "replace", startSeq: 0, endSeq: 0 },
      },
      {
        type: "compaction/start",
        seq: 2,
        time: 7,
        data: { reason: "x" },
        surfaceOp: { op: "replace", startSeq: 0, endSeq: 1 },
        sourceEventSeqs: [0, 1],
      },
      { type: "plugin:future/record", seq: 3, time: 8, data: { opaque: true }, ignorable: true },
      { type: "turn/start", seq: 4, time: 9, data: { turn: 1 } },
    ];
    const traces = [mine, stock].map((plugin) => {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({}, events, harness.appends));
      return prepareOnce(plugin, harness, {});
    });
    expect(traces[0]).toEqual(traces[1]);
    const wireEvents = (traces[0] as { events: Record<string, unknown>[] }).events;
    expect(wireEvents[0]).toEqual({ seq: 0, time: 5, data: { text: "sys" }, type: "system/message", surfaceOp: "append" });
    expect(wireEvents[1]).toEqual({
      seq: 1,
      time: 6,
      data: { role: "assistant" },
      type: "assistant/message",
      surfaceOp: { op: "replace", startSeq: 0, endSeq: 0 },
    });
    // compaction/start là sự kiện ĐÃ BIẾT (không sinh mặt) ⇒ wire CHỈ có loại + thân: surfaceOp và
    // sourceEventSeqs bị BỎ, đúng như bản gốc (đo được: hai bên ra cùng chuỗi JSON).
    expect(wireEvents[2]).toEqual({ seq: 2, time: 7, data: { reason: "x" }, type: "compaction/start" });
    expect(wireEvents[3]).toEqual({
      seq: 3,
      time: 8,
      data: { opaque: true },
      ignorable: true,
      type: "plugin:future/record",
    });
    expect(wireEvents[4]).toEqual({ seq: 4, time: 9, data: { turn: 1 }, type: "turn/start" });
  });

  test("mốc đã-nhận KHỚP ⇒ chỉ tải hậu tố sau mốc (afterSeq đúng, không tải lại)", () => {
    const events = [userMessage(0, "a"), userMessage(1, "b"), accepted(2, 1), userMessage(3, "c")];
    const traces = [mine, stock].map((plugin) => {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({}, events, harness.appends));
      return prepareOnce(plugin, harness, {});
    });
    expect(traces[0]).toEqual(traces[1]);
    const value = traces[0] as { afterSeq: number; throughSeq: number; events: { seq: number }[] };
    expect(value.afterSeq).toBe(1);
    // ĐO ĐƯỢC: bản gốc tải tiếp từ afterSeq + 1, nên CHÍNH sự kiện mốc (seq 2) cũng nằm trong hậu tố.
    expect(value.events.map((event) => event.seq)).toEqual([2, 3]);
    expect(value.throughSeq).toBe(3);
  });

  test("trần maxBytes: chỉ tiền tố VỪA được tải; sự kiện ĐẦU không vừa ⇒ undefined + CẢNH BÁO đúng một lần", () => {
    const events = [
      userMessage(0, "x".repeat(40)),
      userMessage(1, "y".repeat(40)),
      userMessage(2, "z".repeat(40)),
    ];
    const sized = (plugin: typeof stock, maxBytes: number) => {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({}, events, harness.appends));
      const value = prepareOnce(plugin, harness, { maxBytes });
      return { count: (value as { events: unknown[] } | undefined)?.events.length ?? -1, warns: harness.warns, value };
    };
    for (const maxBytes of [8 * 1024 * 1024, 400, 200, 120]) {
      const a = sized(mine, maxBytes);
      const b = sized(stock, maxBytes);
      expect(a.count).toBe(b.count);
      expect(a.value).toEqual(b.value);
      expect(a.warns).toEqual(b.warns);
    }
    // Trần 1 byte: KHÔNG sự kiện nào vừa ⇒ undefined, và cảnh báo nêu ĐÚNG cỡ trường cần.
    const blocked = [mine, stock].map((plugin) => {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({}, events, harness.appends));
      const value = prepareOnce(plugin, harness, { maxBytes: 1 });
      return { value, warns: harness.warns };
    });
    expect(blocked[0]?.value).toBe(undefined);
    expect(blocked[0]?.warns).toEqual(blocked[1]?.warns);
    expect(blocked[0]?.warns).toHaveLength(1);
    expect(blocked[0]?.warns[0]).toContain("above maxBytes 1");
    expect(blocked[0]?.warns[0]).toContain("this session's upload stays at event 0 until maxBytes admits it");
  });

  test("sự kiện KHÔNG serialize được ⇒ nhánh cảnh báo too large to serialize, trùng bản gốc", () => {
    const events: FakeEvent[] = [
      { type: "user/message", seq: 0, time: 1, data: { big: 1n as unknown as number }, surfaceOp: "append" },
    ];
    const blocked = [mine, stock].map((plugin) => {
      const harness = makeHarness();
      harness.sessions.set("session-1", fakeSession({}, events, harness.appends));
      const value = prepareOnce(plugin, harness, {});
      return { value, warns: harness.warns };
    });
    expect(blocked[0]?.value).toBe(undefined);
    expect(blocked[0]?.warns).toEqual(blocked[1]?.warns);
    expect(blocked[0]?.warns[0]).toContain("is too large to serialize into a dsh_session_log field");
  });

  test("hai lượt liên tiếp: mốc vừa ghi làm lượt sau KHÔNG tải lại (cả hai bản)", () => {
    for (const plugin of [mine, stock]) {
      const harness = makeHarness();
      const session = fakeSession({}, [userMessage(0, "a")], harness.appends);
      harness.sessions.set("session-1", session);
      plugin.apply(harness.ctx, plugin.Config({}));
      const first = harness.provider().prepare(request("session-1")) as {
        value: { throughSeq: number };
        accept(): void;
      };
      first.accept();
      // Sự kiện mốc vừa ghi phải nằm trong log của phiên để lượt sau đọc được.
      const events = [userMessage(0, "a"), accepted(1, 0)];
      const next = fakeSession({}, events, harness.appends);
      (session as { eventAt: (seq: number) => FakeEvent | undefined }).eventAt = (seq: number) => events[seq];
      (session as { snapshotEvents: (from: number) => readonly FakeEvent[] }).snapshotEvents = (from: number) =>
        events.slice(from);
      (session as { seq: number }).seq = events.length;
      const second = harness.provider().prepare(request("session-1")) as
        | { value: { afterSeq: number; throughSeq: number; events: { seq: number }[] } }
        | undefined;
      expect(first.value.throughSeq).toBe(0);
      // ĐO ĐƯỢC: lượt hai bắt đầu từ afterSeq = 0 ⇒ tải tiếp từ seq 1, tức CHÍNH sự kiện mốc vừa ghi.
      expect(second?.value.afterSeq).toBe(0);
      expect(second?.value.throughSeq).toBe(1);
      expect(second?.value.events.map((event) => event.seq)).toEqual([1]);
      expect(harness.appends).toHaveLength(1);
      expect(next.seq).toBe(2);
    }
  });
});

describe("acceptedThrough — gộp mốc đã-nhận, đối chứng từng thông điệp lỗi với bản gốc", () => {
  /** Bảng ca: tên, dãy sự kiện, và giá trị kỳ vọng (số, hoặc thông điệp lỗi). */
  const CASES: {
    name: string;
    events: () => FakeEvent[];
    expected: number | string;
  }[] = [
    { name: "log rỗng ⇒ -1", events: () => [], expected: -1 },
    { name: "không có mốc ⇒ -1", events: () => [userMessage(0, "a")], expected: -1 },
    { name: "hai mốc cùng phiên ⇒ lấy số LỚN NHẤT", events: () => [accepted(1, 0), accepted(2, 0)], expected: 0 },
    { name: "mốc của PHIÊN KHÁC ⇒ bỏ qua", events: () => [accepted(1, 0, "other")], expected: -1 },
    { name: "mốc của THẾ HỆ KHÁC (version 3 vs 4) ⇒ bỏ qua", events: () => [accepted(1, 0, "session-1", 3)], expected: -1 },
    {
      name: "mốc không khai sessionFormatVersion ⇒ coi là 0 ⇒ bỏ qua",
      events: () => [accepted(1, 0, "session-1", null)],
      expected: -1,
    },
    {
      name: "version = -0 ⇒ NÉM",
      events: () => [accepted(1, 0, "session-1", -0)],
      expected: "session-log-deepseek: malformed acceptance format version at seq 1",
    },
    {
      name: "version không phải số nguyên ⇒ NÉM",
      events: () => [accepted(1, 0, "session-1", 1.5)],
      expected: "session-log-deepseek: malformed acceptance format version at seq 1",
    },
    {
      name: "throughSeq âm ⇒ NÉM watermark",
      events: () => [accepted(1, -1)],
      expected: "session-log-deepseek: malformed acceptance watermark at seq 1",
    },
    {
      name: "sessionId rỗng ⇒ NÉM watermark",
      events: () => [accepted(1, 0, "")],
      expected: "session-log-deepseek: malformed acceptance watermark at seq 1",
    },
    {
      name: "mốc tự trỏ chính nó (throughSeq bằng seq) ⇒ NÉM watermark",
      events: () => [accepted(1, 1)],
      expected: "session-log-deepseek: malformed acceptance watermark at seq 1",
    },
  ];
  for (const ca of CASES) {
    test(ca.name, () => {
      const results = [mine, stock].map((plugin) => {
        const harness = makeHarness();
        const session = fakeSession({}, ca.events(), harness.appends);
        try {
          return { value: plugin.acceptedThrough(session), error: undefined as string | undefined };
        } catch (error) {
          return { value: undefined as number | undefined, error: (error as Error).message };
        }
      });
      expect(results[0]).toEqual(results[1]);
      if (typeof ca.expected === "number") {
        expect(results[0]?.value).toBe(ca.expected);
        expect(results[0]?.error).toBe(undefined);
      } else {
        expect(results[0]?.error).toBe(ca.expected);
      }
    });
  }

  test("log thiếu sự kiện dưới độ dài đã chụp ⇒ NÉM missing event, trùng bản gốc", () => {
    const messages: (string | undefined)[] = [];
    for (const plugin of [mine, stock]) {
      const harness = makeHarness();
      const session = fakeSession({}, [userMessage(0, "a")], harness.appends);
      // Khai độ dài 2 nhưng log chỉ có sự kiện 0 — đúng ca bất nhất mà bản gốc từ chối.
      (session as { seq: number }).seq = 2;
      try {
        plugin.acceptedThrough(session);
        messages.push(undefined);
      } catch (error) {
        messages.push((error as Error).message);
      }
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toBe("session-log-deepseek: missing event 1 below captured length 2");
  });

  test("bộ nhớ đệm quét TĂNG DẦN: gọi lần hai sau khi log dài ra vẫn ra ĐÚNG mốc (cả hai bản)", () => {
    for (const plugin of [mine, stock]) {
      const harness = makeHarness();
      const events: FakeEvent[] = [userMessage(0, "a")];
      const session = fakeSession({}, events, harness.appends);
      (session as { eventAt: (seq: number) => FakeEvent | undefined }).eventAt = (seq: number) => events[seq];
      (session as { snapshotEvents: (from: number) => readonly FakeEvent[] }).snapshotEvents = (from: number) =>
        events.slice(from);
      expect(plugin.acceptedThrough(session)).toBe(-1);
      events.push(accepted(1, 0));
      (session as { seq: number }).seq = 2;
      expect(plugin.acceptedThrough(session)).toBe(0);
    }
  });
});

describe("C6 — DANH TÍNH: hai lượt cài KHÔNG chia sẻ vật thể cấu hình", () => {
  test("hai lượt Config() ⇒ hai vật thể RIÊNG; sửa một KHÔNG lan sang cái kia", () => {
    const schema = mine.Config as unknown as (value: unknown) => { maxBytes: number; enabled: { get(): boolean } };
    const a = schema({});
    const b = schema({});
    expect(a).not.toBe(b);
    a.maxBytes = 1;
    expect(b.maxBytes).toBe(8 * 1024 * 1024);
  });

  test("hai lượt cài trên hai giàn ⇒ hai đăng ký RIÊNG, mỗi bên giữ phiên của mình", () => {
    const first = makeHarness();
    const second = makeHarness();
    first.sessions.set("session-1", fakeSession({}, [userMessage(0, "a")], first.appends));
    second.sessions.set("session-1", fakeSession({}, [userMessage(0, "b")], second.appends));
    prepareOnce(mine, first, {});
    prepareOnce(mine, second, {});
    expect(first.provider()).not.toBe(second.provider());
    expect(first.fields).toHaveLength(1);
    expect(second.fields).toHaveLength(1);
    expect(first.appends[0]?.data["throughSeq"]).toBe(0);
    expect(second.appends[0]?.data["throughSeq"]).toBe(0);
  });
});

describe("quy ước repo: gbh.peers ⊆ peerDependencies · 000e locale · gbh.row", () => {
  test("gbh.peers là TẬP CON của peerDependencies, không tên nào trong dependencies", () => {
    const json = pkgJson();
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
    // ĐỐI CHỨNG ÂM: xoá một tên ⇒ lệch; thêm tên lạ ⇒ lệch.
    const gaps = (list: readonly string[], deps: Record<string, string>): string[] =>
      list.filter((name) => !(name in deps));
    expect(gaps(declared, peers)).toEqual([]);
    expect(gaps(declared.slice(1), peers)).toEqual([]);
    expect(gaps([...declared, "@deepseek-ai/khong-ton-tai"], peers)).toEqual(["@deepseek-ai/khong-ton-tai"]);
  });

  test("000e: bản gốc CÓ locale ⇒ ta ship locale/{en,zh}.json byte-for-byte", () => {
    for (const file of ["en.json", "zh.json"]) {
      const stockLocale = join(STOCK_DIR, "locale", file);
      expect(existsSync(stockLocale)).toBe(true);
      expect(readFileSync(join(PKG, "locale", file), "utf8")).toBe(readFileSync(stockLocale, "utf8"));
    }
    expect(pkgJson().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });

  test("gbh.row: id + tests trỏ tệp CÓ THẬT, và config mirror ý định sản phẩm (enabled=false)", () => {
    const row = pkgJson().gbh?.row;
    // 08/11/2026 - chu du an doi ten row sang session-log-gbh (da duyet; bundle/ da doi theo).
    expect(row?.id).toBe("session-log-gbh");
    expect(row?.tests).toEqual(["tests/host/session-log.test.ts"]);
    expect(existsSync(join(REPO, "tests", "host", "session-log.test.ts"))).toBe(true);
    expect(row?.config).toEqual({ enabled: false, maxBytes: 8388608 });
  });
});
