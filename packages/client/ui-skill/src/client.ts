/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua browser: giao dien skill — locale, hai slot occupant, RPC skills qua api-remotes, nguon goi y '/'
 */

/** `require` của factory do vỏ cấp (nguồn seed nền tảng: react, jsx-runtime, primitives). */
import { SkillReference, SkillRow } from "./skill-row.ts";
import { vi } from "./locales-vi.ts";
declare const require: (specifier: string) => unknown;

/** Một skill trong catalog Host trả về. */
interface SkillInfo {
  /** Tên skill (không kèm dấu `/`). */
  name: string;
  /** Mô tả hiển thị trong menu. */
  description: string;
  /** Model có được tự gọi skill này không. */
  modelInvocable: boolean;
  /** Đường dẫn file skill (để mở trong sidebar phải). */
  path: string;
}

/** Bề mặt seed primitives mà row này dùng (tên tra từ bản gốc, giữ nguyên). */
interface PrimitivesFace {
  /** Xếp hạng danh sách gợi ý theo tên. */
  rankByName<T>(items: T[], query: string): T[];
}

/** Context phía browser mà row này cần. */
interface PageContext {
  /** Đăng ký hiệu ứng vào vòng đời plugin. */
  effect(callback: () => unknown, label?: string): void;
  /** Tầng locale. */
  locale: {
    bind(namespace: string): (key: string) => string;
    register(namespace: string, dictionaries: Record<string, unknown>): unknown;
  };
  /** Tầng slots. */
  slots: {
    inject(slot: string, callback: () => unknown): unknown;
    register(occupant: Record<string, unknown>, component: unknown): unknown;
  };
  /** Tầng hội thoại: nơi đăng ký luật tham chiếu cho nội dung người dùng. */
  uiConversation: { userText: { register(rule: Record<string, unknown>): unknown } };
  /** Tầng phiên: lấy catalog skill theo phiên đang mở. */
  sessions: {
    binding(sessionId: string): unknown;
    scope(sessionId: string): unknown;
    subagentAddress(sessionId: string): unknown;
    list: { getSnapshot(): { byId: Record<string, { cwd?: string } | undefined> } };
    using<T>(sessionId: string, options: Record<string, unknown>, run: (reference: unknown) => Promise<T>): Promise<T>;
  };
  /** Tầng RPC sang row host `api-remotes`. */
  remote: {
    skills: { list(request: { sessionId: string }, signal: AbortSignal): Promise<{ ok: true; value: { skills: SkillInfo[] } } | { ok: false; error: { code: string; message: string } }> };
    $on(event: string, listener: (key: string) => void): unknown;
  };
  /** Tầng sidebar phải: mở tài nguyên theo địa chỉ. */
  sidebarRight: { openResource(address: string): unknown };
  /** Tầng nguồn gợi ý của ô soạn thảo. */
  inputTriggers: { registerSource(source: Record<string, unknown>): () => void };
  /** Đọc một service theo tên (bản gốc dùng cho inputTriggers). */
  get(name: string): unknown;
  /** Nghe sự kiện vòng đời của kết nối. */
  on(event: string, listener: () => void): unknown;
}

/** Bộ primitive lấy từ seed nền tảng. */
const primitives = require("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesFace;
// 18/10/2026 (task-29, Wave D): PHÁT scheme mới gbh-resource:// (bản gốc dùng dsh-resource://).
//   Nơi NHẬN (kể cả sidebarRight.placeResource của gói khác) chấp nhận cả hai scheme.
/** Prefix địa chỉ tài nguyên tệp — scheme MỚI của Galaxy Blackhole. */
const FILE_ADDRESS_PREFIX = "gbh-resource://file/";
/** Dictionary namespace do plugin này sở hữu. */
export const NS = "skill";
/** Từ điển tiếng Trung (bộ khoá là nguồn sự thật). */
const zh = {
  "row.title": "加载技能",
  "row.running": "正在加载 skill",
  "row.preparing": "准备加载技能",
  "row.failed": "skill 加载失败",
  "row.stopped": "skill 加载已中止",
  "row.instructions": "说明",
  "row.inspect": "查看",
  "menu.userOnly": "仅用户",
};
/** Từ điển tiếng Anh (đủ khoá như zh). */
const en = {
  "row.title": "Skill",
  "row.running": "Loading skill",
  "row.preparing": "Preparing to load a skill",
  "row.failed": "Skill load failed",
  "row.stopped": "Skill load stopped",
  "row.instructions": "Instructions",
  "row.inspect": "Inspect",
  "menu.userOnly": "user-only",
};

/** Dịch vụ phía browser mà plugin này cần — NGUYÊN VĂN 8 mục từ bản gốc. */
export const inject = ["inputTriggers", "sessions", "slots", "locale", "remote", "remote.skills", "sidebarRight", "uiConversation"];

/**
 * Mã hoá một đoạn id/đường dẫn, giữ `:` nguyên vẹn cho ký tự ổ đĩa kiểu Windows.
 * Nhận: đoạn cần mã hoá.
 * Trả: đoạn đã mã hoá.
 */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/%3A/gi, ":");
}

/**
 * Mã hoá đường dẫn theo từng đoạn `/`.
 * Nhận: đường dẫn.
 * Trả: đường dẫn đã mã hoá.
 */
function encodePath(path: string): string {
  return path.split("/").map(encodeSegment).join("/");
}

/**
 * Địa chỉ tài nguyên cho một file trong phiên.
 * Nhận: id phiên và đường dẫn.
 * Trả: địa chỉ `gbh-resource://file/session/…`.
 */
function sessionFileAddress(sessionId: string, path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  return FILE_ADDRESS_PREFIX + "session/" + encodeSegment(sessionId) + "/" + encodePath(normalized);
}

/**
 * Địa chỉ tài nguyên cho đường dẫn tuyệt đối hoặc tương đối trong workspace.
 * Nhận: id phiên, thư mục làm việc, đường dẫn.
 * Trả: địa chỉ tài nguyên đã quy về dạng của phiên.
 */
function fileAddressFor(sessionId: string, cwd: string | undefined, path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const absolute = normalized.startsWith("/") || /^[A-Za-z]:[/\\]/.test(normalized) || normalized.startsWith("\\\\");
  if (!absolute) return sessionFileAddress(sessionId, normalized);
  const root = cwd === undefined ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
  if (root !== "" && normalized.startsWith(root + "/")) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
  return sessionFileAddress(sessionId, normalized);
}

/**
 * Luật tham chiếu `/ten-skill` trong nội dung người dùng (id occupant `skill`, order 20 — nguyên văn).
 * Nhận: không.
 * Trả: đối tượng luật cho `uiConversation.userText.register`.
 */
function skillReferenceRule(): Record<string, unknown> {
  return {
    id: "skill",
    order: 20,
    /** Tìm token `/ten` đã xác nhận trong từ điển của phiên. */
    match(text: string, from: number, context: { read(key: string): string[] | undefined }): unknown {
      const tokens = /(?<!\S)\/([\w-]+)(?!\S)/gu;
      tokens.lastIndex = from;
      let names: string[] | undefined;
      for (let token = tokens.exec(text); token !== null; token = tokens.exec(text)) {
        if (names === undefined) {
          names = context.read("skillNames");
          if (names === undefined || names.length === 0) return undefined;
        }
        const name = token[1] ?? "";
        if (names.includes(name)) return { id: "skill", start: token.index, end: token.index + token[0].length, data: { name } };
      }
      return undefined;
    },
  };
}

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE (hai entry ⇒ hai ctx nên khoá theo ctx không chặn được).
 * Bật SAU khi phần đăng ký chạy xong; bật sớm mà đăng ký ném giữa đường ⇒ slot không được đăng ký lại.
 */
let installed = false;

/**
 * Thân plugin: từ điển, luật tham chiếu, hai slot occupant, nguồn gợi ý `/` và hai đăng ký Remote.
 * Nhận: context gốc phía client.
 * Trả: không.
 */
function applyInner(ctx: PageContext): void {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-skill: dictionaries");
  ctx.uiConversation.userText.register(skillReferenceRule());

  const skills = ctx.remote.skills;
  const sessions = ctx.sessions;
  const fetches = new Map<string, { promise: Promise<SkillInfo[]>; abort: AbortController; settled?: SkillInfo[] }>();
  const lexiconListeners = new Map<string, Set<() => void>>();

  /** Báo người nghe từ điển của phiên rằng catalog vừa đổi. */
  const notifyLexicon = (sessionId: string): void => {
    for (const listener of [...(lexiconListeners.get(sessionId) ?? [])]) {
      try {
        listener();
      } catch (error) {
        console.error("[ui-skill] lexicon listener failed:", error);
      }
    }
  };

  /** Lấy catalog skill của phiên (memoize theo phiên, có AbortController). */
  const fetchCatalog = (sessionId: string): { promise: Promise<SkillInfo[]>; abort: AbortController; settled?: SkillInfo[] } => {
    const existing = fetches.get(sessionId);
    if (existing !== undefined) return existing;
    const abort = new AbortController();
    const promise = (async (): Promise<SkillInfo[]> => {
      if (sessions.binding(sessionId) === undefined) throw new Error('skill catalog requires a retained session "' + sessionId + '"');
      return sessions.using(sessionId, { source: "skillCatalog", signal: abort.signal }, async (reference) => {
        abort.signal.throwIfAborted();
        const state = (reference as { binding: { session: { getSnapshot(): { openState: string; openError?: Error } } } }).binding.session.getSnapshot();
        const notOpen = new Error('session "' + sessionId + '" is not open');
        if (state.openState !== "open") throw state.openError ?? notOpen;
        const result = await skills.list({ sessionId }, abort.signal);
        abort.signal.throwIfAborted();
        if (!result.ok) throw new Error("skills/list failed: " + result.error.code + ": " + result.error.message);
        return result.value.skills;
      });
    })();
    const entry: { promise: Promise<SkillInfo[]>; abort: AbortController; settled?: SkillInfo[] } = { promise, abort };
    fetches.set(sessionId, entry);
    promise.then(
      (catalog) => {
        entry.settled = catalog;
        notifyLexicon(sessionId);
      },
      () => {
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId);
      },
    );
    return entry;
  };

  /** Huỷ catalog của một phiên để lần hỏi sau lấy bản mới. */
  const invalidate = (key: string): void => {
    const entry = fetches.get(key);
    if (entry === undefined) return;
    fetches.delete(key);
    entry.abort.abort();
    notifyLexicon(key);
  };

  /** Nguồn gợi ý `/` cho ô soạn thảo (trigger `/`, name `skill`, order 2 — nguyên văn). */
  /** Huỷ toàn bộ catalog đang giữ (dùng khi kết nối được đặt lại). */
  const clearAll = (): void => {
    for (const key of [...fetches.keys()]) invalidate(key);
  };

  const source: Record<string, unknown> = {
    trigger: "/",
    name: "skill",
    order: 2,
    /** Danh sách gợi ý cho truy vấn hiện tại. */
    async candidates(session: { sessionId: string }, { query, signal }: { query: string; signal: AbortSignal }): Promise<{ name: string; description: string }[]> {
      if (sessions.subagentAddress(session.sessionId) !== undefined) return [];
      const catalog = await fetchCatalog(session.sessionId).promise;
      if (signal.aborted) return [];
      return primitives.rankByName(catalog, query).map((skill) => ({
        name: skill.name,
        description: skill.modelInvocable ? skill.description : t("menu.userOnly") + " · " + skill.description,
      }));
    },
    /** Nạp trước catalog khi phiên mở. */
    warm(session: { sessionId: string }): void {
      if (sessions.subagentAddress(session.sessionId) !== undefined) return;
      fetchCatalog(session.sessionId).promise.catch(() => undefined);
    },
    /** Từ điển tên skill đã biết của phiên (cho luật tham chiếu). */
    lexicon(session: { sessionId: string }): string[] | undefined {
      return fetches.get(session.sessionId)?.settled?.map((skill) => skill.name);
    },
    /** Nghe thay đổi từ điển của phiên. */
    subscribeLexicon(session: { sessionId: string }, listener: () => void): () => void {
      const key = session.sessionId;
      const listeners = lexiconListeners.get(key) ?? new Set<() => void>();
      listeners.add(listener);
      lexiconListeners.set(key, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) lexiconListeners.delete(key);
      };
    },
    /** Mở file skill tương ứng `/ten` trong sidebar phải. */
    openReference(session: { sessionId: string }, { ref }: { ref: string }): boolean {
      if (sessions.subagentAddress(session.sessionId) !== undefined) return false;
      const cwd = sessions.list.getSnapshot().byId[session.sessionId]?.cwd;
      const open = (catalog: SkillInfo[]): boolean => {
        const found = catalog.find((skill) => "/" + skill.name === ref);
        if (found === undefined) return false;
        ctx.sidebarRight.openResource(fileAddressFor(session.sessionId, cwd, found.path));
        return true;
      };
      const settled = fetches.get(session.sessionId)?.settled;
      if (settled !== undefined) return open(settled);
      const entry = fetchCatalog(session.sessionId);
      entry.promise
        .then((catalog) => {
          if (!entry.abort.signal.aborted) open(catalog);
        })
        .catch((error: unknown) => {
          if (!entry.abort.signal.aborted) console.error("[ui-skill] reference preview failed:", error);
        });
      return true;
    },
    /** Chèn `/ten ` khi người dùng chọn một gợi ý. */
    onPick({ candidate }: { candidate: { name: string } }): { text: string } {
      return { text: "/" + candidate.name + " " };
    },
  };
  const inputTriggers = ctx.get("inputTriggers") as { registerSource(source: Record<string, unknown>): () => void } | undefined;
  ctx.on("connection/reset", clearAll);
  ctx.effect(() => {
    if (inputTriggers === undefined) return;
    const unregister = inputTriggers.registerSource(source);
    return () => {
      unregister();
      clearAll();
    };
  }, "ui-skill: input trigger source");

  // Hai slot occupant: TÊN SLOT VIẾT NGUYÊN VĂN TẠI CHỖ (check:rows đọc văn bản).
  ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: "skill", locale: NS }, SkillRow));
  ctx.slots.inject("conversation.user.text.node", () =>
    ctx.slots.register(
      {
        name: "conversation.user.text.node",
        key: "skill",
        priority: 100,
        inject: (sessionId: string) => ({
          openSkill: (name: string) => {
            if (sessions.scope(sessionId) === undefined) return;
            (source.openReference as (session: { sessionId: string }, ref: { ref: string }) => boolean)(
              { sessionId },
              { ref: "/" + name },
            );
          },
        }),
      },
      SkillReference,
    ),
  );

  // Catalog phải bị huỷ khi Host đổi agent preset (giữ nguyên tên event của bản gốc).
  ctx.effect(() => ctx.remote.$on("agent-preset/selected", (key) => invalidate(key)), "ui-skill: catalog invalidations");

  // CÒN THIẾU: hai component hiển thị (SkillRow · SkillReference) + CSS Modules của bản gốc.
  // Test canh giữ `gbh.row` CHƯA khai cho tới khi xong — xem README.
}

/**
 * Mount giao diện skill, chặn cài lần hai bằng cờ PHẠM VI MODULE.
 * Nhận: context gốc phía client.
 * Trả: không.
 */
export function apply(ctx: PageContext): void {
  if (installed) return;
  try {
    applyInner(ctx);
    installed = true;
  } catch (error) {
    console.error("gbh-client-ui-skill: apply ném lỗi", error);
    throw error;
  }
}


