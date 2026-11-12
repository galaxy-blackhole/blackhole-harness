/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đóng băng SÂU một vật thể (nguyên thuật `deepFreeze` của @deepseek-ai/dsh-util-values, dòng
 *      824–860 — gói đó NGOÀI bảng §3b nên ta viết lại thay vì import). Điểm quan trọng phải giữ:
 *      bỏ qua AbortSignal đang sống và chịu được đồ thị có vòng.
 */

/** Một việc còn treo trong vòng duyệt: thăm một nút, hoặc đọc một thuộc tính của nút đã thăm. */
type FreezeTask =
  | { kind: "visit"; node: unknown }
  | { kind: "property"; source: Record<string, unknown>; key: string };

/**
 * Đóng băng sâu một đồ thị vật thể TẠI CHỖ, để nguyên AbortSignal đang sống.
 * Nhận: `value` — vật thể cần đóng băng (có thể là nguyên thuỷ, khi đó không làm gì).
 * Trả: CHÍNH `value` sau khi mọi nút tới được đã bị `Object.freeze`.
 */
export function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const pending: FreezeTask[] = [{ kind: "visit", node: value }];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === undefined) continue;
    if (task.kind === "property") {
      pending.push({ kind: "visit", node: task.source[task.key] });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object") continue;
    // Tín hiệu huỷ là vật thể SỐNG: đóng băng nó sẽ làm hỏng đường huỷ của chính lượt duyệt.
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    const source = node as Record<string, unknown>;
    const keys = Object.keys(source);
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === undefined) continue;
      pending.push({ kind: "property", source, key });
    }
  }
  return value;
}
