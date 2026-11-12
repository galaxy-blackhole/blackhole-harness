/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Test cho PHEP KIEM AN TOAN-BOOT trong tools/check/rows.ts: dem + phan giai id module,
 *      luat id stock, va phep thu tren TOAN BO goi dang chay that (khong duoc bao do oan)
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname } from "node:path";
import {
  clientBuildIssues,
  crossRowDuplicateIssues,
  danglingInjectIssues,
  declaredIdsByPackage,
  replacedRows,
  stockInjectors,
  mountArtifactIssues,
  mountRoot,
  moduleIdIssues,
  missingServiceProperties,
  moduleRegistrations,
  patchScalarIssues,
  readRunningPatch,
  resolveBundleConstant,
  rowDisabledInPatch,
  rowPackages,
} from "../../tools/check/rows";

/** Gốc repo (tests/host → ../..). */
const REPO = join(import.meta.dir, "..", "..");

/** Id của ta và id stock dùng trong fixture. */
const OURS = "@galaxy-blackhole/gbh-client-demo";
const STOCK = "@deepseek-ai/dsh-client-demo";

/** Fixture patch: row `demo` bị tắt, row `other` còn bật. */
const PATCH = [
  "# patch gia",
  "- id: demo",
  "  disabled: true",
  "",
  "- insert:",
  "    - id: demo-ours",
  "",
  "- id: other",
  "  config:",
  "    value: 1",
  "",
].join("\n");

describe("phép kiểm an toàn-boot — đọc lời gọi đăng ký", () => {
  test("ca 1: nhận CẢ BỐN khuôn đăng ký đang dùng trong repo", () => {
    // (1) window.__ModuleLoader__.load — kiểu ui-skill
    expect(moduleRegistrations('window.__ModuleLoader__.load({ id: "@x/y", factory: f });')).toEqual([
      { expression: '"@x/y"', id: "@x/y" },
    ]);
    // (2) alias đối tượng + hằng — kiểu shortcuts/locale/connection
    const objectAlias = 'var loader = globalThis.__ModuleLoader__;\nvar PACKAGE_NAME = "' + OURS + '";\nloader.load({ id: PACKAGE_NAME, factory: f });';
    expect(moduleRegistrations(objectAlias)).toEqual([{ expression: "PACKAGE_NAME", id: OURS }]);
    // (3) alias PHƯƠNG THỨC — kiểu ui-jobs
    const methodAlias = 'var register = globalThis.__ModuleLoader__.load;\nregister({ id: "' + OURS + '", factory: f });';
    expect(moduleRegistrations(methodAlias)).toEqual([{ expression: '"' + OURS + '"', id: OURS }]);
    // (4) hai id literal — kiểu ui-sidebar / ui-settings-session-log
    const twoIds = 'loader.load({ id: "' + OURS + '", factory: f });\nloader.load({ id: "' + STOCK + '", factory: f });';
    expect(moduleRegistrations(twoIds).map((r) => r.id)).toEqual([OURS, STOCK]);
    // (5) factory viết tắt vẫn nhận (kèm khai alias phương thức như ui-jobs thật)
    const shorthand = 'var register = globalThis.__ModuleLoader__.load;\nregister({ id: "' + OURS + '", factory });';
    expect(moduleRegistrations(shorthand).map((r) => r.id)).toEqual([OURS]);
  });

  test("ca 2: KHÔNG đọc nhầm — require seed và register của slot không phải id module", () => {
    const noise = [
      'var loader = globalThis.__ModuleLoader__;',
      'loader.load({ id: "' + OURS + '", factory: f });',
      // require seed: chuỗi @deepseek-ai/** trong THÂN bundle là HỢP LỆ
      'var store = require("@deepseek-ai/dsh-client-store");',
      'var primitives = require("@deepseek-ai/dsh-client-ui-primitives");',
      // register của SLOT: có id nhưng KHÔNG có factory
      'ctx.slots.register({ name: "jobs.item", id: "job-list", order: 1 }, Component);',
    ].join("\n");
    expect(moduleRegistrations(noise)).toEqual([{ expression: '"' + OURS + '"', id: OURS }]);
  });

  test("ca 3: phân giải hằng trong artifact + đọc patch", () => {
    expect(resolveBundleConstant('var PACKAGE_NAME = "' + OURS + '";', "PACKAGE_NAME")).toBe(OURS);
    expect(resolveBundleConstant("const NAME = '" + OURS + "';", "NAME")).toBe(OURS);
    expect(resolveBundleConstant("var X = 5;", "X")).toBeUndefined();
    expect(rowDisabledInPatch(PATCH, "demo")).toBe(true);
    expect(rowDisabledInPatch(PATCH, "other")).toBe(false);
    expect(rowDisabledInPatch(PATCH, "khong-co")).toBe(false);
  });
});

describe("phép kiểm an toàn-boot — phán quyết", () => {
  /** Dựng input cho {@link moduleIdIssues} với mặc định sạch. */
  const input = (over: Partial<Parameters<typeof moduleIdIssues>[0]> = {}): Parameters<typeof moduleIdIssues>[0] => ({
    pkg: OURS,
    code: 'var loader = globalThis.__ModuleLoader__;\nloader.load({ id: "' + OURS + '", factory: f });',
    declared: [OURS],
    aliases: [],
    stockIds: [STOCK],
    stockRowDisabled: true,
    ...over,
  });

  test("ca 4: gói đúng thì im lặng", () => {
    expect(moduleIdIssues(input())).toEqual([]);
  });

  test("ca 5: id lạ (không khai) ⇒ CHẶN", () => {
    const issues = moduleIdIssues(input({ code: 'loader.load({ id: "job-list", factory: f });' }));
    // Hai lý do chặn: id không khai trong moduleIds/aliases, VÀ id đầu khác gbh.row.moduleIds[0].
    expect(issues.filter((i) => i.level === "chan").length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.detail.includes("job-list"))).toBe(true);
  });

  test("ca 6: id stock + row gốc CÒN BẬT ⇒ CHẶN, dù có khai hay không (luật theo TRẠNG THÁI)", () => {
    const code = 'loader.load({ id: "' + OURS + '", factory: f });\nloader.load({ id: "' + STOCK + '", factory: f });';
    // Kiến trúc thật là DISABLE + INSERT (ADR 0004 §2): row gốc BỊ TẮT rồi ta insert row của ta. Nên nếu
    // row gốc CÒN BẬT mà bundle vẫn đăng ký id gốc ⇒ trùng đăng ký thật, KHAI BÁO KHÔNG CỨU ĐƯỢC.
    // (Bài học 17/10/2026: tôi từng đọc app.patch.yml giữa lúc nó được sinh lại, thấy "row gốc không còn bị
    // tắt" và đổi luật sang xét-theo-khai-báo — sai, vì đầu vào là trạng thái tạm.)
    for (const declaredCase of [[OURS], [OURS, STOCK]] as const) {
      const blocked = moduleIdIssues(input({ code, declared: [...declaredCase], stockRowDisabled: false }));
      // Luat mot-id da BAT LAI CHAN (17/10/2026, sau khi phep dem tren artifact = 0 goi).
      const chans = blocked.filter((i) => i.level === "chan");
      expect(chans.some((i) => i.detail.includes("dung 1"))).toBe(true);
    }
  });

  test("ca 7: id stock + row gốc ĐÃ TẮT + đã khai ⇒ không báo gì (ui-sidebar/ui-jobs đang chạy tốt)", () => {
    const code = 'loader.load({ id: "' + OURS + '", factory: f });\nloader.load({ id: "' + STOCK + '", factory: f });';
    // LUAT MOT-ID: code o day dang ky 2 id nen LUON co chan (dung 1 id) — do la chu y cua luat moi.
    const single = 'loader.load({ id: "' + OURS + '", factory: f });';
    expect(moduleIdIssues(input({ code: single, declared: [OURS], aliases: [STOCK], stockRowDisabled: true }))).toEqual([]);
    expect(moduleIdIssues(input({ code: single, declared: [OURS, STOCK], aliases: [STOCK], stockRowDisabled: true })).some((i) => i.detail.includes("moduleIds chua id cua goi GOC"))).toBe(true);
  });

  test("ca 8: id stock + row gốc đã tắt nhưng KHÔNG khai ⇒ chỉ CẢNH BÁO", () => {
    const code = 'loader.load({ id: "' + OURS + '", factory: f });\nloader.load({ id: "' + STOCK + '", factory: f });';
    // Voi LUAT MOT-ID, ca "row goc da tat + khong khai" duoc kiem tren bundle CHI dang ky id cua ta:
    // khi do khong con dang ky id goc nua nen luat id-stock khong ap; dieu con lai phai kiem la
    // "khong co chan nao khac" (khong bao oan).
    const single = 'loader.load({ id: "' + OURS + '", factory: f });';
    const issues = moduleIdIssues(input({ code: single, declared: [OURS], stockRowDisabled: true }));
    expect(issues.filter((i) => i.level === "chan")).toHaveLength(0);
  });

  test("ca 9b: id ĐẦU TIÊN phải là gbh.row.moduleIds[0] ⇒ lệch là CHẶN", () => {
    const code = 'loader.load({ id: "' + STOCK + '", factory: f });\nloader.load({ id: "' + OURS + '", factory: f });';
    const issues = moduleIdIssues(input({ code, declared: [OURS, STOCK], aliases: [STOCK], stockRowDisabled: true }));
    // LUAT MOT-ID: fixture nay dang ky 2 id nen se co nhieu dong chan (dung 1 · id goc trong moduleIds ·
    // id dau tien lech). Dieu can khang dinh o day la CO dong chan thuoc luat "id DAU TIEN".
    // Dòng chặn ĐẦU TIÊN giờ là luật một-id (a) — luật "id ĐẦU TIÊN" vẫn phải xuất hiện trong danh sách.
    expect(issues.some((i) => i.detail.includes("id module DAU TIEN"))).toBe(true);
  });

  test("ca 9c: TRÙNG id giữa hai row ĐANG BẬT ⇒ CHẶN; row bị tắt thì không tính", () => {
    const both = crossRowDuplicateIssues([
      { pkg: "@galaxy-blackhole/gbh-client-a", rowId: "a", ids: [OURS], enabled: true },
      { pkg: "@galaxy-blackhole/gbh-client-b", rowId: "b", ids: [OURS], enabled: true },
    ]);
    expect(both.filter((i) => i.level === "chan")).toHaveLength(1);
    expect(both[0]?.detail).toContain("duplicate factory registration");
    const oneDisabled = crossRowDuplicateIssues([
      { pkg: "@galaxy-blackhole/gbh-client-a", rowId: "a", ids: [OURS], enabled: true },
      { pkg: "@galaxy-blackhole/gbh-client-b", rowId: "b", ids: [OURS], enabled: false },
    ]);
    expect(oneDisabled).toEqual([]);
  });

  test("ca 9d: patch sinh ra phải là YAML hợp lệ — dòng inject thiếu nháy là CHẶN", () => {
    const broken = ["- insert:", "    - id: file-upload-ours", "      name: '@galaxy-blackhole/gbh-client-file-upload'", "      inject:", "        - @deepseek-ai/dsh-api-remotes"].join("\n");
    const issues = patchScalarIssues(broken);
    expect(issues.filter((i) => i.level === "chan").length).toBeGreaterThanOrEqual(1);
    expect(issues[0]?.pkg).toBe("app.patch.yml");
    expect(issues[0]?.detail).toContain("@deepseek-ai/dsh-api-remotes");
    const fixed = broken.replace("- @deepseek-ai/dsh-api-remotes", "- '@deepseek-ai/dsh-api-remotes'");
    expect(patchScalarIssues(fixed)).toEqual([]);
    // Và KHÔNG báo oan cho patch thật đang chạy: tag !!js và scalar thường đều hợp lệ.
    const ok = ["- id: connection", "  disabled: true", "- insert:", "    - id: connection-ours", "      inject:", "        - webStartup", "      config:", "        trustedHosts: !!js ctx.webStartup.trustedHosts"].join("\n");
    expect(patchScalarIssues(ok)).toEqual([]);
  });

  test("ca 9: artifact KHÔNG có bộ nạp ⇒ CHẶN; đọc không ra nhưng có bộ nạp ⇒ chỉ cảnh báo", () => {
    expect(moduleIdIssues(input({ code: "var x = 1;" })).some((i) => i.level === "chan")).toBe(true);
    const blind = moduleIdIssues(input({ code: "var loader = globalThis.__ModuleLoader__;" }));
    expect(blind.some((i) => i.level === "chan")).toBe(false);
    expect(blind.some((i) => i.level === "canh bao")).toBe(true);
  });
});

describe("phép kiểm an toàn-boot — cạnh inject treo (lỗi GỐC 17/10/2026)", () => {
  /** Row ta đã thay, dùng chung cho các ca. */
  const row = { pkg: "@galaxy-blackhole/gbh-client-demo", rowId: "demo", stockId: STOCK, enabled: true };
  /** Ai đang inject id stock đó. */
  const injectors = new Map<string, readonly string[]>([[STOCK, ["@deepseek-ai/dsh-client-ui-conversation", "@galaxy-blackhole/gbh-client-ui-sidebar"]]]);

  test("ca 16: còn entry phụ thuộc mà ta KHÔNG khai id stock ⇒ CHẶN kèm tên row phụ thuộc", () => {
    const issues = danglingInjectIssues([row], injectors, new Map([[row.pkg, ["@galaxy-blackhole/gbh-client-demo"]]]));
    expect(issues.filter((i) => i.level === "chan").length).toBeGreaterThanOrEqual(1);
    expect(issues[0]?.detail).toContain(STOCK);
    expect(issues[0]?.detail).toContain("ui-conversation");
  });

  test("ca 17: khai id stock trong moduleIds ⇒ ĐẠT (đúng khuôn Lead vá cho 7 gói)", () => {
    expect(danglingInjectIssues([row], injectors, new Map([[row.pkg, ["@galaxy-blackhole/gbh-client-demo", STOCK]]]))).toEqual([]);
  });

  test("ca 18: khai id stock trong aliases ⇒ ĐẠT", () => {
    expect(danglingInjectIssues([row], injectors, new Map([[row.pkg, [STOCK]]]))).toEqual([]);
  });

  test("ca 19+20: row bị tắt, hoặc không còn entry phụ thuộc ⇒ không báo gì", () => {
    expect(danglingInjectIssues([{ ...row, enabled: false }], injectors, new Map())).toEqual([]);
    expect(danglingInjectIssues([row], new Map(), new Map())).toEqual([]);
  });

  test("ca 21: trên metadata HIỆN TẠI của repo, không row nào còn cạnh inject treo", () => {
    // Nghiệm thu phần C: dùng CHÍNH hàm của cổng (không viết lại phép quét trong test).
    const dirs = rowPackages();
    const replaced = replacedRows(dirs, readRunningPatch());
    const issues = danglingInjectIssues(replaced, stockInjectors(), declaredIdsByPackage(dirs));
    // Phép thử phải THẬT SỰ có dữ liệu: phải thấy ≥5 row đã thay, và trong đó phải có row từng bị treo.
    expect(replaced.length).toBeGreaterThanOrEqual(5);
    expect(replaced.some((row) => row.rowId === "locale" || row.rowId === "shortcuts")).toBe(true);
    expect(issues.filter((i) => i.level === "chan")).toEqual([]);
  });
});

describe("phép kiểm an toàn-boot — gói khai dsh.client phải SINH RA nửa client", () => {
  /**
   * Dựng một gói giả trong thư mục tạm.
   * Nhận: `files` — bảng đường dẫn tương đối → nội dung.
   * Trả: thư mục gói.
   */
  const makePackage = (files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-check-"));
    for (const [relative, body] of Object.entries(files)) {
      const full = join(dir, relative);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, body);
    }
    return dir;
  };

  test("ca 11: khai dsh.client mà thiếu src/client.ts ⇒ CHẶN", () => {
    const dir = makePackage({
      "package.json": JSON.stringify({ name: "@galaxy-blackhole/gbh-client-gia-a", dsh: { client: {} } }),
      "src/index.ts": "export function apply(): void {}",
      // build.ts ĐÃ build hai nửa ⇒ ca này cô lập đúng lỗi "thiếu entry nửa client".
      "build.ts": "await Bun.build({ entrypoints: [\"src/index.ts\"] });\nawait Bun.build({ entrypoints: [\"src/client.ts\"] });",
    });
    const issues = clientBuildIssues(dir, { name: "@galaxy-blackhole/gbh-client-gia-a", dsh: { client: {} } });
    expect(issues.filter((i) => i.level === "chan").length).toBeGreaterThanOrEqual(1);
    expect(issues[0]?.detail).toContain("khong co src/client.ts");
  });

  test("ca 12: build.ts có 2 Bun.build (khuôn bọc trong build.ts) ⇒ ĐẠT", () => {
    const dir = makePackage({
      "package.json": JSON.stringify({ name: "@galaxy-blackhole/gbh-client-gia-b", dsh: { client: {} } }),
      "src/index.ts": "export function apply(): void {}",
      "src/client.ts": "export {}",
      "build.ts": "await Bun.build({ entrypoints: [\"src/index.ts\"] });\nawait Bun.build({ entrypoints: [\"src/client.ts\"], format: \"iife\" });",
    });
    expect(clientBuildIssues(dir, { name: "@galaxy-blackhole/gbh-client-gia-b", dsh: { client: {} } })).toEqual([]);
  });

  test("ca 13: khuôn bọc trong src/ (build.ts gọi hàm bọc) ⇒ ĐẠT", () => {
    const dir = makePackage({
      "package.json": JSON.stringify({ name: "@galaxy-blackhole/gbh-client-gia-c", dsh: { client: {} } }),
      "src/index.ts": "export function apply(): void {}",
      "src/client.ts": "export {}",
      "src/register.ts": "export async function wrap(): Promise<void> { await Bun.build({ entrypoints: [\"x\"] }); }",
      "build.ts": "import { wrap } from \"./src/register.ts\";\nawait Bun.build({ entrypoints: [\"src/index.ts\"] });\nawait wrap();",
    });
    expect(clientBuildIssues(dir, { name: "@galaxy-blackhole/gbh-client-gia-c", dsh: { client: {} } })).toEqual([]);
  });

  test("ca 14: chỉ 1 Bun.build + không có artifact ⇒ CHẶN (đúng sự cố 19:13)", () => {
    const dir = makePackage({
      "package.json": JSON.stringify({ name: "@galaxy-blackhole/gbh-client-gia-d", dsh: { client: {} } }),
      "src/index.ts": "export function apply(): void {}",
      "src/client.ts": "export {}",
      "build.ts": "await Bun.build({ entrypoints: [\"src/index.ts\"] });",
    });
    const issues = clientBuildIssues(dir, { name: "@galaxy-blackhole/gbh-client-gia-d", dsh: { client: {} } });
    expect(issues.filter((i) => i.level === "chan").length).toBeGreaterThanOrEqual(1);
    expect(issues[0]?.detail).toContain("19:13");
  });

  test("ca 15: gói KHÔNG khai dsh.client ⇒ không kiểm gì (không báo oan)", () => {
    const dir = makePackage({ "package.json": JSON.stringify({ name: "@galaxy-blackhole/gbh-host-gia-e" }), "src/index.ts": "export function apply(): void {}" });
    expect(clientBuildIssues(dir, { name: "@galaxy-blackhole/gbh-host-gia-e" })).toEqual([]);
  });
});

describe("phép kiểm an toàn-boot — thử trên toàn bộ gói đang chạy thật", () => {
  test("ca 10: KHÔNG gói nào đang chạy tốt bị báo 'chan' (nếu có, phép kiểm sai chứ không phải gói sai)", () => {
    const dirs = rowPackages();
    expect(dirs.length).toBeGreaterThanOrEqual(20);
    const blocked: string[] = [];
    const warnings: string[] = [];
    let inspected = 0;
    for (const dir of dirs) {
      const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
        name: string;
        exports?: Record<string, unknown>;
        dsh?: { client?: unknown };
        gbh?: { row?: { id?: string; moved?: boolean; moduleIds?: string[]; aliases?: string[] } };
      };
      const row = json.gbh?.row;
      if (row === undefined || row.moved === true || json.dsh?.client === undefined) continue;
      const mounted = join(mountRoot(), json.name, "lib", "client.js");
      if (!existsSync(mounted)) {
        warnings.push(json.name + ": chua mount (bo qua)");
        continue;
      }
      inspected += 1;
      // Dung PATCH DANG CHAY (cung home voi `bh host`), khong doc ban template trong repo.
      const patch = readRunningPatch() ?? "";
      const issues = [
        ...mountArtifactIssues(dir, json),
        ...moduleIdIssues({
          pkg: json.name,
          code: readFileSync(mounted, "utf8"),
          declared: row.moduleIds ?? [],
          aliases: row.aliases ?? [],
          stockIds: [],
          stockRowDisabled: rowDisabledInPatch(patch, row.id ?? ""),
        }),
      ];
      for (const issue of issues) {
        if (issue.level === "chan") blocked.push(issue.pkg + ": " + issue.detail);
        else warnings.push(issue.pkg + ": " + issue.detail);
      }
    }
    // Phép thử phải THẬT SỰ soi được artifact, không được "xanh vì không kiểm gì".
    expect(inspected).toBeGreaterThanOrEqual(20);
    // Voi LUAT MOT-ID, nhieu goi dang ky 2 id se bi chan — do la CHU Y (danh sach viec cho chu goi).
    // Dieu phep thu nay phai khang dinh: moi dong chan deu thuoc MOT TRONG CAC LOP DA BIET, khong co lop la.
    const known = ["dung 1", "moduleIds chua id cua goi GOC", "thieu dang ky slot", "ROW GOC VAN BAT", "KHONG co o bat ky dau"];
    const strange = blocked.filter((line) => !known.some((k) => line.includes(k)));
    expect(strange).toEqual([]);
  });
});

describe("cổng bề mặt service — chứng minh BẮT được (không chỉ không báo oan)", () => {
  /** Văn bản gói gốc tối thiểu: cấp service configForms nhưng KHÔNG có thuộc tính developerTools. */
  const stockWithout = 'ctx.provide("configForms"); export interface ConfigForms { readonly enabled: boolean }';
  /** Cùng gói gốc nhưng CÓ thuộc tính đó (một dấu vết là đủ để coi hợp lệ). */
  const stockWith = 'ctx.provide("configForms"); export interface ConfigForms { readonly developerTools: unknown }';
  /** Bundle của ta đọc đúng biểu thức đã làm app chết 17/10/2026. */
  const ourBad = 'var x = ctx.configForms.developerTools.enabled;';

  test("ca 22: bundle ta đọc thuộc tính KHÔNG có ở gói gốc ⇒ BẮT được", () => {
    expect(missingServiceProperties(stockWithout, ourBad)).toEqual(["configForms.developerTools"]);
  });

  test("ca 23: cùng biểu thức nhưng gói gốc CÓ thuộc tính ⇒ im lặng (một dấu vết là đủ)", () => {
    expect(missingServiceProperties(stockWith, ourBad)).toEqual([]);
  });

  test("ca 24: chỉ xét chuỗi trên service mà gói gốc THẬT SỰ cấp (không bắt bừa mọi đối tượng)", () => {
    // otherService KHÔNG được gói gốc provide ⇒ không phải service ⇒ không xét.
    expect(missingServiceProperties(stockWithout, 'var y = otherService.khongCoThat;')).toEqual([]);
  });
});
