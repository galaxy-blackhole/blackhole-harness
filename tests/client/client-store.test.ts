/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Test HÀNH VI từng phần của port client-store: bốn tên export, subscribe/getSnapshot/update/set,
 *      dồn thông báo sync|raf, lưu localStorage, đóng băng ngoài production, shallowEqual một tầng,
 *      notifySubscribers không để callback hỏng chặn người khác, và defineStore (actions, scope khoá, clearPersisted).
 */

import { describe, expect, test } from "bun:test";
import {
  createSnapshotStore,
  defineStore,
  notifySubscribers,
  shallowEqual,
} from "../../packages/client/client-store/src/index.ts";

/** Kho localStorage giả để test persist mà không cần trình duyệt. */
function khoGia(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; duLieu: Map<string, string> } {
  const duLieu = new Map<string, string>();
  return {
    duLieu,
    getItem: (k) => duLieu.get(k) ?? null,
    setItem: (k, v) => { duLieu.set(k, v); },
    removeItem: (k) => { duLieu.delete(k); },
  };
}

describe("client-store — bốn tên export khớp bản gốc", () => {
  test("đủ bốn tên và đều là hàm", () => {
    expect(typeof createSnapshotStore).toBe("function");
    expect(typeof defineStore).toBe("function");
    expect(typeof notifySubscribers).toBe("function");
    expect(typeof shallowEqual).toBe("function");
  });
});

describe("client-store — createSnapshotStore", () => {
  test("getSnapshot trả trạng thái đầu", () => {
    const s = createSnapshotStore({ a: 1 });
    expect(s.getSnapshot()).toEqual({ a: 1 });
  });

  test("set thay nguyên khối và báo cho người nghe", () => {
    const s = createSnapshotStore({ a: 1 });
    const daNhan: Array<{ a: number }> = [];
    s.subscribe((v) => daNhan.push(v));
    s.set({ a: 2 });
    expect(s.getSnapshot()).toEqual({ a: 2 });
    expect(daNhan).toEqual([{ a: 2 }]);
  });

  test("update sửa bản nháp rồi báo cho người nghe", () => {
    const s = createSnapshotStore({ n: 0, ds: [] as number[] });
    const daNhan: number[] = [];
    s.subscribe((v) => daNhan.push(v.n));
    s.update((d) => { d.n = 5; d.ds.push(1); });
    expect(s.getSnapshot()).toEqual({ n: 5, ds: [1] });
    expect(daNhan).toEqual([5]);
  });

  test("huỷ đăng ký thì không nhận thông báo nữa", () => {
    const s = createSnapshotStore({ n: 0 });
    let dem = 0;
    const huy = s.subscribe(() => { dem += 1; });
    s.set({ n: 1 });
    huy();
    s.set({ n: 2 });
    expect(dem).toBe(1);
  });

  test("flush 'sync' báo NGAY trong cùng lượt gọi", () => {
    const s = createSnapshotStore({ n: 0 }, { flush: "sync" });
    let thay = -1;
    s.subscribe((v) => { thay = v.n; });
    s.set({ n: 7 });
    expect(thay).toBe(7);
  });

  test("flush 'raf' gộp nhiều lần cập nhật thành MỘT thông báo", async () => {
    const s = createSnapshotStore({ n: 0 }, { flush: "raf" });
    let dem = 0;
    s.subscribe(() => { dem += 1; });
    s.set({ n: 1 });
    s.set({ n: 2 });
    s.set({ n: 3 });
    await new Promise((ok) => setTimeout(ok, 40));
    expect(dem).toBe(1);
    expect(s.getSnapshot().n).toBe(3);
  });

  test("ngoài production thì trạng thái bị ĐÓNG BĂNG sâu", () => {
    const s = createSnapshotStore({ ds: [{ x: 1 }] });
    const anh = s.getSnapshot();
    expect(Object.isFrozen(anh)).toBe(true);
    expect(Object.isFrozen(anh.ds)).toBe(true);
    expect(Object.isFrozen(anh.ds[0])).toBe(true);
  });

  test("persist: khôi phục từ localStorage rồi ghi lại mỗi lần đổi", () => {
    const kho = khoGia();
    const goc = globalThis.localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = kho;
    try {
      kho.setItem("demo", JSON.stringify({ n: 41 }));
      const s = createSnapshotStore({ n: 0 }, { persist: { name: "demo" } });
      expect(s.getSnapshot()).toEqual({ n: 41 });
      s.set({ n: 42 });
      expect(JSON.parse(kho.getItem("demo") ?? "null")).toEqual({ n: 42 });
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = goc;
    }
  });
});

describe("client-store — shallowEqual một tầng", () => {
  test("bằng khi cùng tham chiếu hoặc cùng giá trị nông", () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
  });

  test("khác khi lệch một khoá hoặc lồng sâu", () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false);
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe("client-store — notifySubscribers", () => {
  test("một callback hỏng KHÔNG chặn người nghe còn lại", () => {
    const daGoi: number[] = [];
    const gocError = console.error;
    console.error = () => {};
    try {
      notifySubscribers<number>([() => { throw new Error("hỏng"); }, (v) => { daGoi.push(v); }], "[test]", 9);
    } finally {
      console.error = gocError;
    }
    expect(daGoi).toEqual([9]);
  });
});

describe("client-store — defineStore", () => {
  test("actions ghi qua bản nháp và người nghe thấy trạng thái mới", () => {
    const handle = defineStore({
      init: () => ({ dem: 0 }),
      actions: {
        tang(d: { dem: number }, them: number) {
          d.dem += them;
        },
      },
    });
    const inst = handle.create();
    let thay = -1;
    inst.subscribe((v) => { thay = v.dem; });
    inst.actions.tang(3);
    expect(inst.getSnapshot()).toEqual({ dem: 3 });
    expect(thay).toBe(3);
  });

  test("persist tách theo scopeKey và clearPersisted xoá đúng khoá", () => {
    const kho = khoGia();
    const goc = globalThis.localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = kho;
    try {
      const handle = defineStore({
        init: () => ({ dem: 0 }),
        persist: "dem",
        actions: { tang(d: { dem: number }) { d.dem += 1; } },
      });
      const a = handle.create("a");
      a.actions.tang();
      expect(JSON.parse(kho.getItem("dem.a") ?? "null")).toEqual({ dem: 1 });
      a.clearPersisted();
      expect(kho.getItem("dem.a")).toBe(null);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = goc;
    }
  });

  test("spec giữ nguyên khai báo gốc để nơi đăng ký đọc lại", () => {
    const decl = { init: () => ({ x: 1 }), actions: { dat(d: { x: number }, v: number) { d.x = v; } } };
    const handle = defineStore(decl);
    expect(handle.spec).toBe(decl);
  });
});
