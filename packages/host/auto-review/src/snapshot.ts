/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đóng băng NĂM phần của một yêu cầu duyệt từ bề mặt phiên và lời gọi đang chờ, rồi kết xuất
 *      bốn phần dữ liệu (phần thứ năm là REVIEW_POLICY). Nguyên văn hành vi gói gốc (dòng 209–332).
 */

import { deepFreeze } from "./freeze.ts";
import { json } from "./json.ts";
import { nativeAction, ptcAction } from "./action.ts";
import {
  directParentInitialPromptSeq,
  filteredUserEntries,
  isProjectInstruction,
  sameStep,
  scopePtcStarts,
  scopedCallKey,
  stepIdentity,
} from "./history.ts";
import type {
  AutoReviewAgent,
  AutoReviewEvent,
  PendingExecution,
  PtcStart,
  ReviewAction,
  ReviewContentBlock,
  ReviewEntry,
  ReviewSnapshot,
  ToolCallBlock,
  ToolCallEvent,
} from "./types.ts";

/**
 * Đọc một khối như khối tool-call ĐÃ ĐÓNG.
 * Nhận: `block` — khối nội dung bất kỳ.
 * Trả: chính khối đó khi nhãn là `tool-call`, ngược lại `undefined`.
 */
export function toolCallBlock(block: ReviewContentBlock): ToolCallBlock | undefined {
  if (block.type !== "tool-call") return undefined;
  // Nhật ký đã đóng khối tool-call bảo đảm đủ `id` · `name` · `arguments`.
  return block as ToolCallBlock;
}

/**
 * Đóng băng năm phần của yêu cầu duyệt từ một phiên và một lời gọi đang chờ.
 * Nhận: `agent` — agent sở hữu bề mặt + header; `exec` — lời gọi đang chờ (bất biến);
 * `cwd` — thư mục làm việc hiện tại do seam `workingDirectory` trả.
 * Trả: ảnh chụp đã đóng băng sâu, hoặc ném khi nhật ký/bề mặt không khớp lời gọi đang chờ.
 */
export function snapshotAutoReview(agent: AutoReviewAgent, exec: PendingExecution, cwd: string): ReviewSnapshot {
  const { session } = agent;
  const events = session.snapshotEvents();
  const nodes = [...session.surface.nodes];
  const header = session.requestHeader();
  if (header === undefined || header.config.provider.length === 0 || header.config.model.length === 0) {
    throw new Error("auto-review: no complete request-header route is available");
  }
  const nativeCalls = events.filter((event): event is ToolCallEvent => event.type === "tool/call");
  const { starts, openStep: currentStep } = scopePtcStarts(events);
  const initialPromptSeq = directParentInitialPromptSeq(agent, events);
  const nativeByScopedId = new Map<string, ToolCallEvent[]>();
  for (const event of nativeCalls) {
    const key = scopedCallKey(stepIdentity(event.data), event.data.callId);
    const bucket = nativeByScopedId.get(key);
    if (bucket === undefined) nativeByScopedId.set(key, [event]);
    else bucket.push(event);
  }
  const startsByParent = new Map<string, PtcStart[]>();
  const startsBySubCall = new Map<string, PtcStart>();
  for (const start of starts) {
    const subCallKey = scopedCallKey(start.step, start.event.data.subCallId);
    if (startsBySubCall.has(subCallKey)) {
      throw new Error("auto-review: a PTC call identity is ambiguous in the session log");
    }
    startsBySubCall.set(subCallKey, start);
    const parentKey = scopedCallKey(start.step, start.event.data.parentCallId);
    const bucket = startsByParent.get(parentKey);
    if (bucket === undefined) startsByParent.set(parentKey, [start]);
    else bucket.push(start);
  }
  if (currentStep === undefined) throw new Error("auto-review: the pending call has no open step in the session log");
  const currentRootCalls = nativeByScopedId.get(scopedCallKey(currentStep, exec.rootCallId)) ?? [];
  const currentRootCall = currentRootCalls[0];
  if (currentRootCall === undefined || currentRootCalls.length !== 1) {
    throw new Error("auto-review: the pending root call is missing or ambiguous in the session log");
  }
  const currentPtcStart =
    exec.parent === undefined ? undefined : startsBySubCall.get(scopedCallKey(currentStep, exec.callId));
  if (exec.parent !== undefined && currentPtcStart === undefined) {
    throw new Error("auto-review: the pending PTC call is missing or ambiguous in the session log");
  }
  const projectInstructions: ReviewEntry[] = [];
  const history: ReviewEntry[] = [];
  const visibleParentKeys = new Set<string>();
  let passedCurrentRoot = false;
  for (const seq of nodes) {
    const event: AutoReviewEvent | undefined = events[seq];
    if (event === undefined) throw new Error("auto-review: the session surface refers to a missing event");
    if (event.type === "user/message") {
      if (event.data.source.kind === "tool") continue;
      if (isProjectInstruction(event.data.source)) {
        const content = event.data.content;
        if (content.length > 0) projectInstructions.push({ kind: "user-message", role: "constraint", source: event.data.source, content });
      } else {
        history.push(
          ...filteredUserEntries(
            event.seq,
            event.data.source,
            event.data.content,
            initialPromptSeq,
            session.header.parentSession,
          ),
        );
      }
      continue;
    }
    if (event.type !== "assistant/message") continue;
    const messageStep = stepIdentity(event.data);
    const isCurrentMessage = sameStep(messageStep, currentStep);
    let sawUnstartedSibling = false;
    for (const raw of event.data.message.content) {
      const block = toolCallBlock(raw);
      if (block === undefined) continue;
      const key = scopedCallKey(messageStep, block.id);
      const isCurrentRoot = isCurrentMessage && block.id === exec.rootCallId;
      if (isCurrentRoot && passedCurrentRoot) {
        throw new Error("auto-review: the pending root call is ambiguous in the current surface");
      }
      const calls = nativeByScopedId.get(key) ?? [];
      if (calls.length > 1) throw new Error("auto-review: a native call identity is ambiguous in the session log");
      const call = calls[0];
      const startsForCall = startsByParent.get(key) ?? [];
      if (call === undefined) {
        if (isCurrentMessage && !passedCurrentRoot) {
          throw new Error("auto-review: a visible call before the pending root is missing from the session log");
        }
        if (startsForCall.length > 0) throw new Error("auto-review: an unstarted visible call has logged PTC dispatches");
        sawUnstartedSibling = true;
        continue;
      }
      if (sawUnstartedSibling) throw new Error("auto-review: visible native call logs do not form a started prefix");
      if (call.data.name !== block.name || call.data.arguments !== block.arguments) {
        throw new Error("auto-review: a visible tool call disagrees with its logged action");
      }
      visibleParentKeys.add(key);
      if (call !== currentRootCall || exec.parent !== undefined) {
        history.push({
          kind: "tool-call",
          role: "fact",
          mode: "native",
          name: call.data.name,
          arguments: call.data.arguments,
        });
      }
      for (const start of startsForCall) {
        if (start === currentPtcStart) continue;
        history.push({
          kind: "tool-call",
          role: "fact",
          mode: "ptc-inner",
          name: start.event.data.name,
          arguments: json(start.event.data.arguments),
        });
      }
      if (isCurrentRoot) passedCurrentRoot = true;
    }
  }
  if (!passedCurrentRoot) throw new Error("auto-review: the pending root call is missing from the current surface");
  let action: ReviewAction;
  if (exec.parent === undefined) {
    action = nativeAction(exec, header.tools, currentRootCall);
  } else {
    // Nhánh này đã được chặn ở trên khi `currentPtcStart` vắng; kiểm lại để máy kiểu thấy điều đó.
    if (currentPtcStart === undefined) {
      throw new Error("auto-review: the pending PTC call is missing or ambiguous in the session log");
    }
    action = ptcAction(exec, currentPtcStart, visibleParentKeys);
  }
  return deepFreeze({
    provider: header.config.provider,
    model: header.config.model,
    cwd,
    projectInstructions,
    history,
    action,
  });
}

/**
 * Kết xuất bốn phần dữ liệu đi kèm phần chính sách cố định.
 * Nhận: `snapshot` — ảnh chụp đã đóng băng.
 * Trả: chuỗi bốn mục `ENVIRONMENT` · `PROJECT_INSTRUCTIONS` · `FILTERED_HISTORY` · `PENDING_ACTION`,
 * phân tách bằng một dòng trống.
 */
export function reviewUserText(snapshot: ReviewSnapshot): string {
  return [
    "ENVIRONMENT",
    json({ cwd: snapshot.cwd }),
    "PROJECT_INSTRUCTIONS",
    json(snapshot.projectInstructions),
    "FILTERED_HISTORY",
    json(snapshot.history),
    "PENDING_ACTION",
    json(snapshot.action),
  ].join("\n\n");
}
