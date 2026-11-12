/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 06/11/2026
 * desc RUNBOOK chuyển một gói sang artefact mang id GBH (P1b) — các bước cơ học, đã kiểm chứng trên 8 gói.
 */

# RUNBOOK — chuyển 1 gói sang artefact mang id GBH

Áp dụng cho gói có `build.ts` ghi artefact từ lát ghép NGUYÊN VĂN của stock.

## Bước 1 — build

```ts
import { denTa } from "../../../tools/lib/id-normalize.ts";
// ...
writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
```

QUAN TRỌNG: dùng `denTa` DÙNG CHUNG (theo `gbh.provenance.stock`), KHÔNG tự viết `split().join()` theo quy ước tên —
46/332 gói có tên khác quy ước (vd `dsh-tools` → `gbh-host-tools`).

## Bước 2 — bốn phép sửa test (mỗi dòng kèm chú thích `// 05/11/2026 (P1b): …`)

```ts
import { chuanHoaHost } from "../lib/artefact-normalize.ts";

// (1) so byte
expect(Buffer.from(chuanHoaHost(ours.toString("utf8")), "utf8").equals(theirs)).toBe(true);
// (2) so độ dài
expect(chuanHoaHost(built).length).toBe(STOCK_TEXT.length);
// (3) so chuỗi
expect(chuanHoaHost(built)).toBe(STOCK_TEXT);
// (4) sha
expect(sha256(chuanHoaHost(built))).toBe(STORED_SHA);
```

Nếu test khẳng định id: ĐỔI VAI TRÒ — id ta xuất hiện, id stock 0 lần.

## Bước 3 — thế giới tạm

Test nào dựng `node_modules` tạm chỉ symlink `apps/host/node_modules` thì ĐÃ ĐỦ (farm thứ hai do
`tools/lib/link-scope.ts` tạo). Nếu test dựng `node_modules` rỗng thì thêm:

```ts
symlinkSync(join(REPO, "node_modules", "@galaxy-blackhole"), join(temp, "node_modules", "@galaxy-blackhole"), "dir");
```

## Bước 4 — kiểm

```bash
bun run tools/lint/gate.ts --only typecheck --no-tests   # phải 0
bun test tests/host/<gói>.test.ts                        # phải 0 fail
grep -c '@galaxy-blackhole/gbh-' packages/<nhóm>/<gói>/lib/index.js   # phải > 0  ← ĐO ĐÚNG
bash scripts/sync-lib-to-profile.sh                      # BẮT BUỘC sau khi dựng lại artefact
```

## Bước 5 — nếu vướng

· `Cannot find module '@galaxy-blackhole/…'` ⇒ thiếu farm (chạy `bun run tools/lib/link-scope.ts`).
· `Export named X not found` ⇒ gói ĐÍCH (vd `sandbox`) thiếu tên so với stock — phải mở rộng gói đích trước.
· `Session | Session` / khác danh tính ⇒ gói đích đang bị nạp từ hai đường dẫn; bỏ qua gói này, xử lý sau.
· Test `-halves` dùng mô hình `PAIR_*` ⇒ sửa cả mô hình (30–45 phút), để CUỐI.

## Bước 6 — hoàn nguyên một gói

Phải hoàn nguyên ĐỒNG THỜI: `build.ts` + MỌI tệp test của gói (kể cả `-halves`) về CÙNG một mốc backup,
rồi dựng lại artefact + `sync-lib-to-profile.sh`.
