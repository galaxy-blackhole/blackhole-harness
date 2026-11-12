/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test ALIAS RESOLUTION của runtime value import: sau khi mount, `@deepseek-ai/dsh-session` phải resolve
 *      về artefact CỦA TA (không phải stock) — kiểm từ chính gói consumer (session-reference) trong profile.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Home của app. */
const HOME = process.env.HOME ?? "";
/** Thư mục node_modules của profile. */
const PROFILE_MODULES = join(HOME, ".galaxy", "blackhole", "profiles", "node_modules");
/** Bản kernel (stock) mà profile trỏ tới. */
const KERNEL_PACKAGE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-session");
/** Package của TA trong profile. */
const OUR_PACKAGE = join(PROFILE_MODULES, "@galaxy-blackhole", "gbh-session");


/** Gói ta đã mount vào profile chưa. */
const mounted = existsSync(OUR_PACKAGE);

describe("session — alias resolution cho runtime value import", () => {
  test("package.json khai row PARKED đúng quy ước khi CHƯA mount", () => {
    const manifest = JSON.parse(readFileSync(join(REPO, "packages", "host", "session", "package.json"), "utf8")) as {
      readonly gbh: { readonly row?: unknown; readonly row_unmounted_ly_do?: { readonly ly_do?: string; readonly row?: { readonly id?: string } } };
    };
    if (mounted) {
      expect(manifest.gbh.row).toBeDefined();
      return;
    }
    expect(manifest.gbh.row).toBeUndefined();
    expect(manifest.gbh.row_unmounted_ly_do?.row?.id).toBe("session");
    expect(manifest.gbh.row_unmounted_ly_do?.ly_do?.length ?? 0).toBeGreaterThan(0);
  });

  test.skipIf(!mounted)("ĐÃ mount: @deepseek-ai/dsh-session trong profile trỏ artefact CỦA TA (host alias toàn cục)", () => {
    const resolved = realpathSync(join(PROFILE_MODULES, "@deepseek-ai", "dsh-session"));
    // 08/11/2026 (Lead): `realpathSync` phân giải HẾT chuỗi symlink ⇒ kết quả là thư mục NGUỒN trong repo
    //   (`packages/host/session`), KHÔNG chứa chuỗi "gbh-session" như pin cũ ⇒ pin cũ đỏ oan dù alias đúng.
    //   Bất biến thật: đích phân giải phải TRÙNG đích phân giải của gói TA trong profile.
    expect(resolved).toBe(realpathSync(OUR_PACKAGE));
    expect(resolved).not.toBe(realpathSync(KERNEL_PACKAGE));
  });

  test("cơ chế host alias áp ở lượt TOÀN CỤC sau mount (ADR 0010)", () => {
    const source = readFileSync(join(REPO, "apps", "cli", "src", "mount.ts"), "utf8");
    expect(source.includes("applyHostAliases")).toBe(true);
    const body = source.slice(source.indexOf("export function ensureRewriteMounts"));
    expect(body.includes("applyHostAliases(results)")).toBe(true);
    expect(body.indexOf("applyHostAliases(results)")).toBeGreaterThan(body.indexOf("const results = rewritePackages()"));
    expect(source.includes("applyAliasesBeforeBoot")).toBe(true);
  });

  test("0 instance-of Session/SessionStore trong src/ của mọi package ta", () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (!existsSync(path)) continue;
        if (statSync(path).isDirectory()) walk(path);
        else if (entry.endsWith(".ts")) {
          const source = readFileSync(path, "utf8");
          if (/instanceof\\s+Session\\b/.test(source)) offenders.push(path);
        }
      }
    };
    for (const org of readdirSync(join(REPO, "packages"))) {
      const orgDir = join(REPO, "packages", org);
      if (!statSync(orgDir).isDirectory()) continue;
      for (const name of readdirSync(orgDir)) {
        const src = join(orgDir, name, "src");
        if (existsSync(src)) walk(src);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("A/B hành vi TRÙNG nhau giữa hai bản cùng tên: brand + tập event + version + foldSurface", () => {
    const stock = require(join(KERNEL_PACKAGE, "lib", "index.js")) as {
      SessionId: (value: string) => string;
      SessionSeq: (value: number) => number;
      SESSION_FORMAT_VERSION: number;
      KNOWN_SESSION_EVENT_TYPES: ReadonlySet<string>;
      foldSurface: (events: readonly unknown[]) => unknown;
    };
    const ours = require(join(REPO, "packages", "host", "session", "lib", "index.js")) as typeof stock;
    expect(ours.SessionId("session-x")).toBe(stock.SessionId("session-x"));
    expect(ours.SessionSeq(7)).toBe(stock.SessionSeq(7));
    expect(ours.SESSION_FORMAT_VERSION).toBe(stock.SESSION_FORMAT_VERSION);
    expect([...ours.KNOWN_SESSION_EVENT_TYPES]).toEqual([...stock.KNOWN_SESSION_EVENT_TYPES]);
    expect(JSON.stringify(ours.foldSurface([]))).toBe(JSON.stringify(stock.foldSurface([])));
  });
});