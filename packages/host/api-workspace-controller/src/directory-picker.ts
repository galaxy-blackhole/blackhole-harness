/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Chủ sở hữu Remote của việc chọn thư mục phía Host — bản viết lại 1:1 vùng `lib/types/directory-picker.js`
 *      (dòng 365–570; BỎ 38 dòng helper decorator 370–407 vì decorator TS biên dịch native) của
 *      `@deepseek-ai/dsh-api-workspace-controller/lib/index.js`: gác năng lực, huỷ theo vòng đời caller, và từ
 *      vựng lỗi wire ổn định trên seam `ctx.directoryPicker`.
 */

import { DirectoryPickerError } from "@deepseek-ai/dsh-host-directory-picker";
import { Remote, RemoteError, TypertRemoteService } from "@galaxy-blackhole/gbh-typert-protocol";
import { z } from "zod";

import type { Context } from "@deepseek-ai/cordis";
import type {
  DirectoryPickerBrowseCapability,
  DirectoryPickerCapability,
  DirectoryPickerNativeCapability,
} from "@deepseek-ai/dsh-host-directory-picker";
import type { DirectoryListing } from "@deepseek-ai/dsh-host-directory-picker/types";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Chủ sở hữu namespace Remote 'directoryPicker' phía Host. */
    directoryPickerController: DirectoryPickerController;
  }
}

/**
 * Schema kiểm payload `host.createDirectory`: MỘT đoạn đường dẫn, không rỗng, không phải `.`/`..`.
 * Nhận: cặp `{ path, name }` do lời gọi Remote gửi lên.
 * Trả: payload đã kiểm; `safeParse` từ chối tên rỗng, tên `.`/`..`, và tên có dấu phân cách đường dẫn.
 */
// Vì sao có cast: trong chương trình tsc TOÀN REPO, "zod" được vài gói khác khai báo lại (augmentation
// hẹp) nên kiểu của z.object(...) bị thu về ZodType<any> và mất .refine — dù runtime zod 4.4.3 CÓ refine.
// Cast giữ NGUYÊN hành vi validate (đã A/B 20/20 ca với stock) và chỉ siết lại kiểu cho call site.
interface CreateDirectoryRequestShape {
  /** Đường dẫn thư mục cha. */
  readonly path: string;
  /** Một đoạn tên mới, không rỗng, không phải "."/"..", không chứa dấu phân cách. */
  readonly name: string;
}
/** Mặt schema mà call site dùng — khai tại chỗ để KHÔNG phụ thuộc namespace type của "zod" (bị gói khác thu hẹp trong chương trình tsc toàn repo). */
interface CreateDirectorySchema {
  /** Kiểm payload; lỗi trả error.issues y zod. */
  safeParse(input: { path: string; name: string }):
    | { readonly success: true; readonly data: CreateDirectoryRequestShape }
    | { readonly success: false; readonly error: { readonly issues: readonly object[] } };
}
export const createDirectoryRequestSchema: CreateDirectorySchema = (z.object({
  path: z.string(),
  name: z.string(),
}) as unknown as {
  refine: (
    check: (request: CreateDirectoryRequestShape) => boolean,
    options: { message: string },
  ) => unknown;
}).refine(
  (request) =>
    request.name.trim() !== "" &&
    request.name !== "." &&
    request.name !== ".." &&
    !/[/\\]/.test(request.name),
  { message: "host.createDirectory requires a single non-blank path segment name" },
) as CreateDirectorySchema;

/**
 * Service Host đứng sau namespace `ctx.remote.directoryPicker` sinh tự động. Seam nó phơi ra là trừu tượng nên
 * không bao giờ là entry Loader của riêng nó, vì vậy controller này mang các verb wire: một backend đã hợp thành
 * phục vụ hoặc bộ chọn native hoặc các primitive browse, và verb mà composition không phục vụ được thì bị TỪ
 * CHỐI thay vì làm gần đúng.
 * Nhận: context Host mang backend chọn thư mục đã hợp thành.
 * Trả: không — lớp đăng ký service `directoryPickerController` gắn namespace wire `directoryPicker`.
 */
export class DirectoryPickerController extends TypertRemoteService {
  /** Seam bắt buộc: seam chọn thư mục đã hợp thành (`native` hoặc `browse`). */
  static inject = ["directoryPicker"];

  /**
   * Đăng ký service dưới khoá 'directoryPickerController' và gắn namespace wire 'directoryPicker'.
   * Nhận: context Host mang backend chọn thư mục đã hợp thành.
   * Trả: không.
   */
  constructor(ctx: Context) {
    super(ctx, "directoryPickerController", { namespace: "directoryPicker" });
  }

  /**
   * Mở bộ chọn thư mục của HĐH cho một caller Remote.
   * Nhận: vòng đời của caller; huỷ sẽ kết thúc bộ chọn.
   * Trả: đường dẫn tuyệt đối được chọn, hoặc null khi người vận hành huỷ.
   */
  @Remote("pick")
  async pick(signal: AbortSignal): Promise<string | null> {
    const capability = this.requireCapability("native", "pick");
    try {
      return await capability.pick(signal);
    } catch (error) {
      throw cancellableFailure(
        error,
        signal,
        "directory picker was aborted",
        "directory picker failed",
      );
    }
  }

  /**
   * Liệt kê MỘT cấp thư mục cho trình duyệt trong app của caller Remote.
   * Nhận: thư mục tuyệt đối cần liệt kê (vắng mặt là thư mục home); vòng đời caller — huỷ sẽ dừng phép quét của
   * backend thay vì để nó sống lâu hơn một caller đã ngắt kết nối.
   * Trả: bản liệt kê của cấp đó kèm chuỗi tổ tiên.
   */
  @Remote("list")
  async list(path: string | undefined, signal: AbortSignal): Promise<DirectoryListing> {
    const capability = this.requireCapability("browse", "list");
    try {
      return await capability.list(path, signal);
    } catch (error) {
      throw cancellableFailure(error, signal, "directory listing was aborted");
    }
  }

  /**
   * Tạo MỘT thư mục con cho trình duyệt trong app của caller Remote.
   * Nhận: thư mục cha tuyệt đối đã tồn tại, và tên MỘT đoạn đường dẫn không rỗng.
   * Trả: đường dẫn tuyệt đối của thư mục vừa tạo.
   */
  @Remote("createDirectory")
  async createDirectory(path: string, name: string): Promise<string> {
    const request = createDirectoryRequestSchema.safeParse({ path, name });
    if (!request.success) {
      throw new RemoteError("gateway/bad-request", "invalid payload for host.createDirectory", {
        issues: request.error.issues,
      });
    }
    const capability = this.requireCapability("browse", "createDirectory");
    try {
      return await capability.createDirectory(request.data.path, request.data.name);
    } catch (error) {
      throw browseFailure(error);
    }
  }

  /** Lấy năng lực `native` cho verb `pick`, hoặc từ chối với kind mà backend này phục vụ. */
  private requireCapability(kind: "native", method: string): DirectoryPickerNativeCapability;

  /** Lấy năng lực `browse` cho một verb browse, hoặc từ chối với kind mà backend này phục vụ. */
  private requireCapability(kind: "browse", method: string): DirectoryPickerBrowseCapability;

  /**
   * Phân giải năng lực mà MỘT verb wire cần, hoặc từ chối kèm kind mà backend này phục vụ.
   * Nhận: kind năng lực verb cần, và tên verb để dựng thông điệp.
   * Trả: năng lực đã hẹp đúng kind.
   */
  private requireCapability(
    kind: DirectoryPickerCapability["kind"],
    method: string,
  ): DirectoryPickerCapability {
    const capability = this.ctx.directoryPicker.capability();
    if (capability.kind !== kind) {
      throw new RemoteError(
        "directory-picker/unavailable",
        `directoryPicker.${method} needs the ${kind} capability; the composed picker serves "${capability.kind}"`,
        { capability: capability.kind },
      );
    }
    return capability;
  }
}

/**
 * Mã wire trả cho mỗi lỗi browse của seam. Bộ mã đóng của seam là từ vựng cục bộ của chính nó, nên controller này
 * sở hữu phép chiếu lên các mã `directory-picker/*` mà caller Remote phân biệt được.
 */
export const BROWSE_FAILURE_CODES = {
  "directory-unreadable": "directory-picker/unreadable",
  "directory-exists": "directory-picker/exists",
  "directory-create-failed": "directory-picker/create-failed",
} as const;

/**
 * Phân loại một lần từ chối của primitive browse: bộ mã đóng của seam mang sẵn đường dẫn mà nó nói về, còn mọi
 * thứ khác giữ nguyên là lỗi hạ tầng.
 * Nhận: lần từ chối của primitive.
 * Trả: lỗi cần ném qua biên Remote.
 */
export function browseFailure(error: unknown): RemoteError {
  if (error instanceof Error && (error as { name?: string }).name === "DirectoryPickerError") {
    // Hai trường riêng của lớp lỗi seam (không nằm trên `Error`) ⇒ đọc qua đúng hình dạng của nó.
    const rejected = error as Error & { readonly code: keyof typeof BROWSE_FAILURE_CODES; readonly path: string };
    return new RemoteError(
      BROWSE_FAILURE_CODES[rejected.code],
      rejected.message,
      { path: rejected.path },
      { cause: rejected },
    );
  }
  return new RemoteError("gateway/internal", directoryPickerErrorMessage(error), {}, {
    cause: error,
  });
}

/**
 * Phân loại lần từ chối của một primitive có thể huỷ. Một lần huỷ là timeout hay ngắt kết nối của chính caller,
 * không phải lỗi backend, nên nó trả `gateway/cancelled` TRƯỚC khi phép phân loại nghiệp vụ chạy.
 * Nhận: lần từ chối của primitive; vòng đời caller mà primitive chạy dưới; chữ cho người vận hành khi bị huỷ; và
 * tiền tố cho lỗi không thuộc seam, khi verb không có bộ mã đóng.
 * Trả: lỗi cần ném qua biên Remote.
 */
export function cancellableFailure(
  error: unknown,
  signal: AbortSignal,
  cancelled: string,
  failed?: string,
): RemoteError {
  if (signal.aborted) return new RemoteError("gateway/cancelled", cancelled, {}, { cause: error });
  if (failed === undefined) return browseFailure(error);
  return new RemoteError(
    "gateway/internal",
    `${failed}: ${directoryPickerErrorMessage(error)}`,
    {},
    { cause: error },
  );
}

/**
 * Đổi một giá trị bị ném thành chuỗi người đọc được.
 * Nhận: giá trị bất kỳ bắt được trong `catch`.
 * Trả: `message` khi là `Error`, ngược lại `String(value)`.
 */
export function directoryPickerErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
