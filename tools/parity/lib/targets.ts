/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Định nghĩa các target dump-config: app của ta, oracle B tái lập được, oracle A dò từ tiến trình đang chạy
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  ORACLE_A_PORT,
  REPO_ROOT,
  STOCK_PORT,
  appHome,
  credentialsPath,
  ensureDir,
  fileExists,
  homeDir,
  parityPath,
  repoPath,
  stockHome,
} from "./paths.ts";

/** Một target dump-config: chạy `dsh --dump-config` trong một môi trường xác định. */
export interface DumpTarget {
  /** Khoá ngắn dùng trong tên file artifact. */
  key: string;
  /** Nhãn hiển thị trong report. */
  label: string;
  /** Giá trị `DSH_HOME` truyền cho tiến trình. */
  home: string;
  /** Tên profile. */
  profile: string;
  /** Đường dẫn `bin.js` của harness. */
  bin: string;
  /** Thư mục làm việc khi chạy. */
  cwd: string;
  /** Các overlay `--patch` theo thứ tự. */
  patches: string[];
  /** Ghi chú vì sao target này tồn tại. */
  notes: string[];
}

/** Thông tin dò được từ tiến trình oracle A đang chạy. */
export interface LiveOracle {
  /** Cổng đang được listen. */
  port: number;
  /** PID của tiến trình node. */
  pid: number;
  /** Đường dẫn `bin.js` đang chạy. */
  bin: string;
  /** Profile đang boot. */
  profile: string;
  /** Các patch đang áp. */
  patches: string[];
  /** Home suy ra từ các file tiến trình đang mở (null nếu không dò được). */
  home: string | null;
  /** Dòng lệnh đầy đủ (đã lược phần không cần). */
  command: string;
}

/**
 * Tìm PID đang listen một cổng TCP.
 * @param port số cổng.
 * @returns PID hoặc null nếu không có tiến trình nào listen.
 */
export function discoverListenPid(port: number): number | null {
  const probe = spawnSync("lsof", ["-nP", "-tiTCP:" + String(port), "-sTCP:LISTEN"], { encoding: "utf8" });
  if (probe.status !== 0 || probe.stdout.trim() === "") return null;
  const first = probe.stdout.trim().split("\n")[0];
  const pid = Number(first);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

/**
 * Đọc dòng lệnh đầy đủ của một tiến trình.
 * @param pid PID cần đọc.
 * @returns dòng lệnh, hoặc null nếu không đọc được.
 */
export function readProcessCommand(pid: number): string | null {
  const probe = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  if (probe.status !== 0) return null;
  const command = probe.stdout.trim();
  return command.length > 0 ? command : null;
}

/**
 * Liệt kê đường dẫn file mà một tiến trình đang mở (dùng để suy ra DSH_HOME).
 * @param pid PID cần đọc.
 * @returns danh sách đường dẫn tuyệt đối.
 */
export function openPathsOf(pid: number): string[] {
  const probe = spawnSync("lsof", ["-p", String(pid), "-Fn"], { encoding: "utf8" });
  if (probe.status !== 0) return [];
  return probe.stdout
    .split("\n")
    .filter((line) => line.startsWith("n/"))
    .map((line) => line.slice(1));
}

/**
 * Bóc `bin.js`, profile và các patch từ dòng lệnh của harness.
 * @param command dòng lệnh đầy đủ.
 * @returns thông tin đã bóc, hoặc null nếu không phải lệnh harness.
 */
export function parseDshCommand(command: string): { bin: string; profile: string; patches: string[] } | null {
  const tokens = command.split(" ").filter((token) => token.length > 0);
  let bin: string | null = null;
  let profile = "";
  const patches: string[] = [];
  tokens.forEach((token, index) => {
    if (bin === null && token.endsWith("bin.js")) bin = token;
    if (token === "--profile") profile = tokens[index + 1] ?? "";
    if (token === "--patch") {
      const value = tokens[index + 1];
      if (value !== undefined) patches.push(value);
    }
  });
  if (bin === null || profile === "") return null;
  return { bin, profile, patches };
}

/**
 * Suy ra `DSH_HOME` từ các đường dẫn tiến trình đang mở.
 * @param paths đường dẫn file đang mở.
 * @param profile tên profile của tiến trình.
 * @returns tiền tố home, hoặc null nếu không suy được.
 */
export function homeFromPaths(paths: readonly string[], profile: string): string | null {
  const marker = "/profiles/" + profile + "/";
  for (const path of paths) {
    const at = path.indexOf(marker);
    if (at > 0) return path.slice(0, at);
  }
  return null;
}

/**
 * Dò oracle A: tiến trình đang listen cổng 4001 → bin/profile/patch/home thật của nó.
 * @param port cổng của oracle A, mặc định 4001.
 * @returns thông tin oracle A, hoặc null nếu không có tiến trình / không dò được.
 */
export function discoverLiveOracle(port: number = ORACLE_A_PORT): LiveOracle | null {
  const pid = discoverListenPid(port);
  if (pid === null) return null;
  const command = readProcessCommand(pid);
  if (command === null) return null;
  const parsed = parseDshCommand(command);
  if (parsed === null) return null;
  const home = homeFromPaths(openPathsOf(pid), parsed.profile);
  return {
    port,
    pid,
    bin: parsed.bin,
    profile: parsed.profile,
    patches: parsed.patches,
    home,
    command: command.replace(/\s+/gu, " ").slice(0, 600),
  };
}

/**
 * Tệp patch của app: dùng bản thật nếu `bh host` đã sinh, không thì sinh bản tương đương trong `.parity/tmp`.
 * @returns đường dẫn patch và cờ cho biết có phải bản sinh tạm hay không.
 */
export function appPatchFile(): { file: string; generated: boolean } {
  const real = repoPath("profiles", "blackhole", "app.patch.yml");
  if (fileExists(real)) return { file: real, generated: false };
  const generated = parityPath("tmp", "app.patch.yml");
  ensureDir(dirname(generated));
  const rows = [
    "# Generated by tools/parity — tương đương profiles/blackhole/app.patch.yml do `bh host` sinh.",
    "- id: credentials",
    "  config:",
    '    path: "' + credentialsPath() + '"',
    "",
  ].join("\n");
  return { file: writeTextFile(generated, rows), generated: true };
}

/**
 * Ghi một file text và trả về đường dẫn (tách ra để tránh import vòng).
 * @param file đường dẫn đích.
 * @param text nội dung.
 * @returns đường dẫn đã ghi.
 */
function writeTextFile(file: string, text: string): string {
  ensureDir(dirname(file));
  const { writeFileSync } = require("node:fs") as typeof import("node:fs");
  writeFileSync(file, text);
  return file;
}

/**
 * Kiểm tra profile của app đã tồn tại chưa. Parity CỐ Ý không tự tạo: quyền tạo profile thuộc CLI
 * `bh host` (apps/cli), để hai bên không ghi đè nhau khi chạy trên máy sạch.
 * @param home `DSH_HOME` của app.
 * @param profile tên profile.
 * @returns đường dẫn thư mục profile và cờ cho biết đã tồn tại hay chưa.
 */
export function checkProfile(home: string, profile: string): { dir: string; exists: boolean } {
  const dir = join(home, "profiles", profile);
  return { dir, exists: fileExists(join(dir, "package.json")) || fileExists(join(dir, "cordis.yml")) };
}

/**
 * Target `ours` — app của ta (profile `blackhole`, home riêng, patch credentials dùng chung).
 * @returns target dump-config của app.
 */
export function appTarget(): DumpTarget {
  const patch = appPatchFile();
  const profile = checkProfile(appHome(), "blackhole");
  const bin = process.env.GBH_DSH_BIN ?? repoPath("apps", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  return {
    key: "ours",
    label: "app của ta (profile blackhole @ " + String(5439) + ")",
    home: appHome(),
    profile: "blackhole",
    bin,
    cwd: REPO_ROOT,
    patches: [patch.file],
    notes: [
      "home " + appHome(),
      "credentials dùng chung " + credentialsPath(),
      patch.generated ? "patch sinh tạm (bh host chưa chạy)" : "patch thật của app",
      profile.exists
        ? "profile của CLI bh host: " + profile.dir
        : "CHƯA CÓ profile — chạy bh host trước (parity không tự tạo để khỏi tranh quyền)",
    ],
  };
}

/**
 * Target `stock` — Oracle B tái lập được: profile `web` nguyên bản trong home tạm.
 * @returns target dump-config của oracle B.
 */
export function stockTarget(): DumpTarget {
  return {
    key: "stock",
    label: "Oracle B — profile web nguyên bản @ " + String(STOCK_PORT),
    home: stockHome(),
    profile: "web",
    bin: repoPath("apps", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"),
    cwd: REPO_ROOT,
    patches: [],
    notes: ["home tạm tái lập được", "không patch — mốc DSH sạch"],
  };
}

/**
 * Các target biến thể để tách hệ quả VERSION và PATCH quanh oracle A.
 * @param live thông tin oracle A dò được.
 * @returns target `oracleA` (bin đang chạy), `oracleA_rc2` (cùng home+patch, bin của ta) và `oracleA_nopatch` (bỏ hết patch).
 */
export function oracleTargets(live: LiveOracle): DumpTarget[] {
  const home = live.home ?? "";
  const pinnedBin = repoPath("apps", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  const targets: DumpTarget[] = [
    {
      key: "oracleA",
      label: "Oracle A — đúng tiến trình đang chạy cổng " + String(live.port) + " (pid " + String(live.pid) + ")",
      home,
      profile: live.profile,
      bin: live.bin,
      cwd: dirname(live.bin),
      patches: live.patches,
      notes: ["dò từ cmdline thật", live.command],
    },
  ];
  if (fileExists(pinnedBin) && pinnedBin !== live.bin) {
    targets.push({
      key: "oracleA_rc2",
      label: "oracle A nhưng chạy bin của ta (tách hệ quả VERSION)",
      home,
      profile: live.profile,
      bin: pinnedBin,
      cwd: REPO_ROOT,
      patches: live.patches,
      notes: ["cùng home + cùng patch, chỉ khác runtime"],
    });
  }
  targets.push({
    key: "oracleA_nopatch",
    label: "oracle A bỏ hết patch (tách hệ quả PATCH)",
    home,
    profile: live.profile,
    bin: live.bin,
    cwd: dirname(live.bin),
    patches: [],
    notes: ["cùng home + cùng runtime, chỉ khác patch"],
  });
  return targets;
}

/**
 * Phiên bản harness của một `bin.js` (đọc package.json cạnh nó).
 * @param bin đường dẫn `.../@deepseek-ai/dsh/lib/bin.js`.
 * @returns chuỗi version, hoặc null nếu không đọc được.
 */
export function runtimeVersion(bin: string): string | null {
  try {
    const pkgPath = join(dirname(dirname(bin)), "package.json");
    const parsed: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (parsed !== null && typeof parsed === "object" && "version" in parsed) {
      const version = (parsed as { version?: unknown }).version;
      if (typeof version === "string") return version;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Danh sách target mặc định cho lần chạy dump.
 * @param keys khoá target muốn chạy; rỗng nghĩa là chọn tất cả target khả dụng.
 * @returns danh sách target kèm cảnh báo cho những target bị bỏ.
 */
export function listDumpTargets(keys: readonly string[] = []): { targets: DumpTarget[]; skipped: string[] } {
  const skipped: string[] = [];
  const available: DumpTarget[] = [appTarget(), stockTarget()];
  const live = discoverLiveOracle();
  if (live === null || live.home === null) {
    skipped.push(
      live === null
        ? "oracleA: không thấy tiến trình listen cổng " + String(ORACLE_A_PORT) + " (hoặc không dò được cmdline)"
        : "oracleA: không suy được DSH_HOME từ các file đang mở (đặt GBH_PARITY_ORACLE_HOME nếu cần)",
    );
  } else {
    available.push(...oracleTargets(live));
  }
  const wanted = keys.filter((key) => key.length > 0);
  const targets = wanted.length === 0 ? available : available.filter((target) => wanted.includes(target.key));
  for (const key of wanted) {
    if (!available.some((target) => target.key === key)) skipped.push(key + ": không dò được target này");
  }
  return { targets, skipped };
}

/**
 * Đường dẫn `bin.js` mà app đang pin.
 * @returns đường dẫn tuyệt đối.
 */
export function pinnedDshBin(): string {
  return process.env.GBH_DSH_BIN ?? repoPath("apps", "host", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
}

/**
 * Home của người dùng trong hệ Galaxy — chỉ để ghi vào report, không bao giờ ghi vào.
 * @returns đường dẫn `~/.galaxy`.
 */
export function galaxyRoot(): string {
  return join(homeDir(), ".galaxy");
}
