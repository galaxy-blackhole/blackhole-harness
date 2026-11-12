/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai bo dieu khien cua row: danh muc ung dung thu muc (HTTP) va duong dan tep (Remote)
 */

import { APP_LABEL_KEY } from "./applications.ts";
import { OPEN_IN_APP_CHOICE_KEY, migrateOpenInAppChoiceKey } from "./persist-migration.ts";
import { ROUTE_APPS, ROUTE_OPEN } from "./ids.ts";
import type { PathApplicationLike, PathRemoteLike, SnapshotStoreLike, StoreModuleLike } from "./types.ts";

/** Trang thai mot lan mo workspace bang ung dung ngoai. */
export interface OpenInAppLaunchState {
  /** Pha cua lan mo. */
  phase: "idle" | "busy" | "error";
  /** Duong dan cua lan mo. */
  path: string | null;
}

/** Ham goi HTTP cua bo dieu khien (thay duoc trong test). */
export type OpenInAppFetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Y dinh cua mot thao tac duong dan: mo bang ung dung mac dinh, hoac hien trong trinh quan ly tep. */
export type OpenInAppPathAction = "open" | "reveal";

/** Loi cua mot thao tac duong dan, de chinh control da kich hoat thong bao. */
export type OpenInAppPathFailure = "openError" | "revealError";

/**
 * Giu lan doc danh muc ung dung MOT LAN moi trang, lua chon da luu, va lenh mo workspace.
 * Nguon cong bo qua store an toan voi uSES nen moi tieu de phien dung chung mot su that.
 */
export class OpenInAppController {
  /** Id ung dung da cai theo thu tu menu cua Host; null truoc khi Host tra loi. */
  readonly apps: SnapshotStoreLike<readonly string[] | null>;
  /** Id ung dung chon lan cuoi; rong truoc lan chon dau, dung chung moi phien va qua lan khoi dong lai. */
  readonly choice: SnapshotStoreLike<string>;
  /** Lan mo hien tai, dung chung cho ca thao tac chuot lan ban phim. */
  readonly operation: SnapshotStoreLike<OpenInAppLaunchState>;
  /** Lan doc danh muc dang chay (de moi lan goi chia se cung mot lan doc). */
  private loading: Promise<void> | undefined;
  /** Ham goi HTTP cho lan doc danh muc va lenh mo. */
  private readonly fetcher: OpenInAppFetcher;

  /**
   * Dung bo dieu khien voi store cua bang module va ham goi HTTP.
   * Nhan: createStore — ham tao store cua `@galaxy-blackhole/gbh-client-store`; fetcher — ham goi HTTP (mac dinh fetch).
   * Tra: doi tuong dieu khien.
   */
  constructor(
    createStore: StoreModuleLike["createSnapshotStore"],
    fetcher: OpenInAppFetcher = (input, init) => fetch(input, init),
  ) {
    // 18/10/2026 (task-38): MIGRATION MỘT LẦN dsh.open-in-app.choice → gbh.open-in-app.choice TRƯỚC khi
    // tạo store (store đọc localStorage ngay trong constructor ⇒ chạy sau là mất lựa chọn đã lưu).
    migrateOpenInAppChoiceKey();
    this.apps = createStore<readonly string[] | null>(null);
    this.choice = createStore<string>("", { persist: { name: OPEN_IN_APP_CHOICE_KEY } });
    this.operation = createStore<OpenInAppLaunchState>({ phase: "idle", path: null });
    this.fetcher = fetcher;
  }

  /**
   * Tra ung dung da cai co ten goi duoc, kem fallback ve ung dung dau tien cua nut.
   * Nhan: khong co.
   * Tra: id ung dung, hoac undefined khi chua co du lieu.
   */
  currentApp(): string | undefined {
    const apps = (this.apps.getSnapshot() ?? []).filter((id) => APP_LABEL_KEY[id] !== undefined);
    const choice = this.choice.getSnapshot();
    return apps.includes(choice) ? choice : apps[0];
  }

  /**
   * Doc danh muc ung dung mot lan moi vong doi bo dieu khien; cac lan goi dong thoi chia se lan doc.
   * Lan doc that bai cong bo danh sach rong, nghia la khong co nut nao duoc ve.
   * Nhan: khong co.
   * Tra: sau khi danh muc duoc cong bo.
   */
  load(): Promise<void> {
    this.loading ??= this.run();
    return this.loading;
  }

  /**
   * Ghi nho mot id ung dung vua chon.
   * Nhan: appId — id trong danh muc kha dung.
   * Tra: khong co.
   */
  choose(appId: string): void {
    if (this.operation.getSnapshot().phase !== "busy") this.choice.set(appId);
  }

  /**
   * Mo mot ung dung da cai tren thu muc workspace.
   * Nhan: appId — id trong danh muc kha dung; path — thu muc workspace tuyet doi cua phien.
   * Tra: sau khi Host xac nhan; nem loi khi that bai. Thao tac dong thoi bi bo qua cho toi khi
   *   yeu cau Host hien tai ket thuc.
   */
  async launch(appId: string, path: string): Promise<void> {
    if (this.operation.getSnapshot().phase === "busy") return;
    this.operation.set({ phase: "busy", path });
    try {
      const response = await this.fetcher(ROUTE_OPEN, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app: appId, path }),
      });
      if (!response.ok) throw new Error("open failed: HTTP " + String(response.status));
      this.operation.set({ phase: "idle", path });
    } catch (error) {
      this.operation.set({ phase: "error", path });
      throw error;
    }
  }

  /**
   * Doc danh muc ung dung tu Host va cong bo ket qua.
   * Nhan: khong co.
   * Tra: khong co — moi loi deu thanh danh sach rong (khong ve nut).
   */
  private async run(): Promise<void> {
    let apps: readonly string[] = [];
    try {
      const response = await this.fetcher(ROUTE_APPS, { headers: { accept: "application/json" } });
      if (response.ok) {
        const payload = (await response.json()) as { apps?: unknown };
        if (Array.isArray(payload.apps)) apps = payload.apps.filter((id): id is string => typeof id === "string");
      }
    } catch {
      apps = [];
    }
    this.apps.set(apps);
  }
}

/**
 * Giu trang thai desktop cua Host, hiep tro tep, va hai thao tac mo/hien qua Remote cua phien.
 * Cau tra loi ve desktop duoc doc mot lan moi trang; lan doc that bai thi khong ve control nao.
 */
export class OpenInAppPathController {
  /** Host desktop co mo duoc duong dan khong; null truoc khi Host tra loi, false ca khi doc that bai. */
  readonly desktop: SnapshotStoreLike<boolean | null>;
  /** Lan doc dang chay (de moi lan goi chia se cung mot lan doc). */
  private loading: Promise<void> | undefined;
  /** Nua Remote cua phien. */
  private readonly remote: PathRemoteLike;

  /**
   * Dung bo dieu khien duong dan.
   * Nhan: remote — nua Remote cua phien; createStore — ham tao store cua bang module.
   * Tra: doi tuong dieu khien.
   */
  constructor(remote: PathRemoteLike, createStore: StoreModuleLike["createSnapshotStore"]) {
    this.remote = remote;
    this.desktop = createStore<boolean | null>(null);
  }

  /**
   * Doc nang luc desktop mot lan moi vong doi bo dieu khien.
   * Nhan: khong co.
   * Tra: sau khi nang luc duoc cong bo.
   */
  load(): Promise<void> {
    this.loading ??= this.run();
    return this.loading;
  }

  /**
   * Mo mot duong dan cua Host bang ung dung mac dinh, hoac hien no trong trinh quan ly tep.
   * Nhan: path — duong dan tuyet doi tren Host; action — mo hoac hien; application — duong dan ung dung
   *   da dang ky khi mo tuong minh.
   * Tra: loai loi de thong bao, hoac null khi Host da xac nhan.
   */
  async openPath(path: string, action: OpenInAppPathAction, application?: string): Promise<OpenInAppPathFailure | null> {
    const request = action === "reveal" ? { path, action } : { path, ...(application === undefined ? {} : { application }) };
    let ok = false;
    try {
      const result = await this.remote.session.openWorkspacePath(request);
      ok = result.ok;
    } catch {
      ok = false;
    }
    if (ok) return null;
    return action === "open" ? "openError" : "revealError";
  }

  /**
   * Doc lai hiep tro cua mot tep; that bai van khac voi danh sach rong.
   * Nhan: path — duong dan tep do Host bao; signal — vong doi cua lan xem truoc dang yeu cau.
   * Tra: metadata ung dung, hoac null khi truy van that bai.
   */
  async applications(path: string, signal: AbortSignal): Promise<readonly PathApplicationLike[] | null> {
    let result: { ok: boolean; value?: readonly PathApplicationLike[] };
    try {
      result = await this.remote.session.workspacePathApplications({ path }, signal);
    } catch {
      return null;
    }
    return result.ok ? result.value ?? null : null;
  }

  /**
   * Doc nang luc desktop cua Host va cong bo ket qua.
   * Nhan: khong co.
   * Tra: khong co — moi loi deu thanh false (khong ve control).
   */
  private async run(): Promise<void> {
    let available = false;
    try {
      const result = await this.remote.session.canOpenWorkspacePath();
      available = result.ok && result.value === true;
    } catch {
      available = false;
    }
    this.desktop.set(available);
  }
}
