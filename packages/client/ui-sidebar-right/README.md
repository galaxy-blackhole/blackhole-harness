<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua goi @galaxy-blackhole/gbh-client-ui-sidebar-right — ban viet lai cua row ui-sidebar-right
-->

# @galaxy-blackhole/gbh-client-ui-sidebar-right

Bản viết lại của Galaxy Blackhole cho row `ui-sidebar-right` của DSH
(`@deepseek-ai/dsh-client-ui-sidebar-right`, bản gốc **5.013 dòng** bundle).

## Gói này làm gì

Toàn bộ cột phải của khung: trạng thái neo theo phiên, panel, nút mở rộng và dịch vụ điều hướng trên đó.

- **Chỗ ngồi `rightbar`** — khung thanh bên phải (do `ui-layout` sở hữu ô lưới) và con `rightbar.session`
  (single, phạm vi phiên) chứa thân của một phiên.
- **Hai mặt dịch vụ**: `sidebarRightTabs` (sổ đăng ký loại tab) và `sidebarRight` (bộ điều khiển
  pane/tab) — cả hai cấp qua `ctx.reflect.provide`, đúng như bản gốc; các row khác
  (`ui-subagent`, `ui-deliverables`, `ui-plan`, `ui-sidebar-documentpreview`) inject hai mặt này.
- **Nút mở rộng** trong hàng đầu phiên (`conversation.session.header.corner`) và **tab hướng dẫn**
  (loại tab `guide`) trong hai slot KEYED `sidebar.right.pane.tab` · `sidebar.right.pane.tab.title`.
- **Bốn lệnh bàn phím** (toggle · split · fullscreen · close/refresh) và bộ quan sát tiêu điểm DOM.

## Row này thay gì

| | |
|---|---|
| Row gốc | `ui-sidebar-right` (`@deepseek-ai/dsh-client-ui-sidebar-right`) |
| Id module bundle tự khai | `@galaxy-blackhole/gbh-client-ui-sidebar-right` (ĐÚNG MỘT id) |
| Id gốc | chỉ khai ở `gbh.row.aliases` — tầng nạp tự sinh entry alias |
| Nguồn đối chiếu | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js` (**chỉ đọc**), md5 `673d417a476d664dddde25607bf56ef0` |
| Mức độ dẫn xuất | **copy có sửa** — 21 module trong `src/` là bản chuyển trung thành từng vùng `//#region` của bundle gốc, thêm header/JSDoc và kiểu `any` tường minh; riêng `glob.ts` và `uuid.ts` là **viết lại theo hành vi** (thay hai thư viện mà bản gốc bundle kèm) |
| Seam (`inject`) | `slots` · `layout` · `locale` · `resources` · `sessions` · `uiSession` · `shortcuts` (nguyên văn) |
| Slot đăng ký | 5: `rightbar` · `rightbar.session` · `conversation.session.header.corner` · `sidebar.right.pane.tab` · `sidebar.right.pane.tab.title` |
| Từ điển | namespace `sidebarRight`, **34 khoá** × 2 ngữ (zh là nguồn sự thật) |
| CSS | 3 module nhúng nguyên văn (giữ nguyên hash lớp `geFEbW_` · `_1kL45W_` · `P3OORG_`) |

## Hai luật đã trả giá (giữ nguyên trong bản này)

**Luật 7 — slot KEYED.** `key` của hai slot KEYED **phải bằng** `id` của định nghĩa loại tab:
cả hai chỗ dùng CÙNG hằng số `GUIDE_ID` (`@deepseek-ai/dsh-client-ui-sidebar-right/guide`). Lệch một
ký tự thì renderer rơi vào fallback (`<p data-sidebar-right-unavailable>`) và tab hiện "không khả
dụng" **mà không có lỗi console nào**. Test `LUAT 7 (dau-cuoi)` khẳng định điều này trên artifact thật:
lấy `key` của hai lần đăng ký KEYED so với `id` trong sổ đăng ký loại tab sau khi `apply` chạy.

**Luật 8 — hợp đồng kho.** `rightbar.session` nhận một `store` do row này cấp; `create()` của nó
**phải trả về thể hiện ĐẦY ĐỦ** (`getSnapshot` + `subscribe` + `actions` + `clearPersisted`) như
`defineStore` của bản gốc — trả thiếu thì khung slot gọi `w.getSnapshot()` và ném
`TypeError: w.getSnapshot is not a function` ⇒ **cả thanh bên không render**. Bản port spread nguyên
thể hiện rồi mới thêm `clearPersisted`, đúng ý bản gốc; test `LUAT 8` gọi thẳng `store.create()` và
kiểm 19 hành động của bản gốc.

## Vì sao cần

Row gốc nằm trong cây plugin web đang chạy; muốn thay bằng bản của ta thì phải **đăng ký đủ 5 slot**
đúng tên, đúng occupant, đúng thứ tự — thiếu một slot là UI mất một mảnh mà không có lỗi nào hiện ra.
Đối chứng mạnh nhất nằm ở test `DOI CHIEU TRUC TIEP`: nạp **cả bundle gốc lẫn bundle của ta** trong
`window` giả, chạy `apply` của cả hai trên hai context giả rồi so từng khoá spec
(`name` · `key` · `locale` · `children` · `store` · `inject`) và từng nhãn hiệu ứng vòng đời.

## Ghi chú kỹ thuật

- Bundle đặt `packages: "external"`: bảy module ngoài (react · react/jsx-runtime · react-dom · zod ·
  dsh-client-store · dsh-client-ui-primitives · dsh-client-ui-dockkit) do **bảng module của loader**
  cấp, đúng như bản gốc — bundle chúng vào sẽ tạo bản sao thứ hai của react.
- Bản gốc bundle kèm **picomatch 4.0.7** (1.899 dòng) chỉ để đối chiếu `patterns` của loại tab;
  `src/glob.ts` phủ đúng tập cú pháp đang dùng (`**` · `*` · `?` · `[...]` · `{a,b}`, `nocase` · `dot` ·
  `basename`) nên bỏ được thư viện mà không đổi hành vi.
- Bản gốc bundle kèm `util/crypto` chỉ để dùng `randomUUID()`; `src/uuid.ts` dùng
  `crypto.getRandomValues` sẵn có của trình duyệt.
