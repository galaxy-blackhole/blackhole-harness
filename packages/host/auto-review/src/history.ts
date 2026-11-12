/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phân vai nguồn chỉ thị + dựng lịch sử đã lọc + gom lời gọi con PTC theo bước. Nguyên văn
 *      hành vi của gói gốc (lib/index.js dòng 90–179): vai do NGUỒN quyết định, không do nội dung.
 */

import type {
  AutoReviewAgent,
  AutoReviewEvent,
  MessageSourceLike,
  PtcStart,
  ReviewContentBlock,
  ReviewRole,
  ReviewUserEntry,
  StepIdentity,
} from "./types.ts";

/**
 * Message này có phải chỉ thị của NGƯỜI THẬT do Web gửi bền không.
 * Nhận: `source` — nguồn của message user-role.
 * Trả: `true` khi nguồn là `user` VÀ có `rpcId` (danh tính RPC bền của Web).
 */
export function isHumanInstruction(source: MessageSourceLike): boolean {
  return source.kind === "user" && typeof source.rpcId === "string";
}

/**
 * Nguồn này có phải chỉ thị dự án hiện hành không (AGENTS.md và tương tự).
 * Nhận: `source` — nguồn của message.
 * Trả: `true` khi nguồn là `agent-instructions`.
 */
export function isProjectInstruction(source: MessageSourceLike): boolean {
  return source.kind === "agent-instructions";
}

/**
 * Nguồn này có phải mốc nén ngữ cảnh không.
 * Nhận: `source` — nguồn của message.
 * Trả: `true` khi nguồn là `compact-checkpoint`.
 */
export function isCheckpoint(source: MessageSourceLike): boolean {
  return source.kind === "compact-checkpoint";
}

/**
 * Message này có được GÁN BỀN cho cha trực tiếp của agent con không.
 * Nhận: `source` — nguồn của message; `parentSession` — danh tính phiên cha (nếu có).
 * Trả: `true` khi nguồn là `agent-message` và người gửi CHÍNH LÀ phiên cha đó.
 */
export function isDirectParentInstruction(source: MessageSourceLike, parentSession: string | undefined): boolean {
  return parentSession !== undefined && source.kind === "agent-message" && source.senderSessionId === parentSession;
}

/**
 * Tìm danh tính (theo `seq`) của prompt TẠO agent con trong bề mặt hiển thị.
 * Nhận: `agent` — agent con (hoặc bất kỳ agent); `events` — toàn bộ nhật ký phiên.
 * Trả: `seq` của message user-role ĐẦU TIÊN sau mốc `subagent/descriptor` mà KHÔNG phải chỉ thị
 * người thật; `undefined` khi không phải agent con hoặc không có mốc đó.
 */
export function directParentInitialPromptSeq(agent: AutoReviewAgent, events: readonly AutoReviewEvent[]): number | undefined {
  const { session } = agent;
  if (session.header.origin !== "subagent" || session.header.parentSession === undefined) return undefined;
  let passedCreationBoundary = false;
  for (const event of events) {
    if (!session.isOwnSeq(event.seq)) continue;
    if (event.type === "subagent/descriptor") {
      passedCreationBoundary = true;
      continue;
    }
    if (passedCreationBoundary && event.type === "user/message" && event.data.source.kind === "user" && !isHumanInstruction(event.data.source)) {
      return event.seq;
    }
  }
  return undefined;
}

/**
 * Gán vai CỐ ĐỊNH cho một khối chữ được giữ lại.
 * Nhận: `source` — nguồn message; `seq` — vị trí message; `initialPromptSeq` — mốc prompt tạo con;
 * `parentSession` — phiên cha.
 * Trả: vai `human-instruction` · `direct-parent-instruction` · `checkpoint` hoặc `fact`.
 */
export function textRole(
  source: MessageSourceLike,
  seq: number,
  initialPromptSeq: number | undefined,
  parentSession: string | undefined,
): ReviewRole {
  if (isHumanInstruction(source)) return "human-instruction";
  if (seq === initialPromptSeq || isDirectParentInstruction(source, parentSession)) return "direct-parent-instruction";
  if (isCheckpoint(source)) return "checkpoint";
  return "fact";
}

/**
 * Chia một message user-role thành các mục đã gắn vai (mỗi khối một mục, giữ nguồn gốc).
 * Nhận: `seq` · `source` · `content` của message, và hai mốc vai.
 * Trả: mảng mục lịch sử; khối không phải chữ mang vai `fact`.
 */
export function filteredUserEntries(
  seq: number,
  source: MessageSourceLike,
  content: readonly ReviewContentBlock[],
  initialPromptSeq: number | undefined,
  parentSession: string | undefined,
): ReviewUserEntry[] {
  return content.map((block) => ({
    kind: "user-message",
    role: block.type === "text" ? textRole(source, seq, initialPromptSeq, parentSession) : "fact",
    source,
    content: [block],
  }));
}

/**
 * Sao chép danh tính (lượt, bước) mà một sự kiện thực thi lõi mang theo.
 * Nhận: `data` — thân sự kiện có `turn`/`step`.
 * Trả: vật thể MỚI chỉ gồm hai trường đó.
 */
export function stepIdentity(data: StepIdentity): StepIdentity {
  return { turn: data.turn, step: data.step };
}

/**
 * So hai danh tính lượt-bước.
 * Nhận: `left`, `right` — hai danh tính.
 * Trả: `true` khi cùng lượt VÀ cùng bước.
 */
export function sameStep(left: StepIdentity, right: StepIdentity): boolean {
  return left.turn === right.turn && left.step === right.step;
}

/**
 * Đặt khoá cho một danh tính lời gọi TRONG bước sở hữu vòng đời của nó.
 * Nhận: `step` — bước sở hữu; `callId` — danh tính lời gọi.
 * Trả: khoá chuỗi dùng NUL làm dấu phân cách (không đụng được vào id thật).
 */
export function scopedCallKey(step: StepIdentity, callId: string): string {
  return `${step.turn}\0${step.step}\0${callId}`;
}

/**
 * Gán mỗi lời gọi con PTC vào BƯỚC đang mở lúc nó được ghi.
 * Nhận: `events` — toàn bộ nhật ký phiên.
 * Trả: các lời gọi con đã gắn bước, và bước còn mở ở CUỐI nhật ký (nếu có).
 * Ném khi một lời gọi con PTC không có bước sở hữu — nhật ký hỏng, không đoán.
 */
export function scopePtcStarts(events: readonly AutoReviewEvent[]): {
  starts: PtcStart[];
  openStep: StepIdentity | undefined;
} {
  const starts: PtcStart[] = [];
  let openStep: StepIdentity | undefined;
  for (const event of events) {
    if (event.type === "turn/start" || event.type === "turn/end") {
      openStep = undefined;
      continue;
    }
    if (event.type === "step/start") {
      openStep = stepIdentity(event.data);
      continue;
    }
    if (event.type === "step/end") {
      openStep = undefined;
      continue;
    }
    if (event.type !== "tool/ptc-dispatch-start") continue;
    if (openStep === undefined) throw new Error("auto-review: a PTC call has no owning step in the session log");
    starts.push({ event, step: openStep });
  }
  return { starts, openStep };
}
