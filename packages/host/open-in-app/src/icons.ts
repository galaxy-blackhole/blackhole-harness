/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Trich icon .icns cua mot bundle .app thanh PNG 128px — dung plutil + sips nhu upstream.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Chay mot lenh he thong, tra stdout dang byte.
 * @param command - ten lenh (plutil, sips…).
 * @param args - tham so.
 * @param timeoutMs - han chot moi lenh.
 * @returns stdout hoac null khi lenh loi / qua han.
 */
function run(command: string, args: string[], timeoutMs: number): Buffer | null {
  const result = spawnSync(command, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
  if (result.error !== undefined && result.error !== null) return null;
  if (result.status !== 0) return null;
  return Buffer.isBuffer(result.stdout) ? result.stdout : null;
}

/**
 * Doc ten file icon tu Info.plist cua bundle.
 * @param bundle - duong dan bundle .app.
 * @param timeoutMs - han chot cho plutil.
 * @returns ten file .icns, hoac null.
 */
function readIconName(bundle: string, timeoutMs: number): string | null {
  const raw = run("plutil", ["-convert", "json", "-o", "-", join(bundle, "Contents", "Info.plist")], timeoutMs);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw.toString("utf8")) as { CFBundleIconFile?: unknown };
    const value = parsed.CFBundleIconFile;
    if (typeof value !== "string" || value.trim() === "") return null;
    return value.endsWith(".icns") ? value : value + ".icns";
  } catch {
    return null;
  }
}

/**
 * Tim file .icns dau tien trong Contents/Resources.
 * @param bundle - duong dan bundle .app.
 * @returns duong dan tuyet doi toi file .icns, hoac null.
 */
function firstIconInResources(bundle: string): string | null {
  const resources = join(bundle, "Contents", "Resources");
  try {
    const entry = readdirSync(resources).find((name) => name.toLowerCase().endsWith(".icns"));
    return entry === undefined ? null : join(resources, entry);
  } catch {
    return null;
  }
}

/**
 * Trich icon cua mot file .exe tren Windows thanh PNG bang System.Drawing (PowerShell).
 * @param exe - duong dan tuyet doi toi .exe (VS Code, IntelliJ, explorer...).
 * @param timeoutMs - han chot cho tien trinh PowerShell.
 * @returns bytes PNG, hoac null khi khong trich duoc.
 */
function extractWindowsIconPng(exe: string, timeoutMs: number): Buffer | null {
  const workDir = mkdtempSync(join(tmpdir(), "gbh-open-in-app-"));
  try {
    const outPng = join(workDir, "icon.png");
    const script = "Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Icon]::ExtractAssociatedIcon($env:GBH_ICON_EXE); if ($i -ne $null) { $i.ToBitmap().Save($env:GBH_ICON_OUT,[System.Drawing.Imaging.ImageFormat]::Png) }";
    const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      timeout: Math.max(timeoutMs, 15000),
      windowsHide: true,
      env: { ...process.env, GBH_ICON_EXE: exe, GBH_ICON_OUT: outPng },
    });
    if (result.status !== 0) return null;
    return readFileSync(outPng);
  } catch {
    return null;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Trich icon cua bundle thanh PNG 128x128 (RGBA) — hai buoc y nhu upstream:
 * plutil doc CFBundleIconFile (thieu duoi .icns thi tu them; khong co thi lay .icns dau tien trong Resources),
 * roi sips doi sang PNG co -Z 128. Vi dung dung cong cu he thong va dung tham so nen byte khop oracle.
 * @param bundle - duong dan bundle .app.
 * @param timeoutMs - han chot cho moi lenh he thong.
 * @returns bytes PNG, hoac null khi khong trich duoc (route se tra 404).
 */
export function extractBundleIconPng(bundle: string, timeoutMs: number): Buffer | null {
  if (process.platform === "win32") return extractWindowsIconPng(bundle, timeoutMs);
  const named = readIconName(bundle, timeoutMs);
  const icns = named === null ? firstIconInResources(bundle) : join(bundle, "Contents", "Resources", named);
  if (icns === null) return null;
  const workDir = mkdtempSync(join(tmpdir(), "gbh-open-in-app-"));
  try {
    const outPng = join(workDir, "icon.png");
    const converted = run("sips", ["-s", "format", "png", "-Z", "128", icns, "--out", outPng], timeoutMs);
    if (converted === null) return null;
    return readFileSync(outPng);
  } catch {
    return null;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
