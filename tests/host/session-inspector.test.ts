/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row session-inspector (HAI MẶT): tập export host · apply rỗng y gốc · luật MỘT id ·
 *      gbh.row đủ id/aliases/moduleIds/tests (KHÔNG còn moved — xem task-162) · dsh.client so bằng
 *      sameAfterIdMap (inject đã rewrite CÓ CHỦ ĐÍCH) · thân factory + CSS
 *      BYTE-IDENTICAL với bundle gốc (có ĐỐI CHỨNG ÂM)
 */

import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleBundleBody, countPlaceholder, PACKAGE_NAME, readCssSource, STOCK_PACKAGE_NAME } from "../../packages/host/session-inspector/src/assemble.ts";
import { CSS_REPLACEMENTS, FRAGMENT_MARKER_LINE, PART_FILES } from "../../packages/host/session-inspector/src/manifest.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "session-inspector");
/** Gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-session-inspector");
/** Entry host của bản gốc. */
const STOCK_ENTRY = join(STOCK, "lib", "index.js");
/** Bundle client của bản gốc — nguồn đối chứng TỪNG BYTE. */
const STOCK_CLIENT = join(STOCK, "lib", "client.js");

/** Sáu gói host ĐANG CHẠY THẬT — đối chứng chuẩn của luật peer (M6-MOUNT-PLAN §1d). */
// 02/11/2026: gói trùng tên "webserver" đã bị xoá — gói đang chạy là thư mục "host-webserver".
const RUNNING = ["account-controller", "directory-picker-auto", "open-in-app", "plugin-inventory", "host-webserver", "settings-controller"];

/** Ngoại lệ ĐÃ GHI của luật peer: settings-controller khai peer mà không khai peerDependencies (đo 18/10/2026). */
const DOCUMENTED_PEER_EXCEPTION = "@deepseek-ai/dsh-typert-protocol";

/** Phần package.json mà test này đọc — khai theo CẤU TRÚC, không import type của gói nào. */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Bảng export của package. */
  exports?: Record<string, unknown>;
  /** Hợp đồng peer với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật (luật: peer không bao giờ nằm ở đây). */
  dependencies?: Record<string, string>;
  /** Metadata nửa client của DSH. */
  dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } };
  /** Metadata row của ta. */
  gbh?: { peers?: unknown; row?: { id?: string; moved?: boolean; aliases?: string[]; moduleIds?: string[]; tests?: string[] }; row_unmounted_ly_do?: unknown };
}

/** Đường dẫn ARTIFACT nửa host đã build trong thư mục tạm (gán trong beforeAll). */
let artifact = "";
/** Đường dẫn ARTIFACT nửa client đã build trong thư mục tạm (gán trong beforeAll). */
let clientArtifact = "";
/** Thư mục tạm chứa artifact (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), "gbh-session-inspector-"));
  const build = (await import(join(PKG, "build.ts"))) as { buildPackage: (outDir?: string) => Promise<{ host: string; client: string }> };
  const built = await build.buildPackage(outDir);
  artifact = built.host;
  clientArtifact = built.client;
});

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/**
 * Đọc một file UTF-8.
 * Nhận: đường dẫn tuyệt đối.
 * Trả: nội dung file.
 */
async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG bốn khuôn mà tools/check/rows.ts dùng,
 * để phép so của ta và phép so của cổng không bao giờ lệch nhau.
 * Nhận: nội dung file.
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    const name = m[1];
    if (name !== undefined) out.add(name);
  }
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return [...out].sort();
}

/**
 * Đọc package.json thành đối tượng có kiểu.
 * Nhận: đường dẫn tuyệt đối của manifest.
 * Trả: manifest đã parse.
 */
async function readManifest(path: string): Promise<Manifest> {
  return JSON.parse(await readText(path)) as Manifest;
}

/**
 * Danh sách peer của ta trong gbh.peers, đã lọc phần tử không phải chuỗi.
 * Nhận: manifest.
 * Trả: mảng tên package peer.
 */
function peerList(manifest: Manifest): string[] {
  const raw = manifest.gbh?.peers;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string").sort();
}

/**
 * Phép kiểm 1d của M6-MOUNT-PLAN: gbh.peers là TẬP CON của peerDependencies, so PHẦN TỬ (không so số lượng).
 * Nhận: manifest.
 * Trả: mảng tên peer có trong gbh.peers mà KHÔNG có trong peerDependencies (rỗng = đạt).
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return peerList(manifest).filter((peer) => !declared.has(peer));
}

/**
 * Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE.
 * Nhận: văn bản cần băm.
 * Trả: chuỗi sha256 hex.
 */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/** Dòng mở thân factory trong bundle gốc. */
const BODY_OPEN = "\t\tvar module = { exports: {} };";
/** Dòng kết thân factory trong bundle gốc. */
const BODY_CLOSE = "\t\treturn module.exports;";

/**
 * Rút THÂN FACTORY của bundle: từ `var module …` tới `return module.exports;` (hai đầu tính cả).
 * Nhận: nội dung bundle.
 * Trả: văn bản thân factory, NGUYÊN VĂN.
 */
function factoryBody(text: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === BODY_OPEN);
  const end = lines.findIndex((line) => line === BODY_CLOSE);
  if (start < 0 || end <= start) throw new Error("khong thay than factory trong bundle goc");
  return lines.slice(start, end + 1).join("\n");
}

/**
 * Đếm số khối CSS nhúng trong một bundle (`const css$N = "…"` — khuôn tsdown).
 * Nhận: nội dung bundle.
 * Trả: số khối CSS.
 */
function cssBlocks(text: string): number {
  return [...text.matchAll(/^\t\tconst (css(?:\$\d+)?) = (".*");$/gm)].length;
}

/**
 * Rút chuỗi CSS NGUYÊN VĂN của bundle (đã giải mã JSON).
 * Nhận: nội dung bundle.
 * Trả: văn bản CSS, hoặc null khi bundle không nhúng CSS.
 */
function cssTextOf(text: string): string | null {
  const line = text.split("\n").find((item) => item.startsWith("\t\tconst css = "));
  if (line === undefined) return null;
  const m = /^\t\tconst (css(?:\$\d+)?) = ("(?:[^"\\]|\\.)*");$/.exec(line);
  if (m === null) return null;
  return JSON.parse(m[2] as string) as string;
}

/**
 * Đếm số lời gọi load({ id }) trong artifact và trả các id đọc được.
 * Nhận: nội dung artifact.
 * Trả: mảng id, theo thứ tự xuất hiện.
 */
function loadIds(text: string): string[] {
  return [...text.matchAll(/\b__ModuleLoader__\s*\.\s*load\s*\(\s*\{\s*id\s*:\s*"([^"]+)"/g)].map((m) => m[1] as string);
}

/** Nội dung các lát NGUYÊN VĂN của ta, theo đúng thứ tự manifest. */
const PART_SOURCES: Promise<string[]> = Promise.all(PART_FILES.map((file) => readText(join(PKG, "src", file))));

/**
 * Bảng CSS đã đọc từ đĩa, đúng như build.ts nạp.
 * Nhận: không.
 * Trả: ánh xạ điểm thay thế → văn bản CSS nguyên văn.
 */
async function cssMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const item of CSS_REPLACEMENTS) map.set(item.placeholder, readCssSource(await readText(join(PKG, "src", item.file))));
  return map;
}

describe("A. TẬP EXPORT nửa HOST trên ARTIFACT — ta phải BẰNG bản gốc", () => {
  test("tập export ta = tập export gốc = [apply], KHÔNG có default", async () => {
    const ours = (await import(artifact)) as Record<string, unknown>;
    const stock = (await import(STOCK_ENTRY)) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(exportNames(await readText(artifact))).toEqual(exportNames(await readText(STOCK_ENTRY)));
    expect(exportNames(await readText(artifact))).toEqual(["apply"]);
    expect(typeof ours["apply"]).toBe("function");
    expect("default" in ours).toBe(false);
  });

  test("artifact nửa host KHÔNG đăng ký id module nào (grep -c = 0) và không có __ModuleLoader__", async () => {
    const code = await readText(artifact);
    expect([...code.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect([...code.matchAll(/export\s*\{/g)].length).toBe(1);
  });
});

describe("B. HÀNH VI apply nửa HOST — rỗng y bản gốc, không chạm ctx", () => {
  test("apply.length = 0 ở CẢ HAI bên, gọi (kể cả nhiều lần) trả undefined và không ném", async () => {
    const ours = (await import(artifact)) as { apply: (...args: unknown[]) => unknown };
    const stock = (await import(STOCK_ENTRY)) as { apply: (...args: unknown[]) => unknown };
    expect(ours.apply.length).toBe(stock.apply.length);
    expect(ours.apply.length).toBe(0);
    expect(ours.apply()).toBeUndefined();
    expect(ours.apply()).toBeUndefined();
    expect(ours.apply(undefined, 0)).toBeUndefined();
  });

  test("ctx giả NÉM nếu bị đọc/ghi ⇒ cả hai bên đều không chạm thuộc tính nào", async () => {
    const ours = (await import(artifact)) as { apply: (...args: unknown[]) => unknown };
    const stock = (await import(STOCK_ENTRY)) as { apply: (...args: unknown[]) => unknown };
    const trap = new Proxy({}, {
      get() { throw new Error("apply KHÔNG được đọc ctx"); },
      set() { throw new Error("apply KHÔNG được ghi ctx"); },
      has() { throw new Error("apply KHÔNG được hỏi ctx"); },
    });
    expect(ours.apply(trap, null)).toBeUndefined();
    expect(stock.apply(trap, null)).toBeUndefined();
    expect(ours.apply(null)).toBeUndefined();
    expect(ours.apply("không phải context", Symbol("x"), 123n)).toBeUndefined();
  });
});

describe("C. KHAI BÁO ROW — gbh.row (KHÔNG còn moved) + aliases/moduleIds + dsh.client y bản gốc", () => {
  test("package.json: gbh.row đủ id/aliases/moduleIds/tests; dsh.client ĐÚNG inject+platform gốc; exports có ./client", async () => {
    const meta = await readManifest(join(PKG, "package.json"));
    const stockMeta = await readManifest(join(STOCK, "package.json"));
    expect(meta.name).toBe(PACKAGE_NAME);
    expect(meta.gbh?.row?.id).toBe("session-inspector");
    // 20/10/2026 — KHÔNG phải lỗi logic: lô đổi tên brand đã đổi id bundle TỰ KHAI sang PACKAGE_NAME
    // (GBH) nên ngoại lệ hygiene `moved: true` (chỉ dành cho gói DI CHUYỂN mà đổi tên sẽ phá id bundle)
    // không còn cần; manifest bỏ cờ này và khai row ĐẦY ĐỦ (id/aliases/moduleIds/tests + README §4).
    // Ca này canh ĐÚNG hình dạng khai báo hiện tại, không nới ngưỡng: row vẫn phải đủ mọi khoá dưới đây.
    expect(meta.gbh?.row?.moved).toBeUndefined();
    expect(meta.gbh?.row?.tests).toEqual(["tests/host/session-inspector.test.ts"]);
    // LUẬT MỘT CHỖ (mục 8): id stock CHỈ ở aliases, KHÔNG ở moduleIds.
    expect(meta.gbh?.row?.aliases).toEqual([STOCK_PACKAGE_NAME]);
    expect(meta.gbh?.row?.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh?.row?.moduleIds?.includes(STOCK_PACKAGE_NAME)).toBe(false);
    // dsh.client: đúng 5 id module + platform như gốc (thiếu nửa client ⇒ mất tab Session Log).
    // 20/10/2026 — inject của ta nay là id GBH (rewrite CÓ CHỦ ĐÍCH) ⇒ so SAU bản đồ id với ĐÚNG mảng
    // inject của bản gốc; vẫn giữ phép so CẢ OBJECT + đếm 5.
    expect(meta.dsh?.client?.inject).toHaveLength(5);
    expect(sameAfterIdMap(meta.dsh?.client?.inject, stockMeta.dsh?.client?.inject)).toBe(true);
    expect(sameAfterIdMap(meta.dsh?.client, stockMeta.dsh?.client)).toBe(true);
    expect(meta.dsh?.client?.platform).toBe(stockMeta.dsh?.client?.platform);
    expect(meta.dsh?.client?.immediately).toBeUndefined();
    expect(meta.exports?.["./client"]).toBe("./lib/client.js");
    expect(meta.gbh?.row_unmounted_ly_do).toBeUndefined();
  });

  test("artifact nửa client: ĐÚNG MỘT lời gọi load, id = tên package", async () => {
    const art = await readText(clientArtifact);
    // 08/11/2026: đã THỬ khai thêm id gói gốc (để entry alias của gbh.row materialize) và web boot CHẾT
    // ("import failed" vì tầng nạp nạp lại cùng URL cho entry alias ⇒ bundle chạy lần hai, tự đăng ký trùng).
    // Nay giữ ĐÚNG MỘT id của ta; id gốc do gbh.row.aliases + bản stock trong kernel phục vụ.
    expect(loadIds(art)).toEqual([PACKAGE_NAME]);
    // ĐẾM LỜI GỌI ĐĂNG KÝ, không đếm chuỗi "id: @…" (id trong artifact nằm sau JSON.stringify nên có ngoặc kép).
    expect([...art.matchAll(/__ModuleLoader__\s*\.\s*load\s*\(/g)].length).toBe(1);
    // ⚠️ Id gốc VẪN xuất hiện trong thân bundle ở dạng KHÁC id: tag CSS của module
    // inspector.module.css ("@deepseek-ai/dsh-experimental-session-inspector/inspector.module.css")
    // là NGUYÊN VĂN bản gốc — sửa nó là phá byte-identity, mà nó KHÔNG phải id đăng ký module.
    expect(art.includes('"@deepseek-ai/dsh-experimental-session-inspector/inspector.module.css"')).toBe(true);
    expect(loadIds(art).includes(STOCK_PACKAGE_NAME)).toBe(false);
  });

  test("id bundle TỰ KHAI = TÊN PACKAGE (điều kiện materialize của tầng nạp, không phải lựa chọn thẩm mỹ)", async () => {
    // materialize(id) tra factories.get(id) với id = DÒNG ĐỒ THỊ = tên package; factory lại khoá theo id
    // bundle TỰ KHAI. Lệch nhau ⇒ 'no registered factory for "…"' ⇒ entry chết ⇒ mất màn Session Log.
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-session-inspector");
    const meta = await readManifest(join(PKG, "package.json"));
    expect(meta.name).toBe(PACKAGE_NAME);
    expect(meta.gbh?.row?.moduleIds?.[0]).toBe(meta.name);
    expect(loadIds(await readText(clientArtifact))[0]).toBe(meta.name);
  });
});

describe("D. PEER — gbh.peers ⊆ peerDependencies, SO PHẦN TỬ (có đối chứng âm)", () => {
  test("gói ta: gbh.peers = [] ⇒ hiệu tập rỗng (TRUNG THỰC vì apply không inject seam nào)", async () => {
    const meta = await readManifest(join(PKG, "package.json"));
    expect(peerList(meta)).toEqual([]);
    expect(missingPeers(meta)).toEqual([]);
    expect(Object.keys(meta.dependencies ?? {})).toEqual([]);
  });

  test("ĐỐI CHỨNG ÂM: peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau ⇒ phép so số lượng nói OK, phép so phần tử bắt được tên thiếu", () => {
    const sneaky: Manifest = { name: "@galaxy-blackhole/gbh-gia", gbh: { peers: ["a", "z"] }, peerDependencies: { a: "1", b: "1" } };
    expect(peerList(sneaky).length).toBe(Object.keys(sneaky.peerDependencies ?? {}).length);
    expect(missingPeers(sneaky)).toEqual(["z"]);
  });

  test("ĐỐI CHỨNG 6 gói host ĐANG CHẠY (M6-MOUNT-PLAN §1d): chỉ ngoại lệ đã ghi của settings-controller được lệch", async () => {
    for (const name of RUNNING) {
      const running = await readManifest(join(ROOT, "packages", "host", name, "package.json"));
      expect(missingPeers(running).filter((peer) => peer !== DOCUMENTED_PEER_EXCEPTION)).toEqual([]);
    }
    const exception = await readManifest(join(ROOT, "packages", "host", "settings-controller", "package.json"));
    expect(missingPeers(exception).every((peer) => peer === DOCUMENTED_PEER_EXCEPTION)).toBe(true);
  });
});

describe("E. LOCALE — luật 000e: chép byte-for-byte", () => {
  test("en.json + zh.json của ta KHỚP sha256 bản gốc, và giữ meta.title", async () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(PKG, "locale", name));
      const stock = await readFile(join(STOCK, "locale", name));
      expect(sha256(ours.toString("utf8"))).toBe(sha256(stock.toString("utf8")));
      expect(JSON.parse(ours.toString("utf8"))).toEqual(JSON.parse(stock.toString("utf8")));
    }
    const en = JSON.parse(await readText(join(PKG, "locale", "en.json"))) as { meta?: { title?: string } };
    expect(en.meta?.title).toBe("Session Log");
  });
});

describe("F. DE-BUNDLE — thân factory + CSS BYTE-IDENTICAL với bundle gốc", () => {
  test("6 lát, mỗi lát ≤ 1000 dòng, mọi lát là module HỢP LỆ (có export {}; và header)", async () => {
    expect(PART_FILES.length).toBe(6);
    const sources = await PART_SOURCES;
    for (const [index, file] of PART_FILES.entries()) {
      const source = sources[index] as string;
      expect(source.split("\n").length).toBeLessThan(1000);
      expect(source.includes("export {};")).toBe(true);
      expect(source.split("\n")[0]).toBe("/**");
      expect(source.includes("// @ts-nocheck")).toBe(true);
      expect(file.startsWith("parts/part-0")).toBe(true);
    }
  });

  test("ghép 6 lát + 1 module CSS ⇒ THÂN FACTORY TRÙNG TỪNG BYTE (SHA-256 bằng nhau)", async () => {
    const stockBody = factoryBody(await readText(STOCK_CLIENT));
    const ours = assembleBundleBody(await PART_SOURCES, await cssMap());
    expect(ours.split("\n").length).toBe(4238);
    // P3 (04/11/2026): dong require module ao store dai hon 5 byte.
    expect(Buffer.byteLength(ours)).toBe(167973);
    // P3 (04/11/2026): than factory mang id MOI cua module ao store => quy nguoc roi moi so byte.
    const quyStore = (text: string): string =>
      text
        .split("@galaxy-blackhole/gbh-client-store")
        .join("@deepseek-ai/dsh-client-store")
        .split("@galaxy-blackhole/gbh-client-ui-primitives")
        .join("@deepseek-ai/dsh-client-ui-primitives");
    expect(quyStore(ours)).toBe(stockBody);
    expect(sha256(quyStore(ours))).toBe("048c62c05f3d97ee8e83d3feae39e625f6292e22ff9530ad5a157fb186cc36e5");
    expect(sha256(quyStore(ours))).toBe(sha256(stockBody));
  });

  test("artifact chứa thân factory NGUYÊN VĂN như một chuỗi con LIỀN MẠCH (không thụt lề lại)", async () => {
    const art = await readText(clientArtifact);
    const stockBody = factoryBody(await readText(STOCK_CLIENT));
    expect(
      art
          .split("@galaxy-blackhole/gbh-client-store")
          .join("@deepseek-ai/dsh-client-store")
          .split("@galaxy-blackhole/gbh-client-ui-primitives")
          .join("@deepseek-ai/dsh-client-ui-primitives")
          .includes(stockBody),
    ).toBe(true);
    // Không còn dấu vết phần giao kèo của lát trong artifact.
    expect(FRAGMENT_MARKER_LINE.test(art)).toBe(false);
    expect(art.includes("@ts-nocheck")).toBe(false);
    expect(art.includes("__GBH_")).toBe(false);
  });

  test("CSS: ĐÚNG MỘT khối như bản gốc, chuỗi CSS NGUYÊN VĂN TỪNG BYTE, điểm thay thế xuất hiện đúng 1 lần", async () => {
    const stockText = await readText(STOCK_CLIENT);
    const art = await readText(clientArtifact);
    expect(cssBlocks(stockText)).toBe(1);
    expect(cssBlocks(art)).toBe(1);
    expect(CSS_REPLACEMENTS.length).toBe(1);
    const stockCss = cssTextOf(stockText);
    const oursCss = cssTextOf(art);
    expect(oursCss).toBe(stockCss);
    expect(sha256(oursCss as string)).toBe("96655272c837046711eee80bb93392b590ce8e5ed976f63b3a9ca2ca59993aa3");
    expect(Buffer.byteLength(oursCss as string)).toBe(6679);
    expect(sha256(readCssSource(await readText(join(PKG, "src", CSS_REPLACEMENTS[0]?.file as string))))).toBe(sha256(oursCss as string));
    expect(countPlaceholder(await PART_SOURCES, CSS_REPLACEMENTS[0]?.placeholder as string)).toBe(1);
  });

  test("ĐỐI CHỨNG ÂM: sửa ĐÚNG 1 ký tự (GIỮ NGUYÊN ĐỘ DÀI) trong một lát ⇒ SHA ĐỎ; hoàn nguyên ⇒ XANH", async () => {
    const stockBody = factoryBody(await readText(STOCK_CLIENT));
    const sources = await PART_SOURCES;
    const css = await cssMap();
    const good = assembleBundleBody(sources, css);
    // P3 (04/11/2026): quy nguoc id store MOI truoc khi so byte.
    const quyStore = (text: string): string =>
      text
        .split("@galaxy-blackhole/gbh-client-store")
        .join("@deepseek-ai/dsh-client-store")
        .split("@galaxy-blackhole/gbh-client-ui-primitives")
        .join("@deepseek-ai/dsh-client-ui-primitives");
    expect(quyStore(good)).toBe(stockBody);
    // Chọn ký tự trong phần THÂN (không phải header) và ĐỔI HOA một chữ — độ dài KHÔNG đổi, nên phép
    // so độ dài KHÔNG bắt được; chỉ SHA (và phép so chuỗi) bắt được. Đây là bài học của cordis-client-runner.
    const index = 3;
    const original = sources[index] as string;
    // "		function " = khai báo hàm THẬT trong bundle gốc (không phải dòng vỏ __gbh_fragment__ ở cột 0).
    const at = original.indexOf("\t\tfunction ");
    expect(at).toBeGreaterThan(0);
    const position = at + "\t\tfunctio".length;
    const mutated = [...sources];
    mutated[index] = original.slice(0, position) + (original[position] as string).toUpperCase() + original.slice(position + 1);
    expect(mutated[index]).not.toBe(original);
    expect((mutated[index] as string).length).toBe(original.length);
    const bad = assembleBundleBody(mutated, css);
    // BA SỐ ĐO của phép đối chứng âm: độ dài BẰNG NHAU (phép so độ dài mù), byte khác 1, SHA khác.
    expect(bad.length).toBe(good.length);
    expect(Buffer.byteLength(bad)).toBe(Buffer.byteLength(good));
    expect(sha256(bad)).not.toBe(sha256(stockBody));
    expect(bad).not.toBe(stockBody);
    // Hoàn nguyên ⇒ xanh lại.
    expect(
      assembleBundleBody(sources, css)
        .split("@galaxy-blackhole/gbh-client-store")
        .join("@deepseek-ai/dsh-client-store")
        .split("@galaxy-blackhole/gbh-client-ui-primitives")
        .join("@deepseek-ai/dsh-client-ui-primitives"),
    ).toBe(stockBody);
    expect(
      sha256(
        assembleBundleBody(sources, css)
          .split("@galaxy-blackhole/gbh-client-store")
          .join("@deepseek-ai/dsh-client-store")
          .split("@galaxy-blackhole/gbh-client-ui-primitives")
          .join("@deepseek-ai/dsh-client-ui-primitives"),
      ),
    ).toBe(sha256(stockBody));
  });
});

describe("G. CHẠY THẬT trong window giả — artifact đăng ký 1 factory và export BẰNG bản gốc", () => {
  /**
   * Stub peer tối thiểu: nửa browser chỉ dùng các namespace qua require (createSnapshotStore, jsx,
   * useAnchoredPosition, createPortal…), nên một hàm "vạn năng" đủ để factory nạp mà không chạm DOM.
   * Nhận: tên module được require.
   * Trả: đối tượng stub — mọi thuộc tính là cùng một hàm vạn năng.
   */
  function stubFor(): unknown {
    // ⚠️ KHÔNG tham chiếu chính biến proxy trong initializer của nó (tsc: TS7022 'implicitly has type any
    // because it is referenced in its own initializer'). Một ô giữ trung gian cắt vòng tự tham chiếu.
    let universal: unknown;
    const proxy = new Proxy(function universalStub() { return universal; }, {
      get: () => universal,
      // Hai trap này bắt buộc trả OBJECT theo kiểu của lib.es5 ⇒ ép kiểu tường minh.
      apply: () => universal as object,
      construct: () => universal as object,
    });
    universal = proxy;
    return proxy;
  }

  /**
   * Nạp một bundle classic vào window giả rồi chạy factory với peer stub.
   * Nhận: mã bundle (script classic gọi window.__ModuleLoader__.load).
   * Trả: { ids, exports } — id đã đăng ký và export của factory đầu tiên.
   */
  function runBundle(code: string): { ids: string[]; exports: Record<string, unknown> } {
    const registrations: { id: string; factory: (require: (spec: string) => unknown) => Record<string, unknown> }[] = [];
    const globals = globalThis as unknown as { window?: { __ModuleLoader__?: { load: (registration: never) => void } } };
    const previous = globals.window;
    globals.window = { __ModuleLoader__: { load: (registration: never) => registrations.push(registration) } };
    try {
      new Function(code)();
    } finally {
      globals.window = previous;
    }
    const first = registrations[0];
    if (first === undefined) throw new Error("bundle khong dang ky factory nao");
    const exports = first.factory(() => stubFor());
    return { ids: registrations.map((item) => item.id), exports };
  }

  test("artifact của ta: 1 id, export [apply, inject], inject = 6 service như gốc", async () => {
    const ours = runBundle(await readText(clientArtifact));
    expect(ours.ids).toEqual([PACKAGE_NAME]);
    expect(Object.keys(ours.exports).sort()).toEqual(["apply", "inject"]);
    expect(typeof ours.exports["apply"]).toBe("function");
    expect(ours.exports["inject"]).toEqual(["slots", "locale", "sessions", "uiSession", "uiConversation", "sidebarRightTabs"]);
  });

  test("bản GỐC chạy trong CÙNG window giả cho tập export BẰNG HỆT (đối chứng dương của phép so hành vi)", async () => {
    const stock = runBundle(await readText(STOCK_CLIENT));
    const ours = runBundle(await readText(clientArtifact));
    expect(stock.ids).toEqual([STOCK_PACKAGE_NAME]);
    expect(Object.keys(ours.exports).sort()).toEqual(Object.keys(stock.exports).sort());
    expect(ours.exports["inject"]).toEqual(stock.exports["inject"]);
    expect(typeof ours.exports["apply"]).toBe(typeof stock.exports["apply"]);
  });
});