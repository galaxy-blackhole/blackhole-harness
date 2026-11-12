/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Port 1:1 gói @deepseek-ai/dsh-tool-skill (bundle gốc lib/index.js, vùng lib/types/index.js):
 *      tool `skill` nạp toàn văn kỹ năng + catalog kỹ năng bền vững trong phiên. Giữ NGUYÊN VĂN chuỗi
 *      tiếng Anh, thứ tự kiểm, nhánh lỗi và hằng số; `Config` là z.object THẬT của schemastery;
 *      seam dịch vụ khai theo CẤU TRÚC (ADR 000d), không augment module.
 */

import { createHash, randomUUID } from "node:crypto";

import { defineTool } from "@galaxy-blackhole/gbh-host-tools";

import { Config, DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH } from "./config.ts";

/**
 * Schema cấu hình của tool-skill — NGUYÊN VĂN `Config` của bản gốc, là `z.object` THẬT của
 * schemastery (port trong `./config.ts`).
 * Nhận: giá trị cấu hình thô khi được gọi.
 * Trả: `Config` đã chuẩn hoá; `~standard.validate` trả `{ value }` hoặc `{ issues }`.
 * @throws {Error} khi gốc không phải object hoặc trường sai kiểu — thông điệp NGUYÊN VĂN schemastery.
 */
export { Config };

/**
 * Tên plugin cordis — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: "tool-skill".
 */
export const name = "tool-skill";

/**
 * Service bắt buộc — NGUYÊN VĂN bản gốc (sổ agent + sổ công cụ + sổ kỹ năng + thư mục làm việc).
 * Nhận: không.
 * Trả: mảng tên service theo ĐÚNG thứ tự bản gốc.
 */
export const inject: string[] = ["agents", "tools", "skills", "workingDirectory"];

/** Gốc tài nguyên tuỳ chọn của một kỹ năng — hình dạng NGUYÊN VĂN `SkillResourceBase` của dsh-skill. */
type SkillResourceBase =
  | { readonly kind: "directory"; readonly path: string }
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "opaque"; readonly description: string };

/** Công tắc gọi đã phân giải của một kỹ năng — hình dạng NGUYÊN VĂN `SkillInvocationPolicy`. */
interface SkillInvocationPolicy {
  /** Catalog/loader hướng mô hình có gồm kỹ năng này không. */
  readonly modelInvocable: boolean;
  /** Catalog/loader hướng NGƯỜI có gồm kỹ năng này không. */
  readonly userInvocable: boolean;
}

/** Siêu dữ liệu trung tính mà `ctx.skills.list()` trả — hình dạng NGUYÊN VĂN `SkillSummary`. */
interface SkillSummaryLike {
  /** Định danh kebab-case dùng để gọi kỹ năng. */
  readonly name: string;
  /** Mô tả định tuyến ngắn hiện cho consumer khám phá. */
  readonly description: string;
  /** Công tắc gọi đã phân giải. */
  readonly invocation: SkillInvocationPolicy;
}

/** Định nghĩa đầy đủ mà `ctx.skills.get()` trả — hình dạng NGUYÊN VĂN `SkillDefinition`. */
interface SkillDefinitionLike extends SkillSummaryLike {
  /** Nhà cung cấp sở hữu thân kỹ năng. */
  readonly provider: string;
  /** Gốc tài nguyên tuỳ chọn cho đường dẫn tương đối trong thân. */
  readonly resourceBase?: SkillResourceBase;
  /** Thân markdown sau khi bỏ metadata của provider. */
  readonly content: string;
}

/** Ngữ cảnh tra cứu mà seam kỹ năng nhận — hình dạng `SkillViewOptions` (cwd + signal + scope). */
interface SkillLookup {
  /** Thư mục làm việc của người gọi (undefined khi lời gọi không có agent). */
  readonly cwd: string | undefined;
  /** Tín hiệu huỷ của lượt gọi. */
  readonly signal: AbortSignal | undefined;
  /** Phạm vi nhìn (agent đang gọi); undefined đọc lớp toàn cục. */
  readonly scope: unknown;
}

/** Ảnh chụp catalog kỹ năng — hình dạng NGUYÊN VĂN `SkillCatalogSnapshot`. */
interface SkillCatalogSnapshotLike {
  /** Tóm tắt đã sắp xếp trong lần quan sát này. */
  readonly skills: readonly SkillSummaryLike[];
  /** Mọi provider đã hoàn tất mà không có revision catalog chen ngang hay chưa. */
  readonly complete: boolean;
}

/** Seam CẤU TRÚC của service `skills` — chỉ ba phép mà plugin này dùng. */
interface SkillsService {
  /** Liệt kê tóm tắt kỹ năng nhìn thấy từ lookup. */
  list(lookup: SkillLookup): Promise<readonly SkillSummaryLike[]>;
  /** Nạp toàn văn MỘT kỹ năng theo tên. */
  get(name: string, lookup: SkillLookup): Promise<SkillDefinitionLike | undefined>;
  /** Chụp catalog đầy đủ + cờ hoàn tất cho một lookup. */
  snapshot(options: SkillLookup): Promise<SkillCatalogSnapshotLike>;
}

/** Seam CẤU TRÚC của service `workingDirectory` — chỉ phép mà plugin này dùng. */
interface WorkingDirectoryService {
  /** Bảo đảm agent có thư mục làm việc và trả đường dẫn tuyệt đối. */
  ensure(agent: unknown, signal: AbortSignal): Promise<string>;
}

/** Seam CẤU TRÚC của service `tools` — đăng ký + tra cứu theo phạm vi agent. */
interface ToolsService {
  /** Đăng ký một định nghĩa công cụ. */
  register(tool: unknown): unknown;
  /** Tra định nghĩa đang hiệu lực cho tên + agent. */
  get(name: string, agent: unknown): unknown;
}

/** Nguồn của một message — đọc `kind` + `entries` (khoá khác do consumer khác sở hữu). */
interface MessageSource {
  /** Loại nguồn (`user`, `skill-invocation`, `skill-catalog`, …). */
  readonly kind: string;
  /** Danh sách mục bền vững của catalog (chỉ nguồn `skill-catalog` có). */
  readonly entries?: unknown;
  /** Khoá nguồn khác — giữ nguyên khi đi qua seam. */
  readonly [key: string]: unknown;
}

/** Khối nội dung message — chỉ `type` và `text` được plugin này đọc. */
interface ContentBlockLike {
  /** Loại khối (`text`, `image`, …). */
  readonly type: string;
  /** Chữ của khối `text` (vắng mặt ở khối khác). */
  readonly text?: string;
}

/** Message trong batch/lịch sử phiên — hình dạng tối thiểu plugin này đọc. */
interface MessageLike {
  /** Danh tính bền vững của message. */
  readonly id: string;
  /** Vai trò (`user`, `assistant`, …). */
  readonly role: string;
  /** Các khối nội dung. */
  readonly content: readonly ContentBlockLike[];
  /** Nguồn sản xuất message. */
  readonly source: MessageSource;
}

/** Quyết định bước mà waterfall `agent/pre-step` trả — hình dạng NGUYÊN VĂN `PreStepDecision`. */
type PreStepDecision =
  | { readonly kind: "reject" }
  | { readonly kind: "enter"; readonly messages: readonly MessageLike[]; readonly startsRequestSeries?: true };

/** Agent tối thiểu mà hai hook đọc — chỉ cần phiên để tra lịch sử catalog. */
interface AgentLike {
  /** Phiên bền vững của agent. */
  readonly session: SessionLike;
}

/** Phiên tối thiểu mà `catalogHistory` đọc. */
interface SessionLike {
  /** Độ dài log hiện tại. */
  readonly seq: number;
  /** Mặt hiển thị; `nodes` là các seq đang nhìn thấy. */
  readonly surface: { readonly nodes: readonly number[] };
  /** Đọc sự kiện tại một seq. */
  eventAt(seq: number): SessionEventLike | undefined;
}

/** Sự kiện phiên tối thiểu mà `catalogHistory` đọc. */
interface SessionEventLike {
  /** Vị trí của sự kiện trong log. */
  readonly seq: number;
  /** Loại sự kiện (`user/message`, …). */
  readonly type: string;
  /** Dữ liệu sự kiện; `source` là nguồn message. */
  readonly data: { readonly source: MessageSource };
}

/** Payload waterfall `agent/pre-step` mà hai hook dùng. */
interface PreStepPayload {
  /** Agent đang đề xuất bước. */
  readonly agent: AgentLike;
  /** Batch message đã nhận cho bước này. */
  readonly messages: readonly MessageLike[];
  /** Lượt sở hữu bước. */
  readonly turn: number;
  /** Số bước. */
  readonly step: number;
  /** Tín hiệu huỷ của lượt. */
  readonly signal: AbortSignal;
}

/** Seam CẤU TRÚC của Context cordis — đúng bốn thành viên plugin này chạm tới. */
interface PluginContext {
  /** Sổ công cụ. */
  readonly tools: ToolsService;
  /** Sổ kỹ năng. */
  readonly skills: SkillsService;
  /** Thư mục làm việc của agent. */
  readonly workingDirectory: WorkingDirectoryService;
  /** Đăng ký listener waterfall `agent/pre-step`. */
  on(
    event: "agent/pre-step",
    handler: (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>,
  ): void;
}

/** Một mục bền vững của catalog — cặp tên + mô tả đã chuẩn hoá, NGUYÊN VĂN hình dạng bản gốc. */
interface CatalogEntry {
  /** Tên kỹ năng. */
  readonly name: string;
  /** Mô tả đã chuẩn hoá (đã cắt theo `catalogDescriptionMaxLength`). */
  readonly description: string;
}

/** Kết quả tra lịch sử catalog của một phiên. */
interface CatalogHistory {
  /** Digest của catalog đang NHÌN THẤY gần nhất (vắng khi không có catalog hiển thị). */
  readonly visibleDigest?: string;
  /** Đã từng công bố catalog nào trong log chưa. */
  readonly published: boolean;
}

/**
 * Cho biết một chuỗi có phải tên kỹ năng kebab-case hợp lệ hay không — NGUYÊN VĂN `isSkillName`.
 * Nhận: name — chuỗi ứng viên cần kiểm.
 * Trả: `true` khi chuỗi khớp ngữ pháp công khai của tên kỹ năng.
 */
function isSkillName(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

/**
 * Cho biết một kỹ năng có được phép hiện cho model và được model nạp hay không.
 * Nhận: skill — siêu dữ liệu kỹ năng đã mang công tắc gọi đã phân giải.
 * Trả: `true` khi chính sách cho phép model gọi.
 */
function isModelInvocable(skill: Pick<SkillSummaryLike, "invocation">): boolean {
  return skill.invocation.modelInvocable;
}

/**
 * Cho biết một kỹ năng có được phép hiện cho và nạp bởi lệnh dành cho NGƯỜI hay không.
 * Nhận: skill — siêu dữ liệu kỹ năng đã mang công tắc gọi đã phân giải.
 * Trả: `true` khi chính sách cho phép người gọi.
 */
function isUserInvocable(skill: Pick<SkillSummaryLike, "invocation">): boolean {
  return skill.invocation.userInvocable;
}

/**
 * Thoát chữ văn xuôi hướng tới model được nhúng trong khung kỹ năng — NGUYÊN VĂN bản gốc.
 * Nhận: value — văn xuôi thô cần nhúng.
 * Trả: chữ đã thoát (`&`, `<`, `>`).
 */
function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Thoát một giá trị đặt trong THUỘC TÍNH của khung kỹ năng — NGUYÊN VĂN bản gốc.
 * Nhận: value — chuỗi thô (thường là tên kỹ năng).
 * Trả: chuỗi đã thoát `&`, `"`, `<` theo đúng thứ tự của bản gốc.
 */
function escapeAttr(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

/**
 * Chốt nhánh không bao giờ tới của một union ĐÓNG — NGUYÊN VĂN `assertNever` của util-values.
 * Nhận: value — giá trị đã bị kiểu thu về `never`; context — nhãn ngữ cảnh.
 * Trả: không trả — luôn ném `Error` với chuỗi giống bản gốc.
 * @throws {Error} luôn luôn (nhánh không thể tới đã chạy được).
 */
function assertNever(value: never, context: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

/**
 * Dựng hai dòng gợi ý tài nguyên cho phần `<skill_resources>` — NGUYÊN VĂN bản gốc.
 * Nhận: skill — kỹ năng có thể mang gốc tài nguyên (`directory`/`url`/`opaque`).
 * Trả: mảng dòng gợi ý; ném khi gốc tài nguyên là một `kind` chưa biết (union đóng).
 * @throws {Error} khi `resourceBase.kind` nằm ngoài union đóng.
 */
function renderResourceHint(skill: Pick<SkillDefinitionLike, "provider" | "resourceBase">): readonly string[] {
  const base = skill.resourceBase;
  if (base === undefined) {
    return [
      `Resources for this skill are managed by provider "${escapeText(skill.provider)}".`,
      "Load referenced resources only as needed.",
    ];
  }
  switch (base.kind) {
    case "directory":
      return [
        `Base directory for this skill: ${escapeText(base.path)}`,
        "Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.",
      ];
    case "url":
      return [
        `Base URL for this skill: ${escapeText(base.url)}`,
        "Resolve relative URLs mentioned by this skill against the base URL before using them. Load referenced resources only as needed.",
      ];
    case "opaque":
      return [
        `Resources for this skill: ${escapeText(base.description)}`,
        "Load referenced resources only as needed.",
      ];
    default:
      return assertNever(base, "SkillResourceBase.kind");
  }
}

/**
 * Phơi MỘT kỹ năng đã nạp cho model — NGUYÊN VĂN `renderSkillContent` của dsh-skill.
 * Kết quả được dùng NGUYÊN VĂN bởi cả kết quả của tool `skill` lẫn phần chèn của lượt gọi do người
 * chỉ định, nên model thấy đúng một hình dạng `<skill_content>` trên cả hai đường.
 * Nhận: skill — tên, nhà cung cấp, gốc tài nguyên tuỳ chọn và thân cần phơi.
 * Trả: khối `<skill_content>` hoàn chỉnh hướng tới model.
 * @throws {Error} khi `resourceBase.kind` nằm ngoài union đóng.
 */
function renderSkillContent(skill: Pick<SkillDefinitionLike, "name" | "provider" | "resourceBase" | "content">): string {
  const resourceHint = renderResourceHint(skill);
  return [
    `<skill_content name="${escapeAttr(skill.name)}">`,
    "<skill_resources>",
    ...resourceHint,
    "</skill_resources>",
    "",
    "<skill_instructions>",
    skill.content,
    "</skill_instructions>",
    "</skill_content>",
  ].join("\n");
}

/**
 * Đóng băng sâu một giá trị như `deepFreeze` của util-values: duyệt mọi object/array, bỏ qua
 * `AbortSignal` và giữ một WeakSet để không lặp vòng.
 * Nhận: value — giá trị cần đóng băng.
 * Trả: chính giá trị đó, đã đóng băng sâu.
 */
function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (node instanceof AbortSignal) return;
    if (seen.has(node)) return;
    seen.add(node);
    Object.freeze(node);
    for (const key of Object.keys(node)) visit((node as Record<string, unknown>)[key]);
  };
  visit(value);
  return value;
}

/** Đầu vào tạo một user message — hình dạng mà seam message nhận. */
interface NewUserMessage {
  /** Các khối nội dung. */
  readonly content: readonly ContentBlockLike[];
  /** Nguồn sản xuất message. */
  readonly source: MessageSource;
}

/**
 * Tạo MỘT user message có danh tính và đóng băng trước khi công bố — seam CẤU TRÚC của
 * `createUserMessage` bên `@galaxy-blackhole/gbh-llm` (gói không khai peer ấy): cùng thứ tự khoá
 * `content · source · role · id`, cùng `structuredClone` + đóng băng sâu.
 * Nhận: input — nội dung + nguồn của message mới.
 * Trả: user message bất biến với id UUID mới.
 */
function createUserMessage(input: NewUserMessage): MessageLike {
  return deepFreeze(structuredClone({ ...input, role: "user", id: randomUUID() })) as MessageLike;
}

/**
 * Chấp nhận một số là vị trí sự kiện phiên — NGUYÊN VĂN `SessionSeq` của core/session.
 * Nhận: value — số cần kiểm.
 * Trả: chính số đó (brand chỉ tồn tại lúc biên dịch).
 * @throws {TypeError} khi không phải số nguyên an toàn không âm (hoặc `-0`).
 */
function sessionSeq(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
  }
  return value;
}

/**
 * Kiểm một số nguyên dương có ngưỡng tối thiểu — NGUYÊN VĂN `assertPositiveInteger` của bản gốc.
 * Nhận: name — tên trường trong thông điệp; value — giá trị cần kiểm; minimum — ngưỡng nhỏ nhất.
 * Trả: không.
 * @throws {Error} khi `value` không phải số nguyên hoặc nhỏ hơn `minimum`.
 */
function assertPositiveInteger(name: string, value: number, minimum = 1): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`tool-skill: ${name} must be an integer greater than or equal to ${minimum}`);
  }
}

/**
 * Chuẩn hoá + cắt mô tả cho catalog — NGUYÊN VĂN `catalogDescription` của bản gốc.
 * Nhận: value — mô tả thô; maxLength — độ dài tối đa sau chuẩn hoá.
 * Trả: mô tả gộp khoảng trắng, trim, và cắt còn `maxLength` ký tự với đuôi `...`.
 */
function catalogDescription(value: string, maxLength: number): string {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

/**
 * Chiếu danh sách kỹ năng thành mục bền vững của catalog — NGUYÊN VĂN `catalogSourceEntries`.
 * Nhận: skills — tóm tắt kỹ năng; descriptionMaxLength — độ dài mô tả tối đa.
 * Trả: mảng `{ name, description }` theo đúng thứ tự đầu vào.
 */
function catalogSourceEntries(skills: readonly SkillSummaryLike[], descriptionMaxLength: number): CatalogEntry[] {
  return skills.map((skill) => ({
    name: skill.name,
    description: catalogDescription(skill.description, descriptionMaxLength),
  }));
}

/**
 * Dòng catalog hướng mô hình, chiếu từ chính các mục nguồn ghi bền vững — NGUYÊN VĂN bản gốc.
 * Nhận: entries — các mục catalog.
 * Trả: mảng dòng dạng `- <tên>: <mô tả>` — tên bọc backtick, mô tả đã thoát pseudo-XML.
 */
function renderCatalogEntries(entries: readonly CatalogEntry[]): string[] {
  return entries.map((entry) => `- \`${entry.name}\`: ${escapeText(entry.description)}`);
}

/**
 * Dựng message catalog LẦN CÔNG BỐ ĐẦU — NGUYÊN VĂN từng chuỗi của bản gốc.
 * Nhận: entries — các mục catalog cần phơi.
 * Trả: user message nguồn `skill-catalog` (form `catalog`).
 */
function renderCatalogMessage(entries: readonly CatalogEntry[]): MessageLike {
  return createUserMessage({
    content: [{
      type: "text",
      text: [
        "<system-reminder>",
        "A skill is a reusable set of task-specific instructions. The following skills are available in this session:",
        "",
        "<available_skills>",
        ...renderCatalogEntries(entries),
        "</available_skills>",
        "",
        "If the user names a skill, or the task clearly matches a skill's description, call the `skill` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.",
        "A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill.",
        "</system-reminder>",
      ].join("\n"),
    }],
    source: {
      kind: "skill-catalog",
      form: "catalog",
      entries,
    },
  });
}

/**
 * Dựng message catalog THAY THẾ — NGUYÊN VĂN từng chuỗi của bản gốc.
 * Nhận: entries — các mục catalog đầy đủ cần phơi.
 * Trả: user message nguồn `skill-catalog` (form `catalog`, `update: true`).
 */
function renderCatalogUpdate(entries: readonly CatalogEntry[]): MessageLike {
  const availability = entries.length === 0 ? [
    "No skills are currently available through the `skill` tool. Do not use names from earlier skill catalogs.",
    "A user may still invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool for it.",
  ] : [
    "Use only names in this replacement catalog. If the user names a listed skill, or the task clearly matches its description, call the `skill` tool with the exact name before acting.",
    "A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the `skill` tool again for that skill.",
  ];
  return createUserMessage({
    content: [{
      type: "text",
      text: [
        "<system-reminder>",
        "The available skill catalog changed. This complete catalog replaces every earlier available-skills list in this session:",
        "",
        "<available_skills>",
        ...renderCatalogEntries(entries),
        "</available_skills>",
        "",
        ...availability,
        "</system-reminder>",
      ].join("\n"),
    }],
    source: {
      kind: "skill-catalog",
      form: "catalog",
      update: true,
      entries,
    },
  });
}

/**
 * Danh tính catalog trên DANH SÁCH MỤC BỀN VỮNG thay vì văn xuôi đã render — NGUYÊN VĂN bản gốc.
 * Nhận: entries — các mục catalog.
 * Trả: digest sha256 hex trên chuỗi canonical `[name, description]` từng dòng.
 */
function digestCatalogEntries(entries: readonly CatalogEntry[]): string {
  const canonical = entries.map((entry) => JSON.stringify([entry.name, entry.description])).join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Đọc các mục của MỘT message catalog bền vững — NGUYÊN VĂN `readCatalogEntries`.
 * Bản ghi hỏng (resume/fork/seed do bên ngoài ghi) được coi là "không phải catalog của plugin này"
 * thay vì ném trong listener bước.
 * Nhận: source — nguồn message cần đọc.
 * Trả: mảng mục đọc được, hoặc `undefined` khi hình dạng không dùng được.
 */
function readCatalogEntries(source: MessageSource): CatalogEntry[] | undefined {
  const entries = source.entries;
  if (!Array.isArray(entries)) return undefined;
  const readable: CatalogEntry[] = [];
  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) return undefined;
    const { name, description } = entry as { readonly name?: unknown; readonly description?: unknown };
    if (typeof name !== "string" || name === "" || typeof description !== "string") return undefined;
    readable.push({ name, description });
  }
  return readable;
}

/**
 * Tra lịch sử catalog bền vững của một phiên — NGUYÊN VĂN `catalogHistory`.
 * Nhận: agent — agent có phiên cần đọc.
 * Trả: digest catalog đang nhìn thấy (nếu có) + cờ đã từng công bố.
 * @throws {Error} khi log thiếu sự kiện ở một seq dưới độ dài hiện tại.
 */
function catalogHistory(agent: AgentLike): CatalogHistory {
  const visible = new Set(agent.session.surface.nodes);
  let published = false;
  for (let index = agent.session.seq - 1; index >= 0; index -= 1) {
    const event = agent.session.eventAt(sessionSeq(index));
    if (event === undefined) throw new Error(`skill catalog cannot read seq ${String(index)} below the current Session length`);
    if (event.type !== "user/message" || event.data.source.kind !== "skill-catalog") continue;
    const entries = readCatalogEntries(event.data.source);
    if (entries === undefined) continue;
    const digest = digestCatalogEntries(entries);
    published = true;
    if (visible.has(event.seq)) return { visibleDigest: digest, published };
  }
  return { published };
}

/**
 * Tìm message catalog đã có trong batch bước — NGUYÊN VĂN `catalogMessage`.
 * Nhận: messages — các message của quyết định bước.
 * Trả: message catalog + mục của nó, hoặc `undefined` khi không có.
 */
function catalogMessage(messages: readonly MessageLike[]): { message: MessageLike; entries: CatalogEntry[] } | undefined {
  for (const message of messages) {
    if (message.source.kind !== "skill-catalog") continue;
    const entries = readCatalogEntries(message.source);
    if (entries !== undefined) return { message, entries };
  }
  return undefined;
}

/**
 * Ngữ pháp `/name` công khai — NGUYÊN VĂN `SKILL_GESTURE` của bản gốc: token bị chặn bởi khoảng trắng,
 * nên đường dẫn tệp (`/usr/bin`) và phân số (`5/8`) không khớp.
 */
const SKILL_GESTURE = /(^|\s)\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)/g;

/**
 * Gom token `/name` từ các message người dùng đã nhận — NGUYÊN VĂN `invokedSkillNames`.
 * Mọi khối chữ của đầu vào TRỰC TIẾP từ người dùng đều được quét; không nguồn nào khác giả được gesture.
 * Nhận: messages — batch của bước.
 * Trả: tên kỹ năng ứng viên, chưa kiểm với sổ đăng ký, khử trùng theo thứ tự xuất hiện đầu.
 */
function invokedSkillNames(messages: readonly MessageLike[]): string[] {
  const names: string[] = [];
  for (const message of messages) {
    if (message.source.kind !== "user") continue;
    for (const block of message.content) {
      if (block.type !== "text") continue;
      for (const match of (block.text as string).matchAll(SKILL_GESTURE)) {
        const name = match[2];
        if (name !== undefined && !names.includes(name)) names.push(name);
      }
    }
  }
  return names;
}

/**
 * Đăng ký tool nạp kỹ năng hướng mô hình và catalog kỹ năng bền vững khớp hiển thị của nó.
 * Catalog chỉ được phát khi agent đang gọi phân giải ĐÚNG đăng ký công cụ của plugin này; một hạn chế
 * hoặc một bóng cùng tên theo phạm vi vì thế gỡ cả schema lẫn phần hướng dẫn gọi.
 * Nhận: ctx — Context cordis (seam CẤU TRÚC); config — cấu hình thô, có thể thiếu trường (mặc định `{}`).
 * Trả: không.
 * @throws {Error} khi `catalogDescriptionMaxLength` không phải số nguyên ≥ 3.
 */
export function apply(ctx: PluginContext, config: Config = {}): void {
  const catalogDescriptionMaxLength = config.catalogDescriptionMaxLength ?? DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH;
  assertPositiveInteger("catalogDescriptionMaxLength", catalogDescriptionMaxLength, 3);
  const skillTool = defineTool({
    name: "skill",
    description: "Load the full instructions for a skill. Call it before acting on a task that names or clearly matches a skill in the session skill catalog.",
    parameters: { name: {
      type: "string",
      required: true,
      description: "The exact skill name from the available skills list.",
    } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            required: true,
          },
          provider: {
            type: "string",
            required: true,
          },
          resourceBase: { oneOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  required: true,
                  const: "directory",
                },
                path: {
                  type: "string",
                  required: true,
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  required: true,
                  const: "url",
                },
                url: {
                  type: "string",
                  required: true,
                },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: {
                  type: "string",
                  required: true,
                  const: "opaque",
                },
                description: {
                  type: "string",
                  required: true,
                },
              },
            },
          ] },
          content: {
            type: "string",
            required: true,
          },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: renderSkillContent(value),
      }],
    },
    async execute(args, exec) {
      if (!isSkillName(args.name)) throw new Error(`invalid skill name "${args.name}"`);
      const lookup: SkillLookup = {
        cwd: exec.agent === undefined ? undefined : await ctx.workingDirectory.ensure(exec.agent, exec.signal),
        signal: exec.signal,
        scope: exec.agent,
      };
      const summary = (await ctx.skills.list(lookup)).find((skill) => skill.name === args.name);
      if (!summary) throw new Error(`skill "${args.name}" is unknown or no longer available`);
      if (!isModelInvocable(summary)) throw new Error(`skill "${args.name}" is not available for model invocation`);
      const skill = await ctx.skills.get(args.name, lookup);
      if (!skill) throw new Error(`skill "${args.name}" is unknown or no longer available`);
      if (!isModelInvocable(skill)) throw new Error(`skill "${args.name}" is not available for model invocation`);
      return {
        name: skill.name,
        provider: skill.provider,
        ...skill.resourceBase !== void 0 ? { resourceBase: { ...skill.resourceBase } } : {},
        content: skill.content,
      };
    },
    presentCall(args) {
      return {
        card: "generic",
        title: `Load skill ${args.name}`,
        kind: "read",
        rawInput: args.name,
      };
    },
  });
  ctx.tools.register(skillTool);
  ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject") return decision;
    const names = invokedSkillNames(messages);
    if (names.length === 0) return decision;
    signal.throwIfAborted();
    const lookup: SkillLookup = {
      cwd: await ctx.workingDirectory.ensure(agent, signal),
      signal,
      scope: agent,
    };
    const injections: MessageLike[] = [];
    for (const name of names) {
      const skill = await ctx.skills.get(name, lookup);
      signal.throwIfAborted();
      if (skill === undefined || !isUserInvocable(skill)) continue;
      const source: MessageSource = {
        kind: "skill-invocation",
        name,
        form: "instructions",
      };
      injections.push(createUserMessage({
        content: [{
          type: "text",
          text: renderSkillContent(skill),
        }],
        source,
      }));
    }
    if (injections.length === 0) return decision;
    return {
      ...decision,
      messages: [...decision.messages, ...injections],
    };
  });
  ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
    const decision = await next();
    if (decision.kind === "reject") return decision;
    signal.throwIfAborted();
    const snapshot: SkillCatalogSnapshotLike = ctx.tools.get(skillTool.name, agent) === skillTool ? await ctx.skills.snapshot({
      cwd: await ctx.workingDirectory.ensure(agent, signal),
      signal,
      scope: agent,
    }) : {
      skills: [],
      complete: true,
    };
    signal.throwIfAborted();
    if (!snapshot.complete) return decision;
    const skills = snapshot.skills.filter(isModelInvocable);
    const entries = catalogSourceEntries(skills, catalogDescriptionMaxLength);
    const digest = digestCatalogEntries(entries);
    const history = catalogHistory(agent);
    const existing = catalogMessage(decision.messages);
    if (history.visibleDigest === digest) return existing === undefined ? decision : {
      ...decision,
      messages: decision.messages.filter((message) => message.id !== existing.message.id),
    };
    if (existing !== undefined && digestCatalogEntries(existing.entries) === digest) return decision;
    if (!history.published && skills.length === 0) return existing === undefined ? decision : {
      ...decision,
      messages: decision.messages.filter((message) => message.id !== existing.message.id),
    };
    const catalog = history.published ? renderCatalogUpdate(entries) : renderCatalogMessage(entries);
    return {
      ...decision,
      messages: existing === undefined ? [...decision.messages, catalog] : decision.messages.map((message) => message.id === existing.message.id ? catalog : message),
    };
  });
}
