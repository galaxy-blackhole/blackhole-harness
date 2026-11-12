/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kho tệp đính kèm cục bộ theo nội dung, riêng tư cho chủ sở hữu: đường dẫn đối tượng bất biến,
 *      kiểm tra/chuẩn hoá ảnh đầu vào, ghi bền kiểu stage → fsync → hard-link → chmod chỉ đọc, và
 *      đọc lại có xác minh digest — bản viết lại 1:1 vùng `lib/types/store.js` của
 *      @deepseek-ai/dsh-attachment-local.
 */

import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { chmod, link, mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { AttachmentError, AttachmentId } from "@deepseek-ai/dsh-attachment";
import type { ImageAttachmentLimits, ImageAttachmentRef, ImageMediaType, SaveImageAttachment, StoredImageAttachment } from "@deepseek-ai/dsh-attachment";
import { detectImage, probeImage } from "./image.ts";
import type { DetectedImage } from "./image.ts";
import { normalizeImage } from "./normalization.ts";
import type { NormalizationPolicy } from "./normalization.ts";

/**
 * Biểu thức nhận dạng id tệp đính kèm chuẩn hoá: tiền tố `sha256:` + ĐÚNG 64 chữ số hex.
 * Nhận: không có — hằng số dùng chung cho mọi lần đọc tham chiếu.
 * Trả: RegExp mà NHÓM 1 là digest hex khi khớp, hoặc null khi chuỗi không khớp.
 */
export const ID_PATTERN = /^sha256:([a-f0-9]{64})$/;

/**
 * Sổ ghi nhớ theo TIẾN TRÌNH: các gốc `DSH_HOME` mà chính tiến trình này đã tự chứng minh là bền
 * (đã fsync mọi mục tổ tiên bên dưới gốc hệ tệp).
 * Nhận: không có — trạng thái sống của mô-đun, không đọc từ đĩa.
 * Trả: Set các đường dẫn tuyệt đối đã được chứng minh bền; chỉ thêm vào, không bao giờ gỡ.
 */
export const durableHomes = /* @__PURE__ */ new Set<string>();

/**
 * Băm SHA-256 một khối bytes và trả digest dạng hex thường.
 * Nhận: `data` — bytes cần băm.
 * Trả: chuỗi 64 ký tự hex là digest SHA-256 của đúng các bytes đó.
 */
export function digest(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Làm sạch tên hiển thị do bên gọi khai: bỏ mọi thành phần đường dẫn (cả `/` lẫn `\\`), bỏ ký tự
 * điều khiển, cắt khoảng trắng thừa và giới hạn 255 ký tự.
 * Nhận: `value` — tên hiển thị do bên gọi khai, có thể là đường dẫn đầy đủ của máy khách.
 * Trả: tên lá đã làm sạch, hoặc `undefined` khi đầu vào không có tên hoặc sau khi làm sạch rỗng.
 */
export function displayName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const clean = value
    .slice(Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\")) + 1)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
  return clean === "" ? undefined : clean;
}

/**
 * Kiểm tra một tham chiếu ảnh chuẩn hoá và rút digest hex khỏi id.
 * Nhận: `ref` — tham chiếu bền ghi trong nhật ký phiên (chỉ dùng trường `attachmentId`).
 * Trả: digest SHA-256 hex (64 ký tự) khi id hợp lệ.
 *       Ném AttachmentError "Attachment reference is invalid." / "INVALID_ATTACHMENT_REF" khi id sai định dạng.
 */
export function ensureReference(ref: ImageAttachmentRef): string {
  const match = ID_PATTERN.exec(String(ref.attachmentId));
  if (match?.[1] === undefined) throw new AttachmentError("Attachment reference is invalid.", "INVALID_ATTACHMENT_REF");
  return match[1];
}

/**
 * Dựng đường dẫn tuyệt đối tới đối tượng bất biến của một ảnh đã chuẩn hoá.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `ref` — tham chiếu ảnh chuẩn hoá bền.
 * Trả: đường dẫn cục bộ của nhà cung cấp (`objects/<2 ký tự đầu>/<digest>`), KHÔNG đọc đối tượng.
 */
export function normalizedImagePath(root: string, ref: ImageAttachmentRef): string {
  const sha256 = ensureReference(ref);
  return join(root, "objects", sha256.slice(0, 2), sha256);
}

/**
 * Giải mã ĐẦY ĐỦ một ảnh và đối chiếu loại phương tiện đã khai với bytes.
 * Nhận: `data` — toàn bộ bytes ảnh đã mã hoá;
 *       `declaredMediaType` — loại phương tiện bên gọi khai;
 *       `limits` — chính sách kết nạp nguồn đã chốt (trần điểm ảnh và trần cạnh).
 * Trả: promise của {@link DetectedImage} đã giải mã và kiểm trần.
 *       Ném AttachmentError "Image is empty." / "INVALID_IMAGE" khi rỗng, hoặc
 *       "Declared image type does not match its bytes." / "IMAGE_TYPE_MISMATCH" khi loại khai sai.
 */
export async function inspectMetadata(data: Uint8Array, declaredMediaType: ImageMediaType, limits: ImageAttachmentLimits): Promise<DetectedImage> {
  if (data.byteLength === 0) throw new AttachmentError("Image is empty.", "INVALID_IMAGE");
  const detected = await detectImage(data, {
    maxPixels: limits.maxImagePixels,
    maxDimension: limits.maxImageDimension,
  });
  if (detected.mediaType !== declaredMediaType) throw new AttachmentError("Declared image type does not match its bytes.", "IMAGE_TYPE_MISMATCH");
  return detected;
}

/**
 * Chạy TOÀN BỘ chính sách kết nạp cho một ảnh mà KHÔNG chạm vào kho lưu, gồm cả chuẩn hoá: một lô mà
 * mọi thành viên đều qua được thì sau đó không thể bị từ chối bởi trần byte ảnh chuẩn hoá khi xuất bản.
 * Nhận: `input` — bytes đã mã hoá và metadata bên gọi khai;
 *       `limits` — chính sách kết nạp nguồn đã chốt;
 *       `policy` — chính sách chuẩn hoá đã chốt.
 * Trả: promise hoàn tất (void) sau khi raster đã được giải mã và bản chuẩn hoá đã được chứng minh vừa trần.
 */
export async function validateImageFile(input: SaveImageAttachment, limits: ImageAttachmentLimits, policy: NormalizationPolicy): Promise<void> {
  await prepareImageFile(input, limits, policy);
}

/** Đối tượng chuẩn hoá đã chuẩn bị TRỌN VẸN, được xác minh trước khi bất kỳ thành viên lô nào được ghi bền. */
export interface PreparedImageFile {
  /** Bytes chuẩn hoá tất định mà digest của chúng chính là {@link ref.attachmentId}. */
  data: Uint8Array;
  /** Tham chiếu bền mô tả đúng {@link data}. */
  ref: ImageAttachmentRef;
}

/**
 * Giải mã, chuẩn hoá và xác minh MỘT ảnh đã gửi mà KHÔNG chạm vào kho lưu.
 * Nhận: `input` — bytes ảnh đã gửi và loại phương tiện bên gọi khai;
 *       `limits` — chính sách kết nạp nguồn;
 *       `policy` — chính sách chuẩn hoá độc lập.
 * Trả: promise của {@link PreparedImageFile} — bytes sẵn sàng xuất bản nguyên tử kèm tham chiếu bất biến.
 *       Ném AttachmentError "Image exceeds the configured byte limit." / "IMAGE_TOO_LARGE" khi quá trần byte,
 *       cùng mọi lỗi kết nạp/chuẩn hoá của {@link inspectMetadata} và `normalizeImage`.
 */
export async function prepareImageFile(input: SaveImageAttachment, limits: ImageAttachmentLimits, policy: NormalizationPolicy): Promise<PreparedImageFile> {
  if (input.data.byteLength > limits.maxImageBytes) throw new AttachmentError("Image exceeds the configured byte limit.", "IMAGE_TOO_LARGE");
  const detected = await inspectMetadata(input.data, input.mediaType, limits);
  const normalized = await normalizeImage(input.data, detected, policy);
  const sha256 = digest(normalized.data);
  const name = displayName(input.name);
  const downscaled = detected.width !== normalized.width || detected.height !== normalized.height;
  return {
    data: normalized.data,
    ref: {
      attachmentId: AttachmentId(`sha256:${sha256}`),
      mediaType: normalized.mediaType,
      width: normalized.width,
      height: normalized.height,
      bytes: normalized.data.byteLength,
      ...(name !== undefined ? { name } : {}),
      ...(downscaled
        ? {
            originalDimensions: {
              width: detected.width,
              height: detected.height,
            },
          }
        : {}),
    },
  };
}

/**
 * Làm bền các mục của MỘT thư mục (fsync trên handle chỉ đọc). Chỉ sync file là không đủ khi mục thư mục
 * chưa từng tới được thiết bị lưu trữ, nên thư mục xuất bản phải được sync trước khi báo tham chiếu bền.
 * Nhận: `path` — đường dẫn thư mục cần fsync.
 * Trả: promise hoàn tất (void); trên Windows là no-op vì NTFS tự giữ bền mục thư mục bằng nhật ký metadata.
 */
export async function syncDirectory(path: string): Promise<void> {
  /* Windows không mở được handle thư mục; nhật ký NTFS đảm nhận tính bền của mục ở đó. */
  if (process.platform === "win32") return;
  const handle = await open(path, constants.O_RDONLY);
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Tạo MỘT cây thư mục riêng tư và làm bền từng mục tổ tiên tới ranh giới bền do bên gọi bảo chứng.
 * Cây được dạo một cách CHỦ Ý bỏ qua việc `mkdir` báo "mới tạo": một lần lưu đầu tiên chạy song song có
 * thể đã tạo một tầng mà tiến trình này chỉ quan sát thấy, nên "đã tồn tại" KHÔNG đồng nghĩa "đã bền" —
 * mục có thể chưa được sync ở phía người tạo, và một cú crash sẽ làm mất thư mục mà checkpoint phiên đã
 * tham chiếu. Sync lại một mục đã bền là vô hại; bỏ qua một mục chưa sync thì không.
 * Nhận: `path` — thư mục tuyệt đối cần tạo;
 *       `boundary` — tổ tiên tuyệt đối mà bên gọi bảo chứng là đã bền.
 * Trả: promise hoàn tất (void) khi thư mục tồn tại với mode 0o700 và mọi mục tổ tiên đã được fsync.
 */
export async function ensureDurableDirectory(path: string, boundary: string): Promise<void> {
  const target = resolve(path);
  const stop = resolve(boundary);
  await mkdir(target, {
    recursive: true,
    mode: 0o700, // 448 = 0o700, đúng giá trị của bản gốc.
  });
  await chmod(target, 0o700);
  let level = target;
  while (level !== stop) {
    const parent = dirname(level);
    await syncDirectory(parent);
    /* Chốt an toàn gốc hệ tệp: bên gọi luôn truyền boundary là tổ tiên của path nên vòng lặp gặp nó trước. */
    if (parent === level) return;
    level = parent;
  }
}

/**
 * Xác lập chứng minh của TIẾN TRÌNH NÀY rằng một mục `DSH_HOME` và mọi tổ tiên bên dưới gốc hệ tệp đều bền.
 * Chỉ tồn tại là chưa đủ: một tiến trình song song có thể đã tạo thư mục mà chưa sync mục cha của nó.
 * Nhận: `path` — gốc `DSH_HOME` cần chứng minh bền.
 * Trả: promise của đường dẫn tuyệt đối đã resolve; lần đầu sẽ dạo và fsync cả chuỗi tổ tiên, các lần sau
 *       dùng lại sổ {@link durableHomes} (không fsync lặp).
 */
export async function ensureDurableHome(path: string): Promise<string> {
  const home = resolve(path);
  if (!durableHomes.has(home)) {
    await ensureDurableDirectory(home, parse(home).root);
    durableHomes.add(home);
  }
  return home;
}

/**
 * Xuất bản MỘT ảnh chuẩn hoá đã được xác minh xuống dưới gốc tệp đính kèm có phiên bản.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `prepared` — bytes chuẩn hoá tất định và tham chiếu của chúng.
 * Trả: promise của tham chiếu ảnh chuẩn hoá bền, theo nội dung (content-addressed).
 *       Ném AttachmentError "Prepared attachment bytes do not match their reference." / "ATTACHMENT_CORRUPT"
 *       khi bytes đã chuẩn bị không khớp digest hoặc độ dài trong tham chiếu.
 */
export async function commitPreparedImageFile(root: string, prepared: PreparedImageFile): Promise<ImageAttachmentRef> {
  const normalized = prepared.data;
  const sha256 = ensureReference(prepared.ref);
  if (digest(normalized) !== sha256 || normalized.byteLength !== prepared.ref.bytes) throw new AttachmentError("Prepared attachment bytes do not match their reference.", "ATTACHMENT_CORRUPT");
  await publishImmutableObject(root, normalizedImagePath(root, prepared.ref), normalized, sha256);
  return prepared.ref;
}

/**
 * Xuất bản MỘT đối tượng bất biến theo nội dung dưới gốc tệp đính kèm có phiên bản: ghi tạm, fsync,
 * hard-link vào đích, khử trùng lặp EEXIST có xác minh digest, mode chỉ đọc, và làm bền mọi mục thư mục
 * từ cha của đích lên tới (KHÔNG gồm) `root`.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `target` — đường dẫn cuối tuyệt đối bên dưới `root`;
 *       `data` — đúng bytes của đối tượng mà digest là `sha256`;
 *       `sha256` — digest hex mà bytes đã lưu phải khớp khi khử trùng lặp.
 * Trả: promise hoàn tất (void) khi đối tượng đã nằm ở `target` với mode 0o400 và các mục thư mục đã bền.
 *       Ném AttachmentError "Attachment bytes do not match their publication digest." / "ATTACHMENT_CORRUPT"
 *       khi digest của bytes vừa ghi khác `sha256`.
 */
export async function publishImmutableObject(root: string, target: string, data: Uint8Array, sha256: string): Promise<void> {
  const staged = await stageImmutableObject(
    root,
    (function* (): Generator<Uint8Array> {
      yield data;
    })(),
  );
  if (staged.sha256 !== sha256) {
    await removeTemporary(staged.path);
    throw new AttachmentError("Attachment bytes do not match their publication digest.", "ATTACHMENT_CORRUPT");
  }
  await publishStagedObject(root, target, staged);
}

/** Digest và số byte thu được khi stream MỘT đối tượng bất biến xuống đĩa. */
export interface StreamedImmutableObject {
  /** Digest SHA-256 hex của đối tượng đã ghi bền. */
  readonly sha256: string;
  /** Số byte chính xác của đối tượng đã ghi bền. */
  readonly bytes: number;
}

/**
 * Stream MỘT đối tượng bất biến từ các khối có giới hạn vào tệp tạm, rồi xuất bản tại đích suy ra từ digest
 * mà KHÔNG gom toàn bộ đối tượng vào bộ nhớ.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `data` — đúng bytes của đối tượng, theo đúng thứ tự;
 *       `targetFor` — hàm suy ra đường dẫn đích tuyệt đối từ digest và số byte đã hoàn tất;
 *       `signal` — (tuỳ chọn) tín hiệu huỷ cho việc đọc nguồn và ghi kho.
 * Trả: promise của {@link StreamedImmutableObject} — digest và số byte chính xác của đối tượng đã xuất bản.
 *       Ném lại lỗi của `targetFor` sau khi dọn tệp tạm; các lỗi kho khác được bọc thành
 *       AttachmentError "Unable to persist attachment." / "ATTACHMENT_WRITE_FAILED".
 */
export async function publishImmutableObjectStream(root: string, data: AsyncIterable<Uint8Array>, targetFor: (sha256: string, bytes: number) => string, signal?: AbortSignal): Promise<StreamedImmutableObject> {
  const staged = await stageImmutableObject(root, data, signal);
  let target: string;
  try {
    target = targetFor(staged.sha256, staged.bytes);
  } catch (error) {
    await removeTemporary(staged.path);
    throw error;
  }
  await publishStagedObject(root, target, staged);
  return {
    sha256: staged.sha256,
    bytes: staged.bytes,
  };
}

/**
 * Xuất bản thêm MỘT tên hard-link bền cho đối tượng bất biến đã tồn tại.
 * Nhận: `root` — gốc tệp đính kèm có phiên bản (tuyệt đối);
 *       `source` — đối tượng theo nội dung đã tồn tại bên dưới `root`;
 *       `target` — bí danh mới bên dưới `root`;
 *       `sha256` — digest mong đợi, dùng khi đích đã tồn tại do một cuộc đua.
 * Trả: promise hoàn tất (void) khi bí danh tồn tại với mode 0o400 và các mục thư mục của nó đã bền.
 *       Ném AttachmentError "Stored attachment failed integrity verification." / "ATTACHMENT_CORRUPT"
 *       khi đích đã tồn tại nhưng digest khác, hoặc lỗi bọc "Unable to persist attachment." / "ATTACHMENT_WRITE_FAILED".
 */
export async function publishImmutableAlias(root: string, source: string, target: string, sha256: string): Promise<void> {
  const parent = dirname(target);
  try {
    await ensureDurableDirectory(parent, await ensureDurableHome(dirname(dirname(resolve(root)))));
    try {
      await link(source, target);
    } catch (error) {
      /* Thư mục riêng tư cùng hệ tệp khiến EEXIST là cuộc đua hard-link DUY NHẤT có thể cứu được. */
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if ((await digestFile(target)) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");
    }
    await chmod(target, 0o400); // 256 = 0o400, đúng giá trị của bản gốc.
    const stop = resolve(root);
    for (let level = parent; level !== stop; level = dirname(level)) {
      await syncDirectory(level);
      /* Chốt an toàn gốc hệ tệp: đích luôn nằm dưới root nên vòng lặp gặp `stop` trước. */
      if (dirname(level) === level) break;
    }
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError("Unable to persist attachment.", "ATTACHMENT_WRITE_FAILED", { cause: error });
  }
}

/** Tệp tạm đã ghi bền, kèm ranh giới bền và digest/số byte để xuất bản nguyên tử. */
interface StagedImmutableObject {
  /** Đường dẫn tuyệt đối của tệp tạm đã fsync. */
  readonly path: string;
  /** Ranh giới bền do {@link ensureDurableHome} xác lập cho gốc chứa tệp tạm. */
  readonly boundary: string;
  /** Digest SHA-256 hex của các bytes đã ghi. */
  readonly sha256: string;
  /** Số byte đã ghi. */
  readonly bytes: number;
}

/**
 * Ghi MỘT đối tượng bất biến vào tệp tạm dưới `root/tmp` theo từng khối, băm song song, fsync rồi đóng.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `data` — các khối bytes theo đúng thứ tự (iterable đồng bộ hoặc bất đồng bộ);
 *       `signal` — (tuỳ chọn) tín hiệu huỷ, được kiểm trước mỗi lần ghi, trước và sau fsync.
 * Trả: promise của {@link StagedImmutableObject} — tệp tạm đã bền, chưa được link vào đích cuối.
 *       Ném lại AttachmentError hoặc lý do huỷ khi đã huỷ; mọi lỗi khác được bọc thành
 *       AttachmentError "Unable to persist attachment." / "ATTACHMENT_WRITE_FAILED" sau khi dọn tệp tạm.
 */
export async function stageImmutableObject(root: string, data: AsyncIterable<Uint8Array> | Iterable<Uint8Array>, signal?: AbortSignal): Promise<StagedImmutableObject> {
  const staging = join(root, "tmp");
  const boundary = await ensureDurableHome(dirname(dirname(resolve(root))));
  await ensureDurableDirectory(staging, boundary);
  const temporary = join(staging, randomUUID());
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); // 384 = 0o600.
    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of data) {
      signal?.throwIfAborted();
      await handle.writeFile(chunk);
      hash.update(chunk);
      bytes += chunk.byteLength;
    }
    signal?.throwIfAborted();
    await handle.sync();
    signal?.throwIfAborted();
    await handle.close();
    handle = undefined;
    return {
      path: temporary,
      boundary,
      sha256: hash.digest("hex"),
      bytes,
    };
  } catch (error) {
    /* Descriptor chỉ còn mở khi write, sync hoặc close thất bại. */
    if (handle !== undefined) {
      await handle.close().catch(
        /* Lỗi close bị thay thế bởi chính thao tác kho đã dẫn tới nhánh dọn dẹp này. */
        () => {},
      );
    }
    await removeTemporary(temporary);
    if (error instanceof AttachmentError || signal?.aborted === true) throw error;
    throw new AttachmentError("Unable to persist attachment.", "ATTACHMENT_WRITE_FAILED", { cause: error });
  }
}

/**
 * Xuất bản tệp tạm ĐÃ ghi bền tại đường dẫn đích: hard-link vào đích, khử trùng lặp EEXIST có xác minh
 * digest, bỏ tên tạm, mode chỉ đọc, rồi làm bền các mục thư mục từ cha của đích lên tới (KHÔNG gồm) `root`.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `target` — đường dẫn đích tuyệt đối bên dưới `root`;
 *       `staged` — tệp tạm đã bền cùng ranh giới bền và digest của nó.
 * Trả: promise hoàn tất (void) khi tệp tạm đã được thay bằng một tên bền ở `target`.
 *       Ném AttachmentError "Stored attachment failed integrity verification." / "ATTACHMENT_CORRUPT"
 *       khi đích đã tồn tại nhưng digest khác, hoặc lỗi bọc "Unable to persist attachment." / "ATTACHMENT_WRITE_FAILED".
 */
export async function publishStagedObject(root: string, target: string, staged: StagedImmutableObject): Promise<void> {
  const parent = dirname(target);
  try {
    await ensureDurableDirectory(parent, staged.boundary);
    try {
      await link(staged.path, target);
    } catch (error) {
      /* Thư mục riêng tư cùng hệ tệp khiến EEXIST là cuộc đua hard-link DUY NHẤT có thể cứu được. */
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if ((await digestFile(target)) !== staged.sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");
    }
    await unlink(staged.path);
    await chmod(target, 0o400); // 256 = 0o400.
    const stop = resolve(root);
    for (let level = parent; level !== stop; level = dirname(level)) {
      await syncDirectory(level);
      /* Chốt an toàn gốc hệ tệp: đích luôn nằm dưới root nên vòng lặp gặp `stop` trước. */
      if (dirname(level) === level) break;
    }
  } catch (error) {
    await removeTemporary(staged.path);
    if (error instanceof AttachmentError) throw error;
    throw new AttachmentError("Unable to persist attachment.", "ATTACHMENT_WRITE_FAILED", { cause: error });
  }
}

/**
 * Băm SHA-256 một tệp trên đĩa theo từng khối đọc.
 * Nhận: `path` — đường dẫn tệp cần băm.
 * Trả: promise của digest hex; lỗi đọc tệp được ném nguyên trạng cho bên gọi.
 */
export async function digestFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/**
 * Xoá một tên tệp tạm, BỎ QUA đúng lỗi "không còn tồn tại".
 * Nhận: `path` — đường dẫn tệp tạm cần xoá.
 * Trả: promise hoàn tất (void) khi tên đã biến mất; lỗi dọn dẹp KHÁC ENOENT vẫn được ném ra.
 */
export async function removeTemporary(path: string): Promise<void> {
  await unlink(path).catch((cleanupError: unknown) => {
    /* Dọn dẹp có thể thấy tên tạm đã bị gỡ sau khi link thành công. */
    if (!(cleanupError instanceof Error && "code" in cleanupError && cleanupError.code === "ENOENT")) throw cleanupError;
  });
}

/**
 * Giải mã và chuẩn hoá MỘT ảnh đúng một lần, rồi xuất bản đối tượng đã chuẩn bị.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `input` — bytes ảnh đã gửi và loại phương tiện bên gọi khai;
 *       `limits` — chính sách kết nạp nguồn đã chốt;
 *       `policy` — chính sách chuẩn hoá đã chốt.
 * Trả: promise của tham chiếu ảnh chuẩn hoá bền, theo nội dung.
 */
export async function saveImageFile(root: string, input: SaveImageAttachment, limits: ImageAttachmentLimits, policy: NormalizationPolicy): Promise<ImageAttachmentRef> {
  return commitPreparedImageFile(root, await prepareImageFile(input, limits, policy));
}

/**
 * Đọc và xác minh MỘT ảnh theo nội dung.
 * Nhận: `root` — gốc `DSH_HOME/attachments/v1` (tuyệt đối);
 *       `ref` — tham chiếu đã ghi trong nhật ký phiên;
 *       `signal` — (tuỳ chọn) tín hiệu huỷ cho việc đọc tệp và xác minh.
 * Trả: promise của bytes đã xác minh kèm tham chiếu ({@link StoredImageAttachment}).
 *       Ném lý do huỷ khi bị huỷ, hoặc AttachmentError "Attachment object is missing." / "ATTACHMENT_NOT_FOUND",
 *       "Unable to read image attachment." / "ATTACHMENT_READ_FAILED",
 *       "Stored attachment failed integrity verification." / "ATTACHMENT_CORRUPT" khi xác minh hỏng.
 */
export async function readImageFile(root: string, ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment> {
  signal?.throwIfAborted();
  const sha256 = ensureReference(ref);
  let data: Uint8Array;
  try {
    data = new Uint8Array(await readFile(normalizedImagePath(root, ref), { signal }));
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new AttachmentError("Attachment object is missing.", "ATTACHMENT_NOT_FOUND");
    throw new AttachmentError("Unable to read image attachment.", "ATTACHMENT_READ_FAILED", { cause: error });
  }
  signal?.throwIfAborted();
  if (digest(data) !== sha256) throw new AttachmentError("Stored attachment failed integrity verification.", "ATTACHMENT_CORRUPT");
  const metadata = await probeImage(data);
  signal?.throwIfAborted();
  if (metadata.mediaType !== ref.mediaType || data.byteLength !== ref.bytes || metadata.width !== ref.width || metadata.height !== ref.height) throw new AttachmentError("Stored attachment metadata does not match its reference.", "ATTACHMENT_CORRUPT");
  return {
    ref,
    data,
  };
}
