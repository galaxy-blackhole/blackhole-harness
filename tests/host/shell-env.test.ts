/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-shell-env: tập export đo trên ARTIFACT, đối chứng hành vi với
 *      chính bundle gốc trên Context cordis THẬT (sự thật dựng sẵn · đóng góp · ảnh chụp · ma trận
 *      đường lỗi), ca C6 về DANH TÍNH giữa hai sổ đăng ký, quy ước gbh.peers ⊆ peerDependencies kèm
 *      ĐỐI CHỨNG ÂM, locale byte-for-byte và TEST CANH gbh.row chưa khai.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/shell-env/build.ts";
import type * as OurModule from "../../packages/host/shell-env/src/index.ts";
import { resolveHomeDir } from "../../packages/host/shell-env/src/registry.ts";
import type { BashEnvContributor, ShellEnvExecution } from "../../packages/host/shell-env/src/types.ts";


/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Bundle GỐC trong kernel (CHỈ ĐỌC) — oracle cho mọi ca đối chứng. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-shell-env/lib/index.js");
/** Context cordis THẬT của kernel — cùng một instance với các seam khác. */
const CORDIS = join(REPO, "apps/host/node_modules/@deepseek-ai/cordis/lib/index.js");
/** Manifest của gói — nguồn duy nhất của cả gbh.peers lẫn peerDependencies (JSON được miễn header). */
const MANIFEST = join(REPO, "packages/host/shell-env/package.json");
/** Thư mục locale của TA và của bản gốc (luật 000e). */
const OURS_LOCALE = join(REPO, "packages/host/shell-env/locale");
const STOCK_LOCALE = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-shell-env/locale");
/** Home cố định cho mọi ca — tránh phụ thuộc $DSH_HOME của phiên đang chạy. */
const HOME = "/tmp/gbh-shell-env-test-home";

/**
 * LƯỢT ĐO 01/11/2026: mô-đun của ta nạp từ ARTIFACT (KHÔNG từ `src`) và artifact phân giải peer qua
 * `node_modules/@deepseek-ai` trỏ KERNEL — `src` nạp bản SAO workspace nên `ShellEnvRegistry extends
 * Service` lệch danh tính lớp với bản gốc (ca "apply đăng ký dịch vụ shellEnv" đỏ OAN).
 */
const OUT = join(REPO, "packages", "host", "shell-env", "lib", ".test-build");
rmSync(OUT, { recursive: true, force: true });
const ARTIFACT = await buildPackage(OUT);
mkdirSync(join(OUT, "node_modules"), { recursive: true });
symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
const our = (await import(ARTIFACT)) as typeof OurModule;
const { Config, ShellEnvRegistry, apply, inject, name } = our;

afterAll(() => rmSync(OUT, { recursive: true, force: true }));

/** Kiểu context cordis thật, lấy từ chính chữ ký của lớp (tests/ không resolve được @deepseek-ai/*). */
type RealContext = ConstructorParameters<typeof ShellEnvRegistry>[0];

/** Lớp sổ đăng ký — dùng cho CẢ bản của ta lẫn bản gốc, để so được bề mặt và quan hệ kế thừa. */
type RegistryClass = typeof ShellEnvRegistry;

const cordis = (await import(CORDIS)) as { Context: new () => RealContext };

/** Bản gốc nạp động: đường dẫn tính lúc chạy nên tsc không kéo kiểu của nó vào chương trình. */
const stock = (await import(STOCK)) as {
  name: string;
  inject: string[];
  Config: unknown;
  ShellEnvRegistry: RegistryClass;
  apply: (ctx: RealContext, config?: { dshHome?: string }) => void;
};

/** Vết của một kịch bản: mọi thứ quan sát được, để hai bản cài so bằng toEqual. */
interface Trace {
  /** Ảnh chụp môi trường sau từng bước. */
  snapshots: (Readonly<Record<string, string>> | string)[];
  /** Kết quả list() sau từng bước. */
  lists: { contributor: string; description: string; key: string }[][];
  /** Kết cục của từng phép đăng ký/collect: "ok" hoặc "error:<thông điệp>". */
  outcomes: string[];
}

/** Lượt thi hành có agent — nguồn của DSH_SESSION_ID (id mang ký tự ngoài ASCII để soi méo mã hoá). */
const WITH_AGENT: ShellEnvExecution = { agent: { session: { header: { id: "sess-ế-01" } } } };

/**
 * Chạy một phép, trả kết cục dạng chuỗi thay vì ném — để so cả đường lỗi giữa hai bản.
 * Nhận: hàm cần chạy.
 * Trả: "ok" khi không ném, ngược lại "error:<thông điệp>" (thông điệp so NGUYÊN VĂN).
 */
function attempt(run: () => unknown): string {
  try {
    run();
    return "ok";
  } catch (error) {
    return "error:" + (error instanceof Error ? error.message : String(error));
  }
}

/**
 * Dựng context mới có profileContext (đúng thứ tự dựng của kernel: dịch vụ có trước, rồi mới collect).
 * Nhận: không.
 * Trả: context cordis thật đã cấp profileContext.
 */
function contextWithProfile(): RealContext {
  const ctx = new cordis.Context();
  ctx.provide("profileContext", { name: "blackhole", dir: HOME + "/profiles/blackhole" });
  return ctx;
}

/**
 * Đóng góp tối thiểu: tên + tập khoá khai trước + hàm phân giải cố định.
 * Nhận: tên, bản đồ khoá→mô tả, bản đồ khoá→giá trị trả về.
 * Trả: vật đóng góp đúng hình dạng seam.
 */
function contributor(
  contributorName: string,
  variables: Record<string, string>,
  values: Record<string, unknown>,
): BashEnvContributor {
  return {
    name: contributorName,
    variables: Object.fromEntries(Object.entries(variables).map(([key, description]) => [key, { description }])),
    resolve: () => values as Readonly<Partial<Record<string, string>>>,
  };
}

/**
 * Chạy MỘT kịch bản cố định trên một bản cài (của ta hoặc bản gốc) và ghi lại mọi thứ quan sát được.
 * Nhận: hàm dựng sổ đăng ký + context thật đã có profileContext.
 * Trả: vết { ảnh chụp, danh sách, kết cục } để đối chứng hai bản.
 */
function runScenario(Ctor: RegistryClass, ctx: RealContext): Trace {
  const trace: Trace = { snapshots: [], lists: [], outcomes: [] };
  const registry = new Ctor(ctx, { dshHome: HOME });
  const record = () => {
    trace.snapshots.push(registry.collect({}));
    trace.snapshots.push(registry.collect(WITH_AGENT));
    trace.lists.push(registry.list());
  };
  record();
  const disposeZeta = registry.register(contributor("zeta", { DSH_ZETA: "biến của zeta" }, { DSH_ZETA: "z" }));
  const disposeAlpha = registry.register(
    contributor("alpha", { DSH_BETA: "biến beta", DSH_ALPHA: "biến alpha" }, { DSH_BETA: "b", DSH_ALPHA: "a" }),
  );
  record();
  // Ma trận đường lỗi — mỗi phép đăng ký hỏng KHÔNG được để lại trạng thái.
  trace.outcomes.push(attempt(() => registry.register(contributor("  ", { DSH_X: "x" }, { DSH_X: "1" }))));
  trace.outcomes.push(attempt(() => registry.register(contributor("alpha", { DSH_Y: "y" }, { DSH_Y: "1" }))));
  trace.outcomes.push(attempt(() => registry.register(contributor("p", { OTHER_X: "x" }, {}))));
  trace.outcomes.push(attempt(() => registry.register(contributor("p", { DSH_lower: "x" }, {}))));
  trace.outcomes.push(attempt(() => registry.register(contributor("p", { DSH_: "x" }, {}))));
  trace.outcomes.push(attempt(() => registry.register(contributor("p", { DSH_1A: "x" }, {}))));
  for (const reserved of ["DSH_HOME", "DSH_SHELL", "DSH_SESSION_ID", "DSH_PROFILE", "DSH_PROFILE_DIR"]) {
    trace.outcomes.push(attempt(() => registry.register(contributor("p", { [reserved]: "bị giữ" }, {}))));
  }
  trace.outcomes.push(attempt(() => registry.register(contributor("p", { DSH_EMPTY: "   " }, {}))));
  trace.outcomes.push(attempt(() => registry.register(contributor("gamma", { DSH_ALPHA: "chiếm lại" }, {}))));
  record();
  disposeAlpha();
  record();
  const disposeUndeclared = registry.register(contributor("undeclared", { DSH_DECLARED: "có khai" }, { DSH_OTHER: "x" }));
  trace.outcomes.push(attempt(() => registry.collect({})));
  disposeUndeclared();
  const disposeNonString = registry.register(contributor("nonstring", { DSH_NUM: "số" }, { DSH_NUM: 5 }));
  trace.outcomes.push(attempt(() => registry.collect({})));
  disposeNonString();
  disposeZeta();
  record();
  return trace;
}

/** Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng). */
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

/** SHA-256 của một tệp — dùng để khẳng định locale chép BYTE-FOR-BYTE. */
function sha256(path: string): string {
  return createHash("sha256").update(normalizePackageNames(readFileSync(path, "utf8"))).digest("hex");
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-shell-env-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["Config", "ShellEnvRegistry", "apply", "inject", "name"]);
    expect(exportNames(oursText)).not.toContain("default");
    // Row host thuần: KHÔNG có __ModuleLoader__ nào ⇒ đếm id stock trong artifact phải là 0.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
  });

  test("name · inject · Config khớp bản gốc từng chữ; apply nhận đúng một tham số bắt buộc", () => {
    expect(name).toBe(stock.name);
    expect(name).toBe("shell-env");
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual([]);
    expect(typeof Config).toBe("function");
    expect(String(Config)).toBe(String(stock.Config));
    expect(String(Config)).toBe("{ dshHome?: string }");
    expect(apply.length).toBe(1);
    expect(stock.apply.length).toBe(1);
  });
});

describe("hành vi: sự thật dựng sẵn · đóng góp · ảnh chụp, đối chứng với bản gốc", () => {
  test("cùng kịch bản ⇒ cùng ảnh chụp, cùng danh sách, cùng kết cục từng bước", () => {
    const ours = runScenario(ShellEnvRegistry, contextWithProfile());
    const theirs = runScenario(stock.ShellEnvRegistry, contextWithProfile());
    expect(ours).toEqual(theirs);
  });

  test("giá trị TUYỆT ĐỐI: DSH_HOME · DSH_SHELL · DSH_SESSION_ID · DSH_PROFILE · DSH_PROFILE_DIR", () => {
    const ctx = contextWithProfile();
    const registry = new ShellEnvRegistry(ctx, { dshHome: HOME });
    expect(registry.collect({})).toEqual({
      DSH_HOME: HOME,
      DSH_PROFILE: "blackhole",
      DSH_PROFILE_DIR: HOME + "/profiles/blackhole",
      DSH_SHELL: "1",
    });
    // Ảnh chụp BẤT BIẾN và khoá đã SẮP theo tên biến (đúng thứ tự tất định của bản gốc).
    const snapshot = registry.collect(WITH_AGENT);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.keys(snapshot)).toEqual(["DSH_HOME", "DSH_PROFILE", "DSH_PROFILE_DIR", "DSH_SESSION_ID", "DSH_SHELL"]);
    // Id phiên đi qua NGUYÊN VĂN, kể cả ký tự ngoài ASCII (không bị cắt/cắt byte).
    expect(snapshot.DSH_SESSION_ID).toBe("sess-ế-01");
    // Không có profileContext ⇒ KHÔNG có hai khoá profile (đường dựng của kernel ở lab tối thiểu).
    const bare = new ShellEnvRegistry(new cordis.Context(), { dshHome: HOME });
    expect(bare.collect({})).toEqual({ DSH_HOME: HOME, DSH_SHELL: "1" });
  });

  test("không cần agent: thiếu agent ⇒ KHÔNG có DSH_SESSION_ID (y bản gốc)", () => {
    const ctx = contextWithProfile();
    const ours = new ShellEnvRegistry(ctx, { dshHome: HOME });
    const theirs = new stock.ShellEnvRegistry(contextWithProfile(), { dshHome: HOME });
    const mine = ours.collect({});
    expect(mine).toEqual(theirs.collect({}));
    expect(Object.hasOwn(mine, "DSH_SESSION_ID")).toBe(false);
  });

  test("list() chỉ liệt kê biến do plugin đóng góp, KHÔNG gồm sự thật dựng sẵn", () => {
    const ctx = new cordis.Context();
    const registry = new ShellEnvRegistry(ctx, { dshHome: HOME });
    registry.register(contributor("web-runtime", { DSH_WEB_URL: "URL của Web GUI" }, { DSH_WEB_URL: "http://x" }));
    expect(registry.list()).toEqual([{ contributor: "web-runtime", description: "URL của Web GUI", key: "DSH_WEB_URL" }]);
    expect(registry.list().map((entry) => entry.key)).not.toContain("DSH_HOME");
    expect(registry.list().map((entry) => entry.key)).not.toContain("DSH_SHELL");
  });

  test("apply đăng ký dịch vụ shellEnv trên Context THẬT — cùng tên dịch vụ như bản gốc", () => {
    const oursCtx = new cordis.Context();
    apply(oursCtx, { dshHome: HOME });
    const theirsCtx = new cordis.Context();
    stock.apply(theirsCtx, { dshHome: HOME });
    expect(typeof oursCtx.shellEnv.collect).toBe("function");
    // Quan hệ KẾ THỪA (recipe §2b): hai lớp phải có CÙNG lớp cha — cùng một Service của kernel.
    expect(Object.getPrototypeOf(ShellEnvRegistry)).toBe(Object.getPrototypeOf(stock.ShellEnvRegistry));
    expect(Object.getOwnPropertyNames(ShellEnvRegistry.prototype)).toEqual(
      Object.getOwnPropertyNames(stock.ShellEnvRegistry.prototype),
    );
    expect(oursCtx.shellEnv.collect({})).toEqual(theirsCtx.shellEnv.collect({}));
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai sổ đăng ký độc lập: cùng tên · cùng khoá không xung đột chéo, dọn bên này không lan bên kia", () => {
    const build = (Ctor: RegistryClass) => ({
      a: new Ctor(new cordis.Context(), { dshHome: HOME }),
      b: new Ctor(new cordis.Context(), { dshHome: HOME }),
    });
    const ours = build(ShellEnvRegistry);
    const theirs = build(stock.ShellEnvRegistry);
    for (const side of [ours, theirs]) {
      const spec = () => contributor("web-runtime", { DSH_WEB_URL: "url" }, { DSH_WEB_URL: "http://x" });
      const disposeA = side.a.register(spec());
      side.b.register(spec());
      expect(side.a.list()).toEqual(side.b.list());
      // Phép so SÂU ĐẠT cả khi hai bên chia sẻ một vật ⇒ phải so DANH TÍNH.
      expect(side.a.list()[0]).not.toBe(side.b.list()[0]);
      expect(side.a.collect({})).not.toBe(side.b.collect({}));
      disposeA();
      expect(side.a.list()).toEqual([]);
      expect(side.b.list()).toHaveLength(1);
      // ĐỐI CHỨNG: trong CÙNG một sổ, sở hữu khoá vẫn bị chặn ⇒ tính độc lập KHÔNG đến từ việc tắt phép kiểm.
      expect(() => side.b.register(contributor("khac", { DSH_WEB_URL: "url" }, {}))).toThrow(
        'bash env key "DSH_WEB_URL" is already owned by contributor "web-runtime"; contributor "khac" cannot also own it',
      );
    }
  });

  test("mỗi lượt collect/list trả vật thể MỚI — sửa bản này không lan sang bản kia", () => {
    const registry = new ShellEnvRegistry(new cordis.Context(), { dshHome: HOME });
    const first = registry.collect({});
    const second = registry.collect({});
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    const mutate = () => {
      (first as Record<string, string>).DSH_HOME = "/tmp/khac";
    };
    expect(mutate).toThrow();
    expect(second.DSH_HOME).toBe(HOME);
    const listOne = registry.list();
    expect(listOne).not.toBe(registry.list());
  });
});

/** Manifest của gói — đọc thẳng file vì tests/ không resolve được @deepseek-ai/*. */
const MANIFEST_JSON = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Bản đồ export của package. */
  exports?: Record<string, string>;
  /** Metadata của ta để bh host sinh khối patch. */
  gbh?: { peers?: string[]; row?: { id?: string; tests?: string[] } };
}

/** Peer NGOÀI hai tên mà mount.ts luôn tự thêm (cordis, schemastery) — danh sách ĐÓNG của riêng gói này. */
const SEAM_PEERS = ["@deepseek-ai/dsh-home-paths", "@deepseek-ai/dsh-shell"];

/**
 * Tên còn THIẾU: phần tử của gbh.peers không có mặt trong peerDependencies.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ)", () => {
    const peers = MANIFEST_JSON.gbh?.peers ?? [];
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(MANIFEST_JSON)).toEqual([]);
    for (const peer of peers) {
      const kernel = JSON.parse(readFileSync(join(REPO, "apps/host/node_modules", peer, "package.json"), "utf8")) as {
        version: string;
      };
      expect(MANIFEST_JSON.peerDependencies?.[peer]).toBe(kernel.version);
    }
  });

  test("peer khai ra phải có THẬT trong kernel; hai peer chuẩn cũng phải khai", () => {
    const declared = Object.keys(MANIFEST_JSON.peerDependencies ?? {});
    for (const peer of [...(MANIFEST_JSON.gbh?.peers ?? []), "@deepseek-ai/cordis", "@deepseek-ai/schemastery"]) {
      expect(declared).toContain(peer);
      expect(existsSync(join(REPO, "apps/host/node_modules", peer, "package.json"))).toBe(true);
    }
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const peers = MANIFEST_JSON.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(MANIFEST_JSON);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    expect(missingPeers({ ...MANIFEST_JSON, peerDependencies: {} })).toEqual([...peers].sort());
    // Đối chứng âm thứ hai: THỪA tên vẫn ĐẠT (⊆ chứ không phải =).
    const extra = cloneManifest(MANIFEST_JSON);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });

  test("peer KHÔNG được khai trong dependencies (tránh thể hiện thứ hai)", () => {
    const deps = new Set(Object.keys(MANIFEST_JSON.dependencies ?? {}));
    expect((MANIFEST_JSON.gbh?.peers ?? []).filter((peer) => deps.has(peer))).toEqual([]);
  });
});

describe("luật 000e + TEST CANH: locale byte-for-byte và gbh.row CHƯA khai", () => {
  test("locale/{en,zh}.json TRÙNG BYTE-FOR-BYTE với bản gốc và có trong exports", () => {
    for (const file of ["en.json", "zh.json"]) {
      expect(sha256(join(OURS_LOCALE, file))).toBe(sha256(join(STOCK_LOCALE, file)));
      expect(JSON.parse(readFileSync(join(OURS_LOCALE, file), "utf8"))).toEqual(
        JSON.parse(readFileSync(join(STOCK_LOCALE, file), "utf8")),
      );
    }
    expect(MANIFEST_JSON.exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });

  });

// task-31 (Wave D): home của shell-env — config → $GBH_HOME (mới) → $DSH_HOME (đường lùi tương thích).
describe("task-31 — phân giải home: $GBH_HOME ưu tiên, $DSH_HOME là đường lùi", () => {
  test("config.dshHome thắng mọi biến môi trường", () => {
    expect(resolveHomeDir("/cfg/home", { GBH_HOME: "/env/gbh", DSH_HOME: "/env/dsh" })).toBe("/cfg/home");
  });

  test("$GBH_HOME thắng $DSH_HOME", () => {
    expect(resolveHomeDir(undefined, { GBH_HOME: "/env/gbh", DSH_HOME: "/env/dsh" })).toBe("/env/gbh");
  });

  test("$DSH_HOME vẫn dùng được khi thiếu $GBH_HOME (tương thích bản gốc)", () => {
    expect(resolveHomeDir(undefined, { DSH_HOME: "/env/dsh" })).toBe("/env/dsh");
  });

  test("$GBH_HOME rỗng/khoảng trắng ⇒ rơi tiếp xuống $DSH_HOME", () => {
    expect(resolveHomeDir(undefined, { GBH_HOME: "  ", DSH_HOME: "/env/dsh" })).toBe("/env/dsh");
  });
});
