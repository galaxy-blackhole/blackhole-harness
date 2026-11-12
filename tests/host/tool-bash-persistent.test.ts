/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test đối chứng (A/B) cho @galaxy-blackhole/gbh-tool-bash-persistent: A = bundle gốc trong kernel,
 *      B = artefact của ta. Mỗi ca dựng HAI giàn giống hệt nhau trên Context cordis THẬT với seam PTY GIẢ
 *      100% (KHÔNG spawn shell/tiến trình thật) rồi chạy CẢ HAI bản cài: so tập export, String(Config)+5
 *      config, đăng ký tool/service/hook, và các kết cục thi hành lệnh (thành công · mã thoát · shell thoát
 *      · hết hạn · huỷ · stdin_read · lỗi seam).
 */
import { normalizePackageNames, sameAfterIdMap } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/tool-bash-persistent/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "tool-bash-persistent");
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-bash-persistent");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/**
 * Dump parity TRONG REPO dùng làm bằng chứng cấu trúc: preset "preset-minimal" › NHÓM cordis:group
 * "persistent-shell" › entry LỒNG "persistent-bash". Dump MỚI NHẤT /tmp/dump-now2.txt (19/10/2026) cho
 * CÙNG cấu trúc ở dòng 1169/1198/1211 — số đo ghi trong package.json (gbh.draft) + README.
 */
const DUMP = join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml");
/** Số byte của bundle gốc (đo tại thời điểm port). */
const STOCK_BYTES = 16069;
/** Số dòng của bundle gốc. */
const STOCK_LINES = 394;
/** Bốn export runtime của bản gốc. */
const EXPORT_NAMES = ["Config", "apply", "inject", "name"];

/** Context cordis THẬT: chỉ ba seam tools/terminals/workingDirectory và effect được đắp thêm. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Dạng module mà cả hai bản cài phơi ra. */
interface Plugin {
  /** Tên plugin. */
  name: string;
  /** Dịch vụ kernel cần có. */
  inject: string[];
  /** Lược đồ cấu hình (schemastery) — helper THUẦN duy nhất được export. */
  Config: ((value?: unknown) => unknown) & { toString(): string };
  /** Cài plugin lên một Context. */
  apply(ctx: unknown, config: unknown): void;
}

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as unknown as Plugin;
/** Artefact của ta: build ĐỒNG BỘ vào lib cạnh gói rồi nạp (cùng đường dẫn ⇒ CÙNG phép phân giải phụ thuộc). */
const artefactPath = buildPackage();
/** Bản của ta nhìn qua cùng hình dạng. */
const mine = (await import(artefactPath)) as unknown as Plugin;

/** Một trang vùng đệm cuộn giả. */
interface Page {
  /** Chữ còn giữ. */
  text: string;
  /** Số dòng còn giữ. */
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

/** Phiên PTY giả (KHÔNG có tiến trình thật nào phía sau). */
interface Session {
  /** Id phiên. */
  sessionId: string;
  /** Loại backend. */
  type: string;
  /** Trạng thái đầu phiên. */
  status: Status;
}

/** Kịch bản phản hồi của seam giả. */
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
  /** Trạng thái trả về cho lần gửi LỆNH (nhánh "sessionStatus exited"). */
  commandExits?: Status;
  /** Trạng thái trả về cho lần gửi KHỞI TẠO (nhánh "did not accept initialization"). */
  initExits?: Status;
  /** Lần gửi LỆNH ném lỗi này (nhánh seam hỏng). */
  sendError?: string;
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
  /** Tên các thuộc tính Context mà bản cài ĐÃ CHẠM (đo đăng ký tool/service/hook). */
  touched(): string[];
  /** Promise chốt khi lần gửi LỆNH đầu tiên đã tới seam (dùng cho ca huỷ giữa chừng). */
  commandSent: Promise<void>;
}
/**
 * Dựng giàn cho MỘT bên cài: seam PTY giả điều khiển được + seam thư mục + sổ tool ghi vết,
 * trên một Context cordis THẬT.
 * Nhận: kịch bản phản hồi của seam giả.
 * Trả: giàn đo.
 */
function makeRig(reply: Reply = {}): Rig {
  const tools: ToolDefinitionLike[] = [];
  const sent: Rig["sent"] = [];
  const kills: Rig["kills"] = [];
  const spawns: Rig["spawns"] = [];
  const effects: Rig["effects"] = [];
  const ownerEffects: Rig["ownerEffects"] = [];
  const touched = new Set<string>();
  const sessions = new Map<string, Session>();
  const pages = new Map<string, Page>();
  let counter = 0;
  let markCommandSent = (): void => undefined;
  const commandSent = new Promise<void>((resolve) => {
    markCommandSent = resolve;
  });
  const owner: OwnerLike = {
    id: "agent-1",
    ctx: {
      effect(callback: () => () => void, label: string) {
        ownerEffects.push({ label, dispose: callback() });
        return () => undefined;
      },
    },
  };
  const emptyPage = (): Page => ({ text: "", totalLines: 0, lineBegin: 0, lineEnd: 0, truncated: false });
  const registry = {
    spawn(_owner: object, request: { type: string; cwd?: string }): Promise<Session> {
      counter += 1;
      const session: Session = { sessionId: "pty-" + String(counter), type: request.type, status: { kind: "running" } };
      sessions.set(session.sessionId, session);
      pages.set(session.sessionId, emptyPage());
      spawns.push({ type: request.type, cwd: request.cwd });
      return Promise.resolve(session);
    },
    list(caller: object): Session[] {
      return caller === owner ? [...sessions.values()] : [];
    },
    read(_owner: object, id: string): Page {
      return pages.get(id) ?? emptyPage();
    },
    startSend(_owner: object, id: string, request: { text: string; submit: boolean; signal?: AbortSignal }) {
      sent.push({ text: request.text, submit: request.submit });
      const isCommand = START_RE.test(request.text);
      if (isCommand) markCommandSent();
      if (request.submit && isCommand) {
        const startMarker = START_RE.exec(request.text)?.[0] ?? "";
        const endMarker = END_RE.exec(request.text)?.[0] ?? "";
        const body = (reply.output ?? "") + LF;
        const tail = reply.noEnd === true ? "" : endMarker + String(reply.exitCode ?? 0) + LF;
        pages.set(id, {
          text: startMarker + LF + body + tail,
          totalLines: 1,
          lineBegin: 0,
          lineEnd: 1,
          truncated: false,
        });
      }
      const status: Status = (isCommand ? reply.commandExits : reply.initExits) ?? { kind: "running" };
      const done = new Promise<{ viewport: string; waitReason: string; sessionStatus: Status; truncated: boolean }>(
        (resolve, reject) => {
          let settled = false;
          const settle = (): void => {
            if (settled) return;
            settled = true;
            resolve({
              viewport: "",
              waitReason: reply.waitReason ?? "inferred_idle",
              sessionStatus: status,
              truncated: false,
            });
          };
          if (isCommand && reply.sendError !== undefined) {
            settled = true;
            reject(new Error(reply.sendError));
            return;
          }
          request.signal?.addEventListener("abort", settle, { once: true });
          if ((reply.delayMs ?? 0) > 0) setTimeout(settle, reply.delayMs ?? 0);
          else settle();
        },
      );
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
      if (typeof prop === "string") touched.add(prop);
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
          effects.push({ label, dispose: callback() });
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
    touched: () => [...touched].sort(),
    commandSent,
  };
}

/** Ký tự xuống dòng — viết bằng mã để tệp nguồn không phải escape. */
const LF = String.fromCharCode(10);
/** Mốc MỞ của bản gốc trong chuỗi gửi. */
const START_RE = /__DSH_PERSISTENT_BASH_START_[0-9a-f-]+__/;
/** Mốc ĐÓNG của bản gốc (kèm dấu hai chấm trước mã thoát). */
const END_RE = /__DSH_PERSISTENT_BASH_END_[0-9a-f-]+:/;
/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(normalizePackageNames(new TextDecoder().decode(bytes))).digest("hex");
}

/**
 * Cấu hình đã qua schema của CHÍNH bên đó.
 * Nhận: plugin — module của bên cài; raw — phần ghi đè thô.
 * Trả: cấu hình đã phân giải.
 */
function configOf(plugin: Plugin, raw: Record<string, unknown> = {}): unknown {
  return plugin.Config(raw);
}

/**
 * Cài MỘT bên lên giàn của nó.
 * Nhận: plugin — module của bên cài; rig — giàn; raw — phần ghi đè cấu hình thô.
 * Trả: không.
 */
function install(plugin: Plugin, rig: Rig, raw: Record<string, unknown> = {}): void {
  plugin.apply(rig.ctx, configOf(plugin, raw));
}

/**
 * Chạy MỘT lệnh qua tool của giàn, trả THÔ kết quả hoặc thông điệp lỗi.
 * Nhận: rig — giàn; command — chữ lệnh; agent — chủ sở hữu (mặc định: chủ của giàn); signal — tín hiệu huỷ.
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
 * Nhận: text — chữ đã gửi.
 * Trả: chữ với nonce thay bằng <start>/<end>.
 */
function normalizeSent(text: string): string {
  return text
    .replaceAll(/__DSH_PERSISTENT_BASH_START_[0-9a-f-]+__/g, "<start>")
    .replaceAll(/__DSH_PERSISTENT_BASH_END_[0-9a-f-]+:/g, "<end>");
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: text — văn bản artefact.
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

/** Hình dạng package.json mà test đọc. */
interface PkgJson {
  /** Tên package. */
  name: string;
  /** Điểm vào. */
  main?: string;
  /** Kiểu module. */
  type?: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Peer khai báo. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật. */
  dependencies?: Record<string, string>;
  /** Metadata gbh (KHÔNG có row — row LỒNG khai bằng nested). */
  gbh?: {
    row?: unknown;
    row_unmounted_ly_do?: unknown;
    peers?: string[];
    tests?: string[];
    draft?: string;
    nested?: Record<string, unknown>;
  };
}

/**
 * Đọc package.json của một gói.
 * Nhận: file — đường dẫn package.json.
 * Trả: nội dung đã parse.
 */
function readPkg(file: string): PkgJson {
  return JSON.parse(readFileSync(file, "utf8")) as PkgJson;
}

/**
 * Đường TỔ TIÊN của một row trong dump YAML, quét `- id:` theo thụt lề (không đoán theo thứ tự dòng).
 * Nhận: text — nội dung dump; id — id row cần tìm (lần xuất hiện ĐẦU TIÊN).
 * Trả: mảng id tổ tiên từ gốc xuống cha; null khi dump không có row đó.
 */
function rowAncestors(text: string, id: string): string[] | null {
  const stack: { indent: number; id: string }[] = [];
  for (const line of text.split("\n")) {
    const match = /^(\s*)- id:\s*(\S+)\s*$/.exec(line);
    if (match === null) continue;
    const indent = (match[1] ?? "").length;
    const current = match[2] ?? "";
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= indent) stack.pop();
    if (current === id) return stack.map((entry) => entry.id);
    stack.push({ indent, id: current });
  }
  return null;
}

/**
 * Cắt NGUYÊN KHỐI của một row trong dump (mọi dòng thụt lề sâu hơn dòng `- id:` của nó).
 * Nhận: text — nội dung dump; id — id row cần lấy.
 * Trả: văn bản khối (đã bỏ phần thụt lề của chính dòng id); null khi không thấy row.
 */
function rowBlock(text: string, id: string): string | null {
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)- id:\s*(\S+)\s*$/.exec(lines[index] ?? "");
    if (match === null || match[2] !== id) continue;
    const indent = (match[1] ?? "").length;
    const block: string[] = [(lines[index] ?? "").slice(indent)];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next] ?? "";
      const nextIndent = line.length - line.trimStart().length;
      if (line.trim() !== "" && nextIndent <= indent) break;
      block.push(line);
    }
    return block.join("\n");
  }
  return null;
}

describe("A · cổng BYTE + bề mặt module", () => {
  test("artefact của ta CÙNG BYTE với bundle gốc (16 069 B · 394 dòng · sha256)", () => {
    const ourBytes = readFileSync(artefactPath);
    const stockBytes = readFileSync(STOCK);
    expect(ourBytes.equals(stockBytes)).toBe(true);
    expect(ourBytes.length).toBe(STOCK_BYTES);
    expect(stockBytes.length).toBe(STOCK_BYTES);
    expect(statSync(artefactPath).size).toBe(STOCK_BYTES);
    expect((ourBytes.toString("utf8").match(/\n/gu) ?? []).length).toBe(STOCK_LINES);
    expect(sha256(ourBytes)).toBe(sha256(stockBytes));
  });

  test("tập export runtime: đúng 4 tên {Config, apply, inject, name} — KHÔNG helper thuần nào export", () => {
    expect(Object.keys(mine).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(mine).sort()).toEqual([...EXPORT_NAMES].sort());
    expect(exportNames(readFileSync(artefactPath, "utf8"))).toEqual(exportNames(readFileSync(STOCK, "utf8")));
    expect(exportNames(readFileSync(artefactPath, "utf8"))).toEqual([...EXPORT_NAMES].sort());
    expect((mine as unknown as { default?: unknown }).default).toBeUndefined();
    expect((stock as unknown as { default?: unknown }).default).toBeUndefined();
    expect(mine.name).toBe(stock.name);
    expect(mine.name).toBe("tool-bash-persistent");
    expect(mine.inject).toEqual(stock.inject);
    expect(mine.inject).toEqual(["tools", "terminals", "workingDirectory"]);
  });

  test("PROCESS GIẢ 100%: artefact KHÔNG nạp child_process/node-pty, mọi I/O đi qua seam ctx.terminals", () => {
    const text = readFileSync(artefactPath, "utf8");
    expect(text.includes("node:child_process")).toBe(false);
    expect(text.includes("node-pty")).toBe(false);
    expect(text.includes("Bun.spawn")).toBe(false);
    expect(text.includes("process.kill")).toBe(false);
    expect(text.includes('@deepseek-ai/dsh-terminal"')).toBe(false);
    const rig = makeRig({ output: "x" });
    install(mine, rig);
    expect(rig.spawns).toEqual([]);
  });
});

describe("B · Config (helper THUẦN duy nhất export) A/B", () => {
  test("String(Config) + 5 config (mặc định · ghi đè cả bốn · khoá lạ · sai kiểu × 2) khớp từng chữ", () => {
    const scenario = (plugin: Plugin) => {
      const failure = (raw: unknown): string => {
        try {
          plugin.Config(raw);
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      };
      return {
        text: String(plugin.Config),
        empty: plugin.Config(),
        custom: plugin.Config({ backendType: "shell", timeoutMs: 5, maxOutputChars: 10, description: "mo ta" }),
        unknownKey: plugin.Config({ khongBiet: 1 }),
        wrongTimeout: failure({ timeoutMs: "x" }),
        wrongBackend: failure({ backendType: 5 }),
      };
    };
    const ours = scenario(mine);
    const theirs = scenario(stock);
    expect(ours).toEqual(theirs);
    expect(ours.text).toBe("{ backendType?: string, timeoutMs?: number, maxOutputChars?: number, description?: string }");
    const defaults = ours.empty as Record<string, unknown>;
    expect(defaults["backendType"]).toBe("shell");
    expect(defaults["timeoutMs"]).toBe(300000);
    expect(defaults["maxOutputChars"]).toBe(16000);
    expect(String(defaults["description"])).toContain("persistent bash shell");
    const custom = ours.custom as Record<string, unknown>;
    expect(custom).toEqual({ backendType: "shell", timeoutMs: 5, maxOutputChars: 10, description: "mo ta" });
    expect((ours.unknownKey as Record<string, unknown>)["khongBiet"]).toBe(1);
    expect(ours.wrongTimeout).toBe("$.timeoutMs expected number but got x");
    expect(ours.wrongBackend).toBe("$.backendType expected string but got 5");
  });
});
describe("C · apply trên Context cordis THẬT: tool + service + hook", () => {
  test("apply: ĐÚNG 1 tool 'bash' (mô tả/tham số/output/presentCall) + hook shell cleanup; CHƯA chạm seam PTY", () => {
    const ourRig = makeRig();
    const stockRig = makeRig();
    install(mine, ourRig);
    install(stock, stockRig);
    const ourTool = ourRig.tool();
    const stockTool = stockRig.tool();
    expect(ourTool.name).toBe(stockTool.name);
    expect(ourTool.name).toBe("bash");
    expect(ourTool.description).toBe(stockTool.description);
    expect(ourTool.description).toBe(
      "Run commands in a persistent bash shell. State, including the current directory and exported environment variables, persists across calls for this agent.",
    );
    expect(ourTool.parameters).toEqual(stockTool.parameters);
    expect(Object.keys(ourTool.parameters)).toEqual(["type", "properties", "required"]);
    expect(ourTool.parameters["type"]).toBe("object");
    expect(ourTool.parameters["required"]).toEqual(["command"]);
    expect(Object.keys(ourTool.parameters["properties"] as Record<string, unknown>)).toEqual(["command"]);
    expect(ourTool.output.schema).toEqual(stockTool.output.schema);
    expect(ourTool.output.render({}, "abc")).toEqual(stockTool.output.render({}, "abc"));
    expect(ourTool.output.render({}, "abc")).toEqual([{ type: "text", text: "abc" }]);
    expect(ourTool.presentCall({ command: "ls -la" })).toEqual(stockTool.presentCall({ command: "ls -la" }));
    expect(ourTool.presentCall({ command: "ls -la" })).toEqual({ card: "terminal", title: "ls -la" });
    // Hook: đúng MỘT effect trên ctx của plugin, chưa có effect nào trên owner (đăng ký LƯỜI lúc spawn).
    expect(ourRig.effects.map((entry) => entry.label)).toEqual(["tool-bash-persistent shell cleanup"]);
    expect(stockRig.effects.map((entry) => entry.label)).toEqual(["tool-bash-persistent shell cleanup"]);
    expect(ourRig.ownerEffects).toEqual([]);
    // apply KHÔNG chạm seam PTY/thư mục: chỉ tools + effect.
    expect(ourRig.touched()).toEqual(["effect", "tools"]);
    expect(stockRig.touched()).toEqual(["effect", "tools"]);
  });

  test("apply TỪ CHỐI 4 cấu hình sai với CÙNG thông điệp và KHÔNG đăng ký tool", () => {
    const cases: { raw: Record<string, unknown>; expected: string }[] = [
      { raw: { backendType: "  " }, expected: "tool-bash-persistent: backendType must be non-empty" },
      { raw: { timeoutMs: 0 }, expected: "tool-bash-persistent: timeoutMs must be a positive safe integer" },
      {
        raw: { maxOutputChars: 1.5 },
        expected: "tool-bash-persistent: maxOutputChars must be a positive safe integer",
      },
      { raw: { description: " " }, expected: "tool-bash-persistent: description must be non-empty" },
    ];
    for (const entry of cases) {
      const messages: string[] = [];
      for (const plugin of [mine, stock]) {
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
});

describe("D · thi hành lệnh trên seam PTY GIẢ", () => {
  test("đường hạnh phúc: khởi tạo stty + chuỗi gửi (đã chuẩn hoá nonce) + kết quả TRÙNG bản gốc", async () => {
    const traces: { value?: string; error?: string; sent: string[]; submits: boolean[]; spawns: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "hello from bash" });
      install(plugin, rig);
      const result = await call(rig, "echo hi");
      traces.push({
        ...result,
        sent: rig.sent.map((entry) => normalizeSent(entry.text)),
        submits: rig.sent.map((entry) => entry.submit),
        spawns: rig.spawns,
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toBe("hello from bash" + LF + "[Command finished with exit code 0]");
    expect(traces[0]?.sent).toHaveLength(2);
    expect(traces[0]?.sent[0]).toBe("stty -echo");
    expect(traces[0]?.submits).toEqual([true, true]);
    const wrapped = traces[0]?.sent[1] ?? "";
    expect(wrapped).toContain("printf '%s");
    expect(wrapped).toContain("$'<start>'");
    expect(wrapped).toContain("; eval -- $'echo hi'; ");
    expect(wrapped).toContain("__dsh_persistent_bash_status=$?");
    expect(wrapped).toContain("$'<end>'");
    expect(traces[0]?.spawns).toEqual([{ type: "shell", cwd: "/tmp/workspace" }]);
  });

  test("mã thoát KHÁC 0 ⇒ dấu [Command finished with exit code 3] (cả hai bản)", async () => {
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "boom", exitCode: 3 });
      install(plugin, rig);
      const result = await call(rig, "exit 3");
      expect(result.value).toBe("boom" + LF + "[Command finished with exit code 3]");
    }
  });

  test("escape lệnh bash: nháy đơn · chéo ngược · xuống dòng · nháy kép — TRÙNG bản gốc từng ký tự", async () => {
    const command = "echo 'a" + String.fromCharCode(92) + "b'" + LF + 'echo "hi"';
    const traces: string[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "ok" });
      install(plugin, rig);
      await call(rig, command);
      traces.push(normalizeSent(rig.sent[1]?.text ?? ""));
    }
    expect(traces[0]).toBe(traces[1]);
    expect(traces[0]).toContain("$'echo \\'a\\\\b\\'\\necho \"hi\"'");
    // Nháy kép KHÔNG bị escape (quoteForBash chỉ xử lý chéo ngược · nháy đơn · \\r · \\n).
    expect(traces[0]).toContain('echo "hi"');
    expect(traces[0]?.includes('\\"')).toBe(false);
  });

  test("shell đã THOÁT (list báo exited) ⇒ dấu thoát + câu đặt lại + kill; và nhánh sessionStatus exited", async () => {
    const traces: { value?: string; error?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "first" });
      install(plugin, rig);
      await call(rig, "echo first");
      const id = [...rig.sessions.keys()][0] as string;
      rig.sessions.set(id, { sessionId: id, type: "shell", status: { kind: "exited", exitCode: 3, signal: null } });
      const result = await call(rig, "echo second");
      traces.push({ ...result, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toContain("[shell exited: code 3]");
    expect(traces[0]?.value).toContain("The persistent bash shell was reset");
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent bash shell exited" }]);

    // Nhánh THỨ HAI: phiên thoát ngay trong lần gửi lệnh (result.sessionStatus).
    const second: { value?: string; error?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "bye", noEnd: true, commandExits: { kind: "exited", exitCode: 3, signal: null } });
      install(plugin, rig);
      const result = await call(rig, "echo bye");
      second.push({ ...result, kills: rig.kills });
    }
    expect(second[0]).toEqual(second[1]);
    expect(second[0]?.value).toBe(
      "bye" + LF + "[shell exited: code 3]" + LF +
        "The persistent bash shell was reset; the next bash call starts from the workspace with a fresh current directory and environment.",
    );
    expect(second[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent bash shell exited" }]);
  });

  test("hết hạn chót ⇒ câu timeout + dấu [Command timed out or OOM] + đặt lại shell", async () => {
    const traces: { value?: string; error?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "partial", noEnd: true, delayMs: 40 });
      install(plugin, rig, { timeoutMs: 5 });
      const result = await call(rig, "sleep 99");
      traces.push({ ...result, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toContain("Your command timed out after 0 seconds or experienced an OOM error.");
    expect(traces[0]?.value).toContain("partial");
    expect(traces[0]?.value).toContain("[Command timed out or OOM]");
    expect(traces[0]?.value).toContain("The persistent bash shell was reset");
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent bash command timed out" }]);
  });

  test("huỷ giữa chừng ⇒ chuỗi RỖNG + đặt lại shell; huỷ TRƯỚC khi chạy ⇒ rỗng, không gửi gì", async () => {
    const traces: { value?: string; error?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ noEnd: true, delayMs: 5 });
      install(plugin, rig);
      const controller = new AbortController();
      const running = rig.tool().execute({ command: "sleep 99" }, { agent: rig.owner, signal: controller.signal });
      await rig.commandSent;
      controller.abort(new Error("huy giua chung"));
      let outcome: { value?: string; error?: string };
      try {
        outcome = { value: await running };
      } catch (error) {
        outcome = { error: (error as Error).message };
      }
      traces.push({ ...outcome, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toBe("");
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent bash command aborted" }]);

    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "x" });
      install(plugin, rig);
      const controller = new AbortController();
      controller.abort();
      const result = await call(rig, "echo x", rig.owner, controller.signal);
      expect(result).toEqual({ value: "" });
      expect(rig.sent).toEqual([]);
    }
  });

  test("chờ vì stdin_read ⇒ trả phần đầu ra đang có, KHÔNG đặt lại shell (cả hai bản)", async () => {
    const traces: { value?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "Enter your name:", noEnd: true, waitReason: "stdin_read" });
      install(plugin, rig);
      const result = await call(rig, "read name");
      traces.push({ value: result.value, kills: rig.kills });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.value).toBe("Enter your name:");
    expect(traces[0]?.kills).toEqual([]);
  });

  test("trần ký tự: cắt + nối câu TRUNCATED giống bản gốc; mã thoát 0 VẪN nối dấu", async () => {
    const output = "x".repeat(50);
    const traces: (string | undefined)[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output });
      install(plugin, rig, { maxOutputChars: 10 });
      traces.push((await call(rig, "echo")).value);
    }
    expect(traces[0]).toBe(traces[1]);
    expect((traces[0] ?? "").includes("<response clipped><NOTE>")).toBe(true);
    expect((traces[0] ?? "").includes("[Command finished with exit code 0]")).toBe(true);
    expect((traces[0] ?? "").startsWith("x".repeat(10))).toBe(true);
  });

  test("lỗi seam: gửi lệnh ném ⇒ reset 'send failed' + ném lại; khởi tạo exited ⇒ 'did not accept initialization'", async () => {
    const sendFails: { error?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ sendError: "seam chet" });
      install(plugin, rig);
      const result = await call(rig, "echo x");
      sendFails.push({ error: result.error, kills: rig.kills });
    }
    expect(sendFails[0]).toEqual(sendFails[1]);
    expect(sendFails[0]?.error).toBe("seam chet");
    expect(sendFails[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent bash send failed" }]);

    const initFails: { error?: string; kills: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ initExits: { kind: "exited", exitCode: 1, signal: null } });
      install(plugin, rig);
      const result = await call(rig, "echo x");
      initFails.push({ error: result.error, kills: rig.kills });
    }
    expect(initFails[0]).toEqual(initFails[1]);
    expect(initFails[0]?.error).toBe("persistent bash shell did not accept initialization");
    // Shell ĐÃ spawn rồi mới hỏng khởi tạo ⇒ bản gốc dọn LUÔN phiên đó (reset trong get).
    expect(initFails[0]?.kills).toEqual([{ id: "pty-1", reason: "persistent bash initialization failed" }]);
  });

  test("lệnh rỗng và agent thiếu ⇒ ném CÙNG thông điệp, KHÔNG gửi gì vào PTY", async () => {
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "x" });
      install(plugin, rig);
      expect((await call(rig, "   ")).error).toBe("command must be a non-empty string");
      // Agent THIẾU: gọi thẳng execute để KHÔNG dính tham số mặc định của helper call().
      const missingAgent = await rig
        .tool()
        .execute({ command: "echo x" }, { signal: new AbortController().signal })
        .then(
          () => "KHONG NEM",
          (error: Error) => error.message,
        );
      expect(missingAgent).toBe("bash requires an owning agent session");
      expect(rig.sent).toEqual([]);
    }
  });

  test("tuần tự theo CHỦ SỞ HỮU: hai lệnh đồng thời KHÔNG chồng lên nhau", async () => {
    const orders: string[][] = [];
    for (const plugin of [mine, stock]) {
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
describe("E · vòng đời + quy ước gói", () => {
  test("dọn fiber: kill shell đang sống lý do disposed; owner cache cleanup đăng ký trên owner.ctx", async () => {
    const traces: { kills: unknown[]; labels: unknown[]; ownerLabels: unknown[] }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig({ output: "ok" });
      install(plugin, rig);
      await call(rig, "echo ok");
      const cleanup = rig.effects.find((entry) => entry.label === "tool-bash-persistent shell cleanup");
      expect(cleanup).toBeDefined();
      await cleanup?.dispose();
      traces.push({
        kills: rig.kills,
        labels: rig.effects.map((entry) => entry.label),
        ownerLabels: rig.ownerEffects.map((entry) => entry.label),
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]?.kills).toEqual([{ id: "pty-1", reason: "tool-bash-persistent disposed" }]);
    expect(traces[0]?.labels).toEqual(["tool-bash-persistent shell cleanup"]);
    expect(traces[0]?.ownerLabels).toEqual(["tool-bash-persistent owner cache cleanup"]);
  });

  test("package.json: KHÔNG gbh.row · nested kind 'preset' (preset-minimal) · peers = peer+deps stock · bằng chứng dump", () => {
    const json = readPkg(join(PKG, "package.json"));
    const stockJson = readPkg(join(STOCK_PKG, "package.json"));
    expect(json.name).toBe("@galaxy-blackhole/gbh-tool-bash-persistent");
    expect(json.main).toBe("lib/index.js");
    expect(json.type).toBe("module");
    expect(Object.keys(json.exports ?? {})).toEqual([".", "./locale/*.json", "./package.json"]);
    // 08/11/2026 (dev-5 review + luật Lead): "." phải có điều kiện `types` (lib/types TỒN TẠI trong gói này).
    expect(json.exports?.["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    // peerDependencies + dependencies CHÉP JSON stock (nguyên văn từng khoá/phiên bản).
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.peerDependencies, stockJson.peerDependencies)).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(json.dependencies, stockJson.dependencies)).toBe(true);
    // Entry LỒNG trong PRESET: khai gbh.nested kind 'preset'; TUYỆT ĐỐI KHÔNG khai gbh.row
    // (stock không có row TOP-LEVEL nào ⇒ không bịa row, không khai row_unmounted_ly_do).
    expect(json.gbh?.row).toBe(undefined);
    expect(json.gbh?.row_unmounted_ly_do).toBe(undefined);
    const draft = json.gbh?.draft ?? "";
    expect(draft.includes("KHÔNG khai gbh.row")).toBe(true);
    expect(draft.includes("CHƯA mount/flip")).toBe(true);
    expect(draft.includes("preset-minimal")).toBe(true);
    expect(draft.includes("process.platform === 'win32'")).toBe(true);
    expect(json.gbh?.tests).toEqual(["tests/host/tool-bash-persistent.test.ts"]);
    expect(json.gbh?.nested).toEqual({
      kind: "preset",
      pluginId: "persistent-bash",
      stockId: "@deepseek-ai/dsh-tool-bash-persistent",
      presets: ["preset-minimal"],
    });
    const declared = [
      ...Object.keys(stockJson.peerDependencies ?? {}),
      ...Object.keys(stockJson.dependencies ?? {}),
    ].sort();
    expect([...(json.gbh?.peers ?? [])].sort()).toEqual(declared);
    // Bằng chứng DƯƠNG từ dump parity: preset-minimal (top-level) › persistent-shell (cordis:group)
    // › persistent-bash (entry LỒNG) — đo bằng quét thụt lề, không dựa thứ tự dòng.
    const dump = readFileSync(DUMP, "utf8");
    expect(rowAncestors(dump, "persistent-bash")).toEqual(["preset-minimal", "persistent-shell"]);
    expect(rowAncestors(dump, "persistent-shell")).toEqual(["preset-minimal"]);
    // KHÔNG có row TOP-LEVEL nào cho gói này, và tên stock xuất hiện ĐÚNG MỘT lần trong dump.
    expect(dump.includes("\n- id: persistent-bash")).toBe(false);
    expect(dump.includes("\n- id: tool-bash-persistent")).toBe(false);
    expect(dump.split("@deepseek-ai/dsh-tool-bash-persistent").length - 1).toBe(1);
    // Entry LỒNG: name stock + disabled biểu thức !!js + config timeoutMs/description; KHÔNG inject,
    // không lẫn entry anh em (terminal-bash) vào khối.
    const entry = rowBlock(dump, "persistent-bash") ?? "";
    expect(entry).toContain("name: '@deepseek-ai/dsh-tool-bash-persistent'");
    expect(entry).toContain("disabled: !!js process.platform === 'win32'");
    expect(entry).toContain("timeoutMs: 300000");
    expect(entry).toContain("Run commands in a bash shell");
    expect(entry).not.toContain("inject:");
    expect(entry).not.toContain("terminal-bash");
    // NHÓM chứa nó: cordis:group + isolate.terminals: true.
    const group = rowBlock(dump, "persistent-shell") ?? "";
    expect(group).toContain("name: cordis:group");
    expect(group).toContain("group: true");
    expect(group).toContain("terminals: true");
    // Ba preset còn lại KHÔNG chứa entry; nhóm TOP-LEVEL optional-persistent-terminals cũng KHÔNG.
    for (const preset of ["preset-standard", "preset-ptc", "preset-cordis"]) {
      expect(rowBlock(dump, preset) ?? "").not.toContain("dsh-tool-bash-persistent");
    }
    expect(rowBlock(dump, "optional-persistent-terminals") ?? "").not.toContain("dsh-tool-bash-persistent");
  });

  test("locale copy byte-for-byte + symlink node_modules cho MỌI peer/dep đều resolve được", () => {
    for (const file of ["en.json", "zh.json"]) {
      expect(existsSync(join(STOCK_PKG, "locale", file))).toBe(true);
      expect(readFileSync(join(PKG, "locale", file), "utf8")).toBe(
        readFileSync(join(STOCK_PKG, "locale", file), "utf8"),
      );
    }
    const json = readPkg(join(PKG, "package.json"));
    const requireFromPkg = createRequire(join(PKG, "package.json"));
    const declared = [...Object.keys(json.peerDependencies ?? {}), ...Object.keys(json.dependencies ?? {})];
    expect(declared.length).toBe(8);
    for (const name of declared) {
      expect(existsSync(join(PKG, "node_modules", name, "package.json"))).toBe(true);
      expect(requireFromPkg.resolve(name + "/package.json").startsWith(REPO)).toBe(true);
    }
    // Bốn module ngoài mà ARTEFACT nạp lúc chạy — phân giải được từ chính gói.
    const text = readFileSync(artefactPath, "utf8");
    for (const name of [
      "@deepseek-ai/schemastery",
      "@deepseek-ai/dsh-output-retention",
      "@deepseek-ai/dsh-timeout",
      "@deepseek-ai/dsh-tools",
    ]) {
      expect(text.includes('from "' + name + '"')).toBe(true);
      expect(requireFromPkg.resolve(name + "/package.json").startsWith(REPO)).toBe(true);
    }
  });
});
