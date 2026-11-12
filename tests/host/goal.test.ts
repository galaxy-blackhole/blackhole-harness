/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-goal (row goal): bước 0 đọc CẶP row trong dump mới
 *      nhất + TEST CANH gbh.row mirror ĐÚNG dump (chỉ id + tests, không disabled/insertDisabled/
 *      config/inject); đo TẬP EXPORT trên ARTIFACT (10 = 10, so với tên gói gốc ĐÚNG
 *      @deepseek-ai/dsh-goal); chạy CẢ HAI bản cài (ta + chính bundle gốc) trên Context cordis THẬT
 *      cùng một giàn giả rồi so vết gọi + thông điệp lỗi; so schema/decoder từng ký tự; ca C6
 *      (DANH TÍNH); ca waitFor CÓ TRẦN; quy ước gbh.peers ⊆ peerDependencies (so PHẦN TỬ + 3 ĐỐI
 *      CHỨNG ÂM); luật 000e; và ĐỐI CHỨNG ÂM của chính các phép so.
 */

import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/goal/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "goal");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-goal");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG package để packages="external" phân giải được peer. */
const OUT = join(PKG, ".test-lib");
/** cordis của kernel (Context THẬT cho cả hai giàn). */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Sổ chiếu phiên của kernel — dùng CHUNG cho hai giàn để cô lập ĐÚNG MỘT biến: miền goal. */
const STOCK_REGISTRY = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session-projection", "lib", "index.js");

/** Một khung nhìn goal (đúng hình dạng ARTIFACT trả về). */
interface ViewLike {
  /** Danh tính. */
  id: string;
  /** Revision. */
  revision: number;
  /** Mục tiêu. */
  objective: string;
  /** Pha. */
  phase: string;
  /** Trần vòng. */
  maxGoalRounds: number;
  /** Lý do chặn (có khi blocked). */
  blockedReason?: { code: string; message: string };
  /** Vòng đã nhận. */
  roundsStarted: number;
  /** Mốc tạo. */
  createdAt: number;
  /** Mốc sửa. */
  updatedAt: number;
  /** Quyền tự động. */
  activation: string;
}

/** Tham chiếu goal. */
interface RefLike {
  /** Danh tính. */
  id: string;
  /** Revision. */
  revision: number;
}

/** Trạng thái phép chiếu (đúng hình dạng khoá goal của sổ chiếu). */
interface ProjectionStateLike {
  /** Goal hiện tại. */
  current: unknown;
  /** Id đã thấy. */
  seenGoalIds: string[];
  /** Lỗi phát lại. */
  failure: string | null;
}

/** Một sự kiện phiên. */
interface EventLike {
  /** Loại. */
  type: string;
  /** Vị trí. */
  seq: number;
  /** Thân. */
  data?: any;
}

/** Đơn vị chiếu goal (đúng hình dạng seam). */
interface DefinitionLike {
  /** Khoá. */
  key: string;
  /** Phiên bản trạng thái. */
  stateVersion: number;
  /** Schema trạng thái. */
  stateSchema: { parse(value: unknown): ProjectionStateLike };
  /** Trạng thái rỗng. */
  init(): ProjectionStateLike;
  /** Phép gộp. */
  apply(state: ProjectionStateLike, event: EventLike): ProjectionStateLike;
  /** Khung nhìn dây. */
  wire: { viewSchema: { parse(value: unknown): unknown }; view(state: ProjectionStateLike): unknown };
}

/** Bề mặt service mà test gọi (khai theo CẤU TRÚC). */
interface ServiceLike {
  /** Đọc goal. */
  get(agent: unknown): ViewLike | undefined;
  /** Gỡ quyền tự động. */
  disarm(agent: unknown): ViewLike | undefined;
  /** Tạo. */
  create(agent: unknown, request: { objective: string; maxGoalRounds?: number }): ViewLike;
  /** Sửa. */
  edit(agent: unknown, ref: RefLike, request: { objective?: string; maxGoalRounds?: number }): ViewLike;
  /** Tạm dừng. */
  pause(agent: unknown, ref: RefLike): ViewLike;
  /** Chạy tiếp. */
  resume(agent: unknown, ref: RefLike): ViewLike;
  /** Hoàn thành. */
  complete(agent: unknown, ref: RefLike): ViewLike;
  /** Chặn. */
  block(agent: unknown, ref: RefLike, reason: { code: string; message: string }): ViewLike;
  /** Xoá. */
  clear(agent: unknown, ref: RefLike): RefLike;
  /** Tạo qua ranh giới remote. */
  remoteExportCreate(agent: unknown, request: { objective: string; maxGoalRounds?: number }): { ref: RefLike };
}

/** Mô-đun của một bản cài (đúng mười export của bản gốc). */
interface ModuleLike {
  /** Hằng phiên bản thay đổi. */
  GOAL_CHANGE_VERSION: number;
  /** Lớp lỗi miền. */
  GoalError: new (message: string, code: string) => Error & { code: string };
  /** Hàm đóng dấu danh tính. */
  GoalId: (id: string) => string;
  /** Lớp service + cấu hình + inject. */
  GoalService: (new (ctx: unknown, config?: { defaultMaxGoalRounds?: number }) => ServiceLike) & {
    inject: string[];
    Config: unknown;
  };
  /** Export mặc định — CHÍNH lớp đó. */
  default: unknown;
  /** Lái phép chiếu. */
  applyGoalProjection: (state: ProjectionStateLike, event: EventLike) => ProjectionStateLike;
  /** Giải mã thay đổi. */
  decodeGoalChange: (value: unknown) => unknown;
  /** Gộp log. */
  foldGoal: (events: readonly EventLike[]) => unknown;
  /** Đọc tham chiếu của thay đổi. */
  goalChangeRef: (change: unknown) => RefLike;
  /** Đơn vị chiếu goal. */
  goalProjectionDefinition: DefinitionLike;
}

/** Context cordis tối thiểu mà giàn dùng (khai theo CẤU TRÚC). */
interface CordisContext {
  /** Phát sự kiện. */
  emit(name: string, ...args: unknown[]): void;
  /** Nghe sự kiện. */
  on(name: string, listener: (...args: any[]) => unknown): unknown;
  /** Cấp MỘT dịch vụ cho cây. */
  provide(name: string, value: unknown): unknown;
  /** Bộ ghi log (thay warn để bắt chẩn đoán). */
  logger: { warn(message: string): void };
}

/** Phiên giả đúng hình dạng mà sổ chiếu + service đọc. */
class FakeSession {
  /** Log trong bộ nhớ (chỉ số mảng TRÙNG seq). */
  readonly events: EventLike[] = [];
  /** Metadata bất biến. */
  readonly header: { id: string };
  /** Độ dài tiền tố thừa kế. */
  readonly inheritedEventCount = 0;
  /** Context phát session/event. */
  private readonly ctx: CordisContext;
  /** Danh tính phiên. */
  readonly id: string;

  /**
   * Dựng một phiên rỗng.
   * Nhận: ctx - context phát session/event; id - danh tính phiên.
   * Trả: phiên có seq bằng 0.
   */
  constructor(ctx: CordisContext, id: string) {
    this.ctx = ctx;
    this.id = id;
    this.header = { id };
  }

  /** Số sự kiện đã cam kết. */
  get seq(): number {
    return this.events.length;
  }

  /**
   * Nối MỘT sự kiện rồi phát session/event ĐỒNG BỘ (đúng kernel).
   * Nhận: type - loại sự kiện; data - thân sự kiện.
   * Trả: sự kiện đã cam kết.
   */
  append(type: string, data: unknown): EventLike {
    const event: EventLike = { type, seq: this.events.length, data };
    this.events.push(event);
    this.ctx.emit("session/event", this, event);
    return event;
  }

  /**
   * Cắt một đoạn log.
   * Nhận: seq bắt đầu và seq kết thúc KHÔNG tính.
   * Trả: các sự kiện trong khoảng.
   */
  snapshotEvents(from = 0, to: number = this.seq): readonly EventLike[] {
    return this.events.filter((event) => event.seq >= from && event.seq < to);
  }

  /**
   * Tra một sự kiện theo seq.
   * Nhận: seq cần tra.
   * Trả: sự kiện, hoặc undefined khi ngoài log.
   */
  eventAt(seq: number): EventLike | undefined {
    return this.events[seq];
  }
}

/** Sổ agent giả: tra ĐÚNG thể hiện đang sống. */
class FakeAgents {
  /** Bảng id → agent. */
  private readonly live = new Map<string, { id: string; session: FakeSession }>();

  /**
   * Tra agent.
   * Nhận: id - danh tính agent.
   * Trả: thể hiện đang sống, hoặc undefined.
   */
  get(id: string): { id: string; session: FakeSession } | undefined {
    return this.live.get(id);
  }

  /**
   * Đăng ký MỘT agent đang sống.
   * Nhận: agent - agent cần đăng ký.
   * Trả: chính agent đó (tiện nối chuỗi).
   */
  add<T extends { id: string; session: FakeSession }>(agent: T): T {
    this.live.set(agent.id, agent);
    return agent;
  }
}

/** Một giàn thử: context thật + sổ chiếu thật + service của MỘT bản cài. */
interface Rig {
  /** Context cordis thật. */
  ctx: CordisContext;
  /** Sổ chiếu thật (bản kernel, dùng chung cho hai bản cài). */
  registry: { stateOf(session: unknown, key: string): ProjectionStateLike | undefined };
  /** Agent của giàn. */
  agent: { id: string; session: FakeSession };
  /** Service của bản cài. */
  service: ServiceLike;
  /** Vết phát sự kiện của giàn. */
  events: unknown[];
  /** Chẩn đoán bắt được qua logger. */
  warnings: string[];
}

/** Bản cài đã nạp: mô-đun + hàm dựng Context + hàm dựng sổ chiếu. */
interface Install {
  /** Mô-đun của bản cài. */
  mod: ModuleLike;
  /** Hàm dựng Context cordis. */
  Context: new () => CordisContext;
  /** Hàm dựng sổ chiếu của kernel. */
  Registry: new (ctx: unknown) => Rig["registry"];
}

/** Mô-đun GỐC nạp động (chỉ đọc, đường dẫn tính lúc chạy). */
const stock = (await import(STOCK)) as unknown as ModuleLike;
/** Mô-đun CỦA TA — điền trong beforeAll sau khi build ARTIFACT. */
let ours: ModuleLike;
/** Bản cài CỦA TA. */
let OUR: Install;
/** Bản cài GỐC. */
let STOCKED: Install;

beforeAll(async () => {
  const artifact = await buildPackage(OUT);
  ours = (await import(pathToFileURL(artifact).href)) as unknown as ModuleLike;
  const cordis = (await import(CORDIS)) as unknown as { Context: new () => CordisContext };
  const registry = (await import(STOCK_REGISTRY)) as unknown as { SessionProjectionRegistry: new (ctx: unknown) => Rig["registry"] };
  OUR = { mod: ours, Context: cordis.Context, Registry: registry.SessionProjectionRegistry };
  STOCKED = { mod: stock, Context: cordis.Context, Registry: registry.SessionProjectionRegistry };
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không import).
 * Nhận: không.
 * Trả: manifest đã giải mã JSON.
 */
function readManifest(): Record<string, any> {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Record<string, any>;
}

/**
 * Tìm đường dẫn ours.yml của dump MỚI NHẤT.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối tới ours.yml.
 */
function latestOurs(): string {
  const dumps = join(ROOT, ".parity", "dumps");
  const newest = readdirSync(dumps)
    .filter((name) => existsSync(join(dumps, name, "ours.yml")))
    .sort()
    .at(-1);
  if (newest === undefined) throw new Error("không có dump nào");
  return join(dumps, newest, "ours.yml");
}

/**
 * Liệt kê tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: text - nội dung file.
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

/**
 * Chạy MỘT lượt gọi và trả mô tả lỗi thay vì ném.
 * Nhận: run - hàm cần chạy.
 * Trả: chuỗi "TênLỗi: thông điệp" hoặc "(khong nem)".
 */
function errorOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    const value = error as { name?: string; message?: string };
    return String(value.name) + ": " + String(value.message);
  }
}

/**
 * Tên còn THIẾU: phần tử của gbh.peers không có trong peerDependencies (so PHẦN TỬ).
 * Nhận: manifest - manifest của gói.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Record<string, any>): string[] {
  const declared = new Set(Object.keys((manifest["peerDependencies"] ?? {}) as Record<string, string>));
  return ((manifest["gbh"]?.peers ?? []) as string[]).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest - manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Record<string, any>): Record<string, any> {
  return JSON.parse(JSON.stringify(manifest)) as Record<string, any>;
}

/**
 * Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE.
 * Nhận: text - nội dung file.
 * Trả: hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/**
 * Chuẩn hoá một giá trị để so giữa HAI bản cài: danh tính goal và mốc thời gian là NGẪU NHIÊN
 * giữa hai lần chạy, nên thay chúng bằng dấu nhắc trước khi so từng ký tự.
 * Nhận: value - giá trị bất kỳ.
 * Trả: chuỗi JSON đã chuẩn hoá.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (key, raw) => {
    if (key === "createdAt" || key === "updatedAt" || key === "clearedAt") return typeof raw === "number" ? "<time>" : raw;
    if (typeof raw === "string") return raw.replace(/goal-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<goal-id>");
    return raw;
  });
}

/**
 * Dựng một giàn thử: Context THẬT + sổ chiếu THẬT + service của một bản cài.
 * Nhận: install - bản cài cần dựng; config - cấu hình tuỳ chọn cho service.
 * Trả: giàn thử đã có phiên + agent đang sống.
 */
function makeRig(install: Install, config?: { defaultMaxGoalRounds?: number }): Rig {
  const ctx = new install.Context();
  const registry = new install.Registry(ctx);
  const agents = new FakeAgents();
  ctx.provide("agents", agents);
  const warnings: string[] = [];
  ctx.logger.warn = (message: string) => {
    warnings.push(message);
  };
  const service = config === undefined ? new install.mod.GoalService(ctx) : new install.mod.GoalService(ctx, config);
  const session = new FakeSession(ctx, "s1");
  const agent = agents.add({ id: "a1", session });
  ctx.emit("session/created", session);
  ctx.emit("agent/created", { agent });
  const events: unknown[] = [];
  ctx.on("goal/activation-changed", (payload: unknown) => {
    events.push({ kind: "activation", payload });
  });
  ctx.on("goal/changed", (payload: { agent?: { id?: string }; change?: { operation?: string } }) => {
    events.push({ kind: "changed", operation: payload.change?.operation, agentId: payload.agent?.id });
  });
  return { ctx, registry, agent, service, events, warnings };
}

/**
 * Chọn bản cài tương ứng với mô-đun đang chạy.
 * Nhận: mod - mô-đun của một bản cài.
 * Trả: bản cài kèm Context/Registry tương ứng.
 */
function installOf(mod: ModuleLike): Install {
  return mod === stock ? STOCKED : OUR;
}

/** Một bước của kịch bản A/B. */
interface Step {
  /** Nhãn bước. */
  label: string;
  /** Kết quả: giá trị hoặc mô tả lỗi. */
  outcome: unknown;
}

/**
 * Chạy MỘT kịch bản vòng đời đầy đủ trên một giàn (cùng input cho cả hai bản cài).
 * Nhận: mod - bản cài cần chạy.
 * Trả: các bước + vết sự kiện + chẩn đoán.
 */
function runLifecycle(mod: ModuleLike): { steps: Step[]; events: unknown[]; warnings: string[] } {
  const rig = makeRig(installOf(mod));
  const steps: Step[] = [];
  const step = (label: string, run: () => unknown): void => {
    try {
      const value = run();
      steps.push({ label, outcome: value === undefined ? { absent: true } : value });
    } catch (error) {
      steps.push({ label, outcome: errorOf(() => { throw error; }) });
    }
  };
  step("get-empty", () => rig.service.get(rig.agent));
  step("create", () => rig.service.create(rig.agent, { objective: " lam xong " }));
  const created = rig.service.get(rig.agent) as ViewLike;
  step("duplicate-create", () => rig.service.create(rig.agent, { objective: "khac" }));
  step("edit", () => rig.service.edit(rig.agent, { id: created.id, revision: 1 }, { objective: "moi" }));
  step("edit-empty", () => rig.service.edit(rig.agent, { id: created.id, revision: 2 }, {}));
  step("edit-invalid-objective", () => rig.service.edit(rig.agent, { id: created.id, revision: 2 }, { objective: "   " }));
  step("pause", () => rig.service.pause(rig.agent, { id: created.id, revision: 2 }));
  step("resume", () => rig.service.resume(rig.agent, { id: created.id, revision: 3 }));
  step("resume-armed", () => rig.service.resume(rig.agent, { id: created.id, revision: 4 }));
  step("block-invalid-reason", () => rig.service.block(rig.agent, { id: created.id, revision: 4 }, { code: "Bad_Code", message: "x" }));
  step("block", () => rig.service.block(rig.agent, { id: created.id, revision: 4 }, { code: "bad-state", message: " hong " }));
  step("resume-blocked", () => rig.service.resume(rig.agent, { id: created.id, revision: 5 }));
  step("complete", () => rig.service.complete(rig.agent, { id: created.id, revision: 6 }));
  step("clear", () => rig.service.clear(rig.agent, { id: created.id, revision: 7 }));
  step("get-after-clear", () => rig.service.get(rig.agent));
  step("pause-after-clear", () => rig.service.pause(rig.agent, { id: created.id, revision: 8 }));
  step("create-again", () => rig.service.create(rig.agent, { objective: "lan hai", maxGoalRounds: 3 }));
  step("stale-ref", () => rig.service.resume(rig.agent, { id: created.id, revision: 1 }));
  step("max-rounds-invalid", () => rig.service.create(rig.agent, { objective: "x", maxGoalRounds: 0 }));
  step("not-live", () => rig.service.get({ id: "zz", session: rig.agent.session }));
  step("remote-create", () => rig.service.remoteExportCreate(rig.agent, { objective: "remote", maxGoalRounds: 2 }));
  step("disarm", () => rig.service.disarm(rig.agent));
  return { steps, events: rig.events, warnings: rig.warnings };
}

/**
 * Chờ MỘT điều kiện với TRẦN thời gian — không bao giờ treo test.
 * Nhận: predicate - điều kiện; timeoutMs - trần (mặc định 1000ms); stepMs - nhịp thử.
 * Trả: promise hoàn tất khi điều kiện đúng; NÉM khi quá trần.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 1000, stepMs = 10): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("waitFor quá trần " + timeoutMs + "ms");
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
}

/** Kịch bản sự kiện THUẦN (không ngẫu nhiên) cho phép gộp + phép chiếu. */
const SCRIPT: readonly EventLike[] = [
  {
    type: "goal/change",
    seq: 0,
    data: { kind: "goal/change", version: 1, operation: "create", goal: { id: "g1", revision: 1, objective: "o", phase: "active", maxGoalRounds: 2 }, roundsStarted: 0, createdAt: 10, updatedAt: 10 },
  },
  { type: "user/message", seq: 1, data: { source: { kind: "goal", goalId: "g1", revision: 1, round: 1 } } },
  { type: "turn/end", seq: 2, data: {} },
  {
    type: "goal/change",
    seq: 3,
    data: { kind: "goal/change", version: 1, operation: "edit", goal: { id: "g1", revision: 2, objective: "moi", phase: "active", maxGoalRounds: 2 }, roundsStarted: 1, createdAt: 10, updatedAt: 20 },
  },
  { type: "user/message", seq: 4, data: { source: { kind: "goal", goalId: "g1", revision: 2, round: 2 } } },
  {
    type: "goal/change",
    seq: 5,
    data: { kind: "goal/change", version: 1, operation: "clear", cleared: { id: "g1", revision: 3 }, clearedAt: 30 },
  },
  { type: "user/message", seq: 6, data: { source: { kind: "user" } } },
];

describe("bước 0 — bốn phép bắt buộc", () => {
  test("ca 0a: cặp '- id: goal' + name gốc CÓ THẬT trong ours.yml mới nhất, KHÔNG disabled/config/inject", () => {
    const yml = readFileSync(latestOurs(), "utf8").split("\n");
    const at = yml.findIndex((line) => line.trim() === "- id: goal");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(yml[at + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-goal'");
    const end = yml.findIndex((line, index) => index > at && line.startsWith("- "));
    const rowLines = yml
      .slice(at + 1, end < 0 ? yml.length : end)
      .filter((line) => line.trim() !== "" && !line.startsWith("#"))
      .map((line) => line.trim());
    expect(rowLines).toEqual(["name: '@deepseek-ai/dsh-goal'"]);
    expect(rowLines.some((line) => line.includes("disabled:"))).toBe(false);
    expect(rowLines.some((line) => line.includes("config:") || line.includes("inject:"))).toBe(false);
  });

  test("ca 0b: gói gốc MỘT MẶT — lib/client.js KHÔNG tồn tại, manifest gốc KHÔNG có dsh.client", () => {
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
    const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { dsh?: unknown };
    expect(stockManifest.dsh).toBeUndefined();
    expect(readManifest()["dsh"]).toBeUndefined();
  });

  test("ca 0c: TEST CANH gbh.row — ĐÚNG id 'goal' + tests, KHÔNG disabled/insertDisabled/config/inject", () => {
    const manifest = readManifest();
    const row = (manifest["gbh"]?.["row"] ?? {}) as Record<string, unknown>;
    expect(row).toEqual({ id: "goal", tests: ["tests/host/goal.test.ts"] });
    expect(Object.keys(row).sort()).toEqual(["id", "tests"]);
    expect("disabled" in row).toBe(false);
    expect("insertDisabled" in row).toBe(false);
    expect("config" in row).toBe(false);
    expect("inject" in row).toBe(false);
    expect(manifest["gbh"]?.["row_unmounted_ly_do"]).toBeUndefined();
    expect(manifest["exports"]?.["./locale/*.json"]).toBe("./locale/*.json");
    expect(manifest["name"]).toBe("@galaxy-blackhole/gbh-goal");
  });
});

describe("ARTIFACT — khuôn bundle + TẬP EXPORT", () => {
  test("ca 1: tập export ta = tập export gốc (10 = 10, 0 thiếu · 0 thừa) — so với ĐÚNG tên gói gốc", () => {
    const artifact = readFileSync(join(OUT, "index.js"), "utf8");
    const own = exportNames(artifact);
    const reference = exportNames(readFileSync(STOCK, "utf8"));
    expect(reference).toEqual([
      "GOAL_CHANGE_VERSION",
      "GoalError",
      "GoalId",
      "GoalService",
      "applyGoalProjection",
      "decodeGoalChange",
      "default",
      "foldGoal",
      "goalChangeRef",
      "goalProjectionDefinition",
    ]);
    expect(own).toEqual(reference);
    expect(reference.filter((name) => !own.includes(name))).toEqual([]);
    expect(own.filter((name) => !reference.includes(name))).toEqual([]);
    expect(artifact.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(artifact.match(/__ModuleLoader__/g)?.length ?? 0).toBe(0);
    expect(ours.default).toBe(ours.GoalService);
  });

  test("ca 2: ĐỐI CHỨNG ÂM của chính phép so export — đổi MỘT chỗ thì phép so phải BÁO LỆCH", () => {
    const artifact = readFileSync(join(OUT, "index.js"), "utf8");
    const mutated = artifact.replace("GoalService as default", "GoalService as renamedDefault");
    expect(mutated).not.toBe(artifact);
    const own = exportNames(mutated);
    const reference = exportNames(readFileSync(STOCK, "utf8"));
    expect(reference.filter((name) => !own.includes(name))).toEqual(["default"]);
    expect(own.filter((name) => !reference.includes(name))).toEqual(["renamedDefault"]);
  });

  test("ca 3: build.ts nhận process.argv[2] và bề mặt lớp service trùng TỪNG TÊN với gốc", () => {
    expect(readFileSync(join(PKG, "build.ts"), "utf8").includes("process.argv[2]")).toBe(true);
    const names = (mod: ModuleLike): string[] => Object.getOwnPropertyNames(mod.GoalService.prototype).sort();
    expect(names(ours)).toEqual(names(stock));
    expect(ours.GoalService.inject).toEqual(stock.GoalService.inject);
    expect(String(ours.GoalService.Config)).toBe(String(stock.GoalService.Config));
  });
});

describe("PHÉP GỘP + PHÉP CHIẾU — đối chứng với chính bundle gốc", () => {
  test("ca 4: foldGoal + goalChangeRef + decodeGoalChange khớp TỪNG KÝ TỰ trên cùng một log", () => {
    expect(canonical(ours.foldGoal(SCRIPT))).toBe(canonical(stock.foldGoal(SCRIPT)));
    for (const event of SCRIPT) {
      expect(errorOf(() => ours.decodeGoalChange(event.data))).toBe(errorOf(() => stock.decodeGoalChange(event.data)));
    }
    const change = { kind: "goal/change", version: 1, operation: "clear", cleared: { id: "g1", revision: 3 }, clearedAt: 30 };
    expect(canonical(ours.goalChangeRef(change))).toBe(canonical(stock.goalChangeRef(change)));
  });

  test("ca 5: decodeGoalChange — 8 hình dạng hỏng cho CÙNG thông điệp lỗi", () => {
    const broken: unknown[] = [
      { kind: "goal/change", version: 2, operation: "create" },
      { kind: "goal/change", version: 1, operation: "nope" },
      { kind: "goal/change", version: 1, operation: "create", goal: { id: "g", revision: 1, objective: "o", phase: "active", maxGoalRounds: 5 }, roundsStarted: 0, createdAt: 2, updatedAt: 1 },
      { kind: "goal/change", version: 1, operation: "clear", cleared: { id: "g" }, clearedAt: 3 },
      { kind: "goal/change", version: 1, operation: "block", goal: { id: "g", revision: 1, objective: "o", phase: "blocked", maxGoalRounds: 5, blockedReason: { code: "Bad_Code", message: "x" } }, roundsStarted: 0, createdAt: 1, updatedAt: 1 },
      { kind: "goal/change", version: 1, operation: "create", goal: { id: "g", revision: 0, objective: "o", phase: "active", maxGoalRounds: 5 }, roundsStarted: 0, createdAt: 1, updatedAt: 1 },
      { kind: "goal/change", version: 1, operation: "edit", goal: { id: "g", revision: 1, objective: " o ", phase: "active", maxGoalRounds: 5 }, roundsStarted: 0, createdAt: 1, updatedAt: 1 },
      { kind: "goal/change", version: 1, operation: "create" },
    ];
    for (const value of broken) {
      expect(errorOf(() => ours.decodeGoalChange(value))).toBe(errorOf(() => stock.decodeGoalChange(value)));
    }
  });

  test("ca 6: schema trạng thái NGHIÊM — 8 giá trị hỏng cho CÙNG lỗi; giá trị hợp lệ cho CÙNG kết quả", () => {
    const base = {
      current: { goal: { id: "g1", revision: 1, objective: "o", phase: "active", maxGoalRounds: 10 }, roundsStarted: 0, createdAt: 10, updatedAt: 20 },
      seenGoalIds: ["g1"],
      failure: null,
    };
    const broken: unknown[] = [
      { ...base, extra: 1 },
      { ...base, seenGoalIds: ["g1", "g1"] },
      { ...base, seenGoalIds: [] },
      { ...base, current: { ...base.current, updatedAt: 1 } },
      { ...base, current: { ...base.current, roundsStarted: 11 } },
      { ...base, current: { ...base.current, goal: { ...base.current.goal, objective: "" } } },
      { ...base, current: { ...base.current, goal: { ...base.current.goal, phase: "weird" } } },
      { ...base, failure: 3 },
    ];
    for (const value of broken) {
      expect(errorOf(() => ours.goalProjectionDefinition.stateSchema.parse(value))).toBe(errorOf(() => stock.goalProjectionDefinition.stateSchema.parse(value)));
    }
    expect(canonical(ours.goalProjectionDefinition.stateSchema.parse(base))).toBe(canonical(stock.goalProjectionDefinition.stateSchema.parse(base)));
    const view = { goal: { id: "g1", revision: 1, objective: "o", phase: "active", maxGoalRounds: 10, junk: 1 }, roundsStarted: 0, createdAt: 10, updatedAt: 20, extra: 2 };
    expect(canonical(ours.goalProjectionDefinition.wire.viewSchema.parse(view))).toBe(canonical(stock.goalProjectionDefinition.wire.viewSchema.parse(view)));
    expect(JSON.stringify(ours.goalProjectionDefinition.wire.viewSchema.parse(view))).toBe(
      '{"goal":{"id":"g1","revision":1,"objective":"o","phase":"active","maxGoalRounds":10},"roundsStarted":0,"createdAt":10,"updatedAt":20}',
    );
  });

  test("ca 7: applyGoalProjection — cùng vết, CÙNG tham chiếu với sự kiện lạ", () => {
    const run = (mod: ModuleLike): string[] => {
      let state = mod.goalProjectionDefinition.init();
      const trail: string[] = [];
      for (const event of SCRIPT) {
        const before = state;
        state = mod.goalProjectionDefinition.apply(state, event);
        trail.push((Object.is(before, state) ? "same" : "new") + "|" + canonical(state));
      }
      return trail;
    };
    expect(run(ours)).toEqual(run(stock));
    const init = ours.goalProjectionDefinition.init();
    const unrelated: EventLike = { type: "turn/end", seq: 9 };
    expect(ours.goalProjectionDefinition.apply(init, unrelated)).toBe(init);
  });

  test("ca 8: ĐỐI CHỨNG ÂM của chính phép so — lệch MỘT trường trong vết là phép so phải BÁO", () => {
    const trail = SCRIPT.map((event) => canonical(ours.applyGoalProjection(ours.goalProjectionDefinition.init(), event)));
    const mutated = [...trail];
    mutated[0] = (mutated[0] ?? "").replace('"maxGoalRounds":2', '"maxGoalRounds":3');
    expect(mutated).not.toEqual(trail);
  });
});

describe("HÀNH VI A/B — hai bản cài trên CÙNG một giàn", () => {
  test("ca 9: vòng đời đầy đủ (22 bước) — vết bước + vết sự kiện TRÙNG TỪNG KÝ TỰ", () => {
    const left = runLifecycle(ours);
    const right = runLifecycle(stock);
    expect(left.steps.length).toBe(22);
    expect(canonical(left.steps)).toBe(canonical(right.steps));
    expect(canonical(left.events)).toBe(canonical(right.events));
  });

  test("ca 10: ĐỐI CHỨNG ÂM của chính phép so hành vi — đổi MỘT cấu hình là vết phải KHÁC", () => {
    const reference = runLifecycle(stock);
    const baseline = canonical({ label: "create", outcome: reference.steps[1]?.outcome });
    const mutatedRig = makeRig(OUR, { defaultMaxGoalRounds: 1 });
    const created = mutatedRig.service.create(mutatedRig.agent, { objective: " lam xong " });
    expect(canonical({ label: "create", outcome: created })).not.toBe(baseline);
  });

  test("ca 11: vòng đã nhận + failure phát lại — CÙNG thông điệp lỗi", () => {
    const run = (mod: ModuleLike): string[] => {
      const rig = makeRig(installOf(mod));
      const out: string[] = [];
      const created = rig.service.create(rig.agent, { objective: "vong", maxGoalRounds: 2 });
      out.push(canonical(rig.service.get(rig.agent)));
      rig.agent.session.append("user/message", { source: { kind: "goal", goalId: created.id, revision: created.revision, round: 1 } });
      out.push(canonical(rig.service.get(rig.agent)));
      out.push(canonical(rig.service.pause(rig.agent, { id: created.id, revision: created.revision })));
      rig.agent.session.append("user/message", { source: { kind: "goal", goalId: created.id, revision: created.revision, round: 3 } });
      out.push(errorOf(() => rig.service.get(rig.agent)));
      out.push(canonical(rig.registry.stateOf(rig.agent.session, "goal")?.failure));
      return out;
    };
    expect(run(ours)).toEqual(run(stock));
  });

  test("ca 12: ngân sách vòng cạn ⇒ resume bị từ chối với CÙNG thông điệp", () => {
    const run = (mod: ModuleLike): string => {
      const rig = makeRig(installOf(mod));
      const created = rig.service.create(rig.agent, { objective: "mot vong", maxGoalRounds: 1 });
      rig.agent.session.append("user/message", { source: { kind: "goal", goalId: created.id, revision: created.revision, round: 1 } });
      rig.service.pause(rig.agent, { id: created.id, revision: created.revision });
      return errorOf(() => rig.service.resume(rig.agent, { id: created.id, revision: created.revision + 1 }));
    };
    expect(canonical(run(ours))).toBe(canonical(run(stock)));
    expect(run(ours)).toContain("exhausted 1 goal rounds");
  });
});

describe("C6 — DANH TÍNH (không phải giá trị)", () => {
  test("ca 13: init() hai lần là HAI vật độc lập; sửa vật này KHÔNG lan sang vật kia", () => {
    for (const mod of [ours, stock]) {
      const first = mod.goalProjectionDefinition.init();
      const second = mod.goalProjectionDefinition.init();
      expect(first).not.toBe(second);
      expect(first.seenGoalIds).not.toBe(second.seenGoalIds);
      first.seenGoalIds.push("g1");
      expect(second.seenGoalIds).toEqual([]);
    }
  });

  test("ca 14: foldGoal trả BẢN SAO; get() hai lần là hai khung nhìn độc lập", () => {
    const LOG = SCRIPT.slice(0, 5);
    for (const mod of [ours, stock]) {
      const left = mod.foldGoal(LOG) as { goal?: { objective: string } };
      const right = mod.foldGoal(LOG) as { goal?: { objective: string } };
      if (left.goal === undefined || right.goal === undefined) throw new Error("kịch bản phải còn goal");
      expect(left.goal).not.toBe(right.goal);
      left.goal.objective = "bi sua";
      expect(right.goal.objective).toBe("moi");
      const rig = makeRig(installOf(mod));
      rig.service.create(rig.agent, { objective: "x" });
      const first = rig.service.get(rig.agent) as ViewLike;
      const second = rig.service.get(rig.agent) as ViewLike;
      expect(first).not.toBe(second);
      first.objective = "bi sua";
      expect((rig.service.get(rig.agent) as ViewLike).objective).toBe("x");
    }
  });

  test("ca 15: hai giàn cùng bản cài KHÔNG chia sẻ trạng thái", () => {
    const one = makeRig(OUR);
    const two = makeRig(OUR);
    expect(one.registry).not.toBe(two.registry);
    one.service.create(one.agent, { objective: "giàn một" });
    expect(two.service.get(two.agent)).toBeUndefined();
    const created = one.service.get(one.agent) as ViewLike;
    expect(errorOf(() => two.service.pause(two.agent, { id: created.id, revision: 1 }))).toContain("no current goal");
  });
});

describe("PHẠM VI + CỔNG + 000e + flaky", () => {
  test("ca 16: gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + 3 ĐỐI CHỨNG ÂM", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    expect(Object.keys(manifest["dependencies"] ?? {})).toEqual([]);
    const dropOne = cloneManifest(manifest);
    delete dropOne["peerDependencies"]["@deepseek-ai/dsh-scope"];
    expect(missingPeers(dropOne)).toEqual(["@deepseek-ai/dsh-scope"]);
    const dropAll = cloneManifest(manifest);
    dropAll["peerDependencies"] = {};
    expect(missingPeers(dropAll)).toEqual([...(manifest["gbh"]["peers"] as string[])].sort());
    const extra = cloneManifest(manifest);
    extra["gbh"]["peers"] = [...(manifest["gbh"]["peers"] as string[]), "@deepseek-ai/dsh-agent"];
    expect(missingPeers(extra)).toEqual(["@deepseek-ai/dsh-agent"]);
  });

  test("ca 17: locale/{en,zh}.json BYTE-FOR-BYTE so với bản gốc (000e)", () => {
    for (const file of ["en.json", "zh.json"]) {
      const own = readFileSync(join(PKG, "locale", file), "utf8");
      const reference = readFileSync(join(STOCK_DIR, "locale", file), "utf8");
      expect(sha256(own)).toBe(sha256(reference));
      expect(own.length).toBe(reference.length);
    }
  });

  test("ca 18: người nghe goal/changed hỏng BẤT ĐỒNG BỘ — waitFor CÓ TRẦN, ghi log, lượt ghi vẫn xong", async () => {
    const run = async (mod: ModuleLike): Promise<{ warnings: string[]; phase: string }> => {
      const rig = makeRig(installOf(mod));
      rig.ctx.on("goal/changed", () => Promise.reject(new Error("nghe hong")));
      rig.service.create(rig.agent, { objective: "flaky" });
      await waitFor(() => rig.warnings.length >= 1, 1000, 5);
      return { warnings: rig.warnings, phase: (rig.service.get(rig.agent) as ViewLike).phase };
    };
    const left = await run(ours);
    const right = await run(stock);
    expect(left.phase).toBe("active");
    expect(left.warnings).toEqual(right.warnings);
    expect(left.warnings[0]).toContain('agent event "goal/changed" listener rejected: Error: nghe hong');
  });

  test("ca 19: người nghe NÉM ĐỒNG BỘ — bị CHẶN + ghi log, cùng hình dạng với gốc", () => {
    const run = (mod: ModuleLike): string[] => {
      const rig = makeRig(installOf(mod));
      rig.ctx.on("goal/changed", () => {
        throw new Error("dong bo hong");
      });
      rig.service.create(rig.agent, { objective: "sync" });
      return [rig.warnings.join("|"), canonical((rig.service.get(rig.agent) as ViewLike).phase)];
    };
    expect(run(ours)).toEqual(run(stock));
    expect(run(ours)[0]).toContain('agent event "goal/changed" listener threw: Error: dong bo hong');
  });
});
