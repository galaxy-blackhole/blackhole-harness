/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test đối chứng cho nửa HOST của @galaxy-blackhole/gbh-office-to-pdf. Nhóm A/B chạy CẢ HAI bản trên
 *      Context cordis THẬT (bề mặt, Config, thế hệ, validation, ánh xạ lỗi Remote — an toàn vì bộ chuyển đổi
 *      được tạo LƯỜI); nhóm HÀNH VI chạy bản của ta với BỘ CHUYỂN ĐỔI GIẢ (không cần LibreOffice): hàng đợi,
 *      thư mục tạm + dọn dẹp, kiểm %PDF-/%%EOF, trần byte, huỷ, dọn provider, bộ đệm. Phần KHÔNG đo được:
 *      render thật của LibreOffice (README §5).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/office-to-pdf/build.ts";
import * as ours from "../../packages/host/office-to-pdf/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "office-to-pdf");
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-office-to-pdf");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis THẬT. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as {
  OfficeToPdf: new (ctx: unknown, config: unknown) => unknown;
  OfficeToPdfError: new (code: string, message: string, options?: ErrorOptions) => Error;
  OfficeToPdfGeneration: (value: string) => string;
  Config: ((value: unknown) => unknown) & { toString(): string };
  default: unknown;
};
/** Bản của ta nhìn qua cùng hình dạng (riêng hàm dựng nhận thêm nhà máy bộ chuyển đổi GIẢ). */
const mine = ours as unknown as typeof stock & {
  OfficeToPdf: new (ctx: unknown, config: unknown, factory?: unknown) => any;
};

/**
 * Dựng Context cordis THẬT có `effect` dạng GENERATOR như kernel + `get` trả service giả.
 * Nhận: bản đồ service theo khoá.
 * Trả: context và danh sách hàm dọn.
 */
function makeCtx(services: Record<string, unknown> = {}): { ctx: unknown; effects: (() => Promise<void>)[] } {
  const effects: (() => Promise<void>)[] = [];
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "effect") {
        // cordis nhận HAI dạng: hàm dựng trả GENERATOR (yield hàm dọn) hoặc trả THẲNG hàm dọn async.
        return (factory: () => unknown) => {
          const produced = factory() as (() => Promise<void>) | Generator<() => Promise<void>, void, void>;
          if (typeof produced === "function") {
            effects.push(produced);
            return () => undefined;
          }
          const step = produced.next();
          if (typeof step.value === "function") effects.push(step.value);
          return () => undefined;
        };
      }
      if (prop === "get") return (key: string) => services[key];
      if (prop === "logger") return { warn() {}, error() {} };
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { ctx, effects };
}

/** Cấu hình tối thiểu (mọi trường bắt buộc) cho test hàng đợi. */
function configOf(overrides: Record<string, unknown> = {}): any {
  return {
    maxConcurrentConversions: 2,
    maxQueuedJobs: 8,
    maxReaders: 32,
    maxSourceBytes: 104857600,
    maxBackgroundConversions: 1,
    maxCachedEntries: 8,
    maxCachedBytes: 134217728,
    maxSourceEntries: 64,
    timeoutMs: 60000,
    maxInputBytes: 50 * 1024 * 1024,
    maxOutputBytes: 100 * 1024 * 1024,
    maxImageResolution: 192,
    maxArchiveEntries: 10000,
    maxUncompressedBytes: 250 * 1024 * 1024,
    maxFontFiles: 20000,
    maxFontFileBytes: 256 * 1024 * 1024,
    maxLoadedFontBytes: 512 * 1024 * 1024,
    ...overrides,
  };
}

/** PDF hợp lệ tối thiểu mà bộ kiểm của bản gốc chấp nhận. */
function pdfOf(body = "noi-dung"): Buffer {
  return Buffer.from("%PDF-1.7\n" + body + "\n%%EOF\n", "ascii");
}

/**
 * Nhà máy bộ chuyển đổi GIẢ: ghi tệp PDF cho trước vào `outputPath`, đếm số lần render.
 * Nhận: nội dung PDF (hoặc hàm sinh theo lần gọi) và danh sách font thiếu.
 * Trả: { factory, calls, missingFonts }.
 */
function fakeConverter(
  content: Buffer | (() => Buffer) = pdfOf(),
  missingFonts: string[] = [],
): { factory: unknown; calls: { count: number; options: unknown[] }; inputs: string[] } {
  const calls = { count: 0, options: [] as unknown[] };
  const inputs: string[] = [];
  const factory = async (options: unknown) => {
    calls.options.push(options);
    return {
      async render(request: { inputPath: string; outputPath: string }) {
        calls.count += 1;
        inputs.push(readFileSync(request.inputPath, "utf8"));
        await writeFile(request.outputPath, typeof content === "function" ? content() : content);
        return { missingFonts };
      },
      async dispose() {},
    };
  };
  return { factory, calls, inputs };
}

/**
 * Yêu cầu chuyển đổi tối thiểu với byte nguồn cho trước.
 * Nhận: khoá nguồn, version, byte, mức ưu tiên.
 * Trả: yêu cầu.
 */
function requestOf(key = "src-1", version = "v1", bytes = new Uint8Array([1, 2, 3]), priority = "foreground" as const): any {
  const { OfficeSourceKey } = ours as unknown as { OfficeSourceKey: (value: string) => string };
  return {
    extension: "docx",
    priority,
    source: {
      key: OfficeSourceKey(key),
      version,
      bytes: bytes.byteLength,
      read: async () => ({ bytes, version }),
    },
  };
}

/** Tên export của một file ESM đã build. */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Chờ MỘT promise và trả { value } hoặc { code, message }. */
async function outcome(run: () => Promise<unknown>): Promise<{ value?: unknown; code?: string; message?: string }> {
  try {
    return { value: await run() };
  } catch (error) {
    const failure = error as { code?: string; message?: string; details?: { reason?: string } };
    return { code: failure.details?.reason ?? failure.code, message: failure.message };
  }
}

/** Số thư mục tạm `dsh-office-to-pdf-*` đang có (để chứng minh dọn dẹp). */
function scratchDirs(): number {
  return readdirSync(tmpdir()).filter((name) => name.startsWith("dsh-office-to-pdf-")).length;
}

describe("A/B trên Context cordis THẬT — bề mặt, Config, thế hệ, validation, ánh xạ lỗi", () => {
  test("tập export TRÙNG bản gốc (7 tên) và `default` là cùng lớp", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-o2p-")));
    const ourText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(ourText)).toEqual(exportNames(stockText));
    expect(exportNames(ourText)).toEqual([
      "Config",
      "OfficeSourceKey",
      "OfficeToPdf",
      "OfficeToPdfError",
      "OfficeToPdfGeneration",
      "OfficeToPdfKey",
      "default",
    ]);
    expect((mine as any).default).toBe((mine as any).OfficeToPdf);
    // Bản gốc import TĨNH; bản của ta nạp ĐỘNG (để test tiêm được bộ chuyển đổi GIẢ) ⇒ cả hai đều nhắc tên kit.
    expect(ourText.includes("libreoffice-kit")).toBe(true);
    expect(stockText.includes("libreoffice-kit")).toBe(true);
  });

  test("Config: chuỗi schema TRÙNG + giá trị mặc định TRÙNG (17 trường)", () => {
    expect(String((mine as any).Config)).toBe(String(stock.Config));
    const ourResolved = (mine as any).Config({}) as Record<string, unknown>;
    const stockResolved = (stock.Config as (value: unknown) => unknown)({}) as Record<string, unknown>;
    expect(ourResolved).toEqual(stockResolved);
    expect(ourResolved["maxConcurrentConversions"]).toBe(2);
    expect(ourResolved["maxInputBytes"]).toBe(50 * 1024 * 1024);
    expect(ourResolved["timeoutMs"]).toBe(60000);
    expect(ourResolved["fontDirectories"]).toBe(undefined);
  });

  test("thế hệ: brand khác nhau mỗi thể hiện; getGeneration trả CÙNG giá trị và tôn trọng huỷ", async () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock] as const) {
      const first = new (plugin as any).OfficeToPdf(makeCtx().ctx, configOf());
      const second = new (plugin as any).OfficeToPdf(makeCtx().ctx, configOf());
      const same = first.getGeneration(new AbortController().signal) === first.getGeneration(new AbortController().signal);
      const controller = new AbortController();
      controller.abort();
      const aborted = await outcome(async () => first.getGeneration(controller.signal));
      traces.push({
        same,
        distinct: first.generation !== second.generation,
        branded: typeof first.generation === "string" && first.generation.length > 0,
        abortedMessage: aborted.message,
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    // Tín hiệu đã huỷ ⇒ throwIfAborted ném lỗi chuẩn của nền tảng ("The operation was aborted.") — cả hai bản.
    expect(traces[0]).toEqual({ same: true, distinct: true, branded: true, abortedMessage: "The operation was aborted." });
  });

  test("validation constructor: fontDirectories tương đối · maxSourceBytes < maxInputBytes", () => {
    const messages: string[][] = [];
    for (const plugin of [mine, stock] as const) {
      const capture = (config: any): string => {
        try {
          new (plugin as any).OfficeToPdf(makeCtx().ctx, config);
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      };
      messages.push([
        capture(configOf({ fontDirectories: ["relative/fonts"] })),
        capture(configOf({ maxSourceBytes: 1024, maxInputBytes: 2048 })),
      ]);
    }
    expect(messages[0]).toEqual(messages[1]);
    expect(messages[0]).toEqual([
      "fontDirectories must contain absolute paths.",
      "maxSourceBytes must be at least maxInputBytes.",
    ]);
  });

  test("OfficeToPdfError: name · code · message · cause TRÙNG", () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock] as const) {
      const cause = new Error("engine");
      const error = new (plugin as any).OfficeToPdfError("invalid-document", "boom", { cause }) as Error & { code: string };
      traces.push({ name: error.name, code: error.code, message: error.message, cause: (error.cause as Error).message, isError: error instanceof Error });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({ name: "OfficeToPdfError", code: "invalid-document", message: "boom", cause: "engine", isError: true });
  });

  test("render() ánh xạ lỗi: thiếu service ⇒ document-render/failed(unavailable) · đuôi lạ ⇒ (unsupported-format)", async () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock] as const) {
      const service = new (plugin as any).OfficeToPdf(makeCtx().ctx, configOf());
      const noServices = await outcome(() =>
        service.render({ sessionId: "s1", workspaceRoot: "/ws" }, "a.docx", "foreground", new AbortController().signal),
      );
      const badExtension = await outcome(() =>
        service.render({ sessionId: "s1", workspaceRoot: "/ws" }, "a.txt", "foreground", new AbortController().signal),
      );
      traces.push({ noServices, badExtension });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect((traces[0] as any).noServices.code).toBe("unavailable");
    expect((traces[0] as any).badExtension.code).toBe("unsupported-format");
    expect((traces[0] as any).badExtension.message).toBe("Office conversion failed.");
  });
});

describe("HÀNH VI với BỘ CHUYỂN ĐỔI GIẢ — hàng đợi, thư mục tạm, kiểm PDF, trần byte, huỷ, bộ đệm", () => {
  test("chuyển đổi thành công: PDF + generation + cacheKey; DỌN thư mục tạm sau khi xong", async () => {
    const { ctx } = makeCtx();
    const fake = fakeConverter(pdfOf("abc"), ["Arial"]);
    const service = new (mine as any).OfficeToPdf(ctx, configOf(), fake.factory);
    const before = scratchDirs();
    const result = await service.convert(requestOf());
    expect(Buffer.from(result.pdf).toString("ascii")).toBe(pdfOf("abc").toString("ascii"));
    expect(result.missingFonts).toEqual(["Arial"]);
    expect(result.generation).toBe(service.generation);
    expect(typeof result.cacheKey).toBe("string");
    expect(scratchDirs()).toBe(before);
    expect(fake.calls.count).toBe(1);
    expect(fake.inputs[0]).toBe(String.fromCharCode(1, 2, 3));
  });

  test("đầu ra KHÔNG phải PDF ⇒ invalid-output; thiếu %%EOF ⇒ invalid-output", async () => {
    for (const content of [Buffer.from("khong-phai-pdf", "ascii"), Buffer.from("%PDF-1.7\nno-eof", "ascii")]) {
      const { ctx } = makeCtx();
      const fake = fakeConverter(content);
      const service = new (mine as any).OfficeToPdf(ctx, configOf(), fake.factory);
      const result = await outcome(() => service.convert(requestOf()));
      expect(result.code).toBe("invalid-output");
    }
  });

  test("đầu ra vượt maxOutputBytes ⇒ output-too-large; lỗi engine có mã ⇒ GIỮ mã; mã lạ ⇒ failed", async () => {
    const overLimit = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf({ maxOutputBytes: 8 }), fakeConverter().factory);
    expect((await outcome(() => overLimit.convert(requestOf()))).code).toBe("output-too-large");
    const coded = new (mine as any).OfficeToPdf(
      makeCtx().ctx,
      configOf(),
      async () => ({
        async render() {
          throw Object.assign(new Error("engine timeout"), { code: "timeout" });
        },
      }),
    );
    expect((await outcome(() => coded.convert(requestOf()))).code).toBe("timeout");
    const unknown = new (mine as any).OfficeToPdf(
      makeCtx().ctx,
      configOf(),
      async () => ({
        async render() {
          throw new Error("bất ngờ");
        },
      }),
    );
    expect((await outcome(() => unknown.convert(requestOf()))).code).toBe("failed");
  });

  test("nguồn vượt maxInputBytes ⇒ input-too-large; version đổi khi đọc ⇒ source-changed", async () => {
    const { ctx } = makeCtx();
    const service = new (mine as any).OfficeToPdf(ctx, configOf({ maxInputBytes: 4 }), fakeConverter().factory);
    expect((await outcome(() => service.convert(requestOf("k", "v1", new Uint8Array(10))))).code).toBe("input-too-large");
    const { OfficeSourceKey } = ours as unknown as { OfficeSourceKey: (value: string) => string };
    const changed = {
      extension: "docx",
      priority: "foreground",
      source: { key: OfficeSourceKey("k2"), version: "v1", bytes: 4, read: async () => ({ bytes: new Uint8Array(4), version: "v2" }) },
    };
    expect((await outcome(() => service.convert(changed as any))).code).toBe("source-changed");
  });

  test("bộ đệm theo nội dung: cùng nguồn đọc HAI lần chỉ chuyển đổi MỘT lần; PDF trả về là BẢN SAO độc lập", async () => {
    const fake = fakeConverter();
    const service = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf(), fake.factory);
    const first = await service.convert(requestOf("same", "v1"));
    const second = await service.convert(requestOf("same", "v1"));
    expect(fake.calls.count).toBe(1);
    expect(first.pdf).not.toBe(second.pdf);
    first.pdf[5] = 0;
    expect(second.pdf[5]).not.toBe(0);
  });

  test("giới hạn bên đọc: maxReaders=1 + việc NỀN ⇒ busy; maxBackgroundConversions=0 ⇒ việc nền busy", async () => {
    const fake = fakeConverter();
    const one = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf({ maxReaders: 1 }), fake.factory);
    expect((await outcome(() => one.convert(requestOf("bg-1", "v1", undefined as never, "background" as never)))).code).toBe("busy");
    const zero = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf({ maxBackgroundConversions: 0 }), fake.factory);
    expect((await outcome(() => zero.convert(requestOf("bg-2", "v1", undefined as never, "background" as never)))).code).toBe("busy");
  });

  test("huỷ: bên đọc bị huỷ reject ĐÚNG reason của tín hiệu (không phải lỗi engine)", async () => {
    const fake = fakeConverter();
    const service = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf(), fake.factory);
    const controller = new AbortController();
    const pending = service.convert(requestOf("huy", "v1"), controller.signal).catch((error: unknown) => error);
    controller.abort(new Error("nguoi-dung-huy"));
    const error = await pending;
    expect((error as Error).message).toBe("nguoi-dung-huy");
  });

  test("huỷ trước khi gọi ⇒ throwIfAborted ngay (không tạo thư mục tạm)", async () => {
    const fake = fakeConverter();
    const service = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf(), fake.factory);
    const controller = new AbortController();
    controller.abort(new Error("som"));
    const result = await outcome(() => service.convert(requestOf(), controller.signal));
    expect(result.message).toBe("som");
    expect(fake.calls.count).toBe(0);
  });

  test("dọn provider: hiệu ứng dispose chạy, lời gọi SAU đó ⇒ unavailable", async () => {
    const fake = fakeConverter();
    const { ctx, effects } = makeCtx();
    const service = new (mine as any).OfficeToPdf(ctx, configOf(), fake.factory);
    await service.convert(requestOf("d1", "v1"));
    expect(effects).toHaveLength(1);
    await effects[0]?.();
    expect((await outcome(() => service.convert(requestOf("d2", "v1")))).code).toBe("unavailable");
  });

  test("đồng thời: maxConcurrentConversions=1 ⇒ hai nguồn KHÁC nhau chạy TUẦN TỰ, cả hai đều xong", async () => {
    const order: string[] = [];
    const factory = async () => ({
      async render(request: { inputPath: string; outputPath: string }) {
        order.push("start:" + readFileSync(request.inputPath, "utf8"));
        await new Promise((resolve) => setTimeout(resolve, 15));
        await writeFile(request.outputPath, pdfOf());
        order.push("end:" + readFileSync(request.inputPath, "utf8"));
        return { missingFonts: [] };
      },
    });
    const service = new (mine as any).OfficeToPdf(makeCtx().ctx, configOf({ maxConcurrentConversions: 1 }), factory);
    const first = service.convert(requestOf("c1", "v1", new Uint8Array([65])));
    const second = service.convert(requestOf("c2", "v1", new Uint8Array([66])));
    const [a, b] = await Promise.all([first, second]);
    expect(a.pdf.byteLength).toBe(b.pdf.byteLength);
    expect(order).toEqual(["start:A", "end:A", "start:B", "end:B"]);
  });

  test("thư mục tạm luôn bị dọn KỂ CẢ khi engine ném lỗi", async () => {
    const { ctx } = makeCtx();
    const service = new (mine as any).OfficeToPdf(ctx, configOf(), async () => ({
      async render() {
        throw new Error("no-engine");
      },
    }));
    const before = scratchDirs();
    const result = await outcome(() => service.convert(requestOf("e1", "v1")));
    expect(result.code).toBe("failed");
    expect(scratchDirs()).toBe(before);
  });
});

describe("quy ước repo — ĐÃ MOUNT có kiểm soát (binary ngoài, quyết định 19/10/2026)", () => {
  test("có gbh.row + giữ đường lùi + peers ⊆ peerDependencies + dependencies RỖNG", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: {
        row?: { id?: string; moduleIds?: string[]; aliases?: string[]; hostAliases?: string[]; tests?: string[] };
        peers?: string[];
        tests?: string[];
        draft?: string;
        row_unmounted_ly_do?: unknown;
      };
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
      exports: Record<string, unknown>;
    };
    // 20/10/2026 — MANIFEST ĐÃ FLIP (de-bundle + mount đợt này: package.json ghi 14:02, sau tệp test 09:52):
    //   gói khai gbh.row THẬT nên ca này đọc TRẠNG THÁI TỪ MANIFEST — đúng khuôn các gói host đã mount — thay vì
    //   khẳng định trạng thái PARK của task-165 (draft "BINARY NGOÀI" đã bị bỏ khỏi manifest).
    //   Đo lại 20/10/2026: `bun run check:rows` → 187 gói có gbh.row, TẤT CẢ ĐẠT (gồm gbh-office-to-pdf);
    //   binary LibreOffice vẫn nạp LƯỜI nên boot không cần nó — ca này KHÔNG phụ thuộc máy có LibreOffice.
    expect(json.gbh?.row).toEqual({
      id: "office-to-pdf",
      moduleIds: ["@galaxy-blackhole/gbh-office-to-pdf"],
      aliases: ["@deepseek-ai/dsh-office-to-pdf"],
      hostAliases: ["@deepseek-ai/dsh-office-to-pdf"],
      tests: ["tests/host/office-to-pdf.test.ts"],
    });
    // Đường "park" đi kèm row đã khai là SAI: row_unmounted_ly_do phải VẮNG (không khai hai trạng thái).
    expect(json.gbh?.row_unmounted_ly_do).toBeUndefined();
    // 20/10/2026 (Lead MOUNT THẬT): gói đã khai gbh.row ⇒ KHÔNG còn `gbh.draft` park, và peer
    // `libreoffice-kit` phải có MẶT trong node_modules của gói (symlink từ apps/host/node_modules).
    expect(json.gbh?.draft).toBeUndefined();
    expect(existsSync(join(PKG, "node_modules", "@deepseek-ai", "libreoffice-kit", "package.json"))).toBe(true);
    expect(json.gbh?.tests).toEqual(["tests/host/office-to-pdf.test.ts"]);
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    // 01/11/2026 — manifest đồng bộ lại theo stock: `cordis` trở thành peer thật của gói (plugin cordis
    // nên Service/Context kernel cấp), nên danh sách chọn lọc `gbh.peers` có thêm nó. Giữ nguyên tính chất
    // CHỌN LỌC: ⊆ peerDependencies (kiểm ngay dưới), không sinh máy móc từ peerDependencies.
    expect(declared).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-brand",
      "@deepseek-ai/dsh-typert-protocol",
      "@deepseek-ai/libreoffice-kit",
      "@deepseek-ai/schemastery",
    ]);
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
    // Đối chứng DƯƠNG: row gốc là TOP-LEVEL và ĐANG BẬT trong dump stock (nên thay row = đổi hành vi production).
    const dump = readFileSync(join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml"), "utf8");
    expect(dump.includes("- id: office-to-pdf")).toBe(true);
    expect(dump.includes("@deepseek-ai/dsh-office-to-pdf")).toBe(true);
    // Đối chứng DƯƠNG: kit THẬT SỰ spawn engine native (nên cần binary ngoài ⇒ nợ đã khai trong README).
    const kit = readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "libreoffice-kit", "lib", "cli.js"), "utf8");
    expect(kit.includes("spawnNative(")).toBe(true);
  });
});
