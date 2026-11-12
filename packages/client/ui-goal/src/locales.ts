/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace `goal` (en/zh) — chuoi giu NGUYEN nhu ban goc de ma tran anh A/B khong lech
 */

/** Từ điển tiếng Trung — cũng là NGUỒN SỰ THẬT của tập khoá (bản gốc làm y vậy). */
export const zh = {
  "phase.active": "进行中的目标",
  "phase.active.disarmed": "已暂停的目标",
  "phase.paused": "已暂停的目标",
  "phase.blocked": "受阻的目标",
  "objective.aria": "目标内容",
  "commandInput.aria": "指令输入",
  "action.save": "保存目标",
  "action.cancel": "取消编辑",
  "action.pause": "暂停目标",
  "action.resume": "恢复目标",
  "action.edit": "编辑目标",
  "action.clear": "清除目标",
};

/** Tập khoá copy của namespace `goal`. */
export type GoalKey = keyof typeof zh;

/** Từ điển tiếng Anh — bắt buộc đủ và đúng tập khoá của {@link zh}. */
export const en: Record<GoalKey, string> = {
  "phase.active": "Ongoing Goal",
  "phase.active.disarmed": "Inactive Goal",
  "phase.paused": "Paused Goal",
  "phase.blocked": "Blocked Goal",
  "objective.aria": "Goal objective",
  "commandInput.aria": "Command input",
  "action.save": "Save goal",
  "action.cancel": "Cancel edit",
  "action.pause": "Pause goal",
  "action.resume": "Resume goal",
  "action.edit": "Edit goal",
  "action.clear": "Clear goal",
};
