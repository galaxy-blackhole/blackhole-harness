/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng `#region lib/types/background.js` của bundle gốc @deepseek-ai/dsh-tool-pwsh (dòng 7–127):
 *      adapt tiến trình pwsh thành job chung — kết cục terminal, nguồn pull hai luồng, ghép vòng ring,
 *      hook job (cancel + done). Logic/chuỗi/thứ tự NGUYÊN VĂN; chỉ thêm kiểu.
 */

import { escalationHintMarker, sandboxDenialMarker } from "@deepseek-ai/dsh-sandbox";

import type { JobChunk, JobHooks, JobOutcome, JobOutputSource, ProcessHandle, SandboxFacts } from "./types.ts";

/**
 * Ghi chú sandbox đáng vào detail terminal: runner chưa từng chạy lệnh, hoặc một lần từ chối
 * (kèm gợi ý escalate mà bố cục này quảng cáo).
 * Nhận: sandbox — sự kiện sandbox đã chốt (undefined khi lần chạy không bị giam); escalationModes — đích escalate.
 * Trả: mảng marker cần nối, cũ nhất trước.
 */
export function sandboxNotes(sandbox: SandboxFacts | undefined, escalationModes: readonly string[]): string[] {
  if (sandbox?.runnerFailed) return [`[sandbox: the sandbox runner itself failed under ${sandbox.mode} mode — the command did not run; this is a sandbox problem, not a command failure]`];
  if (sandbox?.denied) {
    const notes = [sandboxDenialMarker(sandbox.mode)];
    if (escalationModes.length > 0) notes.push(escalationHintMarker("command"));
    return notes;
  }
  return [];
}

/**
 * Ánh xạ một tiến trình nền đã chốt sang từ vựng kết cục job chung: `killed` giữ `killed`
 * (detail: tín hiệu khi biết), mọi thứ khác là `completed` với mã thoát làm detail. Mã thoát
 * khác 0 được BÁO, không bị coi là lỗi — đúng như cách render tiền cảnh.
 * Nhận: proc — handle tiến trình đã chốt; escalationModes — đích escalate mà bố cục này quảng cáo.
 * Trả: kết cục để đăng ký với `ctx.jobs`.
 */
export function processOutcome(proc: ProcessHandle, escalationModes: readonly string[] = []): JobOutcome {
  const base = proc.status === "killed" ? {
    status: "killed" as const,
    detail: proc.signal !== null ? `signal: ${proc.signal}` : "killed before exit"
  } : {
    status: "completed" as const,
    detail: `exit code: ${proc.exitCode ?? 0}`
  };
  const notes = sandboxNotes(proc.sandbox, escalationModes);
  return notes.length === 0 ? base : {
    ...base,
    detail: `${base.detail}; ${notes.join(" ")}`
  };
}

/**
 * Hai đầu đọc luồng KHÔNG tiêu thụ của tiến trình, nhìn như nguồn pull của registry. Chúng
 * buộc trễ vì tiến trình được spawn BÊN TRONG starter, sau khi registry nhận job; đọc trước khi
 * spawn thì không có gì, và bơm giữ nguyên con trỏ tiêu thụ của model.
 * Nhận: proc — hàm trả luồng đã quan sát của tiến trình, undefined trước khi spawn.
 * Trả: một nguồn mỗi luồng, stdout trước.
 */
export function processSources(proc: () => ProcessHandle | undefined): JobOutputSource[] {
  const source = (channel: "stdout" | "stderr"): JobOutputSource => ({
    channel,
    read: (fromByte: number) => {
      const live = proc();
      return live === void 0 ? {
        text: "",
        nextOffset: fromByte,
        lossy: false
      } : live.observed[channel].readFrom(fromByte);
    }
  });
  return [source("stdout"), source("stderr")];
}

/**
 * Các mẩu ring của MỘT lần đọc registry tiêu thụ, nhìn như cách tool shell render một lần đọc
 * tiến trình: mẩu stdout theo thứ tự, rồi mọi mẩu stderr trong MỘT mục `[stderr]`.
 * Nhận: chunks — các mẩu kể từ con trỏ model, theo thứ tự offset.
 * Trả: chữ delta, có thể rỗng.
 */
export function ringDelta(chunks: readonly JobChunk[]): string {
  const out = chunks.filter((chunk) => chunk.channel !== "stderr").map((chunk) => chunk.text).join("");
  const err = chunks.filter((chunk) => chunk.channel === "stderr").map((chunk) => chunk.text).join("");
  const separator = out.length > 0 && !out.endsWith("\n") ? "\n" : "";
  return out + (err.length > 0 ? `${separator}[stderr]\n${err}` : "");
}

/**
 * Adapt chuẩn bị shell BẤT ĐỒNG BỘ sau khi job đã được nhận, không để lộ tiến trình dở dang.
 * Nhận: start — spawn tiến trình dưới tín hiệu huỷ do job sở hữu; outcome — chiếu tiến trình đã chốt thành kết cục job.
 * Trả: hook job ĐỒNG BỘ mà `done` bao gồm cả chuẩn bị lẫn chốt tiến trình.
 */
export function processJob(start: (signal: AbortSignal) => Promise<ProcessHandle>, outcome: (proc: ProcessHandle) => JobOutcome): JobHooks {
  const controller = new AbortController();
  let process: ProcessHandle | undefined;
  return {
    cancel: (reason: string) => {
      if (controller.signal.aborted) return;
      controller.abort(reason);
      process?.kill();
    },
    done: (async () => {
      try {
        process = await start(controller.signal);
        try {
          if (controller.signal.aborted) process.kill();
        } finally {
          await process.done;
        }
        return outcome(process);
      } catch (error) {
        return {
          status: controller.signal.aborted && process === void 0 ? "killed" as const : "failed" as const,
          detail: error instanceof Error ? error.message : String(error)
        };
      }
    })()
  };
}
