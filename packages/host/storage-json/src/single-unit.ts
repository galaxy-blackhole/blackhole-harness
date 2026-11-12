/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Một đơn vị JSON đã mở ở bố trí `single`: CẢ đơn vị là một tài liệu tại `<root>/<tên>.json`.
 *      Trạng thái trong bộ nhớ là ủy quyền; mỗi thao tác ghi sửa nó rồi công bố lại TOÀN BỘ tệp một cách
 *      nguyên tử (bản gốc: lib/types/single-unit.d.ts)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeAtomic } from "./atomic.ts";
import { emptyState, parse, serialize } from "./format.ts";
import type { UnitState } from "./format.ts";
import { StorageError } from "./hub.ts";
import type { KvUnitDescriptorLike, KvUnitLike } from "./hub.ts";

/**
 * Mở (nạp hoặc tạo lười) MỘT đơn vị bố trí `single` dưới `root`: tệp đơn vị là `<root>/<tên>.json`.
 * Nhận: định danh và hình dạng tĩnh của đơn vị, gốc backend tuyệt đối, và callback nhả chỗ-đang-mở của backend.
 * Trả: đơn vị đã mở (trạng thái đọc từ tệp, hoặc trạng thái RỖNG khi tệp chưa có).
 */
export async function openSingleUnit(
  descriptor: KvUnitDescriptorLike,
  root: string,
  onClose: () => void,
): Promise<KvUnitLike> {
  const path = join(root, `${descriptor.name}.json`);
  let text: string | undefined;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return new SingleJsonUnit(descriptor, path, text === undefined ? emptyState(descriptor) : parse(text, descriptor), onClose);
}

/**
 * Một đơn vị `single` đã mở. Bộ nhớ là ủy quyền: mỗi thao tác ghi sửa nó rồi công bố lại cả tệp.
 * Lượt ghi KHÔNG được xếp hàng ở đây — theo hợp đồng backend, thứ tự ghi thuộc người gọi (chuỗi ghi của
 * tầng miền); đơn vị chỉ bảo đảm mỗi lời gọi đơn lẻ công bố một tệp đầy đủ và bền.
 */
class SingleJsonUnit implements KvUnitLike {
  private readonly descriptor: KvUnitDescriptorLike;
  private readonly path: string;
  private readonly state: UnitState;
  private readonly onClose: () => void;
  private closed = false;
  /** Các lượt công bố đang chạy; `close()` xả hết trước khi nhả đơn vị. */
  private readonly inFlight = new Set<Promise<void>>();

  /**
   * Dựng đơn vị từ trạng thái đã có.
   * Nhận: mô tả đơn vị, đường dẫn tệp đơn vị, trạng thái ban đầu (đọc từ tệp hoặc rỗng), callback nhả chỗ.
   * Trả: đơn vị CHƯA đóng, chưa chạm môi trường lưu.
   */
  constructor(descriptor: KvUnitDescriptorLike, path: string, state: UnitState, onClose: () => void) {
    this.descriptor = descriptor;
    this.path = path;
    this.state = state;
    this.onClose = onClose;
  }

  /**
   * Đọc ảnh chụp đầy đủ từ bộ nhớ ủy quyền.
   * Nhận: không.
   * Trả: bản ghi của mọi bảng + ô global; mỗi lượt trả vật thể MỚI (sửa ảnh chụp không chạm bộ nhớ).
   */
  async loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }> {
    this.assertOpen();
    const tables: Record<string, Record<string, unknown>> = {};
    for (const [table, records] of this.state.tables) tables[table] = Object.fromEntries(records);
    return { tables, global: this.state.global };
  }

  /**
   * Ghi đè MỘT bản ghi rồi công bố lại cả tệp; công bố HỎNG thì bộ nhớ được HOÀN NGUYÊN.
   * Nhận: tên bảng đã khai, khoá bản ghi, và giá trị JSON đục.
   * Trả: promise phân giải sau khi tệp đã bền.
   */
  async putRecord(table: string, key: string, value: unknown): Promise<void> {
    this.assertOpen();
    const records = this.records(table);
    const hadKey = records.has(key);
    const previous = records.get(key);
    records.set(key, value);
    await this.publish().catch((error: unknown) => {
      if (hadKey) records.set(key, previous);
      else records.delete(key);
      throw error;
    });
  }

  /**
   * Xoá MỘT bản ghi rồi công bố lại cả tệp; khoá VẮNG là no-op; công bố HỎNG thì bộ nhớ được HOÀN NGUYÊN.
   * Nhận: tên bảng đã khai và khoá bản ghi.
   * Trả: promise phân giải sau khi tệp đã bền (hoặc ngay khi khoá vắng).
   */
  async deleteRecord(table: string, key: string): Promise<void> {
    this.assertOpen();
    const records = this.records(table);
    if (!records.has(key)) return;
    const previous = records.get(key);
    records.delete(key);
    await this.publish().catch((error: unknown) => {
      records.set(key, previous);
      throw error;
    });
  }

  /**
   * Ghi ô singleton toàn cục rồi công bố lại cả tệp; công bố HỎNG thì giá trị cũ được HOÀN NGUYÊN.
   * Nhận: giá trị JSON đục cho ô global.
   * Trả: promise phân giải sau khi tệp đã bền; đơn vị KHÔNG khai global thì ném `Error` thường.
   */
  async setGlobal(value: unknown): Promise<void> {
    this.assertOpen();
    if (!this.descriptor.hasGlobal) throw new Error(`unit '${this.descriptor.name}' does not declare a global slot`);
    const previous = this.state.global;
    this.state.global = value;
    await this.publish().catch((error: unknown) => {
      this.state.global = previous;
      throw error;
    });
  }

  /**
   * Xả các lượt công bố đang chạy rồi nhả đơn vị (gọi `onClose` ĐÚNG MỘT lần); idempotent.
   * Nhận: không.
   * Trả: promise phân giải sau khi mọi lượt ghi đã kết thúc và chỗ-đang-mở đã được nhả.
   */
  async close(): Promise<void> {
    if (this.closed) {
      await Promise.allSettled(this.inFlight);
      return;
    }
    this.closed = true;
    await Promise.allSettled(this.inFlight);
    this.onClose();
  }

  /**
   * Chặn mọi thao tác sau khi đơn vị đã đóng.
   * Nhận: không.
   * Trả: không; đơn vị đã đóng thì ném {@link StorageError} mã `closed`.
   */
  private assertOpen(): void {
    if (this.closed) throw new StorageError("closed", `unit '${this.descriptor.name}' is closed`);
  }

  /**
   * Lấy bảng băm bản ghi của MỘT bảng đã khai.
   * Nhận: tên bảng.
   * Trả: bảng băm ủy quyền của bảng đó; bảng chưa khai là LỖI NGƯỜI GỌI và ném `Error` thường.
   */
  private records(table: string): Map<string, unknown> {
    const records = this.state.tables.get(table);
    if (!records) throw new Error(`unit '${this.descriptor.name}' does not declare table '${table}'`);
    return records;
  }

  /**
   * Công bố trạng thái hiện tại ra tệp và theo dõi lượt ghi đang chạy.
   * Nhận: không.
   * Trả: promise của lượt ghi-đè nguyên tử (đã đăng ký để `close()` xả).
   */
  private publish(): Promise<void> {
    const write = writeAtomic(this.path, serialize(this.descriptor.name, this.state));
    this.inFlight.add(write);
    void write.catch(() => undefined).finally(() => this.inFlight.delete(write));
    return write;
  }
}
