/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-plugin-market (slice worker parser): dựng lib/worker.js của ta bằng
 *      build.ts ra thư mục tạm, rồi chạy CẢ worker của ta và worker.cjs gốc của @deepseek-ai/dsh-plugin-market với
 *      ĐÚNG cùng workerData, so sâu message/error ở các ca: index format 1 hợp lệ (tối thiểu + đầy đủ), body không
 *      phải UTF-8 hợp lệ, JSON hỏng, JSON đúng nhưng sai schema format, và workerData malformed. Schema format 1
 *      được tự dò bằng parseMarketIndex gốc (oracle), không chép tay luật.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta — slice worker parser. */
const PKG = join(REPO, "packages", "host", "plugin-market");
/** build.ts của gói; import ĐỘNG vì subagent khác có thể còn đang ghi tệp này. */
const BUILD_SPECIFIER = "../../packages/host/plugin-market/build.ts";
/** Worker CJS của bản gốc — oracle A/B, chỉ đọc. */
const STOCK_WORKER = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-plugin-market", "lib", "worker.cjs");
/** Validator format 1 của bản gốc — oracle schema mà fixture phải khớp. */
const STOCK_INDEX = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-plugin-market-index", "lib", "index.js");
/** URL giả: worker chỉ dùng làm gốc phân giải icon tương đối, KHÔNG hề gọi mạng. */
const INDEX_URL = "https://market.example.test/plugins/index.json";
/** Thời gian chờ build.ts xuất hiện (subagent dựng gói chạy song song), tối đa ~2 phút. */
const PREPARE_BUDGET_MS = 120_000;
/** Thời gian thử lại build sau khi đã thấy build.ts (src có thể còn đang được ghi). */
const BUILD_RETRY_MS = 20_000;
/** Hạn chờ message đầu tiên của MỖI worker. */
const WORKER_TIMEOUT_MS = 5_000;

/** Một phiên bản plugin đã validate; chỉ giữ trường test khẳng định. */
interface ParsedVersion {
  /** SemVer chính xác. */
  version: string;
}

/** Một plugin đã validate; chỉ giữ trường test khẳng định. */
interface ParsedPlugin {
  /** Tên package npm. */
  name: string;
  /** Tiêu đề đã bản địa hoá (chuỗi hoặc bản đồ ngôn ngữ). */
  title?: unknown;
  /** URL icon đã phân giải tuyệt đối. */
  icon?: string;
  /** Các phiên bản, đã sắp giảm dần theo SemVer. */
  versions: ParsedVersion[];
}

/** Message worker post về (kết quả parseIndexBody); hình dạng tối thiểu để khẳng định tính hữu ích. */
interface ParsedIndexMessage {
  /** true khi index hợp lệ. */
  ok: boolean;
  /** Index đã validate khi ok. */
  index?: {
    /** Luôn là 1 với index hợp lệ. */
    format: number;
    /** Tiêu đề đã bản địa hoá. */
    title: unknown;
    /** Nhóm metadata đã điền mặc định. */
    metadata: Record<string, unknown>;
    /** Danh sách plugin đã validate. */
    plugins: ParsedPlugin[];
  };
  /** JSON path của vi phạm đầu tiên khi !ok. */
  path?: string;
  /** Luật bị vi phạm khi !ok. */
  reason?: string;
  /** Chẩn đoán đầy đủ khi !ok. */
  message?: string;
}

/** Kết quả MỘT lượt chạy worker: message đầu tiên, lỗi, thoát, hoặc quá hạn 5s. */
type WorkerOutcome =
  | { kind: "message"; message: ParsedIndexMessage }
  | { kind: "error"; name: string; message: string }
  | { kind: "exit"; code: number }
  | { kind: "timeout" };

/** Hàm build của gói: nhận thư mục đích, trả đường dẫn đã build (hoặc giá trị bất kỳ). */
type Builder = (outDir?: string) => Promise<unknown>;

/** Index đã validate — cùng hình dạng với trường index trong message worker. */
type ParsedIndex = NonNullable<ParsedIndexMessage["index"]>;

/** Validator format 1 của bản gốc, nạp động để không chép luật schema vào test. */
const { parseMarketIndex } = (await import(STOCK_INDEX)) as {
  parseMarketIndex: (value: unknown, indexUrl: string) => ParsedIndex;
};

/**
 * Chờ một số mili giây.
 * Nhận: số mili giây.
 * Trả: Promise hoàn tất sau khoảng thời gian đó.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Thư mục tạm của hệ, KHÔNG import node:os (luật test chỉ cho bun:test + worker_threads/fs/path/url).
 * Nhận: không.
 * Trả: đường dẫn thư mục tạm.
 */
function tempRoot(): string {
  return process.env.TMPDIR ?? process.env.TMP ?? "/tmp";
}

/**
 * Mô tả một lỗi đã bắt thành chuỗi ngắn gọn.
 * Nhận: giá trị đã ném.
 * Trả: thông điệp của Error, hoặc String(value).
 */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Chờ một tệp do TIẾN TRÌNH KHÁC ghi xuất hiện và ổn định kích thước (hai lần đo cách nhau 300ms).
 * Nhận: đường dẫn tuyệt đối + hạn chót (epoch ms).
 * Trả: true nếu tệp tồn tại và ổn định trước hạn; false nếu hết hạn.
 */
async function waitForStableFile(file: string, deadline: number): Promise<boolean> {
  let lastSize = -1;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const { size } = statSync(file);
      if (size > 0 && size === lastSize) return true;
      lastSize = size;
    } else {
      lastSize = -1;
    }
    await delay(300);
  }
  return existsSync(file);
}

/**
 * Nạp build.ts của gói (chờ tối đa ~2 phút nếu subagent dựng gói chưa ghi xong) và chọn hàm build.
 * Nhận: hạn chót (epoch ms).
 * Trả: hàm build của gói.
 * @throws {Error} khi build.ts không xuất hiện đúng hạn hoặc không export hàm build nào.
 */
async function loadBuilder(deadline: number): Promise<Builder> {
  const buildFile = join(PKG, "build.ts");
  if (!(await waitForStableFile(buildFile, deadline))) {
    throw new Error("chưa thấy " + buildFile + " sau " + String(PREPARE_BUDGET_MS / 1000) + "s — subagent dựng gói chưa xong?");
  }
  // Hợp đồng build của repo là buildPackage; gói này hiện export buildWorker (đã báo Lead), nên nhận cả hai.
  const module = (await import(BUILD_SPECIFIER)) as { buildPackage?: Builder; buildWorker?: Builder };
  const builder = module.buildPackage ?? module.buildWorker;
  if (typeof builder !== "function") throw new Error(buildFile + " không export buildPackage/buildWorker");
  return builder;
}

/**
 * Trỏ node_modules có @deepseek-ai/dsh-plugin-market-index vào thư mục build tạm: worker.js giữ dep ngoài
 * (packages: external), đúng như khi app chạy worker cạnh profile đã cài dep. Ưu tiên node_modules của package,
 * lùi về apps/host/node_modules khi package chưa cài dep.
 * Nhận: thư mục build tạm.
 * Trả: không.
 */
function linkPackageModules(outDir: string): void {
  const modules = [join(PKG, "node_modules"), join(REPO, "apps", "host", "node_modules")].find((dir) =>
    existsSync(join(dir, "@deepseek-ai", "dsh-plugin-market-index")),
  );
  const link = join(outDir, "node_modules");
  if (modules === undefined || existsSync(link)) return;
  symlinkSync(modules, link, "dir");
}

/**
 * Tên tệp có phải worker đã build (worker.js / worker.cjs / worker.mjs) hay không.
 * Nhận: tên tệp.
 * Trả: true nếu khớp.
 */
function isWorkerName(name: string): boolean {
  return name.startsWith("worker.") && name.endsWith(".js");
}

/**
 * Tìm worker đã build trong thư mục đích (BFS — ưu tiên nông nhất, bỏ qua node_modules).
 * Nhận: thư mục gốc + gợi ý đường dẫn do hàm build trả về.
 * Trả: đường dẫn worker.js, hoặc null nếu không có.
 */
function findWorkerFile(root: string, hint?: unknown): string | null {
  if (typeof hint === "string" && isWorkerName(basename(hint)) && existsSync(hint)) return hint;
  const queue: string[] = [root];
  while (queue.length > 0) {
    const dir = queue.shift();
    if (dir === undefined) break;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") queue.push(path);
      } else if (entry.isFile() && isWorkerName(entry.name)) {
        return path;
      }
    }
  }
  return null;
}

/**
 * Dựng worker của ta ra MỘT thư mục tạm mới (mkdtemp), thử lại ngắn nếu src còn đang được ghi.
 * Nhận: không.
 * Trả: đường dẫn worker.js đã build + thư mục tạm để dọn.
 * @throws {Error} khi hết hạn chờ hoặc build không sinh ra worker.js.
 */
async function buildOurs(): Promise<{ workerFile: string; outDir: string }> {
  const builder = await loadBuilder(Date.now() + PREPARE_BUDGET_MS);
  const buildDeadline = Date.now() + BUILD_RETRY_MS;
  let lastError: unknown = null;
  while (Date.now() < buildDeadline) {
    const outDir = mkdtempSync(join(tempRoot(), "gbh-pm-worker-"));
    try {
      const built = await builder(outDir);
      linkPackageModules(outDir);
      const workerFile = findWorkerFile(outDir, built);
      if (workerFile !== null) return { workerFile, outDir };
      lastError = new Error("build không sinh ra worker.js trong " + outDir);
    } catch (error) {
      lastError = error;
    }
    rmSync(outDir, { recursive: true, force: true });
    await delay(1_000);
  }
  throw new Error("không dựng được worker.js của gói sau " + String(PREPARE_BUDGET_MS / 1000) + "s chờ: " + errorText(lastError));
}

/**
 * Chạy một worker và lấy kết quả ĐẦU TIÊN: message, sự kiện error, thoát, hoặc quá hạn 5s.
 * Nhận: đường dẫn worker + workerData (được structured-clone sang luồng worker).
 * Trả: kết quả chuẩn hoá để so A/B.
 */
async function runWorker(workerFile: string, workerData: unknown): Promise<WorkerOutcome> {
  const worker = new Worker(pathToFileURL(workerFile), { workerData });
  return new Promise<WorkerOutcome>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (outcome: WorkerOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      worker.removeAllListeners();
      void worker.terminate();
      resolve(outcome);
    };
    timer = setTimeout(() => finish({ kind: "timeout" }), WORKER_TIMEOUT_MS);
    worker.on("message", (message: unknown) => finish({ kind: "message", message: message as ParsedIndexMessage }));
    worker.on("error", (error: Error) => finish({ kind: "error", name: error.name, message: error.message }));
    worker.on("exit", (code: number) => finish({ kind: "exit", code }));
  });
}

/**
 * Lấy message worker post về; ném lỗi mô tả kết quả khác để test báo đỏ rõ ràng.
 * Nhận: kết quả một lượt chạy.
 * Trả: message đã post.
 */
function messageOf(outcome: WorkerOutcome): ParsedIndexMessage {
  if (outcome.kind !== "message") throw new Error("worker không post message: " + JSON.stringify(outcome));
  return outcome.message;
}

/**
 * Đường dẫn worker của ta đã build; ném lỗi dựng gói để mọi test đỏ cùng một nguyên nhân rõ ràng.
 * Nhận: không.
 * Trả: đường dẫn worker.js.
 */
function oursWorker(): string {
  if (prepared === null) throw new Error("chưa dựng được worker của gói: " + (prepareError ?? "lý do không rõ"));
  return prepared.workerFile;
}

/**
 * Chạy CẢ worker gốc và worker của ta với ĐÚNG cùng một workerData (mỗi worker nhận bản clone riêng).
 * Nhận: workerData của ca.
 * Trả: hai kết quả để so sâu bằng toEqual.
 */
async function runBoth(workerData: unknown): Promise<{ stock: WorkerOutcome; ours: WorkerOutcome }> {
  const stock = await runWorker(STOCK_WORKER, workerData);
  const ours = await runWorker(oursWorker(), workerData);
  return { stock, ours };
}

/** Index format 1 TỐI THIỂU — hình dạng do parseMarketIndex gốc chấp nhận (test (a) tự kiểm bằng oracle). */
const MINIMAL_INDEX = { format: 1, title: "Test Market", metadata: {}, plugins: [] };

/** Index format 1 ĐẦY ĐỦ hơn: metadata khai báo, icon tương đối, hai nguồn npm/git, versions lệch thứ tự. */
const RICH_INDEX = {
  format: 1,
  title: { en: "Rich Market", vi: "Chợ đầy đủ" },
  description: { en: "Fixture" },
  metadata: {
    categories: { tools: { title: { en: "Tools" } } },
    labels: { fresh: { title: { en: "Fresh" } } },
    sortKeys: { rank: { title: { en: "Rank" }, order: "asc" } },
  },
  plugins: [
    {
      name: "@scope/demo-plugin",
      title: { en: "Demo" },
      description: { en: "Demo plugin" },
      icon: "icon.svg",
      author: "Tester",
      homepage: "https://example.test/home#readme",
      repository: { url: "https://github.com/example/demo", directory: "packages/demo" },
      metadata: { category: "tools", keywords: ["demo"], labels: ["fresh"], sortKeys: { rank: 2 } },
      versions: [
        {
          version: "1.1.0",
          publishTimestamp: 1600000000,
          source: { type: "npm", registry: "https://registry.npmjs.org" },
          engines: { dsh: ">=1.0.0" },
        },
        {
          version: "1.2.0",
          publishTimestamp: 1700000000,
          source: {
            type: "git",
            url: "https://github.com/example/demo",
            commit: "0123456789abcdef0123456789abcdef01234567",
            path: "packages/demo",
          },
        },
      ],
    },
  ],
};

/** Kết quả dựng gói ở cấp module — giữ lỗi lại để test báo đỏ kèm thông điệp thay vì cả tệp không nạp được. */
let prepared: { workerFile: string; outDir: string } | null = null;
/** Lý do dựng gói thất bại (null khi thành công). */
let prepareError: string | null = null;
try {
  prepared = await buildOurs();
} catch (error) {
  prepareError = errorText(error);
}

afterAll(() => {
  if (prepared !== null) rmSync(prepared.outDir, { recursive: true, force: true });
});

describe("plugin-market worker parser — A/B với stock", () => {
  test("dựng được worker.js của ta bằng build.ts ra thư mục tạm", () => {
    expect(prepareError).toBeNull();
    expect(prepared).not.toBeNull();
    if (prepared !== null) {
      expect(basename(prepared.workerFile)).toBe("worker.js");
      expect(existsSync(prepared.workerFile)).toBe(true);
      // Worker đem đo PHẢI là artifact vừa build trong thư mục tạm, không phải bản dựng sẵn hay worker gốc.
      expect(prepared.workerFile.startsWith(prepared.outDir)).toBe(true);
    }
  });

  test("(a) index format 1 tối thiểu hợp lệ: message của ta BẰNG stock và index dùng được", async () => {
    // Tự dò schema format 1 bằng validator GỐC: fixture phải qua parseMarketIndex thì ca mới là "hợp lệ".
    const oracle = parseMarketIndex(MINIMAL_INDEX, INDEX_URL);
    expect(oracle).toEqual({ format: 1, title: "Test Market", metadata: { categories: {}, labels: {}, sortKeys: {} }, plugins: [] });

    const { stock, ours } = await runBoth({ body: Buffer.from(JSON.stringify(MINIMAL_INDEX)), url: INDEX_URL });

    // A/B: CÙNG workerData, so sâu toàn bộ message.
    expect(ours).toEqual(stock);
    expect(ours).toEqual({ kind: "message", message: { ok: true, index: oracle } });

    // Kết quả của ta phải DÙNG ĐƯỢC, không chỉ khớp.
    const message = messageOf(ours);
    expect(message.ok).toBe(true);
    expect(Array.isArray(message.index?.plugins)).toBe(true);
    expect(message.index?.plugins).toEqual([]);
    expect(message.index?.title).toBe("Test Market");
    expect(message.index?.format).toBe(1);
  });

  test("(a2) index format 1 đầy đủ (metadata, icon tương đối, hai nguồn, versions lệch thứ tự): BẰNG stock", async () => {
    const oracle = parseMarketIndex(RICH_INDEX, INDEX_URL);
    const { stock, ours } = await runBoth({ body: Buffer.from(JSON.stringify(RICH_INDEX)), url: INDEX_URL });

    expect(ours).toEqual(stock);
    expect(ours).toEqual({ kind: "message", message: { ok: true, index: oracle } });

    const message = messageOf(ours);
    expect(message.ok).toBe(true);
    expect(Array.isArray(message.index?.plugins)).toBe(true);
    const plugin = message.index?.plugins?.[0];
    expect(plugin?.name).toBe("@scope/demo-plugin");
    // Versions được validator sắp GIẢM dần theo SemVer; icon tương đối phân giải theo URL index.
    expect(plugin?.versions.map((version) => version.version)).toEqual(["1.2.0", "1.1.0"]);
    expect(plugin?.icon).toBe("https://market.example.test/plugins/icon.svg");
    expect(message.index?.title).toEqual({ en: "Rich Market", vi: "Chợ đầy đủ" });
  });

  test("(b) body không phải UTF-8 hợp lệ: message lỗi BẰNG stock", async () => {
    const body = Buffer.from([0xff, 0xfe, 0x80, 0x81]);
    const { stock, ours } = await runBoth({ body, url: INDEX_URL });

    expect(ours).toEqual(stock);
    const message = messageOf(ours);
    expect(message.ok).toBe(false);
    expect(message.path).toBe("$");
    expect(message.reason).toBe("must be UTF-8");
    expect(message.message).toBe("must be UTF-8");
  });

  test("(c) JSON hỏng: message lỗi BẰNG stock", async () => {
    const body = Buffer.from('{"format":1,"title":"Test Market","plugins":[');
    const { stock, ours } = await runBoth({ body, url: INDEX_URL });

    expect(ours).toEqual(stock);
    const message = messageOf(ours);
    expect(message.ok).toBe(false);
    expect(message.path).toBe("$");
    expect(message.reason?.startsWith("must be JSON")).toBe(true);
  });

  test("(d) JSON đúng nhưng SAI schema format: format 2 và thiếu title — BẰNG stock", async () => {
    const wrongFormat = { ...MINIMAL_INDEX, format: 2 };
    const withoutTitle: Record<string, unknown> = { ...MINIMAL_INDEX };
    delete withoutTitle.title;

    // Oracle chứng minh đây là SAI schema thật (validator gốc từ chối cả hai), không phải JSON hỏng.
    expect(() => parseMarketIndex(wrongFormat, INDEX_URL)).toThrow("must be 1");
    expect(() => parseMarketIndex(withoutTitle, INDEX_URL)).toThrow("$.title");

    const formatCase = await runBoth({ body: Buffer.from(JSON.stringify(wrongFormat)), url: INDEX_URL });
    expect(formatCase.ours).toEqual(formatCase.stock);
    expect(formatCase.ours).toEqual({ kind: "message", message: { ok: false, path: "$.format", reason: "must be 1", message: "$.format must be 1" } });

    const titleCase = await runBoth({ body: Buffer.from(JSON.stringify(withoutTitle)), url: INDEX_URL });
    expect(titleCase.ours).toEqual(titleCase.stock);
    const titleMessage = messageOf(titleCase.ours);
    expect(titleMessage.ok).toBe(false);
    expect(titleMessage.path).toBe("$.title");
  });

  test("(e) workerData malformed (body là string / thiếu url): bắt error với thông điệp BẰNG stock", async () => {
    const bodyString = await runBoth({ body: "không phải Uint8Array", url: INDEX_URL });
    expect(bodyString.ours).toEqual(bodyString.stock);
    expect(bodyString.ours).toEqual({ kind: "error", name: "Error", message: "index parser request is malformed" });

    const missingUrl = await runBoth({ body: Buffer.from(JSON.stringify(MINIMAL_INDEX)) });
    expect(missingUrl.ours).toEqual(missingUrl.stock);
    expect(missingUrl.ours).toEqual({ kind: "error", name: "Error", message: "index parser request is malformed" });
  });
});
