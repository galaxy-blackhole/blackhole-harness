<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Báo cáo chuyển đổi row api-remotes (NỬA HOST) — vì sao KHÔNG mount, bằng chứng A/B và số đo
-->

# @galaxy-blackhole/gbh-api-remotes — nửa HOST của row `api-remotes`

Bản viết lại 1:1 **nửa host** của `@deepseek-ai/dsh-api-remotes` (nhóm api). Gói gốc là row top-level
trong cây DSH, **HAI MẶT** — nửa host 257 dòng + nửa browser **23.698 dòng** (`lib/client.js`).

## 0. Năm câu hỏi bắt buộc (recipe §0)

1. **Row này làm gì?** Dựng **nguồn sự kiện Cordis** mà Gateway chuyển tiếp cho Peer qua Remote: allowlist
   28 sự kiện (26 `emit` + 2 `waterfall`), hàng đợi kéo-theo-nhu-cầu, kiểm lossless JSON, cầu nối
   waterfall có định danh Agent.
2. **Row nằm ở đâu trong cây?** Top-level, `- id: api-remotes` · `name: '@deepseek-ai/dsh-api-remotes'`,
   **KHÔNG** `disabled` trong oracle (đo ở `.parity/dumps/*/ours.yml` dòng 621–622).
3. **Bao nhiêu mặt?** **HAI MẶT**: `dsh.client = { inject: ['@deepseek-ai/dsh-api-gateway'], platform: 'web', immediately: true }`
   + `lib/client.js` 23.698 dòng (ghép TYPERT_REMOTE của 10+ controller).
4. **Có trùng service không?** Nửa host **không tự đăng ký service**; nó TIÊU THỤ `ctx.typertGateway` và gọi
   `registerRemoteEvents(...)`. Gói GBH đang chạy `packages/host/typert-gateway` (`TypertGatewayService`,
   `super(ctx, "typertGateway")`) **CHƯA có** phương thức đó (grep 0 kết quả; stock khai ở
   `dsh-api-gateway/lib/types/index.d.ts:78`).
5. **Khai `gbh.row` chưa?** **KHÔNG** — xem §2 (`gbh.row_unmounted_ly_do`).

## 1. Bản đồ hành vi đã port (đối chiếu từng phần)

| Thành phần gốc | Ở đây | Ghi chú |
|---|---|---|
| `API_REMOTE_FORWARDED_EVENTS` (28 mục) | `src/events.ts` | đúng thứ tự, đúng mode, đúng bộ đọc tài nguyên |
| `inject = ["typertGateway"]` | `src/index.ts` | nguyên văn |
| `apply(ctx)` | `src/index.ts` | `ctx.effect(... , "api-remotes: forwarded Cordis event source")` |
| nguồn sự kiện (queue + 28 listener) | `src/index.ts` | listener đăng ký **trong lần gọi `source(signal)`**, không phải lúc `apply` |
| `RemoteEventQueue` | `src/queue.ts` | Deque + waiter + `end()` từ chối dispatch còn trong đệm |
| `remoteEventSourceEndReason` | `src/queue.ts` | `signal.reason` hoặc lỗi "nguồn kết thúc bất ngờ" |
| `forwardWaterfall` | `src/queue.ts` | `Promise.withResolvers` + `resolve({kind:'result'|'next'})` |
| `assertJsonArgs` | `src/queue.ts` | lỗi nêu ĐÚNG chỉ số tham số không lossless JSON |

Khác biệt **chỉ ở tầng kiểu** (không đổi hành vi): bản gốc `declare module '@deepseek-ai/dsh-typert-protocol'`
để mở khoá `ctx.remote.$on`; ở đây **bỏ augmentation** (nửa browser không port nên không có bên tiêu thụ;
khai trùng sẽ là TS2717 khi `.d.ts` stock cùng vào chương trình — bài học `session-projection` task-28).

## 2. Nửa BROWSER: port CƠ HỌC 1:1 từ artifact gốc + CỔNG BYTE

Gói gốc HAI MẶT; nửa browser là `lib/client.js` **23.698 dòng** (1.083.959 byte) — một bundle
`window.__ModuleLoader__.load({ id: "@deepseek-ai/dsh-api-remotes", factory })` ghép `TYPERT_REMOTE` của
10+ controller, không có import ngoài (mọi thứ inline; chỉ `require("zod")` qua bảng module).

Cách port (Lead chốt 19/10/2026 — "cơ học từ artifact gốc"):

1. **24 part nguyên văn** trong `src/client-parts/part-01.txt … part-24.txt` — cắt đúng ranh giới dòng,
   mỗi part ≤ 1.000 dòng, **giữ nguyên từng byte**.
2. `build.ts` ghép lại rồi chạy **BỐN cổng**, lệch 1 byte là DỪNG build:
   - **cổng byte**: chuỗi ghép phải BẰNG `lib/client.js` gốc (sha256 + địa chỉ ký tự lệch đầu tiên) — evidence part nguyên văn;
   - **cổng ownership** (thêm 19/10/2026, sau task-97 + boot-smoke cordis-host-runner): BẢNG id stock→id ta cho mọi gói ta bị bundle trích dẫn — hiện **2 luật**: `@deepseek-ai/dsh-llm` → `@galaxy-blackhole/gbh-llm` (**12** lần) và `@deepseek-ai/dsh-cordis-host-runner` → `@galaxy-blackhole/gbh-host-cordis-host-runner` (**63** lần); số kỳ vọng ĐO TỪ bundle gốc, lệch ⇒ DỪNG build. Phép đổi chạy SAU cổng byte nên part vẫn nguyên văn;
   - **cổng id**: chuỗi `@deepseek-ai/dsh-api-remotes` xuất hiện **ĐÚNG 1 lần** (dòng `id:` ở dòng 2);
   - **cổng quy đổi**: kết quả phải bằng bundle gốc ĐÃ thay id, và **0 lần** id gốc còn lại.
3. Đổi id module → `@galaxy-blackhole/gbh-api-remotes` (id ta dài hơn 5 byte) + ownership (`+60` byte cho 12 lần llm × +5 và `+630` cho 63 lần cordis-host-runner × +10) ⇒ đầu ra
   1.084.386 ký tự — đúng tiền lệ typert-gateway.

```text
client: 1084386 ký tự (gốc 1083691, +695 byte do id dài hơn + ownership 12 lần llm + 63 lần cordis-host-runner) · sha256 e17c27ce9b3fea030864d09f7e25f4b1a314ed36fad816dcce050d22ab38c75f · id gốc còn lại: 0 lần
```

Manifest: `dsh.client { inject: ["@deepseek-ai/dsh-api-gateway"], platform: "web", immediately: true }`
+ `exports["./client"]` + `gbh.row { id: "api-remotes", moduleIds: ["@galaxy-blackhole/gbh-api-remotes"],
aliases: ["@deepseek-ai/dsh-api-remotes"] }`.

`src/client.ts` chỉ là **ENTRY MARKER** (để tầng mount biết gói có hai đầu ra); nội dung runtime nằm ở
parts + build.

## 3. Bằng chứng A/B (đo, không suy luận)

`bun test tests/host/api-remotes.test.ts` — **19 ca · 19 pass · 52 expect**, mỗi ca chạy CẢ bản ta và
bundle gốc trên **Context cordis THẬT** (`apps/host/node_modules/@deepseek-ai/cordis`), so từng khung:

- tập export runtime = đúng 3 tên; `inject` = `["typertGateway"]`;
- allowlist 28 mục: tên/mode/khoá tài nguyên bằng gốc; bộ đọc `session` đồng nhất và `added` đọc `summary.sessionId`;
- `apply`: đăng ký ĐÚNG một nguồn, `host.home === homedir()`, nhãn effect nguyên văn;
- khung `emit` (không/có tài nguyên), thứ tự FIFO;
- **ba đường LỖI lossless JSON**: hàm (chỉ số 0), BigInt (chỉ số 1), `undefined` lồng trong object;
- waterfall **không carrier** ⇒ `next()`; **có carrier** ⇒ khung dispatch đúng `{value, subject, agentId}`,
  Gateway trả `result`/`next`; **hai nhánh lỗi** `must carry its Agent directly` (lệch agent, thiếu agent);
- vòng đời: abort kết thúc vòng kéo, emit sau abort không sinh khung, dispatch **còn trong đệm** bị từ chối
  bằng ĐÚNG `signal.reason`.

## 4. Số đo TRƯỚC → SAU

| Phép đo | TRƯỚC | SAU |
|---|---|---|
| gói GBH cho row `api-remotes` | **0** | **1** (`packages/host/api-remotes`, nửa host 257 → 320 dòng src) |
| export runtime của artifact | — | 3/3 khớp gốc (`API_REMOTE_FORWARDED_EVENTS` · `apply` · `inject`) |
| test A/B | 0 ca | **19 ca · 19 pass · 52 expect** |
| mount | không (đúng: `gbh.row_unmounted_ly_do`) | không đổi — chờ nửa browser + seam Gateway |

## 5. CHƯA làm (nói thẳng)

- **Chưa port nửa browser** (23.698 dòng, ghép TYPERT_REMOTE của 10+ controller) — ngoài phạm vi task-39.
- **Chưa mount**; `check:rows` không áp dụng (không khai `gbh.row`).
- **Chưa đo trên Windows/Peer thật**: mọi ca dùng Gateway giả trên Context cordis thật; đường truyền
  Remote vật lý thuộc `api-gateway`.