/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Lenh `bh doctor`: bao cao runtime, version app vs version oracle, profile, home cach ly
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PORT, ORACLE_PORT, appHome, appPatchPath, credentialsPath, dshBinPath, galaxyRoot, profileDir, repoRoot } from "./paths.ts";
import { ensureProfile } from "./profile.ts";
import { findOracle } from "./oracle.ts";
import { harnessInstalled, harnessVersion, readManifestVersion, resolveNodeRuntime } from "./runtime.ts";
import { isPortAvailable, portOwnerHint } from "./port.ts";
import { snapshotTree } from "./home-guard.ts";

/** One report row. */
export interface DoctorLine {
  /** `OK` when the fact is as expected, `WARN` when it is usable but off, `MISS` when it is absent. */
  status: "OK" | "WARN" | "MISS";
  /** Short label of the fact. */
  label: string;
  /** The fact itself; never a secret value. */
  detail: string;
  /** When true a non-OK status makes `bh doctor` exit non-zero. */
  critical?: boolean;
}

/**
 * Checks that the seeded profile root is still the empty entry list the harness requires.
 * @param file - absolute path of the profile's `cordis.yml`.
 * @returns true when every non-comment line is exactly `[]`.
 */
function profileRootIsEmpty(file: string): boolean {
  try {
    const body = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n")
      .trim();
    return body === "[]";
  } catch {
    return false;
  }
}

/**
 * The credential path the app patch pins, read back from the file rather than recomputed.
 * @param patchPath - absolute path of the generated app patch.
 * @returns the pinned path, or undefined when the patch has no credentials row.
 */
function pinnedCredentialsPath(patchPath: string): string | undefined {
  try {
    return /path:\s*"([^"]+)"/u.exec(readFileSync(patchPath, "utf8"))?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Collects every fact `bh doctor` reports. Read-only: it never boots the harness and never writes.
 * @param port - the app port to check for availability; defaults to 5439.
 * @returns one row per fact, in report order.
 */
export async function buildDoctorReport(port: number = DEFAULT_PORT): Promise<DoctorLine[]> {
  const lines: DoctorLine[] = [];

  try {
    const node = resolveNodeRuntime();
    lines.push({ status: "OK", label: "node runtime", detail: `${node.version} (${node.source}) ${node.bin}`, critical: true });
  } catch (error) {
    lines.push({ status: "MISS", label: "node runtime", detail: (error as Error).message, critical: true });
  }

  const declaredPin = ((): string | undefined => {
    try {
      const manifest = JSON.parse(readFileSync(join(repoRoot(), "apps", "host", "package.json"), "utf8")) as {
        dependencies?: Record<string, string>;
      };
      return manifest.dependencies?.["@deepseek-ai/dsh"];
    } catch {
      return undefined;
    }
  })();
  const installed = harnessVersion();
  if (!harnessInstalled()) {
    lines.push({ status: "MISS", label: "harness runtime", detail: `${dshBinPath()} — run: bun install --cwd apps/host`, critical: true });
  } else if (declaredPin !== undefined && installed !== undefined && declaredPin !== installed) {
    lines.push({
      status: "WARN",
      label: "harness runtime",
      detail: `installed ${installed} but apps/host declares ${declaredPin} — run: bun install --cwd apps/host`,
      critical: true,
    });
  } else {
    lines.push({ status: "OK", label: "harness runtime", detail: `version ${installed ?? "?"} ${dshBinPath()}`, critical: true });
  }

  const oracle = findOracle(ORACLE_PORT);
  if (oracle === undefined) {
    lines.push({ status: "WARN", label: `oracle :${ORACLE_PORT}`, detail: "khong tim thay tien trinh dang nghe (khong bat buoc)" });
  } else if (oracle.version !== undefined && installed !== undefined && oracle.version !== installed) {
    lines.push({
      status: "WARN",
      label: `oracle :${oracle.port}`,
      detail: `pid ${oracle.pid} version ${oracle.version} KHAC app ${installed} — parity se lech`,
    });
  } else {
    lines.push({ status: "OK", label: `oracle :${oracle.port}`, detail: `pid ${oracle.pid} version ${oracle.version ?? "?"} ${oracle.home ?? ""}`.trim() });
  }

  const home = appHome();
  lines.push(existsSync(home)
    ? { status: "OK", label: "app home", detail: `${home} (DSH_HOME, KHONG dung ${join(galaxyRoot(), "gbh")})` }
    : { status: "MISS", label: "app home", detail: `${home} — se tao khi boot` });

  const seeded = ensureProfile();
  lines.push({
    status: profileRootIsEmpty(join(seeded.dir, "cordis.yml")) ? "OK" : "WARN",
    label: "profile",
    detail: `${join(seeded.dir, "cordis.yml")} = [] · ${seeded.bundles.length} bundle`,
  });

  const credentials = credentialsPath();
  lines.push(existsSync(credentials)
    ? { status: "OK", label: "shared credentials", detail: `${credentials} · ${statSync(credentials).size} bytes (noi dung khong in)` }
    : { status: "MISS", label: "shared credentials", detail: `${credentials} chua co (nguoi dung tao khi dang nhap)` });

  const pinned = pinnedCredentialsPath(appPatchPath());
  lines.push(pinned === credentials
    ? { status: "OK", label: "app patch", detail: `credentials.config.path -> ${pinned}` }
    : { status: "WARN", label: "app patch", detail: `${appPatchPath()} -> ${pinned ?? "(chua sinh)"} (mong doi ${credentials})` });


  const gbh = join(galaxyRoot(), "gbh");
  if (existsSync(gbh)) {
    const snapshot = snapshotTree(gbh);
    lines.push({ status: "OK", label: "home isolation", detail: `${gbh} chi doc · ${snapshot.entries} entry · hash ${snapshot.hash.slice(0, 12)}` });
  } else {
    lines.push({ status: "WARN", label: "home isolation", detail: `${gbh} khong ton tai tren may nay` });
  }

  const free = await isPortAvailable(port);
  lines.push(free
    ? { status: "OK", label: `port :${port}`, detail: "trong" }
    : { status: "WARN", label: `port :${port}`, detail: `dang bi chiem (${portOwnerHint(port)})` });

  return lines;
}

/**
 * Prints the report and returns the process exit code.
 * @param port - app port to check; defaults to 5439.
 * @returns 0 when every critical row is OK, otherwise 1.
 */
export async function runDoctor(port: number = DEFAULT_PORT): Promise<number> {
  console.log("Galaxy Blackhole Desktop — bh doctor");
  const lines = await buildDoctorReport(port);
  for (const line of lines) console.log(`${line.status.padEnd(4)} ${line.label.padEnd(22)} ${line.detail}`);
  const failed = lines.filter((line) => line.critical === true && line.status !== "OK");
  console.log(failed.length === 0 ? "\nket qua: XANH" : `\nket qua: DO — ${failed.map((line) => line.label).join(", ")}`);
  return failed.length === 0 ? 0 : 1;
}
