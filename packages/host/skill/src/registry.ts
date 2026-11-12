/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đăng ký nhà cung cấp KỸ NĂNG (`ctx.skills`): gộp catalog theo lớp phạm vi, phân giải kỹ
 *      năng thắng theo tên, nạp thân theo yêu cầu, và báo `skills/change` khi catalog đổi —
 *      viết lại trung thành từ bundle gốc 566 dòng của `@deepseek-ai/dsh-skill`
 */

import { Service } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import { NamedEntries, ScopedLayers, scopeChainOf, scopeOf } from "@deepseek-ai/dsh-scope";
import type { ScopeKey, ScopeLayer } from "@deepseek-ai/dsh-scope";
import z from "@deepseek-ai/schemastery";
import { isSkillName } from "./render.ts";
import type {
  Config,
  SkillCandidate,
  SkillCatalogSnapshot,
  SkillDefinition,
  SkillProvider,
  SkillProviderControl,
  SkillProviderObservation,
  SkillRegistration,
  SkillSummary,
  SkillViewOptions,
} from "./types.ts";
import {
  assertPositiveInteger,
  errorMessage,
  normalizeProviderObservation,
  throwIfAborted,
  toError,
  validateCandidate,
  validateDefinition,
  validateRuntimeSkill,
  waitWithAbort,
} from "./validation.ts";

/** Trần mặc định của bộ nhớ catalog đã xong. */
const DEFAULT_COLLECT_CACHE_ENTRIES = 128;

/** Số lượt thử tối đa khi bản sửa đổi catalog đổi NGAY TRONG lúc dò. */
const MAX_COLLECT_ATTEMPTS = 2;

/** Tên nhà cung cấp dành riêng cho đóng góp runtime. */
const RUNTIME_PROVIDER = "runtime";

/** Hạng của ứng viên runtime trong một lớp (thấp hơn 600 của gói đóng gói). */
const RUNTIME_RANK = 250;

/** Một lượt đăng ký nhà cung cấp đã vào lớp nào, dưới tên nào — dùng để làm mới ĐÚNG lượt còn sống. */
interface ProviderRegistration {
  /** Lớp đã nhận lượt đăng ký. */
  readonly layer: SkillLayer;
  /** Tên nhà cung cấp trong lớp đó. */
  readonly name: string;
}

/** Giá trị giữ trong bảng tên của một lớp: nhà cung cấp + thứ tự đăng ký toàn cục. */
interface ProviderEntry {
  /** Nhà cung cấp đã đăng ký. */
  readonly provider: SkillProvider;
  /** Thứ tự đăng ký tăng dần — khoá phụ khi hai ứng viên cùng hạng. */
  readonly order: number;
}

/** Một ứng viên đã được đánh chỉ số để sắp thứ tự thắng. */
interface IndexedCandidate {
  /** Ứng viên do nhà cung cấp trả về. */
  readonly candidate: SkillCandidate;
  /** Nhà cung cấp sở hữu ứng viên. */
  readonly provider: SkillProvider;
  /** Thứ tự đăng ký của nhà cung cấp. */
  readonly providerOrder: number;
  /** Thứ tự ứng viên trong MỘT lượt `list()` của nhà cung cấp. */
  readonly localOrder: number;
  /** Lớp (phạm vi) đã sinh ra ứng viên. */
  readonly layer: SkillLayer;
}

/** Kết quả MỘT lượt dò: bảng tên→ứng viên thắng, cộng cờ cho biết có được phép ghi nhớ hay không. */
interface Collected {
  /** Ứng viên thắng theo tên. */
  readonly entries: Map<string, IndexedCandidate>;
  /** Phép dò đã hoàn tất và catalog ổn định hay chưa. */
  readonly cacheable: boolean;
}

/** Một lớp phạm vi: bảng nhà cung cấp có thứ tự chèn + bảng kỹ năng runtime. */
class SkillLayer implements ScopeLayer {
  /** Nhà cung cấp đăng ký qua các context mang phạm vi này, theo thứ tự chèn. */
  readonly providers: NamedEntries<ProviderEntry>;

  /** Kỹ năng runtime đăng ký qua các context mang phạm vi này. */
  readonly runtime = new Map<string, SkillDefinition>();

  /**
   * Dựng một lớp cho một phạm vi.
   * Nhận: khoá phạm vi (`undefined` là lớp toàn cục) — chỉ dùng để dựng thông điệp trùng tên.
   * Trả: lớp rỗng, sẵn sàng nhận đăng ký.
   */
  constructor(scope: ScopeKey | undefined) {
    this.providers = new NamedEntries<ProviderEntry>(
      (name) =>
        new Error(
          scope === undefined
            ? `a skill provider named "${name}" is already registered`
            : `a skill provider named "${name}" is already registered in this scope`,
        ),
    );
  }

  /**
   * Cho biết lớp này còn đóng góp nào không.
   * Nhận: không.
   * Trả: `true` khi cả bảng nhà cung cấp lẫn bảng runtime đều rỗng.
   */
  isEmpty(): boolean {
    return this.providers.isEmpty() && this.runtime.size === 0;
  }
}

/** Nhà cung cấp nội bộ phục vụ các đóng góp runtime: chỉ sở hữu `get()`, `list()` luôn rỗng. */
const RUNTIME_SKILL_PROVIDER: SkillProvider = {
  name: RUNTIME_PROVIDER,
  list(): Promise<readonly SkillCandidate[]> {
    return Promise.resolve([]);
  },
  get(candidate: SkillCandidate): Promise<SkillDefinition | undefined> {
    // `locator` của ứng viên runtime CHÍNH LÀ định nghĩa đã đăng ký.
    return Promise.resolve(candidate.locator as SkillDefinition);
  },
};

/**
 * Dựng ứng viên cho một kỹ năng runtime.
 * Nhận: định nghĩa đã đăng ký.
 * Trả: ứng viên hạng `RUNTIME_RANK`, `locator` trỏ về chính định nghĩa; trường tuỳ chọn chỉ có
 *   mặt khi định nghĩa có (giữ đúng hình dạng bản gốc).
 */
function runtimeCandidate(skill: SkillDefinition): SkillCandidate {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
    invocation: skill.invocation,
    source: skill.source,
    provider: skill.provider,
    ...(skill.resourceBase === undefined ? {} : { resourceBase: skill.resourceBase }),
    rank: RUNTIME_RANK,
    locator: skill,
    ...(skill.path === undefined ? {} : { path: skill.path }),
    ...(skill.metadata === undefined ? {} : { metadata: skill.metadata }),
  };
}

/**
 * Rút bản TÓM TẮT trung tính với cách gọi ra khỏi ứng viên.
 * Nhận: ứng viên (hoặc định nghĩa) đã thắng.
 * Trả: bản tóm tắt MỚI cho mỗi lượt gọi; giữ đúng thứ tự khoá của bản gốc.
 */
function toSummary(skill: SkillCandidate | SkillDefinition): SkillSummary {
  const { name, description, whenToUse, invocation, source, provider, resourceBase } = skill;
  return {
    name,
    ...(skill.path === undefined ? {} : { path: skill.path }),
    description,
    ...(whenToUse === undefined ? {} : { whenToUse }),
    invocation,
    source,
    provider,
    ...(resourceBase === undefined ? {} : { resourceBase }),
  };
}

/**
 * So hai chuỗi theo ĐIỂM MÃ (không theo locale) — cùng phép so với bản gốc.
 * Nhận: hai chuỗi.
 * Trả: -1/0/1 như `Array.prototype.sort` cần.
 */
function compareCodePoints(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * So hai bản tóm tắt theo tên.
 * Nhận: hai bản tóm tắt.
 * Trả: thứ tự điểm mã của hai tên.
 */
function compareSkillSummary(left: SkillSummary, right: SkillSummary): number {
  return compareCodePoints(left.name, right.name);
}

/**
 * So hai ứng viên đã đánh chỉ số: hạng trước, rồi thứ tự nhà cung cấp, rồi thứ tự trong lượt `list()`.
 * Nhận: hai ứng viên đã đánh chỉ số.
 * Trả: số âm khi bên trái thắng.
 */
function compareIndexedCandidates(left: IndexedCandidate, right: IndexedCandidate): number {
  return left.candidate.rank - right.candidate.rank || left.providerOrder - right.providerOrder || left.localOrder - right.localOrder;
}

/**
 * Sổ đăng ký nhà cung cấp kỹ năng, theo hình dạng "toàn cục + lớp theo phạm vi" mà sổ tool đã lập.
 * Một lượt đăng ký rơi vào lớp của phạm vi context đang gọi ({@link scopeOf}): row host và plugin
 * của repo vào lớp toàn cục, còn plugin do composition thường trực của một agent preset mount vào
 * lớp của preset đó. Lượt ĐỌC gộp lớp toàn cục với chuỗi lớp của phạm vi đang nhìn — mục của lớp
 * gần nhất thắng tên trùng NGAY, còn hạng chỉ quyết định trùng tên TRONG cùng một lớp. Sổ phơi bản
 * tóm tắt đã sắp xếp và nạp thân kỹ năng theo yêu cầu.
 */
export class SkillRegistry extends Service {
  /** Schema cấu hình (schemastery) — để Settings/config-editor của kernel render được trường duy nhất. */
  static Config = z.object({ collectCacheMaxEntries: z.number().default(DEFAULT_COLLECT_CACHE_ENTRIES) }) as unknown as z<Config>;

  /** Trần số catalog đã xong được giữ trong bộ nhớ. */
  private readonly collectCacheMaxEntries: number;

  /** Hai tầng lớp (toàn cục + theo phạm vi) và hiệu ứng dọn của chúng. */
  private readonly layers = new ScopedLayers<SkillLayer>(
    (scope) => new SkillLayer(scope),
    () => {
      this.invalidateCache();
    },
  );

  /** Catalog đã xong, khoá theo cặp cwd + danh tính phạm vi + bản sửa đổi. */
  private readonly collectCache = new Map<string, Map<string, IndexedCandidate>>();

  /** Bản sửa đổi catalog — mỗi lần làm mới tăng một, làm khoá cache cũ không bao giờ trúng lại. */
  private revision = 0;

  /** Bộ đếm thứ tự đăng ký nhà cung cấp toàn cục. */
  private nextProviderOrder = 0;

  /** Danh tính ỔN ĐỊNH cho khoá cache; khoá phạm vi là vật thể so bằng danh tính. */
  private readonly scopeIds = new WeakMap<ScopeKey, number>();

  /** Bộ đếm danh tính phạm vi. */
  private nextScopeId = 1;

  /**
   * Đăng ký service `skills` trong context hiện tại.
   * Nhận: context host của kernel và cấu hình đã qua schema (mặc định rỗng).
   * Trả: thực thể đã đăng ký; ném `Error` khi trần cache không phải số nguyên ≥ 1.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "skills");
    this.collectCacheMaxEntries = config.collectCacheMaxEntries ?? DEFAULT_COLLECT_CACHE_ENTRIES;
    assertPositiveInteger("collectCacheMaxEntries", this.collectCacheMaxEntries);
  }

  /**
   * Đăng ký ĐỒNG BỘ một nhà cung cấp cùng tiến trình trong lúc plugin `apply`, vào lớp của context
   * đang gọi: context có phạm vi (mount thường trực của agent preset) chỉ đăng ký cho phạm vi đó,
   * context không phạm vi đăng ký toàn cục. Trùng tên trong một lớp và tên dành riêng đều ném;
   * khởi tạo từ xa thuộc về `list()`. Dọn fiber sẽ gỡ nhà cung cấp và làm mới cache catalog.
   * Nhận: hàm dựng ĐỒNG BỘ nhận quyền điều khiển vòng đời + làm mới của CHÍNH lượt đăng ký này.
   * Trả: đúng hàm dọn hiệu ứng của Cordis để gỡ nhà cung cấp này; hiệu ứng ghép có thể nhường
   *   thẳng hàm này để giữ thứ tự dọn.
   */
  registerProvider(create: (control: SkillProviderControl) => SkillProvider): () => void {
    const lifecycle = new AbortController();
    let registration: ProviderRegistration | undefined;
    let provider: SkillProvider | undefined;
    const control: SkillProviderControl = {
      signal: lifecycle.signal,
      invalidate: () => {
        const active = registration;
        if (active !== undefined && active.layer.providers.get(active.name)?.provider === provider) this.invalidateCache();
      },
    };
    try {
      const created = create(control);
      provider = created;
      const name = created.name;
      if (name === RUNTIME_PROVIDER) throw new Error(`"${RUNTIME_PROVIDER}" is reserved for runtime skill registrations`);
      const order = this.nextProviderOrder;
      this.nextProviderOrder += 1;
      return this.layers.effect(
        this.ctx,
        (layer) => {
          const undo = layer.providers.insert(name, { provider: created, order });
          registration = { layer, name };
          return () => {
            registration = undefined;
            undo();
            lifecycle.abort(new Error(`skill provider "${name}" disposed`));
          };
        },
        { label: "skills.registerProvider()" },
      );
    } catch (error) {
      lifecycle.abort(error);
      throw error;
    }
  }

  /**
   * Đăng ký một kỹ năng runtime CHỈ ĐỌC, mượn được, vào lớp của context đang gọi. Trong MỘT lớp,
   * mục dự án thắng mục runtime, và mục runtime thắng mục người dùng. Kỹ năng runtime trùng tên
   * trong một lớp là "ai tới trước thắng"; mục trùng ghi một dòng cảnh báo và nhận hàm dọn RỖNG
   * để nó không gỡ được mục đã thắng.
   * Nhận: đầu vào định nghĩa kỹ năng; công tắc gọi và nhà cung cấp bỏ trống sẽ nhận mặc định.
   * Trả: đúng hàm dọn hiệu ứng của Cordis, giữ thứ tự dọn của hiệu ứng ghép và làm mới cache.
   */
  register(skill: SkillRegistration): () => void {
    validateRuntimeSkill(skill);
    const scope = scopeOf(this.ctx);
    const existingLayer = scope === undefined ? this.layers.global : this.layers.peek(scope);
    if (existingLayer !== undefined && existingLayer.runtime.has(skill.name)) {
      this.ctx.logger.warn(`runtime skill "${skill.name}" ignored because it is already registered`);
      return () => {};
    }
    const definition: SkillDefinition = {
      ...skill,
      // Vật thể MỚI cho MỖI lượt đăng ký (không dùng hằng chia sẻ) — hai kỹ năng không bao giờ
      // chung một công tắc gọi, nên sửa vật này không lan sang vật kia (luật C6).
      invocation: skill.invocation ?? { modelInvocable: true, userInvocable: true },
      provider: skill.provider ?? RUNTIME_PROVIDER,
    };
    return this.layers.effect(
      this.ctx,
      (layer) => {
        layer.runtime.set(definition.name, definition);
        return () => {
          layer.runtime.delete(definition.name);
        };
      },
      { label: "skills.register()" },
    );
  }

  /**
   * Liệt kê bản tóm tắt kỹ năng TRUNG TÍNH với cách gọi cho một workspace. Bên tiêu thụ tự áp chính
   * sách gọi model/người tại ranh giới vận hành của mình. Tuỳ chọn tra và ứng viên của nhà cung cấp
   * đều là giá trị cùng tiến trình chỉ đọc, được mượn xuyên suốt phép dò.
   * Nhận: tuỳ chọn nhìn; `scope` chọn lớp của agent đang nhìn, `cwd` chọn gốc dự án, `signal` huỷ phép dò.
   * Trả: toàn bộ bản tóm tắt thắng, đã sắp xếp.
   */
  async list(options: SkillViewOptions = {}): Promise<SkillSummary[]> {
    return (await this.snapshot(options)).skills;
  }

  /**
   * Quan sát catalog trung tính hiện tại kèm cờ cho biết phép dò đã xong trong MỘT bản sửa đổi ổn
   * định hay chưa. Quan sát CHƯA xong không bao giờ được ghi nhớ, để bên tiêu thụ giữ được trạng
   * thái tốt nhất gần nhất và thử lại ở ranh giới yêu cầu kế tiếp.
   * Nhận: tuỳ chọn nhìn; `scope` chọn lớp của agent đang nhìn, `cwd` chọn gốc dự án, `signal` huỷ phép dò.
   * Trả: bản tóm tắt đã sắp xếp cộng trạng thái hoàn tất của phép dò.
   */
  async snapshot(options: SkillViewOptions = {}): Promise<SkillCatalogSnapshot> {
    const collected = await this.collect(options);
    return {
      skills: [...collected.entries.values()].map((entry) => toSummary(entry.candidate)).sort(compareSkillSummary),
      complete: collected.cacheable,
    };
  }

  /**
   * Nạp và kiểm ứng viên thắng, trả lại tay nắm dò mờ cho nhà cung cấp. Việc huỷ được kiểm LẠI sau
   * khi chọn — kể cả khi trúng cache — và được đua với lượt nạp, nên nhà cung cấp không hợp tác
   * cũng không treo được bên gọi.
   * Nhận: tên kebab-case của kỹ năng và tuỳ chọn nhìn; `scope` chọn lớp, `cwd` chọn kỹ năng phụ
   *   thuộc workspace, `signal` huỷ công việc.
   * Trả: kỹ năng đầy đủ kèm thân, hoặc `undefined` khi không có/nhà cung cấp không còn nạp được.
   */
  async get(name: string, options: SkillViewOptions = {}): Promise<SkillDefinition | undefined> {
    if (!isSkillName(name)) return undefined;
    const collected = await this.collect(options);
    throwIfAborted(options.signal);
    const match = collected.entries.get(name);
    if (match === undefined) return undefined;
    const definition = await waitWithAbort(match.provider.get(match.candidate, options), options.signal);
    if (definition === undefined) return undefined;
    validateDefinition(definition);
    if (definition.name !== match.candidate.name) {
      // Định nghĩa đã cũ: làm mới cache CHỈ khi đúng lượt đăng ký đã sinh mục này còn sống.
      this.invalidateEntry(match);
      return undefined;
    }
    return definition;
  }

  /**
   * Dò catalog cho một lượt đọc, ưu tiên cache và tự thử lại khi catalog đổi GIỮA lượt dò.
   * Nhận: tuỳ chọn nhìn của bên gọi.
   * Trả: bảng ứng viên thắng + cờ được phép ghi nhớ; ném khi tín hiệu đã huỷ.
   */
  private async collect(options: SkillViewOptions): Promise<Collected> {
    throwIfAborted(options.signal);
    let attempt = 1;
    for (;;) {
      const revision = this.revision;
      const key = this.collectCacheKey(options.cwd, scopeChainOf(options.scope), revision);
      const cached = this.collectCache.get(key);
      if (cached !== undefined) return { entries: cached, cacheable: true };
      const result = await this.collectFresh(options);
      throwIfAborted(options.signal);
      if (revision !== this.revision) {
        if (attempt < MAX_COLLECT_ATTEMPTS) {
          attempt += 1;
          continue;
        }
        return { entries: result.entries, cacheable: false };
      }
      if (result.cacheable) {
        this.collectCache.set(key, result.entries);
        if (this.collectCache.size > this.collectCacheMaxEntries) {
          const oldest = this.collectCache.keys().next();
          // Nhánh "hết dòng" không tới được (size > trần ≥ 1); giữ phép kiểm để khỏi phải ép kiểu.
          if (oldest.done === false) this.collectCache.delete(oldest.value);
        }
      }
      return result;
    }
  }

  /**
   * Dò TƯƠI: gộp lớp toàn cục với chuỗi lớp của phạm vi đang nhìn (xa nhất trước, gần nhất sau).
   * Nhận: tuỳ chọn nhìn của bên gọi.
   * Trả: bảng ứng viên thắng + cờ được phép ghi nhớ.
   */
  private async collectFresh(options: SkillViewOptions): Promise<Collected> {
    const layers = [this.layers.global, ...this.layers.chainLayers(options.scope)];
    const merged = new Map<string, IndexedCandidate>();
    let cacheable = true;
    for (const layer of layers) {
      const collected = await this.collectLayer(layer, options);
      if (!collected.cacheable) cacheable = false;
      for (const entry of collected.entries) merged.set(entry.candidate.name, entry);
    }
    return { entries: merged, cacheable };
  }

  /**
   * Dò MỘT lớp rồi loại ứng viên trùng tên trong chính lớp đó (ai hạng tốt hơn thắng).
   * Nhận: lớp cần dò và tuỳ chọn nhìn của bên gọi.
   * Trả: ứng viên còn lại của lớp + cờ được phép ghi nhớ.
   */
  private async collectLayer(
    layer: SkillLayer,
    options: SkillViewOptions,
  ): Promise<{ entries: IndexedCandidate[]; cacheable: boolean }> {
    const collected = await this.listLayerCandidates(layer, options);
    collected.entries.sort(compareIndexedCandidates);
    const seen = new Set<string>();
    const result: IndexedCandidate[] = [];
    for (const entry of collected.entries) {
      const skill = entry.candidate;
      if (seen.has(skill.name)) {
        this.ctx.logger.warn(
          `skill "${skill.name}" from ${skill.source} ignored because a higher-priority skill already exists`,
        );
        continue;
      }
      seen.add(skill.name);
      result.push(entry);
    }
    return { entries: result, cacheable: collected.cacheable };
  }

  /**
   * Liệt kê ứng viên của MỘT lớp: đóng góp runtime trước (hạng 250, không có nhà cung cấp), rồi
   * tới các nhà cung cấp theo thứ tự đăng ký. Nhà cung cấp ném lỗi bị BỎ QUA kèm cảnh báo và làm
   * catalog thành KHÔNG ghi nhớ được; nhà cung cấp trả `undefined` bị bỏ qua mà không đổi cờ.
   * Nhận: lớp cần liệt kê và tuỳ chọn nhìn (chuyển NGUYÊN VĂN cho nhà cung cấp).
   * Trả: ứng viên CHƯA khử trùng + cờ được phép ghi nhớ.
   */
  private async listLayerCandidates(
    layer: SkillLayer,
    options: SkillViewOptions,
  ): Promise<{ entries: IndexedCandidate[]; cacheable: boolean }> {
    throwIfAborted(options.signal);
    const candidates: IndexedCandidate[] = [];
    let cacheable = true;
    let runtimeOrder = 0;
    for (const skill of [...layer.runtime.values()].sort((left, right) => compareCodePoints(left.name, right.name))) {
      candidates.push({
        candidate: runtimeCandidate(skill),
        provider: RUNTIME_SKILL_PROVIDER,
        providerOrder: -1,
        localOrder: runtimeOrder,
        layer,
      });
      runtimeOrder += 1;
    }
    for (const { provider, order } of [...layer.providers.values()]) {
      let localOrder = 0;
      let output: readonly SkillCandidate[] | SkillProviderObservation | undefined;
      try {
        output = await waitWithAbort(provider.list(options), options.signal);
      } catch (error) {
        if (options.signal?.aborted === true) throw toError(options.signal.reason);
        cacheable = false;
        this.ctx.logger.warn(`skill provider "${provider.name}" skipped: ${errorMessage(error)}`);
      }
      if (output === undefined) continue;
      const observation = normalizeProviderObservation(output, provider.name);
      if (!observation.complete) cacheable = false;
      for (const candidate of observation.candidates) {
        validateCandidate(candidate, provider.name);
        candidates.push({ candidate, provider, providerOrder: order, localOrder, layer });
        localOrder += 1;
      }
    }
    return { entries: candidates, cacheable };
  }

  /**
   * Làm mới TOÀN BỘ catalog: tăng bản sửa đổi, xoá cache, rồi báo người quan sát.
   * Nhận: không.
   * Trả: không.
   */
  private invalidateCache(): void {
    this.revision += 1;
    this.collectCache.clear();
    this.notifyChange();
  }

  /**
   * Làm mới sau một lượt nạp định nghĩa đã cũ — chỉ khi ĐÚNG lượt đăng ký đã sinh mục này còn sống.
   * Nhận: mục đã thắng (mang lớp + nhà cung cấp của nó).
   * Trả: không.
   */
  private invalidateEntry(entry: IndexedCandidate): void {
    if (entry.layer.providers.get(entry.provider.name)?.provider === entry.provider) this.invalidateCache();
  }

  /**
   * Đọc (hoặc cấp mới) danh tính ổn định cho một khoá phạm vi, để khoá cache không phụ thuộc
   * việc vật thể có `toString` ổn định hay không.
   * Nhận: khoá phạm vi mờ (so bằng danh tính).
   * Trả: số định danh ổn định trong tiến trình.
   */
  private scopeId(key: ScopeKey): number {
    let id = this.scopeIds.get(key);
    if (id === undefined) {
      id = this.nextScopeId;
      this.nextScopeId += 1;
      this.scopeIds.set(key, id);
    }
    return id;
  }

  /**
   * Dựng khoá cache cho một lượt đọc.
   * Nhận: cwd của lượt đọc, chuỗi phạm vi đang nhìn, và bản sửa đổi catalog hiện tại.
   * Trả: chuỗi JSON ổn định — `cwd` vắng thì khoá đó vắng hẳn khỏi chuỗi (y bản gốc).
   */
  private collectCacheKey(cwd: string | undefined, chain: ScopeKey[], revision: number): string {
    return JSON.stringify({ cwd, scopes: chain.map((key) => this.scopeId(key)), revision });
  }

  /**
   * Báo cho người quan sát catalog mà KHÔNG để việc làm mới của họ thành gánh nặng.
   * Nhận: không.
   * Trả: không; người nghe ném đồng bộ hay từ chối bất đồng bộ đều bị cô định kèm một dòng cảnh báo.
   */
  private notifyChange(): void {
    for (const callback of this.ctx.events.dispatch("emit", ["skills/change"])) {
      try {
        const returned: unknown = callback();
        Promise.resolve(returned).catch((error: unknown) => {
          this.ctx.logger.warn(`skills/change listener rejected: ${errorMessage(error)}`);
        });
      } catch (error) {
        this.ctx.logger.warn(`skills/change listener threw: ${errorMessage(error)}`);
      }
    }
  }
}
