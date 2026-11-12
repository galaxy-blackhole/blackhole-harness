<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Goi viet lai row ui-commands cua DSH: be mat lenh phia client (nguon '/', the chon popupSelect, service commandUi)
-->

# `@galaxy-blackhole/gbh-client-ui-commands`

Bản viết lại của row **`ui-commands`** (bản gốc **2.102 dòng** `lib/client.js` + 12 dòng `lib/index.js`).

## G4 — BẢNG NGUỒN ĐỐI CHIẾU

| Hạng mục | Nguồn (chỉ đọc) | Mức dẫn xuất |
|---|---|---|
| Toàn bộ hành vi nửa client | `apps/host/node_modules/@deepseek-ai/dsh-client-ui-commands/lib/client.js` | **viết lại theo hành vi**, đọc kèm `lib/types/client/*.d.ts` |
| Nửa host | `.../lib/index.js` (chỉ có `apply() {}`) | viết lại (rỗng y nguyên) |
| Từ điển `command` (28 khoá × 2 ngữ) | `lib/client.js` vùng `locales` | **nguyên văn từng chuỗi** — test đối chứng từng khoá |
| CSS `PopupSelectView.module.css` | `lib/client.js` vùng `\0dsh-css:` | **nguyên văn từng byte** (2.064 byte, giữ hash lớp `mufS8W_*`) |
| `locale/en.json` · `locale/zh.json` | `.../locale/` | **chép byte-for-byte** |
| `dsh.client.inject` (4 id module) | `.../package.json` | **nguyên văn** |

**KHÔNG chép**: vùng `util/values/src/partial-json.ts` (620 dòng `PartialArguments`) là **mã chết** trong bundle gốc
(không lời gọi nào ngoài chính nó) nên không port. `clsx` (bản gốc nhúng sẵn) được thay bằng `src/view/class-names.ts`
— **cùng kết quả** trên mọi đầu vào mà row này dùng (chuỗi + giá trị giả).

## Nguồn gốc từng file

| File | Nguồn trong bundle gốc |
|---|---|
| `src/locales.ts` | vùng `lib/types/client/locales.js` |
| `src/resolution.ts` | vùng `lib/types/client/resolution.js` |
| `src/directory.ts` | vùng `lib/types/client/directory.js` |
| `src/option-groups.ts` | vùng `lib/types/client/option-groups.js` |
| `src/popup.ts` | vùng `lib/types/client/popup.js` |
| `src/presentation.ts` | vùng `lib/types/client/presentation.js` |
| `src/service.ts` | vùng `lib/types/client/service.js` |
| `src/weak-map-with-values.ts` | vùng `util/values/src/index.js` (`WeakMapWithValues`) |
| `src/view/*` | vùng `lib/types/client/PopupSelectView.js` + khối CSS |

## Hợp đồng bắt buộc

| # | Yêu cầu | Trạng thái |
|---|---|---|
| 1 | Bundle đăng ký **ĐÚNG MỘT** id — id của ta | ✅ đo trên artifact: `id: "@galaxy-blackhole…"` = **1**, `id: "@deepseek-ai…"` = **0** |
| 2 | Id gốc **chỉ** khai ở `gbh.row.aliases` | ✅ |
| 3 | `build.ts` nhận `process.argv[2]` | ✅ `buildPackage(outDir?)` + `import.meta.main` |
| 4 | Cổng `apply` **phạm vi module** + WeakSet, cờ bật **SAU** khi đăng ký xong, **không khoá theo ctx** | ✅ `let uiCommandsInstalled = false` + `uiCommandsSeenContexts` |
| 5 | Tên slot **LITERAL** trong `register({ name: "…" })`; slot danh sách có `id` **nguyên văn**; component là **tham số thứ hai** | ✅ `"conversation.input.overlay"` · `id: "command-popup"` · `register(spec, PopupSelectView)` |
| 6 | Đăng ký **đủ** slot bản gốc + test khẳng định **tập slot của ta = tập slot của bundle gốc** | ✅ dùng **chính hai regex của `check:rows`** |

## TRƯỚC / SAU (đo trên artifact)

| Phép đo | TRƯỚC (bản gốc) | SAU (bản của ta) |
|---|---|---|
| Số id module bundle tự khai | 1 (`@deepseek-ai/dsh-client-ui-commands`) | **1** (`@galaxy-blackhole/gbh-client-ui-commands`) |
| Slot đăng ký | `conversation.input.overlay` (`id: "command-popup"`, `order: 1`) | **y hệt** |
| Từ điển | 28 khoá × 2 ngữ | **28 khoá × 2 ngữ, từng chuỗi khớp** |
| CSS | 2.064 byte | **2.064 byte, byte-for-byte** |
| Nửa host export | `apply` | `apply` |

## Đối chứng với chính bundle gốc (trong `window` giả)

`tests/client/ui-commands.test.ts` — **12 ca / 161 expect**:
1. khuôn bundle (1 id · không ESM · `moduleIds`/`aliases`/`dsh.client.inject` nguyên văn · export nửa host);
2. **tập slot của ta = tập slot của bundle gốc** bằng chính hai regex của `check:rows`;
3. CSS **byte-for-byte** + 14 tên lớp giữ hash `mufS8W_*`;
4. từ điển **từng chuỗi** so với bundle gốc + `locale/*.json` byte-for-byte;
5. `filterOptions`/`groupOptions` **trùng kết quả** trên cùng bộ dòng;
6. `CommandDirectory` + giải cách viết (kể cả alias tiếng Trung `计划`/`权限`) **trùng** bản gốc;
7. **máy trạng thái** `PopupSelectController` so **ảnh chụp sau TỪNG động từ** với bản gốc;
8. **cây render** `PopupSelectView` trùng bản gốc ở 5 trạng thái;
9. cổng chặn cài hai lần: **lần cài đầu NÉM ⇒ cờ vẫn `false` ⇒ lần hai đăng ký lại đủ slot ⇒ lần ba (ctx khác) không đăng ký lại**.

## Chưa làm / nợ đã khai

- **`matchClaim` trả claim TRẦN** (không bọc `{ claim }`) — **nguyên văn bản gốc**; đã ghi chú ngay tại chỗ trong
  `src/service.ts`. Nếu oracle đổi hành vi này thì phải sửa **cả hai** bên.
- Vùng `PartialArguments` của `@deepseek-ai/dsh-util-values` **không port** (mã chết trong bundle gốc).
- Chưa đo A/B pixel trên app thật (chờ lượt boot của Lead).
