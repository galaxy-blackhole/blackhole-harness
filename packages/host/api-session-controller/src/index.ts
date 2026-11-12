/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry NGUON cua package: be mat export cua artefact host (byte-identical bundle goc) + API nua client,
 *      de cong cu doi chieu export (check:rows build src/index.ts ra thu muc tam) va de build.ts co Bun.build THAT.
 */

// Bề mặt của artefact host: lấy từ CHÍNH artefact đã build (một nguồn duy nhất, không khai lại thân hàm).
export { default } from "../lib/index.js";
export {
  ApiSessionNotFound,
  SessionController,
  SessionFileReferences,
  SessionSkillCatalog,
  buildModelCatalog,
} from "../lib/index.js";

export { assembleClientBundle, OUR_CLIENT_ID, readWrapper, STOCK_CLIENT_ID, CLIENT_LOADER_SHAPE } from "./client.ts";
