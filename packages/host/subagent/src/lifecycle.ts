/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Công bố cạnh vòng đời cho các lần kích hoạt subagent được quản lý: emitter có chứa lỗi từng
 *      listener, observer của một epoch, và lý do dừng suy từ log của con. Port 1:1
 *      `lib/types/lifecycle.js` (115 dòng) + `lifecycle.d.ts` (83 dòng) của `@deepseek-ai/dsh-subagent`.
 */

/**
 * Công bố cạnh vòng đời cho các lần kích hoạt subagent được quản lý.
 *
 * Payload sự kiện công khai sống ở `./types.ts`; observer riêng trong gói chỉ giữ danh tính dùng chung
 * cho mỗi cặp start/end.
 *
 * @module @galaxy-blackhole/gbh-subagent/lifecycle
 */

import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import { foldConsumedWork } from "@galaxy-blackhole/gbh-agent";
import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { SessionEvent, SessionId } from "@galaxy-blackhole/gbh-session";

import { SubagentRunId } from "./types.ts";
import type { SubagentResult, SubagentRunEndInfo, SubagentRunInfo } from "./types.ts";

/**
 * Danh tính dùng chung của MỘT epoch, ghi được trong lúc chờ cạnh start chốt `local`. Bản gốc giữ
 * nguyên đối tượng trong closure observer rồi đột biến `local`; kiểu công bố {@link SubagentRunInfo}
 * đánh dấu `readonly` trường đó, nên đây là hình dạng ghi được của cùng dữ liệu.
 *
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng). Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
interface MutableRunIdentity {
  /** Danh tính duy nhất của cặp sự kiện. */
  runId: SubagentRunId;
  /** Tên provider được ghi trong descriptor bền vững. */
  provider: string;
  /** Id phiên con bền vững. */
  id: SessionId;
  /** Lần kích hoạt có sở hữu Agent cục bộ hay không. */
  local: boolean;
}

/**
 * Observer vòng đời cho epoch cư trú của một lần kích hoạt. Riêng trong gói: quản lý tiếp nối là bên
 * tiêu thụ duy nhất, và thứ tự gọi của nó là hợp đồng trong gói chứ không phải điểm mở rộng công bố.
 */
export interface ActivationObserver {
  /**
   * Công bố cạnh bắt đầu một khi epoch đã cư trú.
   * @param child — Agent cục bộ đang cư trú, hoặc undefined với lần thi hành bên ngoài.
   */
  start(child?: Agent): void;
  /**
   * Công bố cạnh kết thúc đúng một lần, ghép với {@link start} của epoch này, sau khi đã biết kết cục
   * của dispose. Chỉ gọi cho epoch đã cư trú: hỏng trước khi cư trú thì không công bố cạnh nào, vì bịa
   * ra một cạnh sẽ báo một vòng đời mà con chưa từng có.
   * @param result — kết quả đã chụp, đã áp cả lỗi teardown.
   */
  settle(result: SubagentResult): void;
}

/**
 * Công bố MỘT cạnh vòng đời với việc chặn ngoại lệ theo từng listener. Cạnh của lần chạy mang Agent cha
 * uỷ nhiệm — khoá của dispatch theo phạm vi; việc gỡ provider không có vật mang cha nên tới listener
 * không theo phạm vi.
 *
 * Dịch vụ sở hữu closure này vì dispatch theo phạm vi khoá vật mang của nó bằng đúng instance dịch vụ,
 * mà bộ lọc context của chính nó lại hợp thành vào vật mang; một vật thay thế thu hẹp sẽ âm thầm đổi
 * cách lọc phạm vi.
 */
export type LifecycleEmitter = {
  (name: 'subagent/start', info: SubagentRunInfo, parent: Agent): void;
  (name: 'subagent/end', info: SubagentRunEndInfo, parent: Agent): void;
  (name: 'subagent/provider-removed', info: string): void;
};

/**
 * Dựng emitter vòng đời có chứa lỗi mà seam này công bố mọi cạnh qua. Mỗi listener được chặn độc lập:
 * một lần ném đồng bộ hay một promise trả về bị từ chối đều được ghi log mà không bỏ đói listener anh
 * em, không đổi lần chạy, và — với việc gỡ provider, vốn phát từ một disposer — không phá teardown.
 * Nhận: ctx — context của chính dịch vụ, sở hữu dispatch và logger; carrier — phân giải vật mang
 *        dispatch theo phạm vi cho một Agent cha uỷ nhiệm.
 * Trả: emitter mà cả observer lẫn sổ đăng ký provider công bố qua.
 */
export function createLifecycleEmitter(
  ctx: Context,
  carrier: (parent: Agent) => object,
): LifecycleEmitter {
  const emit: LifecycleEmitter = (
    name: string,
    info: SubagentRunInfo | SubagentRunEndInfo | string,
    parent?: Agent,
  ): void => {
    const dispatchArgs = parent === undefined
      ? [name, info]
      : [carrier(parent), name, info];
    for (const callback of ctx.events.dispatch('emit', dispatchArgs)) {
      try {
        const returned = callback(info);
        void Promise.resolve(returned).catch((error) => {
          ctx.logger.warn(`subagent: ${name} listener rejected: ${renderThrown(error)}`);
        });
      }
      catch (error) {
        ctx.logger.warn(`subagent: ${name} listener threw: ${renderThrown(error)}`);
      }
    }
  };
  return emit;
}

/**
 * Dựng observer cho epoch cư trú của một lần kích hoạt cục bộ hoặc bên ngoài. Hỏng lúc tạo trước khi cư
 * trú thì không phát cạnh vòng đời nào.
 * Nhận: emit — emitter vòng đời đã chứa lỗi; provider — tên provider ghi trong descriptor bền vững;
 *        childId — id phiên con bền vững; parent — đúng Agent cha trực tiếp đang sống, khoá dispatch
 *        theo phạm vi.
 * Trả: observer mà các cạnh của epoch này công bố qua.
 */
export function createActivationObserver(
  emit: LifecycleEmitter,
  provider: string,
  childId: SessionId,
  parent: Agent,
): ActivationObserver {
  const identity: MutableRunIdentity = { runId: SubagentRunId(randomUUID()), provider, id: childId, local: false };
  return {
    start: (child) => {
      identity.local = child !== undefined;
      emit('subagent/start', identity, parent);
    },
    settle: ({ stopReason, output }) => {
      emit('subagent/end', {
        ...identity,
        stopReason,
        ...(output.length === 0 ? {} : { lastAssistantMessage: output }),
      }, parent);
    },
  };
}

/**
 * Vì sao epoch của con này kết thúc, dùng cho cạnh vòng đời kết thúc và cho chính việc giao cho cha của
 * quản lý. Log của con là nguồn chuẩn: teardown thành công không nói gì về việc model có lỗi, có chạm
 * trần token, hay có bị huỷ hay không, nên suy lý do từ dispose sẽ báo việc đã hỏng thành đã xong.
 *
 * {@link foldConsumedWork} cấp cả hai nửa mà chuỗi lượt thô không có: lượt nào hạch toán phần việc mà
 * epoch này tiêu thụ, và liệu việc đã được nhận có bị huỷ sau đó mà không lượt nào mở lên trên nó hay
 * không. Một lần hỏng đã ghi vẫn thắng một lần huỷ — dừng một con vốn đã hỏng không biến lần hỏng của nó
 * thành lần huỷ.
 * Nhận: events — hậu tố sự kiện thuộc chính epoch này.
 * Trả: lý do dừng kết thúc của nó; `completed` chỉ với epoch vừa đóng sạch vừa không còn gì để chạy.
 */
export function epochStopReason(events: readonly SessionEvent[]): SubagentResult['stopReason'] {
  const { end, droppedUnrun } = foldConsumedWork(events);
  // ADR 000d (08/11/2026 dev-1): ban port tra `end.data` kieu `unknown` (kernel thi co kieu) => doc qua mat CAU TRUC tai bien.
  const endReason = (end?.data as unknown as { readonly reason: { readonly kind: string } } | undefined)?.reason;
  switch (endReason?.kind) {
    case 'max-tokens':
      return 'max-tokens';
    case 'aborted':
    case 'interrupted':
      return 'aborted';
    case 'error':
      return 'error';
    // Một lần từ chối trước bước — hook phủ quyết, plugin chính sách — đã bỏ đầu vào mà epoch này đã
    // nhận: việc bị từ chối, không phải đã làm.
    case 'blocked':
      return 'refusal';
    // Kết thúc sạch và không có lượt hạch toán nào dùng chung một quy tắc: epoch đã làm xong phần được
    // giao, trừ khi hàng đợi bị huỷ nói khác.
    case undefined:
    case 'completed':
      return droppedUnrun ? 'aborted' : 'completed';
    /* v8 ignore next 4 -- `forked` chỉ xuất hiện trong lịch sử mồi của constructor, còn hàm này đọc hậu
     * tố thuộc epoch. `TurnEndReason` mở rộng được bằng cách gộp, nên không liệt kê được biến thể backend
     * thêm vào; coi một lý do không gọi được tên là thành công sẽ báo việc đã hỏng thành đã xong. */
    default:
      return 'error';
  }
}

/**
 * Hiển thị mọi giá trị do listener ném mà không để phép ép chuỗi thoát khỏi vùng chặn.
 * Nhận: value — giá trị bất kỳ do listener ném.
 * Trả: chuỗi chẩn đoán `Tên: thông điệp` cho Error, hoặc dạng chuỗi của giá trị, hoặc nhãn dự phòng.
 */
function renderThrown(value: unknown): string {
  try {
    return value instanceof Error ? `${value.name}: ${value.message}` : String(value);
  }
  catch {
    return '<unrenderable thrown value>';
  }
}
