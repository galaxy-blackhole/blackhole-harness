/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test tang wire cua nua node (xep thu tu, chia combo, facade C2, byte than phan hoi) va ban build that
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_COMBO_URL_BYTES,
  artifactRevision,
  bootInjections,
  comboReference,
  orderByModuleGraph,
  partitionComboIds,
  projectedComboUrlBytes,
  queueFacadeSource,
  shortHash,
  type GraphRow,
} from "../../packages/client/modules/src/combos.ts";
import { buildComboScript, buildComboSourceMap } from "../../packages/client/modules/src/sourcemap.ts";
import { PACKAGE_NAME, STOCK_NAME } from "../../packages/client/modules/src/ids.ts";
import { buildPackage } from "../../packages/client/modules/build.ts";
import { ClientModuleSystem } from "../../packages/client/modules/src/client/system.ts";

/** Thư mục fixture của hợp đồng C1/C2. */
const FIXTURES = join(import.meta.dir, "..", "contract", "fixtures");
/** Revision thay cho chỗ giữ `<rev>` của fixture. */
const REV = "0123456789ab";

/** Đọc fixture C1 thô (chưa thay revision) dưới dạng JSON. */
function readFixture<T>(): T {
  return JSON.parse(readFileSync(join(FIXTURES, "c1-boot-graph.json"), "utf8").split("<rev>").join(REV)) as T;
}

/** Đọc fixture C1 và trả về các dòng entry đã thay revision. */
function fixtureRows(): GraphRow[] {
  return readFixture<{ entries: GraphRow[] }>().entries;
}

/** Id của batch application ĐẦU TIÊN của fixture (57 entry), để đo việc chia combo. */
function applicationIds(): string[] {
  const batches = readFixture<{ batches: { phase: string; entries: string[] }[] }>().batches;
  return batches.filter((batch) => batch.phase === "application")[0]?.entries ?? [];
}

/**
 * Dựng wire `__DSH_BOOT__` hoàn chỉnh từ fixture (fixture lưu các phần rời).
 * Nhận: không.
 * Trả: đồ thị wire.
 */
function fixtureGraph(): { rev: string; release: { version: string; commit?: string }; entries: unknown[]; batches: unknown[] } {
  const capture = readFixture<{ releaseVersion: string; releaseCommit: string; entries: unknown[]; batches: unknown[] }>();
  return { rev: REV, release: { version: capture.releaseVersion, commit: capture.releaseCommit }, entries: capture.entries, batches: capture.batches };
}

describe("nửa node — xếp thứ tự đồ thị", () => {
  test("đồ thị thật có 2 chu trình qua inject nhưng không chu trình qua external, nên xếp được", () => {
    const rows = fixtureRows();
    const ordered = orderByModuleGraph(rows);
    expect(ordered.length).toBe(72);
    const rank = new Map(ordered.map((row, index) => [row.id, index]));
    let edges = 0;
    for (const row of rows) {
      for (const specifier of row.external ?? []) {
        const provider = rank.get(specifier.endsWith("/client") ? specifier.slice(0, -7) : specifier);
        if (provider === undefined) continue;
        edges += 1;
        expect(provider).toBeLessThan(rank.get(row.id) ?? 0);
      }
    }
    expect(edges).toBeGreaterThan(0);
  });

  test("chu trình qua external bị từ chối kèm tên các package trên vòng", () => {
    const rows: GraphRow[] = [
      { id: "a", url: comboReference(["a"], REV), rev: REV, external: ["b/client"] },
      { id: "b", url: comboReference(["b"], REV), rev: REV, external: ["a/client"] },
    ];
    expect(() => orderByModuleGraph(rows)).toThrow(/module graph cycle a -> b -> a/);
  });

  test("row tự yêu cầu chính nó bị từ chối", () => {
    const rows: GraphRow[] = [{ id: "a", url: comboReference(["a"], REV), rev: REV, external: ["a/client"] }];
    expect(() => orderByModuleGraph(rows)).toThrow(/answers itself/);
  });
});

describe("nửa node — chia combo và revision", () => {
  test("danh sách 57 entry giữ nguyên thứ tự, và danh sách gấp đôi thì bị chia dưới 3 KiB", () => {
    const ids = applicationIds();
    expect(ids.length).toBe(57);
    const single = partitionComboIds(ids);
    expect(single.flat()).toEqual(ids);
    for (const group of single) expect(projectedComboUrlBytes(group)).toBeLessThanOrEqual(MAX_COMBO_URL_BYTES);

    const doubled = [...ids, ...ids.map((id) => id)];
    expect(projectedComboUrlBytes(doubled)).toBeGreaterThan(MAX_COMBO_URL_BYTES);
    const groups = partitionComboIds(doubled);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.flat()).toEqual(doubled);
    for (const group of groups) expect(projectedComboUrlBytes(group)).toBeLessThanOrEqual(MAX_COMBO_URL_BYTES);
  });

  test("tham chiếu combo là tương đối tài liệu, URL tuyệt đối có dấu / đầu", () => {
    expect(comboReference(["a"], REV)).toBe("plugins/??a/client.js&rev=" + REV);
    // Dạng .map gắn hậu tố cho TỪNG id — đây là dạng dài nhất nên cũng là dạng dùng để đo giới hạn 3 KiB.
    expect(comboReference(["a", "b"], REV, true)).toBe("plugins/??a/client.js.map,b/client.js.map&rev=" + REV);
  });

  test("revision artifact là 12 hex và đổi khi metadata đổi", () => {
    const baseline = { path: "/tmp/x", mtimeMs: 1, ctimeMs: 2, size: 3 };
    const rev = artifactRevision(baseline);
    expect(rev).toMatch(/^[0-9a-f]{12}$/);
    expect(artifactRevision({ ...baseline, size: 4 })).not.toBe(rev);
    expect(artifactRevision({ ...baseline, mtimeMs: 9 })).not.toBe(rev);
    expect(shortHash("x")).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe("nửa node — facade C2 chạy thật trong window giả", () => {
  test("facade ném ĐÚNG bốn thông điệp của hợp đồng C2", () => {
    const calls: { id: string; factory: (require: (spec: string) => unknown) => unknown }[] = [];
    const facade = { mode: "queue" as string, pendingQueue: calls, load: (registration: (typeof calls)[number]) => calls.push(registration) };
    const scope: Record<string, unknown> = {};
    new Function("window", queueFacadeSource())(scope);
    const loader = scope.__ModuleLoader__ as {
      mode: string;
      pendingQueue: unknown[];
      load(registration: unknown): void;
      create(options: unknown): unknown;
    };
    expect(loader.mode).toBe("queue");
    expect(Array.isArray(loader.pendingQueue)).toBe(true);

    // (1) chưa nạp bundle bootstrap nào.
    expect(() => loader.create({})).toThrow("client-modules: HTML did not preload " + PACKAGE_NAME + "/client.js");

    // (2) bundle bootstrap gọi require trước khi hệ module tồn tại.
    loader.load({ id: PACKAGE_NAME, factory: (require: (spec: string) => unknown) => require("react") });
    expect(() => loader.create({})).toThrow(
      "client-modules: " + PACKAGE_NAME + '/client.js requested external "react" before the module system existed',
    );

    // (3) factory thiếu bề mặt module bootstrap.
    loader.load({ id: PACKAGE_NAME, factory: () => ({}) });
    expect(() => loader.create({})).toThrow("client-modules: " + PACKAGE_NAME + "/client.js did not export the bootstrap module face");

    // (4) create gọi lần hai sau khi hệ module đã tiếp quản: hệ module thật bật mode sang §live§.
    const sentinel = { system: true };
    loader.load({ id: PACKAGE_NAME, factory: () => ({ apply: () => undefined, createClientModuleSystem: () => sentinel }) });
    expect(loader.create({})).toBe(sentinel);
    loader.mode = "live";
    expect(() => loader.create({})).toThrow("client-modules: window.__ModuleLoader__.create called after module-system boot");
  });

  test("row injection đúng thứ tự: hàng đợi → global → preload application → script bootstrap", () => {
    const graph = {
      rev: REV,
      release: { version: "0.1.0" },
      entries: [],
      batches: [
        { phase: "bootstrap" as const, url: "plugins/??" + PACKAGE_NAME + "/client.js&rev=1", rev: "1", entries: [PACKAGE_NAME] },
        { phase: "application" as const, url: "plugins/??a/client.js&rev=2", rev: "2", entries: ["a"] },
      ],
    };
    const rows = bootInjections(graph);
    // 19/10/2026: MỌI row INLINE phải đứng TRƯỚC mọi row có `src` (thẻ src chặn parser và chạy bundle ngay):
    // facade __ModuleLoader__ → global payload → preload application → script-src bootstrap.
    // 20/10/2026 — ALIAS __DSH_BOOT__ ĐÃ BỎ (rename CÓ CHỦ ĐÍCH): vỏ SPA của ta đọc __GBH_BOOT__ nên
    // không còn row script alias thứ ba; bốn row còn lại đúng thứ tự thực thi.
    expect(rows.map((row) => row.kind)).toEqual(["script", "global", "script-preload", "script-src"]);
    const global = rows[1];
    expect(global !== undefined && "name" in global ? global.name : "").toBe("__GBH_BOOT__");
    // 20/10/2026 — ALIAS __DSH_BOOT__ ĐÃ BỎ: dist CỦA TA đã được phục vụ và nó đọc __GBH_*.
    // Trang không còn chuỗi DSH nào từ tầng boot.
    expect(rows.some((row) => "text" in row && String(row.text).includes("__DSH_BOOT__"))).toBe(false);
    // Chống hồi quy: global PHẢI là row INLINE thứ hai, trước MỌI row có `src`.
    const viTriGlobal = rows.findIndex((row) => row.kind === "global");
    const viTriSrcDau = rows.findIndex((row) => row.kind === "script-src" || row.kind === "script-preload");
    // Global phải đứng trước row src đầu tiên (nếu không bundle đọc __GBH_BOOT__ lúc parse sẽ ném).
    expect(viTriGlobal).toBeLessThan(viTriSrcDau);
  });
});

describe("byte thân phản hồi (ADR 0004 `8)", () => {
  test("thân script combo là byte ghép đúng thứ tự, đã bỏ vết sourceURL/sourceMappingURL", () => {
    const first = Buffer.from('window.__ModuleLoader__.load({id:"a",factory:()=>({a:1})});\n//# sourceMappingURL=client.js.map\n');
    const second = Buffer.from('window.__ModuleLoader__.load({id:"b",factory:()=>({b:2})});\n//# sourceURL=client.js\n');
    const resources = [
      { id: "a", rev: REV, clientPath: "/tmp/a/client.js", fileName: "client.js", bundle: first },
      { id: "b", rev: REV, clientPath: "/tmp/b/client.js", fileName: "client.js", bundle: second },
    ];
    const body = buildComboScript(resources, "??a/client.js,b/client.js&rev=" + REV + ".map");
    const expected = Buffer.from(
      'window.__ModuleLoader__.load({id:"a",factory:()=>({a:1})});\n;\n' +
        'window.__ModuleLoader__.load({id:"b",factory:()=>({b:2})});\n;\n' +
        "//# sourceMappingURL=??a/client.js,b/client.js&rev=" + REV + ".map\n",
    );
    expect(Buffer.compare(body, expected)).toBe(0);
    // Byte phải đúng: nếu ai đó ép Uint8Array qua String thì chuỗi sẽ thành danh sách số thập phân.
    expect(body.toString("utf8")).not.toMatch(/^\d+,\d+,/);
    expect(body.toString("utf8")).toContain('id:"a"');
  });

  test("source map combo là Indexed v3 với offset dòng đúng", () => {
    const resources = [
      { id: "a", rev: "1", clientPath: "/tmp/khong-ton-tai-a.js", fileName: "client.js", bundle: Buffer.from("// a\n") },
      { id: "b", rev: "1", clientPath: "/tmp/khong-ton-tai-b.js", fileName: "client.js", bundle: Buffer.from("// b\n// b2\n") },
    ];
    const map = JSON.parse(buildComboSourceMap(resources).toString("utf8")) as {
      version: number;
      file: string;
      sections: { offset: { line: number; column: number }; map: { sources: string[] } }[];
    };
    expect(map.version).toBe(3);
    expect(map.file).toBe("client.js");
    expect(map.sections.length).toBe(2);
    expect(map.sections[0]?.offset.line).toBe(0);
    expect(map.sections[1]?.offset.line).toBe(2);
    expect(map.sections[1]?.map.sources[0]).toBe("/plugins/b/client.js");
  });
});

describe("bản build thật — hai nửa đúng khuôn", () => {
  test("lib/client.js tự đăng ký một factory lười và KHÔNG require module nào lúc nạp", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-client-modules-"));
    const built = await buildPackage(out);
    const code = readFileSync(built.client, "utf8");
    // Không có binding require nào ở tầm file: nếu bundle có tham chiếu require tự do thì dòng dưới đã ném
    // ReferenceError, nên việc nạp trót lọt chính là bằng chứng bundle tự chứa, không require module nào.
    expect(/^\s*import\s/m.test(code)).toBe(false);

    const calls: { id: string; factory: (require: (spec: string) => unknown) => unknown }[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: (typeof calls)[number]) => calls.push(registration) } });
    // MỘT ID theo mục §8: bundle CHỈ đăng ký id của nó. Id stock khai trong `gbh.row.aliases` để tầng nạp
    // phát entry alias trỏ về chính URL này — đăng ký hai lần = bundle chạy hai lần = `duplicate factory
    // registration` (đã cắn ngày 17/10/2026). Ca canh này bắt được ca `ui-sidebar` (dòng hai-id nằm trong `build.ts`).
    expect(calls.length).toBe(1);
    expect(calls[0]?.id).toBe(PACKAGE_NAME);
    expect(calls.some((call) => call.id === STOCK_NAME)).toBe(false);
    const moduleExports = calls[0]?.factory(() => {
      throw new Error("client-modules: khong duoc goi external o day");
    }) as { apply?: unknown; createClientModuleSystem?: unknown; inject?: string[] };
    expect(typeof moduleExports.createClientModuleSystem).toBe("function");
    expect(typeof moduleExports.apply).toBe("function");
    expect(moduleExports.inject).toEqual(["loader"]);

    const graph = fixtureGraph();
    const system = (moduleExports.createClientModuleSystem as (target: unknown, bootstrap: unknown, options: unknown) => ClientModuleSystem)(
      { mode: "queue", pendingQueue: [], load: () => undefined },
      { id: calls[0]?.id, exports: moduleExports },
      { boot: graph, staticModules: {} },
    );
    expect(system.version).toBe("client");
    expect(system.manifest.modules.length).toBe(72);
    expect(system.manifest.release?.version).toBe("0.2.1-alpha.4");
  });

  test("lib/index.js chỉ import node: builtins và peer cordis", async () => {
    const out = await mkdtemp(join(tmpdir(), "gbh-client-modules-node-"));
    const built = await buildPackage(out);
    const code = readFileSync(built.node, "utf8");
    const specifiers = [...code.matchAll(/from\s+"([^"\s]+)"/g)].map((match) => match[1] ?? "");
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      const allowed = specifier.startsWith("node:") || specifier === "@deepseek-ai/cordis" || specifier.startsWith("./") || specifier.startsWith("../");
      expect(allowed).toBe(true);
    }
  });

  test("fixture C1 chạy qua bản build: 72 dòng, mọi tier immediately giữ nguyên", async () => {
    const capture = readFixture<{ entries: { immediately?: boolean }[] }>();
    const immediate = capture.entries.filter((entry) => entry.immediately === true).length;
    expect(immediate).toBeGreaterThan(2);
    const system = new ClientModuleSystem({
      manifest: fixtureGraph(),
      staticModules: {},
      registrationTarget: { mode: "queue", pendingQueue: [], load: () => undefined },
      bootstrapModule: { id: PACKAGE_NAME, exports: { face: true } },
    });
    expect(system.manifest.plugins.filter((row) => row.immediately).length).toBe(immediate);
    expect(system.loadCache.get(PACKAGE_NAME)?.exports).toEqual({ face: true });
  });
});