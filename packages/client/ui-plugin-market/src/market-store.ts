/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bộ điều khiển tab Discover: đọc nguồn chỉ mục, phân trang kết quả, sửa danh sách nguồn
 */

import { INITIAL_QUERY, declaredQuery, type DiscoverQuery } from "./presentation.ts";
import type {
  ClientContextLike,
  DiscoverFaceLike,
  ListingFailure,
  MarketDiscoverStateLike,
  MarketListingStateLike,
  MarketQueryLike,
  MarketSearchResultLike,
  RemoteAnswerLike,
  SnapshotStoreLike,
  SourceFailure,
} from "./types.ts";

/** Số plugin mỗi lần đọc (bản gốc: 50). */
export const PAGE_SIZE = 50;

/** Trang lớn nhất Host nhận — biên của limit trong pluginMarket.search. */
export const MAX_PAGE = 100;

/** Trạng thái Discover lúc chưa vẽ tab lần nào. */
export const INITIAL_STATE: MarketDiscoverStateLike = {
  status: "idle",
  indexes: [],
  selected: null,
  listing: null,
  editing: false,
  draft: "",
  saving: false,
  sourceFailure: null,
};

/**
 * Dịch lỗi ghi nguồn của Host thành lý do hiển thị.
 * Nhận: failure — lỗi remote (mã + thông báo + chi tiết).
 * Trả: lý do đã phân loại để tra từ điển.
 */
function sourceFailure(failure: { code: string; message: string; details?: { reason?: string } }): SourceFailure {
  if (failure.code === "plugin-market/invalid-index-url") {
    return { kind: failure.details?.reason === "duplicate" ? "duplicate" : "invalid" };
  }
  if (failure.code === "plugin-market/settings-unavailable") return { kind: "unavailable" };
  return { kind: "other", reason: failure.message };
}

/**
 * Dịch lỗi đọc niêm yết thành lý do hiển thị.
 * Nhận: failure — lỗi remote.
 * Trả: fetch khi không đọc được, invalid khi chỉ mục sai định dạng.
 */
function listingFailure(failure: { code: string }): ListingFailure {
  return failure.code === "plugin-market/invalid-index" ? "invalid" : "fetch";
}

/** Sở hữu việc đọc Discover và sửa nguồn cho một Client. */
export class DiscoverController {
  /** Context phía browser (chỉ dùng remote). */
  private readonly ctx: ClientContextLike;

  /** Trạng thái Discover dùng chung, công bố cho tab. */
  readonly store: SnapshotStoreLike<MarketDiscoverStateLike>;

  /** Đã ngừng công bố kết quả về muộn chưa. */
  private disposed = false;

  /** Số lượt đọc nguồn, để bỏ kết quả cũ. */
  private indexRead = 0;

  /** Số lượt đọc niêm yết, để bỏ kết quả cũ. */
  private listingRead = 0;

  /** Chọn nguồn vừa thêm ngay khi danh sách chứa nó tới. */
  private selectAdded = false;

  /** Chạy lại lượt đọc niêm yết đã thất bại cuối. */
  private failed: () => void = () => {};

  /**
   * Dựng bộ điều khiển.
   * Nhận: ctx — context phía browser; createStore — hàm tạo store của dsh-client-store.
   * Trả: đối tượng điều khiển (không tự đọc gì cho tới khi tab gọi ensure).
   */
  constructor(ctx: ClientContextLike, createStore: <T>(initial: T) => SnapshotStoreLike<T>) {
    this.ctx = ctx;
    this.store = createStore(INITIAL_STATE);
  }

  /** Ngừng công bố kết quả về muộn. Nhận: không. Trả: không. */
  dispose(): void {
    this.disposed = true;
  }

  /**
   * Dựng mặt mà tab nhận qua inject.
   * Nhận: resolveText — hàm dịch văn bản của chỉ mục theo ngôn ngữ đang dùng.
   * Trả: mặt gồm nguồn trạng thái cho hook và các hành động của tab.
   */
  face(resolveText: DiscoverFaceLike["resolveText"]): DiscoverFaceLike {
    return {
      hooks: { discover: this.store, locale: this.ctx.locale },
      resolveText,
      ensure: () => {
        if (this.state().status === "idle") void this.loadIndexes();
      },
      reload: () => {
        void this.loadIndexes();
      },
      select: (url) => {
        if (this.state().selected === url) return;
        this.patch({ selected: url });
        void this.load(url, INITIAL_QUERY, PAGE_SIZE, false);
      },
      search: (query) => {
        const listing = this.state().listing;
        if (listing !== null) void this.load(listing.url, query, PAGE_SIZE, false);
      },
      more: () => {
        void this.loadMore();
      },
      retry: () => {
        this.failed();
      },
      refresh: () => {
        const listing = this.state().listing;
        if (listing !== null) void this.load(listing.url, listing.query, PAGE_SIZE, true);
      },
      toggleSources: () => {
        this.patch({ editing: !this.state().editing, sourceFailure: null });
      },
      editDraft: (text) => {
        this.patch({ draft: text, sourceFailure: null });
      },
      addSource: () => {
        const draft = this.state().draft.trim();
        if (draft === "") return;
        this.selectAdded = true;
        void this.saveSources([...this.state().indexes.map((index) => index.url), draft], true);
      },
      removeSource: (url) => {
        void this.saveSources(
          this.state().indexes.map((index) => index.url).filter((item) => item !== url),
          false,
        );
      },
    };
  }

  /** Đọc lại nguồn sau khi Host báo thay đổi hoặc kết nối đặt lại; tab chưa vẽ thì vẫn nằm idle. Nhận: không. Trả: không. */
  sourcesChanged(): void {
    if (this.state().status !== "idle") void this.loadIndexes();
  }

  /** Tính lại trạng thái cài của mọi plugin đã nạp sau khi bundle của hồ sơ đổi. Nhận: không. Trả: không. */
  bundlesChanged(): void {
    const { listing } = this.state();
    if (listing?.status === "ready" && listing.value !== null) {
      void this.load(listing.url, listing.query, Math.max(listing.value.entries.length, PAGE_SIZE), false);
    }
  }

  /**
   * Ảnh chụp trạng thái hiện tại.
   * Nhận: không.
   * Trả: trạng thái Discover.
   */
  private state(): MarketDiscoverStateLike {
    return this.store.getSnapshot();
  }

  /**
   * Gộp một phần trạng thái mới vào trạng thái hiện tại.
   * Nhận: next — các trường cần thay.
   * Trả: không.
   */
  private patch(next: Partial<MarketDiscoverStateLike>): void {
    this.store.set({ ...this.state(), ...next });
  }

  /**
   * Đọc danh sách nguồn chỉ mục rồi chọn nguồn để hiển thị.
   * Nhận: không.
   * Trả: Promise hoàn tất khi trạng thái đã được công bố.
   */
  private async loadIndexes(): Promise<void> {
    const read = ++this.indexRead;
    if (this.state().status === "idle") this.patch({ status: "loading" });
    const answer = await this.ctx.remote.pluginMarket.listIndexes();
    if (this.disposed || read !== this.indexRead) return;
    if (!answer.ok) {
      this.patch({ status: "error" });
      return;
    }
    const indexes = answer.value ?? [];
    const previous = this.state().selected;
    const last = indexes.at(-1);
    const selected =
      this.selectAdded && last !== undefined
        ? last.url
        : indexes.some((index) => index.url === previous)
          ? previous
          : (indexes[0]?.url ?? null);
    this.selectAdded = false;
    this.patch({
      status: "ready",
      indexes,
      selected,
      ...(indexes.length === 0 ? { editing: false } : {}),
    });
    if (selected === null) this.patch({ listing: null });
    else if (selected !== this.state().listing?.url) void this.load(selected, INITIAL_QUERY, PAGE_SIZE, false);
  }

  /**
   * Đọc count kết quả đầu của một truy vấn theo từng trang Host nhận, thay kết quả đang hiện ngay lập tức.
   * Trang sau ghim tài liệu của trang đầu; khi Host trả lời từ tài liệu đã bị thay thì lượt đọc khởi động lại
   * một lần, và thất bại nếu tài liệu bị thay lần nữa. Id không được chỉ mục khai sẽ rời khỏi truy vấn.
   * Nhận: url — chỉ mục; query — truy vấn; count — số kết quả cần; refresh — buộc đọc lại tài liệu.
   * Trả: Promise hoàn tất khi niêm yết đã được công bố.
   */
  private async load(url: string, query: DiscoverQuery, count: number, refresh: boolean): Promise<void> {
    const read = ++this.listingRead;
    const current = this.state().listing;
    const kept = current?.url === url ? current.value : null;
    const answered = current?.url === url ? current.answered : null;
    this.patch({ listing: { url, query, status: "loading", value: kept, answered, failure: null } });
    const fail = (failure: ListingFailure): MarketListingStateLike => {
      this.failed = () => {
        void this.load(url, query, count, refresh);
      };
      return { url, query, status: "error", value: kept, answered, failure };
    };
    let value: MarketSearchResultLike | null = null;
    let restarted = false;
    while (value === null || (value.entries.length < count && value.nextOffset !== null)) {
      const offset = value?.entries.length ?? 0;
      const limit = Math.min(count - offset, MAX_PAGE);
      const answer = await this.page(url, query, offset, limit, value?.fetchedAt, refresh && value === null && !restarted);
      if (this.disposed || read !== this.listingRead) return;
      if (!answer.ok || answer.value === undefined) {
        this.settle(url, fail(listingFailure(answer.error ?? { code: "unknown" })), answer);
        return;
      }
      const page = answer.value;
      if (value === null || page.fetchedAt === value.fetchedAt) {
        value = value === null ? page : { ...page, entries: [...value.entries, ...page.entries] };
      } else if (restarted) {
        this.patch({ listing: fail("changed") });
        return;
      } else {
        restarted = true;
        value = null;
      }
    }
    const declared = declaredQuery(query, value.metadata);
    if (declared !== query) {
      void this.load(url, declared, count, false);
      return;
    }
    this.settle(url, { url, query, status: "ready", value, answered: query, failure: null }, { ok: true, value });
  }

  /**
   * Đọc trang sau kết quả đang hiện; tài liệu bị thay thì đọc lại từ trang đầu.
   * Nhận: không.
   * Trả: Promise hoàn tất khi niêm yết đã được công bố.
   */
  private async loadMore(): Promise<void> {
    const listing = this.state().listing;
    if (listing === null) return;
    if (listing.status !== "ready" && listing.status !== "error") return;
    if (listing.answered !== listing.query) return;
    const value = listing.value;
    if (value === null || value.nextOffset === null) return;
    const read = ++this.listingRead;
    this.patch({ listing: { ...listing, status: "more", failure: null } });
    const answer = await this.page(listing.url, listing.query, value.entries.length, PAGE_SIZE, value.fetchedAt, false);
    if (this.disposed || read !== this.listingRead) return;
    if (!answer.ok || answer.value === undefined) {
      this.failed = () => {
        void this.loadMore();
      };
      this.settle(
        listing.url,
        { ...listing, status: "error", failure: listingFailure(answer.error ?? { code: "unknown" }) },
        answer,
      );
      return;
    }
    if (answer.value.fetchedAt !== value.fetchedAt) {
      void this.load(listing.url, listing.query, value.entries.length + PAGE_SIZE, false);
      return;
    }
    const next: MarketSearchResultLike = { ...answer.value, entries: [...value.entries, ...answer.value.entries] };
    this.settle(listing.url, { ...listing, status: "ready", value: next, failure: null }, { ok: true, value: next });
  }

  /**
   * Gọi remote đọc một trang kết quả.
   * Nhận: url — chỉ mục; query — truy vấn; offset/limit — cửa sổ trang; fetchedAt — tài liệu cần nối tiếp; refresh — buộc đọc lại.
   * Trả: Promise của câu trả lời remote.
   */
  private page(
    url: string,
    query: DiscoverQuery,
    offset: number,
    limit: number,
    fetchedAt: number | undefined,
    refresh: boolean,
  ): Promise<RemoteAnswerLike<MarketSearchResultLike>> {
    const request: MarketQueryLike = {
      ...(query.text.trim() === "" ? {} : { text: query.text }),
      ...(query.category === null ? {} : { category: query.category }),
      ...(query.labels.length === 0 ? {} : { labels: query.labels }),
      sort: query.sort,
      offset,
      limit,
      ...(fetchedAt === undefined ? {} : { fetchedAt }),
      ...(refresh ? { refresh: true } : {}),
    };
    return this.ctx.remote.pluginMarket.search(url, request);
  }

  /**
   * Công bố một lượt đọc đã kết thúc, kèm tiêu đề hoặc lỗi mà nó cho biết về nguồn.
   * Nhận: url — chỉ mục; listing — niêm yết mới; answer — câu trả lời remote.
   * Trả: không.
   */
  private settle(url: string, listing: MarketListingStateLike, answer: RemoteAnswerLike<MarketSearchResultLike>): void {
    const indexes = this.state().indexes.map((index) => {
      if (index.url !== url) return index;
      if (!answer.ok) return { ...index, error: answer.error?.message ?? "error" };
      const value = answer.value;
      if (value === undefined) return index;
      return {
        url,
        title: value.title,
        ...(value.description === undefined ? {} : { description: value.description }),
      };
    });
    this.patch({ listing, indexes });
  }

  /**
   * Ghi danh sách nguồn rồi đọc lại.
   * Nhận: urls — danh sách URL mới; adding — lần ghi này là THÊM nguồn (xoá ô nháp khi xong).
   * Trả: Promise hoàn tất khi danh sách nguồn đã được đọc lại.
   */
  private async saveSources(urls: readonly string[], adding: boolean): Promise<void> {
    this.patch({ saving: true, sourceFailure: null });
    const answer = await this.ctx.remote.pluginMarket.setIndexes(urls);
    if (this.disposed) return;
    if (!answer.ok) {
      this.selectAdded = false;
      this.patch({ saving: false, sourceFailure: sourceFailure(answer.error ?? { code: "unknown", message: "error" }) });
      return;
    }
    this.patch({ saving: false, ...(adding ? { draft: "" } : {}) });
    await this.loadIndexes();
  }
}
