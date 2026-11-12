/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Local — vùng `lib/types/index.js` (dòng
 *      893–1078) của bundle gốc: `LocalAttachmentStore` (kho đính kèm bền vững theo nội dung dưới
 *      DSH_HOME), toàn bộ hằng DEFAULT_… và MAX_…, và tái xuất ĐÚNG danh sách export của bundle.
 *      Bảng đối chiếu G4 + phần CHƯA chắc: xem README.md của package.
 */

import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { AttachmentStore } from "@deepseek-ai/dsh-attachment";
import type {
  FileAttachmentRef,
  ImageAttachmentLimits,
  ImageAttachmentRef,
  ImageRequestTarget,
  RequestImageAttachment,
  SaveFileAttachment,
  SaveFileStreamAttachment,
  SaveImageAttachment,
  StoredImageAttachment,
} from "@deepseek-ai/dsh-attachment";
import { dshCachePath, resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import z from "@deepseek-ai/schemastery";
import { CompressionLimiter, compressionFailure } from "./compression-limiter.ts";
import { readFileStreamVerbatim, saveFileStreamVerbatim, saveFileVerbatim, storedFilePath } from "./file-store.ts";
import type { NormalizationPolicy } from "./normalization.ts";
import { readRequestImageFile, requestImageVariantId } from "./request-image.ts";
import { commitPreparedImageFile, normalizedImagePath, prepareImageFile, readImageFile, saveImageFile, validateImageFile } from "./store.ts";

/**
 * Tái xuất ĐÚNG bề mặt công khai của bundle gốc (dòng 1079): không thêm tên nào, không bớt tên nào.
 * Nhận: không có.
 * Trả: 6 hàm từ hai module chuẩn hoá/yêu cầu ảnh, 5 hàm từ module kho, và 3 kiểu chỉ-mượt-thời-gian-chạy.
 */
export { canPassThroughNormalization, normalizeImage } from "./normalization.ts";
export type { NormalizationPolicy, NormalizedImage } from "./normalization.ts";
export { readRequestImageFile, requestImageVariantId } from "./request-image.ts";
export { commitPreparedImageFile, prepareImageFile, readImageFile, saveImageFile, validateImageFile } from "./store.ts";
export type { PreparedImageFile } from "./store.ts";

/**
 * Trần byte mã hoá mặc định cho MỘT ảnh nộp vào (20 MiB); nguồn quá cỡ bị TỪ CHỐI, không bị thu nhỏ.
 * Nhận: không có.
 * Trả: 20971520.
 */
export const DEFAULT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Số ảnh tối đa mặc định trong MỘT lượt nhắc.
 * Nhận: không có.
 * Trả: 20.
 */
export const DEFAULT_MAX_IMAGES_PER_MESSAGE = 20;

/**
 * Tổng byte ảnh mã hoá tối đa mặc định trong MỘT lượt nhắc (200 MiB).
 * Nhận: không có.
 * Trả: 209715200.
 */
export const DEFAULT_MAX_MESSAGE_IMAGE_BYTES = 200 * 1024 * 1024;

/**
 * Tổng số điểm ảnh gốc tối đa mặc định cho MỘT ảnh nộp vào (64.000.000).
 * Nhận: không có.
 * Trả: 64000000.
 */
export const DEFAULT_MAX_IMAGE_PIXELS = 64e6;

/**
 * Trần điểm ảnh mặc định cho MỘT cạnh của ảnh nộp vào (8192).
 * Nhận: không có.
 * Trả: 8192.
 */
export const DEFAULT_MAX_IMAGE_DIMENSION = 8192;

/**
 * Ngân sách tổng điểm ảnh mặc định của ảnh ĐÃ CHUẨN HOÁ được lưu (2048 × 2048). Nguồn lớn hơn vẫn được
 * nhận rồi thu nhỏ theo tỉ lệ, nên ngưỡng nhận chỉ chặn thứ đi kèm MỌI yêu cầu model sau đó mà không từ
 * chối nguồn lớn thông thường; tỉ lệ khung cực đoan giữ độ phân giải cạnh ngắn thay vì sụp theo luật cạnh dài.
 * Nhận: không có.
 * Trả: 4194304.
 */
export const DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS = 2048 * 2048;

/**
 * Trần cạnh dài mặc định của ảnh đã chuẩn hoá được lưu, áp SAU ngân sách tổng điểm ảnh.
 * Nhận: không có.
 * Trả: 8192.
 */
export const DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION = 8192;

/**
 * Đích số byte mã hoá mặc định cho MỘT ảnh đã chuẩn hoá được lưu (4 MiB).
 * Nhận: không có.
 * Trả: 4194304.
 */
export const DEFAULT_NORMALIZED_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Số phép biến đổi ảnh native đồng thời mặc định (thận trọng) cho mỗi kho.
 * Nhận: không có.
 * Trả: 2.
 */
export const DEFAULT_IMAGE_COMPRESSION_CONCURRENCY = 2;

/**
 * Trần cấu hình được của số phép biến đổi ảnh native đồng thời cho mỗi kho.
 * Nhận: không có.
 * Trả: 8.
 */
export const MAX_IMAGE_COMPRESSION_CONCURRENCY = 8;

/** Cấu hình của kho đính kèm cục bộ — mọi trường đều tuỳ chọn, mặc định lấy từ các hằng DEFAULT_* ở trên. */
export interface Config {
  /** Nhà harness tường minh; bỏ trống thì theo `DSH_HOME`, rồi `~/.dsh`. */
  dshHome?: string;
  /** Số byte mã hoá tối đa nhận cho một ảnh nộp vào. Mặc định: 20 MiB. */
  maxImageBytes?: number;
  /** Số ảnh tối đa nhận trong một lượt nhắc. Mặc định: 20. */
  maxImagesPerMessage?: number;
  /** Tổng byte ảnh mã hoá tối đa nhận trong một lượt nhắc. Mặc định: 200 MiB. */
  maxMessageImageBytes?: number;
  /** Tích rộng × cao gốc tối đa nhận cho một ảnh. Mặc định: 64.000.000. */
  maxImagePixels?: number;
  /** Rộng tối đa và cao tối đa gốc của một ảnh, tính theo điểm ảnh. Mặc định: 8192px. */
  maxImageDimension?: number;
  /** Ngân sách tổng điểm ảnh của ảnh đã chuẩn hoá, độc lập nhà cung cấp, được lưu lại. */
  normalizedImageMaxPixels?: number;
  /** Trần cạnh dài của ảnh đã chuẩn hoá được lưu, áp sau ngân sách tổng điểm ảnh. */
  normalizedImageMaxDimension?: number;
  /** Đích số byte mã hoá của ảnh đã chuẩn hoá được lưu; khi không mức chất lượng nào vừa thì giữ đầu ra NHỎ NHẤT. */
  normalizedImageMaxBytes?: number;
  /** Số phép chuẩn hoá hoặc biến đổi ảnh-yêu-cầu đồng thời tối đa trong thể hiện dịch vụ này. */
  imageCompressionConcurrency?: number;
}

/**
 * Chuẩn hoá lý do huỷ của một `AbortSignal` thành `Error`.
 * Nhận: `signal` — tín hiệu huỷ đã kích hoạt.
 * Trả: chính `signal.reason` khi nó đã là `Error`; ngược lại một `Error` mới mang câu
 *      "Attachment request cancelled with a non-Error reason." và giữ lý do gốc trong `cause`.
 */
function abortReason(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error("Attachment request cancelled with a non-Error reason.", { cause: reason });
}

/**
 * MỘT phép biến đổi ảnh dùng chung cho nhiều người chờ, huỷ được theo từng người chờ.
 *
 * Người chờ đầu tiên khởi động phép biến đổi với tín hiệu RIÊNG của lượt dùng chung; mỗi người chờ cộng
 * một vào bộ đếm, và chỉ khi người chờ CUỐI CÙNG huỷ mà phép biến đổi chưa xong thì tín hiệu dùng chung
 * mới bị huỷ — nhờ vậy một yêu cầu bị bỏ không kéo theo các yêu cầu khác.
 */
class SharedRequest<T> {
  /** Tín hiệu dùng chung của lượt này (công khai trong module để `requestVersion` kiểm nó đã huỷ chưa). */
  readonly controller = new AbortController();

  /** Kết quả dùng chung; mọi người chờ quan sát cùng một promise. */
  readonly promise: Promise<T>;

  /** Cờ cho biết phép biến đổi đã kết thúc (thành công hay thất bại). */
  private settled = false;

  /** Số người chờ đang còn quan tâm tới lượt này. */
  private waiters = 0;

  /**
   * Khởi động phép biến đổi dùng chung.
   * Nhận: `start` — hàm nhận tín hiệu dùng chung và trả promise của phép biến đổi.
   * Trả: thể hiện mới; `promise` đã chạy, `settled` bật ngay khi promise kết thúc.
   */
  constructor(start: (signal: AbortSignal) => Promise<T>) {
    this.promise = start(this.controller.signal).finally(() => {
      this.settled = true;
    });
  }

  /**
   * Chờ kết quả dùng chung, có thể huỷ riêng cho người gọi này.
   * Nhận: `signal` — tín hiệu huỷ của người gọi (bỏ trống thì chờ không huỷ được).
   * Trả: promise kết quả; huỷ thì từ chối bằng lý do của `signal`, lỗi của phép biến đổi được chuẩn hoá
   *      qua {@link compressionFailure}. Tín hiệu dùng chung chỉ bị huỷ khi người chờ cuối cùng bỏ đi.
   */
  wait(signal?: AbortSignal): Promise<T> {
    signal?.throwIfAborted();
    this.waiters += 1;
    if (signal === undefined) {
      return this.promise.finally(() => {
        this.release(false, undefined);
      });
    }
    let released = false;
    const release = (cancelled: boolean): void => {
      if (released) return;
      released = true;
      this.release(cancelled, signal);
    };
    return new Promise<T>((resolve, reject) => {
      const abort = (): void => {
        release(true);
        reject(abortReason(signal));
      };
      signal.addEventListener("abort", abort, { once: true });
      this.promise.then(
        (value) => {
          signal.removeEventListener("abort", abort);
          release(false);
          resolve(value);
        },
        (error: unknown) => {
          signal.removeEventListener("abort", abort);
          release(false);
          reject(compressionFailure(error));
        },
      );
    });
  }

  /**
   * Giảm bộ đếm người chờ và huỷ tín hiệu dùng chung khi không còn ai.
   * Nhận: `cancelled` — người chờ này bỏ đi vì huỷ hay vì đã nhận kết quả; `signal` — tín hiệu của người
   *       chờ cuối cùng (chỉ dùng để lấy lý do huỷ).
   * Trả: không có; có thể huỷ `controller` khi đây là người chờ cuối, phép biến đổi chưa xong, và có tín hiệu.
   */
  private release(cancelled: boolean, signal: AbortSignal | undefined): void {
    this.waiters -= 1;
    if (cancelled && this.waiters === 0 && !this.settled && signal !== undefined) this.controller.abort(abortReason(signal));
  }
}

/**
 * Kho đính kèm cục bộ bền vững, địa chỉ hoá theo nội dung, đặt dưới `DSH_HOME`.
 *
 * Ảnh được kiểm điều kiện nhận, chuẩn hoá độc lập nhà cung cấp rồi lưu một lần cho mỗi nội dung; tệp
 * thường được lưu nguyên byte. Cùng nội dung thì chỉ một đối tượng, đọc lên đều kiểm lại độ dài và digest.
 * Mọi phép biến đổi ảnh native đều đi qua MỘT bộ giới hạn đồng thời của thể hiện này.
 */
export class LocalAttachmentStore extends AttachmentStore {
  /** Schema cấu hình (schemastery) — giữ nguyên từng trường, bước nhảy, biên và giá trị mặc định của bản gốc. */
  static Config = z.object({
    dshHome: z.string(),
    maxImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGE_BYTES),
    maxImagesPerMessage: z.number().step(1).min(1).default(20),
    maxMessageImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_MESSAGE_IMAGE_BYTES),
    maxImagePixels: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGE_PIXELS),
    maxImageDimension: z.number().step(1).min(1).default(DEFAULT_MAX_IMAGE_DIMENSION),
    normalizedImageMaxPixels: z.number().step(1).min(1).default(DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS),
    normalizedImageMaxDimension: z.number().step(1).min(1).default(DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION),
    normalizedImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_NORMALIZED_IMAGE_MAX_BYTES),
    imageCompressionConcurrency: z.number().step(1).min(1).max(8).default(2),
  });

  /** Gốc lưu trữ tuyệt đối có phiên bản: `<DSH_HOME>/attachments/v1`. */
  readonly root: string;

  /** Điều kiện nhận ảnh đã chốt của thể hiện này (đóng băng). */
  override readonly imageLimits: ImageAttachmentLimits;

  /** Chính sách chuẩn hoá đã chốt, độc lập nhà cung cấp (đóng băng). */
  readonly normalizationPolicy: Readonly<NormalizationPolicy>;

  /** Trần đồng thời đã chốt của thể hiện này. */
  readonly imageCompressionConcurrency: number;

  /** Gốc cache yêu cầu ảnh (`dshCachePath(..., "attachments")`), biến thể nằm ở thư mục con `request-images`. */
  private readonly cacheRoot: string;

  /** Bộ giới hạn đồng thời của thể hiện này cho mọi phép biến đổi ảnh native. */
  private readonly compression: CompressionLimiter;

  /** Các lượt biến đổi ảnh-yêu-cầu đang chạy, khoá theo id biến thể. */
  private readonly requestInflight = new Map<string, SharedRequest<RequestImageAttachment>>();

  /**
   * Dựng kho đính kèm cho một ngữ cảnh plugin.
   * Nhận: `ctx` — ngữ cảnh cordis của plugin; `config` — cấu hình đã hợp nhất (mọi trường tuỳ chọn).
   * Trả: thể hiện mới đã chốt gốc lưu trữ, gốc cache, điều kiện nhận ảnh, chính sách chuẩn hoá và trần đồng thời.
   * @throws Error khi `imageCompressionConcurrency` không phải số nguyên trong khoảng 1..8, với câu
   *         "attachment-local: imageCompressionConcurrency must be an integer from 1 through 8".
   */
  constructor(ctx: Context, config: Config) {
    super(ctx);
    // R4 (08/11/2026, dev-1): tên biến CỦA TA không mang dấu vết DSH; `config.dshHome` là hợp đồng cấu hình stock nên giữ.
    const gbhHome = resolveDshHome(config.dshHome);
    this.root = join(gbhHome, "attachments", "v1");
    this.cacheRoot = dshCachePath({ dshHome: gbhHome }, "attachments");
    this.imageLimits = Object.freeze({
      maxImageBytes: config.maxImageBytes ?? 20971520,
      maxImagesPerMessage: config.maxImagesPerMessage ?? 20,
      maxMessageImageBytes: config.maxMessageImageBytes ?? 209715200,
      maxImagePixels: config.maxImagePixels ?? 64e6,
      maxImageDimension: config.maxImageDimension ?? 8192,
      mediaTypes: Object.freeze(["image/png", "image/jpeg", "image/webp", "image/gif"] as const),
    });
    this.normalizationPolicy = Object.freeze({
      maxPixels: config.normalizedImageMaxPixels ?? 4194304,
      maxDimension: config.normalizedImageMaxDimension ?? 8192,
      maxBytes: config.normalizedImageMaxBytes ?? 4194304,
    });
    // Bản gốc viết cứng 8 (bằng MAX_IMAGE_COMPRESSION_CONCURRENCY) trong cả câu lỗi lẫn phép so — giữ nguyên.
    const compressionConcurrency = config.imageCompressionConcurrency ?? 2;
    if (!Number.isSafeInteger(compressionConcurrency) || compressionConcurrency < 1 || compressionConcurrency > 8) throw new Error(`attachment-local: imageCompressionConcurrency must be an integer from 1 through 8`);
    this.imageCompressionConcurrency = compressionConcurrency;
    this.compression = new CompressionLimiter(compressionConcurrency);
  }

  /**
   * Kiểm một ảnh mà KHÔNG lưu gì.
   * Nhận: `input` — byte đã mã hoá, kiểu media khai báo và tên hiển thị tuỳ chọn.
   * Trả: promise xong sau khi raster đã giải mã đủ và bản chuẩn hoá của nó chứng minh vừa trần byte.
   */
  override async validateImage(input: SaveImageAttachment): Promise<void> {
    await this.compression.run(() => validateImageFile(input, this.imageLimits, this.normalizationPolicy));
  }

  /**
   * Kiểm rồi lưu bền vững MỘT lô ảnh theo đúng thứ tự đầu vào.
   * Nhận: `inputs` — ảnh đã mã hoá, theo thứ tự của lượt nhắc sở hữu.
   * Trả: promise danh sách tham chiếu đã lưu, CÙNG thứ tự; lô hỏng thì không ghi gì, lỗi lưu thì không trả
   *      tham chiếu dở dang (đối tượng đã công bố có thể còn nhưng chưa ai trỏ tới).
   */
  override async saveImages(inputs: readonly SaveImageAttachment[]): Promise<readonly ImageAttachmentRef[]> {
    this.validateImageBatch(inputs);
    const prepared = await Promise.all(inputs.map((input) => this.compression.run(() => prepareImageFile(input, this.imageLimits, this.normalizationPolicy))));
    const refs: ImageAttachmentRef[] = [];
    for (const image of prepared) refs.push(await commitPreparedImageFile(this.root, image));
    return refs;
  }

  /**
   * Kiểm, chuẩn hoá và lưu bền vững MỘT ảnh.
   * Nhận: `input` — byte đã mã hoá, kiểu media khai báo và tên hiển thị tuỳ chọn.
   * Trả: promise tham chiếu ảnh đã chuẩn hoá, địa chỉ hoá theo nội dung; khi bị thu nhỏ, tham chiếu ghi
   *      `originalDimensions` là kích thước nguồn sau khi áp hướng EXIF.
   */
  override async saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    const prepared = await this.compression.run(() => prepareImageFile(input, this.imageLimits, this.normalizationPolicy));
    return commitPreparedImageFile(this.root, prepared);
  }

  /**
   * Đọc một ảnh đã lưu và kiểm lại byte khớp tham chiếu.
   * Nhận: `ref` — tham chiếu bền vững ghi trong sổ phiên; `signal` — huỷ tuỳ chọn cho việc đọc và kiểm.
   * Trả: promise byte đã kiểm cùng tham chiếu; huỷ thì ném lý do của `signal`, hỏng thì ném lỗi kho.
   */
  override async readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment> {
    return readImageFile(this.root, ref, signal);
  }

  /**
   * Định vị đối tượng ảnh đã chuẩn hoá trên hệ tệp của host.
   * Nhận: `ref` — tham chiếu ảnh bền vững.
   * Trả: đường dẫn tuyệt đối trên host, tính ra mà KHÔNG đọc đối tượng; ném lỗi khi tham chiếu sai.
   */
  override imageHostPath(ref: ImageAttachmentRef): string {
    return normalizedImagePath(this.root, ref);
  }

  /**
   * Lưu NGUYÊN BYTE một tệp xuống gốc đính kèm có phiên bản.
   * Nhận: `input` — byte chính xác và tên hiển thị tuỳ chọn.
   * Trả: promise tham chiếu tệp bền vững, địa chỉ hoá theo nội dung.
   */
  override async saveFile(input: SaveFileAttachment): Promise<FileAttachmentRef> {
    return saveFileVerbatim(this.root, input);
  }

  /**
   * Lưu NGUYÊN BYTE một tệp từ các khúc có giới hạn, không gom cả tệp vào bộ nhớ.
   * Nhận: `input` — các khúc byte theo thứ tự, tín hiệu huỷ tuỳ chọn và tên hiển thị.
   * Trả: promise tham chiếu tệp bền vững, địa chỉ hoá theo nội dung.
   */
  override async saveFileStream(input: SaveFileStreamAttachment): Promise<FileAttachmentRef> {
    return saveFileStreamVerbatim(this.root, input);
  }

  /**
   * Đọc một tệp đã lưu thành các khúc có giới hạn và kiểm số byte lẫn digest.
   * Nhận: `ref` — tham chiếu tệp bền vững; `signal` — huỷ tuỳ chọn cho việc đọc hệ tệp.
   * Trả: luồng bất đồng bộ các khúc byte đúng thứ tự; lỗi toàn vẹn chỉ ném sau khúc cuối.
   */
  override readFileStream(ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array> {
    return readFileStreamVerbatim(this.root, ref, signal);
  }

  /**
   * Định vị tệp đã lưu trên hệ tệp của host.
   * Nhận: `ref` — tham chiếu tệp bền vững.
   * Trả: đường dẫn tuyệt đối trên host (digest là tên thư mục, tên hiển thị đã làm sạch là tên lá), tính ra
   *      mà KHÔNG đọc đối tượng; ném lỗi khi digest hoặc tên trong tham chiếu không hợp lệ.
   */
  override fileHostPath(ref: FileAttachmentRef): string {
    return storedFilePath(this.root, ref);
  }

  /**
   * Sinh hoặc dùng lại MỘT phiên bản ảnh cho yêu cầu model, theo tuyến đã chọn.
   * Nhận: `ref` — tham chiếu ảnh đã chuẩn hoá; `target` — kích thước và đích byte do tuyến chọn;
   *       `signal` — huỷ tuỳ chọn.
   * Trả: promise byte yêu cầu cùng danh tính biến thể tất định; các lượt trùng danh tính DÙNG CHUNG một
   *      phép biến đổi đang chạy thay vì biến đổi lại.
   */
  override async readImageRequest(ref: ImageAttachmentRef, target: ImageRequestTarget, signal?: AbortSignal): Promise<RequestImageAttachment> {
    return this.requestVersion(ref, target, undefined, signal);
  }

  /**
   * Lấy (hoặc khởi động) lượt biến đổi ảnh-yêu-cầu dùng chung cho một danh tính biến thể.
   * Nhận: `ref` — tham chiếu ảnh đã chuẩn hoá; `target` — kích thước và đích byte; `stored` — ảnh đã đọc
   *       sẵn (bỏ trống thì tự đọc qua {@link readImage}); `signal` — huỷ của người gọi.
   * Trả: promise byte yêu cầu cùng danh tính biến thể; lượt cũ đã bị huỷ được bỏ khỏi sổ trước khi dùng lại.
   */
  private requestVersion(ref: ImageAttachmentRef, target: ImageRequestTarget, stored: StoredImageAttachment | undefined, signal: AbortSignal | undefined): Promise<RequestImageAttachment> {
    signal?.throwIfAborted();
    const variantId = requestImageVariantId(ref, target);
    const key = String(variantId);
    let operation = this.requestInflight.get(key);
    if (operation?.controller.signal.aborted) {
      this.requestInflight.delete(key);
      operation = undefined;
    }
    if (operation === undefined) {
      const shared = new SharedRequest<RequestImageAttachment>((sharedSignal) =>
        this.compression.run(async () => {
          return await readRequestImageFile(this.cacheRoot, stored ?? (await this.readImage(ref, sharedSignal)), target, sharedSignal);
        }),
      );
      operation = shared;
      this.requestInflight.set(key, shared);
      shared.promise
        .finally(() => {
          if (this.requestInflight.get(key) === shared) this.requestInflight.delete(key);
        })
        .catch(() => {});
    }
    return operation.wait(signal);
  }
}

export default LocalAttachmentStore;
