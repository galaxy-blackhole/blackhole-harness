/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc So sánh phản hồi phía Host cho tệp mô hình ghim revision trên các origin tương thích Hugging Face —
 *      port 1:1 region lib/types/model-sources.js (stock lib/index.js:70–183).
 */
import { deadline } from "@deepseek-ai/dsh-timeout";

/**
 * Ưu tiên phản hồi HEAD thành công đầu tiên nhưng vẫn giữ các nguồn khác để fallback khi tải
 * (stock lib/index.js:139–182). Mọi phép dò đều kết thúc trước khi trả; nếu tất cả đều hỏng thì giữ thứ tự cấu hình.
 * Nhận: `assetUrl` — URL tệp thượng nguồn đã ghim revision; `origins` — origin đã cấu hình (khác rỗng) hoặc một origin triển khai;
 *       `timeoutMs` — hạn dò tối đa, kể cả chuyển hướng; `signal` — huỷ chuẩn bị hoặc deadline.
 * Trả: danh sách URL đã khử trùng lặp với nguồn phản hồi đầu tiên đứng trước; một nguồn duy nhất thì không cần dò.
 */
export async function orderModelSources(assetUrl: string, origins: readonly string[], timeoutMs: number, signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted();
  const path = new URL(assetUrl).pathname;
  const urls = [...new Set(origins.map((origin) => new URL(path, origin).href))];
  if (urls.length === 1) return urls;
  const finished = new AbortController();
  using timeout = deadline(signal, timeoutMs, "SPEECH_SOURCE_PROBE_TIMEOUT");
  const probing = AbortSignal.any([timeout.signal, finished.signal]);
  const requests = urls.map(async (url) => ({
    url,
    response: await fetch(url, {
      method: "HEAD",
      signal: probing,
    }),
  }));
  let preferred: string | undefined;
  try {
    preferred = await Promise.any(requests.map(async (request) => {
      const { url, response } = await request;
      if (!response.ok) throw new Error(`Model source probe returned HTTP ${response.status}`);
      return url;
    }));
  } catch (_unavailableSources) {
    // Mọi nguồn đều hỏng: giữ nguyên thứ tự cấu hình (stock lib/index.js:167).
  } finally {
    finished.abort();
    const settled = await Promise.allSettled(requests);
    await Promise.allSettled(settled.map(async (result) => {
      if (result.status === "fulfilled") await result.value.response.body?.cancel();
    }));
  }
  signal.throwIfAborted();
  return preferred === void 0 ? urls : [preferred, ...urls.filter((url) => url !== preferred)];
}
