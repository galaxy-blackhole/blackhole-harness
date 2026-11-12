/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai tu dien cua row ui-permission: settings.permission (hang cai dat) va permission.access (phien hien tai)
 */

/** Khoa cua tu dien hang cai dat (ban goc lay zh lam nguon khoa). */
export type SettingsPermissionKey =
  | "title"
  | "description"
  | "loading"
  | "unavailable"
  | "preset.readOnly"
  | "preset.workspaceWrite"
  | "preset.fullAccess"
  | "confirm.title"
  | "confirm.description"
  | "confirm.acknowledge"
  | "confirm.cancel"
  | "confirm.enable";

/** Khoa cua tu dien phien hien tai (chip composer + popup /permission). */
export type PermissionAccessKey =
  | "mode"
  | "close"
  | "preset.readOnly"
  | "preset.workspaceWrite"
  | "preset.fullAccess"
  | "confirm.title"
  | "confirm.description"
  | "confirm.acknowledge"
  | "confirm.cancel"
  | "confirm.enable"
  | "auto.label"
  | "auto.badge"
  | "auto.description"
  | "auto.confirm.title"
  | "auto.confirm.description"
  | "auto.confirm.acknowledge"
  | "auto.confirm.enable";

/** Tu dien tieng Trung gian the (nguon khoa cua hang cai dat) — chep NGUYEN VAN tu ban goc. */
export const zh: Record<SettingsPermissionKey, string> = {
  title: "权限",
  description: "选择新会话的默认权限模式",
  loading: "加载中",
  unavailable: "不可用",
  "preset.readOnly": "仅可查看",
  "preset.workspaceWrite": "工作区内修改",
  "preset.fullAccess": "完全权限",
  "confirm.title": "确认启用完全权限？",
  "confirm.description":
    "启用完全权限后，新会话将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任后续任务时使用。",
  "confirm.acknowledge": "我已了解风险，并愿意继续",
  "confirm.cancel": "取消",
  "confirm.enable": "启用完全权限",
};

/** Tu dien tieng Anh cua hang cai dat — du 12 khoa nhu ban goc. */
export const en: Record<SettingsPermissionKey, string> = {
  title: "Permission",
  description: "Choose the default permission mode for new sessions",
  loading: "Loading",
  unavailable: "Unavailable",
  "preset.readOnly": "Read Only",
  "preset.workspaceWrite": "Workspace Write",
  "preset.fullAccess": "Full access",
  "confirm.title": "Enable Full access?",
  "confirm.description":
    "Full access lets new sessions reduce confirmation steps and perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust subsequent tasks.",
  "confirm.acknowledge": "I understand the risks and want to continue",
  "confirm.cancel": "Cancel",
  "confirm.enable": "Enable Full access",
};

/** Tu dien tieng Trung cua phien hien tai (co them khoi "auto" cua preset thi nghiem). */
export const accessZh: Record<PermissionAccessKey, string> = {
  mode: "访问模式，当前：{name}",
  close: "关闭",
  "preset.readOnly": "仅可查看",
  "preset.workspaceWrite": "工作区内修改",
  "preset.fullAccess": "完全权限",
  "confirm.title": "确认启用完全权限？",
  "confirm.description":
    "启用完全权限后，智能体将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。",
  "confirm.acknowledge": "我已了解风险，并愿意继续",
  "confirm.cancel": "取消",
  "confirm.enable": "启用完全权限",
  "auto.label": "自动审查",
  "auto.badge": "EXP",
  "auto.description": "无沙箱运行；每次原生工具调用和 PTC 内层调用前由同一模型进行实验性审查。",
  "auto.confirm.title": "确认启用自动审查（实验）？",
  "auto.confirm.description":
    "自动审查不使用沙箱。每次原生工具调用和 PTC 内层调用前，都会由与当前 agent 相同的模型进行审查；审查拒绝的调用由你批准或拒绝。此功能仍属实验性，可能误放行或误拒绝，并会消耗额外 token。",
  "auto.confirm.acknowledge": "我已了解这些风险，并愿意继续",
  "auto.confirm.enable": "启用自动审查",
};

/** Tu dien tieng Anh cua phien hien tai — du 17 khoa nhu ban goc. */
export const accessEn: Record<PermissionAccessKey, string> = {
  mode: "Access mode, current: {name}",
  close: "Close",
  "preset.readOnly": "Read Only",
  "preset.workspaceWrite": "Workspace Write",
  "preset.fullAccess": "Full access",
  "confirm.title": "Enable Full access?",
  "confirm.description":
    "Full access reduces confirmation steps and lets the agent perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust the current task.",
  "confirm.acknowledge": "I understand the risks and want to continue",
  "confirm.cancel": "Cancel",
  "confirm.enable": "Enable Full access",
  "auto.label": "Auto review",
  "auto.badge": "EXP",
  "auto.description": "Run without a sandbox after an experimental same-model review of every native tool call and PTC inner call.",
  "auto.confirm.title": "Enable Auto review (experimental)?",
  "auto.confirm.description":
    "Auto review runs without a sandbox. Before every native tool call and PTC inner call, the same model as the current agent reviews whether to allow it; you approve or reject each call it denies. This feature is experimental, can falsely allow or deny actions, and uses additional tokens.",
  "auto.confirm.acknowledge": "I understand these risks and want to continue",
  "auto.confirm.enable": "Enable Auto review",
};
