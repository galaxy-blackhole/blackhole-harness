/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Phép hiển thị hướng mô hình của tool-jobs — port 1:1 lib/types/render.js: ảnh chiếu công khai, dòng [status: …], phần đọc kèm mục [stderr], thông báo hoàn tất có trần byte, và hai hàm bọc nội dung kết quả.
 */

import type { JobChunk, JobRead, JobView } from "@galaxy-blackhole/gbh-jobs";
import type { ContentBlockLike, PublicJob } from "./types.ts";
import { boundContextSummary } from "./messages.ts";
import { fitWithSuffix, retainHead } from "./retention.ts";

/** Bộ mã hoá UTF-8 dùng cho mọi phép đo byte — NGUYÊN VĂN bản gốc. */
const encoder = new TextEncoder();

/**
 * Dòng định tính một dòng mà mô hình đọc cạnh trạng thái: tiến trình khi đang chạy, lý do cuối khi đã dừng.
 * Nhận: job — ảnh chiếu job.
 * Trả: dòng định tính, hoặc undefined khi job không mang cả hai.
 */
export function jobDetail(job: Pick<JobView, "progress" | "detail">): string | undefined {
  return job.progress ?? job.detail;
}

/**
 * Bỏ chủ sở hữu, offset và giới hạn khỏi ảnh chiếu của sổ.
 * Nhận: job — ảnh chiếu sổ.
 * Trả: ảnh chiếu an toàn cho mô hình.
 */
export function publicJob(job: JobView): PublicJob {
  const detail = jobDetail(job);
  return {
    id: job.id,
    kind: job.kind,
    label: job.label,
    status: job.status,
    ...(detail !== undefined ? { detail } : {}),
    startedAt: job.startedAt,
    ...(job.finishedAt !== undefined ? { finishedAt: job.finishedAt } : {}),
  };
}

/**
 * Hiển thị trạng thái kèm detail tuỳ chọn.
 * Nhận: snapshot — trạng thái job cần hiển thị.
 * Trả: dòng trạng thái trong ngoặc vuông.
 */
export function statusLine(snapshot: Pick<PublicJob, "status" | "detail">): string {
  return snapshot.detail !== undefined ? "[status: " + snapshot.status + ", " + snapshot.detail + "]" : "[status: " + snapshot.status + "]";
}

/**
 * Hiển thị MỘT lần đọc cho mô hình: stdout và chunk không nhãn theo thứ tự, rồi mọi chunk stderr trong MỘT mục [stderr] —
 * đúng cách các tool shell trình bày kết quả foreground. Chunk log là lời kể cho quan sát viên, KHÔNG đến mô hình.
 * Byte bị mất — con trỏ tụt sau vùng giữ của ring, hoặc một chunk mô hình thấy mang gapBefore — kết thúc bằng
 * thông báo mất đầu ra của tool shell, kèm tên tệp spill mà nguồn job đang giữ.
 * Nhận: chunks — các chunk kể từ con trỏ mô hình, theo thứ tự offset; lossy — byte trước chunks đã bị đẩy khỏi bộ nhớ chưa đọc; spillPaths — tệp toàn luồng job đang quảng bá.
 * Trả: văn bản delta, có thể rỗng.
 */
export function renderModelDelta(chunks: readonly JobChunk[], lossy: boolean, spillPaths: readonly string[]): string {
  const visible = chunks.filter((chunk) => chunk.channel !== "log");
  const out = visible.filter((chunk) => chunk.channel !== "stderr").map((chunk) => chunk.text).join("");
  const err = visible.filter((chunk) => chunk.channel === "stderr").map((chunk) => chunk.text).join("");
  const separator = out.length > 0 && !out.endsWith("\n") ? "\n" : "";
  const body = out + (err.length > 0 ? separator + "[stderr]\n" + err : "");
  if (!lossy && !visible.some((chunk) => chunk.gapBefore === true)) return body;
  const notice = "[some output was dropped from memory; full output: " + (spillPaths.length > 0 ? spillPaths.join(", ") : "(unavailable)") + "]";
  return body + (body.length > 0 && !body.endsWith("\n") ? "\n" : "") + notice;
}

/**
 * Tài khoản một dòng của một job đã dừng cho dòng thu gọn của dạng notice.
 * Nhận: job — job đã dừng.
 * Trả: kind, label và status của nó, bị giới hạn như mọi summary notice.
 */
export function completionSummary(job: JobView): string {
  return boundContextSummary(job.kind + " " + job.label + " " + statusLine(publicJob(job)));
}

/**
 * Dựng thông báo hoàn tất vừa ngân sách byte của nhà sản xuất — NGUYÊN VĂN fitCompletionNotice của bản gốc.
 * Nhận: job — job đã dừng (mang outputLimitBytes tuỳ chọn).
 * Trả: câu thông báo hoàn tất, có thể đã rút gọn theo đúng thứ tự ưu tiên của bản gốc.
 * @throws {Error} khi outputLimitBytes không phải số nguyên không âm và buộc phải cắt.
 */
export function fitCompletionNotice(job: JobView): string {
  const prefix = "background job " + job.id;
  const detail = " (" + job.kind + ": " + job.label + ") finished " + statusLine(publicJob(job));
  const action = "\nDone; job_output.";
  const complete = prefix + detail + ". Read its output with job_output.";
  const maxBytes = job.outputLimitBytes;
  if (maxBytes === undefined || encoder.encode(complete).byteLength <= maxBytes) return complete;
  const omitted = "\n[notice truncated]";
  const fixed = prefix + omitted + action;
  const fixedBytes = encoder.encode(fixed).byteLength;
  if (fixedBytes <= maxBytes) return fixedBytes === maxBytes ? fixed : prefix + retainHead(detail, maxBytes - fixedBytes) + omitted + action;
  const compact = prefix + action;
  if (encoder.encode(compact).byteLength <= maxBytes) return compact;
  const recovery = "background job ended; use job_list for id.";
  if (encoder.encode(recovery).byteLength <= maxBytes) return recovery;
  return retainHead("job_list", maxBytes);
}

/**
 * Đọc MỘT khối văn bản duy nhất từ content, nếu đúng hình dạng đó.
 * Nhận: content — các khối nội dung.
 * Trả: văn bản của khối duy nhất, hoặc undefined khi content không phải đúng một khối text.
 */
export function rawSingleText(content: readonly ContentBlockLike[]): string | undefined {
  if (content.length !== 1) return undefined;
  const block = content[0];
  if (block?.type !== "text") return undefined;
  return block.text;
}

/**
 * Bọc nội dung thành MỘT khối text vừa ngân sách, chỉ khi content đúng một khối text.
 * Nhận: content — các khối nội dung; maxBytes — ngân sách byte.
 * Trả: mảng một khối đã cắt, hoặc undefined khi content không phải đúng một khối text.
 * @throws {Error} khi maxBytes không phải số nguyên không âm và buộc phải cắt.
 */
export function boundSingleText(content: readonly ContentBlockLike[], maxBytes: number): ContentBlockLike[] | undefined {
  const text = rawSingleText(content);
  if (text === undefined) return undefined;
  return [{ type: "text", text: fitWithSuffix(text, "", maxBytes, "\n[result truncated]") }];
}

/**
 * Phần đọc mà mô hình thấy: delta, rồi result MỘT lần, rồi dòng trạng thái — NGUYÊN VĂN readBody của bản gốc.
 * Nhận: read — kết quả đọc của sổ jobs.
 * Trả: văn bản cho mô hình + ảnh chiếu công khai sau đọc.
 */
export function readBody(read: JobRead): { text: string; job: PublicJob } {
  const delta = renderModelDelta(read.chunks, read.lossy, read.job.output.spillPaths ?? []);
  return {
    text: read.result === undefined ? delta : delta + (delta.length > 0 && !delta.endsWith("\n") ? "\n" : "") + read.result,
    job: publicJob(read.job),
  };
}
