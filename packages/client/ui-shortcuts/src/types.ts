/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Kieu cau truc cho hop dong service `shortcuts` (provider cua tm-m5b) ma row nay tieu thu
 */

/** Mot lenh trong danh muc phim tat (khop `ShortcutCatalogEntry` cua provider). */
export interface CatalogEntry {
  /** Id lenh. */
  readonly id: string;
  /** Nhan hien thi. */
  readonly label: string;
  /** Ten goi khac. */
  readonly aliases: readonly string[];
  /** Phim hien thi. */
  readonly keys: readonly string[];
  /** Nhan tro giup. */
  readonly aria?: string | undefined;
  /** To hop vat ly dang gan. */
  readonly binding?: unknown;
  /** Da sua so voi mac dinh. */
  readonly modified?: boolean;
  /** Lenh xung dot. */
  readonly conflicts?: readonly string[];
  /** Van de cua to hop. */
  readonly issue?: string | null;
}

/**
 * Anh chup cau hinh phim tat da luu — doi chieu `ShortcutConfigSnapshot` cua goi goc
 * (`dsh-client-shortcuts/lib/types/persistence.d.ts`): revision · sequence · document · status · error · usingDefaults.
 */
export interface ConfigSnapshot {
  /** Revision cua tai lieu. */
  readonly revision: number;
  /** So thu tu trong mot doi song cua noi luu (client bo qua tra loi den muon). */
  readonly sequence?: number;
  /** Khoa loi doc cau hinh: read · invalid · future · null khi lanh. */
  readonly error?: string | null;
  /** Dang dung gia tri mac dinh hay khong. */
  readonly usingDefaults?: boolean;
  /** To hop theo id lenh. */
  readonly bindings?: Readonly<Record<string, unknown>>;
  /** Trang thai doc. */
  readonly status?: string;
  /** Tai lieu da luu (ho so + gan ket). */
  readonly document?: { readonly profiles?: Readonly<Record<string, unknown>> };
}

/**
 * Mot dong danh muc CO DINH (menu dung chung) — HINH DANG ANH CHUP, khong phai dinh nghia.
 * Do tu bundle goc `dsh-client-shortcuts/lib/client.js:1188-1194`: `refreshFixedLabels` dat
 * `label: command.label()` ⇒ nhan trong anh chup la CHUOI (ham `label` chi nam o dinh nghia dang ky).
 */
export interface FixedCatalogRow {
  /** Id day du. */
  readonly id: string;
  /** Nhan hien thi (CHUOI trong anh chup). */
  readonly label: string;
  /** Phim hien thi. */
  readonly keys: readonly string[];
  /** Nhom. */
  readonly group: string;
}

/** Su kien ban phim ma trinh ghi doc (DOM KeyboardEvent rut gon). */
export interface KeyboardEventLike {
  /** Phim logic. */
  readonly key?: string;
  /** Ma vat ly. */
  readonly code?: string;
  /** Ctrl dang giu. */
  readonly ctrlKey: boolean;
  /** Alt dang giu. */
  readonly altKey: boolean;
  /** Shift dang giu. */
  readonly shiftKey: boolean;
  /** Meta/Command dang giu. */
  readonly metaKey: boolean;
  /** Su kien lap do giu phim. */
  readonly repeat?: boolean;
  /** Trang thai mot phim bo tro. */
  getModifierState: (key: string) => boolean;
  /** Chan hanh vi mac dinh. */
  preventDefault: () => void;
  /** Chan lan truyen. */
  stopPropagation: () => void;
}

/** Runtime cua service (web/desktop). */
export type ShortcutRuntime = string;

/** Nen tang (macos/windows/linux). */
export type ShortcutPlatform = string;
