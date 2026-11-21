#!/usr/bin/env node
/**
 * author Galaxy Blackhole
 * create 2026-11-21
 * modify 2026-11-21
 * desc Patch installed harness copies for two Windows/runtime bugs: Koffi duplicate
 *      STARTUPINFO type names, and web-search-ollama assuming baseURL is a string.
 *
 * Usage: node scripts/host-runtime-fixes.mjs <host-root> [<host-root>...]
 *
 * The patch is deliberately content-based and idempotent. It runs after npm has
 * installed the host dependencies (or after the Windows desktop workflow stages
 * resources/host), because the buggy packages are stock dependencies and may be
 * present in several hoisted/nested node_modules copies.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const KO_MARKER = "GBH_STARTUPINFOW";
const SEARCH_MARKER = "gbhBaseUrlOf";

/**
 * Walk a directory without following symlinked directories twice.
 * @param {string} dir
 * @param {(file: string) => void} visit
 */
function walkFiles(dir, visit) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, visit);
    else if (entry.isFile()) visit(path);
  }
}

/**
 * Make Koffi struct names unique per module file.
 *
 * Koffi keeps a process-global type registry. Windows host layouts contain two
 * copies of dsh-win32-process; both used the literal DSH_STARTUPINFOW and the
 * second registration aborted every pwsh call before the command ran. The names
 * are only registry labels: the struct layout and the Win32 ABI do not change.
 * @param {string} path
 * @returns {boolean}
 */
function patchWin32(path) {
  if (!path.includes("/dsh-win32-process/lib/index.js") && !path.includes("\\dsh-win32-process\\lib\\index.js") &&
      !path.includes("/gbh-win32-process/lib/index.js") && !path.includes("\\gbh-win32-process\\lib\\index.js")) return false;
  let source;
  try { source = readFileSync(path, "utf8"); } catch { return false; }
  if (!source.includes("DSH_STARTUPINFOW") && !source.includes("DSH_PROCESS_INFORMATION")) return false;
  if (source.includes(KO_MARKER)) return false;
  const suffix = Math.random().toString(36).slice(2, 10);
  source = source
    .replace(/koffi\.struct\("DSH_STARTUPINFOW"(?:\s*\+\s*[^,]+)?\s*,\s*\{/g, 'koffi.struct("GBH_STARTUPINFOW_' + suffix + '", {')
    .replace(/koffi\.struct\("DSH_PROCESS_INFORMATION"(?:\s*\+\s*[^,]+)?\s*,\s*\{/g, 'koffi.struct("GBH_PROCESS_INFORMATION_' + suffix + '", {');
  if (!source.includes(KO_MARKER)) return false;
  writeFileSync(path, source);
  return true;
}

/**
 * Normalise web-search-ollama baseURL from string or `{ value }` object.
 *
 * The provider's config can arrive as an object-shaped setting on some profiles;
 * `current.baseURL?.trim()` then throws before the HTTP request, which is exactly
 * the Windows web_search failure in session-3052c69b. Invalid values fall back to
 * the Galaxy cloud default instead of aborting the search tool.
 * @param {string} path
 * @returns {boolean}
 */
function patchWebSearch(path) {
  if (!path.includes("web-search-ollama/lib/index.js") && !path.includes("web-search-ollama\\lib\\index.js")) return false;
  let source;
  try { source = readFileSync(path, "utf8"); } catch { return false; }
  if (!source.includes("baseURL?.trim()") && !source.includes('typeof current.baseURL') && !source.includes('typeof raw.baseURL')) return false;
  if (source.includes(SEARCH_MARKER)) return false;
  const helper = [
    "function gbhBaseUrlOf(value) {",
    '  if (typeof value === "string") return value.trim();',
    '  if (value && typeof value === "object" && typeof value.value === "string") return value.value.trim();',
    "  return undefined;",
    "}",
  ].join("\n");
  source = source
    .replace(/const dat = typeof (current|raw)\.baseURL === "string" \? \1\.baseURL\.trim\(\) : undefined;/g, "const dat = gbhBaseUrlOf($1.baseURL);")
    .replace(/const dat = (current|raw)\.baseURL\?\.trim\(\);/g, "const dat = gbhBaseUrlOf($1.baseURL);");
  if (!source.includes("function gbhBaseUrlOf(value)")) source += "\n" + helper + "\n";
  if (!source.includes("gbhBaseUrlOf(")) return false;
  writeFileSync(path, source);
  return true;
}

/**
 * Apply all runtime fixes under one host root.
 * @param {string} root
 * @returns {{win32:number, webSearch:number}}
 */
export function applyHostRuntimeFixes(root) {
  const result = { win32: 0, webSearch: 0 };
  if (!existsSync(root)) return result;
  walkFiles(root, (file) => {
    if (patchWin32(file)) result.win32 += 1;
    if (patchWebSearch(file)) result.webSearch += 1;
  });
  return result;
}

if (process.argv[1] !== undefined && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const roots = process.argv.slice(2);
  if (roots.length === 0) {
    console.error("usage: node scripts/host-runtime-fixes.mjs <host-root> [<host-root>...]");
    process.exit(2);
  }
  let total = { win32: 0, webSearch: 0 };
  for (const root of roots) {
    const counts = applyHostRuntimeFixes(root);
    total.win32 += counts.win32;
    total.webSearch += counts.webSearch;
    console.log("host fixes " + root + ": win32=" + counts.win32 + " web-search=" + counts.webSearch);
  }
  if (total.win32 === 0 && total.webSearch === 0) {
    console.log("host fixes: already patched (no changes)");
  }
}
