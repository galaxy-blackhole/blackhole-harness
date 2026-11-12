/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hop dong slot cua trang Plugins: ba slot mang cau hinh plugin + nguon so cai (ledger) ma trang bind
 */

/** Ba slot mang CAU HINH cua plugin (ban goc goi la SLOTS) — trang theo doi VERSION cua chung. */
export const SLOTS = ["plugins.item", "plugins.bundle.config", "plugins.row.config"] as const;

/** Mot entry cua slot plugins.item, da rut gon ve hai truong trang can. */
export interface PluginListItem {
  /** Id cua nguoi dang ky (rong khi ban goc khong khai). */
  id: string;
  /** Nhan hien thi da giai tu dien (rong khi khong co nhan). */
  label: string;
}

/** So cai cau hinh ma trang bind: danh sach plugin + tap khoa cua hai slot cau hinh. */
export interface ConfigLedger {
  /** Cac plugin dang ky vao plugins.item. */
  items: PluginListItem[];
  /** Tap khoa cua plugins.bundle.config. */
  bundles: Set<string>;
  /** Tap khoa cua plugins.row.config. */
  rows: Set<string>;
}

/** Seam slot ma hop dong nay can (chi khai phan dung). */
export interface SlotRegistrySeam {
  /** Cac entry dang ky vao mot slot. */
  entries(name: string): { options: { id?: string; key?: string; label?: unknown } }[];
  /** Version cua slot — doi moi khi co nguoi dang ky/go. */
  getVersion(name: string): number;
}

/** Seam tu dien ma hop dong nay can (chi khai phan dung). */
export interface LocaleSeam {
  /** Anh chup tu dien: revision doi khi doi ngon ngu. */
  getSnapshot(): { revision: number };
}

/** Nguon so cai ma trang bind (co nho theo version cua slot va revision cua tu dien). */
export interface LedgerSource {
  /** Doc so cai hien tai; CHI tinh lai khi version/revision doi (ban goc lam dung vay). */
  getSnapshot(): ConfigLedger;
}

/**
 * Rut tap khoa cua mot slot cau hinh (entry khong khai key thi bo qua).
 * Nhan: seam slot va ten slot.
 * Tra: tap khoa dang duoc dang ky.
 */
export function keysOf(slots: SlotRegistrySeam, name: string): Set<string> {
  const out = new Set<string>();
  for (const entry of slots.entries(name)) {
    if (entry.options.key !== undefined) out.add(entry.options.key);
  }
  return out;
}

/**
 * Dung nguon so cai cau hinh cho trang Plugins.
 * Nhan: seam slot + seam tu dien cua trang, va ham giai nhan cua slot (ban goc require tu ui-slots).
 * Tra: LedgerSource — anh chup chi doi khi version cua ba slot hoac revision cua tu dien doi.
 */
export function configLedgerSource(
  slots: SlotRegistrySeam,
  locale: LocaleSeam,
  resolveSlotLabel: (label: unknown) => string | undefined,
): LedgerSource {
  let versions: number[] = [];
  let revision = -1;
  let ledger: ConfigLedger = { items: [], bundles: new Set(), rows: new Set() };
  return {
    getSnapshot(): ConfigLedger {
      const next = SLOTS.map((name) => slots.getVersion(name));
      const currentRevision = locale.getSnapshot().revision;
      const changed = currentRevision !== revision || next.some((version, index) => version !== versions[index]);
      if (!changed) return ledger;
      versions = next;
      revision = currentRevision;
      ledger = {
        items: slots.entries("plugins.item").map((entry) => ({
          id: entry.options.id ?? "",
          label: resolveSlotLabel(entry.options.label) ?? "",
        })),
        bundles: keysOf(slots, "plugins.bundle.config"),
        rows: keysOf(slots, "plugins.row.config"),
      };
      return ledger;
    },
  };
}
