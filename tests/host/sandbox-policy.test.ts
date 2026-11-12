/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-sandbox-policy: đo trên ARTIFACT đã build,
 *      và so từng hành vi với CHÍNH bundle gốc của DSH (resolve · gộp chiếu · chữ ngữ cảnh · lỗi)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import Ours, { SANDBOX_MODES, SandboxPolicyService, setSandboxMode } from "../../packages/host/sandbox-policy/src/index.ts";
import { buildPackage } from "../../packages/host/sandbox-policy/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "sandbox-policy");
/** cordis của chính package ta (bản cài riêng — khác lớp Context với bản của apps/host). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sandbox-policy", "lib", "index.js");
/** cordis mà chính bundle gốc nạp — phải dùng đúng bản này mới dựng được service gốc. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Phiên giả tối thiểu: đúng hình dạng mà đường ghi và lượt giải cần. */
interface FakeSession {
  /** Định danh phiên. */
  readonly id: string;
  /** Siêu dữ liệu bất biến. */
  readonly header: { cwd?: string };
  /** Nhật ký các lời gọi append. */
  readonly log: [string, unknown][];
  /** Ghi một sự kiện. */
  append(type: string, data: unknown): void;
}

/** Chế độ ghi đè theo id phiên — nguồn của seam sessionProjections giả. */
const OVERRIDES = new Map<string, string | null>();

/**
 * Dựng một phiên giả.
 * Nhận: định danh và cwd tuỳ chọn.
 * Trả: phiên có nhật ký rỗng.
 */
function fakeSession(id: string, cwd?: string): FakeSession {
  const log: [string, unknown][] = [];
  return { id, header: cwd === undefined ? {} : { cwd }, log, append(type, data) { log.push([type, data]); } };
}

/** Vết những gì service đăng ký lên hai seam trong lượt dựng. */
interface SeamLog {
  /** Định nghĩa đơn vị chiếu đã đăng ký. */
  definitions: any[];
  /** Mục ngữ cảnh system prompt đã đăng ký. */
  contexts: any[];
  /** Tên mục đã hỏi thứ tự. */
  orderQueries: string[];
}

/**
 * Dựng một service trên Context cordis THẬT, với hai seam giả có ghi vết.
 * Nhận: lớp plugin, lớp Context của đúng bản cordis mà plugin nạp, và cấu hình.
 * Trả: Context, thực thể service, và vết đăng ký seam.
 */
async function boot(plugin: any, ContextCtor: any, config: Record<string, unknown>): Promise<{ svc: any; log: SeamLog }> {
  const ctx = new ContextCtor();
  const log: SeamLog = { definitions: [], contexts: [], orderQueries: [] };
  ctx.provide("sessionProjections", {
    register: (definition: any) => { log.definitions.push(definition); return () => {}; },
    stateOf: (session: FakeSession) => OVERRIDES.get(session.id),
  });
  ctx.provide("systemPrompt", {
    getContextOrder: (name: string) => { log.orderQueries.push(name); return 110; },
    context: (context: any) => { log.contexts.push(context); return () => {}; },
  });
  ctx.plugin(plugin, config);
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { svc: ctx.get("sandboxPolicy"), log };
}

/**
 * Dựng CẢ HAI bản (ta và gốc) với cùng cấu hình.
 * Nhận: cấu hình truyền cho cả hai.
 * Trả: hai thực thể kèm vết seam của chúng.
 */
async function bootBoth(config: Record<string, unknown>): Promise<{ ours: any; theirs: any; ourLog: SeamLog; theirLog: SeamLog }> {
  const ourCordis: any = await import(OUR_CORDIS);
  const stockCordis: any = await import(STOCK_CORDIS);
  const stockMod: any = await import(STOCK);
  const ours = await boot(Ours, ourCordis.Context, config);
  const theirs = await boot(stockMod.default, stockCordis.Context, config);
  return { ours: ours.svc, theirs: theirs.svc, ourLog: ours.log, theirLog: theirs.log };
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row sandbox-policy — artifact và bề mặt", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, và 0 id @deepseek-ai", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact: any = await import(file);
    const stock: any = await import(STOCK);
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["SANDBOX_MODES", "SandboxPolicyService", "default", "setSandboxMode"]);
    // Artifact là MỘT bản cài khác nên lớp khác đối tượng; điều phải khớp là HÌNH DẠNG và quan hệ default.
    expect(artifact.default).toBe(artifact.SandboxPolicyService);
    expect(stock.default).toBe(stock.SandboxPolicyService);
    expect(stock.default.name).toBe(SandboxPolicyService.name);
    expect(Object.getOwnPropertyNames(SandboxPolicyService.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxPolicyService.prototype).sort(),
    );
    expect([...artifact.SANDBOX_MODES]).toEqual([...stock.SANDBOX_MODES]);
  });
});

describe("row sandbox-policy — hành vi đối chứng với chính bundle gốc", () => {
  test("resolve(): chế độ và gốc workspace Y HỆT gốc trên cả 5 tổ hợp đầu vào", async () => {
    OVERRIDES.set("s1", "workspace-write");
    const s1 = fakeSession("s1", "/tmp/sess");
    const s2 = fakeSession("s2");
    const { ours, theirs } = await bootBoth({ workspaceRoot: "/tmp/fallback" });
    const cases: any[] = [{}, { mode: "danger-full-access" }, { session: s1 }, { session: s2 }, { session: s1, mode: "read-only" }];
    for (const request of cases) {
      expect(JSON.stringify(ours.resolve(request))).toBe(JSON.stringify(theirs.resolve(request)));
    }
    expect(ours.resolve({ session: s1 })).toEqual({ mode: "workspace-write", workspaceRoot: "/tmp/sess", sessionId: "s1" });
    expect(ours.resolve()).toEqual({ mode: "read-only", workspaceRoot: "/tmp/fallback" });
    expect(ours.resolve({ mode: "danger-full-access" }).sessionId).toBeUndefined();
    expect(ours.overrideOf(s1)).toBe("workspace-write");
    expect(ours.overrideOf(s2)).toBeUndefined();
  });

  test("schema Config: mặc định read-only + từ chối gốc tương đối như gốc", async () => {
    const { ours, theirs } = await bootBoth({});
    expect(ours.defaultMode).toBe("read-only");
    expect(ours.defaultMode).toBe(theirs.defaultMode);
    expect(ours.workspaceRoot).toBe(theirs.workspaceRoot);
    const ourCordis: any = await import(OUR_CORDIS);
    const stockCordis: any = await import(STOCK_CORDIS);
    const stockMod: any = await import(STOCK);
    const messageOf = (build: () => unknown): string => {
      try {
        build();
        return "(khong nem)";
      } catch (error) {
        return (error as Error).message;
      }
    };
    // Dựng TRỰC TIẾP lớp service: qua `ctx.plugin` thì lỗi nằm trong fiber nên không ném ra ngoài.
    const oursMessage = messageOf(() => new Ours(new ourCordis.Context(), { workspaceRoot: "relative/path" }));
    const stockMessage = messageOf(() => new stockMod.default(new stockCordis.Context(), { workspaceRoot: "relative/path" }));
    expect(oursMessage).toBe(stockMessage);
    expect(oursMessage).toContain("must be an absolute execution-world path");
    // Đường lỗi thứ hai: cwd TƯƠNG ĐỐI của phiên cũng bị chặn, không treo.
    const { ours: live } = await bootBoth({ workspaceRoot: "/tmp/fallback" });
    expect(() => live.resolve({ session: fakeSession("s9", "relative/cwd") })).toThrow("must be an absolute execution-world path");
  });

  test("đường ghi + gộp chiếu: một sự kiện, cùng khoá/phiên bản/init/apply như gốc", async () => {
    const { ours, theirs, ourLog, theirLog } = await bootBoth({ workspaceRoot: "/tmp/fallback" });
    const ourSession = fakeSession("w1");
    const theirSession = fakeSession("w1");
    setSandboxMode(ourSession, "danger-full-access");
    const stockMod: any = await import(STOCK);
    stockMod.setSandboxMode(theirSession, "danger-full-access");
    expect(JSON.stringify(ourSession.log)).toBe(JSON.stringify(theirSession.log));
    expect(ourSession.log.length).toBe(1);
    expect(ourSession.log[0]![0]).toBe("sandbox/mode");
    expect([...SANDBOX_MODES]).toEqual([...stockMod.SANDBOX_MODES]);
    const shape = (log: SeamLog): string => JSON.stringify({
      key: log.definitions[0].key,
      stateVersion: log.definitions[0].stateVersion,
      init: log.definitions[0].init(),
      folded: log.definitions[0].apply(null, { type: "sandbox/mode", data: { mode: "read-only" } }),
      ignored: log.definitions[0].apply("read-only", { type: "other/event", data: {} }),
    });
    expect(shape(ourLog)).toBe(shape(theirLog));
    expect(ourLog.definitions.length).toBe(1);
    expect(ourLog.definitions[0].key).toBe("sandboxMode");
    expect(ourLog.definitions[0].stateVersion).toBe(1);
    // Validator trạng thái đã lưu: nhận đúng ba chế độ + null, ném khi khác (không treo).
    for (const mode of SANDBOX_MODES) expect(ourLog.definitions[0].stateSchema.parse(mode)).toBe(mode);
    expect(ourLog.definitions[0].stateSchema.parse(null)).toBeNull();
    expect(() => ourLog.definitions[0].stateSchema.parse("bogus")).toThrow();
    expect(() => theirLog.definitions[0].stateSchema.parse("bogus")).toThrow();
  });

  test("ngữ cảnh system prompt: một mục sandbox:policy, chữ KHỚP gốc cho cả ba chế độ", async () => {
    OVERRIDES.set("ro", "read-only");
    OVERRIDES.set("ww", "workspace-write");
    OVERRIDES.set("dfa", "danger-full-access");
    const { ours, theirs, ourLog, theirLog } = await bootBoth({ workspaceRoot: "/tmp/fallback" });
    expect(ourLog.contexts.length).toBe(1);
    expect(theirLog.contexts.length).toBe(1);
    expect(ourLog.orderQueries).toEqual(["SANDBOX_POLICY"]);
    expect(ourLog.contexts[0].name).toBe(theirLog.contexts[0].name);
    expect(ourLog.contexts[0].name).toBe("sandbox:policy");
    expect(ourLog.contexts[0].order).toBe(theirLog.contexts[0].order);
    expect(ours.resolve).toBeDefined();
    for (const id of ["ro", "ww", "dfa"]) {
      const text = ourLog.contexts[0].text({ agent: { session: fakeSession(id, "/tmp/ws") } });
      const stockText = theirLog.contexts[0].text({ agent: { session: fakeSession(id, "/tmp/ws") } });
      // 08/11/2026 (R4 + task-17/N2): chuỗi ngữ cảnh HIỂN THỊ cho model đã đổi nhãn "DSH" → "Galaxy Blackhole".
      // Phép so A/B vẫn NGUYÊN VĂN sau khi chuẩn hoá ĐÚNG nhãn thương hiệu — mọi khác biệt khác vẫn lộ từng byte.
      expect(text.replaceAll("Galaxy Blackhole", "DSH")).toBe(stockText);
    }
    expect(ourLog.contexts[0].text({})).toBe("");
    expect(theirLog.contexts[0].text({})).toBe("");
    expect(ourLog.contexts[0].text({ agent: { session: fakeSession("ww", "/tmp/ws") } })).toContain("/tmp/ws");
    expect(theirs.defaultMode).toBe("read-only");
  });
});
