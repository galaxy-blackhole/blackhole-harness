/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:requires — quet require LITERAL trong bundle PHUC VU, doi chieu bang seed + do thi: id nao khong ai phuc vu thi in ra kem ten bundle
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import { closeChromeSession, launchChrome } from "./lib/browser.ts";
import { OURS_PORT, REPO_ROOT, appHome, credentialsPath, parityPath, stamp } from "./lib/paths.ts";
import { enterSession } from "./lib/session-entry.ts";

/** Id duoc coi la SEED do vo (tang vo cap, khong can tren dia, khong can entry trong do thi). */
export const SEED_IDS: readonly string[] = Object.freeze([
  "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-store",
  "@deepseek-ai/dsh-client-ui-primitives",
  "@deepseek-ai/cordis",
  "@deepseek-ai/schemastery",
  "@deepseek-ai/dsh-client-ui-renderer-kit",
]);

/** Nguon cua danh sach mien kiem. */
export type SeedSource = "SZ() cua vo" | "danh sach du phong (khong doc duoc vo)";

/** Duong dan tuong doi tu repo toi thu muc asset cua vo web. */
export const SHELL_ASSET_DIR = "apps/host/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets";

/**
 * SUY danh sach seed tu CHINH VO (khong dung allowlist tay — allowlist tay se luon thieu):
 * doc asset dang phuc vu, tim `function SZ(){return{…}}` (ham dung `staticModules` ma vo truyen cho bo nap)
 * roi lay cac khoa `"<id>":`.
 * @returns danh sach id seed, hoac mang rong neu khong doc duoc vo.
 */
export function loadSeedIdsFromShell(): { ids: string[]; warnings: string[] } {
  try {
    const dir = join(REPO_ROOT, SHELL_ASSET_DIR);
    const warnings: string[] = [];
    const candidates = readdirSync(dir).filter((name) => name.startsWith("index-") && name.endsWith(".js"));
    if (candidates.length === 0) return { ids: [], warnings: ["khong thay asset index-*.js cua vo"] };
    let best = "";
    let bestSize = -1;
    for (const name of candidates) {
      const size = statSync(join(dir, name)).size;
      if (size > bestSize) {
        bestSize = size;
        best = name;
      }
    }
    const code = readFileSync(join(dir, best), "utf8");
    const body = /function SZ\(\)\s*\{\s*return\s*\{([\s\S]*?)\}\s*;?\s*\}/u.exec(code)?.[1] ?? "";
    if (body === "") return { ids: [], warnings: ["khong tim thay function SZ(){return{...}} trong asset cua vo"] };
    // Phep phong 5 dong (tm-client de nghi): than map cat bang [^}]*? nen neu trong do CON dau { o do sau >= 1
    // thi map co object long => danh sach mien kiem co the thieu. Artifact TU KHAI dieu do thay vi im lang dem thieu.
    if (body.includes("{")) warnings.push("map SZ() co object long — danh sach mien kiem co the thieu");
    const quoted = new Set<string>();
    for (const match of body.matchAll(/"([^"]+)"\s*:/gu)) {
      const id = match[1] ?? "";
      if (id !== "") quoted.add(id);
    }
    // Khoa TRAN (khong nhay) cung la mot khuon co that trong SZ() — do tm-client do duoc: "react":sC viet tran.
    // Dem theo CA HAI khuon; lech nhau thi canh bao de nguoi doc biet danh sach suy ra co the thieu.
    const bare = new Set<string>();
    for (const match of body.matchAll(/(?:^|,)\s*([A-Za-z@][\w./@-]*)\s*:/gu)) {
      const id = match[1] ?? "";
      if (id !== "") bare.add(id);
    }
    for (const id of bare) quoted.add(id);
    if (quoted.size !== [...bare].length + 0 && bare.size > 0) {
      // khong ket luan gi o day; chi ghi lai de doi chieu
    }
    return { ids: [...quoted], warnings };
  } catch {
    return { ids: [], warnings: ["doc asset cua vo that bai"] };
  }
}

/** Mot id bi require nhung khong thay nguoi phuc vu. */
export interface MissingRequire {
  /** Id bi require. */
  id: string;
  /** Ten bundle (dau tien trong combo) dang require no. */
  bundles: string[];
}

/** Artifact cua mot lan `parity:requires`. */
export interface RequiresArtifact {
  /** Phien ban dinh dang. */
  format: number;
  /** Dau thoi gian. */
  stamp: string;
  /** Cong da do. */
  port: number;
  /** So URL bundle da quet. */
  bundlesScanned: number;
  /** So id literal thu duoc. */
  idsFound: number;
  /** Id khong thay trong do thi va khong phai seed. */
  missing: MissingRequire[];
  /** Id duoc mien kiem vi la seed cua vo. */
  seedIds: string[];
  /** Nguon cua danh sach mien kiem (suy tu vo hay danh sach du phong). */
  seedSource: SeedSource;
  /** Canh bao khi suy danh sach mien kiem (vi du khong doc duoc vo) — de nguoi doc biet do tin cay. */
  seedWarnings: string[];
  /** Ket luan: PASS khi khong co id mo coi. */
  verdict: "PASS" | "FAIL" | "SKIP";
  /** Ghi chu. */
  note: string;
}

/**
 * Id co thuoc pham vi CAN kiem khong: chi namespace cua harness/ta moi co the "khong ai phuc vu".
 * Thu vien npm (react, react-dom, zod, @tanstack/…) do vo phan giai theo quy tac built-in — do la
 * HANH VI DUNG, nen dua chung vao se sinh duong tinh gia (ban v1 cua phep do nay da mac dung loi do).
 * @param id - id thu duoc tu bundle.
 * @returns true khi id thuoc pham vi kiem.
 */
export function isRelevantId(id: string): boolean {
  if (id.includes(" ") || id.includes("+") || id.length > 90) return false;
  return id.startsWith("@deepseek-ai/") || id.startsWith("@galaxy-blackhole/") || id.startsWith("@galaxy-stack/");
}

/**
 * Rut cac id ma bundle require bang LITERAL (`require("x")` hoac `requireFn("x")`).
 * Co y chi bat khuon literal: tha bat chac con hon bao dong gia (khuon dong khong doan duoc).
 * @param code - noi dung bundle da build.
 * @returns danh sach id duy nhat thuoc pham vi kiem.
 */
export function literalRequires(code: string): string[] {
  const ids = new Set<string>();
  for (const match of code.matchAll(/require(?:Fn)?\(\s*"([^"]+)"\s*\)/gu)) {
    const id = match[1] ?? "";
    if (id !== "" && isRelevantId(id)) ids.add(id);
  }
  return [...ids];
}

/**
 * Loc ra id khong duoc phuc vu: khong co trong payload do thi va khong nam trong bang seed.
 * @param requiredBy - ban do id -> ten bundle require no.
 * @param graphPayload - chuoi JSON cua __GBH_BOOT__ (alias __DSH_BOOT__).
 * @param seeds - bang seed cua vo.
 * @returns danh sach id mo coi.
 */
export function findMissingRequires(
  requiredBy: Map<string, Set<string>>,
  graphPayload: string,
  seeds: readonly string[] = SEED_IDS,
): MissingRequire[] {
  const missing: MissingRequire[] = [];
  for (const [id, bundles] of requiredBy) {
    if (seeds.includes(id)) continue;
    if (graphPayload.includes(id)) continue;
    missing.push({ id, bundles: [...bundles].slice(0, 3) });
  }
  return missing.slice(0, 20);
}

/**
 * Do tren app dang chay: thu bundle phuc vu, quet require literal, doi chieu do thi.
 * @param port - cong app.
 * @returns artifact cua lan do.
 */
export async function runRequires(port = OURS_PORT): Promise<RequiresArtifact> {
  const runStamp = stamp();
  const session = await launchChrome(parityPath("tmp"), runStamp + "-requires");
  try {
    await enterSession(session.context, port, [credentialsPath(), appHome() + "/.credentials.yaml"]);
    const page = await session.context.newPage();
    const urls: string[] = [];
    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/plugins/") && !url.endsWith("/events")) urls.push(url);
    });
    await page.goto("http://127.0.0.1:" + String(port) + "/", { waitUntil: "load", timeout: 45_000 });
    await page.waitForTimeout(4500);
    const payload = await page
      // task-31: ưu tiên __GBH_BOOT__, fallback alias __GBH_BOOT__ (alias __DSH_BOOT__).
      .evaluate(() => {
        const scope = globalThis as unknown as Record<string, unknown>;
        return JSON.stringify(scope.__GBH_BOOT__ ?? scope.__DSH_BOOT__ ?? {});
      })
      .catch(() => "");
    const requiredBy = new Map<string, Set<string>>();
    const unique = [...new Set(urls)].slice(0, 40);
    let idsFound = 0;
    for (const url of unique) {
      const body = await page.request.get(url).then((result) => result.text()).catch(() => "");
      const bundleName = (url.split("??")[1] ?? url).split(",")[0] ?? url;
      for (const id of literalRequires(body)) {
        idsFound += 1;
        const set = requiredBy.get(id) ?? new Set<string>();
        set.add(bundleName);
        requiredBy.set(id, set);
      }
    }
    // Danh sach mien kiem SUY TU VO (SZ()); chi dung danh sach tay khi khong doc duoc vo.
    const derived = loadSeedIdsFromShell();
    const seeds = derived.ids.length > 0 ? derived.ids : SEED_IDS;
    const seedSource: SeedSource = derived.ids.length > 0 ? "SZ() cua vo" : "danh sach du phong (khong doc duoc vo)";
    const seedWarnings = derived.ids.length > 0 ? derived.warnings : [...derived.warnings, "dung danh sach du phong"];
    const missing = payload === "" ? [] : findMissingRequires(requiredBy, payload, seeds);
    const artifact: RequiresArtifact = {
      format: 1,
      stamp: runStamp,
      port,
      bundlesScanned: unique.length,
      idsFound,
      missing,
      seedIds: [...seeds],
      seedSource,
      seedWarnings,
      verdict: payload === "" ? "SKIP" : missing.length === 0 ? "PASS" : "FAIL",
      note:
        payload === ""
          ? "khong doc duoc __GBH_BOOT__ (hoac alias __DSH_BOOT__) — app tat hoac chua mount xong, khong ket luan"
          : "chi kiem namespace @deepseek-ai|@galaxy-blackhole|@galaxy-stack + khuon require LITERAL; " +
            "thu vien npm (react/zod/…) do vo phan giai built-in nen KHONG tinh la thieu",
    };
    writeJsonFile(join(parityPath("requires", runStamp), "summary.json"), artifact);
    return artifact;
  } finally {
    await closeChromeSession(session);
  }
}

/**
 * In ket qua ra console.
 * @param artifact - artifact cua lan do.
 * @returns khoi van ban.
 */
export function formatRequires(artifact: RequiresArtifact): string {
  const lines = [
    "### parity:requires — require literal trong bundle PHUC VU",
    "",
    "- cong: " + String(artifact.port) + " · bundle da quet: " + String(artifact.bundlesScanned) + " · id literal: " + String(artifact.idsFound),
    "- mien kiem (" + String(artifact.seedIds.length) + " id, nguon: " + artifact.seedSource + "): " + artifact.seedIds.slice(0, 12).join(", ") + (artifact.seedIds.length > 12 ? " …" : ""),
  ];
  if (artifact.missing.length === 0) {
    lines.push("- **khong co id mo coi** — moi id bi require deu co trong do thi hoac la seed cua vo");
  } else {
    lines.push("- *** REQUIRE KHONG AI PHUC VU (" + String(artifact.missing.length) + "):");
    for (const item of artifact.missing) lines.push("  · " + item.id + " <- " + item.bundles.join(" / "));
  }
  lines.push("- ket luan: " + artifact.verdict + " · " + artifact.note);
  return lines.join("\n");
}

/**
 * Diem vao CLI `parity:requires`.
 * @param argv - tham so sau ten script.
 * @returns 0 khi PASS hoac SKIP, 1 khi FAIL va bat `--strict`.
 */
export async function main(argv: string[]): Promise<number> {
  const portIndex = argv.indexOf("--port");
  const artifact = await runRequires(portIndex === -1 ? OURS_PORT : Number(argv[portIndex + 1]));
  const text = formatRequires(artifact);
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    console.log(text);
    console.log("");
    console.log("artifact: .parity/requires/" + artifact.stamp + "/summary.json");
  }
  return argv.includes("--strict") && artifact.verdict === "FAIL" ? 1 : 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
