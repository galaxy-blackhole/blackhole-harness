/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 12/11/2026
 * desc Kiem TRUOC khi mount: moi package co gbh.row phai build duoc, import duoc, va du export ma ban goc co.
 *      12/11/2026: chay duoc bang CA Bun va Node — bo import.meta.dir (Bun-only) va import thieu duoi .ts;
 *      khi khong co Bun.build thi doi chieu export tren lib/ dung san (che do app desktop chay launcher Node)
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { danglingInjectIssues, type ReplacedRow } from "./dangling.ts";
import { duplicateRowIdIssues } from "./row-ids.ts";
import { contextKeyedGuardTokens, escapeRe, missingServiceProperties } from "./surface.ts";

// Tai xuat de `tests/host/**` va `check:rows` van dung duoc cung mot duong dan sau khi tach module.
export { escapeRe, missingServiceProperties } from "./surface.ts";
export { danglingInjectIssues, type ReplacedRow } from "./dangling.ts";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appHome, appPatchPath } from "../../apps/cli/src/paths.ts";
import { exportNames, slotNames } from "./rows-scan.ts";
import { findRow, readMatrix } from "../scaffold/lib.ts";

/** Thu muc goc cua repo (import.meta.url: Bun va Node deu co; import.meta.dir chi Bun). */
const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
/** Noi cai runtime DSH (chi doc). */
const STOCK = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/** Mot van de tim thay. */
export interface Issue {
  /** Ten package cua ta. */
  pkg: string;
  /** Muc do: 'chan' = khong duoc mount, 'canh bao' = nen xem. */
  level: "chan" | "canh bao";
  /** Mo ta ngan. */
  detail: string;
}

/**
 * Doc moi file .js trong thu muc lib cua goi goc.
 * @param dir - thu muc lib.
 * @returns noi dung gop.
 */
function readStockClient(dir: string): string {
  let out = "";
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".js")) out += readFileSync(join(dir, name), "utf8");
  }
  return out;
}
/**
 * Doc toan bo file .ts trong mot thu muc (de tim loi goi dang ky o bat ky file nao).
 * @param dir - thu muc can quet.
 * @returns noi dung gop cua moi file .ts.
 */
function readAllTs(dir: string): string {
  let out = "";
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out += readAllTs(full);
    // .txt: goi de-bundle giu NGUYEN VAN part trong src/client-parts/*.txt (khong quet ⇒ cong slot bao OAN).
    else if (name.endsWith(".ts") || name.endsWith(".txt")) out += readFileSync(full, "utf8");
  }
  return out;
}

/**
 * Tim file nua client theo hai kieu dat ten dang dung trong repo.
 * @param dir - thu muc package.
 * @returns duong dan file nua client, hoac null.
 */
function clientEntry(dir: string): string | null {
  const candidates = ["client.ts", join("client", "index.ts")].map((rel) => join(dir, "src", rel));
  return candidates.find((path) => existsSync(path)) ?? null;
}

/**
 * Doc moi package trong repo co khai gbh.row.
 * @returns danh sach duong dan thu muc package.
 */
export function rowPackages(): string[] {
  const out: string[] = [];
  for (const area of ["host", "client"]) {
    const dir = join(ROOT, "packages", area);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const pkgDir = join(dir, name);
      if (!statSync(pkgDir).isDirectory()) continue;
      const pkgFile = join(pkgDir, "package.json");
      if (!existsSync(pkgFile)) continue;
      const json = JSON.parse(readFileSync(pkgFile, "utf8")) as { gbh?: { row?: unknown } };
      if (json.gbh?.row !== undefined) out.push(pkgDir);
    }
  }
  return out;
}

/**
 * Kiem mot package: build ra thu muc tam roi doi chieu export voi ban goc.
 * @param dir - thu muc package.
 * @param outRoot - thu muc tam de chua ban build.
 * @returns danh sach van de (rong = dat).
 */
/**
 * Rut cac id module ma nua client TU KHAI (trong loi goi load({ id: "..." })).
 * Bai hoc 17/10/2026: bang module khoa theo id BUNDLE tu khai, con Loader import theo
 * TEN PACKAGE ma row tro toi — lech nhau la 'import failed' va UI khong render.
 * @param text - toan bo ma nguon trong src/ cua goi.
 * @returns tap id dang chuoi package tim thay.
 */
function declaredModuleIds(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/id\s*:\s*"(@[a-z0-9-]+\/[a-z0-9-]+)"/g)) if (m[1] !== undefined) out.add(m[1]);
  return out;
}
/**
 * Kiem MOT package truoc khi mount: build thu, so export voi ban goc, so danh sach slot,
 * va doi chieu id module ma bundle TU KHAI voi ten package (loi da lam chet app 17/10/2026).
 * @param dir - thu muc package (co package.json + src/).
 * @param outRoot - thu muc tam chua ban build thu.
 * @returns danh sach van de: muc 'chan' la KHONG duoc mount.
 */
/**
 * Bat loi 'goi jsx tren namespace React' — lop loi lam hong thanh ben ngay 17/10/2026.
 * `require("react")` tra ve namespace React, KHONG co `jsx`/`jsxs`; hai ham do nam o
 * `react/jsx-runtime`. Loi nay server-side hoan toan im lang, chi lo o tang chay
 * (`TypeError: react.jsx is not a function`).
 * @param text - toan bo ma nguon nua client.
 * @returns ten cac binding React bi goi sai, hoac mang rong.
 */
function badJsxBindings(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*require\(\s*"react"\s*\)/g)) if (m[1] !== undefined) names.add(m[1]);
  for (const m of text.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+"react"/g)) if (m[1] !== undefined) names.add(m[1]);
  const bad: string[] = [];
  for (const n of names) if (new RegExp("\\b" + n + "\\.jsxs?\\(").test(text)) bad.push(n);
  return bad;
}

/**
 * ===== PHEP KIEM AN TOAN-BOOT (them 17/10/2026, sau hai su co lam app TRANG) =====
 *
 * Hai lop loi da lam app trang trong ngay, ca hai deu lot qua phep kiem cu:
 *   1. goi khai gbh.row + dsh.client nhung CHUA BUILD => ClientModuleRegistry nem ENOENT luc boot, host khong bao gio ready;
 *   2. bundle dang ky THEM id cua goi goc => duplicate factory registration => #root 0 ky tu.
 *
 * LUAT CUA HAI PHEP KIEM NAY — doc truoc khi sua:
 *   - Phep kiem phai chay tren ARTIFACT DANG MOUNT trong PROFILE (~/.galaxy/blackhole/profiles/...),
 *     KHONG phai packages/<goi>/lib/: da so goi viet lai KHONG co lib/ trong repo — chung duoc build
 *     thang vao profile luc mount. Vi vay "thieu lib/ trong repo" KHONG phai loi.
 *   - Chuoi "@deepseek-ai/**" trong THAN bundle la loi goi require qua bang module — HOP LE. Chi id nam
 *     o VI TRI id cua load({ id: ... }) moi bi tinh.
 *   - KHONG BAO DO OAN: neu mot goi DANG CHAY TOT ma bi phep kiem nay bao loi thi PHEP KIEM SAI,
 *     khong phai goi sai — hay sua phep kiem. (Da chay tren toan bo goi dang chay that truoc khi commit.)
 */

/** Ki tu dac biet cua regex, de tu escape thay vi viet lop ki tu de vo template. */

/**
 * Escape ki tu dac biet cua regex trong mot chuoi.
 * @param value - chuoi can escape.
 * @returns chuoi da escape.
 */

/** Mot loi goi dang ky module tim thay trong artifact da build. */
export interface ModuleRegistration {
  /** Bieu thuc id nhu trong ma: "@x/y" (literal) hoac ten hang (PACKAGE_NAME). */
  expression: string;
  /** Id da phan giai, hoac undefined khi khong tra duoc hang. */
  id: string | undefined;
}

/**
 * Tra gia tri mot hang chuoi trong artifact da build (var NAME = "..." ).
 * @param code - noi dung artifact.
 * @param name - ten hang.
 * @returns gia tri hang, hoac undefined.
 */
export function resolveBundleConstant(code: string, name: string): string | undefined {
  const m = new RegExp("(?:var|let|const)\\s+" + name + "\\s*=\\s*[\"']([^\"']+)[\"']").exec(code);
  return m?.[1];
}

/**
 * Liet ke moi loi goi dang ky module trong artifact da build.
 * Ho tro CA BA khuon dang dung trong repo:
 *   (1) window.__ModuleLoader__.load({ id: "..." })            (kieu ui-skill)
 *   (2) const loader = globalThis.__ModuleLoader__; loader.load({ id: PACKAGE_NAME })  (kieu shortcuts/locale)
 *   (3) bat ky ten khac mien la gan tu __ModuleLoader__ (fallback ben duoi).
 * @param code - noi dung artifact da build.
 * @returns danh sach loi goi kem bieu thuc id.
 */
export function moduleRegistrations(code: string): ModuleRegistration[] {
  // Bon khuon dang dung trong repo:
  //   (1) window.__ModuleLoader__.load({...})                     — ui-skill
  //   (2) var loader = globalThis.__ModuleLoader__; loader.load({...})  — shortcuts · locale · connection
  //   (3) var register = globalThis.__ModuleLoader__.load; register({...}) — ui-jobs
  //   (4) literal "…" hoac hang PACKAGE_NAME o VI TRI id.
  const objectAliases = new Set<string>();
  const methodAliases = new Set<string>();
  for (const m of code.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:globalThis|window|self)?\.?__ModuleLoader__\s*\.\s*load\b/g)) {
    if (m[1] !== undefined) methodAliases.add(m[1]);
  }
  for (const m of code.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:globalThis|window|self)?\.?__ModuleLoader__\b(?!\s*\.\s*load)/g)) {
    if (m[1] !== undefined) objectAliases.add(m[1]);
  }
  const out: ModuleRegistration[] = [];
  const collectBody = (body: string): void => {
    // Chi nhan loi goi DANG KY MODULE: `load({ id, factory })` luon co `factory`. Thieu dieu kien nay
    // thi mot `register({ name, id })` cua slot (vi du id "job-list") bi doc nham thanh id module —
    // dung loi phep kiem nay tung bao oan cho gbh-client-ui-jobs ngay 17/10/2026.
    // `factory` co the viet day du (`factory:`) hoac viet tat (`{ id, factory }`).
    if (!/\bfactory\b/.test(body)) return;
    const idMatch = /id\s*:\s*(?:"([^"]*)"|'([^']*)'|([A-Za-z_$][\w$]*))/.exec(body);
    if (idMatch === null) {
      out.push({ expression: "(khong doc duoc id)", id: undefined });
      return;
    }
    const literal = idMatch[1] ?? idMatch[2];
    if (literal !== undefined) out.push({ expression: JSON.stringify(literal), id: literal });
    else {
      const name = idMatch[3] as string;
      out.push({ expression: name, id: resolveBundleConstant(code, name) });
    }
  };
  const collect = (pattern: RegExp): void => {
    for (const m of code.matchAll(pattern)) collectBody(m[1] ?? "");
  };
  const objectNames = [escapeRe("__ModuleLoader__"), ...[...objectAliases].map((n) => escapeRe(n))].join("|");
  for (const m of code.matchAll(new RegExp("(?:\.|\\b)(?:" + objectNames + ")\\s*\\.\\s*load\\s*\\(\\s*\\{([\\s\\S]{0,500}?)\\}", "g"))) {
    collectBody(m[1] ?? "");
  }
  if (methodAliases.size > 0) {
    const methodNames = [...methodAliases].map((n) => escapeRe(n)).join("|");
    for (const m of code.matchAll(new RegExp("\\b(?:" + methodNames + ")\\s*\\(\\s*\\{([\\s\\S]{0,500}?)\\}", "g"))) {
      collectBody(m[1] ?? "");
    }
  }
  if (out.length === 0) {
    // Fallback: artifact co __ModuleLoader__ nhung ten bi doi khac — lay moi ".load({ ... }".
    collect(/\b[A-Za-z_$][\w$]*\s*\.\s*load\s*\(\s*\{([\s\S]{0,500}?)\}/g);
  }
  return out;
}

/**
 * Doc patch dang chay (\`app.patch.yml\`).
 *
 * ⚠️ CANH BAO DO TIN CAY: file nay **duoc sinh lai MOI LAN BOOT** (header cua chinh no ghi vay). Doc giua luc
 * \`bh host\` dang ghi ⇒ nhan duoc **trang thai TAM** ⇒ moi phan quyet dua tren no deu khong dung duoc.
 * Vi vay noi goi phai in kem **mtime** (xem \`main\`) va doi chieu voi moc gio boot.

 * Doc lop patch dang chay cua app — dung CHINH quy tac cua apps/cli/src/paths.ts.
 *
 * BAI HOC 17/10/2026: ban dau ham nay doc `GBH_HOME ?? DSH_HOME`, va `DSH_HOME` (home cua harness
 * phien agent, vi du ~/.galaxy/gbh) la mot cay KHAC voi home cua app (~/.galaxy/blackhole) ⇒ phep
 * kiem bao "chua thay artifact trong profile" cho MOI goi, tuc bao doan. Home cua app LUON lay tu
 * `appHome()`; tuyet doi khong doan bang `DSH_HOME`.
 * @returns noi dung patch, hoac null khi khong thay (khong ket luan duoc).
 */
export function readRunningPatch(): string | null {
  const path = appPatchPath();
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

/**
 * Row goc co dang BI TAT trong patch dang chay khong?
 * Patch sinh moi lan boot: row bi thay the xuat hien dang "- id: <row>" + "disabled: true".
 * @param patch - noi dung app.patch.yml.
 * @param rowId - id row goc (vi du "shortcuts").
 * @returns true khi patch tat RO RANG row do; false khi row con bat hoac khong ket luan duoc.
 */
export function rowDisabledInPatch(patch: string, rowId: string): boolean {
  for (const block of patch.split(/^-\s/m)) {
    const first = (block.split("\n")[0] ?? "").trimEnd();
    if (first !== "id: " + rowId) continue;
    return /^\s*disabled:\s*true\s*$/m.test(block);
  }
  return false;
}

/** Du lieu cho phep kiem dang ky id (ham THUAN — test duoc, khong doc dia). */
export interface ModuleIdCheckInput {
  /** Ten package cua ta. */
  pkg: string;
  /** Noi dung artifact da build. */
  code: string;
  /** gbh.row.moduleIds da khai (nguon su that cho khuon sinh id qua hang). */
  declared: readonly string[];
  /** gbh.row.aliases da khai. */
  aliases: readonly string[];
  /** Id cac package DSH goc ma row nay thay the. */
  stockIds: readonly string[];
  /** Patch dang chay co TAT row goc khong (false = row goc con bat, hoac khong ket luan duoc). */
  stockRowDisabled: boolean;
  /**
   * Ban build TRONG REPO (nếu có) — chỉ để PHÂN BIỆT "gói chưa sửa" với "bản mount cũ".
   *
   * Ca thật 17-18/10/2026 (ui-sidebar, ui-permission, ui-goal): nguồn đã sửa + build lại nhưng artifact
   * trong PROFILE còn cũ ⇒ cổng đọc bản đang phục vụ nên báo lỗi, và người đọc tưởng gói chưa sửa.
   * Đọc thêm bản repo để nói đúng sự thật — và nói luôn HÀNH ĐỘNG cần làm (một lượt mount).
   */
  repoCode?: string;
}

/**
 * Phan quyet ve dang ky id module trong artifact.
 * @param input - du lieu kiem (xem {@link ModuleIdCheckInput}).
 * @returns danh sach van de: 'chan' khi so lan dang ky sai, khi id khong khop ten package, hoac khi id stock nam o VI TRI id ma row goc con bat.
 */
export function moduleIdIssues(input: ModuleIdCheckInput): Issue[] {
  const issues: Issue[] = [];
  const found = moduleRegistrations(input.code);
  const ids = found.map((r) => r.id).filter((id): id is string => id !== undefined);
  // KHONG lay so luong lam 'chan': repo co >=4 khuon dang ky (xem moduleRegistrations) va vai goi dang ky
  // CO Y ca id goc lam alias (ui-sidebar · ui-jobs · ui-settings-session-log) — bai hoc 17/10/2026.
  // `stockIds` la tap "da biet" o duoi: id goc la chuyen CO Y, khong phai "id la".
  const declaredIds = new Set<string>([input.pkg, ...input.declared, ...input.aliases]);
  const accepted = new Set<string>([...declaredIds, ...input.stockIds]);
  const expected = Math.max(1, input.declared.length);
  if (found.length === 0) {
    // Artifact chay duoc thi PHAI co loi goi dang ky; khong doc duoc ma cung khong thay __ModuleLoader__
    // moi la loi that (entry se chet), con doc khong ra thi chi la phep kiem bi mu.
    issues.push(
      input.code.includes("__ModuleLoader__")
        ? { pkg: input.pkg, level: "canh bao", detail: "khong doc duoc loi goi dang ky id trong artifact (chua ho tro khuon cua goi nay) — khai gbh.row.moduleIds de phep kiem co hieu luc" }
        : { pkg: input.pkg, level: "chan", detail: "artifact KHONG dang ky id module nao (khong thay __ModuleLoader__) — entry se chet, UI khong render" },
    );
    return issues;
  }
  // LUAT MOT-ID (17/10/2026): bundle phai dang ky DUNG MOT id — id CUA TA. Id goc chi khai o
  // gbh.row.aliases va TANG NAP tu sinh entry alias. Dang ky them id goc trong bundle ⇒ bundle chay HAI
  // lan ⇒ duplicate factory registration / service has been registered ⇒ APP TRANG (su co 12 tang).
  // Ban REPO da dung 1 id ⇒ day la BAN MOUNT CU, khong phai goi chua sua (xem truong repoCode).
  const repoRegistrations = input.repoCode === undefined ? undefined : moduleRegistrations(input.repoCode);
  const staleMount = repoRegistrations !== undefined && repoRegistrations.length === 1 && found.length !== 1;
  if (found.length !== 1) {
    issues.push({
      pkg: input.pkg,
      // DA BAT LAI CHAN (17/10/2026): 27 goi da rollback xong, tang nap da sinh duoc entry stock tu
      // aliases-only, va phep dem lai tren ARTIFACT = 0 goi (Lead tu sua ui-goal, do: id goc = 0).
      // Truoc do luat nay tam o muc CANH BAO vi cong CHAN lam row bi BO QUA o luot mount (xem GATE-ROWS.md).
      level: "chan",
      detail:
        "artifact dang ky " + found.length + " id module (LUAT: dung 1 — id cua ta). Id goc chi khai o gbh.row.aliases; " +
        "dang ky them id goc trong bundle lam bundle chay hai lan ⇒ duplicate factory registration ⇒ #root 0 ky tu. " +
        (staleMount
          ? "BAN REPO DA DUNG (1 id) ⇒ day la BAN MOUNT CU, khong phai goi chua sua: can MOT LUOT MOUNT de so dung"
          : "TAM THOI la CANH BAO trong cua so rollback (app phai duoc chay); bat lai CHAN khi 27 goi rollback xong VA tang nap sinh duoc entry stock aliases-only"),
    });
  }
  for (const item of found) {
    if (item.id !== undefined) continue;
    issues.push({
      pkg: input.pkg,
      level: "canh bao",
      detail: 'khong phan giai duoc id module tu bieu thuc "' + item.expression + '" — khai gbh.row.moduleIds de phep kiem co hieu luc',
    });
  }
  if (input.declared.length > 0 && ids.length > 0 && ids[0] !== input.declared[0]) {
    issues.push({
      pkg: input.pkg,
      level: "chan",
      detail:
        "id module DAU TIEN trong artifact (" + ids[0] + ") khac gbh.row.moduleIds[0] (" + input.declared[0] +
        ") — Loader import theo ten package ma row tro toi, lech la mat entry am tham",
    });
  }
  // (b) DẤU HIỆU CA SAI: id gốc nằm trong moduleIds (phải chỉ nằm ở aliases).
  for (const stockId of input.stockIds) {
    if (!input.declared.includes(stockId)) continue;
    issues.push({
      pkg: input.pkg,
      level: "chan",
      // DA BAT LAI CHAN (17/10/2026): tang nap da sinh duoc entry stock tu aliases-only (do bang 3 goi cua
      // tm-client: modules · resources · ui-settings-web-search — parity:graph khong con liet ke chung o
      // "id chi co o ref"), VA tm-parity-b da don 23 goi ⇒ phep dem lai: (b) = 0 goi. Xem GATE-ROWS.md.
      detail:
        "gbh.row.moduleIds chua id cua goi GOC (" + stockId + ") — id goc CHI duoc khai o gbh.row.aliases; " +
        "khai ca hai cho la dau hieu ca sai (bundle se dang ky hai id ⇒ chay hai lan). " +
        "TAM THOI la CANH BAO vi tang nap chua sinh entry stock cho aliases-only; se bat lai thanh CHAN sau",
    });
  }
  for (const id of ids) {
    if (accepted.has(id)) continue;
    issues.push({
      pkg: input.pkg,
      level: "chan",
      detail: "id module (" + id + ") KHONG nam trong ten package " + input.pkg + " / gbh.row.moduleIds / gbh.row.aliases — Loader se bao import failed",
    });
  }
  for (const stockId of input.stockIds) {
    if (!ids.includes(stockId)) continue;
    // LUAT (khoi phuc 17/10/2026 sau khi Lead dinh chinh DAU VAO cua toi): kien truc van la DISABLE + INSERT
    // (ADR 0004 §2) — row goc BI TAT roi ta insert row cua ta. Vi vay dang ky id goc trong bundle VAN la
    // nguy co trung THAT khi row goc con bat.
    //   · row goc DANG BAT + dang ky id goc => CHAN (duplicate factory registration => #root 0 ky tu)
    //   · row goc DA TAT  + da khai id goc  => im lang (alias CO Y; nguoi sau doc moduleIds/aliases la hieu)
    //   · row goc DA TAT  + chua khai       => CANH BAO (khong ai biet do la alias co y)
    // declaredIds (KHONG tinh stockIds) lam cho nhanh CANH BAO nay thuc su chay duoc: ban truoc dung tap
    // "da biet" (co ca stockIds) nen nhanh do la nhanh CHET — chinh test cua toi bat duoc loi do.
    if (!input.stockRowDisabled) {
      issues.push({
        pkg: input.pkg,
        // TAM HA xuong CANH BAO (17/10/2026, cua so rollback): row goc duoc bat lai trong luc rollback nen
        // luat nay bat hang chuc goi dang chay ⇒ khong duoc de no loai row khoi luot mount.
        // BAT LAI CHAN cung dieu kien voi luat (a) — xem docs/recipes/GATE-ROWS.md.
        level: "chan",
        detail:
          "artifact dang ky id cua goi GOC (" + stockId +
          ") trong khi ROW GOC VAN BAT trong patch dang chay => duplicate factory registration => #root 0 ky tu",
      });
      continue;
    }
    if (!declaredIds.has(stockId)) {
      issues.push({ pkg: input.pkg, level: "canh bao", detail: "artifact dang ky id cua goi GOC (" + stockId + ") nhung khong khai trong moduleIds/aliases — nen khai tuong minh de nguoi sau biet do la alias CO Y" });
    }
  }
  return issues;
}

/**
 * Thu muc ban mount trong profile — cung quy uoc voi chi so (10) cua check:app va cung home voi
 * `bh host` (`appHome()`), KHONG dung `DSH_HOME` (do la home cua harness phien agent, cay khac).
 * @returns duong dan thu muc node_modules trong profile dang dung.
 */
export function mountRoot(): string {
  return join(appHome(), "profiles", "node_modules");
}

/** Ki tu YAML KHONG duoc phep mo dau mot scalar tran (plain scalar). `!` duoc bo qua vi `!!js` la the YAML hop le. */
const YAML_INDICATORS: readonly string[] = ["@", "%", "*", "&", ",", "[", "]", "{", "}", "#", "`"];

/**
 * Bat lop loi `patch sinh ra la YAML khong hop le` — da lam MOI luot boot chet 17/10/2026.
 *
 * Su co that: `apps/cli/src/rewrite-metadata.ts` ghi `- ` + gia tri inject tho, nen
 * `- @deepseek-ai/dsh-api-remotes` di thang vao patch; YAML coi `@` la ki tu danh rieng o dau scalar
 * ⇒ `parsePatchList` nem loi ⇒ harness thoat ma khong in URL. Kiem o DAY de lop loi do bi bat truoc
 * luot boot, thay vi giet app.
 * @param patch - noi dung `app.patch.yml` dang chay.
 * @returns danh sach van de: 'chan' cho `@` (da do duoc la chet that), 'canh bao' cho cac ki tu con lai.
 */
export function patchScalarIssues(patch: string): Issue[] {
  const issues: Issue[] = [];
  for (const line of patch.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const item = /^-\s+(\S.*)$/.exec(trimmed);
    const value = item?.[1];
    if (value === undefined) continue;
    const first = value[0];
    if (first === undefined || first === "'" || first === '"') continue;
    if (!YAML_INDICATORS.includes(first)) continue;
    issues.push({
      pkg: "app.patch.yml",
      level: first === "@" ? "chan" : "canh bao",
      detail:
        "dong \"" + trimmed.slice(0, 60) + "\" la scalar tran mo dau bang \"" + first +
        "\" — YAML khong hop le o dau scalar ⇒ harness thoat luc boot (parsePatchList). Sinh patch phai quote: '- \"" + value.slice(0, 40) + "\"'",
    });
  }
  return issues;
}

/** Mot row de doi chieu trung id lien row. */
export interface RowRegistrationSet {
  /** Ten package cua ta. */
  pkg: string;
  /** Id row (vi du "ui-layout"). */
  rowId: string;
  /** Id module bundle dang ky. */
  ids: readonly string[];
  /** Row nay co dang BAT trong patch khong (row bi `disabled: true` thi khong tinh). */
  enabled: boolean;
}

/**
 * Phat hien TRUNG id module GIUA CAC ROW dang bat — lop loi da lam app trang ngay 17/10/2026:
 * hai bundle cung dang ky mot id ⇒ `duplicate factory registration` ⇒ #root 0 ky tu.
 * Chi tinh row DANG BAT: row bi tat thi bundle cua no khong duoc nap, khong the trung.
 * @param rows - danh sach row kem id da dang ky.
 * @returns danh sach van de 'chan' cho moi id bi tu hai row tro len cung dang ky.
 */
export function crossRowDuplicateIssues(rows: readonly RowRegistrationSet[]): Issue[] {
  const owners = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.enabled) continue;
    for (const id of row.ids) owners.set(id, [...(owners.get(id) ?? []), row.pkg]);
  }
  const issues: Issue[] = [];
  for (const [id, pkgs] of owners) {
    if (pkgs.length < 2) continue;
    issues.push({
      pkg: pkgs.join(" + "),
      level: "chan",
      detail: "id module " + id + " bi " + pkgs.length + " row DANG BAT cung dang ky ⇒ duplicate factory registration ⇒ #root 0 ky tu",
    });
  }
  return issues;
}

/**
 * Liet ke moi file trong mot cay thu muc (duong dan tuyet doi).
 * @param dir - thu muc goc.
 * @returns danh sach duong dan file.
 */
function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * Kiem lop loi 17/10/2026: bundle cua ta doc MOT THUOC TINH khong co tren be mat service cua ban goc.
 *
 * Su co that: bieu thuc ctx.configForms.developerTools.enabled… lam row STOCK khong activate; thuoc tinh
 * do KHONG co trong be mat service ma ban goc cung cap — va no chi lo ra khi chay that. Phep kiem nay doc
 * ban DANG PHUC VU (artifact trong profile) chu khong doc ban tren dia: bai hoc cua ca vong la "thu dang
 * chay khong phai ma minh tin la dang chay".
 *
 * Cach lam (co y CONSERVATIVE de khong bao oan):
 *   1. Lay ten service ma ban goc cung cap: provide("X") / set("X" / static provide = "X" trong bundle stock;
 *   2. Trong bundle cua ta, tim moi chuoi dang <service>.<thuoc-tinh>;
 *   3. Neu <thuoc-tinh> KHONG xuat hien o BAT KY dau trong goi stock (bundle + moi file .d.ts) ⇒ CHAN.
 * Chi can mot dau vet la du de coi la hop le, nen ty le bao oan rat thap.
 * @param dir - thu muc package cua ta trong repo (de tim doi chieu stock qua PARITY-MATRIX).
 * @param json - package.json da doc (dung name, gbh.row.id).
 * @returns danh sach van de chan.
 */
export function serviceSurfaceIssues(dir: string, json: { name: string; gbh?: { row?: { id?: string } } }): Issue[] {
  const issues: Issue[] = [];
  const rowId = json.gbh?.row?.id;
  if (rowId === undefined) return issues;
  const matrix = findRow(readMatrix(), rowId);
  if (matrix === undefined) return issues;
  const stockDir = join(STOCK, matrix.stock);
  if (!existsSync(stockDir)) return issues;
  const mounted = join(mountRoot(), json.name, "lib", "client.js");
  if (!existsSync(mounted)) return issues;
  const ours = readFileSync(mounted, "utf8");
  const stockClient = join(stockDir, "lib", "client.js");
  let stockText = existsSync(stockClient) ? readFileSync(stockClient, "utf8") : "";
  for (const file of listFiles(join(stockDir, "lib", "types"))) {
    if (file.endsWith(".d.ts")) stockText += "\n" + readFileSync(file, "utf8");
  }
  if (stockText === "") return issues;
  for (const label of missingServiceProperties(stockText, ours)) {
    issues.push({
      pkg: json.name,
      level: "chan",
      detail:
        "bundle dang phuc vu doc " + label + " nhung thuoc tinh nay KHONG co o bat ky dau trong goi goc " + matrix.stock +
        " (bundle + .d.ts) — lop loi 17/10/2026: doc thuoc tinh khong co tren be mat service lam row khong activate",
    });
  }
  return issues;
}

/**
 * Kiem y dinh build + artifact dang mount cua MOT goi hai mat.
 * @param dir - thu muc package trong repo.
 * @param json - package.json da doc (dung name, exports).
 * @returns danh sach van de ('chan' khi thieu build.ts / exports["./client"]).
 */
/**
 * Kiem lop loi "khai dsh.client nhung build.ts KHONG BAO GIO sinh lib/client.js".
 *
 * SU CO 19:13 (17/10/2026): khung scaffold chi build src/index.ts ⇒ khong bao gio co artifact nua
 * client, nhung goi da khai dsh.client (kem immediately: true) ⇒ ClientModuleRegistry nem
 * client bundle not found LUC BOOT ⇒ khong co __GBH_BOOT__ (alias __DSH_BOOT__) ⇒ app TRANG. Boot lai y nguyen se chet lai.
 *
 * Ba phep kiem nay deu TINH (khong can build), va KHONG bao doan:
 *   1. co dsh.client ⇒ phai co src/client.ts (hoac src/client/index.ts);
 *   2. phai co BANG CHUNG build nua client: hoac >= 2 loi goi Bun.build (trong build.ts va/hoac src/),
 *      hoac artifact trong profile da ton tai VA co >= 1 loi goi dang ky module (bang chung thang hinh dang);
 *   3. artifact (neu co) phai nam trong so do: da kiem o {@link moduleIdIssues}.
 * @param dir - thu muc package trong repo.
 * @param json - package.json da doc (dung name, dsh.client).
 * @returns danh sach van de; chan khi khong co duong nao sinh ra nua client.
 */





/**
 * Id module/alias da khai cua tung goi (nguon su that cho phep kiem canh inject treo).
 * @param dirs - thu muc cac goi khai gbh.row.
 * @returns anh xa ten package -> danh sach id da khai.
 */
export function declaredIdsByPackage(dirs: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const dir of dirs) {
    const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      name: string;
      gbh?: { row?: { moduleIds?: string[]; aliases?: string[] } };
    };
    const row = json.gbh?.row;
    out.set(json.name, [...(row?.moduleIds ?? []), ...(row?.aliases ?? [])]);
  }
  return out;
}
/**
 * Ai dang inject tung id package stock — doc TU GOI THAT trong repo (khong doc fixture).
 * Nguon: dsh.client.inject cua moi goi da cai trong apps/host/node_modules/@deepseek-ai va cua cac goi cua ta.
 * @returns anh xa id package -> danh sach ten package dang inject no.
 */
export function stockInjectors(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const roots = [STOCK, join(ROOT, "packages", "client"), join(ROOT, "packages", "host")];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      const pkgFile = join(root, name, "package.json");
      if (!existsSync(pkgFile)) continue;
      const json = JSON.parse(readFileSync(pkgFile, "utf8")) as { name?: string; dsh?: { client?: { inject?: unknown } } };
      const inject = json.dsh?.client?.inject;
      if (!Array.isArray(inject) || json.name === undefined) continue;
      for (const id of inject) {
        if (typeof id !== "string") continue;
        out.set(id, [...(out.get(id) ?? []), json.name]);
      }
    }
  }
  return out;
}

/**
 * Danh sach row ta DA THAY (co gbh.row), kem id stock tuong ung va trang thai bat/tat trong patch.
 * @param dirs - thu muc cac goi khai gbh.row.
 * @param patch - noi dung app.patch.yml dang chay, hoac null.
 * @returns cac row da thay.
 */
export function replacedRows(dirs: readonly string[], patch: string | null): ReplacedRow[] {
  const rows: ReplacedRow[] = [];
  for (const dir of dirs) {
    const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      name: string;
      gbh?: { row?: { id?: string; moved?: boolean } };
    };
    const row = json.gbh?.row;
    if (row === undefined || row.moved === true || row.id === undefined) continue;
    const matrix = findRow(readMatrix(), row.id);
    if (matrix === undefined) continue;
    rows.push({
      pkg: json.name,
      rowId: row.id,
      stockId: matrix.stock,
      enabled: patch === null ? true : !rowDisabledInPatch(patch, row.id),
    });
  }
  return rows;
}

/**
 * Kiem lop loi "khai dsh.client nhung build.ts KHONG BAO GIO sinh lib/client.js" (su co 19:13):
 * co dsh.client thi phai co src/client.ts, va phai co bang chung build nua client (>=2 loi goi Bun.build
 * trong build.ts/src, hoac artifact trong profile da dang ky duoc id).
 * @param dir - thu muc package trong repo.
 * @param json - package.json da doc (dung name, dsh.client).
 * @returns danh sach van de; chan khi khong co duong nao sinh ra nua client.
 */
export function clientBuildIssues(dir: string, json: { name: string; dsh?: { client?: unknown } }): Issue[] {
  const issues: Issue[] = [];
  const name = json.name;
  if (json.dsh?.client === undefined) return issues;
  const entry = join(dir, "src", "client.ts");
  if (!existsSync(entry) && !existsSync(join(dir, "src", "client", "index.ts"))) {
    issues.push({
      pkg: name,
      level: "chan",
      detail: "khai dsh.client nhung khong co src/client.ts (hoac src/client/index.ts) — khong co nua client de build",
    });
  }
  // Bang chung build: dem Bun.build trong build.ts + moi file trong src/ (khuon boc nam o ca hai cho).
  let builds = 0;
  const buildFile = join(dir, "build.ts");
  if (existsSync(buildFile)) builds += [...readFileSync(buildFile, "utf8").matchAll(/Bun\.build\s*\(/g)].length;
  for (const file of listFiles(join(dir, "src"))) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    builds += [...readFileSync(file, "utf8").matchAll(/Bun\.build\s*\(/g)].length;
  }
  if (builds >= 2) return issues;
  // Chua du bang chung tinh: xem artifact trong profile. Co artifact + co dang ky id = van chay duoc.
  const mounted = join(mountRoot(), name, "lib", "client.js");
  if (existsSync(mounted) && moduleRegistrations(readFileSync(mounted, "utf8")).length > 0) return issues;
  issues.push({
    pkg: name,
    level: "chan",
    detail:
      "khai dsh.client nhung build.ts/src/ chi co " + builds + " loi goi Bun.build va chua co artifact dang ky duoc id trong profile" +
      " — nua client se KHONG duoc sinh ra (su co 19:13: 'client bundle not found' luc boot ⇒ app trang); can build CA HAI nua",
  });
  return issues;
}

/**
 * Kiem y dinh build + artifact dang mount cua MOT goi hai mat.
 * @param dir - thu muc package trong repo.
 * @param json - package.json da doc (dung name, exports).
 * @returns danh sach van de chan/canh bao cho viec mount goi nay.
 */
export function mountArtifactIssues(dir: string, json: { name: string; exports?: Record<string, unknown> }): Issue[] {
  const issues: Issue[] = [];
  const name = json.name;
  if (!existsSync(join(dir, "build.ts"))) {
    issues.push({ pkg: name, level: "chan", detail: "khong co build.ts — goi hai mat phai build duoc nua client truoc khi mount" });
  }
  if (json.exports?.["./client"] === undefined) {
    issues.push({ pkg: name, level: "chan", detail: 'thieu exports["./client"] — Loader khong tim thay nua browser (ENOENT luc boot => host khong bao gio ready)' });
  }
  const mounted = join(mountRoot(), name, "lib", "client.js");
  if (!existsSync(mounted)) {
    issues.push({ pkg: name, level: "canh bao", detail: "chua thay artifact trong profile (" + mounted + ") — mount se build; chay lab:row de kiem truoc khi khai gbh.row" });
    return issues;
  }
  // Do tuoi theo MA NGUON, khong theo `lib/` trong repo: da so goi KHONG co lib/ trong repo, va goi nao
  // co thi do cung chi la ban build tay (lib/ nam trong .gitignore) — so voi no se bao oan.
  let newestSource = 0;
  for (const candidate of [join(dir, "build.ts"), join(dir, "package.json"), ...listFiles(join(dir, "src"))]) {
    if (!existsSync(candidate)) continue;
    newestSource = Math.max(newestSource, statSync(candidate).mtimeMs);
  }
  const mountTime = statSync(mounted).mtimeMs;
  if (newestSource > mountTime) {
    issues.push({ pkg: name, level: "canh bao", detail: "ban mount CU hon ma nguon trong repo — app dang phuc vu code cu; boot lai de mount ban moi" });
  }
  return issues;
}

/**
 * Kiem MOT package truoc khi mount: build thu, so export voi ban goc, so danh sach slot,
 * doi chieu id module bundle tu khai voi ten package, va bat loi goi jsx tren namespace React.
 * @param dir - thu muc package (co package.json + src/).
 * @param outRoot - thu muc tam chua ban build thu.
 * @returns danh sach van de; muc 'chan' nghia la KHONG duoc mount.
 */
export async function checkOne(dir: string, outRoot: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
    name: string;
    exports?: Record<string, unknown>;
    dsh?: { client?: unknown };
    gbh?: { row?: { id?: string } };
  };
  const name = json.name;
  const rowId = json.gbh?.row?.id ?? "?";
  // Goi DI CHUYEN (chua viet lai): chi co lib/ ship san, KHONG co src/ de doi chieu.
  // Mien phep so export/slot nhung phai CANH BAO RO: goi nay CHUA duoc kiem.
  if ((json.gbh?.row as { moved?: boolean } | undefined)?.moved === true) {
    issues.push({ pkg: name, level: "canh bao", detail: "goi DI CHUYEN (gbh.row.moved=true) — CHUA doi chieu duoc export/slot voi ban goc; no ky thuat ghi o ROADMAP" });
    return issues;
  }
  // Gói DE-BUNDLE: không có src/index.ts (nguồn là src/parts/* + build.ts có CỔNG BYTE) ⇒ đối chiếu export trên ARTEFACT đã build.
  const entry = join(dir, "src", "index.ts");
  const assembled = join(dir, "lib", "index.js");
  const deBundled = !existsSync(entry) && existsSync(join(dir, "build.ts")) && existsSync(assembled);
  if (!existsSync(entry) && !deBundled) {
    issues.push({ pkg: name, level: "chan", detail: "thieu src/index.ts (va khong phai goi de-bundle)" });
    return issues;
  }
  // `exportNames` trả `Set<string>` (so khớp bằng `.has`, xem dòng đối chiếu bên dưới) ⇒ khai ĐÚNG kiểu Set.
  let ours: Set<string>;
  if (deBundled) {
    ours = exportNames(readFileSync(assembled, "utf8"));
  } else if (typeof Bun === "undefined") {
    // 12/11/2026 — APP DESKTOP (launcher Node): khong co Bun.build. Doi chieu export tren ARTEFACT dung san
    // (chinh la file mount se chep vao profile), KHONG bao "dat" khi thieu bang chung.
    const prebuilt = join(dir, "lib", "index.js");
    if (!existsSync(prebuilt)) {
      issues.push({ pkg: name, level: "canh bao", detail: "khong co lib/index.js dung san va khong co Bun.build (Node) — KHONG doi chieu duoc export" });
      return issues;
    }
    ours = exportNames(readFileSync(prebuilt, "utf8"));
  } else {
    const out = join(outRoot, name.replace(/[@/]/g, "_"));
    const built = await Bun.build({ entrypoints: [entry], outdir: out, target: "node", format: "esm", naming: "index.js", packages: "external" });
    if (!built.success) {
      issues.push({ pkg: name, level: "chan", detail: "build that bai: " + built.logs.map(String).join(" | ").slice(0, 140) });
      return issues;
    }
    ours = exportNames(readFileSync(join(out, "index.js"), "utf8"));
  }
  const row = findRow(readMatrix(), rowId);
  if (row === undefined) {
    issues.push({ pkg: name, level: "canh bao", detail: "khong tra duoc row \"" + rowId + "\" trong docs/PARITY-MATRIX.md — KHONG doi chieu duoc export" });
    return issues;
  }
  const stockFile = join(STOCK, row.stock.split("/").pop() as string, "lib", "index.js");
  if (!existsSync(stockFile)) {
    issues.push({ pkg: name, level: "canh bao", detail: "khong thay ban goc " + row.stock + "/lib/index.js — KHONG doi chieu duoc export" });
  } else {
    const theirs = exportNames(readFileSync(stockFile, "utf8"));
    for (const key of theirs) {
      if (key === "default" || ours.has(key)) continue;
      issues.push({ pkg: name, level: key === "apply" ? "chan" : "canh bao", detail: "thieu export \"" + key + "\" ma ban goc co" });
    }
  }
  if (json.dsh?.client !== undefined || rowId.startsWith("ui-") || rowId.startsWith("client-")) {
    const client = clientEntry(dir);
    if (client === null) issues.push({ pkg: name, level: "chan", detail: "row hai mat nhung khong thay nua client (src/client.ts hoac src/client/)" });
    else {
      const text = readFileSync(client, "utf8");
      // 19/10/2026: wrapper co the sinh trong build.ts ⇒ quet CA build.ts (su co cot-translation: patch khong sinh).
      const buildText = existsSync(join(dir, "build.ts")) ? readFileSync(join(dir, "build.ts"), "utf8") : "";
      const allSrc = readAllTs(join(dir, "src")) + buildText;
      const loads = [...allSrc.matchAll(/__ModuleLoader__\.load|loader\.load/g)].length;
      if (loads < 1) issues.push({ pkg: name, level: "chan", detail: "nua client khong goi load() o dau trong src/ hay build.ts" });
      // ARTEFACT phai la SCRIPT CLASSIC (ESM ⇒ PARSE loi ⇒ 139 entry did-not-activate).
      const clientLib = join(dir, "lib", "client.js");
      if (existsSync(clientLib)) {
        const art = readFileSync(clientLib, "utf8");
        if (/(^|\n)[ \t]*(export|import)[ \t{*]/u.test(art)) issues.push({ pkg: name, level: "chan", detail: "lib/client.js la ESM — phai la script classic boc factory" });
        // 20/10/2026: nhận CẢ `globalThis.__ModuleLoader__.load(` (bundle gốc DSH dùng dạng này, ta port 1:1).
        if ((art.match(/(?:(?:window|globalThis)\.__ModuleLoader__|loader)\.load\(/gu) ?? []).length !== 1) issues.push({ pkg: name, level: "canh bao", detail: "lib/client.js khong goi dung MOT load(" });
      }
      // id module bundle TU KHAI phai khop package row tro toi: loi lam app CHET 17/10/2026 (#root 620 ky tu).
      for (const bad of badJsxBindings(allSrc)) {
        issues.push({ pkg: name, level: "chan", detail: "goi `" + bad + ".jsx(`/`.jsxs(` tren namespace React — hai ham do nam o `react/jsx-runtime`, khong co tren `require(\"react\")`. Loi chi lo o TANG CHAY (TypeError: react.jsx is not a function) va lam hong UI" });
      }
      const buildTs = join(dir, "build.ts");
      const declared = declaredModuleIds(allSrc + (existsSync(buildTs) ? readFileSync(buildTs, "utf8") : ""));
      // Nguon thu hai, khai TUONG MINH: khuon CJS-boc-IIFE sinh id qua JSON.stringify nen regex
      // khong doc duoc. Row nao theo khuon do PHAI khai gbh.row.moduleIds de khong mat phep kiem nay.
      const explicit = ((json.gbh?.row as { moduleIds?: string[] } | undefined)?.moduleIds ?? []);
      for (const x of explicit) declared.add(x);
      const aliases = ((json.gbh?.row as { aliases?: string[] } | undefined)?.aliases ?? []);
      const accepted = new Set<string>([name, ...aliases]);
      if (declared.size === 0) {
        issues.push({ pkg: name, level: "canh bao", detail: "khong doc duoc id module nao bundle tu khai — khai gbh.row.moduleIds: [\"…\"] de phep kiem nay co hieu luc (khuon CJS-boc-IIFE sinh id qua JSON.stringify nen regex khong thay)" });
      } else if (![...declared].some((x) => accepted.has(x))) {
        issues.push({ pkg: name, level: "chan", detail: "id module bundle tu khai (" + [...declared].join(", ") + ") KHONG khop ten package " + name + " — Loader se bao import failed; sua bundle hoac khai gbh.row.aliases" });
      }
      if (!/export\s*\{\}/.test(text) && !/^import\s/m.test(text) && !/^export\s/m.test(text)) {
        issues.push({ pkg: name, level: "canh bao", detail: "file nua client khong phai module (thieu export/import) — de dung bien toan cuc" });
      }
      // PHEP KIEM AN TOAN-BOOT: y dinh build + artifact trong PROFILE + so lan dang ky id.
      issues.push(...mountArtifactIssues(dir, json));
      issues.push(...clientBuildIssues(dir, json));
      issues.push(...serviceSurfaceIssues(dir, json));
      // LUAT (18/10/2026, BAT LAI sau khi duong mount ton trong cot MUC): cong chan cai hai lan KHONG duoc
      // khoa theo ctx — ca that la HAI ENTRY ⇒ HAI ctx ⇒ cong khoa-ctx KHONG BAO GIO kich hoat ⇒ apply chay
      // hai lan ⇒ service has been registered. Muc CANH BAO (khong chan mount): duong mount chi chan khi
      // cot muc = chan; truoc 18/10/2026 no substring-match chu chan tren ca dong nen mot canh bao co chu
      // chan trong cau da BO QUA 2 row that (ui-permission-presets, ui-settings-subagent).
      const guardPath = join(mountRoot(), name, "lib", "client.js");
      const guardCode = existsSync(guardPath) ? readFileSync(guardPath, "utf8") : null;
      if (guardCode !== null) {
        const tokens = contextKeyedGuardTokens(guardCode);
        if (tokens.length > 0) {
          issues.push({
            pkg: name,
            level: "canh bao",
            detail:
              "artifact con cong chan KHAO THEO ctx (" + tokens.join(", ") + ") — ca that la HAI ENTRY ⇒ HAI ctx nen cong nay khong bao gio kich hoat ⇒ apply chay hai lan ⇒ service has been registered. Dung: let tenInstalled = false o PHAM VI MODULE",
          });
        }
      }
      const mountedClient = join(mountRoot(), name, "lib", "client.js");
      if (existsSync(mountedClient)) {
        // BANG CHUNG VE PHEP DOC: app.patch.yml DUOC SINH LAI MOI LAN BOOT ⇒ doc giua luc `bh host` dang ghi
  // thi nhan duoc TRANG THAI TAM (bai hoc 17/10/2026: toi da doc trung cua so boot, thay 'khong con dong
  // - id: locale nao' va ket luan sai rang kien truc doi sang alias ⇒ sua luat cong dua tren trang thai tam).
  // Vi vay in kem duong dan + mtime de moi phep do co moc doi chieu.
  const patchPath = appPatchPath();
  if (existsSync(patchPath)) {
    console.log("patch dang chay: " + patchPath + " · mtime " + new Date(statSync(patchPath).mtimeMs).toISOString() + " — neu mtime nam trong luc boot thi KET QUA KHONG DUNG DUOC");
  }
  const patch = readRunningPatch();
        issues.push(
          ...moduleIdIssues({
            pkg: name,
            code: readFileSync(mountedClient, "utf8"),
            declared: explicit,
            aliases,
            stockIds: [row.stock],
            stockRowDisabled: patch === null ? false : rowDisabledInPatch(patch, rowId),
            // Ban build TRONG REPO: neu no da dung 1 id thi van de "2 id" o tren la BAN MOUNT CU.
            repoCode: existsSync(join(dir, "lib", "client.js")) ? readFileSync(join(dir, "lib", "client.js"), "utf8") : undefined,
          }),
        );
      }
      // So DANH SACH slot voi ban goc: dem so se bo sot truong hop 'mat 1 muc nhung them 1 muc khac'.
      const stockSlots = slotNames(readStockClient(join(STOCK, row.stock.split("/").pop() as string, "lib")));
      const ourSlots = slotNames(readAllTs(join(dir, "src")));
      for (const slot of stockSlots) {
        if (!ourSlots.has(slot)) issues.push({ pkg: name, level: "chan", detail: "thieu dang ky slot \"" + slot + "\" ma ban goc co" });
      }
      for (const slot of ourSlots) {
        if (!stockSlots.has(slot)) issues.push({ pkg: name, level: "canh bao", detail: "dang ky slot \"" + slot + "\" ma ban goc KHONG co" });
      }
    }
  }
  return issues;
}


/** Ket qua kiem mot package truoc khi mount. */
export interface RowVerdict {
  /** true khi KHONG duoc mount package nay. */
  blocked: boolean;
  /** Ly do ngan gon khi bi chan. */
  reason?: string;
  /** Cac van de muc 'canh bao' (khong chan mount). */
  warnings: string[];
}

/**
 * Kiem mot package theo duong dan — dung cho apps/cli goi truc tiep thay vi chay subprocess.
 * @param dir - thu muc package (co package.json + src/).
 * @param outRoot - thu muc tam chua ban build (mac dinh: node_modules/.gbh-check).
 * @returns phan quyet: co bi chan khong, ly do, va cac canh bao.
 */
export async function checkRow(dir: string, outRoot?: string): Promise<RowVerdict> {
  const issues = await checkOne(dir, outRoot ?? join(ROOT, "node_modules", ".gbh-check"));
  const blockers = issues.filter((i) => i.level === "chan");
  const warnings = issues.filter((i) => i.level === "canh bao").map((i) => i.detail);
  return blockers.length > 0
    ? { blocked: true, reason: blockers.map((i) => i.detail).join(" · "), warnings }
    : { blocked: false, warnings };
}
/**
 * Diem vao: kiem moi row package va in bang ket qua.
 * @returns ma thoat: 0 khi khong co van de 'chan', 1 khi co.
 */
async function main(): Promise<number> {
  const dirs = rowPackages();
  const outRoot = join(ROOT, "node_modules", ".gbh-check");
  // 12/11/2026: noi ro dang chay che do nao — app desktop (Node) khong build lai ma so artefact dung san.
  if (typeof Bun === "undefined") console.log("CHE DO: Node (khong co Bun.build) — doi chieu export tren lib/ dung san");
  const all: Issue[] = [];
  for (const dir of dirs) all.push(...await checkOne(dir, outRoot));
  // MOT row.id chi duoc MOT package khai (ham thuan o row-ids.ts — tach de giu file <= 1000 dong).
  all.push(...duplicateRowIdIssues(dirs));
  // Doi chieu TRUNG id GIUA CAC ROW: phai gom id cua MOI bundle thuoc row DANG BAT (theo app.patch.yml).
  const patch = readRunningPatch();
  const registrations: RowRegistrationSet[] = [];
  for (const dir of dirs) {
    const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      name: string;
      dsh?: { client?: unknown };
      gbh?: { row?: { id?: string; moved?: boolean } };
    };
    const row = json.gbh?.row;
    if (row === undefined || row.moved === true || json.dsh?.client === undefined) continue;
    const mounted = join(mountRoot(), json.name, "lib", "client.js");
    if (!existsSync(mounted)) continue;
    registrations.push({
      pkg: json.name,
      rowId: row.id ?? "?",
      ids: moduleRegistrations(readFileSync(mounted, "utf8")).map((r) => r.id).filter((id): id is string => id !== undefined),
      // Khong doc duoc patch thi coi nhu DANG BAT (an toan hon: van doi chieu trung).
      enabled: patch === null ? true : !rowDisabledInPatch(patch, row.id ?? ""),
    });
  }
  all.push(...crossRowDuplicateIssues(registrations));
  // Patch sinh ra phai PARSE duoc — lop loi da lam moi luot boot chet (xem patchScalarIssues).
  if (patch !== null) all.push(...patchScalarIssues(patch));
  all.push(...danglingInjectIssues(replacedRows(dirs, patch), stockInjectors(), declaredIdsByPackage(dirs)));
  const blockers = all.filter((i) => i.level === "chan");
  console.log("| Package | Muc do | Van de |");
  console.log("|---|---|---|");
  if (all.length === 0) console.log("| (tat ca " + dirs.length + " package) | — | khong co van de |");
  for (const i of all) console.log("| " + i.pkg.split("/").pop() + " | " + i.level + " | " + i.detail + " |");
  console.log("");
  if (blockers.length === 0) {
    console.log("KET LUAN: " + dirs.length + " package co gbh.row — TAT CA dat. Mount duoc.");
    console.log("");
    console.log("LUU Y: lenh nay chi noi \"mount KHONG lam hong app\". No KHONG thay the gate —");
    console.log(typeof Bun === "undefined"
      ? "che do Node khong build lai: export doi chieu tren lib/ dung san. Van phai chay: bun run gate"
      : "Bun.build bo kieu nen goi van co the con loi typecheck. Van phai chay: bun run gate");
    return 0;
  }
  console.log("KET LUAN: " + blockers.length + " van de CHAN mount. Go khoi gbh.row hoac sua truoc khi restart app.");
  return 1;
}
if (import.meta.main) process.exit(await main());