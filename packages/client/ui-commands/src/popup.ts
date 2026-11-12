/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc The chon popupSelect khong dau: mot bo dieu khien cho moi phien, loc cuc bo va chot qua context chup luc mo
 */

import { groupOptions } from "./option-groups.ts";
import type {
  PopupSearchMode,
  RankByName,
  PopupSelectDepsLike,
  PopupSpecLike,
  PopupStateLike,
  SelectOptionLike,
  SnapshotStoreLike,
  StoreSeamLike,
  TokenSegmentLike,
} from "./types.ts";

/** Trang thai dong — nguyen van tu ban goc. */
export const CLOSED: PopupStateLike = {
  open: false,
  command: null,
  status: "pending",
  options: [],
  search: "",
  searchLabels: null,
  searchMode: "substring",
  active: 0,
  submitting: false,
  confirming: null,
  acknowledged: false,
  error: null,
};

/** Mot lan mo the dang hieu luc (bi thay boi dismiss/dispose/mo lai). */
interface Binding<TCtx> {
  /** Ten lenh the phuc vu. */
  readonly command: string;
  /** Spec nghiep vu cua lenh. */
  readonly spec: PopupSpecLike<TCtx>;
  /** Context chup luc mo, tra nguyen van cho options/onSelect. */
  readonly context: TCtx;
  /** Doan token chup luc mo, de tieu thu sau khi chon. */
  readonly segment: TokenSegmentLike;
  /** Tin hieu huy lan nap dong. */
  readonly abort: AbortController;
}

/**
 * Loc dong bang khop chuoi con, hoac xep hang nhan theo kieu mo trong tung nhom.
 * O tim kiem rong giu moi dong; khop mo giu nguyen thu tu nhom.
 * Nhan: options — cac dong da nap; search — van ban loc cua the; mode — chinh sach cua lenh (mac dinh substring tren nhan va mo ta).
 * Tra: chinh cac doi tuong dong goc theo thu tu hien thi va theo thu tu dung de chon.
 */
export function filterOptions(
  options: readonly SelectOptionLike[],
  search: string,
  mode: PopupSearchMode = "substring",
  rankByName?: RankByName,
): readonly SelectOptionLike[] {
  const query = search.trim().toLowerCase();
  const groups = groupOptions(options);
  const ordered = groups.some((group) => group.group !== undefined) ? groups.flatMap((group) => group.rows) : options;
  if (query === "") return ordered;
  if (mode === "fuzzy-label") {
    if (rankByName === undefined) return ordered.filter((option) => option.label.toLowerCase().includes(query));
    return groups.flatMap((group) => {
      const ranked = rankByName(
        group.rows.map((option) => ({ name: option.label, option })),
        query,
      );
      return ranked.map((row) => row.option);
    });
  }
  return ordered.filter((option) => option.label.toLowerCase().includes(query) || (option.detail?.toLowerCase().includes(query) ?? false));
}

/**
 * Chi so to sang cho mot danh sach dong vua nap: dong duoc danh dau la gia tri dang dung khi o tim kiem
 * con thay no, nguoc lai la dong dau. Mo the thi dau vet dung o gia tri phien dang dung.
 * Nhan: options — cac dong da nap; search — van ban loc song; mode — chinh sach tim kiem cua lenh.
 * Tra: chi so trong danh sach DA LOC.
 */
export function currentIndex(options: readonly SelectOptionLike[], search: string, mode: PopupSearchMode, rankByName?: RankByName): number {
  const at = filterOptions(options, search, mode, rankByName).findIndex((option) => option.active === true);
  return at === -1 ? 0 : at;
}

/**
 * Dong loi cua the khi mot lan chot that bai.
 * Nhan: error — gia tri bi nem.
 * Tra: chuoi de hien thi.
 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Bo dieu khien khong dau cua the chon cua mot phien. Cac lan chot muon mat quyen ghi qua danh tinh
 * binding: dismiss/dispose/mo lai doi binding, nen mot lan nap dong hay onSelect ket thuc muon thi
 * khong ghi gi va khong tieu thu gi.
 */
export class PopupSelectController<TCtx = unknown> {
  /** Callback do tang noi phien tiem vao. */
  private readonly deps: PopupSelectDepsLike;

  /** Kho trang thai cua the (thanh phan lop phu nghe o day). */
  readonly state: SnapshotStoreLike<PopupStateLike>;

  /** Lan mo dang hieu luc; null khi dong. */
  private binding: Binding<TCtx> | null = null;

  /** Ham xep hang cua ui-primitives, tiem tu ngoai de lop nay khong phu thuoc bang module. */
  private readonly rankByName: RankByName | undefined;

  /**
   * @param deps - callback cua tang noi phien (tieu thu token + tra tieu diem).
   * @param store - seam dsh-client-store (tao kho anh chup).
   * @param rankByName - ham xep hang cua ui-primitives (che do fuzzy-label).
   */
  constructor(deps: PopupSelectDepsLike, store: StoreSeamLike, rankByName?: RankByName) {
    this.deps = deps;
    this.rankByName = rankByName;
    this.state = store.createSnapshotStore<PopupStateLike>(CLOSED);
  }

  /**
   * Mo the cho mot lenh: cong bo trang thai pending va nap dong MOT LAN qua spec nghiep vu.
   * Mo lai se thay the the truoc (lan nap dong cua no bi huy, cac lan chot muon bi bo).
   * Nhan: command — ten lenh the phuc vu; spec — spec popupSelect da dang ky; context — context chup luc mo; segment — doan token chup luc mo.
   * Tra: khong co.
   */
  open(command: string, spec: PopupSpecLike<TCtx>, context: TCtx, segment: TokenSegmentLike): void {
    const searchLabels = spec.searchLabels?.() ?? null;
    this.binding?.abort.abort();
    const binding: Binding<TCtx> = { command, spec, context, segment, abort: new AbortController() };
    this.binding = binding;
    this.state.set({
      ...CLOSED,
      open: true,
      command,
      searchLabels,
      searchMode: spec.searchMode ?? "substring",
    });
    this.load(binding);
  }

  /**
   * Chay lan nap dong duy nhat cua mot binding; quyen chot chet cung binding.
   * Nhan: binding — lan mo dang hieu luc.
   * Tra: khong co.
   */
  private load(binding: Binding<TCtx>): void {
    binding.spec.options(binding.context, binding.abort.signal).then(
      (options) => {
        if (this.binding !== binding) return;
        const current = this.state.getSnapshot();
        this.state.set({
          ...current,
          status: "ready",
          options,
          active: currentIndex(options, current.search, current.searchMode, this.rankByName),
          error: null,
        });
      },
      (error: unknown) => {
        if (this.binding !== binding) return;
        console.error("[ui-commands] popupSelect options failed for /" + binding.command + ":", error);
        this.state.set({
          ...this.state.getSnapshot(),
          status: "failed",
          options: [],
          active: 0,
          error: errorText(error),
        });
      },
    );
  }

  /**
   * Chay lai mot lan nap dong da that bai (o tim kiem duoc giu; khong lam gi neu trang thai khong phai 'failed').
   * Nhan: khong co.
   * Tra: khong co.
   */
  retry(): void {
    const binding = this.binding;
    const s = this.state.getSnapshot();
    if (binding === null || !s.open || s.status !== "failed") return;
    this.state.set({ ...s, status: "pending", error: null });
    this.load(binding);
  }

  /**
   * Thay van ban loc cuc bo (loc thuan, khong hoi lai nha cung cap) va dua dau vet ve dong dau cua danh
   * sach vua loc: go phim nghia la dang tim thu khac gia tri hien tai.
   * Nhan: search — van ban cua o tim kiem.
   * Tra: khong co.
   */
  setSearch(search: string): void {
    const s = this.state.getSnapshot();
    if (!s.open || s.submitting || s.confirming !== null || search === s.search) return;
    this.state.set({ ...s, search, active: 0 });
  }

  /**
   * Di chuyen dau vet qua cac dong da loc (quay vong; khong lam gi neu dong chua san sang hoac dang chot).
   * Nhan: dir — +1 xuong, -1 len.
   * Tra: khong co.
   */
  move(dir: 1 | -1): void {
    const s = this.state.getSnapshot();
    if (!s.open || s.status !== "ready" || s.submitting || s.confirming !== null) return;
    const rows = filterOptions(s.options, s.search, s.searchMode, this.rankByName);
    if (rows.length === 0) return;
    const active = (s.active + dir + rows.length) % rows.length;
    this.state.set({ ...s, active });
  }

  /**
   * Dat dau vet truc tiep (chuot di qua; khong lam gi neu chua san sang, dang ban, hoac ngoai khoang da loc).
   * Nhan: index — chi so trong danh sach da loc.
   * Tra: khong co.
   */
  highlight(index: number): void {
    const s = this.state.getSnapshot();
    if (!s.open || s.status !== "ready" || s.submitting || s.confirming !== null) return;
    if (index < 0 || index >= filterOptions(s.options, s.search, s.searchMode, this.rankByName).length || index === s.active) return;
    this.state.set({ ...s, active: index });
  }

  /**
   * Chon mot dong da loc: single-flight — lan goi dau vao trang thai submitting va cac lan sau khong lam gi
   * cho toi khi no ket thuc. Thanh cong thi tieu thu doan token chup luc mo (CAS tra false la vo hai),
   * dong the, va tra tieu diem ve hop soan tin. That bai thi giu the mo voi o tim kiem, dau vet va token
   * nguyen ven, lo loi ra, va cho phep chon lai nhu mot lan thu.
   * Nhan: index — chi so trong danh sach da loc (nguoi goi truyen dau vet hoac dong vua bam).
   * Tra: hoan tat khi lan thu da dong the hoac da lo loi.
   */
  async select(index: number): Promise<void> {
    const binding = this.binding;
    const s = this.state.getSnapshot();
    if (binding === null || !s.open || s.status !== "ready" || s.submitting || s.confirming !== null) return;
    const option = filterOptions(s.options, s.search, s.searchMode, this.rankByName)[index];
    if (option === undefined) return;
    if (option.confirmation !== undefined) {
      this.state.set({ ...s, confirming: option, acknowledged: false, error: null });
      return;
    }
    await this.settle(binding, option);
  }

  /**
   * Cap nhat o checkbox tuong minh cho cong chan rui ro dang cho.
   * Nhan: acknowledged — nguoi dung da tich xac nhan rui ro hien thi hay chua.
   * Tra: khong co.
   */
  acknowledge(acknowledged: boolean): void {
    const s = this.state.getSnapshot();
    if (!s.open || s.submitting || s.confirming === null || s.acknowledged === acknowledged) return;
    this.state.set({ ...s, acknowledged });
  }

  /**
   * Huy CHI cong chan rui ro va quay ve bang chon dong van dang mo.
   * Nhan: khong co.
   * Tra: khong co.
   */
  cancelConfirmation(): void {
    const s = this.state.getSnapshot();
    if (!s.open || s.submitting || s.confirming === null) return;
    this.state.set({ ...s, confirming: null, acknowledged: false });
  }

  /**
   * Chot dong bi chan rui ro chi sau khi o checkbox da duoc tich.
   * Nhan: khong co.
   * Tra: hoan tat khi lan chot ket thuc.
   */
  async confirm(): Promise<void> {
    const binding = this.binding;
    const s = this.state.getSnapshot();
    if (binding === null || !s.open || s.submitting || s.confirming === null || !s.acknowledged) return;
    await this.settle(binding, s.confirming);
  }

  /**
   * Chay phan chot nghiep vu cho mot dong da duoc nhan.
   * Nhan: binding — lan mo dang hieu luc; option — dong da duoc nhan.
   * Tra: hoan tat khi onSelect ket thuc (thanh cong hoac loi).
   */
  private async settle(binding: Binding<TCtx>, option: SelectOptionLike): Promise<void> {
    const s = this.state.getSnapshot();
    if (this.binding !== binding || !s.open || s.submitting) return;
    this.state.set({ ...s, submitting: true, confirming: null, acknowledged: false, error: null });
    try {
      await binding.spec.onSelect(option, binding.context);
    } catch (error) {
      console.error("[ui-commands] popupSelect onSelect failed for /" + binding.command + ":", error);
      if (this.binding !== binding) return;
      this.state.set({ ...this.state.getSnapshot(), submitting: false, error: errorText(error) });
      return;
    }
    if (this.binding !== binding) return;
    this.deps.consume(binding.segment);
    this.binding = null;
    this.state.set(CLOSED);
    this.deps.focusComposer();
  }

  /**
   * Dong the; huy lan nap dong dang bay va thu hoi quyen chot. Tuong tac chuot ben ngoai thi dong don
   * thuan (dich cua cu bam tu nhan tieu diem); Escape truyen focusComposer de tra tieu diem tuong minh.
   * Nhan: opts — focusComposer: co tra tieu diem ve hop soan tin khong (duong Escape).
   * Tra: khong co.
   */
  dismiss(opts?: { readonly focusComposer?: boolean }): void {
    if (this.binding === null) return;
    this.binding.abort.abort();
    this.binding = null;
    this.state.set(CLOSED);
    if (opts?.focusComposer === true) this.deps.focusComposer();
  }

  /**
   * Ham don dep khi pham vi phien tat: huy viec dang bay va xoa trang thai (khong doi tieu diem).
   * Nhan: khong co.
   * Tra: khong co.
   */
  dispose(): void {
    this.binding?.abort.abort();
    this.binding = null;
    this.state.set(CLOSED);
  }
}
