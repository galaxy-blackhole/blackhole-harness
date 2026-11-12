<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README cua goi @galaxy-blackhole/gbh-client-ui-tool — row ui-tool (cay goi Tool + 48 key toolview)
-->

# @galaxy-blackhole/gbh-client-ui-tool

Bản viết lại của Galaxy Blackhole cho row `ui-tool` của DSH
(`@deepseek-ai/dsh-client-ui-tool`, **4.636 dòng** bundle gốc — row lớn nhất trong nhóm client UI).

## 1. Gói này làm gì

Hai slot của bản gốc, nguyên tên:

| Slot | Kiểu | Nội dung |
|---|---|---|
| `conversation.chat.node` | keyed theo `key: "tool-call"` | nút cây gọi Tool trong hội thoại, khai **slot con** `{ "tool.call.toolview": { kind: "keyed", scope: "session" } }` |
| `tool.call.toolview` | keyed · **48 key** | một trình render cho mỗi tên Tool (bash · edit · write · read · read_image · grep · glob · ask_user_question · todo_write · web_search · web_fetch · 37 key "details") |

Nửa host **rỗng** y như gốc (bản gốc `lib/index.js` chỉ export `apply`).

## 2. Khuôn bắt buộc (đã tuân thủ)

- **MỘT id module**: `@galaxy-blackhole/gbh-client-ui-tool`; id gốc chỉ khai ở `gbh.row.aliases`.
- `build.ts` nhận **`process.argv[2]`** (`buildPackage(outDir?)` + `outDir ?? join(import.meta.dir, "lib")` + `if (import.meta.main)`).
- Cổng `apply`: `let uiToolInstalled = false` **phạm vi module** + WeakSet lưới an toàn, **cờ chỉ bật SAU `applyInner`**, **không khoá theo `ctx`**.
- Tên slot **LITERAL** trong `register({ name: "…" })` · component là **THAM SỐ THỨ HAI**.
- **CSS 7 module nguyên văn từng byte** từ bundle gốc (giữ nguyên hash lớp) — nằm trong `src/styles.ts`.
- Mọi file **≤ 1000 dòng**, mọi hàm export có JSDoc; header 5 dòng ở mọi file.

## 3. Cấu trúc

| Nhóm | File |
|---|---|
| Hằng số · kiểu · bộ chạy chung | `src/ids.ts` · `src/types.ts` · `src/runtime.ts` · `src/paths.ts` |
| CSS + hash lớp gốc | `src/styles.ts` (sinh tự động, 7 module) |
| Mô hình dữ liệu | `src/model-tool-call.ts` · `model-cards.ts` · `model-terminal.ts` · `model-image.ts` · `model-details.ts` · `model-details2.ts` · `model-todo.ts` · `model-primitives.ts` · `model-spill.ts` |
| Thành phần | `src/components-core.ts` · `src/component-tool-row.ts` · `src/tool-call-tree.ts` |
| Toolview (đăng ký slot) | `src/toolviews-read.ts` · `toolviews-ask.ts` · `toolviews-details.ts` · `toolviews-todo.ts` |
| Mặt plugin | `src/plugin.ts` · `src/client.ts` · `src/index.ts` · `src/index.ts` (host) |

## 4. Nghiệm thu (đo trên ARTIFACT, không grep `src/`)

| Phép đo | Kết quả |
|---|---|
| `bun run build.ts` | `lib/index.js` + `lib/client.js` |
| `grep -c 'id: "@deepseek-ai' lib/client.js` | **0** |
| `grep -c 'id: "@galaxy-blackhole' lib/client.js` | **1** |
| `bun test tests/client/ui-tool.test.ts` | **8 pass · 0 fail · 339 expect** |
| `bun run check:rows` | **0 dòng cho row này** (kết luận chung: 48 package — TẤT CẢ đạt) |
| `bun run gate --no-tests` | **7/7 XANH** |
| `lab:row` (home cách ly `/tmp/gbh-lab-ui-tool`, cổng riêng) | **200 · 39.861 B · 73 entry · `#root` 57.510 · 0 lỗi console · 0 dòng `did not activate`** |

Bằng chứng lab (payload `__DSH_BOOT__` của chính lượt boot):

- có entry `{"id":"@galaxy-blackhole/gbh-client-ui-tool","url":"plugins/??@galaxy-blackhole/gbh-client-ui-tool/client.js&rev=…","inject":[…4 gói y hệt gốc…]}`;
- **KHÔNG** còn entry `"id":"@deepseek-ai/dsh-client-ui-tool"` (row gốc đã bị overlay tắt, id gốc chỉ còn là tham chiếu `inject` của các row khác);
- trang **không** chứa `did not activate` lẫn `Failed to load plugins`.

## 5. Đối chứng với bundle gốc (bắt buộc, có ca test)

| Đối tượng | Cách đối chứng | Kết quả |
|---|---|---|
| Tập slot | chạy **chính hai regex của `check:rows`** trên `src/` của ta và trên `lib/client.js` gốc | **bằng nhau** (`conversation.chat.node` · `tool.call.toolview`) |
| Tập key toolview | regex `key: "…"` trên bundle gốc ↔ tập đăng ký thật của ta | **48 = 48**, mỗi key đúng một lần |
| CSS | so **từng chuỗi CSS** của 7 module với bundle gốc | **bằng nhau từng byte**, hash lớp giữ nguyên |
| Từ điển | mọi khoá `t("…")` trong `src/` phải có trong bundle gốc + `locale/{en,zh}.json` byte-for-byte | **đạt**, không có khoá bịa |
| `dsh.client.inject` | so với `package.json` của gói gốc | **y hệt 4 gói** |

## 6. Chưa xong / bàn giao cho Lead

- **Chưa mount vào app 5439** (một lượt boot của Lead) và **chưa A/B pixel** — đó là việc của Lead theo quy trình D.
- Toolview `todo` đăng ký slot ngay, nhưng phần **lịch sử ghi** (3 định nghĩa `uiConversation`) chỉ chạy khi dịch vụ `uiConversation` sẵn sàng — đúng ngữ nghĩa plugin con `inject: ["slots","uiConversation"]` của bản gốc.

## 7. Lệnh

```bash
cd packages/client/ui-tool && bun run build.ts      # hoặc: bun run build.ts <outDir>
cd <repo> && bun test tests/client/ui-tool.test.ts
cd <repo> && bun run lab:row ui-tool                # home cách ly + cổng riêng, KHÔNG đụng app 5439
```
