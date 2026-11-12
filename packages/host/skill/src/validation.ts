/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàng rào KIỂM DỮ LIỆU của seam kỹ năng: chuẩn hoá quan sát của nhà cung cấp, kiểm ứng
 *      viên/định nghĩa/đóng góp runtime, và các tiện ích huỷ-có-trần (waitWithAbort · throwIfAborted ·
 *      toError) — mọi thông điệp lỗi giữ NGUYÊN VĂN bản gốc để bên gọi không phải đoán
 */

import { isSkillName } from "./render.ts";
import type {
  SkillCandidate,
  SkillDefinition,
  SkillInvocationPolicy,
  SkillProviderObservation,
  SkillRegistration,
} from "./types.ts";

/**
 * Chuẩn hoá đầu ra của `provider.list()` về ĐÚNG một hình dạng quan sát.
 * Nhận: đầu ra thô của nhà cung cấp (mảng đầy đủ là lối viết tắt, hoặc quan sát tường minh) và tên nhà cung cấp.
 * Trả: quan sát có `candidates` + `complete`; ném `TypeError` khi hình dạng sai (không bao giờ đoán hộ).
 */
export function normalizeProviderObservation(output: unknown, providerName: string): SkillProviderObservation {
  if (Array.isArray(output)) return { candidates: output as readonly SkillCandidate[], complete: true };
  if (output === null || typeof output !== "object") throw invalidProviderObservation(providerName);
  const observation = output as Partial<SkillProviderObservation>;
  if (!Array.isArray(observation.candidates) || typeof observation.complete !== "boolean") {
    throw invalidProviderObservation(providerName);
  }
  // Trả CHÍNH vật thể nhà cung cấp đưa vào (không dựng bản sao): giữ nguyên danh tính như bản gốc.
  return output as SkillProviderObservation;
}

/**
 * Dựng lỗi chuẩn cho đầu ra sai hình dạng của một nhà cung cấp.
 * Nhận: tên nhà cung cấp.
 * Trả: `TypeError` với thông điệp y bản gốc.
 */
function invalidProviderObservation(providerName: string): TypeError {
  return new TypeError(
    `skill provider "${providerName}" list() must return an array or { candidates, complete } observation`,
  );
}

/**
 * Kiểm một ứng viên do nhà cung cấp trả về TRƯỚC khi nó vào catalog.
 * Nhận: ứng viên (có thể hỏng) và tên nhà cung cấp để dựng thông điệp.
 * Trả: không; ném `TypeError`/`Error` với thông điệp y bản gốc khi một trường sai.
 */
export function validateCandidate(candidate: SkillCandidate, providerName: string): void {
  if (typeof candidate.name !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned a non-string skill name`);
  }
  if (!isSkillName(candidate.name)) {
    throw new Error(`skill provider "${providerName}" returned invalid skill name "${candidate.name}"`);
  }
  if (typeof candidate.description !== "string") {
    throw new TypeError(
      `skill provider "${providerName}" returned skill "${candidate.name}" with a non-string description`,
    );
  }
  if (candidate.description.length === 0) {
    throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" without a description`);
  }
  validateInvocation(candidate.invocation, `skill provider "${providerName}" returned skill "${candidate.name}"`);
  if (candidate.whenToUse !== undefined && typeof candidate.whenToUse !== "string") {
    throw new TypeError(
      `skill provider "${providerName}" returned skill "${candidate.name}" with a non-string whenToUse`,
    );
  }
  if (typeof candidate.source !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string source`);
  }
  if (typeof candidate.rank !== "number" || !Number.isFinite(candidate.rank)) {
    throw new Error(`skill provider "${providerName}" returned skill "${candidate.name}" with an invalid rank`);
  }
  if (typeof candidate.provider !== "string") {
    throw new TypeError(
      `skill provider "${providerName}" returned skill "${candidate.name}" with a non-string provider`,
    );
  }
  if (candidate.provider !== providerName) {
    throw new Error(
      `skill provider "${providerName}" returned skill "${candidate.name}" for provider "${candidate.provider}"`,
    );
  }
  if (candidate.path !== undefined && typeof candidate.path !== "string") {
    throw new TypeError(`skill provider "${providerName}" returned skill "${candidate.name}" with a non-string path`);
  }
}

/**
 * Kiểm một đóng góp RUNTIME trước khi nó vào lớp của phạm vi đang gọi.
 * Nhận: đóng góp do plugin gọi `register()` đưa vào.
 * Trả: không; ném `Error` với thông điệp y bản gốc khi tên/mô tả/công tắc gọi sai.
 */
export function validateRuntimeSkill(skill: SkillRegistration): void {
  if (!isSkillName(skill.name)) throw new Error(`invalid skill name "${skill.name}"`);
  if (skill.description.length === 0) throw new Error(`skill "${skill.name}" requires a description`);
  validateInvocation(skill.invocation, `runtime skill "${skill.name}"`);
}

/**
 * Kiểm một định nghĩa ĐÃ NẠP từ bộ phân tích do nhà cung cấp kiểm soát hoặc từ nguồn xa.
 * Nhận: định nghĩa đầy đủ (kể cả thân) mà `provider.get()` trả về.
 * Trả: không; ném `TypeError`/`Error` với thông điệp y bản gốc khi một trường sai.
 */
export function validateDefinition(skill: SkillDefinition): void {
  const { name, description, whenToUse, invocation, source, provider, content, path } = skill;
  if (typeof name !== "string") throw new TypeError("loaded skill name must be a string");
  if (!isSkillName(name)) throw new Error(`loaded skill has invalid name "${name}"`);
  if (typeof description !== "string") throw new TypeError(`loaded skill "${name}" description must be a string`);
  if (description.length === 0) throw new Error(`loaded skill "${name}" requires a description`);
  validateInvocation(invocation, `loaded skill "${name}"`);
  if (whenToUse !== undefined && typeof whenToUse !== "string") {
    throw new TypeError(`loaded skill "${name}" whenToUse must be a string`);
  }
  if (typeof source !== "string") throw new TypeError(`loaded skill "${name}" source must be a string`);
  if (typeof provider !== "string") throw new TypeError(`loaded skill "${name}" provider must be a string`);
  if (typeof content !== "string") throw new TypeError(`loaded skill "${name}" content must be a string`);
  if (path !== undefined && typeof path !== "string") throw new TypeError(`loaded skill "${name}" path must be a string`);
}

/**
 * Kiểm hình dạng công tắc gọi; BỎ QUA khi vắng (vắng là hợp lệ — mặc định do nơi đăng ký cấp).
 * Nhận: công tắc gọi (có thể vắng) và chủ thể để dựng thông điệp.
 * Trả: không; ném `TypeError` với thông điệp y bản gốc khi không phải vật thể hai cờ boolean.
 */
function validateInvocation(invocation: SkillInvocationPolicy | undefined, subject: string): void {
  if (invocation === undefined) return;
  const policy: unknown = invocation;
  if (typeof policy !== "object" || policy === null || Array.isArray(policy)) {
    throw new TypeError(`${subject} with a non-object invocation policy`);
  }
  const { modelInvocable, userInvocable } = policy as SkillInvocationPolicy;
  if (typeof modelInvocable !== "boolean") throw new TypeError(`${subject} with a non-boolean invocation.modelInvocable`);
  if (typeof userInvocable !== "boolean") throw new TypeError(`${subject} with a non-boolean invocation.userInvocable`);
}

/**
 * Chốt cấu hình số phải là số nguyên dương (kể cả trần bộ nhớ cache).
 * Nhận: tên trường, giá trị, và ngưỡng nhỏ nhất (mặc định 1).
 * Trả: không; ném `Error` với thông điệp y bản gốc khi giá trị không đạt.
 */
export function assertPositiveInteger(name: string, value: number, minimum = 1): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`skill: ${name} must be an integer greater than or equal to ${minimum}`);
  }
}

/**
 * Đua một lời hứa của nhà cung cấp với tín hiệu huỷ của bên gọi, để nhà cung cấp không hợp tác
 * cũng KHÔNG treo được người gọi.
 * Nhận: lời hứa cần chờ và tín hiệu huỷ (có thể vắng — khi vắng trả nguyên lời hứa).
 * Trả: lời hứa đã gắn huỷ; huỷ trước hoặc trong lúc chờ đều làm nó từ chối.
 */
export function waitWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    /** Gỡ người nghe huỷ — gọi ở CẢ BA nhánh để không rò người nghe. */
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
    };
    /** Nhánh huỷ: gỡ người nghe rồi từ chối bằng lý do đã chuẩn hoá thành `Error`. */
    const onAbort = (): void => {
      cleanup();
      reject(toError(signal.reason));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(toError(error));
      },
    );
  });
}

/**
 * Ném ngay khi tín hiệu đã bị huỷ — dùng ở mọi ranh giới của lượt dò.
 * Nhận: tín hiệu huỷ (có thể vắng).
 * Trả: không; ném `Error` chuẩn hoá từ `signal.reason` khi đã huỷ.
 */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw toError(signal.reason);
}

/**
 * Chuẩn hoá một giá trị bất kỳ bị ném/từ chối thành `Error`, KHÔNG tin vào phép ép kiểu.
 * Nhận: giá trị bất kỳ (kể cả Proxy đã bị thu hồi làm phép kiểm lớp ném).
 * Trả: chính `Error` đó khi đã là `Error`, ngược lại bọc thông điệp đã hiện được.
 */
export function toError(error: unknown): Error {
  try {
    if (error instanceof Error) return error;
  } catch {
    // Phép kiểm lớp có thể ném với Proxy đã thu hồi — rơi xuống nhánh bọc thông điệp.
  }
  return new Error(errorMessage(error));
}

/**
 * Hiện một hỏng hóc bất kỳ của nhà cung cấp thành chuỗi, KHÔNG để phép ép chuỗi thoát ra ngoài.
 * Nhận: giá trị bất kỳ bị ném.
 * Trả: `String(error)`, hoặc nhãn cố định khi chính phép ép chuỗi cũng ném.
 */
export function errorMessage(error: unknown): string {
  try {
    return String(error);
  } catch {
    return "[unrenderable thrown value]";
  }
}