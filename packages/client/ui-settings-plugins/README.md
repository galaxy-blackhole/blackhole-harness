<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-settings-plugins cua DSH (M5 — row HAI MAT, mot package hai nua)
-->

# @galaxy-blackhole/gbh-client-ui-settings-plugins

Bản viết lại của row **`ui-settings-plugins`** — mục **Settings → Built-in plugins**: lối vào trong điều
hướng Settings và phần chrome tab bao quanh các trang do tính năng khác đóng góp vào `settings.plugins.tab`.
Đây là **row HAI MẶT**: nửa host rỗng (chỉ để Loader thấy row), toàn bộ hành vi nằm ở nửa browser.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-settings-plugins` (tier T3, dòng 176 của ma trận) | `@galaxy-blackhole/gbh-client-ui-settings-plugins` |
| Package | `@deepseek-ai/dsh-client-ui-settings-plugins` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-client-ui-settings-plugins` `0.1.0` |
| File gốc đã đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/{package.json,lib/index.js,lib/client.js,lib/types/**,README.md,locale/*.json}` | `packages/client/ui-settings-plugins/{src/index.ts,src/client.ts,src/locales.ts,build.ts}` |
| Kích thước bản build | **234 dòng JS** (client.js 9.739 B/220 dòng + index.js 563 B/13 dòng + 1) | **573 dòng TS** (client 432 · build 94 · locales 31 · host 16) → `lib/client.js` 10.554 B + `lib/index.js` 290 B |
| Mức độ dẫn xuất | — | **viết lại theo hành vi** (không chép code; chỉ giữ nguyên bề mặt quan sát được: tên lớp CSS, id slot, chuỗi từ điển, hình dạng định nghĩa section) |
| Hai mặt? | **CÓ** (`dsh.client` + `exports["./client"]`) | đủ **hai nửa trong MỘT package** (đúng luật M5) |
| `dsh.client.inject` | `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-settings` | **y hệt** (không thêm `immediately`, `platform: "web"`) |
| Id module bundle đăng ký | **1**: `@deepseek-ai/dsh-client-ui-settings-plugins` | **1**: `@galaxy-blackhole/gbh-client-ui-settings-plugins` (xem mục 4 — vì sao KHÔNG alias) |
| Id SLOT OCCUPANT (không phải id module) | `plugins` trong `settings.section`, `order: 15` | **y hệt** |

Nguồn chứng minh hành vi: `apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/lib/client.js`
được **chạy trong cùng một `window` giả** với bundle của ta rồi so A/B (test `ca 1`–`ca 3`).

## 2. Vì sao cần

Mục Plugins là chỗ **duy nhất** để người dùng thấy và bật/tắt các plugin dựng sẵn của bản cài. Ai gọi nó:

- Nửa browser tự đăng ký **một chỗ trong `settings.section`** (`id: "plugins"`) — nhờ đó điều hướng Settings có mục *Built-in plugins*.
- Nó khai `children: { "settings.plugins.tab": { kind: "list", scope: "root" } }` để **tính năng khác** đóng góp tab; hiện có **1** contributor (`@deepseek-ai/dsh-client-ui-settings-plugin-inventory`). Vì chỉ có 1 tab, chrome **không dựng tablist** mà render thẳng panel đó — đúng hành vi bản gốc (xem ảnh trong mục 5).
- Nó cấp từ điển `settings.plugins` (5 khoá: `nav`·`title`·`intro`·`tabs`·`empty`, en + zh) và ledger tab đã sắp theo `order` cho renderer.

## 3. Peer

| Peer | Vì sao | Thuộc seam nào |
|---|---|---|
| `@deepseek-ai/cordis` | kiểu `Context`/`effect` mà `apply(ctx)` nhận; **chỉ khai peerDependencies**, không import lúc chạy | §3b — vòng đời plugin (M3 phơi cùng tên) |

Không dùng gói nào khác. Ba thứ nửa client cần thì lấy **qua bảng module lúc chạy** (`require` do bảng
module cấp, đúng hợp đồng C2) nên **không** là dependency: `react`, `react/jsx-runtime`,
`@galaxy-blackhole/gbh-client-ui-slots` (hàm `resolveSlotLabel`), cùng `document`/`globalThis` của browser.
Nửa host `src/index.ts` không import gì cả (`node:` builtins cũng không).

## 4. Đếm id module — và vì sao KHÔNG đăng ký alias id stock

| Việc | Kết quả đo |
|---|---|
| Số lời gọi `__ModuleLoader__.load({ id, factory })` trong bundle gốc | **1** (`lib/client.js` dòng 1–2). Không có `chunk`, không có lời gọi thứ hai |
| Id trong `ctx.slots.register({ name, id })` | `id: "plugins"` — **KHÔNG** vào bảng module (bảng phân biệt id ở công thức mục 6) |
| Có bundle nào `require("@deepseek-ai/dsh-client-ui-settings-plugins")` không? | **0** — grep 4 KB đầu của **mọi** `lib/client.js` trong `apps/host/node_modules/@deepseek-ai` (test `ca 4b` chạy lại phép đo này mỗi lần `bun test`) |
| Kết luận | Khuôn **HAI id** của công thức mục 6 chỉ cần khi có consumer; **ở row này không có**. Đăng ký thêm id stock sẽ chỉ tạo rủi ro trùng factory khi HMR chạy lại bundle (loader hiện chưa theo dõi alias) mà không mở khoá thêm gì ⇒ **chỉ 1 id: id của ta** (khớp dòng manifest để HMR tra đúng `rev`) |

Nếu sau này có consumer thật: khai `gbh.row.aliases` + thêm `loader.load({ id: <id stock>, factory })` — và nhớ rằng
lúc đó phải xử lý đường HMR (bảng `alias → owner`), đúng như ghi chú trong công thức.

## 5. Bảng TRƯỚC / SAU

**Trên app thật 5439** (mount thật lúc 14:43, 17/10/2026):

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Trang `/` (HTTP · byte) | 200 · 48.947 B | 200 · **49.047 B** |
| Id trong `__DSH_BOOT__` | 72 entry · có `@deepseek-ai/dsh-client-ui-settings-plugins` | 72 entry · **có `@galaxy-blackhole/gbh-client-ui-settings-plugins`**, id stock ĐÃ BIẾN |
| `bh host --dump-config` | row stock BẬT | row stock **`disabled: true`** + `ui-settings-plugins-ours` chèn vào |
| `parity:dump` (oracleA vs ours) | THÊM 0 · THIẾU 0 · ĐỔI 0 · đã thay **7** row | THÊM 0 · THIẾU 0 · ĐỔI 0 · đã thay **8** row (**+1 = row này**) |
| Dòng `did not activate` trong log boot | 0 | **0** |
| Lỗi console khi mở Settings → Built-in plugins | 0 | **0** |
| `bun run check:app` (cổng của Lead) | — | **7/7 ĐẠT** · entry **72 / mốc 72** · app LÀNH |
| Bundle nửa browser | 9.739 B (stock) | 10.554 B (của ta) |

**A/B trong LAB CÁCH LY** (`/tmp/gbh-m5b-lab` cổng 5455 với row của ta ↔ `/tmp/gbh-m5b-stock` cổng 5457
chạy `GBH_DISABLE_REWRITES=1`, cùng viewport 1280×720, cùng bước bấm):

| Chỉ số | LAB A — row của ta | LAB B — row stock |
|---|---|---|
| Trang `/` | 200 · 49.047 B | 200 · 48.882 B |
| Entry trong `__DSH_BOOT__` | 72 | 72 |
| Mục nav *Built-in plugins* | có | có |
| Dòng intro của mục (`Inspect the plugins this deployment ships.`) | có | có |
| `[role="tab"]` trong mục | 0 (một tab ⇒ render thẳng panel) | 0 |
| Thẻ style chèn vào | `@galaxy-blackhole/gbh-client-ui-settings-plugins` | `@deepseek-ai/dsh-client-ui-settings-plugins` |
| Lỗi console của trang | 0 | 0 |
| **Ảnh màn Settings → Built-in plugins** | **0 px lệch / 921.600 px** (pixelmatch, threshold 0.1) | — |

Lệnh tái lập:

```bash
# 1) test hành vi (A/B với chính bundle gốc, chạy trong window giả)
bun test tests/client/ui-settings-plugins.test.ts        # 11 pass

# 2) lab cách ly: home riêng + cổng riêng (KHÔNG chạm 5439)
GBH_HOME=/tmp/gbh-m5b-lab  bun run apps/cli/src/main.ts host --port 5455   # bên ta
GBH_HOME=/tmp/gbh-m5b-stock GBH_DISABLE_REWRITES=1 bun run apps/cli/src/main.ts host --port 5457   # bên stock
curl -sL -c /tmp/j -b /tmp/j "$(cat <url-trong-log>)" | wc -c               # ≈ 49.0 KB · 72 entry

# 3) sức khoẻ toàn app sau khi mount thật
URL=$(cat ~/.galaxy/blackhole/ready-url.txt); curl -sL -c /tmp/j -b /tmp/j "$URL" | wc -c
bun run check:app && bun run check:rows && bun run gate
```

## 6. Sự cố đã gặp và cách chữa (17/10/2026)

| Hiện tượng | Nguyên nhân | Chữa |
|---|---|---|
| App 5439 boot lúc **14:34** mất hẳn mục *Built-in plugins* (nav thiếu 1 mục, ảnh A/B lệch 1.269 px), log **không** có lỗi nào | lượt boot đó đọc `package.json` của package **lúc còn thiếu** `dsh.client` + `exports["./client"]` ⇒ bộ nạp không thấy nửa browser ⇒ entry bị loại **âm thầm** khỏi đồ thị (71/72 entry), trong khi patch đã tắt row stock | viết xong hai nửa + `dsh.client`/`exports`, mount lại 14:43 ⇒ **72/72 entry**, tính năng trở lại |
| Cổng mount mới (`check:rows`) báo **CHẶN**: *"thiếu đăng ký slot `settings.section`"* dù mã **có** đăng ký | cổng đọc tên slot từ **mã nguồn** bằng chuỗi literal; tôi viết qua hằng `SECTION_SLOT` | ghi **thẳng chuỗi** `"settings.section"` ở hai chỗ đăng ký, đúng như bản gốc đã build ⇒ cổng sạch |

> Bài học cho mọi row client sau: (a) thiếu `dsh.client` = **mất tính năng im lặng**, không có lỗi nào để thấy;
> (b) tên slot phải là **chuỗi literal** ở chỗ `slots.inject`/`slots.register`, viết qua hằng sẽ bị cổng mount coi là thiếu.

## 7. Phần CHƯA làm (nói thẳng)

- **Không có ca BYTE**: row này **không phục vụ route/RPC** nên không có thân phản hồi HTTP để kiểm byte
  (ADR 0004 §8). Ca gần nhất về "byte" ở đây là `ca 6`: so **bộ thuộc tính CSS của từng selector** với CSS
  của bundle gốc (chuẩn hoá khoảng trắng + `::`) để chắc chắn phần nhìn không lệch. Vẫn còn **6/12 ca vận
  chuyển** thuộc seam `connection` — không phải của row này.
- **Không có ảnh A/B trên app thật so với oracle**: giàn ảnh A/B là của `tm-ui-features`; tôi đo được
  A/B **0 px lệch trong lab cách ly** (mục 5). Ảnh app thật so với lab-stock còn lệch 0,068 % do **state
  home khác nhau** (phiên/workspace), không quy được cho row này.
- **CSS nhúng thẳng trong `src/client.ts`**, không phải file `.module.css`: `bh host` chỉ copy
  `package.json` + `lib/*.js` vào profile nên file CSS rời sẽ không được mount. Tên lớp CSS giữ
  **nguyên như bản gốc** (`pbvGtq_*`) để bề mặt DOM không đổi; khai báo viết lại theo token `--dsw-*`.
- **Không đăng ký alias id stock** — lý do và điều kiện cần nếu sau này có consumer: mục 4.
- **Chưa gỡ `ui-settings-agent-loop/lib/index.js`** (file build còn trong repo, thiếu header 5 dòng nên
  `bun run gate` đỏ ở cổng `header`) — không thuộc vùng ghi của tôi, đã báo Lead.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-settings-plugins` (shasum `en 982302193ccc...` · `zh 71c9b951c212...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
