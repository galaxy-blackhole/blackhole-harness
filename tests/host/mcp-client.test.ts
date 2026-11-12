/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-mcp-client: byte-identical + export surface + HÀNH VI THẬT của
 *      createMcpToolDefinition (metadata, render, taskRequired, invalid result, execute thành công), draft metadata.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assembleHostParts } from "../../packages/host/mcp-client/build.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-mcp-client");
/** Gói ta. */
const OURS = join(REPO, "packages/host/mcp-client");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
/** Nạp 2 bên. */
const load = async (): Promise<{ ours: Record<string, unknown>; stock: Record<string, unknown> }> => ({
  ours: (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>,
  stock: (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>,
});
/** Chạy một hàm và trả {ok, value} hoặc {ok:false, message}. */
const attempt = async (fn: () => Promise<unknown> | unknown): Promise<{ ok: boolean; value?: unknown; message?: string }> => {
  try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, message: String((error as Error).message ?? error) }; }
};

describe("A · artefact + build", () => {
  test("lib/index.js trùng TỪNG BYTE + sha", () => {
    expect(readFileSync(join(OURS, "lib/index.js")).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
    expect(sha(readFileSync(join(OURS, "lib/index.js")))).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("assembleHostParts() + EOL === stock", () => {
    const stock = readFileSync(join(STOCK, "lib/index.js"), "utf8");
    expect(assembleHostParts() + "\n").toBe(stock);
  });
});

describe("B · export surface", () => {
  test("tập export runtime khớp stock", async () => {
    const { ours, stock } = await load();
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });

  test("Config/name/inject A≡B", async () => {
    const { ours, stock } = await load();
    expect(String(ours["Config"])).toBe(String(stock["Config"]));
    expect(ours["name"]).toBe(stock["name"]);
    expect(ours["inject"]).toEqual(stock["inject"]);
  });
});

describe("C · HÀNH VI createMcpToolDefinition", () => {
  const options = {
    name: "mcp__demo__echo",
    rawName: "echo",
    description: "echo back",
    inputSchema: { type: "object", properties: { text: { type: "string" } } },
    outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
    taskRequired: false,
    call: async (args: unknown) => ({ content: [{ type: "text", text: JSON.stringify(args) }] }),
  };

  test("metadata (name/description/parameters/output.schema) A≡B", async () => {
    const { ours, stock } = await load();
    const make = (mod: Record<string, unknown>) => (mod["createMcpToolDefinition"] as (ctx: unknown, o: unknown) => Record<string, unknown>)({}, options);
    const a = make(ours);
    const b = make(stock);
    expect(a["name"]).toBe(b["name"]);
    expect(a["description"]).toBe(b["description"]);
    expect(JSON.stringify(a["parameters"])).toBe(JSON.stringify(b["parameters"]));
    expect(JSON.stringify((a["output"] as { schema?: unknown }).schema)).toBe(JSON.stringify((b["output"] as { schema?: unknown }).schema));
  });

  test("output.render sinh text A≡B", async () => {
    const { ours, stock } = await load();
    const render = (mod: Record<string, unknown>) => {
      const def = (mod["createMcpToolDefinition"] as (ctx: unknown, o: unknown) => Record<string, unknown>)({}, options);
      const output = def["output"] as { render(args: unknown, value: unknown): unknown };
      return output.render({}, { content: [{ type: "text", text: "xin chao" }] });
    };
    expect(JSON.stringify(render(ours))).toBe(JSON.stringify(render(stock)));
  });

  test("execute với taskRequired ⇒ lỗi cùng message A≡B", async () => {
    const { ours, stock } = await load();
    const run = async (mod: Record<string, unknown>) => {
      const def = (mod["createMcpToolDefinition"] as (ctx: unknown, o: unknown) => Record<string, unknown>)({}, { ...options, taskRequired: true });
      return attempt(() => (def["execute"] as (args: unknown, exec: unknown) => Promise<unknown>)({}, { signal: new AbortController().signal }));
    };
    const a = await run(ours);
    const b = await run(stock);
    expect(a.ok).toBe(false);
    expect(a.message).toBe(b.message);
  });

  test("execute với kết quả MCP KHÔNG hợp lệ ⇒ lỗi cùng message A≡B", async () => {
    const { ours, stock } = await load();
    const run = async (mod: Record<string, unknown>) => {
      const def = (mod["createMcpToolDefinition"] as (ctx: unknown, o: unknown) => Record<string, unknown>)({}, { ...options, call: async () => null });
      return attempt(() => (def["execute"] as (args: unknown, exec: unknown) => Promise<unknown>)({}, { signal: new AbortController().signal }));
    };
    const a = await run(ours);
    const b = await run(stock);
    expect(a.ok).toBe(false);
    expect(a.message).toBe(b.message);
  });

  test("execute thành công: kết quả canonical A≡B", async () => {
    const { ours, stock } = await load();
    const run = async (mod: Record<string, unknown>) => {
      const def = (mod["createMcpToolDefinition"] as (ctx: unknown, o: unknown) => Record<string, unknown>)({}, options);
      return attempt(() => (def["execute"] as (args: unknown, exec: unknown) => Promise<unknown>)({ text: "hi" }, { signal: new AbortController().signal }));
    };
    const a = await run(ours);
    const b = await run(stock);
    expect(a.ok).toBe(true);
    expect(JSON.stringify(a.value)).toBe(JSON.stringify(b.value));
  });
});

describe("D · metadata gói", () => {
  test("provenance + draft + KHÔNG row", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> & { provenance?: { stock?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-mcp-client");
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
    expect(typeof m.gbh["draft"]).toBe("string");
    expect(m.gbh["row"]).toBeUndefined();
  });

  test("exports chỉ . và ./package.json; peers chép stock", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string>; peerDependencies: Record<string, string> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    expect(Object.keys(ours.exports).sort()).toEqual([".", "./package.json"]);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(ours.peerDependencies, stock.peerDependencies)).toBe(true);
  });
});
