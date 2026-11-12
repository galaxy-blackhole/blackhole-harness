/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test canh IDEMPOTENT cho 3 row hai-id: ui-settings-agent-loop, ui-settings-plugin-inventory, ui-settings-shell
 */
import { describe, expect, test } from "bun:test";

/** Mot goi can canh. */
interface Target {
  /** Ten goi (dung trong nhan log). */
  readonly pkg: string;
  /** Duong dan toi plugin.ts (them query de nap module TUOI cho tung ca). */
  readonly path: string;
}

/** Ba goi vua duoc va idempotent ngay 17/10/2026. */
const TARGETS: Target[] = [
  { pkg: "gbh-client-ui-settings-agent-loop", path: "../../packages/client/ui-settings-agent-loop/src/plugin.ts" },
  { pkg: "gbh-client-ui-settings-plugin-inventory", path: "../../packages/client/ui-settings-plugin-inventory/src/plugin.ts" },
  { pkg: "gbh-client-ui-settings-shell", path: "../../packages/client/ui-settings-shell/src/plugin.ts" },
];

/**
 * Nap module TUOI: co `installed` nam o pham vi module nen dung lai module cu se lam ca sau "pass gia".
 * @param target - goi can nap.
 * @param tag - hau to phan biet tung ca.
 * @returns module vua nap.
 */
async function freshModule(target: Target, tag: string): Promise<{ createPlugin: (requireFn: (id: string) => unknown) => { apply: (ctx: unknown) => void } }> {
  const spec: string = target.path + "?" + tag + String(Date.now());
  return (await import(spec)) as { createPlugin: (requireFn: (id: string) => unknown) => { apply: (ctx: unknown) => void } };
}

/** Require gia: tra stub dung hinh dang toi thieu de createPlugin dung duoc. */
function fakeRequire(id: string): unknown {
  if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null, Fragment: null };
  if (id === "react-dom") return { createPortal: () => null };
  return {};
}

/** Context gia: cham vao la nem, du de chung minh duong loi + tinh idempotent. */
function throwingContext(): unknown {
  return {
    get locale(): never {
      throw new Error("boom");
    },
  };
}

/**
 * Chan console.error trong mot ca.
 * @returns bo dem + ham tra lai trang thai cu.
 */
function captureErrors(): { messages: string[]; restore: () => void } {
  const messages: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]): void => {
    messages.push(args.map((arg) => String(arg)).join(" "));
  };
  return { messages, restore: () => { console.error = original; } };
}

describe("idempotent: apply chi cai MOT lan cho bundle hai id", () => {
  for (const target of TARGETS) {
    test(target.pkg + ": apply lan hai la NO-OP (khong cap lai, khong nem lai)", async () => {
      const mod = await freshModule(target, "idem");
      const capture = captureErrors();
      try {
        const plugin = mod.createPlugin(fakeRequire);
        const ctx = throwingContext();
        expect(() => plugin.apply(ctx)).toThrow();
        // Lan thu hai: co `installed` da bat => phai la NO-OP, khong nem gi.
        expect(() => plugin.apply(ctx)).not.toThrow();
      } finally {
        capture.restore();
      }
      expect(capture.messages.length).toBe(1);
    });

    test(target.pkg + ": apply nem loi => dung MOT dong console.error VA van nem tiep", async () => {
      const mod = await freshModule(target, "boom");
      const capture = captureErrors();
      let thrown: unknown;
      try {
        const plugin = mod.createPlugin(fakeRequire);
        try {
          plugin.apply(throwingContext());
        } catch (error) {
          thrown = error;
        }
      } finally {
        capture.restore();
      }
      expect(thrown).toBeInstanceOf(Error);
      expect(capture.messages.length).toBe(1);
      expect(capture.messages[0]?.includes(target.pkg)).toBe(true);
      expect(capture.messages[0]?.includes("apply nem loi")).toBe(true);
    });
  }
});
