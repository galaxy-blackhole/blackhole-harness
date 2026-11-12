<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 19/10/2026
 desc Gói THƯ VIỆN gbh-compaction — vendor 1:1 @deepseek-ai/dsh-compaction (provenance + sha), vì sao KHÔNG mount
-->

# @galaxy-blackhole/gbh-compaction (thư viện)

Bản viết lại **1:1** của `@deepseek-ai/dsh-compaction` bằng cách **vendor nguyên byte** toàn bộ `lib/**` của bản gốc (index.js + types/*.js + *.d.ts).

## 0. Vì sao **KHÔNG** khai `gbh.row`

| đo được | kết quả |
|---|---|
| Row trong dump `.parity/dumps/2026-10-18T01-31-57/ours.yml` | **0** dòng `name: '@deepseek-ai/dsh-compaction'` |
| Dòng trong `docs/PARITY-MATRIX.md` | **không có** (matrix chỉ liệt kê gói cấp row) |
| Hệ quả | consumer inline thư viện vào bundle của họ ⇒ `gbh.draft` (thư viện), **không** `gbh.row`/`gbh.nested` |

## 1. Provenance

| trường | giá trị |
|---|---|
| `gbh.provenance.stock` | `@deepseek-ai/dsh-compaction` |
| `gbh.provenance.version` | `0.2.1-alpha.4` |
| `gbh.provenance.sha` (sha256 `lib/index.js`) | `9db5200bd40b7d046e52308c7cbf209fd95946b22c0a7d10b0a082a992b04533` |
| `lib/index.js` | **175** dòng, byte-identical |

## 2. Build

```bash
bun run packages/host/compaction/build.ts   # vendor lại từ kernel + CỔNG SHA
```

## 3. Test

`tests/host/compaction.test.ts` — **9 ca A/B**: sha của artifact = provenance = bản gốc · toàn bộ `lib/**` khớp byte · tập export trùng · kiểu export trùng · `exports` phủ đúng subpath · provenance + draft + KHÔNG row · đối chứng ÂM (0 row trong dump) · artifact nạp được thật · peer khai đủ.
