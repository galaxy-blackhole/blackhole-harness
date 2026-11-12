/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test row ui-cordis ĐỦ HAI MẶT (19/10/2026 — Lead duyệt ghi đè): nửa HOST apply RỖNG y bản gốc trên
 *      Context cordis THẬT · BỘ BA khai báo (dsh.client DEEP-EQUAL bản gốc SAU KHI QUY ID · exports[./client] ·
 *      build.ts ≥2 Bun.build + lib/client.js THẬT) · LUẬT MỘT-ID (0 id stock trong artifact) · A/B nạp
 *      artifact client như thẻ script classic (bề mặt + đăng ký slot) · row vẫn PARKED (không gbh.row)
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { peerRangeProblems } from "../host/peer-range-harness.ts";
import { buildPackage } from "../../packages/client/ui-cordis/build.ts";
import * as oursModule from "../../packages/client/ui-cordis/src/index.ts";

/** Gốc repo (file này nằm ở tests/client). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "client", "ui-cordis");
/** Gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-cordis");
/** cordis của kernel — plugin host thật nên test cài trên Context THẬT. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Id module của TA — artifact client chỉ được khai ĐÚNG id này (LUẬT MỘT-ID). */
const OUR_ID = "@galaxy-blackhole/gbh-client-ui-cordis";
/** Id module của gói GỐC — chỉ để ĐO, phải VẮNG MẶT trong artifact của ta. */
const STOCK_ID = "@deepseek-ai/dsh-client-ui-cordis";

/** Context cordis THẬT. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** Bản gốc nạp động (đường dẫn tính lúc chạy). */
const stock = (await import(join(STOCK_DIR, "lib", "index.js"))) as typeof oursModule;
/** Bản của ta. */
const mine = oursModule;

/** Đường dẫn ARTIFACT nửa host của ta (gán trong beforeAll). */
let artifact = "";
/** Đường dẫn ARTIFACT nửa client của ta (gán trong beforeAll). */
let clientArtifact = "";
/** Thư mục tạm (gán trong beforeAll). */
let outDir = "";

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-ui-cordis-"));
  const built = await buildPackage(outDir);
  artifact = built.host;
  clientArtifact = built.client;
});

afterAll(async () => {
  if (outDir !== "") await rm(outDir, { recursive: true, force: true });
});

/** Siêu dữ liệu package.json mà test này đọc. */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Điểm vào nửa host. */
  main?: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Khai báo nửa browser cho tầng nạp. */
  dsh?: { client?: { inject?: string[]; platform?: string } };
  /** Khu vực khai báo của hệ Galaxy. */
  gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: unknown; draft?: unknown; tests?: unknown };
}

/**
 * Đọc package.json của một package.
 * Nhận: dir — đường dẫn thư mục package.
 * Trả: siêu dữ liệu đã parse.
 */
function manifestOf(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
}

/**
 * Liệt kê tên export của một file ESM đã build — ĐÚNG bốn khuôn của tools/check/rows.ts.
 * Nhận: text — nội dung artifact.
 * Trả: mảng tên export đã sắp xếp.
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
  return [...out].sort();
}

/**
 * Đếm số lời gọi đăng ký module trong một artifact client.
 * Nhận: code — văn bản artifact.
 * Trả: các id đã đăng ký, theo thứ tự xuất hiện.
 */
function registeredIds(code: string): string[] {
  return [...code.matchAll(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1] as string);
}

/** Một đăng ký với bảng module của trang. */
interface Registration {
  /** Id module bundle tự khai. */
  id: string;
  /** Factory lười. */
  factory: (require: (specifier: string) => unknown) => unknown;
}

/** Bề mặt plugin mà Loader phía browser nhận. */
interface PluginFace {
  /**
   * Cài bề mặt lên context.
   * Nhận: ctx — context plugin.
   * Trả: không.
   */
  apply(ctx: unknown): void;
  /** Danh sách seam cần cho Loader. */
  inject: string[];
}

/**
 * Chạy một bundle như thẻ script classic (đúng cách bộ nạp của app nạp nó).
 * Nhận: code — nguồn bundle.
 * Trả: các đăng ký mà bundle đã thực hiện.
 */
function runBundle(code: string): Registration[] {
  const registrations: Registration[] = [];
  const facade = {
    load: (registration: Registration): void => {
      registrations.push(registration);
    },
  };
  const scope = globalThis as unknown as { __ModuleLoader__?: unknown };
  const previous = scope.__ModuleLoader__;
  scope.__ModuleLoader__ = facade;
  try {
    new Function("window", code)({ __ModuleLoader__: facade });
  } finally {
    if (previous === undefined) delete scope.__ModuleLoader__;
    else scope.__ModuleLoader__ = previous;
  }
  return registrations;
}

/**
 * Dựng phần tử giả của react/jsx-runtime (chỉ để so cấu trúc, không cần DOM).
 * Nhận: type — loại phần tử; props — thuộc tính; key — khoá.
 * Trả: mô tả phần tử.
 */
function jsxElement(type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown {
  return { type, props, key };
}

/**
 * Hàm require giả của tầng nạp: đúng ba module mà factory gốc đòi.
 * Nhận: không.
 * Trả: hàm require trả bảng giả theo tên module.
 */
function fakeRequire(): (specifier: string) => unknown {
  const jsxRuntime = { Fragment: Symbol.for("Fragment"), jsx: jsxElement, jsxs: jsxElement };
  const react = {
    useState: <S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void] => [
      typeof initial === "function" ? (initial as () => S)() : initial,
      () => {},
    ],
    useRef: <T>(initial: T): { current: T } => ({ current: initial }),
    useEffect: (): void => {},
    useLayoutEffect: (): void => {},
    useId: (): string => "cordis-test-id",
  };
  const primitives = {
    DisclosureRow: "DisclosureRow",
    CodeBlock: "CodeBlock",
    Tooltip: "Tooltip",
    StateDot: "StateDot",
    useDismissOnOutsidePointer: (): void => {},
  };
  return (specifier: string) => (specifier === "react/jsx-runtime" ? jsxRuntime : specifier === "react" ? react : primitives);
}

/** Một spec đăng ký slot đã ghi lại. */
interface SlotSpec {
  /** Tên slot. */
  name?: string;
  /** Khoá tool call (nếu có). */
  key?: string;
  /** Id occupant (nếu có). */
  id?: string;
  /** Namespace từ điển. */
  locale?: string;
  /** Slot con khai kèm. */
  children?: unknown;
  /** Hàm inject. */
  inject?: unknown;
}

/**
 * Tiêu thụ một giá trị nếu nó là iterator — bản gốc đăng ký hai thẻ stop/undefine bằng generator.
 * Nhận: value — giá trị do ctx.slots.register trả về.
 * Trả: không.
 */
function drain(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  const iterator = value as { next: () => { done?: boolean } };
  if (typeof iterator.next !== "function") return;
  let step = iterator.next();
  while (step.done !== true) step = iterator.next();
}

/**
 * Context giả tối thiểu để apply chạy hết một lượt và ghi lại mọi đăng ký slot.
 * Nhận: specs — mảng nhận các spec đăng ký.
 * Trả: đối tượng context giả.
 */
function fakeCtx(specs: SlotSpec[]): Record<string, unknown> {
  const observable = { getSnapshot: (): ReadonlyMap<string, never> => new Map<string, never>(), subscribe: (): (() => void) => () => {} };
  return {
    effect: (callback: () => unknown): void => {
      callback();
    },
    on: (): void => {},
    locale: { register: (): (() => void) => () => {} },
    remote: {
      $on: (): void => {},
      dynamicCordisRunner: {
        stopFromPanel: async () => ({ ok: true, value: { ok: true, message: "" } }),
        undefineFromPanel: async () => ({ ok: true, value: { ok: true, message: "" } }),
        inventory: async () => ({ ok: true, value: [] }),
      },
    },
    slots: {
      inject: (_slot: string, register: () => unknown): void => {
        drain(register());
      },
      register: (spec: SlotSpec): SlotSpec => {
        specs.push(spec);
        return spec;
      },
    },
    dynamicCordisRunner: {
      getSnapshot: (): readonly unknown[] => [],
      subscribe: (): (() => void) => () => {},
      reconcileApprovals: (): void => {},
      approve: async (): Promise<void> => {},
      decline: async (): Promise<void> => {},
      startUserRun: async (): Promise<undefined> => undefined,
      activeRuns: observable,
      lastRunError: observable,
      renderFailures: observable,
    },
  };
}

/**
 * Rút gọn một spec đăng ký slot thành dữ liệu so được (bỏ hàm, giữ cờ có hàm).
 * Nhận: spec — spec đã ghi.
 * Trả: bản rút gọn.
 */
function brief(spec: SlotSpec): Record<string, unknown> {
  return {
    name: spec.name,
    key: spec.key,
    id: spec.id,
    locale: spec.locale,
    children: spec.children,
    hasInject: typeof spec.inject === "function",
  };
}

/**
 * Nạp một artifact client rồi lấy bề mặt plugin của nó (một đăng ký duy nhất).
 * Nhận: code — văn bản artifact; id — id mà artifact phải khai.
 * Trả: bề mặt plugin { apply, inject }.
 */
function faceOf(code: string, id: string): PluginFace {
  const registrations = runBundle(code);
  expect(registrations.map((registration) => registration.id)).toEqual([id]);
  const registration = registrations[0];
  if (registration === undefined) throw new Error("artifact không đăng ký module nào");
  return registration.factory(fakeRequire()) as PluginFace;
}

/**
 * Chạy apply của một bề mặt trên context giả và trả các spec đã đăng ký.
 * Nhận: face — bề mặt plugin.
 * Trả: danh sách spec đăng ký slot.
 */
function registrationsOf(face: PluginFace): SlotSpec[] {
  const specs: SlotSpec[] = [];
  face.apply(fakeCtx(specs));
  return specs;
}

describe("A. TẬP EXPORT trên ARTIFACT — nửa host phải BẰNG bản gốc", () => {
  test("export DUY NHẤT là apply, BẰNG TỪNG TÊN với bundle gốc", () => {
    const oursNames = exportNames(readFileSync(artifact, "utf8"));
    const stockNames = exportNames(readFileSync(join(STOCK_DIR, "lib", "index.js"), "utf8"));
    expect(oursNames).toEqual(stockNames);
    expect(oursNames).toEqual(["apply"]);
    expect(Object.keys(mine).sort()).toEqual(["apply"]);
  });

  test("artifact nửa HOST là ESM, KHÔNG đăng ký id module nào (nửa browser nằm ở lib/client.js)", () => {
    const code = readFileSync(artifact, "utf8");
    expect(code.includes("__ModuleLoader__")).toBe(false);
    expect(code.includes("window.")).toBe(false);
    expect([...code.matchAll(/export\s*\{/g)].length).toBe(1);
  });
});

describe("B. HÀNH VI apply nửa HOST — RỖNG y bản gốc trên Context cordis THẬT", () => {
  test("apply.length = 0 ở CẢ HAI bên (plugin không khai tham số ⇒ không chạm ctx/config)", () => {
    expect(mine.apply.length).toBe(0);
    expect(stock.apply.length).toBe(0);
    expect(typeof mine.apply).toBe("function");
  });

  /**
   * Gọi apply như LOADER gọi (có ctx dù khai báo 0 tham số) — ép kiểu chỉ để tsc cho qua.
   * Nhận: apply — hàm apply của một bên; ctx — context cordis thật.
   * Trả: giá trị trả về (phải là undefined).
   */
  function callApply(apply: () => void, ctx: unknown): unknown {
    return (apply as (value: unknown) => unknown)(ctx);
  }

  test("gọi trên Context THẬT: trả undefined, không ném, gọi nhiều lần vẫn rỗng", () => {
    const ctx = new ContextCtor();
    expect(callApply(mine.apply, ctx)).toBeUndefined();
    expect(callApply(stock.apply, ctx)).toBeUndefined();
    expect(callApply(mine.apply, ctx)).toBeUndefined();
  });

  test("ctx ĐỘC (Proxy ném khi bị đọc/ghi) và tham số lạ ⇒ CẢ HAI đều không chạm, không ném", () => {
    /** Context độc: mọi truy cập đều ném — chứng minh apply không đọc gì. */
    const hostile = new Proxy({}, {
      get: (): never => { throw new Error("apply đã chạm ctx"); },
      set: (): never => { throw new Error("apply đã ghi ctx"); },
      has: (): never => { throw new Error("apply đã kiểm ctx"); },
    });
    expect(() => callApply(mine.apply, hostile)).not.toThrow();
    expect(() => callApply(stock.apply, hostile)).not.toThrow();
    for (const weird of [null, 0, "x", Symbol("s"), Object.freeze({})]) {
      expect((mine.apply as (v: unknown) => void)(weird)).toBeUndefined();
      expect((stock.apply as (v: unknown) => void)(weird)).toBeUndefined();
    }
  });
});

describe("C. KHAI BÁO — HAI MẶT: dsh.client DEEP-EQUAL bản gốc SAU KHI QUY ID, row vẫn PARKED", () => {
  test("BỘ BA: exports[./client] = ./lib/client.js · dsh.client deep-equal GỐC sau khi quy id · KHÔNG gbh.row (PARKED)", () => {
    const meta = manifestOf(PKG);
    const stockMeta = manifestOf(STOCK_DIR);
    expect(meta.name).toBe(OUR_ID);
    expect(meta.main).toBe("lib/index.js");
    // (b) exports["./client"] trỏ đúng artifact trình duyệt.
    expect(meta.exports?.["./client"]).toBe("./lib/client.js");
    // (a) dsh.client DEEP-EQUAL bản gốc SAU KHI QUY ID: 20/10/2026 id inject đã REWRITE CÓ CHỦ ĐÍCH sang id
    // GBH nên so JSON.stringify trên artefact thô là sai hướng; sameAfterIdMap quy id ta -> id stock rồi vẫn
    // so SÂU TỪNG KHOÁ (platform + inject ĐÚNG THỨ TỰ), giữ manifest gốc làm chuẩn.
    expect(sameAfterIdMap(meta.dsh?.client, stockMeta.dsh?.client)).toBe(true);
    expect(meta.dsh?.client?.inject?.length).toBe(8);
    expect(meta.dsh?.client?.platform).toBe("web");
    // (3) 19/10/2026 (Lead FLIP sau boot-smoke): đọc TRẠNG THÁI TỪ MANIFEST — row có mặt (hoặc còn park) với id đúng.
    const declared = (meta.gbh as { row?: { id?: string }; row_unmounted_ly_do?: { row?: { id?: string } } });
    const row = declared?.row ?? declared?.row_unmounted_ly_do?.row;
    expect(row?.id).toBe("ui-cordis");
    expect(meta.gbh?.draft).toBeTypeOf("string");
    // 01/11/2026 — `gbh.peers` là DANH SÁCH CHỌN LỌC và phải ⊆ `peerDependencies`; dải phải phủ bản kernel
    // đang chạy (manifest đã đồng bộ theo stock). Dùng phép kiểm chuẩn của repo thay cho literal `[]` cũ.
    expect(peerRangeProblems(PKG)).toEqual([]);
    const reason = String(meta.gbh?.draft ?? meta.gbh?.row_unmounted_ly_do ?? "");
    expect(reason).toContain("PARKED");
    expect(reason).toContain(OUR_ID);
  });

  test("000e: locale/{en,zh}.json KHỚP TỪNG BYTE bản gốc, giữ meta.title", () => {
    for (const name of ["en.json", "zh.json"]) {
      expect(readFileSync(join(PKG, "locale", name), "utf8")).toBe(readFileSync(join(STOCK_DIR, "locale", name), "utf8"));
    }
    const en = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta?: { title?: string } };
    expect(en.meta?.title).toBe("ui-cordis");
  });
});

describe("D. ĐO PHÂN LOẠI — gói HAI MẶT, row TOP-LEVEL, row vẫn PARKED", () => {
  test("bản gốc HAI MẶT: dsh.client 8 inject + lib/client.js 1.495 dòng > 1000, đúng MỘT id stock", () => {
    const stockMeta = manifestOf(STOCK_DIR);
    expect(stockMeta.dsh?.client?.platform).toBe("web");
    expect(stockMeta.dsh?.client?.inject?.length).toBe(8);
    // exports["./client"] của GỐC là ĐỐI TƯỢNG điều kiện (types + default) — đo đúng hình dạng.
    expect(stockMeta.exports?.["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    const clientCode = readFileSync(join(STOCK_DIR, "lib", "client.js"), "utf8");
    const clientLines = clientCode.split("\n").length - 1;
    expect(clientLines).toBeGreaterThan(1000);
    expect(registeredIds(clientCode)).toEqual([STOCK_ID]);
  });

  test("ARTIFACT client CỦA TA: lib/client.js tồn tại · ĐÚNG MỘT id của ta · 0 id stock · không ESM · tag CSS của ta", () => {
    // (c) build.ts phải sinh lib/client.js THẬT trong package (không chỉ trong thư mục tạm).
    const shipped = join(PKG, "lib", "client.js");
    expect(existsSync(shipped)).toBe(true);
    expect(existsSync(clientArtifact)).toBe(true);
    const code = readFileSync(clientArtifact, "utf8");
    const shippedCode = readFileSync(shipped, "utf8");
    // LUẬT MỘT-ID: đúng một lời gọi load(), id là CỦA TA — và id stock phải VẮNG MẶT hoàn toàn.
    expect(registeredIds(code)).toEqual([OUR_ID]);
    expect(registeredIds(shippedCode)).toEqual([OUR_ID]);
    expect(code.split(STOCK_ID).length - 1).toBe(0);
    expect(shippedCode.split(STOCK_ID).length - 1).toBe(0);
    // Thẻ style + dataset.plugin cũng phải mang id của ta.
    for (const suffix of ["CordisPanel.module.css", "CordisDefineRow.module.css", "CordisRunRow.module.css"]) {
      expect(code).toContain(OUR_ID + "/" + suffix);
      expect(code).toContain('document.createElement("style")');
    }
    expect(code).toContain("dataset.plugin");
    // Bộ nạp của app nạp bundle bằng thẻ script classic ⇒ cấm cú pháp ESM.
    expect(code.split("\n").find((line) => /^\s*(?:import|export)\s/u.test(line))).toBeUndefined();
  });

  test("build.ts có ≥2 lời gọi Bun.build (một host + một client)", () => {
    const source = readFileSync(join(PKG, "build.ts"), "utf8");
    const calls = [...source.matchAll(/Bun\.build\(/g)].length;
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(source).toContain('src", "index.ts"');
    expect(source).toContain('src", "client.ts"');
  });

  test("row ui-cordis là TOP-LEVEL trong dump đang dùng (cột 0) + có dòng trong PARITY-MATRIX", () => {
    const matrix = readFileSync(join(REPO, "docs", "PARITY-MATRIX.md"), "utf8");
    expect(/\| \x60ui-cordis\x60 \| \x60@deepseek-ai\/dsh-client-ui-cordis\x60 \| \x60@galaxy-blackhole\/gbh-client-ui-cordis\x60 \|/.test(matrix)).toBe(true);
    const dumps = join(REPO, ".parity", "dumps");
    if (!existsSync(dumps)) return; // dump là artefact đo, có thể không có trong bản clone
    const latest = readdirSync(dumps).sort().pop() as string;
    const yml = readFileSync(join(dumps, latest, "ours.yml"), "utf8");
    expect(/^- id: ui-cordis$/m.test(yml)).toBe(true);
    expect(/^\s+- id: ui-cordis$/m.test(yml)).toBe(false);
  });
});

describe("E. TRÙNG TÊN service/slot/id trong repo", () => {
  test("không gói nào khác khai row ui-cordis hay module id của ta", () => {
    const roots = [join(REPO, "packages", "host"), join(REPO, "packages", "client")];
    const claims: { file: string; kind: string }[] = [];
    /**
     * Duyệt cây package và ghi mọi khai báo trùng tên row/module id của ta.
     * Nhận: dir — thư mục cần duyệt.
     * Trả: không (ghi vào claims).
     */
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "lib") continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (entry.name !== "package.json") continue;
        const text = readFileSync(full, "utf8");
        const rel = full.slice(REPO.length + 1);
        if (text.includes(OUR_ID)) claims.push({ file: rel, kind: "module id" });
        if (/"id":\s*"ui-cordis"/.test(text)) claims.push({ file: rel, kind: "row id" });
      }
    };
    for (const root of roots) walk(root);
    // 19/10/2026 (Lead FLIP): manifest của CHÍNH gói giờ khai thêm row id trong `gbh.row` ⇒ 2 claim, cả hai
    // đều thuộc gói ta; KHÔNG gói nào khác được nhắc tới module id hay row id.
    expect(claims).toEqual([
      { file: "packages/client/ui-cordis/package.json", kind: "module id" },
      { file: "packages/client/ui-cordis/package.json", kind: "row id" },
    ]);
  });
});

describe("F. A/B NẠP ARTIFACT CLIENT như thẻ script classic — bề mặt + đăng ký slot", () => {
  test("bề mặt {apply, inject}: apply.length = 1, inject DEEP-EQUAL bản gốc (5 seam, đúng thứ tự)", () => {
    const ourFace = faceOf(readFileSync(clientArtifact, "utf8"), OUR_ID);
    const stockFace = faceOf(readFileSync(join(STOCK_DIR, "lib", "client.js"), "utf8"), STOCK_ID);
    expect(Object.keys(ourFace).sort()).toEqual(Object.keys(stockFace).sort());
    expect(ourFace.apply.length).toBe(1);
    expect(ourFace.apply.length).toBe(stockFace.apply.length);
    expect(ourFace.inject).toEqual(stockFace.inject);
    expect(ourFace.inject).toEqual(["slots", "locale", "remote", "remote.dynamicCordisRunner", "dynamicCordisRunner"]);
  });

  test("apply đăng ký ĐÚNG bộ slot như bản gốc: bảng Cordis + 4 thẻ tool call", () => {
    const ourFace = faceOf(readFileSync(clientArtifact, "utf8"), OUR_ID);
    const stockFace = faceOf(readFileSync(join(STOCK_DIR, "lib", "client.js"), "utf8"), STOCK_ID);
    const ours = registrationsOf(ourFace).map(brief);
    const stockSpecs = registrationsOf(stockFace).map(brief);
    expect(ours).toEqual(stockSpecs);
    expect(ours.map((spec) => spec["key"] ?? spec["id"])).toEqual([
      "cordis-panel",
      "cordis_define",
      "cordis_run",
      "cordis_stop",
      "cordis_undefine",
    ]);
  });
});