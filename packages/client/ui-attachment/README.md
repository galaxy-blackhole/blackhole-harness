<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-attachment cua DSH.
-->
# @galaxy-blackhole/gbh-client-ui-attachment
## 1. Nguồn đối chiếu (G4)
| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-attachment` (tier T3) | `@galaxy-blackhole/gbh-client-ui-attachment` |
| Package | `@deepseek-ai/dsh-client-ui-attachment` | `@galaxy-blackhole/gbh-client-ui-attachment` |
| Kích thước bản build | **936 dòng JS** | (điền sau khi viết) |
| Hai mặt? | **CÓ** (`dsh.client`) | phải làm đủ hai nửa |
| `dsh.client.inject` | `@deepseek-ai/dsh-client-locale` · `@deepseek-ai/dsh-client-ui-chat` · `@deepseek-ai/dsh-client-ui-conversation` · `@deepseek-ai/dsh-client-ui-renderer` · `@deepseek-ai/dsh-client-ui-trajectory` · `@deepseek-ai/dsh-client-ui-tool` | phải đăng ký **đúng tên service cũ** |
## 2. Vì sao cần
(điền: row này làm gì trong app, ai gọi nó)
## 3. Peer
(ghi rõ peer nào và vì sao — chỉ được dùng các gói trong bảng §3b của `packages/README.md`)
## 4. Bảng TRƯỚC / SAU
| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| (điền phép đo TRƯỚC khi mount) | | |
Lệnh tái lập: (điền)
## 5. Phần CHƯA làm
(nói thẳng nếu có — đừng giả vờ đủ)

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-attachment` + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).

> 08/11/2026 (dev-5, review tra lai): hai tep nay TUNG LECH (ban zh cua ta la bo khoa phang, mat `meta.title`/`meta.description`) ⇒ da **chep lai byte-identical** tu stock va kiem bang `cmp` + shasum; chuoi tieng Viet giu trong `locale/vi.json`.
## 3.4. Xác minh TRÊN APP THẬT (18/10/2026)

**Trạng thái mount**: gói **đã mount** trên app 5439 · **`active`** trong `pluginInventory/list` · boot 27-28 gói của ta · `#root` 98.558 ký tự · **0 lỗi console**.

**A/B pixel** (`bun run parity:shot --against 4001`, artifact `.parity/shots/2026-10-17T17-04-52`, mốc 00:04:52, profile Chrome mới):

| viewport | px ngoài mask | % | thô | kết luận |
|---|---|---|---|---|
| 1440x900 | 0 / 807.334 | 0,000% | 0,223% | PASS (ngưỡng 0,1%) |
| 1024x768 | 0 / 489.723 | 0,000% | 0,371% | PASS |

⇒ Trước bản sửa: **594 px** (1440x900) và **1.989 px = 0,406%** (1024x768, FAIL). Sau khi sửa: **0 px** ở cả hai.
Đọc số cho đúng: `0 px ngoài mask` = không còn khác biệt HIỂN THỊ ngoài các mask đã khai (brand/state/locale-text), **không** phải 0 pixel thô (xem cột "thô").

**Lab** (`bun run lab:row ui-attachment`): trang 200 · 99 entry · **có đủ hai id** (id của ta + entry alias của id gốc) · `consoleErrors: []`.

**Hai lỗi THẬT do A/B và do boot bắt được — đã đóng cả hai:**

1. **Pixel (A/B 1024x768 FAIL 0,406%)** — `DropOverlay` render **thường trực** trong ô soạn tin ⇒ hai dòng chữ luôn hiện; bản gốc chỉ hiện **khi đang kéo tệp**. Sửa: occupant `key: "drop"` trả `null` trừ khi `active`/`dragging`. Ca canh trong `tests/client/ui-attachment.test.ts`.
2. **React #130 (app hỏng một lượt boot, 18/10/2026)** — cổng cài đặt: **(a)** cờ bật **TRƯỚC** `applyInner` ⇒ apply ném giữa đường thì cờ đã khoá ⇒ slot không bao giờ đăng ký lại ⇒ renderer gặp `undefined`; **(b)** cờ nằm **trong `createPlugin`** ⇒ hai entry ⇒ hai face ⇒ đăng ký slot hai lần. Sửa: cờ ở **PHẠM VI MODULE**, chỉ bật **SAU khi `applyInner` chạy xong**.

**Chưa đạt parity đầy đủ (ghi rõ để không đọc quá số)**: primitive là bản **gọn nhưng thật** (đủ trạng thái uploading/ready/error, progress, nút gỡ/thử lại) — **chưa** khớp từng chi tiết CSS/khả năng truy cập của bản gốc 928 dòng. Mask `state-*` của rig phủ 60,6% trang ở 1024x768, nên nếu siết mask thì phải đo lại.

**Nhãn**: `locale/en.json` + `locale/zh.json` (**9 khoá**, trùng nội dung `src/locales.ts`) đăng ký qua `ctx.locale.register(NS, { en, zh })` — **parity chữ do locale quyết**, không phải fallback trong mã.
