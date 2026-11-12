/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test cho @galaxy-blackhole/gbh-mcp-resources: tập export đo trên ARTIFACT, đối chứng TRỰC TIẾP
 *      với chính bundle gốc (ba tool · phép render blob · đường lỗi server không khả kiến · mục system
 *      prompt · vòng đời tool theo provider), ca DANH TÍNH C6 cho bảng provider theo scope, và quy ước
 *      gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM.
 *      Context cordis + bộ mint scope là bản THẬT của kernel, nạp theo đường dẫn; chỉ sổ tool và seam
 *      system prompt là giả (đúng hai mặt mà row này gọi).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/mcp-resources/build.ts";
import type { JsonValue } from "../../packages/host/mcp-resources/src/types.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Bundle GỐC trong kernel (CHỈ ĐỌC) — oracle cho mọi ca đối chứng. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-mcp-resources/lib/index.js");
/** Context cordis THẬT của kernel. */
const CORDIS = join(REPO, "apps/host/node_modules/@deepseek-ai/cordis/lib/index.js");
/** Bộ mint scope THẬT của kernel — dựng phạm vi đúng như agent thật. */
const SCOPE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-scope/lib/index.js");
/**
 * Thư mục @deepseek-ai của KERNEL — nguồn DUY NHẤT cấp cordis/dsh-scope/dsh-tools cho artefact của ta.
 * Vì sao (01/11/2026): gói workspace phân giải peer qua root node_modules/.bun còn kernel nằm ở
 * apps/host/node_modules; hai bản sao vật lý ⇒ (a) `getPrototypeOf(Runtime.prototype)` khác lớp Service
 * của kernel, (b) `dsh-scope` đánh dấu scope bằng Symbol CỤC BỘ MÔ-ĐUN nên bảng provider theo scope
 * không thấy khoá do kernel mint. Nạp lớp runtime từ ARTEFACT dựng trong thư mục tạm có symlink
 * node_modules/@deepseek-ai → kernel (pattern tests/host/shell.test.ts) thì hai bên dùng CHUNG một lớp.
 */
const KERNEL_AI = join(REPO, "apps/host/node_modules/@deepseek-ai");
/** Lớp runtime của TA — gán trong beforeAll từ artefact (KHÔNG nạp src: src giữ peer .bun). */
let McpResourceRuntime: typeof import("../../packages/host/mcp-resources/src/index.ts").McpResourceRuntime;
/** Thư mục tạm chứa artefact (dọn ở afterAll). */
let outDir = "";
beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-mcp-res-run-"));
  const artifact = await buildPackage(outDir);
  mkdirSync(join(outDir, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(outDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(outDir, "node_modules", "@galaxy-blackhole"), "dir");
  McpResourceRuntime = ((await import(artifact)) as typeof import("../../packages/host/mcp-resources/src/index.ts")).McpResourceRuntime;
}, 60_000);
afterAll(() => {
  if (outDir !== "") rmSync(outDir, { recursive: true, force: true });
});

/** Một definition tool đã đăng ký — chỉ những mặt mà test đo. */
interface ToolDefinition {
  /** Tên tool. */
  name: string;
  /** Mô tả gửi model. */
  description: string;
  /** Tham số (bản gốc truyền NGUYÊN object hằng). */
  parameters: Record<string, unknown>;
  /** Hợp đồng đầu ra: schema + render. */
  output: { schema: Record<string, unknown>; render(args: unknown, value: unknown): { type: string; text: string }[] };
  /** Chạy một lượt gọi. */
  execute(args: unknown, exec: unknown): Promise<unknown>;
}

/** Một mục system prompt đã đăng ký. */
interface SectionRecord {
  /** Tên mục. */
  name: string;
  /** Vị trí chèn. */
  order: number;
  /** Có nội suy biến không. */
  interpolate?: boolean;
  /** Hàm dựng văn bản theo ngữ cảnh. */
  text: (context: { scope?: object }) => string;
}

/** Kiểu context cordis thật, suy từ chính chữ ký của lớp ta (tests/ không resolve được @deepseek-ai/*). */
type RealContext = ConstructorParameters<typeof McpResourceRuntime>[0];
/** Một provider đã đăng ký: chỉ mặt mà row này gọi. */
type Provider = Parameters<InstanceType<typeof McpResourceRuntime>["register"]>[1];
/** Lượt gọi provider đã ghi lại. */
interface Call {
  /** Tên server. */
  server: string;
  /** Yêu cầu đã chuyển tiếp (method + cursor/uri). */
  request: Record<string, unknown>;
  /** Danh tính người gọi — phải là CHÍNH đối tượng exec của tool. */
  exec: unknown;
}

/** Sổ tool giả: ĐÚNG mặt mà row này dùng (`register` trả disposer). */
interface FakeTools {
  /** Definition đang sống, theo thứ tự đăng ký. */
  live: ToolDefinition[];
  /** Cắm vào context dưới tên `tools`. */
  service: { register(definition: ToolDefinition): () => void };
}

/** Seam system prompt giả: ĐÚNG hai mặt mà row này gọi. */
interface FakePrompt {
  /** Mục đang sống, theo thứ tự đăng ký. */
  sections: SectionRecord[];
  /** Cắm vào context dưới tên `systemPrompt`. */
  service: {
    section(section: SectionRecord): () => void;
    getSectionOrder(name: string): number;
  };
}

/** Một giàn đo: context thật + sổ giả + instance đã dựng. */
interface Harness {
  /** Context cordis thật. */
  ctx: RealContext;
  /** Sổ tool giả. */
  tools: FakeTools;
  /** Seam prompt giả. */
  prompt: FakePrompt;
  /** Runtime của bản cài đang đo. */
  runtime: InstanceType<typeof McpResourceRuntime>;
}

const stock = (await import(STOCK)) as {
  McpResourceRuntime: typeof McpResourceRuntime;
  default: typeof McpResourceRuntime;
};
const cordis = (await import(CORDIS)) as { Context: new () => RealContext };
const scopeKit = (await import(SCOPE)) as {
  createScope(ctx: RealContext, key: object): { ctx: RealContext; rawDispose: () => Promise<void> | void };
};

/**
 * Liệt kê tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng).
 * Nhận: nội dung file build.
 * Trả: tập tên export đã sắp xếp (gồm cả `default`).
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/u).pop()?.trim();
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
 * Cắm một service vào context thật theo đúng đường cordis dùng.
 * Nhận: context, tên service, giá trị.
 * Trả: không.
 */
function provide(ctx: RealContext, name: string, value: unknown): void {
  (ctx as unknown as { provide(name: string, value: unknown): void }).provide(name, value);
}

/**
 * Dựng sổ tool giả (disposer gỡ ĐÚNG phần tử đã đăng ký).
 * Nhận: không.
 * Trả: sổ giả.
 */
function makeTools(): FakeTools {
  const live: ToolDefinition[] = [];
  return {
    live,
    service: {
      register(definition: ToolDefinition): () => void {
        live.push(definition);
        return () => {
          const at = live.indexOf(definition);
          if (at >= 0) live.splice(at, 1);
        };
      },
    },
  };
}

/**
 * Dựng seam prompt giả.
 * Nhận: không.
 * Trả: seam giả với vị trí trung tâm cố định 3100 (đúng vị trí `MCP_SERVERS` của kernel).
 */
function makePrompt(): FakePrompt {
  const sections: SectionRecord[] = [];
  return {
    sections,
    service: {
      section(section: SectionRecord): () => void {
        sections.push(section);
        return () => {
          const at = sections.indexOf(section);
          if (at >= 0) sections.splice(at, 1);
        };
      },
      getSectionOrder(): number {
        return 3100;
      },
    },
  };
}

/**
 * Dựng context thật đã cắm hai seam giả, CHƯA dựng runtime.
 * Nhận: không.
 * Trả: context + sổ tool giả + seam prompt giả.
 */
function services(): { ctx: RealContext; tools: FakeTools; prompt: FakePrompt } {
  const ctx = new cordis.Context();
  const tools = makeTools();
  const prompt = makePrompt();
  provide(ctx, "tools", tools.service);
  provide(ctx, "systemPrompt", prompt.service);
  return { ctx, tools, prompt };
}

/**
 * Dựng giàn đo dùng chung được cho CẢ bản của ta lẫn bản gốc.
 * Nhận: lớp runtime cần dựng.
 * Trả: giàn đo đã cắm `tools` + `systemPrompt`.
 */
function harness(Ctor: typeof McpResourceRuntime): Harness {
  const base = services();
  const runtime = new Ctor(base.ctx);
  return { ctx: base.ctx, tools: base.tools, prompt: base.prompt, runtime };
}

/**
 * Chờ fiber của lượt `ctx.inject` chạy xong (cordis kích hoạt bất đồng bộ).
 * Nhận: không.
 * Trả: promise hoàn tất sau vài vòng microtask.
 */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mặt quan sát được của một definition tool (bỏ hàm, giữ dữ liệu).
 * Nhận: definition.
 * Trả: object so được bằng `toEqual`.
 */
function toolShape(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    schema: tool.output.schema,
    keys: Object.keys(tool).sort(),
    outputKeys: Object.keys(tool.output).sort(),
  };
}

/**
 * Provider giả ghi lại lượt gọi rồi trả một giá trị cố định.
 * Nhận: giá trị trả về (mặc định một kết quả tài nguyên điển hình).
 * Trả: provider + nhật ký lượt gọi.
 */
function providerOf(value: JsonValue = { resources: [{ uri: "file:///a.txt", name: "a" }] }): {
  provider: Provider;
  calls: Call[];
} {
  const calls: Call[] = [];
  const provider: Provider = {
    request(request, exec) {
      calls.push({ server: "x", request: request as unknown as Record<string, unknown>, exec });
      return Promise.resolve(value);
    },
  };
  return { provider, calls };
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-mcp-res-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["McpResourceRuntime", "default"]);
    // Row host thuần: KHÔNG có __ModuleLoader__ nào ⇒ id stock trong artifact phải là 0.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    expect(grepCount(oursText, "id: @deepseek-ai")).toBe(0);
  });

  test("service \"mcpResources\" + inject [\"tools\"] khớp bản gốc", () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    expect(mine.runtime.name).toBe(theirs.runtime.name);
    expect(mine.runtime.name).toBe("mcpResources");
    expect(McpResourceRuntime.inject).toEqual(stock.McpResourceRuntime.inject);
    expect(McpResourceRuntime.inject).toEqual(["tools"]);
    // Service của kernel THẬT: hai bản cùng kế thừa đúng một lớp cha.
    expect(Object.getPrototypeOf(McpResourceRuntime.prototype)).toBe(
      Object.getPrototypeOf(stock.McpResourceRuntime.prototype),
    );
  });
});

describe("ba tool dùng chung: hình dạng + phép render + đường lỗi — đối chứng từng ca với bản gốc", () => {
  test("đăng ký ĐÚNG ba tool, cùng thứ tự · cùng tên · cùng mô tả · cùng schema tham số", () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    // Tool dùng chung chỉ xuất hiện khi scope có provider ĐẦU TIÊN (y bản gốc).
    mine.runtime.register("srv", providerOf().provider);
    theirs.runtime.register("srv", providerOf().provider);
    const ours = mine.tools.live.map(toolShape);
    const stockShapes = theirs.tools.live.map(toolShape);
    expect(ours.length).toBe(3);
    expect(ours).toEqual(stockShapes);
    expect(ours.map((tool) => tool.name)).toEqual([
      "list_mcp_resources",
      "list_mcp_resource_templates",
      "read_mcp_resource",
    ]);
    // `defineTool` ĐÃ BIÊN DỊCH tham số thành JSON Schema thô: hai tool liệt kê chỉ bắt buộc `server`,
    // còn tool ĐỌC bắt buộc cả `server` + `uri` (khác nhau nên không thể dùng chung một spec).
    expect(ours[2]!.parameters).toEqual({
      type: "object",
      properties: {
        server: { type: "string", description: "Configured MCP server name." },
        uri: { type: "string", description: "Resource URI to read." },
      },
      required: ["server", "uri"],
    });
    expect((ours[0]!.parameters as { required?: string[] }).required ?? []).toEqual(["server"]);
    expect((ours[1]!.parameters as { required?: string[] }).required ?? []).toEqual(["server"]);
    // `{ type: "json" }` là schema CHỈ-CHÚ-THÍCH của lossless JSON ⇒ sau biên dịch còn `{}`.
    expect(ours[0]!.schema).toEqual({});
  });

  test("DANH TÍNH các vật thể cấu hình: quan hệ chia sẻ của ta BẰNG bản gốc (C6)", () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    mine.runtime.register("srv", providerOf().provider);
    theirs.runtime.register("srv", providerOf().provider);
    const ours = mine.tools.live;
    const stockTools = theirs.tools.live;
    // Bản gốc dùng LẠI một hằng tham số cho hai tool liệt kê và một hợp đồng ra cho cả ba.
    // Đây là chỗ dễ 'cải tiến' thành object mới mỗi lượt ⇒ hành vi đổi mà không cổng nào thấy.
    const relations = (tools: ToolDefinition[]): boolean[] => [
      tools[0]!.parameters === tools[1]!.parameters,
      tools[0]!.parameters === tools[2]!.parameters,
      tools[0]!.output === tools[1]!.output,
      tools[1]!.output === tools[2]!.output,
      tools[0]!.output.schema === tools[2]!.output.schema,
    ];
    expect(relations(ours)).toEqual(relations(stockTools));
    // Sửa `required` của tool này KHÔNG lan sang tool kia — và bản gốc cũng vậy (hai bản sao ĐỘC LẬP).
    /**
     * Thử lan nhiễu giữa hai vật thể cấu hình anh em.
     * Nhận: bộ definition đã đăng ký.
     * Trả: `true` khi tool thứ hai THẤY thay đổi của tool thứ nhất.
     */
    const leaks = (list: ToolDefinition[]): boolean => {
      const required = list[0]!.parameters.required as string[];
      required.push("cursor");
      return (list[1]!.parameters.required as string[]).includes("cursor");
    };
    expect(leaks(ours)).toBe(leaks(stockTools));
    expect(leaks(ours)).toBe(false);
    // Mỗi lượt đăng ký TẠO definition MỚI (không chia sẻ definition giữa hai scope).
    expect(ours[0]).not.toBe(ours[1]);
    expect(stockTools[0]).not.toBe(stockTools[1]);
  });

  test("render: blob dạng chuỗi thành MÔ TẢ, blob không-chuỗi/không-phải-blob giữ nguyên — y bản gốc", () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    mine.runtime.register("srv", providerOf().provider);
    theirs.runtime.register("srv", providerOf().provider);
    const cases: unknown[] = [
      { contents: [{ uri: "file:///a", mimeType: "image/png", blob: "AAAA", text: "hi" }] },
      { contents: [{ blob: 5 }, { blob: { nested: "AAAA" } }, { other: "AAAA" }] },
      { resources: [], nextCursor: "c1" },
      { deep: { blob: "AAAA" } },
      "chuoi tran",
      null,
    ];
    for (const value of cases) {
      const ours = mine.tools.live[0]!.output.render({ server: "srv" }, value);
      const stockRender = theirs.tools.live[0]!.output.render({ server: "srv" }, value);
      expect(ours).toEqual(stockRender);
    }
    // Khẳng định THÊM giá trị tuyệt đối: blob chuỗi KHÔNG lọt vào nội dung model.
    const rendered = mine.tools.live[0]!.output.render(
      { server: "srv" },
      { contents: [{ uri: "file:///a", mimeType: "image/png", blob: "AAAA" }] },
    );
    expect(rendered).toEqual([
      {
        type: "text",
        text:
          'MCP server: srv\n{"contents":[{"uri":"file:///a","mimeType":"image/png","blob":' +
          '"[binary resource: 4 base64 characters; available to programmatic callers]"}]}',
      },
    ]);
    // Quy kết server đứng ĐẦU nội dung.
    expect(rendered[0]!.text.startsWith("MCP server: srv\n")).toBe(true);
  });

  test("execute chuyển tiếp ĐÚNG yêu cầu + ĐÚNG danh tính exec, và trả nguyên giá trị của provider", async () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    const value = { resources: [{ uri: "file:///a.txt" }] };
    for (const [h, tools] of [
      [mine, mine.tools.live],
      [theirs, theirs.tools.live],
    ] as const) {
      const { provider, calls } = providerOf(value);
      h.runtime.register("srv", provider);
      const exec = { callId: "c1", signal: new AbortController().signal };
      expect(await tools[0]!.execute({ server: "srv" }, exec)).toEqual(value);
      expect(await tools[1]!.execute({ server: "srv", cursor: "c9" }, exec)).toEqual(value);
      expect(await tools[2]!.execute({ server: "srv", uri: "file:///a.txt" }, exec)).toEqual(value);
      expect(calls.map((call) => call.request)).toEqual([
        { method: "resources/list" },
        { method: "resources/templates/list", cursor: "c9" },
        { method: "resources/read", uri: "file:///a.txt" },
      ]);
      // exec đi qua NGUYÊN đối tượng — scope của người gọi không bị bọc lại.
      expect(calls[0]!.exec).toBe(exec);
      expect(calls[2]!.exec).toBe(exec);
    }
  });

  test("ĐƯỜNG LỖI: server không khả kiến ⇒ ném CÙNG thông điệp và KHÔNG chạm provider", async () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    const { provider, calls } = providerOf();
    mine.runtime.register("srv", provider);
    theirs.runtime.register("srv", providerOf().provider);
    const exec = { callId: "c1", signal: new AbortController().signal };
    const messageOf = async (tools: ToolDefinition[]): Promise<string> => {
      try {
        await tools[0]!.execute({ server: "khong-co" }, exec);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(await messageOf(mine.tools.live)).toBe(
      'MCP resource server "khong-co" is unavailable in this agent\'s scope',
    );
    expect(await messageOf(theirs.tools.live)).toBe(await messageOf(mine.tools.live));
    expect(calls).toEqual([]);
  });
});

describe("mục system prompt + vòng đời tool theo provider — đối chứng với bản gốc", () => {
  test("mục \"mcp-resource-servers\": cùng tên · cùng order · không nội suy · rỗng khi chưa có server", async () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    await settle();
    expect(mine.prompt.sections.length).toBe(1);
    expect(theirs.prompt.sections.length).toBe(1);
    const ours = mine.prompt.sections[0]!;
    const stockSection = theirs.prompt.sections[0]!;
    expect({ name: ours.name, order: ours.order, interpolate: ours.interpolate }).toEqual({
      name: stockSection.name,
      order: stockSection.order,
      interpolate: stockSection.interpolate,
    });
    expect(ours.name).toBe("mcp-resource-servers");
    expect(ours.order).toBe(3100);
    expect(ours.interpolate).toBe(false);
    expect(ours.text({})).toBe("");
    expect(ours.text({})).toBe(stockSection.text({}));
  });

  test("mục prompt liệt kê tên server ĐÃ SẮP XẾP khi scope có provider — y bản gốc", async () => {
    const mine = harness(McpResourceRuntime);
    await settle();
    const section = mine.prompt.sections[0]!;
    mine.runtime.register("zeta", providerOf().provider);
    mine.runtime.register("alpha", providerOf().provider);
    const text = section.text({});
    expect(text).toBe(
      '## MCP resource servers\n\nUse list_mcp_resources, list_mcp_resource_templates, ' +
        'or read_mcp_resource with one of these names as the server argument: ["alpha","zeta"].',
    );
    // Vắng scope ⇒ chỉ lớp toàn cục (cùng nội dung ở ca này vì provider đăng ký trên ctx gốc).
    expect(section.text({ scope: undefined })).toBe(text);
  });

  test("vòng đời: tool chỉ tồn tại khi scope CÒN provider đầu tiên, và mất khi provider CUỐI bị gỡ", () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    const ours = (): number => mine.tools.live.length;
    const stockCount = (): number => theirs.tools.live.length;
    expect(ours()).toBe(0);
    expect(stockCount()).toBe(0);
    const first = mine.runtime.register("a", providerOf().provider);
    const second = mine.runtime.register("b", providerOf().provider);
    const firstStock = theirs.runtime.register("a", providerOf().provider);
    const secondStock = theirs.runtime.register("b", providerOf().provider);
    expect(ours()).toBe(3);
    expect(stockCount()).toBe(3);
    first();
    firstStock();
    // Còn provider thứ hai ⇒ tool dùng chung VẪN sống (thuộc service, không thuộc plugin đầu).
    expect(ours()).toBe(3);
    expect(stockCount()).toBe(3);
    second();
    secondStock();
    expect(ours()).toBe(0);
    expect(stockCount()).toBe(0);
  });

  test("tên server TRÙNG trong CÙNG scope ⇒ ném CÙNG thông điệp; provider cũ giữ nguyên", async () => {
    const mine = harness(McpResourceRuntime);
    const theirs = harness(stock.McpResourceRuntime);
    // Cordis từ chối MỘT promise nội bộ khi thân hiệu ứng ném ⇒ phải giữ lỗi đó lại để bun không
    // coi là unhandled rejection, rồi khẳng định CẢ HAI đường (ném đồng bộ + reject) cùng thông điệp.
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);
    try {
      const messageOf = (runtime: InstanceType<typeof McpResourceRuntime>): string => {
        runtime.register("a", providerOf().provider);
        try {
          runtime.register("a", providerOf().provider);
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      };
      const mineMessage = messageOf(mine.runtime);
      const stockMessage = messageOf(theirs.runtime);
      expect(mineMessage).toBe('MCP resource server "a" is already registered in this scope');
      expect(stockMessage).toBe(mineMessage);
      await settle();
      await settle();
    } finally {
      process.off("unhandledRejection", onRejection);
    }
    // Cordis có thể đã nuốt đường reject nội bộ; nếu có thì nó phải mang CÙNG thông điệp.
    for (const reason of rejections) {
      expect((reason as Error).message).toBe('MCP resource server "a" is already registered in this scope');
    }
    expect(mine.tools.live.length).toBe(3);
    expect(theirs.tools.live.length).toBe(3);
  });
});

describe("C6 DANH TÍNH: bảng provider phải ĐỘC LẬP giữa các scope (so sâu không bắt được)", () => {
  test("hai scope khác nhau đăng ký CÙNG tên server ⇒ không ném, mỗi bên chỉ thấy provider của mình", async () => {
    // Hai agent ⇒ hai context gốc riêng, mỗi bên một scope: đúng cách kernel dựng phiên con.
    const left = services();
    const right = services();
    await settle();
    // Khoá scope là VẬT THỂ ĐÓNG KÍN do người tạo giữ — mục prompt nhận đúng khoá này.
    const keyA = { id: "a" };
    const keyB = { id: "b" };
    const scopeA = scopeKit.createScope(left.ctx, keyA);
    const scopeB = scopeKit.createScope(right.ctx, keyB);
    const runtimeA = new McpResourceRuntime(scopeA.ctx);
    const runtimeB = new McpResourceRuntime(scopeB.ctx);
    await settle();
    // Cùng MỘT tên ở HAI scope: nếu bảng tên bị chia sẻ thì lượt thứ hai sẽ ném 'already registered'.
    const disposeA = runtimeA.register("shared", providerOf({ which: "a" }).provider);
    const disposeB = runtimeB.register("shared", providerOf({ which: "b" }).provider);
    expect(left.tools.live.length).toBe(3);
    expect(right.tools.live.length).toBe(3);
    // DANH TÍNH: hai thực thể tool KHÔNG chia sẻ vật thể cấu hình nào.
    expect(left.tools.live[0]).not.toBe(right.tools.live[0]);
    expect(left.tools.live[0]!.output).not.toBe(right.tools.live[0]!.output);
    expect(left.tools.live[0]!.parameters).not.toBe(right.tools.live[0]!.parameters);
    // Phép so SÂU một mình sẽ ĐẠT (giá trị bằng nhau) — nên phải so danh tính ở trên.
    expect(toolShape(left.tools.live[0]!)).toEqual(toolShape(right.tools.live[0]!));
    // Bảng tên của hai scope độc lập: mỗi mục prompt chỉ thấy tên của CHÍNH nó.
    const sectionA = left.prompt.sections.at(-1)!;
    const sectionB = right.prompt.sections.at(-1)!;
    expect(sectionA.text({ scope: keyA })).toContain('["shared"]');
    expect(sectionA.text({ scope: keyB })).toBe("");
    expect(sectionB.text({ scope: keyB })).toContain('["shared"]');
    disposeA();
    expect(sectionA.text({ scope: keyA })).toBe("");
    expect(sectionB.text({ scope: keyB })).toContain('["shared"]');
    disposeB();
    expect(sectionB.text({ scope: keyB })).toBe("");
  });

  test("sửa bảng provider của runtime này KHÔNG lan sang runtime kia (đối chứng âm của phép so sâu)", async () => {
    const mine = harness(McpResourceRuntime);
    const other = harness(McpResourceRuntime);
    await settle();
    mine.runtime.register("only-mine", providerOf().provider);
    const mineText = mine.prompt.sections[0]!.text({});
    const otherText = other.prompt.sections[0]!.text({});
    expect(mineText).toContain("only-mine");
    expect(otherText).toBe("");
    expect(mine.tools.live.length).toBe(3);
    expect(other.tools.live.length).toBe(0);
  });
});

describe("LUẬT 000e: locale của bản gốc phải ship NGUYÊN BYTE", () => {
  /** Thư mục locale của gói gốc trong kernel (CHỈ ĐỌC). */
  const STOCK_LOCALE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-mcp-resources/locale");
  /** Thư mục locale của ta. */
  const OURS_LOCALE = join(REPO, "packages/host/mcp-resources/locale");

  test("en.json · zh.json có mặt và GIỐNG TỪNG BYTE bản gốc (meta.title là tiêu đề hàng Plugins)", () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(OURS_LOCALE, name));
      const stockLocale = readFileSync(join(STOCK_LOCALE, name));
      expect(ours.equals(stockLocale)).toBe(true);
      expect(JSON.parse(ours.toString("utf8")).meta.title).toBe(
        JSON.parse(stockLocale.toString("utf8")).meta.title,
      );
    }
    expect(JSON.parse(readFileSync(join(OURS_LOCALE, "en.json"), "utf8")).meta.title).toBe("mcp-resources");
    expect(JSON.parse(readFileSync(join(OURS_LOCALE, "zh.json"), "utf8")).meta.title).toBe("MCP 资源访问");
  });

  test("exports có mẫu locale để tầng nạp đọc được file", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(REPO, "packages/host/mcp-resources/package.json");

/** Peer NGOÀI hai tên mà `mount.ts` luôn tự thêm (cordis, schemastery) — danh sách ĐÓNG của riêng gói này. */
const SEAM_PEERS = [
  "@deepseek-ai/dsh-llm",
  "@deepseek-ai/dsh-scope",
  "@deepseek-ai/dsh-system-prompt",
  "@deepseek-ai/dsh-tools",
];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: { id?: string; tests?: string[] } };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Đếm số lần một chuỗi con xuất hiện.
 * Nhận: văn bản và mẫu cần đếm.
 * Trả: số lần — 0 khi không có.
 */
function grepCount(text: string, pattern: string): number {
  return text.split(pattern).length - 1;
}

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    for (const peer of peers) expect(Object.keys(manifest.peerDependencies ?? {})).toContain(peer);
    expect(missingPeers(manifest)).toEqual([]);
    // Phiên bản: peer phải trỏ ĐÚNG phiên bản kernel đang chạy — hoặc PIN chính xác (parity manifest
    // stock của kernel, vd @deepseek-ai/dsh-llm-deepseek), hoặc dải "~<version>" (quy ước cũ của repo).
    // Vì sao nới (01/11/2026): gói này pin CHÍNH XÁC theo manifest stock; phép so cứng "~<version>" báo
    // đỏ một khai báo ĐÚNG. Phép kiểm vẫn KHÔNG rỗng: một phiên bản lệch (vd rc.5 khi kernel là alpha.4)
    // hoặc dải khác (^, >=, *) vẫn ĐỎ.
    for (const peer of peers) {
      const kernel = JSON.parse(readFileSync(join(REPO, "apps/host/node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      const declared = manifest.peerDependencies?.[peer];
      expect(typeof declared).toBe("string");
      expect([kernel.version, "~" + kernel.version]).toContain(declared as string);
    }
  });

  test("peer khai ra phải có THẬT trong kernel; hai peer chuẩn cũng phải khai", () => {
    const manifest = readManifest();
    const declared = Object.keys(manifest.peerDependencies ?? {});
    for (const peer of [...(manifest.gbh?.peers ?? []), "@deepseek-ai/cordis", "@deepseek-ai/schemastery"]) {
      expect(declared).toContain(peer);
      expect(existsSync(join(REPO, "apps/host/node_modules", peer, "package.json"))).toBe(true);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const declared = { ...(manifest.peerDependencies ?? {}) };
      delete declared[peer];
      expect(missingPeers({ ...manifest, peerDependencies: declared })).toEqual([peer]);
    }
    // Xoá SẠCH ⇒ phải báo ĐỦ danh sách (không phải một con số).
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const manifest = readManifest();
    const mutated: Manifest = {
      ...manifest,
      peerDependencies: { ...(manifest.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" },
    };
    expect(missingPeers(mutated)).toEqual([]);
  });

  test("peer KHÔNG được khai trong dependencies (tránh thể hiện thứ hai)", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    expect((manifest.gbh?.peers ?? []).filter((peer) => deps.has(peer))).toEqual([]);
  });

  test("nếu gbh.row ĐƯỢC khai thì phải ĐÚNG: id row stock · KHÔNG config · tests trỏ file có thật", () => {
    // Việc KHAI row thuộc Lead (công nhân row không tự khai). Ca này giữ đúng phần MÁY KIỂM ĐƯỢC:
    // khai báo — nếu có — phải trỏ ĐÚNG row stock, KHÔNG tự thêm cấu hình (oracle không có `config:`),
    // và test được khai phải TỒN TẠI (nếu không, `check:rows`/`hygiene` chỉ thấy một đường dẫn rỗng).
    const manifest = readManifest() as Manifest & {
      gbh?: { row?: { id?: string; config?: unknown; moduleIds?: unknown; aliases?: unknown; tests?: string[] } };
    };
    const row = manifest.gbh?.row;
    if (row === undefined) return;
    expect(row.id).toBe("mcp-resources");
    expect(row.config).toBeUndefined();
    // Row host thuần: KHÔNG id module, KHÔNG alias — thêm vào là mở đường cho entry lạ trong đồ thị boot.
    expect(row.moduleIds).toBeUndefined();
    expect(row.aliases).toBeUndefined();
    expect(row.tests).toEqual(["tests/host/mcp-resources.test.ts"]);
    for (const test of row.tests ?? []) expect(existsSync(join(REPO, test))).toBe(true);
  });
});