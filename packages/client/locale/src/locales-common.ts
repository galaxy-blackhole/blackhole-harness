/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace \`common\` (35 khoa × zh/en) — chu chuan dung chung moi tinh nang
 */

/** Khoá của từ điển `common`. */
export type CommonKey =
  | "ok" | "cancel" | "close" | "copy" | "copied"
  | "codeBlock.title" | "codeBlock.wrap" | "codeBlock.unwrap"
  | "copy.failed" | "copy.value" | "copy.json" | "copy.path" | "copy.prettyJson" | "copy.compactJson" | "copy.optionsHint"
  | "retry" | "loading" | "load.failed" | "submit" | "submitting" | "next" | "previous" | "skip"
  | "delete" | "edit" | "save" | "search" | "more" | "collapse" | "expand" | "back"
  | "brand.localBuild" | "workspace.defaultName" | "unknown" | "none" | "truncated" | "json.label"
  | "markdown.footnotes" | "markdown.truncatedCharacters" | "number.thousand" | "number.million";

/** Bản tiếng Trung giản thể (nguồn của tập khoá; `{...}` là chỗ điền tham số). */
export const zh: Record<CommonKey, string> = {
  ok: "确定",
  cancel: "取消",
  close: "关闭",
  copy: "复制",
  copied: "复制成功",
  "codeBlock.title": "代码块",
  "codeBlock.wrap": "自动换行",
  "codeBlock.unwrap": "取消自动换行",
  "copy.failed": "复制失败",
  "copy.value": "复制值",
  "copy.json": "复制 JSON",
  "copy.path": "复制属性路径",
  "copy.prettyJson": "复制格式化 JSON",
  "copy.compactJson": "复制紧凑 JSON",
  "copy.optionsHint": "{action}；右键点击可选择复制方式",
  retry: "重试",
  loading: "加载中…",
  "load.failed": "加载失败",
  submit: "提交",
  submitting: "正在提交…",
  next: "下一步",
  previous: "上一步",
  skip: "跳过",
  delete: "删除",
  edit: "编辑",
  save: "保存",
  search: "搜索",
  more: "更多",
  collapse: "收起",
  expand: "展开",
  back: "返回",
  "brand.localBuild": "DSH 本地构建",
  "workspace.defaultName": "默认工作区",
  unknown: "未知",
  none: "无",
  truncated: "已截断",
  "json.label": "JSON",
  "markdown.footnotes": "脚注",
  "markdown.truncatedCharacters": "… 已截断，共 {total} 字符",
  "number.thousand": "{value}K",
  "number.million": "{value}M",
};

/** Bản tiếng Anh (đã đối chiếu đủ khoá với bản zh). */
export const en: Record<CommonKey, string> = {
  ok: "OK",
  cancel: "Cancel",
  close: "Close",
  copy: "Copy",
  copied: "Copied",
  "codeBlock.title": "Code block",
  "codeBlock.wrap": "Wrap lines",
  "codeBlock.unwrap": "Do not wrap lines",
  "copy.failed": "Copy failed",
  "copy.value": "Copy value",
  "copy.json": "Copy JSON",
  "copy.path": "Copy property path",
  "copy.prettyJson": "Copy pretty JSON",
  "copy.compactJson": "Copy compact JSON",
  "copy.optionsHint": "{action}; right-click for copy options",
  retry: "Retry",
  loading: "Loading…",
  "load.failed": "Failed to load",
  submit: "Submit",
  submitting: "Submitting…",
  next: "Next",
  previous: "Previous",
  skip: "Skip",
  delete: "Delete",
  edit: "Edit",
  save: "Save",
  search: "Search",
  more: "More",
  collapse: "Collapse",
  expand: "Expand",
  back: "Back",
  "brand.localBuild": "DSH Local Build",
  "workspace.defaultName": "Default workspace",
  unknown: "Unknown",
  none: "None",
  truncated: "Truncated",
  "json.label": "JSON",
  "markdown.footnotes": "Footnotes",
  "markdown.truncatedCharacters": "… truncated at {total} characters",
  "number.thousand": "{value}K",
  "number.million": "{value}M",
};
