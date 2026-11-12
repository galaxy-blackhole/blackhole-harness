/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-deepseek-llm-api-extensions: đo trên ARTIFACT đã build,
 *      và so TỪNG hành vi của sổ đăng ký với CHÍNH bundle gốc của DSH trên Context cordis THẬT.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/deepseek-llm-api-extensions/build.ts";
import OursRegistry from "../../packages/host/deepseek-llm-api-extensions/src/index.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Thư mục package của ta. */
const PKG = join(ROOT, "packages", "host", "deepseek-llm-api-extensions");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");
/** Gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-deepseek-llm-api-extensions");
/** Entry đã build của gói gốc. */
const STOCK_ENTRY = join(STOCK_DIR, "lib", "index.js");
/** cordis mà cả hai bản nài nạp (peer do kernel cấp — MỘT thể hiện). */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Cặp lớp Context + bundle gốc, nạp MỘT lần cho cả tệp test. */
const { Context } = (await import(CORDIS)) as any;
const stockModule = (await import(STOCK_ENTRY)) as any;

/** Một giàn thử: Context cordis THẬT + thực thể sổ đăng ký + vết cảnh báo. */
interface Harness {
  /** Context cordis sở hữu vòng đời đăng ký. */
  ctx: any;
  /** Thực thể sổ đăng ký vừa cấp. */
  svc: any;
  /** Tham số của mọi lời gọi `ctx.logger.warn`. */
  warns: unknown[][];
}

/**
 * Dựng một sổ đăng ký trên Context cordis THẬT, có ghi vết cảnh báo.
 * Nhận: lớp cần dựng (của ta hoặc của gói gốc).
 * Trả: Context, thực thể, và vết cảnh báo.
 */
function boot(Registry: any): Harness {
  const ctx = new Context();
  const warns: unknown[][] = [];
  ctx.logger = {
    warn: (...args: unknown[]) => {
      warns.push(args);
    },
    info: () => {},
    error: () => {},
  };
  const svc = new Registry(ctx);
  return { ctx, svc, warns };
}

/**
 * Gọi `register` với tên trường dạng chuỗi (bảng trường của bản gốc rỗng ⇒ `keyof` = never).
 * Nhận: thực thể sổ đăng ký, tên trường, nhà cung cấp.
 * Trả: hàm dọn do `ctx.effect` cấp.
 */
function registerField(svc: any, field: string, provider: unknown): () => Promise<void> {
  return svc.register(field, provider);
}

/**
 * Dựng sự thật request giống hình dạng adapter LLM DeepSeek gửi.
 * Nhận: các trường ghi đè tuỳ chọn.
 * Trả: object request có `signal` còn sống.
 */
function request(overrides: Record<string, unknown> = {}): any {
  return {
    body: { model: "deepseek-chat", messages: [{ role: "user", content: "xin chao" }] },
    sessionId: "session-1",
    purpose: "compaction",
    signal: new AbortController().signal,
    ...overrides,
  };
}

/**
 * Dựng nhà cung cấp trường giống hình dạng hai gói đóng góp THẬT của DSH.
 * Nhận: giá trị trả về của `prepare` (hoặc hàm sinh giá trị), và nhật ký chốt.
 * Trả: nhà cung cấp có ghi vết lời gọi.
 */
function contributor(value: unknown, commits: string[] = []): any {
  return {
    prepare() {
      if (typeof value === "function") return (value as () => unknown)();
      return value;
    },
    commits,
  };
}

describe("hành vi chính — A/B với chính bundle gốc trên Context cordis THẬT", () => {
  test("cấp service, đăng ký hai trường, prepare + accept khớp từng bước", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    for (const side of [ours, theirs]) {
      expect(side.svc.name).toBe("deepseekLlmApiExtensions");
      expect(typeof side.ctx.get("deepseekLlmApiExtensions")).toBe("object");
      // cordis bọc service khi cấp lên context — CẢ HAI bên phải cùng hình dạng quan hệ này.
      expect(side.ctx.get("deepseekLlmApiExtensions") === side.svc).toBe(false);
    }
    const oursCommits: string[] = [];
    const theirCommits: string[] = [];
    registerField(ours.svc, "dsh_session_log", {
      prepare: () => ({ value: { version: 1, afterSeq: 3 }, accept: () => void oursCommits.push("s") }),
    });
    registerField(theirs.svc, "dsh_session_log", {
      prepare: () => ({ value: { version: 1, afterSeq: 3 }, accept: () => void theirCommits.push("s") }),
    });
    registerField(ours.svc, "dsh_plugin_packages", {
      prepare: () => ({ value: [{ name: "a" }, { name: "b" }] }),
    });
    registerField(theirs.svc, "dsh_plugin_packages", {
      prepare: () => ({ value: [{ name: "a" }, { name: "b" }] }),
    });
    const oursPrepared = await ours.svc.prepare(request());
    const theirPrepared = await theirs.svc.prepare(request());
    expect(oursPrepared.fields).toEqual(theirPrepared.fields);
    expect(Object.keys(oursPrepared.fields)).toEqual(["dsh_session_log", "dsh_plugin_packages"]);
    // `fields` là object KHÔNG prototype ở cả hai bên (bản gốc dùng Object.create(null)).
    expect(Object.getPrototypeOf(oursPrepared.fields)).toBe(null);
    expect(Object.getPrototypeOf(theirPrepared.fields)).toBe(null);
    expect(Object.isFrozen(oursPrepared.fields)).toBe(Object.isFrozen(theirPrepared.fields));
    expect(Object.isFrozen(oursPrepared.fields)).toBe(true);
    // `accept()` chỉ chốt nhà cung cấp CÓ `accept`, và gọi lặp lại KHÔNG chốt lại.
    await oursPrepared.accept();
    await oursPrepared.accept();
    await theirPrepared.accept();
    await theirPrepared.accept();
    expect(oursCommits).toEqual(theirCommits);
    expect(oursCommits).toEqual(["s"]);
  });

  test("hợp đồng liên gói: adapter gộp fields vào thân request như dsh-llm-deepseek", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    for (const side of [ours, theirs]) {
      registerField(side.svc, "dsh_session_log", {
        prepare: (req: any) => (req.sessionId === undefined ? undefined : { value: { afterSeq: 7 } }),
      });
    }
    const oursBase = { model: "deepseek-chat", messages: [] };
    const theirBase = { model: "deepseek-chat", messages: [] };
    const oursMerged = { ...oursBase, ...(await ours.svc.prepare(request({ body: oursBase }))).fields };
    const theirMerged = { ...theirBase, ...(await theirs.svc.prepare(request({ body: theirBase }))).fields };
    expect(oursMerged).toEqual(theirMerged);
    expect(oursMerged).toEqual({ model: "deepseek-chat", messages: [], dsh_session_log: { afterSeq: 7 } });
    // Không có sessionId ⇒ nhà cung cấp trả undefined ⇒ trường BỊ BỎ (không phải null).
    const oursNoSession = await ours.svc.prepare(request({ sessionId: undefined }));
    const theirNoSession = await theirs.svc.prepare(request({ sessionId: undefined }));
    expect(oursNoSession.fields).toEqual(theirNoSession.fields);
    expect(Object.keys(oursNoSession.fields)).toEqual([]);
  });

  test("thứ tự giữ nguyên thứ tự ĐĂNG KÝ (Map chèn cuối)", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    for (const field of ["zeta", "alpha", "middle"]) {
      registerField(ours.svc, field, contributor({ value: field }));
      registerField(theirs.svc, field, contributor({ value: field }));
    }
    const oursKeys = Object.keys((await ours.svc.prepare(request())).fields);
    const theirKeys = Object.keys((await theirs.svc.prepare(request())).fields);
    expect(oursKeys).toEqual(theirKeys);
    expect(oursKeys).toEqual(["zeta", "alpha", "middle"]);
  });
});

describe("nhân bản + đóng băng — ca 'byte' của gói KHÔNG phục vụ route", () => {
  test("giá trị được structuredClone rồi ĐÓNG BĂNG mọi tầng ở cả hai bên", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    const oursSource = { nested: { list: [1, { deep: true }] }, text: "x" };
    const theirSource = { nested: { list: [1, { deep: true }] }, text: "x" };
    registerField(ours.svc, "ext", { prepare: () => ({ value: oursSource }) });
    registerField(theirs.svc, "ext", { prepare: () => ({ value: theirSource }) });
    const oursFields = (await ours.svc.prepare(request())).fields;
    const theirFields = (await theirs.svc.prepare(request())).fields;
    expect(oursFields).toEqual(theirFields);
    // Nhà cung cấp KHÔNG còn đường sửa giá trị đã gửi đi.
    oursSource.text = "bi sua";
    theirSource.text = "bi sua";
    expect(oursFields.ext).toEqual(theirFields.ext);
    expect(oursFields.ext.text).toBe("x");
    const oursFrozen = [oursFields.ext, oursFields.ext.nested, oursFields.ext.nested.list, oursFields.ext.nested.list[1]];
    const theirFrozen = [theirFields.ext, theirFields.ext.nested, theirFields.ext.nested.list, theirFields.ext.nested.list[1]];
    expect(oursFrozen.map((v) => Object.isFrozen(v))).toEqual(theirFrozen.map((v) => Object.isFrozen(v)));
    expect(oursFrozen.every((v) => Object.isFrozen(v))).toBe(true);
    // structuredClone ⇒ giá trị trong fields là ĐỐI TƯỢNG KHÁC nguồn (cả hai bên).
    expect(oursFields.ext === oursSource).toBe(theirFields.ext === theirSource);
    expect(oursFields.ext === oursSource).toBe(false);
  });
});

describe("đường lỗi — cùng mã, cùng chuỗi, không treo", () => {
  test("tên trường rỗng / có khoảng trắng ⇒ cùng thông điệp", () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    for (const bad of ["", " x", "x ", "  "]) {
      const oursError = (() => {
        try {
          registerField(ours.svc, bad, contributor({ value: 1 }));
          return "khong-nem";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      const theirError = (() => {
        try {
          registerField(theirs.svc, bad, contributor({ value: 1 }));
          return "khong-nem";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      expect(oursError).toBe(theirError);
      expect(oursError).toBe("deepseek-llm-api-extensions: field must be a non-blank trimmed string");
    }
  });

  test("đăng ký TRÙNG một trường ⇒ cùng thông điệp, và trường cũ vẫn sống", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    registerField(ours.svc, "dup", contributor({ value: 1 }));
    registerField(theirs.svc, "dup", contributor({ value: 1 }));
    const capture = (side: Harness): string => {
      try {
        registerField(side.svc, "dup", contributor({ value: 2 }));
        return "khong-nem";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(capture(ours)).toBe(capture(theirs));
    expect(capture(ours)).toBe('deepseek-llm-api-extensions: field "dup" is already registered');
    expect((await ours.svc.prepare(request())).fields).toEqual((await theirs.svc.prepare(request())).fields);
    expect((await ours.svc.prepare(request())).fields.dup).toBe(1);
  });

  test("nhà cung cấp NÉM ⇒ trường bị bỏ, CẢNH BÁO đúng một lần (%o + lý do)", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    const oursBoom = new Error("no-serializer");
    const theirBoom = new Error("no-serializer");
    registerField(ours.svc, "boom", { prepare: () => { throw oursBoom; } });
    registerField(theirs.svc, "boom", { prepare: () => { throw theirBoom; } });
    registerField(ours.svc, "ok", contributor({ value: "giu" }));
    registerField(theirs.svc, "ok", contributor({ value: "giu" }));
    expect((await ours.svc.prepare(request())).fields).toEqual((await theirs.svc.prepare(request())).fields);
    expect((await ours.svc.prepare(request())).fields).toEqual({ ok: "giu" });
    await ours.svc.prepare(request());
    await theirs.svc.prepare(request());
    expect(ours.warns.length).toBe(theirs.warns.length);
    expect(ours.warns.length).toBe(1);
    expect(String(ours.warns[0]?.[0])).toBe(String(theirs.warns[0]?.[0]));
    expect(String(ours.warns[0]?.[0])).toContain("deepseek-llm-api-extensions: omitting field \"boom\"");
    expect(String(ours.warns[0]?.[0])).toContain("%o");
    expect(ours.warns[0]?.[1]).toBe(oursBoom);
    expect(theirs.warns[0]?.[1]).toBe(theirBoom);
  });

  test("giá trị KHÔNG nhân bản được ⇒ trường bị bỏ + cảnh báo (cả hai bên)", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    registerField(ours.svc, "fn", { prepare: () => ({ value: { callback: () => 1 } }) });
    registerField(theirs.svc, "fn", { prepare: () => ({ value: { callback: () => 1 } }) });
    const oursFields = (await ours.svc.prepare(request())).fields;
    const theirFields = (await theirs.svc.prepare(request())).fields;
    expect(Object.keys(oursFields)).toEqual(Object.keys(theirFields));
    expect(Object.keys(oursFields)).toEqual([]);
    expect(ours.warns.length).toBe(theirs.warns.length);
    expect(ours.warns.length).toBe(1);
  });

  test("tín hiệu ĐÃ huỷ trước khi gọi ⇒ ném NGAY, nhà cung cấp KHÔNG được gọi", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    const oursCalls: string[] = [];
    const theirCalls: string[] = [];
    registerField(ours.svc, "x", { prepare: () => void oursCalls.push("go") });
    registerField(theirs.svc, "x", { prepare: () => void theirCalls.push("go") });
    const ac = new AbortController();
    ac.abort(new Error("huy-truoc"));
    await expect(ours.svc.prepare(request({ signal: ac.signal }))).rejects.toThrow("huy-truoc");
    await expect(theirs.svc.prepare(request({ signal: ac.signal }))).rejects.toThrow("huy-truoc");
    expect(oursCalls).toEqual(theirCalls);
    expect(oursCalls).toEqual([]);
  });

  test("huỷ GIỮA lúc chờ ⇒ ném lý do huỷ, không treo", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    registerField(ours.svc, "slow", { prepare: () => new Promise(() => {}) });
    registerField(theirs.svc, "slow", { prepare: () => new Promise(() => {}) });
    const ac = new AbortController();
    // Gắn người xử lý NGAY để cửa sổ "chưa ai await" không sinh unhandled rejection trước lúc huỷ.
    const settle = (pending: Promise<unknown>): Promise<unknown> => pending.then(() => "xong", (error: unknown) => error);
    const oursPending = settle(ours.svc.prepare(request({ signal: ac.signal })));
    const theirPending = settle(theirs.svc.prepare(request({ signal: ac.signal })));
    await new Promise((resolve) => setTimeout(resolve, 5));
    ac.abort(new Error("huy-giua-duong"));
    const oursOutcome = (await oursPending) as Error;
    const theirOutcome = (await theirPending) as Error;
    expect(oursOutcome.message).toBe("huy-giua-duong");
    expect(theirOutcome.message).toBe("huy-giua-duong");
    expect(oursOutcome.constructor.name).toBe(theirOutcome.constructor.name);
  });

  test("accept: 1 lỗi ⇒ ném ĐÚNG lý do đó; 2 lỗi ⇒ AggregateError cùng thông điệp", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    const oursSingle = new Error("commit-hong");
    const theirSingle = new Error("commit-hong");
    registerField(ours.svc, "a", { prepare: () => ({ value: 1, accept: () => Promise.reject(oursSingle) }) });
    registerField(theirs.svc, "a", { prepare: () => ({ value: 1, accept: () => Promise.reject(theirSingle) }) });
    const oursError = await ours.svc.prepare(request()).then((p: any) => p.accept()).catch((error: unknown) => error);
    const theirError = await theirs.svc.prepare(request()).then((p: any) => p.accept()).catch((error: unknown) => error);
    expect(oursError).toBe(oursSingle as any);
    expect(theirError).toBe(theirSingle as any);

    const ours2 = boot(OursRegistry);
    const theirs2 = boot(stockModule.default);
    const failures = () => [new Error("mot"), new Error("hai")];
    const oursFailures = failures();
    const theirFailures = failures();
    registerField(ours2.svc, "a", { prepare: () => ({ value: 1, accept: () => Promise.reject(oursFailures[0]) }) });
    registerField(ours2.svc, "b", { prepare: () => ({ value: 2, accept: () => Promise.reject(oursFailures[1]) }) });
    registerField(theirs2.svc, "a", { prepare: () => ({ value: 1, accept: () => Promise.reject(theirFailures[0]) }) });
    registerField(theirs2.svc, "b", { prepare: () => ({ value: 2, accept: () => Promise.reject(theirFailures[1]) }) });
    const oursAggregate = (await ours2.svc.prepare(request()).then((p: any) => p.accept()).catch((error: unknown) => error)) as AggregateError;
    const theirAggregate = (await theirs2.svc.prepare(request()).then((p: any) => p.accept()).catch((error: unknown) => error)) as AggregateError;
    expect(oursAggregate.constructor.name).toBe(theirAggregate.constructor.name);
    expect(oursAggregate.constructor.name).toBe("AggregateError");
    expect(oursAggregate.message).toBe(theirAggregate.message);
    expect(oursAggregate.message).toBe("DeepSeek LLM API extension acceptance failed");
    expect(oursAggregate.errors.map((e) => (e as Error).message)).toEqual(
      theirAggregate.errors.map((e) => (e as Error).message),
    );
    expect(oursAggregate.errors.map((e) => (e as Error).message)).toEqual(["mot", "hai"]);
  });
});

describe("vòng đời — hàm dọn của ctx.effect", () => {
  test("dọn MỘT trường không đụng trường khác (cả hai bên)", async () => {
    const ours = boot(OursRegistry);
    const theirs = boot(stockModule.default);
    const oursDispose = registerField(ours.svc, "a", contributor({ value: 1 }));
    registerField(ours.svc, "b", contributor({ value: 2 }));
    const theirDispose = registerField(theirs.svc, "a", contributor({ value: 1 }));
    registerField(theirs.svc, "b", contributor({ value: 2 }));
    expect(typeof oursDispose).toBe(typeof theirDispose);
    await oursDispose();
    await theirDispose();
    const oursFields = (await ours.svc.prepare(request())).fields;
    const theirFields = (await theirs.svc.prepare(request())).fields;
    expect(oursFields).toEqual(theirFields);
    expect(oursFields).toEqual({ b: 2 });
    // Gỡ rồi thì đăng ký lại được — phạm vi effect đã nhả tên trường.
    registerField(ours.svc, "a", contributor({ value: 3 }));
    registerField(theirs.svc, "a", contributor({ value: 3 }));
    expect((await ours.svc.prepare(request())).fields).toEqual((await theirs.svc.prepare(request())).fields);
  });
});

describe("ARTIFACT — tập export và khuôn bundle", () => {
  /** Đường dẫn artifact của ta sau lần build dùng chung. */
  let built: string | undefined;

  /**
   * Build gói của ta ra thư mục tạm rồi trả đường dẫn artifact (build MỘT lần cho cả khối).
   * Nhận: không.
   * Trả: đường dẫn `lib/index.js` đã build.
   */
  async function artifact(): Promise<string> {
    if (built !== undefined) return built;
    built = await buildPackage(OUT);
    // LƯỢT ĐO 01/11/2026: peer của artifact phải phân giải về KERNEL — `PKG/node_modules` là bản SAO
    // workspace (MÔ-ĐUN khác) nên `DeepSeekLlmApiExtensionRegistry extends Service` lệch danh tính lớp.
    mkdirSync(join(OUT, "node_modules"), { recursive: true });
    symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir");
    // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
    // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
    symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
    return built;
  }

  afterAll(async () => {
    await rm(OUT, { recursive: true, force: true });
  });

  test("tập export của ta BẰNG ĐÚNG tập export của bundle gốc, đo trên ARTIFACT", async () => {
    const ours = (await import(await artifact())) as any;
    const ourNames = Object.keys(ours).sort();
    const theirNames = Object.keys(stockModule).sort();
    expect(ourNames).toEqual(theirNames);
    expect(ourNames).toEqual(["DeepSeekLlmApiExtensionRegistry", "default"]);
    // `default` là CHÍNH lớp đó (bản gốc cũng vậy) — không phải object plugin khác.
    expect(ours.default).toBe(ours.DeepSeekLlmApiExtensionRegistry);
    expect(stockModule.default).toBe(stockModule.DeepSeekLlmApiExtensionRegistry);
    // LỚP CHA phải là CÙNG một lớp `Service` của kernel (không phải bản sao).
    expect(Object.getPrototypeOf(ours.DeepSeekLlmApiExtensionRegistry)).toBe(
      Object.getPrototypeOf(stockModule.DeepSeekLlmApiExtensionRegistry),
    );
    // Prototype công khai: đúng hai phương thức như gốc.
    const ourProto = Object.getOwnPropertyNames(ours.DeepSeekLlmApiExtensionRegistry.prototype).sort();
    const theirProto = Object.getOwnPropertyNames(stockModule.DeepSeekLlmApiExtensionRegistry.prototype).sort();
    expect(ourProto).toEqual(theirProto);
    expect(ourProto).toEqual(["constructor", "prepare", "register"]);
  });

  test("artifact KHÔNG đăng ký id module nào của gói gốc", async () => {
    const text = await readFile(await artifact(), "utf8");
    expect(text.match(/id: @deepseek-ai/g) ?? []).toHaveLength(0);
    expect(text.match(/__ModuleLoader__/g) ?? []).toHaveLength(0);
    // Không có cú pháp ESM lạ nào ngoài `export { … }` của ESM host (row host-only).
    expect(text).toContain("export {");
  });

  
  test("locale chép byte-for-byte so với bản gốc (luật 000e)", async () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(PKG, "locale", name));
      const theirs = await readFile(join(STOCK_DIR, "locale", name));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});

describe("gbh.peers ⊆ peerDependencies — so PHẦN TỬ, có ĐỐI CHỨNG ÂM", () => {
  /**
   * Tìm các peer được khai để inject mà KHÔNG được khai để kernel cấp.
   * Nhận: danh sách `gbh.peers` và khoá của `peerDependencies`.
   * Trả: các tên thiếu (rỗng = đạt).
   */
  function missingPeers(peers: readonly string[], peerDependencies: readonly string[]): string[] {
    const provided = new Set(peerDependencies);
    return peers.filter((peer) => !provided.has(peer));
  }

  test("gói thật: hiệu RỖNG (không phải phép so số lượng)", async () => {
    const json = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as {
      gbh?: { peers?: string[] };
      peerDependencies?: Record<string, string>;
    };
    const peers = json.gbh?.peers ?? [];
    const deps = Object.keys(json.peerDependencies ?? {});
    expect(missingPeers(peers, deps)).toEqual([]);
    expect(peers.length).toBe(1);
    // Bản gốc cũng chỉ khai ĐÚNG peer này — hợp đồng một-thể-hiện của kernel.
    const stockJson = JSON.parse(await readFile(join(STOCK_DIR, "package.json"), "utf8")) as {
      peerDependencies?: Record<string, string>;
    };
    expect(Object.keys(stockJson.peerDependencies ?? {})).toEqual(Object.keys(json.peerDependencies ?? {}));
  });

  test("ĐỐI CHỨNG ÂM: phép kiểm PHẢI bắt được tên thiếu", () => {
    expect(missingPeers(["@deepseek-ai/cordis"], ["@deepseek-ai/cordis"])).toEqual([]);
    expect(missingPeers(["@deepseek-ai/cordis"], [])).toEqual(["@deepseek-ai/cordis"]);
    expect(missingPeers(["a", "z"], ["a", "b"])).toEqual(["z"]);
    // Hai danh sách CÙNG ĐỘ DÀI nhưng khác phần tử ⇒ vẫn phải bắt (bẫy 'so số lượng' đã cắn thật).
    expect(missingPeers(["a", "b"], ["a", "c"])).toEqual(["b"]);
    // Nhiều peer hơn peerDependencies ⇒ bắt đủ.
    expect(missingPeers(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });
});

describe("C6 — vật thể cấu hình ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai thực thể có sổ providers/warnedFields RIÊNG; sửa vật này KHÔNG lan sang vật kia", async () => {
    const first = boot(OursRegistry);
    const second = boot(OursRegistry);
    const firstStock = boot(stockModule.default);
    const secondStock = boot(stockModule.default);
    for (const side of [first, second, firstStock, secondStock]) {
      expect(side.svc.providers).toBeDefined();
      expect(side.svc.warnedFields).toBeDefined();
    }
    // DANH TÍNH — phép so sâu (toEqual) KHÔNG bắt được lớp lỗi chia sẻ tham chiếu.
    expect(first.svc.providers === second.svc.providers).toBe(firstStock.svc.providers === secondStock.svc.providers);
    expect(first.svc.providers === second.svc.providers).toBe(false);
    expect(first.svc.warnedFields === second.svc.warnedFields).toBe(firstStock.svc.warnedFields === secondStock.svc.warnedFields);
    expect(first.svc.warnedFields === second.svc.warnedFields).toBe(false);
    // Cùng một tên trường ở HAI thực thể là hai đăng ký độc lập (không ném trùng).
    registerField(first.svc, "shared", contributor({ value: "mot" }));
    registerField(second.svc, "shared", contributor({ value: "hai" }));
    expect((await first.svc.prepare(request())).fields).toEqual({ shared: "mot" });
    expect((await second.svc.prepare(request())).fields).toEqual({ shared: "hai" });
    // `fields` của hai lần prepare là hai object KHÁC NHAU (không dùng lại vật thể).
    const firstFields = (await first.svc.prepare(request())).fields;
    const again = (await first.svc.prepare(request())).fields;
    expect(firstFields === again).toBe(false);
    // Trạng thái cảnh báo KHÔNG rò: trường hỏng ở thực thể MỘT vẫn cảnh báo ở thực thể HAI.
    for (const side of [first, second]) {
      registerField(side.svc, "boom", { prepare: () => { throw new Error("hong"); } });
    }
    await first.svc.prepare(request());
    await second.svc.prepare(request());
    expect(first.warns.length).toBe(1);
    expect(second.warns.length).toBe(1);
  });
});
