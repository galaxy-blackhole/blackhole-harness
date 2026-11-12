/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chiếu bề mặt hiện tại của phiên và dựng bản xem trước theo ngân sách byte — port 1:1 vùng projection.js (stock lib/index.js dòng 123–273).
 */

import { Buffer } from "node:buffer";

import { isCompactCheckpointSource } from "@deepseek-ai/dsh-compaction";
import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import { TextRetainer } from "@deepseek-ai/dsh-output-retention";
import { SessionSeq } from "@galaxy-blackhole/gbh-session";
import type { OptionalSessionSeq, SessionId } from "@galaxy-blackhole/gbh-session";
import type { SessionSurfaceSnapshot } from "@deepseek-ai/dsh-session-query";
import { assertNever } from "@deepseek-ai/dsh-util-values";

import { stringifyTagSafeJson } from "./serialization.ts";
import type { ReferencedConversationItem } from "./spill.ts";

/** Dữ liệu ảnh chụp được tuần tự hoá BÊN TRONG lời nhắc không tin cậy. */
export interface ReferencedSessionData {
  /** Danh tính phiên nguồn. */
  sessionId: SessionId;
  /** Nhãn hiển thị do host cấp, được tuần tự hoá cùng nguồn. */
  label: string;
  /** Thư mục làm việc của phiên nguồn; `null` khi không ghi nhận. */
  cwd: string | null;
  /** Seq log thô CAO NHẤT đã quan sát; `null` với log rỗng. */
  capturedThroughSeq: OptionalSessionSeq;
  /** Hội thoại CHỈ CÓ CHỮ, theo thứ tự mô hình nhìn thấy. */
  conversation: ReferencedConversationItem[];
}

/** Dữ kiện GIỮ LẠI được lưu cạnh ngữ cảnh bền vững. */
export interface ReferenceRetentionStats {
  /** Phiên nguồn có ít nhất một điểm kiểm nén. */
  compacted: boolean;
  /** Số mục hội thoại của bản chiếu ĐẦY ĐỦ. */
  originalMessages: number;
  /** Số mục còn lại trong bản xem trước. */
  retainedMessages: number;
  /** Số NGUYÊN mục bị bỏ khỏi bản xem trước. */
  omittedMessages: number;
  /** Số byte UTF-8 văn bản bị bỏ (nguyên mục + phần cắt đuôi). */
  omittedBytes: number;
  /** Có mục nào bị bỏ hoặc bị cắt hay không. */
  truncated: boolean;
}

/** Một mục hội thoại đã chiếu, kèm dữ kiện giữ/cắt CHỈ dùng bên trong module. */
interface ProjectedConversationItem {
  /** Vai của tin nhắn gốc. */
  role: "user" | "assistant";
  /** Chữ hiển thị còn giữ (đã cắt nếu cần). */
  text: string;
  /** Điểm kiểm nén — mục như vậy KHÔNG BAO GIỜ bị bỏ nguyên chiếc. */
  checkpoint: boolean;
  /** Chữ ĐẦY ĐỦ ban đầu, mốc để cắt và để tính byte bị bỏ. */
  originalText: string;
  /** Số byte UTF-8 đã bị cắt khỏi chữ này. */
  omittedBytes: number;
}

/** Kết quả cắt một chuỗi kèm số byte đã bỏ. */
interface TruncatedText {
  /** Chữ đã giữ, có thể kèm câu thông báo phần bị bỏ. */
  text: string;
  /** Số byte UTF-8 bị bỏ khỏi chuỗi gốc. */
  omittedBytes: number;
}

/**
 * Chiếu hội thoại người dùng/trợ lý HIỆN TẠI, loại bỏ tool, lý luận và ngữ cảnh được chèn.
 * Nhận: `snapshot` — quan sát bề mặt hiện tại của một phiên.
 * Trả: các mục hội thoại chỉ chữ theo đúng thứ tự mô hình nhìn thấy; mục rỗng bị bỏ.
 */
function projectSessionConversation(snapshot: SessionSurfaceSnapshot): ProjectedConversationItem[] {
  const conversation: ProjectedConversationItem[] = [];
  for (const event of snapshot.events)
    switch (event.type) {
      case "user/message": {
        const checkpoint = isCompactCheckpointSource(event.data.source);
        // Chỉ tin nhắn NGƯỜI DÙNG trực tiếp và điểm kiểm nén mới vào bản chiếu.
        if (!checkpoint && event.data.source.kind !== "user") break;
        const text = textContent(event.data.content);
        if (text !== "")
          conversation.push({
            role: "user",
            text,
            checkpoint,
            originalText: text,
            omittedBytes: 0,
          });
        break;
      }
      case "assistant/message": {
        const text = textContent(event.data.message.content);
        if (text !== "")
          conversation.push({
            role: "assistant",
            text,
            checkpoint: false,
            originalText: text,
            omittedBytes: 0,
          });
        break;
      }
      case "developer/message":
      case "system/message":
      case "tool/result":
        break;
      /* v8 ignore next 2 -- SurfaceEventType là union ĐÓNG và mọi nhánh đã xử lý ở trên. */
      default:
        assertNever(event, "session-reference surface event");
    }
  return conversation;
}

/**
 * Đưa MỘT ảnh chụp đã chiếu vào đúng ngân sách byte của đối tượng JSON được dựng.
 * Nhận: `snapshot` — quan sát bề mặt nguồn; `label` — nhãn hiển thị do host cấp, tuần tự hoá cùng nguồn;
 *        `maxBytes` — số byte UTF-8 tối đa cho đối tượng dữ liệu đã tuần tự hoá.
 * Trả: dữ liệu đầy đủ + bản xem trước đã giữ + thống kê, hoặc `undefined` khi phần dữ liệu CỐ ĐỊNH không lọt.
 */
export function retainReferencedSession(
  snapshot: SessionSurfaceSnapshot,
  label: string,
  maxBytes: number,
): { data: ReferencedSessionData; fullData: ReferencedSessionData; stats: ReferenceRetentionStats } | undefined {
  const original = projectSessionConversation(snapshot);
  const retained = original.map((item) => ({ ...item }));
  let omittedMessages = 0;
  let droppedOmittedBytes = 0;
  const data = (): ReferencedSessionData => ({
    sessionId: snapshot.session.id,
    label,
    cwd: snapshot.session.cwd ?? null,
    capturedThroughSeq: snapshot.capturedThroughSeq === null ? null : SessionSeq(snapshot.capturedThroughSeq),
    conversation: retained.map(({ role, text }) => ({ role, text })),
  });
  const fullData = data();
  const size = (): number => Buffer.byteLength(stringifyTagSafeJson(data()), "utf8");

  // Vòng 1 — bỏ NGUYÊN CHIẾC tin nhắn cũ nhất (trừ điểm kiểm nén và tin MỚI NHẤT).
  while (size() > maxBytes) {
    const newestIndex = retained.length - 1;
    const dropIndex = retained.findIndex((item, index) => !item.checkpoint && index !== newestIndex);
    if (dropIndex < 0) break;
    const removed = retained.splice(dropIndex, 1)[0];
    /* v8 ignore next 3 -- dropIndex lấy từ chính mảng này và không âm. */
    if (removed === undefined) throw new Error("session-reference retention selected a missing message");
    omittedMessages += 1;
    droppedOmittedBytes += Buffer.byteLength(removed.originalText, "utf8");
  }

  // Vòng 2 — cắt bớt chữ của tin DÀI NHẤT (đầu + đuôi) cho tới khi lọt ngân sách.
  while (size() > maxBytes) {
    let longestIndex = -1;
    let longestBytes = 0;
    for (const [index, item] of retained.entries()) {
      const bytes = Buffer.byteLength(item.text, "utf8");
      if (bytes > longestBytes) {
        longestBytes = bytes;
        longestIndex = index;
      }
    }
    if (longestIndex < 0 || longestBytes === 0) return void 0;
    const overflow = size() - maxBytes;
    const target = Math.max(0, longestBytes - overflow);
    const item = retained[longestIndex];
    /* v8 ignore next 3 -- longestIndex được chọn từ chính các phần tử của mảng này. */
    if (item === undefined) throw new Error("session-reference retention selected a missing longest message");
    const shortened = truncateWithNotice(item.originalText, target);
    /* v8 ignore next -- hạ ngân sách byte phải làm đổi kết quả giữ nguyên chuỗi. */
    if (shortened.text === retained[longestIndex]?.text) return void 0;
    retained[longestIndex] = {
      ...item,
      text: shortened.text,
      omittedBytes: shortened.omittedBytes,
    };
  }

  const compacted = original.some((item) => item.checkpoint);
  const omittedBytes = retained.reduce((sum, item) => sum + item.omittedBytes, 0) + droppedOmittedBytes;
  return {
    data: data(),
    fullData,
    stats: {
      compacted,
      originalMessages: original.length,
      retainedMessages: retained.length,
      omittedMessages,
      omittedBytes,
      truncated: omittedMessages > 0 || omittedBytes > 0,
    },
  };
}

/**
 * Ghép chữ của MỌI khối văn bản trong một nội dung tin nhắn.
 * Nhận: `content` — các khối nội dung model nhìn thấy (chỉ khối `text` được lấy).
 * Trả: chữ đã nối bằng xuống dòng; chuỗi rỗng khi không có khối chữ nào.
 */
function textContent(content: readonly ContentBlock[]): string {
  return content.flatMap((block) => (block.type === "text" && typeof block.text === "string" ? [block.text] : [])).join("\n");
}

/**
 * Cắt một chuỗi về tối đa `maxOutputBytes` byte UTF-8, giữ ĐẦU + ĐUÔI và gắn câu thông báo phần bị bỏ.
 * Nhận: `text` — chuỗi gốc; `maxOutputBytes` — trần byte của chuỗi ĐẦU RA (đã tính cả câu thông báo).
 * Trả: chữ đã cắt kèm số byte bị bỏ; nguyên văn khi chuỗi vốn đã lọt trần.
 */
function truncateWithNotice(text: string, maxOutputBytes: number): TruncatedText {
  /* v8 ignore next -- nơi gọi chỉ đưa đích nhỏ hơn chữ gốc đã chọn. */
  if (Buffer.byteLength(text, "utf8") <= maxOutputBytes) return { text, omittedBytes: 0 };
  let low = 0;
  let high = maxOutputBytes;
  let best: TruncatedText = {
    text: "",
    omittedBytes: Buffer.byteLength(text, "utf8"),
  };
  // Tìm nhị phân số byte giữ lại LỚN NHẤT mà chuỗi + thông báo vẫn lọt trần.
  while (low <= high) {
    const retainedBytes = Math.floor((low + high) / 2);
    const retainer = new TextRetainer({
      kind: "headTail",
      headBytes: Math.ceil(retainedBytes / 2),
      tailBytes: Math.floor(retainedBytes / 2),
    });
    retainer.push(text);
    const result = retainer.finish();
    /* v8 ignore next 3 -- TextRetainer nhận TRỌN chuỗi không bao giờ báo cận dưới. */
    if (result.omittedBytes.kind !== "exact")
      throw new Error("session-reference retention did not report exact omitted bytes");
    const omitted = result.omittedBytes.count;
    const candidate = `${result.text}\n[… omitted ${omitted} UTF-8 bytes …]`;
    if (Buffer.byteLength(candidate, "utf8") <= maxOutputBytes) {
      best = { text: candidate, omittedBytes: omitted };
      low = retainedBytes + 1;
    } else high = retainedBytes - 1;
  }
  return best;
}
