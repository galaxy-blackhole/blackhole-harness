/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc ConfigFormController: mot namespace settings — view dan xuat tu mirror + hang doi ghi co revision fence
 */

import type { SettingsDescribeMirror, NamespaceView } from "./mirror.ts";
import type { SettingsSchemaService, LiveSchema } from "./schema.ts";
import type { CreateStore, SettingsWriteRemote, SnapshotStore } from "./types.ts";

/** Trang thai cua mot form. */
export interface ConfigFormSnapshot {
  /** loading (chua co view) · ready · unavailable (Host khong phuc vu namespace nay). */
  status: "loading" | "ready" | "unavailable";
  /** Gia tri dang ap dung (da decode/validate). */
  value?: unknown;
  /** Gia tri goc cua Host. */
  base?: unknown;
  /** Gia tri nguoi dung da sua. */
  user?: unknown;
  /** Revision cua namespace. */
  revision?: number;
  /** Host co cho ghi khong. */
  writable: boolean;
}

/** Dac ta mot form: namespace + ham decode rieng (neu co). */
export interface ConfigFormSpec {
  /** Ten namespace (trung entryId cua plugin so huu). */
  readonly namespace: string;
  /**
   * Ham decode rieng: bien view cua Host thanh gia tri ma UI dung.
   * @param value - gia tri Host gui xuong.
   * @returns gia tri da decode.
   */
  readonly decode?: (value: unknown) => unknown;
}

/** Context toi thieu ma form can: seam remote.settings + service schema. */
export interface ConfigFormContext {
  /** Seam ghi settings. */
  readonly remote: { readonly settings: SettingsWriteRemote };
  /** Service settingsSchema (rehydrate + validate). */
  readonly schema: SettingsSchemaService;
  /** Ham rehydrate cua schemastery de giai envelope schema cua Host. */
  readonly rehydrate: (serialized: unknown) => LiveSchema;
}

/**
 * Mot namespace: view dan xuat tu mirror dung chung, cong hang doi ghi cua rieng namespace do.
 *
 * Moi lan ghi mang revision moi nhat da biet, gop cau tra loi vao mirror, va luc huy (dispose)
 * se cho thao tac dang qua mang ket thuc.
 */
export class ConfigFormController {
  private readonly store: SnapshotStore<ConfigFormSnapshot>;
  /** Duoi hang doi: moi thao tac ghi noi tiep nhau, khong chay song song. */
  private tail: Promise<void> = Promise.resolve();
  /** The he ghi: lan ghi cu (generation khac) khong duoc phep gop ket qua. */
  private writeGeneration = 0;
  /** Da huy chua. */
  private disposed = false;
  /** Ham huy dang ky theo doi mirror. */
  private readonly unsubscribe: () => void;
  /** Revision da duoc tra loi boi mot lan ghi bi thay the nhung con truoc mirror. */
  private pendingRevision: number | undefined;

  /**
   * @param ctx - context cua plugin cung cap (mang seam remote.settings).
   * @param spec - dinh danh namespace + ham decode tuy chon.
   * @param mirror - mirror dung chung ma form nay dan xuat.
   * @param createStore - ham tao store tu seam client-store.
   */
  constructor(
    private readonly ctx: ConfigFormContext,
    private readonly spec: ConfigFormSpec,
    private readonly mirror: SettingsDescribeMirror,
    createStore: CreateStore,
  ) {
    this.store = createStore<ConfigFormSnapshot>({
      status: "loading",
      value: undefined,
      base: undefined,
      user: undefined,
      revision: undefined,
      writable: false,
    });
    this.unsubscribe = mirror.subscribe(() => {
      this.derive();
    });
    this.derive();
  }

  /** @returns snapshot dong bo hien tai. */
  getSnapshot(): ConfigFormSnapshot {
    return this.store.getSnapshot();
  }

  /**
   * Theo doi moi lan snapshot doi.
   * @param listener - ham duoc goi sau moi lan doi.
   * @returns ham huy dang ky.
   */
  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  /**
   * Xep hang mot lan ghi mot truong.
   * @param field - ten truong trong namespace.
   * @param value - gia tri nguoi dung chon.
   * @returns Host co chap nhan khong (sau khi da recovery neu that bai).
   */
  set(field: string, value: unknown): Promise<boolean> {
    return this.mutate([{ op: "set", path: [field], value }]);
  }

  /**
   * Xep hang mot lan xoa truong.
   * @param field - ten truong trong namespace.
   * @returns Host co chap nhan khong.
   */
  unset(field: string): Promise<boolean> {
    return this.mutate([{ op: "unset", path: [field] }]);
  }

  /**
   * Xep hang mot lan sua nguyen tu.
   * @param ops - danh sach thao tac (duoc sao chep khi xep hang).
   * @param expectedRevision - revision co dinh do trinh soan thao doc duoc (neu co).
   * @returns Host co chap nhan khong.
   */
  mutate(ops: readonly unknown[], expectedRevision?: number): Promise<boolean> {
    const ownedOps = structuredClone(ops) as unknown[];
    const generation = ++this.writeGeneration;
    return this.enqueue(async () => {
      const revision = expectedRevision ?? this.pendingRevision ?? this.getSnapshot().revision;
      const response = await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision);
      if (!response.ok) {
        await this.recover(generation);
        return false;
      }
      if (this.disposed) return true;
      const view = response.value as NamespaceView | undefined;
      if (generation === this.writeGeneration) {
        this.pendingRevision = undefined;
        if (view !== undefined) this.mirror.acceptView(view);
      } else if (view?.revision !== undefined) {
        this.pendingRevision = view.revision;
      }
      return true;
    });
  }

  /**
   * Doc lai trang thai Host sau mot lan ghi that bai (lan ghi cu de lan moi lo).
   * @param generation - the he cua lan ghi vua that bai.
   */
  async recover(generation: number): Promise<void> {
    if (this.disposed || generation !== this.writeGeneration) return;
    this.pendingRevision = undefined;
    await this.mirror.load();
  }

  /**
   * Dung hang doi, ngung dan xuat, va cho thao tac dang qua mang ket thuc.
   * @returns promise ket thuc khi form da yen.
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.writeGeneration += 1;
    this.unsubscribe();
    await this.tail;
  }

  /**
   * Dua mot thao tac vao duoi hang doi.
   * @param operation - thao tac can chay.
   * @returns ket qua cua thao tac (false khi form da huy).
   */
  private enqueue(operation: () => Promise<boolean>): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    const task = this.tail.then(async () => {
      if (this.disposed) return false;
      return await operation();
    });
    this.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  /** Dan xuat lai snapshot tu mirror. */
  private derive(): void {
    if (this.disposed) return;
    const mirrored = this.mirror.getSnapshot();
    if (mirrored.view === undefined) return;
    const writable = mirrored.view.writable;
    const view = mirrored.view.namespaces.find((candidate) => candidate.ns === this.spec.namespace);
    if (view === undefined) {
      this.store.update((draft) => {
        draft.status = "unavailable";
        draft.writable = writable;
      });
      return;
    }
    const decoded = this.decode(view);
    this.store.update((draft) => {
      draft.revision = view.revision;
      draft.base = view.base;
      draft.user = view.user;
      draft.writable = writable;
      if (decoded === undefined) return;
      draft.status = "ready";
      draft.value = decoded;
    });
  }

  /**
   * Decode view cua Host thanh gia tri dung duoc (validate schema neu khong co ham decode rieng).
   * @param view - view namespace tu Host.
   * @returns gia tri da decode, hoac undefined khi khong dung dang.
   */
  private decode(view: NamespaceView): unknown {
    if (this.spec.decode !== undefined) return this.spec.decode(view.value);
    if (typeof view.value !== "object" || view.value === null || Array.isArray(view.value)) return undefined;
    let failure: string | undefined;
    try {
      failure = this.ctx.schema.validate(this.ctx.rehydrate(view.schema), view.value);
    } catch {
      return undefined;
    }
    return failure === undefined ? view.value : undefined;
  }
}
