/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phần profile của phép đo plugin-compat: chụp trạng thái trước khi cài, kiểm cây dump-config,
 *      khôi phục NGUYÊN BYTE và dọn mọi tác dụng phụ mà plugin để lại
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { hashFile, dshBin } from "./plugin-npm.ts";
import { repoPath, resolveNodeBin } from "./paths.ts";

/**
 * Tệp STATE Ở HOME phải chụp và khôi phục cùng profile. Bài học từ lượt đo 13:43–13:55:
 * \`dsh-settings\` đổi tên \`settings.yaml\` thành \`settings.yaml.imported\` và nạp nó vào profile, nên
 * bước gỡ plugin để lại một tệp trơ khiến màn Settings → Agent presets lệch 3.180 px.
 * Nguyên tắc: một phép thử chỉ sạch khi STATE Ở HOME quay về y hệt, không chỉ profile.
 */
export const HOME_STATE_FILES: readonly string[] = Object.freeze(["settings.yaml", "settings.yaml.imported"]);

/** Thư mục state do plugin gieo vào home. */
export const HOME_STATE_DIRS: readonly string[] = Object.freeze([".agent-presets"]);

/** Một tệp state ở home, kèm ảnh chụp nguyên văn để khôi phục. */
export interface HomeStateFile {
  /** Tên tệp trong home. */
  name: string;
  /** Đường dẫn tuyệt đối. */
  path: string;
  /** Trước khi cài tệp có tồn tại không. */
  existed: boolean;
  /** sha256 trước khi cài. */
  sha256: string;
  /** Số byte trước khi cài. */
  bytes: number;
  /** Nội dung nguyên văn trước khi cài (rỗng nếu chưa có). */
  text: string;
}

/** Ảnh chụp một thư mục state ở home (đường dẫn tương đối + nội dung). */
export interface HomeStateDir {
  /** Tên thư mục trong home. */
  name: string;
  /** Đường dẫn tuyệt đối. */
  path: string;
  /** Trước khi cài thư mục có tồn tại không. */
  existed: boolean;
  /** Các tệp bên trong (đường dẫn tương đối so với thư mục). */
  files: { rel: string; text: string }[];
}

/** Bốn tệp cấu hình của profile cần chụp để khôi phục. */
export const PROFILE_FILES: readonly string[] = Object.freeze([
  "package.json",
  "cordis.patch.yml",
  "cordis.yml",
  "pnpm-workspace.yaml",
]);

/** Ảnh chụp một tệp của profile (để khôi phục nguyên byte). */
export interface ProfileFile {
  /** Tên tệp trong thư mục profile. */
  name: string;
  /** Đường dẫn tuyệt đối. */
  path: string;
  /** sha256 hex của nội dung. */
  sha256: string;
  /** Số byte. */
  bytes: number;
  /** Nội dung nguyên văn (để ghi lại chính xác từng byte). */
  text: string;
}

/** Ảnh chụp trạng thái profile + home TRƯỚC khi cài plugin. */
export interface ProfileSnapshot {
  /** Thư mục profile. */
  profileDir: string;
  /** Bốn tệp cấu hình của profile. */
  files: ProfileFile[];
  /** Trước khi cài đã có node_modules trong profile chưa. */
  hadNodeModules: boolean;
  /** Trước khi cài đã có pnpm-lock.yaml chưa. */
  hadLock: boolean;
  /** Trước khi cài đã có settings.yaml trong home chưa. */
  hadSettings: boolean;
  /** Trước khi cài đã có .agent-presets trong home chưa. */
  hadAgentPresets: boolean;
  /** Nội dung settings.yaml trước khi cài (null nếu chưa có). */
  settingsText: string | null;
  /** State ở HOME phải khôi phục cùng profile. */
  homeState: { files: HomeStateFile[]; dirs: HomeStateDir[] };
}

/** Kết quả kiểm cây dump-config. */
export interface DumpRowCheck {
  /** true khi cây đã compose có row của plugin. */
  has: boolean;
  /** Số row của cả cây. */
  rows: number;
  /** Số dòng stdout. */
  lines: number;
}

/**
 * Liệt kê tệp mà plugin đã gieo vào home (bằng chứng nó chạy THẬT, không chỉ được nạp).
 * @param home DSH_HOME của app.
 * @param dir thư mục con trong home (ví dụ: .agent-presets/custom).
 * @returns danh sách đường dẫn tương đối của các tệp tìm thấy.
 */
export function listSeededFiles(home: string, dir: string): string[] {
  const root = join(home, dir);
  if (!existsSync(root)) return [];
  try {
    return readdirSync(root).map((name) => dir + "/" + name);
  } catch {
    return [];
  }
}

/**
 * Đọc các dòng log của host có chứa chuỗi cần tìm (bằng chứng plugin tự log lúc chạy).
 * @param home DSH_HOME của app.
 * @param logFile tên tệp log trong home.
 * @param needle chuỗi cần tìm.
 * @param max số dòng tối đa trả về.
 * @returns các dòng log đã khớp, đã cắt độ dài.
 */
export function readHostLogLines(home: string, logFile: string, needle: string, max = 12): string[] {
  const file = join(home, logFile);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n");
  return lines
    .filter((line) => line.includes(needle))
    .slice(-max)
    .map((line) => line.replace(/\s+/gu, " ").slice(0, 220));
}

/**
 * Chụp ảnh trạng thái profile + home trước khi cài plugin (để khôi phục nguyên byte).
 * @param home DSH_HOME của app.
 * @param profile tên profile.
 * @returns ảnh chụp.
 */
export function readProfileSnapshot(home: string, profile: string): ProfileSnapshot {
  const profileDir = join(home, "profiles", profile);
  const files: ProfileFile[] = [];
  for (const name of PROFILE_FILES) {
    const path = join(profileDir, name);
    const text = existsSync(path) ? readFileSync(path, "utf8") : "";
    files.push({ name, path, sha256: hashFile(path), bytes: Buffer.byteLength(text, "utf8"), text });
  }
  const settingsPath = join(home, "settings.yaml");
  const hadSettings = existsSync(settingsPath);
  const homeFiles: HomeStateFile[] = HOME_STATE_FILES.map((name) => readHomeStateFile(home, name));
  const homeDirs: HomeStateDir[] = HOME_STATE_DIRS.map((name) => readHomeStateDir(home, name));
  return {
    profileDir,
    files,
    hadNodeModules: existsSync(join(profileDir, "node_modules")),
    hadLock: existsSync(join(profileDir, "pnpm-lock.yaml")),
    hadSettings,
    hadAgentPresets: existsSync(join(home, ".agent-presets")),
    settingsText: hadSettings ? readFileSync(settingsPath, "utf8") : null,
    homeState: { files: homeFiles, dirs: homeDirs },
  };
}

/**
 * Chụp một tệp state ở home (kèm nội dung nguyên văn để khôi phục đúng byte).
 * @param home DSH_HOME.
 * @param name tên tệp trong home.
 * @returns ảnh chụp tệp.
 */
export function readHomeStateFile(home: string, name: string): HomeStateFile {
  const path = join(home, name);
  const existed = existsSync(path);
  const text = existed ? readFileSync(path, "utf8") : "";
  return { name, path, existed, sha256: existed ? hashFile(path) : "", bytes: Buffer.byteLength(text, "utf8"), text };
}

/**
 * Chụp một thư mục state ở home (duyệt sâu tối đa 4 tầng, chỉ tệp văn bản nhỏ).
 * @param home DSH_HOME.
 * @param name tên thư mục trong home.
 * @returns ảnh chụp thư mục.
 */
export function readHomeStateDir(home: string, name: string): HomeStateDir {
  const path = join(home, name);
  const existed = existsSync(path);
  const files: { rel: string; text: string }[] = [];
  const walk = (dir: string, prefix: string, depth: number): void => {
    if (depth > 4) return;
    let children: string[];
    try {
      children = readdirSync(dir);
    } catch {
      return;
    }
    for (const child of children) {
      const full = join(dir, child);
      const rel = prefix === "" ? child : prefix + "/" + child;
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }
      if (stats.isDirectory()) {
        walk(full, rel, depth + 1);
        continue;
      }
      if (stats.size > 512 * 1024) continue;
      files.push({ rel, text: readFileSync(full, "utf8") });
    }
  };
  if (existed) walk(path, "", 0);
  return { name, path, existed, files };
}

/**
 * Dọn mọi thứ mà lần cài plugin đã tạo, và ghi lại bốn tệp profile NGUYÊN BYTE từ ảnh chụp.
 * @param home DSH_HOME của app.
 * @param snapshot ảnh chụp trước khi cài.
 * @returns danh sách đường dẫn đã dọn + kết quả so byte từng tệp.
 */
export function restoreProfile(
  home: string,
  snapshot: ProfileSnapshot,
): { removed: string[]; files: { name: string; before: string; after: string }[] } {
  const removed: string[] = [];
  const drop = (path: string): void => {
    if (!existsSync(path)) return;
    rmSync(path, { recursive: true, force: true });
    removed.push(path);
  };
  const profileDir = snapshot.profileDir;
  if (!snapshot.hadNodeModules) drop(join(profileDir, "node_modules"));
  if (!snapshot.hadLock) drop(join(profileDir, "pnpm-lock.yaml"));
  drop(join(profileDir, ".plugin-manager"));
  if (!snapshot.hadSettings) drop(join(home, "settings.yaml"));
  else if (snapshot.settingsText !== null) writeFileSync(join(home, "settings.yaml"), snapshot.settingsText);
  if (!snapshot.hadAgentPresets) drop(join(home, ".agent-presets"));
  const files: { name: string; before: string; after: string }[] = [];
  for (const file of snapshot.files) {
    writeFileSync(file.path, file.text);
    files.push({ name: file.name, before: file.sha256, after: hashFile(file.path) });
  }
  // STATE Ở HOME: tệp nào trước đây không có thì phải biến mất; thư mục nào trước đây không có thì
  // phải bị xoá sạch (kể cả tệp plugin gieo vào), còn nếu đã có thì khôi phục nguyên văn từng tệp.
  for (const file of snapshot.homeState.files) {
    const current = readHomeStateFile(home, file.name);
    if (!file.existed) {
      if (current.existed) drop(file.path);
      continue;
    }
    writeFileSync(file.path, file.text);
    files.push({ name: file.name, before: file.sha256, after: hashFile(file.path) });
  }
  for (const dir of snapshot.homeState.dirs) {
    if (!dir.existed) {
      if (existsSync(dir.path)) drop(dir.path);
      continue;
    }
    if (existsSync(dir.path)) drop(dir.path);
    for (const file of dir.files) {
      const target = join(dir.path, file.rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.text);
    }
    files.push({ name: dir.name + " (cây)", before: String(dir.files.length) + " tệp", after: String(dir.files.length) + " tệp" });
  }
  return { removed, files };
}

/** Kết quả kiểm tra state ở home sau khi gỡ plugin. */
export interface HomeStateVerification {
  /** Từng tệp state: có trước không, có sau không, đã khôi phục đúng chưa. */
  files: { name: string; existedBefore: boolean; existsAfter: boolean; restored: boolean }[];
  /** Số tệp trong .agent-presets trước khi cài (-1 nếu thư mục chưa có). */
  agentPresetsBefore: number;
  /** Số tệp trong .agent-presets sau khi gỡ (-1 nếu không còn thư mục). */
  agentPresetsAfter: number;
  /** true khi MỌI state ở home quay về y hệt trạng thái trước khi cài. */
  clean: boolean;
}

/**
 * Kiểm tra state ở home đã quay về y hệt ảnh chụp chưa (tệp + cây .agent-presets).
 * @param home DSH_HOME.
 * @param snapshot ảnh chụp trước khi cài.
 * @returns kết quả kiểm tra chi tiết.
 */
export function verifyHomeState(home: string, snapshot: ProfileSnapshot): HomeStateVerification {
  const files = snapshot.homeState.files.map((file) => {
    const current = readHomeStateFile(home, file.name);
    const restored = file.existed ? current.existed && current.sha256 === file.sha256 : !current.existed;
    return { name: file.name, existedBefore: file.existed, existsAfter: current.existed, restored };
  });
  const currentDirs = snapshot.homeState.dirs.map((dir) => readHomeStateDir(home, dir.name));
  const dirClean = snapshot.homeState.dirs.every((dir, index) => {
    const current = currentDirs[index];
    if (current === undefined) return false;
    if (!dir.existed) return !current.existed;
    if (!current.existed || current.files.length !== dir.files.length) return false;
    const expected = new Map(dir.files.map((file) => [file.rel, file.text]));
    return current.files.every((file) => expected.get(file.rel) === file.text);
  });
  const before = snapshot.homeState.dirs[0];
  const after = currentDirs[0];
  return {
    files,
    agentPresetsBefore: before === undefined ? -1 : before.existed ? before.files.length : -1,
    agentPresetsAfter: after === undefined ? -1 : after.existed ? after.files.length : -1,
    clean: files.every((file) => file.restored) && dirClean,
  };
}

/**
 * Chạy --dump-config cho profile của app và kiểm row của bundle plugin đã vào cây chưa.
 * So BYTE trên stdout, không dựa vào exit code.
 * @param home DSH_HOME của app.
 * @param profile tên profile.
 * @param rowId id row mà bundle patch của plugin chèn.
 * @param name tên gói plugin.
 * @returns có row hay không, kèm số row và số dòng của cây.
 */
export function dumpHasPluginRow(home: string, profile: string, rowId: string, name: string): DumpRowCheck {
  const patchFile = join(home, "app.patch.yml");
  const args = [dshBin(), "--profile", profile];
  if (existsSync(patchFile)) args.push("--patch", patchFile);
  args.push("--dump-config");
  const probe = spawnSync(resolveNodeBin(), args, {
    cwd: repoPath(),
    env: { ...process.env, DSH_HOME: home },
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const raw = probe.stdout ?? "";
  const rows = raw.split("\n").filter((line) => line.startsWith("- id: ")).length;
  return { has: raw.includes("- id: " + rowId) && raw.includes("name: " + name), rows, lines: raw.split("\n").length };
}
