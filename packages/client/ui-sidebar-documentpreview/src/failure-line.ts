/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cau mo ta loi Remote theo goc nhin NGUOI DOC TEP, va cach xu ly cua trang thai rong
 */

/** Mot lan goi Remote da settled. */
export interface RemoteFailureLike {
  /** Ma loi on dinh. */
  code: string;
  /** Thong diep cho nguoi doc. */
  message: string;
  /** Chi tiet kem theo (vi du gioi han byte). */
  details?: Record<string, unknown>;
}

/** Ham dich da bind namespace. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Doc so byte theo cach nguoi doc doc.
 * Nhan: bytes — so byte.
 * Tra: chuoi da rut gon (B · KB · MB).
 */
export function humanBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return Math.round(bytes / (1024 * 1024)) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

/**
 * Noi ro cai gi da hong, theo goc nhin TEP chu khong phai theo duong truyen.
 * Nhan: t — ham dich da bind namespace; failure — loi Remote da settled.
 * Tra: dong de hien thay cho noi dung tep.
 */
export function failureLine(t: Translate, failure: RemoteFailureLike): string {
  switch (failure.code) {
    case "workspace-file/not-found": return t("error.notFound");
    case "workspace-file/too-large": return t("error.tooLarge", { limit: humanBytes(Number(failure.details?.limit ?? 0)) });
    case "workspace-file/not-text": return t("error.notText");
    case "workspace-file/not-regular-file": return t("error.notRegularFile");
    default: return t("error.unavailable", { message: failure.message });
  }
}

/**
 * Chon hanh dong cua trang thai rong cho mot lan doc hong da settled.
 * Nhan: failure — loi Remote da settled.
 * Tra: 'open' khi tep doc duoc nhung ban xem nay khong ve duoc, 'none' khi khong co gi de hien hay mo,
 *      'retry' cho phan con lai.
 */
export function emptyFailureRecourse(failure: RemoteFailureLike): "open" | "none" | "retry" {
  switch (failure.code) {
    case "workspace-file/not-text":
    case "workspace-file/too-large": return "open";
    case "workspace-file/not-found":
    case "workspace-file/not-regular-file": return "none";
    default: return "retry";
  }
}
