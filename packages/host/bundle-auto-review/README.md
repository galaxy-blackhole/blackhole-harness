<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 25/10/2026
 desc Bundle patch cho "Tự động duyệt uỷ quyền" — chỉ cordis.patch.yml + package.json, không có mã chạy
-->
# @galaxy-blackhole/gbh-auto-review-bundle — bundle patch (KHÔNG mã chạy)

Bản gốc: `@deepseek-ai/dsh-experimental-auto-review` @0.2.1-alpha.4 · `dsh.bundle.patch` = `./cordis.patch.yml`

## Vì sao cần gói này

Host từ chối bật một "bundle" nếu gói đích không khai `dsh.bundle` (`error.code = "not-bundle"`). Trước
25/10/2026 bảng quy tên `DOI_TEN` trỏ thẳng tên bundle stock sang **row package** `@galaxy-blackhole/gbh-auto-review`
⇒ bật công tắc trong *Plugin thử nghiệm* luôn báo "Bật thất bại". Gói này là lớp bundle mỏng để phép bật chạy đúng.

## Nội dung

| Tệp | Vai trò |
|---|---|
| `cordis.patch.yml` | Cắm row `auto-review` → `@galaxy-blackhole/gbh-auto-review` |
| `package.json` | Khai `dsh.bundle.patch` để Loader coi đây là bundle |
