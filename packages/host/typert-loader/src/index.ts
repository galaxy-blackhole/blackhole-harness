/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của gói: CHỈ xuất đúng SÁU tên mà bản gốc xuất (Config · TYPERT_HOST_EXPORT ·
 *      apply · inject · name · validateTypertManifest) — tập export của row host CHÍNH LÀ bề mặt
 *      service của nó, nên thừa hay thiếu một tên đều là lệch bản gốc.
 */
export { Config, apply, inject, name } from "./plugin.ts";
export { TYPERT_HOST_EXPORT, validateTypertManifest } from "./manifest.ts";
export type {
  TypertContribution,
  TypertLoaderContext,
  TypertPackageModel,
  TypertRegistrySeam,
} from "./types.ts";
export type { Config as TypertLoaderConfig } from "./plugin.ts";
