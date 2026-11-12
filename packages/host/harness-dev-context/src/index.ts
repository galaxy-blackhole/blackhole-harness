/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ngữ cảnh phát triển của harness cho một agent có thể soi và mở rộng chính DSH đang phục vụ
 *      Web GUI: đăng ký hai mục system prompt KHÔNG chứa đường dẫn/URL, nêu checkout và URL Web GUI
 *      hiện tại bằng runtime context, và giữ nguyên văn đoạn prompt mà phiên đã nhận. Bản viết lại
 *      của Galaxy Blackhole cho row harness-dev-context — nguồn đối chiếu: xem README.md (G4).
 */

import { fileURLToPath } from "node:url";
import { z as zod } from "zod/v4";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "harness-dev-context";

/** Service bắt buộc: sổ system prompt, sổ chiếu phiên, và Web GUI mà URL của nó được nêu. */
export const inject: string[] = ["systemPrompt", "sessionProjections", "webApp"];

/** Gốc của bản cài này — bốn thư mục phía trên điểm vào nguồn hoặc bản build của package. */
const SOURCE_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));

/** Tên mục prompt và runtime-context của checkout triển khai. */
const HARNESS_SOURCE = "harness:source";

/** Tên mục prompt và runtime-context của bề mặt Web GUI và URL của nó. */
const WEB_SURFACE = "app:web-surface";

/** Nguyên văn câu mô tả checkout, dùng khi phiên CHƯA nhận đoạn nào mang giá trị. */
const HARNESS_SOURCE_PROMPT = "The runtime context names the Galaxy Blackhole implementation checkout. The checkout location and current working directory are separate values and may differ; never infer the working directory from the checkout path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself.";

/** Nguyên văn câu mô tả bề mặt Web GUI, dùng khi phiên CHƯA nhận đoạn nào mang giá trị. */
const WEB_SURFACE_PROMPT = `You are interacting with the user through the Galaxy Blackhole Web GUI whose URL the runtime context names. When the user refers to "this page", "this GUI", or "this app" without naming another target, they mean this GUI. The browser provides no implicit DOM, route, or screenshot context. The client-plugin HMR receiver is active, but client-plugin changes reload without a refresh only while \`pnpm run dev:web\` is also running from this same checkout to rebuild their bundles; verify that watcher before promising automatic updates. Every other change — the apps/web shell and plain packages — requires rebuilding the affected Web artifacts and verifying this existing URL after a page refresh. Starting another server does not update this GUI. The apps/web Vite entry builds the shell but is not a standalone application because only dsh web injects window.__GBH_BOOT__. Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL.`;

/**
 * Phần văn bản CỐ ĐỊNH quanh giá trị trong mỗi đoạn đã từng nhúng giá trị — đóng băng y như lúc
 * các bản phát hành đó render: đừng sửa cùng lúc với câu hướng dẫn hiện tại, nếu không các phiên
 * đang giữ đoạn cũ sẽ không khớp nữa và prompt đã ghi của chúng bị viết lại.
 */
interface LegacyBounds {
  /** Văn bản đứng ngay TRƯỚC giá trị (kết thúc bằng khoảng trắng). */
  readonly prefix: string;
  /** Văn bản đứng ngay SAU giá trị (bắt đầu bằng dấu chấm). */
  readonly suffix: string;
}

/** Mốc cắt của đoạn mang checkout triển khai. */
const LEGACY_SOURCE: LegacyBounds = {
  prefix: "The Galaxy Blackhole implementation checkout is at ",
  suffix: ". The checkout location and current working directory are separate values and may differ; never infer the working directory from this path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself.",
};

/** Mốc cắt của đoạn mang URL Web GUI. */
const LEGACY_WEB_SURFACE: LegacyBounds = {
  prefix: "You are interacting with the user through the Galaxy Blackhole Web GUI at ",
  suffix: `. When the user refers to "this page", "this GUI", or "this app" without naming another target, they mean this GUI. The browser provides no implicit DOM, route, or screenshot context. The client-plugin HMR receiver is active, but client-plugin changes reload without a refresh only while \`pnpm run dev:web\` is also running from this same checkout to rebuild their bundles; verify that watcher before promising automatic updates. Every other change — the apps/web shell and plain packages — requires rebuilding the affected Web artifacts and verifying this existing URL after a page refresh. Starting another server does not update this GUI. The apps/web Vite entry builds the shell but is not a standalone application because only dsh web injects window.__GBH_BOOT__. Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL.`,
};

/** Khoá chiếu host-only của đoạn mang giá trị mà một phiên đã nhận. */
const LEGACY_PROMPT = "harnessDevLegacyPrompt";

/** Hai đoạn văn mang giá trị của system prompt mới nhất mà phiên đã cam kết; `null` khi không có. */
interface LegacyPrompt {
  /** Đoạn mang checkout, hoặc `null` khi prompt không có đoạn đó. */
  readonly source: string | null;
  /** Đoạn mang URL Web GUI, hoặc `null` khi prompt không có đoạn đó. */
  readonly web: string | null;
}

/** Một khối nội dung của sự kiện `system/message`. */
interface PromptBlock {
  /** Loại khối; chỉ khối `text` mang văn bản. */
  readonly type: string;
  /** Văn bản của khối — chỉ đọc sau khi đã xác nhận `type === "text"`. */
  readonly text: string;
}

/** Một sự kiện phiên đã cam kết, khai theo CẤU TRÚC: chỉ phần phép gộp này đọc. */
interface SessionMessageEvent {
  /** Loại sự kiện. */
  readonly type: string;
  /** Dữ liệu sự kiện; chỉ `system/message` có `message.content`. */
  readonly data: {
    /** Tin hệ thống đã cam kết. */
    readonly message: {
      /** Các khối nội dung của tin. */
      readonly content: readonly PromptBlock[];
    };
  };
}

/** Schema trạng thái đã lưu: seam `sessionProjections` CHỈ gọi `parse` trước khi mồi phép gộp. */
interface StateSchema<T> {
  /** Kiểm và chuẩn hoá một giá trị đã lưu; ném khi không hợp lệ. */
  parse(value: unknown): T;
}

/** Schema zod của trạng thái chiếu — giữ ĐÚNG hình dạng bản gốc khai. */
const legacyPromptSchema: StateSchema<LegacyPrompt> = zod.object({
  source: zod.string().nullable(),
  web: zod.string().nullable(),
});

/**
 * Đoạn một dòng HOÀN CHỈNH nằm giữa `prefix` và `suffix`, hoặc `null` khi prompt không có đoạn đó.
 * Nhận: văn bản prompt của phiên và hai mốc cắt.
 * Trả: đoạn đã cắt (kể cả hai mốc) khi nó nằm trên MỘT dòng, ngược lại `null`.
 */
function legacyParagraph(prompt: string, { prefix, suffix }: LegacyBounds): string | null {
  const start = prompt.indexOf(prefix);
  if (start < 0) return null;
  const end = prompt.indexOf(suffix, start + prefix.length);
  if (end < 0) return null;
  const paragraph = prompt.slice(start, end + suffix.length);
  return paragraph.includes("\n") ? null : paragraph;
}

/**
 * Gộp một sự kiện đã cam kết vào hai đoạn đã nhận. Như chính cách vòng agent đọc phiên bản prompt,
 * chỉ MỘT khối văn bản không rỗng mới là một phiên bản prompt; phiên bản đã bị làm rỗng hoặc khác
 * loại thì giữ nguyên trạng thái trước, vì một lần gộp chuỗi có thể chỉ ghi lại phiên bản rỗng sau.
 * Nhận: trạng thái trước và sự kiện đã cam kết.
 * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi hai đoạn không đổi.
 */
function foldLegacyPrompt(state: LegacyPrompt, event: SessionMessageEvent): LegacyPrompt {
  if (event.type !== "system/message") return state;
  const { content } = event.data.message;
  const [block] = content;
  if (content.length !== 1 || block === undefined || block.type !== "text" || block.text === "") return state;
  const source = legacyParagraph(block.text, LEGACY_SOURCE);
  const web = legacyParagraph(block.text, LEGACY_WEB_SURFACE);
  return source === state.source && web === state.web ? state : { source, web };
}

/** Trạng thái "chưa nhận đoạn nào" — bản gốc dùng CHUNG một vật thể cho mọi phiên. */
const ADMITS_NOTHING: LegacyPrompt = { source: null, web: null };

/** Ngữ cảnh render prompt: agent và phiên đang được dựng prompt (nếu có). */
interface PromptContext {
  /** Agent đang chạy; vắng mặt ở lượt dựng prompt không gắn agent. */
  readonly agent?: {
    /** Phiên của agent; vắng mặt khi agent chưa gắn phiên. */
    readonly session?: unknown;
  };
}

/** Một mục system prompt mà seam `systemPrompt` nhận. */
interface PromptSection {
  /** Tên mục — trùng tên runtime-context cùng cặp. */
  readonly name: string;
  /** Thứ tự dựng; lấy từ bảng của kernel, không tự đặt số. */
  readonly order: number;
  /** `false` ⇒ giữ nguyên văn, KHÔNG thay biến prompt. */
  readonly interpolate?: boolean;
  /** Văn bản, hoặc hàm dựng văn bản theo ngữ cảnh render. */
  readonly text: string | ((context: PromptContext) => string);
}

/** Một dòng runtime context mà seam `systemPrompt` nhận. */
interface PromptContextEntry {
  /** Tên dòng — trùng tên mục prompt cùng cặp. */
  readonly name: string;
  /** Thứ tự dựng; lấy từ bảng của kernel, không tự đặt số. */
  readonly order: number;
  /** `false` ⇒ giữ nguyên văn, KHÔNG thay biến prompt. */
  readonly interpolate?: boolean;
  /** Văn bản, hoặc hàm dựng văn bản theo ngữ cảnh render. */
  readonly text: string | ((context: PromptContext) => string);
}

/** Seam `systemPrompt` — tra theo hình dạng, KHÔNG import gói seam. */
interface SystemPromptSeam {
  /** Đăng ký một mục prompt; seam thật ném khi `order` không hữu hạn. */
  section(section: PromptSection): unknown;
  /** Đăng ký một dòng runtime context; seam thật ném khi `order` không hữu hạn. */
  context(entry: PromptContextEntry): unknown;
  /** Vị trí trung tâm của một mục prompt theo tên ổn định. */
  getSectionOrder(name: string): number;
  /** Vị trí trung tâm của một dòng runtime context theo tên ổn định. */
  getContextOrder(name: string): number;
}

/** Một định nghĩa đơn vị chiếu host-only mà seam `sessionProjections` nhận. */
interface SessionProjectionDefinition<T> {
  /** Khoá chiếu; bản gốc dùng `harnessDevLegacyPrompt`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: StateSchema<T>;
  /** Trạng thái cho log rỗng và metadata phiên. */
  init(header?: unknown, inheritedEventCount?: number): T;
  /** Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau. */
  apply(state: T, event: SessionMessageEvent): T;
}

/** Seam `sessionProjections`: nơi row đăng ký bộ chiếu và đọc trạng thái hiện tại của nó. */
interface SessionProjectionsSeam {
  /** Đăng ký một đơn vị chiếu host-only; seam thật ném khi `stateVersion` không phải số nguyên ≥ 0. */
  register(definition: SessionProjectionDefinition<LegacyPrompt>): unknown;
  /** Đọc trạng thái hiện tại của một khoá chiếu cho một phiên. */
  stateOf(session: unknown, key: string): LegacyPrompt;
}

/** Seam `webApp` — chỉ phần row này dùng. */
interface WebAppSeam {
  /** URL công khai mà app đang quảng bá cho lượt truy cập hiện tại. */
  getAdvertisedUrl(): string;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: ba seam, không import gói seam nào. */
interface HarnessDevContext {
  /** Sổ system prompt: hai mục và hai dòng runtime context. */
  readonly systemPrompt: SystemPromptSeam;
  /** Sổ chiếu phiên: nơi đoạn đã nhận của phiên được đăng ký và đọc. */
  readonly sessionProjections: SessionProjectionsSeam;
  /** Web GUI đang phục vụ — nguồn của URL được nêu trong runtime context. */
  readonly webApp: WebAppSeam;
}

/**
 * Đăng ký hai mục prompt, hai dòng runtime context mang giá trị của chúng, và đơn vị chiếu giữ
 * nguyên văn đoạn mà phiên đã nhận.
 * Nhận: context cordis có đủ mọi service trong {@link inject}.
 * Trả: không; seam thật trả hàm dọn cho từng đăng ký.
 */
export function apply(ctx: HarnessDevContext): void {
  ctx.sessionProjections.register({
    key: LEGACY_PROMPT,
    stateVersion: 1,
    stateSchema: legacyPromptSchema,
    init: () => ADMITS_NOTHING,
    apply: foldLegacyPrompt,
  });
  /**
   * Đoạn mang giá trị mà phiên của lượt render này đã nhận; rỗng khi không có agent/phiên.
   * Nhận: ngữ cảnh render prompt.
   * Trả: trạng thái chiếu `harnessDevLegacyPrompt` của phiên, hoặc vật thể rỗng dùng chung.
   */
  const admitted = (context: PromptContext): LegacyPrompt => {
    const session = context.agent?.session;
    return session === undefined ? ADMITS_NOTHING : ctx.sessionProjections.stateOf(session, LEGACY_PROMPT);
  };
  ctx.systemPrompt.section({
    name: HARNESS_SOURCE,
    order: ctx.systemPrompt.getSectionOrder("HARNESS_SOURCE"),
    interpolate: false,
    text: (context) => admitted(context).source ?? HARNESS_SOURCE_PROMPT,
  });
  ctx.systemPrompt.context({
    name: HARNESS_SOURCE,
    order: ctx.systemPrompt.getContextOrder("HARNESS_SOURCE"),
    interpolate: false,
    text: `Current Galaxy Blackhole implementation checkout: ${JSON.stringify(SOURCE_ROOT)}.`,
  });
  ctx.systemPrompt.section({
    name: WEB_SURFACE,
    order: ctx.systemPrompt.getSectionOrder("WEB_SURFACE"),
    interpolate: false,
    text: (context) => admitted(context).web ?? WEB_SURFACE_PROMPT,
  });
  ctx.systemPrompt.context({
    name: WEB_SURFACE,
    order: ctx.systemPrompt.getContextOrder("WEB_SURFACE"),
    interpolate: false,
    text: () => `Current Galaxy Blackhole Web GUI URL: ${JSON.stringify(ctx.webApp.getAdvertisedUrl())}.`,
  });
}
