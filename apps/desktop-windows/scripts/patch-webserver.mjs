/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/11/2026
 * desc Vá host-webserver Windows: nếu thiếu fallback UI (web-app không mount), tự phục vụ
 *      @deepseek-ai/dsh-web-frontend/dist qua connection.authorizeIndex; chỉ áp cho app Windows đóng gói.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const host = process.argv[2];
if (!host) throw new Error("usage: node patch-webserver.mjs <host-dir>");

const candidates = [
  join(host, "packages", "host", "host-webserver", "lib", "index.js"),
  join(host, "node_modules", "@galaxy-blackhole", "gbh-host-webserver", "lib", "index.js"),
  join(host, "node_modules", "@deepseek-ai", "dsh-host-webserver", "lib", "index.js"),
];

const marker = "GBH_STATIC_FALLBACK";
const injection = `
        // GBH_STATIC_FALLBACK: phục vụ UI trước khi route "/" kịp trả 404.
        if (req.method === "GET" || req.method === "HEAD") {
          try {
            const parsed = new URL(req.url ?? "/", "http://x");
            const pathname = decodeURIComponent(parsed.pathname);
            const isUi = pathname === "/" || pathname.startsWith("/assets/") || /^\/(favicon|manifest|icon)/u.test(pathname);
            const hasAuthCookie = String(req.headers.cookie ?? "").includes("dsh-auth-");
            console.error("[gbh] ui intercept path=" + pathname + " ui=" + String(isUi) + " cookie=" + String(hasAuthCookie) + " url=" + String(req.url));
            if (isUi && hasAuthCookie && !parsed.searchParams.has("token")) {
              const { createRequire } = await import("node:module");
              const { readFileSync, existsSync } = await import("node:fs");
              const { dirname, extname, join } = await import("node:path");
              const require = createRequire(import.meta.url);
              const candidates = [];
              if (process.env.GBH_FRONTEND_DIST) candidates.push(process.env.GBH_FRONTEND_DIST);
              candidates.push(join(process.cwd(), "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist"));
              try { candidates.push(join(dirname(require.resolve("@deepseek-ai/dsh-web-frontend/package.json")), "dist")); } catch {}
              const dist = candidates.find((p) => existsSync(join(p, "index.html")));
              if (dist === void 0) { console.error("[gbh] frontend dist not found in: " + candidates.join(" | ")); res.writeHead(404); res.end(); return; }
              const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//u, "");
              const target = join(dist, rel);
              if (!existsSync(target)) { res.writeHead(404); res.end(); return; }
              const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json" };
              let body = readFileSync(target);
              if (rel === "index.html") body = typeof this.renderIndex === "function" ? this.renderIndex(body.toString("utf8")) : body;
              res.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream" });
              res.end(body);
              return;
            }
          } catch (error) {
            console.error("[gbh] static fallback:", error instanceof Error ? error.message : String(error));
          }
        }
`;

let patched = 0;
for (const file of candidates) {
  if (!existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  if (source.includes(marker)) continue;
  const old = `\t\t\tconst route = this.match(rawPath);`;
  if (!source.includes(old)) {
    console.warn("[gbh] route pattern not found in " + file);
    continue;
  }
  const next = source.replace(old, `${injection}\t\t\tconst route = this.match(rawPath);`);
  writeFileSync(file, next, "utf8");
  patched += 1;
  console.log("[gbh] patched static fallback: " + file);
}
if (patched === 0) throw new Error("no host-webserver file patched");
