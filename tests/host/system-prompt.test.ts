/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chiếu cho @galaxy-blackhole/gbh-system-prompt: đo trên ARTIFACT đã build, và so
 *      TỪNG hành vi với CHÍNH bundle gốc của DSH (lắp prompt · nội suy · toolOrder · lỗi · sự kiện ·
 *      phạm vi) trên Context cordis THẬT của hai bản cài.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  PERSONA_PREFIX_SECTION,
  PERSONA_SUFFIX_SECTION,
  TOOL_ORDER_REST,
  joinContextSections,
  renderContextSections,
  renderContextSnapshot,
  renderPrompt,
} from "../../packages/host/system-prompt/src/index.ts";
import { buildPackage } from "../../packages/host/system-prompt/build.ts";
import { brandNeutral } from "../lib/brand-neutral.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "system-prompt");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-system-prompt", "lib", "index.js");
/** Package gốc trên đĩa (đọc package.json + locale). */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-system-prompt");
/** cordis mà CẢ HAI bản nạp — dùng đúng một bản để hai bên sống trong cùng thế giới. */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** dsh-scope mà CẢ HAI bản nạp — dùng đúng một bản để khoá phạm vi là CÙNG một ký hiệu. */
const SCOPE = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-scope", "lib", "index.js");
/** Thư mục build tạm trong package (cho `packages: "external"`); peer phân giải qua symlink ở beforeAll. */
const OUT = join(PKG, ".test-lib");
/** Artifact của ta — nguồn của lớp `Ours` (peer phải là KERNEL, xem `beforeAll`). */
const ARTIFACT = join(OUT, "index.js");

/**
 * Lớp system-prompt của ta, nạp từ ARTIFACT chứ KHÔNG từ `src`: `src` phân giải `dsh-scope` về bản
 * SAO workspace, mà scope đánh dấu bằng `Symbol()` cục bộ mô-đun ⇒ service không nhận ra scope của
 * KERNEL (ca "phạm vi: scope CHE global" đỏ OAN). Artifact có `node_modules/@deepseek-ai` trỏ kernel.
 */
let Ours: typeof import("../../packages/host/system-prompt/src/index.ts").default;

/** Trần thời gian của MỌI lượt chờ trong file này (ms) — không có chờ vô hạn. */
const WAIT_CAP_MS = 2_000;

/**
 * Chờ có TRẦN tới khi read() trả giá trị khác undefined.
 * Nhận: hàm đọc, nhãn chẩn đoán, và trần thời gian.
 * Trả: giá trị đầu tiên khác undefined; ném lỗi khi quá trần (không treo test).
 */
async function waitFor<T>(read: () => T | undefined, label: string, timeoutMs = WAIT_CAP_MS): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() >= deadline) throw new Error(`waitFor("${label}") qua ${timeoutMs}ms — khong thay gia tri`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Một bản cài đã boot trên Context cordis thật. */
interface Booted {
  /** Context gốc của bản cài. */
  ctx: any;
  /** Thực thể service systemPrompt. */
  svc: any;
  /** Số lần đã nghe thấy system-prompt/change. */
  changes: () => number;
}

/**
 * Boot MỘT bản cài bằng ctx.plugin và chờ service sẵn sàng trong trần.
 * Nhận: lớp plugin (ta hoặc gốc) và cấu hình.
 * Trả: context, service, và bộ đếm sự kiện đổi.
 */
async function boot(plugin: any, config: Record<string, unknown>): Promise<Booted> {
  const { Context } = (await import(CORDIS)) as any;
  const ctx = new Context();
  let count = 0;
  ctx.on("system-prompt/change", () => {
    count += 1;
  });
  ctx.plugin(plugin, config);
  const svc = await waitFor(() => ctx.get("systemPrompt"), "systemPrompt");
  return { ctx, svc, changes: () => count };
}

/**
 * Boot CẢ HAI bản với cùng cấu hình, trên hai Context riêng.
 * Nhận: cấu hình dùng chung.
 * Trả: hai bản cài đã boot + module gốc.
 */
async function bootBoth(config: Record<string, unknown>): Promise<{ ours: Booted; theirs: Booted; stock: any }> {
  const stock = (await import(STOCK)) as any;
  const ours = await boot(Ours, config);
  const theirs = await boot(stock.default, config);
  return { ours, theirs, stock };
}

/** Cấu hình dùng cho hầu hết ca A/B: persona có biến + toolOrder có mốc rest. */
const CONFIG = {
  personaPrefix: "You are a coding agent powered by the {{model}} model.",
  toolOrder: ["zeta", TOOL_ORDER_REST, "alpha"],
};

/**
 * Đăng ký cùng một bộ mục/ngữ cảnh/tool/biến lên một service (ta hoặc gốc).
 * Nhận: service systemPrompt.
 * Trả: không; mọi đăng ký đã vào sổ của service đó.
 */
function seed(svc: any): void {
  svc.variable("model", () => "deepseek-v4");
  svc.section({ name: "test:provider", order: 5, text: (context: any) => `Provider sees ${context.tag ?? "none"}` });
  svc.section({ name: "test:alpha", order: 10, text: "Alpha {{model}}" });
  svc.section({ name: "test:literal", order: 15, interpolate: false, text: "Literal {{model}} stays" });
  svc.context({ name: "ctx:optional", order: 105, text: "Optional line" });
  svc.context({ name: "ctx:required", order: 110, required: true, text: "Required {{model}}" });
  svc.tools(() => ({
    schemas: [
      { name: "zeta", description: "Z", parameters: { type: "object", properties: { b: { type: "number" } } } },
      { name: "alpha", description: "A", parameters: { type: "object", properties: {} } },
      { name: "mid", description: "M", parameters: { type: "object", properties: { a: { type: "string" } } }, deferLoading: true },
    ],
    knownNames: ["zeta", "alpha", "mid", "hidden"],
  }));
}

/**
 * Chuỗi hoá TẤT ĐỊNH — giữ cả khoá có giá trị undefined (JSON.stringify nuốt chúng).
 * Nhận: giá trị bất kỳ.
 * Trả: chuỗi dùng để so từng ký tự giữa hai bên.
 */
/**
 * Chuẩn hoá một vật thể thành chuỗi JSON để so nguyên văn với bundle gốc.
 * Nhận: value — vật thể bất kỳ (assembly, sections…).
 * Trả: chuỗi JSON đã chuẩn hoá thương hiệu (undefined → "<undefined>").
 */
function canonical(value: unknown): string {
  return brandNeutral(JSON.stringify(value, (_key, item) => (item === undefined ? "<undefined>" : item)));
}

/**
 * Đọc thông điệp lỗi của một thao tác đồng bộ/bất đồng bộ mà KHÔNG làm test nổ.
 * Nhận: hàm cần chạy.
 * Trả: thông điệp lỗi, hoặc chuỗi "(khong nem)".
 */
async function messageOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
    return "(khong nem)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Trích tập tên export từ một bundle ESM — ĐÚNG hai regex của tools/check/rows.ts.
 * Nhận: nội dung file đã build.
 * Trả: tập tên export (kể cả default).
 */
function exportNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) if (m[1] !== undefined) out.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return out;
}

/** Hình dạng manifest tối thiểu để kiểm gbh.peers ⊆ peerDependencies (so PHẦN TỬ). */
interface PeerManifest {
  /** Danh sách peer khai trong metadata của ta. */
  peers: readonly string[];
  /** Khoá của peerDependencies. */
  peerDependencies: readonly string[];
}

/**
 * Tên peer có trong gbh.peers mà THIẾU ở peerDependencies — phép kiểm PHẦN TỬ, không so số lượng.
 * Nhận: manifest hai danh sách.
 * Trả: tên thiếu (rỗng = đạt).
 */
function missingPeers(manifest: PeerManifest): string[] {
  const declared = new Set(manifest.peerDependencies);
  return manifest.peers.filter((peer) => !declared.has(peer));
}

beforeAll(async () => {
  await buildPackage(OUT);
  mkdirSync(join(OUT, "node_modules"), { recursive: true });
  symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
  Ours = ((await import(ARTIFACT)) as typeof import("../../packages/host/system-prompt/src/index.ts")).default;
}, 30_000);

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row system-prompt — ARTIFACT và bề mặt", () => {
  test("ARTIFACT: tập export = bản gốc (9 = 9), MỘT id của ta, 0 id @deepseek-ai", async () => {
    const file = ARTIFACT;
    const code = await readFile(file, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact: any = await import(file);
    const stock: any = await import(STOCK);
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    const expected = [
      "PERSONA_PREFIX_SECTION",
      "PERSONA_SUFFIX_SECTION",
      "SystemPrompt",
      "TOOL_ORDER_REST",
      "default",
      "joinContextSections",
      "renderContextSections",
      "renderContextSnapshot",
      "renderPrompt",
    ];
    expect(Object.keys(artifact).sort()).toEqual(expected);
    const oursByRegex = [...exportNames(code)].sort();
    expect(oursByRegex).toEqual(expected);
    expect(artifact.default).toBe(artifact.SystemPrompt);
    expect(stock.default).toBe(stock.SystemPrompt);
    expect(stock.default.name).toBe(Ours.name);
    expect(Object.getOwnPropertyNames(Ours.prototype).sort()).toEqual(Object.getOwnPropertyNames(stock.default.prototype).sort());
    expect(artifact.PERSONA_PREFIX_SECTION).toBe(stock.PERSONA_PREFIX_SECTION);
    expect(artifact.PERSONA_SUFFIX_SECTION).toBe(stock.PERSONA_SUFFIX_SECTION);
    expect(artifact.TOOL_ORDER_REST).toBe(stock.TOOL_ORDER_REST);
    expect(artifact.PERSONA_PREFIX_SECTION).toBe("deployment:persona-prefix");
    expect(artifact.PERSONA_SUFFIX_SECTION).toBe("deployment:persona-suffix");
    expect(artifact.TOOL_ORDER_REST).toBe("<unlisted-tools>");
  });

  
  test("locale en/zh byte-for-byte với bản gốc, và exports có ./locale/*.json", async () => {
    const ours = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    expect(ours.exports["./locale/*.json"]).toBe("./locale/*.json");
    for (const name of ["en.json", "zh.json"]) {
      const a = await readFile(join(PKG, "locale", name));
      const b = await readFile(join(STOCK_PKG, "locale", name));
      expect(Buffer.compare(a, b)).toBe(0);
    }
    expect(JSON.parse(readFileSync(join(PKG, "locale", "zh.json"), "utf8"))).toEqual(
      JSON.parse(readFileSync(join(STOCK_PKG, "locale", "zh.json"), "utf8")),
    );
  });

  test("bảng thứ tự + thứ tự tra được: trùng bản gốc cho mọi tên đã khai", async () => {
    const stock: any = await import(STOCK);
    const { ours, theirs } = await bootBoth({});
    for (const name of ["HARNESS_IDENTITY", "DEPLOYMENT_PERSONA_PREFIX", "TOOL_BASH", "TOOL_SUBAGENT", "WEB_SURFACE", "DEPLOYMENT_PERSONA_SUFFIX"]) {
      expect(ours.svc.getSectionOrder(name)).toBe(theirs.svc.getSectionOrder(name));
    }
    for (const name of ["WORKING_DIRECTORY", "SANDBOX_POLICY", "APPROVAL_POLICY", "HARNESS_SOURCE", "WEB_SURFACE"]) {
      expect(ours.svc.getContextOrder(name)).toBe(theirs.svc.getContextOrder(name));
    }
    expect(ours.svc.getSectionOrder("HARNESS_IDENTITY")).toBe(-1000);
    expect(ours.svc.getContextOrder("SANDBOX_POLICY")).toBe(110);
    expect(ours.svc.getSectionOrder("KHONG_CO")).toBeUndefined();
    expect(theirs.svc.getSectionOrder("KHONG_CO")).toBeUndefined();
    expect(stock.renderPrompt).toBeDefined();
  });
});

describe("row system-prompt — hành vi đối chiếu với chính bundle gốc", () => {
  test("assemble(): mục · ngữ cảnh · tool · biến Y HỆT gốc, kể cả thứ tự và cờ interpolate", async () => {
    const { ours, theirs, stock } = await bootBoth(CONFIG);
    seed(ours.svc);
    seed(theirs.svc);
    const ourAssembly = await ours.svc.assemble({ tag: "asm" });
    const theirAssembly = await theirs.svc.assemble({ tag: "asm" });
    expect(canonical(ourAssembly)).toBe(canonical(theirAssembly));
    expect(ourAssembly.sections.map((s: any) => s.name)).toEqual([
      "harness:identity",
      PERSONA_PREFIX_SECTION,
      "test:provider",
      "test:alpha",
      "test:literal",
      PERSONA_SUFFIX_SECTION,
    ]);
    expect(ourAssembly.sections[4].interpolate).toBe(false);
    expect(ourAssembly.contexts.map((c: any) => c.name)).toEqual(["ctx:optional", "ctx:required"]);
    expect(ourAssembly.tools.map((t: any) => t.name)).toEqual(["zeta", "mid", "alpha"]);
    expect(ourAssembly.tools[1].deferLoading).toBe(true);
    expect(ourAssembly.tools[0].parameters).toEqual({ type: "object", properties: { b: { type: "number" } } });
    expect(ourAssembly.variables).toEqual({ model: "deepseek-v4" });
    expect(ourAssembly.sections.find((s: any) => s.name === "test:provider").text).toBe("Provider sees asm");
    expect(brandNeutral(renderPrompt(ourAssembly))).toBe(stock.renderPrompt(theirAssembly));
    expect(brandNeutral(stock.renderPrompt(ourAssembly))).toBe(brandNeutral(renderPrompt(theirAssembly)));
    expect(brandNeutral(renderContextSnapshot(ourAssembly))).toBe(stock.renderContextSnapshot(theirAssembly));
    expect(canonical(renderContextSections(ourAssembly))).toBe(canonical(stock.renderContextSections(theirAssembly)));
    expect(brandNeutral(joinContextSections(renderContextSections(ourAssembly)))).toBe(
      stock.joinContextSections(stock.renderContextSections(theirAssembly)),
    );
    expect(renderPrompt(ourAssembly)).toContain("Literal {{model}} stays");
    expect(renderPrompt(ourAssembly)).toContain("Alpha deepseek-v4");
  });

  test("phạm vi: mục/biến theo scope CHE global — hai bên cùng che, cùng thứ tự", async () => {
    const { ours, theirs } = await bootBoth(CONFIG);
    const scopeMod: any = await import(SCOPE);
    const ourKey = {};
    const theirKey = {};
    const ourScope = scopeMod.createScope(ours.ctx, ourKey);
    const theirScope = scopeMod.createScope(theirs.ctx, theirKey);
    seed(ours.svc);
    seed(theirs.svc);
    for (const [svc, scope] of [[ours.svc, ourScope], [theirs.svc, theirScope]] as any[]) {
      // `ctx.get` đọc service KHÔNG cần inject — đúng đường mà một scope đọc sổ của nó.
      const scoped = scope.ctx.get("systemPrompt");
      scoped.variable("model", () => "scoped-model");
      scoped.section({ name: "test:alpha", order: 10, text: "Scoped alpha {{model}}" });
      expect(scoped).toBeDefined();
    }
    const ourGlobal = await ours.svc.assemble();
    const theirGlobal = await theirs.svc.assemble();
    expect(canonical(ourGlobal)).toBe(canonical(theirGlobal));
    expect(ourGlobal.sections.find((s: any) => s.name === "test:alpha").text).toBe("Alpha {{model}}");
    const ourScoped = await ours.svc.assemble({ scope: ourKey });
    const theirScoped = await theirs.svc.assemble({ scope: theirKey });
    expect(canonical(ourScoped)).toBe(canonical(theirScoped));
    expect(ourScoped.sections.find((s: any) => s.name === "test:alpha").text).toBe("Scoped alpha {{model}}");
    expect(ourScoped.variables.model).toBe("scoped-model");
    expect(ourGlobal.variables.model).toBe("deepseek-v4");
    await ourScope.dispose();
    await theirScope.dispose();
    expect(canonical(await ours.svc.assemble())).toBe(canonical(await theirs.svc.assemble()));
  });

  test("refreshContext + suppressRuntimeContext: bộ tắt bỏ ngữ cảnh TUỲ CHỌN, 'required' được phục hồi — y hệt gốc", async () => {
    const { ours, theirs } = await bootBoth({ ...CONFIG, includeRuntimeContext: false });
    seed(ours.svc);
    seed(theirs.svc);
    const ourAssembly = await ours.svc.assemble({ tag: "refresh" });
    const theirAssembly = await theirs.svc.assemble({ tag: "refresh" });
    expect(canonical(ourAssembly)).toBe(canonical(theirAssembly));
    expect(ourAssembly.contexts.map((c: any) => c.name)).toEqual(["ctx:required"]);
    const accepted = {
      ...ourAssembly,
      contexts: [...ourAssembly.contexts, { name: "ctx:from-waterfall", text: "from waterfall" }],
    };
    const theirAccepted = {
      ...theirAssembly,
      contexts: [...theirAssembly.contexts, { name: "ctx:from-waterfall", text: "from waterfall" }],
    };
    const ourRefreshed = ours.svc.refreshContext(accepted, { tag: "refresh" });
    const theirRefreshed = theirs.svc.refreshContext(theirAccepted, { tag: "refresh" });
    expect(canonical(ourRefreshed)).toBe(canonical(theirRefreshed));
    // Đang TẮT ngữ cảnh runtime ⇒ đóng góp chỉ-do-waterfall bị BỎ, `required` được phục hồi
    // và được GIẢI LẠI (vật mới) — đúng như bản gốc.
    expect(ourRefreshed.contexts.map((c: any) => c.name)).toEqual(["ctx:required"]);
    expect(ourRefreshed).not.toBe(accepted);
    expect(ourRefreshed.contexts).not.toBe(accepted.contexts);
    expect(ourRefreshed.contexts[0]).not.toBe(accepted.contexts[0]);
    expect(theirRefreshed.contexts[0]).not.toBe(theirAccepted.contexts[0]);
    // BẬT ngữ cảnh runtime: mục chỉ-do-waterfall được GIỮ NGUYÊN THAM CHIẾU (danh tính), y bản gốc.
    const onOurs = await bootBoth({ ...CONFIG, includeRuntimeContext: true });
    seed(onOurs.ours.svc);
    seed(onOurs.theirs.svc);
    const onAssembly = await onOurs.ours.svc.assemble({ tag: "refresh" });
    const onAccepted = { ...onAssembly, contexts: [...onAssembly.contexts, { name: "ctx:from-waterfall", text: "from waterfall" }] };
    const onRefreshed = onOurs.ours.svc.refreshContext(onAccepted, { tag: "refresh" });
    const onTheirAssembly = await onOurs.theirs.svc.assemble({ tag: "refresh" });
    const onTheirAccepted = { ...onTheirAssembly, contexts: [...onTheirAssembly.contexts, { name: "ctx:from-waterfall", text: "from waterfall" }] };
    const onTheirRefreshed = onOurs.theirs.svc.refreshContext(onTheirAccepted, { tag: "refresh" });
    expect(canonical(onRefreshed)).toBe(canonical(onTheirRefreshed));
    expect(onRefreshed.contexts.map((c: any) => c.name)).toEqual(["ctx:optional", "ctx:required", "ctx:from-waterfall"]);
    expect(onRefreshed.contexts[2]).toBe(onAccepted.contexts[2]);
    expect(onTheirRefreshed.contexts[2]).toBe(onTheirAccepted.contexts[2]);
  });

  test("waterfall system-prompt/assemble: giá trị trả về là CHÍNH THỨC, mục 'complete' được phục hồi — y hệt gốc", async () => {
    const { ours, theirs, stock } = await bootBoth(CONFIG);
    for (const [ctx, svc] of [[ours.ctx, ours.svc], [theirs.ctx, theirs.svc]] as any[]) {
      seed(svc);
      ctx.on("system-prompt/assemble", (assembly: any) => ({
        ...assembly,
        sections: [...assembly.sections, { name: "listener:extra", text: "extra" }],
        tools: assembly.tools.slice().reverse(),
      }));
    }
    const ourAssembly = await ours.svc.assemble();
    const theirAssembly = await theirs.svc.assemble();
    expect(canonical(ourAssembly)).toBe(canonical(theirAssembly));
    expect(ourAssembly.sections.at(-1).name).toBe("listener:extra");
    expect(ourAssembly.tools.map((t: any) => t.name)).toEqual(["alpha", "mid", "zeta"]);
    const ourOnly = await boot(Ours, {});
    const theirOnly = await boot(stock.default, {});
    for (const [ctx, svc] of [[ourOnly.ctx, ourOnly.svc], [theirOnly.ctx, theirOnly.svc]] as any[]) {
      svc.section({ name: "prompt:complete", order: 0, complete: true, text: "Sole prompt" });
      ctx.on("system-prompt/assemble", (assembly: any) => ({ ...assembly, sections: [...assembly.sections, { name: "listener:extra", text: "extra" }] }));
    }
    const ourComplete = await ourOnly.svc.assemble();
    const theirComplete = await theirOnly.svc.assemble();
    expect(canonical(ourComplete)).toBe(canonical(theirComplete));
    expect(ourComplete.sections.map((s: any) => s.name)).toEqual(["prompt:complete"]);
    expect(renderPrompt(ourComplete)).toBe("Sole prompt");
    expect(stock.renderPrompt(theirComplete)).toBe("Sole prompt");
  });

  test("sự kiện system-prompt/change: đăng ký + DỌN DẸP đều phát, cùng số lần như gốc", async () => {
    const { ours, theirs } = await bootBoth({});
    const before = ours.changes();
    expect(before).toBe(theirs.changes());
    const ourDispose = ours.svc.section({ name: "evt:one", order: 1, text: "one" });
    const theirDispose = theirs.svc.section({ name: "evt:one", order: 1, text: "one" });
    expect(ours.changes()).toBe(before + 1);
    expect(ours.changes()).toBe(theirs.changes());
    ourDispose();
    theirDispose();
    expect(ours.changes()).toBe(before + 2);
    expect(ours.changes()).toBe(theirs.changes());
  });

  test("cài bằng ctx.plugin: service sẵn sàng trong TRẦN waitFor (không chờ vô hạn), rồi lắp được", async () => {
    const started = Date.now();
    const { ours, theirs } = await bootBoth({ personaPrefix: "Persona {{model}}" });
    expect(ours.svc.name).toBe("systemPrompt");
    expect(ours.svc.name).toBe(theirs.svc.name);
    expect(Date.now() - started).toBeLessThan(WAIT_CAP_MS);
    for (const svc of [ours.svc, theirs.svc]) svc.variable("model", () => "m1");
    expect(canonical(await ours.svc.assemble())).toBe(canonical(await theirs.svc.assemble()));
  });
});

describe("row system-prompt — đường lỗi (so từng ký tự với gốc, không treo)", () => {
  test("nội suy: 8 hình dạng hỏng/đặc biệt cho CÙNG kết quả hoặc CÙNG thông điệp", async () => {
    const stock: any = await import(STOCK);
    const cases: any[] = [
      { name: "ok", assembly: { sections: [{ name: "s", text: "A {{a}} B" }], contexts: [], tools: [], variables: { a: "X" } } },
      { name: "literal", assembly: { sections: [{ name: "s", text: "{{a}}", interpolate: false }], contexts: [], tools: [], variables: { a: "X" } } },
      { name: "lone-open", assembly: { sections: [{ name: "s", text: "a {{ b" }], contexts: [], tools: [], variables: {} } },
      { name: "not-rescanned", assembly: { sections: [{ name: "s", text: "{{a}}" }], contexts: [], tools: [], variables: { a: "{{b}}" } } },
      { name: "unknown", assembly: { sections: [{ name: "s", text: "{{missing}}" }], contexts: [], tools: [], variables: { a: "X" } } },
      { name: "undefined-value", assembly: { sections: [{ name: "s", text: "{{a}}" }], contexts: [], tools: [], variables: { a: undefined } } },
      { name: "bad-name", assembly: { sections: [{ name: "s", text: "{{ bad }}" }], contexts: [], tools: [], variables: {} } },
      { name: "malformed-at", assembly: { sections: [{ name: "s", text: "x {{a{b}} y" }], contexts: [], tools: [], variables: {} } },
    ];
    for (const kase of cases) {
      expect(await messageOf(() => renderPrompt(kase.assembly))).toBe(await messageOf(() => stock.renderPrompt(kase.assembly)));
      expect(await messageOf(() => renderContextSnapshot(kase.assembly))).toBe(await messageOf(() => stock.renderContextSnapshot(kase.assembly)));
    }
    expect(renderPrompt(cases[0].assembly)).toBe("A X B");
    expect(renderPrompt(cases[1].assembly)).toBe("{{a}}");
    expect(renderPrompt(cases[2].assembly)).toBe("a {{ b");
    expect(renderPrompt(cases[3].assembly)).toBe("{{b}}");
    expect(renderContextSnapshot({ sections: [], contexts: [], tools: [], variables: {} })).toBe("");
    expect(joinContextSections([])).toBe("");
  });

  test("đăng ký: trùng tên · thứ tự không hữu hạn · tên biến sai — cùng TypeError/Error như gốc", async () => {
    const { ours, theirs } = await bootBoth({});
    const cases: { name: string; act: (svc: any) => unknown }[] = [
      { name: "section trùng", act: (svc) => { svc.section({ name: "dup", order: 1, text: "" }); return svc.section({ name: "dup", order: 2, text: "" }); } },
      { name: "context trùng", act: (svc) => { svc.context({ name: "dup", order: 1, text: "" }); return svc.context({ name: "dup", order: 2, text: "" }); } },
      { name: "variable trùng", act: (svc) => { svc.variable("dup", () => "a"); return svc.variable("dup", () => "b"); } },
      { name: "order NaN", act: (svc) => svc.section({ name: "nan", order: Number.NaN, text: "" }) },
      { name: "context order Infinity", act: (svc) => svc.context({ name: "inf", order: Number.POSITIVE_INFINITY, text: "" }) },
      { name: "tên biến sai", act: (svc) => svc.variable("Bad", () => "x") },
    ];
    for (const kase of cases) {
      expect(await messageOf(() => kase.act(ours.svc))).toBe(await messageOf(() => kase.act(theirs.svc)));
    }
  });

  test("cấu hình: toolOrder trùng/mất mốc rest, complete kép, tool tên dành riêng, toolOrder tên lạ — y hệt gốc", async () => {
    const stock: any = await import(STOCK);
    const { Context } = (await import(CORDIS)) as any;
    const configs: any[] = [
      { toolOrder: ["a", "a", TOOL_ORDER_REST] },
      { toolOrder: ["a"] },
      { toolOrder: [] },
    ];
    for (const config of configs) {
      expect(await messageOf(() => new Ours(new Context(), config))).toBe(await messageOf(() => new stock.default(new Context(), config)));
    }
    const { ours, theirs } = await bootBoth({});
    const kases: { name: string; act: (svc: any) => unknown }[] = [
      {
        name: "complete kép",
        act: (svc) => {
          svc.section({ name: "c1", order: 1, complete: true, text: "1" });
          svc.section({ name: "c2", order: 2, complete: true, text: "2" });
          return svc.assemble();
        },
      },
      { name: "tool tên dành riêng", act: (svc) => { svc.tools(() => ({ schemas: [{ name: TOOL_ORDER_REST, description: "", parameters: {} }] })); return svc.assemble(); } },
    ];
    for (const kase of kases) {
      expect(await messageOf(() => kase.act(ours.svc))).toBe(await messageOf(() => kase.act(theirs.svc)));
    }
    const ourUnknown = await boot(Ours, { toolOrder: ["ghost", TOOL_ORDER_REST] });
    const theirUnknown = await boot(stock.default, { toolOrder: ["ghost", TOOL_ORDER_REST] });
    for (const svc of [ourUnknown.svc, theirUnknown.svc]) svc.tools(() => ({ schemas: [{ name: "real", description: "", parameters: {} }] }));
    expect(await messageOf(() => ourUnknown.svc.assemble())).toBe(await messageOf(() => theirUnknown.svc.assemble()));
    expect(await messageOf(() => ourUnknown.svc.assemble())).toContain("known tools: real");
  });

  test("schema Config: cùng hình chữ và cùng thông điệp từ chối", async () => {
    const stock: any = await import(STOCK);
    expect(String(Ours.Config)).toBe(String(stock.default.Config));
    expect(await messageOf(() => (Ours.Config as any)({ includeHarnessIdentity: 5 }))).toBe(
      await messageOf(() => (stock.default.Config as any)({ includeHarnessIdentity: 5 })),
    );
    expect(await messageOf(() => (Ours.Config as any)({ personaPrefix: 7 }))).toBe(
      await messageOf(() => (stock.default.Config as any)({ personaPrefix: 7 })),
    );
    expect((Ours.Config as any)({})).toEqual((stock.default.Config as any)({}));
  });
});

describe("C6 — danh tính: hai thực thể KHÔNG chia sẻ vật thể", () => {
  test("hai bản cài độc lập: sổ riêng, bản lắp MỚI mỗi lượt, sửa bản cũ không lan", async () => {
    const a = await boot(Ours, {});
    const b = await boot(Ours, {});
    a.svc.section({ name: "shared:name", order: 1, text: "A" });
    expect(() => b.svc.section({ name: "shared:name", order: 1, text: "B" })).not.toThrow();
    const assemblyA = await a.svc.assemble();
    const assemblyB = await b.svc.assemble();
    expect(assemblyA.sections.find((s: any) => s.name === "shared:name").text).toBe("A");
    expect(assemblyB.sections.find((s: any) => s.name === "shared:name").text).toBe("B");
    const again = await a.svc.assemble();
    expect(again).not.toBe(assemblyA);
    expect(again.sections).not.toBe(assemblyA.sections);
    expect(again.contexts).not.toBe(assemblyA.contexts);
    expect(again.tools).not.toBe(assemblyA.tools);
    expect(again.variables).not.toBe(assemblyA.variables);
    expect(again.sections[0]).not.toBe(assemblyA.sections[0]);
    again.sections.push({ name: "mutated", text: "x" });
    again.variables.model = "mutated";
    expect(assemblyA.sections.some((s: any) => s.name === "mutated")).toBe(false);
    expect(assemblyA.variables.model).toBeUndefined();
    const stock: any = await import(STOCK);
    const c = await boot(stock.default, {});
    const d = await boot(stock.default, {});
    c.svc.section({ name: "shared:name", order: 1, text: "A" });
    expect(() => d.svc.section({ name: "shared:name", order: 1, text: "B" })).not.toThrow();
    expect(canonical(await c.svc.assemble())).toBe(canonical(await a.svc.assemble()));
  });

  test("gbh.peers ⊆ peerDependencies — so PHẦN TỬ, kèm ĐỐI CHỨNG ÂM", async () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as any;
    const peers: string[] = manifest.gbh.peers;
    const peerDependencies = Object.keys(manifest.peerDependencies);
    expect(missingPeers({ peers, peerDependencies })).toEqual([]);
    expect(peers).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/schemastery", "@deepseek-ai/dsh-scope"]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
    expect(missingPeers({ peers: ["a", "b"], peerDependencies: ["a"] })).toEqual(["b"]);
    expect(missingPeers({ peers: ["a"], peerDependencies: [] })).toEqual(["a"]);
    expect(missingPeers({ peers: ["a", "b"], peerDependencies: ["b"] })).toEqual(["a"]);
    expect(missingPeers({ peers: ["a"], peerDependencies: ["a", "b"] })).toEqual([]);
    expect(missingPeers({ peers: [], peerDependencies: [] })).toEqual([]);
  });
});
