/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Suy dien cay workspace: nhom, danh sach phang, ket qua tim kiem — nguyen hanh vi ban goc
 */

import { owningGroupKey, workspaceLabel } from "./paths.ts";
import { assertNever } from "./shared.ts";
import type { Dyn } from "./runtime.ts";

/**
 * Sap thanh vien da biet theo do moi cua phien.
 * Nhan: sessionIds — thanh vien chinh thuc; summaries — tom tat phien hien co.
 * Tra: thanh vien moi nhat truoc, id lam khoa phan dinh on dinh.
 */
export function orderByRecency(sessionIds: readonly string[], summaries: Record<string, Dyn>): string[] {
  return sessionIds
    .flatMap((id) => {
      const summary = summaries[id];
      if (summary === undefined) return [];
      return [{ id, rank: summary.updatedAt as number }];
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return b.rank - a.rank;
      return a.id < b.id ? -1 : 1;
    })
    .map((member) => member.id);
}

/**
 * Hoa giai thu tu thu cong cua trinh duyet voi thanh vien hien tai cua tai khoan.
 * Nhan: memberIds — thanh vien chinh thuc; savedOrder — thu tu da luu; summaries — metadata phien; rowState — tap ghim/luu tru.
 * Tra: vi tri tuong doi da luu, kem thanh vien moi theo ghim, nguon fork, do moi, roi trang thai luu tru.
 */
export function reconcileManualOrder(memberIds: readonly string[], savedOrder: readonly string[] | undefined, summaries: Record<string, Dyn>, rowState: Dyn): string[] {
  const members = new Map(memberIds.map((id) => [id, id]));
  const included = new Set<string>();
  const ordered: string[] = [];
  for (const key of savedOrder ?? []) {
    const id = members.get(key);
    if (id === undefined || included.has(key)) continue;
    ordered.push(id);
    included.add(key);
  }
  const archived = new Set<string>(rowState?.archivedSessionIds as string[] | undefined);
  const pins: string[] = [];
  for (const sessionId of (rowState?.pinnedSessionIds ?? []) as string[]) {
    const id = members.get(sessionId);
    if (id === undefined || included.has(id) || archived.has(id) || summaries[id] === undefined) continue;
    pins.push(id);
    included.add(id);
  }
  const ordinary: string[] = [];
  const archives: string[] = [];
  for (const id of orderByRecency([...members.values()].filter((candidate) => !included.has(candidate)), summaries)) {
    if (archived.has(id)) archives.push(id);
    else ordinary.push(id);
  }
  const result = [...pins, ...ordered, ...ordinary, ...archives];
  const pending = new Set(ordinary);
  const placeFork = (id: string): void => {
    if (!pending.delete(id)) return;
    const parentId = summaries[id]?.parentId as string | undefined;
    if (parentId === undefined || parentId === id || !result.includes(parentId)) return;
    placeFork(parentId);
    result.splice(result.indexOf(id), 1);
    result.splice(result.indexOf(parentId), 0, id);
  };
  for (const id of [...ordinary].reverse()) placeFork(id);
  return result;
}

/**
 * Giu phien moi tam thoi dang chon len dau mot trong hai thu tu nen.
 * Nhan: order — thu tu theo do moi hoac da hoa giai; currentBlank — phien trong dang chon.
 * Tra: ban sao co phien trong dau va khong trung cho.
 */
export function pinCurrentBlank(order: readonly string[], currentBlank: string | undefined): string[] {
  if (currentBlank === undefined) return [...order];
  return [currentBlank, ...order.filter((id) => id !== currentBlank)];
}

/**
 * Phien thuong thi hien; trong cac phien trong chi phien dang chon hien; con cua subagent do danh muc cha lo.
 * Nhan: session — tom tat phien; current — id phien dang chon; archived — tap da luu tru; archivedFilter — che do loc.
 * Tra: true khi dong nay duoc hien.
 */
export function sessionVisible(session: Dyn, current: string | undefined, archived: Set<string>, archivedFilter: string): boolean {
  if (session.origin === "subagent") return false;
  if (session.blank && session.id !== current) return false;
  switch (archivedFilter) {
    case "default":
      return !archived.has(session.id);
    case "show":
      return true;
    case "only":
      return archived.has(session.id);
    default:
      return assertNever(archivedFilter as never);
  }
}

/**
 * Giu cho trong "phien moi" truoc, roi chia hai phan ghim va thuong ma khong doi thu tu cua tung phan.
 * Nhan: members — danh sach phien; pinned — tap ghim; archived — tap luu tru.
 * Tra: danh sach da sap theo ba phan.
 */
export function sectionMembers(members: readonly Dyn[], pinned: Set<string>, archived: Set<string>): Dyn[] {
  const placeholders: Dyn[] = [];
  const leading: Dyn[] = [];
  const rest: Dyn[] = [];
  for (const member of members) {
    if (member.blank) placeholders.push(member);
    else if (!archived.has(member.id) && pinned.has(member.id)) leading.push(member);
    else rest.push(member);
  }
  return [...placeholders, ...leading, ...rest];
}

/**
 * Tieu de chuan cua mot phien: dong trong tra chuoi rong (trinh render tu dich), phien khong ten tra chuoi rong.
 * Nhan: session — tom tat phien.
 * Tra: tieu de da cat khoang trang.
 */
export function sessionTitle(session: Dyn): string {
  return session.blank ? "" : (session.title?.trim() ?? "");
}

/**
 * Dung mot nhom workspace khong chieu pha he phien vao phan trinh bay.
 * Nhan: key/workspaceId/cwd/createdAt/label — dinh danh nhom; members — phien thanh vien.
 * Tra: nhom da chuan hoa.
 */
export function buildGroup(key: string, workspaceId: string | undefined, cwd: string | undefined, createdAt: number | undefined, label: string, members: readonly Dyn[]): Dyn {
  return { key, workspaceId, cwd, createdAt, label, sessions: [...members] };
}

/**
 * Ap thu tu "chua xep" da luu roi noi them cac phien roi moi theo do moi.
 * Nhan: members — phien roi; stored — thu tu da luu; summaries — metadata phien.
 * Tra: phien da sap.
 */
export function orderedUngrouped(members: readonly Dyn[], stored: readonly string[] | undefined, summaries: Record<string, Dyn>): Dyn[] {
  const byId = new Map(members.map((session) => [session.id as string, session]));
  const order = stored === undefined ? orderByRecency(members.map((session) => session.id as string), summaries) : reconcileManualOrder(members.map((session) => session.id as string), stored, summaries, undefined);
  return order.flatMap((id) => {
    const session = byId.get(id);
    return session === undefined ? [] : [session];
  });
}

/**
 * Nhom phien theo workspace: mot nhom cho moi workspace theo thu tu ben goi, cong mot nhom "chua xep".
 * Nhan: list — anh chup phien; workspaces — workspace theo thu tu host; archived — tap luu tru; archivedFilter — che do loc; ungroupedOrder — thu tu "chua xep".
 * Tra: cac nhom theo thu tu render.
 */
export function groupByWorkspace(list: Dyn, workspaces: readonly Dyn[], archived: Set<string>, archivedFilter: string, ungroupedOrder: readonly string[] | undefined): Dyn[] {
  const current = mainId(list);
  const groups: Dyn[] = [];
  const accounted = new Set<string>();
  for (const workspace of workspaces) {
    const members: Dyn[] = [];
    for (const id of workspace.sessionIds as string[]) {
      const summary = list.byId[id];
      if (summary === undefined) continue;
      accounted.add(id);
      if (!sessionVisible(summary, current, archived, archivedFilter)) continue;
      members.push(summary);
    }
    if (archivedFilter === "only" && members.length === 0) continue;
    groups.push(buildGroup(workspace.workspaceId, workspace.workspaceId, workspace.path, Date.parse(workspace.createdAt), workspace.title, members));
  }
  const stray = (list.ids as string[]).map((id) => list.byId[id]).filter((s: Dyn) => s !== undefined && !accounted.has(s.id) && sessionVisible(s, current, archived, archivedFilter));
  if (stray.length > 0) groups.push(buildGroup("", undefined, undefined, undefined, "", orderedUngrouped(stray, ungroupedOrder, list.byId)));
  return groups;
}

/**
 * Id phien dang giu khung nhin chinh.
 * Nhan: list — anh chup phien.
 * Tra: id phien, hoac undefined.
 */
function mainId(list: Dyn): string | undefined {
  return Object.values(list.byId as Record<string, Dyn>).find((session: Dyn) => (session.retainedBy.mainView ?? 0) > 0)?.id as string | undefined;
}

/**
 * Loai tuong tac dang cho ma giao dien hien duoc.
 * Nhan: kind — loai tuong tac.
 * Tra: chinh `kind` khi thuoc ba loai hien duoc, nguoc lai undefined.
 */
export function visiblePendingKind(kind: string | undefined): "approval" | "plan-review" | "question" | undefined {
  switch (kind) {
    case "approval":
    case "plan-review":
    case "question":
      return kind;
    default:
      return undefined;
  }
}

/**
 * So con subagent dang chay cua mot phien.
 * Nhan: list — anh chup phien; parentId — phien cha; statuses — trang thai theo phien.
 * Tra: so con dang chay.
 */
export function runningChildCount(list: Dyn, parentId: string, statuses: Map<string, Dyn>): number {
  return (
    list.projectionsBySession[parentId]?.values.subagentCatalog?.reduce((count: number, child: Dyn) => count + ((statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true ? 1 : 0), 0) ?? 0
  );
}

/**
 * Chieu mot tom tat phien thanh node cua cay workspace.
 * Nhan: s — tom tat phien; list — anh chup phien; statuses — trang thai theo phien; pinned — tap ghim; archived — tap luu tru.
 * Tra: node da chieu.
 */
export function sessionNode(s: Dyn, list: Dyn, statuses: Map<string, Dyn>, pinned: Set<string>, archived: Set<string>): Dyn {
  const status = statuses.get(s.id);
  const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);
  return {
    id: s.id,
    title: sessionTitle(s),
    blank: s.blank,
    running: status?.running ?? s.running,
    runningSubagentCount: runningChildCount(list, s.id, statuses),
    completed: status?.completionUnread === true,
    pinned: !archived.has(s.id) && pinned.has(s.id),
    archived: archived.has(s.id),
    updatedAt: s.updatedAt,
    ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
  };
}

/**
 * Suy dien cac nhom cua trinh duyet workspace, moi phien la mot dong cap cao.
 * Nhan: list — anh chup phien; workspaces — workspace theo thu tu host; rowState — tap ghim/luu tru + che do loc; statuses — trang thai theo phien; view — mang mo rong cuc bo + thu tu "chua xep".
 * Tra: cac nhom theo thu tu render.
 */
export function deriveGroups(list: Dyn, workspaces: readonly Dyn[], rowState: Dyn, statuses: Map<string, Dyn>, view: { expandedGroups: readonly string[]; ungroupedOrder: readonly string[] | undefined }): Dyn[] {
  const archived = new Set<string>(rowState.archivedSessionIds as string[]);
  const pinned = new Set<string>(rowState.pinnedSessionIds as string[]);
  const expandedGroups = new Set<string>(view.expandedGroups);
  const current = mainId(list);
  const currentGroup = current === undefined ? undefined : owningGroupKey(workspaces, current);
  const groups: Dyn[] = [];
  for (const g of groupByWorkspace(list, workspaces, archived, rowState.archivedFilter, view.ungroupedOrder)) {
    const expanded = expandedGroups.has(g.key);
    groups.push({
      key: g.key,
      workspaceId: g.workspaceId,
      cwd: g.cwd,
      createdAt: g.createdAt,
      label: g.label,
      sessionCount: g.sessions.length,
      expanded,
      containsCurrent: g.key === currentGroup,
      sessions: expanded ? sectionMembers(g.sessions, pinned, archived).map((session: Dyn) => sessionNode(session, list, statuses, pinned, archived)) : [],
    });
  }
  return groups;
}

/**
 * Chon thanh vien day du cua danh sach phang, doc lap voi che do hien phien luu tru.
 * Nhan: list — anh chup phien.
 * Tra: id cac phien thuong da biet, gom ca phien luu tru va chi phien trong dang chon.
 */
export function sessionMemberIds(list: Dyn): string[] {
  return visibleSessionIds(list, [], "show");
}

/**
 * Chon thanh vien hien duoc cua danh sach phang, khong suy dien phan trinh bay hay thu tu.
 * Nhan: list — anh chup phien; archivedSessionIds — tap luu tru; archivedFilter — che do loc.
 * Tra: id cac phien hien duoc theo thu tu danh sach.
 */
export function visibleSessionIds(list: Dyn, archivedSessionIds: readonly string[], archivedFilter: string): string[] {
  const archived = new Set<string>(archivedSessionIds);
  const current = mainId(list);
  return (list.ids as string[]).filter((id) => {
    const s = list.byId[id];
    return s !== undefined && sessionVisible(s, current, archived, archivedFilter);
  });
}

/**
 * Suy dien cac dong cua danh sach phang, voi dong ghim len truoc thu tu duoc cap.
 * Nhan: list — anh chup phien; sessionIds — thanh vien day du theo thu tu da chon; rowState — tap ghim/luu tru + che do loc; statuses — trang thai theo phien.
 * Tra: cac dong phang theo thu tu ba phan.
 */
export function deriveFlat(list: Dyn, sessionIds: readonly string[], rowState: Dyn, statuses: Map<string, Dyn>): Dyn[] {
  const archived = new Set<string>(rowState.archivedSessionIds as string[]);
  const pinned = new Set<string>(rowState.pinnedSessionIds as string[]);
  const current = mainId(list);
  const members = sessionIds.flatMap((id) => {
    const session = list.byId[id];
    return session !== undefined && sessionVisible(session, current, archived, rowState.archivedFilter) ? [session] : [];
  });
  return sectionMembers(members, pinned, archived).map((session) => sessionNode(session, list, statuses, pinned, archived));
}

/**
 * Gop ket qua khop tieu de/workspace voi ket qua khop noi dung tu host.
 * Nhan: list — metadata phien; workspaces — thanh vien + nhan workspace; query — van ban nguoi dung; archivedSessionIds — tap luu tru; archivedFilter — che do loc; statuses — trang thai; content — trang ket qua noi dung; limit — so dong toi da.
 * Tra: { items, hasMore } — dong da khu trung va co bao con ket qua.
 */
export function deriveSearchResults(list: Dyn, workspaces: readonly Dyn[], query: string, archivedSessionIds: readonly string[], archivedFilter: string, statuses: Map<string, Dyn>, content: Dyn, limit: number): { items: Dyn[]; hasMore: boolean } {
  const q = query.trim().toLowerCase();
  if (q === "") return { items: [], hasMore: false };
  const archived = new Set<string>(archivedSessionIds);
  const current = mainId(list);
  const workspaceBySession = new Map<string, string>();
  for (const workspace of workspaces) for (const sessionId of workspace.sessionIds as string[]) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title);
  const labelOf = (summary: Dyn): string => workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd);
  const contentBySession = new Map<string, Dyn>();
  for (const item of content.items as Dyn[]) if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item);
  const local: Dyn[] = [];
  for (const id of list.ids as string[]) {
    const summary = list.byId[id];
    if (summary === undefined || summary.blank || !sessionVisible(summary, current, archived, archivedFilter)) continue;
    if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
  }
  const localById = new Map(local.map((summary) => [summary.id as string, summary]));
  const orderedLocal = orderByRecency(local.map((summary) => summary.id as string), list.byId).map((id) => localById.get(id));
  const ordered: Dyn[] = [];
  const included = new Set<string>();
  const include = (summary: Dyn): void => {
    if (included.has(summary.id)) return;
    included.add(summary.id);
    ordered.push(summary);
  };
  for (const summary of orderedLocal) if (summary !== undefined) include(summary);
  for (const item of content.items as Dyn[]) {
    const summary = list.byId[item.sessionId];
    if (summary !== undefined && !summary.blank && sessionVisible(summary, current, archived, archivedFilter)) include(summary);
  }
  return {
    items: ordered.slice(0, limit).map((summary) => {
      const match = contentBySession.get(summary.id);
      const status = statuses.get(summary.id);
      const pendingInteraction = visiblePendingKind(status?.pendingInteraction?.kind);
      return {
        id: summary.id,
        title: sessionTitle(summary),
        workspace: labelOf(summary),
        running: status?.running ?? summary.running,
        runningSubagentCount: runningChildCount(list, summary.id, statuses),
        ...(pendingInteraction === undefined ? {} : { pendingInteraction }),
        completed: status?.completionUnread === true,
        archived: archived.has(summary.id),
        ...(match === undefined ? {} : { snippet: match.snippet }),
      };
    }),
    hasMore: content.hasMore === true || ordered.length > limit,
  };
}
