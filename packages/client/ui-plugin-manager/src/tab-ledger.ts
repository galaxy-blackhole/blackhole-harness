/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 tab-ledger.js cua bundle goc (dong 4293-4326): chieu so tab 'plugins.tab' thanh mot nguon observable
 */
//
// Vì sao cần: trang Plugins bind MỘT nguồn cho danh sách tab; nguồn đó phải đổi khi SỔ tab đổi HOẶC khi
// ngôn ngữ đổi (nhãn tab là chuỗi đã dịch). Bản gốc giữ ảnh chụp ổn định giữa hai lần đổi bằng cặp
// (version, revision) — dưới đây giữ nguyên cơ chế đó, chỉ bỏ phần minify.

/** Nguồn chỉ-đọc một giá trị (store engine · Session · store instance). */
export interface HostObservable<T> {
  /**
   * Đọc giá trị hiện tại.
   * Nhận: không.
   * Trả: giá trị.
   */
  getSnapshot(): T;
  /**
   * Theo dõi thay đổi.
   * Nhận: `listener` — hàm nghe.
   * Trả: hàm gỡ.
   */
  subscribe(listener: () => void): () => void;
}

/** Một tab do plugin khác đóng góp: id đăng ký + nhãn theo ngôn ngữ hiện tại. */
export interface PluginTab {
  /** Id đăng ký của tab. */
  readonly id: string;
  /** Nhãn đã dịch. */
  readonly label: string;
}

/** Một mục trong sổ `plugins.tab` (phần ledger đọc). */
export interface TabLedgerEntry {
  /** Tuỳ chọn đăng ký của mục. */
  readonly options: {
    /** Id occupant (slot kiểu list bắt buộc có id). */
    readonly id?: string;
    /** Nhãn: chuỗi, hàm, hoặc object đa ngôn ngữ. */
    readonly label?: unknown;
  };
}

/** Seam ctx mà ledger cần (đúng hai service của bản gốc: `slots` + `locale`). */
export interface TabLedgerContext {
  /** Sổ slot: số phiên bản, ảnh chụp mục, đăng ký nghe. */
  slots: {
    /** Số phiên bản đăng ký của một khoá. */
    getVersion(name: string): number;
    /** Ảnh chụp mục của một khoá. */
    entries(name: string): readonly TabLedgerEntry[];
    /** Đăng ký nghe thay đổi của một khoá. */
    subscribe(name: string, listener: () => void): () => void;
  };
  /** Từ điển: revision hiện tại + đăng ký nghe. */
  locale: {
    /** Ảnh chụp (chỉ cần revision). */
    getSnapshot(): { readonly revision: number };
    /** Đăng ký nghe đổi từ điển. */
    subscribe(listener: () => void): () => void;
  };
}

/** Hàm chuẩn hoá nhãn của ui-slots (`resolveSlotLabel`), lấy từ bảng module của trang. */
export type ResolveSlotLabel = (label: unknown) => string | undefined;

/**
 * Chiếu sổ `plugins.tab` thành MỘT nguồn observable mà trang bind (port 1:1 `tabLedgerSource`).
 *
 * Ảnh chụp chỉ đổi khi `version` của sổ hoặc `revision` của từ điển đổi — giữ nguyên cơ chế của bản gốc;
 * nhờ vậy component `React.memo` không re-render vô ích mỗi lần trang vẽ lại.
 *
 * Nhận: `ctx` — seam slot + từ điển của trang; `resolveSlotLabel` — hàm chuẩn hoá nhãn.
 * Trả: nguồn observable của danh sách tab.
 */
export function tabLedgerSource(ctx: TabLedgerContext, resolveSlotLabel: ResolveSlotLabel): HostObservable<readonly PluginTab[]> {
  /** Số phiên bản đã chiếu (-1: chưa chiếu lần nào). */
  let version = -1;
  /** Revision từ điển đã chiếu (-1: chưa chiếu lần nào). */
  let revision = -1;
  /** Ảnh chụp đang dùng. */
  let tabs: readonly PluginTab[] = [];
  return {
    getSnapshot: () => {
      const next = ctx.slots.getVersion("plugins.tab");
      const current = ctx.locale.getSnapshot().revision;
      if (next !== version || current !== revision) {
        version = next;
        revision = current;
        tabs = ctx.slots.entries("plugins.tab").map((entry) => ({
          id: entry.options.id ?? "",
          label: resolveSlotLabel(entry.options.label) ?? "",
        }));
      }
      return tabs;
    },
    subscribe: (listener) => {
      const offs = [ctx.slots.subscribe("plugins.tab", listener), ctx.locale.subscribe(listener)];
      return () => {
        for (const off of offs) off();
      };
    },
  };
}
