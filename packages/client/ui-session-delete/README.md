<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 24/10/2026
 desc Gói client ui-session-delete — mục "Xoá phiên" trong menu ngữ cảnh sidebar + hộp xác nhận (ADR 0016)
-->

# @galaxy-blackhole/gbh-client-ui-session-delete

Một occupant trong slot KEYED `sidebar.workspaces.session.menu.item` (id `delete-session`, order `500`):
mục menu **"Xoá phiên"** kèm hộp thoại xác nhận, gọi Remote `sessionDelete.delete`.

## Vì sao cắm qua slot

`ui-workspace` đã **de-bundle** (artefact = bản gốc + Δid, có cổng byte). Mọi thứ phía client vì thế phải cắm
qua **slot** — đúng cách gói này làm, không sửa một dòng nào của `ui-workspace`. Slot do node sidebar khai nên
lượt đăng ký đi qua `ctx.slots.inject(...)`; đăng ký trực tiếp lúc `apply` sẽ ném
`slot "sidebar.workspaces.session.menu.item" is not declared`.

## Hộp xác nhận (yêu cầu của Lead 24/10/2026)

Dùng đúng khuôn "Xoá workspace": `primitives.Modal` + `title`/`description` + footer hai `Button`
(Huỷ / **Xoá vĩnh viễn**), dòng `role="status"` khi đang xoá và `role="alert"` khi lỗi. Lời cảnh báo nêu rõ
**không khôi phục được** và phiên đang chạy phải dừng trước.

⚠️ Hộp thoại **KHÔNG** nằm trong cây của mục menu: menu ngữ cảnh đóng ngay khi chọn mục nên mọi con của nó
bị unmount (đo thật 24/10/2026 — hộp thoại biến mất trước khi kịp xác nhận). Nó được dựng ở một **React root
tách rời** (`react-dom/client.createRoot` trên `div` gắn vào `document.body`), xem `src/dialog.ts`.

## Từ điển

| Ngôn ngữ | Nơi khai |
|---|---|
| `zh` + `en` | `src/locales.ts` của gói này (9 khoá) |
| `vi` | `packages/client/locale/src/locales-vi.ts` (`viSessionDelete`), đăng ký qua `STOCK_DICTIONARIES` |

## Kiểm thử

`tests/client/ui-session-delete.test.ts` — cây element có `MenuItemButton` + `Modal` + đúng hai `Button`, câu
cảnh báo chứa tiêu đề phiên và "cannot be restored", ba mã lỗi Remote được dịch, và lượt đăng ký cắm **đúng
một** occupant với `name/id/order/locale` của ta.
