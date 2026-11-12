/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang anh xa id ung dung -> khoa nhan cua tu dien (nguyen van tu ban goc)
 */

import type { OpenInAppKey } from "./locales.ts";

/**
 * Khoa nhan cua tung ung dung ma client nay dat ten duoc; id khong co trong bang thi KHONG hien nut.
 * Nhan: khong co.
 * Tra: doi tuong tra cuu id ung dung -> khoa tu dien (undefined = khong dat ten duoc).
 */
export const APP_LABEL_KEY: Record<string, OpenInAppKey | undefined> = {
  finder: "app.finder",
  explorer: "app.explorer",
  filemanager: "app.filemanager",
  cursor: "app.cursor",
  vscode: "app.vscode",
  vscodeinsiders: "app.vscodeinsiders",
  windsurf: "app.windsurf",
  zed: "app.zed",
  sublimetext: "app.sublimetext",
  xcode: "app.xcode",
  androidstudio: "app.androidstudio",
  intellij: "app.intellij",
  pycharm: "app.pycharm",
  webstorm: "app.webstorm",
  phpstorm: "app.phpstorm",
  goland: "app.goland",
  rider: "app.rider",
  rustrover: "app.rustrover",
  fork: "app.fork",
  sourcetree: "app.sourcetree",
  github: "app.github",
  tower: "app.tower",
  gitkraken: "app.gitkraken",
  smartgit: "app.smartgit",
  sublimemerge: "app.sublimemerge",
  ghostty: "app.ghostty",
  warp: "app.warp",
  iterm: "app.iterm",
  kitty: "app.kitty",
  terminal: "app.terminal",
  windowsterminal: "app.windowsterminal",
  gitbash: "app.gitbash",
  gnometerminal: "app.gnometerminal",
  konsole: "app.konsole",
};
