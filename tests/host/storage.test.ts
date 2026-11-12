/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-storage: đo trên ARTIFACT, đối chứng TRỰC TIẾP với chính bundle gốc
 *      (tập export · từ vựng lỗi · sổ backend · mount dạng dữ liệu trên Context cordis THẬT · C6 danh tính),
 *      quy ước gbh.peers ⊆ peerDependencies kèm ĐỐI CHỨNG ÂM, và TEST CANH chống khai gbh.row sớm.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/storage/build.ts";
import { peerRangeProblems } from "./peer-range-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "storage");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-storage", "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với bản dưới. */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà bundle gốc nạp. */
const STOCK_CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer lúc nạp. */
const OUT = join(PKG, ".test-lib");

/** Bundle gốc nạp động — sáu export đúng như bản trong kernel cấp. */
const stockMod = (await import(STOCK)) as unknown as Record<string, any>;
/** Module của TA đã build (điền trong `beforeAll`). */
let ourMod: Record<string, any>;

/** Hình dạng backend tối thiểu mà sổ cần: một phương thức `close` idempotent. */
interface FakeBackend {
  /** Nhãn để nhận ra đúng thể hiện đã đăng ký. */
  readonly label: string;
  /** Đóng môi trường lưu — sổ KHÔNG tự gọi; test chỉ cần đúng hình dạng hợp đồng. */
  close(): Promise<void>;
}

/**
 * Dựng một backend giả mang nhãn.
 * Nhận: nhãn duy nhất cho thể hiện.
 * Trả: vật thể đúng hình dạng `StorageBackend`.
 */
function makeBackend(label: string): FakeBackend {
  return { label, close: async () => undefined };
}

/**
 * Chạy một lượt gọi và trả mô tả lỗi thay vì ném — để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi mô tả `{name, code, message}` hoặc `(khong nem)`.
 */
function errorOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; code?: string; message?: string };
    return JSON.stringify({ name: subject.name, code: subject.code, message: subject.message });
  }
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

/**
 * Bề mặt prototype của một lớp dưới dạng danh sách tên thuộc tính riêng, đã sắp xếp.
 * Nhận: lớp cần đo.
 * Trả: mảng tên phương thức/getter của prototype.
 */
function prototypeNames(ctor: any): string[] {
  return Object.getOwnPropertyNames(ctor.prototype).sort();
}

beforeAll(async () => {
  const file = await buildPackage(OUT);
  ourMod = (await import(file)) as Record<string, any>;
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row storage — ARTIFACT và bề mặt service", () => {
  test("ARTIFACT: tập export của ta = tập export bản gốc, 0 id module, default = lớp Storage", () => {
    const oursText = readFileSync(join(OUT, "index.js"), "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual([
      "BackendRegistry",
      "Storage",
      "StorageError",
      "UNIT_NAME_RE",
      "default",
      "storageBackendServiceKey",
    ]);
    // Row HOST thuần: KHÔNG có bộ nạp module nào ⇒ đếm id stock trong artifact phải là 0.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    expect(stockText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Chỉ một module ngoài duy nhất được nạp: kernel cordis (peer duy nhất của gói).
    expect(oursText).toContain('from "@deepseek-ai/cordis"');
    // Quan hệ default ↔ lớp, và hình dạng prototype của cả ba lớp công khai.
    expect(ourMod.default).toBe(ourMod.Storage);
    expect(stockMod.default).toBe(stockMod.Storage);
    expect(ourMod.Storage.name).toBe(stockMod.Storage.name);
    for (const name of ["Storage", "BackendRegistry", "StorageError"]) {
      expect(prototypeNames(ourMod[name])).toEqual(prototypeNames(stockMod[name]));
    }
    expect(prototypeNames(ourMod.Storage)).toEqual(["constructor", "domain", "form", "mount"]);
    // Mẫu tên đơn vị: cùng một biểu thức chính quy, không phải bản "tương đương".
    expect(String(ourMod.UNIT_NAME_RE)).toBe(String(stockMod.UNIT_NAME_RE));
    expect(String(ourMod.UNIT_NAME_RE)).toBe("/^[a-z][a-z0-9_]*$/");
  });

  test("từ vựng lỗi: đủ BẢY mã, cùng name/code/message/cause ở cả hai bên", () => {
    const codes = [
      "backend-not-found",
      "form-not-mounted",
      "duplicate-backend",
      "duplicate-mount",
      "version-mismatch",
      "malformed-medium",
      "closed",
    ];
    const cause = new Error("nguyen nhan goc");
    for (const code of codes) {
      const ours = new ourMod.StorageError(code, "mo ta " + code, { cause });
      const theirs = new stockMod.StorageError(code, "mo ta " + code, { cause });
      expect(ours).toBeInstanceOf(Error);
      expect(ours.name).toBe(theirs.name);
      expect(ours.name).toBe("StorageError");
      expect(ours.code).toBe(theirs.code);
      expect(ours.code).toBe(code);
      expect(ours.message).toBe(theirs.message);
      expect((ours as { cause?: unknown }).cause).toBe(cause);
      expect((theirs as { cause?: unknown }).cause).toBe(cause);
    }
    // Không truyền `options` ⇒ `cause` vắng mặt y nhau (không phải `undefined` được đặt tường minh).
    expect("cause" in new ourMod.StorageError("closed", "x")).toBe("cause" in new stockMod.StorageError("closed", "x"));
  });

  test("UNIT_NAME_RE và storageBackendServiceKey: cùng kết quả cho cả 9 đầu vào", () => {
    const names = ["json", "a", "a1_b2", "Json", "_a", "1a", "a-b", "a b", ""];
    expect(names.map((name) => ourMod.UNIT_NAME_RE.test(name))).toEqual(
      names.map((name) => stockMod.UNIT_NAME_RE.test(name)),
    );
    for (const name of [...names, "sqlite", "storage.backend.x"]) {
      expect(ourMod.storageBackendServiceKey(name)).toBe(stockMod.storageBackendServiceKey(name));
    }
    expect(ourMod.storageBackendServiceKey("json")).toBe("storage.backend.json");
    expect(ourMod.storageBackendServiceKey("")).toBe("storage.backend.");
  });
});

describe("row storage — sổ backend đối chứng với chính bundle gốc", () => {
  test("register/get/names: cùng thứ tự, cùng thể hiện, cùng câu lỗi khi trùng tên", () => {
    const ours = new ourMod.BackendRegistry();
    const theirs = new stockMod.BackendRegistry();
    expect(ours.names()).toEqual([]);
    expect(ours.names()).toEqual(theirs.names());
    const json = makeBackend("json");
    const sqlite = makeBackend("sqlite");
    ours.register("json", json);
    ours.register("sqlite", sqlite);
    theirs.register("json", json);
    theirs.register("sqlite", sqlite);
    expect(ours.names()).toEqual(["json", "sqlite"]);
    expect(ours.names()).toEqual(theirs.names());
    expect(ours.get("json")).toBe(json);
    expect(theirs.get("json")).toBe(json);
    // Trùng tên: ném TRƯỚC khi ghi, cùng mã + cùng câu.
    expect(errorOf(() => ours.register("json", makeBackend("khac")))).toBe(
      errorOf(() => theirs.register("json", makeBackend("khac"))),
    );
    expect(errorOf(() => ours.register("json", json))).toBe(
      JSON.stringify({
        name: "StorageError",
        code: "duplicate-backend",
        message: "storage backend 'json' is already registered",
      }),
    );
    // Tên chưa đăng ký: câu lỗi liệt kê ĐÚNG các tên đang có, và `none` khi sổ rỗng.
    expect(errorOf(() => ours.get("nope"))).toBe(errorOf(() => theirs.get("nope")));
    expect(errorOf(() => ours.get("nope"))).toContain("(registered: json, sqlite)");
    const emptyOurs = new ourMod.BackendRegistry();
    const emptyTheirs = new stockMod.BackendRegistry();
    expect(errorOf(() => emptyOurs.get("nope"))).toBe(errorOf(() => emptyTheirs.get("nope")));
    expect(errorOf(() => emptyOurs.get("nope"))).toContain("(registered: none)");
  });

  test("hàm dọn: gỡ ĐÚNG thể hiện đã đăng ký, idempotent, không gỡ kẻ đăng ký sau", () => {
    const ours = new ourMod.BackendRegistry();
    const theirs = new stockMod.BackendRegistry();
    const first = makeBackend("first");
    const second = makeBackend("second");
    const disposeOurs = ours.register("json", first);
    const disposeTheirs = theirs.register("json", first);
    disposeOurs();
    disposeTheirs();
    expect(ours.names()).toEqual([]);
    expect(ours.names()).toEqual(theirs.names());
    // Gọi lại hàm dọn đã dùng: no-op, không ném.
    disposeOurs();
    disposeTheirs();
    expect(ours.names()).toEqual(theirs.names());
    // Đăng ký LẠI cùng tên rồi gọi hàm dọn CŨ ⇒ KHÔNG được gỡ kẻ mới.
    ours.register("json", second);
    theirs.register("json", second);
    disposeOurs();
    disposeTheirs();
    expect(ours.names()).toEqual(["json"]);
    expect(ours.names()).toEqual(theirs.names());
    expect(ours.get("json")).toBe(second);
    // `names()` là ẢNH CHỤP: sửa mảng trả về không chạm sổ.
    ours.names().push("bia");
    expect(ours.names()).toEqual(["json"]);
  });
});

describe("row storage — kho trên Context cordis THẬT, đối chứng với bản gốc", () => {
  test("tên service `storage` + `backend` là sổ của CHÍNH lớp đó (đường nạp THẬT `ctx.plugin`)", async () => {
    const ourCordis = (await import(OUR_CORDIS)) as unknown as { Context: any; Service: any };
    const stockCordis = (await import(STOCK_CORDIS)) as unknown as { Context: any; Service: any };
    const mine = new ourCordis.Context();
    const theirs = new stockCordis.Context();
    mine.plugin(ourMod.default);
    theirs.plugin(stockMod.default);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const ourService = mine.get("storage");
    const theirService = theirs.get("storage");
    expect(ourService).toBeDefined();
    expect(theirService).toBeDefined();
    expect(ourService.name).toBe(theirService.name);
    expect(ourService.name).toBe("storage");
    expect(ourService.backend).toBeInstanceOf(ourMod.BackendRegistry);
    expect(theirService.backend).toBeInstanceOf(stockMod.BackendRegistry);
    expect(ourService).toBeInstanceOf(ourMod.Storage);
    expect(ourService).toBeInstanceOf(ourCordis.Service);
    // Cùng `Config`: bản gốc KHÔNG khai schema cấu hình ⇒ cả hai đều không có.
    expect(ourMod.Storage.Config).toBeUndefined();
    expect(stockMod.Storage.Config).toBeUndefined();
  });

  test("mount/form/domain: cùng hành vi, cùng câu lỗi; hàm dọn chỉ tháo ĐÚNG facility", async () => {
    const { Context } = (await import(OUR_CORDIS)) as unknown as { Context: any };
    const ours = new ourMod.Storage(new Context());
    const theirs = new stockMod.Storage(new Context());
    expect(errorOf(() => ours.form("domain"))).toBe(errorOf(() => theirs.form("domain")));
    expect(errorOf(() => ours.domain)).toBe(errorOf(() => theirs.domain));
    expect(errorOf(() => ours.form("domain"))).toContain("storage form 'domain' is not mounted");
    const facility = { kind: "domain-facility" };
    const other = { kind: "domain-facility-2" };
    const disposeOurs = ours.mount("domain", facility);
    const disposeTheirs = theirs.mount("domain", facility);
    expect(ours.form("domain")).toBe(facility);
    expect(theirs.form("domain")).toBe(facility);
    expect(ours.domain).toBe(facility);
    expect(theirs.domain).toBe(facility);
    // Trùng khoá: ném `duplicate-mount`, facility ĐANG mount không bị thay.
    expect(errorOf(() => ours.mount("domain", other))).toBe(errorOf(() => theirs.mount("domain", other)));
    expect(ours.form("domain")).toBe(facility);
    // Hàm dọn CŨ không tháo facility mount SAU đó.
    disposeOurs();
    disposeTheirs();
    ours.mount("domain", other);
    theirs.mount("domain", other);
    disposeOurs();
    disposeTheirs();
    expect(ours.form("domain")).toBe(other);
    expect(theirs.form("domain")).toBe(other);
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai sổ backend có bảng RIÊNG: đăng ký bên này không thấy ở bên kia (cả ta và gốc)", () => {
    for (const mod of [ourMod, stockMod]) {
      const a = new mod.BackendRegistry();
      const b = new mod.BackendRegistry();
      expect(a).not.toBe(b);
      expect((a as any).backends).not.toBe((b as any).backends);
      a.register("json", makeBackend("a-json"));
      expect(a.names()).toEqual(["json"]);
      expect(b.names()).toEqual([]);
      expect(errorOf(() => b.get("json"))).toContain("(registered: none)");
    }
  });

  test("hai THỰC THỂ kho có sổ + bảng dạng RIÊNG: mount/đăng ký bên này không lan sang bên kia", async () => {
    const { Context } = (await import(OUR_CORDIS)) as unknown as { Context: any };
    const a = new ourMod.Storage(new Context());
    const b = new ourMod.Storage(new Context());
    expect(a.backend).not.toBe(b.backend);
    expect((a as any).forms).not.toBe((b as any).forms);
    a.backend.register("json", makeBackend("json"));
    a.mount("domain", { kind: "chi-cua-a" });
    expect(a.backend.names()).toEqual(["json"]);
    expect(b.backend.names()).toEqual([]);
    expect(errorOf(() => b.form("domain"))).toContain("storage form 'domain' is not mounted");
    expect(a.form("domain")).toEqual({ kind: "chi-cua-a" });
    // Sửa facility của b không chạm facility của a (hai vật thể riêng, không chia tham chiếu).
    const shared = { kind: "x" };
    a.mount("kv", shared);
    b.mount("kv", { ...shared });
    expect(a.form("kv")).toBe(shared);
    expect(b.form("kv")).not.toBe(shared);
  });
});

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Peer của riêng gói này (ngoài những tên `mount.ts` tự thêm) — danh sách ĐÓNG. */
// `@deepseek-ai/dsh-storage` là peer CHỈ-KIỂU: seam `Context.storage` thuộc MỘT chủ sở hữu là bản gốc (ADR 0009).
const SEAM_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-storage"];

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Chỉ mượn KIỂU (bị xoá lúc build) — không phải seam lúc chạy. */
  devDependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Đầu ra công khai. */
  exports?: Record<string, unknown>;
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`).
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
  test("mọi tên trong gbh.peers đều có trong peerDependencies, đúng dải version của kernel", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of peers) expect(existsSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"))).toBe(true);
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
    // Peer không bao giờ nằm ở `dependencies` (sẽ tạo thể hiện THỨ HAI).
    expect(manifest.dependencies).toBeUndefined();
  });

  test("ĐỐI CHỨNG ÂM: xoá một peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // Xoá SẠCH ⇒ phải báo ĐỦ cả danh sách, không phải một con số.
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
    // THỪA tên vẫn ĐẠT (⊆ chứ không phải =).
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("TEST CANH + 000e cho gói chưa mount", () => {
  test("gbh.row ĐÃ khai (Lead chốt sau ba phép tiền-mount) — id + tests trỏ ĐÚNG file này", () => {
    const manifest = readManifest();
    // TEST CANH đổi chiều theo mục 7 của recipe: viết xong bề mặt thì bật khai và khẳng định NGƯỢC LẠI.
    expect(manifest.gbh?.row).toEqual({ id: "storage", tests: ["tests/host/storage.test.ts"] });
    expect(existsSync(join(REPO, "tests", "host", "storage.test.ts"))).toBe(true);
    // Khai row mà thiếu test ⇒ cổng hygiene đỏ; khai id khác ⇒ tắt NHẦM row stock.
    expect((manifest.gbh?.row as { id?: string }).id).toBe("storage");
  });

  test("000e: bản gốc CÓ `locale/` ⇒ ta ship lại TỪNG BYTE và khai trong exports", () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.exports ?? {})).toContain("./locale/*.json");
    for (const language of ["en", "zh"]) {
      const ours = readFileSync(join(PKG, "locale", language + ".json"));
      const theirs = readFileSync(
        join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-storage", "locale", language + ".json"),
      );
      expect(ours.equals(theirs)).toBe(true);
      // Cùng `meta.title` — tiêu đề hàng trong màn Plugins của DSH đọc đúng khoá này.
      expect(JSON.parse(ours.toString("utf8")).meta.title).toBe(JSON.parse(theirs.toString("utf8")).meta.title);
    }
  });
});
