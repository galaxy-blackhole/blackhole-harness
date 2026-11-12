<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nhật ký mount của row ui-trajectory — giữ nguyên văn ghi chú gỡ mount của Lead 18/10/2026 04:06
-->

# Nhật ký mount — row `ui-trajectory`

## 18/10/2026 04:06 — Lead GỠ MOUNT (ghi chú nguyên văn, giữ lại để không mất dấu)

> GO MOUNT 18/10/2026 04:06 vi `check:rows` bao CHAN: thieu dang ky slot "conversation.view" ma ban goc co
> => mat chuc nang AM THAM (thieu slot khong gay loi console). Row da mount o luot boot 04:03 va app van LANH
> ve chi so, nhung chi so khong bat duoc thieu slot. DIEU KIEN MOUNT LAI: dang ky du slot conversation.view +
> `check:rows` 0 chan + test khang dinh TAP slot ta = TAP slot goc bang chinh hai regex cua check:rows.
> LUU Y: phep kiem regex tu che cua Lead (register\(\{name:".."\)) TRUOT vi ten slot viet bang HANG SO
> => dung check:rows lam chuan.

## Trạng thái sau khi viết lại (18/10/2026)

| Điều kiện mount lại | Bằng chứng đo được |
|---|---|
| Đăng ký đủ slot `conversation.view` | `src/parts/part-12.ts` giữ nguyên văn `ctx.slots.inject("conversation.view", () => ctx.slots.register({ name: "conversation.view", id: "trajectory", order: 10, …`, `TrajectoryView` là THAM SỐ THỨ HAI |
| Tập slot của ta = tập slot của bản gốc | test `tạp slot cua ta = TAP slot cua bundle goc` — dùng CHÍNH hai regex của `tools/check/rows.ts` |
| `check:rows` 0 dòng `chan` | chạy lại sau khi khôi phục `gbh.row` (xem cột "check:rows" trong báo cáo bàn giao) |
| Không mất nội dung âm thầm | test `than factory TRUNG KHOP TUNG BYTE` — so từng dòng với bundle gốc, chỉ khác 5 dòng `require` + khối cổng chống cài hai lần |

⚠️ Ghi chú về lần báo CHAN 04:06: nguồn `src/parts/` bị **cắt lại** trong lúc công cụ `tools/split-stock-bundle.ts`
đang chạy (nó `rmSync` thư mục đích trước khi ghi), nên phép đo rơi đúng vào cửa sổ thư mục rỗng ⇒ `readAllTs`
không thấy slot nào. Bản hiện tại đã cắt xong và có test canh tập slot, nên cửa sổ đó không còn lặng im.
