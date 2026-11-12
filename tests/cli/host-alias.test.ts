/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test host alias cho symbol/identity (task-110): alias phải được áp ở lượt TOÀN CỤC sau khi mọi package
 *      mount xong (vòng peer của gói mount sau ghi đè cùng đường dẫn), và consumer resolve về artefact của ta.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Home tạm cho phép đo (appHome đọc GBH_HOME tại thời điểm gọi).
 * 20/10/2026 — REALPATH NGAY sau khi tạo: trên macOS `tmpdir()` trả `/var/…` trong khi Bun canonical hoá
 * đường đi qua symlink alias thành `/private/var/…`; hai chuỗi khác nhau cho CÙNG một tệp làm Bun nạp
 * module HAI lần ⇒ hai `Symbol("identity")` khác nhau khi tệp này chạy chung với tệp test khác. Đây là
 * sai số của PHÉP ĐO (đường dẫn), không phải lỗi logic: chuẩn hoá home để cả hai vế resolve cùng một tệp.
 */
const HOME = realpathSync(mkdtempSync(join(tmpdir(), "gbh-host-alias-")));
process.env.GBH_HOME = HOME;

/** Mount API thật của CLI (nạp SAU khi đặt GBH_HOME). */
// 21/10/2026 (Lead): ép qua unknown để TS không coi đây là conversion sai (namespace -> shape hẹp).
const mount = (await import("../../apps/cli/src/mount.ts")) as unknown as {
  applyHostAliases(results: readonly unknown[]): string[];
  profileModulesDir(): string;
};

/** Alias stock giả lập trong test. */
const STOCK_ALIAS = "@deepseek-ai/fake-stock-symbol";
/** Tên gói của TA (giả lập). */
const OUR_SPECIFIER = "@galaxy-blackhole/gbh-fake-symbol";

/** Dựng một thư mục gói tối thiểu. */
function makePackage(dir: string, name: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, main: "index.js" }));
  writeFileSync(join(dir, "index.js"), "export const SYMBOL = Symbol(\"identity\");" + String.fromCharCode(10));
  return dir;
}

beforeAll(() => {
  makePackage(join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-fake-symbol"), OUR_SPECIFIER);
  makePackage(join(HOME, "kernel-stock"), "kernel-stock");
  // Consumer đã mount trong profile — đo resolution từ CHÍNH góc nhìn của nó.
  makePackage(join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-consumer"), "gbh-consumer");
});

afterAll(() => {
  rmSync(HOME, { recursive: true, force: true });
});

describe("host alias cho symbol/identity — lượt TOÀN CỤC sau mount", () => {
  test("alias áp sau cùng thắng symlink peer tạo trước đó (đúng lỗi đã đo)", () => {
    const modules = mount.profileModulesDir();
    const aliasPath = join(modules, STOCK_ALIAS);
    mkdirSync(join(modules, "@deepseek-ai"), { recursive: true });
    // Mô phỏng vòng peer: gói mount TRƯỚC trỏ tên stock về kernel.
    writeFileSync(join(HOME, "kernel-stock", "index.js"), "export const SYMBOL = Symbol(\"stock\");" + String.fromCharCode(10));
    const { symlinkSync } = require("node:fs") as { symlinkSync: (target: string, path: string) => void };
    symlinkSync(join(HOME, "kernel-stock"), aliasPath);
    expect(realpathSync(aliasPath)).toBe(realpathSync(join(HOME, "kernel-stock")));
    // Lượt alias toàn cục (gọi SAU ensureRewriteMounts) phải thắng.
    const applied = mount.applyHostAliases([{ ok: true, specifier: OUR_SPECIFIER, dir: join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-fake-symbol"), row: { id: "fake-symbol", hostAliases: [STOCK_ALIAS] } }]);
    expect(applied.length).toBe(1);
    expect(realpathSync(aliasPath)).toBe(realpathSync(join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-fake-symbol")));
  });

  test("consumer trong profile resolve @deepseek-ai/fake-stock-symbol về artefact CỦA TA (không phải kernel)", () => {
    const consumer = join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-consumer", "package.json");
    const requireFromConsumer = createRequire(consumer);
    const resolved = realpathSync(requireFromConsumer.resolve(STOCK_ALIAS));
    expect(resolved).toBe(realpathSync(join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-fake-symbol") + "/index.js"));
  });

  test("symbol identity: import cùng một specifier từ hai phía cho CÙNG một Symbol", () => {
    const consumer = join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-consumer", "package.json");
    const requireFromConsumer = createRequire(consumer);
    const fromAlias = requireFromConsumer(STOCK_ALIAS) as { readonly SYMBOL: symbol };
    const fromOurs = requireFromConsumer(OUR_SPECIFIER) as { readonly SYMBOL: symbol };
    expect(fromAlias.SYMBOL).toBe(fromOurs.SYMBOL);
  });

  test("row không khai hostAliases ⇒ không tạo alias nào (fail-soft)", () => {
    const before = existsSync(join(mount.profileModulesDir(), "@deepseek-ai", "fake-stock-symbol"));
    const applied = mount.applyHostAliases([{ ok: true, specifier: OUR_SPECIFIER, dir: join(mount.profileModulesDir(), "@galaxy-blackhole", "gbh-fake-symbol"), row: { id: "fake-symbol" } }]);
    expect(applied).toEqual([]);
    expect(existsSync(join(mount.profileModulesDir(), "@deepseek-ai", "fake-stock-symbol"))).toBe(before);
  });
});