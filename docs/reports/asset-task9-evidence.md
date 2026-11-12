<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Bao cao bang chung task-9: icon/asset DSH -> GBH (goi ui-primitives + row ui-brand-official), so do TRUOC/SAU
-->

# Báo cáo bằng chứng — task-9: icon/asset DSH → Galaxy Blackhole

> Trạng thái: **XONG pha 1 + pha 2** (bộ icon GBH + đổi brand hiển thị). Pha L2 (thay nguồn icon runtime)
> và L3 (title/favicon/manifest) **chưa làm** — đã có kế hoạch + ràng buộc, chờ Lead mở wave.
> Tài liệu kèm: [kiểm kê](asset-inventory-dsh.md) · [ánh xạ](icon-mapping-dsh-gbh.md) · [kế hoạch](asset-plan.md) ·
> [kế hoạch vỏ](shell-identity-plan.md).

## 1. Gói DSH gốc → gói GBH

| | giá trị |
|---|---|
| module gốc | `@deepseek-ai/dsh-client-ui-primitives` (module do **vỏ web** cấp; 288 export · 188 icon) + `@deepseek-ai/dsh-client-ui-brand-official` (row: 47 dòng bundle) |
| gói GBH | **mới** `packages/client/ui-primitives` → `@galaxy-blackhole/gbh-client-ui-primitives` (chưa mount) · **viết lại** `packages/client/ui-brand-official` |
| bộ icon GBH | **201 entry** (189 icon + 12 họ tổ hợp) · **103 artwork** (100 tĩnh + 3 động + 2 alias) |
| asset thương hiệu | logo hố đen + favicon + chữ "Galaxy Blackhole" (nguồn `blackhole-desktop-electron/…/brand/logo.svg`, sha256 `d7fac4b4…`) |

## 2. Cặp TRƯỚC → SAU (số đo, không ước lượng)

| # | phép đo | TRƯỚC | SAU | lệnh / nguồn |
|---|---|---|---|---|
| 1 | bundle `ui-brand-official` require module primitives DSH | **1** (`require("@deepseek-ai/dsh-client-ui-primitives")`) | **0** | `grep requireFn lib/client.js` |
| 2 | tên asset DSH trong artifact (`FishLogo`/`BrandWordmark`/fish path) | **3** | **0** | `grep -c` trên `lib/client.js` |
| 3 | `sidebar.brand.mark` trên DOM thật | `<svg viewBox="0 0 23.16 17.04">` = **cá DSH** | `<svg viewBox="0 0 128 128">` = **logo hố đen GBH** | Playwright (lab 5460) |
| 4 | `sidebar.brand.name` trên DOM thật | `<svg viewBox="26 0 156 24">` = **"deepseek HARNESS"** | `<span>Galaxy Blackhole</span>` | Playwright (lab 5460) |
| 5 | số lần fish path `M22.9168` trong HTML tài liệu | **2** | **1** (chỉ còn hero — xem §6) | Playwright |
| 6 | `#root` (cùng trang, cùng phép đo) | baseline **147** (bỏ 2 slot brand) | **163** khi có brand ⇒ **+16, không nhỏ đi** | Playwright: đo textContent trước/sau khi bỏ 2 slot |
| 7 | lỗi console / did-not-activate / overlay | 0 / 0 / 0 | **0 / 0 / 0** | `accept-row` + probe |
| 8 | artwork 1:1 với vỏ đang chạy (path `d` ≥30 ký tự) | — | **153/153 = 100%** byte-identical | `tests/client/ui-primitives.test.ts` |
| 9 | icon mà bundle client tham chiếu có trong sổ GBH | 0/89 | **92/92** (lúc 21:30; 89/89 lúc khảo sát) | cùng test |
| 10 | favicon/manifest/title phục vụ | DSH (cá/“DeepSeek Harness”/“DSH”) | **chưa đổi** (L3) | `curl` HTML phục vụ |

Ảnh A/B: [TRƯỚC](assets/brand-before-row.png) → [SAU](assets/brand-after-row.png) · mark: [trước](assets/brand-before-name.png) → [sau](assets/brand-after-mark.png).
Markup: [trước](assets/brand-before-slots.json) · [sau](assets/brand-after-slots.json) · probe thô: [lab-after-probe.json](assets/lab-after-probe.json).

## 3. Test (bun test)

| tệp | kết quả |
|---|---|
| `tests/client/ui-primitives.test.ts` | **13 pass · 0 fail** (947 expect) |
| `tests/client/ui-brand-official.test.ts` | **8 pass · 0 fail** (30 expect) |
| `tests/check/no-dsh-assets.test.ts` | **9 pass · 0 fail** (21 expect) |

## 4. Cổng

| cổng | kết quả |
|---|---|
| `bun run gate --no-tests` | **7/7 XANH** (header 1.901 file · file-length · jsdoc · dep-guard · parity-matrix · typecheck 1.641 file · hygiene) |
| `bun run check:rows` | **120 package · TẤT CẢ đạt · 0 chặn** |
| `bun run tools/check/accept-row.ts ui-brand-official` | **DAT** — test 8/0 · `chan=0` · lab #root 24.602 · 0 lỗi console · 0 did-not-activate · 0 overlay (dọn lab xong) |
| `bun run tools/check/no-dsh-assets.ts` | N1 **0** · N2 **16 file** (nợ của chủ gói, xem §5) · N3 **0** · N4 **0** |
| `tsc --noEmit` (đúng bộ cờ của gate, chạy tay vì gate bị ETIMEDOUT) | **0 lỗi** trên 17 tệp mới/sửa |

## 5. Nợ đo được — chuỗi thương hiệu "DeepSeek Harness" còn 16 file (KHÔNG thuộc vùng ghi của tôi)

| nhóm | tệp | số lần |
|---|---|---|
| system prompt / runtime identity | `packages/host/system-prompt/src/index.ts` (3) · `harness-dev-context/src/index.ts` (6) · `web-runtime/src/index.ts` (1) · `shell-env/src/{index,registry}.ts` (2) · `llm-deepseek-account/src/{index,listing}.ts` (3) · `web-startup/src/index.ts` (1) · `subprocess/src/types.ts` (2) | 18 |
| UI hiển thị | `packages/client/ui-layout/src/{ids,app-frame}.ts` (PRODUCT_TITLE = "DeepSeek Harness") | 2 |
| từ điển locale | `ui-settings-account` (18) · `ui-settings-models` (6) · `settings-about` (3) · `ui-sidebar-documentpreview` (2) · `ui-plugin-manager` (2) | 31 |

⇒ Cổng **N2 là ratchet**: hiện `tests/check/no-dsh-assets.test.ts` chốt "≤16 file"; mỗi lần chủ gói dọn xong phải hạ trần.
**Đề nghị Lead phân công** (không phải việc của task-9 vì nằm ngoài vùng ghi).

## 6. Việc còn lại (có kế hoạch, chưa làm)

| # | việc | vì sao chưa làm | kế hoạch |
|---|---|---|---|
| 1 | **L2 — thay nguồn 89 icon runtime** (53 bundle vẫn `require` module của vỏ) | đổi require trước khi có module thay thế ⇒ `require missed the module table` ⇒ app trắng (D7) | [asset-plan.md](asset-plan.md) §5 pha 4: chủ `packages/client/modules` + shell cấp `staticModules` cùng khoá |
| 2 | **Hero còn cá DSH** (`conversation.hero.brand.mark`) | row brand chỉ được đúng 2 slot (parity B); thêm slot = thừa so với bundle gốc | gói brand riêng `@galaxy-blackhole/gbh-brand` như oracle A (cần mở vùng ghi) |
| 3 | **L3 — title/favicon/manifest** | Lead chốt D6: wave sau | [shell-identity-plan.md](shell-identity-plan.md): đường A (`tapIndex` + route đè) hay B (ship dist frontend) |
| 4 | N2 — 16 file chuỗi thương hiệu | ngoài vùng ghi | phân công chủ gói |

## 7. Ràng buộc đã giữ

- **Không commit git** · **không chạy `scripts/restart-host.sh`** · **không kill job boot** · **không ghi `~/.galaxy/gbh`** · **không sửa `vendor/`**.
- Không sửa `docs/DSH-CONVERSION-MATRIX.md` / `docs/contracts/data/conversion-signoff.json` (Lead sở hữu).
- `tools/check/`: chỉ **thêm** `no-dsh-assets.ts` (đã báo `tm-evidence`).
- Việc đo lab chạy **một lượt** (cổng 5460, home riêng), đã dọn (kill listener + `rm -rf` home).

## 8. Đề nghị ký (chờ reviewer độc lập)

```
row: ui-brand-official            + gói mới (chưa mount) ui-primitives
package gốc DSH : @deepseek-ai/dsh-client-ui-brand-official + module @deepseek-ai/dsh-client-ui-primitives
package GBH     : @galaxy-blackhole/gbh-client-ui-brand-official + @galaxy-blackhole/gbh-client-ui-primitives
A khuôn bundle  : ĐẠT — bundle 1 id của ta; 0 require primitives DSH; 0 tên asset DSH
B tập slot      : ĐẠT — 2 slot nguyen van (mark/name), không thêm/không thiếu; component là tham số thứ hai
C cổng idem     : ĐẠT — cờ phạm vi module, bật SAU đăng ký; ca test "lần hai bỏ qua"
C2 keyed/store  : không áp dụng (row thuần giao diện, không store)
C3 #root        : ĐẠT — cùng trang: baseline 147 → 163 (+16 ký tự chữ wordmark), KHÔNG nhỏ đi
C4 lab          : ĐẠT — cổng 5460: #root 24.602 · 0 lỗi console · 0 did-not-activate · 0 overlay
D bằng chứng    : ảnh A/B + markup JSON + probe thô trong docs/reports/assets/
test            : ui-primitives 13 pass · ui-brand-official 8 pass · no-dsh-assets 9 pass (0 fail)
gate            : bun run gate --no-tests = 7/7 XANH · check:rows = 120/120 đạt, 0 chặn
ket luan        : ĐỀ NGHỊ KÝ phần pha 1+2; L2/L3/N2 ghi thành nợ có kế hoạch, không chặn ký phần này
```
