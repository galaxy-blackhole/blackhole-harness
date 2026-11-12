/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-web-startup: mỗi ca chạy CẢ HAI bản cài (ta và chính
 *      bundle gốc @deepseek-ai/dsh-web-app/startup) trên cùng một context giả rồi so từng giá trị;
 *      cộng ca tập export đo trên ARTIFACT, ca gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, và ca C6
 *      (vật thể cấp cho service phải ĐỘC LẬP giữa hai lần cài — kiểm bằng DANH TÍNH).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as ours from "../../packages/host/web-startup/src/index.ts";
import { parsePublicUrl } from "../../packages/host/web-startup/src/public-url.ts";
import { buildPackage } from "../../packages/host/web-startup/build.ts";
import { brandNeutral } from "../lib/brand-neutral.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "web-startup");
/** Thư mục bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-app");
/** Nửa host của row gốc: đúng tệp mà row `web-startup` trỏ tới. */
const STOCK = join(STOCK_DIR, "lib", "startup.js");

/** Hình dạng module mà hai bản phải cùng phơi ra. */
interface StartupModule {
  /** Tên plugin cordis ổn định. */
  readonly name: string;
  /** Service phải có trước khi giải cờ. */
  readonly inject: string[];
  /** Tên service được cấp. */
  readonly WEB_STARTUP_SERVICE: string;
  /** Hàm cài plugin. */
  readonly apply: (ctx: never) => void;
}

/** Bundle gốc nạp bằng đường dẫn tuyệt đối (CHỈ ĐỌC). */
const stock = (await import(pathToFileURL(STOCK).href)) as StartupModule;

/** Tên tệp chunk `public-url` của bundle gốc — tên CÓ HASH nên dò theo tiền tố, không viết cứng. */
const PUBLIC_URL_CHUNK = readdirSync(join(STOCK_DIR, "lib")).find((entry) => entry.startsWith("public-url-")) ?? "";

/** Chunk gốc chứa `parsePublicUrl` (CHỈ ĐỌC) — oracle cho phép so chuỗi lỗi từng ca. */
const stockPublicUrl = (await import(pathToFileURL(join(STOCK_DIR, "lib", PUBLIC_URL_CHUNK)).href)) as {
  t: (value: string, label?: string) => URL;
};

/**
 * Liệt kê tên export của một file ESM đã build (dùng đúng hai regex của `check:rows`).
 * Nhận: nội dung file.
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const block of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (block[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Context giả tối thiểu — đúng những gì `apply` và `parseCmdline` đọc, KHÔNG rộng hơn. */
interface Harness {
  /** Service đã được cấp trong lượt chạy. */
  readonly provided: Map<string, unknown>;
  /** Mã thoát mà launcher được yêu cầu. */
  readonly exits: number[];
  /** Context đưa cho `apply`. */
  readonly ctx: { provide(name: string, value?: unknown): void; get(name: string): unknown };
}

/**
 * Dựng một context giả cho MỘT lượt gọi: `cmdlineArgs` bất biến + `appExit` ghi lại mã thoát.
 * Nhận: mảng đối số của lượt gọi.
 * Trả: harness với bản đồ service và nhật ký thoát.
 */
function harness(argv: string[]): Harness {
  const provided = new Map<string, unknown>();
  const exits: number[] = [];
  const services = new Map<string, unknown>([
    ["cmdlineArgs", { get: () => [...argv] }],
    ["appExit", (code: number) => void exits.push(code)],
  ]);
  const ctx = {
    provide(name: string, value?: unknown): void {
      provided.set(name, value);
    },
    get(name: string): unknown {
      return services.get(name);
    },
  };
  return { provided, exits, ctx };
}

/**
 * Bắt văn bản commander ghi ra hai luồng chuẩn.
 *
 * Vì sao bắt ở `process.stdout/stderr`: `parseCmdline` của kernel bọc `configureOutput` thành
 * `internals.stdout.write`, và `internals.stdout` CHÍNH LÀ `process.stdout` (đo được), nên thay
 * phương thức ở đây bắt được cả hai bản cài dù chúng nạp hai thể hiện `dsh-cmdline` khác nhau.
 * @param fn - việc cần chạy trong lúc hai luồng bị bắt.
 * @returns văn bản đã ghi ra stdout và stderr.
 */
function capture(fn: () => void): { out: string; err: string } {
  let out = "";
  let err = "";
  const originalOut = process.stdout.write.bind(process.stdout);
  const originalErr = process.stderr.write.bind(process.stderr);
  (process.stdout as unknown as { write: (chunk: string) => boolean }).write = (chunk: string): boolean => {
    out += String(chunk);
    return true;
  };
  (process.stderr as unknown as { write: (chunk: string) => boolean }).write = (chunk: string): boolean => {
    err += String(chunk);
    return true;
  };
  try {
    fn();
  } finally {
    (process.stdout as unknown as { write: typeof originalOut }).write = originalOut;
    (process.stderr as unknown as { write: typeof originalErr }).write = originalErr;
  }
  return { out, err };
}

/** Kết quả đo được của một lượt cài. */
interface RunResult {
  /** Giá trị service `webStartup` được cấp (null khi không cấp gì). */
  readonly value: unknown;
  /** Các service đã cấp ngoài `webStartup` (phải rỗng ở mọi ca). */
  readonly otherProvided: string[];
  /** Mã thoát đã yêu cầu. */
  readonly exits: number[];
  /** Văn bản stdout. */
  readonly out: string;
  /** Văn bản stderr. */
  readonly err: string;
}

/**
 * Cài một bản plugin trên harness mới rồi ghi lại toàn bộ kết quả đo được.
 * Nhận: hàm `apply` của bản cần đo + mảng đối số.
 * Trả: giá trị service, các service khác, mã thoát và hai luồng văn bản.
 */
function run(applyFn: (ctx: never) => void, argv: string[]): RunResult {
  const h = harness(argv);
  const io = capture(() => applyFn(h.ctx as never));
  return {
    value: h.provided.get("webStartup") ?? null,
    otherProvided: [...h.provided.keys()].filter((key) => key !== "webStartup"),
    exits: h.exits,
    out: io.out,
    err: io.err,
  };
}

/**
 * Chạy CẢ HAI bản cài với cùng đối số và khẳng định bốn số đo bằng nhau.
 * Nhận: mảng đối số.
 * Trả: kết quả đo của bản GỐC (dùng cho khẳng định giá trị tuyệt đối).
 */
function both(argv: string[]): RunResult {
  const theirs = run(stock.apply, argv);
  const mine = run(ours.apply as unknown as (ctx: never) => void, argv);
  expect(mine.value).toEqual(theirs.value);
  expect(mine.otherProvided).toEqual(theirs.otherProvided);
  expect(mine.exits).toEqual(theirs.exits);
  // Văn bản trợ giúp in tên sản phẩm; ta đổi tên sản phẩm CÓ Ý (task-17/N2) ⇒ chuẩn hoá nhãn trước khi so byte.
  expect(brandNeutral(mine.out)).toBe(theirs.out);
  expect(brandNeutral(mine.err)).toBe(theirs.err);
  return theirs;
}



describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(join(PKG, "lib"));
    const text = readFileSync(artifact, "utf8");
    const mine = exportNames(text);
    const theirs = exportNames(readFileSync(STOCK, "utf8"));
    expect(mine).toEqual(theirs);
    expect(mine).toEqual(["WEB_STARTUP_SERVICE", "apply", "inject", "name"]);
    expect(mine).not.toContain("default");
    // Đo THÊM ở tầng chạy: export kiểu (interface) phải bị XOÁ, không thành export thật.
    const runtime = Object.keys((await import(pathToFileURL(artifact).href)) as object).sort();
    expect(runtime).toEqual(theirs);
    expect(runtime).not.toContain("WebStartupValues");
    // Row HOST-ONLY: bundle KHÔNG được tự khai id module nào (đúng lệnh nghiệm thu của M6).
    expect(text.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    expect(text).not.toContain("__ModuleLoader__");
  });

  test("name · inject · WEB_STARTUP_SERVICE khớp bản gốc từng chữ", () => {
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("web-startup");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["cmdlineArgs"]);
    expect(ours.WEB_STARTUP_SERVICE).toBe(stock.WEB_STARTUP_SERVICE);
    expect(ours.WEB_STARTUP_SERVICE).toBe("webStartup");
  });
});

describe("hành vi: cùng đối số ⇒ cùng service cấp cho kernel", () => {
  test("cờ mặc định: chỉ openBrowser + trustedHosts (host/port phải VẮNG MẶT)", () => {
    const theirs = both([]);
    expect(theirs.value).toEqual({ openBrowser: true, trustedHosts: [] });
    expect(theirs.exits).toEqual([]);
    expect(Object.keys(theirs.value as object)).toEqual(["openBrowser", "trustedHosts"]);
  });

  test("đủ bốn cờ: host · port · hai trusted-host · no-open", () => {
    const argv = ["--host", "127.0.0.1", "--port", "8080", "--no-open", "--trusted-host", "lab.test", "--trusted-host", "lab.test:5460"];
    const theirs = both(argv);
    expect(theirs.value).toEqual({ openBrowser: false, host: "127.0.0.1", port: 8080, trustedHosts: ["lab.test", "lab.test:5460"] });
    expect(theirs.exits).toEqual([]);
  });

  test("--port 0 hợp lệ (OS tự chọn cổng) và vẫn là số 0, không bị thay bằng mặc định", () => {
    const theirs = both(["--port", "0"]);
    expect(theirs.value).toEqual({ openBrowser: true, port: 0, trustedHosts: [] });
  });

  test("--help in NGUYÊN VĂN văn bản trợ giúp gốc, thoát 0, KHÔNG cấp service", () => {
    const theirs = both(["--help"]);
    expect(theirs.value).toBeNull();
    expect(theirs.exits).toEqual([0]);
    // `theirs` là đầu ra của bundle GỐC ⇒ câu trợ giúp ở đây vẫn mang nhãn gốc (oracle).
    expect(theirs.out).toContain("Serve the DeepSeek Harness browser UI.");
    expect(theirs.out).toContain("--trusted-host <authority...>");
    expect(theirs.out).toContain("serve on another port");
  });

  test("đường lỗi: --host 0.0.0.0 · --port không phải số · cờ lạ ⇒ thoát 1, không cấp gì", () => {
    // `::` và dạng IPv4-mapped của 0.0.0.0 cũng là "mọi giao diện" — phép kiểm dùng isWildcardHost của kernel.
    for (const argv of [
      ["--host", "0.0.0.0"],
      ["--host", "::"],
      ["--host", "::ffff:0.0.0.0"],
      ["--port", "abc"],
      ["--port", "80x"],
      ["--tls-cert", "./a.pem"],
      ["--tls-key", "./a.key"],
      ["--khong-co-co"],
    ]) {
      const theirs = both(argv);
      expect(theirs.value).toBeNull();
      expect(theirs.exits).toEqual([1]);
      expect(theirs.err).not.toBe("");
    }
  });

  test("TLS: nêu ĐỦ cặp ⇒ cấp tls{certFile,keyFile}; nêu MỘT NỬA ⇒ lỗi cách dùng, không cấp gì", () => {
    const ok = both(["--tls-cert", "./server-chain.pem", "--tls-key", "./server-key.pem"]);
    expect(ok.value).toEqual({ openBrowser: true, trustedHosts: [], tls: { certFile: "./server-chain.pem", keyFile: "./server-key.pem" } });
    expect(ok.exits).toEqual([]);
  });

  test("--public-url: giá trị công bố là CHUỖI THÔ (kiểm chỉ để từ chối, không chuẩn hoá)", () => {
    const theirs = both(["--public-url", "https://app.example/ui", "--trusted-host", "app.example"]);
    expect(theirs.value).toEqual({ openBrowser: true, publicUrl: "https://app.example/ui", trustedHosts: ["app.example"] });
  });

  test("thứ tự khoá của vật thể cấp cho service khớp bản gốc (host/port/publicUrl/tls chèn đúng chỗ)", () => {
    const argv = ["--host", "127.0.0.1", "--port", "0", "--public-url", "https://app.example/ui", "--trusted-host", "app.example", "--tls-cert", "./c.pem", "--tls-key", "./k.pem"];
    const theirs = both(argv);
    const mine = run(ours.apply as unknown as (ctx: never) => void, argv).value as object;
    expect(Object.keys(mine)).toEqual(Object.keys(theirs.value as object));
    expect(Object.keys(mine)).toEqual(["openBrowser", "host", "port", "publicUrl", "tls", "trustedHosts"]);
  });

  test("một tiến trình parse NHIỀU lần: mỗi lượt một program MỚI (không rò trạng thái)", () => {
    const measure = (applyFn: (ctx: never) => void): [unknown, unknown] => {
      const first = run(applyFn, ["--port", "5000"]);
      const second = run(applyFn, ["--port", "6000"]);
      return [first.value, second.value];
    };
    const mine = measure(ours.apply as unknown as (ctx: never) => void);
    const theirs = measure(stock.apply);
    expect(mine).toEqual(theirs);
    expect(mine).toEqual([
      { openBrowser: true, port: 5000, trustedHosts: [] },
      { openBrowser: true, port: 6000, trustedHosts: [] },
    ]);
  });
});

describe("public-url: đối chứng với CHÍNH chunk của bundle gốc", () => {
  /** Ma trận giá trị: hợp lệ (nhiều dạng) + mỗi lớp lỗi một ca. */
  const VALUES = [
    "https://app.example/ui/",
    "https://app.example/ui",
    "http://127.0.0.1:8080",
    "HTTPS://APP.EXAMPLE/UI",
    "https://app.example",
    "ftp://app.example/",
    "app.example/ui",
    "https://user:pw@app.example/",
    "https://@app.example/",
    "https:///ui",
    "https://app.example/ui?x=1",
    "https://app.example/ui#frag",
    "https://app.example/a b",
    "https://app.example/\u0001",
  ];

  test("cùng chuỗi ⇒ cùng URL đã chuẩn hoá, hoặc cùng THÔNG ĐIỆP lỗi (từng ca)", () => {
    const measure = (fn: (value: string, label?: string) => URL, value: string): { href: string } | { err: string } => {
      try {
        return { href: fn(value, "--public-url").href };
      } catch (error) {
        return { err: (error as Error).message };
      }
    };
    for (const value of VALUES) expect(measure(parsePublicUrl, value)).toEqual(measure(stockPublicUrl.t, value));
    // Chốt thêm giá trị tuyệt đối cho ba ca đại diện (để ca không "xanh rỗng" khi cả hai cùng sai).
    expect(measure(parsePublicUrl, "https://app.example/ui")).toEqual({ href: "https://app.example/ui/" });
    expect(measure(parsePublicUrl, "https://user:pw@app.example/")).toEqual({
      err: "--public-url must not include credentials (a username or password before @, including an empty user)",
    });
    expect(measure(parsePublicUrl, "https://app.example/ui?x=1")).toEqual({ err: "--public-url must not include a query or fragment (? or #)" });
  });
});

describe("C6 — vật thể cấp cho service ĐỘC LẬP giữa hai lần cài (kiểm bằng DANH TÍNH)", () => {
  test("hai lần cài ⇒ hai vật thể riêng; sửa trustedHosts của bản này KHÔNG lan sang bản kia", () => {
    const measure = (applyFn: (ctx: never) => void): { sameValue: boolean; sameArray: boolean; leaked: boolean } => {
      const first = run(applyFn, ["--trusted-host", "a.test"]).value as { trustedHosts: string[] };
      const second = run(applyFn, ["--trusted-host", "b.test"]).value as { trustedHosts: string[] };
      first.trustedHosts.push("mutated.test");
      return { sameValue: first === second, sameArray: first.trustedHosts === second.trustedHosts, leaked: second.trustedHosts.includes("mutated.test") };
    };
    const mine = measure(ours.apply as unknown as (ctx: never) => void);
    expect(mine).toEqual(measure(stock.apply));
    expect(mine).toEqual({ sameValue: false, sameArray: false, leaked: false });
  });

  test("cờ mặc định: mảng trustedHosts RỖNG cũng phải là vật thể mới, không dùng chung hằng", () => {
    const measure = (applyFn: (ctx: never) => void): { sameArray: boolean; leaked: boolean } => {
      const first = run(applyFn, []).value as { trustedHosts: string[] };
      const second = run(applyFn, []).value as { trustedHosts: string[] };
      first.trustedHosts.push("mutated.test");
      return { sameArray: first.trustedHosts === second.trustedHosts, leaked: second.trustedHosts.length > 0 };
    };
    const mine = measure(ours.apply as unknown as (ctx: never) => void);
    expect(mine).toEqual(measure(stock.apply));
    expect(mine).toEqual({ sameArray: false, leaked: false });
  });
});

/** Một manifest package.json như phép kiểm §1d cần. */
interface PeerManifest {
  /** Tên package. */
  name: string;
  /** Metadata của ta. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Bản đồ subpath xuất ra của gói. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
}

/**
 * Phép kiểm luật M6 §1d: `gbh.peers` phải là TẬP CON của `peerDependencies`, so PHẦN TỬ.
 * Nhận: một manifest đọc từ package.json.
 * Trả: các tên peer nằm trong gbh.peers mà KHÔNG có trong peerDependencies (rỗng = đạt).
 */
function missingPeers(manifest: PeerManifest): string[] {
  const peers = manifest.gbh?.peers ?? [];
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return peers.filter((peer) => !declared.has(peer)).sort();
}

/** Đọc package.json của chính gói này. */
function manifest(): PeerManifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PeerManifest;
}

describe("metadata + luật gói", () => {
  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ) và mọi peer có phiên bản thật", () => {
    const json = manifest();
    expect(json.gbh?.peers).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/dsh-cmdline", "@deepseek-ai/dsh-host-webserver", "commander"]);
    expect(missingPeers(json)).toEqual([]);
    for (const peer of json.gbh?.peers ?? []) expect(typeof json.peerDependencies?.[peer]).toBe("string");
  });

  test("ĐỐI CHỨNG ÂM: thiếu tên trong peerDependencies thì phép kiểm PHẢI bắt được", () => {
    const broken: PeerManifest = {
      name: "x",
      gbh: { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] },
      peerDependencies: { "@deepseek-ai/cordis": "1" },
    };
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Cùng số lượng nhưng lệch phần tử vẫn phải ĐỎ (phép kiểm so số lượng là verdict RỖNG).
    const sameCount: PeerManifest = {
      name: "y",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/b"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/c": "1" },
    };
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/b"]);
  });

  test("luật 000e: locale/en.json + locale/zh.json CHÉP BYTE-FOR-BYTE namespace `startup` của bản gốc", () => {
    for (const file of ["en", "zh"]) {
      const mine = readFileSync(join(PKG, "locale", file + ".json"));
      const theirs = readFileSync(join(STOCK_DIR, "locale", "startup", file + ".json"));
      expect(mine.equals(theirs)).toBe(true);
    }
    // Row là SUBPATH `…/startup` ⇒ namespace locale của nó nằm ở `locale/startup/` trong gói gốc.
    // Bản ta KHÔNG có subpath, nên tệp phải nằm ngay `locale/` để loader đọc ra CÙNG tiêu đề.
    const en = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta: { title: string } };
    const zh = JSON.parse(readFileSync(join(PKG, "locale", "zh.json"), "utf8")) as { meta: { title: string } };
    expect(en.meta.title).toBe("web-app/startup");
    expect(zh.meta.title).toBe("Web 启动配置");
    expect(manifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });

  });
