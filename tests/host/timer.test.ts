/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-timer: mỗi ca chạy CẢ HAI bản cài (ta và chính bundle
 *      gốc @deepseek-ai/cordis-plugin-timer) trên cùng một context giả rồi so từng số đo; cộng ca tập
 *      export đo trên ARTIFACT, ca gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca C6 (vật thể cấp
 *      cho người dùng phải ĐỘC LẬP giữa hai lần cài — kiểm bằng DANH TÍNH), và ca locale 000e.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { TimerService as OurTimer } from "../../packages/host/timer/src/index.ts";
import { buildPackage } from "../../packages/host/timer/build.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(ROOT, "packages", "host", "timer");
/** Thư mục bundle GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis-plugin-timer");
/** Nửa host của row gốc: đúng tệp mà row row-timer trỏ tới. */
const STOCK = join(STOCK_DIR, "lib", "index.js");

/** Bề mặt dịch vụ mà MỌI ca dưới đây gọi tới (đúng hình dạng hai bản cài phơi ra). */
interface TimerApi {
  /** Bí danh cũ của `timeout`. */
  setTimeout(callback: () => void, delay: number): () => void;
  /** Bí danh cũ của `interval`. */
  setInterval(callback: () => void, delay: number): () => void;
  /** Hẹn một lần: có hàm gọi lại ⇒ trả hàm huỷ; chỉ có độ trễ ⇒ trả promise. */
  timeout(callback: () => void, delay: number): () => void;
  /** Hẹn một lần, dạng promise. */
  timeout(delay: number): Promise<void>;
  /** Hẹn lặp: có hàm gọi lại ⇒ trả hàm huỷ; chỉ có độ trễ ⇒ trả async iterator. */
  interval(callback: () => void, delay: number): () => void;
  /** Hẹn lặp, dạng async iterator. */
  interval(delay: number): AsyncIterableIterator<void, unknown, void>;
  /** Hàm bọc throttle kèm `.dispose`. */
  throttle(callback: (...args: unknown[]) => void, delay: number, noTrailing?: boolean): ((...args: unknown[]) => void) & { dispose: () => void };
  /** Hàm bọc debounce kèm `.dispose`. */
  debounce(callback: (...args: unknown[]) => void, delay: number): ((...args: unknown[]) => void) & { dispose: () => void };
}

/** Kiểu của một lớp plugin cài được trên context giả. */
type ServiceCtor = new (ctx: never) => TimerApi;

/** Bundle gốc nạp bằng đường dẫn tuyệt đối (CHỈ ĐỌC). */
const stock = (await import(pathToFileURL(STOCK).href)) as { TimerService: ServiceCtor; default: ServiceCtor };

/** Bản của ta, cùng hình dạng lớp. */
const ours = OurTimer as unknown as ServiceCtor;

/** Một effect đã đăng ký trên context giả. */
interface EffectRecord {
  /** Nhãn effect — đúng chuỗi mà tầng chẩn đoán của kernel in ra. */
  readonly label: string | undefined;
}

/** Một lượt `ctx.mixin()` đã ghi lại. */
interface MixinRecord {
  /** Tên dịch vụ được trộn vào. */
  readonly source: string;
  /** Danh sách khoá được trộn — MẢNG RIÊNG của mỗi lượt cài. */
  readonly keys: string[];
}

/** Context giả tối thiểu — ĐÚNG những gì hai bản cài chạm tới, KHÔNG rộng hơn. */
interface FakeContext {
  /** `Service` của cordis gọi hàm này trong constructor. */
  reflect: { provide(name: string, value: unknown): void };
  /** `ctx.effect()` — chạy thân ngay, gom hàm dọn, trả hàm huỷ. */
  effect(execute: () => (() => void) | void, label?: string): () => Promise<void>;
  /** `ctx.mixin()` — trộn thành viên của dịch vụ lên chính context. */
  mixin(source: string, keys: readonly string[]): void;
  /** Dịch vụ đã cấp + các phương thức đã trộn đều đọc được qua khoá động. */
  [key: string]: unknown;
}

/** Giàn đo của MỘT lượt cài. */
interface Harness {
  /** Context đưa cho lớp plugin. */
  readonly ctx: FakeContext;
  /** Nhật ký effect theo thứ tự đăng ký. */
  readonly effects: EffectRecord[];
  /** Các hàm huỷ theo thứ tự đăng ký (gỡ ngược như fiber cordis lúc unload). */
  readonly disposers: (() => Promise<void>)[];
  /** Nhật ký `ctx.mixin()`. */
  readonly mixins: MixinRecord[];
  /** Bản đồ dịch vụ đã cấp. */
  readonly provided: Map<string, unknown>;
}

/**
 * Dựng một giàn đo mới. `effect`/`mixin` tái hiện ĐÚNG hợp đồng mà hai bản cài dựa vào:
 * effect chạy thân ngay và trả hàm huỷ idempotent; mixin định nghĩa accessor chuyển tiếp sang dịch vụ.
 * Nhận: không.
 * Trả: harness rỗng (chưa cài lớp plugin nào).
 */
function makeHarness(): Harness {
  const effects: EffectRecord[] = [];
  const disposers: (() => Promise<void>)[] = [];
  const mixins: MixinRecord[] = [];
  const provided = new Map<string, unknown>();
  const ctx = {} as FakeContext;

  ctx.reflect = {
    provide(name: string, value: unknown): void {
      provided.set(name, value);
      ctx[name] = value;
    },
  };

  ctx.effect = (execute, label) => {
    const cleanup = execute();
    const record: EffectRecord = { label };
    effects.push(record);
    let disposed = false;
    const disposer = async (): Promise<void> => {
      if (disposed) return;
      disposed = true;
      if (typeof cleanup === "function") cleanup();
    };
    disposers.push(disposer);
    return disposer;
  };

  ctx.mixin = (source, keys) => {
    mixins.push({ source, keys: [...keys] });
    for (const key of keys) {
      Object.defineProperty(ctx, key, {
        configurable: true,
        /** Chuyển tiếp như accessor thật của cordis: lấy dịch vụ hiện tại rồi bind vào nó. */
        get(): unknown {
          const service = ctx[source] as Record<string, unknown> | null | undefined;
          if (service === null || service === undefined) return service;
          const value = service[key];
          return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(service) : value;
        },
      });
    }
  };

  return { ctx, effects, disposers, mixins, provided };
}

/** Gỡ MỌI effect của một giàn đo, theo thứ tự NGƯỢC (như fiber cordis lúc unload). */
async function disposeAll(h: Harness): Promise<void> {
  for (const disposer of [...h.disposers].reverse()) await disposer();
}

/** Chờ `ms` mili giây bằng bộ hẹn giờ CỦA TEST (không phải của dịch vụ đang đo). */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Kịch bản đo: nhận dịch vụ + giàn đo, trả DỮ LIỆU PHẲNG (số · chuỗi · mảng · boolean). */
type Scenario<T> = (api: TimerApi, h: Harness) => Promise<T>;

/**
 * Cài MỘT bản trên giàn mới rồi chạy kịch bản.
 * Nhận: lớp plugin và kịch bản đo.
 * Trả: dữ liệu phẳng do kịch bản sinh ra.
 */
async function run<T>(ctor: ServiceCtor, scenario: Scenario<T>): Promise<T> {
  const h = makeHarness();
  const api = new ctor(h.ctx as never);
  return await scenario(api, h);
}

/**
 * Chạy CẢ HAI bản cài với cùng kịch bản rồi khẳng định dữ liệu đo BẰNG NHAU.
 * Nhận: kịch bản đo.
 * Trả: cặp dữ liệu (ta, gốc) để ca test khẳng định thêm giá trị tuyệt đối.
 */
async function both<T>(scenario: Scenario<T>): Promise<{ mine: T; theirs: T }> {
  const mine = await run(ours, scenario);
  const theirs = await run(stock.TimerService, scenario);
  expect(mine).toEqual(theirs);
  return { mine, theirs };
}

/**
 * Liệt kê tên export của một file ESM đã build (dùng đúng hai regex của `check:rows`).
 * Nhận: nội dung file.
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const block of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (block[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.add(name);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

describe("bề mặt plugin: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG tập export bản gốc (đo trên lib/index.js đã build)", async () => {
    const artifact = await buildPackage(join(PKG, "lib"));
    const text = readFileSync(artifact, "utf8");
    const mine = exportNames(text);
    const theirs = exportNames(readFileSync(STOCK, "utf8"));
    expect(mine).toEqual(theirs);
    expect(mine).toEqual(["TimerService", "default"]);
    // Đo THÊM ở tầng chạy: khoá thật của module (interface/type đã bị xoá, không thành export).
    const runtime = Object.keys((await import(pathToFileURL(artifact).href)) as object).sort();
    expect(runtime).toEqual(theirs);
    // Row HOST-ONLY: bundle KHÔNG được tự khai id module nào (lệnh nghiệm thu của M6).
    expect(text.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    expect(text).not.toContain("__ModuleLoader__");
  });

  test("bề mặt prototype khớp gốc từng tên (kể cả `_schedule` nội bộ)", () => {
    const mine = Object.getOwnPropertyNames(OurTimer.prototype).sort();
    const theirs = Object.getOwnPropertyNames(stock.TimerService.prototype).sort();
    expect(mine).toEqual(theirs);
    expect(mine).toEqual(["_schedule", "constructor", "debounce", "interval", "setInterval", "setTimeout", "throttle", "timeout"]);
    expect(stock.default).toBe(stock.TimerService);
  });

  test("tên dịch vụ `timer` + danh sách phương thức trộn vào ctx khớp gốc TỪNG PHẦN TỬ", async () => {
    const measured = async (_api: TimerApi, h: Harness): Promise<{ names: string[]; mixins: MixinRecord[]; forwarded: string[] }> => ({
      names: [...h.provided.keys()],
      mixins: h.mixins,
      forwarded: ["timeout", "interval", "throttle", "debounce", "setTimeout", "setInterval"].filter((key) => typeof h.ctx[key] === "function"),
    });
    const { mine, theirs } = await both(measured);
    expect(mine).toEqual(theirs);
    expect(mine.names).toEqual(["timer"]);
    expect(mine.mixins).toEqual([{ source: "timer", keys: ["timeout", "interval", "throttle", "debounce", "setTimeout", "setInterval"] }]);
    // Cả sáu phương thức phải CHUYỂN TIẾP được qua ctx (mixins), không chỉ nằm trên dịch vụ.
    expect(mine.forwarded).toEqual(["timeout", "interval", "throttle", "debounce", "setTimeout", "setInterval"]);
  });
});

describe("hành vi: cùng kịch bản ⇒ cùng số đo như bản gốc", () => {
  test("timeout(callback): chạy ĐÚNG MỘT lần; hàm huỷ trước hạn ⇒ KHÔNG chạy", async () => {
    const scenario = async (api: TimerApi): Promise<{ fired: number; cancelled: number }> => {
      let fired = 0;
      api.timeout(() => {
        fired += 1;
      }, 10);
      await sleep(45);
      let cancelled = 0;
      const dispose = api.timeout(() => {
        cancelled += 1;
      }, 10);
      dispose();
      await sleep(45);
      return { fired, cancelled };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ fired: 1, cancelled: 0 });
  });

  test("timeout(delay): promise hoàn tất SAU delay (không bao giờ sớm hơn)", async () => {
    const delay = 20;
    const scenario = async (api: TimerApi): Promise<{ resolved: boolean; notEarly: boolean }> => {
      const t0 = Date.now();
      await api.timeout(delay);
      return { resolved: true, notEarly: Date.now() - t0 >= delay - 1 };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ resolved: true, notEarly: true });
  });

  test("đường lỗi: gỡ fiber GIỮA lúc chờ ⇒ promise TỪ CHỐI, đúng câu lỗi của gốc", async () => {
    const scenario = async (api: TimerApi, h: Harness): Promise<{ outcome: string; message: string }> => {
      const pending = api.timeout(60);
      let message = "";
      const settled = pending.then(
        () => "resolved",
        (error: Error) => {
          message = String(error.message);
          return "rejected";
        },
      );
      // Effect của lượt chờ là effect CUỐI vừa đăng ký.
      await h.disposers[h.disposers.length - 1]!();
      return { outcome: await settled, message };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ outcome: "rejected", message: "Context has been disposed" });
  });

  test("interval(callback): chạy LẶP LẠI; hàm huỷ ⇒ dừng hẳn", async () => {
    const scenario = async (api: TimerApi): Promise<{ repeated: boolean; stopped: boolean }> => {
      let ticks = 0;
      const dispose = api.interval(() => {
        ticks += 1;
      }, 5);
      await sleep(40);
      dispose();
      const atDispose = ticks;
      await sleep(25);
      return { repeated: atDispose >= 2, stopped: ticks === atDispose };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ repeated: true, stopped: true });
  });

  test("interval(delay): async iterator phát nhịp, `return()` ĐÓNG vòng và trả giá trị", async () => {
    const scenario = async (api: TimerApi): Promise<Record<string, unknown>> => {
      const iterator = api.interval(5);
      const first = await iterator.next();
      const closed = await iterator.return!("bye");
      const after = await iterator.next();
      return {
        firstDone: first.done,
        firstValue: String(first.value),
        closedDone: closed.done,
        closedValue: String(closed.value),
        afterDone: after.done,
      };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ firstDone: false, firstValue: "undefined", closedDone: true, closedValue: "bye", afterDone: true });
  });

  test("đường lỗi: iterator bị `throw()` ⇒ nhịp sau TỪ CHỐI đúng lý do đã ném", async () => {
    const scenario = async (api: TimerApi): Promise<{ closed: boolean; message: string }> => {
      const iterator = api.interval(50);
      const closed = await iterator.throw!(new Error("boom"));
      const message = await iterator.next().then(
        () => "",
        (error: Error) => String(error.message),
      );
      return { closed: closed.done === true, message };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ closed: true, message: "boom" });
  });

  test("đường lỗi: gỡ fiber GIỮA lúc iterator đang chờ ⇒ nhịp đang chờ TỪ CHỐI", async () => {
    const scenario = async (api: TimerApi, h: Harness): Promise<{ outcome: string; message: string }> => {
      const iterator = api.interval(60);
      const pending = iterator.next();
      let message = "";
      const settled = pending.then(
        () => "resolved",
        (error: Error) => {
          message = String(error.message);
          return "rejected";
        },
      );
      await h.disposers[h.disposers.length - 1]!();
      return { outcome: await settled, message };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ outcome: "rejected", message: "Context has been disposed" });
  });

  test("throttle: lượt đầu chạy NGAY, lượt trong cửa sổ dồn thành MỘT lượt cuối; `noTrailing` bỏ lượt cuối", async () => {
    const scenario = async (api: TimerApi): Promise<{ withTrailing: string[]; noTrailing: string[] }> => {
      const calls: string[] = [];
      const throttled = api.throttle((label) => calls.push(String(label)), 30);
      throttled("a");
      await sleep(5);
      throttled("b");
      await sleep(70);
      const calls2: string[] = [];
      const noTrailing = api.throttle((label) => calls2.push(String(label)), 30, true);
      noTrailing("a");
      noTrailing("b");
      await sleep(70);
      return { withTrailing: [...calls], noTrailing: [...calls2] };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ withTrailing: ["a", "b"], noTrailing: ["a"] });
  });

  test("debounce: chỉ lượt CUỐI trong cửa sổ được chạy", async () => {
    const scenario = async (api: TimerApi): Promise<string[]> => {
      const calls: string[] = [];
      const debounced = api.debounce((label) => calls.push(String(label)), 20);
      debounced("a");
      debounced("b");
      debounced("c");
      await sleep(70);
      return [...calls];
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual(["c"]);
  });

  test("bí danh cũ setTimeout/setInterval chuyển tiếp NGUYÊN VĂN (một lần · lặp lại · huỷ được)", async () => {
    const scenario = async (api: TimerApi): Promise<{ once: number; repeated: boolean; cancelled: number }> => {
      let once = 0;
      api.setTimeout(() => {
        once += 1;
      }, 5);
      let ticks = 0;
      const dispose = api.setInterval(() => {
        ticks += 1;
      }, 5);
      let cancelled = 0;
      const disposeCancelled = api.setTimeout(() => {
        cancelled += 1;
      }, 10);
      disposeCancelled();
      await sleep(45);
      dispose();
      const atDispose = ticks;
      await sleep(25);
      return { once, repeated: atDispose >= 2 && ticks === atDispose, cancelled };
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual({ once: 1, repeated: true, cancelled: 0 });
  });

  test("đường lỗi: gọi THIẾU đối số — `timeout()` hoàn tất như delay 0, `interval()` vẫn phát nhịp", async () => {
    const scenario = async (api: TimerApi): Promise<string[]> => {
      const out: string[] = [];
      // Thiếu độ trễ ⇒ setTimeout(resolve, undefined) = 0 ms, promise vẫn hoàn tất.
      await (api.timeout as (delay?: number) => Promise<void>)(undefined);
      out.push("timeout-resolved");
      const iterator = (api.interval as (delay?: number) => AsyncIterableIterator<void>)(undefined);
      const first = await iterator.next();
      out.push(first.done === false ? "tick" : "no-tick");
      await iterator.return?.(undefined);
      return out;
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual(["timeout-resolved", "tick"]);
  });

  test("sau khi fiber bị gỡ: throttle KHÔNG còn hẹn lượt cuối, debounce KHÔNG chạy (khớp gốc)", async () => {
    const scenario = async (api: TimerApi, h: Harness): Promise<{ trailingAfterDispose: number; debounceAfterDispose: number }> => {
      let trailing = 0;
      const throttled = api.throttle(() => {
        trailing += 1;
      }, 40);
      throttled();
      let debounced = 0;
      const deb = api.debounce(() => {
        debounced += 1;
      }, 40);
      deb();
      await disposeAll(h);
      await sleep(70);
      return { trailingAfterDispose: trailing, debounceAfterDispose: debounced };
    };
    const { mine } = await both(scenario);
    // Lượt ĐẦU của throttle chạy ngay (remaining = -Infinity) — đúng như bản gốc; phần DỒN thì bị bỏ.
    expect(mine).toEqual({ trailingAfterDispose: 1, debounceAfterDispose: 0 });
  });
});

describe("nhãn effect — chuỗi mà `getEffects()`/log của kernel dùng để chẩn đoán", () => {
  test("sáu nhãn khớp gốc từng chữ", async () => {
    const scenario = async (api: TimerApi, h: Harness): Promise<string[]> => {
      const noop = (): void => {};
      api.timeout(noop, 1);
      // Promise của lượt chờ sẽ bị TỪ CHỐI lúc gỡ effect ⇒ phải bắt ngay, nếu không bun coi là unhandled.
      api.timeout(1).catch(() => {});
      api.interval(noop, 1);
      const iterator = api.interval(1000);
      const throttled = api.throttle(noop, 1);
      const debounced = api.debounce(noop, 1);
      throttled.dispose();
      debounced.dispose();
      await iterator.return?.(undefined);
      const labels = h.effects.map((effect) => String(effect.label));
      await disposeAll(h);
      return labels;
    };
    const { mine } = await both(scenario);
    expect(mine).toEqual(["ctx.timeout()", "ctx.timeout()", "ctx.interval()", "ctx.interval()", "ctx.throttle()", "ctx.debounce()"]);
  });
});

describe("C6 — vật thể cấp cho người dùng ĐỘC LẬP giữa hai lần cài (kiểm bằng DANH TÍNH)", () => {
  test("hai thực thể: hàm bọc · iterator · danh sách mixin đều là vật thể RIÊNG, sửa/gỡ bên này không lan sang bên kia", async () => {
    const measure = async (ctor: ServiceCtor): Promise<Record<string, unknown>> => {
      const first = makeHarness();
      const a = new ctor(first.ctx as never);
      const second = makeHarness();
      const b = new ctor(second.ctx as never);

      const wrapperA = a.throttle(() => {}, 1000);
      const wrapperB = b.throttle(() => {}, 1000);
      (wrapperA as unknown as { extra?: number }).extra = 1;

      const iteratorA = a.interval(1000);
      const iteratorB = b.interval(1000);

      const keysA = first.mixins[0]!.keys;
      const keysB = second.mixins[0]!.keys;
      keysA.push("mutated");

      let firesA = 0;
      let firesB = 0;
      a.timeout(() => {
        firesA += 1;
      }, 15);
      b.timeout(() => {
        firesB += 1;
      }, 15);
      await disposeAll(first);
      await sleep(45);

      return {
        sameWrapper: wrapperA === wrapperB,
        leakedProperty: (wrapperB as unknown as { extra?: number }).extra ?? null,
        sameIterator: iteratorA === iteratorB,
        sameNext: iteratorA.next === iteratorB.next,
        sameKeys: keysA === keysB,
        leakedKey: keysB.includes("mutated"),
        firesA,
        firesB,
      };
    };
    const mine = await measure(ours);
    expect(mine).toEqual(await measure(stock.TimerService));
    expect(mine).toEqual({
      sameWrapper: false,
      leakedProperty: null,
      sameIterator: false,
      sameNext: false,
      sameKeys: false,
      leakedKey: false,
      firesA: 0,
      firesB: 1,
    });
  });

  test("mỗi lượt gọi trả vật thể MỚI: hai hàm huỷ · hai iterator của CÙNG một thực thể cũng khác danh tính", async () => {
    const measure = async (ctor: ServiceCtor): Promise<Record<string, unknown>> => {
      const h = makeHarness();
      const api = new ctor(h.ctx as never);
      const firstDispose = api.timeout(() => {}, 1000);
      const secondDispose = api.timeout(() => {}, 1000);
      const firstIterator = api.interval(1000);
      const secondIterator = api.interval(1000);
      const firstThrottle = api.throttle(() => {}, 1000);
      const secondThrottle = api.throttle(() => {}, 1000);
      await disposeAll(h);
      return {
        sameDispose: firstDispose === secondDispose,
        sameIterator: firstIterator === secondIterator,
        sameThrottle: firstThrottle === secondThrottle,
      };
    };
    const mine = await measure(ours);
    expect(mine).toEqual(await measure(stock.TimerService));
    expect(mine).toEqual({ sameDispose: false, sameIterator: false, sameThrottle: false });
  });
});

/** Một manifest package.json như phép kiểm M6 §1d cần. */
interface PeerManifest {
  /** Tên package. */
  name: string;
  /** Metadata của ta. */
  gbh?: { peers?: string[]; row?: unknown; draft?: string };
  /** Bản đồ subpath xuất ra của gói. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
}

/**
 * Phép kiểm luật M6 §1d: `gbh.peers` phải là TẬP CON của `peerDependencies`, so PHẦN TỬ.
 * Nhận: một manifest đọc từ package.json.
 * Trả: các tên peer nằm trong gbh.peers mà KHÔNG có trong peerDependencies (rỗng = đạt).
 */
function missingPeers(manifest: PeerManifest): string[] {
  const peers = manifest.gbh?.peers ?? [];
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return peers.filter((peer) => !declared.has(peer)).sort();
}

/** Đọc package.json của chính gói này. */
function manifest(): PeerManifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PeerManifest;
}

describe("metadata + luật gói", () => {
  test("gbh.peers ⊆ peerDependencies (so PHẦN TỬ) và mọi peer có phiên bản thật", () => {
    const json = manifest();
    expect(json.gbh?.peers).toEqual(["@deepseek-ai/cordis"]);
    expect(missingPeers(json)).toEqual([]);
    for (const peer of json.gbh?.peers ?? []) expect(typeof json.peerDependencies?.[peer]).toBe("string");
  });

  test("ĐỐI CHỨNG ÂM: thiếu tên trong peerDependencies thì phép kiểm PHẢI bắt được", () => {
    const broken: PeerManifest = {
      name: "x",
      gbh: { peers: ["@deepseek-ai/cordis", "@deepseek-ai/khong-ton-tai"] },
      peerDependencies: { "@deepseek-ai/cordis": "1" },
    };
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/khong-ton-tai"]);
    // Cùng số lượng nhưng lệch phần tử vẫn phải ĐỎ (phép kiểm so số lượng là verdict RỖNG).
    const sameCount: PeerManifest = {
      name: "y",
      gbh: { peers: ["@deepseek-ai/a", "@deepseek-ai/b"] },
      peerDependencies: { "@deepseek-ai/a": "1", "@deepseek-ai/c": "1" },
    };
    expect(missingPeers(sameCount)).toEqual(["@deepseek-ai/b"]);
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT (⊆ chứ không phải =)", () => {
    const current = manifest();
    const mutated: PeerManifest = {
      ...current,
      peerDependencies: { ...(current.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" },
    };
    expect(missingPeers(mutated)).toEqual([]);
  });

  test("luật 000e: locale/en.json + locale/zh.json CHÉP BYTE-FOR-BYTE của bản gốc", () => {
    for (const file of ["en", "zh"]) {
      const mine = readFileSync(join(PKG, "locale", file + ".json"));
      const theirs = readFileSync(join(STOCK_DIR, "locale", file + ".json"));
      expect(mine.equals(theirs)).toBe(true);
    }
    const en = JSON.parse(readFileSync(join(PKG, "locale", "en.json"), "utf8")) as { meta: { title: string } };
    const zh = JSON.parse(readFileSync(join(PKG, "locale", "zh.json"), "utf8")) as { meta: { title: string } };
    expect(en.meta.title).toBe("timer");
    expect(zh.meta.title).toBe("计时服务");
    expect(manifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
    expect(manifest().name).toBe("@galaxy-blackhole/gbh-timer");
  });

  test("row ĐÃ được Lead khai `gbh.row` — id `timer`, test của gói, KHÔNG `inject`/`config` (y row stock)", () => {
    // 18/10/2026: Lead tự kiểm ba phép tiền-mount rồi khai (commit 80214e4). Ca này THAY test canh cũ:
    // ai đổi id hoặc bỏ `tests` thì đỏ ngay — hợp đồng patch của row được máy canh, không dựa vào trí nhớ.
    expect(manifest().gbh?.row).toEqual({ id: "timer", tests: ["tests/host/timer.test.ts"] });
  });
});
