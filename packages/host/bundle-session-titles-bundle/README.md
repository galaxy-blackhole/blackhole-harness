<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản sao 1:1 cordis.patch.yml của bundle @deepseek-ai/dsh-experimental-session-titles-bundle (thay id stock -> id gói ta theo bản đồ, ghi rõ số lần)
-->
# @galaxy-blackhole/gbh-session-titles-bundle — bundle patch (KHÔNG mã chạy)

Bản gốc: `@deepseek-ai/dsh-experimental-session-titles-bundle` @0.2.1-alpha.4 · `dsh.bundle.patch` = `./cordis.patch.yml` · **13 dòng**
Bản của ta: `@galaxy-blackhole/gbh-session-titles-bundle` — chỉ `cordis.patch.yml` + `package.json` (Loader chỉ tiêu thụ patch; bản gốc còn `lib/index.js` là đầu ra build, không phải hành vi).

## Thay id (tổng **1** lần)

| id stock | id gói ta | số lần |
|---|---|---|
| `@deepseek-ai/dsh-session` | `@galaxy-blackhole/gbh-session` | 1 |

Mọi id KHÔNG có trong bản đồ giữ NGUYÊN (các gói đó chưa port). Test khẳng định: thay NGƯỢC (id ta → id stock) phải ra **NGUYÊN VĂN** bản gốc.

## Test

`tests/host/bundle-profile-patches.test.ts` — YAML parse thật + so khớp hai chiều + đối chiếu số lần thay với `package.json#gbh.provenance`.
