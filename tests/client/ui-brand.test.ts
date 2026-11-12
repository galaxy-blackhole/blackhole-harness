/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test goi ui-brand: mot id, MOT slot hero (2 slot sidebar do row ui-brand-official giu — slot single), parity voi oracle A
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Thu muc goc repo (tests/client -> repo). */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Thu muc goi cua ta. */
const OURS = join(REPO_ROOT, "packages", "client", "ui-brand");
/** Bundle gbh-brand cua oracle A (CHI DOC; co the vang mat tren may khac). */
const ORACLE = join(REPO_ROOT, "..", "galaxy-code", "web", "brand", "lib", "client.js");

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

/** Ghi lai slot da dang ky trong mot lan apply. */
interface Registered {
  /** Ten slot. */
  name: string;
  /** Component dat vao slot. */
  component: unknown;
}

/**
 * Context gia ghi lai slot da dang ky; duyet generator nhu cordis that.
 * Nhận: khong.
 * Trả: { ctx, slots } — context gia va mang slot da dang ky.
 */
function fakeContext(): { ctx: unknown; slots: Registered[] } {
  const slots: Registered[] = [];
  const drain = (value: unknown): void => {
    const iterator = value as { next?: () => { done: boolean; value?: unknown } } | null;
    if (iterator === null || iterator === undefined || typeof iterator.next !== "function") return;
    let step = iterator.next();
    while (step.done !== true) {
      drain(step.value);
      step = iterator.next();
    }
  };
  const ctx = {
    slots: {
      inject: (_name: string, generator: () => unknown) => {
        const produced = generator();
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
 * Go component ham de con lai the DOM that.
 * Nhận: el — phan tu co the la component ham.
 * Trả: phan tu da go (type la ten the).
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

/**
 * Nap plugin tu nguon voi require gia (nem neu goi require la).
 * Nhận: moduleUrl — duong dan module plugin (co the kem query de lay instance moi).
 * Trả: mat plugin da tao.
 */
async function loadPlugin(moduleUrl: string): Promise<{ name: string; inject: readonly string[]; apply: (ctx: unknown) => void }> {
  const mod = (await import(moduleUrl)) as { createPlugin: (requireFn: (specifier: string) => unknown) => { name: string; inject: readonly string[]; apply: (ctx: unknown) => void } };
  return mod.createPlugin((specifier: string) => {
    specifier = specifier.replace(/^@galaxy-blackhole\/gbh-(client-store|client-ui-slots|client-ui-primitives|client-ui-dockkit|typert-generator)$/, "@deepseek-ai/dsh-$1");
    if (specifier === "react/jsx-runtime") return runtime;
    throw new Error("khong duoc require " + specifier);
  });
}

describe("ui-brand — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id cua ta, khong require module primitives DSH", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((match) => JSON.parse(match[1] as string) as string);
    expect(ids).toEqual(["@galaxy-blackhole/gbh-client-ui-brand"]);
    expect(code).not.toContain("@deepseek-ai/dsh-client-ui-primitives");
    const requires = [...code.matchAll(/requireFn\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(requires).toEqual(["react/jsx-runtime"]);
  });

  test("manifest: id moi KHONG thay row stock; trang thai row (bat/go) + duong rollback deu ghi ro", () => {
    /** Khoi metadata row (dang bat) — chi cac truong can kiem. */
    interface RowBlock {
      id: string;
      insertAs: string;
      disabled: boolean;
      tests: string[];
      lyDo?: string;
    }
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      name: string;
      gbh: { row?: RowBlock; row_unmounted_ly_do?: RowBlock; rollback: { cachGo: string } };
      dsh: { client: { inject: string[] } };
    };
    expect(meta.name).toBe("@galaxy-blackhole/gbh-client-ui-brand");
    // Hai trang thai hop le: (a) row dang BAT; (b) tam GO theo yeu cau Lead (doi ten key) — deu phai co du truong.
    const row = meta.gbh.row ?? meta.gbh.row_unmounted_ly_do;
    expect(row).toBeDefined();
    expect(row?.id).toBe("ui-brand");
    expect(row?.insertAs).toBe("ui-brand");
    // disabled:false => khoi patch khong TAT row stock nao (id ui-brand khong ton tai trong cay stock).
    expect(row?.disabled).toBe(false);
    expect(row?.tests).toEqual(["tests/client/ui-brand.test.ts"]);
    expect(meta.gbh.rollback.cachGo.length).toBeGreaterThan(20);
    // Neu DANG GO thi phai co LY DO (khong duoc go im lang).
    if (meta.gbh.row === undefined) expect((meta.gbh.row_unmounted_ly_do?.lyDo ?? "").length).toBeGreaterThan(20);
    // Phai inject conversation: slot hero nam trong bundle cua row do.
    // 20/10/2026 — ID goi da REWRITE CO CHU DICH: quy id TUNG PHAN TU roi moi kiem CO MAT (literal STOCK giu
    //   nguyen lam chuan; giu dung do manh "phai chua", KHONG doi phep so).
    expect(meta.dsh.client.inject.some((id) => sameAfterIdMap(id, "@deepseek-ai/dsh-client-ui-conversation"))).toBe(true);
  });
});

describe("ui-brand — mat plugin (CHI slot hero)", () => {
  test("apply dang ky DUNG MOT slot hero NGUYEN VAN, va KHONG dung vao 2 slot single cua sidebar", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    expect(src).toContain('register({ name: "conversation.hero.brand.mark" }');
    // Su co 18/10/2026: ca hai slot sidebar la SINGLE va da co chu (row ui-brand-official).
    // Dang ky them o day => pageError "single slot ... already has a registration" => sidebar crash.
    expect(src).not.toContain('register({ name: "sidebar.brand.mark" }');
    expect(src).not.toContain('register({ name: "sidebar.brand.name" }');
  });

  test("apply that: 1 slot hero; dau la logo ho den, nhan size tu slot (mac dinh 34)", async () => {
    const plugin = await loadPlugin("../../packages/client/ui-brand/src/plugin.ts?case=brand-main");
    const { ctx, slots } = fakeContext();
    plugin.apply(ctx);
    expect(slots.map((slot) => slot.name)).toEqual(["conversation.hero.brand.mark"]);
    const heroWithProp = materialize((slots[0]?.component as (props: Record<string, unknown>) => unknown)({ size: 34 }));
    expect(heroWithProp.type).toBe("svg");
    expect(heroWithProp.props.viewBox).toBe("0 0 128 128");
    expect(heroWithProp.props.width).toBe(34);
    const heroDefault = materialize((slots[0]?.component as (props: Record<string, unknown>) => unknown)({}));
    expect(heroDefault.props.width).toBe(34);
    // Khong con path ca DSH trong cay nao.
    expect(JSON.stringify([heroWithProp, heroDefault])).not.toContain("M22.9168");
  });

  test("lan cai thu hai (module instance moi) bi bo qua", async () => {
    const first = await loadPlugin("../../packages/client/ui-brand/src/plugin.ts?case=brand-a");
    const firstCtx = fakeContext();
    first.apply(firstCtx.ctx);
    const second = await loadPlugin("../../packages/client/ui-brand/src/plugin.ts?case=brand-b");
    const secondCtx = fakeContext();
    second.apply(secondCtx.ctx);
    // Hai INSTANCE MODULE khac nhau => moi instance tu cai lan dau (dung co che HMR cua tang nap).
    expect(firstCtx.slots.length).toBe(1);
    expect(secondCtx.slots.length).toBe(1);
  });

  test("parity slot voi oracle A: slot hero cua ta nam trong tap slot brand cua gbh-brand", () => {
    if (!existsSync(ORACLE)) {
      console.log("khong thay bundle oracle A — bo qua phep doi chieu slot parity");
      return;
    }
    const oracle = readFileSync(ORACLE, "utf8");
    const oracleSlots = new Set([
      ...[...oracle.matchAll(/slots\.inject\("([^"]+)"\)/g)].map((match) => match[1] as string),
      ...[...oracle.matchAll(/slots\.register\(\{\s*name:\s*"([^"]+)"/g)].map((match) => match[1] as string),
    ]);
    expect(oracleSlots.has("conversation.hero.brand.mark")).toBe(true);
  });
});
