/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tinh thoi luong/token cho tung dong danh muc subagent — nguyen van cong thuc ban goc
 */

/** Ham dich cua namespace subagent: nhan khoa + tham so, tra chuoi da noi. */
export interface Translator {
  /** Dich mot khoa cua namespace voi tham so noi suy. */
  (key: string, params?: Record<string, string | number>): string;
}

/** Bon ro dung luong token roi nhau ma nha cung cap tra ve. */
export interface TokenUsage {
  /** Token dau vao khong tinh cache. */
  readonly uncachedInputTokens: number;
  /** Token dau ra. */
  readonly outputTokens: number;
  /** Token doc tu cache. */
  readonly cacheReadTokens: number;
  /** Token ghi vao cache. */
  readonly cacheWriteTokens: number;
}

/** Khoang thoi gian chay cua mot phien con. */
export interface SubagentTiming {
  /** Khoang dang chay (khong co khi phien da nghi). */
  readonly active?: { readonly since: number; readonly through: number };
  /** Tong thoi gian da chot (ms). */
  readonly settledMs: number;
  /** Luot cuoi da hoan tat hay chua. */
  readonly lastTurnCompleted?: boolean;
}

/** Phan chieu cua mot phien ma bang danh muc doc. */
export interface SessionSummary {
  /** Tieu de phien. */
  readonly title?: string;
  /** Phien dang chay hay khong. */
  readonly running?: boolean;
  /** Nguon goc phien ("subagent" voi phien con). */
  readonly origin?: string;
  /** Id phien cha. */
  readonly parentId?: string;
  /** Phien con trong (chua co luot nao). */
  readonly blank?: boolean;
  /** Kho projection cua phien. */
  readonly projectionValues?: {
    /** Khoang thoi gian chay. */
    readonly subagentTiming?: SubagentTiming;
    /** Ro dung luong token. */
    readonly tokenUsage?: TokenUsage;
  };
}

/** Mot muc trong danh muc subagent cua mot phien. */
export interface CatalogEntry {
  /** Id phien con. */
  readonly id: string;
  /** Nhan hien thi (thieu thi dung id). */
  readonly label?: string;
  /** Che do tiep noi cua phien con. */
  readonly mode: string;
  /** Trang thai hoat dong da suy ra. */
  readonly activity: string;
}

/** Trang thai mot tang danh muc. */
export interface CatalogState {
  /** "loading" · "ready" · "error" · "migration-required". */
  readonly state: string;
  /** Loi khi nap that bai. */
  readonly error?: { readonly message?: string } | null;
  /** Cac muc con truc tiep. */
  readonly entries: readonly CatalogEntry[];
}

/** Kho danh muc theo id phien. */
export type CatalogMap = Record<string, CatalogState | undefined>;

/** Nam phan cua mot khoang thoi gian da tach. */
export interface SplitDuration {
  /** Giay (0..59). */
  readonly seconds: number;
  /** Phut (0..59). */
  readonly minutes: number;
  /** Gio (0..23). */
  readonly hours: number;
  /** Ngay (khong chan). */
  readonly days: number;
  /** Tong so phut. */
  readonly totalMinutes: number;
  /** Tong so gio. */
  readonly totalHours: number;
}

/**
 * Dem token rut gon, cung hinh dang voi dai so lieu cua hoi thoai.
 * Nhan: value — so token; t — ham dich.
 * Tra: chuoi token da rut gon (K/M khi lon).
 */
export function formatTokens(value: number, t: Translator): string {
  const scaled = (next: number): string => (next >= 100 ? String(Math.round(next)) : String(Math.round(next * 10) / 10));
  if (value < 1e3) return String(value);
  if (value < 1e6) return t("tokens.thousand", { value: scaled(value / 1e3) });
  return t("tokens.million", { value: scaled(value / 1e6) });
}

/**
 * Cong bon ro dung luong token roi nhau cua nha cung cap.
 * Nhan: usage — ro dung luong, hoac undefined khi phien chua bao gio chay.
 * Tra: tong token, hoac undefined.
 */
export function tokenTotal(usage: TokenUsage | undefined): number | undefined {
  if (usage === undefined) return undefined;
  return usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}

/**
 * Thoi luong chay chinh xac (giay nguyen) cua mot dong danh muc.
 * Nhan: summary — chieu phien; activity — trang thai hoat dong; now — moc bay gio.
 * Tra: so mili giay da chay, hoac undefined khi thieu du lieu.
 */
export function activityDuration(summary: SessionSummary | undefined, activity: string, now: number): number | undefined {
  if (summary === undefined) return undefined;
  const timing = summary.projectionValues?.subagentTiming;
  if (timing === undefined) return undefined;
  if (timing.active === undefined) return timing.settledMs;
  const end = activity === "running" ? now : timing.active.through;
  return timing.settledMs + Math.max(0, end - timing.active.since);
}

/**
 * Tach mot khoang thoi gian thanh nam phan.
 * Nhan: ms — so mili giay.
 * Tra: nam phan (giay, phut, gio, ngay, tong phut, tong gio).
 */
export function splitDuration(ms: number): SplitDuration {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1e3);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  return {
    seconds: totalSeconds % 60,
    minutes: totalMinutes % 60,
    hours: totalHours % 24,
    days: Math.floor(totalHours / 24),
    totalMinutes,
    totalHours,
  };
}

/**
 * Dinh dang mot khoang thoi gian voi do chinh xac giam dan khi do lon tang.
 * Nhan: ms — so mili giay; t — ham dich.
 * Tra: chuoi thoi luong da dinh dang.
 */
export function formatDuration(ms: number, t: Translator): string {
  const { seconds, minutes, hours, days, totalMinutes, totalHours } = splitDuration(ms);
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    return months === 0 ? t("duration.years", { years }) : t("duration.yearsMonths", { years, months });
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return remainingDays === 0 ? t("duration.months", { months }) : t("duration.monthsDays", { months, days: remainingDays });
  }
  if (days > 0) {
    return hours === 0 ? t("duration.days", { days }) : t("duration.daysHours", { days, hours });
  }
  if (totalHours > 0) {
    return t("duration.hours", { hours: totalHours, minutes: String(minutes).padStart(2, "0"), seconds: String(seconds).padStart(2, "0") });
  }
  if (totalMinutes > 0) return t("duration.minutes", { minutes: totalMinutes, seconds: String(seconds).padStart(2, "0") });
  return t("duration.seconds", { seconds });
}

/**
 * Dinh dang thoi luong voi giay nguyen ven cho hover va ten truy cap.
 * Nhan: ms — so mili giay; t — ham dich.
 * Tra: chuoi thoi luong chinh xac (chi khac ban rut gon khi tu mot ngay tro len).
 */
export function formatExactDuration(ms: number, t: Translator): string {
  const { seconds, minutes, hours, days } = splitDuration(ms);
  return days === 0
    ? formatDuration(ms, t)
    : t("duration.exactDays", {
        days,
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
}
