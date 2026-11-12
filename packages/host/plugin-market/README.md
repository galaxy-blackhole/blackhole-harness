<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc @galaxy-blackhole/gbh-plugin-market — README dựng lại 19/10/2026 (bản gốc bị xoá nhầm; xem §6)
-->

# @galaxy-blackhole/gbh-plugin-market — slice `worker` + `service` + `tools` + 2 mặt typert

Bản viết lại 1:1 của `@deepseek-ai/dsh-plugin-market`, giữ nguyên hợp đồng service `pluginMarket`,
entry Worker Thread và tool `plugin_market`; hai mặt RPC typert (`./typert`, `./remote`) port nguyên văn.

## 1. TRƯỚC → SAU

| Khía cạnh | TRƯỚC (stock `@deepseek-ai/dsh-plugin-market`) | SAU (gói ta) |
|---|---|---|
| `exports` | `.` · `./worker` · `./tools` · `./typert` · `./remote` · `./package.json` | **giữ NGUYÊN 6 mục** |
| `lib/index.js` | 23.214 B, `export { PluginMarket as default }` | 23.278 B, `var src_default = PluginMarket; export { src_default as default, PluginMarket }` — **do `src/index.ts` mới hơn bản build 05:46** (+64 B) |
| `lib/worker.js` | 1.103 B | **1.103 B — khớp byte** (`50177f28…`) |
| `lib/tools.js` | 6.526 B | **6.526 B — khớp byte** (`39609e2d…`) |
| `lib/typert.host.js` | 30.746 B | **khớp byte** (`18633935…`) |
| `lib/typert.remote-client.js` | 20.884 B | **khớp byte** (`c17d3029…`) |
| Worker Thread | `lib/worker.cjs` (đóng gói sẵn, phần lớn là vendor) | `lib/worker.js` (ESM, import `node:worker_threads` + `@deepseek-ai/dsh-plugin-market-index` **external**) |
| Service | `pluginMarket` (listIndexes/search/install/setIndexes…) | **giữ nguyên tên + hợp đồng**, seam cấu trúc |
| Tool | `plugin_market` (subpath `./tools`) | **giữ nguyên** name/description/parameters/output |

## 2. Khuôn build ĐÚNG — 5 entrypoint build **RIÊNG**

```ts
Bun.build({
  entrypoints: [join(dir, "src", name + ".ts")],  // MỘT entry mỗi lượt
  outdir: out, target: "node", format: "esm",
  naming: "[name].js", packages: "external",
})
```

| Entry | Tệp đích |
|---|---|
| `src/index.ts` | `lib/index.js` |
| `src/worker.ts` | `lib/worker.js` |
| `src/tools.ts` | `lib/tools.js` |
| `src/typert-host.ts` | `lib/typert.host.js` (rename từ `typert-host.js`) |
| `src/typert-remote-client.ts` | `lib/typert.remote-client.js` (rename từ `typert-remote-client.js`) |

**Vì sao KHÔNG build gộp 5 entrypoint**: Bun sinh **prelude chia sẻ** (`__create` / `__defProp` / `__getOwnPropDesc` / `__name`…)
khi nhiều entry cùng một lượt ⇒ `lib/worker.js` phình **1.103 B → 5.188 B**, `lib/tools.js` **6.526 B → 10.611 B** ⇒ lệch byte toàn bộ.
Đo được: build riêng ⇒ **4/5 tệp khớp byte tuyệt đối**; chỉ `index.js` lệch +64 B vì `src/index.ts` hiện dùng `export default` + named (src mới hơn lib 05:46) — **không phải lỗi build**.

## 3. Row + subpath

- **Row top-level `plugin-market`**: `gbh.row_unmounted_ly_do.row` = `{ id, stockId, moduleIds, disabled: "!!js '!ctx.get(''profileContext'')'", tests }` — **`disabled` giữ NGUYÊN dạng biểu thức `!!js`**, KHÔNG ép boolean (`readDisabled()` nhận chuỗi `!!js`).
- **Row lồng `tool-plugin-market`**: `gbh.nested = { kind: 'preset', pluginId: 'tool-plugin-market', stockId: '@deepseek-ai/dsh-plugin-market/tools', presets: ['preset-standard','preset-ptc','preset-cordis'] }`.
- **Subpath `./tools`** → `./lib/tools.js` (đã có trong `exports`; có test canh resolve từ profile).
- `tool-plugin-manager` **KHÔNG thuộc gói này** — là subpath `./tools` của `plugin-manager` (chủ gói đó bổ sung).

## 4. Đường lùi mount (3 bước)

1. **Chưa flip** (hiện tại): chỉ khai `row_unmounted_ly_do` + `nested` ⇒ mount BỎ QUA gói này, app chạy stock, không rủi ro.
2. **Boot-smoke home cách ly**: Lead chạy `boot-smoke plugin-market`; kiểm row lồng `tool-plugin-market` redirect đúng, không có `service has been registered`.
3. **Flip**: đổi key `row_unmounted_ly_do` → `row`, chạy `bun run check:app` (11/11) + thử một lượt UI Plugin Market.
   Bước nào đỏ ⇒ **xoá `gbh.row*`** (về bước 1) và báo Lead; KHÔNG sửa `src/` để chữa cháy.

## 5. Test

`tests/host/plugin-market.test.ts` (service) · `-worker.test.ts` · `-tools.test.ts` · `-typert.test.ts` · `-nested.test.ts` (row lồng + `gbh` manifest).
Mọi test A/B với `apps/host/node_modules/@deepseek-ai/dsh-plugin-market` và patch preset của kernel.

## 6. Sự cố README bị xoá (19/10/2026)

- **Ngày**: 19/10/2026, khi thêm ghi chú về `build.ts` dựng lại.
- **Nguyên nhân**: dùng `write` (GHI ĐÈ TOÀN BỘ) sau khi chỉ đọc **6 dòng đầu** ⇒ ~700 dòng còn lại bị xoá; gói chưa git track nên không khôi phục được.
- **Cách phòng**: (i) **đọc HẾT tệp trước khi ghi**; (ii) tệp **>200 dòng** chỉ dùng `edit`, **không `write`**; (iii) với gói này: luôn `edit`.
