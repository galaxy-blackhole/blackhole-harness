/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Doc version runtime cua oracle (blackhole web dang nghe cong 4001) de lech version lo ra ngay
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { ORACLE_PORT } from "./paths.ts";
import { readManifestVersion } from "./runtime.ts";

/** The harness install that owns the oracle port, as far as this process can tell. */
export interface OracleRuntime {
  /** Port that was probed. */
  port: number;
  /** Process id listening on it. */
  pid: number;
  /** `.../node_modules/@deepseek-ai/dsh/lib/bin.js`, or `(unknown)` when the command line is hidden. */
  binPath: string;
  /** Version read from that install's package.json, when it could be read. */
  version?: string;
  /** `DSH_HOME` of that process, when the environment was readable. */
  home?: string;
}

/**
 * Runs a short read-only command and returns its stdout.
 * @param command - executable name.
 * @param args - arguments.
 * @returns stdout on exit code 0, otherwise undefined.
 */
function run(command: string, args: string[]): string | undefined {
  try {
    const probe = spawnSync(command, args, { encoding: "utf8", timeout: 5000 });
    return probe.status === 0 ? probe.stdout ?? "" : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads the version of the harness install that owns a CLI entry point.
 * @param binPath - absolute path of `lib/bin.js`; `<pkg>/lib/bin.js` resolves to `<pkg>/package.json`.
 * @returns the version, or undefined when the manifest is unreadable.
 */
export function readRuntimeVersionFromBin(binPath: string): string | undefined {
  return readManifestVersion(resolve(binPath, "..", "..", "package.json"));
}

/**
 * Finds the harness process currently listening on the oracle port so `bh doctor` can compare the
 * app's runtime version with the version the person is actually comparing against.
 * @param port - port to probe; defaults to {@link ORACLE_PORT}.
 * @returns the owning runtime, or undefined when nothing listens there or the tools are missing.
 */
export function findOracle(port: number = ORACLE_PORT): OracleRuntime | undefined {
  const listed = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  const pid = Number((listed ?? "").split("\n")[0]?.trim());
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  const command = run("ps", ["eww", "-o", "command=", "-p", String(pid)]) ?? run("ps", ["-o", "command=", "-p", String(pid)]);
  if (command === undefined) return { port, pid, binPath: "(unknown)" };
  const binPath = /(\S*node_modules\/@deepseek-ai\/dsh\/lib\/bin\.js)/u.exec(command)?.[1];
  const home = /(?:^|\s)DSH_HOME=(\S+)/u.exec(command)?.[1];
  return {
    port,
    pid,
    binPath: binPath ?? "(unknown)",
    version: binPath === undefined ? undefined : readRuntimeVersionFromBin(binPath),
    home,
  };
}
