/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-fs-observation-policy: mỗi ca hành vi dựng HAI giàn
 *      giống hệt nhau rồi chạy CẢ HAI bản cài (apply của ta và apply của chính bundle gốc), so từng
 *      quyết định `fs/*` + từng lỗi; cộng ca tập export trên ARTIFACT, ca gbh.peers ⊆ peerDependencies
 *      (có ĐỐI CHỨNG ÂM) và ca C6 — trạng thái quan sát ĐỘC LẬP giữa các thực thể, kiểm bằng DANH TÍNH.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/fs-observation-policy/build.ts";
import type * as OurModule from "../../packages/host/fs-observation-policy/src/index.ts";
import type { FsObservationContext } from "../../packages/host/fs-observation-policy/src/types.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "fs-observation-policy");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-fs-observation-policy");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục ARTIFACT của ta: nằm TRONG `lib/` để `packages: "external"` phân giải được peer. */
const ARTIFACT_DIR = join(PKG, "lib", "test-artifact");
/**
 * LƯỢT ĐO 01/11/2026: mô-đun của ta nạp từ ARTIFACT có `node_modules/@deepseek-ai` trỏ KERNEL, KHÔNG
 * từ `src` — `src` nạp bản SAO workspace nên lớp `FsError`/`Service` lệch danh tính với bản gốc
 * (ca "lỗi là CÙNG MỘT LỚP FsError của kernel" đỏ OAN).
 */
const ARTIFACT = await buildPackage(ARTIFACT_DIR);
mkdirSync(join(ARTIFACT_DIR, "node_modules"), { recursive: true });
symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(ARTIFACT_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(ARTIFACT_DIR, "node_modules", "@galaxy-blackhole"), "dir");
const our = (await import(ARTIFACT)) as typeof OurModule;
const { apply, name } = our;

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as { apply: unknown; name: string };

/** Chữ ký chung của hai bản cài: cùng nhận một context như nhau. */
type ApplyFn = (ctx: FsObservationContext) => void;

/** Hàm `apply` của bản gốc, ép về chữ ký chung để dựng giàn. */
const stockApply = stock.apply as ApplyFn;

/** Phiên giả: chính sách chỉ cần DANH TÍNH, đúng như bản gốc. */
interface FakeSession {
  /** Mã phiên. */
  id: string;
}

/** Đích giả: chính sách chỉ đọc `targetKey` và `displayPath`, đúng như bản gốc. */
interface FakeTarget {
  /** Khoá đích (đục lỗ). */
  targetKey: string;
  /** Đường dẫn hiển thị cho model/UI. */
  displayPath: string;
}

/** Listener thô của giàn: tham số do từng ca ép kiểu tại chỗ. */
type Listener = (...args: unknown[]) => unknown;

/** Một hiệu ứng đã đăng ký: hàm dựng hàm dọn + nhãn chẩn đoán. */
interface EffectRecord {
  /** Hàm cordis gọi để lấy hàm dọn. */
  callback: () => () => void;
  /** Nhãn chẩn đoán (có thể vắng). */
  label?: string;
}

/** Giàn giả tối thiểu nhưng ĐÚNG hình dạng seam thật: sổ listener theo thứ tự đăng ký + sổ hiệu ứng. */
interface Harness {
  /** Context đưa cho `apply`. */
  ctx: FsObservationContext;
  /** Thứ tự tên sự kiện đã đăng ký. */
  order: string[];
  /** Sổ hiệu ứng đã đăng ký. */
  effects: EffectRecord[];
  /** Lấy listener của một sự kiện (ném khi chưa đăng ký). */
  listener(event: string): Listener;
  /** Có listener cho sự kiện này không (đo hàm gỡ đăng ký). */
  has(event: string): boolean;
}

/**
 * Dựng một giàn giả.
 * Nhận: không.
 * Trả: giàn dùng chung được cho CẢ bản của ta lẫn bản gốc.
 */
function harness(): Harness {
  const order: string[] = [];
  const listeners = new Map<string, Listener>();
  const effects: EffectRecord[] = [];
  const ctx = {
    on(event: string, listener: Listener): () => void {
      order.push(event);
      listeners.set(event, listener);
      return () => {
        listeners.delete(event);
      };
    },
    effect(callback: () => () => void, label?: string): unknown {
      effects.push({ callback, ...(label === undefined ? {} : { label }) });
      return callback;
    },
  };
  return {
    ctx: ctx as unknown as FsObservationContext,
    order,
    effects,
    listener: (event) => {
      const found = listeners.get(event);
      if (found === undefined) throw new Error("chưa đăng ký listener " + event);
      return found;
    },
    has: (event) => listeners.has(event),
  };
}

/**
 * Dựng giàn rồi cài MỘT bản plugin lên đó.
 * Nhận: hàm `apply` cần cài.
 * Trả: giàn đã cài.
 */
function mount(applyFn: ApplyFn): Harness {
  const h = harness();
  applyFn(h.ctx);
  return h;
}

/** Một đích giả với khoá và đường dẫn hiển thị. */
function target(targetKey: string, displayPath: string): FakeTarget {
  return { targetKey, displayPath };
}

/** Ba đích dùng xuyên suốt bộ ca. */
const A = target("k-a", "/tmp/a.txt");
const B = target("k-b", "/tmp/b.txt");

/** Actor của một phiên giả — hình dạng đúng như `ToolExecution` thật. */
function actorOf(session: FakeSession): { agent: { session: FakeSession } } {
  return { agent: { session } };
}

/** Chủ sở hữu dùng cho hầu hết ca. */
const S1 = { id: "s1" };

/** Chủ sở hữu thứ hai, để đo tính CÔ LẬP giữa các phiên. */
const S2 = { id: "s2" };

/** Quan sát đã có mặt tại một phiên bản. */
function present(version: string): { kind: "present"; version: string } {
  return { kind: "present", version };
}

/** Quan sát đã xác nhận VẮNG MẶT. */
const ABSENT = { kind: "absent" } as const;

/** Bản ghi lỗi đã chuẩn hoá để so giữa hai bản cài. */
interface Failure {
  /** Tên lớp lỗi (`error.name`). */
  name: string;
  /** Mã máy đọc được (`error.code`). */
  code: string;
  /** Nguyên văn thông điệp. */
  message: string;
}

/**
 * Chuẩn hoá một giá trị bị ném/từ chối thành bản ghi so sánh được.
 * Nhận: giá trị bắt được (`unknown`).
 * Trả: `{ name, code, message }`, hoặc chuỗi nếu không phải `Error`.
 */
function failureOf(error: unknown): Failure | string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as unknown as { code?: unknown }).code;
  return { name: error.name, code: typeof code === "string" ? code : "", message: error.message };
}

/** Kết quả một lượt gọi waterfall: giá trị, hoặc lỗi đã chuẩn hoá. */
interface Outcome {
  /** Giá trị trả về khi thành công. */
  value?: unknown;
  /** Lỗi đã chuẩn hoá khi thất bại. */
  error?: Failure | string;
  /** Lượt gọi có ném ĐỒNG BỘ không (bản gốc: không — lỗi thành promise bị từ chối). */
  threwSync: boolean;
  /** Giá trị trả có phải Promise không. */
  isPromise: boolean;
}

/**
 * Gọi một waterfall và ghi lại giá trị/lỗi, TÁCH BẠCH ném-đồng-bộ với promise-bị-từ-chối.
 * Nhận: giàn, tên sự kiện và các tham số của sự kiện.
 * Trả: {@link Outcome} đã chuẩn hoá.
 */
async function callWaterfall(h: Harness, event: string, ...args: unknown[]): Promise<Outcome> {
  let raw: unknown;
  try {
    raw = h.listener(event)(...args);
  } catch (thrown) {
    return { error: failureOf(thrown), threwSync: true, isPromise: false };
  }
  const isPromise = raw instanceof Promise;
  try {
    return { value: await raw, threwSync: false, isPromise };
  } catch (rejected) {
    return { error: failureOf(rejected), threwSync: false, isPromise };
  }
}

/**
 * Chạy một kịch bản trên MỘT bản cài và trả về vết đầy đủ để so.
 * Nhận: hàm `apply` và kịch bản là danh sách bước.
 * Trả: mảng kết quả từng bước (đã chuẩn hoá) — dùng `toEqual` giữa ta và gốc.
 */
async function runScenario(applyFn: ApplyFn, steps: ((h: Harness) => Promise<unknown> | unknown)[]): Promise<unknown[]> {
  const h = mount(applyFn);
  const trace: unknown[] = [];
  for (const step of steps) trace.push(await step(h));
  return trace;
}

afterAll(async () => {
  await rm(ARTIFACT_DIR, { recursive: true, force: true });
});

describe("row fs-observation-policy · đối chứng hành vi với chính bundle gốc", () => {
  test("fs/write-intent: chưa thấy ⇒ createIfAbsent · có mặt ⇒ replaceIfVersion · vắng mặt ⇒ createIfAbsent", async () => {
    const steps = [
      (h: Harness) => callWaterfall(h, "fs/write-intent", A, actorOf(S1)),
      (h: Harness) => {
        h.listener("fs/observed")(A, present("v1"), actorOf(S1));
        return callWaterfall(h, "fs/write-intent", A, actorOf(S1));
      },
      (h: Harness) => {
        h.listener("fs/observed")(A, ABSENT, actorOf(S1));
        return callWaterfall(h, "fs/write-intent", A, actorOf(S1));
      },
    ];
    const ours = await runScenario(apply, steps);
    const theirs = await runScenario(stockApply, steps);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      { value: { kind: "createIfAbsent" }, threwSync: false, isPromise: true },
      { value: { kind: "replaceIfVersion", version: "v1" }, threwSync: false, isPromise: true },
      { value: { kind: "createIfAbsent" }, threwSync: false, isPromise: true },
    ]);
  });

  test("fs/edit-intent: chưa thấy ⇒ FS_NOT_OBSERVED · có mặt ⇒ {version} · vắng mặt ⇒ FS_NOT_FOUND", async () => {
    const steps = [
      (h: Harness) => callWaterfall(h, "fs/edit-intent", A, actorOf(S1)),
      (h: Harness) => {
        h.listener("fs/observed")(A, present("v1"), actorOf(S1));
        return callWaterfall(h, "fs/edit-intent", A, actorOf(S1));
      },
      (h: Harness) => {
        h.listener("fs/observed")(A, ABSENT, actorOf(S1));
        return callWaterfall(h, "fs/edit-intent", A, actorOf(S1));
      },
    ];
    const ours = await runScenario(apply, steps);
    const theirs = await runScenario(stockApply, steps);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      {
        error: { name: "FsError", code: "FS_NOT_OBSERVED", message: 'edit requires reading "/tmp/a.txt" first' },
        threwSync: false,
        isPromise: true,
      },
      { value: { version: "v1" }, threwSync: false, isPromise: true },
      {
        error: { name: "FsError", code: "FS_NOT_FOUND", message: 'cannot edit "/tmp/a.txt": not found' },
        threwSync: false,
        isPromise: true,
      },
    ]);
  });

  test("lỗi là CÙNG MỘT LỚP FsError của kernel (danh tính lớp, không phải bản sao)", async () => {
    const ours = mount(apply);
    const theirs = mount(stockApply);
    const ourFailure = await callWaterfall(ours, "fs/edit-intent", A, actorOf(S1));
    const theirFailure = await callWaterfall(theirs, "fs/edit-intent", A, actorOf(S1));
    const ourError = (ourFailure.error ?? "") as Failure;
    const theirError = (theirFailure.error ?? "") as Failure;
    expect(ourError).toEqual(theirError);
    // Bắt lại lỗi THẬT để so danh tính lớp — chứng minh ta ném đúng lớp của kernel, không tự dựng.
    const caught = await (ours.listener("fs/edit-intent")(A, actorOf(S1)) as Promise<unknown>).catch(
      (error: unknown) => error,
    );
    const stockCaught = await (theirs.listener("fs/edit-intent")(A, actorOf(S1)) as Promise<unknown>).catch(
      (error: unknown) => error,
    );
    expect(caught instanceof Error).toBe(true);
    expect((caught as Error).constructor).toBe((stockCaught as Error).constructor);
  });

  test("actor KHÔNG có phiên agent ⇒ đọc tự do nhưng không bao giờ thoả chính sách (0 ghi nhận)", async () => {
    const steps = [
      (h: Harness) => {
        // Quan sát với actor không có phiên: KHÔNG ghi được gì.
        h.listener("fs/observed")(A, present("v9"), undefined);
        h.listener("fs/observed")(A, present("v9"), {});
        return callWaterfall(h, "fs/edit-intent", A, undefined);
      },
      (h: Harness) => callWaterfall(h, "fs/write-intent", A, undefined),
      (h: Harness) => callWaterfall(h, "fs/edit-intent", A, {}),
    ];
    const ours = await runScenario(apply, steps);
    const theirs = await runScenario(stockApply, steps);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      {
        error: { name: "FsError", code: "FS_NOT_OBSERVED", message: 'edit requires reading "/tmp/a.txt" first' },
        threwSync: false,
        isPromise: true,
      },
      { value: { kind: "createIfAbsent" }, threwSync: false, isPromise: true },
      {
        error: { name: "FsError", code: "FS_NOT_OBSERVED", message: 'edit requires reading "/tmp/a.txt" first' },
        threwSync: false,
        isPromise: true,
      },
    ]);
  });

  test("trạng thái khoá theo (phiên, đích): hai phiên và hai đích KHÔNG trông thấy nhau", async () => {
    const steps = [
      (h: Harness) => {
        h.listener("fs/observed")(A, present("v1"), actorOf(S1));
        return callWaterfall(h, "fs/edit-intent", A, actorOf(S2));
      },
      (h: Harness) => callWaterfall(h, "fs/edit-intent", B, actorOf(S1)),
      (h: Harness) => callWaterfall(h, "fs/edit-intent", A, actorOf(S1)),
      (h: Harness) => {
        h.listener("fs/observed")(A, present("v2"), actorOf(S2));
        return Promise.all([
          callWaterfall(h, "fs/edit-intent", A, actorOf(S1)),
          callWaterfall(h, "fs/edit-intent", A, actorOf(S2)),
        ]);
      },
    ];
    const ours = await runScenario(apply, steps);
    const theirs = await runScenario(stockApply, steps);
    expect(ours).toEqual(theirs);
    expect(ours[3]).toEqual([
      { value: { version: "v1" }, threwSync: false, isPromise: true },
      { value: { version: "v2" }, threwSync: false, isPromise: true },
    ]);
  });

  test("fs/observed là bộ GHI NHẬN ĐỒNG BỘ: trả undefined, không ném, không trả promise", () => {
    const ours = mount(apply);
    const theirs = mount(stockApply);
    for (const h of [ours, theirs]) {
      const returned = h.listener("fs/observed")(A, present("v1"), actorOf(S1));
      expect(returned).toBeUndefined();
    }
  });

  test("thứ tự đăng ký + nhãn hiệu ứng + hàm dọn rơi SẠCH trạng thái", async () => {
    const scenario = async (applyFn: ApplyFn): Promise<unknown> => {
      const h = mount(applyFn);
      const order = [...h.order];
      const labels = h.effects.map((effect) => effect.label);
      h.listener("fs/observed")(A, present("v1"), actorOf(S1));
      const before = await callWaterfall(h, "fs/edit-intent", A, actorOf(S1));
      const dispose = h.effects[0]?.callback();
      dispose?.();
      const after = await callWaterfall(h, "fs/edit-intent", A, actorOf(S1));
      // Gọi hàm dọn lần hai phải VÔ HẠI (bản gốc thay bản đồ yếu bằng bản đồ mới).
      dispose?.();
      return { order, labels, before, after };
    };
    const ours = await scenario(apply);
    const theirs = await scenario(stockApply);
    expect(ours).toEqual(theirs);
    expect(ours).toEqual({
      order: ["fs/write-intent", "fs/edit-intent", "fs/observed"],
      labels: ["fs-observation-policy observed-state teardown"],
      before: { value: { version: "v1" }, threwSync: false, isPromise: true },
      after: {
        error: { name: "FsError", code: "FS_NOT_OBSERVED", message: 'edit requires reading "/tmp/a.txt" first' },
        threwSync: false,
        isPromise: true,
      },
    });
  });
});

describe("row fs-observation-policy · bề mặt plugin đo trên ARTIFACT", () => {
  test("ARTIFACT: tập export của ta = tập export của bản gốc, 0 id module, apply nhận 1 tham số", async () => {
    const file = ARTIFACT;
    const code = readFileSync(file, "utf8");
    // Host-only: KHÔNG đăng ký id module nào (bản gốc cũng vậy) — nên cả hai phép đếm đều 0.
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...code.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    const artifact = (await import(file)) as { apply: ApplyFn; name: string };
    expect(Object.keys(artifact).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(artifact).sort()).toEqual(["apply", "name"]);
    expect("default" in artifact).toBe(false);
    expect(artifact.apply.length).toBe(stockApply.length);
    expect(artifact.apply.length).toBe(1);
    expect(artifact.name).toBe(stock.name);
    expect(artifact.name).toBe("fs-observation-policy");
    expect(name).toBe(artifact.name);
  });

  test("000e: locale en/zh chép byte-for-byte từ gói gốc, và manifest export chúng", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const locale of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(PKG, "locale", locale));
      const theirs = readFileSync(join(STOCK_DIR, "locale", locale));
      expect(ours.equals(theirs)).toBe(true);
    }
    // meta.title lấy từ file này làm tiêu đề hàng ở màn Plugins — phải khớp TỪNG CHỮ với gốc.
    const oursEn = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    const theirsEn = JSON.parse(readFileSync(join(STOCK_DIR, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    expect(oursEn).toEqual(theirsEn);
    expect(oursEn.meta?.title).toBe("fs-observation-policy");
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer THẬT SỰ cần lúc chạy: kernel cấp ĐÚNG MỘT thể hiện (cordis là context host, dsh-fs cho FsError). */
const RUNTIME_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-fs"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  exports?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: { peers?: string[]; row?: unknown };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import` — test không resolve `@deepseek-ai/*`).
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

describe("row fs-observation-policy · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...RUNTIME_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
  });

  test("peer khai ra phải có THẬT trong kernel, khớp phiên bản, và KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    for (const peer of manifest.gbh?.peers ?? []) {
      const kernel = JSON.parse(readFileSync(join(ROOT, "apps", "host", "node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      const declared = manifest.peerDependencies?.[peer] ?? "";
      expect(declared.length).toBeGreaterThan(0);
      // Khoảng khai phải phủ phiên bản kernel: "0.2.0-rc.2" khớp chính xác; "~4.0.4" khớp 4.0.5.
      const floor = declared.replace(/^[~^]/, "").split(".").slice(0, 2).join(".");
      expect(kernel.version.startsWith(floor)).toBe(true);
      expect(deps.has(peer)).toBe(false);
      expect(manifest.devDependencies?.[peer]).toBe(declared);
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
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau vẫn PHẢI bị bắt", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    // Hai danh sách cùng ĐỘ DÀI nhưng lệch phần tử — phép so số lượng sẽ nói OK, phép so phần tử phải ĐỎ.
    mutated.gbh = { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] };
    mutated.peerDependencies = { "@deepseek-ai/cordis": "~4.0.4", "@deepseek-ai/dsh-fs": "0.2.0-rc.2" };
    expect(mutated.gbh.peers?.length).toBe(Object.keys(mutated.peerDependencies).length);
    expect(missingPeers(mutated)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Và THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =).
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("row fs-observation-policy · cổng an toàn mount", () => {
  });

describe("row fs-observation-policy · C6: trạng thái quan sát ĐỘC LẬP giữa các thực thể", () => {
  test("hai lượt cài KHÔNG chia sẻ trạng thái — và ĐỐI CHỨNG DƯƠNG trong MỘT lượt cài", async () => {
    const first = mount(apply);
    const second = mount(apply);
    first.listener("fs/observed")(A, present("v1"), actorOf(S1));
    // ĐỐI CHỨNG DƯƠNG (chống test rỗng nghĩa): trong CÙNG một lượt cài, trạng thái CÓ được thấy.
    expect(await callWaterfall(first, "fs/edit-intent", A, actorOf(S1))).toEqual({
      value: { version: "v1" },
      threwSync: false,
      isPromise: true,
    });
    // Thực thể thứ hai KHÔNG thấy gì — nếu dùng chung một bản đồ thì ca này sẽ trả `v1` và ĐỎ.
    expect(await callWaterfall(second, "fs/edit-intent", A, actorOf(S1))).toEqual({
      error: { name: "FsError", code: "FS_NOT_OBSERVED", message: 'edit requires reading "/tmp/a.txt" first' },
      threwSync: false,
      isPromise: true,
    });
  });

  test("hai thực thể giữ phiên bản RIÊNG của cùng một đích, và hàm dọn của thực thể này không xoá thực thể kia", async () => {
    const first = mount(apply);
    const second = mount(apply);
    first.listener("fs/observed")(A, present("v1"), actorOf(S1));
    second.listener("fs/observed")(A, present("v2"), actorOf(S1));
    expect(await callWaterfall(first, "fs/edit-intent", A, actorOf(S1))).toEqual({ value: { version: "v1" }, threwSync: false, isPromise: true });
    expect(await callWaterfall(second, "fs/edit-intent", A, actorOf(S1))).toEqual({ value: { version: "v2" }, threwSync: false, isPromise: true });
    // Dọn thực thể ĐẦU: chỉ trạng thái của nó rơi, thực thể HAI vẫn giữ nguyên quan sát.
    first.effects[0]?.callback()();
    expect(await callWaterfall(first, "fs/edit-intent", A, actorOf(S1))).toEqual({
      error: { name: "FsError", code: "FS_NOT_OBSERVED", message: 'edit requires reading "/tmp/a.txt" first' },
      threwSync: false,
      isPromise: true,
    });
    expect(await callWaterfall(second, "fs/edit-intent", A, actorOf(S1))).toEqual({ value: { version: "v2" }, threwSync: false, isPromise: true });
  });

  test("C6 trên VẬT THỂ TRẢ VỀ: mỗi lượt quyết định sinh object MỚI — sửa bản này không lan sang bản kia", async () => {
    for (const applyFn of [apply, stockApply]) {
      const h = mount(applyFn);
      h.listener("fs/observed")(A, present("v1"), actorOf(S1));
      const one = (await callWaterfall(h, "fs/edit-intent", A, actorOf(S1))).value;
      const two = (await callWaterfall(h, "fs/edit-intent", A, actorOf(S1))).value;
      // Giá trị bằng nhau (phép so sâu ĐẠT) nhưng DANH TÍNH khác — đúng lớp lỗi C6.
      expect(one).toEqual(two);
      expect(one).not.toBe(two);
      (one as { version: string }).version = "DOI_MA";
      expect((two as { version: string }).version).toBe("v1");
    }
  });
});
