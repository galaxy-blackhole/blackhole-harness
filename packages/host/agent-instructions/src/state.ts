/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Trạng thái chỉ dẫn workspace nhìn từ phiên và phép đối soát động — port 1:1 vùng state
 *      (stock lib/index.js 872–1183 = region lib/types/state.js) của @deepseek-ai/dsh-agent-instructions.
 */
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { FileSystem, FsVersion } from "@deepseek-ai/dsh-fs";
import { type Message, createUserMessage, type UserMessage } from "@deepseek-ai/dsh-llm";
import type { Session } from "@deepseek-ai/dsh-session";
import type { ResolvedConfig } from "./config.ts";
import { instructionContentSha1, trimmedInstructionDigest } from "./digest.ts";
import {
  ancestorChain,
  descendantDirsBetween,
  findProjectRoot,
  probeScopeInstruction,
  readScopeInstruction,
  relativeDisplay,
  scopeInstructionFile,
  type LoadedInstructionFile,
} from "./files.ts";
import {
  USER_GLOBAL_DIRECTORIES,
  USER_GLOBAL_FILE,
  candidateScopeKey,
  decodeScopeKey,
  instructionCandidateGroup,
  instructionScopeKey,
  isUserGlobalDirectory,
  renderInstructionChanges,
  type AgentInstructionChange,
  type ChangeRenderItem,
} from "./render.ts";

/** Tên module/plugin của row, dùng làm `kind` nguồn tin nhắn (stock state.js:878). */
export const name = "agent-instructions";

/** Sự thật bền vững về nhà sản xuất, tệp và phép đối soát của MỘT ngữ cảnh workspace (stock state.d.ts:14–24). */
export interface AgentInstructionSource {
  /** Nhà sản xuất của nguồn tin nhắn. */
  kind: "agent-instructions";
  /** Mọi ngữ cảnh workspace đều mang chỉ dẫn đọc từ tệp (dạng ngữ cảnh `instructions`). */
  form: "instructions";
  /** Đánh dấu baseline khởi động/khôi phục HOÀN CHỈNH thay vì một delta muộn hơn. */
  baseline?: true;
  /** Định danh dò, ưu tiên và ngân sách dùng để kiểm tra một baseline khôi phục. */
  baselineIdentity?: string;
  /** Các chuyển trạng thái mà nguồn này mô tả. */
  changes: AgentInstructionChange[];
}

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /** Ngữ cảnh chỉ dẫn workspace do row này sản xuất. */
    "agent-instructions": AgentInstructionSource;
  }
}

/** Bộ nhớ đệm siêu dữ liệu theo phạm vi; văn bản chỉ dẫn CỐ Ý không được giữ lại (stock state.d.ts:30–40). */
export interface InstructionVersionState {
  /** Đường dẫn hiển thị của tệp. */
  path: string;
  /** Dấu tươi của provider. */
  version: FsVersion;
  /** Digest nội dung chính xác. */
  digest: string;
  /**
   * Định danh nội dung sau trim (trimmedInstructionDigest), dùng để chặn bản trùng trong nhóm ứng viên
   * ngay trên đường nhanh siêu dữ liệu mà không phải đọc lại tệp anh em.
   */
  trimmedDigest: string;
}

/** Trạng thái đường nhanh, CÔ LẬP theo phiên, khoá theo phạm vi chỉ dẫn lô-gic (stock state.d.ts:41–42). */
export type InstructionVersionCache = WeakMap<Session, Map<string, InstructionVersionState>>;

/** Một chuyển trạng thái của bộ nhớ đệm siêu dữ liệu gắn với một chuyển chỉ dẫn đã kết xuất (stock state.d.ts:43–48). */
export interface InstructionVersionUpdate {
  /** Chuyển chỉ dẫn tương ứng. */
  change: AgentInstructionChange;
  /** Thông báo xoá do trùng nội dung vẫn có thể giữ siêu dữ liệu cho tệp còn tồn tại của nó. */
  state?: InstructionVersionState;
}

/** Bản đối soát đã kết xuất cùng các chuyển trạng thái bộ nhớ đệm của nó (stock state.d.ts:49–53). */
export interface ReconciledInstructionContext {
  /** Ngữ cảnh người-dùng hoàn chỉnh sẽ vào hộp thư. */
  context: UserMessage;
  /** Các chuyển bộ nhớ đệm cần áp SAU khi kết xuất. */
  versionUpdates: InstructionVersionUpdate[];
}

/**
 * Dựng tin nhắn vai người-dùng mang một lô chuyển chỉ dẫn đã kết xuất.
 * Nhận: text — văn bản system-reminder hoàn chỉnh của plugin; changes — các chuyển trạng thái đi kèm.
 * Trả: tin nhắn vai người-dùng (stock state.js:879–891).
 */
function agentInstructionsHook(text: string, changes: AgentInstructionChange[]): UserMessage {
  return createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: "agent-instructions", form: "instructions", changes },
  });
}

/**
 * Dựng tin nhắn vai người-dùng cho một baseline đã kết xuất.
 * Nhận: text — văn bản system-reminder hoàn chỉnh của plugin.
 * Trả: tin nhắn vai người-dùng làm tiền tố (stock state.js:897–909).
 */
export function agentInstructionsMessage(text: string): Message {
  return createUserMessage({
    content: [{ type: "text", text }],
    source: { kind: name, form: "instructions", changes: [] },
  });
}

/**
 * Nhận ra nguồn tin nhắn do row này sản xuất, kể cả dữ liệu bền vững chưa được kiểm.
 * Nhận: source — giá trị nguồn bất kỳ đọc từ sự kiện hay tin nhắn.
 * Trả: true khi nguồn là chỉ dẫn workspace có mảng `changes` (stock state.js:910–912).
 */
function isAgentInstructionsSource(source: unknown): source is AgentInstructionSource {
  return (
    typeof source === "object" &&
    source !== null &&
    "kind" in source &&
    source.kind === "agent-instructions" &&
    "changes" in source &&
    Array.isArray(source.changes)
  );
}

/**
 * Nhận ra một object thường (không phải mảng) để kiểm từng trường.
 * Nhận: value — giá trị bất kỳ.
 * Trả: true khi là object không phải mảng (stock state.js:913–915).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Nhận ra một hành động chuyển chỉ dẫn hợp lệ.
 * Nhận: value — giá trị bất kỳ đọc từ dữ liệu bền vững.
 * Trả: true khi là `set`, `replace` hoặc `remove` (stock state.js:920).
 */
function isInstructionAction(value: unknown): value is AgentInstructionChange["action"] {
  return value === "set" || value === "replace" || value === "remove";
}

/**
 * Lọc dữ liệu bền vững thành danh sách chuyển trạng thái hợp lệ.
 * Nhận: source — nguồn chỉ dẫn workspace (mảng `changes` có thể chứa giá trị hỏng).
 * Trả: các chuyển trạng thái đúng hình dạng, giữ nguyên thứ tự (stock state.js:916–931).
 */
function workspaceInstructionChanges(source: AgentInstructionSource): AgentInstructionChange[] {
  const changes: AgentInstructionChange[] = [];
  const rawChanges: readonly unknown[] = source.changes;
  for (const value of rawChanges) {
    if (!isRecord(value)) continue;
    if (!isInstructionAction(value.action)) continue;
    const scope = value.scope;
    if (typeof scope !== "string") continue;
    const path = value.path;
    if (typeof path !== "string") continue;
    const digest = value.digest;
    if (digest !== undefined && typeof digest !== "string") continue;
    changes.push({ action: value.action, scope, path, ...(digest === undefined ? {} : { digest }) });
  }
  return changes;
}

/**
 * So hai chuyển trạng thái có y hệt không.
 * Nhận: a — chuyển thứ nhất; b — chuyển thứ hai.
 * Trả: true khi hành động, phạm vi, đường dẫn và digest đều bằng nhau (stock state.js:932–934).
 */
function sameInstructionChange(a: AgentInstructionChange, b: AgentInstructionChange): boolean {
  return a.action === b.action && a.scope === b.scope && a.path === b.path && a.digest === b.digest;
}

/**
 * Gom chuyển trạng thái ĐANG HIỂN THỊ theo phạm vi: mặt phiên trước, rồi tới ngữ cảnh có thẩm quyền.
 * Nhận: agent — chủ phiên; authorityMessages — các tin nhắn đã được nhận vào lượt này.
 * Trả: bản đồ phạm vi → chuyển trạng thái mới nhất (stock state.js:935–948).
 */
function visibleInstructionChanges(
  agent: Agent,
  authorityMessages: readonly UserMessage[],
): Map<string, AgentInstructionChange> {
  const visible = new Map<string, AgentInstructionChange>();
  for (const seq of agent.session.surface.nodes) {
    const event = agent.session.eventAt(seq);
    if (event?.type !== "user/message" || !isAgentInstructionsSource(event.data.source)) continue;
    const changes = workspaceInstructionChanges(event.data.source);
    for (const change of changes) visible.set(change.scope, change);
  }
  for (const message of authorityMessages) {
    if (!isAgentInstructionsSource(message.source)) continue;
    for (const change of workspaceInstructionChanges(message.source)) visible.set(change.scope, change);
  }
  return visible;
}

/**
 * Đổi các tệp baseline được giữ thành trạng thái so sánh và trạng thái bộ nhớ đệm siêu dữ liệu.
 * Nhận: files — các tệp baseline sống sót qua bước kết xuất.
 * Trả: các chuyển baseline mới nhất và dấu tươi provider theo phạm vi lô-gic (stock state.js:954–977).
 */
export function baselineInstructionState(files: LoadedInstructionFile[]): {
  changes: Map<string, AgentInstructionChange>;
  versions: Map<string, InstructionVersionState>;
} {
  const changes = new Map<string, AgentInstructionChange>();
  const versions = new Map<string, InstructionVersionState>();
  for (const file of files) {
    const digest = instructionContentSha1(file.content);
    const change: AgentInstructionChange = {
      action: "set",
      scope: instructionScopeKey(file.displayPath),
      path: file.displayPath,
      digest,
    };
    changes.set(change.scope, change);
    if (file.version !== undefined)
      versions.set(change.scope, {
        path: file.displayPath,
        version: file.version,
        digest,
        trimmedDigest: trimmedInstructionDigest(file.content),
      });
  }
  return { changes, versions };
}

/**
 * Lấy (tạo nếu chưa có) bản đồ siêu dữ liệu của MỘT phiên.
 * Nhận: session — phiên sở hữu; cache — bộ nhớ đệm cô lập theo phiên.
 * Trả: bản đồ phạm vi → siêu dữ liệu của phiên (stock state.js:978–985).
 */
function versionStatesFor(session: Session, cache: InstructionVersionCache): Map<string, InstructionVersionState> {
  let states = cache.get(session);
  if (states === undefined) {
    states = new Map<string, InstructionVersionState>();
    cache.set(session, states);
  }
  return states;
}

/**
 * Giữ lại đúng những chuyển bộ nhớ đệm được một chuyển trạng thái ĐÃ KẾT XUẤT đại diện.
 * Nhận: updates — các chuyển đề xuất từ một hay nhiều lượt đối soát; renderedChanges — các chuyển mà
 *      bộ kết xuất thực sự giữ lại.
 * Trả: các chuyển có một chuyển đã giữ khớp CHÍNH XÁC (stock state.js:992–994).
 */
export function retainedInstructionVersionUpdates(
  updates: readonly InstructionVersionUpdate[],
  renderedChanges: readonly AgentInstructionChange[],
): InstructionVersionUpdate[] {
  return updates.filter((update) =>
    renderedChanges.some((change) => sameInstructionChange(update.change, change)),
  );
}

/**
 * Áp các chuyển bộ nhớ đệm siêu dữ liệu mà KHÔNG giữ văn bản chỉ dẫn.
 * Nhận: session — phiên sở hữu; updates — các chuyển set/delete theo thứ tự; cache — bộ nhớ đệm cô lập
 *      theo phiên.
 * Trả: không (stock state.js:1001–1007).
 */
export function applyInstructionVersionUpdates(
  session: Session,
  updates: readonly InstructionVersionUpdate[],
  cache: InstructionVersionCache,
): void {
  if (updates.length === 0) return;
  const states = versionStatesFor(session, cache);
  for (const update of updates)
    if (update.state === undefined) states.delete(update.change.scope);
    else states.set(update.change.scope, update.state);
  if (states.size === 0) cache.delete(session);
}

/**
 * Đổi một thư mục tuyệt đối thành phạm vi tương đối gốc dự án.
 * Nhận: projectRoot — gốc dự án; dir — thư mục tuyệt đối cần đổi.
 * Trả: phạm vi tương đối, hoặc `.` khi chính là gốc (stock state.js:1008–1011).
 */
function relativeScope(projectRoot: string, dir: string): string {
  const scope = relativeDisplay(projectRoot, dir);
  return scope.length === 0 ? "." : scope;
}

/**
 * So trạng thái đang hiển thị với các tệp provider nhìn thấy và kết xuất các chuyển trạng thái.
 * Nhận: agent — chủ phiên, mặt hiển thị của nó cấp trạng thái bền vững; resolved — cấu hình plugin đã
 *      chuẩn hoá; versionCache — siêu dữ liệu phạm vi theo phiên dùng để bỏ qua phép đọc không đổi;
 *      fileSystem — provider dùng cho phép dò hiện tại; options — ngữ cảnh có thẩm quyền đã nhận, gợi ý
 *      phạm vi đang chờ, đường dẫn bị chạm và việc tham gia baseline.
 * Trả: ngữ cảnh đã kết xuất kèm các chuyển bộ nhớ đệm hoãn lại, hoặc `undefined` khi không đổi/không
 * dò được (stock state.js:1021–1182).
 */
export async function reconcileInstructionContext(
  agent: Agent,
  resolved: ResolvedConfig,
  versionCache: InstructionVersionCache,
  fileSystem: FileSystem,
  options: {
    cwd: string;
    authorityMessages: readonly UserMessage[];
    scopeMessages: readonly UserMessage[];
    touchedPaths: readonly string[];
    includeBaselineScopes: boolean;
    excludedBaselineScopes?: ReadonlySet<string>;
    projectRoot?: string;
    signal?: AbortSignal;
  },
): Promise<ReconciledInstructionContext | undefined> {
  const session = agent.session;
  const effective = visibleInstructionChanges(agent, options.authorityMessages);
  const cwd = options.cwd;
  const projectRoot =
    options.projectRoot ?? (await findProjectRoot(cwd, resolved.projectRootMarkers, fileSystem, options.signal));
  const scopes = new Set<string>();
  const baselineScopes = new Set<string>();
  const addDirScopes = (target: Set<string>, directory: string): void => {
    for (const candidate of resolved.instructionFileCandidates) target.add(candidateScopeKey(directory, candidate));
    for (const candidate of resolved.localInstructionFileCandidates)
      target.add(candidateScopeKey(directory, candidate));
  };
  const addProjectScopes = (target: Set<string>, dir: string): void => {
    addDirScopes(target, relativeScope(projectRoot, dir));
  };
  for (const directory of USER_GLOBAL_DIRECTORIES) baselineScopes.add(candidateScopeKey(directory, USER_GLOBAL_FILE));
  for (const dir of ancestorChain(projectRoot, cwd)) addProjectScopes(baselineScopes, dir);
  if (options.includeBaselineScopes) for (const scope of baselineScopes) scopes.add(scope);
  for (const message of options.scopeMessages) {
    /* v8 ignore next -- plugin truyền hình chiếu đang chờ CHỈ thuộc workspace của nó. */
    if (!isAgentInstructionsSource(message.source)) continue;
    for (const change of workspaceInstructionChanges(message.source)) {
      if (!options.includeBaselineScopes && baselineScopes.has(change.scope)) continue;
      scopes.add(change.scope);
    }
  }
  for (const scope of effective.keys()) {
    if (!options.includeBaselineScopes && baselineScopes.has(scope)) continue;
    const { directory } = decodeScopeKey(scope);
    if (isUserGlobalDirectory(directory)) scopes.add(candidateScopeKey(directory, USER_GLOBAL_FILE));
    else addDirScopes(scopes, directory);
  }
  for (const touchedPath of options.touchedPaths)
    for (const dir of descendantDirsBetween(cwd, touchedPath)) addProjectScopes(scopes, dir);
  const versions = versionStatesFor(session, versionCache);
  const seenAbsolutePaths = new Set<string>();
  const keptTrimmedByGroup = new Map<string, Set<string>>();
  const hasKeptTrimmed = (group: string, digest: string): boolean =>
    keptTrimmedByGroup.get(group)?.has(digest) ?? false;
  const registerKeptTrimmed = (group: string, digest: string): boolean => {
    let digests = keptTrimmedByGroup.get(group);
    if (digests === undefined) {
      digests = new Set<string>();
      keptTrimmedByGroup.set(group, digests);
    }
    if (digests.has(digest)) return true;
    digests.add(digest);
    return false;
  };
  const items: ChangeRenderItem[] = [];
  const versionUpdates: InstructionVersionUpdate[] = [];
  const pushRemoval = (scope: string, path: string, state?: InstructionVersionState): void => {
    const change: AgentInstructionChange = { action: "remove", scope, path };
    items.push({ change, file: { absolutePath: `removed:${scope}`, displayPath: path, content: "" } });
    versionUpdates.push({ change, ...(state === undefined ? {} : { state }) });
  };
  const scopesByGroup = new Map<string, string[]>();
  for (const scope of scopes) {
    const { directory } = decodeScopeKey(scope);
    const group = instructionCandidateGroup(directory);
    const groupScopes = scopesByGroup.get(group);
    if (groupScopes === undefined) scopesByGroup.set(group, [scope]);
    else groupScopes.push(scope);
  }
  for (const [group, groupScopes] of scopesByGroup) {
    const probedScopes: string[] = [];
    for (const scope of groupScopes)
      if (
        options.excludedBaselineScopes !== undefined &&
        baselineScopes.has(scope) &&
        options.excludedBaselineScopes.has(scope)
      ) {
        const previous = effective.get(scope);
        if (previous === undefined || previous.action === "remove") versions.delete(scope);
        else pushRemoval(scope, previous.path);
      } else probedScopes.push(scope);
    const itemStart = items.length;
    const versionUpdateStart = versionUpdates.length;
    const priorVersions = new Map<string, InstructionVersionState | undefined>(
      probedScopes.map((scope): [string, InstructionVersionState | undefined] => [scope, versions.get(scope)]),
    );
    const rollbackGroup = (): void => {
      items.splice(itemStart);
      versionUpdates.splice(versionUpdateStart);
      for (const [candidateScope, prior] of priorVersions)
        if (prior === undefined) versions.delete(candidateScope);
        else versions.set(candidateScope, prior);
      for (const scope of probedScopes)
        seenAbsolutePaths.add(scopeInstructionFile(scope, projectRoot, resolved).absolutePath);
      keptTrimmedByGroup.delete(group);
    };
    for (const scope of probedScopes) {
      const previous = effective.get(scope);
      const probe = await probeScopeInstruction(scope, projectRoot, resolved, fileSystem, options.signal);
      if (probe.kind === "unavailable") {
        rollbackGroup();
        break;
      }
      if (probe.kind === "absent") {
        if (previous === undefined || previous.action === "remove") versions.delete(scope);
        else pushRemoval(scope, previous.path);
        continue;
      }
      const { file: probedFile } = probe;
      if (seenAbsolutePaths.has(probedFile.absolutePath)) continue;
      seenAbsolutePaths.add(probedFile.absolutePath);
      const cached = versions.get(scope);
      if (cached !== undefined && cached.path === probedFile.displayPath && cached.version === probedFile.version) {
        if (
          previous !== undefined &&
          previous.action !== "remove" &&
          previous.path === cached.path &&
          previous.digest === cached.digest
        ) {
          if (registerKeptTrimmed(group, cached.trimmedDigest)) pushRemoval(scope, previous.path, cached);
          continue;
        }
        if ((previous === undefined || previous.action === "remove") && hasKeptTrimmed(group, cached.trimmedDigest))
          continue;
      }
      const file = await readScopeInstruction(probedFile, resolved.maxSourceBytes, fileSystem, options.signal);
      if (file === undefined) {
        rollbackGroup();
        break;
      }
      const currentDigest = instructionContentSha1(file.content);
      const trimmedDigest = trimmedInstructionDigest(file.content);
      const nextVersion: InstructionVersionState = {
        path: file.displayPath,
        version: probedFile.version,
        digest: currentDigest,
        trimmedDigest,
      };
      if (registerKeptTrimmed(group, trimmedDigest)) {
        if (previous !== undefined && previous.action !== "remove") pushRemoval(scope, previous.path, nextVersion);
        else versions.set(scope, nextVersion);
        continue;
      }
      if (
        previous !== undefined &&
        previous.action !== "remove" &&
        previous.path === file.displayPath &&
        previous.digest === currentDigest
      ) {
        versions.set(scope, nextVersion);
        continue;
      }
      const change: AgentInstructionChange = {
        action: previous === undefined || previous.action === "remove" ? "set" : "replace",
        scope,
        path: file.displayPath,
        digest: currentDigest,
      };
      items.push({ change, file });
      versionUpdates.push({ change, state: nextVersion });
    }
  }
  if (items.length === 0) return undefined;
  const rendered = renderInstructionChanges(items, resolved.maxBytes);
  if (rendered.text.length === 0 || rendered.changes.length === 0) return undefined;
  return {
    context: agentInstructionsHook(rendered.text, rendered.changes),
    versionUpdates: retainedInstructionVersionUpdates(versionUpdates, rendered.changes),
  };
}
