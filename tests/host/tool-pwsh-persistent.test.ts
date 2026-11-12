/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 06/11/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-tool-pwsh-persistent: A = bundle gốc lib/index.js, B = lib của ta
 *      (ghép từ lát nguyên văn, cổng byte delta 0). Mỗi ca dựng HAI giàn giống hệt nhau trên Context cordis
 *      THẬT với seam PTY GIẢ 100% (handle giả: pid/kill/signal/onData/exitCode/timeout — KHÔNG spawn tiến
 *      trình, KHÔNG chạy shell), rồi so tập export, Config, đăng ký tool/hook và mọi kết cục thi hành.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

import { buildPackage } from "../../packages/host/tool-pwsh-persistent/build.ts";
import { assembleBundle } from "../../packages/host/tool-pwsh-persistent/src/assemble.ts";
import { STOCK_BUNDLE } from "../../packages/host/tool-pwsh-persistent/src/manifest.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
// 06/11/2026 (P1b): artefact mang id GBH ⇒ quy id về dạng gốc trước khi so byte/sha với bundle stock.
import { chuanHoaHost } from "../lib/artefact-normalize.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "tool-pwsh-persistent");
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-pwsh-persistent");
/** Bundle GỐC (A). */
const STOCK_FILE = join(REPO, STOCK_BUNDLE);
/** Nội dung bundle gốc — oracle của mọi phép so byte. */
const STOCK_TEXT = readFileSync(STOCK_FILE, "utf8");
/** Artefact của ta (B). */
const OURS_FILE = join(PKG, "lib", "index.js");
/** cordis THẬT của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis THẬT: chỉ ba seam tools/terminals/workingDirectory và effect được đắp thêm. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Bề mặt module mà test chạm tới (A và B cùng hình dạng). */
interface Surface {
  /** Tên plugin. */
  name: string;
  /** Dịch vụ plugin yêu cầu. */
  inject: string[];
  /** Lược đồ cấu hình (callable + toString). */
  Config: ((value: unknown) => unknown) & { toString(): string };
  /** Cài plugin lên context. */
  apply(ctx: unknown, config: unknown): void;
}

/** Bản gốc nạp động (A). */
const stock = (await import(STOCK_FILE)) as unknown as Surface;
/** Bản của ta (B) — nạp sau beforeAll. */
let ours: Surface;
/** Đường dẫn artefact của ta đang dùng. */
let oursFile = OURS_FILE;
/** Thư mục tạm cần dọn (chỉ có khi lib chưa tồn tại). */
let tempDir: string | undefined;

/** Nạp artefact B: ưu tiên lib đã build, chưa có thì build vào thư mục tạm TRONG gói (bare specifier resolve được). */
beforeAll(async () => {
  if (!existsSync(OURS_FILE)) {
    tempDir = mkdtempSync(join(PKG, ".tmp-build-"));
    oursFile = buildPackage(tempDir);
  }
  ours = (await import(oursFile)) as unknown as Surface;
});

/** Dọn thư mục tạm. */
afterAll(() => {
  if (tempDir !== undefined) rmSync(tempDir, { recursive: true, force: true });
});

/** Ký tự dấu huyền — viết bằng mã để tệp nguồn không phải escape. */
const BACKTICK = String.fromCharCode(96);

/** Một trang vùng đệm cuộn giả. */
interface Page {
  /** Chữ còn giữ. */
  text: string;
  /** Tổng số dòng. */
  totalLines: number;
  /** Mốc dòng đầu. */
  lineBegin: number;
  /** Mốc dòng sau trang. */
  lineEnd: number;
  /** Có cắt bớt hay không. */
  truncated: boolean;
}

/** Trạng thái phiên giả. */
type Status = { kind: "running" } | { kind: "exited"; exitCode: number | null; signal: string | null };

/** Handle TIẾN TRÌNH GIẢ 100% — không có tiến trình thật nào sau nó. */
interface FakeProcess {
  /** PID giả. */
  pid: number;
  /** Mã thoát giả (null khi còn chạy). */
  exitCode: number | null;
  /** Tín hiệu giả (null khi chưa bị giết). */
  signal: string | null;
  /** Hạn chót giả (ms). */
  timeoutMs: number;
  /** Giết GIẢ: chỉ ghi vết, không gửi tín hiệu thật. */
  kill(signal?: string): void;
  /** Đăng ký nhận dữ liệu GIẢ: trả callback huỷ. */
  onData(callback: (chunk: string) => void): () => void;
}

/** Phiên PTY giả. */
interface Session {
  /** Id phiên. */
  sessionId: string;
  /** Loại backend. */
  type: string;
  /** Trạng thái đầu phiên. */
  status: Status;
  /** Handle tiến trình giả. */
  process: FakeProcess;
}

/** Kịch bản MỘT lần gửi: cách PTY phản hồi. */
interface Reply {
  /** Chữ lệnh sinh ra (đặt giữa hai mốc). */
  output?: string;
  /** Mã thoát in sau mốc đóng. */
  exitCode?: number;
  /** KHÔNG in mốc đóng (thử nhánh chưa xong / stdin_read / hết hạn). */
  noEnd?: boolean;
  /** Lý do lần chờ trả về. */
  waitReason?: string;
  /** Độ trễ trước khi done chốt (mili giây). */
  delayMs?: number;
}

/** Định nghĩa tool mà sổ tool nhận (chỉ các trường test đọc). */
interface ToolDefinitionLike {
  /** Tên tool hướng model. */
  name: string;
  /** Mô tả hướng model. */
  description: string;
  /** Lược đồ tham số. */
  parameters: Record<string, unknown>;
  /** Lược đồ + hàm render đầu ra. */
  output: { schema: unknown; render(args: unknown, value: string): { type: string; text: string }[] };
  /** Gọi tool. */
  execute(args: { command: string }, exec: { agent?: object; signal: AbortSignal }): Promise<string>;
  /** Thẻ hiển thị lời gọi. */
  presentCall(args: { command: string }): { card: string; title: string };
}

/** Chủ sở hữu giả: có ctx.effect như Agent thật (bản gốc đăng ký dọn cache trên owner.ctx). */
interface OwnerLike {
  /** Id agent. */
  id: string;
  /** Context của agent. */
  ctx: { effect(callback: () => () => void, label: string): unknown };
}

/** Giàn đo của MỘT bên cài. */
interface Rig {
  /** Context cordis THẬT đã đắp seam. */
  ctx: unknown;
  /** Chủ sở hữu RIÊNG của giàn này. */
  owner: OwnerLike;
  /** Định nghĩa tool đã đăng ký (ném nếu không đăng ký gì). */
  tool(): ToolDefinitionLike;
  /** Mọi chữ đã gửi vào PTY, theo thứ tự. */
  sent: { text: string; submit: boolean }[];
  /** Mọi lần kill, theo thứ tự. */
  kills: { id: string; reason?: string }[];
  /** Mọi lần spawn, theo thứ tự. */
  spawns: { type: string; cwd?: string }[];
  /** Callback dọn đăng ký trên CONTEXT của plugin (theo nhãn). */
  effects: { label?: string; dispose: () => Promise<void> }[];
  /** Callback dọn đăng ký trên CONTEXT của CHỦ SỞ HỮU (theo nhãn). */
  ownerEffects: { label?: string; dispose: () => void }[];
  /** Trạng thái phiên hiện tại theo id. */
  sessions: Map<string, Session>;
  /** Mọi lệnh kill GIẢ trên handle tiến trình (không phải kill phiên). */
  processKills: string[];
}

/**
 * Dựng giàn cho MỘT bên cài: seam PTY giả điều khiển được + seam thư mục + sổ tool ghi vết.
 * Nhận: kịch bản phản hồi cho MỘT lần gửi.
 * Trả: giàn đo.
 */
function makeRig(reply: Reply = {}): Rig {
  const tools: ToolDefinitionLike[] = [];
  const sent: Rig["sent"] = [];
  const kills: Rig["kills"] = [];
  const spawns: Rig["spawns"] = [];
  const effects: Rig["effects"] = [];
  const ownerEffects: Rig["ownerEffects"] = [];
  const sessions = new Map<string, Session>();
  const pages = new Map<string, Page>();
  const processKills: string[] = [];
  let counter = 0;
  const owner: OwnerLike = {
    id: "agent-1",
    ctx: {
      effect(callback: () => () => void, label: string) {
        ownerEffects.push({ label, dispose: callback() });
        return () => undefined;
      },
    },
  };
  const registry = {
    spawn(_owner: object, request: { type: string; cwd?: string }): Promise<Session & { motd: string }> {
      counter += 1;
      const pid = 1000 + counter;
      const fake: FakeProcess = {
        pid,
        exitCode: null,
        signal: null,
        timeoutMs: 300000,
        kill(signal?: string) {
          processKills.push((signal ?? "SIGTERM") + ":" + String(pid));
          fake.signal = signal ?? "SIGTERM";
        },
        onData() {
          return () => undefined;
        },
      };
      const session: Session = { sessionId: "pty-" + String(counter), type: request.type, status: { kind: "running" }, process: fake };
      sessions.set(session.sessionId, session);
      pages.set(session.sessionId, { text: "", totalLines: 0, lineBegin: 0, lineEnd: 0, truncated: false });
      spawns.push({ type: request.type, cwd: request.cwd });
      return Promise.resolve({ ...session, motd: "" });
    },
    list(caller: object): Session[] {
      return caller === owner ? [...sessions.values()] : [];
    },
    read(_owner: object, id: string): Page {
      return pages.get(id) ?? { text: "", totalLines: 0, lineBegin: 0, lineEnd: 0, truncated: false };
    },
    startSend(_owner: object, id: string, request: { text: string; submit: boolean }) {
      sent.push({ text: request.text, submit: request.submit });
      if (request.submit) {
        const startMarker = /__DSH_PERSISTENT_PWSH_START_[0-9a-f-]+__/.exec(request.text)?.[0] ?? "";
        const endMarker = /__DSH_PERSISTENT_PWSH_END_[0-9a-f-]+:/.exec(request.text)?.[0] ?? "";
        const body = (reply.output ?? "") + "\r\n";
        const tail = reply.noEnd === true ? "" : endMarker + String(reply.exitCode ?? 0) + "\r\n";
        pages.set(id, {
          text: startMarker + "\r\n" + body + tail,
          totalLines: 1,
          lineBegin: 0,
          lineEnd: 1,
          truncated: false,
        });
      }
      const done = new Promise<{ viewport: string; waitReason: string; sessionStatus: Status; truncated: boolean }>((resolve) => {
        const settle = (): void => {
          resolve({
            viewport: "",
            waitReason: reply.waitReason ?? "inferred_idle",
            sessionStatus: { kind: "running" },
            truncated: false,
          });
        };
        if ((reply.delayMs ?? 0) > 0) setTimeout(settle, reply.delayMs ?? 0);
        else settle();
      });
      return { done, readOutput: () => ({ delta: "", truncated: false }) };
    },
    kill(_owner: object, id: string, reason?: string): Promise<boolean> {
      kills.push({ id, reason });
      sessions.delete(id);
      return Promise.resolve(true);
    },
  };
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "tools") {
        return {
          register(definition: ToolDefinitionLike) {
            tools.push(definition);
            return () => undefined;
          },
        };
      }
      if (prop === "terminals") return registry;
      if (prop === "workingDirectory") return { ensure: () => Promise.resolve("/tmp/workspace") };
      if (prop === "effect") {
        return (callback: () => () => Promise<void>, label?: string) => {
          const dispose = callback();
          effects.push({ label, dispose });
          return () => undefined;
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  return {
    ctx,
    owner,
    tool(): ToolDefinitionLike {
      const found = tools[0];
      if (found === undefined) throw new Error("apply không đăng ký tool nào");
      return found;
    },
    sent,
    kills,
    spawns,
    effects,
    ownerEffects,
    sessions,
    processKills,
  };
}

/**
 * Cấu hình đã qua schema của CHÍNH bên đó.
 * Nhận: lớp gói và phần ghi đè thô.
 * Trả: cấu hình đã phân giải.
 */
function configOf(plugin: Surface, raw: Record<string, unknown> = {}): unknown {
  return (plugin.Config as unknown as (value: unknown) => unknown)(raw);
}

/**
 * Cài MỘT bên lên giàn của nó.
 * Nhận: lớp gói, giàn, và phần ghi đè cấu hình thô.
 * Trả: không.
 */
function install(plugin: Surface, rig: Rig, raw: Record<string, unknown> = {}): void {
  plugin.apply(rig.ctx, configOf(plugin, raw));
}

/**
 * Chạy MỘT lệnh qua tool của giàn, trả THÔ kết quả hoặc thông điệp lỗi.
 * Nhận: giàn, chữ lệnh, agent (mặc định: chủ sở hữu của giàn), tín hiệu.
 * Trả: giá trị hoặc thông điệp lỗi.
 */
async function call(
  rig: Rig,
  command: string,
  agent: object | undefined = rig.owner,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ value?: string; error?: string }> {
  try {
    return { value: await rig.tool().execute({ command }, { agent, signal }) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Chuẩn hoá nonce trong chuỗi gửi vào PTY để hai bên so được với nhau.
 * Nhận: chữ đã gửi.
 * Trả: chữ với nonce thay bằng <start>/<end>.
 */
function normalizeSent(text: string): string {
  return text
    .replaceAll(/__DSH_PERSISTENT_PWSH_START_[0-9a-f-]+__/g, "<start>")
    .replaceAll(/__DSH_PERSISTENT_PWSH_END_[0-9a-f-]+:/g, "<end>");
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: văn bản artifact.
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

/** Hình dạng package.json của gói ta mà test đọc. */
interface PkgJson {
  /** Tên package. */
  name: string;
  /** Khoá exports. */
  exports?: Record<string, unknown>;
  /** Peer khai báo. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật. */
  dependencies?: Record<string, string>;
  /** Metadata gbh. */
  gbh?: {
    row?: unknown;
    peers?: string[];
    tests?: string[];
    nested?: { kind?: string; pluginId?: string; stockId?: string; presets?: string[] };
  };
}

/**
 * Đọc package.json của gói ta.
 * Nhận: không.
 * Trả: nội dung đã parse.
 */
function pkgJson(): PkgJson {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PkgJson;
}

/**
 * Băm SHA-256 một buffer.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

describe("bề mặt gói: đo trên ARTIFACT của ta vs bundle gốc", () => {
  test("artefact BYTE-IDENTICAL bundle gốc (delta 0) + tập export runtime BẰNG", () => {
    const out = mkdtempSync(join(tmpdir(), "gbh-tpp-"));
    try {
      const artifact = buildPackage(out);
      const built = readFileSync(artifact);
      const stockBytes = readFileSync(STOCK_FILE);
      // 06/11/2026 (P1b): artefact mang id CỦA TA ⇒ chuẩn hoá id về dạng gốc rồi mới so byte/sha với stock.
      const builtChuan = Buffer.from(chuanHoaHost(built.toString("utf8")), "utf8");
      expect(builtChuan.length).toBe(stockBytes.length);
      expect(builtChuan.equals(stockBytes)).toBe(true);
      expect(sha256(builtChuan)).toBe(sha256(stockBytes));
      expect(sha256(builtChuan)).toBe("b9ecb0e226244bf7da74519a9d725feaab6efbc6ce1e74e97f1c7d68261499a9");
      // Vai trò ĐẢO: id ta có mặt trong artefact.
      expect(built.toString("utf8").includes("@galaxy-blackhole/gbh-")).toBe(true);
      expect(Buffer.from(assembleBundle(), "utf8").equals(stockBytes)).toBe(true);
      expect(exportNames(built.toString("utf8"))).toEqual(exportNames(STOCK_TEXT));
      expect(exportNames(built.toString("utf8"))).toEqual(["Config", "apply", "inject", "name"]);
      // 06/11/2026 (P1b): artefact mang id GBH ⇒ vế của TA kiểm id ĐÃ ĐỔI (bảng tường minh vì row `tools`
      // có id không theo quy ước: `dsh-tools → gbh-host-tools`); GIỮ NGUYÊN vế kiểm bundle gốc.
      for (const [specifier, ourSpecifier] of [
        // 06/11/2026 (P1b): schemastery là KERNEL ⇒ GIỮ id stock (ADR-0030), không đổi sang id ta.
        ["@deepseek-ai/schemastery", "@deepseek-ai/schemastery"],
        ["@deepseek-ai/dsh-output-retention", "@galaxy-blackhole/gbh-output-retention"],
        ["@deepseek-ai/dsh-timeout", "@galaxy-blackhole/gbh-timeout"],
        ["@deepseek-ai/dsh-tools", "@galaxy-blackhole/gbh-host-tools"],
      ] as const) {
        expect(built.toString("utf8").includes('from "' + ourSpecifier + '"')).toBe(true);
        expect(STOCK_TEXT.includes('from "' + specifier + '"')).toBe(true);
      }
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("name · inject · String(Config) TRÙNG bản gốc; 5 cấu hình (mặc định + 4 ghi đè) trùng", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("tool-pwsh-persistent");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["tools", "terminals", "workingDirectory"]);
    expect(String(ours.Config)).toBe(String(stock.Config));
    const raws: Record<string, unknown>[] = [
      {},
      { backendType: "custom" },
      { timeoutMs: 1234 },
      { maxOutputChars: 99 },
      { description: "chạy lệnh" },
    ];
    for (const raw of raws) expect(configOf(ours, raw)).toEqual(configOf(stock, raw));
    const defaultConfig = configOf(ours) as Record<string, unknown>;
    expect(defaultConfig["backendType"]).toBe("shell");
    expect(defaultConfig["timeoutMs"]).toBe(300000);
    expect(defaultConfig["maxOutputChars"]).toBe(16000);
    expect(String(defaultConfig["description"])).toContain("persistent PowerShell shell");
  });

  test("apply TỪ CHỐI bốn cấu hình sai với CÙNG thông điệp, và KHÔNG đăng ký tool", () => {
    const cases: { raw: Record<string, unknown>; expected: string }[] = [
      { raw: { backendType: "  " }, expected: "tool-pwsh-persistent: backendType must be non-empty" },
      { raw: { timeoutMs: 0 }, expected: "tool-pwsh-persistent: timeoutMs must be a positive safe integer" },
      { raw: { maxOutputChars: 1.5 }, expected: "tool-pwsh-persistent: maxOutputChars must be a positive safe integer" },
      { raw: { description: " " }, expected: "tool-pwsh-persistent: description must be non-empty" },
    ];
    for (const entry of cases) {
      const messages: string[] = [];
      for (const plugin of [ours, stock]) {
        const rig = makeRig();
        try {
          plugin.apply(rig.ctx, entry.raw);
          messages.push("KHONG NEM");
        } catch (error) {
          messages.push((error as Error).message);
        }
        expect(() => rig.tool()).toThrow("apply không đăng ký tool nào");
      }
      expect(messages[0]).toBe(messages[1]);
      expect(messages[0]).toBe(entry.expected);
    }
  });

  test("apply đăng ký ĐÚNG một tool 'pwsh' + hook dọn trên ctx; inject đúng ba dịch vụ", () => {
    for (const plugin of [ours, stock]) {
      const rig = makeRig();
      install(plugin, rig);
      expect(plugin.inject).toEqual(["tools", "terminals", "workingDirectory"]);
      expect(rig.tool().name).toBe("pwsh");
      expect(rig.effects.map((entry) => entry.label)).toEqual(["tool-pwsh-persistent shell cleanup"]);
      expect(rig.ownerEffects).toEqual([]);
      expect(rig.spawns).toEqual([]);
    }
  });

  test("định nghĩa tool TRÙNG bản gốc: tên · mô tả · tham số · output · presentCall", () => {
    const ourRig = makeRig();
    const stockRig = makeRig();
    install(ours, ourRig);
    install(stock, stockRig);
    const ourTool = ourRig.tool();
    const stockTool = stockRig.tool();
    expect(ourTool.name).toBe(stockTool.name);
    expect(ourTool.name).toBe("pwsh");
    expect(ourTool.description).toBe(stockTool.description);
    expect(ourTool.parameters).toEqual(stockTool.parameters);
    expect(ourTool.output.schema).toEqual(stockTool.output.schema);
    expect(ourTool.output.render({}, "abc")).toEqual(stockTool.output.render({}, "abc"));
    expect(ourTool.presentCall({ command: "Get-ChildItem" })).toEqual(stockTool.presentCall({ command: "Get-ChildItem" }));
    expect(ourTool.presentCall({ command: "Get-ChildItem" })).toEqual({ card: "terminal", title: "Get-ChildItem" });
  });
});

describe("thi hành lệnh — đối chứng TỪNG KẾT CỤC trên seam PTY giả 100%", () => {
  test("đường hạnh phúc: chuỗi gửi (đã chuẩn hoá nonce) + kết quả TRÙNG bản gốc", async () => {
    const traces: { value?: string; error?: string; sent: string[]; spawns: unknown[]; processKills: string[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "hello from pwsh" });
      install(plugin, rig);
      const result = await call(rig, "Get-Date");
      traces.push({ ...result, sent: rig.sent.map((entry) => normalizeSent(entry.text)), spawns: rig.spawns, processKills: rig.processKills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toBe("hello from pwsh");
    expect(traces[0]?.sent).toHaveLength(1);
    expect(traces[0]?.sent[0]).toContain("<start>");
    expect(traces[0]?.sent[0]).toContain('Invoke-Expression "Get-Date"');
    expect(traces[0]?.sent[0]).toContain("<end>");
    expect(traces[0]?.spawns).toEqual([{ type: "shell", cwd: "/tmp/workspace" }]);
    expect(traces[0]?.processKills).toEqual([]);
  });

  test("mã thoát KHÁC 0 ⇒ nối dấu [exit code: N] (cả hai bản)", async () => {
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "boom", exitCode: 3 });
      install(plugin, rig);
      expect((await call(rig, "throw 1")).value).toBe("boom\n[exit code: 3]");
    }
  });

  test("escape lệnh: dấu huyền, nháy kép, đô-la, xuống dòng — TRÙNG bản gốc từng ký tự", async () => {
    const command = "Write-Output " + BACKTICK + "$env:PATH ; echo a" + BACKTICK + "nb";
    const traces: string[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "ok" });
      install(plugin, rig);
      await call(rig, command);
      traces.push(normalizeSent(rig.sent[0]?.text ?? ""));
    }
    expect(traces[0]).toBe(traces[1]);
    expect((traces[0] ?? "").includes(BACKTICK + BACKTICK + "$env:PATH")).toBe(true);
    expect((traces[0] ?? "").includes(BACKTICK + "n")).toBe(true);
  });

  test("shell đã THOÁT ⇒ dấu thoát + câu báo đặt lại, và shell được kill", async () => {
    const traces: { value?: string; error?: string; kills: unknown[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "first" });
      install(plugin, rig);
      await call(rig, "Get-Date");
      const id = [...rig.sessions.keys()][0] as string;
      rig.sessions.set(id, { ...(rig.sessions.get(id) as Session), status: { kind: "exited", exitCode: 3, signal: null } });
      const result = await call(rig, "Get-Date");
      traces.push({ ...result, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toContain("[shell exited: code 3]");
    expect(traces[0]?.value).toContain("The persistent pwsh shell was reset");
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent pwsh shell exited" }]);
  });

  test("hết hạn chót ⇒ câu báo timeout + đặt lại shell (cả hai bản)", async () => {
    const traces: { value?: string; error?: string; kills: unknown[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "partial", noEnd: true, delayMs: 40 });
      install(plugin, rig, { timeoutMs: 5 });
      const result = await call(rig, "Start-Sleep -Seconds 99");
      traces.push({ ...result, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toContain("Your command timed out after 0 seconds or experienced an OOM error.");
    expect(traces[0]?.value).toContain("The persistent pwsh shell was reset");
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent pwsh command timed out" }]);
  });

  test("chờ vì stdin_read ⇒ trả phần đầu ra đang có, KHÔNG đặt lại shell (cả hai bản)", async () => {
    const traces: { value?: string; kills: unknown[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "Enter your name:", noEnd: true, waitReason: "stdin_read" });
      install(plugin, rig);
      const result = await call(rig, "Read-Host");
      traces.push({ value: result.value, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toBe("Enter your name:");
    expect(traces[0]?.kills).toEqual([]);
  });

  test("trần ký tự: cắt + nối câu TRUNCATED giống bản gốc; mã thoát 0 KHÔNG nối dấu", async () => {
    const output = "x".repeat(50);
    const traces: (string | undefined)[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output });
      install(plugin, rig, { maxOutputChars: 10 });
      traces.push((await call(rig, "echo")).value);
    }
    expect(traces[0]).toBe(traces[1]);
    expect((traces[0] ?? "").includes("<response clipped><NOTE>")).toBe(true);
    expect((traces[0] ?? "").includes("[exit code:")).toBe(false);
  });

  test("lệnh rỗng và agent thiếu ⇒ ném CÙNG thông điệp", async () => {
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "x" });
      install(plugin, rig);
      expect((await call(rig, "   ")).error).toBe("command must be a non-empty string");
      const missingAgent = await rig
        .tool()
        .execute({ command: "Get-Date" }, { signal: new AbortController().signal })
        .then(
          () => "KHONG NEM",
          (error: Error) => error.message,
        );
      expect(missingAgent).toBe("pwsh requires an owning agent session");
      expect(rig.sent).toEqual([]);
    }
  });

  test("tín hiệu đã huỷ TRƯỚC khi chạy ⇒ trả chuỗi RỖNG, không spawn (cả hai bản)", async () => {
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "x" });
      install(plugin, rig);
      const controller = new AbortController();
      controller.abort();
      expect(await call(rig, "Get-Date", rig.owner, controller.signal)).toEqual({ value: "" });
      expect(rig.sent).toEqual([]);
      expect(rig.spawns).toEqual([]);
    }
  });

  test("huỷ GIỮA chừng ⇒ trả chuỗi rỗng + đặt lại shell với lý do aborted (cả hai bản)", async () => {
    const traces: { value?: string; kills: unknown[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "slow", noEnd: true, delayMs: 40 });
      install(plugin, rig);
      const controller = new AbortController();
      const pending = call(rig, "Start-Sleep -Seconds 99", rig.owner, controller.signal);
      setTimeout(() => controller.abort(), 5);
      const result = await pending;
      traces.push({ value: result.value, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toBe("");
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent pwsh command aborted" }]);
  });

  test("tuần tự theo CHỦ SỞ HỮU: hai lệnh đồng thời KHÔNG chồng lên nhau", async () => {
    const orders: string[][] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "ok", delayMs: 10 });
      install(plugin, rig);
      const order: string[] = [];
      const first = rig
        .tool()
        .execute({ command: "a" }, { agent: rig.owner, signal: new AbortController().signal })
        .then(() => order.push("a"));
      const second = rig
        .tool()
        .execute({ command: "b" }, { agent: rig.owner, signal: new AbortController().signal })
        .then(() => order.push("b"));
      await Promise.all([first, second]);
      orders.push(order);
    }
    expect(orders[0]).toEqual(orders[1]);
    expect(orders[0]).toEqual(["a", "b"]);
  });
});

describe("vòng đời + quy ước repo", () => {
  test("dọn fiber: kill shell đang sống với lý do disposed (cả hai bản)", async () => {
    const traces: { kills: unknown[]; labels: unknown[]; ownerLabels: unknown[] }[] = [];
    for (const plugin of [ours, stock]) {
      const rig = makeRig({ output: "ok" });
      install(plugin, rig);
      await call(rig, "Get-Date");
      const cleanup = rig.effects.find((entry) => entry.label === "tool-pwsh-persistent shell cleanup");
      expect(cleanup).toBeDefined();
      await cleanup?.dispose();
      traces.push({
        kills: rig.kills,
        labels: rig.effects.map((entry) => entry.label),
        ownerLabels: rig.ownerEffects.map((entry) => entry.label),
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "tool-pwsh-persistent disposed" }]);
    expect(traces[0]?.ownerLabels).toEqual(["tool-pwsh-persistent owner cache cleanup"]);
  });

  test("package.json: gbh.nested kind 'group' (persistent-pwsh trong nhóm persistent-shell), KHÔNG gbh.row", () => {
    const json = pkgJson();
    expect(json.name).toBe("@galaxy-blackhole/gbh-tool-pwsh-persistent");
    expect(json.gbh?.row).toBe(undefined);
    expect(json.gbh?.nested).toEqual({
      kind: "group",
      pluginId: "persistent-pwsh",
      stockId: "@deepseek-ai/dsh-tool-pwsh-persistent",
      presets: ["persistent-shell"],
    });
    expect(json.gbh?.tests).toEqual(["tests/host/tool-pwsh-persistent.test.ts"]);
    const stockJson = JSON.parse(readFileSync(join(STOCK_PKG, "package.json"), "utf8")) as PkgJson;
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    const peers = Object.keys(json.peerDependencies ?? {}).concat(Object.keys(json.dependencies ?? {}));
    expect(json.gbh?.peers).toEqual(peers);
    expect(Object.keys(json.exports ?? {})).toEqual([".", "./locale/*.json", "./package.json"]);
    const require = createRequire(join(PKG, "package.json"));
    for (const name of json.gbh?.peers ?? []) expect(typeof require.resolve(name)).toBe("string");
  });

  test("locale en/zh byte-for-byte + export '.', locale, package.json", () => {
    for (const file of ["en.json", "zh.json"]) {
      expect(existsSync(join(STOCK_PKG, "locale", file))).toBe(true);
      expect(readFileSync(join(PKG, "locale", file))).toEqual(readFileSync(join(STOCK_PKG, "locale", file)));
    }
  });
});
