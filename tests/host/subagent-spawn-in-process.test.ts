/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-subagent-spawn-in-process: tập export đo trên ARTIFACT, đối chứng
 *      TRỰC TIẾP với chính bundle gốc (name · inject · Config · hình dạng provider · prepareContinuable),
 *      và quy ước khai peer gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/subagent-spawn-in-process/build.ts";
import { Config, apply, inject, name } from "../../packages/host/subagent-spawn-in-process/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-subagent-spawn-in-process/lib/index.js");

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: (value: unknown) => unknown;
  apply: (ctx: unknown, config: { providerName: string }) => void;
};

/** Một provider đã được đăng ký vào sổ giả — hình dạng mà seam `ctx.subagents` nhận. */
interface RegisteredProvider {
  /** Tên đăng ký. */
  name: string;
  /** Bốn năng lực start-time. */
  capabilities: Record<string, boolean>;
  /** Có thừa hưởng ngữ cảnh của cha không. */
  inheritsParentContext: boolean;
  /** `start` (đường ngoài tiến trình) — bản gốc KHÔNG khai. */
  start?: unknown;
  /** Đường kích hoạt CỤC BỘ: sự hiện diện của phương thức này là năng lực continuable. */
  prepareContinuable(request?: unknown): Promise<Record<string, unknown>>;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam: sổ provider + sổ hiệu ứng. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: never;
  /** Mọi provider đã đăng ký, theo thứ tự. */
  providers: RegisteredProvider[];
  /** Số lượt `apply` gọi `ctx.effect` (bản gốc KHÔNG gọi — seam tự bind vòng đời trong `registerProvider`). */
  effects: () => number;
  /** `ctx` trần để gọi `apply` mà KHÔNG có seam `subagents` (đo đường lỗi). */
  bare: never;
}

/**
 * Dựng giàn giả dùng chung được cho CẢ bản của ta lẫn bản gốc.
 * Nhận: không.
 * Trả: giàn với sổ provider + bộ đếm hiệu ứng + một context KHÔNG có seam.
 */
function harness(): Harness {
  const providers: RegisteredProvider[] = [];
  let effectCalls = 0;
  const ctx = {
    subagents: {
      registerProvider(provider: RegisteredProvider): () => void {
        providers.push(provider);
        return () => undefined;
      },
    },
    effect(): () => void {
      effectCalls += 1;
      return () => undefined;
    },
  };
  return {
    ctx: ctx as never,
    providers,
    effects: () => effectCalls,
    bare: { logger: { error: () => undefined } } as never,
  };
}

/** Hình dạng QUAN SÁT ĐƯỢC của một provider — dùng để so hai bản cài với nhau. */
interface ProviderShape {
  /** Tên đăng ký. */
  name: string;
  /** Bảng năng lực start-time. */
  capabilities: Record<string, boolean>;
  /** Khoá OWN của thực thể, theo ĐÚNG thứ tự. */
  keys: string[];
  /** Có `start` không (`"undefined"` = không). */
  start: string;
  /** Có `prepareContinuable` không. */
  prepare: string;
  /** Tên phương thức trên prototype, theo thứ tự khai. */
  prototype: string[];
}

/**
 * Rút hình dạng quan sát được của một provider.
 * Nhận: provider đã đăng ký.
 * Trả: hình dạng để so bằng `toEqual`.
 */
function shapeOf(provider: RegisteredProvider): ProviderShape {
  return {
    name: provider.name,
    capabilities: provider.capabilities,
    keys: Object.keys(provider),
    start: typeof provider.start,
    prepare: typeof provider.prepareContinuable,
    prototype: Object.getOwnPropertyNames(Object.getPrototypeOf(provider)),
  };
}

/**
 * Mặt CHUẨN HOÁ của một schema schemastery khi gọi như hàm: `schema(value)` trả giá trị đã kiểm
 * (và ném khi sai). Kiểu công khai `z<Config>` của schemastery chỉ mô tả ĐẦU RA, nên phải ép ở ranh giới.
 */
type Validator = (value: unknown) => Record<string, unknown>;

/**
 * Ép một schema về mặt gọi-được để đo chuẩn hoá cấu hình.
 * Nhận: schema schemastery (của ta hoặc của bản gốc).
 * Trả: hàm nhận giá trị thô và trả giá trị đã chuẩn hoá.
 */
function validate(schema: unknown): Validator {
  return schema as Validator;
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
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-spawn-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["Config", "apply", "inject", "name"]);
    expect(exportNames(oursText)).not.toContain("default");
    // Row host thuần: KHÔNG có __ModuleLoader__ nào ⇒ đếm id stock trong artifact phải là 0.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
  });

  test("name · inject · Config khớp bản gốc từng chữ", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("subagent-spawn-in-process");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["subagents"]);
    // Schema cấu hình: cùng MỘT chuỗi kiểu như bản gốc (cùng schemastery, cùng trường + default).
    expect(typeof Config).toBe("function");
    expect(String(Config)).toBe(String(stock.Config));
    expect(String(Config)).toBe("{ providerName?: string }");
  });
});

describe("hành vi: apply đăng ký provider, đối chứng với bản gốc trên CÙNG giàn giả", () => {
  test("mỗi lượt apply đăng ký ĐÚNG MỘT provider; hình dạng của ta BẰNG bản gốc", () => {
    const ours = harness();
    apply(ours.ctx, { providerName: "spawn" });
    const theirs = harness();
    stock.apply(theirs.ctx, { providerName: "spawn" });

    expect(ours.providers.length).toBe(1);
    expect(theirs.providers.length).toBe(1);
    expect(shapeOf(ours.providers[0]!)).toEqual(shapeOf(theirs.providers[0]!));
    // Khẳng định THÊM giá trị tuyệt đối: đủ bốn năng lực, KHÔNG thừa hưởng ngữ cảnh, KHÔNG có `start`.
    expect(shapeOf(ours.providers[0]!)).toEqual({
      name: "spawn",
      capabilities: { agentOptions: true, agentPreset: true, outputSchema: true, depthLimit: true },
      keys: ["name", "capabilities", "inheritsParentContext"],
      start: "undefined",
      prepare: "function",
      prototype: ["constructor", "prepareContinuable"],
    });
    expect(ours.providers[0]!.inheritsParentContext).toBe(false);
  });

  test("mỗi thực thể provider có capabilities RIÊNG (không chia sẻ hằng số) — y bản gốc", () => {
    const build = (applyFn: typeof apply): RegisteredProvider[] => {
      const h = harness();
      applyFn(h.ctx, { providerName: "a" });
      applyFn(h.ctx, { providerName: "b" });
      return h.providers;
    };
    const ours = build(apply);
    const theirs = build(stock.apply as unknown as typeof apply);
    expect(ours.length).toBe(2);
    expect(theirs.length).toBe(2);
    // Phép so SÂU một mình sẽ ĐẠT cả khi ta chia sẻ một hằng dùng chung ⇒ phải so DANH TÍNH.
    expect(ours[0]!.capabilities).not.toBe(ours[1]!.capabilities);
    expect(theirs[0]!.capabilities).not.toBe(theirs[1]!.capabilities);
    // Và sửa một thực thể KHÔNG được lan sang thực thể kia (hành vi của bản gốc).
    ours[0]!.capabilities.depthLimit = false;
    expect(ours[1]!.capabilities.depthLimit).toBe(true);
    expect(theirs[1]!.capabilities.depthLimit).toBe(true);
  });

  test("apply KHÔNG tự bind vòng đời (0 lượt ctx.effect) — seam tự làm trong registerProvider", () => {
    const ours = harness();
    apply(ours.ctx, { providerName: "spawn" });
    const theirs = harness();
    stock.apply(theirs.ctx, { providerName: "spawn" });
    expect(ours.effects()).toBe(0);
    expect(theirs.effects()).toBe(0);
  });

  test("prepareContinuable: SPAWN trả RỖNG (KHÔNG có seed) ⇒ con bắt đầu từ log rỗng", async () => {
    const ours = harness();
    apply(ours.ctx, { providerName: "spawn" });
    const theirs = harness();
    stock.apply(theirs.ctx, { providerName: "spawn" });

    const spec = await ours.providers[0]!.prepareContinuable({ parent: { session: { snapshotEvents: () => [] } } });
    expect(spec).toEqual(await theirs.providers[0]!.prepareContinuable({ parent: {} }));
    expect(spec).toEqual({});
    // Điểm KHÁC với provider `fork`: vắng `seed` là điều kiện của "con tươi", không phải một giá trị rỗng.
    expect(Object.hasOwn(spec, "seed")).toBe(false);
  });

  test("provider qua được TIỀN KIỂM của seam (có prepareContinuable ⇒ đường kích hoạt CỤC BỘ)", () => {
    const ours = harness();
    apply(ours.ctx, { providerName: "spawn" });
    const theirs = harness();
    stock.apply(theirs.ctx, { providerName: "spawn" });
    // Tiền kiểm của seam THẬT (đo trong `dsh-subagent/lib/index.js`): thiếu CẢ HAI thì ném
    // `UNSUPPORTED_CAPABILITY`, nên đây là điều kiện sống-còn của một backend.
    const seam = readFileSync(join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-subagent/lib/index.js"), "utf8");
    expect(seam).toContain("must implement start or prepareContinuable");
    const rejected = (provider: RegisteredProvider): boolean => provider.start === undefined && provider.prepareContinuable === undefined;
    expect(rejected(ours.providers[0]!)).toBe(false);
    expect(rejected(theirs.providers[0]!)).toBe(false);
  });

  test("cấu hình: mặc định spawn · tên tuỳ biến · số bị TỪ CHỐI · khoá lạ đi qua — y bản gốc", () => {
    // apply KHÔNG tự điền mặc định — mặc định thuộc SCHEMA (tầng nạp điền trước khi gọi apply).
    // Truyền thẳng `undefined` cho cả hai bên để chứng minh điều đó.
    const ours = harness();
    apply(ours.ctx, { providerName: undefined as never });
    const bare = harness();
    stock.apply(bare.ctx, { providerName: undefined as never });
    expect(ours.providers[0]!.name).toBeUndefined();
    expect(ours.providers[0]!.name).toBe(bare.providers[0]!.name);

    for (const providerName of ["spawn", "abc"]) {
      const mine = harness();
      apply(mine.ctx, { providerName });
      const theirs = harness();
      stock.apply(theirs.ctx, { providerName });
      expect(mine.providers[0]!.name).toBe(providerName);
      expect(mine.providers[0]!.name).toBe(theirs.providers[0]!.name);
    }

    // Chuẩn hoá của schema — cùng giá trị, cùng thông điệp lỗi từng chữ.
    const ours2 = validate(Config);
    const theirs2 = validate(stock.Config);
    expect(ours2({})).toEqual(theirs2({}));
    expect(ours2({})).toEqual({ providerName: "spawn" });
    expect(ours2({ providerName: "custom" })).toEqual({ providerName: "custom" });
    expect(ours2({ providerName: "custom", extra: 1 })).toEqual(theirs2({ providerName: "custom", extra: 1 }));
    expect(() => ours2({ providerName: 5 })).toThrow("$.providerName expected string but got 5");
    expect(() => theirs2({ providerName: 5 })).toThrow("$.providerName expected string but got 5");
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(REPO, "packages/host/subagent-spawn-in-process/package.json");

/** Peer NGOÀI hai tên mà `mount.ts` luôn tự thêm (cordis, schemastery) — danh sách ĐÓNG của riêng gói này. */
const SEAM_PEERS = ["@deepseek-ai/dsh-subagent"];

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
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import` — `tests/` không resolve được `@deepseek-ai/*`).
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
    // Phiên bản: peer phải trỏ ĐÚNG bản kernel đang chạy — HOẶC ghim CHÍNH XÁC như manifest stock
    // (0.2.1-alpha.4), HOẶC dải `~` cùng version; cả hai đều KHÔNG cho bun nhảy sang bản khác dòng.
    for (const peer of peers) {
      const kernel = JSON.parse(readFileSync(join(REPO, "apps/host/node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      expect([kernel.version, "~" + kernel.version]).toContain(String(manifest.peerDependencies?.[peer] ?? ""));
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
  });

  });
