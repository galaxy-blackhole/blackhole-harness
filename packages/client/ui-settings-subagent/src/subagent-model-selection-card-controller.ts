/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Controller cua the CHON MODEL: ghep form cai dat voi danh muc adapter song
 */
import type { ModelCandidate, ModelGroup, ModelRoute, SettingsSection, SubagentPrimitives, WritableStore } from "./types.ts";

/** Namespace của tuỳ chọn chọn model do Host sở hữu. */
export const SUBAGENT_MODEL_SELECTION_NS = "subagent-model-selection-settings";

/** Giá trị tuỳ chọn đã lưu. */
export interface SubagentModelSelectionSettings {
  /** Có cho phép agent tự chọn model không. */
  readonly enabled?: boolean;
  /** Các tuyến được phép. */
  readonly allowedModels?: readonly ModelRoute[];
}

/** Ảnh chụp mà thẻ chọn model phơi ra cho renderer. */
export interface SubagentModelSelectionCardState extends Record<string, unknown> {
  /** Có phục vụ được không. */
  readonly available?: boolean;
  /** Có ghi được không. */
  readonly writable?: boolean;
  /** Có thay đổi chưa lưu không. */
  readonly dirty?: boolean;
  /** Đang bật mà không chọn model nào. */
  readonly invalid?: boolean;
  /** Đang lưu. */
  readonly saving?: boolean;
  /** Lần lưu gần nhất thất bại. */
  readonly failed?: boolean;
  /** Công tắc đang bật. */
  readonly enabled?: boolean;
  /** Danh sách ứng viên. */
  readonly candidates?: readonly ModelCandidate[];
  /** Trạng thái danh mục. */
  readonly catalogStatus?: string;
  /** Danh mục nạp thiếu. */
  readonly catalogPartial?: boolean;
  /** Revision đã đổi ở nơi khác. */
  readonly conflicted?: boolean;
}

/** Mặt nghiệp vụ của thẻ chọn model. */
export interface SubagentModelSelectionCardFace {
  /** Hook ảnh chụp + action của thẻ. */
  readonly hooks: { readonly subagentModelSelectionCard: unknown };
  /** Bật/tắt quyền chọn model. */
  readonly toggleEnabled: () => void;
  /** Chọn/bỏ một tuyến theo khoá. */
  readonly toggleModel: (key: string) => void;
  /** Nạp lại danh mục. */
  readonly retryCatalog: () => void;
  /** Lưu bản nháp. */
  readonly save: () => void;
  /** Bỏ bản nháp. */
  readonly discard: () => void;
}

/** Ngữ cảnh mà controller này cần (chỉ phần remote dùng tới). */
export interface ModelCatalogContext {
  /** Kênh Remote. */
  readonly remote: {
    /** Không gian phiên: nguồn danh mục model. */
    readonly session: {
      /** Đọc danh mục model của Host. */
      modelCatalog: () => Promise<{ readonly ok: boolean; readonly value?: { readonly groups: ModelGroup[]; readonly failures: unknown[] } }>;
    };
  };
}

/**
 * Khoá định danh ổn định cho một tuyến; người gọi TRA CỨU theo khoá, không bao giờ tự phân tích.
 * Nhận: tuyến provider/model.
 * Trả: khoá mờ để tra trong thẻ.
 */
export function subagentModelKey(route: ModelRoute): string {
  return route.provider + "\u0000" + route.model;
}

/**
 * Ghép metadata adapter đang sống với các tuyến đã lưu (vẫn xoá được sau khi biến mất).
 * Nhận: danh mục nhóm theo nhà cung cấp, các tuyến trong giá trị đang hiệu lực, và tập khoá đang chọn.
 * Trả: các dòng ứng viên cho thẻ.
 */
export function subagentModelCandidates(
  groups: readonly ModelGroup[],
  stored: readonly ModelRoute[],
  selected: ReadonlySet<string>,
): ModelCandidate[] {
  const storedByKey = new Map(stored.map((route) => [subagentModelKey(route), route]));
  const candidates = groups.flatMap((group) =>
    group.models.map((model) => {
      const route: ModelRoute = { provider: group.id, model: model.id };
      const key = subagentModelKey(route);
      storedByKey.delete(key);
      return {
        ...route,
        key,
        providerName: group.name,
        modelName: model.name,
        available: true,
        selected: selected.has(key),
      };
    }),
  );
  for (const route of storedByKey.values()) {
    const key = subagentModelKey(route);
    candidates.push({
      ...route,
      key,
      providerName: route.provider,
      modelName: route.model,
      available: false,
      selected: selected.has(key),
    });
  }
  return candidates;
}

/**
 * So hai tập tuyến theo KHOÁ (không phụ thuộc thứ tự).
 * Nhận: hai tập tuyến.
 * Trả: true khi cùng độ dài và cùng tập khoá.
 */
export function sameRoutes(left: readonly ModelRoute[], right: readonly ModelRoute[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map(subagentModelKey));
  return left.every((route) => rightKeys.has(subagentModelKey(route)));
}

/** Nối một form cấu hình với danh mục adapter đang sống trên một thẻ staged. */
export class SubagentModelSelectionCardController {
  /** Mục cài đặt của Host. */
  private readonly scope: SettingsSection<SubagentModelSelectionSettings>;

  /** Ngữ cảnh (đọc danh mục model). */
  private readonly ctx: ModelCatalogContext;

  /** Danh mục đang sống, nhóm theo nhà cung cấp. */
  private catalogGroups: ModelGroup[] = [];

  /** Danh mục nạp thiếu (một phần nhà cung cấp lỗi). */
  private catalogPartial = false;

  /** Trạng thái danh mục: `idle` · `loading` · `ready` · `error`. */
  private catalogStatus = "idle";

  /** Công tắc trong bản nháp (vắng = chưa staged). */
  private draftEnabled: boolean | undefined;

  /** Các tuyến trong bản nháp (vắng = chưa staged). */
  private draftRoutes: Map<string, ModelRoute> | undefined;

  /** Revision lúc bắt đầu bản nháp. */
  private draftRevision: number | undefined;

  /** Đang lưu. */
  private saving = false;

  /** Lần lưu gần nhất thất bại. */
  private failed = false;

  /** Revision đã đổi ở nơi khác. */
  private conflicted = false;

  /** Đã gỡ. */
  private disposed = false;

  /** Thế hệ lần lưu (chặn kết quả về muộn). */
  private saveGeneration = 0;

  /** Thế hệ danh mục (chặn kết quả về muộn). */
  private catalogGeneration = 0;

  /** Store ảnh chụp. */
  private readonly store: WritableStore<SubagentModelSelectionCardState>;

  /** Hàm gỡ đăng ký với mục cài đặt. */
  private readonly unsubscribe: () => void;

  /**
   * Nhận: mục cài đặt đã ràng buộc của `subagent-model-selection` và ngữ cảnh thẻ.
   * Trả: controller đã sẵn sàng `inject()`.
   */
  constructor(scope: SettingsSection<SubagentModelSelectionSettings>, ctx: ModelCatalogContext, primitives: SubagentPrimitives) {
    this.scope = scope;
    this.ctx = ctx;
    this.store = primitives.createSnapshotStore(this.projection());
    this.unsubscribe = scope.subscribe(() => {
      if (
        !this.saving &&
        this.draftRoutes !== undefined &&
        this.scope.getSnapshot().revision !== this.draftRevision
      ) {
        if (this.currentEnabled() === this.enabled() && sameRoutes(this.currentRoutes(), this.desiredRoutes())) this.clearDraft();
        else this.conflicted = true;
      }
      if (this.enabled() && this.catalogStatus === "idle") this.loadCatalog();
      this.publish();
    });
    if (this.enabled() && this.catalogStatus === "idle") this.loadCatalog();
  }

  /** Dừng quan sát cài đặt và chặn kết quả danh mục/ghi về muộn. */
  dispose(): void {
    this.disposed = true;
    this.saveGeneration += 1;
    this.catalogGeneration += 1;
    this.unsubscribe();
  }

  /**
   * Dựng mặt renderer cho thẻ này.
   * Nhận: không có.
   * Trả: ảnh chụp và các action đã staged được tiêm vào renderer.
   */
  inject(): SubagentModelSelectionCardFace {
    return {
      hooks: { subagentModelSelectionCard: this.store },
      toggleEnabled: () => {
        this.toggleEnabled();
      },
      toggleModel: (key: string) => {
        this.toggleModel(key);
      },
      retryCatalog: () => {
        this.loadCatalog();
      },
      save: () => {
        void this.save();
      },
      discard: () => {
        this.discard();
      },
    };
  }

  /** Các tuyến đang hiệu lực (bản sao). */
  private currentRoutes(): ModelRoute[] {
    return this.scope.getSnapshot().value?.allowedModels?.map((route) => ({ ...route })) ?? [];
  }

  /** Công tắc đang hiệu lực. */
  private currentEnabled(): boolean {
    return this.scope.getSnapshot().value?.enabled ?? false;
  }

  /** Tập khoá đang chọn (bản nháp trước, rồi tới giá trị hiệu lực). */
  private selected(): Set<string> {
    return new Set(this.draftRoutes?.keys() ?? this.currentRoutes().map(subagentModelKey));
  }

  /** Công tắc đang hiển thị (bản nháp trước, rồi tới giá trị hiệu lực). */
  private enabled(): boolean {
    return this.draftEnabled ?? this.currentEnabled();
  }

  /** Mở bản nháp từ ảnh chụp hiện tại nếu chưa có. */
  private beginDraft(): Map<string, ModelRoute> {
    if (this.draftRoutes === undefined) {
      const snapshot = this.scope.getSnapshot();
      this.draftEnabled = snapshot.value?.enabled ?? false;
      this.draftRoutes = new Map((snapshot.value?.allowedModels ?? []).map((route) => [subagentModelKey(route), { ...route }]));
      this.draftRevision = snapshot.revision;
    }
    return this.draftRoutes;
  }

  /** Bật/tắt quyền chọn model (chỉ khi mục đã sẵn sàng và ghi được). */
  private toggleEnabled(): void {
    const snapshot = this.scope.getSnapshot();
    if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving) return;
    this.beginDraft();
    this.draftEnabled = !this.draftEnabled;
    this.failed = false;
    if (this.draftEnabled && this.catalogStatus === "idle") this.loadCatalog();
    this.publish();
  }

  /** Chọn/bỏ một tuyến theo khoá ứng viên. */
  private toggleModel(key: string): void {
    if (!this.enabled() || this.saving || !this.scope.getSnapshot().writable) return;
    const candidate = this.candidates().find((entry) => entry.key === key);
    if (candidate === undefined) return;
    const routes = this.beginDraft();
    if (routes.has(key)) routes.delete(key);
    else routes.set(key, { provider: candidate.provider, model: candidate.model });
    this.failed = false;
    this.publish();
  }

  /** Xoá bản nháp và mọi cờ lỗi/xung đột. */
  private clearDraft(): void {
    this.draftEnabled = undefined;
    this.draftRoutes = undefined;
    this.draftRevision = undefined;
    this.failed = false;
    this.conflicted = false;
  }

  /** Bỏ bản nháp mà không đụng tới cài đặt đã lưu. */
  private discard(): void {
    if (this.saving) return;
    this.clearDraft();
    this.publish();
  }

  /** Ứng viên = danh mục sống + các tuyến đã lưu/đang staged còn lại. */
  private candidates(): ModelCandidate[] {
    const retained = new Map(this.currentRoutes().map((route) => [subagentModelKey(route), route]));
    for (const [key, route] of this.draftRoutes ?? []) retained.set(key, route);
    return subagentModelCandidates(this.catalogGroups, [...retained.values()], this.selected());
  }

  /** Các tuyến sẽ ghi (bản nháp trước, rồi tới giá trị hiệu lực). */
  private desiredRoutes(): ModelRoute[] {
    return [...(this.draftRoutes?.values() ?? this.currentRoutes())].map((route) => ({ ...route }));
  }

  /** Lưu bản nháp qua mục cài đặt, có hàng rào revision và thế hệ. */
  private async save(): Promise<void> {
    const snapshot = this.scope.getSnapshot();
    const desiredEnabled = this.enabled();
    const desired = this.desiredRoutes();
    if (
      this.disposed ||
      snapshot.status !== "ready" ||
      !snapshot.writable ||
      this.saving ||
      (this.currentEnabled() === desiredEnabled && sameRoutes(this.currentRoutes(), desired)) ||
      (desiredEnabled && desired.length === 0)
    ) {
      return;
    }
    if (this.draftRoutes !== undefined && snapshot.revision !== this.draftRevision) {
      this.conflicted = true;
      this.publish();
      return;
    }
    const generation = this.saveGeneration;
    this.saving = true;
    this.failed = false;
    this.conflicted = false;
    this.publish();
    await this.scope.mutate(
      [
        { op: "set", path: ["enabled"], value: desiredEnabled },
        {
          op: "set",
          path: ["allowedModels"],
          value: desired.map((route) => ({ provider: route.provider, model: route.model })),
        },
      ],
      this.draftRevision,
    );
    if (generation !== this.saveGeneration) return;
    const landed = this.currentEnabled() === desiredEnabled && sameRoutes(this.currentRoutes(), desired);
    this.saving = false;
    this.failed = !landed;
    if (landed) this.clearDraft();
    this.publish();
  }

  /** Vô hiệu hoá và nạp lại danh mục sau khi đầu vào model của Host đổi. */
  refreshCatalog(): void {
    if (this.disposed) return;
    this.catalogGeneration += 1;
    this.catalogStatus = "idle";
    this.catalogPartial = false;
    if (this.enabled()) this.loadCatalog();
    else this.publish();
  }

  /** Bỏ ứng viên/bản nháp riêng của Host rồi nạp lại sau khi kết nối lại. */
  resetConnection(): void {
    if (this.disposed) return;
    this.saveGeneration += 1;
    this.saving = false;
    this.clearDraft();
    this.catalogGroups = [];
    this.refreshCatalog();
  }

  /** Nạp danh mục model từ Host. */
  private async loadCatalog(): Promise<void> {
    if (this.disposed || this.catalogStatus === "loading") return;
    const generation = this.catalogGeneration;
    this.catalogStatus = "loading";
    this.catalogPartial = false;
    this.publish();
    const response = await this.ctx.remote.session.modelCatalog();
    if (generation !== this.catalogGeneration) return;
    if (response.ok) {
      this.catalogGroups = response.value?.groups ?? [];
      this.catalogPartial = (response.value?.failures.length ?? 0) > 0;
      this.catalogStatus = "ready";
    } else {
      this.catalogStatus = "error";
    }
    this.publish();
  }

  /** Tính ảnh chụp từ trạng thái hiện tại. */
  private projection(): SubagentModelSelectionCardState {
    const snapshot = this.scope.getSnapshot();
    const current = this.currentRoutes();
    const desired = this.desiredRoutes();
    const enabled = this.enabled();
    return {
      available: snapshot.status === "ready",
      writable: snapshot.writable,
      dirty: this.currentEnabled() !== enabled || !sameRoutes(current, desired),
      invalid: enabled && desired.length === 0,
      saving: this.saving,
      failed: this.failed,
      enabled,
      candidates: this.candidates(),
      catalogStatus: this.catalogStatus,
      catalogPartial: this.catalogPartial,
      conflicted: this.conflicted,
    };
  }

  /** Công bố ảnh chụp mới cho người nghe. */
  private publish(): void {
    this.store.set(this.projection());
  }
}
