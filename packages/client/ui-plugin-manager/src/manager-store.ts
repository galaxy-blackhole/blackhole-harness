/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 lớp `PluginManagerController` của vùng `manager-store` (bundle gốc client.js dòng 968-1906):
 *      đọc/ghi profile qua các namespace Remote `pluginManager`/`pluginInventory`/`pluginRegistryProbe`,
 *      sổ ảnh chụp của tab, 20+ action của mặt `PluginManagerFace`, toast (`notice`/`seq`) và máy trạng thái
 *      của hộp thoại cài đặt.
 *
 * Vì sao tách: kiểu + hàm thuần nằm ở `manager-actions.ts` (vùng 1.181 dòng gốc vượt ngưỡng 1.000 dòng/tệp).
 * Dị biệt DUY NHẤT so với bản gốc: `createSnapshotStore` (phạm vi module ở bản gốc) nhận qua bảng module
 * `PluginManagerModules` — thiếu bảng thì dùng sổ trong bộ nhớ + MỘT cảnh báo, KHÔNG ném.
 */

import type { PluginManagerModules } from "./runtime.ts";
import type { HostObservable, PluginTab } from "./tab-ledger.ts";
import type { ConfigLedger } from "./config-ledger.ts";
import { sanitizeInstallInput } from "./sanitize-install-input.ts";
import {
  IDLE_INSTALL,
  OFFICIAL_REGISTRY,
  REFRESH_SPINNER_MIN_MS,
  RemoteAnswerError,
  asksMirror,
  eligibleMirror,
  failedNotice,
  failureOf,
  githubRecoveryRegistry,
  isInstallPending,
  packageView,
  reconciled,
  rowKey,
  settledRuns,
  sortPackages,
  specAgain,
  storeFactoryOf,
  randomUUID,
  REGISTRY_URL,
} from "./manager-actions.ts";
import type {
  ConfirmState,
  CreateSnapshotStore,
  InstallRun,
  InstallState,
  InstallSubject,
  ManagerNotice,
  PackageView,
  PluginEntryId,
  PluginInstallLogChunk,
  PluginInstallProgress,
  PluginInstallRequestId,
  PluginManagerContext,
  PluginManagerFace,
  PluginManagerState,
  PluginRegistries,
  PluginTabInstall,
  Registry,
  RegistryChoice,
  RestartReason,
  SnapshotStore,
  ChangeResult,
  RemoteResult,
} from "./manager-actions.ts";

/** Phần `config-ledger` mà nơi khác có thể nhập từ tệp này (bản gốc: cùng một gói). */
export type { ConfigLedger } from "./config-ledger.ts";

/** Một lần cài đang được theo dõi, từ lúc gửi tới lúc Host trả lời (trạng thái riêng của controller). */
interface InstallRequest {
  /** Id request gửi Host. */
  readonly requestId: PluginInstallRequestId;
  /** Host đã báo một pha nào đó của request này (huỷ đến trước khi cài bắt đầu sẽ phải gửi lại). */
  acknowledged: boolean;
  /** Câu trả lời gốc của lời gọi cài đã mất (đường truyền hỏng). */
  replyLost: boolean;
  /** Đang hỏi lại kết quả (`waitForInstall`). */
  recovering: boolean;
  /** Yêu cầu huỷ đang chạy, khi có. */
  cancellation?: { waitingForStart: boolean };
}

/** Một lượt đọc registry của hộp thoại (để bỏ qua câu trả lời của lượt cũ). */
interface RegistryRead {
  /** Lựa chọn tại lúc bắt đầu đọc. */
  choice: RegistryChoice;
  /** Lời hứa của lượt đọc, khi còn chạy. */
  done?: Promise<void>;
}

/** Ảnh chụp đầu tiên của tab (nguyên văn đối tượng khởi tạo của bản gốc). */
const INITIAL_STATE: PluginManagerState = {
  status: "idle",
  refreshStatus: "idle",
  packages: [],
  busy: [],
  notice: null,
  install: IDLE_INSTALL,
  confirm: null,
  highlight: null,
};

/** Chuyển tiếp các hàm thuần của vùng gốc sang tệp này, để nơi dùng nhập MỘT chỗ như bundle gốc. */
export {
  IDLE_INSTALL, OFFICIAL_REGISTRY, NPMMIRROR_REGISTRY, REFRESH_SPINNER_MIN_MS, REGISTRY_URL, RemoteAnswerError,
  asksMirror, eligibleMirror, failedNotice, failureOf, githubRecoveryRegistry, isInstallPending, normalizeRegistry,
  offeredRegistries, packageView, randomUUID, reasonOf, reconciled, registryKey, rowKey, settledRuns, sortPackages,
  specAgain, storeFactoryOf,
} from "./manager-actions.ts";

/** Đọc và sửa plugin của profile qua Remote `pluginManager`. */
export class PluginManagerController {
  /** Seam ctx của plugin tab. */
  private readonly ctx: PluginManagerContext;
  /** Sổ ảnh chụp mà tab bind. */
  private readonly store: SnapshotStore<PluginManagerState>;
  /** Lượt đọc đang chạy (các lời gọi trong lúc đó gộp thành MỘT lượt chạy lại). */
  private inFlight: Promise<void> | undefined;
  /** Có lời gọi nào tới trong lúc đang đọc không. */
  private rerun = false;
  /** Số thế hệ của lượt đọc (câu trả lời của thế hệ cũ bị bỏ). */
  private generation = 0;
  /** Controller đã dọn. */
  private disposed = false;
  /** Một lần đọc profile quản lý được thành công vẫn dùng được kể cả khi trả về 0 bundle. */
  private hasCachedInventory = false;
  /** Thao tác đang chờ người dùng xác nhận. */
  private pendingConfirm: (() => Promise<void>) | undefined;
  /** Huỷ bước kiểm mà hộp thoại đang chạy. */
  private inspectAbort: AbortController | undefined;
  /** Lần cài đang theo dõi. */
  private request: InstallRequest | undefined;
  /** Số thứ tự toast (để một toast mới không bị nhầm là toast cũ). */
  private noticeSeq = 0;
  /** Lần cài đang đo cho phân tích sản phẩm. */
  private analyticsAttempt: { input: string; started: number } | undefined;
  /** Lượt đọc registry của hộp thoại đang mở. */
  private registryRead: RegistryRead | undefined;
  /** Một mục Discover đã chọn registry cho hộp thoại; lựa chọn này chỉ áp dụng cho hộp thoại này. */
  private transientRegistry = false;
  /** Registry dùng gần nhất từ trình duyệt này, bền qua các hộp thoại và lần tải trang; null tới khi có. */
  private readonly registryMemory: SnapshotStore<RegistryChoice | null>;

  /**
   * Dựng controller cho một plugin tab.
   * Nhận: `ctx` — ctx của plugin tab (các namespace Remote + configForms + productAnalytics);
   * `modules` — bảng module của trang (chỉ dùng `modules.store.createSnapshotStore`; thiếu thì dùng sổ trong bộ nhớ).
   * Trả: controller mới (chưa đọc Host — `ensure`/`load` mới đọc).
   */
  constructor(ctx: PluginManagerContext, modules?: PluginManagerModules) {
    this.ctx = ctx;
    const createSnapshotStore: CreateSnapshotStore = storeFactoryOf(modules);
    this.store = createSnapshotStore(INITIAL_STATE);
    this.registryMemory = createSnapshotStore<RegistryChoice | null>(null, { persist: { name: "dsh.plugin-manager.install-registry" } });
  }

  /**
   * Đọc trạng thái của tab.
   * Nhận: không.
   * Trả: ảnh chụp đồng bộ hiện tại (tham chiếu ổn định tới lần đổi kế tiếp).
   */
  getSnapshot(): PluginManagerState {
    return this.store.getSnapshot();
  }

  /**
   * Ngừng phát và bỏ mọi kết cục đến muộn.
   * Nhận: không.
   * Trả: không.
   */
  dispose(): void {
    this.disposed = true;
    this.registryRead = undefined;
    this.request = undefined;
    this.generation += 1;
  }

  /**
   * Dựng mặt mà đăng ký slot của tab inject.
   * Nhận: `configLedger` — nguồn các plugin mang cấu hình; `pluginTabs` — các tab do plugin khác đóng góp;
   * `resolveText` — hàm giải chữ của gói theo ngôn ngữ hiện tại.
   * Trả: {@link PluginManagerFace} (các nguồn ảnh chụp + các action).
   */
  inject(configLedger: HostObservable<ConfigLedger>, pluginTabs: HostObservable<readonly PluginTab[]>, resolveText: PluginManagerFace["resolveText"]): PluginManagerFace {
    return {
      resolveText,
      hooks: {
        pluginManager: this.store,
        configLedger,
        pluginTabs,
        configurations: this.ctx.configForms.describe(),
      },
      configForm: (id) => this.ctx.configForms.get(id),
      ensure: () => {
        if (this.getSnapshot().status === "idle") void this.load();
      },
      refresh: () => {
        void this.refresh();
      },
      openInstall: () => {
        this.ctx.get("productAnalytics")?.track("plugin_add_button_click", {});
        this.openDialog();
      },
      installFrom: ({ spec, registry, title, version }: PluginTabInstall) => {
        if (!this.openDialog()) return;
        this.transientRegistry = registry !== undefined;
        this.patchInstall({
          spec,
          confirmed: { title, version },
          ...registry === undefined ? {} : { registry: { kind: "custom", url: registry } },
        });
        void this.runInstall();
      },
      closeInstall: () => {
        if (isInstallPending(this.getSnapshot().install.phase)) {
          this.patchInstall({ open: false });
          void this.cancelInstall();
          return;
        }
        if (this.getSnapshot().install.phase === "checking") this.finishAnalytics("cancelled");
        this.abortInspect();
        this.registryRead = undefined;
        this.patch({ install: IDLE_INSTALL });
      },
      editInstallSpec: (text) => {
        const install = this.getSnapshot().install;
        if (install.phase === "checking" || isInstallPending(install.phase)) return;
        this.patchInstall(install.phase === "idle"
          ? { spec: text, inputError: null, subject: null }
          : { ...specAgain(install), spec: text, subject: null });
      },
      runInstall: () => {
        void this.runInstall();
      },
      toggleRegistryOptions: () => {
        this.patchInstall({ registryOpen: !this.getSnapshot().install.registryOpen });
      },
      chooseRegistry: (choice) => {
        if (this.getSnapshot().install.phase !== "idle") return;
        this.transientRegistry = false;
        this.patchInstall({ registry: choice, registryError: false });
      },
      changeRegistry: () => {
        const install = this.getSnapshot().install;
        if (install.phase === "failed") this.patch({ install: { ...specAgain(install), registryOpen: true } });
      },
      useGithubMirror: () => {
        const install = this.getSnapshot().install;
        const mirror = githubRecoveryRegistry(install);
        if (mirror === undefined) return;
        const recovered = { ...specAgain(install), spec: "", mirrorRecovery: true };
        if (asksMirror(install)) {
          this.patch({ install: recovered });
          return;
        }
        const registry: RegistryChoice = { kind: "offered", registry: mirror };
        this.registryMemory.set(registry);
        this.patch({ install: { ...recovered, registry } });
      },
      approveBuildsAndRetry: () => {
        void this.approveBuildsAndRetry();
      },
      cancelInstall: () => {
        void this.cancelInstall();
      },
      reconcileInstall: () => {
        void this.reconcileInstall();
      },
      toggleInstallDetails: () => {
        this.patchInstall({ detailsOpen: !this.getSnapshot().install.detailsOpen });
      },
      enableInstalled: () => {
        void this.enableInstalled();
      },
      clearHighlight: () => {
        if (this.getSnapshot().highlight !== null) this.patch({ highlight: null });
      },
      setEnabled: (packageName, enabled) => {
        const pkg = this.getSnapshot().packages.find((item) => item.name === packageName);
        if (enabled && pkg?.availability === "missing" && pkg.installTarget !== undefined) {
          this.openCatalogInstall(pkg, pkg.installTarget, true);
          return;
        }
        void this.run(packageName, { packageName, action: enabled ? "enable" : "disable" }, async () => {
          const result = await this.ctx.remote.pluginManager.setBundleEnabled(packageName, enabled);
          this.applied(result, packageName);
          if (result.ok && (result.value.application === "applied" || result.value.application === "restart-required")) this.trackToggle(packageName, enabled);
        });
      },
      update: (packageName) => {
        const pkg = this.getSnapshot().packages.find((item) => item.name === packageName);
        const target = pkg?.installTarget;
        if (pkg === undefined || target === undefined || pkg.availability === "installation") return;
        if (!pkg.installed) {
          this.openCatalogInstall(pkg, target, pkg.enabled);
          return;
        }
        void this.run(packageName, { packageName, action: "uninstall" }, async () => {
          const removed = await this.ctx.remote.pluginManager.removeBundle(packageName);
          if (removed.ok && removed.value.error?.code === "stop-profile") {
            this.openCatalogInstall(pkg, target, pkg.enabled);
            return;
          }
          this.applied(removed, packageName);
          this.openCatalogInstall(pkg, target, pkg.enabled);
        });
      },
      uninstall: (packageName) => {
        this.pendingConfirm = () => this.run(packageName, { packageName, action: "uninstall" }, async () => {
          this.ctx.get("productAnalytics")?.track("confirm_uninstall_plugin", { plugin_name: packageName });
          this.applied(await this.ctx.remote.pluginManager.removeBundle(packageName), packageName);
        });
        this.patch({ confirm: { action: "uninstall", packageName } });
      },
      confirm: () => {
        void this.confirm();
      },
      cancelConfirm: () => {
        this.pendingConfirm = undefined;
        this.patch({ confirm: null });
      },
      setRowEnabled: (entryId, enabled) => {
        void this.run(rowKey(entryId), { packageName: entryId, action: enabled ? "rowEnable" : "rowDisable" }, async () => {
          const result = await this.ctx.remote.pluginManager.setPluginEnabled(entryId, enabled);
          this.applied(result, entryId);
          if (result.ok && (result.value.application === "applied" || result.value.application === "restart-required")) this.trackToggle(entryId, enabled, true);
        });
      },
      dismissNotice: () => {
        this.patch({ notice: null });
      },
    };
  }

  /**
   * Mở hộp thoại cài đặt (hộp thoại mới đọc registry dùng gần nhất + những gì Host mời; lần cài đang ẩn thì mở lại).
   * Nhận: không. Trả: true khi một hộp thoại MỚI bắt đầu.
   */
  private openDialog(): boolean {
    const started = this.getSnapshot().install.requestId === undefined;
    if (started) {
      this.transientRegistry = false;
      this.patch({ install: { ...IDLE_INSTALL, open: true, registry: this.registryMemory.getSnapshot() ?? OFFICIAL_REGISTRY } });
      const read: RegistryRead = { choice: this.getSnapshot().install.registry };
      this.registryRead = read;
      read.done = this.readRegistries(read).finally(() => {
        delete read.done;
      });
    } else this.patchInstall({ open: true });
    void this.reconcileInstall();
    return started;
  }

  /**
   * Theo cửa sổ huỷ của Host cho lần cài của hộp thoại này.
   * Nhận: `progress` — request id và pha mà Host báo.
   * Trả: không.
   */
  installProgress(progress: PluginInstallProgress): void {
    const install = this.getSnapshot().install;
    if (install.requestId !== progress.requestId || !isInstallPending(install.phase)) return;
    const request = this.request;
    if (request === undefined) return;
    request.acknowledged = true;
    if (install.phase === "applying") return;
    if (progress.phase === "installing" && request.cancellation !== undefined) {
      if (request.cancellation.waitingForStart) void this.sendCancellation(request, request.cancellation);
      return;
    }
    const attempt = progress.attempt;
    this.patchInstall({
      phase: progress.phase === "installing" ? "running" : progress.phase,
      ...attempt === undefined ? {} : { attempts: { registries: [...install.attempts?.registries ?? [], attempt.registry], total: attempt.total } },
    });
  }

  /** Lượt đọc registry này còn là lượt hiện hành không. */
  private currentRegistryRead(read: RegistryRead): boolean {
    return !this.disposed && this.registryRead === read;
  }

  /**
   * Đọc các registry Host mời cho hộp thoại vừa mở (lượt đọc bị từ chối để lại registry pnpm tự khai + tự gõ).
   * Nhận: `read` — lượt đọc đang chạy. Trả: hoàn tất khi đã ghi xong (hoặc câu trả lời hết dùng được).
   */
  private async readRegistries(read: RegistryRead): Promise<void> {
    const answer = await this.ctx.remote.pluginManager.registries();
    const install = this.getSnapshot().install;
    if (!this.currentRegistryRead(read) || !install.open || !answer.ok) return;
    const remembered = this.registryMemory.getSnapshot();
    const untouched = install.registry === read.choice && (install.phase === "idle" || install.phase === "checking");
    if (untouched) read.choice = reconciled(remembered, answer.value);
    this.patchInstall({
      registries: answer.value,
      ...untouched ? { registry: read.choice } : {},
    });
    const mirror = eligibleMirror(answer.value);
    if (!untouched || remembered !== null || mirror === undefined) return;
    const fastest = await this.ctx.remote.pluginRegistryProbe.fastest();
    const current = this.getSnapshot().install;
    if (!this.currentRegistryRead(read) || !current.open || (current.phase !== "idle" && current.phase !== "checking") || current.registry !== read.choice || !fastest.ok || fastest.value !== mirror) return;
    read.choice = { kind: "offered", registry: mirror };
    this.patchInstall({ registry: read.choice });
  }

  /**
   * Gộp một mẩu thuộc lần cài này vào dòng lệnh pnpm của nó. Mẩu cuối có thể đến sau câu trả lời cài và vẫn
   * cập nhật được một lượt chạy đã có.
   * Nhận: `chunk` — mẩu mà Host chuyển tiếp.
   * Trả: không.
   */
  appendLog(chunk: PluginInstallLogChunk): void {
    const install = this.getSnapshot().install;
    if (chunk.requestId !== install.requestId) return;
    if (install.requestId !== undefined && (install.phase === "starting" || install.phase === "cancelling" || install.phase === "unconfirmed")) {
      this.installProgress({ requestId: install.requestId, phase: "installing" });
    }
    const index = install.runs.findIndex((run) => run.jobId === chunk.jobId);
    if (index === -1 && !isInstallPending(install.phase)) return;
    const settled: { exitCode?: number | null } = chunk.exitCode === undefined ? {} : { exitCode: chunk.exitCode };
    const runs: readonly InstallRun[] = index === -1
      ? [...install.runs, { jobId: chunk.jobId, command: chunk.argv.join(" "), cwd: chunk.cwd, output: chunk.text, ...settled }]
      : install.runs.map((run, at) => at === index ? { ...run, output: run.output + chunk.text, ...settled } : run);
    this.patchInstall({ runs });
  }

  /**
   * Đọc các bundle và các entry mà row của chúng chạy thành. Một lời gọi trong lúc đang đọc đánh dấu MỘT lượt
   * chạy lại sau khi lượt hiện tại xong.
   * Nhận: không.
   * Trả: hoàn tất sau khi độ tươi của lời gọi này đã được phản ánh.
   */
  load(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    void this.reconcileInstall();
    if (this.inFlight !== undefined) {
      this.rerun = true;
      return this.inFlight;
    }
    const run = Promise.resolve().then(() => this.read());
    this.inFlight = run;
    return run;
  }

  /**
   * Giữ phản hồi làm mới thủ công tới khi các lần đọc gộp xong, không xoá các thẻ đã đệm.
   * Nhận: không.
   * Trả: hoàn tất khi đã phát phản hồi.
   */
  private async refresh(): Promise<void> {
    if (this.disposed || this.getSnapshot().refreshStatus === "refreshing") return;
    const startedAt = Date.now();
    this.patch({
      refreshStatus: "refreshing",
      ...this.getSnapshot().notice?.kind === "refresh-failed" ? { notice: null } : {},
    });
    try {
      await this.load();
    } catch {
      this.patch({ status: "error" });
    } finally {
      const remaining = REFRESH_SPINNER_MIN_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, remaining);
        });
      }
      this.settleRefresh();
    }
  }

  /** Chỉ phát phản hồi làm mới trước khi dọn. */
  private settleRefresh(): void {
    if (this.disposed) return;
    const failed = this.getSnapshot().status === "error";
    this.patch(failed && this.hasCachedInventory
      ? { status: "ready", refreshStatus: "idle", notice: { kind: "refresh-failed", seq: ++this.noticeSeq } }
      : { refreshStatus: failed ? "failed" : "idle" });
  }

  /** Một lượt đọc Host (kho plugin → bundle + entry), gộp các lượt chạy lại vào cùng một vòng. */
  private async read(): Promise<void> {
    try {
      do {
        this.rerun = false;
        const generation = ++this.generation;
        if (this.getSnapshot().status === "idle") this.patch({ status: "loading" });
        const inventory = await this.ctx.remote.pluginInventory.list();
        if (generation !== this.generation) return;
        if (!inventory.ok) {
          this.patch({ status: "error" });
          continue;
        }
        if (inventory.value.managementAvailable !== true) {
          this.hasCachedInventory = false;
          this.patch({ status: "unavailable", packages: [] });
          continue;
        }
        const [bundles, plugins] = await Promise.all([
          this.ctx.remote.pluginManager.listBundles(),
          this.ctx.remote.pluginManager.listPlugins(),
        ]);
        if (generation !== this.generation) return;
        if (!bundles.ok || !plugins.ok) {
          this.patch({ status: "error" });
          continue;
        }
        this.hasCachedInventory = true;
        this.patch({
          status: "ready",
          refreshStatus: this.getSnapshot().refreshStatus === "refreshing" ? "refreshing" : "idle",
          packages: sortPackages(bundles.value.map((bundle) => packageView(bundle, plugins.value))),
        });
      } while (this.shouldRerun());
    } finally {
      this.inFlight = undefined;
    }
  }

  /** Có một lời gọi nào tới trong lúc đang đọc không. */
  private shouldRerun(): boolean {
    return this.rerun;
  }

  /** Chạy thao tác đang chờ xác nhận (nếu có). */
  private async confirm(): Promise<void> {
    const pending = this.pendingConfirm;
    this.pendingConfirm = undefined;
    this.patch({ confirm: null });
    if (pending !== undefined) await pending();
  }

  /** Bỏ bước kiểm đang chạy; câu trả lời của nó bị phớt lờ. */
  private abortInspect(): void {
    this.inspectAbort?.abort();
    this.inspectAbort = undefined;
  }

  /** Kết cục này đã quá muộn để có nghĩa chưa: sổ đã dọn, hoặc hộp thoại đã đi tiếp. */
  private gone(signal: AbortSignal): boolean {
    return this.disposed || signal.aborted;
  }

  /**
   * Dùng lại hộp thoại cài đặt với một mục danh mục chính xác và kết cục chọn rõ ràng.
   * Nhận: `pkg` · `target` (spec + phiên bản Host mời) · `enabled` (chọn bật sau khi cài). Trả: không.
   */
  private openCatalogInstall(pkg: PackageView, target: NonNullable<PackageView["installTarget"]>, enabled: boolean): void {
    if (this.disposed) return;
    const { phase } = this.getSnapshot().install;
    if (phase === "checking" || isInstallPending(phase)) {
      this.patchInstall({ open: true });
      return;
    }
    this.abortInspect();
    const registry = this.registryMemory.getSnapshot() ?? OFFICIAL_REGISTRY;
    const local = target.spec.startsWith("link:");
    const subject: InstallSubject = {
      status: "accepted",
      kind: local ? "path" : "registry",
      name: pkg.name,
      version: target.version,
      bundle: true,
      spec: target.spec,
      registry: registry.kind === "custom" ? registry.url : registry.registry,
      selection: enabled,
      ...local ? {} : { saveExact: true },
    };
    this.patch({ install: { ...IDLE_INSTALL, open: true, spec: subject.spec, registry, subject } });
    const read: RegistryRead = { choice: registry };
    this.registryRead = read;
    read.done = this.readRegistries(read).finally(() => {
      delete read.done;
    });
    void this.runInstall();
  }

  /**
   * Kiểm spec đã gõ rồi cài. Host đọc spec nêu tên gì trước; spec bị từ chối thì quay về ô nhập kèm lý do,
   * spec được nhận thành subject mà các màn sau hiển thị trong lúc pnpm chạy.
   * Nhận: không.
   * Trả: hoàn tất khi đã chuyển sang bước cài hoặc đã báo lỗi đầu vào.
   */
  private async runInstall(): Promise<void> {
    const state = this.getSnapshot();
    const install = state.install;
    const spec = install.spec.trim();
    if (install.phase === "checking" || isInstallPending(install.phase) || spec === "") return;
    if (this.ctx.get("productAnalytics")?.enabled) {
      this.analyticsAttempt = { input: sanitizeInstallInput(spec), started: Date.now() };
      this.ctx.get("productAnalytics")?.track("plugin_install_click", { input_value: sanitizeInstallInput(spec) });
    }
    const listed = state.packages.find((pkg) => pkg.name === spec);
    const catalogSubject = install.subject?.selection === undefined || install.subject.spec !== spec ? undefined : install.subject;
    if (listed !== undefined && listed.availability !== "missing" && catalogSubject === undefined) {
      this.finishAnalytics("failed", "already-installed");
      this.patchInstall({
        phase: "idle",
        inputError: { problem: listed.availability === "installation" ? "shipped" : "already-installed", reason: spec },
      });
      return;
    }
    const choice = install.registry;
    const typed = choice.kind === "custom" ? choice.url.trim() : undefined;
    if (typed !== undefined && !REGISTRY_URL.test(typed)) {
      this.finishAnalytics("failed", "invalid-registry");
      this.patchInstall({ phase: "idle", registryError: true, registryOpen: true });
      return;
    }
    this.abortInspect();
    const controller = new AbortController();
    this.inspectAbort = controller;
    this.patchInstall({
      phase: "checking",
      inputError: null,
      subject: catalogSubject ?? null,
      runs: [],
      detailsOpen: false,
      attempts: null,
      registryOpen: false,
      installed: null,
      installedVersion: null,
      restartRequired: false,
      failure: null,
      approvedBuilds: [],
    });
    const read = this.registryRead;
    if (read !== undefined && choice === read.choice && read.done !== undefined) {
      await read.done;
      if (this.gone(controller.signal) || this.registryRead !== read) return;
    }
    const currentChoice = this.getSnapshot().install.registry;
    const selected: RegistryChoice = currentChoice.kind === "custom" ? { ...currentChoice, url: currentChoice.url.trim() } : currentChoice;
    const registry: Registry = selected.kind === "custom" ? selected.url : selected.registry;
    if (!this.transientRegistry) this.registryMemory.set(selected);
    if (catalogSubject !== undefined) {
      this.inspectAbort = undefined;
      await this.startInstall({ ...catalogSubject, registry });
      return;
    }
    const inspected = await this.ctx.remote.pluginManager.inspect(spec, { registry }, controller.signal);
    if (this.gone(controller.signal)) return;
    this.inspectAbort = undefined;
    if (!inspected.ok) {
      this.finishAnalytics("failed", inspected.error.code);
      this.patchInstall({ phase: "idle", inputError: { problem: "unknown", reason: inspected.error.message } });
      return;
    }
    if (inspected.value.status === "refused") {
      const { problem, reason, registries } = inspected.value;
      this.finishAnalytics("failed", problem);
      this.patchInstall({
        phase: "idle",
        inputError: { problem, reason, ...registries === undefined ? {} : { registries } },
      });
      return;
    }
    await this.startInstall({ spec, ...inspected.value });
  }

  /**
   * Giao spec đã kiểm cho Host và kết luận hộp thoại từ câu trả lời của nó. `approvedBuilds` nêu các script
   * đang chờ mà người dùng đã cho phép; Host lưu quyền đó cho profile này trước khi pnpm chạy.
   * Nhận: `subject` — spec đã đọc; `approvedBuilds` — các gói được phép chạy script.
   * Trả: hoàn tất khi hộp thoại đã kết luận hoặc đã chuyển sang trạng thái chưa chắc chắn.
   */
  private async startInstall(subject: InstallSubject, approvedBuilds?: readonly string[]): Promise<void> {
    const { spec, registry } = subject;
    const requestId = randomUUID();
    const request: InstallRequest = { requestId, acknowledged: false, replyLost: false, recovering: false };
    this.request = request;
    this.patchInstall({
      phase: "starting",
      requestId,
      subject,
      runs: [],
      attempts: null,
      failure: null,
      installed: null,
      installedVersion: null,
      approvedBuilds: [],
    });
    const result = await this.ctx.remote.pluginManager.installBundle(spec, {
      enabled: subject.selection ?? false,
      requestId,
      registry,
      ...subject.saveExact === undefined ? {} : { saveExact: subject.saveExact },
      ...approvedBuilds === undefined ? {} : { approvedBuilds: [...approvedBuilds] },
    });
    if (this.disposed || this.request !== request) return;
    if (!result.ok) {
      request.replyLost = true;
      this.installUncertain("result", result.error.message);
      void this.reconcileInstall();
      return;
    }
    this.settleInstall(result.value);
  }

  /**
   * Lời gọi chữa cháy dùng chung kết quả đang hoạt động của Host; kết quả vắng mặt là "không biết" rõ ràng.
   * Nhận: không.
   * Trả: hoàn tất khi đã kết luận hoặc đã báo chưa chắc chắn.
   */
  private async reconcileInstall(): Promise<void> {
    const request = this.request;
    if (request === undefined || !request.replyLost || request.recovering) return;
    request.recovering = true;
    const result = await this.ctx.remote.pluginManager.waitForInstall(request.requestId);
    if (this.disposed || this.request !== request) return;
    request.recovering = false;
    if (!result.ok) {
      this.installUncertain("result", result.error.message);
      return;
    }
    if (result.value !== null) {
      this.settleInstall(result.value);
      return;
    }
    this.request = undefined;
    this.finishAnalytics("unknown");
    this.patchInstall({ phase: "unknown", failure: null, runs: settledRuns(this.getSnapshot().install.runs, null) });
    this.notifyHiddenInstall("unknown");
    void this.load();
  }

  /** Kết luận hộp thoại từ kết quả cài của Host (kèm toast/dấu trong danh sách khi đáng). */
  private settleInstall(result: ChangeResult): void {
    this.finishAnalytics(result.application === "failed" ? "failed" : result.application === "cancelled" ? "cancelled" : "success", result.application === "failed" ? result.error?.code : undefined, result.bundle);
    const { runs, attempts } = this.getSnapshot().install;
    this.request = undefined;
    const asked = result.registries === undefined
      ? {}
      : { attempts: { registries: result.registries, total: Math.max(attempts?.total ?? 0, result.registries.length) } };
    if (result.application === "cancelled") {
      this.offerSpecAgain({ kind: "cancelled", seq: ++this.noticeSeq });
    } else if (result.application === "failed") {
      const packages = result.packageResult;
      this.patchInstall({
        phase: "failed",
        runs: settledRuns(runs, packages?.exitCode ?? null),
        failure: failureOf(result.error, packages?.kind, result.pendingBuilds, result.failedAt),
        ...asked,
      });
    } else {
      this.patchInstall({
        phase: "done",
        runs: settledRuns(runs, 0),
        failure: null,
        installed: result.bundle ?? null,
        installedVersion: result.version ?? null,
        restartRequired: result.application === "restart-required",
        ...result.restartReason === undefined ? {} : { restartReason: result.restartReason },
        approvedBuilds: result.approvedBuilds ?? [],
        ...asked,
      });
    }
    const completed = this.getSnapshot().install;
    if (completed.phase === "done" && completed.subject?.selection !== undefined && result.bundle !== undefined) {
      this.applied({ ok: true, value: result }, result.bundle);
      this.patch({ highlight: result.bundle });
      if (completed.subject.selection) this.trackToggle(result.bundle, true);
    }
    const phase = this.getSnapshot().install.phase;
    if (phase === "done" || phase === "failed") this.notifyHiddenInstall(phase);
    void this.load();
  }

  /** Báo hộp thoại rằng kết cục chưa chắc chắn (giữ nguyên "applying" nếu đang áp dụng). */
  private installUncertain(uncertainty: "result" | "cancellation" | "acceptance", reason: string): void {
    this.patchInstall({
      phase: this.getSnapshot().install.phase === "applying" ? "applying" : "unconfirmed",
      failure: { reason, uncertainty },
    });
    this.notifyHiddenInstall("unconfirmed");
  }

  /**
   * Cho phép các script mà lượt chạy thất bại để ngỏ rồi chạy lại đúng spec đó. Chỉ màn thất bại có nêu tên
   * gói đang chờ mới mời được việc này.
   * Nhận: không.
   * Trả: hoàn tất khi đã gửi lại (hoặc khi điều kiện không cho phép).
   */
  private async approveBuildsAndRetry(): Promise<void> {
    const install = this.getSnapshot().install;
    const pending = install.failure?.pendingBuilds;
    if (install.phase !== "failed" || install.subject === null || pending === undefined || pending.length === 0) return;
    if (this.ctx.get("productAnalytics")?.enabled) {
      this.analyticsAttempt = { input: sanitizeInstallInput(install.subject.spec), started: Date.now() };
    }
    await this.startInstall(install.subject, pending);
  }

  /**
   * Rời bước kiểm/màn thất bại về ô spec NGAY; lượt chạy do Host sở hữu chỉ được XIN dừng (RPC rơi không có
   * nghĩa pnpm đã dừng). Nhận: không. Trả: hoàn tất khi đã rời màn hoặc đã gửi yêu cầu huỷ.
   */
  private async cancelInstall(): Promise<void> {
    const install = this.getSnapshot().install;
    if (install.phase === "checking" || install.phase === "failed" || install.phase === "unknown") {
      if (install.phase === "checking") this.finishAnalytics("cancelled");
      this.abortInspect();
      this.offerSpecAgain();
      return;
    }
    const request = this.request;
    if ((install.phase !== "starting" && install.phase !== "running" && install.phase !== "unconfirmed") || request === undefined) return;
    if (request.cancellation !== undefined && !request.cancellation.waitingForStart) return;
    const cancellation = { waitingForStart: false };
    request.cancellation = cancellation;
    await this.sendCancellation(request, cancellation);
  }

  /**
   * Một yêu cầu huỷ vượt trước lúc cài được gửi lại sau khi Host xác nhận request đó.
   * Nhận: `request` — lần cài đang theo dõi; `cancellation` — yêu cầu huỷ.
   * Trả: hoàn tất khi Host đã trả lời (hoặc khi câu trả lời không còn dùng được).
   */
  private async sendCancellation(request: InstallRequest, cancellation: { waitingForStart: boolean }): Promise<void> {
    const acknowledged = request.acknowledged;
    cancellation.waitingForStart = false;
    this.patchInstall({ phase: "cancelling", failure: null });
    const result = await this.ctx.remote.pluginManager.cancelInstall(request.requestId);
    if (this.disposed || this.request !== request || request.cancellation !== cancellation) return;
    if (!result.ok) {
      cancellation.waitingForStart = !request.acknowledged;
      if (request.acknowledged) request.cancellation = undefined;
      this.installUncertain(request.replyLost ? "result" : "cancellation", result.error.message);
      return;
    }
    if (result.value.status === "cancelled") {
      this.finishAnalytics("cancelled");
      this.offerSpecAgain({ kind: "cancelled", seq: ++this.noticeSeq });
      void this.load();
    } else if (result.value.status === "too-late") {
      request.acknowledged = true;
      request.cancellation = undefined;
      this.patchInstall({ phase: "applying" });
      this.notifyHiddenInstall("applying");
      void this.reconcileInstall();
    } else if (request.replyLost) {
      request.cancellation = undefined;
      this.installUncertain("result", "");
      void this.reconcileInstall();
    } else if (!acknowledged && this.getSnapshot().install.phase !== "applying") {
      if (request.acknowledged) await this.sendCancellation(request, cancellation);
      else {
        cancellation.waitingForStart = true;
        this.installUncertain("acceptance", "");
      }
    } else {
      request.cancellation = undefined;
      this.installUncertain("cancellation", "");
    }
  }

  /** Toast cho một kết cục của lần cài khi hộp thoại đang ẩn. */
  private notifyHiddenInstall(outcome: "done" | "failed" | "unconfirmed" | "applying" | "unknown"): void {
    if (!this.getSnapshot().install.open) {
      this.patch({ notice: { kind: "install", outcome, seq: ++this.noticeSeq } });
    }
  }

  /**
   * Giải phóng request đang theo dõi và quay về sửa với spec được giữ lại. Toast huỷ chỉ được cấp sau khi
   * Host xác nhận đã dừng.
   * Nhận: `notice` — toast kèm theo (null: không toast).
   * Trả: không.
   */
  private offerSpecAgain(notice: ManagerNotice | null = null): void {
    this.request = undefined;
    this.patch({
      install: specAgain(this.getSnapshot().install),
      ...notice === null ? {} : { notice },
    });
  }

  /**
   * Bật bundle mà lần cài đã xong thêm vào, đóng hộp thoại và đánh dấu nó trong danh sách (lời từ chối vẫn
   * hiện toast và vẫn đóng). Nhận: không. Trả: hoàn tất khi đã đóng và đọc lại Host.
   */
  private async enableInstalled(): Promise<void> {
    const install = this.getSnapshot().install;
    if (install.phase !== "done" || install.enabling) return;
    const name = install.installed;
    this.patchInstall({ enabling: true });
    if (name !== null) {
      const result = await this.ctx.remote.pluginManager.setBundleEnabled(name, true);
      if (this.disposed) return;
      try {
        this.applied(result, name);
        if (result.ok && (result.value.application === "applied" || result.value.application === "restart-required")) this.trackToggle(name, true);
      } catch (error) {
        this.patch({ notice: failedNotice(error, { packageName: name, action: "enable" }, ++this.noticeSeq) });
      }
    }
    this.patch({ install: IDLE_INSTALL, highlight: name });
    await this.load();
  }

  /**
   * Chạy MỘT action dưới một khoá bận, biến thất bại của nó thành toast, và đọc lại Host sau đó dù kết quả ra sao.
   * Nhận: `key` — khoá bận; `subject` — việc đang làm và gói liên quan (cho toast); `action` — việc cần chạy.
   * Trả: hoàn tất khi action xong và Host đã được đọc lại.
   */
  private async run(key: string, subject: { readonly packageName?: string; readonly action: "enable" | "disable" | "uninstall" | "rowEnable" | "rowDisable" }, action: () => Promise<void>): Promise<void> {
    if (this.disposed || this.getSnapshot().busy.includes(key)) return;
    this.patch({ busy: [...this.getSnapshot().busy, key], notice: null });
    try {
      await action();
    } catch (error) {
      this.patch({ notice: failedNotice(error, subject, ++this.noticeSeq) });
    } finally {
      this.patch({ busy: this.getSnapshot().busy.filter((entry) => entry !== key) });
    }
    await this.load();
  }

  /**
   * Phát kết cục của một thay đổi: lời từ chối hoặc thay đổi Host không áp dụng được thì NÉM để {@link run} báo;
   * thay đổi chờ lần khởi động sau, bị lớp trên đè, hoặc bị Host dừng thì nói thoáng qua bằng toast.
   * Nhận: `answer` — kết quả Remote; `packageName` — gói liên quan (cho toast).
   * Trả: không.
   */
  private applied(answer: RemoteResult<ChangeResult>, packageName: string): void {
    if (!answer.ok) throw new RemoteAnswerError(answer.error.message);
    const result = answer.value;
    switch (result.application) {
      case "failed":
        throw new RemoteAnswerError(result.error?.diagnostic ?? "", result.error?.code, result.error?.incompatible);
      case "cancelled":
        this.patch({ notice: { kind: "cancelled", seq: ++this.noticeSeq } });
        return;
      case "restart-required":
        this.patch({ notice: { kind: "restart", packageName, reason: result.restartReason, seq: ++this.noticeSeq } });
        return;
      case "overridden":
        this.patch({ notice: { kind: "overridden", packageName, seq: ++this.noticeSeq } });
        return;
      case "applied":
        return;
    }
  }

  /**
   * Ghi sự kiện bật/tắt (bundle hoặc một row của nó).
   * Nhận: `name` — tên gói hoặc id entry; `enabled` — trạng thái mới; `row` — true khi là một row.
   * Trả: không.
   */
  private trackToggle(name: string, enabled: boolean, row = false): void {
    const bundle = this.getSnapshot().packages.find((pkg) => row ? pkg.rows.some((item) => item.entryId === name) : pkg.name === name);
    const pluginName = row ? bundle?.rows.find((item) => item.entryId === name)?.moduleName : name;
    if (bundle === undefined || pluginName === undefined) return;
    this.ctx.get("productAnalytics")?.track("plugin_toggle", {
      plugin_name: pluginName,
      plugin_type: row ? "plugin" : "bundle",
      is_enabled: enabled,
      is_builtin: bundle.availability === "installation",
    });
  }

  /**
   * Kết thúc phép đo của một lần cài và ghi sự kiện kết quả.
   * Nhận: `status` — kết cục; `reason` — lý do lỗi; `name` — gói đã cài.
   * Trả: không.
   */
  private finishAnalytics(status: "success" | "failed" | "cancelled" | "unknown", reason?: string, name?: string): void {
    const attempt = this.analyticsAttempt;
    this.analyticsAttempt = undefined;
    if (attempt === undefined || this.disposed) return;
    const errorReason = status === "cancelled" ? "user_cancelled" : status === "unknown" ? "unknown_result" : reason;
    this.ctx.get("productAnalytics")?.track("install_plugin_result", {
      input_value: attempt.input,
      is_success: status === "success",
      duration: Math.max(0, Date.now() - attempt.started),
      ...errorReason === undefined ? {} : { error_reason: errorReason },
      ...name === undefined ? {} : { plugin_name: name },
    });
  }

  /** Ghi một phần ảnh chụp mới (bỏ qua sau khi dọn). */
  private patch(next: Partial<PluginManagerState>): void {
    if (this.disposed) return;
    this.store.set({ ...this.getSnapshot(), ...next });
  }

  /** Ghi một phần trạng thái hộp thoại cài đặt (bỏ qua sau khi dọn). */
  private patchInstall(next: Partial<InstallState>): void {
    this.patch({ install: { ...this.getSnapshot().install, ...next } });
  }
}
