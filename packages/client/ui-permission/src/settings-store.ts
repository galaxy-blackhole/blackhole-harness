/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bo dieu khien hang "quyen mac dinh cho phien moi": doc descriptor qua guong chung, ghi mot lan qua remote.settings
 */

import { AUTO_REVIEW_PRESET, FULL_ACCESS_PRESET, PERMISSION_SETTINGS_NS } from "./ids.ts";
import type { CatalogDirectory, PermissionCatalog, SnapshotStore } from "./catalog.ts";
import { displayPermissionPreset } from "./presentation.ts";

/** Mot lua chon mac dinh cho phien moi. */
export interface PermissionDefaultOption {
  /** Khoa preset ghi vao Settings. */
  id: string;
  /** Nhan do Host cap hoac ten kebab-case da viet hoa. */
  label: string;
}

/** Anh chup cua hang cai dat ma component doc. */
export interface PermissionSettingsState {
  /** Trang thai cua hang. */
  status: "idle" | "loading" | "ready" | "saving" | "unavailable" | "error";
  /** Thong bao loi gan nhat, hoac null. */
  error: string | null;
  /** Host cho phep ghi khong. */
  writable: boolean;
  /** Gia tri mac dinh hien hanh. */
  currentValue: string;
  /** Cac lua chon duoc cong bo. */
  options: readonly PermissionDefaultOption[];
  /** Revision cua descriptor (phai gui kem khi ghi). */
  revision: number;
}

/** Mot namespace trong descriptor cai dat ma Host cong bo. */
export interface SettingsNamespaceView {
  /** Ten namespace. */
  ns: string;
  /** Revision cua namespace. */
  revision: number;
  /** Gia tri hien hanh (ban ghi phang). */
  value: Record<string, unknown>;
}

/** Anh chup cua guong describe dung chung. */
export interface SettingsDescribeSnapshot {
  /** Descriptor day du, hoac undefined khi chua co. */
  view?: { namespaces: readonly SettingsNamespaceView[]; writable: boolean };
  /** Loi cua lan doc gan nhat, hoac null. */
  error: string | null;
}

/** Mat doc/ghi cua guong describe (do goi ui-settings cap). */
export interface SettingsDescribeFace {
  /** Doc anh chup guong hien tai. */
  getSnapshot(): SettingsDescribeSnapshot;
  /** Theo doi guong; tra ham go. */
  subscribe(listener: () => void): () => void;
  /** Bao dam da doc descriptor it nhat mot lan. */
  ensure(): Promise<void>;
  /** Nhan descriptor vua ghi xong de guong khong phai doc lai. */
  acceptView(view: unknown): void;
}

/** Phan context ma hang cai dat can (namespace remote.settings). */
export interface SettingsContext {
  /** Seam Remote: namespace settings co ham ghi. */
  remote: {
    /** Namespace cai dat. */
    settings: {
      /** Ghi mot loat thao tac len namespace, kem revision. */
      mutate(namespace: string, operations: readonly unknown[], revision: number): Promise<{ ok: boolean; value?: unknown; error?: { code?: string; message?: string } }>;
    };
  };
}

/**
 * Suy ra lua chon mac dinh phien moi tu descriptor va catalog.
 * Nhan: descriptor cua namespace "permission" va catalog quyen cua Host.
 * Tra: gia tri hien hanh + danh sach lua chon duoc cong bo.
 */
export function permissionDefaultOf(
  view: SettingsNamespaceView,
  catalog: PermissionCatalog,
): { currentValue: string; options: PermissionDefaultOption[] } {
  const stored = view.value["defaultPreset"];
  const currentValue = typeof stored === "string" ? stored : catalog.defaultPreset;
  const options = catalog.defaultOptions.map((option) => ({
    id: option.value,
    label: displayPermissionPreset(option.value, option.name),
  }));
  if (!options.some((option) => option.id === currentValue)) {
    throw new Error("permission catalog does not advertise its current default");
  }
  return { currentValue, options };
}

/** Bo dieu khien hang cai dat. */
export interface SettingsController {
  /** Anh chup ma renderer bind thanh hook. */
  store: SnapshotStore<PermissionSettingsState>;
  /** Bat dau theo doi guong (idempotent) va phan anh cau tra loi hien tai. */
  load(): Promise<void>;
  /** Ghi mot preset lam mac dinh cho cac phien tao sau. */
  select(preset: string): Promise<void>;
  /** Ngung theo doi guong. */
  dispose(): void;
}

/**
 * Dung bo dieu khien hang cai dat (ban goc: lop PermissionPresetSettingsController).
 * Nhan: mat describe cua guong chung, context co remote.settings, thu muc catalog, ham tao store.
 * Tra: SettingsController — moi lan ghi chi nham MOT duong dan "defaultPreset" kem revision.
 */
export function makeSettingsController(
  describeFace: SettingsDescribeFace,
  ctx: SettingsContext,
  catalog: Pick<CatalogDirectory, "store" | "load">,
  createSnapshotStore: <T>(initial: T) => SnapshotStore<T>,
): SettingsController {
  const store = createSnapshotStore<PermissionSettingsState>({
    status: "idle",
    error: null,
    writable: false,
    currentValue: "",
    options: [],
    revision: 0,
  });
  let following: (() => void) | undefined;
  let followingCatalog: (() => void) | undefined;
  let saving = false;
  let disposed = false;

  /** Ghi loi vao anh chup (trang thai "error" + thong bao). */
  function fail(error: unknown): void {
    store.update((state) => {
      state.status = "error";
      state.error = error instanceof Error ? error.message : String(error);
    });
  }

  /** Tinh lai anh chup tu guong describe + catalog. */
  function derive(): void {
    if (disposed || saving) return;
    const mirrored = describeFace.getSnapshot();
    if (mirrored.view === undefined) {
      if (mirrored.error !== null) fail(new Error(mirrored.error));
      return;
    }
    const view = mirrored.view.namespaces.find((entry) => entry.ns === PERMISSION_SETTINGS_NS);
    if (view === undefined) {
      store.update((state) => {
        state.status = "unavailable";
        state.writable = false;
        state.currentValue = "";
        state.options = [];
      });
      return;
    }
    try {
      const current = catalog.store.getSnapshot().value;
      if (current === null) return;
      const resolved = permissionDefaultOf(view, current);
      const writable = mirrored.view.writable;
      store.update((state) => {
        state.status = "ready";
        state.error = null;
        state.writable = writable;
        state.currentValue = resolved.currentValue;
        state.options = resolved.options;
        state.revision = view.revision;
      });
    } catch (error: unknown) {
      fail(error);
    }
  }

  /** Bat dau theo doi guong va phan anh cau tra loi hien tai. */
  async function load(): Promise<void> {
    if (disposed) return;
    following ??= describeFace.subscribe(() => {
      derive();
    });
    followingCatalog ??= catalog.store.subscribe(() => {
      derive();
    });
    store.update((state) => {
      state.status = "loading";
      state.error = null;
    });
    await describeFace.ensure();
    try {
      await catalog.load();
    } catch (error: unknown) {
      fail(error);
      return;
    }
    derive();
  }

  /** Ghi preset lam mac dinh cho phien moi; lan chon trong luc dang luu bi bo qua. */
  async function select(preset: string): Promise<void> {
    const state = store.getSnapshot();
    const view = describeFace.getSnapshot().view?.namespaces.find((entry) => entry.ns === PERMISSION_SETTINGS_NS);
    if (view === undefined || !state.writable || saving) return;
    saving = true;
    store.update((draft) => {
      draft.status = "saving";
      draft.error = null;
    });
    let response: { ok: boolean; value?: unknown; error?: { code?: string; message?: string } };
    try {
      response = await ctx.remote.settings.mutate(
        PERMISSION_SETTINGS_NS,
        [{ op: "set", path: ["defaultPreset"], value: preset }],
        view.revision,
      );
    } finally {
      saving = false;
    }
    if (disposed) return;
    if (!response.ok) {
      fail(response.error);
      return;
    }
    describeFace.acceptView(response.value);
  }

  /** Ngung theo doi guong. */
  function dispose(): void {
    disposed = true;
    following?.();
    following = undefined;
    followingCatalog?.();
    followingCatalog = undefined;
  }

  return { store, load, select, dispose };
}

/** Hai preset can cong xac nhan rui ro truoc khi doi (dung cho ca hai be mat). */
export const RISK_PRESETS: readonly string[] = [FULL_ACCESS_PRESET, AUTO_REVIEW_PRESET];
