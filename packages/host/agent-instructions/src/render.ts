/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kết xuất chỉ dẫn workspace cho model trong một ngân sách byte tường minh — port 1:1 vùng render
 *      (stock lib/index.js 116–465 = region lib/types/render.js) của @deepseek-ai/dsh-agent-instructions.
 */
import { basename, dirname, sep } from "node:path";
import {
  AGENTS_HOME_ENV,
  DEFAULT_AGENTS_HOME_DISPLAY,
  DEFAULT_DSH_HOME_DISPLAY,
  DSH_HOME_ENV,
} from "@deepseek-ai/dsh-home-paths";
import type { InstructionFile, LoadedInstructionFile } from "./files.ts";

/** Bản ghi đối soát byte cho MỘT tệp chỉ dẫn bị cắt (stock lib/types/render.d.ts:7–11). */
export interface TruncatedInstruction {
  /** Đường dẫn hiển thị của tệp bị cắt. */
  displayPath: string;
  /** Số byte UTF-8 ban đầu của tệp. */
  originalBytes: number;
  /** Số byte UTF-8 thực sự được đưa vào văn bản. */
  includedBytes: number;
}

/** Văn bản cho model kèm bản ghi tệp bị bỏ và bị cắt (stock lib/types/render.d.ts:13–17). */
export interface RenderedAgentInstructions {
  /** Văn bản đã nằm trong ngân sách byte. */
  text: string;
  /** Các tệp bị bỏ hoàn toàn khỏi văn bản. */
  omitted: InstructionFile[];
  /** Các tệp bị cắt bớt nội dung. */
  truncated: TruncatedInstruction[];
}

/** Trạng thái động có cấu trúc, lưu ngoài văn bản prompt mà model nhìn thấy (stock lib/types/render.d.ts:19–25). */
export interface AgentInstructionChange {
  /** Loại chuyển trạng thái. */
  action: "set" | "replace" | "remove";
  /** Khoá phạm vi của ứng viên chỉ dẫn. */
  scope: string;
  /** Đường dẫn hiển thị của tệp. */
  path: string;
  /** Digest nội dung sau chuyển trạng thái (nếu có). */
  digest?: string;
}

/** Một chuyển trạng thái đi kèm nội dung dùng để kết xuất nó (stock lib/types/render.d.ts:27–31). */
export interface ChangeRenderItem {
  /** Chuyển trạng thái cần kết xuất. */
  change: AgentInstructionChange;
  /** Nội dung hiện tại của tệp. */
  file: LoadedInstructionFile;
}

/** Kết quả nội bộ của một lần kết xuất: văn bản, tệp bị bỏ/cắt và tệp được đại diện. */
interface RenderedContext {
  /** Văn bản đã nằm trong ngân sách byte. */
  text: string;
  /** Các tệp bị bỏ hoàn toàn. */
  omitted: InstructionFile[];
  /** Các tệp bị cắt bớt. */
  truncated: TruncatedInstruction[];
  /** Các tệp có nội dung sống sót trong văn bản. */
  represented: LoadedInstructionFile[];
}

/** Kiểu kết xuất: câu mở đầu + cách dựng một mục tệp. */
interface RenderStyle {
  /** Câu mở đầu đặt trước các mục tệp. */
  intro: string;
  /** Dựng văn bản của MỘT tệp. */
  section: (file: LoadedInstructionFile) => string;
}

/** Thẻ mở khung system-reminder (stock lib/index.js:122). */
const SYSTEM_REMINDER_OPEN = "<system-reminder>";

/** Thẻ đóng khung system-reminder (stock lib/index.js:123). */
const SYSTEM_REMINDER_CLOSE = "</system-reminder>";

/** Câu mở đầu baseline thường (stock lib/index.js:124). */
const AGENT_INSTRUCTIONS_INTRO =
  "The following workspace instructions may be relevant to your work. Use them as guidance when applicable. More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.";

/** Câu mở đầu baseline THAY THẾ (stock lib/index.js:125). */
const REPLACEMENT_AGENT_INSTRUCTIONS_INTRO =
  "This complete workspace instruction baseline replaces all earlier workspace instruction baselines. The following workspace instructions may be relevant to your work. Use them as guidance when applicable. More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.";

/** Câu mở đầu baseline thay thế RỖNG (stock lib/index.js:126). */
const EMPTY_REPLACEMENT_AGENT_INSTRUCTIONS_INTRO =
  "This complete workspace instruction baseline replaces all earlier workspace instruction baselines. No workspace instructions are currently active.";

/** Câu mở đầu khi phải thu gọn vì ngân sách byte (stock lib/index.js:127). */
const COMPACT_AGENT_INSTRUCTIONS_INTRO =
  "Workspace instructions were omitted or truncated to fit the configured byte budget.";

/** Câu hướng dẫn dùng chung cho mục chỉ dẫn bổ sung (stock lib/index.js:257). */
const ADDITIONAL_INSTRUCTIONS_GUIDANCE =
  "Use them as guidance when relevant; more specific instructions take precedence. They do not override system, developer, or direct user instructions.";

/**
 * Đếm số byte UTF-8 của một chuỗi.
 * Nhận: value — chuỗi cần đo.
 * Trả: số byte UTF-8 (stock lib/index.js:128–130).
 */
function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

/**
 * Cắt một chuỗi về tối đa maxBytes byte UTF-8 mà không làm vỡ điểm mã.
 * Nhận: value — chuỗi nguồn; maxBytes — trần byte.
 * Trả: chuỗi đã cắt (stock lib/index.js:131–137).
 */
function truncateUtf8(value: string, maxBytes: number): string {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length <= maxBytes) return value;
  let end = Math.max(0, Math.trunc(maxBytes));
  while (end > 0 && (bytes.readUInt8(end) & 192) === 128) end -= 1;
  return bytes.subarray(0, end).toString("utf8");
}

/**
 * Vô hiệu hoá thẻ đóng khung bên trong thân văn bản để model không thấy khung bị đóng sớm.
 * Nhận: body — thân văn bản.
 * Trả: thân đã thay thế mọi thẻ đóng (stock lib/index.js:138–140).
 */
function escapeInstructionFrameBody(body: string): string {
  return body.replaceAll(SYSTEM_REMINDER_CLOSE, "<\\/system-reminder>");
}

/**
 * Dựng mục tệp của baseline.
 * Nhận: file — tệp chỉ dẫn.
 * Trả: văn bản mục "Instructions from: …" (stock lib/index.js:141–143).
 */
function sectionText(file: LoadedInstructionFile): string {
  return "Instructions from: " + file.displayPath + "\n\n" + file.content;
}

/** Thành phần thư mục nhận diện phạm vi chỉ dẫn người dùng của gốc harness (stock lib/index.js:145). */
export const USER_GLOBAL_DIRECTORY = "user-global";

/**
 * Thành phần thư mục nhận diện phạm vi người dùng của gốc agent dùng chung.
 *
 * Đây là phạm vi RIÊNG để tệp trong gốc harness giữ đúng khoá phạm vi mà các phiên trước đã ghi,
 * trong khi instructionCandidateGroup vẫn gộp hai gốc thành một nhóm ứng viên.
 */
export const AGENTS_GLOBAL_DIRECTORY = "agents-global";

/**
 * Thứ tự các thư mục phạm vi người dùng.
 *
 * Việc dò, đối soát baseline và gộp trùng đều lặp theo thứ tự này, nhờ vậy gốc harness luôn là
 * ứng viên quyết định trùng nội dung so với gốc agent dùng chung.
 */
export const USER_GLOBAL_DIRECTORIES = [USER_GLOBAL_DIRECTORY, AGENTS_GLOBAL_DIRECTORY] as const;

/**
 * Tên tệp chỉ dẫn người dùng dưới mỗi gốc người dùng.
 *
 * Dò (gốc/tên) và đối soát (thành phần ứng viên của khoá phạm vi người dùng) cùng dùng tên này,
 * nên nó chỉ sống ở MỘT chỗ: nếu hai bên lệch nhau, tệp sẽ được nạp mà không bao giờ đối soát được.
 */
export const USER_GLOBAL_FILE = "AGENTS.md";

/**
 * Suy ra phạm vi chỉ dẫn logic từ đường dẫn hiển thị cho model.
 * Nhận: displayPath — đường dẫn tương đối dự án hoặc đường dẫn người dùng.
 * Trả: "user-global", "agents-global", "." hoặc thư mục chứa trong dự án (stock lib/index.js:174–178).
 */
export function scopeForDisplayPath(displayPath: string): string {
  if (
    displayPath === DEFAULT_DSH_HOME_DISPLAY + "/AGENTS.md" ||
    displayPath === "$" + DSH_HOME_ENV + "/AGENTS.md"
  ) {
    return USER_GLOBAL_DIRECTORY;
  }
  if (
    displayPath === DEFAULT_AGENTS_HOME_DISPLAY + "/AGENTS.md" ||
    displayPath === "$" + AGENTS_HOME_ENV + "/AGENTS.md"
  ) {
    return AGENTS_GLOBAL_DIRECTORY;
  }
  return dirname(displayPath);
}

/**
 * Cho biết một thư mục phạm vi đã giải có phải một trong hai gốc người dùng hay không.
 * Nhận: directory — "user-global", "agents-global", "." hoặc thư mục trong dự án.
 * Trả: true cho phạm vi gốc harness và gốc agent dùng chung (stock lib/index.js:184–186).
 */
export function isUserGlobalDirectory(directory: string): boolean {
  return directory === "user-global" || directory === "agents-global";
}

/**
 * Nhóm ứng viên của một thư mục phạm vi đã giải.
 *
 * Gốc harness và gốc agent dùng chung là hai ứng viên CÓ THỨ TỰ của cùng một nhóm ứng viên người dùng:
 * nội dung trùng sau trim chỉ kết xuất một lần, và một ứng viên không quan sát được sẽ giữ trạng thái
 * tốt cuối của nhóm. Mỗi thư mục dự án tạo nhóm riêng của nó.
 * Nhận: directory — "user-global", "agents-global", "." hoặc thư mục trong dự án.
 * Trả: khoá nhóm dùng chung của hai gốc người dùng, hoặc chính thư mục đó (stock lib/index.js:197–199).
 */
export function instructionCandidateGroup(directory: string): string {
  return directory === "agents-global" ? USER_GLOBAL_DIRECTORY : directory;
}

/** Tên thư mục mà scopeForDisplayPath đọc như phạm vi người dùng, không phải đường dẫn dự án (stock lib/index.js:201). */
const RESERVED_SCOPE_DIRECTORIES: ReadonlySet<string> = new Set(USER_GLOBAL_DIRECTORIES);

/**
 * Giữ đường dẫn tương đối dự án ra khỏi không gian tên phạm vi người dùng.
 *
 * Một thư mục dự án trùng tên thư mục phạm vi người dùng sẽ bị hiểu là gốc toàn cục khi dò và sẽ nhập
 * vào nhóm ứng viên toàn cục khi gộp trùng. Thoát va chạm bằng một "." ở đầu để tệp ở lại phạm vi dự án.
 * Nhận: relativePath — đường dẫn tương đối gốc dự án dùng dấu phân cách của nền tảng.
 * Trả: đường dẫn, có thêm thành phần "." ở đầu khi thành phần đầu va chạm (stock lib/index.js:212–216).
 */
export function escapeProjectDisplayPath(relativePath: string): string {
  const separatorIndex = relativePath.search(/[\\/]/);
  const first = separatorIndex < 0 ? relativePath : relativePath.slice(0, separatorIndex);
  return RESERVED_SCOPE_DIRECTORIES.has(first) ? "." + sep + relativePath : relativePath;
}

/** Dấu phân cách giữa thư mục phạm vi và tên ứng viên trong khoá phạm vi (stock lib/index.js:217). */
const SCOPE_SEPARATOR = "\0";

/**
 * Ghép khoá đối soát cho MỘT tệp ứng viên chỉ dẫn.
 * Mỗi ứng viên được nạp được theo dõi độc lập, nên khoá ghép thư mục logic với đúng tên tệp ứng viên
 * sau một dấu NUL mà không đường dẫn thư mục hay tên tệp nào chứa được. Nhờ vậy các ứng viên khác nhau
 * trong cùng thư mục (AGENTS.md và CLAUDE.md, tệp gốc và bản ghi đè .local) không bao giờ đụng nhau
 * trong các map trạng thái theo phạm vi.
 * Nhận: directory — "user-global", "agents-global", "." hoặc thư mục trong dự án;
 *      candidateName — tên tệp chỉ dẫn trong thư mục đó.
 * Trả: khoá phạm vi logic của từng ứng viên (stock lib/index.js:229–231).
 */
export function candidateScopeKey(directory: string, candidateName: string): string {
  return directory + SCOPE_SEPARATOR + candidateName;
}

/**
 * Suy ra khoá phạm vi từng ứng viên cho một tệp chỉ dẫn đã nạp.
 * Nhận: displayPath — đường dẫn tương đối dự án hoặc đường dẫn người dùng.
 * Trả: khoá phạm vi ghép thư mục của tệp với tên tệp (stock lib/index.js:237–239).
 */
export function instructionScopeKey(displayPath: string): string {
  return candidateScopeKey(scopeForDisplayPath(displayPath), basename(displayPath));
}

/**
 * Khôi phục thư mục và tên ứng viên mà candidateScopeKey đã mã hoá.
 * Nhận: scope — một khoá phạm vi từng ứng viên.
 * Trả: thư mục phạm vi và tên tệp ứng viên trong đó (stock lib/index.js:245–256).
 */
export function decodeScopeKey(scope: string): { directory: string; candidateName: string } {
  const separator = scope.indexOf(SCOPE_SEPARATOR);
  if (separator < 0) {
    return {
      directory: scope,
      candidateName: "",
    };
  }
  return {
    directory: scope.slice(0, separator),
    candidateName: scope.slice(separator + 1),
  };
}

/**
 * Dựng mục tệp chỉ dẫn BỔ SUNG (khi tệp xuất hiện sau baseline).
 * Nhận: file — tệp chỉ dẫn đã nạp.
 * Trả: văn bản mục "Additional instructions from: …" (stock lib/index.js:258–268).
 */
function additionalSectionText(file: LoadedInstructionFile): string {
  const scope = scopeForDisplayPath(file.displayPath);
  const applicability = isUserGlobalDirectory(scope)
    ? "These user-global instructions apply to all work."
    : "These instructions apply to work under `" + scope + "`.";
  return [
    "Additional instructions from: " + file.displayPath,
    "",
    applicability + " " + ADDITIONAL_INSTRUCTIONS_GUIDANCE,
    "",
    file.content,
  ].join("\n");
}

/** Kiểu kết xuất baseline thường (stock lib/index.js:269–272). */
const BASELINE_RENDER_STYLE: RenderStyle = {
  intro: AGENT_INSTRUCTIONS_INTRO,
  section: sectionText,
};

/**
 * Chọn kiểu kết xuất baseline theo việc có thay thế baseline đã hiển thị hay không.
 * Nhận: files — các tệp đã nạp; replacePreviousBaseline — có thay thế baseline trước đó hay không.
 * Trả: kiểu kết xuất với câu mở đầu phù hợp (stock lib/index.js:273–279).
 */
function baselineRenderStyle(files: LoadedInstructionFile[], replacePreviousBaseline: boolean | undefined): RenderStyle {
  if (replacePreviousBaseline !== true) return BASELINE_RENDER_STYLE;
  return {
    ...BASELINE_RENDER_STYLE,
    intro: files.length === 0 ? EMPTY_REPLACEMENT_AGENT_INSTRUCTIONS_INTRO : REPLACEMENT_AGENT_INSTRUCTIONS_INTRO,
  };
}

/**
 * Dựng văn bản cho MỘT chuyển trạng thái.
 * Nhận: item — chuyển trạng thái + nội dung hiện tại.
 * Trả: văn bản mục "set" · "remove" · "replace" (stock lib/index.js:280–291).
 */
function changedSectionText(item: ChangeRenderItem): string {
  const { change, file } = item;
  if (change.action === "set") return additionalSectionText(file);
  if (change.action === "remove") {
    return (
      "Instructions removed: " +
      change.path +
      "\n\nThe previously loaded instructions from this file no longer apply."
    );
  }
  return [
    "Updated instructions from: " + change.path,
    "",
    "This file changed after it was loaded. Use the following content instead of the previously loaded instructions from this file.",
    "",
    file.content,
  ].join("\n");
}

/**
 * Kết xuất MỘT lô đối soát và chỉ giữ các chuyển trạng thái vừa ngân sách.
 * Nhận: items — chuyển trạng thái có thứ tự kèm nội dung tệp hiện tại; maxBytes — trần byte UTF-8 của lô.
 * Trả: văn bản có ngân sách và các chuyển trạng thái thực sự được văn bản đại diện (stock lib/index.js:298–316).
 */
export function renderInstructionChanges(
  items: ChangeRenderItem[],
  maxBytes: number,
): { text: string; changes: AgentInstructionChange[] } {
  const byAbsolutePath = new Map<string, ChangeRenderItem>(
    items.map((item) => [item.file.absolutePath, item] as const),
  );
  const rendered = renderInstructionContext(
    items.map((item) => item.file),
    maxBytes,
    {
      intro: "",
      section(file: LoadedInstructionFile): string {
        const item = byAbsolutePath.get(file.absolutePath);
        return item === undefined ? "" : changedSectionText({ ...item, file });
      },
    },
  );
  const represented = new Set(rendered.represented.map((file) => file.absolutePath));
  return {
    text: rendered.text,
    changes: items.filter((item) => represented.has(item.file.absolutePath)).map((item) => item.change),
  };
}

/**
 * Dựng dòng thông báo ngân sách: tệp bị bỏ và tệp bị cắt.
 * Nhận: maxBytes — trần ngân sách; omitted — tệp bị bỏ; truncated — tệp bị cắt.
 * Trả: câu thông báo, hoặc chuỗi rỗng khi không có gì bị bỏ/cắt (stock lib/index.js:317–323).
 */
function markerText(maxBytes: number, omitted: InstructionFile[], truncated: TruncatedInstruction[]): string {
  if (omitted.length === 0 && truncated.length === 0) return "";
  const parts: string[] = [];
  if (omitted.length > 0) parts.push("omitted " + omitted.map((file) => file.displayPath).join(", "));
  if (truncated.length > 0) {
    parts.push(
      "truncated " +
        truncated
          .map(
            (item) =>
              item.displayPath +
              " from " +
              item.originalBytes +
              " to " +
              item.includedBytes +
              " bytes",
          )
          .join(", "),
    );
  }
  return "Workspace instruction budget " + maxBytes + " bytes: " + parts.join("; ");
}

/**
 * Dựng văn bản cuối cùng trong khung system-reminder.
 * Nhận: files — tệp được đưa vào; maxBytes — trần ngân sách; omitted — tệp bị bỏ;
 *      truncated — tệp bị cắt; style — kiểu kết xuất.
 * Trả: văn bản đã bọc khung (stock lib/index.js:324–334).
 */
function buildInstructionText(
  files: LoadedInstructionFile[],
  maxBytes: number,
  omitted: InstructionFile[],
  truncated: TruncatedInstruction[],
  style: RenderStyle,
): string {
  return [
    SYSTEM_REMINDER_OPEN,
    escapeInstructionFrameBody(
      [
        markerText(maxBytes, omitted, truncated),
        style.intro,
        ...files.map((file) => style.section(file)),
      ]
        .filter((block) => block.length > 0)
        .join("\n\n"),
    ),
    SYSTEM_REMINDER_CLOSE,
  ].join("\n");
}

/**
 * Sao chép một tệp với nội dung đã cắt còn includedBytes byte.
 * Nhận: file — tệp nguồn; includedBytes — số byte được giữ.
 * Trả: bản sao tệp với nội dung đã cắt (stock lib/index.js:335–340).
 */
function withTruncatedContent(file: LoadedInstructionFile, includedBytes: number): LoadedInstructionFile {
  return {
    ...file,
    content: truncateUtf8(file.content, includedBytes),
  };
}

/**
 * Tìm số byte LỚN NHẤT của tệp cuối còn vừa ngân sách (tìm nhị phân).
 * Nhận: file — tệp cần cắt; includedFiles — các tệp đã chắc chắn vừa;
 *      maxBytes — trần ngân sách; omitted — tệp bị bỏ; style — kiểu kết xuất.
 * Trả: tệp đã cắt vừa ngân sách (stock lib/index.js:341–360).
 */
function truncateToFit(
  file: LoadedInstructionFile,
  includedFiles: LoadedInstructionFile[],
  maxBytes: number,
  omitted: InstructionFile[],
  style: RenderStyle,
): LoadedInstructionFile {
  const originalBytes = byteLength(file.content);
  let low = 0;
  let high = originalBytes;
  let best = withTruncatedContent(file, 0);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = withTruncatedContent(file, mid);
    const truncated: TruncatedInstruction[] = [
      {
        displayPath: file.displayPath,
        originalBytes,
        includedBytes: byteLength(candidate.content),
      },
    ];
    if (
      byteLength(buildInstructionText([...includedFiles, candidate], maxBytes, omitted, truncated, style)) <= maxBytes
    ) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

/**
 * Kết xuất một chuỗi tệp trong ngân sách byte, bỏ dần tệp rộng nhất rồi cắt tệp cụ thể nhất.
 * Nhận: files — tệp theo thứ tự rộng → cụ thể; maxBytes — trần ngân sách; style — kiểu kết xuất.
 * Trả: văn bản + tệp bị bỏ/cắt + tệp được đại diện (stock lib/index.js:361–440).
 */
function renderInstructionContext(files: LoadedInstructionFile[], maxBytes: number, style: RenderStyle): RenderedContext {
  if (maxBytes <= 0 || !Number.isFinite(maxBytes)) {
    return {
      text: "",
      omitted: files,
      truncated: [],
      represented: [],
    };
  }
  const fullText = buildInstructionText(files, maxBytes, [], [], style);
  if (byteLength(fullText) <= maxBytes) {
    return {
      text: fullText,
      omitted: [],
      truncated: [],
      represented: files,
    };
  }
  for (let start = 1; start < files.length; start += 1) {
    const included = files.slice(start);
    const omitted: InstructionFile[] = files.slice(0, start).map((file) => ({
      absolutePath: file.absolutePath,
      displayPath: file.displayPath,
    }));
    const suffixText = buildInstructionText(included, maxBytes, omitted, [], style);
    if (byteLength(suffixText) <= maxBytes) {
      return {
        text: suffixText,
        omitted,
        truncated: [],
        represented: included,
      };
    }
  }
  const mostSpecific = files.at(-1);
  if (mostSpecific === undefined) {
    return {
      text: "",
      omitted: [],
      truncated: [],
      represented: [],
    };
  }
  const omitted: InstructionFile[] = files.slice(0, -1).map((file) => ({
    absolutePath: file.absolutePath,
    displayPath: file.displayPath,
  }));
  const originalBytes = byteLength(mostSpecific.content);
  for (const candidateStyle of [
    style,
    {
      ...style,
      intro: COMPACT_AGENT_INSTRUCTIONS_INTRO,
    },
  ]) {
    const truncatedFile = truncateToFit(mostSpecific, [], maxBytes, omitted, candidateStyle);
    const includedBytes = byteLength(truncatedFile.content);
    const truncated: TruncatedInstruction[] = [
      {
        displayPath: mostSpecific.displayPath,
        originalBytes,
        includedBytes,
      },
    ];
    const text = buildInstructionText([truncatedFile], maxBytes, omitted, truncated, candidateStyle);
    if (byteLength(text) <= maxBytes) {
      return {
        text,
        omitted,
        truncated,
        represented: includedBytes > 0 || originalBytes === 0 ? [mostSpecific] : [],
      };
    }
  }
  const truncated: TruncatedInstruction[] = [
    {
      displayPath: mostSpecific.displayPath,
      originalBytes,
      includedBytes: 0,
    },
  ];
  const compactNotice = escapeInstructionFrameBody(markerText(maxBytes, omitted, truncated));
  const compactWithHeading = escapeInstructionFrameBody(
    [compactNotice, style.section(withTruncatedContent(mostSpecific, 0))].join("\n\n"),
  );
  if (byteLength(compactWithHeading) <= maxBytes) {
    return {
      text: compactWithHeading,
      omitted,
      truncated,
      represented: originalBytes === 0 ? [mostSpecific] : [],
    };
  }
  return {
    text: byteLength(compactNotice) <= maxBytes ? compactNotice : truncateUtf8(compactNotice, maxBytes),
    omitted,
    truncated,
    represented: [],
  };
}

/**
 * Kết xuất một baseline CÙNG với đúng các tệp nguồn được đại diện về mặt ngữ nghĩa trong đó.
 * Nhận: files — tệp đã nạp theo thứ tự rộng → cụ thể; options — ngân sách byte và việc baseline này
 *      có thay thế baseline đã hiển thị hay không.
 * Trả: bản kết xuất công khai có ngân sách + các tệp còn nội dung sống sót, kể cả tệp RỖNG thật sự.
 * @internal (stock lib/index.js:448–455)
 */
export function renderAgentInstructionSet(
  files: LoadedInstructionFile[],
  options: { maxBytes: number; replacePreviousBaseline?: boolean },
): { rendered: RenderedAgentInstructions; included: LoadedInstructionFile[] } {
  const style = baselineRenderStyle(files, options.replacePreviousBaseline);
  const { represented, ...rendered } = renderInstructionContext(files, options.maxBytes, style);
  return {
    rendered,
    included: represented,
  };
}

/**
 * Kết xuất chuỗi chỉ dẫn baseline với ngân sách ưu tiên tất định.
 * Nhận: files — tệp đã nạp theo thứ tự rộng → cụ thể; options — ngân sách byte và việc baseline này
 *      có thay thế baseline đã hiển thị hay không.
 * Trả: văn bản baseline có ngân sách + chẩn đoán ngân sách (stock lib/index.js:462–464).
 */
export function renderAgentInstructions(
  files: LoadedInstructionFile[],
  options: { maxBytes: number; replacePreviousBaseline?: boolean },
): RenderedAgentInstructions {
  return renderAgentInstructionSet(files, options).rendered;
}
