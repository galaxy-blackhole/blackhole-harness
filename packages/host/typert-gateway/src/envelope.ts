/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tang 1 cua gateway: hinh dang ENVELOPE client-request (loi giao thuc HTTP 200) + loi van chuyen (ma HTTP that).
 */

/** Loi TANG VAN CHUYEN: tra ma HTTP that kem text thuan (dung nhu oracle). */
export interface TransportRejection {
  /** Ma HTTP that (400/404/415). */
  readonly status: number;
  /** Than text thuan. */
  readonly text: string;
}

/** Loi TANG GIAO THUC: HTTP van 200, loi nam trong envelope server-response. */
export type ProtocolErrorCode = "gateway/bad-request" | "gateway/internal";

/** Ket qua phan tich mot request cua client. */
export type EnvelopeResult =
  | { readonly kind: "ok"; readonly rpcId: string; readonly method: string; readonly args: Readonly<Record<string, unknown>> }
  | { readonly kind: "transport"; readonly rejection: TransportRejection }
  | { readonly kind: "protocol"; readonly code: ProtocolErrorCode; readonly message: string };

/** Thong diep co dinh cua upstream cho envelope sai hinh dang. */
const BAD_REQUEST_MESSAGE = "invalid client-request message";

/** Thong diep co dinh cua upstream cho payload sai hinh dang. */
const ARGS_MESSAGE = "Remote payload must contain exactly one plain-object args field";

/**
 * Phan tich mot request thanh client-request hop le.
 *
 * Thu tu kiem tra dung nhu oracle: (1) method HTTP -> 404 text; (2) content-type -> 415 text; (3) than JSON -> 400
 * text; (4) hinh dang ENVELOPE (type/rpcId/method/payload) -> gateway/bad-request; (5) hinh dang PAYLOAD (dung mot
 * truong args la object) -> gateway/internal. Ba loi dau la TANG VAN CHUYEN (co ma HTTP that, than text thuan);
 * hai loi sau la TANG GIAO THUC (HTTP 200 + envelope loi).
 * @param input - method HTTP, content-type, va than request dang byte hoac chuoi.
 * @returns ket qua: ok, hoac loi van chuyen, hoac loi giao thuc.
 */
export function parseClientRequest(input: {
  readonly method?: string | undefined;
  readonly contentType?: string | undefined;
  readonly body: Buffer | Uint8Array | string;
}): EnvelopeResult {
  if ((input.method ?? "").toUpperCase() !== "POST") {
    return { kind: "transport", rejection: { status: 404, text: "not found" } };
  }
  const mediaType = (input.contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (mediaType !== "application/json") {
    return { kind: "transport", rejection: { status: 415, text: "content type must be application/json" } };
  }
  const text = Buffer.isBuffer(input.body) ? input.body.toString("utf8") : typeof input.body === "string" ? input.body : Buffer.from(input.body).toString("utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "transport", rejection: { status: 400, text: "body is not JSON" } };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "protocol", code: "gateway/bad-request", message: BAD_REQUEST_MESSAGE };
  }
  const envelope = parsed as Record<string, unknown>;
  const rpcId = envelope.rpcId;
  const method = envelope.method;
  const payload = envelope.payload;
  if (envelope.type !== "client-request" || typeof rpcId !== "string" || typeof method !== "string" || payload === undefined) {
    return { kind: "protocol", code: "gateway/bad-request", message: BAD_REQUEST_MESSAGE };
  }
  const args = readArgs(payload);
  if (args === undefined) return { kind: "protocol", code: "gateway/internal", message: ARGS_MESSAGE };
  return { kind: "ok", rpcId, method, args };
}

/**
 * Doc truong args duy nhat trong payload.
 * @param payload - gia tri payload cua envelope.
 * @returns args dang object, hoac undefined khi hinh dang sai.
 */
function readArgs(payload: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== "args") return undefined;
  const args = (payload as Record<string, unknown>).args;
  if (typeof args !== "object" || args === null || Array.isArray(args)) return undefined;
  return args as Record<string, unknown>;
}

/**
 * Doi method dang co dau cham sang dang gach cheo (de bao loi giong oracle).
 * @param method - method client gui.
 * @returns thong diep loi neu method KHONG khop endpoint nao nhung khop khi doi dau cham.
 */
export function dottedMethodMessage(method: string): string {
  const dashed = method.replaceAll(".", "/");
  return "method \"" + method + "\" does not match endpoint \"" + dashed + "\"";
}
