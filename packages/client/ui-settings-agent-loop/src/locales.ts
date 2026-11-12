/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien en/zh cua trang Agent loop — giu NGUYEN chuoi cua ban goc de ma tran anh A/B khong lech
 */

/** Namespace từ điển do package này sở hữu. */
export const NS = "settings.agentLoop";

/** Các khoá copy mà trang này render. */
export type LocaleKey =
  | "title"
  | "description"
  | "maxParallel"
  | "maxParallelHint"
  | "overridden"
  | "reset"
  | "readOnly"
  | "unavailable"
  | "save"
  | "saving"
  | "saveFailed"
  | "invalidNumber";

/**
 * Copy tiếng Anh. Chuỗi ở đây là DỮ LIỆU đối chiếu, không phải logic: trang phải hiện đúng từng ký tự
 * như bản gốc, nếu không ma trận ảnh A/B sẽ lệch dù hành vi đúng.
 */
export const en: Record<LocaleKey, string> = {
  title: "Agent loop",
  description: "Control how the Agent dispatches tool calls.",
  maxParallel: "Parallel tool calls",
  maxParallelHint: "Upper bound on parallel-safe calls running at once within one step.",
  overridden: "Overridden",
  reset: "Reset to default",
  readOnly: "This deployment stores settings read-only.",
  unavailable: "This plugin is not loaded, so it cannot be configured right now.",
  save: "Save",
  saving: "Saving…",
  saveFailed: "The deployment did not accept these values; they were left for you to correct.",
  invalidNumber: "Enter a number, or leave blank to use the default.",
};

/** Copy tiếng Trung giản thể — cùng lý do dữ liệu như {@link en}. */
export const zh: Record<LocaleKey, string> = {
  title: "Agent 循环",
  description: "控制 Agent 派发工具调用的方式。",
  maxParallel: "并行工具调用数",
  maxParallelHint: "同一步内最多同时运行多少个可并行的调用。",
  overridden: "已覆盖",
  reset: "恢复默认",
  readOnly: "本部署的设置为只读。",
  unavailable: "该插件当前未加载，暂时无法配置。",
  save: "保存",
  saving: "保存中…",
  saveFailed: "本部署没有接受这些值，已保留供你修改。",
  invalidNumber: "请填数字；留空表示使用默认值。",
};

/** Nhãn mà khung form dùng chung của ui-primitives đọc từ từ điển của trang này. */
export interface FormLabels {
  /** Câu hiện khi Host không phục vụ namespace. */
  unavailable: string;
  /** Câu hiện khi deployment lưu cấu hình ở chế độ chỉ đọc. */
  readOnly: string;
  /** Câu hiện khi lần lưu bị từ chối. */
  saveFailed: string;
  /** Nhãn nút lưu. */
  save: string;
  /** Nhãn nút lưu khi đang gửi. */
  saving: string;
}

/**
 * Đọc copy của khung form từ từ điển của trang.
 * Nhận: hàm đọc từ điển theo khoá của trang.
 * Trả: bộ nhãn mà `SettingsForm` render.
 */
export function formLabels(t: (key: LocaleKey) => string): FormLabels {
  return {
    unavailable: t("unavailable"),
    readOnly: t("readOnly"),
    saveFailed: t("saveFailed"),
    save: t("save"),
    saving: t("saving"),
  };
}
