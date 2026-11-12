<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Luat bat buoc cho moi agent lam viec trong repo nay (doc truoc khi viet code)
-->

# Luật của repo blackhole-tauri

Bốn mục tiêu tối thượng (bất biến) và lộ trình nằm ở `docs/ARCHITECTURE.md`. Mọi task phải phục vụ chúng.

## 1. Header bắt buộc (mọi file nguồn)

```ts
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date <ngày sửa cuối>
 * desc <file này làm gì>
 */
```

Biến thể: `<!-- -->` cho .md/.html, `#` cho .yml/.sh/.toml, `/** */` cho .rs. `create date` **cố định 15/10/2026**.
File `.json` (package.json, tsconfig, tauri.conf.json) **được miễn** — lý do ghi trong `tools/lint/header.ts`.

## 2. Luật code

- **≤ 1000 dòng/file.** Vượt là phải tách module, không nới ngưỡng.
- **Mọi function/hook/component export đều có mô tả**: làm gì, nhận gì, trả gì.
- **Không dùng `@galaxy-stack/ai-coder-core`** (bất kỳ tầng nào, kể cả transitive).
- **Không Tailwind, không thư viện component.** CSS Modules + `clsx` + token `--dsw-*` (luật của DSH).
- **Icon thuộc UI parity: giữ nguyên SVG gốc của DSH.** `lucide-react` chỉ cho UI mới của Blackhole.
- **Không màu/số literal** trong component — chỉ token `--dsw-*`.
- Package đặt tên `@galaxy-blackhole/gbh-<vai trò>`.

## 3. Vùng ghi (write scope)

Mỗi agent chỉ ghi trong vùng được giao trên task board. Không hai agent ghi cùng một package.
`vendor/dsh-reference/` là **chỉ đọc**. `~/.galaxy/gbh/` là **cấm ghi** (test `gate:home-isolation` canh).

## 4. Cổng kiểm tra trước khi báo xong

```bash
bun run gate           # 8 cổng, ~30 giây: header · file-length · jsdoc · dep-guard ·
                       #   parity-matrix · typecheck · hygiene · test   (--no-tests để lặp nhanh)
bun run check:app      # 11 chỉ số sức khoẻ app (đọc cả (8) render · (9) bố cục · (10) mount tươi · (11) HMR)
bun run check:rows     # cổng chặn mount: gói khai gbh.row phải đủ đăng ký slot/export như bản gốc
bun run host:install   # đổi version runtime harness (apps/host cài riêng, KHÔNG thuộc workspace)
```

**`gate` chạy TEST theo mặc định** — *'gate XANH'* nghĩa là test đã pass. Cổng `hygiene` canh ba luật:
gói khai `gbh.row` phải (a) **có test**, (b) **có mặt trong `packages/README.md` §4**, (c) **tên theo quy ước**
`@galaxy-blackhole/gbh-*` — *trừ* gói khai `gbh.row.moved: true` (di chuyển chưa viết lại, đổi tên sẽ phá id bundle).

Chạy app: `bh host` (cổng 5439) in marker `[bh] ready http://127.0.0.1:5439/?token=…` cho vỏ Tauri;
`bh doctor` báo runtime version · oracle version · profile · credentials dùng chung · cách ly home.

## 5. Lệnh restart host 5439 (chuẩn, không phụ thuộc cwd)

```bash
cd <repo> && scripts/restart-host.sh   # LỆNH DUY NHẤT: tự dò bun, chờ cổng nhả, tự xác minh bằng check:app
# hoặc không phụ thuộc cwd:
bun run <repo>/apps/cli/src/main.ts host --port 5439
```

Quy trình restart để không phá phép đo của người khác: (1) tắt bản cũ, (2) chờ cổng nhả, (3) bật bản mới,
(4) xác nhận app phục vụ được **rồi mới** báo xong.

⚠️ **Lệnh xác minh PHẢI có cookie jar** — token trong `ready-url.txt` chỉ đổi được thành phiên qua
**một lượt điều hướng**, nên `curl` trần **LUÔN trả 401 dù app hoàn toàn lành**:

```bash
U=$(cat ~/.galaxy/blackhole/ready-url.txt)
curl -sL -c /tmp/ck.txt -b /tmp/ck.txt -o /dev/null -w '%{http_code}\n' "$U"   # 200 = LANH
# hoặc đơn giản nhất: bun run check:app   (tự quản cookie, in cả 11 chỉ số)
```

Đây là bẫy có thật: một lượt đo của giàn A/B đã **SKIP oan** vì `curl` trần trả 401 trong khi app
đang lành (và làm người đo tưởng app hỏng). Nếu thấy 401: **kiểm cookie jar TRƯỚC**, rồi mới nghi app.

Một cửa sổ restart bị lộ ra ngoài sẽ bị giàn parity ghi thành "khác biệt giao diện" nếu không có cổng trạng thái.
**Nhiều lượt boot tranh nhau trên cùng cổng** còn làm `ready-url.txt` bị ghi đè liên tục ⇒ file có thể trỏ
vào token của **lượt vừa bị tắt** ⇒ 401 dù app sống. Vì vậy: **chỉ một người chạy restart** (Lead), và **gom
nhiều row vào MỘT lượt boot**.
