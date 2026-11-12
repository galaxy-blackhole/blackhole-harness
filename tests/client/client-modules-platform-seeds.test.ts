/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Test bang alias SEED nen tang: mot module nen co HAI khoa id (stock cua vo SPA ↔ GBH cua ta),
 *      cong so voi tools/lib/id-normalize.ts §SEED_MODULES§ va 6 ca hanh vi cua tang nap module client
 */

import { describe, expect, test } from "bun:test";
import { ClientModuleSystem, type RegistrationTarget } from "../../packages/client/modules/src/client/system.ts";
import { PLATFORM_SEED_MODULES, seedAliasOf } from "../../packages/client/modules/src/client/platform-seeds.ts";
import { SEED_MODULES } from "../../tools/lib/id-normalize.ts";

/** Revision cố định cho mọi đồ thị dựng trong tệp này (chỉ cần ổn định). */
const REV = "0123456789ab";

/** Một dòng module của đồ thị tối giản: id + các specifier mà factory của nó require. */
interface RowSpec {
  /** Id package. */
  id: string;
  /** Specifier mà factory require lúc vạt chất hoá. */
  requires?: string[];
}

/**
 * Tách id các entry mà một URL combo bao phủ.
 * Nhận: URL dạng `plugins/??a/client.js,b/client.js&rev=…`.
 * Trả: danh sách id (rỗng khi URL không phải dạng combo).
 */
function idsOf(url: string): string[] {
  const start = url.indexOf("??");
  if (start < 0) return [];
  const rest = url.slice(start + 2);
  const stop = rest.indexOf("&rev=");
  const list = stop < 0 ? rest : rest.slice(0, stop);
  return list
    .split(",")
    .map((part) => part.split("/client.js")[0] ?? part)
    .filter((id) => id !== "");
}

/**
 * Dựng một hệ module trên đồ thị tối giản: mỗi dòng là một factory trả `{ id, got }` với `got` là
 * kết quả require của chính các specifier khai trong `requires` (đúng cách bundle thật require).
 * Nhận: `seed` — bảng module nền tảng của vỏ SPA; `rows` — các dòng của đồ thị.
 * Trả: hệ module đã sẵn sàng (chưa nạp dòng nào).
 */
function createSystem(seed: Record<string, unknown>, rows: readonly RowSpec[]): ClientModuleSystem {
  const combo = "plugins/??" + rows.map((row) => row.id + "/client.js").join(",") + "&rev=" + REV;
  const wire = {
    rev: REV,
    release: { version: "0.0.0-test" },
    entries: rows.map((row) => ({ id: row.id, url: "plugins/??" + row.id + "/client.js&rev=" + REV, rev: REV })),
    batches: [{ phase: "application", url: combo, rev: REV, entries: rows.map((row) => row.id) }],
  };
  const target: RegistrationTarget = { mode: "queue", pendingQueue: [], load: () => undefined };
  const byId = new Map(rows.map((row) => [row.id, row]));
  return new ClientModuleSystem({
    manifest: wire,
    staticModules: seed,
    registrationTarget: target,
    bootstrapModule: {
      id: "@galaxy-blackhole/gbh-client-modules",
      exports: { apply: () => undefined, createClientModuleSystem: () => undefined },
    },
    loadBundle: async (url) => {
      for (const id of idsOf(url)) {
        const row = byId.get(id);
        if (row === undefined) continue;
        target.load({
          id,
          factory: (require) => ({ id, got: (row.requires ?? []).map((spec) => require(spec)) }),
        });
      }
    },
  });
}

/** Mặt `ui-slots` giả: đủ trường để chứng minh identity của module nền (không phải nội dung thật). */
const SLOTS_FACE = { SlotCore: class {}, SlotOwnershipError: class {}, StaleAuthorizationError: class {}, standardHookPropName: (name: string) => name };

describe("09/11/2026 · bảng alias seed nền tảng — nguồn sự thật", () => {
  test("bảng dẫn xuất KHỚP ĐÚNG SEED_MODULES của tools/lib/id-normalize.ts (hai chiều, đủ bộ)", () => {
    // Cổng chống lệch: bảng build-time (SEED_MODULES) và bảng runtime (dẫn xuất theo tiền tố) phải là MỘT danh sách.
    expect([...PLATFORM_SEED_MODULES].sort()).toEqual(SEED_MODULES.map(([, ta]) => ta).sort());
    for (const [stock, ta] of SEED_MODULES) {
      expect(seedAliasOf(ta)).toBe(stock);
      expect(seedAliasOf(stock)).toBe(ta);
    }
  });

  test("seedAliasOf là bảng HAI CHIỀU cho 4 module nền, và chỉ 4 module đó", () => {
    expect(seedAliasOf("@deepseek-ai/dsh-client-ui-slots")).toBe("@galaxy-blackhole/gbh-client-ui-slots");
    expect(seedAliasOf("@galaxy-blackhole/gbh-client-ui-slots")).toBe("@deepseek-ai/dsh-client-ui-slots");
    expect(seedAliasOf("@galaxy-blackhole/gbh-client-store")).toBe("@deepseek-ai/dsh-client-store");
    expect(seedAliasOf("@galaxy-blackhole/gbh-client-ui-dockkit")).toBe("@deepseek-ai/dsh-client-ui-dockkit");
    // Kernel seam + seed của vỏ không thuộc bảng ⇒ KHÔNG nới bảng module.
    for (const other of ["react", "@deepseek-ai/cordis", "@galaxy-blackhole/gbh-client-ui-renderer", "@galaxy-blackhole/gbh-client-ui-chat"]) {
      expect(seedAliasOf(other)).toBeUndefined();
    }
  });
});

describe("09/11/2026 · require id GBH trong khi vỏ SPA chỉ cấp seed dưới id STOCK (lỗi 5439)", () => {
  test("ui-renderer require \"@galaxy-blackhole/gbh-client-ui-slots\" ⇒ nhận module nền của vỏ (id stock)", async () => {
    // ĐÂY LÀ CA TÁI HIỆN LỖI THẬT: vỏ stock cấp SZ()["@deepseek-ai/dsh-client-ui-slots"],
    // artifact của ta require id GBH, đồ thị boot không có dòng/alias nào cho id đó.
    const system = createSystem({ "@deepseek-ai/dsh-client-ui-slots": SLOTS_FACE }, [
      { id: "@galaxy-blackhole/gbh-client-ui-renderer", requires: ["@galaxy-blackhole/gbh-client-ui-slots"] },
    ]);
    const exports = (await system.import("@galaxy-blackhole/gbh-client-ui-renderer")) as { got: unknown[] };
    expect(exports.got[0]).toBe(SLOTS_FACE);
  });

  test("vỏ ĐÃ brand-rename (seed dưới id GBH) ⇒ artifact còn require id STOCK vẫn giải được", async () => {
    const system = createSystem({ "@galaxy-blackhole/gbh-client-ui-slots": SLOTS_FACE }, [
      { id: "@galaxy-blackhole/gbh-client-ui-conversation", requires: ["@deepseek-ai/dsh-client-ui-slots"] },
    ]);
    const exports = (await system.import("@galaxy-blackhole/gbh-client-ui-conversation")) as { got: unknown[] };
    expect(exports.got[0]).toBe(SLOTS_FACE);
  });

  test("package CÓ THẬT trong đồ thị thắng alias: seed stock không che bản của ta", async () => {
    const system = createSystem({ "@deepseek-ai/dsh-client-store": { stock: true } }, [
      { id: "@galaxy-blackhole/gbh-client-ui-chat", requires: ["@galaxy-blackhole/gbh-client-store"] },
      { id: "@galaxy-blackhole/gbh-client-store" },
    ]);
    const exports = (await system.import("@galaxy-blackhole/gbh-client-ui-chat")) as { got: Array<{ id: string; got: unknown[] }> };
    // Bản của TA thắng: export của factory (`{ id: "@galaxy-blackhole/gbh-client-store", got: [] }`), không phải seed stock.
    expect(exports.got[0]?.id).toBe("@galaxy-blackhole/gbh-client-store");
    expect(exports.got[0]?.got.length).toBe(0);
  });

  test("id lạ vẫn NÉM đúng thông điệp cũ — alias không nới bảng module", async () => {
    const system = createSystem({ "@deepseek-ai/dsh-client-ui-slots": SLOTS_FACE }, [
      { id: "@galaxy-blackhole/gbh-client-ui-chat", requires: ["@galaxy-blackhole/gbh-client-ui-khong-co"] },
    ]);
    await expect(system.import("@galaxy-blackhole/gbh-client-ui-chat")).rejects.toThrow(/missed the module table/u);
  });

  test("bảng seed RỖNG thì vẫn ném (alias không tự sinh module)", async () => {
    const system = createSystem({}, [
      { id: "@galaxy-blackhole/gbh-client-ui-renderer", requires: ["@galaxy-blackhole/gbh-client-ui-slots"] },
    ]);
    await expect(system.import("@galaxy-blackhole/gbh-client-ui-renderer")).rejects.toThrow(/missed the module table/u);
  });
});
