/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đóng băng sâu một đồ thị vật thể tại chỗ, GIỮ NGUYÊN danh tính — bản viết lại trung thành
 *      của `deepFreeze` trong `@deepseek-ai/dsh-util-values`.
 */

/**
 * Đóng băng sâu mọi vật thể tới được, TẠI CHỖ, và trả lại CHÍNH vật thể đã nhận.
 * Nhận: giá trị cần đóng băng (vật thể, mảng, hoặc giá trị nguyên thuỷ — nguyên thuỷ bỏ qua).
 * Trả: ĐÚNG vật thể đầu vào sau khi mọi con cháu enumerable đã bị đóng băng.
 *       `AbortSignal` được BỎ QUA có chủ ý: tín hiệu huỷ vẫn phải dùng được sau khi đóng băng.
 */
export function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const pending: ({ kind: "visit"; node: unknown } | { kind: "property"; source: Record<string, unknown>; key: string })[] = [
    { kind: "visit", node: value },
  ];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === undefined) continue;
    if (task.kind === "property") {
      pending.push({ kind: "visit", node: task.source[task.key] });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === undefined) continue;
      pending.push({ kind: "property", source: node as Record<string, unknown>, key });
    }
  }
  return value;
}
