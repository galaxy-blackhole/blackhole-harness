/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop dong cua duong mount: CHI cot MUC = chan moi duoc chan row; moi muc khac in ra nhung VAN mount
 */

import { describe, expect, test } from "bun:test";
import { parseRowVerdicts } from "../../apps/cli/src/mount.ts";

describe("hop dong duong mount — cot MUC la hop dong, khong phai goi y", () => {
  test("ca 1: muc chan ⇒ duoc dua vao danh sach chan (row KHONG mount)", () => {
    const line = "| gbh-client-x | chan | artifact dang ky 2 id module |";
    const verdicts = parseRowVerdicts(line);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]?.level).toBe("chan");
    expect(verdicts[0]?.pkg).toBe("@galaxy-blackhole/gbh-client-x");
  });

  test("ca 2: CA THAT 18/10/2026 — canh bao co chu 'chan' trong CAU van KHONG duoc chan row", () => {
    // Nguyen van dong da BO QUA 2 row that (ui-permission-presets, ui-settings-subagent) vi duong mount
    // substring-match chu 'chan' tren CA DONG thay vi doc cot muc:
    const line = "| gbh-client-ui-permission-presets | canh bao | artifact con cong chan KHAO THEO ctx (installedContexts) |";
    const verdicts = parseRowVerdicts(line);
    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]?.level).toBe("canh bao");
    // Duong mount chi chan khi level === chan ⇒ row nay VAN mount (va duoc in ra voi chu 'van mount').
    const blocked = verdicts.filter((v) => v.level === "chan");
    expect(blocked).toEqual([]);
  });

  test("ca 3: dong khong phai bang phan quyet bi bo qua (khong lam mount hong)", () => {
    const noise = "KET LUAN: 0 van de CHAN mount\npatch dang chay: /x/app.patch.yml\n| | | |";
    expect(parseRowVerdicts(noise)).toEqual([]);
  });
});
