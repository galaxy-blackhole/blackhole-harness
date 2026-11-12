<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README của @galaxy-blackhole/gbh-llm-retry — bảng nguồn đối chiếu G4, lý do peer, bảng TRƯỚC/SAU
-->

# @galaxy-blackhole/gbh-llm-retry

Bản viết lại của Galaxy Blackhole cho row **`llm-retry`** của DSH
(`@deepseek-ai/dsh-llm-retry`, bundle MỘT FILE 186 dòng `lib/index.js`, đọc từ
`apps/host/node_modules/@deepseek-ai/dsh-llm-retry/` — CHỈ ĐỌC).

**Vai trò**: chính sách thử lại cho lời gọi LLM. Đây là **bộ THI HÀNH**: chính sách `retryPolicy`
nằm trong cấu hình của **từng provider**, gói này **không có cấu hình riêng**.

> ⚠️ **Gói CHƯA khai `gbh.row`** — theo chỉ đạo của Lead (boot do Lead thực hiện). Gói **không
> thể làm hỏng app**: `bh host` chỉ sinh patch từ package CÓ `gbh.row`, và `check:rows` chỉ kiểm
> package CÓ `gbh.row`. Dòng trong `packages/README.md` §4 đã có sẵn cho lượt khai đó.

## 1. Bảng nguồn đối chiếu (G4)

| Phần của bản gốc | Nguồn đã đọc (chỉ đọc) | Bản của ta | Cách đối chiếu |
|---|---|---|---|
| `src/index.ts` — plugin `apply` | `lib/index.js` dòng 86–184 | `src/index.ts` | 12 ca chạy **cả hai** bản cài trên CÙNG một giàn rồi so từng sự kiện đã ghi + giá trị trả về |
| `src/brand.ts` — `RetryId` | `lib/types/brand.d.ts` + `@deepseek-ai/dsh-brand` `Branded<B>` | `src/brand.ts` | ca "hàm đồng nhất": `RetryId("abc") === "abc"` ở cả hai bên |
| `src/types.ts` — payload `llm/retry` · `llm/retry-started` | `lib/types/types.d.ts` | `src/types.ts` | so **nguyên văn từng trường** của payload đã ghi trong ca hành vi chính |
| `localDelay` | `lib/index.js` dòng 44–49 | `src/policy.ts` | bảng số học: trần mũ · jitter đối xứng (0 · 0.5 · 1) · kẹp trần chính sách |
| `retryPolicyKey` | `lib/index.js` dòng 50–64 | `src/policy.ts` | ca "cùng hành vi ⇒ cùng khoá" (đảo thứ tự `retryableCodes`) + đổi `maxRetries` ⇒ đổi khoá |
| `retryStateKey` | `lib/index.js` dòng 65–67 | `src/policy.ts` | tách trạng thái theo cặp (provider, chính sách) |
| `cancellableDelay` | `lib/index.js` dòng 68–81 | `src/policy.ts` | ba ca: đã huỷ ⇒ `false` ngay · huỷ GIỮA lúc chờ ⇒ `false` · hết giờ ⇒ `true` |
| `settleDownstream` | `lib/index.js` dòng 31–43 | `src/policy.ts` | ca `always` · tầng dưới NÉM ⇒ cảnh báo rồi vẫn thử lại |
| `llmRetryStateSchema` (`zod`) | `lib/index.js` dòng 82–85 | `src/index.ts` | ca schema: nhận đúng hình dạng, **TỪ CHỐI** `retry: -1` · thiếu `retryId` · không phải object |
| `Config` (schemastery) | `lib/types/index.d.ts` | `src/index.ts` | `String(Config) === String(Config gốc) === "{}"`, và cả hai đều là hàm |
| tập export lúc chạy | `export { Config, RetryId, apply, inject, name }` | `lib/index.js` | **đo trên ARTIFACT**: tập tên export bằng **đúng** tập gốc, không có `default` |
| `locale/{en,zh}.json` | `locale/*.json` | `locale/*.json` | chép **byte-for-byte** — `shasum` hai bên khớp (luật 000e) |

## 2. Peer — vì sao, và thuộc seam nào

| Peer | Vì sao thuộc seam | Ghi chú |
|---|---|---|
| `@deepseek-ai/cordis` | vòng đời plugin + `ctx.on` · `ctx.effect` · `ctx.logger` | bảng §3b. Ta **không import** gói này: context khai theo **CẤU TRÚC** (`RetryContext`), đúng khuôn `directory-picker-auto` — tránh việc khai báo ambient `Events` toàn cục (luật 000d) |
| `@deepseek-ai/schemastery` | schema `Config` để Settings/config-editor render được field | bảng §3b. Dùng ĐÚNG như bản gốc: `z.object({})` |
| `zod` (dependency) | kiểm trạng thái chiếu đã lưu; seam gọi `stateSchema.parse(row.val)` | thư viện bên thứ ba, **không** phải seam DSH; bản gốc cũng để ở `dependencies`. Nạp qua **`zod/v4`** vì `packages/client/ui-sidebar-right/src/externals.d.ts` khai ambient `declare module "zod"` **có thân** (đè kiểu thật toàn cục) — xem ghi chú dưới |

### Năm seam của bản gốc KHÔNG được import (ngoài bảng §3b)

Bản gốc `peerDependencies` tới `dsh-brand` · `dsh-agent` · `dsh-llm` · `dsh-session` ·
`dsh-session-projection` — **cả năm đều ngoài bảng §3b**, nên ta **khai lại theo CẤU TRÚC** đúng
phần row này chạm tới, chứ không import:

| Bản gốc lấy từ | Ta khai lại ở | Chỉ phần dùng thật |
|---|---|---|
| `dsh-brand` → `Branded<'RetryId'>` | `src/brand.ts` | `string & { readonly [BRAND]: "RetryId" }` — cùng khuôn, dấu cục bộ trong module |
| `dsh-llm` → `LlmFailure` · `ResolvedRetryPolicy` | `src/types.ts` | các trường mà bộ điều phối ĐỌC: `message` · `code` · `providerRetryAfterMs` · `mode` · `maxRetries` · `retryableCodes` · `initialDelayMs` · `maxDelayMs` · `jitterRatio` |
| `dsh-agent` → `agent/request-error` (waterfall) | `src/types.ts` + `RetryContext` | payload + `next()` + `RequestErrorAction` |
| `dsh-session` → `SessionEventMap` | `src/types.ts` | `agent.session.append(type, data)` |
| `dsh-session-projection` → `SessionProjectionRegistry` | `RetryContext` | `register(definition)` · `stateOf(session, key)` — seam CHỈ gọi `stateSchema.parse` |

`ctx.<tên-service>` (thay vì `ctx.get`) là **nguyên văn** cách bản gốc đọc seam, và cordis phục vụ
đúng cách đó qua proxy của `ReflectService` khi service đã được khai `inject` — nên ta giữ nguyên.

## 3. Bảng TRƯỚC/SAU

Gói **chưa được mount** (chưa khai `gbh.row`), nên "SAU" dưới đây là phép đo **trên artifact**, không
phải trên app 5439. Lệnh tái lập:

```bash
cd galaxy-blackhole/blackhole-tauri/packages/host/llm-retry
bun run build.ts                                   # ⇒ lib/index.js
grep -c 'id: "@deepseek-ai' lib/index.js           # ⇒ 0   (không có id module nào của gói gốc)
bun run build.ts /tmp/gbh-llm-retry-out            # ⇒ build theo process.argv[2]
cd ../../.. && bun test tests/host/llm-retry.test.ts
```

| Phép đo | Bản gốc (`@deepseek-ai/dsh-llm-retry`) | Bản của ta | Kết luận |
|---|---|---|---|
| Tập export lúc chạy (trên artifact) | `Config · RetryId · apply · inject · name` (không `default`) | **y hệt** | BẰNG |
| `name` | `"llm-retry"` | `"llm-retry"` | BẰNG |
| `inject` | `["agents", "sessionProjections"]` | `["agents", "sessionProjections"]` | BẰNG |
| `String(Config)` | `"{}"` | `"{}"` | BẰNG |
| Sự kiện ghi cho 1 lần thử (normal) | `llm/retry` + `llm/retry-started` | **y hệt từng trường** | BẰNG |
| Quyết định khi cạn ngân sách / mã không đủ điều kiện / không có chính sách | nhường tầng dưới | **y hệt** | BẰNG |
| `Retry-After` vượt trần: normal nhường · always dùng backoff cục bộ | đúng vậy | **y hệt** | BẰNG |
| Huỷ giữa lúc chờ | chỉ `llm/retry`, không `llm/retry-started`, trả `undefined` | **y hệt** | BẰNG |
| Số file nguồn · số dòng nguồn | 1 file build 186 dòng | **4 file · 545 dòng** (có mô tả từng export) | KHÁC HÌNH DẠNG CÓ Ý |
| `lib/index.js` (bản build) | — | **161 dòng** | — |
| id module của gói gốc trong bundle | 1 | **0** | KHÔNG có (gói host-only, không có nửa browser) |

## 4. Test — 24 ca / 94 expect (0 fail)

- **Bề mặt (đo trên ARTIFACT)**: tập export của ta **BẰNG** tập export bản gốc + `name` · `inject` ·
  `String(Config)` · `RetryId`.
- **Hàm thuần**: `localDelay` (bảng số học + jitter) · `retryPolicyKey` · `retryStateKey` ·
  `cancellableDelay` (đã huỷ · huỷ giữa · hết giờ).
- **Hành vi — A/B TRỰC TIẾP với chính bundle gốc**: mỗi ca dựng **hai giàn giống hệt nhau**, gọi
  `apply` của **cả hai** bản cài, bắn cùng payload, rồi `expect(ours).toEqual(theirs)` trên
  `{ quyết định, sự kiện đã ghi, số lượt gọi tầng dưới, số cảnh báo }`. Giàn giả **điều khiển bộ
  chiếu trên MỖI sự kiện đã cam kết** đúng như seam thật, nếu không bộ đếm ngân sách sẽ không bao
  giờ cạn và ca "nhiều lần thử" không đo được gì.
- **Đường lỗi**: cấu hình `{ retryPolicy }` và `{ unknown }` ⇒ **NÉM đúng thông điệp** (so với bản
  gốc) · tín hiệu đã huỷ ⇒ không ghi gì và **không treo** · schema trạng thái từ chối dữ liệu sai.
- **Vòng đời**: hàm dọn gỡ listener TRƯỚC rồi huỷ vòng đời rồi chờ các lượt đang chạy · listener gọi
  sau khi gỡ trả `undefined` ngay và **không** gọi tầng dưới.

> **Không có ca "an ninh"**: row này **không** phục vụ route HTTP nào, nên mục 3.4 của recipe
> (*"không cookie ⇒ 401"*) **không áp dụng** — nói rõ ở đây để người sau không tưởng đã bỏ sót.

## 5. CHƯA làm

1. **Chưa khai `gbh.row`** — theo chỉ đạo của Lead. Hệ quả: `bh host` **không** mount gói này, và
   `check:rows` **không** kiểm nó. Muốn mount: khai `gbh.row: { id: "llm-retry", tests: [...] }`.
2. **Chưa đo trên app 5439.** Chưa có phép đo `check:app` · A/B pixel · `lab:row` cho row này —
   chúng chỉ có nghĩa sau lượt boot của Lead.
3. **Chưa có entry `./types`.** Bản gốc ship `lib/types/*.d.ts` + `exports["./types"]`; ta build
   **một file** theo khuôn của repo và không phát `.d.ts`. Khác hình dạng **có ý**.
4. **Module augmentation `SessionProjectionStateMap` / `SessionEventMap` chưa khai.** Bản gốc
   augment hai bảng đó để tsc biết khoá `llmRetry` và hai sự kiện. Ta **cố ý không** khai: một
   `declare module` cho gói **có thật** là đè kiểu ở MỌI file (luật 000d, sự cố 5 → 53 vi phạm),
   và hai gói seam đó **không** nằm trong cây `node_modules` của gói này. Bù lại, các kiểu đó được
   khai **theo cấu trúc** ngay trong `src/types.ts` + `RetryContext`.
5. **Chưa đối chứng ở tầng vòng agent thật** (một lượt `agent/request-error` do `dsh-agent-loop`
   phát). Ca A/B hiện dùng payload do ta dựng — **không phải** A/B trên app thật.
