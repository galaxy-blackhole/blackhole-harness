/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc parity:surface — quet BAN DANG PHUC VU tim ctx.<service>.<prop>, doi chieu voi be mat service cua goi ta
 */

import { join } from "node:path";

import { relativeToRepo, writeJsonFile, writeTextFile } from "./lib/artifacts.ts";
import { closeChromeSession, launchChrome } from "./lib/browser.ts";
import { OURS_PORT, appHome, credentialsPath, parityPath, stamp } from "./lib/paths.ts";
import { enterSession } from "./lib/session-entry.ts";

/** Nhu cau cua consumer: service nao bi doc thuoc tinh nao. */
export interface ServiceDemand {
  /** Ten service (thuoc tinh tren ctx). */
  service: string;
  /** Cac thuoc tinh consumer doc, kem so lan. */
  props: { prop: string; count: number }[];
  /** Bundle nao doc. */
  bundles: string[];
}

/** Artifact cua mot lan parity:surface. */
export interface SurfaceArtifact {
  /** Phien ban dinh dang. */
  format: number;
  /** Dau thoi gian. */
  stamp: string;
  /** Cong da do. */
  port: number;
  /** So bundle da quet. */
  bundlesScanned: number;
  /** Nhu cau theo service, sap theo so thuoc tinh giam dan. */
  demand: ServiceDemand[];
  /** Ghi chu ve do tin cay. */
  note: string;
}

/**
 * Rut moi truy cap dang ctx.<service>.<prop> trong mot bundle.
 * CO Y chi bat khuon literal hai tang — khuon dong (ctx[a][b]) khong doan duoc va se bao dong gia.
 * @param code - noi dung bundle dang phuc vu.
 * @returns ban do service -> prop -> so lan.
 */
export function ctxPropertyAccess(code: string): Map<string, Map<string, number>> {
  const found = new Map<string, Map<string, number>>();
  for (const match of code.matchAll(/ctx\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/gu)) {
    const service = match[1] ?? "";
    const prop = match[2] ?? "";
    if (service === "" || prop === "") continue;
    const props = found.get(service) ?? new Map<string, number>();
    props.set(prop, (props.get(prop) ?? 0) + 1);
    found.set(service, props);
  }
  return found;
}

/**
 * Do tren app dang chay: thu bundle PHUC VU, rut nhu cau ctx.<service>.<prop>.
 * @param port - cong app.
 * @returns artifact cua lan do.
 */
export async function runSurface(port = OURS_PORT): Promise<SurfaceArtifact> {
  const runStamp = stamp();
  const session = await launchChrome(parityPath("tmp"), runStamp + "-surface");
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
    const demand = new Map<string, { props: Map<string, number>; bundles: Set<string> }>();
    const unique = [...new Set(urls)].slice(0, 40);
    for (const url of unique) {
      const body = await page.request.get(url).then((result) => result.text()).catch(() => "");
      const bundle = (url.split("??")[1] ?? url).split(",")[0] ?? url;
      for (const [service, props] of ctxPropertyAccess(body)) {
        const entry = demand.get(service) ?? { props: new Map<string, number>(), bundles: new Set<string>() };
        entry.bundles.add(bundle);
        for (const [prop, count] of props) entry.props.set(prop, (entry.props.get(prop) ?? 0) + count);
        demand.set(service, entry);
      }
    }
    const rows: ServiceDemand[] = [...demand.entries()]
      .map(([service, entry]) => ({
        service,
        props: [...entry.props.entries()].map(([prop, count]) => ({ prop, count })).sort((left, right) => right.count - left.count),
        bundles: [...entry.bundles].slice(0, 3),
      }))
      .sort((left, right) => right.props.length - left.props.length);
    const artifact: SurfaceArtifact = {
      format: 1,
      stamp: runStamp,
      port,
      bundlesScanned: unique.length,
      demand: rows,
      note:
        "quet BAN DANG PHUC VU (khong phai ban tren dia) · chi bat khuon literal ctx.service.prop · " +
        "khuon dong khong thay · day la NHU CAU cua consumer; doi chieu voi be mat do goi ta provide la buoc sau",
    };
    writeJsonFile(join(parityPath("surface", runStamp), "summary.json"), artifact);
    return artifact;
  } finally {
    await closeChromeSession(session);
  }
}

/**
 * In ket qua ra console, gom theo service.
 * @param artifact - artifact cua lan do.
 * @returns khoi van ban.
 */
export function formatSurface(artifact: SurfaceArtifact): string {
  const lines = [
    "### parity:surface — nhu cau doc tu BAN DANG PHUC VU",
    "",
    "- cong " + String(artifact.port) + " · bundle quet: " + String(artifact.bundlesScanned) + " · so service bi doc: " + String(artifact.demand.length),
  ];
  for (const row of artifact.demand.slice(0, 12)) {
    lines.push(
      "- " + row.service + ": " + String(row.props.length) + " thuoc tinh — " +
        row.props.slice(0, 8).map((p) => p.prop + "×" + String(p.count)).join(", ") +
        (row.bundles.length > 0 ? "   [" + row.bundles[0] + "]" : ""),
    );
  }
  lines.push("- ghi chu: " + artifact.note);
  return lines.join("\n");
}

/**
 * Diem vao CLI parity:surface.
 * @param argv - tham so sau ten script.
 * @returns 0 khi chay xong.
 */
export async function main(argv: string[]): Promise<number> {
  const portIndex = argv.indexOf("--port");
  const artifact = await runSurface(portIndex === -1 ? OURS_PORT : Number(argv[portIndex + 1]));
  if (argv.includes("--json")) {
    console.log(JSON.stringify(artifact, null, 2));
  } else {
    console.log(formatSurface(artifact));
    console.log("");
    console.log("artifact: " + relativeToRepo(join(parityPath("surface", artifact.stamp), "summary.json")));
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
