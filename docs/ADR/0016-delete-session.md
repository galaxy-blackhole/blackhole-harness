<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc ADR 0016 — thiết kế tính năng XOÁ PHIÊN (delete session): phạm vi, tầng chạm, thứ tự thi công
-->

# ADR 0016 — Xoá phiên (delete session)

## Bối cảnh

Hiện chỉ có **Lưu trữ** (`menu.archiveSession`): đánh dấu `archivedSessionIds` trong row-state, ẩn khỏi danh
sách, khôi phục được; nhật ký phiên VẪN nằm trên đĩa (`~/.galaxy/<home>/sessions/<workspace-key>/<sessionId>/`).
Người dùng cần một thao tác **xoá thật** để dọn phiên rác (phiên nháp, phiên thử, phiên lỗi).

## Phạm vi

### Bắt buộc

1. Mục menu ngữ cảnh **"Xoá phiên"** trong `sidebar.workspaces.session.menu.item` (slot KEYED, cắm thêm
   occupant từ gói của ta — KHÔNG sửa `ui-workspace` đang de-bundle).
2. Hộp xác nhận nêu rõ **không khôi phục được** + số liệu sẽ mất (số lượt, kích thước log).
3. Xoá thật: dừng phiên nếu đang chạy → gỡ nhật ký trên đĩa → biến mất khỏi danh sách ngay (không cần F5).
4. Chặn xoá phiên đang chạy turn: hoặc **dừng trước rồi xoá** (mặc định, có cảnh báo), hoặc từ chối —
   xem "Câu hỏi mở".

### Không làm trong lượt này

- Không có "thùng rác"/undo (xoá là mất; muốn cứu thì dùng tính năng tải nhật ký phiên trước).
- Không xoá theo lô, không xoá workspace.

## Kiến trúc dự kiến

| Tầng | Gói mới | Nội dung |
|---|---|---|
| Host | `gbh-host-session-delete` | Service `sessionDelete` + phương thức remote `sessionDelete/delete`: (1) tra phiên sống qua `ctx.get("sessions")`; (2) nếu đang chạy → uỷ quyền dừng qua seam `sessionController`; (3) gỡ thư mục nhật ký qua seam lưu trữ; (4) phát sự kiện để projection danh sách cập nhật |
| Client | `gbh-client-ui-session-delete` | Occupant slot `sidebar.workspaces.session.menu.item` (id `delete-session`, order 500) + `MenuItemButton` (icon thùng rác) + hộp thoại xác nhận (primitive) + gọi remote rồi toast |
| Bundle | patch layer `bundle-blackhole` (hoặc bundle đang bật) | Thêm 2 row; cập nhật `gbh.provenance` nếu có khai báo thay thế |
| Chất lượng | `tests/host/session-delete.test.ts` · `tests/client/ui-session-delete.test.ts` | Unit: chặn xoá phiên đang chạy, xoá đúng thư mục, idempotent; Client: menu item đúng slot/order, hộp xác nhận, gọi remote 1 lần |

## Spike — ĐÃ TRẢ LỜI (24/10/2026)

- Danh sách phiên mà client thấy đi qua `ctx.sessionQuery.listSessions()` → service **SQLite**
  (`session-query-sqlite`, `_reconcile`): nó so `persisted_sessions` trong DB với các bản ghi **quét từ đĩa**.
- `persistentDeletes = persistedRows.filter(row => !observation.persisted.has(row.id))` ⇒ **file mất thì
  lượt reconcile kế tiếp tự gỡ bản ghi chỉ mục**. Không cần API xoá riêng cho SQLite, không có nguy cơ
  "phiên mồ côi".
- Hệ quả thi công: đường xoá gọn còn **ba bước** — (1) dừng phiên nếu đang sống, (2) `rm -rf` đúng thư mục
  nhật ký trong `sessions/<workspace-key>/<sessionId>`, (3) gọi một lượt `listSessions()` để reconcile,
  rồi để client refresh danh sách.

## Trạng thái thi công (24/10/2026)

| Hạng mục | Trạng thái |
|---|---|
| Gói host `packages/host/session-delete` | ✅ **XONG** — service `sessionDelete`, endpoint `delete`, 7 mã lỗi có kiểu, 5 test ĐẠT; đã khai row `session-delete` trong `bundle/cordis.patch.yml` và mount thật trên host 5439 |
| Gói client `packages/client/ui-session-delete` | ✅ **XONG** — component + hộp xác nhận ở root tách rời + 9 khoá từ điển (zh/en/vi) + 5 test ĐẠT; row đã BẬT trong `bundle/web-app.patch.yml` |
| Vì sao tắt | Bảng module của TRÌNH DUYỆT không cho `require("@deepseek-ai/dsh-typert-protocol/remote-info")` ⇒ factory của row ném lỗi lúc nạp, app trắng (`#root` 206 ký tự). Đã comment row trong `bundle/web-app.patch.yml` để app lành lại (`check:app` (8) ĐẠT, 56.172 ký tự) |

### Đo thật trên app 24/10/2026 (probe trình duyệt)

| Điều | Kết quả |
|---|---|
| Mục menu trong sidebar | ✅ hiện **"Xoá phiên"** sau "Sao chép ID phiên" (đúng slot/id/order) |
| Hộp xác nhận | ✅ hiện đúng tiếng Việt: *"Xoá vĩnh viễn phiên này? “{tên}” sẽ bị xoá vĩnh viễn: toàn bộ nhật ký của phiên trên đĩa sẽ mất và KHÔNG khôi phục được… [Huỷ] [Xoá vĩnh viễn]"* |
| Bấm "Xoá vĩnh viễn" | ✅ **XOÁ THẬT** (đo 24/10/2026 22:57): thư mục nhật ký biến mất khỏi đĩa (`removed dirs: ["session-5b92745e-…"]`), hàng phiên biến mất khỏi sidebar, 0 lỗi console |

Hai lỗi tìm ra trong quá trình đo — đều đã sửa:

1. **Hộp thoại bị gỡ cùng menu**: menu ngữ cảnh đóng ngay khi chọn mục ⇒ mọi con của nó bị unmount. Sửa:
   hộp thoại dựng ở **React root TÁCH RỜI** (`react-dom/client.createRoot` trên một `div` gắn vào
   `document.body`), xem `src/dialog.ts`.
2. **Chốt an toàn "trông như nhật ký" quá chặt**: backend jsonl hiện hành ghi `session.v4.jsonl.zstd`
   (+ `session.lock`), KHÔNG phải `events*`. Sửa: chấp nhận `session.*` hoặc `events*`.
3. **Remote có thể trả phong bì `{ ok: false, error }`** thay vì ném: client giờ chỉ coi là xong khi kết quả
   nói `deleted === true`, mọi hình dạng khác đều ném để hộp thoại hiện lỗi (trước đó hộp thoại đóng im lặng).

### Việc còn lại (chặn cuối cùng, ~2–3 giờ)

Trình duyệt chỉ thấy namespace Remote có **spec được mount** bằng `ctx.remote.$mount(spec)`, và spec đó phải dựng bằng **bản `remote-info` NỘI BỘ** chứ không import gói stock. Khuôn đã có sẵn trong repo:
`packages/client/ui-cot-translation/src/client/remote-info.ts` (+ `typert-remote-client.ts`, `runtime-types.ts`), với `zod` lấy qua `require("zod")` của bảng module.

Ba bước (bước 1–2 ĐÃ XONG, xem `src/remote-info.ts` + `src/remote.ts`):
1. ✅ Chép bộ dựng `remote-info` vào `packages/client/ui-session-delete/src/`.
2. ✅ `src/remote.ts` dùng bộ dựng nội bộ, `zod` lấy qua `require("zod")` của bảng module.
3. ⏳ **Còn lại**: đưa hộp thoại ra khỏi cây mục menu — dựng **React root tách rời**
   (`react-dom/client` → `createRoot(document.body.appendChild(div))`) hoặc cắm vào một slot nền luôn sống;
   sau đó bỏ dấu `#` ở hai dòng row `ui-session-delete` trong `bundle/web-app.patch.yml`, build lại,
   restart, chạy lại probe bấm "Xoá vĩnh viễn" và kiểm: hàng biến mất khỏi sidebar + thư mục
   `sessions/<project>/<id>` mất khỏi đĩa.

### Bảo vệ dữ liệu đã có

- Lõi xoá (`deleteStoredSession`) có **7 test**: xoá thật thư mục + gọi đối soát chỉ mục; chặn khi
  `agents.get(id)` còn sống; id không an toàn; symlink không bị đi theo; thư mục ngoài gốc bị từ chối;
  thư mục không có `events*` bị từ chối.
- Row `ui-session-delete` hiện **đang comment** trong `bundle/web-app.patch.yml` để app không có mục menu
  "nửa vời"; bật lại bằng hai dòng đã ghi chú khi bước 3 xong.

## Ước lượng sau spike

| Việc | Thời lượng |
|---|---|
| Gói host `session-delete` + remote method + test | ~3 giờ |
| Gói client menu item + hộp xác nhận + test | ~2,5 giờ |
| Row/bundle/check:rows + ADR + đo trên app thật | ~1,5 giờ |

Tổng **~1 ngày công**, đúng như ước lượng ban đầu.

## Dọn phiên rác đầu tiên (24/10/2026, sau khi tính năng chạy)

Sau khi xoá thử thành công, đã dọn **53 phiên rác** trên host dev: phiên **rỗng không tiêu đề** (sinh ra bởi
các lượt thử "Phiên mới") và phiên **thử của agent** ("Đọc hiểu kỹ dự án…", "Liệt kê nội dung thư mục",
"Chạy lệnh liệt kê thư mục", "Trả lời đúng…"). Giữ lại 16 phiên, gồm **phiên đang chạy của Lead** và các
phiên có tên của người dùng.

Kết quả: `check:app` chỉ số **(9) bố cục khớp đường nền: 0/80 (0%) — ĐẠT**, đúng như dự đoán trước đó
(baseline lệch vì danh sách phiên tích luỹ, không phải lỗi mã). Toàn bộ **11/11 chỉ số ĐẠT**, app **LANH**.

## Rủi ro

- **Phá huỷ dữ liệu**: sai đường dẫn là mất nhật ký. Bắt buộc kiểm tra `realpath` nằm trong `sessions/` của
  đúng home trước khi `rm -rf`; không xoá theo id do client gửi nếu id không khớp mẫu UUID/thư mục con.
- Phiên đang chạy: phải dừng qua seam, không tự ý kill tiến trình.
- `ui-workspace` đang de-bundle: mọi thứ phía client phải cắm qua **slot**, không sửa artefact của gói đó.

## Câu hỏi mở (cần chốt trước khi thi công)

1. Phiên **đang chạy turn**: (a) dừng rồi xoá (mặc định tôi đề xuất), hay (b) từ chối và báo "dừng phiên trước".
2. Có cần **undo 5 giây** (giữ thư mục vào `trash/` tạm) không — an toàn hơn nhưng thêm việc dọn dẹp.
3. Xoá xong có nên **xoá luôn attachment** của phiên (`attachments/v1/...`) không.
