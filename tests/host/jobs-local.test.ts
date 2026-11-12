/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test cho @galaxy-blackhole/gbh-jobs-local: tập export đo trên ARTIFACT, đối chứng hành vi với
 *      chính bundle gốc (vòng đệm byte, sự kiện, bơm nguồn kéo, đường lỗi, hàng rào cách ly, dọn dẹp
 *      theo owner), và quy ước khai peer gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM.
 *      Context cordis là context THẬT nạp theo đường dẫn, không phải stub.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config, LocalJobRegistry as RegistryClass } from "../../packages/host/jobs-local/src/index.ts";

const REPO = join(import.meta.dir, "../..");
/** Artifact của TA (mọi phép đo kết luận đều đọc bản build, không đọc src/). */
const OURS_ENTRY = join(REPO, "packages/host/jobs-local/lib/index.js");
/** Bundle GỐC trong kernel (CHỈ ĐỌC) — oracle cho mọi ca đối chứng. */
const STOCK_ENTRY = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-jobs-local/lib/index.js");
/** Context cordis THẬT của kernel (một instance duy nhất với dsh-jobs/dsh-scope). */
const CORDIS_ENTRY = join(REPO, "apps/host/node_modules/@deepseek-ai/cordis/lib/index.js");
/** Bộ mint scope THẬT của kernel — dựng vòng đời owner đúng như agent thật. */
const DSH_SCOPE_ENTRY = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-scope/lib/index.js");

/** Kiểu context cordis thật, lấy từ chính chữ ký của package (tests/ không resolve được @deepseek-ai/*). */
type RealContext = ConstructorParameters<typeof RegistryClass>[0];
/** Kiểu id phiên của seam (đã brand) — test phải ép ở ranh giới. */
type SessionRef = NonNullable<Parameters<InstanceType<typeof RegistryClass>["list"]>[0]>;
/** Kiểu id job do sổ đăng ký cấp. */
type JobRef = ReturnType<InstanceType<typeof RegistryClass>["start"]>;

/** Phiên chủ dùng trong test. */
const SESS_A = "sess-a" as SessionRef;
/** Một id chắc chắn không tồn tại. */
const UNKNOWN_ID = "bash-0000000000000000" as JobRef;

/** Mặt `JobHandle` mà producer trong test dùng. */
interface ProducerHandle {
  append(text: string, options?: { channel?: "stdout" | "stderr" | "log"; gapBefore?: true }): void;
  updateProgress(line: string): void;
}

/** Kết cục producer (trùng hình dạng `JobOutcome` của seam). */
interface Outcome {
  status: "completed" | "killed" | "failed";
  detail?: string;
  result?: string;
}

/** Chủ sở hữu giả: đúng ba mặt mà sổ đăng ký dùng (id · session · ctx). */
interface FakeOwner {
  id: string;
  session: { append(type: string, data: unknown): void };
  ctx: RealContext;
}

/** Một bản cài đặt sổ đăng ký đã nạp (của ta hoặc của gốc). */
type Built = { LocalJobRegistry: typeof RegistryClass; TASK_WAIT_TIMEOUT: string };

const ours = (await import(OURS_ENTRY)) as Built;
const stock = (await import(STOCK_ENTRY)) as Built;
const cordis = (await import(CORDIS_ENTRY)) as { Context: new () => RealContext };
const scopeKit = (await import(DSH_SCOPE_ENTRY)) as {
  createScope(ctx: RealContext, key: object): { ctx: RealContext; dispose(): Promise<void> };
};

/**
 * Liệt kê tên export của một file ESM đã build, đọc thẳng từ ARTIFACT.
 * Nhận: nội dung file build.
 * Trả: tập tên export đã sắp xếp (gồm cả `default`).
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Chuẩn hoá giá trị quan sát được để hai bản so được với nhau: id job → `<id>`, mốc thời gian → `<ts>`.
 * Nhận: giá trị bất kỳ (bản chiếu, sự kiện, mảng…).
 * Trả: chuỗi JSON đã chuẩn hoá.
 */
/**
 * Thay mọi id job (sinh ngẫu nhiên) trong một chuỗi bằng `<id>` để hai bản so được với nhau.
 * Nhận: chuỗi cần làm sạch (kể cả thông điệp lỗi có nhúng id).
 * Trả: chuỗi đã thay id.
 */
function scrub(text: string): string {
  return text.replace(/([a-z]+)-[0-9a-f]{16}\b/g, "$1-<id>");
}

function normalise(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => {
    if (key === "startedAt" || key === "finishedAt") return "<ts>";
    if (typeof item === "string") return scrub(item);
    return item;
  });
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
 * Dựng một spec thô, cho phép giá trị SAI để đo đường lỗi.
 * Nhận: các trường ghi đè.
 * Trả: spec đã ép kiểu cho lời gọi `start`.
 */
function rawSpec(over: Record<string, unknown>): never {
  return { kind: "bash", label: "x", run: () => ({ cancel: () => {}, done: new Promise<Outcome>(() => {}) }), ...over } as never;
}

/** Một lượt chạy đối chứng: context THẬT + sổ đăng ký + băng ghi vết. */
interface Run {
  registry: InstanceType<typeof RegistryClass>;
  ctx: RealContext;
  log: string[];
  record(line: string): void;
  /** Chạy một thao tác rồi ghi kết quả HOẶC thông điệp lỗi (đường lỗi phải nói được, không treo). */
  attempt(label: string, action: () => unknown): void;
}

/**
 * Dựng context cordis thật + một bản cài đặt sổ đăng ký đã gắn controller.
 * Nhận: lớp sổ đăng ký cần dựng và cấu hình.
 * Trả: lượt chạy gồm context, sổ đăng ký, băng ghi vết và hai helper ghi vết.
 */
function boot(Registry: typeof RegistryClass, config: Config = {}): Run {
  const ctx = new cordis.Context();
  const registry = new Registry(ctx, Registry.Config(config));
  registry.attachController("test");
  const log: string[] = [];
  return {
    registry,
    ctx,
    log,
    record: (line) => {
      log.push(line);
    },
    attempt: (label, action) => {
      try {
        log.push(label + " -> " + normalise(action()));
      } catch (error) {
        log.push(label + " !! " + scrub(error instanceof Error ? error.message : String(error)));
      }
    },
  };
}

/**
 * Kịch bản vòng đời đầy đủ: đăng ký · tiến độ · kết thúc · ba kiểu đọc · kill/remove · ma trận đường lỗi.
 * Nhận: lớp sổ đăng ký.
 * Trả: vết đã chuẩn hoá (hai bản phải GIỐNG NHAU từng dòng).
 */
async function lifecycleScenario(Registry: typeof RegistryClass): Promise<string[]> {
  const run = boot(Registry);
  const { registry } = run;
  const events: string[] = [];
  registry.events.subscribe({ owners: "all" }, (event) => events.push(normalise(event)));
  registry.events.subscribe({ owner: SESS_A }, () => events.push("owner-filter-fired"));
  let handle: ProducerHandle | undefined;
  let settleOutcome: (outcome: Outcome) => void = () => {};
  const done = new Promise<Outcome>((resolve) => {
    settleOutcome = resolve;
  });
  const id = registry.start({
    kind: "bash",
    label: "echo hi",
    outputLimitBytes: 4096,
    run: (producer) => {
      handle = producer;
      producer.append("hello ");
      producer.append("thế giới");
      producer.updateProgress("1/2");
      return { cancel: () => {}, done };
    },
  });
  run.record("id dung khuon " + String(/^bash-[0-9a-f]{16}$/.test(id)));
  run.record("list sau start " + normalise(registry.list()));
  run.record("get khi dang chay " + normalise(registry.get(id)));
  settleOutcome({ status: "completed", detail: "exit code: 0", result: "ket-qua" });
  run.record("wait " + normalise(await registry.wait(id, 1000)));
  run.record("read1 " + normalise(registry.read(id)));
  run.record("read2 " + normalise(registry.read(id)));
  run.record("readAt0 " + normalise(registry.readAt(id, 0)));
  run.record("readAt giua " + normalise(registry.readAt(id, 6)));
  handle?.append("ghi sau khi chot");
  handle?.updateProgress("2/2");
  run.record("readAt sau khi ghi them " + normalise(registry.readAt(id, 0)));
  run.record("kill khi da xong " + normalise(registry.kill(id)));
  registry.remove(id);
  run.record("list sau remove " + normalise(registry.list()));
  const live = registry.start({ kind: "bash", label: "song", run: () => ({ cancel: () => {}, done: new Promise<Outcome>(() => {}) }) });
  run.attempt("remove job con song", () => registry.remove(live));
  run.attempt("readAt offset am", () => registry.readAt(live, -1));
  run.attempt("get id la", () => registry.get(UNKNOWN_ID));
  run.attempt("start kind rong", () => registry.start(rawSpec({ kind: "" })));
  run.attempt("start label rong", () => registry.start(rawSpec({ label: "" })));
  run.attempt("start outputLimitBytes 0", () => registry.start(rawSpec({ outputLimitBytes: 0 })));
  try {
    await registry.wait(live, 0);
    run.record("wait(0) -> khong nem");
  } catch (error) {
    run.record("wait(0) !! " + scrub(error instanceof Error ? error.message : String(error)));
  }
  registry.events.subscribe({ owners: "all" }, () => {});
  run.record("su kien " + events.join(" | "));
  return run.log;
}

/**
 * Kịch bản BYTE: offset là BYTE UTF-8 (không phải ký tự) và phần cắt đầu luôn an toàn theo điểm mã.
 * Nhận: lớp sổ đăng ký.
 * Trả: vết đã chuẩn hoá.
 */
function byteScenario(Registry: typeof RegistryClass): string[] {
  const run = boot(Registry, { retainBytes: 8, settledRetainBytes: 4 });
  const { registry } = run;
  let handle: ProducerHandle | undefined;
  const id = registry.start({
    kind: "bash",
    label: "bytes",
    run: (producer) => {
      handle = producer;
      return { cancel: () => {}, done: Promise.resolve<Outcome>({ status: "completed" }) };
    },
  });
  handle?.append("ếếếế");
  run.record("total=" + String(registry.get(id).output.total) + " so-ky-tu=" + String("ếếếế".length));
  run.record("sau khi cat " + normalise(registry.readAt(id, 0)));
  handle?.append("aế");
  run.record("sau khi cat tiep " + normalise(registry.readAt(id, 0)));
  handle?.append("abcdefghij");
  run.record("sau chunk dai " + normalise(registry.readAt(id, 0)));
  run.record("doc tu giua " + normalise(registry.readAt(id, 14)));
  const chunk = registry.readAt(id, 0).chunks[0];
  run.record("khong co byte thay the " + String(chunk === undefined || !chunk.text.includes("\uFFFD")));
  return run.log;
}

/**
 * Kịch bản BƠM: nguồn kéo có nhãn luồng, nguồn mất byte, và một nguồn NÉM lỗi (phải bị bọc).
 * Nhận: lớp sổ đăng ký.
 * Trả: lời hứa của vết đã chuẩn hoá (có chờ nhịp bơm).
 */
async function pumpScenario(Registry: typeof RegistryClass): Promise<string[]> {
  const run = boot(Registry, { pumpPollMs: 1 });
  const { registry } = run;
  const source = {
    channel: "stdout" as const,
    read: (from: number) => {
      const text = from === 0 ? "Aế" : "";
      return { text, nextOffset: from === 0 ? Buffer.byteLength(text, "utf8") : from, lossy: false, spillPath: "/tmp/gbh-spill-a" };
    },
  };
  const lossy = { read: (from: number) => ({ text: from === 0 ? "tail" : "", nextOffset: from === 0 ? 4 : from, lossy: from === 0 }) };
  const broken = {
    channel: "log" as const,
    read: () => {
      throw new Error("nguồn hỏng");
    },
  };
  let settleOutcome: (outcome: Outcome) => void = () => {};
  const done = new Promise<Outcome>((resolve) => {
    settleOutcome = resolve;
  });
  const id = registry.start({ kind: "bash", label: "pump", output: [source, lossy, broken], run: () => ({ cancel: () => {}, done }) });
  settleOutcome({ status: "completed" });
  run.record("pump view " + normalise(await registry.wait(id, 1000)));
  run.record("pump read " + normalise(registry.read(id)));
  return run.log;
}

describe("gbh-jobs-local · đối chứng với chính bundle gốc", () => {
  test("vòng đời: ta và gốc cho CÙNG một vết", async () => {
    const mine = await lifecycleScenario(ours.LocalJobRegistry);
    const theirs = await lifecycleScenario(stock.LocalJobRegistry);
    expect(mine.length).toBeGreaterThan(15);
    expect(mine).toEqual(theirs);
  });

  test("ca BYTE: vết của ta bằng vết của gốc", () => {
    const mine = byteScenario(ours.LocalJobRegistry);
    const theirs = byteScenario(stock.LocalJobRegistry);
    expect(mine.length).toBe(6);
    expect(mine).toEqual(theirs);
  });

  test("bơm nguồn kéo: vết của ta bằng vết của gốc", async () => {
    const mine = await pumpScenario(ours.LocalJobRegistry);
    const theirs = await pumpScenario(stock.LocalJobRegistry);
    expect(mine).toEqual(theirs);
  });
});

describe("gbh-jobs-local · tập export trên ARTIFACT", () => {
  test("hai artifact có CÙNG tập export, và bundle KHÔNG mang id gốc", async () => {
    const myText = readFileSync(OURS_ENTRY, "utf8");
    const stockText = readFileSync(STOCK_ENTRY, "utf8");
    expect(exportNames(myText)).toEqual(exportNames(stockText));
    expect(exportNames(myText)).toEqual(["LocalJobRegistry", "TASK_WAIT_TIMEOUT", "default"]);
    expect(Object.keys(await import(OURS_ENTRY)).sort()).toEqual(exportNames(myText));
    expect(ours.TASK_WAIT_TIMEOUT).toBe(stock.TASK_WAIT_TIMEOUT);
    expect(myText).not.toContain('id: "@deepseek-ai');
    expect(stockText).not.toContain('id: "@deepseek-ai');
  });
});

describe("gbh-jobs-local · hàng rào cách ly", () => {
  test("job có chủ không lộ cho phiên khác, và thông điệp lỗi không rò nội dung", () => {
    const run = boot(ours.LocalJobRegistry);
    const owner: FakeOwner = { id: "sess-a", session: { append: () => {} }, ctx: run.ctx };
    provide(run.ctx, "agents", { get: (session: string) => (session === "sess-a" ? owner : undefined) });
    const id = run.registry.start({ kind: "bash", label: "bi-mat-42", owner: SESS_A, run: () => ({ cancel: () => {}, done: new Promise<Outcome>(() => {}) }) });
    expect(run.registry.list(SESS_A).length).toBe(1);
    expect(run.registry.list("sess-b" as SessionRef).length).toBe(0);
    expect(run.registry.list().length).toBe(0);
    let message = "";
    try {
      run.registry.get(id, "sess-b" as SessionRef);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("belongs to another session");
    expect(message).not.toContain("bi-mat-42");
  });
});

describe("gbh-jobs-local · ranh giới vận hành", () => {
  test("chưa gắn controller ⇒ start từ chối; trần job đồng thời được áp", () => {
    const bare = new cordis.Context();
    const unbooted = new ours.LocalJobRegistry(bare, ours.LocalJobRegistry.Config({}));
    const spec = { kind: "bash" as const, label: "x", run: () => ({ cancel: () => {}, done: new Promise<Outcome>(() => {}) }) };
    expect(() => unbooted.start(spec)).toThrow("no job controller serves this agent");
    const run = boot(ours.LocalJobRegistry, { maxConcurrentJobsPerOwner: 1 });
    run.registry.start(spec);
    expect(() => run.registry.start(spec)).toThrow("background job limit reached for this owner (limit: 1)");
  });

  test("dọn dẹp theo owner: huỷ việc đang chạy, chờ producer, rồi bỏ bản ghi", async () => {
    const ctx = new cordis.Context();
    const scope = scopeKit.createScope(ctx, {});
    const registry = new ours.LocalJobRegistry(ctx, ours.LocalJobRegistry.Config({}));
    registry.attachController("test");
    const seen: string[] = [];
    registry.events.subscribe({ owners: "all" }, (event) => seen.push(event.type + (event.type === "settled" ? ":" + event.cause : "")));
    let cancelReason: string | undefined;
    let settleOutcome: (outcome: Outcome) => void = () => {};
    const done = new Promise<Outcome>((resolve) => {
      settleOutcome = resolve;
    });
    const owner: FakeOwner = { id: "sess-a", session: { append: () => {} }, ctx: scope.ctx };
    provide(ctx, "agents", { get: (session: string) => (session === "sess-a" ? owner : undefined) });
    const id = registry.start({
      kind: "bash",
      label: "chay-nen",
      owner: SESS_A,
      run: (producer) => {
        producer.append("dang chay");
        return {
          cancel: (reason) => {
            cancelReason = reason;
            settleOutcome({ status: "killed" });
          },
          done,
        };
      },
    });
    await scope.dispose();
    expect(cancelReason).toBe("owner disposed");
    expect(registry.list(SESS_A).length).toBe(0);
    expect(seen).toEqual(["registered", "stopping", "settled:teardown", "output", "removed"]);
    expect(() => registry.get(id, SESS_A)).toThrow("unknown job");
  });

  test("dọn dẹp service: cancel ném lỗi bị ép hỏng ĐÚNG bản ghi đó", async () => {
    const run = boot(ours.LocalJobRegistry);
    const seen: string[] = [];
    run.registry.events.subscribe({ owners: "all" }, (event) => {
      seen.push(event.type + (event.type === "settled" ? ":" + event.cause + ":" + String(event.job.detail) : ""));
    });
    const id = run.registry.start({
      kind: "bash",
      label: "cancel-no",
      run: () => ({
        cancel: () => {
          throw new Error("cancel hong");
        },
        done: new Promise<Outcome>(() => {}),
      }),
    });
    await (run.registry as unknown as { disposeAll(): Promise<void> }).disposeAll();
    expect(seen).toContain("settled:teardown:cancel threw during teardown; work may be orphaned: Error: cancel hong");
    expect(() => run.registry.get(id)).toThrow("unknown job");
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả ~gbh.peers~ lẫn ~peerDependencies~ (JSON được miễn header). */
const MANIFEST = join(REPO, "packages/host/jobs-local/package.json");

/** Ba peer NGOÀI cordis/schemastery mà bản viết lại THẬT SỰ dùng (bản gốc còn peer ~dsh-agent~; ta chỉ mượn KIỂU). */
const SEAM_PEERS = ["@deepseek-ai/dsh-jobs", "@deepseek-ai/dsh-scope", "@deepseek-ai/dsh-timeout"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  peerDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  gbh?: { peers?: string[] };
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không ~import~ — ~tests/~ không resolve được ~@deepseek-ai/*~).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của ~gbh.peers~ không có mặt trong ~peerDependencies~.
 * So PHẦN TỬ, KHÔNG so số lượng — ~peerDependencies~ thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((name) => !declared.has(name)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("gbh-jobs-local · quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    for (const name of peers) expect(declared).toContain(name);
    expect(missingPeers(manifest)).toEqual([]);
    // Phiên bản: peer phải trỏ ĐÚNG phiên bản kernel đang chạy. Lượt pin exact (01/11/2026) đổi từ dải
    // "~0.2.1-alpha.4" sang chính xác "0.2.1-alpha.4" ⇒ nhận CẢ HAI dạng, nhưng không nhận dải khác.
    for (const name of peers) {
      const kernel = JSON.parse(readFileSync(join(REPO, "apps/host/node_modules", name, "package.json"), "utf8")) as {
        version: string;
      };
      const declaredVersion = manifest.peerDependencies?.[name];
      // Nhận CẢ dạng exact lẫn dải "~x", nhưng PHẢI trỏ đúng phiên bản kernel đang chạy.
      expect(declaredVersion === kernel.version || declaredVersion === "~" + kernel.version).toBe(true);
    }
  });

  test("peer khai ra phải có THẬT trong kernel (mount symlink từ apps/host/node_modules)", () => {
    const manifest = readManifest();
    for (const name of manifest.gbh?.peers ?? []) {
      expect(existsSync(join(REPO, "apps/host/node_modules", name, "package.json"))).toBe(true);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const name of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[name];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([name]);
    }
    // Xoá SẠCH peerDependencies ⇒ phải báo ĐỦ cả ba tên (không phải một con số).
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
    expect((manifest.gbh?.peers ?? []).filter((name) => deps.has(name))).toEqual([]);
  });
});
