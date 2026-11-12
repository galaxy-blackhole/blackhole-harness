/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-subagent-model-selection-settings: tập export đo trên ARTIFACT,
 *      đối chứng TRỰC TIẾP với chính bundle gốc trên Context cordis THẬT (current · tham chiếu sống ·
 *      ma trận lỗi), ca C6 danh tính vật thể cấu hình, quy ước gbh.peers ⊆ peerDependencies kèm ĐỐI
 *      CHỨNG ÂM, test canh "chưa khai gbh.row", và 000e locale chép byte-for-byte.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/subagent-model-selection-settings/build.ts";
import SubagentModelSelectionConfig from "../../packages/host/subagent-model-selection-settings/src/index.ts";

import { peerRangeProblems } from "./peer-range-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "subagent-model-selection-settings");
/** Bundle GỐC của đúng subpath này (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-subagent", "lib", "model-selection-settings.js");
/** Thư mục package gốc — nơi lấy từ điển của row. */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-subagent");
/** cordis của kernel — đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Khoá ghi của tham chiếu `Volatile` (cosmokit) — cách Settings sửa giá trị SỐNG tại chỗ. */
const VOLATILE_WRITE = Symbol.for("cosmokit.volatile.write");

/** Một tuyến provider/model ở dạng THUẦN dữ liệu. */
interface Route {
  /** Id provider. */
  provider: string;
  /** Id model. */
  model: string;
}

/** Bản chụp lựa chọn mà `current()` trả về. */
interface Snapshot {
  /** Có bật hay không. */
  enabled: boolean;
  /** Danh sách tuyến được phép. */
  allowedModels: Route[];
}

/** Thực thể dịch vụ quan sát được — đúng hai thứ bản gốc phơi ra (tên + một phương thức). */
interface ServiceLike {
  /** Đọc lựa chọn cho lượt soạn Session kế tiếp. */
  current(): Snapshot;
  /** Tên dịch vụ do cordis cấp. */
  name: string;
}

/** Lớp plugin của MỘT bên cài (ta hoặc gốc). */
interface PluginClass {
  /** Dựng dịch vụ trên một Context; cấu hình đã qua schema. */
  new (ctx: unknown, config: unknown): ServiceLike;
  /** Schema schemastery, đồng thời là hàm chuẩn hoá cấu hình. */
  Config: (value: unknown) => unknown;
}

/** Context cordis tối thiểu mà phép đo chạm tới (`get` một dịch vụ đã cấp). */
interface HarnessContext {
  /** Tra một dịch vụ đã cấp. */
  get(name: string): unknown;
}

/** Cấu hình đã chuẩn hoá: hai THAM CHIẾU SỐNG (đọc bằng `get`, ghi bằng ký hiệu cosmokit). */
interface LiveConfig {
  /** Tham chiếu trạng thái bật. */
  enabled: unknown;
  /** Tham chiếu danh sách tuyến. */
  allowedModels: unknown;
}

/** Bản gốc nạp động: cùng export `default` (chính lớp `SubagentModelSelectionConfig`). */
const stock = ((await import(STOCK)) as unknown as { default: PluginClass }).default;
/** `Context` của cordis kernel — MỘT lớp cho cả hai bên cài (cùng một tệp thật). */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => HarnessContext };

/** Dấu vết của một lần dựng giàn. */
interface Booted {
  /** Context đã cấp dịch vụ. */
  ctx: HarnessContext;
  /** Thực thể dịch vụ. */
  service: ServiceLike;
  /** Cấu hình thô đã chuẩn hoá — giữ để các ca "tham chiếu sống" sửa tại chỗ. */
  config: LiveConfig;
}

/**
 * Dựng MỘT bên cài trên Context cordis thật.
 * Nhận: lớp plugin và cấu hình thô (như mục profile).
 * Trả: context, thực thể dịch vụ và cấu hình đã chuẩn hoá.
 */
async function boot(plugin: PluginClass, raw: Record<string, unknown>): Promise<Booted> {
  const ctx = new Context();
  const config = plugin.Config(raw) as LiveConfig;
  const service = new plugin(ctx, config);
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { ctx, service, config };
}

/**
 * Ghi một giá trị mới vào tham chiếu `Volatile` tại chỗ (đúng đường Settings dùng).
 * Nhận: tham chiếu cần ghi và giá trị mới.
 * Trả: không.
 */
function writeLive(ref: unknown, value: unknown): void {
  const holder = ref as Record<symbol, ((next: unknown) => void) | undefined>;
  const write = holder[VOLATILE_WRITE];
  if (write === undefined) throw new Error("tham chiếu Config không phải Volatile");
  write(value);
}

/**
 * Lấy thông điệp của lần gọi ĐẦU TIÊN, hoặc nhãn "KHONG NEM" khi không ném.
 * Nhận: một lượt gọi có thể ném.
 * Trả: thông điệp lỗi (hoặc nhãn khi không ném) để so hai bên.
 */
function messageOf(run: () => unknown): string {
  try {
    run();
    return "KHONG NEM";
  } catch (error) {
    return (error as Error).message;
  }
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
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-mss-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["SubagentModelSelectionConfig", "default", "name"]);
    // Row host thuần: KHÔNG có `__ModuleLoader__` nào, và 0 lần đăng ký id stock trong artifact.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Cùng ba module ngoài mà gốc nạp; hai hàm phụ (`modelRouteKey`, `assertAllowedModelRoutes`) là NỘI BỘ.
    for (const specifier of ["@deepseek-ai/cordis", "@deepseek-ai/schemastery", "@deepseek-ai/dsh-llm"]) {
      expect(oursText).toContain('"' + specifier + '"');
    }
    expect(exportNames(stockText)).not.toContain("assertAllowedModelRoutes");
    expect(exportNames(oursText)).not.toContain("assertAllowedModelRoutes");
    // Sáu luật: build.ts phải nhận thư mục đích qua argv[2] (thiếu ⇒ profile không có lib/).
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("\"subagentModelSelection\" là TÊN DỊCH VỤ của cả hai bản; prototype y hệt", async () => {
    const raw = { enabled: true, allowedModels: [{ provider: "auto", model: "deepseek-v4.1-flash" }] };
    const ours = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    for (const booted of [ours, theirs]) {
      const service = booted.ctx.get("subagentModelSelection") as ServiceLike;
      expect(service).toBeDefined();
      expect(service.name).toBe("subagentModelSelection");
      expect(service.current()).toEqual({ enabled: true, allowedModels: [{ provider: "auto", model: "deepseek-v4.1-flash" }] });
    }
    const prototype = (plugin: PluginClass): string[] => Object.getOwnPropertyNames((plugin as unknown as { prototype: object }).prototype);
    expect(prototype(SubagentModelSelectionConfig as unknown as PluginClass)).toEqual(prototype(stock));
  });

  test("String(Config) trùng từng chữ; schema TỪ CHỐI tuyến sai — cùng thông điệp", () => {
    const ours = SubagentModelSelectionConfig.Config;
    const theirs = stock.Config;
    expect(String(ours)).toBe(String(theirs));
    expect(String(ours)).toBe("{ enabled?: boolean, allowedModels?: { provider: string, model: string }[] }");
    for (const bad of [
      { allowedModels: "x" },
      { allowedModels: [{}] },
      { allowedModels: [{ provider: "", model: "m" }] },
      { allowedModels: [{ provider: "p", model: "" }] },
    ]) {
      const mine = messageOf(() => (ours as (value: unknown) => unknown)(bad));
      expect(mine).toBe(messageOf(() => (theirs as (value: unknown) => unknown)(bad)));
      expect(mine).not.toBe("KHONG NEM");
    }
  });
});

describe("hành vi ĐỌC: current() đối chứng với bản gốc trên cùng giàn", () => {
  test("mặc định ⇒ TẮT và danh sách RỖNG; bật + một tuyến ⇒ trả đúng tuyến — y bản gốc", async () => {
    for (const raw of [{}, { enabled: true, allowedModels: [{ provider: "auto", model: "m" }] }]) {
      const ours = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw as Record<string, unknown>);
      const theirs = await boot(stock, raw as Record<string, unknown>);
      expect(ours.service.current()).toEqual(theirs.service.current());
    }
    expect((await boot(SubagentModelSelectionConfig as unknown as PluginClass, {})).service.current()).toEqual({
      enabled: false,
      allowedModels: [],
    });
  });

  test("ĐỌC LẠI tham chiếu SỐNG: sửa tại chỗ (như Settings) thì lượt đọc sau thấy NGAY — y bản gốc", async () => {
    const raw = { enabled: false, allowedModels: [{ provider: "p", model: "m" }] };
    const ours = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    for (const booted of [ours, theirs]) {
      writeLive(booted.config.enabled, true);
      writeLive(booted.config.allowedModels, [{ provider: "next-provider", model: "next-model" }]);
    }
    expect(ours.service.current().enabled).toBe(true);
    expect(ours.service.current()).toEqual(theirs.service.current());
    expect(ours.service.current()).toEqual({ enabled: true, allowedModels: [{ provider: "next-provider", model: "next-model" }] });
  });

  test("bản chụp TÁCH RỜI: sửa nó KHÔNG chạm cấu hình của dịch vụ — y bản gốc", async () => {
    const raw = { enabled: true, allowedModels: [{ provider: "p", model: "m" }] };
    const ours = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    const first = ours.service.current();
    first.enabled = false;
    first.allowedModels[0] = { provider: "HIJACK", model: "HIJACK" };
    first.allowedModels.push({ provider: "HIJACK", model: "HIJACK" });
    expect(ours.service.current()).toEqual({ enabled: true, allowedModels: [{ provider: "p", model: "m" }] });
    expect(ours.service.current()).toEqual(theirs.service.current());
  });
});

describe("đường lỗi: ma trận thông điệp so TRỰC TIẾP với bản gốc", () => {
  test("tuyến TRÙNG và bật-mà-RỖNG ⇒ ném, thông điệp y nhau từng chữ; không treo", async () => {
    const duplicate = { allowedModels: [{ provider: "p", model: "m" }, { provider: "p", model: "m" }] };
    const oursDup = await boot(SubagentModelSelectionConfig as unknown as PluginClass, duplicate);
    const theirsDup = await boot(stock, duplicate);
    expect(messageOf(() => oursDup.service.current())).toBe(messageOf(() => theirsDup.service.current()));
    expect(messageOf(() => oursDup.service.current())).toBe('subagent model selection repeats route "p/m"');

    const empty = { enabled: true };
    const oursEmpty = await boot(SubagentModelSelectionConfig as unknown as PluginClass, empty);
    const theirsEmpty = await boot(stock, empty);
    expect(messageOf(() => oursEmpty.service.current())).toBe(messageOf(() => theirsEmpty.service.current()));
    expect(messageOf(() => oursEmpty.service.current())).toBe("enabled subagent model selection requires at least one allowed model");
  });

  test("giá trị SAI ghi thẳng vào tham chiếu sống ⇒ cùng ba thông điệp của bản gốc", async () => {
    const raw = { allowedModels: [{ provider: "p", model: "m" }] };
    const ours = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    for (const bad of ["not-an-array", [null], [{}], [{ provider: "p", model: "m" }, { provider: "p", model: "m" }], [[1, 2]]]) {
      for (const booted of [ours, theirs]) writeLive(booted.config.allowedModels, bad);
      const mine = messageOf(() => ours.service.current());
      expect(mine).toBe(messageOf(() => theirs.service.current()));
      expect(mine).not.toBe("KHONG NEM");
    }
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("mỗi lượt đọc trả vật thể + mảng + tuyến MỚI; sửa bản trước KHÔNG lan sang bản sau — y bản gốc", async () => {
    const raw = { enabled: true, allowedModels: [{ provider: "p", model: "m" }] };
    const ours = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    const theirs = await boot(stock, raw);
    const first = ours.service.current();
    const second = ours.service.current();
    // Phép so SÂU một mình sẽ ĐẠT cả khi dùng chung một hằng ⇒ phải so DANH TÍNH.
    expect(first).not.toBe(second);
    expect(first.allowedModels).not.toBe(second.allowedModels);
    expect(first.allowedModels[0]).not.toBe(second.allowedModels[0]);
    first.allowedModels[0]!.provider = "MUTATED";
    expect(second.allowedModels[0]!.provider).toBe("p");
    // Bản gốc cũng phải cùng hành vi: hai vật thể khác nhau.
    expect(theirs.service.current()).not.toBe(theirs.service.current());
  });

  test("hai THỰC THỂ dịch vụ ĐỘC LẬP: sửa cấu hình bên này KHÔNG lan sang bên kia — y bản gốc", async () => {
    const raw = { enabled: true, allowedModels: [{ provider: "p", model: "m" }] };
    const first = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    const second = await boot(SubagentModelSelectionConfig as unknown as PluginClass, raw);
    expect(first.service).not.toBe(second.service);
    writeLive(first.config.allowedModels, [{ provider: "only-first", model: "m" }]);
    writeLive(first.config.enabled, false);
    expect(first.service.current()).toEqual({ enabled: false, allowedModels: [{ provider: "only-first", model: "m" }] });
    expect(second.service.current()).toEqual({ enabled: true, allowedModels: [{ provider: "p", model: "m" }] });
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
  /** Metadata của ta để `bh host` sinh khối patch (chưa khai `row` ở lượt này). */
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
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel; hai peer chuẩn cũng phải khai", () => {
    const manifest = readManifest();
    const declared = Object.keys(manifest.peerDependencies ?? {});
    for (const peer of [...(manifest.gbh?.peers ?? []), "@deepseek-ai/cordis", "@deepseek-ai/schemastery"]) {
      expect(declared).toContain(peer);
      expect(existsSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"))).toBe(true);
    }
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
    // Và peer KHÔNG được khai trong dependencies (tránh thể hiện thứ hai).
    expect((manifest.gbh?.peers ?? []).filter((peer) => new Set(Object.keys(manifest.dependencies ?? {})).has(peer))).toEqual([]);
    expect(manifest.dependencies).toBeUndefined();
  });

  });

describe("000e — gói gốc CÓ locale ⇒ ta ship lại byte-for-byte", () => {
  test("locale/{en,zh}.json khớp TỪNG BYTE với từ điển của row gốc và có trong exports", () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.exports ?? {})).toContain("./locale/*.json");
    for (const language of ["en", "zh"]) {
      const ours = readFileSync(join(PKG, "locale", language + ".json"));
      const theirs = readFileSync(join(STOCK_PKG, "locale", "model-selection-settings", language + ".json"));
      expect(ours.equals(theirs)).toBe(true);
    }
  });
});
