/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc `LocalSpillStore`: bản cài đặt bằng hệ tệp host của seam lưu tràn `@deepseek-ai/dsh-spill`.
 *      Lưu văn bản quá khổ vào một tệp riêng theo phiên rồi trả locator đường dẫn kèm hướng dẫn đọc
 *      lại bằng read/grep; sau khi kích hoạt chạy MỘT lượt dọn best-effort cho tệp cũ hơn
 *      `cleanupPeriodDays`. Bản viết lại của Galaxy Blackhole cho row spill-local
 *      (@deepseek-ai/dsh-spill-local) — nguồn đối chiếu: lib/types/index.d.ts của gói gốc.
 */
import type { Context } from "@deepseek-ai/cordis";
import { SpillLocator, SpillStore } from "@galaxy-blackhole/gbh-spill";
import type { SaveTextSpill, SpillRef } from "@galaxy-blackhole/gbh-spill";
import z from "@deepseek-ai/schemastery";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { gatherSweepRoots, sweepSpillRoots } from "./cleanup.ts";
import type { SweepRoot, WarnFn } from "./cleanup.ts";
import { privateRoot, saveTextFile } from "./store.ts";

export { discoverDefaultRoots, sweepSpillRoots } from "./cleanup.ts";
export type { SweepOptions, SweepRoot, WarnFn } from "./cleanup.ts";
export { DEFAULT_ROOT_PREFIX, encodeSegment, isErrno, privateRoot, saveTextFile, sessionDir } from "./store.ts";
export type { SavedText, SaveTextOptions } from "./store.ts";

/** Cấu hình plugin (mọi trường tuỳ chọn — `static Config` cấp giá trị mặc định). */
export interface Config {
  /**
   * Thư mục gốc cho các tệp tràn. Bỏ trống thì dùng thư mục riêng (0700) theo tiến trình, tạo lười dưới
   * thư mục tạm của hệ điều hành — mặc định an toàn cho một triển khai cục bộ. Đặt nó để giữ tệp tràn
   * dưới một vị trí đã biết.
   */
  root?: string;
  /**
   * Số ngày sau đó một tệp tràn trở nên đủ điều kiện cho lượt dọn MỘT LẦN lúc khởi động. Mặc định `30`;
   * `0` tắt hẳn việc dọn. Tệp có `mtime` CŨ HƠN HẲN mốc bị xoá và thư mục rỗng bị tỉa; tệp mới, symlink
   * và mục không liên quan được để nguyên. Trên POSIX, lượt dọn bỏ qua gốc và thư mục phiên mà người
   * dùng cục bộ khác có thể sửa hoặc thay thế. Thời hạn giữ là CỐ Ý — một phiên được tiếp tục hay
   * fork có thể còn tham chiếu locator cũ cho tới khi nó hết hạn.
   */
  cleanupPeriodDays?: number;
}

/** Hình dạng sau khi schemastery đã áp giá trị mặc định. */
type ResolvedConfig = Required<Omit<Config, "root">> & Pick<Config, "root">;

/** Số mili giây trong một ngày — chuyển `cleanupPeriodDays` của cấu hình thành mốc tuổi của lượt dọn. */
const MS_PER_DAY = 1440 * 60 * 1e3;

/**
 * Backend tràn bằng hệ tệp cục bộ. Tệp nằm dưới `<root>/session-<hash>/…` với tên không đoán được,
 * một lượt ghi độc quyền chỉ-chủ-sở-hữu (0600), và gốc riêng (0700) — một kết quả tool bị tràn KHÔNG
 * được để người dùng cục bộ khác đọc, cũng không được để một symlink cài sẵn chuyển hướng.
 *
 * Sau khi kích hoạt, nó phát MỘT lượt dọn best-effort (xem {@link Config.cleanupPeriodDays}) thu hồi
 * tệp tràn quá hạn mà không làm chậm thời điểm sẵn sàng phục vụ; lượt dọn thuộc fiber của plugin và
 * được `await` trong lúc gỡ, nên một lượt gỡ fiber không bao giờ trả về trước khi nó lắng.
 */
export class LocalSpillStore extends SpillStore {
  /** Schema cấu hình — hình dạng NGUYÊN VĂN của bản gốc (bước nhảy 1, sàn 0, mặc định 30 ngày). */
  static Config = z.object({
    root: z.string(),
    cleanupPeriodDays: z.number().step(1).min(0).default(30),
  });

  /** Gốc tràn tuyệt đối đã giải (cấu hình `root`, nếu không thì gốc riêng mặc định), chốt lúc dựng. */
  readonly root: string;

  /** Cấu hình đã kiểm (schemastery đã áp mặc định `cleanupPeriodDays` trước khi dựng). */
  readonly config: ResolvedConfig;

  /**
   * Lượt dọn lúc khởi động đang chạy (hoặc đã lắng). Giữ lại để lượt gỡ `await` được; `undefined` khi
   * việc dọn bị tắt (`cleanupPeriodDays === 0`).
   */
  private cleanup: Promise<void> | undefined;

  /**
   * Đăng ký service `spillStore` trên context hiện tại và phát lượt dọn lúc khởi động.
   * Nhận: context host (kernel cordis cấp) và cấu hình đã áp mặc định.
   * Trả: thực thể đã đăng ký — gốc tràn chốt lúc dựng, lượt dọn (nếu bật) thuộc fiber của plugin.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx);
    this.config = config as ResolvedConfig;
    this.root = config.root !== undefined ? resolve(config.root) : privateRoot();
    ctx.effect(
      function* (this: LocalSpillStore) {
        if (this.config.cleanupPeriodDays > 0) {
          const warn: WarnFn = (message) => {
            this.ctx.logger.warn(message);
          };
          this.cleanup = this.runCleanup(warn);
        }
        yield async () => {
          await this.cleanup;
        };
      }.bind(this),
      "spill-local cleanup sweep",
    );
  }

  /**
   * Chạy lượt dọn MỘT LẦN: gom các gốc cần quét (xem {@link gatherRoots}) rồi quét tất cả ở mốc tuổi.
   * Best-effort — {@link sweepSpillRoots} chứa mọi lỗi hệ tệp, nên hàm này không bao giờ reject và
   * không thể làm hỏng lượt kích hoạt hay một lượt ghi tràn đang chạy song song.
   *
   * @param warn Sink cho lỗi hệ tệp đã chứa.
   * @returns Hoàn tất khi lượt dọn xong (không bao giờ reject).
   */
  private async runCleanup(warn: WarnFn): Promise<void> {
    const cutoffMs = Date.now() - this.config.cleanupPeriodDays * MS_PER_DAY;
    await sweepSpillRoots({
      roots: await this.gatherRoots(warn),
      cutoffMs,
      warn,
    });
  }

  /**
   * Các gốc mà lượt dọn lúc khởi động bao phủ: mỗi gốc tạm `dsh-spill-*` mặc định của lượt chạy trước
   * (xem {@link discoverDefaultRoots}), được tỉa khi rỗng, cộng gốc đang hoạt động/cấu hình — bản thân
   * nó không bao giờ bị tỉa khi tiến trình sống còn có thể ghi vào. Thư mục phiên rỗng được tỉa ở MỌI
   * gốc. Danh tính hệ tệp khử trùng các alias trước khi gốc đang hoạt động đè lên một gốc dò được trùng
   * thành không-tỉa. Test đè hàm này để cắm một bộ gốc cách ly — và, vì đây là điểm gom BẤT ĐỒNG BỘ duy
   * nhất của lượt dọn, để giữ lượt dọn mở qua một lượt gỡ cho phép kiểm "lắng"; đây là đường may cho
   * test, không phải nút vặn triển khai.
   *
   * @param warn Sink cho lỗi dò đã chứa.
   * @returns Các gốc cần quét, mỗi gốc kèm cờ tỉa-khi-rỗng.
   */
  protected async gatherRoots(warn: WarnFn): Promise<SweepRoot[]> {
    return gatherSweepRoots(this.root, warn, this.defaultRootsBase());
  }

  /**
   * Thư mục được quét tìm các gốc `dsh-spill-*` mặc định của lượt chạy trước — thư mục tạm của hệ điều
   * hành, nơi {@link privateRoot} tạo chúng (tích tụ chỉ xảy ra ở đó). Test đè hàm này để trỏ lượt dò
   * vào một fixture cách ly thay vì thư mục tạm thật; đây là đường may cho test, không phải nút vặn
   * triển khai.
   *
   * @returns Thư mục gốc cần quét tìm các gốc tràn mặc định.
   */
  protected defaultRootsBase(): string {
    return tmpdir();
  }

  /**
   * Lưu toàn văn của một yêu cầu tràn vào tệp riêng theo phiên rồi trả tham chiếu cho model.
   * Nhận: chủ sở hữu (id phiên) · nguồn mô tả · tên gợi ý · toàn văn cần lưu.
   * Trả: locator đường dẫn đã brand, độ dài UTF-8 theo byte, và câu hướng dẫn đọc lại NGUYÊN VĂN của
   * bản gốc; ném khi hệ tệp từ chối (quyền, ENOSPC, backend không sẵn sàng).
   */
  async saveText(input: SaveTextSpill): Promise<SpillRef> {
    const saved = await saveTextFile({
      root: this.root,
      sessionId: input.owner.sessionId,
      suggestedName: input.suggestedName,
      content: input.content,
    });
    return {
      locator: SpillLocator(saved.path),
      bytes: saved.bytes,
      retrievalHint: "Use read with offset/limit, or grep this path to search within it.",
    };
  }
}

export default LocalSpillStore;
