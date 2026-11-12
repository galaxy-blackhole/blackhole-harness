<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README gói gbh-web-fetch-http — bảng nguồn đối chiếu, vì sao peer, TRƯỚC/SAU, phần CHƯA mount
-->

# @galaxy-blackhole/gbh-web-fetch-http — row `web-fetch-http`

Bản viết lại của `@deepseek-ai/dsh-web-fetch-http` (**681 dòng** `lib/index.js`, **MỘT MẶT** — không có
`lib/client.js`, không `dsh.client`): provider tải HTTP(S) công cộng ẩn danh, đăng ký **id `http`** vào
**sổ fetch của seam `ctx.web`**, KHÔNG sở hữu service nào.

## 0. Năm câu hỏi bắt buộc

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Row có đang BẬT? | **CÓ** trong dump `2026-10-18T01-31-57` (`ours.yml` dòng 447–448: `- id: web-fetch-http` / `name: '@deepseek-ai/dsh-web-fetch-http'`; KHÔNG `disabled`, KHÔNG `config`). |
| 2 | Thuần host hay có nửa client? | **THUẦN HOST — MỘT MẶT**: `ls lib/` chỉ `index.js` + `types/`; `package.json` không có `dsh.client`. |
| 3 | Cần seam nào? | `ctx.web` (`registerFetchProvider`) · `@deepseek-ai/dsh-timeout` (`deadline`/`timeoutOf`) · `@deepseek-ai/dsh-http-proxy` (`proxyRouteFor`) · `ipaddr.js` · `undici` · `node:dns/promises` · `node:net`. |
| 4 | Hành vi đo được? | **13 test trên server HTTP CỤC BỘ** (không gọi mạng ngoài): redirect cùng origin/chéo origin/trần hop/thiếu Location · trần byte (Content-Length ⇒ `WEB_FETCH_TOO_LARGE`; luồng chunked ⇒ CẮT + `truncated`) · trần ký tự · content-type html/text/json/`+json` · charset khai báo (iso-8859-1) + charset lạ · timeout · huỷ · HTTP 404 là KẾT QUẢ. |
| 5 | Có `dsh.client`? | **KHÔNG** (đọc `package.json` gốc). |

## 1. Vì sao các peer này

- `@deepseek-ai/cordis` — `Context`/plugin contract · `@deepseek-ai/schemastery` — schema `Config` (mặc định y gốc).
- `@deepseek-ai/dsh-web` — `WebError` + kiểu `WebFetchProvider` · `@deepseek-ai/dsh-timeout` — hợp nhất huỷ + hạn chót (mã `WEB_FETCH_TIMEOUT`) · `@deepseek-ai/dsh-http-proxy` — `proxyRouteFor` tôn trọng chính sách proxy của tiến trình.
- `ipaddr.js` — phân loại unicast công cộng (IPv4-mapped/NAT64) · `undici` — transport ghim DNS (Agent + lookup).

## 2. TRƯỚC → SAU (đo 18/10/2026)

| Hạng mục | TRƯỚC | SAU |
|---|---|---|
| Gói trong repo | **0** (chỉ row stock) | **1** `@galaxy-blackhole/gbh-web-fetch-http` |
| Nguồn | 681 dòng JS (`lib/index.js`) | **723 dòng TS**: `src/ids.ts` 30 · `src/policy.ts` 90 · `src/network.ts` 233 · `src/provider.ts` 239 · `src/index.ts` 105 · `build.ts` 26 |
| Bề mặt export | `Config · DEFAULT_USER_AGENT · HttpFetchProvider · LOCAL_FETCH_PROVIDER_ID · apply · inject · name` | **ĐỦ 7 tên** (+ `CONFIG_DEFAULTS`, `resolveConfig`, kiểu `WebFetchLimits`) |
| Test hành vi | 0 | **13 test / 65 expect**, server cục bộ, phủ 6 nhóm: redirect/byte/content-type/timeout/huỷ/lỗi HTTP |
| User-Agent mặc định | `deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)` | `galaxy-blackhole/0.0.1 (+https://github.com/galaxy-blackhole)` — **đổi thương hiệu CÓ CHỦ ĐÍCH**, hành vi còn lại 1:1 |

## 3. Sai lệch CÓ CHỦ ĐÍCH (và vì sao)

1. **Seam `network` — tham số thứ 3 của `HttpFetchProvider`**, mặc định `publicHttpNetwork` (transport undici thật, y gốc). Test bun cần seam này vì **Bun tích hợp sẵn module tên `undici`** nhưng `Agent` của nó KHÔNG có `close`/`dispatch` (đo được `agent.close: undefined`) ⇒ transport undici thật không chạy được trong `bun test`. Seam chỉ thay PRIMITIVE mạng; toàn bộ logic provider (policy, redirect, trần byte, timeout, huỷ, dịch lỗi) giữ nguyên.
2. **`resolveConfig` + `CONFIG_DEFAULTS`** — đúng giá trị schema cấp; tiện cho test và nơi gọi `apply(ctx)` trực tiếp. Loader vẫn truyền cấu hình đã phân giải như cũ.
3. **`apply(ctx, config = {})`** — bản gốc nhận cấu hình loader đã phân giải; ta điền mặc định trước khi kiểm (hành vi cuối y hệt: đúng 4 hàm kiểm + đăng ký provider).

## 4. ĐÃ MOUNT (19/10/2026) — bằng chứng nghiệm thu

`package.json` khai **`gbh.row`** (giữ thêm `gbh.row_unmounted_ly_do` làm **đường lùi 1 phép sửa**).

| phép đo | kết quả |
|---|---|
| `lab:row web-fetch-http` (home cách ly) | test 13 pass · **did-not-activate = 0** ở cả 3 nguồn (trang / host log / stdout) · console 0 · pageerror 0 |
| `boot-smoke` (cổng riêng) | HTML 110.794 · `__GBH_BOOT__` có · facade có · #root 22.204 · **0 lỗi console** · **0 did-not-activate** ⇒ "boot LÀNH — được phép khai gbh.row" |
| mount (Lead boot kiểm soát) | patch có `web-fetch-http-ours` · host log `(5)=0` · `check:app` **11/11 ĐẠT** (135 entry · 60 gói ta · #root 47.181 · **46 slot** · 0 console · 0 pageerror · 9: 0/80 · 11: HMR) |
| `packages/README.md` | dòng bổ sung ở §4z2 **cùng lượt** với lúc khai row |

Baseline `#root` trong lab là **22.204** (đã kiểm bằng control `ui-shortcuts` cùng lượt), không phải mốc cũ 24.602.

## 5. Lệnh

```bash
bun run build.ts                                  # → lib/index.js
bun test tests/host/web-fetch-http.test.ts        # 13 test, server cục bộ, KHÔNG gọi mạng ngoài
bun run check:rows | grep web-fetch-http          # sau khi khai gbh.row
```

## 6. Nợ đã biết

- **Chưa mount** (mục 4). Khi mount phải kiểm **trùng id provider**: seam `ctx.web` ném `WEB_DUPLICATE_PROVIDER` nếu id
  `http` đã có — repo hiện **không** gói nào khác đăng ký provider id `http` (grep `registerFetchProvider` chỉ thấy
  `packages/host/web`), và **không** có service tên `webFetch` nào được đăng ký (grep toàn repo = 0).
- Transport undici thật chưa đo được dưới bun (Bun thiếu `Agent.close`); trên Node 26 chạy như gốc.
