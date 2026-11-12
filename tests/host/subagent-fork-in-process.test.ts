/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-subagent-fork-in-process: tập export đo trên ARTIFACT, đối chứng
 *      TRỰC TIẾP với chính bundle gốc (name · inject · Config · hình dạng provider · phép cắt TIỀN TỐ
 *      LƯỢT ĐÃ XONG của log cha), và quy ước khai peer gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/subagent-fork-in-process/build.ts";
import { Config, apply, inject, name } from "../../packages/host/subagent-fork-in-process/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của mọi ca hành vi. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-subagent-fork-in-process/lib/index.js");

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: (value: unknown) => unknown;
  apply: (ctx: unknown, config: { providerName: string }) => void;
};

/** Một sự kiện log giả — CHỈ hai trường mà provider thật đọc (`type`, `seq`), hẹp hơn sự kiện thật. */
interface FakeEvent {
  /** Loại sự kiện; chỉ `"turn/end"` mở biên lượt. */
  type: string;
  /** Số thứ tự sống — bản gốc giả định nó BẰNG chỉ số mảng. */
  seq: number;
}

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
}

/**
 * Dựng giàn giả dùng chung được cho CẢ bản của ta lẫn bản gốc.
 * Nhận: không.
 * Trả: giàn với sổ provider + bộ đếm hiệu ứng.
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
  return { ctx: ctx as never, providers, effects: () => effectCalls };
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
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-fork-")));
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
    expect(name).toBe("subagent-fork-in-process");
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
    apply(ours.ctx, { providerName: "fork" });
    const theirs = harness();
    stock.apply(theirs.ctx, { providerName: "fork" });

    expect(ours.providers.length).toBe(1);
    expect(theirs.providers.length).toBe(1);
    expect(shapeOf(ours.providers[0]!)).toEqual(shapeOf(theirs.providers[0]!));
    // Khẳng định THÊM giá trị tuyệt đối: `agentPreset` FALSE (khác spawn), CÓ thừa hưởng ngữ cảnh, KHÔNG `start`.
    expect(shapeOf(ours.providers[0]!)).toEqual({
      name: "fork",
      capabilities: { agentOptions: true, agentPreset: false, outputSchema: true, depthLimit: true },
      keys: ["name", "capabilities", "inheritsParentContext"],
      start: "undefined",
      prepare: "function",
      prototype: ["constructor", "prepareContinuable"],
    });
    expect(ours.providers[0]!.inheritsParentContext).toBe(true);
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
    apply(ours.ctx, { providerName: "fork" });
    const theirs = harness();
    stock.apply(theirs.ctx, { providerName: "fork" });
    expect(ours.effects()).toBe(0);
    expect(theirs.effects()).toBe(0);
  });

  test("cấu hình: mặc định fork · tên tuỳ biến · số bị TỪ CHỐI · khoá lạ đi qua — y bản gốc", () => {
    // apply KHÔNG tự điền mặc định — mặc định thuộc SCHEMA (tầng nạp điền trước khi gọi apply).
    const ours = harness();
    apply(ours.ctx, { providerName: undefined as never });
    const bare = harness();
    stock.apply(bare.ctx, { providerName: undefined as never });
    expect(ours.providers[0]!.name).toBeUndefined();
    expect(ours.providers[0]!.name).toBe(bare.providers[0]!.name);

    for (const providerName of ["fork", "abc"]) {
      const mine = harness();
      apply(mine.ctx, { providerName });
      const theirs = harness();
      stock.apply(theirs.ctx, { providerName });
      expect(mine.providers[0]!.name).toBe(providerName);
      expect(mine.providers[0]!.name).toBe(theirs.providers[0]!.name);
    }

    const ours2 = validate(Config);
    const theirs2 = validate(stock.Config);
    expect(ours2({})).toEqual(theirs2({}));
    expect(ours2({})).toEqual({ providerName: "fork" });
    expect(ours2({ providerName: "custom" })).toEqual({ providerName: "custom" });
    expect(ours2({ providerName: "custom", extra: 1 })).toEqual(theirs2({ providerName: "custom", extra: 1 }));
    expect(() => ours2({ providerName: 5 })).toThrow("$.providerName expected string but got 5");
    expect(() => theirs2({ providerName: 5 })).toThrow("$.providerName expected string but got 5");
  });
});

/** Một log giả + bộ đếm số lượt provider đọc nó — để chứng minh phép cắt chỉ đọc MỘT lần. */
interface LogSource {
  /** Đối tượng `parent` đưa cho provider. */
  parent: unknown;
  /** Số lượt `snapshotEvents` bị gọi. */
  reads: () => number;
}

/**
 * Dựng nguồn log giả từ danh sách sự kiện (chỉ `type` + `seq`, đúng phần provider thật đọc).
 * Nhận: các sự kiện theo thứ tự.
 * Trả: nguồn log kèm bộ đếm lượt đọc.
 */
function logSource(events: FakeEvent[]): LogSource {
  let reads = 0;
  return {
    parent: {
      session: {
        snapshotEvents(): readonly FakeEvent[] {
          reads += 1;
          return events;
        },
      },
    },
    reads: () => reads,
  };
}

describe("prepareContinuable: TIỀN TỐ LƯỢT ĐÃ XONG của log cha — đối chứng từng ca với bản gốc", () => {
  /**
   * Chạy MỘT ca trên CẢ HAI bản cài rồi trả spec của hai bên để so.
   * Nhận: danh sách sự kiện của log cha.
   * Trả: cặp `{ ours, theirs }` (spec) + số lượt đọc log của mỗi bên.
   */
  async function runBoth(events: FakeEvent[]): Promise<{
    ours: Record<string, unknown>;
    theirs: Record<string, unknown>;
    oursReads: number;
    theirsReads: number;
  }> {
    const mine = harness();
    apply(mine.ctx, { providerName: "fork" });
    const their = harness();
    stock.apply(their.ctx, { providerName: "fork" });
    const mineLog = logSource(events);
    const theirLog = logSource(events);
    const ours = await mine.providers[0]!.prepareContinuable({ parent: mineLog.parent });
    const theirs = await their.providers[0]!.prepareContinuable({ parent: theirLog.parent });
    return { ours, theirs, oursReads: mineLog.reads(), theirsReads: theirLog.reads() };
  }

  test("chưa có lượt nào hoàn tất ⇒ KHÔNG có khoá seed (con bắt đầu tươi) — y bản gốc", async () => {
    const empty = await runBoth([]);
    expect(empty.ours).toEqual(empty.theirs);
    expect(empty.ours).toEqual({});
    expect(Object.hasOwn(empty.ours, "seed")).toBe(false);
    // Có lượt đang chạy nhưng CHƯA có `turn/end` ⇒ vẫn tươi (lượt chưa cân bằng không phát lại được).
    const inFlight = await runBoth([
      { type: "turn/start", seq: 0 },
      { type: "user/message", seq: 1 },
      { type: "assistant/tool-call", seq: 2 },
    ]);
    expect(inFlight.ours).toEqual(inFlight.theirs);
    expect(inFlight.ours).toEqual({});
    expect(Object.hasOwn(inFlight.ours, "seed")).toBe(false);
  });

  test("một lượt đã xong: seed DỪNG ĐÚNG tại turn/end cuối, loại lượt đang chạy — y bản gốc", async () => {
    const events: FakeEvent[] = [
      { type: "turn/start", seq: 0 },
      { type: "user/message", seq: 1 },
      { type: "assistant/message", seq: 2 },
      { type: "turn/end", seq: 3 },
      { type: "turn/start", seq: 4 },
      { type: "user/message", seq: 5 },
      { type: "assistant/tool-call", seq: 6 },
    ];
    const result = await runBoth(events);
    expect(result.ours).toEqual(result.theirs);
    const seed = result.ours.seed as FakeEvent[];
    expect(seed.map((event) => event.seq)).toEqual([0, 1, 2, 3]);
    expect(Object.hasOwn(result.ours, "seed")).toBe(true);
    // Phần tử là CHÍNH các đối tượng của log (không sao chép sâu) — bản gốc dùng `slice`.
    expect(seed[0]).toBe(events[0]!);
    expect(seed[3]).toBe(events[3]!);
    // Và đây là MẢNG MỚI, không phải mảng của phiên.
    expect(seed).not.toBe(events);
    expect(result.oursReads).toBe(1);
    expect(result.theirsReads).toBe(1);
  });

  test("nhiều lượt đã xong: chọn turn/end CUỐI CÙNG — y bản gốc", async () => {
    const events: FakeEvent[] = [
      { type: "turn/start", seq: 0 },
      { type: "turn/end", seq: 1 },
      { type: "turn/start", seq: 2 },
      { type: "assistant/message", seq: 3 },
      { type: "turn/end", seq: 4 },
      { type: "turn/start", seq: 5 },
      { type: "user/message", seq: 6 },
    ];
    const result = await runBoth(events);
    expect(result.ours).toEqual(result.theirs);
    expect((result.ours.seed as FakeEvent[]).map((event) => event.seq)).toEqual([0, 1, 2, 3, 4]);
  });

  test("turn/end ngay sự kiện đầu ⇒ seed đúng MỘT sự kiện; hai lượt gọi cho hai mảng KHÁC nhau", async () => {
    const events: FakeEvent[] = [{ type: "turn/end", seq: 0 }];
    const mine = harness();
    apply(mine.ctx, { providerName: "fork" });
    const their = harness();
    stock.apply(their.ctx, { providerName: "fork" });
    const mineLog = logSource(events);
    const theirLog = logSource(events);
    const first = await mine.providers[0]!.prepareContinuable({ parent: mineLog.parent });
    const second = await mine.providers[0]!.prepareContinuable({ parent: mineLog.parent });
    const firstTheirs = await their.providers[0]!.prepareContinuable({ parent: theirLog.parent });
    const secondTheirs = await their.providers[0]!.prepareContinuable({ parent: theirLog.parent });
    expect(first).toEqual(firstTheirs);
    expect(first.seed).toEqual([events[0]!]);
    expect(first.seed).not.toBe(second.seed);
    expect(secondTheirs.seed).not.toBe(firstTheirs.seed);
  });

  test("ĐƯỜNG LỖI: log cha ném ⇒ NÉM ĐỒNG BỘ (y bản gốc), không treo; thiếu session ⇒ TypeError cùng thông điệp", () => {
    const mine = harness();
    apply(mine.ctx, { providerName: "fork" });
    const their = harness();
    stock.apply(their.ctx, { providerName: "fork" });
    const boom = (): never => {
      throw new Error("log hong");
    };
    /**
     * Bắt lỗi ĐỒNG BỘ của một lượt gọi: bản gốc đọc log TRƯỚC khi tạo Promise, nên log hỏng làm
     * `prepareContinuable` NÉM ngay (không phải promise bị reject) — khác biệt này phải giữ nguyên.
     * Nhận: hàm gọi provider.
     * Trả: thông điệp lỗi, hoặc "KHONG NEM" khi lượt gọi không ném đồng bộ.
     */
    const syncThrow = (call: () => Promise<Record<string, unknown>>): string => {
      try {
        const pending = call();
        void pending.catch(() => undefined);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };

    const oursThrow = syncThrow(() =>
      mine.providers[0]!.prepareContinuable({ parent: { session: { snapshotEvents: boom } } }),
    );
    const theirsThrow = syncThrow(() =>
      their.providers[0]!.prepareContinuable({ parent: { session: { snapshotEvents: boom } } }),
    );
    expect(oursThrow).toBe("log hong");
    expect(oursThrow).toBe(theirsThrow);

    // `parent` không có `session` ⇒ ném TypeError NGAY (không nuốt lỗi) — hai bên cùng thông điệp.
    const oursType = syncThrow(() => mine.providers[0]!.prepareContinuable({ parent: {} }));
    const theirsType = syncThrow(() => their.providers[0]!.prepareContinuable({ parent: {} }));
    expect(oursType).toContain("session");
    expect(oursType).toBe(theirsType);
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(REPO, "packages/host/subagent-fork-in-process/package.json");

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
