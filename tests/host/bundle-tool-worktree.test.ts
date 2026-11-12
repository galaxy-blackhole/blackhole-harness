/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test RIÊNG cho @galaxy-blackhole/gbh-tool-worktree-bundle (08/11/2026, dev-1 — gói trước đây không khai
 *      gbh.tests): khẳng định BA export của artefact (name · inject · apply), hành vi đăng ký tool
 *      `create_worktree` trên ctx GIẢ (đúng 1 định nghĩa · tham số · output schema · execute uỷ nhiệm
 *      `ctx.worktrees.create` · thiếu agent thì ném), và bundle patch `./cordis.patch.yml` cắm ĐÚNG hai row
 *      stock của bản gốc; kèm khẳng định `exports`/provenance của package.json trỏ đúng tệp có thật.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "bundle-tool-worktree");
/** Artefact đã build của gói (plugin chạy thật). */
const ARTIFACT = join(PKG, "lib", "index.js");
/** Bundle patch đi kèm gói. */
const PATCH = join(PKG, "cordis.patch.yml");
/** Đường dẫn test do gói tự khai. */
const TEST_PATH = "tests/host/bundle-tool-worktree.test.ts";

/** Hình dạng định nghĩa tool mà artefact đăng ký (chỉ trường test đọc). */
interface ToolDefinitionShape {
  /** Tên tool. */
  readonly name: string;
  /** Mô tả model thấy. */
  readonly description: string;
  /** Tham số (JSON Schema rút gọn của repo). */
  readonly parameters: Record<string, { readonly type: string; readonly description?: string }>;
  /** Khai báo đầu ra. */
  readonly output: { readonly schema: Record<string, unknown> };
  /** Thân thực thi. */
  readonly execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>;
  /** Dựng thẻ hiển thị. */
  readonly presentCall: (args: Record<string, unknown>) => { readonly card: string; readonly title: string };
}

/** Hình dạng module artefact của gói. */
interface BundleModule {
  /** Tên plugin cordis. */
  readonly name: string;
  /** Seam plugin tiêu thụ. */
  readonly inject: string[];
  /** Hàm nạp plugin. */
  readonly apply: (ctx: unknown) => void;
}

/** Đọc manifest của gói ta. */
function manifest(): {
  readonly name?: string;
  readonly exports?: Record<string, unknown>;
  readonly gbh?: {
    readonly tests?: readonly string[];
    readonly provenance?: { readonly stock?: string; readonly patch?: string; readonly patchLines?: number };
  };
} {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));
}

/** Nạp artefact của gói (module ESM đã build). */
async function loadArtifact(): Promise<BundleModule> {
  return (await import(ARTIFACT)) as BundleModule;
}

/**
 * Dựng ctx GIẢ tối thiểu: sổ tool + runtime worktree ghi lại lời gọi.
 * @returns { ctx, registered, calls } — ctx để truyền vào apply, mảng định nghĩa đã đăng ký, nhật ký gọi worktrees.create.
 */
function fakeContext(): {
  ctx: unknown;
  registered: ToolDefinitionShape[];
  calls: Array<{ agent: unknown; args: Record<string, unknown>; signal: unknown }>;
} {
  const registered: ToolDefinitionShape[] = [];
  const calls: Array<{ agent: unknown; args: Record<string, unknown>; signal: unknown }> = [];
  const ctx = {
    tools: {
      register(definition: ToolDefinitionShape): () => void {
        registered.push(definition);
        return () => void 0;
      },
    },
    worktrees: {
      async create(agent: unknown, args: Record<string, unknown>, signal: unknown): Promise<unknown> {
        calls.push({ agent, args, signal });
        return { path: "/tmp/wt", branch: "b", baseCommit: "c", repositoryRoot: "/tmp/repo" };
      },
    },
  };
  return { ctx, registered, calls };
}

describe("bundle-tool-worktree · ba export của artefact", () => {
  test("artefact export ĐÚNG BA tên {apply, inject, name}, không default", async () => {
    const mod = await loadArtifact();
    expect(Object.keys(mod).sort()).toEqual(["apply", "inject", "name"]);
    expect("default" in mod).toBe(false);
  });

  test("name = 'tool-worktree' và inject = ['tools','worktrees'] NGUYÊN VĂN", async () => {
    const mod = await loadArtifact();
    expect(mod.name).toBe("tool-worktree");
    expect([...mod.inject]).toEqual(["tools", "worktrees"]);
    expect(typeof mod.apply).toBe("function");
  });
});

describe("bundle-tool-worktree · đăng ký tool trên ctx GIẢ", () => {
  test("apply đăng ký ĐÚNG MỘT định nghĩa tên create_worktree", async () => {
    const { ctx, registered } = fakeContext();
    (await loadArtifact()).apply(ctx);
    expect(registered.length).toBe(1);
    const tool = registered[0] as ToolDefinitionShape;
    expect(tool.name).toBe("create_worktree");
    expect(tool.description.length).toBeGreaterThan(20);
    expect(typeof tool.execute).toBe("function");
    expect(typeof tool.presentCall).toBe("function");
  });

  test("tham số: đúng hai trường name/from, output schema bốn trường bắt buộc", async () => {
    const { ctx, registered } = fakeContext();
    (await loadArtifact()).apply(ctx);
    const tool = registered[0] as ToolDefinitionShape;
    // `defineTool` của kernel nhận JSON Schema đầy đủ ⇒ tham số nằm dưới `properties`.
    const params = tool.parameters as unknown as { type?: string; properties?: Record<string, { type: string }> };
    expect(params.type).toBe("object");
    expect(Object.keys(params.properties ?? {}).sort()).toEqual(["from", "name"]);
    expect(params.properties?.["name"]?.type).toBe("string");
    expect(params.properties?.["from"]?.type).toBe("string");
    const schema = tool.output.schema as { required?: string[]; properties?: Record<string, unknown> };
    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(["baseCommit", "branch", "path", "repositoryRoot"]);
    expect([...(schema.required ?? [])].sort()).toEqual(["baseCommit", "branch", "path", "repositoryRoot"]);
  });

  test("presentCall trả thẻ generic + tiêu đề create_worktree, rawInput là args", async () => {
    const { ctx, registered } = fakeContext();
    (await loadArtifact()).apply(ctx);
    const tool = registered[0] as ToolDefinitionShape;
    const card = tool.presentCall({ name: "wt-1" });
    expect(card).toEqual({ card: "generic", title: "create_worktree", rawInput: { name: "wt-1" } } as never);
  });

  test("execute uỷ nhiệm ctx.worktrees.create(agent, args, signal) và trả nguyên kết quả", async () => {
    const { ctx, registered, calls } = fakeContext();
    (await loadArtifact()).apply(ctx);
    const tool = registered[0] as ToolDefinitionShape;
    const agent = { session: { id: "s-1" } };
    const signal = new AbortController().signal;
    const value = await tool.execute({ name: "wt-1" }, { agent, signal });
    expect(calls.length).toBe(1);
    expect(calls[0]?.agent).toBe(agent);
    expect(calls[0]?.args).toEqual({ name: "wt-1" });
    expect(calls[0]?.signal).toBe(signal);
    expect(value).toEqual({ path: "/tmp/wt", branch: "b", baseCommit: "c", repositoryRoot: "/tmp/repo" });
  });

  test("execute THIẾU agent ⇒ ném đúng câu lỗi (bản gốc giữ nguyên hành vi)", async () => {
    const { ctx, registered, calls } = fakeContext();
    (await loadArtifact()).apply(ctx);
    const tool = registered[0] as ToolDefinitionShape;
    let message = "";
    try {
      await tool.execute({}, {});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("create_worktree requires a calling agent");
    expect(calls.length).toBe(0);
  });
});

describe("bundle-tool-worktree · bundle patch + manifest", () => {
  test("cordis.patch.yml tồn tại, có header 5 dòng và cắm ĐÚNG hai row GÓI GBH", () => {
    expect(existsSync(PATCH)).toBe(true);
    const text = readFileSync(PATCH, "utf8");
    const head = text.split(String.fromCharCode(10)).slice(0, 6).join(String.fromCharCode(10));
    expect(head).toContain("author Bùi Trọng Hiếu");
    expect(head).toContain("create date 15/10/2026");
    expect(text).toContain("- insert:");
    expect(text).toContain("id: worktree");
    // 09/11/2026 (quyết định chủ dự án: dùng plugin của GBH, không tải code DSH):
    //   hai row phải cắm GÓI GBH. Kỳ vọng đổi theo ĐÚNG giá trị mới, phép kiểm giữ nguyên độ mạnh
    //   (vẫn khẳng định tên gói chính xác từng row); ca parity ở bundle-profile-patches.test.ts
    //   vẫn chứng minh bản ta thay NGƯỢC ra nguyên văn bản gốc.
    // 10/11/2026 (sự cố "tắt plugin mà vẫn chạy"): row `worktree` trỏ gói viết lại của ta
    //   (@galaxy-blackhole/gbh-worktree, khai gbh.row.ownedByBundle) — ĐÚNG gói mà app.patch.yml từng
    //   cắm dưới id "worktree-ours", nên hành vi đang chạy không đổi, chỉ đổi NGUỒN cắm row.
    expect(text).toContain("name: '@galaxy-blackhole/gbh-worktree'");
    expect(text).toContain("id: tool-worktree");
    expect(text).toContain("name: '@galaxy-blackhole/gbh-tool-worktree'");
    expect(text).not.toContain("@deepseek-ai/dsh-experimental-tool-worktree'");
  });

  test("manifest: tên gói · exports['.'] điều kiện types+default · subpath patch có thật · gbh.tests trỏ tệp này", () => {
    const pkg = manifest();
    expect(pkg.name).toBe("@galaxy-blackhole/gbh-tool-worktree-bundle");
    expect(pkg.exports?.["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(pkg.exports?.["./cordis.patch.yml"]).toBe("./cordis.patch.yml");
    expect(existsSync(join(PKG, "lib", "types", "index.d.ts"))).toBe(true);
    // gbh.tests: khai ĐÚNG tệp test này (08/11/2026 — trước đây gói để rỗng, review-2 nêu đúng là lỗ hổng).
    expect(pkg.gbh?.tests).toEqual([TEST_PATH]);
    expect(existsSync(join(REPO, TEST_PATH))).toBe(true);
    // provenance trỏ patch của chính gói + số dòng khớp tệp thật.
    expect(pkg.gbh?.provenance?.patch).toBe("./cordis.patch.yml");
    // `patchLines` đếm DÒNG NỘI DUNG (bỏ 6 dòng header comment + dòng trống) chứ không phải tổng số dòng tệp.
    const contentLines = readFileSync(PATCH, "utf8")
      .split(String.fromCharCode(10))
      .filter((line) => line.trim().length > 0 && !line.trimStart().startsWith("#")).length;
    expect(pkg.gbh?.provenance?.patchLines).toBe(contentLines);
  });
});
