/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-agent (row `agent` · gói gốc @deepseek-ai/dsh-agent):
 *      tập export đo trên ARTIFACT, ma trận hành vi chạy CẢ HAI bản trên Context cordis THẬT
 *      (đăng ký · công bố · factory · initiator · dispatch · model-selection · archive-admission ·
 *      phép gấp consumed-work), C6 danh tính, gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM, luật 000e,
 *      và ĐỐI CHỨNG ÂM của chính test (sửa một chỗ ⇒ phải có ca đỏ).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/agent/build.ts";
import {
  OUT_DIR,
  PKG_DIR,
  ROOT,
  STOCK_CORDIS,
  STOCK_DIR,
  STOCK_ENTRY,
  bootRegistry,
  dispatchSurface,
  exportGaps,
  exportNames,
  makeAgent,
  peerGaps,
  waitFor,
  type AgentModule,
  type Side,
} from "./agent-harness.ts";

/** Bản build của ta trong thư mục tạm của package (dựng TRƯỚC khi nạp: artefact cần cầu peer). */
const artifact = await buildPackage(OUT_DIR);

// LƯỢT ĐO 01/11/2026: bản của TA nay nạp từ ARTEFACT trong "profile giả" — node_modules/@deepseek-ai trỏ
// KERNEL, đúng cách mount thật symlink peer. Trước đây `loadSides()` nạp thẳng `src/index.ts` nên peer
// phân giải về bản sao workspace (cùng nội dung, KHÁC mô-đun); `dsh-scope` đánh dấu carrier bằng
// `Symbol("dsh.scope")` cục bộ mô-đun ⇒ phép kiểm carrier của kernel trả false ở 2 ca, và sổ đăng ký lệch
// `carrierKey` ở ca thứ ba — dù hành vi y hệt.
mkdirSync(join(OUT_DIR, "node_modules"), { recursive: true });
symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT_DIR, "node_modules", "@galaxy-blackhole"), "dir");

/** cordis của KERNEL — CẢ HAI bản nạp cùng thể hiện này, đúng như lúc mount thật. */
const kernelCordis = (await import(STOCK_CORDIS)) as { Context: new () => unknown };

/** Hai bản cài, mỗi bản trên cordis của kernel (thể hiện duy nhất mà kernel cấp). */
const sides: { ours: Side; stock: Side } = {
  ours: { label: "ours", module: (await import(artifact)) as AgentModule, ContextCtor: kernelCordis.Context },
  stock: { label: "stock", module: (await import(STOCK_ENTRY)) as AgentModule, ContextCtor: kernelCordis.Context },
};

/** Nội dung artifact của ta và của bản gốc. */
const oursCode = readFileSync(artifact, "utf8");
const stockCode = readFileSync(STOCK_ENTRY, "utf8");

/** Manifest của ta và của bản gốc. */
const oursManifest = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8")) as {
  name: string;
  dsh?: unknown;
  dependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  gbh?: { peers?: unknown; row?: unknown; tests?: unknown };
};
const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as {
  name: string;
  dsh?: { client?: unknown };
};

/** Tên gói GỐC — lấy từ dump/package.json, KHÔNG suy từ tên thư mục. */
const STOCK_PACKAGE = "@deepseek-ai/dsh-agent";

/** dsh-scope của KERNEL — cũng chính là thể hiện mà CẢ HAI bản nạp (artefact ta đã bắc cầu về kernel). */
const scope = (await import(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js"))) as {
  carrierKeyOf(value: unknown): unknown;
  isScopeCarrier(value: unknown): boolean;
};

/** Xoá thư mục build tạm sau khi xong. */
afterAll(() => {
  rmSync(OUT_DIR, { recursive: true, force: true });
});

/**
 * Bắt kết cục của một phép gọi thành chuỗi so được (kể cả lỗi).
 * Nhận: `operation` — phép gọi cần chạy.
 * Trả: `OK:<json>` hoặc `THROW:<thông điệp>`.
 */
function capture<T>(operation: () => T): string {
  try {
    return "OK:" + JSON.stringify(operation());
  } catch (error) {
    return "THROW:" + String((error as { message?: unknown }).message);
  }
}

/**
 * Rút một thông điệp về hình dạng so được (bỏ `id` ngẫu nhiên, giữ cờ đã đóng băng).
 * Nhận: `message` — thông điệp người-dùng.
 * Trả: `{ role, content, source, frozen }`.
 */
function stripMessage(message: unknown): Record<string, unknown> {
  const typed = message as { role?: unknown; content?: unknown; source?: unknown };
  return {
    role: typed.role,
    content: typed.content,
    source: typed.source,
    frozen: Object.isFrozen(message),
  };
}

/** Một sự kiện phiên giả cho phép gấp. */
interface FoldEvent {
  /** Loại sự kiện. */
  type: string;
  /** Dữ liệu mang theo. */
  data: Record<string, unknown>;
}

/**
 * Chạy phép gấp của MỘT bản trên một nhật ký, ghi lại kết cục + DANH TÍNH của `end`.
 * Nhận: `side` — bản cần chạy; `events` — nhật ký.
 * Trả: `{ endType, endIndex, droppedUnrun }` — `endIndex` là vị trí CHÍNH XÁC của sự kiện end.
 */
function foldTrace(side: Side, events: readonly FoldEvent[]): { endType: string | null; endIndex: number; droppedUnrun: boolean } {
  const result = side.module.foldConsumedWork(events);
  const end = result.end as FoldEvent | undefined;
  return {
    endType: end === undefined ? null : end.type,
    endIndex: end === undefined ? -1 : events.indexOf(end),
    droppedUnrun: result.droppedUnrun,
  };
}

/**
 * Nhật ký cho ma trận phép gấp — mỗi ca một tên, dùng CHUNG cho hai bản.
 * Nhận: không.
 * Trả: các cặp `{ name, events }`.
 */
function foldMatrix(): { name: string; events: FoldEvent[] }[] {
  const msg = { id: "m", role: "user" };
  return [
    { name: "rong", events: [] },
    {
      name: "bước rồi đóng completed",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "step/start", data: { turn: 1 } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } },
      ],
    },
    {
      name: "nhận đầu vào rồi blocked",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "agent/inbox/spliced", data: { removedCount: 1, inserted: [msg] } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "blocked" } } },
      ],
    },
    {
      name: "nhận đầu vào rồi completed",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "agent/inbox/spliced", data: { removedCount: 1, inserted: [msg] } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } },
      ],
    },
    {
      name: "huỷ rỗng thì bỏ KHÔNG chạy",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "agent/inbox/spliced", data: { removedCount: 1, outcome: "canceled", inserted: [] } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "blocked" } } },
      ],
    },
    {
      name: "huỷ có chèn thì KHÔNG tính bỏ",
      events: [{ type: "agent/inbox/spliced", data: { removedCount: 1, outcome: "canceled", inserted: [msg] } }],
    },
    {
      name: "splice thiếu removedCount thì bỏ qua",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "agent/inbox/spliced", data: { inserted: [] } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "aborted" } } },
      ],
    },
    {
      name: "lý do max-tokens vẫn tính",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "agent/inbox/spliced", data: { removedCount: 1, inserted: [msg] } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "max-tokens" } } },
      ],
    },
    {
      name: "lý do lạ vẫn tính",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "agent/inbox/spliced", data: { removedCount: 1, inserted: [msg] } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "tu-backend-them" } } },
      ],
    },
    {
      name: "turn vắng số: stepped xoá được undefined",
      events: [
        { type: "turn/start", data: {} },
        { type: "step/start", data: {} },
        { type: "turn/end", data: { reason: { kind: "completed" } } },
      ],
    },
    {
      name: "end cũ giữ nguyên khi huỷ SAU lượt",
      events: [
        { type: "turn/start", data: { turn: 1 } },
        { type: "step/start", data: { turn: 1 } },
        { type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } },
        { type: "agent/inbox/spliced", data: { removedCount: 2, outcome: "canceled", inserted: [] } },
      ],
    },
    {
      name: "claimed của lượt KHÁC không tính",
      events: [
        { type: "turn/start", data: { turn: 2 } },
        { type: "agent/inbox/spliced", data: { removedCount: 1, inserted: [msg] } },
        { type: "turn/end", data: { turn: 3, reason: { kind: "blocked" } } },
      ],
    },
  ];
}

/**
 * Bản gấp SAI lệch ĐÚNG MỘT CHỖ (không reset `droppedUnrun` khi gặp `turn/end`) — dùng cho
 * ĐỐI CHỨNG ÂM của chính test.
 * Nhận: `events` — nhật ký.
 * Trả: cùng hình dạng kết cục nhưng sai ở `droppedUnrun`.
 */
function foldBugged(events: readonly FoldEvent[]): { end?: FoldEvent; droppedUnrun: boolean } {
  const stepped = new Set<unknown>();
  const claimed = new Set<unknown>();
  let open: unknown;
  let end: FoldEvent | undefined;
  let droppedUnrun = false;
  for (const event of events) {
    if (event.type === "turn/start") open = event.data.turn;
    else if (event.type === "step/start") stepped.add(event.data.turn);
    else if (event.type === "agent/inbox/spliced") {
      if (event.data.removedCount === undefined) continue;
      if (event.data.outcome === "canceled") droppedUnrun ||= (event.data.inserted as unknown[]).length === 0;
      else if (open !== undefined) claimed.add(open);
    } else if (event.type === "turn/end") {
      const { turn, reason } = event.data;
      open = undefined;
      const accounts = (reason as { kind: string }).kind !== "completed";
      if (stepped.delete(turn) || (claimed.delete(turn) && accounts)) end = event;
    }
  }
  return end === undefined ? { droppedUnrun } : { end, droppedUnrun };
}

describe("row agent · artifact + bước 0", () => {
  test("tập export = gốc trên ARTIFACT (tên gói ĐÚNG @deepseek-ai/dsh-agent) · 0 thiếu · 0 thừa · MỘT MẶT", () => {
    expect(oursManifest.name).toBe("@galaxy-blackhole/gbh-agent");
    expect(stockManifest.name).toBe(STOCK_PACKAGE);
    const ours = exportNames(oursCode);
    const theirs = exportNames(stockCode);
    expect(exportGaps(ours, theirs)).toEqual({ missing: [], extra: [] });
    expect([...ours].sort()).toEqual([
      "AgentRegistry",
      "agentCarrier",
      "agentEvents",
      "assembleContextFor",
      "default",
      "emitAgentEvent",
      "foldConsumedWork",
      "installModelSelection",
    ]);
    // Không bundle module nào: row HOST thuần, và KHÔNG đăng ký id nào (không có chỗ cho id stock).
    expect(oursCode.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(existsSync(join(PKG_DIR, "lib", "client.js"))).toBe(false);
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
    expect(stockManifest.dsh?.client).toBeUndefined();
    expect(oursManifest.dsh).toBeUndefined();
    // Danh tính export mặc định + cùng bộ phương thức prototype.
    expect(sides.ours.module.default).toBe(sides.ours.module.AgentRegistry);
    expect(sides.stock.module.default).toBe(sides.stock.module.AgentRegistry);
    const oursProto = Object.getOwnPropertyNames(sides.ours.module.AgentRegistry.prototype).sort();
    const stockProto = Object.getOwnPropertyNames(sides.stock.module.AgentRegistry.prototype).sort();
    expect(oursProto).toEqual(stockProto);
  });

  test("build.ts nhận thư mục đích qua process.argv[2]", () => {
    const target = mkdtempSync(join(tmpdir(), "gbh-agent-build-"));
    const out = join(target, "profile-lib");
    const run = spawnSync(process.execPath, [join(PKG_DIR, "build.ts"), out], { cwd: PKG_DIR, encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(existsSync(join(out, "index.js"))).toBe(true);
    expect(exportNames(readFileSync(join(out, "index.js"), "utf8")).has("AgentRegistry")).toBe(true);
    rmSync(target, { recursive: true, force: true });
  });

  test("bước 0 trên DUMP mới nhất: cặp - id: agent + name @deepseek-ai/dsh-agent, KHÔNG disabled/config/inject", () => {
    const dumps = join(ROOT, ".parity", "dumps");
    const latest = existsSync(dumps) ? readdirSync(dumps).sort().pop() : undefined;
    if (latest === undefined) return; // dump là artefact cục bộ (bị gitignore) — không có thì không dựng ca
    const oursYml = readFileSync(join(dumps, latest, "ours.yml"), "utf8");
    const lines = oursYml.split("\n");
    const at = lines.findIndex((line) => line.trim() === "- id: agent");
    expect(at).toBeGreaterThanOrEqual(0);
    expect((lines[at + 1] ?? "").trim()).toBe("name: '" + STOCK_PACKAGE + "'");
    const rest: string[] = [];
    for (let i = at + 2; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (line.startsWith("- ")) break;
      rest.push(line.trim());
    }
    // Dòng chú thích giữa các row (vd "# == @deepseek-ai/dsh-base") KHÔNG phải khoá của row.
    expect(rest.filter((line) => line !== "" && !line.startsWith("#"))).toEqual([]);
  });
});

describe("phép gấp consumed-work", () => {
  test("ma trận nhật ký: ta = gốc trên MỌI ca, và end là ĐÚNG vật sự kiện", () => {
    for (const item of foldMatrix()) {
      const ours = foldTrace(sides.ours, item.events);
      const stock = foldTrace(sides.stock, item.events);
      expect({ case: item.name, ...ours }).toEqual({ case: item.name, ...stock });
      // `end` phải là CHÍNH sự kiện trong nhật ký (không chép ra vật mới).
      const result = sides.ours.module.foldConsumedWork(item.events);
      if (result.end !== undefined) expect(item.events.includes(result.end as FoldEvent)).toBe(true);
    }
  });

  test("ĐỐI CHỨNG ÂM: bản gấp lệch MỘT chỗ (không reset droppedUnrun) phải KHÁC ta ở ca đã chọn", () => {
    const events: FoldEvent[] = [
      { type: "turn/start", data: { turn: 1 } },
      { type: "step/start", data: { turn: 1 } },
      { type: "agent/inbox/spliced", data: { removedCount: 1, outcome: "canceled", inserted: [] } },
      { type: "turn/end", data: { turn: 1, reason: { kind: "blocked" } } },
    ];
    const ours = foldTrace(sides.ours, events);
    const bugged = foldBugged(events);
    expect(ours).toEqual({ endType: "turn/end", endIndex: 3, droppedUnrun: false });
    expect(bugged.droppedUnrun).toBe(true);
    expect(ours.droppedUnrun).not.toBe(bugged.droppedUnrun);
  });

  test("C6 DANH TÍNH: mỗi lần gấp trả vật MỚI — sửa vật này không lan sang vật kia", () => {
    const events: FoldEvent[] = [{ type: "turn/start", data: { turn: 1 } }];
    const first = sides.ours.module.foldConsumedWork(events) as { end?: unknown; droppedUnrun: boolean };
    const second = sides.ours.module.foldConsumedWork(events) as { end?: unknown; droppedUnrun: boolean };
    expect(first).not.toBe(second);
    first.droppedUnrun = true;
    expect(second.droppedUnrun).toBe(false);
    const stockFirst = sides.stock.module.foldConsumedWork(events) as { end?: unknown; droppedUnrun: boolean };
    const stockSecond = sides.stock.module.foldConsumedWork(events) as { end?: unknown; droppedUnrun: boolean };
    expect(stockFirst).not.toBe(stockSecond);
    expect(second).toEqual(stockSecond);
  });
});

describe("dispatch + lắp prompt", () => {
  test("agentCarrier / assembleContextFor: cùng hành vi, danh tính ĐỘC LẬP, khoá là chính agent", () => {
    for (const side of [sides.ours, sides.stock]) {
      const { agent } = makeAgent("a-" + side.label);
      const carrier = side.module.agentCarrier(agent);
      const carrierAgain = side.module.agentCarrier(agent);
      expect(scope.isScopeCarrier(carrier)).toBe(true);
      expect(scope.carrierKeyOf(carrier)).toBe(agent);
      expect(scope.carrierKeyOf(carrierAgain)).toBe(agent);
      expect(carrier).not.toBe(carrierAgain);
      const plain = side.module.assembleContextFor(agent) as Record<string, unknown>;
      expect(plain.agent).toBe(agent);
      expect(plain.scope).toBe(agent);
      expect(Object.keys(plain).sort()).toEqual(["agent", "scope"]);
      const controller = new AbortController();
      const signalled = side.module.assembleContextFor(agent, controller.signal) as Record<string, unknown>;
      expect(signalled.signal).toBe(controller.signal);
      expect(signalled).not.toBe(plain);
      expect(Object.keys(signalled).sort()).toEqual(["agent", "scope", "signal"]);
    }
  });

  test("agentEvents emit: chèn agent vào payload, gọi MỌI người nghe, bao lỗi ném/reject; emitAgentEvent đi cùng một đường", async () => {
    const traces: unknown[] = [];
    for (const side of [sides.ours, sides.stock]) {
      const { ctx } = await bootRegistry(side);
      const { surface, warns } = dispatchSurface(ctx);
      const { agent } = makeAgent("d-" + side.label);
      const seen: unknown[] = [];
      ctx.on("agent/t", function (this: unknown, payload: unknown) {
        const typed = payload as { x?: unknown; agent?: unknown };
        seen.push({ which: "ok", payload: { x: typed.x, agentSame: typed.agent === agent }, carrier: scope.carrierKeyOf(this) === agent });
      });
      ctx.on("agent/t", () => {
        seen.push({ which: "throw" });
        throw new Error("nổ");
      });
      ctx.on("agent/t", () => {
        seen.push({ which: "reject" });
        return Promise.reject(new Error("từ chối"));
      });
      side.module.agentEvents(surface, agent).emit("agent/t", { x: 1 });
      await waitFor(() => (warns.length >= 2 ? true : undefined), side.label + ": warn đủ 2");
      side.module.emitAgentEvent(surface, agent, "agent/u", { y: 2 });
      traces.push({ seen, warns: [...warns].sort(), carrierKeys: (seen[0] as { carrier?: unknown } | undefined)?.carrier });
    }
    expect(traces[0]).toEqual(traces[1]);
  });

  test("agentEvents serial + waterfall: thứ tự, bail, và payload hợp nhất", async () => {
    const traces: unknown[] = [];
    for (const side of [sides.ours, sides.stock]) {
      const { ctx } = await bootRegistry(side);
      const { surface } = dispatchSurface(ctx);
      const { agent } = makeAgent("s-" + side.label);
      const order: string[] = [];
      ctx.on("agent/serial", (payload: unknown) => {
        const typed = payload as { n?: unknown; agent?: unknown };
        order.push("first:" + String(typed.n) + ":" + String(typed.agent === agent));
        return undefined;
      });
      ctx.on("agent/serial", (payload: unknown) => {
        const typed = payload as { n?: unknown; agent?: unknown };
        order.push("second:" + String(typed.n) + ":" + String(typed.agent === agent));
        return "bail";
      });
      ctx.on("agent/serial", () => {
        order.push("third");
        return undefined;
      });
      const serial = await side.module.agentEvents(surface, agent).serial("agent/serial", { n: 1 });
      ctx.on("agent/wf", async (payload: unknown, next: () => Promise<string>) => {
        const inner = await next();
        const typed = payload as { n?: unknown; agent?: unknown };
        return "outer(" + inner + ")" + String(typed.n) + ":" + String(typed.agent === agent);
      });
      ctx.on("agent/wf", async (payload: unknown, next: () => Promise<string>) => {
        const inner = await next();
        const typed = payload as { n?: unknown; agent?: unknown };
        return "inner(" + inner + ")" + String(typed.n) + ":" + String(typed.agent === agent);
      });
      const waterfall = side.module.agentEvents(surface, agent).waterfall(
        "agent/wf",
        { n: 2 },
        () => Promise.resolve("base"),
      );
      traces.push({ serial, order, waterfall });
    }
    expect(traces[0]).toEqual(traces[1]);
  });
});

/**
 * Bắt kết cục của một phép gọi BẤT ĐỒNG BỘ thành chuỗi so được.
 * Nhận: `operation` — phép gọi trả promise.
 * Trả: `OK:<json>` hoặc `THROW:<thông điệp>`.
 */
async function captureAsync(operation: () => Promise<unknown>): Promise<string> {
  try {
    return "OK:" + JSON.stringify(await operation());
  } catch (error) {
    return "THROW:" + String((error as { message?: unknown }).message);
  }
}

/**
 * Rút payload sự kiện tạo về hình dạng so được (bỏ chính vật agent).
 * Nhận: `payload` — payload `agent/created`.
 * Trả: `{ agentId, source, hasSignal, signalSame }`.
 */
function stripCreated(payload: unknown, signal?: AbortSignal): Record<string, unknown> {
  const typed = payload as { agent?: { id?: string }; source?: string; signal?: unknown };
  return {
    agentId: typed.agent?.id,
    source: typed.source,
    hasSignal: "signal" in (typed as object),
    signalSame: typed.signal === signal,
  };
}

/**
 * Chạy CÙNG một kịch bản đăng ký/công bố trên một bản và ghi lại dấu vết.
 * Nhận: `side` — bản cần chạy.
 * Trả: dấu vết JSON so được với bản kia.
 */
async function registryScenario(side: Side): Promise<Record<string, unknown>> {
  const { ctx, registry } = await bootRegistry(side);
  const trace: Record<string, unknown> = {};
  trace.fresh = {
    list: registry.list().length,
    roots: registry.roots().length,
    get: registry.get("nope") === undefined,
    initiator: registry.currentInitiator() === undefined,
    requireInitiator: capture(() => registry.requireInitiator()),
  };
  const { agent: root } = makeAgent("r1");
  const { agent: child } = makeAgent("r2");
  const detachRoot = registry.enter(root, undefined);
  trace.enterRoot = {
    detach: typeof detachRoot,
    get: registry.get("r1") === root,
    list: registry.list().length,
    roots: registry.roots().length,
    owned: registry.isOwnedBy("r1", root),
  };
  const detachChild = registry.enter(child, root);
  trace.enterChild = {
    owned: registry.isOwnedBy("r2", root),
    ownedByOther: registry.isOwnedBy("r2", child),
    roots: registry.roots().length,
    list: registry.list().length,
  };
  trace.duplicate = capture(() => registry.enter(root, undefined));
  const { agent: mismatch } = makeAgent("r3", { sessionId: "s3" });
  trace.mismatch = capture(() => registry.enter(mismatch, undefined));
  const created: unknown[] = [];
  const controller = new AbortController();
  ctx.on("agent/created", (payload: unknown) => {
    created.push(stripCreated(payload, controller.signal));
  });
  await registry.announce(root, "resume", controller.signal);
  trace.announced = { created, get: registry.get("r1") === root };
  trace.announceAgain = await captureAsync(() => registry.announce(root, "startup"));
  const disposed: unknown[] = [];
  ctx.on("agent/disposed", function (this: unknown, payload: unknown) {
    disposed.push({ agentId: (payload as { agent?: { id?: string } }).agent?.id, carrierKey: scope.carrierKeyOf(this) === (payload as { agent?: unknown }).agent });
  });
  detachChild();
  detachChild();
  trace.detachedUnannounced = { disposed: [...disposed], get: registry.get("r2") === undefined, list: registry.list().length };
  const { agent: late } = makeAgent("r4");
  const detachLate = registry.enter(late, undefined);
  detachLate();
  trace.announceNotLive = await captureAsync(() => registry.announce(late, "startup"));
  const { agent: doomed } = makeAgent("r5");
  const detachDoomed = registry.enter(doomed, undefined);
  ctx.on("agent/created", (payload: unknown) => {
    if ((payload as { agent?: { id?: string } }).agent?.id === "r5") detachDoomed();
  });
  await registry.announce(doomed, "startup");
  trace.detachDuringAnnounce = { disposed: [...disposed], get: registry.get("r5") === undefined, list: registry.list().length };
  const { agent: afterDetach } = makeAgent("r6");
  const detachAfter = registry.enter(afterDetach, undefined);
  await registry.announce(afterDetach, "clear");
  detachAfter();
  trace.disposedAnnounced = disposed.slice(-1);
  detachAfter();
  trace.disposedOnce = disposed.filter((item) => (item as { agentId?: string }).agentId === "r6").length;
  return trace;
}

/**
 * Chạy CÙNG một kịch bản factory + initiator + rút cạn lúc dọn trên một bản.
 * Nhận: `side` — bản cần chạy.
 * Trả: dấu vết JSON so được với bản kia.
 */
async function factoryScenario(side: Side): Promise<Record<string, unknown>> {
  const { ctx, registry, fiber } = await bootRegistry(side);
  const calls: unknown[] = [];
  const handle = { agent: { id: "made" }, dispose: async () => undefined };
  const factory = {
    createAgent(this: unknown, ownerCtx: unknown, options: unknown) {
      calls.push({ method: "create", ownerFiberIsPlugin: (ownerCtx as { fiber?: unknown }).fiber === fiber, thisIsFactory: this === factory, options });
      return Promise.resolve(handle);
    },
    resume(this: unknown, ownerCtx: unknown, options: unknown) {
      calls.push({ method: "resume", ownerFiberIsPlugin: (ownerCtx as { fiber?: unknown }).fiber === fiber, thisIsFactory: this === factory, options });
      return Promise.resolve(handle);
    },
  };
  const disposeFactory = registry.setFactory(factory);
  const created = await registry.create({ sessionId: "made", meta: { cwd: "/tmp" } });
  const resumed = await registry.resume({ resumeSessionId: "made" });
  const duplicate = capture(() => registry.setFactory(factory));
  disposeFactory();
  const missing = await captureAsync(() => registry.create({ sessionId: "made" }));
  const { agent } = makeAgent("i1");
  const { agent: other } = makeAgent("i2");
  const seen: unknown[] = [];
  const syncValue = registry.withInitiator(agent, () => {
    seen.push({ current: registry.currentInitiator() === agent, required: registry.requireInitiator() === agent });
    return "v";
  });
  const nested = registry.withInitiator(agent, () => registry.withInitiator(other, () => registry.currentInitiator() === other));
  const cleared = registry.withoutInitiator(() => registry.currentInitiator() === undefined);
  const asyncValue = await registry.withInitiator(agent, async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return registry.currentInitiator() === agent;
  });
  const thrown = capture(() => registry.withInitiator(agent, () => {
    throw new Error("hỏng");
  }));
  const outside = registry.currentInitiator() === undefined;
  let released = false;
  const pending = registry.withInitiator(agent, () => new Promise<void>((resolve) => {
    setTimeout(() => {
      released = true;
      resolve();
    }, 50);
  }));
  await fiber.dispose();
  const releasedAtDispose = released;
  await pending;
  return {
    calls,
    createdIsHandle: created === handle,
    resumedIsHandle: resumed === handle,
    duplicate,
    missing,
    syncValue,
    seen,
    nested,
    cleared,
    asyncValue,
    thrown,
    outside,
    releasedAtDispose,
    afterDispose: {
      withInitiator: capture(() => registry.withInitiator(agent, () => "x")),
      current: capture(() => registry.currentInitiator()),
    },
  };
}

describe("sổ đăng ký agent", () => {
  test("đăng ký · công bố · gỡ · lỗi: ta = gốc TỪNG trường", async () => {
    const ours = await registryScenario(sides.ours);
    const stock = await registryScenario(sides.stock);
    expect(ours).toEqual(stock);
    expect(ours.announced).toBeDefined();
    expect((ours.detachDuringAnnounce as { disposed: unknown[] }).disposed.length).toBeGreaterThan(0);
  });

  test("factory · initiator · rút cạn lúc dọn: ta = gốc TỪNG trường", async () => {
    const ours = await factoryScenario(sides.ours);
    const stock = await factoryScenario(sides.stock);
    expect(ours).toEqual(stock);
    // `this` trong factory phải là CHÍNH factory (ownerCtx được truyền làm tham số, không làm receiver).
    expect(ours.calls).toEqual([
      { method: "create", ownerFiberIsPlugin: false, thisIsFactory: true, options: { sessionId: "made", meta: { cwd: "/tmp" } } },
      { method: "resume", ownerFiberIsPlugin: false, thisIsFactory: true, options: { resumeSessionId: "made" } },
    ]);
    expect(ours.duplicate).toBe("THROW:an agent factory is already registered");
    expect(ours.missing).toBe("THROW:no agent factory registered (load an agent-loop plugin)");
    expect(ours.releasedAtDispose).toBe(true);
  });
});

/** Một tuyến provider/model dùng trong kịch bản chọn model. */
interface Route {
  /** Tuyến provider. */
  provider: string;
  /** Id model. */
  model: string;
  /** Mức suy luận tuỳ chọn. */
  reasoningEffort?: string;
}

/**
 * Chạy CÙNG một kịch bản chọn model trên một bản và ghi lại dấu vết.
 * Nhận: `side` — bản cần chạy.
 * Trả: danh sách dấu vết JSON so được với bản kia.
 */
async function modelSelectionScenario(side: Side): Promise<unknown[]> {
  const { ctx } = await bootRegistry(side);
  const selection: { current: Route | undefined; assembled: Route | undefined } = { current: undefined, assembled: undefined };
  const results: unknown[] = [];
  let outerSeen = -1;
  ctx.on("agent/pre-step", async (payload: unknown, next: () => Promise<unknown>) => {
    const decision = (await next()) as { messages?: unknown[] };
    outerSeen = decision.messages?.length ?? -1;
    return decision;
  });
  const dispose = side.module.installModelSelection(ctx, selection);
  const base = { sections: [], contexts: [], tools: [], variables: { keep: "yes" } };
  const assemble = async (current: Route | undefined): Promise<unknown> => {
    selection.current = current;
    return await ctx.waterfall("system-prompt/assemble", base, {}, () => Promise.resolve(base));
  };
  const assembly = await assemble({ provider: "p1", model: "m1" });
  results.push({ name: "assemble", assembly, assembled: selection.assembled, assembledIsCurrent: selection.assembled === selection.current });
  const request = await ctx.waterfall(
    "agent/request",
    { agent: {}, turn: 1, step: 1, signal: new AbortController().signal },
    () => Promise.resolve({ provider: "old", model: "old", reasoningEffort: "high", temperature: 0.2 }),
  );
  results.push({ name: "request", request });
  await assemble({ provider: "p1", model: "m1", reasoningEffort: "low" });
  const requestEffort = await ctx.waterfall(
    "agent/request",
    {},
    () => Promise.resolve({ provider: "old", model: "old", reasoningEffort: "high" }),
  );
  results.push({ name: "request-effort", requestEffort });
  await assemble(undefined);
  const requestPass = await ctx.waterfall(
    "agent/request",
    {},
    () => Promise.resolve({ provider: "old", model: "old", reasoningEffort: "high", keep: true }),
  );
  results.push({ name: "request-passthrough", requestPass, assembled: selection.assembled });
  const userMessage = (id: string): Record<string, unknown> => ({ id, role: "user", content: [], source: { kind: "user" } });
  const cases: {
    name: string;
    current: Route | undefined;
    header: { provider: string; model: string } | undefined;
    messages: Record<string, unknown>[];
    step: number;
    reject?: boolean;
    aborted?: boolean;
  }[] = [
    { name: "đổi route", current: { provider: "p1", model: "m1" }, header: { provider: "p0", model: "m0" }, messages: [], step: 2 },
    { name: "cùng route", current: { provider: "p1", model: "m1" }, header: { provider: "p1", model: "m1" }, messages: [], step: 2 },
    { name: "bước 1 rỗng", current: { provider: "p1", model: "m1" }, header: { provider: "p0", model: "m0" }, messages: [], step: 1 },
    { name: "có thông điệp", current: { provider: "p1", model: "m1" }, header: { provider: "p0", model: "m0" }, messages: [userMessage("x")], step: 1 },
    { name: "từ chối", current: { provider: "p1", model: "m1" }, header: { provider: "p0", model: "m0" }, messages: [], step: 2, reject: true },
    { name: "đã huỷ", current: { provider: "p1", model: "m1" }, header: { provider: "p0", model: "m0" }, messages: [], step: 2, aborted: true },
    { name: "chưa có header", current: { provider: "p1", model: "m1" }, header: undefined, messages: [], step: 2 },
    { name: "chưa chọn model", current: undefined, header: { provider: "p0", model: "m0" }, messages: [], step: 2 },
    { name: "chỉ đổi effort", current: { provider: "p1", model: "m1", reasoningEffort: "low" }, header: { provider: "p1", model: "m1" }, messages: [], step: 2 },
  ];
  for (const item of cases) {
    await assemble(item.current);
    outerSeen = -1;
    const controller = new AbortController();
    if (item.aborted === true) controller.abort();
    const { agent } = makeAgent("ms", item.header === undefined ? {} : { header: item.header });
    const decision = item.reject === true ? { kind: "reject" } : { kind: "enter", messages: item.messages };
    const result = (await ctx.waterfall(
      "agent/pre-step",
      { agent, messages: item.messages, turn: 1, step: item.step, signal: controller.signal },
      () => Promise.resolve(decision),
    )) as { kind: string; messages?: unknown[] };
    results.push({
      name: item.name,
      kind: result.kind,
      messages: (result.messages ?? []).map(stripMessage),
      outerSeen,
    });
  }
  dispose();
  selection.current = { provider: "p9", model: "m9" };
  const afterDispose = await ctx.waterfall("system-prompt/assemble", base, {}, () => Promise.resolve(base));
  results.push({ name: "after-dispose", afterDispose, assembled: selection.assembled });
  return results;
}

/**
 * Chạy CÙNG một kịch bản nhận lưu trữ trên một bản.
 * Nhận: `side` — bản cần chạy.
 * Trả: dấu vết JSON so được với bản kia.
 */
async function archiveScenario(side: Side): Promise<Record<string, unknown>> {
  const { ctx, registry } = await bootRegistry(side);
  const { agent: running, cancels: runningCancels } = makeAgent("run", { status: "running" });
  const { agent: idle, cancels: idleCancels } = makeAgent("idle", { status: "idle" });
  registry.enter(running, undefined);
  registry.enter(idle, undefined);
  const active = await ctx.waterfall("workspace/session-activity", { sessionId: "run" }, () => Promise.resolve([]));
  const idleKinds = await ctx.waterfall("workspace/session-activity", { sessionId: "idle" }, () => Promise.resolve([{ kind: "other" }]));
  const missingKinds = await ctx.waterfall("workspace/session-activity", { sessionId: "ghost" }, () => Promise.resolve([]));
  ctx.emit("workspace/session-stop", { sessionId: "run" });
  ctx.emit("workspace/session-stop", { sessionId: "idle" });
  ctx.emit("workspace/session-stop", { sessionId: "ghost" });
  return { active, idleKinds, missingKinds, runningCancels, idleCancels };
}

describe("chọn model + nhận lưu trữ", () => {
  test("installModelSelection: lắp prompt · định tuyến · thông báo đổi tuyến — ta = gốc TỪNG ca", async () => {
    const ours = await modelSelectionScenario(sides.ours);
    const stock = await modelSelectionScenario(sides.stock);
    expect(ours).toEqual(stock);
    const changed = ours.find((item) => (item as { name?: string }).name === "đổi route") as {
      messages: { role: unknown; content: unknown; source: unknown; frozen: boolean }[];
    };
    expect(changed.messages.length).toBe(1);
    expect(changed.messages[0]?.role).toBe("user");
    expect(changed.messages[0]?.frozen).toBe(true);
    expect(changed.messages[0]?.source).toMatchObject({ kind: "model-selection", form: "notice" });
    // prepend: listener NGOÀI (đăng ký trước) thấy quyết định TRƯỚC khi thông báo được thêm —
    // nên số thông điệp nó thấy đúng bằng số ĐẦU VÀO, không phải số sau khi chèn thông báo.
    const byName = (name: string): number => (ours.find((item) => (item as { name?: string }).name === name) as { outerSeen: number }).outerSeen;
    expect(byName("đổi route")).toBe(0);
    expect(byName("có thông điệp")).toBe(1);
  });

  test("installTurnArchiveAdmission: họ turn chỉ khi agent đang chạy · stop huỷ như người dùng — ta = gốc", async () => {
    const ours = await archiveScenario(sides.ours);
    const stock = await archiveScenario(sides.stock);
    expect(ours).toEqual(stock);
    expect(ours.active).toEqual([{ kind: "turn" }]);
    expect(ours.idleKinds).toEqual([{ kind: "other" }]);
    expect(ours.missingKinds).toEqual([]);
    expect(ours.runningCancels).toEqual([{ cause: { kind: "user" } }]);
    expect(ours.idleCancels).toEqual([]);
  });
});

describe("manifest · locale · danh tính", () => {
  
  test("000e: locale/{en,zh}.json BYTE-FOR-BYTE với bản gốc", () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG_DIR, "locale", name));
      const stock = readFileSync(join(STOCK_DIR, "locale", name));
      expect(ours.equals(stock)).toBe(true);
      expect(ours.toString("utf8")).toBe(stock.toString("utf8"));
    }
    expect(Object.keys(oursManifest as { exports?: Record<string, unknown> }).length).toBeGreaterThan(0);
    expect((oursManifest as { exports?: Record<string, unknown> }).exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });

  test("C6 DANH TÍNH: hai sổ đăng ký ĐỘC LẬP · list() trả mảng MỚI · hai lựa chọn model không chia sẻ assembled", async () => {
    for (const side of [sides.ours, sides.stock]) {
      const first = await bootRegistry(side);
      const second = await bootRegistry(side);
      const { agent: same } = makeAgent("same");
      first.registry.enter(same, undefined);
      second.registry.enter(same, undefined);
      expect(first.registry.list().length).toBe(1);
      expect(second.registry.list().length).toBe(1);
      const snapshot = first.registry.list();
      snapshot.push({});
      expect(first.registry.list().length).toBe(1);
      expect(snapshot).not.toBe(first.registry.list());
      const selA: { current: Route | undefined; assembled: Route | undefined } = { current: { provider: "a", model: "a" }, assembled: undefined };
      const selB: { current: Route | undefined; assembled: Route | undefined } = { current: { provider: "b", model: "b" }, assembled: undefined };
      const disposeA = side.module.installModelSelection(first.ctx, selA);
      const disposeB = side.module.installModelSelection(second.ctx, selB);
      const base = { variables: {} };
      await first.ctx.waterfall("system-prompt/assemble", base, {}, () => Promise.resolve(base));
      await second.ctx.waterfall("system-prompt/assemble", base, {}, () => Promise.resolve(base));
      expect(selA.assembled).not.toBe(selB.assembled);
      expect(selA.assembled).toEqual({ provider: "a", model: "a" });
      expect(selB.assembled).toEqual({ provider: "b", model: "b" });
      disposeA();
      disposeB();
    }
  });

  test("ĐỐI CHỨNG ÂM của chính test: sửa MỘT chỗ trong artifact ⇒ phép so export PHẢI báo đỏ", () => {
    const theirs = exportNames(stockCode);
    expect(exportGaps(exportNames(oursCode), theirs)).toEqual({ missing: [], extra: [] });
    const mutated = oursCode
      .replace(/ {2}foldConsumedWork,\n/, "")
      .replace("export {", "export const extraExport = 1;\nexport {");
    const gaps = exportGaps(exportNames(mutated), theirs);
    expect(gaps.missing).toEqual(["foldConsumedWork"]);
    expect(gaps.extra).toEqual(["extraExport"]);
  });
});



