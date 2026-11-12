/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Sinh ban LEAN cua harness de publish len npm: chep dung artefact can de BOOT (khong src/, test/,
 *      docs/, node_modules/), sinh package.json (deps = apps/host/package.json) va bin/bh.mjs.
 *      12/11/2026: tao moi — muc tieu "npm i -g @galaxy-blackhole/blackhole-harness" la co harness,
 *      khong can git clone / ZIP 39 MB.
 *      12/11/2026: BUN BUILD launcher thanh apps/cli/src/main.js — Node TU CHOI strip-types cho tep nam
 *      trong node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), nen ban npm phai co .js da build.
 */

// Chay: node npm-package/prepare.mjs   (idempotent: xoa roi sinh lai toan bo staging)
// Staging CHINH LA thu muc chua file nay; hai tep duoi day duoc GIU lai khi don:
//   prepare.mjs (script nay) va README.md (van ban cho nguoi dung npm).

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Thu muc staging (chinh la thu muc chua script nay). */
const STAGING = dirname(fileURLToPath(import.meta.url));
/** Goc repo harness = thu muc cha cua staging. */
const REPO = dirname(STAGING);
/** Tep duoc giu lai khi don staging (khong sinh tu cay repo). */
const KEEP = new Set(["prepare.mjs", "README.md"]);
/** Ten goi va version publish. */
const NAME = "@galaxy-blackhole/blackhole-harness";
// 12/11/2026 (Lead): version doc tu env de `GBH_HARNESS_VERSION=0.1.2 bun run pack:harness` khong
// bi ghi de ve 0.1.0 (npm khong cho publish lai cung version, nen pack sai version la mat 1 luot).
// 12/11/2026 (Lead bổ sung): giữ version ĐANG CÓ trong npm-package/package.json khi không đặt env —
// nếu luôn mặc định 0.1.0 thì mỗi lượt `publish:harness` lại đụng "cannot publish over 0.1.0".
const VERSION = (process.env.GBH_HARNESS_VERSION ?? docVersion() ?? "0.1.0").trim();

/**
 * Version đang nằm trong staging package.json, nếu có.
 * @returns version đã publish gần nhất theo staging, hoặc undefined khi chưa có tệp.
 */
function docVersion() {
  try {
    const doc = JSON.parse(readFileSync(join(STAGING, "package.json"), "utf8"));
    return typeof doc.version === "string" ? doc.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Bo dem dung luong/so tep theo tung nhom, de in bao cao cuoi. */
const stats = new Map();

/**
 * Ghi nhan mot tep vua chep vao bo dem cua mot nhom.
 * @param {string} group - ten nhom (cli, packages, profiles, tools, root...).
 * @param {number} bytes - kich thuoc tep.
 */
function count(group, bytes) {
  const current = stats.get(group) ?? { files: 0, bytes: 0 };
  current.files += 1;
  current.bytes += bytes;
  stats.set(group, current);
}

/**
 * Chep mot tep va ghi so lieu.
 * @param {string} group - nhom bao cao.
 * @param {string} from - duong dan nguon tuyet doi.
 * @param {string} to - duong dan dich tuyet doi.
 */
function copyFile(group, from, to) {
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  count(group, statSync(to).size);
}

/**
 * Tep nay co thuoc ban chay khong (loai .map va .DS_Store).
 * @param {string} name - ten tep.
 * @returns {boolean} true khi nen chep.
 */
function wanted(name) {
  if (name === ".DS_Store") return false;
  if (name.endsWith(".map")) return false;
  return true;
}

/** Thu muc artefact: chep TRON (mount chep lai y nguyen vao profile). */
const ARTIFACT_DIRS = ["lib", "locale", "assets", "runtime", "presets", "experimental"];
/** Thu muc chi de phat trien: KHONG chep (nguon, test, docs...). */
const SKIP_DIRS = ["src", "src-handwritten", "test", "tests", "docs", "node_modules", "vendor", "lab", "coverage", "dist", "tools"];

/**
 * Chep mot thu muc theo chieu sau, giu lai dung nhung gi can de chay.
 *
 * Che do "package": package.json + thu muc artefact + MOI tep .yml/.yaml (patch long trong bundle:
 * vd bundle/experimental/*.patch.yml — thieu no thi harness bao "failed to read overlay", BO bundle, app
 * khong boot) + icon.svg|png. Che do "all": lay toan bo (da loc node_modules, tep an, .map).
 * @param {string} group - nhom bao cao.
 * @param {string} from - thu muc nguon.
 * @param {string} to - thu muc dich.
 * @param {"package"|"all"} mode - che do loc.
 */
function copyTree(group, from, to, mode) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) {
      if (mode === "all") {
        copyTree(group, src, dst, "all");
      } else if (ARTIFACT_DIRS.includes(entry.name)) {
        copyTree(group, src, dst, "all");
      } else if (!SKIP_DIRS.includes(entry.name)) {
        copyTree(group, src, dst, "package");
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (mode === "package") {
      const keep =
        entry.name === "package.json" || /\.(?:yml|yaml)$/u.test(entry.name) || /^icon\.(svg|png)$/u.test(entry.name);
      if (!keep) continue;
    }
    if (!wanted(entry.name)) continue;
    copyFile(group, src, dst);
  }
}

/**
 * Xoa moi thu trong staging tru hai tep duoc giu.
 * @returns {number} so muc da xoa.
 */
function clean() {
  let removed = 0;
  if (!existsSync(STAGING)) return removed;
  for (const entry of readdirSync(STAGING, { withFileTypes: true })) {
    if (KEEP.has(entry.name)) continue;
    rmSync(join(STAGING, entry.name), { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

/**
 * Doc dependencies cua apps/host/package.json — nguon DUY NHAT cho kernel stock + moi peer.
 * @returns {Record<string, string>} bang ten goi -> version pin.
 */
function hostDependencies() {
  const manifest = JSON.parse(readFileSync(join(REPO, "apps", "host", "package.json"), "utf8"));
  const deps = manifest.dependencies;
  if (deps === undefined || typeof deps !== "object") throw new Error("apps/host/package.json khong khai dependencies");
  return deps;
}

/**
 * Sinh package.json cua ban npm tu manifest cua host.
 * @param {Record<string, string>} dependencies - dependencies cua apps/host.
 * @returns {string} JSON da dinh dang.
 */
function packageManifest(dependencies) {
  const manifest = {
    name: NAME,
    version: VERSION,
    private: false,
    type: "module",
    description: "Galaxy Blackhole harness — boot the DSH host with the blackhole profile (lean npm build)",
    license: "MIT",
    publishConfig: { access: "public" },
    files: ["**"],
    engines: { node: ">=22.6" },
    bin: { bh: "bin/bh.mjs", "blackhole-harness": "bin/bh.mjs" },
    dependencies,
  };
  return JSON.stringify(manifest, null, 2) + String.fromCharCode(10);
}

/**
 * Shim bin: chay apps/cli/src/main.ts bang chinh node dang goi lenh.
 * Vi sao can: Node chay thang .ts can co type stripping; Node 22.6–22.17 doi co, 22.18+ bat san.
 * @returns {string} noi dung tep bin/bh.mjs.
 */
function binShim() {
  return [
    "#!/usr/bin/env node",
    "/**",
    " * author Bùi Trọng Hiếu",
    " * email kevinbui210191@gmail.com",
    " * create date 15/10/2026",
    " * modify date 12/11/2026",
    " * desc Shim bin cua goi npm: chay apps/cli/src/main.ts bang node dang goi, tu bat co strip-types khi can",
    " */",
    "",
    'import { spawn } from "node:child_process";',
    'import { existsSync } from "node:fs";',
    'import { dirname, join } from "node:path";',
    'import { fileURLToPath } from "node:url";',
    "",
    "/** Thu muc chua shim nay (bin/ cua goi da cai). */",
    "const HERE = dirname(fileURLToPath(import.meta.url));",
    "/** Ban da build (bun build) — Node chay duoc moi phien ban; .ts trong node_modules thi KHONG. */",
    'const BUILT = join(HERE, "..", "apps", "cli", "lib", "main.js");',
    'const SOURCE = join(HERE, "..", "apps", "cli", "src", "main.ts");',
    'const MAIN = existsSync(BUILT) ? BUILT : SOURCE;',
    "",
    "/** Chi can co strip-types khi roi ve nguon .ts (Node 22.6–22.17). */",
    'const [major, minor] = process.versions.node.split(".").map((part) => Number(part));',
    "const NEEDS_FLAG = MAIN === SOURCE && (major ?? 0) < 23 && !((major ?? 0) === 22 && (minor ?? 0) >= 18);",
    "",
    'const flags = NEEDS_FLAG ? ["--experimental-strip-types"] : [];',
    'const child = spawn(process.execPath, [...flags, MAIN, ...process.argv.slice(2)], { stdio: "inherit" });',
    'child.on("exit", (code, signal) => {',
    "  if (signal !== null) process.kill(process.pid, signal);",
    "  else process.exit(code ?? 1);",
    "});",
    "",
  ].join(String.fromCharCode(10));
}

/**
 * Build launcher thanh MOT tep .js tu chua (bun build) — Node KHONG strip-types duoc tep trong node_modules.
 * Nhan: khong. Tra: kich thuoc tep main.js da ghi.
 * @returns {number} so byte cua bundle.
 */
function bundleLauncher() {
  const bun = [join(homedir(), ".bun", "bin", "bun"), "bun"].find((bin) => bin === "bun" || existsSync(bin));
  // Ghi vao lib/ (thu muc DAU RA BUILD — cong lint bo qua "lib"), van giu do sau 3 cap de repoRoot() dung.
  const out = join(STAGING, "apps", "cli", "lib", "main.js");
  mkdirSync(dirname(out), { recursive: true });
  if (bun === undefined) throw new Error("khong tim thay bun de build launcher (can bun build)");
  const result = spawnSync(bun, ["build", join(REPO, "apps", "cli", "src", "main.ts"), "--target=node", "--format=esm", "--outfile", out], {
    cwd: REPO,
    encoding: "utf8",
    timeout: 120000,
  });
  if (result.status !== 0 || !existsSync(out)) {
    throw new Error("bun build that bai: " + String(result.stderr ?? "").slice(0, 400));
  }
  const size = statSync(out).size;
  // Bundle la artefact THAT SU chay duoc: ghi vao nhom cli va khong tinh lai tep nguon .ts.
  count("cli", size);
  return size;
}

// ---------------------------------------------------------------- staging

const removed = clean();
console.log("[prepare] staging: " + STAGING);
console.log("[prepare] da don " + String(removed) + " muc cu");

// 1. package.json + bin + LICENSE/NOTICES
writeFileSync(join(STAGING, "package.json"), packageManifest(hostDependencies()), "utf8");
mkdirSync(join(STAGING, "bin"), { recursive: true });
writeFileSync(join(STAGING, "bin", "bh.mjs"), binShim(), "utf8");
count("root", statSync(join(STAGING, "package.json")).size + statSync(join(STAGING, "bin", "bh.mjs")).size);
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
  const from = join(REPO, name);
  if (!existsSync(from)) continue;
  copyFile("root", from, join(STAGING, name));
}

// 2. launcher: apps/cli (nguon .ts) + manifest; apps/host/package.json (pin kernel de lenh doctor doc)
copyFile("cli", join(REPO, "apps", "cli", "package.json"), join(STAGING, "apps", "cli", "package.json"));
copyTree("cli", join(REPO, "apps", "cli", "src"), join(STAGING, "apps", "cli", "src"), "all");
copyFile("cli", join(REPO, "apps", "host", "package.json"), join(STAGING, "apps", "host", "package.json"));
const bundleSize = bundleLauncher();
console.log("[prepare] launcher da build: apps/cli/lib/main.js (" + (bundleSize / 1024).toFixed(1) + " KB) — .ts nguon giu lai chi de doi chieu");

// 3. packages/: chi artefact chay duoc (package.json + lib + locale + assets + runtime + presets + patch)
const packagesRoot = join(REPO, "packages");
for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
  const tang = join(packagesRoot, entry.name);
  if (existsSync(join(tang, "package.json"))) {
    copyTree("packages", tang, join(STAGING, "packages", entry.name), "package");
    continue;
  }
  for (const con of readdirSync(tang, { withFileTypes: true })) {
    if (!con.isDirectory() || con.name.startsWith(".")) continue;
    const goi = join(tang, con.name);
    if (!existsSync(join(goi, "package.json"))) continue;
    copyTree("packages", goi, join(STAGING, "packages", entry.name, con.name), "package");
  }
}

// 4. profiles/blackhole: template patch + danh sach bundle (bo ban sao .bak-*)
const profileRoot = join(REPO, "profiles", "blackhole");
for (const entry of readdirSync(profileRoot, { withFileTypes: true })) {
  if (!entry.isFile() || entry.name.includes(".bak-")) continue;
  if (!(entry.name.endsWith(".yml") || entry.name === "package.json")) continue;
  copyFile("profiles", join(profileRoot, entry.name), join(STAGING, "profiles", "blackhole", entry.name));
}

// 5. tools cua launcher: mount.ts import thang tools/p1b/denta-profile.ts
copyFile("tools", join(REPO, "tools", "p1b", "denta-profile.ts"), join(STAGING, "tools", "p1b", "denta-profile.ts"));

// ---------------------------------------------------------------- report

let files = 0;
let bytes = 0;
console.log("[prepare] nhom             tep      MB");
for (const [group, value] of [...stats.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  files += value.files;
  bytes += value.bytes;
  console.log("[prepare] " + group.padEnd(16) + String(value.files).padStart(6) + "  " + (value.bytes / 1048576).toFixed(2).padStart(7));
}
console.log("[prepare] TONG " + String(files) + " tep · " + (bytes / 1048576).toFixed(2) + " MB (chua nen)");
console.log("[prepare] khong co .gbh-embedded (ban npm chay tu thu muc that, khong phai host nhung)");
console.log("[prepare] lock cua apps/host: " + (existsSync(join(REPO, "apps", "host", "package-lock.json")) ? "co — chep" : "khong co (deps pin dung version nen npm cai dung)"));
console.log("[prepare] xong: " + relative(REPO, STAGING) + " — publish bang: cd npm-package && npm publish --access public");
