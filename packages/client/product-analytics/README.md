<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi product-analytics: nguon doi chieu, hop dong hai nua, bang chung do duoc va cac khac biet CO Y so voi ban goc
-->

# `@galaxy-blackhole/gbh-client-product-analytics`

Bản viết lại của Galaxy Blackhole cho row **`product-analytics`** (tier T3, 1.314 dòng gốc) —
thu sự kiện sản phẩm desktop và báo về Host có xác thực.

## 1. Nguồn đối chiếu

| Mục | Giá trị |
|---|---|
| Gói upstream | `@deepseek-ai/dsh-client-product-analytics` (0.2.0-rc.2) |
| Bản gốc đã build (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-product-analytics/lib/` |
| `lib/client.js` (74 dòng) | nửa browser: `DesktopAnalytics` + `apply` + `inject` |
| `lib/index.js` (185 dòng) | nửa host: `ProductAnalytics` (TypertRemoteService) |
| `lib/typert.host.js` (284) · `lib/typert.remote-client.js` (220) | máy sinh: schema zod (**821 dòng TV** trong `docs/M5-STATUS.md`) |
| Mức độ dẫn xuất | **viết lại theo hành vi** (đọc bundle gốc + đối chứng trong test), không copy mã |
| Hợp đồng C3 · C1 | `docs/PARITY-MATRIX.md` dòng 97 · `tests/contract/c3-profile-patch.test.ts` |

Row gốc trong cây plugin (`.parity/dumps/*/ours.yml`):

```yaml
- id: product-analytics
  name: '@deepseek-ai/dsh-client-product-analytics'
  disabled: !!js ctx.get('profileContext')?.name !== 'desktop'
  config:
    enabled: true
    appVersion: !!js process.env.DSH_CLIENT_VERSION
```

## 2. Hợp đồng hai nửa (đăng ký ĐỦ như bản gốc)

| Bề mặt | Bản gốc | Gói này |
|---|---|---|
| nửa host: service cordis | `productAnalytics` (kế thừa `TypertRemoteService`) | y hệt (`src/service.ts`) |
| nửa host: namespace Remote | `productAnalytics` | y hệt (`REMOTE_NAMESPACE`) |
| nửa host: phương thức Remote | `enabled` · `report` · `watchPolicy` (**stream**) | y hệt — test đối chứng `remoteMethods` với chính bundle gốc |
| nửa host: `static Config` | `enabled` (mặc định true) · `appVersion` | y hệt (+ default rỗng để mount được khi patch không khai config) |
| nửa host: hook | `session/event` → `context_compression` · `loader/volatile-update` · `settings.configure({auto:false})` | y hệt |
| nửa browser: service | `productAnalytics` (phơi qua context) | y hệt (`ctx.provide`) |
| nửa browser: `inject` | `["remote", "remote.productAnalytics"]` | y hệt |
| nửa browser: slot | **không có slot nào** | **không có slot nào** (đúng bản gốc) |
| `dsh.client` | `platform: web` · `inject: ["@deepseek-ai/dsh-api-gateway"]` | y hệt |
| Danh mục sự kiện | 22 tên + 24 khoá thuộc tính (bảng chặn trong `typert.host.js`) | y hệt — test so TẬP với bản gốc |

## 3. Khác biệt CÓ Ý so với bản gốc (một điểm, có ghi lý do)

**`productTelemetry` KHÔNG nằm trong `static inject`** — bản gốc inject `["deepseekAccount", "productTelemetry"]`.

Lý do: trong profile không phải desktop (`blackhole` · `web`), row `desktop-product-telemetry` — nguồn **duy nhất**
của service `productTelemetry` — bị TẮT (`disabled: !!js ctx.get('profileContext')?.name !== 'desktop'`). Giữ
`productTelemetry` trong inject TĨNH thì entry này **pending vĩnh viễn**: service `productAnalytics` không bao giờ
được đăng ký ⇒ nửa browser (inject `remote.productAnalytics`) cũng pending ⇒ dòng `entries did not activate`.

Cách làm thay thế: `static inject = ["deepseekAccount"]` (seam thật, có trong mọi profile) và tra backend telemetry
bằng `ctx.get("productTelemetry")` **lúc gọi**; thiếu backend thì `report()` **bỏ qua, không ném** (đúng tinh thần
"Galaxy không gửi telemetry lên DeepSeek" của `profiles/blackhole/app.patch.yml`). Ở profile desktop thật, cả hai
service đều có nên hành vi trùng bản gốc.

Hai khác biệt nhỏ khác, cùng loại: (a) không ship artifact `./typert` / `./remote` (máy sinh) — cùng nguyên tắc đã
áp cho `gbh-api-settings-controller`; (b) tra service trong phương thức Remote bằng `ctx.get` thay vì đọc thuộc tính
(`this.ctx.deepseekAccount`) — bẫy "cannot get property … without inject" đã ghi ở `packages/host/account-controller`.

## 4. Bằng chứng đo được

| Phép đo | Kết quả |
|---|---|
| `bun run build.ts` (đích `lib/`) | `lib/index.js` + `lib/client.js` |
| `grep -c 'id: "@deepseek-ai' lib/client.js` | **0** |
| `grep -c 'id: "@galaxy-blackhole' lib/client.js` | **1** |
| `bun test tests/client/product-analytics.test.ts` | **18 pass · 0 fail · 64 expect** |
| `bun run check:rows` (dòng của gói này) | không có dòng `chan` |
| `bun run lab:row product-analytics` | **200 · 112 entry · `mode: live` · `#root` 58.588 ký tự · 0 lỗi console · 0 `did not activate`** |
| Gọi RPC THẬT từ trang lab (`/api/remote.mux` → `productAnalytics/enabled`) | host trả `gateway/signature-invalid … unary Remote methods cannot be opened through the stream carrier` ⇒ **endpoint CÓ được claim** (nửa host đã đăng ký service thật; nếu service pending thì đã là `not-found`) |
| `bun test` toàn repo | 711 pass · 1 fail — ca đỏ nằm ở **row `locale`** (chạy một mình: 5 pass), **không liên quan gói này** (bỏ file test của gói này ra khỏi `tests/client` thì ca đó vẫn đỏ) |

## 5. Nhật ký kiểm chứng

| Ngày | Việc | Kết quả |
|---|---|---|
| 18/10/2026 | Dựng gói theo khuôn `ui-brand-official` (MỘT id · cổng phạm vi MODULE · `buildPackage(outDir?)`) | build 2 nửa |
| 18/10/2026 | Đối chứng với chính bundle gốc | `inject` trùng · `remoteMethods` trùng · 22 sự kiện + 24 khoá trùng |
| 18/10/2026 | Test đầy đủ (đọc ARTIFACT) | 18 pass · 0 fail · 64 expect |
| 18/10/2026 | `bun run check:rows` | gói này chỉ 1 dòng **cảnh báo** (chưa mount) · **0 dòng chặn** |
| 18/10/2026 | `bun run gate --no-tests` | **7/7 XANH**, 0 vi phạm nào nhắc tới gói này (typecheck 598 file) |
| 18/10/2026 | `bun run lab:row product-analytics` (cổng 5470) | 200 · 112 entry · `mode: live` · `#root` 58.588 · **0 lỗi console** · **0 `did not activate`** · banner `Failed to load plugins` KHÔNG có trong DOM |
| 18/10/2026 | RPC thật qua mux trong lab | `productAnalytics/enabled` **được host claim** (`gateway/signature-invalid` = sai carrier, không phải `not-found`) ⇒ nửa host ACTIVE |
| 18/10/2026 | Patch do `bh host` sinh từ `gbh.row` | `- id: product-analytics / disabled: true` + `insert: product-analytics-ours` + `config` + `aliases` (YAML hợp lệ) |