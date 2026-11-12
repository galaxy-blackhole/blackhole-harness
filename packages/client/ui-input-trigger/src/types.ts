/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hợp đồng kiểu của nửa client ui-input-trigger: tiền tệ của bộ phát hiện/menu, nguồn trigger,
 *   store + React + ui-primitives + cordis + slots mà plugin require lúc vật chất hoá factory
 */

/**
 * Ký tự kích hoạt mà một nguồn đăng ký — nguyên văn bản gốc ('/' hoặc '@').
 * Nhận: không có.
 * Trả: kiểu liên hợp hai ký tự.
 */
export type TriggerChar = "/" | "@";

/**
 * Vị trí của token trong bản nháp: đầu dòng (sau khi cắt khoảng trắng) hay ở giữa.
 * Nhận: không có.
 * Trả: kiểu liên hợp hai vị trí.
 */
export type TriggerPosition = "leading" | "inline";

/**
 * Mức sẵn sàng của trigger do tầng nối dây suy ra từ pha của ô nhập.
 * Nhận: không có.
 * Trả: "plain" | "claimed" | "frozen".
 */
export type TriggerGuardTier = "plain" | "claimed" | "frozen";

/**
 * Mức sẵn sàng của trigger; tier quyết định '/' và '@' còn sống hay không.
 * Nhận: không có.
 * Trả: hợp đồng kiểu TriggerGuard.
 */
export interface TriggerGuard {
  /** plain: cả hai sống; claimed: '/' bị chặn, '@' sống; frozen: không có gì sống. */
  readonly tier: TriggerGuardTier;
}

/**
 * Khoảng token trong bản nháp; draftRev do tầng gọi đóng dấu cho CAS lúc chọn.
 * Nhận: không có.
 * Trả: hợp đồng kiểu TokenSpan.
 */
export interface TokenSpan {
  /** Chỉ số bắt đầu (0-based) trong draft. */
  readonly start: number;
  /** Chỉ số kết thúc (0-based, không gồm) trong draft. */
  readonly end: number;
  /** Revision của draft tại thời điểm phát hiện. */
  readonly draftRev: number;
}

/**
 * Một token kích hoạt đã phát hiện dưới con trỏ.
 * Nhận: không có.
 * Trả: hợp đồng kiểu TriggerHit.
 */
export interface TriggerHit {
  /** Ký tự kích hoạt. */
  readonly trigger: TriggerChar;
  /** Phần chữ giữa ký tự kích hoạt và con trỏ. */
  readonly query: string;
  /** True chỉ với token @file đang mở ngoặc kép. */
  readonly quoted: boolean;
  /** leading: draft đã cắt khoảng trắng bắt đầu bằng token; inline: nằm giữa. */
  readonly position: TriggerPosition;
  /** Khoảng token; draftRev do tầng gọi đóng dấu. */
  readonly span: TokenSpan;
}

/**
 * Phép chiếu ổn định của một phiên client — chỉ mang danh tính, không mang Context cordis.
 * Nhận: không có.
 * Trả: hợp đồng kiểu ClientSessionContext.
 */
export interface ClientSessionContext {
  /** Id phiên. */
  readonly sessionId: string;
}

/**
 * Glyph tham chiếu dựng sẵn của một ứng viên (bản gốc ánh xạ sang SVG trong menu view).
 * Nhận: không có.
 * Trả: kiểu InputTriggerCandidateIcon.
 */
export type InputTriggerCandidateIcon = "file" | "folder" | "session";

/**
 * Component nhận props (icon do nguồn cấp) — chỉ cần dựng được bằng jsx runtime.
 * Nhận: không có.
 * Trả: kiểu ComponentLike.
 */
export type ComponentLike = (props: { readonly size?: number }) => unknown;

/**
 * Một ứng viên trong menu — dữ liệu hiển thị thuần, không khai báo hành vi.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerCandidate.
 */
export interface InputTriggerCandidate {
  /** Danh tính: payload của pick, khóa so khớp chính xác và khóa tìm đầu tiên. */
  readonly name: string;
  /** Tiêu đề hiển thị; vắng thì dùng name; khác name (khác chữ hoa/thường) thì hiện name làm bí danh. */
  readonly label?: string;
  /** Mô tả canh phải. */
  readonly description?: string;
  /** Glyph tham chiếu hoặc component icon dùng chung. */
  readonly icon?: InputTriggerCandidateIcon | ComponentLike;
  /** Gợi ý phụ (bản gốc khai trong hợp đồng, menu view không vẽ). */
  readonly hint?: string;
  /** Tiêu đề mục dùng chung cho các ứng viên liền kề; có mục thì nhóm bỏ dòng tiêu đề nguồn. */
  readonly section?: string;
  /** Payload do nguồn sở hữu, không trong suốt với pipeline. */
  readonly value?: string;
  /** Dòng có hành động khoan (Tab hoặc chevron) thay vì chọn dứt điểm. */
  readonly drill?: boolean;
}

/**
 * Một mẩu breadcrumb trên tiêu đề menu của một nguồn.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerCrumb.
 */
export interface InputTriggerCrumb {
  /** Chữ hiển thị của bước. */
  readonly label: string;
  /** Payload do nguồn sở hữu, trả lại nguyên vẹn khi chọn. */
  readonly value: string;
  /** Bước menu đang hiện; vẽ là mẩu cuối, không bấm được. */
  readonly current?: boolean;
}

/**
 * Yêu cầu mà một nguồn cần để quyết định tiêu đề của menu đang mở.
 * Nhận: không có.
 * Trả: hợp đồng kiểu HeaderRequest.
 */
export interface HeaderRequest {
  /** Chữ giữa ký tự kích hoạt và con trỏ. */
  readonly query: string;
  /** Token @file đang mở ngoặc kép hay không. */
  readonly quoted?: boolean;
  /** Menu được mở (hoặc đổi phạm vi lần cuối) bằng một pick khoan; sống qua lần gõ tiếp. */
  readonly drilled: boolean;
}

/**
 * Trạng thái gửi phiên không phải văn bản mà điều phối Enter nhìn thấy.
 * Nhận: không có.
 * Trả: hợp đồng kiểu SubmitEnvelope.
 */
export interface SubmitEnvelope {
  /** Số tệp đính kèm đi cùng bản nháp. */
  readonly attachments: number;
}

/**
 * Yêu cầu ứng viên gửi cho một nguồn; signal bị thay khi query đổi hoặc menu đóng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu CandidateRequest.
 */
export interface CandidateRequest {
  /** Chữ giữa ký tự kích hoạt và con trỏ. */
  readonly query: string;
  /** Token @file đang mở ngoặc kép hay không. */
  readonly quoted?: boolean;
  /** Vị trí token trong draft. */
  readonly position: TriggerPosition;
  /** Menu được mở/đổi phạm vi bằng pick khoan hay không. */
  readonly drilled: boolean;
  /** Tín hiệu huỷ của lần nạp này. */
  readonly signal: AbortSignal;
}

/**
 * Mọi thứ một nguồn nhận khi chọn: ứng viên + phép chiếu phiên + ảnh chụp span để CAS.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerPick.
 */
export interface InputTriggerPick {
  /** Ứng viên được chọn. */
  readonly candidate: InputTriggerCandidate;
  /** Phép chiếu phiên. */
  readonly session: ClientSessionContext;
  /** Vị trí token. */
  readonly position: TriggerPosition;
  /** Đường chọn đã tạo ra pick này. */
  readonly via: "menu" | "space" | "enter";
  /** Chọn dứt điểm hay khoan vào ứng viên. */
  readonly action: "pick" | "drill";
  /** Khoảng token lúc chọn. */
  readonly span: TokenSpan;
}

/**
 * Yêu cầu chèn một tham chiếu do nguồn sở hữu (kết quả onPick).
 * Nhận: không có.
 * Trả: hợp đồng kiểu ReferenceInsert.
 */
export interface ReferenceInsert {
  /** Id tham chiếu do nguồn sở hữu, ví dụ "/name". */
  readonly ref: string;
  /** Glyph chip tuỳ chọn. */
  readonly appearance?: string;
}

/**
 * Kết quả chọn mà pipeline thực thi qua sự kiện ô nhập theo phạm vi.
 * Nhận: không có.
 * Trả: kiểu PickOutcome.
 */
export type PickOutcome =
  | "handled"
  | { readonly claim: unknown }
  | { readonly text: string; readonly continue?: boolean }
  | { readonly insert: ReferenceInsert }
  | undefined;

/**
 * Codec tham chiếu của một nguồn sinh kết quả chèn.
 * Nhận: không có.
 * Trả: hợp đồng kiểu ReferenceCodec.
 */
export interface ReferenceCodec {
  /** Phép chiếu clipboard/lưu trữ của một tham chiếu (ví dụ "/name"). */
  clipboardText(ref: string): string;
  /** Tuần tự hoá cho model (ví dụ "<skill>name</skill>"); lỗi thì chặn gửi, không hạ cấp im lặng. */
  serialize(ref: string, signal: AbortSignal): Promise<string>;
}

/**
 * Một nguồn trigger. Mọi callback nhận phép chiếu phiên; nguồn không giữ bản sao qua các lần gọi.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerSource.
 */
export interface InputTriggerSource {
  /** Ký tự kích hoạt nguồn này bám vào. */
  readonly trigger: TriggerChar;
  /** Nhãn nhóm menu; duy nhất theo trigger — đăng ký trùng thì ném. */
  readonly name: string;
  /** Thứ tự nhóm (số nhỏ lên trước; mặc định 0). */
  readonly order?: number;
  /** Có vẽ dòng tiêu đề nguồn hay không; mặc định true. */
  readonly showGroupTitle?: boolean;
  /** Nạp ứng viên cho một yêu cầu. */
  candidates(session: ClientSessionContext, req: CandidateRequest): Promise<readonly InputTriggerCandidate[]>;
  /** Breadcrumb đồng bộ vẽ trên nhóm; trả undefined khi yêu cầu này không cần tiêu đề. */
  header?(session: ClientSessionContext, req: HeaderRequest): readonly InputTriggerCrumb[] | undefined;
  /** Mọi pick đều rơi vào đây. */
  onPick(pick: InputTriggerPick): PickOutcome;
  /** Điều phối lúc gõ dấu cách trên token đầu dòng vừa hoàn tất (chỉ trạng thái nóng, đồng bộ). */
  matchSpace?(session: ClientSessionContext, token: string): PickOutcome;
  /** Điều phối lúc Enter; được phép chờ dữ liệu nguồn và ném khi không nuốt nổi phong bì. */
  matchEnter?(
    session: ClientSessionContext,
    line: string,
    signal: AbortSignal,
    envelope: SubmitEnvelope,
  ): Promise<PickOutcome>;
  /** Giải claim lúc khôi phục chip lệnh đã lưu; không bao giờ hành động. */
  matchClaim?(session: ClientSessionContext, token: string, signal: AbortSignal): Promise<PickOutcome>;
  /** Mồi dữ liệu lúc phạm vi phiên sống dậy (bắn-rồi-quên). */
  warm?(session: ClientSessionContext): void;
  /** Danh sách tên nóng cho trang trí tham chiếu văn bản thuần; undefined = chưa nóng. */
  lexicon?(session: ClientSessionContext): readonly string[] | undefined;
  /** Đăng ký nhận thông báo khi lexicon đổi; trả hàm huỷ đăng ký. */
  subscribeLexicon?(session: ClientSessionContext, listener: () => void): () => void;
  /** Mở xem trước một tham chiếu mà không đổi draft; trả nguồn có nhận hay không. */
  openReference?(session: ClientSessionContext, reference: Pick<ReferenceInsert, "ref" | "appearance">): boolean;
  /** Codec tham chiếu; bắt buộc với nguồn sinh kết quả chèn. */
  readonly codec?: ReferenceCodec;
}

/**
 * Một nhóm menu ứng với một nguồn.
 * Nhận: không có.
 * Trả: hợp đồng kiểu MenuGroup.
 */
export interface MenuGroup {
  /** Tên nguồn. */
  readonly source: string;
  /** False khi các dòng mục tự lo việc dán nhãn nhóm. */
  readonly showGroupTitle?: boolean;
  /** Nhóm đang chờ nạp hay đã sẵn sàng. */
  readonly status: "pending" | "ready";
  /** Ứng viên của nhóm. */
  readonly items: readonly InputTriggerCandidate[];
}

/**
 * Vị trí đang được tô sáng trong menu (nguồn + chỉ số trong nhóm).
 * Nhận: không có.
 * Trả: hợp đồng kiểu MenuHighlight.
 */
export interface MenuHighlight {
  /** Tên nguồn. */
  readonly source: string;
  /** Chỉ số ứng viên trong nhóm. */
  readonly index: number;
}

/**
 * Trạng thái menu: một nhóm mỗi nguồn; nhóm sẵn sàng mà rỗng thì tự đóng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu MenuState.
 */
export interface MenuState {
  /** Menu đang mở hay không. */
  readonly open: boolean;
  /** Token của lần mở hiện tại. */
  readonly hit: TriggerHit | null;
  /** Số thế hệ tăng dần theo mỗi hit; kết quả cũ bị bỏ. */
  readonly generation: number;
  /** Các nhóm theo thứ tự roster. */
  readonly groups: readonly MenuGroup[];
  /** Vị trí tô sáng hiện tại. */
  readonly highlight: MenuHighlight | null;
}

/**
 * Sự kiện giảm trạng thái menu.
 * Nhận: không có.
 * Trả: kiểu MenuEvent.
 */
export type MenuEvent =
  | { readonly type: "hit"; readonly hit: TriggerHit | null }
  | {
      readonly type: "source-settled";
      readonly generation: number;
      readonly source: string;
      readonly items?: readonly InputTriggerCandidate[];
    }
  | { readonly type: "source-failed"; readonly generation: number; readonly source: string }
  | { readonly type: "move"; readonly dir: 1 | -1 }
  | { readonly type: "hover"; readonly source: string; readonly index: number }
  | { readonly type: "close" };

/**
 * Store ảnh chụp của client (createSnapshotStore của @galaxy-blackhole/gbh-client-store).
 * Nhận: không có.
 * Trả: hợp đồng kiểu SnapshotStore.
 */
export interface SnapshotStore<T> {
  /** Đọc ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Ghi ảnh chụp mới và báo người nghe. */
  set(next: T): void;
  /** Đăng ký người nghe; trả hàm huỷ. */
  subscribe(listener: () => void): () => void;
}

/**
 * Hàm tạo store ảnh chụp do bảng module cấp (require("@galaxy-blackhole/gbh-client-store")).
 * Nhận: không có.
 * Trả: kiểu CreateSnapshotStore.
 */
export type CreateSnapshotStore = <T>(initial: T) => SnapshotStore<T>;

/**
 * Hàm require của bảng module trang.
 * Nhận: không có.
 * Trả: kiểu RequireFn.
 */
export type RequireFn = (id: string) => unknown;

/**
 * Phần dịch vụ từ điển mà plugin dùng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu LocaleServiceLike.
 */
export interface LocaleServiceLike {
  /** Đăng ký một namespace từ điển; trả hàm huỷ. */
  register(namespace: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }): () => void;
}

/**
 * Định nghĩa một người ngồi trong slot (đủ trường mà row này khai).
 * Nhận: không có.
 * Trả: hợp đồng kiểu SlotDefinition.
 */
export interface SlotDefinition {
  /** Tên slot đích. */
  readonly name: string;
  /** Id người ngồi. */
  readonly id: string;
  /** Thứ tự trong slot. */
  readonly order: number;
  /** Namespace từ điển của người ngồi. */
  readonly locale: string;
  /** Hàm inject props theo sessionId. */
  inject(sessionId: unknown): unknown;
}

/**
 * Phần dịch vụ slot (đăng ký + chờ slot khai báo) mà plugin dùng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu SlotsServiceLike.
 */
export interface SlotsServiceLike {
  /** Chờ một slot được khai báo rồi chạy callback. */
  inject(name: string, callback: () => void): void;
  /** Đăng ký một người ngồi vào slot. */
  register(definition: SlotDefinition, component: unknown): () => void;
}

/**
 * Phần dịch vụ phiên của kernel mà row này dùng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu SessionsServiceLike.
 */
export interface SessionsServiceLike {
  /** Phạm vi context của một phiên. */
  scope(sessionId: unknown): ClientContextLike | undefined;
  /** Phiên sở hữu một context phạm vi. */
  sessionOf(actx: ClientContextLike): SessionLike | undefined;
  /** Liên kết (retained) của một id phiên. */
  binding(sessionId: string): SessionBindingLike | undefined;
}

/**
 * Phiên client (chỉ trường mà row này đọc).
 * Nhận: không có.
 * Trả: hợp đồng kiểu SessionLike.
 */
export interface SessionLike {
  /** Id phiên. */
  readonly sessionId: string;
}

/**
 * Liên kết giữ chỗ của một phiên.
 * Nhận: không có.
 * Trả: hợp đồng kiểu SessionBindingLike.
 */
export interface SessionBindingLike {
  /** Phiên được giữ. */
  readonly session: SessionLike;
  /** Id phiên. */
  readonly sessionId: string;
  /** Context phạm vi của phiên. */
  readonly ctx: ClientContextLike;
}

/**
 * Context cordis phía client (mặt mà plugin và controller chạm tới).
 * Nhận: không có.
 * Trả: hợp đồng kiểu ClientContextLike.
 */
export interface ClientContextLike {
  /** Đăng ký hiệu ứng vòng đời; trả hàm huỷ. */
  effect(callback: () => unknown, label?: string): () => void;
  /** Cài một plugin con. */
  plugin(plugin: unknown): void;
  /** Chờ các dịch vụ rồi chạy callback trong scope đã tiêm. */
  inject(deps: readonly string[], callback: (scope: InjectedScope) => void): void;
  /** Lấy một dịch vụ theo tên (cordis get). */
  get(name: string): unknown;
  /** Nghe một sự kiện; trả hàm huỷ. */
  on(event: string, listener: (...args: unknown[]) => void): () => void;
  /** Bắn một sự kiện bail tới ô nhập theo phạm vi; true = ô nhập đã áp dụng. */
  bail(subject: unknown, event: string, payload: Record<string, unknown>): boolean;
  /** Dịch vụ từ điển. */
  readonly locale: LocaleServiceLike;
}

/**
 * Scope đã tiêm của plugin con: chắc chắn có ba dịch vụ dưới đây.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InjectedScope.
 */
export interface InjectedScope extends ClientContextLike {
  /** Dịch vụ slot. */
  readonly slots: SlotsServiceLike;
  /** Dịch vụ trigger (do chính plugin này cài). */
  readonly inputTriggers: InputTriggerServiceContract;
  /** Dịch vụ phiên. */
  readonly sessions: SessionsServiceLike;
}

/**
 * Mặt dịch vụ inputTriggers mà người tiêu thụ thấy.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerServiceContract.
 */
export interface InputTriggerServiceContract {
  /** Đăng ký một nguồn; trả hàm huỷ. */
  registerSource(src: InputTriggerSource): () => void;
  /** Giải controller theo phạm vi phiên. */
  sessionOf(actx: ClientContextLike): unknown;
}

/**
 * Phần React mà menu dùng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu ReactLike.
 */
export interface ReactLike {
  /** Đọc store ngoài React. */
  useSyncExternalStore<T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T;
  /** Giữ một tham chiếu qua các lần render. */
  useRef<T>(initial: T): { current: T };
  /** State của React. */
  useState<T>(initial: T | (() => T)): [T, (next: T | ((previous: T) => T)) => void];
  /** Ghi nhớ callback. */
  useCallback<T>(callback: T, deps: readonly unknown[]): T;
  /** Hiệu ứng bố cục. */
  useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  /** Hiệu ứng thường. */
  useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
}

/**
 * Hàm dựng element của jsx runtime.
 * Nhận: không có.
 * Trả: kiểu JsxFn.
 */
export type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/**
 * Phần jsx runtime mà menu dùng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu JsxRuntimeLike.
 */
export interface JsxRuntimeLike {
  /** Dựng một element. */
  jsx: JsxFn;
  /** Dựng element có mảng con. */
  jsxs: JsxFn;
  /** Node Fragment. */
  Fragment: unknown;
}

/**
 * Phần ui-primitives mà menu dùng.
 * Nhận: không có.
 * Trả: hợp đồng kiểu PrimitivesLike.
 */
export interface PrimitivesLike {
  /** Mặt phẳng menu dùng chung (tự lo portal/neo/đóng). */
  MenuSurface: unknown;
  /** Mũi tên phải (breadcrumb + nút khoan). */
  IconChevronRightOutlineRegular: unknown;
  /** Icon tham chiếu dựng sẵn theo glyph. */
  ReferenceIconRegular: unknown;
  /** Hook tính chiều cao tối đa còn chỗ của menu. */
  useAnchoredMaxHeight(
    ref: { current: unknown },
    maxHeight: number,
    state: unknown,
    topMargin: number,
  ): number;
}

/**
 * Phần lớp Service của cordis mà dịch vụ kế thừa.
 * Nhận: không có.
 * Trả: hợp đồng kiểu ServiceLike.
 */
export interface ServiceLike {
  /** Context mà service được cài vào. */
  ctx: ClientContextLike;
}

/**
 * Hàm dựng Service của cordis.
 * Nhận: không có.
 * Trả: hợp đồng kiểu ServiceCtorLike.
 */
export interface ServiceCtorLike {
  /** Tạo service với tên đã cho. */
  new (ctx: unknown, name: string): ServiceLike;
}

/**
 * Mặt plugin mà Loader gọi trên bundle client.
 * Nhận: không có.
 * Trả: hợp đồng kiểu InputTriggerPlugin.
 */
export interface InputTriggerPlugin {
  /** Lớp controller theo phiên (bản gốc cũng export lớp này). */
  InputTriggerController: unknown;
  /** Lớp dịch vụ trigger (bản gốc cũng export lớp này). */
  InputTriggerService: unknown;
  /** Thân plugin: cài dịch vụ rồi đăng ký menu view. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc của plugin gốc. */
  inject: string[];
}

/**
 * Props mà renderer bind cho MenuView (mặt inject + ghế từ điển).
 * Nhận: không có.
 * Trả: hợp đồng kiểu MenuViewProps.
 */
export interface MenuViewProps {
  /** Store trạng thái menu của controller. */
  readonly menu: SnapshotStore<MenuState>;
  /** Store breadcrumb theo nguồn. */
  readonly headers: SnapshotStore<Map<string, readonly InputTriggerCrumb[]>>;
  /** Chọn một ứng viên (hoặc hành động khoan của nó). */
  onPick(source: string, index: number, action?: "pick" | "drill"): void;
  /** Chọn một mẩu breadcrumb. */
  onCrumb(source: string, index: number): void;
  /** Rê chuột lên một ứng viên. */
  onHover(source: string, index: number): void;
  /** Đóng menu (bấm ra ngoài). */
  onDismiss(): void;
  /** Hàm đọc từ điển của namespace slash.menu. */
  t(key: string): string;
}
