/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — thêm `applyPatches`: bề mặt áp danh sách patch cho `configEditor` ghi cấu hình.
 *      Lý do (đo thật 11/11/2026): MỌI lượt ghi cấu hình bị Host từ chối `settings/rejected: dsh: profile
 *      reload requires the root Include entry` vì `reconcileProfilePatches` của kernel tra WeakMap
 *      `bootstrapIncludes` khoá theo ctx boot — hồ sơ của ta compose bằng bundle patch nên ctx đó không khớp
 *      (cùng ngõ cụt đã đóng ở VÒNG 60 cho công tắc bundle). Đường đúng: lấy entry Include từ loader rồi làm
 *      đúng 3 bước cuối của kernel (đã có trong profile-apply.ts).
 * desc Dich vu HMR cua host (`ctx.hmr`): theo doi module + patch cua profile, thay the plugin dang chay
 *      theo lo, va phat hai su kien `hmr/change` · `hmr/reload` — ban viet lai cua @deepseek-ai/dsh-hmr.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { watch } from "chokidar";
import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { PROFILE_PATCH_FILENAME, loadProfileDirectory, readProfileManifest, readProfilePatches, recomposeProfile } from "@deepseek-ai/dsh-app-boot";
import { Config, type HmrConfig } from "./config.ts";
import { handleError } from "./error.ts";
import { globMatcher } from "./ignore.ts";
import {
  EntryNamespaces,
  MODULE_ERRORED,
  ReloadModules,
  canonicalPath,
  commonJsCache,
  linkedJobs,
  loadDependencies,
  mappedDirectories,
  moduleJobs,
  namespaceOf,
  packageManifests,
  profileRoots,
} from "./loader-cache.ts";
import { ModuleFiles } from "./module-files.ts";
import { PackageManifests } from "./package-manifests.ts";
import { applyProfilePatches } from "./profile-apply.ts";
import { watchConfig } from "./watch-config.ts";

/** Context cua kernel nhin qua goc do dong: cac seam (`loader` · `registry` · `timer` …) do goi khac nang cap. */
type AnyCtx = Record<string, any>;

/** Vi tri module va runtime duoc giu lai trong mot lan thay the. */
export interface Reload {
  /** Duong dan tep cua module chinh. */
  filename: string;
  /** Namespace goc va URL cua MOI module entry tham gia lan thay the nay. */
  modules: ReloadModules;
  /** Runtime cua plugin, khi co. */
  runtime?: any;
}

/** Ket qua cua {@link Hmr.reconcileProfile}. */
export interface ProfileReconciliation {
  /** Chan doan cho cac entry Loader con inactive. */
  warnings: string[];
  /** Module da nap co tep doi tren dia, code cu con chay toi khi khoi dong lai. */
  pending: PendingModule[];
  /** Vi sao MOI thay doi phai cho khoi dong lai. */
  restartReason?: "module-comparison" | "package-moved";
}

/** Mot module da doi chi nap sau khi khoi dong lai. */
export interface PendingModule {
  /** URL cua module. */
  url: string;
  /** `host-module`: do thi tinh cua entry tien trinh import no · `unmanaged-plugin`: plugin ngoai entry · `module-comparison`: khong so duoc. */
  reason: "host-module" | "unmanaged-plugin" | "module-comparison";
}

/** Fiber cu cua runtime, kem config va namespace da dung. */
interface ReloadFiber {
  fiber: any;
  entry: any;
  config: unknown;
  moduleNamespace: unknown;
}

/** Mot lan thay the da nap xong module, cho buoc dung plugin cu va chay plugin moi. */
interface ReplacementAttempt {
  filename: string;
  runtime: any;
  modules: ReloadModules;
  previous: any;
  fibers: ReloadFiber[];
  replacement: any;
  replacements: ReloadModules;
  activated: any[];
}

/** Ke hoach thay the module: cai gi bi dua ra khoi cache, manifest nao het han, plugin/fiber nao dung. */
interface ReplacementPlan {
  pending: PendingModule[];
  evicted: Set<string>;
  manifests: Set<string>;
  plugins: Set<any>;
  fibers: Set<any>;
}

/** Dich vu hot reload voi cau hinh module va su kien tuong thich Cordis. */
export class Hmr extends Service {
  /** Seam bat buoc: Loader cua kernel (module + entry) va timer (debounce). */
  static inject = ["loader", "timer"];

  /** Schema cau hinh Hmr — dung hinh dang ban goc. */
  static Config = Config;

  /** Cau hinh da qua schema. */
  config: HmrConfig;

  /** Thu muc goc tuyet doi dung de giai cac goc watch module. */
  baseDir: string;

  /** Context so huu (khac `this.ctx` cua service — dung cho `get` cac seam khac). */
  private readonly ownerContext: Context;

  /** Bo giao dien Node internals cua Loader. */
  private internal: any;

  /** Watcher cua cac goc module. */
  private watcher: any;

  /** Phu thuoc tinh cua entry worker CLI — thay doi o day LUON keo theo reload toan bo. */
  private externals!: Set<string>;

  /** Tep duoc nap lai (thay doi duoc chap nhan), gom moi tep da gom va cac tep phu thuoc. */
  private accepted!: Set<string>;

  /** Tep KHONG duoc nap lai, gom externals va tep ma moi phu thuoc deu tu choi. */
  private declined!: Set<string>;

  /** Thay doi tep da gom, cho xu ly. */
  private stashed = new Set<string>();

  /** Hang doi tuan tu cho moi lan thay the. */
  private operations: Promise<unknown> = Promise.resolve();

  /** Danh dau dang o trong mot giao dich `runExclusive`. */
  private executing = new AsyncLocalStorage<boolean>();

  /** Doi den khi ung dung san sang (neu co `appReady`). */
  private applicationReady: Promise<boolean> = Promise.resolve(true);

  /** Service da bi huy hay chua. */
  private closing = false;

  /** Duong dan cau hinh da dang ky (ca dang that lan dang cau hinh). */
  private readonly configPaths = new Set<string>();

  /** Cau hinh package da lam het han. */
  private readonly manifests = new PackageManifests();

  /** Danh tinh tep cua cac module da nap. */
  private readonly files = new ModuleFiles();

  /** Moi module nam trong do thi TINH tu entry tien trinh, gom ca trong `node_modules`; gom o lan dung dau. */
  private hostModules!: () => Promise<Set<string>>;

  /**
   * Tuan tu mot thay doi do nguoi goi so huu voi MOI duong reload tu dong.
   * @param operation - viec khong duoc chong lan voi viec thay the module hoac cau hinh.
   * @returns Ket qua cua operation sau khi phan bat dong bo xong.
   */
  runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (this.executing.getStore()) return Promise.reject(new Error("HMR transactions cannot be nested"));
    const task = this.operations.then(async () => {
      if (this.closing) throw new Error("HMR is disposed");
      return this.executing.run(true, operation);
    });
    this.operations = task.catch(() => {});
    return task;
  }

  /**
   * Chay mot lan reload trong hang doi, chi khi ung dung da san sang.
   * @param operation - viec can chay.
   * @returns Promise hoan tat khi operation xong (hoac bi bo qua).
   */
  private runReload(operation: () => Promise<void>): Promise<void> {
    return this.runExclusive(async () => {
      if (await this.applicationReady) await operation();
    });
  }

  /**
   * Theo doi MOT duong dan cau hinh qua CUNG hang doi voi viec thay the module.
   * @param filename - duong dan tuyet doi (co the chua ton tai).
   * @param refresh - ham dung lai cau hinh tu cac tep hien tai va doi Loader hoan tat.
   * @returns Disposer dong dang ky nay va doi luot refresh dang cho.
   * @throws Khi duong dan da duoc dang ky, hoac khi khoi dong watcher that bai.
   */
  async watchConfig(filename: string, refresh: () => Promise<void>): Promise<() => Promise<void>> {
    const paths = [resolve(filename), canonicalPath(filename)];
    if (paths.some((path) => this.configPaths.has(path))) throw new Error(`config path already registered: ${filename}`);
    for (const path of paths) this.configPaths.add(path);
    try {
      const dispose = await this.executing.exit(() =>
        watchConfig(
          this.ownerContext as any,
          filename,
          this.config,
          () => this.runReload(refresh),
          () => this.executing.getStore() === true,
        ),
      );
      return async () => {
        await dispose();
        for (const path of paths) this.configPaths.delete(path);
      };
    } catch (error) {
      for (const path of paths) this.configPaths.delete(path);
      throw error;
    }
  }

  /**
   * Dang ky service `hmr` tren context cua kernel.
   * @param ctx - context host.
   * @param config - cau hinh da qua schema.
   * @throws Khi Loader khong lo `internal` (`--expose-internals` la bat buoc voi HMR).
   */
  constructor(ctx: Context, config: HmrConfig) {
    super(ctx, "hmr");
    this.config = config;
    this.ownerContext = ctx;
    const host = ctx as unknown as AnyCtx;
    if (!host.loader.internal) throw new Error("--expose-internals is required for HMR service");
    this.internal = host.loader.internal;
    this.baseDir = fileURLToPath(new URL(config.base || ".", host.baseUrl));
  }

  /**
   * Job ESM da cache cho mot URL. Worker dong goi khong lo cache module cua Node; Node native giu cache nay ke ca
   * khi hook module bat dong bo chay o thread khac.
   * @param url - URL module.
   * @returns Module job, hoac `undefined`.
   */
  private esmJob(url: string): any {
    return this.hasEsmCache() ? this.internal.loadCache.get(url) : undefined;
  }

  /**
   * Thread nay co giu cache module ESM cua Node khong.
   * @returns `true` khi co cache.
   */
  private hasEsmCache(): boolean {
    return Reflect.get(this.internal, "loadCache") !== undefined;
  }

  /**
   * Cache ESM co job cho URL nay khong.
   * @param url - URL module.
   * @param type - dinh dang (`json` …), khi can phan biet.
   * @returns `true` khi co (va thread co cache).
   */
  private esmHas(url: string, type?: string): boolean {
    return this.hasEsmCache() && (type === undefined ? this.internal.loadCache.has(url) : this.internal.loadCache.has(url, type));
  }

  /**
   * Khoa cua cache ESM (rong khi thread khong co cache).
   * @returns Danh sach URL.
   */
  private esmUrls(): string[] {
    return this.hasEsmCache() ? [...((Map.prototype.keys as any).call(this.internal.loadCache) as Iterable<string>)] : [];
  }

  /**
   * Khoa cache ESM va ten tep cua cache CommonJS, duoi dang URL.
   * @returns Vong lap URL.
   */
  private *loadedUrls(): Generator<string> {
    yield* this.esmUrls();
    for (const filename of Object.keys(commonJsCache())) yield pathToFileURL(filename).href;
  }

  /**
   * Module job cua entry tien trinh, khi Loader da cache no duoi duong dan THAT cua entry.
   * @returns Module job, hoac `undefined`.
   */
  private mainJob(): any {
    const entry = process.argv[1];
    if (entry === undefined) return undefined;
    return this.esmJob(pathToFileURL(canonicalPath(resolve(entry))).href);
  }

  /**
   * Khoi dong service: doi ung dung san sang (neu co), theo doi cac tep patch cua profile, roi dung watcher module.
   * @returns Generator cua cac disposer (cordis goi qua ky hieu `Service.init`).
   */
  async *[Service.init](): AsyncGenerator<() => Promise<void> | void, void, void> {
    const ctx = this.ctx as unknown as AnyCtx;
    const mainJob = this.mainJob();
    let host: Promise<Set<string>> | undefined;
    this.hostModules = () => (host ??= mainJob === undefined ? Promise.resolve(new Set<string>()) : loadDependencies(mainJob, new Set(), true));
    yield async () => {
      this.closing = true;
      await this.watcher?.close();
      if (!this.executing.getStore()) await this.operations;
      this.manifests.dispose();
    };
    const profile = this.ownerContext.get("profileContext") as any;
    if (profile !== undefined) {
      const ready = this.ownerContext.get("appReady") as any;
      if (ready === undefined) throw new Error("Profile HMR requires application readiness");
      const started = Promise.withResolvers<boolean>();
      this.applicationReady = started.promise;
      const unsubscribe = ready.onReady(() => {
        try {
          this.files.observe(this.profileModules(profileRoots(profile.dir)));
        } catch (error) {
          ctx.logger.warn(error);
        }
        started.resolve(true);
      });
      yield () => {
        unsubscribe();
        started.resolve(false);
        return Promise.resolve();
      };
      const manifestPath = join(profile.dir, "package.json");
      const patchFiles = [profile.patchPath, join(profile.home, PROFILE_PATCH_FILENAME)];
      let lastInputs: string | undefined;
      let lastBundles = JSON.stringify(profile.startedBundles);
      const refresh = async (manifestOnly: boolean) => {
        const bundles = JSON.stringify(readProfileManifest("dsh", profile.dir).dsh?.profile?.bundles ?? []);
        if (manifestOnly && bundles === lastBundles) return;
        const inputs = JSON.stringify([
          bundles,
          ...patchFiles.map((filename) => {
            try {
              return readFileSync(filename, "utf8");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
              throw error;
            }
          }),
        ]);
        if (inputs === lastInputs) return;
        const { warnings, pending, restartReason } = await this.reconcileProfile();
        if (restartReason !== undefined) ctx.logger.warn("restart required: %s", restartReason);
        if (pending.length > 0) ctx.logger.warn("changed modules keep running their previous code until a restart: %o", pending);
        lastInputs = inputs;
        lastBundles = bundles;
        for (const diagnostic of warnings) ctx.logger.warn(diagnostic);
      };
      for (const filename of patchFiles) await this.watchConfig(filename, () => refresh(false));
      await this.watchConfig(manifestPath, () => refresh(true));
    }
    const { loader } = ctx;
    const { root, ignored } = this.config;
    if (!this.config.base) ctx.logger.info("watching %o", root);
    else ctx.logger.info("watching %o in %s", root, this.baseDir);
    const match = globMatcher(ignored);
    const watchBaseDir = realpathSync(this.baseDir);
    this.externals = mainJob ? await loadDependencies(mainJob) : new Set<string>();
    this.watcher = watch(root, {
      ...this.config,
      cwd: watchBaseDir,
      ignored: (path: string) => match(relative(watchBaseDir, path)),
      ignoreInitial: true,
    });
    const changed = new Set<string>();
    const dispatch = ctx.debounce(() => {
      this.runExclusive(async () => {
        if (!(await this.applicationReady)) return;
        const batch = [...changed];
        changed.clear();
        const includes = new Set<any>();
        let fullReload = false;
        for (const path of batch) {
          const filename = canonicalPath(resolve(watchBaseDir, path));
          const configuredFilename = resolve(this.baseDir, path);
          if (this.configPaths.has(filename) || this.configPaths.has(configuredFilename)) continue;
          const isManifest = basename(filename) === "package.json" && !filename.includes(`${sep}node_modules${sep}`);
          if (isManifest) this.manifests.invalidate(filename);
          const url = pathToFileURL(filename).href;
          if (this.externals.has(url)) {
            fullReload = true;
            continue;
          }
          if (this.esmHas(url) || this.esmHas(url, "json")) {
            this.stashed.add(url);
            continue;
          }
          if (isManifest) continue;
          const include = [...loader.entries()].map((entry: any) => entry.subtree).find((tree: any) => tree?.filename === filename || tree?.filename === configuredFilename);
          if (include !== undefined) includes.add(include);
          else ctx.emit("hmr/change", url);
        }
        if (!fullReload && includes.size === 0 && this.stashed.size === 0) return;
        if (fullReload) {
          loader.exit();
          return;
        }
        for (const include of includes) await include.refresh();
        if (this.stashed.size > 0) {
          try {
            await this.partialReload();
          } finally {
            this.stashed.clear();
          }
        }
        await loader.await();
      }).catch((error) => {
        ctx.logger.warn(error);
      });
    }, this.config.debounce);
    this.watcher.on("change", (path: string) => {
      changed.add(path);
      dispatch();
    });
    const ready = Promise.withResolvers<void>();
    let readyState: "pending" | "resolved" | "rejected" = root.length === 0 ? "resolved" : "pending";
    if (root.length === 0) ready.resolve();
    else
      this.watcher.once("ready", () => {
        readyState = "resolved";
        ready.resolve();
      });
    this.watcher.on("error", (error: unknown) => {
      if (readyState === "pending") {
        readyState = "rejected";
        ready.reject(error);
      } else ctx.logger.warn(error);
    });
    await ready.promise;
  }

  /** Bo cac khung HMR noi bo khoi chan doan import module. */
  getOuterStack = (): string[] => [];

  /**
   * Doc URL phu thuoc TRUC TIEP cua mot module tu Loader Node dang chay.
   * @param url - URL module.
   * @returns URL cac module duoc lien ket (rong voi module chua cache).
   */
  async getLinked(url: string): Promise<string[]> {
    const job = this.esmJob(url);
    if (!job) return [];
    const linked = await job.linked;
    return Array.prototype.map.call(linked, (child: any) => child.url) as string[];
  }

  /**
   * Phan loai tep da doi thanh CHAP NHAN (nen nap lai) va TU CHOI (khong nap lai).
   *
   * Mot tep duoc chap nhan khi no doi truc tiep (da gom) hoac khi co phu thuoc duoc chap nhan. Mot tep bi tu choi
   * khi moi phu thuoc cua no deu bi tu choi, hoac khi no la external.
   * @returns Promise hoan tat khi da phan loai xong (`accepted` · `declined` duoc cap nhat).
   */
  private async analyzeChanges(): Promise<void> {
    const pending: string[] = [];
    this.accepted = new Set(this.stashed);
    this.declined = new Set(this.externals);
    const isExcluded = (url: string) => url.startsWith("node:") || url.includes("/node_modules/");
    await Promise.all(
      [...this.stashed].map(async (url) => {
        const children = await this.getLinked(url);
        for (const child of children) {
          if (this.accepted.has(child) || this.declined.has(child) || isExcluded(child)) continue;
          pending.push(child);
        }
      }),
    );
    while (pending.length) {
      let index = 0;
      let hasUpdate = false;
      while (index < pending.length) {
        const url = pending[index] as string;
        const children = await this.getLinked(url);
        let isDeclined = true;
        let isAccepted = false;
        for (const child of children) {
          if (this.declined.has(child) || isExcluded(child)) continue;
          if (this.accepted.has(child)) {
            isAccepted = true;
            break;
          } else {
            isDeclined = false;
            if (!pending.includes(child)) {
              hasUpdate = true;
              pending.push(child);
            }
          }
        }
        if (isAccepted || isDeclined) {
          hasUpdate = true;
          pending.splice(index, 1);
          if (isAccepted) this.accepted.add(url);
          else this.declined.add(url);
        } else index++;
      }
      if (!hasUpdate) break;
    }
    for (const url of pending) this.declined.add(url);
  }

  /**
   * Nap lai cac module da doi theo lo: dung plugin cu, nap module moi, roi chay lai plugin tren fiber tuong ung.
   * @returns Promise hoan tat khi moi lan thay the xong (hoac nem loi dau tien, sau khi da hoan tac).
   */
  private async partialReload(): Promise<void> {
    const ctx = this.ctx as unknown as AnyCtx;
    await this.analyzeChanges();
    const pending = new Map<any, any>();
    const reloads = new Map<any, Reload>();
    const moduleUrls = EntryNamespaces.getModuleUrls(this.internal);
    const nameMap = new Map<string, EntryNamespaces>();
    for (const entry of ctx.loader.entries()) {
      const baseUrl = entry.parent.tree.ctx.baseUrl;
      if (baseUrl === undefined) throw new Error("HMR entry tree has no base URL");
      const names = nameMap.get(baseUrl) ?? new EntryNamespaces(this.internal, moduleUrls);
      names.add(entry.options.name, entry.moduleNamespace);
      nameMap.set(baseUrl, names);
    }
    for (const [baseUrl, names] of nameMap) {
      for (const [name, moduleNamespace] of names) {
        try {
          const { url } = await names.resolve(name, baseUrl, moduleNamespace);
          if (this.declined.has(url)) continue;
          const job = this.esmJob(url);
          const plugin = ctx.loader.unwrapExports(job?.module?.getNamespace());
          if (!job || !plugin) continue;
          pending.set(job, plugin);
          this.declined.add(url);
        } catch (err) {
          ctx.logger.warn(err);
        }
      }
    }
    for (const [job, plugin] of pending) {
      this.declined.delete(job.url);
      const dependencies = [...(await loadDependencies(job, this.declined))];
      this.declined.add(job.url);
      if (dependencies.length === 0) {
        pending.delete(job);
        continue;
      }
      if (!dependencies.some((dep) => this.accepted.has(dep))) continue;
      dependencies.forEach((dep) => this.accepted.add(dep));
      const runtime = ctx.registry.get(plugin);
      if (ReloadModules.include(reloads, plugin, job, runtime)) continue;
      reloads.set(plugin, { filename: job.url, runtime, modules: new ReloadModules().add(job, plugin) });
    }
    for (const [job, plugin] of pending) if (ReloadModules.include(reloads, plugin, job, ctx.registry.get(plugin))) this.accepted.add(job.url);
    const rollback = this.evict(this.accepted);
    const generations = [...reloads].map(([previous, info]) => ({
      ...info,
      previous,
      fibers: [...(info.runtime?.fibers ?? [])].map((fiber: any) => {
        const entry = fiber.entry?.fiber?.uid === fiber.uid ? fiber.entry : undefined;
        return {
          fiber,
          entry,
          config: entry === undefined ? fiber._config : entry.options.config,
          moduleNamespace: entry?.moduleNamespace,
        };
      }),
    })) as ReplacementAttempt[];
    const attempts: ReplacementAttempt[] = [];
    try {
      for (const generation of generations) {
        const moduleNamespace = await ctx.loader.import(generation.filename, this.getOuterStack);
        const replacement = ctx.loader.unwrapExports(moduleNamespace);
        const replacements = await generation.modules.importRemaining(ctx.loader, this.getOuterStack, {
          filename: generation.filename,
          moduleNamespace,
          plugin: replacement,
        });
        attempts.push({ ...generation, replacement, replacements, activated: [] });
      }
    } catch (e) {
      handleError({ logger: ctx.logger }, e);
      rollback();
      throw e;
    }
    const reload = async (plugin: any, fibers: readonly ReloadFiber[], replacements = new ReloadModules(), activated: any[] = []) => {
      for (const [previousFiber, implementation] of replacements.getActiveImplementations(ctx, plugin, fibers)) {
        const fiber = previousFiber.fiber.parent.registry.plugin(implementation, previousFiber.config, this.getOuterStack).ctx.fiber;
        if (previousFiber.entry !== undefined) {
          fiber.entry = previousFiber.entry;
          previousFiber.entry.fiber = fiber;
        }
        activated.push(fiber);
      }
      await Promise.all(activated.map((fiber) => fiber.await()));
    };
    const removed = new Set<any>();
    try {
      for (const { previous: plugin, replacement, filename, runtime, fibers, replacements, activated } of attempts) {
        if (!runtime) continue;
        const path = relative(this.baseDir, fileURLToPath(filename));
        removed.add(plugin);
        try {
          ctx.registry.delete(plugin);
          await Promise.all(fibers.map(({ fiber }) => fiber.await()));
        } catch (err) {
          ctx.logger.warn("failed to dispose plugin at %C", path);
          ctx.logger.warn(err);
        }
        try {
          await reload(replacement, fibers, replacements, activated);
          ctx.logger.info("reload plugin at %C", path);
        } catch (err) {
          ctx.logger.warn("failed to reload plugin at %C", path);
          ctx.logger.warn(err);
          throw err;
        }
      }
    } catch (error) {
      rollback();
      for (const { previous: plugin, fibers, activated } of attempts) {
        if (!removed.has(plugin)) continue;
        try {
          for (const { runtime } of activated) {
            if (runtime && ctx.registry.get(runtime.callback) === runtime) {
              const replacementFibers = [...runtime.fibers];
              ctx.registry.delete(runtime.callback);
              await Promise.allSettled(replacementFibers.map((fiber: any) => fiber.await()));
            }
          }
          await reload(plugin, fibers);
        } catch (err) {
          ctx.logger.warn(err);
        }
      }
      throw error;
    }
    await ctx.loader.await();
    for (const { replacements } of attempts) replacements.updateEntries(ctx.loader);
    ctx.emit("hmr/reload", reloads);
    this.files.refresh(this.accepted);
    this.stashed = new Set();
  }

  /**
   * Dua module ra khoi cache ESM va CommonJS de lan import sau danh gia lai tep cua chung.
   *
   * Module CommonJS nap qua `import()` nam o CA HAI cache. `LoadCache` cua Node anh xa moi URL toi job theo
   * dinh dang, va `delete()` cua no chi xoa MOT o dinh dang, nen ca muc duoc xoa qua `Map.prototype`.
   * @param urls - URL module can dua ra khoi cache.
   * @returns Ham hoan tac da xoa.
   */
  private evict(urls: Iterable<string>): () => void {
    const esmBackup = new Map<string, any>();
    const cjsBackup = new Map<string, any>();
    const cache = commonJsCache();
    const list = [...urls];
    const cached = new Set(this.esmUrls());
    for (const url of list) {
      if (cached.has(url)) {
        esmBackup.set(url, (Map.prototype.get as any).call(this.internal.loadCache, url));
        (Map.prototype.delete as any).call(this.internal.loadCache, url);
      }
    }
    for (const filepath of list.filter((url) => url.startsWith("file:")).map((url) => fileURLToPath(url))) {
      const module = cache[filepath];
      if (module !== undefined) {
        cjsBackup.set(filepath, module);
        Reflect.deleteProperty(cache, filepath);
      }
    }
    return () => {
      for (const [url, job] of esmBackup) (Map.prototype.set as any).call(this.internal.loadCache, url, job);
      for (const [filepath, module] of cjsBackup) cache[filepath] = module;
    };
  }

  /**
   * Module `file:` da nap nam duoi cac goc profile chi dinh.
   * @param roots - cac goc (kem dau phan cach).
   * @returns URL cac module.
   */
  private profileModules(roots: readonly string[]): string[] {
    return [...this.loadedUrls()].filter((url) => {
      if (!url.startsWith("file:")) return false;
      const filename = fileURLToPath(url);
      return roots.some((root) => filename.startsWith(root));
    });
  }

  /**
   * Canh import TINH giua cac module da nap, gom ca lien ket ESM va con cua `require` CommonJS.
   * @returns Anh xa tu con sang tap cha.
   */
  private async moduleGraph(): Promise<Map<string, Set<string>>> {
    const importers = new Map<string, Set<string>>();
    const add = (parent: string, child: string) => {
      const set = importers.get(child) ?? new Set<string>();
      set.add(parent);
      importers.set(child, set);
    };
    await Promise.all(
      [...moduleJobs(this.internal)].map(async (job) => {
        for (const child of await linkedJobs(job)) add(job.url, child.url);
      }),
    );
    for (const [filename, module] of Object.entries(commonJsCache())) {
      const children = module === undefined ? undefined : Reflect.get(module, "children");
      if (!Array.isArray(children)) continue;
      for (const child of children) add(pathToFileURL(filename).href, pathToFileURL(child.filename).href);
    }
    return importers;
  }

  /**
   * Lap ke hoach thay the module da doi ma CHUA doi gi. Module doi ma importer cham toi do thi tinh cua entry
   * tien trinh, hoac plugin khong do entry Loader nao anh huong khoi chay, se o lai cung importer va thanh PENDING.
   * @param stale - URL module da doi.
   * @param roots - thu muc (kem dau phan cach) gioi han manifest het han.
   * @returns Module pending va phan thay the cua cac module con lai.
   */
  private async planReplacement(stale: Iterable<string>, roots: readonly string[]): Promise<ReplacementPlan> {
    const importers = await this.moduleGraph();
    const host = await this.hostModules();
    const managed = new Set<any>(this.ctx.loader.entries());
    const plan: ReplacementPlan = { pending: [], evicted: new Set(), manifests: new Set(), plugins: new Set(), fibers: new Set() };
    for (const url of stale) {
      const affected = new Set<string>([url]);
      for (const module of affected) for (const importer of importers.get(module) ?? []) affected.add(importer);
      const running = [...new Set([...affected].flatMap((module) => this.pluginsOf(module)))].flatMap((plugin) =>
        [...(this.ctx.registry.get(plugin)?.fibers ?? [])].map((fiber: any) => ({ plugin, fiber })),
      );
      const affectedFibers = new Set(running.map(({ fiber }) => fiber));
      /** Entry Loader co fiber rieng chay plugin bi anh huong, va khoi dong fiber nay truc tiep hoac qua to tien. */
      const owner = (fiber: any) => {
        for (let current = fiber; current.uid !== 0; current = current.parent.fiber) {
          const entry = current.entry;
          if (entry?.fiber === current && managed.has(entry) && affectedFibers.has(current)) return entry;
        }
        return undefined;
      };
      const entries = running.flatMap(({ fiber }) => owner(fiber) ?? []);
      const reason = [...affected].some((module) => host.has(module)) ? "host-module" : entries.length < running.length ? "unmanaged-plugin" : undefined;
      if (reason !== undefined) {
        plan.pending.push({ url, reason });
        continue;
      }
      for (const manifest of packageManifests(url, roots)) plan.manifests.add(manifest);
      for (const module of affected) plan.evicted.add(module);
      for (const { plugin, fiber } of running) {
        plan.plugins.add(plugin);
        plan.fibers.add(fiber);
      }
    }
    return plan;
  }

  /**
   * Cac plugin ma mot module da nap xuat ra, doc tu namespace ESM va exports CommonJS da cache — khong danh gia lai.
   * @param url - URL module da nap.
   * @returns Danh sach plugin xuat ra.
   */
  private pluginsOf(url: string): any[] {
    const namespace = namespaceOf(this.esmJob(url));
    const required = url.startsWith("file:") ? commonJsCache()[fileURLToPath(url)] : undefined;
    return [namespace, required?.loaded === true ? required.exports : undefined]
      .filter((value) => value !== undefined)
      .map((value) => this.ctx.loader.unwrapExports(value));
  }

  /**
   * Thi hanh ke hoach: lam het han manifest, dua module ra khoi cache KHONG sao luu, va dung cac entry Loader
   * de lan apply ke tiep import tep hien tai khi khoi dong chung.
   * @param plan - ke hoach tu {@link planReplacement}.
   */
  private async stopPlanned(plan: ReplacementPlan): Promise<void> {
    for (const manifest of plan.manifests) this.manifests.invalidate(manifest);
    this.evict(plan.evicted);
    for (const plugin of plan.plugins) this.ctx.registry.delete(plugin);
    await Promise.allSettled([...plan.fibers].map((fiber) => fiber.await()));
  }

  /**
   * Dua cac module nam duoi thu muc cua mapping bi BO ra khoi cache va lam het han cau hinh package, de mot
   * package bi tat/go roi bat lai duoc import tu dau. Module cua do thi tinh DSH va module duoi thu muc CON duoc
   * giu mapping thi o lai.
   * @param dropped - thu muc that (kem dau phan cach) cua cac mapping bi bo.
   * @param kept - thu muc that (kem dau phan cach) cua cac mapping con giu.
   */
  private async evictDropped(dropped: readonly string[], kept: ReadonlySet<string>): Promise<void> {
    if (dropped.length === 0) return;
    const host = new Set(await this.hostModules());
    const urls = this.profileModules(dropped).filter((url) => {
      const filename = fileURLToPath(url);
      return !host.has(url) && ![...kept].some((dir) => filename.startsWith(dir));
    });
    for (const url of urls) for (const manifest of packageManifests(url, dropped)) this.manifests.invalidate(manifest);
    this.evict(urls);
  }

  /**
   * Ghi nhan mot buoc thay the that bai va giu ket qua du phong cua nguoi goi.
   * @param step - ten buoc (dung trong canh bao).
   * @param operation - viec can chay.
   * @param fallback - ket qua tra ve khi operation nem.
   * @returns Ket qua cua operation, hoac fallback.
   */
  private async contained<T>(step: string, operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.ctx.logger.warn("%s failed; module replacement was not completed", step);
      this.ctx.logger.warn(error);
      return fallback;
    }
  }

  /**
   * Ap MOT danh sach patch cua profile vao entry Include dang chay — be mat cho `configEditor` ghi cau hinh.
   *
   * VI SAO CO HAM NAY (11/11/2026): duong chinh thuc cua kernel (`reconcileProfilePatches` /
   * `recomposeProfile`) tra WeakMap `bootstrapIncludes` khoa theo ctx LUC BOOT; ho so cua ta compose bang
   * bundle patch nen ctx ma plugin nhin thay khong khop ⇒ moi luot ghi cau hinh bi tu choi ngay dong dau
   * (`dsh: profile reload requires the root Include entry`, do that: settings/mutate ⇒ settings/rejected).
   * Cung ngo cut da dong o VONG 60 cho cong tac bundle: lay entry Include TU LOADER roi lam dung 3 buoc cuoi
   * cua kernel — o day la `applyProfilePatches` (profile-apply.ts).
   * Nguoi goi PHAI chay trong {@link runExclusive} (cung luat voi {@link reconcileProfile}).
   * @param patches - danh sach patch DAY DU cua luot nay (bundle · profile · home · overlay).
   * @param requiredIds - id entry ma trang thai inactive sau luot ap la LOI (kernel cung nem o truong hop nay).
   * @returns `{ warnings }` sau khi Include nhan patch moi, hoac undefined khi khong thay entry Include
   *          (nguoi goi tu quyet dinh duong du phong).
   * @throws Khi chuan bi patch hoac `include.update` that bai, hoac entry bat buoc khong activate.
   */
  async applyPatches(patches: readonly unknown[], requiredIds: readonly string[] = []): Promise<{ warnings: string[] } | undefined> {
    const ctx = this.ctx as unknown as AnyCtx;
    const applied = await applyProfilePatches({ ctx, owner: this.ownerContext, patches });
    if (applied === undefined) return undefined;
    // kernel recompose nem khi entry BAT BUOC con inactive sau luot ap — giu dung luat do, khong nuot loi.
    const inactive = requiredIds.filter((id) => {
      const row = [...ctx.loader.entries()].find((entry: any) => entry.options?.id === id);
      return row === undefined || row.fiber?.state !== 2;
    });
    if (inactive.length > 0) {
      throw new Error("profile patch apply left required entries inactive: " + inactive.join(", "));
    }
    return applied;
  }

  /**
   * Dung lai profile tu manifest va cac tep patch, thay the plugin dang chay co tep nam duoi thu muc profile (hoac
   * dich cua package lien ket) da doi tren dia, roi publish resolution runtime. Sau do app-boot's
   * `recomposeProfile` publish resolution, apply the generation, start lai cac entry da dung …
   * Nguoi goi phai chay TRONG {@link runExclusive}.
   * @param requiredIds - id entry ma trang thai inactive cua no bi bao la loi du co truoc lan goi nay.
   * @returns Chan doan entry inactive, module doi se nap sau khi khoi dong lai, va ly do khoi dong lai toan profile.
   * @throws Khi doc patch, publish, chuan bi, apply hoac kich hoat that bai.
   */
  async reconcileProfile(requiredIds: readonly string[] = []): Promise<ProfileReconciliation> {
    const ctx = this.ctx as unknown as AnyCtx;
    if (this.executing.getStore() !== true) throw new Error("HMR profile reconciliation must run inside runExclusive");
    const profile = this.ownerContext.get("profileContext") as any;
    if (profile === undefined) throw new Error("HMR profile reconciliation requires profileContext");
    const running = [...ctx.loader.entries()].filter((entry: any) => entry.fiber?.state === 2);
    const mapped = mappedDirectories(this.ownerContext.get("pluginPackages")?.resolution);
    let comparison: { roots: string[]; stale: Set<string>; seen: Map<string, string | undefined> } | undefined;
    let comparedAt = 0;
    let pending: PendingModule[] = [];
    try {
      // 09/11/2026 P0: doc lai profile TU DIA (khong truyen initialProfile) de khong dung cache manifest.
      // 09/11/2026 (bug "cordis.yml thanh 1368 dong"): danh sach patch cua luot reconcile PHAI la dung
      // danh sach ma BOOT da dung. Ban cu chi lay `loadProfileDirectory(..., { userLayer: false })` =
      // cac LOP BUNDLE, tuc la bo mat lop home (`$DSH_HOME/cordis.patch.yml`) va MOI `--patch` overlay
      // (app.patch.yml cua `bh host`, parity.patch.yml …). Hau qua: moi row do overlay chen vao (id
      // `<ten>-ours`) khong co trong "danh sach moi" nen bi coi la row da bi go => bi GO moi lan boot;
      // go row = huy fiber => Loader tu bat `disabled` va GHI LAI CA CAY vao leaf cordis.yml
      // (`cordis-plugin-loader` lib:642 ⇒ `Include._writeFile`, app-boot part-00) => materialize 1368
      // dong, pha hop dong "leaf luon la []". `readProfilePatches` (khong truyen initialProfile) van doc
      // bundle TU DIA, dong thoi ghep DU lop: bundle · profile · home · overlay · telemetry.
      const patchesTuDia = readProfilePatches("dsh", profile) as any[];
      const patches = patchesTuDia.length > 0
        ? patchesTuDia
        : (loadProfileDirectory("dsh", (profile as any).dir, (profile as any).installAnchor, { userLayer: false }).layers.flatMap((lop: any) => lop.patches as any[]));
      comparedAt = this.files.now();
      comparison = await this.contained(
        "comparing loaded modules with disk",
        () => {
          const roots = profileRoots(profile.dir);
          return Promise.resolve({ roots, ...this.files.compare(this.profileModules(roots)) });
        },
        undefined,
      );
      pending = [...(comparison?.stale ?? [])].map((url) => ({ url, reason: "module-comparison" as const }));
      const compared = comparison;
      const unavailable = !this.hasEsmCache();
      if (!unavailable && compared !== undefined && pending.length > 0) {
        pending = await this.contained(
          "planning module replacement",
          async () => {
            const plan = await this.planReplacement(compared.stale, compared.roots);
            await this.stopPlanned(plan);
            return plan.pending;
          },
          pending,
        );
      }
      await this.contained(
        "expiring failed imports",
        () => {
          if (unavailable) return Promise.resolve();
          const roots = compared?.roots ?? [realpathSync(profile.dir) + sep];
          for (const root of roots) this.manifests.invalidate(join(root, "package.json"));
          this.evict(
            this.profileModules(roots).filter((url) => {
              const job = this.esmJob(url);
              return job !== undefined && namespaceOf(job) === undefined;
            }),
          );
          return Promise.resolve();
        },
        undefined,
      );
      // 09/11/2026 - ap dung thay doi NGAY nhu DSH: dung 3 buoc cuoi cua kernel recompose(), nhung lay
      // entry include TRUC TIEP tu loader (khong can WeakMap bootstrapIncludes). Than ham da tach sang
      // profile-apply.ts: (1) service.ts cham tran 1000 dong, (2) ly do cua tung dieu kien go row dai
      // va de doc hon o mot cho — xem chu thich o file do (bug cordis.yml thanh 1368 dong).
      let result: Awaited<ReturnType<typeof recomposeProfile>> | undefined = await applyProfilePatches({
        ctx,
        owner: this.ownerContext,
        patches,
      });
      if (result === undefined) {
        result = await recomposeProfile(this.ownerContext.root, patches, 'dsh', { requiredIds, running });
      }
      const restartReason = compared === undefined || unavailable ? "module-comparison" : result.restartReason;
      return {
        warnings: result.warnings,
        pending,
        ...(restartReason === undefined ? {} : { restartReason }),
      };
    } finally {
      const recorded = comparison;
      await this.contained(
        "evicting dropped packages",
        () => {
          const kept = mappedDirectories(this.ownerContext.get("pluginPackages")?.resolution);
          return this.evictDropped([...mapped].filter((dir) => !kept.has(dir)), kept);
        },
        undefined,
      );
      await this.contained(
        "recording loaded module files",
        () => {
          if (recorded === undefined) return Promise.resolve();
          const urls = this.profileModules(recorded.roots);
          this.files.observe(urls, {
            seen: recorded.seen,
            retained: new Set(pending.map(({ url }) => url)),
            at: comparedAt,
          });
          return Promise.resolve();
        },
        undefined,
      );
    }
  }
}

/** Trang thai module loi cua Node, dung trong test/chan doan. */
export const moduleErroredStatus = MODULE_ERRORED;

/**
 * Tien ich cho test: dem so entry Loader dang o trang thai ACTIVE.
 * @param ctx - context cua kernel (co `loader`).
 * @returns So entry co fiber `state === 2`.
 */
export function activeEntryCount(ctx: any): number {
  return [...ctx.loader.entries()].filter((entry: any) => entry.fiber?.state === 2).length;
}

/** Tien ich cho test: kiem mot duong dan co ton tai khong (khong dua vao import cua Node). */
export { existsSync };
