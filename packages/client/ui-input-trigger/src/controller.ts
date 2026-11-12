/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/client/controller.js của bản gốc — trạng thái + điều phối pipeline trigger theo phiên
 */

import { detectTrigger } from "./detect.ts";
import { MENU_CLOSED, menuReduce, seedGroups } from "./menu.ts";
import type {
  ClientContextLike,
  ClientSessionContext,
  CreateSnapshotStore,
  InputTriggerCandidate,
  InputTriggerCrumb,
  InputTriggerSource,
  MenuEvent,
  MenuState,
  PickOutcome,
  ReferenceInsert,
  SnapshotStore,
  TokenSpan,
  TriggerChar,
  TriggerGuard,
  TriggerHit,
} from "./types.ts";

/**
 * Dấu vết của một lần người dùng đóng menu (cùng token, cùng query, cùng span).
 * Nhận: không có.
 * Trả: hợp đồng kiểu DismissedHit.
 */
export interface DismissedHit {
  /** Ký tự kích hoạt. */
  readonly trigger: TriggerChar;
  /** Query lúc đóng. */
  readonly query: string;
  /** Token có mở ngoặc kép hay không. */
  readonly quoted: boolean;
  /** Đầu span lúc đóng. */
  readonly start: number;
  /** Cuối span lúc đóng. */
  readonly end: number;
}

/**
 * Roster nguồn mà controller đọc: theo trigger (đã xếp thứ tự) và toàn bộ.
 * Nhận: không có.
 * Trả: hợp đồng kiểu SourceRoster.
 */
export interface SourceRoster {
  /** Các nguồn của một trigger, đã xếp theo order. */
  sources(trigger: TriggerChar): readonly InputTriggerSource[];
  /** Toàn bộ nguồn đã đăng ký. */
  all(): readonly InputTriggerSource[];
}

/**
 * Phụ thuộc của một controller phiên.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerControllerDeps.
 */
export interface InputTriggerControllerDeps {
  /** Context phạm vi phiên (chủ thể dispatch sự kiện ô nhập). */
  readonly actx: ClientContextLike;
  /** Id phiên (phép chiếu ổn định). */
  readonly sessionId: string;
  /** Roster nguồn dùng chung của service. */
  readonly roster: SourceRoster;
}

/**
 * Có phải hit đang theo dõi chính là token người dùng vừa đóng (cùng token + query + span).
 * Nhận: dismissed — dấu vết lần đóng; hit — hit vừa phát hiện.
 * Trả: true khi trùng khít cả năm trường.
 */
function dismissedHit(dismissed: DismissedHit, hit: TriggerHit): boolean {
  return (
    dismissed.trigger === hit.trigger &&
    dismissed.query === hit.query &&
    dismissed.quoted === hit.quoted &&
    dismissed.start === hit.span.start &&
    dismissed.end === hit.span.end
  );
}

/**
 * Kết quả trọng tài bàn phím — nguyên văn ba giá trị của bản gốc.
 * Nhận: không có.
 * Trả: kiểu ArbitrateOutcome.
 */
export type ArbitrateOutcome = "pass" | "consumed" | "pick-highlighted" | undefined;

/**
 * Dựng lớp InputTriggerController với store ảnh chụp do bảng module cấp.
 * Nhận: createSnapshotStore — hàm tạo store ảnh chụp (require("@galaxy-blackhole/gbh-client-store")).
 * Trả: lớp controller; mỗi thực thể giữ trạng thái tương tác của MỘT phiên.
 */
export function createControllerClass(createSnapshotStore: CreateSnapshotStore) {
  /**
   * Trạng thái + điều phối pipeline trigger theo phiên. Mọi thay đổi nằm trong đây; MenuView
   * đọc từ menu và định tuyến pick của con trỏ ngược qua pick.
   */
  class InputTriggerController {
    /** Phụ thuộc (context phạm vi, id phiên, roster). */
    readonly deps: InputTriggerControllerDeps;

    /** Store trạng thái menu (theo phiên; sống qua lần đổi phiên, chết cùng scope). */
    menu: SnapshotStore<MenuState> = createSnapshotStore(MENU_CLOSED);

    /**
     * Tên nguồn được mở bằng bộ khởi chạy lập trình, hoặc null với menu do trigger/đã đóng.
     * Chrome của composer theo dõi store này để biết trạng thái mở rộng của bộ khởi chạy.
     */
    launcher: SnapshotStore<string | null> = createSnapshotStore<string | null>(null);

    /**
     * Breadcrumb do từng nguồn có tiêu đề công bố cho menu đang mở, khóa theo tên nguồn.
     * Store ảnh chụp: câu trả lời đổi theo mỗi hit, phía render theo dõi thay vì hỏi lại nguồn.
     */
    headers: SnapshotStore<Map<string, readonly InputTriggerCrumb[]>> = createSnapshotStore(
      new Map<string, readonly InputTriggerCrumb[]>(),
    );

    /**
     * Từ điển tham chiếu nóng đã gộp, nhóm theo trigger. Nguồn có hook lexicon được hỏi với
     * phép chiếu phiên; câu trả lời undefined (chưa nóng) bị bỏ; nhiều nguồn cùng trigger thì
     * nối theo thứ tự đăng ký. Store ảnh chụp vì các roll đổi bất đồng bộ.
     */
    lexicon: SnapshotStore<Map<TriggerChar, readonly string[]>> = createSnapshotStore(
      new Map<TriggerChar, readonly string[]>(),
    );

    /** Hit có thẩm quyền: nguồn sự thật duy nhất cho vật liệu CAS của span. */
    hit: TriggerHit | null = null;

    /**
     * Danh tính của hit mà người dùng đã đóng menu. Một lần đóng nghĩa là "không phải cái này,
     * không phải lúc này": cùng token cùng query vẫn giữ menu đóng. Gõ tiếp (query mới) hoặc
     * sang token khác thì xoá dấu vết.
     */
    dismissed: DismissedHit | null = null;

    /** Menu đang mở có đạt được bằng một pick khoan hay không; xoá cùng menu. */
    drilled = false;

    /** Lần nạp ứng viên đang chạy (bị huỷ khi có lần mới). */
    fetch: AbortController | null = null;

    /** Controller đã bị huỷ theo scope hay chưa. */
    disposed = false;

    /** Hàm huỷ đăng ký lexicon theo nguồn (nguồn không có hook thì không bao giờ vào). */
    lexiconOffs: Map<InputTriggerSource, () => void> = new Map();

    /**
     * @param deps - context phạm vi phiên, id phiên và roster nguồn dùng chung.
     */
    constructor(deps: InputTriggerControllerDeps) {
      this.deps = deps;
      const projection = this.project();
      for (const src of deps.roster.all()) {
        src.warm?.(projection);
        this.watchLexicon(src, projection);
      }
      this.refreshLexicon();
    }

    /**
     * Đưa một thay đổi draft/caret qua bộ phát hiện trigger và lái menu.
     * Nhận: draft - toàn văn bản nháp; caret - offset con trỏ trong draft;
     *   guard - mức sẵn sàng suy từ pha ô nhập; draftRev - revision draft hiện tại của máy ô nhập,
     *   đóng vào span của hit cho CAS lúc chọn.
     * Trả: không có.
     */
    track(draft: string, caret: number, guard: TriggerGuard, draftRev: number): void {
      if (this.disposed) return;
      const launched = this.launcher.getSnapshot() !== null;
      this.clearLauncher();
      const raw = detectTrigger(draft, caret, guard);
      if (raw === null) {
        if (launched) return;
        this.hit = null;
        if (guard.tier !== "frozen") this.dismissed = null;
        this.stopFetch();
        this.reduce({ type: "close" });
        return;
      }
      const hit: TriggerHit = {
        ...raw,
        span: {
          ...raw.span,
          draftRev,
        },
      };
      if (launched) this.dismissed = null;
      if (this.dismissed !== null) {
        if (!dismissedHit(this.dismissed, hit)) this.dismissed = null;
        else {
          this.hit = hit;
          return;
        }
      }
      const prev = this.menu.getSnapshot();
      const same =
        !launched &&
        prev.open &&
        prev.hit !== null &&
        prev.hit.trigger === hit.trigger &&
        prev.hit.query === hit.query &&
        prev.hit.quoted === hit.quoted &&
        prev.hit.span.start === hit.span.start &&
        prev.hit.span.end === hit.span.end;
      this.hit = hit;
      if (same) return;
      const roster = this.deps.roster.sources(hit.trigger);
      if (roster.length === 0) {
        this.stopFetch();
        this.reduce({ type: "close" });
        return;
      }
      if (launched || !prev.open || prev.hit === null || prev.hit.trigger !== hit.trigger) {
        this.menu.set(seedGroups(this.menu.getSnapshot(), roster));
      }
      this.reduce({
        type: "hit",
        hit,
      });
      this.refreshHeaders(hit, roster);
      this.fetchCandidates(hit, roster);
    }

    /**
     * Bật/tắt một menu chỉ chứa đúng một nguồn đã đăng ký. Hit cấp vào là một span chọn tổng hợp
     * chứ không phải token gõ tay, nhưng pick vẫn dùng callback nguồn thường và pipeline sửa ô nhập
     * theo phạm vi.
     * Nhận: source - tên nguồn đã đăng ký dưới hit.trigger; hit - hit tổng hợp mang vị trí + CAS draft.
     * Trả: không có.
     */
    toggleSource(source: string, hit: TriggerHit): void {
      if (this.disposed) return;
      if (this.launcher.getSnapshot() === source && this.menu.getSnapshot().open) {
        this.dismiss();
        return;
      }
      const match = this.deps.roster.sources(hit.trigger).find((item) => item.name === source);
      if (match === undefined) {
        this.dismiss();
        return;
      }
      this.stopFetch();
      this.hit = hit;
      this.launcher.set(source);
      this.menu.set(seedGroups(this.menu.getSnapshot(), [match]));
      this.reduce({
        type: "hit",
        hit,
      });
      this.refreshHeaders(hit, [match]);
      this.fetchCandidates(hit, [match]);
    }

    /**
     * Pick bằng con trỏ từ MenuView: định tuyến ứng viên được bấm qua onPick rồi thực thi
     * kết quả claim/insert qua sự kiện ô nhập theo phạm vi.
     * Nhận: source - tên nguồn (nhóm); index - chỉ số ứng viên trong nhóm;
     *   action - pick dứt điểm (mặc định) hoặc hành động khoan của ứng viên.
     * Trả: không có.
     */
    pick(source: string, index: number, action: "pick" | "drill" = "pick"): void {
      const state = this.menu.getSnapshot();
      const hit = this.hit;
      if (this.disposed || !state.open || hit === null) return;
      const group = state.groups.find((g) => g.source === source);
      const candidate = group !== undefined && group.status === "ready" ? group.items[index] : undefined;
      if (candidate === undefined) return;
      const src = this.deps.roster.sources(hit.trigger).find((s) => s.name === source);
      if (src === undefined) return;
      this.settle(src, candidate, hit, action);
    }

    /**
     * Pick bằng con trỏ lên một mẩu breadcrumb trên tiêu đề menu của nguồn: định tuyến qua đúng
     * đường khoan mà một dòng thư mục đi, nên quay lại một bước và đi xuống một bước chung một kết quả.
     * Nhận: source - tên nguồn (nhóm); index - chỉ số mẩu trong tiêu đề nguồn đó công bố.
     * Trả: không có.
     */
    pickCrumb(source: string, index: number): void {
      const hit = this.hit;
      if (this.disposed || !this.menu.getSnapshot().open || hit === null) return;
      const crumb = this.headers.getSnapshot().get(source)?.[index];
      if (crumb === undefined || crumb.current === true) return;
      const src = this.deps.roster.sources(hit.trigger).find((s) => s.name === source);
      if (src === undefined) return;
      this.settle(
        src,
        {
          name: crumb.label,
          value: crumb.value,
        },
        hit,
        "drill",
      );
    }

    /**
     * Rê chuột từ MenuView: đỗ tô sáng dùng chung lên ứng viên đang rê (bàn phím move và rê chuột
     * cùng lái một tô sáng — đầu vào cuối thắng).
     * Nhận: source - tên nguồn (nhóm); index - chỉ số ứng viên trong nhóm.
     * Trả: không có.
     */
    hover(source: string, index: number): void {
      if (this.disposed) return;
      this.reduce({
        type: "hover",
        source,
        index,
      });
    }

    /**
     * Trọng tài bàn phím khi menu đang mở.
     * Nhận: key - phím bị chặn; composing - đang trong IME composition thì mọi thứ đi qua.
     * Trả: pass khi trình duyệt giữ phím (menu đóng, không tô sáng, hoặc ứng viên biến mất);
     *   consumed khi menu xử lý phím mà không chọn dứt điểm (move, close, khoan, hoặc no-op chờ lọc);
     *   pick-highlighted khi ứng viên đang tô sáng được chọn và menu đóng.
     */
    arbitrate(key: string, composing: boolean): ArbitrateOutcome {
      if (composing || this.disposed) return "pass";
      const state = this.menu.getSnapshot();
      if (!state.open) return "pass";
      switch (key) {
        case "up": {
          this.reduce({
            type: "move",
            dir: -1,
          });
          return "consumed";
        }
        case "down": {
          this.reduce({
            type: "move",
            dir: 1,
          });
          return "consumed";
        }
        case "escape":
        case "tabBack": {
          this.rememberDismissed();
          this.stopFetch();
          this.reduce({ type: "close" });
          return "consumed";
        }
        case "enter": {
          if (state.highlight === null) return "pass";
          const group = state.groups.find((g) => g.source === state.highlight?.source);
          if (group === undefined || group.status !== "ready") return "consumed";
          this.pick(state.highlight.source, state.highlight.index);
          return "pick-highlighted";
        }
        case "tab": {
          if (state.highlight === null) return "pass";
          const group = state.groups.find((g) => g.source === state.highlight?.source);
          if (group === undefined || group.status !== "ready") return "consumed";
          const item = group.items[state.highlight.index];
          if (item === undefined) return "pass";
          if (item.drill === true) {
            this.pick(state.highlight.source, state.highlight.index, "drill");
            return "consumed";
          }
          this.pick(state.highlight.source, state.highlight.index);
          return "pick-highlighted";
        }
      }
      return undefined;
    }

    /**
     * Xử lý dấu cách trên token đầu dòng vừa hoàn tất: hỏi matchSpace của các nguồn (trạng thái nóng,
     * đồng bộ) và tự dispatch kết quả.
     * Nhận: không có.
     * Trả: true khi ô nhập đã thực sự áp dụng claim/insert — người gọi preventDefault đúng lúc đó.
     */
    onSpace(): boolean {
      const hit = this.hit;
      if (this.disposed || hit === null || hit.position !== "leading") return false;
      const token = hit.trigger + hit.query;
      const projection = this.project();
      for (const src of this.deps.roster.sources(hit.trigger)) {
        if (src.matchSpace === undefined) continue;
        const outcome = src.matchSpace(projection, token);
        if (outcome === undefined) continue;
        if (outcome === "handled") return true;
        return this.execute(outcome, hit.span);
      }
      return false;
    }

    /**
     * Tuần tự hoá một lần xuất hiện tham chiếu sang dạng cho model qua codec của nguồn sở hữu
     * (registry → gọi tường minh → await). Thiếu chủ hoặc codec thì từ chối — lần gửi bị chặn
     * thay vì âm thầm hạ cấp về chữ clipboard.
     * Nhận: source - tên nguồn sở hữu; ref - id tham chiếu trong phạm vi nguồn; signal - tín hiệu huỷ của lần gửi.
     * Trả: biểu diễn cho model (ví dụ <skill>name</skill>); Promise bị từ chối khi không có codec.
     */
    serializeReference(source: string, ref: string, signal: AbortSignal): Promise<string> {
      const owner = this.deps.roster.all().find((s) => s.name === source);
      if (owner?.codec === undefined) {
        return Promise.reject(new Error(`slash: no serializer for reference source "${source}"`));
      }
      return owner.codec.serialize(ref, signal);
    }

    /**
     * Định tuyến một chip về chủ của nó hoặc một token sửa được về chủ lexicon hiện tại.
     * Nhận: source - tên nguồn của chip; undefined với chữ sửa được; reference - id do nguồn sở hữu + glyph tuỳ chọn.
     * Trả: true khi một chủ đã nhận xem trước (có thể đang chờ catalog của nó).
     */
    openReference(source: string | undefined, reference: Pick<ReferenceInsert, "ref" | "appearance">): boolean {
      if (this.disposed) return false;
      const session = this.project();
      for (const owner of this.deps.roster.all()) {
        const matches =
          source === undefined
            ? reference.ref.startsWith(owner.trigger) && owner.lexicon?.(session)?.includes(reference.ref.slice(1)) === true
            : owner.name === source;
        if (matches && owner.openReference?.(session, reference)) {
          this.dismiss();
          return true;
        }
      }
      return false;
    }

    /**
     * Trọng tài lúc Enter: hỏi matchEnter của các nguồn theo thứ tự đăng ký, câu trả lời
     * khác undefined đầu tiên thắng. Kết quả trả về người gọi (máy ô nhập áp dụng trong cùng
     * lần gửi — không qua sự kiện).
     * Nhận: line - draft đã cắt khoảng trắng (ký tự đầu chọn roster trigger);
     *   signal - tín hiệu huỷ theo lần gửi; envelope - trạng thái gửi phi văn bản đi cùng draft.
     * Trả: kết quả thắng hoặc undefined (sink mặc định). Từ chối khi nguồn được hỏi mồi lỗi
     *   hoặc nguồn thắng từ chối phong bì — người gọi không được hạ cấp im lặng.
     */
    async adjudicate(line: string, signal: AbortSignal, envelope: { readonly attachments: number }): Promise<PickOutcome> {
      const projection = this.project();
      for (const src of this.deps.roster.all()) {
        if (signal.aborted) {
          throw signal.reason instanceof Error ? signal.reason : new Error("slash adjudication aborted");
        }
        if (src.matchEnter === undefined || !line.startsWith(src.trigger)) continue;
        const outcome = await src.matchEnter(projection, line, signal, envelope);
        if (outcome !== undefined) return outcome;
      }
      return undefined;
    }

    /**
     * Giải claim mà một chip lệnh đã lưu nêu tên, hỏi matchClaim của các nguồn theo thứ tự đăng ký;
     * claim đầu tiên thắng. Không bao giờ hành động trên token.
     * Nhận: token - cách viết lệnh không kèm dấu phân cách tham số, ví dụ "/goal";
     *   signal - tín hiệu huỷ cho lần khôi phục của người gọi.
     * Trả: claim, hoặc undefined khi không nguồn nào nhận token. Từ chối khi mồi nguồn lỗi hoặc signal huỷ.
     */
    async resolveClaim(token: string, signal: AbortSignal): Promise<PickOutcome> {
      const projection = this.project();
      for (const src of this.deps.roster.all()) {
        if (signal.aborted) {
          throw signal.reason instanceof Error ? signal.reason : new Error("command restore aborted");
        }
        if (src.matchClaim === undefined || !token.startsWith(src.trigger)) continue;
        const claim = await src.matchClaim(projection, token, signal);
        if (claim !== undefined) return claim;
      }
      return undefined;
    }

    /**
     * Bỏ nhóm menu của một nguồn đã huỷ (thông báo thay đổi roster gốc).
     * Nhận: source - nguồn vừa bị huỷ đăng ký.
     * Trả: không có.
     */
    sourceRemoved(source: InputTriggerSource): void {
      const state = this.menu.getSnapshot();
      if (state.open && state.hit !== null && state.hit.trigger === source.trigger) {
        this.reduce({
          type: "source-failed",
          generation: state.generation,
          source: source.name,
        });
      }
      this.lexiconOffs.get(source)?.();
      this.lexiconOffs.delete(source);
      this.refreshLexicon();
    }

    /**
     * Nhận một nguồn đăng ký sau khi controller ra đời (thông báo thay đổi roster gốc): mồi nó và
     * gộp roll của nó vào lexicon sống — prewarm lúc dựng chỉ phủ roster có mặt lúc scope ra đời.
     * Nhận: source - nguồn vừa đăng ký.
     * Trả: không có.
     */
    sourceAdded(source: InputTriggerSource): void {
      const projection = this.project();
      source.warm?.(projection);
      this.watchLexicon(source, projection);
      this.refreshLexicon();
    }

    /**
     * Đóng từ bên ngoài (ví dụ con trỏ ra ngoài vùng composer).
     * Nhận: không có.
     * Trả: không có.
     */
    dismiss(): void {
      if (this.disposed) return;
      this.rememberDismissed();
      this.stopFetch();
      this.reduce({ type: "close" });
    }

    /**
     * Nạp lại menu đang mở mà không đổi hit hay các dòng đang thấy.
     * Nhận: không có.
     * Trả: không có.
     */
    refreshOpenMenu(): void {
      if (this.disposed || !this.menu.getSnapshot().open || this.hit === null) return;
      const launched = this.launcher.getSnapshot();
      const roster = this.deps.roster
        .sources(this.hit.trigger)
        .filter((source) => launched === null || source.name === launched);
      if (roster.length === 0) return;
      this.fetchCandidates(this.hit, roster);
    }

    /**
     * Dọn theo scope: đóng, huỷ nạp (service xoá mục trong bảng).
     * Nhận: không có.
     * Trả: không có.
     */
    dispose(): void {
      this.disposed = true;
      this.stopFetch();
      this.reduce({ type: "close" });
      this.hit = null;
      for (const off of this.lexiconOffs.values()) off();
      this.lexiconOffs.clear();
    }

    /**
     * Phép chiếu phiên giao cho các nguồn (danh tính do agent bảo chứng; không đổi trong scope).
     * Nhận: không có.
     * Trả: đối tượng { sessionId }.
     */
    project(): ClientSessionContext {
      return { sessionId: this.deps.sessionId };
    }

    /**
     * Thực thi một kết quả claim/insert/text qua sự kiện ô nhập theo phạm vi (actx là chủ thể dispatch).
     * Nhận: outcome - kết quả cần áp dụng; span - khoảng token của hit.
     * Trả: true khi ô nhập đã áp dụng.
     */
    execute(outcome: PickOutcome, span: TokenSpan): boolean {
      const { actx } = this.deps;
      if (outcome === undefined || outcome === "handled") return false;
      if ("claim" in outcome) {
        return (
          actx.bail(actx, "slash/input-begin-command", {
            claim: outcome.claim,
            span,
          }) === true
        );
      }
      if ("text" in outcome) {
        return (
          actx.bail(actx, "slash/input-insert-text", {
            text: outcome.text,
            span,
            ...(outcome.continue === true ? { continue: true } : {}),
          }) === true
        );
      }
      return (
        actx.bail(actx, "slash/input-insert-reference", {
          reference: outcome.insert,
          span,
        }) === true
      );
    }

    /**
     * Hỏi lại mọi nguồn có lexicon và công bố các roll đã gộp.
     * Nhận: không có.
     * Trả: không có.
     */
    refreshLexicon(): void {
      const projection = this.project();
      const rolls = new Map<TriggerChar, readonly string[]>();
      for (const src of this.deps.roster.all()) {
        if (src.lexicon === undefined) continue;
        let names: readonly string[] | undefined;
        try {
          names = src.lexicon(projection);
        } catch (error) {
          console.error(`[ui-input-trigger] source "${src.name}" lexicon failed:`, error);
          continue;
        }
        if (names === undefined) continue;
        const prev = rolls.get(src.trigger);
        rolls.set(src.trigger, prev === undefined ? names : [...prev, ...names]);
      }
      this.lexicon.set(rolls);
    }

    /**
     * Nối kênh báo mất hiệu lực lexicon của một nguồn vào refresh (nguồn không hook/không roll không báo).
     * Nhận: source - nguồn cần theo dõi; projection - phép chiếu phiên.
     * Trả: không có.
     */
    watchLexicon(source: InputTriggerSource, projection: ClientSessionContext): void {
      if (source.lexicon === undefined || source.subscribeLexicon === undefined) return;
      this.lexiconOffs.set(
        source,
        source.subscribeLexicon(projection, () => {
          this.refreshLexicon();
          const hit = this.hit;
          if (hit === null || !this.menu.getSnapshot().open || hit.trigger !== source.trigger) return;
          void Promise.resolve().then(() => {
            if (this.disposed || this.hit !== hit || !this.menu.getSnapshot().open) return;
            this.fetchCandidates(hit, this.deps.roster.sources(hit.trigger));
          });
        }),
      );
    }

    /**
     * Khởi động lần nạp ứng viên cho một thế hệ hit, thay thế lần trước.
     * Nhận: hit - hit đang mở; roster - các nguồn cần hỏi.
     * Trả: không có.
     */
    fetchCandidates(hit: TriggerHit, roster: readonly InputTriggerSource[]): void {
      this.stopFetch();
      const controller = new AbortController();
      this.fetch = controller;
      const generation = this.menu.getSnapshot().generation;
      const projection = this.project();
      for (const source of roster) {
        source
          .candidates(projection, {
            query: hit.query,
            quoted: hit.quoted,
            position: hit.position,
            drilled: this.drilled,
            signal: controller.signal,
          })
          .then(
            (items) => {
              if (controller.signal.aborted) return;
              this.reduce({
                type: "source-settled",
                generation,
                source: source.name,
                items,
              });
            },
            (error: unknown) => {
              if (controller.signal.aborted) return;
              console.error(`[ui-input-trigger] source "${source.name}" candidates failed:`, error);
              this.reduce({
                type: "source-failed",
                generation,
                source: source.name,
              });
            },
          );
      }
    }

    /**
     * Huỷ lần nạp đang chạy (nếu có).
     * Nhận: không có.
     * Trả: không có.
     */
    stopFetch(): void {
      this.fetch?.abort();
      this.fetch = null;
    }

    /**
     * Chạy một ứng viên (hoặc breadcrumb) qua nguồn của nó và áp dụng kết quả.
     *
     * Khoan là pick duy nhất để menu mở, nên cũng là pick duy nhất ghi lại cách query kế tiếp
     * được tới; mọi pick khác đóng menu, xoá dấu vết đó.
     * Nhận: src - nguồn sở hữu; candidate - ứng viên được chọn, hoặc breadcrumb chiếu như ứng viên;
     *   hit - hit có thẩm quyền cấp vị trí + CAS span; action - pick dứt điểm hay khoan.
     * Trả: không có.
     */
    settle(src: InputTriggerSource, candidate: InputTriggerCandidate, hit: TriggerHit, action: "pick" | "drill"): void {
      const outcome = src.onPick({
        candidate,
        session: this.project(),
        position: hit.position,
        via: "menu",
        action,
        span: hit.span,
      });
      this.stopFetch();
      if (action === "pick") this.rememberDismissed();
      this.reduce({ type: "close" });
      this.drilled = action === "drill";
      if (!this.execute(outcome, hit.span)) this.drilled = false;
    }

    /**
     * Hỏi lại mọi nguồn có tiêu đề trong roster của hit và công bố breadcrumb của họ.
     * Nhận: hit - hit đang mở; roster - các nguồn cần hỏi.
     * Trả: không có.
     */
    refreshHeaders(hit: TriggerHit, roster: readonly InputTriggerSource[]): void {
      const projection = this.project();
      const crumbs = new Map<string, readonly InputTriggerCrumb[]>();
      for (const src of roster) {
        if (src.header === undefined) continue;
        let published: readonly InputTriggerCrumb[] | undefined;
        try {
          published = src.header(projection, {
            query: hit.query,
            quoted: hit.quoted,
            drilled: this.drilled,
          });
        } catch (error) {
          console.error(`[ui-input-trigger] source "${src.name}" header failed:`, error);
          continue;
        }
        if (published === undefined || published.length === 0) continue;
        crumbs.set(src.name, published);
      }
      this.setHeaders(crumbs);
    }

    /**
     * Ghi breadcrumb mới, bỏ qua khi cả cũ và mới đều rỗng (tránh render thừa).
     * Nhận: next - bảng breadcrumb mới.
     * Trả: không có.
     */
    setHeaders(next: Map<string, readonly InputTriggerCrumb[]>): void {
      if (this.headers.getSnapshot().size === 0 && next.size === 0) return;
      this.headers.set(next);
    }

    /**
     * Ghi danh tính menu đang mở là đã đóng, để một lần track trần không làm nó sống lại.
     * Nhận: không có.
     * Trả: không có.
     */
    rememberDismissed(): void {
      const hit = this.hit;
      this.dismissed =
        hit === null
          ? null
          : {
              trigger: hit.trigger,
              query: hit.query,
              quoted: hit.quoted,
              start: hit.span.start,
              end: hit.span.end,
            };
    }

    /**
     * Đặt lại tên nguồn của bộ khởi chạy (nếu đang có).
     * Nhận: không có.
     * Trả: không có.
     */
    clearLauncher(): void {
      if (this.launcher.getSnapshot() !== null) this.launcher.set(null);
    }

    /**
     * Giảm một sự kiện menu qua bộ giảm thuần rồi áp dụng tác dụng phụ khi menu đóng.
     * Nhận: ev - sự kiện menu.
     * Trả: không có.
     */
    reduce(ev: MenuEvent): void {
      const cur = this.menu.getSnapshot();
      const next = menuReduce(cur, ev);
      if (next !== cur) this.menu.set(next);
      if (next.open) return;
      this.clearLauncher();
      this.drilled = false;
      this.setHeaders(new Map<string, readonly InputTriggerCrumb[]>());
    }
  }

  return InputTriggerController;
}

/**
 * Lớp controller do createControllerClass dựng.
 * Nhận: không có.
 * Trả: kiểu InputTriggerControllerClass.
 */
export type InputTriggerControllerClass = ReturnType<typeof createControllerClass>;

/**
 * Thực thể controller theo phiên.
 * Nhận: không có.
 * Trả: kiểu InputTriggerControllerInstance.
 */
export type InputTriggerControllerInstance = InstanceType<InputTriggerControllerClass>;
