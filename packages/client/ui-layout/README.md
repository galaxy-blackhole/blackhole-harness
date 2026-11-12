<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-layout cua DSH (M5, row LOI: khung vo ba cot).
-->

# @galaxy-blackhole/gbh-client-ui-layout

Thay row `ui-layout` của DSH: **khung vỏ** — chiếm ô `root`, KHAI bảng ô con (`sidebar` · `main` · `rightbar` ·
`shell.bottom` · `shell.overlay` · `shell.leading` — khai = quyền render độc quyền), ghế store hình học cột, và
mở mặt dịch vụ `ctx.layout` cho các plugin khác. Đây là row mà **thanh bên phụ thuộc vào**: hồi quy bố cục
5.437 px hồi 17/10 nằm đúng vùng số đo của row này.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-layout` (T3, **đang BẬT**) | `ui-layout-ours` → `@galaxy-blackhole/gbh-client-ui-layout` |
| Package | `@deepseek-ai/dsh-client-ui-layout` | `@galaxy-blackhole/gbh-client-ui-layout` |
| Nơi đọc bản gốc (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-layout/` (`lib/index.js` 6 dòng · `lib/client.js` 719 dòng · 8 file `.d.ts`) | repo chưa có `vendor/dsh-reference` |
| Kích thước bản build | **725 dòng JS** (6 + 719) | `lib/index.js` 16 dòng · `lib/client.js` ~1.100 dòng (sinh tự động) |
| Hai mặt? | **CÓ** (`dsh.client`) | có đủ hai nửa |
| `dsh.client.inject` (manifest) | `client-locale` · `ui-renderer` · `ui-session` · `ui-theme` · `client-shortcuts` (**5**) | khai y hệt |
| `inject` của THÂN plugin | `["slots","theme","locale","shortcuts"]` (**4**) | y hệt — ⚠️ khác manifest, đây mới là seam thật |
| Id MODULE bản gốc đăng ký | **1** (không `chunk:`) | **2** id chung 1 factory (id ta + id gốc), khai `gbh.row.moduleIds` |
| Export nửa client | `{ LayoutController, apply, inject }` | y hệt |
| Specifier nửa browser `require` | `react/jsx-runtime` · `react` · `@galaxy-blackhole/gbh-client-store` (**3**, đúng thứ tự) | y hệt |
| CSS module | **1**: `AppFrame.module.css` (4.050 B, hash `pI_x6G_`: `frame` · `sidebarCol` · `centerCol` · `rightbarCol` · `leadingSeat` · `handle` · `bottomRow` · `overlayLayer`) | nhúng **nguyên văn** bằng `define` |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**; số đo & chuỗi giữ nguyên vì ảnh/đo A/B so từng ô |

### Hành vi phải giữ

**`apply(ctx)`** đúng 3 hiệu ứng, đúng nhãn bản gốc: `layout: command labels` (đăng ký từ điển
`shortcuts.layout`) → `ui-layout: service + root registration` (dựng store + `LayoutController` →
`slots.provideRoot({hooks:{panelInfo}})` → `reflect.provide("layout", …)` → **MỘT** `slots.register` ô `root`
kèm bảng sáu ô con + ghế `store` → đăng ký phím tắt `sidebar.left.toggle` (5 bộ mặc định, `regions`
`page`/`editable`, `resolve` chạy `toggleSidebar`) → `slots.subscribe("main", retainMainPanels)`) →
`ui-layout: theme presenter` (áp ảnh chụp đầu + nghe `theme/change`, gỡ thì rút sạch).

**Số đo cột** (nguyên văn): `CENTER_MIN` 400 · `SIDEBAR_MIN` 264 · `SIDEBAR_MAX` 420 · `SIDEBAR_DEFAULT` 280 ·
`SIDEBAR_COLLAPSED` 56 · `SIDEBAR_AUTO_COLLAPSE` 1024 · `RIGHTBAR_MIN` 300 · `RIGHTBAR_MAX_RATIO` 0.7 ·
`RIGHTBAR_DEFAULT_RATIO` 0.45. Luật solver: **cột phải nhường trước** (mất track khi chỗ còn lại < 300, tức
`viewport < sidebar + 700`); chỉ khi đó cột giữa mới xuống dưới 400; **thanh bên không nhường**.

**Store khung**: 8 action; `toggleSidebar` ở khung hẹp đổi cờ `narrowExpanded`, ở khung rộng thì 0 ⟷ 280;
`setViewportWidth` xoá cờ mở đè khi vượt ngưỡng 1024 theo một trong hai chiều; cột phải gieo 45% khung ở lần
mở đầu và giữ nguyên px đó; cờ `rightbarInstant` chỉ bật khi thoát toàn màn hình.

**`AppFrame`**: lưới `gridTemplateColumns` = `sidebar px | minmax(0|400, 1fr) | minmax(0, rightbarMax)`; đo khung
bằng `ResizeObserver` + throttle `requestAnimationFrame` (chỉ ghi khi bề rộng > 0); cờ dữ liệu
`data-sidebar-collapsed` · `data-rightbar-collapsed` · `data-rightbar-fullscreen` · `data-rightbar-instant` ·
`data-dragging` · `data-animating`; hai tay kéo pointer-capture (`onDrag` bắn dx đã throttle; `onLostPointerCapture`
cũng kết thúc); `leadingSeat` chỉ trên macOS khi thanh bên thu; `shell.overlay`/`shell.bottom` luôn có mặt;
`MainPanel` chọn khoá `conversation` khi chưa chọn panel nào.

## 2. Peer

**Không khai peer nào.** Ba specifier nửa browser `require` do **bảng module của trang** cấp, đúng thứ tự bản
gốc — không phải `peerDependency`. Bản gốc khai `@deepseek-ai/cordis` chỉ để lấy KIỂU.

## 3. Bằng chứng

### 3.1 Test — 16 test / 498 expect (pass)
| Nhóm | Nội dung |
|---|---|
| **Đối chứng bundle gốc** | hình học cột: **>13.000 tổ hợp, 0 lệch** · store khung: **20 bước kịch bản, so ảnh chụp SAU MỖI BƯỚC, 0 lệch** (rút hàm/const thẳng từ `lib/client.js` gốc lúc chạy test) |
| Test canh CSS | `AppFrame.module.css` **trùng nguyên văn** bản gốc sau khi bỏ khoảng trắng + ngoặc cân bằng |
| Test canh runtime JSX | stub `react` **KHÔNG có** jsx/jsxs; bundle chạy trong `window` giả rồi gọi factory |
| Hợp đồng | `LayoutController` (ném lỗi khi panel chưa đăng ký & không ghi store · `beginNavigation` · `dispose`) · theme presenter (áp/rút lại token, metadata `theme-color`) · `DocumentTitle` (ghép tiêu đề phiên, trả lại khi gỡ) · `AppFrame` (lưới, cờ dữ liệu, ô con nhận đúng tham số, thanh bên thu thì không vẽ tay kéo) · `apply` (3 nhãn hiệu ứng, ô `root` + 6 ô con, phím tắt, thứ tự 6 hàm dọn) |

### 3.2 Lab (home cách ly + cổng riêng)
| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row ta) | Mọi row thay |
|---|---|---|---|
| Trang | 200 · 39.326 B · 72 entry | 200 · 39.351 B · 72 entry | 200 · 49.4 KB |
| `inject` của entry | 5 id | **y hệt** | — |
| `did not activate` | 0 | **0** | — |
| **(8) phía trang** | **57.501 ký tự #root · 0 lỗi console** | **57.501 · 0 lỗi** | **89.015 · 0 lỗi** |
| Row này BẬT vs TẮT (mọi row thay) | — | — | **89.015 = 89.015**, 0 lỗi (đo cả hai chiều) |

### 3.3 App thật (5439, sau `scripts/restart-host.sh`)
- `check:app` **(8)** 99.183 ký tự `#root` · **0 lỗi console** · (6) **23 gói của ta đang chạy thật**, có `gbh-client-ui-layout` · (3) 72 entry · (5) 0 `did not activate` · (9) 1/80 phần tử lệch 1 px (đạt ngưỡng).
- **Soát DOM thanh bên (yêu cầu riêng của Lead vì hồi quy 5.437 px nằm ở đây)**: lưới khung `280px 1000px 0px` (do row này phát) · `hHd-Xa_iconButton` **x=240 22 28×28** (từng hỏng thành x=145) · `hHd-Xa_newSession` **14,70 252×38** (từng hỏng h=24) · `hHd-Xa_panelList` **12,120 256×76** · `hHd-Xa_panelRow` **14,120 252×36** — **khớp đường nền từng ô**.
- `check:rows`: **31 package có `gbh.row` — TẤT CẢ đạt. Mount được.**

## 4. Lệnh tái lập

```bash
bun test tests/client/ui-layout.test.ts     # 16 pass · 498 expect
bun run lab:row ui-layout                   # home cách ly + overlay + cổng riêng (in URL)
bun run check:rows                          # 31/31 đạt
bun run gate                                # 8 cổng
scripts/restart-host.sh                     # khởi động app thật (tự xác minh bằng check:app)
```

## 5. Bài học đã trả giá ở row này

- Hai lần tôi tự viết kỳ vọng bằng tay thì **sai cả hai** (trần cột phải: "theo chỗ trống" mới đúng chứ không
  phải "theo tỉ lệ"; ngưỡng mất track: thật ra là `viewport < sidebar + 700`). Thứ bắt được lỗi là **đối chứng
  với chính bundle gốc** ⇒ row lõi: test đối chứng TRƯỚC, kỳ vọng tay SAU.
- Lớp lỗi `noUncheckedIndexedAccess` đã cắn tôi 2 lần; đã chạy **đúng bộ cờ của cổng** trên gói này (**EXIT=0**) và
  ghi danh sách "đã rà, an toàn" vào đây để người sau không phải dò lại: `document-title.ts`
  (`Object.values(...).find(...)?.id` · `state.byId[current]?.title`) · `theme-presenter.ts` (`fontFamilies[kind] ?? ""` ·
  `fontSizes[role]` qua `String(...) + "px"`) · các file còn lại không truy cập chỉ số động.
- **Về hai phép kiểm tay do Lead gửi rồi RÚT LẠI (17/10)**: chúng SAI với đa số gói (nhiều gói build vào PROFILE lúc mount nên
  không có `lib/` trong repo; và bundle hợp lệ LUÔN có `require("@deepseek-ai/…")`, grep thô sẽ báo nhầm). Bằng chứng của gói này
  **không dựa vào chúng**: cái quyết định là **lab 0 lỗi console + 0 dòng `did not activate`** và `check:app` chỉ số (8)(10).
  Phép kiểm id ĐÚNG nằm ngay trong test của gói: đếm `__ModuleLoader__.load(` và khẳng định **hai id dùng CHUNG một factory**, id
  CỦA TA là id chính; đối chiếu với `gbh.row.moduleIds`. Row stock bị `disabled: true` trong patch nên không nạp ⇒ không trùng factory.
- Trong lab **mọi row đều bị thay**, lỗi console có thể đến từ gói khác: phải đo **hai chiều** (row BẬT vs row TẮT
  trong cùng cấu hình) trước khi kết luận gói nào.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-layout` (shasum `en 1a4ce22bfa3e...` · `zh 47deba1a4d2c...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).

### 3.4 Xác minh TRÊN APP THẬT (21:50, lượt boot lành 26 gói của ta · 94 entry)

- `check:app` (8) **99.183 ký tự #root · 0 lỗi console** · (10) 54 file mount khớp repo (0 mount cũ).
- Lưới khung do ROW NÀY phát: `gridTemplateColumns = "280px 1000px 0px"` (đo trên DOM thật).
- Thanh bên khớp đường nền TỪNG Ô: `iconButton` 240,22 28×28 · `newSession` 14,70 252×38 · `panelList` 12,120 256×76 · `panelRow` 14,120 252×36 ⇒ **hồi quy 5.437 px không tái diễn**.
