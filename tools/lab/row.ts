/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dung phong LAB cach ly cho MOT row: home tam + overlay + cong rieng + HOST LOG (<home>/host.log), KHONG dung app that
 */

import { spawn } from "node:child_process";
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ensureProfile } from "../../apps/cli/src/profile.ts";
import { acquireLabLock, releaseLabLock } from "../check/lab-lock.ts";
import { hostChildEnv, resolveLaunch } from "../../apps/cli/src/host.ts";
import { rewritePackages } from "../../apps/cli/src/mount.ts";
import { repoRoot } from "../../apps/cli/src/paths.ts";

/** Ket qua mot lan dung lab. */
interface LabResult {
  /** Home cach ly cua lab. */
  home: string;
  /** Cong lab dang nghe. */
  port: number;
  /** URL co token de mo. */
  url: string;
}

/**
 * Doc `gbh.row` cua mot package trong repo.
 * @param rowId - ten thu muc row (vi du `ui-goal`).
 * @returns thu muc package va metadata `gbh.row`, hoac null neu khong co.
 */
function findRow(rowId: string): { dir: string; id: string; insertAs: string; name: string } | null {
  for (const half of ["client", "host"]) {
    const dir = join(repoRoot(), "packages", half, rowId);
    const pkg = join(dir, "package.json");
    if (!existsSync(pkg)) continue;
    const json = JSON.parse(readFileSync(pkg, "utf8")) as {
      name: string;
      gbh?: { row?: { id?: string; insertAs?: string }; row_unmounted_ly_do?: { row?: { id?: string; insertAs?: string } } };
    };
    // 19/10/2026 (task-48): row ĐANG PARK vẫn phải lab được — công thức chuẩn của Lead là "lab TRƯỚC,
    // khai gbh.row SAU". boot-smoke đã đọc gbh.row_unmounted_ly_do từ trước; lab thiếu nhánh này nên
    // không đo được gói đang park. Không đổi hành vi row đã khai (ưu tiên gbh.row như cũ).
    const row = json.gbh?.row ?? json.gbh?.row_unmounted_ly_do?.row;
    if (row?.id === undefined) return null;
    return { dir, id: row.id, insertAs: row.insertAs ?? row.id, name: json.name };
  }
  return null;
}

/**
 * Build package roi copy ban build vao `profiles/node_modules` cua home lab (DUNG TEN PACKAGE).
 * @param dir - thu muc package trong repo.
 * @param name - ten package (phai khop ten thu muc trong node_modules).
 * @param home - home cua lab.
 * @returns duong dan thu muc da copy.
 */
async function stagePackage(dir: string, name: string, home: string): Promise<string> {
  const out = join(home, "build-out");
  const build = join(dir, "build.ts");
  if (!existsSync(build)) throw new Error("khong thay build.ts trong " + dir);
  const mod = (await import(build)) as { buildPackage?: (o: string) => Promise<void> };
  if (mod.buildPackage === undefined) throw new Error("build.ts khong export buildPackage");
  await mod.buildPackage(out);
  const target = join(home, "profiles", "node_modules", name);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(join(dir, "package.json"), join(target, "package.json"));
  cpSync(out, join(target, "lib"), { recursive: true });
  return target;
}

/**
 * Dung lab cho mot row: overlay tat row stock + chen row cua ta, boot harness o cong rieng.
 * @param rowId - ten thu muc row trong packages/<half>/.
 * @returns ket qua lab, hoac null neu khong dung duoc.
 */
export async function runLab(rowId: string): Promise<LabResult | null> {
  const found = findRow(rowId);
  if (found === null) {
    console.error("row " + rowId + " chua khai gbh.row (hoac khong ton tai) — lab can metadata do de biet row nao bi thay.");
    return null;
  }
  // KHOA TOAN CUC (18/10/2026): giu tu luc xoa home toi luc URL san sang. Hai luot cung row chay song
  //   song tung lam "EEXIST: file already exists, symlink .../@deepseek-ai/cordis" => lab khong boot
  //   duoc (loi cua PHEP DO, khong phai cua goi). Xem tools/check/lab-lock.ts.
  acquireLabLock();
  // 18/10/2026: TEE stdout/stderr cua host child vao <home>/host.log. Vi sao: loi "did not activate" cua
  //   entry NUA HOST chi hien trong log host; truoc day lab nuot stdout nen probe phia trang bao DAT oan
  //   (trang van render, console 0 loi — 3 entry config-editor/pwsh-sandbox/documentpreview la ca that).
  //   accept-row/lab-evidence doc file nay de dem did-not-activate phia HOST.
  let hostLogFd: number | null = null;
  try {
  const home = join("/tmp", "gbh-lab-" + rowId);
  rmSync(home, { recursive: true, force: true });
  mkdirSync(home, { recursive: true });
  hostLogFd = openSync(join(home, "host.log"), "w");
  process.env.GBH_HOME = home;
  process.env.DSH_HOME = undefined;
  ensureProfile();
  const target = await stagePackage(found.dir, found.name, home);
  // 18/10/2026: CHI chen overlay khi patch cua repo CHUA thay row nay.
  //   Ca that (do boi cong nhan product-analytics): profiles/blackhole/app.patch.yml DA co khoi
  //   `- id: <row> / disabled: true` + `- insert: <row>-ours` (sinh tu metadata gbh.row), nhung lab lai
  //   chen THEM mot entry cung row ⇒ host nap nua host cua ta HAI LAN ⇒
  //   `Error: service "<ten>" has been registered` ⇒ 1 dong `did not activate` ⇒ BAO DO OAN cho goi.
  //   Day la loi cua PHEP DO, khong phai cua goi: boot lai voi `extraPatches: []` cho 0 dong.
  const repoPatch = join(repoRoot(), "profiles", "blackhole", "app.patch.yml");
  const patchText = existsSync(repoPatch) ? readFileSync(repoPatch, "utf8") : "";
  const daThayRow = patchText.includes("- id: " + found.id) && patchText.includes("- id: " + found.insertAs);
  const overlay = join(home, "overlay.patch.yml");
  const extraPatches: string[] = [];
  if (daThayRow) {
    console.log("[lab] patch cua repo DA thay row " + found.id + ": khong chen overlay (tranh nap hai lan)");
  } else {
    writeFileSync(overlay, ["- id: " + found.id, "  disabled: true", "- insert:", "    - id: " + found.insertAs, "      name: '" + found.name + "'", ""].join("\n"));
    extraPatches.push(overlay);
  }
  // Tu tim cong trong: nhieu nguoi co the dung lab cung luc, va cong bi chiem lam lab boot that bai
  // voi thong bao rong (da xay ra 17/10/2026). Thu 5460..5479.
  let port = 0;
  for (let p = 5460; p < 5480; p += 1) {
    const probe = Bun.spawnSync(["lsof", "-ti", "tcp:" + String(p)]);
    if (probe.stdout.toString().trim() === "") { port = p; break; }
  }
  if (port === 0) {
    console.error("het cong trong 5460..5479 — don lab cu roi thu lai");
    return null;
  }
  /**
 * Ap host alias (ADR 0010) cho DUNG home cua lab: symlink `<home>/profiles/node_modules/<ten stock>` -> goi cua ta.
 * @param home - thu muc home cach ly cua lab.
 * @returns danh sach alias da ap.
 */
function applyAliasesForHome(home: string): string[] {
  const applied: string[] = [];
  for (const pkg of rewritePackages()) {
    const aliases = (pkg.row as { hostAliases?: readonly string[] } | undefined)?.hostAliases ?? [];
    if (aliases.length === 0) continue;
    const ours = join(home, "profiles", "node_modules", pkg.specifier);
    if (!existsSync(ours)) continue;
    for (const alias of aliases) {
      const link = join(home, "profiles", "node_modules", alias);
      try {
        mkdirSync(dirname(link), { recursive: true });
        rmSync(link, { recursive: true, force: true });
        symlinkSync(ours, link, "dir");
        applied.push(alias);
      } catch (error) {
        console.warn("[lab] khong tao duoc host alias " + alias + ": " + String(error));
      }
    }
  }
  if (applied.length > 0) console.log("[lab] host alias: " + applied.join(", "));
  return applied;
}
  const launch = resolveLaunch({ port, openBrowser: false, profile: "blackhole", extraPatches } as never);
  // ⚠️ 19/10/2026 — LOI THAT (row `tools`): `resolveLaunch` KHONG ap host alias khi home la lab (alias ap o
  //   `applyAliasesBeforeBoot()` chi duoc goi trong host.ts cho boot that) ⇒ stock `tools` van song song
  //   ⇒ "service "tools" has been registered at <ToolRuntime>" va agent-preset mat tool. Phai ap alias cho
  //   DUNG home cua lab, ngay truoc khi spawn harness.
  applyAliasesForHome(home);
  // `hostChildEnv` la ham chuan cua CLI (no dat DSH_HOME/GBH_HOME cho tien trinh con); o day ta ep ca hai ve home lab.
  // 18/10/2026 (lan 2): cho host child ghi TRUC TIEP vao <home>/host.log (stdio = fd cua file) thay vi
  //   pipe roi tee trong tien trinh cha. Ly do do duoc: lab exit ngay khi thay URL nen pipe dong lai va
  //   MAT cac dong "did not activate" in SAU "ready" — do la ly do 3 loi entry nua HOST khong hien ra.
  //   Doc URL bang cach POLL file log (host in URL ra do roi).
  const spawnFd = hostLogFd;
  if (spawnFd === null) throw new Error("khong mo duoc host.log");
  const child = spawn(launch.node, launch.args, {
    cwd: repoRoot(),
    env: { ...hostChildEnv(home), DSH_HOME: home, GBH_HOME: home },
    stdio: ["ignore", spawnFd, spawnFd],
  });
  closeSync(spawnFd);
  hostLogFd = null; // child da giu fd rieng; dong o day de finally khong dong lan hai
  let buffer = "";
  const url = await new Promise<string>((resolve) => {
    const deadline = Date.now() + 90_000;
    let exited = false;
    child.on("exit", () => { exited = true; });
    const tick = (): void => {
      try {
        buffer = readFileSync(join(home, "host.log"), "utf8").slice(-16384);
      } catch {
        buffer = "";
      }
      const m = /http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/.exec(buffer);
      if (m !== null) { resolve(m[0]); return; }
      if (exited || Date.now() >= deadline) { resolve(""); return; }
      setTimeout(tick, 200);
    };
    tick();
  });
  if (url === "") {
    console.error("lab khong boot duoc. 500 ky tu cuoi cua host.log:");
    console.error(buffer.slice(-500));
    return null;
  }
  // Cho them 1,5s de host in cac dong "did not activate" SAU "ready" vao file (khong co thi khong sao).
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  writeFileSync(join(home, "ready-url.txt"), url);
  console.log("LAB SAN SANG");
  console.log("  home  : " + home);
  console.log("  goi   : " + found.name + "  (thay row " + found.id + " -> " + found.insertAs + ")");
  console.log("  da copy: " + target);
  console.log("  URL   : " + url);
  console.log("  log host: " + join(home, "host.log"));
  console.log("  don dep: kill $(lsof -ti tcp:" + port + ") ; rm -rf " + home);
  return { home, port, url };
  } finally {
    if (hostLogFd !== null) closeSync(hostLogFd);
    releaseLabLock();
  }
}

if (import.meta.main) {
  const rowId = process.argv[2];
  if (rowId === undefined) {
    console.log("Dung: bun run lab:row <row-id>   vi du: bun run lab:row ui-goal");
    process.exit(2);
  }
  const r = await runLab(rowId);
  process.exit(r === null ? 1 : 0);
}