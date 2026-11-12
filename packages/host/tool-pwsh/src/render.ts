/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng `#region lib/types/render.js` của bundle gốc @deepseek-ai/dsh-tool-pwsh (dòng 128–213):
 *      render kết quả hướng model cho tool pwsh — stdout, mục stderr có dấu, marker từ chối sandbox
 *      (kèm gợi ý escalate cùng lượt), câu báo cắt kèm đường dẫn spill, rồi marker trạng thái thoát.
 *      Logic/chuỗi/thứ tự NGUYÊN VĂN; chỉ thêm kiểu.
 */

import { escalationHintMarker, sandboxDenialMarker } from "@deepseek-ai/dsh-sandbox";

import type { CollectedOutput, PwshForegroundResult, PwshPromotedResult, SandboxFacts } from "./types.ts";

/**
 * Nối câu báo cắt (kèm đường dẫn spill của toàn bộ đầu ra) vào chữ của một luồng.
 * Nhận: output — luồng đã thu (chữ + cờ cắt + đường dẫn spill).
 * Trả: chữ của luồng, thêm câu báo khi bị cắt.
 */
function streamText(output: CollectedOutput): string {
  if (!output.truncated) return output.text;
  return `${output.text}\n[output truncated; full output: ${output.spillPath ?? "(unavailable)"}]`;
}

/**
 * Đúc MỘT lần chạy đã xong thành chữ model thấy: stdout, rồi mục stderr có dấu, rồi marker trạng
 * thái thoát — đúng câu chuyện của tool bash: thoát sạch (0, không tín hiệu) không sinh marker nào.
 * Nhận: result — lần chạy tiền cảnh đã xong từ executor; escalationModes — đích escalate mà bố cục này quảng cáo.
 * Trả: chữ hướng model — thân đầu ra (hoặc `(no output)`), rồi mọi marker timeout/tín hiệu/mã thoát, mỗi cái một dòng.
 */
export function renderPwshResult(result: PwshForegroundResult, escalationModes: readonly string[] = []): string {
  const out = streamText(result.stdout);
  const err = streamText(result.stderr);
  let body = out;
  if (err.length > 0) {
    if (body.length > 0 && !body.endsWith("\n")) body += "\n";
    body += `[stderr]\n${err}`;
  }
  if (body.length === 0) body = "(no output)";
  const markers: string[] = [];
  if (result.sandbox?.denied) {
    markers.push(sandboxDenialMarker(result.sandbox.mode));
    if (escalationModes.length > 0) markers.push(escalationHintMarker("command"));
  }
  if (result.timedOut) markers.push(`[timed out after ${result.timeoutMs}ms]`);
  if (result.stopped !== void 0) markers.push(`[stopped: ${result.stopped}]`);
  if (result.signal !== null) markers.push(`[killed by signal: ${result.signal}]`);
  else if (result.exitCode !== 0) markers.push(`[exit code: ${result.exitCode}]`);
  if (markers.length === 0) return body;
  if (!body.endsWith("\n")) body += "\n";
  return body + markers.join("\n");
}

/**
 * Đúc một lời gọi tiền cảnh ĐÃ THÔI CHỜ thành chữ model thấy: đầu ra đã bắt được tới lúc đó (MỘT
 * lần đọc registry tiêu thụ, để `job_output` nối đúng sau nó), rồi marker còn chạy và hướng dẫn
 * bàn giao job.
 * Nhận: promoted — giá trị đã chuyển nền: id job, hạn chót đã hết và đầu ra tới lúc đó.
 * Trả: chữ hướng model cho một lời gọi đã chuyển nền.
 */
export function renderPwshPromoted(promoted: PwshPromotedResult): string {
  return `${promoted.output.length > 0 ? promoted.output.endsWith("\n") ? promoted.output : `${promoted.output}\n` : ""}[still running after ${promoted.timeoutMs}ms; moved to background job ${promoted.jobId}]\nThe command keeps running in the background. You will be notified when it finishes; read newer output with job_output, stop it with job_kill.`;
}

/**
 * Đúc MỘT lần đọc registry tiêu thụ mà lời gọi tiền cảnh nhúng vào kết quả khi thôi chờ: đầu ra
 * đã sinh tới lúc đó, cộng câu báo mất đầu ra (nêu tệp spill của job) khi con trỏ model tụt sau
 * vòng ring, và ghi chú sandbox.
 * Nhận: delta — các mẩu của lần đọc đã render thành chữ; lossy — có byte bị đẩy khỏi ring trước khi đọc; spillPaths — tệp toàn luồng job đang quảng cáo; sandbox — sự kiện sandbox đã chốt (undefined khi không bị giam); escalationModes — đích escalate mà bố cục này quảng cáo.
 * Trả: chữ delta kèm mọi câu báo mất dữ liệu / sandbox được nối sau.
 */
export function renderPwshJobRead(
  delta: string,
  lossy: boolean,
  spillPaths: readonly string[],
  sandbox: SandboxFacts | undefined,
  escalationModes: readonly string[] = [],
): string {
  const notices: string[] = [];
  if (lossy) notices.push(`[some output was dropped from memory; full output: ${spillPaths.length > 0 ? spillPaths.join(", ") : "(unavailable)"}]`);
  if (sandbox?.runnerFailed) notices.push(`[sandbox: the sandbox runner itself failed under ${sandbox.mode} mode — the command did not run; this is a sandbox problem, not a command failure]`);
  else if (sandbox?.denied) {
    notices.push(sandboxDenialMarker(sandbox.mode));
    if (escalationModes.length > 0) notices.push(escalationHintMarker("command"));
  }
  if (notices.length === 0) return delta;
  return `${delta}${delta.length > 0 && !delta.endsWith("\n") ? "\n" : ""}${notices.join("\n")}`;
}
