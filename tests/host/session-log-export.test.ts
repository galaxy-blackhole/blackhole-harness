/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-session-log-export (nửa HOST): mỗi ca dựng HAI giàn
 *      GIỐNG HỆT NHAU trên Context cordis THẬT rồi chạy CẢ HAI bản cài — của ta và chính bundle gốc
 *      (@deepseek-ai/dsh-session-log-export) — so tập export, hằng số, schema Config, JSONL canonical,
 *      đọc qua tay nắm lưu bền, hàng rào flush, danh sách mục ZIP, BYTE của ZIP theo luồng, và hành vi
 *      route /api/session.export (400/404/500/200/HEAD). Cộng ca luật 000e, ca khai báo row, và ca
 *      TRÙNG TÊN service/plugin trong repo. Nửa CLIENT có tệp A/B riêng
 *      (tests/host/session-log-export-client.test.ts).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";


import { buildPackage } from "../../packages/host/session-log-export/build.ts";
import * as oursModule from "../../packages/host/session-log-export/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-log-export");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-log-export");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — gói ta symlink ĐÚNG bản này nên hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** fflate của kernel (đường dẫn tuyệt đối: tests/host KHÔNG nằm dưới node_modules nào có fflate). */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Thư mục node_modules của kernel đang chạy — nguồn của mọi peer (tests/host không nằm dưới nó). */
const KERNEL = join(REPO, "apps", "host", "node_modules");

/** fflate nạp động từ bản kernel đang chạy (giải nén ZIP trong ca đối chứng byte). */
const { unzipSync } = (await import(join(KERNEL, "fflate", "esm", "index.mjs"))) as {
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>;
};

/** Lớp lỗi "phiên không tồn tại" của kernel — PHẢI là CÙNG lớp mà gói ta ném (instanceof xuyên gói). */
const { SessionPersistenceNotFoundError } = (await import(join(KERNEL, "@deepseek-ai", "dsh-session-persistence", "lib", "index.js"))) as {
  SessionPersistenceNotFoundError: new (message: string) => Error;
};

/** Thế hệ định dạng phiên của kernel. */
const { SESSION_FORMAT_VERSION } = (await import(join(KERNEL, "@deepseek-ai", "dsh-session", "lib", "index.js"))) as {
  SESSION_FORMAT_VERSION: number;
};

/** Bộ đặt tên tệp log canonical của kernel. */
const { sessionFormatLogFilename } = (await import(join(KERNEL, "@deepseek-ai", "dsh-session-format", "lib", "index.js"))) as {
  sessionFormatLogFilename: (version: number) => string;
};

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as typeof oursModule;
/** Bản của ta nhìn qua CÙNG hình dạng để so hai bên. */
const mine = oursModule;

/** Đường dẫn ARTIFACT của ta (gán trong beforeAll). */
let artifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-session-log-export-"));
  artifact = await buildPackage(outDir);
});

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG bốn khuôn mà tools/check/rows.ts dùng.
 * Nhận: nội dung artifact.
 * Trả: mảng tên export đã sắp xếp (gồm "default" nếu có).
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return [...out].sort();
}

/** Thân đầu phiên giả — đúng những trường serializeSessionLog đọc. */
interface FakeHeader {
  /** Thế hệ định dạng phiên. */
  version: number;
  /** Danh tính phiên. */
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

/** Một sự kiện canonical giả trong log của phiên. */
interface FakeEvent {
  /** Loại sự kiện. */
  type: string;
  /** Số thứ tự trong log. */
  seq: number;
  /** Thời điểm ghi (mili giây Unix). */
  time: number;
  /** Thân sự kiện. */
  data: Record<string, unknown>;
}

/**
 * Dựng một đầu phiên giả đúng hình dạng mà bản gốc đọc.
 * Nhận: overrides — các trường muốn đổi.
 * Trả: đầu phiên giả.
 */
function headerOf(overrides: Partial<FakeHeader> = {}): FakeHeader {
  return { version: SESSION_FORMAT_VERSION, id: "session-1", createdAt: 1700000000000, isSeeded: false, ...overrides };
}

/** Ba sự kiện mẫu (một sự kiện mang ảnh + một mang tệp để các ca đính kèm dùng lại). */
const IMAGE_REF = { attachmentId: "sha256:aa11", mediaType: "image/png", bytes: 4, width: 1, height: 1 };
const FILE_REF = { attachmentId: "sha256:bb22", name: "báo cáo/../x.txt", bytes: 3 };
const EVENTS: FakeEvent[] = [
  { type: "user/message", seq: 1, time: 1, data: { content: [{ type: "text", text: "hi" }, { type: "image", attachment: IMAGE_REF }] } },
  { type: "tool/result", seq: 2, time: 2, data: { message: { content: [{ type: "file", attachment: FILE_REF }] } } },
  { type: "assistant/message", seq: 3, time: 3, data: { message: { content: [{ type: "text", text: "ok" }] } } },
];

/**
 * Đọc hết một luồng byte.
 * Nhận: stream — luồng ReadableStream cần đọc.
 * Trả: toàn bộ byte đã gộp.
 */
async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for await (const part of stream as unknown as AsyncIterable<Uint8Array>) {
    parts.push(part);
    total += part.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/**
 * Mở một ZIP trong bộ nhớ và trả bảng đường dẫn -> nội dung (giải mã UTF-8).
 * Nhận: bytes — byte của ZIP.
 * Trả: bảng nội dung theo đường dẫn.
 */
function zipEntries(bytes: Uint8Array): Record<string, string> {
  const files = unzipSync(bytes);
  const out: Record<string, string> = {};
  for (const [path, data] of Object.entries(files)) out[path] = new TextDecoder().decode(data as Uint8Array);
  return out;
}

/** Các dịch vụ giả mà một lần xuất đọc (chỉ những phương thức luồng ZIP gọi). */
interface FakeServices {
  /** Bộ máy truy vấn phiên giả. */
  sessionQuery: { traceSession(id: string, signal?: AbortSignal): Promise<{ descendants: unknown[] }> };
  /** Kho lưu bền giả. */
  sessionPersistence: { open(id: string, access: string, options?: { signal?: AbortSignal }): Promise<unknown> };
  /** Kho đính kèm giả. */
  attachments: { readImage(ref: unknown, signal?: AbortSignal): Promise<{ data: Uint8Array }>; readFileStream(ref: unknown, signal?: AbortSignal): AsyncIterable<Uint8Array> };
  /** Sổ phiên sống giả. */
  sessions: { get(id: string): unknown; flush(session: unknown): Promise<boolean> };
}

/**
 * Dựng kho đính kèm giả: ảnh trả 4 byte cố định, tệp trả ba khúc.
 * Nhận: reads — mảng ghi lại mọi lần đọc (để đếm khử trùng).
 * Trả: kho đính kèm giả.
 */
function fakeAttachments(reads: string[]): FakeServices["attachments"] {
  return {
    async readImage(ref: unknown): Promise<{ data: Uint8Array }> {
      reads.push("image:" + String((ref as { attachmentId: string }).attachmentId));
      return { data: new Uint8Array([1, 2, 3, 4]) };
    },
    readFileStream(ref: unknown): AsyncIterable<Uint8Array> {
      reads.push("file:" + String((ref as { attachmentId: string }).attachmentId));
      return (async function* () {
        yield new Uint8Array([9]);
        yield new Uint8Array();
        yield new Uint8Array([8, 7]);
      })();
    },
  };
}

/**
 * Dựng kho lưu bền giả từ bảng log theo id; id vắng mặt thì ném ĐÚNG lớp NotFoundError của kernel.
 * Nhận: logs — bảng id phiên -> [đầu phiên, sự kiện].
 * Trả: { persistence, closes } — kho giả và bộ đếm số lần close().
 */
function fakePersistence(logs: Map<string, { header: FakeHeader; events: FakeEvent[] }>): { persistence: FakeServices["sessionPersistence"]; closes: number[] } {
  const closes: number[] = [];
  return {
    closes,
    persistence: {
      async open(id: string): Promise<unknown> {
        const entry = logs.get(id);
        if (entry === undefined) throw new SessionPersistenceNotFoundError("no session " + id);
        return {
          header: entry.header,
          async read(): Promise<{ events: FakeEvent[] }> { return { events: entry.events }; },
          async close(): Promise<void> { closes.push(1); },
        };
      },
    },
  };
}

/**
 * Dựng cây dòng dõi từ danh sách id: mỗi id một nút, lồng nhau theo thứ tự.
 * Nhận: ids — id các phiên con theo thứ tự.
 * Trả: mảng nút gốc của cây.
 */
function lineageOf(ids: readonly string[]): unknown[] {
  return ids.map((id) => ({ session: { header: { id } }, descendants: [] }));
}

/**
 * Chạy một đoạn trong khi ĐÓNG BĂNG đồng hồ (Date.now). fflate nhúng Date.now() vào header của mỗi
 * mục ZIP, nên hai lần sinh ZIP ở hai thời điểm khác nhau KHÁC BYTE dù cùng đầu vào — đóng băng để
 * phép so BYTE có nghĩa và tất định giữa các lượt chạy.
 * Nhận: run — hàm async cần chạy.
 * Trả: kết quả của hàm.
 */
async function atFixedClock<T>(run: () => Promise<T>): Promise<T> {
  const realNow = Date.now;
  Date.now = () => 1700000000000;
  try {
    return await run();
  } finally {
    Date.now = realNow;
  }
}

/**
 * Chạy một hàm async và trả lỗi ném ra (null nếu không ném) — dùng cho so đường lỗi.
 * Nhận: run — hàm cần chạy.
 * Trả: lỗi đã ném, hoặc null.
 */
async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return null;
  } catch (error) {
    return error;
  }
}

describe("A. TẬP EXPORT trên ARTIFACT — ta phải BẰNG bản gốc", () => {
  test("14 export, BẰNG TỪNG TÊN với bundle gốc, không default", () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual([
      "Config", "DEFAULT_SESSION_LOG_COMPRESSION_LEVEL", "SESSION_LOG_EXPORT_PATH", "SESSION_LOG_FILENAME",
      "apply", "flushLiveSessionLog", "inject", "name", "readSessionLogText", "serializeSessionLog",
      "sessionLogExportDeps", "sessionLogZipEntries", "sessionLogZipFilename", "streamSessionLogZip",
    ]);
    expect(oursNames.includes("default")).toBe(false);
  });

  test("artifact là ESM (import peer, không phải script IIFE) và KHÔNG đăng ký id module trình duyệt", () => {
    const code = readFileSync(artifact, "utf8");
    expect(/^import\s/m.test(code)).toBe(true);
    expect(/export\s*\{/.test(code)).toBe(true);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect(code.includes("window.")).toBe(false);
  });
});

describe("B. HẰNG SỐ + SCHEMA Config — đối chứng TRỰC TIẾP", () => {
  test("name/inject/hai đường dẫn/tên tệp/mức nén mặc định BẰNG bản gốc", () => {
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("session-log-download");
    expect(mine.inject).toEqual(stock.inject);
    expect(mine.inject).toEqual(["commands", "connection"]);
    expect(mine.SESSION_LOG_EXPORT_PATH).toBe(stock.SESSION_LOG_EXPORT_PATH);
    expect(mine.SESSION_LOG_EXPORT_PATH).toBe("/api/session.export");
    expect(mine.SESSION_LOG_FILENAME).toBe(stock.SESSION_LOG_FILENAME);
    expect(mine.SESSION_LOG_FILENAME).toBe(sessionFormatLogFilename(SESSION_FORMAT_VERSION));
    expect(mine.DEFAULT_SESSION_LOG_COMPRESSION_LEVEL).toBe(stock.DEFAULT_SESSION_LOG_COMPRESSION_LEVEL);
    expect(mine.DEFAULT_SESSION_LOG_COMPRESSION_LEVEL).toBe(6);
  });

  test("String(Config) TRÙNG TỪNG KÝ TỰ và giá trị mặc định 6 như gốc", () => {
    expect(String(mine.Config)).toBe(String(stock.Config));
    expect(mine.Config({} as never)).toEqual(stock.Config({} as never));
    expect((mine.Config({} as never) as unknown as { compressionLevel: number }).compressionLevel).toBe(6);
    expect(mine.Config({ compressionLevel: 0 } as never)).toEqual({ compressionLevel: 0 });
    expect(mine.Config({ compressionLevel: 9 } as never)).toEqual({ compressionLevel: 9 });
  });

  test("ĐỐI CHỨNG ÂM: cấu hình sai bị NÉM ở CẢ HAI bên (10 · -1 · 1.5 · chuỗi)", () => {
    for (const bad of [{ compressionLevel: 10 }, { compressionLevel: -1 }, { compressionLevel: 1.5 }, { compressionLevel: "x" }]) {
      expect(() => mine.Config(bad as never)).toThrow();
      expect(() => stock.Config(bad as never)).toThrow();
    }
  });
});

describe("C. serializeSessionLog — JSONL canonical, đối chứng từng byte", () => {
  test("cùng đầu phiên + sự kiện ⇒ chuỗi BẰNG NHAU; dòng đầu là type session, cuối có xuống dòng", () => {
    const header = headerOf();
    const text = mine.serializeSessionLog(header as never, EVENTS as never);
    expect(text).toBe(stock.serializeSessionLog(header as never, EVENTS as never));
    expect(text.endsWith("\n")).toBe(true);
    const lines = text.split("\n");
    expect(lines.length).toBe(EVENTS.length + 2);
    const first = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(first["type"]).toBe("session");
    expect(first["delegationDepth"]).toBe(0);
    expect(Object.keys(first).includes("cwd")).toBe(false);
  });

  test("trường TUỲ CHỌN: có thì xuất, không có thì BỎ (cwd · parentSession · origin · agentPreset · delegationDepth)", () => {
    const full = headerOf({ cwd: "/w", parentSession: "p", origin: "subagent", delegationDepth: 2, agentPreset: "x" });
    expect(mine.serializeSessionLog(full as never, [])).toBe(stock.serializeSessionLog(full as never, []));
    const first = JSON.parse(mine.serializeSessionLog(full as never, []).split("\n")[0] as string) as Record<string, unknown>;
    expect(first["cwd"]).toBe("/w");
    expect(first["parentSession"]).toBe("p");
    expect(first["origin"]).toBe("subagent");
    expect(first["delegationDepth"]).toBe(2);
    expect(first["agentPreset"]).toBe("x");
  });
});

describe("D. sessionLogZipFilename — đường dẫn ZIP AN TOÀN, đối chứng từng chuỗi", () => {
  test("id thường và id có ký tự nguy hiểm đều BẰNG bản gốc", () => {
    for (const id of ["abc", "a/b/../c", "sén", "..", "", "id with space", "x".repeat(40)]) {
      expect(mine.sessionLogZipFilename(id)).toBe(stock.sessionLogZipFilename(id));
    }
    expect(mine.sessionLogZipFilename("abc")).toBe("dsh-session-abc.zip");
    expect(mine.sessionLogZipFilename("a/b")).toBe("dsh-session-a_b.zip");
    // MỌI ký tự ngoài [A-Za-z0-9_-] đều thành "_" (kể cả dấu chấm) ⇒ "../../etc/passwd" thành 6 gạch
    // đầu — đúng NGUYÊN VĂN regex của bản gốc, và đó là điều làm "../" vô hại trong tên mục ZIP.
    expect(mine.sessionLogZipFilename("../../etc/passwd")).toBe("dsh-session-______etc_passwd.zip");
    expect(mine.sessionLogZipFilename("..")).toBe("dsh-session-__.zip");
  });
});

describe("E. readSessionLogText — đọc qua tay nắm lưu bền, đối chứng trên cùng đầu vào", () => {
  test("ca THƯỜNG: văn bản BẰNG NHAU và close() gọi ĐÚNG MỘT lần mỗi bên", async () => {
    const logs = new Map([["s1", { header: headerOf({ id: "s1" }), events: EVENTS }]]);
    const a = fakePersistence(logs);
    const b = fakePersistence(logs);
    const oursText = await mine.readSessionLogText(a.persistence as never, "s1" as never);
    const stockText = await stock.readSessionLogText(b.persistence as never, "s1" as never);
    expect(oursText).toBe(stockText);
    expect(oursText).toBe(mine.serializeSessionLog(headerOf({ id: "s1" }) as never, EVENTS as never));
    expect(a.closes.length).toBe(1);
    expect(b.closes.length).toBe(1);
  });

  test("ca KHÔNG TỒN TẠI: ném ĐÚNG lớp NotFoundError của kernel ⇒ CẢ HAI trả undefined", async () => {
    const a = fakePersistence(new Map());
    const b = fakePersistence(new Map());
    expect(await mine.readSessionLogText(a.persistence as never, "x" as never)).toBeUndefined();
    expect(await stock.readSessionLogText(b.persistence as never, "x" as never)).toBeUndefined();
  });

  test("ca LỖI KHÁC: ném lại NGUYÊN VẸN ở cả hai bên (không nuốt thành undefined)", async () => {
    const boom = new Error("disk on fire");
    const making = { open: async (): Promise<unknown> => { throw boom; } };
    const oursError = await failureOf(() => mine.readSessionLogText(making as never, "s1" as never));
    const stockError = await failureOf(() => stock.readSessionLogText(making as never, "s1" as never));
    expect(oursError).toBe(boom);
    expect(stockError).toBe(boom);
  });

  test("ca HUỶ: signal được CHUYỂN TIẾP vào open/read, và lỗi huỷ NÉM LẠI y hệt ở cả hai bên", async () => {
    // Bản gốc KHÔNG tự kiểm signal trước khi mở: nó chuyển signal vào options của open/read. Giàn dưới
    // đây ghi lại options để CHỨNG MINH việc chuyển tiếp, rồi ném AbortError như backend thật sẽ làm.
    const seen: { access?: string; aborted?: boolean }[] = [];
    const persistence = {
      open: async (_id: string, access: string, options?: { signal?: AbortSignal }): Promise<unknown> => {
        seen.push({ access, aborted: options?.signal?.aborted });
        if (options?.signal?.aborted === true) throw new DOMException("huỷ", "AbortError");
        return { header: headerOf({ id: "s1" }), read: async () => ({ events: [] }), close: async () => undefined };
      },
    };
    const controller = new AbortController();
    controller.abort();
    const oursError = await failureOf(() => mine.readSessionLogText(persistence as never, "s1" as never, controller.signal));
    const stockError = await failureOf(() => stock.readSessionLogText(persistence as never, "s1" as never, controller.signal));
    expect(oursError).toBeInstanceOf(Error);
    expect(stockError).toBeInstanceOf(Error);
    expect((oursError as Error).name).toBe("AbortError");
    expect((stockError as Error).name).toBe("AbortError");
    expect((oursError as Error).message).toBe((stockError as Error).message);
    expect(seen).toEqual([{ access: "read", aborted: true }, { access: "read", aborted: true }]);
  });
});

describe("F. flushLiveSessionLog — hàng rào flush trước khi đọc, đối chứng", () => {
  test("phiên ĐANG SỐNG: flush gọi ĐÚNG MỘT lần; phiên lạ / không có sổ phiên: KHÔNG gọi", async () => {
    const flushed: string[] = [];
    const session = { id: "s1" };
    const sessions = { get: (id: string): unknown => (id === "s1" ? session : undefined), flush: async (target: unknown): Promise<boolean> => { flushed.push((target as { id: string }).id); return true; } };
    await mine.flushLiveSessionLog({ sessions } as never, "s1" as never);
    await stock.flushLiveSessionLog({ sessions } as never, "s1" as never);
    expect(flushed).toEqual(["s1", "s1"]);
    await mine.flushLiveSessionLog({ sessions } as never, "cold" as never);
    await mine.flushLiveSessionLog({ sessions: undefined } as never, "s1" as never);
    expect(flushed).toEqual(["s1", "s1"]);
  });

  test("signal đã huỷ ⇒ NÉM TRƯỚC khi flush (cả hai bên), và lỗi flush được ném lại", async () => {
    const flushed: string[] = [];
    const sessions = { get: (): unknown => ({ id: "s1" }), flush: async (): Promise<boolean> => { flushed.push("x"); return true; } };
    const controller = new AbortController();
    controller.abort();
    const oursError = await failureOf(() => mine.flushLiveSessionLog({ sessions } as never, "s1" as never, controller.signal));
    const stockError = await failureOf(() => stock.flushLiveSessionLog({ sessions } as never, "s1" as never, controller.signal));
    expect((oursError as Error).name).toBe("AbortError");
    expect((stockError as Error).name).toBe("AbortError");
    expect(flushed).toEqual([]);
    const boom = new Error("flush loi");
    const broken = { get: (): unknown => ({ id: "s1" }), flush: async (): Promise<boolean> => { throw boom; } };
    expect(await failureOf(() => mine.flushLiveSessionLog({ sessions: broken } as never, "s1" as never))).toBe(boom);
    expect(await failureOf(() => stock.flushLiveSessionLog({ sessions: broken } as never, "s1" as never))).toBe(boom);
  });
});

describe("G. sessionLogExportDeps — đọc service từ Context cordis THẬT, đối chứng", () => {
  test("Context thật có 4 service ⇒ hai bên trả CÙNG bộ; Context rỗng ⇒ cả bốn undefined", () => {
    const services = { sessionQuery: { traceSession: async () => ({ descendants: [] }) }, sessionPersistence: { open: async () => undefined }, attachments: { readImage: async () => ({ data: new Uint8Array() }), readFileStream: () => (async function* () {})() }, sessions: { get: () => undefined, flush: async () => true } };
    const ctx = new ContextCtor() as { provide(name: string, value?: unknown): () => void };
    for (const [name, value] of Object.entries(services)) ctx.provide(name, value);
    const oursDeps = mine.sessionLogExportDeps(ctx as never);
    const stockDeps = stock.sessionLogExportDeps(ctx as never);
    expect(Object.keys(oursDeps).sort()).toEqual(Object.keys(stockDeps).sort());
    for (const key of Object.keys(services) as (keyof typeof services)[]) expect(oursDeps[key]).toBe(stockDeps[key]);
    const empty = mine.sessionLogExportDeps(new ContextCtor() as never);
    expect(Object.values(empty).every((value) => value === undefined)).toBe(true);
  });
});

describe("H. sessionLogZipEntries — thứ tự + đường dẫn + khử trùng, đối chứng", () => {
  /**
   * Dựng bộ dịch vụ giả cho một lần xuất.
   * Nhận: options.logs — log của các phiên con; options.lineage — id các phiên con.
   * Trả: { deps, reads } — dịch vụ đã hẹp và bộ ghi các lần đọc đính kèm.
   */
  function depsOf(options: { logs: Map<string, { header: FakeHeader; events: FakeEvent[] }>; lineage: readonly string[] }): { deps: FakeServices; reads: string[] } {
    const reads: string[] = [];
    const persistence = fakePersistence(options.logs).persistence;
    return {
      reads,
      deps: {
        sessionQuery: { traceSession: async (): Promise<{ descendants: unknown[] }> => ({ descendants: lineageOf(options.lineage) }) },
        sessionPersistence: persistence,
        attachments: fakeAttachments(reads),
        sessions: { get: (): unknown => undefined, flush: async (): Promise<boolean> => true },
      },
    };
  }

  /**
   * Gom mọi mục của một generator thành bảng dễ so.
   * Nhận: generator — các mục ZIP.
   * Trả: mảng { path, content } với content là văn bản hoặc mô tả byte.
   */
  async function entriesOf(generator: AsyncGenerator<unknown>): Promise<{ path: string; content: string }[]> {
    const out: { path: string; content: string }[] = [];
    for await (const item of generator) {
      const entry = item as { path: string; content?: string; data?: Uint8Array; chunks?: AsyncIterable<Uint8Array> };
      if (entry.content !== undefined) out.push({ path: entry.path, content: entry.content });
      else if (entry.data !== undefined) out.push({ path: entry.path, content: "bytes:" + [...entry.data].join(",") });
      else if (entry.chunks !== undefined) {
        const pieces: number[] = [];
        for await (const chunk of entry.chunks) pieces.push(...chunk);
        out.push({ path: entry.path, content: "stream:" + pieces.join(",") });
      }
    };
    return out;
  }

  test("gốc + 2 subagent + ảnh/tệp: danh sách mục BẰNG NHAU, ảnh dùng chung chỉ MỘT mục", async () => {
    const root = mine.serializeSessionLog(headerOf() as never, EVENTS as never);
    const childLogs = new Map([
      ["child-1", { header: headerOf({ id: "child-1", origin: "subagent" }), events: [EVENTS[0] as FakeEvent] }],
      ["child-2", { header: headerOf({ id: "child-2", origin: "subagent" }), events: [] }],
    ]);
    const a = depsOf({ logs: childLogs, lineage: ["child-1", "child-2"] });
    const b = depsOf({ logs: childLogs, lineage: ["child-1", "child-2"] });
    const oursEntries = await entriesOf(mine.sessionLogZipEntries(a.deps as never, root, "session-1" as never, true) as AsyncGenerator<unknown>);
    const stockEntries = await entriesOf(stock.sessionLogZipEntries(b.deps as never, root, "session-1" as never, true) as AsyncGenerator<unknown>);
    expect(oursEntries).toEqual(stockEntries);
    expect(oursEntries.map((entry) => entry.path)).toEqual([
      mine.SESSION_LOG_FILENAME,
      "subagents/child-1/" + mine.SESSION_LOG_FILENAME,
      "subagents/child-2/" + mine.SESSION_LOG_FILENAME,
      "media/sha256:aa11.png",
      "files/bb/bb22/báo cáo_.._x.txt",
    ]);
    expect(a.reads).toEqual(b.reads);
    expect(a.reads.filter((read) => read.startsWith("image:"))).toEqual(["image:sha256:aa11"]);
  });

  test("includeDescendants=false ⇒ CHỈ log gốc + đính kèm (không subagent), cả hai bên giống nhau", async () => {
    const root = mine.serializeSessionLog(headerOf() as never, EVENTS as never);
    const a = depsOf({ logs: new Map(), lineage: ["child-1"] });
    const b = depsOf({ logs: new Map(), lineage: ["child-1"] });
    const oursEntries = await entriesOf(mine.sessionLogZipEntries(a.deps as never, root, "session-1" as never, false) as AsyncGenerator<unknown>);
    const stockEntries = await entriesOf(stock.sessionLogZipEntries(b.deps as never, root, "session-1" as never, false) as AsyncGenerator<unknown>);
    expect(oursEntries).toEqual(stockEntries);
    expect(oursEntries.some((entry) => entry.path.startsWith("subagents/"))).toBe(false);
    // CHỈ log gốc + ảnh + tệp (hai đính kèm được log gốc tham chiếu) = 3 mục.
    expect(oursEntries.length).toBe(3);
  });

  test("subagent KHÔNG có log ⇒ NÉM CÙNG THÔNG ĐIỆP ở cả hai bên (fail-loud, không xuất thiếu)", async () => {
    const root = mine.serializeSessionLog(headerOf() as never, EVENTS as never);
    const a = depsOf({ logs: new Map(), lineage: ["ghost"] });
    const b = depsOf({ logs: new Map(), lineage: ["ghost"] });
    const oursError = await failureOf(async () => { for await (const _ of mine.sessionLogZipEntries(a.deps as never, root, "session-1" as never, true) as AsyncGenerator<unknown>) void _; });
    const stockError = await failureOf(async () => { for await (const _ of stock.sessionLogZipEntries(b.deps as never, root, "session-1" as never, true) as AsyncGenerator<unknown>) void _; });
    expect((oursError as Error).message).toBe((stockError as Error).message);
    expect((oursError as Error).message).toBe("subagent \"ghost\" has no stored log");
  });
});

describe("I. streamSessionLogZip — BYTE của ZIP theo luồng, đối chứng", () => {
  test("cùng đầu vào ⇒ ZIP BẰNG TỪNG BYTE; giải nén ra cùng bảng mục", async () => {
    const root = mine.serializeSessionLog(headerOf() as never, EVENTS as never);
    const reads: string[] = [];
    const persistence = fakePersistence(new Map()).persistence;
    const deps = { sessionQuery: { traceSession: async (): Promise<{ descendants: unknown[] }> => ({ descendants: [] }) }, sessionPersistence: persistence, attachments: fakeAttachments(reads), sessions: undefined };
    const controller = new AbortController();
    // ĐÓNG BĂNG đồng hồ: fflate nhúng Date.now() vào header ZIP, nên so BYTE chỉ có nghĩa khi cả hai
    // lần sinh nằm trong cùng một mốc thời gian.
    const { oursBytes, stockBytes } = await atFixedClock(async () => ({
      oursBytes: await collect(mine.streamSessionLogZip(deps as never, root, "session-1" as never, false, 6, controller.signal) as ReadableStream<Uint8Array>),
      stockBytes: await collect(stock.streamSessionLogZip(deps as never, root, "session-1" as never, false, 6, controller.signal) as ReadableStream<Uint8Array>),
    }));
    expect(oursBytes.byteLength).toBe(stockBytes.byteLength);
    expect([...oursBytes]).toEqual([...stockBytes]);
    const oursZip = zipEntries(oursBytes);
    expect(Object.keys(oursZip).sort()).toEqual(Object.keys(zipEntries(stockBytes)).sort());
    expect(oursZip[mine.SESSION_LOG_FILENAME]).toBe(root);
    expect(oursZip["media/sha256:aa11.png"]).toBe(new TextDecoder().decode(new Uint8Array([1, 2, 3, 4])));
    expect(oursZip["files/bb/bb22/báo cáo_.._x.txt"]).toBe(new TextDecoder().decode(new Uint8Array([9, 8, 7])));
  });

  test("mức nén khác nhau cho ZIP khác nhau, và mức 0 vẫn mở được (đối chứng cả hai bên)", async () => {
    const root = mine.serializeSessionLog(headerOf() as never, EVENTS as never);
    const deps = { sessionQuery: { traceSession: async (): Promise<{ descendants: unknown[] }> => ({ descendants: [] }) }, sessionPersistence: fakePersistence(new Map()).persistence, attachments: fakeAttachments([]), sessions: undefined };
    const controller = new AbortController();
    const { level9, stockLevel9, level0 } = await atFixedClock(async () => ({
      level9: await collect(mine.streamSessionLogZip(deps as never, root, "session-1" as never, false, 9, controller.signal) as ReadableStream<Uint8Array>),
      stockLevel9: await collect(stock.streamSessionLogZip(deps as never, root, "session-1" as never, false, 9, controller.signal) as ReadableStream<Uint8Array>),
      level0: await collect(mine.streamSessionLogZip(deps as never, root, "session-1" as never, false, 0, controller.signal) as ReadableStream<Uint8Array>),
    }));
    expect([...level9]).toEqual([...stockLevel9]);
    expect(level0.byteLength).toBeGreaterThan(level9.byteLength);
    expect(zipEntries(level0)[mine.SESSION_LOG_FILENAME]).toBe(root);
  });

  test("signal HUỶ trước khi đọc ⇒ luồng lỗi ở cả hai bên, không treo", async () => {
    const root = mine.serializeSessionLog(headerOf() as never, EVENTS as never);
    const deps = { sessionQuery: { traceSession: async (): Promise<{ descendants: unknown[] }> => ({ descendants: [] }) }, sessionPersistence: fakePersistence(new Map()).persistence, attachments: fakeAttachments([]), sessions: undefined };
    const controller = new AbortController();
    controller.abort();
    const oursError = await failureOf(() => collect(mine.streamSessionLogZip(deps as never, root, "session-1" as never, false, 6, controller.signal) as ReadableStream<Uint8Array>));
    const stockError = await failureOf(() => collect(stock.streamSessionLogZip(deps as never, root, "session-1" as never, false, 6, controller.signal) as ReadableStream<Uint8Array>));
    expect(oursError).toBeInstanceOf(Error);
    expect(stockError).toBeInstanceOf(Error);
    expect((oursError as Error).name).toBe((stockError as Error).name);
  });
});

describe("J. apply + route /api/session.export trên Context cordis THẬT — đối chứng", () => {
  /** Sổ đăng ký bắt được từ một lần cài. */
  interface ApplyHarness {
    /** Lệnh đã đăng ký. */
    commands: { definitionId: string; name: string; description: string; handler: (invocation: { rawInput: string }) => Promise<{ kind: string; text: string }> }[];
    /** Route đã đăng ký. */
    routes: { path: string; methods: readonly string[]; requestBody: string; fetch: (request: Request) => Promise<Response> }[];
    /** Context thật đã đắp service. */
    ctx: object;
  }

  /**
   * Dựng một giàn cài trên Context THẬT: đắp service commands/connection + các service xuất.
   * Nhận: services — các service xuất cần đắp (có thể thiếu để thử nhánh 500).
   * Trả: giàn đo.
   */
  function applyHarness(services: Record<string, unknown>): ApplyHarness {
    const commands: ApplyHarness["commands"] = [];
    const routes: ApplyHarness["routes"] = [];
    const ctx = new ContextCtor() as { provide(name: string, value?: unknown): () => void };
    for (const [name, value] of Object.entries(services)) ctx.provide(name, value);
    ctx.provide("commands", { register: (definition: ApplyHarness["commands"][number]): (() => void) => { commands.push(definition); return () => undefined; } });
    ctx.provide("connection", { fetch: { register: (route: ApplyHarness["routes"][number]): unknown => { routes.push(route); return undefined; } } });
    return { commands, routes, ctx };
  }

  /** Dịch vụ xuất ĐẦY ĐỦ cho nhánh 200 (một phiên gốc có log, không con, có ảnh/tệp). */
  function fullServices(): Record<string, unknown> {
    const logs = new Map([["session-1", { header: headerOf(), events: EVENTS }]]);
    return { sessionQuery: { traceSession: async (): Promise<{ descendants: unknown[] }> => ({ descendants: [] }) }, sessionPersistence: fakePersistence(logs).persistence, attachments: fakeAttachments([]) };
  }

  test("đăng ký ĐÚNG một lệnh + ĐÚNG một route, hình dạng BẰNG bản gốc", async () => {
    const a = applyHarness(fullServices());
    const b = applyHarness(fullServices());
    mine.apply(a.ctx as never);
    stock.apply(b.ctx as never);
    expect(a.commands.length).toBe(1);
    expect(b.commands.length).toBe(1);
    expect(a.commands[0]?.definitionId).toBe(b.commands[0]?.definitionId);
    expect(String(a.commands[0]?.definitionId)).toBe("@deepseek-ai/dsh-session-log-export");
    expect(a.commands[0]?.name).toBe("export");
    expect(a.commands[0]?.description).toBe(b.commands[0]?.description);
    expect(a.routes.length).toBe(1);
    expect(a.routes[0]?.path).toBe(stock.SESSION_LOG_EXPORT_PATH);
    expect(a.routes[0]?.methods).toEqual(["GET", "HEAD"]);
    expect(a.routes[0]?.requestBody).toBe("buffered");
  });

  test("lệnh /export: chuỗi rỗng ⇒ REQUESTED; có đường dẫn ⇒ LỖI — BẰNG bản gốc từng ký tự", async () => {
    const a = applyHarness(fullServices());
    const b = applyHarness(fullServices());
    mine.apply(a.ctx as never, { compressionLevel: 6 } as never);
    stock.apply(b.ctx as never, { compressionLevel: 6 } as never);
    for (const raw of ["", "   ", " /tmp/x", "x.txt"]) {
      const oursResult = await a.commands[0]?.handler({ rawInput: raw });
      const stockResult = await b.commands[0]?.handler({ rawInput: raw });
      expect(oursResult).toEqual(stockResult);
    }
    expect(await a.commands[0]?.handler({ rawInput: "" })).toEqual({ kind: "success", text: "Session log download requested." });
    expect(await a.commands[0]?.handler({ rawInput: " /x" })).toEqual({ kind: "error", text: "The Web /export command does not accept a path." });
  });

  test("route: 400 (thiếu/sai tham số) — thân BẰNG bản gốc", async () => {
    const a = applyHarness(fullServices());
    const b = applyHarness(fullServices());
    mine.apply(a.ctx as never);
    stock.apply(b.ctx as never);
    const urls = [
      "http://x/api/session.export",
      "http://x/api/session.export?sessionId=",
      "http://x/api/session.export?sessionId=s1&includeDescendants=yes",
      "http://x/api/session.export?sessionId=s1&includeDescendants=",
    ];
    for (const url of urls) {
      const oursResponse = await (a.routes[0]?.fetch(new Request(url)) as Promise<Response>);
      const stockResponse = await (b.routes[0]?.fetch(new Request(url)) as Promise<Response>);
      expect(oursResponse.status).toBe(stockResponse.status);
      expect(oursResponse.status).toBe(400);
      expect(await oursResponse.text()).toBe(await stockResponse.text());
    }
  });

  test("route: 500 khi THIẾU service, 404 khi phiên không tồn tại, 500 khi đọc hỏng — BẰNG bản gốc", async () => {
    const missing = applyHarness({});
    const stockMissing = applyHarness({});
    mine.apply(missing.ctx as never);
    stock.apply(stockMissing.ctx as never);
    const url = "http://x/api/session.export?sessionId=s1";
    const ours500 = await (missing.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    const stock500 = await (stockMissing.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    expect(ours500.status).toBe(500);
    expect(ours500.status).toBe(stock500.status);
    const ours500Text = await ours500.text();
    expect(ours500Text).toBe(await stock500.text());
    expect(ours500Text).toBe("session log export is unavailable: missing session-query, session-persistence, or attachments service");

    const cold = applyHarness({ sessionQuery: { traceSession: async () => ({ descendants: [] }) }, sessionPersistence: fakePersistence(new Map()).persistence, attachments: fakeAttachments([]) });
    const stockCold = applyHarness({ sessionQuery: { traceSession: async () => ({ descendants: [] }) }, sessionPersistence: fakePersistence(new Map()).persistence, attachments: fakeAttachments([]) });
    mine.apply(cold.ctx as never);
    stock.apply(stockCold.ctx as never);
    const ours404 = await (cold.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    const stock404 = await (stockCold.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    expect(ours404.status).toBe(404);
    expect(ours404.status).toBe(stock404.status);
    const ours404Text = await ours404.text();
    expect(ours404Text).toBe(await stock404.text());
    expect(ours404Text).toBe("session not found");

    const boom = new Error("khong doc duoc");
    const brokenServices = { sessionQuery: { traceSession: async () => ({ descendants: [] }) }, sessionPersistence: { open: async (): Promise<unknown> => { throw boom; } }, attachments: fakeAttachments([]) };
    const broken = applyHarness(brokenServices);
    const stockBroken = applyHarness(brokenServices);
    mine.apply(broken.ctx as never);
    stock.apply(stockBroken.ctx as never);
    const oursReadFail = await (broken.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    const stockReadFail = await (stockBroken.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    expect(oursReadFail.status).toBe(500);
    const oursReadFailText = await oursReadFail.text();
    expect(oursReadFailText).toBe(await stockReadFail.text());
    expect(oursReadFailText).toBe("session log export failed to read the stored log");
  });

  test("route: 200 GET — header + nội dung ZIP BẰNG bản gốc (cùng độ dài, cùng bảng mục); HEAD cùng header nhưng KHÔNG thân", async () => {
    const a = applyHarness(fullServices());
    const b = applyHarness(fullServices());
    mine.apply(a.ctx as never, { compressionLevel: 6 } as never);
    stock.apply(b.ctx as never, { compressionLevel: 6 } as never);
    const url = "http://x/api/session.export?sessionId=session-1";
    const oursResponse = await (a.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    const stockResponse = await (b.routes[0]?.fetch(new Request(url)) as Promise<Response>);
    expect(oursResponse.status).toBe(200);
    expect(oursResponse.headers.get("content-type")).toBe("application/zip");
    expect(oursResponse.headers.get("content-type")).toBe(stockResponse.headers.get("content-type"));
    expect(oursResponse.headers.get("content-disposition")).toBe(stockResponse.headers.get("content-disposition"));
    expect(oursResponse.headers.get("content-disposition")).toBe("attachment; filename=\"dsh-session-session-1.zip\"");
    // Ở tầng ROUTE, phép so có ý nghĩa là NỘI DUNG + ĐỘ DÀI: fflate nhúng Date.now() vào header ZIP và
    // luồng đã khởi động ngay khi Response được dựng, nên so BYTE ở đây sẽ đo cả thời điểm. Phép so BYTE
    // TỪNG ký tự đã có ở mục I trên CÙNG một mốc đồng hồ đóng băng.
    const oursBytes = await collect(oursResponse.body as ReadableStream<Uint8Array>);
    const stockBytes = await collect(stockResponse.body as ReadableStream<Uint8Array>);
    expect(oursBytes.byteLength).toBe(stockBytes.byteLength);
    const oursZip = zipEntries(oursBytes);
    const stockZip = zipEntries(stockBytes);
    expect(Object.keys(oursZip).sort()).toEqual(Object.keys(stockZip).sort());
    expect(oursZip).toEqual(stockZip);
    expect(Object.keys(oursZip)).toContain(mine.SESSION_LOG_FILENAME);

    const oursHead = await (a.routes[0]?.fetch(new Request(url, { method: "HEAD" })) as Promise<Response>);
    const stockHead = await (b.routes[0]?.fetch(new Request(url, { method: "HEAD" })) as Promise<Response>);
    expect(oursHead.status).toBe(200);
    expect(oursHead.status).toBe(stockHead.status);
    expect(oursHead.headers.get("content-disposition")).toBe(stockHead.headers.get("content-disposition"));
    expect(oursHead.body).toBeNull();
  });
});

describe("K. LUẬT 000e + KHAI BÁO — locale byte-for-byte, ĐỦ HAI NỬA, gbh.row khai ĐỦ", () => {
  test("locale/{en,zh}.json của ta KHỚP TỪNG BYTE bản gốc và giữ meta.title", () => {
    for (const name of ["en.json", "zh.json"]) {
      const oursText = readFileSync(join(PKG, "locale", name), "utf8");
      const stockText = readFileSync(join(STOCK_DIR, "locale", name), "utf8");
      expect(oursText).toBe(stockText);
    }
    const en = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    expect(en.meta?.title).toBe("session-log-export");
  });

  test("package.json: exports ./client + dsh.client KHỚP gốc, gbh.row khai ĐỦ, gbh.peers ⊆ peerDependencies", () => {
    const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name: string; main: string; exports?: Record<string, unknown>; dsh?: unknown;
      peerDependencies?: Record<string, string>;
      gbh?: {
        peers?: string[];
        row?: { id?: string; stockId?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[] };
        row_unmounted_ly_do?: { ly_do?: string; row?: unknown };
      };
    };
    const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { dsh?: unknown };
    expect(meta.name).toBe("@galaxy-blackhole/gbh-session-log-export");
    expect(meta.main).toBe("lib/index.js");
    expect(meta.exports?.["./client"]).toBe("./lib/client.js");
    // Nửa client đã port đủ ⇒ khai dsh.client y như gốc (5 inject, platform web).
    // 20/10/2026 — so SAU bản đồ id (brand + 566 id) để ca này còn đúng khi inject của manifest được
    // rewrite sang id GBH như 55 gói khác; hiện manifest còn id stock nên phép so là identity.
    expect(sameAfterIdMap(meta.dsh, stockManifest.dsh)).toBe(true);
    // 20/10/2026 — KHÔNG phải lỗi brand: manifest đã chuyển từ PARK (row_unmounted_ly_do) sang KHAI THẬT
    // gbh.row (đợt mount M6; check:rows báo 182 gói có gbh.row đều ĐẠT). Ca này giữ nguyên ĐỘ CHẶT: row phải
    // đủ id/stockId/moduleIds/aliases/tests, stock id CHỈ nằm ở aliases (luật MỘT CHỖ), và KHÔNG park nữa.
    expect(meta.gbh?.row?.id).toBe("session-log-download");
    expect(meta.gbh?.row?.stockId).toBe("@deepseek-ai/dsh-session-log-export");
    expect(meta.gbh?.row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-session-log-export"]);
    expect(meta.gbh?.row?.aliases).toEqual(["@deepseek-ai/dsh-session-log-export"]);
    expect(meta.gbh?.row?.moduleIds?.includes("@deepseek-ai/dsh-session-log-export")).toBe(false);
    expect(meta.gbh?.row?.tests).toEqual(["tests/host/session-log-export.test.ts"]);
    expect(meta.gbh?.row_unmounted_ly_do).toBeUndefined();
    const contract = new Set(Object.keys(meta.peerDependencies ?? {}));
    const missing = (meta.gbh?.peers ?? []).filter((peer) => !contract.has(peer));
    expect(missing).toEqual([]);
    expect(meta.gbh?.peers?.length).toBeGreaterThan(0);
    // fflate là thư viện thứ ba nhưng PHẢI là peer: mount.ts chỉ symlink peer vào profile, khai
    // dependencies sẽ không có module lúc chạy (ghi lý do ở README, chờ Lead duyệt §3b).
    expect(meta.gbh?.peers).toContain("fflate");
    expect(meta.peerDependencies?.["fflate"]).toBeDefined();
  });

  test("TRÙNG TÊN service/plugin: chỉ gói NÀY khai name = session-log-download trong repo", () => {
    const roots = [join(REPO, "packages", "host"), join(REPO, "packages", "client")];
    const declares: string[] = [];
    /**
     * Duyệt cây package tìm khai báo tên plugin trùng tên row.
     * Nhận: dir — thư mục cần duyệt.
     * Trả: không (ghi vào declares).
     */
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "lib") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".ts")) continue;
        const text = readFileSync(full, "utf8");
        if (/export\s+const\s+name\s*=\s*"session-log-download"/.test(text)) declares.push(full.slice(REPO.length + 1));
      }
    };
    for (const root of roots) walk(root);
    expect(declares).toEqual(["packages/host/session-log-export/src/index.ts"]);
  });
});
