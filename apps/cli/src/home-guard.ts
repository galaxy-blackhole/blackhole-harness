/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc gate:home-isolation — snapshot hash+mtime cay ~/.galaxy/gbh de chung minh app khong ghi vao
 */

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readlinkSync } from "node:fs";
import { join } from "node:path";

/** Content summary of one tree: relative paths, kinds, sizes and mtimes — never file bytes. */
export interface TreeSnapshot {
  /** Absolute root that was scanned. */
  root: string;
  /** Number of entries (files, directories and symlinks) seen. */
  entries: number;
  /** Total size of regular files, in bytes. */
  bytes: number;
  /** Newest mtime in the tree, rounded to milliseconds; the gate fails when this moves. */
  newestMtimeMs: number;
  /** SHA-256 over every entry line; comparing two hashes is the whole gate. */
  hash: string;
  /** One `relative|kind|size|mtime` line per entry, sorted; lets the gate name what changed. */
  lines: string[];
}

/** Counters accumulated while walking. */
interface Totals {
  entries: number;
  bytes: number;
  newestMtimeMs: number;
}

/** Symlink target, or a marker when the link is unreadable. */
function linkTarget(path: string): string {
  try {
    return readlinkSync(path);
  } catch {
    return "?";
  }
}

/**
 * Walks one directory depth-first in sorted order, appending one line per entry.
 * @param root - snapshot root, used to derive relative paths.
 * @param dir - directory to read.
 * @param lines - accumulator for entry lines.
 * @param totals - accumulator for counters.
 */
function walk(root: string, dir: string, lines: string[], totals: Totals): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    lines.push(`${dir}|${-1}|unreadable|${String(error)}`);
    return;
  }
  for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))) {
    const path = join(dir, entry.name);
    const relative = path.slice(root.length + 1);
    let stat;
    try {
      stat = lstatSync(path);
    } catch (error) {
      lines.push(`${relative}|unstatable|${String(error)}`);
      continue;
    }
    const mtime = Math.round(stat.mtimeMs);
    totals.entries += 1;
    totals.newestMtimeMs = Math.max(totals.newestMtimeMs, mtime);
    if (!entry.isDirectory() && !entry.isSymbolicLink()) totals.bytes += stat.size;
    const kind = entry.isSymbolicLink() ? `link:${linkTarget(path)}` : entry.isDirectory() ? "dir" : "file";
    lines.push(`${relative}|${kind}|${stat.size}|${mtime}`);
    if (entry.isDirectory() && !entry.isSymbolicLink()) walk(root, path, lines, totals);
  }
}

/**
 * Snapshots a directory tree without reading file bytes, so a 300 MB tree costs a few hundred stats.
 * Read-only: it never creates, writes or deletes anything.
 * @param root - absolute directory to snapshot; a missing root yields a snapshot with hash of "".
 * @returns the snapshot, including the hash the isolation gate compares.
 */
export function snapshotTree(root: string): TreeSnapshot {
  const lines: string[] = [];
  const totals: Totals = { entries: 0, bytes: 0, newestMtimeMs: 0 };
  walk(root, root, lines, totals);
  const sorted = [...lines].sort();
  return {
    root,
    entries: totals.entries,
    bytes: totals.bytes,
    newestMtimeMs: totals.newestMtimeMs,
    hash: createHash("sha256").update(sorted.join("\n")).digest("hex"),
    lines: sorted,
  };
}

/**
 * The relative path of a snapshot line.
 * @param line - one `relative|kind|size|mtime` entry line.
 * @returns the path part, or the whole line when it has no separator.
 */
export function entryPath(line: string): string {
  const separator = line.indexOf("|");
  return separator === -1 ? line : line.slice(0, separator);
}

/**
 * Names every entry that differs between two snapshots: added, removed or rewritten.
 *
 * A live harness home is written by the processes that own it (session logs, projection caches),
 * so a strict "nothing changed" gate cannot hold on a machine with other running harnesses. This
 * function makes the gate report *which* paths moved, so the test can prove that none of them are
 * ours.
 * @param before - snapshot taken before the operation under test.
 * @param after - snapshot taken afterwards.
 * @returns sorted relative paths whose entry line changed.
 */
export function changedEntries(before: TreeSnapshot, after: TreeSnapshot): string[] {
  const previous = new Map(before.lines.map((line) => [entryPath(line), line]));
  const current = new Map(after.lines.map((line) => [entryPath(line), line]));
  const changed = new Set<string>();
  for (const [path, line] of current) if (previous.get(path) !== line) changed.add(path);
  for (const path of previous.keys()) if (!current.has(path)) changed.add(path);
  return [...changed].sort();
}

/**
 * Watches a tree for a short window while doing nothing, to learn which paths another process is
 * actively writing. The isolation gate subtracts this set, so it can still fail loudly when a
 * *new* writer — us — appears.
 * @param root - absolute directory to watch.
 * @param windowMs - how long to wait between the two snapshots.
 * @returns the changed paths plus the entry count seen first.
 */
export async function snapshotWindow(root: string, windowMs: number): Promise<{ changed: string[]; entries: number }> {
  const first = snapshotTree(root);
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  const second = snapshotTree(root);
  return { changed: changedEntries(first, second), entries: first.entries };
}

/**
 * Compares two snapshots of the same root.
 * @param before - snapshot taken before the operation under test.
 * @param after - snapshot taken afterwards.
 * @returns true when hash, entry count and newest mtime are all identical.
 */
export function treesMatch(before: TreeSnapshot, after: TreeSnapshot): boolean {
  return before.hash === after.hash && before.entries === after.entries && before.newestMtimeMs === after.newestMtimeMs;
}

/**
 * Renders the differences between two snapshots for a human-readable failure message.
 * @param before - snapshot taken before the operation under test.
 * @param after - snapshot taken afterwards.
 * @returns one line per changed field; an empty list means the tree was untouched.
 */
export function describeTreeDiff(before: TreeSnapshot, after: TreeSnapshot): string[] {
  const diff: string[] = [];
  if (before.hash !== after.hash) diff.push(`hash ${before.hash.slice(0, 12)} -> ${after.hash.slice(0, 12)}`);
  if (before.entries !== after.entries) diff.push(`entries ${before.entries} -> ${after.entries}`);
  if (before.bytes !== after.bytes) diff.push(`bytes ${before.bytes} -> ${after.bytes}`);
  if (before.newestMtimeMs !== after.newestMtimeMs) diff.push(`newest mtime ${before.newestMtimeMs} -> ${after.newestMtimeMs}`);
  return diff;
}
