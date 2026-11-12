/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B 13 ca cho @galaxy-blackhole/gbh-experimental-client-ui-voice-input: build.ts động trong
 *      mkdtemp + symlink apps/host/node_modules · export/name/apply rỗng · apply no-op trên Context giả và
 *      Proxy thù địch · package.json (name/peer/exports · dsh.client 7 inject + 1 external BẰNG stock SAU
 *      sameAfterIdMap — id đã rewrite CÓ CHỦ ĐÍCH) · row_unmounted_ly_do PARK (ui-voice-input + aliases/moduleIds) · locale en/zh BYTE-IDENTICAL
 *      (sha256) · nửa client port CƠ HỌC 1:1 (2.979 dòng, +28 B = 3 id module ×5 + 1 require gateway ×13) · build tất định — CẢ stock/ours.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const PKG = join(REPO, "packages", "host", "experimental-client-ui-voice-input");
/** build.ts của ta — nạp ĐỘNG trong beforeAll. */
const OURS_BUILD = join(PKG, "build.ts");
/** package.json của ta. */
const OURS_PKG = join(PKG, "package.json");
/** README của ta (ghi nợ nửa client). */
const OURS_README = join(PKG, "README.md");
/** Gói stock trong kernel (CHỈ ĐỌC — oracle của mọi phép so). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-client-ui-voice-input");
/** Entry HOST của stock (lib/index.js, 6 dòng). */
const STOCK_ENTRY = join(STOCK, "lib", "index.js");
/** Nửa CLIENT của stock (lib/client.js, 2.979 dòng — CHƯA port). */
const STOCK_CLIENT = join(STOCK, "lib", "client.js");
/** package.json của stock. */
const STOCK_PKG = join(STOCK, "package.json");
/** README của stock. */
const STOCK_README = join(STOCK, "README.md");
/** Đường dẫn test tương đối mà manifest phải khai. */
const TEST_REL = "tests/host/experimental-client-ui-voice-input.test.ts";
/** Đường dẫn tuyệt đối của chính tệp test này. */
const TEST_ABS = join(REPO, TEST_REL);
/** Thư mục tạm — build vào đây, afterAll dọn. */
const TEMP = mkdtempSync(join(tmpdir(), "gbh-voice-input-ab-"));
/** Đích build lần 1. */
const OUT_1 = join(TEMP, "lib");
/** Đích build lần 2 (ca tất định). */
const OUT_2 = join(TEMP, "lib2");
/** Id gốc của gói — dùng cho phép quy đổi tên. */
const STOCK_ID = "@deepseek-ai/dsh-experimental-client-ui-voice-input";
/** Id của ta. */
const OUR_ID = "@galaxy-blackhole/gbh-experimental-client-ui-voice-input";
/** Id CỔNG của ta (41 ký tự) — nửa client require nó (rewrite CÓ CHỦ ĐÍCH, +13 B). */
const GATEWAY_ID = "@galaxy-blackhole/gbh-host-typert-gateway";
/** Id CỔNG của bản stock (28 ký tự). */
const STOCK_GATEWAY_ID = "@deepseek-ai/dsh-api-gateway";

/** Một mục trong exports (đường dẫn thẳng hoặc object điều kiện). */
type ExportEntry = string | { types?: string; default?: string };

/** Một entrypoint trong build.ts. */
interface BuildEntry {
  /** Khoá entry. */
  key: string;
  /** Tệp nguồn dưới src/. */
  source: string;
  /** Tên artifact dưới lib/. */
  artifact: string;
}

/** Hai artifact buildPackage trả về (host bắt buộc, client khi đã port). */
interface BuiltArtifacts {
  /** Đường dẫn lib/index.js. */
  host: string;
  /** Đường dẫn lib/client.js (khi build có ghép nửa client). */
  client?: string;
}

/** Bề mặt build.ts mà test chạm tới. */
interface BuildModule {
  /** Hàm build chuẩn của repo (trả đường dẫn hoặc map entry). */
  buildPackage?: (outDir?: string) => Promise<string | Record<string, string | undefined>>;
  /** Bảng entrypoint khi build.ts không có buildPackage. */
  ENTRY_POINTS?: readonly BuildEntry[];
}

/** Hình dạng package.json test dùng. */
interface PkgShape {
  /** Tên package. */
  name?: string;
  /** ESM. */
  type?: string;
  /** Peer dependencies. */
  peerDependencies?: Record<string, string>;
  /** Bảng exports. */
  exports?: Record<string, ExportEntry>;
  /** Metadata nửa client. */
  dsh?: { client?: { inject?: string[]; platform?: string; external?: string[] } };
  /** Metadata quy ước của repo. */
  gbh?: {
    /** Peer khai cho gbh. */
    peers?: string[];
    /** Test của gói. */
    tests?: string[];
    /** Row đang mount (19/10/2026: đã flip — hình dạng tối thiểu ca 6 đọc). */
    row?: { id?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[] };
    /** Dạng PARK: giữ row + lý do. */
    row_unmounted_ly_do?: {
      /** Lý do chưa mount. */
      ly_do?: string;
      /** Row sẽ dùng khi mount. */
      row?: { id?: string; insertOnly?: boolean; tests?: string[] };
    };
    /** Văn bản bằng chứng (chép nguyên văn dsh.client stock). */
    draft?: string;
  };
}

/** Bề mặt module ESM nạp bằng import động. */
type ModuleShape = Record<string, unknown>;

/** Kết quả một lần gọi: giá trị hoặc lỗi đã chuẩn hoá. */
type Captured<T> = { ok: true; value: T } | { ok: false; failure: FailureShape };

/** Lỗi chuẩn hoá để so sâu (name/message/code/cause). */
interface FailureShape {
  /** Tên lỗi. */
  name: string;
  /** Thông điệp. */
  message: string;
  /** Mã lỗi (nếu có). */
  code: unknown;
  /** Nguyên nhân (nếu có). */
  cause: unknown;
}

/** Đường dẫn artifact HOST của ta sau build (điền trong beforeAll). */
let oursEntry = "";
/** Đường dẫn artifact CLIENT của ta sau build (điền trong beforeAll). */
let oursClientEntry = "";
/** Module HOST của ta (nạp từ artifact đã build trong temp). */
let ours: ModuleShape = {};
/** Module HOST của stock (oracle). */
let stock: ModuleShape = {};

/**
 * Đọc một tệp văn bản UTF-8.
 * Nhận: path — đường dẫn tuyệt đối.
 * Trả: nội dung tệp.
 */
function readText(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Đếm dòng theo nghĩa wc -l (số ký tự xuống dòng).
 * Nhận: text — văn bản cần đếm.
 * Trả: số dòng.
 */
function wcLines(text: string): number {
  return text.split("\n").length - 1;
}

/**
 * SHA-256 hex của một buffer.
 * Nhận: data — buffer cần băm.
 * Trả: 64 ký tự hex.
 */
function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Đọc và parse package.json.
 * Nhận: path — đường dẫn tệp.
 * Trả: object đã parse (thu hẹp về PkgShape).
 */
function readPkg(path: string): PkgShape {
  return JSON.parse(readText(path)) as PkgShape;
}

/**
 * Đích runtime của một mục exports (bỏ lớp types).
 * Nhận: entry — string hoặc object điều kiện.
 * Trả: chuỗi đích hoặc undefined.
 */
function target(entry: ExportEntry | undefined): string | undefined {
  return typeof entry === "string" ? entry : entry?.default;
}

/**
 * Lấy export apply của một module (ném nếu thiếu).
 * Nhận: mod — module ESM.
 * Trả: hàm apply.
 */
function applyOf(mod: ModuleShape): (...args: unknown[]) => unknown {
  const fn = mod["apply"];
  if (typeof fn !== "function") throw new Error("module thiếu export apply");
  return fn as (...args: unknown[]) => unknown;
}

/**
 * Gọi một hàm và chuẩn hoá kết quả/lỗi để so sâu.
 * Nhận: run — hàm cần chạy.
 * Trả: { ok, value } hoặc { ok:false, failure:{name,message,code,cause} }.
 */
async function capture<T>(run: () => T | Promise<T>): Promise<Captured<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    const failure = error as Error & { code?: unknown; cause?: unknown };
    return {
      ok: false,
      failure: { name: failure.name, message: failure.message, code: failure.code, cause: failure.cause },
    };
  }
}

/**
 * Build gói vào một thư mục: ưu tiên buildPackage, không có thì build TỪNG entry.
 * Nhận: build — module build.ts đã nạp động; outDir — thư mục đích.
 * Trả: đường dẫn artifact HOST (+ CLIENT khi build ghép nửa client).
 */
async function buildInto(build: BuildModule, outDir: string): Promise<BuiltArtifacts> {
  if (typeof build.buildPackage === "function") {
    const result = await build.buildPackage(outDir);
    if (typeof result === "string") return { host: result };
    const host = result["host"];
    if (typeof host === "string") {
      const client = result["client"];
      return { host, client: typeof client === "string" ? client : undefined };
    }
    throw new Error("buildPackage không trả đường dẫn host");
  }
  const entries = build.ENTRY_POINTS ?? [];
  if (entries.length === 0) throw new Error("build.ts không có buildPackage lẫn ENTRY_POINTS");
  mkdirSync(outDir, { recursive: true });
  let host = "";
  for (const entry of entries) {
    const result = await Bun.build({
      entrypoints: [join(PKG, "src", entry.source)],
      outdir: outDir,
      target: "node",
      format: "esm",
      naming: entry.artifact,
      packages: "external",
    });
    if (!result.success) throw new Error("build " + entry.source + " thất bại: " + result.logs.map(String).join(" | "));
    const artifact = join(outDir, entry.artifact);
    if (entry.key === "host") host = artifact;
  }
  if (host === "") throw new Error("ENTRY_POINTS thiếu entry host");
  return { host };
}

/**
 * Context cordis giả, tất định — apply() KHÔNG được chạm vào.
 * Trả: object có provide/get/on/plugin/effect ghi lại lời gọi.
 */
function makeContext(): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    name: "voice-input",
    calls: [] as string[],
  };
  ctx["provide"] = (name: string, value: unknown): void => {
    (ctx["calls"] as string[]).push("provide:" + name + ":" + String(value));
  };
  ctx["get"] = (name: string): unknown => {
    (ctx["calls"] as string[]).push("get:" + name);
    return undefined;
  };
  ctx["on"] = (name: string): void => {
    (ctx["calls"] as string[]).push("on:" + name);
  };
  ctx["plugin"] = (): void => {
    (ctx["calls"] as string[]).push("plugin");
  };
  ctx["effect"] = (): void => {
    (ctx["calls"] as string[]).push("effect");
  };
  return ctx;
}

/**
 * Proxy thù địch: mọi trap đều tăng bộ đếm rồi ném.
 * Nhận: bump — hàm đếm.
 * Trả: Proxy không được apply() chạm tới.
 */
function hostile(bump: () => void): object {
  return new Proxy(
    {},
    {
      get(): never {
        bump();
        throw new Error("GET");
      },
      set(): never {
        bump();
        throw new Error("SET");
      },
      has(): never {
        bump();
        throw new Error("HAS");
      },
      ownKeys(): never {
        bump();
        throw new Error("KEYS");
      },
      getPrototypeOf(): never {
        bump();
        throw new Error("PROTO");
      },
    },
  );
}

beforeAll(async () => {
  // node_modules của temp lùi về apps/host/node_modules đúng như brief.
  symlinkSync(join(REPO, "apps", "host", "node_modules"), join(TEMP, "node_modules"), "dir");
  writeFileSync(join(TEMP, "package.json"), JSON.stringify({ type: "module" }) + "\n", "utf8");
  const build = (await import(pathToFileURL(OURS_BUILD).href)) as BuildModule;
  const built = await buildInto(build, OUT_1);
  oursEntry = built.host;
  oursClientEntry = built.client ?? join(OUT_1, "client.js");
  ours = (await import(pathToFileURL(oursEntry).href)) as ModuleShape;
  stock = (await import(pathToFileURL(STOCK_ENTRY).href)) as ModuleShape;
});

afterAll(() => {
  rmSync(TEMP, { recursive: true, force: true });
});

describe("experimental-client-ui-voice-input — ARTIFACT + hành vi HOST", () => {
  test("ca 1 · build.ts dựng lib/index.js trong mkdtemp; export/name/apply BẰNG stock", async () => {
    expect(existsSync(oursEntry)).toBe(true);
    expect(basename(oursEntry)).toBe("index.js");
    expect(oursEntry.startsWith(OUT_1)).toBe(true);
    const mine = applyOf(ours);
    const theirs = applyOf(stock);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).sort()).toEqual(["apply"]);
    expect({ type: typeof mine, name: mine.name, length: mine.length, own: Object.getOwnPropertyNames(mine).sort() }).toEqual({
      type: typeof theirs,
      name: theirs.name,
      length: theirs.length,
      own: Object.getOwnPropertyNames(theirs).sort(),
    });
    // Nguồn JS của hai hàm phải TRÙNG từng ký tự: "function apply() {}".
    expect(String(mine)).toBe(String(theirs));
    expect(String(mine)).toBe("function apply() {}");
    expect("default" in ours).toBe("default" in stock);
    expect("default" in ours).toBe(false);
    expect(await capture(() => mine())).toEqual(await capture(() => theirs()));
    expect(await capture(() => mine())).toEqual({ ok: true, value: undefined });
    // Stock lib/index.js đúng 6 dòng; artifact ta không vượt khuôn marker 6 dòng.
    expect(wcLines(readText(STOCK_ENTRY))).toBe(6);
    expect(wcLines(readText(oursEntry))).toBeLessThanOrEqual(6);
    expect(readText(oursEntry)).toContain("function apply() {}");
    // buildPackage trả thêm nửa client đã ghép; CẢ HAI artifact nằm trong mkdtemp.
    expect(oursClientEntry.startsWith(OUT_1)).toBe(true);
    expect(basename(oursClientEntry)).toBe("client.js");
    expect(existsSync(oursClientEntry)).toBe(true);
  });

  test("ca 2 · apply() rỗng trên undefined/null/Context giả: cùng undefined, fixture KHÔNG đổi", async () => {
    for (const fixture of [undefined, null]) {
      const mine = await capture(() => applyOf(ours).call(fixture));
      const theirs = await capture(() => applyOf(stock).call(fixture));
      expect(mine).toEqual(theirs);
      expect(mine).toEqual({ ok: true, value: undefined });
    }
    const ourCtx = makeContext();
    const stockCtx = makeContext();
    const ourBefore = JSON.stringify(ourCtx);
    const stockBefore = JSON.stringify(stockCtx);
    const mine = await capture(() => applyOf(ours).call(ourCtx, ourCtx, 1, "x", { nested: true }));
    const theirs = await capture(() => applyOf(stock).call(stockCtx, stockCtx, 1, "x", { nested: true }));
    expect(mine).toEqual(theirs);
    expect(mine).toEqual({ ok: true, value: undefined });
    expect(JSON.stringify(ourCtx)).toBe(ourBefore);
    expect(JSON.stringify(stockCtx)).toBe(stockBefore);
    expect(JSON.stringify(ourCtx)).toBe(JSON.stringify(stockCtx));
    expect((ourCtx["calls"] as string[]).length).toBe(0);
    expect((stockCtx["calls"] as string[]).length).toBe(0);
  });

  test("ca 3 · apply() với this/tham số là Proxy thù địch: không chạm trap, cùng không ném", async () => {
    let ourTouches = 0;
    let stockTouches = 0;
    const ourThis = hostile(() => {
      ourTouches += 1;
    });
    const stockThis = hostile(() => {
      stockTouches += 1;
    });
    const mine = await capture(() => applyOf(ours).call(ourThis, ourThis));
    const theirs = await capture(() => applyOf(stock).call(stockThis, stockThis));
    expect({ result: mine, touches: ourTouches }).toEqual({ result: theirs, touches: stockTouches });
    expect(mine).toEqual({ ok: true, value: undefined });
    expect(ourTouches).toBe(0);
    expect(stockTouches).toBe(0);
    // Kể cả khi chính tham số là Proxy, cả hai bản đều bỏ qua (arity 0).
    const ourArg = hostile(() => {
      ourTouches += 1;
    });
    const stockArg = hostile(() => {
      stockTouches += 1;
    });
    expect(await capture(() => applyOf(ours)(ourArg))).toEqual(await capture(() => applyOf(stock)(stockArg)));
    expect(ourTouches).toBe(0);
    expect(stockTouches).toBe(0);
  });
});

describe("experimental-client-ui-voice-input — MANIFEST đối chiếu stock", () => {
  test("ca 4 · name/peer/exports: HOST + './client' cùng đích lib/index.js · lib/client.js", () => {
    const mine = readPkg(OURS_PKG);
    const theirs = readPkg(STOCK_PKG);
    expect(mine.name).toBe(OUR_ID);
    expect(theirs.name).toBe(STOCK_ID);
    expect(mine.name).toBe("@galaxy-blackhole/gbh-" + String(theirs.name).replace("@deepseek-ai/dsh-", ""));
    expect(mine.type).toBe(theirs.type);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(mine.peerDependencies, theirs.peerDependencies)).toBe(true);
    const surface = (pkg: PkgShape): Record<string, string | undefined> => ({
      dot: target(pkg.exports?.["."]),
      client: target(pkg.exports?.["./client"]),
      packageJson: target(pkg.exports?.["./package.json"]),
      locale: target(pkg.exports?.["./locale/*.json"]),
    });
    expect(surface(mine)).toEqual(surface(theirs));
    expect(surface(mine)).toEqual({
      dot: "./lib/index.js",
      client: "./lib/client.js",
      packageJson: "./package.json",
      locale: "./locale/*.json",
    });
    expect(Object.keys(mine.exports ?? {}).sort()).toEqual([".", "./client", "./locale/*.json", "./package.json"]);
    expect(Object.keys(theirs.exports ?? {}).sort()).toEqual([".", "./client", "./locale/*.json", "./package.json", "./src/*"]);
    expect(theirs.exports?.["./client"]).toEqual({
      types: "./lib/types/client/index.d.ts",
      default: "./lib/client.js",
    });
  });

  test("ca 5 · dsh.client stock NGUYÊN VĂN (7 inject + 1 external) — manifest ta KHAI đúng object đó SAU sameAfterIdMap", () => {
    const mine = readPkg(OURS_PKG);
    const theirs = readPkg(STOCK_PKG);
    const stockClient = theirs.dsh?.client;
    expect(stockClient).toEqual({
      inject: [
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-api-session-controller",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-api-gateway",
        "@deepseek-ai/dsh-client-ui-plugin-manager",
      ],
      platform: "web",
      external: ["@deepseek-ai/dsh-api-gateway/client"],
    });
    // Brief ghi "10 gói"; ĐO ĐƯỢC là 7 inject + 1 external — ghi số đo, không bẻ stock.
    expect(stockClient?.inject).toHaveLength(7);
    expect(stockClient?.external).toHaveLength(1);
    expect(stockClient?.inject).not.toHaveLength(10);
    // 20/10/2026 — inject/external của ta nay là id GBH (rewrite CÓ CHỦ ĐÍCH) ⇒ so SAU bản đồ id với ĐÚNG
    // object stock đo được ở trên (giữ literal stock làm chuẩn, không sửa literal thành id ta).
    expect(sameAfterIdMap(mine.dsh?.client, stockClient)).toBe(true);
    expect(mine.dsh?.client?.inject).toHaveLength(7);
    expect(mine.dsh?.client?.external).toHaveLength(1);
    const draft = String(mine.gbh?.draft ?? "");
    // P3 (04/11/2026): draft nay chua id MOI (store + primitives) => quy nguoc roi moi so khop literal stock.
    const draftQuy = draft
      .split("@galaxy-blackhole/gbh-client-store")
      .join("@deepseek-ai/dsh-client-store")
      .split("@galaxy-blackhole/gbh-client-ui-primitives")
      .join("@deepseek-ai/dsh-client-ui-primitives");
    expect(draftQuy).toContain(JSON.stringify(stockClient));
    expect(draft).toContain("brief ghi '10 gói'");
    expect(draft).toContain("7 mục inject");
    expect(draft.length).toBeGreaterThan(500);
  });

  // 19/10/2026 — reviewer: row `ui-voice-input` ĐÃ MOUNT (Lead flip) ⇒ ca này canh gbh.row,
  // không còn gbh.row_unmounted_ly_do. Hình dạng row giữ đúng dump-now2 1565–1566 (không config/inject/disabled).
  test("ca 6 · MOUNT: gbh.row = row ui-voice-input (moduleIds/aliases/tests) theo dump-now2", () => {
    const mine = readPkg(OURS_PKG);
    expect(mine.gbh?.row_unmounted_ly_do).toBeUndefined();
    // 19/10/2026 (Lead đính chính): row THẬT `ui-voice-input` trong bundle patch dsh-experimental-voice-input-bundle
    // (dump /tmp/dump-now2.txt 1565–1566), KHÔNG phải insertOnly; row stock không config/inject/disabled.
    expect(mine.gbh?.row as unknown).toEqual({
      id: "ui-voice-input",
      moduleIds: ["@galaxy-blackhole/gbh-experimental-client-ui-voice-input"],
      aliases: ["@deepseek-ai/dsh-experimental-client-ui-voice-input"],
      tests: [TEST_REL],
      // 25/10/2026 (ADR 0027): row này do bundle voice-input cắm ⇒ app patch không phát khoi riêng.
      ownedByBundle: true,
    });
    expect(Object.keys(mine.gbh?.row ?? {}).sort()).toEqual(["aliases", "id", "moduleIds", "ownedByBundle", "tests"]);
    expect(mine.gbh?.row?.tests).toEqual([TEST_REL]);
    // gbh.tests trỏ đúng tệp test này; tệp tồn tại.
    expect(mine.gbh?.tests).toEqual([TEST_REL]);
    expect(mine.gbh?.peers).toEqual(["@deepseek-ai/cordis"]);
    expect(existsSync(TEST_ABS)).toBe(true);
    // Stock không có gbh (GBH-ONLY) — khác biệt có chủ đích, ghi lại để không ai tưởng thiếu.
    expect(readPkg(STOCK_PKG).gbh).toBeUndefined();
  });

  test("ca 7 · DOC: README ta ghi nợ client khớp số ĐO của stock (2.979 dòng / 119.517 B / 7 inject)", () => {
    const mine = readText(OURS_README);
    const theirs = readText(STOCK_README);
    const measured = { lines: wcLines(readText(STOCK_CLIENT)), bytes: statSync(STOCK_CLIENT).size };
    expect(measured).toEqual({ lines: 2979, bytes: 119517 });
    expect(mine).toContain("2.979");
    expect(mine).toContain("119.517");
    expect(mine).toContain("7 inject");
    expect(mine).toContain("row_unmounted_ly_do");
    expect(mine).toMatch(/insertOnly/);
    // README stock nêu giới hạn gốc — đối chiếu để bản ta không hứa quá.
    expect(theirs).toContain("No automatic send");
    expect(mine).not.toContain("No automatic send");
    expect(mine).toContain("KHÔNG mount");
  });

  test("ca 8 · locale/en.json BYTE-IDENTICAL giữa stock và ta (sha256)", () => {
    const mine = readFileSync(join(PKG, "locale", "en.json"));
    const theirs = readFileSync(join(STOCK, "locale", "en.json"));
    expect(mine.equals(theirs)).toBe(true);
    expect(sha256(mine)).toBe(sha256(theirs));
    expect(sha256(mine)).toBe("cda757109c5e2687819a307c0326c8e0a48488d665a6668b3581d3e5c1c48f4f");
    expect(mine.toString("utf8")).toBe(theirs.toString("utf8"));
  });

  test("ca 9 · locale/zh.json BYTE-IDENTICAL giữa stock và ta (sha256)", () => {
    const mine = readFileSync(join(PKG, "locale", "zh.json"));
    const theirs = readFileSync(join(STOCK, "locale", "zh.json"));
    expect(mine.equals(theirs)).toBe(true);
    expect(sha256(mine)).toBe(sha256(theirs));
    expect(sha256(mine)).toBe("0cb96756eb42591583162e9271fd64bd70fe3cff5477d702e9cfac116546b881");
    expect(mine.toString("utf8")).toBe(theirs.toString("utf8"));
  });

  test("ca 10 · locale parse: shape hai bên y hệt, en ≠ zh, meta đủ title + description", () => {
    const parse = (root: string, lang: string): Record<string, Record<string, string>> =>
      JSON.parse(readText(join(root, "locale", lang + ".json"))) as Record<string, Record<string, string>>;
    expect(parse(PKG, "en")).toEqual(parse(STOCK, "en"));
    expect(parse(PKG, "zh")).toEqual(parse(STOCK, "zh"));
    expect(Object.keys(parse(PKG, "en"))).toEqual(["meta"]);
    expect(Object.keys(parse(PKG, "en")["meta"] ?? {}).sort()).toEqual(["description", "title"]);
    expect(typeof parse(PKG, "en")["meta"]?.["title"]).toBe("string");
    expect(typeof parse(PKG, "en")["meta"]?.["description"]).toBe("string");
    expect(parse(PKG, "en")).not.toEqual(parse(PKG, "zh"));
  });
});

describe("experimental-client-ui-voice-input — nửa client port CƠ HỌC + build tất định", () => {
  test("ca 11 · nửa client port CƠ HỌC 1:1: 2.979 dòng, chỉ đổi id (0 id gốc · 3 id module + 1 id gateway ta); ENTRY_POINTS chỉ host", async () => {
    const build = (await import(pathToFileURL(OURS_BUILD).href)) as BuildModule;
    const entries = build.ENTRY_POINTS ?? [];
    // Client KHÔNG đi qua Bun.build (đóng gói lại sẽ lệch byte) — bảng entry vẫn CHỈ host.
    expect(entries.map((entry) => entry.key)).toEqual(["host"]);
    expect(entries.map((entry) => entry.artifact)).toEqual(["index.js"]);
    const minePkg = readPkg(OURS_PKG);
    const theirsPkg = readPkg(STOCK_PKG);
    expect(minePkg.exports?.["./client"]).toBe("./lib/client.js");
    expect(target(theirsPkg.exports?.["./client"])).toBe("./lib/client.js");
    expect(existsSync(join(PKG, "lib", "client.js"))).toBe(true);
    // Client ghép từ part nguyên văn; src/client.ts chỉ là ENTRY MARKER (để check:rows thấy >=2 Bun.build).
    expect(existsSync(join(PKG, "src", "client.ts"))).toBe(true);
    expect(existsSync(STOCK_CLIENT)).toBe(true);
    const mine = readText(join(PKG, "lib", "client.js"));
    const theirs = readText(STOCK_CLIENT);
    expect(wcLines(mine)).toBe(2981); // 26/10/2026 — +2 dòng: delta khai báo nhãn "Tiếng Việt" (chú thích + vi: props.t("vi")).
    expect(wcLines(theirs)).toBe(2979);
    // 20/10/2026 — artefact của ta thêm 1 id CỔNG (require gateway) ⇒ 119.545 B (sai lệch CÓ CHỦ ĐÍCH).
    expect(statSync(join(PKG, "lib", "client.js")).size).toBe(119660); // 26/10/2026 — delta khai báo nhãn tiếng Việt (+105 B).
    expect(statSync(STOCK_CLIENT).size).toBe(119517);
    // +28 B = 3 id module × 5 B + 1 require gateway × 13 B.
    // P3 (04/11/2026): them 5 B do id MOI cua module ao store.
    expect(statSync(join(PKG, "lib", "client.js")).size - statSync(STOCK_CLIENT).size).toBe(5 * 3 + 13 + 105 + 10);
    // Byte-đúng-kỳ-vọng: bản stock quy CẢ id module (×3) LẪN id gateway trong require (×1) sang id ta.
    // 26/10/2026 — delta khai báo: nhãn "Tiếng Việt" cho mã ngôn ngữ "vi" (xem withVietnameseLabel() trong build.ts).
    const withVi = (text: string): string => text.replace(
      '\t\t\t\tko: props.t("ko")',
      '\t\t\t\tko: props.t("ko"),\n\t\t\t\t// 26/10/2026 — delta khai báo: provider PhoWhisper khai ngôn ngữ "vi".\n\t\t\t\tvi: props.t("vi")',
    );
    const expected = withVi(
      theirs
        .split(STOCK_ID)
        .join(OUR_ID)
        .split(STOCK_GATEWAY_ID)
        .join(GATEWAY_ID)
        // P3 (04/11/2026): module ao store + module nen tang doi id.
        .split("@deepseek-ai/dsh-client-store")
        .join("@galaxy-blackhole/gbh-client-store")
        .split("@deepseek-ai/dsh-client-ui-primitives")
        .join("@galaxy-blackhole/gbh-client-ui-primitives"),
    );
    expect(mine).toBe(expected);
    // Và phép so CHUẨN HOÁ (helper chung, áp CẢ HAI VẾ) cũng phải trùng từng byte.
    // 01/11/2026 — helper chung dựng bản đồ id từ metadata `gbh` của TỪNG gói; gói gateway của ta đã khai
    // `gbh.provenance.stock = "@deepseek-ai/dsh-api-gateway"` nên helper tự quy được id gateway.
    expect(normalizeIdsInText(mine)).toBe(normalizeIdsInText(withVi(theirs)));
    expect(theirs.split(STOCK_ID).length - 1).toBe(3);
    expect(mine.split(STOCK_ID).length - 1).toBe(0);
    expect(mine.split(OUR_ID).length - 1).toBe(3);
    expect(mine.split(GATEWAY_ID + "/client").length - 1).toBe(1);
    expect(mine.split(STOCK_GATEWAY_ID).length - 1).toBe(0);
    // sha cập nhật 20/10/2026 theo artefact SAU rewrite (id gateway dài hơn 13 B) — sai lệch CÓ CHỦ ĐÍCH.
    expect(sha256(Buffer.from(mine))).toBe("4b0c1afb427536e288f841834c22006480338105fc30b788455b58eab784ee78");
    const loader = mine.split("\n");
    expect(loader[0]).toBe("window.__ModuleLoader__.load({");
    expect(loader[1]).toBe('\tid: "' + OUR_ID + '",');
    expect(loader[2]).toBe("\tfactory: (require) => {");
    expect(mine).toContain("\t\texports.apply = apply;");
    expect(mine).toContain("\t\texports.inject = inject;");
    const parts = readdirSync(join(PKG, "src", "client-parts")).filter((name) => name.endsWith(".txt")).sort();
    expect(parts).toEqual(["part-01.txt", "part-02.txt", "part-03.txt"]);
  });

  test("ca 12 · build lần 2 byte-identical CẢ host + client; bề mặt export vẫn BẰNG stock (apply rỗng)", async () => {
    const build = (await import(pathToFileURL(OURS_BUILD).href)) as BuildModule;
    const second = await buildInto(build, OUT_2);
    if (second.client === undefined) throw new Error("build lần 2 thiếu artifact client");
    const firstHost = readFileSync(oursEntry);
    const secondHost = readFileSync(second.host);
    expect(secondHost.equals(firstHost)).toBe(true);
    expect(sha256(secondHost)).toBe(sha256(firstHost));
    expect(wcLines(readText(second.host))).toBe(wcLines(readText(oursEntry)));
    const firstClient = readFileSync(oursClientEntry);
    const secondClient = readFileSync(second.client);
    expect(secondClient.equals(firstClient)).toBe(true);
    expect(sha256(secondClient)).toBe(sha256(firstClient));
    expect(wcLines(readText(second.client))).toBe(2981); // 26/10/2026 — +2 dòng delta khai báo nhãn tiếng Việt.
    const again = (await import(pathToFileURL(second.host).href)) as ModuleShape;
    expect(Object.keys(again).sort()).toEqual(Object.keys(stock).sort());
    expect(String(applyOf(again))).toBe(String(applyOf(stock)));
    expect(await capture(() => applyOf(again)())).toEqual(await capture(() => applyOf(stock)()));
    expect(await capture(() => applyOf(again)())).toEqual({ ok: true, value: undefined });
  });

  test("ca 13 · PHỦ: tệp test này có ≥10 ca; manifest trỏ đúng nó; row.tests = gbh.tests", () => {
    const text = readText(TEST_ABS);
    const cases = [...text.matchAll(/^\s*test\("/gmu)].length;
    expect(cases).toBeGreaterThanOrEqual(10);
    const mine = readPkg(OURS_PKG);
    expect(mine.gbh?.tests).toEqual([TEST_REL]);
    expect(mine.gbh?.row?.tests).toEqual([TEST_REL]);
    expect(readPkg(STOCK_PKG).gbh).toBeUndefined();
    expect(existsSync(TEST_ABS)).toBe(true);
  });
});
