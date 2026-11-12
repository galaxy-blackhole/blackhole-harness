/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-host-account-controller: bề mặt Remote đối chứng với
 *      chính bundle gốc, uỷ quyền 9 phương thức, cầu nối watchExpiry, ca BYTE (ADR 0004 §8), đường lỗi.
 */
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import { AccountController } from "../../packages/host/account-controller/src/account-controller.ts";
import { remoteMethods } from "../../packages/host/account-controller/src/remote-surface.ts";
import {
  type AccountClientMetadata,
  type AccountProvider,
  type AccountView,
  type AgentsProvider,
  type RunningAgentLike,
  SESSION_EXPIRED_EVENT,
  isRunningAccountTask,
} from "../../packages/host/account-controller/src/types.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — dùng để đối chứng bề mặt Remote. */
const STOCK_PATH = "../../apps/host/node_modules/@deepseek-ai/dsh-api-account-controller/lib/index.js";

/**
 * Liệt kê tên export của một file ESM đã build (so bề mặt export giữa hai bản mà không cần import).
 * @param text - nội dung file build.
 * @returns tập tên export, đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Lấy iterator thật từ một AsyncIterable (đúng cách bên gọi dùng qua Symbol.asyncIterator).
 * @param iterable - luồng cần duyệt.
 * @returns iterator của luồng.
 */
function iterate<T>(iterable: AsyncIterable<T>): AsyncIterator<T> {
  return iterable[Symbol.asyncIterator]();
}

/** Danh tính UI mẫu. */
const CLIENT: AccountClientMetadata = { version: "0.1.0", locale: "vi-VN", timezoneOffsetSeconds: 25200 };

/** Bản chiếu tài khoản mẫu. */
const VIEW: AccountView = { status: "signed-out", links: { usageUrl: "https://platform/usage", topUpUrl: "https://platform/top-up" }, attempt: null };

/** Context giả: đủ cho Service constructor + hai service uỷ quyền + API event, không kéo harness vào test. */
function fakeContext(services: { account?: unknown; agents?: unknown } = {}): {
  ctx: never;
  /** Bắn một event cho mọi listener đã đăng ký. */
  emit: (name: string) => void;
  /** Số listener còn đăng ký của một event. */
  listenerCount: (name: string) => number;
} {
  const listeners = new Map<string, Set<() => void>>();
  const ctx = {
    reflect: { provide: () => () => undefined },
    // Cùng đường tra service như thật: cordis cấm đọc thuộc tính khi context chưa áp inject.
    get: (name: string) => (name === "deepseekAccount" ? services.account : name === "agents" ? services.agents : undefined),
    on: (name: string, listener: () => void) => {
      const set = listeners.get(name) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(name, set);
      return () => {
        set.delete(listener);
      };
    },
  };
  return {
    ctx: ctx as never,
    emit: (name: string) => {
      for (const listener of [...(listeners.get(name) ?? [])]) listener();
    },
    listenerCount: (name: string) => listeners.get(name)?.size ?? 0,
  };
}

/** Nhà cung cấp tài khoản giả ghi lại lời gọi để so đúng thứ tự tham số. */
function recordingProvider(): { provider: AccountProvider; calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string, args: unknown[], value: unknown): unknown => {
    calls.push({ method, args });
    return value;
  };
  const provider: AccountProvider = {
    async getState() {
      return record("getState", [], VIEW) as AccountView;
    },
    async getProfile(client) {
      return record("getProfile", [client], { status: "ready", value: { id: null, name: "Hiếu", contact: "ke***@gmail.com" } }) as never;
    },
    async getBalance(client) {
      return record("getBalance", [client], { status: "ready", value: [{ currency: "CNY", balance: "12.50" }], bonusWallets: [] }) as never;
    },
    async getUnnotifiedBonuses(client) {
      return record("getUnnotifiedBonuses", [client], null) as never;
    },
    async ackBonusNotified(accountId, orderId, client) {
      return record("ackBonusNotified", [accountId, orderId, client], true) as boolean;
    },
    async startSignIn(client, callbackOrigin, loginSource) {
      return record("startSignIn", [client, callbackOrigin, loginSource], VIEW) as AccountView;
    },
    async cancelSignIn(attemptId) {
      return record("cancelSignIn", [attemptId], VIEW) as AccountView;
    },
    async signOut(client) {
      return record("signOut", [client], VIEW) as AccountView;
    },
    watch(signal) {
      calls.push({ method: "watch", args: [signal] });
      return (async function* watcher(): AsyncIterable<AccountView> {
        yield VIEW;
      })();
    },
  };
  return { provider, calls };
}

describe("bề mặt bản gốc: inject + service key/key RPC", () => {
  test("inject đúng hai seam và namespace là account", () => {
    expect((AccountController as unknown as { inject: string[] }).inject).toEqual(["deepseekAccount", "agents"]);
    const { ctx } = fakeContext({ account: recordingProvider().provider, agents: { list: () => [] } });
    const controller = new AccountController(ctx);
    expect(controller.name).toBe("accountController");
    expect(Reflect.get(controller, "typertRemote").namespace).toBe("account");
  });

  test("export của bản build TRÙNG tập export bản gốc (AccountController + default)", async () => {
    const stock = await readFile(new URL(STOCK_PATH, import.meta.url), "utf8");
    const ours = await readFile(new URL("../../packages/host/account-controller/lib/index.js", import.meta.url), "utf8");
    expect(exportNames(ours)).toEqual(exportNames(stock));
    expect(exportNames(ours).sort()).toEqual(["AccountController", "default"]);
  });
});

describe("bề mặt Remote: đối chứng với chính bundle gốc", () => {
  test("cùng danh sách phương thức, cùng chế độ stream, cùng thứ tự", async () => {
    const stock = (await import(STOCK_PATH)) as { AccountController: new (ctx: never) => object };
    const { ctx } = fakeContext({ account: recordingProvider().provider, agents: { list: () => [] } });
    const oursMarkers = remoteMethods(new AccountController(ctx)).map((marker) => marker.method + ":" + (marker.mode ?? "direct"));
    const stockMarkers = remoteMethods(new stock.AccountController(ctx)).map((marker) => marker.method + ":" + (marker.mode ?? "direct"));
    expect(oursMarkers).toEqual(stockMarkers);
    expect(oursMarkers).toEqual([
      "getState:direct",
      "getProfile:direct",
      "getBalance:direct",
      "getUnnotifiedBonuses:direct",
      "ackBonusNotified:direct",
      "startSignIn:direct",
      "cancelSignIn:direct",
      "hasRunningAccountTasks:direct",
      "signOut:direct",
      "watchExpiry:stream",
      "watch:stream",
    ]);
  });
});

describe("uỷ quyền: cùng input → cùng output như bản gốc", () => {
  test("9 phương thức chuyển đúng thứ tự tham số và trả nguyên giá trị của nhà cung cấp", async () => {
    const { provider, calls } = recordingProvider();
    const controller = new AccountController(fakeContext({ account: provider, agents: { list: () => [] } }).ctx);
    expect(await controller.getState()).toEqual(VIEW);
    expect(await controller.getProfile(CLIENT)).toEqual({ status: "ready", value: { id: null, name: "Hiếu", contact: "ke***@gmail.com" } });
    expect(await controller.getBalance(CLIENT)).toEqual({ status: "ready", value: [{ currency: "CNY", balance: "12.50" }], bonusWallets: [] });
    expect(await controller.getUnnotifiedBonuses(CLIENT)).toBeNull();
    expect(await controller.ackBonusNotified("acc-1" as never, "ord-1" as never, CLIENT)).toBe(true);
    expect(await controller.startSignIn(CLIENT, "http://127.0.0.1:5439", "web")).toEqual(VIEW);
    expect(await controller.cancelSignIn("att-1" as never)).toEqual(VIEW);
    expect(await controller.signOut(CLIENT)).toEqual(VIEW);
    expect(calls.map((call) => call.method)).toEqual([
      "getState",
      "getProfile",
      "getBalance",
      "getUnnotifiedBonuses",
      "ackBonusNotified",
      "startSignIn",
      "cancelSignIn",
      "signOut",
    ]);
    expect(calls[4]!.args).toEqual(["acc-1", "ord-1", CLIENT]);
    expect(calls[5]!.args).toEqual([CLIENT, "http://127.0.0.1:5439", "web"]);
  });

  test("hasRunningAccountTasks: chỉ tính task đang chạy có provider deepseek-account", () => {
    const agents: AgentsProvider = {
      list: () => [
        { status: "running", session: { requestContext: () => ({ provider: "deepseek-account" }) } },
        { status: "idle", session: { requestContext: () => ({ provider: "deepseek-account" }) } },
        { status: "running", session: { requestContext: () => ({ provider: "other" }) } },
        { status: "running" },
      ],
    };
    const controller = new AccountController(fakeContext({ account: recordingProvider().provider, agents }).ctx);
    expect(controller.hasRunningAccountTasks()).toBe(true);
    const none = new AccountController(fakeContext({ account: recordingProvider().provider, agents: { list: () => [] } }).ctx);
    expect(none.hasRunningAccountTasks()).toBe(false);
  });

  test("vị từ isRunningAccountTask khớp định nghĩa gốc", () => {
    const running = (provider: string): RunningAgentLike => ({ status: "running", session: { requestContext: () => ({ provider }) } });
    expect(isRunningAccountTask(running("deepseek-account"))).toBe(true);
    expect(isRunningAccountTask(running("galaxy-cloud"))).toBe(false);
    expect(isRunningAccountTask({ status: "done", session: { requestContext: () => ({ provider: "deepseek-account" }) } })).toBe(false);
    expect(isRunningAccountTask({ status: "running" })).toBe(false);
  });
});

describe("luồng: watch uỷ quyền, watchExpiry tự dựng cầu nối event", () => {
  test("watch chuyển đúng signal cho nhà cung cấp", async () => {
    const { provider, calls } = recordingProvider();
    const controller = new AccountController(fakeContext({ account: provider, agents: { list: () => [] } }).ctx);
    const abort = new AbortController();
    const seen: AccountView[] = [];
    for await (const value of controller.watch(abort.signal)) seen.push(value);
    expect(calls.at(-1)?.method).toBe("watch");
    expect(calls.at(-1)?.args[0]).toBe(abort.signal);
    expect(seen).toEqual([VIEW]);
  });

  test("watchExpiry: nghe event sau khi đăng ký, không phát lại, kết thúc khi abort và gỡ listener", async () => {
    const context = fakeContext({ account: recordingProvider().provider, agents: { list: () => [] } });
    const controller = new AccountController(context.ctx);
    // Event phát TRƯỚC khi đăng ký không được phát lại.
    context.emit(SESSION_EXPIRED_EVENT);
    const abort = new AbortController();
    const iterator = iterate(controller.watchExpiry(abort.signal));
    // Generator async chỉ chạy thân hàm từ lần next() đầu — giống bản gốc, nên listener xuất hiện ở đó.
    const first = iterator.next();
    expect(context.listenerCount(SESSION_EXPIRED_EVENT)).toBe(1);
    context.emit(SESSION_EXPIRED_EVENT);
    expect(await first).toEqual({ value: "session-expired", done: false });
    abort.abort();
    expect(await iterator.next()).toEqual({ value: undefined, done: true });
    expect(context.listenerCount(SESSION_EXPIRED_EVENT)).toBe(0);
  });

  test("watchExpiry: event phát TRƯỚC khi đăng ký không được phát lại (không tự nhả giá trị)", async () => {
    const context = fakeContext({ account: recordingProvider().provider, agents: { list: () => [] } });
    const controller = new AccountController(context.ctx);
    context.emit(SESSION_EXPIRED_EVENT);
    const abort = new AbortController();
    const iterator = iterate(controller.watchExpiry(abort.signal));
    const pending = iterator.next();
    await new Promise((resolve) => setTimeout(resolve, 10));
    abort.abort();
    expect(await pending).toEqual({ value: undefined, done: true });
  });
});

describe("bài học ADR 0004 §8: thân phản hồi là BYTE", () => {
  test("giá trị mang byte đi qua uỷ quyền nguyên vẹn; DataView không phải Buffer nhưng là view", async () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0x6f, 0x6b, 0x22, 0x7d]); // {"ok"}
    const view = new DataView(bytes.buffer);
    const payload = { wallet: { currency: "CNY", balance: "1.00" }, raw: view };
    // Đường đi thật: nhà cung cấp trả giá trị có trường byte, row ta chuyển tiếp nguyên tham chiếu.
    const provider = {
      ...recordingProvider().provider,
      async getUnnotifiedBonuses() {
        return payload as never;
      },
    } as AccountProvider;
    const controller = new AccountController(fakeContext({ account: provider, agents: { list: () => [] } }).ctx);
    const out = (await controller.getUnnotifiedBonuses(CLIENT)) as unknown as typeof payload;
    expect(out).toBe(payload);
    expect(out.raw).toBe(view);
    expect(ArrayBuffer.isView(out.raw)).toBe(true);
    expect(Buffer.isBuffer(out.raw)).toBe(false);
    // Bẫy đã phá mọi RPC: String(view) cho ra dãy số thập phân, KHÔNG phải byte.
    expect(String(view)).not.toBe(new TextDecoder().decode(bytes));
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))).toBe('{"ok"}');
  });
});

describe("đường lỗi: rõ ràng, không treo", () => {
  test("nhà cung cấp ném lỗi thì lỗi đi thẳng ra ngoài", async () => {
    const boom = new Error("platform down");
    const provider = { ...recordingProvider().provider, async signOut() { throw boom; } } as AccountProvider;
    const controller = new AccountController(fakeContext({ account: provider, agents: { list: () => [] } }).ctx);
    await expect(controller.signOut(CLIENT)).rejects.toBe(boom);
  });

  test("thiếu seam deepseekAccount thì báo lỗi rõ ràng, không crash kiểu TypeError", async () => {
    const controller = new AccountController(fakeContext({ agents: { list: () => [] } }).ctx);
    await expect(controller.getState()).rejects.toThrow("service deepseekAccount chưa sẵn sàng");
  });
});
