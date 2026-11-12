<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Nguồn đối chiếu (G4) + lý do peer + bảng TRƯỚC/SAU của gói thay row session-turn-outline
-->

# @galaxy-blackhole/gbh-session-turn-outline

Thay row **`session-turn-outline`** (`@deepseek-ai/dsh-session-turn-outline`, **168 dòng** `lib/index.js`,
**MỘT MẶT**): đơn vị chiếu `turnOutline` — **dàn bài các lượt trong phiên**.

## 1. Bước 0 — cặp row đã xác nhận

| việc | kết quả |
|---|---|
| cặp row | `- id: session-turn-outline` + `name: '@deepseek-ai/dsh-session-turn-outline'` **CÓ THẬT** trong `.parity/dumps/2026-10-17T23-54-01/ours.yml` dòng **514–515** (và `oracleA.yml` dòng **496–497**) |
| `disabled` | **KHÔNG** — row đang BẬT trong profile `blackhole` |
| `config` của row | **KHÔNG CÓ** (không `config`, không `inject` ở dòng row) ⇒ Lead **không** cần khai `gbh.row.config` |
| mặt | **MỘT MẶT** — `lib/client.js` **KHÔNG tồn tại**; `lib/types/client.js` chỉ là `export {}` (chiếu KIỂU, 0 đăng ký module); gói gốc **không có `dsh.client`** |
| `gbh.row` | **do LEAD khai NGOÀI phiên viết gói** (mtime `package.json` **08:08:27 ngày 18/10/2026**; phiên này viết gói ở trạng thái CHƯA khai theo chỉ đạo). Hình dạng: `{ id: "session-turn-outline", tests: ["tests/host/session-turn-outline.test.ts"] }` — **KHÔNG** `config` (row gốc không mang), **KHÔNG** `moduleIds`/`aliases` (row một mặt). Test **ca 0c** ghi lại đúng hình dạng này. |

## 2. Nguồn đối chiếu (G4)

| hành vi | nguồn gốc (CHỈ ĐỌC) | gói ta |
|---|---|---|
| tên plugin · `inject` · `apply` | `apps/host/node_modules/@deepseek-ai/dsh-session-turn-outline/lib/index.js` | `src/index.ts` |
| phép gộp `turnOutline` (4 nhánh sự kiện) | `…/lib/types/projection.js` 134 dòng | `src/projection.ts` |
| hai schema zod + phép kiểm tăng nghiêm ngặt | `…/lib/types/projection.js` | `src/projection.ts` |
| bản xem trước có biên (50 · 120) | `…/lib/types/projection.js` `preview()` | `src/preview.ts` |
| `SessionSeq` (dấu kiểu + phép kiểm) | `…/lib/types/types.js` `SessionSeq()` | `src/brand.ts` |
| từ vựng miền | `…/lib/types/types.d.ts` | `src/types.ts` |
| tiêu đề i18n | `…/locale/{en,zh}.json` | `locale/{en,zh}.json` (**byte-for-byte**, sha256 `8d8af625…` · `4d2bfb28…`) |

## 3. Peer — vì sao chỉ một tên, và vì sao `SessionSeq` được viết lại

| peer | bậc (recipe §3b) | lý do ĐO ĐƯỢC |
|---|---|---|
| `@deepseek-ai/dsh-session-projection` | **Bậc 2** — seam dịch vụ của DSH | `apply` gọi **đúng** `ctx.sessionProjections.register(…)`; seam là toàn bộ mục đích của row. Khai theo **CẤU TRÚC** (không `import`), đúng khuôn `harness-dev-context` — nên **0 ambient** (luật 000d). |
| `zod` | **Bậc 3** — thư viện thật | `stateSchema`/`viewSchema` là schema zod mà seam gọi `parse`; bản gốc cũng để `zod` ở `dependencies`. |
| ~~`@deepseek-ai/dsh-session`~~ | **ngoài bảng §3b** | **Không khai.** Bản gốc chỉ dùng đúng hai thứ từ gói đó: kiểu `SessionEvent` (khai lại theo CẤU TRÚC ở `src/types.ts`) và hàm `SessionSeq` — gói `@deepseek-ai/dsh-brand` tự ghi *"keeps no runtime identity … independently installed copies produce interchangeable values"* và `brandNumber` là hàm **ĐỒNG NHẤT** ⇒ bản địa phương ở `src/brand.ts` chỉ phải giữ ĐÚNG phép kiểm + ĐÚNG câu lỗi. **Test A/B với chính kernel** (ca 7 · ca 8: 5 dạng sai, cùng `TypeError`, cùng câu) chứng minh. |

⇒ `gbh.peers` **1 ⊆** `peerDependencies` **1**, so **PHẦN TỬ**, có **ĐỐI CHỨNG ÂM** (ca 5 · ca 6).

## 4. TRƯỚC / SAU (đo trên ARTIFACT)

| phép đo | TRƯỚC (bản gốc) | SAU (gói ta) |
|---|---|---|
| tập export `lib/index.js` | `["apply","inject","name"]` | `["apply","inject","name"]` — **3 = 3**, 0 thiếu · 0 thừa, không `default` |
| `name` · `inject` | `"session-turn-outline"` · `["sessionProjections"]` | y hệt |
| `apply.length` | 1 | 1 |
| số lần `register` mỗi lần cài | 1 | 1 |
| `key` · `stateVersion` | `turnOutline` · `2` | y hệt |
| phép gộp trên kịch bản 14 sự kiện | — | **khớp TỪNG BƯỚC** (giá trị + danh tính) |
| `grep -c "id: @deepseek-ai" lib/index.js` | — | **0** (`__ModuleLoader__` cũng **0**) |
| `lib/index.js` | 168 dòng | 125 dòng |

```bash
cd packages/host/session-turn-outline && bun run build.ts      # ⇒ lib/index.js
bun test tests/host/session-turn-outline.test.ts                # 17 pass / 0 fail / 131 expect
```

## 5. Bốn nhánh hành vi (nguyên văn bản gốc)

1. **`turn/start`** — mốc neo của mỗi mục là `turn/start` (KHÔNG phải `user/message`), vì seq của nó là
   đích nạp-lùi của một lần nhảy: vòng agent ghi `turn/start` TRƯỚC prompt và các bước, nên cửa sổ nạp lùi
   qua seq đó chứa TRỌN lượt. Mốc **không tiến** số lượt ⇒ giữ nguyên trạng thái.
2. **`user/message`** — chỉ nguồn `kind === "user"`; chỉ lượt MỚI NHẤT còn chờ prompt; tin người dùng về sau
   trong cùng lượt (steering) KHÔNG ghi đè bản xem trước đầu tiên.
3. **`assistant/message`** — tin mới nhất CÓ CHỮ thắng, đệm vào `draft`; **giữ nguyên danh tính mảng `turns`**
   nên kênh thay đổi (cổng `Object.is`) không đẩy đi giữa hai mốc lượt.
4. **`turn/end`** — cam kết `draft` vào `response` của mục cuối rồi xoá nháp; `draft` rỗng ⇒ giữ nguyên.
   ⇒ Kênh thay đổi đẩy **tối đa ba lần mỗi lượt** (mốc · prompt · phản hồi).

## 6. CHƯA làm (điều kiện chặn mount)

- **`gbh.row` do Lead khai ngoài phiên** (08:08:27 ngày 18/10/2026) — phiên viết gói **không tự khai**;
  **ca 0c** chuyển từ "test canh chưa khai" thành khẳng định **hình dạng** khoá row (đúng recipe §7:
  *"xoá test canh hoặc đổi nó thành khẳng định ngược lại"*).
- **CHƯA mount** ⇒ chưa có `(5)` `did not activate` · `(8)` `#root` · `check:app` · TRƯỚC/SAU trên app 5439.
- Hình dạng khoá row khi mount: **`config` không có** (row gốc không mang `config`), `tests` trỏ
  `tests/host/session-turn-outline.test.ts`, **không** `moduleIds`/`aliases` (row một mặt, 0 id module).
- Chưa ship `lib/types/*.d.ts` (bản gốc ship `types` qua `exports["."].types`); hành vi lúc chạy không phụ thuộc.
