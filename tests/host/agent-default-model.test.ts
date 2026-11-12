/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test cho @galaxy-blackhole/gbh-agent-default-model: tập export đo trên ARTIFACT, đối chứng TRỰC TIẾP
 *      với chính bundle gốc trên Context cordis THẬT (currentSelection · tham chiếu sống · saveSelection
 *      xếp hàng + cô lập lỗi · C6 danh tính vật thể cấu hình), và quy ước gbh.peers ⊆ peerDependencies
 *      kèm ĐỐI CHỨNG ÂM.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/agent-default-model/build.ts";
import AgentDefaultModelConfig from "../../packages/host/agent-default-model/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "agent-default-model");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-agent-default-model", "lib", "index.js");
/** cordis của kernel — đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Khoá ghi của tham chiếu `Volatile` (cosmokit) — cách Settings sửa giá trị SỐNG tại chỗ. */
const VOLATILE_WRITE = Symbol.for("cosmokit.volatile.write");

/** Lựa chọn model ở dạng THUẦN dữ liệu — đúng hình dạng `ModelSelection` mà điểm vào Agent nhận. */
interface Selection {
  /** Tuyến provider. */
  provider: string;
  /** Id model. */
  model: string;
  /** Mức suy luận (chuỗi đã đóng dấu hiệu ở tầng kiểu; lúc chạy là chính chuỗi đó). */
  reasoningEffort?: string;
}

/** Thực thể dịch vụ quan sát được — hai phương thức công khai của bản gốc. */
interface ServiceLike {
  /** Đọc lựa chọn mặc định hiện tại. */
  currentSelection(): Selection;
  /** Ghi lựa chọn đầy đủ vào profile. */
  saveSelection(next: Selection): Promise<void>;
}

/** Lớp plugin của MỘT bên cài (ta hoặc gốc). */
interface PluginClass {
  /** Dựng dịch vụ trên một Context; cấu hình đã qua schema. */
  new (ctx: unknown, config: unknown): ServiceLike;
  /** Schema schemastery, đồng thời là hàm chuẩn hoá cấu hình. */
  Config: (value: unknown) => unknown;
}

/** Context cordis tối thiểu mà phép đo chạm tới (`provide` · `get` · `fiber` · `plugin`). */
interface HarnessContext {
  /** Cấp một dịch vụ giả trong phạm vi của fiber hiện tại. */
  provide(name: string, value: unknown): unknown;
  /** Tra một dịch vụ đã cấp. */
  get(name: string): unknown;
  /** Fiber chủ của context — nơi Loader gắn `entry` của mục profile. */
  fiber: { entry?: unknown };
  /** Nạp một plugin (đường THẬT mà tầng nạp dùng); trả fiber của nó. */
  plugin(plugin: unknown, config: unknown): unknown;
}

/** Bản gốc nạp động: cùng hai export `AgentDefaultModelConfig` và `default`. */
const stock = ((await import(STOCK)) as unknown as { default: PluginClass }).default;
/** `Context` của cordis kernel — MỘT lớp cho cả hai bên cài (cùng một tệp thật). */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => HarnessContext };

/** Một lượt ghi mà config-editor giả đã nhận. */
interface EditCall {
  /** Mục profile mà lượt ghi nhắm tới. */
  entry: unknown;
  /** Cấu hình THÔ đầy đủ do bộ dựng trả về. */
  config: Record<string, unknown>;
}

/** Config-editor giả: ghi vết mọi lượt `edit`, có thể trì hoãn hoặc ném theo `provider`. */
interface FakeEditor {
  /** Nhận `entry` và bộ dựng cấu hình; trả promise. */
  edit(
    entry: unknown,
    change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void>;
}

/** Dấu vết của một lần dựng giàn. */
interface Booted {
  /** Context đã cấp seam. */
  ctx: HarnessContext;
  /** Thực thể dịch vụ. */
  service: ServiceLike;
  /** Mọi lượt ghi config-editor đã nhận, theo thứ tự. */
  edits: EditCall[];
  /** Cấu hình thô đã chuẩn hoá (ba tham chiếu sống) — giữ để ca "tham chiếu sống" sửa tại chỗ. */
  config: { provider: Record<symbol, unknown>; model: Record<symbol, unknown>; reasoningEffort: Record<symbol, unknown> };
  /** Các lượt `settings.configure` đã nhận. */
  settingsCalls: { presentation: unknown; hasOwner: boolean }[];
}

/**
 * Dựng MỘT bên cài trên Context cordis thật, kèm hai seam giả có ghi vết.
 * Nhận: lớp plugin, cấu hình thô, và hai cờ chọn có cấp `fiber.entry` / `configEditor` hay không.
 * Trả: dấu vết đầy đủ để so hai bên.
 */
async function boot(
  plugin: PluginClass,
  raw: Record<string, unknown>,
  options: { entry?: boolean; editor?: FakeEditor } = { entry: true },
): Promise<Booted> {
  const settingsCalls: { presentation: unknown; hasOwner: boolean }[] = [];
  const edits: EditCall[] = [];
  const ctx = new Context();
  ctx.provide("settings", {
    configure(presentation: unknown, owner?: unknown): () => void {
      settingsCalls.push({ presentation, hasOwner: owner !== undefined });
      return () => undefined;
    },
  });
  if (options.editor !== undefined) ctx.provide("configEditor", options.editor);
  if (options.entry === true) ctx.fiber.entry = { id: "agent-default-model" };
  const config = plugin.Config(raw) as Booted["config"];
  const service = new plugin(ctx, config);
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { ctx, service, edits, config, settingsCalls };
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
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

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-adm-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["AgentDefaultModelConfig", "default"]);
    // Row host thuần: KHÔNG có `__ModuleLoader__` nào ⇒ đếm id stock trong artifact phải là 0.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Cùng bốn module ngoài mà gốc nạp: `selection` là hàm NỘI BỘ, không phải export.
    for (const specifier of ["@deepseek-ai/cordis", "@deepseek-ai/dsh-llm", "@deepseek-ai/schemastery"]) {
      expect(oursText).toContain('from "' + specifier + '"');
    }
    expect(exportNames(stockText)).not.toContain("selection");
    expect(exportNames(oursText)).not.toContain("selection");
  });

  test("\"agentDefaultModel\" là TÊN DỊCH VỤ của cả hai bản (đăng ký qua đường nạp THẬT)", async () => {
    const mine = new Context();
    mine.provide("settings", { configure: () => () => undefined });
    mine.plugin(AgentDefaultModelConfig, { provider: "auto", model: "deepseek-v4.1-flash" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const theirs = new Context();
    theirs.provide("settings", { configure: () => () => undefined });
    theirs.plugin(stock, { provider: "auto", model: "deepseek-v4.1-flash" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    for (const ctx of [mine, theirs]) {
      const service = ctx.get("agentDefaultModel") as ServiceLike;
      expect(service).toBeDefined();
      expect((service as unknown as { name: string }).name).toBe("agentDefaultModel");
      expect(service.currentSelection()).toEqual({ provider: "auto", model: "deepseek-v4.1-flash" });
    }
    // Cùng hình dạng prototype: hai phương thức công khai, không thừa không thiếu.
    const prototype = (plugin: PluginClass): string[] =>
      Object.getOwnPropertyNames((plugin as unknown as { prototype: object }).prototype);
    expect(prototype(AgentDefaultModelConfig as unknown as PluginClass)).toEqual(prototype(stock));
  });

  test("String(Config) trùng từng chữ; schema TỪ CHỐI cấu hình thiếu trường bắt buộc — cùng thông điệp", () => {
    const ours = AgentDefaultModelConfig.Config;
    const theirs = stock.Config;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe("{ provider: string, model: string, reasoningEffort?: string }");
    const missing = (schema: (value: unknown) => unknown): string => {
      try {
        schema({ model: "m" });
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    expect(missing(ours as unknown as (value: unknown) => unknown)).toBe("$.provider missing required value");
    expect(missing(ours as unknown as (value: unknown) => unknown)).toBe(
      missing(theirs as unknown as (value: unknown) => unknown),
    );
  });
});

describe("hành vi ĐỌC: currentSelection đối chứng với bản gốc trên cùng giàn", () => {
  test("trả đúng cặp provider/model; reasoningEffort VẮNG MẶT khi cấu hình không khai — y bản gốc", async () => {
    const raw = { provider: "auto", model: "deepseek-v4.1-flash" };
    const ours = await boot(AgentDefaultModelConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    expect(ours.service.currentSelection()).toEqual(theirs.service.currentSelection());
    expect(ours.service.currentSelection()).toEqual({ provider: "auto", model: "deepseek-v4.1-flash" });
    expect(Object.hasOwn(ours.service.currentSelection(), "reasoningEffort")).toBe(false);
  });

  test("reasoningEffort có khai ⇒ mặt nạ ĐÃ ĐÓNG DẤU HIỆU, nhưng lúc chạy là CHÍNH chuỗi đó (hai bên bằng nhau)", async () => {
    const raw = { provider: "auto", model: "m", reasoningEffort: "high" };
    const ours = await boot(AgentDefaultModelConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    const mine = ours.service.currentSelection();
    expect(mine).toEqual(theirs.service.currentSelection());
    expect(Object.hasOwn(mine, "reasoningEffort")).toBe(true);
    // `ReasoningEffortId` chỉ ĐÓNG DẤU ở tầng kiểu — giá trị chạy được vẫn là chuỗi thuần (nên sao chép/so sánh được).
    expect(mine.reasoningEffort).toBe("high");
    expect(typeof mine.reasoningEffort).toBe("string");
  });

  test("ĐỌC LẠI tham chiếu SỐNG: sửa giá trị tại chỗ (như Settings) thì lượt đọc sau thấy NGAY — y bản gốc", async () => {
    const raw = { provider: "auto", model: "m" };
    const ours = await boot(AgentDefaultModelConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    const write = (target: Record<symbol, unknown>, value: string): void => {
      (target[VOLATILE_WRITE] as (next: string) => void)(value);
    };
    write(ours.config.provider as Record<symbol, unknown>, "next-provider");
    write(theirs.config.provider as Record<symbol, unknown>, "next-provider");
    expect(ours.service.currentSelection().provider).toBe("next-provider");
    expect(ours.service.currentSelection()).toEqual(theirs.service.currentSelection());
  });

  test("lựa chọn trả về là object TÁCH RỜI: sửa nó KHÔNG chạm cấu hình của dịch vụ — y bản gốc", async () => {
    const raw = { provider: "auto", model: "m" };
    const ours = await boot(AgentDefaultModelConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    const first = ours.service.currentSelection();
    first.model = "HIJACK";
    first.provider = "HIJACK";
    expect(ours.service.currentSelection()).toEqual({ provider: "auto", model: "m" });
    expect(ours.service.currentSelection()).toEqual(theirs.service.currentSelection());
  });

  test("mỗi lượt đọc trả MỘT vật thể MỚI (so DANH TÍNH) — y bản gốc", async () => {
    const ours = await boot(AgentDefaultModelConfig as unknown as PluginClass, { provider: "auto", model: "m" });
    const theirs = await boot(stock, { provider: "auto", model: "m" });
    expect(ours.service.currentSelection()).not.toBe(ours.service.currentSelection());
    expect(theirs.service.currentSelection()).not.toBe(theirs.service.currentSelection());
    // Hai THỰC THỂ dịch vụ cũng độc lập: đọc bên này không trả vật thể của bên kia.
    expect(ours.service.currentSelection()).not.toBe(theirs.service.currentSelection());
  });
});

describe("hành vi GHI: saveSelection đối chứng với bản gốc trên cùng giàn", () => {
  test("ghi lựa chọn ĐẦY ĐỦ vào `fiber.entry`; bỏ khoá reasoningEffort khi vắng mặt — y bản gốc", async () => {
    const run = async (plugin: PluginClass): Promise<EditCall[]> => {
      const edits: EditCall[] = [];
      const booted = await boot(plugin, { provider: "auto", model: "m" });
      const editor: FakeEditor = {
        async edit(entry, change): Promise<void> {
          edits.push({ entry, config: change({}, {}) });
        },
      };
      booted.ctx.provide("configEditor", editor);
      await booted.service.saveSelection({ provider: "p1", model: "m1", reasoningEffort: "high" });
      await booted.service.saveSelection({ provider: "p2", model: "m2" });
      return edits;
    };
    const ours = await run(AgentDefaultModelConfig as unknown as PluginClass);
    const theirs = await run(stock);
    expect(ours).toEqual(theirs);
    expect(ours.length).toBe(2);
    expect(ours[0]?.entry).toEqual({ id: "agent-default-model" });
    expect(ours[0]?.config).toEqual({ provider: "p1", model: "m1", reasoningEffort: "high" });
    // Lượt ghi thứ hai KHÔNG mang khoá `reasoningEffort` (xoá chứ không ghi `undefined`).
    expect(Object.hasOwn(ours[1]?.config ?? {}, "reasoningEffort")).toBe(false);
    expect(ours[1]?.config).toEqual({ provider: "p2", model: "m2" });
  });

  test("KHÔNG có `fiber.entry` hoặc KHÔNG có `configEditor` ⇒ không ghi, không ném — y bản gốc", async () => {
    /**
     * Chạy MỘT ca thiếu seam: đếm số lượt ghi mà config-editor (nếu được cấp) đã nhận.
     * Nhận: lớp plugin và hai cờ — có gắn `fiber.entry` không, có cấp `configEditor` không.
     * Trả: số lượt ghi đã nhận (0 = không ghi gì).
     */
    const run = async (plugin: PluginClass, options: { entry: boolean; editor: boolean }): Promise<number> => {
      const edits: EditCall[] = [];
      const booted = await boot(plugin, { provider: "auto", model: "m" }, options.editor ? { entry: options.entry, editor: { async edit(entry, change): Promise<void> { edits.push({ entry, config: change({}, {}) }); } } } : { entry: options.entry });
      await booted.service.saveSelection({ provider: "p", model: "m" });
      return edits.length;
    };
    for (const options of [
      { entry: false, editor: true },
      { entry: true, editor: false },
      { entry: false, editor: false },
    ]) {
      expect(await run(AgentDefaultModelConfig as unknown as PluginClass, options)).toBe(0);
      expect(await run(stock, options)).toBe(0);
    }
  });

  test("xếp hàng theo thứ tự NỘP; lượt ghi hỏng chỉ từ chối NGƯỜI GỌI đó, không chặn lượt sau — y bản gốc", async () => {
    const run = async (plugin: PluginClass): Promise<{
      order: string[];
      status: string[];
      reasons: (string | null)[];
      distinct: boolean;
    }> => {
      const seen: Record<string, unknown>[] = [];
      const booted = await boot(plugin, { provider: "auto", model: "m" });
      booted.ctx.provide("configEditor", {
        async edit(_entry, change): Promise<void> {
          const config = change({}, {});
          seen.push(config);
          if (config.provider === "slow") {
            await new Promise((resolve) => setTimeout(resolve, 20));
            throw new Error("boom");
          }
        },
      } satisfies FakeEditor);
      const settled = await Promise.allSettled([
        booted.service.saveSelection({ provider: "slow", model: "m1" }),
        booted.service.saveSelection({ provider: "fast", model: "m2" }),
        booted.service.saveSelection({ provider: "after", model: "m3" }),
      ]);
      return {
        order: seen.map((config) => String(config.provider)),
        status: settled.map((result) => result.status),
        reasons: settled.map((result) => (result.status === "rejected" ? String((result.reason as Error).message) : null)),
        distinct: seen[0] !== seen[1] && seen[1] !== seen[2],
      };
    };
    const ours = await run(AgentDefaultModelConfig as unknown as PluginClass);
    const theirs = await run(stock);
    expect(ours).toEqual(theirs);
    expect(ours.order).toEqual(["slow", "fast", "after"]);
    expect(ours.status).toEqual(["rejected", "fulfilled", "fulfilled"]);
    expect(ours.reasons).toEqual(["boom", null, null]);
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("mỗi lượt ghi tạo vật thể RIÊNG: sửa bản chụp của lượt trước KHÔNG lan sang lượt sau — y bản gốc", async () => {
    const run = async (plugin: PluginClass): Promise<{ same: boolean; leaked: unknown; afterMutation: unknown }> => {
      const snapshots: Record<string, unknown>[] = [];
      const booted = await boot(plugin, { provider: "auto", model: "m" });
      booted.ctx.provide("configEditor", {
        async edit(_entry, change): Promise<void> {
          const config = change({}, {});
          snapshots.push(config);
          // Lượt ghi thứ nhất bị SỬA trong lúc lượt thứ hai còn chờ trong hàng đợi.
          if (snapshots.length === 1) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            config.provider = "MUTATED";
          }
        },
      } satisfies FakeEditor);
      await Promise.all([
        booted.service.saveSelection({ provider: "first", model: "m1" }),
        booted.service.saveSelection({ provider: "second", model: "m2" }),
      ]);
      return {
        same: snapshots[0] === snapshots[1],
        leaked: snapshots[1]?.provider,
        afterMutation: snapshots[0]?.provider,
      };
    };
    const ours = await run(AgentDefaultModelConfig as unknown as PluginClass);
    const theirs = await run(stock);
    expect(ours).toEqual(theirs);
    // Phép so SÂU một mình sẽ ĐẠT cả khi dùng chung một hằng ⇒ phải so DANH TÍNH.
    expect(ours.same).toBe(false);
    expect(ours.leaked).toBe("second");
    expect(ours.afterMutation).toBe("MUTATED");
  });

  test("hai THỰC THỂ dịch vụ có hàng đợi ghi ĐỘC LẬP: lỗi bên này không chặn bên kia — y bản gốc", async () => {
    const run = async (plugin: PluginClass): Promise<{ first: string; second: string }> => {
      const failing = await boot(plugin, { provider: "auto", model: "a" });
      const healthy = await boot(plugin, { provider: "auto", model: "b" });
      for (const booted of [failing, healthy]) {
        booted.ctx.provide("configEditor", {
          async edit(_entry, change): Promise<void> {
            const config = change({}, {});
            if (booted === failing && config.provider === "boom") throw new Error("hàng đợi hỏng");
          },
        } satisfies FakeEditor);
      }
      const first = await failing.service.saveSelection({ provider: "boom", model: "m" }).then(
        () => "fulfilled",
        () => "rejected",
      );
      const second = await healthy.service.saveSelection({ provider: "ok", model: "m" }).then(
        () => "fulfilled",
        () => "rejected",
      );
      return { first, second };
    };
    const ours = await run(AgentDefaultModelConfig as unknown as PluginClass);
    const theirs = await run(stock);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual({ first: "rejected", second: "fulfilled" });
  });
});

describe("seam `settings`: tắt trang cấu hình TỰ ĐỘNG của thể hiện này", () => {
  test("xin đúng { auto: false } và trao fiber CHỦ — y bản gốc", async () => {
    const ours = await boot(AgentDefaultModelConfig as unknown as PluginClass, { provider: "auto", model: "m" });
    const theirs = await boot(stock, { provider: "auto", model: "m" });
    expect(ours.settingsCalls).toEqual(theirs.settingsCalls);
    expect(ours.settingsCalls.length).toBe(1);
    expect(ours.settingsCalls[0]?.presentation).toEqual({ auto: false });
    expect(ours.settingsCalls[0]?.hasOwner).toBe(true);
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer NGOÀI hai tên mà `mount.ts` luôn tự thêm (cordis, schemastery) — danh sách ĐÓNG của riêng gói này. */
const SEAM_PEERS = ["@deepseek-ai/dsh-llm"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Chỉ mượn KIỂU (bị xoá lúc build) — không phải seam lúc chạy. */
  devDependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Đầu ra công khai. */
  exports?: Record<string, unknown>;
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
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    for (const peer of peers) expect(declared).toContain(peer);
    expect(missingPeers(manifest)).toEqual([]);
    // Phiên bản: peer phải trỏ ĐÚNG phiên bản kernel đang chạy. Lượt pin exact (01/11/2026) đổi từ dải
    // "~0.2.1-alpha.4" sang chính xác "0.2.1-alpha.4" ⇒ nhận CẢ HAI dạng, nhưng không nhận dải khác.
    for (const peer of peers) {
      const kernel = JSON.parse(readFileSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      const declaredVersion = manifest.peerDependencies?.[peer];
      // Nhận CẢ dạng exact lẫn dải "~x", nhưng PHẢI trỏ đúng phiên bản kernel đang chạy.
      expect(declaredVersion === kernel.version || declaredVersion === "~" + kernel.version).toBe(true);
    }
  });

  test("peer khai ra phải có THẬT trong kernel; hai peer chuẩn cũng phải khai", () => {
    const manifest = readManifest();
    const declared = Object.keys(manifest.peerDependencies ?? {});
    for (const peer of [...(manifest.gbh?.peers ?? []), "@deepseek-ai/cordis", "@deepseek-ai/schemastery"]) {
      expect(declared).toContain(peer);
      expect(existsSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"))).toBe(true);
    }
    // `dsh-agent` chỉ mượn KIỂU (`ModelSelection`) ⇒ nằm ở devDependencies, KHÔNG thành seam lúc chạy.
    expect(declared).not.toContain("@deepseek-ai/dsh-agent");
    expect(Object.keys(manifest.devDependencies ?? {})).toContain("@deepseek-ai/dsh-agent");
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // Xoá SẠCH peerDependencies ⇒ phải báo ĐỦ cả danh sách (không phải một con số).
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
  });

  test("peer KHÔNG được khai trong dependencies (tránh thể hiện thứ hai)", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    expect((manifest.gbh?.peers ?? []).filter((peer) => deps.has(peer))).toEqual([]);
    expect(manifest.dependencies).toBeUndefined();
  });

  });

describe("000e — gói gốc CÓ locale ⇒ ta ship lại byte-for-byte", () => {
  test("locale/{en,zh}.json khớp TỪNG BYTE với bản gốc và có trong exports", () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.exports ?? {})).toContain("./locale/*.json");
    for (const language of ["en", "zh"]) {
      const ours = readFileSync(join(PKG, "locale", language + ".json"));
      const theirs = readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-agent-default-model", "locale", language + ".json"));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});
