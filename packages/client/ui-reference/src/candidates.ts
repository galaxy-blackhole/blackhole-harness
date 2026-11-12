/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Chieu ung vien tep/phien thanh muc menu \`@\` + breadcrumb cua thu muc dang xem
 */

import { abbreviateHomePath, formatFileMention, type MentionCandidate } from "./workspace-path.ts";

/** Hàm dịch của namespace `reference` (nhận tham số điền `{n}`/`{path}`). */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/** Một mục trong menu `@`. */
export interface TriggerItem {
  /** Nhãn hiển thị. */
  name: string;
  /** Mô tả phụ (vị trí, tuổi phiên). */
  description?: string;
  /** Icon của seam input-trigger. */
  icon: string;
  /** Tiêu đề nhóm. */
  section: string;
  /** Dữ liệu JSON mà `onPick` đọc lại. */
  value: string;
  /** true khi mục này đi sâu thêm một cấp. */
  drill?: true;
}

/** Một breadcrumb của thư mục đang xem. */
export interface Crumb {
  /** Nhãn hiển thị. */
  label: string;
  /** Giá trị để chọn lại cấp đó. */
  value: string;
  /** true cho cấp đang xem. */
  current?: true;
}

/** Ứng viên tệp/thư mục do RPC trả về. */
export interface FileCandidateRow extends MentionCandidate {
  /** Tên hiển thị do Host tính (không dùng ở đây nhưng thuộc bản ghi). */
  label?: string;
}

/** Ứng viên phiên do RPC trả về. */
export interface SessionCandidateRow {
  /** Phiên được đề xuất. */
  sessionId: string;
  /** Nhãn ngắn. */
  label: string;
  /** Chuỗi chèn khi người dùng chọn. */
  mention: string;
  /** Tiêu đề đầy đủ (ưu tiên hơn `label`). */
  displayTitle?: string;
  /** Thời điểm tạo (dùng khi không có `updatedAt`). */
  createdAt: number;
  /** Thư mục làm việc của phiên. */
  cwd?: string;
  /** true khi phiên thuộc cùng workspace ⇒ không cần hiện vị trí. */
  sameWorkspace?: boolean;
}

/** Kết quả RPC dạng `Result` của typert. */
export type RpcResult<T> = { ok: true; value: T } | { ok: false; error?: unknown };

/**
 * Breadcrumb của một thư mục đang ĐƯỢC ĐI SÂU vào: chỉ lần drill mới cần, vì người dùng đã bị thay
 * văn bản đang đọc bằng một cấp sâu hơn nên phải có đường quay lại.
 * Nhận: `query` — văn bản sau `@`, `quoted` — token đang là đường dẫn trong ngoặc, `drilled` — do drill hay do gõ, `t` — hàm dịch.
 * Trả: danh sách crumb, hoặc `undefined` khi không cần header.
 */
export function crumbsFor(query: string, quoted: boolean, drilled: boolean, t: Translator): Crumb[] | undefined {
  if (!drilled) return undefined;
  const slash = query.lastIndexOf("/");
  if (slash < 0) return undefined;
  const segments = query.slice(0, slash).split("/").filter((segment) => segment !== "");
  const crumbs: Crumb[] = [
    { label: t("crumb.root"), value: directoryValue(t("crumb.root"), quoted ? '@"' : "@") },
  ];
  for (const [index, segment] of segments.entries()) {
    const mention = formatFileMention({ path: segments.slice(0, index + 1).join("/"), kind: "directory" }, quoted);
    if (mention === undefined) return undefined;
    crumbs.push({
      label: segment,
      value: directoryValue(segment, mention),
      ...(index === segments.length - 1 ? { current: true as const } : {}),
    });
  }
  return crumbs;
}

/**
 * Đóng gói một đích thư mục thành payload drill mà `onPick` đã hiểu.
 * Nhận: `label` — nhãn hiển thị, `mention` — chuỗi chèn.
 * Trả: chuỗi JSON của một ứng viên `file` kiểu `directory`.
 */
function directoryValue(label: string, mention: string): string {
  return JSON.stringify({ kind: "file", fileKind: "directory", label, mention });
}

/**
 * Chiếu một ứng viên tệp/thư mục thành mục menu (rỗng khi ngữ pháp editor không biểu diễn được).
 * Nhận: `candidate` — ứng viên RPC, `preserveQuote` — giữ dấu ngoặc, `withLocation` — có hiện thư mục cha, `t` — hàm dịch.
 * Trả: mảng 0 hoặc 1 mục menu.
 */
export function fileCandidate(
  candidate: MentionCandidate,
  preserveQuote: boolean,
  withLocation: boolean,
  t: Translator,
): TriggerItem[] {
  const mention = formatFileMention(candidate, preserveQuote);
  if (mention === undefined) return [];
  const slash = candidate.path.lastIndexOf("/");
  const name = candidate.path.slice(slash + 1);
  const parent = slash < 0 ? "" : candidate.path.slice(0, slash);
  const directory = candidate.kind === "directory";
  const value = { kind: "file", fileKind: candidate.kind, label: name, mention };
  return [
    {
      name: name + (directory ? "/" : ""),
      ...(withLocation && parent !== "" ? { description: parent } : {}),
      icon: directory ? "folder" : "file",
      section: t("section.files"),
      value: JSON.stringify(value),
      ...(directory ? { drill: true as const } : {}),
    },
  ];
}

/**
 * Chiếu một ứng viên phiên thành mục menu: tuổi phiên + vị trí (khi khác workspace).
 * Nhận: `candidate` — ứng viên RPC, `label` — nhãn đã chọn, `updatedAt` — mốc cập nhật, `now` — hiện tại,
 *       `home` — home của Host (để rút gọn), `section` — tiêu đề nhóm, `t` — hàm dịch, `relativeTime` — hàm của ui-primitives.
 * Trả: một mục menu.
 */
export function sessionCandidate(
  candidate: SessionCandidateRow,
  label: string,
  updatedAt: number,
  now: number,
  home: string | undefined,
  section: string,
  t: Translator,
  relativeTime: (at: number, now: number) => { unit: string; n: number },
): TriggerItem {
  const { unit, n } = relativeTime(updatedAt, now);
  const age = unit === "now" ? t("time.now") : t("time." + unit, { n });
  const location =
    candidate.sameWorkspace === true
      ? undefined
      : candidate.cwd === undefined
        ? t("candidate.noCwd")
        : abbreviateHomePath(candidate.cwd, home);
  const value = { kind: "session", label, mention: candidate.mention };
  return {
    name: label,
    description: location === undefined ? age : location + " · " + age,
    icon: "session",
    section,
    value: JSON.stringify(value),
  };
}

/** Payload mà mỗi mục menu `@` mang theo trong `value`. */
export interface CandidatePayload {
  /** Loại tham chiếu. */
  kind: "file" | "session";
  /** Với `kind: "file"`: tệp hay thư mục. */
  fileKind?: "file" | "directory";
  /** Nhãn hiển thị. */
  label: string;
  /** Chuỗi chèn vào ô soạn. */
  mention: string;
}

/**
 * Đọc lại dữ liệu một mục menu đã chọn.
 * Nhận: `value` — chuỗi JSON trong `candidate.value`.
 * Trả: payload đã parse, hoặc `undefined`.
 */
export function parseCandidate(value: string | undefined): CandidatePayload | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(value) as CandidatePayload;
}
