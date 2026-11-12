/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 vung registry cua bundle goc (dong 1290-1824): SlotRegistry (cordis Service) tren SlotCore
 *      + face host + truc INSTANCE cua store
 */
import type { RendererRuntime } from "./bindings.ts";
import { SlotAssemblyError } from "./errors.ts";
import { EFFECT, ROOT_INSTANCE_KEY, SERVICE_SLOTS } from "./ids.ts";
import { SLOTS_CHANGED_EVENT } from "./slots-api.ts";
import type {
  LocaleFace,
  SlotCoreLike,
  SlotRenderer,
  SlotRendererHost,
  SlotScopeAdapter,
  SlotSpec,
  StandardSourceBinding,
  StoreHandle,
  StoreInstanceLike,
  StoredEntry,
  StoredFactory,
} from "./slots-api.ts";

/** Context cordis tối thiểu mà registry dùng (khớp bề mặt thật của cordis 4). */
export interface CordisContextLike {
  /** Đăng ký hiệu ứng vòng đời, gắn với fiber của NGƯỜI GỌI. */
  effect(execute: () => void | (() => void | Iterable<() => void>), label?: string): () => void;
  /** Phát một sự kiện của ctx. */
  emit(event: string, ...args: unknown[]): void;
  /** Sợi plugin (dùng để lấy tên registrant). */
  fiber?: { readonly name?: string };
  /** Kênh cấp dịch vụ. */
  reflect: { provide(name: string, value: unknown): () => void };
}

/** Lớp `Service` của cordis (chỉ cần constructor + ctx). */
export type CordisServiceCtor = new (ctx: CordisContextLike, name: string) => { ctx: CordisContextLike };

/** Bản ghi trục store của một handle cấp gốc. */
interface StoreRecord {
  /** Phạm vi của handle. */
  readonly scope: string;
  /** Số người giữ. */
  refs: number;
  /** Instance theo khoá scope. */
  readonly instances: Map<string, StoreInstanceLike>;
}

/** Trục store RIÊNG của một Factory (handle mint theo occurrence). */
interface FactoryStoreAxis {
  /** Bản ghi theo occurrence (giữ sống bằng WeakMap). */
  readonly occurrences: WeakMap<object, FactoryStoreRecord>;
  /** Bản ghi đang được mount. */
  readonly mounted: Map<object, FactoryStoreRecord>;
}

/** Bản ghi store của một occurrence Factory. */
interface FactoryStoreRecord {
  /** Handle của occurrence. */
  readonly handle: StoreHandle;
  /** Instance theo khoá scope. */
  readonly instances: Map<string, StoreInstanceLike>;
  /** Số người giữ. */
  retainers: number;
}

/** Bề mặt công khai của SlotRegistry (đúng d.ts của bản gốc). */
export interface SlotRegistryLike {
  /** Đăng ký một mục vào slot. */
  register(options: Record<string, unknown>, component: unknown): () => void;
  /** Đăng ký một Factory. */
  registerFactory(options: Record<string, unknown>, component: unknown): () => void;
  /** Cài hiệu ứng cho mỗi đời sống khai báo của một slot. */
  inject(key: string, callback: () => void | Iterable<() => void>): () => void;
  /** Cài renderer (boot-once). */
  install(renderer: SlotRenderer): void;
  /** Cài face từ điển (boot-once). */
  installLocale(face: LocaleFace): void;
  /** Đóng góp dữ liệu gốc của một miền. */
  provideRoot(contribution: Record<string, unknown>): () => void;
  /** Cài adapter của một scope nghiêm ngặt. */
  installScope(scope: string, adapter: SlotScopeAdapter): void;
  /** Buộc instance store theo một thế hệ Context. */
  bindStoreScope(binding: Pick<StandardSourceBinding, "key" | "ctx">): void;
  /** Điểm render DUY NHẤT ở cấp ctx. */
  renderSlot(key: string, owner: Record<string, unknown>): unknown;
  /** Ảnh chụp sổ đăng ký của một khoá. */
  entries(key: string): readonly StoredEntry[];
  /** Người thắng theo từng ô. */
  entriesOfSlot(key: string): readonly StoredEntry[];
  /** Cây khai báo JSON-safe. */
  snapshot(root?: string): unknown[];
  /** Theo dõi lỗi mục/Factory. */
  onEntryError(fn: (key: string, registration: unknown, error: unknown, info: { abdicated: boolean }) => void): () => void;
  /** Spec của một khoá. */
  spec(key: string): SlotSpec | undefined;
  /** Theo dõi đăng ký của một khoá. */
  subscribe(key: string, fn: () => void): () => void;
  /** Số phiên bản đăng ký của một khoá. */
  getVersion(key: string): number;
  /** Face host (dùng cho test/đo). */
  hostFace(): SlotRendererHost;
}

/** Kết quả lắp ráp registry. */
export interface Registry {
  /** Lớp service (`new SlotRegistry(ctx)` đăng ký service `slots`). */
  SlotRegistry: new (ctx: CordisContextLike) => SlotRegistryLike;
}

/**
 * Dựng `SlotRegistry` — lớp cordis Service bọc SlotCore thuần (port 1:1 vùng `registry.js`).
 *
 * Nhận: `runtime` — nơi lấy `Service` của cordis + module ui-slots của trang.
 * Trả: `{ SlotRegistry }`.
 */
export function createRegistry(runtime: RendererRuntime & { cordis: { Service: CordisServiceCtor } }): Registry {
  const { Service } = runtime.cordis;
  const { SlotCore, StaleAuthorizationError } = runtime.slotsApi;

  /**
   * Service `slots`: toàn bộ ngữ nghĩa đăng ký nằm ở SlotCore; lớp này sở hữu thứ cần một ứng dụng
   * ĐANG SỐNG: cầu sự kiện `slots/changed`, register/inject qua `ctx.effect` của NGƯỜI GỌI (unload của
   * fiber thu hồi cả hai), hợp đồng cài renderer, và trục INSTANCE của store.
   */
  class SlotRegistry extends (Service as CordisServiceCtor) {
    /** Core thuần của sổ slot. */
    private readonly _core: SlotCoreLike = new SlotCore();
    /** Trục instance store: handle → scope đang mount · refcount · instance đã phân giải. */
    private readonly _stores = new Map<StoreHandle, StoreRecord>();
    /** Trục store riêng của Factory. */
    private readonly _factoryStores = new Map<StoredFactory, FactoryStoreAxis>();
    /** Thế hệ Context sống gần nhất cho mỗi khoá store theo scope. */
    private readonly _storeScopeOwners = new Map<string, unknown>();
    /** Renderer đã cài (boot-once). */
    private _renderer: SlotRenderer | undefined;
    /** Face từ điển đã cài (boot-once). */
    private _locale: LocaleFace | undefined;
    /** Face host dựng một lần. */
    private _host: SlotRendererHost | undefined;
    /** Roster đóng góp dữ liệu gốc. */
    private readonly _rootContributions: Record<string, unknown>[] = [];
    /** Người nghe roster gốc. */
    private readonly _rootListeners = new Set<() => void>();
    /** Binding gốc hiện tại. */
    private _rootBinding: StandardSourceBinding = { key: undefined, hooks: {}, keyedHooks: {}, props: {} };
    /** Nguồn observable của binding gốc. */
    private readonly _rootSource: { getSnapshot: () => StandardSourceBinding; subscribe: (listener: () => void) => () => void };
    /** Adapter theo scope đã cài. */
    private readonly _scopes = new Map<string, SlotScopeAdapter>();
    /** Số phiên bản roster scope. */
    private _scopeRevision = 0;
    /** Người nghe roster scope. */
    private readonly _scopeListeners = new Set<() => void>();
    /** Nguồn observable của số phiên bản roster scope. */
    private readonly _scopeRevisionSource: { getSnapshot: () => number; subscribe: (listener: () => void) => () => void };

    /**
     * Cài service `slots` vào ctx đang dựng và nối cầu sự kiện `slots/changed`.
     * Nhận: `ctx` — context sở hữu.
     * Trả: không.
     */
    constructor(ctx: CordisContextLike) {
      super(ctx, SERVICE_SLOTS);
      /** Nguồn của binding gốc. */
      this._rootSource = {
        getSnapshot: () => this._rootBinding,
        subscribe: (listener) => {
          this._rootListeners.add(listener);
          return () => {
            this._rootListeners.delete(listener);
          };
        },
      };
      /** Nguồn của số phiên bản roster scope. */
      this._scopeRevisionSource = {
        getSnapshot: () => this._scopeRevision,
        subscribe: (listener) => {
          this._scopeListeners.add(listener);
          return () => {
            this._scopeListeners.delete(listener);
          };
        },
      };
      this._core.onMutate((key) => {
        ctx.emit(SLOTS_CHANGED_EVENT, key);
      });
    }

    /**
     * API đăng ký slot thường — cổng DUY NHẤT, chạy trong `ctx.effect` của NGƯỜI GỌI.
     * Nhận: `rawOptions` — tuỳ chọn đăng ký, `component` — component.
     * Trả: hàm gỡ idempotent.
     */
    register(rawOptions: Record<string, unknown>, component: unknown): () => void {
      return this.ctx.effect(() => this._register(rawOptions, component), EFFECT.register);
    }

    /**
     * Đăng ký một Factory dùng lại được, chạy trong `ctx.effect` của NGƯỜI GỌI.
     * Nhận: `rawOptions` — tuỳ chọn Factory, `component` — component Factory.
     * Trả: hàm gỡ idempotent.
     */
    registerFactory(rawOptions: Record<string, unknown>, component: unknown): () => void {
      return this.ctx.effect(() => this._registerFactory(rawOptions, component), EFFECT.registerFactory);
    }

    /**
     * Cài hiệu ứng cho MỖI đời sống khai báo của một slot (port nguyên văn vòng reconcile).
     * Nhận: `key` — khoá slot; `callback` — tạo một disposer hoặc iterable disposer.
     * Trả: disposer idempotent cho cả việc chờ và hiệu ứng đang sống.
     */
    inject(key: string, callback: () => void | Iterable<() => void>): () => void {
      const ctx = this.ctx;
      const label = EFFECT.injectPrefix + JSON.stringify(key) + ")";
      const disposeController = ctx.effect(() => {
        let active: (() => void) | undefined;
        let activeEpoch: number | undefined;
        let stopped = false;
        let unsubscribe = (): void => undefined;
        /** Huỷ hiệu ứng đang sống và dừng nhận thay đổi. */
        const stop = (): void => {
          if (stopped) return;
          stopped = true;
          unsubscribe();
          const dispose = active;
          active = undefined;
          activeEpoch = undefined;
          dispose?.();
        };
        /** Đối chiếu khai báo hiện tại với hiệu ứng đang sống. */
        const reconcile = (): void => {
          if (stopped) return;
          const spec = this._core.specDynamic(key);
          const epoch = this._core.declarationEpoch(key);
          if (active !== undefined && activeEpoch === epoch) return;
          const dispose = active;
          active = undefined;
          activeEpoch = undefined;
          dispose?.();
          if (spec === undefined) return;
          const disposeEffect = ctx.effect(callback as () => void, EFFECT.injectPrefix + JSON.stringify(key) + EFFECT.injectDeclarationSuffix);
          active = () => {
            disposeEffect();
          };
          activeEpoch = epoch;
        };
        /** Nhận thay đổi khai báo; lỗi INACTIVE_EFFECT thì dừng im lặng, lỗi khác ném ở microtask. */
        const changed = (): void => {
          try {
            reconcile();
          } catch (error) {
            const code = (error as { code?: string } | null)?.code;
            if (code === "INACTIVE_EFFECT") {
              stop();
              return;
            }
            stop();
            const failure = error instanceof Error ? error : new Error(String(error));
            queueMicrotask(() => {
              throw failure;
            });
          }
        };
        unsubscribe = this._core.subscribeDeclaration(key, changed);
        try {
          reconcile();
        } catch (error) {
          stop();
          throw error;
        }
        return stop;
      }, label);
      return () => {
        disposeController();
      };
    }

    /**
     * Cài renderer của vỏ (sản phẩm `createSlotRenderer`). Boot-once: lần hai ném.
     * Nhận: `renderer` — máy móc outlet.
     * Trả: không.
     */
    install(renderer: SlotRenderer): void {
      if (this._renderer !== undefined) throw new Error("slot renderer already installed (install() is boot-once)");
      this.ctx.effect(() => {
        this._renderer = renderer;
        return () => {
          if (this._renderer === renderer) this._renderer = undefined;
        };
      }, EFFECT.applyInstall);
    }

    /**
     * Cài face từ điển cho ghế `t` (boot-once, cùng luật với renderer).
     * Nhận: `face` — bộ bind namespace + revision observable.
     * Trả: không.
     */
    installLocale(face: LocaleFace): void {
      if (this._locale !== undefined) throw new Error("locale face already installed (installLocale() is boot-once)");
      this.ctx.effect(() => {
        this._locale = face;
        return () => {
          if (this._locale === face) this._locale = undefined;
        };
      }, EFFECT.installLocale);
    }

    /**
     * Đóng góp dữ liệu gốc của một miền; tên hook phải DUY NHẤT toàn cục.
     * Nhận: `contribution` — nguồn trần + prop tĩnh.
     * Trả: disposer thuộc fiber của người gọi.
     */
    provideRoot(contribution: Record<string, unknown>): () => void {
      const dispose = this.ctx.effect(() => {
        this._rootContributions.push(contribution);
        try {
          this.rebuildRootBinding();
        } catch (error) {
          this._rootContributions.pop();
          throw error;
        }
        return () => {
          const index = this._rootContributions.indexOf(contribution);
          if (index === -1) return;
          this._rootContributions.splice(index, 1);
          this.rebuildRootBinding();
        };
      }, EFFECT.provideRoot);
      return () => {
        dispose();
      };
    }

    /**
     * Cài adapter của MỘT scope nghiêm ngặt.
     * Nhận: `scope` — tên scope, `adapter` — nguồn binding + thông báo giải phóng.
     * Trả: không.
     */
    installScope(scope: string, adapter: SlotScopeAdapter): void {
      if (this._scopes.has(scope)) throw new Error("slot scope '" + scope + "' already has an adapter");
      this.ctx.effect(() => {
        this._scopes.set(scope, adapter);
        this.publishScopeRevision();
        return () => {
          if (this._scopes.get(scope) === adapter) {
            this._scopes.delete(scope);
            this.publishScopeRevision();
          }
        };
      }, EFFECT.installScopePrefix + JSON.stringify(scope) + ")");
    }

    /**
     * Buộc instance store theo MỘT thế hệ Context; buộc lại cùng khoá thì bỏ instance của thế hệ cũ.
     * Nhận: `binding` — khoá scope + ctx sở hữu.
     * Trả: không.
     */
    bindStoreScope(binding: Pick<StandardSourceBinding, "key" | "ctx">): void {
      const current = this._storeScopeOwners.get(binding.key as string);
      if (current === binding.ctx) return;
      if (current !== undefined) this.releaseStoreScope(binding.key as string);
      this._storeScopeOwners.set(binding.key as string, binding.ctx);
      (binding.ctx as CordisContextLike).effect(() => () => {
        if (this._storeScopeOwners.get(binding.key as string) !== binding.ctx) return;
        this._storeScopeOwners.delete(binding.key as string);
        this.releaseStoreScope(binding.key as string);
      }, EFFECT.storeScopePrefix + String(binding.key));
    }

    /**
     * Điểm render DUY NHẤT ở cấp ctx: vỏ render 'root'; mọi khoá khác render trong component qua
     * `renderSlot` của kit. Cả ba cổng đều là kiểm thứ tự boot "hỏng to", KHÔNG fallback.
     * Nhận: `key` — phải là 'root', `owner` — phần của chủ sở hữu (vỏ cấp {}).
     * Trả: cây gốc đã render.
     */
    renderSlot(key: string, owner: Record<string, unknown>): unknown {
      if (key !== "root") {
        throw new Error('ctx-level renderSlot only renders \'root\' (got "' + key + '"); child slots render through the component props face');
      }
      if (this._renderer === undefined) {
        throw new Error("slot renderer not installed — boot must call ctx.slots.install(createSlotRenderer()) before rendering 'root'");
      }
      if (this._core.entries("root").length === 0) {
        throw new Error("'root' has no registration — a layout entry must register into 'root' before the shell renders it");
      }
      return this._renderer.renderRoot(this.hostFace(), owner);
    }

    /** Ảnh chụp mục đăng ký của một khoá (bề mặt thanh tra, tham chiếu ổn định giữa các lần biến đổi). */
    entries(key: string): readonly StoredEntry[] {
      return this._core.entries(key);
    }

    /** Người thắng (che khuất) theo từng ô của một khoá — thứ outlet vẽ. */
    entriesOfSlot(key: string): readonly StoredEntry[] {
      return this._core.entriesOfSlot(key);
    }

    /** Xuất cây khai báo JSON-safe để thanh tra chỉ-đọc. */
    snapshot(root?: string): unknown[] {
      return this._core.snapshot(root);
    }

    /** Theo dõi lỗi mục/Factory qua MỘT kênh giám sát. */
    onEntryError(fn: (key: string, registration: unknown, error: unknown, info: { abdicated: boolean }) => void): () => void {
      return this._core.onEntryError(fn);
    }

    /** Tra spec đã khai (kể cả 'root' dựng sẵn). */
    spec(key: string): SlotSpec | undefined {
      return this._core.spec(key);
    }

    /** Theo dõi thay đổi đăng ký của một khoá (gộp theo microtask). */
    subscribe(key: string, fn: () => void): () => void {
      return this._core.subscribe(key, fn);
    }

    /** Số phiên bản đăng ký — cặp với subscribe cho uSES. */
    getVersion(key: string): number {
      return this._core.getVersion(key);
    }

    /**
     * Đường đăng ký uỷ nhiệm: mint Factory + đóng dấu registrant + ghi core + sổ trục instance.
     * Nhận: `options`, `component`. Trả: hàm gỡ idempotent.
     */
    private _register(options: Record<string, unknown>, component: unknown): () => void {
      const declaredStore = options["store"];
      const store = typeof declaredStore === "function" ? (declaredStore as () => StoreHandle)() : (declaredStore as StoreHandle | undefined);
      const registrant = (options["registrant"] as string | undefined) ?? this.ctx.fiber?.name;
      const erased: Record<string, unknown> = {
        ...options,
        ...(store !== undefined ? { store } : {}),
        ...(registrant !== undefined ? { registrant } : {}),
      };
      const dispose = this._core.register(erased, component);
      if (store !== undefined) {
        const spec = this._core.specDynamic(options["name"] as string) as SlotSpec;
        this.acquire(store, spec.scope);
      }
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        dispose();
        if (store !== undefined) this.release(store);
      };
    }

    /**
     * Đường đăng ký Factory: mint registrant, giữ trục store theo occurrence.
     * Nhận: `options`, `component`. Trả: hàm gỡ idempotent.
     */
    private _registerFactory(options: Record<string, unknown>, component: unknown): () => void {
      const registrant = this.ctx.fiber?.name;
      const erased: Record<string, unknown> = { ...options, ...(registrant === undefined ? {} : { registrant }) };
      const dispose = this._core.registerFactory(erased, component);
      const definition = this._core.factory(options["name"] as string);
      if (definition === undefined) throw new Error('slot factory "' + String(options["name"]) + '" disappeared during registration');
      if (definition.store !== undefined && typeof definition.store !== "function") this.acquire(definition.store, definition.scope);
      else if (typeof definition.store === "function") {
        this._factoryStores.set(definition, { occurrences: new WeakMap(), mounted: new Map() });
      }
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        dispose();
        this._factoryStores.delete(definition);
        if (definition.store !== undefined && typeof definition.store !== "function") this.release(definition.store);
      };
    }

    /**
     * Dựng face host TRUNG LẬP MIỀN một lần; adapter đã cài sống qua getter.
     * Nhận: không.
     * Trả: face host.
     */
    hostFace(): SlotRendererHost {
      if (this._host !== undefined) return this._host;
      const service = this;
      this._host = {
        subscribe: (key, fn) => this._core.subscribe(key, fn),
        getVersion: (key) => this._core.getVersion(key),
        entriesOf: (key) => this._core.entries(key),
        entriesOfSlot: (key) => this._core.entriesOfSlot(key),
        reportEntryError: (key, entry, error, info) => {
          this._core.reportEntryError(key, entry, error, info);
        },
        reportFactoryError: (name, registration, error) => {
          this._core.reportFactoryError(name, registration, error);
        },
        specOf: (key) => this._core.specDynamic(key),
        isLive: (entry) => this._core.isLive(entry),
        storeOf: (entry, scopeBinding) => (entry.store === undefined ? undefined : this.resolveStore(entry.store, scopeBinding)),
        factoryStoreOf: (definition, scopeBinding, occurrence) => this.resolveFactoryStore(definition, scopeBinding, occurrence),
        retainFactoryOccurrence: (definition, occurrence) => this.retainFactoryOccurrence(definition, occurrence),
        subscribeFactory: (name, fn) => this._core.subscribeFactory(name, fn),
        getFactoryVersion: (name) => this._core.factoryVersion(name),
        factoryOf: (name) => this._core.factory(name),
        isFactoryLive: (definition) => this._core.isFactoryLive(definition),
        root: this._rootSource,
        scopeRevision: this._scopeRevisionSource,
        scope: (scope) => service._scopes.get(scope === "session-maybe" ? "session" : scope),
        get locale() {
          return service._locale;
        },
      };
      return this._host;
    }

    /** Kiểm và công bố NGUYÊN TỬ roster đóng góp gốc hiện tại. */
    private rebuildRootBinding(): void {
      const hooks: Record<string, unknown> = {};
      const keyedHooks: Record<string, unknown> = {};
      const props: Record<string, unknown> = {};
      const finalProps = new Set<string>();
      for (const contribution of this._rootContributions) {
        copyUnique("hook", hooks, contribution["hooks"], finalProps, runtime.slotsApi.standardHookPropName);
        copyUnique("keyed hook", keyedHooks, contribution["keyedHooks"], finalProps, runtime.slotsApi.standardHookPropName);
        copyUnique("prop", props, contribution["props"], finalProps, (name) => name);
      }
      this._rootBinding = { key: undefined, hooks, keyedHooks, props } as unknown as StandardSourceBinding;
      for (const listener of [...this._rootListeners]) {
        try {
          listener();
        } catch (error) {
          console.error("root standard-source subscriber failed:", error);
        }
      }
    }

    /** Công bố một chuyển tiếp roster scope SAU khi map đã là sự thật. */
    private publishScopeRevision(): void {
      this._scopeRevision += 1;
      for (const listener of [...this._scopeListeners]) {
        try {
          listener();
        } catch (error) {
          console.error("scope-adapter subscriber failed:", error);
        }
      }
    }

    /**
     * Phân giải (tạo hoặc dùng lại) instance store cho một handle dưới một khoá scope.
     * Nhận: `handle`, `scopeBinding`. Trả: instance.
     * @throws {Error} khi handle chưa đăng ký, hoặc thiếu khoá phiên.
     */
    private resolveStore(handle: StoreHandle, scopeBinding: StandardSourceBinding | undefined): StoreInstanceLike {
      const record = this._stores.get(handle);
      if (record === undefined) throw new Error("store handle is not registered (entry unloaded, or the handle never went through register)");
      let key: string;
      if (record.scope === "root") key = ROOT_INSTANCE_KEY;
      else {
        if (scopeBinding === undefined) throw new Error(record.scope + " store resolution requires a session id");
        key = scopeBinding.key as string;
        this.bindStoreScope(scopeBinding);
      }
      let instance = record.instances.get(key);
      if (instance === undefined) {
        instance = record.scope === "root" ? handle.create() : handle.create(key);
        record.instances.set(key, instance);
      }
      return instance;
    }

    /**
     * Phân giải store của một occurrence Factory (handle mint theo occurrence).
     * Nhận: `definition`, `scopeBinding`, `occurrence`. Trả: instance, hoặc undefined.
     */
    private resolveFactoryStore(
      definition: StoredFactory,
      scopeBinding: StandardSourceBinding | undefined,
      occurrence: Record<string, unknown>,
    ): StoreInstanceLike | undefined {
      if (!this._core.isFactoryLive(definition)) {
        throw new StaleAuthorizationError('slot factory "' + definition.name + '" is not registered');
      }
      const declaration = definition.store;
      if (declaration === undefined) return undefined;
      if (typeof declaration !== "function") return this.resolveStore(declaration, scopeBinding);
      const axis = this._factoryStores.get(definition);
      if (axis === undefined) throw new Error('store axis for factory "' + definition.name + '" is not registered');
      const scopeKey = definition.scope === "root" ? ROOT_INSTANCE_KEY : requireScopeKey(definition.scope, scopeBinding);
      if (scopeBinding !== undefined && definition.scope !== "root") this.bindStoreScope(scopeBinding);
      let record = axis.occurrences.get(occurrence as object);
      if (record === undefined) {
        const handle = (declaration as () => StoreHandle)();
        if (handle.spec.persist !== undefined) {
          throw new SlotAssemblyError('exclusive store for factory "' + definition.name + '" cannot declare persistence');
        }
        record = { handle, instances: new Map(), retainers: 0 };
        axis.occurrences.set(occurrence as object, record);
      }
      const existing = record.instances.get(scopeKey);
      if (existing !== undefined) return existing;
      const instance = definition.scope === "root" || scopeBinding === undefined ? record.handle.create() : record.handle.create(scopeBinding.key as string);
      record.instances.set(scopeKey, instance);
      return instance;
    }

    /**
     * Giữ một occurrence Factory sống tới khi hàm gỡ chạy (bộ đếm người giữ).
     * Nhận: `definition`, `occurrence`. Trả: hàm gỡ.
     */
    private retainFactoryOccurrence(definition: StoredFactory, occurrence: Record<string, unknown>): () => void {
      if (!this._core.isFactoryLive(definition)) return () => undefined;
      if (typeof definition.store !== "function") return () => undefined;
      const axis = this._factoryStores.get(definition);
      if (axis === undefined) return () => undefined;
      const record = axis.occurrences.get(occurrence as object);
      if (record === undefined) return () => undefined;
      record.retainers += 1;
      axis.mounted.set(occurrence as object, record);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        record.retainers -= 1;
        if (record.retainers !== 0) return;
        axis.mounted.delete(occurrence as object);
      };
    }

    /** Bỏ mọi instance store KHÔNG phải gốc của một thế hệ Context đã kết thúc. */
    private releaseStoreScope(key: string): void {
      for (const record of this._stores.values()) {
        if (record.scope === "root") continue;
        record.instances.delete(key);
      }
      for (const axis of this._factoryStores.values()) {
        for (const record of axis.mounted.values()) record.instances.delete(key);
      }
    }

    /**
     * Buộc (hoặc tham chiếu thêm) một handle trên trục; xung đột chéo scope đã ném ở core.
     * Nhận: `handle`, `scope`. Trả: không.
     */
    private acquire(handle: StoreHandle, scope: string): void {
      const record = this._stores.get(handle);
      if (record === undefined) {
        this._stores.set(handle, { scope, refs: 1, instances: new Map() });
        return;
      }
      record.refs += 1;
    }

    /**
     * Bỏ MỘT tham chiếu; người giữ cuối cùng unload thì bản ghi biến mất (instance đi theo — store của
     * engine không cần dispose tường minh).
     * Nhận: `handle`. Trả: không.
     */
    private release(handle: StoreHandle): void {
      const record = this._stores.get(handle);
      if (record === undefined) return;
      record.refs -= 1;
      if (record.refs !== 0) return;
      this._stores.delete(handle);
    }
  }

  return { SlotRegistry: SlotRegistry as unknown as new (ctx: CordisContextLike) => SlotRegistryLike };
}

/**
 * Chép một roster đóng góp vào đích, chặn trùng tên prop.
 * Nhận: `kind` — nhãn chẩn đoán, `target` — đích, `values` — nguồn, `finalProps` — tập tên đã dùng,
 * `propNameOf` — hàm đổi tên (mặc định: tên prop chuẩn của hook — do người gọi truyền).
 * Trả: không.
 * @throws {Error} khi trùng tên prop cuối.
 */
function copyUnique(
  kind: string,
  target: Record<string, unknown>,
  values: unknown,
  finalProps: Set<string>,
  propNameOf: (name: string) => string,
): void {
  if (values === undefined) return;
  for (const [name, value] of Object.entries(values as Record<string, unknown>)) {
    const propName = propNameOf(name);
    if (finalProps.has(propName)) throw new Error("duplicate root standard " + kind + " '" + name + "' at prop '" + propName + "'");
    finalProps.add(propName);
    target[name] = value;
  }
}

/**
 * Khoá scope bắt buộc của store Factory theo phiên.
 * Nhận: `scope`, `binding`. Trả: khoá.
 * @throws {Error} khi thiếu binding.
 */
function requireScopeKey(scope: string, binding: StandardSourceBinding | undefined): string {
  if (binding === undefined) throw new Error(scope + " factory store resolution requires a session id");
  return binding.key as string;
}