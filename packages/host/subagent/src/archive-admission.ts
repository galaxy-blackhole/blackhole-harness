/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Họ `subagent` của phép nhận lưu trữ trong sổ workspace: con cháu subagent nào của một phiên
 *      còn đang trong một lượt, và chúng dừng thế nào khi phiên bị lưu trữ cùng công việc của nó. Port
 *      1:1 lib/types/archive-admission.js của @deepseek-ai/dsh-subagent; seam kernel khai theo CẤU TRÚC.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@galaxy-blackhole/gbh-agent";
// Chỉ MƯỢN KIỂU: nạp khai báo `sessionQuery` của kernel để `ctx.get('sessionQuery')` giữ đúng kiểu
// như bản gốc (bản gốc không cần dòng này vì CẢ gói nằm trong một chương trình tsc).
import type {} from "@deepseek-ai/dsh-session-query";
import type { SessionId } from "@galaxy-blackhole/gbh-session";
import type { SessionActivity } from "@galaxy-blackhole/gbh-workspace";

import { foldSubagentDescriptor } from "./descriptor.ts";

/** Một mục hoạt động của họ `subagent`: danh tính con, kèm nhãn tạo BỀN khi descriptor đọc được. */
interface SubagentActivityItem {
  /** Id phiên của con (nguyên văn hình dạng mục hoạt động của sổ workspace). */
  readonly id: string;
  /** Nhãn tạo bền của con, khi có. */
  readonly label?: string;
}

/** Họ hoạt động `subagent` mà listener của tệp này CHÈN vào waterfall nhận lưu trữ. */
interface SubagentActivity {
  /** Tên họ hoạt động (nguyên văn). */
  readonly kind: "subagent";
  /** Các con cháu đang chạy, mỗi con một mục. */
  readonly items: readonly SubagentActivityItem[];
}

/** Payload của hai kênh nhận lưu trữ mà tệp này nghe: phiên đang được hỏi/đang bị lưu trữ. */
interface ArchiveAdmissionRequest {
  /** Phiên sắp được ghi vào sổ lưu trữ. */
  readonly sessionId: SessionId;
}

/**
 * Hai mối nối sự kiện của sổ workspace, khai theo CẤU TRÚC: bản gốc gọi thẳng `ctx.on` với bảng
 * `Events` đã được kernel augment, còn họ hoạt động `subagent` lại do `control-types.ts` của gói
 * augment vào `SessionActivityKindMap`. Tệp này KHÔNG augment module nào, nên nó khai đúng hai mối
 * nối nó dùng; hình dạng dưới đây nhận được listener của kernel mà không cần phép ép nào.
 */
interface ArchiveAdmissionSeam {
  /**
   * Nghe waterfall hỏi "phiên còn hoạt động gì".
   * Nhận: `event` — tên kênh; `listener` — hàm chèn họ `subagent` vào kết quả của `next()`.
   * Trả: hàm dọn gỡ listener (giá trị dọn của cordis).
   */
  on(
    event: "workspace/session-activity",
    listener: (
      payload: ArchiveAdmissionRequest,
      next: () => Promise<readonly SessionActivity[]>,
    ) => Promise<readonly (SubagentActivity | SessionActivity)[]>,
  ): unknown;
  /**
   * Nghe sự kiện "phiên đã bị lưu trữ, hãy dừng công việc của nó".
   * Nhận: `event` — tên kênh; `listener` — hàm huỷ mọi con cháu đang chạy.
   * Trả: hàm dọn gỡ listener (giá trị dọn của cordis).
   */
  on(
    event: "workspace/session-stop",
    listener: (payload: ArchiveAdmissionRequest) => void,
  ): unknown;
}

/**
 * Trả lời `workspace/session-activity` bằng các con cháu subagent ĐANG CHẠY của phiên được hỏi, và
 * `workspace/session-stop` bằng cách huỷ từng con đúng như phiên cha của nó sẽ làm. Cả hai listener
 * sống cùng fiber của `ctx`.
 * Nhận: `ctx` — context mang sổ đăng ký Agent; dịch vụ truy vấn Session là TUỲ CHỌN và chỉ dùng để
 * lấy nhãn.
 * Trả: không.
 */
export function installSubagentArchiveAdmission(ctx: Context): void {
  const seam: ArchiveAdmissionSeam = ctx;
  seam.on("workspace/session-activity", async ({ sessionId }, next) => {
    const running = runningDescendants(ctx, sessionId);
    const rest = await next();
    if (running.length === 0)
      return rest;
    const own: SubagentActivity = { kind: "subagent", items: await Promise.all(running.map(child => describe(ctx, child))) };
    return [own, ...rest];
  });
  seam.on("workspace/session-stop", ({ sessionId }) => {
    for (const child of runningDescendants(ctx, sessionId)) {
      try {
        child.cancel({ kind: "parent" });
      }
      catch (error) {
        // Một con từ chối lần huỷ của nó KHÔNG được giữ anh em nó chạy tiếp cho một cha đã lưu trữ.
        ctx.logger.warn(`subagent: cancelling "${child.id}" for an archived Session failed: ${String(error)}`);
      }
    }
  });
}

/**
 * Các con cháu subagent ĐANG SỐNG trong một lượt, theo dòng dõi BỀN: một con có header nêu cha của nó
 * và mang origin subagent mà gói này ghi, ở BẤT KỲ độ sâu nào. Một fork chia sẻ trường dòng dõi mà
 * KHÔNG có origin và là một cuộc hội thoại độc lập, nên nó không bao giờ giữ nguồn của nó. Dòng dõi
 * được đọc như DỮ LIỆU, nên một chuỗi header hỏng tạo vòng lặp vẫn chỉ được thăm một lần.
 * Nhận: `ctx` — context mang sổ đăng ký Agent; `rootId` — phiên gốc của lượt duyệt.
 * Trả: các Agent đang chạy thuộc dòng dõi đó, theo thứ tự duyệt chiều rộng.
 */
function runningDescendants(ctx: Context, rootId: SessionId): Agent[] {
  const childrenOf = new Map<SessionId, Agent[]>();
  for (const agent of ctx.agents.list()) {
    const { parentSession, origin } = agent.session.header;
    if (parentSession === undefined || origin !== "subagent")
      continue;
    const siblings = childrenOf.get(parentSession) ?? [];
    // ADR 000d (08/11/2026 dev-1): `ctx.agents.list()` trả `Agent` của KERNEL, còn sổ ở đây giữ `Agent` của gói GBH
    // (hai kiểu khác danh tính, CÙNG hình dạng runtime) ⇒ ép MỘT chỗ tại biên.
    siblings.push(agent as unknown as Agent);
    childrenOf.set(parentSession, siblings);
  }
  const running: Agent[] = [];
  const pending: SessionId[] = [rootId];
  const visited = new Set<SessionId>();
  while (pending.length > 0) {
    const parentId = pending.shift();
    // Điều kiện vòng lặp đã bảo đảm ngăn xếp còn phần tử; đây chỉ là thu hẹp kiểu của `shift()`.
    if (parentId === undefined)
      break;
    if (visited.has(parentId))
      continue;
    visited.add(parentId);
    for (const child of childrenOf.get(parentId) ?? []) {
      if (child.status === "running")
        running.push(child);
      pending.push(child.id as unknown as SessionId);
    }
  }
  return running;
}

/**
 * Mục hoạt động của một con: id của nó, cộng nhãn tạo BỀN mà descriptor của nó mang, đọc qua một lượt
 * quan sát Session ưu tiên bản đang sống. Không có dịch vụ truy vấn Session, hoặc descriptor vắng hay
 * không đọc được, thì mục chỉ nêu con bằng id.
 * Nhận: `ctx` — context mang dịch vụ truy vấn (tuỳ chọn); `child` — Agent con đang chạy.
 * Trả: mục hoạt động (id, kèm nhãn khi đọc được).
 */
async function describe(ctx: Context, child: Agent): Promise<SubagentActivityItem> {
  const query = ctx.get("sessionQuery");
  if (query === undefined)
    return { id: child.id };
  try {
    // `child.id` là chuỗi id của gói GBH; seam truy vấn của kernel nhận `SessionId` (brand) ⇒ ép tại biên.
    using observation = await query.observeSession(child.id as unknown as SessionId, { projectionMode: "none" });
    const label = foldSubagentDescriptor(observation.events.slice(observation.inheritedEventCount))?.label;
    return label === undefined ? { id: child.id } : { id: child.id, label };
  }
  catch {
    // Descriptor hỏng là dữ liệu hỏng trong CON; báo cáo vẫn nêu tên con.
    return { id: child.id };
  }
}
