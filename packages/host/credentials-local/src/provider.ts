/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Provider credentials cục bộ có tệp nền: đọc/ghi MỘT tài liệu YAML trong home của harness,
 *      xếp trên môi trường tiến trình theo thứ tự tệp quản lý > môi trường > .env dự án > .env home
 */

import { Service, type Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { watch } from "chokidar";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import {
  CredentialProvider,
  credentialRef,
  parseCredentialKey,
  type CredentialInfo,
  type CredentialKey,
  type CredentialRecord,
  type CredentialRecordEntry,
  type CredentialRecordInfo,
  type CredentialRef,
  type ResolvedCredential,
} from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "./environment.ts";
import {
  assertJsonValue,
  assertStorableApiKey,
  parseCredentialsDocument,
  sameJsonValue,
  type CredentialsDocument,
} from "./document.ts";
import { renderFlatLayoutMigration, renderRecord, renderRef } from "./render.ts";
import { canonicalizeWatchPath } from "./paths.ts";
import { assertOwnerOnly, isENOENT, resolveSpec, type Config, type ResolvedSpec } from "./spec.ts";

/**
 * Một lần ghi bản ghi chờ khoá người ghi liên tiến trình bao lâu. Một phép biến đổi bản ghi chạy
 * quyết định của nơi gọi TRONG LÚC giữ khoá, và với nửa mà provider này tồn tại để phục vụ — chủ
 * sở hữu làm mới một token đã hết hạn — quyết định đó gồm một vòng mạng. Mặc định của công việc
 * tệp sẽ làm mọi người ghi khác của tài liệu này hỏng trong suốt thời gian đó. Thời gian chờ của
 * một kẻ tranh khoá được định bởi người giữ lâu nhất mà nó có thể gặp, mà refs và records dùng
 * chung một tệp và một khoá, nên MỌI người ghi tài liệu này — ghi tham chiếu và xoá bản ghi
 * cũng vậy — đều chờ ngần này, không chỉ phép biến đổi đang giữ khoá. Như nhịp thử lại trong
 * dsh-atomic-write, đây là một chặn bền vững của giao thức ghi chứ không phải lựa chọn triển
 * khai: nó được định cỡ bởi cái mà một yêu cầu provider tốn, thứ không triển khai nào đổi.
 */
const DOCUMENT_LOCK_WAIT_MS = 30_000;

/** Provider credentials có tệp nền ($DSH_HOME/.credentials.yaml). */
export class LocalCredentialProvider extends CredentialProvider {
  /** Cấu hình thô mà row đã mount cấp. */
  config: Config;

  /** Lược đồ cấu hình để cordis kiểm và lấy mặc định trước khi dựng thực thể. */
  static Config = z.object({
    path: z.string(),
    dshHome: z.string(),
    watch: z.boolean().default(true),
    debounceMs: z.number().min(0).default(100),
  });

  /** Vị trí tệp và hành vi theo dõi đã giải. */
  private readonly spec: ResolvedSpec;

  /**
   * Văn bản thô của tài liệu ở lần đọc hoặc lần ghi gần nhất; undefined khi tệp vắng mặt.
   * Sự kiện của watcher mà nội dung bằng bộ đệm này là không-tác-dụng, và đó cũng chính là cách
   * tự triệt tiêu những lần ghi của chính mình.
   */
  private text: string | undefined;

  /** Ảnh chụp các tham chiếu đã phân tích; được THAY TRỌN mỗi lần nạp lại. */
  private values = new Map<string, string>();

  /** Ảnh chụp các bản ghi đã phân tích; được THAY TRỌN mỗi lần nạp lại. */
  private records = new Map<string, CredentialRecord>();

  /**
   * Một chuỗi thao tác DUY NHẤT: việc nạp lại do watcher và các phép sửa chạy lần lượt theo thứ
   * tự xếp hàng (đuôi đã lắng), nên một phép sửa không bao giờ kết xuất từ văn bản mà một lần
   * nạp lại đang bận thay thế.
   */
  private operations: Promise<void> = Promise.resolve();

  /** Đặt lúc dispose: từ chối mọi lần ghi mới và để công việc đang chạy thành không-tác-dụng. */
  private closed = false;

  /**
   * Dựng provider trên một context và cấu hình; lớp nền đăng ký service dưới tên `credentials`.
   * Nhận: context của plugin và cấu hình đã qua lược đồ.
   * Trả: thực thể provider.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx);
    this.config = config;
    this.spec = resolveSpec(config);
  }

  /** Đọc cờ `closed` một cách đục: luồng điều khiển không thể thu hẹp nó qua các điểm await. */
  private isClosed(): boolean {
    return this.closed;
  }

  /**
   * Giá trị của một tham chiếu trong môi trường KẾ THỪA, hoặc undefined khi rỗng hay chưa đặt.
   * Nhận: tên tham chiếu cần tra.
   * Trả: giá trị khác rỗng của lớp tiến trình, hoặc undefined.
   */
  private inherited(ref: CredentialRef): string | undefined {
    const entry = launchEnvironmentOf(this.ctx).getFrom(ref, ["process"]);
    return entry !== undefined && entry.value.length > 0 ? entry.value : undefined;
  }

  /**
   * Lớp dự phòng `.env` cho một tham chiếu — DƯỚI kho lưu do provider quản lý, không bao giờ trên
   * nó. Dự án đang gọi xếp trên tệp trong home của người dùng, khớp với cách xếp lớp của môi
   * trường: vị trí cụ thể hơn thắng.
   * Nhận: tên tham chiếu cần tra.
   * Trả: giá trị và lớp nguồn, hoặc undefined khi cả hai lớp đều không có.
   */
  private dotenvFallback(ref: CredentialRef): { value: string; source: string } | undefined {
    const entry = launchEnvironmentOf(this.ctx).getFrom(ref, ["project-env", "user-env"]);
    if (entry === undefined || entry.value.length === 0) return undefined;
    return { value: entry.value, source: String(entry.source) };
  }

  /**
   * Vòng đời của service: nạp tài liệu ở lần boot, rồi (nếu bật theo dõi) dựng watcher phát thay
   * đổi vào seam. Mỗi `yield` là một hàm dọn được cordis đăng ký theo fiber của plugin.
   * Nhận: không (cordis gọi qua ký hiệu Service.init).
   * Trả: generator bất đồng bộ của các hàm dọn.
   */
  async *[Service.init](): AsyncGenerator<() => Promise<void> | void, void, void> {
    yield async () => {
      this.closed = true;
      await this.operations;
    };
    await this.loadInitial();
    if (!this.spec.watch) return;
    const watcher = watch(await canonicalizeWatchPath(this.spec.filename), {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.spec.debounceMs,
        pollInterval: Math.max(1, Math.min(this.spec.debounceMs, 10)),
      },
    });
    watcher.on("all", () => {
      if (this.closed) return;
      this.queueRefresh();
    });
    watcher.on("ready", () => {
      if (this.closed) return;
      this.queueRefresh();
    });
    const reportWatcherError = (error: unknown): void => {
      if (this.closed) return;
      this.ctx.logger.warn("credentials-local: watcher error on %s", this.spec.filename);
      this.ctx.logger.warn(error);
    };
    watcher.on("error", reportWatcherError);
    yield async () => {
      this.closed = true;
      const closing = watcher.close();
      watcher.on("error", reportWatcherError);
      await closing;
      await this.operations;
    };
  }

  /**
   * Giải một tham chiếu thành giá trị hiện tại theo thứ tự: tệp quản lý, môi trường kế thừa,
   * `.env` của dự án, rồi `.env` của home.
   * Nhận: tên tham chiếu cần giải.
   * Trả: giá trị kèm lớp nguồn, hoặc undefined khi chưa cấu hình.
   */
  resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const stored = this.values.get(ref);
    if (stored !== undefined) return Promise.resolve({ value: stored, source: "file" });
    const inherited = this.inherited(ref);
    if (inherited !== undefined) return Promise.resolve({ value: inherited, source: "env" });
    const fallback = this.dotenvFallback(ref);
    if (fallback !== undefined) return Promise.resolve({ value: fallback.value, source: fallback.source });
    return Promise.resolve(undefined);
  }

  /**
   * Mô tả một tham chiếu cho bề mặt cấu hình mà KHÔNG lộ giá trị.
   * Nhận: tên tham chiếu cần mô tả.
   * Trả: đã cấu hình hay chưa, lớp đang cấp giá trị và khả năng ghi.
   */
  describe(ref: CredentialRef): Promise<CredentialInfo> {
    if (this.values.get(ref) !== undefined) return Promise.resolve({ configured: true, source: "file", writable: true });
    if (this.inherited(ref) !== undefined) return Promise.resolve({ configured: true, source: "env", writable: true });
    const fallback = this.dotenvFallback(ref);
    if (fallback !== undefined) return Promise.resolve({ configured: true, source: fallback.source, writable: true });
    return Promise.resolve({ configured: false, writable: true });
  }

  /**
   * Ghi bền một giá trị vào nguồn do provider quản lý; giá trị RỖNG bị từ chối, hãy dùng `unset`.
   * Nhận: tên tham chiếu và giá trị khác rỗng.
   * Trả: không; hoàn tất khi tài liệu đã được ghi xuống.
   */
  async set(ref: CredentialRef, value: string): Promise<void> {
    if (value.length === 0) {
      throw new Error("credentials-local: an empty value cannot be stored for " + JSON.stringify(ref) + "; use unset");
    }
    await this.write(ref, value);
  }

  /**
   * Gỡ một tham chiếu khỏi nguồn do provider quản lý; gỡ một tham chiếu vắng mặt là không-tác-dụng.
   * Nhận: tên tham chiếu cần gỡ.
   * Trả: không; hoàn tất khi tài liệu đã được ghi xuống.
   */
  async unset(ref: CredentialRef): Promise<void> {
    await this.write(ref, undefined);
  }

  /**
   * Đọc MỘT bản ghi đã lưu, trả về đúng như chủ sở hữu đã viết.
   * Nhận: khoá bản ghi.
   * Trả: bản ghi, hoặc undefined khi chưa lưu gì.
   */
  readRecord(key: CredentialKey): Promise<CredentialRecord | undefined> {
    return Promise.resolve(this.records.get(key));
  }

  /**
   * Mô tả MỘT bản ghi cho bề mặt cấu hình mà không lộ giá trị.
   * Nhận: khoá bản ghi.
   * Trả: đã có bản ghi hay chưa, thẻ của nó và khả năng ghi.
   */
  describeRecord(key: CredentialKey): Promise<CredentialRecordInfo> {
    const stored = this.records.get(key);
    if (stored === undefined) return Promise.resolve({ configured: false, writable: true });
    return Promise.resolve({ configured: true, kind: stored.kind, writable: true });
  }

  /**
   * Liệt kê địa chỉ và thẻ của MỌI bản ghi đã lưu (không kèm giá trị).
   * Nhận: không.
   * Trả: danh sách bản ghi theo thứ tự trong tài liệu.
   */
  listRecords(): Promise<readonly CredentialRecordEntry[]> {
    return Promise.resolve([...this.records].map(([key, record]) => ({ key: parseCredentialKey(key), kind: record.kind })));
  }

  /**
   * Đọc–quyết–thay MỘT bản ghi dưới khoá người ghi liên tiến trình — đường ghi DUY NHẤT của nửa
   * bản ghi. Hàm quyết định thấy bản ghi đúng lúc lần ghi là độc quyền, và trả undefined nghĩa là
   * để nguyên mục đó.
   * Nhận: khoá bản ghi và hàm quyết định nhận bản ghi hiện tại, trả bản ghi thay thế hoặc undefined.
   * Trả: bản ghi sau lần ghi, hoặc bản ghi hiện tại khi hàm quyết định từ chối.
   */
  async modifyRecord(
    key: CredentialKey,
    mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    if (this.isClosed()) throw new Error("credentials-local is disposed: cannot modify " + JSON.stringify(key));
    return this.enqueue(async () => {
      if (this.isClosed()) {
        throw new Error("credentials-local was disposed before the queued " + JSON.stringify(key) + " modify ran");
      }
      await mkdir(dirname(this.spec.filename), { recursive: true, mode: 0o700 });
      return withFileLock(
        this.spec.filename,
        async () => {
          await this.reconcileFromDisk();
          const current = this.records.get(key);
          const next = await mutate(current);
          if (next === undefined) return current;
          if (next.kind === "grant") assertJsonValue("record " + JSON.stringify(key) + " payload", next.payload, new Set());
          else assertStorableApiKey(key, next);
          const nextText = renderRecord(this.text, key, next);
          await writeFileAtomic(this.spec.filename, nextText, { mode: 0o600, dirMode: 0o700 });
          this.text = nextText;
          this.records.set(key, next);
          this.notifyRecordUpdated(key);
          return next;
        },
        { waitMs: DOCUMENT_LOCK_WAIT_MS },
      );
    });
  }

  /**
   * Gỡ MỘT bản ghi dưới khoá người ghi liên tiến trình; gỡ một bản ghi vắng mặt là không-tác-dụng.
   * Nhận: khoá bản ghi cần gỡ.
   * Trả: không; hoàn tất khi tài liệu đã được ghi xuống.
   */
  async deleteRecord(key: CredentialKey): Promise<void> {
    if (this.isClosed()) throw new Error("credentials-local is disposed: cannot delete " + JSON.stringify(key));
    await this.enqueue(async () => {
      if (this.isClosed()) {
        throw new Error("credentials-local was disposed before the queued " + JSON.stringify(key) + " delete ran");
      }
      await mkdir(dirname(this.spec.filename), { recursive: true, mode: 0o700 });
      await withFileLock(
        this.spec.filename,
        async () => {
          await this.reconcileFromDisk();
          if (!this.records.has(key)) return;
          const nextText = renderRecord(this.text, key, undefined);
          await writeFileAtomic(this.spec.filename, nextText, { mode: 0o600, dirMode: 0o700 });
          this.text = nextText;
          this.records.delete(key);
          this.notifyRecordUpdated(key);
        },
        { waitMs: DOCUMENT_LOCK_WAIT_MS },
      );
    });
  }

  /**
   * Xếp MỘT thao tác độc quyền lên tài liệu sau mọi thao tác trước đó.
   * Nhận: thao tác cần chạy.
   * Trả: kết quả của thao tác; đuôi chuỗi luôn đã lắng nên một lần hỏng không chặn lần sau.
   */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.operations.then(operation);
    this.operations = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  /** Xếp một lần nạp lại; hàm nạp lại tự chứa lỗi của nó nên việc đã xếp không bao giờ ném. */
  private queueRefresh(): void {
    void this.enqueue(() => this.refresh());
  }

  /**
   * Xếp MỘT phép sửa: kiểm dispose lúc vào hàng và kiểm lại khi phép sửa đã xếp chạy.
   * Nhận: tên tham chiếu và giá trị mới (undefined nghĩa là gỡ).
   * Trả: không; hoàn tất khi tài liệu đã được ghi xuống.
   */
  private async write(ref: CredentialRef, value: string | undefined): Promise<void> {
    const verb = value === undefined ? "unset" : "set";
    if (this.isClosed()) {
      throw new Error("credentials-local is disposed: cannot " + verb + " " + JSON.stringify(ref));
    }
    return this.enqueue(async () => {
      if (this.isClosed()) {
        throw new Error("credentials-local was disposed before the queued " + JSON.stringify(ref) + " " + verb + " ran");
      }
      await mkdir(dirname(this.spec.filename), { recursive: true, mode: 0o700 });
      await withFileLock(
        this.spec.filename,
        async () => {
          await this.reconcileFromDisk();
          const existing = this.values.get(ref);
          if (value === undefined && existing === undefined) return;
          const nextText = renderRef(this.text, ref, value);
          await writeFileAtomic(this.spec.filename, nextText, { mode: 0o600, dirMode: 0o700 });
          this.text = nextText;
          if (value === undefined) this.values.delete(ref);
          else this.values.set(ref, value);
          this.notifyUpdated(ref);
        },
        { waitMs: DOCUMENT_LOCK_WAIT_MS },
      );
    });
  }

  /**
   * Đọc lúc boot: tệp vắng mặt là kho rỗng; một tệp KHÔNG HỢP LỆ làm activation của plugin hỏng,
   * vì một tài liệu credentials tồn tại mà không tin được thì không bao giờ được coi là "không
   * lưu credential nào". Ngoại lệ duy nhất là bố cục phẳng thời tiền phát hành đã nhận diện, được
   * nâng cấp TẠI CHỖ trước — một khoá do bản build trước lưu phải sống sót qua thay đổi bố cục mà
   * không cần sửa tay.
   * Nhận: không.
   * Trả: không; ném lỗi khi tài liệu tồn tại mà không phân tích được.
   */
  private async loadInitial(): Promise<void> {
    await assertOwnerOnly(this.spec.filename);
    let text: string;
    try {
      text = await readFile(this.spec.filename, "utf8");
    } catch (error) {
      if (!isENOENT(error)) throw error;
      return;
    }
    if (renderFlatLayoutMigration(text) !== undefined) text = await this.migrateFlatDocument();
    const document = parseCredentialsDocument(text, this.spec.filename);
    this.warnIgnoredKeys(document);
    this.values = document.refs;
    this.records = document.records;
    this.text = text;
  }

  /**
   * Nâng cấp MỘT LẦN bố cục phẳng thời tiền phát hành đã nhận diện, trước khi watcher tồn tại. Bản
   * viết lại chạy dưới khoá người ghi của tài liệu và ĐỌC LẠI trước — một lần boot khác có thể đã
   * nâng cấp rồi — và bất cứ gì lần đọc lại thấy mà không phải bố cục phẳng được trả về nguyên vẹn
   * cho phép phân tích thường. Giá trị được mang nguyên văn; chỉ bố cục bao ngoài đổi.
   * Nhận: không.
   * Trả: văn bản tài liệu mà lần boot này nên phân tích.
   */
  private async migrateFlatDocument(): Promise<string> {
    return withFileLock(
      this.spec.filename,
      async () => {
        const current = await readFile(this.spec.filename, "utf8");
        const migrated = renderFlatLayoutMigration(current);
        if (migrated === undefined) return current;
        await writeFileAtomic(this.spec.filename, migrated, { mode: 0o600, dirMode: 0o700 });
        this.ctx.logger.info(
          "credentials-local: migrated %s to the version %d layout; values are unchanged",
          this.spec.filename,
          1,
        );
        return migrated;
      },
      { waitMs: DOCUMENT_LOCK_WAIT_MS },
    );
  }

  /**
   * Đọc lại tài liệu sau một sự kiện của watcher. Nội dung không đổi (kể cả những lần ghi của
   * chính provider này) là không-tác-dụng; một tài liệu không đọc được thì GIỮ ảnh chụp tốt cuối
   * cùng và cảnh báo — một lần nạp lại nóng đang chạy không bao giờ được kéo tiến trình xuống.
   * Nhận: không.
   * Trả: không.
   */
  private async refresh(): Promise<void> {
    if (this.closed) return;
    try {
      await this.reconcileFromDisk();
    } catch (error) {
      this.ctx.logger.warn("credentials-local: reload failed at %s; keeping the last good document", this.spec.filename);
      this.ctx.logger.warn(error);
    }
  }

  /**
   * So văn bản trên đĩa với bộ đệm và phát mọi khác biệt vào seam. Vắng mặt phát kho RỖNG; một tài
   * liệu không đọc được hoặc không hợp lệ thì NÉM, để mỗi nơi gọi chọn chính sách của nó — nạp lại
   * thì cảnh báo và giữ ảnh chụp tốt cuối, còn ghi thì hỏng ồn ào thay vì ghi đè lên một tài liệu
   * nó không hiểu được.
   * Nhận: không.
   * Trả: không; ném lỗi khi tài liệu trên đĩa không tin được.
   */
  private async reconcileFromDisk(): Promise<void> {
    await assertOwnerOnly(this.spec.filename);
    let text: string | undefined;
    try {
      text = await readFile(this.spec.filename, "utf8");
    } catch (error) {
      if (!isENOENT(error)) throw error;
      text = undefined;
    }
    if (text === this.text || this.isClosed()) return;
    const next: CredentialsDocument =
      text === undefined
        ? { refs: new Map(), records: new Map(), ignoredKeys: [] }
        : parseCredentialsDocument(text, this.spec.filename);
    this.warnIgnoredKeys(next);
    const changedRefs = this.changedRefs(this.values, next.refs);
    const changedRecords = this.changedRecords(this.records, next.records);
    this.text = text;
    this.values = next.refs;
    this.records = next.records;
    for (const ref of changedRefs) this.notifyUpdated(ref);
    for (const key of changedRecords) this.notifyRecordUpdated(key);
  }

  /**
   * Báo các khoá cấp 1 không giải ra giá trị nào; CHỈ tên khoá được in, không bao giờ in giá trị.
   * Nhận: tài liệu vừa phân tích.
   * Trả: không.
   */
  private warnIgnoredKeys(document: CredentialsDocument): void {
    if (document.ignoredKeys.length === 0) return;
    this.ctx.logger.warn(
      "credentials-local: ignoring unknown top-level keys %s in %s; only refs and records entries resolve",
      document.ignoredKeys.map((key) => JSON.stringify(key)).join(", "),
      this.spec.filename,
    );
  }

  /**
   * Các tham chiếu có giá trị đã đổi; bộ phân tích đã chứng minh mọi khoá định địa chỉ được.
   * Nhận: ảnh chụp trước và ảnh chụp sau.
   * Trả: danh sách tên tham chiếu đã đổi.
   */
  private changedRefs(prev: Map<string, string>, next: Map<string, string>): CredentialRef[] {
    const changed: CredentialRef[] = [];
    for (const key of new Set([...prev.keys(), ...next.keys()])) {
      if (prev.get(key) === next.get(key)) continue;
      changed.push(credentialRef(key));
    }
    return changed;
  }

  /**
   * Các bản ghi có giá trị đã đổi; bộ phân tích đã chứng minh mọi khoá định địa chỉ được.
   * Nhận: ảnh chụp trước và ảnh chụp sau.
   * Trả: danh sách khoá bản ghi đã đổi.
   */
  private changedRecords(prev: Map<string, CredentialRecord>, next: Map<string, CredentialRecord>): CredentialKey[] {
    const changed: CredentialKey[] = [];
    for (const key of new Set([...prev.keys(), ...next.keys()])) {
      if (sameJsonValue(prev.get(key), next.get(key))) continue;
      changed.push(parseCredentialKey(key));
    }
    return changed;
  }
}
