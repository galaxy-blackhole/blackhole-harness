/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc UiWorkspaceService — nghiep vu workspace + CHINH SACH DIEU HUONG (khoi phuc phien cu, tao workspace mac dinh) nguyen hop dong ban goc
 */

import { SESSIONS_CURRENT_STORAGE_KEY } from "./persist-migration.ts";
import { pinOrderAccounts, pinOrderSource, type WorkspaceViewActions } from "./stores.ts";
import { ext, type Dyn } from "./runtime.ts";

/** Loi boc tu lop RPC cua buoc chon thu muc. */
export class DirectoryBrowseError extends Error {
  /** Loi RPC goc. */
  rpcError: Dyn;
  /**
   * Dung loi boc.
   * Nhan: rpcError — loi RPC goc.
   * Tra: doi tuong loi.
   */
  constructor(rpcError: Dyn) {
    super("directory browse failed: " + String(rpcError?.code) + ": " + String(rpcError?.message));
    this.rpcError = rpcError;
    this.name = "DirectoryBrowseError";
  }
}

/**
 * Nghiệp vụ workspace của nửa client: chọn thư mục, mở phiên, ghim, lưu trữ, fork.
 * Được đăng ký thành service `uiWorkspace` để các row khác inject (ví dụ ui-subagent).
 * Nhận: không (không có đầu vào — các seam được truyền qua constructor của lớp trả về).
 * @returns lớp service `UiWorkspaceService` (constructor nhận ctx · directoryPicker · workspaces · sessions · view · notify).
 */
export function createUiWorkspaceServiceClass(): new (ctx: Dyn, directoryPicker: Dyn, workspaces: Dyn, sessions: Dyn, view: WorkspaceViewActions, notify: (toast: Dyn) => void) => Dyn {
  class UiWorkspaceService extends ext.cordis.Service {
  /** Nhom RPC chon thu muc cua host. */
  directoryPicker: Dyn;
  /** Dich vu workspace cua host. */
  workspaces: Dyn;
  /** Dich vu phien cua host. */
  sessions: Dyn;
  /** Bo hanh dong cua kho xem. */
  view: WorkspaceViewActions;
  /** Ham bao mot thong bao len thanh toast cua row. */
  notify: (toast: Dyn) => void;
  /**
   * Lan ket noi dang chay cua tung workspace — mot yeu cau chi nhap chung khi CA HAI cung ten preset.
   * ⚠️ 18/10/2026: thieu ban do nay ⇒ bam "phien moi" lien tuc tao nhieu phien trong cung workspace.
   */
  connecting = new Map<string, { agentPreset: Dyn; attempt: Promise<string> }>();
  /** Vong doi cua service. */
  lifetime = new AbortController();
  /**
   * Lua chon phien dang giu khung nhin chinh, GHI NHO qua cac lan boot (persist "gbh.sessions.current";
   * bản gốc dùng khoá cũ dsh.sessions.current — migration MỘT LẦN ở plugin.apply, xem persist-migration.ts).
   * ⚠️ 18/10/2026: thieu kho nay ⇒ `restoreSelection` khong biet phien nao de mo lai ⇒ app quen phien.
   */
  selection = ext.store.createSnapshotStore({}, { persist: { name: SESSIONS_CURRENT_STORAGE_KEY } });
  /** Phien dang giu khung nhin chinh. */
  mainReference: Dyn;

  /**
   * Dung service.
   * Nhan: ctx — context goc; directoryPicker/workspaces/sessions — seam cua host; view — bo hanh dong kho xem; notify — kenh thong bao.
   * Tra: doi tuong service.
   */
  constructor(ctx: Dyn, directoryPicker: Dyn, workspaces: Dyn, sessions: Dyn, view: WorkspaceViewActions, notify: (toast: Dyn) => void) {
    super(ctx, "uiWorkspace");
    this.directoryPicker = directoryPicker;
    this.workspaces = workspaces;
    this.sessions = sessions;
    this.view = view;
    this.notify = notify;
    // ⚠️ 18/10/2026 — NOI THIEU LON NHAT cua lan port truoc: vong doi nay KHONG duoc dang ky.
    //   Ban goc mo phien da luu (hoac tao WORKSPACE MAC DINH khi may sach) o day. Thieu no ⇒ host
    //   KHONG co workspace nao ⇒ khung `sidebar.workspaces` ve trang thai RONG, khung giua chi con
    //   man trong ⇒ #root 41.266 thay vi 58.588 TRONG LAB, 0 loi console (mat noi dung AM THAM).
    ctx.effect(() => {
      const stop = this.watchNavigation();
      return () => {
        stop();
        this.lifetime.abort();
        const reference = this.mainReference;
        this.mainReference = undefined;
        reference?.release();
      };
    }, "ui-workspace: Workspace navigation policy");
  }

  /**
   * Mo phien cua mot workspace qua duong ket noi chuan (co gop lan ket noi dang chay).
   * Nhan: workspaceId — workspace dich; options — { agentPreset }.
   * Tra: promise id phien.
   */
  connectWorkspace(workspaceId: string, options: Dyn = {}): Promise<string> {
    return this.connectBlank(workspaceId, options);
  }

  /**
   * Tao hoac tai dung mot phien trong cua workspace.
   * Nhan: workspaceId — workspace dich; reuse — { agentPreset } cua lan dung lai (khong co thi tao phien moi).
   * Tra: promise id phien.
   */
  async connectBlank(workspaceId: string, reuse?: Dyn): Promise<string> {
    const workspace = this.workspaces.list.getSnapshot().items.find((item: Dyn) => item.workspaceId === workspaceId);
    if (workspace === undefined) throw new Error("uiWorkspace.connectWorkspace: unknown workspace " + workspaceId);
    if (reuse === undefined) return this.sessions.create({ workspaceId });
    const inflight = this.connecting.get(workspaceId);
    if (inflight !== undefined && inflight.agentPreset === reuse.agentPreset) return inflight.attempt;
    const attempt = this.createInWorkspace(workspace, reuse).finally(() => {
      if (this.connecting.get(workspaceId)?.attempt === attempt) this.connecting.delete(workspaceId);
    });
    this.connecting.set(workspaceId, { agentPreset: reuse.agentPreset, attempt });
    return attempt;
  }

  /**
   * Tao phien trong workspace theo preset: tai dung phien TRONG da co trong workspace neu con dung duoc.
   * Nhan: workspace — ban ghi workspace; options — { agentPreset }.
   * Tra: promise id phien.
   */
  createInWorkspace(workspace: Dyn, options: Dyn): Promise<string> {
    const archived = this.workspaces.list.getSnapshot().archivedSessionIds;
    const sessions = this.sessions.list.getSnapshot();
    const blank = sessions.ids.find((id: string) => {
      const summary = sessions.byId[id];
      return summary !== undefined && summary.blank === true && summary.cwd === workspace.path && workspace.sessionIds.includes(id) && !archived.includes(id);
    });
    return this.createNamed({
      workspaceId: workspace.workspaceId,
      ...(blank === undefined ? {} : { sessionId: blank }),
      ...(options.agentPreset === undefined ? {} : { agentPreset: options.agentPreset }),
    });
  }

  /**
   * Tao phien qua host; nap lai phan chieu khi host TU CHOI ten phien trong da dat.
   * Nhan: request — { workspaceId, sessionId?, agentPreset? }.
   * Tra: promise id phien.
   */
  async createNamed(request: Dyn): Promise<string> {
    const sessionId = await this.sessions.create(request);
    const named = request.sessionId;
    if (named !== undefined && named !== sessionId) {
      this.sessions.refreshProjections(named).catch((reason: unknown) => {
        console.warn("declined blank Session projection reload failed:", reason);
      });
    }
    return sessionId;
  }

  /**
   * Mo lai mot phien TRONG da luu theo preset ma nhat ky cua no ghi, hoac theo mac dinh cua host khi preset khong con.
   * Nhan: workspaceId — workspace chua phien; sessionId — phien trong can mo lai.
   * Tra: promise id phien.
   */
  async restoreBlank(workspaceId: string, sessionId: string): Promise<string> {
    await this.sessions.refreshProjections(sessionId);
    const recorded = this.sessions.list.getSnapshot().byId[sessionId]?.projectionValues?.agentPreset;
    const request = { workspaceId, sessionId };
    if (typeof recorded !== "string") return this.createNamed(request);
    try {
      return await this.createNamed({ ...request, agentPreset: recorded });
    } catch (error) {
      const code = sessionCreateErrorOf(error)?.rpcError.code;
      if (code !== "agent-preset/not-found" && code !== "agent-preset/invalid") throw error;
      return this.createNamed(request);
    }
  }

  /**
   * Mo mot phien (hoac dia chi subagent) vao khung nhin chinh.
   * Nhan: target — id phien hoac dia chi subagent.
   * Tra: khong co.
   */
  openSession(target: Dyn): void {
    this.replaceMain(target, this.lifetime.signal, "reveal");
  }

  /**
   * Mo mot workspace: tao (hoac tai dung) phien trong roi mo vao khung nhin chinh.
   * Nhan: workspaceId — workspace dich; beforeOpen — hook truoc khi mo; options — { agentPreset }.
   * Tra: promise hoan tat.
   */
  openWorkspace(workspaceId: string, beforeOpen?: Dyn, options: Dyn = {}): Promise<void> {
    return this.openWorkspaceSession(workspaceId, beforeOpen, options);
  }

  /**
   * Mo phien cua mot workspace qua buoc tao phien trong.
   * Nhan: workspaceId — workspace dich; beforeOpen — hook truoc khi mo; reuse — { agentPreset } cua lan dung lai.
   * Tra: promise hoan tat.
   */
  async openWorkspaceSession(workspaceId: string, beforeOpen?: Dyn, reuse?: Dyn): Promise<void> {
    const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
    let sessionId: string;
    try {
      sessionId = await this.connectBlank(workspaceId, reuse);
    } catch (error) {
      if (!navigation.aborted) this.notify({ kind: "createFailed", message: creationFailureMessage(error) });
      throw error;
    }
    if (navigation.aborted) return;
    this.replaceMain(sessionId, navigation, "reveal", beforeOpen);
  }

  /**
   * Mo mot phien cua workspace theo y nguoi dung (nut tao phien): bao loi tao phien qua toast.
   * Nhan: workspaceId — workspace dich; options — { clearPreviousDraft, prompt, agentPreset, ... }.
   * Tra: khong co.
   */
  startSession(workspaceId: string | undefined, options?: Dyn): void {
    const { agentPreset, ...draft } = options ?? {};
    const draftOptions = options === undefined ? undefined : draft;
    const initializeDraft = draftOptions !== undefined && (draftOptions.prompt !== undefined || draftOptions.clearPreviousDraft === true);
    const workspace = this.workspaces.list.getSnapshot();
    const sessions = this.sessions.list.getSnapshot();
    const current = this.mainReference?.sessionId as string | undefined;
    const currentWorkspaceId = current === undefined ? undefined : workspace.items.find((item: Dyn) => (item.sessionIds as string[]).includes(current))?.workspaceId;
    const recent = workspace.phase === "ready" && sessions.phase === "ready" ? recentWorkspace(workspace.items, sessions.byId) : undefined;
    const target = workspaceId ?? currentWorkspaceId ?? recent;
    if (target === undefined) {
      if (initializeDraft) {
        this.notify({ kind: "createFailed", message: this.ctx.locale.bind("workspace")("draft.workspaceRequired") });
        return;
      }
      this.clearMain();
      return;
    }
    const opened = draftOptions === undefined
      ? this.openWorkspaceSession(target, undefined, undefined)
      : this.openWorkspace(target, initializeDraft ? (id: string) => {
          const binding = this.sessions.binding(id);
          if (binding === undefined) this.draftPreparationFailed();
          this.prepareDraft(binding, draftOptions);
        } : undefined, agentPreset === undefined ? {} : { agentPreset });
    opened.catch((reason: unknown) => {
      console.warn("new session failed:", reason);
    });
  }

  /**
   * Xin kho soan thao cua phien trong khoi tao ban nhap da yeu cau.
   * Nhan: binding — binding cua phien; options — { prompt, clearPreviousDraft }.
   * Tra: khong co.
   */
  prepareDraft(binding: Dyn, options: Dyn): void {
    const conversation = this.ctx.get("conversation");
    if (conversation === undefined) this.draftPreparationFailed();
    if (conversation.input.requestDraftInitialization(binding, options) === "blocked") this.draftPreparationFailed();
  }

  /**
   * Bao mot lan khoi tao ban nhap that bai roi nem loi.
   * Nhan: khong co.
   * Tra: khong co (luon nem).
   */
  draftPreparationFailed(): never {
    const message = this.ctx.locale.bind("workspace")("draft.initializationFailed");
    this.notify({ kind: "createFailed", message });
    throw new Error(message);
  }

  /**
   * Fork mot phien, kem tang tieu de va tuy chon cho phep migration.
   * Nhan: sessionId — phien nguon; onCreated — hook khi con duoc tao; options — { allowMigration }.
   * Tra: promise ket qua fork cua host.
   */
  async forkSession(sessionId: string, onCreated?: Dyn, options?: Dyn): Promise<Dyn> {
    return this.sessions.fork({
      sessionId,
      increaseTitle: true,
      ...(onCreated === undefined ? {} : { onCreated }),
      ...(options?.allowMigration === undefined ? {} : { allowMigration: options.allowMigration }),
    });
  }

  /**
   * Luu tru mot phien (co the dung hoat dong dang chay truoc); dong luon khung nhin neu dang mo chinh no.
   * Nhan: sessionId — phien; options — { stopActivity }.
   * Tra: promise hoan tat.
   */
  async archiveSession(sessionId: string, options: Dyn = {}): Promise<void> {
    await this.workspaces.archiveSession(sessionId, options);
    if (this.mainReference?.sessionId === sessionId) this.clearMain();
  }

  /**
    * Bo luu tru mot phien.
   * Nhan: sessionId — phien.
   * Tra: promise hoan tat.
   */
  async unarchiveSession(sessionId: string): Promise<void> {
    await this.workspaces.unarchiveSession(sessionId);
  }

  /**
   * Ghim mot phien va cap nhat thu tu ghim cua cac tai khoan lien quan.
   * Nhan: sessionId — phien.
   * Tra: promise hoan tat.
   */
  async pinSession(sessionId: string): Promise<void> {
    await this.workspaces.pinSession(sessionId);
    const { items, pinnedSessionIds, archivedSessionIds } = this.workspaces.list.getSnapshot();
    this.view.pinSessionOrder(sessionId, pinOrderAccounts(items, sessionId), pinOrderSource(items, this.sessions.list.getSnapshot(), { pinnedSessionIds, archivedSessionIds }));
  }

  /**
   * Bo ghim mot phien.
   * Nhan: sessionId — phien.
   * Tra: promise hoan tat.
   */
  async unpinSession(sessionId: string): Promise<void> {
    await this.workspaces.unpinSession(sessionId);
  }

  /**
   * Mo hop chon thu muc cua host.
   * Nhan: khong co.
   * Tra: duong dan da chon, hoac undefined khi nguoi dung huy.
   */
  async pickDirectory(): Promise<string | undefined> {
    const result = await this.directoryPicker.pick();
    if (!result.ok) throw new DirectoryBrowseError(result.error);
    return result.value;
  }

  /**
   * Liet ke noi dung mot thu muc cua host.
   * Nhan: path — thu muc; signal — tin hieu huy.
   * Tra: ket qua liet ke.
   */
  async listDirectory(path: string, signal?: AbortSignal): Promise<Dyn> {
    const result = await this.directoryPicker.list(path, signal);
    if (!result.ok) throw new DirectoryBrowseError(result.error);
    return result.value;
  }

  /**
   * Tao thu muc con trong mot thu muc cua host.
   * Nhan: path — thu muc cha; name — ten thu muc moi.
   * Tra: duong dan thu muc vua tao.
   */
  async createDirectory(path: string, name: string): Promise<Dyn> {
    const result = await this.directoryPicker.createDirectory(path, name);
    if (!result.ok) throw new DirectoryBrowseError(result.error);
    return result.value;
  }

  /**
   * Theo doi trang thai host va MO PHIEN KHOI DONG: mo lai phien da luu, hoac tao workspace mac dinh khi may sach.
   * Nhan: khong co.
   * Tra: ham go theo doi (huy vong doi + bo dang ky).
   */
  watchNavigation(): () => void {
    let initial = "waiting";
    const reconcile = (): void => {
      if (this.lifetime.signal.aborted) return;
      if (this.clearArchivedCurrent()) return;
      if (initial !== "waiting") return;
      const workspace = this.workspaces.list.getSnapshot();
      const sessions = this.sessions.list.getSnapshot();
      if (workspace.phase !== "ready" || sessions.phase !== "ready") return;
      if (this.mainReference !== undefined) {
        initial = "done";
        return;
      }
      initial = "connecting";
      this.restoreSelection(workspace, sessions).then(() => {
        initial = "done";
      }, (reason: unknown) => {
        if (this.lifetime.signal.aborted) return;
        initial = "waiting";
        console.warn("initial Session restoration failed:", reason);
      });
    };
    const disposeWorkspaces = this.workspaces.list.subscribe(reconcile);
    const disposeSessions = this.sessions.list.subscribe(reconcile);
    reconcile();
    return () => {
      this.lifetime.abort();
      disposeSessions();
      disposeWorkspaces();
    };
  }

  /**
   * Chon phien khoi dong: phien da luu, phien gan nhat cua workspace, hoac workspace mac dinh vua tao.
   * Nhan: workspaces — anh chup danh sach workspace; sessions — anh chup danh sach phien.
   * Tra: promise hoan tat.
   */
  async restoreSelection(workspaces: Dyn, sessions: Dyn): Promise<void> {
    const saved = this.selection.getSnapshot();
    if (saved.subagentAddress !== undefined) {
      this.replaceMain(saved.subagentAddress, this.lifetime.signal, "preserve");
      return;
    }
    const summary = saved.sessionId === undefined ? undefined : sessions.byId[saved.sessionId];
    const workspace = summary === undefined ? undefined : workspaces.items.find((item: Dyn) => (item.sessionIds as string[]).includes(summary.id));
    if (summary !== undefined && (summary.blank !== true || workspace === undefined)) {
      this.replaceMain(summary.id, this.lifetime.signal, "preserve");
      return;
    }
    const navigation = AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]);
    let sessionId: string | undefined;
    if (summary !== undefined && workspace !== undefined && summary.cwd === workspace.path && !workspaces.archivedSessionIds.includes(summary.id)) {
      sessionId = await this.restoreBlank(workspace.workspaceId, summary.id);
    }
    let target = workspace?.workspaceId ?? recentWorkspace(workspaces.items, sessions.byId);
    if (target === undefined && workspaces.items.length === 0 && sessions.ids.length === 0) {
      const prepared = await this.initializeDefaultWorkspace(navigation);
      if (navigation.aborted) return;
      target = prepared?.workspaceId;
    }
    if (sessionId === undefined && target !== undefined) sessionId = await this.connectWorkspace(target);
    if (sessionId !== undefined && !navigation.aborted) this.replaceMain(sessionId, navigation, "preserve");
  }

  /**
   * Tao workspace mac dinh cua may sach; that bai thi bao toast chu khong nem.
   * Nhan: signal — tin hieu huy cua lan dieu huong.
   * Tra: ban ghi workspace vua tao, hoac undefined khi that bai.
   */
  async initializeDefaultWorkspace(signal: AbortSignal): Promise<Dyn> {
    try {
      return await this.workspaces.initializeDefault(signal);
    } catch (_error) {
      if (!signal.aborted) this.notify({ kind: "defaultWorkspaceFailed" });
      return undefined;
    }
  }

  /**
   * Xoa lua chon hien hanh neu phien dang giu khung nhin da bi luu tru.
   * Nhan: khong co.
   * Tra: true khi da xoa.
   */
  clearArchivedCurrent(): boolean {
    const current = this.mainReference?.sessionId as string | undefined;
    if (current === undefined || !this.workspaces.list.getSnapshot().archivedSessionIds.includes(current)) return false;
    this.clearMain();
    return true;
  }

  /**
   * Id workspace dang chua phien giu khung nhin chinh (neu co).
   * Nhan: khong co.
   * Tra: id workspace, hoac undefined.
   */
  currentWorkspaceId(): string | undefined {
    const current = this.mainReference?.sessionId as string | undefined;
    if (current === undefined) return undefined;
    return this.workspaces.list.getSnapshot().items.find((item: Dyn) => (item.sessionIds as string[]).includes(current))?.workspaceId;
  }

  /**
   * Xoa lua chon hien hanh va tra phien giu khung nhin chinh ve host.
   * Nhan: khong co.
   * Tra: khong co.
   */
  clearMain(): void {
    const previous = this.mainReference;
    this.mainReference = undefined;
    this.selection.set({});
    previous?.release();
    this.ctx.layout.selectPanel(null);
  }

  /**
   * Thay phien giu khung nhin chinh: giu tham chieu moi, GHI NHO lua chon, roi nha tham chieu cu.
   * Nhan: target — id phien hoac dia chi subagent; signal — tin hieu huy; panel — "reveal" de dong panel, "preserve" de giu; beforeOpen — hook truoc khi mo.
   * Tra: khong co.
   */
  replaceMain(target: Dyn, signal: AbortSignal, panel: string, beforeOpen?: Dyn): void {
    signal.throwIfAborted();
    const reference = this.sessions.retain(target, { source: "mainView" });
    try {
      signal.throwIfAborted();
      beforeOpen?.(reference.sessionId);
      if (signal.aborted) {
        reference.release();
        return;
      }
      const subagentAddress = typeof target === "string" ? this.sessions.subagentAddress(reference.sessionId) : target;
      this.selection.set({
        sessionId: reference.sessionId,
        ...(subagentAddress === undefined ? {} : { subagentAddress }),
      });
    } catch (error) {
      reference.release();
      throw error;
    }
    const previous = this.mainReference;
    this.mainReference = reference;
    previous?.release();
    if (panel === "reveal") this.ctx.layout.selectPanel(null);
  }
  }
  return UiWorkspaceService;
}

/**
 * Workspace gan nhat theo thoi diem cap nhat phien; khong co phien thi lay `createdAt` cua workspace.
 * Nhan: workspaces — danh sach workspace cua host; sessions — ban do phien theo id.
 * Tra: id workspace gan nhat, hoac undefined khi khong co workspace nao.
 */
export function recentWorkspace(workspaces: Dyn[], sessions: Dyn): string | undefined {
  let selected: string | undefined;
  let selectedTime = Number.NEGATIVE_INFINITY;
  for (const workspace of workspaces) {
    let latest = Number.NEGATIVE_INFINITY;
    for (const sessionId of workspace.sessionIds as string[]) {
      const session = sessions[sessionId];
      if (session !== undefined) latest = Math.max(latest, session.updatedAt as number);
    }
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt as string);
    if (selected === undefined || latest > selectedTime) {
      selected = workspace.workspaceId as string;
      selectedTime = latest;
    }
  }
  return selected;
}

/**
 * Loi tao phien cua Session Controller, hoac undefined khi khong phai loi do.
 * Nhan: error — loi bat duoc.
 * Tra: loi tao phien, hoac undefined.
 */
export function sessionCreateErrorOf(error: unknown): Dyn {
  return error instanceof Error && error.name === "SessionCreateError" ? error : undefined;
}

/**
 * Cau chu bao mot lan tao phien that bai: loi tu host giu nguyen ma va thong diep.
 * Nhan: error — loi bat duoc.
 * Tra: chuoi thong bao.
 */
export function creationFailureMessage(error: unknown): string {
  const refused = sessionCreateErrorOf(error);
  if (refused !== undefined) return String(refused.rpcError.code) + ": " + String(refused.rpcError.message);
  return error instanceof Error ? error.message : String(error);
}
