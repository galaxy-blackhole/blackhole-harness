/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package goal: xuất ĐÚNG MƯỜI tên mà bản gốc xuất trên ARTIFACT
 *      (GOAL_CHANGE_VERSION · GoalError · GoalId · GoalService + default · applyGoalProjection ·
 *      decodeGoalChange · foldGoal · goalChangeRef · goalProjectionDefinition).
 */

export { GOAL_CHANGE_VERSION, GoalError, GoalId } from "./runtime.ts";
export { decodeGoalChange, foldGoal, goalChangeRef } from "./fold.ts";
export { applyGoalProjection, goalProjectionDefinition } from "./projection.ts";
export { GoalService, GoalService as default } from "./service.ts";
