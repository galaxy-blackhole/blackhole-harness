/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàm chuẩn hoá THƯƠNG HIỆU dùng chung cho test đối chiếu nguyên văn với bundle gốc DSH (task-17/N2)
 */

// VÌ SAO CÓ FILE NÀY
//   Task-17/N2 đổi tên sản phẩm "DeepSeek Harness" → "Galaxy Blackhole" trong 16 file. Các ca test đối chiếu
//   NGUYÊN VĂN với bundle gốc (prompt, văn bản trợ giúp, thông điệp lỗi, từ điển) sẽ đỏ vì khác đúng MỘT nhãn.
//   Cách xử lý: chuẩn hoá nhãn về phía bundle gốc rồi so — mọi khác biệt KHÁC vẫn lộ ra TỪNG BYTE.
//
//   ⚠️ Hàm ở đây CHỈ được đổi đúng tên thương hiệu. Ca canh chính các hàm nằm ở
//   tests/check/no-dsh-assets.test.ts (mục "hàm chuẩn hoá thương hiệu") để không ai lạm dụng nó che khác biệt thật.

/** Nhãn thương hiệu của bundle GỐC DSH — chỉ dùng để CHUẨN HOÁ khi so nguyên văn. */
export const STOCK_BRAND = "DeepSeek Harness";

/** Nhãn thương hiệu của sản phẩm ta — khác biệt CÓ Ý (task-17/N2: chỉ đổi tên sản phẩm). */
export const GBH_BRAND = "Galaxy Blackhole";

/**
 * Đưa chuỗi về nhãn thương hiệu của bundle gốc để so NGUYÊN VĂN.
 * Nhận: text — chuỗi đầu ra của ta (có thể chứa nhãn GBH).
 * Trả: chuỗi đã thay nhãn GBH bằng nhãn DSH; mọi khác biệt KHÁC vẫn lộ ra từng byte.
 */
export function brandNeutral(text: string): string {
  return text.split(GBH_BRAND).join(STOCK_BRAND);
}

/**
 * Đưa chuỗi về nhãn thương hiệu GBH (chiều ngược của brandNeutral).
 * Nhận: text — chuỗi lấy từ bundle gốc.
 * Trả: chuỗi đã thay nhãn DSH bằng nhãn GBH.
 */
export function brandToGbh(text: string): string {
  return text.split(STOCK_BRAND).join(GBH_BRAND);
}

/**
 * Đệ quy chuẩn hoá thương hiệu trong mọi giá trị chuỗi của một vật thể (từ điển, mảng, object).
 * Nhận: value — vật thể bất kỳ.
 * Trả: bản sao đã chuẩn hoá thương hiệu; cấu trúc và mọi chuỗi khác giữ nguyên.
 */
export function neutralDict(value: unknown): unknown {
  if (typeof value === "string") return brandNeutral(value);
  if (Array.isArray(value)) return value.map((item) => neutralDict(item));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = neutralDict(item);
    return out;
  }
  return value;
}

/**
 * Chuẩn hoá kết quả dạng { ok } hoặc { err } (chỉ nhãn thương hiệu trong err.message).
 * Nhận: result — kết quả của một thao tác đã bắt lỗi (vd outcome() trong test llm-deepseek-account).
 * Trả: bản sao đã chuẩn hoá err.message; mọi trường khác giữ nguyên để so tiếp.
 */
export function neutralOutcome<T>(result: { ok?: T; err?: Record<string, unknown> }): { ok?: T; err?: Record<string, unknown> } {
  if (result.err === undefined) return result;
  const message = typeof result.err.message === "string" ? brandNeutral(result.err.message) : result.err.message;
  return { ...result, err: { ...result.err, message } };
}
