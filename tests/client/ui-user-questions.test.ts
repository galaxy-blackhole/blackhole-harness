/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test row ui-user-questions (HAI NUA): host rỗng 1:1 · A/B Context thật · manifest khớp bản gốc ·
 *      artifact client đúng MỘT id của ta Ở DÒNG LOADER (phần còn lại giữ id stock) · build.ts hai lời gọi Bun.build · CSS + locale nguyên văn
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { createWaterfallRequest, planReviewOf } from "../../packages/client/ui-user-questions/src/contract.ts";

/** Thu muc goc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Goi cua ta. */
const OURS = join(REPO, "packages", "client", "ui-user-questions");
/** Goi goc trong kernel (CHI DOC) — oracle cua moi phep so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-user-questions");
/** Ban build nua host cua ban goc. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Ban build nua client cua ban goc (oracle cua CSS/locale). */
const STOCK_CLIENT = join(STOCK_DIR, "lib", "client.js");
/** Cordis THAT cua kernel — can Context that de phep A/B co nghia. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Artifact nua client cua ta. */
const OUR_CLIENT = join(OURS, "lib", "client.js");
/** Id MODULE cua ta — id DUY NHAT duoc phep xuat hien trong load() cua artifact. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-user-questions";
/** Id cua goi GOC — CHI phai BIEN MAT o DONG LOADER; cac lan khac la DU LIEU, giu nguyen (canon 20/10/2026). */
const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-user-questions";

/**
 * Rut tap ten export tu mot artifact ESM (dang `export { a, b as c };`).
 * Nhận: text — noi dung file build.
 * Trả: tap ten export (da bo alias, giu ten cong khai).
 */
function exportNames(text: string): string[] {
  const out = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const alias = part.trim().split(/\s+as\s+/);
      const name = (alias[1] ?? alias[0] ?? "").trim();
      if (name !== "") out.add(name);
    }
  }
  return [...out].sort();
}

/**
 * Dem so lan mot chuoi xuat hien trong van ban.
 * Nhận: text — van ban can dem; needle — chuoi can tim.
 * Trả: so lan xuat hien (0 khi khong co).
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Rut ba chuoi CSS NGUYEN VAN cua ban goc (PlanReviewPanel · QuestionComposer · QuestionReplyView).
 * Quet co hieu ESCAPE (khong dung regex `([\s\S]*?)";` vi CSS co the chua chinh chuoi `";`) roi JSON.parse
 * de giai ma — nho vay phep so la so TUNG BYTE voi CSS ma ban goc nhung vao DOM.
 * Nhận: text — noi dung bundle client cua ban goc.
 * Trả: ba chuoi CSS da giai ma, theo dung thu tu ba module.
 */
function stockCssStrings(text: string): string[] {
  const out: string[] = [];
  for (const head of [".LVzXQa_frame", ".Mbwy4a_frame", ".ROF66W_row"]) {
    const start = text.indexOf('"' + head);
    if (start < 0) continue;
    let end = start + 1;
    while (end < text.length && text[end] !== '"') {
      end += text[end] === "\\" ? 2 : 1;
    }
    out.push(JSON.parse(text.slice(start, end + 1)) as string);
  }
  return out;
}

/**
 * Rut moi chuoi CSS NGUYEN VAN tu cac LAT bundle trong src/parts, da giai ma escape.
 * 20/10/2026 — de-bundle (task-175): lat la nguon su that cua nua client; phai JSON.parse vi co lat
 * chua escape (\n, \") nen so chuoi tho se sai, con giai ma thi ra DUNG tung byte CSS bundle goc nhung.
 * Nhan: khong.
 * Tra: cac chuoi CSS theo thu tu xuat hien trong lat.
 */
function partCssStrings(): string[] {
  const dir = join(OURS, "src", "parts");
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith(".ts")) continue;
    const text = readFileSync(join(dir, name), "utf8");
    for (const m of text.matchAll(/const (?:css\$?\d*|[A-Z_]+_CSS) = ("(?:[^"\\]|\\.)*");/g)) {
      out.push(JSON.parse(m[1] as string) as string);
    }
  }
  return out.filter((css) => css.includes("{"));
}

/**
 * Doc moi file nguon (.ts/.tsx/.css) duoi src/ cua goi thanh mot van ban.
 * Nhận: khong.
 * Trả: van ban gop cua toan bo ma nguon (de kiem CSS/locale nguyen van).
 */
function sourceText(): string {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|css)$/.test(name)) out.push(readFileSync(full, "utf8"));
    }
  };
  walk(join(OURS, "src"));
  return out.join("\n");
}

/** Hinh dang toi thieu cua cordis ma phep A/B can. */
interface CordisModule {
  /** Context that (fiber goc). */
  Context: new () => Record<string, unknown>;
}

describe("ui-user-questions — nua host 1:1", () => {
  test("artifact CHI export apply, giong het ban goc; than ham RONG y ban goc", () => {
    const oursText = readFileSync(join(OURS, "lib", "index.js"), "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["apply"]);
    expect(oursText).toContain("function apply() {}");
    expect(stockText).toContain("function apply() {}");
    // Nua host KHONG duoc cham bootstrap/module-loader.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText).not.toContain("__DSH_BOOT__");
  });

  test("A/B tren Context THAT: hai ban deu khong nem, tra undefined, khong doi be mat context (ke ca khi goi hai lan)", async () => {
    const cordis = (await import(CORDIS)) as CordisModule;
    const ours = (await import(join(OURS, "lib", "index.js"))) as { apply: () => unknown };
    const stock = (await import(STOCK)) as { apply: () => unknown };
    for (const candidate of [ours, stock]) {
      const ctx = new cordis.Context();
      const before = Object.keys(ctx).sort();
      expect(candidate.apply()).toBeUndefined();
      expect(Object.keys(ctx).sort()).toEqual(before);
      // Idempotent: goi lan hai van khong nem, khong doi be mat.
      expect(candidate.apply()).toBeUndefined();
      expect(Object.keys(ctx).sort()).toEqual(before);
    }
  });
});

describe("ui-user-questions — manifest + nua client", () => {
  /** Metadata package.json cua ta. */
  interface Meta {
    name: string;
    exports: Record<string, string>;
    dsh?: { client?: { inject?: string[]; platform?: string } };
    gbh?: { row?: unknown; draft?: string; tests?: string[] };
  }
  const oursMeta = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as Meta;
  const stockMeta = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Meta;

  test("ten theo quy uoc G3 + dsh.client KHop tuyet doi voi ban goc (platform + inject y nguyen thu tu)", () => {
    expect(oursMeta.name).toBe(PACKAGE_NAME);
    // 20/10/2026 — id goi da REWRITE CO CHU DICH sang @galaxy-blackhole/gbh-*; van so DEEP-EQUAL (thu tu inject
    //   giu nguyen vi sameAfterIdMap so mang theo thu tu) sau khi quy id ta -> id stock, KHONG noi thanh contains.
    expect(sameAfterIdMap(oursMeta.dsh?.client, stockMeta.dsh?.client)).toBe(true);
    expect(sameAfterIdMap(oursMeta.dsh?.client?.inject, stockMeta.dsh?.client?.inject)).toBe(true);
    expect(oursMeta.dsh?.client?.platform).toBe(stockMeta.dsh?.client?.platform);
  });

  test("nua client da co: exports['./client'] tro lib/client.js, artifact ton tai va dang ky DUNG id cua ta", () => {
    expect(oursMeta.exports["./client"]).toBe("./lib/client.js");
    expect(existsSync(OUR_CLIENT)).toBe(true);
    const artifact = readFileSync(OUR_CLIENT, "utf8");
    // Dang ky module: dung MOT loi goi load(), id CUA TA o DONG LOADER.
    expect(countOf(artifact, "__ModuleLoader__.load(")).toBe(1);
    // 20/10/2026 — de-bundle (task-175): vo bundle MOI dat id o DONG RIENG trong load({ … }) va factory
    //   tra module.exports (khong con createPlugin cua ban viet tay). KHONG ESM (dong duoi nua).
    const lines = artifact.split("\n");
    const loaderAt = lines.findIndex((line) => line.includes("__ModuleLoader__.load("));
    expect(loaderAt).toBeGreaterThanOrEqual(0);
    expect(lines[loaderAt]?.trim()).toBe("window.__ModuleLoader__.load({");
    expect(lines[loaderAt + 1]?.trim()).toBe('id: "' + PACKAGE_NAME + '",');
    expect(lines[loaderAt + 2]?.trim()).toBe("factory: (require) => {");
    // 20/10/2026 — CANON (tools/debundle-client.ts): quy id CHỈ Ở DÒNG LOADER. Mọi lần xuất hiện khác của id
    //   gói là DỮ LIỆU (khoá slot, owner id, nhãn, dataset.plugin, tagId CSS…) nên GIỮ id stock y bản gốc.
    //   Vì thế: DÒNG LOADER = 0 id stock, còn N lần còn lại bằng ĐÚNG N của bundle gốc (không đòi tuyệt đối 0).
    const stockArtifact = readFileSync(STOCK_CLIENT, "utf8");
    const stockLoaderLine = 'id: "' + STOCK_PACKAGE_NAME + '",';
    expect(countOf(stockArtifact, stockLoaderLine)).toBe(1);
    expect(countOf(artifact, stockLoaderLine)).toBe(0);
    // 22/10/2026: tools/brand-ids-client.ts doi id du lieu stock -> id ta (artefact KHONG con id stock).
    expect(countOf(artifact, STOCK_PACKAGE_NAME)).toBe(0);
    // Artifact la script classic: khong duoc con cu phap ESM o cap cao nhat.
    expect(artifact).not.toContain("export {");
    // 19/10/2026 (Lead FLIP sau boot-smoke): manifest là NGUỒN SỰ THẬT — row có mặt với id đúng; nếu còn park
    // thì `row_unmounted_ly_do.row` cũng hợp lệ. Test KHÔNG kỳ vọng cứng trạng thái park nữa.
    const declared = (oursMeta.gbh as { row?: { id?: string }; row_unmounted_ly_do?: { row?: { id?: string } } });
    const row = declared?.row ?? declared?.row_unmounted_ly_do?.row;
    expect(row?.id).toBe("ui-user-questions");
    expect(oursMeta.gbh?.draft).toBeTypeOf("string");
  });

  test("build.ts co HAI loi goi Bun.build (host + client) va nhanh client ghi ra lib/client.js", () => {
    const build = readFileSync(join(OURS, "build.ts"), "utf8");
    expect(countOf(build, "Bun.build(")).toBeGreaterThanOrEqual(2);
    // build.ts dung join(import.meta.dir, "src", "index.ts") ⇒ kiem TEN TEP, khong kiem chuoi duong dan.
    expect(build).toContain("index.ts");
    expect(build).toContain("client.ts");
    expect(build).toContain("client.js");
  });

  test("slot/service ma nua client goc dung deu co trong artifact, va khong trung voi goi khac cua ta", () => {
    const artifact = readFileSync(OUR_CLIENT, "utf8");
    for (const slot of ["conversation.composer", "conversation.chat.node", "conversation.plan-review.actions"]) {
      expect(artifact).toContain(slot);
    }
    for (const seam of ["userQuestionPanels", "user-questions/request", '"question"']) expect(artifact).toContain(seam);
    // Nua host cua ta khong dang ky gi ⇒ khong the trung slot/service (su co single-slot 18/10/2026).
    const oursHost = readFileSync(join(OURS, "src", "index.ts"), "utf8");
    expect(oursHost).not.toContain("slots.register");
    expect(oursHost).not.toContain("provide(");
  });

  test("ba module CSS cua ban goc co mat NGUYEN VAN trong src (chen dung 1 lan, khong bi cat)", () => {
    const mine = sourceText();
    const cssStrings = stockCssStrings(readFileSync(STOCK_CLIENT, "utf8"));
    expect(cssStrings.length).toBe(3);
    // 20/10/2026 — de-bundle (task-175): CSS nguyen van nam trong LAT (src/parts). Ban viet tay cu con
    //   tep .module.css nen dem ca src se ra 2 lan; lat moi la nguon su that. So TAP BANG NHAU + dung
    //   MOT lan xuat hien moi chuoi (toEqual), khong noi long thanh contains.
    const parts = partCssStrings();
    expect(parts).toHaveLength(3);
    expect([...parts].sort()).toEqual([...cssStrings].sort());
    for (const css of cssStrings) expect(parts.filter((part) => part === css)).toEqual([css]);
    expect(mine).not.toContain("line truncated to");
  });

  test("locale/{en,zh}.json copy NGUYEN VAN tu ban goc", () => {
    for (const lang of ["en", "zh"]) {
      const oursLocale = readFileSync(join(OURS, "locale", lang + ".json"), "utf8");
      const stockLocale = readFileSync(join(STOCK_DIR, "locale", lang + ".json"), "utf8");
      expect(oursLocale).toBe(stockLocale);
    }
  });
});

describe("ui-user-questions — hop dong cua ban goc", () => {
  /** Mot cau hoi duyet ke hoach hop le: mot cau, co detail, hai lua chon, co nhan duyet. */
  const PLAN_REVIEW_QUESTION: Record<string, unknown> = {
    id: "q-1",
    question: "Duyet ke hoach?",
    detail: "## Ke hoach",
    intent: { kind: "plan-review", approve: "Dong y", callId: "call-1" },
    options: [{ label: "Dong y" }, { label: "Yeu cau sua" }],
  };

  /**
   * Boc mot lo cau hoi viet tay thanh kieu tham so cua `planReviewOf`.
   * Nhận: items — cac cau hoi duoi dang literal (chi cac truong ma phep thu can).
   * Trả: cung mang do, da ep kieu ve lo cau hoi cua goi.
   */
  function batch(items: Record<string, unknown>[]): Parameters<typeof planReviewOf>[0] {
    return items as unknown as Parameters<typeof planReviewOf>[0];
  }

  test("planReviewOf: nhan dung lo MOT cau duyet ke hoach, loai moi thu khac ve luong cau hoi thuong", () => {
    const review = planReviewOf(batch([PLAN_REVIEW_QUESTION]));
    expect(review?.id).toBe("q-1");
    expect(review?.plan).toBe("## Ke hoach");
    // `callId` mang brand luc bien dich ⇒ so qua chuoi, khong so truc tiep voi literal.
    expect(String(review?.callId ?? "")).toBe("call-1");
    expect(review?.approve.label).toBe("Dong y");
    expect(review?.decline?.label).toBe("Yeu cau sua");

    // Hai cau ⇒ khong phai MOT quyet dinh tren mot ban ke hoach.
    expect(planReviewOf(batch([PLAN_REVIEW_QUESTION, PLAN_REVIEW_QUESTION]))).toBeUndefined();
    // Thieu detail ⇒ khong co ban ke hoach de duyet.
    expect(planReviewOf(batch([{ ...PLAN_REVIEW_QUESTION, detail: undefined }]))).toBeUndefined();
    // multiSelect ⇒ de luong cau hoi thuong (ban goc loai).
    expect(planReviewOf(batch([{ ...PLAN_REVIEW_QUESTION, multiSelect: true }]))).toBeUndefined();
    // Ba lua chon ⇒ de luong cau hoi thuong (ban goc loai).
    expect(
      planReviewOf(batch([{ ...PLAN_REVIEW_QUESTION, options: [{ label: "Dong y" }, { label: "Sua" }, { label: "Khac" }] }])),
    ).toBeUndefined();
    // Khong co lua chon mang nhan duyet ⇒ khong duyet duoc.
    expect(planReviewOf(batch([{ ...PLAN_REVIEW_QUESTION, options: [{ label: "Sua" }] }]))).toBeUndefined();
    // intent khac ⇒ khong phai duyet ke hoach.
    expect(
      planReviewOf(batch([{ ...PLAN_REVIEW_QUESTION, intent: { kind: "question", approve: "Dong y" } }])),
    ).toBeUndefined();
  });

  test("createWaterfallRequest: ket thuc DUNG MOT lan — resolve tra loi · abort ⇒ UserQuestionError ASK_ABORTED · delegate ⇒ isDelegation", async () => {
    const settled: unknown[] = [];
    const answer = { answers: [{ id: "q-1", selected: ["Dong y"] }] };

    const request = createWaterfallRequest(undefined, undefined, (channel) => settled.push(channel));
    request.channel.resolve(answer as never);
    expect(await request.result).toEqual(answer as never);
    // Lan thu hai bi bo qua: onSettle chi chay MOT lan.
    request.channel.resolve({ answers: [] } as never);
    expect(settled.length).toBe(1);

    const aborted = new AbortController();
    const abortRequest = createWaterfallRequest(Date.now() + 5_000, aborted.signal, () => undefined);
    aborted.abort();
    let abortError: unknown;
    try {
      await abortRequest.result;
    } catch (error) {
      abortError = error;
    }
    expect(abortError).toMatchObject({ name: "UserQuestionError", code: "ASK_ABORTED" });

    const delegateRequest = createWaterfallRequest(undefined, undefined, () => undefined);
    delegateRequest.channel.delegate();
    let delegated: unknown;
    try {
      await delegateRequest.result;
    } catch (error) {
      delegated = error;
    }
    expect(delegateRequest.isDelegation(delegated)).toBe(true);
    // Mot lan huy KHONG phai mot lan giao tiep.
    expect(delegateRequest.isDelegation(abortError)).toBe(false);
  });
});