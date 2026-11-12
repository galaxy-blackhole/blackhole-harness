/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row cordis-client-runner (HAI MẶT): tập export host · apply rỗng y gốc · luật MỘT id ·
 *      gbh.row.moved + aliases/moduleIds · thân factory + CSS BYTE-IDENTICAL với bundle gốc (có ĐỐI CHỨNG ÂM) ·
 *      ĐỐI CHIẾU export/slot với bản gốc + vì sao vẫn giữ moved (load ĐỘNG id: moduleId) — task-16.
 *      20/10/2026: lô đổi tên brand đổi 3 token CSS `--dsh-*`→`--gbh-*` trong artefact ⇒ phép so thân
 *      factory dùng brand-parity (chuẩn hoá ĐỐI XỨNG hai vế), vẫn TOÀN VĂN chứ không nới thành "contains".
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join as joinPath } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleBundleBody, PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/host/cordis-client-runner/src/assemble.ts";
import { moduleIdIssues, moduleRegistrations } from "../../tools/check/rows.ts";
import { brandEqual, sameAfterIdMap } from "../lib/brand-parity.ts";
import { CSS_REPLACEMENTS, FRAGMENT_MARKER_LINE, PART_FILES } from "../../packages/host/cordis-client-runner/src/manifest.ts";

/** Đường dẫn tương đối tới bản GỐC trong kernel (CHỈ ĐỌC). */
const STOCK_DIR = "../../apps/host/node_modules/@deepseek-ai/dsh-cordis-client-runner";
/** Đường dẫn tương đối tới ARTIFACT của ta (kết quả build.ts). */
const OURS_DIR = "../../packages/host/cordis-client-runner";

/**
 * Đọc một file của gói (đường dẫn tương đối từ thư mục test).
 * Nhận: thư mục gói + đường dẫn con.
 * Trả: nội dung UTF-8 của file.
 */
function read(dir: string, rel: string): string {
  return readFileSync(new URL(dir + "/" + rel, import.meta.url), "utf8");
}

/**
 * Đọc nội dung một lát của gói ta.
 * Nhận: đường dẫn tương đối so với src/ (ví dụ parts/part-01.ts).
 * Trả: nội dung file lát.
 */
function readPart(rel: string): string {
  return read(OURS_DIR, "src/" + rel);
}

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG hai regex của tools/check/rows.ts.
 * Nhận: nội dung artifact.
 * Trả: mảng tên export đã sắp xếp (gồm "default" nếu có).
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (m[1] as string).split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) out.add(name);
    }
  }
  if (/export\s+default/.test(text)) out.add("default");
  return [...out].sort();
}

/**
 * Chênh lệch PHẦN TỬ giữa gbh.peers và peerDependencies (bài học M6-MOUNT-PLAN §1d: KHÔNG so số lượng).
 * Nhận: siêu dữ liệu package.json (chỉ hai trường cần).
 * Trả: danh sách peer có trong gbh.peers mà THIẾU trong peerDependencies.
 */
function missingPeers(meta: { gbh?: { peers?: string[] }; peerDependencies?: Record<string, string> | null }): string[] {
  const declared = new Set(meta.gbh?.peers ?? []);
  const contract = new Set(Object.keys(meta.peerDependencies ?? {}));
  return [...declared].filter((peer) => !contract.has(peer)).sort();
}

/**
 * Băm sha1 một file để so byte-for-byte (luật 000e).
 * Nhận: thư mục gói + đường dẫn con.
 * Trả: chuỗi sha1 hex.
 */
function sha1(dir: string, rel: string): string {
  return createHash("sha1").update(readFileSync(new URL(dir + "/" + rel, import.meta.url))).digest("hex");
}

/**
 * Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE thân factory.
 * Nhận: văn bản cần băm.
 * Trả: chuỗi sha256 hex.
 */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/**
 * Đếm số dòng của một file (đo kích thước bản gốc).
 * Nhận: thư mục gói + đường dẫn con.
 * Trả: số dòng.
 */
function lineCount(dir: string, rel: string): number {
  return read(dir, rel).split("\n").length - 1;
}

/** Dòng mở thân factory trong bundle gốc. */
const BODY_OPEN = "\t\tvar module = { exports: {} };";
/** Dòng kết thân factory trong bundle gốc. */
const BODY_CLOSE = "\t\treturn module.exports;";

/**
 * Rút THÂN FACTORY của bundle gốc: từ `var module …` tới `return module.exports;` (hai đầu tính cả).
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
 * Đếm số lời gọi load({ id }) trong artifact và trả các id đọc được.
 * Nhận: nội dung artifact.
 * Trả: mảng id, theo thứ tự xuất hiện.
 */
function loadIds(text: string): string[] {
  return [...text.matchAll(/\b__ModuleLoader__\s*\.\s*load\s*\(\s*\{\s*id\s*:\s*"([^"]+)"/g)].map((m) => m[1] as string);
}

/** Nội dung các lát NGUYÊN VĂN của ta, theo đúng thứ tự manifest. */
const PART_SOURCES = PART_FILES.map((file) => readPart(file));

describe("A. TẬP EXPORT nửa HOST trên ARTIFACT — ta phải BẰNG bản gốc", () => {
  test("tập export ta = tập export gốc = [apply], KHÔNG có default", async () => {
    const ours = await import(OURS_DIR + "/lib/index.js");
    const stock = await import(STOCK_DIR + "/lib/index.js");
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(exportNames(read(OURS_DIR, "lib/index.js"))).toEqual(exportNames(read(STOCK_DIR, "lib/index.js")));
    expect(exportNames(read(OURS_DIR, "lib/index.js"))).toEqual(["apply"]);
    expect(typeof ours.apply).toBe("function");
    expect("default" in ours).toBe(false);
    expect(lineCount(STOCK_DIR, "lib/index.js")).toBe(11);
  });

  test("artifact nửa host KHÔNG đăng ký id module nào (grep -c = 0) và không có __ModuleLoader__", () => {
    const code = read(OURS_DIR, "lib/index.js");
    expect([...code.matchAll(/id:\s*@deepseek-ai/g)].length).toBe(0);
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect([...code.matchAll(/export\s*\{/g)].length).toBe(1);
  });
});

describe("B. HÀNH VI apply nửa HOST — rỗng y bản gốc, không chạm ctx", () => {
  test("apply.length = 0 ở CẢ HAI bên, gọi (kể cả hai lần) trả undefined và không ném", async () => {
    const ours = await import(OURS_DIR + "/lib/index.js");
    const stock = await import(STOCK_DIR + "/lib/index.js");
    expect(ours.apply.length).toBe(stock.apply.length);
    expect(ours.apply.length).toBe(0);
    expect(ours.apply()).toBeUndefined();
    expect(ours.apply()).toBeUndefined();
  });

  test("ctx giả NÉM nếu bị đọc/ghi ⇒ cả hai bên đều không chạm thuộc tính nào", async () => {
    const ours = await import(OURS_DIR + "/lib/index.js");
    const stock = await import(STOCK_DIR + "/lib/index.js");
    const trap = new Proxy({}, {
      get: () => { throw new Error("apply KHÔNG được đọc ctx"); },
      set: () => { throw new Error("apply KHÔNG được ghi ctx"); },
      has: () => { throw new Error("apply KHÔNG được hỏi ctx"); },
    });
    expect((ours.apply as (ctx: unknown) => void)(trap)).toBeUndefined();
    expect((stock.apply as (ctx: unknown) => void)(trap)).toBeUndefined();
    expect(ours.apply.length).toBe(0);
  });
});

describe("C. KHAI BÁO ROW — gbh.row.moved + aliases/moduleIds + dsh.client y bản gốc", () => {
  test("package.json: gbh.row đủ id/moved/aliases/moduleIds/tests; dsh.client ĐÚNG inject+platform gốc; exports có ./client", () => {
    const meta = JSON.parse(read(OURS_DIR, "package.json")) as {
      name: string;
      gbh?: { row?: { id?: string; moved?: boolean; aliases?: string[]; moduleIds?: string[]; tests?: string[] } };
      dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } };
      exports?: Record<string, string>;
    };
    const stockMeta = JSON.parse(read(STOCK_DIR, "package.json")) as { dsh?: { client?: { inject?: string[]; platform?: string } } };
    expect(meta.name).toBe(PACKAGE_NAME);
    expect(meta.gbh?.row?.id).toBe("cordis-client-runner");
    // moved: true = DI CHUYỂN chưa viết lại — ngoại lệ CÓ TÊN của cổng hygiene (hygiene.ts:55-58).
    expect(meta.gbh?.row?.moved).toBe(true);
    expect(meta.gbh?.row?.tests).toEqual(["tests/host/cordis-client-runner.test.ts"]);
    // LUẬT MỘT CHỖ (mục 8): id stock CHỈ ở aliases, KHÔNG ở moduleIds.
    expect(meta.gbh?.row?.aliases).toEqual([STOCK_PACKAGE_NAME]);
    expect(meta.gbh?.row?.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh?.row?.moduleIds?.includes(STOCK_PACKAGE_NAME)).toBe(false);
    // dsh.client: đúng inject + platform như gốc (thiếu nửa client ⇒ mất service dynamicCordisRunner).
    // 20/10/2026: `inject` nay trỏ id CỦA TA (rewrite có chủ đích) ⇒ so SAU KHI quy đổi id, giữ nguyên thứ tự/độ dài.
    expect(sameAfterIdMap(meta.dsh?.client?.inject, stockMeta.dsh?.client?.inject)).toBe(true);
    expect(meta.dsh?.client?.platform).toBe(stockMeta.dsh?.client?.platform);
    expect(meta.dsh?.client?.immediately).toBeUndefined();
    expect(meta.exports?.["./client"]).toBe("./lib/client.js");
  });

  test("artifact nửa client: ĐÚNG MỘT lời gọi load, id = tên package; grep id gốc ở vị trí id = 0", () => {
    const art = read(OURS_DIR, "lib/client.js");
    const ids = loadIds(art);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect([...art.matchAll(/id:\s*@deepseek-ai/g)].length).toBe(0);
    // Id gốc CHỈ được xuất hiện ở aliases — trong bundle nó chỉ còn là chuỗi require của peer cordis.
    expect(art.includes('"' + STOCK_PACKAGE_NAME + '"')).toBe(false);
    expect(art.includes('require("@deepseek-ai/cordis")')).toBe(true);
    expect(read(OURS_DIR, "package.json").includes(STOCK_PACKAGE_NAME)).toBe(true);
  });

  test("id bundle TỰ KHAI = TÊN PACKAGE (điều kiện materialize của tầng nạp, không phải lựa chọn thẩm mỹ)", () => {
    // materialize(id) tra factories.get(id) với id = DÒNG ĐỒ THỊ = tên package; factory lại khoá theo id
    // bundle TỰ KHAI. Lệch nhau ⇒ 'no registered factory for "…"' ⇒ entry chết ⇒ mất dynamicCordisRunner.
    expect(PACKAGE_NAME).toBe("@galaxy-blackhole/gbh-cordis-client-runner");
    const meta = JSON.parse(read(OURS_DIR, "package.json")) as { name: string };
    expect(meta.name).toBe(PACKAGE_NAME);
    expect(loadIds(read(OURS_DIR, "lib/client.js"))[0]).toBe(meta.name);
  });
});

describe("D. PEER — gbh.peers ⊆ peerDependencies, SO PHẦN TỬ (có đối chứng âm)", () => {
  test("gói ta: gbh.peers = [] ⇒ hiệu tập rỗng (và điều đó là TRUNG THỰC vì apply không inject seam nào)", () => {
    const meta = JSON.parse(read(OURS_DIR, "package.json")) as { gbh?: { peers?: string[] }; peerDependencies?: Record<string, string> };
    expect(meta.gbh?.peers).toEqual([]);
    expect(missingPeers(meta)).toEqual([]);
    expect(meta.peerDependencies?.["@deepseek-ai/cordis"]).toBe("~4.0.5-alpha.2");
  });

  test("ĐỐI CHỨNG ÂM: peers ⊄ peerDeps mà SỐ LƯỢNG bằng nhau ⇒ phép so số lượng nói OK, phép so phần tử bắt được tên thiếu", () => {
    const sneaky = { gbh: { peers: ["a", "z"] }, peerDependencies: { a: "1", b: "1" } };
    expect(sneaky.gbh.peers.length).toBe(Object.keys(sneaky.peerDependencies).length);
    expect(missingPeers(sneaky)).toEqual(["z"]);
  });

  test("ĐỐI CHỨNG CHUẨN 6 gói host ĐANG CHẠY (M6-MOUNT-PLAN §1d): 5 gói hiệu tập RỖNG, settings-controller chỉ lệch đúng ngoại lệ đã ghi", () => {
    // 02/11/2026: gói trùng tên "webserver" đã bị xoá — gói đang chạy là thư mục "host-webserver".
    for (const name of ["account-controller", "directory-picker-auto", "open-in-app", "plugin-inventory", "host-webserver"]) {
      const meta = JSON.parse(readFileSync(new URL("../../packages/host/" + name + "/package.json", import.meta.url), "utf8")) as {
        gbh?: { peers?: string[] };
        peerDependencies?: Record<string, string>;
      };
      expect(missingPeers(meta)).toEqual([]);
    }
    const exception = JSON.parse(readFileSync(new URL("../../packages/host/settings-controller/package.json", import.meta.url), "utf8")) as {
      gbh?: { peers?: string[] };
      peerDependencies?: Record<string, string> | null;
    };
    expect(missingPeers(exception).every((peer) => peer === "@deepseek-ai/dsh-typert-protocol")).toBe(true);
  });
});

describe("E. LOCALE — luật 000e: chép byte-for-byte", () => {
  test("en.json + zh.json của ta KHỚP sha1 bản gốc, và giữ meta.title", () => {
    for (const name of ["locale/en.json", "locale/zh.json"]) expect(sha1(OURS_DIR, name)).toBe(sha1(STOCK_DIR, name));
    const en = JSON.parse(read(OURS_DIR, "locale/en.json")) as { meta?: { title?: string } };
    expect(en.meta?.title).toBe("cordis-client-runner");
  });
});

describe("F. DE-BUNDLE — thân factory + CSS BYTE-IDENTICAL với bundle gốc", () => {
  /** Thân factory của bundle GỐC — nguồn đối chứng duy nhất. */
  const stockBody = factoryBody(read(STOCK_DIR, "lib/client.js"));

  test("11 lát, mỗi lát ≤ 1000 dòng, mọi lát là module HỢP LỆ (có export {}; và header)", () => {
    expect(PART_FILES.length).toBe(11);
    for (const file of PART_FILES) {
      const source = readPart(file);
      expect(source.split("\n").length).toBeLessThan(1000);
      expect(source.includes("export {};")).toBe(true);
      expect(source.split("\n")[0]).toBe("/**");
    }
  });

  test("ghép 11 lát ⇒ THÂN FACTORY TRÙNG TỪNG BYTE (SHA-256 bằng nhau)", () => {
    const ours = assembleBundleBody(PART_SOURCES);
    expect(ours.split("\n").length).toBe(stockBody.split("\n").length);
    expect(Buffer.byteLength(ours)).toBe(Buffer.byteLength(stockBody));
    expect(sha256(ours)).toBe(sha256(stockBody));
    expect(sha256(ours)).toBe("2c2ceebd6d73beb34efb74062bd4ca0954bc62d5029b598bf020187f7cfd5abe");
    expect(ours).toBe(stockBody);
  });

  test("artifact chứa thân factory NGUYÊN VĂN như một chuỗi con LIỀN MẠCH (không thụt lề lại)", () => {
    const art = read(OURS_DIR, "lib/client.js");
    const bodyArt = factoryBody(art);
    // 20/10/2026 (lô đổi tên brand): thân factory của ta giống bản gốc TỪNG BYTE sau khi chuẩn hoá brand
    // ĐỐI XỨNG hai vế (3 token `--dsh-*` → `--gbh-*`, cùng độ dài ⇒ số byte không đổi). Phép so vẫn là
    // TOÀN VĂN + LIỀN MẠCH: body rút từ artifact phải bằng đúng body stock, và phải nằm nguyên trong artifact.
    expect(Buffer.byteLength(bodyArt)).toBe(Buffer.byteLength(stockBody));
    expect(brandEqual(bodyArt, stockBody)).toBe(true);
    expect(art.includes(bodyArt)).toBe(true);
    // Không còn dấu vết phần giao kèo của lát trong artifact.
    expect(FRAGMENT_MARKER_LINE.test(art)).toBe(false);
    expect(art.includes("@ts-nocheck")).toBe(false);
  });

  test("CSS: bundle gốc có 0 khối CSS ⇒ ta cũng 0 khối, 0 điểm thay thế (không phải bỏ sót)", () => {
    const stockText = read(STOCK_DIR, "lib/client.js");
    expect(cssBlocks(stockText)).toBe(0);
    expect(cssBlocks(read(OURS_DIR, "lib/client.js"))).toBe(0);
    expect(CSS_REPLACEMENTS.length).toBe(0);
    expect(read(OURS_DIR, "lib/client.js").includes("__GBH_")).toBe(false);
  });

  test("ĐỐI CHỨNG ÂM: sửa ĐÚNG 1 ký tự trong một lát ⇒ phép so byte ĐỎ; hoàn nguyên ⇒ XANH", () => {
    const mutated = [...PART_SOURCES];
    const index = 4;
    const original = PART_SOURCES[index] as string;
    // Đổi 1 ký tự trong phần THÂN (không phải header): 'const' ⇒ 'consT' ở dòng đầu tiên có chữ const.
    const at = original.indexOf("\t\tconst ");
    expect(at).toBeGreaterThan(0);
    mutated[index] = original.slice(0, at + 8) + "T" + original.slice(at + 9);
    expect(mutated[index]).not.toBe(original);
    const bad = assembleBundleBody(mutated);
    const good = assembleBundleBody(PART_SOURCES);
    // Ba số đo của phép đối chứng âm: lệch đúng 1 ký tự ⇒ SHA khác, byte khác, chuỗi khác.
    expect(sha256(bad)).not.toBe(sha256(stockBody));
    expect(bad.length).toBe(good.length);
    expect(bad === stockBody).toBe(false);
    expect(good === stockBody).toBe(true);
  });
});


describe("G. CHẠY THẬT trong window giả — artifact đăng ký 1 factory và export BẰNG bản gốc", () => {
  /** Stub peer tối thiểu: nửa browser chỉ dùng react (namespace) và cordis.Service/Context. */
  const STUBS: Record<string, unknown> = {
    react: { createElement: () => null, useState: () => [null, () => undefined], useEffect: () => undefined, useRef: () => ({}) },
    "@deepseek-ai/cordis": { Service: class {}, Context: class {} },
  };

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
    const exports = first.factory((spec) => {
      if (!(spec in STUBS)) throw new Error('require khong duoc stub: "' + spec + '"');
      return STUBS[spec];
    });
    return { ids: registrations.map((item) => item.id), exports };
  }

  test("artifact của ta: 1 id, export đủ 11 tên, apply là hàm, inject = 5 id như gốc", () => {
    const ours = runBundle(read(OURS_DIR, "lib/client.js"));
    expect(ours.ids).toEqual([PACKAGE_NAME]);
    expect(Object.keys(ours.exports).sort()).toEqual([
      "ClientCordisInspectRegistry",
      "ClientTimerService",
      "CordisRunOrchestrator",
      "DynamicCordisPackageRunner",
      "DynamicCordisStyles",
      "apply",
      "dynamicCordisContext",
      "evaluateClientHalf",
      "inject",
      "isDynamicCordisPlugin",
      "name",
    ]);
    expect(typeof ours.exports.apply).toBe("function");
    expect(ours.exports.name).toBe("cordis-client-runner");
    expect(ours.exports.inject).toEqual(["loader", "modules", "slots", "remote", "remote.dynamicCordisRunner"]);
  });

  test("bản GỐC chạy trong CÙNG window giả cho tập export BẰNG HỆT (đối chứng dương của phép so hành vi)", () => {
    const stock = runBundle(read(STOCK_DIR, "lib/client.js"));
    const ours = runBundle(read(OURS_DIR, "lib/client.js"));
    expect(stock.ids).toEqual([STOCK_PACKAGE_NAME]);
    expect(Object.keys(ours.exports).sort()).toEqual(Object.keys(stock.exports).sort());
    expect(ours.exports.inject).toEqual(stock.exports.inject);
    expect(ours.exports.name).toBe(stock.exports.name);
  });
});

describe("H. ĐỐI CHIẾU EXPORT/SLOT với BẢN GỐC — bảng kỳ vọng dựng từ bundle ĐANG CÀI", () => {
  /**
   * Rút tên slot mà một đoạn mã đăng ký — NGUYÊN VĂN hai regex của tools/check/rows.ts (hàm slotNames).
   * Nhận: văn bản mã nguồn hoặc bundle.
   * Trả: mảng tên slot đã sắp xếp.
   */
  function slotNames(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["']([^"']+)["']/g)) out.add(m[1] as string);
    for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["']([^"']+)["']/g)) out.add(m[1] as string);
    return [...out].sort();
  }

  /**
   * Đọc MỌI file .js trong lib/ của bản gốc — CÙNG PHẠM VI với tools/check/rows.ts (readStockClient).
   * Nhận: không.
   * Trả: văn bản gộp của mọi file .js trong lib/.
   */
  function readStockLibJs(): string {
    const dir = joinPath(fileURLToPath(new URL(STOCK_DIR, import.meta.url)), "lib");
    let out = "";
    for (const name of readdirSync(dir)) if (name.endsWith(".js")) out += readFileSync(joinPath(dir, name), "utf8");
    return out;
  }

  /**
   * Đọc MỌI file .ts dưới src/ của ta — CÙNG PHẠM VI với tools/check/rows.ts (readAllTs).
   * Nhận: không.
   * Trả: văn bản gộp của mọi file .ts.
   */
  function readAllSrcTs(): string {
    let out = "";
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = joinPath(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".ts")) out += readFileSync(full, "utf8");
      }
    };
    walk(joinPath(fileURLToPath(new URL(OURS_DIR, import.meta.url)), "src"));
    return out;
  }

  /** Tên export của bundle client: mọi dòng "exports.X = …" của thân factory — NGUYÊN VĂN. */
  function clientExportKeys(text: string): string[] {
    return [...new Set([...text.matchAll(/^\t\texports\.([A-Za-z0-9_$]+) = /gm)].map((m) => m[1] as string))].sort();
  }

  test("bảng EXPORT kỳ vọng: nửa host [apply] · nửa client 11 tên — ta BẰNG từng tên", async () => {
    const oursHost = (await import(OURS_DIR + "/lib/index.js")) as Record<string, unknown>;
    const stockHost = (await import(STOCK_DIR + "/lib/index.js")) as Record<string, unknown>;
    expect(Object.keys(oursHost).sort()).toEqual(["apply"]);
    expect(Object.keys(stockHost).sort()).toEqual(["apply"]);
    const stockClient = read(STOCK_DIR, "lib/client.js");
    const expected = ["ClientCordisInspectRegistry", "ClientTimerService", "CordisRunOrchestrator", "DynamicCordisPackageRunner", "DynamicCordisStyles", "apply", "dynamicCordisContext", "evaluateClientHalf", "inject", "isDynamicCordisPlugin", "name"].sort();
    expect(clientExportKeys(stockClient)).toEqual(expected);
    expect(clientExportKeys(read(OURS_DIR, "lib/client.js"))).toEqual(expected);
  });

  test("bảng SLOT kỳ vọng: 99 slot — src ta = artifact ta = bản gốc (không thiếu, không thừa)", () => {
    const stockSlots = slotNames(readStockLibJs());
    expect(stockSlots.length).toBe(99);
    expect(slotNames(readAllSrcTs())).toEqual(stockSlots);
    expect(slotNames(read(OURS_DIR, "lib/client.js"))).toEqual(stockSlots);
    // Bốn tên ĐẦU và CUỐI như một mốc đối chiếu cụ thể (bảng đầy đủ ở trên đã so phần tử).
    expect(stockSlots[0]).toBe("conversation.approval.detail");
    expect(stockSlots[stockSlots.length - 1]).toBe("workspace.toast");
  });

  test("VÌ SAO VẪN khai moved:true — bundle có ĐÚNG HAI lời gọi đăng ký, một là load ĐỘNG (id: moduleId)", () => {
    const oursCode = read(OURS_DIR, "lib/client.js");
    const stockCode = read(STOCK_DIR, "lib/client.js");
    // (1) Bản gốc cũng có HAI lời gọi: một của chính bundle, một của DynamicCordisPackageRunner
    //     (nạp package động lúc chạy — chính là chức năng của row này).
    const stockRegs = moduleRegistrations(stockCode);
    expect(stockRegs.length).toBe(2);
    expect(stockRegs.filter((reg) => reg.id === undefined).map((reg) => reg.expression)).toEqual(["moduleId"]);
    // (2) Artifact của ta y hệt (thân factory NGUYÊN VĂN): 1 id tĩnh CỦA TA + 1 load động.
    const oursRegs = moduleRegistrations(oursCode);
    expect(oursRegs.length).toBe(2);
    expect(oursRegs.filter((reg) => reg.id !== undefined).map((reg) => reg.id)).toEqual([PACKAGE_NAME]);
    expect(oursRegs.filter((reg) => reg.id === undefined).map((reg) => reg.expression)).toEqual(["moduleId"]);
    // (3) Vì thế cổng check:rows (moduleIdIssues) đếm 2 lời gọi ⇒ CHAN OAN nếu bỏ moved — đo bằng CHÍNH
    //     hàm của cổng, không bằng suy đoán.
    const issues = moduleIdIssues({ pkg: PACKAGE_NAME, code: oursCode, declared: [PACKAGE_NAME], aliases: [STOCK_PACKAGE_NAME], stockIds: [STOCK_PACKAGE_NAME], stockRowDisabled: false });
    const chans = issues.filter((issue) => issue.level === "chan").map((issue) => issue.detail);
    expect(chans.length).toBe(1);
    expect(chans[0]).toContain("dang ky 2 id module");
    // ⚠️ TRIPWIRE: khi cổng được sửa để phân biệt load ĐỘNG (id không phân giải được) với load của chính
    // bundle, ca này sẽ ĐỎ — lúc đó hãy BỎ gbh.row.moved của gói này để check:rows đối chiếu thật.
    const meta = JSON.parse(read(OURS_DIR, "package.json")) as { gbh?: { row?: { moved?: boolean } } };
    expect(meta.gbh?.row?.moved).toBe(true);
  });
});

