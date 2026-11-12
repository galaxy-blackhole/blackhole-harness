/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào row agent-preset-registry: sổ preset agent khai bằng YAML + sửa qua profile, service Remote
 *      `agentPresets` (list · read · select), mount revision vào scope riêng cho từng Agent chọn preset.
 *      Port 1:1 class `AgentPresetRegistry` của @deepseek-ai/dsh-agent-preset-registry.
 */

import { createRequire } from "node:module";

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { entryListSchema } from "@deepseek-ai/cordis-plugin-include";
import { bindScopeParent, createScope, scopeOf, scopeParentOf } from "@deepseek-ai/dsh-scope";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { activeCompositionModules, definitionComposition, mountedCompositionRows } from "./composition-inventory.ts";
import { entryListProblem } from "./definition.ts";
import { auditRows, leakedServices, mountPreset, redirectPluginNames, serviceForMount } from "./mount.ts";
import { agentPresetProjectionDefinition } from "./session.ts";

import type { AgentPresetInspection, CompositionRow, MountedTree, PresetDefinition, PresetMount, PresetRow, RegistryContext } from "./types.ts";

/** `require` CJS của tiến trình — dùng để nạp `js-yaml` (kernel không cài @types/js-yaml). */
const requireCjs = createRequire(import.meta.url);

/** Tuỳ chọn của phép dump YAML mà row này truyền (đúng tập gốc dùng). */
interface DumpOptions {
  /** Schema entry-list của Loader. */
  readonly schema?: unknown;
  /** Không phát anchor/alias. */
  readonly noRefs?: boolean;
  /** Bề rộng dòng (-1 = không ngắt). */
  readonly lineWidth?: number;
}

/** `dump` của js-yaml, nạp CJS với kiểu tối thiểu (không cần ambient module). */
const yaml = requireCjs("js-yaml") as { dump(value: unknown, options?: DumpOptions): string };

export { agentPresetProjectionDefinition } from "./session.ts";
export { entryListProblem } from "./definition.ts";
export { auditRows, leakedServices };
// task-173: gói agent-preset dùng lại ĐÚNG bản đồ/rewrite nested qua **method dịch vụ** `redirectNestedNames`
// (không chép logic, không lệch hành vi). KHÔNG export thêm hàm ở đây: bề mặt export của gói phải KHỚP bản gốc
// (6 tên) — ca test "01 · export surface" canh đúng điều đó, và thêm 1 tên là phá parity (20/10/2026).

/** Cấu hình của registry: preset mặc định + preset đã chọn (bộ nhớ tạm, không bền). */
export interface Config {
  /** Preset mặc định cho phiên mới. */
  readonly default: string;
  /** Preset đang được chọn (volatile — chỉ trong bộ nhớ tiến trình). */
  readonly selectedDefault?: { get(): string | undefined };
}

/** Một revision đang sống mà các Agent chọn cùng preset giữ chung. */
interface Generation {
  /** Scope sở hữu cây preset. */
  readonly scope: { readonly ctx: RegistryContext; dispose(): Promise<void> };
  /** Khoá scope (định danh vật thể). */
  readonly key: object;
  /** Revision đã mount. */
  readonly mount: PresetMount;
  /** Số Agent đang giữ revision. */
  users: number;
  /** `true` khi không còn được roster dùng. */
  retired: boolean;
}

/** Một định nghĩa đã đăng ký. */
interface Record_ {
  /** Định nghĩa preset. */
  readonly config: PresetDefinition;
  /** Context khai báo (mang baseUrl). */
  readonly context: { readonly baseUrl?: string };
  /** Promise activate (settle sau khi mount xong/hỏng). */
  ready: Promise<void>;
  /** Revision đang sống, nếu activate thành công. */
  generation?: Generation;
  /** Chẩn đoán khi activate hỏng. */
  broken?: string;
}

/** Liên kết một Agent (scope) với revision nó đã join. */
interface Binding {
  /** Công cụ đổi parent của scope. */
  readonly parent: { rebind(parent: object): void };
  /** Revision đang giữ. */
  generation: Generation;
}

/** Sổ chiếu phiên nhìn theo CẤU TRÚC. */
interface ProjectionsSeam {
  /** Đăng ký một định nghĩa chiếu. */
  register(definition: unknown): unknown;
  /** Đọc trạng thái chiếu cho một phiên. */
  stateOf(session: unknown, key: string): unknown;
}

/**
 * Dựng `RemoteError` đúng mã/thông điệp/chi tiết của bản gốc (một lần ép kiểu ở biên kiểu của kernel).
 * Nhận: code — mã lỗi; message — thông điệp; details — chi tiết kèm theo.
 * Trả: lỗi Remote đã dựng.
 */
function remoteError(code: string, message: string, details?: Record<string, unknown>): Error {
  return new RemoteError(code as never, message, details as never);
}

/**
 * Mô tả MỘT context KHÔNG mang khoá scope, để thông điệp lỗi tự chẩn đoán (08/11/2026 — P0 "prompt không chạy":
 * `scopeOf` trả undefined nhưng không nói vì sao; hai module `scope` khác nhau cho hai Symbol khác nhau, còn
 * "chưa từng tạo scope" là chuyện khác hẳn — cần phân biệt được ngay trong log).
 * Nhận: ctx — giá trị bất kỳ được coi là context. Trả: chuỗi "
  ctx: …" hoặc "" khi không đọc được.
 */
function describeUnscoped(ctx: unknown): string {
  if (typeof ctx !== "object" || ctx === null) return " (ctx: " + typeof ctx + ")";
  let moTa = "";
  try {
    const symbols = Object.getOwnPropertySymbols(ctx).map(String).join(",");
    const keys = Object.keys(ctx).slice(0, 6).join(",");
    const fiber = (ctx as { fiber?: { ctx?: unknown } }).fiber;
    const fiberCtx = fiber?.ctx;
    moTa =
      " (ctx: symbols=[" + symbols + "] keys=[" + keys + "]"
      + " fiberCtx===ctx: " + String(fiberCtx === ctx)
      + " fiberCtxSymbols: [" + (typeof fiberCtx === "object" && fiberCtx !== null ? Object.getOwnPropertySymbols(fiberCtx).map(String).join(",") : "-") + "])";
  } catch {
    moTa = " (ctx: khong doc duoc symbol/keys)";
  }
  return moTa;
}

/** Registry preset agent khai bằng YAML và các revision Agent đang giữ. */
export class AgentPresetRegistry extends TypertRemoteService {

  /**
   * Đổi tên plugin con của một preset từ id stock sang id GBH (mọi độ sâu, kể cả group lồng) — dịch vụ cho
   * row preset ghi lại cây config (task-173). Fail-soft, idempotent; kernel stock không có hàm này.
   * Nhận: plugins — danh sách entry preset. Trả: danh sách đã đổi.
   */
  redirectNestedNames(plugins: readonly unknown[]): unknown[] {
    return redirectPluginNames(plugins);
  }
  /** Service bắt buộc: Loader (chờ cây) + sổ chiếu phiên (đọc agentPreset/turnBoundary). */
  static inject = ["loader", "sessionProjections"];

  /** Cấu hình: preset mặc định + preset đã chọn. */
  static Config = z.object({
    default: z.string().required(),
    selectedDefault: z.string().volatile(),
  });

  /** Cấu hình đã validate của lượt chạy này. */
  readonly config: Config;

  /** Context sở hữu registry. */
  private readonly owner: RegistryContext;

  /** Định nghĩa theo id. */
  private readonly definitions = new Map<string, Record_>();

  /** Revision đang giữ theo khoá scope. */
  private readonly generations = new Map<object, Generation>();

  /** Liên kết Agent → revision. */
  private readonly bindings = new WeakMap<object, Binding>();

  /** Hàng đợi tuần tự cho lượt chọn preset theo Agent. */
  private readonly switches = new Map<string, Promise<unknown>>();

  /**
   * Đăng ký service `agentPresets` và nối projection + settings + event chọn preset.
   * Nhận: ctx — context cordis của row; config — cấu hình đã validate.
   * Trả: không.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "agentPresets");
    this.config = config;
    this.owner = ctx as unknown as RegistryContext;
    const cordis = ctx as unknown as {
      readonly sessionProjections: ProjectionsSeam;
      inject(names: readonly string[], callback: (child: unknown) => void): unknown;
      on(event: string, listener: (...args: never[]) => unknown): () => void;
      emit(event: string, ...args: never[]): void;
    };
    cordis.sessionProjections.register(agentPresetProjectionDefinition);
    cordis.inject(["settings"], (child) => {
      const scoped = child as unknown as RegistryContext & { settings: { configure(options: { auto: boolean }, fiber: unknown): unknown } };
      scoped.effect(() => scoped.settings.configure({ auto: false }, ctx.fiber) as unknown as () => unknown);
    });
    cordis.on("session/event", (...args: never[]) => {
      const sessionLike = args[0] as unknown as { readonly id: string };
      const eventLike = args[1] as unknown as { readonly type: string; readonly data?: { readonly agentPreset?: string } };
      if (eventLike.type === "agent-preset/selected") {
        cordis.emit("agent-preset/selected", sessionLike.id as never, eventLike.data?.agentPreset as never);
      }
    });
  }

  /** Preset mặc định cho phiên được tạo tiếp theo. */
  get defaultId(): string {
    return this.config.selectedDefault?.get() ?? this.config.default;
  }

  /**
   * Đăng ký và nạp NGAY một định nghĩa; lỗi activate vẫn hiện trong roster.
   * Nhận: definition — cấu hình đã parse do plugin khai báo.
   * Trả: hàm dọn định nghĩa (plugin khai báo sở hữu).
   */
  async register(definition: PresetDefinition): Promise<() => Promise<void>> {
    const context = this.owner;
    if (!definition.id.trim()) throw new Error("Preset id must not be empty");
    if (this.definitions.has(definition.id)) throw new Error("Duplicate agent preset: " + definition.id);
    const record: Record_ = { config: definition, context, ready: Promise.resolve() };
    this.definitions.set(definition.id, record);
    let disposed = false;
    const unregister = async (): Promise<void> => {
      if (disposed) return;
      disposed = true;
      this.definitions.delete(definition.id);
      await record.ready;
      if (record.generation !== undefined) {
        record.generation.retired = true;
        await this.collect(record.generation);
      }
    };
    record.ready = this.activate(record);
    await record.ready;
    return unregister;
  }

  /**
   * Mount một định nghĩa thành revision dưới scope riêng; lỗi được ghi vào `broken`.
   * Nhận: record — định nghĩa cần activate.
   * Trả: không.
   */
  private async activate(record: Record_): Promise<void> {
    const key = {};
    const scope = createScope(this.owner as never, key);
    try {
      const problem = entryListProblem(record.config.plugins);
      if (problem !== undefined) throw new Error(problem);
      const context = scope.ctx.extend({ baseUrl: record.context.baseUrl });
      const generation: Generation = {
        scope: scope as unknown as Generation["scope"],
        key,
        mount: await mountPreset(context, record.config.id, record.config.plugins),
        users: 0,
        retired: false,
      };
      context.effect(() => {
        this.generations.set(key, generation);
        return () => {
          this.generations.delete(key);
        };
      }, "agent-preset.mount");
      record.generation = generation;
    } catch (error) {
      record.broken = error instanceof Error ? error.message : String(error);
      this.owner.logger.warn("agent preset " + record.config.id + ": " + record.broken);
      await scope.dispose();
    }
  }

  /**
   * Chẩn đoán activate hiện tại của một định nghĩa.
   * Nhận: record — định nghĩa cần audit.
   * Trả: mỗi hàng không dùng được một dòng, hoặc undefined khi định nghĩa dùng được.
   */
  private async diagnostic(record: Record_): Promise<string | undefined> {
    await record.ready;
    if (record.generation === undefined) return record.broken;
    const tree = record.generation.mount.tree;
    let audit = await auditRows(tree as MountedTree);
    if (audit.pending.length > 0) {
      await this.owner.loader.await();
      audit = await auditRows(tree as MountedTree);
    }
    const lines = [...audit.failed, ...audit.pending];
    return lines.length === 0 ? undefined : lines.join("\n");
  }

  /**
   * Dọn MỘT revision khi đã ngừng dùng và không còn Agent giữ.
   * Nhận: generation — revision cần dọn.
   * Trả: không.
   */
  private async collect(generation: Generation): Promise<void> {
    if (!generation.retired || generation.users !== 0) return;
    this.generations.delete(generation.key);
    await generation.scope.dispose();
  }

  /**
   * Tìm revision mà context Agent đã join (qua scope parent).
   * Nhận: ctx — context Agent.
   * Trả: revision đang giữ, hoặc undefined.
   */
  private generationFor(ctx: unknown): Generation | undefined {
    const key = scopeOf(ctx as never);
    const parent = key === undefined ? undefined : scopeParentOf(key);
    return parent === undefined ? undefined : this.generations.get(parent);
  }

  /**
   * Soi các revision đang giữ, hoặc ĐÚNG revision một Agent đã join.
   * Nhận: ctx — context Agent tuỳ chọn (bỏ trống = mọi revision).
   * Trả: module đang hoạt động + chẩn đoán isolate; không khớp trả danh sách rỗng.
   */
  inspectCompositions(ctx?: unknown): AgentPresetInspection[] {
    const joined = ctx === undefined ? undefined : this.generationFor(ctx);
    return (ctx === undefined ? [...this.generations.values()] : joined === undefined ? [] : [joined]).map(({ mount }) => ({
      id: mount.presetId,
      modules: activeCompositionModules(mount.tree),
      leakedServices: leakedServices(this.owner, mount.fiber),
    }));
  }

  /**
   * Đọc MỌI preset đã khai, kể cả preset activate hỏng.
   * Nhận: không.
   * Trả: metadata hiển thị + chẩn đoán nạp, đã sắp theo order rồi id.
   */
  async list(): Promise<PresetRow[]> {
    const rows = await Promise.all(
      [...this.definitions.values()].map(async (record): Promise<PresetRow> => {
        const broken = await this.diagnostic(record);
        return {
          id: record.config.id,
          ...(record.config.name === undefined ? {} : { name: record.config.name }),
          ...(record.config.description === undefined ? {} : { description: record.config.description }),
          ...(record.config.order === undefined ? {} : { order: record.config.order }),
          ...(broken === undefined ? {} : { broken }),
        };
      }),
    );
    return rows.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.id.localeCompare(b.id));
  }

  /**
   * Đọc roster chọn preset (endpoint Remote `list`).
   * Nhận: không.
   * Trả: các preset hiện có, mỗi hàng đánh dấu khi là mặc định.
   */
  @Remote("list")
  async remoteExportList(): Promise<{ readonly presets: PresetRow[] }> {
    const defaultId = this.defaultId;
    return { presets: (await this.list()).map((row) => ({ ...row, isDefault: row.id === defaultId })) };
  }

  /**
   * Phân giải một danh tính preset mà KHÔNG dựng Agent.
   * Nhận: id — preset yêu cầu, hoặc bỏ trống để lấy mặc định.
   * Trả: metadata hiện tại, kèm lỗi khi activate hỏng.
   */
  async resolve(id?: string): Promise<{ readonly id: string; readonly broken?: string }> {
    const wanted = id ?? this.defaultId;
    const record = this.definitions.get(wanted);
    if (record === undefined) {
      throw remoteError("agent-preset/not-found", "Unknown agent preset: " + wanted, {
        agentPreset: wanted,
        available: [...this.definitions.keys()],
      });
    }
    const broken = await this.diagnostic(record);
    return { id: wanted, ...(broken === undefined ? {} : { broken }) };
  }

  /**
   * Đọc danh sách plugin con của một khai báo dưới dạng YAML (chỉ để xem) — endpoint Remote `read`.
   * Nhận: agentPreset — danh tính preset.
   * Trả: composition đã khai kèm metadata đã công bố.
   */
  @Remote("read")
  readDocument(agentPreset: string): Promise<{ readonly agentPreset: string; readonly content: string; readonly name?: string; readonly description?: string }> {
    const record = this.definitions.get(agentPreset);
    if (record === undefined) {
      return Promise.reject(
        remoteError("agent-preset/not-found", "Unknown agent preset: " + agentPreset, {
          agentPreset,
          available: [...this.definitions.keys()],
        }),
      );
    }
    const { id, name, description, plugins } = record.config;
    const content = yaml.dump(plugins, { schema: entryListSchema, noRefs: true, lineWidth: -1 });
    return Promise.resolve({
      agentPreset: id,
      content,
      ...(name === undefined ? {} : { name }),
      ...(description === undefined ? {} : { description }),
    });
  }

  /**
   * Giữ MỘT revision cho một Agent sắp bind.
   * Nhận: id — preset yêu cầu, hoặc bỏ trống để lấy mặc định.
   * Trả: revision đã tăng bộ đếm users.
   */
  private async retain(id?: string): Promise<Generation> {
    const wanted = id ?? this.defaultId;
    while (true) {
      const record = this.definitions.get(wanted);
      if (record === undefined) {
        throw remoteError("agent-preset/not-found", "Unknown agent preset: " + wanted, {
          agentPreset: wanted,
          available: [...this.definitions.keys()],
        });
      }
      const broken = await this.diagnostic(record);
      if (this.definitions.get(wanted) !== record) continue;
      const generation = record.generation;
      if (broken !== undefined || generation === undefined) {
        throw remoteError("agent-preset/invalid", broken as never, { agentPreset: wanted, reason: broken });
      }
      generation.users++;
      return generation;
    }
  }

  /**
   * Bind một Agent vào revision ĐÃ GIỮ (hoặc đổi revision cũ sang mới).
   * Nhận: ctx — context Agent; generation — revision đích.
   * Trả: không.
   */
  private async bind(ctx: unknown, generation: Generation): Promise<void> {
    const key = scopeOf(ctx as never);
    if (key === undefined) throw new Error("Agent preset binding requires a scoped context" + describeUnscoped(ctx));
    const binding = this.bindings.get(key);
    if (binding?.generation === generation) return;
    if (binding !== undefined) {
      binding.parent.rebind(generation.key);
      const old = binding.generation;
      generation.users++;
      binding.generation = generation;
      old.users--;
      await this.collect(old);
    } else {
      this.join(ctx, key, generation);
    }
  }

  /**
   * Join MỘT Agent (scope) vào revision: gắn parent scope và dọn khi scope chết.
   * Nhận: ctx — context Agent; key — khoá scope của Agent; generation — revision đích.
   * Trả: không.
   */
  private join(ctx: unknown, key: object, generation: Generation): void {
    const agentContext = ctx as unknown as RegistryContext;
    const binding: Binding = { parent: bindScopeParent(key, generation.key), generation };
    generation.users++;
    this.bindings.set(key, binding);
    agentContext.effect(
      () => async () => {
        this.bindings.delete(key);
        binding.generation.users--;
        await this.collect(binding.generation);
      },
      "agent-preset.binding",
    );
  }

  /**
   * Bind một Agent CHƯA công bố vào revision hiện tại của preset.
   * Nhận: ctx — context Agent từ callback setup; id — preset yêu cầu hoặc bỏ trống.
   * Trả: danh tính preset đã bind.
   */
  async mount(ctx: unknown, id?: string): Promise<{ readonly id: string }> {
    const generation = await this.retain(id);
    try {
      await this.bind(ctx, generation);
      return { id: generation.mount.presetId };
    } finally {
      generation.users--;
      await this.collect(generation);
    }
  }

  /**
   * Cho Agent CON join ĐÚNG revision mà Agent CHA đang giữ.
   * Nhận: ctx — context Agent con; parent — context Agent cha.
   * Trả: preset thừa kế, hoặc undefined trong composition không có preset.
   */
  composeFrom(ctx: unknown, parent: unknown): string | undefined {
    const generation = this.generationFor(parent);
    if (generation === undefined) {
      const parentRegistry = (parent as { get(name: string): { composedPreset(ctx: unknown): string | undefined } | undefined }).get("agentPresets");
      if (parentRegistry?.composedPreset(parent) !== undefined) throw new Error("Parent preset revision is unavailable");
      return undefined;
    }
    const key = scopeOf(ctx as never);
    if (key === undefined) throw new Error("Child preset binding requires a scope" + describeUnscoped(ctx));
    if (this.bindings.has(key)) throw new Error("Child already joined a preset");
    this.join(ctx, key, generation);
    return generation.mount.presetId;
  }

  /**
   * Đọc preset mà một Agent ĐANG SỐNG dùng.
   * Nhận: ctx — context Agent.
   * Trả: danh tính preset nếu đã bind.
   */
  composedPreset(ctx: unknown): string | undefined {
    return this.generationFor(ctx)?.mount.presetId;
  }

  /**
   * Đọc một service được cấp TRONG nhóm preset isolate của Agent.
   * Nhận: agent — Agent cần hỏi composition; name — tên service cordis.
   * Trả: service, hoặc undefined.
   */
  serviceFor(agent: { readonly ctx: unknown }, name: string): unknown {
    const mount = this.generationFor(agent.ctx)?.mount;
    return mount === undefined ? undefined : serviceForMount(this.owner, mount, name);
  }

  /**
   * Bind lại một Agent TRỐNG sang preset khác (người gọi tự kiểm điều kiện phiên trống).
   * Nhận: ctx — context Agent; id — preset đích.
   * Trả: danh tính đã bind.
   */
  async recompose(ctx: unknown, id: string): Promise<{ readonly id: string }> {
    const preset = await this.mount(ctx, id);
    try {
      this.owner.emit("tools/change");
    } catch (error) {
      this.owner.logger.warn("Preset tools observer: " + String(error));
    }
    return preset;
  }

  /**
   * Chọn preset TRƯỚC khi phiên bắt đầu lượt đầu tiên — endpoint Remote `select`.
   * Nhận: agent — Agent đích; agentPreset — danh tính yêu cầu.
   * Trả: danh tính preset đã chốt.
   */
  @Remote("select")
  async select(agent: { readonly id: string; readonly session: unknown; readonly ctx: unknown }, agentPreset: string): Promise<string> {
    const turn = (this.switches.get(agent.id) ?? Promise.resolve()).then(async (): Promise<string> => {
      const projections = (this.owner as unknown as { readonly sessionProjections: ProjectionsSeam }).sessionProjections;
      const boundary = projections.stateOf(agent.session, "turnBoundary") as { readonly openTurnStartSeq: unknown; readonly lastTurn: number } | undefined;
      if (boundary !== undefined && (boundary.openTurnStartSeq !== null || boundary.lastTurn > 0)) {
        throw remoteError("agent-preset/locked", "This session has already started", { sessionId: agent.id, agentPreset });
      }
      const current = this.definitions.get(agentPreset)?.generation;
      if (current !== undefined && this.generationFor(agent.ctx) === current && projections.stateOf(agent.session, "agentPreset") === agentPreset) {
        return agentPreset;
      }
      const preset = await this.recompose(agent.ctx, agentPreset);
      (agent.session as { append(type: string, data: unknown): void }).append("agent-preset/selected", { agentPreset: preset.id });
      return preset.id;
    });
    const guard = turn.catch(() => undefined);
    this.switches.set(agent.id, guard);
    try {
      return await turn;
    } finally {
      if (this.switches.get(agent.id) === guard) this.switches.delete(agent.id);
    }
  }

  /**
   * Đọc đăng ký hiện tại cho phần trình bày transcript lạnh.
   * Nhận: id — preset yêu cầu hoặc bỏ trống.
   * Trả: lease revision; dọn sau khi lượt đọc theo scope xong.
   */
  async acquireScope(id?: string): Promise<{ readonly key: object; [Symbol.asyncDispose](): Promise<void> }> {
    const generation = await this.retain(id);
    let disposed = false;
    return {
      key: generation.key,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        if (disposed) return;
        disposed = true;
        generation.users--;
        await this.collect(generation);
      },
    };
  }

  /**
   * Đọc hàng plugin mà KHÔNG dựng Agent (dùng cho plugin inventory).
   * Nhận: không.
   * Trả: metadata khai báo hiện tại + trạng thái activate.
   */
  compositionInventory(): Promise<readonly Record<string, unknown>[]> {
    return Promise.all(
      [...this.definitions.values()].map(async (record) => {
        const { id, name, description } = record.config;
        const broken = await this.diagnostic(record);
        const read = definitionComposition(record.config.plugins, () => {
          throw new Error("Inactive definition");
        });
        return {
          id,
          ...(name === undefined ? {} : { name }),
          ...(description === undefined ? {} : { description }),
          isDefault: id === this.defaultId,
          ...(broken === undefined ? {} : { broken }),
          rows:
            record.generation === undefined
              ? "rows" in read
                ? (read.rows as CompositionRow[])
                : []
              : mountedCompositionRows(record.generation.mount.tree),
        };
      }),
    );
  }
}

export default AgentPresetRegistry;