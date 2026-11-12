/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc ModelDirectory — MOT trang thai duy nhat cho ca popup /model lan ghe composer cua mot phien
 */

import { createStore } from "./store.ts";
import type { ModelCatalogDirectory } from "./catalog.ts";
import type {
  ModelDirectoryState,
  ModelSelection,
  ModelSelectionProjection,
  ObservableSnapshot,
  RemoteResult,
  SessionsWireFace,
  SnapshotStore,
  TrackProductEvent,
} from "./types.ts";

/**
 * Per-session model directory: the ONE state both selection entries share.
 * The /model popup and composer seat combine one shared Host catalog with the
 * Session's durable selection projection, then submit through the same
 * selectModel call. A switch made in either entry updates this shared state.
 */
/** One session's shared directory controller; disposed with the session scope. */
export class ModelDirectory {
  /** Mat wire cua phien (bat tu connection goc cua plugin). */
  private readonly sessions: Pick<SessionsWireFace, "selectModel">;
  /** Phien so huu thu muc nay. */
  private readonly sessionId: string;
  /** Phien nay co duoc dung RPC model gan agent khong. */
  private readonly available: () => boolean;
  /** Danh muc the he Host, dung chung moi phien. */
  private readonly catalog: ModelCatalogDirectory;
  /** Lua chon model ben vung, chieu tu lich su phien. */
  private readonly projected: ObservableSnapshot<unknown>;
  /** Phien nay da co tin nhan dau tien chua. */
  private readonly isBlank: () => boolean;
  /** Callback chi desktop: theo doi sau khi nguoi dung chon thanh cong. */
  private readonly track: TrackProductEvent | undefined;
  /** The shared snapshot both entries render from (uSES-safe store). */
  readonly store: SnapshotStore<ModelDirectoryState> = createStore<ModelDirectoryState>({
    current: null,
    routable: null,
    groups: [],
    failures: [],
    status: "idle",
    pending: null,
    error: null,
  });
  /** Latest selection operation wins; an older response never overwrites a newer one. */
  private generation = 0;
  /** Scope da don dep chua — sau do khong duoc ghi store nua. */
  private disposed = false;
  /** Huy dang ky store danh muc. */
  private readonly unsubscribeCatalog: () => void;
  /** Huy dang ky projection lua chon. */
  private readonly unsubscribeSelection: () => void;

  /**
   * @param sessions - the session wire face (captured from the plugin's root connection).
   * @param sessionId - the owning session.
   * @param available - whether this session may use Agent-bound model RPCs.
   * @param catalog - Host-generation catalog shared by every Session.
   * @param projected - durable model selection projected from Session history.
   * @param isBlank - whether this Session has no first message yet.
   * @param track - desktop-only callback after a successful user selection.
   */
  constructor(
    sessions: Pick<SessionsWireFace, "selectModel">,
    sessionId: string,
    available: () => boolean,
    catalog: ModelCatalogDirectory,
    projected: ObservableSnapshot<unknown>,
    isBlank: () => boolean,
    track?: TrackProductEvent,
  ) {
    this.sessions = sessions;
    this.sessionId = sessionId;
    this.available = available;
    this.catalog = catalog;
    this.projected = projected;
    this.isBlank = isBlank;
    this.track = track;
    this.unsubscribeCatalog = catalog.store.subscribe(() => {
      this.syncInputs();
    });
    this.unsubscribeSelection = projected.subscribe(() => {
      this.syncInputs();
    });
    this.syncInputs();
  }

  /**
   * Bao dam danh muc kha dung cua the he Host da nap.
   * Nhận: khong co.
   * Trả: gia tri thu muc moi.
   */
  async load(): Promise<ModelDirectoryState> {
    this.assertAvailable();
    await this.catalog.load();
    this.syncInputs();
    return this.store.getSnapshot();
  }

  /**
   * Select the complete provider/model/reasoning selection. The durable
   * projection frame updates the shared current; failures surface on the store
   * and return with the operation so each entry can present its own failure.
   * Nhận: selection — provider, model do provider so huu, va effort tuy chon cua adapter.
   * Trả: ket qua cua lua chon, kem loi Remote goc.
   */
  async select(selection: ModelSelection): Promise<RemoteResult<void>> {
    this.assertAvailable();
    const previous = this.store.getSnapshot().current;
    const previousEffort =
      previous?.reasoningEffort ??
      (previous === null ? undefined : this.catalog.reasoningFor(previous)?.defaultEffort);
    const nextEffort = selection.reasoningEffort ?? this.catalog.reasoningFor(selection)?.defaultEffort;
    const generation = ++this.generation;
    this.store.update((s) => {
      s.status = "selecting";
      s.pending = selection;
      s.error = null;
    });
    const result = await this.sessions.selectModel({
      sessionId: this.sessionId,
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: selection.reasoningEffort }),
    });
    if (this.disposed || generation !== this.generation) {
      return result.ok
        ? {
            ok: true,
            value: undefined,
          }
        : result;
    }
    if (!result.ok) {
      this.store.update((s) => {
        s.status = "error";
        s.pending = null;
        s.error = `${result.error.code}: ${result.error.message}`;
      });
      return result;
    }
    if (previous !== null) {
      const from = `${previous.provider}/${previous.model}`;
      const to = `${selection.provider}/${selection.model}`;
      if (from !== to) {
        this.track?.("model_switch", {
          ...(this.isBlank() ? {} : { session_id: this.sessionId }),
          switch_from: from,
          switch_to: to,
        });
      }
      if (from === to && previousEffort !== nextEffort) {
        this.track?.("thinking_level_switch", {
          ...(this.isBlank() ? {} : { session_id: this.sessionId }),
          model_name: to,
          switch_from: previousEffort ?? "default",
          switch_to: nextEffort ?? "default",
        });
      }
    }
    this.store.update((s) => {
      s.status = "ready";
      s.pending = null;
      s.error = null;
    });
    this.syncInputs();
    return {
      ok: true,
      value: undefined,
    };
  }

  /**
   * Vo hieu phan hoi cua mot lan chon dang chay tu the he Host truoc.
   * Nhận: khong co.
   * Trả: khong co.
   */
  resetConnected(): void {
    if (this.disposed) return;
    ++this.generation;
    this.store.update((state) => {
      if (state.status === "selecting") state.status = "idle";
      state.pending = null;
      state.error = null;
    });
    this.syncInputs();
  }

  /**
   * Don dep khi scope phien dong: phan hoi den muon se mat quyen ghi store.
   * Nhận: khong co.
   * Trả: khong co.
   */
  dispose(): void {
    this.disposed = true;
    this.unsubscribeSelection();
    this.unsubscribeCatalog();
  }

  /**
   * Nem khi phien la subagent co dia chi (khong duoc dung RPC model).
   * Nhận: khong co.
   * Trả: khong co — nem loi khi khong kha dung.
   */
  private assertAvailable(): void {
    if (!this.available()) throw new Error("model selection is unavailable for addressed subagent sessions");
  }

  /**
   * Dong bo danh muc + projection ben vung thanh mot anh chup duy nhat.
   * Nhận: khong co.
   * Trả: khong co.
   */
  private syncInputs(): void {
    if (this.disposed) return;
    const catalog = this.catalog.store.getSnapshot();
    const projected = modelSelectionProjection(this.projected.getSnapshot());
    const intended = projected?.next ?? catalog.value?.default;
    const reasoning = intended === undefined ? undefined : this.catalog.reasoningFor(intended);
    const effort = intended?.reasoningEffort ?? reasoning?.defaultEffort;
    const retainedEffort =
      effort === undefined ? undefined : (reasoning?.efforts.find((level) => level.id === effort)?.name ?? effort);
    if (catalog.status !== "ready" || catalog.value === null || projected === undefined) {
      this.store.set({
        current: catalog.value === null ? null : this.store.getSnapshot().current,
        ...(retainedEffort === undefined ? {} : { retainedEffort }),
        routable: null,
        groups: catalog.value?.groups ?? [],
        failures: catalog.value?.failures ?? [],
        status: catalog.status === "error" ? "error" : "loading",
        pending: this.store.getSnapshot().pending,
        error: catalog.error,
      });
      return;
    }
    const selection = (projected.next ?? catalog.value.default) as ModelSelection;
    const routable = catalog.value.groups.some(
      (group) => group.id === selection.provider && group.models.some((model) => model.id === selection.model),
    );
    this.store.set({
      current: selection,
      ...(retainedEffort === undefined ? {} : { retainedEffort }),
      routable,
      groups: catalog.value.groups,
      failures: catalog.value.failures,
      status: this.store.getSnapshot().status === "selecting" ? "selecting" : "ready",
      pending: this.store.getSnapshot().pending,
      error: null,
    });
  }
}

/**
 * Doc projection lua chon model tu lich su phien.
 * Nhận: value — gia tri projection (chua biet hinh dang o bien gioi context).
 * Trả: projection da dinh kieu, hoac undefined khi phien chua co.
 */
export function modelSelectionProjection(value: unknown): ModelSelectionProjection | undefined {
  return value === undefined ? undefined : (value as ModelSelectionProjection);
}
