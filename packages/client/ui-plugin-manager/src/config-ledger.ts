/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 vùng `config-ledger` của bundle gốc (client.js dòng 13-75): ba sổ cấu hình của trang Plugins
 *      + `rowConfigKey` + nguồn observable mà trang bind (ảnh chụp chỉ đổi khi slot hoặc từ điển đổi).
 *
 * Vì sao cần: trang Plugins phải biết plugin nào mang cấu hình riêng (plugin chính thức ở `plugins.item`, bundle
 * có form ở `plugins.bundle.config`, row có trang riêng ở `plugins.row.config`) để vẽ đúng mục "cấu hình".
 * Bản gốc giữ ảnh chụp ổn định giữa hai lần đổi bằng bộ (version của ba slot, revision của từ điển); dưới đây giữ
 * nguyên cơ chế đó, chỉ bỏ phần minify.
 */

import type { HostObservable, ResolveSlotLabel } from "./tab-ledger.ts";

/** Ba slot mang cấu hình mà sổ này theo dõi (nguyên văn bản gốc: `SLOTS`). */
const SLOTS = ["plugins.item", "plugins.bundle.config", "plugins.row.config"] as const;

/** Một plugin chính thức như trang liệt kê: id đăng ký và tiêu đề theo ngôn ngữ đang dùng. */
export interface OfficialItem {
  /** Id người đăng ký khai (list slot bắt buộc có id; lưới an toàn là chuỗi rỗng). */
  readonly id: string;
  /** Nhãn đã giải theo ngôn ngữ hiện tại (rỗng khi không có nhãn). */
  readonly label: string;
}

/**
 * Các plugin mang cấu hình: plugin chính thức theo thứ tự sổ, tên gói của các bundle có form ở cấp trang,
 * và khoá ({@link rowConfigKey}) của các row có trang riêng.
 */
export interface ConfigLedger {
  /** Các mục `plugins.item` theo thứ tự đăng ký. */
  readonly items: readonly OfficialItem[];
  /** Tập khoá của `plugins.bundle.config` (bundle nào có form cấu hình). */
  readonly bundles: ReadonlySet<string>;
  /** Tập khoá của `plugins.row.config` (row nào có trang cấu hình riêng). */
  readonly rows: ReadonlySet<string>;
}

/** Một mục của ba slot cấu hình (phần sổ này đọc: id, khoá, nhãn). */
export interface ConfigLedgerEntry {
  /** Tuỳ chọn đăng ký của mục. */
  readonly options: {
    /** Id occupant (list slot bắt buộc có id). */
    readonly id?: string;
    /** Khoá của slot kiểu keyed — chính là thứ sổ này gom vào `bundles`/`rows`. */
    readonly key?: string;
    /** Nhãn: chuỗi, hàm, hoặc object đa ngôn ngữ. */
    readonly label?: unknown;
  };
}

/** Seam ctx mà sổ cấu hình cần (đúng hai service của bản gốc: `slots` + `locale`). */
export interface ConfigLedgerContext {
  /** Sổ slot: số phiên bản, ảnh chụp mục, đăng ký nghe. */
  slots: {
    /** Số phiên bản đăng ký của một khoá. */
    getVersion(name: string): number;
    /** Ảnh chụp mục của một khoá. */
    entries(name: string): readonly ConfigLedgerEntry[];
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

/**
 * Khoá mà cấu hình của một row đăng ký dưới.
 * Nhận: `bundle` — tên gói của bundle; `rowId` — id row mà patch của bundle khai.
 * Trả: khoá `plugins.row.config` dạng `<bundle>#<rowId>`.
 */
export function rowConfigKey(bundle: string, rowId: string): string {
  return `${bundle}#${rowId}`;
}

/**
 * Gom tập khoá của một slot cấu hình (entry không khai `key` thì bỏ qua).
 * Nhận: `ctx` — seam slot của trang; `name` — tên slot.
 * Trả: tập khoá đang được đăng ký.
 */
function keysOf(ctx: ConfigLedgerContext, name: string): Set<string> {
  const out = new Set<string>();
  for (const entry of ctx.slots.entries(name)) {
    if (entry.options.key !== undefined) out.add(entry.options.key);
  }
  return out;
}

/**
 * Chiếu ba sổ cấu hình thành MỘT nguồn observable mà trang bind (port 1:1 `configLedgerSource`).
 *
 * Ảnh chụp chỉ tính lại khi version của một trong ba slot hoặc revision của từ điển đổi — giữ nguyên cơ chế
 * của bản gốc, nhờ vậy trang không tính lại (và không re-render) mỗi lượt vẽ.
 *
 * Nhận: `ctx` — seam slot + từ điển của trang; `resolveSlotLabel` — hàm chuẩn hoá nhãn của ui-slots
 * (bản gốc lấy ở phạm vi module; theo luật của repo, ta nhận qua tham số từ bảng module của trang).
 * Trả: nguồn observable của {@link ConfigLedger}.
 */
export function configLedgerSource(ctx: ConfigLedgerContext, resolveSlotLabel: ResolveSlotLabel): HostObservable<ConfigLedger> {
  /** Version của ba slot đã chiếu (rỗng: chưa chiếu lần nào). */
  let versions: number[] = [];
  /** Revision từ điển đã chiếu (-1: chưa chiếu lần nào). */
  let revision = -1;
  /** Ảnh chụp đang dùng. */
  let ledger: ConfigLedger = { items: [], bundles: new Set(), rows: new Set() };
  return {
    getSnapshot: () => {
      const next = SLOTS.map((name) => ctx.slots.getVersion(name));
      const current = ctx.locale.getSnapshot().revision;
      if (current !== revision || next.some((version, index) => version !== versions[index])) {
        versions = next;
        revision = current;
        ledger = {
          items: ctx.slots.entries("plugins.item").map((entry) => ({
            id: entry.options.id ?? "",
            label: resolveSlotLabel(entry.options.label) ?? "",
          })),
          bundles: keysOf(ctx, "plugins.bundle.config"),
          rows: keysOf(ctx, "plugins.row.config"),
        };
      }
      return ledger;
    },
    subscribe: (listener) => {
      const offs = [...SLOTS.map((name) => ctx.slots.subscribe(name, listener)), ctx.locale.subscribe(listener)];
      return () => {
        for (const off of offs) off();
      };
    },
  };
}
