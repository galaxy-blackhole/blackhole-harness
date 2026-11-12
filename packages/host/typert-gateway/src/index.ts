/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry NGUON cua package typert-gateway: be mat export cua artefact (lớp service ĐẦY ĐỦ, byte-identical
 *      bundle gốc) + hai tầng phụ envelope/wire của ta. Artefact mount thật là lib/index.js (do build.ts ghép
 *      7 lát nguyên văn); file này là nguồn để công cụ đối chiếu export (check:rows build nó ra thư mục tạm).
 */

// Bề mặt của artefact: lấy từ CHÍNH artefact đã build (một nguồn duy nhất, không khai lại kiểu/thân hàm).
export { default, TypertGatewayError, TypertGatewayService } from "../lib/index.js";

export { dottedMethodMessage, parseClientRequest, type EnvelopeResult, type TransportRejection } from "./envelope.ts";
export { asBytes, encodeServerResponse, type ServerResponseEnvelope, type WireResult } from "./wire.ts";
export { assembleClient, clientHalfCount, CLIENT_SIDES, OUR_CLIENT_ID, STOCK_CLIENT_ID, type ClientSide, type ClientWrapper } from "./client.ts";
