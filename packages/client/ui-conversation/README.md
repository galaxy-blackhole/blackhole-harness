<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi gbh-client-ui-conversation — row LON NHAT con lai (20.064 dong), de-bundle nguyen van
-->

# `@galaxy-blackhole/gbh-client-ui-conversation`

Bản viết lại của Galaxy Blackhole cho row `ui-conversation` (gốc: `@deepseek-ai/dsh-client-ui-conversation`).

## 1. Vì sao KHÔNG chép tay

Bundle gốc **20.064 dòng / 771 KB** (kể cả Lexical 0.49 nhúng sẵn: `Lexical.prod`, `LexicalSelection`,
`LexicalExtension`, `LexicalHtml`, `LexicalClipboard`, `LexicalPlainText`, `LexicalHistory`, `LexicalText`).
Hành vi là **dòng MÁY SINH**; viết lại tay sẽ ra **một bản KHÁC**, mà yêu cầu là render **KHÔNG ÍT HƠN bản stock**.

## 2. Phương pháp — de-bundle NGUYÊN VĂN

`tools/extract.ts` cắt bản biên dịch theo **đúng `//#region` của chính nó** (dấu vùng tsdown/rolldown để lại)
thành **104 phần** `src/parts/*.ts` ≤ 900 dòng thân + **10 module CSS** `src/styles/*.module.css`.
`build.ts` ghép lại theo `src/manifest.ts` và bọc thành script classic đăng ký **đúng một id — id của ta**.

Chỗ nào một vùng tự nó đã vượt 900 dòng (Lexical, `lib/types/client/input/facade.js`…) thì cắt thêm tại
**điểm cắt mà chính bộ phân tích của Bun parse được** (`Bun.Transpiler`), nên phép ghép vẫn trùng từng byte.

Tái lập: `bun run tools/extract.ts && bun run build.ts`.

## 3. Bất biến đã kiểm bằng test

| bất biến | cách kiểm |
|---|---|
| thân factory **trùng TỪNG BYTE** với vùng nguồn gốc | test `parity` (chỉ khác 2 dòng wrapper IIFE + khối cổng chặn cài hai lần) |
| **10 CSS trùng TỪNG BYTE** (giữ nguyên hash lớp, ví dụ `BNl2La_root`) | test `CSS` |
| **tập slot của ta = tập slot của bundle gốc** | đúng hai regex của `tools/check/rows.ts` |
| đủ **13 lần đăng ký** + **5 `slots.inject`**, tên LITERAL | test quét ngoặc trên artifact |
| **component là THAM SỐ THỨ HAI** của `register(spec, Component)` | test liệt kê đủ 13 tên |
| **keyed**: `key` = `id` của nút văn bản (`text` · `session`) | test cắt chính hai hàm sinh nút ra khỏi artifact |
| **store** cấp cho slot gói khác là thể hiện ĐẦY ĐỦ | test chạy `createConversationStore()` với hợp đồng `defineStore` |
| **primitive** ta dùng ⊆ primitive bản gốc dùng | test đối chiếu tập tên |

## 4. Cổng chặn cài hai lần

`let uiConversationInstalled = false` + `WeakSet` ở **phạm vi MODULE**, đặt **TRƯỚC JSDoc** của `apply`,
cờ **chỉ bật SAU khi `applyInner` chạy xong**. Không dùng tên `installedContexts`/`lastCtx`.
Lý do: tầng nạp sinh **hai entry** (id của ta + alias của gói gốc) ⇒ mỗi entry một `ctx` ⇒ cổng khoá-theo-ctx
**không bao giờ kích hoạt** ⇒ `apply` chạy hai lần ⇒ `service has been registered`.

## 5. Đo trên ARTIFACT (không boot app)

```
grep -c 'id: "@deepseek-ai' lib/client.js        # 0
grep -c 'id: "@galaxy-blackhole' lib/client.js   # 1
```

## 6. Nửa host

`src/index.ts` + `src/submission-settings.ts` dựng lại **nguyên hành vi** `lib/index.js` gốc (28 dòng):
`apply` khai cấu hình Conversation là **chỉ đọc** (`settings.configure({ auto: false }, ctx.fiber)`).
Sáu export trùng bản gốc: `BUSY_ENTER_BEHAVIORS` · `BUSY_ENTER_FIELD` · `CONVERSATION_SETTINGS_NAMESPACE` ·
`Config` · `DEFAULT_BUSY_ENTER_BEHAVIOR` · `apply`.

## 7. ⚠️ Nợ kỹ thuật — `// @ts-nocheck`

**104 phần `src/parts/*.ts` mang `// @ts-nocheck`**: chúng là **JS đã bỏ kiểu** của bản build, nên
`gate:typecheck` **KHÔNG canh nửa client này**. Đây là cái giá đã biết của phương pháp de-bundle — bù lại,
bất biến "trùng từng byte" được **test khẳng định**, tức hành vi khớp bản gốc **theo cấu trúc** chứ không
theo niềm tin. Cùng nợ với row `ui-chat`.

`src/ids.ts` · `src/manifest.ts` · `src/client.ts` · `src/index.ts` · `src/submission-settings.ts` ·
`build.ts` · `tools/extract.ts` **KHÔNG** mang `@ts-nocheck` — chúng được typecheck canh đầy đủ.

## 8. Một vi phạm typecheck CÓ SẴN, không phải của row này

```
packages/client/ui-conversation/src/submission-settings.ts:9  TS2307
  Cannot find module '@deepseek-ai/schemastery' or its corresponding type declarations.
```

`@deepseek-ai/schemastery` **chỉ có ở runtime của Host**, không nằm trong `node_modules` của repo — nên tsc
không giải được. Đây là **tình trạng có sẵn của cả cây**: `ui-chat` · `locale` · `shortcuts` ·
`product-analytics` · `connection` · `ui-settings-account` đều cùng một lỗi. **KHÔNG** khai báo ambient
`declare module` trong gói: bản khai tối thiểu sẽ **rò ra toàn bộ chương trình tsc** và biến `41 lỗi
"không tìm thấy module" của các gói khác thành lỗi thành viên (đo được: 35 → 76 vi phạm).
