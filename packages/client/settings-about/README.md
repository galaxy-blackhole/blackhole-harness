<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 18/10/2026
 desc Menu Thông tin cho popup Settings — package ĐỘC LẬP
-->

# @galaxy-blackhole/gbh-client-settings-about

Menu **Thông tin** cho popup Settings. Đây là **package ĐỘC LẬP**: nó **không thay thế** row nào của
DSH, chỉ **thêm** một mục vào slot `settings.section`.

## Vì sao gói này tồn tại

Hai mục đích, cả hai đều là **phép thử**:

1. **Đường cài plugin ngoài (G1)** — gói được cài qua `extra-bundles.json` của profile, **không** sửa
   hằng số `APP_PROFILE_BUNDLES` trong mã.
2. **Trường mở rộng `icon`** — bản gốc DSH tra bảng cứng `NAV_ICONS` theo id rồi fallback
   `IconSettingsOutlineMedium`, nên **mọi mục mới luôn ra icon Settings**. Gói này truyền một
   **component SVG** nên icon **đổi được**.

## Cách cài

```bash
cp -R packages/client/settings-about ~/.galaxy/blackhole/profiles/node_modules/@galaxy-blackhole/gbh-client-settings-about
echo '["@galaxy-blackhole/gbh-client-settings-about"]' > ~/.galaxy/blackhole/profiles/blackhole/extra-bundles.json
```

Restart host ⇒ mục **Thông tin / About** xuất hiện trong popup Settings với **icon tròn chữ i**.
