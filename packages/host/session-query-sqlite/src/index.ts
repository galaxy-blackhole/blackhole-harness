/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Entry NGUON cua package session-query-sqlite: be mat export cua artefact (byte-identical bundle goc)
 *      — artefact mount that la lib/index.js (build.ts ghep 4 lat nguyen van); file nay de cong cu doi chieu export
 */

// Bề mặt của artefact: lấy từ CHÍNH artefact đã build (một nguồn duy nhất, không khai lại kiểu/thân hàm).
export { default, SqliteSessionQueryEngine } from "../lib/index.js";
export {
  SESSION_QUERY_SQLITE_APPLICATION_ID,
  SESSION_QUERY_SQLITE_DEFAULT_LIMIT,
  SESSION_QUERY_SQLITE_MAX_LIMIT,
  SESSION_QUERY_SQLITE_PATH_KEY,
  SESSION_QUERY_SQLITE_SCHEMA_VERSION,
  SESSION_QUERY_SQLITE_SNIPPET_CHARS,
} from "../lib/index.js";
