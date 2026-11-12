/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cầu nối mỏng: re-export renameClientArtifact từ packages/tools/brand-rename để build.ts các gói gọi được
 */

export { renameClientArtifact, assertRenameOnly, DIST_READ_NAMES, applyBrandRenameSafe } from "../../packages/tools/brand-rename/src/index.ts";

export { chuanHoaIdSeed, chuanHoaIdSeedTrongTep, SEED_MODULES } from "./id-normalize.ts";
