/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 07/11/2026
 * desc Nhật ký P3 (quyển 3): tiếp quyển 2 — LUẬT VÀNG sửa giao diện client, bản dịch tiếng Việt.
 */

## 92. Chặng 126-127 — LUẬT VÀNG về sửa giao diện client (rút từ 4 lần làm hỏng app)

### Hiện tượng

Vá tay `packages/client/<gói>/lib/client.js` (thêm CSS, bớt hàng, chèn từ điển VI) ⇒ **test đơn vị vẫn XANH**
nhưng khi chạy app thật thì hiện màn hình *"Failed to load plugins — N entries did not activate … loading"*.

### Nguyên nhân

Host phục vụ client theo **một URL ghép nhiều gói**: `/plugins/??a/client.js,b/client.js,c/client.js`. Mỗi tệp
phải tự đăng ký module qua `__ModuleLoader__.load(<id>)`. Chỉ cần một tệp trong chuỗi ghép bị lệch (thiếu
dấu chấm phẩy cuối, khối bị cắt, biến trùng tên) là **cả chunk** mất đăng ký ⇒ nhiều plugin cùng chết,
kể cả những plugin không bị sửa.

Đã gặp 4 lần: (1) chèn từ điển inline `vi: JSON.parse("…")`; (2) `const vi = { ...en }`; (3) thêm CSS row;
(4) xoá hàng phiên bản. Lần nào `bun test` cũng xanh.

### LUẬT

**#61** KHÔNG sửa tay `lib/client.js` của gói client. Chỉ hai đường hợp lệ:
  (a) gói **build từ `src`** ⇒ sửa `src/` rồi `bun run build.ts`;
  (b) gói **de-bundle** (`src/parts/` có, build chỉ chép `lib/`) ⇒ muốn đổi phải chuyển gói sang build từ `src` trước.

**#62** Test xanh KHÔNG chứng minh app còn chạy. Mọi thay đổi phải kiểm bằng **ảnh chụp app thật**
(`tools/dev/shot.ts` + `tools/dev/shot-tab.ts`) trước khi báo hoàn thành.

**#63** Sau mỗi bước đã kiểm chứng: tạo backup riêng (`/tmp/gbh-ok-bN`) để bước sau chỉ cần lùi một bước.

### Trạng thái chốt chặng 127

`bun run gate` **XANH 8/8** (208 176 ms) · app **LÀNH** · backup `/tmp/gbh-ok-b5`.
Đã xong: sửa `typecheck` cho `@xterm/*` (khai báo kiểu, 2 668 file 0 vi phạm), trả test `ui-settings-general` về 9 slot.
Còn lại: chuyển `ui-settings-general` + `settings-about` sang build từ `src` (để tách hàng công cụ + xoá hàng phiên bản),
nhãn "Agent preset", cài `@xterm` để terminal chạy thật, rà chuỗi tiếng Anh bằng ảnh.
