<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row ui-workflow-run cua DSH (M5 — row HAI MAT, mot package hai nua)
-->

# @galaxy-blackhole/gbh-client-ui-workflow-run

Bản viết lại của row **`ui-workflow-run`** — **panel một lượt chạy workflow bền** trong dòng hội thoại:
một `Definition` gấp bốn họ sự kiện `tool-workflow/*` thành **một node Chat có khoá**, và một renderer
disclosure theo trạng thái (lượt chạy → pha → thành viên) tôn trọng người đang đọc. Row **HAI MẶT**:
nửa host rỗng, toàn bộ hành vi ở nửa browser.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `ui-workflow-run` (tier T3, 678 dòng build) | `@galaxy-blackhole/gbh-client-ui-workflow-run` |
| Package | `@deepseek-ai/dsh-client-ui-workflow-run` `0.2.1-alpha.4` | `@galaxy-blackhole/gbh-client-ui-workflow-run` `0.1.0` |
| File gốc đã đọc (CHỈ ĐỌC) | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-workflow-run/{package.json,lib/index.js,lib/client.js}` | `packages/client/ui-workflow-run/{build.ts,src/*.ts}` |
| Kích thước bản build | **676 dòng JS** (`client.js` 670 dòng / 30.326 B + `index.js` 6 dòng / 193 B) | **1.547 dòng TS** (view 511 · workflow-definition 324 · panel-facts 292 · plugin 123 · build 95 · styles 76 · locales 72 · client 23 · ids 16 · index 15) → `client.js` **30.341 B** (gồm 5.010 B CSS nhúng) + `index.js` 286 B |
| Mức độ dẫn xuất | — | **viết lại theo hành vi** (không chép code; giữ nguyên bề mặt quan sát được: 5 tên service inject · occupant `key: "workflow-run"` · 19 chuỗi từ điển · tên lớp CSS + từng khai báo · hình dạng `Definition`/`match`/`start`/`update`/`buildViewNode` · chuỗi lỗi) |
| Hai mặt? | **CÓ** (`dsh.client` + `exports["./client"]`) | đủ **hai nửa trong MỘT package** |
| `dsh.client.inject` | 7 gói: `dsh-api-session-controller` · `dsh-client-locale` · `dsh-client-ui-chat` · `dsh-client-ui-conversation` · `dsh-client-ui-renderer` · `dsh-client-ui-session` · `dsh-client-ui-workspace` | **y hệt** (test `ca 8` so từng phần tử với manifest gốc) |
| Service inject phía browser | `uiConversation` · `uiWorkspace` · `slots` · `sessions` · `locale` | **y hệt** |
| Id module bundle đăng ký | **1**: `@deepseek-ai/dsh-client-ui-workflow-run` | **1**: `@galaxy-blackhole/gbh-client-ui-workflow-run` + khai `gbh.row.moduleIds` |

## 2. Vì sao cần

Ai gọi nó:

- **Definition** (`uiConversation.events.register`): gấp `tool-workflow/run-start` · `agent-start` ·
  `agent-end` · `run-end` thành **một** node Chat khoá theo `runId`; suy `interrupted` khi Turn neo bị
  ngắt hoặc ở ranh giới fork (`turnAbandoned`) — vì lượt chạy nền sống lâu hơn Step/Turn đã sinh ra nó.
- **Renderer** (`slots.inject("conversation.chat.node")`): header lượt chạy (tên · số thành viên · chấm
  trạng thái) + các pha, mỗi pha có header riêng và danh sách thành viên; thành viên nào còn chạy, là con
  của CHÍNH phiên này và có hình chiếu `subagent` thì bấm mở được (qua `uiWorkspace.openSession`).
- **Máy trạng thái disclosure**: mở khi có việc (running/abnormal), **giữ mở khi con trỏ còn trong vùng**
  và chỉ đóng sau khi rời đi (`pendingCleanCollapse`); lượt chạy sạch mà có pha vừa bắt đầu chu kỳ mới thì
  tự mở lại.
- Nó cấp từ điển namespace `workflowRun` (19 khoá: tên lượt chạy, đếm thành viên, 5 câu đếm trạng thái,
  5 chữ trạng thái, pha trống/không pha, thành viên trống, nhãn nút mở).

## 3. Peer

| Peer | Vì sao | Thuộc seam nào |
|---|---|---|
| `@deepseek-ai/cordis` | kiểu `Context`/`effect` mà `apply(ctx)` nhận; **chỉ khai peerDependencies**, không import lúc chạy | §3b — vòng đời plugin (M3 phơi cùng tên) |

Bốn thứ nửa client cần lấy **qua bảng module lúc chạy** (đúng hợp đồng C2), không phải dependency:
`react` (hook `useState`/`useRef`/`useMemo`/`useLayoutEffect`), `react/jsx-runtime`,
`@galaxy-blackhole/gbh-client-ui-primitives` (`DisclosureRow` · `IconChevronRightOutlineRegular` · `StateDot`),
`@galaxy-blackhole/gbh-client-store` (`shallowEqual`). Nửa host không import gì.

## 4. Đếm id module — và vì sao KHÔNG alias id stock

| Việc | Kết quả đo |
|---|---|
| Số `__ModuleLoader__.load({ id, factory })` trong bundle gốc | **1** (dòng 1–2), không có `chunk` |
| `key` trong `ctx.slots.register(...)` | `"workflow-run"` — **KHÔNG** vào bảng module |
| Bundle nào `require("@deepseek-ai/dsh-client-ui-workflow-run")`? | **0** — grep 4 KB đầu của **mọi** `lib/client.js` đã cài (test `ca 8b` chạy lại mỗi lần `bun test`) |
| Kết luận | **1 id module = tên package của ta**. Không cần alias; **khai tường minh `gbh.row.moduleIds`** vì khuôn này lấy id qua hằng số nên phép quét văn bản của cổng mount không thấy (bài học mục 6) |

## 5. Bảng TRƯỚC / SAU

**App thật 5439** (mount thật 15:29, 17/10/2026; app restart **tách khỏi phiên** theo công thức mục 000):

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| Trang `/` (HTTP · byte) | 200 · 49.234 B | 200 · **49.284 B** |
| Id trong `__DSH_BOOT__` | 72 entry · có `@deepseek-ai/dsh-client-ui-workflow-run` | 72 entry · **có `@galaxy-blackhole/gbh-client-ui-workflow-run`**, id stock ĐÃ BIẾN |
| `check:app` | — | **(1)…(10) ĐẠT**: 49.284 B · 72/72 entry · 0 `did not activate` · **`#root` 99.183 · 0 lỗi console** · bố cục **0/80 phần tử khác** · mount mới nhất 12 file khớp repo · **12 gói của ta chạy thật** |
| `parity:dump` oracleA vs ours | — | **PASS** · THÊM 0 · THIẾU 0 · ĐỔI 0 · đã thay **15** row (**+1 = row này**) |
| Bundle nửa browser | 670 dòng / 30.326 B | 30.341 B (IIFE, gồm CSS 5.010 B) |
| Test | — | **10 ca / 114 expect** |

**LAB CÁCH LY** (home `/tmp/gbh-m5b-wf-lab` + cổng **5460**, chạy `nohup … & disown`):

| Chỉ số | Kết quả |
|---|---|
| Trang `/` | 200 · 49.284 B |
| Entry · `__ModuleLoader__.mode` | 72 · `live` |
| `#root` render · lỗi console | **89.015 ký tự** · **0 lỗi** |
| Thẻ style của ta | có (`@galaxy-blackhole/gbh-client-ui-workflow-run`) |
| Id trong payload | **có id ta · không còn id stock** |
| `workflowNodes` trên trang | 0 — **đúng kỳ vọng**: home trắng không có phiên nào chạy workflow (xem mục 6) |

Lệnh tái lập:

```bash
bun test tests/client/ui-workflow-run.test.ts     # 10 pass (A/B với chính bundle gốc trong window giả)
bun run check:rows && bun run check:app           # hai cổng bắt buộc trước khi mount

GBH_HOME=/tmp/gbh-m5b-wf-lab nohup bun run apps/cli/src/main.ts host --port 5460 > /tmp/lab.log 2>&1 & disown
curl -sL -c /tmp/j -b /tmp/j "$(grep -o 'http://127.0.0.1:5460/?token=[^ ]*' /tmp/lab.log | head -1)" | wc -c

scripts/restart-host.sh   # mount thật, TÁCH khỏi phiên
bun run check:app                                          # đọc CẢ 10 chỉ số, gồm (8)(9)(10)
```

## 6. Phần CHƯA làm (nói thẳng)

- **Panel chưa render trong lab thật** (`workflowNodes: 0`): panel chỉ xuất hiện khi có sự kiện
  `tool-workflow/*` trong một phiên, mà home lab trắng không có lượt chạy nào. Vì vậy hành vi UI đầy đủ
  mới được kiểm ở **tầng seam** (A/B 6 ca với chính bundle gốc: Definition · chiếu pha · máy trạng thái ·
  cây element · tương tác) — **chưa có ảnh A/B thật cho màn này**; muốn có thì cần một lượt model chạy
  workflow thật, thuộc giàn của `tm-ui-features`.
- **Stub primitive**: `DisclosureRow` · `StateDot` · `IconChevronRightOutlineRegular` trong test là stub
  **chỉ mang prop đi qua** (không dựng DOM như primitive thật). A/B vẫn công bằng vì HAI BÊN dùng cùng
  stub, nhưng nó không chứng minh được *cách primitive thật vẽ*. Stub cố ý **hẹp bằng** những gì bundle
  gốc dùng (không thêm gì) theo luật "stub không được rộng hơn module thật".
- **Không có ca BYTE**: row không phục vụ route/RPC ⇒ không có thân phản hồi HTTP (ADR 0004 §8). Bù lại
  có `ca 9` ghim **bộ selector + từng thuộc tính CSS** so với bản gốc (31 selector, 0 lệch) và
  `ca 2/ca 3` ghim **hình dạng dữ liệu** của Definition/projection.
- **Chưa alias id stock** — đo được 0 consumer; nếu sau này có, phải khai `gbh.row.aliases` + thêm
  `loader.load({ id: stock })` kèm xử lý HMR.
- Ghi chú vận hành: lúc mount, `parity:dump` báo **lệch thứ tự 1** ở row `gbh-brand` (nợ của task-17,
  không phải row này).
`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-ui-workflow-run` (shasum `en 54e47de6efeb...` · `zh 041ce995b60f...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
