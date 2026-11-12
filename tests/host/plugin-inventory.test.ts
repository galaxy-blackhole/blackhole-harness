/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hanh vi cho @galaxy-blackhole/gbh-host-plugin-inventory (dot 2, goi 1) + ca BYTE theo ADR 0004 §8.
 */
import { describe, expect, test } from "bun:test";
import { fiberPhaseOf, pluginEntryId } from "../../packages/host/plugin-inventory/src/types.ts";
import { readPluginInventory } from "../../packages/host/plugin-inventory/src/inventory.ts";
import { PluginInventoryGateway } from "../../packages/host/plugin-inventory/src/gateway.ts";

/** Context gia: seam loader + cac seam tuy chon. */
function ctxOf(services: Record<string, unknown>): never {
  return { get: (name: string) => services[name] } as never;
}

/** Mot entry Loader gia (chi khai phan ta dung). */
function entryOf(id: string, name: string, options: { group?: unknown; disabled?: boolean; state?: number; baseUrl?: string } = {}): unknown {
  return {
    id,
    options: { name, ...(options.group === undefined ? {} : { group: options.group }) },
    disabled: options.disabled === true,
    ...(options.state === undefined ? {} : { fiber: { state: options.state } }),
    parent: { tree: { ctx: { ...(options.baseUrl === undefined ? {} : { baseUrl: options.baseUrl }) } } },
  };
}

describe("types: pha fiber + id branded", () => {
  test("FiberState la enum SO (ADR: DISPOSED=4 => null), van chap nhan chuoi", () => {
    expect(fiberPhaseOf(0)).toBe("pending");
    expect(fiberPhaseOf(1)).toBe("loading");
    expect(fiberPhaseOf(2)).toBe("active");
    expect(fiberPhaseOf(3)).toBe("failed");
    expect(fiberPhaseOf(4)).toBeNull();
    expect(fiberPhaseOf(5)).toBe("unloading");
    expect(fiberPhaseOf("active")).toBe("active");
    expect(fiberPhaseOf(undefined)).toBeNull();
    expect(fiberPhaseOf({})).toBeNull();
  });

  test("pluginEntryId giu nguyen chuoi (branded)", () => {
    expect(pluginEntryId("include") as unknown as string).toBe("include");
  });
});

describe("readPluginInventory: doc cay Loader nhu upstream", () => {
  test("bo entry group, giu thu tu, enabled = !disabled, meta tu pluginPackages", async () => {
    const ctx = ctxOf({
      loader: {
        entries: () => [
          entryOf("include", "cordis:include", { state: 2, baseUrl: "file:///tmp/base/" }),
          entryOf("grp", "@deepseek-ai/dsh-group", { group: {} }),
          entryOf("off", "@deepseek-ai/dsh-off", { disabled: true, state: 0 }),
          entryOf("nofiber", "@deepseek-ai/dsh-nofiber"),
        ],
      },
      pluginPackages: { metaOf: (name: string) => (name === "cordis:include" ? { title: "Include" } : undefined) },
    });
    const snapshot = await readPluginInventory(ctx);
    expect(snapshot.entries.map((entry) => entry.moduleName)).toEqual(["cordis:include", "@deepseek-ai/dsh-off", "@deepseek-ai/dsh-nofiber"]);
    expect(snapshot.entries[0]!.fiberPhase).toBe("active");
    expect(snapshot.entries[0]!.meta).toEqual({ title: "Include" });
    expect(snapshot.entries[1]!.enabled).toBe(false);
    expect(snapshot.entries[1]!.fiberPhase).toBe("pending");
    expect(snapshot.entries[2]!.fiberPhase).toBeNull();
    expect(snapshot.managementAvailable).toBeUndefined();
    expect(snapshot.agentPresets).toBeUndefined();
  });

  test("co pluginManager thi managementAvailable = true; co agentPresets thi trai phang fiberState -> fiberPhase", async () => {
    const ctx = ctxOf({
      loader: { entries: () => [entryOf("a", "mod-a", { state: 2 })] },
      pluginManager: {},
      agentPresets: {
        compositionInventory: async () => [
          { id: "standard", isDefault: true, rows: [{ entryId: "persona", moduleName: "mod-a", enabled: true, fiberState: 2 }] },
        ],
      },
    });
    const snapshot = await readPluginInventory(ctx as never);
    expect(snapshot.managementAvailable).toBe(true);
    expect(snapshot.agentPresets?.length).toBe(1);
    const row = snapshot.agentPresets![0]!.rows[0]! as unknown as Record<string, unknown>;
    expect(row.fiberPhase).toBe("active");
    expect("fiberState" in row).toBe(false);
  });

  test("thieu seam loader => snapshot rong nhung van dung hinh dang (khong nem)", async () => {
    const snapshot = await readPluginInventory(ctxOf({}));
    expect(snapshot.entries).toEqual([]);
    expect(Object.keys(snapshot)).toContain("entries");
  });
});

describe("gateway remote", () => {
  test("dang ky serviceKey pluginInventory + inject loader + co endpoint list", () => {
    expect((PluginInventoryGateway as unknown as { inject: string[] }).inject).toEqual(["loader"]);
    expect(typeof PluginInventoryGateway.prototype.list).toBe("function");
  });
});

describe("bai hoc ADR 0004 §8: than phan hoi la BYTE", () => {
  test("snapshot di qua JSON -> Buffer -> Uint8Array roi doc lai phai nguyen byte (khong thanh day so thap phan)", () => {
    const payload = { entries: [{ entryId: "include", moduleName: "cordis:include", enabled: true, fiberPhase: "active" }], managementAvailable: true };
    const bytes = Buffer.from(JSON.stringify(payload), "utf8");
    // Duong di that cua mot response: Buffer -> view -> (tang van chuyen) -> doc lai bang toBuffer.
    const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const roundTrip = Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString("utf8");
    expect(roundTrip).toBe(bytes.toString("utf8"));
    // Ca sai lam da tung pha moi RPC: String(view) cho ra day so thap phan — phai KHONG bao gio xay ra.
    expect(String(view)).not.toBe(roundTrip);
    expect(JSON.parse(roundTrip)).toEqual(payload);
  });
});
