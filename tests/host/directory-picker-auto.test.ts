/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-host-directory-picker-auto: bộ giải đối chứng TRỰC TIẾP
 *      với chính bundle gốc, phép dò PATH, vòng mount/dọn cặp entry, và đường lỗi.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BACKEND_PACKAGES,
  SURFACE_PACKAGES,
  apply,
  canExecute,
  hasLinuxChooserBinary,
  inject,
  name,
} from "../../packages/host/directory-picker-auto/src/index.ts";
import { isLoopbackHost, type DirectoryPickerHostFacts, resolveDirectoryPickerBackend } from "../../packages/host/directory-picker-auto/src/resolve.ts";

/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — dùng để đối chứng bộ giải + phép dò. */
const STOCK_PATH = "../../apps/host/node_modules/@deepseek-ai/dsh-host-directory-picker-auto/lib/index.js";
const OURS_PATH = "../../packages/host/directory-picker-auto/lib/index.js";

/** Dữ kiện host mẫu (đã ở nhánh native trừ khi ghi đè). */
function facts(patch: Partial<DirectoryPickerHostFacts> = {}): DirectoryPickerHostFacts {
  return {
    bindHost: "127.0.0.1",
    allowsRemoteAuthorities: false,
    platform: "darwin",
    ssh: false,
    env: {},
    linuxChooser: true,
    ...patch,
  };
}

/** Liệt kê tên export của một file ESM đã build. */
async function exportNames(path: string): Promise<string[]> {
  const text = await readFileSync(new URL(path, import.meta.url), "utf8");
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  if (/export\s+default/u.test(text)) names.add("default");
  return [...names].sort();
}

/** Context giả: hai seam cấu hình + Loader ghi lại create/resolve/remove, đủ cho apply(). */
function fakeContext(options: { host?: string; remoteAuthorities?: boolean; breakSecond?: boolean } = {}): {
  ctx: never;
  created: string[];
  disposed: string[];
  removed: string[];
  disposers: Array<() => Promise<void>>;
  loaderSize: () => number;
} {
  const created: string[] = [];
  const disposed: string[] = [];
  const removed: string[] = [];
  const disposers: Array<() => Promise<void>> = [];
  const store: Record<string, { fiber?: { await(): Promise<unknown>; dispose(): Promise<unknown> } }> = {};
  const loader = {
    store,
    create: async ({ name }: { name: string }): Promise<string> => {
      created.push(name);
      const id = "entry-" + String(created.length);
      store[id] = options.breakSecond === true && created.length === 2
        ? {}
        : {
            fiber: {
              await: async () => undefined,
              dispose: async () => {
                disposed.push(id);
              },
            },
          };
      return id;
    },
    resolve: (id: string) => store[id] ?? {},
    remove: (id: string): void => {
      removed.push(id);
      delete store[id];
    },
  };
  const ctx = {
    get: (key: string): unknown => {
      if (key === "loader") return loader;
      if (key === "webServer") return { host: options.host ?? "127.0.0.1" };
      if (key === "connection") return { allowsRemoteAuthorities: options.remoteAuthorities === true };
      return undefined;
    },
    effect: async (callback: () => Promise<() => Promise<void>>): Promise<void> => {
      disposers.push(await callback());
    },
  };
  return { ctx: ctx as never, created, disposed, removed, disposers, loaderSize: () => Object.keys(store).length };
}

describe("bề mặt plugin: đối chứng với chính bundle gốc", () => {
  test("export TRÙNG tập bản gốc và KHÔNG có default", async () => {
    const stock = await exportNames(STOCK_PATH);
    expect(await exportNames(OURS_PATH)).toEqual(stock);
    expect(stock).toEqual([
      "BACKEND_PACKAGES",
      "SURFACE_PACKAGES",
      "apply",
      "canExecute",
      "hasLinuxChooserBinary",
      "inject",
      "name",
      "resolveDirectoryPickerBackend",
    ]);
  });

  test("name + inject khớp bản gốc, và bảng gói backend/bề mặt khớp từng chữ", async () => {
    const stock = (await import(STOCK_PATH)) as {
      name: string;
      inject: string[];
      BACKEND_PACKAGES: Record<string, string>;
      SURFACE_PACKAGES: Record<string, string>;
    };
    expect(name).toBe(stock.name);
    expect(inject).toEqual(stock.inject);
    expect(inject).toEqual(["webServer", "connection", "loader"]);
    expect(BACKEND_PACKAGES).toEqual(stock.BACKEND_PACKAGES);
    expect(SURFACE_PACKAGES).toEqual(stock.SURFACE_PACKAGES);
  });
});

describe("bộ giải: đối chứng từng ca với bản gốc", () => {
  test("cùng dữ kiện → cùng kết quả trên cả bảng chân trị", async () => {
    const stock = (await import(STOCK_PATH)) as { resolveDirectoryPickerBackend: (f: DirectoryPickerHostFacts) => string };
    const cases: DirectoryPickerHostFacts[] = [
      facts(),
      facts({ bindHost: "::1" }),
      facts({ bindHost: "192.168.1.10" }),
      facts({ bindHost: "::ffff:127.0.0.1" }),
      facts({ allowsRemoteAuthorities: true }),
      facts({ ssh: true }),
      facts({ platform: "win32" }),
      facts({ platform: "linux", linuxChooser: true, env: { DISPLAY: ":0" } }),
      facts({ platform: "linux", linuxChooser: true, env: { WAYLAND_DISPLAY: "wayland-0" } }),
      facts({ platform: "linux", linuxChooser: true, env: {} }),
      facts({ platform: "linux", linuxChooser: false, env: { DISPLAY: ":0" } }),
      facts({ platform: "aix" }),
      facts({ platform: "linux", linuxChooser: true, env: { DISPLAY: "" } }),
    ];
    const ours: string[] = cases.map((entry) => resolveDirectoryPickerBackend(entry));
    const theirs: string[] = cases.map((entry) => stock.resolveDirectoryPickerBackend(entry));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual([
      "native", "native", "browse", "native", "browse", "browse", "native",
      "native", "native", "browse", "browse", "browse", "browse",
    ]);
  });

  test("isLoopbackHost: nhận đúng các dạng loopback, từ chối phần còn lại", () => {
    for (const host of ["127.0.0.1", "127.1.2.3", "::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1", "::ffff:7f00:1", "127.0.0.1%lo0"]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of ["0.0.0.0", "10.0.0.5", "::", "2001:db8::1", "localhost", "", "127.0.0.1  "]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });
});

describe("phép dò PATH: đối chứng với bản gốc", () => {
  test("hasLinuxChooserBinary quét PATH như bản gốc (có/không/zenity/kdialog)", async () => {
    const stock = (await import(STOCK_PATH)) as { hasLinuxChooserBinary: (p: string | undefined, f: (c: string) => boolean) => boolean };
    const scan = (pathValue: string | undefined, hits: string[]) => (candidate: string) => hits.some((hit) => candidate.endsWith(hit));
    const cases: Array<[string | undefined, string[]]> = [
      ["/usr/bin:/bin", ["zenity"]],
      ["/usr/bin:/bin", ["kdialog"]],
      ["/usr/bin:/bin", []],
      [undefined, ["zenity"]],
      ["", ["zenity"]],
      ["", ["zenity"]],
    ];
    for (const [pathValue, hits] of cases) {
      expect(hasLinuxChooserBinary(pathValue, scan(pathValue, hits))).toBe(stock.hasLinuxChooserBinary(pathValue, scan(pathValue, hits)));
    }
    expect(hasLinuxChooserBinary("/usr/bin:/bin", scan("/usr/bin:/bin", ["zenity"]))).toBe(true);
    expect(hasLinuxChooserBinary("/usr/bin:/bin", scan("/usr/bin:/bin", ["zenity-helper"]))).toBe(false);
  });

  test("canExecute: tệp thật — thực thi được, không thực thi, và không tồn tại", async () => {
    const stock = (await import(STOCK_PATH)) as { canExecute: (c: string) => boolean };
    const dir = mkdtempSync(join(tmpdir(), "gbh-picker-"));
    const executable = join(dir, "zenity");
    const plain = join(dir, "not-executable");
    writeFileSync(executable, "");
    writeFileSync(plain, "");
    chmodSync(executable, 0o755);
    chmodSync(plain, 0o644);
    for (const candidate of [executable, plain, join(dir, "khong-ton-tai")]) {
      expect(canExecute(candidate)).toBe(stock.canExecute(candidate));
    }
    expect(canExecute(executable)).toBe(true);
    expect(canExecute(plain)).toBe(false);
    expect(canExecute(join(dir, "khong-ton-tai"))).toBe(false);
  });
});

describe("apply: mount cặp backend + bề mặt, rồi dọn sạch", () => {
  test("mount đúng thứ tự [backend, surface] và hàm dọn gỡ NGƯỢC thứ tự", async () => {
    const harness = fakeContext();
    await apply(harness.ctx);
    expect(harness.created).toEqual([BACKEND_PACKAGES.native, SURFACE_PACKAGES.native]);
    expect(harness.loaderSize()).toBe(2);
    expect(harness.disposers.length).toBe(1);
    await harness.disposers[0]?.();
    expect(harness.disposed).toEqual(["entry-2", "entry-1"]);
    expect(harness.removed).toEqual(["entry-2", "entry-1"]);
    expect(harness.loaderSize()).toBe(0);
  });

  test("SSH trong môi trường TIẾN TRÌNH (không có ảnh chụp launcher) ⇒ chọn cặp browse", async () => {
    const previous = process.env.SSH_TTY;
    process.env.SSH_TTY = "/dev/ttys003";
    try {
      const harness = fakeContext();
      await apply(harness.ctx);
      expect(harness.created).toEqual([BACKEND_PACKAGES.browse, SURFACE_PACKAGES.browse]);
      await harness.disposers[0]?.();
      expect(harness.loaderSize()).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.SSH_TTY;
      else process.env.SSH_TTY = previous;
    }
  });

  test("bind ngoài loopback ⇒ browse, và không mount cặp native", async () => {
    const harness = fakeContext({ host: "0.0.0.0" });
    await apply(harness.ctx);
    expect(harness.created).toEqual([BACKEND_PACKAGES.browse, SURFACE_PACKAGES.browse]);
  });

  test("entry thứ hai không có fiber ⇒ ném lỗi rõ ràng và ĐÃ dọn entry thứ nhất", async () => {
    const harness = fakeContext({ breakSecond: true });
    await expect(apply(harness.ctx)).rejects.toThrow("directory-picker-auto: failed to load");
    expect(harness.loaderSize()).toBe(0);
    expect(harness.disposed).toEqual(["entry-1"]);
    expect(harness.removed).toEqual(["entry-2", "entry-1"]);
  });

  test("thiếu seam loader ⇒ lỗi rõ ràng, không treo", async () => {
    const bare = { get: () => undefined, effect: async (callback: () => Promise<() => Promise<void>>) => void (await callback()) } as never;
    await expect(apply(bare)).rejects.toThrow("service loader chưa sẵn sàng");
  });
});
