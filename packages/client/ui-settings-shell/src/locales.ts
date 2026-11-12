/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Từ điển của trang cài đặt shell executor (en/zh) + nhãn khung form dùng chung
 */

/** Khoá bản dịch của trang cài đặt shell executor. */
export type ShellSettingsLocaleKey =
  | "title"
  | "description"
  | "timeoutMs"
  | "timeoutMsHint"
  | "maxOutputBytes"
  | "maxOutputBytesHint"
  | "overridden"
  | "reset"
  | "readOnly"
  | "unavailable"
  | "save"
  | "saving"
  | "saveFailed"
  | "invalidNumber";

/** Nhãn khung form cài đặt dùng chung (khớp SettingsFormLabels của ui-primitives). */
export interface SettingsFormLabelsLike {
  /** Câu hiện khi Host chưa phục vụ namespace này. */
  unavailable: string;
  /** Câu hiện khi bản cài đặt ghi cấu hình ở chế độ chỉ đọc. */
  readOnly: string;
  /** Câu hiện khi Host từ chối giá trị vừa gửi. */
  saveFailed: string;
  /** Nhãn nút lưu. */
  save: string;
  /** Nhãn nút lưu khi đang gửi. */
  saving: string;
}

/** Bản tiếng Anh. */
export const en: Record<ShellSettingsLocaleKey, string> = {
  title: "Shell",
  description: "Limit how long each command may run and how much it may output.",
  timeoutMs: "Command timeout (ms)",
  timeoutMsHint: "How long one command may run before it is terminated.",
  maxOutputBytes: "Output cap per stream (bytes)",
  maxOutputBytesHint: "Output beyond this spills to a temporary file rather than being lost.",
  overridden: "Overridden",
  reset: "Reset to default",
  readOnly: "This deployment stores settings read-only.",
  unavailable: "This plugin is not loaded, so it cannot be configured right now.",
  save: "Save",
  saving: "Saving…",
  saveFailed: "The deployment did not accept these values; they were left for you to correct.",
  invalidNumber: "Enter a number, or leave blank to use the default.",
};

/** Bản tiếng Trung giản thể. */
export const zh: Record<ShellSettingsLocaleKey, string> = {
  title: "终端",
  description: "限制每条命令最多能跑多久、最多输出多少内容。",
  timeoutMs: "命令超时（毫秒）",
  timeoutMsHint: "单条命令允许运行多久，超时即终止。",
  maxOutputBytes: "单流输出上限（字节）",
  maxOutputBytesHint: "超出部分会转存到临时文件，而不是被丢弃。",
  overridden: "已覆盖",
  reset: "恢复默认",
  readOnly: "本部署的设置为只读。",
  unavailable: "该插件当前未加载，暂时无法配置。",
  save: "保存",
  saving: "保存中…",
  saveFailed: "本部署没有接受这些值，已保留供你修改。",
  invalidNumber: "请填数字；留空表示使用默认值。",
};

/**
 * Lấy nhãn khung form từ từ điển của trang này.
 * Nhận: hàm đọc từ điển t(key) do ctx.locale.bind(NS) cấp.
 * Trả: nhãn khung form (unavailable · readOnly · saveFailed · save · saving) để truyền cho SettingsForm.
 */
export function formLabels(t: (key: ShellSettingsLocaleKey) => string): SettingsFormLabelsLike {
  return {
    unavailable: t("unavailable"),
    readOnly: t("readOnly"),
    saveFailed: t("saveFailed"),
    save: t("save"),
    saving: t("saving"),
  };
}
