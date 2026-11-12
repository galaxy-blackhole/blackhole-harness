/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cổng an toàn cho row settings đang PARK: bề mặt export A≡B, rủi ro trùng service trên Context thật, patch thay an toàn, idempotent, fail-soft và aliases/hostAliases
 */

import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseGbhMetadata, type GbhRowMetadata } from "../../apps/cli/src/rewrite-metadata.ts";
import { writeAppPatch } from "../../apps/cli/src/profile.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của TA (đang PARK) — nguồn của row và của src/index.ts. */
const OURS_DIR = join(REPO, "packages", "host", "settings");
/** Điểm vào runtime của ta: src TS, không qua artefact build. */
const OURS = join(OURS_DIR, "src", "index.ts");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-settings", "lib", "index.js");
/** cordis THẬT của kernel — cần Context thật thì Service mới đăng ký được dịch vụ. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Manifest của gói — nguồn DUY NHẤT của hình dạng row (JSON được miễn header). */
const MANIFEST = join(OURS_DIR, "package.json");
/** Bản sao patch của app trong repo — KHÔNG được bị test này ghi. */
const REPO_APP_PATCH = join(REPO, "profiles", "blackhole", "app.patch.yml");
/** Tên package của ta trong khối insert. */
const SPECIFIER = "@galaxy-blackhole/gbh-settings";
/** Số hiệu dịch vụ mà cả hai bản cùng cấp. */
const SERVICE = "settings";

/** Bốn export runtime mà bản gốc công bố (và bản ta phải khớp ĐÚNG bốn tên). */
const EXPORT_NAMES = ["SettingsConflictError", "SettingsForms", "default", "redactSecrets"] as const;

/** Hình dạng dịch vụ mà test nhìn thấy. */
interface SettingsService {
  /** Tên dịch vụ đã đăng ký trong context. */
  readonly name: string;
}

/** Một export có thể gọi/dựng như lớp. */
interface CallableShape {
  /** Tên hàm/lớp. */
  readonly name: string;
  /** Số tham số hình thức. */
  readonly length: number;
}

/** Lớp SettingsForms nhìn qua góc hẹp của test. */
interface FormsClass extends CallableShape {
  /** Dựng dịch vụ trong một context thật. */
  new (ctx: RealContext): SettingsService;
  /** Hai seam phải sẵn sàng trước khi dùng. */
  readonly inject?: readonly string[];
  /** Config tĩnh của lớp (nếu bản gốc có). */
  readonly Config?: unknown;
  /** Prototype — nơi đo bề mặt lớp. */
  readonly prototype: object;
}

/** Lỗi xung đột revision nhìn qua góc hẹp của test. */
interface ConflictClass extends CallableShape {
  /** Dựng lỗi với namespace và hai revision. */
  new (ns: string, expected: number, actual: number): Error & {
    /** Mã máy đọc được. */
    code: string;
    /** Revision kỳ vọng. */
    expected: number;
    /** Revision thực tế. */
    actual: number;
  };
  /** Prototype — nơi đo bề mặt lớp. */
  readonly prototype: object;
}

/** Module của cả hai bản: đúng bốn export runtime. */
interface SettingsModule {
  /** Lỗi từ chối ghi vì revision lệch. */
  readonly SettingsConflictError: ConflictClass;
  /** Lớp dịch vụ settings. */
  readonly SettingsForms: FormsClass;
  /** Chính lớp đó, ở dạng default. */
  readonly default: FormsClass;
  /** Hàm che secret theo cấu trúc. */
  readonly redactSecrets: CallableShape;
}

/** Context cordis thật, nhìn qua đúng những gì test dùng. */
interface RealContext {
  /** Cấp một dịch vụ cho context này. */
  provide(name: string, value: unknown): void;
  /** Đọc một dịch vụ đã cấp. */
  get(name: string): unknown;
  /** Mount một plugin (dùng để chứng minh context còn sống). */
  plugin(plugin: unknown, config?: unknown): { await(): Promise<unknown> };
  /** Fiber gốc — nơi dọn context sau mỗi ca. */
  readonly fiber: { dispose(): Promise<void> };
}

/** Module cordis mà test cần. */
interface CordisModule {
  /** Context thật (fiber gốc). */
  readonly Context: new () => RealContext;
}

/** Row trong manifest, gồm cả trường moduleIds mà `GbhRowMetadata` không cần. */
interface ManifestRow extends GbhRowMetadata {
  /** Các id module của gói (chỉ id của ta). */
  readonly moduleIds?: readonly string[];
}

/** Hình dạng manifest mà test đọc. */
interface ManifestShape {
  /** Tên package. */
  readonly name?: string;
  /** Metadata của ta để `bh host` sinh khối patch. */
  readonly gbh?: {
    /** Row đang hoạt động (nếu Lead đã bỏ PARK). */
    readonly row?: ManifestRow;
    /** Row đang PARK: lý do + hình dạng row. */
    readonly row_unmounted_ly_do?: { readonly ly_do?: string; readonly row?: ManifestRow };
  };
}

/** Một rewrite tối thiểu đủ để `writeAppPatch` sinh khối. */
interface MountLike {
  /** Tên package đã mount. */
  readonly specifier: string;
  /** Thư mục package. */
  readonly dir: string;
  /** Có build lại từ src/ hay không. */
  readonly built: boolean;
  /** Peer đã trỏ về kernel. */
  readonly peers: string[];
  /** Mount có dùng được hay không. */
  readonly ok: boolean;
  /** Metadata thay row. */
  readonly row?: GbhRowMetadata;
}

/** Một rig còn sống (context + home tạm) để dọn trong `afterAll`. */
interface LiveRig {
  /** Context thật của rig. */
  readonly ctx: RealContext;
  /** Home tạm của profile giả. */
  readonly home: string;
}

/** Home của app cho MỌI lượt `writeAppPatch` — cách ly để không ghi vào repo/home thật. */
const TEMP_HOME = mkdtempSync(join(tmpdir(), "gbh-settings-safety-"));
/** `GBH_HOME` trước khi test đổi — khôi phục trong `afterAll`. */
const PREVIOUS_HOME = process.env.GBH_HOME;
process.env.GBH_HOME = TEMP_HOME;

/** Nội dung manifest tại lúc nạp — mốc chứng minh test không sửa manifest. */
const MANIFEST_TEXT = readFileSync(MANIFEST, "utf8");
/** Manifest đã parse. */
const MANIFEST_JSON = JSON.parse(MANIFEST_TEXT) as ManifestShape;
/** SHA-256 của manifest tại lúc nạp. */
const MANIFEST_SHA_AT_LOAD = sha256(MANIFEST_TEXT);
/** Nội dung patch app trong repo tại lúc nạp (null nếu chưa có). */
const REPO_PATCH_AT_LOAD = existsSync(REPO_APP_PATCH) ? readFileSync(REPO_APP_PATCH, "utf8") : null;
/** Các rig còn sống. */
const LIVE: LiveRig[] = [];

/** Nạp hai bản và cordis bằng đường dẫn TUYỆT ĐỐI (không qua exports của gói). */
const stock = (await import(pathToFileURL(STOCK).href)) as unknown as SettingsModule;
/** Bản của ta, nạp thẳng từ src TS. */
const ours = (await import(pathToFileURL(OURS).href)) as unknown as SettingsModule;
/** cordis thật của kernel. */
const cordis = (await import(pathToFileURL(CORDIS).href)) as unknown as CordisModule;

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: chuỗi cần băm. Trả: hex digest.
 */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/**
 * Đọc row của row `settings`: ưu tiên `gbh.row` (đã bỏ PARK), lùi về `gbh.row_unmounted_ly_do.row`.
 * Nhận: không. Trả: metadata row. Ném khi manifest không khai row ở cả hai nơi.
 */
function rowMetadata(): ManifestRow {
  const row = MANIFEST_JSON.gbh?.row ?? MANIFEST_JSON.gbh?.row_unmounted_ly_do?.row;
  if (row === undefined) throw new Error("manifest không khai row settings");
  return row;
}

/**
 * Dựng một Context cordis THẬT với ba seam giả mà SettingsForms cần (loader · profileContext · configEditor).
 * Nhận: không. Trả: context thật, đã đăng ký rig để dọn sau.
 */
function rig(): RealContext {
  const ctx = new cordis.Context();
  const home = mkdtempSync(join(tmpdir(), "gbh-settings-ctx-"));
  LIVE.push({ ctx, home });
  ctx.provide("loader", { await: () => Promise.resolve() });
  ctx.provide("profileContext", { name: "blackhole", home, dir: join(home, "profiles", "blackhole") });
  ctx.provide("configEditor", {
    documentPath: join(home, "app.patch.yml"),
    entries: () => [],
    configuration: () => [],
    edit: async (): Promise<void> => {},
  });
  return ctx;
}

/**
 * Đọc dịch vụ `settings` đang sống trong context.
 * Nhận: context đã có provider. Trả: dịch vụ; ném khi context không cấp dịch vụ.
 */
function serviceOf(ctx: RealContext): SettingsService {
  const service = ctx.get(SERVICE) as SettingsService | undefined;
  if (service === undefined) throw new Error("context không cấp service settings");
  return service;
}

/**
 * Chạy một phép mount và trả THÔNG ĐIỆP lỗi thay vì ném — để so hai bản mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy. Trả: thông điệp lỗi, hoặc "(khong nem)" khi không lỗi.
 */
function messageOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Chạy một phép mount BẤT ĐỒNG BỘ và trả thông điệp lỗi thay vì ném.
 * Nhận: hàm trả promise (vd `ctx.plugin(...).await()`). Trả: thông điệp lỗi, hoặc "(khong nem)".
 */
async function rejectionOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Đo bề mặt một lớp: tên, arity, static (trừ length/name/prototype), inject, Config và prototype.
 * Nhận: lớp cần đo. Trả: bản ghi so được giữa hai bản.
 */
function classSurface(cls: FormsClass): {
  name: string;
  arity: number;
  statics: string[];
  inject: readonly string[] | null;
  config: unknown;
  prototype: string[];
} {
  const statics = Object.getOwnPropertyNames(cls)
    .filter((key) => key !== "length" && key !== "name" && key !== "prototype")
    .sort();
  return {
    name: cls.name,
    arity: cls.length,
    statics,
    inject: cls.inject ?? null,
    config: cls.Config ?? null,
    prototype: Object.getOwnPropertyNames(cls.prototype).sort(),
  };
}

/**
 * Dựng rewrite cho row `settings` trỏ về thư mục gói ta.
 * Nhận: row metadata + cờ ok. Trả: rewrite tối thiểu đủ cho `writeAppPatch`.
 */
function mountFor(row: GbhRowMetadata, ok = true): MountLike {
  return { specifier: SPECIFIER, dir: OURS_DIR, built: false, peers: [], ok, row };
}

/**
 * Sinh patch trong home TẠM rồi đọc lại nội dung.
 * Nhận: danh sách rewrite. Trả: văn bản patch.
 */
function generate(rewrites: readonly MountLike[]): string {
  return readFileSync(writeAppPatch({ rewrites }), "utf8");
}

/** Patch của row `settings` đọc từ manifest hiện tại. */
function safePatch(): string {
  return generate([mountFor(rowMetadata())]);
}

afterAll(async (): Promise<void> => {
  while (LIVE.length > 0) {
    const live = LIVE.pop();
    if (live === undefined) continue;
    try {
      await live.ctx.fiber.dispose();
    } catch {
      // Context đã đóng ở ca trước — dọn lần hai vô hại.
    }
    rmSync(live.home, { recursive: true, force: true });
  }
  rmSync(TEMP_HOME, { recursive: true, force: true });
  if (PREVIOUS_HOME === undefined) delete process.env.GBH_HOME;
  else process.env.GBH_HOME = PREVIOUS_HOME;
});

describe("A/B — bề mặt export runtime của stock và src của ta", () => {
  test("stock đúng BỐN export runtime; bản ta cũng đúng bốn tên ấy", () => {
    expect(Object.keys(stock).sort()).toEqual([...EXPORT_NAMES]);
    expect(Object.keys(ours).sort()).toEqual([...EXPORT_NAMES]);
  });

  test("A≡B: bốn export cùng LOẠI hàm, cùng tên/số tham số với redactSecrets", () => {
    const a = stock as unknown as Record<string, unknown>;
    const b = ours as unknown as Record<string, unknown>;
    for (const name of EXPORT_NAMES) {
      expect(typeof b[name]).toBe(typeof a[name]);
      expect(typeof b[name]).toBe("function");
    }
    const aRedact = a["redactSecrets"] as CallableShape;
    const bRedact = b["redactSecrets"] as CallableShape;
    expect(bRedact.name).toBe(aRedact.name);
    expect(bRedact.name).toBe("redactSecrets");
    expect(bRedact.length).toBe(aRedact.length);
  });

  test("default === SettingsForms ở CẢ HAI; hai artefact là hai lớp KHÁC nhau", () => {
    expect(stock.default).toBe(stock.SettingsForms);
    expect(ours.default).toBe(ours.SettingsForms);
    // Hai bản cùng tên nhưng KHÁC định danh — chính vì thế chúng không thể cùng cấp service.
    expect(ours.SettingsForms).not.toBe(stock.SettingsForms);
    expect(ours.default).not.toBe(stock.default);
  });

  test("tên lớp · arity · static (inject · Config) · prototype A≡B", () => {
    const a = classSurface(stock.SettingsForms);
    const b = classSurface(ours.SettingsForms);
    expect(b).toEqual(a);
    expect(a.name).toBe("SettingsForms");
    expect(a.arity).toBe(1);
    expect(a.statics).toEqual(["inject"]);
    expect(a.inject).toEqual(["configEditor", "profileContext"]);
    // Cả hai KHÔNG khai static Config (Config đến từ schema của từng plugin, không từ lớp).
    expect(a.config).toBeNull();
  });

  test("SettingsConflictError: tên · arity · prototype · hành vi A≡B", () => {
    const a = new stock.SettingsConflictError("ui", 1, 2);
    const b = new ours.SettingsConflictError("ui", 1, 2);
    expect(b.name).toBe(a.name);
    expect(b.name).toBe("SettingsConflictError");
    expect(b.message).toBe(a.message);
    expect(b.code).toBe(a.code);
    expect(b.code).toBe("SETTINGS_CONFLICT");
    expect(b.expected).toBe(1);
    expect(b.actual).toBe(2);
    expect(b instanceof Error).toBe(true);
    expect(a instanceof Error).toBe(true);
    expect(ours.SettingsConflictError.name).toBe(stock.SettingsConflictError.name);
    expect(ours.SettingsConflictError.length).toBe(stock.SettingsConflictError.length);
    expect(Object.getOwnPropertyNames(ours.SettingsConflictError.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SettingsConflictError.prototype).sort(),
    );
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  });
});

describe("RỦI RO — hai provider cùng cấp service settings trên CÙNG Context thật", () => {
  test("mount plugin stock rồi mount plugin ours ⇒ cordis ném lỗi trùng service settings", async () => {
    const ctx = rig();
    // Đúng đường đi của loader: `ctx.plugin(lớp)` dựng Service trong fiber của plugin.
    await ctx.plugin(stock.SettingsForms).await();
    const first = serviceOf(ctx);
    expect(first.name).toBe(SERVICE);
    expect(Object.getPrototypeOf(first)).toBe(stock.SettingsForms.prototype);

    const message = await rejectionOf(() => ctx.plugin(ours.SettingsForms).await());
    expect(message).not.toBe("(khong nem)");
    expect(message).toContain('service "settings" has been registered');
  });

  test("ours mount trước cũng bị stock từ chối: A/B cùng một thông điệp cordis", () => {
    const ctxOursFirst = rig();
    new ours.SettingsForms(ctxOursFirst);
    expect(serviceOf(ctxOursFirst).name).toBe(SERVICE);
    const messageStockAfterOurs = messageOf(() => new stock.SettingsForms(ctxOursFirst));

    const ctxStockFirst = rig();
    new stock.SettingsForms(ctxStockFirst);
    const messageOursAfterStock = messageOf(() => new ours.SettingsForms(ctxStockFirst));

    expect(messageStockAfterOurs).toContain('service "settings" has been registered');
    expect(messageOursAfterStock).toBe(messageStockAfterOurs);
  });

  test("ctx VẪN SỐNG sau lỗi: provider stock còn nguyên, cấp service mới + mount plugin vẫn chạy", async () => {
    const ctx = rig();
    new stock.SettingsForms(ctx);
    const before = serviceOf(ctx);
    messageOf(() => new ours.SettingsForms(ctx));
    const after = serviceOf(ctx);
    expect(after.name).toBe(SERVICE);
    expect(Object.getPrototypeOf(after)).toBe(stock.SettingsForms.prototype);
    expect(Object.getPrototypeOf(after)).toBe(Object.getPrototypeOf(before));
    const sentinel = { alive: true };
    ctx.provide("probe-after-duplicate", sentinel);
    expect(ctx.get("probe-after-duplicate")).toBe(sentinel);
    await ctx.plugin({ apply(): void {} }).await();
    expect(serviceOf(ctx).name).toBe(SERVICE);
  });
});

describe("CÁCH THAY AN TOÀN — BUNDLE-NATIVE: row stock giữ NGUYÊN id, chỉ đổi name sang gói ta", () => {
  // 21/10/2026 (task-196): DSH KHONG cho doi 'name' cua row da ton tai qua patch layer (applyEntryPatches bao
  // "name mismatch" roi skip). Vi vay cach an toan la dinh nghia row trong BUNDLE PATCH cua ta (id stock, name
  // goi ta) — KHONG con disable stock + insert "<id>-ours" nhu truoc. Nhung test nay giu nguyen tinh than:
  // (a) khong co row nao mang id "<id>-ours"; (b) goi cua ta xuat hien trong bundle voi id stock.
  test("(a) settings KHONG con bi mount bang id 'settings-ours'", () => {
    const path = writeAppPatch({ rewrites: [mountFor(rowMetadata())] });
    expect(path.startsWith(TEMP_HOME)).toBe(true);
    const patch = readFileSync(path, "utf8");
    expect(patch).not.toContain("- id: settings-ours");
  });

  test("(b) bundle cua ta dinh nghia row 'settings' voi name goi ta", () => {
    const goc = join(import.meta.dir, "..", "..", "packages", "host", "bundle");
    const tatCa = readdirSync(goc, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".yml"))
      .map((entry) => readFileSync(join(entry.parentPath, entry.name), "utf8"))
      .join("\n");
    expect(tatCa).toContain("name: '@galaxy-blackhole/gbh-settings'");
  });

  test("(c) patch KHONG tat hang row 'settings' cua stock nua", () => {
    const patch = safePatch();
    expect(patch).not.toContain("\n- id: settings\n  disabled: true\n");
  });

  test("(d) KHONG con khoi insert nao cho row 'settings' (bundle lo)", () => {
    const patch = safePatch();
    expect(patch.match(/settings-ours/g) ?? []).toHaveLength(0);
  });
});

describe("Idempotent — hai lượt sinh patch, manifest bất biến", () => {
  test("writeAppPatch hai lần ⇒ cùng một chuỗi byte-for-byte", () => {
    const first = readFileSync(writeAppPatch({ rewrites: [mountFor(rowMetadata())] }), "utf8");
    const second = readFileSync(writeAppPatch({ rewrites: [mountFor(rowMetadata())] }), "utf8");
    expect(second).toBe(first);
    expect(second.length).toBeGreaterThan(0);
  });

  test("manifest + patch repo KHÔNG bị sửa (GBH_HOME cách ly)", () => {
    const before = sha256(readFileSync(MANIFEST, "utf8"));
    safePatch();
    expect(sha256(readFileSync(MANIFEST, "utf8"))).toBe(before);
    expect(before).toBe(MANIFEST_SHA_AT_LOAD);
    expect(existsSync(REPO_APP_PATCH) ? readFileSync(REPO_APP_PATCH, "utf8") : null).toBe(REPO_PATCH_AT_LOAD);
  });
});

describe("Fail-soft — không có rewrite thì không có row của ta", () => {
  test("rewrites rỗng ⇒ patch không có 'settings-ours' lẫn row 'settings'", () => {
    const patch = generate([]);
    expect(patch).not.toContain("settings-ours");
    expect(patch).not.toMatch(/^- id: settings$/m);
    // Fail-soft KHÔNG được làm rỗng cả patch: lớp credentials vẫn còn.
    expect(patch).toContain("- id: credentials");
  });

  test("rewrite ok:false ⇒ bị bỏ qua, patch vẫn không có 'settings-ours'", () => {
    const patch = generate([mountFor(rowMetadata(), false)]);
    expect(patch).not.toContain("settings-ours");
  });
});

describe("aliases · hostAliases — loader resolve id stock về gói ta", () => {
  test("manifest: đúng HAI mảng, mỗi mảng MỘT phần tử, cùng id stock", () => {
    const row = rowMetadata();
    expect(row.aliases).toEqual(["@deepseek-ai/dsh-settings"]);
    expect(row.hostAliases).toEqual(["@deepseek-ai/dsh-settings"]);
    expect(row.aliases).toHaveLength(1);
    expect(row.hostAliases).toHaveLength(1);
    expect(row.moduleIds).toEqual(["@galaxy-blackhole/gbh-settings"]);
    expect(row.insertAs).toBe("settings-ours");
    expect(row.insertDisabled).toEqual({ js: "!ctx.get('profileContext')" });
  });

  test("parseGbhMetadata đọc đúng row ⇒ aliases + hostAliases giữ nguyên (loader resolve stock id)", () => {
    const row = rowMetadata();
    const parsed = parseGbhMetadata(JSON.stringify({ name: SPECIFIER, gbh: { row } }));
    expect(parsed?.row?.aliases).toEqual(["@deepseek-ai/dsh-settings"]);
    expect(parsed?.row?.hostAliases).toEqual(["@deepseek-ai/dsh-settings"]);
    expect(parsed?.row?.insertAs).toBe("settings-ours");
    expect(parsed?.row?.insertDisabled).toEqual({ js: "!ctx.get('profileContext')" });
  });
});
