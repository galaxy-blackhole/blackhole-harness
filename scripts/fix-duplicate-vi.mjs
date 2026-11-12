/*
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 03/11/2026
 desc Bo "vi" khoi artefact cua cac goi co namespace da duoc goi locale TRUNG TAM dang ky
      (ADR-0029: mot namespace chi mot nguon). Chay tu dong trong scripts/sync-lib-to-profile.sh
      de app khong trang UI vi loi "locale namespace ... already has locale vi".
*/

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();

/**
 * Doc danh sach namespace ma goi locale trung tam dang ky vi.
 * @returns tap namespace.
 */
export function centralNamespaces() {
  const file = join(REPO, "packages", "client", "locale", "src", "plugin.ts");
  if (!existsSync(file)) return new Set();
  const text = readFileSync(file, "utf8");
  const out = new Set();
  for (const match of text.matchAll(/\[\s*"([a-z0-9.\-]+)"\s*,\s*vi[A-Za-z0-9_$]+\s*\]/gu)) out.add(match[1]);
  return out;
}

/**
 * Bo "vi" khoi moi loi goi dang ky tu dien trong mot artefact client.
 * @param text noi dung artefact.
 * @returns noi dung da bo "vi".
 */
export function stripInjectedVi(text) {
  let out = text.replaceAll("{ zh, en, vi }", "{ zh, en }").replaceAll("{ en, zh, vi }", "{ en, zh }");
  out = out.replaceAll(/\{\s*zh:\s*([A-Za-z0-9_$]+),\s*en:\s*([A-Za-z0-9_$]+),\s*vi\s*\}/gu, "{ zh: $1, en: $2 }");
  out = out.replaceAll(/\{\s*en:\s*([A-Za-z0-9_$]+),\s*zh:\s*([A-Za-z0-9_$]+),\s*vi\s*\}/gu, "{ en: $1, zh: $2 }");
  return out;
}

// DANH SACH CHOT (ADR-0029): ba goi duoi day co namespace do GOI LOCALE TRUNG TAM dang ky,
// nen artefact cua chung KHONG duoc tu dang ky "vi" nua. Cac goi khac tu dang ky vi binh thuong.
const COLLIDING_PACKAGES = ["ui-input-trigger", "ui-user-questions", "ui-settings-account"];

const central = centralNamespaces();
const clientDir = join(REPO, "packages", "client");
const fixed = [];
for (const name of COLLIDING_PACKAGES) {
  const artifact = join(clientDir, name, "lib", "client.js");
  if (!existsSync(artifact)) continue;
  const before = readFileSync(artifact, "utf8");
  const after = stripInjectedVi(before);
  if (after !== before) {
    writeFileSync(artifact, after, "utf8");
    fixed.push(name);
  }
}
console.log("[fix-vi] bo vi trung o " + fixed.length + " artefact" + (fixed.length > 0 ? ": " + fixed.join(", ") : ""));
