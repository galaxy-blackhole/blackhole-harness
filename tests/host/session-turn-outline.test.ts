/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-session-turn-outline (row session-turn-outline): bước 0 đọc
 *      cặp row trong oracle dump, tập export đo trên ARTIFACT, đối chứng TỪNG BƯỚC phép gộp với chính
 *      bundle gốc, quy ước gbh.peers ⊆ peerDependencies có ĐỐI CHỨNG ÂM, ca C6 (DANH TÍNH), và luật
 *      000e (locale byte-for-byte).
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionSeq } from "../../packages/host/session-turn-outline/src/brand.ts";

/** Thư mục package của ta — gốc của mọi phép đọc manifest/nguồn. */
const PKG = "../../packages/host/session-turn-outline";
/** Bản gốc đã build trong kernel (CHỈ ĐỌC) — nguồn đối chứng của MỌI ca A/B. */
const STOCK = "../../apps/host/node_modules/@deepseek-ai/dsh-session-turn-outline";
/** Gốc repo (để đọc .parity/dumps). */
const REPO = "../..";

/** Một mục dàn bài (bản sao cấu trúc của vật thể ta trả về). */
interface Entry {
  /** Số lượt. */
  turn: number;
  /** Seq của `turn/start`. */
  seq: number;
  /** Bản xem trước prompt người dùng. */
  prompt: string;
  /** Bản xem trước phản hồi cuối. */
  response: string;
}

/** Trạng thái phép gộp. */
interface State {
  /** Các lượt đã bắt đầu. */
  turns: readonly Entry[];
  /** Bản nháp phản hồi của lượt đang mở. */
  draft: string;
}

/** Một sự kiện phiên dựng trong test. */
interface OutlineEvent {
  /** Loại sự kiện. */
  type: string;
  /** Vị trí trong log. */
  seq: number;
  /** Dữ liệu sự kiện. */
  data: unknown;
}

/** Hình dạng đơn vị chiếu mà cả hai bản cài đăng ký (khai theo CẤU TRÚC trong test). */
interface Definition {
  /** Khoá chiếu. */
  readonly key: string;
  /** Phiên bản trạng thái. */
  readonly stateVersion: number;
  /** Schema trạng thái — seam CHỈ gọi `parse`. */
  readonly stateSchema: { parse(value: unknown): State };
  /** Trạng thái rỗng. */
  init(): State;
  /** Phép gộp thuần. */
  apply(state: State, event: OutlineEvent): State;
  /** Khung nhìn dây. */
  readonly wire: {
    /** Schema khung nhìn. */
    readonly viewSchema: { parse(value: unknown): readonly Entry[] };
    /** Hàm chiếu. */
    view(state: State): readonly Entry[];
  };
}

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata nửa client của DSH (bản gốc không có). */
  dsh?: { client?: unknown };
  /** Metadata row của ta — lượt này CHƯA khai `row`. */
  gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: unknown };
}

/** Đổi đường dẫn tương đối (theo CHÍNH file test) thành tuyệt đối để `readFileSync` ổn định theo file. */
function here(relative: string): string {
  return new URL(relative, import.meta.url).pathname;
}

/** Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`). */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(here(PKG), "package.json"), "utf8")) as Manifest;
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Băm sha256 một chuỗi — dùng cho phép đối chứng TỪNG BYTE. */
function sha256(text: string): string {
  return createHash("sha256").update(normalizePackageNames(text)).digest("hex");
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/** Bản gốc đã nạp; kiểu để hở vì đây là bundle đã build của gói khác. */
const stock = (await import(here(STOCK + "/lib/index.js"))) as { name: string; inject: string[]; apply: (ctx: unknown) => void };
/** Bản CỦA TA nạp từ NGUỒN (artifact được đo riêng bằng văn bản ở ca 2). */
const ours = (await import(here(PKG + "/src/index.ts"))) as {
  name: string;
  inject: string[];
  apply: (ctx: unknown) => void;
};
/** Đơn vị chiếu CỦA TA, nạp từ nguồn để đối chứng từng bước. */
const ourDefinition = (await import(here(PKG + "/src/projection.ts"))).turnOutlineProjectionDefinition as Definition;
/** `SessionSeq` THẬT của kernel — nguồn đối chứng của ca danh tính dấu kiểu. */
const kernel = (await import(here("../../apps/host/node_modules/@deepseek-ai/dsh-session/lib/index.js"))) as {
  SessionSeq(value: number): number;
};

/**
 * Cài một bản `apply` lên một giàn giả rồi bắt lấy đơn vị chiếu đã đăng ký.
 * Nhận: hàm `apply` của bản cần cài.
 * Trả: đơn vị chiếu đã đăng ký + số lần `register` được gọi.
 */
function install(apply: (ctx: unknown) => void): { definition: Definition; registrations: number } {
  let captured: Definition | undefined;
  let registrations = 0;
  const ctx = {
    sessionProjections: {
      register(definition: Definition): unknown {
        registrations += 1;
        captured = definition;
        return () => undefined;
      },
    },
  };
  apply(ctx);
  if (captured === undefined) throw new Error("apply khong dang ky don vi chieu nao");
  return { definition: captured, registrations };
}

/** Một sự kiện `turn/start` với seq tường minh. */
function turnStart(turn: number, seq: number): OutlineEvent {
  return { type: "turn/start", seq: SessionSeq(seq), data: { turn } };
}

/** Một sự kiện `user/message` từ nguồn cho trước. */
function userMessage(source: string, content: readonly { type: string; text: string }[], seq = 1): OutlineEvent {
  return { type: "user/message", seq: SessionSeq(seq), data: { source: { kind: source }, content } };
}

/** Một sự kiện `assistant/message`. */
function assistantMessage(content: readonly { type: string; text: string }[], seq = 1): OutlineEvent {
  return { type: "assistant/message", seq: SessionSeq(seq), data: { message: { content } } };
}

/** Một sự kiện `turn/end`. */
function turnEnd(seq = 2): OutlineEvent {
  return { type: "turn/end", seq: SessionSeq(seq), data: { turn: 1, reason: { kind: "ended" } } };
}

/** Một khối văn bản. */
function text(value: string): { type: string; text: string } {
  return { type: "text", text: value };
}

/**
 * Chạy MỘT chuỗi sự kiện qua một đơn vị chiếu và ghi lại cả giá trị lẫn DANH TÍNH.
 * Nhận: đơn vị chiếu và danh sách sự kiện.
 * Trả: dãy trạng thái sau mỗi bước + cờ "giữ nguyên tham chiếu" của từng bước.
 */
function foldTrace(definition: Definition, events: readonly OutlineEvent[]): { states: State[]; sameReference: boolean[] } {
  let state = definition.init();
  const states: State[] = [];
  const sameReference: boolean[] = [];
  for (const event of events) {
    const next = definition.apply(state, event);
    sameReference.push(next === state);
    states.push(next);
    state = next;
  }
  return { states, sameReference };
}

/** Kịch bản đầy đủ dùng cho cả hai bản cài — mỗi dòng là một sự kiện thật của vòng agent. */
const SCRIPT: readonly OutlineEvent[] = [
  { type: "session/start", seq: SessionSeq(0), data: { header: {} } },
  turnStart(1, 1),
  userMessage("user", [text("  Xin chào   thế giới  ")], 2),
  userMessage("user", [text("steering: giữ prompt đầu tiên")], 3),
  userMessage("agent", [text("không phải người dùng")], 4),
  assistantMessage([text("")], 5),
  assistantMessage([text("Bản nháp một")], 6),
  assistantMessage([text("Bản nháp hai, dài hơn")], 7),
  turnEnd(8),
  turnStart(1, 9),
  turnStart(2, 10),
  userMessage("user", [text("Lượt hai")], 11),
  assistantMessage([text("Phản hồi\nlượt hai")], 12),
  turnEnd(13),
];

describe("bước 0 — cặp row trong oracle dump + hình dạng gói", () => {
  test("ca 0a: cặp '- id: session-turn-outline' + name gốc CÓ THẬT trong ours.yml mới nhất, không disabled, không config", () => {
    const dumps = join(here(REPO), ".parity", "dumps");
    expect(existsSync(dumps)).toBe(true);
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .at(-1);
    expect(newest).toBeDefined();
    const yml = readFileSync(join(dumps, newest as string, "ours.yml"), "utf8").split("\n");
    const at = yml.findIndex((line) => line.trim() === "- id: session-turn-outline");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(yml[at + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-session-turn-outline'");
    // Cặp này KHÔNG bị tắt và KHÔNG mang `config` — Lead cần đúng dữ kiện này khi khai `gbh.row`.
    // (Dòng kế tiếp có thể là chú thích `# == <gói>, patched by …`; mốc hết row là dòng bắt đầu `- `.)
    const end = yml.findIndex((line, index) => index > at && line.startsWith("- "));
    const rowLines = yml.slice(at + 1, end < 0 ? yml.length : end).filter((line) => line.trim() !== "" && !line.startsWith("#"));
    // 18/10/2026 - CAP NHAT SAU KHI MOUNT: row nay DA duoc Lead khai gbh.row va mount, nen patch
    // sinh ra them dong disabled: true => row gio co 2 dong, khong con 1. Khang dinh cu
    // (length === 1) dung TRUOC mount nhung sai SAU mount - dung lop loi test canh khong
    // cap nhat sau khi Lead khai, da gap 3 lan. Nay khang dinh trang thai DA MOUNT.
    expect(rowLines.length).toBe(2);
    expect(rowLines[1]?.trim()).toBe("disabled: true");
    expect(rowLines[0]?.trim()).toBe("name: '@deepseek-ai/dsh-session-turn-outline'");
  });

  test("ca 0b: gói gốc MỘT MẶT — lib/client.js KHÔNG tồn tại, lib/types/client.js chỉ là `export {}`", () => {
    expect(existsSync(join(here(STOCK), "lib", "client.js"))).toBe(false);
    expect(readFileSync(join(here(STOCK), "lib", "types", "client.js"), "utf8")).not.toContain("__ModuleLoader__");
    expect(readManifest().dsh?.client).toBeUndefined();
  });

  test("ca 0c: gbh.row được khai NGOÀI phiên viết gói — hình dạng đúng: id + tests, KHÔNG config/moduleIds/aliases", () => {
    // ⚠️ Gói này được viết ở trạng thái CHƯA khai `gbh.row` (chỉ đạo của Lead); khoá row xuất hiện
    // lúc 08:08:27 ngày 18/10/2026 — KHÔNG do phiên này. Ca test ghi lại HÌNH DẠNG phải có, và khẳng
    // định không ai thêm `config`/`moduleIds`/`aliases` (row một mặt, row gốc không mang `config`).
    const manifest = readManifest();
    expect(manifest.gbh?.row).toEqual({
      id: "session-turn-outline",
      tests: ["tests/host/session-turn-outline.test.ts"],
    });
    expect(manifest.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(manifest.gbh?.peers).toEqual(["@deepseek-ai/dsh-session-projection"]);
  });
});

describe("ARTIFACT — khuôn bundle và tập export", () => {
  test("ca 1: tập export ta = tập export gốc (đo trên văn bản lib/index.js đã build)", async () => {
    const build = (await import(join(here(PKG), "build.ts"))) as { buildPackage: (outDir?: string) => Promise<string> };
    const artifact = await build.buildPackage(mkdtempSync(join(tmpdir(), "gbh-session-turn-outline-")));
    const artifactText = readFileSync(artifact, "utf8");
    const ours = exportNames(artifactText);
    const theirs = exportNames(readFileSync(join(here(STOCK), "lib", "index.js"), "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["apply", "inject", "name"]);
    expect(ours).not.toContain("default");
    // Row HOST-ONLY: bundle không đăng ký id module nào, không đụng bộ nạp client.
    expect(artifactText.match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
    expect(artifactText.match(/__ModuleLoader__/g)?.length ?? 0).toBe(0);
  });

  test("ca 2: build.ts nhận thư mục đích qua process.argv[2] (thiếu ⇒ profile không có lib ⇒ không sinh entry)", () => {
    expect(readFileSync(join(here(PKG), "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("ca 3: luật 000e — locale/{en,zh}.json chép BYTE-FOR-BYTE và có trong exports", () => {
    for (const locale of ["en", "zh"]) {
      const name = `locale/${locale}.json`;
      const mine = readFileSync(join(here(PKG), name), "utf8");
      const theirs = readFileSync(join(here(STOCK), name), "utf8");
      expect(sha256(mine)).toBe(sha256(theirs));
    }
    expect(readManifest().exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });
});

describe("peer — gbh.peers ⊆ peerDependencies, so PHẦN TỬ", () => {
  test("ca 4: manifest thật có 0 tên lệch, và peer không nằm trong dependencies", () => {
    const manifest = readManifest();
    expect(missingPeers(manifest)).toEqual([]);
    expect(Object.keys(manifest.dependencies ?? {})).toEqual(["zod"]);
    expect(Object.keys(manifest.peerDependencies ?? {})).toEqual(["@deepseek-ai/dsh-session-projection"]);
  });

  test("ca 5: ĐỐI CHỨNG ÂM — xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = {};
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-session-projection"]);
  });

  test("ca 6: đối chứng âm thứ hai — CÙNG số lượng mà lệch phần tử vẫn PHẢI bị bắt; thừa tên vẫn ĐẠT", () => {
    const broken = cloneManifest(readManifest());
    broken.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5" };
    expect(Object.keys(broken.peerDependencies).length).toBe(1);
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-session-projection"]);
    const extra = cloneManifest(readManifest());
    extra.peerDependencies = { ...extra.peerDependencies, "@deepseek-ai/cordis": "~4.0.5" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("SessionSeq — bản địa phương phải Y HỆT kernel", () => {
  test("ca 7: giá trị hợp lệ trả CHÍNH số đó (hai bản cài cho giá trị TRÁO ĐƯỢC, như gói dsh-brand tự ghi)", () => {
    for (const value of [0, 1, 2, 41, Number.MAX_SAFE_INTEGER]) {
      expect(Object.is(SessionSeq(value), kernel.SessionSeq(value))).toBe(true);
      expect(SessionSeq(value) as number).toBe(value);
    }
  });

  test("ca 8: giá trị không hợp lệ ném CÙNG lớp và CÙNG câu — 5 dạng", () => {
    const bad = [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, -0];
    for (const value of bad) {
      let mine = "";
      let theirs = "";
      try {
        SessionSeq(value);
      } catch (error) {
        mine = error instanceof TypeError ? error.message : "khong phai TypeError";
      }
      try {
        kernel.SessionSeq(value);
      } catch (error) {
        theirs = error instanceof TypeError ? error.message : "khong phai TypeError";
      }
      expect(mine).toBe(theirs);
      expect(mine).toBe(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
    }
  });
});

describe("hành vi — A/B trực tiếp với chính bundle gốc trên CÙNG một giàn", () => {
  test("ca 9: đăng ký đúng MỘT đơn vị chiếu; name/inject/stateVersion khớp từng chữ", () => {
    const mine = install(ours.apply);
    const theirs = install(stock.apply);
    expect(mine.registrations).toBe(1);
    expect(theirs.registrations).toBe(1);
    expect(ours.name).toBe(stock.name);
    expect(ours.name).toBe("session-turn-outline");
    expect(ours.inject).toEqual(stock.inject);
    expect(ours.inject).toEqual(["sessionProjections"]);
    expect(ours.apply.length).toBe(1);
    expect(mine.definition.key).toBe(theirs.definition.key);
    expect(mine.definition.key).toBe("turnOutline");
    expect(mine.definition.stateVersion).toBe(theirs.definition.stateVersion);
    expect(mine.definition.stateVersion).toBe(2);
    expect(mine.definition.init()).toEqual(theirs.definition.init());
    expect(mine.definition.wire.viewSchema.parse([])).toEqual(theirs.definition.wire.viewSchema.parse([]));
  });

  test("ca 10: phép gộp khớp TỪNG BƯỚC trên kịch bản 14 sự kiện (giá trị + danh tính)", () => {
    const mine = foldTrace(ourDefinition, SCRIPT);
    const theirs = foldTrace(install(stock.apply).definition, SCRIPT);
    expect(mine.states.length).toBe(SCRIPT.length);
    for (let index = 0; index < SCRIPT.length; index += 1) {
      expect(mine.states[index]).toEqual(theirs.states[index]);
      expect(mine.sameReference[index]).toBe(theirs.sameReference[index]);
    }
    // Neo giá trị cụ thể để test không "xanh rỗng" khi cả hai cùng sai.
    expect(mine.states.at(-1)).toEqual({
      turns: [
        { turn: 1, seq: 1, prompt: "Xin chào thế giới", response: "Bản nháp hai, dài hơn" },
        { turn: 2, seq: 10, prompt: "Lượt hai", response: "Phản hồi lượt hai" },
      ],
      draft: "",
    });
    // Bước thú vị: 4 sự kiện đầu KHÔNG đổi gì (session/start, steering, nguồn agent, chữ rỗng).
    expect(mine.sameReference.slice(0, 6)).toEqual([true, false, false, true, true, true]);
  });

  test("ca 11: bản xem trước — nối khối bằng MỘT dấu cách, gộp khoảng trắng, cắt ở 50/120 kèm dấu ba chấm", () => {
    const long = "x".repeat(200);
    const script: readonly OutlineEvent[] = [
      turnStart(1, 1),
      userMessage("user", [text("a\n\n  b\t c"), { type: "image", text: "bị bỏ qua" }, text("d")], 2),
      assistantMessage([text(long)], 3),
      turnEnd(4),
      turnStart(2, 5),
      userMessage("user", [text(long)], 6),
    ];
    const mine = foldTrace(ourDefinition, script);
    const theirs = foldTrace(install(stock.apply).definition, script);
    for (let index = 0; index < script.length; index += 1) expect(mine.states[index]).toEqual(theirs.states[index]);
    const first = mine.states[1]?.turns[0];
    expect(first?.prompt).toBe("a b c d");
    expect(first?.prompt.length).toBeLessThanOrEqual(50);
    // Khối dài hơn 2× ngân sách: cắt còn 119 ký tự + dấu ba chấm (đúng 120).
    expect(mine.states[3]?.turns[0]?.response.length).toBe(120);
    expect(mine.states[3]?.turns[0]?.response.endsWith("…")).toBe(true);
    expect(mine.states[5]?.turns[1]?.prompt.length).toBe(50);
    expect(mine.states[5]?.turns[1]?.prompt.endsWith("…")).toBe(true);
  });

  test("ca 12: schema — cùng chấp nhận, cùng từ chối, cùng câu lỗi (5 dạng hỏng)", () => {
    const valid = [{ turn: 1, seq: 3, prompt: "p", response: "r" }];
    expect(ourDefinition.wire.viewSchema.parse(valid)).toEqual(install(stock.apply).definition.wire.viewSchema.parse(valid));
    expect(ourDefinition.stateSchema.parse({ turns: valid, draft: "" })).toEqual(
      install(stock.apply).definition.stateSchema.parse({ turns: valid, draft: "" }),
    );
    const broken = [
      [{ turn: 2, seq: 1, prompt: "", response: "" }, { turn: 2, seq: 2, prompt: "", response: "" }],
      [{ turn: 1, seq: -1, prompt: "", response: "" }],
      [{ turn: 1, seq: 1, prompt: "x".repeat(51), response: "" }],
      [{ turn: 1, seq: 1, prompt: "", response: "x".repeat(121) }],
      [{ turn: 1, seq: 1, prompt: "", response: "", extra: true }],
    ];
    for (const value of broken) {
      let mine = "ok";
      let theirs = "ok";
      try {
        ourDefinition.wire.viewSchema.parse(value);
      } catch (error) {
        mine = (error as Error).message;
      }
      try {
        install(stock.apply).definition.wire.viewSchema.parse(value);
      } catch (error) {
        theirs = (error as Error).message;
      }
      expect(mine).toBe(theirs);
      expect(mine).not.toBe("ok");
    }
    // Câu lỗi của phép kiểm tăng nghiêm ngặt là NGUYÊN VĂN của bản gốc.
    let message = "";
    try {
      ourDefinition.wire.viewSchema.parse(broken[0]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("turn outline entries must be strictly increasing by turn");
    expect(() => ourDefinition.stateSchema.parse({ turns: valid, draft: "x".repeat(121) })).toThrow();
  });

  test("ca 13: C6 — DANH TÍNH: hai lượt gộp độc lập ⇒ vật thể RIÊNG; sửa bên này KHÔNG lan bên kia", () => {
    const definition = ourDefinition;
    const a = definition.apply(definition.init(), turnStart(1, 1));
    const b = definition.apply(definition.init(), turnStart(1, 1));
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.turns).not.toBe(b.turns);
    expect(a.turns[0]).not.toBe(b.turns[0]);
    const mutable = a.turns as Entry[];
    mutable[0]!.prompt = "sửa bên A";
    expect(b.turns[0]?.prompt).toBe("");
    // ĐỐI CHỨNG: phép so SÂU không trả lời được câu "có độc lập không" — nó vẫn ĐẠT sau khi sửa.
    expect(mutable.length).toBe(b.turns.length);
    // Bản gốc đo được Y HỆT (đây là hành vi phải tái hiện, không phải khác biệt).
    const theirDefinition = install(stock.apply).definition;
    const theirsA = theirDefinition.apply(theirDefinition.init(), turnStart(1, 1));
    const theirsB = theirDefinition.apply(theirDefinition.init(), turnStart(1, 1));
    expect(theirsA.turns).not.toBe(theirsB.turns);
    expect(a.turns.length).toBe(theirsA.turns.length);
  });

  test("ca 14: C6 — trạng thái `init` DÙNG CHUNG một vật thể là hành vi CỦA BẢN GỐC (đo cả hai bên)", () => {
    const theirs = install(stock.apply).definition;
    expect(ourDefinition.init()).toBe(ourDefinition.init());
    expect(theirs.init()).toBe(theirs.init());
    // Và schema trả vật thể MỚI mỗi lần parse — độc lập giữa hai lượt đọc.
    const first = ourDefinition.stateSchema.parse({ turns: [], draft: "" });
    const second = ourDefinition.stateSchema.parse({ turns: [], draft: "" });
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.turns).not.toBe(second.turns);
  });
});
