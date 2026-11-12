/*
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Cau chu chan doan khi doc/ghi tuy chon phim tat that bai
*/

/** Tu dien cua man phim tat (co tham so noi suy). */
export type ShortcutDictionary = (key: string, params?: Record<string, unknown>) => string;

/** Anh chup tuy chon doc that bai. */
export interface UnreadableConfig {
  /** Khoa loi (mac dinh `read`); anh chup that dung `'read' | 'invalid' | 'future' | null`. */
  readonly error?: string | null;
  /** Co dang dung gia tri mac dinh khong. */
  readonly usingDefaults?: boolean;
}

/** Ket qua ghi bi tu choi. */
export interface ShortcutWriteFailure {
  /** Trang thai. */
  readonly status: string;
  /** Van de cu the. */
  readonly issue?: string;
  /** Cac lenh xung dot. */
  readonly conflicts?: readonly string[];
  /** Anh chup khi tai lieu khong doc duoc. */
  readonly snapshot?: UnreadableConfig;
}

/**
* Identify the unreadable preferences, their recovery path, and the bindings still in use.
* @param config - failed read and last accepted preferences.
* @param runtime - storage owner whose location and reload action to show.
* @param t - shortcut dictionary.
* @returns localized recovery guidance without replacing the stored document.
*/
export function shortcutReadFailure(config: UnreadableConfig, runtime: string, t: ShortcutDictionary): string {
const location = t(runtime === "desktop" ? "desktop-document" : "web-document");
const reload = t(runtime === "desktop" ? "desktop-reload" : "web-reload");
return `${t(config.error ?? "read", {
	location,
	reload
})} ${t(config.usingDefaults ? "using-defaults" : "using-accepted")}`;
}
/**
* Describe an unsuccessful preference write without losing command names.
* @param result - rejected operation result.
* @param catalog - current command labels.
* @param t - shortcut dictionary.
* @param runtime - storage owner for unreadable-document recovery guidance.
* @returns localized diagnosis for a system toast and accessible field description.
*/
export function shortcutFailure(result: ShortcutWriteFailure, catalog: readonly { readonly id: string; readonly label: string }[], t: ShortcutDictionary, runtime: string): string {
if (result.status === "unreadable") return shortcutReadFailure(result.snapshot ?? {}, runtime, t);
return result.issue ? t(result.issue) : result.status === "conflict" ? t("conflict", { commands: result.conflicts?.map((id) => catalog.find((row: { readonly id: string }) => row.id === id)?.label ?? id).join(", ") ?? "" }) : t(result.status);
}
