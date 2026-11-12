/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ca canh so bien nhan staged cua gbh-client-file-upload (nua host): stage · resolve ·
 *      bindPrompt (guard commit/dispose) · retire · forget, khoa theo DANH TINH phien (WeakMap).
 */
import { describe, expect, test } from "bun:test";
import { PromptFileBindingGuard, StagedFiles } from "../../packages/client/file-upload/src/staged-files.ts";

/** Tham chiếu tệp dùng chung cho mọi ca. */
const FILE = { attachmentId: "a1", name: "n.txt", bytes: 2 };

/** Phiên giả: mỗi lần tạo là một ĐỐI TƯỢNG mới (đúng khoá WeakMap của bản gốc). */
function session(): { id: string } {
  return { id: "s1" };
}

describe("sổ biên nhận staged — stage/resolve/bind/retire/forget", () => {
  test("stage rồi resolve theo ĐÚNG đối tượng phiên; phiên khác ⇒ undefined", () => {
    const files = new StagedFiles();
    const s1 = session();
    files.stage(s1, "r1", FILE);
    expect(files.resolve(s1, "r1")).toEqual(FILE);
    expect(files.resolve(session(), "r1")).toBeUndefined();
    expect(files.resolve(s1, "rX")).toBeUndefined();
  });

  test("C6 DANH TÍNH: hai đối tượng phiên khác nhau KHÔNG dùng chung sổ", () => {
    const files = new StagedFiles();
    const first = session();
    const second = session();
    files.stage(first, "r1", FILE);
    expect(files.resolve(first, "r1")).toEqual(FILE);
    expect(files.resolve(second, "r1")).toBeUndefined();
    files.stage(second, "r2", FILE);
    expect(files.retire(first, "p1")).toBe(0);
    expect(files.resolve(second, "r2")).toEqual(FILE);
  });

  test("bindPrompt gắn requestId; guard khôi phục về trạng thái CŨ (kể cả xoá khi trước đó chưa gắn)", () => {
    const files = new StagedFiles();
    const s1 = session();
    files.stage(s1, "r1", FILE);
    const first = files.bindPrompt(s1, ["r1"], "p1");
    expect(files.retire(s1, "p1")).toBe(1);
    files.stage(s1, "r1", FILE);
    const again = files.bindPrompt(s1, ["r1"], "p1");
    const second = files.bindPrompt(s1, ["r1"], "p2");
    second[Symbol.dispose](); // khôi phục requestId về p1
    expect(files.retire(s1, "p1")).toBe(1); // ⇒ gỡ được THEO p1 ⇒ chứng minh guard đã khôi phục đúng
    expect(files.resolve(s1, "r1")).toBeUndefined(); // retire XOÁ biên nhận (đúng bản gốc)
    first[Symbol.dispose](); // guard cũ chạy trên bản ghi đã gỡ: phải không ném
    again[Symbol.dispose]();
    expect(files.retire(s1, "p1")).toBe(0);
  });

  test("bindPrompt với biên nhận chưa staged ⇒ RemoteError session/attachment-invalid + FILE_NOT_STAGED", () => {
    const files = new StagedFiles();
    const s1 = session();
    files.stage(s1, "r1", FILE);
    let thrown: unknown;
    try {
      files.bindPrompt(s1, ["r1", "rX"], "p1");
    } catch (error) {
      thrown = error;
    }
    const failure = thrown as { code: string; message: string; details: Record<string, unknown>; isDSHRemoteError: boolean };
    expect(failure.code).toBe("session/attachment-invalid");
    expect(failure.message).toBe("File was not uploaded for this session.");
    expect(failure.details).toEqual({ reason: "FILE_NOT_STAGED" });
    expect(failure.isDSHRemoteError).toBe(true);
    expect(files.retire(s1, "p1")).toBe(0); // r1 phải còn nguyên trạng thái chưa gắn
  });

  test("retire chỉ gỡ biên nhận của ĐÚNG prompt đó", () => {
    const files = new StagedFiles();
    const s1 = session();
    files.stage(s1, "r1", FILE);
    files.stage(s1, "r2", FILE);
    files.bindPrompt(s1, ["r1"], "p1");
    files.bindPrompt(s1, ["r2"], "p2");
    expect(files.retire(s1, "p1")).toBe(1);
    expect(files.resolve(s1, "r1")).toBeUndefined();
    expect(files.resolve(s1, "r2")).toEqual(FILE);
    expect(files.retire(s1, "p2")).toBe(1);
    expect(files.retire(s1, "p2")).toBe(0);
  });

  test("guard.commit() ⇒ dispose() KHÔNG khôi phục (prompt đã gửi)", () => {
    const files = new StagedFiles();
    const s1 = session();
    files.stage(s1, "r1", FILE);
    const guard = files.bindPrompt(s1, ["r1"], "p1");
    guard.commit();
    guard[Symbol.dispose]();
    expect(files.retire(s1, "p1")).toBe(1); // vẫn gắn p1 ⇒ đã commit
  });

  test("dispose hai lần chỉ rollback MỘT lần; guard là lớp đúng hợp đồng", () => {
    let rollbacks = 0;
    const guard = new PromptFileBindingGuard(() => {
      rollbacks += 1;
    });
    guard[Symbol.dispose]();
    guard[Symbol.dispose]();
    expect(rollbacks).toBe(1);
  });

  test("forget xoá TOÀN BỘ biên nhận của một phiên (sự kiện session/disposed)", () => {
    const files = new StagedFiles();
    const s1 = session();
    files.stage(s1, "r1", FILE);
    files.stage(s1, "r2", FILE);
    files.forget(s1);
    expect(files.resolve(s1, "r1")).toBeUndefined();
    expect(files.resolve(s1, "r2")).toBeUndefined();
    expect(files.retire(s1, "p1")).toBe(0);
  });
});
