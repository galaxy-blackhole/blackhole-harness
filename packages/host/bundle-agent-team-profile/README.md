<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Bản sao 1:1 cordis.patch.yml của bundle @deepseek-ai/dsh-experimental-agent-team-profile (thay id stock -> id gói ta theo bản đồ, ghi rõ số lần)
-->
# @galaxy-blackhole/gbh-agent-team-profile — bundle patch (KHÔNG mã chạy)

Bản gốc: `@deepseek-ai/dsh-experimental-agent-team-profile` @0.2.1-alpha.4 · `dsh.bundle.patch` = `./cordis.patch.yml` · **33 dòng**
Bản của ta: `@galaxy-blackhole/gbh-agent-team-profile` — chỉ `cordis.patch.yml` + `package.json` (Loader chỉ tiêu thụ patch; bản gốc còn `lib/index.js` là đầu ra build, không phải hành vi).

## Thay id (tổng **1** lần)

| id stock | id gói ta | số lần |
|---|---|---|
| `@deepseek-ai/dsh-experimental-client-ui-agent-team` | `@galaxy-blackhole/gbh-client-ui-agent-team` | 1 |

Mọi id KHÔNG có trong bản đồ giữ NGUYÊN (các gói đó chưa port). Test khẳng định: thay NGƯỢC (id ta → id stock) phải ra **NGUYÊN VĂN** bản gốc.

## Test

`tests/host/bundle-profile-patches.test.ts` — YAML parse thật + so khớp hai chiều + đối chiếu số lần thay với `package.json#gbh.provenance`.
