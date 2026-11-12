/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test nửa browser của row ui-sidebar-files: một-id · HAI slot đúng tên bản gốc · từ điển và
 *      kiểu tab đối chứng với chính bundle gốc · cổng boolean PHẠM VI MODULE · ca apply ném lỗi.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/client/ui-sidebar-files/build.ts";
import { fileAddressFor, sessionFileAddress } from "../../packages/client/ui-sidebar-files/src/paths.ts";
import { withoutVi, viDictionary } from "../lib/vi-locale.ts";

/** Id mà bundle ĐƯỢC PHÉP đăng ký (đúng một) — luật §8 của docs/recipes/HOST-ROW-REWRITE.md. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-files";

/** Id gói GỐC — chỉ được khai ở §gbh.row.aliases§, KHÔNG bao giờ đăng ký trong bundle. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-sidebar-files";

/** Hai slot mà bản gốc đăng ký (cổng check:rows so đúng tập này). */
const SLOTS = ["sidebar.right.pane.tab", "sidebar.right.pane.tab.title"];

/** Slot CON kiểu danh sách trong header thân tab — nguyên văn từ bundle gốc. */
const CHILD_SLOT = "sidebar.right.tab.files.actions";

/** Thư mục gói của ta trong repo. */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-sidebar-files");

/** Thư mục gói GỐC trong runtime của app (chỉ đọc — nguồn đối chứng). */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-sidebar-files");

/* Build MỘT lần vào thư mục tạm: ca test đo ARTIFACT THẬT (không đo lib/ có thể cũ trong repo), và đo luôn
   hợp đồng §buildPackage(outDir)§ — thư mục đích truyền qua tham số, không hard-code import.meta.dir/lib. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-ui-sidebar-files-"));
await buildPackage(OUT);

/** Một đăng ký bắt được từ bundle. */
interface Registration {
  /** Id module mà bundle tự khai. */
  id: string;
  /** Factory của bundle. */
  factory: (require: (spec: string) => unknown) => unknown;
}

/** Những gì plugin đăng ký với context giả. */
interface Recorded {
  /** Từ điển theo namespace. */
  dictionaries: { namespace: string; copy: Record<string, Record<string, string>> }[];
  /** Phím tắt. */
  shortcuts: Record<string, unknown>[];
  /** Kiểu tab. */
  tabTypes: Record<string, unknown>[];
  /** Chỗ ngồi: slot · spec · component. */
  slots: { slot: string; definition: Record<string, unknown>; component: unknown }[];
}

/**
 * Nạp một bundle .js đã build trong window giả.
 * Nhận: code — nội dung artifact (script classic).
 * Trả: các đăng ký mà bundle đã gọi (mỗi lần nạp là một module TƯƠI, nên cờ phạm vi module không dính).
 */
function loadBundle(code: string): Registration[] {
  const seen: Registration[] = [];
  const fakeWindow = {
    __ModuleLoader__: {
      load: (registration: Registration): void => {
        seen.push(registration);
      },
    },
  };
  new Function("window", code)(fakeWindow);
  return seen;
}

/**
 * require giả: ĐÚNG hình dạng module thật mà hai nửa cần lúc §apply§ (hẹp hơn thật là che lỗi).
 * Nhận: không.
 * Trả: hàm require trả module theo id, ném khi gặp id lạ.
 */
function moduleStub(): (spec: string) => unknown {
  const jsx = (type: unknown, props: Record<string, unknown>, key?: unknown): unknown => ({ type, props, key });
  return (spec: string): unknown => {
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (spec === "react") return { useRef: (initial: unknown) => ({ current: initial }), useEffect: () => undefined, useLayoutEffect: () => undefined };
    if (spec .endsWith("-client-ui-primitives")) {
      return {
        GuideArtworkFiles: "GuideArtworkFiles",
        IconFolderOpenRegular: "IconFolderOpenRegular",
        IconFolderCloseRegular: "IconFolderCloseRegular",
        IconPauseOutlineRegular: "IconPauseOutlineRegular",
        IconPlayOutlineRegular: "IconPlayOutlineRegular",
        IconRefreshOutlineRegular: "IconRefreshOutlineRegular",
        FileTypeIcon: "FileTypeIcon",
        PathLabel: "PathLabel",
        Tooltip: "Tooltip",
        classifyFileType: (name: string) => "file:" + name,
      };
    }
    if (spec .endsWith("-client-store")) return { defineStore: (definition: Record<string, unknown>) => ({ definition }) };
    if (spec === "@deepseek-ai/cordis") return {};
    throw new Error("module lạ: " + spec);
  };
}

/**
 * Context giả ghi lại mọi đăng ký (đúng hình dạng seam mà plugin cần).
 * Nhận: không.
 * Trả: context giả và bộ ghi.
 */
function harness(): { ctx: never; recorded: Recorded } {
  const recorded: Recorded = { dictionaries: [], shortcuts: [], tabTypes: [], slots: [] };
  const ctx = {
    effect: (callback: () => unknown): unknown => callback(),
    inject: (_dependencies: string[], callback: (scoped: unknown) => void): void => {
      callback(ctx);
    },
    locale: {
      bind: () => (key: string, params?: Record<string, string>) => (params === undefined ? key : key + ":" + JSON.stringify(params)),
      register: (namespace: string, copy: Record<string, Record<string, string>>): void => {
        recorded.dictionaries.push({ namespace, copy });
      },
    },
    slots: {
      inject: (slot: string, register: () => unknown): void => {
        register();
        const last = recorded.slots[recorded.slots.length - 1];
        if (last !== undefined) last.slot = slot;
      },
      /* Khuôn thật của vỏ: §register(spec, component)§ — component là THAM SỐ THỨ HAI. */
      register: (definition: Record<string, unknown>, component?: unknown): void => {
        recorded.slots.push({ slot: "", definition, component });
      },
    },
    sidebarRight: {
      commandTarget: () => ({ sessionId: "s1" }),
      openTabFromTarget: () => undefined,
    },
    sidebarRightTabs: {
      register: (definition: Record<string, unknown>): void => {
        recorded.tabTypes.push(definition);
      },
    },
    remote: {
      $stream: () => ({ dispose: () => undefined, [Symbol.asyncIterator]: async function* () {} }),
      workspaceFiles: {
        list: async () => ({ ok: true, value: { entries: [], truncated: false } }),
        changes: async function* () {},
      },
    },
    shortcuts: {
      register: (definition: Record<string, unknown>): void => {
        recorded.shortcuts.push(definition);
      },
    },
  };
  return { ctx: ctx as never, recorded };
}

/**
 * Chuẩn hoá tên package để so cấu trúc giữa hai bên.
 * Nhận: value — giá trị bất kỳ (hàm, chuỗi, mảng, object).
 * Trả: bản sao đã thay id hai bên bằng §PKG§ và hàm bằng §Fn§, khoá đã sắp xếp.
 */
function normalize(value: unknown): unknown {
  if (typeof value === "function") return "Fn";
  if (typeof value === "string") {
    return value
      .split(STOCK_NAME)
      .join("PKG")
      .split(PACKAGE_NAME)
      .join("PKG")
      /* Tiền tố lớp là thứ DUY NHẤT được phép đổi (bản gốc dùng hash của CSS module): quy về một token. */
      .split("k-1LKG_")
      .join("LOP_")
      .split("gbhFiles_")
      .join("LOP_");
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) out[key] = normalize((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

/**
 * Bản ghi của MỘT bên, đã rút về phần so được.
 * Nhận: recorded — bộ ghi của một lần chạy §apply§.
 * Trả: object đã chuẩn hoá gồm từ điển · kiểu tab · phím tắt · danh sách chỗ ngồi.
 */
function shapeOf(recorded: Recorded): unknown {
  return normalize({
    dictionaries: withoutVi(recorded.dictionaries),
    tabTypes: recorded.tabTypes,
    shortcuts: recorded.shortcuts,
    slots: recorded.slots.map((entry) => ({ slot: entry.slot, definition: entry.definition, component: entry.component })),
  });
}

/** Nội dung artifact nửa client vừa build. */
const CLIENT_CODE = readFileSync(join(OUT, "client.js"), "utf8");

/** Nội dung bundle GỐC trong runtime của app (nguồn đối chứng). */
const STOCK_CODE = readFileSync(join(STOCK, "lib", "client.js"), "utf8");

describe("gbh-client-ui-sidebar-files — nửa browser", () => {
  test("bundle đăng ký ĐÚNG MỘT id: id CỦA TA (không đăng ký id gói gốc)", () => {
    const calls = loadBundle(CLIENT_CODE);
    expect(calls.length).toBe(1);
    expect(calls[0]?.id).toBe(PACKAGE_NAME);
    // Luật một-id: id gốc đi qua §gbh.row.aliases§; đăng ký nó trong bundle ⇒ chạy hai lần ⇒ app trắng.
    expect(/id:\s*"@deepseek-ai/u.test(CLIENT_CODE)).toBe(false);
    // Bundle phải nạp được bằng THẺ SCRIPT: không cú pháp ESM nào lọt ra artifact.
    expect(/^\s*(export|import)\s/mu.test(CLIENT_CODE)).toBe(false);
  });

  test("apply gắn ĐÚNG HAI slot của bản gốc, component là THAM SỐ THỨ HAI", () => {
    const calls = loadBundle(CLIENT_CODE);
    const plugin = calls[0]?.factory(moduleStub()) as { apply(ctx: unknown): void };
    const { ctx, recorded } = harness();
    plugin.apply(ctx);
    expect(recorded.slots.map((entry) => entry.slot).sort()).toEqual([...SLOTS].sort());
    for (const entry of recorded.slots) {
      expect(SLOTS).toContain(entry.definition.name as string);
      // key PHẢI bằng id kiểu tab: sidebar phải tra chỗ ngồi theo §definition?.id ?? tab.kind§.
      expect(entry.definition.key).toBe(PACKAGE_NAME);
      expect(typeof entry.component).toBe("function");
    }
    const body = recorded.slots.find((entry) => entry.definition.name === "sidebar.right.pane.tab");
    // Chỉ THÂN tab khai §locale§: bản gốc cũng vậy (tiêu đề chỉ có name + key) — đối chứng ở ca dưới.
    expect(body?.definition.locale).toBe("sidebarFiles");
    expect(body?.definition.children).toEqual({ [CHILD_SLOT]: { kind: "list", scope: "session" } });
    expect(typeof body?.definition.inject).toBe("function");
    expect(body?.definition.store).toBeDefined();
  });

  test("từ điển · kiểu tab · phím tắt · chỗ ngồi TRÙNG CẤU TRÚC với chính bundle gốc", () => {
    const stockRegistration = loadBundle(STOCK_CODE)[0];
    const stock = harness();
    (stockRegistration?.factory(moduleStub()) as { apply(ctx: unknown): void }).apply(stock.ctx);
    const mine = harness();
    const calls = loadBundle(CLIENT_CODE);
    (calls[0]?.factory(moduleStub()) as { apply(ctx: unknown): void }).apply(mine.ctx);
    expect(shapeOf(mine.recorded)).toEqual(shapeOf(stock.recorded));
    // Và khoá cứng vài giá trị nguyên văn để một bản gốc đổi màu cũng không âm thầm trôi theo.
    const tabType = mine.recorded.tabTypes[0];
    expect(tabType?.kind).toBe("files");
    expect(tabType?.priority).toBe("builtin");
    expect(tabType?.guide).toEqual([
      { id: "workspace", commandId: "workspace.files", order: 10, title: expect.any(Function), description: expect.any(Function), icon: "GuideArtworkFiles" },
    ]);
    expect(mine.recorded.shortcuts[0]?.id).toBe("workspace.files");
    expect(mine.recorded.shortcuts[0]?.aliases).toEqual(["workspace files", "files"]);
    expect(mine.recorded.shortcuts[0]?.regions).toEqual(["page", "editable", "terminal"]);
    expect(Object.keys((mine.recorded.shortcuts[0]?.defaults ?? {}) as object).sort()).toEqual([
      "desktop:linux",
      "desktop:macos",
      "desktop:windows",
      "web:macos",
      "web:windows",
    ]);
    const copy = mine.recorded.dictionaries[0]?.copy as Record<string, Record<string, string>> | undefined;
    expect(mine.recorded.dictionaries[0]?.namespace).toBe("sidebarFiles");
    expect(Object.keys(copy?.["en"] ?? {}).length).toBe(17);
    expect(Object.keys(copy?.["zh"] ?? {}).length).toBe(17);
    expect(copy?.["en"]?.["type.label"]).toBe("Files");
    expect(copy?.["zh"]?.["type.label"]).toBe("文件");
  });

  test("cổng boolean PHẠM VI MODULE: gọi apply lần hai (kể cả ctx KHÁC) là NO-OP", () => {
    const calls = loadBundle(CLIENT_CODE);
    const plugin = calls[0]?.factory(moduleStub()) as { apply(ctx: unknown): void };
    const first = harness();
    plugin.apply(first.ctx);
    const after = {
      slots: first.recorded.slots.length,
      shortcuts: first.recorded.shortcuts.length,
      tabTypes: first.recorded.tabTypes.length,
      dictionaries: first.recorded.dictionaries.length,
    };
    expect(after.slots).toBe(SLOTS.length);
    expect(after.tabTypes).toBe(1);
    // Cùng ctx: no-op.
    plugin.apply(first.ctx);
    expect(first.recorded.slots.length).toBe(after.slots);
    /* Ca hai entry: factory gọi lần hai ⇒ plugin instance KHÁC nhưng CÙNG module ⇒ ctx MỚI vẫn phải bị chặn.
       Khoá theo ctx là sai (hai entry ⇒ hai ctx) — đó là lỗi đã làm app trắng. */
    const second = harness();
    plugin.apply(second.ctx);
    expect(second.recorded.slots.length).toBe(0);
    expect(second.recorded.shortcuts.length).toBe(0);
    expect(second.recorded.tabTypes.length).toBe(0);
    expect(second.recorded.dictionaries.length).toBe(0);
  });

  test("apply ném lỗi ⇒ ĐÚNG MỘT dòng console.error VÀ lỗi vẫn được ném tiếp", () => {
    const calls = loadBundle(CLIENT_CODE);
    const plugin = calls[0]?.factory(moduleStub()) as { apply(ctx: unknown): void };
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => {
      logged.push(args);
    };
    try {
      // Một seam hỏng giữa đường (ở đây là §inject§) — cờ phải KHÔNG được bật, lỗi phải nổi lên trên.
      const { ctx } = harness();
      const broken = { ...(ctx as Record<string, unknown>), inject: () => { throw new Error("inject no"); } };
      expect(() => plugin.apply(broken as never)).toThrow("inject no");
      expect(logged.length).toBe(1);
      expect(String(logged[0]?.[0] ?? "")).toContain("gbh-client-ui-sidebar-files: apply nem loi");
    } finally {
      console.error = original;
    }
  });
});

describe("gbh-client-ui-sidebar-files — cây render", () => {
  test("thân tab và tiêu đề tab VẼ ĐƯỢC và TRÙNG CẤU TRÚC với bản gốc (ca phiên chưa có workspace)", () => {
    /* Ca này khoá lớp lỗi React #130: một component trả undefined (hoặc ném khi vẽ) chỉ lộ ra ở TẦNG CHẠY.
       Phiên chưa có workspace là nhánh rẻ nhất mà cả hai bên đều vẽ được với stub hook. */
    const stock = harness();
    (loadBundle(STOCK_CODE)[0]?.factory(moduleStub()) as { apply(ctx: unknown): void }).apply(stock.ctx);
    const mine = harness();
    (loadBundle(CLIENT_CODE)[0]?.factory(moduleStub()) as { apply(ctx: unknown): void }).apply(mine.ctx);
    const props = {
      useTabInfo: () => ({
        tab: {
          id: "t1",
          title: "Files",
          signal: new AbortController().signal,
          actions: { bindCommands: () => undefined, openResource: () => undefined },
        },
      }),
      sessionId: "s1",
      useSessions: (selector: (state: { byId: Record<string, { cwd?: string } | undefined> }) => unknown) => selector({ byId: {} }),
      useStore: (selector: (state: { byTab: Record<string, unknown> }) => unknown) => selector({ byTab: {} }),
      actions: {
        autoRefresh: () => undefined,
        start: () => undefined,
        loading: () => undefined,
        loaded: () => undefined,
        failed: () => undefined,
        toggled: () => undefined,
        scrolled: () => undefined,
        forget: () => undefined,
      },
      start: () => undefined,
      refresh: () => undefined,
      setAutoRefresh: () => undefined,
      load: () => undefined,
      toggle: () => undefined,
      t: (key: string) => key,
      renderSlot: () => null,
    };
    const render = (recorded: Recorded, index: number): unknown =>
      (recorded.slots[index]?.component as (p: Record<string, unknown>) => unknown)(props);
    // slots[0] = thân tab · slots[1] = tiêu đề (thứ tự inject y bản gốc — đã khoá ở ca đối chứng).
    expect(normalize(render(mine.recorded, 0))).toEqual(normalize(render(stock.recorded, 0)));
    expect(normalize(render(mine.recorded, 1))).toEqual(normalize(render(stock.recorded, 1)));
    expect(render(mine.recorded, 0)).not.toBeUndefined();
    expect(render(mine.recorded, 1)).not.toBeUndefined();
  });
});

describe("gbh-client-ui-sidebar-files — hợp đồng package", () => {
  test("nửa host export ĐÚNG tập export của bản gốc (apply), và metadata giữ luật một-id", async () => {
    const load = async (path: string): Promise<Record<string, unknown>> => (await import(path)) as Record<string, unknown>;
    const stock = await load(join(STOCK, "lib", "index.js"));
    expect(Object.keys(stock).filter((key) => key !== "default").sort()).toEqual(["apply"]);
    const ours = await load(join(OUT, "index.js"));
    expect(Object.keys(ours).filter((key) => key !== "default").sort()).toEqual(["apply"]);
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      gbh: { row: { moduleIds: string[]; aliases: string[]; tests: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toEqual([STOCK_NAME]);
    expect(meta.gbh.row.tests).toEqual(["tests/client/ui-sidebar-files.test.ts"]);
    expect(await Bun.file(join(OURS, "tests", "..", "locale", "en.json")).exists()).toBe(true);
  });

  test("locale/{en,zh}.json KHỚP BYTE-FOR-BYTE với bản gốc (luật 000e: tiêu đề hàng ở màn Plugins)", async () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = await Bun.file(join(OURS, "locale", name)).text();
      const stock = await Bun.file(join(STOCK, "locale", name)).text();
      expect(ours).toBe(stock);
    }
  });
});

// task-29 (Wave D): nơi PHÁT địa chỉ tệp dùng scheme MỚI (nơi nhận chấp nhận cả scheme cũ).
describe("task-29 — scheme resource của địa chỉ tệp", () => {
  test("sessionFileAddress phát gbh-resource://, không phát dsh-resource://", () => {
    const address = sessionFileAddress("s1", "src/app.ts");
    expect(address).toBe("gbh-resource://file/session/s1/src/app.ts");
    expect(address.startsWith("dsh-resource://")).toBe(false);
  });

  test("fileAddressFor phát gbh-resource:// cho cả đường dẫn trong/ngoài workspace", () => {
    const inside = fileAddressFor("s1", "/repo", "src/a.ts");
    const outside = fileAddressFor("s1", "/repo", "/etc/hosts");
    for (const address of [inside, outside]) {
      expect(address.startsWith("gbh-resource://file/")).toBe(true);
    }
  });
});
