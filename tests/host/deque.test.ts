/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-deque: mô hình NGẪU NHIÊN có hạt giống chạy CÙNG chuỗi thao tác
 *      trên bản của ta, bundle gốc và một mảng tham chiếu — so từng kết quả.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Deque as OursDeque } from "../../packages/host/deque/src/index.ts";

/** Bundle gốc trong cây cài của kernel. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-deque", "lib", "index.js");

/** Bề mặt tối thiểu của deque (dùng chung cho cả hai bản). */
interface DequeLike<T> {
  readonly size: number;
  pushBack(value: T): void;
  pushFront(value: T): void;
  popFront(): T | undefined;
  clear(): void;
}

/** Bề mặt module bản gốc. */
interface StockModule {
  Deque: new <T>() => DequeLike<T>;
}

/**
 * Nạp bundle gốc như ESM thật để A/B cùng môi trường.
 * Nhận: không.
 * Trả: module bản gốc.
 */
async function stock(): Promise<StockModule> {
  return (await import(STOCK)) as StockModule;
}

/**
 * Sinh số giả ngẫu nhiên có hạt giống (mulberry32) để hai lượt chạy ra CÙNG chuỗi thao tác.
 * @param seed - hạt giống.
 * @returns hàm sinh số thực trong [0, 1).
 */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("deque — bề mặt export", () => {
  test("export đúng 1 tên như bản gốc", async () => {
    const theirs = await stock();
    expect(Object.keys(theirs)).toEqual(["Deque"]);
    expect(typeof OursDeque).toBe("function");
  });
});

describe("deque — A/B mô hình ngẫu nhiên", () => {
  test("5.000 thao tác có hạt giống: ba bên (ta · gốc · mảng tham chiếu) luôn khớp", async () => {
    const theirs = await stock();
    const next = rng(20261019);
    const ours = new OursDeque<number>();
    const stockDeque = new theirs.Deque<number>();
    const model: number[] = [];
    let value = 0;
    for (let step = 0; step < 5000; step += 1) {
      const roll = next();
      if (roll < 0.45) {
        value += 1;
        ours.pushBack(value);
        stockDeque.pushBack(value);
        model.push(value);
      } else if (roll < 0.8) {
        value += 1;
        ours.pushFront(value);
        stockDeque.pushFront(value);
        model.unshift(value);
      } else if (roll < 0.995) {
        const a = ours.popFront();
        const b = stockDeque.popFront();
        const c = model.length === 0 ? undefined : model.shift();
        expect({ step, a, b }).toEqual({ step, a: c, b: c });
      } else {
        ours.clear();
        stockDeque.clear();
        model.length = 0;
      }
      expect({ step, ours: ours.size, stock: stockDeque.size }).toEqual({ step, ours: model.length, stock: model.length });
    }
  });
});

describe("deque — biên và giải phóng bộ nhớ", () => {
  test("rỗng: popFront trả undefined, size 0", async () => {
    const theirs = await stock();
    expect(new OursDeque<number>().popFront()).toBeUndefined();
    expect(new theirs.Deque<number>().popFront()).toBeUndefined();
    expect(new OursDeque<number>().size).toBe(0);
  });

  test("đúng 16 / 17 phần tử: chèn vượt dung lượng tối thiểu vẫn đúng thứ tự", async () => {
    const theirs = await stock();
    const ours = new OursDeque<number>();
    const stockDeque = new theirs.Deque<number>();
    for (let index = 0; index < 17; index += 1) {
      ours.pushBack(index);
      stockDeque.pushBack(index);
    }
    for (let index = 0; index < 17; index += 1) {
      expect({ ours: ours.popFront(), stock: stockDeque.popFront() }).toEqual({ ours: index, stock: index });
    }
  });

  test("co bộ đệm: sau khi xoá về ≤1/4, deque vẫn đúng thứ tự và size", async () => {
    const theirs = await stock();
    const ours = new OursDeque<number>();
    const stockDeque = new theirs.Deque<number>();
    for (let index = 0; index < 256; index += 1) {
      ours.pushBack(index);
      stockDeque.pushBack(index);
    }
    for (let index = 0; index < 200; index += 1) {
      expect({ ours: ours.popFront(), stock: stockDeque.popFront() }).toEqual({ ours: index, stock: index });
    }
    expect({ ours: ours.size, stock: stockDeque.size }).toEqual({ ours: 56, stock: 56 });
    for (let index = 200; index < 256; index += 1) {
      expect({ ours: ours.popFront(), stock: stockDeque.popFront() }).toEqual({ ours: index, stock: index });
    }
  });
});
