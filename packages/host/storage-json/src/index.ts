/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Backend JSON của kho lưu trữ: mỗi ĐƠN VỊ một tài liệu JSON người-đọc-được dưới gốc đã cấu hình —
 *      cả đơn vị trong MỘT tệp (bố trí `single`) hoặc một tài liệu cho mỗi bản ghi (`per-record`) —
 *      công bố bằng ghi-đè nguyên tử. Đăng ký làm backend `json` trên kho lưu trữ
 *      (bản gốc: lib/types/index.d.ts)
 */
import { mkdir } from "node:fs/promises";
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { StorageError, UNIT_NAME_RE, storageBackendServiceKey, storageHubOf } from "./hub.ts";
import type { KvFacetLike, KvUnitDescriptorLike, KvUnitLike, StorageBackendLike } from "./hub.ts";
import { openPerRecordUnit } from "./per-record-unit.ts";
import { openSingleUnit } from "./single-unit.ts";

/** Tên plugin cordis — giữ NGUYÊN VĂN `storage-json` của bản gốc. */
export const name = "storage-json";

/** Kho lưu trữ phải có mặt TRƯỚC khi backend đăng ký được. */
export const inject: string[] = ["storage"];

/**
 * Cấu hình plugin.
 *
 * `root` KHÔNG có giá trị mặc định là CÓ CHỦ Ý: một fallback `process.cwd()` sẽ rải tệp đơn vị khắp nơi
 * mà tiến trình tình cờ khởi động; nơi lắp ráp phải nói thẳng vị trí.
 */
export interface Config {
  /** Thư mục chứa một tệp `<đơn-vị>.json` (hoặc cây `<đơn-vị>/`) cho mỗi đơn vị. */
  root: string;
}

/** Schema cấu hình lúc chạy cho {@link Config} (nguyên văn bản gốc: `root` là chuỗi BẮT BUỘC). */
export const Config: z<Config> = z.object({ root: z.string().required() }) as unknown as z<Config>;

/**
 * Backend JSON: sở hữu gốc cây tệp và phục vụ facet `kv`.
 *
 * Mỗi đơn vị có ĐÚNG MỘT tay cầm sống: mở trùng tên (kể cả khi lượt mở trước đang chạy) bị từ chối, và
 * `close()` xả mọi lượt mở đang chạy rồi đóng từng đơn vị đang mở.
 */
export class JsonStorageBackend implements StorageBackendLike {
  /** Gốc cây tệp của mọi đơn vị (thuộc backend này, không phải lựa chọn toàn cục của kho). */
  private readonly root: string;
  /** Đơn vị ĐANG MỞ theo tên; mỗi thực thể backend có bảng RIÊNG (ca C6 trong test). */
  private readonly open = new Map<string, KvUnitLike>();
  /** Các lượt mở ĐANG CHẠY theo tên — dùng để từ chối lượt mở thứ hai cùng tên. */
  private readonly opening = new Map<string, Promise<KvUnitLike>>();
  /** Backend đã đóng: mọi lượt mở mới bị từ chối. */
  private closed = false;

  /**
   * Dựng backend trên một gốc cây tệp.
   * Nhận: gốc cây tệp tuyệt đối (chưa cần tồn tại — tạo lười ở lượt mở đầu).
   * Trả: backend CHƯA mở đơn vị nào.
   */
  constructor(root: string) {
    this.root = root;
  }

  /** Facet khoá–giá trị của backend; `open` là mũi tên nên giữ ĐÚNG thực thể backend làm `this`. */
  readonly kv: KvFacetLike = {
    open: async (descriptor: KvUnitDescriptorLike): Promise<KvUnitLike> => {
      if (this.closed) throw new StorageError("closed", "json backend is closed");
      validateDescriptor(descriptor);
      if (this.open.has(descriptor.name) || this.opening.has(descriptor.name)) {
        throw new Error(`unit '${descriptor.name}' is already open; a unit has exactly one live handle`);
      }
      const opening = this.openUnit(descriptor);
      this.opening.set(descriptor.name, opening);
      return opening.finally(() => this.opening.delete(descriptor.name));
    },
  };

  /**
   * Nạp hoặc tạo lười MỘT đơn vị rồi ghi nó vào sổ đang-mở.
   * Nhận: mô tả tĩnh của đơn vị cần mở.
   * Trả: promise của đơn vị đã mở; backend đã đóng (kể cả đóng GIỮA lượt mở) thì đơn vị vừa dựng bị đóng
   * rồi ném {@link StorageError} mã `closed`.
   */
  private async openUnit(descriptor: KvUnitDescriptorLike): Promise<KvUnitLike> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const onClose = (): boolean => this.open.delete(descriptor.name);
    const unit =
      descriptor.layout === "per-record"
        ? await openPerRecordUnit(descriptor, this.root, onClose)
        : await openSingleUnit(descriptor, this.root, onClose);
    if (this.closed) {
      await unit.close();
      throw new StorageError("closed", "json backend is closed");
    }
    this.open.set(descriptor.name, unit);
    return unit;
  }

  /**
   * Xả mọi lượt mở đang chạy rồi đóng từng đơn vị đang mở; idempotent.
   * Nhận: không.
   * Trả: promise phân giải sau khi mọi đơn vị đã đóng và môi trường lưu đã được nhả.
   */
  async close(): Promise<void> {
    if (!this.closed) this.closed = true;
    await Promise.allSettled([...this.opening.values()]);
    for (const unit of [...this.open.values()]) await unit.close();
  }
}

/**
 * Kiểm định danh của một mô tả đơn vị trước khi chạm môi trường lưu.
 * Nhận: mô tả đơn vị do tầng miền chiếu ra.
 * Trả: không; tên đơn vị hoặc tên bảng không khớp {@link UNIT_NAME_RE} thì ném {@link StorageError} mã
 * `malformed-medium`.
 */
function validateDescriptor(descriptor: KvUnitDescriptorLike): void {
  if (!UNIT_NAME_RE.test(descriptor.name)) {
    throw new StorageError("malformed-medium", `invalid unit name '${descriptor.name}'`);
  }
  for (const table of descriptor.tables) {
    if (!UNIT_NAME_RE.test(table)) {
      throw new StorageError("malformed-medium", `invalid table name '${table}' in unit '${descriptor.name}'`);
    }
  }
}

/**
 * Đăng ký backend `json` trên kho lưu trữ.
 * Nhận: context của plugin và cấu hình đã được schema xác thực.
 * Trả: không trả gì; tác dụng phụ là đăng ký (trong một hiệu ứng, để gỡ mount là tháo đăng ký + đóng
 * backend) và phơi khoá vòng đời `storage.backend.json`.
 */
export function apply(ctx: Context, config: Config): void {
  const backend = new JsonStorageBackend(config.root);
  ctx.effect(() => {
    const unregister = storageHubOf(ctx).backend.register("json", backend);
    return async () => {
      unregister();
      await backend.close();
    };
  });
  ctx.provide(storageBackendServiceKey("json"), backend);
}
