<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói THƯ VIỆN gbh-scope — vendor 1:1 @deepseek-ai/dsh-scope (provenance + sha), vì sao KHÔNG mount
-->

# @galaxy-blackhole/gbh-scope (thư viện)

Bản viết lại **1:1** của `@deepseek-ai/dsh-scope` bằng cách **vendor nguyên byte** toàn bộ `lib/**` của bản gốc (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-scope'` |
| Dòng trong `docs/PARITY-MATRIX.md` | **không có** (matrix chỉ liệt kê gói cấp row) |
| Hệ quả | consumer inline thư viện vào bundle của họ ⇒ `gbh.draft` (thư viện), **không** `gbh.row`/`gbh.nested` |

## 1. Provenance

| trường | giá trị |
|---|---|
| `gbh.provenance.stock` | `@deepseek-ai/dsh-scope` |
| `gbh.provenance.version` | `0.2.1-alpha.4` |
| `gbh.provenance.sha` (sha256 `lib/index.js`) | `2829df71d76e08941457d4dd173eac60783e55354921137c8b75e8b5c0d2ecca` |
| `lib/index.js` | **357** dòng, byte-identical |

## 2. Build

```bash
bun run packages/host/scope/build.ts   # vendor lại từ kernel + CỔNG SHA
```

## 3. Test

`tests/host/scope.test.ts` — **9 ca A/B**: sha của artifact = provenance = bản gốc · toàn bộ `lib/**` khớp byte · tập export trùng · kiểu export trùng · `exports` phủ đúng subpath · provenance + draft + KHÔNG row · đối chứng ÂM (0 row trong dump) · artifact nạp được thật · peer khai đủ.
