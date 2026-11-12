<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản sao 1:1 cordis.patch.yml của bundle @deepseek-ai/dsh-sdk-minimal (thay id stock -> id gói ta theo bản đồ, ghi rõ số lần)
-->
# @galaxy-blackhole/gbh-sdk-minimal — bundle patch (KHÔNG mã chạy)

Bản gốc: `@deepseek-ai/dsh-sdk-minimal` @0.2.1-alpha.4 · `dsh.bundle.patch` = `./cordis.patch.yml` · **173 dòng**
Bản của ta: `@galaxy-blackhole/gbh-sdk-minimal` — chỉ `cordis.patch.yml` + `package.json` (Loader chỉ tiêu thụ patch; bản gốc còn `lib/index.js` là đầu ra build, không phải hành vi).

## Thay id (tổng **8** lần)

| id stock | id gói ta | số lần |
|---|---|---|
| `@deepseek-ai/dsh-tools` | `@galaxy-blackhole/gbh-host-tools` | 1 |
| `@deepseek-ai/dsh-token-meter` | `@galaxy-blackhole/gbh-token-meter` | 1 |
| `@deepseek-ai/dsh-subprocess-local` | `@galaxy-blackhole/gbh-subprocess-local` | 1 |
| `@deepseek-ai/dsh-session` | `@galaxy-blackhole/gbh-session` | 5 |

Mọi id KHÔNG có trong bản đồ giữ NGUYÊN (các gói đó chưa port). Test khẳng định: thay NGƯỢC (id ta → id stock) phải ra **NGUYÊN VĂN** bản gốc.

## Test

`tests/host/bundle-profile-patches.test.ts` — YAML parse thật + so khớp hai chiều + đối chiếu số lần thay với `package.json#gbh.provenance`.
