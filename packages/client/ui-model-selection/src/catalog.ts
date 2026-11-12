/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc ModelCatalogDirectory — nap MOT danh muc model cho MOT the he Host, dung chung moi bo chon cua phien
 */

import { createStore } from "./store.ts";
import type { ClientCtx, ModelCatalog, ModelCatalogState, ModelSelection, SnapshotStore } from "./types.ts";
import type { ReasoningMetadata } from "./runtime.ts";

/** One Host-generation model catalog shared by every Session selector. */
/** Loads at most one model catalog for the current Host generation. */
export class ModelCatalogDirectory {
  /** Context goc cua plugin cung cap (namespace remote.session giu danh muc cua the he Host). */
  private readonly ctx: ClientCtx;
  /** Gia tri danh muc dung chung hien tai va vong doi nap. */
  readonly store: SnapshotStore<ModelCatalogState> = createStore<ModelCatalogState>({
    value: null,
    status: "idle",
    error: null,
  });
  /** Metadata reasoning da quang cao gan nhat, ke ca model khong kha dung. */
  private readonly reasoning = new Map<string, ReasoningMetadata | undefined>();
  /** The he Host cua lan nap; dung de bo ket qua cu. */
  private generation = 0;
  /** Lan nap dang chay (chia se cho moi nguoi goi). */
  private inflight: Promise<ModelCatalog> | undefined;

  /**
   * Doc metadata reasoning da quang cao gan nhat, ke ca model khong kha dung.
   * Nhận: selection — provider va model ma effort dang hien thi.
   * Trả: metadata reasoning quan sat duoc trong the he Host nay.
   */
  reasoningFor(selection: ModelSelection): ReasoningMetadata | undefined {
    return this.reasoning.get(JSON.stringify([selection.provider, selection.model]));
  }

  /**
   * @param ctx - the providing plugin's context, whose `remote.session`
   * namespace carries the Host-generation catalog.
   */
  constructor(ctx: ClientCtx) {
    this.ctx = ctx;
  }

  /**
   * Tra danh muc cua the he hien tai, chia se lan nap dang chay.
   * Nhận: khong co.
   * Trả: danh muc toan cuc da nap.
   */
  load(): Promise<ModelCatalog> {
    const state = this.store.getSnapshot();
    if (state.status === "ready" && state.value !== null) return Promise.resolve(state.value);
    if (this.inflight !== undefined) return this.inflight;
    const generation = this.generation;
    this.store.update((draft) => {
      draft.status = "loading";
      draft.error = null;
    });
    const operation = this.ctx.remote.session
      .modelCatalog()
      .then((response) => {
        if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
        if (generation === this.generation) {
          for (const group of response.value.groups) {
            for (const model of group.models) this.reasoning.set(JSON.stringify([group.id, model.id]), model.reasoning);
          }
          this.store.set({
            value: response.value,
            status: "ready",
            error: null,
          });
        }
        return response.value;
      })
      .catch((error: unknown) => {
        if (generation === this.generation) {
          this.store.update((draft) => {
            draft.status = "error";
            draft.error = error instanceof Error ? error.message : String(error);
          });
        }
        throw error;
      })
      .finally(() => {
        if (generation === this.generation && this.inflight === operation) this.inflight = undefined;
      });
    this.inflight = operation;
    return operation;
  }

  /**
   * Vo hieu danh muc da nap; lan doc menu ke tiep se nap lai.
   * Nhận: clear — co phai an ca gia tri cua the he Host truoc hay khong.
   * Trả: khong co.
   */
  private invalidate(clear = false): void {
    this.generation += 1;
    this.inflight = undefined;
    const value = clear ? null : this.store.getSnapshot().value;
    this.store.set({
      value,
      status: "idle",
      error: null,
    });
  }

  /**
   * Vo hieu roi nap lai danh muc sau khi dau vao model phia Host doi.
   * Nhận: khong co.
   * Trả: khong co.
   */
  refresh(): void {
    this.invalidate();
    this.load().catch(() => {});
  }

  /**
   * Xoa gia tri cua the he Host cu roi nap the he thay the.
   * Nhận: khong co.
   * Trả: khong co.
   */
  resetGeneration(): void {
    this.reasoning.clear();
    this.invalidate(true);
    this.load().catch(() => {});
  }
}
