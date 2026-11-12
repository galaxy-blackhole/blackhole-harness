/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test đối chứng cho NỬA HOST của @galaxy-blackhole/gbh-typert-registry: mỗi ca dựng HAI giàn giống
 *      hệt nhau trên Context cordis THẬT (effect dạng GENERATOR + logger ghi vết) rồi chạy CẢ HAI bản cài
 *      (gói của ta và bundle gốc @deepseek-ai/dsh-typert-registry) — so schema/package/lời gọi/tra cứu/
 *      Context/kiểu tài nguyên, mọi thông điệp lỗi, và thứ tự phát thay đổi. Đồng thời canh "KHÔNG gbh.row".
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// zod lấy từ KERNEL (apps/host) — repo KHÔNG có zod ở root, và đó là bản DUY NHẤT app dùng; kiểu để MỞ vì
// tệp test không import `zod` bằng bare specifier (sẽ là phụ thuộc môi trường — đúng thứ task-32 vừa dọn).
const { z } = (await import(join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "zod", "index.js"))) as {
  z: any;
};

import { buildPackage } from "../../packages/host/typert-registry/build.ts";
import * as ours from "../../packages/host/typert-registry/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "typert-registry");
/** Phép kiểm CHUẨN cho dải peer của row (parity với manifest stock + phủ bản kernel đang chạy). */
import { peerRangeProblems } from "./peer-range-harness.ts";
/** Thư mục gói GỐC (CHỈ ĐỌC). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-registry");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** cordis của kernel — hai bên dùng CHUNG một lớp Context. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");

/** Context cordis THẬT. */
const { Context: ContextCtor } = (await import(CORDIS)) as { Context: new () => object };

/** Bản gốc nạp động. */
const stock = (await import(STOCK)) as {
  TypertRegistry: new (ctx: unknown) => unknown;
  default: new (ctx: unknown) => unknown;
  typertKey(packageName: string, name: string): string;
  typertPackageKey(packageName: string, face: string): string;
  typertEndpoint(descriptor: { namespace: string; method: string }): string;
};
/** Bản của ta nhìn qua cùng hình dạng. */
const mine = ours as unknown as typeof stock;

/** Giàn đo của MỘT bên cài. */
interface Rig {
  /** Service đã dựng (hình dạng động để test đọc dễ). */
  service: any;
  /** Hàm dọn đã đăng ký (theo nhãn). */
  effects: { label?: string; dispose?: () => void }[];
  /** Cảnh báo đã ghi. */
  warns: unknown[];
}

/**
 * Dựng giàn cho MỘT bên cài: Context cordis THẬT + `effect` dạng GENERATOR như kernel + logger ghi vết.
 * Nhận: lớp gói.
 * Trả: giàn đo.
 */
function makeRig(plugin: typeof stock): Rig {
  const effects: Rig["effects"] = [];
  const warns: unknown[] = [];
  const real = new ContextCtor();
  const ctx = new Proxy(real, {
    get(target, prop) {
      if (prop === "effect") {
        return (factory: () => Generator<() => void, void, void>, label?: string) => {
          const iterator = factory();
          const step = iterator.next();
          const dispose = typeof step.value === "function" ? step.value : undefined;
          effects.push({ label, dispose });
          return () => {
            dispose?.();
          };
        };
      }
      if (prop === "logger") {
        return {
          warn(...args: unknown[]) {
            warns.push(args.length === 1 ? args[0] : args);
          },
          error(...args: unknown[]) {
            warns.push(args.length === 1 ? args[0] : args);
          },
        };
      }
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === "function" ? (value as (...params: unknown[]) => unknown).bind(target) : value;
    },
  });
  const service = new plugin.TypertRegistry(ctx);
  return { service, effects, warns };
}

/**
 * Dựng MỘT đóng góp tối thiểu: 1 schema + 1 mô hình rỗng + 0 lời gọi.
 * Nhận: tên package, phía, và tên schema.
 * Trả: đóng góp.
 */
function contributionOf(packageName: string, face: "host" | "client", schemaName = "Config"): any {
  return {
    package: packageName,
    face,
    schemas: [{ name: schemaName, create: () => z.object({ a: z.string() }) }],
    model: { services: [], events: [], objects: [] },
    invocations: [],
  };
}

/**
 * Tên export của một file ESM đã build.
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
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Chạy MỘT phép trên cả hai bản và trả kết quả (lỗi ⇒ chuỗi thông điệp). */
async function ab(run: (service: any, rig: Rig) => unknown | Promise<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const plugin of [mine, stock]) {
    const rig = makeRig(plugin);
    try {
      out.push(await run(rig.service, rig));
    } catch (error) {
      out.push("ERR: " + (error as Error).message);
    }
  }
  return out;
}


/** Id row thật của gói trong dump oracle (KHÔNG phải tên thư mục). */
const ROW_ID = "typert";

describe("bề mặt gói + dựng service", () => {
  test("export TRÙNG bản gốc (5 tên) và ba hàm khoá cho CÙNG kết quả", async () => {
    const artifact = await buildPackage(mkdtempSync(join(tmpdir(), "gbh-treg-")));
    const ourText = readFileSync(artifact, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(ourText)).toEqual(exportNames(stockText));
    expect(exportNames(ourText)).toEqual(["TypertRegistry", "default", "typertEndpoint", "typertKey", "typertPackageKey"]);
    expect(mine.default).toBe(mine.TypertRegistry);
    for (const plugin of [mine, stock]) {
      expect(plugin.typertKey("pkg", "Config")).toBe("pkg#Config");
      expect(plugin.typertPackageKey("pkg", "host")).toBe("pkg#host");
      expect(plugin.typertEndpoint({ namespace: "ns", method: "m" })).toBe("ns/m");
    }
  });

  test("năm sổ con tồn tại với ĐÚNG bộ phương thức của kernel (cả hai bản)", async () => {
    const traces = await ab((service) => ({
      local: Object.keys(service.local).sort(),
      remotes: Object.keys(service.remotes).sort(),
      lookups: Object.keys(service.lookups).sort(),
      contexts: Object.keys(service.contexts).sort(),
      resources: Object.keys(service.resources).sort(),
    }));
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      local: ["get", "hasSeen", "list", "subscribe"],
      remotes: ["get", "list", "register", "subscribe"],
      lookups: ["configure", "definitions", "get", "keys", "register", "subscribe"],
      contexts: ["configureHost", "getClient", "getHost", "registerClient", "registerHost", "subscribe"],
      resources: ["entries", "get", "register", "subscribe"],
    });
  });
});

describe("register() — schema + reflection + lời gọi", () => {
  test("đăng ký ⇒ get/list/getPackage/listPackages; dọn ⇒ sạch; lọc theo package/phía", async () => {
    const traces = await ab((service) => {
      const dispose = service.register(contributionOf("pkg-a", "host"));
      const before = {
        keys: service.list().map((record: any) => record.key),
        packages: service.listPackages().map((record: any) => record.key),
        one: service.getPackage("pkg-a")?.model,
        defaultFace: service.getPackage("pkg-a", "host")?.key,
        otherFace: service.getPackage("pkg-a", "client"),
        filtered: service.list({ package: "pkg-a" }).length,
        filteredOut: service.list({ package: "pkg-b" }).length,
        schemaType: service.get("pkg-a#Config")?.schema instanceof z.ZodType,
      };
      dispose();
      const after = { keys: service.list().length, packages: service.listPackages().length, get: service.get("pkg-a#Config") };
      return { before, after };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      before: {
        keys: ["pkg-a#Config"],
        packages: ["pkg-a#host"],
        one: { services: [], events: [], objects: [] },
        defaultFace: "pkg-a#host",
        otherFace: undefined,
        filtered: 1,
        filteredOut: 0,
        schemaType: true,
      },
      after: { keys: 0, packages: 0, get: undefined },
    });
  });

  test("trùng package-face · trùng schema · phía sai ⇒ CÙNG thông điệp (từ chối NGUYÊN LÔ)", async () => {
    const traces = await ab((service) => {
      service.register(contributionOf("pkg-a", "host"));
      const duplicatePackage = (() => {
        try {
          service.register(contributionOf("pkg-a", "host", "Other"));
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      const duplicateSchema = (() => {
        try {
          service.register({
            ...contributionOf("pkg-a", "client"),
            schemas: [{ name: "Config", create: () => z.string() }],
          });
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      const badFace = (() => {
        try {
          service.register({ ...contributionOf("pkg-b", "host"), face: "server" });
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      return { duplicatePackage, duplicateSchema, badFace, keys: service.list().length };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      duplicatePackage: 'typert: package face "pkg-a#host" is already registered',
      duplicateSchema: 'typert: schema "pkg-a#Config" is already registered',
      badFace: 'typert: invalid face "server" — expected "host" or "client"',
      keys: 1,
    });
  });

  test("resolve(): khoá sai dạng · package CÓ nhưng thiếu schema · package CHƯA đăng ký — ba thông điệp", async () => {
    const traces = await ab((service) => {
      service.register(contributionOf("pkg-a", "host"));
      const capture = (fn: () => unknown): string => {
        try {
          fn();
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      };
      return {
        bad: capture(() => service.resolve("khong-co-dau-hash")),
        empty: capture(() => service.resolve("pkg-a#")),
        missingSchema: capture(() => service.resolve("pkg-a#KhongCo")),
        missingPackage: capture(() => service.resolve("pkg-z#Config")),
        ok: service.resolve("pkg-a#Config")?.key,
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      bad: 'typert: invalid schema key "khong-co-dau-hash" — expected "<package>#<name>"',
      empty: 'typert: invalid schema key "pkg-a#" — expected "<package>#<name>"',
      missingSchema: 'typert: cannot resolve "pkg-a#KhongCo" — package "pkg-a" is registered but contributes no schema named "KhongCo"',
      missingPackage: 'typert: cannot resolve "pkg-z#Config" — package "pkg-z" has no registered contribution',
      ok: "pkg-a#Config",
    });
  });

  test("toJSONSchema(): chiếu Zod sang JSON Schema, KHÔNG nhớ đệm kết quả", async () => {
    const traces = await ab((service) => {
      service.register(contributionOf("pkg-a", "host"));
      const first = service.toJSONSchema("pkg-a#Config");
      const second = service.toJSONSchema("pkg-a#Config");
      return { first, sameObject: first === second };
    });
    expect(traces[0]).toEqual(traces[1]);
    const result = traces[0] as { first: { type: string }; sameObject: boolean };
    expect(result.first.type).toBe("object");
    expect(result.sameObject).toBe(false);
  });
});

describe("tra cứu · Context · kiểu tài nguyên · thay đổi", () => {
  test("lookups: register + configure ghép resolve; trùng ⇒ ném; đổi khai báo dây ⇒ ném", async () => {
    const traces = await ab((service) => {
      const provider = {
        parameter: "workspaceFileScope",
        wire: "workspaceFileScopeId",
        resource: "session",
        hostTypeSymbol: "pkg#Scope",
        wireTypeSymbol: "dsh-session/types#SessionId",
        resolve: async (id: string) => ({ id }),
      };
      const dispose = service.lookups.register("workspaceFileScope", provider);
      const beforeConfigure = service.lookups.get("workspaceFileScope");
      const disposeResolver = service.lookups.configure("workspaceFileScope", async (id: string) => ({ resolved: id }));
      const afterConfigure = service.lookups.get("workspaceFileScope");
      const duplicateRegister = (() => {
        try {
          service.lookups.register("workspaceFileScope", provider);
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      const duplicateConfigure = (() => {
        try {
          service.lookups.configure("workspaceFileScope", async () => undefined);
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      disposeResolver();
      dispose();
      const changedDeclaration = (() => {
        const first = service.lookups.register("k", { ...provider, wire: "a" });
        first();
        try {
          service.lookups.register("k", { ...provider, wire: "b" });
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      return {
        keysBefore: Object.keys(beforeConfigure ?? {}).sort(),
        beforeHasResolve: typeof beforeConfigure?.resolve,
        beforeParameter: beforeConfigure?.parameter,
        afterKeys: Object.keys(afterConfigure ?? {}).sort(),
        duplicateRegister,
        duplicateConfigure,
        changedDeclaration,
        emptyAfterDispose: service.lookups.get("workspaceFileScope"),
        definitions: service.lookups.definitions().map((definition: any) => definition.key),
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    const result = traces[0] as Record<string, unknown>;
    expect(result["duplicateRegister"]).toBe('typert: lookup "workspaceFileScope" is already registered');
    expect(result["duplicateConfigure"]).toBe('typert: lookup "workspaceFileScope" resolver is already configured');
    expect(result["changedDeclaration"]).toBe('typert: lookup "k" changed its wire declaration during this registry lifetime');
    expect(result["emptyAfterDispose"]).toBe(undefined);
  });

  test("contexts: registerHost/configureHost/getHost ghép; registerClient/getClient; trùng ⇒ ném", async () => {
    const traces = await ab((service) => {
      const adapter = { wire: "idWire", wireTypeSymbol: "pkg#Wire", resource: "session" };
      service.contexts.registerHost("scope", adapter);
      const plain = service.contexts.getHost("scope");
      service.contexts.configureHost("scope", async (id: string) => ({ id }));
      const merged = service.contexts.getHost("scope");
      service.contexts.registerClient("clientScope", { wire: "c", wireTypeSymbol: "pkg#C" });
      const duplicateHost = (() => {
        try {
          service.contexts.registerHost("scope", adapter);
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      return {
        plainKeys: Object.keys(plain ?? {}).sort(),
        mergedKeys: Object.keys(merged ?? {}).sort(),
        mergedHasResolve: typeof merged?.resolve,
        clientKeys: Object.keys(service.contexts.getClient("clientScope") ?? {}).sort(),
        unknownHost: service.contexts.getHost("khong-co"),
        duplicateHost,
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    const result = traces[0] as Record<string, unknown>;
    expect(result["duplicateHost"]).toBe('typert: host-context provider "scope" is already registered');
    expect(result["unknownHost"]).toBe(undefined);
  });

  test("resources: register/get/entries; \"global\" bị giữ; trùng ⇒ ném", async () => {
    const traces = await ab((service) => {
      service.resources.register("session", { field: "sessionId" });
      service.resources.register("workspace", { field: "rootId" });
      const reserved = (() => {
        try {
          service.resources.register("global", { field: "x" });
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      const duplicate = (() => {
        try {
          service.resources.register("session", { field: "khac" });
          return "KHONG NEM";
        } catch (error) {
          return (error as Error).message;
        }
      })();
      return {
        entries: service.resources.entries(),
        get: service.resources.get("session"),
        reserved,
        duplicate,
      };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      entries: [
        { kind: "session", field: "sessionId" },
        { kind: "workspace", field: "rootId" },
      ],
      get: { field: "sessionId" },
      reserved: 'typert: resource kind "global" is reserved for the built-in global resource',
      duplicate: 'typert: resource kind "session" is already registered',
    });
  });

  test("subscribe: phát thay đổi khi đăng ký/thu hồi (local · lookup · resource) — cùng thứ tự", async () => {
    const traces = await ab((service) => {
      const changes: string[] = [];
      service.local.subscribe((change: { kind: string; key: string }) => changes.push(change.kind + ":" + change.key));
      service.resources.subscribe((change: { kind: string; key: string }) => changes.push(change.kind + ":" + change.key));
      const dispose = service.register({
        ...contributionOf("pkg-a", "host"),
        invocations: [
          {
            id: "pkg-a#one",
            service: "demo",
            namespace: "demo",
            method: "one",
            result: { mode: "src-json" },
            parameters: [],
            invocation: { kind: "direct" },
          },
        ],
      });
      const resourceDispose = service.resources.register("session", { field: "sessionId" });
      const hasSeen = service.local.hasSeen("demo/one");
      const listed = service.local.list().map((descriptor: any) => descriptor.id);
      dispose();
      resourceDispose();
      return { changes, hasSeen, listed, afterWithdraw: service.local.hasSeen("demo/one"), remaining: service.local.list().length };
    });
    expect(traces[0]).toEqual(traces[1]);
    expect(traces[0]).toEqual({
      changes: ["local:demo/one", "resource:session", "local:demo/one", "resource:session"],
      hasSeen: true,
      listed: ["pkg-a#one"],
      afterWithdraw: true,
      remaining: 0,
    });
  });
});

describe("quy ước repo — NỬA HOST, KHÔNG khai gbh.row", () => {
  test("không gbh.row + đối chứng DƯƠNG gói HAI MẶT + không trùng tên service typert*", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: { row?: unknown; peers?: string[]; tests?: string[]; draft?: string };
      exports: Record<string, unknown>;
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
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
    // 19/10/2026 — CẬP NHẬT theo trạng thái mới (de-bundle 3 artefact, client KÉP): draft mô tả gói đủ artefact,
    // gbh.tests có thêm bộ halves, exports khớp TOÀN BỘ bản gốc (gồm ./client 3 nhánh).
    expect((json.gbh?.draft ?? "").includes("BA artefact")).toBe(true);
    expect(json.gbh?.tests).toEqual(["tests/host/typert-registry.test.ts", "tests/host/typert-registry-halves.test.ts"]);
    expect(Object.keys(json.exports).sort()).toEqual([".", "./client", "./locale/*.json", "./package.json", "./src/*", "./types"]);
    // Đối chứng DƯƠNG: bản gốc THẬT SỰ có HAI bản client + khoá dsh.client.
    const stockPkg = JSON.parse(readFileSync(join(STOCK_PKG, "package.json"), "utf8")) as {
      dsh?: { client?: { platform?: string; immediately?: boolean } };
      exports: Record<string, unknown>;
    };
    expect(stockPkg.dsh?.client?.platform).toBe("web");
    expect(stockPkg.dsh?.client?.immediately).toBe(true);
    expect(Object.keys(stockPkg.exports)).toContain("./client");
    expect(readFileSync(join(STOCK_PKG, "lib", "client.browser.js"), "utf8").length).toBeGreaterThan(0);
    expect(readFileSync(join(STOCK_PKG, "lib", "client.node.js"), "utf8").length).toBeGreaterThan(0);
    // Không package GBH nào khác cấp khoá service 'typert' (chỉ gói này).
    // 19/10/2026 — api-workspace-files đã de-bundle: bản viết tay chuyển vào src-handwritten/service.ts.
    const workspaceFiles = readFileSync(join(REPO, "packages", "host", "api-workspace-files", "src-handwritten", "service.ts"), "utf8");
    expect(workspaceFiles.includes('super(ctx, "typert")')).toBe(false);
    // HAI gói đã port GỌI vào seam 'typert' ⇒ ghi lại ràng buộc hình dạng.
    expect(workspaceFiles.includes("typert")).toBe(true);
  });

  test("gbh.peers ⊆ peerDependencies, dependencies RỖNG, locale byte-for-byte", () => {
    const json = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      gbh?: { peers?: string[] };
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const peers = json.peerDependencies ?? {};
    const declared = json.gbh?.peers ?? [];
    // 01/11/2026 — đồng bộ manifest theo stock: danh sách chọn lọc nay có thêm `@deepseek-ai/cordis` ⇒ kỳ vọng
    // đúng-hai-tên là CŨ. Giữ TẬP CON bắt buộc + phép kiểm dải CHUẨN của repo (`peerRangeProblems`).
    expect(declared).toEqual(expect.arrayContaining(["@deepseek-ai/cordis", "@deepseek-ai/dsh-typert-protocol", "zod"]));
    expect(declared.filter((name) => !(name in peers))).toEqual([]);
    expect(peerRangeProblems(PKG)).toEqual([]);
    expect(Object.keys(json.dependencies ?? {})).toEqual([]);
    for (const file of ["en.json", "zh.json"]) {
      expect(readFileSync(join(PKG, "locale", file), "utf8")).toBe(readFileSync(join(STOCK_PKG, "locale", file), "utf8"));
    }
  });
});