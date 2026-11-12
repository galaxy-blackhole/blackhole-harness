/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bo dieu phoi entry cua trang: doi chieu do thi Host voi cay Loader, thu lai va thay code
 */

import {
  describeRelease,
  readRelease,
  sameRelease,
  parseBootManifest,
  type BootManifest,
  type BootReleaseWire,
} from "./manifest.ts";
import type { EntryModuleAccess, ClientModuleIndex } from "./system.ts";

/** Trạng thái fiber đang hoạt động trong const enum của cordis (bundle không import được enum runtime). */
const ACTIVE = 2;
/** Trạng thái fiber đã hỏng. */
const FAILED = 3;

/** Một lần nạp hỏng mà trang phải kể ra cho người dùng. */
export interface SyncFailure {
  /** Id package hỏng. */
  id: string;
  /** Văn bản lỗi. */
  message: string;
}

/** Ảnh chụp trạng thái đồng bộ của trang. */
export interface SyncSnapshot {
  /** true khi đang đối chiếu đồ thị. */
  syncing: boolean;
  /** Các lần nạp hỏng của lần đối chiếu gần nhất. */
  failures: SyncFailure[];
}

/** Nguồn quan sát được cho React (useSyncExternalStore). */
export interface Observable<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Đăng ký người nghe; trả hàm huỷ đăng ký. */
  subscribe(listener: () => void): () => void;
}

/** Fiber của một entry Loader (hợp đồng kernel cấp, khai báo theo cấu trúc để nửa browser không kéo cordis vào bundle). */
export interface LoaderFiber {
  /** Mã trạng thái; 2 là active, 3 là failed. */
  state: number;
  /** Chờ fiber đạt trạng thái ổn định. */
  await(): Promise<unknown>;
  /** Cập nhật config của entry khi fiber đã chết. */
  update(config: unknown): void;
  /** Hiệu ứng đang chạy dở; phải chờ trước khi thay code. */
  inertia?: Promise<unknown>;
  /** Vòng đời đã đăng ký (cần gỡ khi thay code). */
  runtime: { callback: unknown } | null;
}

/** Entry của Loader mà bộ điều phối này sở hữu. */
export interface LoaderEntry {
  /** Id entry do Loader cấp. */
  id: string;
  /** Tuỳ chọn entry, trong đó `name` là tên package. */
  options: { name: string; config?: unknown };
  /** Fiber của plugin; vắng khi entry chưa nạp được module. */
  fiber?: LoaderFiber;
  /** Context của entry (effect + registry để gỡ vòng đời). */
  ctx: { effect(callback: () => () => unknown, label?: string): void; registry: { delete(callback: unknown): void } };
  /** Thay code của entry sau khi đã gỡ fiber. */
  refresh(): Promise<void>;
}

/** Loader của vỏ: nơi bộ điều phối tạo, gỡ và chờ entry. */
export interface ClientLoader {
  /** Context gốc của Loader (để đăng ký effect dọn dẹp). */
  ctx: { effect(callback: () => () => unknown, label?: string): void };
  /** Danh sách entry hiện có. */
  entries(): LoaderEntry[];
  /** Cấp id ổn định cho một entry trước khi tạo. */
  ensureId(options: { name: string }): string;
  /** Tạo và nạp một entry. */
  create(options: { name: string }): Promise<unknown>;
  /** Tra entry theo id đã cấp. */
  resolve(entryId: string): LoaderEntry;
  /** Gỡ entry theo id. */
  remove(entryId: string): void;
  /** Chờ mọi entry đạt trạng thái ổn định. */
  await(): Promise<unknown>;
}

/**
 * Gỡ vòng đời runtime của một entry trước khi xoá fiber, để Loader có thể nạp code mới.
 * Việc xoá bản ghi trong registry khiến Loader không hiểu nhầm lần thay thế này là người dùng tắt plugin.
 * Nhận: entry cần giữ lại để thay code.
 * Trả: không sau khi fiber đã tắt và đã bị xoá.
 */
export async function tearDownEntryFiber(entry: LoaderEntry): Promise<void> {
  const fiber = entry.fiber;
  if (fiber === undefined) return;
  const runtime = fiber.runtime;
  if (runtime !== null) entry.ctx.registry.delete(runtime.callback);
  while (fiber.inertia !== undefined) await fiber.inertia;
  delete entry.fiber;
}

/**
 * Xoá các thẻ style do một plugin sở hữu, sau khi hiệu ứng dọn dẹp của nó đã yên.
 * Nhận: id package sở hữu style.
 * Trả: không.
 */
export function removeOwnedStyles(id: string): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll("style[data-plugin]")) {
    if (el.getAttribute("data-plugin") === id) el.remove();
  }
}

/** Revisions và yêu cầu xác định code mong muốn; URL chỉ chọn tài nguyên bất biến để giao nó. */
function entryTargets(manifest: BootManifest): string {
  return JSON.stringify(manifest.modules.map((row) => [row.id, row.rev, row.inject, row.external]));
}

/** Gọi mọi người nghe; một người nghe ném lỗi không được bỏ qua những người còn lại. */
function notifySubscribers(listeners: Set<() => void>, label: string): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.error("client-modules: " + label + " subscriber failed", error);
    }
  }
}

/**
 * Theo dõi release của Host đang kết nối so với release lúc trang boot.
 * Trang chỉ áp đồ thị và frame dựng lại khi hai bên khớp, nên mọi module nó chạy đều thuộc release
 * mà nó khởi động; release khác phải chờ nạp lại trang. Một lần lệch được thông báo trừ khi người
 * dùng đã bỏ qua đúng release đó.
 */
export class ReleaseChangeGate {
  /** Release lúc trang boot. */
  private readonly page: BootReleaseWire | undefined;
  /** Release của Host đang kết nối. */
  private host: BootReleaseWire | undefined;
  /** Release mà trang đã bỏ qua; giữ trong bộ nhớ trang. */
  private dismissed: { release: BootReleaseWire | undefined } | undefined;
  /** Ảnh chụp hiện tại của thay đổi release. */
  private snapshot: { page: BootReleaseWire | undefined; previous: BootReleaseWire | undefined; host: BootReleaseWire | undefined } | undefined;
  private readonly listeners = new Set<() => void>();

  /** Nguồn quan sát cho lớp UI cảnh báo. */
  readonly change: Observable<{ page: BootReleaseWire | undefined; previous: BootReleaseWire | undefined; host: BootReleaseWire | undefined } | undefined> = {
    getSnapshot: () => this.snapshot,
    subscribe: (listener: () => void) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    },
  };

  /**
   * Bắt đầu với chính Host đã phát đồ thị boot.
   * Nhận: release của đồ thị boot.
   * Trả: thực thể cổng.
   */
  constructor(page: BootReleaseWire | undefined) {
    this.page = page;
    this.host = page;
  }

  /** true khi Host đang kết nối phục vụ đúng release mà trang đã boot. */
  get matches(): boolean {
    return sameRelease(this.host, this.page);
  }

  /**
   * Ghi nhận release của một đồ thị Host vừa nhận và cập nhật thông báo.
   * Nhận: release của đồ thị nhận được.
   * Trả: true khi đồ thị thuộc release mà trang đã boot và được phép áp dụng.
   */
  observe(release: BootReleaseWire | undefined): boolean {
    const previous = this.host;
    this.host = release;
    if (this.matches || (this.dismissed !== undefined && sameRelease(release, this.dismissed.release))) {
      if (this.snapshot !== undefined) this.publish(undefined);
    } else if (this.snapshot === undefined || !sameRelease(this.snapshot.host, release)) {
      console.warn(
        "client-modules: Host release changed from " + describeRelease(previous) + " to " + describeRelease(release) + "; plugin updates pause until this page reloads",
      );
      this.publish({ page: this.page, previous, host: release });
    }
    return this.matches;
  }

  /** Ngừng thông báo release của Host; trang vẫn giữ release boot và vẫn không áp release nào khác. */
  dismiss(): void {
    if (this.snapshot === undefined) return;
    this.dismissed = { release: this.host };
    this.publish(undefined);
  }

  private publish(snapshot: ReleaseChangeGate["snapshot"]): void {
    this.snapshot = snapshot;
    notifySubscribers(this.listeners, "release change");
  }
}

/**
 * Bộ điều phối chỉ quản các entry do manifest Host tạo ra; mọi entry của người đóng góp khác vẫn thuộc
 * quyền họ. Nó giữ nguyên chuỗi đối chiếu để một đồ thị đến muộn không bao giờ gắn sau khi mục tiêu
 * của nó đã đổi.
 */
export class ClientEntries {
  private readonly modules: EntryModuleAccess;
  private readonly index: ClientModuleIndex;
  /** Nguồn quan sát trạng thái đồng bộ cho chẩn đoán của trang. */
  readonly state: Observable<SyncSnapshot> = {
    getSnapshot: () => this.snapshot,
    subscribe: (listener: () => void) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    },
  };
  private snapshot: SyncSnapshot = { syncing: false, failures: [] };
  private readonly listeners = new Set<() => void>();
  /** Cổng chỉ cho đồ thị của đúng release mà trang đã boot đi qua. */
  private readonly release: ReleaseChangeGate;
  private readonly managed = new Map<string, LoaderEntry>();
  private readonly revisions = new Map<string, string>();
  private loader: ClientLoader | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private desired: BootManifest;
  private generation = 0;
  private stopped = false;

  /**
   * Dựng bộ điều phối trước khi cây cordis boot.
   * Nhận: hệ module (nạp và vạt chất hoá) và chỉ số descriptor nội bộ.
   * Trả: thực thể bộ điều phối.
   */
  constructor(modules: EntryModuleAccess, index: ClientModuleIndex) {
    this.modules = modules;
    this.index = index;
    this.desired = modules.manifest;
    this.release = new ReleaseChangeGate(modules.manifest.release);
  }

  /** Thay đổi release của Host cần thông báo; undefined khi Host phục vụ release boot hoặc release đã bỏ qua. */
  get releaseChange(): ReleaseChangeGate["change"] {
    return this.release.change;
  }

  /** Ngừng thông báo release của Host đang kết nối; cập nhật vẫn tạm dừng tới khi nạp lại trang. */
  dismissRelease(): void {
    this.release.dismiss();
  }

  /**
   * Tạo đội hình entry ban đầu và giữ danh tính của chúng cho các lần đối chiếu sau.
   * Nhận: Loader của trang (đã cấu hình hệ module) và manifest ban đầu.
   * Trả: sau khi entry ban đầu và activation của chúng đã yên; bản kiểm toán boot do phía gọi lo.
   */
  start(loader: ClientLoader, manifest: BootManifest): Promise<unknown> {
    if (this.loader !== undefined) throw new Error("client-modules: entries already started");
    this.loader = loader;
    this.desired = manifest;
    loader.ctx.effect(
      () => () => {
        this.stopped = true;
        this.generation++;
        return this.queue;
      },
      "client-modules: entry reconciliation",
    );
    return this.enqueue(async () => {
      await Promise.all(
        this.desired.plugins.map(async ({ id }) => {
          await this.create(loader, id);
        }),
      );
      await loader.await();
      for (const row of this.modules.manifest.modules) this.revisions.set(row.id, row.rev);
    });
  }

  /**
   * Validate và áp đồ thị Host đầy đủ mới nhất. Mục tiêu đã đổi sẽ huỷ các mối nối cũ; mục tiêu giống
   * nhau thì chia sẻ lần nạp đang chờ.
   * Nhận: đồ thị đã giải mã JSON nhận từ Host.
   * Trả: sau khi hàng đợi đối chiếu xong, hoặc ngay lập tức nếu là release khác.
   */
  sync(graph: unknown): Promise<unknown> {
    if (!this.release.observe(readRelease(graph))) return Promise.resolve();
    const manifest = parseBootManifest(graph);
    if (entryTargets(manifest) !== entryTargets(this.desired)) this.generation++;
    this.desired = manifest;
    const generation = this.generation;
    return this.enqueue(() => this.reconcile(generation));
  }

  /**
   * Thử lại các entry đã hỏng theo đồ thị mới nhất, kể cả khi revision không đổi.
   * Nhận: không.
   * Trả: sau khi lần thử lại yên; lỗi còn lại nằm trong `state`.
   */
  retry(): Promise<unknown> {
    const generation = ++this.generation;
    return this.enqueue(() => this.reconcile(generation));
  }

  /**
   * Thay code của một entry trong cùng hàng đợi với cập nhật đồ thị; revision trùng thì bỏ qua.
   * Nhận: id package từ frame dựng lại và revision chọn artifact mới.
   * Trả: sau khi công việc trong hàng đợi xong.
   */
  reload(id: string, rev: string): Promise<unknown> {
    if (!this.release.matches) return Promise.resolve();
    this.desired = {
      ...this.desired,
      modules: this.desired.modules.map((row) => (row.id === id ? { ...row, rev } : row)),
    };
    return this.enqueue(async () => {
      const desired = this.desired.modules.find((row) => row.id === id);
      if (this.stopped || desired === undefined) return;
      const entry = this.managed.get(id);
      if (entry === undefined) {
        this.modules.invalidate(id, desired.rev);
        removeOwnedStyles(id);
        await this.reconcile(this.generation);
        return;
      }
      if (this.revisions.get(id) === rev) return;
      this.publish({ syncing: true, failures: this.snapshot.failures.filter((failure) => failure.id !== id) });
      await this.replace(entry, id, rev, this.generation);
      this.publish({ syncing: false, failures: this.snapshot.failures });
    }, id);
  }

  /** Phát ảnh chụp mới cho người nghe. */
  private publish(snapshot: SyncSnapshot): void {
    this.snapshot = snapshot;
    notifySubscribers(this.listeners, "synchronization");
  }

  /** Xếp một việc vào hàng đợi duy nhất và biến lỗi của nó thành một mục trong `state`. */
  private enqueue(task: () => Promise<void>, subject = "graph"): Promise<unknown> {
    const run = this.queue.then(task);
    this.queue = run.then(
      () => undefined,
      (error: unknown) => {
        this.publish({
          syncing: false,
          failures: [...this.snapshot.failures.filter((failure) => failure.id !== subject), { id: subject, message: String(error) }],
        });
      },
    );
    return run;
  }

  /** Việc trong hàng đợi còn thuộc thế hệ mong muốn hay không. */
  private current(generation: number): boolean {
    return !this.stopped && generation === this.generation;
  }

  /** Tạo một entry Loader cho một dòng và giữ quyền sở hữu nó kể cả khi Loader từ chối export plugin. */
  private async create(loader: ClientLoader, id: string): Promise<void> {
    const options = { name: id };
    const entryId = loader.ensureId(options);
    try {
      await loader.create(options);
    } finally {
      this.managed.set(id, loader.resolve(entryId));
    }
  }

  /** Nạp lại code của một entry đã có: gỡ fiber cũ, xoá style, nạp code mới rồi refresh entry. */
  private async replace(entry: LoaderEntry, id: string, rev: string, generation: number): Promise<void> {
    this.index.invalidateForReplacement(id, rev);
    await this.modules.prefetch(id);
    if (!this.current(generation)) return;
    await tearDownEntryFiber(entry);
    removeOwnedStyles(id);
    if (!this.current(generation)) return;
    await this.modules.import(id);
    if (!this.current(generation)) return;
    await entry.refresh();
    await entry.fiber?.await();
    if (entry.fiber === undefined) throw new Error("client-modules: " + id + " import failed (see console)");
    this.revisions.set(id, rev);
  }

  /**
   * Đối chiếu cây entry đang sống với đồ thị mong muốn: gỡ entry không còn, tạo entry mới, thay code
   * khi revision đổi, và ghi lại mọi lần nạp hỏng.
   * Nhận: số thế hệ mong muốn.
   * Trả: không; `state` mang danh sách lỗi.
   */
  private async reconcile(generation: number): Promise<void> {
    if (!this.current(generation)) return;
    const loader = this.loader;
    if (loader === undefined) throw new Error("client-modules: entries have not started");
    const manifest = this.desired;
    this.publish({ syncing: true, failures: [] });
    const failures: SyncFailure[] = [];
    this.index.update(manifest, this.managed.keys());
    const wanted = new Set(manifest.plugins.map((row) => row.id));
    for (const [id, entry] of [...this.managed]) {
      if (wanted.has(id)) continue;
      const fiber = entry.fiber;
      loader.remove(entry.id);
      this.managed.delete(id);
      this.revisions.delete(id);
      while (fiber?.inertia !== undefined) await fiber.inertia;
    }
    for (const row of manifest.modules) {
      if (!this.current(generation)) break;
      try {
        const entry = this.managed.get(row.id);
        if (entry === undefined) {
          await this.modules.prefetch(row.id);
          if (!this.current(generation)) break;
          await this.modules.import(row.id);
          if (!this.current(generation)) break;
          await this.create(loader, row.id);
          this.revisions.set(row.id, row.rev);
        } else if (this.revisions.get(row.id) !== row.rev) {
          await this.replace(entry, row.id, row.rev, generation);
        } else if (entry.fiber === undefined) {
          await this.replace(entry, row.id, row.rev, generation);
        } else if (entry.fiber.state === FAILED) {
          entry.fiber.update(entry.options.config);
        }
      } catch (error) {
        failures.push({ id: row.id, message: String(error) });
      }
    }
    await loader.await();
    for (const [id, entry] of this.managed) {
      if (failures.some((failure) => failure.id === id)) continue;
      if (entry.fiber?.state === ACTIVE) continue;
      try {
        if (entry.fiber === undefined) throw new Error("client-modules: " + id + " import failed (see console)");
        await entry.fiber.await();
        failures.push({ id, message: "client-modules: " + id + " is waiting for activation" });
      } catch (error) {
        failures.push({ id, message: String(error) });
      }
    }
    this.index.prune([...loader.entries()].map((entry) => entry.options.name));
    if (this.current(generation)) this.publish({ syncing: false, failures });
  }
}
