/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test migration khoá persist dsh.*→gbh.* (task-30): có cũ ⇒ migrate, không có ⇒ mặc định, sau migrate KHÔNG đọc cũ
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  PERSIST_KEY_MIGRATIONS,
  SESSIONS_CURRENT_STORAGE_KEY,
  WORKSPACE_VIEW_STORAGE_KEY,
  migratePersistKeys,
  type PersistStorage,
} from "../../packages/client/ui-workspace/src/persist-migration.ts";

/** Kho localStorage giả ghi lại mọi thao tác để khẳng định "có đọc khoá cũ hay không". */
interface FakeStorage extends PersistStorage {
  /** Bản đồ khoá → giá trị. */
  map: Map<string, string>;
  /** Các khoá đã bị ĐỌC (getItem) — dùng để chứng minh "sau migrate không đọc khoá cũ". */
  reads: string[];
}

/**
 * Dựng kho giả từ các cặp khoá/giá trị ban đầu.
 * @param initial các cặp [khoá, giá trị] có sẵn.
 * @returns kho giả.
 */
function fakeStorage(initial: [string, string][] = []): FakeStorage {
  const map = new Map<string, string>(initial);
  const reads: string[] = [];
  return {
    map,
    reads,
    getItem: (key: string): string | null => {
      reads.push(key);
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem: (key: string, value: string): void => {
      map.set(key, value);
    },
    removeItem: (key: string): void => {
      map.delete(key);
    },
  };
}

describe("task-30 — migration khoá persist dsh.* → gbh.*", () => {
  test("ca 1: CÓ khoá cũ ⇒ migrate đúng giá trị sang khoá mới rồi XOÁ khoá cũ", () => {
    const storage = fakeStorage([
      ["dsh.workspace.view", '{"groupBy":"workspace"}'],
      ["dsh.sessions.current", '{"sessionId":"s1"}'],
    ]);
    const result = migratePersistKeys(storage);
    expect(result.migrated.sort()).toEqual([WORKSPACE_VIEW_STORAGE_KEY, SESSIONS_CURRENT_STORAGE_KEY].sort());
    expect(result.removedLegacy.sort()).toEqual(["dsh.sessions.current", "dsh.workspace.view"]);
    expect(result.keptNew).toEqual([]);
    expect(storage.map.get(WORKSPACE_VIEW_STORAGE_KEY)).toBe('{"groupBy":"workspace"}');
    expect(storage.map.get(SESSIONS_CURRENT_STORAGE_KEY)).toBe('{"sessionId":"s1"}');
    expect(storage.map.has("dsh.workspace.view")).toBe(false);
    expect(storage.map.has("dsh.sessions.current")).toBe(false);
  });

  test("ca 2: KHÔNG có khoá cũ ⇒ mặc định, không ghi gì", () => {
    const storage = fakeStorage();
    const result = migratePersistKeys(storage);
    expect(result.migrated).toEqual([]);
    expect(result.removedLegacy).toEqual([]);
    expect(result.keptNew).toEqual([]);
    expect(storage.map.size).toBe(0);
  });

  test("ca 3: SAU migrate KHÔNG đọc khoá cũ nữa — khoá cũ xuất hiện lại với giá trị khác vẫn không ghi đè khoá mới", () => {
    const storage = fakeStorage([["dsh.workspace.view", '"cu-1"']]);
    migratePersistKeys(storage);
    expect(storage.map.get(WORKSPACE_VIEW_STORAGE_KEY)).toBe('"cu-1"');
    // Khoá cũ "xuất hiện lại" (vd bản cũ chạy song song) với giá trị KHÁC.
    storage.map.set("dsh.workspace.view", '"cu-2"');
    storage.reads.length = 0;
    const again = migratePersistKeys(storage);
    expect(again.migrated).toEqual([]);
    expect(again.keptNew).toContain(WORKSPACE_VIEW_STORAGE_KEY);
    expect(storage.map.get(WORKSPACE_VIEW_STORAGE_KEY)).toBe('"cu-1"');
    expect(storage.map.has("dsh.workspace.view")).toBe(false);
    // Khoá MỚI đã có ⇒ chỉ đọc để so sự tồn tại, KHÔNG dùng giá trị cũ để ghi đè.
    expect(storage.map.get(WORKSPACE_VIEW_STORAGE_KEY)).not.toBe('"cu-2"');
  });

  test("ca 4: không có localStorage ⇒ bỏ qua an toàn, không ném", () => {
    const result = migratePersistKeys(undefined);
    expect(result.skippedNoStorage).toBe(true);
    expect(result.migrated).toEqual([]);
  });

  test("ca 5: nguồn row dùng khoá MỚI, không còn literal khoá cũ trong code phát persist", () => {
    const root = join(import.meta.dir, "..", "..");
    const stores = readFileSync(join(root, "packages", "client", "ui-workspace", "src", "stores.ts"), "utf8");
    const service = readFileSync(join(root, "packages", "client", "ui-workspace", "src", "service.ts"), "utf8");
    expect(stores).toContain("WORKSPACE_VIEW_STORAGE_KEY");
    expect(service).toContain("SESSIONS_CURRENT_STORAGE_KEY");
    expect(stores).not.toContain('"dsh.workspace.view"');
    expect(service).not.toContain('"dsh.sessions.current"');
    expect(PERSIST_KEY_MIGRATIONS.map((pair) => pair.to)).toEqual([WORKSPACE_VIEW_STORAGE_KEY, SESSIONS_CURRENT_STORAGE_KEY]);
  });
});
