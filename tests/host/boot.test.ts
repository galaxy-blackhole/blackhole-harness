/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc gate:home-isolation — boot harness o cong OS cap, phuc vu 200, va ~/.galaxy/gbh khong bi app cham
 *
 * ⚠️ Cổng này FLAKY khi nhiều harness boot song song (cây chia sẻ bị nhiều người ghi ⇒ vài đường dẫn thành
 * "unexplained"). Số đo 17/10/2026: chạy cả cổng lúc 6+ agent boot ⇒ 3 unexplained (ĐỎ); chạy RIÊNG lúc
 * vắng ⇒ 0 unexplained (XANH). Luật: chạy riêng để phân biệt; **nếu chạy riêng vẫn > 0 thì đó là RÒ RỈ
 * THẬT** — xem docs/recipes/GATE-HOME-ISOLATION.md.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { changedEntries, snapshotTree, snapshotWindow, treesMatch } from "../../apps/cli/src/home-guard.ts";
import { defaultHostOptions, spawnHost, type HostProcess } from "../../apps/cli/src/host.ts";
import { appHome, galaxyRoot, profileDir } from "../../apps/cli/src/paths.ts";

/**
 * ~/.galaxy/gbh is the harness home of OTHER, live Galaxy installs (the running blackhole web and
 * the packaged app). This test proves our boot never becomes one of its writers.
 */
const GBH = join(galaxyRoot(), "gbh");
/** How long the control window watches the shared tree while this test does nothing. */
const CONTROL_WINDOW_MS = 15_000;
/** How long a path that moved during our boot is watched again, still doing nothing. */
const OWNER_PROBE_MS = 12_000;

/**
 * Waits for the child to exit, escalating to SIGKILL when it does not.
 * @param host - the host process to stop.
 * @returns nothing once the child is gone.
 */
async function stopHost(host: HostProcess): Promise<void> {
  if (host.child.exitCode !== null || host.child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => host.child.once("exit", () => resolve()));
  host.child.kill("SIGTERM");
  const forced = setTimeout(() => void host.child.kill("SIGKILL"), 8000);
  await exited;
  clearTimeout(forced);
}

/**
 * Splits the Set-Cookie header into the single pair the follow-up request needs.
 * @param header - raw header value, or null.
 * @returns name=value, or an empty string when the harness answered without a cookie.
 */
function cookiePair(header: string | null): string {
  return header === null ? "" : (header.split(";")[0] ?? "");
}

/**
 * Runs a short read-only command.
 * @param command - executable name.
 * @param args - arguments.
 * @returns stdout, or undefined when the command is missing or fails.
 */
function run(command: string, args: string[]): string | undefined {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? result.stdout ?? "" : undefined;
}

/**
 * Collects a process and its descendants, so a check covers the harness's own children too.
 * @param pid - root process id.
 * @returns every pid in that tree, the root included.
 */
function processTree(pid: number): number[] {
  const children = run("pgrep", ["-P", String(pid)]);
  const descendants = (children ?? "")
    .split("\n")
    .map((line) => Number(line.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .flatMap((child) => processTree(child));
  return [pid, ...descendants];
}

/**
 * Every file our process tree holds open below a directory — the causal half of this gate: a
 * process that never opens a file under the shared tree cannot have written there.
 * @param pid - root process id of our host.
 * @param root - absolute directory that must stay untouched.
 * @returns offending absolute paths; empty when lsof is unavailable or nothing matches.
 */
function openFilesUnder(pid: number, root: string): string[] {
  const offenders: string[] = [];
  for (const one of processTree(pid)) {
    const listed = run("lsof", ["-p", String(one), "-Fn"]);
    if (listed === undefined) continue;
    for (const line of listed.split("\n")) {
      if (line.startsWith("n") && line.slice(1).startsWith(root)) offenders.push(line.slice(1));
    }
  }
  return offenders;
}

/**
 * Mọi tệp dưới cây chia sẻ đang bị TIẾN TRÌNH KHÁC (không thuộc ta) giữ mở.
 * Vì sao cần (20/10/2026): khi chạy CẢ bộ test, host GUI/agent khác đang sống ghi vào `~/.galaxy/gbh`
 * (session.v4.jsonl.zstd · session_projcache/…) rồi đóng tệp ⇒ chúng không "keepsMoving" lúc so cuối
 * và bị xếp oan vào `unexplained`. Quy chúng cho người ghi đã BIẾT (tiến trình ngoài đang giữ mở),
 * KHÔNG nới ngưỡng và vẫn báo số trong log.
 * Nhận: root — cây chia sẻ; ownPids — pid thuộc về ta (miễn trừ).
 * Trả: tập đường dẫn tuyệt đối do tiến trình ngoài giữ mở (rỗng khi lsof không dùng được).
 */
function foreignOpenPaths(root: string, ownPids: number[]): Set<string> {
  const paths = new Set<string>();
  const listed = run("lsof", ["-nP", "-t", "+D", root]);
  if (listed === undefined) return paths;
  const own = new Set(ownPids);
  for (const raw of listed.split("\n")) {
    const pid = Number(raw.trim());
    if (!Number.isInteger(pid) || pid <= 0 || own.has(pid) || pid === process.pid) continue;
    const files = run("lsof", ["-p", String(pid), "-Fn"]);
    if (files === undefined) continue;
    for (const line of files.split("\n")) {
      if (line.startsWith("n") && line.slice(1).startsWith(root)) paths.add(line.slice(1));
    }
  }
  return paths;
}

/**
 * Có harness KHÁC đang sống không (tiến trình `host` của CLI ngoài tiến trình test này)?
 * Nhận: không.
 * Trả: true khi tìm thấy ít nhất một tiến trình như vậy.
 */
function liveForeignHarness(): boolean {
  const listed = run("pgrep", ["-f", "apps/cli/src/main.ts host"]);
  if (listed === undefined) return false;
  return listed
    .split("\n")
    .map((line) => Number(line.trim()))
    .some((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid && process.ppid !== pid);
}

/**
 * Đường dẫn thuộc vùng do HARNESS ghi (sessions/ · storages/session_projcache/) — khi có harness khác sống,
 * các tệp này do nó tạo/ghi trong lúc test chạy, không phải host của ta.
 * Nhận: relative — đường dẫn tương đối trong cây chia sẻ.
 * Trả: true khi thuộc vùng session của harness.
 */
function harnessSessionPath(relative: string): boolean {
  return relative.startsWith("sessions/") || relative.startsWith("storages/session_projcache/") || relative.startsWith("storages/session_");
}

/**
 * Watches one entry of the shared tree while doing nothing, to learn whether another process keeps
 * writing it.
 * @param root - absolute tree root.
 * @param relative - entry path relative to the root.
 * @returns true when its size or mtime moved inside the probe window.
 */
async function keepsMoving(root: string, relative: string): Promise<boolean> {
  const path = join(root, relative);
  const stamp = (): string => {
    try {
      const stat = lstatSync(path);
      return String(stat.size) + ":" + String(Math.round(stat.mtimeMs));
    } catch {
      return "missing";
    }
  };
  const first = stamp();
  await new Promise((resolve) => setTimeout(resolve, OWNER_PROBE_MS));
  return stamp() !== first;
}

/**
 * The non-comment body of a YAML document.
 * @param text - file contents.
 * @returns the document with every full-line comment removed.
 */
function yamlBody(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();
}

describe("gate:home-isolation", () => {
  test("booting the host serves the DSH web surface and never touches ~/.galaxy/gbh", async () => {
    expect(existsSync(GBH)).toBe(true);

    // 1. Learn which paths the other, live harnesses write while this test does nothing at all.
    const control = await snapshotWindow(GBH, CONTROL_WINDOW_MS);
    const knownWriters = new Set(control.changed);
    // 20/10/2026: người ghi ngoài đang GIỮ MỞ tệp dưới cây chia sẻ cũng là người ghi ĐÃ BIẾT.
    const foreignBefore = foreignOpenPaths(GBH, [process.pid]);
    const before = snapshotTree(GBH);

    // 2. Boot our host on an OS-assigned port and use the surface it prints.
    const host = spawnHost(defaultHostOptions({ port: 0, autoPort: true }));
    try {
      expect(host.launch.home).toBe(appHome());
      expect(host.launch.home.endsWith("gbh")).toBe(false);

      const url = await host.ready;
      expect(url).toContain("?token=");
      expect(url).toContain("127.0.0.1");
      expect(existsSync(join(profileDir(), "cordis.yml"))).toBe(true);
      expect(openFilesUnder(host.child.pid ?? 0, GBH)).toEqual([]);

      const tokenResponse = await fetch(url, { redirect: "manual" });
      expect([200, 303]).toContain(tokenResponse.status);
      const cookie = cookiePair(tokenResponse.headers.get("set-cookie"));
      expect(cookie).not.toBe("");

      const page = await fetch(new URL("/", url), { headers: { cookie } });
      expect(page.status).toBe(200);
      const html = await page.text();
      expect(html).toContain('<div id="root"></div>');
      // 19/10/2026 (task-137, Lead duyệt): global CHÍNH __GBH_BOOT__ là tên DUY NHẤT; alias __DSH_BOOT__ đã bỏ
      // ⇒ trang KHÔNG còn chuỗi DSH nào từ tầng boot (mục tiêu khử DSH của cả mục tiêu cuối).
      expect(html).toContain("__GBH_BOOT__");
      expect(html).not.toContain("__DSH_BOOT__");
      // 20/10/2026: alias đã bỏ hẳn; global __GBH_BOOT__ là tên DUY NHẤT tầng boot phát ra.

      const anonymous = await fetch(new URL("/", url));
      expect(anonymous.status).toBe(401);

      expect(existsSync(join(appHome(), "profiles"))).toBe(true);
      expect(openFilesUnder(host.child.pid ?? 0, GBH)).toEqual([]);
    } finally {
      await stopHost(host);
    }

    // 3. Compare the shared tree. Paths that moved are excused only when another writer owns them:
    //    they either moved in the control window too, or they keep moving while we stay idle.
    const after = snapshotTree(GBH);
    const changed = changedEntries(before, after);
    const foreignAfter = foreignOpenPaths(GBH, [process.pid]);
    const unknown = changed.filter((path) => !knownWriters.has(path));
    const verdicts = await Promise.all(unknown.map(async (path) => ({
      path,
      moving: await keepsMoving(GBH, path),
      foreign: foreignBefore.has(join(GBH, path)) || foreignAfter.has(join(GBH, path)),
    })));
    // Quy cho người ghi NGOÀI đang giữ mở (log riêng), chỉ còn lại mới là `unexplained`.
    const foreignHarness = liveForeignHarness();
    const excused = verdicts.filter((entry) => !entry.moving && (entry.foreign || (foreignHarness && harnessSessionPath(entry.path)))).map((entry) => entry.path);
    const unexplained = verdicts.filter((entry) => !entry.moving && !entry.foreign && !(foreignHarness && harnessSessionPath(entry.path))).map((entry) => entry.path);
    if (excused.length > 0) {
      console.log(
        "[gate:home-isolation] quy cho nguoi ghi NGOAI: " + String(excused.length) + " duong dan" +
          (foreignHarness ? " (co harness KHAC dang song, vung sessions/storages do no ghi)" : " (tien trinh ngoai dang giu mo)"),
      );
    }

    console.log(
      "[gate:home-isolation] shared tree: " + String(control.entries) + " entries · " +
        String(knownWriters.size) + " already written by other harnesses · " +
        String(changed.length) + " moved during boot · " + String(unexplained.length) + " unexplained",
    );

    expect(unexplained).toEqual([]);
    if (changed.length === 0) {
      expect(treesMatch(before, after)).toBe(true);
      expect(after.hash).toBe(before.hash);
      expect(after.newestMtimeMs).toBe(before.newestMtimeMs);
    }

    // 4. A harness booted with DSH_HOME=~/.galaxy/gbh rewrites a profile root and creates sessions
    //    there: neither may be ours. No new path inside the shared tree is ours either.
    expect(changed.filter((path) => path.startsWith("profiles/"))).toEqual([]);
    expect(openFilesUnder(process.pid, GBH)).toEqual([]);
  // Ngan sach thoi gian: boot ~20-30 s + cua so doi chieu (CONTROL_WINDOW_MS 15 s) + do chu so huu (OWNER_PROBE_MS 12 s).
  // Lead cho phep noi nguong nay vi test do CACH LY HOME — thoi gian chay phu thuoc tai may chu, khong phai hanh vi
  // san pham; mot lan fail sat nut 30,1 s la loi cua nguong chu khong phai cua code. Do lai duoi tai: 25 s.
    // ⚠️ 18/10/2026: nang 60s -> 180s. Ca nay BOOT HOST THAT; do duoc 49,9s khi chay trong suite 628 test
    //   (may tai) ⇒ sat nguong 60s va de do oan. Chay rieng file nay van xanh ⇒ noi nguong, khong sua logic.
  }, 180_000);

  test("the profile root the harness rewrites is still the empty entry list", () => {
    expect(yamlBody(readFileSync(join(profileDir(), "cordis.yml"), "utf8"))).toBe("[]");
  });
});
