<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc README của @galaxy-blackhole/gbh-client-ui-settings-general: nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-client-ui-settings-general

Bản viết lại của Galaxy Blackhole cho row **`ui-settings-general`** của DSH
(`@deepseek-ai/dsh-client-ui-settings-general`). Đây là row **HAI MẶT** (có `dsh.client`), nên gói chứa **cả hai nửa**
trong một package: `src/index.ts` (host) + `src/client.ts` (browser), theo khuôn §6 của
`docs/recipes/HOST-ROW-REWRITE.md`.

## 1. Nguồn đối chiếu (G4) — hành vi ↔ file gốc

| Hành vi của ta | Nguồn gốc đã đọc (chỉ đọc) | Ghi chú |
|---|---|---|
| Nửa host: `export function apply(): void {}` | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-settings-general/lib/index.js` (12 dòng) | Bản gốc cũng KHÔNG có hành vi host; chỉ để entry activate |
| Nửa client: hai id module | `.../lib/client.js` dòng 1-3 và 197 | Bản gốc đăng ký **MỘT** id module (`@deepseek-ai/dsh-client-ui-settings-general`); ta đăng ký hai (id của ta + id gốc) |
| Từ điển en/zh + `formLabels` | `.../lib/client.js` dòng 9-58 · `lib/types/client/locales.d.ts` | Giữ NGUYÊN 14 khoá và nguyên văn hai bản |
| Thẻ `ShellCard` (summary/form) | `.../lib/client.js` dòng 60-111 · `lib/types/client/ShellCard.d.ts` | Giữ nguyên id ô nhập (`plugin-config-shell-timeout`, `plugin-config-shell-output`) và thứ tự trường |
| Cầu nối form `ShellCardController` | `.../lib/client.js` dòng 112-149 · `lib/types/client/shell-card-controller.d.ts` | Giữ nguyên hai namespace (`bash-sandbox`, `pwsh-sandbox`) và hai trường (`timeoutMs`, `maxOutputBytes`) |
| `apply` phía browser: từ điển + 2 cầu nối + occupant slot | `.../lib/client.js` dòng 150-191 · `lib/types/client/index.d.ts` | Giữ nguyên `NS = "settings.shell"`, `inject = ["slots","locale","configForms"]`, slot `plugins.item` id `shell` order `40` |

Câu trả lời cho 5 câu hỏi bắt buộc (mục 0 của công thức):

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row đang BẬT? | **Có** (đo từ `--dump-config`: row `ui-settings-general` không bị `disabled`) |
| 2 | Thuần host hay có mount surface client? | **Hai mặt**: package gốc khai `dsh.client` (inject locale · ui-settings · ui-plugin-manager, platform web) |
| 3 | Cần seam nào? | Phía browser: `slots` · `locale` · `configForms` (seam của DSH, không phải của ta). Phía host: **không cần seam nào** |
| 4 | Hành vi đo được? | Một occupant slot `plugins.item` id `shell` order 40 + 2 trường số cấu hình của `bash-sandbox`/`pwsh-sandbox`; đo bằng ảnh A/B màn **Settings → General** và bằng 7 ca test hành vi |
| 5 | Package gốc có `dsh.client`? | **Có** ⇒ row hai mặt, phải theo khuôn §6 (hai id module + `exports["./client"]`) |

## 2. Vì sao không thêm peer nào

Bản gốc chỉ khai `peerDependencies: { "@deepseek-ai/cordis": "~4.0.5-alpha.2" }` và **không** import gì ở nửa host.
Nửa client nhận `react/jsx-runtime` + `@galaxy-blackhole/gbh-client-ui-primitives` **qua bảng module lúc chạy**
(`require` do bộ nạp cấp), nên gói này **không cần khai peer mới** và cũng không import gói DSH nào ở thời điểm build.
Nhờ vậy `gbh.peers` để trống: bảng module chỉ phụ thuộc đúng những gì bản gốc đã phụ thuộc.

## 3. Bảng TRƯỚC/SAU (kèm lệnh tái lập)

| Hạng mục | TRƯỚC (row stock) | SAU (row của ta) |
|---|---|---|
| Nửa host export | `apply` | `apply` (giống hệt — test ca 5 so trực tiếp với bản gốc) |
| Id module trong bảng | 1 (`@deepseek-ai/dsh-client-ui-settings-general`) | **2** (`@galaxy-blackhole/gbh-client-ui-settings-general` + id gốc) |
| Occupant slot | `plugins.item` id `shell` order 40, label từ từ điển `settings.shell` | y hệt |
| Từ điển | 14 khoá en/zh | y hệt (nguyên văn) |
| Ảnh A/B màn Settings → General | — | xem mục 5 (chờ mount) |

Lệnh tái lập:

```bash
bun run packages/client/ui-settings-general/build.ts          # build cả hai nửa
bun test tests/client/ui-settings-general.test.ts              # 7 ca hành vi
```

## 4. Phần CHƯA làm (nói thẳng)

- **Chưa có ca BYTE**: row này không đi qua tầng vận chuyển (không route, không RPC), nên không có thân phản hồi
  để kiểm byte. Nếu sau này nửa client gọi RPC thì phải bổ sung ca đó.
- **Chưa mount vào app 5439**: theo quy trình phải qua lab home cách ly + cổng riêng (4 chỉ số) rồi mới mount.
- **Không mask gì**: nếu ảnh A/B lệch thì đó là lệch thật, không được coi là trạng thái.

## 5. Nhật ký đo (cập nhật sau mỗi lần mount)

| Thời điểm | Việc | Kết quả |
|---|---|---|
| 17/10/2026 14:37 | Build hai nửa + 7 ca test hành vi | XANH 7/7 |
| 17/10/2026 14:40 | Lab cách ly `/tmp/gbh-lab-shell` + cổng 5458, so với ĐƯỜNG NỀN (row stock) | row thay đúng: entry 73→73, **id của ta có mặt, id gốc biến mất**; `#root` **57.510 ký tự = y hệt đường nền**; 0 lỗi console; sidebar 3 nút + ô soạn tin 1 |
| 17/10/2026 14:45 | Mount thật (Lead xác nhận `check:app`) | 7 gói client của ta đang chạy, trong đó có `gbh-client-ui-settings-general`; 72/72 entry · 0 lỗi |
| 17/10/2026 14:50 | Boot lại trên app thật (tm-client) | entry đứng ở `loading` ⇒ tôi TỰ GỠ `gbh.row` để app không phụ thuộc gói đang bị nghi |
| 17/10/2026 15:05 | Lead đo trên đường thật sau khi mount đủ 12 gói | app 49.192 B · **72/72 entry** · 0 dòng `did not activate` · row này nằm trong 9 gói đang chạy ⇒ **không phải lỗi code của gói**; khai lại `gbh.row` |
| 17/10/2026 15:20 | Đổi `build.ts` sang khuôn ĐÃ CHỨNG MINH: bundle browser đóng gói **CJS rồi bọc trong lời gọi loader** (như `ui-settings-agent-loop`), thay vì phát bundle ESM tự gọi `load()` | 7/7 test xanh; test mới khẳng định bundle **không có cú pháp ESM** và đăng ký **đúng 2 id** khi chạy trong `window` giả |
| 17/10/2026 15:26 | **A/B pixel màn `plugins-installed`** (chỗ thẻ Shell nằm) | **PASS 388 px / 1.119.744 = 0,035%** (ngưỡng 0,1%) · cụm lệch DUY NHẤT: `x=0..36 y=0..20` — là TOAST `aria-label="Could not save preference"` của row `ui-settings-session-log` (không phải thẻ Shell) · ảnh `.parity/features/2026-10-17T07-56-36/pair-plugins-installed.png` |

| 17/10/2026 15:23 | **A/B pixel lần chốt — HAI MÀN 0 px** (sau khi tm-m5a sửa CSS thanh bên và tm-host-api sửa toast) | **PASS 0/1.119.744 = 0,000%** ở cả `plugins-installed` (chỗ thẻ Shell) và `settings-general` · ảnh `.parity/features/2026-10-17T08-23-15/` |
| 17/10/2026 15:22 | Chuẩn hoá chú thích đường dẫn nguồn trong `build.ts` (`// src/x.ts`) | hash bản build nay **không phụ thuộc thư mục chạy build** (đã kiểm: build từ gốc repo và từ trong gói cho **cùng hash**) ⇒ chỉ số "bản mount cũ" so hash mới có ý nghĩa thật |

> Luật mới (17/10/2026): package **chỉ khai `gbh.row` khi đã chạy được**. Lúc viết dở, khối `gbh` bị gỡ để
> `bh host` không mount gói dở và làm hỏng UI của cả nhóm.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-settings-general` (shasum `en 554a6a1e7bc3...` · `zh fd69b5dd66f0...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
