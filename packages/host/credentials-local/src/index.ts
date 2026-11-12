/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bề mặt công khai của gói: đúng tập export của bản gốc @deepseek-ai/dsh-credentials-local
 *      (provider mặc định + 2 hằng số + 3 hàm thuần), không thêm không bớt
 */

export { CREDENTIALS_FILENAME, resolveSpec, type Config, type ResolvedSpec } from "./spec.ts";
export { DOCUMENT_VERSION, parseCredentialsDocument, type CredentialsDocument } from "./document.ts";
export { renderFlatLayoutMigration } from "./render.ts";
export { LocalCredentialProvider, LocalCredentialProvider as default } from "./provider.ts";
