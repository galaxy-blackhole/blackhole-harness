<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc Bản sao 1:1 @deepseek-ai/dsh-sandbox-local (556 dòng) — sandbox cục bộ
-->

# @galaxy-blackhole/gbh-sandbox-local

Bản gốc: `@deepseek-ai/dsh-sandbox-local` @0.2.1-alpha.4 — `lib/index.js` **556 dòng**.

## Cách port
Dùng canon `tools/debundle-host.ts`: chép **nguyên văn** `lib/` của bản gốc + ghi dấu `.debundled` (build.ts không build đè) + cổng byte hai chiều (so từng tệp). Test cổng: `tools/check/` + test host liên quan ở `tests/host/`.

## Ghi chú
- `exports` **khớp nguyên bản stock** (copy nguyên khoá).
- Row `sandbox` do gói seam `sandbox-seam` khai; gói này chỉ cung cấp **hành vi** nên KHÔNG khai `gbh.row` (tránh hai gói tranh cùng row id).
