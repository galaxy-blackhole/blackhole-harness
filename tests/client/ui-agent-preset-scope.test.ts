/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test row ui-agent-preset — HOP DONG PHAM VI cua ARTIFACT: moi dinh danh ma lib/client.js THAM CHIEU deu phai duoc DINH NGHIA trong chinh bundle do (lop loi "Roster is not defined" lam #root sap 68.760 -> 2.673, "MenuItem khong ton tai" lam khung slot render RONG khong console)
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-agent-preset");
/** Bundle GOC cua DSH (chi doc) — nguon doi chung. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-agent-preset", "lib", "client.js");

/** Ten toan cuc cua trinh duyet: bundle duoc phep dung ma KHONG khai bao (bun test khong co DOM). */
const BROWSER_GLOBALS = new Set<string>([
  "window", "document", "localStorage", "sessionStorage", "navigator", "location", "history",
  "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "matchMedia",
  "MutationObserver", "ResizeObserver", "IntersectionObserver", "HTMLElement", "Element", "Node",
  "customElements", "CSS", "CustomEvent", "DOMException", "MessageChannel", "TextEncoder",
  "TextDecoder", "URL", "URLSearchParams", "fetch", "Headers", "Response", "Request",
  "AbortController", "AbortSignal", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "queueMicrotask", "structuredClone", "performance", "console", "globalThis", "undefined", "NaN",
  "Infinity", "arguments",
]);

/** Ket qua phep kiem pham vi cua mot bundle. */
interface ScopeReport {
  /** Dinh danh bundle THAM CHIEU ma khong dinh nghia o dau trong bundle (rong = dat). */
  missing: string[];
  /** So ten duoc DINH NGHIA trong bundle — dung chong phep kiem RONG. */
  declared: number;
  /** So ten duoc THAM CHIEU trong bundle — dung chong phep kiem RONG. */
  used: number;
}

/**
 * Mot dinh danh nam o VI TRI KHAI BAO (ten lop/ham/bien/tham so/binding/import) — khong phai tham chieu.
 * Nhan: node — dinh danh can xet.
 * Tra: true neu node la ten duoc khai bao boi nut cha.
 */
function isDeclaredPosition(node: ts.Identifier): boolean {
  const parent = node.parent as ts.Node;
  if (ts.isClassDeclaration(parent) || ts.isClassExpression(parent) || ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)) return parent.name === node;
  if (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) return parent.name === node;
  if (ts.isBindingElement(parent) || ts.isImportSpecifier(parent)) return parent.name === node || parent.propertyName === node;
  if (ts.isCatchClause(parent)) return parent.variableDeclaration?.name === node;
  if (ts.isNamespaceImport(parent) || ts.isImportClause(parent)) return parent.name === node;
  return false;
}

/**
 * Mot dinh danh nam o VI TRI TEN THUOC TINH (khong phai tham chieu) — a.b, { b: ... }, nhan.
 * Nhan: node — dinh danh can xet.
 * Tra: true neu node chi la ten thuoc tinh/nhan.
 */
function isPropertyNamePosition(node: ts.Identifier): boolean {
  const parent = node.parent as ts.Node;
  if (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) return parent.name === node;
  if (ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) return parent.name === node;
  if (ts.isQualifiedName(parent)) return parent.right === node;
  if (ts.isLabeledStatement(parent)) return parent.label === node;
  return (ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node;
}

/**
 * Liet ke dinh danh ma bundle THAM CHIEU nhung KHONG duoc dinh nghia o dau trong chinh bundle do.
 *
 * Bat lop loi "mot cai ten khong ton tai trong pham vi bundle": ten do song sot qua Bun.build (no bo
 * kieu chu khong bo ten) nen tsc 0 loi VAN co the di kem mot artifact nem ReferenceError luc apply —
 * dung lop loi "TabDomain is not defined" da lam #root sap 68.760 -> 2.673 (ui-sidebar-right), va lop
 * "ext.primitives.MenuItem khong ton tai" lam khung slot render RONG khong console. Phep kiem nay doc
 * ARTIFACT that (lib/client.js) nen no bat ca loi do BUILDER gay ra, khong chi loi do ma nguon gay ra.
 * ⚠️ BAY DO LUONG DUOC: dat ten ham gom ten la `declare` trong file .ts chay bang bun lam ham do KHONG
 * chay ma KHONG BAO LOI ⇒ `declared` rong ⇒ phep kiem XANH GIA. Vi vay ham tra ve ca hai con so dem va
 * nha kiem PHAI khang dinh chung > 0, va PHAI co doi chung duong am (mot ten thieu phai bi bat).
 * Nhan: bundle — van ban lib/client.js.
 * Tra: bao cao { missing, declared, used }.
 */
function scopeReport(bundle: string): ScopeReport {
  const source = ts.createSourceFile("client.js", bundle, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const declared = new Set<string>();
  const used = new Set<string>();
  /** Duyet cay: gom ten duoc khai bao va ten duoc tham chieu (bo ten thuoc tinh). */
  const walk = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      if (isDeclaredPosition(node)) declared.add(node.text);
      else if (!isPropertyNamePosition(node)) used.add(node.text);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  const missing = [...used].filter((name) => !declared.has(name) && !BROWSER_GLOBALS.has(name) && !(name in globalThis)).sort();
  return { missing, declared: declared.size, used: used.size };
}

describe("row ui-agent-preset — HOP DONG PHAM VI (lop loi 'Roster is not defined')", () => {
  test("moi dinh danh bundle THAM CHIEU deu duoc DINH NGHIA trong chinh bundle do", () => {
    const ours = scopeReport(readFileSync(join(OURS, "lib", "client.js"), "utf8"));
    // ⚠️ CHONG PHEP KIEM RONG: bo gom ten hong (tra ve 0 ten) thi "missing rong" la XANH GIA.
    expect(ours.declared).toBeGreaterThan(100);
    expect(ours.used).toBeGreaterThan(100);
    expect(ours.missing).toEqual([]);
    // Doi chung DUONG AM: mot ten khong duoc dinh nghia o dau PHAI bi bat — neu khong, ca kiem la vo nghia.
    expect(scopeReport("const a = Roster.presets;").missing).toEqual(["Roster"]);
    // Chinh ban goc cung phai sach: neu khong, phep kiem tren la qua chat so voi doi chung.
    const stock = scopeReport(readFileSync(STOCK, "utf8"));
    expect(stock.declared).toBeGreaterThan(100);
    expect(stock.used).toBeGreaterThan(100);
    expect(stock.missing).toEqual([]);
  });
});
