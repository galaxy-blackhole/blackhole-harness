/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho NỬA HOST của @galaxy-blackhole/gbh-api-remote-access: dựng HAI giàn giống hệt
 *      nhau trên Context cordis THẬT (effect + inject + logger + invocation ghi vết) rồi chạy CẢ HAI bản
 *      cài (gói của ta và bundle gốc @deepseek-ai/dsh-api-remote-access) — so quyết định, lọc danh sách,
 *      ảnh chụp quyền, dòng follow, và chèn index. Đồng thời canh "KHÔNG khai gbh.row" (gói HAI MẶT).
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/api-remote-access/build.ts";
import * as ours from "../../packages/host/api-remote-access/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "api-remote-access");
/** Phép kiểm CHUẨN cho dải peer của row (parity với manifest stock + phủ bản kernel đang chạy). */
import { peerRangeProblems } from "./peer-range-harness.ts";
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-remote-access");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Manifest Remote của gói gốc (dùng làm bằng chứng gói HAI MẶT). */
const STOCK_TYPERT = join(STOCK_PKG, "lib", "typert.host.js");

/** Context cordis THẬT. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };
/** typert-protocol của kernel: đọc marker Remote của một Service đang sống. */
const { remoteMethods } = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js"))) as {
  remoteMethods(service: unknown): unknown;
};

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as {
  REMOTE_ACCESS_SNAPSHOT_KEY: string;
  RemoteAccessService: new (ctx: unknown) => unknown;
  default: new (ctx: unknown) => unknown;
};
/** Bản của ta nhìn qua cùng hình dạng. */
const mine = ours as unknown as typeof stock;

/** Một quyết định (allow, hoặc deny kèm lý do). */
type Decision = { kind: "allow" } | { kind: "deny"; reason: string };
/** Một quyền trong ảnh chụp. */
type Grant = { resource: Resource; actions: readonly string[] };
/** Một khung của dòng follow. */
type Frame =
  | { type: "baseline"; owner: true }
  | { type: "baseline"; owner: false; grants: readonly Grant[] }
  | { type: "upsert"; grant: Grant }
  | { type: "remove"; resource: Resource };
/** Một tài nguyên. */
type Resource = { readonly kind: "global" } | { readonly kind: string; readonly id: string };

/** Hình dạng service mà test dùng (kind principal tự do ⇒ mở kiểu động cho dễ đọc). */
interface LooseService {
  /** Đăng ký chính sách cho MỘT loại principal. */
  registerPolicy(kind: string, policy: unknown): () => void;
  /** Báo trạng thái truy cập đã đổi. */
  invalidate(principal?: unknown): void;
  /** Quyết định MỘT yêu cầu. */
  decide(request: unknown): Decision;
  /** Lọc MỘT mục theo lời gọi Remote đang phục vụ. */
  allows(resource: Resource): boolean;
  /** Baseline mở đầu của một trang. */
  snapshotFor(principal: unknown): { type: "baseline"; owner: boolean; grants?: readonly Grant[] };
  /** Dòng ảnh chụp quyền của Peer đang gọi. */
  follow(signal: AbortSignal): AsyncIterable<Frame>;
}

/** Bảng chèn index giả do webserver đưa vào listener. */
interface Entry {
  /** Loại dòng chèn. */
  kind: string;
  /** Tên thuộc tính globalThis. */
  name: string;
  /** Giá trị gán. */
  value: unknown;
}

/** Giàn đo của MỘT bên cài. */
interface Rig {
  /** Context cordis THẬT đã đắp seam. */
  ctx: unknown;
  /** Service đã dựng. */
  service: LooseService;
  /** Callback dọn đăng ký trên context (theo nhãn). */
  effects: { label?: string; dispose: () => void }[];
  /** Các lần tiêm phụ thuộc (deps + callback). */
  injected: { deps: string[]; run(ctx: unknown): void }[];
  /** Log đã ghi (mỗi lần là mảng tham số). */
  logs: unknown[][];
  /** Lời gọi Remote đang phục vụ (đặt được). */
  invocation: unknown;
  /** Gọi listener chèn index đã đăng ký và trả bảng kết quả. */
  injectIndex(): Entry[];
}

/**
 * Dựng giàn đo với lớp CỤ THỂ của một bên cài (tách khỏi `makeRig` để đọc rõ ý đồ).
 * Nhận: lớp gói.
 * Trả: giàn đo.
 */
function makeRig(plugin: typeof stock): Rig {
  const effects: Rig["effects"] = [];
  const injected: Rig["injected"] = [];
  const logs: unknown[][] = [];
  const listeners: ((table: Entry[]) => void)[] = [];
  const state: { invocation: unknown } = { invocation: undefined };
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "effect") {
        return (callback: () => () => void, label?: string) => {
          const dispose = callback();
          effects.push({ label, dispose });
          return () => {
            dispose();
          };
        };
      }
      if (prop === "inject") {
        return (deps: string[], callback: (child: unknown) => void) => {
          injected.push({ deps, run: callback });
          const child = {
            on(_event: string, listener: (table: Entry[]) => void) {
              listeners.push(listener);
              return () => undefined;
            },
          };
          callback(child);
          return () => undefined;
        };
      }
      if (prop === "logger") {
        return {
          warn(...args: unknown[]) {
            logs.push(args);
          },
        };
      }
      if (prop === "invocation") return state.invocation;
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  const service = new plugin.RemoteAccessService(ctx) as unknown as LooseService;
  return {
    ctx,
    service,
    effects,
    injected,
    logs,
    get invocation(): unknown {
      return state.invocation;
    },
    set invocation(value: unknown) {
      state.invocation = value;
    },
    injectIndex(): Entry[] {
      const table: Entry[] = [];
      for (const listener of listeners) listener(table);
      return table;
    },
  };
}

/** Principal CHỦ. */
const OWNER_PRINCIPAL = Object.freeze({ kind: "owner" });
/** Principal của một Peer (loại tự khai trong test). */
const PEER = Object.freeze({ kind: "peer", id: "peer-1" });
/** Tài nguyên `global`. */
const GLOBAL: Resource = Object.freeze({ kind: "global" });
/** Tài nguyên một phiên. */
const SESSION: Resource = Object.freeze({ kind: "session", id: "s-1" });
/** Tài nguyên một phiên khác. */
const OTHER: Resource = Object.freeze({ kind: "session", id: "s-2" });

/**
 * Lời gọi Remote giả cho một Peer (principalOf đọc `invocation.peer.principal`).
 * Nhận: principal của Peer, namespace, method.
 * Trả: đối tượng invocation.
 */
function invocationOf(principal: unknown, namespace = "session", method = "list"): unknown {
  return {
    request: { namespace, method, args: {} },
    service: "session",
    peer: { id: "peer-1", principal },
    signal: new AbortController().signal,
  };
}

/** Vai mẫu: cho phép hai hành động trên tài nguyên phiên. */
const ROLE = Object.freeze({
  name: "reader",
  resource: "session",
  actions: Object.freeze(["session/list", "session/get"]),
});

/** Đơn vị principal cho test. */
interface PrincipalLike {
  /** Loại principal. */
  kind: string;
  /** Id (tuỳ chọn). */
  id?: string;
}

/** Lấy principal dưới dạng chữ ký của service. */
function asPrincipal(value: PrincipalLike): never {
  return value as never;
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
 * Nhận: văn bản artifact.
 * Trả: danh sách tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Hình dạng package.json của gói ta mà test đọc. */
interface PkgJson {
  /** Tên package. */
  name: string;
  /** Metadata gbh (KHÔNG có row). */
  gbh?: { row?: unknown; peers?: string[]; tests?: string[]; draft?: string };
  /** Peer khai báo. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thật (phải RỖNG). */
  dependencies?: Record<string, string>;
}

/**
 * Đọc package.json của gói ta.
 * Nhận: không.
 * Trả: nội dung đã parse.
 */
function pkgJson(): PkgJson {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PkgJson;
}

/**
 * Lấy khung kế tiếp của một dòng follow, có trần thời gian để test không treo.
 * Nhận: iterator và trần mili giây.
 * Trả: khung, hoặc undefined khi hết dòng hoặc quá hạn.
 */
async function nextFrame(iter: AsyncIterator<Frame>, ms = 500): Promise<Frame | undefined> {
  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms));
  const next = iter.next().then((result) => (result.done === true ? undefined : result.value));
  return await Promise.race([next, timeout]);
}

/**
 * Chính sách giả ghi lại số lần gọi (để chứng minh "bindings() gọi MỘT lần mỗi quyết định").
 * Nhận: hàm sinh ràng buộc và (tuỳ chọn) hàm explain.
 * Trả: chính sách + bộ đếm.
 */
function policyOf(
  bindings: () => readonly unknown[],
  explain?: (request: unknown) => string | undefined | never,
): { policy: unknown; calls: { bindings: number; explain: number } } {
  const calls = { bindings: 0, explain: 0 };
  const policy = {
    bindings() {
      calls.bindings += 1;
      return bindings();
    },
    explain(request: unknown) {
      calls.explain += 1;
      return explain === undefined ? undefined : explain(request);
    },
  };
  if (explain === undefined) delete (policy as { explain?: unknown }).explain;
  return { policy, calls };
}


/** Id row thật của gói trong dump oracle (KHÔNG phải tên thư mục). */
const ROW_ID = "remote-access";

describe("bề mặt gói + dựng service", () => {
  test("tập export của ta BẰNG bản gốc (hằng khoá · lớp · default) — đo trên ARTIFACT", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-ara-")));
    const oursText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["REMOTE_ACCESS_SNAPSHOT_KEY", "RemoteAccessService", "default"]);
    // typert-protocol nạp LÚC CHẠY (marker + principalOf); cordis chỉ mượn KIỂU.
    // 06/11/2026 (P1b): gói này CHƯA chuyển artefact ⇒ cả hai vế vẫn dùng id stock.
    expect(oursText.includes('from "@deepseek-ai/dsh-typert-protocol"')).toBe(true);
    expect(stockText.includes('from "@deepseek-ai/dsh-typert-protocol"')).toBe(true);
    expect(oursText.includes('from "@deepseek-ai/cordis"')).toBe(false);
    // 20/10/2026 (brand rename lô cuối): artefact CỦA TA nay đổi cả nửa host sang __GBH_* (sai lệch CÓ CHỦ ĐÍCH,
    // cổng byte của gói quy tên trước khi so) ⇒ KHÔNG so trực tiếp với stock nữa, mà khẳng định đúng cặp tên.
    expect(mine.REMOTE_ACCESS_SNAPSHOT_KEY).toBe("__GBH_REMOTE_ACCESS__");
    expect(stock.REMOTE_ACCESS_SNAPSHOT_KEY).toBe("__DSH_REMOTE_ACCESS__");
    // 19/10/2026: CHỈ `lib/client.js` được đổi brand (payload UI); nửa host giữ nguyên __DSH_* như stock.
    expect(mine.REMOTE_ACCESS_SNAPSHOT_KEY).toBe("__GBH_REMOTE_ACCESS__");
    expect(mine.default).toBe(mine.RemoteAccessService);
  });

  test("dựng service: tiêm webServer + chèn baseline vào chỉ mục + hiệu ứng vòng đời — TRÙNG bản gốc", () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      traces.push({ deps: rig.injected.map((entry) => entry.deps), table: rig.injectIndex(), labels: rig.effects.map((entry) => entry.label) });
    }
    // 20/10/2026 (lô brand cuối): nửa host của ta mang `__GBH_REMOTE_ACCESS__`, stock mang `__DSH_...` ⇒
    // so SAU KHI đảo tên ở cả hai vế (đối xứng) — chứng minh chỉ khác TÊN brand, không khác hành vi.
    const chuanHoa = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value).split("__GBH_REMOTE_ACCESS__").join("__DSH_REMOTE_ACCESS__"));
    expect(chuanHoa(traces[0])).toEqual(chuanHoa(traces[1]));
    expect(traces[0]).toEqual({
      deps: [["webServer"]],
      // Doc tu ARTEFACT thay vi hard-code: rename brand (task-146) doi ten global, test khong duoc chet theo.
      table: [{ kind: "global", name: String(ours.REMOTE_ACCESS_SNAPSHOT_KEY), value: { type: "baseline", owner: true } }],
      labels: ["remoteAccess: snapshot generations"],
    });
  });

  test("marker Remote của bản ta BẰNG bản gốc (follow là stream)", () => {
    const ourMarkers = remoteMethods(makeRig(mine).service) as { method: string; mode?: string }[];
    const stockMarkers = remoteMethods(makeRig(stock).service) as { method: string; mode?: string }[];
    expect(ourMarkers).toEqual(stockMarkers);
    expect(ourMarkers.length).toBe(1);
    expect(ourMarkers[0]?.method).toBe("follow");
    expect(ourMarkers[0]?.mode).toBe("stream");
  });
});

describe("registerPolicy · invalidate · allows", () => {
  test("đăng ký hai lần CÙNG loại ⇒ ném CÙNG thông điệp; hàm dọn gỡ chính sách", () => {
    const traces: { error: string; afterDispose: boolean; beforeDispose: boolean }[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      const { policy } = policyOf(() => [{ role: ROLE, resource: SESSION }]);
      const dispose = rig.service.registerPolicy("peer", policy);
      rig.invocation = invocationOf(PEER, "session", "list");
      const beforeDispose = rig.service.allows(SESSION);
      let error = "KHONG NEM";
      try {
        rig.service.registerPolicy("peer", policy);
      } catch (caught) {
        error = (caught as Error).message;
      }
      dispose();
      traces.push({ error, afterDispose: rig.service.allows(SESSION), beforeDispose });
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      error: 'remote access: principal kind "peer" already has a policy',
      afterDispose: false,
      beforeDispose: true,
    });
  });

  test("allows(): ngoài lời gọi Remote và với CHỦ ⇒ true; Peer ⇒ theo chính sách", () => {
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      rig.service.registerPolicy("peer", policyOf(() => [{ role: ROLE, resource: SESSION }]).policy);
      // Ngoài lời gọi Remote.
      expect(rig.service.allows(OTHER)).toBe(true);
      // Lời gọi của CHỦ ⇒ principalOf trả undefined ⇒ true.
      rig.invocation = invocationOf(OWNER_PRINCIPAL, "session", "list");
      expect(rig.service.allows(OTHER)).toBe(true);
      // Lời gọi của Peer: hành động session/list có trên SESSION, KHÔNG trên OTHER.
      rig.invocation = invocationOf(PEER, "session", "list");
      expect(rig.service.allows(SESSION)).toBe(true);
      expect(rig.service.allows(OTHER)).toBe(false);
      // Hành động không có trong vai ⇒ false; loại principal không có chính sách ⇒ false.
      rig.invocation = invocationOf(PEER, "session", "kill");
      expect(rig.service.allows(SESSION)).toBe(false);
      rig.invocation = invocationOf({ kind: "stranger" }, "session", "list");
      expect(rig.service.allows(SESSION)).toBe(false);
    }
  });
});

describe("decide() — đối chứng từng nhánh", () => {
  test("CHỦ và remoteAccess/follow luôn allow; loại principal lạ ⇒ no-allow", () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      traces.push([
        rig.service.decide({ principal: OWNER_PRINCIPAL, action: "session/list", resources: [SESSION] }),
        rig.service.decide({ principal: PEER, action: "remoteAccess/follow", resources: [GLOBAL] }),
        rig.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] }),
      ]);
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      { kind: "allow" },
      { kind: "allow" },
      { kind: "deny", reason: "no-allow" },
    ]);
  });

  test("ràng buộc cho phép · vai thiếu hành động · MỌI tài nguyên phải cho phép", () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      rig.service.registerPolicy("peer", policyOf(() => [{ role: ROLE, resource: SESSION }]).policy);
      traces.push([
        rig.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] }),
        rig.service.decide({ principal: PEER, action: "session/kill", resources: [SESSION] }),
        rig.service.decide({ principal: PEER, action: "session/list", resources: [SESSION, OTHER] }),
        rig.service.decide({ principal: PEER, action: "session/list", resources: [GLOBAL] }),
      ]);
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      { kind: "allow" },
      { kind: "deny", reason: "no-allow" },
      { kind: "deny", reason: "no-allow" },
      { kind: "deny", reason: "no-allow" },
    ]);
  });

  test("điều kiện: nhận ĐÚNG args · từ chối kèm lý do · ném ⇒ policy-failed ghi log MỘT lần", () => {
    const seen: unknown[] = [];
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      const condition = (request: { action: string; resource: unknown; args?: Readonly<Record<string, unknown>> }) => {
        seen.push({ action: request.action, resource: request.resource, args: request.args });
        if (request.args === undefined) return { kind: "allow" as const };
        if (request.args["mode"] === "read") return { kind: "allow" as const };
        return { kind: "deny" as const, reason: "mode-not-allowed" };
      };
      rig.service.registerPolicy("peer", policyOf(() => [{ role: ROLE, resource: SESSION, condition }]).policy);
      const allowArgs = rig.service.decide({
        principal: PEER,
        action: "session/list",
        resources: [SESSION],
        args: { mode: "read" },
      });
      const denyArgs = rig.service.decide({
        principal: PEER,
        action: "session/list",
        resources: [SESSION],
        args: { mode: "write" },
      });
      // Điều kiện NÉM: policy-failed + đúng MỘT cặp log; lần sau IM LẶNG cho tới invalidate().
      const throwing = policyOf(() => [
        { role: ROLE, resource: SESSION, condition: () => { throw new Error("boom"); } },
      ]);
      const rig2 = makeRig(plugin);
      rig2.service.registerPolicy("peer", throwing.policy);
      const first = rig2.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] });
      const second = rig2.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] });
      const logsBefore = rig2.logs.length;
      rig2.service.invalidate();
      const third = rig2.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] });
      traces.push({ allowArgs, denyArgs, first, second, third, logsBefore, logsAfter: rig2.logs.length });
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      allowArgs: { kind: "allow" },
      denyArgs: { kind: "deny", reason: "mode-not-allowed" },
      first: { kind: "deny", reason: "policy-failed" },
      second: { kind: "deny", reason: "policy-failed" },
      third: { kind: "deny", reason: "policy-failed" },
      logsBefore: 2,
      logsAfter: 4,
    });
    // Điều kiện nhận ĐÚNG args của lời gọi (và args vắng khi lọc danh sách).
    expect(seen[0]).toEqual({ action: "session/list", resource: SESSION, args: { mode: "read" } });
  });

  test("bindings() ném ⇒ policy-failed; explain() được dùng khi từ chối; explain ném ⇒ policy-failed", () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      rig.service.registerPolicy("peer", policyOf(() => { throw new Error("bindings-boom"); }).policy);
      const failed = rig.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] });
      const explained = (() => {
        const inner = makeRig(plugin);
        const policy = policyOf(() => [], () => "you-own-nothing");
        inner.service.registerPolicy("peer", policy.policy);
        return inner.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] });
      })();
      const throwingExplain = (() => {
        const inner = makeRig(plugin);
        const policy = policyOf(() => [], () => { throw new Error("explain-boom"); });
        inner.service.registerPolicy("peer", policy.policy);
        return inner.service.decide({ principal: PEER, action: "session/list", resources: [SESSION] });
      })();
      const calls = (() => {
        const inner = makeRig(plugin);
        const policy = policyOf(() => [{ role: ROLE, resource: SESSION }]);
        inner.service.registerPolicy("peer", policy.policy);
        inner.service.decide({ principal: PEER, action: "session/list", resources: [SESSION, OTHER] });
        return policy.calls.bindings;
      })();
      traces.push({ failed, explained, throwingExplain, calls });
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      failed: { kind: "deny", reason: "policy-failed" },
      explained: { kind: "deny", reason: "you-own-nothing" },
      throwingExplain: { kind: "deny", reason: "policy-failed" },
      calls: 1,
    });
  });
});

describe("snapshotFor() + follow()", () => {
  test("snapshotFor: CHỦ ⇒ baseline chủ; Peer ⇒ quyền đã sắp xếp, BỎ hành động event:, gộp tài nguyên trùng", () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      const role = Object.freeze({
        name: "mixed",
        resource: "session",
        actions: Object.freeze(["session/rename", "session/list", "event:session-changed"]),
      });
      const conditional = Object.freeze({
        name: "later",
        resource: "session",
        actions: Object.freeze(["session/kill"]),
      });
      rig.service.registerPolicy(
        "peer",
        policyOf(() => [
          { role, resource: SESSION },
          { role, resource: SESSION },
          { role: conditional, resource: OTHER, condition: () => ({ kind: "deny", reason: "never" }) },
        ]).policy,
      );
      traces.push([rig.service.snapshotFor(OWNER_PRINCIPAL), rig.service.snapshotFor(PEER)]);
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual([
      { type: "baseline", owner: true },
      {
        type: "baseline",
        owner: false,
        grants: [{ resource: SESSION, actions: ["session/list", "session/rename"] }],
      },
    ]);
  });

  test("follow của CHỦ: ĐÚNG MỘT baseline rồi giữ mở tới khi huỷ", async () => {
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      rig.invocation = invocationOf(OWNER_PRINCIPAL, "remoteAccess", "follow");
      const controller = new AbortController();
      const iter = rig.service.follow(controller.signal)[Symbol.asyncIterator]();
      expect(await nextFrame(iter)).toEqual({ type: "baseline", owner: true });
      // Không có khung thứ hai dù có invalidate().
      rig.service.invalidate();
      expect(await nextFrame(iter, 120)).toBe(undefined);
      controller.abort();
      expect(await iter.next()).toEqual({ done: true, value: undefined });
    }
  });

  test("follow của Peer: baseline, rồi upsert khi quyền đổi, rồi remove khi mất quyền", async () => {
    const traces: unknown[] = [];
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      let grants: unknown[] = [];
      rig.service.registerPolicy("peer", policyOf(() => grants).policy);
      rig.invocation = invocationOf(PEER, "remoteAccess", "follow");
      const controller = new AbortController();
      const iter = rig.service.follow(controller.signal)[Symbol.asyncIterator]();
      const baseline = await nextFrame(iter);
      grants = [{ role: ROLE, resource: SESSION }];
      rig.service.invalidate();
      const upsert = await nextFrame(iter);
      grants = [];
      rig.service.invalidate();
      const remove = await nextFrame(iter);
      controller.abort();
      await iter.next();
      traces.push({ baseline, upsert, remove });
    }
    // 19/10/2026 (brand rename lo 3): artefact cua ta mang __GBH_* => dao ten truoc khi so voi stock.
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      baseline: { type: "baseline", owner: false, grants: [] },
      upsert: { type: "upsert", grant: { resource: SESSION, actions: ["session/get", "session/list"] } },
      remove: { type: "remove", resource: SESSION },
    });
  });

  test("follow kết thúc khi service unload (hiệu ứng vòng đời huỷ lifetime)", async () => {
    for (const plugin of [mine, stock]) {
      const rig = makeRig(plugin);
      rig.invocation = invocationOf(PEER, "remoteAccess", "follow");
      const controller = new AbortController();
      const iter = rig.service.follow(controller.signal)[Symbol.asyncIterator]();
      expect(await nextFrame(iter)).toEqual({ type: "baseline", owner: false, grants: [] });
      rig.effects.find((entry) => entry.label === "remoteAccess: snapshot generations")?.dispose();
      expect(await iter.next()).toEqual({ done: true, value: undefined });
    }
  });
});

describe("quy ước repo — HAI MẶT đã port đủ 4 artefact, KHÔNG khai gbh.row", () => {
  test("không gbh.row + bằng chứng DƯƠNG gói HAI MẶT + không trùng tên service", () => {
    const json = pkgJson();
    // 19/10/2026 — BẤT BIẾN MỚI (thay 'KHÔNG khai gbh.row' đã stale sau khi row được khai/mount, như agent-loop đã làm):
    // row PHẢI được khai ở ĐÚNG MỘT trong hai khoá (flip ⇒ `gbh.row`; chưa flip ⇒ `gbh.row_unmounted_ly_do`),
    // có `id` + `tests`, và TUYỆT ĐỐI KHÔNG khai đồng thời cả hai (khai cả hai ⇒ patch mâu thuẫn, mount không xác định).
    const gbh = json.gbh as
      | { row?: { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] }; row_unmounted_ly_do?: { row?: { id?: string } } }
      | undefined;
    const daFlip = gbh?.row !== undefined;
    const dangPark = gbh?.row_unmounted_ly_do !== undefined;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    expect(gbh?.row?.id ?? gbh?.row_unmounted_ly_do?.row?.id).toBe(ROW_ID);
    // 19/10/2026 — CẬP NHẬT theo trạng thái mới (de-bundle 4 artefact): draft nay mô tả gói HAI MẶT, không còn "NỬA HOST".
    expect((json.gbh?.draft ?? "").includes("4 artefact")).toBe(true);
    // 19/10/2026 — gói đã de-bundle 4 artefact nên có THÊM bộ test A/B halves; gbh.tests liệt kê cả hai.
    expect(json.gbh?.tests).toEqual(["tests/host/api-remote-access.test.ts", "tests/host/api-remote-access-halves.test.ts"]);
    // Đối chứng DƯƠNG: bản gốc THẬT SỰ có nửa client + manifest remote.
    expect(existsSync(join(STOCK_PKG, "lib", "client.js"))).toBe(true);
    expect(existsSync(join(STOCK_PKG, "lib", "typert.remote-client.js"))).toBe(true);
    expect(existsSync(STOCK_TYPERT)).toBe(true);
    const stockPkg = JSON.parse(readFileSync(join(STOCK_PKG, "package.json"), "utf8")) as {
      dsh?: { client?: { inject?: string[]; platform?: string } };
    };
    expect(stockPkg.dsh?.client?.platform).toBe("web");
    expect(stockPkg.dsh?.client?.inject).toContain("@deepseek-ai/dsh-api-gateway");
    // 19/10/2026 — nay gói xuất ĐỦ 7 mục như bản gốc (có ./client, ./typert, ./remote), không còn chỉ nửa host.
    const ourPkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { exports: Record<string, unknown> };
    expect(Object.keys(ourPkg.exports).sort()).toEqual([".", "./client", "./package.json", "./remote", "./src/*", "./typert", "./types"]);
    // Không package GBH nào khác cấp service remoteAccess (kiểm trùng tên TRƯỚC khi viết).
    const others = readFileSync(join(REPO, "packages", "host", "api-job-controller", "package.json"), "utf8");
    expect(others.includes("remoteAccess")).toBe(false);
  });

  test("gbh.peers ⊆ peerDependencies, dependencies RỖNG", () => {
    const json = pkgJson();
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    // 01/11/2026 — đồng bộ manifest theo stock: danh sách chọn lọc nay có thêm `@deepseek-ai/cordis` (mọi row
    // đều tiêu thụ cordis), nên kỳ vọng "chỉ MỘT tên" là CŨ. Giữ TẬP CON bắt buộc + phép kiểm dải CHUẨN.
    expect(declared).toEqual(expect.arrayContaining(["@deepseek-ai/cordis", "@deepseek-ai/dsh-typert-protocol"]));
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(peerRangeProblems(PKG)).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
  });
});