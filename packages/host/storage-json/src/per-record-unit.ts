/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Một đơn vị JSON đã mở ở bố trí `per-record`: đơn vị là một THƯ MỤC, mỗi bản ghi một tài liệu dưới
 *      `<thư-mục>/<bảng>/<khoá>.json` cộng `global.json` cho ô toàn cục. THƯ MỤC là trạng thái — đơn vị
 *      này KHÔNG giữ bộ nhớ riêng (bản gốc: lib/types/per-record-unit.d.ts)
 */
import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { writeAtomic } from "./atomic.ts";
import { emptyState, parseRecord, serializeRecord } from "./format.ts";
import type { UnitState } from "./format.ts";
import { StorageError } from "./hub.ts";
import type { KvUnitDescriptorLike, KvUnitLike } from "./hub.ts";

/** Khoá trở thành ĐOẠN ĐƯỜNG DẪN ở bố trí này; tập này an toàn đường dẫn trên mọi hệ điều hành. */
const SAFE_KEY_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Mở MỘT đơn vị bố trí `per-record` dưới `root`: thư mục đơn vị là `<root>/<tên>/`. Nạp LƯỜI ở lượt
 * `loadAll` đầu tiên — đơn vị này không giữ trạng thái nên lượt mở KHÔNG chạm môi trường lưu.
 * Nhận: định danh và hình dạng tĩnh của đơn vị, gốc backend tuyệt đối, và callback nhả chỗ-đang-mở.
 * Trả: đơn vị đã mở (chưa đọc gì từ đĩa).
 */
export async function openPerRecordUnit(
  descriptor: KvUnitDescriptorLike,
  root: string,
  onClose: () => void,
): Promise<KvUnitLike> {
  return new PerRecordJsonUnit(descriptor, join(root, descriptor.name), onClose);
}

/**
 * Đọc MỌI tài liệu bản ghi dưới thư mục đơn vị: mỗi bảng đã khai có các tệp `<khoá>.json`, cộng
 * `global.json`. Thư mục vắng là đơn vị RỖNG (hiện thực hoá dời tới lượt ghi đầu); tài liệu NGOẠI LAI
 * (vắng, hỏng, hoặc mang phiên bản không được chấp nhận) đọc như bản ghi VẮNG.
 * Nhận: mô tả đơn vị và đường dẫn thư mục đơn vị tuyệt đối.
 * Trả: trạng thái ủy quyền dựng lại từ cây tệp (kèm bootstrap từ tệp legacy khi cây chưa có tài liệu nào).
 */
async function loadPerRecordState(descriptor: KvUnitDescriptorLike, dir: string): Promise<UnitState> {
  const versions = acceptedStamps(descriptor);
  const state = emptyState(descriptor);
  let entries: Dirent[] | undefined;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const scanned =
    entries === undefined
      ? []
      : await Promise.all(
          entries.map(async (entry) => {
            if (entry.isDirectory()) {
              const records = state.tables.get(entry.name);
              if (records !== undefined) return loadTableRecords(records, versions, join(dir, entry.name));
            }
            if (entry.name === "global.json" && descriptor.hasGlobal) {
              const global = await readRecord(join(dir, entry.name), versions);
              if (global !== undefined) state.global = global;
              return true;
            }
            return false;
          }),
        );
  if (!scanned.some(Boolean)) await bootstrapLegacyUnit(descriptor, dir, state);
  return state;
}

/**
 * Các dấu phiên bản mà đơn vị này đọc như CỦA MÌNH.
 * Nhận: mô tả đơn vị.
 * Trả: mảng phiên bản hiện tại cộng các phiên bản tương thích đã khai.
 */
function acceptedStamps(descriptor: KvUnitDescriptorLike): readonly number[] {
  return [descriptor.version, ...(descriptor.compatibleVersions ?? [])];
}

/**
 * Mồi một cây per-record RỖNG từ tệp cả-đơn-vị LEGACY (`<root>/<tên>.json`, bố trí trước per-record):
 * mọi bản ghi của bảng đã khai được chép thành tài liệu mang phiên bản HIỆN TẠI, còn tệp legacy được giữ
 * NGUYÊN. Tệp vắng, ngoại lai (tên đơn vị khác), hỏng, hoặc không phải tài liệu đơn vị đều được để yên —
 * và cả tệp mang phiên bản NGOÀI tập chấp nhận: migrate bản ghi mà chủ sở hữu chưa từng bảo lãnh sẽ đóng
 * dấu chúng bằng phiên bản hiện tại và biến một cache cũ đáng-bỏ thành lỗi schema ở tầng miền. Các lỗi
 * đọc khác thì LAN truyền.
 * Nhận: mô tả đơn vị, thư mục per-record của đơn vị, và trạng thái cây rỗng (bản ghi mồi được thêm vào).
 * Trả: promise phân giải sau khi đã mồi xong (hoặc bỏ qua vì không đủ điều kiện).
 */
async function bootstrapLegacyUnit(descriptor: KvUnitDescriptorLike, dir: string, state: UnitState): Promise<void> {
  const legacyPath = join(dirname(dir), `${descriptor.name}.json`);
  let text: string;
  try {
    text = await readFile(legacyPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return;
  }
  let document: unknown;
  try {
    document = JSON.parse(text) as unknown;
  } catch {
    return;
  }
  const fields = document as { unit?: { name?: unknown; version?: unknown }; tables?: unknown };
  if (fields.unit?.name !== descriptor.name) return;
  const stamped = fields.unit.version;
  if (typeof stamped !== "number" || !acceptedStamps(descriptor).includes(stamped)) return;
  const tables = fields.tables;
  if (typeof tables !== "object" || tables === null) return;
  for (const [table, records] of Object.entries(tables as Record<string, unknown>)) {
    const target = state.tables.get(table);
    if (target === undefined) continue;
    for (const [key, value] of Object.entries(records as Record<string, unknown>)) {
      const path = join(dir, table, `${key}.json`);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeAtomic(path, serializeRecord(descriptor.version, value));
      target.set(key, value);
    }
  }
}

/**
 * Đọc tài liệu bản ghi của MỘT bảng đã khai vào `records`.
 * Nhận: bảng băm đích, tập phiên bản chấp nhận, và thư mục của bảng.
 * Trả: CÓ hay KHÔNG có đường-dẫn-tài-liệu `.json` trong thư mục — độc lập với an toàn khoá, khả năng
 * đọc, và phiên bản đã lưu (đó là điều kiện chặn bootstrap legacy).
 */
async function loadTableRecords(
  records: Map<string, unknown>,
  versions: readonly number[],
  dir: string,
): Promise<boolean> {
  const files = await readdir(dir, { withFileTypes: true });
  const hasDocuments = files.some((file) => file.name.endsWith(".json"));
  const loaded = await Promise.all(
    files.map(async (file): Promise<[string, unknown] | undefined> => {
      if (!file.name.endsWith(".json")) return undefined;
      const key = file.name.slice(0, -5);
      if (!SAFE_KEY_RE.test(key)) return undefined;
      const record = await readRecord(join(dir, file.name), versions);
      if (record !== undefined) return [key, record];
      return undefined;
    }),
  );
  for (const record of loaded) if (record !== undefined) records.set(record[0], record[1]);
  return hasDocuments;
}

/**
 * Đọc MỘT tài liệu bản ghi; tài liệu NGOẠI LAI (không đọc được hoặc phiên bản cũ) đọc như VẮNG.
 * Nhận: đường dẫn tài liệu và tập phiên bản chấp nhận.
 * Trả: giá trị bản ghi, hoặc `undefined` khi tệp hỏng/ngoại lai.
 */
async function readRecord(path: string, versions: readonly number[]): Promise<unknown> {
  try {
    return parseRecord(await readFile(path, "utf8"), versions);
  } catch {
    return undefined;
  }
}

/**
 * Một đơn vị `per-record` đã mở. KHÔNG giữ trạng thái theo thiết kế: thư mục là môi trường lưu, tầng
 * miền giữ bộ nhớ sống, còn mỗi phương thức ở đây là MỘT thao tác tệp bền. Thứ tự ghi thuộc người gọi
 * (chuỗi ghi của tầng miền), y như đơn vị `single`.
 */
class PerRecordJsonUnit implements KvUnitLike {
  private readonly descriptor: KvUnitDescriptorLike;
  private readonly dir: string;
  private readonly onClose: () => void;
  private closed = false;
  /** Các lượt ghi bền đang chạy; `close()` xả hết trước khi nhả đơn vị. */
  private readonly inFlight = new Set<Promise<void>>();

  /**
   * Dựng đơn vị per-record từ mô tả đã có.
   * Nhận: mô tả đơn vị, thư mục đơn vị tuyệt đối, và callback nhả chỗ-đang-mở của backend.
   * Trả: đơn vị CHƯA đóng, chưa chạm môi trường lưu.
   */
  constructor(descriptor: KvUnitDescriptorLike, dir: string, onClose: () => void) {
    this.descriptor = descriptor;
    this.dir = dir;
    this.onClose = onClose;
  }

  /**
   * Đọc lại cả cây: thư mục là trạng thái ủy quyền.
   * Nhận: không.
   * Trả: bản ghi của mọi bảng đã khai + ô global; mỗi lượt trả vật thể MỚI.
   */
  async loadAll(): Promise<{ tables: Record<string, Record<string, unknown>>; global: unknown }> {
    this.assertOpen();
    const state = await loadPerRecordState(this.descriptor, this.dir);
    const tables: Record<string, Record<string, unknown>> = {};
    for (const [table, records] of state.tables) tables[table] = Object.fromEntries(records);
    return { tables, global: state.global };
  }

  /**
   * Ghi đè MỘT bản ghi cho bền: tài liệu RIÊNG của nó, nguyên tử.
   * Nhận: tên bảng đã khai, khoá bản ghi (phải an toàn đường dẫn), và giá trị JSON đục.
   * Trả: promise phân giải sau khi tài liệu đã bền; khoá không an toàn thì NÉM trước khi chạm đĩa.
   */
  async putRecord(table: string, key: string, value: unknown): Promise<void> {
    this.assertOpen();
    assertSafeKey(this.descriptor.name, key);
    await this.tracked(this.writeDocument(join(this.tableDir(table), `${key}.json`), value));
  }

  /**
   * Xoá MỘT bản ghi cho bền; idempotent (khoá vắng là no-op).
   * Nhận: tên bảng đã khai và khoá bản ghi (phải an toàn đường dẫn).
   * Trả: promise phân giải sau khi tài liệu đã bị xoá (hoặc đã vắng sẵn).
   */
  async deleteRecord(table: string, key: string): Promise<void> {
    this.assertOpen();
    assertSafeKey(this.descriptor.name, key);
    await this.tracked(rm(join(this.tableDir(table), `${key}.json`), { force: true }));
  }

  /**
   * Chuyển tài liệu của MỘT bản ghi sang chỗ khác dưới tên `<khoá>.json.bak.<YYYYMMDDHHmm>`. Tệp đã
   * chuyển KHÔNG còn kết thúc bằng `.json` nên mọi lượt đọc sau bỏ qua nó; byte vẫn nằm trên đĩa để
   * soát. Bản sao lưu CÙNG PHÚT của cùng khoá ghi đè bản trước (byte mới hơn là byte đáng giữ).
   * Nhận: tên bảng đã khai và khoá bản ghi (phải an toàn đường dẫn).
   * Trả: đường dẫn tài liệu đã chuyển tới.
   */
  async backupRecord(table: string, key: string): Promise<string> {
    this.assertOpen();
    assertSafeKey(this.descriptor.name, key);
    const path = join(this.tableDir(table), `${key}.json`);
    const moved = `${path}.bak.${backupStamp(new Date())}`;
    await this.tracked(rename(path, moved));
    return moved;
  }

  /**
   * Ghi ô singleton toàn cục cho bền.
   * Nhận: giá trị JSON đục cho ô global.
   * Trả: promise phân giải sau khi `global.json` đã bền; đơn vị KHÔNG khai global thì ném `Error` thường.
   */
  async setGlobal(value: unknown): Promise<void> {
    this.assertOpen();
    if (!this.descriptor.hasGlobal) throw new Error(`unit '${this.descriptor.name}' does not declare a global slot`);
    await this.tracked(this.writeDocument(join(this.dir, "global.json"), value));
  }

  /**
   * Xả các lượt ghi đang chạy rồi nhả đơn vị (gọi `onClose` ĐÚNG MỘT lần); idempotent.
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
   * Giải thư mục của MỘT bảng đã khai; bảng chưa khai là lỗi NGƯỜI GỌI và ném `Error` thường.
   * Nhận: tên bảng.
   * Trả: đường dẫn tuyệt đối của thư mục bảng dưới thư mục đơn vị.
   */
  private tableDir(table: string): string {
    if (!this.descriptor.tables.includes(table)) {
      throw new Error(`unit '${this.descriptor.name}' does not declare table '${table}'`);
    }
    return join(this.dir, table);
  }

  /**
   * Ghi-đè một tài liệu cho bền, tạo thư mục cha trước.
   * Nhận: đường dẫn tài liệu đích và giá trị bản ghi.
   * Trả: promise phân giải sau khi tài liệu đã bền.
   */
  private writeDocument(path: string, value: unknown): Promise<void> {
    return (async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeAtomic(path, serializeRecord(this.descriptor.version, value));
    })();
  }

  /**
   * Theo dõi MỘT lượt ghi bền để `close()` xả nó.
   * Nhận: promise của lượt ghi.
   * Trả: chính promise đó (đã đăng ký vào tập đang-chạy).
   */
  private tracked(write: Promise<void>): Promise<void> {
    this.inFlight.add(write);
    void write.catch(() => undefined).finally(() => this.inFlight.delete(write));
    return write;
  }
}

/**
 * Hậu tố `YYYYMMDDHHmm` theo GIỜ ĐỊA PHƯƠNG cho tài liệu đã sao lưu.
 * Nhận: mốc thời gian cần đóng dấu.
 * Trả: chuỗi 12 chữ số dùng làm đuôi tên tệp.
 */
function backupStamp(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * Từ chối khoá bản ghi không an toàn khi làm đoạn đường dẫn.
 * Nhận: tên đơn vị (cho câu lỗi) và khoá bản ghi.
 * Trả: không; khoá không khớp {@link SAFE_KEY_RE} thì ném `Error` thường kèm chính biểu thức mẫu.
 */
function assertSafeKey(unit: string, key: string): void {
  if (!SAFE_KEY_RE.test(key)) {
    throw new Error(`unit '${unit}': per-record key '${key}' is not path-safe (must match ${SAFE_KEY_RE})`);
  }
}
