/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc So CSS cua row: id the style va ten define ma build.ts nhung vao bundle
 */

/** Hau to ten define: __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_<KEY>__. */
export const CSS_DEFINE_PREFIX = "__GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_";

/** Anh xa khoa CSS -> id the style nguyen van cua ban goc. */
export const CSS_TAGS = {
  LoadingIndicator: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/LoadingIndicator.module.css",
  TextPreview: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/TextPreview.module.css",
  MarkdownBody: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/MarkdownBody.module.css",
  HtmlBody: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/HtmlBody.module.css",
  ZoomControls: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/ZoomControls.module.css",
  ZoomViewport: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/ZoomViewport.module.css",
  ImageBody: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/ImageBody.module.css",
  CodeBody: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/CodeBody.module.css",
  OfficeBody: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/OfficeBody.module.css",
  FontNotice: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/FontNotice.module.css",
} as const;
