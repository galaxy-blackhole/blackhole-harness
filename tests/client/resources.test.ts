/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-client-resources (task-16): protocol, provider, pin, source, hook
 */

import { describe, expect, test } from "bun:test";
import { ResourceRegistry, protocolOf, type ResourceContext, type ResourceFrame, type ResourceSnapshot } from "../../packages/client/resources/src/client/resources.ts";
import {
  ACCEPTED_RESOURCE_SCHEMES,
  apply,
  inject,
  isResourceAddress,
  isResourceScheme,
  resourceAddress,
  resourceAddressPattern,
  resourcePatterns,
} from "../../packages/client/resources/src/client/index.ts";
import { PACKAGE_NAME } from "../../packages/client/resources/src/ids.ts";

/** Một context giả: gom hiệu ứng để test vòng đời đăng ký provider. */
interface FakeCtx extends ResourceContext {
  /** Huỷ mọi hiệu ứng đã đăng ký (giả lập plugin bị gỡ). */
  disposeAll(): void;
}

/** Dựng context giả với bảng effect + reflect + slots. */
function fakeContext(): FakeCtx {
  const disposers: (() => void)[] = [];
  const ctx: FakeCtx = {
    effect: (callback: () => () => void, _label?: string) => {
      const dispose = callback();
      disposers.push(dispose);
      return dispose;
    },
    reflect: { provide: () => () => undefined },
    slots: { provideRoot: () => undefined },
    disposeAll: () => {
      for (const dispose of [...disposers].reverse()) dispose();
      disposers.length = 0;
    },
  };
  return ctx;
}

/** Cho microtask/luồng bất đồng bộ chạy xong vài vòng. */
async function settle(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Provider giả: phát các frame đã định rồi chờ huỷ; ghi lại signal nó nhận. */
function providerOf(frames: ResourceFrame[]) {
  const seen: { address: string; signal?: AbortSignal } = { address: "" };
  return {
    seen,
    provider: {
      protocol: "file",
      async *open(address: string, openCtx: { signal: AbortSignal }): AsyncIterable<ResourceFrame> {
        seen.address = address;
        seen.signal = openCtx.signal;
        for (const frame of frames) yield frame;
        await new Promise<void>((resolve) => openCtx.signal.addEventListener("abort", () => resolve()));
      },
    },
  };
}

describe("gbh-client-resources — mô hình resource phía browser", () => {
  test("protocolOf: địa chỉ resource (CẢ HAI scheme) có host mới nêu protocol", () => {
    expect(protocolOf("dsh-resource://file/session/s1/tmp/a.txt")).toBe("file");
    expect(protocolOf("dsh-resource://FILE/session/s1")).toBe("file");
    expect(protocolOf("gbh-resource://file/session/s1/tmp/a.txt")).toBe("file");
    expect(protocolOf("gbh-resource://FILE/session/s1")).toBe("file");
    expect(protocolOf("sidebar://guide")).toBeUndefined();
    expect(protocolOf("khong-phai-url")).toBeUndefined();
    expect(protocolOf("dsh-resource://")).toBeUndefined();
    expect(protocolOf("gbh-resource://")).toBeUndefined();
  });

  // task-29 (Wave D): luật TƯƠNG THÍCH — client phát scheme mới, nhưng NHẬN cả scheme cũ; scheme lạ bị từ chối.
  test("task-29: NHẬN cả hai scheme, TỪ CHỐI scheme lạ", () => {
    for (const scheme of ACCEPTED_RESOURCE_SCHEMES) {
      expect(protocolOf(scheme + "://file/session/s1/a.txt")).toBe("file");
      expect(isResourceAddress(scheme + "://file/x")).toBe(true);
      expect(isResourceScheme(scheme + ":")).toBe(true);
    }
    for (const bad of ["http://127.0.0.1/x", "file:///tmp/a", "gbh-la://file/x", "sidebar://guide", "dsh-resourcex://file/x", "gbh-resource:/thieu-hai-gach"]) {
      expect(protocolOf(bad)).toBeUndefined();
      expect(isResourceAddress(bad)).toBe(false);
    }
    expect(isResourceScheme("GBH-RESOURCE:")).toBe(true);
    expect(isResourceScheme("DSH-RESOURCE:")).toBe(true);
    expect(isResourceScheme("https:")).toBe(false);
  });

  test("task-29: PHÁT scheme mới — round-trip phát → nhận, pattern nhận cả hai", () => {
    const address = resourceAddress("file", "session/s1/a.txt");
    expect(address).toBe("gbh-resource://file/session/s1/a.txt");
    expect(isResourceAddress(address)).toBe(true);
    expect(protocolOf(address)).toBe("file");
    expect(resourcePatterns("plan")).toEqual(["gbh-resource://plan/**", "dsh-resource://plan/**"]);
    const review = resourceAddressPattern("plan-review", "[^/?#]+/[^/?#]+");
    expect(review.test("gbh-resource://plan-review/a/b")).toBe(true);
    expect(review.test("dsh-resource://plan-review/a/b")).toBe(true);
    expect(review.test("http://plan-review/a/b")).toBe(false);
  });

  test("chưa có provider ⇒ none; đăng ký provider ⇒ loading; có frame ⇒ live", async () => {
    const ctx = fakeContext();
    const registry = new ResourceRegistry(ctx);
    const address = "dsh-resource://file/session/s1/tmp/a.txt";
    const source = registry.source(address);
    expect(source.getSnapshot().status).toBe("none");

    const fake = providerOf([
      { ok: true, value: "v1" },
      { ok: true, value: "v2" },
    ]);
    const dispose = registry.register(fake.provider);
    expect(source.getSnapshot().status).toBe("loading");

    const unsubscribe = source.subscribe(() => undefined);
    await settle();
    expect(source.getSnapshot().status).toBe("live");
    expect(source.getSnapshot().value).toBe("v2");
    expect(fake.seen.address).toBe(address);

    unsubscribe();
    expect(source.getSnapshot().status).toBe("loading");
    expect(fake.seen.signal?.aborted).toBe(true);
    dispose();
    expect(source.getSnapshot().status).toBe("none");
  });

  test("frame lỗi ⇒ failed nhưng GIỮ giá trị cũ", async () => {
    const ctx = fakeContext();
    const registry = new ResourceRegistry(ctx);
    const source = registry.source("dsh-resource://file/session/s1/tmp/a.txt");
    const fake = providerOf([{ ok: true, value: 42 }, { ok: false, error: new Error("hong") }]);
    registry.register(fake.provider);
    source.subscribe(() => undefined);
    await settle();
    const snapshot: ResourceSnapshot = source.getSnapshot();
    expect(snapshot.status).toBe("failed");
    expect(snapshot.value).toBe(42);
    expect(String(snapshot.failure)).toContain("hong");
  });

  test("trùng protocol ⇒ ném lỗi; huỷ hiệu ứng ⇒ provider rời và trạng thái về none", async () => {
    const ctx = fakeContext();
    const registry = new ResourceRegistry(ctx);
    const fake = providerOf([]);
    registry.register(fake.provider);
    expect(() => registry.register(providerOf([]).provider)).toThrow(/already has a provider/);
    const source = registry.source("dsh-resource://file/x");
    source.subscribe(() => undefined);
    source.getSnapshot();
    ctx.disposeAll();
    expect(source.getSnapshot().status).toBe("none");
  });

  test("pin giữ resource mà KHÔNG đăng ký nghe; signal đã huỷ thì không giữ gì", async () => {
    const ctx = fakeContext();
    const registry = new ResourceRegistry(ctx);
    const fake = providerOf([{ ok: true, value: "giu" }]);
    registry.register(fake.provider);
    const address = "dsh-resource://file/pin";
    const source = registry.source(address);

    const controller = new AbortController();
    registry.pin(address, controller.signal);
    await settle();
    expect(source.getSnapshot().status).toBe("live");
    expect(source.getSnapshot().value).toBe("giu");

    controller.abort();
    expect(source.getSnapshot().status).toBe("loading");

    const aborted = new AbortController();
    aborted.abort();
    registry.pin(address, aborted.signal);
    expect(source.getSnapshot().status).toBe("loading");
  });

  test("địa chỉ không phải resource ⇒ none dù có provider trùng tên scheme khác", async () => {
    const ctx = fakeContext();
    const registry = new ResourceRegistry(ctx);
    registry.register(providerOf([{ ok: true, value: 1 }]).provider);
    const source = registry.source("sidebar://guide");
    source.subscribe(() => undefined);
    await settle();
    expect(source.getSnapshot().status).toBe("none");
  });

  test("apply: công bố service `resources` và đóng góp hook gốc `resource` đúng nguồn", () => {
    const provided: { name: string; value: unknown }[] = [];
    const roots: { keyedHooks: { resource: (address: string) => unknown } }[] = [];
    const disposers: (() => void)[] = [];
    const ctx: ResourceContext = {
      effect: (callback: () => () => void) => {
        const dispose = callback();
        disposers.push(dispose);
        return dispose;
      },
      reflect: {
        provide: (name: string, value: unknown) => {
          provided.push({ name, value });
          return () => undefined;
        },
      },
      slots: {
        provideRoot: (root: { keyedHooks: { resource: (address: string) => unknown } }) => {
          roots.push(root);
        },
      },
    };
    apply(ctx);
    expect(inject).toEqual(["slots"]);
    expect(provided.length).toBe(1);
    expect(provided[0]?.name).toBe("resources");
    const resources = provided[0]?.value as { source(address: string): unknown };
    expect(roots.length).toBe(1);
    const hook = roots[0]?.keyedHooks.resource;
    expect(hook).toBeDefined();
    expect(hook?.("dsh-resource://file/a")).toBe(resources.source("dsh-resource://file/a"));
  });

  test("id đăng ký của bundle là package CỦA TA (không cần alias: 0 row require module này)", async () => {
    const { buildPackage } = await import("../../packages/client/resources/build.ts");
    const { mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { readFileSync } = await import("node:fs");
    const out = await mkdtemp(join(tmpdir(), "gbh-resources-"));
    const built = await buildPackage(out);
    const code = readFileSync(built.client, "utf8");
    const ids = [...code.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1] ?? "");
    expect(ids).toEqual([PACKAGE_NAME]);
    const calls: { id: string; factory: (require: (spec: string) => unknown) => { apply?: unknown; inject?: string[] } }[] = [];
    new Function("window", code)({ __ModuleLoader__: { load: (registration: (typeof calls)[number]) => calls.push(registration) } });
    const moduleExports = calls[0]?.factory(() => {
      throw new Error("client-resources: khong duoc goi external o day");
    });
    expect(typeof moduleExports?.apply).toBe("function");
    expect(moduleExports?.inject).toEqual(["slots"]);
  });
});


describe("(4b) cổng apply: boolean PHẠM VI MODULE — hai ca BẮT BUỘC", () => {
  /**
   * Context giả tối thiểu: đếm số lần TẠO SERVICE (`reflect.provide`), vì gói này phơi service.
   * @returns context giả và bộ đếm số lần provide.
   */
  function stubContext(): { ctx: never; provides: () => number } {
    let provides = 0;
    const ctx = {
      reflect: {
        provide: () => {
          provides += 1;
          return () => undefined;
        },
      },
      effect: () => () => undefined,
      slots: { provideRoot: () => undefined },
      get: () => undefined,
    };
    return { ctx: ctx as never, provides: () => provides };
  }

  test("cùng một ctx gọi apply HAI lần ⇒ tạo service ĐÚNG MỘT lần", async () => {
    const spec: string = "../../packages/client/resources/src/client/index.ts?lastctx-same";
    const module_ = (await import(spec)) as { apply(ctx: unknown): void };
    const harness = stubContext();
    module_.apply(harness.ctx);
    const afterFirst = harness.provides();
    expect(afterFirst).toBe(1);
    module_.apply(harness.ctx);
    /* Lần hai trên CÙNG ctx là no-op: đó là điều kiện để không đăng ký lại service. */
    expect(harness.provides()).toBe(1);
  });

  test("cổng là boolean PHẠM VI MODULE ⇒ module TƯƠI vẫn cài được (nạp module mới mỗi ca)", async () => {
    /* LUẬT NHÓM (chốt 18/10/2026): cổng là boolean phạm vi MODULE, vì ca thật đo được là HAI ENTRY ⇒ HAI ctx
       (`loader.create` mỗi entry ⇒ `parent.extend({fiber})` ⇒ ctx MỚI) nên cổng khoá-theo-ctx KHÔNG BAO GIỜ kích
       ⇒ apply chạy hai lần ⇒ "service … has been registered". Giá phải trả: boolean rò giữa các ca test trong
       cùng file ⇒ mỗi ca phải nạp module TƯƠI (query khác nhau), đó chính là điều ca này khẳng định. */
    const spec: string = "../../packages/client/resources/src/client/index.ts?bool-fresh";
    const module_ = (await import(spec)) as { apply(ctx: unknown): void };
    const harness = stubContext();
    module_.apply(harness.ctx);
    expect(harness.provides()).toBe(1);
  });

  test("apply ném lỗi ⇒ có ĐÚNG 1 dòng console.error VÀ lỗi vẫn được ném tiếp", async () => {
    const spec: string = "../../packages/client/resources/src/client/index.ts?lastctx-throwing";
    const module_ = (await import(spec)) as { apply(ctx: unknown): void };
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      const ctx = {
        reflect: {
          provide: () => {
            throw new Error("provide no");
          },
        },
      };
      expect(() => module_.apply(ctx)).toThrow("provide no");
      expect(logged.length).toBe(1);
      expect(String(logged[0]?.[0] ?? "")).toContain("gbh-client-resources: apply nem loi");
    } finally {
      console.error = original;
    }
  });

  test("cổng chống cài hai lần: lần đầu NÉM ⇒ cờ vẫn false ⇒ lần hai đăng ký lại ĐỦ; lần ba không đăng ký", async () => {
    const spec = "../../packages/client/resources/src/client/index.ts?guard=1";
    const module_ = (await import(spec)) as { apply(ctx: unknown): void };
    // Lần cài đầu NÉM giữa đường (reflect.provide hỏng) ⇒ cờ PHẢI còn false.
    const first = fakeContext();
    (first.reflect as unknown as { provide: unknown }).provide = () => {
      throw new Error("provide hỏng giữa đường");
    };
    expect(() => module_.apply(first)).toThrow();
    // Lần hai (ctx KHÁC) phải đăng ký LẠI ĐỦ.
    const second = fakeContext();
    let secondEffects = 0;
    const secondEffect = second.effect;
    second.effect = (callback: () => () => void, label?: string): (() => void) => {
      secondEffects += 1;
      return secondEffect(callback, label);
    };
    module_.apply(second);
    expect(secondEffects).toBeGreaterThan(0);
    // Lần ba: cờ đã bật ⇒ không gọi effect nào.
    const third = fakeContext();
    let thirdEffects = 0;
    const thirdEffect = third.effect;
    third.effect = (callback: () => () => void, label?: string): (() => void) => {
      thirdEffects += 1;
      return thirdEffect(callback, label);
    };
    module_.apply(third);
    expect(thirdEffects).toBe(0);
    // Module MỚI ⇒ lại đăng ký được (cờ là phạm vi module).
    // Chuỗi tính lúc chạy: vẫn là đúng specifier `?guard=2` (buộc Bun nạp MODULE MỚI), nhưng tsc không
    // phân giải literal có query (TS2307). Không đổi hành vi — chỉ đổi cách viết để typecheck sạch.
    const freshSpecifier = "../../packages/client/resources/src/client/index.ts" + "?guard=2";
    const fresh = (await import(freshSpecifier)) as { apply(ctx: unknown): void };
    const fourth = fakeContext();
    let fourthEffects = 0;
    const fourthEffect = fourth.effect;
    fourth.effect = (callback: () => () => void, label?: string): (() => void) => {
      fourthEffects += 1;
      return fourthEffect(callback, label);
    };
    fresh.apply(fourth);
    expect(fourthEffects).toBeGreaterThan(0);
  });
});
