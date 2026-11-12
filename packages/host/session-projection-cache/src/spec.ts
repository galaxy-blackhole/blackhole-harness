/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khai báo MIỀN `session_projcache` của cache chiếu phiên: schema một dòng checkpoint, schema nhân
 *      dạng log mà bản ghi bị ràng buộc, schema MỘT bản ghi theo phiên, và spec miền (bố cục
 *      `per-record`, phiên bản 7, nhận 3–6 làm tiền nhiệm, bản ghi hỏng thì backup-and-skip).
 */

import { z } from "zod/v4";
import { isJsonValue } from "@deepseek-ai/dsh-util-values";
import { SessionLogOffset, SessionSeq } from "./brand.ts";
import { defineDomain, domainTable } from "./domain.ts";
import type { DomainSpec } from "./domain.ts";

/**
 * Một dòng checkpoint đã lưu (dạng rút gọn `(sessionId, key, ver, seq, val)` của RFC, bỏ hai khoá bản
 * ghi). `val` là trạng thái nội bộ của đơn vị — JSON thuần theo hợp đồng đơn vị; phép kiểm dùng ĐÚNG
 * luật JSON không mất mát như đường ghi và GIỮ mọi khoá trạng thái mà không sao chép. Dòng không bao
 * giờ SAI, chỉ có thể CŨ: `seq` nói cũ bao nhiêu, còn `ver` lệch `stateVersion` của đơn vị đang sống
 * thì bị BỎ lúc đọc (không bao giờ migrate).
 */
export const checkpointRow = z.object({
  /** `stateVersion` của đơn vị đã sinh ra `val`. */
  ver: z.number().int().nonnegative(),
  /** Seq của sự kiện cuối đã gộp vào `val`; `-1` với log rỗng. */
  seq: z.number().int().gte(-1).transform((value) => (value === -1 ? -1 : SessionSeq(value))),
  /** Trạng thái nội bộ của đơn vị — phải sống qua một vòng JSON không mất mát. */
  val: z.custom(isJsonValue, { message: "checkpoint state must be losslessly JSON-serializable" }),
});

/**
 * Nhân dạng log đã lưu mà một bản ghi bị ràng buộc: các trường header BẤT BIẾN phân biệt hai vòng đời
 * dưới cùng một id. Một id phiên đặt tên một CHỖ, không đặt tên một vòng đời — id bị xoá rồi tạo lại,
 * hoặc một gốc lưu trữ bị tráo dưới một cache còn sống, sẽ để bản ghi cũ vượt mọi phép kiểm mốc nước
 * và mồi trạng thái gộp từ một log KHÔNG LIÊN QUAN. Đường đọc kiểm nhân dạng này với header đang sống
 * (liệt kê) hoặc header đã lưu (đọc lạnh) trước khi nhận bất kỳ bản ghi nào.
 *
 * Trường định dạng và dòng dõi là TUỲ CHỌN vì bản ghi nhận qua `compatibleVersions` có trước chúng.
 * Bên đọc (`identityMatches`) TỪ CHỐI một thế hệ định dạng vắng mặt vì không log hiện hành nào chứng
 * minh được ngữ nghĩa phép gộp của bản ghi đó. Nó chỉ đọc dòng dõi vắng là CHƯA GIEO sau khi thế hệ
 * định dạng đã khớp. Bản ghi do phiên bản hiện tại ghi thì LUÔN có đủ ba trường.
 */
export const checkpointIdentity = z.object({
  /** Thế hệ định dạng log phiên lúc gộp. */
  formatVersion: z.number().int().nonnegative().optional(),
  /** Mốc tạo phiên. */
  createdAt: z.number().int().nonnegative(),
  /** Thư mục làm việc lúc tạo phiên. */
  cwd: z.string().optional(),
  /** Phiên có tiền tố thừa kế hay không. */
  isSeeded: z.boolean().optional(),
  /** Độ dài tiền tố thừa kế khi fork. */
  inheritedEventCount: z.number().int().nonnegative().transform(SessionLogOffset).optional(),
});

/**
 * Bản ghi đã lưu của MỘT phiên: nhân dạng log mà nó được gộp từ đó, cộng các dòng checkpoint theo khoá
 * chiếu. TOÀN BỘ bản ghi bị THAY mỗi lần ghi (kỷ luật toàn-giá-trị — checkpoint của sổ chiếu luôn là
 * phép cắt ĐẦY ĐỦ theo phiên).
 */
export const checkpointRecord = z.object({
  /** Nhân dạng log của phiên. */
  identity: checkpointIdentity,
  /** Các dòng checkpoint theo khoá chiếu. */
  rows: z.record(z.string(), checkpointRow),
});

/** Nhân dạng mà một bản ghi bị ràng buộc, suy ra từ {@link checkpointIdentity}. */
export type CheckpointIdentity = z.infer<typeof checkpointIdentity>;

/** Một bản ghi checkpoint theo phiên đã lưu, suy ra từ {@link checkpointRecord}. */
export type CheckpointRecord = z.infer<typeof checkpointRecord>;

/**
 * Spec của miền `session_projcache`. Bố cục `per-record` khiến việc tăng phiên bản có phạm vi TỪNG
 * PHIÊN: sau một lần tăng, một tài liệu phiên cũ bị BỎ lúc mở (ngữ nghĩa cache — cache cũ hoặc không
 * đọc được chỉ tốn một lượt phát lại đuôi dài hơn, KHÔNG BAO GIỜ trả giá trị sai) trong khi phần còn
 * lại của miền vẫn dùng được, thay vì từ chối cả medium. Các mục `compatibleVersions` giữ bản ghi tiền
 * nhiệm còn hợp lệ về cấu trúc để một checkpoint hiện hành sau đó ghi đè; bản ghi KHÔNG có
 * `formatVersion` vẫn không dùng được làm lối tắt phép gộp vì chúng không chứng minh được ngữ nghĩa sự
 * kiện nào đã sinh ra dòng của chúng. Phép kiểm `ver` theo TỪNG DÒNG và phép so nhân dạng vẫn bỏ mọi
 * thứ mà ngữ nghĩa gộp hiện hành không bảo chứng.
 *
 * Một tiền nhiệm khớp vòng đời vẫn có thể phơi `title` tương thích phiên bản của nó qua gợi ý
 * chỉ-dùng-để-liệt-kê của dịch vụ cache; điều đó KHÔNG BAO GIỜ nới yêu cầu định dạng cho việc nạp
 * (hydrate) hay một lối tắt gộp khác.
 *
 * `invalidRecords: 'backup-and-skip'`: một bản ghi đã lưu mà vẫn hỏng schema là dữ liệu PHÁI SINH dùng
 * được thì vứt, nên nó không bao giờ được phép làm tốn một lượt boot — tầng miền chuyển tài liệu sang
 * `<key>.json.bak.<stamp>`, ghi lại lỗi kiểm cụ thể, và phục vụ phiên đó như CHƯA có cache (một lượt
 * đọc lạnh sẽ dựng lại và ghi đè).
 */
export const projectionCacheDomainSpec: DomainSpec = defineDomain({
  name: "session_projcache",
  version: 7,
  compatibleVersions: [3, 4, 5, 6],
  invalidRecords: "backup-and-skip",
  layout: "per-record",
  tables: { sessions: domainTable(checkpointRecord) },
});
