<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-reference cua DSH (M5 — row HAI MAT, mot package hai nua)
-->

# @galaxy-blackhole/gbh-client-ui-reference

Bản viết lại của row **`ui-reference`** — **nguồn `@` hợp nhất** của ô soạn tin: gợi ý **tệp/thư mục**
(`@file`) và **phiên** (`@session`) trong cùng một menu, kèm hai chip inline trong văn bản người dùng
(chip tệp có nút điều hướng + hộp thoại khi mở hỏng, chip thư mục chỉ là nhãn) và hai rule nhận dạng
tham chiếu trong văn bản gốc. Đây là row **HAI MẶT**: nửa host rỗng, toàn bộ hành vi ở nửa browser.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-reference` (tier T3, `ui-reference` trong ma trận) | `@galaxy-blackhole/gbh-client-ui-reference` |
| Package | `@deepseek-ai/dsh-client-ui-reference` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-client-ui-reference` `0.1.0` |
| File gốc đã đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-reference/{package.json,lib/index.js,lib/client.js,lib/types/**}` | `packages/client/ui-reference/{build.ts,src/*.ts}` |
| Kích thước bản build | **475 dòng JS** (`client.js` 18.455 B/464 dòng + `index.js` 415 B/11 dòng) | **1.076 dòng TS** (plugin 419 · candidates 186 · view 163 · workspace-path 113 · build 95 · rules 81 · locales 63 · client 23 · index 15 · ids 13) → `client.js` 16.186 B + `index.js` 312 B |
| Mức độ dẫn xuất | — | **viết lại theo hành vi** (không chép code; giữ nguyên bề mặt quan sát được: tên seam + 9 service inject · tên slot `conversation.user.text.node` + `key` occupant · 16 chuỗi từ điển · hình dạng payload menu/drill/breadcrumb) |
| Hai mặt? | **CÓ** (`dsh.client` + `exports["./client"]`) | đủ **hai nửa trong MỘT package** |
| `dsh.client.inject` | 8 gói: `dsh-api-remotes` · `dsh-api-session-controller` · `dsh-client-connection` · `dsh-client-locale` · `dsh-client-ui-conversation` · `dsh-client-ui-renderer` · `dsh-client-ui-input-trigger` · `dsh-client-ui-sidebar-right` | **y hệt** (test `ca 7` so từng phần tử với `package.json` gốc) |
| Id module bundle đăng ký | **1**: `@deepseek-ai/dsh-client-ui-reference` | **1**: `@galaxy-blackhole/gbh-client-ui-reference` (xem mục 4) |
| Slot occupant | `conversation.user.text.node` với `key: "file"` (priority 100, locale `reference`) và `key: "folder"` | **y hệt** — `key` KHÔNG phải id module |
| Nguồn `@` | `trigger "@"`, `name "reference"`, `showGroupTitle false` + candidates/header/onPick/openReference/codec | **y hệt** (A/B từng hàm, xem mục 5) |

## 2. Vì sao cần

Ai gọi nó:

- **Người dùng** gõ `@` trong ô soạn → menu gợi ý tệp/thư mục trong workspace + các phiên để nhắc tới; chọn một thư mục thì **đi sâu** (drill) và có breadcrumb đường quay lại.
- **Văn bản đã gửi** hiển thị tham chiếu thành **chip**: chip tệp mở được (bằng quyền của chính phiên gốc, đi qua `sidebarRight.openResource` với địa chỉ `dsh-resource://file/session/…`), chip thư mục chỉ là nhãn.
- **Hai rule văn bản** (`uiConversation.userText.register`) biến `@path` / `@"path có dấu cách"` trong tin nhắn cũ thành chip mà không cần Facts hay discovery.
- Nó cấp từ điển namespace `reference` (16 khoá: 3 nhóm mục, crumb, 4 chuỗi hộp thoại mở tệp, 6 từ chỉ tuổi phiên).

## 3. Peer

| Peer | Vì sao | Thuộc seam nào |
|---|---|---|
| `@deepseek-ai/cordis` | kiểu `Context`/`effect` mà `apply(ctx)` nhận; **chỉ khai peerDependencies**, không import lúc chạy | §3b — vòng đời plugin (M3 phơi cùng tên) |

Ba thứ nửa client cần thì lấy **qua bảng module lúc chạy** (đúng hợp đồng C2) nên không phải dependency:
`react` (chỉ `useState`), `react/jsx-runtime`, `@galaxy-blackhole/gbh-client-ui-primitives`
(`ReferenceChip` · `Modal` · `Button` · `relativeTime`). Nửa host không import gì.

## 4. Đếm id module — và vì sao KHÔNG alias id stock

| Việc | Kết quả đo |
|---|---|
| Số `__ModuleLoader__.load({ id, factory })` trong bundle gốc | **1** (dòng 1–2 của `lib/client.js`), không có `chunk` |
| Id trong `ctx.slots.register(...)` | `key: "file"` / `key: "folder"` — **KHÔNG** vào bảng module |
| Bundle nào `require("@deepseek-ai/dsh-client-ui-reference")`? | **0** — grep 4 KB đầu của **mọi** `lib/client.js` đã cài (test `ca 7b` chạy lại mỗi lần `bun test`) |
| Row nào inject nó? | **0** (fixture C1: không entry nào liệt nó trong `inject`) |
| Kết luận | Chỉ **1 id module = tên package của ta**. Không cần alias; khai thêm `gbh.row.moduleIds` để cổng mount kiểm được id mà bundle tự khai |

## 5. Bảng TRƯỚC / SAU

**Trên app thật 5439** (mount thật 15:0x, 17/10/2026; app khởi động **tách khỏi phiên** theo công thức mục 000):

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Trang `/` (HTTP · byte) | 200 · 49.234 B | 200 · **49.234 B** |
| Id trong `__DSH_BOOT__` | 72 entry · có `@deepseek-ai/dsh-client-ui-reference` | 72 entry · **có `@galaxy-blackhole/gbh-client-ui-reference`**, id stock ĐÃ BIẾN |
| `check:app` (8 chỉ số) | — | **(1)…(7) ĐẠT · (8) `#root` 99.183 ký tự · 0 lỗi console** ⇒ app LÀNH |
| Dòng `did not activate` trong log boot | 0 | **0** |
| `parity:dump`: row của ta | — | **0 THÊM · 0 THIẾU · 0 ĐỔI** (nằm trong danh sách `swapped`: đã thay **13** row, +1 so với trước) |
| Bundle nửa browser | 18.455 B (stock) | 16.186 B (của ta) |
| Test | — | **9 ca**, trong đó 6 ca A/B trực tiếp với bundle gốc |

**LAB CÁCH LY** (home `/tmp/gbh-m5b-ref-lab` + cổng **5458**, overlay `--patch` tắt 2 row đang crash của người khác ⇒ 70 entry thay vì 72):

| Chỉ số | Kết quả |
|---|---|
| Trang `/` | 200 · 48.262 B |
| Entry · `__ModuleLoader__.mode` | 70 (= 72 − 2 row bị tắt trong overlay) · `live` |
| `#root` render | **89.015 ký tự** |
| Lỗi console của trang | **0** |
| Id của ta trong payload | **có** · id stock: **không** |

Lệnh tái lập:

```bash
bun test tests/client/ui-reference.test.ts          # 9 pass (A/B với bundle gốc trong window giả)
bun run check:rows && bun run check:app              # hai cổng bắt buộc trước khi mount

# lab cách ly: home riêng + cổng riêng, KHÔNG chạm 5439
GBH_HOME=/tmp/gbh-m5b-ref-lab nohup bun run apps/cli/src/main.ts host --port 5458 > /tmp/lab.log 2>&1 & disown
curl -sL -c /tmp/j -b /tmp/j "$(grep -o 'http://127.0.0.1:5458/?token=[^ ]*' /tmp/lab.log | head -1)" | wc -c

# mount thật (TÁCH khỏi phiên — công thức mục 000)
scripts/restart-host.sh
bun run check:app                                    # đọc CẢ chỉ số (8): #root + lỗi console
```

## 6. Phần CHƯA làm (nói thẳng)

- **Không có ca BYTE**: row **không phục vụ route/RPC** nên không có thân phản hồi HTTP (ADR 0004 §8).
  Byte duy nhất đáng kiểm ở đây là **địa chỉ tệp** do row này sinh ra — đã ghim bằng test `ca 5`
  (`dsh-resource://file/session/<id>/<path>`, có ca dấu cách và ca tuyệt đối ngoài workspace).
- **Menu `@` chưa chụp được ảnh A/B end-to-end**: trong lab home trắng, gõ `@` **khôn** mở menu ngay —
  và **bản stock cũng vậy** (đã chạy đối chứng 5459: cùng hành vi), tức đây là giới hạn của *cách đo*
  (chưa có phiên nào đang mở để nguồn `@` trả ứng viên), không phải lỗi của row. Ma trận A/B cho màn này
  vẫn thuộc giàn của `tm-ui-features`.
- **Chưa đăng ký alias id stock** — lý do + điều kiện cần nếu sau này có consumer: mục 4.
- `parity:dump` toàn cục hiện **FAIL vì row brand** (`THÊM ui-brand-official-ours` · `THIẾU gbh-brand`):
  nợ kiến trúc của **task-17** (đưa brand vào repo), **không phải row này** — dòng của tôi là 0/0/0 và
  vẫn nằm trong danh sách `swapped`. Đã báo Lead.
- Hành vi UI đầy đủ của menu `@` (sắp nhóm, drill sâu nhiều cấp, thứ tự subagent trước) mới kiểm ở
  **tầng seam** (A/B từng hàm) — chưa có lượt bấm tay thật trong app đang chạy.
`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-reference` (shasum `en 0e713a6ef176...` · `zh cbd2f883d882...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
