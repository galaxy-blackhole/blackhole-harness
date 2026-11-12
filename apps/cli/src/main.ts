/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Diem vao CLI `bh`: host (boot harness + URL ?token=), doctor (bao cao), dump-config (parity)
 *      12/11/2026: moc do pha "di tru tu dong" + "spawn kernel" (GBH_BOOT_TIMING=1) — do khởi động
 */

import { phase } from "./boot-timing.ts";
import { DEFAULT_PORT, DEFAULT_PROFILE } from "./paths.ts";
import { defaultHostOptions, describeLaunch, resolveLaunch, runDumpConfig, spawnHost } from "./host.ts";
import { runDoctor } from "./doctor.ts";
import { autoMigrate } from "./auto-migrate.ts";
import { defaultNewHome, defaultOldHome, migrateHome, type MigrateReport } from "./migrate.ts";
import { galaxyRoot } from "./paths.ts";
import { isPortAvailable, portOwnerHint } from "./port.ts";

/** Exit codes the Tauri shell branches on. */
export const EXIT = { ok: 0, error: 1, usage: 2, portBusy: 3 } as const;

/** A parsed `bh` invocation. */
export interface CliOptions {
  /** Sub-command to run. */
  command: "host" | "doctor" | "migrate";
  /** Port to bind for `host` (0 = OS picks). */
  port: number;
  /** Profile name under the app home. */
  profile: string;
  /** Let the harness open the OS browser as well as printing the URL. */
  open: boolean;
  /** Fall back to an OS-assigned port when the requested one is busy. */
  autoPort: boolean;
  /** Print the composed plugin tree and exit. */
  dumpConfig: boolean;
  /** Print what a boot would do and exit. */
  dryRun: boolean;
  /** Extra `--patch` overlays, forwarded to the harness. */
  extraPatches: string[];
  /** Home cũ cho `migrate` (chỉ đọc); rỗng = mặc định ~/.galaxy/gbh. */
  migrateFrom: string;
  /** Home mới cho `migrate`; rỗng = mặc định của app (GBH_HOME hoặc ~/.galaxy/blackhole). */
  migrateTo: string;
}

/** Outcome of parsing argv: help, a usage error, or a usable invocation. */
export interface CliParseResult {
  /** True when the caller asked for help. */
  help?: boolean;
  /** Usage error message when argv could not be understood. */
  error?: string;
  /** The invocation, present when neither `help` nor `error` is set. */
  options?: CliOptions;
}

/**
 * The help text of `bh`.
 * @returns the text, ending with the exit-code legend.
 */
export function usage(): string {
  return [
    "bh — Galaxy Blackhole Desktop launcher",
    "",
    "  bh host [--port 5439] [--profile blackhole] [--open] [--auto-port] [--patch <file>]",
    "      boot the harness host of this app and print the ?token= URL the shell opens",
    "  bh host --dry-run",
    "      print runtime, home, patch and argv without booting",
    "  bh host --dump-config",
    "      print the composed plugin tree (parity evidence against the oracle)",
    "  bh doctor [--port 5439]",
    "      report runtime versions, profile, shared credentials and home isolation",
    "  bh migrate [--from ~/.galaxy/gbh] [--to ~/.galaxy/blackhole] [--dry-run]",
    "      copy OLD sessions/storages/attachments into this app's home (never overwrites, never deletes)",
    "",
    "exit codes: 0 ok · 1 error · 2 usage · 3 port busy",
  ].join("\n");
}

/**
 * Parses `bh` arguments. Flags may appear in any order; values are validated here so the boot path
 * never sees a malformed port or profile name.
 * @param argv - arguments after the script name.
 * @returns the invocation, a help request, or a usage error.
 */
export function parseArgs(argv: string[]): CliParseResult {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h") return { help: true };
  if (command !== "host" && command !== "doctor" && command !== "migrate") {
    return { error: `unknown command '${command}'` };
  }
  const options: CliOptions = {
    command,
    port: DEFAULT_PORT,
    profile: DEFAULT_PROFILE,
    open: false,
    autoPort: false,
    dumpConfig: false,
    dryRun: false,
    extraPatches: [],
    migrateFrom: "",
    migrateTo: "",
  };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    switch (flag) {
      case "--port": {
        if (value === undefined || !/^\d+$/u.test(value) || Number(value) > 65535) {
          return { error: `--port needs a number between 0 and 65535, got ${JSON.stringify(value)}` };
        }
        options.port = Number(value);
        index += 1;
        break;
      }
      case "--profile": {
        if (value === undefined || value === "" || value.includes("/") || value.includes("\\")) {
          return { error: `--profile needs a profile name, got ${JSON.stringify(value)}` };
        }
        options.profile = value;
        index += 1;
        break;
      }
      case "--patch": {
        if (value === undefined || value === "") return { error: "--patch needs a file path" };
        options.extraPatches.push(value);
        index += 1;
        break;
      }
      case "--from": {
        if (value === undefined || value === "") return { error: "--from needs a directory" };
        options.migrateFrom = value;
        index += 1;
        break;
      }
      case "--to": {
        if (value === undefined || value === "") return { error: "--to needs a directory" };
        options.migrateTo = value;
        index += 1;
        break;
      }
      case "--open":
        options.open = true;
        break;
      case "--auto-port":
        options.autoPort = true;
        break;
      case "--dump-config":
        options.dumpConfig = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        return { help: true };
      default:
        return { error: `unknown option '${flag}'` };
    }
  }
  return { options };
}

/**
 * Runs one `bh` invocation.
 * @param argv - arguments after the script name.
 * @returns the process exit code: {@link EXIT}.
 */
export async function main(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if (parsed.help === true) {
    console.log(usage());
    return EXIT.ok;
  }
  if (parsed.error !== undefined || parsed.options === undefined) {
    console.error(`bh: ${parsed.error ?? "nothing to do"}`);
    console.error(usage());
    return EXIT.usage;
  }
  const invocation = parsed.options;
  if (invocation.command === "doctor") return await runDoctor(invocation.port);
  if (invocation.command === "migrate") {
    // 10/11/2026 (Lead): người dùng chuyển từ galaxy-code (home ~/.galaxy/gbh) sang bản GBH này
    // (~/.galaxy/blackhole) ⇒ mang phiên/storages/attachments sang, chỉ THÊM, không ghi đè.
    const report = migrateHome({
      from: invocation.migrateFrom === "" ? defaultOldHome() : invocation.migrateFrom,
      to: invocation.migrateTo === "" ? defaultNewHome() : invocation.migrateTo,
      dryRun: invocation.dryRun,
    });
    for (const line of describeMigrate(report)) console.log(line);
    return EXIT.ok;
  }

  // 10/11/2026 (Lead): CÁCH 1 người dùng chọn — lần boot ĐẦU TIÊN của bản GBH tự di trú phiên từ home cũ
  // (~/.galaxy/gbh của galaxy-code) sang home của ta, rồi ghi cờ migrate: true vào credentials.yaml.
  // Chỉ chạy một lần, chỉ THÊM tệp còn thiếu, không ghi đè; lỗi không chặn app khởi động.
  try {
    const ketQua = autoMigrate({ galaxyRoot: galaxyRoot() });
    if (ketQua.ran && ketQua.report !== undefined) {
      for (const line of describeMigrate(ketQua.report)) console.log(line);
      console.log("[bh] migrate: đã ghi cờ migrate: true vào " + ketQua.credentialsPath);
    }
  } catch (error) {
    console.warn("[bh] migrate tự động bỏ qua: " + (error as Error).message);
  }
  // 12/11/2026 — mốc đo: xong phần di trú tự động (chạy mỗi lượt boot theo thiết kế 10/11/2026).
  phase("di tru tu dong");

  const hostOptions = defaultHostOptions({
    port: invocation.port,
    profile: invocation.profile,
    openBrowser: invocation.open,
    autoPort: invocation.autoPort,
    extraPatches: invocation.extraPatches,
  });

  if (invocation.dumpConfig) {
    try {
      return runDumpConfig({ profile: hostOptions.profile, extraPatches: hostOptions.extraPatches });
    } catch (error) {
      console.error(`bh: ${(error as Error).message}`);
      return EXIT.error;
    }
  }

  if (invocation.dryRun) {
    try {
      const launch = resolveLaunch(hostOptions);
      for (const line of describeLaunch(launch)) console.log(line);
      console.log(`port      ${launch.port} ${(await isPortAvailable(launch.port)) ? "trong" : "dang bi chiem"}`);
      return EXIT.ok;
    } catch (error) {
      console.error(`bh: ${(error as Error).message}`);
      return EXIT.error;
    }
  }

  if (hostOptions.port !== 0 && !(await isPortAvailable(hostOptions.port))) {
    const hint = portOwnerHint(hostOptions.port);
    if (hostOptions.autoPort) {
      console.warn(`[bh] port ${hostOptions.port} dang bi chiem (${hint}) -> dung cong do OS cap`);
      hostOptions.port = 0;
    } else {
      console.error(`bh: port ${hostOptions.port} da bi chiem (${hint})`);
      return EXIT.portBusy;
    }
  }

  let host;
  try {
    host = spawnHost(hostOptions);
    phase("spawn kernel");
  } catch (error) {
    console.error(`bh: ${(error as Error).message}`);
    return EXIT.error;
  }
  for (const line of describeLaunch(host.launch)) console.log(`[bh] ${line}`);
  host.ready.catch((error: Error) => {
    console.error(`bh: ${error.message}`);
  });

  const onInterrupt = (): void => void host.child.kill("SIGINT");
  const onTerminate = (): void => void host.child.kill("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  const code = await new Promise<number>((resolve) => {
    host.child.once("exit", (exitCode) => resolve(exitCode ?? EXIT.error));
  });
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
  return code;
}

/**
 * Định dạng báo cáo di trú cho người đọc.
 * Nhận: báo cáo của `migrateHome`.
 * Trả: các dòng văn bản, kèm nhắc sao lưu và cách chạy thật.
 */
export function describeMigrate(report: MigrateReport): string[] {
  const dong: string[] = [];
  dong.push(`[bh] migrate ${report.dryRun ? "(chỉ in kế hoạch) " : ""}${report.from} -> ${report.to}`);
  for (const muc of report.areas) {
    const mb = (muc.bytes / 1024 / 1024).toFixed(1);
    dong.push(`  ${muc.area}: chép ${muc.copied} tệp (${mb} MB) · bỏ qua ${muc.skipped} tệp đã có`);
  }
  for (const ten of report.missing) dong.push(`  ${ten}: không có ở home cũ — bỏ qua`);
  const tongMb = (report.bytes / 1024 / 1024).toFixed(1);
  dong.push(`  TỔNG: chép ${report.copied} tệp · bỏ qua ${report.skipped} tệp · ${tongMb} MB`);
  dong.push(report.dryRun ? "  (chưa ghi gì — bỏ --dry-run để chép thật)" : "  xong — mở app để thấy phiên cũ");
  return dong;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
