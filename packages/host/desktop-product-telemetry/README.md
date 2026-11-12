<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi @galaxy-blackhole/gbh-desktop-product-telemetry — bang nguon doi chieu G4, ly do peer, TRUOC/SAU, phan CHUA lam
-->

# @galaxy-blackhole/gbh-desktop-product-telemetry — row `desktop-product-telemetry`

Bản viết lại của `@deepseek-ai/dsh-host-product-telemetry-otel` (**88 dòng** `lib/index.js`, **MỘT MẶT**):
adapter chính sách cho **kênh sự kiện sản phẩm** — mount lên **không gửi gì**, ứng dụng tự chọn từng
sự kiện rồi gọi `ctx.productTelemetry.emit(record)`; kênh OTLP do **row `otel` đã mount** cấp, và fiber
sở hữu nó **rút sạch** kênh khi unload (có hạn chót huỷ).

## 0. Năm câu hỏi bắt buộc (mục 0 của công thức)

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có **đang BẬT** không? | **CÓ, nhưng CHỈ ở profile `desktop`.** Bản ghi trong `.parity/dumps/2026-10-17T22-32-31/ours.yml` dòng 447–457: `- id: desktop-product-telemetry` / `name: '@deepseek-ai/dsh-host-product-telemetry-otel'` + `disabled: !!js ctx.get('profileContext')?.name !== 'desktop'` + 7 khoá `config` (`scheduledDelayMillis` 30000 · `timeoutMillis` 15000 · `exportTimeoutMillis` 20000 · `shutdownTimeoutMillis` 2000 · `serviceName` `deepseek-harness-desktop` · `serviceVersion` `!!js process.env.DSH_CLIENT_VERSION` · `endpoint` `!!js process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL`). Profile của repo là `blackhole` ⇒ trong app 5439 row này **đang TẮT**; nó chỉ chạy ở composition `desktop`. |
| 2 | Thuần host hay có mount surface client? | **THUẦN HOST — MỘT MẶT.** Gói gốc **không** có `lib/client.js`, **không** `dsh.client`, không `slots.*`. Cặp disable+insert **không** làm mất nửa client nào. |
| 3 | Cần **seam** nào? | `extends Service` của cordis (đăng ký tên **`productTelemetry`**) · seam **`ctx.otel`** do row `otel` cấp (`createEventReporter`) · `node:http` (`validateHeaderValue`) · `@opentelemetry/otlp-exporter-base` (`CompressionAlgorithm`, enum chuỗi `none`/`gzip`). Không có seam ngoài bảng đã dùng. |
| 4 | Hành vi đo được là gì? | **Một tuy chọn kênh** được chuyển cho `ctx.otel.createEventReporter()` (`exporter.url` · `exporter.headers["x-channel"]` · `timeoutMillis` · `resourceAttributes` `service.name`/`service.version` · `scope.name` · 4 tham số gộp lô) + **một disposer** do `ctx.effect` nhận. Đo **TRƯỚC/SAU** bằng context giả ghi lại đúng vật thể đó (§3) — hai bản **bằng nhau từng khoá**. |
| 5 | Package gốc có `dsh.client` không? | **KHÔNG.** `python3 -c "import json;print(bool((json.load(open('…/dsh-host-product-telemetry-otel/package.json')).get('dsh') or {}).get('client')))"` ⇒ `False`; `ls lib/` chỉ có `index.js` + `types/`. |

## 1. Bảng nguồn đối chiếu (G4)

| File của ta | Nguồn gốc (CHỈ ĐỌC) | Ghi chú |
|---|---|---|
| `src/index.ts` dòng 1–177 | `apps/host/node_modules/@deepseek-ai/dsh-host-product-telemetry-otel/lib/index.js` dòng 1–88 + `lib/types/index.d.ts` dòng 1–53 | `positiveInteger` · `Config` (11 khoá, đúng mặc định) · lớp `ProductTelemetry extends Service` (`inject ["otel"]`, `static Config`, `emit`) · 4 thông điệp lỗi · câu cảnh báo hạn chót shutdown |
| `locale/{en,zh}.json` | `locale/{en,zh}.json` của gói gốc | chép **byte-for-byte** (LUẬT 000e; `shasum` khớp — test khẳng định bằng `Buffer.equals`) |

### Khác biệt CÓ Ý (ghi rõ để người sau không tưởng là sai sót)

1. **Kiểu dữ liệu khai ngay trong `src/index.ts`** (`ProductTelemetryRecord` = bản sao **cấu trúc** của
   `OTelEventRecord`; `ProductTelemetryScalar` = `OTelEventScalar`; seam `ProductEventChannel`) thay vì
   `import type … from "@deepseek-ai/dsh-otel"`. **Lý do đo được**: `.d.ts` của gói gốc khai
   `interface Context { otel: OTel }` **toàn cục**; nếu ta `import type` từ đó, tsc nạp thêm một khai báo
   `Context.otel` **thứ hai** (khác lớp) ⇒ `Subsequent property declarations must have the same type`
   (đúng lớp lỗi LUẬT 000d mô tả). Ta khai `Context.productTelemetry` như bản gốc, và **không** shim ambient.
2. **Gói KHÔNG ship `lib/types/*.d.ts`** (quy ước của repo: `main` là `lib/index.js`, `exports` không có
   `types`). Vì vậy `ProductTelemetryRecord`/`ProductTelemetryScalar` **không** xuất hiện trong artifact —
   **giống bản gốc**, nơi chúng cũng chỉ là `export type` (không có mặt trong `lib/index.js`).
3. **Không có `//#region` của tsdown**: `src/` là bản viết lại theo hành vi, không chép vùng biên dịch.

## 2. Vì sao khai `gbh.peers`, và vì sao `gbh.row` phải MIRROR điều kiện tắt của oracle

`apps/cli/src/mount.ts` chỉ symlink peer **đã khai** về kernel:
`["@deepseek-ai/cordis", "@deepseek-ai/schemastery", ...(metadata.peers ?? [])]`. Hai peer ngoài hai peer
tự động đó:

| peer | vì sao |
|---|---|
| `@deepseek-ai/dsh-otel` | **chủ sở hữu seam `ctx.otel`** (hợp đồng `createEventReporter`) — khai đúng như `peerDependencies` của bản gốc; kernel cấp **MỘT** thể hiện |
| `@opentelemetry/otlp-exporter-base` | `CompressionAlgorithm` được **nạp lúc chạy** (map `gzip`/`none`); **không** nằm trong workspace nên thiếu symlink ⇒ `Cannot find module` |

Kiểm **PHẦN TỬ** (không so số lượng): test khẳng định `peerGaps(gbh.peers, peerDependencies) = []`
**kèm ĐỐI CHỨNG ÂM** — thêm một peer không được khai vào danh sách ⇒ phép kiểm **phải** trả về đúng tên đó
(nếu không, nó là verdict rỗng). Test cũng khẳng định **mỗi peer có thật trong kernel**.

### 2b. `gbh.row` ĐÃ khai (18/10/2026) — và nó **mirror** một row stock đang TẮT CÓ ĐIỀU KIỆN

Row stock trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` (dòng 485–494) **không** tắt cứng:

```yaml
- id: desktop-product-telemetry
  name: '@deepseek-ai/dsh-host-product-telemetry-otel'
  disabled: !!js ctx.get('profileContext')?.name !== 'desktop'
  config:
    scheduledDelayMillis: 30000
    timeoutMillis: 15000
    exportTimeoutMillis: 20000
    shutdownTimeoutMillis: 2000
    serviceName: deepseek-harness-desktop
    serviceVersion: !!js process.env.DSH_CLIENT_VERSION
    endpoint: !!js process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL
```

⇒ Oracle chỉ gửi telemetry trên **profile `desktop`**; trên `blackhole`/`web`/`lab` row **bị tắt**.
Vì vậy khai `gbh.row` phải giữ **ĐÚNG** điều kiện đó cho **row ĐƯỢC CHEN**, nếu không ta biến một tính năng
sản phẩm đã tắt thành BẬT (lớp lỗi sản phẩm, không phải lỗi kỹ thuật):

```json
"row": {
  "id": "desktop-product-telemetry",
  "insertDisabled": { "js": "ctx.get('profileContext')?.name !== 'desktop'" },
  "config": { "scheduledDelayMillis": 30000, "timeoutMillis": 15000, "exportTimeoutMillis": 20000,
              "shutdownTimeoutMillis": 2000, "serviceName": "deepseek-harness-desktop",
              "serviceVersion": { "js": "process.env.DSH_CLIENT_VERSION" },
              "endpoint": { "js": "process.env.DSH_PRODUCT_ANALYTICS_OTLP_URL" } },
  "tests": ["tests/host/desktop-product-telemetry.test.ts"]
}
```

- **`disabled` KHÔNG khai** ⇒ row STOCK bị tắt **vĩnh viễn** (`disabled: true`) ở mọi profile.
- **`insertDisabled`** (trường mới của CLI, 18/10/2026) ⇒ row **CHEN** mang đúng biểu thức của oracle.

Khối patch sinh ra (đo bằng **chính CLI**, không chép tay — test `renderRewriteBlock`):

```yaml
- id: desktop-product-telemetry
  disabled: true

- insert:
    - id: desktop-product-telemetry-ours
      name: '@galaxy-blackhole/gbh-desktop-product-telemetry'
      disabled: !!js ctx.get('profileContext')?.name !== 'desktop'
      config: …
```

**Ngữ nghĩa theo profile** (test tính biểu thức bằng `new Function`, đúng như Loader):

| profile | row stock | row của ta | Telemetry |
|---|---|---|---|
| `blackhole` (app thật) | disabled (cứng) | **disabled** (điều kiện đúng) | **TẮT** — giống hệt trước khi chuyển |
| `web` · `lab` · `sdk` | disabled (cứng) | **disabled** (điều kiện đúng) | **TẮT** |
| `desktop` | disabled (cứng) | **BẬT** (điều kiện sai) | BẬT — đúng như oracle |

⇒ Nếu **không** mirror được bằng `insertDisabled`, luật là **DỪNG, không mount** và ghi nợ sản phẩm
(đúng chỉ đạo của Lead). Điều kiện mirror được kiểm **NGUYÊN VĂN** từ dump (không tự chế biểu thức).

## 3. TRƯỚC/SAU — hành vi đo được

Đo trên **ARTIFACT** (build vào profile giả `/tmp/gbh-desktop-product-telemetry-test` + symlink peer về
kernel — đúng cách mount thật làm), so trực tiếp với chính bundle gốc:

| Phép đo | Gốc | Ta |
|---|---|---|
| Tập export (`Object.keys`) | `["Config","default"]` | **`["Config","default"]`** |
| Static của lớp | `length,name,prototype,inject,Config` | **y hệt** |
| Method prototype | `constructor,emit` | **y hệt** |
| `Config({serviceName,serviceVersion})` | 10 khoá mặc định | **y hệt từng khoá** (`endpoint` … `shutdownTimeoutMillis` 21000) |
| `Config({})` | `$.serviceName missing required value` | **y hệt** |
| Tuy chọn kênh (`exporter` · `resourceAttributes` · `scope` · `processor`) | — | **y hệt từng khoá**; `compression` **vắng mặt** khi cấu hình bỏ trống, `"gzip"`/`"none"` khi có |
| 4 ca cấu hình sai | 4 thông điệp `product-telemetry-otel: …` | **trùng nguyên văn**, ném **trước** khi mở kênh |
| Shutdown hết hạn | cảnh báo + abort `Error: Product telemetry shutdown deadline exceeded` | **y hệt** |
| Dòng `lib/index.js` | 88 | 85 (chênh do chú thích/JSDoc, không do hành vi) |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** (row host, không có id module) |
| Khối patch của row | `disabled: !!js ctx.get('profileContext')?.name !== 'desktop'` cho row stock | stock `disabled: true` **+** row chèn `disabled: !!js …desktop` ⇒ trên `blackhole` **TẮT y như trước** |

Lệnh tái lập:

```bash
cd packages/host/desktop-product-telemetry && ~/.bun/bin/bun run build.ts
cd ../.. && ~/.bun/bin/bun test tests/host/desktop-product-telemetry.test.ts
```

## 4. C6 — vật thể cấu hình ĐỘC LẬP giữa các thực thể

Mỗi lần mount tạo **một** thực thể, nhưng mỗi thực thể dựng **vật thể riêng** cho `exporter.headers`,
`resourceAttributes`, `processor` và tuy chọn kênh. Phép so sâu **không** trả lời được *"hai vật có độc lập
không"*, nên test dùng **DANH TÍNH**: `a.exporter.headers !== b.exporter.headers`, rồi sửa `a` và khẳng định
`b` **không đổi**. Ca này chạy cho **cả hai bản** (ta và gốc) để chứng minh ta không tự tạo ra khác biệt.

## 5. Phần CHƯA làm (nói thẳng)

- **`gbh.row` ĐÃ khai** (18/10/2026, §2b) — nhưng **chưa có bằng chứng boot** do người viết gói không giữ
  lượt boot: cần (a) `--dump-config` cho thấy `desktop-product-telemetry-ours` mang đúng dòng
  `disabled: !!js ctx.get('profileContext')?.name !== 'desktop'` trên profile `blackhole`, (b) boot với
  `(5) did not activate = 0` **không tăng**, (c) `check:app` (8)/(10) không đổi. **Thuộc lượt boot của Lead.**
- **Chưa đo với collector thật** — mới đo tuy chọn kênh + vòng đời trên context giả (§3).
- **Nợ sản phẩm**: profile `desktop` chưa được đo trong repo này (không có profile `desktop` để chạy thử);
  phép chứng minh hiện tại là **tính biểu thức** + **khối patch** + **config mirror nguyên văn từ dump**.
- **Chưa ship `lib/types/*.d.ts`** (xem §1).
- Kiểu của `ctx.otel` đến từ **gói `otel` của ta** (`packages/host/otel/src/index.ts` khai `Context.otel`);
  nếu row `otel` quay về bản stock, khai báo đó vẫn đúng hình dạng nên `tsc` không đổi — nhưng **không có**
  ca test nào canh việc này (chỉ là hợp đồng kiểu, không phải hành vi lúc chạy).
