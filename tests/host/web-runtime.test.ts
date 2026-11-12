/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-web-runtime — row `web-runtime` (bundle web-app), M6.
 *      Đối chứng TRỰC TIẾP với chính bundle gốc ở apps/host/node_modules mỗi khi kết luận về hành vi.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/web-runtime/build.ts";
import { apply, Config, inject, internals, name } from "../../packages/host/web-runtime/src/index.ts";
import { parsePublicUrl } from "../../packages/host/web-runtime/src/public-url.ts";

/** Ảnh chụp môi trường khởi động giả — CHỈ có `getFrom`, đúng thứ `launchedThroughSsh` đọc. */
interface LaunchEnvironmentStub {
  /**
   * Trả giá trị của một biến trong lớp `process` — hình dạng hẹp hơn module thật, không rộng hơn.
   * @param name - tên biến môi trường.
   * @param sources - các lớp được phép đọc (bản gốc gọi với `["process"]`).
   * @returns mục `{ value }`, hoặc undefined khi biến không có trong lớp được hỏi.
   */
  getFrom(name: string, sources: readonly string[]): { value: string } | undefined;
}

/**
 * Dựng ảnh chụp môi trường khởi động chỉ từ các giá trị cho trước.
 * @param values - biến môi trường của lớp `process`.
 * @returns ảnh chụp mà `launchEnvironmentOf`/`launchedThroughSsh` đọc được.
 */
function launchEnvironment(values: Record<string, string>): LaunchEnvironmentStub {
  return {
    getFrom: (name: string, sources: readonly string[]) => {
      if (!sources.includes("process")) return undefined;
      const value = values[name];
      return value === undefined ? undefined : { value };
    },
  };
}

/** Bundle GỐC của chính row này — mọi kết luận về hành vi đều đối chứng với nó. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-web-app/lib/index.js";

/** Bản gốc đã nạp — dùng làm đối chứng, KHÔNG dùng thay cho code của ta. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: (input: unknown) => { publicUrl?: string };
  apply: (ctx: unknown, config: unknown) => void;
  internals: { resolveDistIndex: () => string };
};

/** Gói của ta — cùng đường dẫn tương đối để test đọc được package.json. */
const PACKAGE_JSON = "../../packages/host/web-runtime/package.json";

/** Một biến đã đăng ký qua seam shellEnv. */
interface ShellEnvRegistration {
  name: string;
  variables: Record<string, { description: string }>;
  resolve: () => Record<string, string>;
}

/** Hai chỗ ghi mà phép đo cần đọc: URL đã ký của seam connection, và các lần đăng ký shellEnv. */
interface InjectionRecord {
  deps: string[];
  shellEnv: ShellEnvRegistration[];
}

/** Bản ghi tác dụng phụ của một lượt `apply`. */
interface CtxRecord {
  provided: { name: string; value: { getAdvertisedUrl(): string } }[];
  plugins: { plugin: unknown; config: { distIndex: string } }[];
  injections: InjectionRecord[];
}

/** Tuỳ chọn dựng context giả — chỉ những trục mà row này thật sự đọc. */
interface CtxOptions {
  host?: string;
  protocol?: "http:" | "https:";
  origin?: string;
  ssh?: boolean;
  connectionPresent?: boolean;
  loader?: { await(): Promise<void> | undefined };
  /** Dùng lại một `root` cho nhiều lượt apply (đo cổng chống in hai lần). */
  root?: object;
}

/**
 * Dựng context giả có ĐÚNG hình dạng seam mà bundle gốc dùng: `webServer`, `provide`, `plugin`,
 * `inject`, `get`, `root`; callback inject nhận context con có `shellEnv` và `connection`.
 * @param options - các trục cần đổi (bind host, protocol, SSH, loader, root).
 * @returns context giả, bản ghi tác dụng phụ, và context con dùng cho callback inject.
 */
function makeCtx(options: CtxOptions = {}): { ctx: unknown; record: CtxRecord; child: unknown } {
  const root = options.root ?? {};
  const record: CtxRecord = { provided: [], plugins: [], injections: [] };
  const webServer = {
    host: options.host ?? "127.0.0.1",
    protocol: options.protocol ?? "http:",
    getOrigin: () => options.origin ?? "http://127.0.0.1:5439",
  };
  const environment = launchEnvironment(options.ssh === true ? { SSH_TTY: "/dev/ttys001" } : {});
  const connection = { authenticatedUrl: (url: string) => url + "?token=T" };
  const services: Record<string, unknown> = {
    launchEnvironment: environment,
    webServer,
    connection: options.connectionPresent === false ? undefined : connection,
    loader: options.loader,
  };
  const shellEnv = {
    register: (registration: ShellEnvRegistration) => {
      const current = record.injections.at(-1);
      if (current !== undefined) current.shellEnv.push(registration);
    },
  };
  const child = { root, get: (service: string) => services[service], shellEnv, connection };
  const ctx = {
    root,
    webServer,
    provide: (service: string, value: { getAdvertisedUrl(): string }) => {
      record.provided.push({ name: service, value });
    },
    plugin: (plugin: unknown, config: { distIndex: string }) => {
      record.plugins.push({ plugin, config });
    },
    inject: (deps: string[], callback: (context: unknown) => void) => {
      const injection: InjectionRecord = { deps, shellEnv: [] };
      record.injections.push(injection);
      callback(child);
    },
    get: (service: string) => services[service],
  };
  return { ctx, record, child };
}

/**
 * Bắt ba kênh console trong lúc chạy một hàm (bản gốc ghi URL bằng console.log, cảnh báo bằng console.warn).
 * @param run - hàm cần chạy trong lúc bắt.
 * @returns nhật ký ba kênh, mỗi kênh là mảng dòng đã nối.
 */
function captureConsole(run: () => void): { log: string[]; warn: string[]; error: string[] } {
  const log: string[] = [];
  const warn: string[] = [];
  const error: string[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...args: unknown[]) => void log.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => void warn.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => void error.push(args.map(String).join(" "));
  try {
    run();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
  return { log, warn, error };
}

/**
 * Chạy `apply` với bộ stub bàn giao trình duyệt để test KHÔNG mở trình duyệt thật.
 * @param run - hàm nhận url mà stub đã nhận.
 * @returns danh sách URL stub đã nhận.
 */
async function withStubbedBrowser(run: () => void): Promise<string[]> {
  const opened: string[] = [];
  const original = internals.openBrowser;
  (internals as { openBrowser: (url: string) => Promise<void> }).openBrowser = async (url: string) => {
    opened.push(url);
  };
  try {
    run();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    (internals as { openBrowser: (url: string) => Promise<void> }).openBrowser = original;
  }
  return opened;
}

/** Tập tên export của một file ESM đã build (cùng hai regex mà cổng dùng). */
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

/**
 * Phần tử của `peers` KHÔNG có trong `peerDeps` — so PHẦN TỬ, không so số lượng (M6-MOUNT-PLAN §1d).
 * @param peers - danh sách `gbh.peers`.
 * @param peerDeps - khoá của `peerDependencies`.
 * @returns các tên còn thiếu, đã sắp xếp.
 */
function missingPeers(peers: string[], peerDeps: string[]): string[] {
  const declared = new Set(peerDeps);
  return peers.filter((peer) => !declared.has(peer)).sort();
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-web-runtime-")));
    const ours = exportNames(readFileSync(artifact, "utf8"));
    const theirs = exportNames(readFileSync(new URL(STOCK, import.meta.url), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["Config", "apply", "inject", "internals", "name"]);
    expect(ours).not.toContain("default");
    expect(readFileSync(new URL("../../packages/host/web-runtime/build.ts", import.meta.url), "utf8")).toContain("process.argv[2]");
  });

  test("name · inject · Config · internals khớp bản gốc từng chữ", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("web-app");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["webServer"]);
    // Schema: cùng khoá, cùng mặc định; đầu ra in ra phải TRÙNG chuỗi của bản gốc.
    expect(String(Config)).toBe(String(stock.Config));
    const defaults = Config({}) as { openBrowser: boolean; printUrl: boolean; surfaceContext: boolean; publicUrl?: string };
    expect(defaults.openBrowser).toBe(true);
    expect(defaults.printUrl).toBe(true);
    expect(defaults.surfaceContext).toBe(true);
    expect(defaults.publicUrl).toBeUndefined();
    expect(Object.keys(internals).sort()).toEqual(["openBrowser", "resolveDistIndex"]);
    // 19/10/2026 (task-157 nhánh B) — SAI LỆCH CÓ CHỦ ĐÍCH: ta ƯU TIÊN dist CỦA TA (đã qua brand-rename),
    // dist stock chỉ là FALLBACK. Vì vậy KHÔNG còn bằng bản gốc khi dist ta tồn tại; hợp đồng còn lại là:
    // hàm trả đường dẫn TỒN TẠI THẬT và kết thúc bằng `dist/index.html`.
    const duongDan = internals.resolveDistIndex();
    expect(duongDan.endsWith(join("dist", "index.html"))).toBe(true);
    expect(existsSync(duongDan)).toBe(true);
    expect(duongDan).not.toBe(stock.internals.resolveDistIndex());
  });
});

describe("hành vi chính: runtime web mà người dùng nhìn thấy", () => {
  test("mặc định: cấp webApp, mount chủ sở hữu fallback, đăng ký DSH_WEB_URL, in dòng URL", async () => {
    const { ctx, record } = makeCtx({ ssh: true });
    const opened = await withStubbedBrowser(() => apply(ctx as never, Config({}) as never));
    expect(record.provided.map((entry) => entry.name)).toEqual(["webApp"]);
    expect(record.provided[0]?.value.getAdvertisedUrl()).toBe("http://127.0.0.1:5439");
    expect(record.plugins).toHaveLength(1);
    expect(record.plugins[0]?.config.distIndex).toBe(internals.resolveDistIndex());
    expect(record.injections.map((entry) => entry.deps)).toEqual([["shellEnv"], ["connection"]]);
    const registration = record.injections[0]?.shellEnv[0];
    expect(registration?.name).toBe("web-runtime");
    expect(Object.keys(registration?.variables ?? {})).toEqual(["DSH_WEB_URL"]);
    expect(registration?.resolve()).toEqual({ DSH_WEB_URL: "http://127.0.0.1:5439" });
    // Lượt chạy qua SSH: in URL nhưng KHÔNG bàn giao trình duyệt.
    expect(opened).toEqual([]);
  });

  test("dòng URL: in sau khi cây Loader yên, và CHỈ một lần cho mỗi root", async () => {
    // root giả có ĐÚNG hình dạng mà auditStartupEntries đọc: `ctx.loader.entries()`.
    const root = { loader: { entries: () => [] } };
    let resolveLoader: (() => void) | undefined;
    const loader = {
      await: () =>
        new Promise<void>((resolve) => {
          resolveLoader = resolve;
        }),
    };
    const first = makeCtx({ ssh: true, loader, root });
    // Bắt console XUYÊN các lượt chờ: dòng URL được in trong microtask SAU khi Loader yên.
    const log: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => void log.push(args.map(String).join(" "));
    try {
      apply(first.ctx as never, Config({}) as never);
      expect(log).toEqual([]);
      resolveLoader?.();
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      console.log = original;
    }
    expect(log).toEqual(["dsh web: http://127.0.0.1:5439?token=T"]);
    // Lượt cài thứ hai trên CÙNG root: cổng WeakSet chặn dòng thứ hai (bản gốc cũng vậy).
    const second = makeCtx({ ssh: true, root });
    const again = captureConsole(() => apply(second.ctx as never, Config({}) as never));
    expect(again.log).toEqual([]);
  });

  test("bàn giao trình duyệt: mở ĐÚNG url đã ký, và dòng cảnh báo khớp bản gốc", async () => {
    const { ctx } = makeCtx();
    const opened = await withStubbedBrowser(() => {
      const captured = captureConsole(() => apply(ctx as never, Config({}) as never));
      expect(captured.log).toEqual([
        "dsh web: http://127.0.0.1:5439?token=T",
        "dsh web: opening the default browser; pass --no-open to disable",
      ]);
    });
    expect(opened).toEqual(["http://127.0.0.1:5439?token=T"]);
  });
});

describe("publicUrl: quảng bá gốc công khai thay cho origin của listener", () => {
  test("transform chuẩn hoá pathname và đối chứng từng chuỗi với bản gốc", () => {
    expect(Config({ publicUrl: "https://app.example/ui" }).publicUrl).toBe("https://app.example/ui/");
    expect(String(Config({ publicUrl: "https://app.example/ui" }).publicUrl)).toBe(
      String(stock.Config({ publicUrl: "https://app.example/ui" }).publicUrl),
    );
    expect(parsePublicUrl("https://app.example").href).toBe("https://app.example/");
    // Bốn bẫy mà WHATWG tự nó chấp nhận — bản gốc từ chối, ta cũng phải từ chối, cùng thông điệp.
    const cases: [string, RegExp][] = [
      [" https://app.example", /must not contain ASCII whitespace or control characters/],
      ["//app.example", /must be an absolute http or https URL of the form/],
      ["https://app.example/?x=1", /must not include a query or fragment/],
      ["https://user@app.example", /must not include credentials/],
    ];
    for (const [value, expected] of cases) {
      expect(() => Config({ publicUrl: value })).toThrow(expected);
      expect(() => stock.Config({ publicUrl: value })).toThrow(expected);
    }
  });

  test("webApp · DSH_WEB_URL · dòng URL đều dùng publicUrl đã chuẩn hoá", async () => {
    const { ctx, record } = makeCtx({ ssh: true });
    await withStubbedBrowser(() => apply(ctx as never, Config({ publicUrl: "https://app.example/ui" }) as never));
    expect(record.provided[0]?.value.getAdvertisedUrl()).toBe("https://app.example/ui/");
    expect(record.injections[0]?.shellEnv[0]?.resolve()).toEqual({ DSH_WEB_URL: "https://app.example/ui/" });
  });
});

describe("đường lỗi: cùng mã, cùng thông điệp như bản gốc, và không treo", () => {
  test("bind mang zone id: NÉM trước mọi tác dụng phụ; có publicUrl thì đi tiếp", () => {
    const broken = makeCtx({ host: "fe80::1%en0" });
    const message = "web-app: bind address \"fe80::1%en0\" carries an interface zone id, which no URL can express; pass --public-url with the root browsers actually reach it through";
    expect(() => apply(broken.ctx as never, Config({}) as never)).toThrow(message);
    expect(() => stock.apply(makeCtx({ host: "fe80::1%en0" }).ctx as never, stock.Config({}) as never)).toThrow(message);
    expect(broken.record.provided).toEqual([]);
    expect(broken.record.plugins).toEqual([]);
    // Cùng bind nhưng có publicUrl: không ném, vẫn cấp service.
    const rescued = makeCtx({ host: "fe80::1%en0", ssh: true });
    apply(rescued.ctx as never, Config({ publicUrl: "https://app.example" }) as never);
    expect(rescued.record.provided).toHaveLength(1);
  });

  test("phơi HTTP ra ngoài loopback: CẢNH BÁO đúng một dòng; HTTPS thì im lặng", () => {
    const exposed = makeCtx({ host: "0.0.0.0", ssh: true });
    const warn = captureConsole(() => apply(exposed.ctx as never, Config({}) as never));
    const expected = "dsh web: listening on 0.0.0.0 over plain HTTP; restrict this port to a trusted proxy or network";
    expect(warn.warn).toEqual([expected]);
    const stockWarn = captureConsole(() => stock.apply(makeCtx({ host: "0.0.0.0", ssh: true }).ctx as never, stock.Config({}) as never));
    expect(stockWarn.warn).toEqual([expected]);
    const secure = captureConsole(() => apply(makeCtx({ host: "0.0.0.0", protocol: "https:", ssh: true }).ctx as never, Config({}) as never));
    expect(secure.warn).toEqual([]);
  });

  test("tắt surfaceContext ⇒ KHÔNG đăng ký shellEnv; tắt printUrl ⇒ không in URL", () => {
    const { ctx, record } = makeCtx({ ssh: true });
    const captured = captureConsole(() =>
      apply(ctx as never, Config({ surfaceContext: false, printUrl: false, openBrowser: false }) as never),
    );
    expect(record.injections).toEqual([]);
    expect(record.provided).toHaveLength(1);
    expect(captured.log).toEqual([]);
  });
});

/** `gbh.row` (hoặc `gbh.row_unmounted_ly_do.row`) — metadata mount của gói. */
interface RowMeta {
  id?: string;
  config?: Record<string, unknown>;
  tests?: string[];
}

describe("metadata: gbh.peers ⊆ peerDependencies (so PHẦN TỬ, có ĐỐI CHỨNG ÂM)", () => {
  test("mọi peer khai để inject đều có trong peerDependencies; row (nếu có) đúng id + config oracle", () => {
    const meta = JSON.parse(readFileSync(new URL(PACKAGE_JSON, import.meta.url), "utf8")) as {
      gbh?: { peers?: string[]; row?: RowMeta; row_unmounted_ly_do?: { ly_do?: string; row?: RowMeta } };
      peerDependencies?: Record<string, string>;
    };
    const peers = meta.gbh?.peers ?? [];
    const peerDeps = Object.keys(meta.peerDependencies ?? {});
    expect(peers.length).toBeGreaterThan(0);
    expect(missingPeers(peers, peerDeps)).toEqual([]);
    // Đọc CẢ HAI dạng: gbh.row (đang mount) và gbh.row_unmounted_ly_do.row (Lead đã gỡ mount).
    // Gỡ mount KHÔNG được phép phá hợp đồng id/config — nên hai dạng phải cho ra cùng một row.
    const row = meta.gbh?.row ?? meta.gbh?.row_unmounted_ly_do?.row;
    expect(row?.id).toBe("web-runtime");
    expect(row?.config).toEqual({
      openBrowser: { js: "ctx.webStartup.openBrowser" },
      printUrl: true,
      publicUrl: { js: "ctx.webStartup.publicUrl" },
      surfaceContext: true,
    });
    expect(row?.tests).toContain("tests/host/web-runtime.test.ts");
    // ĐỐI CHỨNG ÂM: phép kiểm PHẢI bắt được một peer thiếu, nếu không verdict trên là rỗng.
    expect(missingPeers([...peers, "@deepseek-ai/dsh-ghost"], peerDeps)).toEqual(["@deepseek-ai/dsh-ghost"]);
    expect(missingPeers([], peerDeps)).toEqual([]);
  });
});

describe("C6 danh tính: vật thể cấu hình độc lập giữa hai thực thể", () => {
  test("hai lượt apply ⇒ hai webApp, hai closure, hai bảng biến KHÔNG chia sẻ tham chiếu", () => {
    const a = makeCtx({ ssh: true });
    const b = makeCtx({ ssh: true });
    apply(a.ctx as never, Config({}) as never);
    apply(b.ctx as never, Config({}) as never);
    const webAppA = a.record.provided[0]?.value;
    const webAppB = b.record.provided[0]?.value;
    expect(webAppA).not.toBe(webAppB);
    expect(webAppA?.getAdvertisedUrl).not.toBe(webAppB?.getAdvertisedUrl);
    (webAppA as { getAdvertisedUrl(): string }).getAdvertisedUrl = () => "http://mutated.example";
    expect(webAppB?.getAdvertisedUrl()).toBe("http://127.0.0.1:5439");
    const variablesA = a.record.injections[0]?.shellEnv[0]?.variables;
    const variablesB = b.record.injections[0]?.shellEnv[0]?.variables;
    expect(variablesA).not.toBe(variablesB);
    const entryA = variablesA?.DSH_WEB_URL;
    const entryB = variablesB?.DSH_WEB_URL;
    expect(entryA).not.toBe(entryB);
    if (entryA === undefined || entryB === undefined) throw new Error("thieu bien DSH_WEB_URL");
    entryA.description = "mutated";
    expect(entryB.description).toBe("Advertised URL of the Galaxy Blackhole Web GUI serving this session.");
  });
});