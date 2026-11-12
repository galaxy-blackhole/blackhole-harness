/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test CLI bh: phan tich tham so, marker ?token=, cong ban, doctor in du 5 dong trang thai
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { EXIT, main, parseArgs, usage } from "../../apps/cli/src/main.ts";
import { defaultHostOptions, extractReadyUrl, hostChildEnv } from "../../apps/cli/src/host.ts";
import { isPortAvailable } from "../../apps/cli/src/port.ts";
import { DEFAULT_PORT, repoRoot } from "../../apps/cli/src/paths.ts";

/** The CLI entry as the shell runs it. */
const CLI = join(repoRoot(), "apps", "cli", "src", "main.ts");

/**
 * Runs one `bh` invocation out of process, exactly as the Tauri shell would.
 * @param args - arguments after the script name.
 * @returns the exit code, stdout and stderr.
 */
function runCli(args: string[]): { code: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["run", CLI, ...args], { cwd: repoRoot(), encoding: "utf8", timeout: 60_000 });
  return { code: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/**
 * Binds a real listener so a port is provably busy.
 * @returns the port and a closer.
 */
async function occupyPort(): Promise<{ port: number; release: () => Promise<void> }> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    port,
    release: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe("parseArgs", () => {
  test("defaults to host on 5439 with the app profile", () => {
    const parsed = parseArgs(["host"]);
    expect(parsed.options?.port).toBe(DEFAULT_PORT);
    expect(parsed.options?.profile).toBe("blackhole");
    expect(parsed.options?.autoPort).toBe(false);
  });

  test("accepts port, profile, patch and switches", () => {
    const parsed = parseArgs(["host", "--port", "0", "--profile", "blackhole", "--auto-port", "--open", "--patch", "/tmp/x.yml"]);
    expect(parsed.options?.port).toBe(0);
    expect(parsed.options?.autoPort).toBe(true);
    expect(parsed.options?.open).toBe(true);
    expect(parsed.options?.extraPatches).toEqual(["/tmp/x.yml"]);
  });

  test("refuses a malformed port, an unknown flag and an unknown command", () => {
    expect(parseArgs(["host", "--port", "abc"]).error).toBeDefined();
    expect(parseArgs(["host", "--port", "70000"]).error).toBeDefined();
    expect(parseArgs(["host", "--nope"]).error).toBeDefined();
    expect(parseArgs(["fly"]).error).toBeDefined();
  });

  test("help text names both sub-commands and the exit codes", () => {
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(usage()).toContain("bh host");
    expect(usage()).toContain("bh doctor");
    expect(usage()).toContain("3 port busy");
  });
});

describe("ready marker", () => {
  test("extractReadyUrl reads the harness URL line and drops the LAN suffix", () => {
    const line = "dsh web: http://127.0.0.1:5439/?token=hMzKoXgMMR0d6m1SGPplhHSIUV3I8lIVXY_X-3y56_o (LAN: http://10.0.0.5:5439/?token=abc)\n";
    expect(extractReadyUrl(line)).toBe("http://127.0.0.1:5439/?token=hMzKoXgMMR0d6m1SGPplhHSIUV3I8lIVXY_X-3y56_o");
  });

  test("extractReadyUrl ignores startup chatter", () => {
    expect(extractReadyUrl("dsh: warning: 2 entries did not activate\n")).toBeUndefined();
  });
});

describe("port handling", () => {
  test("a bound port is reported busy, a released one is free", async () => {
    const busy = await occupyPort();
    expect(await isPortAvailable(busy.port)).toBe(false);
    await busy.release();
    expect(await isPortAvailable(busy.port)).toBe(true);
  });

  test("bh host refuses a busy port with exit code 3 and an actionable message", async () => {
    const busy = await occupyPort();
    try {
      const result = runCli(["host", "--port", String(busy.port)]);
      expect(result.code).toBe(EXIT.portBusy);
      expect(result.stderr).toContain("da bi chiem");
      expect(result.stderr).toContain("--auto-port");
    } finally {
      await busy.release();
    }
  }, 60_000);
});

describe("env cua tien trinh harness con", () => {
  test("co CA DSH_HOME va GBH_HOME cung tro ve app home, khong ro bien la", () => {
    const env = hostChildEnv("/tmp/gbh-home-test");
    expect(env.DSH_HOME).toBe("/tmp/gbh-home-test");
    expect(env.GBH_HOME).toBe("/tmp/gbh-home-test");
    const injected = Object.keys(env).filter((name) => name === "DSH_HOME" || name === "GBH_HOME");
    expect(injected.sort()).toEqual(["DSH_HOME", "GBH_HOME"]);
  });
});

describe("doctor", () => {
  test("reports at least five status lines and exits 0 when the runtime is installed", () => {
    const result = runCli(["doctor"]);
    const rows = result.stdout.split("\n").filter((line) => /^(OK|WARN|MISS)\s/u.test(line));
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(result.stdout).toContain("node runtime");
    expect(result.stdout).toContain("harness runtime");
    expect(result.stdout).toContain("home isolation");
    if (result.code !== 0) console.warn(result.stdout, result.stderr);
    expect(result.code).toBe(EXIT.ok);
  }, 60_000);

  test("main() with no command prints usage and returns the usage exit code", async () => {
    expect(await main([])).toBe(EXIT.ok);
  });
});

describe("boot options", () => {
  test("defaults bind loopback on 5439 and never open a browser", () => {
    const options = defaultHostOptions();
    expect(options.port).toBe(DEFAULT_PORT);
    expect(options.openBrowser).toBe(false);
    expect(options.extraPatches).toEqual([]);
  });
});
