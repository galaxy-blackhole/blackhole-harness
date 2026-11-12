/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Kiểu công khai của row agent-team — port 1:1 lib/types/types.d.ts: danh tính có brand, snapshot bền,
 *      khung nhìn dây, nguồn tin nhắn và yêu cầu/kết quả dịch vụ. Hai augmentation của bản gốc được thay bằng
 *      kiểu CẤU TRÚC (luật 000d): TeamMessageSource giữ nguyên hình dạng; bảng sự kiện Team khai ở
 *      TeamSessionEventMap; projection dùng TeamProjection không augment SessionProjectionMap.
 */
import type { Branded } from "@deepseek-ai/dsh-brand";
import type { MessageId } from "@deepseek-ai/dsh-llm/brand";
import type { ContentBlock } from "@deepseek-ai/dsh-llm/types";
import type { SessionId } from "@deepseek-ai/dsh-session/types";

/** Danh tính Team ngầm định gốc từ một Session cấp cao nhất. */
export type TeamId = Branded<"TeamId">;
/**
 * Đóng dấu danh tính Session gốc thành danh tính Team.
 * Nhận: id — danh tính Session gốc. Trả: cùng chuỗi đã brand.
 */
export function TeamId(id: SessionId | string): TeamId { return id as unknown as TeamId; }
/** Danh tính ổn định của một task trong Team. */
export type TeamTaskId = Branded<"TeamTaskId">;
/**
 * Đóng dấu một id task đã kiểm.
 * Nhận: id — danh tính task trong Team. Trả: cùng chuỗi đã brand.
 */
export function TeamTaskId(id: string): TeamTaskId { return id as unknown as TeamTaskId; }
/** Danh tính ổn định của một tin nhắn bền giữa thành viên. */
export type TeamMessageId = Branded<"TeamMessageId">;
/**
 * Đóng dấu một id tin nhắn đã sinh.
 * Nhận: id — danh tính tin trong hộp thư bền. Trả: cùng chuỗi đã brand.
 */
export function TeamMessageId(id: string): TeamMessageId { return id as unknown as TeamMessageId; }

/** Vòng đời bền của một teammate. */
export type TeamMemberPhase = "provisioning" | "active" | "failed";

/** Toàn bộ giá trị bền ghi mỗi lần vòng đời teammate đổi. */
export interface TeamMemberSnapshot {
  /** Danh tính phiên của thành viên. */
  readonly id: SessionId;
  /** Tên teammate. */
  readonly name: string;
  /** Mô tả do Lead đặt. */
  readonly description: string;
  /** Provider LLM. */
  readonly provider: string;
  /** Ngữ cảnh spawn. */
  readonly context: "fresh" | "fork";
  /** Pha sống. */
  readonly phase: TeamMemberPhase;
  /** Câu lỗi khi pha failed. */
  readonly error?: string;
}

/** Một dòng roster đã làm giàu runtime. */
export interface TeamMemberView {
  /** Danh tính phiên. */
  readonly id: SessionId;
  /** Tên hiển thị. */
  readonly name: string;
  /** Vai trò trong Team. */
  readonly role: "lead" | "teammate";
  /** Trạng thái sống. */
  readonly status: "running" | "inactive" | "provisioning" | "failed";
  /** Mô tả (teammate). */
  readonly description?: string;
  /** Provider (teammate). */
  readonly provider?: string;
  /** Ngữ cảnh spawn (teammate). */
  readonly context?: "fresh" | "fork";
  /** Model đang dùng. */
  readonly model?: string;
  /** Chẩn đoán provision. */
  readonly diagnostics: string[];
}

/** Vòng đời bền của một task. */
export type TeamTaskStatus = "pending" | "in_progress" | "completed" | "deleted";

/** Toàn bộ snapshot bền của một task; mỗi thay đổi tăng revision. */
export interface TeamTaskSnapshot {
  /** Danh tính task. */
  readonly id: TeamTaskId;
  /** Revision snapshot. */
  readonly revision: number;
  /** Tiêu đề ngắn. */
  readonly subject: string;
  /** Mô tả đầy đủ. */
  readonly description: string;
  /** Trạng thái. */
  readonly status: TeamTaskStatus;
  /** Thành viên sở hữu. */
  readonly ownerId?: SessionId;
  /** Task chặn. */
  readonly blockedBy: TeamTaskId[];
  /** Vùng ghi advisory. */
  readonly writeScopes: string[];
}

/** Alias snapshot task dùng bởi task-graph/task-view. */
export type TeamTask = TeamTaskSnapshot;

/** Task view đã làm giàu runtime trả cho tool và host. */
export interface TeamTaskView {
  /** Danh tính task. */
  readonly id: TeamTaskId;
  /** Revision nguồn. */
  readonly revision: number;
  /** Tiêu đề. */
  readonly subject: string;
  /** Mô tả. */
  readonly description: string;
  /** Trạng thái. */
  readonly status: TeamTaskStatus;
  /** Task chặn. */
  readonly blockedBy: TeamTaskId[];
  /** Vùng ghi advisory. */
  readonly writeScopes: string[];
  /** Tên thành viên sở hữu. */
  readonly ownerName?: string;
  /** Đã sẵn sàng nhận việc. */
  readonly ready: boolean;
  /** Cảnh báo chồng lấn vùng ghi. */
  readonly writeScopeWarnings: string[];
}

/** Một dòng roster bền công bố qua projection agentTeam của Session. */
export interface TeamMemberProjection {
  /** Danh tính phiên. */
  readonly id: SessionId;
  /** Tên hiển thị. */
  readonly name: string;
  /** Vai trò. */
  readonly role: "lead" | "teammate";
  /** Vòng đời bền; dòng Lead luôn active. */
  readonly phase: TeamMemberPhase;
  /** Câu lỗi nếu hỏng. */
  readonly error?: string;
}

/** Trạng thái Team bền công bố cho client qua projection agentTeam của Session Lead. */
export interface TeamProjection {
  /** Roster bền. */
  readonly members: TeamMemberProjection[];
  /** Bảng việc chưa xoá. */
  readonly tasks: TeamTaskView[];
  /** Lỗi chiếu đầu tiên (nếu có). */
  readonly failure?: string;
}

/** Một tin nhắn bền do hộp thư Team lịch sử ghi. */
export interface TeamMessageSnapshot {
  /** Danh tính tin. */
  readonly id: TeamMessageId;
  /** Danh tính người gửi. */
  readonly senderId: SessionId;
  /** Tên người gửi. */
  readonly senderName: string;
  /** Danh tính người nhận. */
  readonly targetId: SessionId;
  /** Nội dung. */
  readonly content: ContentBlock[];
}

/** Nguồn mà Session đích ghi cho một lượt giao tin nhắn Team lịch sử. */
export interface TeamMessageSource {
  /** Phân biệt nguồn. */
  readonly kind: "team-message";
  /** Danh tính Team. */
  readonly teamId: TeamId;
  /** Danh tính tin. */
  readonly messageId: TeamMessageId;
  /** Danh tính người gửi. */
  readonly senderId: SessionId;
  /** Tên người gửi. */
  readonly senderName: string;
}

/** Giới hạn triển khai của dịch vụ Team. */
export interface Config {
  /** Trần số tên teammate bền giữ bởi một Team. */
  readonly maxMembers?: number;
  /** Trần số task chưa xoá giữ bởi một Team. */
  readonly maxTasks?: number;
  /** Trần số byte UTF-8 trong một lượt giao đã đóng khung người gửi. */
  readonly maxMessageBytes?: number;
  /** Hạn chờ (ms) cho kết toán thao tác chia sẻ và cho mỗi lượt drain con của Team. */
  readonly disposalTimeoutMs?: number;
}

/** Đầu vào tạo một teammate bền. */
export interface SpawnTeammateRequest {
  /** Tên teammate. */
  readonly name: string;
  /** Mô tả. */
  readonly description: string;
  /** Prompt đầu tiên. */
  readonly prompt: ContentBlock[];
  /** Ngữ cảnh spawn. */
  readonly context: "fresh" | "fork";
  /** Provider LLM. */
  readonly provider: string;
  /** Huỷ của người gọi. */
  readonly signal: AbortSignal;
}

/** Kết quả sau khi một teammate đạt cạnh active hoặc failed bền. */
export interface SpawnTeammateResult {
  /** Dòng roster đã tạo. */
  readonly member: TeamMemberView;
}

/**
 * Đầu vào một lượt NẠP LẠI teammate (API BỔ SUNG của GBH — bản gốc KHÔNG có): xoá bộ nhớ hội thoại của
 * một teammate đang `active` rồi dựng lại continuation trên cùng id phiên.
 */
export interface ResetTeammateRequest {
  /** Tên bền vững của teammate cần nạp lại. */
  readonly target: string;
  /** Prompt đầu tiên của lượt nạp lại; bỏ trống thì dùng mô tả của chính teammate. */
  readonly prompt?: ContentBlock[];
  /** Huỷ của người gọi. */
  readonly signal: AbortSignal;
}

/** Kết quả một lượt nạp lại: dòng roster của teammate sau khi bộ nhớ đã bị xoá. */
export interface ResetTeammateResult {
  /** Dòng roster (giữ nguyên tên · mô tả · provider · id phiên). */
  readonly member: TeamMemberView;
}

/** Đầu vào một lượt nhắn trực tiếp giữa thành viên. */
export interface SendTeamMessageRequest {
  /** Danh tính người nhận (chuỗi). */
  readonly target: string;
  /** Nội dung. */
  readonly content: ContentBlock[];
  /** Huỷ của người gọi. */
  readonly signal: AbortSignal;
}

/** Kết quả nhận vào hộp thư đích dưới persistence Agent thường. */
export interface SendTeamMessageResult {
  /** Danh tính tin đã nhận. */
  readonly messageId: MessageId;
}

/** Đầu vào tạo một task chia sẻ. */
export interface CreateTeamTaskRequest {
  /** Tiêu đề. */
  readonly subject: string;
  /** Mô tả. */
  readonly description: string;
  /** Task chặn. */
  readonly blockedBy?: readonly TeamTaskId[];
  /** Vùng ghi advisory. */
  readonly writeScopes?: readonly string[];
}

/** Các hành động sửa task được hỗ trợ. */
export type TeamTaskAction = "claim" | "release" | "edit" | "set_dependencies" | "complete" | "reopen" | "reassign" | "delete";

/** Thay đổi compare-and-set của một task chia sẻ. */
export interface UpdateTeamTaskRequest {
  /** Danh tính task. */
  readonly taskId: TeamTaskId;
  /** Revision kỳ vọng. */
  readonly expectedRevision: number;
  /** Hành động. */
  readonly action: TeamTaskAction;
  /** Tiêu đề mới. */
  readonly subject?: string;
  /** Mô tả mới. */
  readonly description?: string;
  /** Task chặn mới. */
  readonly blockedBy?: readonly TeamTaskId[];
  /** Vùng ghi mới. */
  readonly writeScopes?: readonly string[];
  /** Chủ mới. */
  readonly owner?: string;
}

/** Yêu cầu đổi trần triển khai của MỘT Team; bỏ trống một trường nghĩa là giữ nguyên trần đó. */
export interface SetTeamLimitsRequest {
  /** Trần mới cho số teammate bền của Team (tối thiểu bằng số thành viên hiện có). */
  readonly maxMembers?: number;
  /** Trần mới cho số task chưa xoá của Team (tối thiểu bằng số task hiện có). */
  readonly maxTasks?: number;
}

/** Trần triển khai ĐANG có hiệu lực của MỘT Team sau một lượt đổi. */
export interface TeamLimitsView {
  /** Trần số teammate bền đang áp. */
  readonly maxMembers: number;
  /** Trần số task chưa xoá đang áp. */
  readonly maxTasks: number;
}

/** Kết quả chờ hoạt động Team. */
export interface TeamWaitResult {
  /** Có thay đổi hay hết hạn. */
  readonly timedOut: boolean;
}

/** Bảng sự kiện Team ghi vào log Session Lead (thay augmentation SessionEventMap của bản gốc). */
export interface TeamSessionEventMap {
  /** Toàn bộ giá trị vòng đời teammate, chỉ lưu trong Session Lead. */
  readonly "team/member": { readonly version: 2; readonly teamId: TeamId; readonly member: TeamMemberSnapshot };
  /** Toàn bộ giá trị task chia sẻ, chỉ lưu trong Session Lead. */
  readonly "team/task": { readonly version: 2; readonly teamId: TeamId; readonly task: TeamTaskSnapshot };
  /** Lượt xếp hàng hộp thư lịch sử. */
  readonly "team/message/queued": { readonly version: 2; readonly teamId: TeamId; readonly message: TeamMessageSnapshot };
  /** Xác nhận lịch sử rằng Session đích đã ghi một tin đã xếp hàng. */
  readonly "team/message/delivered": { readonly version: 2; readonly teamId: TeamId; readonly messageId: TeamMessageId; readonly targetId: SessionId };
}