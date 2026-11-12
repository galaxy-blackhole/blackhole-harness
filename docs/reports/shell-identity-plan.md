<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Ke hoach lop vo L3: thay <title>/favicon/manifest DSH bang GBH — 2 duong (de file dinh tuyen + tapIndex vs ship dist frontend), rui ro, nghiem thu
-->

# Kế hoạch lớp vỏ (L3) — title / favicon / manifest

> Bối cảnh + số đo: [`asset-inventory-dsh.md`](asset-inventory-dsh.md) §1, §2.3. Bảng ánh xạ: [`icon-mapping-dsh-gbh.md`](icon-mapping-dsh-gbh.md) A13/A14.
> **Tài liệu này là kế hoạch — chưa sửa gì ở `packages/host/*`** (vùng ghi chưa mở, Lead chốt D6 ở wave sau).

## 1. Hiện trạng đo được (18/10/2026)

| hạng mục | giá trị | nguồn |
|---|---|---|
| `<title>` HTML phục vụ | `DeepSeek Harness` | `curl` trang chủ (cookie jar) → `/tmp/served.html` |
| favicon light/dark | `./favicon.svg`, `./favicon-dark.svg` — **cá DSH**, 3.634 B mỗi file, sha256 `9e983b4f…`/`dde7db78…` | `@deepseek-ai/dsh-web-frontend/dist/` |
| PWA manifest | `name: "DeepSeek Harness"`, `short_name: "DSH"`, icon `favicon.svg` | `manifest.webmanifest` (255 B) |
| ai phục vụ | `packages/host/web-runtime/src/index.ts:13` → `@deepseek-ai/dsh-host-frontend-static` + `dist.ts:13` → `@deepseek-ai/dsh-web-frontend` | repo |
| đường sửa **đã có sẵn** | `webServer.tapIndex(transform)` (`packages/host/webserver/src/index.ts:448`) · route đặt tên thắng fallback (`match()` trước `fallback`) · `webserver/index-inject` (row `html`/`script`) | repo |

## 2. Hai đường (ưu/nhược, rủi ro)

### Đường A — đè trên vỏ hiện có (tapIndex + route đặt tên)

| bước | việc | chi tiết |
|---|---|---|
| A1 | `tapIndex(html => …)` | thay `<title>DeepSeek Harness</title>` → `<title>Galaxy Blackhole</title>`; thay 2 `<link rel="icon">` trỏ `/favicon.svg` + `/gbh-favicon.svg`; thay `href="./manifest.webmanifest"` → `./gbh-manifest.webmanifest` |
| A2 | route đặt tên | `GET /favicon.svg`, `/favicon-dark.svg`, `/manifest.webmanifest` trả **asset GBH** (bytes từ `packages/client/ui-primitives/assets/gbh-favicon.svg`, sha256 `105ca4ce…`) và manifest GBH; route đặt tên **thắng fallback dist** nên không cần sửa dist |

| ưu | nhược |
|---|---|
| nhỏ (1 plugin host ~100–150 dòng), không fork frontend, không đụng node_modules | file DSH vẫn **nằm trên đĩa** trong `dsh-web-frontend/dist` (không phục vụ nữa nhưng còn tồn tại) |
| đo được ngay bằng `curl` + DOM (title, favicon bytes, manifest) | `<title>` gốc vẫn nằm trong `dist/index.html` trên đĩa ⇒ nếu ai mở thẳng file thấy DSH |
| rollback = gỡ plugin | phải giữ đúng **hợp đồng C1** (không được đổi thứ tự/khối boot khi tap) |

**Rủi ro cụ thể**: (a) browser cache favicon 304 ⇒ nghiệm thu phải dùng `?v=`/cache-bust hoặc so **bytes** trả về từ server, không so ảnh tab; (b) tap phải **idempotent** và không làm lệch `__DSH_BOOT__` (test: so hash payload trước/sau tap); (c) đừng đổi tên route `/manifest.webmanifest` nếu PWA đã cài — đổi href trong HTML là đủ.

### Đường B — ship dist frontend của ta (`@galaxy-blackhole/gbh-web-frontend`)

| ưu | nhược |
|---|---|
| **xoá hẳn** asset DSH khỏi đĩa (đúng mục tiêu "không còn gì liên quan DSH") | gói lớn: `index.html` + Vite shell + boot injection **C1** + module loader **C2** + CSS/font/asset tĩnh |
| là **tiền đề bắt buộc của pha 4** (thay `staticModules` ⇒ thay bộ icon L2): vỏ phải là của ta thì mới cấp được module primitives của ta | rủi ro cao nhất dự án (mount sai = cả UI không render); cần gate parity ảnh + DOM + `check:rows` |
| hết phụ thuộc `@deepseek-ai/dsh-host-frontend-static` | cần chủ sở hữu riêng + nhiều phiên; không thể làm trong task-9 |

## 3. Đề nghị

1. **Làm Đường A ngay ở wave sau** (1 plugin host, ~150 dòng, không đổi bố cục) → đóng được phát biểu "HTML phục vụ không còn asset DSH".
2. **Đường B gắn vào wave L2** (khi buộc phải thay bảng `staticModules` để thay bộ icon 89 icon × 31 gói) — hai việc dùng chung một vỏ mới, không làm hai lần.
3. Không đụng `packages/host/*` cho tới khi Lead mở vùng ghi (D6).

## 4. Điều kiện nghiệm thu (dùng cho cả hai đường)

```bash
# 1) HTML PHỤC VỤ (cookie jar bat buoc — curl tran luon 401)
U=$(cat ~/.galaxy/blackhole/ready-url.txt)
curl -sL -c /tmp/ck.txt -b /tmp/ck.txt "$U" -o /tmp/served.html
grep -c "DeepSeek Harness" /tmp/served.html      # PHAI = 0
grep -c "<title>Galaxy Blackhole</title>" /tmp/served.html   # PHAI = 1

# 2) BYTES favicon (khong so anh tab — cache lam bao oan)
curl -s -b /tmp/ck.txt http://127.0.0.1:5439/favicon.svg | shasum -a 256
# PHAI = 105ca4ce73ac1dc8707715b700dd16113fb6b8e7fa39af9251d3ca44749c4fc3

# 3) manifest
curl -s -b /tmp/ck.txt http://127.0.0.1:5439/manifest.webmanifest | grep -c '"DSH"'   # PHAI = 0

# 4) DOM that (Playwright, channel chrome): document.title + link[rel=icon] href + 0 loi console
```

| chỉ số | TRƯỚC (đo 18/10/2026) | SAU (ngưỡng đạt) |
|---|---|---|
| `<title>` phục vụ | `DeepSeek Harness` | `Galaxy Blackhole` |
| chuỗi `DeepSeek Harness` trong HTML phục vụ | 1 | **0** |
| sha256 favicon trả về | `9e983b4f…` (DSH) | `105ca4ce…` (GBH) |
| `short_name` manifest | `DSH` | `GBH` |
| lỗi console khi tải trang | 0 | 0 (không được tăng) |
| `__DSH_BOOT__`/payload boot | — | **không đổi hash** (tap không được chạm khối boot) |

## 5. Việc cần Lead chốt (khi mở wave)

| # | việc | đề nghị |
|---|---|---|
| E1 | ai sở hữu plugin host này | giao `tm-host-core`, hoặc mở `packages/host/shell-identity` cho `tm-assets` |
| E2 | làm A hay chờ B | **A ngay**, B gộp vào wave L2 |
| E3 | mở vùng ghi `packages/host/webserver` nếu cần thêm route (thực tế **không cần**: route đặt tên đã có API) | không mở |
