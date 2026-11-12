/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đệm danh sách `/models` theo TỪNG credential: một lượt nạp duy nhất cho mỗi phạm vi, làm mới
 *      NỀN khi danh sách quá tuổi, và giữ danh sách tốt cuối cùng khi lượt nạp hỏng. Bản viết lại của
 *      Galaxy Blackhole cho row llm-deepseek-account (@deepseek-ai/dsh-llm-deepseek-account) —
 *      nguồn đối chiếu: README.md của package (G4).
 */

import { createHash } from "node:crypto";

import { deadline } from "@deepseek-ai/dsh-timeout";
import type { Deadline } from "@deepseek-ai/dsh-timeout";

import type { CatalogSettings } from "./config.ts";
import { LISTING_TIMEOUT } from "./listing.ts";
import type { ModelListing } from "./listing.ts";

/** Đầu vào do tầng host sở hữu cho MỘT thể hiện đệm danh sách. */
export interface CatalogDependencies {
  /** Cấu hình endpoint hiện tại, đọc LẠI ở mọi lượt truy cập. */
  readonly settings: () => CatalogSettings;
  /** Token tài khoản được phép cho `url`, hoặc `undefined` khi chưa đăng nhập. */
  readonly token: (url: string) => Promise<string | undefined>;
  /** Thực hiện một lượt xin danh sách có xác thực bằng `token`; `signal` mang deadline {@link LISTING_TIMEOUT}. */
  readonly load: (url: string, token: string, signal: AbortSignal) => Promise<ModelListing>;
  /** Đồng hồ dùng để tính tuổi danh sách. */
  readonly now: () => number;
  /** Báo một danh sách đã nạp. */
  readonly info: (message: string) => void;
  /** Báo lần hỏng ĐẦU TIÊN của một chuỗi hỏng. */
  readonly warn: (message: string) => void;
}

/** Thứ mà bước phân giải request đọc. */
export interface CatalogView {
  /** Có token tài khoản dùng được cho endpoint danh sách hay không. */
  readonly signedIn: boolean;
  /** Danh sách thành công cuối cùng của credential + endpoint này; `undefined` cho tới khi có một lượt thành công. */
  readonly listing: ModelListing | undefined;
}

/**
 * Giải phóng một deadline đã cấp, tức gọi `[Symbol.dispose]` của nó, mà KHÔNG phụ thuộc việc lib
 * chuẩn của chương trình có khai báo `Symbol.dispose` hay không. Ngữ nghĩa giống hệt `using` của
 * bản gốc: hẹn giờ được xoá ngay khi lượt nạp kết thúc.
 * Nhận: deadline cần dọn.
 * Trả: không.
 */
function disposeDeadline(d: Deadline): void {
  const key = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (key === undefined) return;
  const release = (d as unknown as Record<symbol, (() => void) | undefined>)[key];
  release?.();
}

/**
 * Chờ `task`, trừ khi `signal` huỷ trước; bản thân task VẪN chạy tiếp.
 * Nhận: lượt nạp dùng chung và tín hiệu huỷ của RIÊNG lượt chờ này.
 * Trả: không, khi task xong; ném lý do huỷ khi `signal` huỷ trước.
 */
async function abandonable(task: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (signal === undefined) return task;
  const abandoned = Promise.withResolvers<void>();
  const abandon = (): void => {
    abandoned.reject(signal.reason);
  };
  signal.addEventListener("abort", abandon, { once: true });
  try {
    await Promise.race([task, abandoned.promise]);
  } finally {
    signal.removeEventListener("abort", abandon);
  }
}

/** Đệm danh sách của MỘT route tài khoản; mỗi cặp endpoint + credential có phạm vi riêng. */
export class AccountModelCatalog {
  /** Callback của tầng host. */
  private readonly dependencies: CatalogDependencies;
  /** Phạm vi hiện tại: endpoint + băm token; `undefined` khi chưa đăng nhập. */
  private scope: string | undefined;
  /** Danh sách thành công cuối cùng của phạm vi hiện tại. */
  private listing: ModelListing | undefined;
  /** Thời điểm kết thúc lượt nạp mới nhất trong phạm vi này; `undefined` trước lượt đầu. */
  private settledAt: number | undefined;
  /** Lượt nạp dùng chung đang chạy, nếu có. */
  private inflight: Promise<void> | undefined;
  /** Bộ huỷ của lượt nạp hiện tại. */
  private request: AbortController | undefined;
  /** Thế hệ phạm vi: kết quả của thế hệ cũ bị BỎ. */
  private generation = 0;
  /** Đang trong một chuỗi lượt nạp hỏng (chỉ cảnh báo lần đầu). */
  private failing = false;
  /** Đã dọn: mọi kết quả và lượt truy cập sau đó không đổi gì. */
  private closed = false;

  /**
   * Nhận: settings, credential, transport, đồng hồ và các callback chẩn đoán của tầng host.
   */
  constructor(dependencies: CatalogDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Khung nhìn đã công bố cuối cùng, KHÔNG I/O.
   * Trả: trạng thái đăng nhập và danh sách của phạm vi hiện tại.
   */
  current(): CatalogView {
    return {
      signedIn: this.scope !== undefined,
      listing: this.listing,
    };
  }

  /**
   * Phân giải khung nhìn cho credential hiện tại. Lượt truy cập ĐẦU của một phạm vi CHỜ lượt nạp của
   * nó (deadline của request chặn); các lượt sau trả về NGAY và làm mới danh sách quá tuổi ở NỀN.
   * Nhận: tín hiệu chỉ huỷ LƯỢT CHỜ này; lượt nạp dùng chung vẫn chạy tiếp.
   * Trả: khung nhìn sau khi lượt nạp đầu tiên của phạm vi kết thúc.
   */
  async view(signal?: AbortSignal): Promise<CatalogView> {
    const settings = this.dependencies.settings();
    const token = await this.dependencies.token(settings.url);
    signal?.throwIfAborted();
    if (this.closed) return this.current();
    const scope =
      token === undefined ? undefined : `${settings.url}\n${createHash("sha256").update(token).digest("hex")}`;
    if (scope !== this.scope) this.rescope(scope);
    if (token !== undefined) {
      if (this.settledAt === undefined) await abandonable(this.start(settings, token), signal);
      else if (this.dependencies.now() - this.settledAt >= settings.maxAgeMs) this.start(settings, token);
    }
    return this.current();
  }

  /**
   * Huỷ các lượt nạp đang chạy; kết quả và lượt truy cập sau đó không đổi gì.
   * Trả: không.
   */
  dispose(): void {
    this.closed = true;
    this.generation += 1;
    this.request?.abort();
  }

  /**
   * Đổi phạm vi (endpoint/credential khác): huỷ lượt nạp cũ và xoá mọi thứ của phạm vi trước.
   * Nhận: phạm vi mới, hoặc `undefined` khi chưa đăng nhập.
   * Trả: không.
   */
  private rescope(scope: string | undefined): void {
    this.request?.abort();
    this.scope = scope;
    this.listing = undefined;
    this.settledAt = undefined;
    this.inflight = undefined;
    this.failing = false;
    this.generation += 1;
  }

  /**
   * Bắt đầu (hoặc dùng lại) MỘT lượt nạp cho phạm vi hiện tại.
   * Nhận: cấu hình danh sách và token của phạm vi.
   * Trả: promise của lượt nạp — dùng chung với mọi lượt chờ khác trong cùng phạm vi.
   */
  private start(settings: CatalogSettings, token: string): Promise<void> {
    if (this.inflight !== undefined) return this.inflight;
    this.generation += 1;
    const generation = this.generation;
    const request = new AbortController();
    this.request = request;
    const limit = deadline(request.signal, settings.timeoutMs, LISTING_TIMEOUT);
    const run: Promise<void> = this.dependencies.load(settings.url, token, limit.signal).then(
      (listing) => {
        if (generation !== this.generation) return;
        this.listing = listing;
        this.settledAt = this.dependencies.now();
        this.failing = false;
        this.dependencies.info(
          `model listing from ${settings.url} loaded ${listing.entries.length} model(s), skipped ${listing.skipped} row(s)`,
        );
      },
      (error: unknown) => {
        if (generation !== this.generation) return;
        if (!this.failing) {
          const fallback = this.listing === undefined ? "using the bundled catalog" : "keeping the previous catalog";
          this.dependencies.warn(`model listing from ${settings.url} failed (${String(error)}); ${fallback}`);
        }
        this.settledAt = this.dependencies.now();
        this.failing = true;
      },
    ).finally(() => {
      disposeDeadline(limit);
      if (this.inflight === run) this.inflight = undefined;
    });
    this.inflight = run;
    return run;
  }
}
