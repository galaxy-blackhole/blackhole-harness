/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Lenh `bh host`: boot harness cua app, bat URL co ?token= de vo Tauri mo, va --dump-config parity — 11/11/2026: moi dong log relay duoc doi nhan stock "dsh ..." thanh "gbh ..." (chi doi chuoi in, khong doi hanh vi boot)
 *      12/11/2026: them moc do thoi gian tung pha cua resolveLaunch (GBH_BOOT_TIMING=1) de do khởi động
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import {
  DEFAULT_PORT,
  DEFAULT_PROFILE,
  LOOPBACK_HOST,
  appHome,
  appPatchPath,
  dshBinPath,
  repoRoot,
} from "./paths.ts";
import { phase, timePhase } from "./boot-timing.ts";
import { chuanHoaProfile, ensureRewriteMounts } from "./mount.ts";
import { ensureProfile, readAppPatch, writeAppPatch } from "./profile.ts";
import { resolveNodeRuntime } from "./runtime.ts";

/** Which harness invocation to build an argument vector for. */
export type LaunchMode = "boot" | "dump";

/** Everything `bh host` accepts on the command line. */
export interface HostOptions {
  /** Port to bind; 0 asks the OS for a free one. */
  port: number;
  /** Profile name under the app home. */
  profile: string;
  /** When true the harness also opens the OS browser; the desktop window owns the page otherwise. */
  openBrowser: boolean;
  /** When the requested port is busy, fall back to `--port 0` instead of failing. */
  autoPort: boolean;
  /** Extra `--patch` overlays, applied before the app's own patch. */
  extraPatches: string[];
}

/** A resolved boot: the runtime, the argv and every path it will touch. */
export interface HostLaunch {
  /** Node binary that will run the harness. */
  node: string;
  /** Version of that binary, for the boot banner. */
  nodeVersion: string;
  /** Harness CLI entry point. */
  bin: string;
  /** argv after the node binary. */
  args: string[];
  /** Port requested (0 means OS-assigned). */
  port: number;
  /** `DSH_HOME` handed to the child; never `~/.galaxy/gbh`. */
  home: string;
  /** Profile directory that was seeded. */
  profileDir: string;
  /** Generated app patch the child applies last. */
  patch: string;
  /** Một dòng mô tả các package viết lại đã mount (M4 trở đi). */
  rewrites: string;
}

/** A running host process plus the authenticated URL the harness prints once it is ready. */
export interface HostProcess {
  /** The harness child process. */
  child: ChildProcess;
  /** Resolves with the `?token=` URL, rejects when the child exits before printing one. */
  ready: Promise<string>;
  /** What was launched, so callers can assert on paths. */
  launch: HostLaunch;
}

/**
 * Fills in the CLI defaults.
 * @param overrides - fields the caller wants to change.
 * @returns a complete {@link HostOptions}.
 */
export function defaultHostOptions(overrides: Partial<HostOptions> = {}): HostOptions {
  return {
    port: DEFAULT_PORT,
    profile: DEFAULT_PROFILE,
    openBrowser: false,
    autoPort: false,
    extraPatches: [],
    ...overrides,
  };
}

/**
 * Doi nhan mot dong log cua harness con: runtime stock in "dsh web:", "dsh inspector:", "dsh: ..."
 * (ten package stock), con moi dong `bh host` relay ra la cua app, nen doc la "gbh ...".
 * Chi doi nhan dau dong; phan con lai (URL, token, tham so) giu nguyen.
 * @param line - mot dong harness con in ra, khong kem newline.
 * @returns dong do voi nhan gbh.
 */
export function brandLogLine(line: string): string {
  return line
    .replace(/^dsh (?=web:|inspector:)/u, "gbh ")
    .replace(/^dsh: /u, "gbh: ");
}

/**
 * Extracts the authenticated URL the web bundle prints on stdout (`dsh web: http://...?token=...`).
 * @param text - accumulated child output; a truncated tail is enough.
 * @returns the loopback URL, or undefined while nothing has been printed yet.
 */
export function extractReadyUrl(text: string): string | undefined {
  return /https?:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9._~+/=-]+/u.exec(text)?.[0];
}

/**
 * Renders what a boot will do, without secrets: runtime, home, profile, patch and argv.
 * @param launch - the resolved boot.
 * @returns one line per fact, for `--dry-run` and for the boot banner.
 */
export function describeLaunch(launch: HostLaunch): string[] {
  return [
    `node      ${launch.nodeVersion} (${launch.node})`,
    `harness   ${launch.bin}`,
    `DSH_HOME  ${launch.home}`,
    `profile   ${launch.profileDir}`,
    `patch     ${launch.patch}`,
    `rewrite   ${launch.rewrites}`,
    `argv      ${launch.args.join(" ")}`,
  ];
}

/**
 * Resolves everything a boot needs: runtime checks, profile seeding, the app patch and the argv.
 * @param options - the requested host options.
 * @param mode - `boot` for the web surface, `dump` for `--dump-config`.
 * @returns the launch description.
 * @throws with an actionable message when the harness is not installed or no Node >= 26 exists.
 */
export function resolveLaunch(options: HostOptions, mode: LaunchMode = "boot"): HostLaunch {
  const bin = dshBinPath();
  if (!existsSync(bin)) {
    throw new Error(`harness runtime not found at ${bin} — run: bun install --cwd apps/host`);
  }
  const node = resolveNodeRuntime();
  // 12/11/2026 — mốc đo pha (GBH_BOOT_TIMING=1) để thấy pha nào chiếm thời gian khởi động.
  const mounts = timePhase("mount goi viet lai + alias", () => ensureRewriteMounts());
  for (const mount of mounts) {
    if (mount.ok) continue;
    console.warn(`[bh] khong mount duoc ${mount.specifier} (${mount.detail ?? "?"}) -> giu row cua DSH`);
  }
  const patch = timePhase("ghi app.patch.yml", () => writeAppPatch({ rewrites: mounts }));
  // 07/11/2026 — bước LUÔN chạy: đổi id stock -> GBH + chép icon vào bản cài (xem chuanHoaProfile).
  timePhase("chuan hoa profile (doi id + icon + va API)", () => chuanHoaProfile());
  const seed = timePhase("seed profile", () => ensureProfile(options.profile));
  phase("resolveLaunch xong");
  const args = [bin, "--profile", options.profile, "--patch", patch, ...options.extraPatches.flatMap((file) => ["--patch", file])];
  if (mode === "dump") {
    args.push("--dump-config");
  } else {
    if (!options.openBrowser) args.push("--no-open");
    args.push("--host", LOOPBACK_HOST, "--port", String(options.port));
  }
  return {
    node: node.bin,
    nodeVersion: node.version,
    bin,
    args,
    port: options.port,
    // HOM PHAI LA `appHome()`, KHONG doc `DSH_HOME` tu moi truong. Bai hoc 17/10/2026: phien agent chay
    // trong mot DSH host co san `DSH_HOME=~/.galaxy/gbh` (home CHI DOC cua kernel) => doc bien do thi
    // `bh host` di tim profile trong home chi-doc, khong thay, va app CHET ngay lan boot ke tiep.
    // Nguoc lai, lab KHONG dung `bh host`: lab chay harness truc tiep voi `DSH_HOME` (muc 000 cong thuc).
    home: appHome(),
    profileDir: seed.dir,
    patch,
    rewrites:
      mounts.length === 0
        ? "khong co"
        : mounts.map((mount) => `${mount.ok ? "OK" : "MISS"} ${mount.specifier}${mount.built ? " (vua build)" : ""}${mount.row?.aliases === undefined ? "" : " · alias " + mount.row.aliases.join(",")}`).join(" · "),
  };
}

/**
 * Môi trường cho tiến trình harness con.
 *
 * CẢ HAI cùng một giá trị, nên app ta cũng vậy. Không thêm biến nào khác.
 * @param home - home của app (đã resolve thành đường dẫn tuyệt đối).
 * @returns môi trường kế thừa của tiến trình hiện tại, có thêm hai biến home.
 */
export function hostChildEnv(home: string): NodeJS.ProcessEnv {
  return { ...process.env, DSH_HOME: home, GBH_HOME: home };
}

/**
 * Boots the harness, streams its output through this process, and resolves the authenticated URL
 * the first time the harness prints one. Secrets never enter this process: the credential document
 * is only referenced by path in the patch.
 * @param options - the requested host options.
 * @returns the child, its launch description, and a promise for the ready URL.
 */
export function spawnHost(options: HostOptions): HostProcess {
  const launch = resolveLaunch(options);
  const child = spawn(launch.node, launch.args, {
    cwd: repoRoot(),
    env: hostChildEnv(launch.home),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let settled = false;
  let buffer = "";
  /**
   * Relay one child stream to one of ours, a complete line at a time, so every line can be
   * relabelled and a partial line never splits a UTF-8 sequence mid-write.
   */
  const relayTo = (sink: NodeJS.WriteStream): ((chunk: string) => void) => {
    let pending = "";
    return (chunk: string): void => {
      pending += chunk;
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? "";
      for (const line of lines) sink.write(brandLogLine(line) + "\n");
    };
  };
  const relayOut = relayTo(process.stdout);
  const relayErr = relayTo(process.stderr);
  const ready = new Promise<string>((resolve, reject) => {
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      relayOut(chunk);
      buffer = `${buffer}${chunk}`.slice(-8192);
      if (settled) return;
      const url = extractReadyUrl(buffer);
      if (url === undefined) return;
      settled = true;
      process.stdout.write(`[bh] ready ${url}\n`);
      // Ghi lai URL ngay tai day. Truoc day khong ai ghi nen file ready-url.txt giu token cu sau moi lan
      // restart, va check:app bao app chet trong khi app hoan toan khoe (da gap 2 lan trong ngay 17/10).
      //
      // CHI ghi `ready-url.txt` khi day la CONG CHINH cua app. Mot lan boot o cong KHAC (lab, thu nghiem)
      // ma cung ghi vao `ready-url.txt` se lam `check:app` di do nham tien trinh lab => bao "app KHONG LANH"
      // trong khi app that hoan toan khoe. Da xay ra that 17/10/2026 (file tro vao mot cong da tat).
      // Boot o cong khac ghi file rieng `ready-url-<port>.txt` de khong tranh chap.
      const name = options.port === DEFAULT_PORT ? "ready-url.txt" : `ready-url-${options.port}.txt`;
      try {
        writeFileSync(launch.home + "/" + name, url);
      } catch {
        // Khong ghi duoc thi khong lam hong boot.
      }
      resolve(url);
    });
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      relayErr(chunk);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(new Error(`could not start ${launch.node}: ${error.message}`));
    });
    child.once("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      reject(new Error(`harness exited before printing a URL (code ${String(code)}, signal ${String(signal)})`));
    });
  });
  return { child, ready, launch };
}

/**
 * Prints the composed profile tree (the harness's own `--dump-config`) to this process's stdout.
 * @param options - profile and extra overlays; the app patch is always applied last.
 * @returns the harness exit code.
 * @throws with an actionable message when the launch cannot be resolved.
 */
export function runDumpConfig(options: { profile?: string; extraPatches?: string[] } = {}): number {
  const launch = resolveLaunch(defaultHostOptions({ profile: options.profile, extraPatches: options.extraPatches }), "dump");
  const result = spawnSync(launch.node, launch.args, {
    cwd: repoRoot(),
    env: hostChildEnv(launch.home),
    stdio: "inherit",
  });
  return result.status ?? 1;
}

export { readAppPatch, appPatchPath };