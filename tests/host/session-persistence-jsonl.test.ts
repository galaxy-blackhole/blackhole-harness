/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho row session-persistence-jsonl: bundle ghép phải BYTE-IDENTICAL với gốc; round-trip dùng
 *      BẢN GHI THẬT trong ~/.galaxy/blackhole/sessions (CHỈ ĐỌC) + ghi vào mkdtemp, đọc lại bằng bản kia.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/session-persistence-jsonl/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-persistence-jsonl");
/** Bundle stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-persistence-jsonl", "lib", "index.js");
/** Bundle của ta (build tạm). */
const OUT = join(PKG, "lib", ".test-build");
/** Thư mục phiên THẬT (CHỈ ĐỌC). */
const SESSIONS = join(process.env.HOME ?? "", ".galaxy", "blackhole", "sessions");
/** cordis THẬT của kernel. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Package session của kernel (lấy brand SessionId). */
const SESSION_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session", "lib", "index.js");

/** Bề mặt plugin persistence. */
interface PersistencePlugin {
  readonly name: string;
  readonly apply: (ctx: unknown, config: unknown) => Promise<void>;
  readonly Config: unknown;
}
/** Bề mặt service persistence dùng trong test. */
interface PersistenceService {
  create(header: unknown): Promise<SessionHandleLike>;
  open(id: unknown, access: string): Promise<SessionHandleLike>;
  list(): Promise<readonly unknown[]>;
}
/** Bề mặt handle phiên. */
interface SessionHandleLike {
  readonly header: unknown;
  read(): Promise<{ readonly events: readonly unknown[] }>;
  append(events: readonly unknown[]): Promise<void>;
  flush(): Promise<void>;
  close(): Promise<void>;
}
/** Context cordis. */
type Ctx = { readonly sessionPersistence?: PersistenceService; dispose(): Promise<void> };

/** Module stock. */
const stockModule = (await import(STOCK)) as unknown as PersistencePlugin;
/** Module của TA (nạp sau build). */
let ourModule: PersistencePlugin;
/** Context class. */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => Ctx };
/** Brand SessionId. */
const sessionPkg = (await import(SESSION_PKG)) as unknown as { SessionId: (value: string) => unknown };

/** Phiên THẬT đọc từ đĩa. */
interface RealSession {
  readonly header: Record<string, unknown>;
  readonly events: readonly Record<string, unknown>[];
}

/**
 * Đọc phiên .jsonl.zstd lớn nhất trong thư mục sessions (CHỈ ĐỌC).
 * Nhận: không. Trả: header (đã bỏ type) + events.
 */
function readRealSession(): RealSession {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      // 10/11/2026 (Lead): chỉ dùng phiên v4 (định dạng hiện hành); phiên v3 của bản cũ không đọc được.
      else if (entry.endsWith("session.v4.jsonl.zstd")) files.push(path);
    }
  };
  walk(SESSIONS);
  // 10/11/2026 (Lead): nhà người dùng có phiên v4 rất lớn (hàng trăm MB) — đọc trọn tệp lớn nhất vượt
  // trần 5s của bun và có thể đứt giữa chừng ("Unexpected end of file"). Chọn tệp lớn nhất nhưng ≤ 8 MB
  // (vẫn là bản ghi THẬT, đủ nhiều event); không có tệp nào nhỏ như vậy thì lấy tệp nhỏ nhất.
  const THEO_CO = files.map((path) => ({ path, size: statSync(path).size })).sort((a, b) => b.size - a.size);
  const chon = THEO_CO.find((muc) => muc.size <= 8 * 1024 * 1024) ?? THEO_CO[THEO_CO.length - 1];
  if (chon === undefined) throw new Error("không có phiên thật để round-trip");
  const biggest = chon.path;
  const text = new TextDecoder().decode(Bun.zstdDecompressSync(readFileSync(biggest)));
  const lines = text.split(String.fromCharCode(10)).filter((line) => line.trim() !== "");
  const rawHeader = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
  const { type: _type, ...header } = rawHeader;
  header["id"] = sessionPkg.SessionId(String(header["id"]));
  return { header, events: lines.slice(1).map((line) => JSON.parse(line) as Record<string, unknown>) };
}

/**
 * Dựng service từ một module plugin trên Context THẬT.
 * Nhận: module — plugin persistence; root — thư mục gốc. Trả: Context đã sẵn service.
 */
async function mount(module: PersistencePlugin, root: string): Promise<Ctx> {
  const ctx = new Context();
  const fiber = (ctx as unknown as { plugin: (plugin: unknown, config: unknown) => unknown }).plugin({ name: module.name, apply: module.apply, Config: module.Config }, { root });
  await (fiber as Promise<unknown>);
  for (let attempt = 0; attempt < 200 && ctx.sessionPersistence === undefined; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  if (ctx.sessionPersistence === undefined) throw new Error("plugin không cấp service sessionPersistence");
  (ctx as unknown as { dispose: () => Promise<void> }).dispose = async () => {
    await (fiber as { dispose: () => Promise<void> }).dispose();
  };
  return ctx;
}

beforeAll(async () => {
  buildPackage(OUT);
  ourModule = (await import(join(OUT, "index.js"))) as unknown as PersistencePlugin;
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

describe("session-persistence-jsonl — cổng byte + round-trip bản ghi THẬT", () => {
  test("bundle ghép BYTE-IDENTICAL với bundle gốc", () => {
    const stockBytes = readFileSync(STOCK);
    const ourBytes = readFileSync(join(OUT, "index.js"));
    expect(ourBytes.length).toBe(stockBytes.length);
    expect(Buffer.compare(ourBytes, stockBytes)).toBe(0);
  });

  test("stock GHI bản ghi THẬT vào mkdtemp ⇒ ta ĐỌC lại từng event khớp", async () => {
    const real = readRealSession();
    const root = mkdtempSync(join(tmpdir(), "gbh-pj-stock-"));
    const stockCtx = await mount(stockModule, root);
    const stockService = stockCtx.sessionPersistence as PersistenceService;
    const handle = await stockService.create(real.header);
    await handle.append(real.events);
    await handle.flush();
    await handle.close();
    await stockCtx.dispose();
    const ourCtx = await mount(ourModule, root);
    const ourService = ourCtx.sessionPersistence as PersistenceService;
    const id = real.header["id"];
    const readHandle = await ourService.open(id, "read");
    const read = await readHandle.read();
    expect(JSON.stringify(read.events)).toBe(JSON.stringify(real.events));
    expect(JSON.stringify(readHandle.header)).toBe(JSON.stringify(handle.header));
    await readHandle.close();
    await ourCtx.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  test("ta GHI bản ghi THẬT vào mkdtemp ⇒ stock ĐỌC lại từng event khớp", async () => {
    const real = readRealSession();
    const root = mkdtempSync(join(tmpdir(), "gbh-pj-ours-"));
    const ourCtx = await mount(ourModule, root);
    const ourService = ourCtx.sessionPersistence as PersistenceService;
    const handle = await ourService.create(real.header);
    await handle.append(real.events);
    await handle.flush();
    await handle.close();
    await ourCtx.dispose();
    const stockCtx = await mount(stockModule, root);
    const stockService = stockCtx.sessionPersistence as PersistenceService;
    const readHandle = await stockService.open(real.header["id"], "read");
    const read = await readHandle.read();
    expect(JSON.stringify(read.events)).toBe(JSON.stringify(real.events));
    await readHandle.close();
    await stockCtx.dispose();
    rmSync(root, { recursive: true, force: true });
  });

  test("list() A/B trên cùng một root: cùng id + cùng header", async () => {
    const real = readRealSession();
    const root = mkdtempSync(join(tmpdir(), "gbh-pj-list-"));
    const stockCtx = await mount(stockModule, root);
    const stockService = stockCtx.sessionPersistence as PersistenceService;
    const handle = await stockService.create(real.header);
    await handle.append(real.events.slice(0, Math.min(3, real.events.length)));
    await handle.flush();
    await handle.close();
    const oursCtx = await mount(ourModule, root);
    const ourList = await (oursCtx.sessionPersistence as PersistenceService).list();
    const stockList = await stockService.list();
    expect(JSON.stringify(ourList)).toBe(JSON.stringify(stockList));
    expect(ourList.length).toBe(1);
    await oursCtx.dispose();
    await stockCtx.dispose();
    rmSync(root, { recursive: true, force: true });
  });
});