/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang ung dung mo duoc (catalog cua row open-in-app) + nhan dien tren macOS.
 */
/**
 * Ma ung dung trong catalog — dung y 5 id ma oracle phuc vu tren macOS.
 */
export type OpenInAppId = "finder" | "vscode" | "xcode" | "iterm" | "terminal";

/**
 * Thu tu id trong catalog (giu nguyen thu tu oracle tra ve: finder, vscode, xcode, iterm, terminal).
 */
export const OPEN_IN_APP_IDS: readonly OpenInAppId[] = ["finder", "vscode", "xcode", "iterm", "terminal"];

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
  return { command: "open", args: ["-a", launcher.bundle, path] };
}
