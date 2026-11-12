/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dò con TRỰC TIẾP và con cháu ĐỆ QUY từ danh mục do phiên cha sở hữu; mỗi lượt đọc danh mục
 *      nhả quan sát Session của nó trước khi sang nhánh kế. Port 1:1 lib/types/list-children.js của
 *      @deepseek-ai/dsh-subagent; seam kernel khai theo CẤU TRÚC (không augment module).
 */

import type { Context } from "@deepseek-ai/cordis";
// Chỉ MƯỢN KIỂU: nạp khai báo `sessionQuery` của kernel để `ctx.get('sessionQuery')` giữ đúng kiểu
// như bản gốc (bản gốc không cần dòng này vì CẢ gói nằm trong một chương trình tsc).
import type {} from "@deepseek-ai/dsh-session-query";
import type { SessionId } from "@galaxy-blackhole/gbh-session";

import type { SubagentListEntry } from "./control-types.ts";
import { SubagentError } from "./error.ts";
import type { SubagentCatalogEntry } from "./projection-types.ts";

/** Dòng danh mục con cháu được chuyển tiếp nguyên kiểu từ bản gốc (dùng chung với bề mặt điều khiển). */
export type { SubagentListEntry } from "./control-types.ts";

/** Một con cháu trong danh mục, kèm cha TRỰC TIẾP và khoảng cách cạnh tính từ gốc được hỏi. */
export type SubagentDescendantListEntry = SubagentListEntry & {
  /** Phiên cha mà danh mục của nó chứa con này. */
  readonly parentId: SessionId;
  /** Khoảng cách cạnh tính từ gốc được hỏi; con trực tiếp là `1`. */
  readonly depth: number;
};

/**
 * Khung nhìn chiếu mà phép đọc danh mục cần, khai theo CẤU TRÚC: khoá `subagentCatalog` do
 * `projection-types.ts` của gói khai (bản gốc cộng gộp `SessionProjectionMap` của kernel), nên tệp
 * này KHÔNG augment module nào mà đọc đúng một khoá qua hình dạng dưới đây. Khung nhìn của kernel
 * vẫn gán được vào đây (mọi trường của nó đều đã có mặt), nên không cần phép ép nào.
 */
interface SubagentCatalogProjections {
  /** Giá trị chiếu toàn phần theo từng khoá đã đăng ký. */
  readonly values: {
    /** Khoá chiếu khác của sổ: phép đọc này không chạm tới, nên chỉ cần biết là có. */
    readonly [key: string]: unknown;
    /** Các con trực tiếp theo thứ tự sự kiện của danh mục cha, đã trừ fact thừa kế từ fork. */
    readonly subagentCatalog?: SubagentCatalogEntry[];
  };
}

/**
 * Đọc danh mục BỀN của MỘT phiên cha qua quan sát Session ưu tiên bản đang sống.
 * Nhận: `ctx` — context mang dịch vụ truy vấn Session; `parentSessionId` — phiên cha được hỏi danh
 * mục con trực tiếp; `signal` — huỷ được chuyển tiếp cho lượt quan sát Session.
 * Trả: các dòng con trực tiếp theo đúng thứ tự sự kiện trong danh mục của cha.
 * Ném: {@link SubagentError} mã `SUBAGENT_CONTROL_QUERY_UNAVAILABLE` khi thiếu dịch vụ truy vấn, và
 * mã `SUBAGENT_CONTROL_PROJECTIONS_UNAVAILABLE` khi thiếu phép chiếu `subagentCatalog`.
 */
export async function listChildren(
  ctx: Context,
  parentSessionId: SessionId,
  signal?: AbortSignal,
): Promise<SubagentCatalogEntry[]> {
  const query = ctx.get("sessionQuery");
  if (query === undefined) {
    throw new SubagentError(
      "listing subagents requires the sessionQuery service (load @deepseek-ai/dsh-session-query)",
      "SUBAGENT_CONTROL_QUERY_UNAVAILABLE",
    );
  }
  using parent = await query.observeSession(parentSessionId, {
    ...signal === undefined ? {} : { signal },
  });
  const projections: SubagentCatalogProjections | undefined = parent.projections;
  const entries = projections?.values.subagentCatalog;
  if (entries === undefined) {
    throw new SubagentError(
      "listing subagents requires the registered subagentCatalog projection",
      "SUBAGENT_CONTROL_PROJECTIONS_UNAVAILABLE",
    );
  }
  return entries;
}

/**
 * Duyệt các danh mục cha ĐẾN ĐƯỢC theo thứ tự trước-sau ổn định mà KHÔNG nạp Agent nào.
 * Nhận: `ctx` — context mang kho Session và dịch vụ truy vấn; `rootSessionId` — phiên cha mở đầu
 * lượt duyệt; `signal` — huỷ được kiểm quanh mỗi lượt đọc danh mục.
 * Trả: các con và chẩn đoán nhánh, kèm phiên cha trong danh mục và độ sâu.
 * Ném: {@link SubagentError} mã `SUBAGENT_CONTROL_SESSION_STORE_UNAVAILABLE` khi thiếu kho Session,
 * lỗi của chính phép liệt kê (không phải lỗi đọc danh mục con), và mã `CANCELLED` khi bị huỷ.
 * @see SubagentRuntime.listDescendants for failure and cancellation semantics.
 */
export async function listDescendants(
  ctx: Context,
  rootSessionId: SessionId,
  signal?: AbortSignal,
): Promise<SubagentDescendantListEntry[]> {
  const sessions = ctx.get("sessions");
  if (sessions === undefined) {
    throw new SubagentError(
      "listing subagents requires the session store (load @deepseek-ai/dsh-session)",
      "SUBAGENT_CONTROL_SESSION_STORE_UNAVAILABLE",
    );
  }
  const readChildren = async (id: SessionId): Promise<SubagentCatalogEntry[]> => {
    assertListingNotCancelled(signal);
    let children: SubagentCatalogEntry[];
    try {
      children = await listChildren(ctx, id, signal);
    }
    catch (error) {
      assertListingNotCancelled(signal);
      throw error;
    }
    assertListingNotCancelled(signal);
    return children;
  };
  const stack = (await readChildren(rootSessionId))
    .map(entry => ({ entry, parentId: rootSessionId, depth: 1 }))
    .reverse();
  const visited = new Set<SessionId>([rootSessionId]);
  const result: SubagentDescendantListEntry[] = [];
  for (let position = stack.pop(); position !== undefined; position = stack.pop()) {
    const { entry, parentId, depth } = position;
    if (visited.has(entry.id))
      continue;
    visited.add(entry.id);
    let children: SubagentCatalogEntry[];
    try {
      children = entry.mode === "external" ? [] : await readChildren(entry.id);
    }
    catch (error) {
      if (error instanceof SubagentError)
        throw error;
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      result.push({
        kind: "diagnostic", id: entry.id, parentId, depth,
        reason: code === "SESSION_QUERY_CORRUPT_SESSION" || code === "SESSION_QUERY_SOURCE_CONFLICT"
          ? "corrupt" : "unavailable",
      });
      continue;
    }
    if (entry.mode === "unknown") {
      result.push({ kind: "diagnostic", id: entry.id, parentId, depth, reason: "unsupported" });
    }
    else {
      const { createdAt: _createdAt, ...identity } = entry;
      result.push({
        ...identity, kind: "child", parentId, depth,
        activity: sessions.get(entry.id) === undefined ? "inactive" : "running",
        hasChildren: children.length > 0,
      });
    }
    // Thứ tự sự kiện trong danh mục quyết định anh em; ngăn xếp sẽ thăm con ĐẦU TIÊN ngay sau đây.
    for (const child of [...children].reverse()) {
      stack.push({ entry: child, parentId: entry.id, depth: depth + 1 });
    }
  }
  return result;
}

/**
 * Dừng TOÀN BỘ lượt duyệt khi bên gọi huỷ.
 * Nhận: `signal` — tín hiệu huỷ (có thể vắng).
 * Trả: không; ném {@link SubagentError} mã `CANCELLED` khi tín hiệu đã bị huỷ.
 */
function assertListingNotCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new SubagentError("subagent listing was cancelled", "CANCELLED");
  }
}
