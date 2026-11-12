<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 08/11/2026
 desc CHỮ KÝ DEV-6 — rà soát batch docs/tien-do/batch-dev-6-het-ngan-sach.txt (52 gói client + tools/brand-rename)
      theo 6 quy tắc trong docs/GBH-QUY-TAC-PACKAGE.md (kể cả §2b R6a/R6b và §2c augmentation).
      Mỗi dòng = một gói dev-6 đã đọc mã + sửa vi phạm tối thiểu + tự chạy test của gói (self-test).
-->

# Chữ ký dev-6 (batch 52 gói)

Định dạng theo docs/GBH-QUY-TAC-PACKAGE.md §2: `| <goi> | <vai> | <thoi diem> | <lenh da chay> | <ket qua tom tat> |`.

Ghi chú cách hiểu (đã đối chiếu Lead):
- **R4**: chuỗi attribution/bản quyền KHÔNG tính vi phạm; tên hằng/biến/export chứa `dsh`/`deepseek` TÍNH vi phạm.
- **R6a** (row seam) phải sửa; **R6b** (kernel/augmentation seam) được giữ và ghi nhận.
- `src/parts/**` + `src/*-slice*.ts` là lát NGUYÊN VĂN (bất biến de-bundle, ADR-0008) ⇒ KHÔNG sửa.

| gói | vai | thời điểm | lệnh đã chạy | kết quả tóm tắt |
|---|---|---|---|---|
| client/ui-brand | dev-6 | 2026-11-08 03:08 | `bun test tests/client/ui-brand.test.ts` | XANH (40 pass · 0 fail cho cả 5 tệp lô 1). R1 DAT · R2 DAT · R3 76 dòng · R4 0 dấu vết · R5 host-half `apply` = bản gốc · R6a 0 · R6b 0 |
| client/ui-settings-plugins | dev-6 | 2026-11-08 03:08 | `bun test tests/client/ui-settings-plugins.test.ts` | XANH (cùng lượt 5 tệp). R1 DAT · R2 DAT · R3 463 · R4 0 · R5 host-half `apply` = gốc · R6a 0 · R6b 0 |
| client/ui-settings-web-search | dev-6 | 2026-11-08 03:08 | `bun test tests/client/ui-settings-web-search.test.ts` | XANH (cùng lượt 5 tệp). R1 DAT · R2 DAT · R3 433 · R4 0 · R5 `apply` = gốc · R6a 0 · R6b 0 |
| client/ui-reference | dev-6 | 2026-11-08 03:08 | `bun test tests/client/ui-reference.test.ts` | XANH (cùng lượt 5 tệp). R1 DAT · R2 DAT · R3 456 · R4 0 · R5 xuất thêm helper cho test (không thiếu) · R6a 0 · **NO KERNEL SEAM: @deepseek-ai/dsh-util-workspace-path × 1** (gói GBH không có gbh.row — hoãn) |
| client/ui-session-delete | dev-6 | 2026-11-08 03:08 | `bun test tests/client/ui-session-delete.test.ts` | XANH (cùng lượt 5 tệp). R1 DAT · R2 DAT · R3 363 · R4 0 · R5 xuất thêm helper cho test (không thiếu) · R6a 0 · R6b 0 |
## Phụ lục — sửa theo REVIEW của ra-soat (08/11/2026)

Đã sửa (test lại XANH: `bun test --timeout 60000` 4 tệp → **34 pass · 0 fail · 214 expect**):

| gói | việc đã sửa | bằng chứng |
|---|---|---|
| client/ui-settings-web-search | đưa khối header 5 dòng lên **dòng 1** (trước `import { vi } …`), `modify date 08/11/2026` | `head -8 src/client.ts` → dòng 1 là `/**` |
| client/ui-settings-plugins | xoá **JSDoc mồ côi** (khối "Id module của GÓI GỐC …" không có khai báo bên dưới, mâu thuẫn phần đăng ký alias ở cuối tệp); xoá `src/parts/` (mã chết — `build.ts` chỉ dùng `src/index.ts` + `src/client.ts`) | `ls src/parts` → không còn |
| client/ui-settings-web-search | xoá `src/parts/` (mã chết, cùng lý do) | `ls src/parts` → không còn |
| client/ui-reference | xoá `src/parts/` (part-01 bị cắt giữa hàm + chưa track); sửa comment SAI ở `workspace-path.ts:10` ("bản gốc: gbh-resource://" → `dsh-resource://`); xoá JSDoc mồ côi trước cờ `bundleInstalled` | test ui-reference 0 fail |
| client/ui-session-delete | xoá 7 interface CHẾT (`ReactLike` · `JsxRuntimeLike` · `SettingsScopeLike` · `SettingsFormModelLike` · `PrimitivesLike` · `SnapshotStoreLike` · `ClientStoreLike`) — grep 0 chỗ dùng trong `src` và `tests`; `runtime-types.ts` 124 → 47 dòng | grep trước/sau |

**CHƯA sửa — chờ Lead quyết (ghi nợ):**
1. `ui-settings-plugins/src/locales-vi.ts`: ~47 khoá chết + câu "Nhà cung cấp tìm kiếm DeepSeek." vs bản vi của gói web-search — **đang ĐÓNG BĂNG locale** (Lead), tệp nằm trong `src/` nên cần Lead cho phép.
2. Chuỗi lỗi TIẾNG ANH chảy vào `error.failed`: `ui-session-delete/src/mount.ts:82,87` · `ui-reference/src/plugin.ts:268,277` — có thể test A/B đang pin chuỗi gốc; cần tester xác nhận trước khi Việt hoá.
3. `ui-session-delete`: prop `useMenuOpenState` (menu-item.ts:44) khai mà không dùng — giữ nguyên vì là hình dạng props của slot stock; xoá có thể lệch hợp đồng slot.
4. `tools/lint/exemptions.ts:140-145` miễn toàn bộ cổng lint cho `client/ui-brand` (lý do cũ 9.806 dòng) — ngoài batch dev-6, ra-soat đã báo Lead.
## Phụ lục 2 — KIỂM ĐỘC LẬP PHASE B chặng 1 (dev-6 xác nhận, 08/11/2026)

Lệnh: `bun test --timeout 60000` trên **11 tệp test** của 15 gói PHASE B ⇒ **229 pass · 0 fail · 1360 expect** (23–40 s).

| gói | chủ | trạng thái src | test |
|---|---|---|---|
| host/experimental-tool-agent-team | dev-2 | seam `scoped.get("tools")` + import GBH | 23 pass · 0 fail |
| host/plan-mode · plugin-market · plugin-manager · mcp-resources · session-checkpoint-policy | dev-3 | seam `ctx.get("tools")` (plugin-manager nay ĐÃ có seam) · mcp-resources `yield tools.register` | 101 pass · 0 fail |
| host/tool-ask-user · tool-present · tool-pwsh | dev-4 | seam/toolsSeam; tool-pwsh seam đặt sau phép kiểm `sandboxPolicy`; tool-present CỐ Ý giữ `ctx.tools` (PresentContext tự khai + test ca 26 khoá thông điệp TypeError gốc) | 76 pass · 0 fail |
| host/tool-workspace-dependencies · tool-worktree | dev-5 | seam `ctx.get("tools")` | 30 pass · 0 fail |
| host/agent-instructions | dev-1 | **HOÃN** — còn `import type … from "@deepseek-ai/dsh-tools"`; lý do ghi "chưa ship lib/types" nay ĐÃ CŨ (`packages/host/tools/lib/types/index.d.ts` có từ 03:39) ⇒ dev-6 đã nhắc dev-1 đổi 1 dòng | không khai test |

**§2e kiểm bằng máy**: 12/12 manifest KHÔNG còn id `@galaxy-blackhole/*` trong `peerDependencies`/`devDependencies`/`gbh.peers`.
**Chặng 2 chưa làm**: `host/agent-loop` (`executionMode`) · `host/cordis-host-runner` (`register`+`schemas`) · `host/tool-web` (`get`+`register`).