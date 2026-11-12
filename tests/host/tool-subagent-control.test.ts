/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-tool-subagent-control: artefact NGUYÊN VĂN @deepseek-ai/dsh-tool-subagent-control
 *      (byte-identical + sha) + export surface + 2 tệp lib/types/*.js + locale + metadata §4f (row_unmounted_ly_do +
 *      nested kind:'preset') + chạy THẬT cả hai bản trên CÙNG fixture (send_message · interrupt_agent · list_agents).
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-tool-subagent-control");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "tool-subagent-control");
/** Khoá test khai trong manifest — dùng cho cả row lẫn gbh.tests. */
const TEST_FILE = "tests/host/tool-subagent-control.test.ts";
/** Danh tính nội bộ mà stock gắn lên tool send_message (Symbol.for nên so được giữa hai bản). */
const ADJACENT = Symbol.for("dsh.subagent.adjacentAgentSendMessageTool");

/** Tính sha256 của buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

/** Bề mặt plugin runtime (chỉ trường hai bản cùng có). */
interface PluginApi {
  readonly name: string;
  readonly inject: readonly string[];
  readonly apply: (ctx: unknown) => void;
}

/** Bản ghi agent trong registry giả — plugin chỉ đọc trường status. */
interface AgentRecord { readonly id: string; readonly status: string }

/** Một mục listChildren/listDescendants — đủ mọi hình dạng plugin phân biệt. */
interface ListEntry {
  readonly id: string;
  readonly mode?: string;
  readonly label?: string;
  readonly kind?: string;
  readonly reason?: string;
  readonly parentId?: string;
  readonly depth?: number;
}

/** Fixture dùng CHUNG cho cả hai bản: không mạng, không audio, không chạm hệ thống. */
interface Fixture {
  readonly agents: readonly AgentRecord[];
  readonly children: readonly ListEntry[];
  readonly descendants: readonly ListEntry[];
  readonly messageId: string;
}

/** Một dòng vết gọi seam (JSON thuần để so bằng toEqual). */
interface TraceRow { readonly op: string; readonly detail: unknown }

/** Tool đã đăng ký — đúng bề mặt defineTool trả về. */
interface RegisteredTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: unknown;
  readonly output: {
    readonly schema: unknown;
    readonly render: (args: Record<string, unknown>, value: unknown) => unknown;
  };
  readonly execute: (args: Record<string, unknown>, exec: ExecLike) => Promise<unknown>;
}

/** Tham số thứ hai của execute (plugin chỉ đọc agent + signal). */
interface ExecLike { readonly agent?: { readonly id: string }; readonly signal?: AbortSignal }

/** Một rig = một bản plugin cài trên Context giả, kèm vết gọi seam. */
interface Rig {
  readonly tools: Map<string, RegisteredTool>;
  readonly registered: string[];
  readonly trace: TraceRow[];
}

/** Kết quả một lượt gọi tool: thành công (kèm render) hoặc lỗi (kèm thông điệp). */
interface ActResult {
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: string;
  readonly rendered?: unknown;
}

/** Fixture chuẩn: 2 con continuable (1 running, 1 inactive), 1 one-shot, 1 diagnostic, 1 cháu + 1 diagnostic con. */
const FIXTURE: Fixture = {
  agents: [
    { id: "child-running", status: "running" },
    { id: "child-idle", status: "inactive" },
    { id: "grand-running", status: "running" },
  ],
  children: [
    { id: "child-running", mode: "continuable", label: "Runner" },
    { id: "child-idle", mode: "continuable", label: "Idle" },
    { id: "child-oneshot", mode: "oneshot", label: "One shot" },
    { id: "child-broken", kind: "diagnostic", reason: "corrupt" },
  ],
  descendants: [
    { id: "child-running", mode: "continuable", label: "Runner", parentId: "root", depth: 1 },
    { id: "grand-running", mode: "continuable", label: "Grand", parentId: "child-running", depth: 2 },
    { id: "child-oneshot", mode: "oneshot", label: "One shot", parentId: "root", depth: 1 },
    { id: "deep-broken", kind: "diagnostic", reason: "unavailable", parentId: "child-running", depth: 2 },
  ],
  messageId: "message-1",
};

/**
 * Dựng một rig: Context giả ghi vết ĐÚNG các seam plugin chạm (tools.register · subagents.*).
 * Nhận: api — bề mặt plugin (stock hoặc ours); fixture — dữ liệu trả về của seam.
 * Trả: Rig với map tool đã đăng ký và vết gọi seam.
 */
function makeRig(api: PluginApi, fixture: Fixture): Rig {
  const tools = new Map<string, RegisteredTool>();
  const trace: TraceRow[] = [];
  const agents = new Map<string, AgentRecord>(fixture.agents.map((agent) => [agent.id, agent]));
  const ctx = {
    tools: {
      register(tool: RegisteredTool): void {
        tools.set(tool.name, tool);
        trace.push({ op: "register", detail: tool.name });
      },
    },
    agents,
    subagents: {
      async sendMessage(
        sender: { readonly id: string } | undefined,
        target: string,
        message: unknown,
        options: { readonly signal?: AbortSignal } | undefined,
      ): Promise<string> {
        trace.push({
          op: "sendMessage",
          detail: {
            sender: sender?.id ?? null,
            target,
            message,
            signal: options?.signal === undefined ? "none" : "signal",
          },
        });
        return fixture.messageId;
      },
      interrupt(target: string, options: { readonly kind?: string; readonly agent?: { readonly id: string } } | undefined): void {
        trace.push({
          op: "interrupt",
          detail: { target, kind: options?.kind ?? null, caller: options?.agent?.id ?? null },
        });
      },
      async listChildren(parentId: string, signal?: AbortSignal): Promise<readonly ListEntry[]> {
        trace.push({ op: "listChildren", detail: { parentId, signal: signal === undefined ? "none" : "signal" } });
        return fixture.children;
      },
      async listDescendants(parentId: string, signal?: AbortSignal): Promise<readonly ListEntry[]> {
        trace.push({ op: "listDescendants", detail: { parentId, signal: signal === undefined ? "none" : "signal" } });
        return fixture.descendants;
      },
    },
  };
  api.apply(ctx);
  return { tools, registered: [...tools.keys()], trace };
}

/**
 * Nạp một entry của CẢ hai bản rồi dựng hai rig từ CÙNG fixture.
 * Nhận: entry — "." (lib/index.js) hoặc "./list-agents" (lib/types/list-agents.js).
 * Trả: { a: rig stock, b: rig ours }.
 */
async function rigs(entry: "." | "./list-agents"): Promise<{ a: Rig; b: Rig }> {
  const file = entry === "." ? join("lib", "index.js") : join("lib", "types", "list-agents.js");
  const a = (await import(join(STOCK, file))) as unknown as PluginApi;
  const b = (await import(join(OURS, file))) as unknown as PluginApi;
  return { a: makeRig(a, FIXTURE), b: makeRig(b, FIXTURE) };
}

/**
 * Gọi một tool trên rig rồi ghi lại kết quả (hoặc thông điệp lỗi) — KHÔNG ném ra ngoài.
 * Nhận: rig — nơi gọi; toolName — tên tool; args — tham số; exec — agent/signal của lượt gọi.
 * Trả: ActResult (ok + result/rendered, hoặc error).
 */
async function act(rig: Rig, toolName: string, args: Record<string, unknown>, exec: ExecLike): Promise<ActResult> {
  const tool = rig.tools.get(toolName);
  if (tool === undefined) throw new Error("rig thiếu tool " + toolName);
  try {
    const result = await tool.execute(args, exec);
    return { ok: true, result, rendered: tool.output.render(args, result) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

describe("A · artefact byte-identical", () => {
  test("lib/index.js trùng TỪNG BYTE + cùng sha256", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(ours.equals(stock)).toBe(true);
    expect(sha(ours)).toBe(sha(stock));
    expect(ours.length).toBe(stock.length);
  });

  test("lib/types/*.js: đủ 2 tệp, từng tệp byte-identical", () => {
    const files = readdirSync(join(OURS, "lib/types")).filter((f) => f.endsWith(".js")).sort();
    expect(files).toEqual(["index.js","list-agents.js"]);
    for (const file of files) {
      const ours = readFileSync(join(OURS, "lib/types", file));
      const stock = readFileSync(join(STOCK, "lib/types", file));
      expect(ours.equals(stock)).toBe(true);
    }
  });
});

describe("B · export surface A≡B", () => {
  test("tập export runtime trùng stock (kể cả default) + name/inject trùng", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(typeof ours["default"]).toBe(typeof stock["default"]);
    expect(ours["name"]).toBe(stock["name"]);
    expect(ours["inject"]).toEqual(stock["inject"]);
  });

  test("subpath runtime import chạy được và surface khớp stock", async () => {
    const file = "list-agents.js";
    const ours = (await import(join(OURS, "lib/types", file))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/types", file))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(ours["name"]).toBe(stock["name"]);
    expect(ours["inject"]).toEqual(stock["inject"]);
  });
});

describe("C · locale + provenance", () => {
  test("locale trùng byte-for-byte stock", () => {
    for (const rel of ["en.json","list-agents/en.json","list-agents/zh.json","zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", rel));
      const stock = readFileSync(join(STOCK, "locale", rel));
      expect(ours.equals(stock)).toBe(true);
    }
  });

  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-tool-subagent-control");
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });
});

describe("D · metadata §4f (row TOP-LEVEL tắt + LỒNG 3 preset)", () => {
  // 20/10/2026 (Lead mount 6 gói host-tool): row ĐÃ KHAI + mount ⇒ bất biến mới là `gbh.row` ĐỦ
  // id/moduleIds/aliases/hostAliases/tests; KHÔNG còn `row_unmounted_ly_do`.
  test("row TOP-LEVEL ⇒ gbh.row ĐỦ id/moduleIds/aliases/hostAliases/tests, KHÔNG config/inject, KHÔNG park", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    const row = manifest.gbh["row"] as Record<string, unknown>;
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(row["id"]).toBe("tool-subagent-control");
    expect(row["moduleIds"]).toEqual(["@galaxy-blackhole/gbh-tool-subagent-control"]);
    expect(row["aliases"]).toEqual(["@deepseek-ai/dsh-tool-subagent-control"]);
    expect(row["hostAliases"]).toEqual(["@deepseek-ai/dsh-tool-subagent-control"]);
    expect(row["tests"]).toEqual([TEST_FILE]);
    expect("config" in row).toBe(false);
    expect("inject" in row).toBe(false);
  });

  test("entry LỒNG ⇒ gbh.nested kind:'preset' + 3 preset; KHÔNG khai kind:'group'", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { nested?: Record<string, unknown> } };
    const nested = manifest.gbh.nested as Record<string, unknown>;
    expect(nested["kind"]).toBe("preset");
    expect(nested["pluginId"]).toBe("tool-subagent-control");
    expect(nested["stockId"]).toBe("@deepseek-ai/dsh-tool-subagent-control");
    // 20/10/2026: metadata mount chỉ giữ 4 khoá parity đọc (kind/pluginId/stockId/presets); `presetGroup`
    // chỉ là ghi chú cũ, không bắt buộc — vẫn khẳng định entry nằm trong 3 preset + KHÔNG phải kind group.
    expect(nested["presets"]).toEqual(["preset-standard", "preset-ptc", "preset-cordis"]);
    expect(nested["presets"]).not.toEqual(["delegation"]);
    // 20/10/2026 (Lead mount): metadata mount chỉ giữ 4 khoá parity đọc; ghi chú preset-ptc/minimal
    // đã chuyển về README, không còn trong manifest.
    expect(Object.keys(nested).sort()).toEqual(["kind", "pluginId", "presets", "stockId"]);
  });

  test("tests khai trong gbh.tests đúng tệp tồn tại; exports mirror ĐÚNG subpath runtime stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string>; gbh: { tests: string[] } };
    expect(manifest.gbh.tests).toEqual([TEST_FILE]);
    expect(readFileSync(join(REPO, TEST_FILE), "utf8").length).toBeGreaterThan(0);
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./list-agents", "./list-agents/locale/*.json", "./locale/*.json", "./package.json"]);
    expect(manifest.exports["./list-agents"]).toBe("./lib/types/list-agents.js");
  });
});

describe("E · runtime A/B — HAI bản trên CÙNG fixture", () => {
  test("bề mặt tool: tên · mô tả · schema tham số · schema đầu ra TRÙNG, send_message mang marker nội bộ", async () => {
    const { a, b } = await rigs(".");
    expect(b.registered).toEqual(a.registered);
    expect(b.registered).toEqual(["send_message", "interrupt_agent"]);
    for (const name of a.registered) {
      const toolA = a.tools.get(name) as RegisteredTool;
      const toolB = b.tools.get(name) as RegisteredTool;
      expect(toolB.description).toBe(toolA.description);
      expect(toolB.parameters).toEqual(toolA.parameters);
      expect(toolB.output.schema).toEqual(toolA.output.schema);
    }
    expect(Reflect.get(a.tools.get("send_message") as RegisteredTool, ADJACENT)).toBe(true);
    expect(Reflect.get(b.tools.get("send_message") as RegisteredTool, ADJACENT)).toBe(true);
    expect(Reflect.get(a.tools.get("interrupt_agent") as RegisteredTool, ADJACENT)).toBeUndefined();
    expect(Reflect.get(b.tools.get("interrupt_agent") as RegisteredTool, ADJACENT)).toBeUndefined();
  });

  test("send_message: kết quả + vết seam + render trùng (agent_id được brand nguyên giá trị)", async () => {
    const { a, b } = await rigs(".");
    const args = { agent_id: "child-running", message: "xin chào" };
    const exec = { agent: { id: "root" } };
    const ra = await act(a, "send_message", args, exec);
    const rb = await act(b, "send_message", args, exec);
    expect(rb).toEqual(ra);
    expect(rb.result).toEqual({ messageId: "message-1" });
    expect(rb.rendered).toEqual([{ type: "text", text: "message delivered to agent child-running" }]);
    expect(b.trace).toEqual(a.trace);
    expect(b.trace).toEqual([
      { op: "register", detail: "send_message" },
      { op: "register", detail: "interrupt_agent" },
      { op: "sendMessage", detail: { sender: "root", target: "child-running", message: [{ type: "text", text: "xin chào" }], signal: "none" } },
    ]);
  });

  test("send_message: thiếu exec.agent ⇒ HAI bản ném CÙNG thông điệp, 0 lượt chạm seam", async () => {
    const { a, b } = await rigs(".");
    const args = { agent_id: "child-running", message: "m" };
    const ra = await act(a, "send_message", args, {});
    const rb = await act(b, "send_message", args, {});
    expect(rb).toEqual(ra);
    expect(rb.ok).toBe(false);
    expect(rb.error).toBe("send_message requires a calling agent (exec.agent was undefined)");
    expect(b.trace.filter((row) => row.op === "sendMessage")).toEqual([]);
    expect(b.trace).toEqual(a.trace);
  });

  test("send_message: tham số sai (thiếu message) ⇒ HAI bản cùng bị validate chặn, cùng thông điệp", async () => {
    const { a, b } = await rigs(".");
    const ra = await act(a, "send_message", { agent_id: "child-running" }, { agent: { id: "root" } });
    const rb = await act(b, "send_message", { agent_id: "child-running" }, { agent: { id: "root" } });
    expect(rb).toEqual(ra);
    expect(rb.ok).toBe(false);
    expect(b.trace.filter((row) => row.op === "sendMessage")).toEqual([]);
    expect(b.trace).toEqual(a.trace);
  });

  test("interrupt_agent: kết quả + vết seam + render trùng (kind 'ancestor', đúng caller)", async () => {
    const { a, b } = await rigs(".");
    const args = { agent_id: "grand-running" };
    const exec = { agent: { id: "root" } };
    const ra = await act(a, "interrupt_agent", args, exec);
    const rb = await act(b, "interrupt_agent", args, exec);
    expect(rb).toEqual(ra);
    expect(rb.result).toEqual({ accepted: true });
    expect(rb.rendered).toEqual([{ type: "text", text: "interrupt requested for agent grand-running" }]);
    expect(b.trace).toEqual(a.trace);
    expect(b.trace).toContainEqual({ op: "interrupt", detail: { target: "grand-running", kind: "ancestor", caller: "root" } });
  });

  test("interrupt_agent: thiếu exec.agent ⇒ HAI bản ném CÙNG thông điệp, 0 lượt interrupt", async () => {
    const { a, b } = await rigs(".");
    const ra = await act(a, "interrupt_agent", { agent_id: "grand-running" }, {});
    const rb = await act(b, "interrupt_agent", { agent_id: "grand-running" }, {});
    expect(rb).toEqual(ra);
    expect(rb.ok).toBe(false);
    expect(rb.error).toBe("interrupt_agent requires a calling agent (exec.agent was undefined)");
    expect(b.trace.filter((row) => row.op === "interrupt")).toEqual([]);
    expect(b.trace).toEqual(a.trace);
  });

  test("list_agents children (mặc định): bỏ one-shot, giữ diagnostic, status từ registry — kết quả + render trùng", async () => {
    const { a, b } = await rigs("./list-agents");
    expect(b.registered).toEqual(a.registered);
    expect(b.registered).toEqual(["list_agents"]);
    const ra = await act(a, "list_agents", {}, { agent: { id: "root" } });
    const rb = await act(b, "list_agents", {}, { agent: { id: "root" } });
    expect(rb).toEqual(ra);
    expect(rb.result).toEqual([
      { kind: "child", id: "child-running", label: "Runner", status: "running" },
      { kind: "child", id: "child-idle", label: "Idle", status: "inactive" },
      { kind: "diagnostic", id: "child-broken", reason: "corrupt" },
    ]);
    expect(rb.rendered).toEqual([{ type: "text", text: "child-running [running] — Runner\nchild-idle [inactive] — Idle\nchild-broken [diagnostic: corrupt]" }]);
    expect(b.trace).toEqual(a.trace);
    expect(b.trace).toContainEqual({ op: "listChildren", detail: { parentId: "root", signal: "none" } });
    expect(b.trace.filter((row) => row.op === "listDescendants")).toEqual([]);
  });

  test("list_agents descendants: kèm parent/depth, bỏ one-shot — kết quả + render trùng", async () => {
    const { a, b } = await rigs("./list-agents");
    const args = { scope: "descendants" };
    const ra = await act(a, "list_agents", args, { agent: { id: "root" } });
    const rb = await act(b, "list_agents", args, { agent: { id: "root" } });
    expect(rb).toEqual(ra);
    expect(rb.result).toEqual([
      { kind: "child", id: "child-running", label: "Runner", status: "running", parent: "root", depth: 1 },
      { kind: "child", id: "grand-running", label: "Grand", status: "running", parent: "child-running", depth: 2 },
      { kind: "diagnostic", id: "deep-broken", reason: "unavailable", parent: "child-running", depth: 2 },
    ]);
    expect(rb.rendered).toEqual([{ type: "text", text: "child-running [running] parent=root depth=1 — Runner\ngrand-running [running] parent=child-running depth=2 — Grand\ndeep-broken [diagnostic: unavailable] parent=child-running depth=2" }]);
    expect(b.trace).toEqual(a.trace);
    expect(b.trace.filter((row) => row.op === "listChildren")).toEqual([]);
  });

  test("list_agents: danh sách RỖNG ⇒ cả hai render '(no subagents)'; scope lạ ⇒ cùng bị validate chặn", async () => {
    const empty = { ...FIXTURE, children: [], descendants: [] };
    const file = join("lib", "types", "list-agents.js");
    const apiA = (await import(join(STOCK, file))) as unknown as PluginApi;
    const apiB = (await import(join(OURS, file))) as unknown as PluginApi;
    const a = makeRig(apiA, empty);
    const b = makeRig(apiB, empty);
    const ra = await act(a, "list_agents", {}, { agent: { id: "root" } });
    const rb = await act(b, "list_agents", {}, { agent: { id: "root" } });
    expect(rb).toEqual(ra);
    expect(rb.result).toEqual([]);
    expect(rb.rendered).toEqual([{ type: "text", text: "(no subagents)" }]);
    const badA = await act(a, "list_agents", { scope: "bogus" }, { agent: { id: "root" } });
    const badB = await act(b, "list_agents", { scope: "bogus" }, { agent: { id: "root" } });
    expect(badB).toEqual(badA);
    expect(badB.ok).toBe(false);
    expect(b.trace).toEqual(a.trace);
  });

  test("list_agents: thiếu exec.agent ⇒ HAI bản ném CÙNG thông điệp, 0 lượt liệt kê", async () => {
    const { a, b } = await rigs("./list-agents");
    const ra = await act(a, "list_agents", {}, {});
    const rb = await act(b, "list_agents", {}, {});
    expect(rb).toEqual(ra);
    expect(rb.ok).toBe(false);
    expect(rb.error).toBe("list_agents requires a calling agent (exec.agent was undefined)");
    expect(b.trace.filter((row) => row.op === "listChildren" || row.op === "listDescendants")).toEqual([]);
    expect(b.trace).toEqual(a.trace);
  });
});

describe("F · metadata phụ trợ", () => {
  test("peers + provenance đầy đủ và khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      peerDependencies: Record<string, string>;
      gbh: { peers: string[]; provenance: { stock: string; version: string; sha: string } };
    };
    const stockManifest = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(manifest.peerDependencies, stockManifest.peerDependencies)).toBe(true);
    expect(manifest.gbh.provenance.stock).toBe("@deepseek-ai/dsh-tool-subagent-control");
    expect(manifest.gbh.provenance.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
    for (const peer of Object.keys(stockManifest.peerDependencies)) expect(manifest.gbh.peers).toContain(peer);
  });

  test("locale (gồm locale/list-agents) byte-for-byte stock", () => {
    for (const rel of ["en.json", "zh.json", "list-agents/en.json", "list-agents/zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", rel));
      const stock = readFileSync(join(STOCK, "locale", rel));
      expect(ours.equals(stock)).toBe(true);
    }
  });
});
