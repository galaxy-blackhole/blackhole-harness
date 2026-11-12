/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dịch log canonical của phiên sang các trường JSON NGUYÊN THUỶ của request DeepSeek, và đo số
 *      byte UTF-8 của một giá trị đúng như thân request mã hoá nó — bản viết lại 1:1 bốn helper nội bộ
 *      của `@deepseek-ai/dsh-session-log-deepseek`.
 */

import { Buffer } from "node:buffer";

import { KNOWN_SESSION_EVENT_TYPES } from "@deepseek-ai/dsh-session";
import type { Session, SessionEvent, SurfaceOp } from "@deepseek-ai/dsh-session";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";

import type {
  DeepSeekSessionLogWireEvent,
  DeepSeekSessionLogWireHeader,
  DeepSeekSessionLogWireSurfaceOp,
} from "./types.ts";

/**
 * Dịch metadata phiên đã chuẩn hoá sang các trường request bên ngoài.
 * Nhận: phiên canonical đang sống.
 * Trả: đầu phiên đã duỗi — trường VẮNG không được ghi thành `undefined` (khoá không xuất hiện trên wire).
 */
export function wireHeader(session: Session): DeepSeekSessionLogWireHeader {
  const header = session.header;
  return {
    version: header.version,
    id: String(header.id),
    createdAt: header.createdAt,
    ...(header.cwd === undefined ? {} : { cwd: header.cwd }),
    ...(header.parentSession === undefined ? {} : { parentSession: String(header.parentSession) }),
    ...(header.isSeeded ? { seedLength: Number(session.inheritedEventCount) } : {}),
    ...(header.origin === undefined ? {} : { origin: header.origin }),
    ...(header.delegationDepth === undefined ? {} : { delegationDepth: header.delegationDepth }),
    ...(header.agentPreset === undefined ? {} : { agentPreset: header.agentPreset }),
  };
}

/**
 * Dịch thương hiệu số của số thứ tự lúc biên dịch sang số nguyên thuỷ trên wire.
 * Nhận: một sự kiện canonical bất kỳ.
 * Trả: phong bì wire của sự kiện, giữ ĐÚNG nhánh mà bản gốc giữ.
 */
export function wireEvent(event: SessionEvent): DeepSeekSessionLogWireEvent {
  // `data` là JSON của log; kiểu của nó hẹp hơn `JsonValue` nhưng cùng giá trị lúc chạy.
  const common = {
    seq: Number(event.seq),
    time: event.time,
    data: event.data as JsonValue,
    ...(event.ignorable === undefined ? {} : { ignorable: event.ignorable }),
  };
  switch (event.type) {
    case "developer/message":
    case "system/message":
    case "user/message":
    case "tool/result":
      return {
        ...common,
        type: event.type,
        surfaceOp: wireSurfaceOp(event.surfaceOp),
        ...(event.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: event.sourceEventSeqs.map(Number) }),
      };
    case "assistant/message":
      return { ...common, type: event.type, surfaceOp: wireSurfaceOp(event.surfaceOp) };
    default: {
      // Bản ghi lạ ĐÃ KHÔI PHỤC thì mờ (opaque), không phải sự kiện mặt hiện tại.
      if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true) {
        const opaque = event as SessionEvent & { surfaceOp?: JsonValue; sourceEventSeqs?: JsonValue };
        return {
          ...common,
          type: event.type,
          ignorable: true,
          ...(opaque.surfaceOp === undefined ? {} : { surfaceOp: opaque.surfaceOp }),
          ...(opaque.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: opaque.sourceEventSeqs }),
        };
      }
      return { ...common, type: event.type };
    }
  }
}

/**
 * Duỗi một thao tác mặt về dạng số nguyên thuỷ.
 * Nhận: thao tác mặt của sự kiện đang sinh thông điệp.
 * Trả: `"append"` nguyên văn, hoặc object `replace` với hai đầu đã bỏ thương hiệu.
 */
export function wireSurfaceOp(op: SurfaceOp): DeepSeekSessionLogWireSurfaceOp {
  return op === "append" ? op : { op: "replace", startSeq: Number(op.startSeq), endSeq: Number(op.endSeq) };
}

/**
 * Độ dài UTF-8 phần JSON của một giá trị, đúng như thân request mã hoá nó.
 * Nhận: giá trị cần đo.
 * Trả: số byte; `Infinity` khi giá trị KHÔNG serialize được — nghĩa là vượt MỌI trần.
 */
export function jsonBytes(value: unknown): number {
  let text: string;
  try {
    text = JSON.stringify(value) as string;
  } catch {
    // Không request nào mang được một giá trị không serialize được.
    return Number.POSITIVE_INFINITY;
  }
  return Buffer.byteLength(text);
}
