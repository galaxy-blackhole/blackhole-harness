/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Test row ui-session-delete — mục menu cắm đúng slot/id/order/locale, hộp xác nhận dựng ở React root
 *      tách rời (Modal + hai Button, câu cảnh báo nêu rõ không khôi phục được), và mã lỗi Remote được dịch.
 */

import { afterAll, describe, expect, test } from "bun:test";

import { createDeleteDialog, deleteErrorMessage } from "../../packages/client/ui-session-delete/src/dialog.ts";
import { NS, OCCUPANT_ID, OCCUPANT_ORDER, SLOT_SESSION_MENU_ITEM } from "../../packages/client/ui-session-delete/src/ids.ts";
import { createDeleteSessionMenuItem } from "../../packages/client/ui-session-delete/src/menu-item.ts";
import { registerSessionDeleteUi } from "../../packages/client/ui-session-delete/src/mount.ts";
import type { SessionDeleteClientCtx } from "../../packages/client/ui-session-delete/src/mount.ts";

// Hộp thoại gắn phần tử chứa vào document.body; bun test không có DOM nên cấp body giả.
// PHẢI trả lại nguyên trạng sau khi chạy: cắm document giả vào globalThis mà không dọn sẽ làm các
// suite chạy SAU thấy DOM giả (đo thật 24/10/2026: 77 ca của gói khác đỏ khi chạy cả bộ).
const fakeBody = { appendChild: (): void => undefined };
const fakeDocument = { body: fakeBody, createElement: () => ({ dataset: {}, remove: (): void => undefined }) };
const previousDocument = (globalThis as unknown as { document?: unknown }).document;
(globalThis as unknown as { document?: unknown }).document = fakeDocument;
afterAll(() => {
  if (previousDocument === undefined) delete (globalThis as unknown as { document?: unknown }).document;
  else (globalThis as unknown as { document?: unknown }).document = previousDocument;
});

/** Cây element giả do runtime test sinh ra. */
interface FakeNode {
  /** Loại element (chuỗi primitive hoặc tên thẻ). */
  readonly type: unknown;
  /** Props đã truyền. */
  readonly props: Record<string, unknown> | null;
}

/** Thu thập mọi node trong cây giả (kể cả footer là prop). */
function flatten(node: unknown, out: FakeNode[] = []): FakeNode[] {
  const value = node as FakeNode | null | undefined;
  if (value === null || value === undefined || typeof value !== "object") return out;
  out.push(value);
  for (const key of ["children", "footer"]) {
    const child = value.props?.[key];
    if (Array.isArray(child)) for (const entry of child) flatten(entry, out);
    else if (child !== undefined && child !== null) flatten(child, out);
  }
  return out;
}

/** Root giả: ghi lại cây được render gần nhất. */
const rendered: { node: unknown } = { node: null };

/** Gọi component hàm ngay (React thật làm việc này khi render); primitive thì giữ nguyên thành node. */
function makeNode(type: unknown, props: Record<string, unknown> | null): FakeNode {
  if (typeof type === "function") {
    return { type: "rendered", props: { children: (type as (p: unknown) => unknown)(props ?? {}) } };
  }
  return { type, props };
}

/** Runtime giả dùng chung cho mục menu và hộp thoại. */
const runtime = {
  react: { useState: <T,>(initial: T): [T, (next: T) => void] => [initial, () => undefined] },
  jsx: (type: unknown, props: Record<string, unknown> | null): FakeNode => makeNode(type, props),
  jsxs: (type: unknown, props: Record<string, unknown> | null): FakeNode => makeNode(type, props),
  Fragment: "Fragment",
  primitives: {
    MenuItemButton: "MenuItemButton",
    Modal: "Modal",
    Button: "Button",
    IconTrashOutlineRegular: "IconTrash",
  },
  createRoot: (): { render: (node: unknown) => void; unmount: () => void } => ({
    render: (node: unknown): void => {
      rendered.node = node;
    },
    unmount: (): void => undefined,
  }),
};

describe("ui-session-delete — mục menu và hộp xác nhận", () => {
  test("mục menu: MenuItemButton, chọn là mở hộp thoại với đúng phiên + tiêu đề", () => {
    const opened: { sessionId?: string; title?: string } = {};
    const MenuItem = createDeleteSessionMenuItem(runtime, (sessionId, title) => {
      opened.sessionId = sessionId;
      opened.title = title;
    });
    const tree = flatten(MenuItem({ sessionId: "s-1", displayTitle: "Phiên rác" }));
    expect(tree.length).toBe(1);
    expect(tree[0]?.type).toBe("MenuItemButton");
    expect(String(tree[0]?.props?.children)).toBe("Delete session");
    (tree[0]?.props?.onSelect as () => void)();
    expect(opened).toEqual({ sessionId: "s-1", title: "Phiên rác" });
  });

  test("hộp thoại: Modal + hai Button + câu cảnh báo KHÔNG khôi phục được", () => {
    const dialog = createDeleteDialog(runtime, async () => undefined);
    dialog.open("s-2", "Phiên cũ", (key) => key);
    const tree = flatten(rendered.node);
    const types = tree.map((node) => node.type);
    expect(types).toContain("Modal");
    expect(types.filter((type) => type === "Button").length).toBe(2);
    const modal = tree.find((node) => node.type === "Modal");
    expect(modal?.props?.title).toBe("dialog.title");
    expect(modal?.props?.description).toBe("dialog.desc");
    dialog.destroy();
  });

  test("bấm nút xác nhận gọi requestDelete đúng một lần với đúng sessionId", async () => {
    const asked: string[] = [];
    const dialog = createDeleteDialog(runtime, async (sessionId) => {
      asked.push(sessionId);
    });
    dialog.open("s-3", "Phiên cũ", (key) => key);
    const buttons = flatten(rendered.node).filter((node) => node.type === "Button");
    const confirm = buttons[1];
    (confirm?.props?.onClick as () => void)();
    await Promise.resolve();
    expect(asked).toEqual(["s-3"]);
    dialog.destroy();
  });

  test("deleteErrorMessage dịch ba mã lỗi quan trọng", () => {
    const t = (key: string, vars?: Readonly<Record<string, string>>): string =>
      vars === undefined ? key : key + ":" + Object.values(vars).join(",");
    expect(deleteErrorMessage({ code: "session/delete-live" }, t)).toBe("error.live");
    expect(deleteErrorMessage({ code: "session/delete-not-found" }, t)).toBe("error.notFound");
    expect(deleteErrorMessage(new Error("disk full"), t)).toBe("error.failed:disk full");
  });

  test("đăng ký: từ điển + mount Remote + đúng một occupant ở slot menu phiên", async () => {
    const calls: { locale: string[]; occupant?: Record<string, unknown>; mounted: number; names: string[]; effects: string[] } = {
      locale: [],
      mounted: 0,
      names: [],
      effects: [],
    };
    const child = {
      remote: { sessionDelete: { delete: async (): Promise<{ deleted: true; path: string }> => ({ deleted: true, path: "/tmp/x" }) } },
      sessions: { refresh: (): void => undefined },
      // 08/11/2026 (H1): seam điều hướng — hợp đồng mới của gói (inject thêm "uiWorkspace").
      uiWorkspace: {
        mainReference: undefined,
        clearMain: (): void => undefined,
      },
      slots: {
        inject: (_name: string, run: () => () => void): void => {
          run();
        },
        register: (occupant: Record<string, unknown>): (() => void) => {
          calls.occupant = occupant;
          return () => undefined;
        },
      },
    };
    const ctx = {
      effect: (run: () => () => void, label: string): void => {
        calls.effects.push(label);
        run();
      },
      locale: {
        register: (namespace: string, dictionaries: { zh: object; en: object }): (() => void) => {
          calls.locale.push(namespace, String(Object.keys(dictionaries.en).length));
          return () => undefined;
        },
      },
      remote: {
        $mount: async (): Promise<() => Promise<void>> => {
          calls.mounted += 1;
          return async () => undefined;
        },
      },
      inject: (names: string[], callback: (bound: typeof child) => unknown): Promise<unknown> => {
        calls.names = names;
        callback(child);
        return Promise.resolve(undefined) as Promise<unknown> & { dispose(): Promise<void> };
      },
    } as unknown as SessionDeleteClientCtx;
    await registerSessionDeleteUi(ctx, runtime);
    expect(calls.locale).toEqual([NS, "9"]);
    expect(calls.mounted).toBe(1);
    expect(calls.names).toEqual(["remote.sessionDelete", "slots", "sessions", "uiWorkspace"]);
    expect(calls.effects).toEqual([
      "client-ui-session-delete: dictionaries",
      "client-ui-session-delete: remote contribution",
      "client-ui-session-delete: dialog root",
    ]);
    expect(calls.occupant?.name).toBe(SLOT_SESSION_MENU_ITEM);
    expect(calls.occupant?.id).toBe(OCCUPANT_ID);
    expect(calls.occupant?.order).toBe(OCCUPANT_ORDER);
    expect(calls.occupant?.locale).toBe(NS);
  });
});
