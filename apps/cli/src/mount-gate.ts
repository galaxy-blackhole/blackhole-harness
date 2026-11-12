/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Chon runtime chay cong chan mount (tools/check/rows.ts) duoi CA Bun lan Node, do bun tren PATH/GBH_BUN
 *      khi Node khong chay duoc script, va luu ket qua gate theo dau nguon de boot khong phai quet lai
 *      12/11/2026: tach khoi mount.ts — truoc day blockedPackages() luon goi `process.execPath run <script>`;
 *      app desktop chay launcher bang Node nen lenh do vo nghia va cong chan mount IM LANG khong chay
 *      12/11/2026: cache ket qua theo dau nguon (mtime/size cua moi input) — gate that su chay mat ~2,6 s
 *      (183 goi Bun.build), vuot ngan sach boot ~1 s neu chay lai moi luot
 *      12/11/2026: scriptNeedsBun() — doan TINH tren noi dung script: dung API bun ma khong co nhanh du
 *      phong thi di thang bun, khong dot mot lan spawn node chac chan hong
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Runtime dung de chay script kiem tra. */
export type ScriptRuntime = "bun" | "node";

/** Mot lenh chay script da giai xong (command + args), kern nguon da chon. */
export interface ScriptCommand {
  /** Binary tuyet doi hoac ten tren PATH. */
  command: string;
  /** Tham so, KHONG gom ten script o vi tri dau tuy runtime. */
  args: string[];
  /** Runtime cua lenh. */
  runtime: ScriptRuntime;
  /** Nguon da chon binary: `process.execPath`, `GBH_BUN`, `~/.bun/bin/bun`, `PATH`… */
  source: string;
}

/** Ket qua mot luot cong chan mount. */
export interface GateRun {
  /** stdout+stderr cua gate (rong khi bi bo qua / loi truoc khi chay). */
  output: string;
  /** Dong mo ta ngan de in trong log boot: runtime · thoi gian · cache hay khong. */
  detail: string;
  /** Canh bao MOT DONG khi cong bi BO QUA: vi sao + cach khac phuc (cai bun / GBH_BUN=<path>). */
  warning?: string;
  /** true khi ket qua lay tu cache (khong spawn tien trinh). */
  cached: boolean;
  /** So ms cua ca luot (cache hoac spawn). */
  ms: number;
}

/** Lua chon cho {@link runMountGate} — moi phu thuoc ben ngoai deu tiem duoc (test khong spawn that). */
export interface GateOptions {
  /** Duong dan tuyet doi toi tools/check/rows.ts. */
  script: string;
  /** Noi dung script de doan runtime (mac dinh doc tu dia) — de test tiem ma khong can tep that. */
  scriptSource?: string;
  /** Thu muc lam viec cua tien trinh con (goc repo). */
  cwd: string;
  /** Home cua app — noi ghi cache ket qua. */
  home: string;
  /** Moi truong tiem (mac dinh process.env). */
  env?: NodeJS.ProcessEnv;
  /** Timeout moi tien trinh con (mac dinh 120 s). */
  timeoutMs?: number;
  /** Tien trinh hien tai co phai Bun khong (mac dinh: do globalThis.Bun). */
  bunProcess?: boolean;
  /** Binary cua tien trinh hien tai (mac dinh process.execPath). */
  execPath?: string;
  /** Ham do bun (mac dinh {@link findBun}); tra undefined khi may khong co bun. */
  findBunPath?: () => string | undefined;
  /** Ham chay lenh (mac dinh spawnSync) — test tiem ham gia. */
  run?: (command: ScriptCommand, cwd: string, timeoutMs: number) => { output: string; status: number | null; error?: string };
  /** Bo qua cache, chay lai that (GBH_GATE_REFRESH=1). */
  refresh?: boolean;
}

/** Tien to cua tep cache trong home cua app. */
const CACHE_NAME = ".gbh-mount-gate.json";

/** Phien ban cache: doi khi cach tinh khoa thay doi. */
const CACHE_VERSION = 1;

/** Cac tep nguon cua gate: doi mot byte la ket qua co the doi ⇒ phai nam trong khoa cache. */
const GATE_SOURCES: readonly string[] = [
  "tools/check/rows.ts",
  "tools/check/rows-scan.ts",
  "tools/check/dangling.ts",
  "tools/check/row-ids.ts",
  "tools/check/surface.ts",
  "tools/scaffold/lib.ts",
  "apps/cli/src/paths.ts",
  "apps/cli/src/mount-gate.ts",
];

/**
 * Tien trinh hien tai co phai Bun khong.
 * @returns true khi `globalThis.Bun` ton tai (Bun); false voi Node/Electron.
 */
export function isBunProcess(): boolean {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== "undefined") return true;
  // 12/11/2026 — `process.versions.bun` la dau hieu thu hai (co khi global `Bun` bi vo hieu boi sandbox cua
  // tien trinh nhung runtime van la bun). Chi can MOT trong hai ⇒ giu nguyen `<execPath> run <script>`.
  return typeof (process.versions as { bun?: unknown }).bun === "string";
}

/**
 * Doan TINH tren NOI DUNG script: no co BAT BUOC phai chay bang bun khong.
 *
 * Vi sao phai doan TRUOC khi spawn: mot script goi `Bun.build(...)` khong co nhanh du phong thi
 * `node --experimental-strip-types <script>` chi ton mot lan spawn roi chet (ReferenceError: Bun is not
 * defined) ⇒ boot cham ma van khong co phan quyet. Script tu xu ly ca hai runtime (co nhanh
 * `typeof Bun === "undefined"` / `typeof Bun !== "undefined"`) thi Node chay duoc ⇒ tra false.
 * Luu y: phep do la BAO THU — chuoi "Bun." trong comment cung lam no tra true; khi do gate chi mat
 * duong Node chu khong mat phan quyet (van thu bun, van canh bao khi khong co bun).
 * @param source - noi dung tep script (doc tu dia).
 * @returns true khi script dung API bun ma KHONG co nhanh du phong nao cho Node.
 */
export function scriptNeedsBun(source: string): boolean {
  if (!/\bBun\s*\./u.test(source)) return false;
  return !/typeof\s+Bun\b/u.test(source);
}

/**
 * Doc noi dung script de doan runtime — khong nem loi khi tep bien mat.
 * @param script - duong dan tuyet doi toi script.
 * @returns noi dung tep, hoac undefined khi khong doc duoc (khi do cu thu Node nhu cu).
 */
export function readScriptSource(script: string): string | undefined {
  try {
    return readFileSync(script, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * File co ton tai va la tep thuong (khong phai thu muc/symlink gay).
 * @param path - duong dan can kiem.
 * @returns true khi doc duoc stat va la file.
 */
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Do binary bun theo thu tu: `GBH_BUN` → `~/.bun/bin/bun` → Homebrew → /usr/local → PATH.
 * Vi sao khong chi dua vao PATH: app desktop chay tu Finder voi PATH toi thieu
 * (/usr/bin:/bin:/usr/sbin:/sbin) nen bun cai trong ~/.bun KHONG bao gio thay neu chi doc PATH.
 * @param env - moi truong can doc (mac dinh process.env).
 * @param exists - ham kiem ton tai (mac dinh isFile) de test tiem duoc.
 * @returns duong dan bun dau tien ton tai, hoac undefined.
 */
export function findBun(env: NodeJS.ProcessEnv = process.env, exists: (path: string) => boolean = isFile): string | undefined {
  const pinned = (env.GBH_BUN ?? "").trim();
  if (pinned !== "" && exists(pinned)) return pinned;
  const home = env.HOME ?? homedir();
  const candidates = [join(home, ".bun", "bin", "bun"), "/opt/homebrew/bin/bun", "/usr/local/bin/bun"];
  for (const candidate of candidates) if (exists(candidate)) return candidate;
  for (const dir of (env.PATH ?? "").split(":")) {
    if (dir === "") continue;
    const candidate = join(dir, "bun");
    if (exists(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Lenh chay script bang Node — KHONG BAO GIO dung `run` (chi Bun moi co lenh con do).
 * @param script - duong dan script .ts.
 * @param execPath - binary node (mac dinh process.execPath).
 * @param extra - tham so them sau ten script.
 * @returns lenh da giai.
 */
export function nodeScriptCommand(script: string, execPath: string = process.execPath, extra: readonly string[] = []): ScriptCommand {
  return { command: execPath, args: ["--experimental-strip-types", script, ...extra], runtime: "node", source: "process.execPath" };
}

/**
 * Lenh chay script bang Bun (giu nguyen hinh thuc cu: `bun run <script>`).
 * @param bunPath - binary bun.
 * @param script - duong dan script.
 * @param extra - tham so them sau ten script.
 * @param source - nhan nguon binary de in log.
 * @returns lenh da giai.
 */
export function bunScriptCommand(bunPath: string, script: string, extra: readonly string[] = [], source = "bun"): ScriptCommand {
  return { command: bunPath, args: ["run", script, ...extra], runtime: "bun", source };
}

/**
 * Lenh chay mot script CAN bun (vi du build.ts cua goi: dung Bun.build).
 * Dung cho duong build: Bun dang chay → chinh no; Node → bun do duoc tren may.
 * @param script - duong dan script.
 * @param extra - tham so them.
 * @param env - moi truong do bun.
 * @returns lenh, hoac undefined khi may khong co bun.
 */
export function bunOnlyCommand(script: string, extra: readonly string[] = [], env: NodeJS.ProcessEnv = process.env): ScriptCommand | undefined {
  if (isBunProcess()) return bunScriptCommand(process.execPath, script, extra, "process.execPath (Bun)");
  const bun = findBun(env);
  return bun === undefined ? undefined : bunScriptCommand(bun, script, extra, bun);
}

/**
 * Chay mot lenh script va gop stdout+stderr.
 * @param command - lenh da giai.
 * @param cwd - thu muc lam viec.
 * @param timeoutMs - timeout.
 * @returns van ban gop, ma thoat va loi spawn (neu co).
 */
function spawnScript(command: ScriptCommand, cwd: string, timeoutMs: number): { output: string; status: number | null; error?: string } {
  const result = spawnSync(command.command, command.args, { cwd, encoding: "utf8", timeout: timeoutMs });
  return {
    output: (result.stdout ?? "") + (result.stderr ?? ""),
    status: result.status,
    ...(result.error === undefined ? {} : { error: String(result.error) }),
  };
}

/**
 * Output co phai bang phan quyet cua rows.ts khong (dong tieu de `| Package | Muc do |`).
 * @param output - stdout+stderr cua tien trinh.
 * @returns true khi gate da chay den buoc in bang.
 */
export function hasVerdictTable(output: string): boolean {
  return /^\| Package \|/mu.test(output);
}

/**
 * Bam mot tep theo noi dung (tep nguon cua gate nho nen hash thang noi dung la chac nhat).
 * @param hash - hash dang ghi.
 * @param path - duong dan tep.
 * @param label - nhan dua vao hash (duong dan tuong doi, on dinh giua cac may).
 * @returns khong.
 */
function hashFile(hash: ReturnType<typeof createHash>, path: string, label: string): void {
  hash.update(label);
  if (!existsSync(path)) {
    hash.update("missing");
    return;
  }
  hash.update(readFileSync(path));
}

/**
 * Bam dau vet cua mot tep theo (size, mtime) — du de bat moi lan sua ma khong phai doc noi dung.
 * @param hash - hash dang ghi.
 * @param path - duong dan tep.
 * @param label - nhan dua vao hash.
 * @returns khong.
 */
function hashStat(hash: ReturnType<typeof createHash>, path: string, label: string): void {
  try {
    const st = statSync(path);
    hash.update(label + ":" + String(st.size) + ":" + String(Math.trunc(st.mtimeMs)));
  } catch {
    hash.update(label + ":missing");
  }
}

/**
 * Bam toan bo cay tep trong mot thu muc (size + mtime) de biet nguon co doi khong.
 * @param hash - hash dang ghi.
 * @param base - thu muc goc.
 * @param label - nhan dua vao hash.
 * @returns so tep da bam.
 */
function hashTree(hash: ReturnType<typeof createHash>, base: string, label: string): number {
  let count = 0;
  const walk = (dir: string): void => {
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch {
      return;
    }
    for (const name of names) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const abs = join(dir, name);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(abs);
      else {
        hash.update(label + "/" + abs.slice(base.length) + ":" + String(st.size) + ":" + String(Math.trunc(st.mtimeMs)));
        count += 1;
      }
    }
  };
  walk(base);
  return count;
}

/**
 * Liet ke cac thu muc package co `gbh.row` (cung quy tac voi rows.ts: packages/host + packages/client).
 * @param repo - goc repo.
 * @returns duong dan tuyet doi cua tung package, theo thu tu on dinh.
 */
function rowPackageDirs(repo: string): string[] {
  const out: string[] = [];
  for (const area of ["host", "client"]) {
    const dir = join(repo, "packages", area);
    let names: string[];
    try {
      names = readdirSync(dir).sort();
    } catch {
      continue;
    }
    for (const name of names) {
      const pkgDir = join(dir, name);
      if (!existsSync(join(pkgDir, "package.json"))) continue;
      try {
        const json = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as { gbh?: { row?: unknown } };
        if (json.gbh?.row !== undefined) out.push(pkgDir);
      } catch {
        // Manifest hong: rows.ts se bao loi that khi chay; o day chi can khoa cache on dinh.
      }
    }
  }
  return out;
}

/**
 * Tinh khoa cache cua ket qua gate tu MOI dau vao ma rows.ts doc.
 *
 * Vi sao can: gate that su chay ~2,6 s (183 goi Bun.build) — chay lai moi luot boot se vuot ngan sach
 * ~1 s. Khoa gom: tep nguon cua gate, ma tran parity, manifest + src + lib cua tung package row,
 * ban dang mount trong profile, patch dang chay va ban kernel stock.
 * @param repo - goc repo.
 * @param home - home cua app.
 * @param mode - `bun-build` (co Bun.build) hoac `node-prebuilt` (Node doc lib dung san).
 * @returns chuoi sha256 hex.
 */
export function gateFingerprint(repo: string, home: string, mode: string): string {
  const hash = createHash("sha256");
  hash.update("gbh-mount-gate:" + String(CACHE_VERSION) + ":" + mode + ":node" + process.versions.node);
  hash.update("home:" + home);
  for (const rel of GATE_SOURCES) hashFile(hash, join(repo, rel), rel);
  hashFile(hash, join(repo, "docs", "PARITY-MATRIX.md"), "docs/PARITY-MATRIX.md");
  hashFile(hash, join(home, "app.patch.yml"), "app.patch.yml");
  // Kernel stock: rows.ts so export/slot voi ban goc. Cai lai kernel doi mtime manifest ⇒ khoa doi.
  const stock = join(repo, "apps", "host", "node_modules", "@deepseek-ai");
  let stockNames: string[] = [];
  try {
    stockNames = readdirSync(stock).sort();
  } catch {
    // Khong co kernel: rows.ts se bao "khong thay ban goc"; khoa van on dinh.
  }
  for (const name of stockNames) hashStat(hash, join(stock, name, "package.json"), "@deepseek-ai/" + name);
  // mount.ts ghi ban cai vao <home>/profiles/node_modules (profileModulesDir).
  const profileModules = join(home, "profiles", "node_modules");
  for (const pkgDir of rowPackageDirs(repo)) {
    hash.update("pkg:" + pkgDir.slice(repo.length));
    const manifest = readFileSync(join(pkgDir, "package.json"), "utf8");
    hash.update("package.json");
    hash.update(manifest);
    hashStat(hash, join(pkgDir, "build.ts"), "build.ts");
    hashStat(hash, join(pkgDir, "lib", "index.js"), "lib/index.js");
    hashStat(hash, join(pkgDir, "lib", "client.js"), "lib/client.js");
    hashTree(hash, join(pkgDir, "src"), "src");
    const name = (JSON.parse(manifest) as { name?: string }).name ?? "";
    if (name !== "") {
      hashStat(hash, join(profileModules, name, "lib", "index.js"), "profile/index.js");
      hashStat(hash, join(profileModules, name, "lib", "client.js"), "profile/client.js");
    }
  }
  return hash.digest("hex");
}

/**
 * Doc cache ket qua gate trong home cua app.
 * @param home - home cua app.
 * @param key - khoa hien tai.
 * @returns output + runtime da luu khi khoa khop, nguoc lai undefined.
 */
export function readGateCache(home: string, key: string): { output: string; runtime: string } | undefined {
  try {
    const parsed = JSON.parse(readFileSync(join(home, CACHE_NAME), "utf8")) as { version?: unknown; key?: unknown; output?: unknown; runtime?: unknown };
    if (parsed.version !== CACHE_VERSION || parsed.key !== key || typeof parsed.output !== "string") return undefined;
    if (!hasVerdictTable(parsed.output)) return undefined;
    return { output: parsed.output, runtime: typeof parsed.runtime === "string" ? parsed.runtime : "gate" };
  } catch {
    return undefined;
  }
}

/**
 * Ghi cache ket qua gate (chi ghi khi output co bang phan quyet).
 * @param home - home cua app.
 * @param key - khoa hien tai.
 * @param output - stdout+stderr cua gate.
 * @param runtime - runtime da chay gate (node/bun), de log cache noi ro.
 * @returns khong; loi ghi cache khong duoc lam hong boot.
 */
export function writeGateCache(home: string, key: string, output: string, runtime = "gate"): void {
  try {
    writeFileSync(join(home, CACHE_NAME), JSON.stringify({ version: CACHE_VERSION, key, output, runtime, savedAt: new Date().toISOString() }) + "\n", "utf8");
  } catch {
    // Cache chi la toi uu toc do: khong ghi duoc thi luot sau chay lai, khong anh huong tinh dung.
  }
}

/**
 * Chay cong chan mount duoi runtime phu hop va tra ket qua cho mount.ts phan tich.
 *
 * Thu tu: Bun dang chay → `bun run` (giu nguyen hanh vi cu); Node + script KHONG bat buoc bun →
 * `node --experimental-strip-types <script>`; Node that bai hoac script dung API bun → bun do duoc tren
 * PATH/GBH_BUN; khong co bun → MOT dong canh bao RO RANG (vi sao + cai bun/GBH_BUN), khong im lang va
 * KHONG lam fail boot.
 * @param options - script, cwd, home, moi truong va cac ham tiem de test.
 * @returns output + dong mo ta + canh bao (neu bi bo qua).
 */
export function runMountGate(options: GateOptions): GateRun {
  const started = performance.now();
  const env = options.env ?? process.env;
  const refresh = options.refresh === true || (env.GBH_GATE_REFRESH ?? "").trim() === "1";
  const bunProcess = options.bunProcess ?? isBunProcess();
  const execPath = options.execPath ?? process.execPath;
  const run = options.run ?? spawnScript;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const mode = bunProcess ? "bun-build" : "node-prebuilt";
  // Khoa cache chi la toi uu: loi doc/ghi (tep bien mat, quyen) KHONG duoc lam hong boot.
  let key: string | undefined;
  try {
    key = gateFingerprint(options.cwd, options.home, mode);
  } catch {
    key = undefined;
  }
  if (!refresh && key !== undefined) {
    const cached = readGateCache(options.home, key);
    if (cached !== undefined) {
      return { output: cached.output, detail: "cache · " + cached.runtime + " (nguon khong doi) · " + (performance.now() - started).toFixed(0) + " ms", cached: true, ms: performance.now() - started };
    }
  }
  const describe = (command: ScriptCommand, result: { output: string; status: number | null; error?: string }, extra = ""): GateRun => {
    const ms = performance.now() - started;
    const detail = command.runtime + " (" + command.source + ") · " + ms.toFixed(0) + " ms" + extra;
    return { output: result.output, detail, cached: false, ms };
  };
  if (bunProcess) {
    const command = bunScriptCommand(execPath, options.script, [], "process.execPath (Bun)");
    const result = run(command, options.cwd, timeoutMs);
    if (hasVerdictTable(result.output)) {
      if (key !== undefined) writeGateCache(options.home, key, result.output, command.runtime);
      return describe(command, result);
    }
    return { ...describe(command, result), warning: "cong chan mount loi: " + (result.error ?? (result.output.trim().slice(0, 200) || "khong ro")) };
  }
  // 12/11/2026 — DOAN TINH TRUOC KHI SPAWN: script dung API bun ma khong co nhanh du phong thi lenh
  // `node …` chac chan hong ⇒ di THANG bun, khong dot mot lan spawn vo ich roi moi that bai.
  const source = options.scriptSource ?? readScriptSource(options.script);
  const requiresBun = source !== undefined && scriptNeedsBun(source);
  const node = nodeScriptCommand(options.script, execPath);
  const nodeResult = requiresBun ? undefined : run(node, options.cwd, timeoutMs);
  if (nodeResult !== undefined && hasVerdictTable(nodeResult.output)) {
    if (key !== undefined) writeGateCache(options.home, key, nodeResult.output, node.runtime);
    return describe(node, nodeResult);
  }
  // Node khong chay duoc script (script can bun / Node qua cu / script hong) ⇒ thu bun, khong co thi BAO RO.
  const bunPath = (options.findBunPath ?? (() => findBun(env)))();
  if (bunPath !== undefined) {
    const bun = bunScriptCommand(bunPath, options.script, [], bunPath);
    const bunResult = run(bun, options.cwd, timeoutMs);
    if (hasVerdictTable(bunResult.output)) {
      if (key !== undefined) writeGateCache(options.home, key, bunResult.output, bun.runtime);
      return describe(bun, bunResult, requiresBun ? " · script can bun" : " · node loi nen dung bun");
    }
    return { ...describe(bun, bunResult), warning: "cong chan mount loi: " + (bunResult.error ?? (bunResult.output.trim().slice(0, 200) || "khong ro")) };
  }
  // KHONG runtime nao chay duoc: MOT dong canh bao ro rang (mount.ts them tien to [bh]), khong im lang,
  // va KHONG lam fail boot — chi la cong chan mount bi bo qua, duong mount van chay nhu truoc 12/11/2026.
  const ms = performance.now() - started;
  const loiNode = nodeResult === undefined ? "" : (nodeResult.error ?? (nodeResult.output.trim().split(String.fromCharCode(10))[0] ?? "")).slice(0, 160);
  const viSao = requiresBun
    ? "script " + options.script + " dùng API bun (Bun.build) nên Node không chạy được"
    : "node không chạy được " + options.script + (loiNode === "" ? "" : " (" + loiNode + ")");
  return {
    output: nodeResult?.output ?? "",
    detail: requiresBun
      ? "bo qua node (script can bun) · " + ms.toFixed(0) + " ms"
      : "node (" + node.source + ") · " + ms.toFixed(0) + " ms",
    warning: "cổng chặn mount bị bỏ qua: " + viSao + " và máy không có bun — cài bun hoặc đặt GBH_BUN=<đường dẫn bun>",
    cached: false,
    ms,
  };
}
