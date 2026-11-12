<!--
 author Bùi Trọng Hiếu
 email kevinbui210191@gmail.com
 create date 15/10/2026
 modify date 21/10/2026
 desc Bản sao 1:1 @deepseek-ai/dsh-experimental-translator
-->

# @galaxy-blackhole/gbh-translator

Bản gốc: `@deepseek-ai/dsh-experimental-translator` @0.2.1-alpha.4 — `lib/index.js` **938 dòng**.

## Cách port
Canon `tools/debundle-host.ts`: chép **nguyên văn** `lib/` + ghi `.debundled` (build.ts không build đè) + cổng byte hai chiều.
