/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test goi ui-message-feedback — luat mot-id, hai slot nguyen van, tu dien, va tang dieu khien
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MessageFeedbackController, type MessageFeedbackItem, type MessageFeedbackRemote, type Settled } from "../../packages/client/ui-message-feedback/src/controller.ts";
import { FeedbackDialogController } from "../../packages/client/ui-message-feedback/src/dialog.ts";
import { en, zh } from "../../packages/client/ui-message-feedback/src/locales.ts";
import type { SessionFeedbackRemote } from "../../packages/client/ui-message-feedback/src/surface.ts";
import { FeedbackSurface } from "../../packages/client/ui-message-feedback/src/surface.ts";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-message-feedback");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-message-feedback";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-message-feedback";
/** Duong dan bundle goc trong cay harness (chi doc). */
const STOCK_CLIENT = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-message-feedback", "lib", "client.js");

/** Mot muc phan hoi gia de kiem tang dieu khien. */
const ITEM: MessageFeedbackItem = {
  messageId: "m1",
  rating: "positive",
  note: "tot",
  category: "task-result",
  version: "v1",
  createdAt: 1,
  updatedAt: 1,
};

describe("row ui-message-feedback — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no => bundle chay hai lan => app trang.
    expect(ids).not.toContain(STOCK_NAME);
  });

  test("package.json khai mot id + aliases giu id goc", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      gbh: { row: { moduleIds: string[]; aliases: string[] } };
    };
    expect(meta.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(meta.gbh.row.aliases).toContain(STOCK_NAME);
  });
});

describe("row ui-message-feedback — mat plugin", () => {
  test("dang ky HAI slot nguyen van, id muc nguyen van, component la THAM SO THU HAI", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    // TEN SLOT phai la LITERAL: check:rows chi nhan khuon register({ name: "..." }).
    expect(/register\(\s*\{\s*name: "conversation\.chat\.assistant-actions",\s*id: "feedback",/.test(src)).toBe(true);
    expect(/register\(\s*\{\s*name: "conversation\.input\.overlay",\s*id: "feedback-dialog",/.test(src)).toBe(true);
    // Component la THAM SO THU HAI cua register(spec, Component) — khong nhet vao spec.
    expect(src).toContain("components.MessageFeedbackActions,");
    expect(src).toContain("components.FeedbackDialog,");
    // Don bay: id goc khong bao gio duoc dang ky trong bundle.
    expect(src).not.toContain("__ModuleLoader__.load");
  });

  test("cong chong cai hai lan: co PHAM VI MODULE, va bat SAU khi dang ky xong", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let bundleInstalled = false;");
    const flip = src.indexOf("bundleInstalled = true;");
    expect(guard).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(guard);
    // Bat co SAU khi applyInner chay xong: bat som ma dang ky nem giua duong thi hai slot khong bao gio
    // duoc dang ky lai => renderer gap undefined => React #130 (ca that ui-settings-general 18/10/2026).
    expect(src.indexOf("applyInner(ctx);")).toBeLessThan(flip);
    // KHONG khoa theo ctx: hai entry => hai ctx => cong khoa-theo-ctx khong bao gio kich hoat.
    expect(src).not.toContain("lastCtx");
    expect(src).not.toContain("installedContexts");
  });

  test("tu dien cua ta du MOI khoa cua ban goc (doc bundle goc lam chuan)", () => {
    const stock = readFileSync(STOCK_CLIENT, "utf8");
    const keys = Object.keys(zh);
    expect(keys.length).toBe(20);
    expect(Object.keys(en).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(stock.includes(JSON.stringify(key))).toBe(true);
    }
  });
});

describe("row ui-message-feedback — tang dieu khien", () => {
  test("hop thoai: gui thanh cong thi dong va bat toast; that bai thi giu ban nhap va bao ma", async () => {
    const ok = new FeedbackDialogController(async () => ({ ok: true }));
    ok.open({ kind: "session" });
    ok.edit({ text: "  xin chao  ", category: "other" });
    await ok.submitDraft();
    expect(ok.state.getSnapshot().target).toBeNull();
    expect(ok.state.getSnapshot().toast).toBe(1);

    let seen: unknown = null;
    const bad = new FeedbackDialogController(async (_target, entry) => {
      seen = entry;
      return { ok: false, error: { code: "note-too-large", message: "qua dai" } };
    });
    bad.open({ kind: "message", messageId: "m9", rating: "negative" });
    bad.edit({ text: "  giu lai  " });
    await bad.submitDraft();
    expect(seen).toEqual({ text: "giu lai" });
    expect(bad.state.getSnapshot().target).not.toBeNull();
    expect(bad.state.getSnapshot().failure).toBe("note-too-large");
    expect(bad.state.getSnapshot().submitting).toBe(false);
    bad.dismissFailure();
    expect(bad.state.getSnapshot().failure).toBeNull();
  });

  test("tang tin nhan: ghi theo phien ban da quan sat, rut lai khi khop, va hoa giai xung dot", async () => {
    const puts: unknown[] = [];
    const deletes: unknown[] = [];
    const conflict = { ok: false, error: { code: "version-conflict", current: { ...ITEM, rating: "negative", version: "v2" } } } as Settled<MessageFeedbackItem>;
    /** Mat Remote gia: lan put dau ghi duoc, lan put sau tra xung dot phien ban. */
    const remote: MessageFeedbackRemote = {
      list: async () => ({ ok: true, value: { ok: true, value: { items: [ITEM] } } }),
      put: async (request) => {
        puts.push(request);
        if (puts.length > 1) return { ok: true, value: conflict };
        return { ok: true, value: { ok: true, value: { ...ITEM, rating: request.rating, version: "v2" } } };
      },
      delete: async (request) => {
        deletes.push(request);
        return { ok: true, value: { ok: true, value: { absent: true } } };
      },
    };
    const controller = new MessageFeedbackController(remote, "s1");
    expect((await controller.rate("m1", "positive")).ok).toBe(true);
    // Lan dau: `rate` doc truoc (ensure) nen ifVersion la phien ban vua quan sat, khong phai null.
    expect((puts[0] as { ifVersion: unknown }).ifVersion).toBe("v1");
    expect(controller.getSnapshot().items.get("m1")?.version).toBe("v2");
    // Danh gia da doi o phien khac => lan put sau tra xung dot va anh chup nhan ban moi cua Host.
    expect((await controller.rate("m1", "negative")).ok).toBe(false);
    expect(controller.getSnapshot().items.get("m1")?.rating).toBe("negative");
    expect(controller.getSnapshot().items.get("m1")?.version).toBe("v2");
    // Rut lai chi khi danh gia dang khop.
    expect((await controller.retract("m1", "positive")).ok).toBe(true);
    expect(deletes.length).toBe(0);
    expect((await controller.retract("m1", "negative")).ok).toBe(true);
    expect((deletes[0] as { ifVersion: unknown }).ifVersion).toBe("v2");
    expect(controller.getSnapshot().items.has("m1")).toBe(false);
  });

  test("be mat: dich tin nhan di qua tang tin nhan, dich ca phien di qua mat sessionFeedback", async () => {
    const recorded: unknown[] = [];
    const messageFeedback: MessageFeedbackRemote = {
      list: async () => ({ ok: true, value: { ok: true, value: { items: [] } } }),
      put: async (request) => ({ ok: true, value: { ok: true, value: { ...ITEM, messageId: request.messageId, rating: request.rating, version: "v1" } } }),
      delete: async () => ({ ok: true, value: { ok: true, value: { absent: true } } }),
    };
    const sessionFeedback: SessionFeedbackRemote = {
      record: async (request) => {
        recorded.push(request);
        return { ok: true, value: { ok: true, value: { recorded: true } } };
      },
    };
    const surface = new FeedbackSurface(messageFeedback, sessionFeedback, "s1");
    surface.dialog.open({ kind: "message", messageId: "m2", rating: "negative" });
    await surface.dialog.submitDraft();
    expect(recorded.length).toBe(0);
    expect(surface.feedback.getSnapshot().items.get("m2")?.rating).toBe("negative");
    surface.dialog.open({ kind: "session" });
    surface.dialog.edit({ category: "product-interaction" });
    await surface.dialog.submitDraft();
    expect(recorded).toEqual([{ sessionId: "s1", category: "product-interaction" }]);
    surface.dispose();
    // Don dep: hop thoai ve trang thai dong (ban nhap va toast bi bo).
    expect(surface.dialog.state.getSnapshot().target).toBeNull();
    expect(surface.dialog.state.getSnapshot().toast).toBe(0);
  });
});

describe("row ui-message-feedback — cổng chống cài hai lần (RUNTIME, không đọc src)", () => {
  /** Require giả: jsx runtime, react, ui-primitives (chỉ cần tồn tại để dựng component). */
  function stubRequire(): (spec: string) => unknown {
    const jsx = (type: unknown, props: Record<string, unknown> | null, key?: unknown): unknown => ({ type, props: props ?? {}, key });
    return (spec: string): unknown => {
      if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (spec === "react") {
        return {
          Fragment: "Fragment",
          useState: (initial: unknown): [unknown, () => void] => [initial, () => undefined],
          useRef: (initial: unknown): { current: unknown } => ({ current: initial }),
          useEffect: (): void => undefined,
          useCallback: (fn: unknown): unknown => fn,
          useSyncExternalStore: (_subscribe: unknown, get: () => unknown): unknown => get(),
          memo: (component: unknown): unknown => component,
        };
      }
      return new Proxy({}, { get: () => "Primitive" });
    };
  }

  /** Bản ghi của context giả. */
  interface Rec {
    /** Số lần effect được gọi. */
    effects: number;
    /** Slot đã inject. */
    injected: string[];
    /** Service đã cấp. */
    provided: string[];
  }

  /**
   * Dựng context giả phía browser cho row ui-message-feedback.
   * @returns cặp { ctx, rec }.
   */
  function harness(): { ctx: Record<string, unknown>; rec: Rec } {
    const rec: Rec = { effects: 0, injected: [], provided: [] };
    const remoteStub = new Proxy({}, { get: () => (): unknown => undefined });
    const ctx: Record<string, unknown> = {
      effect: (run: () => unknown): unknown => {
        rec.effects += 1;
        return run();
      },
      locale: {
        register: (): (() => void) => () => undefined,
        bind: (): ((key: string) => string) => (key: string) => key,
      },
      remote: { messageFeedback: remoteStub, sessionFeedback: remoteStub },
      provide: (name: string): void => {
        rec.provided.push(name);
      },
      on: (): (() => void) => () => undefined,
      slots: {
        inject: (slot: string, callback: () => unknown): unknown => {
          rec.injected.push(slot);
          return callback();
        },
        register: (): (() => void) => () => undefined,
      },
      inject: (_services: readonly string[], callback: (scope: unknown) => void): void => {
        callback({
          effect: (run: () => unknown): unknown => run(),
          commandUi: { decorate: (): (() => void) => () => undefined },
        });
      },
    };
    return { ctx, rec };
  }

  /**
   * Nạp MỘT instance module mới của bundle rồi trả mặt plugin.
   * @returns mặt plugin { apply }.
   */
  function freshPlugin(): { apply(ctx: unknown): void } {
    const seen: { factory: (require: (spec: string) => unknown) => Record<string, unknown> }[] = [];
    const loader = {
      load: (registration: { factory: (require: (spec: string) => unknown) => Record<string, unknown> }): void => {
        seen.push(registration);
      },
    };
    const globals = globalThis as unknown as { __ModuleLoader__?: unknown };
    const before = globals.__ModuleLoader__;
    globals.__ModuleLoader__ = loader;
    try {
      new Function("window", readFileSync(join(OURS, "lib", "client.js"), "utf8"))({ __ModuleLoader__: loader });
    } finally {
      globals.__ModuleLoader__ = before;
    }
    const registration = seen[0];
    if (registration === undefined) throw new Error("bundle khong dang ky gi");
    return registration.factory(stubRequire()) as unknown as { apply(ctx: unknown): void };
  }

  test("lần đầu NÉM ⇒ cờ vẫn false ⇒ lần hai (ctx KHÁC) đăng ký lại ĐỦ; lần ba không đăng ký", () => {
    const plugin = freshPlugin();
    // Lần cài đầu NÉM giữa đường (đăng ký từ điển qua effect hỏng) ⇒ cờ PHẢI còn false.
    const first = harness();
    const original = (first.ctx as unknown as { locale: { register: unknown } }).locale.register;
    (first.ctx as unknown as { locale: { register: unknown } }).locale.register = () => {
      throw new Error("đăng ký từ điển hỏng giữa đường");
    };
    expect(() => plugin.apply(first.ctx)).toThrow();
    (first.ctx as unknown as { locale: { register: unknown } }).locale.register = original;
    // Lần hai (ctx KHÁC) phải đăng ký LẠI ĐỦ: hai slot + service feedbackUi.
    const second = harness();
    plugin.apply(second.ctx);
    expect(second.rec.injected).toEqual(["conversation.chat.assistant-actions", "conversation.input.overlay"]);
    expect(second.rec.provided).toEqual(["feedbackUi"]);
    expect(second.rec.effects).toBeGreaterThan(0);
    // Lần ba: cờ đã bật ⇒ KHÔNG gọi effect/inject nào.
    const third = harness();
    plugin.apply(third.ctx);
    expect(third.rec.effects).toBe(0);
    expect(third.rec.injected.length).toBe(0);
    // Module MỚI ⇒ lại đăng ký được (cờ là phạm vi module).
    const fourth = harness();
    freshPlugin().apply(fourth.ctx);
    expect(fourth.rec.injected.length).toBe(2);
  });
});
