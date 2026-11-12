/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 25/10/2026
 * desc Test provider PhoWhisper: cấu hình, ngôn ngữ, máy trạng thái chuẩn bị, dựng argv, lỗi.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { languages, PhoWhisperWorker, PROVIDER_ID, runPythonJson, Config, markerPathOf } from "../../packages/host/speech-to-text-phowhisper/src/index.ts";

/** Thư mục tạm cho mỗi test. */
const dirs: string[] = [];

/**
 * Tạo dataRoot tạm.
 * Nhận: không. Trả: đường dẫn.
 */
function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "gbh-phowhisper-"));
  dirs.push(dir);
  return dir;
}

/**
 * Cấu hình tối thiểu.
 * Nhận: over — ghi đè. Trả: Config.
 */
function configOf(over: Partial<ReturnType<typeof Config>> = {}): ReturnType<typeof Config> {
  return Config({ dataRoot: tempRoot(), ...over });
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.GBH_PHOWHISPER_TEST;
});

describe("phowhisper — khai báo", () => {
  test("id + ngôn ngữ: auto/vi/en (có tiếng Việt)", () => {
    expect(PROVIDER_ID).toBe("phowhisper");
    expect([...languages]).toEqual(["auto", "vi", "en"]);
  });

  test("Config: mặc định hợp lý, dataRoot bắt buộc", () => {
    const config = configOf();
    expect(config.providerId).toBe("phowhisper");
    expect(config.model).toBe("vinai/PhoWhisper-large");
    expect(config.device).toBe("cpu");
    // dataRoot nay có mặc định (suy ra từ GBH_HOME/DSH_HOME) nên Config({}) KHÔNG ném nữa.
    expect(Config({}).dataRoot.length).toBeGreaterThan(0);
  });
});

describe("phowhisper — máy trạng thái chuẩn bị", () => {
  test("inspect(): chưa có marker ⇒ unprepared", () => {
    const worker = new PhoWhisperWorker("/runtime", configOf());
    worker.inspect();
    expect(worker.snapshot().phase).toBe("unprepared");
  });

  test("inspect(): có marker đúng model ⇒ standby, mọi bước complete", () => {
    const config = configOf();
    writeFileSync(markerPathOf(config.dataRoot), JSON.stringify({ model: config.model }));
    const worker = new PhoWhisperWorker("/runtime", config);
    worker.inspect();
    const state = worker.snapshot();
    expect(state.phase).toBe("standby");
    expect(state.steps.every((step) => step.status === "complete")).toBe(true);
  });

  test("prepare(): chạy check rồi download, ghi marker, phát trạng thái cho subscriber", async () => {
    const config = configOf();
    const calls: string[][] = [];
    const worker = new PhoWhisperWorker("/runtime", config, async (_python, argv) => {
      calls.push([...argv]);
      return { ok: true };
    });
    const seen: string[] = [];
    worker.subscribe(() => seen.push(worker.snapshot().phase));
    await worker.prepare();
    expect(calls).toHaveLength(2);
    expect(calls[0]?.at(-1)).toBe("--check-only");
    expect(calls[1]).toContain("--model");
    expect(worker.snapshot().phase).toBe("ready");
    expect(JSON.parse(readFileSync(markerPathOf(config.dataRoot), "utf8")).model).toBe(config.model);
    expect(seen).toContain("checking");
    expect(seen.at(-1)).toBe("ready");
  });

  test("prepare(): python báo lỗi ⇒ phase failed kèm detail, ném lỗi", async () => {
    const worker = new PhoWhisperWorker("/runtime", configOf(), async () => ({ ok: false, error: "thiếu torch" }));
    await expect(worker.prepare()).rejects.toThrow("thiếu torch");
    const state = worker.snapshot();
    expect(state.phase).toBe("failed");
    expect(state.detail).toContain("thiếu torch");
  });
});

describe("phowhisper — nhận dạng", () => {
  test("transcribe(): chưa chuẩn bị ⇒ ném lỗi rõ ràng", async () => {
    const worker = new PhoWhisperWorker("/runtime", configOf());
    await expect(worker.transcribe({ audio: new Uint8Array([1, 2]), language: "vi" })).rejects.toThrow("chưa được chuẩn bị");
  });

  test("transcribe(): dựng đúng argv (model/dataRoot/audio/language/device) và trả text", async () => {
    const config = configOf();
    writeFileSync(markerPathOf(config.dataRoot), JSON.stringify({ model: config.model }));
    const calls: string[][] = [];
    const worker = new PhoWhisperWorker("/runtime", config, async (_python, argv) => {
      calls.push([...argv]);
      return { ok: true, text: "xin chào" };
    });
    const result = await worker.transcribe({ audio: new Uint8Array([0, 1, 2]), language: "vi" });
    expect(result).toEqual({ text: "xin chào" });
    const argv = calls[0] ?? [];
    expect(argv[0]).toBe("/runtime/transcribe.py");
    expect(argv).toContain("--language");
    expect(argv[argv.indexOf("--language") + 1]).toBe("vi");
    expect(argv[argv.indexOf("--model") + 1]).toBe(config.model);
    expect(argv[argv.indexOf("--device") + 1]).toBe("cpu");
  });

  test("transcribe(): python trả ok=false ⇒ ném lỗi kèm thông điệp", async () => {
    const config = configOf();
    writeFileSync(markerPathOf(config.dataRoot), JSON.stringify({ model: config.model }));
    const worker = new PhoWhisperWorker("/runtime", config, async () => ({ ok: false, error: "model hỏng" }));
    await expect(worker.transcribe({ audio: new Uint8Array([1]), language: "auto" })).rejects.toThrow("model hỏng");
  });
});

describe("phowhisper — runPythonJson", () => {
  test("in JSON ở dòng cuối ⇒ parse được; thoát mã khác 0 ⇒ ném lỗi kèm stderr", async () => {
    const ok = await runPythonJson("python3", ["-c", "print('noise'); print('{\"ok\": true}')"], 15_000);
    expect(ok).toEqual({ ok: true });
    await expect(runPythonJson("python3", ["-c", "import sys; sys.stderr.write('boom'); sys.exit(3)"], 15_000)).rejects.toThrow("mã 3");
    await expect(runPythonJson("python3", ["-c", "print('khong-phai-json')"], 15_000)).rejects.toThrow("không in JSON");
  });
});
