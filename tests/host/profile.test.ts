/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026 — 3 row (ui-settings-general · llm-pi-ai · subagent-model-selection-settings) da
 *      CHUYEN XUONG LOP BUNDLE: ca "oracle semantics" doi sang kiem overlay KHONG ghim lai + co mat o lop bundle.
 *      11/11/2026 (tiep): khoa HANH VI row subagent-model-selection-settings — metadata khai ownedByBundle thi
 *      app patch KHONG duoc sinh 'disable + insert', va lop bundle phai mang config (enabled + allowedModels).
 * desc Test profile/patch cua app: cordis.yml luon la [], patch ghim credentials + ngu nghia oracle (M1a)
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { APP_PROFILE_BUNDLES, DEFAULT_FEATURE_BUNDLES, bundleDefinedNames, ensureProfile, expandTildeInScalars, selectBrandBlock, writeAppPatch } from "../../apps/cli/src/profile.ts";
import { parseGbhMetadata } from "../../apps/cli/src/rewrite-metadata.ts";
import { appPatchPath, credentialsPath, dshManifestPath, profileTemplateDir, repoAppPatchPath, repoRoot } from "../../apps/cli/src/paths.ts";
import { harnessVersion } from "../../apps/cli/src/runtime.ts";

const originalHome = process.env.GBH_HOME;
const originalCredentials = process.env.GBH_CREDENTIALS;
/** Nội dung thật của bản patch trong repo, để trả lại sau mỗi test (test ghi bằng đường dẫn sandbox). */
const originalRepoPatch = ((): string | undefined => {
  try {
    return readFileSync(repoAppPatchPath(), "utf8");
  } catch {
    return undefined;
  }
})();
let sandbox = "";

/** Manifest cua LOP BUNDLE (`packages/host/bundle`) — khai thu tu cac tep patch cua lop do. */
const BUNDLE_MANIFEST = join(repoRoot(), "packages", "host", "bundle", "package.json");

/**
 * Gop van ban cua MOI tep patch o LOP BUNDLE, theo dung thu tu `dsh.bundle.patch` cua manifest.
 * Vi sao can: tu 11/11/2026 ba row tinh nang duoc khai o LOP BUNDLE (khong ghim o overlay) — ghim o overlay
 * (lop CUOI) thi moi luot ghi vao namespace cua row do bi Host tu choi
 * `settings/rejected: overridden by a home patch`, nguoi dung khong luu duoc cau hinh.
 * @returns patch cua lop bundle noi lai; chuoi rong khi checkout thieu lop nay (fail-soft).
 */
function bundleLayerPatches(): string {
  try {
    const meta = JSON.parse(readFileSync(BUNDLE_MANIFEST, "utf8")) as { dsh?: { bundle?: { patch?: unknown } } };
    const files = Array.isArray(meta.dsh?.bundle?.patch) ? (meta.dsh?.bundle?.patch as unknown[]).map(String) : [];
    const dir = dirname(BUNDLE_MANIFEST);
    return files.map((file) => readFileSync(join(dir, file), "utf8")).join("\n");
  } catch {
    return "";
  }
}

/**
 * Strips YAML comments so the remaining document can be asserted literally.
 * @param text - file contents.
 * @returns the document with every full-line comment removed.
 */
function yamlBody(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")
    .trim();
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "gbh-profile-"));
  process.env.GBH_HOME = join(sandbox, "home");
  process.env.GBH_CREDENTIALS = join(sandbox, "credentials.yaml");
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.GBH_HOME;
  else process.env.GBH_HOME = originalHome;
  if (originalCredentials === undefined) delete process.env.GBH_CREDENTIALS;
  else process.env.GBH_CREDENTIALS = originalCredentials;
  if (originalRepoPatch !== undefined) writeFileSync(repoAppPatchPath(), originalRepoPatch);
  rmSync(sandbox, { recursive: true, force: true });
});

describe("profile root", () => {
  test("template cordis.yml is the empty entry list", () => {
    expect(yamlBody(readFileSync(join(profileTemplateDir(), "cordis.yml"), "utf8"))).toBe("[]");
  });

  test("template cordis.patch.yml is an empty user layer (parity: oracle has no locale row)", () => {
    const body = yamlBody(readFileSync(join(profileTemplateDir(), "cordis.patch.yml"), "utf8"));
    expect(body).toBe("[]");
  });

  test("ensureProfile seeds a profile whose cordis.yml parses to [] and whose bundles mirror the app", () => {
    const seed = ensureProfile();
    expect(seed.created).toContain("cordis.yml");
    expect(seed.created).toContain("cordis.patch.yml");
    expect(seed.created).toContain("package.json");
    expect(yamlBody(readFileSync(join(seed.dir, "cordis.yml"), "utf8"))).toBe("[]");
    // 25/10/2026 (ADR 0026) — hồ sơ MỚI nhận thêm bundle tính năng để tắt được thật.
    expect(seed.bundles).toEqual([...APP_PROFILE_BUNDLES, ...DEFAULT_FEATURE_BUNDLES]);
    const manifest = JSON.parse(readFileSync(join(seed.dir, "package.json"), "utf8")) as {
      dsh: { profile: { bundles: string[] } };
    };
    expect(manifest.dsh.profile.bundles).toEqual([...APP_PROFILE_BUNDLES, ...DEFAULT_FEATURE_BUNDLES]);
  });

  test("a second boot reuses the seeded files instead of rewriting them", () => {
    ensureProfile();
    const second = ensureProfile();
    expect(second.created).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.reused).toContain("cordis.yml");
    expect(second.reused).toContain("cordis.patch.yml");
  });

  test("a drifted bundle list is reconciled with this build's intent", () => {
    const seed = ensureProfile();
    writeFileSync(
      join(seed.dir, "package.json"),
      JSON.stringify({ name: "hand-edited", custom: 7, dsh: { profile: { bundles: ["@deepseek-ai/dsh-base"] } } }),
    );
    const third = ensureProfile();
    expect(third.updated).toContain("package.json");
    const manifest = JSON.parse(readFileSync(join(seed.dir, "package.json"), "utf8")) as {
      custom: number;
      dsh: { profile: { bundles: string[] } };
    };
    // Hồ sơ ĐÃ TỒN TẠI: chỉ reconcile về danh sách lõi, KHÔNG thêm lại bundle tính năng (ADR 0026).
    expect(manifest.dsh.profile.bundles).toEqual([...APP_PROFILE_BUNDLES]);
    expect(manifest.custom).toBe(7);
  });
});

describe("app patch (M1a)", () => {
  test("pins the shared credentials document and never leaks a secret value", () => {
    writeFileSync(credentialsPath(), "deepseek:\n  apiKey: sk-live-DEADBEEFDEADBEEF0123\n");
    const file = writeAppPatch();
    expect(file).toBe(appPatchPath());
    const text = readFileSync(file, "utf8");
    expect(text).toContain(`path: ${JSON.stringify(credentialsPath())}`);
    expect(text).toContain("- id: credentials");
    expect(text).not.toContain("sk-live-DEADBEEFDEADBEEF0123");
    expect(text.toLowerCase()).not.toContain("apikey:");
    expect(text.split("\n").slice(0, 5).join("\n")).toContain("author Bùi Trọng Hiếu");
  });

  test("carries the oracle semantics: provider auto, brand, telemetry, feedback", () => {
    writeAppPatch({ brand: true });
    const body = yamlBody(readFileSync(appPatchPath(), "utf8"));
    for (const id of [
      "agent-default-model",
      "llm-deepseek",
      "web",
      "session-log-deepseek",
      "session-telemetry-otel",
      "command-feedback",
      "ui-message-feedback",
      "credentials",
    ]) {
      expect(body).toContain(`- id: ${id}`);
    }
    // ⚠️ 11/11/2026 — BA ROW BI BO KHOI OVERLAY (thay doi CO CHU DICH, khong phai hoi quy); ROW van duoc LOP
    //   BUNDLE khai: `ui-settings-general` + `subagent-model-selection-settings` ⇒ bundle/web-app.patch.yml,
    //   `llm-pi-ai` ⇒ bundle/cordis.patch.yml.
    //   VI SAO: overlay `app.patch.yml` la lop CUOI; ghim row o do thi moi luot ghi vao namespace cua row bi Host
    //   tu choi `settings/rejected: overridden by a home patch` (do tren app 5439 ngay 11/11/2026) ⇒ nguoi dung
    //   khong luu duoc cau hinh. Ha xuong lop bundle thi row van chay, con cau hinh nguoi dung ghi duoc.
    //   DA SUA 11/11/2026 (ca test rieng o duoi): `llm-pi-ai` mang config provider trong
    //   `packages/host/bundle/cordis.patch.yml`; `subagent-model-selection-settings` nam trong
    //   `packages/host/bundle/web-app.patch.yml` voi GOI RIENG cua no + `config` day du, con metadata cua goi
    //   khai `gbh.row.ownedByBundle: true` nen `bh host` KHONG con sinh khoi `disable + insert <id>-ours`.
    //   Danh sach duoi day kiem ROW; ca test `row … KHONG bi ghim` kiem ca CONFIG.
    //   ⇒ CA HAI CHIEU: overlay KHONG duoc ghim lai (ai them lai ⇒ ca nay DO), va row PHAI co mat o lop bundle.
    const bundleLayer = bundleLayerPatches();
    expect(bundleLayer.length).toBeGreaterThan(0);
    for (const id of ["ui-settings-general", "llm-pi-ai", "subagent-model-selection-settings"]) {
      expect(body).not.toContain(`- id: ${id}`);
      expect(bundleLayer).toContain(`- id: ${id}`);
    }
    // 26/10/2026 (Option A): app patch KHONG con tat web-search-deepseek - hang do da duoc bundle loi tro sang
    // provider auto cua ta (packages/host/web-search-ollama) va la namespace mo form Web search tren trang Plugin.
    expect(body).not.toContain("- id: web-search-deepseek");
    // 11/11/2026 — TUYEN PROVIDER KHONG CON GHIM O OVERLAY (cung ly do "overridden by a home patch"): khoi
    //   `llm-pi-ai` cu (baseURL https://ollama.com/v1 + apiKeyEnv GBH_GALAXY_API_KEY) da bi BO khoi template
    //   ⇒ hong hai `assert toContain` cu. Nay section `llm-pi-ai:` do TAI LIEU CAI DAT cua nguoi dung so huu
    //   (trang Cai dat -> Models ghi), row `llm-pi-ai` do LOP BUNDLE mount (assert o tren).
    //   ⚠️ DO LAI 11/11/2026: config provider (baseURL/apiKeyEnv/providers) hien KHONG con o lop patch nao
    //   trong repo ⇒ truoc khi boot lai app phai chac tai lieu cai dat da co section `llm-pi-ai:`, neu khong
    //   route `auto` se khong co provider (day la viec RIENG, ngoai pham vi ca test nay).
    //   ⇒ Doi chieu NGUOC lai cho co rang: overlay KHONG duoc ghim lai provider/baseURL/apiKeyEnv (ai them lai
    //   thi ca nay DO, va tren app that se tai hien dung loi `settings/rejected` cua ngay 11/11/2026).
    expect(body).not.toContain("https://ollama.com/v1");
    expect(body).not.toContain("apiKeyEnv");
    expect(body).not.toContain("providers:");
    // Nghia san pham con lai cua test nay van phai giu: tuyen mac dinh la route `auto`, dung model Galaxy.
    expect(body).toContain("provider: auto");
    expect(body).toContain("deepseek-v4.1-flash");
    expect(body).toContain("mode: DISABLED");
    // KHONG con assert khoi brand o day: tu task-17 (17/10/2026) khoi `brand-galaxy` da BI XOA khoi
    // template, va row brand do METADATA cua package sinh ra (ADR 0004 §11). Assert cu doi template
    // chua `ui-brand-official` + ten package cu `@galaxy-stack/gbh-brand` => test do oan tu do.
  });
  // 11/11/2026 — KHOA HANH VI cua row `subagent-model-selection-settings` (loi that tren app 5439).
  // Loi: metadata `gbh.row.config` cua goi sinh khoi "disable + insert <id>-ours" trong overlay `app.patch.yml`
  // MOI luot boot. Overlay la lop CUOI nen (1) config nguoi dung ghi vao tai lieu cai dat bi nuot ⇒ cong tac
  // "Dung dung model chinh" tra `settings/rejected: overridden by a home patch`, (2) id row lech thanh
  // `<id>-ours` nen namespace Settings cua the <id> khong co entry nao de ghi.
  // Cach sua dung goc: row do LOP BUNDLE cam bang GOI RIENG cua no (khop CHUOI voi `bundleDefinedNames()`),
  // mang `config` ngay o lop bundle, va metadata khai `ownedByBundle` de overlay khong sinh khoi nao.
  test("row subagent-model-selection-settings KHONG bi ghim o overlay va mang config o lop bundle", () => {
    const pkgDir = join(repoRoot(), "packages", "host", "subagent-model-selection-settings");
    const metadata = parseGbhMetadata(readFileSync(join(pkgDir, "package.json"), "utf8"));
    expect(metadata?.row?.id).toBe("subagent-model-selection-settings");
    // (a) Metadata: row do bundle cam ⇒ `renderRewriteBlock` tra chuoi rong. `config` PHAI vang o metadata:
    //     de o ca hai noi la hai nguon su that, sua mot ben la ben kia im lang sai.
    expect(metadata?.row?.ownedByBundle).toBe(true);
    expect(metadata?.row?.config).toBeUndefined();
    // (b) Lop bundle: row + GOI RIENG + config day du (bat + danh sach tuyen). Thieu `allowedModels` ⇒
    //     `current()` nem "enabled subagent model selection requires at least one allowed model" moi luot soan Session.
    const bundleLayer = bundleLayerPatches();
    expect(bundleLayer.length).toBeGreaterThan(0);
    expect(bundleLayer).toContain("- id: subagent-model-selection-settings");
    expect(bundleLayer).toContain("name: '@galaxy-blackhole/gbh-subagent-model-selection-settings'");
    const khoi = bundleLayer.slice(bundleLayer.indexOf("- id: subagent-model-selection-settings"));
    expect(khoi).toMatch(/^\s+config:$/mu);
    expect(khoi).toMatch(/^\s+enabled: true$/mu);
    expect(khoi).toMatch(/^\s+- provider: auto$/mu);
    expect(khoi).toMatch(/^\s+model: deepseek-v4\.1-flash$/mu);
    // (c) Duong loc THU HAI, doc lap voi co metadata: specifier phai CO trong bundle patch nen
    //     `bundleDefinedNames()` nhan ra no (day moi la thu da hong: bundle tro vao SUBPATH cua goi khac).
    expect(bundleDefinedNames().has("@galaxy-blackhole/gbh-subagent-model-selection-settings")).toBe(true);
    // (d) Do that tren duong sinh patch THAT (mount kem metadata THAT): overlay khong duoc co dong nao cua row.
    writeAppPatch({
      rewrites: [
        {
          specifier: "@galaxy-blackhole/gbh-subagent-model-selection-settings",
          dir: pkgDir,
          built: false,
          peers: [],
          ok: true,
          ...(metadata?.row === undefined ? {} : { row: metadata.row }),
        },
      ],
    });
    const body = yamlBody(readFileSync(appPatchPath(), "utf8"));
    expect(body).not.toContain("- id: subagent-model-selection-settings");
    expect(body).not.toContain("subagent-model-selection-settings-ours");
    expect(body).not.toContain("@galaxy-blackhole/gbh-subagent-model-selection-settings");
    // Doi chung DUONG: overlay van phai sinh khoi cho mot goi KHONG do bundle cam — neu khong, ca nay
    // "dat" mot cach vo nghia (vd ai do lam hong duong loc `trongBundle`).
    writeAppPatch({
      rewrites: [{ specifier: "@galaxy-blackhole/gbh-khong-co-trong-bundle", dir: pkgDir, built: false, peers: [], ok: true, row: { id: "row-thu-nghiem", insertAs: "row-thu-nghiem-ours" } }],
    });
    expect(yamlBody(readFileSync(appPatchPath(), "utf8"))).toContain("- id: row-thu-nghiem");
  });


  test("khoi brand do METADATA cua package sinh ra, khong phai tu template", () => {
    writeAppPatch({
      rewrites: [
        {
          specifier: "@galaxy-blackhole/gbh-brand",
          dir: "/tmp/gbh-brand",
          built: false,
          peers: [],
          ok: true,
          row: { id: "ui-brand-official", insertAs: "gbh-brand" },
        },
      ],
    });
    const body = yamlBody(readFileSync(appPatchPath(), "utf8"));
    expect(body).toContain("- id: ui-brand-official");
    expect(body).toContain("- id: gbh-brand");
    expect(body).toContain("name: '@galaxy-blackhole/gbh-brand'");
    // Template KHONG con mang khoi brand: neu ai do them lai, phep thu nay se bat.
    expect(yamlBody(readFileSync(repoAppPatchPath(), "utf8"))).not.toContain("brand-galaxy:");
  });

  test("drops the brand block when the brand package is not mounted", () => {
    writeAppPatch({ brand: false });
    const body = yamlBody(readFileSync(appPatchPath(), "utf8"));
    expect(body).not.toContain("gbh-brand");
    expect(body).not.toContain("ui-brand-official");
    expect(body).toContain("- id: agent-default-model");
    expect(body).toContain("- id: credentials");
  });

  test("selectBrandBlock keeps or removes exactly the marked block", () => {
    const template = ["before", "# >>> brand-galaxy", "inside", "# <<< brand-galaxy", "after"].join("\n");
    expect(selectBrandBlock(template, true).split("\n")).toEqual(["before", "inside", "after"]);
    expect(selectBrandBlock(template, false).split("\n")).toEqual(["before", "after"]);
  });

  test("never writes the repo copy when the app home is overridden (test sandbox)", () => {
    const before = existsSync(repoAppPatchPath()) ? readFileSync(repoAppPatchPath(), "utf8") : undefined;
    writeAppPatch({ brand: true, rewrites: [{ specifier: "@galaxy-blackhole/gbh-host-webserver", dir: "/tmp/x", built: false, peers: [], ok: true, row: { id: "webserver" } }] });
    const after = existsSync(repoAppPatchPath()) ? readFileSync(repoAppPatchPath(), "utf8") : undefined;
    expect(after).toBe(before);
    // 21/10/2026 (task-195): row webserver nay do BUNDLE cua ta dinh nghia (id stock) nen app.patch khong con khoi
    // rieng cho no; kiem bang dau hieu LUON co trong patch cua app (khoi config cua parity template).
    // 21/10/2026 (task-195): bundle-native ⇒ app.patch KHONG con row "<id>-ours" nao.
    expect(readFileSync(appPatchPath(), "utf8")).not.toContain("-ours");
  });

  test("portable template scalars expand to the machine's home", () => {
    const expanded = expandTildeInScalars('- id: credentials\n  config:\n    path: "~/.galaxy/credentials.yaml"\n', "/Users/example");
    expect(expanded).toContain("path: \"/Users/example/.galaxy/credentials.yaml\"");
  });
});

describe("brand mount", () => {
});

describe("pinned runtime", () => {
  test("every dependency of apps/host carries the same harness version", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot(), "apps", "host", "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const versions = [...new Set(Object.values(manifest.dependencies))];
    expect(versions).toHaveLength(1);
  });

  test("the installed runtime equals the pin — a mixed tree is a parity bug", () => {
    const manifest = JSON.parse(readFileSync(join(repoRoot(), "apps", "host", "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    const installed = harnessVersion();
    if (installed === undefined) {
      console.warn(`skipped: ${dshManifestPath()} not installed — run: bun run host:install`);
      return;
    }
    const pinned = manifest.dependencies["@deepseek-ai/dsh"] ?? "";
    expect(pinned).not.toBe("");
    expect(installed).toBe(pinned);
    if (!existsSync(join(profileTemplateDir(), "parity.patch.yml"))) console.warn("thieu parity.patch.yml");
  });
});

