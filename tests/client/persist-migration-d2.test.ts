/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test migration khoá persist Wave D2 (task-38) cho 4 gói không-verbatim: ui-open-in-app · ui-sidebar-browser · ui-sidebar-right · shortcuts
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  OPEN_IN_APP_CHOICE_KEY,
  OPEN_IN_APP_CHOICE_LEGACY_KEY,
  migrateOpenInAppChoiceKey,
  type PersistStorage,
} from "../../packages/client/ui-open-in-app/src/persist-migration.ts";
import {
  SIDEBAR_BROWSER_LEGACY_KEY,
  SIDEBAR_BROWSER_STORE_KEY,
  migrateSidebarBrowserKey,
} from "../../packages/client/ui-sidebar-browser/src/persist-migration.ts";
import {
  SIDEBAR_RIGHT_LEGACY_PREFIX,
  SIDEBAR_RIGHT_PREFIX,
  migrateSidebarRightPersistence,
  type PrefixPersistStorage,
} from "../../packages/client/ui-sidebar-right/src/persist-migration.ts";
import {
  KEYBINDINGS_LEGACY_KEY,
  KEYBINDINGS_STORAGE_KEY,
  migrateKeybindingsKey,
} from "../../packages/client/shortcuts/src/persist-migration.ts";

/** Gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");

/** Kho localStorage giả ghi lại các lần ĐỌC để chứng minh "sau migrate không đọc khoá cũ". */
interface FakeStorage extends PersistStorage {
  /** Bản đồ khoá → giá trị. */
  map: Map<string, string>;
  /** Khoá đã bị đọc. */
  reads: string[];
}

/**
 * Dựng kho giả.
 * @param initial các cặp [khoá, giá trị] ban đầu.
 * @returns kho giả.
 */
function fakeStorage(initial: [string, string][] = []): FakeStorage {
  const map = new Map<string, string>(initial);
  const reads: string[] = [];
  return {
    map,
    reads,
    getItem: (key) => {
      reads.push(key);
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** Kho giả có duyệt khoá (cho migration theo tiền tố). */
interface FakePrefixStorage extends PrefixPersistStorage {
  /** Bản đồ khoá → giá trị. */
  map: Map<string, string>;
}

/**
 * Dựng kho giả có duyệt khoá.
 * @param initial các cặp [khoá, giá trị] ban đầu.
 * @returns kho giả.
 */
function fakePrefixStorage(initial: [string, string][] = []): FakePrefixStorage {
  const map = new Map<string, string>(initial);
  return {
    map,
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** Đọc một file nguồn của gói trong repo. */
function source(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("task-38 · ui-open-in-app — dsh.open-in-app.choice → gbh.open-in-app.choice", () => {
  test("ca 1: CÓ khoá cũ ⇒ migrate đúng giá trị + xoá khoá cũ", () => {
    const storage = fakeStorage([[OPEN_IN_APP_CHOICE_LEGACY_KEY, '"vscode"']]);
    const result = migrateOpenInAppChoiceKey(storage);
    expect(result.migrated).toEqual([OPEN_IN_APP_CHOICE_KEY]);
    expect(result.removedLegacy).toEqual([OPEN_IN_APP_CHOICE_LEGACY_KEY]);
    expect(storage.map.get(OPEN_IN_APP_CHOICE_KEY)).toBe('"vscode"');
    expect(storage.map.has(OPEN_IN_APP_CHOICE_LEGACY_KEY)).toBe(false);
  });

  test("ca 2: KHÔNG có khoá cũ ⇒ mặc định, không ghi gì", () => {
    const storage = fakeStorage();
    const result = migrateOpenInAppChoiceKey(storage);
    expect(result.migrated).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  test("ca 3: sau migrate KHÔNG đọc khoá cũ — khoá cũ xuất hiện lại vẫn không ghi đè khoá mới", () => {
    const storage = fakeStorage([[OPEN_IN_APP_CHOICE_LEGACY_KEY, '"cu-1"']]);
    migrateOpenInAppChoiceKey(storage);
    storage.map.set(OPEN_IN_APP_CHOICE_LEGACY_KEY, '"cu-2"');
    const again = migrateOpenInAppChoiceKey(storage);
    expect(again.migrated).toEqual([]);
    expect(again.keptNew).toEqual([OPEN_IN_APP_CHOICE_KEY]);
    expect(storage.map.get(OPEN_IN_APP_CHOICE_KEY)).toBe('"cu-1"');
  });

  test("ca 4: nguồn — controller dùng hằng số MỚI, literal cũ chỉ còn trong bảng migration", () => {
    const controller = source("packages/client/ui-open-in-app/src/controller.ts");
    expect(controller).toContain("migrateOpenInAppChoiceKey()");
    expect(controller).toContain("OPEN_IN_APP_CHOICE_KEY");
    expect(controller).not.toContain('"dsh.open-in-app.choice"');
    expect(source("packages/client/ui-open-in-app/src/persist-migration.ts")).toContain(OPEN_IN_APP_CHOICE_LEGACY_KEY);
  });
});

describe("task-38 · ui-sidebar-browser — dsh.sidebar-browser.v1 → gbh.sidebar-browser.v1", () => {
  test("ca 1: CÓ khoá cũ ⇒ migrate đúng + xoá cũ", () => {
    const storage = fakeStorage([[SIDEBAR_BROWSER_LEGACY_KEY, '{"byTab":{"t1":{}}}']]);
    const result = migrateSidebarBrowserKey(storage);
    expect(result.migrated).toEqual([SIDEBAR_BROWSER_STORE_KEY]);
    expect(storage.map.get(SIDEBAR_BROWSER_STORE_KEY)).toBe('{"byTab":{"t1":{}}}');
    expect(storage.map.has(SIDEBAR_BROWSER_LEGACY_KEY)).toBe(false);
  });

  test("ca 2: KHÔNG có khoá cũ ⇒ mặc định, không ghi gì", () => {
    const storage = fakeStorage();
    expect(migrateSidebarBrowserKey(storage).migrated).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  test("ca 3: sau migrate không đọc lại giá trị cũ (khoá mới thắng)", () => {
    const storage = fakeStorage([[SIDEBAR_BROWSER_LEGACY_KEY, "cu-1"]]);
    migrateSidebarBrowserKey(storage);
    storage.map.set(SIDEBAR_BROWSER_LEGACY_KEY, "cu-2");
    const again = migrateSidebarBrowserKey(storage);
    expect(again.migrated).toEqual([]);
    expect(storage.map.get(SIDEBAR_BROWSER_STORE_KEY)).toBe("cu-1");
  });

  test("ca 4: nguồn — store dùng hằng số MỚI + gọi migration trước defineStore", () => {
    const store = source("packages/client/ui-sidebar-browser/src/store.ts");
    expect(store).toContain("migrateSidebarBrowserKey()");
    expect(store).toContain("SIDEBAR_BROWSER_STORE_KEY");
    expect(store).not.toContain('"dsh.sidebar-browser.v1"');
  });
});

describe("task-38 · ui-sidebar-right — tiền tố dsh.sidebar-right.v1. → gbh.sidebar-right.v1.", () => {
  test("ca 1: CÓ khoá cũ theo phiên ⇒ migrate ĐỦ mọi khoá + xoá cũ", () => {
    const storage = fakePrefixStorage([
      [SIDEBAR_RIGHT_LEGACY_PREFIX + "s1", "layout-1"],
      [SIDEBAR_RIGHT_LEGACY_PREFIX + "s2", "layout-2"],
      ["khac", "giu-nguyen"],
    ]);
    const result = migrateSidebarRightPersistence(storage);
    expect(result.migrated.sort()).toEqual([SIDEBAR_RIGHT_PREFIX + "s1", SIDEBAR_RIGHT_PREFIX + "s2"].sort());
    expect(storage.map.get(SIDEBAR_RIGHT_PREFIX + "s1")).toBe("layout-1");
    expect(storage.map.get(SIDEBAR_RIGHT_PREFIX + "s2")).toBe("layout-2");
    expect(storage.map.has(SIDEBAR_RIGHT_LEGACY_PREFIX + "s1")).toBe(false);
    expect(storage.map.get("khac")).toBe("giu-nguyen");
  });

  test("ca 2: KHÔNG có khoá cũ ⇒ mặc định, không ghi gì", () => {
    const storage = fakePrefixStorage();
    expect(migrateSidebarRightPersistence(storage).migrated).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  test("ca 3: sau migrate không đọc giá trị cũ — khoá cũ quay lại vẫn không ghi đè khoá mới", () => {
    const storage = fakePrefixStorage([[SIDEBAR_RIGHT_LEGACY_PREFIX + "s1", "cu-1"]]);
    migrateSidebarRightPersistence(storage);
    storage.map.set(SIDEBAR_RIGHT_LEGACY_PREFIX + "s1", "cu-2");
    migrateSidebarRightPersistence(storage);
    expect(storage.map.get(SIDEBAR_RIGHT_PREFIX + "s1")).toBe("cu-1");
    expect(storage.map.has(SIDEBAR_RIGHT_LEGACY_PREFIX + "s1")).toBe(false);
  });

  test("ca 4: nguồn — persistence dùng tiền tố MỚI + gọi migration trước lần đọc đầu", () => {
    const persistence = source("packages/client/ui-sidebar-right/src/persistence.ts");
    expect(persistence).toContain("migrateSidebarRightPersistence();");
    expect(persistence).toContain("SIDEBAR_RIGHT_PREFIX");
    expect(persistence).not.toContain('"dsh.sidebar-right.v1"');
  });
});

describe("task-38 · shortcuts — dsh.keybindings.v1 → gbh.keybindings.v1", () => {
  test("ca 1: CÓ khoá cũ ⇒ migrate đúng + xoá cũ", () => {
    const storage = fakeStorage([[KEYBINDINGS_LEGACY_KEY, '{"bindings":{}}']]);
    const result = migrateKeybindingsKey(storage);
    expect(result.migrated).toEqual([KEYBINDINGS_STORAGE_KEY]);
    expect(storage.map.get(KEYBINDINGS_STORAGE_KEY)).toBe('{"bindings":{}}');
    expect(storage.map.has(KEYBINDINGS_LEGACY_KEY)).toBe(false);
  });

  test("ca 2: KHÔNG có khoá cũ ⇒ mặc định, không ghi gì", () => {
    const storage = fakeStorage();
    expect(migrateKeybindingsKey(storage).migrated).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  test("ca 3: sau migrate không đọc giá trị cũ (khoá mới thắng)", () => {
    const storage = fakeStorage([[KEYBINDINGS_LEGACY_KEY, "cu-1"]]);
    migrateKeybindingsKey(storage);
    storage.map.set(KEYBINDINGS_LEGACY_KEY, "cu-2");
    const again = migrateKeybindingsKey(storage);
    expect(again.migrated).toEqual([]);
    expect(storage.map.get(KEYBINDINGS_STORAGE_KEY)).toBe("cu-1");
  });

  test("ca 4: nguồn — STORAGE_KEY MỚI + storage gọi migration trước lần đọc đầu", () => {
    expect(source("packages/client/shortcuts/src/ids.ts")).toContain('"gbh.keybindings.v1"');
    expect(source("packages/client/shortcuts/src/ids.ts")).not.toContain('"dsh.keybindings.v1"');
    const storage = source("packages/client/shortcuts/src/client/storage.ts");
    expect(storage).toContain("migrateKeybindingsKey();");
  });
});
