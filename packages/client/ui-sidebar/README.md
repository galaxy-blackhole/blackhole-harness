<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-sidebar cua DSH (M5, row hai mat, 7 inject).
-->

# @galaxy-blackhole/gbh-client-ui-sidebar

Thay row `ui-sidebar` của DSH: **vỏ cột sidebar** — hình học cột, hàng thương hiệu, nút New Session,
danh sách panel toàn cục, và bảy ô con cho các row khác (workspace, settings, hành động chân cột…).

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-sidebar` (tier T3, **đang BẬT**) | `ui-sidebar-ours` → `@galaxy-blackhole/gbh-client-ui-sidebar` |
| Package | `@deepseek-ai/dsh-client-ui-sidebar` | `@galaxy-blackhole/gbh-client-ui-sidebar` |
| Nơi đọc bản gốc (chỉ đọc) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-sidebar/` (`lib/index.js` 6 dòng · `lib/client.js` 535 dòng · `lib/types/**` 6 file `.d.ts`) | repo chưa có `vendor/dsh-reference` |
| Kích thước bản build | **541 dòng JS** (6 + 535) | `lib/index.js` 5 dòng · `lib/client.js` ~700 dòng (sinh tự động) |
| Hai mặt? | **CÓ** (`dsh.client`) | có đủ hai nửa |
| `dsh.client.inject` | `api-workspace-controller` · `ui-renderer` · `ui-layout` · `ui-session` · `ui-workspace` · `client-locale` · `client-shortcuts` (**7**) | **khai y hệt** ⇒ entry trong `__DSH_BOOT__` có đúng 7 mối nối |
| Id MODULE bản gốc đăng ký | **1** (`__ModuleLoader__.load({ id, factory })`, không có `chunk:`) | **2**: id của ta (chính) + id stock (phụ); khai kèm `gbh.row.moduleIds` để cổng tiền-mount đọc được |
| Slot đăng ký | `sidebar` (occupant chính, khai **7 ô con**) · `shell.leading` (ghế window-chrome) | y hệt, đúng thứ tự |
| Mức độ dẫn xuất | — | **viết lại theo hành vi**. Dữ liệu giữ nguyên vì ảnh A/B so từng pixel: 5 chuỗi copy en/zh · **CSS hai module (8.368 B + 371 B, tên lớp hash `hHd-Xa_*`/`IW6AQa_*`)** · nhãn bản build `0.2.1-alpha.4-cc6a8f5` · các định danh quan sát được (nhãn hiệu ứng, id phím tắt `sidebar.left.toggle`/`session.new`, sự kiện `sidebar_menu_click`, thuộc tính `data-window-drag`) |

### Hành vi phải giữ

**`apply(ctx)`**: `ctx.get("uiWorkspace")` → từ điển `sidebar` → store panel + `syncPanels()` (đọc
`slots.entriesOfSlot("sidebar.panellist")`, sắp theo `order`, nhãn qua `resolveSlotLabel`, **chỉ công bố khi
danh sách thật sự đổi**) → hai hiệu ứng nghe (`slots.subscribe("sidebar.panellist")`,
`locale.subscribe`) → `injectProps()` (startSession · toggleSidebar · selectPanel **kèm analytics cho
`plugins`/`schedules`** · hooks `{panels, shortcuts}`) → đăng ký `sidebar` (7 ô con) và `shell.leading` →
gọi `syncPanels()` lần cuối.

**`SidebarRoot`**: thu gọn là **trượt + mờ chéo** — `settled` khởi tạo bằng `collapsed`, hẹn 150ms khi bắt
đầu thu; `wide = windowsTitlebar ? !collapsed : !collapsed || !settled`; giữ `lastWideWidth`/`everWide`;
con trỏ trong cột thì vẽ thanh cuộn, rời cột thì **nán lại 2s** rồi ẩn (`quietBars`); macOS có dải kéo cửa
sổ và nút thương hiệu là `span`, nền khác thì là `button` + nút toggle nằm trong hàng logo.

### ⚠️ SỰ CỐ 17/10/2026 — `react.jsx is not a function` (đã sửa, có TEST CANH)

Bản đầu của tôi gọi `react.jsx(...)`/`react.jsxs(...)` trên namespace `react`. Namespace đó **không có**
hai hàm ấy — chúng ở `react/jsx-runtime`. Hậu quả trên app thật: `#root` tụt từ **99.349** xuống **49.046**
ký tự (thanh bên không render) trong khi **7 chỉ số kia vẫn ĐẠT** (72/72 entry, 0 dòng lỗi phía server).
Đây là lớp lỗi **chỉ lộ ở tầng chạy**.

Đã sửa: `{ jsx, jsxs }` lấy từ `require("react/jsx-runtime")` để **dựng element**, `react` chỉ để lấy
**hook** (`ShellDeps = { jsx, jsxs, react, primitives }`). Kèm **test canh**: stub `react` trong test cố ý
KHÔNG có `jsx`/`jsxs`, và một ca **lấy component TỪ CHÍNH PLUGIN** rồi render ⇒ trộn thiếu là đỏ ngay.

### ⚠️ SỰ CỐ 17/10/2026 (2) — CSS bị VỠ khi trích, thanh bên dồn nén (đã sửa, có TEST CANH)

Bộ trích CSS đầu tiên của tôi tách rule theo ký tự `}` rồi **bỏ các fragment rỗng** — mà fragment rỗng chính là
dấu `}` **đóng block lồng nhau** (`@keyframes`). Kết quả: `{...}` mất cân bằng ⇒ trình duyệt nuốt mọi rule
**sau** block hỏng. Hậu quả đo được trên app thật (tm-ui-features, ảnh A/B):

| phần tử | đúng (ref) | khi vỡ | sau khi sửa |
|---|---|---|---|
| `hHd-Xa_iconButton` (nút thu gọn) | x=240 | **x=145** | **x=240** ✔ |
| `hHd-Xa_newSession` | h=38 | **h=24** | **h=38** ✔ |
| mục điều hướng | 2 dòng dọc, w=252 | **2 mục CÙNG DÒNG**, w=77 | đúng ✔ |

Không có lỗi console nào, `#root` vẫn 99.183 ký tự — chỉ ảnh A/B (5.437 px lệch) bắt được. **Cách sửa**: định
dạng lại CSS bằng bộ chèn newline **theo độ sâu ngoặc** (chỉ xuống dòng khi độ sâu về 0), giữ nguyên văn bản
gốc; kiểm bằng so khớp *bỏ mọi khoảng trắng* với chuỗi CSS trong bundle gốc. **TEST CANH** mới: so CSS của ta
với CSS bản gốc (bỏ khoảng trắng) cho **cả hai** module + khẳng định ngoặc cân bằng — lỗi này giờ là ĐỎ ngay
trong `bun test`.

## 2. Vì sao cần

Sidebar là bề mặt lõi: nó là **chủ sở hữu hình học cột** và là **nơi khai bảy ô con** mà các row khác
đăng ký vào (`ui-workspace` chiếm vùng duyệt, `ui-settings` chiếm ghế chân cột, biểu tượng panel toàn cục,
huy hiệu, hành động chân cột…). Sai ở đây là hỏng cả cột bên của người dùng.

## 3. Peer

**Không khai peer nào.** Bản gốc chỉ khai `@deepseek-ai/cordis`, nhưng nửa host của nó (và của ta) không
import gì. Năm specifier mà nửa browser `require` lúc vạt chất hoá — `@galaxy-blackhole/gbh-client-store`,
`@galaxy-blackhole/gbh-client-ui-slots`, `react/jsx-runtime`, `@galaxy-blackhole/gbh-client-ui-primitives`,
`react` — **không phải peerDependency**: chúng do **bảng module của trang** cấp, đúng năm specifier và
đúng thứ tự như bản gốc. Helper ghép tên lớp (`clsx`) được **viết lại tại chỗ** vì repo không cài gói đó
và §3b không cho thêm phụ thuộc ngoài bảng seam.

## 4. Bảng TRƯỚC / SAU

Đo trên **home cách ly + cổng riêng**; phép đo "SAU" **cô lập đúng một row của ta** (boot một lần để mount
gói vào profile của home cách ly, rồi boot lại với `GBH_DISABLE_REWRITES=1` + lớp overlay `--patch` chỉ
chứa khối disable+insert của row này — **không** sửa `<home>/app.patch.yml`).

| Phép đo | TRƯỚC (row DSH) | SAU (chỉ row của ta) |
|---|---|---|
| Trang | 200 · **39.326 B** | 200 · **39.351 B** (**+25 B** = id mới dài hơn 7 ký tự) |
| Số entry trong `__DSH_BOOT__` | **72** | **72 (không đổi)** |
| Id entry của row | `@deepseek-ai/dsh-client-ui-sidebar` | `@galaxy-blackhole/gbh-client-ui-sidebar` |
| `inject` của entry | **7 id** | **y hệt từng chữ** |
| Dòng `did not activate` | **0** | **0** |
| **(8) phía trang** (Chrome headless, đúng đầu dò của `check:app`) | **57.501 ký tự `#root` · 0 lỗi console** | **57.501 ký tự `#root` · 0 lỗi console** |
| **Hình học thanh bên** (đầu dò hình học, cùng điều kiện) | `iconButton` x=240 · `newSession` h=38 · `logoRow` 12,6 256×60 · `panelList` 12,120 256×76 | **giống hệt từng ô** (sau khi sửa CSS) |

⇒ Cùng điều kiện lab, `#root` của ta **bằng đúng** bản stock và **0 lỗi console**: thanh bên render y hệt.
(Con số 99.349 là của app thật vì app có nhiều panel/bundle hơn lab; cái quyết định là A/B bằng nhau.)

### Lệnh tái lập

```bash
bun test tests/client/ui-sidebar.test.ts     # 16 pass · 118 expect (2 ca TEST CANH: runtime JSX + CSS khớp bản gốc)
bun run check:rows                            # gói này không có dòng nào
bun run gate                                 # 6/6 (file của ta 0 vi phạm)

# TRƯỚC: home cách ly, mọi row còn là stock
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-sb-before bun run apps/cli/src/main.ts host --port 5471
# SAU (cô lập đúng row này): mount một lần rồi boot lại với overlay
GBH_HOME=/tmp/gbh-sb-mine bun run apps/cli/src/main.ts host --port 5472            # mount rồi tắt
GBH_DISABLE_REWRITES=1 GBH_HOME=/tmp/gbh-sb-mine bun run apps/cli/src/main.ts host --port 5473 \
  --patch <overlay: disable ui-sidebar + insert ui-sidebar-ours>                    # không sửa app.patch.yml
# đo phía trang bằng chính đầu dò của check:app
bun run /tmp/probe-lab.ts "http://127.0.0.1:5473/?<token>"   # { rootChars: 57501, errors: [] }
```

## 5. Nghiệm thu sức khoẻ toàn app (mục 4b)

| Dấu hiệu | Kết quả |
|---|---|
| (1) Trang sống | 200 · 39.351 B (lab) — không teo về 68 B/12 KB |
| (2) `did not activate` trong log boot | **0** |
| (3) `__DSH_BOOT__` trên trang | có |
| (4) Row của ta có mặt | entry mang id của ta + `ui-sidebar-ours` trong dump, row stock `disabled: true`, tổng row thay **+1** |
| (8) UI render thật | lab: **57.501 ký tự `#root` · 0 lỗi console** (Chrome headless) · app 5439: **99.183 ký tự · 0 lỗi console** · bố cục thanh bên khớp ref từng ô |
| Ảnh A/B pixel trên app (giàn parity) | **0 px / 1.119.744 px** ở cả *Plugins→Installed* và *Settings→General* |

## 6. Phần CHƯA làm / giới hạn

- **ẢNH A/B TRÊN APP THẬT: ĐÃ CÓ — 0 px lệch** (tm-ui-features, 17/10/2026, ảnh ở
  `.parity/features/2026-10-17T08-23-15/`): *Plugins → tab Installed* **0/1.119.744 px (0,000%) PASS** ·
  *Settings → General* **0/1.119.744 px (0,000%) PASS**. Cụm **5.437 px** ở thanh bên (do bản CSS vỡ) đã biến
  mất sau bản sửa, cộng với lab A/B hình học giống hệt từng ô và `check:app` 8/8 trên 5439.
- **React/hook chạy giả trong test**: repo không cài `react`, nên test dùng React giả MỘT lượt render.
  Hành vi khi re-render thật (đổi `settled` sau 150ms, `pointerInside` sau 2s) chưa kiểm ở tầng runtime.
- **Ca BYTE không áp dụng**: row không có thân phản hồi byte nào. Thay vào đó có ca khuôn bundle (script
  classic, 2 id cùng factory, CSS nhúng khớp file nguồn) và **2 ca test canh runtime JSX**.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-sidebar` (shasum `en 741eed158e9d...` · `zh 83830de09aa0...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
