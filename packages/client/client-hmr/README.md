<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 17/10/2026
 desc Ban viet lai cua Galaxy Blackhole cho row client-hmr cua DSH.
 -->
# @galaxy-blackhole/gbh-client-hmr

Row `client-hmr` (tier T3) — cơ chế HMR của DSH: **nửa host** theo dõi bundle của mọi row bằng stat poll
rồi mở kênh **SSE `/plugins/events`**; **nửa browser** đọc kênh đó (qua transport của vỏ hoặc `EventSource`)
và nối khung `graph` / `rebuilt` vào bộ điều khiển module của trang.

## 1. Nguồn đối chiếu (G4)

| Hạng mục | Bản gốc DSH | Bản của ta |
|---|---|---|
| Row | `client-hmr` | `client-hmr` (khai `gbh.row` trong `package.json`) |
| Package | `@deepseek-ai/dsh-client-hmr` | `@galaxy-blackhole/gbh-client-hmr` (cột 'gbh tương ứng' của `docs/PARITY-MATRIX.md`, dòng 179) |
| Nửa host | `lib/index.js` (172 dòng): `name`, `inject`, `Config`, `apply(ctx, config)` | `src/index.ts` → `lib/index.js` (ESM) |
| Nửa browser | `lib/client.js` (315 dòng): bọc `__ModuleLoader__.load`, kèm bản sao `eventsource-parser` | `src/client.ts` + `src/plugin.ts` → `lib/client.js` (IIFE) — **bộ bóc SSE tự viết**, không thêm thư viện ngoài |
| Id module | `@deepseek-ai/dsh-client-hmr` (1 id) | `@galaxy-blackhole/gbh-client-hmr` (1 id) |
| Giao thức | `{type:'graph',graph}` / `{type:'rebuilt',id,rev}`, route `/plugins/events` | y nguyên |

**Đo trước khi viết** (đo lúc 18:16, không suy đoán): `grep -rc 'dsh-client-hmr'` trong
`@deepseek-ai/dsh-client-modules/lib/{client,index}.js` = **0** ⇒ không bundle nào `require` id stock.
Row này là **lá** của đồ thị (chỉ `inject: ['modules']`), nên bản của ta đăng ký **đúng một** id là tên package
của ta — không đăng ký id stock như khung `new:row` gợi ý (khung sinh cho ca bundle khác `require` id gốc).

## 2. Hành vi (giữ nguyên bề mặt)

- `name = 'client-hmr'`, `inject = ['clientModules','webServer']`, `Config = z.object({ pollIntervalMs: number.step(1).min(1).default(500) })`.
- Nửa host: `ctx.effect` theo dõi bundle của mọi row có `artifactBaseline` (chu kỳ `pollIntervalMs`) ⇒ `mtime/ctime/size` đổi thì
  gọi `ctx.clientModules.rebuilt(id)`; `ENOENT` ⇒ đánh dấu `dirty` để publish lại vòng sau; route `exact` `/plugins/events`
  trả `text/event-stream`, ghi `: connected` rồi ảnh chụp đồ thị đầu tiên, broadcast khi đồ thị đổi hoặc bundle build lại;
  `POST` ⇒ **405**. Gỡ plugin ⇒ đóng mọi kết nối và gỡ route.
- Nửa browser: `apply(ctx)` đọc `ctx.modules.entries`; khung `graph` ⇒ `entries.sync(graph)`, khung `rebuilt` ⇒
  `entries.reload(id, rev)`; khung loại lạ thì **bỏ qua**, khung sai định dạng thì `logger.warn` và không làm gì.
  Nguồn sự kiện: `globalThis.__DSH_TRANSPORT__.fetch` nếu vỏ có, ngược lại `EventSource(EVENTS_ROUTE)`.

## 3. TRƯỚC / SAU

| Phép đo | TRƯỚC (row DSH) | SAU (gói của ta) |
|---|---|---|
| `bun run check:rows` | row gốc | **27 package có `gbh.row` — TẤT CẢ đạt** (gói này có mặt, mount được) |
| Test hành vi | không có test của ta | `bun test tests/client/client-hmr.test.ts` → **6 pass · 0 fail · 23 expect** |
| Build | — | `lib/index.js` (ESM) + `lib/client.js` (IIFE; builder tự chặn nếu lọt cú pháp ESM) |
| `check:app` chỉ số (11) 'HMR sống' | do row gốc giữ | **CHƯA ĐO trong phiên này** — xem mục 4 |

## 4. Chưa làm (ghi rõ để phiên sau không tưởng là xong)

- **Chưa mount vào app thật**: chưa chạy `scripts/restart-host.sh` để nạp gói này vào profile đang chạy, nên chưa có
  `bun run check:app` 11/11 và chưa đọc chỉ số (11) 'HMR sống'. Phiên này **không tự tắt app 5439** (người dùng đang mở).
- **Chưa chạy `bun run lab:row client-hmr`** (home tạm + cổng riêng) ⇒ chưa có bằng chứng '0 dòng `did not activate`'.
- **Chưa đo hai lớp** (A/B pixel + chỉ số phần tử lạ): bề mặt HMR **chỉ hiện theo trạng thái**, khi làm phải tự dựng trạng thái
  (sửa bundle để phát `rebuilt`) rồi soát DOM, và dán nhãn *'trạng thái do TA TỰ DỰNG, KHÔNG so với oracle'*.
- **Chưa thêm dòng ROADMAP và mục `packages/README.md` §4** cho gói này.
- Bộ bóc SSE tự viết chưa đối chứng với `eventsource-parser` ở các ca biên (BOM, `retry:`, `id:`, dòng `CRLF`):
  hiện chỉ có 1 ca test cho việc cắt chunk giữa dòng — nợ kỹ thuật đã biết.

`locale/{en,zh}.json`: chep **byte-for-byte** tu ban goc `@deepseek-ai/dsh-client-hmr` (shasum `en 1a7544f050b4...` · `zh 3dee6b60ffe8...`) + export `./locale/*.json` — task-50: runtime dung `meta.title` lam **tieu de hang trong Plugins**, thieu file thi tieu de roi ve ten package cua ta (khac oracle).
