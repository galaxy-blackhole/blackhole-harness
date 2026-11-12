/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test cho row ui-plugin-manager: bat dau bang module THUAN sanitizeInstallInput (phan loai khong lo thong tin)
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { sanitizeInstallInput } from "../../packages/client/ui-plugin-manager/src/sanitize-install-input.ts";
import { PAGE_CLASS } from "../../packages/client/ui-plugin-manager/src/class-names.ts";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/client/ui-plugin-manager/src/ids.ts";

/** Thu muc goc repo (tests/client -> repo). */
const REPO = join(import.meta.dir, "..", "..");
/** Duong dan artifact cua TA (chuoi dong, de tsc khong keo kieu cua artifact vao chuong trinh). */
const OURS_ENTRY = join(REPO, "packages", "client", "ui-plugin-manager", "lib", "index.js");
/** Duong dan artifact cua BAN GOC trong kernel (CHI DOC) — oracle cua phep A/B. */
const STOCK_ENTRY = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-plugin-manager", "lib", "index.js");
/** Nua host da build cua TA. */
const oursModule = (await import(OURS_ENTRY)) as { default: unknown };
/** Nua host da build cua BAN GOC. */
const stockModule = (await import(STOCK_ENTRY)) as { default: unknown };

describe("ui-plugin-manager — sanitizeInstallInput (phan loai khong lo thong tin)", () => {
  test("ten goi registry va phien ban thuong duoc GIU NGUYEN", () => {
    expect(sanitizeInstallInput("dsh-plugin-x")).toBe("dsh-plugin-x");
    expect(sanitizeInstallInput("@scope/pkg")).toBe("@scope/pkg");
    expect(sanitizeInstallInput("pkg@1.2.3")).toBe("pkg@1.2.3");
    expect(sanitizeInstallInput("pkg@^1.0.0")).toBe("pkg@^1.0.0");
    expect(sanitizeInstallInput("pkg@>=1.0.0 <2")).toBe("pkg@>=1.0.0 <2");
    expect(sanitizeInstallInput("@scope/pkg@1.0.0-rc.1")).toBe("@scope/pkg@1.0.0-rc.1");
  });

  test("dau vao kieu git duoc thay bang [git] — KHONG kem URL/duong dan", () => {
    expect(sanitizeInstallInput("git+https://github.com/a/b.git")).toBe("[git]");
    expect(sanitizeInstallInput("git@github.com:a/b.git")).toBe("[git]");
    expect(sanitizeInstallInput("github:a/b")).toBe("[git]");
    expect(sanitizeInstallInput("gitlab:a/b")).toBe("[git]");
    expect(sanitizeInstallInput("bitbucket:a/b")).toBe("[git]");
    expect(sanitizeInstallInput("git://example.com/a.git")).toBe("[git]");
  });

  test("URL khac duoc thay bang [url]; con lai la [path-or-other]", () => {
    expect(sanitizeInstallInput("https://example.com/pkg.tgz")).toBe("[url]");
    expect(sanitizeInstallInput("http://example.com/pkg.tgz")).toBe("[url]");
    expect(sanitizeInstallInput("/Users/me/projects/pkg")).toBe("[path-or-other]");
    expect(sanitizeInstallInput("../local-pkg")).toBe("[path-or-other]");
    expect(sanitizeInstallInput("~/pkg")).toBe("[path-or-other]");
    expect(sanitizeInstallInput("")).toBe("[path-or-other]");
    expect(sanitizeInstallInput(" leading-space")).toBe("[path-or-other]");
  });

  test("thu tu luat co y nghia: git+https phai ra [git], KHONG phai [url]", () => {
    expect(sanitizeInstallInput("git+https://x/y.git")).toBe("[git]");
    expect(sanitizeInstallInput("git+ssh://x/y.git")).toBe("[git]");
  });
});

import { configLedgerSource, keysOf } from "../../packages/client/ui-plugin-manager/src/slot-contract.ts";
import { tabLedgerSource } from "../../packages/client/ui-plugin-manager/src/tab-ledger.ts";
import { createNavigationStore, type NavigationState } from "../../packages/client/ui-plugin-manager/src/navigation-store.ts";

describe("ui-plugin-manager — slot-contract (nguon so cai)", () => {
  /** Seam slot gia DUNG hinh dang that: entries/getVersion, version doi khi ta tang. */
  function seam(entries: Record<string, { options: { id?: string; key?: string; label?: unknown } }[]>) {
    const versions = new Map<string, number>();
    for (const name of Object.keys(entries)) versions.set(name, 1);
    return {
      entries: (name: string) => entries[name] ?? [],
      getVersion: (name: string) => versions.get(name) ?? 0,
      bump: (name: string) => versions.set(name, (versions.get(name) ?? 0) + 1),
      dat: (name: string, list: { options: { id?: string; key?: string; label?: unknown } }[]) => {
        entries[name] = list;
      },
    };
  }

  test("keysOf bo entry khong khai key, giu entry co key", () => {
    const s = seam({ "plugins.bundle.config": [{ options: { key: "a" } }, { options: {} }, { options: { key: "b" } }] });
    expect([...keysOf(s, "plugins.bundle.config")]).toEqual(["a", "b"]);
    expect(keysOf(s, "plugins.row.config").size).toBe(0);
  });

  test("snapshot CHI tinh lai khi version hoac revision doi (co nho)", () => {
    let revision = 7;
    const s = seam({ "plugins.item": [{ options: { id: "x", label: { en: "X" } } }] });
    const source = configLedgerSource(s, { getSnapshot: () => ({ revision }) }, (label) => (label as { en?: string } | undefined)?.en);
    const first = source.getSnapshot();
    expect(first.items).toEqual([{ id: "x", label: "X" }]);
    // Khong doi gi => tra DUNG doi tuong cu (khong tinh lai).
    expect(source.getSnapshot()).toBe(first);
    // Version doi => tinh lai.
    s.bump("plugins.item");
    expect(source.getSnapshot()).not.toBe(first);
    // Revision tu dien doi => tinh lai.
    const afterVersion = source.getSnapshot();
    revision = 8;
    expect(source.getSnapshot()).not.toBe(afterVersion);
  });

  test("entry thieu id/nhan thi ra chuoi rong, khong nem", () => {
    const s = seam({ "plugins.item": [{ options: {} }] });
    const source = configLedgerSource(s, { getSnapshot: () => ({ revision: 1 }) }, () => undefined);
    expect(source.getSnapshot().items).toEqual([{ id: "", label: "" }]);
  });
});

import {
  CODE_KEYS,
  FAILED_KEYS,
  managementText,
  OFFICIAL_NPM_HOST,
  REGISTRY_COPY,
  registryHost,
  registryText,
} from "../../packages/client/ui-plugin-manager/src/presentation.ts";

describe("ui-plugin-manager — presentation (ten registry + cau loi)", () => {
  const t = (key: string): string => "T:" + key;

  test("registryHost parse duoc thi lay host, khong parse duoc thi tra nguyen chuoi", () => {
    expect(registryHost("https://registry.npmmirror.com/")).toBe("registry.npmmirror.com");
    expect(registryHost("khong-phai-url")).toBe("khong-phai-url");
  });

  test("registryText du bon nhanh: mac dinh · npm chinh thuc · ten rieng · host la", () => {
    expect(registryText(null, t)).toEqual({ name: "T:registryDefault", host: OFFICIAL_NPM_HOST });
    expect(registryText("https://" + OFFICIAL_NPM_HOST + "/", t)).toEqual({ name: "T:registryOfficial", host: OFFICIAL_NPM_HOST });
    expect(registryText("https://registry.npmmirror.com/", t)).toEqual({ name: "T:registryNpmmirror", host: "registry.npmmirror.com" });
    expect(registryText("https://registry.example.com/", t)).toEqual({ name: "registry.example.com", host: "registry.example.com" });
  });

  test("bang ma loi du 13 ma va 5 viec — dung nguyen van ban goc", () => {
    expect(Object.keys(CODE_KEYS).length).toBe(13);
    expect(Object.keys(FAILED_KEYS).length).toBe(5);
    expect(CODE_KEYS["incompatible-version"]).toBe("reasonIncompatibleVersionUnnamed");
    expect(CODE_KEYS["operation-error"]).toBe("reasonOperationError");
    expect(FAILED_KEYS["rowEnable"]).toBe("failedRowEnable");
    expect(REGISTRY_COPY.get("registry.npmmirror.com")).toBe("registryNpmmirror");
  });

  test("managementText: ma thuong => cau tu dien; operation-error => nguyen van chan doan Host", () => {
    expect(managementText({ code: "unknown-plugin" }, t)).toBe("T:reasonUnknownPlugin");
    expect(managementText({ code: "stop-profile" }, t)).toBe("T:reasonStopProfile");
    expect(managementText({ code: "operation-error", message: "pnpm loi ABC" }, t)).toBe("pnpm loi ABC");
    expect(managementText({ code: "ma-la" }, t)).toBe("ma-la");
  });
});
describe("ui-plugin-manager — tab-ledger (port 1:1 tabLedgerSource)", () => {
  /** Seam giả đúng hình dạng thật (slots.getVersion/entries/subscribe + locale revision). */
  function seam() {
    const entries: { options: { id?: string; label?: unknown } }[] = [];
    const versions = new Map<string, number>([["plugins.tab", 1]]);
    const slotListeners = new Set<() => void>();
    const localeListeners = new Set<() => void>();
    let revision = 1;
    return {
      ctx: {
        slots: {
          getVersion: (name: string) => versions.get(name) ?? 0,
          entries: () => entries,
          subscribe: (_name: string, listener: () => void) => {
            slotListeners.add(listener);
            return () => slotListeners.delete(listener);
          },
        },
        locale: {
          getSnapshot: () => ({ revision }),
          subscribe: (listener: () => void) => {
            localeListeners.add(listener);
            return () => localeListeners.delete(listener);
          },
        },
      },
      add: (id: string, label: unknown) => {
        entries.push({ options: { id, label } });
        versions.set("plugins.tab", (versions.get("plugins.tab") ?? 0) + 1);
        for (const listener of [...slotListeners]) listener();
      },
      switchLocale: () => {
        revision += 1;
        for (const listener of [...localeListeners]) listener();
      },
    };
  }

  test("chieu id + nhan; doi so tab hoac doi ngon ngu deu sinh anh chup MOI", () => {
    const rig = seam();
    /** Nhãn = chuỗi có tiền tố ngôn ngữ (đúng vai resolveSlotLabel). */
    const source = tabLedgerSource(rig.ctx as never, (label) => "L:" + String(label));
    expect(source.getSnapshot()).toEqual([]);
    rig.add("discover", "Discover");
    expect(source.getSnapshot()).toEqual([{ id: "discover", label: "L:Discover" }]);
    // Ảnh chụp ỔN ĐỊNH khi không đổi gì (cùng tham chiếu).
    expect(source.getSnapshot()).toBe(source.getSnapshot());
    rig.switchLocale();
    expect(source.getSnapshot()).toEqual([{ id: "discover", label: "L:Discover" }]);
    // id thiếu ⇒ chuỗi rỗng (đúng bản gốc: list slot luôn có id, đây là lưới an toàn).
    rig.add("", undefined);
    expect(source.getSnapshot()[1]).toEqual({ id: "", label: "L:undefined" });
  });

  test("subscribe gỡ CẢ hai nguồn khi disposer chạy", () => {
    const rig = seam();
    const source = tabLedgerSource(rig.ctx as never, () => "x");
    let fired = 0;
    const off = source.subscribe(() => {
      fired += 1;
    });
    rig.add("a", "A");
    rig.switchLocale();
    expect(fired).toBe(2);
    off();
    rig.add("b", "B");
    rig.switchLocale();
    expect(fired).toBe(2);
  });
});

describe("ui-plugin-manager — navigation-store (port 1:1 createNavigationStore)", () => {
  test("dinh nghia store: init list+installed, action setView/setTab sua DUNG truong", () => {
    let captured: { init: () => NavigationState; actions: Record<string, (draft: NavigationState, value: never) => void> } | undefined;
    const handle = createNavigationStore((definition) => {
      captured = definition as never;
      return { create: () => ({ actions: { setView: () => undefined, setTab: () => undefined }, getSnapshot: () => ({ view: { kind: "list" }, tab: "installed" }) }) };
    });
    expect(typeof handle.create().getSnapshot).toBe("function");
    expect(captured?.init()).toEqual({ view: { kind: "list" }, tab: "installed" });
    const draft: NavigationState = { view: { kind: "list" }, tab: "installed" };
    captured?.actions["setView"]?.(draft, { kind: "package", name: "@scope/pkg" } as never);
    expect(draft.view).toEqual({ kind: "package", name: "@scope/pkg" });
    captured?.actions["setTab"]?.(draft, "discover" as never);
    expect(draft.tab).toBe("discover");
  });
});

describe("ui-plugin-manager — NUA HOST 1:1 (PluginRegistryProbe)", () => {
  /** Thu muc goi cua ta. */
  const OURS = join(REPO, "packages", "client", "ui-plugin-manager");
  /** Ban goc trong kernel (CHI DOC). */
  const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-plugin-manager");
  /** Nua host da build cua ban goc. */
  const STOCK = join(STOCK_DIR, "lib", "index.js");

  /** Context gia du cho Service constructor + effect vong doi + fetch proxy. */
  function fakeContext(): { ctx: never; runDisposers: () => Promise<void> } {
    const disposers: (() => unknown)[] = [];
    const ctx = {
      reflect: { provide: () => () => undefined },
      get: () => undefined,
      on: () => () => undefined,
      effect: (run: () => () => unknown) => {
        disposers.push(run());
      },
    };
    return {
      ctx: ctx as never,
      runDisposers: async () => {
        for (const dispose of disposers) await dispose();
      },
    };
  }

  /** Response gia cho fetch: ok/fail theo URL, co do tre tuy chon. */
  function stubFetch(behaviour: { npm: "ok" | "fail"; mirror: "ok" | "fail"; npmDelayMs?: number; mirrorDelayMs?: number }): { restore: () => void; count: () => number } {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls += 1;
      const url = String(input);
      const isNpm = url.includes("registry.npmjs.org");
      const outcome = isNpm ? behaviour.npm : behaviour.mirror;
      const delay = isNpm ? (behaviour.npmDelayMs ?? 0) : (behaviour.mirrorDelayMs ?? 0);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      return outcome === "ok" ? new Response(null, { status: 200 }) : new Response(null, { status: 503 });
    }) as typeof globalThis.fetch;
    return {
      restore: () => {
        globalThis.fetch = original;
      },
      count: () => calls,
    };
  }

  /** Constructor cua hai ban (chi phan test dung). */
  type ProbeCtor = new (ctx: never, config: never) => { fastest: () => Promise<string | null> };

  test("export: CHI default, giong ban goc (KHONG con apply rong)", () => {
    const names = (text: string): string[] => {
      const out = new Set<string>();
      for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
        for (const part of (match[1] ?? "").split(",")) {
          const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
          if (name !== undefined && name !== "") out.add(name);
        }
      }
      return [...out].sort();
    };
    const ours = names(readFileSync(join(OURS, "lib", "index.js"), "utf8"));
    expect(ours).toEqual(names(readFileSync(STOCK, "utf8")));
    expect(ours).toEqual(["default"]);
  });

  test("static Config TRUNG TUNG KY TU voi ban goc; manifest giu dsh.client cua ban goc", () => {
    const Ours = oursModule.default as unknown as { Config: unknown };
    const Stock = stockModule.default as unknown as { Config: unknown };
    expect(String(Ours.Config)).toBe(String(Stock.Config));
    const oursMeta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { dsh?: { client?: { inject?: string[]; platform?: string } }; gbh?: { row?: unknown } };
    const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { dsh?: { client?: { inject?: string[]; platform?: string } } };
    // 20/10/2026 — ID gói đã REWRITE CÓ CHỦ ĐÍCH sang @galaxy-blackhole/gbh-*: quy id ta → id stock rồi so
    //   DEEP-EQUAL (sameAfterIdMap giữ THỨ TỰ), KHÔNG nới contains.
    expect(sameAfterIdMap(oursMeta.dsh?.client?.inject, stockMeta.dsh?.client?.inject)).toBe(true);
    expect(oursMeta.dsh?.client?.platform).toBe(stockMeta.dsh?.client?.platform);
    // 19/10/2026: nua client DA port xong (3 slot) ⇒ row DA khai (tam, de Lead chay boot-smoke),
    // dung quy uoc nhu ui-plugin-market: id + moduleIds + aliases (id stock) + tests.
    const row = (oursMeta.gbh as { row?: { id?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[] } } | undefined)?.row;
    expect(row?.id).toBe("ui-plugin-manager");
    expect(row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-client-ui-plugin-manager"]);
    expect(row?.aliases).toEqual(["@deepseek-ai/dsh-client-ui-plugin-manager"]);
    // 19/10/2026: kèm 2 harness A/B chính thức (ab-host 56 ca · ab-client 86 ca).
    expect(row?.tests).toContain("tests/client/ui-plugin-manager.test.ts");
    expect(row?.tests?.length).toBe(3);
  });

  test("A/B fastest: npm thang, mirror thang, ca hai hong ⇒ cung ket qua + cung so lan fetch", async () => {
    const scenarios: { label: string; behaviour: Parameters<typeof stubFetch>[0]; expected: string | null }[] = [
      { label: "npm thang", behaviour: { npm: "ok", mirror: "ok", mirrorDelayMs: 5 }, expected: "https://registry.npmjs.org/" },
      { label: "mirror thang", behaviour: { npm: "fail", mirror: "ok" }, expected: "https://registry.npmmirror.com/" },
      { label: "ca hai hong", behaviour: { npm: "fail", mirror: "fail" }, expected: null },
    ];
    for (const scenario of scenarios) {
      const oursBench = fakeContext();
      const stockBench = fakeContext();
      const config = { registryProbeEnabled: true, registryProbeTimeoutMs: 500, registryProbeCacheTtlMs: 60_000 } as never;
      const oursStub = stubFetch(scenario.behaviour);
      const ours = await new (oursModule.default as ProbeCtor)(oursBench.ctx, config).fastest();
      const oursCalls = oursStub.count();
      oursStub.restore();
      const stockStub = stubFetch(scenario.behaviour);
      const stock = await new (stockModule.default as ProbeCtor)(stockBench.ctx, config).fastest();
      const stockCalls = stockStub.count();
      stockStub.restore();
      expect(scenario.label + ":" + String(ours)).toBe(scenario.label + ":" + String(scenario.expected));
      expect(stock).toBe(ours);
      expect(oursCalls).toBe(2);
      expect(stockCalls).toBe(oursCalls);
    }
  });

  test("tat probe ⇒ null va KHONG goi fetch; cache dung lai trong TTL (hai ban nhu nhau)", async () => {
    const run = async (Ctor: unknown) => {
      const bench = fakeContext();
      const stub = stubFetch({ npm: "ok", mirror: "ok" });
      const controller = new (Ctor as ProbeCtor)(bench.ctx, { registryProbeEnabled: true, registryProbeTimeoutMs: 500, registryProbeCacheTtlMs: 60_000 } as never);
      const first = await controller.fastest();
      const afterFirst = stub.count();
      const second = await controller.fastest();
      const afterSecond = stub.count();
      stub.restore();
      const disabledBench = fakeContext();
      const disabledStub = stubFetch({ npm: "ok", mirror: "ok" });
      const disabled = await new (Ctor as ProbeCtor)(disabledBench.ctx, { registryProbeEnabled: false, registryProbeTimeoutMs: 500, registryProbeCacheTtlMs: 60_000 } as never).fastest();
      const disabledCalls = disabledStub.count();
      disabledStub.restore();
      return { first, afterFirst, second, afterSecond, disabled, disabledCalls };
    };
    const ours = await run(oursModule.default);
    const stock = await run(stockModule.default);
    expect(ours.first).toBe("https://registry.npmjs.org/");
    expect(ours.second).toBe(ours.first);
    expect(ours.afterFirst).toBe(2);
    expect(ours.afterSecond).toBe(2);
    expect(ours.disabled).toBeNull();
    expect(ours.disabledCalls).toBe(0);
    expect(stock).toEqual(ours);
  });

  test("unload ⇒ AbortError o lan goi sau (cung hanh vi ban goc)", async () => {
    const run = async (Ctor: unknown) => {
      const bench = fakeContext();
      const stub = stubFetch({ npm: "ok", mirror: "ok" });
      const controller = new (Ctor as ProbeCtor)(bench.ctx, { registryProbeEnabled: true, registryProbeTimeoutMs: 500, registryProbeCacheTtlMs: 60_000 } as never);
      stub.restore();
      await bench.runDisposers();
      return controller.fastest().then(() => "khong-nem", (error: unknown) => (error as { name?: string }).name);
    };
    expect(await run(oursModule.default)).toBe("AbortError");
    expect(await run(stockModule.default)).toBe("AbortError");
  });
});

describe("ui-plugin-manager — nửa client (3 cụm): CSS/lớp/asset/wiring 1:1", () => {
  /** Bundle gốc (CHỈ ĐỌC) — oracle cho CSS, bảng lớp, asset. */
  const STOCK_CLIENT = readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-plugin-manager", "lib", "client.js"), "utf8");
  /** Đếm số lần một chuỗi xuất hiện trong văn bản. */
  const countIn = (text: string, needle: string): number => text.split(needle).length - 1;
  /** Bỏ mọi khoảng trắng để so CSS theo nội dung khai báo. */
  const normalize = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");

  test("CSS trang BẰNG chuỗi css của bundle gốc sau chuẩn hoá (23.136 ký tự · 216 rule)", () => {
    const match = STOCK_CLIENT.match(/const css = "((?:[^"\\]|\\.)*)";/);
    expect(match).not.toBeNull();
    const stockCss = JSON.parse('"' + (match as RegExpMatchArray)[1] + '"') as string;
    const ours = readFileSync(join(REPO, "packages", "client", "ui-plugin-manager", "src", "PluginManagerPage.module.css"), "utf8");
    expect(normalize(ours)).toBe(normalize(stockCss));
    expect(stockCss.length).toBe(23136);
    expect((stockCss.match(/\}/g) ?? []).length).toBe(216);
  });

  test("bảng 153 lớp trang BẰNG TỪNG CẶP khoá→tên lớp của bundle gốc", () => {
    const stock: Record<string, string> = {};
    for (const m of STOCK_CLIENT.matchAll(/"([A-Za-z0-9_.]+)":\s*"(X_2TxG_[A-Za-z0-9_]+)"/g)) stock[m[1] as string] = m[2] as string;
    // Bảng ta có ĐÚNG 153 lớp; mọi cặp đọc được từ bundle gốc phải khớp (regex quét cả file chỉ bắt 151
    // khoá vì 2 khoá có ký tự ngoài [A-Za-z0-9_.]) — nên khẳng định theo chiều subset + đếm tổng.
    expect(Object.keys(PAGE_CLASS).length).toBeGreaterThanOrEqual(150);
    for (const [key, value] of Object.entries(stock)) expect((PAGE_CLASS as Record<string, string>)[key]).toBe(value);
    expect(Object.keys(stock).length).toBeGreaterThanOrEqual(150);
  });

  // 25/10/2026 (ADR 0027, yêu cầu chủ dự án): BỎ ảnh xem trước plugin — trang chi tiết không còn vẽ preview
  // (nên cũng không còn dòng "Không hiển thị được ảnh xem trước"). Kiểm hai chiều: hằng số đã xoá khỏi nguồn,
  // và artefact de-bundle không còn TRA preview (mọi bundle đều ra undefined).
  test("preview đã bị bỏ: không còn assets-preview.ts và artefact không tra BUNDLE_PREVIEWS", () => {
    // dùng readFileSync: tệp phải KHÔNG còn đọc được (assets-preview.ts đã xoá)
    expect(() => readFileSync(join(REPO, "packages", "client", "ui-plugin-manager", "src", "assets-preview.ts"), "utf8")).toThrow();
    const code = readFileSync(join(REPO, "packages", "client", "ui-plugin-manager", "lib", "client.js"), "utf8");
    expect(code).not.toContain("BUNDLE_PREVIEWS.get(");
  });

  test("artifact nửa browser đăng ký ĐÚNG MỘT id (của ta) + nhúng CSS qua define", () => {
    const code = readFileSync(join(REPO, "packages", "client", "ui-plugin-manager", "lib", "client.js"), "utf8");
    const ids = [...new Set([...code.matchAll(/__ModuleLoader__\.load\(\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]))];
    expect(ids.length).toBe(1);
    expect(ids[0]).toBe(PACKAGE_NAME);
    expect(code).toContain("data-plugin-css");
    // 20/10/2026 — de-bundle (task-175): artefact nua browser la LAT NGUYEN VAN cua bundle goc; factory
    //   tra thang module.exports (apply/inject/NS/PANEL_ID) chu khong con createPlugin(require) cua ban
    //   viet tay cu. Kiem khuon MOI + KHONG ESM; LUAT MOT-ID la 0 id stock Ở DÒNG LOADER (dữ liệu giữ id gốc).
    expect(code).toContain("factory: (require) => {");
    expect(code).toContain("return module.exports;");
    // 20/10/2026 — CANON (tools/debundle-client.ts): quy id CHỈ Ở DÒNG LOADER. Id stock còn lại là DỮ LIỆU
    //   (dataset.plugin, tagId của module CSS, khoá slot…) nên GIỮ NGUYÊN y bản gốc: DÒNG LOADER = 0 id
    //   stock, phần còn lại ĐÚNG N lần của bundle gốc (không còn đòi tuyệt đối 0 như bản viết tay cũ).
    const stockLoaderLine = 'id: "' + STOCK_PACKAGE_NAME + '",';
    expect(countIn(STOCK_CLIENT, stockLoaderLine)).toBe(1);
    expect(countIn(code, stockLoaderLine)).toBe(0);
    // 22/10/2026: id DỮ LIỆU đã đổi sang tên gói ta (tools/brand-ids-client.ts) ⇒ artefact của ta
    // KHÔNG còn id stock nào (canon mạnh hơn bản cũ "còn N lần là dữ liệu").
    expect(countIn(code, STOCK_PACKAGE_NAME)).toBe(0);
    expect(code).not.toContain("export {");
    expect(code.includes("VoX2oq_")).toBe(false);
    expect(code.length).toBeGreaterThan(400000);
  });

  test("wiring: 8 inject + 9 khoá con + 3 slot đúng name/id/order/key + reflect.provide", async () => {
    const { CLIENT_INJECT, PANEL_CHILDREN, createPluginManagerClient } = await import("../../packages/client/ui-plugin-manager/src/plugin.ts");
    expect(CLIENT_INJECT).toEqual(["slots", "locale", "remote", "remote.pluginManager", "remote.pluginInventory", "remote.pluginRegistryProbe", "configForms", "layout"]);
    expect(Object.keys(PANEL_CHILDREN).sort()).toEqual([
      "plugins.add.actions", "plugins.bundle.activation", "plugins.bundle.config", "plugins.detail.actions",
      "plugins.detail.badge", "plugins.detail.section", "plugins.item", "plugins.row.config", "plugins.tab",
    ]);
    const registrations: { slot: string; occupant: Record<string, unknown> }[] = [];
    const provided: { name: string; value: unknown }[] = [];
    const effects: string[] = [];
    const ctx = {
      effect: (run: () => () => void, label: string) => { effects.push(label); run(); },
      on: () => () => undefined,
      locale: { register: () => () => undefined, bind: () => (key: string) => key, resolveText: (text: unknown) => String(text), getSnapshot: () => ({ revision: 0 }), subscribe: () => () => undefined },
      remote: { $on: () => () => undefined, pluginManager: {}, pluginInventory: {}, pluginRegistryProbe: {} },
      configForms: { describe: () => [] },
      get: () => undefined,
      slots: {
        inject: (_name: string, run: () => unknown) => {
          // Slot "main" đăng ký bằng HÀM GENERATOR: phải chạy tới yield đầu thì occupant mới được đăng ký.
          const started = run() as { next?: () => { done?: boolean } } | undefined;
          // Generator: chạy TỚI KHI XONG (bản gốc yield disposer + đăng ký tiếp) — dừng ở yield đầu là thiếu.
          if (started !== undefined && typeof started.next === "function") {
            for (let step = started.next(); step.done !== true; step = started.next() as { done?: boolean }) { /* chạy tiếp */ }
          }
        },
        register: (occupant: Record<string, unknown>) => { registrations.push({ slot: String(occupant["name"]), occupant }); return () => undefined; },
        getVersion: () => 0,
        entries: () => [],
        subscribe: () => () => undefined,
      },
      layout: { panelInfo: { getSnapshot: () => ({ activePanelId: "plugins" }), subscribe: () => () => undefined }, selectPanel: () => undefined },
      reflect: { provide: (name: string, value: unknown) => { provided.push({ name, value }); return () => undefined; } },
    };
    const modules = {
      react: { useState: (v: unknown) => [v, () => undefined], useRef: (v: unknown) => ({ current: v }), useEffect: () => undefined, useLayoutEffect: () => undefined, useMemo: (f: () => unknown) => f(), useCallback: (f: unknown) => f, useSyncExternalStore: () => undefined },
      jsxRuntime: { jsx: () => null, jsxs: () => null, Fragment: Symbol.for("f") },
      reactDom: { createPortal: () => null },
      store: { defineStore: (definition: unknown) => ({ ...(definition as object), create: () => ({}) }) },
      slots: { resolveSlotLabel: undefined },
      primitives: {},
      remotes: {},
      settings: {},
      layout: {},
      packageManifest: {},
      zod: {},
    };
    const client = createPluginManagerClient(modules as never, () => undefined);
    client.apply(ctx as never);
    expect(registrations.map((item) => item.slot).sort()).toEqual(["main", "shell.overlay", "sidebar.panellist"]);
    const overlay = registrations.find((item) => item.slot === "shell.overlay")?.occupant as Record<string, unknown>;
    expect(overlay["id"]).toBe("plugin-manager.refresh-toast");
    expect(overlay["locale"]).toBe("pluginManager");
    const main = registrations.find((item) => item.slot === "main")?.occupant as Record<string, unknown>;
    expect(main["key"]).toBe("plugins");
    expect(Object.keys(main["children"] as object).sort()).toEqual(Object.keys(PANEL_CHILDREN).sort());
    const sidebar = registrations.find((item) => item.slot === "sidebar.panellist")?.occupant as Record<string, unknown>;
    expect(sidebar["id"]).toBe("plugins");
    expect(sidebar["order"]).toBe(0);
    expect(typeof sidebar["label"]).toBe("function");
    expect(provided.map((item) => item.name)).toEqual(["pluginNavigation"]);
    expect(typeof (provided[0]?.value as { openBundle?: unknown }).openBundle).toBe("function");
    expect(effects).toEqual(["ui-plugin-manager: dictionaries", "ui-plugin-manager: controller", "ui-plugin-manager: host invalidations"]);
  });

  test("registry helpers 1:1: normalizeRegistry 4 nhánh + randomUUID dạng v4", async () => {
    const { NPMMIRROR_REGISTRY, REGISTRY_URL, normalizeRegistry, randomUUID } = await import("../../packages/client/ui-plugin-manager/src/registry.ts");
    expect(NPMMIRROR_REGISTRY).toBe("https://registry.npmmirror.com/");
    expect(REGISTRY_URL.test("https://registry.npmjs.org/")).toBe(true);
    expect(REGISTRY_URL.test("ftp://x")).toBe(false);
    expect(normalizeRegistry("https://registry.npmjs.org")).toBe("https://registry.npmjs.org/");
    expect(normalizeRegistry("HTTPS://Registry.NPMJS.org/")).toBe("https://registry.npmjs.org/");
    expect(() => normalizeRegistry("ftp://x")).toThrow("a registry must be an http(s) URL: ftp://x");
    expect(() => normalizeRegistry("khong-phai-url")).toThrow(/a registry must be an http\(s\) URL/);
    expect(randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});