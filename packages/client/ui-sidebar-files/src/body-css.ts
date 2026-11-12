/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc CSS của thân tab cây thư mục (nguyên khai báo của bản gốc, đổi tiền tố lớp sang gbhFiles_).
 */

/** CSS của thân tab — giữ NGUYÊN mọi khai báo của bản gốc, chỉ đổi tiền tố lớp. */
export const FILES_BODY_CSS = ".gbhFiles_root{height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);flex-direction:column;flex:auto;line-height:1.5;display:flex}.gbhFiles_header{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;align-items:center;gap:4px;height:38px;padding:0 6px 0 16px;display:flex}.gbhFiles_path{margin-right:12px}.gbhFiles_body{scrollbar-gutter:stable;flex:auto;min-height:0;margin-right:2px;padding:8px 0 8px 8px;overflow:auto}.gbhFiles_body::-webkit-scrollbar-track{margin:2px}.gbhFiles_level{margin:0;padding:0;list-style:none}.gbhFiles_level .gbhFiles_level{padding-left:18px}.gbhFiles_item{margin:0;padding:0}.gbhFiles_row{width:100%;min-width:0;color:inherit;font:inherit;text-align:left;border-radius:var(--dsw-radius-md);cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;padding:5px 10px;display:flex}.gbhFiles_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.gbhFiles_icon{color:var(--dsw-alias-label-tertiary);flex:none}.gbhFiles_fileIcon{flex:none}.gbhFiles_name{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.gbhFiles_other{color:var(--dsw-alias-label-tertiary);cursor:default}.gbhFiles_other:hover{background:0 0}.gbhFiles_note{color:var(--dsw-alias-label-tertiary);margin:0;padding:3px 10px;font-size:12px}.gbhFiles_status{flex-direction:column;padding:12px 10px;display:flex}.gbhFiles_statusLine{color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);margin:0;line-height:1.6}.gbhFiles_tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}.gbhFiles_tool svg{width:15px;height:15px}.gbhFiles_tool:hover,.gbhFiles_tool[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.gbhFiles_titleIcon{flex:none}";

/** Id của thẻ style, để không chèn hai lần. */
export const FILES_CSS_TAG_ID = "@galaxy-blackhole/gbh-client-ui-sidebar-files/FilesBody.module.css";

/** Tên lớp sau khi đổi tiền tố (khoá giữ nguyên như bản gốc). */
export const FILES_BODY_CLASS = Object.freeze({
  /** Lớp của §body§. */
  body: "gbhFiles_body",
  /** Lớp của §fileIcon§. */
  fileIcon: "gbhFiles_fileIcon",
  /** Lớp của §header§. */
  header: "gbhFiles_header",
  /** Lớp của §icon§. */
  icon: "gbhFiles_icon",
  /** Lớp của §item§. */
  item: "gbhFiles_item",
  /** Lớp của §level§. */
  level: "gbhFiles_level",
  /** Lớp của §name§. */
  name: "gbhFiles_name",
  /** Lớp của §note§. */
  note: "gbhFiles_note",
  /** Lớp của §other§. */
  other: "gbhFiles_other",
  /** Lớp của §path§. */
  path: "gbhFiles_path",
  /** Lớp của §root§. */
  root: "gbhFiles_root",
  /** Lớp của §row§. */
  row: "gbhFiles_row",
  /** Lớp của §status§. */
  status: "gbhFiles_status",
  /** Lớp của §statusLine§. */
  statusLine: "gbhFiles_statusLine",
  /** Lớp của §titleIcon§. */
  titleIcon: "gbhFiles_titleIcon",
  /** Lớp của §tool§. */
  tool: "gbhFiles_tool",
});

/**
 * Chèn CSS của thân tab MỘT LẦN vào document.
 * Nhận: không.
 * Trả: không — thoát sớm khi không có document (kiểm thử) hoặc thẻ đã có.
 */
export function ensureFilesCss(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(FILES_CSS_TAG_ID) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-sidebar-files";
  tag.dataset.pluginCss = FILES_CSS_TAG_ID;
  tag.textContent = FILES_BODY_CSS;
  document.head.appendChild(tag);
}
