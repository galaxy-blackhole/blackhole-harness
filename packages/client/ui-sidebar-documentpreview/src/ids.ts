/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang dinh danh cua row ui-sidebar-documentpreview: mot id module, bon id nguoi ngoi, muoi ten slot nguyen van
 */

/**
 * Ten package cua ta — id DUY NHAT ma bundle duoc phep dang ky.
 *
 * Bundle tu khai id nay bang window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (build.ts phat ra). Id cua goi GOC KHONG bao gio duoc load() trong bundle: no thuoc
 * gbh.row.aliases va tang nap tu sinh entry alias tro ve cung URL. MOT BUNDLE MOT ID.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-documentpreview";

/** Ten package GOC cua DSH — chi duoc khai o gbh.row.aliases, khong bao gio load() trong bundle. */
export const STOCK_NAME = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";

/** Namespace tu dien cua than plugin — nguyen van tu bundle goc. */
export const NS = "sidebarDocumentPreview";

/** Loai tab ma goi nay so huu — nguyen van tu bundle goc (TEXTPREVIEW_KIND). */
export const TEXTPREVIEW_KIND = "text";

/**
 * Id cua ban cai dat trong so kieu tab, DONG THOI la key ma hai cho ngoi dang ky duoi.
 *
 * ⚠️ KEYED: sidebar tra cho ngoi theo definition?.id ?? tab.kind, nen key cua slot
 * sidebar.right.pane.tab PHAI BANG id cua dinh nghia loai tab. Ban goc dung DUNG MOT gia tri
 * ("@deepseek-ai/dsh-client-ui-sidebar-documentpreview") cho ca hai; o day ca hai deu la
 * PACKAGE_NAME — lech nhau la renderer roi vao fallback va tab hien 'khong kha dung' MA KHONG
 * CO LOI CONSOLE. Cung khuon voi FILES_ID cua ui-sidebar-files.
 */
export const TEXTPREVIEW_ID = PACKAGE_NAME;

/** Id nguoi ngoi cua ban xem truc tiep (truong hop lui) — ban goc: <goi>/text. */
export const PLAIN_BODY_ID = PACKAGE_NAME + "/text";

/** Id nguoi ngoi cua ban xem Markdown — ban goc: <goi>/markdown. */
export const MARKDOWN_BODY_ID = PACKAGE_NAME + "/markdown";

/** Id nguoi ngoi cua ban xem HTML — ban goc: <goi>/html. */
export const HTML_BODY_ID = PACKAGE_NAME + "/html";

/** Id nguoi ngoi cua ban xem anh — ban goc: <goi>/image. */
export const IMAGE_BODY_ID = PACKAGE_NAME + "/image";

/** Id nguoi ngoi cua ban xem PDF — ban goc: <goi>/pdf. */
export const PDF_BODY_ID = PACKAGE_NAME + "/pdf";

/** Id nguoi ngoi cua ban xem ma nguon — ban goc: <goi>/code. */
export const CODE_BODY_ID = PACKAGE_NAME + "/code";

/** Id nguoi ngoi cua ban xem Office — ban goc: <goi>/office. */
export const OFFICE_BODY_ID = PACKAGE_NAME + "/office";

/** Id nguoi ngoi cua ban xem bang tinh — ban goc: <goi>/excel. */
export const EXCEL_BODY_ID = PACKAGE_NAME + "/excel";

/** Ten slot than tab cua thanh ben phai — nguyen van tu bundle goc. */
export const SLOT_PANE_TAB = "sidebar.right.pane.tab";

/** Ten slot tieu de (chip) cua tab thanh ben phai — nguyen van tu bundle goc. */
export const SLOT_PANE_TAB_TITLE = "sidebar.right.pane.tab.title";

/** Ten slot than tai lieu, tra cho ngoi theo KEY (keyed) — nguyen van tu bundle goc. */
export const SLOT_DOCUMENT = "sidebar.right.tab.document";

/** Ten slot hanh dong theo tai lieu, tra cho ngoi theo KEY (keyed) — nguyen van tu bundle goc. */
export const SLOT_DOCUMENT_ACTION = "sidebar.right.tab.document.action";

/** Ten slot CON kieu danh sach trong hang dau tai lieu — nguyen van tu bundle goc. */
export const SLOT_DOCUMENT_ACTIONS = "sidebar.right.tab.document.actions";

/** Ten slot CON kieu danh sach cho file khong xem truoc duoc — nguyen van tu bundle goc. */
export const SLOT_DOCUMENT_UNPREVIEWABLE = "sidebar.right.tab.document.unpreviewable";

/** Ten slot CON kieu keyed chua ban xem PDF cua tai lieu Office — nguyen van tu bundle goc. */
export const SLOT_DOCUMENT_OFFICE_PDF = "sidebar.right.tab.document.office.pdf";

/** Sau muc ma ban xem HTML nhan — nguyen van tu bundle goc. */
export const HTML_BODY_EXTENSIONS: readonly string[] = ["html", "htm"];

/** Sau muc ma ban xem Markdown nhan — nguyen van tu bundle goc. */
export const MARKDOWN_BODY_EXTENSIONS: readonly string[] = ["md", "markdown"];

/** Sau muc ma ban xem anh nhan — nguyen van tu bundle goc. */
export const IMAGE_BODY_EXTENSIONS: readonly string[] = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"];

/** Sau muc nhi phan cua anh (SVG KHONG nam trong day vi XML cua no dang doc duoc) — nguyen van ban goc. */
export const BINARY_IMAGE_EXTENSIONS: readonly string[] = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"];

/** Sau muc ma ban xem bang tinh nhan — nguyen van tu bundle goc. */
export const EXCEL_EXTENSIONS: readonly string[] = ["xlsx", "xls", "csv", "tsv"];

/** Sau muc nhi phan cua bang tinh — nguyen van tu bundle goc. */
export const EXCEL_BINARY_EXTENSIONS: readonly string[] = ["xlsx", "xls"];

/** Sau muc ma ban xem Office nhan — nguyen van tu tu bundle goc. */
export const OFFICE_EXTENSIONS: readonly string[] = ["doc", "docx", "ppt", "pptx"];

/** Muc uu tien cua nguoi ngoi "dung san" — nguyen van ban goc. */
export const PRIORITY_BUILTIN = "builtin";

/** Muc uu tien cua loai tab lui — nguyen van ban goc. */
export const PRIORITY_FALLBACK = "fallback";

/** Che do nap: doc theo TRANG van ban — nguyen van ban goc. */
export const LOADING_TEXT_PAGES = "text-pages";

/** Che do nap: doc Tron bo byte — nguyen van ban goc. */
export const LOADING_BYTES_COMPLETE = "bytes-complete";

/** Che do nap: giao lai cho mot nguoi ngoi tu nap — nguyen van ban goc. */
export const LOADING_RENDERER = "renderer";

/** Nhan hieu ung vong doi — nguyen van nhan cua ban goc (dung cho log chan doan). */
export const EFFECT = {
  /** Chu so huu so ban xem tai lieu (ctx.reflect.provide). */
  previews: "ui-sidebar-documentpreview: documentPreviews",
  /** Loai tab van ban trong sidebarRightTabs. */
  textType: "ui-sidebar-documentpreview: text type",
  /** Tu dien namespace sidebarDocumentPreview. */
  dictionaries: "ui-sidebar-documentpreview: dictionaries",
  /** Than tab van ban trong slot sidebar.right.pane.tab. */
  textBody: "ui-sidebar-documentpreview: text body",
  /** Tieu de tab van ban trong slot sidebar.right.pane.tab.title. */
  textTitle: "ui-sidebar-documentpreview: text title",
  /** Tu dien cua ban xem Markdown. */
  markdownDictionaries: "document-markdown: dictionaries",
  /** Metadata cua ban xem Markdown. */
  markdownMetadata: "document-markdown: metadata",
  /** Than tai lieu cua ban xem Markdown. */
  markdownBody: "document-markdown: body",
  /** Tu dien cua ban xem anh. */
  imageDictionaries: "document-image: dictionaries",
  /** Metadata cua ban xem anh. */
  imageMetadata: "document-image: metadata",
  /** Than tai lieu cua ban xem anh. */
  imageBody: "document-image: body",
} as const;
