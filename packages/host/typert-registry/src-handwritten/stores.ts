/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Các SỔ con của sổ đăng ký Typert — bản viết lại 1:1 `ChangeSource`/`DescriptorStore`/
 *      `RemoteStore`/`LookupStore`/`ContextStore`/`ResourceStore` của
 *      `@deepseek-ai/dsh-typert-registry`, cùng các hàm kiểm tên/đoạn dây.
 */

import type {
  InvocationDescriptor,
  TypertContextRegistry,
  TypertDisposer,
  TypertLocalRegistry,
  TypertLookupRegistry,
  TypertRemoteRegistry,
  TypertResourceRegistry,
} from "@deepseek-ai/dsh-typert-protocol";

import type { TypertFace } from "./types.ts";

/** Lý do MỘT thay đổi được phát ra sổ con. */
export interface TypertChange {
  /** Loại sổ đã đổi (ĐÚNG tập giá trị của hợp đồng kernel). */
  readonly kind: "local" | "remote" | "lookup" | "host-context" | "client-context" | "resource";
  /** Khoá đã đổi. */
  readonly key: string;
}

/** Context mà các sổ con cần: đăng ký hiệu ứng và log cảnh báo. */
export interface StoreContext {
  /**
   * Đăng ký MỘT hiệu ứng (dạng GENERATOR: thân chạy ngay, phần `yield` là hàm dọn).
   * Nhận: hàm dựng generator, và nhãn.
   * Trả: hàm dọn của đăng ký.
   */
  effect(factory: () => Generator<() => void, void, void>, label: string): TypertDisposer;
  /** Log của kernel. */
  readonly logger: {
    /**
     * Ghi MỘT cảnh báo.
     * Nhận: thông điệp.
     * Trả: không.
     */
    warn(message: unknown): void;
  };
}

/** Hàm báo lỗi khi MỘT listener của sổ con ném. */
export type ChangeReporter = (change: TypertChange, error: unknown) => void;

/** Nguồn thay đổi dùng chung: listener theo fiber, phát an toàn. */
export class ChangeSource {
  /** Hàm báo lỗi listener. */
  private readonly report: ChangeReporter;

  /** Các listener đang đăng ký. */
  private readonly listeners = new Set<(change: TypertChange) => void>();

  /**
   * @param report - hàm báo lỗi listener.
   */
  constructor(report: ChangeReporter) {
    this.report = report;
  }

  /**
   * Đăng ký MỘT listener trong fiber của context.
   * Nhận: context và listener.
   * Trả: hàm dọn của đăng ký.
   */
  subscribe(ctx: StoreContext, listener: (change: TypertChange) => void): TypertDisposer {
    const { listeners } = this;
    return ctx.effect(function* () {
      listeners.add(listener);
      yield () => {
        listeners.delete(listener);
      };
    }, "typert registry subscription");
  }

  /**
   * Phát MỘT thay đổi cho mọi listener; listener ném lỗi thì báo, không làm hỏng người khác.
   * Nhận: thay đổi.
   * Trả: không.
   */
  emit(change: TypertChange): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(change);
      } catch (error) {
        this.report(change, error);
      }
    }
  }
}

/** MỘT mục của sổ định nghĩa lời gọi: định nghĩa + chủ sở hữu. */
interface DescriptorEntry {
  /** Định nghĩa lời gọi. */
  readonly descriptor: InvocationDescriptor;
  /** Chủ sở hữu (đối tượng danh tính của hiệu ứng). */
  readonly owner: object;
}

/** Sổ định nghĩa lời gọi theo khoá `<namespace>/<method>` và theo id. */
export class DescriptorStore {
  /** Loại sổ (`local` hoặc `remote`), dùng trong thông điệp lỗi. */
  private readonly kind: "local" | "remote";

  /** Mục theo khoá điểm cuối. */
  private readonly entries = new Map<string, DescriptorEntry>();

  /** Mục theo id lời gọi. */
  private readonly ids = new Map<string, DescriptorEntry>();

  /** Mọi khoá điểm cuối đã từng thấy. */
  private readonly history = new Set<string>();

  /** Nguồn thay đổi. */
  readonly changes: ChangeSource;

  /**
   * @param kind - loại sổ (`local`/`remote`).
   * @param report - hàm báo lỗi listener.
   */
  constructor(kind: "local" | "remote", report: ChangeReporter) {
    this.kind = kind;
    this.changes = new ChangeSource(report);
  }

  /**
   * Kiểm MỘT lô định nghĩa TRƯỚC khi ghi: trùng điểm cuối hoặc trùng id trong lô/cũ ⇒ từ chối CẢ LÔ.
   * Nhận: các định nghĩa.
   * Trả: không; ném lỗi khi trùng hoặc định nghĩa không hợp lệ.
   */
  validate(descriptors: readonly InvocationDescriptor[]): void {
    const endpoints = new Set<string>();
    const ids = new Set<string>();
    for (const descriptor of descriptors) {
      validateInvocation(descriptor);
      const endpoint = typertEndpoint(descriptor);
      if (endpoints.has(endpoint) || this.entries.has(endpoint)) {
        throw new Error("typert: " + this.kind + ' endpoint "' + endpoint + '" is already registered');
      }
      if (ids.has(descriptor.id) || this.ids.has(descriptor.id)) {
        throw new Error("typert: " + this.kind + ' invocation id "' + descriptor.id + '" is already registered');
      }
      endpoints.add(endpoint);
      ids.add(descriptor.id);
    }
  }

  /**
   * Ghi MỘT lô định nghĩa cho MỘT chủ sở hữu rồi phát thay đổi.
   * Nhận: chủ sở hữu và các định nghĩa.
   * Trả: không.
   */
  commit(owner: object, descriptors: readonly InvocationDescriptor[]): void {
    for (const descriptor of descriptors) {
      const entry: DescriptorEntry = { descriptor, owner };
      const endpoint = typertEndpoint(descriptor);
      this.entries.set(endpoint, entry);
      this.ids.set(descriptor.id, entry);
      this.history.add(endpoint);
    }
    for (const descriptor of descriptors) {
      this.changes.emit({ kind: this.kind, key: typertEndpoint(descriptor) });
    }
  }

  /**
   * Thu hồi MỘT lô định nghĩa của ĐÚNG chủ sở hữu rồi phát thay đổi cho phần đã gỡ.
   * Nhận: chủ sở hữu và các định nghĩa.
   * Trả: không.
   */
  withdraw(owner: object, descriptors: readonly InvocationDescriptor[]): void {
    const removed: string[] = [];
    for (const descriptor of descriptors) {
      const endpoint = typertEndpoint(descriptor);
      const entry = this.entries.get(endpoint);
      if (entry?.owner !== owner) continue;
      this.entries.delete(endpoint);
      if (this.ids.get(descriptor.id) === entry) this.ids.delete(descriptor.id);
      removed.push(endpoint);
    }
    for (const endpoint of removed) this.changes.emit({ kind: this.kind, key: endpoint });
  }

  /**
   * Lấy định nghĩa theo khoá điểm cuối.
   * Nhận: khoá điểm cuối.
   * Trả: định nghĩa, hoặc `undefined`.
   */
  get(endpoint: string): InvocationDescriptor | undefined {
    return this.entries.get(endpoint)?.descriptor;
  }

  /**
   * Khoá điểm cuối này đã từng được đăng ký chưa.
   * Nhận: khoá điểm cuối.
   * Trả: true khi đã từng.
   */
  hasSeen(endpoint: string): boolean {
    return this.history.has(endpoint);
  }

  /**
   * Liệt kê định nghĩa đang sống theo thứ tự đăng ký.
   * Nhận: không.
   * Trả: các định nghĩa.
   */
  list(): InvocationDescriptor[] {
    return [...this.entries.values()].map((entry) => entry.descriptor);
  }

  /**
   * Đăng ký MỘT listener thay đổi trong fiber của context.
   * Nhận: context và listener.
   * Trả: hàm dọn.
   */
  subscribe(ctx: StoreContext, listener: (change: TypertChange) => void): TypertDisposer {
    return this.changes.subscribe(ctx, listener);
  }
}

/** Khoá điểm cuối `<namespace>/<method>` của MỘT định nghĩa lời gọi. */
export function typertEndpoint(descriptor: Pick<InvocationDescriptor, "namespace" | "method">): string {
  return descriptor.namespace + "/" + descriptor.method;
}

/** Khoá toàn cục `<package>#<name>` của MỘT schema đã sinh. */
export function typertKey(packageName: string, name: string): string {
  return packageName + "#" + name;
}

/** Danh tính `<package>#<face>` của MỘT mô hình package. */
export function typertPackageKey(packageName: string, face: TypertFace): string {
  return packageName + "#" + face;
}

/** Sổ định nghĩa Remote mà BÊN TIÊU THỤ chọn (theo gói), mỗi gói MỘT chủ sở hữu. */
export class RemoteStore {
  /** Sổ định nghĩa dùng chung. */
  private readonly descriptors: DescriptorStore;

  /** Chủ sở hữu theo tên gói. */
  private readonly packages = new Map<string, object>();

  /**
   * @param descriptors - sổ định nghĩa dùng chung.
   */
  constructor(descriptors: DescriptorStore) {
    this.descriptors = descriptors;
  }

  /**
   * Khung nhìn của sổ cho MỘT fiber.
   * Nhận: context của fiber.
   * Trả: sổ Remote theo hợp đồng của kernel.
   */
  view(ctx: StoreContext): TypertRemoteRegistry {
    return {
      register: (contribution: { readonly package: string; readonly descriptors: readonly InvocationDescriptor[] }) =>
        this.register(ctx, contribution),
      get: (endpoint: string) => this.descriptors.get(endpoint),
      list: () => this.descriptors.list(),
      subscribe: (listener: (change: TypertChange) => void) => this.descriptors.subscribe(ctx, listener),
} as unknown as TypertRemoteRegistry;
  }

  /**
   * Đăng ký MỘT đóng góp Remote cho MỘT gói trong fiber hiện tại.
   * Nhận: context, và đóng góp (tên gói + định nghĩa).
   * Trả: hàm dọn của hiệu ứng.
   */
  register(
    ctx: StoreContext,
    contribution: { readonly package: string; readonly descriptors: readonly InvocationDescriptor[] },
  ): TypertDisposer {
    validateSegment("Remote package name", contribution.package);
    if (this.packages.has(contribution.package)) {
      throw new Error('typert: Remote package "' + contribution.package + '" is already registered');
    }
    this.descriptors.validate(contribution.descriptors);
    const owner = {};
    const { packages, descriptors } = this;
    return ctx.effect(function* () {
      packages.set(contribution.package, owner);
      descriptors.commit(owner, contribution.descriptors);
      yield () => {
        if (packages.get(contribution.package) === owner) packages.delete(contribution.package);
        descriptors.withdraw(owner, contribution.descriptors);
      };
    }, "typert.remotes.register(" + JSON.stringify(contribution.package) + ")");
  }
}

/** Nhà cung cấp tra cứu của MỘT khoá (trường dây mà nó chiếm). */
export interface LookupProviderLike {
  /** Tên tham số nguồn. */
  readonly parameter: string;
  /** Trường dây. */
  readonly wire: string;
  /** Loại tài nguyên (nếu có). */
  readonly resource?: string;
  /** Ký hiệu kiểu Host. */
  readonly hostTypeSymbol: string;
  /** Ký hiệu kiểu dây. */
  readonly wireTypeSymbol: string;
  /**
   * Giải id trên dây.
   * Nhận: id.
   * Trả: giá trị đã giải.
   */
  resolve(id: never): Promise<any>;
}

/** Định nghĩa dây của MỘT khoá tra cứu (bất biến trong suốt vòng đời sổ). */
interface LookupDefinition {
  /** Khoá tra cứu. */
  readonly key: string;
  /** Tên tham số nguồn. */
  readonly parameter: string;
  /** Trường dây. */
  readonly wire: string;
  /** Ký hiệu kiểu Host. */
  readonly hostTypeSymbol: string;
  /** Ký hiệu kiểu dây. */
  readonly wireTypeSymbol: string;
}

/** Mục tra cứu: nhà cung cấp + chủ sở hữu. */
interface LookupEntry {
  /** Nhà cung cấp. */
  readonly provider: LookupProviderLike;
  /** Chủ sở hữu. */
  readonly owner: object;
}

/** Sổ nhà cung cấp tra cứu Host (đảo phụ thuộc cho tham số `lookup`). */
export class LookupStore {
  /** Nhà cung cấp theo khoá. */
  private readonly providers = new Map<string, LookupEntry>();

  /** Bộ giải theo khoá (do bên tiêu thụ cấu hình). */
  private readonly resolvers = new Map<string, { provider: { resolve(id: never): Promise<unknown> }; owner: object }>();

  /** Định nghĩa dây theo khoá. */
  private readonly definitions = new Map<string, LookupDefinition>();

  /** Nguồn thay đổi. */
  private readonly changes: ChangeSource;

  /**
   * @param report - hàm báo lỗi listener.
   */
  constructor(report: ChangeReporter) {
    this.changes = new ChangeSource(report);
  }

  /**
   * Khung nhìn của sổ cho MỘT fiber.
   * Nhận: context của fiber.
   * Trả: sổ tra cứu theo hợp đồng của kernel.
   */
  view(ctx: StoreContext): TypertLookupRegistry {
    return {
      register: (key: string, provider: LookupProviderLike) => this.register(ctx, key, provider),
      configure: (key: string, resolver: (id: never) => Promise<any>) => this.configure(ctx, key, resolver),
      get: (key: string) => this.get(key),
      definitions: () => [...this.definitions.values()],
      keys: () => [...this.providers.keys()],
      subscribe: (listener: (change: TypertChange) => void) => this.changes.subscribe(ctx, listener),
} as unknown as TypertLookupRegistry;
  }

  /**
   * Lấy nhà cung cấp hiệu lực của MỘT khoá (đã ghép bộ giải nếu có).
   * Nhận: khoá tra cứu.
   * Trả: nhà cung cấp hiệu lực, hoặc `undefined`.
   */
  get(key: string): LookupProviderLike | undefined {
    const provider = this.providers.get(key)?.provider;
    if (provider === undefined) return undefined;
    const resolver = this.resolvers.get(key)?.provider;
    if (resolver === undefined) return provider;
    return {
      parameter: provider.parameter,
      wire: provider.wire,
      ...(provider.resource === undefined ? {} : { resource: provider.resource }),
      hostTypeSymbol: provider.hostTypeSymbol,
      wireTypeSymbol: provider.wireTypeSymbol,
      resolve: (id) => resolver.resolve(id),
    };
  }

  /**
   * Cấu hình bộ giải cho MỘT khoá (bên tiêu thụ cấp) trong fiber hiện tại.
   * Nhận: context, khoá, và hàm giải.
   * Trả: hàm dọn.
   */
  configure(ctx: StoreContext, key: string, resolver: (id: never) => Promise<any>): TypertDisposer {
    validateSegment("lookup key", key);
    if (this.resolvers.has(key)) throw new Error('typert: lookup "' + key + '" resolver is already configured');
    const entry = { provider: { resolve: async (id: never) => resolver(id) }, owner: {} };
    const { resolvers, changes } = this;
    return ctx.effect(function* () {
      resolvers.set(key, entry);
      changes.emit({ kind: "lookup", key });
      yield () => {
        if (resolvers.get(key) !== entry) return;
        resolvers.delete(key);
        changes.emit({ kind: "lookup", key });
      };
    }, "typert.lookups.configure(" + JSON.stringify(key) + ")");
  }

  /**
   * Đăng ký MỘT nhà cung cấp tra cứu trong fiber hiện tại.
   * Nhận: context, khoá, và nhà cung cấp.
   * Trả: hàm dọn.
   */
  register(ctx: StoreContext, key: string, provider: LookupProviderLike): TypertDisposer {
    provider = provider as unknown as LookupProviderLike;
    validateSegment("lookup key", key);
    validateSegment("lookup parameter", provider.parameter);
    validateWireName("lookup wire field", provider.wire);
    validateNonempty("lookup Host type symbol", provider.hostTypeSymbol);
    validateNonempty("lookup wire type symbol", provider.wireTypeSymbol);
    if (this.providers.has(key)) throw new Error('typert: lookup "' + key + '" is already registered');
    const definition: LookupDefinition = {
      key,
      parameter: provider.parameter,
      wire: provider.wire,
      hostTypeSymbol: provider.hostTypeSymbol,
      wireTypeSymbol: provider.wireTypeSymbol,
    };
    const known = this.definitions.get(key);
    if (known !== undefined && !lookupDefinitionEquals(known, definition)) {
      throw new Error('typert: lookup "' + key + '" changed its wire declaration during this registry lifetime');
    }
    const entry: LookupEntry = { provider, owner: {} };
    const { definitions, providers, changes } = this;
    return ctx.effect(function* () {
      definitions.set(key, definition);
      providers.set(key, entry);
      changes.emit({ kind: "lookup", key });
      yield () => {
        if (providers.get(key) !== entry) return;
        providers.delete(key);
        changes.emit({ kind: "lookup", key });
      };
    }, "typert.lookups.register(" + JSON.stringify(key) + ")");
  }
}

/**
 * Hai định nghĩa dây tra cứu có BẰNG nhau không.
 * Nhận: hai định nghĩa.
 * Trả: true khi mọi trường bằng.
 */
export function lookupDefinitionEquals(left: LookupDefinition, right: LookupDefinition): boolean {
  return (
    left.parameter === right.parameter &&
    left.wire === right.wire &&
    left.hostTypeSymbol === right.hostTypeSymbol &&
    left.wireTypeSymbol === right.wireTypeSymbol
  );
}

/** Bộ chuyển Context của MỘT khoá (Host hoặc Client). */
export interface ContextAdapterLike {
  /** Trường dây. */
  readonly wire: string;
  /** Ký hiệu kiểu dây. */
  readonly wireTypeSymbol: string;
  /** Loại tài nguyên (nếu có). */
  readonly resource?: string;
  /**
   * Giải id trên dây.
   * Nhận: id.
   * Trả: Context đã giải.
   */
  resolve?(id: never): Promise<unknown>;
}

/** Mục Context: bộ chuyển + chủ sở hữu. */
interface ContextEntry {
  /** Bộ chuyển. */
  readonly provider: ContextAdapterLike;
  /** Chủ sở hữu. */
  readonly owner: object;
}

/** Sổ bộ chuyển Context Host/Client (đảo phụ thuộc cho tham số Context). */
export class ContextStore {
  /** Bộ chuyển Host theo khoá. */
  private readonly hosts = new Map<string, ContextEntry>();

  /** Bộ giải Host theo khoá. */
  private readonly hostResolvers = new Map<string, { provider: { resolve(id: never): Promise<unknown> }; owner: object }>();

  /** Bộ chuyển Client theo khoá. */
  private readonly clients = new Map<string, ContextEntry>();

  /** Nguồn thay đổi. */
  private readonly changes: ChangeSource;

  /**
   * @param report - hàm báo lỗi listener.
   */
  constructor(report: ChangeReporter) {
    this.changes = new ChangeSource(report);
  }

  /**
   * Khung nhìn của sổ cho MỘT fiber.
   * Nhận: context của fiber.
   * Trả: sổ Context theo hợp đồng của kernel.
   */
  view(ctx: StoreContext): TypertContextRegistry {
    return {
      registerHost: (key: string, adapter: ContextAdapterLike) => this.registerHost(ctx, key, adapter),
      configureHost: (key: string, resolver: (id: never) => Promise<any>) => this.configureHost(ctx, key, resolver),
      registerClient: (key: string, adapter: ContextAdapterLike) => this.registerClient(ctx, key, adapter),
      getHost: (key: string) => this.getHost(key),
      getClient: (key: string) => this.clients.get(key)?.provider,
      subscribe: (listener: (change: TypertChange) => void) => this.changes.subscribe(ctx, listener),
} as unknown as TypertContextRegistry;
  }

  /**
   * Lấy bộ chuyển Host hiệu lực của MỘT khoá.
   * Nhận: khoá Context.
   * Trả: bộ chuyển hiệu lực, hoặc `undefined`.
   */
  getHost(key: string): ContextAdapterLike | undefined {
    const adapter = this.hosts.get(key)?.provider;
    if (adapter === undefined) return undefined;
    const resolver = this.hostResolvers.get(key)?.provider;
    if (resolver === undefined) return adapter;
    return {
      wire: adapter.wire,
      wireTypeSymbol: adapter.wireTypeSymbol,
      ...(adapter.resource === undefined ? {} : { resource: adapter.resource }),
      resolve: (id) => resolver.resolve(id),
    };
  }

  /**
   * Cấu hình bộ giải Host cho MỘT khoá trong fiber hiện tại.
   * Nhận: context, khoá, và hàm giải.
   * Trả: hàm dọn.
   */
  configureHost(ctx: StoreContext, key: string, resolver: (id: never) => Promise<unknown>): TypertDisposer {
    validateSegment("Context key", key);
    if (this.hostResolvers.has(key)) throw new Error('typert: host-context "' + key + '" resolver is already configured');
    const entry = { provider: { resolve: async (id: never) => resolver(id) }, owner: {} };
    const { hostResolvers, changes } = this;
    return ctx.effect(function* () {
      hostResolvers.set(key, entry);
      changes.emit({ kind: "host-context", key });
      yield () => {
        if (hostResolvers.get(key) !== entry) return;
        hostResolvers.delete(key);
        changes.emit({ kind: "host-context", key });
      };
    }, "typert.contexts.configureHost(" + JSON.stringify(key) + ")");
  }

  /**
   * Đăng ký MỘT bộ chuyển Host trong fiber hiện tại.
   * Nhận: context, khoá, và bộ chuyển.
   * Trả: hàm dọn.
   */
  registerHost(ctx: StoreContext, key: string, adapter: ContextAdapterLike): TypertDisposer {
    validateSegment("Context key", key);
    validateWireName("Context wire field", adapter.wire);
    validateNonempty("Context wire type symbol", adapter.wireTypeSymbol);
    return this.registerProvider(ctx, this.hosts, "host-context", key, adapter);
  }

  /**
   * Đăng ký MỘT bộ chuyển Client trong fiber hiện tại.
   * Nhận: context, khoá, và bộ chuyển.
   * Trả: hàm dọn.
   */
  registerClient(ctx: StoreContext, key: string, adapter: ContextAdapterLike): TypertDisposer {
    validateSegment("Context key", key);
    return this.registerProvider(ctx, this.clients, "client-context", key, adapter);
  }

  /**
   * Đăng ký MỘT bộ chuyển vào bảng tương ứng.
   * Nhận: context, bảng, loại (cho thông điệp), khoá, và bộ chuyển.
   * Trả: hàm dọn.
   */
  private registerProvider(
    ctx: StoreContext,
    table: Map<string, ContextEntry>,
    kind: "host-context" | "client-context",
    key: string,
    provider: ContextAdapterLike,
  ): TypertDisposer {
    if (table.has(key)) throw new Error("typert: " + kind + ' provider "' + key + '" is already registered');
    const entry: ContextEntry = { provider, owner: {} };
    const { changes } = this;
    return ctx.effect(function* () {
      table.set(key, entry);
      changes.emit({ kind, key });
      yield () => {
        if (table.get(key) !== entry) return;
        table.delete(key);
        changes.emit({ kind, key });
      };
    }, "typert.contexts.register(" + JSON.stringify(key) + ")");
  }
}

/** Loại tài nguyên KHÔNG có danh tính do kernel cấp; không loại nào được lấy tên này. */
export const GLOBAL_RESOURCE_KIND = "global";

/** Khai báo MỘT loại tài nguyên: trường dây mặc định. */
export interface ResourceDeclarationLike {
  /** Trường dây mặc định của loại. */
  readonly field: string;
}

/** Mục tài nguyên: khai báo + chủ sở hữu. */
interface ResourceEntry {
  /** Khai báo. */
  readonly provider: ResourceDeclarationLike;
  /** Chủ sở hữu. */
  readonly owner: object;
}

/** Sổ loại tài nguyên (trường dây mặc định của từng loại). */
export class ResourceStore {
  /** Khai báo theo loại. */
  private readonly declarations = new Map<string, ResourceEntry>();

  /** Nguồn thay đổi. */
  private readonly changes: ChangeSource;

  /**
   * @param report - hàm báo lỗi listener.
   */
  constructor(report: ChangeReporter) {
    this.changes = new ChangeSource(report);
  }

  /**
   * Khung nhìn của sổ cho MỘT fiber.
   * Nhận: context của fiber.
   * Trả: sổ tài nguyên theo hợp đồng của kernel.
   */
  view(ctx: StoreContext): TypertResourceRegistry {
    return {
      register: (kind: string, declaration: ResourceDeclarationLike) => this.register(ctx, kind, declaration),
      get: (kind: string) => this.declarations.get(kind)?.provider,
      entries: () =>
        [...this.declarations].map(([kind, entry]) => Object.freeze({ kind, field: entry.provider.field })),
      subscribe: (listener: (change: TypertChange) => void) => this.changes.subscribe(ctx, listener),
} as unknown as TypertResourceRegistry;
  }

  /**
   * Đăng ký MỘT loại tài nguyên trong fiber hiện tại.
   * Nhận: context, loại, và khai báo.
   * Trả: hàm dọn.
   */
  register(ctx: StoreContext, kind: string, declaration: ResourceDeclarationLike): TypertDisposer {
    validateSegment("resource kind", kind);
    if (kind === GLOBAL_RESOURCE_KIND) {
      throw new Error('typert: resource kind "' + GLOBAL_RESOURCE_KIND + '" is reserved for the built-in global resource');
    }
    validateWireName("resource field", declaration.field);
    if (this.declarations.has(kind)) throw new Error('typert: resource kind "' + kind + '" is already registered');
    const entry: ResourceEntry = { provider: { field: declaration.field }, owner: {} };
    const { declarations, changes } = this;
    return ctx.effect(function* () {
      declarations.set(kind, entry);
      changes.emit({ kind: "resource", key: kind });
      yield () => {
        if (declarations.get(kind) !== entry) return;
        declarations.delete(kind);
        changes.emit({ kind: "resource", key: kind });
      };
    }, "typert.resources.register(" + JSON.stringify(kind) + ")");
  }
}

/**
 * Kiểm MỘT tên đoạn RPC: chỉ ký tự của đoạn điểm cuối, và không phải `.`/`..`.
 * Nhận: chủ ngữ (cho thông điệp) và giá trị.
 * Trả: không; ném lỗi khi sai.
 */
export function validateWireName(subject: string, value: string): void {
  if (value === "." || value === ".." || !/^[A-Za-z0-9_$.-]+$/.test(value)) {
    throw new Error("typert: invalid " + subject + ' "' + value + '" — must contain only RPC endpoint segment characters');
  }
}

/**
 * Kiểm MỘT ĐOẠN danh tính: khác rỗng và không chứa `#`.
 * Nhận: chủ ngữ và giá trị.
 * Trả: không; ném lỗi khi sai.
 */
export function validateSegment(subject: string, value: string): void {
  if (value.length === 0 || value.includes("#")) {
    throw new Error("typert: invalid " + subject + ' "' + value + '" — must be nonempty and must not contain "#"');
  }
}

/**
 * Kiểm MỘT chuỗi KHÁC RỖNG.
 * Nhận: chủ ngữ và giá trị.
 * Trả: không; ném lỗi khi rỗng.
 */
export function validateNonempty(subject: string, value: string): void {
  if (value.length === 0) throw new Error("typert: invalid " + subject + " — must be nonempty");
}

/**
 * Kiểm MỘT codec: `src-json` bỏ qua; ngược lại cần ký hiệu kiểu khác rỗng và hàm `create`.
 * Nhận: codec và chủ ngữ (cho thông điệp).
 * Trả: không; ném lỗi khi sai.
 */
export function validateCodec(codec: { mode: string; typeSymbol?: string; create?: unknown }, subject: string): void {
  if (codec.mode === "src-json") return;
  validateNonempty(subject + " type symbol", codec.typeSymbol ?? "");
  if (typeof codec.create !== "function") throw new Error("typert: " + subject + " strict codec has no create() factory");
}

/**
 * Kiểm MỘT định nghĩa lời gọi theo toàn bộ luật của kernel.
 * Nhận: định nghĩa lời gọi.
 * Trả: không; ném lỗi nêu đúng chỗ sai.
 */
export function validateInvocation(descriptor: InvocationDescriptor): void {
  validateNonempty("invocation id", descriptor.id);
  validateSegment("invocation service key", descriptor.service);
  validateWireName("invocation namespace", descriptor.namespace);
  validateWireName("invocation method", descriptor.method);
  if (descriptor.implementation !== undefined) validateWireName("invocation implementation method", descriptor.implementation);
  validateCodec(descriptor.result as never, descriptor.id + " result");
  const wires = new Set<string>();
  for (const parameter of descriptor.parameters) {
    validateWireName("parameter name", parameter.name);
    validateWireName("parameter wire field", parameter.wire);
    if (wires.has(parameter.wire)) throw new Error('typert: invocation "' + descriptor.id + '" repeats wire field "' + parameter.wire + '"');
    wires.add(parameter.wire);
    if (parameter.source === "lookup") {
      if (parameter.acceptsUndefined !== undefined) {
        throw new Error(
          'typert: invocation "' + descriptor.id + '" lookup parameter "' + parameter.name + '" cannot accept undefined',
        );
      }
      if (parameter.lookup === undefined) {
        throw new Error('typert: invocation "' + descriptor.id + '" lookup parameter "' + parameter.name + '" has no lookup key');
      }
      validateSegment("lookup key", parameter.lookup);
    } else if (parameter.lookup !== undefined) {
      throw new Error('typert: invocation "' + descriptor.id + '" JSON parameter "' + parameter.name + '" declares a lookup key');
    }
    validateCodec(parameter.codec as never, descriptor.id + " parameter " + parameter.name);
  }
  const cancellation = descriptor.cancellation;
  if (cancellation !== undefined && cancellation.parameter !== "signal") {
    throw new Error('typert: invocation "' + descriptor.id + '" cancellation parameter must be "signal"');
  }
  const mode = descriptor.mode;
  if (mode !== undefined && mode !== "stream") throw new Error('typert: invocation "' + descriptor.id + '" mode must be "stream"');
  if (descriptor.uplink !== undefined) validateCodec(descriptor.uplink.codec as never, descriptor.id + " uplink");
  if (descriptor.scope !== undefined) {
    if (descriptor.invocation.kind !== "direct") {
      throw new Error('typert: invocation "' + descriptor.id + '" Context receiver cannot declare a direct scope projection');
    }
    validateSegment("scope Context key", descriptor.scope.context);
    validateWireName("scope wire field", descriptor.scope.wire);
    const lookups = descriptor.parameters.filter((candidate) => candidate.source === "lookup");
    const parameter = lookups.length === 1 ? lookups[0] : undefined;
    if (parameter === undefined || parameter.wire !== descriptor.scope.wire || parameter.lookup !== descriptor.scope.context) {
      throw new Error(
        'typert: invocation "' + descriptor.id + '" scope wire "' + descriptor.scope.wire + '" must select its only lookup parameter',
      );
    }
  }
  if (descriptor.invocation.kind === "context") {
    validateSegment("Context key", descriptor.invocation.context);
    validateWireName("Context wire field", descriptor.invocation.wire);
    if (wires.has(descriptor.invocation.wire)) {
      throw new Error('typert: invocation "' + descriptor.id + '" repeats wire field "' + descriptor.invocation.wire + '"');
    }
    validateCodec(descriptor.invocation.codec as never, descriptor.id + " Context");
  }
}
