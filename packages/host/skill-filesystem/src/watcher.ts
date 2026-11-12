/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Watcher host của skill-filesystem — port NGUYÊN VĂN SkillWatchManager trong bundle gốc
 *      @galaxy-blackhole/gbh-skill-filesystem: giữ đúng bảng `projects` (LRU theo thứ tự chèn),
 *      chế độ watch root/ancestor, chokidar + watchFile, hàng đợi invalidate bằng microtask,
 *      cờ unhealthy, rewatch và mọi chuỗi cảnh báo tiếng Anh.
 */

import { unwatchFile, watchFile } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import chokidar from "chokidar";
import type { Context } from "@deepseek-ai/cordis";
import { canonicalizeWatchPath } from "@galaxy-blackhole/gbh-home-paths";
import type { SkillRoot, WatchConfig } from "./config.ts";
import { errorMessage, isAbsentPathError } from "./errors.ts";

/** Chế độ watch khi root đã tồn tại: theo dõi chính root. */
type RootWatchMode = { kind: "root"; anchor: string };

/** Chế độ watch khi root chưa tồn tại: theo dõi tổ tiên gần nhất và chờ đoạn đường đầu tiên xuất hiện. */
type AncestorWatchMode = { kind: "ancestor"; anchor: string; nextPath: string };

/** Một trong hai chế độ watch của root. */
type WatchMode = RootWatchMode | AncestorWatchMode;

/** Handle watcher đã mở; close có thể đồng bộ (watchFile) hoặc trả Promise (chokidar). */
interface WatcherHandle {
  /** Chế độ đã dùng để mở watcher. */
  mode: WatchMode;
  /** Đóng watcher và nhả tài nguyên. */
  close(): void | Promise<void>;
}

/** Trạng thái của một root đang được giữ bởi một hoặc nhiều owner. */
interface RootState {
  /** Root kỹ năng tương ứng. */
  root: SkillRoot;
  /** Tập owner đang giữ root (shared:<path> hoặc project:<root>). */
  owners: Set<string>;
  /** Watcher hiện tại, undefined khi chưa mở hoặc đang thay. */
  watcher: WatcherHandle | undefined;
  /** Promise đang mở watcher (chống mở trùng). */
  opening: Promise<void> | undefined;
  /** Watcher hiện tại đã hỏng và cần thay. */
  unhealthy: boolean;
}

/** Sự kiện chokidar mà provider quan tâm. */
type WatchEvent = "add" | "addDir" | "change" | "unlink" | "unlinkDir";

/** Promise kèm hàm resolve/reject tách rời (thay `Promise.withResolvers` cho lib ES2023). */
interface Deferred<T> {
  /** Promise sẽ settle khi resolve/reject được gọi. */
  promise: Promise<T>;
  /** Hoàn tất promise với value. */
  resolve(value: T | PromiseLike<T>): void;
  /** Từ chối promise với reason. */
  reject(reason?: unknown): void;
}

/**
 * Sở hữu watcher host có giới hạn; discovery và đọc vẫn đi qua dịch vụ filesystem.
 * Nhận: ctx — context cordis; invalidate — callback làm mới catalog; config — cấu hình watcher đã chuẩn hoá.
 * Trả: instance quản lý vòng đời watcher của provider.
 */
export class SkillWatchManager {
  /** Context để log cảnh báo. */
  private readonly ctx: Context;
  /** Callback invalidate của registration. */
  private readonly invalidate: () => void;
  /** Cấu hình watcher đã chuẩn hoá. */
  private readonly config: WatchConfig;
  /** Root đang giữ, khoá theo đường dẫn. */
  private readonly roots = new Map<string, RootState>();
  /** Bảng dự án đang theo dõi, khoá theo project root (thứ tự chèn dùng để đuổi cũ nhất). */
  private readonly projects = new Map<string, Set<string>>();
  /** Tín hiệu vòng đời dùng để huỷ mọi watcher đang mở. */
  private readonly lifecycle = new AbortController();
  /** Đã vào trạng thái đóng. */
  private closing = false;
  /** Đã có một invalidate chờ trong microtask. */
  private invalidationQueued = false;

  /**
   * Khởi tạo bộ quản lý watcher.
   * Nhận: ctx — context cordis; invalidate — callback làm mới catalog; config — cấu hình watcher.
   * Trả: instance mới, chưa mở watcher nào.
   */
  constructor(ctx: Context, invalidate: () => void, config: WatchConfig) {
    this.ctx = ctx;
    this.invalidate = invalidate;
    this.config = config;
  }

  /**
   * Giữ watcher cho các root của một lần discovery, gom root dự án theo project root và đuổi
   * dự án cũ nhất khi vượt `maxProjects` — giữ nguyên thứ tự và điều kiện invalidate của bản gốc.
   * Nhận: roots — các root cần giữ.
   * Trả: Promise hoàn tất khi mọi root đã được giữ/nhả và invalidate (nếu có) đã phát.
   */
  async observeRoots(roots: SkillRoot[]): Promise<void> {
    if (this.closing) return;
    const projectRoots = new Map<string, SkillRoot[]>();
    const pending: Promise<void>[] = [];
    for (const root of roots) {
      if (root.projectRoot === undefined) {
        pending.push(this.retainRoot(root, `shared:${root.path}`));
        continue;
      }
      const grouped = projectRoots.get(root.projectRoot) ?? [];
      grouped.push(root);
      projectRoots.set(root.projectRoot, grouped);
    }
    for (const [projectRoot, grouped] of projectRoots) {
      const owner = `project:${projectRoot}`;
      this.projects.delete(projectRoot);
      const paths = new Set(grouped.map((root) => root.path));
      this.projects.set(projectRoot, paths);
      for (const root of grouped) pending.push(this.retainRoot(root, owner));
    }
    let evictedProject = false;
    while (this.projects.size > this.config.maxProjects) {
      const oldest = this.projects.entries().next();
      if (oldest.done) break;
      const [projectRoot, paths] = oldest.value;
      this.projects.delete(projectRoot);
      const owner = `project:${projectRoot}`;
      for (const path of paths) pending.push(this.releaseRoot(path, owner));
      evictedProject = true;
    }
    await Promise.all(pending);
    if (evictedProject) this.invalidate();
  }

  /**
   * Invalidate đồng bộ sau một thao tác ghi/sửa của bên thứ nhất nếu đường dẫn có thể là kỹ năng.
   * Nhận: path — đường dẫn hiển thị của host sau write/edit.
   * Trả: không trả gì; invalidate được xếp vào microtask khi khớp root.
   */
  observeHostMutation(path: string): void {
    if (this.closing) return;
    const normalized = resolve(path);
    if (![...this.roots.values()].some((state) => isPotentialSkillPath(state.root, normalized))) return;
    this.invalidate();
  }

  /**
   * Đóng mọi watcher host và giữ các callback filesystem đến muộn trong im lặng.
   * Nhận: không.
   * Trả: Promise settle khi mọi watcher đã đóng xong.
   */
  async dispose(): Promise<void> {
    this.closing = true;
    this.lifecycle.abort(new Error("skill-filesystem watcher disposed"));
    const states = [...this.roots.values()];
    this.roots.clear();
    this.projects.clear();
    await Promise.all(
      states.map(async (state) => {
        await settleWatcherOpening(state.opening);
        const watcher = state.watcher;
        state.watcher = undefined;
        if (watcher !== undefined) await this.closeWatcher(watcher);
      }),
    );
  }

  /**
   * Giữ một root cho một owner, tạo trạng thái mới nếu chưa có và mở watcher khi bật watch.
   * Nhận: root — root cần giữ; owner — chủ sở hữu (shared hoặc project).
   * Trả: Promise hoàn tất khi owner đã đăng ký và watcher (nếu bật) đã mở.
   * @throws {unknown} lỗi mở watcher được `ensureWatcher` chuyển tiếp.
   */
  private async retainRoot(root: SkillRoot, owner: string): Promise<void> {
    let state = this.roots.get(root.path);
    if (state === undefined) {
      state = {
        root,
        owners: new Set(),
        watcher: undefined,
        opening: undefined,
        unhealthy: true,
      };
      this.roots.set(root.path, state);
    }
    state.owners.add(owner);
    if (this.config.enabled) await this.ensureWatcher(state);
  }

  /**
   * Nhả một owner khỏi root; owner cuối cùng rời đi thì đóng watcher và xoá trạng thái.
   * Nhận: path — đường dẫn root; owner — chủ sở hữu cần nhả.
   * Trả: Promise hoàn tất khi watcher (nếu có) đã đóng.
   */
  private async releaseRoot(path: string, owner: string): Promise<void> {
    const state = this.roots.get(path);
    if (state === undefined) return;
    state.owners.delete(owner);
    if (state.owners.size > 0) return;
    this.roots.delete(path);
    await settleWatcherOpening(state.opening);
    const watcher = state.watcher;
    state.watcher = undefined;
    if (watcher !== undefined) await this.closeWatcher(watcher);
  }

  /**
   * Bảo đảm một root có đúng một watcher đang mở (hoặc đang mở).
   * Nhận: state — trạng thái root.
   * Trả: Promise hoàn tất khi watcher sẵn sàng hoặc bị bỏ qua vì đã đóng/tắt watch.
   */
  private ensureWatcher(state: RootState): Promise<void> {
    if (this.closing || !this.config.enabled) return Promise.resolve();
    if (state.opening !== undefined) return state.opening;
    const opening = this.ensureCurrentWatcher(state);
    state.opening = opening;
    opening.then(
      () => {
        state.opening = undefined;
      },
      () => {
        state.opening = undefined;
      },
    );
    return opening;
  }

  /**
   * Kiểm watcher hiện tại còn đúng chế độ watch của root hay không; nếu không thì thay.
   * Nhận: state — trạng thái root.
   * Trả: Promise hoàn tất khi watcher hiện tại hợp lệ hoặc đã được thay.
   * @throws {unknown} lỗi khi mở watcher thay thế.
   */
  private async ensureCurrentWatcher(state: RootState): Promise<void> {
    const watcher = state.watcher;
    if (watcher !== undefined && !state.unhealthy) {
      const current = await resolveRootWatchMode(state.root.path, this.config.followSymlinks);
      if (!state.unhealthy && sameWatchMode(watcher.mode, current)) return;
    }
    await this.replaceWatcher(state);
  }

  /**
   * Đóng watcher cũ rồi mở watcher mới; ghi cảnh báo và đánh dấu unhealthy khi mở thất bại.
   * Nhận: state — trạng thái root.
   * Trả: Promise hoàn tất khi watcher mới đã được gán (hoặc bị bỏ vì teardown).
   * @throws {unknown} lỗi mở watcher, sau khi đã cảnh báo.
   */
  private async replaceWatcher(state: RootState): Promise<void> {
    const previous = state.watcher;
    state.watcher = undefined;
    if (previous !== undefined) await this.closeWatcher(previous);
    if (this.closing || state.owners.size === 0) return;
    try {
      const watcher = await this.openStableWatcher(state);
      if (watcher === undefined) return;
      if (this.closing || state.owners.size === 0) {
        await this.closeWatcher(watcher);
        return;
      }
      state.watcher = watcher;
      state.unhealthy = false;
    } catch (error) {
      if (!this.closing) {
        state.unhealthy = true;
        this.ctx.logger.warn(`skill-filesystem: failed to watch ${state.root.path}: ${errorMessage(error)}`);
      }
      throw error;
    }
  }

  /**
   * Mở watcher ổn định: kiểm chế độ watch trước và sau khi mở để tránh đua với thay đổi host.
   * Nhận: state — trạng thái root.
   * Trả: handle watcher, hoặc undefined khi root bị nhả/teardown giữa các lần await.
   */
  private async openStableWatcher(state: RootState): Promise<WatcherHandle | undefined> {
    while (!this.closing && state.owners.size > 0) {
      const mode = await resolveRootWatchMode(state.root.path, this.config.followSymlinks);
      const watcher =
        mode.kind === "ancestor" ? this.openAncestorWatcher(state, mode) : await this.openRootWatcher(state, mode);
      if (sameWatchMode(mode, await resolveRootWatchMode(state.root.path, this.config.followSymlinks))) return watcher;
      await this.closeWatcher(watcher);
    }
    return undefined;
  }

  /**
   * Mở watcher kiểu "tổ tiên" bằng `watchFile`: chờ đoạn đường đầu tiên của root xuất hiện.
   * Nhận: state — trạng thái root; mode — chế độ ancestor.
   * Trả: handle watcher đồng bộ.
   */
  private openAncestorWatcher(state: RootState, mode: AncestorWatchMode): WatcherHandle {
    const listener = (_current: Stats, _previous: Stats) => {
      this.handleAncestorWatchEvent(state, mode);
    };
    watchFile(
      mode.nextPath,
      {
        persistent: false,
        interval: this.config.pollIntervalMs,
      },
      listener,
    );
    return {
      mode,
      close() {
        unwatchFile(mode.nextPath, listener);
      },
    };
  }

  /**
   * Xử lý một lần `watchFile` báo thay đổi ở tổ tiên: nếu chế độ watch đổi thì invalidate và rewatch.
   * Nhận: state — trạng thái root; mode — chế độ ancestor đã dùng.
   * Trả: Promise hoàn tất sau khi đã xử lý (không ném lỗi ra ngoài).
   */
  private async handleAncestorWatchEvent(state: RootState, mode: AncestorWatchMode): Promise<void> {
    let current: WatchMode;
    try {
      current = await resolveRootWatchMode(state.root.path, this.config.followSymlinks);
    } catch (error) {
      if (!this.closing && state.owners.size > 0) this.handleWatcherError(state, error);
      return;
    }
    if (this.closing || state.owners.size === 0 || sameWatchMode(mode, current)) return;
    this.queueInvalidation();
    state.unhealthy = true;
    this.scheduleRewatch(state);
  }

  /**
   * Mở watcher chokidar cho root đã tồn tại và chờ sự kiện `ready`.
   * Nhận: state — trạng thái root; mode — chế độ root.
   * Trả: handle watcher đã sẵn sàng.
   * @throws {unknown} lỗi watcher trước khi ready (sau khi đã đóng handle).
   */
  private async openRootWatcher(state: RootState, mode: RootWatchMode): Promise<WatcherHandle> {
    const watcher = chokidar.watch(mode.anchor, {
      persistent: true,
      ignoreInitial: true,
      depth: 1,
      followSymlinks: this.config.followSymlinks,
      atomic: true,
      awaitWriteFinish: {
        stabilityThreshold: this.config.stabilityThresholdMs,
        pollInterval: this.config.pollIntervalMs,
      },
      usePolling: this.config.usePolling,
      interval: this.config.pollIntervalMs,
    });
    let ready = false;
    const readiness = withResolvers<void>();
    const signal = this.lifecycle.signal;
    const onError = (error: unknown) => {
      if (!ready) {
        readiness.reject(error);
        return;
      }
      this.handleWatcherError(state, error);
    };
    const handle: WatcherHandle = {
      mode,
      close: () => {
        const closing = watcher.close();
        watcher.on("error", onError);
        return closing;
      },
    };
    if (signal.aborted) {
      await this.closeWatcher(handle);
      signal.throwIfAborted();
    }
    const onAbort = () => {
      readiness.reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    watcher.on("error", onError);
    watcher.once("ready", () => {
      ready = true;
      readiness.resolve(undefined);
    });
    for (const event of ["add", "addDir", "change", "unlink", "unlinkDir"] as const) {
      watcher.on(event, (path) => {
        this.handleWatchEvent(state, mode, event, path);
      });
    }
    try {
      await readiness.promise;
    } catch (error) {
      await this.closeWatcher(handle);
      throw error;
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
    return handle;
  }

  /**
   * Lọc sự kiện chokidar theo root rồi invalidate; mất chính thư mục root thì rewatch.
   * Nhận: state — trạng thái root; mode — chế độ root; event — loại sự kiện; path — đường dẫn sự kiện.
   * Trả: không trả gì.
   */
  private handleWatchEvent(state: RootState, mode: RootWatchMode, event: WatchEvent, path: string): void {
    const target = resolve(path);
    if (this.closing || !isRelevantWatchEvent({ ...state.root, path: mode.anchor }, event, target)) return;
    this.queueInvalidation();
    if (target === mode.anchor && event === "unlinkDir") {
      state.unhealthy = true;
      this.scheduleRewatch(state);
    }
  }

  /**
   * Ghi cảnh báo watcher hỏng, đánh dấu unhealthy, invalidate và hẹn rewatch.
   * Nhận: state — trạng thái root; error — lỗi watcher.
   * Trả: không trả gì.
   */
  private handleWatcherError(state: RootState, error: unknown): void {
    if (this.closing) return;
    this.ctx.logger.warn(`skill-filesystem: watcher for ${state.root.path} failed: ${errorMessage(error)}`);
    state.unhealthy = true;
    this.queueInvalidation();
    this.scheduleRewatch(state);
  }

  /**
   * Hẹn mở lại watcher sau khi lần mở hiện tại settle xong (không ném lỗi ra ngoài).
   * Nhận: state — trạng thái root.
   * Trả: không trả gì; công việc chạy trong một async IIFE như bản gốc.
   */
  private scheduleRewatch(state: RootState): void {
    const currentOpening = state.opening ?? Promise.resolve();
    (async () => {
      await settleWatcherOpening(currentOpening);
      try {
        await this.ensureWatcher(state);
      } catch {
        return;
      }
      this.queueInvalidation();
    })();
  }

  /**
   * Xếp đúng một invalidate vào microtask (gộp nhiều sự kiện liên tiếp).
   * Nhận: không.
   * Trả: không trả gì.
   */
  private queueInvalidation(): void {
    if (this.closing || this.invalidationQueued) return;
    this.invalidationQueued = true;
    queueMicrotask(() => {
      this.invalidationQueued = false;
      if (this.closing) return;
      this.invalidate();
    });
  }

  /**
   * Đóng một handle watcher và nuốt lỗi đóng thành cảnh báo.
   * Nhận: watcher — handle cần đóng.
   * Trả: Promise hoàn tất khi handle đã đóng (không ném lỗi).
   */
  private async closeWatcher(watcher: WatcherHandle): Promise<void> {
    try {
      await watcher.close();
    } catch (error) {
      this.ctx.logger.warn(`skill-filesystem: failed to close watcher: ${errorMessage(error)}`);
    }
  }
}

/**
 * Chờ một promise mở watcher settle mà không quan tâm kết cục.
 * Nhận: opening — promise cần chờ (có thể undefined).
 * Trả: Promise hoàn tất khi promise đã settle (nuốt lỗi).
 */
async function settleWatcherOpening(opening: Promise<void> | undefined): Promise<void> {
  if (opening === undefined) return;
  try {
    await opening;
  } catch {}
}

/**
 * Tạo Deferred thay cho `Promise.withResolvers` (lib ES2023 không có).
 * Nhận: không.
 * Trả: promise cùng hai hàm resolve/reject.
 */
function withResolvers<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Xác định chế độ watch của một root: chính root nếu tồn tại, ngược lại tổ tiên gần nhất còn tồn tại.
 * Nhận: root — đường dẫn root; followSymlinks — có canonical hoá theo đích liên kết hay không.
 * Trả: chế độ root hoặc ancestor kèm anchor/nextPath.
 * @throws {unknown} lỗi stat không phải ENOENT/ENOTDIR.
 */
async function resolveRootWatchMode(root: string, followSymlinks: boolean): Promise<WatchMode> {
  let candidate = root;
  while (true) {
    try {
      if ((await stat(candidate)).isDirectory()) {
        const anchor =
          candidate === root && !followSymlinks && (await lstat(candidate)).isSymbolicLink()
            ? resolve(candidate)
            : await canonicalizeWatchPath(candidate);
        if (candidate === root)
          return {
            kind: "root",
            anchor,
          };
        const firstSegment = relative(candidate, root).split(sep)[0];
        if (firstSegment === undefined || firstSegment.length === 0)
          return {
            kind: "root",
            anchor,
          };
        return {
          kind: "ancestor",
          anchor,
          nextPath: join(anchor, firstSegment),
        };
      }
    } catch (error) {
      if (!isAbsentPathError(error)) throw error;
    }
    const parent = dirname(candidate);
    if (parent === candidate)
      return {
        kind: "ancestor",
        anchor: candidate,
        nextPath: root,
      };
    candidate = parent;
  }
}

/**
 * So hai chế độ watch có tương đương hay không (cùng kind/anchor; ancestor phải cùng nextPath).
 * Nhận: left — chế độ thứ nhất; right — chế độ thứ hai.
 * Trả: true khi tương đương.
 */
function sameWatchMode(left: WatchMode, right: WatchMode): boolean {
  if (left.kind !== right.kind) return false;
  if (left.anchor !== right.anchor) return false;
  if (left.kind === "root") return true;
  return right.kind === "ancestor" && left.nextPath === right.nextPath;
}

/**
 * Kiểm một sự kiện watcher có đáng invalidate không — giữ nguyên thứ tự kiểm của bản gốc:
 * ngoài root, thư mục `.system`, tệp `.md` ở cấp 1, và `SKILL.md` ở cấp 2.
 * Nhận: root — root đang theo dõi (path có thể đã đổi thành anchor); event — loại sự kiện; path — đường dẫn đích.
 * Trả: true khi sự kiện ảnh hưởng catalog.
 */
function isRelevantWatchEvent(root: SkillRoot, event: WatchEvent, path: string): boolean {
  const segments = containedSegments(root.path, path);
  if (segments === undefined) return false;
  if (segments.length === 0) return event === "addDir" || event === "unlinkDir";
  if (root.skipSystem === true && segments[0] === ".system") return false;
  if (segments.length === 1) {
    if (event === "addDir" || event === "unlinkDir") return true;
    return segments[0]?.endsWith(".md") === true;
  }
  return segments.length === 2 && segments[1] === "SKILL.md" && event !== "addDir" && event !== "unlinkDir";
}

/**
 * Kiểm một đường dẫn ghi/sửa có thể là kỹ năng hay không — giữ nguyên luật cấp 1/cấp 2 của bản gốc.
 * Nhận: root — root đang giữ; path — đường dẫn tuyệt đối đã resolve.
 * Trả: true khi đường dẫn nằm trong root và có hình dạng kỹ năng.
 */
function isPotentialSkillPath(root: SkillRoot, path: string): boolean {
  const segments = containedSegments(root.path, path);
  if (segments === undefined || segments.length === 0 || segments.length > 2) return false;
  if (root.skipSystem === true && segments[0] === ".system") return false;
  return segments.length === 1 ? segments[0]?.endsWith(".md") === true : segments[1] === "SKILL.md";
}

/**
 * Tách đường dẫn tương đối thành các đoạn, trả undefined khi đích nằm ngoài root.
 * Nhận: root — thư mục gốc; path — đường dẫn đích.
 * Trả: mảng đoạn (rỗng khi trùng root), hoặc undefined khi ngoài root/đường dẫn tuyệt đối.
 */
function containedSegments(root: string, path: string): string[] | undefined {
  const child = relative(root, path);
  if (child.length === 0) return [];
  if (child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child)) return undefined;
  return child.split(sep);
}
