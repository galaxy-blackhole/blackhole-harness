/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-permission (row permission): tập export + bề mặt lớp
 *      đo trên ARTIFACT, đối chứng TỪNG hành vi với CHÍNH bundle gốc trên Context cordis THẬT
 *      (catalog · current · set · ghim quyền khởi tạo · registerAuto · lệnh /permission · thông điệp
 *      lỗi), ca C6 (DANH TÍNH), ca FLAKY dùng waitFor CÓ TRẦN, quy ước gbh.peers ⊆ peerDependencies
 *      có ĐỐI CHỨNG ÂM, và luật 000e (locale byte-for-byte).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { AUTO_PRESET, CUSTOM_PRESET, PermissionPresetService } from "../../packages/host/permission/src/index.ts";
import { buildPackage } from "../../packages/host/permission/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "permission");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-permission-presets");
/** Bundle GỐC — oracle của mọi phép so hành vi. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis của kernel — CÙNG một thể hiện cho cả hai bản (mọi peer của ta trỏ về đây). */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Artifact của ta (build MỘT lần, mọi ca đo trên chính nó). */
const OUR_ARTIFACT = await buildPackage(OUT);

/** Bảng preset ĐANG CHẠY của app — chép từ `ours.yml` (dump `2026-10-18T01-31-57`, dòng 214–224). */
const RUNNING_PRESETS = {
  "read-only": { sandbox: "read-only", approval: "ask" },
  "workspace-write": { sandbox: "workspace-write", approval: "ask" },
  "danger-full-access": { sandbox: "danger-full-access", approval: "never" },
};

const cordis: any = await import(CORDIS);
const ours: any = await import(OUR_ARTIFACT);
const stock: any = await import(STOCK);
/** Lớp Context của kernel — dùng cho CẢ HAI bản (peer của ta trỏ về chính bản này). */
const ContextCtor: new () => any = cordis.Context;

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/** Một sự kiện phiên đã ghi. */
interface LoggedEvent {
  /** Loại sự kiện. */
  type: string;
  /** Thân sự kiện (giữ NGUYÊN tham chiếu). */
  data: unknown;
}

/** Phiên giả tối thiểu: đúng hình dạng mà setter của kernel và service đọc. */
interface FakeSession {
  /** Định danh phiên (chỉ để đọc log test). */
  readonly id: string;
  /** Nhật ký sự kiện, theo thứ tự ghi. */
  readonly log: LoggedEvent[];
  /** Ghi một sự kiện (giữ nguyên tham chiếu `data`). */
  append(type: string, data: unknown): void;
}

/** Trạng thái núm giả của một phiên — nguồn của seam `sessionProjections.stateOf`. */
interface Knobs {
  /** Payload `permission/preset` cuối. */
  preset: string | null;
  /** Payload `sandbox/mode` cuối. */
  sandbox: string | null;
  /** Payload `approval/policy` cuối. */
  approval: string | null;
  /** Log đã có ranh giới gieo hạt chưa. */
  seeded: boolean;
}

/** Vết mọi thứ service đăng ký lên seam trong một lượt dựng. */
interface Harness {
  /** Trạng thái núm theo phiên. */
  readonly states: Map<FakeSession, Knobs>;
  /** Định nghĩa chiếu đã đăng ký. */
  readonly definitions: any[];
  /** Định nghĩa lệnh đã đăng ký. */
  readonly commands: any[];
  /** Lời gọi `settings.configure`. */
  readonly configureCalls: unknown[];
  /** Câu cảnh báo đã ghi qua logger. */
  readonly warnings: string[];
  /** Lời gọi `approval.setPolicy`. */
  readonly policyCalls: unknown[];
  /** Cổng đồng ý của Auto đã được gọi. */
  readonly admits: number[];
  /** Phiên đang sống (nguồn của `sessions.list`). */
  readonly sessions: FakeSession[];
  /** Năm seam giả, đúng hình dạng service đọc. */
  readonly seams: Record<string, unknown>;
}

/**
 * Dựng một bộ seam giả có ghi vết.
 * Nhận: `sandboxMode` — chế độ executor báo; `policy` — chính sách duyệt mặc định của deployment.
 * Trả: harness rỗng (mọi vết là mảng mới).
 */
function makeHarness(sandboxMode: string | undefined = "workspace-write", policy = "ask"): Harness {
  const states = new Map<FakeSession, Knobs>();
  const definitions: any[] = [];
  const commands: any[] = [];
  const configureCalls: unknown[] = [];
  const warnings: string[] = [];
  const policyCalls: unknown[] = [];
  const admits: number[] = [];
  const sessions: FakeSession[] = [];
  return {
    states,
    definitions,
    commands,
    configureCalls,
    warnings,
    policyCalls,
    admits,
    sessions,
    seams: {
      shell: { sandboxMode },
      approval: {
        config: { policy },
        setPolicy: (agent: unknown, next: string) => {
          policyCalls.push([agent, next]);
          (agent as { policy?: string }).policy = next;
        },
      },
      sessions: { list: () => sessions },
      sessionProjections: {
        register: (definition: any) => {
          definitions.push(definition);
          return () => {};
        },
        // Giống sổ chiếu THẬT: gộp `apply` của đơn vị đã đăng ký qua log phiên, mồi từ trạng thái nền.
        stateOf: (session: FakeSession) => {
          const definition = definitions[0];
          if (definition === undefined) return states.get(session);
          let state = states.get(session) ?? definition.init();
          for (const event of session.log) state = definition.apply(state, event);
          return state;
        },
      },
      commands: {
        register: (definition: any) => {
          commands.push(definition);
          return () => {};
        },
      },
      settings: {
        // Seam thật trả DISPOSER: cordis dùng chính hàm đó làm thân effect của namespace.
        configure: (value: unknown) => {
          configureCalls.push(value);
          return () => {};
        },
      },
    },
  };
}

/**
 * Harness có executor KHÔNG cưỡng chế (`sandboxMode` = undefined) — ca cấu hình sai của bản gốc.
 * Nhận: không.
 * Trả: harness với seam `shell` đã bị xoá chế độ.
 */
function unconfinedHarness(): Harness {
  const harness = makeHarness();
  (harness.seams.shell as { sandboxMode?: string }).sandboxMode = undefined;
  return harness;
}

/**
 * Dựng một phiên giả.
 * Nhận: `id` — định danh chỉ để đọc log.
 * Trả: phiên có nhật ký rỗng.
 */
function fakeSession(id: string): FakeSession {
  const log: LoggedEvent[] = [];
  return { id, log, append: (type, data) => log.push({ type, data }) };
}

/** Một bên của phép so: service + harness + Context đã dựng nó. */
interface Side {
  /** Context cordis của bên đó. */
  readonly ctx: any;
  /** Thể hiện service. */
  readonly svc: any;
  /** Vết seam của bên đó. */
  readonly h: Harness;
}

/**
 * Dựng MỘT bản (ta hoặc gốc) trên Context cordis THẬT bằng ĐƯỜNG NẠP THẬT `ctx.plugin`.
 * Nhận: `plugin` — lớp service; `config` — cấu hình thô (đã qua schema của kernel).
 * Trả: context, thể hiện service, và vết seam; logger được vá để bắt cảnh báo.
 */
async function boot(plugin: unknown, config: Record<string, unknown> = { presets: RUNNING_PRESETS }): Promise<Side> {
  const harness = makeHarness(
    (config.sandboxMode as string | undefined) ?? "workspace-write",
    (config.policy as string | undefined) ?? "ask",
  );
  const { sandboxMode: _sandboxMode, policy: _policy, ...rowConfig } = config;
  const ctx = new ContextCtor();
  for (const [name, value] of Object.entries(harness.seams)) ctx.provide(name, value);
  ctx.plugin(plugin, rowConfig);
  await new Promise((resolve) => setTimeout(resolve, 10));
  // Logger của kernel là service sống: vá `warn` để cảnh báo người nghe hỏng không rò ra console.
  ctx.logger.warn = (message: unknown) => harness.warnings.push(String(message));
  return { ctx, svc: ctx.get("permissionPresets"), h: harness };
}

/**
 * Dựng CẢ HAI bản với cùng cấu hình.
 * Nhận: `config` — cấu hình thô truyền cho cả hai.
 * Trả: hai bên (ta + gốc) để so từng số đo.
 */
async function bootBoth(config: Record<string, unknown> = { presets: RUNNING_PRESETS }): Promise<{ ours: Side; theirs: Side }> {
  return { ours: await boot(ours.default, config), theirs: await boot(stock.default, config) };
}

/**
 * Dựng TRỰC TIẾP lớp service (không qua `ctx.plugin`) để đo thông điệp NÉM của constructor.
 * Nhận: `plugin` — lớp service; `config` — cấu hình đã ở dạng service đọc; `harness` — seam đã cấp.
 * Trả: chuỗi `THROW: …` khi ném, hoặc `(khong nem)`.
 */
function constructMessage(plugin: any, config: unknown, harness: Harness): string {
  const ctx = new ContextCtor();
  for (const [name, value] of Object.entries(harness.seams)) ctx.provide(name, value);
  try {
    new plugin(ctx, config);
    return "(khong nem)";
  } catch (error) {
    return "THROW: " + (error as Error).message;
  }
}

/**
 * Cấu hình trực tiếp: bảng preset + một `Volatile` giả (chỉ cần `.get()` như service đọc).
 * Nhận: `presets` — bảng preset; `defaultPreset` — giá trị Volatile trả.
 * Trả: vật thể cấu hình để truyền thẳng vào constructor.
 */
function directConfig(presets: Record<string, unknown>, defaultPreset?: string): unknown {
  return { presets, defaultPreset: { get: () => defaultPreset } };
}

/**
 * Chờ có TRẦN một điều kiện đồng bộ — không bao giờ treo test.
 * Nhận: `predicate` — điều kiện; `timeoutMs` — trần (mặc định 1000ms); `stepMs` — nhịp thử.
 * Trả: `true` khi điều kiện đạt trước trần, `false` khi hết trần.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 1000, stepMs = 5): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return predicate();
}

/**
 * Đọc log phiên thành chuỗi JSON để so hai bên.
 * Nhận: `session` — phiên giả.
 * Trả: chuỗi JSON của danh sách sự kiện.
 */
function logOf(session: FakeSession): string {
  return JSON.stringify(session.log);
}

describe("row permission · ARTIFACT", () => {
  test("tập export ta = tập export gốc; prototype + static khớp TỪNG TÊN; 0 id @deepseek-ai", async () => {
    const code = await readFile(OUR_ARTIFACT, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["AUTO_PRESET", "CUSTOM_PRESET", "PermissionPresetService", "default"]);
    expect(ours.default).toBe(ours.PermissionPresetService);
    expect(stock.default).toBe(stock.PermissionPresetService);
    expect(Object.getOwnPropertyNames(ours.PermissionPresetService.prototype)).toEqual(
      Object.getOwnPropertyNames(stock.PermissionPresetService.prototype),
    );
    expect(Object.getOwnPropertyNames(ours.PermissionPresetService)).toEqual(
      Object.getOwnPropertyNames(stock.PermissionPresetService),
    );
    expect(ours.PermissionPresetService.inject).toEqual(stock.PermissionPresetService.inject);
    expect(ours.PermissionPresetService.inject).toEqual(["shell", "approval", "sessions", "sessionProjections"]);
    expect(String(ours.PermissionPresetService.Config)).toBe(String(stock.PermissionPresetService.Config));
    expect(ours.CUSTOM_PRESET).toBe(CUSTOM_PRESET);
    expect(ours.AUTO_PRESET).toBe(AUTO_PRESET);
    expect(CUSTOM_PRESET).toBe("custom");
    expect(AUTO_PRESET).toBe("auto");
    expect(PermissionPresetService.name).toBe("PermissionPresetService");
  });

  test("MỘT MẶT: gói gốc KHÔNG có dsh.client, KHÔNG có lib/client.js; ta KHÔNG có src/client.ts", async () => {
    const stockManifest = JSON.parse(await readFile(join(STOCK_DIR, "package.json"), "utf8"));
    const ourManifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(stockManifest.dsh?.client).toBeUndefined();
    expect(ourManifest.dsh?.client).toBeUndefined();
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
    expect(existsSync(join(PKG, "src", "client.ts"))).toBe(false);
    // `exports["./client"]` của bản gốc chỉ là lối KIỂU (`export {}`) — không phải nửa browser.
    const stockClient = await readFile(join(STOCK_DIR, "lib", "types", "client.js"), "utf8");
    expect(stockClient).toContain("export {}");
  });
});

describe("row permission · hành vi đối chứng với CHÍNH bundle gốc", () => {
  test("catalog + optionOf + resolve + names: Y HỆT gốc với bảng preset ĐANG CHẠY", async () => {
    const { ours: a, theirs: b } = await bootBoth();
    expect(JSON.stringify(a.svc.catalog())).toBe(JSON.stringify(b.svc.catalog()));
    expect(JSON.stringify(a.svc.names)).toBe(JSON.stringify(b.svc.names));
    expect(a.svc.catalog()).toEqual({
      options: [
        { value: "read-only", name: "read-only" },
        { value: "workspace-write", name: "workspace-write" },
        { value: "danger-full-access", name: "danger-full-access" },
      ],
      defaultOptions: [
        { value: "read-only", name: "read-only" },
        { value: "workspace-write", name: "workspace-write" },
        { value: "danger-full-access", name: "danger-full-access" },
      ],
      defaultPreset: "workspace-write",
    });
    for (const name of [...a.svc.names, CUSTOM_PRESET]) {
      expect(JSON.stringify(a.svc.optionOf(name))).toBe(JSON.stringify(b.svc.optionOf(name)));
    }
    // Nhãn/mô tả tuỳ chọn: thiếu nhãn thì rơi về khoá; có mô tả thì đi kèm — so cả HÌNH DẠNG lẫn thứ tự khoá.
    const described = {
      presets: { "workspace-write": { sandbox: "workspace-write", approval: "ask", name: "Write", description: "Mo ta" } },
    };
    const { ours: c, theirs: d } = await bootBoth(described);
    expect(JSON.stringify(c.svc.optionOf("workspace-write"))).toBe(JSON.stringify(d.svc.optionOf("workspace-write")));
    expect(c.svc.optionOf("workspace-write")).toEqual({ value: "workspace-write", name: "Write", description: "Mo ta" });
    // Đường lỗi: tên lạ trong resolve/optionOf — cùng thông điệp.
    const messageOf = (run: () => unknown): string => {
      try {
        run();
        return "(khong nem)";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(messageOf(() => a.svc.resolve("ghost"))).toBe(messageOf(() => b.svc.resolve("ghost")));
    expect(messageOf(() => a.svc.optionOf("ghost"))).toBe(messageOf(() => b.svc.optionOf("ghost")));
    expect(messageOf(() => a.svc.optionOf("ghost"))).toContain('permission: unknown preset "ghost"');
  });

  test("current(): 8 tổ hợp núm cho CÙNG tên preset — kể cả nhánh Auto dưới chính sách never", async () => {
    const { ours: a, theirs: b } = await bootBoth();
    const matrix: { knobs: Knobs; mine: FakeSession; twin: FakeSession }[] = [];
    const combos: { preset: string | null; sandbox: string | null; approval: string | null }[] = [
      { preset: null, sandbox: null, approval: null },
      { preset: "read-only", sandbox: "read-only", approval: "ask" },
      { preset: "workspace-write", sandbox: "workspace-write", approval: "ask" },
      { preset: "danger-full-access", sandbox: "danger-full-access", approval: "never" },
      { preset: "read-only", sandbox: "workspace-write", approval: "ask" },
      { preset: "workspace-write", sandbox: "read-only", approval: "never" },
      { preset: "auto", sandbox: "danger-full-access", approval: null },
      { preset: null, sandbox: "danger-full-access", approval: "ask" },
    ];
    for (const combo of combos) {
      const knobs = { ...combo, seeded: false };
      const mine = fakeSession("m" + matrix.length);
      const twin = fakeSession("m" + matrix.length);
      a.h.states.set(mine, knobs);
      b.h.states.set(twin, { ...knobs });
      matrix.push({ knobs, mine, twin });
    }
    for (const { knobs, mine, twin } of matrix) {
      expect(a.svc.current(mine)).toBe(b.svc.current(twin));
      expect(a.svc.current(mine)).toBe(a.svc.derive(knobs));
    }
    expect(a.svc.current(matrix[0]!.mine)).toBe("workspace-write");
    expect(a.svc.current(matrix[6]!.mine)).toBe(b.svc.current(matrix[6]!.twin));
    // Chính sách never + núm danger-full-access ⇒ Auto khớp qua nhánh "đã chọn Auto cũng khớp never".
    // (Mặc định thành phần phải khớp một preset, nên executor cũng phải là danger-full-access.)
    const { ours: c, theirs: d } = await bootBoth({ presets: RUNNING_PRESETS, policy: "never", sandboxMode: "danger-full-access" });
    const cDispose = c.svc.registerAuto(() => {});
    const dDispose = d.svc.registerAuto(() => {});
    const s1 = fakeSession("auto-never");
    const t1 = fakeSession("auto-never");
    c.h.states.set(s1, { preset: "auto", sandbox: "danger-full-access", approval: null, seeded: false });
    d.h.states.set(t1, { preset: "auto", sandbox: "danger-full-access", approval: null, seeded: false });
    expect(c.svc.current(s1)).toBe(d.svc.current(t1));
    expect(c.svc.current(s1)).toBe("auto");
    await cDispose();
    await dDispose();
    // Auto ĐANG sống: `current` của trạng thái Auto trả `auto` ở cả hai bên.
    const disposedOurs = a.svc.registerAuto(() => {});
    const disposedTheirs = b.svc.registerAuto(() => {});
    expect(a.svc.current(matrix[6]!.mine)).toBe(b.svc.current(matrix[6]!.twin));
    await disposedOurs();
    await disposedTheirs();
  });

  test("set(): cùng chuỗi sự kiện cho 4 lần chuyển, gồm lần KHÔNG ghi gì và lần chỉ đổi MỘT núm", async () => {
    const { ours: a, theirs: b } = await bootBoth();
    const run = (side: Side, session: FakeSession, start: Knobs, steps: string[]): string[] => {
      side.h.states.set(session, { ...start });
      const snaps: string[] = [];
      for (const name of steps) {
        side.svc.set(session, name);
        snaps.push(logOf(session));
      }
      return snaps;
    };
    const fresh: Knobs = { preset: null, sandbox: null, approval: null, seeded: false };
    const steps = ["workspace-write", "workspace-write", "danger-full-access", "read-only"];
    const ourSession = fakeSession("set");
    const theirSession = fakeSession("set");
    expect(run(a, ourSession, fresh, steps)).toEqual(run(b, theirSession, fresh, steps));
    // Lần 1 và 2 KHÔNG ghi gì (chọn đúng preset đang hiệu lực); lần 3 và 4 đổi CẢ HAI núm.
    expect(ourSession.log.map((event) => event.type)).toEqual([
      "permission/preset",
      "sandbox/mode",
      "approval/policy",
      "permission/preset",
      "sandbox/mode",
      "approval/policy",
    ]);
    // Lần chọn LẠI đúng preset đang hiệu lực: không ghi gì (net-zero).
    const again = fakeSession("again");
    const againTwin = fakeSession("again");
    const settled: Knobs = { preset: "workspace-write", sandbox: "workspace-write", approval: "ask", seeded: false };
    expect(run(a, again, settled, ["workspace-write"])).toEqual(run(b, againTwin, settled, ["workspace-write"]));
    expect(again.log).toEqual([]);
    // Núm đã lệch khỏi preset đã chọn: `current` là preset KHÁC, nên chọn lại preset cũ VẪN ghi + chỉ đổi MỘT núm.
    const drifted = fakeSession("drifted");
    const driftedTwin = fakeSession("drifted");
    const driftedState: Knobs = { preset: "read-only", sandbox: "workspace-write", approval: "ask", seeded: false };
    expect(run(a, drifted, driftedState, ["read-only"])).toEqual(run(b, driftedTwin, driftedState, ["read-only"]));
    expect(drifted.log.map((event) => event.type)).toEqual(["permission/preset", "sandbox/mode"]);
  });

  test("ghim quyền khởi tạo: phiên TƯƠI · đã gieo hạt · khởi tạo MỘT PHẦN · Auto thiếu tích hợp", async () => {
    const run = async (plugin: unknown): Promise<Record<string, string>> => {
      const harness = makeHarness();
      const fresh = fakeSession("fresh");
      harness.sessions.push(fresh);
      harness.states.set(fresh, { preset: null, sandbox: null, approval: null, seeded: false });
      const ctx = new ContextCtor();
      for (const [name, value] of Object.entries(harness.seams)) ctx.provide(name, value);
      ctx.plugin(plugin, { presets: RUNNING_PRESETS });
      await new Promise((resolve) => setTimeout(resolve, 10));
      // Phiên sinh SAU khi mount đi qua người nghe `session/created`.
      const created = fakeSession("created");
      harness.states.set(created, { preset: null, sandbox: null, approval: null, seeded: false });
      ctx.emit("session/created", created);
      // Khởi tạo MỘT PHẦN: có sandbox, thiếu hai dữ kiện còn lại.
      const partial = fakeSession("partial");
      harness.states.set(partial, { preset: null, sandbox: "read-only", approval: null, seeded: false });
      ctx.emit("session/created", partial);
      // Đã gieo hạt (`session/end-seed`) ⇒ GIỮ giá trị hiệu lực, chỉ nhận dữ kiện thiếu.
      const seeded = fakeSession("seeded");
      harness.states.set(seeded, { preset: null, sandbox: null, approval: null, seeded: true });
      ctx.emit("session/created", seeded);
      // Danh tính `auto` đã lưu mà tích hợp KHÔNG sống ⇒ ném (cordis nuốt trong fiber nên đo trực tiếp).
      const autoHarness = makeHarness();
      autoHarness.states.set(fakeSession("auto"), { preset: "auto", sandbox: "danger-full-access", approval: "ask", seeded: false });
      for (const session of autoHarness.states.keys()) autoHarness.sessions.push(session);
      const autoMessage = constructMessage(plugin, directConfig(RUNNING_PRESETS), autoHarness);
      return { logFresh: logOf(fresh), logCreated: logOf(created), partial: logOf(partial), seeded: logOf(seeded), autoThrow: autoMessage };
    };
    const ourRun = await run(ours.default);
    const theirRun = await run(stock.default);
    expect(ourRun).toEqual(theirRun);
    expect(JSON.parse(ourRun.logFresh!)).toEqual([
      { type: "permission/preset", data: { preset: "workspace-write" } },
      { type: "sandbox/mode", data: { mode: "workspace-write" } },
      { type: "approval/policy", data: { policy: "ask" } },
    ]);
    expect(ourRun.logCreated).toBe(ourRun.logFresh);
    expect(JSON.parse(ourRun.seeded!)).toEqual([
      { type: "permission/preset", data: { preset: "workspace-write" } },
      { type: "sandbox/mode", data: { mode: "workspace-write" } },
      { type: "approval/policy", data: { policy: "ask" } },
    ]);
    expect(ourRun.partial).toBe(
      JSON.stringify([
        { type: "permission/preset", data: { preset: "read-only" } },
        { type: "approval/policy", data: { policy: "ask" } },
      ]),
    );
    expect(ourRun.autoThrow).toContain('permission: cannot restore preset "auto" without its active integration');
  });

  test("constructor: năm đường lỗi + mặc định suy ra — CÙNG thông điệp gốc", async () => {
    const cases: { label: string; presets: Record<string, unknown>; harness: Harness; defaultPreset?: string }[] = [
      {
        label: "custom",
        presets: { ...RUNNING_PRESETS, custom: { sandbox: "read-only", approval: "ask" } },
        harness: makeHarness(),
      },
      {
        label: "auto",
        presets: { ...RUNNING_PRESETS, auto: { sandbox: "read-only", approval: "ask" } },
        harness: makeHarness(),
      },
      { label: "unconfined", presets: RUNNING_PRESETS, harness: unconfinedHarness() },
      {
        label: "no-matching-default",
        presets: { "workspace-write": { sandbox: "workspace-write", approval: "ask" } },
        harness: makeHarness("read-only", "never"),
      },
      { label: "unknown-default", presets: RUNNING_PRESETS, harness: makeHarness(), defaultPreset: "ghost" },
    ];
    for (const item of cases) {
      const config = directConfig(item.presets, item.defaultPreset);
      const ourMessage = constructMessage(ours.PermissionPresetService, config, item.harness);
      const theirMessage = constructMessage(stock.PermissionPresetService, config, item.harness);
      expect(ourMessage).toBe(theirMessage);
      expect(ourMessage.startsWith("THROW: ")).toBe(true);
    }
    // Mặc định suy ra từ mặc định thành phần khi Config KHÔNG khai `defaultPreset`.
    const inferredOurs = await boot(ours.default, { presets: RUNNING_PRESETS });
    const inferredTheirs = await boot(stock.default, { presets: RUNNING_PRESETS });
    expect(inferredOurs.svc.defaultPreset).toBe(inferredTheirs.svc.defaultPreset);
    expect(inferredOurs.svc.defaultPreset).toBe("workspace-write");
    // Namespace thiết lập: cả hai khai namespace `permission` là KHÔNG-tự-động, y hệt gốc.
    expect(inferredOurs.h.configureCalls).toEqual(inferredTheirs.h.configureCalls);
    expect(inferredOurs.h.configureCalls).toEqual([{ auto: false }]);
    // Vật thể service: CÙNG tập khoá riêng, CÙNG thứ tự (presets · autoAdmit · defaultSettings).
    expect(Object.keys(inferredOurs.svc)).toEqual(Object.keys(inferredTheirs.svc));
    expect(Object.keys(inferredOurs.svc)).toEqual(["ctx", "name", "typertRemote", "presets", "autoAdmit", "defaultSettings"]);
  });

  test("đơn vị chiếu permissions: khoá + stateVersion + init + apply + wire Y HỆT gốc", async () => {
    const { ours: a, theirs: b } = await bootBoth();
    expect(a.h.definitions.length).toBe(1);
    expect(b.h.definitions.length).toBe(1);
    const ourDefinition = a.h.definitions[0];
    const theirDefinition = b.h.definitions[0];
    expect(ourDefinition.key).toBe(theirDefinition.key);
    expect(ourDefinition.key).toBe("permissions");
    expect(ourDefinition.stateVersion).toBe(theirDefinition.stateVersion);
    expect(ourDefinition.stateVersion).toBe(2);
    expect(JSON.stringify(ourDefinition.init())).toBe(JSON.stringify(theirDefinition.init()));
    expect(ourDefinition.init()).toEqual({ preset: null, sandbox: null, approval: null, seeded: false });
    const events = [
      { type: "permission/preset", data: { preset: "read-only" } },
      { type: "sandbox/mode", data: { mode: "read-only" } },
      { type: "approval/policy", data: { policy: "ask" } },
      { type: "session/end-seed", data: {} },
      { type: "user/message", data: {} },
    ];
    let ourState = ourDefinition.init();
    let theirState = theirDefinition.init();
    for (const event of events) {
      ourState = ourDefinition.apply(ourState, event);
      theirState = theirDefinition.apply(theirState, event);
      expect(JSON.stringify(ourState)).toBe(JSON.stringify(theirState));
      expect(JSON.stringify(ourDefinition.wire.view(ourState))).toBe(JSON.stringify(theirDefinition.wire.view(theirState)));
    }
    // Cổng thay đổi của seam dựa vào `Object.is`: sự kiện không liên quan PHẢI trả cùng tham chiếu.
    expect(ourDefinition.apply(ourState, { type: "other/event", data: null })).toBe(ourState);
    expect(theirDefinition.apply(theirState, { type: "other/event", data: null })).toBe(theirState);
    // Schema trạng thái: nhận đúng hình dạng, TỪ CHỐI khoá thừa (cả hai bên cùng ném).
    for (const state of [ourDefinition.init(), ourState]) expect(ourDefinition.stateSchema.parse(state)).toEqual(state);
    expect(() => ourDefinition.stateSchema.parse({ ...ourDefinition.init(), extra: 1 })).toThrow();
    expect(() => theirDefinition.stateSchema.parse({ ...theirDefinition.init(), extra: 1 })).toThrow();
    // Schema khung nhìn: `currentValue` không rỗng; tổ hợp lạ trả `custom`.
    expect(ourDefinition.wire.viewSchema.parse({ currentValue: "custom" })).toEqual({ currentValue: "custom" });
    expect(() => ourDefinition.wire.viewSchema.parse({ currentValue: "" })).toThrow();
    expect(() => theirDefinition.wire.viewSchema.parse({ currentValue: "" })).toThrow();
    expect(ourDefinition.wire.view({ preset: null, sandbox: "read-only", approval: "never", seeded: false })).toEqual({
      currentValue: "custom",
    });
  });

  test("registerAuto: catalog đổi theo vòng đời · trùng thì ném · chuyển sang Auto ghi đúng núm", async () => {
    const { ours: a, theirs: b } = await bootBoth();
    const ourEvents: string[] = [];
    const theirEvents: string[] = [];
    a.ctx.on("permission-presets/catalog-changed", () => ourEvents.push("changed"));
    b.ctx.on("permission-presets/catalog-changed", () => theirEvents.push("changed"));
    const ourDispose = a.svc.registerAuto(() => a.h.admits.push(1));
    const theirDispose = b.svc.registerAuto(() => b.h.admits.push(1));
    expect(JSON.stringify(a.svc.names)).toBe(JSON.stringify(b.svc.names));
    expect(a.svc.names).toContain(AUTO_PRESET);
    expect(JSON.stringify(a.svc.catalog())).toBe(JSON.stringify(b.svc.catalog()));
    expect(JSON.stringify(a.svc.resolve(AUTO_PRESET))).toBe(JSON.stringify(b.svc.resolve(AUTO_PRESET)));
    expect(a.svc.resolve(AUTO_PRESET)).toEqual({ sandbox: "danger-full-access", approval: "ask" });
    expect(ourEvents.length).toBe(theirEvents.length);
    expect(ourEvents.length).toBe(1);
    // Đăng ký lần hai khi Auto đã sống: cùng thông điệp.
    const messageOf = (run: () => unknown): string => {
      try {
        run();
        return "(khong nem)";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(messageOf(() => a.svc.registerAuto(() => {}))).toBe(messageOf(() => b.svc.registerAuto(() => {})));
    // Chuyển sang Auto: cổng đồng ý chạy TRƯỚC, rồi ghi danh tính + đúng những núm đã đổi.
    const ourSession = fakeSession("to-auto");
    const theirSession = fakeSession("to-auto");
    a.h.states.set(ourSession, { preset: "workspace-write", sandbox: "workspace-write", approval: "ask", seeded: false });
    b.h.states.set(theirSession, { preset: "workspace-write", sandbox: "workspace-write", approval: "ask", seeded: false });
    a.svc.set(ourSession, AUTO_PRESET);
    b.svc.set(theirSession, AUTO_PRESET);
    expect(logOf(ourSession)).toBe(logOf(theirSession));
    expect(a.h.admits.length).toBe(b.h.admits.length);
    // Đăng ký KHÔNG chạy cổng đồng ý — chỉ lần chuyển SANG Auto mới chạy, đúng MỘT lần.
    expect(a.h.admits.length).toBe(1);
    expect(JSON.parse(logOf(ourSession))).toEqual([
      { type: "permission/preset", data: { preset: "auto" } },
      { type: "sandbox/mode", data: { mode: "danger-full-access" } },
    ]);
    await ourDispose();
    await theirDispose();
    expect(ourEvents.length).toBe(theirEvents.length);
    expect(ourEvents.length).toBe(2);
    expect(JSON.stringify(a.svc.names)).toBe(JSON.stringify(b.svc.names));
    expect(a.svc.names).not.toContain(AUTO_PRESET);
    // Sau khi gỡ: Auto không còn giải được — cùng thông điệp.
    expect(messageOf(() => a.svc.resolve(AUTO_PRESET))).toBe(messageOf(() => b.svc.resolve(AUTO_PRESET)));
  });

  test("lệnh /permission: cùng định nghĩa + cùng kết cục (rỗng · tên lạ · đổi preset)", async () => {
    const { ours: a, theirs: b } = await bootBoth();
    expect(a.h.commands.length).toBe(1);
    expect(b.h.commands.length).toBe(1);
    const shape = (definition: any): string =>
      JSON.stringify({
        definitionId: definition.definitionId,
        name: definition.name,
        description: definition.description,
        input: definition.input,
      });
    expect(shape(a.h.commands[0])).toBe(shape(b.h.commands[0]));
    expect(shape(a.h.commands[0])).toBe(
      JSON.stringify({
        definitionId: "@deepseek-ai/dsh-permission-presets",
        name: "permission",
        description: "Switch the permission preset (sandbox mode + approval policy)",
        input: { hint: "<preset>" },
      }),
    );
    const run = (side: Side, session: FakeSession, rawInput: string): string => {
      side.h.states.set(session, { preset: null, sandbox: null, approval: null, seeded: false });
      const outcome = side.h.commands[0].handler({ agent: { session }, rawInput });
      return JSON.stringify(outcome) + "|" + logOf(session);
    };
    for (const rawInput of ["", "   ", "nope", " read-only ", "danger-full-access"]) {
      const ourSession = fakeSession("cmd");
      const theirSession = fakeSession("cmd");
      expect(run(a, ourSession, rawInput)).toBe(run(b, theirSession, rawInput));
    }
    const emptyOutcome = JSON.parse(run(a, fakeSession("cmd"), "").split("|")[0]!);
    expect(emptyOutcome.kind).toBe("success");
    expect(emptyOutcome.text).toBe("current preset workspace-write (available: read-only, workspace-write, danger-full-access)");
    const unknownOutcome = JSON.parse(run(a, fakeSession("cmd"), "nope").split("|")[0]!);
    expect(unknownOutcome.kind).toBe("error");
    expect(unknownOutcome.text).toContain('unknown preset "nope"');
  });
});

describe("C6 — DANH TÍNH giữa các thực thể cấu hình", () => {
  test("hai lượt mount KHÔNG dùng chung bảng preset; sửa bên này không lan sang bên kia", async () => {
    const sharedPresets = {
      "read-only": { sandbox: "read-only", approval: "ask" },
      "workspace-write": { sandbox: "workspace-write", approval: "ask" },
    };
    const first = await boot(ours.default, { presets: sharedPresets });
    const second = await boot(ours.default, { presets: sharedPresets });
    // DANH TÍNH, không phải giá trị: schema của kernel cấp bản đã qua kiểm cho TỪNG lượt nạp.
    expect(first.svc.presets).not.toBe(second.svc.presets);
    expect(first.svc.presets).not.toBe(sharedPresets);
    (first.svc.presets["workspace-write"] as { description?: string }).description = "mutated";
    expect((second.svc.presets["workspace-write"] as { description?: string }).description).toBeUndefined();
    expect((sharedPresets["workspace-write"] as { description?: string }).description).toBeUndefined();
    // Bản gốc cũng độc lập như vậy — phép so này là HÀNH VI, không phải sở thích.
    const stockFirst = await boot(stock.default, { presets: sharedPresets });
    const stockSecond = await boot(stock.default, { presets: sharedPresets });
    expect(stockFirst.svc.presets).not.toBe(stockSecond.svc.presets);
    // Catalog là ảnh chụp MỚI mỗi lượt: sửa kết quả lượt trước không đổi lượt sau.
    const snapshot = first.svc.catalog();
    expect(first.svc.catalog().options).not.toBe(snapshot.options);
    expect(first.svc.catalog().options[0]).not.toBe(snapshot.options[0]);
    expect(first.svc.names).not.toBe(first.svc.names);
    snapshot.options[0].name = "mutated";
    expect(first.svc.catalog().options[0].name).toBe("read-only");
    // Hai lượt `optionOf` trả hai vật thể RIÊNG (cùng giá trị).
    const option = first.svc.optionOf("read-only");
    expect(first.svc.optionOf("read-only")).not.toBe(option);
    expect(first.svc.optionOf("read-only")).toEqual(option);
  });
});

describe("cảnh báo người nghe hỏng + ca FLAKY dùng waitFor CÓ TRẦN", () => {
  test("người nghe NÉM đồng bộ và REJECT bất đồng bộ đều bị ghi cảnh báo — không làm hỏng lượt đăng ký Auto", async () => {
    const run = async (plugin: unknown): Promise<{ sync: string[]; all: string[] }> => {
      const { ctx, svc, h } = await boot(plugin);
      ctx.on("permission-presets/catalog-changed", () => {
        throw new Error("dong bo no");
      });
      ctx.on("permission-presets/catalog-changed", () => Promise.reject(new Error("bat dong bo no")));
      ctx.on("permission-presets/catalog-changed", () => "ok");
      const dispose = svc.registerAuto(() => {});
      const sync = [...h.warnings];
      // Ca FLAKY: cảnh báo bất đồng bộ tới SAU một microtask ⇒ phải CHỜ CÓ TRẦN, không ngủ mù.
      const reached = await waitFor(() => h.warnings.length >= 2);
      expect(reached).toBe(true);
      const all = [...h.warnings];
      await dispose();
      return { sync, all };
    };
    const ourRun = await run(ours.default);
    const theirRun = await run(stock.default);
    expect(ourRun).toEqual(theirRun);
    expect(ourRun.sync).toEqual(["permission: catalog-changed listener failed: dong bo no"]);
    expect(ourRun.all).toEqual([
      "permission: catalog-changed listener failed: dong bo no",
      "permission: catalog-changed listener failed: bat dong bo no",
    ]);
    // TRẦN của waitFor: điều kiện không bao giờ đạt vẫn KẾT THÚC đúng hạn (không treo test).
    const startedAt = Date.now();
    expect(await waitFor(() => false, 120, 10)).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});

describe("metadata: gbh.peers ⊆ peerDependencies (so PHẦN TỬ) + 000e locale", () => {
  /** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
  interface Manifest {
    /** Tên package. */
    name: string;
    /** Peer contract với trình quản lý gói. */
    peerDependencies?: Record<string, string>;
    /** Phụ thuộc thật (KHÔNG được chứa peer). */
    dependencies?: Record<string, string>;
    /** Metadata của ta. */
    gbh?: { peers?: string[]; tests?: string[]; row?: unknown };
  }

  /**
   * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
   * Nhận: `manifest` — manifest cần kiểm (có thể là bản đã bị sửa để làm ĐỐI CHỨNG ÂM).
   * Trả: các tên thiếu, đã sắp xếp.
   */
  function missingPeers(manifest: Manifest): string[] {
    const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
    return [...(manifest.gbh?.peers ?? [])].filter((peer) => !declared.has(peer)).sort();
  }

  /** Sáu peer của ta — đúng bảng §3b (bậc 1 + seam của row). */
  const SEAM_PEERS = [
    "@deepseek-ai/cordis",
    "@deepseek-ai/schemastery",
    "@deepseek-ai/dsh-commands",
    "@deepseek-ai/dsh-sandbox-policy",
    "@deepseek-ai/dsh-typert-protocol",
    "@deepseek-ai/dsh-user-approval",
  ];

  test("mọi tên trong gbh.peers có mặt trong peerDependencies, có thật trong kernel, KHÔNG nằm ở dependencies", async () => {
    const manifest: Manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá sạch gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    expect(peers.filter((peer) => deps.has(peer))).toEqual([]);
    for (const peer of peers) {
      expect(typeof manifest.peerDependencies?.[peer]).toBe("string");
      expect(existsSync(join(ROOT, "apps", "host", "node_modules", peer))).toBe(true);
    }
    // Zod là THƯ VIỆN (không phải seam): phải là dependency thật, không phải peer.
    expect(manifest.dependencies?.zod).toBeDefined();
    expect(peers).not.toContain("zod");
  });

  test("ĐỐI CHỨNG ÂM: xoá-một-tên · xoá-sạch · thừa-tên đều bị phép kiểm bắt", async () => {
    const manifest: Manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers = [...(manifest.gbh?.peers ?? [])];
    const victim = peers[0] as string;
    const withoutOne: Manifest = {
      ...manifest,
      peerDependencies: Object.fromEntries(Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => name !== victim)),
    };
    expect(missingPeers(withoutOne)).toEqual([victim]);
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
    const extra: Manifest = { ...manifest, gbh: { peers: [...peers, "@deepseek-ai/khong-ton-tai"] } };
    expect(missingPeers(extra)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Phép so SỐ LƯỢNG cho verdict RỖNG (bài học M6 §1d): hai danh sách cùng độ dài mà vẫn lệch phần tử.
    const sameCount: Manifest = {
      name: "@galaxy-blackhole/gbh-gia",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/z"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/b": "1" },
    };
    expect(sameCount.gbh?.peers?.length).toBe(Object.keys(sameCount.peerDependencies ?? {}).length);
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/z"]);
  });

  
  test("000e: locale/en.json + locale/zh.json TRÙNG TỪNG BYTE bản gốc và có trong exports", async () => {
    for (const file of ["en.json", "zh.json"]) {
      const ourBytes = await readFile(join(PKG, "locale", file));
      const stockBytes = await readFile(join(STOCK_DIR, "locale", file));
      expect(ourBytes.equals(stockBytes)).toBe(true);
      expect(ourBytes.length).toBeGreaterThan(0);
    }
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});
