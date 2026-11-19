/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/11/2026
 * desc Vật chất hoá symlink trỏ ra ngoài cây host nhúng: chép đích vào bundle rồi thay bằng link tương đối
 *      (mục tiêu: app .app tự chứa thật, không còn 2.904 symlink tuyệt đối về repo dev).
 */

import { createHash } from "node:crypto";
import type { Dirent, Stats } from "node:fs";
import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** Kết quả một lượt vật chất hoá. */
export interface LinkMaterialization {
  /** Số symlink trỏ ra ngoài đã được thay. */
  external: number;
  /** Số đích mới được chép vào bundle. */
  copied: number;
  /** Số symlink gãy đã bỏ. */
  broken: number;
  /** Số symlink tuyệt đối trỏ trong bundle đã đổi thành tương đối. */
  relativized: number;
  /** Số symlink còn trỏ ra ngoài sau khi chạy (mục tiêu 0). */
  remaining: number;
}

/** Số lượt quét tối đa: mỗi lượt có thể phát hiện link nằm trong đích vừa chép. */
const MAX_PASSES = 8;

/** Thư mục chứa đích ngoài repo được chép vào bundle. */
const EXTERNAL_DIR = ".gbh-external";

/**
 * Một đường dẫn có nằm trong gốc hay không (kể cả chính gốc).
 * Nhận: root — gốc tuyệt đối; path — đường dẫn tuyệt đối.
 * Trả: true khi path nằm trong root.
 */
function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
}

/**
 * Đích trong bundle cho một đích ngoài.
 *
 * Ưu tiên giữ nguyên bố cục của repo (`packages/`, `apps/`, `node_modules/.bun/`) để các import tương đối
 * bên trong gói vẫn phân giải đúng. Chỉ đích ngoài repo mới rơi vào `.gbh-external/<hash>`.
 * Nhận: real — đường dẫn thật của đích; hostRoot — gốc cây nhúng; repoRoot — gốc repo nguồn.
 * Trả: đường dẫn đích tuyệt đối trong bundle.
 */
function destinationFor(real: string, hostRoot: string, repoRoot: string): string {
  if (inside(repoRoot, real)) {
    const rel = relative(repoRoot, real);
    if (rel.startsWith("node_modules/.bun/")) {
      return join(hostRoot, "apps", "host", "node_modules", ".bun", rel.slice("node_modules/.bun/".length));
    }
    if (rel.startsWith("node_modules/")) {
      return join(hostRoot, "apps", "host", "node_modules", rel.slice("node_modules/".length));
    }
    if (rel.startsWith("packages/") || rel.startsWith("apps/")) {
      return join(hostRoot, rel);
    }
  }
  const hash = createHash("sha1").update(real).digest("hex").slice(0, 16);
  const stats = statSync(real);
  return join(hostRoot, EXTERNAL_DIR, hash + (stats.isDirectory() ? "" : "-" + basename(real)));
}

/**
 * Chép một đích vào bundle nếu chưa có.
 * Nhận: real — đích thật; dest — đích trong bundle.
 * Trả: true khi vừa chép, false khi đã có sẵn.
 */
function copyTarget(real: string, dest: string): boolean {
  try {
    lstatSync(dest);
    return false;
  } catch {
    // chưa có — chép
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(real, dest, { recursive: true, force: true, dereference: false });
  return true;
}

/**
 * Quét toàn bộ cây và thay mọi symlink trỏ ra ngoài bằng đích nằm trong bundle (link tương đối).
 *
 * Vì sao cần: `cpSync` giữ nguyên symlink. Trong repo, `packages/<tầng>/<gói>/node_modules` và
 * `apps/host/node_modules/*` là symlink tuyệt đối trỏ về `.bun` store hoặc `packages/` — chép nguyên
 * sang `.app` thì app vẫn đọc repo, di chuyển repo là gãy. Hàm này chép đích vào bundle rồi thay link.
 * Nhận: hostRoot — gốc cây host nhúng; repoRoot — gốc repo nguồn.
 * Trả: số liệu vật chất hoá; `remaining` phải bằng 0 để coi là tự chứa.
 */
export function materializeExternalLinks(hostRoot: string, repoRoot: string): LinkMaterialization {
  const total: LinkMaterialization = { external: 0, copied: 0, broken: 0, relativized: 0, remaining: 0 };
  // `/tmp` trên macOS là symlink tới `/private/tmp`; so sánh `relative()` bằng đường dẫn chưa realpath sẽ
  // coi mọi đích là "ngoài cây" và copy vô ích. Dùng realpath cho cả hai gốc.
  const hostReal = realpathSync(hostRoot);
  const repoReal = realpathSync(repoRoot);
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    let touched = 0;

    const walk = (dir: string): void => {
      let entries: Dirent[] = [];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const path = join(dir, entry.name);
        let stats: Stats;
        try {
          stats = lstatSync(path);
        } catch {
          continue;
        }
        if (stats.isSymbolicLink()) {
          const raw = readlinkSync(path);
          const absolute = isAbsolute(raw) ? raw : resolve(dirname(path), raw);
          let real: string;
          try {
            real = realpathSync(absolute);
          } catch {
            rmSync(path, { force: true });
            total.broken += 1;
            touched += 1;
            continue;
          }
          if (inside(hostReal, real)) {
            if (isAbsolute(raw)) {
              rmSync(path, { force: true });
              symlinkSync(relative(dirname(path), real), path);
              total.relativized += 1;
              touched += 1;
            }
            continue;
          }
          const dest = destinationFor(real, hostRoot, repoReal);
          if (copyTarget(real, dest)) total.copied += 1;
          rmSync(path, { force: true });
          symlinkSync(relative(dirname(path), dest), path);
          total.external += 1;
          touched += 1;
          continue;
        }
        if (stats.isDirectory()) walk(path);
      }
    };

    walk(hostRoot);
    if (touched === 0) break;
  }

  const countExternal = (dir: string): number => {
    let count = 0;
    let entries: Dirent[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      let stats: Stats;
      try {
        stats = lstatSync(path);
      } catch {
        continue;
      }
      if (stats.isSymbolicLink()) {
        const raw = readlinkSync(path);
        const absolute = isAbsolute(raw) ? raw : resolve(dirname(path), raw);
        try {
          if (!inside(hostReal, realpathSync(absolute))) count += 1;
        } catch {
          count += 1;
        }
      } else if (stats.isDirectory()) {
        count += countExternal(path);
      }
    }
    return count;
  };
  total.remaining = countExternal(hostRoot);
  return total;
}
