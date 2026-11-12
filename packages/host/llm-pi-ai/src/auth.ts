/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng auth của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 2024–2204 (nguồn
 *      per-file: lib/types/auth.js): ba adapter giữa mô hình auth của pi-ai và mặt phẳng credential
 *      của harness (record store + auth context ambient). Mọi khái niệm riêng pi-ai ở lại phía này;
 *      seam harness mà vùng này dùng chỉ nói về record credential và luồng authorization.
 */

import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import {
  credentialKey,
  credentialKeyId,
  credentialKeyScope,
  credentialRef,
  isCredentialKeySegment,
  isCredentialRefName,
} from "@deepseek-ai/dsh-credentials";
import type {
  CredentialKey,
  CredentialRecord,
  CredentialRecordEntry,
  CredentialRef,
} from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { LlmError } from "@deepseek-ai/dsh-llm";
import type { AuthContext, Credential, CredentialStore } from "@earendil-works/pi-ai";

/**
 * The three adapters between pi-ai's auth model and the harness credential
 * plane. Every pi-ai-specific concept stays on this side of them: the harness
 * seams they consume — `ctx.credentials` records and `ctx.authorization` flows —
 * name nothing from this library, so another adapter family can arrive with a
 * different auth model and share the same two seams.
 *
 * @module dsh-llm-pi-ai/auth
 */

/**
 * Phần HẸP của seam credential (`ctx.credentials`) mà vùng auth thật sự dùng — khai báo tại chỗ theo
 * hình dạng cấu trúc, không mượn tên lớp `CredentialProvider` của kernel (ADR 000d: một chương trình
 * có thể có hai bộ khai báo cùng tên, nên seam kiểu phải theo cấu trúc chứ không theo tên lớp).
 */
interface CredentialPlane {
  /** Giải một tham chiếu về giá trị hiện tại; vắng khi chưa cấu hình. */
  resolve(ref: CredentialRef): Promise<{ readonly value: string } | undefined>;
  /** Đọc một record đã lưu. */
  readRecord(key: CredentialKey): Promise<CredentialRecord | undefined>;
  /** Liệt kê địa chỉ + nhãn của mọi record đã lưu (không kèm giá trị). */
  listRecords(): Promise<readonly CredentialRecordEntry[]>;
  /** Read-modify-write tuần tự trên một record — đường ghi DUY NHẤT. */
  modifyRecord(
    key: CredentialKey,
    mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined>;
  /** Xoá một record; xoá record vắng là no-op. */
  deleteRecord(key: CredentialKey): Promise<void>;
}

/**
 * Đọc service credential đang mount, nếu có — đọc LẠI mỗi lượt để thay đổi compose/khởi tạo tới được
 * lượt kế tiếp, đúng như `ctx.get("credentials")` của bản gốc.
 * Nhận: ctx — plugin context của lời gọi.
 * Trả: seam credential theo hình dạng cấu trúc, hoặc undefined khi composition không mount service này.
 */
function credentialPlaneOf(ctx: Context): CredentialPlane | undefined {
  return ctx.get("credentials") as CredentialPlane | undefined;
}

/**
 * The record scope every credential this adapter family stores is written
 * under. It is the plugin's registered name, which is what tells a later
 * reader — a configuration UI, or a second adapter family serving the same
 * provider name — that this plugin owns the format inside the record.
 * Nhận: không — hằng số scope của gói.
 * Trả: chuỗi "llm-pi-ai" dùng làm segment scope cho mọi credential key.
 */
export const RECORD_SCOPE = "llm-pi-ai";

/**
 * The record address for one pi-ai provider id.
 * Nhận: providerId — provider id riêng của pi-ai, cũng là khoá route của harness.
 * Trả: credential key đã gắn scope mà họ adapter này đọc và ghi.
 * @throws {TypeError} khi providerId không phải định danh chữ thường có gạch nối.
 */
export function recordKeyFor(providerId: string): CredentialKey {
  return credentialKey(RECORD_SCOPE, providerId);
}

/**
 * The JSON image of one grant payload: plain objects lose their
 * explicitly-undefined members and array entries JSON cannot hold become
 * null, exactly as `JSON.stringify` would render them. pi-ai credentials
 * idiomatically carry optional members as explicit `undefined` (a github.com
 * Copilot grant holds `enterpriseUrl: undefined`), which the credential
 * store's strict validator refuses as unrepresentable. Everything else —
 * non-finite numbers and foreign prototypes included — passes through
 * untouched, so a genuinely unstorable value still fails loud at the store.
 * Nhận: value — giá trị cần dựng ảnh JSON.
 * Trả: ảnh JSON của value (object thuần, mảng, hoặc giá trị nguyên bản).
 */
function jsonImage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => entry === void 0 ? null : jsonImage(entry));
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const image: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value)) if (member !== void 0) image[key] = jsonImage(member);
    return image;
  }
  return value;
}

/**
 * Translate a stored record into the credential pi-ai expects.
 *
 * An `api-key` record is structural on both sides, so it is rebuilt field by
 * field. A `grant` payload is pi-ai's own OAuth credential, stored verbatim:
 * the seam treats it as opaque JSON precisely so a library that owns a token
 * format keeps owning it, refresh fields and all.
 * Nhận: record — record đã lưu, hoặc undefined khi chưa lưu gì.
 * Trả: credential pi-ai, hoặc undefined khi record vắng.
 */
function toPiCredential(record: CredentialRecord | undefined): Credential | undefined {
  if (record === void 0) return void 0;
  if (record.kind === "api-key") return {
    type: "api_key",
    ...record.key === void 0 ? {} : { key: record.key },
    ...record.env === void 0 ? {} : { env: { ...record.env } },
  };
  return record.payload as Credential;
}

/**
 * Translate a pi-ai credential into the record to store.
 * Nhận: credential — thứ mà một lượt login hoặc refresh sinh ra.
 * Trả: record cần commit, trong union mà seam credential lưu.
 */
function toRecord(credential: Credential): CredentialRecord {
  if (credential.type === "api_key") return {
    kind: "api-key",
    ...credential.key === void 0 ? {} : { key: credential.key },
    ...credential.env === void 0 ? {} : { env: { ...credential.env } },
  };
  return {
    kind: "grant",
    payload: jsonImage(credential),
  };
}

/**
 * The credential service, or the failure that names what is missing. Reads
 * answer "nothing stored" without a service, because a composition with no
 * credential plane genuinely holds no credential; writes refuse, because a
 * login whose grant silently evaporated would report success and then fail
 * every request.
 * Nhận: ctx — plugin context.
 * Trả: service credential đang sống.
 * @throws {LlmError} mã "NO_CREDENTIAL_STORE" khi không mount service nào.
 */
function writableStore(ctx: Context): CredentialPlane {
  const credentials = credentialPlaneOf(ctx);
  if (credentials === void 0) throw new LlmError("llm-pi-ai: this composition mounts no credentials service, so there is nowhere to store the credential a sign-in produces; mount one (dsh-credentials-local) to sign in", "NO_CREDENTIAL_STORE");
  return credentials;
}

/**
 * A pi-ai `CredentialStore` over the harness credential records.
 *
 * pi-ai runs OAuth refresh *inside* `modify()`, so this store's exclusion has
 * to cover a network round trip rather than a file rename — which is why the
 * record write path takes a wait limit of its own rather than the short one a
 * local write would need.
 *
 * pi-ai asks this store about every provider in the collection, hand-declared
 * routes included, and a route key is an arbitrary settings dict key while a
 * record id is not. An id outside the record grammar can never have stored a
 * record, so reads answer "nothing stored" and a delete has nothing to remove;
 * only `modify` refuses it, because a write that cannot land must not report
 * that it did.
 * Nhận: ctx — plugin context mang `ctx.credentials` tuỳ chọn.
 * Trả: store để đưa cho `createModels()`.
 * @throws {LlmError} mã "UNSTORABLE_PROVIDER_ID" khi `modify` nhận provider id ngoài grammar record;
 *   "NO_CREDENTIAL_STORE" khi ghi mà composition không mount credential service.
 */
export function credentialStoreFrom(ctx: Context): CredentialStore {
  return {
    async read(providerId) {
      const credentials = credentialPlaneOf(ctx);
      if (credentials === void 0) return void 0;
      if (!isCredentialKeySegment(providerId)) return void 0;
      return toPiCredential(await credentials.readRecord(recordKeyFor(providerId)));
    },
    async list() {
      const stored = await credentialPlaneOf(ctx)?.listRecords() ?? [];
      const mine: { providerId: string; type: "api_key" | "oauth" }[] = [];
      for (const entry of stored) {
        if (credentialKeyScope(entry.key) !== "llm-pi-ai") continue;
        mine.push({
          providerId: credentialKeyId(entry.key),
          type: entry.kind === "api-key" ? "api_key" : "oauth",
        });
      }
      return mine;
    },
    async modify(providerId, mutate) {
      if (!isCredentialKeySegment(providerId)) throw new LlmError(`llm-pi-ai: provider id "${providerId}" cannot address a stored credential record (a record id is a lowercase hyphenated identifier); authenticate this route through apiKeyEnv instead of a stored credential`, "UNSTORABLE_PROVIDER_ID");
      return toPiCredential(await writableStore(ctx).modifyRecord(recordKeyFor(providerId), async (current) => {
        const next = await mutate(toPiCredential(current));
        return next === void 0 ? void 0 : toRecord(next);
      }));
    },
    async delete(providerId) {
      if (!isCredentialKeySegment(providerId)) return;
      await writableStore(ctx).deleteRecord(recordKeyFor(providerId));
    },
  };
}

/**
 * A pi-ai `AuthContext` over the harness credential plane and the host
 * filesystem.
 *
 * `env()` answers from the credential seam first, so a value a deployment
 * stored through the harness is found by a provider's own ambient discovery —
 * without this, that discovery reads only the process environment and a stored
 * `AWS_ACCESS_KEY_ID` is invisible to it. `fileExists()` answers about the host
 * process's own filesystem rather than the workspace `ctx.fs` seam, because the
 * paths it is asked about (`~/.aws/credentials`, application-default
 * credentials) are facts about where this process runs, not about the project
 * under edit.
 * Nhận: ctx — plugin context mang `ctx.credentials` tuỳ chọn.
 * Trả: auth context để đưa cho `createModels()`.
 */
export function authContextFrom(ctx: Context): AuthContext {
  return {
    async env(name) {
      if (isCredentialRefName(name)) {
        const hit = await credentialPlaneOf(ctx)?.resolve(credentialRef(name));
        if (hit !== void 0) return hit.value;
      }
      return launchEnvironmentOf(ctx).get(name)?.value;
    },
    async fileExists(path) {
      const expanded = path.startsWith("~/") || path === "~" ? resolve(homedir(), path.slice(1).replace(/^\//, "")) : path;
      try {
        await access(expanded);
        return true;
      } catch {
        return false;
      }
    },
  };
}
