/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chon runtime Node >= 26 de boot harness va doc version harness da cai de doi chieu pin
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MIN_NODE_MAJOR, dshBinPath, dshManifestPath } from "./paths.ts";

/** A Node binary this app is willing to boot the harness with. */
export interface NodeRuntime {
  /** Absolute path, or the PATH name that resolved. */
  bin: string;
  /** Version string as printed by `node --version`, e.g. `v26.9.0`. */
  version: string;
  /** Major version, already checked against {@link MIN_NODE_MAJOR}. */
  major: number;
  /** Where the candidate came from: `GBH_NODE`, `nvm vX`, `PATH` or `system`. */
  source: string;
}

/** One candidate that was refused, kept so a failure names what was found instead. */
export interface RejectedNode {
  /** Path or PATH name that was probed. */
  bin: string;
  /** Version it reported, when it reported one. */
  version?: string;
  /** Why it was refused. */
  reason: string;
}

let cached: NodeRuntime | undefined;
let rejected: RejectedNode[] = [];

/**
 * Reads the `version` field of a package.json.
 * @param manifestPath - absolute path of the manifest.
 * @returns the version string, or undefined when the file is missing or malformed.
 */
export function readManifestVersion(manifestPath: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
    const version = (parsed as { version?: unknown }).version;
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

/** Version of the harness runtime installed under `apps/host`, or undefined when absent. */
export function harnessVersion(): string | undefined {
  return readManifestVersion(dshManifestPath());
}

/** Whether the pinned harness entry point exists on disk. */
export function harnessInstalled(): boolean {
  return existsSync(dshBinPath());
}

/**
 * Probes one binary with `--version`.
 * @param bin - path or PATH name of a Node binary.
 * @returns the version it printed, or undefined when it failed or printed nothing.
 */
export function probeNodeVersion(bin: string): string | undefined {
  const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 8000 });
  if (probe.error !== undefined || probe.status !== 0) return undefined;
  const match = /v?(\d+)\.\d+\.\d+/.exec(`${probe.stdout ?? ""}${probe.stderr ?? ""}`);
  if (match === null) return undefined;
  return match[0].startsWith("v") ? match[0] : `v${match[0]}`;
}

/**
 * Candidate binaries in preference order: the explicit env pin, then the newest nvm install, then
 * whatever PATH and the usual system locations offer.
 * @returns one entry per candidate, unresolved and unprobed.
 */
function nodeCandidates(): { bin: string; source: string }[] {
  const candidates: { bin: string; source: string }[] = [];
  const explicit = process.env.GBH_NODE?.trim();
  if (explicit !== undefined && explicit !== "") candidates.push({ bin: explicit, source: "GBH_NODE" });
  const nvmRoot = join(homedir(), ".nvm", "versions", "node");
  try {
    const versions = readdirSync(nvmRoot)
      .filter((name) => /^v\d+\.\d+\.\d+$/.test(name))
      .sort((left, right) => {
        const [leftMajor, leftMinor] = left.slice(1).split(".").map(Number);
        const [rightMajor, rightMinor] = right.slice(1).split(".").map(Number);
        return (rightMajor ?? 0) - (leftMajor ?? 0) || (rightMinor ?? 0) - (leftMinor ?? 0);
      });
    for (const version of versions) candidates.push({ bin: join(nvmRoot, version, "bin", "node"), source: `nvm ${version}` });
  } catch {
    /* nvm is optional: fall through to PATH and system locations */
  }
  candidates.push({ bin: "node", source: "PATH" });
  candidates.push({ bin: "/usr/local/bin/node", source: "system" });
  candidates.push({ bin: "/opt/homebrew/bin/node", source: "homebrew" });
  return candidates;
}

/**
 * Resolves the Node runtime to boot the harness with, preferring the explicit pin, then the newest
 * nvm install, then PATH and the usual system locations, refusing anything below
 * {@link MIN_NODE_MAJOR}.
 * @returns the first acceptable runtime; the result is cached for the process lifetime.
 * @throws when every candidate is missing, silent or too old, naming each one it refused.
 */
export function resolveNodeRuntime(): NodeRuntime {
  if (cached !== undefined) return cached;
  rejected = [];
  for (const candidate of nodeCandidates()) {
    if (candidate.bin !== "node" && !existsSync(candidate.bin)) {
      rejected.push({ bin: candidate.bin, reason: "not found" });
      continue;
    }
    const version = probeNodeVersion(candidate.bin);
    if (version === undefined) {
      rejected.push({ bin: candidate.bin, reason: "did not answer --version (known silent failure)" });
      continue;
    }
    const major = Number(version.slice(1).split(".")[0]);
    if (major < MIN_NODE_MAJOR) {
      rejected.push({ bin: candidate.bin, version, reason: `below the required v${MIN_NODE_MAJOR}` });
      continue;
    }
    cached = { bin: candidate.bin, version, major, source: candidate.source };
    return cached;
  }
  const tried = rejected.map((entry) => `${entry.bin} (${entry.version ?? "?"}): ${entry.reason}`).join("; ");
  throw new Error(`no node >= v${MIN_NODE_MAJOR} found; set GBH_NODE to a v${MIN_NODE_MAJOR}+ binary. Tried: ${tried}`);
}

/** Candidates refused by the last {@link resolveNodeRuntime} call, for diagnostics. */
export function rejectedNodeCandidates(): RejectedNode[] {
  return rejected;
}
