/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — bề mặt service: 0 method THIẾU + whitelist TƯỜNG MINH cho method thừa
 *      (`applyPatches`, khai ở docs/GBH-SAI-KHAC-CO-CHU-DICH.md §2l) thay cho phép so "0 thừa" tuyệt đối.
 * desc Test cho @galaxy-blackhole/gbh-hmr: tập export đo trên ARTIFACT, đối chứng bề mặt service + schema với
 *      CHÍNH bundle gốc, ca C6 (danh tính vật thể cấu hình), ModuleFiles, watchConfig, runExclusive,
 *      và quy ước khai peer gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { globMatcher } from "../../packages/host/hmr/src/ignore.ts";
import { ModuleFiles } from "../../packages/host/hmr/src/module-files.ts";
import { watchConfig, type WatchContext } from "../../packages/host/hmr/src/watch-config.ts";

/** Thư mục gốc repo. */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO_ROOT, "packages", "host", "hmr");
/** ARTIFACT của ta — mọi phép đo kết luận đều đọc bản build, không đọc src/. */
const OURS_ENTRY = join(PKG, "lib", "index.js");
/** Bundle GỐC trong kernel (CHỈ ĐỌC) — oracle cho mọi ca đối chứng. */
const STOCK_ENTRY = join(REPO_ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-hmr", "lib", "index.js");
/** picomatch THẬT của gói gốc — oracle cho phép so bộ khớp glob thay thế. */
const PICOMATCH_ENTRY = join(REPO_ROOT, "apps", "host", "node_modules", "picomatch", "index.js");

/** Artifact của ta (nạp động để phép đo chạy trên đúng thứ mount vào profile) — giữ cả NAMESPACE để đo tập export. */
const OursNamespace = await import(OURS_ENTRY);
/** Artifact gốc (đọc-chỉ) — namespace. */
const StockNamespace = await import(STOCK_ENTRY);
/** Lớp Hmr của ta (mặc định của artifact). */
const Ours = OursNamespace.default;
/** Lớp Hmr của gói gốc (đọc-chỉ). */
const Stock = StockNamespace.default;
/** Bộ khớp glob của gói gốc. */
const picomatch = (await import(PICOMATCH_ENTRY)).default;

/** Các thư mục tạm đã tạo, dọn sau khi test xong. */
const TEMP_DIRS: string[] = [];

/**
 * Tạo một thư mục tạm và ghi nhớ để dọn.
 * @returns Đường dẫn tuyệt đối của thư mục.
 */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gbh-hmr-test-"));
  TEMP_DIRS.push(dir);
  return dir;
}

/**
 * Chờ tới khi điều kiện đúng, hoặc hết hạn.
 * @param predicate - điều kiện cần đạt.
 * @param timeoutMs - hạn chờ (mili giây).
 * @returns Promise hoàn tất khi điều kiện đúng.
 * @throws Khi hết hạn mà điều kiện vẫn sai.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("waitFor: hết hạn chờ");
}

/** Context giả tối thiểu của watcher: chỉ logger + effect. */
function fakeContext(): WatchContext & { warnings: unknown[] } {
  const warnings: unknown[] = [];
  return {
    warnings,
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
    effect: (effect: () => () => Promise<void>) => effect(),
  };
}

afterAll(() => {
  for (const dir of TEMP_DIRS) rmSync(dir, { recursive: true, force: true });
});

describe("A. khuôn bundle — đo trên ARTIFACT", () => {
  test("tập export của ta BẰNG tập export của bundle gốc (namespace artifact)", () => {
    expect(Object.keys(OURS_ENTRY ? OursNamespace : {}).sort()).toEqual(Object.keys(StockNamespace).sort());
    expect(Object.keys(OursNamespace)).toEqual(["default"]);
  });

  test("static surface: chỉ khác ĐÚNG một tên — `inject` thay cho decorator @Inject của bản gốc", () => {
    const ours = Object.keys(Ours).sort();
    const stock = Object.keys(Stock).sort();
    expect(ours).toEqual(["Config", "inject"]);
    expect(stock).toEqual(["Config"]);
    expect(ours.filter((name) => !stock.includes(name))).toEqual(["inject"]);
    expect(Ours.inject).toEqual(["loader", "timer"]);
  });

  /**
   * Tên method ĐƯỢC PHÉP THỪA trên prototype service — WHITELIST TƯỜNG MINH, không phải "miễn trừ".
   *
   * ⚠️ 11/11/2026 — `applyPatches` là SAI KHÁC CÓ CHỦ ĐÍCH đã khai ở docs/GBH-SAI-KHAC-CO-CHU-DICH.md §2l:
   *   seam áp patch SỐNG cho `configEditor` ghi cấu hình. Lý do: kernel từ chối MỌI lượt ghi
   *   (`settings/rejected: dsh: profile reload requires the root Include entry`) vì `reconcileProfilePatches`
   *   tra WeakMap `bootstrapIncludes` khoá theo ctx LÚC BOOT, mà hồ sơ của ta compose bằng bundle patch.
   *   Danh sách này KHÔNG được nới rộng tuỳ tiện: mỗi tên phải có mục khai báo trong tài liệu (phép (3) đọc
   *   chính tài liệu đó), và ca ĐỐI CHỨNG ÂM bên dưới chứng minh phép kiểm vẫn bắt được tên thừa lạ.
   */
  const SERVICE_EXTRA_METHODS: readonly string[] = ["applyPatches"];
  /** Tài liệu khai báo sai khác có chủ đích — nguồn sự thật của whitelist. */
  const DEVIATION_DOC = join(REPO_ROOT, "docs", "GBH-SAI-KHAC-CO-CHU-DICH.md");

  /**
   * Tên method có ở ta mà KHÔNG có ở bản gốc.
   * @param ours - tên method trên prototype của artefact ta.
   * @param stock - tên method trên prototype của bundle gốc (đọc-chỉ).
   * @returns danh sách tên thừa, đã sắp xếp.
   */
  function extraMethods(ours: readonly string[], stock: readonly string[]): string[] {
    return ours.filter((name) => !stock.includes(name)).sort();
  }

  /**
   * Cắt ĐÚNG mục khai báo của một gói trong tài liệu sai khác (từ marker `<!-- deviation: <gói> -->` tới
   * marker kế tiếp, hoặc hết tệp).
   * @param text - nội dung tài liệu.
   * @param pkg - tên gói cần lấy mục khai báo.
   * @returns văn bản của mục; chuỗi rỗng khi gói chưa được khai.
   */
  function deviationSection(text: string, pkg: string): string {
    const marker = "<!-- deviation: " + pkg + " -->";
    const start = text.indexOf(marker);
    if (start === -1) return "";
    const rest = text.slice(start + marker.length);
    const next = rest.indexOf("<!-- deviation:");
    return next === -1 ? rest : rest.slice(0, next);
  }

  /**
   * Tên trong whitelist mà tài liệu KHÔNG khai (rỗng ⇒ whitelist chỉ chứa các tên đã khai).
   * @param names - whitelist cần đối chiếu.
   * @param section - mục khai báo của gói trong tài liệu.
   * @returns danh sách tên chưa được khai.
   */
  function undeclaredMethods(names: readonly string[], section: string): string[] {
    return names.filter((name) => !section.includes("`" + name + "`"));
  }

  test("bề mặt service: 0 method THIẾU · THỪA đúng whitelist đã khai trong tài liệu sai khác", () => {
    const ours = Object.getOwnPropertyNames(Ours.prototype).sort();
    const stock = Object.getOwnPropertyNames(Stock.prototype).sort();
    // (1) 0 THIẾU — tuyệt đối, KHÔNG whitelist: mọi method của bản gốc phải còn đủ.
    expect(stock.filter((name) => !ours.includes(name))).toEqual([]);
    // (2) THỪA = ĐÚNG whitelist: phát sinh bất kỳ tên thứ hai nào ⇒ ĐỎ.
    expect(extraMethods(ours, stock)).toEqual([...SERVICE_EXTRA_METHODS].sort());
    // (3) Whitelist chỉ được chứa tên ĐÃ KHAI trong tài liệu sai khác — đọc tài liệu THẬT, không tin hằng số.
    const section = deviationSection(readFileSync(DEVIATION_DOC, "utf8"), "@galaxy-blackhole/gbh-hmr");
    expect(section.length).toBeGreaterThan(0);
    expect(undeclaredMethods(SERVICE_EXTRA_METHODS, section)).toEqual([]);
    // (4) Ghép lại phải ra ĐÚNG tập của ta: bản gốc + whitelist, không thừa không thiếu.
    expect(ours).toEqual([...stock, ...SERVICE_EXTRA_METHODS].sort());
  });

  test("ĐỐI CHỨNG ÂM: method thừa NGOÀI whitelist và tên whitelist KHÔNG khai trong tài liệu đều bị BẮT", () => {
    const stock = Object.getOwnPropertyNames(Stock.prototype).sort();
    // Tên lạ lọt vào prototype ⇒ phép (2) bắt.
    expect(extraMethods([...stock, "phuongThucLa"], stock)).toEqual(["phuongThucLa"]);
    // Tên có trong whitelist nhưng tài liệu không khai ⇒ phép (3) bắt.
    const section = deviationSection(readFileSync(DEVIATION_DOC, "utf8"), "@galaxy-blackhole/gbh-hmr");
    expect(undeclaredMethods([...SERVICE_EXTRA_METHODS, "phuongThucLa"], section)).toEqual(["phuongThucLa"]);
  });

  test("artifact không đăng ký id module nào (row host-only, 0 lời gọi __ModuleLoader__)", () => {
    const artifact = readFileSync(OURS_ENTRY, "utf8");
    expect(artifact.match(/id: "@deepseek-ai/g) ?? []).toEqual([]);
    expect(artifact.includes("__ModuleLoader__")).toBe(false);
  });

  test("build.ts nhận outDir qua process.argv[2]", () => {
    const build = readFileSync(join(PKG, "build.ts"), "utf8");
    expect(build.includes("process.argv[2]")).toBe(true);
  });

  test("locale/{en,zh}.json byte-for-byte với bản gốc (luật 000e)", () => {
    for (const language of ["en", "zh"]) {
      const ours = readFileSync(join(PKG, "locale", language + ".json"));
      const stock = readFileSync(join(REPO_ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-hmr", "locale", language + ".json"));
      expect(ours.equals(stock)).toBe(true);
    }
  });
});

describe("B. schema cấu hình — đối chứng TỪNG TRƯỜNG với bản gốc", () => {
  test("mặc định rỗng + mặc định có đè: cùng kết quả", () => {
    expect(Ours.Config({})).toEqual(Stock.Config({}));
    expect(Ours.Config({ debounce: 5, root: [], ignored: ["tmp"] })).toEqual(Stock.Config({ debounce: 5, root: [], ignored: ["tmp"] }));
  });

  test("C6 DANH TÍNH: hai vật thể cấu hình ĐỘC LẬP (sửa vật này không lan sang vật kia)", () => {
    const first = Ours.Config({});
    const second = Ours.Config({});
    expect(first).not.toBe(second);
    expect(first.root).not.toBe(second.root);
    expect(first.ignored).not.toBe(second.ignored);
    first.root.push("them-vao-mot-ben");
    first.ignored.push("cung-the");
    expect(second.root).toEqual(["."]);
    expect(second.ignored).toEqual(["**/node_modules", "**/.*", "cache", "data"]);
    const stockFirst = Stock.Config({});
    const stockSecond = Stock.Config({});
    expect(stockFirst.root).not.toBe(stockSecond.root);
    expect(stockFirst.ignored).not.toBe(stockSecond.ignored);
  });
});

describe("C. ModuleFiles — danh tính tệp trên đĩa", () => {
  test("observe → sạch; ghi thêm → CŨ; refresh → sạch; xoá tệp → CŨ và seen undefined", async () => {
    const dir = tempDir();
    const file = join(dir, "module.js");
    await writeFile(file, "export const a = 1;\n");
    const url = pathToFileURL(file).href;
    const files = new ModuleFiles();
    files.observe([url]);
    expect([...files.compare([url]).stale]).toEqual([]);
    await writeFile(file, "export const a = 2;\nexport const b = 3;\n");
    expect([...files.compare([url]).stale]).toEqual([url]);
    files.refresh([url]);
    expect([...files.compare([url]).stale]).toEqual([]);
    await unlink(file);
    const afterDelete = files.compare([url]);
    expect([...afterDelete.stale]).toEqual([url]);
    expect(afterDelete.seen.get(url)).toBe(undefined);
  });

  test("now() đọc đồng hồ của hệ thống tệp (không lệch quá một giây so với Date.now)", () => {
    const files = new ModuleFiles();
    expect(Math.abs(files.now() - Date.now())).toBeLessThan(1000);
  });
});

describe("D. watchConfig — theo dõi một tệp patch", () => {
  test("phát refresh khi tệp đổi; đăng ký trùng NÉM; dispose ngừng theo dõi", async () => {
    const dir = tempDir();
    const patch = join(dir, "app.patch.yml");
    await writeFile(patch, "patch: 1\n");
    const ctx = fakeContext();
    let refreshed = 0;
    const options = { awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } } as any;
    const dispose = await watchConfig(ctx, patch, options, async () => {
      refreshed += 1;
    });
    await writeFile(patch, "patch: 2\n");
    await waitFor(() => refreshed > 0);
    await expect(watchConfig(ctx, patch, options, async () => {})).rejects.toThrow("config path already registered: " + patch);
    await dispose();
    const before = refreshed;
    await writeFile(patch, "patch: 3\n");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(refreshed).toBe(before);
  }, 20000);

  test("lỗi của refresh KHÔNG làm chết watcher (ghi cảnh báo rồi theo dõi tiếp)", async () => {
    const dir = tempDir();
    const patch = join(dir, "broken.patch.yml");
    await writeFile(patch, "patch: 1\n");
    const ctx = fakeContext();
    let attempts = 0;
    const options = { awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 } } as any;
    const dispose = await watchConfig(ctx, patch, options, async () => {
      attempts += 1;
      throw new Error("refresh hỏng có chủ ý");
    });
    await writeFile(patch, "patch: 2\n");
    await waitFor(() => attempts > 0 && ctx.warnings.length > 0);
    await dispose();
    expect(ctx.warnings.length).toBeGreaterThan(0);
  }, 20000);
});

describe("E. runExclusive — tuần tự hoá giao dịch", () => {
  /**
   * Dựng một thực thể HMR tối thiểu (nguyên mẫu THẬT của artifact, chỉ cấy các trường hàng đợi).
   * @returns Thực thể dùng được cho runExclusive.
   */
  function makeQueue(): any {
    const instance = Object.create(Ours.prototype);
    instance.operations = Promise.resolve();
    instance.executing = new AsyncLocalStorage();
    instance.closing = false;
    return instance;
  }

  test("hai giao dịch chạy TUẦN TỰ (không chồng lấn)", async () => {
    const queue = makeQueue();
    const trace: string[] = [];
    const first = queue.runExclusive(async () => {
      trace.push("a-start");
      await new Promise((resolve) => setTimeout(resolve, 30));
      trace.push("a-end");
    });
    const second = queue.runExclusive(async () => {
      trace.push("b-start");
      trace.push("b-end");
    });
    await Promise.all([first, second]);
    expect(trace).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  test("giao dịch LỒNG nhau bị từ chối với đúng thông điệp của bản gốc", async () => {
    const queue = makeQueue();
    const nested = queue.runExclusive(async () => queue.runExclusive(async () => {}));
    await expect(nested).rejects.toThrow("HMR transactions cannot be nested");
  });

  test("sau khi dispose thì giao dịch mới bị từ chối", async () => {
    const queue = makeQueue();
    queue.closing = true;
    await expect(queue.runExclusive(async () => {})).rejects.toThrow("HMR is disposed");
  });
});

describe("F. bộ khớp glob thay picomatch — đối chứng với CHÍNH picomatch của gói gốc", () => {
  test("cùng kết quả trên bảng đường dẫn của bốn mẫu mặc định", () => {
    const patterns = ["**/node_modules", "**/.*", "cache", "data"];
    const oracle = picomatch(patterns);
    const ours = globMatcher(patterns);
    const paths = [
      "node_modules",
      "a/node_modules",
      "a/node_modules/x/index.js",
      "src/index.ts",
      ".git",
      "a/.env",
      "cache",
      "data",
      "src/cache",
      "a/cache/b",
      "x/data/y",
      "package.json",
    ];
    const differences: [string, boolean, boolean][] = [];
    for (const path of paths) {
      const expected = oracle(path);
      const actual = ours(path);
      if (expected !== actual) differences.push([path, expected, actual]);
    }
    expect(differences).toEqual([]);
  });
});

describe("G. khai peer — gbh.peers ⊆ peerDependencies (kèm ĐỐI CHỨNG ÂM)", () => {
  /** package.json của gói ta. */
  const meta = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8"));

  /**
   * Phép kiểm quy ước: phần tử của `gbh.peers` phải nằm trong `peerDependencies` (so PHẦN TỬ, không so số lượng).
   * @param gbhPeers - danh sách peer khai trong metadata.
   * @param peerDependencies - khoá của khối peerDependencies.
   * @returns Danh sách peer THIẾU (rỗng = đạt).
   */
  function missingPeers(gbhPeers: string[], peerDependencies: Record<string, string>): string[] {
    const declared = new Set(Object.keys(peerDependencies));
    return gbhPeers.filter((peer) => !declared.has(peer)).sort();
  }

  test("gói ta: mọi peer trong gbh.peers đều có trong peerDependencies", () => {
    expect(missingPeers(meta.gbh.peers, meta.peerDependencies)).toEqual([]);
    expect(meta.gbh.peers.length).toBeGreaterThan(0);
  });

  test("ĐỐI CHỨNG ÂM: peer ngoài peerDependencies bị phép kiểm BẮT (phép kiểm có răng)", () => {
    const mutated = { ...meta.peerDependencies };
    delete mutated["@deepseek-ai/dsh-app-boot"];
    expect(missingPeers(meta.gbh.peers, mutated)).toEqual(["@deepseek-ai/dsh-app-boot"]);
  });

  test("peer KHÔNG nằm trong dependencies (một thể hiện do kernel cấp)", () => {
    const dependencies = meta.dependencies ?? {};
    expect(meta.gbh.peers.filter((peer: string) => peer in dependencies)).toEqual([]);
  });

  test("CANH: gbh.row trỏ ĐÚNG row `hmr` và ĐÚNG file test này (Lead khai — không phải tác giả)", () => {
    expect(meta.gbh.row.id).toBe("hmr");
    expect(meta.gbh.row.tests).toEqual(["tests/host/hmr.test.ts"]);
  });
});
