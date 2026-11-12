<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản sao 1:1 cordis.patch.yml của bundle @deepseek-ai/dsh-base (thay id stock -> id gói ta theo bản đồ, ghi rõ số lần)
-->
# @galaxy-blackhole/gbh-base — bundle patch (KHÔNG mã chạy)

Bản gốc: `@deepseek-ai/dsh-base` @0.2.1-alpha.4 · `dsh.bundle.patch` = `./cordis.patch.yml` · **523 dòng**
Bản của ta: `@galaxy-blackhole/gbh-base` — chỉ `cordis.patch.yml` + `package.json` (Loader chỉ tiêu thụ patch; bản gốc còn `lib/index.js` là đầu ra build, không phải hành vi).

## Thay id (tổng **18** lần)

| id stock | id gói ta | số lần |
|---|---|---|
| `@deepseek-ai/dsh-settings` | `@galaxy-blackhole/gbh-settings` | 1 |
| `@deepseek-ai/dsh-api-remote-access` | `@galaxy-blackhole/gbh-api-remote-access` | 1 |
| `@deepseek-ai/dsh-api-gateway` | `@galaxy-blackhole/gbh-host-typert-gateway` | 1 |
| `@deepseek-ai/dsh-tools` | `@galaxy-blackhole/gbh-host-tools` | 1 |
| `@deepseek-ai/dsh-token-meter` | `@galaxy-blackhole/gbh-token-meter` | 1 |
| `@deepseek-ai/dsh-session-query-sqlite` | `@galaxy-blackhole/gbh-session-query-sqlite` | 1 |
| `@deepseek-ai/dsh-typert-registry` | `@galaxy-blackhole/gbh-typert-registry` | 1 |
| `@deepseek-ai/dsh-subprocess-local` | `@galaxy-blackhole/gbh-subprocess-local` | 1 |
| `@deepseek-ai/dsh-session` | `@galaxy-blackhole/gbh-session` | 10 |

Mọi id KHÔNG có trong bản đồ giữ NGUYÊN (các gói đó chưa port). Test khẳng định: thay NGƯỢC (id ta → id stock) phải ra **NGUYÊN VĂN** bản gốc.

## Test

`tests/host/bundle-profile-patches.test.ts` — YAML parse thật + so khớp hai chiều + đối chiếu số lần thay với `package.json#gbh.provenance`.

## Ngoại lệ tài liệu hoá: `@deepseek-ai/dsh-web-frontend` KHÔNG port

Bản gốc `dsh-web-frontend` **không có mã nguồn**: 92 tệp `dist/` là **đầu ra vite build của web shell DSH** (`index.html` · CSS · JS · 40+ chunk ngôn ngữ · icon · manifest), export `./dist/*`. GBH phục vụ web shell bằng pipeline riêng (`apps/web` + row `web` của ta) ⇒ port dist đó = nhúng UI DSH đã build vào sản phẩm. Lead đã chốt (19/10/2026): **không port**, ghi ngoại lệ ở tầng matrix, **không tính là X chưa chuyển**.
