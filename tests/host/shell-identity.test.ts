/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test lop vo L3 (shell-identity): 3 route asset GBH + tapIndex title, kiem HTTP THAT va bytes/sha256
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";

import {
  apply,
  STOCK_TITLE_TAG,
  FAVICON_DARK_PATH,
  FAVICON_PATH,
  faviconMatchesSource,
  GBH_FAVICON_SHA256,
  GBH_FAVICON_SVG,
  GBH_MANIFEST_JSON,
  GBH_TITLE_TAG,
  inject,
  MANIFEST_PATH,
  name,
  respondRoute,
  SHELL_ROUTES,
  tapIndexTitle,
  type ShellIdentityContext,
  type WebServerLike,
} from "../../packages/host/shell-identity/src/index.ts";

/** Thu muc goc repo. */
const REPO_ROOT = join(import.meta.dir, "..", "..");
/** Thu muc goi cua ta. */
const OURS = join(REPO_ROOT, "packages", "host", "shell-identity");
/** sha256 cua asset thuong hieu trong goi ui-primitives (nguon doi chieu N4). */
const PRIMITIVES_FAVICON = join(REPO_ROOT, "packages", "client", "ui-primitives", "assets", "gbh-favicon.svg");

/**
 * Gọi MỘT route bằng node:http thay cho `fetch` toàn cục.
 * Vì sao: khi chạy CẢ bộ test trong một tiến trình, tệp khác có thể đã vá `globalThis.fetch`
 * (stub carrier/worker) mà không khôi phục ⇒ ca HTTP thật này đọc nhầm dữ liệu giả.
 * Nhận: origin — gốc http://127.0.0.1:port; path — đường dẫn; method — phương thức.
 * Trả: mã trạng thái · header · thân dạng Buffer.
 */
function request(origin: string, path: string, method = "GET"): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, origin);
    const req = httpRequest(url, { method }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Tinh sha256 cua mot chuoi/buffer.
 * Nhận: value — chuoi hoac buffer.
 * Trả: hex sha256.
 */
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Route da dang ky trong webServer gia. */
interface RegisteredRoute {
  /** Kind (lop vo chi dung exact). */
  kind: string;
  /** Pathname. */
  path: string;
  /** Handler cua route. */
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

/**
 * webServer gia ghi lai route + tap, va cho phep go (dispose) de kiem vong doi.
 * Nhận: khong.
 * Trả: doi tuong webServer + mang route + so lan dispose.
 */
function fakeWebServer(): { webServer: WebServerLike; routes: RegisteredRoute[]; taps: ((html: string) => string)[]; disposed: () => number } {
  const routes: RegisteredRoute[] = [];
  const taps: ((html: string) => string)[] = [];
  let disposed = 0;
  return {
    routes,
    taps,
    disposed: () => disposed,
    webServer: {
      register: (route) => {
        routes.push(route as RegisteredRoute);
        return () => {
          disposed += 1;
        };
      },
      tapIndex: (transform) => {
        taps.push(transform);
        return () => {
          disposed += 1;
        };
      },
    },
  };
}

/**
 * Context gia voi webServer cho truoc (hoac khong co).
 * Nhận: webServer — seam can cap (undefined de kiem duong thieu seam).
 * Trả: context gia + so lan effect duoc dang ky.
 */
function fakeContext(webServer: WebServerLike | undefined): { ctx: ShellIdentityContext; effects: number; errors: string[] } {
  const errors: string[] = [];
  const state = { effects: 0 };
  return {
    errors,
    get effects() {
      return state.effects;
    },
    ctx: {
      get: (service: string) => (service === "webServer" ? webServer : undefined),
      effect: () => {
        state.effects += 1;
      },
      logger: { info: () => undefined, error: (message: string) => errors.push(message) },
    } as ShellIdentityContext,
  };
}

describe("shell-identity — metadata + artifact", () => {
  test("khai gbh.row id moi, co test + rollback; KHONG cham bootstrap/module-loader", () => {
    const meta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      name: string;
      gbh: { row: { id: string; insertAs: string; disabled: boolean; tests: string[] }; rollback: { cachGo: string } };
    };
    expect(meta.name).toBe("@galaxy-blackhole/gbh-host-shell-identity");
    expect(meta.gbh.row.id).toBe("shell-identity");
    expect(meta.gbh.row.insertAs).toBe("shell-identity");
    expect(meta.gbh.row.disabled).toBe(false);
    expect(meta.gbh.row.tests).toEqual(["tests/host/shell-identity.test.ts"]);
    expect(meta.gbh.rollback.cachGo.length).toBeGreaterThan(20);
    const artifact = readFileSync(join(OURS, "lib", "index.js"), "utf8");
    // Lop vo KHONG duoc cham tang nap/bootstrap.
    expect(artifact).not.toContain("__ModuleLoader__");
    expect(artifact).not.toContain("staticModules");
    expect(artifact).not.toContain("__DSH_BOOT__");
    expect(name).toBe("shell-identity");
    expect(inject).toEqual(["webServer"]);
  });

  test("asset nhung la asset thuong hieu GBH: sha256 khop nguon ui-primitives", () => {
    expect(sha256(GBH_FAVICON_SVG)).toBe(GBH_FAVICON_SHA256);
    expect(faviconMatchesSource()).toBe(true);
    expect(sha256(readFileSync(PRIMITIVES_FAVICON))).toBe(GBH_FAVICON_SHA256);
    expect(GBH_FAVICON_SVG).not.toContain("M22.9168");
    expect(GBH_MANIFEST_JSON).not.toContain("DeepSeek");
    expect(GBH_MANIFEST_JSON).not.toContain("DSH");
  });
});

describe("shell-identity — dang ky route + tap", () => {
  test("apply dang ky DUNG 3 route exact + 2 tap (title + deep-link), va dispose het khi go", () => {
    const fake = fakeWebServer();
    const environment = fakeContext(fake.webServer);
    apply(environment.ctx);
    expect(fake.routes.map((route) => [route.kind, route.path])).toEqual([
      ["exact", FAVICON_PATH],
      ["exact", FAVICON_DARK_PATH],
      ["exact", MANIFEST_PATH],
    ]);
    // 27/10/2026: tap thu hai la deep-link ?session= (xem tests/host/shell-identity-deep-link.test.ts).
    expect(fake.taps.length).toBe(2);
    expect(environment.effects).toBe(1);
    expect(fake.disposed()).toBe(0);
  });

  test("thieu seam webServer: bao loi roi thoat, KHONG nem (app van chay)", () => {
    const { ctx, errors } = fakeContext(undefined);
    expect(() => apply(ctx)).not.toThrow();
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("webServer");
  });

  test("tapIndex CHI doi <title>; goi hai lan van cung ket qua (idempotent)", () => {
    const html = '<html><head>' + STOCK_TITLE_TAG + '<script>globalThis["__DSH_BOOT__"] = {"rev":"x"}</script></head><body><div id="root"></div></body></html>';
    const once = tapIndexTitle(html);
    expect(once).toContain(GBH_TITLE_TAG);
    expect(once).not.toContain("DeepSeek Harness");
    // Moi byte khac title giu nguyen (khong cham khoi boot).
    expect(once.replace(GBH_TITLE_TAG, STOCK_TITLE_TAG)).toBe(html);
    expect(tapIndexTitle(once)).toBe(once);
    expect(once).toContain('globalThis["__DSH_BOOT__"]');
  });
});

describe("shell-identity — HTTP THAT (bytes + title)", () => {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const asset = SHELL_ROUTES.find((route) => route.path === pathname);
    if (asset === undefined) {
      res.writeHead(404);
      res.end();
      return;
    }
    respondRoute(asset, req, res);
  });
  const listening = new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve("http://127.0.0.1:" + String(typeof address === "object" && address !== null ? address.port : 0));
    });
  });
  afterAll(() => {
    server.close();
  });

  test("GET 3 route: favicon tra dung sha256 GBH + manifest GBH; method khac 405", async () => {
    const origin = await listening;
    for (const path of [FAVICON_PATH, FAVICON_DARK_PATH]) {
      const response = await request(origin, path);
      expect(response.status).toBe(200);
      expect(String(response.headers["content-type"])).toContain("image/svg+xml");
      expect(String(response.headers["cache-control"])).toBe("no-cache");
      expect(sha256(response.body)).toBe(GBH_FAVICON_SHA256);
    }
    const manifest = await request(origin, MANIFEST_PATH);
    expect(manifest.status).toBe(200);
    const parsed = JSON.parse(manifest.body.toString("utf8")) as { name: string; short_name: string };
    expect(parsed.name).toBe("Galaxy Blackhole");
    expect(parsed.short_name).toBe("GBH");
    const rejected = await request(origin, FAVICON_PATH, "POST");
    expect(rejected.status).toBe(405);
    expect(String(rejected.headers["allow"])).toBe("GET, HEAD");
  });
});
