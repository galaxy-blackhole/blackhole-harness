/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry TANG PHU cua typert-gateway: hai tang envelope/wire cua ta (build ra lib/envelope.js)
 */

export { dottedMethodMessage, parseClientRequest, type EnvelopeResult, type TransportRejection } from "./envelope.ts";
export { asBytes, encodeServerResponse, type ServerResponseEnvelope, type WireResult } from "./wire.ts";
