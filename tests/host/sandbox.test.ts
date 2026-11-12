/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-sandbox: đo trên ARTIFACT đã build, và so TỪNG hành vi với CHÍNH bundle gốc của DSH (chọn runner · bọc argv · đóng cửa · grant windows-acl · danh tính)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { realpathSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import Ours, { LocalSandboxProvider } from "../../packages/host/sandbox/src/index.ts";
import { buildPackage } from "../../packages/host/sandbox/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "sandbox");
/** cordis mà nửa ta nạp (symlink sang bản cài của apps/host — CÙNG một thể hiện module). */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà chính bundle gốc nạp. */
const STOCK_CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sandbox-local", "lib", "index.js");
/** 05/11/2026 (P1b): bản gốc ĐÚNG provenance của gói (`dsh-sandbox`, 16 tên) — khác `dsh-sandbox-local` (2 tên). */
const STOCK_FULL = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sandbox", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");

/** Cấu hình thô của row (mọi trường tuỳ chọn — schema cấp mặc định). */
interface ConfigShape {
  /** Ghi đè argv runner. */
  runnerCommand?: string[];
  /** Dấu hiệu lỗi của runner ghi đè. */
  runnerFailureSignatures?: string[];
  /** Trần thời gian mỗi phép dò. */
  probeTimeoutMs?: number;
}

/** Policy một lượt gọi — đúng hình dạng seam mang xuống. */
interface Policy {
  /** Chế độ tác động tệp. */
  mode: "read-only" | "workspace-write" | "danger-full-access";
  /** Gốc workspace. */
  workspaceRoot: string;
  /** Danh tính phiên gọi (vắng mặt với lượt không có agent). */
  sessionId?: string;
}

/** Bề mặt provider mà test chạm tới (phần công khai + móc kiểm thử). */
interface Provider {
  /** Bọc argv theo policy (hợp đồng chính của seam). */
  confine(argv: readonly string[], policy: Policy, signal?: AbortSignal): Promise<unknown>;
  /** Móc kiểm thử — bơm kết luận dò / runner giả / nền tảng giả. */
  internals: Record<string, unknown>;
  /** Fiber cordis của chính provider (đo trạng thái activate). */
  ctx: { fiber: { state: number } };
}

/** Lớp provider nạp động (bản của ta hoặc bản gốc) — cùng hình dạng công khai. */
interface ProviderClass {
  /** Dựng provider trên một Context. */
  new (ctx: unknown, config: ConfigShape): Provider;
  /** Schema cấu hình: gọi để lấy mặc định, hoặc `String()` để so hình dạng. */
  Config(input?: ConfigShape): ConfigShape;
  /** Tên lớp. */
  name: string;
  /** Nguyên mẫu — nơi khai các phương thức. */
  prototype: object;
}

/** Context cordis tối thiểu mà test dùng. */
interface MiniContext {
  /** Cắm một plugin (lớp provider) vào Context. */
  plugin(plugin: unknown, config?: ConfigShape): unknown;
  /** Tra một service theo tên. */
  get(name: string): unknown;
}

/** Vỏ của hai trường grant nội bộ — soi để đo vòng đời grant mà KHÔNG cần Windows thật. */
interface GrantView {
  /** Grant gốc theo workspace (đứng yên). */
  workspaceGrants: Map<string, { dispose(): void }>;
  /** Năng lực thư mục tạm theo cặp phiên/workspace (thu hồi được). */
  tempCapabilities: Map<string, { dir: string; writeSid: string; grant: { dispose(): void } }>;
  /** Thu hồi mọi grant (đường dispose của provider). */
  revokeAclGrants(): void;
}

/**
 * Chờ tới khi một điều kiện đúng, CÓ TRẦN thời gian — không bao giờ ngủ một khoảng cố định rồi tin là xong.
 * Nhận: điều kiện cần đạt, và trần chờ (ms).
 * Trả: không trả gì; ném lỗi nêu rõ trần đã hết khi điều kiện chưa đạt.
 */
async function waitFor(condition: () => boolean, ceilingMs = 2_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < ceilingMs) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`waitFor: điều kiện chưa đạt sau trần ${ceilingMs}ms`);
}

/**
 * Dựng một provider của MỘT bản (ta hoặc gốc) trên Context cordis thật.
 * Nhận: lớp provider, lớp Context, cấu hình, và móc `internals` cần bơm.
 * Trả: provider đã sẵn sàng nhận lượt gọi.
 */
function build(providerClass: ProviderClass, Context: new () => MiniContext, config: ConfigShape, internals: Record<string, unknown> = {}): Provider {
  const provider = new providerClass(new Context(), config);
  provider.internals = internals;
  return provider;
}

/**
 * Chạy một lượt `confine` và trả KẾT QUẢ hoặc LỖI dưới dạng chuỗi so được.
 * Nhận: provider, argv, policy, tín hiệu huỷ tuỳ chọn.
 * Trả: chuỗi JSON của kết quả, hoặc `<tên lớp>|<mã>|<thông điệp>` của lỗi.
 */
async function outcome(provider: Provider, argv: readonly string[], policy: Policy, signal?: AbortSignal): Promise<string> {
  try {
    return JSON.stringify(await provider.confine(argv, policy, signal));
  } catch (error) {
    const failure = error as { name?: string; code?: string; message?: string };
    return `${failure.name ?? "?"}|${failure.code ?? "-"}|${failure.message ?? "?"}`;
  }
}

/** Cặp cấu hình cần so của `gbh.peers` và `peerDependencies` (đọc từ manifest thật). */
interface Manifest {
  /** Khối metadata của ta. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật (phải RỖNG — mọi peer do kernel cấp). */
  dependencies?: Record<string, string>;
}

/**
 * Phép kiểm `peers ⊆ peerDependencies` so PHẦN TỬ.
 * Nhận: danh sách peer của ta và tập tên trong `peerDependencies`.
 * Trả: các peer THIẾU trong `peerDependencies` (rỗng nghĩa là đạt).
 */
function missingPeers(peers: readonly string[], peerDependencies: ReadonlySet<string>): string[] {
  return peers.filter((peer) => !peerDependencies.has(peer));
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row sandbox — ARTIFACT và bề mặt", () => {
  test("tập export của ta = tập export của bản gốc, 0 id @deepseek-ai, prototype và schema trùng", async () => {
    const file = await buildPackage(OUT);
    const code = await readFile(file, "utf8");
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as unknown as { default: ProviderClass; LocalSandboxProvider: ProviderClass };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass; LocalSandboxProvider: ProviderClass };
    // 05/11/2026 (P1b): so với bản gốc ĐÚNG provenance (`dsh-sandbox`), không phải `dsh-sandbox-local`.
    const stockFull = (await import(STOCK_FULL)) as Record<string, unknown>;
    expect(Object.keys(artifact).sort()).toEqual([...Object.keys(stockFull).sort(), "LocalSandboxProvider"].sort());
    // 05/11/2026 (P1b): bề mặt đầy đủ nay gồm cả 15 tên bản gốc re-export.
    // 05/11/2026 (P1b): bề mặt = ĐÚNG bộ tên của `dsh-sandbox` + `LocalSandboxProvider` (của bản local,
    // vì gói ta gộp cả hai nguồn gốc).
    expect(Object.keys(artifact).sort()).toEqual([...Object.keys(stockFull).sort(), "LocalSandboxProvider"].sort());
    // Artifact là MỘT bản cài khác nên lớp khác đối tượng; điều phải khớp là HÌNH DẠNG và quan hệ default.
    expect(artifact.default).toBe(artifact.LocalSandboxProvider);
    expect(stock.default).toBe(stock.LocalSandboxProvider);
    expect(stock.default.name).toBe(LocalSandboxProvider.name);
    expect(Object.getOwnPropertyNames(artifact.LocalSandboxProvider.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.LocalSandboxProvider.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(artifact.LocalSandboxProvider).sort()).toEqual(
      Object.getOwnPropertyNames(stock.LocalSandboxProvider).sort(),
    );
    // Schema Config: cùng chuỗi mô tả (Settings/config-editor render từ đây) và cùng giá trị mặc định.
    expect(String(artifact.LocalSandboxProvider.Config)).toBe(String(stock.LocalSandboxProvider.Config));
    expect(artifact.LocalSandboxProvider.Config({})).toEqual(stock.LocalSandboxProvider.Config({}));
    expect(artifact.LocalSandboxProvider.Config({})).toEqual({ runnerCommand: [], runnerFailureSignatures: [], probeTimeoutMs: 5_000 });
  });

  });

describe("row sandbox — manifest: peer so PHẦN TỬ (kèm đối chứng âm)", () => {
  test("gbh.peers ⊆ peerDependencies: 5/5, dependencies RỖNG, và phép kiểm BẮT được manifest thiếu phần tử", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8")) as Manifest;
    const peers = manifest.gbh?.peers ?? [];
    const peerDependencies = new Set(Object.keys(manifest.peerDependencies ?? {}));
    expect(peers).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-sandbox",
      "@deepseek-ai/dsh-sandbox-windows-acl",
      "@deepseek-ai/node-addon-system",
      "@deepseek-ai/schemastery",
    ]);
    expect(missingPeers(peers, peerDependencies)).toEqual([]);
    expect(manifest.dependencies ?? {}).toEqual({});

    // ĐỐI CHỨNG ÂM 1: một peer không có trong peerDependencies phải bị bắt ĐÚNG TÊN.
    expect(missingPeers([...peers, "@deepseek-ai/dsh-not-installed"], peerDependencies)).toEqual(["@deepseek-ai/dsh-not-installed"]);
    // ĐỐI CHỨNG ÂM 2: xoá TỪNG peer khỏi peerDependencies ⇒ peer ấy bị bắt (đo phần tử, không đo số lượng).
    for (const dropped of peers) {
      const mutant = new Set([...peerDependencies].filter((name) => name !== dropped));
      expect(missingPeers(peers, mutant)).toEqual([dropped]);
    }
    // ĐỐI CHỨNG ÂM 3: SỐ LƯỢNG bằng nhau mà PHẦN TỬ khác nhau — phép kiểm so số lượng sẽ cho verdict RỖNG.
    const equalCount = new Set([...peerDependencies].filter((name) => name !== peers[0]));
    equalCount.add("@deepseek-ai/dsh-substitute");
    expect(equalCount.size).toBe(peerDependencies.size);
    expect(missingPeers(peers, equalCount)).toEqual([peers[0] as string]);
  });
});

describe("row sandbox — hành vi đối chứng với CHÍNH bundle gốc", () => {
  test("chọn runner + bọc argv: 8 kịch bản (4 rung × 2 chế độ) trùng TỪNG KÝ TỰ", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass };
    // MA TRẬN: CẢ 4 rung × CẢ 2 chế độ bị cưỡng chế (danger-full-access không bao giờ tới `confine`).
    const runners: [string, string, Record<string, unknown>, string][] = [
      ["bwrap", "bwrap", { platform: "linux", probeBwrap: () => true }, "full"],
      [
        "landlock",
        "/opt/landlock-run",
        { platform: "linux", probeBwrap: () => false, probeLandlock: () => "partial", landlockLauncher: "/opt/landlock-run" },
        "partial",
      ],
      ["seatbelt", "sandbox-exec", { platform: "darwin" }, "full"],
      ["windows-acl", "node", { platform: "win32", windowsAclRunnerArgs: ["node", "runner.js"] }, "partial"],
    ];
    const scenarios: [string, Record<string, unknown>, Policy, string, string][] = [];
    for (const [runner, program, internals, enforcement] of runners) {
      for (const mode of ["read-only", "workspace-write"] as const) {
        scenarios.push([`${runner}/${mode}`, internals, { mode, workspaceRoot: "/tmp" }, program, enforcement]);
      }
    }
    for (const [label, internals, policy, program, enforcement] of scenarios) {
      const ours = build(Ours as unknown as ProviderClass, ourCordis.Context, LocalSandboxProvider.Config({}), internals);
      const theirs = build(stock.default, stockCordis.Context, stock.default.Config({}), internals);
      const mine = await outcome(ours, ["echo", "hi"], policy);
      expect(mine, label).toBe(await outcome(theirs, ["echo", "hi"], policy));
      // Dữ kiện nhìn thấy được, khẳng định thêm để phép so không phải hai chuỗi rỗng nghĩa:
      const wrapped = JSON.parse(mine) as { argv: string[]; enforcement: string; denialSignatures: string[]; runnerFailureRules: unknown[] };
      expect(wrapped.argv[0], label).toBe(program);
      expect(wrapped.argv.includes("--"), label).toBe(true);
      expect(wrapped.denialSignatures.length, label).toBeGreaterThan(0);
      expect(wrapped.runnerFailureRules.length, label).toBeGreaterThan(0);
      // Mức cưỡng chế là DỮ KIỆN: bwrap/Seatbelt `full` theo bảng tĩnh, landlock theo báo cáo dò, windows-acl `partial`.
      expect(wrapped.enforcement, label).toBe(enforcement);
    }
    // Gốc workspace được CANONICAL hoá trước khi vào hồ sơ (darwin: /tmp LÀ /private/tmp).
    const canonical = realpathSync.native("/tmp");
    const ours = build(Ours as unknown as ProviderClass, ourCordis.Context, LocalSandboxProvider.Config({}), { platform: "darwin" });
    const wrapped = JSON.parse(await outcome(ours, ["true"], { mode: "workspace-write", workspaceRoot: "/tmp" })) as { argv: string[] };
    expect(wrapped.argv[0]).toBe("sandbox-exec");
    expect(wrapped.argv.join(" ")).toContain(`(subpath "${canonical}")`);
    const linux = build(Ours as unknown as ProviderClass, ourCordis.Context, LocalSandboxProvider.Config({}), { platform: "linux", probeBwrap: () => true });
    const bwrap = JSON.parse(await outcome(linux, ["true"], { mode: "workspace-write", workspaceRoot: "/tmp" })) as { argv: string[] };
    expect(bwrap.argv.join(" ")).toContain(`--bind ${canonical} ${canonical}`);
  });

  test("đóng cửa + huỷ + runnerCommand: cùng lỗi, cùng mã, cùng thông điệp", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => MiniContext };
    const mk = (internals: Record<string, unknown>, config: ConfigShape = {}) => ({
      ours: build(Ours as unknown as ProviderClass, ourCordis.Context, LocalSandboxProvider.Config(config), internals),
      theirs: build(stock.default, stockCordis.Context, stock.default.Config(config), internals),
    });

    // Nền tảng không có chuỗi ⇒ đóng cửa: KHÔNG bao giờ trả argv nguyên bản.
    const absent = mk({ platform: "freebsd" });
    const ourClosure = await outcome(absent.ours, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" });
    expect(ourClosure).toBe(await outcome(absent.theirs, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" }));
    expect(ourClosure).toContain("SandboxUnavailableError|SANDBOX_UNAVAILABLE|");
    expect(ourClosure).toContain("refusing to run the command unconfined");

    // Chuỗi Linux mà CẢ HAI rung đều hỏng ⇒ cũng đóng cửa.
    const broken = mk({ platform: "linux", probeBwrap: () => false, probeLandlock: () => "unusable", landlockLauncher: "/opt/ll" });
    expect(await outcome(broken.ours, ["echo"], { mode: "workspace-write", workspaceRoot: "/tmp" })).toBe(
      await outcome(broken.theirs, ["echo"], { mode: "workspace-write", workspaceRoot: "/tmp" }),
    );

    // Huỷ TRƯỚC khi giải policy ⇒ AbortError, không spawn gì.
    const aborter = new AbortController();
    aborter.abort();
    const aborted = mk({ platform: "darwin" });
    const ourAbort = await outcome(aborted.ours, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" }, aborter.signal);
    expect(ourAbort).toBe(await outcome(aborted.theirs, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" }, aborter.signal));
    expect(ourAbort.startsWith("AbortError|")).toBe(true);

    // runnerCommand = khẳng định của người vận hành: hồ sơ bwrap + full + dấu hiệu lỗi đã cấu hình.
    const override = mk({}, { runnerCommand: ["myrunner"], runnerFailureSignatures: ["boom: "] });
    const ourOverride = await outcome(override.ours, ["a", "b"], { mode: "workspace-write", workspaceRoot: "/tmp" });
    expect(ourOverride).toBe(await outcome(override.theirs, ["a", "b"], { mode: "workspace-write", workspaceRoot: "/tmp" }));
    expect(JSON.parse(ourOverride)).toMatchObject({ enforcement: "full", runnerFailureRules: [{ fatalSignatures: ["boom: "] }] });

    // Kết luận `unavailable` cũng được NHỚ: đổi nền tảng sau đó vẫn đóng cửa (KHÔNG dò lại) — cả hai bản.
    const stuck = mk({ platform: "freebsd" });
    const firstOur = await outcome(stuck.ours, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" });
    stuck.ours.internals = { platform: "darwin" };
    expect(await outcome(stuck.ours, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" })).toBe(firstOur);
    const firstTheirs = await outcome(stuck.theirs, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" });
    stuck.theirs.internals = { platform: "darwin" };
    expect(await outcome(stuck.theirs, ["echo"], { mode: "read-only", workspaceRoot: "/tmp" })).toBe(firstTheirs);

    // Phép dò chạy ĐÚNG MỘT LẦN cho mỗi rung trong quãng đời provider (hai lượt gọi, bộ đếm không tăng).
    const probeOnce = async (providerClass: ProviderClass, Context: new () => MiniContext): Promise<{ bwrap: number; landlock: number }> => {
      const counters = { bwrap: 0, landlock: 0 };
      const provider = build(providerClass, Context, providerClass.Config({}), {
        platform: "linux",
        probeBwrap: () => {
          counters.bwrap += 1;
          return false;
        },
        probeLandlock: () => {
          counters.landlock += 1;
          return "full";
        },
        landlockLauncher: "/opt/ll",
      });
      await provider.confine(["a"], { mode: "read-only", workspaceRoot: "/tmp" });
      await provider.confine(["a"], { mode: "workspace-write", workspaceRoot: "/tmp" });
      return counters;
    };
    const ourCounts = await probeOnce(Ours as unknown as ProviderClass, ourCordis.Context);
    expect(ourCounts).toEqual({ bwrap: 1, landlock: 1 });
    expect(await probeOnce(stock.default, stockCordis.Context)).toEqual(ourCounts);
  });

  test("cấu hình sai: 5 tổ hợp bị từ chối với THÔNG ĐIỆP y hệt bản gốc", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => MiniContext };
    const cases: ConfigShape[] = [
      { probeTimeoutMs: 0 },
      { runnerCommand: ["x"] },
      { runnerFailureSignatures: ["y"] },
      { runnerCommand: ["x"], runnerFailureSignatures: ["a\nb"] },
      { runnerCommand: ["x"], runnerFailureSignatures: ["   "] },
    ];
    for (const config of cases) {
      const message = (build: () => unknown): string => {
        try {
          build();
          return "(khong nem)";
        } catch (error) {
          return (error as Error).message;
        }
      };
      // Dựng TRỰC TIẾP lớp provider: qua `ctx.plugin` lỗi nằm trong fiber nên không ném ra ngoài.
      const ours = message(() => new (Ours as unknown as ProviderClass)(new ourCordis.Context(), LocalSandboxProvider.Config(config)));
      const theirs = message(() => new stock.default(new stockCordis.Context(), stock.default.Config(config)));
      expect(ours, JSON.stringify(config)).toBe(theirs);
      expect(ours, JSON.stringify(config)).not.toBe("(khong nem)");
      expect(ours.startsWith("sandbox-local: ")).toBe(true);
    }
    // Tầng SCHEMA: giá trị không phải số tự nhiên bị từ chối TRƯỚC constructor, thông điệp y hệt hai bên.
    for (const value of [Number.POSITIVE_INFINITY, Number.NaN, -1, 1.5]) {
      const message = (build: () => unknown): string => {
        try {
          build();
          return "(khong nem)";
        } catch (error) {
          return (error as Error).message;
        }
      };
      const ours = message(() => LocalSandboxProvider.Config({ probeTimeoutMs: value }));
      expect(ours, String(value)).toBe(message(() => stock.default.Config({ probeTimeoutMs: value })));
      expect(ours, String(value)).not.toBe("(khong nem)");
    }
  });
});

describe("row sandbox — C6: vật thể nội bộ phải ĐỘC LẬP giữa các thực thể", () => {
  test("hai provider KHÔNG chia sẻ internals/sổ grant; sửa một bên không lan sang bên kia", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => MiniContext };
    const a = build(Ours as unknown as ProviderClass, ourCordis.Context, LocalSandboxProvider.Config({}));
    const b = build(Ours as unknown as ProviderClass, ourCordis.Context, LocalSandboxProvider.Config({}));
    // DANH TÍNH, không phải so sâu: hai `{}` trông giống nhau nhưng phải là HAI vật.
    expect(a.internals).not.toBe(b.internals);
    a.internals.platform = "linux";
    expect(b.internals.platform).toBeUndefined();
    const ga = a as unknown as GrantView;
    const gb = b as unknown as GrantView;
    expect(ga.workspaceGrants).not.toBe(gb.workspaceGrants);
    expect(ga.tempCapabilities).not.toBe(gb.tempCapabilities);
    ga.workspaceGrants.set("/tmp/ws-a", { dispose: () => {} });
    expect(gb.workspaceGrants.size).toBe(0);

    // Bản gốc có CÙNG hợp đồng danh tính — ta không được "chặt hơn" hay "lỏng hơn".
    const c = build(stock.default, stockCordis.Context, stock.default.Config({}));
    const d = build(stock.default, stockCordis.Context, stock.default.Config({}));
    expect(c.internals).not.toBe(d.internals);
    expect((c as unknown as GrantView).workspaceGrants).not.toBe((d as unknown as GrantView).workspaceGrants);
    // Config({}) trả vật MỚI mỗi lần ở CẢ HAI bên (mảng mặc định không bị chia sẻ).
    const stockConfigA = stock.default.Config({});
    const stockConfigB = stock.default.Config({});
    expect(stockConfigA).not.toBe(stockConfigB);
    expect(stockConfigA.runnerCommand).not.toBe(stockConfigB.runnerCommand);
    const ourConfigA = LocalSandboxProvider.Config({});
    const ourConfigB = LocalSandboxProvider.Config({});
    expect(ourConfigA).not.toBe(ourConfigB);
    expect(ourConfigA.runnerCommand).not.toBe(ourConfigB.runnerCommand);
  });
});

describe("row sandbox — vòng đời grant windows-acl (trạng thái TỰ DỰNG, không đối chiếu Windows thật)", () => {
  test("dispose thu hồi ĐỦ grant, xoá ĐỦ thư mục tạm, và KHÔNG ném khi grant dọn dẹp hỏng", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => MiniContext };

    /** Dựng một provider có sổ grant GIẢ và ghi vết mọi lời gọi dọn dẹp. */
    const prepared = (providerClass: ProviderClass, Context: new () => MiniContext, grantThrows: boolean) => {
      const disposed: string[] = [];
      const removed: string[] = [];
      const provider = new providerClass(new Context(), providerClass.Config({}));
      provider.internals = { rmTempDir: (dir: string) => { removed.push(dir); if (grantThrows) throw new Error("rm hong"); } };
      const view = provider as unknown as GrantView;
      const grant = (label: string) => ({ dispose: () => { disposed.push(label); if (grantThrows) throw new Error("grant hong"); } });
      view.workspaceGrants.set("/ws", grant("workspace:/ws"));
      view.tempCapabilities.set("s1", { dir: "/tmp/dsh-a", writeSid: "S-1-4-1", grant: grant("temp:s1") });
      view.tempCapabilities.set("s2", { dir: "/tmp/dsh-b", writeSid: "S-1-4-2", grant: grant("temp:s2") });
      return { provider, view, disposed, removed };
    };

    const ourRun = prepared(Ours as unknown as ProviderClass, ourCordis.Context, false);
    const theirRun = prepared(stock.default, stockCordis.Context, false);
    ourRun.view.revokeAclGrants();
    theirRun.view.revokeAclGrants();
    expect(ourRun.disposed.sort()).toEqual(theirRun.disposed.sort());
    expect(ourRun.disposed.sort()).toEqual(["temp:s1", "temp:s2", "workspace:/ws"]);
    expect(ourRun.removed.sort()).toEqual(theirRun.removed.sort());
    expect(ourRun.removed.sort()).toEqual(["/tmp/dsh-a", "/tmp/dsh-b"]);
    expect(ourRun.view.workspaceGrants.size).toBe(0);
    expect(ourRun.view.tempCapabilities.size).toBe(0);

    // Nhánh HỎNG: cả grant lẫn bước xoá đều ném ⇒ vẫn không ném ra ngoài, vẫn dọn sạch sổ (teardown cordis).
    const ourBroken = prepared(Ours as unknown as ProviderClass, ourCordis.Context, true);
    const theirBroken = prepared(stock.default, stockCordis.Context, true);
    expect(() => ourBroken.view.revokeAclGrants()).not.toThrow();
    expect(() => theirBroken.view.revokeAclGrants()).not.toThrow();
    expect(ourBroken.view.workspaceGrants.size).toBe(theirBroken.view.workspaceGrants.size);
    expect(ourBroken.view.tempCapabilities.size).toBe(theirBroken.view.tempCapabilities.size);
    expect(ourBroken.disposed.length).toBe(theirBroken.disposed.length);
  });
});

describe("row sandbox — mount như một Service (chờ CÓ TRẦN, không ngủ cố định)", () => {
  test("ctx.plugin cấp ctx.sandbox ở trạng thái ACTIVE và confine() chạy được trên CẢ HAI bản", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: new () => MiniContext };
    const stock = (await import(STOCK)) as unknown as { default: ProviderClass };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: new () => MiniContext };
    const mounted = async (providerClass: ProviderClass, Context: new () => MiniContext): Promise<Provider> => {
      const ctx = new Context();
      ctx.plugin(providerClass, {});
      await waitFor(() => ctx.get("sandbox") !== undefined && (ctx.get("sandbox") as Provider).ctx.fiber.state === 2);
      return ctx.get("sandbox") as Provider;
    };
    const ours = await mounted(Ours as unknown as ProviderClass, ourCordis.Context);
    const theirs = await mounted(stock.default, stockCordis.Context);
    expect(typeof ours.confine).toBe("function");
    expect(typeof theirs.confine).toBe("function");
    const policy: Policy = { mode: "read-only", workspaceRoot: "/tmp" };
    expect(await outcome(ours, ["echo"], policy)).toBe(await outcome(theirs, ["echo"], policy));
  });
});
