<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README row ui-trajectory — de-bundle 12 lát nguyên văn + 1 lát viết tay, cổng idem và bảng tiếng Việt
-->

# ui-trajectory — bản Galaxy Blackhole của `@deepseek-ai/dsh-client-ui-trajectory`

Bản viết lại của Galaxy Blackhole cho row `ui-trajectory`: **de-bundle** (ghép VĂN BẢN 12 lát của bundle
gốc thành MỘT phạm vi hàm phẳng), **không viết lại hành vi**. Hành vi của row là dòng máy sinh; viết lại tay
sẽ ra một bản KHÁC, mà yêu cầu là render **KHÔNG ÍT HƠN bản stock**.

## 1. Bất biến "lát nguyên văn"

`src/parts/part-01.ts` … `part-12.ts` là **NGUYÊN VĂN 100%** bundle gốc (chỉ bỏ khối header 5 dòng và dòng
`export {};` của file nguồn). Mọi thứ KHÔNG có trong bản gốc nằm ở **đúng một lát viết tay**:
`src/parts/plugin-surface.ts` — cổng chống cài hai lần, bọc `exports.apply`, ba bảng tiếng Việt của
namespace `trajectory`, `uiSession.provide`… và dòng tra `module.exports` do `CLIENT_TAIL_LINES` giữ.

Manifest `src/manifest.ts` khai thứ tự ghép: `PART_FILES` (nguyên văn) → `CLIENT_EXPORT_LINES` →
`HANDWRITTEN_PARTS` (viết tay) → `CLIENT_TAIL_LINES`. Test parity bỏ **đúng khối viết tay theo VỊ TRÍ
MANIFEST** (không dò chuỗi nội dung) rồi so phần còn lại **từng byte** với bundle gốc.

Bảng tiếng Việt: **literal vi nằm ở lát viết tay** (`src/parts/plugin-surface.ts`), và
`tools/locale/embed-vi-parts.ts` trỏ tới đó — không trỏ vào lát nguyên văn nữa.

## 2. Bằng chứng đo được

```bash
bun run build.ts                                 # → lib/index.js + lib/client.js (nhận outDir qua argv[2])
bun test tests/client/ui-trajectory.test.ts      # parity từng byte · tập slot · cổng idem · hợp đồng store
bun run check:rows | grep ui-trajectory          # cổng chặn mount
```

Nhật ký mount (kể cả lần bị gỡ mount 18/10/2026) ở `MOUNT-LOG.md`.
## Nợ persist khoá `dsh.*` trong LÁT NGUYÊN VĂN (task-38 · Wave D2 · 18/10/2026)

Wave D đổi khoá persist `dsh.*` → `gbh.*` kèm migration MỘT LẦN. Gói này là **de-bundle** nên các khoá dưới
đây nằm trong **lát nguyên văn** (byte-locked, bất biến task-6) ⇒ **KHÔNG sửa literal**, giữ đúng bản gốc:

| Khoá CŨ (giữ nguyên) | File:line | Ý nghĩa |
|---|---|---|
| `dsh.trajectory.duration` | `src/parts/part-01.ts:17` | nguồn thời lượng dùng chung mọi khung xem |
| `dsh.trajectory.jsonStringWrapping` | `src/parts/part-01.ts:28` | tuỳ chọn xuống dòng chuỗi JSON |

**Vì sao không gãy hành vi**: các khoá này do chính gói đọc/ghi, không gói nào khác phiên dịch chúng; phần
còn lại của Wave D (scheme URI, boot marker, 4 gói persist không-verbatim) đã xong. **Điều kiện trả nợ**:
khi lát nguyên văn được chuyển sang **viết tay** (task riêng) — lúc đó rename sang `gbh.*` + thêm migration
một lần (đọc cũ → ghi mới → xoá cũ) và xoá mục nợ này.

Bằng chứng đo: `grep -n 'dsh\.' src/parts/part-01.ts` = 2 literal (chỉ 2 dòng trên).
