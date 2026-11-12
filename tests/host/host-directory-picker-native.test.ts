/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test 1:1 cho @galaxy-blackhole/gbh-host-directory-picker-native: bề mặt export · locale byte-equal ·
 *      pickNativeDirectory 4 nền tảng với runner giả · nhánh lỗi (ENOENT/exit 1/abort) · worker byte-identical +
 *      spawn A/B. KHÔNG mở UI thật, KHÔNG mount.
 */
import { describe, expect, test } from "bun:test";
import { chuanHoaHost, soByte } from "../lib/artefact-normalize.ts";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import NativeDirectoryPickerDefault, { NativeDirectoryPicker, pickNativeDirectory, type NativeRunner } from "../../packages/host/host-directory-picker-native/src/index.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói gốc (CHỈ ĐỌC) — oracle. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-directory-picker-native");
/** Gói ta. */
const OURS = join(REPO, "packages", "host", "host-directory-picker-native");
/** Signal chưa huỷ. */
const alive = (): AbortSignal => new AbortController().signal;
/** Lỗi mang mã (giống lỗi của child_process). */
const coded = (code: string | number): Error => Object.assign(new Error("ma " + String(code)), { code });

describe("bề mặt export + locale byte-equal", () => {
  test("default là class NativeDirectoryPicker; có pickNativeDirectory", () => {
    expect(typeof NativeDirectoryPickerDefault).toBe("function");
    expect(NativeDirectoryPickerDefault).toBe(NativeDirectoryPicker);
    expect(typeof pickNativeDirectory).toBe("function");
    const picker = new NativeDirectoryPicker({});
    const capability = picker.capability() as { kind: string; pick: unknown };
    expect(capability.kind).toBe("native");
    expect(typeof capability.pick).toBe("function");
  });

  test("locale en/zh BYTE-EQUAL gốc (59 + 128 B)", async () => {
    for (const name of ["en.json", "zh.json"]) {
      const ours = await readFile(join(OURS, "locale", name));
      const stock = await readFile(join(STOCK, "locale", name));
      expect(ours.equals(stock)).toBe(true);
    }
    expect((await readFile(join(STOCK, "locale", "en.json"))).byteLength).toBe(59);
    expect((await readFile(join(STOCK, "locale", "zh.json"))).byteLength).toBe(128);
  });
});

describe("pickNativeDirectory — 4 nền tảng", () => {
  test("darwin: JXA panel, bỏ newline cuối; stdout rỗng ⇒ null", async () => {
    const calls: { spec: string; argv: string[]; mode: string }[] = [];
    const run: NativeRunner = async (spec, argv, _signal, mode) => { calls.push({ spec, argv, mode }); return { stdout: "/Users/me/Project\n" }; };
    expect(await pickNativeDirectory(alive(), { platform: "darwin", run })).toBe("/Users/me/Project");
    expect(calls[0]?.spec).toBe("osascript");
    expect(calls[0]?.argv.slice(0, 2)).toEqual(["-l", "JavaScript"]);
    expect(calls[0]?.argv.at(-1)).toBe("Select Workspace Directory");
    expect(calls[0]?.mode).toBe("hidden");
    expect(await pickNativeDirectory(alive(), { platform: "darwin", run: async () => ({ stdout: "\n\n" }) })).toBeNull();
  });

  test("linux: zenity OK; zenity exit 1 ⇒ null; zenity ENOENT ⇒ kdialog; cả hai ENOENT ⇒ ném câu gốc", async () => {
    const ok: NativeRunner = async () => ({ stdout: "/tmp/x\n" });
    expect(await pickNativeDirectory(alive(), { platform: "linux", run: ok })).toBe("/tmp/x");
    const cancelled: NativeRunner = async () => { throw coded(1); };
    expect(await pickNativeDirectory(alive(), { platform: "linux", run: cancelled })).toBeNull();
    const specs: string[] = [];
    const zenityMissing: NativeRunner = async (spec) => { specs.push(spec); if (spec === "zenity") throw coded("ENOENT"); return { stdout: "/tmp/kdialog\n" }; };
    expect(await pickNativeDirectory(alive(), { platform: "linux", run: zenityMissing })).toBe("/tmp/kdialog");
    expect(specs).toEqual(["zenity", "kdialog"]);
    const bothMissing: NativeRunner = async () => { throw coded("ENOENT"); };
    await expect(pickNativeDirectory(alive(), { platform: "linux", run: bothMissing })).rejects.toThrow("no supported native directory picker found (install zenity or kdialog)");
  });

  test("win32: chuyển cho pickWin32Dialog", async () => {
    expect(await pickNativeDirectory(alive(), { platform: "win32", pickWin32Dialog: async () => "C:\\dir" })).toBe("C:\\dir");
    expect(await pickNativeDirectory(alive(), { platform: "win32", pickWin32Dialog: async () => null })).toBeNull();
  });

  test("nền tảng khác ⇒ ném câu gốc; abort ⇒ ném LẠI lỗi gốc (không nuốt)", async () => {
    await expect(pickNativeDirectory(alive(), { platform: "freebsd" })).rejects.toThrow("native directory picker is unsupported on freebsd");
    const controller = new AbortController();
    controller.abort(new Error("huy"));
    const boom: NativeRunner = async () => { throw new Error("lenh hong"); };
    await expect(pickNativeDirectory(controller.signal, { platform: "darwin", run: boom })).rejects.toThrow("lenh hong");
  });
});

describe("worker `./worker` — byte-identical + spawn A/B", () => {
  test("THÂN src/worker.cjs BYTE-EQUAL gốc sau khi bỏ 6 dòng header (sha thân = 434946b4…)", async () => {
    const oursText = (await readFile(join(OURS, "src", "worker.cjs"), "utf8")).split("\n").slice(7).join("\n");
    const stockText = await readFile(join(STOCK, "lib", "worker.cjs"), "utf8");
    expect(oursText).toBe(stockText);
    const sha = createHash("sha256").update(oursText).digest("hex");
    expect(sha).toBe("434946b4a825fb5c510757fffc14ac4103130f92174903bb83ad2376cfb61ba1");
  });

  test("spawn A/B: mã thoát + stderr của ta BẰNG bản gốc (COM chỉ chạy trên Windows ⇒ ghi rõ lý do)", async () => {
    // LÝ DO (macOS): worker chỉ nạp koffi BÊN TRONG nhánh win32 (lazy) nên trên macOS nó thoát vì không có
    // binding COM — không có hội thoại hộp thoại thật để so byte stderr. Bất biến mạnh hơn đã có ở test sha256;
    // ở đây so A/B để chứng minh hai tệp hành xử Y HỆT nhau dưới cùng điều kiện chạy.
    const runWorker = (file: string): Promise<{ code: number | null; stderr: string }> => new Promise((resolveValue) => {
      const child = spawn(process.execPath, [file], { env: { ...process.env, DSH_DIALOG_TITLE: "probe" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
      const timer = setTimeout(() => { child.kill("SIGKILL"); }, 5_000);
      child.on("exit", (code) => { clearTimeout(timer); resolveValue({ code, stderr }); });
      child.on("error", () => { clearTimeout(timer); resolveValue({ code: null, stderr }); });
    });
    const ours = await runWorker(join(OURS, "src", "worker.cjs"));
    const stock = await runWorker(join(STOCK, "lib", "worker.cjs"));
    expect(ours.code).toBe(stock.code);
    expect(ours.stderr).toBe(stock.stderr);
  }, 20_000);
});
