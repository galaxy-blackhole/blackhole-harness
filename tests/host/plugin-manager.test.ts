/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Test A/B cho gói plugin-manager (hạ tầng cài/gỡ plugin): mặt export 5 artifact · parseInstallSpec ·
 *      classifyInstallFailure · registry · patch · run-tree · tools · locale — so trực tiếp với artefact gốc.
 *      10/11/2026: thêm test DANH TÍNH lớp bundle — công tắc gửi id stock phải tắt được lớp khai bằng tên của ta
 *      (lỗi thật: tắt công tắc "Tự động duyệt uỷ quyền" mà row `auto-review` vẫn mount, menu quyền 4 mục).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { khoaBundle, laCungBundle } from "../../packages/host/plugin-manager/src/bundle-rename.ts";
import { chonBundle } from "../../packages/host/plugin-manager/src/manager-support.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS = join(REPO, "packages", "host", "plugin-manager");
/** Bản gốc (CHỈ ĐỌC) — oracle. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-plugin-manager");

/** Nạp một artifact (của ta) theo đường dẫn động. */
async function ourArtifact(name: string): Promise<Record<string, unknown>> {
  return (await import(join(OURS, "lib", name))) as Record<string, unknown>;
}

/** Nạp một artifact gốc (CHỈ ĐỌC) — bản gốc để subpath trong lib/types/, ta phát ra lib/ nên phải dò 2 chỗ. */
async function stockArtifact(name: string): Promise<Record<string, unknown>> {
  const direct = join(STOCK, "lib", name);
  try {
    return (await import(direct)) as Record<string, unknown>;
  } catch {
    return (await import(join(STOCK, "lib", "types", name))) as Record<string, unknown>;
  }
}

/** Tên export theo mọi câu export {...} trong file. */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/** Chụp lỗi thành hình dạng so sánh được. */
function capture(run: () => unknown): { name?: string; message: string } {
  try {
    run();
    return { message: "<khong-nem>" };
  } catch (error) {
    const failure = error as Error;
    return { name: failure.name, message: failure.message };
  }
}

describe("plugin-manager — mặt export 5 artifact", () => {
  test("lib/index.js export ĐÚNG 5 tên như gốc", async () => {
    const mine = exportNames(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    expect(mine).toEqual(exportNames(readFileSync(join(STOCK, "lib", "index.js"), "utf8")));
    expect(mine).toEqual(["InvalidInstallSpecError", "PluginManager", "classifyInstallFailure", "default", "parseInstallSpec"]);
    expect((await ourArtifact("index.js"))["default"]).toBe((await ourArtifact("index.js"))["PluginManager"]);
  });

  test("lib/registry.js export trùng tập tên gốc (so RUNTIME keys)", async () => {
    expect(Object.keys(await ourArtifact("registry.js")).sort()).toEqual(Object.keys(await stockArtifact("registry.js")).sort());
  });

  test("lib/operations.js export trùng tập tên gốc (so RUNTIME keys)", async () => {
    expect(Object.keys(await ourArtifact("operations.js")).sort()).toEqual(Object.keys(await stockArtifact("operations.js")).sort());
  });

  test("lib/tools.js export trùng tập tên gốc (so RUNTIME keys)", async () => {
    expect(Object.keys(await ourArtifact("tools.js")).sort()).toEqual(Object.keys(await stockArtifact("tools.js")).sort());
  });

  test("lib/types.js export trùng tập tên gốc (so RUNTIME keys)", async () => {
    const mine = Object.keys(await import(join(OURS, "lib", "types.js")) as Record<string, unknown>).sort();
    const theirs = Object.keys(await import(join(STOCK, "lib", "types", "types.js")) as Record<string, unknown>).sort();
    expect(mine).toEqual(theirs);
  });

  test("2 artifact typert = bản gốc CHỈ sau quy đổi OWNERSHIP (id stock → id ta), phần còn lại byte-for-byte", () => {
    const stockId = "@deepseek-ai/dsh-plugin-manager";
    const ourId = "@galaxy-blackhole/gbh-host-plugin-manager";
    for (const artifact of ["typert.host.js", "typert.remote-client.js"]) {
      const stock = readFileSync(join(STOCK, "lib", artifact), "utf8");
      const ours = readFileSync(join(OURS, "lib", artifact), "utf8");
      // Bằng chứng de-bundle: sau khi đổi id, artefact của ta bằng ĐÚNG bản gốc.
      expect(ours).toBe(stock.split(stockId).join(ourId));
      // Cổng ownership: id stock phải BIẾN MẤT (typert-loader từ chối manifest không do gói export nó).
      expect(ours.split(stockId).length - 1).toBe(0);
      expect(ours.split(ourId).length - 1).toBe(stock.split(stockId).length - 1);
    }
  });
});

describe("plugin-manager — parseInstallSpec A/B", () => {
  test("spec npm thường", async () => {
    const mine = (await ourArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    const theirs = (await stockArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    for (const raw of ["left-pad", "left-pad@1.3.0", "@scope/pkg@^2"]) expect(mine(raw)).toEqual(theirs(raw));
  });

  test("spec git/url", async () => {
    const mine = (await ourArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    const theirs = (await stockArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    for (const raw of ["github:user/repo", "https://github.com/user/repo.git", "git+https://example.com/x.git#main"]) {
      expect(capture(() => mine(raw))).toEqual(capture(() => theirs(raw)));
    }
  });

  test("spec đường dẫn/tarball", async () => {
    const mine = (await ourArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    const theirs = (await stockArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    for (const raw of ["./local/plugin", "/abs/plugin.tgz", "file:./x"]) expect(capture(() => mine(raw))).toEqual(capture(() => theirs(raw)));
  });

  test("spec rỗng/sai ⇒ cùng lỗi InvalidInstallSpecError", async () => {
    const mine = (await ourArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    const theirs = (await stockArtifact("index.js"))["parseInstallSpec"] as (v: string) => unknown;
    for (const raw of ["", "   ", "ftp://x/y"]) {
      const a = capture(() => mine(raw));
      expect(a).toEqual(capture(() => theirs(raw)));
    }
  });
});

describe("plugin-manager — classifyInstallFailure A/B", () => {
  test("phân loại lỗi registry/404/mạng", async () => {
    const mine = (await ourArtifact("index.js"))["classifyInstallFailure"] as (f: unknown) => unknown;
    const theirs = (await stockArtifact("index.js"))["classifyInstallFailure"] as (f: unknown) => unknown;
    const facts = [
      { kind: "npm", log: "E404 Not Found", spec: { kind: "registry", name: "x" } },
      { kind: "npm", log: "ETIMEDOUT", spec: { kind: "registry", name: "x" } },
      { kind: "git", log: "fatal: repository not found", spec: { kind: "git", url: "https://x" } },
    ];
    for (const fact of facts) expect(capture(() => mine(fact))).toEqual(capture(() => theirs(fact)));
  });
});

describe("plugin-manager — registry · patch · run-tree · tools A/B", () => {
  test("registry: hằng số + normalizeRegistry + registryPlan", async () => {
    const mine = await ourArtifact("registry.js");
    const theirs = await stockArtifact("registry.js");
    for (const key of ["OFFICIAL_NPM_REGISTRY", "NPMMIRROR_REGISTRY"]) expect(mine[key]).toBe(theirs[key]);
    const normMine = mine["normalizeRegistry"] as (v: string) => string;
    const normTheirs = theirs["normalizeRegistry"] as (v: string) => string;
    for (const url of ["https://registry.npmjs.org", "https://registry.npmmirror.com/"]) expect(normMine(url)).toBe(normTheirs(url));
    const planMine = mine["registryPlan"] as (a: unknown, b: unknown) => unknown;
    const planTheirs = theirs["registryPlan"] as (a: unknown, b: unknown) => unknown;
    for (const args of [[undefined, undefined], ["https://registry.npmjs.org", {}], [null, { npm: "https://x" }]]) {
      expect(capture(() => planMine(args[0], args[1]))).toEqual(capture(() => planTheirs(args[0], args[1])));
    }
  });

  test("patch: flatten trùng kết quả với bản gốc", async () => {
    const flattenMine = (await import(join(OURS, "src", "patch.ts")) as Record<string, unknown>)["flatten"] as (rows: unknown[]) => unknown;
    const flattenTheirs = (await import(join(STOCK, "lib", "types", "patch.js")) as Record<string, unknown>)["flatten"] as (rows: unknown[]) => unknown;
    const rows = [{ id: "a", disabled: true }, { id: "b" }];
    expect(flattenMine(rows)).toEqual(flattenTheirs(rows));
  });

  test("run-tree: leadsOwnGroup trùng bản gốc trên mọi platform", async () => {
    const mine = (await import(join(OURS, "src", "run-tree.ts")) as Record<string, unknown>)["leadsOwnGroup"] as (k: string, p?: string) => boolean;
    const theirs = (await import(join(STOCK, "lib", "types", "run-tree.js")) as Record<string, unknown>)["leadsOwnGroup"] as (k: string, p?: string) => boolean;
    for (const platform of ["darwin", "linux", "win32"] as const) {
      for (const kind of ["cli", "service"] as const) expect(mine(kind, platform)).toBe(theirs(kind, platform));
    }
  });

  test("tools: inject đúng tập service như gốc", async () => {
    const mine = (await ourArtifact("tools.js"))["inject"] as string[];
    const theirs = (await stockArtifact("tools.js"))["inject"] as string[];
    expect(mine).toEqual(theirs);
  });

  test("locale 4 tệp chép NGUYÊN VĂN", () => {
    for (const relative of [["locale", "en.json"], ["locale", "zh.json"], ["locale", "tools", "en.json"], ["locale", "tools", "zh.json"]]) {
      expect(readFileSync(join(OURS, ...relative)).equals(readFileSync(join(STOCK, ...relative)))).toBe(true);
    }
  });
});

describe("plugin-manager — Config + trạng thái row", () => {
  test("String(Config) trùng từng ký tự", async () => {
    const mine = (await ourArtifact("index.js"))["PluginManager"] as { Config: unknown };
    const theirs = (await stockArtifact("index.js"))["PluginManager"] as { Config: unknown };
    expect(String(mine.Config)).toBe(String(theirs.Config));
  });

  test("row mang ĐÚNG id plugin-manager: đang MOUNT (gbh.row) hay đang PARKED (park/row_unmounted_ly_do)", () => {
    interface Row { id?: string; tests?: string[] }
    interface Park { ly_do?: string; row?: Row }
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh?: { row?: Row; park?: Park; row_unmounted_ly_do?: Park } };
    const mounted = meta.gbh?.row;
    const parked = meta.gbh?.row_unmounted_ly_do ?? meta.gbh?.park;
    const row = mounted ?? parked?.row;
    // Bất biến bền qua mọi lần flip row: luôn đúng id row thật, và chỉ MỘT trong hai trạng thái tồn tại.
    expect(row).toBeDefined();
    expect(row?.id).toBe("plugin-manager");
    expect(row?.tests).toContain("tests/host/plugin-manager.test.ts");
    if (mounted !== undefined) expect(parked).toBeUndefined();
    else {
      expect(typeof parked?.ly_do).toBe("string");
      expect((parked?.ly_do ?? "").length).toBeGreaterThan(20);
    }
  });
});

describe("plugin-manager — danh tính lớp bundle (lỗi: tắt công tắc mà row vẫn mount)", () => {
  /** Id STOCK của tính năng "Tự động duyệt uỷ quyền" (kernel). */
  const STOCK_AUTO = "@deepseek-ai/dsh-experimental-auto-review";
  /** Id bundle CỦA TA cho cùng tính năng đó. */
  const OURS_AUTO = "@galaxy-blackhole/gbh-auto-review-bundle";
  /** Cặp KHÔNG có trong bảng DOI_TEN_BUNDLE ⇒ danh tính phải suy từ KHOÁ TÍNH NĂNG (đúng cảnh bản cài). */
  const STOCK_TERMINAL = "@deepseek-ai/dsh-experimental-terminal-bundle";
  const OURS_TERMINAL = "@galaxy-blackhole/gbh-terminal-bundle";

  test("khoaBundle: bỏ scope + tiền tố gbh-/dsh-/experimental- + hậu tố -bundle/-profile", () => {
    expect(khoaBundle(STOCK_TERMINAL)).toBe("terminal");
    expect(khoaBundle(OURS_TERMINAL)).toBe("terminal");
    expect(khoaBundle("@galaxy-blackhole/gbh-agent-team-profile")).toBe("agent-team");
    expect(khoaBundle("@deepseek-ai/dsh-experimental-agent-team-profile")).toBe("agent-team");
  });

  test("laCungBundle: id stock và tên của ta là MỘT lớp, kể cả khi bảng đổi tên mất tác dụng", () => {
    expect(laCungBundle(STOCK_AUTO, OURS_AUTO)).toBe(true);
    // Ca của bản cài: DOI_TEN_BUNDLE trong artefact đã bị đổi id ⇒ chỉ còn đường KHOÁ TÍNH NĂNG.
    expect(laCungBundle(STOCK_TERMINAL, OURS_TERMINAL)).toBe(true);
    expect(laCungBundle(OURS_AUTO, OURS_TERMINAL)).toBe(false);
  });

  test("TẮT bằng id STOCK phải bỏ được lớp khai bằng TÊN CỦA TA (đây là no-op cũ)", () => {
    const truoc = ["@galaxy-blackhole/gbh-bundle", OURS_AUTO, OURS_TERMINAL];
    const sau = ["@galaxy-blackhole/gbh-bundle", OURS_TERMINAL];
    expect(chonBundle(truoc, STOCK_AUTO, false)).toEqual(sau);
    expect(chonBundle(truoc, OURS_AUTO, false)).toEqual(sau);
    // Không có bảng đổi tên: danh tính vẫn đúng nhờ khoá tính năng.
    expect(chonBundle(truoc, STOCK_TERMINAL, false)).toEqual(["@galaxy-blackhole/gbh-bundle", OURS_AUTO]);
  });

  test("BẬT không nhân đôi lớp và không ghi thêm cách viết thứ hai", () => {
    const daCo = ["@galaxy-blackhole/gbh-bundle", OURS_AUTO];
    expect(chonBundle(daCo, OURS_AUTO, true)).toEqual(daCo);
    expect(chonBundle(daCo, STOCK_AUTO, true)).toEqual(daCo);
    expect(chonBundle(["@galaxy-blackhole/gbh-bundle"], OURS_AUTO, true))
      .toEqual(["@galaxy-blackhole/gbh-bundle", OURS_AUTO]);
  });

  test("không đổi gì khi lớp vốn không có mặt, và không xoá oan lớp khác", () => {
    const truoc = ["@galaxy-blackhole/gbh-bundle"];
    expect(chonBundle(truoc, OURS_AUTO, false)).toEqual(truoc);
    expect(chonBundle(truoc, OURS_TERMINAL, false)).toEqual(truoc);
    expect(chonBundle(truoc, STOCK_TERMINAL, false)).toEqual(truoc);
  });

  test("TẮT rồi BẬT lại trả về đúng MỘT lớp, ở cuối danh sách", () => {
    const dau = ["@galaxy-blackhole/gbh-bundle", OURS_TERMINAL];
    const tat = chonBundle([...dau, OURS_AUTO], STOCK_AUTO, false);
    expect(tat).toEqual(dau);
    expect(chonBundle(tat, STOCK_AUTO, true)).toEqual([...dau, OURS_AUTO]);
  });
});

