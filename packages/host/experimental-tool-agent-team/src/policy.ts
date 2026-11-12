/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách TEAM_POLICY + hai hằng số của tool wait_agent của row tool-agent-team — NGUYÊN VĂN
 *      từ bundle gốc, để phần chữ model đọc được so được từng ký tự với bản gốc.
 */

/**
 * Ngữ cảnh cộng tác mà Lead và mọi teammate cùng đọc (khối prompt TEAM_POLICY).
 * Nhận: `interrupt` — có đăng ký tool `interrupt_agent` hay không; chữ chỉ đổi đúng MỘT cụm.
 * Trả: nguyên văn đoạn chính sách, đúng từng ký tự như bản gốc.
 */
export function teamPolicy(interrupt: boolean): string {
	return `Agent Teams is available in this session

The Team Lead and all teammates share the same working directory and filesystem. Edits are immediately visible to every member. Split write work into disjoint scopes, record expected write scopes on shared tasks, and use task dependencies when work must be ordered. Write-scope overlap is advisory, not a lock.

Prefer read/edit/write for file changes. If a file operation returns FS_STALE_VERSION, read the current file, rebase your intended change onto the new content, and retry. Bash, formatters, code generators, and scripts are not fully protected by the filesystem version guard; coordinate them explicitly and have the Lead review the final diff and run tests.

Use the target returned by spawn_teammate or list_agents for send_message${interrupt ? " and interrupt_agent" : ""}, or as owner when assigning or filtering shared tasks. send_message steers a running target at its nearest step boundary and starts or resumes an inactive target. inactive means no turn is executing; it does not describe task completion, success, failure, or waiting for other agents. provisioning means member creation is in progress; failed means member creation failed. A peer message starts with its sender name. A successful send does not mean the recipient has processed it. Shared-task workflow is list, get, claim with the current revision, perform the work, then complete. Task readiness never starts an owner. Before wait_agent, use list_agents and make sure another required member is running or provisioning; use send_message first when the required member is inactive. wait_agent observes only changes after that call starts, never wakes a member, and returns noProgress immediately when no other member can produce a change. Re-list after wakeup or timeout. The Lead must wait for required teammates before giving the final answer.`;
}

/** Hai trạng thái được coi là còn có thể tạo ra thay đổi — điều kiện của shortcut `noProgress` ở `wait_agent`. */
export const ACTIVE_WAIT_STATUSES: ReadonlySet<string> = new Set(["running", "provisioning"]);

/** Thân `noProgress` mà `wait_agent` trả NGAY khi không còn thành viên nào chạy hoặc đang được tạo. */
export const NO_ACTIVE_PEER_MESSAGE = "No other Team member is running or provisioning. wait_agent cannot make progress or wake inactive teammates. Re-list with list_agents and team_task_list, then use send_message to wake each required inactive teammate before waiting again.";
