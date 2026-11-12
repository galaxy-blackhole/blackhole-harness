/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Khoa hanh vi cong chan mount (apps/cli/src/mount-gate.ts): Node khong duoc spawn 'node run',
 *      Bun giu nguyen 'bun run', thieu bun thi canh bao RO, cache chi dung khi dau nguon khong doi
 *      12/11/2026: viet moi — loi that: blockedPackages() goi process.execPath + 'run' nen app desktop
 *      (launcher Node) bo qua cong chan mount trong im lang
 *      12/11/2026: them ca khoa scriptNeedsBun() (script dung API bun ⇒ di thang bun) + khoa "rows.ts THAT
 *      phai chay duoc bang Node" de khong ai bo nhanh du phong `typeof Bun` ma khong biet
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import {
  bunScriptCommand,
  findBun,
  hasVerdictTable,
  nodeScriptCommand,
  readScriptSource,
  runMountGate,
  scriptNeedsBun,
  type ScriptCommand,
} from "../../apps/cli/src/mount-gate.ts";

/** Bang phan quyet gia theo dung dinh dang rows.ts in ra. */
const TABLE = ["| Package | Muc do | Van de |", "|---|---|---|", "| demo | chan | thieu export apply |", ""].join("\n");

/**
 * Tao mot repo gia toi thieu du cho gateFingerprint doc (khong cham repo that).
 * @returns duong dan repo va home cua app.
 */
function sandbox(): { repo: string; home: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "gbh-gate-test-"));
  const repo = join(root, "repo");
  const home = join(root, "home");
  mkdirSync(join(repo, "tools", "check"), { recursive: true });
  mkdirSync(join(repo, "tools", "scaffold"), { recursive: true });
  mkdirSync(join(repo, "docs"), { recursive: true });
  mkdirSync(join(repo, "packages", "host", "demo", "src"), { recursive: true });
  mkdirSync(join(repo, "packages", "host", "demo", "lib"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(repo, "tools", "check", "rows.ts"), "export {};\n");
  writeFileSync(join(repo, "docs", "PARITY-MATRIX.md"), "| 1 | demo | stock | ours | T0 |\n");
  writeFileSync(join(repo, "packages", "host", "demo", "package.json"), JSON.stringify({ name: "@galaxy-blackhole/gbh-demo", gbh: { row: { id: "demo" } } }));
  writeFileSync(join(repo, "packages", "host", "demo", "src", "index.ts"), "export const apply = 1;\n");
  writeFileSync(join(repo, "packages", "host", "demo", "lib", "index.js"), "export const apply = 1;\n");
  return { repo, home, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("chon runtime cho cong chan mount", () => {
  test("Node: dung --experimental-strip-types va KHONG bao gio co tham so 'run'", () => {
    const command = nodeScriptCommand("/repo/tools/check/rows.ts", "/fake/node");
    expect(command.runtime).toBe("node");
    expect(command.command).toBe("/fake/node");
    expect(command.args).toEqual(["--experimental-strip-types", "/repo/tools/check/rows.ts"]);
    expect(command.args).not.toContain("run");
  });

  test("Bun: giu nguyen 'bun run <script>'", () => {
    const command = bunScriptCommand("/fake/bun", "/repo/tools/check/rows.ts");
    expect(command.runtime).toBe("bun");
    expect(command.command).toBe("/fake/bun");
    expect(command.args).toEqual(["run", "/repo/tools/check/rows.ts"]);
  });
});

describe("runMountGate", () => {
  test("tien trinh Node: chay node --experimental-strip-types, khong spawn 'node run'", () => {
    const box = sandbox();
    try {
      const commands: ScriptCommand[] = [];
      const result = runMountGate({
        script: join(box.repo, "tools", "check", "rows.ts"),
        cwd: box.repo,
        home: box.home,
        bunProcess: false,
        execPath: "/fake/node",
        run: (command) => {
          commands.push(command);
          return { output: TABLE, status: 1 };
        },
      });
      expect(commands).toHaveLength(1);
      expect(commands[0]?.runtime).toBe("node");
      expect(commands[0]?.args).not.toContain("run");
      expect(result.output).toBe(TABLE);
      expect(result.warning).toBeUndefined();
      expect(result.detail).toContain("node");
    } finally {
      box.cleanup();
    }
  });

  test("tien trinh Bun: chay 'bun run <script>' (giu nguyen hanh vi cu)", () => {
    const box = sandbox();
    try {
      const commands: ScriptCommand[] = [];
      const result = runMountGate({
        script: join(box.repo, "tools", "check", "rows.ts"),
        cwd: box.repo,
        home: box.home,
        bunProcess: true,
        execPath: "/fake/bun",
        run: (command) => {
          commands.push(command);
          return { output: TABLE, status: 1 };
        },
      });
      expect(commands).toHaveLength(1);
      expect(commands[0]?.runtime).toBe("bun");
      expect(commands[0]?.args).toEqual(["run", join(box.repo, "tools", "check", "rows.ts")]);
      expect(result.warning).toBeUndefined();
    } finally {
      box.cleanup();
    }
  });

  test("Node khong chay duoc script va KHONG co bun: canh bao RO, khong im lang", () => {
    const box = sandbox();
    try {
      const commands: ScriptCommand[] = [];
      const result = runMountGate({
        script: join(box.repo, "tools", "check", "rows.ts"),
        cwd: box.repo,
        home: box.home,
        bunProcess: false,
        execPath: "/fake/node",
        findBunPath: () => undefined,
        run: (command) => {
          commands.push(command);
          return { output: "ReferenceError: Bun is not defined\n", status: 1 };
        },
      });
      expect(commands).toHaveLength(1);
      expect(commands[0]?.args).not.toContain("run");
      // MOT dong canh bao: vi sao + cach khac phuc (cai bun hoac GBH_BUN=<path>), khong im lang.
      expect(result.warning).toContain("cổng chặn mount bị bỏ qua");
      expect(result.warning).toContain("node không chạy được");
      expect(result.warning).toContain("cài bun");
      expect(result.warning).toContain("GBH_BUN=<");
      expect(result.warning).not.toContain("\n");
      expect(hasVerdictTable(result.output)).toBe(false);
    } finally {
      box.cleanup();
    }
  });

  test("Node that bai vi API bun: thu bun tren PATH/GBH_BUN truoc khi bo qua", () => {
    const box = sandbox();
    try {
      const commands: ScriptCommand[] = [];
      const result = runMountGate({
        script: join(box.repo, "tools", "check", "rows.ts"),
        cwd: box.repo,
        home: box.home,
        bunProcess: false,
        execPath: "/fake/node",
        findBunPath: () => "/fake/bun",
        run: (command) => {
          commands.push(command);
          return command.runtime === "bun"
            ? { output: TABLE, status: 1 }
            : { output: "ReferenceError: Bun is not defined\n", status: 1 };
        },
      });
      expect(commands.map((command) => command.runtime)).toEqual(["node", "bun"]);
      expect(commands[1]?.args).toEqual(["run", join(box.repo, "tools", "check", "rows.ts")]);
      expect(result.warning).toBeUndefined();
      expect(result.detail).toContain("node loi nen dung bun");
    } finally {
      box.cleanup();
    }
  });

  test("cache: dung lai khi dau nguon khong doi, chay lai khi src doi", () => {
    const box = sandbox();
    try {
      let calls = 0;
      const options = {
        script: join(box.repo, "tools", "check", "rows.ts"),
        cwd: box.repo,
        home: box.home,
        bunProcess: false,
        execPath: "/fake/node",
        run: () => {
          calls += 1;
          return { output: TABLE, status: 1 };
        },
      };
      const first = runMountGate(options);
      expect(first.cached).toBe(false);
      expect(calls).toBe(1);
      const second = runMountGate(options);
      expect(second.cached).toBe(true);
      expect(calls).toBe(1);
      const src = join(box.repo, "packages", "host", "demo", "src", "index.ts");
      writeFileSync(src, "export const apply = 2;\n");
      const future = new Date(Date.now() + 5_000);
      utimesSync(src, future, future);
      const third = runMountGate(options);
      expect(third.cached).toBe(false);
      expect(calls).toBe(2);
    } finally {
      box.cleanup();
    }
  });
});

describe("doan TINH script co bat buoc bun khong", () => {
  test("goi API bun ma khong co nhanh du phong ⇒ phai bun", () => {
    expect(scriptNeedsBun("export async function build() { await Bun.build({ entrypoints: [] }); }\n")).toBe(true);
    expect(scriptNeedsBun("const f = Bun.file('/tmp/x');\n")).toBe(true);
  });

  test("co nhanh du phong typeof Bun ⇒ Node chay duoc", () => {
    const twoRuntime = "if (typeof Bun === 'undefined') { nodePath(); } else { Bun.build({}); }\n";
    expect(scriptNeedsBun(twoRuntime)).toBe(false);
    expect(scriptNeedsBun("export const apply = 1;\n")).toBe(false);
  });

  test("tools/check/rows.ts THAT phai chay duoc bang Node (co nhanh du phong)", () => {
    const script = join(import.meta.dir, "..", "..", "tools", "check", "rows.ts");
    const source = readScriptSource(script);
    expect(source).toBeString();
    // Khoa hanh vi: neu ai bo nhanh `typeof Bun` trong rows.ts thi cong chan mount se doi hoi bun —
    // tuc lai IM LANG tren app desktop (launcher Node). Test nay bao dong truoc.
    expect(scriptNeedsBun(source ?? "")).toBe(false);
    expect(readFileSync(script, "utf8")).toContain("typeof Bun");
  });

  test("script can bun: tien trinh Node KHONG spawn node, di thang bun", () => {
    const box = sandbox();
    try {
      const commands: ScriptCommand[] = [];
      const result = runMountGate({
        script: join(box.repo, "tools", "check", "rows.ts"),
        scriptSource: "await Bun.build({ entrypoints: [] });\n",
        cwd: box.repo,
        home: box.home,
        bunProcess: false,
        execPath: "/fake/node",
        findBunPath: () => "/fake/bun",
        run: (command) => {
          commands.push(command);
          return { output: TABLE, status: 0 };
        },
      });
      expect(commands.map((command) => command.runtime)).toEqual(["bun"]);
      expect(result.warning).toBeUndefined();
      expect(result.detail).toContain("script can bun");
    } finally {
      box.cleanup();
    }
  });

  test("script can bun + khong co bun: canh bao ro rang, KHONG spawn gi", () => {
    const box = sandbox();
    try {
      const commands: ScriptCommand[] = [];
      const result = runMountGate({
        script: join(box.repo, "tools", "check", "rows.ts"),
        scriptSource: "await Bun.build({ entrypoints: [] });\n",
        cwd: box.repo,
        home: box.home,
        bunProcess: false,
        execPath: "/fake/node",
        findBunPath: () => undefined,
        run: (command) => {
          commands.push(command);
          return { output: TABLE, status: 0 };
        },
      });
      expect(commands).toHaveLength(0);
      expect(result.warning).toContain("dùng API bun");
      expect(result.warning).toContain("GBH_BUN=<");
      expect(result.detail).toContain("bo qua node (script can bun)");
    } finally {
      box.cleanup();
    }
  });
});

describe("do bun", () => {
  test("GBH_BUN duoc uu tien, roi ~/.bun/bin/bun, roi PATH", () => {
    expect(findBun({ GBH_BUN: "/pinned/bun", HOME: "/home/u", PATH: "" }, (path) => path === "/pinned/bun")).toBe("/pinned/bun");
    expect(findBun({ HOME: "/home/u", PATH: "" }, (path) => path === "/home/u/.bun/bin/bun")).toBe("/home/u/.bun/bin/bun");
    expect(findBun({ HOME: "/home/u", PATH: "/usr/bin:/opt/bin" }, (path) => path === "/opt/bin/bun")).toBe("/opt/bin/bun");
    expect(findBun({ HOME: "/home/u", PATH: "/usr/bin" }, () => false)).toBeUndefined();
  });
});
