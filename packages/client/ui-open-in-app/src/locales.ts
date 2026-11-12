/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tu dien namespace open-in-app — nguyen van hai bang chu cua ban goc (zh la nguon su that)
 */

/**
 * Namespace tu dien ma plugin so huu — nguyen van tu ban goc.
 * Nhan: khong co.
 * Tra: chuoi namespace.
 */
export const NS = "open-in-app";

/**
 * Ten san pham dung chung cho CA HAI bang chu (ten rieng, khong dich) — nguyen van tung byte.
 * Nhan: khong co.
 * Tra: doi tuong khoa -> nhan.
 */
export const PRODUCT_NAMES = {
  "app.cursor": "Cursor",
  "app.vscode": "VS Code",
  "app.vscodeinsiders": "VS Code Insiders",
  "app.windsurf": "Windsurf",
  "app.zed": "Zed",
  "app.sublimetext": "Sublime Text",
  "app.xcode": "Xcode",
  "app.androidstudio": "Android Studio",
  "app.intellij": "IntelliJ IDEA",
  "app.pycharm": "PyCharm",
  "app.webstorm": "WebStorm",
  "app.phpstorm": "PhpStorm",
  "app.goland": "GoLand",
  "app.rider": "Rider",
  "app.rustrover": "RustRover",
  "app.fork": "Fork",
  "app.sourcetree": "Sourcetree",
  "app.github": "GitHub Desktop",
  "app.tower": "Tower",
  "app.gitkraken": "GitKraken",
  "app.smartgit": "SmartGit",
  "app.sublimemerge": "Sublime Merge",
  "app.ghostty": "Ghostty",
  "app.warp": "Warp",
  "app.iterm": "iTerm2",
  "app.kitty": "kitty",
  "app.windowsterminal": "Windows Terminal",
  "app.gitbash": "Git Bash",
  "app.gnometerminal": "GNOME Terminal",
  "app.konsole": "Konsole",
} as const;

/**
 * Bang chu tieng Trung gian the — NGUON SU THAT cua tap khoa (moi khoa ben duoi phai co o day truoc).
 * Nhan: khong co.
 * Tra: doi tuong khoa -> chuoi.
 */
export const zh = {
  "open.title": "用 {app} 打开",
  "path.appDefault": "{app}（默认）",
  "path.appsError": "无法获取应用列表",
  "shortcut.busy": "正在打开工作区",
  "shortcut.unavailable": "当前工作区或本地应用不可用",
  "open.tooltip": "在本地打开",
  "path.open": "打开",
  "path.more": "更多打开方式",
  "path.reveal": "显示文件位置",
  "path.openError": "打开失败，请重试",
  "path.revealError": "无法显示文件位置，请重试",
  ...PRODUCT_NAMES,
  "app.finder": "访达",
  "app.explorer": "文件资源管理器",
  "app.filemanager": "文件管理器",
  "app.terminal": "终端",
};

/**
 * Bang chu tieng Anh, dung tap khoa voi ban tieng Trung — nguyen van.
 * Nhan: khong co.
 * Tra: doi tuong khoa -> chuoi.
 */
export const en: Record<OpenInAppKey, string> = {
  "open.title": "Open in {app}",
  "path.appDefault": "{app} (default)",
  "path.appsError": "Could not load applications",
  "shortcut.busy": "Opening workspace",
  "shortcut.unavailable": "Current workspace or local application unavailable",
  "open.tooltip": "Open locally",
  "path.open": "Open",
  "path.more": "More ways to open",
  "path.reveal": "Show file location",
  "path.openError": "Could not open. Try again.",
  "path.revealError": "Could not show the file location. Try again.",
  ...PRODUCT_NAMES,
  "app.finder": "Finder",
  "app.explorer": "File Explorer",
  "app.filemanager": "Files",
  "app.terminal": "Terminal",
};

/**
 * Mien khoa cua namespace open-in-app (zh la nguon su that).
 * Nhan: khong co.
 * Tra: kieu hop cua moi khoa trong bang chu.
 */
export type OpenInAppKey = keyof typeof zh;
