/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test goi api-terminal-controller (nua HOST): artefact BYTE-IDENTICAL bundle goc + be mat export +
 *      service terminalController tren Context cordis THAT, Config/inject/prototype, va A/B nhanh loi/hop le
 *      voi subprocess GIA (khong dung xterm/pty that)
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-terminal-controller");
/** Artefact của ta. */
const OURS_FILE = join(PKG, "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC). */
const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-terminal-controller", "lib", "index.js");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Thư mục làm việc GIẢ mà workingDirectory trả về. */
const CWD = "/tmp/gbh-terminal-cwd";
/** Tín hiệu chưa huỷ dùng chung cho các ca A/B. */
const SIGNAL = new AbortController().signal;

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, unknown>;

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
interface Ctx {
  get(name: string): unknown;
  provide(name: string, value: unknown): void;
}

/** Agent giả tối thiểu: id + session + Context thật mang provider giả. */
interface AgentLike {
  id: string;
  session: string;
  ctx: Ctx;
}

/** Yêu cầu tạo terminal tối thiểu. */
interface RequestLike {
  id: string;
  cols: number;
  rows: number;
  shellPath?: string;
}

/** Hình dạng service TerminalController mà test chạm tới. */
interface ServiceLike {
  readonly name: string;
  readonly typertRemote: { serviceKey: string; namespace: string };
  environment(agent: AgentLike, signal: AbortSignal): unknown;
  shells(agent: AgentLike, signal: AbortSignal): unknown;
  list(sessionId: string): unknown;
  create(agent: AgentLike, request: RequestLike, signal: AbortSignal): Promise<unknown>;
  retain(sessionId: string, id: string, signal: AbortSignal): unknown;
  attach(agent: AgentLike, id: string, signal: AbortSignal): unknown;
  rename(agent: AgentLike, id: string, title: string): unknown;
  close(agent: AgentLike, id: string): Promise<unknown>;
}

/** Nạp artefact của ta. */
const ours = (await import(OURS_FILE)) as Api;
/** Nạp bundle gốc. */
const stock = (await import(STOCK_FILE)) as Api;

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Nạp cordis THẬT từ runtime của app.
 * Nhận: không.
 * Trả: lớp Context.
 */
async function loadCordis(): Promise<new () => unknown> {
  const mod = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js"))) as { Context: new () => unknown };
  return mod.Context;
}

/** Lớp Context dùng chung cho mọi ca. */
const ContextCtor = await loadCordis();

/**
 * Đọc schema Config của một bên và validate đầu vào.
 * Nhận: api — bề mặt module; input — giá trị thô.
 * Trả: { value } khi hợp lệ, { issues } khi sai.
 */
function validateConfig(api: Api, input: Record<string, unknown>): { value?: unknown; issues?: unknown } {
  const holder = api["TerminalController"] as {
    Config: { "~standard": { validate(value: unknown): { value?: unknown; issues?: unknown } } };
  };
  return holder.Config["~standard"].validate(input);
}

/**
 * Lấy cấu hình đã áp mặc định của một bên.
 * Nhận: api — bề mặt module; overrides — giá trị ghi đè.
 * Trả: object cấu hình đã validate.
 */
function resolveConfig(api: Api, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const result = validateConfig(api, overrides);
  if (result.value === undefined) throw new Error("Config khong validate duoc: " + JSON.stringify(result.issues));
  return result.value as Record<string, unknown>;
}

/**
 * Cài service terminalController của một bên lên Context cordis mới.
 * Nhận: api — bề mặt module; overrides — cấu hình ghi đè.
 * Trả: { ctx, service } sau khi service đã đăng ký.
 */
async function mountService(api: Api, overrides: Record<string, unknown> = {}): Promise<{ ctx: Ctx; service: ServiceLike }> {
  const ctx = new ContextCtor() as unknown as Ctx;
  const ServiceClass = api["TerminalController"] as new (ctx: unknown, config: Record<string, unknown>) => ServiceLike;
  const service = new ServiceClass(ctx, resolveConfig(api, overrides));
  await new Promise((resolve) => setTimeout(resolve, 20));
  // cordis bọc service trong tracker nên so DANH TÍNH là sai — chỉ cần service HIỆN RA trên ctx.
  if (typeof ctx.get("terminalController") !== "object") throw new Error("service khong duoc dang ky tren context");
  return { ctx, service };
}

/**
 * Dựng một handle tiến trình GIẢ: chỉ đủ hợp đồng mà BrowserTerminal đọc.
 * Nhận: không.
 * Trả: handle có output rỗng, done chỉ hoàn tất khi terminate().
 */
function makeHandle(): Record<string, unknown> {
  let finish: (value: { exitCode: number }) => void = () => undefined;
  const done = new Promise<{ exitCode: number }>((resolve) => {
    finish = resolve;
  });
  return {
    output: (async function* (): AsyncGenerator<Uint8Array> {})(),
    done,
    inspectActivity: () => ({ state: "unknown", revision: 0 }),
    terminate: async () => {
      finish({ exitCode: 0 });
    },
    write: async () => undefined,
    resize: async () => undefined,
  };
}

/**
 * Dịch vụ subprocess GIẢ: terminalEnvironment + resolveExecutable + spawnTerminal.
 * Nhận: không.
 * Trả: object thoả bề mặt subprocess mà controller gọi.
 */
function makeSubprocess(): Record<string, unknown> {
  return {
    terminalEnvironment: async () => ({ defaultShell: "/bin/zsh", platform: "darwin" }),
    resolveExecutable: async (path: string) => (path.startsWith("/") ? path : "/usr/bin/" + path),
    spawnTerminal: async () => makeHandle(),
  };
}

/**
 * Dựng agent giả trên Context cordis thật.
 * Nhận: providers — "full" cấp đủ subprocess/sandboxPolicy/workingDirectory, "none" bỏ trống.
 * Trả: agent { id, session, ctx }.
 */
function makeAgent(providers: "full" | "none" = "full"): AgentLike {
  const ctx = new ContextCtor() as unknown as Ctx;
  if (providers === "full") {
    ctx.provide("subprocess", makeSubprocess());
    ctx.provide("sandboxPolicy", {});
    ctx.provide("workingDirectory", { get: () => CWD, ensure: async () => CWD });
  }
  return { id: "agent-1", session: "session-1", ctx };
}

/**
 * Chạy một lượt và ghi lại kết quả hoặc lỗi thành chuỗi so sánh được.
 * Nhận: run — hàm cần chạy (sync hoặc async).
 * Trả: "ok:<JSON>" hoặc "nem|<name>|<code>|<message>".
 */
async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    const failure = error as Error & { code?: string };
    return ["nem", failure.name, failure.code ?? "-", failure.message].join("|");
  }
}

/**
 * Mount service của một bên rồi chạy kịch bản, gói mọi lỗi thành chuỗi.
 * Nhận: api — bề mặt module; overrides — cấu hình; scenario — kịch bản nhận service.
 * Trả: chuỗi kết quả/lỗi.
 */
async function outcomeWith(api: Api, overrides: Record<string, unknown>, scenario: (service: ServiceLike) => unknown): Promise<string> {
  return outcome(async () => {
    const { service } = await mountService(api, overrides);
    return scenario(service);
  });
}

/**
 * Chạy CÙNG kịch bản trên artefact của ta và bundle gốc.
 * Nhận: overrides — cấu hình; scenario — kịch bản nhận service.
 * Trả: cặp [kết quả của ta, kết quả gốc].
 */
async function outcomeBoth(overrides: Record<string, unknown>, scenario: (service: ServiceLike) => unknown): Promise<[string, string]> {
  return [await outcomeWith(ours, overrides, scenario), await outcomeWith(stock, overrides, scenario)];
}

describe("artefact: nửa host port NGUYÊN VĂN TỪNG BYTE", () => {
  test("lib/index.js: cùng độ dài byte với bundle gốc", () => {
    const built = readFileSync(OURS_FILE, "utf8");
    // 05/11/2026 (P1b): artefact mang id CUA TA ⇒ so do dai tren dang chuan hoa.
    expect(chuanHoaHost(built).length).toBe(STOCK_TEXT.length);
    expect(Buffer.byteLength(chuanHoaHost(built), "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect(statSync(OURS_FILE).size).toBeGreaterThanOrEqual(Buffer.byteLength(STOCK_TEXT, "utf8"));
  });

  test("lib/index.js: trùng từng byte + cùng sha256", () => {
    const built = readFileSync(OURS_FILE, "utf8");
    // 05/11/2026 (P1b): so TUNG BYTE tren dang da chuan hoa id.
    expect(chuanHoaHost(built)).toBe(STOCK_TEXT);
    expect(sha256(chuanHoaHost(built))).toBe(sha256(STOCK_TEXT));
    expect(sha256(chuanHoaHost(built))).toHaveLength(64);
  });
});

describe("bề mặt export A/B", () => {
  test("cùng 2 tên export: TerminalController + default", () => {
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["TerminalController", "default"]);
  });

  test("default === TerminalController ở cả hai bên", () => {
    expect(ours["default"]).toBe(ours["TerminalController"]);
    expect(stock["default"]).toBe(stock["TerminalController"]);
    expect(typeof ours["TerminalController"]).toBe("function");
    expect(typeof stock["TerminalController"]).toBe("function");
  });
});

describe("service terminalController trên Context cordis THẬT", () => {
  test("new TerminalController(ctx, config) ⇒ ctx.terminalController xuất hiện ở cả hai bên", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    expect(typeof our.ctx.get("terminalController")).toBe("object");
    expect(typeof their.ctx.get("terminalController")).toBe("object");
    expect(our.service).toBeDefined();
    expect(their.service).toBeDefined();
  });

  test("cùng tên service terminalController + cùng namespace terminal", async () => {
    const our = await mountService(ours);
    const their = await mountService(stock);
    expect(our.service.name).toBe(their.service.name);
    expect(our.service.name).toBe("terminalController");
    expect(our.service.typertRemote.serviceKey).toBe(their.service.typertRemote.serviceKey);
    expect(our.service.typertRemote.namespace).toBe(their.service.typertRemote.namespace);
    expect(our.service.typertRemote.namespace).toBe("terminal");
  });
});

describe("Config schema A/B", () => {
  test("validate({}) cho cùng mặc định", () => {
    const our = validateConfig(ours, {});
    const their = validateConfig(stock, {});
    expect(our.issues).toBeUndefined();
    expect(their.issues).toBeUndefined();
    expect(JSON.stringify(our.value)).toBe(JSON.stringify(their.value));
    const value = our.value as Record<string, unknown>;
    expect(value["maxTerminals"]).toBe(8);
    expect(value["maxCols"]).toBe(500);
    expect(value["maxRows"]).toBe(200);
    expect(value["scrollback"]).toBe(1000);
    expect(value["maxBufferedBytes"]).toBe(2 * 1024 * 1024);
    expect(value["maxInputBytes"]).toBe(64 * 1024);
    expect(value["shellCandidates"]).toEqual(["zsh", "bash", "fish", "pwsh", "powershell", "cmd"]);
  });

  test("validate giá trị sai cho cùng issues", () => {
    const invalid = [
      { maxCols: 0 },
      { maxRows: 0 },
      { maxTerminals: 0 },
      { scrollback: -1 },
      { maxBufferedBytes: 10 },
      { maxInputBytes: 0 },
      { shell: { path: "/bin/zsh" } },
      { shellCandidates: [""] },
      { cleanupRetryMs: 0 },
    ];
    for (const input of invalid) {
      const our = validateConfig(ours, input);
      const their = validateConfig(stock, input);
      expect(our.value).toBeUndefined();
      expect(their.value).toBeUndefined();
      expect(JSON.stringify(our.issues)).toBe(JSON.stringify(their.issues));
      expect(JSON.stringify(our.issues)).toContain("expected");
    }
  });
});

describe("inject tĩnh + prototype", () => {
  test("TerminalController.inject trùng mảng hai bên", () => {
    const injectOf = (api: Api): string[] => (api["TerminalController"] as { inject: string[] }).inject;
    expect(JSON.stringify(injectOf(ours))).toBe(JSON.stringify(injectOf(stock)));
    expect(injectOf(ours)).toEqual(["subprocess", "sandboxPolicy", "workingDirectory", "typert"]);
  });

  test("tập phương thức công khai trên prototype trùng nhau", () => {
    const prototypeOf = (api: Api): Record<string, unknown> =>
      (api["TerminalController"] as { prototype: Record<string, unknown> }).prototype;
    const namesOf = (api: Api): string[] => Object.getOwnPropertyNames(prototypeOf(api)).sort();
    const methodsOf = (api: Api): string[] => namesOf(api).filter((name) => typeof prototypeOf(api)[name] === "function");
    // Tên đầy đủ gồm cả khoá marker chuỗi của typert-protocol (giá trị object) — phải trùng cả hai bên.
    expect(namesOf(ours)).toEqual(namesOf(stock));
    // Tập PHƯƠNG THỨC công khai: 16 hàm, trùng nhau và đúng danh sách đo được từ bundle gốc.
    expect(methodsOf(ours)).toEqual(methodsOf(stock));
    expect(methodsOf(ours)).toEqual([
      "attach",
      "close",
      "constructor",
      "create",
      "dimensions",
      "disposeOwner",
      "environment",
      "execution",
      "list",
      "owner",
      "rename",
      "requireOpen",
      "retain",
      "shells",
      "spawn",
      "terminal",
    ]);
    for (const name of ["environment", "shells", "list", "create", "retain", "attach", "rename", "close"]) {
      expect(methodsOf(ours)).toContain(name);
    }
  });
});

describe("nhánh lỗi: hai bên ném CÙNG thông điệp", () => {
  test("cùng ném cùng thông điệp: create với id sai định dạng", async () => {
    const [our, their] = await outcomeBoth({}, (service) => service.create(makeAgent(), { id: "bad id!", cols: 80, rows: 24 }, SIGNAL));
    expect(our).toBe(their);
    expect(our).toContain("Invalid terminal identity");
  });

  test("cùng ném cùng thông điệp: create với kích thước ngoài giới hạn", async () => {
    for (const request of [
      { id: "t1", cols: 1, rows: 24 },
      { id: "t1", cols: 80, rows: 0 },
      { id: "t1", cols: 5001, rows: 24 },
      { id: "t1", cols: Number.NaN, rows: 24 },
    ]) {
      const [our, their] = await outcomeBoth({}, (service) => service.create(makeAgent(), request, SIGNAL));
      expect(our).toBe(their);
      expect(our).toContain("Terminal dimensions exceed the configured limits");
    }
  });

  test("cùng ném cùng thông điệp: rename với tiêu đề rỗng hoặc quá dài", async () => {
    for (const title of ["", "   ", "x".repeat(121)]) {
      const [our, their] = await outcomeBoth({}, (service) => service.rename(makeAgent(), "khong-co", title));
      expect(our).toBe(their);
      expect(our).toContain("Terminal title must contain 1–120 characters");
    }
  });

  test("cùng ném cùng thông điệp: attach khi KHÔNG có Remote invocation (không dựng nổi Gateway/uplink thật)", async () => {
    const [our, their] = await outcomeBoth({}, (service) => service.attach(makeAgent(), "khong-co", SIGNAL));
    expect(our).toBe(their);
    expect(our).toContain("Terminal attachment requires a Remote invocation");
  });

  test("cùng ném cùng thông điệp: environment khi thiếu provider subprocess/sandboxPolicy", async () => {
    const [our, their] = await outcomeBoth({}, (service) => service.environment(makeAgent("none"), SIGNAL));
    expect(our).toBe(their);
    expect(our).toContain("The Session execution environment requires subprocess and sandbox policy providers");
  });

  test("cùng ném cùng thông điệp: retain/rename terminal không tồn tại ⇒ cùng RemoteError terminal/unavailable", async () => {
    const [our, their] = await outcomeBoth({}, async (service) => {
      const collected: string[] = [];
      for (const run of [() => service.retain("session-1", "khong-co", SIGNAL), () => service.rename(makeAgent(), "khong-co", "ok")]) {
        try {
          await run();
          collected.push("khong-nem");
        } catch (error) {
          const failure = error as Error & { code?: string };
          collected.push([failure.name, failure.code ?? "-", failure.message].join("|"));
        }
      }
      return collected;
    });
    expect(our).toBe(their);
    expect(our).toContain("terminal/unavailable");
    expect(our).toContain("Terminal is closing or unavailable");
    expect(our).toContain("Terminal no longer exists in this Session");
  });

  test("cùng ném cùng thông điệp: create với shellPath không có trong môi trường", async () => {
    const [our, their] = await outcomeBoth({}, (service) =>
      service.create(makeAgent(), { id: "t1", cols: 80, rows: 24, shellPath: "/nope/zsh" }, SIGNAL),
    );
    expect(our).toBe(their);
    expect(our).toContain("Selected shell is not available in this execution environment");
  });

  test("cùng ném cùng thông điệp: signal đã huỷ trước khi gọi environment", async () => {
    const controller = new AbortController();
    controller.abort(new Error("huy"));
    const [our, their] = await outcomeBoth({}, (service) => service.environment(makeAgent(), controller.signal));
    expect(our).toBe(their);
    expect(our).toContain("huy");
  });
});

describe("nhánh hợp lệ với subprocess GIẢ", () => {
  test("environment(agent) trả cùng cwd + cùng giới hạn", async () => {
    const [our, their] = await outcomeBoth({}, (service) => service.environment(makeAgent(), SIGNAL));
    expect(our).toBe(their);
    expect(our).toContain('"cwd":"' + CWD + '"');
    expect(our).toContain('"maxCols":500');
  });

  test("shells(agent) trả cùng danh sách shell đã xác minh", async () => {
    const [our, their] = await outcomeBoth({}, (service) => service.shells(makeAgent(), SIGNAL));
    expect(our).toBe(their);
    expect(our).toContain('{"path":"/bin/zsh","name":"zsh","args":["-i"]}');
    expect(our).toContain('{"path":"/usr/bin/cmd","name":"cmd","args":[]}');
  });

  test("create(agent) trả cùng info + list(agent.id) cùng nội dung", async () => {
    const [our, their] = await outcomeBoth({}, async (service) => {
      const agent = makeAgent();
      const info = await service.create(agent, { id: "t1", cols: 80, rows: 24 }, SIGNAL);
      const listed = service.list(agent.id);
      await service.close(agent, "t1");
      return { info, listed, after: service.list(agent.id) };
    });
    expect(our).toBe(their);
    expect(our).toContain('"state":"running"');
    expect(our).toContain('"title":"zsh"');
  });

  test("create rồi close: list rỗng trở lại + close(id lạ) không ném", async () => {
    const [our, their] = await outcomeBoth({}, async (service) => {
      const agent = makeAgent();
      await service.create(agent, { id: "t1", cols: 100, rows: 30 }, SIGNAL);
      await service.close(agent, "t1");
      const unknown = await service.close(agent, "khong-co");
      return { after: service.list(agent.id), unknown: unknown === undefined ? "undefined" : String(unknown) };
    });
    expect(our).toBe(their);
    expect(our).toContain('"after":[]');
    expect(our).toContain('"unknown":"undefined"');
  });

  test("create lần hai vượt maxTerminals ⇒ cùng RemoteError terminal/limit-reached", async () => {
    const [our, their] = await outcomeBoth({ maxTerminals: 1 }, async (service) => {
      const agent = makeAgent();
      await service.create(agent, { id: "t1", cols: 80, rows: 24 }, SIGNAL);
      try {
        await service.create(agent, { id: "t2", cols: 80, rows: 24 }, SIGNAL);
        return "khong-nem";
      } catch (error) {
        const failure = error as Error & { code?: string };
        return [failure.name, failure.code ?? "-", failure.message].join("|");
      } finally {
        await service.close(agent, "t1");
      }
    });
    expect(our).toBe(their);
    expect(our).toContain("terminal/limit-reached");
    expect(our).toContain("Session terminal limit reached");
  });

  test("create với shellPath hợp lệ ⇒ cùng info shell bash", async () => {
    const [our, their] = await outcomeBoth({}, async (service) => {
      const agent = makeAgent();
      const info = await service.create(agent, { id: "t1", cols: 80, rows: 24, shellPath: "/usr/bin/bash" }, SIGNAL);
      await service.close(agent, "t1");
      return info;
    });
    expect(our).toBe(their);
    expect(our).toContain('{"path":"/usr/bin/bash","name":"bash","args":["-i"]}');
  });
});
