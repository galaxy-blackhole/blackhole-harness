/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Danh tinh tren dia cua cac module da nap — dung de tim module co tep doi sau khi nap.
 */
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Do phan giai tem thoi gian THO nhat trong cac he thong tep duoc ho tro (FAT luu mtime theo don vi 2 giay).
 * Tep chua duoc ghi nhan ma bi sua trong khoang nay truoc lan quan sat cuoi duoc coi la CO THE da doi.
 */
export const TIMESTAMP_RESOLUTION_MS = 2e3;

/** Danh tinh cua mot tep module da nap. */
export interface FileIdentity {
  /** Khoa danh tinh `ino:size:mtimeMs`. */
  key: string;
  /** Thoi diem sua cuoi (epoch ms). */
  modifiedAt: number;
}

/** Ket qua so sanh module da nap voi dia. */
export interface FileComparison {
  /** URL cua cac module da cu. */
  stale: Set<string>;
  /** Danh tinh doc duoc cho tung URL da so (`undefined` khi tep khong con). */
  seen: Map<string, string | undefined>;
}

/** Tuy chon cua {@link ModuleFiles.observe}. */
export interface ObserveOptions {
  /** Danh tinh doc truoc do cho module ma muc cache chua doi. */
  seen?: Map<string, string | undefined>;
  /** Module giu nguyen ghi nhan cu (hoac bi danh dau cu khi chua co ghi nhan). */
  retained?: Set<string>;
  /** Thoi diem quan sat (tu {@link ModuleFiles.now}). */
  at?: number;
}

/**
 * Doc danh tinh cua mot tep module.
 * @param url - URL `file:` cua module.
 * @returns Danh tinh, hoac `undefined` khi tep khong doc duoc.
 */
function identityOf(url: string): FileIdentity | undefined {
  let stats;
  try {
    stats = statSync(fileURLToPath(url));
  } catch (_error) {
    return undefined;
  }
  return {
    key: `${String(stats.ino)}:${String(stats.size)}:${String(stats.mtimeMs)}`,
    modifiedAt: stats.mtimeMs,
  };
}

/**
 * Ghi nhan inode, kich thuoc va mtime cua module `file:` da nap. Module la CU khi tep bien mat hoac danh tinh
 * khac ghi nhan. Khong ghi nhan ctime: tao hard link (pnpm) doi ctime ma khong doi noi dung.
 */
export class ModuleFiles {
  /** Danh tinh theo tung module da ghi nhan; `undefined` danh dau module CU. */
  records = new Map<string, string | undefined>();

  /** Thoi diem quan sat cuoi. */
  observedAt = Date.now();

  /**
   * Doc thoi gian cua CHINH dong ho ma he dieu hanh dong dau khi ghi tep cuc bo, bang mot tep moc moi roi xoa di.
   * Dong ho he thong va tem tep co the lech nhau mot nhip, nen module duoc so voi thoi diem nay; khong tao duoc
   * tep moc thi dung dong ho he thong.
   * @returns Epoch milisecond.
   */
  now(): number {
    let directory: string | undefined;
    try {
      directory = mkdtempSync(join(tmpdir(), "gbh-hmr-clock-"));
    } catch (_error) {
      return Date.now();
    }
    try {
      const marker = join(directory, "now");
      writeFileSync(marker, "");
      return statSync(marker).mtimeMs;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  /**
   * So module da nap voi dia.
   * @param urls - URL `file:` cua cac module da nap can so.
   * @returns URL cua module CU, va danh tinh doc duoc cho tung URL da so (`undefined` khi tep khong con).
   */
  compare(urls: Iterable<string>): FileComparison {
    const stale = new Set<string>();
    const seen = new Map<string, string | undefined>();
    for (const url of urls) {
      const identity = identityOf(url);
      seen.set(url, identity?.key);
      if (identity === undefined) {
        stale.add(url);
        continue;
      }
      if (this.records.has(url) ? this.records.get(url) !== identity.key : identity.modifiedAt >= this.observedAt - TIMESTAMP_RESOLUTION_MS) {
        stale.add(url);
      }
    }
    return { stale, seen };
  }

  /**
   * Thay TOAN BO ghi nhan bang danh tinh cua cac module da nap duoc chi dinh.
   * @param urls - URL `file:` cua cac module can ghi nhan.
   * @param options - `seen` cap danh tinh doc truoc do (de lan ghi sau van phat hien duoc) · `retained` giu
   * ghi nhan cu (hoac danh dau CU khi chua co) · `at` thoi diem quan sat dung cho module chua co ghi nhan.
   */
  observe(urls: Iterable<string>, options: ObserveOptions = {}): void {
    const { seen = new Map<string, string | undefined>(), retained = new Set<string>(), at = this.now() } = options;
    const records = new Map<string, string | undefined>();
    for (const url of urls) {
      if (retained.has(url)) records.set(url, this.records.get(url));
      else if (seen.has(url)) records.set(url, seen.get(url));
      else {
        const identity = identityOf(url);
        records.set(url, identity === undefined || identity.modifiedAt > at ? undefined : identity.key);
      }
    }
    this.records = records;
    this.observedAt = at;
  }

  /**
   * Ghi nhan danh tinh hien tai cua cac module VUA duoc danh gia lai, khong dung toi ghi nhan khac.
   * @param urls - URL `file:` cua cac module vua nap lai.
   */
  refresh(urls: Iterable<string>): void {
    for (const url of urls) this.records.set(url, identityOf(url)?.key);
  }
}
