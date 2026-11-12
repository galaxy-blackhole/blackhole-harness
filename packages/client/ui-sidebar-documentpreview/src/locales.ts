/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tu dien cua muoi namespace ma row nay so huu — NGUYEN VAN tung chuoi tu bundle goc
 */

import type { Translate } from "./failure-line.ts";

/** Namespace cua than plugin — nguyen van ban goc. */
export const NS = "sidebarDocumentPreview";

/** Tu dien tieng Trung gian the cua namespace sidebarDocumentPreview — nguon dung cua tap khoa. */
export const zh = {
  loading: "文档渲染中...",
  loadMore: "加载更多",
  changed: "文件已更新，当前显示为旧内容",
  reloadNow: "重新载入",
  reload: "重新读取文件",
  autoRefresh: "自动刷新",
  "autoRefresh.enable": "开启自动刷新",
  "autoRefresh.disable": "关闭自动刷新",
  "wrap.enable": "自动换行",
  "wrap.disable": "取消换行",
  "wrap.aria": "自动换行",
  openWith: "打开方式",
  "viewer.text": "纯文本",
  resourceUnavailable: "文件资源服务不可用",
  rendererUnavailable: "预览器 {name} 不可用",
  unsupportedFile: "该格式文件暂时无法预览",
  "error.notFound": "文件不存在，可能已被移动或删除",
  "error.tooLarge": "单页内容超过 {limit} 上限，无法读取",
  "error.notText": "该格式文件暂时无法预览",
  "error.notRegularFile": "该路径不是普通文件，没有可显示的内容",
  "error.unavailable": "读取失败：{message}",
  retry: "重试",
} as const;

/** Khoa cua namespace sidebarDocumentPreview. */
export type SidebarDocumentPreviewKey = keyof typeof zh;

/** Ham dich da bind namespace sidebarDocumentPreview. */
export type DocumentTranslate = Translate;

/** Ban tieng Anh, da doi chieu du khoa voi ban tieng Trung. */
export const en: Record<SidebarDocumentPreviewKey, string> = {
  loading: "Rendering document...",
  loadMore: "Load more",
  changed: "The file has changed, showing the previous content.",
  reloadNow: "Reload",
  reload: "Read the file again",
  autoRefresh: "Auto refresh",
  "autoRefresh.enable": "Enable auto refresh",
  "autoRefresh.disable": "Disable auto refresh",
  "wrap.enable": "Turn on line wrap",
  "wrap.disable": "Turn off line wrap",
  "wrap.aria": "Line wrap",
  openWith: "Open with",
  "viewer.text": "Plain text",
  resourceUnavailable: "The file resource service is unavailable.",
  rendererUnavailable: "The {name} preview is unavailable.",
  unsupportedFile: "Preview is not available for this file type yet.",
  "error.notFound": "File not found. It may have been moved or deleted.",
  "error.tooLarge": "This page exceeds the {limit} limit and cannot be read.",
  "error.notText": "Preview is not available for this file type yet.",
  "error.notRegularFile": "Not a regular file, nothing to display.",
  "error.unavailable": "Read failed: {message}",
  retry: "Retry",
};

/** Namespace cua ban xem Markdown — nguyen van ban goc. */
export const NS_MARKDOWN = "documentMarkdown";

/** Tu dien tieng Trung cua ban xem Markdown (kem chu cua primitive). */
export const markdownZh = { "viewer.label": "Markdown", "code.copy": "复制", "code.copied": "已复制", footnotes: "脚注" } as const;

/** Ban tieng Anh cua ban xem Markdown, du khoa voi ban tieng Trung. */
export const markdownEn: Record<keyof typeof markdownZh, string> = { "viewer.label": "Markdown", "code.copy": "Copy", "code.copied": "Copied", footnotes: "Footnotes" };

/** Namespace cua ban xem HTML — nguyen van ban goc. */
export const NS_HTML = "documentHtml";

/** Tu dien tieng Trung cua ban xem HTML. */
export const htmlZh = { title: "HTML", frame: "HTML 文档预览", loading: "文档渲染中...", failed: "无法预览这份 HTML 文档" } as const;

/** Ban tieng Anh cua ban xem HTML. */
export const htmlEn: Record<keyof typeof htmlZh, string> = { title: "HTML", frame: "HTML document preview", loading: "Rendering document...", failed: "This HTML document could not be previewed." };

/** Chu dung chung cho moi ban xem co thu phong — nguyen van ban goc (zoom/locales). */
export const zoomZh = { zoomControls: "缩放控件", zoomMenu: "选择缩放比例", zoomOut: "缩小", zoomIn: "放大", zoomFitWidth: "适应宽度", zoomValue: "{percent}%" } as const;

/** Ban tieng Anh cua chu dung chung cho ban xem co thu phong. */
export const zoomEn: Record<keyof typeof zoomZh, string> = { zoomControls: "Zoom controls", zoomMenu: "Choose zoom", zoomOut: "Zoom out", zoomIn: "Zoom in", zoomFitWidth: "Fit width", zoomValue: "{percent}%" };

/** Namespace cua ban xem anh — nguyen van ban goc. */
export const NS_IMAGE = "sidebarImage";

/** Tu dien tieng Trung cua ban xem anh. */
export const imageZh = { ...zoomZh, title: "图片", preview: "图片预览：{name}", loading: "文档渲染中...", failed: "无法显示这张图片", unsupported: "图片预览需要完整文件内容" } as const;

/** Ban tieng Anh cua ban xem anh. */
export const imageEn: Record<keyof typeof imageZh, string> = { ...zoomEn, title: "Image", preview: "Image preview: {name}", loading: "Rendering document...", failed: "This image could not be displayed.", unsupported: "Image preview requires the complete file contents." };

/** Namespace cua ban xem PDF — nguyen van ban goc. */
export const NS_PDF = "sidebarPdf";

/** Tu dien tieng Trung cua ban xem PDF. */
export const pdfZh = { ...zoomZh, title: "PDF", pageImage: "PDF 第 {page} 页", loading: "文档渲染中...", rendering: "正在绘制页面…", failed: "无法显示 PDF：{message}", password: "此 PDF 需要密码，暂不支持预览", workerFailed: "PDF 渲染进程无法继续，请重试", unsupported: "PDF 预览需要完整文件内容", retry: "重试" } as const;

/** Ban tieng Anh cua ban xem PDF. */
export const pdfEn: Record<keyof typeof pdfZh, string> = { ...zoomEn, title: "PDF", pageImage: "PDF page {page}", loading: "Rendering document...", rendering: "Rendering page…", failed: "Cannot display PDF: {message}", password: "This PDF requires a password; password-protected previews are not supported.", workerFailed: "The PDF rendering process could not continue. Please retry.", unsupported: "PDF preview requires the complete file contents.", retry: "Retry" };

/** Namespace cua ban xem ma nguon — nguyen van ban goc. */
export const NS_CODE = "sidebarCodePreview";

/** Tu dien tieng Trung cua ban xem ma nguon. */
export const codeZh = { title: "代码", copy: "复制", copied: "已复制" } as const;

/** Ban tieng Anh cua ban xem ma nguon. */
export const codeEn: Record<keyof typeof codeZh, string> = { title: "Code", copy: "Copy", copied: "Copied" };

/** Namespace cua ban xem Office — nguyen van ban goc. */
export const NS_OFFICE = "sidebarOffice";

/** Tu dien tieng Trung cua ban xem Office. */
export const officeZh = {
  title: "Office 文档",
  loading: "文档渲染中...",
  retry: "重试",
  viewMissingFonts: "缺失 {count} 种字体，点击查看",
  missingFontsTitle: "缺失的字体",
  missingFontsDescription: "本次预览无法使用以下字体，预览中的文字和排版可能与原文档不同。",
  missingFontsCount: "{count} 种字体",
  closeDetails: "关闭字体详情",
  unavailable: "Office 预览不可用。请在运行 Galaxy Blackhole 的主机上启用文档预览服务。",
  invalid: "无法预览此 Office 文件。文件可能已损坏、受密码保护，或与扩展名不符。",
  tooLarge: "Office 文件或转换后的 PDF 超过预览大小上限，请缩小文件或调整预览配置。",
  failed: "Office 转换失败，未生成可用的 PDF。请检查该文件后重试。",
  timeout: "Office 转换超时，请重试。",
  busy: "Office 预览任务较多，请稍后重试。",
  changed: "文件在读取时已更改，请重新打开预览。",
} as const;

/** Ban tieng Anh cua ban xem Office. */
export const officeEn: Record<keyof typeof officeZh, string> = {
  title: "Office document",
  loading: "Rendering document...",
  retry: "Retry",
  viewMissingFonts: "Missing fonts: {count}. Click to view.",
  missingFontsTitle: "Missing fonts",
  missingFontsDescription: "These fonts are unavailable for this preview. Text and layout may differ from the original document.",
  missingFontsCount: "Fonts: {count}",
  closeDetails: "Close font details",
  unavailable: "Office previews are unavailable. Enable the document preview service on the computer running Galaxy Blackhole.",
  invalid: "This Office file cannot be previewed. It may be damaged, password protected, or have the wrong extension.",
  tooLarge: "The Office file or converted PDF exceeds the preview size limit. Reduce the file size or adjust the preview configuration.",
  failed: "Office conversion did not produce a usable PDF. Check the file and try again.",
  timeout: "Office conversion timed out. Try again.",
  busy: "Office preview is busy. Try again shortly.",
  changed: "The file changed while being read. Reopen the preview.",
};

/** Namespace cua ban xem bang tinh — nguyen van ban goc. */
export const NS_EXCEL = "sidebarExcel";

/** Tu dien tieng Trung cua ban xem bang tinh. */
export const excelZh = {
  title: "表格",
  language: "zh",
  loading: "文档渲染中...",
  invalid: "无法打开此表格。请检查文件格式、内容或密码保护。",
  tooLarge: "此表格超过预览大小限制。",
  timeout: "打开表格超时。请缩小文件后重试。",
  encoding: "无法识别此文本文件的编码。请另存为 UTF-8 或带 BOM 的 UTF-16 后重试。",
  formulaWarning: "此工作簿包含公式，显示结果可能缺失或不准确。",
  unsupportedNotice: "当前预览不支持此工作簿中的{features}。请使用系统应用打开，以获得完整体验。",
  charts: "图表",
  images: "图片",
  shapes: "形状",
  conditionalFormatting: "条件格式",
  featureSeparator: "、",
  retry: "重试",
} as const;

/** Ban tieng Anh cua ban xem bang tinh. */
export const excelEn: Record<keyof typeof excelZh, string> = {
  title: "Spreadsheet",
  language: "en",
  loading: "Rendering document...",
  invalid: "This spreadsheet could not be opened. Check its format, contents, or password protection.",
  tooLarge: "This workbook exceeds the preview size limit.",
  timeout: "Opening this workbook timed out. Try a smaller file.",
  encoding: "This text encoding could not be read. Save the file as UTF-8 or UTF-16 with a BOM and retry.",
  formulaWarning: "This workbook contains formulas. Displayed results may be missing or inaccurate.",
  unsupportedNotice: "This preview does not support {features} in this workbook. Open it in a system application for the full experience.",
  charts: "charts",
  images: "images",
  shapes: "shapes",
  conditionalFormatting: "conditional formatting",
  featureSeparator: ", ",
  retry: "Retry",
};
