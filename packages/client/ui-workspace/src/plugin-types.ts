/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu dung chung cua nua client: ham require cua bang module, context goc, va mat plugin
 */

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;
