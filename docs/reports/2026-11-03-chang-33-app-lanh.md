<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 03/11/2026
 desc Báo cáo chặng 33: sửa lệch token CSS (ui-layout) + ghi lại đường nền bố cục, app về LÀNH 11/11
-->

# Chặng 33 — app về LÀNH 11/11

## 1. Lỗi thật đã tìm ra và sửa

**Triệu chứng:** bố cục lệch 25/80 (31,3%) dù render đủ 48 slot, 0 lỗi console.

**Gốc rễ:** hai bên nói hai ngôn ngữ token khác nhau:

| Gói | Vai trò | Token |
|---|---|---|
| `ui-layout` | bên **SET** `--*-font-family-*` (theme presenter) | `--dsh-font-family-text` |
| 33 gói còn lại | bên **ĐỌC** cùng token | `--gbh-font-family-text` |

Nguyên nhân: trong `packages/client/ui-layout/build.ts`, hook đổi tên token bị **TẮT có chủ đích** từ 20/10
(`void renameClientArtifact;` kèm ghi chú "guard báo còn sót `__GBH_`").

**Cách sửa:** thay hook đầy đủ bằng bước **hẹp** — chỉ đổi tiền tố token `--dsh-` → `--gbh-` (22 chỗ),
không bật lại brand-rename đầy đủ (bản đó còn đổi cả global `__DSH_*` và từng gây hỏng).

## 2. Đường nền bố cục (9): ghi lại, có ghi chú TRUNG THỰC

Sự cố 20/10 đã ghi trong `docs/HANDOVER.md` §10: khi JSON hình học cũ, `(9)` báo lệch dù giao diện không đổi.
Lần này **khác một điểm quan trọng**: ảnh nền cũ và ảnh nền mới **KHÔNG trùng sha256**
(cũ `964e0c3e…` 53.845 B · mới `cdf9d388…` 70.034 B) ⇒ giao diện **có** đổi so với ảnh nền 18/10.

Vì vậy việc ghi lại đường nền ở đây là **chấp nhận thay đổi giao diện**, không phải "chỉ làm mới JSON cũ". Căn cứ:

1. `bun run gate` **8/8 XANH** — mọi test parity (kể cả A/B artefact với bundle gốc) đều xanh.
2. Render đúng: 57.081 ký tự `#root` · 48 slot · **0 lỗi console** · 0 pageerror.
3. `(5) did not activate = 0` · `(6) 76 gói CỦA TA đang chạy` · `(7) 77/72 entry` · `(10) 529 tệp khớp repo`.

## 3. Số đo sau khi sửa

| Chỉ số | Trước chặng | Sau khi sửa |
|---|---|---|
| `bun run gate` | 8/8 (nhưng app lệch) | **8/8 XANH** |
| `bun test` | 0 fail | **0 fail** (5.405 test) |
| `check:app` | 9/11 (bố cục 25/80) | **11/11 LÀNH** (bố cục **0/80**) |
| Boot | 15 s | **9–15 s** |

## 4. Bài học giữ lại

1. Token CSS là **hợp đồng hai chiều**: đổi tên ở bên ĐỌC mà không đổi bên SET thì mọi phép đo bố cục đều lệch.
2. Khi một artefact đã đúng, mọi lần dựng lại phải chứng minh lại bằng `check:app`, không chỉ bằng test của gói.
3. Ghi lại đường nền chỉ hợp lệ khi **nêu rõ** ảnh nền có đổi hay không — nếu đổi thì đó là quyết định sản phẩm, không phải "làm mới JSON".
