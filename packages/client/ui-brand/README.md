<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc README goi ui-brand: goi brand KHONG thay row stock, chi cap slot HERO (2 slot sidebar do row ui-brand-official giu)
-->

# `@galaxy-blackhole/gbh-client-ui-brand`

Gói **brand** của Galaxy Blackhole — **KHÔNG thay row stock nào**: được **CHÈN** vào cây plugin với id riêng
`ui-brand`, cấp dấu hố đen cho **slot HERO**:

| slot | nguồn gốc | ai giữ nếu gói này vắng |
|---|---|---|
| `conversation.hero.brand.mark` | row `ui-conversation` (slot `single`) | **fallback CÁ DSH** trong bundle nguyên văn |

Hai slot `sidebar.brand.mark` + `sidebar.brand.name` **thuộc row `ui-brand-official`** của ta — chúng là slot
`single` (một chủ) nên gói này **KHÔNG được** đăng ký lại.

## 0. ⚠️ Sự cố 18/10/2026 (đọc trước khi sửa)

Bản đầu của gói này đăng ký **cả 3 slot** (theo oracle A). Kết quả: hai gói cùng đăng ký `sidebar.brand.mark`
⇒ tầng nạp ném `single slot "sidebar.brand.mark" already has a registration at priority 0 (registered by
@galaxy-blackhole/gbh-client-ui-brand-official)` ⇒ **sidebar crash**, `#root` 22.204 thay vì 24.602.
**Luật rút ra**: trước khi đăng ký một slot, kiểm xem slot đó đã có chủ trong cây đang chạy chưa — slot `single`
chỉ một chủ. Chi tiết + số đo: `docs/reports/asset-task18-evidence.md` §0.

## 1. Manifest

```json
"gbh": {
  "row": { "id": "ui-brand", "insertAs": "ui-brand", "disabled": false, "moduleIds": ["@galaxy-blackhole/gbh-client-ui-brand"], "tests": ["tests/client/ui-brand.test.ts"] },
  "row_unmounted_ly_do": { "…": "đúng khối row ở trên + lý do + trạng thái (đường rollback)" },
  "rollback": { "cachGo": "xoá khối '- id: ui-brand' + '- insert: id: ui-brand' trong <home>/app.patch.yml rồi boot lại" }
}
```

- **id mới** `ui-brand` (không tồn tại trong cây stock) + `disabled: false` ⇒ khối patch **không tắt row nào**;
  loader chấp nhận (đã đo 2 lượt lab, xem bằng chứng §2).
- `dsh.client.inject` = renderer + conversation + locale (đúng seam cần cho slot hero).
- **Rollback**: gỡ 2 khối `ui-brand` trong `<home>/app.patch.yml` (hoặc đổi key `gbh.row` →
  `gbh.row_unmounted_ly_do`) rồi boot lại.

## 2. Kiểm

```bash
bun test tests/client/ui-brand.test.ts      # 6 ca: 1 id · 1 require · CHỈ slot hero (không đụng sidebar) · render logo · rollback · parity oracle
bun run packages/client/ui-brand/build.ts   # lib/index.js + lib/client.js
```
