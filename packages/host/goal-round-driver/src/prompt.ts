/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Câu lệnh tiếp tục MỘT vòng goal mà model nhìn thấy — bản viết lại của
 *      @deepseek-ai/dsh-goal-round-driver, nguyên văn từng ký tự (nguồn đối chiếu ở README.md của gói, G4).
 */

import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { GoalView } from "@galaxy-blackhole/gbh-goal";

/**
 * Dựng câu lệnh vòng goal đầy đủ, được giữ NGUYÊN trong lịch sử phiên.
 * Nhận: `goal` — đúng bản goal đang hoạt động được nhận vào; `round` — số vòng kế tiếp (số dương).
 * Trả: mảng MỚI đúng một khối chữ để đưa cho `Agent.followup()`; mỗi lượt gọi tạo vật thể mới
 *      nên sửa bản này không lan sang lượt khác.
 */
export function renderGoalRoundPrompt(goal: GoalView, round: number): ContentBlock[] {
  return [
    {
      type: "text",
      text: `<goal_round>
Objective: ${JSON.stringify(goal.objective)}\nRound: ${round}/${goal.maxGoalRounds}\n\nContinue working toward the objective in this same session. Treat the current workspace, tool results, and durable session state as authoritative; inspect them instead of assuming earlier narration is still current. Make concrete progress and verify the result. Before claiming completion, gather evidence that the whole objective is achieved, read the current goal, and mark it complete. If work remains, leave the goal active for the next round. Follow the configured goal-tool policy before reporting a blocker.
</goal_round>`,
    },
  ];
}
