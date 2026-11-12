<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Báo cáo port 1:1 @deepseek-ai/dsh-tool-str-replace-editor → @galaxy-blackhole/gbh-tool-str-replace-editor: gói THƯ VIỆN (không row trong dump), 10 module TS theo vùng chức năng, build một entry ra lib/index.js, test A/B 23 ca/362 expect với bundle gốc.
-->

# @galaxy-blackhole/gbh-tool-str-replace-editor — port 1:1 (dsh-tool-str-replace-editor)

Port 1:1 `@deepseek-ai/dsh-tool-str-replace-editor` (**346 dòng** `lib/index.js`, 4 export
`Config · apply · inject · name`) thành **10 module TS** trong `src/` (**756 dòng**) + `build.ts` (33 dòng),
build MỘT entry `src/index.ts` → `lib/index.js` (**420 dòng / 18.050 B**).

## Vị trí — ĐO, không đoán
- Đây là **gói thư viện**, KHÔNG phải cordis row: dump 19/10/2026 **không có** row `tool-str-replace-editor`
  (cả top-level lẫn lồng trong preset) ⇒ **KHÔNG** khai `gbh.row`/`gbh.row_unmounted_ly_do`; chỉ
  `gbh.provenance` + `gbh.tests` + `gbh.peers` + `gbh.draft`.
- Stock **không có** trường `dsh` trong `package.json` ⇒ **không có nửa client**; **không có** `locale/`
  ⇒ gói ta cũng không có `locale/`.
- Stock `exports` = `['.', './package.json']`; gói ta giữ đúng hai subpath ấy (`main` + `exports['.']`
  đều = `./lib/index.js`).

## Provenance
```json
{
  "gbh": {
    "provenance": {
      "stock": "@deepseek-ai/dsh-tool-str-replace-editor",
      "version": "0.2.1-alpha.4",
      "sha": "14a7380c94b53150ec5545dfb8fcf28bb26c99b6deef9b27bb9cf4ff6fabb616"
    },
    "tests": ["tests/host/tool-str-replace-editor.test.ts"]
  }
}
```
`sha` = sha256 của `apps/host/node_modules/@deepseek-ai/dsh-tool-str-replace-editor/lib/index.js`
(17.052 B). Ca 21 của test khẳng định lại đúng cặp version + sha này.

## Bản đồ vùng → module (giữ nguyên văn logic/chuỗi/hằng số/thứ tự tham số)
| Vùng của bundle gốc | Module |
|---|---|
| hằng `TRUNCATED_MESSAGE` · `DEFAULT_DESCRIPTION` (dòng 12–25) | `src/description.ts` |
| `maybeTruncate` · `codepointCompare` · `matchOffsets` · `lineNumbersAt` (26–52) | `src/text.ts` |
| `class MutationPolicy` (53–67) | `src/mutation-policy.ts` |
| `resolveTarget` · `statExisting` · `requiredForCommand` (68–86) | `src/targets.ts` |
| `formatFileView` · `listDirectory` · `viewPath` (87–139) | `src/view.ts` |
| `createFile` · `replaceInFile` · `insertInFile` (140–223) | `src/mutate.ts` |
| `presentEditorCall` (224–262) | `src/present.ts` |
| `registerStrReplaceEditor` + schema tham số/đầu ra (263–327) | `src/register.ts` |
| `name` · `inject` · `Config` · `apply` (328–344) | `src/index.ts` |

Seam `ctx.fs`/`ctx.tools`/`ctx.get`/`ctx.waterfall`/`ctx.emit` khai theo **CẤU TRÚC** ở `src/seams.ts`
(không augment `SessionEventMap`, không kéo kiểu cordis vào thân logic).

## Số đo (19/10/2026)
| Phép đo | Kết quả |
|---|---|
| stock `lib/index.js` (đối chứng) | 346 dòng · 17.052 B · sha256 `14a7380c…fabb616` |
| artifact `lib/index.js` (ta) | **420 dòng · 18.050 B · sha256 `043bff5d8e9fa6e1b2974b58034579b9ee15b4dd7e65b50ef6b6d6a434f038c5`** · 4 export |
| `src/` (10 module) + `build.ts` | 756 + 33 dòng (file dài nhất `src/seams.ts` 144 dòng) |
| test A/B | **23 ca / 362 expect / 0 fail** (`bun test tests/host/tool-str-replace-editor.test.ts`) |
| tsc scoped | `src/index.ts` + `build.ts` + test: **0 lỗi** |
| lint scoped | header 0 · file-length 0 · jsdoc 0 vi phạm/0 cảnh báo (gói này) |
| locale | stock không có `locale/` ⇒ gói ta không có |

## Test A/B làm gì
Cùng một giàn `ctx.fs` giả (in-memory) cho **cả hai bên**; mỗi ca cài stock và bản ta rồi so **kết quả +
nhật ký gọi service theo thứ tự**:
- tập export (artifact + src + văn bản `export {}`), `name`/`inject`, manifest `main`/`exports`;
- `Config` (String/type/meta/dict/~standard, 12 đầu vào hợp lệ, 9 đầu vào lỗi, defaults 16000 + 1119 ký tự);
- `apply` từ chối `maxOutputChars`/`description` hỏng (nguyên văn);
- `parameters` JSON Schema biên dịch (trùng từng phần tử), `output.schema`, `render`;
- `presentCall` bốn nhánh (kể cả `Math.max(1, insert_line + 1)`);
- `defineTool` từ chối tham số hỏng (cùng `ToolArgsError`), khoá lạ đi qua như bản gốc;
- `view` tệp/thư mục (2 mức, lọc ẩn/node_modules/__pycache__, sắp codepoint), `view_range` hợp lệ/lỗi;
- `create`/`str_replace`/`insert` thành công + mọi nhánh lỗi (`FS_NOT_FOUND` · `FS_NOT_REGULAR_FILE` ·
  `FS_EDIT_NOT_FOUND` · `FS_AMBIGUOUS_EDIT` · `FS_SANDBOX_DENIED`), intent `createIfAbsent`/`replaceIfVersion`;
- sandbox: `ctx.get('sandboxPolicy')` lúc `apply`, `policy.resolve({ session })`, dấu từ chối
  `[sandbox: file access denied under <mode> mode]`, fs không giam giữ, thiếu `sandboxPolicy`/thiếu `ctx.fs`;
- cắt kết quả theo `maxOutputChars=40` (gắn `<response clipped><NOTE>…`).

Không mạng, không shell thật, không chạm `~/.galaxy`.

## CHƯA làm (ngoài phạm vi task này)
- **Không** khai `gbh.row`, **không** flip row, **không** mount vào profile.
- **Không** chạy `bun run gate`/`lab:row`/`boot-smoke`, **không** restart host 5439.
- Chưa có `lib/types/*.d.ts` (Bun.build chỉ phát `lib/index.js`; stock có `lib/types/index.d.ts`).
