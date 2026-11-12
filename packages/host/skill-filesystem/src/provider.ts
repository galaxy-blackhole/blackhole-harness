/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Provider kỹ năng trên filesystem — port NGUYÊN VĂN `FileSystemSkillProvider` + `apply` của
 *      bundle gốc @galaxy-blackhole/gbh-skill-filesystem: thứ tự root (project-dsh 100, project-agents
 *      200, custom 300, user-dsh 400, user-agents 500, bundled 600), khám phá thư mục/flat .md,
 *      `skipSystem`, `trustedHost`, và toàn bộ cảnh báo frontmatter. Export: apply,
 *      FileSystemSkillProvider.
 */

import { join, resolve } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
// Augmentation `ctx.skills` do gói stock khai (ADR 000d: gbh-skill CỐ Ý không augment) ⇒ nạp bằng import type trống.
import type {} from "@deepseek-ai/dsh-skill";
import { BUNDLED_SKILL_RANK, isSkillName } from "@galaxy-blackhole/gbh-skill";
import type {
  SkillCandidate,
  SkillDefinition,
  SkillInvocationPolicy,
  SkillLookupOptions,
  SkillProvider,
  SkillProviderControl,
  SkillProviderObservation,
} from "@galaxy-blackhole/gbh-skill";
import { resolveAgentsHome, resolveDshHome } from "@galaxy-blackhole/gbh-home-paths";
import {
  CUSTOM_RANK,
  PROJECT_AGENTS_RANK,
  PROJECT_COMPAT_RANK,
  USER_AGENTS_RANK,
  USER_COMPAT_RANK,
  resolveWatchConfig,
  type Config,
  type SkillRoot,
} from "./config.ts";
import { errorMessage } from "./errors.ts";
import {
  parseFrontmatter,
  optionalMetadata,
  optionalString,
  parseInvocationPolicy,
  stringField,
  type ParsedFrontmatter,
} from "./frontmatter.ts";
import { findProjectRoot, listSkillRootEntries, optionalFileSystem, readSkillText } from "./fs-seam.ts";
import { SkillWatchManager } from "./watcher.ts";

/** Handle provider-owned nằm trong `candidate.locator` của một kỹ năng đã khám phá. */
interface SkillLocator {
  /** Đường dẫn tệp chỉ dẫn (SKILL.md hoặc tệp .md phẳng). */
  path: string;
  /** Thư mục gốc dùng làm resourceBase. */
  directory: string;
}

/** Kỹ năng đã parse đầy đủ từ một tệp trước khi gắn nguồn/rank của root. */
interface ParsedSkill {
  /** Tên kebab-case đã kiểm bằng `isSkillName`. */
  name: string;
  /** Mô tả định tuyến. */
  description: string;
  /** Hướng dẫn định tuyến bổ sung (chỉ có khi frontmatter khai). */
  whenToUse?: string;
  /** Quyền gọi đã phân giải. */
  invocation: SkillInvocationPolicy;
  /** Metadata provider-specific (chỉ có khi frontmatter khai object). */
  metadata?: Readonly<Record<string, unknown>>;
  /** Đường dẫn đã phân giải của tệp. */
  path: string;
  /** Thân Markdown đã trim. */
  content: string;
}

/**
 * Đăng ký provider kỹ năng filesystem trên `ctx.skills` — giữ nguyên thứ tự ba việc của bản gốc:
 * registerProvider, effect đóng watcher, và listener `fs/observed` chỉ phản ứng với edit/write.
 * Nhận: ctx — context cordis; config — cấu hình provider (mặc định `{}`).
 * Trả: không trả gì.
 * @throws {TypeError} khi context thiếu service `skills` (bản gốc cũng ném như vậy).
 */
export function apply(ctx: Context, config: Config = {}): void {
  let provider!: FileSystemSkillProvider;
  ctx.skills.registerProvider((control) => {
    provider = new FileSystemSkillProvider(ctx, control, config);
    return provider;
  });
  ctx.effect(function* () {
    yield async () => {
      await provider.dispose();
    };
  }, "skill-filesystem watcher");
  ctx.on("fs/observed", (target, _observation, actor) => {
    if (mutationToolName(actor) === undefined) return;
    provider.observeHostMutation(target.displayPath);
  });
}

/**
 * Provider ánh xạ các root kỹ năng dự án/người dùng vào `ctx.skills`.
 * Nhận: ctx — context cordis; control — vòng đời registration; config — cấu hình provider.
 * Trả: provider sẵn sàng cho `list`/`get`.
 */
export class FileSystemSkillProvider implements SkillProvider {
  /** Context dùng cho ctx.fs, logger và watcher. */
  private readonly ctx: Context;
  /** Tên provider công bố cho candidate/definition. */
  readonly name: string;
  /** Có gồm root dự án và root người dùng hay không. */
  private readonly includeDefaultRoots: boolean;
  /** Gốc cấu hình đã phân giải (khoá config vẫn tên `dshHome` — hợp đồng của row, xem review-4). */
  private readonly gbhHome: string;
  /** Gốc cấu hình agent đã phân giải. */
  private readonly agentsHome: string;
  /** Các root tuỳ biến đã resolve tuyệt đối. */
  private readonly customSkillDirs: string[];
  /** Bộ quản lý watcher host. */
  private readonly watchManager: SkillWatchManager;
  /** Root kỹ năng đóng gói (có thể undefined). */
  private readonly bundledSkillDir: string | undefined;
  /** Promise dispose dùng chung (dispose lần đầu tạo, lần sau trả lại). */
  private disposal: Promise<void> | undefined;

  /**
   * Khởi tạo provider — giữ nguyên thứ tự đọc config và đăng ký huỷ của bản gốc.
   * Nhận: ctx — context cordis; control — vòng đời registration; config — cấu hình provider.
   * Trả: instance mới.
   * @throws {TypeError} khi ngưỡng watcher không phải số nguyên dương.
   */
  constructor(ctx: Context, control: SkillProviderControl, config: Config = {}) {
    this.ctx = ctx;
    this.name = config.providerName ?? "filesystem";
    this.includeDefaultRoots = config.includeDefaultRoots ?? true;
    this.gbhHome = resolveDshHome(config.dshHome);
    this.agentsHome = resolveAgentsHome(config.agentsHome);
    this.customSkillDirs = (config.customSkillDirs ?? []).map((root) => resolve(root));
    this.watchManager = new SkillWatchManager(ctx, control.invalidate, resolveWatchConfig(config));
    control.signal.addEventListener(
      "abort",
      () => {
        this.dispose();
      },
      { once: true },
    );
    const bundledSkillDir =
      config.bundledSkillDir ?? (this.includeDefaultRoots ? process.env.DSH_BUNDLED_SKILL_DIR : undefined);
    this.bundledSkillDir = bundledSkillDir === undefined ? undefined : resolve(bundledSkillDir);
  }

  /**
   * Khám phá tóm tắt kỹ năng cục bộ cho một workspace phụ thuộc cwd.
   * Nhận: options — tuỳ chọn tra cứu; `cwd` chọn root dự án cần quét.
   * Trả: mảng candidate khi watcher ổn, hoặc observation `complete: false` khi watcher lỗi
   *   (trừ khi provider đã dispose — lúc đó lỗi được ném lại như bản gốc).
   * @throws {unknown} lỗi watcher sau khi provider đã dispose.
   */
  async list(options: SkillLookupOptions): Promise<SkillCandidate[] | SkillProviderObservation> {
    const roots = await this.roots(options.cwd);
    let complete = true;
    try {
      await this.watchManager.observeRoots(roots);
    } catch (error) {
      if (this.disposal !== undefined) throw error;
      complete = false;
    }
    const candidates: SkillCandidate[] = [];
    for (const root of roots) for (const skill of await discoverRoot(root, this.ctx, this.name)) candidates.push(skill);
    return complete
      ? candidates
      : {
          candidates,
          complete,
        };
  }

  /**
   * Nạp toàn bộ thân kỹ năng cục bộ từ locator của candidate.
   * Nhận: candidate — candidate thắng do provider này trả; options — tuỳ chọn có `signal` huỷ đọc.
   * Trả: definition đầy đủ, hoặc undefined nếu tệp đã biến mất.
   * @throws {unknown} lỗi đọc không phải "vắng mặt"/FS_NOT_TEXT; AbortError khi signal đã huỷ.
   */
  async get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined> {
    const locator = candidate.locator as SkillLocator;
    const parsed = await parseSkillFile(locator.path, this.ctx, options.signal, candidate.source === "bundled");
    if (parsed === undefined) return undefined;
    return {
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
      invocation: parsed.invocation,
      source: candidate.source,
      provider: this.name,
      resourceBase: {
        kind: "directory",
        path: locator.directory,
      },
      path: parsed.path,
      ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
      content: parsed.content,
    };
  }

  /**
   * Invalidate provider đồng bộ sau một thao tác filesystem của bên thứ nhất.
   * Nhận: path — đường dẫn hiển thị của host sau write/edit.
   * Trả: không trả gì.
   */
  observeHostMutation(path: string): void {
    this.watchManager.observeHostMutation(path);
  }

  /**
   * Đóng mọi watcher host và giữ callback filesystem đến muộn trong im lặng.
   * Nhận: không.
   * Trả: Promise dùng chung, settle khi mọi watcher đã đóng xong.
   */
  dispose(): Promise<void> {
    this.disposal ??= this.watchManager.dispose();
    return this.disposal;
  }

  /**
   * Dựng danh sách root theo ĐÚNG thứ tự/rank của bản gốc.
   * Nhận: cwd — thư mục workspace (có thì mới thêm root dự án).
   * Trả: mảng {@link SkillRoot} đã chuẩn hoá.
   */
  private async roots(cwd: string | undefined): Promise<SkillRoot[]> {
    const roots: SkillRoot[] = [];
    if (this.includeDefaultRoots && cwd !== undefined) {
      const projectRoot = await findProjectRoot(resolve(cwd), optionalFileSystem(this.ctx));
      roots.push(
        {
          path: join(projectRoot, ".dsh/skills"),
          source: "project-dsh",
          rank: PROJECT_COMPAT_RANK,
          projectRoot,
        },
        {
          path: join(projectRoot, ".agents/skills"),
          source: "project-agents",
          rank: PROJECT_AGENTS_RANK,
          projectRoot,
        },
      );
    }
    roots.push(
      ...this.customSkillDirs.map(
        (path): SkillRoot => ({
          path,
          source: "custom",
          rank: CUSTOM_RANK,
        }),
      ),
    );
    if (this.includeDefaultRoots)
      roots.push(
        {
          path: join(this.gbhHome, "skills"),
          source: "user-dsh",
          rank: USER_COMPAT_RANK,
          skipSystem: true,
        },
        {
          path: join(this.agentsHome, "skills"),
          source: "user-agents",
          rank: USER_AGENTS_RANK,
        },
      );
    if (this.bundledSkillDir !== undefined)
      roots.push({
        path: this.bundledSkillDir,
        source: "bundled",
        rank: BUNDLED_SKILL_RANK,
        trustedHost: true,
      });
    return roots;
  }
}

/**
 * Khám phá mọi kỹ năng trong một root, sắp theo tên và bỏ qua `.system` khi root yêu cầu.
 * Nhận: root — root cần quét; ctx — context cordis; provider — tên provider gắn vào candidate.
 * Trả: mảng candidate của root theo thứ tự tên đã sắp.
 */
async function discoverRoot(root: SkillRoot, ctx: Context, provider: string): Promise<SkillCandidate[]> {
  const skills: SkillCandidate[] = [];
  const entries = await listSkillRootEntries(root, ctx);
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (root.skipSystem && entry.name === ".system") continue;
    const locator: SkillLocator | undefined =
      entry.type === "directory"
        ? {
            path: join(entry.path, "SKILL.md"),
            directory: entry.path,
          }
        : entry.type === "file" && entry.name.endsWith(".md")
          ? {
              path: entry.path,
              directory: root.path,
            }
          : undefined;
    if (locator === undefined) continue;
    const parsed = await parseSkillFile(locator.path, ctx, undefined, root.trustedHost === true);
    if (parsed === undefined) continue;
    skills.push({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
      invocation: parsed.invocation,
      provider,
      source: root.source,
      rank: root.rank,
      locator,
      resourceBase: {
        kind: "directory",
        path: locator.directory,
      },
      path: parsed.path,
      ...(parsed.metadata !== undefined ? { metadata: parsed.metadata } : {}),
    });
  }
  return skills;
}

/**
 * Đọc và parse một tệp kỹ năng, cảnh báo rồi bỏ qua mọi trường hợp không hợp lệ — giữ nguyên
 * thứ tự kiểm và chuỗi cảnh báo của bản gốc.
 * Nhận: path — đường dẫn tệp; ctx — context cordis; signal — tín hiệu huỷ; trustedHost — đọc trực tiếp bằng Node.
 * Trả: {@link ParsedSkill} khi hợp lệ, ngược lại undefined.
 * @throws {unknown} lỗi đọc không phải "vắng mặt"/FS_NOT_TEXT; AbortError khi signal đã huỷ.
 */
async function parseSkillFile(
  path: string,
  ctx: Context,
  signal: AbortSignal | undefined,
  trustedHost = false,
): Promise<ParsedSkill | undefined> {
  const raw = await readSkillText(ctx, path, signal, trustedHost);
  signal?.throwIfAborted();
  if (raw === undefined) return undefined;
  let parsed: ParsedFrontmatter | undefined;
  try {
    parsed = parseFrontmatter(raw.content);
  } catch (error) {
    ctx.logger.warn(`skill file ${path} ignored: invalid YAML frontmatter: ${errorMessage(error)}`);
    return undefined;
  }
  if (!parsed) {
    ctx.logger.warn(`skill file ${path} ignored: missing YAML frontmatter`);
    return undefined;
  }
  const name = stringField(parsed.data, "name");
  const description = stringField(parsed.data, "description");
  if (name === undefined || description === undefined) {
    ctx.logger.warn(`skill file ${path} ignored: frontmatter requires name and description`);
    return undefined;
  }
  if (!isSkillName(name)) {
    ctx.logger.warn(`skill file ${path} ignored: invalid skill name "${name}"`);
    return undefined;
  }
  let invocation: SkillInvocationPolicy;
  try {
    invocation = parseInvocationPolicy(parsed.data);
  } catch (error) {
    ctx.logger.warn(`skill file ${path} ignored: invalid invocation frontmatter: ${errorMessage(error)}`);
    return undefined;
  }
  return {
    name,
    description,
    ...optionalString(parsed.data, "whenToUse"),
    invocation,
    ...optionalMetadata(parsed.data),
    path: raw.path,
    content: parsed.body.trim(),
  };
}

/**
 * Lấy tên công cụ ghi/sửa từ actor của sự kiện `fs/observed` (chỉ edit/write).
 * Nhận: actor — object tuỳ chọn của tool execution.
 * Trả: "edit" | "write" | undefined.
 */
function mutationToolName(actor: object | undefined): "edit" | "write" | undefined {
  if (actor === undefined || !("name" in actor)) return undefined;
  const value = (actor as { name?: unknown }).name;
  return value === "edit" || value === "write" ? value : undefined;
}
