/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kieu du lieu cua inventory plugin (tu khai — khong import goi DSH chi de lay type).
 */

/** Id cua mot entry trong cay Loader (branded string, dung nhu upstream). */
export type PluginEntryId = string & { readonly __pluginEntryId: unique symbol };

/**
 * Danh dau mot id entry cua Loader thanh PluginEntryId.
 * @param value - id nhu cay Loader viet.
 * @returns cung id do, da duoc brand.
 */
export function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId;
}

/** Pha cua root fiber cua mot entry, hoac null khi entry khong co fiber song. */
export type PluginFiberPhase = "pending" | "loading" | "active" | "failed" | "unloading" | null;

/**
 * Anh xa trang thai fiber cua cordis sang pha trong inventory.
 *
 * Kieu that cua cordis la enum SO (FiberState: PENDING=0, LOADING=1, ACTIVE=2, FAILED=3, DISPOSED=4,
 * UNLOADING=5) — khong phai chuoi. DISPOSED tuong ung null (khong con pha nao de bao).
 */
const FIBER_PHASE_BY_STATE: Readonly<Record<number, PluginFiberPhase>> = {
  0: "pending",
  1: "loading",
  2: "active",
  3: "failed",
  4: null,
  5: "unloading",
};

/**
 * Doi trang thai fiber thanh pha cua inventory.
 * @param state - trang thai fiber (enum so cua cordis; van chap nhan chuoi de ben vung).
 * @returns pha tuong ung, hoac null khi khong nhan dien duoc.
 */
export function fiberPhaseOf(state: unknown): PluginFiberPhase {
  if (typeof state === "number") return FIBER_PHASE_BY_STATE[state] ?? null;
  if (typeof state !== "string") return null;
  const named = ["pending", "loading", "active", "failed", "disposed", "unloading"].indexOf(state.toLowerCase());
  return named === -1 ? null : (FIBER_PHASE_BY_STATE[named] ?? null);
}

/** Metadata hien thi noi bo cua mot package (do seam pluginPackages cua kernel cap). */
export type PluginLocalizedMeta = Readonly<Record<string, unknown>>;

/** Mot entry khong phai group trong cay Loader, phoi cho client tin cay. */
export interface PluginInventoryEntry {
  /** Id on dinh cua entry. */
  readonly entryId: PluginEntryId;
  /** Specifier module ma entry import. */
  readonly moduleName: string;
  /** Metadata hien thi, neu kernel co. */
  readonly meta?: PluginLocalizedMeta;
  /** Enable cua entry (da tinh ca group cha bi tat). */
  readonly enabled: boolean;
  /** Pha cua root fiber. */
  readonly fiberPhase: PluginFiberPhase;
}

/** Enable cua mot row trong composition cua preset. */
export type PresetPluginEnablement = boolean | "conditional";

/** Mot row ma composition cua preset agent goi ten. */
export interface AgentPresetPluginRow {
  /** Id row, hoac null khi row khong khai. */
  readonly entryId: string | null;
  /** Specifier module ma row goi ten. */
  readonly moduleName: string;
  /** Metadata hien thi, neu kernel co. */
  readonly meta?: PluginLocalizedMeta;
  /** Enable hieu dung cua row. */
  readonly enabled: PresetPluginEnablement;
  /** Bieu thuc !!js disabled cua row, neu co. */
  readonly condition?: string;
  /** Pha cua root fiber khi composition dang song; nguoc lai null. */
  readonly fiberPhase: PluginFiberPhase;
}

/** Mot preset agent: dinh danh + composition da trai phang. */
export interface AgentPresetPluginGroup {
  /** Id on dinh cua preset. */
  readonly id: string;
  /** Ten hien thi preset cong bo. */
  readonly name?: string;
  /** true khi phien khong neu preset nao thi compose preset nay. */
  readonly isDefault: boolean;
  /** Ly do khong doc duoc composition (vang mat khi doc duoc). */
  readonly broken?: string;
  /** Cac row plugin theo thu tu composition. */
  readonly rows: readonly AgentPresetPluginRow[];
}

/** Anh chup inventory tai mot thoi diem. */
export interface PluginInventorySnapshot {
  /** true khi Host nay co quan ly profile hien hanh ben vung. */
  readonly managementAvailable?: boolean;
  /** Cac entry khong phai group, theo thu tu Loader. */
  readonly entries: readonly PluginInventoryEntry[];
  /** Composition tung preset, chi co khi deployment compose mot roster. */
  readonly agentPresets?: readonly AgentPresetPluginGroup[];
}
