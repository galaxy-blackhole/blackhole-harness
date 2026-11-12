/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chiếu cho @galaxy-blackhole/gbh-commands: đo trên ARTIFACT đã build, rồi so TỪNG
 *      hành vi với CHÍNH bundle gốc của DSH (phân tích dòng lệnh · đăng ký/che phạm vi · vòng đời
 *      command/run–command/done · đường lỗi · tệp đính kèm) trên Context cordis THẬT của hai bản cài.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCommand } from "../../packages/host/commands/src/index.ts";
import { buildPackage } from "../../packages/host/commands/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "commands");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-commands", "lib", "index.js");
/** Package gốc trên đĩa (đọc package.json + locale). */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-commands");
/** cordis mà CẢ HAI bản nạp — dùng đúng một bản để hai bên sống trong cùng thế giới. */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** dsh-typert-protocol mà CẢ HAI bản nạp — dùng đúng một bản để marker `@Remote` là CÙNG một ký hiệu. */
const PROTOCOL = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");
/** Thư mục build: ĐÚNG thư mục `lib` mà tầng mount dùng, để phép đo chạy trên artifact thật. */
const OUT = join(PKG, "lib");

// ĐO TRÊN ARTIFACT dựng ở thư mục tạm có symlink @deepseek-ai của KERNEL (pattern tests/host/shell.test.ts):
// gói đánh dấu phạm vi bằng Symbol của `@deepseek-ai/dsh-scope`. Nạp từ src/ thì Symbol là bản .bun của
// workspace — kernel tạo scope bằng Symbol CỦA NÓ nên lớp theo phạm vi không được nhận ra (ca "lớp theo
// PHẠM VI che lớp toàn cục" ném trùng tên oan). build.ts xoá sạch outDir nên symlink dựng SAU khi build.
const SURFACE_DIR = mkdtempSync(join(tmpdir(), "gbh-commands-"));
const SURFACE_FILE = await buildPackage(join(SURFACE_DIR, "lib"));
mkdirSync(join(SURFACE_DIR, "node_modules"), { recursive: true });
symlinkSync(
  join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"),
  join(SURFACE_DIR, "node_modules", "@deepseek-ai"),
  "dir",
);
/** Plugin của ta, nạp từ artefact có peer kernel. */
const Ours = ((await import(SURFACE_FILE)) as { default: unknown }).default;

/** Dọn thư mục dựng tạm của artefact. Nhận: không. Trả: không. */
afterAll(() => {
  rmSync(SURFACE_DIR, { recursive: true, force: true });
});

/** Trần thời gian của MỌI lượt chờ trong file này (ms) — không có chờ vô hạn. */
const WAIT_CAP_MS = 2_000;

/**
 * Chờ có TRẦN tới khi `read()` trả giá trị khác undefined.
 * Nhận: hàm đọc, nhãn chẩn đoán, và trần thời gian.
 * Trả: giá trị đầu tiên khác undefined; ném lỗi khi quá trần (không treo test).
 */
async function waitFor<T>(read: () => T | undefined, label: string, timeoutMs = WAIT_CAP_MS): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) throw new Error(`waitFor("${label}") qua ${timeoutMs}ms — khong thay gia tri`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Chuỗi hoá TẤT ĐỊNH — giữ cả khoá có giá trị undefined (JSON.stringify nuốt chúng). */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (item === undefined ? "<undefined>" : item));
}

/**
 * Đọc thông điệp lỗi của một thao tác đồng bộ/bất đồng bộ mà KHÔNG làm test nổ.
 * Nhận: hàm cần chạy.
 * Trả: thông điệp lỗi, hoặc chuỗi "(khong nem)".
 */
async function messageOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
    return "(khong nem)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Trích tập tên export từ một bundle ESM — ĐÚNG hai regex của tools/check/rows.ts.
 * Nhận: nội dung file đã build.
 * Trả: tập tên export (kể cả default).
 */
function exportNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) if (m[1] !== undefined) out.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return out;
}

/** Hình dạng manifest tối thiểu để kiểm gbh.peers ⊆ peerDependencies (so PHẦN TỬ). */
interface PeerManifest {
  /** Danh sách peer khai trong metadata của ta. */
  peers: readonly string[];
  /** Khoá của peerDependencies. */
  peerDependencies: readonly string[];
}

/**
 * Tên peer có trong gbh.peers mà THIẾU ở peerDependencies — phép kiểm PHẦN TỬ, không so số lượng.
 * Nhận: manifest hai danh sách.
 * Trả: tên thiếu (rỗng = đạt).
 */
function missingPeers(manifest: PeerManifest): string[] {
  const declared = new Set(manifest.peerDependencies);
  return manifest.peers.filter((peer) => !declared.has(peer));
}

/** Một bản ghi vòng đời đã bắt được từ session.append. */
interface LifecycleEvent {
  /** Tên sự kiện (`command/run` hoặc `command/done`). */
  type: string;
  /** Payload sự kiện. */
  data: unknown;
}

/** Agent giả tối thiểu: đúng hình dạng `{ session: { append } }` mà sổ đăng ký chạm tới. */
interface FakeAgent {
  /** Session ghi lại mọi bản ghi vòng đời. */
  session: { append(type: string, data: unknown): unknown };
  /** Các bản ghi đã nhận, theo thứ tự. */
  events: LifecycleEvent[];
}

/**
 * Dựng một agent giả ghi lại vòng đời.
 * Nhận: không.
 * Trả: agent giả kèm mảng `events` quan sát được.
 */
function makeAgent(): FakeAgent {
  const events: LifecycleEvent[] = [];
  return {
    events,
    session: {
      append(type: string, data: unknown): unknown {
        events.push({ type, data });
        return undefined;
      },
    },
  };
}

/** Một bản cài đã boot trên Context cordis thật. */
interface Booted {
  /** Context gốc của bản cài. */
  ctx: any;
  /** Thực thể service `commands`. */
  svc: any;
}

/**
 * Boot MỘT bản cài bằng ctx.plugin và chờ service sẵn sàng trong trần.
 * Nhận: lớp plugin (ta hoặc gốc).
 * Trả: context và service `commands`.
 */
async function boot(plugin: any): Promise<Booted> {
  const { Context } = (await import(CORDIS)) as any;
  const ctx = new Context();
  ctx.plugin(plugin);
  const svc = await waitFor(() => ctx.get("commands"), "commands");
  return { ctx, svc };
}

/**
 * Boot CẢ HAI bản, trên hai Context riêng.
 * Nhận: không.
 * Trả: hai bản cài đã boot + module gốc.
 */
async function bootBoth(): Promise<{ ours: Booted; theirs: Booted; stock: any }> {
  const stock = (await import(STOCK)) as any;
  const ours = await boot(Ours);
  const theirs = await boot(stock.default);
  return { ours, theirs, stock };
}

/**
 * Thay `commandId` bằng một mốc cố định để so hai bên (token thực thể khác nhau là ĐÚNG thiết kế).
 * Nhận: payload sự kiện vòng đời.
 * Trả: payload đã chuẩn hoá id.
 */
function withoutId(data: unknown): unknown {
  if (typeof data !== "object" || data === null) return data;
  return { ...(data as Record<string, unknown>), commandId: "<id>" };
}

describe("row commands — ARTIFACT và bề mặt", () => {
  test("ARTIFACT: tập export = bản gốc (6 = 6), 0 dấu vết id @deepseek-ai, prototype trùng", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    const artifact: any = await import(file);
    const stock: any = await import(STOCK);
    const expected = ["CommandDefinitionId", "CommandId", "CommandRuntime", "default", "name", "parseCommand"];
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(expected);
    expect([...exportNames(code)].sort()).toEqual(expected);
    expect(artifact.default).toBe(artifact.CommandRuntime);
    expect(stock.default).toBe(stock.CommandRuntime);
    expect(artifact.name).toBe("commands");
    expect(stock.name).toBe("commands");
    expect(artifact.CommandDefinitionId("x")).toBe("x");
    expect(artifact.CommandId("y")).toBe("y");
    expect(Object.getOwnPropertyNames(artifact.CommandRuntime.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.default.prototype).sort(),
    );
    // Vật thể thực thể: ĐÚNG các khoá riêng, ĐÚNG thứ tự khởi tạo như bản gốc.
    const ourBoot = await boot(artifact.default);
    const theirBoot = await boot(stock.default);
    expect(Object.keys(ourBoot.svc)).toEqual(Object.keys(theirBoot.svc));
    expect(Object.keys(ourBoot.svc)).toEqual(["ctx", "name", "typertRemote", "layers", "commandSeq", "instanceToken", "fileReceipts"]);
  });

  test("hai endpoint Remote (commands/list · commands/execute) hiện ra GIỐNG bản gốc", async () => {
    const { remoteMethods } = (await import(PROTOCOL)) as any;
    const { ours, theirs } = await bootBoth();
    expect(canonical(remoteMethods(ours.svc))).toBe(canonical(remoteMethods(theirs.svc)));
    expect(canonical(remoteMethods(ours.svc))).toBe('[{"method":"list","invocation":{"kind":"direct"}},{"method":"execute","invocation":{"kind":"direct"}}]');
    expect(ours.svc.name).toBe(theirs.svc.name);
    expect(ours.svc.typertRemote.namespace).toBe(theirs.svc.typertRemote.namespace);
    expect(typeof ours.svc.register).toBe("function");
    expect(typeof ours.svc.find).toBe("function");
    expect(typeof ours.svc.registerFileReceiptResolver).toBe("function");
  });

  test("locale en/zh byte-for-byte với bản gốc, exports có ./locale/*.json, và HÌNH DẠNG khoá `gbh.row`", async () => {
    const ours = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    expect(ours.exports["./locale/*.json"]).toBe("./locale/*.json");
    // CA CANH hình dạng khoá row: đọc CẢ HAI dạng (có/không có `gbh.row` — người sau có thể gỡ mount).
    // Khi CÓ, nó phải trỏ ĐÚNG row `commands` + ĐÚNG file test này, và KHÔNG mang
    // `config`/`inject`/`moduleIds`/`aliases`: row gốc trong `ours.yml` KHÔNG có config/inject nào.
    // (Khoá này do LEAD khai NGOÀI phiên viết gói — gói tự nó KHÔNG khai; xem README gói §7.)
    const row = ours.gbh.row as Record<string, unknown> | undefined;
    if (row !== undefined) {
      expect(row.id).toBe("commands");
      expect(row.tests).toEqual(["tests/host/commands.test.ts"]);
      expect(row.config).toBeUndefined();
      expect(row.inject).toBeUndefined();
      expect(row.moduleIds).toBeUndefined();
      expect(row.aliases).toBeUndefined();
    }
    expect(ours.gbh.tests).toEqual(["tests/host/commands.test.ts"]);
    for (const name of ["en.json", "zh.json"]) {
      const a = await readFile(join(PKG, "locale", name));
      const b = await readFile(join(STOCK_PKG, "locale", name));
      expect(Buffer.compare(a, b)).toBe(0);
    }
  });
});

describe("row commands — phân tích dòng lệnh", () => {
  test("parseCommand: 14 hình dạng dòng — cùng kết quả, cùng ĐÓNG BĂNG như gốc", async () => {
    const stock: any = await import(STOCK);
    const lines = [
      "/help",
      "/help more text",
      "/help\tmore",
      "/help\nmore",
      "/help\rmore",
      "/help ",
      "/help  ",
      "/a-b_c0",
      "/Ahelp",
      "/help!",
      "/help?x",
      "/ help",
      "help",
      "/",
      "//help",
      "",
      "/help\u00a0x",
    ];
    for (const line of lines) {
      expect(canonical(parseCommand(line))).toBe(canonical(stock.parseCommand(line)));
    }
    const parsed = parseCommand("/help   rest");
    expect(parsed).toEqual({ name: "help", rawInput: "   rest" });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(stock.parseCommand("/help   rest"))).toBe(true);
    expect(parseCommand("/Ahelp")).toBeUndefined();
    expect(stock.parseCommand("/Ahelp")).toBeUndefined();
    expect(parseCommand("/help\u00a0x")).toBeUndefined();
  });
});

describe("row commands — đăng ký, liệt kê, phạm vi", () => {
  test("register/list/find: descriptor đã sắp, ĐÓNG BĂNG, và giữ nguyên input/definitionId", async () => {
    const { ours, theirs } = await bootBoth();
    const agent = makeAgent();
    const defs = [
      { name: "zeta", description: "Zeta command" },
      { name: "alpha", description: "Alpha command", definitionId: "test:alpha", input: { hint: "a hint", attachments: true } },
      { name: "mid", description: "Mid command", recordInput: false },
    ];
    for (const def of defs) {
      ours.svc.register({ ...def, handler: () => ({ kind: "success" }) });
      theirs.svc.register({ ...def, handler: () => ({ kind: "success" }) });
    }
    const ourList = ours.svc.list(agent);
    const theirList = theirs.svc.list(agent);
    expect(canonical(ourList)).toBe(canonical(theirList));
    expect(ourList.map((c: any) => c.name)).toEqual(["alpha", "mid", "zeta"]);
    expect(ourList[0].input).toEqual({ hint: "a hint", attachments: true });
    expect(ourList[0].definitionId).toBe("test:alpha");
    expect(Object.isFrozen(ourList)).toBe(true);
    expect(Object.isFrozen(ourList[0])).toBe(true);
    expect(Object.isFrozen(theirList[0])).toBe(true);
    expect(ourList[0].handler).toBeUndefined();
    expect(canonical(ours.svc.find(agent, "mid"))).toBe(canonical(theirs.svc.find(agent, "mid")));
    expect(ours.svc.find(agent, "mid")?.recordInput).toBe(false);
    expect(ours.svc.find(agent, "ghost")).toBeUndefined();
    expect(theirs.svc.find(agent, "ghost")).toBeUndefined();
  });

  test("trùng tên: CÙNG thông điệp cho lớp toàn cục; gỡ đăng ký nhả tên; commands/change báo cả hai chiều", async () => {
    const { ours, theirs } = await bootBoth();
    const agent = makeAgent();
    let ourChanges = 0;
    let theirChanges = 0;
    ours.ctx.on("commands/change", () => {
      ourChanges += 1;
    });
    theirs.ctx.on("commands/change", () => {
      theirChanges += 1;
    });
    const ourDispose = ours.svc.register({ name: "dup", description: "Dup", handler: () => ({ kind: "success" }) });
    const theirDispose = theirs.svc.register({ name: "dup", description: "Dup", handler: () => ({ kind: "success" }) });
    const oursDup = await messageOf(() => ours.svc.register({ name: "dup", description: "Dup", handler: () => ({ kind: "success" }) }));
    const theirsDup = await messageOf(() => theirs.svc.register({ name: "dup", description: "Dup", handler: () => ({ kind: "success" }) }));
    expect(oursDup).toBe(theirsDup);
    expect(oursDup).toContain('command "dup" is already registered');
    expect(oursDup).toContain("agent.ctx");
    ourDispose();
    theirDispose();
    expect(ourChanges).toBe(theirChanges);
    expect(ourChanges).toBe(2);
    expect(ours.svc.list(agent).length).toBe(0);
    ours.svc.register({ name: "dup", description: "Dup again", handler: () => ({ kind: "success" }) });
    theirs.svc.register({ name: "dup", description: "Dup again", handler: () => ({ kind: "success" }) });
    expect(canonical(ours.svc.list(agent))).toBe(canonical(theirs.svc.list(agent)));
  });

  test("lớp theo PHẠM VI che lớp toàn cục — cùng kết quả và cùng thông điệp trùng tên", async () => {
    const { ours, theirs } = await bootBoth();
    const scopeMod: any = await import(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js"));
    const ourKey = {};
    const theirKey = {};
    const ourScope = scopeMod.createScope(ours.ctx, ourKey);
    const theirScope = scopeMod.createScope(theirs.ctx, theirKey);
    try {
      for (const [svc, scope] of [
        [ours.svc, ourScope],
        [theirs.svc, theirScope],
      ] as any[]) {
        svc.register({ name: "global-only", description: "Global", handler: () => ({ kind: "success" }) });
        svc.register({ name: "shadowed", description: "Global copy", handler: () => ({ kind: "success" }) });
        const scoped = scope.ctx.get("commands");
        scoped.register({ name: "shadowed", description: "Scoped copy", handler: () => ({ kind: "success" }) });
      }
      expect(canonical(ours.svc.list(ourKey))).toBe(canonical(theirs.svc.list(theirKey)));
      expect(ours.svc.list(ourKey).map((c: any) => c.name)).toEqual(["global-only", "shadowed"]);
      expect(ours.svc.find(ourKey, "shadowed")?.description).toBe("Scoped copy");
      expect(ours.svc.find(undefined, "shadowed")?.description).toBe("Global copy");
      const ourScopedDup = await messageOf(() => ourScope.ctx.get("commands").register({ name: "shadowed", description: "Again", handler: () => ({ kind: "success" }) }));
      const theirScopedDup = await messageOf(() => theirScope.ctx.get("commands").register({ name: "shadowed", description: "Again", handler: () => ({ kind: "success" }) }));
      expect(ourScopedDup).toBe(theirScopedDup);
      expect(ourScopedDup).toContain("is already registered in this scope");
    } finally {
      await ourScope.dispose();
      await theirScope.dispose();
    }
  });
});

describe("row commands — thực thi và vòng đời", () => {
  test("execute thành công: kết quả + cặp command/run–command/done Y HỆT gốc (trừ token thực thể)", async () => {
    const { ours, theirs } = await bootBoth();
    const ourAgent = makeAgent();
    const theirAgent = makeAgent();
    for (const [svc, agent] of [
      [ours.svc, ourAgent],
      [theirs.svc, theirAgent],
    ] as any[]) {
      svc.register({ name: "hello", description: "Say hello", handler: (inv: any) => ({ kind: "success", text: `hi${inv.rawInput}` }) });
    }
    const ourRun = await ours.svc.execute(ourAgent, "/hello   there", [], new AbortController().signal);
    const theirRun = await theirs.svc.execute(theirAgent, "/hello   there", [], new AbortController().signal);
    expect(ourRun.result).toEqual({ kind: "success", text: "hi   there" });
    expect(canonical({ ...ourRun, commandId: "<id>" })).toBe(canonical({ ...theirRun, commandId: "<id>" }));
    expect(ourRun.commandId).toMatch(/^cmd-[0-9a-f]{8}-1$/);
    expect(theirRun.commandId).toMatch(/^cmd-[0-9a-f]{8}-1$/);
    expect(Object.isFrozen(ourRun)).toBe(true);
    expect(Object.isFrozen(ourRun.result)).toBe(true);
    expect(ourAgent.events.map((e) => e.type)).toEqual(["command/run", "command/done"]);
    expect(canonical(ourAgent.events.map((e) => ({ type: e.type, data: withoutId(e.data) })))).toBe(
      canonical(theirAgent.events.map((e) => ({ type: e.type, data: withoutId(e.data) }))),
    );
    expect(canonical(withoutId(ourAgent.events[0]?.data))).toBe('{"commandId":"<id>","name":"hello","args":"   there","source":{"kind":"user"}}');
    expect(canonical(withoutId(ourAgent.events[1]?.data))).toBe('{"commandId":"<id>","kind":"success","text":"hi   there"}');
    const ourSecond = await ours.svc.execute(ourAgent, "/hello", [], new AbortController().signal);
    expect(ourSecond.commandId.endsWith("-2")).toBe(true);
  });

  test("execute: tên lạ · sai cú pháp · sai phạm vi hàm — KHÔNG ghi gì, cùng kết quả như gốc", async () => {
    const { ours, theirs } = await bootBoth();
    const ourAgent = makeAgent();
    const theirAgent = makeAgent();
    for (const [svc, agent] of [
      [ours.svc, ourAgent],
      [theirs.svc, theirAgent],
    ] as any[]) {
      svc.register({ name: "known", description: "Known", recordInput: false, handler: () => ({ kind: "success" }) });
    }
    expect(await ours.svc.execute(ourAgent, "/unknown", [], new AbortController().signal)).toBeUndefined();
    expect(await theirs.svc.execute(theirAgent, "/unknown", [], new AbortController().signal)).toBeUndefined();
    expect(await ours.svc.execute(ourAgent, "khong-phai-lenh", [], new AbortController().signal)).toBeUndefined();
    expect(await theirs.svc.execute(theirAgent, "khong-phai-lenh", [], new AbortController().signal)).toBeUndefined();
    expect(ourAgent.events.length).toBe(0);
    expect(theirAgent.events.length).toBe(0);
    const ourRun = await ours.svc.execute(ourAgent, "/known payload", [], new AbortController().signal);
    const theirRun = await theirs.svc.execute(theirAgent, "/known payload", [], new AbortController().signal);
    expect(canonical({ ...ourRun, commandId: "<id>" })).toBe(canonical({ ...theirRun, commandId: "<id>" }));
    expect(canonical(withoutId(ourAgent.events[0]?.data))).toBe('{"commandId":"<id>","name":"known","source":{"kind":"user"}}');
  });

  test("execute: hẹn giờ huỷ TRƯỚC và TRONG handler — cùng lỗi, cùng bản ghi command/done", async () => {
    const { ours, theirs } = await bootBoth();
    const ourAgent = makeAgent();
    const theirAgent = makeAgent();
    for (const [svc, agent] of [
      [ours.svc, ourAgent],
      [theirs.svc, theirAgent],
    ] as any[]) {
      svc.register({ name: "slow", description: "Slow", handler: () => new Promise(() => {}) });
      svc.register({ name: "fast", description: "Fast", handler: () => ({ kind: "success" }) });
    }
    const aborted = new AbortController();
    aborted.abort(new Error("stop now"));
    expect(await messageOf(() => ours.svc.execute(ourAgent, "/fast", [], aborted.signal))).toBe(
      await messageOf(() => theirs.svc.execute(theirAgent, "/fast", [], aborted.signal)),
    );
    expect(ourAgent.events.length).toBe(0);
    expect(theirAgent.events.length).toBe(0);
    const during = new AbortController();
    const ourPending = ours.svc.execute(ourAgent, "/slow", [], during.signal);
    const theirPending = theirs.svc.execute(theirAgent, "/slow", [], during.signal);
    during.abort("user cancelled");
    expect(await messageOf(() => ourPending)).toBe(await messageOf(() => theirPending));
    expect(await messageOf(() => ourPending)).toBe("user cancelled");
    expect(canonical(ourAgent.events.map((e) => ({ type: e.type, data: withoutId(e.data) })))).toBe(
      canonical(theirAgent.events.map((e) => ({ type: e.type, data: withoutId(e.data) }))),
    );
    expect(ourAgent.events.map((e) => e.type)).toEqual(["command/run", "command/done"]);
    expect(canonical(withoutId(ourAgent.events[1]?.data))).toBe('{"commandId":"<id>","kind":"error","text":"user cancelled"}');
  });

  test("execute: handler ném · trả sai hình dạng · promise từ chối giá trị lạ — cùng TypeError/thông điệp", async () => {
    const { ours, theirs } = await bootBoth();
    const cases: { name: string; handler: () => unknown }[] = [
      { name: "throw", handler: () => { throw new Error("handler exploded"); } },
      { name: "throw-string", handler: () => { throw "chuoi"; } },
      { name: "no-kind", handler: () => ({ text: "x" }) },
      { name: "bad-kind", handler: () => ({ kind: "unknown" }) },
      { name: "success-bad-text", handler: () => ({ kind: "success", text: 5 }) },
      { name: "success-negative-seq", handler: () => ({ kind: "success", sourceEventSeq: -1 }) },
      { name: "success-minus-zero", handler: () => ({ kind: "success", sourceEventSeq: -0 }) },
      { name: "error-empty", handler: () => ({ kind: "error", text: "   " }) },
      { name: "reject-string", handler: () => Promise.reject("no-error-object") },
    ];
    for (const kase of cases) {
      const { ours: ourBoot, theirs: theirBoot } = await bootBoth();
      const ourAgent = makeAgent();
      const theirAgent = makeAgent();
      ourBoot.svc.register({ name: "probe", description: "Probe", handler: kase.handler });
      theirBoot.svc.register({ name: "probe", description: "Probe", handler: kase.handler });
      const ourMessage = await messageOf(() => ourBoot.svc.execute(ourAgent, "/probe", [], new AbortController().signal));
      const theirMessage = await messageOf(() => theirBoot.svc.execute(theirAgent, "/probe", [], new AbortController().signal));
      expect(ourMessage).toBe(theirMessage);
      expect(canonical(ourAgent.events.map((e) => ({ type: e.type, data: withoutId(e.data) })))).toBe(
        canonical(theirAgent.events.map((e) => ({ type: e.type, data: withoutId(e.data) }))),
      );
      expect(ourAgent.events.map((e) => e.type)).toEqual(["command/run", "command/done"]);
      expect((ourAgent.events[1]?.data as any).kind).toBe("error");
    }
    const success = await bootBoth();
    success.ours.svc.register({ name: "seq", description: "Seq", handler: () => ({ kind: "success", sourceEventSeq: 7 }) });
    success.theirs.svc.register({ name: "seq", description: "Seq", handler: () => ({ kind: "success", sourceEventSeq: 7 }) });
    const ourSeq = await success.ours.svc.execute(makeAgent(), "/seq", [], new AbortController().signal);
    const theirSeq = await success.theirs.svc.execute(makeAgent(), "/seq", [], new AbortController().signal);
    expect(ourSeq.result.sourceEventSeq).toBe(7);
    expect(canonical({ ...ourSeq, commandId: "<id>" })).toBe(canonical({ ...theirSeq, commandId: "<id>" }));
  });
});

describe("row commands — tệp đính kèm", () => {
  test("không khai input.attachments · thiếu store — cùng kết quả lỗi, KHÔNG gọi handler", async () => {
    const { ours, theirs } = await bootBoth();
    const attachment = [{ type: "file", receiptId: "r1" }];
    for (const [svc, agent] of [
      [ours.svc, makeAgent()],
      [theirs.svc, makeAgent()],
    ] as any[]) {
      svc.register({ name: "plain", description: "Plain", handler: () => ({ kind: "success" }) });
      svc.register({ name: "wants", description: "Wants", input: { hint: "h", attachments: true }, handler: () => ({ kind: "success" }) });
    }
    const ourPlain = await ours.svc.execute(makeAgent(), "/plain", attachment, new AbortController().signal);
    const theirPlain = await theirs.svc.execute(makeAgent(), "/plain", attachment, new AbortController().signal);
    expect(canonical({ ...ourPlain, commandId: "<id>" })).toBe(canonical({ ...theirPlain, commandId: "<id>" }));
    expect(ourPlain.result).toEqual({ kind: "error", text: "/plain does not accept attachments" });
    const ourNoStore = await ours.svc.execute(makeAgent(), "/wants", attachment, new AbortController().signal);
    const theirNoStore = await theirs.svc.execute(makeAgent(), "/wants", attachment, new AbortController().signal);
    expect(canonical({ ...ourNoStore, commandId: "<id>" })).toBe(canonical({ ...theirNoStore, commandId: "<id>" }));
    expect(ourNoStore.result).toEqual({
      kind: "error",
      text: "/wants: attachments are unavailable because no attachment store is composed",
    });
  });

  test("có store + bộ giải biên nhận: block ẢNH/TỆP đúng THỨ TỰ gửi, y hệt gốc; biên nhận lạ ⇒ AttachmentError", async () => {
    const { ours, theirs } = await bootBoth();
    const imageRef = (index: number) => ({ attachmentId: `img-${index}`, mediaType: "image/png", bytes: 3, width: 1, height: 1 });
    const fileRef = { attachmentId: "file-1", name: "notes.txt", bytes: 5 };
    const seen: unknown[] = [];
    const makeStore = () => ({
      saveImages: async (inputs: readonly any[]) =>
        inputs.map((input, index) => ({ ...imageRef(index), mediaType: input.mediaType, ...(input.name === undefined ? {} : { name: input.name }) })),
    });
    const batch = [
      { type: "file", receiptId: "r1" },
      { type: "image", mediaType: "image/png", data: "AAAA", name: "a.png" },
      { type: "image", mediaType: "image/jpeg", data: "BBBB" },
      { type: "file", receiptId: "r1" },
    ];
    for (const [svc, ctx, store] of [
      [ours.svc, ours.ctx, makeStore()],
      [theirs.svc, theirs.ctx, makeStore()],
    ] as any[]) {
      ctx.provide("attachments", store);
      svc.registerFileReceiptResolver((_agent: unknown, receiptId: string) => (receiptId === "r1" ? fileRef : undefined));
      svc.register({
        name: "attach",
        description: "Attach",
        input: { hint: "h", attachments: true },
        handler: (inv: any) => {
          seen.push(inv.attachments);
          return { kind: "success", text: String(inv.attachments.length) };
        },
      });
    }
    const ourRun = await ours.svc.execute(makeAgent(), "/attach", batch, new AbortController().signal);
    const theirRun = await theirs.svc.execute(makeAgent(), "/attach", batch, new AbortController().signal);
    expect(canonical({ ...ourRun, commandId: "<id>" })).toBe(canonical({ ...theirRun, commandId: "<id>" }));
    expect(ourRun.result).toEqual({ kind: "success", text: "4" });
    const ourBlocks = seen[0] as any[];
    const theirBlocks = seen[1] as any[];
    expect(canonical(ourBlocks)).toBe(canonical(theirBlocks));
    expect(ourBlocks.map((b) => b.type)).toEqual(["file", "image", "image", "file"]);
    expect(ourBlocks[0].attachment).toBe(fileRef);
    expect(ourBlocks[3].attachment).toBe(fileRef);
    expect(ourBlocks[1].attachment.name).toBe("a.png");
    expect(ourBlocks[2].attachment.mediaType).toBe("image/jpeg");
    expect(Object.isFrozen(ourBlocks)).toBe(true);
    expect(Object.isFrozen(ourBlocks[1])).toBe(true);
    const ourUnknown = await ours.svc.execute(makeAgent(), "/attach", [{ type: "file", receiptId: "ghost" }], new AbortController().signal);
    const theirUnknown = await theirs.svc.execute(makeAgent(), "/attach", [{ type: "file", receiptId: "ghost" }], new AbortController().signal);
    expect(canonical({ ...ourUnknown, commandId: "<id>" })).toBe(canonical({ ...theirUnknown, commandId: "<id>" }));
    expect(ourUnknown.result).toEqual({ kind: "error", text: "File upload receipt is unknown for this session." });
    const dupResolver = await messageOf(() => ours.svc.registerFileReceiptResolver(() => undefined));
    const theirDupResolver = await messageOf(() => theirs.svc.registerFileReceiptResolver(() => undefined));
    expect(dupResolver).toBe(theirDupResolver);
    expect(dupResolver).toBe("commands: a file receipt resolver is already registered");
  });

  test("lượt không đính kèm dùng CÙNG một mảng rỗng ĐÓNG BĂNG — như bản gốc", async () => {
    const { ours, theirs } = await bootBoth();
    const seen: any[] = [];
    for (const svc of [ours.svc, theirs.svc]) {
      svc.register({ name: "noattach", description: "No attach", handler: (inv: any) => { seen.push(inv.attachments); return { kind: "success" }; } });
    }
    const ourAgent = makeAgent();
    const theirAgent = makeAgent();
    await ours.svc.execute(ourAgent, "/noattach", [], new AbortController().signal);
    await ours.svc.execute(ourAgent, "/noattach", [], new AbortController().signal);
    await theirs.svc.execute(theirAgent, "/noattach", [], new AbortController().signal);
    await theirs.svc.execute(theirAgent, "/noattach", [], new AbortController().signal);
    expect(seen[0].length).toBe(0);
    expect(Object.isFrozen(seen[0])).toBe(true);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[2]).toBe(seen[3]);
    expect(seen[0]).not.toBe(seen[2]);
  });
});

describe("C6 — danh tính: hai thực thể KHÔNG chia sẻ vật thể", () => {
  test("hai bản cài độc lập: sổ riêng · bộ đếm riêng · token riêng · bộ giải biên nhận riêng", async () => {
    const a = await boot(Ours);
    const b = await boot(Ours);
    const agent = makeAgent();
    const disposeA = a.svc.register({ name: "shared-name", description: "A", handler: () => ({ kind: "success" }) });
    expect(() => b.svc.register({ name: "shared-name", description: "B", handler: () => ({ kind: "success" }) })).not.toThrow();
    expect(a.svc.list(agent)[0].description).toBe("A");
    expect(b.svc.list(agent)[0].description).toBe("B");
    // Mảng là VẬT MỚI mỗi lượt, descriptor thì BỀN theo đăng ký — đo CẢ HAI bên cùng quy ước.
    const first = a.svc.list(agent);
    const again = a.svc.list(agent);
    expect(first).not.toBe(again);
    expect(first[0]).toBe(again[0]);
    const stock: any = await import(STOCK);
    const c = await boot(stock.default);
    const d = await boot(stock.default);
    c.svc.register({ name: "shared-name", description: "A", handler: () => ({ kind: "success" }) });
    d.svc.register({ name: "shared-name", description: "B", handler: () => ({ kind: "success" }) });
    expect(c.svc.list(agent)[0].description).toBe("A");
    expect(d.svc.list(agent)[0].description).toBe("B");
    expect(c.svc.list(agent)).not.toBe(c.svc.list(agent));
    expect(c.svc.list(agent)[0]).toBe(c.svc.list(agent)[0]);
    expect(canonical(c.svc.list(agent))).toBe(canonical(a.svc.list(agent)));
    const runA = await a.svc.execute(agent, "/shared-name", [], new AbortController().signal);
    const runB = await b.svc.execute(agent, "/shared-name", [], new AbortController().signal);
    expect(runA.commandId.endsWith("-1")).toBe(true);
    expect(runB.commandId.endsWith("-1")).toBe(true);
    expect(runA.commandId).not.toBe(runB.commandId);
    expect(a.svc.registerFileReceiptResolver(() => undefined)).toBeFunction();
    expect(() => b.svc.registerFileReceiptResolver(() => undefined)).not.toThrow();
    expect(a.svc.typertRemote).not.toBe(b.svc.typertRemote);
    disposeA();
    expect(a.svc.list(agent).length).toBe(0);
    expect(b.svc.list(agent).length).toBe(1);
    expect(a.ctx).not.toBe(b.ctx);
  });

  test("gbh.peers ⊆ peerDependencies — so PHẦN TỬ, kèm ĐỐI CHỨNG ÂM", async () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    const peers: string[] = manifest.gbh.peers;
    const peerDependencies = Object.keys(manifest.peerDependencies);
    expect(missingPeers({ peers, peerDependencies })).toEqual([]);
    expect(peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-scope",
      "@deepseek-ai/dsh-typert-protocol",
      "@deepseek-ai/dsh-attachment",
    ]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    expect(manifest.dsh?.client).toBeUndefined();
    expect(missingPeers({ peers: ["a", "b"], peerDependencies: ["a"] })).toEqual(["b"]);
    expect(missingPeers({ peers: ["a"], peerDependencies: [] })).toEqual(["a"]);
    expect(missingPeers({ peers: ["a", "b"], peerDependencies: ["b"] })).toEqual(["a"]);
    expect(missingPeers({ peers: ["a"], peerDependencies: ["a", "b"] })).toEqual([]);
    expect(missingPeers({ peers: [], peerDependencies: [] })).toEqual([]);
  });
});
