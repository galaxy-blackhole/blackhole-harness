/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang ung dung mo duoc (catalog cua row open-in-app) + nhan dien tren macOS.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
/**
 * Ma ung dung trong catalog — dung y 5 id ma oracle phuc vu tren macOS.
 */
export type OpenInAppId = "finder" | "explorer" | "vscode" | "intellij" | "windowsterminal" | "gitbash" | "xcode" | "iterm" | "terminal";

/**
 * Thu tu id trong catalog (giu nguyen thu tu oracle tra ve: finder, vscode, xcode, iterm, terminal).
 */
export const OPEN_IN_APP_IDS: readonly OpenInAppId[] = ["finder", "explorer", "vscode", "intellij", "windowsterminal", "gitbash", "xcode", "iterm", "terminal"];

/**
 * Mot muc catalog da resolve: bundle .app ton tai tren may.
 */
export interface OpenInAppLauncher {
  /** Ma ung dung trong catalog. */
  readonly id: OpenInAppId;
  /** Ten hien thi (nhan trong menu 'Open in app'). */
  readonly label: string;
  /** Duong dan tuyet doi toi bundle .app — cung la nguon lay icon. */
  readonly bundle: string;
}

/**
 * Ung vien tren macOS: finder luon co, bon cai con lai la cac bundle chuan.
 * @returns danh sach ung vien theo thu tu catalog.
 */
export function darwinCandidates(): readonly OpenInAppLauncher[] {
  return [
    { id: "finder", label: "Finder", bundle: "/System/Library/CoreServices/Finder.app" },
    { id: "vscode", label: "Visual Studio Code", bundle: "/Applications/Visual Studio Code.app" },
    { id: "xcode", label: "Xcode", bundle: "/Applications/Xcode.app" },
    { id: "iterm", label: "iTerm", bundle: "/Applications/iTerm.app" },
    { id: "terminal", label: "Terminal", bundle: "/System/Applications/Utilities/Terminal.app" },
  ];
}

/**
 * Ung vien tren Windows: File Explorer, VS Code, Windows Terminal, Git Bash.
 * Duong dan tuyet doi de `launch` khong phu thuoc PATH/resolveExecutable.
 * @returns danh sach ung vien theo thu tu menu.
 */
export function windowsCandidates(): readonly OpenInAppLauncher[] {
  const local = process.env.LOCALAPPDATA ?? "";
  const pf = process.env.ProgramFiles ?? "";
  const pf86 = process.env["ProgramFiles(x86)"] ?? "";
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const candidates: OpenInAppLauncher[] = [
    { id: "explorer", label: "File Explorer", bundle: join(systemRoot, "explorer.exe") },
    { id: "vscode", label: "Visual Studio Code", bundle: join(local, "Programs", "Microsoft VS Code", "Code.exe") },
    { id: "vscode", label: "Visual Studio Code", bundle: join(pf, "Microsoft VS Code", "Code.exe") },
    { id: "vscode", label: "Visual Studio Code", bundle: join(pf86, "Microsoft VS Code", "Code.exe") },
    { id: "intellij", label: "IntelliJ IDEA", bundle: join(local, "Programs", "IntelliJ IDEA Ultimate", "bin", "idea64.exe") },
    { id: "intellij", label: "IntelliJ IDEA", bundle: join(local, "Programs", "IntelliJ IDEA Community Edition", "bin", "idea64.exe") },
    { id: "intellij", label: "IntelliJ IDEA", bundle: join(pf, "JetBrains", "IntelliJ IDEA Ultimate", "bin", "idea64.exe") },
    { id: "intellij", label: "IntelliJ IDEA", bundle: join(pf, "JetBrains", "IntelliJ IDEA Community Edition", "bin", "idea64.exe") },
    { id: "windowsterminal", label: "Windows Terminal", bundle: join(local, "Microsoft", "WindowsApps", "wt.exe") },
    { id: "windowsterminal", label: "Windows Terminal", bundle: join(pf, "WindowsApps", "wt.exe") },
    { id: "gitbash", label: "Git Bash", bundle: join(pf, "Git", "git-bash.exe") },
    { id: "gitbash", label: "Git Bash", bundle: join(local, "Programs", "Git", "git-bash.exe") },
    { id: "gitbash", label: "Git Bash", bundle: join(pf86, "Git", "git-bash.exe") },
  ];
  // JetBrains Toolbox: %LOCALAPPDATA%\JetBrains\Toolbox\apps\IDEA-U\ch-0\<build>\bin\idea64.exe
  try {
    const toolbox = join(local, "JetBrains", "Toolbox", "apps", "IDEA-U", "ch-0");
    for (const build of readdirSync(toolbox)) {
      candidates.push({ id: "intellij", label: "IntelliJ IDEA", bundle: join(toolbox, build, "bin", "idea64.exe") });
    }
  } catch {}
  return candidates;
}

/**
 * Loc ung vien con cai thuc su ton tai tren may.
 * Nguon su that la he thong tep (khong doan): chi bundle co that moi vao catalog.
 * @param platform - gia tri process.platform (mac dinh lay tu tien trinh).
 * @param exists - ham kiem tra ton tai (de test bom vao).
 * @returns catalog da resolve, theo dung thu tu OPEN_IN_APP_IDS.
 */
export async function resolveCatalog(
  platform: string = process.platform,
  exists: (path: string) => Promise<boolean> = defaultExists,
): Promise<OpenInAppLauncher[]> {
  // 20/11/2026 — Windows phải có menu "Mở bằng" giống macOS. Catalog gồm File Explorer,
  // VS Code, Windows Terminal, Git Bash; chỉ entry có thật trên máy mới được trả về.
  if (platform === "win32") {
    const found: OpenInAppLauncher[] = [];
    const seen = new Set<OpenInAppId>();
    for (const candidate of windowsCandidates()) {
      if (seen.has(candidate.id)) continue;
      if (await exists(candidate.bundle)) {
        found.push(candidate);
        seen.add(candidate.id);
      }
    }
    if (!seen.has("explorer")) {
      found.unshift({ id: "explorer", label: "File Explorer", bundle: join(process.env.SystemRoot ?? "C:\\Windows", "explorer.exe") });
    }
    return found;
  }
  if (platform !== "darwin") return [];
  const found: OpenInAppLauncher[] = [];
  for (const candidate of darwinCandidates()) {
    if (await exists(candidate.bundle)) found.push(candidate);
  }
  return found;
}

/**
 * Kiem tra ton tai cua mot duong dan.
 * @param path - duong dan tuyet doi.
 * @returns true khi duong dan ton tai.
 */
async function defaultExists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cau lenh mo mot ung dung voi mot duong dan (macOS: `open -a <bundle> <path>`).
 * @param launcher - muc catalog da resolve.
 * @param path - duong dan tuyet doi nguoi dung chon.
 * @returns cap lenh + tham so cho node:child_process.
 */
export function openCommand(launcher: OpenInAppLauncher, path: string): { command: string; args: string[] } {
  if (launcher.id === "explorer" || launcher.id === "vscode") {
    return { command: launcher.bundle, args: [path] };
  }
  if (launcher.id === "windowsterminal") {
    return { command: launcher.bundle, args: ["-d", path] };
  }
  if (launcher.id === "gitbash") {
    return { command: launcher.bundle, args: ["--cd=" + path] };
  }
  return { command: "open", args: ["-a", launcher.bundle, path] };
}
