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
        // ${marker}: app Windows không có web-app fallback trong một số bản npm.
        if (fallback === void 0 && (req.method === "GET" || req.method === "HEAD")) {
          try {
            const { createRequire } = await import("node:module");
            const { readFileSync, existsSync } = await import("node:fs");
            const { dirname, extname, join } = await import("node:path");
            const require = createRequire(import.meta.url);
            const dist = join(dirname(require.resolve("@deepseek-ai/dsh-web-frontend/package.json")), "dist");
            const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
            const rel = pathname === "/" ? "index.html" : pathname.replace(/^\\//u, "");
            const target = join(dist, rel);
            if (!target.startsWith(dist)) { res.writeHead(403); res.end(); return; }
            const conn = this.ctx.get("connection");
            if (conn !== void 0 && !conn.authorizeIndex(req, res)) return;
            if (!existsSync(target)) { res.writeHead(404); res.end(); return; }
            const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json" };
            let body = readFileSync(target);
            if (rel === "index.html") body = this.renderIndex(body.toString("utf8"));
            res.writeHead(200, { "content-type": MIME[extname(target)] ?? "application/octet-stream" });
            res.end(body);
            return;
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
  const old = `\t\t\tconst fallback = this.fallback;
\t\t\tif (fallback === void 0) {
\t\t\t\tres.writeHead(404);
\t\t\t\tres.end();
\t\t\t\treturn;
\t\t\t}`;
  if (!source.includes(old)) {
    console.warn("[gbh] fallback pattern not found in " + file);
    continue;
  }
  const next = source.replace(old, `\t\t\tconst fallback = this.fallback;${injection}`);
  writeFileSync(file, next, "utf8");
  patched += 1;
  console.log("[gbh] patched static fallback: " + file);
}
if (patched === 0) throw new Error("no host-webserver file patched");
