/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test gói agent-loop: export/hằng số/locale/projection/Config A/B với bundle gốc + hành vi helper thuần
 *      (runtime-context · tool-calls · inbox) — 20+ ca, không cần dựng cả vòng lặp agent
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Nạp artifact đã build bằng đường dẫn ĐỘNG (tránh TS7016 vì lib/ không có .d.ts). */
const artifactPath: string = join(import.meta.dir, "..", "..", "packages", "host", "agent-loop", "lib", "index.js");
// Nạp ĐỘNG qua BIẾN chuỗi: `lib/` không có `.d.ts` nên `import` literal sẽ bị TS7016 (không có khai kiểu).
const ours = (await import(artifactPath)) as Record<string, unknown>;
import * as ourInbox from "../../packages/host/agent-loop/src/inbox.ts";
import * as ourRuntime from "../../packages/host/agent-loop/src/runtime-context.ts";
import * as ourTools from "../../packages/host/agent-loop/src/tool-calls.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "agent-loop");
/** Bản gốc (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-agent-loop");
const STOCK = join(STOCK_DIR, "lib", "index.js");

/** Hình dạng module agent-loop (ta hoặc gốc). */
interface LoopModule {
  /** Lớp plugin. */
  readonly AgentLoop: unknown;
  /** Export mặc định — phải LÀ cùng lớp. */
  readonly default: unknown;
  /** Hằng số song song tool mặc định. */
  readonly DEFAULT_MAX_PARALLEL_TOOL_CALLS: number;
  /** Khoá context danh tính agent cấu hình. */
  readonly CONFIGURED_AGENT_IDENTITIES_KEY: string;
  /** Định nghĩa projection ranh giới lượt. */
  readonly turnBoundaryProjectionDefinition: unknown;
}

/** Nạp bản gốc qua chuỗi động (tsc không kéo kiểu vào chương trình). */
async function stock(): Promise<LoopModule> {
  return (await import(STOCK)) as LoopModule;
}

/** Bản của ta, nhìn như LoopModule. */
const mine = ours as unknown as LoopModule;

/** Tên export của một file JS (theo mọi câu export {...}). */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/** Schema Config của một bản. */
function configOf(module: LoopModule): (value: unknown) => Record<string, unknown> {
  return (module.AgentLoop as { Config: unknown }).Config as unknown as (value: unknown) => Record<string, unknown>;
}

/** Chụp lỗi thành chuỗi thông điệp. */
function capture(run: () => unknown): string {
  try {
    run();
    return "<khong-nem>";
  } catch (error) {
    return (error as Error).message;
  }
}

describe("agent-loop — export · hằng số · locale · projection", () => {
  test("artifact export ĐÚNG năm tên như bản gốc", () => {
    const names = exportNames(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    expect(names).toEqual(exportNames(readFileSync(STOCK, "utf8")));
    expect(names).toEqual(["AgentLoop", "CONFIGURED_AGENT_IDENTITIES_KEY", "DEFAULT_MAX_PARALLEL_TOOL_CALLS", "default", "turnBoundaryProjectionDefinition"]);
  });

  test("default LÀ cùng lớp với AgentLoop", () => {
    expect(mine.default).toBe(mine.AgentLoop);
  });

  test("DEFAULT_MAX_PARALLEL_TOOL_CALLS trùng giá trị bản gốc", async () => {
    const theirs = await stock();
    expect(mine.DEFAULT_MAX_PARALLEL_TOOL_CALLS).toBe(theirs.DEFAULT_MAX_PARALLEL_TOOL_CALLS);
  });

  test("CONFIGURED_AGENT_IDENTITIES_KEY trùng chuỗi bản gốc", async () => {
    const theirs = await stock();
    expect(mine.CONFIGURED_AGENT_IDENTITIES_KEY).toBe(theirs.CONFIGURED_AGENT_IDENTITIES_KEY);
    expect(mine.CONFIGURED_AGENT_IDENTITIES_KEY).toBe("configuredAgentIdentities");
  });

  test("turnBoundaryProjectionDefinition trùng key/stateVersion bản gốc", async () => {
    const theirs = await stock();
    const a = mine.turnBoundaryProjectionDefinition as Record<string, unknown>;
    const b = theirs.turnBoundaryProjectionDefinition as Record<string, unknown>;
    expect(a["key"]).toBe(b["key"] as string);
    expect(a["stateVersion"]).toBe(b["stateVersion"] as number);
  });

  test("inboxProjectionDefinition: key 'inbox' + cùng stateVersion", () => {
    const definition = (ourInbox as unknown as Record<string, unknown>)["inboxProjectionDefinition"] as Record<string, unknown>;
    expect(definition["key"]).toBe("inbox");
    expect(typeof definition["stateVersion"]).toBe("number");
  });

  test("locale en.json chép nguyên văn", () => {
    expect(readFileSync(join(OURS, "locale", "en.json")).equals(readFileSync(join(STOCK_DIR, "locale", "en.json")))).toBe(true);
  });

  test("locale zh.json chép nguyên văn", () => {
    expect(readFileSync(join(OURS, "locale", "zh.json")).equals(readFileSync(join(STOCK_DIR, "locale", "zh.json")))).toBe(true);
  });
});

describe("agent-loop — Config A/B", () => {
  test("String(Config) trùng từng ký tự", async () => {
    const theirs = await stock();
    expect(String((mine.AgentLoop as { Config: unknown }).Config)).toBe(String((theirs.AgentLoop as { Config: unknown }).Config));
  });

  test("mặc định giải ra agents rỗng (hai bản cùng giá trị)", async () => {
    const theirs = await stock();
    const a = configOf(mine)({});
    const b = configOf(theirs)({});
    // maxParallelToolCalls là Volatile (có hàm) ⇒ so phần so được, không so danh tính hàm.
    expect(a["agents"]).toEqual(b["agents"]);
    expect(a["agents"]).toEqual([]);
    expect(typeof (a["maxParallelToolCalls"] as { get: unknown }).get).toBe("function");
    expect(typeof (b["maxParallelToolCalls"] as { get: unknown }).get).toBe("function");
  });

  test("agent thiếu trường bắt buộc ⇒ hai bản cùng thông điệp lỗi", async () => {
    const theirs = await stock();
    const input = { agents: [{ agent: "main" }] };
    expect(capture(() => configOf(mine)(input))).toBe(capture(() => configOf(theirs)(input)));
    expect(capture(() => configOf(mine)(input))).not.toBe("<khong-nem>");
  });

  test("agent trùng khoá ⇒ cùng thông điệp lỗi", async () => {
    const theirs = await stock();
    const duplicate = { agents: [{ agent: "a" }, { agent: "a" }] };
    expect(capture(() => configOf(mine)(duplicate))).toBe(capture(() => configOf(theirs)(duplicate)));
  });
});

describe("agent-loop — runtime-context (hành vi helper thuần)", () => {
  test("SOURCE là 'runtime-context'", () => {
    expect((ourRuntime as unknown as Record<string, unknown>)["SOURCE"]).toBe("runtime-context");
  });

  test("CLEARED nói rõ không còn ngữ cảnh runtime", () => {
    const cleared = (ourRuntime as unknown as Record<string, unknown>)["CLEARED"] as string;
    expect(cleared.startsWith("Current runtime context: none.")).toBe(true);
  });

  test("isOwned: đúng nguồn runtime-context, sai nguồn khác", () => {
    const isOwned = (ourRuntime as unknown as Record<string, unknown>)["isOwned"] as (m: unknown) => boolean;
    expect(isOwned({ source: { kind: "runtime-context" }, content: [] })).toBe(true);
    expect(isOwned({ source: { kind: "user" }, content: [] })).toBe(false);
  });

  test("textOf: message nguồn runtime-context ⇒ chuỗi text; nguồn khác ⇒ undefined", () => {
    const textOf = (ourRuntime as unknown as Record<string, unknown>)["textOf"] as (m: unknown) => string | undefined;
    expect(textOf({ source: { kind: "runtime-context" }, content: [{ type: "text", text: "a" }] })).toBe("a");
    expect(textOf({ source: { kind: "user" }, content: [] })).toBeUndefined();
  });

  test("eventsNewestFirst: đảo ảnh chụp nhật ký của phiên (mới nhất trước)", () => {
    const newestFirst = (ourRuntime as unknown as Record<string, unknown>)["eventsNewestFirst"] as (s: unknown) => unknown[];
    expect(newestFirst({ snapshotEvents: () => [1, 2, 3] })).toEqual([3, 2, 1]);
    expect(newestFirst({ snapshotEvents: () => [] })).toEqual([]);
  });

  test("RuntimeContextProjection + SystemPromptProjection: đủ phương thức công khai", () => {
    for (const name of ["RuntimeContextProjection", "SystemPromptProjection"]) {
      const ctor = (ourRuntime as unknown as Record<string, unknown>)[name] as { prototype: Record<string, unknown> };
      expect(Object.getOwnPropertyNames(ctor.prototype).length).toBeGreaterThan(1);
    }
  });
});

describe("agent-loop — HỒI QUY 23/10/2026: sessions phải đọc qua runtime.ctx", () => {
  test("create/createAgent/resume dùng runtime.ctx cho sessions — KHÔNG dùng this.ctx (ctx BÊN GỌI)", () => {
    // Vì sao có ca này: service cordis là traceable — khi được gọi qua MỘT ctx khác, this.ctx trỏ về
    // ctx của bên gọi. Phía subagent gọi qua private scope (ctx.plugin(function activationOwner(){}) có
    // inject RỖNG ⇒ đọc this.ctx.sessions ném cannot get property "sessions" without inject đúng lúc
    // tạo teammate. Đo thật 23/10/2026: spawn_teammate luôn failed, member kẹt phase failed.
    const artifact = readFileSync(artifactPath, "utf8");
    expect(artifact).not.toContain("servicesOf(this.ctx).sessions");
    expect(artifact.match(/servicesOf\(this\.runtime\.ctx\)\.sessions/gu) ?? []).toHaveLength(3);
    // Đối chứng: bản gốc cũng đọc sessions bằng runtime.ctx đúng 3 lần ở ba đường create/createAgent/resume.
    const stockText = readFileSync(STOCK, "utf8");
    expect(stockText.match(/this\.runtime\.ctx\.sessions/gu) ?? []).toHaveLength(3);
  });
});

describe("agent-loop — tool-calls · inbox", () => {
  test("parseArguments: JSON hợp lệ ⇒ object đã parse", () => {
    const parse = (ourTools as unknown as Record<string, unknown>)["parseArguments"] as (v: unknown) => unknown;
    expect(parse('{"a":1}')).toEqual({ a: 1 });
    expect(parse("[]")).toEqual([]);
  });

  test("parseArguments: JSON hỏng/chuỗi thường ⇒ giữ nguyên chuỗi gốc", () => {
    const parse = (ourTools as unknown as Record<string, unknown>)["parseArguments"] as (v: unknown) => unknown;
    expect(parse("khong-phai-json")).toBe("khong-phai-json");
    expect(parse("")).toEqual({});
  });

  test("parseArguments: object đã parse ⇒ trả NGUYÊN tham chiếu", () => {
    const parse = (ourTools as unknown as Record<string, unknown>)["parseArguments"] as (v: unknown) => unknown;
    const value = { a: 1 };
    expect(parse(value)).toBe(value);
  });

  test("ToolCallLoopContext là kiểu (không có ở runtime) và 6 hàm đều export", () => {
    for (const name of ["executeToolCalls", "parseArguments", "runGroup", "appendSkippedToolCall", "appendToolCall", "appendToolResult"]) {
      expect(typeof (ourTools as unknown as Record<string, unknown>)[name]).toBe("function");
    }
  });

  test("ReactLoopInbox: bộ phương thức công khai đúng như thiết kế", () => {
    const ctor = (ourInbox as unknown as Record<string, unknown>)["ReactLoopInbox"] as { prototype: Record<string, unknown> };
    const names = Object.getOwnPropertyNames(ctor.prototype).filter((name) => name !== "constructor").sort();
    expect(names).toEqual(["append", "claim", "clear", "current", "hasPending", "locate", "mutate", "nextStep", "nextTurn", "prepend", "remove", "replace", "splice"]);
  });
});

describe("agent-loop — trạng thái row", () => {
  test("row mang ĐÚNG id agent-loop: đang MOUNT (gbh.row) hay đang PARKED (park/row_unmounted_ly_do)", () => {
    interface RowShape { id?: string; tests?: string[] }
    interface ParkShape { ly_do?: string; row?: RowShape }
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      gbh?: { row?: RowShape; park?: ParkShape; row_unmounted_ly_do?: ParkShape };
    };
    const mounted = meta.gbh?.row;
    // Quy ước park của Lead: gbh.park hoặc gbh.row_unmounted_ly_do — cả hai đều giữ { ly_do, row }.
    const parked = meta.gbh?.row_unmounted_ly_do ?? meta.gbh?.park;
    // Bất biến: gói LUÔN khai đúng một trong hai trạng thái, và id phải là agent-loop (id row thật trong dump).
    const row = mounted ?? parked?.row;
    expect(row).toBeDefined();
    expect(row?.id).toBe("agent-loop");
    expect(row?.tests).toContain("tests/host/agent-loop.test.ts");
    if (mounted !== undefined) {
      // Đang mount: KHÔNG được còn khối park song song (tránh hai nguồn sự thật).
      expect(parked).toBeUndefined();
    } else {
      // Đang park: bắt buộc có lý do để người đọc biết vì sao chưa mount.
      expect(typeof parked?.ly_do).toBe("string");
      expect((parked?.ly_do ?? "").length).toBeGreaterThan(20);
    }
  });

  test("row đã mounted ⇒ default LÀ AgentLoop và export vẫn đúng 5 tên", async () => {
    expect(mine.default).toBe(mine.AgentLoop);
    const names = exportNames(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    expect(names).toEqual(["AgentLoop", "CONFIGURED_AGENT_IDENTITIES_KEY", "DEFAULT_MAX_PARALLEL_TOOL_CALLS", "default", "turnBoundaryProjectionDefinition"]);
  });
});

describe("biến prompt `model_label` — persona không in id model TRÊN DÂY (11/11/2026)", () => {
  test("route quản lý `auto` đọc là 'Galaxy Blackhole'; route khác giữ id model thật", async () => {
    const { modelLabel, MANAGED_PROVIDER_ID, MANAGED_ROUTE_LABEL } = (await import("../../packages/host/agent-loop/src/model-label.ts")) as {
      modelLabel: (provider: string | undefined, model: string | undefined) => string | undefined;
      MANAGED_PROVIDER_ID: string;
      MANAGED_ROUTE_LABEL: string;
    };
    expect(MANAGED_PROVIDER_ID).toBe("auto");
    expect(MANAGED_ROUTE_LABEL).toBe("Galaxy Blackhole");
    /* ĐÚNG ca người dùng báo: route auto + id dây deepseek-v4.1-flash KHÔNG được lọt vào prompt. */
    expect(modelLabel("auto", "deepseek-v4.1-flash")).toBe("Galaxy Blackhole");
    /* Chọn model khác thì vẫn hiện đúng tên model đó — yêu cầu không được đánh đổi. */
    expect(modelLabel("deepseek-account", "deepseek-v4-pro")).toBe("deepseek-v4-pro");
    expect(modelLabel(undefined, "deepseek-v4-pro")).toBe("deepseek-v4-pro");
    expect(modelLabel("auto", undefined)).toBeUndefined();
    expect(modelLabel("auto", "")).toBeUndefined();
  });

  test("persona của ba preset + của deployment dùng {{model_label}}, không còn {{model}}", () => {
    const presets = ["standard", "ptc", "cordis"].map((name) => readFileSync(join(REPO, "packages", "host", "bundle", "presets", name + ".patch.yml"), "utf8"));
    for (const text of presets) {
      expect(text).toContain("You are a coding agent powered by the {{model_label}} model.");
      expect(text).not.toContain("You are a coding agent powered by the {{model}} model.");
    }
    /* Preset minimal tự đặt persona riêng — KHÔNG bị đổi (giữ nguyên hợp đồng của bản gốc). */
    expect(readFileSync(join(REPO, "packages", "host", "bundle", "presets", "minimal.patch.yml"), "utf8")).toContain("prefix: You are a helpful software engineer assistant.");
    /* Lớp patch CUỐI (do generator sinh) cũng phải sạch id dây, và fallback của deployment thì cùng mẫu. */
    const redirect = readFileSync(join(REPO, "profiles", "blackhole", "preset-redirect.patch.yml"), "utf8");
    expect(redirect).toContain("You are a coding agent powered by the {{model_label}} model.");
    expect(redirect).not.toContain("powered by the {{model}} model.");
    const parity = readFileSync(join(REPO, "profiles", "blackhole", "parity.patch.yml"), "utf8");
    expect(parity).toContain("personaPrefix: You are a coding agent powered by the {{model_label}} model.");
  });

  test("dựng prompt thật: auto ⇒ 'powered by the Galaxy Blackhole model.', route khác ⇒ tên model", async () => {
    const { renderPrompt } = (await import("../../packages/host/system-prompt/src/render.ts")) as {
      renderPrompt: (assembly: unknown) => string;
    };
    const { modelLabel } = (await import("../../packages/host/agent-loop/src/model-label.ts")) as {
      modelLabel: (provider: string | undefined, model: string | undefined) => string | undefined;
    };
    const assemblyFor = (provider: string, model: string): string =>
      renderPrompt({
        sections: [{ name: "deployment:persona-prefix", order: 0, text: "You are a coding agent powered by the {{model_label}} model." }],
        contexts: [],
        variables: { provider, model, model_label: modelLabel(provider, model) },
      });
    expect(assemblyFor("auto", "deepseek-v4.1-flash")).toBe("You are a coding agent powered by the Galaxy Blackhole model.");
    expect(assemblyFor("deepseek-account", "deepseek-v4-pro")).toBe("You are a coding agent powered by the deepseek-v4-pro model.");
  });
});
