/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test goi ui-brand-official — mot id, hai slot nguyen van, asset GBH (khong con fish/wordmark DSH), cong idempotent
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createPlugin } from "../../packages/client/ui-brand-official/src/plugin.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-brand-official");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-brand-official";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-brand-official";
/** Id module primitives cua DSH — KHONG con duoc require trong bundle cua ta. */
const STOCK_PRIMITIVES = "@deepseek-ai/dsh-client-ui-primitives";

/** Mot phan tu gia de kiem cay jsx khong can React. */
interface FakeElement {
  /** Loai: ten the hoac component. */
  type: unknown;
  /** Thuoc tinh. */
  props: Record<string, unknown>;
}

/** Runtime jsx gia. */
const runtime = {
  jsx: (type: unknown, props: Record<string, unknown>) => ({ type, props }) as FakeElement,
  jsxs: (type: unknown, props: Record<string, unknown>) => ({ type, props }) as FakeElement,
};

/** Ghi lai slot da dang ky trong lan apply. */
interface Registered {
  /** Ten slot. */
  name: string;
  /** Component dat vao slot. */
  component: unknown;
}

/**
 * Dung mot context gia ghi lai cac slot da dang ky.
 * Nhận: khong.
 * Trả: context gia + mang slot da dang ky.
 */
function fakeContext(): { ctx: Parameters<ReturnType<typeof createPlugin>["apply"]>[0]; slots: Registered[] } {
  const slots: Registered[] = [];
  const nested: string[] = [];
  const ctx = {
    slots: {
      inject: (name: string, generator: () => unknown) => {
        nested.push(name);
        const produced = generator();
        // Cordis duyet generator de dang ky; context gia phai lam dung vay, neu khong slot khong bao gio duoc dang ky.
        const drain = (value: unknown): void => {
          const iterator = value as { next?: () => { done: boolean; value?: unknown } } | null;
          if (iterator === null || iterator === undefined || typeof iterator.next !== "function") return;
          let step = iterator.next();
          while (step.done !== true) {
            drain(step.value);
            step = iterator.next();
          }
        };
        drain(produced);
        return produced;
      },
      register: (spec: { name: string }, component: unknown) => {
        slots.push({ name: spec.name, component });
        return { dispose: () => undefined };
      },
    },
  };
  return { ctx, slots };
}

/**
 * Duyet cay phan tu gia va tra moi chuoi thuoc tinh/con.
 * Nhận: el — phan tu/chuoi/mang.
 * Trả: mang chuoi.
 */
function stringsOf(el: unknown): string[] {
  const out: string[] = [];
  const walk = (item: unknown): void => {
    if (item === null || item === undefined) return;
    if (Array.isArray(item)) {
      for (const child of item) walk(child);
      return;
    }
    const element = item as FakeElement;
    if (typeof element !== "object" || !("type" in element)) return;
    for (const value of Object.values(element.props)) if (typeof value === "string") out.push(value);
    if (typeof element.props.children === "string") out.push(element.props.children);
    walk(element.props.children);
  };
  walk(el);
  return out;
}

/**
 * Go cac component ham de con lai the DOM that (runtime gia khong tu goi component).
 * Nhận: el — phan tu co the la component ham.
 * Trả: phan tu da go (type la ten the) hoac nguyen van.
 */
function materialize(el: unknown): FakeElement {
  let current = el as FakeElement;
  let guard = 0;
  while (current !== null && current !== undefined && typeof current.type === "function" && guard < 10) {
    current = (current.type as (props: Record<string, unknown>) => unknown)(current.props) as FakeElement;
    guard += 1;
  }
  return current;
}

describe("row ui-brand-official — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    expect(ids).not.toContain(STOCK_NAME);
  });

  test("bundle KHONG con require module primitives cua DSH; chi require react/jsx-runtime", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect(code).not.toContain(STOCK_PRIMITIVES);
    const requires = [...code.matchAll(/requireFn\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(requires).toEqual(["react/jsx-runtime"]);
    // Khong con ten asset thuong hieu DSH trong artifact.
    expect(code).not.toContain("FishLogo");
    expect(code).not.toContain("BrandWordmark");
    expect(code).not.toContain("M22.9168");
  });

  test("artifact chua asset Galaxy Blackhole (logo ho den + chu thuong hieu)", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    expect(code).toContain("0 0 128 128");
    expect(code).toContain("Galaxy Blackhole");
    expect(code).toContain("#0b0a14");
  });

  test("package.json khai mot id + aliases giu id goc", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      gbh: { row: { moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
  });
});

describe("row ui-brand-official — mat plugin", () => {
  test("apply dang ky HAI slot nguyen van cua ban goc, dung khuon hai tham so", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    expect(src).toContain("sidebar.brand.mark");
    expect(src).toContain("sidebar.brand.name");
    expect(/register\(\{ name: "sidebar\.brand\.mark" \},/.test(src)).toBe(true);
    expect(/register\(\{ name: "sidebar\.brand\.name" \},/.test(src)).toBe(true);
    // Nguon moi lay asset tu goi ui-primitives cua TA, khong phai module primitives cua DSH.
    expect(src).not.toContain(STOCK_PRIMITIVES);
    expect(src).toContain("ui-primitives/src/brand.ts");
  });

  test("apply dung that: dung 2 slot, render logo ho den + chu Galaxy Blackhole", () => {
    const plugin = createPlugin((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
      if (specifier === "react/jsx-runtime") return runtime;
      throw new Error("khong duoc require " + specifier);
    });
    const { ctx, slots } = fakeContext();
    plugin.apply(ctx as never);
    expect(slots.map((slot) => slot.name)).toEqual(["sidebar.brand.mark", "sidebar.brand.name"]);
    const mark = materialize((slots[0]?.component as (props: Record<string, unknown>) => unknown)({ size: 24 }));
    expect(mark.type).toBe("svg");
    expect(mark.props.viewBox).toBe("0 0 128 128");
    const markStrings = stringsOf(mark).join(" ");
    expect(markStrings).toContain("#0b0a14");
    expect(markStrings).not.toContain("M22.9168");
    const name = materialize((slots[1]?.component as (props: Record<string, unknown>) => unknown)({}));
    expect(name.type).toBe("span");
    expect(name.props.children).toBe("Galaxy Blackhole");
  });

  test("cong chong cai hai lan: co PHAM VI MODULE, va bat SAU khi dang ky xong", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let bundleInstalled = false;");
    const flip = src.indexOf("bundleInstalled = true;");
    expect(guard).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(guard);
    expect(src.indexOf("ctx.slots.inject")).toBeLessThan(flip);
  });

  test("lan cai thu hai bi bo qua (khong dang ky lai slot)", async () => {
    // Nap lai module de co trang thai MODULE MOI: co idempotent la pham vi module, test khong duoc
    // phu thuoc thu tu chay cua test khac trong cung tien trinh.
    // @ts-expect-error — query "?case=" chỉ để bun nạp một INSTANCE MỚI của module (TS không mô hình hoá được).
    const fresh = (await import("../../packages/client/ui-brand-official/src/plugin.ts?case=second-install")) as {
      createPlugin: typeof createPlugin;
    };
    const plugin = fresh.createPlugin((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
      if (specifier === "react/jsx-runtime") return runtime;
      throw new Error("khong duoc require " + specifier);
    });
    const first = fakeContext();
    plugin.apply(first.ctx as never);
    const second = fakeContext();
    plugin.apply(second.ctx as never);
    expect(first.slots.length).toBe(2);
    expect(second.slots.length).toBe(0);
  });
});
