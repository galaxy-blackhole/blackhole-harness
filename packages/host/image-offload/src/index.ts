/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Bộ đẩy ảnh ra khỏi ngữ cảnh cho seam nén. Khi một route CÓ ảnh hỏng request với
 *      `IMAGE_OFFLOAD_REQUIRED`, plugin ghi MỘT quyết định `image/offload` chọn các lần xuất hiện
 *      ảnh ĐẦU-VÀO cũ nhất rồi thử lại qua waterfall lỗi của agent hoặc của bộ tóm tắt.
 *      Bản viết lại của Galaxy Blackhole cho row image-offload
 *      (@deepseek-ai/dsh-compaction-image-offload) — nguồn đối chiếu ở README.md của package (G4).
 */

import { IMAGE_OFFLOAD_REQUIRED_CODE } from "@deepseek-ai/dsh-llm";
import { offloadOldestImages } from "./image-offload.ts";
import { imageOffloadProjection } from "./projection.ts";
import type { ImageOffloadContext } from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc (Loader dùng cho chẩn đoán). */
export const name = "compaction-image-offload";

/** Service mà plugin phải chờ trước khi chạy: nó chỉ là listener trên hai waterfall của chúng. */
export const inject: string[] = ["agents", "sessions"];

/**
 * Nhận diện lớp lỗi theo TÊN, bền với MỌI bản sao mô-đun của cùng một lớp.
 * Vì sao (01/11/2026): `LlmError` được import qua peer `@deepseek-ai/dsh-llm`; trong giàn đo specifier đó
 * phân giải về MỘT BẢN SAO khác kernel nên `instanceof` trượt và waterfall `compaction/summary-error`
 * bỏ qua lỗi kernel thật thay vì ghi quyết định (đo được: 2 ca đỏ — quyết định rỗng, listener chuyển tiếp).
 * Lớp gốc đặt `name` theo tên lớp CON, nên phép so tên trực tiếp không đủ: phải dò tên lớp trên chuỗi
 * prototype, đúng ngữ nghĩa `instanceof` xuyên bản sao.
 * Nhận: error — giá trị bắt được; name — tên lớp cần khớp.
 * Trả: true khi chuỗi prototype của lỗi chứa một lớp mang đúng tên đó.
 */
function isNamedError(error: unknown, name: string): boolean {
  try {
    if (!(error instanceof Error)) return false;
    for (let proto: object | null = Object.getPrototypeOf(error); proto !== null; proto = Object.getPrototypeOf(proto)) {
      const ctor = (proto as { constructor?: { name?: string } }).constructor;
      if (typeof ctor === "function" && ctor.name === name) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Cài listener phục hồi cho agent và cho bộ tóm tắt, KHÔNG cần cấu hình.
 * Nhận: context cordis sở hữu sổ phiên và hai waterfall.
 * Trả: không; đăng ký định nghĩa projection `image/offload` rồi hai listener.
 *       Mỗi listener chỉ nhận việc khi lỗi đúng mã `IMAGE_OFFLOAD_REQUIRED` VÀ mang `offloadImages`;
 *       không còn ảnh nào để đẩy thì chuyển tiếp (`next()`) để tầng dưới phục hồi hoặc báo lỗi cuối.
 */
export function apply(ctx: ImageOffloadContext): void {
  ctx.sessions.registerMessageProjection(imageOffloadProjection);
  ctx.on("agent/request-error", ({ agent, failure, signal }, next) => {
    if (failure.code !== IMAGE_OFFLOAD_REQUIRED_CODE || failure.offloadImages === undefined || signal.aborted) return next();
    if (!offloadOldestImages(agent.session, agent.session.surface.nodes, failure.offloadImages)) return next();
    return Promise.resolve({ kind: "retry" });
  });
  ctx.on("compaction/summary-error", ({ session, sourceEventSeqs, error, signal }, next) => {
    // `LlmError` có thể đến từ MỘT BẢN SAO khác của peer ⇒ nhận diện theo tên lớp, KHÔNG theo `instanceof`.
    if (!isNamedError(error, "LlmError")) return next();
    const llm = error as { readonly code?: unknown; readonly failure?: { readonly offloadImages?: number } };
    const offloadImages = llm.failure?.offloadImages;
    if (llm.code !== IMAGE_OFFLOAD_REQUIRED_CODE || offloadImages === undefined) return next();
    // Huỷ SAU khi đã ghi quyết định ⇒ lần nén sau vẫn giữ phần đã bỏ; huỷ TRƯỚC thì ném và KHÔNG ghi gì.
    signal?.throwIfAborted();
    if (!offloadOldestImages(session, sourceEventSeqs, offloadImages)) return next();
    return true;
  });
}
