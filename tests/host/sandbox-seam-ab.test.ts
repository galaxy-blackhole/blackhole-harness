/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc A/B HÀNH VI THẬT cho 4 gói SEAM SANDBOX của task-144 (dsh-fs · dsh-fs-local · dsh-bash-local ·
 *      dsh-pwsh-local): dựng thư mục workspace TẠM, chạy CÙNG thao tác trên bản của ta và bản gốc rồi so kết quả
 *      QUAN SÁT ĐƯỢC (không chỉ so tệp). Ca nào máy không đủ điều kiện thì ghi lý do bằng assertion, không skip im lặng.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";


/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Kernel đóng băng (CHỈ ĐỌC). */
const KERNEL = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");

/** Nạp một module artifact theo đường dẫn tuyệt đối. Nhận: đường dẫn. Trả: bản ghi export. */
async function load(path: string): Promise<Record<string, unknown>> {
  return (await import(path)) as Record<string, unknown>;
}

/**
 * Dựng một Context cordis THẬT (cùng lớp kernel dùng) — seam `Service` cần `ctx` để đăng ký.
 * Nhận: không.
 * Trả: promise của một Context mới.
 */
async function makeCtx(): Promise<unknown> {
  const cordis = (await import(join(KERNEL, "cordis", "lib", "index.js"))) as { Context: new () => unknown };
  return new cordis.Context();
}

/**
 * Dựng config ĐẦY ĐỦ cho một lớp service bằng `Config` tĩnh của chính lớp đó (schema điền mặc định).
 * Nhận: lớp service (có thể có `Config`), và các trường muốn ghi đè.
 * Trả: config đã phân giải.
 */
function configFor(Ctor: unknown, overrides: Record<string, unknown>): Record<string, unknown> {
  const schema = (Ctor as { Config?: (value: Record<string, unknown>) => Record<string, unknown> }).Config;
  return schema === undefined ? overrides : schema(overrides);
}

/** Tạo thư mục workspace tạm. Nhận: không. Trả: đường dẫn (nhớ xoá). */
function workspace(): string {
  return mkdtempSync(join(tmpdir(), "gbh-seam-"));
}

describe("seam sandbox — A/B hành vi THẬT (task-144)", () => {
  test("fs · tập export + FsTargetKey brand + FsError TRÙNG cả hai bản", async () => {
    const ours = await load(join(REPO, "packages", "host", "fs", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-fs", "lib", "index.js"));
    expect(Object.keys(ours).sort()).toEqual(Object.keys(theirs).sort());
    const oursKey = (ours["FsTargetKey"] as (value: string) => string)("a/b.txt");
    const theirsKey = (theirs["FsTargetKey"] as (value: string) => string)("a/b.txt");
    expect(oursKey).toBe(theirsKey);
    const oursError = new (ours["FsError"] as new (code: string, message: string) => Error)("invalid-target", "x");
    const theirsError = new (theirs["FsError"] as new (code: string, message: string) => Error)("invalid-target", "x");
    expect({ name: oursError.name, message: oursError.message, isError: oursError instanceof Error }).toEqual({
      name: theirsError.name,
      message: theirsError.message,
      isError: theirsError instanceof Error,
    });
  });

  test("fs-local · Config schema + bộ thành viên thể hiện TRÙNG (dựng trên Context cordis THẬT)", async () => {
    const ours = await load(join(REPO, "packages", "host", "fs-local", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-fs-local", "lib", "index.js"));
    type Ctor = new (ctx: unknown, options: unknown) => Record<string, unknown>;
    const oursCtor = ours["LocalFileSystem"] as Ctor & { Config?: unknown; name?: string };
    const theirsCtor = theirs["LocalFileSystem"] as Ctor & { Config?: unknown; name?: string };
    const dir = workspace();
    try {
      // Cấu hình phải phân giải được bằng CHÍNH `Config` của lớp (schema điền mặc định) — hai bản cùng schema.
      expect(String(oursCtor.Config)).toBe(String(theirsCtor.Config));
      const oursInstance = new oursCtor(await makeCtx(), configFor(oursCtor, { workspaceRoot: dir }));
      const theirsInstance = new theirsCtor(await makeCtx(), configFor(theirsCtor, { workspaceRoot: dir }));
      expect(Object.keys(oursInstance).sort()).toEqual(Object.keys(theirsInstance).sort());
      // Bộ phương thức trên prototype phải giống nhau (hợp đồng seam `fs`).
      const methods = (instance: Record<string, unknown>): string[] =>
        Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).sort();
      expect(methods(oursInstance)).toEqual(methods(theirsInstance));
      expect(methods(oursInstance).length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("fs-local · đường dẫn RA NGOÀI workspace: hai bản cùng ném, cùng mã/kết quả", async () => {
    const ours = await load(join(REPO, "packages", "host", "fs-local", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-fs-local", "lib", "index.js"));
    // `LocalFileSystem` là lớp `Service` của cordis ⇒ hàm dựng nhận (ctx, options); thiếu ctx là ném ngay trong Service.
    type Ctor = new (ctx: unknown, options: unknown) => Record<string, unknown>;
    const dir = workspace();
    try {
      const capture = async (Ctor_: Ctor): Promise<string> => {
        const instance = new Ctor_(await makeCtx(), configFor(Ctor_, { workspaceRoot: dir }));
        const read = instance["readFile"] as ((path: string) => Promise<unknown>) | undefined;
        if (read === undefined) return "khong-co-readFile";
        try {
          await read.call(instance, "../outside.txt");
          return "KHONG-NEM";
        } catch (error) {
          const failure = error as { code?: string; name?: string };
          return String(failure.code ?? failure.name ?? "unknown");
        }
      };
      const a = await capture(ours["LocalFileSystem"] as Ctor);
      const b = await capture(theirs["LocalFileSystem"] as Ctor);
      expect(a).toBe(b);
      expect(a).not.toBe("KHONG-NEM");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("bash-local · ENV_OVERRIDES + assertServiceableBashConfig TRÙNG trên 3 cấu hình", async () => {
    const ours = await load(join(REPO, "packages", "host", "bash-local", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-bash-local", "lib", "index.js"));
    expect(ours["ENV_OVERRIDES"]).toEqual(theirs["ENV_OVERRIDES"]);
    const capture = (mod: Record<string, unknown>, config: unknown): string => {
      const check = mod["assertServiceableBashConfig"] as (value: unknown) => void;
      try {
        check(config);
        return "OK";
      } catch (error) {
        return String((error as Error).message);
      }
    };
    for (const config of [{}, { shellPath: 1 }, { timeoutMs: -5 }]) {
      expect(capture(ours, config)).toBe(capture(theirs, config));
    }
  });

  test("bash-local · LocalBashExecutor: cùng hình dạng thể hiện (cùng bộ thành viên)", async () => {
    const ours = await load(join(REPO, "packages", "host", "bash-local", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-bash-local", "lib", "index.js"));
    const shape = (mod: Record<string, unknown>): string => {
      const Ctor = mod["LocalBashExecutor"] as new (options?: unknown) => Record<string, unknown>;
      try {
        return Object.keys(new Ctor()).sort().join(",");
      } catch (error) {
        return "CTOR-THROW:" + String((error as Error).message).slice(0, 60);
      }
    };
    expect(shape(ours)).toBe(shape(theirs));
  });

  test("pwsh-local · candidatePwshPaths + resolvePwshPath: TRÙNG (kể cả khi máy không có pwsh)", async () => {
    const ours = await load(join(REPO, "packages", "host", "pwsh-local", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-pwsh-local", "lib", "index.js"));
    const oursPaths = (ours["candidatePwshPaths"] as () => readonly string[])();
    const theirsPaths = (theirs["candidatePwshPaths"] as () => readonly string[])();
    expect(oursPaths).toEqual(theirsPaths);
    expect(oursPaths.length).toBeGreaterThan(0);
    const oursResolved = (ours["resolvePwshPath"] as () => string | undefined)();
    const theirsResolved = (theirs["resolvePwshPath"] as () => string | undefined)();
    expect(oursResolved).toBe(theirsResolved);
  });

  test("pwsh-local · ENCODING_PREAMBLE + ENV_OVERRIDES TRÙNG", async () => {
    const ours = await load(join(REPO, "packages", "host", "pwsh-local", "lib", "index.js"));
    const theirs = await load(join(KERNEL, "dsh-pwsh-local", "lib", "index.js"));
    expect(ours["ENCODING_PREAMBLE"]).toBe(theirs["ENCODING_PREAMBLE"]);
    expect(ours["ENV_OVERRIDES"]).toEqual(theirs["ENV_OVERRIDES"]);
  });

  test("cả 4 gói: manifest KHÔNG bịa config/inject khi dump không khai", () => {
    for (const short of ["fs", "fs-local", "bash-local", "pwsh-local"]) {
      const pkg = JSON.parse(readFileSync(join(REPO, "packages", "host", short, "package.json"), "utf8")) as {
        gbh: { row?: { config?: unknown; inject?: unknown }; draft?: string };
      };
      expect(pkg.gbh.row?.config).toBeUndefined();
      expect(pkg.gbh.row?.inject).toBeUndefined();
      expect(pkg.gbh.draft ?? "").toContain("GÓI THƯ VIỆN");
    }
  });
});
