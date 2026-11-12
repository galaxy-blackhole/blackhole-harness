/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build package session-reference ve lib/: entry service (src/index.ts) -> lib/index.js va HAI manifest
 *      typert generated (src/typert-host.ts -> lib/typert.host.js, src/typert-remote-client.ts ->
 *      lib/typert.remote-client.js), giu entry worker neu co — ESM, target node, dep giu external;
 *      ban build CHI nam trong profile cua app.
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build MOT entry thanh mot file ESM duy nhat trong outDir.
 * Nhan: entry — duong dan tuyet doi cua file nguon; outDir — thu muc dich; naming — ten file dau ra.
 * Tra: duong dan file da build.
 */
async function buildEntry(entry: string, outDir: string, naming: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: "node",
    format: "esm",
    naming,
    packages: "external",
  });
  if (!result.success) throw new Error("build that bai (" + naming + "): " + result.logs.map((log) => String(log)).join(" | "));
  return join(outDir, naming);
}

/**
 * Ket qua buildPackage: duong dan tuyet doi cua tung entry da build.
 * Truong worker chi co khi goi co src/worker.ts (goi nay khong co).
 */
export interface BuiltEntries {
  service: string;
  typertHost: string;
  typertRemoteClient: string;
  worker?: string;
}

/**
 * Build CA cac entry cua goi (service + hai manifest typert + worker neu co) vao cung mot thu muc dich.
 * Nhan: outDir — thu muc dich (mac dinh: lib canh package); thu muc duoc DON mot lan truoc khi build.
 * Tra: object duong dan tung entry — service (lib/index.js), typertHost (lib/typert.host.js),
 *      typertRemoteClient (lib/typert.remote-client.js), worker (lib/worker.js) khi co.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const service = await buildEntry(join(import.meta.dir, "src", "index.ts"), out, "index.js");
  const typertHost = await buildEntry(join(import.meta.dir, "src", "typert-host.ts"), out, "typert.host.js");
  const typertRemoteClient = await buildEntry(join(import.meta.dir, "src", "typert-remote-client.ts"), out, "typert.remote-client.js");
  const built: BuiltEntries = { service, typertHost, typertRemoteClient };
  const workerEntry = join(import.meta.dir, "src", "worker.ts");
  if (existsSync(workerEntry)) built.worker = await buildEntry(workerEntry, out, "worker.js");
  return built;
}

if (import.meta.main) {
  const target = process.argv[2];
  const built = await buildPackage(target);
  console.log("built " + built.service);
  console.log("built " + built.typertHost);
  console.log("built " + built.typertRemoteClient);
  if (built.worker !== undefined) console.log("built " + built.worker);
}
