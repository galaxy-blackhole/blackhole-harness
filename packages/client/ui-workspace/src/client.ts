/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Diem vao nua client — xuat factory createPlugin + PartialArguments (bo doc partial-json nhu ban goc) cho build.ts
 */

export { createPlugin } from "./plugin.ts";
// ⚠️ 18/10/2026 — PHAN (a): ban goc bundle ca util/values/partial-json vao client.js (620 dong).
// Xuat o day de ban build GIU module nay trong artifact — neu khong ai import thi Bun se tree-shake
// mat ⇒ tap ham cua goi ta thieu so voi ban goc lan nua.
export { PartialArguments } from "./partial-json.ts";
